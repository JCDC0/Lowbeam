/**
 * Free roam: the player's car in the valley. Fixed-step physics with collisions, the
 * camera rig, refueling at the pumps, tows when the tank runs dry, resets onto the
 * nearest road, area names and the minimap.
 */

import { Car } from './vehicles/car.js';
import { DT } from './vehicles/physics.js';
import { Colliders } from './world/collision.js';
import { CameraRig, VIEW_NAMES } from './render/cameras.js';
import { Minimap } from './ui/minimap.js';
import { store } from './core/store.js';
import { ECONOMY, WATER_LEVEL } from './world/layout.js';
import { zoneAt } from './world/zones.js';
import { TollMeter } from './world/toll.js';
import { TrafficNet } from './traffic/net.js';
import { TrafficSim } from './traffic/sim.js';
import { TrafficRenderer } from './traffic/render.js';
import { padPoint } from './world/scatter.js';
import { wrapAngle } from './core/mathx.js';
import { createGauges, stepGauges } from './vehicles/gauges.js';
import { repairCost, repairEngine, TEMP_RED } from './vehicles/thermal.js';
import { Cluster } from './ui/cluster.js';
import { audio } from './audio/audio.js';
import { EnvMap } from './audio/env.js';
import { Duel, canChallenge, COUNTDOWN } from './race/duel.js';
import { Pursuit } from './race/pursuit.js';
import { Heat, noticesSpeeding, noticesTrap } from './police/heat.js';
import { roster, unitFor } from './police/units.js';
import { planRoadblock, shouldSetRoadblock, tooNearBlock, planSpikes, hitSpikes, spikePenalty } from './police/roadblock.js';
import { Rally, COUNTDOWN as RALLY_COUNTDOWN } from './race/rally.js';
import { paceNotes } from './race/pacenotes.js';
import { RALLY, WORLD_HALF } from './world/layout.js';
import { Heli, Skyline, helipadOf } from './police/heli.js';
import { HeliView } from './police/heli-view.js';

/** How close to the rally start the car has to be stopped to begin a run. */
const RALLY_NEAR = 15;

/** Formats a run time as m:ss.mmm, the way a stage board shows it. */
function fmtTime(t) {
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  return `${m}:${s < 10 ? '0' : ''}${s.toFixed(3)}`;
}

/** Key shown in prompts for the interact action. */
const INTERACT_KEY = 'F';
/** Seconds the interact key is held at a pump to repair the engine. */
const REPAIR_TIME = 1.5;
/** Liters per second while holding the pump. */
const REFUEL_RATE = 3;
/** How close the car's center must be to a pump to use it. */
const PUMP_REACH = 3.6;
const MAX_STEPS = 12;

