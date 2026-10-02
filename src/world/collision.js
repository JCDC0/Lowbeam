/**
 * Static collisions. The car is three circles along its length; trees, poles and pumps
 * are circles; buildings, kiosks and pump islands are oriented boxes. Shapes live in a
 * grid, and contacts are resolved with an impulse at the contact point so a glancing hit
 * turns the car. Pure, no three.js.
 */

import { WORLD_HALF } from './layout.js';

/** @typedef {import('./scatter.js').Circle} Circle */
/** @typedef {import('./scatter.js').Box} Box */
/** @typedef {import('../vehicles/specs.js').CarSpec} CarSpec */

const CELL = 16;
const OFF = 1100;
const W = Math.ceil((OFF * 2) / CELL);
const RESTITUTION = 0.22;
const FRICTION = 0.35;
const EDGE = WORLD_HALF - 12;
/** Shapes are filed with this extra reach so a car circle centered in a neighbor cell still finds them. */
const MARGIN = 1.2;

/** @typedef {{ nx: number, nz: number, depth: number, px: number, pz: number }} Contact */

export class Colliders {
  /** @param {Circle[]} circles @param {Box[]} boxes */
  constructor(circles, boxes) {
    this.circles = circles;
    this.boxes = boxes;
    /** @type {Map<number, { c: number[], b: number[] }>} */
    this.cells = new Map();
    circles.forEach((c, i) => this.insert(c.x, c.z, c.r, (cell) => cell.c.push(i)));
    boxes.forEach((b, i) => this.insert(b.x, b.z, Math.hypot(b.hx, b.hz), (cell) => cell.b.push(i)));
    /** @type {Contact} */
    this._c = { nx: 0, nz: 0, depth: 0, px: 0, pz: 0 };
  }

  insert(x, z, r, add) {
    r += MARGIN;
    const x0 = Math.floor((x - r + OFF) / CELL);
    const x1 = Math.floor((x + r + OFF) / CELL);
    const z0 = Math.floor((z - r + OFF) / CELL);
    const z1 = Math.floor((z + r + OFF) / CELL);
    for (let cz = z0; cz <= z1; cz++) {
      for (let cx = x0; cx <= x1; cx++) {
        if (cx < 0 || cz < 0 || cx >= W || cz >= W) continue;
        const k = cz * W + cx;
        let cell = this.cells.get(k);
        if (!cell) this.cells.set(k, (cell = { c: [], b: [] }));
        add(cell);
      }
    }
  }

  /**
   * Deepest contact of a circle against the static shapes, or null.
   * @param {number} x @param {number} z @param {number} r
   * @returns {Contact | null}
   */
  probe(x, z, r) {
    const out = this._c;
    out.depth = 0;
    const cell = this.cells.get(Math.floor((z + OFF) / CELL) * W + Math.floor((x + OFF) / CELL));
    if (cell) {
      for (const i of cell.c) {
        const c = this.circles[i];
        const dx = x - c.x;
        const dz = z - c.z;
        const d = Math.hypot(dx, dz);
        const depth = r + c.r - d;
        if (depth > out.depth && d > 1e-6) {
          out.depth = depth;
          out.nx = dx / d;
          out.nz = dz / d;
          out.px = c.x + out.nx * c.r;
          out.pz = c.z + out.nz * c.r;
        }
      }
      for (const i of cell.b) this.probeBox(this.boxes[i], x, z, r, out);
    }
    for (const [axis, sign] of [[0, 1], [0, -1], [1, 1], [1, -1]]) {
      const v = axis === 0 ? x : z;
      const depth = sign * v + r - EDGE;
      if (depth > out.depth) {
        out.depth = depth;
        out.nx = axis === 0 ? -sign : 0;
        out.nz = axis === 1 ? -sign : 0;
        out.px = axis === 0 ? sign * EDGE : x;
        out.pz = axis === 1 ? sign * EDGE : z;
      }
    }
    return out.depth > 0 ? out : null;
  }

