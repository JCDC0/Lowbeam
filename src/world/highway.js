/**
 * What Route 1 has besides tarmac: the concrete barrier down the median, steel guard rails
 * along both outer edges, and the three toll plazas. Pure: positions, sizes and colliders
 * only; build-highway.js turns them into meshes. Walls and rails leave gaps where a ramp
 * or a forecourt meets the road, and nothing is built through a plaza.
 */

import { SKIRT } from './roads.js';
import { padDistance } from './ground.js';
import { TOLLS } from './layout.js';

/** Meters of barrier or rail per segment (and per collider box). */
export const SEGMENT = 6;
/** Half the width of a plaza's canopy and the length of the stretch it replaces, meters. */
export const PLAZA = { half: 15.5, reach: 24, openRail: 52 };
export const BARRIER = { halfBase: 0.31, halfTop: 0.12, height: 0.82 };
export const RAIL = { offset: 0.9, low: 0.55, high: 0.86 };
/** Lane width on Route 1 and the lanes in a carriageway. */
const LANES = 3;

/**
 * @typedef {{ x: number, z: number, y: number, yaw: number, len: number, chunk: number }} Segment
 * @typedef {{
 *   toll: typeof TOLLS[number], x: number, z: number, y: number, yaw: number,
 *   carriageway: number, laneWidth: number, lanes: { u: number, cash: boolean }[],
 *   dividers: number[]
 * }} Plaza
 */

/**
 * @param {import('./ground.js').Ground} ground
 * @param {import('./scatter.js').Box[]} boxes @param {import('./scatter.js').Circle[]} circles
 * @param {import('./scatter.js').BakeLight[]} lights
 */
