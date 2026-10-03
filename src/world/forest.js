/**
 * Where the trees go. Nine species grouped into habitats (valley floor, lake edge,
 * slopes, high ridge), stands that follow a noise field so a hillside reads as one kind
 * of forest, dense groves on the valley floor, and a forest belt around the map edge.
 * The belt has two staggered rows of overlapping trunks, the thicket, that no car fits
 * between, so the player cannot drive out of the valley. Pure: no three.js.
 */

import { CITY, LAKES, WATER_LEVEL, WORLD_HALF, SEED } from './layout.js';
import { insideLoop, cityAmount, zoneAt } from './zones.js';
import { makeRng, fbm, valueNoise } from '../core/rng.js';

/** @typedef {{ x: number, y: number, z: number, s: number, kind: number, tint: number, hue: number }} Tree */
/** @typedef {import('./ground.js').Ground} Ground */

/** Species, in the order the mesh builder indexes them. */
export const TREE = { spruce: 0, broadleaf: 1, sugi: 2, birch: 3, maple: 4, pine: 5, bamboo: 6, shrub: 7, snag: 8 };
export const TREE_COUNT = 9;
/** Trunk collider radius in meters per species. 0 means the car drives through (shrubs). */
export const TREE_RADIUS = [0.45, 0.5, 0.5, 0.3, 0.5, 0.5, 0.75, 0, 0.25];

/**
 * The edge belt, in Chebyshev distance from the center of the map (the world is a square).
 * `inner` is where the dense forest starts, `thicket` the band of the solid double row,
 * `rim` where the forest stops, a little inside the collision wall at the map edge.
 */
export const BELT = { inner: WORLD_HALF - 100, thicket: [WORLD_HALF - 73, WORLD_HALF - 61], rim: WORLD_HALF - 10 };
/** Collider radius of a thicket tree: trunk plus undergrowth. Rows 3 m apart leave 0.4 m gaps. */
export const THICKET_RADIUS = 1.3;
const THICKET_STEP = 3;

/** Habitat weights per species: spruce, broadleaf, sugi, birch, maple, pine, bamboo, shrub, snag. */
const HABITAT = {
  valley: [0.06, 0.3, 0.08, 0.16, 0.14, 0.1, 0.02, 0.13, 0.01],
  wet: [0.0, 0.2, 0.0, 0.2, 0.05, 0.05, 0.25, 0.25, 0.0],
  slope: [0.32, 0.06, 0.3, 0.06, 0.06, 0.1, 0.0, 0.06, 0.04],
  high: [0.45, 0.0, 0.25, 0.0, 0.0, 0.15, 0.0, 0.07, 0.08],
  belt: [0.34, 0.04, 0.4, 0.02, 0.02, 0.12, 0.04, 0.0, 0.02],
  forest: [0.2, 0.2, 0.22, 0.08, 0.1, 0.1, 0.03, 0.06, 0.01],
};

/** Scale range per species. */
const SIZE = [[0.8, 1.4], [0.8, 1.35], [0.9, 1.5], [0.8, 1.2], [0.8, 1.25], [0.85, 1.3], [0.85, 1.25], [0.7, 1.4], [0.8, 1.3]];

/** @param {number[]} w @param {number} u in [0, 1) */
function pickWeighted(w, u) {
  let sum = 0;
  for (const v of w) sum += v;
  let t = u * sum;
  for (let i = 0; i < w.length; i++) {
    t -= w[i];
    if (t < 0) return i;
  }
  return w.length - 1;
}

/** @param {number} x @param {number} z @param {number} h */
function habitat(x, z, h) {
  for (const lake of LAKES) if (Math.hypot(x - lake.x, z - lake.z) < lake.r + 90) return HABITAT.wet;
  if (insideLoop(x, z)) return HABITAT.valley;
  const zone = zoneAt(x, z);
  if (zone && zone.kind === 'forest') return HABITAT.forest;
  return h > 110 ? HABITAT.high : HABITAT.slope;
}

/**
 * One species for this spot: usually the local stand's species, sometimes any in the habitat.
 * @param {ReturnType<typeof makeRng>} rng @param {number[]} weights @param {number} x @param {number} z
 */