export class Drive {
  /**
   * @param {{ world: import('./world/world.js').World, stage: any, input: import('./core/input.js').Input,
   *           hud: import('./ui/hud.js').Hud, toast: (text: string, seconds?: number) => void }} deps
   */
  constructor({ world, stage, input, hud, toast }) {
    this.world = world;
    this.stage = stage;
    this.input = input;
    this.hud = hud;
    this.toast = toast;
    this.colliders = new Colliders(world.scatter.circles, world.scatter.boxes);
    this.ground = world.ground.fn;
    this.minimap = new Minimap(hud.mapSlot, world.ground);
    this.rig = new CameraRig(stage.camera, store.get('cameraView', 'chase'));
    /** @type {Car | null} */
    this.car = null;
    this.acc = 0;
    this.money = store.get('money', ECONOMY.startMoney);
    this.fueled = 0;
    this.repairTimer = 0;
    this.blowsSeen = 0;
    this.hotWarned = false;
    this.areaTimer = 0;
    this.onPass = false;
    /** @type {Duel | null} the duel in progress, null when none. */
    this.duel = null;
    /** The traffic agent being raced, so it can be put back on cruise afterwards. */
    this.duelAgent = null;
    this.duelEndTimer = 0;
    this.duelEnd = '';
    /** @type {Rally | null} the Kuro Pass run in progress. */
    this.rally = null;
    /** The saved best ghost for this car, read at the start of a run. */
    this.rallyBestGhost = null;
    this.rallyEndTimer = 0;
    this.rallyEnd = '';
    this.rallyNoteCache = null;
    this.rallyNoteRoad = null;
    this.rivalDistance = Infinity;
    this.hit = { road: null, s: 0, d: 0, h: 0, edge: 0 };
    /** @type {Cluster | null} */
    this.cluster = null;
    /** @type {ReturnType<typeof createGauges> | null} */
    this.gauges = null;
    this.time = 0;
    this.env = new EnvMap(world.scatter.trees);
    this.tolls = new TollMeter(world.scatter.highway.plazas, store.get('tollBest', {}));
    this.trafficNet = new TrafficNet(world.ground.roads);
    this.traffic = new TrafficSim(this.trafficNet);
    this.trafficView = new TrafficRenderer(world.root);
    // The police helicopter, parked on the HQ roof until something sends it up (heli.js).
    const hq = world.ground.lots.find((p) => p.lot.kind === 'police');
    /** @type {Heli | null} */
    this.heli = hq ? new Heli(helipadOf(hq)) : null;
    this.heliView = new HeliView(world.models || {});
    /** Whether the helicopter is after the player; the police set it, `scrambleHeli` does for now. */
    this.heliChasing = false;
    // The police core (A17): heat says what the police notice, the pursuit event holds the
    // state, and the sim spawns and drives the units.
    /** @type {Heat | null} */
    this.heat = null;
    /** @type {Pursuit | null} */
    this.pursuit = null;
    /** Infraction events collected this frame for the pursuit. @type {string[]} */
    this.infractions = [];
    /** Yen of damage to police cars this frame. */
    this.policeDamage = 0;
    /** The last speed the toll meter saw, for the speed trap. */
    this.lastTollSpeed = 0;
    /** @type {any} the standing roadblock, if any. */
    this.roadblock = null;
    /** @type {any} the spike strip laid across it, if any. */
    this.spikes = null;
    /** Seconds the tires have been flat. */
    this.flatTime = 0;
    /** Seconds since the last roadblock was laid. */
    this.blockCooldown = 0;
    /** Roadblocks and strips dodged, for the end-of-pursuit report. */
    this.roadblocksDodged = 0;
    this.spikesDodged = 0;
    if (this.heli && this.heliView.ok) {
      world.add(this.heliView.group);
      world.add(this.heliView.cone);
      this.heliView.update(this.heli);
      const roofs = [...world.scatter.buildings, ...world.ground.lots.map((p) => {
        const m = world.models?.[p.lot.model];
        return { x: p.cx, z: p.cz, y: p.h, w: m ? m.size[0] : 0, d: m ? m.size[2] : 0, h: m ? m.size[1] : 0 };
      })];
      const hf = world.ground.hf;
      const deck = { road: null, s: 0, d: 0, h: 0, edge: 0, lift: 0 };
      this.heliWorld = {
        target: null,
        skyline: new Skyline((x, z) => hf.at(x, z), roofs, WORLD_HALF),
        groundAt: (x, z) => world.ground.at(x, z).h,
        // A car under a deck is out of the light.
        covered: (x, z, y) => world.ground.roads.query(x, z, deck, 0, -Infinity, Infinity) && (deck.lift || 0) > 2 && deck.h > y + 2.5,
      };
    } else this.heli = null;
  }

  /** Sends the helicopter up after the player (a stand-in until the police core decides). */
  scrambleHeli() {
    if (!this.heli) return;
    this.heliChasing = true;
    this.heli.launch();
  }

  /** Sends the helicopter home to land. */
  recallHeli() {
    if (!this.heli) return;
    this.heliChasing = false;
    this.heli.recall();
  }

  /**
   * The pursuit as the HUD shows it (A13 contract), null while there is none. The helicopter
   * alone is not a pursuit.
   * @returns {any}
   */
  pursuitView() {
    if (this.pursuit && (this.pursuit.pstate === 'busted' || this.pursuit.pstate === 'escaped')) {
      return this.pursuit.reportView();
    }
    return this.pursuit ? this.pursuit.view() : null;
  }

  /**
   * Every police car and the helicopter for the maps (A13 contract): each unit, plus the
   * helicopter while it is off the pad, with its searchlight's spot. A searching unit also
   * carries its sight cone, and the first marker carries where they think the player is.
   * @returns {{ kind: string, x: number, z: number, yaw: number, search?: { x: number, z: number, r: number }, cone?: { r: number, half: number }, last?: { x: number, z: number, r: number } }[]}
   */
  policeMarkers() {
    /** @type {any[]} */
    const out = [];
    const h = this.heli;
    if (h && h.state !== 'parked') {
      out.push({ kind: 'heli', x: h.x, z: h.z, yaw: h.yaw, search: h.spot.on ? { x: h.spot.x, z: h.spot.z, r: h.spot.r } : undefined });
    }
    const searching = this.pursuit ? this.pursuit.pstate === 'cooldown' : false;
    const units = this.traffic.units();
    for (const u of units) {
      const m = { kind: 'police', x: u.x, z: u.z, yaw: u.yaw };
      if (searching) m.cone = { r: 60, half: 0.61 };
      out.push(m);
    }
    if (out.length && searching && this.pursuit) out[0].last = { x: this.pursuit.last.x, z: this.pursuit.last.z, r: this.pursuit.last.r };
    return out;
  }

