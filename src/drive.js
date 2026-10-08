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
import { DamageFx } from './traffic/damage-fx.js';
import { padPoint } from './world/scatter.js';
import { wrapAngle } from './core/mathx.js';
import { createGauges, stepGauges } from './vehicles/gauges.js';
import { repairCost, repairEngine, TEMP_RED } from './vehicles/thermal.js';
import { refillCost } from './vehicles/nitrous.js';
import { Cluster } from './ui/cluster.js';
import { audio } from './audio/audio.js';
import { EnvMap } from './audio/env.js';
import { Duel, canChallenge, COUNTDOWN } from './race/duel.js';
import { PoliceDirector, SIGHT_RANGE } from './police/director.js';
import { planRoadblock } from './police/roadblock.js';
import { clearLine } from './police/sight.js';
import { PursuitView } from './police/pursuit-view.js';
import { sirenVoices, rotorSound } from './audio/siren.js';
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
/** Seconds the interact key is held at a pump to fill the nitrous bottle. */
const N2O_FILL_TIME = 1.5;
/** Liters per second while holding the pump. */
const REFUEL_RATE = 3;
/** How far past a deck's edge a reset still puts the car back on the deck. */
const DECK_RESET = 12;
/** How close the car's center must be to a pump to use it. */
const PUMP_REACH = 3.6;
const MAX_STEPS = 12;

export class Drive {
  /**
   * @param {{ world: import('./world/world.js').World, stage: any, input: import('./core/input.js').Input,
   *           hud: import('./ui/hud.js').Hud, toast: (text: string, seconds?: number) => void }} deps
   */
  /**
   * @param {{ world: any, stage: any, input: any, hud: any, toast: (text: string, seconds?: number) => void,
   *   banner?: import('./ui/menus.js').Banner, flash?: () => void }} o
   */
  constructor({ world, stage, input, hud, toast, banner, flash }) {
    this.world = world;
    this.stage = stage;
    this.input = input;
    this.hud = hud;
    this.toast = toast;
    /** The big event banner (pursuits, takedowns, a blown engine); a toast where there is none. */
    this.banner = banner || ((text, o = {}) => toast(o.sub ? `${text}   ${o.sub}` : text, o.seconds));
    this.flash = flash || (() => {});
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
    this.trafficView = new TrafficRenderer(world.root, world.models);
    this.damageFx = new DamageFx(world.root);
    // The police helicopters (heli.js): the first parked on the HQ roof, two more as backup that fly
    // in from out of town over the west and east hills at heat 4 and 5 and leave the same way.
    const hq = world.ground.lots.find((p) => p.lot.kind === 'police');
    const hf0 = world.ground.hf;
    const sky = (x, z) => ({ x, y: hf0.at(x, z) + 140, z, yaw: 0 });
    /** @type {Heli[]} */
    this.helis = hq ? [
      new Heli(helipadOf(hq)),
      new Heli(sky(-2600, 900), { slot: 1, sky: true }),
      new Heli(sky(2600, 900), { slot: 2, sky: true }),
    ] : [];
    this.heliViews = this.helis.map(() => new HeliView(world.models || {}));
    /** How many helicopters the police have sent after the player. */
    this.helisUp = 0;
    // The police (police/director.js): the director decides, the Drive tells it what is true and
    // carries out its orders, the sim drives the units.
    this.police = new PoliceDirector();
    /** What the director said this frame (its view is the HUD's). @type {import('./police/director.js').PoliceOrders | null} */
    this.policeOrders = null;
    /** The detection bar and the units that see the player, from the last orders. @type {{ level: number, watchers: number[] } | null} */
    this.detect = null;
    /** A toast held back until the pursuit's end card is gone. */
    this.afterReport = '';
    /** The nearest helicopter's last distance, for the rotor's Doppler. */
    this.heliDist = Infinity;
    /** The km/h of a toll gate crossed this frame, for the speed trap; one frame only. @type {number | null} */
    this.tollKmh = null;
    /** The roadblock's parked units, so they can be sent after the player when it comes down. @type {any[]} */
    this.blockUnits = [];
    this.pursuitView3d = new PursuitView(world.models || {});
    world.add(this.pursuitView3d.group);
    // The units see through what the player can see through, and drive on the ground.
    const terrain = world.ground.hf;
    /** Whether a point hides a car: inside a building, or under the hillside. @param {number} x @param {number} z @param {number} y */
    this.solid = (x, z, y) => this.colliders.solidAt(x, z, y) || terrain.at(x, z) > y + 0.5;
    this.traffic.clear = (a, b) => clearLine(a, { x: b.x, y: b.y ?? a.y, z: b.z }, this.solid);
    this.traffic.groundAt = (x, z, y) => world.ground.at(x, z, y + 1).h;
    this.traffic.hitWorld = (x, z, r, y) => {
      const c = this.colliders.probe(x, z, r, y);
      return c && { nx: c.nx, nz: c.nz, depth: c.depth, px: c.px, pz: c.pz };
    };
    if (this.helis.length && this.heliViews[0].ok) {
      this.helis.forEach((h, i) => {
        world.add(this.heliViews[i].group);
        world.add(this.heliViews[i].cone);
        this.heliViews[i].update(h);
      });
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
    } else this.helis = [];
  }

