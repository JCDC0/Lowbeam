/**
 * Helpers that turn a few control points into road definitions: offset paths, dual
 * carriageways, a street grid and the four ramps of a diamond interchange. Pure, no
 * three.js. `layout.js` calls them once at load time; nothing here runs in the frame loop.
 */

import { Path } from './spline.js';

/** @typedef {import('./layout.js').RoadDef} RoadDef */

/**
 * Control points of the path `d` meters to the left of `points` (negative d is to the
 * right), sampled every `step` meters so tight corners stay tight.
 * @param {number[][]} points @param {number} d
 * @param {{ closed?: boolean, step?: number }} [opts]
 * @returns {number[][]}
 */
export function offsetPoints(points, d, { closed = false, step = 36 } = {}) {
  const path = new Path(points, { closed, step: 2 });
  const out = [];
  const count = Math.max(2, Math.round(path.length / step));
  const last = closed ? count : count + 1;
  for (let i = 0; i < last; i++) {
    const p = path.sample(Math.min(path.length, (i * path.length) / count));
    out.push([p.x + p.tz * d, p.z - p.tx * d]);
  }
  return out;
}

/**
 * A divided road as two one-way carriageways. Traffic keeps left, so the carriageway that
 * runs with the points is on the left of the center line and the other one, which runs
 * against them, is on the right. The median sits between them.
 * @param {number[][]} points center line
 * @param {Partial<RoadDef> & { id: string, name: string, median?: number, closed?: boolean }} base
 * @returns {RoadDef[]}
 */
export function dualCarriageway(points, base) {
  const { median = 3.2, closed = false, ...rest } = base;
  const half = /** @type {number} */ (rest.hw) + median / 2;
  const fwd = offsetPoints(points, half, { closed });
  const rev = offsetPoints(points, -half, { closed }).reverse();
  return [
    /** @type {RoadDef} */ ({ ...rest, id: `${base.id}-f`, name: base.name, closed, oneway: true, points: fwd, median }),
    /** @type {RoadDef} */ ({ ...rest, id: `${base.id}-r`, name: base.name, closed, oneway: true, points: rev, median, lamps: undefined, twin: `${base.id}-f` }),
  ];
}

/**
 * Street grid: `ew` runs along x at the given z values, `ns` along z at the given x values.
 * North-south streets get the higher priority so each crossing has one road to follow.
 * @param {{ x0: number, x1: number, z0: number, z1: number }} rect
 * @param {number[]} ew z of each east-west street @param {number[]} ns x of each north-south street
 * @param {Partial<RoadDef> & { prefix: string, names?: string[], nsPriority?: number }} base
 * @returns {RoadDef[]}
 */
export function streetGrid(rect, ew, ns, base) {
  const { prefix, names = [], nsPriority, ...rest } = base;
  /** @type {RoadDef[]} */
  const out = [];
  ew.forEach((z, i) => {
    const pts = [[rect.x0, z], [(rect.x0 + rect.x1) / 2, z], [rect.x1, z]];
    out.push(/** @type {RoadDef} */ ({
      ...rest, id: `${prefix}-ew${i}`, name: names[i] || `${prefix.toUpperCase()} ST ${i + 1}`, points: pts,
      lamps: [{ from: pts[0], to: pts[2], every: 32 }],
    }));
  });
  ns.forEach((x, i) => {
    const pts = [[x, rect.z0], [x, (rect.z0 + rect.z1) / 2], [x, rect.z1]];
    out.push(/** @type {RoadDef} */ ({
      ...rest, id: `${prefix}-ns${i}`, name: names[ew.length + i] || `${prefix.toUpperCase()} AVE ${i + 1}`, points: pts,
      priority: nsPriority ?? /** @type {number} */ (rest.priority),
      lamps: [{ from: pts[0], to: pts[2], every: 32 }],
    }));
  });
  return out;
}

/**
 * First point along `path` where its x (axis 'x') or z (axis 'z') crosses `value` and
 * `ok(point)` holds, with the unit tangent there and the arc length.
 * @param {Path} path @param {'x' | 'z'} axis @param {number} value
 * @param {(p: { x: number, z: number }) => boolean} [ok]
 */
export function pathCrossing(path, axis, value, ok = () => true) {
  const q = { x: 0, z: 0, tx: 0, tz: 1 };
  let prev = null;
  for (let s = 0; s <= path.length; s += 1) {
    path.sample(s, q);
    const v = (axis === 'x' ? q.x : q.z) - value;
    if (prev !== null && prev * v <= 0 && ok(q)) {
      const f = prev === v ? 0 : prev / (prev - v);
      path.sample(s - 1 + f, q);
      return { s: s - 1 + f, x: q.x, z: q.z, tx: q.tx, tz: q.tz };
    }
    prev = v;
  }
  throw new Error(`no crossing of ${axis} = ${value}`);
}

