/**
 * Meshes for Route 1: the median barrier and guard rails in 180 m chunks (so they can be
 * culled like the road), and the toll plazas, after the Shuto Expressway's (Oi): a canopy with a
 * glass and blue fascia, red fins, lit lane signs (ETC専用, ETC/一般, 一般) and signals, chevron
 * boards over the islands, booths on islands with striped cushions, light masts on the median and
 * the ETC lanes painted blue.
 */

import * as THREE from 'three';
import { MeshBuilder } from '../render/builder.js';
import { psxBasic, psxLambert } from '../render/psx.js';
import { bakeGeometry } from '../render/bake.js';
import { canvasTexture, concreteTexture, makeCanvas } from '../render/textures.js';
import { BARRIER, PLAZA_PARTS, RAIL } from './highway.js';
import { FONT } from '../render/fonts.js';

const CANOPY_Y = 5.9;

/**
 * @param {ReturnType<typeof import('./highway.js').placeHighway>} highway
 * @param {import('../render/bake.js').LightGrid} grid
 */
export function buildHighway(highway, grid) {
  const group = new THREE.Group();
  group.name = 'highway';
  /** @type {{ mesh: THREE.Mesh, x: number, z: number }[]} */
  const chunks = [];
  group.userData.chunks = chunks;

  const concrete = psxLambert({ map: concreteTexture(), baked: true, side: THREE.DoubleSide });
  const steel = psxLambert({ color: 0xaab2b8, baked: true, side: THREE.DoubleSide });
  const post = psxLambert({ color: 0x555a60, baked: true });
  const mats = { c: concrete, steel, post };

  /** @type {Map<number, { b: MeshBuilder, x: number, z: number, n: number }>} */
  const builders = new Map();
  const of = (key, x, z) => {
    let e = builders.get(key);
    if (!e) builders.set(key, (e = { b: new MeshBuilder(), x: 0, z: 0, n: 0 }));
    e.x += x;
    e.z += z;
    e.n++;
    return e.b;
  };

  const { halfBase: hb, halfTop: ht, height: H } = BARRIER;
  for (const s of highway.barrier) {
    const b = of(s.chunk, s.x, s.z);
    const L = s.len / 2;
    b.push(s.x, s.y, s.z, s.yaw);
    const u = s.len / 4;
    b.quad('c', [-hb, 0, -L], [-hb, 0, L], [-ht, H, L], [-ht, H, -L], [0, 0, u, 1]);
    b.quad('c', [-ht, H, -L], [-ht, H, L], [ht, H, L], [ht, H, -L], [0, 0, u, 0.3]);
    b.quad('c', [ht, H, -L], [ht, H, L], [hb, 0, L], [hb, 0, -L], [0, 0, u, 1]);
    b.pop();
  }
  for (const s of highway.rails) {
    const b = of(s.chunk + 100000, s.x, s.z);
    const L = s.len / 2;
    b.push(s.x, s.y, s.z, s.yaw);
    b.box('steel', 0, (RAIL.low + RAIL.high) / 2, 0, 0.07, RAIL.high - RAIL.low, s.len, { top: true });
    b.box('post', 0.06, RAIL.high / 2 - 0.05, -L, 0.14, RAIL.high, 0.14);
    b.pop();
  }
  for (const [, e] of builders) {
    const geo = e.b.geometry(['c', 'steel', 'post']);
    const mesh = new THREE.Mesh(bakeGeometry(geo.geometry, grid, { wrap: 0.6 }), geo.keys.map((k) => mats[k]));
    mesh.name = 'highway-furniture';
    group.add(mesh);
    chunks.push({ mesh, x: e.x / e.n, z: e.z / e.n });
  }

  for (const pl of highway.plazas) group.add(buildPlaza(pl, grid, mats));
  return group;
}