  /**
   * Puts `n` helicopters after the player and sends the rest home: the HQ's first, then the backup.
   * @param {number} n
   */
  setHelis(n) {
    if (n === this.helisUp) return;
    this.helis.forEach((h, i) => (i < n ? h.launch() : h.recall()));
    this.helisUp = Math.min(n, this.helis.length);
  }

  /**
   * The pursuit as the HUD shows it (A13 contract), null while there is none. The helicopter
   * alone is not a pursuit.
   * @returns {any}
   */
  pursuitView() {
    const view = this.policeOrders ? this.policeOrders.view : null;
    if (!view) return null;
    const units = this.traffic.units().filter((a) => a.mode !== 'wreck');
    const byKind = {
      police: 0,
      'police-fast': 0,
      'police-int': 0,
      'police-heavy': 0,
    };
    for (const u of units) {
      const k = u.kind?.id ?? 'police';
      if (k in byKind) byKind[k]++;
    }
    return {
      ...view,
      helis: this.helisUp,
      nearby: this.policeOrders?.detect.watchers.length ?? 0,
      assigned: this.police.assigned,
      byKind,
    };
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
    for (const h of this.helis) {
      if (h.state === 'parked') continue;
      out.push({ kind: 'heli', x: h.x, z: h.z, yaw: h.yaw, search: h.spot.on ? { x: h.spot.x, z: h.spot.z, r: h.spot.r } : undefined });
    }
    const pursuit = this.police.pursuit;
    const searching = this.police.active && pursuit?.pstate === 'cooldown';
    const units = this.traffic.units();
    for (const u of units) {
      const m = { kind: 'police', x: u.x, z: u.z, yaw: u.yaw, active: !!u.pursuit, sees: !!this.detect?.watchers.includes(u.id) };
      if (searching) m.cone = { r: 60, half: 0.61 };
      out.push(m);
    }
    if (out.length && searching && pursuit) out[0].last = { x: pursuit.last.x, z: pursuit.last.z, r: pursuit.last.r };
    return out;
  }

