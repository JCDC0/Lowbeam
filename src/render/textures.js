/**
 * Textures drawn in code on small canvases. No image files ship with the game.
 * Every texture is sRGB, nearest-filtered when magnified, and cached by key.
 */

import * as THREE from 'three';
import { makeRng } from '../core/rng.js';
import { FONT } from './fonts.js';

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
    g.font = `bold ${wide ? 14 : 15}px ${FONT.mono}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, w / 2, h / 2 + 1);
    return canvasTexture(c);
  });
}

/** A lamp flare: a hot core and a soft halo, in the red channel (psxFlare tints it). */
export function flareTexture() {
  return cached('flare', () => {
    const c = makeCanvas(32, 32);
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    grad.addColorStop(0, 'rgb(255,0,0)');
    grad.addColorStop(0.22, 'rgb(240,0,0)');
    grad.addColorStop(0.45, 'rgb(80,0,0)');
    grad.addColorStop(1, 'rgb(0,0,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 32, 32);
    const t = canvasTexture(c);
    t.magFilter = THREE.LinearFilter;
    return t;
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

/**
 * Asphalt, 64 px across the road and 96 px along it. u spans the road edge to edge, one
 * tile is TILE meters long. Center line dashes and solid edge lines are painted in.
 */
export function asphaltTexture() {
  return cached('asphalt', () => {
    const c = noiseCanvas('asphalt', 64, '#55565b', [[92, 92, 96], [78, 78, 83], [104, 102, 100], [70, 70, 74]], 0.5, 11);
    const t = makeCanvas(64, 96);
    const g = t.getContext('2d');
    g.drawImage(c, 0, 0);
    g.drawImage(c, 0, 64);
    g.fillStyle = 'rgba(0,0,0,0.18)';
    g.fillRect(14, 0, 8, 96);
    g.fillRect(42, 0, 8, 96);
    g.fillStyle = '#d8d6cc';
    g.fillRect(2, 0, 2, 96);
    g.fillRect(60, 0, 2, 96);
    g.fillStyle = '#e8e4d8';
    g.fillRect(31, 8, 2, 40);
    return canvasTexture(t, { repeat: true, mips: true });
  });
}

/**
 * Asphalt for a carriageway of `lanes` lanes: solid edge lines, a dashed line between
 * lanes and a darker band where the tires run. With `lanes` 0, only the edge lines (a ramp).
 * @param {number} lanes
 */
export function laneAsphaltTexture(lanes) {
  return cached(`asphalt-lanes-${lanes}`, () => {
    const c = noiseCanvas('asphalt', 64, '#55565b', [[92, 92, 96], [78, 78, 83], [104, 102, 100], [70, 70, 74]], 0.5, 11);
    const t = makeCanvas(64, 96);
    const g = t.getContext('2d');
    g.drawImage(c, 0, 0);
    g.drawImage(c, 0, 64);
    const lane = 64 / Math.max(1, lanes || 2);
    g.fillStyle = 'rgba(0,0,0,0.18)';
    for (let i = 0; i < Math.max(1, lanes || 2); i++) {
      const mid = lane * (i + 0.5);
      g.fillRect(mid - 9, 0, 5, 96);
      g.fillRect(mid + 4, 0, 5, 96);
    }
    g.fillStyle = '#d8d6cc';
    g.fillRect(2, 0, 2, 96);
    g.fillRect(60, 0, 2, 96);
    g.fillStyle = '#e8e4d8';
    for (let i = 1; i < lanes; i++) g.fillRect(Math.round(lane * i) - 1, 8, 2, 40);
    return canvasTexture(t, { repeat: true, mips: true });
  });
}

/** Loose gravel with two darker wheel ruts and a lighter crown of loose stones. */
export function gravelTexture() {
  return cached('gravel', () => {
    const t = noiseCanvas('gravel', 64, '#6b6050', [[112, 102, 88], [94, 85, 72], [126, 118, 104], [82, 74, 63]], 0.6, 12);
    const g = t.getContext('2d');
    g.fillStyle = 'rgba(30,24,18,0.28)';
    g.fillRect(14, 0, 9, 64);
    g.fillRect(41, 0, 9, 64);
    g.fillStyle = 'rgba(170,160,140,0.18)';
    g.fillRect(27, 0, 10, 64);
    g.fillRect(0, 0, 5, 64);
    g.fillRect(59, 0, 5, 64);
    return canvasTexture(t, { repeat: true, mips: true });
  });
}

/** Concrete slabs with joints, one tile per 4 m. */
export function concreteTexture() {
  return cached('concrete', () => {
    const t = noiseCanvas('concrete', 32, '#8c8b86', [[150, 148, 142], [120, 118, 112], [100, 98, 94]], 0.4, 13);
    const g = t.getContext('2d');
    g.fillStyle = '#5c5b58';
    g.fillRect(0, 0, 32, 1);
    g.fillRect(0, 0, 1, 32);
    return canvasTexture(t, { repeat: true, mips: true });
  });
}

/** Corrugated sheet metal for warehouses and sheds: vertical ribs, a little rust and grime. */
export function metalTexture() {
  return cached('metal', () => {
    const c = makeCanvas(64, 64);
    const g = c.getContext('2d');
    g.fillStyle = '#9aa0a4';
    g.fillRect(0, 0, 64, 64);
    for (let x = 0; x < 64; x += 4) {
      g.fillStyle = '#b4babd';
      g.fillRect(x, 0, 1, 64);
      g.fillStyle = '#7c8286';
      g.fillRect(x + 2, 0, 1, 64);
    }
    const rng = makeRng(31);
    for (let i = 0; i < 40; i++) {
      g.fillStyle = rng.chance(0.5) ? 'rgba(120,80,50,0.25)' : 'rgba(40,40,40,0.2)';
      g.fillRect(rng.int(0, 63), rng.int(20, 63), rng.int(1, 3), rng.int(4, 18));
    }
    return canvasTexture(c, { repeat: true, mips: true });
  });
}

/** A roller shutter: horizontal slats, darker at the bottom. One tile is one door. */
export function shutterTexture() {
  return cached('shutter', () => {
    const c = makeCanvas(32, 32);
    const g = c.getContext('2d');
    g.fillStyle = '#8a8e92';
    g.fillRect(0, 0, 32, 32);
    for (let y = 0; y < 32; y += 2) {
      g.fillStyle = '#6a6e72';
      g.fillRect(0, y, 32, 1);
    }
    g.fillStyle = 'rgba(0,0,0,0.35)';
    g.fillRect(0, 26, 32, 6);
    g.fillStyle = '#3c3f42';
    g.fillRect(0, 0, 1, 32);
    g.fillRect(31, 0, 1, 32);
    return canvasTexture(c, { repeat: true, mips: true });
  });
}

/** Gravel and dirt for road skirts. */
export function shoulderTexture() {
  return cached('shoulder', () => canvasTexture(noiseCanvas('shoulder', 32, '#57503f', [[90, 82, 66], [70, 62, 50], [110, 104, 92]], 0.6, 14), { repeat: true, mips: true }));
}

/** Light gray speckle that modulates the terrain vertex colors. */
export function terrainTexture() {
  return cached('terrain', () => canvasTexture(noiseCanvas('terrain', 64, '#e4e4e4', [[255, 255, 255], [180, 180, 180], [205, 205, 205], [150, 150, 150]], 0.7, 15), { repeat: true, mips: true }));
}

/**
 * Building facades: 8 by 8 bays of 3 m. `map` is the wall with dark panes, `emissive`
 * holds the windows that are lit tonight.
 */
export function windowTextures() {
  const key = 'windows';
  const map = cached(`${key}-map`, () => {
    const c = makeCanvas(128, 128);
    const g = c.getContext('2d');
    g.fillStyle = '#c9c5bb';
    g.fillRect(0, 0, 128, 128);
    const rng = makeRng(21);
    for (let j = 0; j < 8; j++) {
      for (let i = 0; i < 8; i++) {
        g.fillStyle = rng.chance(0.5) ? '#20252c' : '#2b3038';
        g.fillRect(i * 16 + 3, j * 16 + 4, 10, 8);
        g.fillStyle = '#a8a49a';
        g.fillRect(i * 16, j * 16 + 14, 16, 2);
      }
    }
    return canvasTexture(c, { repeat: true, mips: true });
  });
  const emissive = cached(`${key}-emissive`, () => {
    const c = makeCanvas(128, 128);
    const g = c.getContext('2d');
    g.fillStyle = '#000';
    g.fillRect(0, 0, 128, 128);
    const rng = makeRng(22);
    const warm = ['#ffcf7a', '#ffd99a', '#ffbe5c', '#f0e0b0'];
    const cool = ['#bcd6ff', '#9ec2ff', '#d8e8ff'];
    for (let j = 0; j < 8; j++) {
      for (let i = 0; i < 8; i++) {
        if (!rng.chance(0.34)) continue;
        g.fillStyle = rng.chance(0.75) ? rng.pick(warm) : rng.pick(cool);
        g.fillRect(i * 16 + 3, j * 16 + 4, 10, 8);
        if (rng.chance(0.4)) {
          g.fillStyle = 'rgba(0,0,0,0.55)';
          g.fillRect(i * 16 + 3 + rng.int(0, 6), j * 16 + 4, 4, 8);
        }
      }
    }
    return canvasTexture(c, { repeat: true, mips: true });
  });
  return { map, emissive };
}

const SIGN_WORDS = ['ラーメン', 'カラオケ', '居酒屋', 'スナック', '喫茶', '薬局', 'ホテル', '寿司'];

/**
 * Eight vertical neon signs side by side, 32 by 128 px each. Colors follow
 * SIGN_COLORS in world/scatter.js.
 * @param {number[][]} colors linear rgb triples
 */
export function signAtlas(colors) {
  return cached('signs', () => {
    const c = makeCanvas(256, 128);
    const g = c.getContext('2d');
    g.fillStyle = '#000';
    g.fillRect(0, 0, 256, 128);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    SIGN_WORDS.forEach((word, i) => {
      const [r, gg, b] = colors[i % colors.length].map((v) => Math.round(Math.min(1, v) * 255));
      const x = i * 32;
      g.fillStyle = `rgb(${r * 0.18},${gg * 0.18},${b * 0.18})`;
      g.fillRect(x + 2, 2, 28, 124);
      g.strokeStyle = `rgb(${r},${gg},${b})`;
      g.lineWidth = 2;
      g.strokeRect(x + 3, 3, 26, 122);
      g.fillStyle = '#fff6ee';
      const chars = [...word];
      const step = Math.min(28, 112 / chars.length);
      g.font = `bold ${Math.round(step * 0.82)}px ${FONT.jp}`;
      chars.forEach((ch, k) => g.fillText(ch, x + 16, 64 + (k - (chars.length - 1) / 2) * step));
    });
    return canvasTexture(c);
  });
}

/**
 * Price sign panel for a gas station brand, 64 by 128 px.
 * @param {'kitsune' | 'hoshi'} brand
 */
export function brandTexture(brand) {
  return cached(`brand-${brand}`, () => {
    const c = makeCanvas(64, 128);
    const g = c.getContext('2d');
    const kitsune = brand === 'kitsune';
    g.fillStyle = kitsune ? '#e2561a' : '#1f4fb8';
    g.fillRect(0, 0, 64, 128);
    g.fillStyle = '#ffffff';
    if (kitsune) {
      g.beginPath();
      g.moveTo(14, 14); g.lineTo(24, 30); g.lineTo(40, 30); g.lineTo(50, 14); g.lineTo(48, 40); g.lineTo(32, 54); g.lineTo(16, 40);
      g.closePath();
      g.fill();
      g.fillStyle = '#e2561a';
      g.fillRect(24, 36, 4, 4);
      g.fillRect(36, 36, 4, 4);
    } else {
      g.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const r = i % 2 ? 9 : 22;
        g.lineTo(32 + Math.cos(a) * r, 34 + Math.sin(a) * r);
      }
      g.closePath();
      g.fill();
    }
    g.font = `bold 11px ${FONT.display}`;
    g.textAlign = 'center';
    g.fillStyle = '#ffffff';
    g.fillText(kitsune ? 'KITSUNE' : 'HOSHI', 32, 68);
    g.fillStyle = '#101010';
    g.fillRect(6, 78, 52, 42);
    g.font = `bold 14px ${FONT.seg7}`;
    g.fillStyle = '#ff5a2a';
    g.fillText('168', 32, 95);
    g.fillStyle = '#7dff6a';
    g.fillText('179', 32, 114);
    return canvasTexture(c);
  });
}

/** A lit shop front seen through the glass: shelves of goods and a frame, repeating every 4 m. */
export function shopTexture() {
  return cached('shopfront', () => {
    const c = makeCanvas(64, 64);
    const g = c.getContext('2d');
    g.fillStyle = '#fff2d6';
    g.fillRect(0, 0, 64, 64);
    for (let y = 16; y < 56; y += 13) {
      g.fillStyle = '#c8b89a';
      g.fillRect(2, y, 60, 3);
      for (let x = 4; x < 60; x += 7) {
        g.fillStyle = ['#d84a3a', '#3a7ad8', '#e8c040', '#5ab05a'][(x + y) % 4];
        g.fillRect(x, y - 7, 5, 7);
      }
    }
    g.fillStyle = '#3a3e44';
    g.fillRect(0, 0, 2, 64);
    g.fillRect(0, 0, 64, 4);
    return canvasTexture(c, { repeat: true });
  });
}

/** Words on the shop signboards, one per row of `shopSignAtlas`; the last row is the parking sign. */
export const SHOP_SIGNS = ['ラーメン', '居酒屋', '薬局', '書店', '喫茶', '理容', '酒', '寿司'];

/** Nine horizontal signboards, 128 by 32 px each, one per row: the shops, then a coin parking sign. */
export function shopSignAtlas() {
  return cached('shop-signs', () => {
    const c = makeCanvas(128, 288);
    const g = c.getContext('2d');
    const bg = ['#c81e1e', '#7a1414', '#1d7a3a', '#1d4fa6', '#5a3a22', '#2a2a2e', '#f2e8d0', '#f4f4f0'];
    const fg = ['#fff4d0', '#ffe08a', '#ffffff', '#ffffff', '#ffd9a0', '#ff5a5a', '#8a1414', '#c81e1e'];
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    SHOP_SIGNS.forEach((word, i) => {
      g.fillStyle = bg[i];
      g.fillRect(0, i * 32, 128, 32);
      g.fillStyle = 'rgba(255,255,255,0.35)';
      g.fillRect(2, i * 32 + 2, 124, 2);
      g.fillStyle = fg[i];
      g.font = `bold 22px ${FONT.jp}`;
      g.fillText(word, 64, i * 32 + 17);
    });
    g.fillStyle = '#1d4fa6';
    g.fillRect(0, 256, 128, 32);
    g.fillStyle = '#ffffff';
    g.fillRect(4, 259, 26, 26);
    g.fillStyle = '#1d4fa6';
    g.font = `24px ${FONT.impact}`;
    g.fillText('P', 17, 273);
    g.fillStyle = '#ffd23a';
    g.font = `bold 16px ${FONT.mono}`;
    g.fillText('24H  ¥300', 80, 273);
    return canvasTexture(c);
  });
}

/** Awning cloth: stripes that the vertex color tints, with a darker hem. */
export function awningTexture() {
  return cached('awning', () => {
    const c = makeCanvas(32, 16);
    const g = c.getContext('2d');
    for (let x = 0; x < 32; x += 8) {
      g.fillStyle = '#ffffff';
      g.fillRect(x, 0, 4, 16);
      g.fillStyle = '#b8b8b8';
      g.fillRect(x + 4, 0, 4, 16);
    }
    g.fillStyle = 'rgba(0,0,0,0.35)';
    g.fillRect(0, 13, 32, 3);
    return canvasTexture(c, { repeat: true });
  });
}

/** Dark timber lattice (koshi) for a machiya's front: close vertical slats over a dark gap. */
export function latticeTexture() {
  return cached('lattice', () => {
    const c = makeCanvas(32, 32);
    const g = c.getContext('2d');
    g.fillStyle = '#1a120c';
    g.fillRect(0, 0, 32, 32);
    for (let x = 0; x < 32; x += 4) {
      g.fillStyle = '#c8b090';
      g.fillRect(x, 0, 2, 32);
    }
    g.fillStyle = '#c8b090';
    g.fillRect(0, 0, 32, 2);
    return canvasTexture(c, { repeat: true });
  });
}

/** One parking bay, 2.5 m by 5 m: asphalt, a white line down its left side and a wheel stop. */
export function parkingTexture() {
  return cached('parking', () => {
    const c = makeCanvas(32, 64);
    const g = c.getContext('2d');
    g.fillStyle = '#3e3f43';
    g.fillRect(0, 0, 32, 64);
    const rng = makeRng(7);
    for (let i = 0; i < 160; i++) {
      g.fillStyle = rng.chance(0.5) ? '#46474b' : '#36373a';
      g.fillRect(rng.int(0, 31), rng.int(0, 63), 1, 1);
    }
    g.fillStyle = '#e8e8e2';
    g.fillRect(0, 0, 2, 64);
    g.fillStyle = '#d8b030';
    g.fillRect(8, 6, 16, 3);
    return canvasTexture(c, { repeat: true });
  });
}
