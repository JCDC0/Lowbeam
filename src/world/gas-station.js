/**
 * The gas stations, built like the Japanese ones (and in the same hand as the toll plazas, after
 * concepts/gasorinsutando.jpeg): a deep canopy with a lit fascia band in the brand's colors over a
 * white slatted ceiling with boxy square lamps; the dispensers hang from it, a sign box over each
 * pump with the brand's swoosh and its fuel in its color (ハイオク yellow, レギュラー red, 軽油 green)
 * and a lane number, coiled hoses dropping to colored nozzles at the car's side; low islands with a
 * payment post, striped ends and bollards; the lanes painted red-brown; a price pylon by the road
 * (the brand, then regular, high octane and diesel); a kiosk with a glass shop front, a service bay
 * under a yellow タイヤ オイル バッテリー sign with a tire rack beside it, a wash banner, a lit band,
 * vending machines and the entrance and exit boards. The service park (G3) keeps its small
 * canopy, rally tents, floodlights and two rival cars. Built in pad-local coordinates: u along the
 * road, v away from it; positions come from `stationLayout` and `placeStation` in scatter.js.
 */

import * as THREE from 'three';
import { MeshBuilder } from '../render/builder.js';
import { psxBasic, psxLambert } from '../render/psx.js';
import { bakeGeometry } from '../render/bake.js';
import { canvasTexture, makeCanvas, shopTexture } from '../render/textures.js';
import { FONT } from '../render/fonts.js';
import { CarModel } from '../vehicles/models.js';
import { CARS } from '../vehicles/specs.js';
import { padPoint } from './scatter.js';

/** @typedef {[number, number, number]} V3 */

const BRAND = {
  kitsune: { color: 0xe2561a, css: '#e2561a', dark: '#8a2e0a', name: 'KITSUNE', jp: 'きつね石油' },
  hoshi: { color: 0x1f4fb8, css: '#1f4fb8', dark: '#0d2a66', name: 'HOSHI', jp: 'ほし石油' },
};
const TENT = [0xc8202a, 0xe8e8e8, 0x1d4fb0];
const JP = FONT.jp;
/** Pump prices in yen per liter: regular, high octane, diesel. */
const PRICES = [168, 179, 148];

/** Where each picture sits in a brand's atlas, in canvas pixels: x, y, w, h. */
const TILE = {
  pylon: [0, 0, 128, 448], pump: [128, 0, 64, 64], vendRed: [192, 0, 64, 128], vendBlue: [256, 0, 64, 128],
  in: [320, 0, 128, 64], out: [320, 64, 128, 64], hazard: [448, 0, 64, 64], logo: [128, 64, 64, 64],
  hang0: [192, 192, 256, 48], hang1: [192, 240, 256, 48], hang2: [192, 288, 256, 48], hang3: [192, 336, 256, 48],
  pit: [128, 400, 384, 48], banner: [128, 448, 384, 48], bay: [448, 64, 64, 64],
};
/** The fuels over the pumps in turn: name, panel color, text color, nozzle material. */
const FUELS = [['ハイオク', '#f2c51c', '#2a1a0a', 'yel'], ['レギュラー', '#d42a24', '#ffffff', 'red'], ['軽油', '#1d7a3a', '#ffffff', 'grn']];
const ATLAS = 512;
/** @param {keyof typeof TILE} name */
function uvOf(name) {
  const [x, y, w, h] = TILE[name];
  return [x / ATLAS, 1 - (y + h) / ATLAS, (x + w) / ATLAS, 1 - y / ATLAS];
}

/** The brand's emblem: a fox head or a star. @param {CanvasRenderingContext2D} g */
function emblem(g, brand, cx, cy, s) {
  g.beginPath();
  if (brand === 'kitsune') {
    for (const [x, y] of [[-0.55, -0.6], [-0.25, -0.1], [0.25, -0.1], [0.55, -0.6], [0.5, 0.15], [0, 0.6], [-0.5, 0.15]]) g.lineTo(cx + x * s, cy + y * s);
  } else {
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const r = i % 2 ? 0.25 : 0.62;
      g.lineTo(cx + Math.cos(a) * r * s, cy + Math.sin(a) * r * s);
    }
  }
  g.closePath();
  g.fill();
}

