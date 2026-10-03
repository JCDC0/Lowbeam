/**
 * The shape of Kurogane Island: how far a point is inside the coast (`COAST` in layout.js).
 * Pure. The distance to the polygon is precomputed on a coarse grid when the module loads and
 * read back bilinearly, because the terrain asks for it hundreds of thousands of times.
 */

import { fbm } from '../core/rng.js';
import { COAST, WORLD_HALF } from './layout.js';

const CELL = 24;
const OFF = WORLD_HALF + 200;
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
