/**
 * The digital instrument screens, drawn on a canvas every time a reading changes:
 *
 * - `lcd`, the Tsurugi's modern cluster: black glass, the tach as a sweep of segments that turn red
 *   at the redline and flash at the shift point, the speed in big DSEG7 with its unlit segments
 *   ghosting behind, the gear in DSEG14 in a box, boost, fuel and temperature as thin bars, labels
 *   in Share Tech Mono, cyan and white.
 * - `vfd`, the Hikari's 1984 vacuum fluorescent display: dark green glass, a straight bar-graph tach
 *   across the top (green, then amber, then red), the speed in DSEG14 in cyan, the gear in amber, a
 *   TURBO lamp and a boost bar, fuel and temperature as short segment bars, every lit element with a
 *   soft glow and every unlit one faintly visible, the way the phosphor shows through.
 */

import { canvasTexture, makeCanvas } from '../render/textures.js';
import { paintScreen } from './instruments.js';

/** @typedef {import('./instruments.js').Reading} Reading */

/**
 * @param {'lcd' | 'vfd'} kind @param {import('./specs.js').CarSpec} spec
 * @param {number} aspect the pod's width over its height
 */
export function makeScreen(kind, spec, aspect) {
  const H = 128;
  const W = Math.round(H * aspect);
  const c = makeCanvas(W, H);
  const g = /** @type {CanvasRenderingContext2D} */ (c.getContext('2d'));
  const tex = canvasTexture(c);
  let key = '';
  return {
    tex,
    /** @param {Reading} r */
    draw(r) {
      const flash = (r.shift || r.limiter) && Math.floor(r.time * 10) % 2 === 0;
      const k = `${Math.round(r.kmh)}|${Math.round(r.rpm / 50)}|${r.gear}|${Math.round(r.boost * 20)}|${Math.round(r.fuel * 40)}|${Math.round(r.temp)}|${flash}|${r.warn}|${r.blown && Math.floor(r.time * 3) % 2}`;
      if (k === key) return;
      key = k;
      paintScreen(g, kind, W, H, r, spec);
      tex.needsUpdate = true;
    },
  };
}
