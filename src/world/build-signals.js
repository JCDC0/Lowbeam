/**
 * Meshes for the traffic signals (`signals.js`): the poles, arms, heads and visors baked and merged
 * in 700 m chunks, culled with the ground; every lamp of every head in one mesh whose colors follow
 * the phases (a lamp is rewritten only when its signal changes); and a glow over each lit lamp
 * near the camera, so a red light reads from down the street.
 */

import * as THREE from 'three';
import { MeshBuilder } from '../render/builder.js';
import { psxBasic, psxFlare, psxLambert } from '../render/psx.js';
import { bakeGeometry } from '../render/bake.js';
import { canvasTexture, flareTexture, makeCanvas } from '../render/textures.js';
import { SIGNAL, litLamp } from './signals.js';

const CHUNK = 700;
/** The lamps from the driver's left: blue-green, amber, red; lit and dark. */
const LIT = [[0.15, 1.0, 0.78], [1.0, 0.68, 0.06], [1.0, 0.1, 0.05]];
const DARK = LIT.map((c) => c.map((v) => v * 0.13 + 0.03));
/** Each lamp's center across the head (+x is the driver's left) and its size. */
const LAMP_X = [0.4, 0, -0.4];
const LAMP = 0.3;
const FLARE_RANGE = 260;
const FLARE_SIZE = 1.1;
const MAX_FLARES = 240;
/** Cell size of the index that finds the signals near the camera. */
const NEAR_CELL = 120;

export class SignalView {
  /**
   * @param {import('./signals.js').Signal[]} signals
   * @param {import('../render/bake.js').LightGrid} grid
   */
  constructor(signals, grid) {
    this.signals = signals;
    this.group = new THREE.Group();
    this.group.name = 'signals';
    /** @type {{ mesh: THREE.Mesh, x: number, z: number }[]} */
    this.chunks = [];
    this.buildStatic(grid);
    this.buildLamps();
    this.buildFlares();
    this.setLamps(0);
  }

  /** @param {import('../render/bake.js').LightGrid} grid */
  buildStatic(grid) {
    /** @type {Map<string, { b: MeshBuilder, x: number, z: number, n: number }>} */
    const cells = new Map();
    const H = SIGNAL.head;
    for (const s of this.signals) {
      const key = `${Math.floor(s.x / CHUNK)},${Math.floor(s.z / CHUNK)}`;
      let e = cells.get(key);
      if (!e) cells.set(key, (e = { b: new MeshBuilder(), x: 0, z: 0, n: 0 }));
      e.x += s.x;
      e.z += s.z;
      e.n++;
      const b = e.b;
      b.push(s.x, s.y, s.z, s.yaw);
      // In the head's frame the pole stands straight out to the driver's left at the arm's end.
      const L = s.arm - H / 2;
      const foot = s.py - s.y;
      b.box('pole', L, (foot + 0.55) / 2, 0, SIGNAL.pole * 2, 0.55 - foot, SIGNAL.pole * 2);
      b.box('pole', (L - H / 2 - 0.1) / 2, 0.42, 0, L + H / 2 + 0.1, 0.1, 0.1, { bottom: true });
      for (const u of [-H / 3, H / 3]) b.box('pole', u, 0.32, 0, 0.05, 0.2, 0.05);
      b.box('housing', 0, 0, 0, H, 0.42, 0.3, { bottom: true });
      for (const u of LAMP_X) b.box('housing', u, 0.19, -0.26, 0.34, 0.03, 0.22, { bottom: true });
      b.pop();
    }
    const mats = {
      pole: psxLambert({ color: 0x9aa0a6, baked: true }),
      housing: psxLambert({ color: 0x34383c, baked: true }),
    };
    for (const e of cells.values()) {
      const geo = e.b.geometry(['pole', 'housing']);
      const mesh = new THREE.Mesh(bakeGeometry(geo.geometry, grid, { wrap: 0.6 }), geo.keys.map((k) => mats[k]));
      mesh.name = 'signal-chunk';
      this.group.add(mesh);
      this.chunks.push({ mesh, x: e.x / e.n, z: e.z / e.n });
    }
  }