  /**
   * One frame of the police: what they notice, how hard they are trying, whether they can see
   * the player, and the units themselves. Called from the drive frame.
   * @param {number} dt @param {any} s the car state
   */
  stepPolice(dt, s) {
    if (!this.heat) this.heat = new Heat();
    const units = this.traffic.unitsNear(s, 200);
    const near = units[0];
    const speedKmh = s.speed * 3.6;
    // What the police notice this frame.
    const events = { speeding: false, trap: false, duel: !!this.duel };
    if (near && noticesSpeeding(s, near.agent)) events.speeding = true;
    if (noticesTrap(this.lastTollSpeed)) events.trap = true;
    if (this.policeDamage > 0) events.hitPolice = true;

    // A pursuit starts the moment the heat reaches the first level, and runs while any unit is
    // involved or the helicopter is up.
    this.heat.update(dt, { ...events, pursuit: this.pursuit ? this.pursuit.pstate !== 'escaped' : false });
    const level = this.heat.level;
    if (!this.pursuit && level >= 1) {
      this.pursuit = new Pursuit();
      this.pursuit.setHeat(level, false);
    }
    // Send more units out as the heat rises, from the roster for that level.
    const want = level ? roster(level).length : this.traffic.patrolTarget;
    while (this.traffic.countUnits() < want) {
      const a = this.traffic.spawnUnit(s, level ? unitFor(level).id : 'police', 120, 380);
      if (!a) break;
      if (this.pursuit) this.pursuit.involve();
    }
    // Units chase once there is a pursuit and the helicopter is up at heat 3 and over.
    const heliUp = level >= 3;
    if (heliUp && !this.heliChasing) this.scrambleHeli();
    if (this.heliChasing && (this.pursuit?.pstate === 'escaped' || this.pursuit?.pstate === 'busted' || level === 0)) this.recallHeli();
    this.heliChasing = heliUp && !!this.pursuit && this.pursuit.pstate !== 'escaped' && this.pursuit.pstate !== 'busted';
    for (const u of units) u.agent.pursuit = !!this.pursuit;

    // Roadblocks and spike strips at heat 4 and up (A17 part 4). The block is planned on the
    // lane ahead of the player, spawned as parked units, with a strip laid across the gap.
    this.blockCooldown = Math.max(0, this.blockCooldown - dt);
    if (shouldSetRoadblock(s, this.roadblock, level, this.blockCooldown) && this.pursuit) {
      const road = this.world.ground.at(s.x, s.z, s.y).road;
      const lane = road ? this.trafficNet.lane(road.id, road.dir > 0 ? 1 : -1, 0) : null;
      if (lane) {
        const aheadS = this.laneAheadS(lane, s);
        const block = planRoadblock({ lane, s: aheadS, sample: (l, at, o) => this.trafficNet.sample(l, at, o) }, level);
        if (block) {
          this.roadblock = block;
          this.spikes = planSpikes(block, level);
          this.blockCooldown = 30;
          this.roadblocksDodged++;
        }
      }
    }
    // Drive over a strip and the tires go flat.
    if (this.spikes && hitSpikes(this.spikes, s)) this.flatTime = Math.max(this.flatTime, 0.1);
    if (this.flatTime > 0) {
      this.flatTime += dt;
      if (!spikePenalty(this.flatTime).active) this.flatTime = 0;
    }

    // In sight: a unit close enough, or the helicopter's light on the player.
    const seen = (near && near.d < 150) || !!(this.heliChasing && this.heli.spot.sees);
    if (this.pursuit) {
      this.pursuit.setHeat(level, this.heliChasing);
      if (seen) this.pursuit.lastSeen(s.x, s.z);
      const hiding = this.inHidingSpot(s);
      this.pursuit.update(dt, {
        speed: s.speed, seen, units: this.traffic.countUnits(), heli: this.heliChasing,
        hiding, damage: this.policeDamage, events: this.infractions,
      });
    }
    this.policeDamage = 0;
    this.infractions.length = 0;
    this.traffic.heat = level;
  }

  /** The lane arc length of the player's position on this lane, so a roadblock can be laid ahead. @param {any} lane @param {any} s */
  laneAheadS(lane, s) {
    const hit = lane.road.path.nearest(s.x, s.z);
    return hit ? hit.s : 0;
  }

