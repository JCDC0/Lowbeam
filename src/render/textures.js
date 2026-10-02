/**
 * Textures drawn in code on small canvases. No image files ship with the game.
 * Every texture is sRGB, nearest-filtered when magnified, and cached by key.
 */

import * as THREE from 'three';
import { makeRng } from '../core/rng.js';

/** @type {Map<string, THREE.Texture>} */
const cache = new Map();

/** @param {number} w @param {number} h */
export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

/**
 * Wraps a canvas as a texture.
 * @param {HTMLCanvasElement} c
 * @param {{ repeat?: boolean, mips?: boolean }} [opts]
 */
export function canvasTexture(c, { repeat = false, mips = false } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.NearestFilter;
  t.minFilter = mips ? THREE.NearestMipmapLinearFilter : THREE.NearestFilter;
  t.generateMipmaps = mips;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/**
 * @param {string} key
 * @param {() => THREE.Texture} make
 */
function cached(key, make) {
  let t = cache.get(key);
  if (!t) {
    t = make();
    cache.set(key, t);
  }
  return t;
}

/** Dark tinted glass with two diagonal highlight streaks. */
export function glassTexture() {
  return cached('glass', () => {
    const c = makeCanvas(32, 32);
    const g = c.getContext('2d');
    const grad = g.createLinearGradient(0, 0, 0, 32);
    grad.addColorStop(0, '#2a3442');
    grad.addColorStop(1, '#0e131b');
    g.fillStyle = grad;
    g.fillRect(0, 0, 32, 32);
    g.strokeStyle = 'rgba(190, 210, 230, 0.55)';
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(10, -2);
    g.lineTo(-6, 34);
    g.stroke();
    g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(19, -2);
    g.lineTo(3, 34);
    g.stroke();
    return canvasTexture(c);
  });
}

/**
 * Wheel face: black sidewall ring around a light rim with dark gaps between spokes.
 * The rim material color tints the light parts, so one texture serves gold, chrome and
 * dark rims. uv (0.5, 0.5) is the wheel center and radius 0.5 is the tire edge.
 * @param {'rally' | 'muscle' | 'exotic'} style
 */
export function rimTexture(style) {
  return cached(`rim-${style}`, () => {
    const S = 64;
    const c = makeCanvas(S, S);
    const g = c.getContext('2d');
    const m = S / 2;
    g.fillStyle = '#0c0c0c';
    g.fillRect(0, 0, S, S);
    const rimR = m * (style === 'muscle' ? 0.66 : 0.72);
    g.fillStyle = '#e6e6e6';
    g.beginPath();
    g.arc(m, m, rimR, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#1a1a1a';
    const spokes = style === 'rally' ? 6 : style === 'muscle' ? 5 : 10;
    const inner = style === 'muscle' ? rimR * 0.38 : rimR * 0.3;
    const outer = rimR * 0.86;
    const gap = style === 'rally' ? 0.55 : style === 'muscle' ? 0.42 : 0.2;
    for (let i = 0; i < spokes; i++) {
      const a = (i / spokes) * Math.PI * 2 + Math.PI / spokes;
      const span = (Math.PI / spokes) * gap * 2;
      g.beginPath();
      g.moveTo(m + Math.cos(a - span * 0.5) * inner, m + Math.sin(a - span * 0.5) * inner);
      g.arc(m, m, outer, a - span, a + span);
      g.lineTo(m + Math.cos(a + span * 0.5) * inner, m + Math.sin(a + span * 0.5) * inner);
      g.closePath();
      g.fill();
    }
    g.fillStyle = '#9a9a9a';
    g.beginPath();
    g.arc(m, m, rimR * 0.2, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#555';
    g.lineWidth = 1;
    g.beginPath();
    g.arc(m, m, rimR - 0.5, 0, Math.PI * 2);
    g.stroke();
    return canvasTexture(c);
  });
}

/**
 * License plate with a short text. Wide plates are the long European shape.
 * @param {string} text @param {boolean} [wide] @param {string} [bg] @param {string} [ink]
 */
export function plateTexture(text, wide = false, bg = '#e8e6d8', ink = '#1d3a24') {
  return cached(`plate-${text}-${wide}-${bg}-${ink}`, () => {
    const w = wide ? 96 : 64;
    const h = wide ? 22 : 32;
    const c = makeCanvas(w, h);
    const g = c.getContext('2d');
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);
    g.strokeStyle = ink;
    g.lineWidth = 2;
    g.strokeRect(1, 1, w - 2, h - 2);
    g.fillStyle = ink;
    g.font = `bold ${wide ? 14 : 15}px monospace`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, w / 2, h / 2 + 1);
    return canvasTexture(c);
  });
}

/** Soft dark ellipse for the blob shadow under a car. */
export function shadowTexture() {
  return cached('shadow', () => {
    const c = makeCanvas(32, 32);
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(16, 16, 2, 16, 16, 16);
    grad.addColorStop(0, 'rgba(0,0,0,0.85)');
    grad.addColorStop(0.6, 'rgba(0,0,0,0.6)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 32, 32);
    const t = canvasTexture(c);
    t.magFilter = THREE.LinearFilter;
    return t;
  });
}

/**
 * Speckled noise, used under road and terrain detail.
 * @param {string} key @param {number} size @param {string} base @param {[number, number, number][]} specks rgb triples
 * @param {number} density specks per pixel @param {number} seed
 */
export function noiseCanvas(key, size, base, specks, density, seed) {
  const c = makeCanvas(size, size);
  const g = c.getContext('2d');
  g.fillStyle = base;
  g.fillRect(0, 0, size, size);
  const rng = makeRng(seed);
  const n = Math.round(size * size * density);
  for (let i = 0; i < n; i++) {
    const [r, gg, b] = rng.pick(specks);
    const k = rng.range(0.8, 1.2);
    g.fillStyle = `rgb(${Math.min(255, r * k) | 0},${Math.min(255, gg * k) | 0},${Math.min(255, b * k) | 0})`;
    g.fillRect(rng.int(0, size - 1), rng.int(0, size - 1), 1, 1);
  }
  return c;
}

export { cached as cachedTexture };
