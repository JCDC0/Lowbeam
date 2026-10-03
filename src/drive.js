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
    if (!this.cluster) this.cluster = new Cluster(this.hud.clusterSlot, spec);
    else this.cluster.setSpec(spec);
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
      if (!s.engineOn || s.blown) this.tow();
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
    this.trafficView.update(this.traffic.agents, this.car.state);
    const gate = this.tolls.step({ x: x0, z: z0 }, s, s.speed * 3.6, this.time);
    if (gate) {
      const paid = Math.min(this.money, gate.fee);
      this.money -= paid;
      store.set('money', this.money);
      store.set('tollBest', this.tolls.best);
      const kmh = Math.round(gate.speed);
      this.toast(`${gate.name}   ${kmh} KM/H   ¥${paid.toLocaleString('en-US')}${gate.record ? '   NEW BEST' : `   BEST ${Math.round(gate.best)}`}`, 3.2);
      audio.ui('select');
    }

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
    audio.pump(refueling);
    const around = this.env.at(s.x, s.z);
    audio.update({ dt, state: s, spec, boost: this.gauges.boost, view: this.rig.view, env: around, pad: s.surfFront === 'concrete', mountain: this.onPass, rival: this.rivalDistance });
    this.minimap.draw(car.lerped.x, car.lerped.z, car.lerped.yaw, s.speed, dt);
    return null;
  }

  render() {
    this.stage.camera.updateMatrixWorld();
    this.world.update(this.stage.camera, this.car.group.position);
    this.stage.render(this.world.scene, this.stage.camera);
  }
}