  /** Whether the car is somewhere the police lose you: a hideout lot, under a deck, a car park. @param {any} s */
  inHidingSpot(s) {
    for (const p of this.world.ground.lots) if (p.lot.kind === 'hideout' && Math.hypot(p.cx - s.x, p.cz - s.z) < 30) return true;
    if (this.heliWorld && this.heliWorld.covered(s.x, s.z, s.y)) return true;
    return false;
  }

  /**
   * A fresh car beside the first pump at G1.
   * @param {import('./vehicles/specs.js').CarSpec} spec @param {number} paint
   */
  start(spec, paint) {
    if (this.car) {
      this.world.root.remove(this.car.group, this.car.fx.group);
      this.car.dispose();
    }
    this.car = new Car(spec, paint);
    this.world.add(this.car.group);
    this.world.add(this.car.fx.group);
    this.gauges = createGauges(spec);
    audio.setCar(spec);
    if (!this.cluster) this.cluster = new Cluster(this.hud.clusterSlot, spec, store.get('clusterStyle', 'car'));
    else this.cluster.setSpec(spec, store.get('clusterStyle', 'car'));
    this.toPump(this.world.scatter.stations[0]);
    this.traffic.agents.length = 0;
    this.traffic.populate(this.car.state);
    this.acc = 0;
    this.blowsSeen = 0;
    this.hotWarned = false;
    this.hud.area('');
    this.areaTimer = 0;
  }

  /** Parks the car on the road side of a station's first pump island, facing along the road. */
  toPump(st) {
    const pad = st.pad;
    const isl = st.layout.islands[0];
    const pump = st.pumps[0];
    const p = padPoint(pad, pump.u, isl.v - 2.4);
    this.car.place(p.x, p.z, Math.atan2(pad.ux, pad.uz), this.ground);
    this.rig.snap();
  }

  /** Puts the car back on the centerline of the nearest road, facing the way it was going. */
  resetToRoad() {
    const s = this.car.state;
    const h = this.hit;
    if (!this.world.ground.roads.influence(s.x, s.z, 600, h)) return;
    const p = h.road.path.sample(h.s);
    let yaw = Math.atan2(p.tx, p.tz);
    if (Math.abs(wrapAngle(yaw - s.yaw)) > Math.PI / 2) yaw += Math.PI;
    this.car.place(p.x, p.z, yaw, this.ground);
    this.rig.snap();
  }

  /** Starts a duel with a rival traffic agent. @param {import('./traffic/sim.js').Agent} agent */
  startDuel(agent) {
    this.duel = new Duel({ id: agent.kind.id, name: agent.kind.name, speedFactor: agent.kind.speed[1] });
    this.duelAgent = agent;
    this.duelEndTimer = 0;
    this.duelEnd = '';
    agent.duel = true;
    this.toast(`DUEL  ${agent.kind.name}`, 2.5);
  }

  /** Ends the duel, pays the prize if it was won, and puts the rival back on cruise. */
  endDuel() {
    const duel = this.duel;
    if (!duel) return;
    const out = duel.result();
    if (this.duelAgent) this.duelAgent.duel = false;
    this.duel = null;
    this.duelAgent = null;
    if (!out) {
      this.duelEndTimer = 0;
      return;
    }
    if (out.won) {
      const wins = store.get('duelWins', {});
      wins[out.rival] = (wins[out.rival] || 0) + 1;
      store.set('duelWins', wins);
      this.money += out.prize;
      store.set('money', this.money);
      this.duelEnd = `YOU WIN  ¥${out.prize.toLocaleString('en-US')}`;
    } else {
      this.duelEnd = 'YOU LOSE';
    }
    this.duelEndTimer = 3;
  }

  /** Advances the duel one step and plays its beeps. @param {number} dt */
  stepDuel(dt) {
    const duel = this.duel;
    const agent = this.duelAgent;
    if (!duel || !agent) return;
    const s = this.car.state;
    if (agent.mode !== 'drive') {
      duel.abort();
      this.endDuel();
      return;
    }
    const tx = Math.sin(s.yaw);
    const tz = Math.cos(s.yaw);
    const gap = (agent.x - s.x) * tx + (agent.z - s.z) * tz;
    for (const e of duel.update(dt, { gap })) {
      if (e.type === 'count') audio.beep('count');
      else if (e.type === 'go') audio.beep('go');
      else if (e.type === 'end') this.endDuel();
    }
  }

