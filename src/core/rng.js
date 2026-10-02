/** Seeded randomness and value noise. Deterministic, so the valley is the same on every load. */

/**
 * mulberry32 generator.
 * @param {number} seed
 */
export function makeRng(seed) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    /** @param {number} lo @param {number} hi */
    range: (lo, hi) => lo + (hi - lo) * next(),
    /** Inclusive integer range. @param {number} lo @param {number} hi */
    int: (lo, hi) => lo + Math.floor(next() * (hi - lo + 1)),
    /** @template T @param {T[]} arr @returns {T} */
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    /** @param {number} p */
    chance: (p) => next() < p,
  };
}

/** @param {number} ix @param {number} iz @param {number} seed */
function hash2(ix, iz, seed) {
  let h = Math.imul(ix, 374761393) ^ Math.imul(iz, 668265263) ^ Math.imul(seed, 982451653);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Smooth value noise in [0, 1]. */
export function valueNoise(x, z, seed) {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx);
  const uz = fz * fz * (3 - 2 * fz);
  const a = hash2(ix, iz, seed);
  const b = hash2(ix + 1, iz, seed);
  const c = hash2(ix, iz + 1, seed);
  const d = hash2(ix + 1, iz + 1, seed);
  return a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz;
}

/** Fractal value noise in roughly [-1, 1]. */
export function fbm(x, z, seed, octaves = 4) {
  let sum = 0;
  let amp = 0.5;
  let freq = 1;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * (valueNoise(x * freq, z * freq, seed + i * 101) * 2 - 1);
    norm += amp;
    amp *= 0.5;
    freq *= 2.03;
  }
  return sum / norm;
}
