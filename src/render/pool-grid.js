/**
 * The grid half of the per-pixel light pools (see pools.js), pure so it can be tested: which
 * lights each cell of a grid over the map lists.
 */

/** @typedef {import('../world/scatter.js').BakeLight} BakeLight */

/** Meters per grid cell. */
export const POOL_CELL = 24;
/** Lights listed per cell, four to a texel. */
export const POOL_PER_CELL = 12;
/**
 * The lights each grid cell lists: every light whose range reaches the cell, the strongest at
 * the cell's middle first, at most POOL_PER_CELL. Pure, so it can be tested without a GPU.
 * @param {BakeLight[]} lights @param {number} half half the size of the area covered, meters
 * @returns {{ dims: number, x0: number, cells: Int32Array }} `cells[(cz * dims + cx) * POOL_PER_CELL + k]`, -1 when empty
 */
export function poolGrid(lights, half) {
  const x0 = -half;
  const dims = Math.ceil((half * 2) / POOL_CELL);
  /** @type {Map<number, { i: number, w: number }[]>} */
  const lists = new Map();
  lights.forEach((l, i) => {
    const r = l.range;
    const c0 = Math.max(0, Math.floor((l.x - r - x0) / POOL_CELL));
    const c1 = Math.min(dims - 1, Math.floor((l.x + r - x0) / POOL_CELL));
    const r0 = Math.max(0, Math.floor((l.z - r - x0) / POOL_CELL));
    const r1 = Math.min(dims - 1, Math.floor((l.z + r - x0) / POOL_CELL));
    const power = l.c[0] + l.c[1] + l.c[2];
    for (let cz = r0; cz <= r1; cz++) {
      for (let cx = c0; cx <= c1; cx++) {
        const mx = x0 + (cx + 0.5) * POOL_CELL;
        const mz = x0 + (cz + 0.5) * POOL_CELL;
        const nx = Math.max(Math.abs(l.x - mx) - POOL_CELL / 2, 0);
        const nz = Math.max(Math.abs(l.z - mz) - POOL_CELL / 2, 0);
        if (Math.hypot(nx, nz) >= r) continue;
        const key = cz * dims + cx;
        let list = lists.get(key);
        if (!list) lists.set(key, (list = []));
        list.push({ i, w: power * (1 - Math.min(1, Math.hypot(l.x - mx, l.z - mz) / (r + POOL_CELL))) });
      }
    }
  });
  const cells = new Int32Array(dims * dims * POOL_PER_CELL).fill(-1);
  for (const [key, list] of lists) {
    list.sort((a, b) => b.w - a.w);
    for (let k = 0; k < Math.min(POOL_PER_CELL, list.length); k++) cells[key * POOL_PER_CELL + k] = list[k].i;
  }
  return { dims, x0, cells };
}
