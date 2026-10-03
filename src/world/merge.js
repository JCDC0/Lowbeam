/**
 * Slip roads: exits that grow out of a carriageway and entries that merge back into it.
 * Traffic keeps left, so a slip road always sits on the left edge of its carriageway.
 *
 * An exit starts as a sliver on the carriageway's edge and widens to a full lane over
 * `taper` (the inner edge stays on the carriageway's edge the whole time), runs beside it
 * for `parallel` as a deceleration lane, then pulls away from the nose over `diverge` until
 * its center is `spread` meters from the carriageway's. An entry is the same in reverse: it
 * comes alongside, runs as an acceleration lane and tapers away to nothing. Built this way
 * the two roads share an edge instead of overlapping, so there is no square road end to see.
 *
 * Pure, no three.js: `slipRamp` makes the control points, `slipMeta` measures the finished
 * ramp so heights, skirts, gores, rails and traffic can all read the same numbers.
 */

import { Path } from './spline.js';

/** Default proportions of a slip road, meters. */
export const SLIP = { taper: 60, parallel: 90, diverge: 140, spread: 24 };
/** Half width of a slip road at the point of its taper, so the ribbon never folds. */
export const SLIVER = 0.15;

const ease = (t) => t * t * (3 - 2 * t);

/**
 * Half width `u` meters into a taper of length `taper`, rising from SLIVER to `hw`. Uses the
 * same curve as `Road.hwAt`, so the ribbon's inner edge stays on the carriageway's edge.
 * @param {number} hw @param {number} u @param {number} taper
 */
export function slipWidth(hw, u, taper) {
  const t = Math.min(1, Math.max(0, u / taper));
  return SLIVER + (hw - SLIVER) * ease(t);
}

/**
 * @typedef {{ kind: 'exit' | 'entry', nose: number, carriageHw: number, hw: number,
 *   taper?: number, parallel?: number, diverge?: number, spread?: number, step?: number }} SlipOptions
 * `nose` is the arc length on the carriageway where the ramp's inner edge leaves its edge (an
 * exit) or first touches it (an entry).
 */

/**
 * Control points, in the ramp's direction of travel, for the stretch of an exit or entry ramp
 * that runs beside carriageway `C` and pulls away from it. An exit ends `spread` meters off the
 * carriageway at the end of its diverge; an entry starts there.
 * @param {Path} C @param {SlipOptions} o
 * @returns {number[][]}
 */
export function slipRamp(C, o) {
  const { kind, nose, carriageHw, hw } = o;
  const { taper, parallel, diverge, spread } = { ...SLIP, ...o };
  const step = o.step ?? 10;
  const d0 = carriageHw + hw;
  const total = taper + parallel + diverge;
  const q = { x: 0, z: 0, tx: 0, tz: 1 };
  const pts = [];
  const n = Math.ceil(total / step);
  for (let i = 0; i <= n; i++) {
    const u = (i / n) * total;
    let s;
    let d;
    if (kind === 'exit') {
      s = nose - taper - parallel + u;
      if (u < taper) d = carriageHw + slipWidth(hw, u, taper);
      else if (u <= taper + parallel) d = d0;
      else d = d0 + (spread - d0) * ((u - taper - parallel) / diverge) ** 2;
    } else {
      s = nose - diverge + u;
      if (u < diverge) d = d0 + (spread - d0) * (1 - u / diverge) ** 2;
      else if (u <= diverge + parallel) d = d0;
      else d = carriageHw + slipWidth(hw, total - u, taper);
    }
    C.sample(C.wrapS(s), q);
    pts.push([q.x + q.tz * d, q.z - q.tx * d]);
  }
  return pts;
}

/**
 * Points along a circular arc (or a straight line) that leaves `a` along unit tangent `ta` and
 * ends at `b`, excluding `a` and including `b`.
 * @param {number[]} a @param {number[]} ta @param {number[]} b @param {number} step
 */
function arc(a, ta, b, step) {
  const v = [b[0] - a[0], b[1] - a[1]];
  const n = [-ta[1], ta[0]];
  const vn = v[0] * n[0] + v[1] * n[1];
  const vv = v[0] * v[0] + v[1] * v[1];
  const out = [];
  if (Math.abs(vn) < 1e-6 * vv) {
    const k = Math.max(1, Math.ceil(Math.sqrt(vv) / step));
    for (let i = 1; i <= k; i++) out.push([a[0] + (v[0] * i) / k, a[1] + (v[1] * i) / k]);
    return out;
  }
  const r = vv / (2 * vn);
  const c = [a[0] + n[0] * r, a[1] + n[1] * r];
  const a0 = Math.atan2(a[1] - c[1], a[0] - c[0]);
  let sweep = Math.atan2(b[1] - c[1], b[0] - c[0]) - a0;
  // Turn the way the tangent points: left of `ta` (r > 0) is counter-clockwise in x, z.
  if (r > 0 && sweep < 0) sweep += Math.PI * 2;
  if (r < 0 && sweep > 0) sweep -= Math.PI * 2;
  const k = Math.max(1, Math.ceil((Math.abs(r * sweep)) / step));
  for (let i = 1; i <= k; i++) {
    const t = a0 + (sweep * i) / k;
    out.push([c[0] + Math.cos(t) * Math.abs(r), c[1] + Math.sin(t) * Math.abs(r)]);
  }
  return out;
}

