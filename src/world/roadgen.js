/**
 * Helpers that turn a few control points into road definitions: offset paths, dual
 * carriageways, a street grid and merge ramps. Pure, no three.js. `layout.js` calls them
 * once at load time; nothing here runs in the frame loop.
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
    /** @type {RoadDef} */ ({ ...rest, id: `${base.id}-f`, name: base.name, closed, oneway: true, points: fwd, median: half }),
    /** @type {RoadDef} */ ({ ...rest, id: `${base.id}-r`, name: base.name, closed, oneway: true, points: rev, median: half, lamps: (rest.lamps || []).map((l) => ({ ...l })) }),
  ];
}

/**
 * Street grid: `ew` runs along x at the given z values, `ns` along z at the given x values.
 * Each street is a straight road across the whole block, lamps along the full length.
 * @param {{ x0: number, x1: number, z0: number, z1: number }} rect
 * @param {number[]} ew z of each east-west street @param {number[]} ns x of each north-south street
 * @param {Partial<RoadDef> & { prefix: string, names?: string[] }} base
 * @returns {RoadDef[]}
 */
export function streetGrid(rect, ew, ns, base) {
  const { prefix, names = [], ...rest } = base;
  /** @type {RoadDef[]} */
  const out = [];
  ew.forEach((z, i) => {
    const pts = [[rect.x0, z], [(rect.x0 + rect.x1) / 2, z], [rect.x1, z]];
    out.push(/** @type {RoadDef} */ ({
      ...rest, id: `${prefix}-ew${i}`, name: names[i] || `${prefix.toUpperCase()}-DORI ${i + 1}`, points: pts,
      lamps: [{ from: pts[0], to: pts[2], every: 32 }],
    }));
  });
  ns.forEach((x, i) => {
    const pts = [[x, rect.z0], [x, (rect.z0 + rect.z1) / 2], [x, rect.z1]];
    out.push(/** @type {RoadDef} */ ({
      ...rest, id: `${prefix}-ns${i}`, name: names[ew.length + i] || `${prefix.toUpperCase()}-SUJI ${i + 1}`, points: pts,
      lamps: [{ from: pts[0], to: pts[2], every: 32 }],
    }));
  });
  return out;
}

/**
 * A one-way ramp between a carriageway and the point `other`. `join` is the arc length on
 * `path` where it merges; the ramp runs parallel to the carriageway for `run` meters at a
 * lateral offset `d` (positive to the left) that grows from the carriageway edge to
 * `far`, then bends to `other`.
 * @param {Path} path the carriageway center line @param {number} join
 * @param {{ d: number, far: number, run: number, other: number[], via?: number[][], exit: boolean }} o
 * @returns {number[][]} control points in the direction of travel
 */
export function rampPoints(path, join, { d, far, run, other, via = [], exit }) {
  const at = (s, off) => {
    const p = path.sample(path.wrapS(s));
    return [p.x + p.tz * off, p.z - p.tx * off];
  };
  const pts = [];
  const along = exit ? 1 : -1;
  const n = 4;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    pts.push(at(join + along * run * t, d + (far - d) * t * t));
  }
  const tail = [...via, other];
  const ordered = exit ? [...pts, ...tail] : [other, ...via.slice().reverse(), ...pts.slice().reverse()];
  return ordered;
}