  /**
   * One frame of the police: tell the director what is true, carry out what it says. Called from
   * the drive frame after the traffic has moved.
   * @param {number} dt @param {any} s the car state
   */
  stepPolice(dt, s) {
    const happened = this.traffic.takeEvents();
    const units = this.traffic.units().filter((a) => a.mode !== 'wreck').map((a) => {
      const d = Math.hypot(a.x - s.x, a.z - s.z);
      const clear = d < SIGHT_RANGE && Math.abs(a.y - s.y) < 6 && clearLine(a, s, this.solid);
      return { id: a.id, x: a.x, z: a.z, yaw: a.yaw, d, clear, kind: a.kind.id, vx: a.vx, vz: a.vz };
    });
    const road = this.world.ground.at(s.x, s.z, s.y).road;

    const orders = this.police.update(dt, {
      player: s, units,
      limit: road?.def.limit ?? 100,
      patrols: this.traffic.patrolTarget,
      heliSees: this.helis.some((h, i) => i < this.helisUp && h.spot.sees),
      toll: this.tollKmh,
      duel: !!this.duel,
      hitPolice: happened.policeHit * 250,
      wrecked: happened.civilWrecks,
      destroyed: happened.destroyed,
      hiding: this.inHidingSpot(s),
      money: this.money,
      planBlock: (level) => {
        const at = this.trafficNet.locate(s.x, s.z, s.yaw, s.y + 0.5);
        return at ? planRoadblock({ lane: at.lane, s: at.s, sample: (l, x, o) => this.trafficNet.sample(l, x, o) }, level) : null;
      },
    });
    this.tollKmh = null;
    this.policeOrders = orders;

    // The units: send the backup, then tell every unit what to do.
    for (const kind of orders.spawn) {
      const a = this.police.active
        ? this.traffic.spawnUnit(s, kind, 150, 420, 900)
        : this.traffic.spawnUnit(s, kind, 120, 380);
      if (a && this.police.active) this.police.pursuit?.involve();
    }
    if (orders.release) {
      this.traffic.command(false, { keep: this.traffic.patrolTarget, unpark: true });
      this.blockUnits = [];
    }
    this.traffic.search = orders.search;
    if (this.police.active) this.traffic.command(orders.chase === 'search' ? 'search' : 'chase');
    this.traffic.heat = this.police.active ? this.police.level : 0;

    // The roadblock: park its units, lay the strip; send them after the player when it comes down.
    if (orders.roadblock) {
      const b = orders.roadblock;
      const kind = this.police.level >= 5 ? 'police-heavy' : 'police';
      this.blockUnits = b.units.map((u) => this.traffic.spawnParked(kind, u, b.lane, b.s));
      for (const a of this.blockUnits) this.police.pursuit?.involve();
    }
    if (orders.clearRoadblock) {
      for (const a of this.blockUnits) if (a.mode === 'parked') {
        a.mode = 'drive';
        a.free = true;
        a.pursuit = this.police.active ? 'chase' : false;
        if (!this.police.active) a.leave = true;
      }
      this.blockUnits = [];
    }
    this.pursuitView3d.setStrip(this.police.spikes);

    // One helicopter goes up at heat 3, two at 4, three at 5; they go home when the pursuit ends.
    this.setHelis(orders.helis);

    // The tires, the money and the end of the pursuit.
    s.tireGrip = orders.tires.grip;
    s.tireTop = orders.tires.top;
    for (const e of orders.events) this.policeEvent(e);
    // The units that have seen the player and the detection bar, for the marks and the HUD.
    this.detect = orders.detect;
    this.trafficView.watchers = new Set(this.police.active ? [] : orders.detect.watchers);
    this.trafficView.detect = orders.detect.level;
    if (orders.money) {
      this.money = Math.max(0, this.money + orders.money);
      store.set('money', this.money);
    }
    if (orders.report) this.endPursuit(orders.report);
    // The end card shows the fine or the bounty; what happened to the car waits until it is gone.
    if (this.afterReport && !orders.view) {
      this.toast(this.afterReport, 3);
      this.afterReport = '';
    }
  }

  /** The nearest helicopter's rotor as the player hears it, from its distance and how fast that closes. @param {number} dt @param {any} s */
  rotorSound(dt, s) {
    let h = null;
    let best = Infinity;
    for (const c of this.helis) {
      if (c.state === 'parked') continue;
      const dc = Math.hypot(c.x - s.x, c.y - s.y, c.z - s.z);
      if (dc < best) {
        best = dc;
        h = c;
      }
    }
    if (!h) {
      this.heliDist = Infinity;
      return { rate: 0, gain: 0 };
    }
    const d = Math.hypot(h.x - s.x, h.y - s.y, h.z - s.z);
    const closing = Number.isFinite(this.heliDist) && dt > 0 ? (this.heliDist - d) / dt : 0;
    this.heliDist = d;
    return rotorSound(d, closing);
  }