  /** @param {Box} b @param {Contact} out */
  probeBox(b, x, z, r, out) {
    const c = Math.cos(b.yaw);
    const s = Math.sin(b.yaw);
    const dx = x - b.x;
    const dz = z - b.z;
    // Local X is (cos yaw, -sin yaw), local Z is (sin yaw, cos yaw).
    const lx = dx * c - dz * s;
    const lz = dx * s + dz * c;
    const qx = Math.max(-b.hx, Math.min(b.hx, lx));
    const qz = Math.max(-b.hz, Math.min(b.hz, lz));
    let nlx, nlz, depth, plx, plz;
    if (qx === lx && qz === lz) {
      const ex = b.hx - Math.abs(lx);
      const ez = b.hz - Math.abs(lz);
      if (ex < ez) {
        nlx = Math.sign(lx) || 1;
        nlz = 0;
        depth = ex + r;
        plx = nlx * b.hx;
        plz = lz;
      } else {
        nlx = 0;
        nlz = Math.sign(lz) || 1;
        depth = ez + r;
        plx = lx;
        plz = nlz * b.hz;
      }
    } else {
      const ex = lx - qx;
      const ez = lz - qz;
      const d = Math.hypot(ex, ez);
      depth = r - d;
      if (depth <= 0) return;
      nlx = ex / d;
      nlz = ez / d;
      plx = qx;
      plz = qz;
    }
    if (depth <= out.depth) return;
    out.depth = depth;
    out.nx = nlx * c + nlz * s;
    out.nz = -nlx * s + nlz * c;
    out.px = b.x + plx * c + plz * s;
    out.pz = b.z - plx * s + plz * c;
  }

  /**
   * Pushes the car out of anything it overlaps and applies a contact impulse.
   * Returns the closing speed of the hardest contact (0 when nothing was hit).
   * @param {ReturnType<typeof import('../vehicles/physics.js').createVehicleState>} s
   * @param {CarSpec} spec
   */
  resolve(s, spec) {
    const r = spec.width / 2;
    const fx = Math.sin(s.yaw);
    const fz = Math.cos(s.yaw);
    const mid = spec.cgToFront - spec.wheelbase / 2;
    const reach = spec.length / 2 - r;
    let hardest = 0;
    for (const k of [1, 0, -1]) {
      const off = mid + k * reach;
      const cx = s.x + fx * off;
      const cz = s.z + fz * off;
      const hit = this.probe(cx, cz, r);
      if (!hit) continue;
      s.x += hit.nx * hit.depth;
      s.z += hit.nz * hit.depth;
      hardest = Math.max(hardest, impulse(s, spec, hit));
    }
    return hardest;
  }
}

/**
 * Impulse at the contact point with restitution and friction.
 * @param {ReturnType<typeof import('../vehicles/physics.js').createVehicleState>} s
 * @param {CarSpec} spec @param {Contact} hit
 */
function impulse(s, spec, hit) {
  const m = spec.mass;
  const I = spec.yawInertia;
  const rx = hit.px - s.x;
  const rz = hit.pz - s.z;
  // Velocity of the contact point: v + w x r, with w about +Y (positive yaw turns left).
  const vx = s.vx + s.yawRate * rz;
  const vz = s.vz - s.yawRate * rx;
  const vn = vx * hit.nx + vz * hit.nz;
  if (vn >= 0) return 0;
  const rn = rz * hit.nx - rx * hit.nz;
  const jn = (-(1 + RESTITUTION) * vn) / (1 / m + (rn * rn) / I);
  s.vx += (jn * hit.nx) / m;
  s.vz += (jn * hit.nz) / m;
  s.yawRate += (rn * jn) / I;
  const tx = -hit.nz;
  const tz = hit.nx;
  const vt = vx * tx + vz * tz;
  const rt = rz * tx - rx * tz;
  let jt = -vt / (1 / m + (rt * rt) / I);
  jt = Math.max(-FRICTION * jn, Math.min(FRICTION * jn, jt));
  s.vx += (jt * tx) / m;
  s.vz += (jt * tz) / m;
  s.yawRate += (rt * jt) / I;
  return -vn;
}
