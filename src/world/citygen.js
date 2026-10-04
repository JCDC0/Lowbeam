/**
 * The city's local streets. Pure, deterministic from the seed.
 *
 * The frame roads (boulevards, the ring roads, the avenues) are authored in layout.js. Between
 * them each district fills its area with its own street pattern: two families of streets at the
 * district's angle and spacing, every street bent by a slow wave so no two blocks are the same,
 * some streets broken off part way (ending at a T on a cross street), and each street clipped to
 * the district. Where a street reaches the edge of its district next to a frame road it is carried
 * on to that road's centre line, so it meets it at a T; elsewhere it ends where it is. Streets keep
 * clear of the expressway and its ramps, of lifted road, and of running alongside a frame road.
 */

import { makeRng } from '../core/rng.js';
import { Path } from './spline.js';

/**
 * @typedef {{ id: string, path: Path, hw: number, cross?: (s: number) => boolean }} FrameRoad
 *   `cross(s)` says whether a street may cross the road at arc length s (false on a lifted part).
 * @typedef {{ path: Path, clear: number }} Avoid
 * @typedef {{
 *   id: string, name: string, inside: (x: number, z: number) => boolean, center: number[],
 *   angle: number, spacing: number[], bend: number, breaks: number, hw?: number, priority?: number, walk?: number,
 * }} District
 */

const STEP = 8;
const REACH = 1700;
/** A street end this close to a frame road (meters past its edge) is carried on to meet it. */
const SNAP = 55;
/** A street end this close to a cross street of its own district meets it at a T. */
const SNAP_OWN = 30;
const MIN_LENGTH = 70;

/**
 * @param {{ frame: FrameRoad[], avoid: Avoid[], districts: District[], seed: number, base: Partial<import('./layout.js').RoadDef>,
 *   blocked?: (x: number, z: number) => boolean }} o
 * @returns {import('./layout.js').RoadDef[]}
 */
export function cityStreets({ frame, avoid, districts, seed, base, blocked }) {
  /** @type {import('./layout.js').RoadDef[]} */
  const out = [];
  const near = nearIndex(frame, avoid);
  for (const dist of districts) {
    const rng = makeRng(seed ^ hash(dist.id));
    const ca = Math.cos(dist.angle);
    const sa = Math.sin(dist.angle);
    /** @type {number[][][]} */
    const across = [];
    for (const family of [1, 0]) {
      const [su, sv] = family ? [dist.spacing[1], dist.spacing[0]] : dist.spacing;
      const dir = family ? [-sa, ca] : [ca, sa];
      const off = family ? [ca, sa] : [-sa, ca];
      const count = Math.ceil(REACH / sv);
      for (let k = -count; k <= count; k++) {
        const v = k * sv + rng.range(-0.12, 0.12) * sv;
        const phase = rng.range(0, Math.PI * 2);
        const freq = rng.range(1 / 420, 1 / 260);
        const amp = dist.bend * rng.range(0.4, 1);
        /** @type {number[][]} */
        const line = [];
        for (let t = -REACH; t <= REACH; t += STEP) {
          const w = v + amp * Math.sin(t * freq + phase);
          line.push([dist.center[0] + dir[0] * t + off[0] * w, dist.center[1] + dir[1] * t + off[1] * w]);
        }
        let runs = clip(line, dist, near, blocked);
        if (family === 0) runs = runs.flatMap((r) => breakRun(r, rng, dist.breaks, su));
        for (const run of runs) {
          const pts = finish(run, near, family === 0 ? across : []);
          if (!pts) continue;
          if (family === 1) across.push(pts);
          out.push(/** @type {import('./layout.js').RoadDef} */ ({
            ...base,
            id: `${dist.id}-${family ? 'b' : 'a'}${out.length}`,
            name: dist.name,
            hw: dist.hw ?? base.hw,
            walk: dist.walk ?? base.walk,
            priority: (dist.priority ?? /** @type {number} */ (base.priority)) + (family ? 0.05 : 0),
            points: simplify(pts),
          }));
        }
      }
    }
  }
  return out;
}

/** @param {string} s */
function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/**
 * A coarse grid of frame and avoid road samples, so each street sample only looks at the few
 * roads near it.
 * @param {FrameRoad[]} frame @param {Avoid[]} avoid
 */
