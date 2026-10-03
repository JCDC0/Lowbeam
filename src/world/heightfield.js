/**
 * The natural shape of Kurogane and the carved heightfield the game drives on.
 * Pure: the mesh in build-terrain.js and the physics both read the same samples, and
 * both split each cell along the same diagonal, so what you see is what you hit.
 */

import { fbm } from '../core/rng.js';
import { smoothstep, lerp } from '../core/mathx.js';
import { CITY, LAKES, PASS_PROFILE, SEA, WORLD_HALF } from './layout.js';

export const CELL = 8;
export const GRID = Math.round((WORLD_HALF * 2) / CELL) + 1;

/**
 * Distance outside a rounded rectangle (0 inside it).
 * @param {number} x @param {number} z @param {number} cx @param {number} cz
 * @param {number} hx @param {number} hz @param {number} r
 */
function outside(x, z, cx, cz, hx, hz, r) {
  const qx = Math.abs(x - cx) - (hx - r);
  const qz = Math.abs(z - cz) - (hz - r);
  return Math.max(0, Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0) - r);
}

/** Elevation of the pass ledge at the nearest point of its centre line, and how far away that point is. */
const ledge = { h: 0, d: 0 };
const PASS_BOX = PASS_PROFILE.reduce(
  (b, p) => ({ x0: Math.min(b.x0, p[0] - 430), x1: Math.max(b.x1, p[0] + 430), z0: Math.min(b.z0, p[1] - 430), z1: Math.max(b.z1, p[1] + 430) }),
  { x0: Infinity, x1: -Infinity, z0: Infinity, z1: -Infinity }
);
function passLedge(x, z) {
  if (x < PASS_BOX.x0 || x > PASS_BOX.x1 || z < PASS_BOX.z0 || z > PASS_BOX.z1) {
    ledge.d = Infinity;
    return ledge;
  }
  let best = Infinity;
  for (let i = 0; i + 1 < PASS_PROFILE.length; i++) {
    const a = PASS_PROFILE[i];
    const b = PASS_PROFILE[i + 1];
    const sx = b[0] - a[0];
    const sz = b[1] - a[1];
    const t = Math.max(0, Math.min(1, ((x - a[0]) * sx + (z - a[1]) * sz) / (sx * sx + sz * sz)));
    const d = Math.hypot(x - (a[0] + sx * t), z - (a[1] + sz * t));
    if (d < best) {
      best = d;
      ledge.h = a[2] + (b[2] - a[2]) * t;
    }
  }
  ledge.d = best;
  return ledge;
}

/**
 * Valley floors, the mountains around them, the bay and the lake. Before any road is cut.
 * Two valleys: the one Route 1 runs round (it reaches the sea in the south) and the forest
 * valley to the north. Everything away from them climbs into mountains.
 * @param {number} x @param {number} z
 */
export function baseHeight(x, z) {
  const wx = x + 80 * fbm(x * 0.0012, z * 0.0012, 11, 2);
  const wz = z + 80 * fbm(x * 0.0012 + 5.3, z * 0.0012, 12, 2);
  const dLoop = outside(wx, wz, 0, 1500, 2150, 2200, 500);
  const dForest = outside(wx, wz, 200, -1485, 1300, 865, 400);
  const d = Math.min(dLoop, dForest);
  const m = smoothstep(80, 850, d);

  let h = 5 + 4 * fbm(x * 0.0025, z * 0.0025, 31, 3);
  // The land rises gently from the bay toward the north.
  h += 26 * smoothstep(1900, -400, wz);
  // Rolling hills in the forest valley.
  const forest = 1 - smoothstep(0, 260, dForest);
  h += forest * (24 + 30 * fbm(x * 0.0035, z * 0.0035, 33, 3));
  const ridges = 0.5 + 0.5 * fbm(x * 0.0016, z * 0.0016, 21, 4);
  h += Math.pow(m, 1.5) * (110 + 330 * ridges) + m * 20;
  h += m * 9 * fbm(x * 0.02, z * 0.02, 41, 2);

  // The pass is cut into the mountain along a ledge at the height it was drawn at.
  const pl = passLedge(x, z);
  if (pl.d < 420) h = lerp(pl.h, h, smoothstep(60, 420, pl.d));

  // Downtown sits on a flat shelf.
  const cd = outside(x, z, (CITY.x0 + CITY.x1) / 2, (CITY.z0 + CITY.z1) / 2, (CITY.x1 - CITY.x0) / 2, (CITY.z1 - CITY.z0) / 2, 40);
  h = lerp(h, 6.5, 1 - smoothstep(0, 260, cd));

  // The bay.
  const sea = smoothstep(SEA.z - 60, SEA.z + 200, wz) * (1 - smoothstep(SEA.xMax - 200, SEA.xMax + 350, Math.abs(wx)));
  h = lerp(h, -9, sea);

  for (const lake of LAKES) {
    const ld = Math.hypot(x - lake.x, z - lake.z);
    if (ld < lake.r) {
      const bed = -5 + 3 * smoothstep(0, lake.r, ld);
      h = lerp(bed, h, smoothstep(lake.r * 0.55, lake.r, ld));
    }
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
