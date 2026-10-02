/**
 * Road network: splines, height profiles, junction blending and a spatial grid for
 * "which road am I on" queries. Pure, no three.js.
 */

import { Path } from './spline.js';
import { blurredHeight } from './heightfield.js';
import { smoothstep } from '../core/mathx.js';

/** Width of the sloped edge between the road top and the carved terrain beside it. */
export const SKIRT = 1.2;
/** How far the carved terrain sits below the road surface. */
export const SINK = 0.25;

const CELL = 16;
const OFF = 1100;
const W = Math.ceil((OFF * 2) / CELL);
const JUNCTION_BLEND = 35;

/** @typedef {import('./layout.js').RoadDef} RoadDef */
/** @typedef {{ road: Road, s: number, d: number, h: number, edge: number }} RoadHit */

export class Road {
  /** @param {RoadDef} def @param {number} index */
  constructor(def, index) {
    this.def = def;
    this.index = index;
    this.id = def.id;
    this.name = def.name;
    this.surface = def.surface;
    this.hw = def.hw;
    this.priority = def.priority;
    this.path = new Path(def.points, { closed: !!def.closed, step: 2 });
    this.h = new Float32Array(this.path.n);
  }

  /** @param {number} s */
  heightAt(s) {
    const p = this.path;
    s = p.wrapS(s);
    const fi = s / p.step;
    const i = Math.min(Math.floor(fi), p.closed ? p.n - 1 : p.n - 2);
    const f = fi - i;
    return this.h[i] + (this.h[p.wrapIndex(i + 1)] - this.h[i]) * f;
  }

  /** Grade between two arc lengths, as rise over run. */
  grade(s0, s1) {
    return (this.heightAt(s1) - this.heightAt(s0)) / Math.max(1e-3, Math.abs(s1 - s0));
  }
}

export class RoadNetwork {
  /** @param {RoadDef[]} defs */
  constructor(defs) {
    this.roads = defs.map((d, i) => new Road(d, i));
    /** @type {Map<string, Road>} */
    this.byId = new Map(this.roads.map((r) => [r.id, r]));
    /** @type {number[][]} */
    this.cells = Array.from({ length: W * W }, () => []);
    for (const r of this.roads) {
      for (let i = 0; i < r.path.n; i++) {
        const key = this.cellKey(r.path.x[i], r.path.z[i]);
        if (key >= 0) this.cells[key].push(r.index, i);
      }
    }
    this._best = new Float64Array(this.roads.length);
    this._bestI = new Int32Array(this.roads.length);
    this._hit = { s: 0, d: 0, x: 0, z: 0, i: 0 };

    for (const r of this.roads) this.buildProfile(r);
    // Lower priority roads take the height of anything they cross, so junctions are flush.
    const order = [...this.roads].sort((a, b) => b.priority - a.priority);
    for (const r of order) this.blendJunctions(r);
  }

  cellKey(x, z) {
    const cx = Math.floor((x + OFF) / CELL);
    const cz = Math.floor((z + OFF) / CELL);
    if (cx < 0 || cz < 0 || cx >= W || cz >= W) return -1;
    return cz * W + cx;
  }

  /** @param {Road} r */
  buildProfile(r) {
    const p = r.path;
    const n = p.n;
    const raw = new Float32Array(n);
    for (let i = 0; i < n; i++) raw[i] = blurredHeight(p.x[i], p.z[i]);
    const k = Math.max(1, Math.round((r.def.smooth || 20) / p.step));
    for (let i = 0; i < n; i++) {
      // Open roads shrink the window near their ends so the endpoints stay on the terrain.
      const kk = p.closed ? k : Math.min(k, i, n - 1 - i);
      let sum = 0;
      for (let j = -kk; j <= kk; j++) sum += raw[p.wrapIndex(i + j)];
      r.h[i] = sum / (2 * kk + 1);
    }
    // Where the hillside is steeper than a road can be, cut and fill instead of following it.
    // After the backward pass every neighbor pair is within the limit.
    const g = r.def.maxGrade;
    if (g) {
      const dh = g * p.step;
      for (let pass = 0; pass < 2; pass++) {
        for (let i = 1; i < n; i++) r.h[i] = Math.min(Math.max(r.h[i], r.h[i - 1] - dh), r.h[i - 1] + dh);
        for (let i = n - 2; i >= 0; i--) r.h[i] = Math.min(Math.max(r.h[i], r.h[i + 1] - dh), r.h[i + 1] + dh);
      }
    }
    for (const b of r.def.bumps || []) {
      const hit = p.nearest(b.at[0], b.at[1]);
      for (let i = 0; i < n; i++) {
        const u = (i * p.step - hit.s) / b.half;
        if (Math.abs(u) < 1) r.h[i] += b.height * 0.5 * (1 + Math.cos(Math.PI * u));
      }
    }
  }

