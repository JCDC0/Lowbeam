/**
 * What Route 1 has besides tarmac: the concrete barrier down the median, steel guard rails
 * along both outer edges, and the three toll plazas. Pure: positions, sizes and colliders
 * only; build-highway.js turns them into meshes. Walls and rails leave gaps where a ramp
 * or a forecourt meets the road, and nothing is built through a plaza.
 */

import { SKIRT } from './roads.js';
import { padDistance } from './ground.js';
import { CITY, TOLLS } from './layout.js';
import { inStretch } from './merge.js';

/** Meters of barrier or rail per segment (and per collider box). */
export const SEGMENT = 6;
/** Half the width of a plaza's canopy and the length of the stretch it replaces, meters. */
export const PLAZA = { half: 15.5, reach: 24, openRail: 52 };
export const BARRIER = { halfBase: 0.31, halfTop: 0.12, height: 0.82 };
export const RAIL = { offset: 0.9, low: 0.55, high: 0.86 };
/** Lane width on Route 1 and the lanes in a carriageway. */
const LANES = 3;
/** Meters past the painted gore before the carriageway's rail starts again. */
const RAIL_GAP = 30;
/** A ramp's outer rail stops this far from the end where it meets an avenue. */
const RAMP_RAIL_END = 26;

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
  const q = { x: 0, z: 0, tx: 0, tz: 1 };
  const hit = { road: null, s: 0, d: 0, h: 0, edge: 0 };
  // The carriageway's rail stops where a slip road runs along its edge and stays open past
  // the painted gore, until the ramp is far enough away for a rail to fit between them.
  const rampOpen = (roadId, s) => {
    const road = ground.roads.byId.get(roadId);
    if (!road) return false;
    const p = road.path;
    for (const r of ground.roads.roads) {
      const g = r.def.slip;
      if (!g || g.carriageId !== roadId) continue;
      const range = g.kind === 'exit' ? [g.attach[0] - 6, g.nose + g.gore + RAIL_GAP] : [g.nose - g.gore - RAIL_GAP, g.attach[1] + 6];
      if (inStretch(p.wrapS(s), range, p.length, p.closed)) return true;
    }
    return false;
  };

  /** @type {Plaza[]} */
  const plazas = TOLLS.map((toll) => {
    const roadId = toll.road ? `${toll.road}-f` : 'c1-f';
    const targetFwd = /** @type {import('./roads.js').Road} */ (ground.roads.byId.get(roadId));
    const tHw = targetFwd.hw;
    const tHalf = /** @type {number} */ (targetFwd.def.median ?? 3.2) / 2 + tHw;
    const nLanes = targetFwd.def.lanes || LANES;
    const tLaneWidth = (tHw * 2) / nLanes;
    const h = targetFwd.path.nearest(toll.x, toll.z);
    targetFwd.path.sample(h.s, q);
    const x = q.x - q.tz * tHalf;
    const z = q.z + q.tx * tHalf;
    const lanes = [];
    for (const side of [1, -1]) {
      for (let i = 0; i < nLanes; i++) {
        lanes.push({ u: side * tHalf + (i - (nLanes - 1) / 2) * tLaneWidth, cash: i === nLanes - 1 });
      }
    }
    const dividers = [];
    for (const side of [1, -1]) for (let k = 1; k < nLanes; k++) dividers.push(side * tHalf + (k - nLanes / 2) * tLaneWidth);
    return {
      toll, x, z, y: targetFwd.heightAt(h.s), yaw: Math.atan2(q.tx, q.tz), carriageway: tHalf, laneWidth: tLaneWidth, lanes, dividers,
      s: h.s,
    };
  });
  const inPlaza = (x, z, reach) => plazas.some((pl) => Math.hypot(pl.x - x, pl.z - z) < reach);

  /** @type {Segment[]} */
  const barrier = [];
  /** @type {Segment[]} */
  const rails = [];
  const chunkOf = (s) => Math.floor(s / 180);

  for (const exp of ['c1', 'c2']) {
    const fwd = /** @type {import('./roads.js').Road} */ (ground.roads.byId.get(`${exp}-f`));
    const rev = /** @type {import('./roads.js').Road} */ (ground.roads.byId.get(`${exp}-r`));
    if (!fwd || !rev) continue;
    const hw = fwd.hw;
    const half = /** @type {number} */ (fwd.def.median ?? 3.2) / 2 + hw;
    const p = fwd.path;
    const chunkBase = exp === 'c1' ? 0 : 5000;

    for (let s = 0; s < p.length - SEGMENT / 2; s += SEGMENT) {
      const mid = s + SEGMENT / 2;
      p.sample(mid, q);
      const yaw = Math.atan2(q.tx, q.tz);
      const y = fwd.heightAt(mid);
      const chunk = chunkBase + chunkOf(mid);

      const mx = q.x - q.tz * half;
      const mz = q.z + q.tx * half;
      if (!inPlaza(mx, mz, PLAZA.reach)) {
        barrier.push({ x: mx, z: mz, y, yaw, len: SEGMENT, chunk });
        boxes.push({ x: mx, z: mz, hx: BARRIER.halfBase, hz: SEGMENT / 2, yaw, y0: y - 0.4, y1: y + BARRIER.height });
      }

      const edge = hw + RAIL.offset;
      const lx = q.tz;
      const lz = -q.tx;
      const rx = q.x + lx * edge;
      const rz = q.z + lz * edge;
      railSegment(rails, boxes, ground, hit, rx, rz, y, yaw, chunk, inPlaza(rx, rz, PLAZA.openRail) || rampOpen(`${exp}-f`, mid));
      const rp = rev.path.nearest(mx - q.tz * half, mz + q.tx * half);
      rev.path.sample(rp.s, q);
      const rEdge = hw + RAIL.offset;
      const ox = q.x + q.tz * rEdge;
      const oz = q.z - q.tx * rEdge;
      railSegment(rails, boxes, ground, hit, ox, oz, rev.heightAt(rp.s), Math.atan2(q.tx, q.tz), chunk + 10000, inPlaza(ox, oz, PLAZA.openRail) || rampOpen(`${exp}-r`, rp.s));
    }
  }

  const inTown = (x, z) => x > CITY.x0 && x < CITY.x1 && z > CITY.z0 && z < CITY.z1;
  let ruralRoadIndex = 0;
  for (const road of ground.roads.roads) {
    if (road.def.cls !== 'mountain' && road.def.cls !== 'forest' && road.def.cls !== 'arterial') continue;
    const p = road.path;
    const hw = road.hw;
    const edge = hw + RAIL.offset;
    ruralRoadIndex++;
    const chunkBase = 20000 + ruralRoadIndex * 200;

    for (let s = 0; s < p.length - SEGMENT / 2; s += SEGMENT) {
      const mid = s + SEGMENT / 2;
      p.sample(mid, q);
      if (road.def.cls === 'arterial' && inTown(q.x, q.z)) continue;
      if (road.lifted && road.liftAt(mid) > 1.2) continue;
      const y = road.heightAt(mid);
      const yaw = Math.atan2(q.tx, q.tz);
      const chunk = chunkBase + chunkOf(mid);

      for (const side of [1, -1]) {
        const lx = q.tz * side;
        const lz = -q.tx * side;
        const rx = q.x + lx * edge;
        const rz = q.z + lz * edge;
        const probeX = q.x + lx * (hw + 14);
        const probeZ = q.z + lz * (hw + 14);
        const gh = ground.hf.at(probeX, probeZ);
        if (Math.abs(y - gh) > 1.5) {
          railSegment(rails, boxes, ground, hit, rx, rz, y, yaw, chunk + (side > 0 ? 0 : 100), false);
        }
      }
    }
  }

  // Slip roads carry a rail on their outer edge, carrying on the carriageway's rail line as the
  // ramp widens out of it, up to where the ramp meets the avenue.
  let rampIndex = 0;
  for (const road of ground.roads.roads) {
    const g = road.def.slip;
    if (!g) continue;
    const p = road.path;
    const chunkBase = 40000 + rampIndex++ * 200;
    const [s0, s1] = g.kind === 'exit' ? [0, p.length - RAMP_RAIL_END] : [RAMP_RAIL_END, p.length];
    for (let s = s0; s < s1 - SEGMENT / 2; s += SEGMENT) {
      const mid = s + SEGMENT / 2;
      if (road.lifted && road.liftAt(mid) > 1.2) continue;
      p.sample(mid, q);
      const edge = road.hwAt(mid) + RAIL.offset;
      const rx = q.x + q.tz * edge;
      const rz = q.z - q.tx * edge;
      railSegment(rails, boxes, ground, hit, rx, rz, road.heightAt(mid), Math.atan2(q.tx, q.tz), chunkBase + chunkOf(mid), false, road);
    }
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

/**
 * A rail segment, unless something is in the way: a forecourt, or another road's surface
 * (an expressway's own skirt, or the skirt of the road the rail belongs to, is fine).
 * @param {import('./roads.js').Road} [own]
 */
function railSegment(rails, boxes, ground, hit, x, z, y, yaw, chunk, open, own) {
  if (open) return;
  for (const pad of ground.pads) if (padDistance(pad, x, z) < 7) return;
  const nz = ground.roads.query(x, z, hit, SKIRT);
  if (nz && hit.road !== own && hit.road.def.cls !== 'expressway') return;
  rails.push({ x, z, y, yaw, len: SEGMENT, chunk });
  boxes.push({ x, z, hx: 0.16, hz: SEGMENT / 2, yaw, y0: y - 0.4, y1: y + RAIL.high });
}