  /** The banner for what the police just did, and the hit of a unit taken out. @param {{ type: string, [k: string]: any }} e */
  policeEvent(e) {
    const yen = (n) => `¥${Math.round(n || 0).toLocaleString('en-US')}`;
    /** @type {Record<string, [string, { sub?: string, tone?: import('./ui/menus.js').BannerTone, seconds?: number }]>} */
    const banners = {
      start: ['PURSUIT', { sub: `HEAT LEVEL ${e.heat ?? 1}`, tone: 'police' }],
      heat: [`HEAT LEVEL ${e.level}`, { sub: 'MORE UNITS RESPONDING', tone: 'police' }],
      reinforcements: ['REINFORCEMENTS', { sub: `+${e.count} UNITS ASSIGNED`, tone: 'police' }],
      cooldown: ['COOLDOWN', { sub: 'FIND A PLACE TO HIDE', tone: 'cool' }],
      roadblock: ['ROADBLOCK AHEAD', { sub: e.spikes ? 'SPIKE STRIP' : '', tone: 'bad' }],
      roadblockDodged: ['ROADBLOCK DODGED', { tone: 'good' }],
      spiked: ['TIRES SPIKED', { sub: 'GET TO A PUMP', tone: 'bad' }],
      destroyed: ['COP TAKEN OUT', { sub: `+${yen(e.bounty)}   ${String(e.name || '').toUpperCase()}`, tone: 'police', seconds: 2.4 }],
      escaped: ['ESCAPED', { sub: `BOUNTY ${yen(e.bounty)}`, tone: 'good', seconds: 3 }],
      busted: ['BUSTED', { sub: `FINE ${yen(e.fine)}`, tone: 'bad', seconds: 3 }],
    };
    const b = banners[e.type];
    if (b) this.banner(b[0], b[1]);
    if (e.type === 'destroyed') {
      // Most Wanted's takedown: a white flash, a jolt and a crunch.
      this.flash();
      this.rig.bump(12);
      audio.takedown();
    }
  }

  /**
   * The pursuit ended. Busted: the fine is already taken, the car is towed to the police HQ, the
   * tires and engine fixed. Escaped: the bounty is already paid. The HUD's end card says which;
   * the rap sheet grows either way.
   * @param {any} r the pursuit report
   */
  endPursuit(r) {
    const sheet = store.get('rapSheet', { pursuits: 0, escapes: 0, busts: 0, bounty: 0, longest: 0, disabled: 0, destroyed: 0 });
    sheet.pursuits++;
    if (r.result === 'escaped') {
      sheet.escapes++;
      sheet.bounty += r.bounty;
    } else sheet.busts++;
    sheet.longest = Math.max(sheet.longest, Math.round(r.time));
    sheet.disabled = Math.max(sheet.disabled, r.disabled);
    sheet.destroyed = (sheet.destroyed || 0) + r.disabled;
    store.set('rapSheet', sheet);
    if (r.result === 'busted') {
      const s = this.car.state;
      const hq = this.world.ground.lots.find((p) => p.lot.kind === 'police');
      repairEngine(s);
      this.police.mendTires();
      s.vx = s.vz = 0;
      if (hq) this.placeOnRoadNear(hq.cx, hq.cz, s.yaw);
      this.afterReport = `TOWED TO ${hq ? hq.lot.name : 'THE POLICE'}`;
    }
  }

  /** Puts the car on the nearest road to (x, z). @param {number} x @param {number} z @param {number} yaw */
  placeOnRoadNear(x, z, yaw) {
    const h = this.hit;
    if (!this.world.ground.roads.influence(x, z, 600, h)) return;
    const p = h.road.path.sample(h.s);
    let heading = Math.atan2(p.tx, p.tz);
    if (Math.abs(wrapAngle(heading - yaw)) > Math.PI / 2) heading += Math.PI;
    this.car.place(p.x, p.z, heading, this.ground);
    this.rig.snap();
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
    const roads = this.world.ground.roads;
    // On a deck (a viaduct, the Kurogane Line) the car goes back on the deck, not the road below it.
    const deck = roads.query(s.x, s.z, h, DECK_RESET, -Infinity, s.y + 1) && (h.lift || 0) > 2;
    if (!deck && !roads.influence(s.x, s.z, 600, h)) return;
    const p = h.road.path.sample(h.s);
    let yaw = Math.atan2(p.tx, p.tz);
    if (Math.abs(wrapAngle(yaw - s.yaw)) > Math.PI / 2) yaw += Math.PI;
    this.car.place(p.x, p.z, yaw, this.ground, deck ? h.road.heightAt(h.s) + 0.5 : -Infinity);
    this.rig.snap();
  }

