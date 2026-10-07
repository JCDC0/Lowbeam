/**
 * Damaged police units, seen: grey smoke from under the hood below half their hit points, thicker
 * and darker below a quarter, and a destroyed unit burns, flames and black smoke, for as long as
 * its wreck stays. Two pooled point clouds (one blended, one added), one draw call each, whatever
 * the number of units. The hit points themselves are the sim's (`police/units.js`).
 */

import * as THREE from 'three';
import { psxUniforms } from '../render/psx.js';
import { DAMAGE, health, isUnit } from '../police/units.js';

const SMOKE = 240;
const FIRE = 140;
/** Units farther than this from the camera make no smoke or fire, meters. */
const RANGE = 170;

const VERT = /* glsl */ `
uniform vec2 uSnap;
attribute float aSize;
attribute float aAlpha;
attribute vec3 aColor;
varying float vAlpha;
varying vec3 vColor;
void main() {
  vAlpha = aAlpha;
  vColor = aColor;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = min(96.0, aSize * projectionMatrix[1][1] * uSnap.y * 0.5 / max(-mv.z, 0.1));
}
`;

const FRAG = /* glsl */ `
varying float vAlpha;
varying vec3 vColor;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float a = (1.0 - smoothstep(0.3, 1.0, d)) * vAlpha;
  if (a < 0.01) discard;
  gl_FragColor = vec4(vColor, a);
}
`;

/** A pool of puffs that rise, grow and fade. */
class Puffs {
  /** @param {number} n @param {boolean} additive */
  constructor(n, additive) {
    this.n = n;
    this.pos = new Float32Array(n * 3).fill(-1000);
    this.vel = new Float32Array(n * 3);
    this.size = new Float32Array(n);
    this.alpha = new Float32Array(n);
    this.color = new Float32Array(n * 3);
    this.age = new Float32Array(n).fill(99);
    this.life = new Float32Array(n).fill(1);
    this.base = new Float32Array(n);
    this.grow = new Float32Array(n * 2);
    this.tint = new Float32Array(n * 6);
    this.next = 0;
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.geo.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1));
    this.geo.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1));
    this.geo.setAttribute('aColor', new THREE.BufferAttribute(this.color, 3));
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uSnap: psxUniforms.uSnap },
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(this.geo, this.mat);
    this.points.frustumCulled = false;
    this.points.visible = false;
  }

  /**
   * One puff at (x, y, z): it lives `life` s, grows from `s0` to `s1` m, rises at `rise` m/s, fades
   * from `alpha`, and shifts from color `c0` to `c1`.
   */
  emit(x, y, z, life, s0, s1, rise, alpha, c0, c1, spread) {
    const i = this.next;
    this.next = (this.next + 1) % this.n;
    const i3 = i * 3;
    this.pos[i3] = x + (Math.random() - 0.5) * spread;
    this.pos[i3 + 1] = y;
    this.pos[i3 + 2] = z + (Math.random() - 0.5) * spread;
    this.vel[i3] = (Math.random() - 0.5) * 0.6;
    this.vel[i3 + 1] = rise * (0.7 + 0.6 * Math.random());
    this.vel[i3 + 2] = (Math.random() - 0.5) * 0.6;
    this.age[i] = 0;
    this.life[i] = life * (0.8 + 0.4 * Math.random());
    this.base[i] = alpha;
    this.grow[i * 2] = s0;
    this.grow[i * 2 + 1] = s1;
    this.tint.set(c0, i * 6);
    this.tint.set(c1, i * 6 + 3);
  }

  /** @param {number} dt */
  step(dt) {
    let live = false;
    for (let i = 0; i < this.n; i++) {
      if (this.age[i] >= this.life[i]) continue;
      this.age[i] += dt;
      const u = this.age[i] / this.life[i];
      const i3 = i * 3;
      if (u >= 1) {
        this.alpha[i] = 0;
        this.pos[i3 + 1] = -1000;
        continue;
      }
      live = true;
      this.pos[i3] += this.vel[i3] * dt;
      this.pos[i3 + 1] += this.vel[i3 + 1] * dt;
      this.pos[i3 + 2] += this.vel[i3 + 2] * dt;
      this.size[i] = this.grow[i * 2] + (this.grow[i * 2 + 1] - this.grow[i * 2]) * Math.sqrt(u);
      this.alpha[i] = this.base[i] * Math.pow(1 - u, 1.2) * Math.min(1, u * 8);
      for (let k = 0; k < 3; k++) this.color[i3 + k] = this.tint[i * 6 + k] + (this.tint[i * 6 + 3 + k] - this.tint[i * 6 + k]) * u;
    }
    this.points.visible = live;
    if (live) {
      this.geo.attributes.position.needsUpdate = true;
      this.geo.attributes.aSize.needsUpdate = true;
      this.geo.attributes.aAlpha.needsUpdate = true;
      this.geo.attributes.aColor.needsUpdate = true;
    }
  }

  dispose() {
    this.geo.dispose();
    this.mat.dispose();
  }
}