function nearIndex(frame, avoid) {
  const CELL = 64;
  /** @type {Map<number, { kind: 0 | 1, i: number, s: number, x: number, z: number, tx: number, tz: number }[]>} */
  const cells = new Map();
  const put = (kind, i, path) => {
    for (let s = 0; s <= path.length; s += 4) {
      const q = path.sample(s);
      const key = Math.floor(q.x / CELL) * 7919 + Math.floor(q.z / CELL);
      let list = cells.get(key);
      if (!list) cells.set(key, (list = []));
      list.push({ kind, i, s, x: q.x, z: q.z, tx: q.tx, tz: q.tz });
    }
  };
  frame.forEach((f, i) => put(0, i, f.path));
  avoid.forEach((a, i) => put(1, i, a.path));
  return {
    frame,
    avoid,
    /** Samples within r of (x, z). @param {number} x @param {number} z @param {number} r */
    around(x, z, r) {
      const res = [];
      const c0 = Math.floor((x - r) / CELL);
      const c1 = Math.floor((x + r) / CELL);
      const r0 = Math.floor((z - r) / CELL);
      const r1 = Math.floor((z + r) / CELL);
      for (let cx = c0; cx <= c1; cx++) {
        for (let cz = r0; cz <= r1; cz++) {
          const list = cells.get(cx * 7919 + cz);
          if (list) for (const p of list) if (Math.hypot(p.x - x, p.z - z) <= r) res.push(p);
        }
      }
      return res;
    },
  };
}

/**
 * The parts of a line that are inside the district and allowed: clear of expressways and ramps,
 * not crossing a frame road where it is lifted, not running alongside a frame road.
 * @param {number[][]} line @param {District} dist @param {ReturnType<typeof nearIndex>} near
 * @param {((x: number, z: number) => boolean) | undefined} blocked places no street may go (landmark lots)
 */
function clip(line, dist, near, blocked) {
  /** @type {number[][][]} */
  const runs = [];
  let run = [];
  for (let i = 0; i < line.length; i++) {
    const [x, z] = line[i];
    const prev = line[Math.max(0, i - 1)];
    const next = line[Math.min(line.length - 1, i + 1)];
    const tl = Math.hypot(next[0] - prev[0], next[1] - prev[1]) || 1;
    const tx = (next[0] - prev[0]) / tl;
    const tz = (next[1] - prev[1]) / tl;
    let ok = dist.inside(x, z) && !(blocked && blocked(x, z));
    if (ok) {
      for (const p of near.around(x, z, 80)) {
        const d = Math.hypot(p.x - x, p.z - z);
        if (p.kind === 1) {
          if (d < near.avoid[p.i].clear) ok = false;
        } else {
          const f = near.frame[p.i];
          const along = Math.abs(p.tx * tx + p.tz * tz);
          if (d < f.hw + 26 && along > 0.75) ok = false;
          if (d < f.hw + 14 && f.cross && !f.cross(p.s)) ok = false;
        }
        if (!ok) break;
      }
    }
    if (ok) run.push(line[i]);
    else if (run.length) {
      runs.push(run);
      run = [];
    }
  }
  if (run.length) runs.push(run);
  return runs.filter((r) => (r.length - 1) * STEP >= MIN_LENGTH * 0.5);
}

/**
 * Breaks a long run into pieces, the way real streets stop at a block and carry on one over.
 * @param {number[][]} run @param {ReturnType<typeof makeRng>} rng @param {number} chance
 * @param {number} block spacing of the cross streets, so a gap is about a block long
 */
function breakRun(run, rng, chance, block) {
  const len = (run.length - 1) * STEP;
  if (len < block * 3 || !rng.chance(chance)) return [run];
  const at = rng.range(0.25, 0.75) * len;
  const gap = block * rng.range(0.9, 1.1);
  const a = Math.round((at - gap / 2) / STEP);
  const b = Math.round((at + gap / 2) / STEP);
  return [run.slice(0, Math.max(0, a)), run.slice(Math.min(run.length, b))].filter((r) => r.length * STEP >= MIN_LENGTH);
}

/**
 * Carries each end of a run on to the frame road (or cross street) it stops beside, so it meets
 * it at a T. Returns null for a stub too short to keep.
 * @param {number[][]} run @param {ReturnType<typeof nearIndex>} near @param {number[][][]} own
 */
