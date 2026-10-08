/**
 * Damaged police units, seen: grey smoke from under the hood below half their hit points, thicker
 * and darker below a quarter, and a destroyed unit burns, flames and black smoke, for as long as
 * its wreck stays. Two pooled point clouds (one blended, one added), one draw call each, whatever
 * the number of units. The hit points themselves are the sim's (`police/units.js`).
 *
 * Sliding tires, seen, for every car (the player's included): skid marks on the road behind the
 * rear wheels (`render/skids.js`) and, in a hard slide, a pale smoke trail from them, from a third
 * pool of puffs. How hard a car slides is `render/skid-rules.js`.
 */

import * as THREE from 'three';
import { psxUniforms } from '../render/psx.js';
import { DAMAGE, health, isUnit } from '../police/units.js';
import { SkidMarks } from '../render/skids.js';
import { playerSlide, agentSlide } from '../render/skid-rules.js';

const SMOKE = 240;
const FIRE = 140;
const TIRE_SMOKE = 260;
/** Only cars this close lay marks and smoke, meters. */
const SKID_RANGE = 220;
/** A slide harder than this smokes; the smoke's puffs per second at a full slide. */
const SMOKE_FROM = 0.45;
const SMOKE_RATE = 26;
/** The player's rear wheels: meters behind the center and half the track. */
const PLAYER_REAR = 1.3;
const PLAYER_HALF_TRACK = 0.76;
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
const TIRE_WHITE = [0.62, 0.62, 0.64];
const TIRE_GREY = [0.4, 0.4, 0.42];
const DARK = [0.06, 0.06, 0.07];
const FLAME_HOT = [1.0, 0.78, 0.32];
const FLAME_RED = [0.85, 0.16, 0.04];

export class DamageFx {
  /** @param {THREE.Object3D} parent */
  constructor(parent) {
    this.smoke = new Puffs(SMOKE, false);
    this.fire = new Puffs(FIRE, true);
    this.tireSmoke = new Puffs(TIRE_SMOKE, false);
    this.group = new THREE.Group();
    this.group.name = 'damage-fx';
    this.group.add(this.smoke.points, this.fire.points, this.tireSmoke.points);
    parent.add(this.group);
    this.skids = new SkidMarks(parent);
    /** @type {Map<number, number>} emission owed per unit, so rates hold at any frame rate */
    this.owed = new Map();
    /** Each car's yaw last frame, for its turn rate, and its tire smoke owed. @type {Map<number | string, { yaw: number, owed: number }>} */
    this.tires = new Map();
  }

  /**
   * One car's rear tires this frame: marks while it slides, smoke in a hard slide.
   * @param {number | string} id @param {number} x @param {number} y @param {number} z @param {number} yaw
   * @param {number} back meters from the center to the rear axle @param {number} half half the track
   * @param {number} amount how hard it slides, 0 to 1 @param {number} speed m/s @param {number} dt
   */
  tiresOf(id, x, y, z, yaw, back, half, amount, speed, dt) {
    const fx = Math.sin(yaw);
    const fz = Math.cos(yaw);
    const rx = x - fx * back;
    const rz = z - fz * back;
    const lx = fz * half;
    const lz = -fx * half;
    this.skids.tire(`${id}:l`, rx + lx, y, rz + lz, amount);
    this.skids.tire(`${id}:r`, rx - lx, y, rz - lz, amount);
    const t = this.tires.get(id);
    if (!t || amount < SMOKE_FROM || speed < 5) {
      if (t) t.owed = 0;
      return;
    }
    t.owed += SMOKE_RATE * ((amount - SMOKE_FROM) / (1 - SMOKE_FROM)) * dt;
    while (t.owed >= 1) {
      t.owed -= 1;
      const side = Math.random() < 0.5 ? 1 : -1;
      this.tireSmoke.emit(rx + lx * side, y + 0.3, rz + lz * side, 1.5, 0.5, 2.6, 0.5, 0.18 + 0.22 * amount, TIRE_WHITE, TIRE_GREY, 0.5);
    }
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

    const live = new Set();
    const player = /** @type {any} */ (focus);
    if (dt > 0 && player.yaw !== undefined) {
      live.add('player');
      if (!this.tires.has('player')) this.tires.set('player', { yaw: player.yaw, owed: 0 });
      this.tiresOf('player', player.x, player.y ?? 0, player.z, player.yaw, PLAYER_REAR, PLAYER_HALF_TRACK, playerSlide(player), player.speed ?? 0, dt);
    }
    for (const a of agents) {
      if (Math.abs(a.x - focus.x) > SKID_RANGE || Math.abs(a.z - focus.z) > SKID_RANGE || dt <= 0) continue;
      live.add(a.id);
      let t = this.tires.get(a.id);
      if (!t) this.tires.set(a.id, (t = { yaw: a.yaw, owed: 0 }));
      let turn = Math.atan2(Math.sin(a.yaw - t.yaw), Math.cos(a.yaw - t.yaw)) / dt;
      if (Math.abs(turn) > 20) turn = 0;
      t.yaw = a.yaw;
      this.tiresOf(a.id, a.x, a.y, a.z, a.yaw, a.kind.length * 0.32, a.kind.width * 0.42, agentSlide(a, turn), Math.hypot(a.vx, a.vz), dt);
    }
    for (const id of this.tires.keys()) {
      if (live.has(id)) continue;
      this.tires.delete(id);
      this.skids.tire(`${id}:l`, 0, 0, 0, 0);
      this.skids.tire(`${id}:r`, 0, 0, 0, 0);
    }
    this.smoke.step(dt);
    this.fire.step(dt);
    this.tireSmoke.step(dt);
    this.skids.step(dt);
  }

  dispose() {
    this.group.parent?.remove(this.group);
    this.smoke.dispose();
    this.fire.dispose();
    this.tireSmoke.dispose();
    this.skids.dispose();
  }
}