  /** Starts a duel with a rival traffic agent. @param {import('./traffic/sim.js').Agent} agent */
  startDuel(agent) {
    this.duel = new Duel({ id: agent.kind.id, name: agent.kind.name, speedFactor: agent.kind.speed[1] });
    this.duelAgent = agent;
    this.duelEndTimer = 0;
    this.duelEnd = '';
    agent.duel = true;
    this.banner('DUEL', { sub: agent.kind.name, tone: 'amber' });
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
    if (agent.mode === 'wreck') {
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
    this.police.mendTires();
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
    if (pump && this.police.flatTime > 0) {
      this.police.mendTires();
      this.toast('TIRES CHANGED', 2);
    }
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
    } else if (pump && s.n2o < 0.99) {
      const cost = refillCost(s);
      drive = { ...drive, nitrous: false };
      if (this.money < cost) {
        prompt = `NITROUS ¥${cost.toLocaleString('en-US')}   NOT ENOUGH MONEY`;
        this.repairTimer = 0;
      } else if (input.held('interact')) {
        this.repairTimer += dt;
        prompt = `FILLING NITROUS  ${Math.min(100, Math.round((this.repairTimer / N2O_FILL_TIME) * 100))} %`;
        if (this.repairTimer >= N2O_FILL_TIME) {
          this.money -= cost;
          store.set('money', this.money);
          s.n2o = 1;
          this.repairTimer = 0;
          this.toast(`NITROUS FILLED  ¥${cost.toLocaleString('en-US')}`, 2.5);
        }
      } else {
        this.repairTimer = 0;
        prompt = `TANK FULL   HOLD ${INTERACT_KEY} TO FILL NITROUS  ¥${cost.toLocaleString('en-US')}`;
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
      this.banner('ENGINE BLOWN', { sub: 'MONEY SHIFT', tone: 'bad', seconds: 3 });
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
    this.damageFx.update(dt, this.traffic.agents, this.car.state);
    for (let i = 0; i < this.helis.length; i++) {
      this.heliWorld.target = i < this.helisUp ? s : null;
      this.helis[i].update(dt, this.heliWorld);
      this.heliViews[i].update(this.helis[i]);
    }
    const gate = this.tolls.step({ x: x0, z: z0 }, s, s.speed * 3.6, this.time);
    if (gate) {
      const paid = Math.min(this.money, gate.fee);
      this.money -= paid;
      store.set('money', this.money);
      store.set('tollBest', this.tolls.best);
      const kmh = Math.round(gate.speed);
      // The speed trap: one event for the police this frame, not a lasting state.
      this.tollKmh = gate.speed;
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
    const sounds = this.traffic.takeSounds();
    audio.update({
      dt, state: s, spec, boost: this.gauges.boost, view: this.rig.view, env: around, pad: s.surfFront === 'concrete',
      mountain: this.onPass, rival: this.rivalDistance, rally: !!this.rally, traffic: this.traffic.agents,
      sirens: sirenVoices(this.traffic.units(), s, this.time), rotor: this.rotorSound(dt, s), pursuit: this.police.active,
      horns: sounds.horns, screeches: sounds.screeches,
    });
    this.minimap.draw(car.lerped.x, car.lerped.z, car.lerped.yaw, s.speed, dt, { level: this.police.level, pursuit: this.police.active });
    return null;
  }

  render() {
    this.stage.camera.updateMatrixWorld();
    this.world.update(this.stage.camera, this.car.group.position);
    this.stage.render(this.world.scene, this.stage.camera);
  }
}
