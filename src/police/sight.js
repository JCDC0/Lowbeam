/**
 * Line of sight for the police. Pure: the caller says what is solid at a point (buildings, the
 * hillside, a deck) and this walks the line between two eyes. The helicopter has its own test
 * (its searchlight against the skyline, heli.js).
 */

/** Eye heights above the road: the officer in the unit, and the part of the player's car they look for. */
export const EYE = 1.3;
export const TARGET = 0.9;
/** Meters between samples along the line. */
const STEP = 4;

/**
 * Whether nothing solid stands between `a` and `b`. `blocked(x, z, y)` says whether a point is
 * inside something that hides a car. The ends themselves are not tested (a car is never inside
 * itself), only the line between them.
 * @param {{ x: number, y: number, z: number }} a @param {{ x: number, y: number, z: number }} b
 * @param {(x: number, z: number, y: number) => boolean} blocked
 */
export function clearLine(a, b, blocked) {
  const ax = a.x;
  const ay = a.y + EYE;
  const az = a.z;
  const dx = b.x - ax;
  const dy = b.y + TARGET - ay;
  const dz = b.z - az;
  const n = Math.ceil(Math.hypot(dx, dz) / STEP);
  for (let i = 1; i < n; i++) {
    const t = i / n;
    if (blocked(ax + dx * t, az + dz * t, ay + dy * t)) return false;
  }
  return true;
}