  /** @param {Road} r */
  blendJunctions(r) {
    const p = r.path;
    const n = p.n;
    const delta = new Float32Array(n);
    const fixed = new Uint8Array(n);
    const hit = /** @type {RoadHit} */ ({ road: null, s: 0, d: 0, h: 0, edge: 0 });
    let any = false;
    for (let i = 0; i < n; i++) {
      if (this.query(p.x[i], p.z[i], hit, 1.5, r.priority) && hit.road !== r) {
        delta[i] = hit.road.heightAt(hit.s) - r.h[i];
        fixed[i] = 1;
        any = true;
      }
    }
    if (!any) return;
    const reach = Math.ceil(JUNCTION_BLEND / p.step);
    const out = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      if (fixed[i]) {
        out[i] = delta[i];
        continue;
      }
      let best = 0;
      let bw = 0;
      for (let j = 1; j <= reach; j++) {
        for (const k of [i - j, i + j]) {
          if (!p.closed && (k < 0 || k >= n)) continue;
          const kk = p.wrapIndex(k);
          if (fixed[kk]) {
            const w = 1 - smoothstep(0, 1, j / reach);
            if (w > bw) {
              bw = w;
              best = delta[kk];
            }
          }
        }
        if (bw > 0) break;
      }
      out[i] = best * bw;
    }
    for (let i = 0; i < n; i++) r.h[i] += out[i];
  }

  /**
   * The road under (x, z), if any. Includes the sloped skirt beyond the edge.
   * @param {number} x @param {number} z @param {RoadHit} out
   * @param {number} [extra] extra reach past the skirt
   * @param {number} [minPriority] ignore roads at or below this priority
   */
  query(x, z, out, extra = 0, minPriority = -Infinity) {
    const best = this._best;
    const bestI = this._bestI;
    best.fill(Infinity);
    const cx = Math.floor((x + OFF) / CELL);
    const cz = Math.floor((z + OFF) / CELL);
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        const ix = cx + dx;
        const iz = cz + dz;
        if (ix < 0 || iz < 0 || ix >= W || iz >= W) continue;
        const list = this.cells[iz * W + ix];
        for (let k = 0; k < list.length; k += 2) {
          const r = this.roads[list[k]];
          if (r.priority <= minPriority) continue;
          const i = list[k + 1];
          const ex = r.path.x[i] - x;
          const ez = r.path.z[i] - z;
          const d2 = ex * ex + ez * ez;
          if (d2 < best[r.index]) {
            best[r.index] = d2;
            bestI[r.index] = i;
          }
        }
      }
    }
    let found = null;
    let foundD = 0;
    let foundS = 0;
    for (const r of this.roads) {
      if (best[r.index] === Infinity) continue;
      const h = r.path.refine(bestI[r.index], x, z, this._hit);
      const ad = Math.abs(h.d);
      if (ad > r.hw + SKIRT + extra) continue;
      if (!found || r.priority > found.priority || (r.priority === found.priority && ad < Math.abs(foundD))) {
        found = r;
        foundD = h.d;
        foundS = h.s;
      }
    }
    if (!found) return false;
    const edge = Math.abs(foundD) - found.hw;
    out.road = found;
    out.s = foundS;
    out.d = foundD;
    out.edge = edge;
    out.h = found.heightAt(foundS) - (edge > 0 ? Math.min(1, edge / SKIRT) * SINK : 0);
    return true;
  }

  /**
   * Nearest road edge within `reach` meters, for carving terrain and placing props.
   * @param {number} x @param {number} z @param {number} reach @param {RoadHit} out
   */
  influence(x, z, reach, out) {
    const rc = Math.ceil(reach / CELL);
    const cx = Math.floor((x + OFF) / CELL);
    const cz = Math.floor((z + OFF) / CELL);
    const best = this._best;
    const bestI = this._bestI;
    best.fill(Infinity);
    for (let dz = -rc; dz <= rc; dz++) {
      for (let dx = -rc; dx <= rc; dx++) {
        const ix = cx + dx;
        const iz = cz + dz;
        if (ix < 0 || iz < 0 || ix >= W || iz >= W) continue;
        const list = this.cells[iz * W + ix];
        for (let k = 0; k < list.length; k += 2) {
          const r = this.roads[list[k]];
          const i = list[k + 1];
          const ex = r.path.x[i] - x;
          const ez = r.path.z[i] - z;
          const d2 = ex * ex + ez * ez;
          if (d2 < best[r.index]) {
            best[r.index] = d2;
            bestI[r.index] = i;
          }
        }
      }
    }
    let found = false;
    let bestEdge = Infinity;
    for (const r of this.roads) {
      if (best[r.index] === Infinity) continue;
      const h = r.path.refine(bestI[r.index], x, z, this._hit);
      const edge = Math.abs(h.d) - r.hw;
      if (edge > reach || edge >= bestEdge) continue;
      bestEdge = edge;
      found = true;
      out.road = r;
      out.s = h.s;
      out.d = h.d;
      out.edge = edge;
      out.h = r.heightAt(h.s);
    }
    return found;
  }
}
