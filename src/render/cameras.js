/**
 * Driving cameras. Chase follows on a damped heading with a speed-sensitive field of
 * view; hood, bumper and cockpit ride on the car. The cockpit camera sits at the
 * driver's eye inside the leaning body, so it rolls and pitches with the car.
 */

import * as THREE from 'three';
import { damp, wrapAngle, clamp } from '../core/mathx.js';

export const VIEWS = /** @type {const} */ (['chase', 'hood', 'bumper', 'cockpit']);
export const VIEW_NAMES = { chase: 'CHASE CAM', hood: 'HOOD CAM', bumper: 'BUMPER CAM', cockpit: 'COCKPIT' };

const _eye = new THREE.Vector3();
const _look = new THREE.Vector3();

export class CameraRig {
  /** @param {THREE.PerspectiveCamera} camera */
  constructor(camera, mode = 0) {
    this.camera = camera;
    this.mode = mode;
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
   * @param {(x: number, z: number) => { h: number }} ground
   * @param {number} dt
   */
  update(car, ground, dt) {
    const cam = this.camera;
    const s = car.state;
    const p = car.lerped;
    const view = this.view;
    car.showCockpit(view === 'cockpit');
    let fov = 62;
    if (view === 'chase') {
      const speed = s.speed;
      // Follow the direction of travel a little when sliding, so a drift shows the car's angle.
      const travel = speed > 3 ? Math.atan2(s.vx, s.vz) : p.yaw;
      const want = p.yaw + wrapAngle(travel - p.yaw) * 0.35 * clamp((speed - 3) / 10, 0, 1);
      this.yaw = this.fresh ? want : this.yaw + wrapAngle(want - this.yaw) * (1 - Math.exp(-5 * dt));
      const dist = 6.2 + Math.min(1.6, speed * 0.025);
      const height = 2.0 + Math.min(0.4, speed * 0.006);
      _eye.set(p.x - Math.sin(this.yaw) * dist, p.y + height, p.z - Math.cos(this.yaw) * dist);
      const g = ground(_eye.x, _eye.z).h + 0.7;
      if (_eye.y < g) _eye.y = g;
      if (this.fresh) this.pos.copy(_eye);
      else {
        this.pos.x = damp(this.pos.x, _eye.x, 12, dt);
        this.pos.z = damp(this.pos.z, _eye.z, 12, dt);
        this.pos.y = damp(this.pos.y, _eye.y, 7, dt);
      }
      cam.position.copy(this.pos);
      _look.set(p.x + Math.sin(this.yaw) * 2.5, p.y + 1.05, p.z + Math.cos(this.yaw) * 2.5);
      cam.up.set(0, 1, 0);
      cam.lookAt(_look);
      fov = 62 + Math.min(16, speed * 0.24);
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