function pickSpecies(rng, weights, x, z) {
  const stand = valueNoise(x * 0.014, z * 0.014, 63);
  const dominant = pickWeighted(weights, Math.min(0.9999, stand));
  return rng.chance(0.62) ? dominant : pickWeighted(weights, rng.next());
}

/**
 * @param {ReturnType<typeof makeRng>} rng @param {number} kind @param {number} x @param {number} y
 * @param {number} z @param {number} [grow] size multiplier
 * @returns {Tree}
 */
function makeTree(rng, kind, x, y, z, grow = 1) {
  const [lo, hi] = SIZE[kind];
  return { x, y, z, s: rng.range(lo, hi) * grow, kind, tint: rng.range(0.75, 1.15), hue: rng.next() };
}

/**
 * Everything planted in the valley, in four passes: the open forest, groves, the belt
 * forest and the thicket. Colliders are appended to `circles`.
 * @param {Ground} ground
 * @param {{ x: number, z: number, w: number, d: number }[]} buildings
 * @param {{ x: number, z: number, r: number }[]} circles
 * @param {(ground: Ground, x: number, z: number, margin: number) => boolean} clear
 */
export function placeForest(ground, buildings, circles, clear) {
  /** @type {Tree[]} */
  const out = [];
  const add = (t, collide = true, radius = TREE_RADIUS[t.kind]) => {
    out.push(t);
    if (collide && radius > 0) circles.push({ x: t.x, z: t.z, r: radius * Math.min(1.25, t.s) });
  };
  // Buildings in a coarse grid, so a tree only looks at the few that are near it.
  const BCELL = 64;
  /** @type {Map<number, typeof buildings>} */
  const bgrid = new Map();
  for (const b of buildings) {
    const key = Math.floor(b.x / BCELL) * 100003 + Math.floor(b.z / BCELL);
    const list = bgrid.get(key);
    if (list) list.push(b);
    else bgrid.set(key, [b]);
  }
  const nearBuilding = (x, z) => {
    const cx = Math.floor(x / BCELL);
    const cz = Math.floor(z / BCELL);
    for (let j = cz - 1; j <= cz + 1; j++) {
      for (let i = cx - 1; i <= cx + 1; i++) {
        const list = bgrid.get(i * 100003 + j);
        if (list) for (const b of list) if (Math.hypot(b.x - x, b.z - z) < Math.max(b.w, b.d)) return true;
      }
    }
    return false;
  };
  const inTown = (x, z, m) => x > CITY.x0 - m && x < CITY.x1 + m && z > CITY.z0 - m && z < CITY.z1 + m;

  const rng = makeRng(SEED ^ 0x7ee5);
  const step = 9;
  const lim = WORLD_HALF - 15;
  for (let gz = -lim; gz < lim; gz += step) {
    for (let gx = -lim; gx < lim; gx += step) {
      const x = gx + rng.range(-3.5, 3.5);
      const z = gz + rng.range(-3.5, 3.5);
      if (Math.max(Math.abs(x), Math.abs(z)) > BELT.inner) continue;
      const dens = 0.5 + 0.5 * fbm(x * 0.006, z * 0.006, 77, 3);
      // Inside the loop it is farmland and suburbs with a tree here and there; outside it is forest.
      const want = Math.min(1, dens * (insideLoop(x, z) ? 0.22 : 1.25));
      if (rng.next() > want) continue;
      if (inTown(x, z, 15) || cityAmount(x, z) > 0.01) continue;
      const g = ground.at(x, z);
      if (g.road || g.pad || g.h < WATER_LEVEL + 0.8) continue;
      if (!clear(ground, x, z, 3.5) || nearBuilding(x, z)) continue;
      let kind = pickSpecies(rng, habitat(x, z, g.h), x, z);
      if (g.surface === 'rock') {
        if (rng.chance(0.55)) continue;
        if (rng.chance(0.3)) kind = TREE.snag;
      }
      add(makeTree(rng, kind, x, g.h - 0.1, z));
    }
  }

  placeGroves(ground, add, clear, nearBuilding, inTown);

  const gr = makeRng(SEED ^ 0xbe17);
  const side = BELT.inner;
  const edge = WORLD_HALF - 10;
  for (let gz = -edge; gz < edge; gz += 6) {
    for (let gx = -edge; gx < edge; gx += 6) {
      const x = gx + gr.range(-2.4, 2.4);
      const z = gz + gr.range(-2.4, 2.4);
      const m = Math.max(Math.abs(x), Math.abs(z));
      if (m < side || m > BELT.rim) continue;
      const g = ground.at(x, z);
      if (g.road || g.pad || g.h < WATER_LEVEL + 0.5) continue;
      add(makeTree(gr, pickSpecies(gr, HABITAT.belt, x, z), x, g.h - 0.1, z, 1.1));
    }
  }

  // The thicket: two staggered rows along a square ring, bigger trees, one big collider each.
  const rows = [BELT.thicket[0], BELT.thicket[1]];
  rows.forEach((rho, row) => {
    const perimeter = 8 * rho;
    const count = Math.floor(perimeter / THICKET_STEP);
    for (let i = 0; i < count; i++) {
      const s = ((i + (row ? 0.5 : 0)) * perimeter) / count;
      const [x, z] = ringPoint(rho, s);
      const g = ground.at(x, z);
      if (g.h < WATER_LEVEL - 0.5) continue;
      const kind = pickWeighted(HABITAT.belt, gr.next());
      const t = makeTree(gr, kind, x + gr.range(-0.3, 0.3), g.h - 0.1, z + gr.range(-0.3, 0.3), 1.35);
      out.push(t);
      circles.push({ x: t.x, z: t.z, r: THICKET_RADIUS });
    }
  });
  return out;
}