  /** What the duel panel should show this frame, or null when no duel is running. */
  duelPanel() {
    if (this.duelEndTimer > 0) return { rival: '', player: 0, rivalGauge: 0, count: 0, end: this.duelEnd };
    const duel = this.duel;
    if (!duel) return null;
    const count = duel.state === 'countdown' ? Math.max(1, Math.ceil(COUNTDOWN - duel.time)) : 0;
    return { rival: duel.rival.name, player: duel.gauge.player, rivalGauge: duel.gauge.rival, count, end: '' };
  }

  // ── Kuro Pass time attack (A11 part 3) ───────────────────────────────────────

  /** The stage road, read from the world every time rather than cached. */
  rallyRoad() {
    return this.world.ground.roads.byId.get(RALLY.road) || null;
  }

  /** The pace notes for the stage, built once per run. */
  rallyNotes(road) {
    if (this.rallyNoteCache && this.rallyNoteRoad === road) return this.rallyNoteCache;
    this.rallyNoteRoad = road;
    this.rallyNoteCache = paceNotes(road.path, (s) => road.heightAt(s));
    return this.rallyNoteCache;
  }

  /** True when the car is stopped on the stage road near the start line. */
  atRallyStart() {
    const road = this.rallyRoad();
    if (!road) return false;
    const s = this.car.state;
    if (s.speed > 1) return false;
    const p = road.path.nearest(s.x, s.z);
    return Math.abs(p.d) < road.hw + 4 && Math.abs(p.s - RALLY.startS) < RALLY_NEAR;
  }

  /** Puts the car on the start line facing down the stage. */
  placeOnRallyStart() {
    const road = this.rallyRoad();
    if (!road) return;
    const p = road.path.sample(RALLY.startS);
    this.car.place(p.x, p.z, Math.atan2(p.tx, p.tz), this.ground);
    this.rig.snap();
  }

  /** Starts a run, telling the traffic sim to keep off the stage. */
  startRally() {
    const road = this.rallyRoad();
    if (!road) return;
    const carId = this.car.spec.id;
    const best = store.get('rallyBest', {})[carId];
    const ghost = store.get('rallyGhost', {})[carId];
    this.rally = new Rally(carId, RALLY, /** @type {any} */ (road), { best: best ? best.time : null, bestSplits: best ? best.splits : null });
    this.rallyBestGhost = ghost || null;
    this.rallyEndTimer = 0;
    this.rallyEnd = '';
    this.placeOnRallyStart();
    this.rallyNotes(road);
    this.traffic.rallyRoad = RALLY.road;
    audio.music.hold('ridge');
    this.toast(RALLY.name, 2.5);
  }

  /** Ends the run, saves a new best and its ghost, and gives the stage back. */
  endRally() {
    const rally = this.rally;
    if (!rally) return;
    const out = rally.result();
    if (this.traffic.rallyRoad) this.traffic.rallyRoad = null;
    audio.music.release();
    this.rally = null;
    if (!out) {
      this.rallyEndTimer = 0;
      this.rallyEnd = 'RUN ABORTED';
      this.rallyEndTimer = 3;
      return;
    }
    const carId = this.car.spec.id;
    if (out.record) {
      const best = store.get('rallyBest', {});
      best[carId] = { time: out.time, splits: out.splits.map((sp) => sp.at) };
      store.set('rallyBest', best);
      const ghosts = store.get('rallyGhost', {});
      ghosts[carId] = rally.ghost;
      store.set('rallyGhost', ghosts);
      this.rallyEnd = `NEW BEST  ${fmtTime(out.time)}  +¥${out.prize.toLocaleString('en-US')}`;
    } else {
      this.rallyEnd = `${fmtTime(out.time)}  ${out.medals[0] ? out.medals[0].toUpperCase() : ''}  +¥${out.prize.toLocaleString('en-US')}`;
    }
    this.money += out.prize;
    store.set('money', this.money);
    this.rallyEndTimer = 4;
  }

  /** Advances the run one step, plays the beeps and handles the result. */
  stepRally(dt) {
    const rally = this.rally;
    if (!rally) return;
    const road = this.rallyRoad();
    if (!road) {
      this.endRally();
      return;
    }
    const s = this.car.state;
    const p = road.path.nearest(s.x, s.z);
    // Off the stage means off course, which is what d being huge tells the rally.
    const onRoad = Math.abs(p.d) < road.hw + 6;
    for (const e of rally.update(dt, /** @type {any} */ ({
      s: onRoad ? p.s : rally.lastS,
      d: onRoad ? p.d : 999,
      pose: { x: s.x, z: s.z, yaw: s.yaw },
    }))) {
      if (e.type === 'count') audio.beep('count');
      else if (e.type === 'go') audio.beep('go');
      else if (e.type === 'end' || e.type === 'abort') this.endRally();
    }
    if (onRoad) this.rally.lastS = p.s;
  }

