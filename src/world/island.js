/**
 * The shape of Kurogane Island: the coast, and how far a point is inside it. Pure, and imports
 * nothing from layout.js (which re-exports `COAST`), so the layout can use it. The distance to
 * the polygon is precomputed on a coarse grid when the module loads and read back bilinearly,
 * because the terrain asks for it hundreds of thousands of times.
 */

import { fbm } from '../core/rng.js';

/**
 * The island's coast, clockwise from the north-west: everything outside it is sea. The bay
 * cuts into the south between the two southern headlands. island.js adds a little noise so the
 * shore is not made of straight lines, and heightfield.js drops the land into the water along it:
 * cliffs under the western mountains, a low shelf everywhere else.
 */
export const COAST = [
  [-2780, -2780], [-1900, -2900], [-900, -2860], [100, -2840], [900, -2640], [1500, -2700], [2050, -2840],
  [2560, -2760], [2860, -2420], [2820, -1800], [2700, -1100], [2780, -300], [2840, 500], [2760, 1300],
  [2700, 1900], [2760, 2500], [2620, 2880], [2330, 2860], [2240, 2560], [2050, 2470], [-2050, 2470],
  [-2240, 2560], [-2330, 2860], [-2620, 2880], [-2800, 2300], [-2860, 1400], [-2790, 400], [-2880, -700],
  [-2850, -1800],
];

const CELL = 24;
/** The grid covers the 6 km map and 200 m of sea round it. */
const OFF = 3200;
const N = Math.ceil((OFF * 2) / CELL) + 1;

/** Signed distance to the coast polygon: positive inside (on land), negative at sea. @param {number} x @param {number} z */
export function polygonDistance(x, z) {
  let best = Infinity;
  let inside = false;
  for (let i = 0, j = COAST.length - 1; i < COAST.length; j = i++) {
    const [ax, az] = COAST[j];
    const [bx, bz] = COAST[i];
    if (az > z !== bz > z && x < ((bx - ax) * (z - az)) / (bz - az) + ax) inside = !inside;
    const sx = bx - ax;
    const sz = bz - az;
    const t = Math.max(0, Math.min(1, ((x - ax) * sx + (z - az) * sz) / (sx * sx + sz * sz)));
    best = Math.min(best, Math.hypot(x - (ax + sx * t), z - (az + sz * t)));
  }
  return inside ? best : -best;
}

const grid = new Float32Array(N * N);
for (let j = 0; j < N; j++) {
  for (let i = 0; i < N; i++) {
    const x = -OFF + i * CELL;
    const z = -OFF + j * CELL;
    grid[j * N + i] = polygonDistance(x, z) + 45 * fbm(x * 0.004, z * 0.004, 91, 3);
  }
}

/**
 * Meters inland from the shore (negative out at sea), with the shore wiggled by noise.
 * @param {number} x @param {number} z
 */
export function inland(x, z) {
  let fx = (x + OFF) / CELL;
  let fz = (z + OFF) / CELL;
  fx = Math.min(Math.max(fx, 0), N - 1.001);
  fz = Math.min(Math.max(fz, 0), N - 1.001);
  const i = Math.floor(fx);
  const j = Math.floor(fz);
  const u = fx - i;
  const v = fz - j;
  const a = grid[j * N + i];
  const b = grid[j * N + i + 1];
  const c = grid[(j + 1) * N + i];
  const d = grid[(j + 1) * N + i + 1];
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
}
