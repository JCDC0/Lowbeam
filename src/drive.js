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
import { ECONOMY, LAKE, TOWN, WATER_LEVEL } from './world/layout.js';
import { padPoint } from './world/scatter.js';
import { wrapAngle } from './core/mathx.js';

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
    this.rig = new CameraRig(stage.camera, store.get('camera', 0));
    /** @type {Car | null} */
    this.car = null;
    this.acc = 0;
    this.money = store.get('money', ECONOMY.startMoney);
    this.fueled = 0;
    this.areaTimer = 0;
    this.hit = { road: null, s: 0, d: 0, h: 0, edge: 0 };
  }

  /**
   * A fresh car beside the first pump at G1.
   * @param {import('./vehicles/specs.js').CarSpec} spec @param {number} paint
   */
  start(spec, paint) {
    if (this.car) {
      this.world.root.remove(this.car.group);
      this.car.dispose();
    }
    this.car = new Car(spec, paint);
    this.world.add(this.car.group);
    this.toPump(this.world.scatter.stations[0]);
    this.acc = 0;
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

  /** Tow to the nearest station's pump for a fee. */
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
    this.money = Math.max(0, this.money - ECONOMY.towCost);
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
    const g = this.world.ground.at(x, z);
    if (g.pad) return g.pad.name;
    if (x > TOWN.x0 && x < TOWN.x1 && z > TOWN.z0 && z < TOWN.z1) return 'KIRIGAOKA';
    if (g.road) return g.road.name;
    if (Math.hypot(x - LAKE.x, z - LAKE.z) < LAKE.r + 30) return 'KAGAMI-IKE';
    return y > 40 ? 'KIRIGAOKA RIDGE' : 'KIRIGAOKA VALLEY';
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
      store.set('camera', this.rig.mode);
      this.toast(VIEW_NAMES[v], 1.2);
    }

    let drive = input.drive(dt);
    let prompt = '';
    const pump = s.speed < 0.6 ? this.nearPump() : null;
    if (pump && s.fuel < spec.fuel.tank - 0.05) {
      if (input.held('interact') && this.money >= 1) {
        const liters = Math.min(REFUEL_RATE * dt, spec.fuel.tank - s.fuel, this.money / ECONOMY.fuelPrice);
        s.fuel += liters;
        this.money -= liters * ECONOMY.fuelPrice;
        this.fueled += liters;
        if (s.fuel > 0) s.engineOn = true;
        // Zero input, not the brake: holding the brake at rest selects reverse.
        drive = { throttle: 0, brake: 0, steer: 0, handbrake: 0 };
        prompt = `REFUELING  ${this.fueled.toFixed(1)} L  ¥${Math.round(this.fueled * ECONOMY.fuelPrice).toLocaleString('en-US')}`;
      } else {
        prompt = this.money >= 1 ? `HOLD E TO REFUEL  ¥${ECONOMY.fuelPrice} / L` : 'NO MONEY FOR FUEL';
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
    if (input.pressed('reset')) {
      if (!s.engineOn) this.tow();
      else this.resetToRoad();
    }

    this.acc += dt;
    let steps = 0;
    while (this.acc >= DT && steps < MAX_STEPS) {
      const impact = car.step(drive, this.ground, this.colliders);
      if (impact > 2.5) this.rig.bump(impact);
      this.acc -= DT;
      steps++;
    }
    if (steps === MAX_STEPS) this.acc = 0;

    if (s.surfFront === 'water' && s.y < WATER_LEVEL - 0.5) {
      this.resetToRoad();
      this.toast('PULLED OUT OF THE LAKE', 2.5);
    }

    car.pose(this.acc / DT, dt);
    this.rig.update(car, this.ground, dt);

    this.areaTimer -= dt;
    if (this.areaTimer <= 0) {
      this.areaTimer = 0.3;
      this.hud.area(this.areaName(s.x, s.y, s.z));
    }
    this.hud.money(this.money);
    this.hud.prompt(prompt);
    const gear = s.gear < 0 ? 'R' : String(s.gear);
    this.hud.digital(Math.abs(s.vLong) * 3.6, gear, s.fuel, spec.fuel.tank);
    this.minimap.draw(car.lerped.x, car.lerped.z, car.lerped.yaw, s.speed, dt);
    return null;
  }

  render() {
    this.stage.camera.updateMatrixWorld();
    this.world.update(this.stage.camera, this.car.group.position);
    this.stage.render(this.world.scene, this.stage.camera);
  }
}