const ATLAS_W = 1024;
const ATLAS_H = 512;
/** Where each picture sits in a plaza's atlas, in canvas pixels: x, y, w, h. */
const TILE = {
  etc: [0, 0, 256, 96], cash: [256, 0, 256, 96], mixed: [512, 0, 256, 96], name: [768, 0, 256, 96],
  go: [0, 96, 64, 64], amber: [128, 96, 32, 32], chevron: [256, 96, 256, 48],
  fee: [512, 96, 128, 96], cam: [640, 96, 128, 64], hazard: [768, 96, 64, 64], rw: [832, 96, 64, 64],
  bannerFee: [0, 192, 512, 64], bannerCard: [512, 192, 512, 64], bannerTrap: [0, 256, 512, 64],
  window: [512, 256, 64, 32],
};
/** A tile's uv rect for `MeshBuilder.quad`. @param {keyof typeof TILE} name */
function uvOf(name) {
  const [x, y, w, h] = TILE[name];
  return [x / ATLAS_W, 1 - (y + h) / ATLAS_H, (x + w) / ATLAS_W, 1 - y / ATLAS_H];
}
/** @type {Record<string, string>} */
const KANJI = { KITA: '北', HIGASHI: '東', MINATO: '港', BAYSHORE: '湾岸' };
const JP = FONT.jp;

