/**
 * The rules for the tail lamps of the player's car and the street racers: when they are on, and
 * how bright the light trail a fast car leaves behind is. Pure: `render/light-trails.js` draws the
 * trails, `vehicles/models.js` lights the lamps.
 */

/**
 * When a car runs with its lamps on: from dusk to dawn (`lamp` is the sky's lamp level, `skyLook`,
 * 0 by day and 1 at night; dusk is past 0.15 by 17:30) and in any rain (`wet`, `weatherLook`).
 */
export const LAMPS_ON = { lamp: 0.15, wet: 0.05 };

/**
 * A light trail (Jc, 2026-10-13): a fast car's tail lamps leave red streaks, the long exposure look
 * of a night racing game. They start at `from` m/s (100 km/h) and are full at `full` (180 km/h); a
 * point of the trail lives `life` seconds, so at full speed a trail is about 20 m long. `width` is
 * the half width at the lamp in meters, `spacing` the distance between the trail's points.
 */
export const TRAIL = { from: 27.8, full: 50, life: 0.4, width: 0.07, spacing: 0.7, brake: 1.35 };

/** @param {number} lamp the sky's lamp level @param {number} wet how wet the weather is */
export function tailLampsOn(lamp, wet) {
  return lamp > LAMPS_ON.lamp || wet > LAMPS_ON.wet;
}

/**
 * How bright a car's light trail is: 0 with its lamps off or below `TRAIL.from`, rising smoothly to
 * 1 at `TRAIL.full`, and brighter while it brakes.
 * @param {number} speed m/s @param {boolean} lampsOn @param {number} [brake] 0 to 1
 */
export function trailGlow(speed, lampsOn, brake = 0) {
  if (!lampsOn) return 0;
  const t = Math.min(1, Math.max(0, (speed - TRAIL.from) / (TRAIL.full - TRAIL.from)));
  return t * t * (3 - 2 * t) * (1 + (TRAIL.brake - 1) * brake);
}