  buildLamps() {
    const n = this.signals.length * 3;
    const pos = new Float32Array(n * 12);
    const uv = new Float32Array(n * 8);
    this.colors = new Float32Array(n * 12);
    const index = new Uint32Array(n * 6);
    const r = LAMP / 2;
    const corners = [[r, -r, 0, 0], [-r, -r, 1, 0], [-r, r, 1, 1], [r, r, 0, 1]];
    this.signals.forEach((s, i) => {
      const lx = Math.cos(s.yaw);
      const lz = -Math.sin(s.yaw);
      const fx = Math.sin(s.yaw);
      const fz = Math.cos(s.yaw);
      for (let k = 0; k < 3; k++) {
        const q = i * 3 + k;
        corners.forEach(([cu, cv, tu, tv], c) => {
          const u = LAMP_X[k] + cu;
          const v = q * 4 + c;
          pos[v * 3] = s.x + lx * u - fx * 0.16;
          pos[v * 3 + 1] = s.y + cv;
          pos[v * 3 + 2] = s.z + lz * u - fz * 0.16;
          uv[v * 2] = tu;
          uv[v * 2 + 1] = tv;
        });
        index.set([q * 4, q * 4 + 1, q * 4 + 2, q * 4, q * 4 + 2, q * 4 + 3], q * 6);
      }
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    this.colorAttr = new THREE.BufferAttribute(this.colors, 3);
    this.colorAttr.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('color', this.colorAttr);
    geo.setIndex(new THREE.BufferAttribute(index, 1));
    geo.computeBoundingSphere();
    this.lit = new Int8Array(this.signals.length).fill(-1);
    this.lamps = new THREE.Mesh(geo, psxBasic({ map: discTexture(), vertexColors: true, alphaTest: 0.5, side: THREE.DoubleSide }));
    this.lamps.name = 'signal-lamps';
    this.group.add(this.lamps);
  }

  buildFlares() {
    /** @type {Map<string, number[]>} */
    this.cells = new Map();
    this.signals.forEach((s, i) => {
      const key = `${Math.floor(s.x / NEAR_CELL)},${Math.floor(s.z / NEAR_CELL)}`;
      const list = this.cells.get(key);
      if (list) list.push(i);
      else this.cells.set(key, [i]);
    });
    const quad = new THREE.PlaneGeometry(1, 1);
    this.flareDir = new THREE.InstancedBufferAttribute(new Float32Array(MAX_FLARES * 3), 3);
    quad.setAttribute('aDir', this.flareDir);
    this.flares = new THREE.InstancedMesh(quad, psxFlare(flareTexture(), FLARE_RANGE), MAX_FLARES);
    this.flares.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX_FLARES * 3), 3);
    this.flares.frustumCulled = false;
    this.flares.renderOrder = 2;
    this.flares.count = 0;
    this.flares.name = 'signal-glow';
    this.group.add(this.flares);
  }

  /**
   * Sets every signal's lamps for the traffic's clock and puts the glows on the lit lamps near the
   * camera.
   * @param {number} t the traffic simulation's time, seconds
   * @param {{ x: number, z: number }} eye
   */
  update(t, eye) {
    this.setLamps(t);
    this.placeFlares(eye);
  }

  /** Rewrites the lamps of the signals whose phase changed since the last call. @param {number} t */
  setLamps(t) {
    const attr = this.colorAttr;
    let changed = false;
    attr.clearUpdateRanges();
    for (let i = 0; i < this.signals.length; i++) {
      const on = litLamp(this.signals[i], t);
      if (on === this.lit[i]) continue;
      this.lit[i] = on;
      for (let k = 0; k < 3; k++) {
        const c = k === on ? LIT[k] : DARK[k];
        for (let v = 0; v < 4; v++) this.colors.set(c, ((i * 3 + k) * 4 + v) * 3);
      }
      attr.addUpdateRange(i * 36, 36);
      changed = true;
    }
    if (changed) attr.needsUpdate = true;
  }

  /** The glows over the lit lamps near the camera. @param {{ x: number, z: number }} eye */
  placeFlares(eye) {
    let f = 0;
    const reach = Math.ceil(FLARE_RANGE / NEAR_CELL);
    const cx = Math.floor(eye.x / NEAR_CELL);
    const cz = Math.floor(eye.z / NEAR_CELL);
    for (let dz = -reach; dz <= reach && f < MAX_FLARES; dz++) {
      for (let dx = -reach; dx <= reach && f < MAX_FLARES; dx++) {
        const list = this.cells.get(`${cx + dx},${cz + dz}`);
        if (!list) continue;
        for (const i of list) {
          const s = this.signals[i];
          if (Math.hypot(s.x - eye.x, s.z - eye.z) > FLARE_RANGE) continue;
          const k = this.lit[i];
          const lx = Math.cos(s.yaw);
          const lz = -Math.sin(s.yaw);
          const fx = Math.sin(s.yaw);
          const fz = Math.cos(s.yaw);
          _m.makeScale(FLARE_SIZE, FLARE_SIZE, FLARE_SIZE);
          _m.setPosition(s.x + lx * LAMP_X[k] - fx * 0.3, s.y, s.z + lz * LAMP_X[k] - fz * 0.3);
          this.flares.setMatrixAt(f, _m);
          _c.setRGB(LIT[k][0], LIT[k][1], LIT[k][2]);
          this.flares.setColorAt(f, _c);
          this.flareDir.setXYZ(f, -fx, 0, -fz);
          if (++f >= MAX_FLARES) break;
        }
      }
    }
    this.flares.count = f;
    this.flares.instanceMatrix.needsUpdate = true;
    if (this.flares.instanceColor) this.flares.instanceColor.needsUpdate = true;
    this.flareDir.needsUpdate = true;
  }
}

const _m = new THREE.Matrix4();
const _c = new THREE.Color();

/** A round lamp lens, white on clear, for the lamps' vertex colors to tint. */
function discTexture() {
  const c = makeCanvas(16, 16);
  const g = /** @type {CanvasRenderingContext2D} */ (c.getContext('2d'));
  g.fillStyle = '#ffffff';
  g.beginPath();
  g.arc(8, 8, 7.5, 0, Math.PI * 2);
  g.fill();
  return canvasTexture(c);
}
