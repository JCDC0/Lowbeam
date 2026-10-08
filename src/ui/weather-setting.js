/**
 * The weather and the time of day, saved in the store. Weather: clear (the default), drizzle, rain or
 * storm. Time: night (the default), dusk, dawn, day, or a cycle that runs the clock. Settings changes
 * them; `main.js` applies them to the world when the drive starts.
 */

import { store } from '../core/store.js';
import { isWeather } from '../render/weather.js';
import { HOURS, isTime } from '../render/daylight.js';

/** The saved weather. @returns {import('../render/weather.js').Weather} */
export function currentWeather() {
  const w = store.get('weather', /** @type {any} */ ('clear'));
  return isWeather(w) ? w : 'clear';
}

/** Saves the weather. @param {import('../render/weather.js').Weather} w */
export function saveWeather(w) {
  store.set('weather', w);
}

/** The saved time of day. @returns {import('../render/daylight.js').TimeSetting} */
export function currentTime() {
  const t = store.get('time', /** @type {any} */ ('night'));
  return isTime(t) ? t : 'night';
}

/** Saves the time of day. @param {import('../render/daylight.js').TimeSetting} t */
export function saveTime(t) {
  store.set('time', t);
}

/**
 * Puts a time setting on a world: a fixed hour, or the clock running.
 * @param {{ setTime: (h: number) => void, startCycle: () => void }} world
 * @param {import('../render/daylight.js').TimeSetting} t
 */
export function applyTime(world, t) {
  if (t === 'cycle') world.startCycle();
  else world.setTime(HOURS[t]);
}
