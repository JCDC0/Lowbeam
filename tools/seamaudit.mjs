/**
 * Road seam audit (gate 3 of `docs/agents/tasks/BUGS.md`): where two road surfaces overlap or leave
 * a hole. It models what `build-roads.js` draws, from the same data: every road's ribbon is a
 * carriageway of half width `hwAt(s)` with a curb and a sidewalk of `walk` on each side; inside a
 * junction's stretch (`junctionSpans`) the sidewalks are dropped and the junction's patch
 * (`junctionOutline`) paves the crossing over both carriageways. A seam fault is one of:
 *
 * - `walk`: a sidewalk drawn across another road's carriageway at the same level (a street meeting
 *   another at a slant keeps its sidewalks past the stretch where they are dropped);
 * - `overlap`: two carriageways drawn over each other at the same level outside every junction
 *   patch (they z-fight, or one's paint shows through the other); a slip road and its carriageway
 *   share an edge on purpose and are left out;
 * - `hole`: inside a junction's stretch, where a sidewalk was dropped, a spot that no patch, no
 *   carriageway and no sidewalk covers;
 * - `step`: a junction's patch is laid flat at its highest road's height, so on a slope it stands
 *   above an arm where it meets it (or the arm above it): the height between them at the patch's edge.
 *
 * `node tools/seamaudit.mjs [n]` prints the counts and the worst places; `auditSeams` is pure and
 * `tests/island/seamaudit.test.mjs` runs it on the shared island.
 */

import { junctionOutline } from '../src/world/junctions.js';

const CELL = 16;
/** Two surfaces closer in height than this are at the same level (m). */
const LEVEL = 0.6;
/** A carriageway reaching less than this into another is a shared edge, not an overlap (m). */
const EDGE = 0.3;
/** A spot this far outside every patch is a hole; nearer, it is the patch's own edge (m). */
const HOLE = 0.25;
/** A patch edge this far above or below the road it meets is a step a car feels and a camera sees (m). */
const STEP = 0.15;

/**
 * @typedef {import('../src/world/roads.js').Road} Road
 * @typedef {{ kind: 'walk' | 'overlap' | 'hole' | 'step', road: string, other: string, s0: number, s1: number,
 *   x: number, z: number, y: number, depth: number }} Seam
 *   One fault along a stretch of `road` (s0 to s1), against `other` (the road it is drawn on, or the
 *   junction); `depth` how far it reaches into the other surface (m), the worst along the stretch
 */

/** Segments of every road, in a grid, for "which surfaces cover this point". @param {Road[]} roads */
function surfaceIndex(roads) {
  /** @type {Map<string, number[]>} */
  const grid = new Map();
  roads.forEach((road, ri) => {
    const p = road.path;
    const last = p.closed ? p.n : p.n - 1;
    for (let i = 0; i < last; i++) {
      const k = (i + 1) % p.n;
      const s = i * p.step;
      const hw = Math.max(road.hwAt(s), road.hwAt(Math.min(p.length, s + p.step)));
      const r = hw + road.walk + 1;
      const x0 = p.x[i], z0 = p.z[i], x1 = p.x[k], z1 = p.z[k];
      for (let cx = Math.floor((Math.min(x0, x1) - r) / CELL); cx <= Math.floor((Math.max(x0, x1) + r) / CELL); cx++) {
        for (let cz = Math.floor((Math.min(z0, z1) - r) / CELL); cz <= Math.floor((Math.max(z0, z1) + r) / CELL); cz++) {
          const key = `${cx},${cz}`;
          let a = grid.get(key);
          if (!a) grid.set(key, (a = []));
          a.push(ri, i);
        }
      }
    }
  });
  return grid;
}

/**
 * The seam faults of the island's roads.
 * @param {import('../src/world/ground.js').Ground} ground
 * @returns {Seam[]}
 */
