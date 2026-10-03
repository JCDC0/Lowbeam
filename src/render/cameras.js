/**
 * Driving cameras. Chase follows on a damped heading with a speed-sensitive field of
 * view, car is the standard near view from behind that keeps the whole car framed; hood,
 * bumper and cockpit ride on the car. The cockpit camera sits at the
 * driver's eye inside the leaning body, so it rolls and pitches with the car.
 */

import * as THREE from 'three';
import { damp, wrapAngle, clamp } from '../core/mathx.js';

export const VIEWS = /** @type {const} */ (['chase', 'car', 'hood', 'bumper', 'cockpit']);
export const VIEW_NAMES = { chase: 'CHASE CAM', car: 'CAR CAM', hood: 'HOOD CAM', bumper: 'BUMPER CAM', cockpit: 'COCKPIT' };

/**
 * The two cameras that follow the car from behind. `lean` is how far the camera swings
 * toward the direction of travel in a slide; `car` keeps the car's tail in frame instead.
 */
const FOLLOW = {
  chase: { dist: 6.2, distSpeed: 0.025, distMax: 1.6, height: 2.0, heightSpeed: 0.006, heightMax: 0.4, lean: 0.35, yawRate: 5, posRate: 12, yRate: 7, ahead: 2.5, lookY: 1.05, fov: 62, fovSpeed: 0.24, fovMax: 16 },
  car: { dist: 4.4, distSpeed: 0.012, distMax: 0.9, height: 1.3, heightSpeed: 0.004, heightMax: 0.25, lean: 0, yawRate: 14, posRate: 22, yRate: 12, ahead: 1.6, lookY: 0.9, fov: 58, fovSpeed: 0.14, fovMax: 10 },
};

const _eye = new THREE.Vector3();
const _look = new THREE.Vector3();

export class CameraRig {
  /** @param {THREE.PerspectiveCamera} camera @param {number | string} [mode] a view index or name */
  constructor(camera, mode = 0) {
    this.camera = camera;
    this.mode = typeof mode === 'string' ? Math.max(0, VIEWS.indexOf(/** @type {any} */ (mode))) : mode;
    this.yaw = 0;
    this.pos = new THREE.Vector3();
    this.fov = 62;
    this.shake = 0;
    this.fresh = true;
  }

  get view() {
    return VIEWS[this.mode];
  }

  cycle() {
    this.mode = (this.mode + 1) % VIEWS.length;
    this.fresh = true;
    return this.view;
  }

  /** Skip smoothing on the next update, after a reset or a tow. */
  snap() {
    this.fresh = true;
  }

  /** @param {number} amount meters per second of impact */
  bump(amount) {
    this.shake = Math.min(0.6, this.shake + amount * 0.03);
  }

  /**
   * @param {import('../vehicles/car.js').Car} car
   * @param {(x: number, z: number, y?: number) => { h: number }} ground
   * @param {number} dt
   */
  update(car, ground, dt) {
    const cam = this.camera;
    const s = car.state;
    const p = car.lerped;
    const view = this.view;
    car.showCockpit(view === 'cockpit');
    let fov = 62;
    if (view === 'chase' || view === 'car') {
      const f = FOLLOW[view];
      const speed = s.speed;
      // Follow the direction of travel a little when sliding, so a drift shows the car's angle.
      const travel = speed > 3 ? Math.atan2(s.vx, s.vz) : p.yaw;
      const want = p.yaw + wrapAngle(travel - p.yaw) * f.lean * clamp((speed - 3) / 10, 0, 1);
      this.yaw = this.fresh ? want : this.yaw + wrapAngle(want - this.yaw) * (1 - Math.exp(-f.yawRate * dt));
      const dist = f.dist + Math.min(f.distMax, speed * f.distSpeed);
      const height = f.height + Math.min(f.heightMax, speed * f.heightSpeed);
      _eye.set(p.x - Math.sin(this.yaw) * dist, p.y + height, p.z - Math.cos(this.yaw) * dist);
      const g = ground(_eye.x, _eye.z, _eye.y).h + 0.7;
      if (_eye.y < g) _eye.y = g;
      if (this.fresh) this.pos.copy(_eye);
      else {
        this.pos.x = damp(this.pos.x, _eye.x, f.posRate, dt);
        this.pos.z = damp(this.pos.z, _eye.z, f.posRate, dt);
        this.pos.y = damp(this.pos.y, _eye.y, f.yRate, dt);
      }
      cam.position.copy(this.pos);
      _look.set(p.x + Math.sin(this.yaw) * f.ahead, p.y + f.lookY, p.z + Math.cos(this.yaw) * f.ahead);
      cam.up.set(0, 1, 0);
      cam.lookAt(_look);
      fov = f.fov + Math.min(f.fovMax, speed * f.fovSpeed);
      cam.near = 0.25;
    } else {
      const k = car.model.kit;
      const def = car.model.def;
      const parent = view === 'cockpit' ? car.model.bodyRoot : car.model.group;
      if (view === 'cockpit') {
        _eye.copy(car.cockpit.eye);
        fov = 70;
        cam.near = 0.08;
      } else if (view === 'hood') {
        const z = def.glass.front[1] + 0.2;
        _eye.set(0, k.topY(z) + 0.26, z);
        fov = 66;
        cam.near = 0.15;
      } else {
        _eye.set(0, 0.5, k.zMax + 0.12);
        fov = 68;
        cam.near = 0.15;
      }
      _look.copy(_eye);
      _look.z += 10;
      _look.y -= view === 'cockpit' ? 0.9 : 0.5;
      parent.updateWorldMatrix(true, false);
      parent.localToWorld(_eye);
      parent.localToWorld(_look);
      cam.position.copy(_eye);
      cam.up.set(0, 1, 0).applyQuaternion(parent.getWorldQuaternion(_q));
      cam.lookAt(_look);
      fov += Math.min(8, s.speed * 0.08);
    }
    if (this.shake > 0.001) {
      cam.position.x += (Math.random() - 0.5) * this.shake * 0.3;
      cam.position.y += (Math.random() - 0.5) * this.shake * 0.3;
      this.shake = damp(this.shake, 0, 6, dt);
    }
    this.fov = this.fresh ? fov : damp(this.fov, fov, 4, dt);
    cam.fov = this.fov;
    cam.updateProjectionMatrix();
    this.fresh = false;
  }
}

const _q = new THREE.Quaternion();