  /**
   * What the rally panel should show this frame, or null when no run is going.
   * @returns {{ time: string, split: { delta: number, ahead: boolean } | null,
   *   notes: { text: string }[], count: number, end: string, off: number } | null}
   */
  rallyPanel() {
    if (this.rallyEndTimer > 0) return { time: '', split: null, notes: [], count: 0, end: this.rallyEnd, off: 0 };
    const rally = this.rally;
    if (!rally) return null;
    const road = this.rallyRoad();
    const notes = road ? this.rallyNotes(road) : [];
    const s = road ? road.path.nearest(this.car.state.x, this.car.state.z).s : 0;
    const ahead = notes.filter((n) => n.s > s - 20).slice(0, 2);
    const last = rally.splits[rally.splits.length - 1];
    const count = rally.state === 'countdown' ? Math.max(1, Math.ceil(RALLY_COUNTDOWN - rally.elapsed)) : 0;
    return {
      time: fmtTime(rally.lapTime + rally.penalty),
      split: last && last.against !== null ? { delta: last.at - last.against, ahead: last.ahead } : null,
      notes: ahead.map((n) => ({ text: `${n.dir === 'left' ? 'L' : 'R'} ${n.grade}${n.mods.length ? ' ' + n.mods.join(' ').toUpperCase() : ''}` })),
      count,
      end: '',
      off: rally.offCountdown > 0 ? Math.ceil(rally.offCountdown) : 0,
    };
  }

  /** Tow to the nearest station's pump for a fee. A blown engine is rebuilt on the way, as far as the money goes. */
  tow() {
    const s = this.car.state;
    let best = this.world.scatter.stations[0];
    let bd = Infinity;
    for (const st of this.world.scatter.stations) {
      const d = Math.hypot(st.pad.cx - s.x, st.pad.cz - s.z);
      if (d < bd) {
        bd = d;
        best = st;
      }
    }
    const fee = ECONOMY.towCost + repairCost(s);
    this.money = Math.max(0, this.money - fee);
    repairEngine(s);
    store.set('money', this.money);
    this.toPump(best);
    this.toast(`TOWED TO ${best.pad.name}`, 3);
  }

  /** The pump the car is parked at, if it is close and stopped. */
  nearPump() {
    const s = this.car.state;
    for (const st of this.world.scatter.stations) {
      if (Math.hypot(st.pad.cx - s.x, st.pad.cz - s.z) > st.pad.hw + st.pad.hd) continue;
      for (const p of st.pumps) if (Math.hypot(p.x - s.x, p.z - s.z) < PUMP_REACH) return p;
    }
    return null;
  }

  /** @param {number} x @param {number} y @param {number} z */
  areaName(x, y, z) {
    const g = this.world.ground.at(x, z, y);
    if (g.pad) return g.pad.name;
    const named = g.road && g.road.def.cls !== 'street';
    if (named) return g.road.name;
    const zone = zoneAt(x, z);
    if (zone) return zone.name;
    if (g.road) return g.road.name;
    return y > 150 ? 'KURO MOUNTAINS' : 'KUROGANE OUTSKIRTS';
  }

