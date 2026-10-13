/**
 * The player's car: physics state, model, headlights, the light trails of its tail lamps at speed, and
 * cockpit. Physics steps at a
 * fixed 120 Hz; `pose(alpha)` draws the model between the last two steps so motion is
 * smooth at any frame rate.
 */

import * as THREE from 'three';
import { CarModel } from './models.js';
import { STEER_RATIO, buildCockpit } from './cockpit.js';
import { createVehicleState, placeVehicle, stepVehicle, DT } from './physics.js';
import { ExhaustFx } from './exhaust-fx.js';
import { LightTrails } from '../render/light-trails.js';
import { trailGlow } from '../render/tail-lamps.js';
import { lerp, wrapAngle } from '../core/mathx.js';

/** @typedef {import('./specs.js').CarSpec} CarSpec */
/** @typedef {import('./physics.js').DriveInput} DriveInput */
/** @typedef {import('./physics.js').GroundFn} GroundFn */

export class Car {
  /** @param {CarSpec} spec @param {number} paintIndex */
  constructor(spec, paintIndex) {
    this.spec = spec;
    this.state = createVehicleState(spec);
    this.model = new CarModel(spec, paintIndex);
    this.cockpit = buildCockpit(this.model);
    this.fx = new ExhaustFx(this.model);
    this.prev = { x: 0, y: 0, z: 0, yaw: 0 };
    this.lerped = { x: 0, y: 0, z: 0, yaw: 0 };
    this.headlights = this.makeHeadlights();
    this.trails = new LightTrails(2);
    // In the world-space group the drive adds to the scene, with the exhaust.
    this.fx.group.add(this.trails.mesh);
    this.clock = 0;
  }

  get group() {
    return this.model.group;
  }

  makeHeadlights() {
    const k = this.model.kit;
    const zf = k.zMax - 0.15;
    const y = Math.min(0.68, k.topY(zf) - 0.12);
    const x = this.spec.width / 2 - 0.3;
    const lights = [];
    for (const s of [1, -1]) {
      const l = new THREE.SpotLight(0xfff0d8, 320, 95, 0.42, 0.45, 1.35);
      l.position.set(s * x, y, zf);
      l.target.position.set(s * x * 0.4, 0, zf + 26);
      this.model.group.add(l, l.target);
      lights.push(l);
    }
    return lights;
  }

  /**
   * @param {number} x @param {number} z @param {number} yaw @param {GroundFn} ground
   * @param {number} [y] a deck's height to place the car on; the ground when left out
   */
  place(x, z, yaw, ground, y = -Infinity) {
    placeVehicle(this.state, this.spec, x, z, yaw, ground, y);
    this.state.gear = 1;
    this.state.rpm = this.spec.engine.idle;
    this.save();
  }

  save() {
    const s = this.state;
    this.prev.x = s.x;
    this.prev.y = s.y;
    this.prev.z = s.z;
    this.prev.yaw = s.yaw;
  }

  /**
   * One physics step plus static collisions. Returns the impact speed, if any.
   * @param {DriveInput} input @param {GroundFn} ground
   * @param {import('../world/collision.js').Colliders} colliders
   */
  step(input, ground, colliders) {
    this.save();
    stepVehicle(this.state, this.spec, input, ground, DT);
    return colliders ? colliders.resolve(this.state, this.spec) : 0;
  }

  /**
   * Draws the car `alpha` of the way from the previous step to the current one.
   * @param {number} alpha @param {number} dt
   */
  pose(alpha, dt) {
    const s = this.state;
    const p = this.prev;
    const o = this.lerped;
    o.x = lerp(p.x, s.x, alpha);
    o.y = lerp(p.y, s.y, alpha);
    o.z = lerp(p.z, s.z, alpha);
    o.yaw = p.yaw + wrapAngle(s.yaw - p.yaw) * alpha;
    this.model.pose(s, dt, o);
    this.cockpit.wheel.rotation.z = -s.steer * STEER_RATIO;
    this.fx.update(s, dt);
    this.clock += dt;
    const m = this.model;
    const glow = trailGlow(s.speed, m.lampsOn, m.brake);
    const c = Math.cos(o.yaw);
    const sn = Math.sin(o.yaw);
    m.tailSpots.forEach((q, i) => this.trails.feed(i, o.x + q[0] * c + q[2] * sn, o.y + q[1], o.z - q[0] * sn + q[2] * c, glow, this.clock));
    this.trails.update(this.clock);
  }

  /** @param {boolean} on */
  showCockpit(on) {
    this.cockpit.group.visible = on;
  }

  dispose() {
    this.model.dispose();
    this.cockpit.dispose();
    this.fx.dispose();
    this.trails.dispose();
    for (const l of this.headlights) l.dispose();
  }
}