/**
 * Point at arc length s along the square ring of Chebyshev radius rho, starting at the
 * north-west corner and running clockwise (east along the north side).
 * @param {number} rho @param {number} s
 * @returns {[number, number]}
 */
export function ringPoint(rho, s) {
  const side = 2 * rho;
  const k = Math.floor(s / side) % 4;
  const u = s - Math.floor(s / side) * side;
  if (k === 0) return [-rho + u, -rho];
  if (k === 1) return [rho, -rho + u];
  if (k === 2) return [rho - u, rho];
  return [-rho, rho - u];
}

/** Planted stands on the valley floor. */
const GROVE_KINDS = [
  [TREE.broadleaf, TREE.maple, TREE.birch],
  [TREE.maple, TREE.maple, TREE.birch],
  [TREE.birch, TREE.birch, TREE.broadleaf],
  [TREE.bamboo, TREE.bamboo, TREE.shrub],
  [TREE.sugi, TREE.sugi, TREE.spruce],
  [TREE.pine, TREE.pine, TREE.shrub],
];

function placeGroves(ground, add, clear, nearBuilding, inTown) {
  const gr = makeRng(SEED ^ 0x9a0e);
  const groves = [];
  for (let tries = 0; tries < 1200 && groves.length < 36; tries++) {
    const x = gr.range(-1700, 1700);
    const z = gr.range(-150, 1950);
    const r = gr.range(34, 68);
    if (!insideLoop(x, z) || inTown(x, z, r + 40)) continue;
    if (groves.some((o) => Math.hypot(o.x - x, o.z - z) < o.r + r + 30)) continue;
    let ok = true;
    for (let a = 0; a < 8 && ok; a++) {
      const px = x + Math.cos((a * Math.PI) / 4) * r * 0.8;
      const pz = z + Math.sin((a * Math.PI) / 4) * r * 0.8;
      if (!clear(ground, px, pz, 10)) ok = false;
    }
    if (ok && clear(ground, x, z, 10)) groves.push({ x, z, r, kinds: GROVE_KINDS[groves.length % GROVE_KINDS.length] });
  }
  for (const gv of groves) {
    for (let gz = -gv.r; gz <= gv.r; gz += 4.6) {
      for (let gx = -gv.r; gx <= gv.r; gx += 4.6) {
        const x = gv.x + gx + gr.range(-1.6, 1.6);
        const z = gv.z + gz + gr.range(-1.6, 1.6);
        const d = Math.hypot(x - gv.x, z - gv.z) / gv.r;
        if (d > 1 || gr.next() < d * d * 0.8) continue;
        const g = ground.at(x, z);
        if (g.road || g.pad || g.h < WATER_LEVEL + 0.8) continue;
        if (!clear(ground, x, z, 5) || nearBuilding(x, z)) continue;
        add(makeTree(gr, gr.pick(gv.kinds), x, g.h - 0.1, z, 1 + (1 - d) * 0.25));
      }
    }
  }
}
