/**
 * The minimap's frame, pure so it can be tested: ahead of the car is up on the radar and its left is
 * left, so the map turns round the car. `toScreen` puts a world point on the canvas and `screenYaw`
 * turns a world heading (yaw 0 faces +Z, forward is (sin yaw, cos yaw)) into the canvas angle a shape
 * drawn pointing along +x must be rotated by to point the same way on the radar.
 *
 * The matrix is the canvas transform `setTransform(a, b, cc, d, e, f)`: x' = a x + cc z + e and
 * y' = b x + d z + f. A heading is a direction, so it goes through the same matrix without its
 * translation, as (sin yaw, cos yaw); an earlier version paired the terms the other way round and
 * showed a unit's heading plus the player's yaw instead of the difference, so every arrow and sight
 * cone turned with the player's car.
 *
 * @param {number} x @param {number} z the player's position @param {number} yaw the player's heading
 * @param {number} scale pixels per meter @param {number} radius the radar's radius in pixels (its center)
 */
export function radarFrame(x, z, yaw, scale, radius) {
  const c = Math.cos(yaw);
  const n = Math.sin(yaw);
  const a = -scale * c;
  const b = -scale * n;
  const cc = scale * n;
  const d = -scale * c;
  const e = radius - a * x - cc * z;
  const f = radius - b * x - d * z;
  return {
    a, b, cc, d, e, f,
    /** @param {number} wx @param {number} wz @returns {[number, number]} */
    toScreen: (wx, wz) => [a * wx + cc * wz + e, b * wx + d * wz + f],
    /** @param {number} wyaw */
    screenYaw: (wyaw) => Math.atan2(b * Math.sin(wyaw) + d * Math.cos(wyaw), a * Math.sin(wyaw) + cc * Math.cos(wyaw)),
  };
}

/** How far a chasing unit sees on a clear line, meters (`SIGHT_RANGE` in the director). */
export const CHASE_SIGHT = 150;
/** How far a patrol notices the player all round, meters. */
export const PATROL_NOTICE = 60;

/**
 * The sight to draw for a police marker: a chasing unit sees all round to its range (the fog
 * shortens it), a searching one only in the cone its marker brings, a patrol in a ring.
 * @param {{ active?: boolean, cone?: { r: number, half: number } }} m
 * @param {number} fogScale 1 when dry, less in rain (`weatherLook(weather).fogFar / FOG_DRY.far`)
 * @returns {{ r: number, half: number }}
 */
export function sightOf(m, fogScale) {
  if (m.active === false) return { r: PATROL_NOTICE * fogScale, half: Math.PI };
  if (m.cone) return m.cone;
  return { r: CHASE_SIGHT * fogScale, half: Math.PI };
}