/** Every sign, signal and stripe of one plaza on one canvas. @param {import('./highway.js').Plaza} pl */
function plazaAtlas(pl) {
  const c = makeCanvas(ATLAS_W, ATLAS_H);
  const g = /** @type {CanvasRenderingContext2D} */ (c.getContext('2d'));
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  /** @param {keyof typeof TILE} tile @param {string} fill @param {string} text */
  const panel = (tile, fill, text) => {
    const [x, y, w, h] = TILE[tile];
    g.fillStyle = '#202226';
    g.fillRect(x, y, w, h);
    g.fillStyle = fill;
    g.fillRect(x + 6, y + 6, w - 12, h - 12);
    g.strokeStyle = 'rgba(255,255,255,0.75)';
    g.lineWidth = 3;
    g.strokeRect(x + 11, y + 11, w - 22, h - 22);
    g.fillStyle = '#ffffff';
    g.font = `bold 50px ${JP}`;
    g.fillText(text, x + w / 2, y + h / 2 + 2);
  };
  panel('etc', '#4a3aa8', 'ETC専用');
  panel('cash', '#14894a', '一　般');
  {
    const [x, y, w, h] = TILE.mixed;
    g.fillStyle = '#202226';
    g.fillRect(x, y, w, h);
    g.fillStyle = '#4a3aa8';
    g.fillRect(x + 6, y + 6, w / 2 - 6, h - 12);
    g.fillStyle = '#14894a';
    g.fillRect(x + w / 2, y + 6, w / 2 - 6, h - 12);
    g.fillStyle = '#ffffff';
    g.font = `bold 46px ${JP}`;
    g.fillText('ETC', x + w / 4 + 3, y + h / 2 + 2);
    g.fillText('一般', x + (w * 3) / 4 - 3, y + h / 2 + 2);
  }
  const base = pl.toll.name.replace(/ TOLL$/, '');
  {
    const [x, y, w, h] = TILE.name;
    const kanji = KANJI[base] || '';
    g.fillStyle = '#3e4146';
    g.fillRect(x, y, w, h);
    g.fillStyle = '#eef0f2';
    g.textAlign = 'left';
    g.font = `52px ${FONT.impact}`;
    g.fillText(kanji, x + 18, y + h / 2 + 2);
    const kw = g.measureText(kanji).width;
    g.font = `30px ${FONT.impact}`;
    g.fillText(base[0] + base.slice(1).toLowerCase(), x + 30 + kw, y + h / 2 + 6);
    g.textAlign = 'center';
  }
  {
    const [x, y] = TILE.go;
    g.fillStyle = '#0c0d0f';
    g.fillRect(x, y, 64, 64);
    g.strokeStyle = '#46ffc8';
    g.lineWidth = 8;
    g.beginPath();
    g.arc(x + 32, y + 32, 19, 0, Math.PI * 2);
    g.stroke();
  }
  {
    const [x, y] = TILE.amber;
    g.fillStyle = '#0c0d0f';
    g.fillRect(x, y, 32, 32);
    g.fillStyle = '#ffb02e';
    g.fillRect(x + 8, y + 9, 16, 14);
  }
  {
    const [x, y, w, h] = TILE.chevron;
    g.fillStyle = '#f2f2ee';
    g.fillRect(x, y, w, h);
    g.fillStyle = '#d42a24';
    for (let k = 0; k < w; k += 32) {
      g.beginPath();
      g.moveTo(x + k, y);
      g.lineTo(x + k + 16, y);
      g.lineTo(x + k + 32, y + h / 2);
      g.lineTo(x + k + 16, y + h);
      g.lineTo(x + k, y + h);
      g.lineTo(x + k + 16, y + h / 2);
      g.closePath();
      g.fill();
    }
  }
  {
    const [x, y, w, h] = TILE.fee;
    g.fillStyle = '#1c4a8e';
    g.fillRect(x, y, w, h);
    g.strokeStyle = '#e8eef6';
    g.lineWidth = 3;
    g.strokeRect(x + 4, y + 4, w - 8, h - 8);
    g.fillStyle = '#ffffff';
    g.font = `bold 21px ${JP}`;
    g.fillText(`普通 ${pl.toll.fee}円`, x + w / 2, y + 30);
    g.fillText(`大型 ${pl.toll.fee * 2}円`, x + w / 2, y + 66);
  }
  {
    const [x, y, w] = TILE.cam;
    g.fillStyle = '#100806';
    g.fillRect(x, y, w, 64);
    g.fillStyle = '#ff6a12';
    g.font = `bold 24px ${JP}`;
    g.fillText('カメラ', x + w / 2, y + 18);
    g.fillText('稼働中', x + w / 2, y + 46);
  }
  /** @param {keyof typeof TILE} tile @param {string} a @param {string} b2 */
  const stripes = (tile, a, b2) => {
    const [x, y, w, h] = TILE[tile];
    g.save();
    g.beginPath();
    g.rect(x, y, w, h);
    g.clip();
    g.fillStyle = a;
    g.fillRect(x, y, w, h);
    g.fillStyle = b2;
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
  };
  stripes('hazard', '#f2c51c', '#141414');
  stripes('rw', '#f0f0ec', '#d02a22');
  /** @param {keyof typeof TILE} tile @param {string} fill @param {[string, string, number, string?][]} parts */
  const banner = (tile, fill, parts) => {
    const [x, y, w, h] = TILE[tile];
    g.fillStyle = '#2a2c30';
    g.fillRect(x, y, w, h);
    g.fillStyle = fill;
    g.fillRect(x + 3, y + 3, w - 6, h - 6);
    g.textAlign = 'left';
    let cx = x + 14;
    for (const [text, color, size, box] of parts) {
      g.font = `bold ${size}px ${JP}`;
      const tw = g.measureText(text).width;
      if (box) {
        g.fillStyle = box;
        g.fillRect(cx - 4, y + 12, tw + 8, h - 24);
      }
      g.fillStyle = color;
      g.fillText(text, cx, y + h / 2 + 2);
      cx += tw + 14;
    }
    g.textAlign = 'center';
  };
  banner('bannerFee', '#f4f4f0', [['ETC', '#ffffff', 26, '#4a3aa8'], ['普通車', '#1a3f8a', 30], [`${pl.toll.fee}円`, '#d42a24', 40], ['黒鉄高速', '#1a1a1a', 26]]);
  banner('bannerCard', '#e2b63a', [['ETC', '#ffffff', 26, '#4a3aa8'], ['パーソナルカード', '#1a1a1a', 32], ['受付中', '#a01818', 32]]);
  banner('bannerTrap', '#f4f4f0', [['速度違反', '#d42a24', 38], ['取締中', '#1a1a1a', 38], [`${base} TOLL`, '#1a3f8a', 26]]);
  {
    const [x, y, w, h] = TILE.window;
    g.fillStyle = '#2c3a44';
    g.fillRect(x, y, w, h);
    g.fillStyle = '#e8f0d8';
    g.fillRect(x + 3, y + 3, w / 2 - 5, h - 6);
    g.fillRect(x + w / 2 + 2, y + 3, w / 2 - 5, h - 6);
  }
  return canvasTexture(c);
}