/**
 * Smooth interior points of a cubic Hermite curve from p0 to p1.
 * @param {number[]} p0 @param {number[]} t0 unit tangent leaving p0
 * @param {number[]} p1 @param {number[]} t1 unit tangent arriving at p1
 * @param {number} [n]
 */
export function hermite(p0, t0, p1, t1, n = 8) {
  const L = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) * 0.95;
  const out = [];
  for (let i = 1; i < n; i++) {
    const t = i / n;
    const t2 = t * t;
    const t3 = t2 * t;
    const h00 = 2 * t3 - 3 * t2 + 1;
    const h10 = t3 - 2 * t2 + t;
    const h01 = -2 * t3 + 3 * t2;
    const h11 = t3 - t2;
    out.push([h00 * p0[0] + h10 * L * t0[0] + h01 * p1[0] + h11 * L * t1[0], h00 * p0[1] + h10 * L * t0[1] + h01 * p1[1] + h11 * L * t1[1]]);
  }
  return out;
}

/**
 * The four ramps of a diamond interchange where `arterial` passes over the dual
 * carriageway `fwd`/`rev`. Each carriageway gets an exit and an entry on its left (the
 * side traffic leaves and joins when it keeps left); the ramps stay on the ground and meet
 * the arterial at T junctions `reach` meters either side of the crossing, outside the
 * stretch where the arterial is lifted.
 * @param {{ id: string, arterial: Path, cross: number[], fwd: Path, rev: Path,
 *   hw: number, carriageHw: number, reach?: number, run?: number, before?: number,
 *   base: Partial<RoadDef> }} o
 * @returns {RoadDef[]}
 */
export function diamond({ id, arterial, cross, fwd, rev, hw, carriageHw, reach = 205, run = 150, before = 330, base }) {
  const out = [];
  const aHit = arterial.nearest(cross[0], cross[1]);
  const at = arterial.sample(aHit.s);
  const nA = [at.tz, -at.tx];
  const d0 = carriageHw + hw - 1.4;
  for (const [tag, C] of /** @type {const} */ ([['f', fwd], ['r', rev]])) {
    const cHit = C.nearest(cross[0], cross[1]);
    const ct = C.sample(cHit.s);
    const left = [ct.tz, -ct.tx];
    const towardLeft = at.tx * left[0] + at.tz * left[1] > 0 ? 1 : -1;
    const T = arterial.sample(aHit.s + towardLeft * reach);
    const off = (s, d) => {
      const p = C.sample(C.wrapS(s));
      return [p.x + p.tz * d, p.z - p.tx * d];
    };
    const tan = (s) => {
      const p = C.sample(C.wrapS(s));
      return [p.tx, p.tz];
    };
    const sideOf = (pt) => Math.sign((pt[0] - T.x) * nA[0] + (pt[1] - T.z) * nA[1]) || 1;

    const exitS0 = cHit.s - before;
    const exitPts = [];
    for (let i = 0; i <= 4; i++) {
      const t = i / 4;
      exitPts.push(off(exitS0 + run * t, d0 + (24 - d0) * t * t));
    }
    const eEnd = exitPts[exitPts.length - 1];
    const arrive = [-sideOf(eEnd) * nA[0], -sideOf(eEnd) * nA[1]];
    const exitTail = hermite(eEnd, tan(exitS0 + run), [T.x, T.z], arrive, 8);
    out.push(/** @type {RoadDef} */ ({ ...base, id: `${id}-${tag}x`, name: base.name, hw, oneway: true, points: [...exitPts, ...exitTail, [T.x, T.z]] }));

    const entryS1 = cHit.s + before;
    const entryPts = [];
    for (let i = 4; i >= 0; i--) {
      const t = i / 4;
      entryPts.push(off(entryS1 - run * t, d0 + (24 - d0) * t * t));
    }
    const nStart = entryPts[0];
    const depart = [sideOf(nStart) * nA[0], sideOf(nStart) * nA[1]];
    const entryHead = hermite([T.x, T.z], depart, nStart, tan(entryS1 - run), 8);
    out.push(/** @type {RoadDef} */ ({ ...base, id: `${id}-${tag}n`, name: base.name, hw, oneway: true, points: [[T.x, T.z], ...entryHead, ...entryPts] }));
  }
  return out;
}