export function auditSeams(ground) {
  const roads = ground.roads.roads;
  const grid = surfaceIndex(roads);
  const spans = ground.junctionSpans;
  const inSpan = (/** @type {Road} */ road, /** @type {number} */ s) => (spans.get(road) || []).some(([a, b]) => s >= a && s <= b);
  /** Pairs that meet on purpose: a slip road and its carriageway, and two slip roads off one carriageway. */
  const slipOf = (/** @type {Road} */ r) => r.def.slip?.carriageId;
  const related = (/** @type {Road} */ a, /** @type {Road} */ b) =>
    slipOf(a) === b.id || slipOf(b) === a.id || (slipOf(a) && slipOf(a) === slipOf(b)) || a.def.twin === b.id || b.def.twin === a.id;

  const patches = ground.junctions.map((j) => ({ j, o: junctionOutline(j) })).filter((p) => p.o);
  /** @type {Map<string, typeof patches>} */
  const patchGrid = new Map();
  for (const p of patches) {
    const r = Math.max(...p.o.pts.map(([x, z]) => Math.hypot(x - p.j.x, z - p.j.z)));
    for (let cx = Math.floor((p.j.x - r) / CELL); cx <= Math.floor((p.j.x + r) / CELL); cx++) {
      for (let cz = Math.floor((p.j.z - r) / CELL); cz <= Math.floor((p.j.z + r) / CELL); cz++) {
        const key = `${cx},${cz}`;
        if (!patchGrid.has(key)) patchGrid.set(key, []);
        patchGrid.get(key).push(p);
      }
    }
  }
  /** How far (x, z) lies outside the nearest patch at its level: 0 inside one, Infinity near none. */
  const patchGap = (x, z, y, level = LEVEL) => {
    let gap = Infinity;
    for (const { o } of patchGrid.get(`${Math.floor(x / CELL)},${Math.floor(z / CELL)}`) || []) {
      if (Math.abs(o.y - y) > level) continue;
      let inside = false;
      const pts = o.pts;
      for (let i = 0, k = pts.length - 1; i < pts.length; k = i++) {
        const [xi, zi] = pts[i];
        const [xk, zk] = pts[k];
        if ((zi > z) !== (zk > z) && x < ((xk - xi) * (z - zi)) / (zk - zi) + xi) inside = !inside;
        const dx = xk - xi, dz = zk - zi;
        const l2 = dx * dx + dz * dz;
        const t = l2 > 0 ? Math.max(0, Math.min(1, ((x - xi) * dx + (z - zi) * dz) / l2)) : 0;
        gap = Math.min(gap, Math.hypot(x - xi - t * dx, z - zi - t * dz));
      }
      if (inside) return 0;
    }
    return gap;
  };
  const inPatch = (x, z, y) => patchGap(x, z, y) === 0;

  /**
   * What covers (x, z) at height y: for each road but `self`, how far the point is inside its
   * carriageway (positive) and whether its sidewalk is drawn there.
   * @param {(road: Road, inside: number, walk: boolean, h: number) => void} visit
   */
  const cover = (x, z, y, self, visit) => {
    const a = grid.get(`${Math.floor(x / CELL)},${Math.floor(z / CELL)}`);
    if (!a) return;
    const best = new Map();
    for (let k = 0; k < a.length; k += 2) {
      const road = roads[a[k]];
      if (road === self) continue;
      const p = road.path;
      const i = a[k + 1];
      const j = (i + 1) % p.n;
      const dx = p.x[j] - p.x[i];
      const dz = p.z[j] - p.z[i];
      const l2 = dx * dx + dz * dz;
      const t = l2 > 0 ? Math.max(0, Math.min(1, ((x - p.x[i]) * dx + (z - p.z[i]) * dz) / l2)) : 0;
      const d = Math.hypot(x - p.x[i] - t * dx, z - p.z[i] - t * dz);
      const prev = best.get(road);
      if (prev && prev.d <= d) continue;
      best.set(road, { d, s: (i + t) * p.step, h: road.h[i] + (road.h[j] - road.h[i]) * t + 0.012 * road.priority });
    }
    for (const [road, { d, s, h }] of best) {
      if (Math.abs(h - y) > LEVEL) continue;
      const hw = road.hwAt(Math.min(s, road.path.length));
      if (d > hw + road.walk) continue;
      visit(road, hw - d, d > hw && road.walk > 0 && !inSpan(road, s), h);
    }
  };

  /** Faults collected per (kind, road, other) and run along s, then joined into stretches. */
  /** @type {Map<string, Seam>} */
  const open = new Map();
  /** @type {Seam[]} */
  const out = [];
  for (const { j, o } of patches) {
    for (const arm of j.arms) {
      const road = arm.road;
      const s = road.path.wrapS(arm.s + arm.dir * (j.r + 2.5));
      const q = road.path.sample(s);
      const step = o.y - (road.heightAt(s) + 0.012 * road.priority);
      if (Math.abs(step) > STEP) out.push({ kind: 'step', road: road.id, other: `junction (${j.x.toFixed(0)}, ${j.z.toFixed(0)})`, s0: s, s1: s, x: q.x, z: q.z, y: o.y, depth: Math.abs(step) });
    }
  }
  const note = (kind, road, other, s, x, z, y, depth) => {
    const key = `${kind}|${road.id}|${other}`;
    const f = open.get(key);
    if (f && s - f.s1 <= road.path.step * 3 + 0.01) {
      f.s1 = s;
      if (depth > f.depth) Object.assign(f, { x, z, y, depth });
      return;
    }
    const seam = { kind, road: road.id, other, s0: s, s1: s, x, z, y, depth };
    open.set(key, seam);
    out.push(seam);
  };

  for (const road of roads) {
    const p = road.path;
    const lift = 0.012 * road.priority;
    for (let i = 0; i < p.n; i++) {
      const s = i * p.step;
      if (!p.closed && s > p.length) break;
      const x = p.x[i];
      const z = p.z[i];
      const lx = p.tz[i];
      const lz = -p.tx[i];
      const h = road.h[i] + lift;
      const hw = road.hwAt(s);
      const dropped = inSpan(road, s);
      for (const side of [-1, 1]) {
        if (road.walk && !dropped) {
          for (const f of [0.3, 0.9]) {
            const d = hw + road.walk * f;
            const px = x + lx * d * side;
            const pz = z + lz * d * side;
            cover(px, pz, h + 0.16, road, (other, inside) => {
              if (inside > 0 && !related(road, other)) note('walk', road, other.id, s, px, pz, h, inside);
            });
          }
        }
        if (road.walk && dropped) {
          const d = hw + road.walk / 2;
          const px = x + lx * d * side;
          const pz = z + lz * d * side;
          const gap = patchGap(px, pz, h, Infinity);
          if (gap > HOLE) {
            let covered = false;
            cover(px, pz, h, road, (other, inside, walk) => { if (inside > 0 || walk) covered = true; });
            if (!covered) note('hole', road, 'junction', s, px, pz, h, gap);
          }
        }
      }
      for (const f of [-0.9, 0, 0.9]) {
        const px = x + lx * hw * f;
        const pz = z + lz * hw * f;
        if (inPatch(px, pz, h)) continue;
        cover(px, pz, h, road, (other, inside) => {
          if (inside > EDGE && !related(road, other) && road.id < other.id) note('overlap', road, other.id, s, px, pz, h, inside);
        });
      }
    }
  }
  return out.sort((a, b) => b.depth - a.depth);
}

/** Faults counted by kind. @param {Seam[]} list */
export function byKind(list) {
  /** @type {Record<string, number>} */
  const n = {};
  for (const f of list) n[f.kind] = (n[f.kind] || 0) + 1;
  return n;
}

if (import.meta.url === new URL(`file:///${process.argv[1].replace(/\\/g, '/')}`).href) {
  const { Ground } = await import('../src/world/ground.js');
  const t0 = performance.now();
  const g = new Ground();
  const t1 = performance.now();
  const list = auditSeams(g);
  const t2 = performance.now();
  console.log(`island ${((t1 - t0) / 1000).toFixed(1)} s, audit ${((t2 - t1) / 1000).toFixed(1)} s`);
  console.log(`${list.length} seam faults`, byKind(list));
  const limit = Number(process.argv[2]) || 40;
  for (const f of list.slice(0, limit)) {
    console.log(`${f.kind.padEnd(8)} ${f.road} s ${f.s0.toFixed(0)}-${f.s1.toFixed(0)} on ${f.other} at (${f.x.toFixed(1)}, ${f.y.toFixed(1)}, ${f.z.toFixed(1)}), ${f.depth.toFixed(2)} m`);
  }
}