/** The glass band of the fascia: panes with a blue panel every fourth, repeating. */
function fasciaTexture() {
  const c = makeCanvas(64, 32);
  const g = /** @type {CanvasRenderingContext2D} */ (c.getContext('2d'));
  g.fillStyle = '#26323c';
  g.fillRect(0, 0, 64, 32);
  for (let k = 0; k < 4; k++) {
    g.fillStyle = k === 3 ? '#2552b0' : '#8cc2d0';
    g.fillRect(k * 16 + 1, 1, 14, 30);
    if (k < 3) {
      g.fillStyle = '#b4dce4';
      g.fillRect(k * 16 + 1, 1, 14, 5);
    }
  }
  return canvasTexture(c, { repeat: true });
}

/** Blue ETC lane paint with a white bar every 4 m. */
function etcPaintTexture() {
  const c = makeCanvas(16, 64);
  const g = /** @type {CanvasRenderingContext2D} */ (c.getContext('2d'));
  g.fillStyle = '#2b62c4';
  g.fillRect(0, 0, 16, 64);
  g.fillStyle = '#e8eef4';
  g.fillRect(0, 0, 16, 14);
  return canvasTexture(c, { repeat: true });
}

/**
 * A box whose sides and top all show one atlas tile.
 * @param {MeshBuilder} b @param {string} key @param {number} x @param {number} y @param {number} z
 * @param {number} sx @param {number} sy @param {number} sz @param {keyof typeof TILE} tile
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
 * A flat picture standing across the road at `v`, seen from -z (`f` -1, traffic on the forward
 * carriageway coming up to the plaza) or from +z (`f` 1).
 * @param {MeshBuilder} b @param {string} key @param {number} u @param {number} y0 @param {number} y1
 * @param {number} v @param {number} w @param {number} f @param {number[]} [uv]
 */
function facing(b, key, u, y0, y1, v, w, f, uv) {
  const l = u - w / 2;
  const r = u + w / 2;
  if (f < 0) b.quad(key, [r, y0, v], [l, y0, v], [l, y1, v], [r, y1, v], uv);
  else b.quad(key, [l, y0, v], [r, y0, v], [r, y1, v], [l, y1, v], uv);
}

/**
 * One toll plaza in its own frame: x is across (positive to the left of the forward
 * carriageway), z is along the road. The forward carriageway's lanes (x > 0) come up to the
 * face at -z, the other carriageway's to the face at +z.
 * @param {import('./highway.js').Plaza} pl @param {import('../render/bake.js').LightGrid} grid
 * @param {Record<string, THREE.Material>} shared
 */