/** A white canopy ceiling of linear slats, one slat every 0.25 m. */
function slatTexture() {
  const c = makeCanvas(8, 16);
  const g = /** @type {CanvasRenderingContext2D} */ (c.getContext('2d'));
  g.fillStyle = '#eef0f0';
  g.fillRect(0, 0, 8, 16);
  g.fillStyle = '#b8bcbe';
  g.fillRect(0, 0, 8, 1);
  g.fillRect(0, 8, 8, 1);
  return canvasTexture(c, { repeat: true });
}

/** @type {Map<string, { atlas: THREE.Texture, fascia: THREE.Texture }>} */
const textures = new Map();
/** The brand's atlas (pylon, pump display, vending machines, boards, hazard) and its fascia band. @param {string} brand */
function brandTextures(brand) {
  const hit = textures.get(brand);
  if (hit) return hit;
  const B = BRAND[brand];
  const c = makeCanvas(ATLAS, ATLAS);
  const g = /** @type {CanvasRenderingContext2D} */ (c.getContext('2d'));
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  {
    const [x, y, w, h] = TILE.pylon;
    g.fillStyle = '#1a1c1f';
    g.fillRect(x, y, w, h);
    g.fillStyle = B.css;
    g.fillRect(x + 4, y + 4, w - 8, 120);
    g.fillStyle = '#ffffff';
    emblem(g, brand, x + w / 2, y + 52, 70);
    g.font = `20px ${FONT.impact}`;
    g.fillText(B.name, x + w / 2, y + 108);
    g.fillStyle = '#f4f4f0';
    g.fillRect(x + 4, y + 130, w - 8, 44);
    g.fillStyle = '#c81e1e';
    g.font = `bold 26px ${JP}`;
    g.fillText('セルフ', x + w / 2, y + 152);
    const rows = [['レギュラー', '#ff3a2a'], ['ハイオク', '#ffd23a'], ['軽油', '#3aff7a']];
    rows.forEach(([label, color], i) => {
      const ry = y + 184 + i * 84;
      g.fillStyle = '#0c0d0f';
      g.fillRect(x + 6, ry, w - 12, 78);
      g.fillStyle = '#e8eaec';
      g.font = `bold 17px ${JP}`;
      g.fillText(label, x + w / 2, ry + 15);
      g.fillStyle = color;
      g.font = `bold 34px ${FONT.seg7}`;
      g.fillText(String(PRICES[i]), x + w / 2, ry + 52);
    });
    g.fillStyle = B.css;
    g.fillRect(x + 4, y + h - 14, w - 8, 10);
  }
  {
    const [x, y, w, h] = TILE.pump;
    g.fillStyle = '#0e1012';
    g.fillRect(x, y, w, h);
    g.fillStyle = '#3aff7a';
    g.font = `bold 20px ${FONT.seg7}`;
    g.fillText(String(PRICES[0]), x + w / 2, y + 22);
    g.fillStyle = '#ff9a3a';
    g.font = `13px ${FONT.seg7}`;
    g.fillText('0.00 L', x + w / 2, y + 48);
  }
  /** @type {[string, string, string[]][]} */
  const machines = [['vendRed', '#c41a1a', ['#f2f2f2', '#e8c020', '#2a8a3a']], ['vendBlue', '#1a4ab0', ['#f2f2f2', '#d84a2a', '#e8e8a0']]];
  for (const [tile, body, rowsColor] of machines) {
    const [x, y, w, h] = TILE[/** @type {keyof typeof TILE} */ (tile)];
    g.fillStyle = body;
    g.fillRect(x, y, w, h);
    g.fillStyle = '#eef6ff';
    g.fillRect(x + 5, y + 6, w - 10, 66);
    for (let r = 0; r < 4; r++) {
      for (let k = 0; k < 5; k++) {
        g.fillStyle = rowsColor[(r + k) % 3];
        g.fillRect(x + 8 + k * 10, y + 10 + r * 16, 7, 11);
      }
    }
    g.fillStyle = '#101214';
    g.fillRect(x + 8, y + 82, w - 16, 10);
    g.fillRect(x + 36, y + 100, 18, 20);
  }
  for (const [tile, text, sub, fill] of [['in', '入口', 'IN', '#1d7a3a'], ['out', '出口', 'OUT', '#b02020']]) {
    const [x, y, w, h] = TILE[/** @type {keyof typeof TILE} */ (tile)];
    g.fillStyle = '#f4f4f0';
    g.fillRect(x, y, w, h);
    g.fillStyle = fill;
    g.fillRect(x + 4, y + 4, w - 8, h - 8);
    g.fillStyle = '#ffffff';
    g.font = `bold 30px ${JP}`;
    g.fillText(text, x + 44, y + h / 2 + 1);
    g.font = `bold 18px ${FONT.mono}`;
    g.fillText(sub, x + 100, y + h / 2 + 1);
  }
  {
    const [x, y, w, h] = TILE.hazard;
    g.fillStyle = '#f2c51c';
    g.fillRect(x, y, w, h);
    g.save();
    g.beginPath();
    g.rect(x, y, w, h);
    g.clip();
    g.fillStyle = '#141414';
    for (let k = -h; k < w; k += 16) {
      g.beginPath();
      g.moveTo(x + k, y + h);
      g.lineTo(x + k + 8, y + h);
      g.lineTo(x + k + 8 + h, y);
      g.lineTo(x + k + h, y);
      g.closePath();
      g.fill();
    }
    g.restore();
  }
  {
    const [x, y, w, h] = TILE.logo;
    g.fillStyle = B.css;
    g.fillRect(x, y, w, h);
    g.fillStyle = '#ffffff';
    emblem(g, brand, x + w / 2, y + h / 2, 44);
  }
  // The hanging dispensers' sign faces: the brand's swoosh, then the fuel in its color and a number.
  for (let k = 0; k < 4; k++) {
    const [x, y, w, h] = TILE[/** @type {keyof typeof TILE} */ (`hang${k}`)];
    const [fuel, panel, ink] = FUELS[k % 3];
    g.fillStyle = '#f4f4f2';
    g.fillRect(x, y, w, h);
    g.fillStyle = B.css;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + 120, y);
    g.lineTo(x + 92, y + h);
    g.lineTo(x, y + h);
    g.closePath();
    g.fill();
    g.fillStyle = B.dark;
    g.beginPath();
    g.moveTo(x + 64, y + h);
    g.quadraticCurveTo(x + 84, y + 10, x + 120, y);
    g.lineTo(x + 104, y);
    g.quadraticCurveTo(x + 72, y + 12, x + 52, y + h);
    g.closePath();
    g.fill();
    g.fillStyle = '#ffffff';
    g.textAlign = 'left';
    g.font = `15px ${FONT.impact}`;
    g.fillText(B.name, x + 8, y + 16);
    g.fillStyle = panel;
    g.fillRect(x + 126, y + 20, w - 130, h - 24);
    g.fillStyle = '#141414';
    g.fillRect(x + 104, y + 20, 22, h - 24);
    g.fillStyle = '#ffffff';
    g.textAlign = 'center';
    g.font = `20px ${FONT.impact}`;
    g.fillText(String(k + 1), x + 115, y + 34);
    g.fillStyle = ink;
    g.font = `bold 20px ${JP}`;
    g.fillText(fuel, x + 126 + (w - 130) / 2, y + 34);
  }
  {
    const [x, y, w, h] = TILE.pit;
    g.fillStyle = '#f2c51c';
    g.fillRect(x, y, w, h);
    g.fillStyle = '#141414';
    g.textAlign = 'left';
    g.font = `bold 30px ${JP}`;
    g.fillText('タイヤ オイル バッテリー', x + 10, y + h / 2 + 1);
    g.fillRect(x + 284, y + 4, w - 288, h - 8);
    g.fillStyle = '#ffffff';
    g.textAlign = 'center';
    g.font = `18px ${FONT.impact}`;
    g.fillText('PRO PIT', x + 284 + (w - 288) / 2, y + h / 2 + 1);
  }
  {
    const [x, y, w, h] = TILE.banner;
    g.fillStyle = '#f2d21c';
    g.fillRect(x, y, w, h);
    g.fillStyle = '#1d4fa6';
    g.fillRect(x + 6, y + 6, 96, h - 12);
    g.fillStyle = '#ffffff';
    g.font = `bold 20px ${JP}`;
    g.fillText('洗車', x + 54, y + h / 2 + 1);
    g.fillStyle = '#141414';
    g.font = `bold 22px ${JP}`;
    g.fillText('コーティング 受付中', x + 240, y + h / 2 + 1);
  }
  {
    // The service bay seen from outside: a lit workshop with a lift and shelves at the back.
    const [x, y, w, h] = TILE.bay;
    g.fillStyle = '#d8dcd8';
    g.fillRect(x, y, w, h);
    g.fillStyle = '#9aa0a4';
    g.fillRect(x, y + 46, w, 18);
    g.fillStyle = '#c81e1e';
    g.fillRect(x + 6, y + 12, 12, 10);
    g.fillRect(x + 22, y + 12, 12, 10);
    g.fillStyle = '#3a3e44';
    g.fillRect(x + 40, y + 6, 20, 40);
    g.fillStyle = '#f2c51c';
    g.fillRect(x + 8, y + 40, 26, 4);
  }
  const atlas = canvasTexture(c);

  // The fascia band: white, a brand stripe along the bottom, the emblem and the name every 9 m.
  const f = makeCanvas(256, 64);
  const fg = /** @type {CanvasRenderingContext2D} */ (f.getContext('2d'));
  fg.fillStyle = '#f2f4f6';
  fg.fillRect(0, 0, 256, 64);
  fg.fillStyle = B.css;
  fg.fillRect(0, 46, 256, 18);
  fg.fillStyle = B.dark;
  fg.fillRect(0, 0, 256, 3);
  fg.fillStyle = B.css;
  emblem(fg, brand, 34, 23, 36);
  fg.textBaseline = 'middle';
  fg.font = `22px ${FONT.impact}`;
  fg.textAlign = 'left';
  fg.fillText(B.name, 62, 24);
  const after = 62 + fg.measureText(B.name).width + 14;
  fg.font = `bold 18px ${JP}`;
  fg.fillStyle = '#2a2c30';
  fg.fillText(B.jp, after, 24);
  const fascia = canvasTexture(f, { repeat: true });
  const out = { atlas, fascia };
  textures.set(brand, out);
  return out;
}