/**
 * A biarc: two circular arcs from `p0` heading `t0` to `p1` heading `t1`, with the tangent
 * continuous where they meet. Unlike a cubic curve it spreads a turn evenly instead of
 * bunching it up at the ends, so a connector's tightest radius is as large as the room allows.
 * Returns the interior points and `p1`, not `p0`.
 * @param {number[]} p0 @param {number[]} t0 @param {number[]} p1 @param {number[]} t1 @param {number} [step]
 */
export function biarc(p0, t0, p1, t1, step = 8) {
  const v = [p1[0] - p0[0], p1[1] - p0[1]];
  const t = [t0[0] + t1[0], t0[1] + t1[1]];
  const vt = v[0] * t[0] + v[1] * t[1];
  const vv = v[0] * v[0] + v[1] * v[1];
  const c = 2 * (1 - (t0[0] * t1[0] + t0[1] * t1[1]));
  const d = c < 1e-9 ? vv / (4 * (v[0] * t1[0] + v[1] * t1[1])) : (-vt + Math.sqrt(vt * vt + c * vv)) / c;
  const pm = [(p0[0] + d * t0[0] + p1[0] - d * t1[0]) / 2, (p0[1] + d * t0[1] + p1[1] - d * t1[1]) / 2];
  // The tangent at the end of an arc is the start tangent mirrored across the chord.
  const u = heading(p0, pm);
  const k = 2 * (t0[0] * u[0] + t0[1] * u[1]);
  const tm = [k * u[0] - t0[0], k * u[1] - t0[1]];
  return [...arc(p0, t0, pm, step), ...arc(pm, tm, p1, step)];
}

/**
 * Unit direction from point a to point b.
 * @param {number[]} a @param {number[]} b
 */
export function heading(a, b) {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  return [(b[0] - a[0]) / L, (b[1] - a[1]) / L];
}

/**
 * @typedef {{ carriageId: string, kind: 'exit' | 'entry', carriageHw: number, rampHw: number,
 *   attach: number[], nose: number, rampAttach: number[], rampNose: number, gore: number }} SlipMeta
 * `attach` is the stretch of the carriageway (arc lengths, in its direction of travel) the ramp
 * runs along before the nose; `rampAttach` is the same stretch in the ramp's own arc length.
 * `gore` is how far past the nose (exit) or before it (entry) the painted gore runs.
 */

/**
 * The taper and the slip numbers for a finished ramp made from `points`, whose attached part
 * came from `slipRamp(C, o)`.
 * @param {number[][]} points @param {Path} C @param {string} carriageId @param {SlipOptions} o
 * @returns {{ taper: { from: number, to: number, s0: number, s1: number }, slip: SlipMeta }}
 */
export function slipMeta(points, C, carriageId, o) {
  const { kind, nose, carriageHw, hw } = o;
  const { taper, parallel, diverge, spread } = { ...SLIP, ...o };
  const path = new Path(points, { step: 2 });
  const q = { x: 0, z: 0, tx: 0, tz: 1 };
  const d0 = carriageHw + hw;
  const rampS = (s) => {
    C.sample(C.wrapS(s), q);
    return path.nearest(q.x + q.tz * d0, q.z - q.tx * d0).s;
  };
  // The gore is painted until the gap between the two edges is about a lane wide.
  const gore = diverge * Math.sqrt(Math.min(1, 3.5 / Math.max(0.1, spread - d0)));
  if (kind === 'exit') {
    const a = nose - taper - parallel;
    const taperEnd = rampS(a + taper);
    return {
      taper: { from: SLIVER, to: hw, s0: 0, s1: taperEnd },
      slip: { carriageId, kind, carriageHw, rampHw: hw, attach: [C.wrapS(a), C.wrapS(nose)], nose: C.wrapS(nose), rampAttach: [0, rampS(nose)], rampNose: rampS(nose), gore },
    };
  }
  const b = nose + parallel + taper;
  const taperStart = rampS(nose + parallel);
  return {
    taper: { from: hw, to: SLIVER, s0: taperStart, s1: path.length },
    slip: { carriageId, kind, carriageHw, rampHw: hw, attach: [C.wrapS(nose), C.wrapS(b)], nose: C.wrapS(nose), rampAttach: [rampS(nose), path.length], rampNose: rampS(nose), gore },
  };
}

/**
 * Whether arc length `s` lies in [a, b] on a path of length `L`, going forward from a (so a
 * stretch can run across the seam of a closed road).
 * @param {number} s @param {number[]} range @param {number} L @param {boolean} closed
 */
export function inStretch(s, range, L, closed) {
  const [a, b] = range;
  if (!closed) return s >= a && s <= b;
  const len = (((b - a) % L) + L) % L;
  const u = (((s - a) % L) + L) % L;
  return u <= len;
}