function buildPlaza(pl, grid, shared) {
  const P = PLAZA_PARTS;
  const b = new MeshBuilder();
  const Y = CANOPY_Y;
  const D = 6.5;
  b.push(pl.x, pl.y, pl.z, pl.yaw);
  const span = pl.carriageway * 2 + pl.laneWidth * 3 + 3;
  const half = span / 2;
  const columns = [...pl.dividers, 0, -(half - 0.5), half - 0.5];

  b.box('steel', 0, Y + 0.35, 0, span, 0.7, D * 2, { bottom: true });
  for (const v of [-4, 0, 4]) for (let k = -3; k <= 3; k += 2) b.box('lamp', (k * pl.carriageway) / 3.5, Y - 0.03, v, 1.4, 0.08, 0.5);
  for (const u of columns) b.box('blue', u, Y / 2, 0, 0.7, Y, 0.7);

  for (const f of [-1, 1]) {
    const vf = f * (D + 0.2);
    b.box('steel', 0, 6.3, vf, span, 0.8, 0.4);
    b.box('gray', 0, 7.3, vf, span, 1.2, 0.4);
    b.box('steel', 0, 8.55, f * (D + 0.1), span, 1.3, 0.2);
    facing(b, 'glass', 0, 7.9, 9.2, f * (D + 0.41), span, f, [0, 0, span / 3.2, 1]);
    b.box('steel', 0, 9.3, vf, span + 0.2, 0.2, 0.5);
    for (const u of columns) {
      b.box('red', u, 7.7, f * (D + 0.55), 0.32, 3.4, 0.5);
      b.box('red', u, 9.55, f * (D + 0.25), 0.32, 0.3, 1.0);
    }
    /** @param {number} u */
    const mine = (u) => (u > 0) === (f < 0);
    for (const lane of pl.lanes) {
      if (!mine(lane.u)) continue;
      facing(b, 'sign', lane.u, 6.88, 7.73, f * (D + 0.43), 2.7, f, uvOf(lane.sign));
      b.box('steel', lane.u, 6.3, f * (D + 0.5), 0.75, 0.75, 0.25);
      facing(b, 'sign', lane.u, 6.04, 6.56, f * (D + 0.64), 0.52, f, uvOf('go'));
      for (const du of [-0.95, 0.95]) facing(b, 'sign', lane.u + du, 6.2, 6.42, f * (D + 0.42), 0.22, f, uvOf('amber'));
    }
    for (const u of [...pl.dividers.filter(mine), 0]) facing(b, 'tex', u, 5.3, 5.85, f * (D + 0.42), u === 0 ? 3.2 : 2.6, f, uvOf('chevron'));
    const nu = f < 0 ? half - 2.6 : -(half - 2.6);
    facing(b, 'sign', nu, 7.98, 8.9, f * (D + 0.43), 3.8, f, uvOf('name'));
  }

  const bw = Math.min(9, span / 3 - 0.6);
  /** @type {(keyof typeof TILE)[]} */
  const banners = ['bannerCard', 'bannerFee', 'bannerTrap'];
  for (const f of [-1, 1]) {
    banners.forEach((tile, i) => {
      const u = (i - 1) * (span / 3) * -f;
      facing(b, 'sign', u, 9.5, 11.0, f * (D - 0.2), bw, f, uvOf(tile));
      for (const du of [-bw / 2 + 0.4, bw / 2 - 0.4]) b.box('steel', u + du, 10.1, f * (D - 0.32), 0.18, 1.6, 0.18);
    });
  }

  for (const u of pl.dividers) {
    const a = u > 0 ? -1 : 1;
    b.box('c', u, 0.13, 0, 1.3, 0.26, P.island * 2);
    tileBox(b, 'tex', u, 0.6, a * (P.island + P.cushion / 2), 1.15, 1.1, P.cushion, 'rw');
    b.box('booth', u, 1.41, 0, 1.25, 2.3, 3.0);
    b.box('steel', u, 2.66, 0, 1.6, 0.2, 3.5);
    for (const side of [-1, 1]) {
      const x = u + side * 0.63;
      if (side > 0) b.quad('sign', [x, 1.45, 1.2], [x, 1.45, -1.2], [x, 2.25, -1.2], [x, 2.25, 1.2], uvOf('window'));
      else b.quad('sign', [x, 1.45, -1.2], [x, 1.45, 1.2], [x, 2.25, 1.2], [x, 2.25, -1.2], uvOf('window'));
    }
    tileBox(b, 'tex', u, 1.86, a * (P.island - 1.4), 0.16, 3.2, 0.16, 'hazard');
    const fv = a * (P.island - 3.4);
    b.box('post', u, 1.6, fv, 0.1, 2.7, 0.1);
    b.box('steel', u, 2.7, fv - a * 0.04, 1.12, 0.86, 0.08);
    facing(b, 'tex', u, 2.3, 3.1, fv + a * 0.01, 1.05, a, uvOf('fee'));
    const cv = a * (P.island - 0.6);
    b.box('steel', u, 1.15, cv, 0.95, 0.65, 0.3);
    facing(b, 'sign', u, 0.9, 1.4, cv + a * 0.16, 0.85, a, uvOf('cam'));
    b.box('booth', u, 0.8, -a * 3.4, 0.42, 1.1, 0.42);
    tileBox(b, 'tex', u, 2.85, -a * 3.4, 0.09, 3.0, 0.09, 'rw');
  }
  b.box('c', 0, 0.13, 0, 3.0, 0.26, P.median * 2);
  for (const a of [-1, 1]) {
    tileBox(b, 'tex', 0, 0.6, a * (P.median + P.cushion / 2), 2.6, 1.1, P.cushion, 'rw');
    const mv = a * P.mast;
    b.box('c', 0, 0.3, mv, 1.2, 0.6, 1.2);
    b.box('post', 0, P.mastH / 2, mv, 0.42, P.mastH, 0.42);
    b.box('steel', 0, P.mastH - 0.4, mv, 2.4, 0.22, 2.4);
    for (const du of [-0.75, -0.25, 0.25, 0.75]) b.box('lamp', du, P.mastH - 0.05, mv - a * 0.95, 0.42, 0.4, 0.3);
    b.box('post', 0, P.mastH + 1.2, mv, 0.12, 2.4, 0.12);
  }
  b.pop();

  const atlas = plazaAtlas(pl);
  /** @type {Record<string, THREE.Material>} */
  const mats = {
    c: shared.c,
    post: shared.post,
    steel: psxLambert({ color: 0x3e434a, baked: true }),
    gray: psxLambert({ color: 0x72777d, baked: true }),
    blue: psxLambert({ color: 0x2c62aa, baked: true }),
    red: psxLambert({ color: 0xc8302a, baked: true }),
    booth: psxLambert({ color: 0xdadee1, baked: true }),
    tex: psxLambert({ map: atlas, baked: true, side: THREE.DoubleSide }),
    sign: psxBasic({ map: atlas, side: THREE.DoubleSide }),
    glass: psxBasic({ map: fasciaTexture(), color: 0x8a96a4, side: THREE.DoubleSide }),
    lamp: psxBasic({ color: 0xf4f8ff }),
  };
  const geo = b.geometry(['c', 'post', 'steel', 'gray', 'blue', 'red', 'booth', 'tex', 'sign', 'glass', 'lamp']);
  const group = new THREE.Group();
  group.name = `plaza-${pl.toll.id}`;
  group.add(new THREE.Mesh(bakeGeometry(geo.geometry, grid, { wrap: 0.6 }), geo.keys.map((k) => mats[k])));

  const paint = new MeshBuilder();
  for (const strip of pl.paint) {
    const w = strip.hw;
    for (let i = 1; i < strip.pts.length; i++) {
      const p0 = strip.pts[i - 1];
      const p1 = strip.pts[i];
      paint.quad('paint', [p0.x - p0.lx * w, p0.y, p0.z - p0.lz * w], [p1.x - p1.lx * w, p1.y, p1.z - p1.lz * w],
        [p1.x + p1.lx * w, p1.y, p1.z + p1.lz * w], [p0.x + p0.lx * w, p0.y, p0.z + p0.lz * w], [0, p0.s / 4, 1, p1.s / 4]);
    }
  }
  if (!paint.isEmpty()) {
    const pg = paint.geometry(['paint']);
    const paintMat = psxLambert({ map: etcPaintTexture(), baked: true, side: THREE.DoubleSide });
    group.add(new THREE.Mesh(bakeGeometry(pg.geometry, grid, { wrap: 0.6 }), paintMat));
  }
  return group;
}
