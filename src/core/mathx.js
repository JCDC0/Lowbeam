/** Small scalar helpers shared by pure modules. No three.js here, so tests stay headless. */

export const TAU = Math.PI * 2;

/** @param {number} v @param {number} lo @param {number} hi */
export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

/** @param {number} a @param {number} b @param {number} t */
export const lerp = (a, b, t) => a + (b - a) * t;

/** @param {number} e0 @param {number} e1 @param {number} x */
export function smoothstep(e0, e1, x) {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
}

/** Moves `v` toward `target` by at most `step`. */
export function approach(v, target, step) {
  if (v < target) return Math.min(v + step, target);
  return Math.max(v - step, target);
}

/** Frame-rate independent exponential smoothing toward a target. */
export const damp = (v, target, rate, dt) => lerp(v, target, 1 - Math.exp(-rate * dt));

/** Wraps an angle to (-PI, PI]. */
export function wrapAngle(a) {
  a = (a + Math.PI) % TAU;
  if (a < 0) a += TAU;
  return a - Math.PI;
}