export function placeHighway(ground, boxes, circles, lights) {
  const fwd = /** @type {import('./roads.js').Road} */ (ground.roads.byId.get('c1-f'));
  const rev = /** @type {import('./roads.js').Road} */ (ground.roads.byId.get('c1-r'));
  const hw = fwd.hw;
  const half = /** @type {number} */ (fwd.def.median) / 2 + hw;
  const laneWidth = (hw * 2) / LANES;
  const p = fwd.path;
  const q = { x: 0, z: 0, tx: 0, tz: 1 };
  const hit = { road: null, s: 0, d: 0, h: 0, edge: 0 };
  // Ramp centre lines, coarsely, to keep the verge open where one meets the loop.
  const ramps = ground.roads.roads.filter((r) => r.def.cls === 'ramp').map((r) => {
    const pts = [];
    for (let i = 0; i < r.path.n; i += 4) pts.push([r.path.x[i], r.path.z[i]]);
    return pts;
  });
  const nearRamp = (x, z, r) => ramps.some((pts) => pts.some((a) => (a[0] - x) ** 2 + (a[1] - z) ** 2 < r * r));

  /** @type {Plaza[]} */
  const plazas = TOLLS.map((toll) => {
    const h = fwd.path.nearest(toll.x, toll.z);
    fwd.path.sample(h.s, q);
    // The plaza sits on the median line, half a carriageway right of the forward road.
    const x = q.x - q.tz * half;
    const z = q.z + q.tx * half;
    const lanes = [];
    for (const side of [1, -1]) {
      for (let i = 0; i < LANES; i++) {
        lanes.push({ u: side * half + (i - (LANES - 1) / 2) * laneWidth, cash: i === LANES - 1 });
      }
    }
    const dividers = [];
    for (const side of [1, -1]) for (const k of [-1, 1]) dividers.push(side * half + (k * laneWidth) / 2);
    return {
      toll, x, z, y: fwd.heightAt(h.s), yaw: Math.atan2(q.tx, q.tz), carriageway: half, laneWidth, lanes, dividers,
      s: h.s,
    };
  });
  const inPlaza = (x, z, reach) => plazas.some((pl) => Math.hypot(pl.x - x, pl.z - z) < reach);

  /** @type {Segment[]} */
  const barrier = [];
  /** @type {Segment[]} */
  const rails = [];
  const chunkOf = (s) => Math.floor(s / 180);

  for (let s = 0; s < p.length - SEGMENT / 2; s += SEGMENT) {
    const mid = s + SEGMENT / 2;
    p.sample(mid, q);
    const yaw = Math.atan2(q.tx, q.tz);
    const y = fwd.heightAt(mid);
    const chunk = chunkOf(mid);

    // Median: the line half a carriageway to the right of the forward road.
    const mx = q.x - q.tz * half;
    const mz = q.z + q.tx * half;
    if (!inPlaza(mx, mz, PLAZA.reach)) {
      barrier.push({ x: mx, z: mz, y, yaw, len: SEGMENT, chunk });
      boxes.push({ x: mx, z: mz, hx: BARRIER.halfBase, hz: SEGMENT / 2, yaw, y0: y - 0.4, y1: y + BARRIER.height });
    }

    // Outer rails of the forward road (left) and, mirrored, of the reverse road.
    const edge = hw + RAIL.offset;
    const lx = q.tz;
    const lz = -q.tx;
    const rx = q.x + lx * edge;
    const rz = q.z + lz * edge;
    railSegment(rails, boxes, ground, hit, rx, rz, y, yaw, chunk, inPlaza(rx, rz, PLAZA.openRail) || nearRamp(rx, rz, 20));
    const rp = rev.path.nearest(mx - q.tz * half, mz + q.tx * half);
    rev.path.sample(rp.s, q);
    const rEdge = hw + RAIL.offset;
    // The reverse road's left is its outer edge: (tz, -tx) of its own tangent.
    const ox = q.x + q.tz * rEdge;
    const oz = q.z - q.tx * rEdge;
    railSegment(rails, boxes, ground, hit, ox, oz, rev.heightAt(rp.s), Math.atan2(q.tx, q.tz), chunk + 10000, inPlaza(ox, oz, PLAZA.openRail) || nearRamp(ox, oz, 20));
  }

  for (const pl of plazas) {
    const c = Math.cos(pl.yaw);
    const sn = Math.sin(pl.yaw);
    const at = (u, v) => ({ x: pl.x + c * u + sn * v, z: pl.z - sn * u + c * v });
    const y1 = pl.y + 5.4;
    for (const u of [...pl.dividers, 0]) {
      const col = at(u, 0);
      circles.push({ x: col.x, z: col.z, r: 0.6, y1: y1 });
    }
    for (const u of pl.dividers) {
      const isl = at(u, 0);
      boxes.push({ x: isl.x, z: isl.z, hx: 0.65, hz: 9, yaw: pl.yaw, y0: pl.y - 0.4, y1: pl.y + 3 });
    }
    const med = at(0, 0);
    boxes.push({ x: med.x, z: med.z, hx: 1.6, hz: 12, yaw: pl.yaw, y0: pl.y - 0.4, y1: pl.y + 3 });
    for (const v of [-4, 0, 4]) {
      for (let k = -3; k <= 3; k += 2) {
        const l = at((k * pl.carriageway) / 3.5 + 0, v);
        lights.push({ x: l.x, y: pl.y + 5.2, z: l.z, c: [1.1, 1.15, 1.2], range: 22 });
      }
    }
  }
  return { barrier, rails, plazas };
}

/** A rail segment, unless something is in the way. */
function railSegment(rails, boxes, ground, hit, x, z, y, yaw, chunk, open) {
  if (open) return;
  for (const pad of ground.pads) if (padDistance(pad, x, z) < 7) return;
  const nz = ground.roads.query(x, z, hit, SKIRT);
  if (nz && hit.road.def.cls !== 'expressway') return;
  rails.push({ x, z, y, yaw, len: SEGMENT, chunk });
  boxes.push({ x, z, hx: 0.16, hz: SEGMENT / 2, yaw, y0: y - 0.4, y1: y + RAIL.high });
}