/**
 * A transform whose local X runs along +u, Z along +v (away from the road) and Y up,
 * with the origin at the pad center on the pad surface. Returns the sign that turns u
 * into local x, since a right-handed frame forces X = Y x Z.
 * @param {import('./ground.js').Pad} pad
 */
function padFrame(pad) {
  const X = new THREE.Vector3(pad.vz, 0, -pad.vx);
  const Y = new THREE.Vector3(0, 1, 0);
  const Z = new THREE.Vector3(pad.vx, 0, pad.vz);
  const m = new THREE.Matrix4().makeBasis(X, Y, Z).setPosition(pad.cx, pad.h, pad.cz);
  return { m, su: Math.sign(pad.ux * X.x + pad.uz * X.z) || 1 };
}

/** Down-facing quad. x0 < x1, z0 < z1. @param {MeshBuilder} b @param {string} key */
function under(b, key, x0, x1, z0, z1, y) {
  b.quad(key, [x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1]);
}

/**
 * A picture across x at depth z, seen from -z (`f` -1, from the road) or from +z (`f` 1).
 * @param {MeshBuilder} b @param {string} key @param {number[]} [uv]
 */
function facing(b, key, x, y0, y1, z, w, f, uv) {
  const l = x - w / 2;
  const r = x + w / 2;
  if (f < 0) b.quad(key, [r, y0, z], [l, y0, z], [l, y1, z], [r, y1, z], uv);
  else b.quad(key, [l, y0, z], [r, y0, z], [r, y1, z], [l, y1, z], uv);
}

