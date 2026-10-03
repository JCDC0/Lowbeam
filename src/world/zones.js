/**
 * Questions about places: which named zone a point is in, whether it is inside the
 * expressway loop, how close the city and the water are. Pure; the area name, the
 * ambience and the tree scatter all ask these.
 */

import { CITY, LAKES, SEA, ZONES } from './layout.js';
import { smoothstep } from '../core/mathx.js';

/** Corners of the Route 1 loop, close enough for an inside test. */
const LOOP_POLY = [
  [-1450, -200], [-300, -380], [1000, -290], [1850, 250], [1950, 800], [1900, 1400], [1750, 1800], [1350, 2060],
  [800, 2150], [0, 2170], [-800, 2150], [-1350, 2060], [-1700, 1800], [-1850, 1400], [-1900, 850], [-1800, 350], [-1650, 0],
];

/** True when (x, z) is inside the expressway loop. @param {number} x @param {number} z */
export function insideLoop(x, z) {
  let inside = false;
  for (let i = 0, j = LOOP_POLY.length - 1; i < LOOP_POLY.length; j = i++) {
    const [xi, zi] = LOOP_POLY[i];
    const [xj, zj] = LOOP_POLY[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

/** @param {import('./layout.js').Zone} zone @param {number} x @param {number} z @param {number} [margin] */
export function inZone(zone, x, z, margin = 0) {
  if (zone.rect) return x > zone.rect.x0 - margin && x < zone.rect.x1 + margin && z > zone.rect.z0 - margin && z < zone.rect.z1 + margin;
  if (zone.circle) return Math.hypot(x - zone.circle.x, z - zone.circle.z) < zone.circle.r + margin;
  return false;
}

/** The first zone containing the point, or null. @param {number} x @param {number} z */
export function zoneAt(x, z) {
  for (const zone of ZONES) if (inZone(zone, x, z)) return zone;
  return null;
}

/** 1 inside the city block, fading to 0 within 140 m of it. @param {number} x @param {number} z */
export function cityAmount(x, z) {
  const dx = Math.max(CITY.x0 - x, 0, x - CITY.x1);
  const dz = Math.max(CITY.z0 - z, 0, z - CITY.z1);
  return 1 - smoothstep(0, 140, Math.hypot(dx, dz));
}

/** How near water is: the lakes and the bay, 1 at the shore fading to 0 within 160 m. @param {number} x @param {number} z */
export function waterAmount(x, z) {
  let d = Infinity;
  for (const l of LAKES) d = Math.min(d, Math.hypot(x - l.x, z - l.z) - l.r);
  if (Math.abs(x) < SEA.xMax) d = Math.min(d, SEA.z + 80 - z);
  return 1 - smoothstep(0, 160, Math.max(0, d));
}
