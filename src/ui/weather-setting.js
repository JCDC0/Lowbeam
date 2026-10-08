/**
 * The weather setting, saved in the store: clear (the default), drizzle, rain or storm. Settings
 * cycles it; `main.js` applies it to the world when the drive starts and when it changes.
 */

import { store } from '../core/store.js';
import { isWeather } from '../render/weather.js';

/** The saved weather. @returns {import('../render/weather.js').Weather} */
export function currentWeather() {
  const w = store.get('weather', /** @type {any} */ ('clear'));
  return isWeather(w) ? w : 'clear';
}

/** Saves the weather. @param {import('../render/weather.js').Weather} w */
export function saveWeather(w) {
  store.set('weather', w);
}
