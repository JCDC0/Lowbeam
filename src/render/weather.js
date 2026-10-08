/**
 * The weather as numbers. Pure: `render/rain.js` draws the streaks and `world.js` applies the
 * fog and the wet roads from what `weatherLook` says. A weather is a name the settings offer and a
 * level from 0 (dry) to 1 (a storm); the level drives everything else.
 */

/** @typedef {'clear' | 'drizzle' | 'rain' | 'storm'} Weather */

/** The weathers in the order Settings cycles through them. @type {Weather[]} */
export const WEATHERS = ['clear', 'drizzle', 'rain', 'storm'];

/** The level of each weather. @type {Record<Weather, number>} */
export const LEVELS = { clear: 0, drizzle: 0.35, rain: 0.7, storm: 1 };

/** Rain streaks drawn at a level of 1. */
export const STREAKS = 3200;

/** The dry fog and the fog of a storm: distances in meters. */
export const FOG_DRY = { near: 30, far: 420 };
export const FOG_STORM = { near: 14, far: 230 };

const lerp = (a, b, t) => a + (b - a) * t;

/**
 * What a level of rain looks like.
 * @param {number} level 0 to 1
 * @returns {{ wet: number, fogNear: number, fogFar: number, streaks: number, fall: number, wind: number, alpha: number }}
 *   `wet` how soaked the roads are (they soak before the rain is heavy and stay so), the fog's
 *   distances, how many streaks are drawn, the fall speed (m/s), the sideways wind (m/s) and the
 *   streaks' brightness
 */
export function weatherLook(level) {
  const t = Math.max(0, Math.min(1, level));
  return {
    wet: Math.min(1, t * 1.6),
    fogNear: lerp(FOG_DRY.near, FOG_STORM.near, t),
    fogFar: lerp(FOG_DRY.far, FOG_STORM.far, t),
    streaks: Math.round(STREAKS * t),
    fall: lerp(11, 17, t),
    wind: lerp(0.5, 4, t),
    alpha: lerp(0.22, 0.5, t),
  };
}

/**
 * The next weather in the cycle. @param {Weather} w
 * @param {number} [step] 1 forward, -1 back
 */
export function nextWeather(w, step = 1) {
  const i = WEATHERS.indexOf(w);
  return WEATHERS[(Math.max(0, i) + step + WEATHERS.length) % WEATHERS.length];
}

/** Whether a stored value names a weather. @param {any} w @returns {w is Weather} */
export function isWeather(w) {
  return WEATHERS.includes(w);
}