const GREY = [0.32, 0.32, 0.34];
const DARK = [0.06, 0.06, 0.07];
const FLAME_HOT = [1.0, 0.78, 0.32];
const FLAME_RED = [0.85, 0.16, 0.04];

export class DamageFx {
  /** @param {THREE.Object3D} parent */
  constructor(parent) {
    this.smoke = new Puffs(SMOKE, false);
    this.fire = new Puffs(FIRE, true);
    this.group = new THREE.Group();
    this.group.name = 'damage-fx';
    this.group.add(this.smoke.points, this.fire.points);
    parent.add(this.group);
    /** @type {Map<number, number>} emission owed per unit, so rates hold at any frame rate */
    this.owed = new Map();
  }

  /**
   * @param {number} dt
   * @param {import('./sim.js').Agent[]} agents
   * @param {{ x: number, z: number }} focus where the camera is
   */
  update(dt, agents, focus) {
    const seen = new Set();
    for (const a of agents) {
      if (!isUnit(a.kind)) continue;
      const left = health(a);
      if (left > DAMAGE.smoke && !a.destroyed) continue;
      if (Math.abs(a.x - focus.x) > RANGE || Math.abs(a.z - focus.z) > RANGE) continue;
      seen.add(a.id);
      const fx = Math.sin(a.yaw);
      const fz = Math.cos(a.yaw);
      const hood = a.kind.length * 0.3;
      const hx = a.x + fx * hood;
      const hz = a.z + fz * hood;
      const top = a.y + a.kind.height * 0.7;
      const rate = a.destroyed ? 30 : left < DAMAGE.limp ? 12 : 6;
      let owed = (this.owed.get(a.id) || 0) + rate * dt;
      while (owed >= 1) {
        owed -= 1;
        if (a.destroyed) {
          this.fire.emit(a.x + fx * hood * 0.5, a.y + a.kind.height * 0.8, a.z + fz * hood * 0.5, 0.6, 1.9, 0.5, 2.4, 0.95, FLAME_HOT, FLAME_RED, a.kind.width * 0.8);
          if (Math.random() < 0.4) this.smoke.emit(a.x, a.y + a.kind.height + 0.5, a.z, 2.8, 1.2, 4.2, 2.2, 0.8, DARK, DARK, 1.2);
        } else {
          const dark = left < DAMAGE.limp;
          this.smoke.emit(hx, top, hz, 1.6, 0.4, dark ? 2.6 : 1.9, 1.3, dark ? 0.75 : 0.5, dark ? DARK : GREY, GREY, 0.6);
        }
      }
      this.owed.set(a.id, owed);
    }
    for (const id of this.owed.keys()) if (!seen.has(id)) this.owed.delete(id);
    this.smoke.step(dt);
    this.fire.step(dt);
  }

  dispose() {
    this.group.parent?.remove(this.group);
    this.smoke.dispose();
    this.fire.dispose();
  }
}
