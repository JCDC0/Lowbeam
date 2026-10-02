/**
 * The natural shape of the valley and the carved heightfield the game drives on.
 * Pure: the mesh in build-terrain.js and the physics both read the same samples, and
 * both split each cell along the same diagonal, so what you see is what you hit.
 */

import { fbm } from '../core/rng.js';
import { smoothstep, lerp } from '../core/mathx.js';
import { LAKE, WORLD_HALF } from './layout.js';

export const CELL = 6.25;
export const GRID = Math.round((WORLD_HALF * 2) / CELL) + 1;

/** Valley floor, a ring of mountains, a lake. Before any road is cut. */
export function baseHeight(x, z) {
  const wx = x + 70 * fbm(x * 0.0021, z * 0.0021, 11, 2);
  const wz = z + 70 * fbm(x * 0.0021 + 5.3, z * 0.0021, 12, 2);
  const r = Math.hypot(wx, wz * 1.04);
  const m = smoothstep(560, 960, r);
  const ridges = 0.75 + 0.6 * fbm(x * 0.0042, z * 0.0042, 21, 4);
  let h = 3.5 + 3.5 * fbm(x * 0.003, z * 0.003, 31, 3);
  h += m * m * 85 * ridges + m * 20;
  h += m * 7 * fbm(x * 0.02, z * 0.02, 41, 2);

  const ld = Math.hypot(x - LAKE.x, z - LAKE.z);
  if (ld < LAKE.r) {
    const bed = -5 + 3 * smoothstep(0, LAKE.r, ld);
    h = lerp(bed, h, smoothstep(LAKE.r * 0.55, LAKE.r, ld));
  }
  return h;
}

/** A wide blur of baseHeight. Road profiles start from this so they never follow small bumps. */
export function blurredHeight(x, z) {
  const o = 22;
  let sum = 0;
  let wsum = 0;
  for (let j = -1; j <= 1; j++) {
    for (let i = -1; i <= 1; i++) {
      const w = (i === 0 ? 2 : 1) * (j === 0 ? 2 : 1);
      sum += baseHeight(x + i * o, z + j * o) * w;
      wsum += w;
    }
  }
  return sum / wsum;
}

export class Heightfield {
  constructor() {
    this.n = GRID;
    this.cell = CELL;
    this.half = WORLD_HALF;
    this.h = new Float32Array(GRID * GRID);
  }

  /** @param {number} i column index */
  vx(i) { return -this.half + i * this.cell; }
  /** @param {number} j row index */
  vz(j) { return -this.half + j * this.cell; }

  /** Height on the rendered triangle under (x, z). Diagonal runs from (i, j) to (i+1, j+1). */
  at(x, z) {
    const n = this.n;
    let fx = (x + this.half) / this.cell;
    let fz = (z + this.half) / this.cell;
    fx = Math.min(Math.max(fx, 0), n - 1.0001);
    fz = Math.min(Math.max(fz, 0), n - 1.0001);
    const i = Math.floor(fx);
    const j = Math.floor(fz);
    const u = fx - i;
    const v = fz - j;
    const h = this.h;
    const h00 = h[j * n + i];
    const h10 = h[j * n + i + 1];
    const h01 = h[(j + 1) * n + i];
    const h11 = h[(j + 1) * n + i + 1];
    if (u > v) return h00 + u * (h10 - h00) + v * (h11 - h10);
    return h00 + v * (h01 - h00) + u * (h11 - h01);
  }
}
