/**
 * Road network: splines, height profiles, junction blending and a spatial grid for
 * "which road am I on" queries. Pure, no three.js.
 */

import { Path } from './spline.js';
import { blurredHeight } from './heightfield.js';
import { smoothstep } from '../core/mathx.js';
import { WORLD_HALF } from './layout.js';

/** Width of the sloped edge between the road top and the carved terrain beside it. */
export const SKIRT = 1.2;
/** How far the carved terrain sits below the road surface. */
export const SINK = 0.25;
/** A road lifted more than this above its natural profile is on a deck, not on the ground. */
export const ELEVATED = 2.0;
/** A car at height y can use a deck whose surface is at most this far above y. */
const DECK_REACH = 1.6;

const CELL = 16;
const OFF = WORLD_HALF + 100;
const W = Math.ceil((OFF * 2) / CELL);
const JUNCTION_BLEND = 35;

/** @typedef {import('./layout.js').RoadDef} RoadDef */
/** @typedef {{ road: Road, s: number, d: number, h: number, edge: number, lift?: number }} RoadHit */

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
    /** Meters this road is lifted above its natural profile: overpasses and viaducts. */
    this.lift = new Float32Array(this.path.n);
    this.lifted = false;
  }

  /** Lift at arc length s. @param {number} s */
  liftAt(s) {
    if (!this.lifted) return 0;
    const p = this.path;
    s = p.wrapS(s);
    const fi = s / p.step;
    const i = Math.min(Math.floor(fi), p.closed ? p.n - 1 : p.n - 2);
    return this.lift[i] + (this.lift[p.wrapIndex(i + 1)] - this.lift[i]) * (fi - i);
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

  hwAt(s) {
    if (!this.def.taper) return this.hw;
    const { from, to, s0, s1 } = this.def.taper;
    if (s <= s0) return from;
    if (s >= s1) return to;
    const t = (s - s0) / (s1 - s0);
    return from + (to - from) * (3 * t * t - 2 * t * t * t);
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
    for (const r of this.roads) if (r.def.twin) this.copyTwin(r, /** @type {Road} */ (this.byId.get(r.def.twin)));
    // Lower priority roads take the height of anything they cross, so junctions are flush.
    const order = [...this.roads].sort((a, b) => b.priority - a.priority);
    for (const r of order) this.blendJunctions(r);
    // Lifts come last: junctions blend the natural profiles, then an overpass climbs from there.
    for (const r of this.roads) this.applyLifts(r);
  }

  /**
   * Overpasses. Each lift raises the road by `height` around the point `at`: full height
   * for `flat` meters, then a cosine ease down to nothing at `half` meters from it.
   * @param {Road} r
   */
  applyLifts(r) {
    const lifts = r.def.lifts;
    if (!lifts || !lifts.length) return;
    const p = r.path;
    for (const L of lifts) {
      const hit = p.nearest(L.at[0], L.at[1]);
      const flat = (L.flat || 0) / 2;
      for (let i = 0; i < p.n; i++) {
        let u = Math.abs(i * p.step - hit.s);
        if (p.closed) u = Math.min(u, p.length - u);
        const t = Math.min(1, Math.max(0, (u - flat) / Math.max(1, L.half - flat)));
        const e = 0.5 * (1 + Math.cos(Math.PI * t));
        r.lift[i] = Math.max(r.lift[i], L.height * e);
      }
    }
    for (let i = 0; i < p.n; i++) r.h[i] += r.lift[i];
    r.lifted = true;
  }

  cellKey(x, z) {
    const cx = Math.floor((x + OFF) / CELL);
    const cz = Math.floor((z + OFF) / CELL);
    if (cx < 0 || cz < 0 || cx >= W || cz >= W) return -1;
    return cz * W + cx;
  }

  /**
   * A divided road's second carriageway takes the height of the first at the same cross
   * section, so the level across the median is always the same.
   * @param {Road} r @param {Road} twin
   */
  copyTwin(r, twin) {
    const p = r.path;
    const t = twin.path;
    const hit = { s: 0, d: 0, x: 0, z: 0, i: 0 };
    let prev = -1;
    for (let i = 0; i < p.n; i++) {
      if (prev < 0) t.nearest(p.x[i], p.z[i], hit);
      else t.nearest(p.x[i], p.z[i], hit, prev - 90, prev + 90);
      prev = t.wrapIndex(Math.round(hit.s / t.step));
      r.h[i] = twin.heightAt(hit.s);
    }
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
      // A closed road is clamped round and round so the seam obeys the limit too.
      const laps = p.closed ? 3 : 1;
      for (let pass = 0; pass < 2; pass++) {
        for (let i = 1; i < n * laps; i++) {
          const a = i % n;
          const b = (i - 1) % n;
          r.h[a] = Math.min(Math.max(r.h[a], r.h[b] - dh), r.h[b] + dh);
        }
        for (let i = n * laps - 2; i >= 0; i--) {
          const a = i % n;
          const b = (i + 1) % n;
          r.h[a] = Math.min(Math.max(r.h[a], r.h[b] - dh), r.h[b] + dh);
        }
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
        if (hit.road.def.cls === 'ramp') continue;
        delta[i] = hit.road.heightAt(hit.s) - r.h[i];
        fixed[i] = 1;
        any = true;
      }
    }
    if (r.def.link) {
      for (const end of [r.def.link.from, r.def.link.to]) {
        const target = this.byId.get(end.id);
        if (!target) continue;
        const targetH = target.heightAt(end.s);
        const pt = target.path.sample(end.s);
        for (let i = 0; i < n; i++) {
          if (Math.hypot(p.x[i] - pt.x, p.z[i] - pt.z) < 14) {
            delta[i] = targetH - r.h[i];
            fixed[i] = 1;
            any = true;
          }
        }
      }
    }
    if (r.def.gore) {
      const carriage = this.byId.get(r.def.gore.carriageId);
      if (carriage) {
        for (let i = 0; i < n; i++) {
          const s = i * p.step;
          const hitC = carriage.path.nearest(p.x[i], p.z[i]);
          const gap = Math.abs(hitC.d) - carriage.hw - r.hw;
          if (gap < 4.0 && (r.def.gore.kind === 'exit' ? s < 60 : s > p.length - 60)) {
            delta[i] = carriage.heightAt(hitC.s) - r.h[i];
            fixed[i] = 1;
            any = true;
          }
        }
      }
    }
    if (!any) return;
    // Spread the correction over enough road to stay climbable: about 5 % per meter of delta.
    let worst = 0;
    for (let i = 0; i < n; i++) if (fixed[i]) worst = Math.max(worst, Math.abs(delta[i]));
    const reach = Math.ceil(Math.min(450, Math.max(JUNCTION_BLEND, worst / 0.05)) / p.step);
    // The nearest fixed sample on each side, so two junctions close together blend into each other.
    const laps = p.closed ? 2 : 1;
    const far = 1e9;
    const dl = new Int32Array(n).fill(far);
    const dr = new Int32Array(n).fill(far);
    const il = new Int32Array(n).fill(-1);
    const ir = new Int32Array(n).fill(-1);
    let seen = -far;
    let seenAt = -1;
    for (let k = 0; k < n * laps; k++) {
      const i = k % n;
      if (fixed[i]) {
        seen = k;
        seenAt = i;
      }
      if (k >= (laps - 1) * n && seenAt >= 0) {
        dl[i] = k - seen;
        il[i] = seenAt;
      }
    }
    seen = far;
    seenAt = -1;
    for (let k = n * laps - 1; k >= 0; k--) {
      const i = k % n;
      if (fixed[i]) {
        seen = k;
        seenAt = i;
      }
      if (k < n && seenAt >= 0) {
        dr[i] = seen - k;
        ir[i] = seenAt;
      }
    }
    const weight = (d) => (d >= reach ? 0 : 1 - smoothstep(0, 1, d / reach));
    const out = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      if (fixed[i]) {
        out[i] = delta[i];
        continue;
      }
      const wl = il[i] >= 0 ? weight(dl[i]) : 0;
      const wr = ir[i] >= 0 ? weight(dr[i]) : 0;
      out[i] = ((wl ? wl * delta[il[i]] : 0) + (wr ? wr * delta[ir[i]] : 0)) / Math.max(1, wl + wr);
    }
    for (let i = 0; i < n; i++) r.h[i] += out[i];
  }

  /**
   * The road under (x, z), if any. Includes the sloped skirt beyond the edge. A road on a
   * deck is only found by something at or above its surface: pass the height `y` of the
   * thing asking. Without it, only roads on the ground are found, so props, trees and the
   * terrain carve ignore overpasses.
   * @param {number} x @param {number} z @param {RoadHit} out
   * @param {number} [extra] extra reach past the skirt
   * @param {number} [minPriority] ignore roads at or below this priority
   * @param {number} [y] height of the asker; roads on a deck above y + 1.6 are skipped
   */
  query(x, z, out, extra = 0, minPriority = -Infinity, y = -Infinity) {
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
    let foundDeck = false;
    for (const r of this.roads) {
      if (best[r.index] === Infinity) continue;
      const h = r.path.refine(bestI[r.index], x, z, this._hit);
      const ad = Math.abs(h.d);
      const hw = r.hwAt(h.s);
      if (ad > hw + SKIRT + extra) continue;
      const deck = r.lifted && r.liftAt(h.s) > ELEVATED;
      if (deck && r.heightAt(h.s) > y + DECK_REACH) continue;
      const onR = ad <= hw;
      const onFound = found ? Math.abs(foundD) <= found.hwAt(foundS) : false;
      const better = !found || (deck && !foundDeck) || (deck === foundDeck && (onR !== onFound ? onR : (r.priority > found.priority || (r.priority === found.priority && ad < Math.abs(foundD)))));
      if (better) {
        found = r;
        foundD = h.d;
        foundS = h.s;
        foundDeck = deck;
      }
    }
    if (!found) return false;
    const edge = Math.abs(foundD) - found.hwAt(foundS);
    out.road = found;
    out.s = foundS;
    out.d = foundD;
    out.edge = edge;
    out.lift = found.liftAt(foundS);
    out.h = found.heightAt(foundS) - (edge > 0 ? Math.min(1, edge / SKIRT) * SINK : 0);
    return true;
  }

  /**
   * Nearest road edge within `reach` meters, for carving terrain and placing props.
   * A road on a deck is ignored unless it is cut into the ground: pass the natural ground
   * height `groundH` here and a lifted road only counts when it is within 2 m of it.
   * @param {number} x @param {number} z @param {number} reach @param {RoadHit} out
   * @param {number} [groundH]
   */
  influence(x, z, reach, out, groundH = -Infinity) {
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
      // Terrain is not shaped to a road that has left the ground; the road below is.
      const lift = r.liftAt(h.s);
      if (lift > ELEVATED + 0.4 && r.heightAt(h.s) - groundH > ELEVATED) continue;
      bestEdge = edge;
      found = true;
      out.road = r;
      out.s = h.s;
      out.d = h.d;
      out.edge = edge;
      out.lift = lift;
      out.h = r.heightAt(h.s);
    }
    return found;
  }
}