  /**
   * @param {number} dt
   * @returns {'pause' | null}
   */
  update(dt) {
    const input = this.input;
    const car = this.car;
    const s = car.state;
    const spec = car.spec;
    if (input.pressed('pause')) return 'pause';
    if (input.pressed('camera')) {
      const v = this.rig.cycle();
      store.set('cameraView', this.rig.view);
      this.toast(VIEW_NAMES[v], 1.2);
    }

    let drive = input.drive(dt);
    let prompt = '';
    let refueling = false;
    const pump = s.speed < 0.6 ? this.nearPump() : null;
    const hurt = s.blown || s.damage > 0.02;
    const tankFull = s.fuel >= spec.fuel.tank - 0.05;
    if (pump && hurt && (s.blown || tankFull)) {
      const cost = repairCost(s);
      drive = { throttle: 0, brake: 0, steer: 0, handbrake: 0, shiftUp: false, shiftDown: false, manual: drive.manual };
      if (this.money < cost) {
        prompt = `ENGINE DAMAGED   REPAIR ¥${cost.toLocaleString('en-US')}   NOT ENOUGH MONEY`;
        this.repairTimer = 0;
      } else if (input.held('interact')) {
        this.repairTimer += dt;
        prompt = `REPAIRING ENGINE  ${Math.min(100, Math.round((this.repairTimer / REPAIR_TIME) * 100))} %`;
        if (this.repairTimer >= REPAIR_TIME) {
          this.money -= cost;
          store.set('money', this.money);
          repairEngine(s);
          this.repairTimer = 0;
          this.toast(`ENGINE REPAIRED  ¥${cost.toLocaleString('en-US')}`, 2.5);
        }
      } else {
        this.repairTimer = 0;
        prompt = `HOLD ${INTERACT_KEY} TO REPAIR ENGINE  ¥${cost.toLocaleString('en-US')}`;
      }
    } else if (pump && s.fuel < spec.fuel.tank - 0.05) {
      this.repairTimer = 0;
      if (input.held('interact') && this.money >= 1) {
        const liters = Math.min(REFUEL_RATE * dt, spec.fuel.tank - s.fuel, this.money / ECONOMY.fuelPrice);
        s.fuel += liters;
        this.money -= liters * ECONOMY.fuelPrice;
        this.fueled += liters;
        if (s.fuel > 0) s.engineOn = true;
        // Zero input, not the brake: holding the brake at rest selects reverse.
        drive = { throttle: 0, brake: 0, steer: 0, handbrake: 0, shiftUp: false, shiftDown: false, manual: drive.manual };
        refueling = true;
        prompt = `REFUELING  ${this.fueled.toFixed(1)} L  ¥${Math.round(this.fueled * ECONOMY.fuelPrice).toLocaleString('en-US')}`;
      } else {
        prompt = this.money >= 1 ? `HOLD ${INTERACT_KEY} TO REFUEL  ¥${ECONOMY.fuelPrice} / L` : 'NO MONEY FOR FUEL';
      }
    } else if (pump && s.fuel >= spec.fuel.tank - 0.05) {
      prompt = 'TANK FULL';
    }
    if (this.fueled > 0 && !input.held('interact')) {
      store.set('money', this.money);
      this.toast(`${this.fueled.toFixed(1)} L FOR ¥${Math.round(this.fueled * ECONOMY.fuelPrice).toLocaleString('en-US')}`, 2.5);
      this.fueled = 0;
    }
    if (!s.engineOn && !pump) prompt = `OUT OF FUEL   R  TOW TO A STATION  ¥${ECONOMY.towCost.toLocaleString('en-US')}`;
    else if (s.blown && !pump) prompt = `ENGINE BLOWN   LIMP TO A PUMP OR  R  TOW  ¥${(ECONOMY.towCost + repairCost(s)).toLocaleString('en-US')}`;
    if (!prompt) {
      const rival = this.traffic.nearestRival(s, 220);
      if (rival) {
        const offer = !this.duel && canChallenge({ distance: rival.distance, ahead: rival.ahead, road: rival.agent.lane.road.id });
        prompt = offer
          ? `H  CHALLENGE  ${rival.agent.kind.name}   ${Math.round(rival.distance)} M`
          : `RIVAL  ${rival.agent.kind.name}   ${rival.ahead ? 'AHEAD' : 'BEHIND'} ${Math.round(rival.distance)} M`;
      }
    }
    // Kuro Pass time attack: stopped on the start line, F begins a run. F is also the
    // refuel key, so it only starts a run when there is nothing else to do.
    if (!this.rally) {
      const atStart = this.atRallyStart();
      if (atStart && !prompt && input.pressed('interact')) this.startRally();
      else if (atStart && !prompt) prompt = `${INTERACT_KEY}  ${RALLY.name}`;
    }
    // A duel with a street racer: the challenge key starts one, the pure Duel runs the
    // gauges and the HUD shows them. The rival agent races at its top speed while duelling.
    if (input.pressed('challenge') && !this.duel) {
      const near = this.traffic.nearestRival(s, 220);
      if (near && canChallenge({ distance: near.distance, ahead: near.ahead, road: near.agent.lane.road.id })) {
        this.startDuel(near.agent);
      } else {
        this.toast('NO RACER AHEAD TO CHALLENGE', 2);
      }
    }
    if (input.pressed('reset')) {
      if (this.rally) {
        // Back on the stage, with the penalty the rules ask for.
        this.rally.penalize();
        this.placeOnRallyStart();
        this.toast('BACK ON THE STAGE  +5.000', 2);
      } else if (!s.engineOn || s.blown) this.tow();
      else this.resetToRoad();
    }
    if (s.blowCount !== this.blowsSeen) {
      this.blowsSeen = s.blowCount;
      this.rig.bump(9);
      this.toast('ENGINE BLOWN   MONEY SHIFT', 3.5);
    }
    if (s.temp >= TEMP_RED + 3 && !this.hotWarned && !s.blown) {
      this.hotWarned = true;
      this.toast('ENGINE OVERHEATING   EASE OFF', 2.5);
    } else if (s.temp < TEMP_RED - 6) this.hotWarned = false;

    const x0 = s.x;
    const z0 = s.z;
    this.acc += dt;
    let steps = 0;
    while (this.acc >= DT && steps < MAX_STEPS) {
      const impact = car.step(drive, this.ground, this.colliders);
      if (impact > 2.5) {
        this.rig.bump(impact);
        audio.impact(impact);
      }
      this.acc -= DT;
      steps++;
    }
    if (steps === MAX_STEPS) this.acc = 0;
    this.traffic.update(dt, s);
    const crash = this.traffic.collideWithPlayer(s, spec);
    if (crash > 2.5) {
      this.rig.bump(crash);
      audio.impact(crash);
    }
    this.trafficView.update(this.traffic.agents, this.car.state, this.time);
    if (this.heli) {
      this.heliWorld.target = this.heliChasing ? s : null;
      this.heli.update(dt, this.heliWorld);
      this.heliView.update(this.heli);
    }
    const gate = this.tolls.step({ x: x0, z: z0 }, s, s.speed * 3.6, this.time);
    if (gate) {
      const paid = Math.min(this.money, gate.fee);
      this.money -= paid;
      store.set('money', this.money);
      store.set('tollBest', this.tolls.best);
      const kmh = Math.round(gate.speed);
      // A speed trap run this fast is what the police call an infraction (A17).
      this.lastTollSpeed = gate.speed;
      if (noticesTrap(gate.speed)) this.infractions.push('tollRun');
      this.toast(`${gate.name}   ${kmh} KM/H   ¥${paid.toLocaleString('en-US')}${gate.record ? '   NEW BEST' : `   BEST ${Math.round(gate.best)}`}`, 3.2);
      audio.ui('select');
    }

    // The police: what they notice, the units, and the pursuit state (A17).
    this.stepPolice(dt, s);

    if (s.surfFront === 'water' && s.y < WATER_LEVEL - 0.5) {
      this.resetToRoad();
      this.toast('PULLED OUT OF THE LAKE', 2.5);
    }

    car.pose(this.acc / DT, dt);
    this.rig.update(car, this.ground, dt);
    this.time += dt;
    stepGauges(this.gauges, spec, s, dt);
    const cockpit = this.rig.view === 'cockpit';
    this.cluster.show(!cockpit);
    if (cockpit) car.cockpit.update(this.gauges, dt, this.time);
    else this.cluster.draw(this.gauges, dt);

    this.areaTimer -= dt;
    if (this.areaTimer <= 0) {
      this.areaTimer = 0.3;
      this.hud.area(this.areaName(s.x, s.y, s.z));
      // The music follows the pass and the street racers (soundtrack.js).
      const road = this.world.ground.at(s.x, s.z, s.y).road;
      this.onPass = zoneAt(s.x, s.z)?.id === 'pass' || road?.id === 'kuro';
      const near = this.traffic.nearestRival(s, 400);
      this.rivalDistance = near ? near.distance : Infinity;
    }
    this.hud.money(this.money);
    this.hud.prompt(prompt, cockpit);
    this.stepDuel(dt);
    if (this.duelEndTimer > 0) this.duelEndTimer = Math.max(0, this.duelEndTimer - dt);
    this.hud.duelPanel(this.duelPanel());
    this.stepRally(dt);
    if (this.rallyEndTimer > 0) this.rallyEndTimer = Math.max(0, this.rallyEndTimer - dt);
    this.hud.rallyPanel(this.rallyPanel());
    audio.pump(refueling);
    const around = this.env.at(s.x, s.z);
    audio.update({ dt, state: s, spec, boost: this.gauges.boost, view: this.rig.view, env: around, pad: s.surfFront === 'concrete', mountain: this.onPass, rival: this.rivalDistance, rally: !!this.rally, traffic: this.traffic.agents });
    this.minimap.draw(car.lerped.x, car.lerped.z, car.lerped.yaw, s.speed, dt);
    return null;
  }

  render() {
    this.stage.camera.updateMatrixWorld();
    this.world.update(this.stage.camera, this.car.group.position);
    this.stage.render(this.world.scene, this.stage.camera);
  }
}