/**
 * A picture along z at x, seen from +x (`f` 1) or from -x (`f` -1).
 * @param {MeshBuilder} b @param {string} key @param {number[]} [uv]
 */
function sideways(b, key, x, y0, y1, z0, z1, f, uv) {
  if (f > 0) b.quad(key, [x, y0, z1], [x, y0, z0], [x, y1, z0], [x, y1, z1], uv);
  else b.quad(key, [x, y0, z0], [x, y0, z1], [x, y1, z1], [x, y1, z0], uv);
}

/**
 * A box whose sides show one atlas tile.
 * @param {MeshBuilder} b @param {string} key @param {keyof typeof TILE} tile
 */
function tileBox(b, key, x, y, z, sx, sy, sz, tile) {
  const r = uvOf(tile);
  const x0 = x - sx / 2, x1 = x + sx / 2, y0 = y - sy / 2, y1 = y + sy / 2, z0 = z - sz / 2, z1 = z + sz / 2;
  b.quad(key, [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], r);
  b.quad(key, [x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], r);
  b.quad(key, [x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], r);
  b.quad(key, [x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], r);
  b.quad(key, [x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], r);
}

/**
 * A band of fascia round a box from x0..x1, z0..z1, between heights y0 and y1, the texture repeating
 * every 9 m.
 * @param {MeshBuilder} b
 */
