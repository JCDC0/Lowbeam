/**
 * The glow round a street lamp's head: an additive flare on every lamp within `RANGE` of the camera
 * (the same `psxFlare` the traffic's lamps use, one draw call), so a lamp reads from far down a
 * street as a point of light instead of only as the pool on the road. It is off by day with the
 * lamps (`look.lamp`) and swells in rain and fog, where a lamp wears a halo.
 */

import * as THREE from 'three';
import { psxFlare } from '../render/psx.js';
import { flareTexture } from '../render/textures.js';

/** How far from the camera a lamp glows, meters. */
const RANGE = 190;
/** Flares at most (a lamp has two heads). */
const MAX = 720;
/** A sodium lamp's color, and its flare's size at a meter (before the distance growth) and in the wet. */
const COLOR = new THREE.Color(1.0, 0.68, 0.32);
const SIZE = 1.5;
const HALO = 1.1;
/** How far under the head's top the lens is, meters. */
const LENS = 0.2;

const _m = new THREE.Matrix4();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _c = new THREE.Color();

export class LampGlow {
  /** @param {{ hx: number, hy: number, hz: number, back: { hx: number, hy: number, hz: number } }[]} lamps */
  constructor(lamps) {
    this.heads = new Float32Array(lamps.length * 6);
    lamps.forEach((l, i) => this.heads.set([l.hx, l.hy - LENS, l.hz, l.back.hx, l.back.hy - LENS, l.back.hz], i * 6));
    this.count = lamps.length * 2;
    const quad = new THREE.PlaneGeometry(1, 1);
    this.dir = new THREE.InstancedBufferAttribute(new Float32Array(MAX * 3), 3);
    quad.setAttribute('aDir', this.dir);
    this.mesh = new THREE.InstancedMesh(quad, psxFlare(flareTexture(), RANGE), MAX);
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX * 3), 3);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 2;
    this.mesh.count = 0;
    this.mesh.name = 'lamp-glow';
    /** @type {number[]} */
    this.near = [];
  }

  /**
   * Lights the lamps round the camera.
   * @param {{ x: number, y: number, z: number }} eye @param {number} lamp 1 at night to 0 by day @param {number} wet 0 to 1
   */
  update(eye, lamp, wet) {
    const mesh = this.mesh;
    mesh.visible = lamp > 0.02;
    if (!mesh.visible) return;
    const H = this.heads;
    const near = this.near;
    near.length = 0;
    const r2 = RANGE * RANGE;
    for (let i = 0; i < this.count; i++) {
      const dx = H[i * 3] - eye.x;
      const dz = H[i * 3 + 2] - eye.z;
      if (dx * dx + dz * dz < r2) near.push(i);
    }
    if (near.length > MAX) {
      near.sort((a, b) => ((H[a * 3] - eye.x) ** 2 + (H[a * 3 + 2] - eye.z) ** 2) - ((H[b * 3] - eye.x) ** 2 + (H[b * 3 + 2] - eye.z) ** 2));
      near.length = MAX;
    }
    const size = SIZE * (1 + wet * HALO);
    _c.copy(COLOR).multiplyScalar(lamp * (1 + wet * 0.4));
    _q.identity();
    _s.set(size, size, size);
    for (let k = 0; k < near.length; k++) {
      const i = near[k];
      _p.set(H[i * 3], H[i * 3 + 1], H[i * 3 + 2]);
      _m.compose(_p, _q, _s);
      mesh.setMatrixAt(k, _m);
      mesh.setColorAt(k, _c);
      const tx = eye.x - _p.x;
      const ty = eye.y - _p.y;
      const tz = eye.z - _p.z;
      const n = Math.hypot(tx, ty, tz) || 1;
      this.dir.setXYZ(k, tx / n, ty / n, tz / n);
    }
    mesh.count = near.length;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    this.dir.needsUpdate = true;
  }
}