function finish(run, near, own) {
  const pts = run.slice();
  let joined = 0;
  for (const end of [0, 1]) {
    const a = end ? pts[pts.length - 1] : pts[0];
    const b = end ? pts[pts.length - 2] : pts[1];
    if (!b) return null;
    const dl = Math.hypot(a[0] - b[0], a[1] - b[1]) || 1;
    const dir = [(a[0] - b[0]) / dl, (a[1] - b[1]) / dl];
    let best = null;
    let bestD = Infinity;
    for (const p of near.around(a[0], a[1], SNAP + 12)) {
      if (p.kind !== 0) continue;
      const f = near.frame[p.i];
      if (f.cross && !f.cross(p.s)) continue;
      const dx = p.x - a[0];
      const dz = p.z - a[1];
      const ahead = dx * dir[0] + dz * dir[1];
      const d = Math.hypot(dx, dz);
      if (ahead < -2 || d > f.hw + SNAP || d >= bestD) continue;
      best = [p.x, p.z];
      bestD = d;
    }
    if (!best) {
      for (const line of own) {
        for (const q of line) {
          const dx = q[0] - a[0];
          const dz = q[1] - a[1];
          const d = Math.hypot(dx, dz);
          if (d < SNAP_OWN && d < bestD && dx * dir[0] + dz * dir[1] > -2) {
            best = q;
            bestD = d;
          }
        }
      }
    }
    if (best) {
      joined++;
      if (end) pts.push(best);
      else pts.unshift(best);
    }
  }
  let len = 0;
  for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  if (len < MIN_LENGTH || (joined === 0 && len < 220)) return null;
  return pts;
}

/** Every third point is enough for the spline, keeping both ends exact. @param {number[][]} pts */
function simplify(pts) {
  if (pts.length <= 4) return pts;
  const out = [pts[0]];
  for (let i = 3; i < pts.length - 1; i += 3) out.push(pts[i]);
  const last = pts[pts.length - 1];
  const prev = out[out.length - 1];
  if (Math.hypot(last[0] - prev[0], last[1] - prev[1]) < 10) out.pop();
  out.push(last);
  return out.map((p) => [Math.round(p[0] * 10) / 10, Math.round(p[1] * 10) / 10]);
}

/**
 * Point in a closed polygon. @param {number[][]} poly @param {number} x @param {number} z
 */
export function inPolygon(poly, x, z) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [ax, az] = poly[j];
    const [bx, bz] = poly[i];
    if (az > z !== bz > z && x < ((bx - ax) * (z - az)) / (bz - az) + ax) inside = !inside;
  }
  return inside;
}

/**
 * A fast point-in-polygon test for a polygon asked about many times: the polygon is rasterized
 * once, a scanline per `cell` meters, and a point is read back from the grid.
 * @param {number[][]} poly @param {number} [cell]
 * @returns {(x: number, z: number) => boolean}
 */
export function polygonMask(poly, cell = 4) {
  let x0 = Infinity;
  let x1 = -Infinity;
  let z0 = Infinity;
  let z1 = -Infinity;
  for (const [x, z] of poly) {
    x0 = Math.min(x0, x);
    x1 = Math.max(x1, x);
    z0 = Math.min(z0, z);
    z1 = Math.max(z1, z);
  }
  const nx = Math.ceil((x1 - x0) / cell) + 1;
  const nz = Math.ceil((z1 - z0) / cell) + 1;
  const m = new Uint8Array(nx * nz);
  for (let j = 0; j < nz; j++) {
    const z = z0 + (j + 0.5) * cell;
    const xs = [];
    for (let i = 0, k = poly.length - 1; i < poly.length; k = i++) {
      const [ax, az] = poly[k];
      const [bx, bz] = poly[i];
      if (az > z !== bz > z) xs.push(((bx - ax) * (z - az)) / (bz - az) + ax);
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const i0 = Math.max(0, Math.ceil((xs[k] - x0) / cell - 0.5));
      const i1 = Math.min(nx - 1, Math.floor((xs[k + 1] - x0) / cell - 0.5));
      for (let i = i0; i <= i1; i++) m[j * nx + i] = 1;
    }
  }
  return (x, z) => {
    const i = Math.floor((x - x0) / cell);
    const j = Math.floor((z - z0) / cell);
    return i >= 0 && j >= 0 && i < nx && j < nz && m[j * nx + i] === 1;
  };
}

/** Points along a path, for polygon tests. @param {Path} path @param {number} [every] */
export function pathPolygon(path, every = 20) {
  const out = [];
  for (let s = 0; s < path.length; s += every) {
    const q = path.sample(s);
    out.push([q.x, q.z]);
  }
  return out;
}