function band(b, key, x0, x1, z0, z1, y0, y1, out = 0.03) {
  const w = x1 - x0;
  const d = z1 - z0;
  facing(b, key, (x0 + x1) / 2, y0, y1, z0 - out, w, -1, [0, 0, w / 9, 1]);
  facing(b, key, (x0 + x1) / 2, y0, y1, z1 + out, w, 1, [0, 0, w / 9, 1]);
  sideways(b, key, x1 + out, y0, y1, z0, z1, 1, [0, 0, d / 9, 1]);
  sideways(b, key, x0 - out, y0, y1, z0, z1, -1, [0, 0, d / 9, 1]);
}

/**
 * @param {ReturnType<typeof import('./scatter.js').scatterWorld>['stations'][number]} st
 * @param {import('../render/bake.js').LightGrid} grid
 */
function buildStation(st, grid) {
  const pad = st.pad;
  const L = st.layout;
  const brand = pad.station.brand;
  const tex = brandTextures(brand);
  const { m, su } = padFrame(pad);
  const b = new MeshBuilder();
  b.pushMatrix(m);
  /** @param {number} u */
  const U = (u) => u * su;

  // The canopy: a deep body with the lit fascia round it, a brand-lit trim under the band, a dark
  // ceiling and its lamps.
  const c = L.canopy;
  const cu0 = Math.min(U(c.u0), U(c.u1));
  const cu1 = Math.max(U(c.u0), U(c.u1));
  const cw = cu1 - cu0;
  const cd = c.v1 - c.v0;
  const cx = (cu0 + cu1) / 2;
  const cz = (c.v0 + c.v1) / 2;
  const deep = L.tents.length ? 0.9 : 1.4;
  b.box('white', cx, c.h + deep / 2, cz, cw, deep, cd);
  band(b, 'fascia', cu0, cu1, c.v0, c.v1, c.h + 0.18, c.h + deep - 0.06);
  b.box('brandLit', cx, c.h + 0.09, cz, cw + 0.1, 0.18, cd + 0.1, { top: false });
  b.box('dark', cx, c.h + deep + 0.04, cz, cw + 0.12, 0.08, cd + 0.12);
  b.quad('ceiling', [cu0 + 0.05, c.h - 0.01, c.v0 + 0.05], [cu1 - 0.05, c.h - 0.01, c.v0 + 0.05], [cu1 - 0.05, c.h - 0.01, c.v1 - 0.05], [cu0 + 0.05, c.h - 0.01, c.v1 - 0.05], [0, 0, cw / 1.0, cd / 0.5]);
  // Boxy square fixtures, as in the reference: a steel housing with a lit lens under it.
  for (const l of st.canopyLights) {
    b.box('steel', U(l.u), c.h - 0.11, l.v, 1.0, 0.2, 1.0);
    under(b, 'lamp', U(l.u) - 0.42, U(l.u) + 0.42, l.v - 0.42, l.v + 0.42, c.h - 0.22);
  }
  for (const p of st.pillars) {
    b.box('brand', U(p.u), 0.65, p.v, 0.62, 1.3, 0.62);
    b.box('white', U(p.u), (c.h + 1.3) / 2, p.v, 0.55, c.h - 1.3, 0.55);
  }

  // Islands with striped ends and a bollard at each corner; the lanes either side painted red-brown.
  for (const isl of L.islands) {
    const ix = U(isl.u);
    if (!L.tents.length) {
      for (const side of [-1, 1]) {
        const lz = isl.v + side * 2.25;
        under(b, 'lane', ix - isl.len / 2 - 1.5, ix + isl.len / 2 + 1.5, lz + 1.45, lz - 1.45, 0.035);
      }
    }
    b.box('curb', ix, 0.12, isl.v, isl.len, 0.24, 1.4);
    for (const e of [-1, 1]) {
      tileBox(b, 'tex', ix + e * (isl.len / 2 - 0.25), 0.2, isl.v, 0.5, 0.4, 1.42, 'hazard');
      for (const dz of [-0.5, 0.5]) b.cylinder('yellow', ix + e * (isl.len / 2 - 0.15), 0.7, isl.v + dz, 0.09, 0.95, 6, 'y', { caps: true });
    }
  }

  // The dispensers hang from the canopy: a sign box across the island over each pump, its faces
  // toward the cars coming in along the island, two coiled hoses dropping over each lane to a
  // nozzle in the fuel's color. On the island under it only a payment post with a lit screen. The
  // service park keeps standing pumps under its small canopy.
  st.pumps.forEach((p, k) => {
    const px = U(p.u);
    const tile = /** @type {keyof typeof TILE} */ (`hang${k % 4}`);
    const nozzle = FUELS[k % 3][3];
    if (L.tents.length) {
      b.box('white', px, 1.25, p.v, 0.85, 1.7, 0.58);
      b.box('brand', px, 2.33, p.v, 0.95, 0.5, 0.64);
      for (const f of [-1, 1]) facing(b, 'atlas', px, 1.82, 2.16, p.v + f * 0.3, 0.62, f, uvOf('pump'));
      return;
    }
    const y0 = c.h - 1.25;
    b.box('white', px, y0 + 0.3, p.v, 0.7, 0.6, 2.7);
    for (const f of [-1, 1]) {
      sideways(b, 'atlas', px + f * 0.36, y0 + 0.04, y0 + 0.56, p.v - 1.32, p.v + 1.32, f, uvOf(tile));
      b.box('steel', px, (c.h + y0 + 0.6) / 2, p.v + f * 0.9, 0.08, c.h - y0 - 0.6, 0.08);
      // A coiled hose reads as a thick dark line with rings on it, then the nozzle.
      for (const du of [-0.18, 0.18]) {
        const hx = px + du;
        const hz = p.v + f * 1.15;
        b.box('hose', hx, (y0 + 1.25) / 2, hz, 0.05, y0 - 1.25, 0.05);
        for (let ry = 1.6; ry < y0 - 0.2; ry += 0.28) b.box('hose', hx, ry, hz, 0.13, 0.05, 0.13);
        b.box(nozzle, hx, 1.12, hz, 0.1, 0.28, 0.16);
        b.box('steel', hx, 0.94, hz + f * 0.06, 0.04, 0.1, 0.16);
      }
    }
    b.box('white', px, 0.85, p.v, 0.42, 1.2, 0.36);
    for (const f of [-1, 1]) facing(b, 'atlas', px, 1.0, 1.35, p.v + f * 0.19, 0.34, f, uvOf('pump'));
  });

  // The price pylon by the road.
  const sx = U(L.sign.u);
  const sz = L.sign.v;
  if (L.tents.length) {
    b.cylinder('steel', sx, 3.5, sz, 0.16, 7, 6, 'y', { caps: false });
    b.box('dark', sx, 8.6, sz, 1.6, 3.4, 0.36);
    for (const f of [-1, 1]) facing(b, 'atlas', sx, 7.0, 10.2, sz + f * 0.19, 1.4, f, uvOf('logo'));
  } else {
    // Edge-on to the forecourt and square to the road, so the traffic coming either way reads it.
    b.box('brand', sx, 0.5, sz, 0.7, 1.0, 2.2);
    b.box('dark', sx, 5.0, sz, 0.5, 8.0, 2.0);
    b.box('brand', sx, 9.12, sz, 0.66, 0.25, 2.2);
    for (const f of [-1, 1]) sideways(b, 'atlas', sx + f * 0.26, 1.2, 8.85, sz - 0.91, sz + 0.91, f, uvOf('pylon'));
  }

  // The kiosk: white walls, a glass shop front with mullions, the lit band on a parapet, roof plant.
  const k = L.kiosk;
  const kx = U(k.u);
  const fz = k.v - k.d / 2;
  b.box('white', kx, k.h / 2, k.v, k.w, k.h, k.d);
  if (L.tires) {
    // The service bay at the tire rack's end: a lit workshop through a wide opening, the yellow sign
    // over it; the shop front fills the rest.
    const bw = Math.min(6, k.w * 0.4);
    const end = Math.sign(U(L.tires.u) - kx) || -1;
    const bx = kx + end * (k.w / 2 - bw / 2 - 0.3);
    const sw = k.w - bw - 1.2;
    const sx = kx - end * (k.w / 2 - sw / 2 - 0.3);
    facing(b, 'atlas', bx, 0.05, 3.1, fz - 0.03, bw, -1, uvOf('bay'));
    b.box('dark', bx - bw / 2, 1.6, fz - 0.06, 0.14, 3.2, 0.12);
    b.box('dark', bx + bw / 2, 1.6, fz - 0.06, 0.14, 3.2, 0.12);
    b.box('dark', bx, 3.2, fz - 0.06, bw + 0.14, 0.14, 0.12);
    facing(b, 'atlas', bx, k.h - 0.85, k.h - 0.15, fz - 0.06, bw + 0.6, -1, uvOf('pit'));
    facing(b, 'shop', sx, 0.15, k.h - 1.0, fz - 0.03, sw, -1, [0, 0, sw / 4, 1]);
    for (let x = -sw / 2; x <= sw / 2 + 0.01; x += sw / 4) b.box('dark', sx + x, (k.h - 0.85) / 2, fz - 0.05, 0.12, k.h - 0.85, 0.08);
    b.box('dark', sx, k.h - 0.95, fz - 0.05, sw + 0.1, 0.12, 0.1);
    facing(b, 'atlas', sx, k.h - 1.55, k.h - 1.1, fz - 0.09, Math.min(4.2, sw - 0.4), -1, uvOf('banner'));
    const t = L.tires;
    const tx = U(t.u);
    b.box('steel', tx, 1.1, t.v, t.w, 0.06, t.d);
    b.box('steel', tx, 0.02, t.v, t.w, 0.04, t.d);
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 4; j++) b.cylinder('hose', tx, 0.12 + j * 0.24, t.v - t.d / 2 + 0.45 + i * 0.85, 0.32, 0.22, 8, 'y', { caps: true });
    }
  } else {
    facing(b, 'shop', kx, 0.15, k.h - 1.0, fz - 0.03, k.w - 1.2, -1, [0, 0, (k.w - 1.2) / 4, 1]);
    for (let x = -k.w / 2 + 0.6; x <= k.w / 2 - 0.55; x += (k.w - 1.2) / 5) b.box('dark', kx + x, (k.h - 0.85) / 2, fz - 0.05, 0.12, k.h - 0.85, 0.08);
    b.box('dark', kx, k.h - 0.95, fz - 0.05, k.w - 1.1, 0.12, 0.1);
  }
  b.box('white', kx, k.h + 0.45, k.v, k.w + 0.3, 0.9, k.d + 0.3);
  band(b, 'fascia', kx - k.w / 2 - 0.15, kx + k.w / 2 + 0.15, k.v - k.d / 2 - 0.15, k.v + k.d / 2 + 0.15, k.h + 0.05, k.h + 0.85);
  b.box('steel', kx + k.w * 0.25, k.h + 1.25, k.v + 1, 2.2, 0.9, 1.4);
  b.box('steel', kx - k.w * 0.2, k.h + 1.1, k.v + 1.5, 1.2, 0.6, 1.2);

  for (const [i, vm] of L.vending.entries()) {
    const vx = U(vm.u);
    b.box('white', vx, vm.h / 2, vm.v, vm.w, vm.h, vm.d);
    facing(b, 'atlas', vx, 0.1, vm.h - 0.08, vm.v - vm.d / 2 - 0.01, vm.w - 0.06, -1, uvOf(i % 2 ? 'vendBlue' : 'vendRed'));
  }
  for (const gt of L.gates) {
    const gx = U(gt.u);
    b.box('steel', gx, 0.8, gt.v, 0.08, 1.6, 0.08);
    b.box('dark', gx, 1.45, gt.v + 0.03, 1.12, 0.6, 0.05);
    facing(b, 'atlas', gx, 1.18, 1.72, gt.v - 0.01, 1.08, -1, uvOf(/** @type {'in' | 'out'} */ (gt.text)));
  }

  L.tents.forEach((t, i) => {
    const tx = U(t.u);
    const hw = t.w / 2;
    const hd = t.d / 2;
    for (const [dx, dz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) b.box('steel', tx + dx * hw, 1.2, t.v + dz * hd, 0.08, 2.4, 0.08);
    b.setColor(TENT[i % TENT.length]);
    /** @type {V3} */
    const apex = [tx, 3.6, t.v];
    /** @type {V3[]} */
    const ring = [[tx - hw, 2.4, t.v - hd], [tx + hw, 2.4, t.v - hd], [tx + hw, 2.4, t.v + hd], [tx - hw, 2.4, t.v + hd]];
    for (let j = 0; j < 4; j++) {
      const p = ring[j];
      const q = ring[(j + 1) % 4];
      b.tri('tent', p, apex, q);
      b.tri('tent', q, apex, p);
    }
    b.setColor(0xffffff);
  });
  for (const f of L.floods) {
    const fx = U(f.u);
    b.cylinder('steel', fx, 4.5, f.v, 0.14, 9, 6, 'y', { caps: false });
    b.box('steel', fx, 9.1, f.v, 1.2, 0.5, 0.5);
    const dir = -Math.sign(f.v) || 1;
    b.quad('lamp', [fx - 0.5, 8.9, f.v + dir * 0.26], [fx + 0.5, 8.9, f.v + dir * 0.26], [fx + 0.5, 9.3, f.v + dir * 0.26], [fx - 0.5, 9.3, f.v + dir * 0.26]);
    b.quad('lamp', [fx + 0.5, 8.9, f.v + dir * 0.26], [fx - 0.5, 8.9, f.v + dir * 0.26], [fx - 0.5, 9.3, f.v + dir * 0.26], [fx + 0.5, 9.3, f.v + dir * 0.26]);
  }
  b.pop();

  const B = BRAND[brand];
  const mesh = b.mesh({
    white: psxLambert({ color: 0xe8eaec, baked: true }),
    brand: psxLambert({ color: B.color, baked: true }),
    brandLit: psxBasic({ color: B.color }),
    fascia: psxBasic({ map: tex.fascia, color: 0xe4e6e8 }),
    lamp: psxBasic({ color: 0xf6f9ff, lit: true }),
    ceiling: psxLambert({ map: slatTexture(), color: 0xd0d2d4, baked: true }),
    lane: psxLambert({ color: 0x6a3a32, baked: true }),
    steel: psxLambert({ color: 0x8a8e94, baked: true }),
    dark: psxLambert({ color: 0x2c2f33, baked: true }),
    curb: psxLambert({ color: 0xc4c0b4, baked: true }),
    yellow: psxLambert({ color: 0xf2c51c, baked: true }),
    hose: psxLambert({ color: 0x141518, baked: true }),
    red: psxBasic({ color: 0xe02a20 }),
    yel: psxBasic({ color: 0xf2c51c }),
    grn: psxBasic({ color: 0x2ab04a }),
    atlas: psxBasic({ map: tex.atlas, side: THREE.DoubleSide }),
    tex: psxLambert({ map: tex.atlas, baked: true }),
    shop: psxBasic({ map: shopTexture() }),
    tent: psxLambert({ vertexColors: true, baked: true, side: THREE.FrontSide }),
  });
  bakeGeometry(mesh.geometry, grid, { wrap: 0.8 });
  mesh.name = `station-${pad.id}`;
  return mesh;
}

/**
 * @param {ReturnType<typeof import('./scatter.js').scatterWorld>['stations']} stations
 * @param {import('../render/bake.js').LightGrid} grid
 */
export function buildStations(stations, grid) {
  const group = new THREE.Group();
  group.name = 'stations';
  for (const st of stations) {
    group.add(buildStation(st, grid));
    if (st.pad.station.servicePark) {
      st.layout.tents.slice(0, 2).forEach((t, i) => {
        const spec = CARS[(i + 1) % CARS.length];
        const car = new CarModel(spec, 2 + i, { light: 'baked' });
        const p = padPoint(st.pad, t.u, t.v);
        car.group.position.set(p.x, st.pad.h, p.z);
        car.group.rotation.y = st.yaw + Math.PI;
        car.bake(grid);
        group.add(car.group);
      });
    }
  }
  return group;
}
