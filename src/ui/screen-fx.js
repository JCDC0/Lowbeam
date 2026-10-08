/**
 * The screen effects over the drive, each a toggle in Settings (on by default, saved in the store):
 * a fine fishnet over the HUD panels (`net`), a vignette that closes in with speed (`vignette`)
 * and a slight radial blur at very high speed (`blur`). The vignette and the blur are drawn by the
 * post pass in `render/stage.js`, so they take the dither like the rest of the frame; the net is
 * CSS on the panels, switched by a class on the body.
 */

import { store } from '../core/store.js';

/** @typedef {'net' | 'vignette' | 'blur'} ScreenFx */
export const SCREEN_FX = /** @type {ScreenFx[]} */ (['net', 'vignette', 'blur']);
const KEYS = { net: 'fxNet', vignette: 'fxVignette', blur: 'fxBlur' };

/** Speeds (km/h) where the vignette starts and is full. @type {[number, number]} */
export const VIGNETTE_KMH = [120, 260];
/** The same for the blur. @type {[number, number]} */
export const BLUR_KMH = [200, 300];

/** Whether an effect is on. @param {ScreenFx} fx */
export function fxOn(fx) {
  return store.get(KEYS[fx], /** @type {boolean} */ (true)) !== false;
}

/** Switches an effect and saves it. @param {ScreenFx} fx @param {boolean} [on] */
export function setFx(fx, on = !fxOn(fx)) {
  store.set(KEYS[fx], on);
  applyNet();
}

/** Puts the fishnet class on the body to match the setting. */
export function applyNet() {
  if (typeof document !== 'undefined') document.body.classList.toggle('hud-net', fxOn('net'));
}

/**
 * How strong the vignette and the blur are at a speed, 0 to 1 each, after the toggles.
 * @param {number} kmh @param {{ vignette?: boolean, blur?: boolean }} [on]
 */
export function speedFx(kmh, on = { vignette: fxOn('vignette'), blur: fxOn('blur') }) {
  const ramp = (/** @type {[number, number]} */ [a, b]) => Math.max(0, Math.min(1, (kmh - a) / (b - a)));
  const smooth = (t) => t * t * (3 - 2 * t);
  return { vignette: on.vignette ? smooth(ramp(VIGNETTE_KMH)) : 0, blur: on.blur ? smooth(ramp(BLUR_KMH)) : 0 };
}
