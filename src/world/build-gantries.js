/**
 * Meshes for Route 1's sign gantries (`gantries.js`): a steel truss on two posts, the outer one
 * beyond the rail and the inner one on the median's barrier, carrying a green guide sign for the
 * exit and the loop's own sign, with small lamps along their bottom edges. Every sign is drawn on
 * one canvas; each gantry is its own mesh so the far ones drop out with the road chunks.
 */

import * as THREE from 'three';
import { MeshBuilder } from '../render/builder.js';
import { psxBasic, psxLambert } from '../render/psx.js';
import { bakeGeometry } from '../render/bake.js';
import { canvasTexture, makeCanvas } from '../render/textures.js';
import { FONT } from '../render/fonts.js';
import { GANTRY } from './gantries.js';

const SIGN_W = 512;
const SIGN_H = 256;
const GREEN = '#0d6a43';
const WHITE = '#f2f4f2';

/**
 * @param {import('./gantries.js').Gantry[]} gantries @param {import('../render/bake.js').LightGrid} grid
 * @param {THREE.Group} group @param {{ mesh: THREE.Mesh, x: number, z: number }[]} chunks
 */
export function buildGantries(gantries, grid, group, chunks) {
  if (!gantries.length) return;
  const loops = [...new Set(gantries.map((gt) => gt.loop.en))];
  const cols = 4;
  const rows = Math.ceil((gantries.length + loops.length) / cols);
  const c = makeCanvas(SIGN_W * cols, SIGN_H * rows);
  const g = /** @type {CanvasRenderingContext2D} */ (c.getContext('2d'));
  /** @param {number} i @returns {[number, number]} */
  const cell = (i) => [(i % cols) * SIGN_W, Math.floor(i / cols) * SIGN_H];
  /** @param {number} i */
  const uv = (i) => {
    const [x, y] = cell(i);
    return [x / c.width, 1 - (y + SIGN_H) / c.height, (x + SIGN_W) / c.width, 1 - y / c.height];
  };
  gantries.forEach((gt, i) => drawExitSign(g, cell(i), gt));
  loops.forEach((en, k) => {
    const gt = /** @type {import('./gantries.js').Gantry} */ (gantries.find((x) => x.loop.en === en));
    drawLoopSign(g, cell(gantries.length + k), gt.loop);
  });
  const atlas = canvasTexture(c);
  /** @type {Record<string, THREE.Material>} */
  const mats = {
    steel: psxLambert({ color: 0x8e979e, baked: true }),
    back: psxLambert({ color: 0x4a5056, baked: true }),
    sign: psxBasic({ map: atlas, color: 0xd6d6d6, side: THREE.DoubleSide }),
    lamp: psxBasic({ color: 0xf4f6ff }),
  };
  const { low, high } = GANTRY;
  gantries.forEach((gt, i) => {
    const b = new MeshBuilder();
    b.push(gt.x, gt.y, gt.z, gt.yaw);
    const outer = gt.hw + GANTRY.post;
    const inner = -gt.median;
    const span = outer - inner;
    const mid = (outer + inner) / 2;
    const top = high + 0.35;
    for (const [u, drop] of [[outer, gt.outer], [inner, gt.inner]]) {
      b.box('steel', u, (top - drop) / 2, 0.45, 0.42, top + drop, 0.42);
      b.box('back', u, -drop + 0.15, 0.45, 0.9, 0.3, 0.9);
    }
    for (const y of [low + 0.55, high - 0.35]) b.box('steel', mid, y, 0.45, span, 0.22, 0.22);
    for (let u = inner + 0.9; u < outer - 0.5; u += 1.3) b.box('steel', u, (low + high) / 2 + 0.1, 0.45, 0.08, high - low - 0.9, 0.08);
    const lane = (gt.hw * 2) / 3;
    // The exit sign hangs over the left lanes (over the exit lane itself at the near gantry), the
    // loop's sign over the right ones.
    const ew = gt.near ? 4.6 : 5.4;
    const eu = gt.near ? gt.hw - lane / 2 : gt.hw - ew / 2 - 0.2;
    const lw = 4.2;
    const lu = Math.min(eu - ew / 2 - lw / 2 - 0.4, -gt.hw + lw / 2 + 0.5);
    /** @type {[number, number, number[]][]} */
    const panels = [[eu, ew, uv(i)], [lu, lw, uv(gantries.length + loops.indexOf(gt.loop.en))]];
    for (const [u, w, r] of panels) {
      const h = w / 2;
      b.box('back', u, high - h / 2, 0.12, w, h, 0.1);
      const l = u - w / 2;
      const rr = u + w / 2;
      b.quad('sign', [rr, high - h, 0.06], [l, high - h, 0.06], [l, high, 0.06], [rr, high, 0.06], r);
      for (let k = -1; k <= 1; k++) b.box('lamp', u + (k * w) / 3, high - h - 0.12, 0.0, 0.5, 0.08, 0.16);
    }
    b.pop();
    const geo = b.geometry(['steel', 'back', 'sign', 'lamp']);
    const mesh = new THREE.Mesh(bakeGeometry(geo.geometry, grid, { wrap: 0.6 }), geo.keys.map((k) => mats[k]));
    mesh.name = `gantry-${gt.carriage}-${Math.round(gt.s)}`;
    group.add(mesh);
    chunks.push({ mesh, x: gt.x, z: gt.z });
  });
}

/** @param {CanvasRenderingContext2D} g @param {number} x @param {number} y */
function panel(g, x, y) {
  g.fillStyle = GREEN;
  g.fillRect(x, y, SIGN_W, SIGN_H);
  g.strokeStyle = WHITE;
  g.lineWidth = 5;
  g.strokeRect(x + 9, y + 9, SIGN_W - 18, SIGN_H - 18);
}

/**
 * One exit's sign: 出口 (or JCT) in a white box and the distance on the top line, the place in
 * kanji and romaji, the road it joins below; at the exit lane an arrow down to it on the left.
 * @param {CanvasRenderingContext2D} g @param {[number, number]} at @param {import('./gantries.js').Gantry} gt
 */
function drawExitSign(g, [x, y], gt) {
  const e = gt.exit;
  panel(g, x, y);
  const left = gt.near ? x + 150 : x + 34;
  const right = x + SIGN_W - 30;
  g.textBaseline = 'middle';
  g.textAlign = 'left';
  g.fillStyle = WHITE;
  g.fillRect(left, y + 28, e.jct ? 100 : 104, 52);
  g.fillStyle = GREEN;
  g.font = e.jct ? `bold 34px ${FONT.display}` : `bold 40px ${FONT.jp}`;
  g.fillText(e.jct ? 'JCT' : '出口', left + 11, y + 55);
  g.fillStyle = WHITE;
  if (!e.jct) {
    g.font = `22px ${FONT.display}`;
    g.fillText('EXIT', left + 118, y + 55);
  }
  if (e.distance != null) {
    g.textAlign = 'right';
    g.font = `bold 52px ${FONT.race}`;
    g.fillText(`${e.distance}m`, right, y + 58);
    g.textAlign = 'left';
  }
  const place = e.sub || e;
  fitText(g, place.jp, `bold 64px ${FONT.jp}`, left, y + 124, right - left);
  fitText(g, place.en, `22px ${FONT.display}`, left + 2, y + 170, right - left);
  if (e.sub) {
    g.font = `bold 26px ${FONT.jp}`;
    const w = g.measureText(e.jp).width;
    g.strokeStyle = WHITE;
    g.lineWidth = 3;
    g.strokeRect(left, y + 195, w + 20, 38);
    g.fillText(e.jp, left + 10, y + 215);
    fitText(g, e.en, `18px ${FONT.display}`, left + w + 34, y + 215, right - (left + w + 34));
  }
  if (gt.near) {
    const ax = x + 78;
    g.beginPath();
    g.moveTo(ax - 17, y + 36);
    g.lineTo(ax + 17, y + 36);
    g.lineTo(ax + 17, y + 148);
    g.lineTo(ax + 48, y + 148);
    g.lineTo(ax, y + 222);
    g.lineTo(ax - 48, y + 148);
    g.lineTo(ax - 17, y + 148);
    g.closePath();
    g.fill();
  }
}

/**
 * The loop's sign: Route 1's hexagonal shield and the carriageway, 内回り or 外回り.
 * @param {CanvasRenderingContext2D} g @param {[number, number]} at @param {{ jp: string, en: string }} loop
 */
function drawLoopSign(g, [x, y], loop) {
  panel(g, x, y);
  const cx = x + 112;
  const cy = y + SIGN_H / 2;
  g.fillStyle = WHITE;
  g.beginPath();
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2 + Math.PI / 6;
    g.lineTo(cx + Math.cos(a) * 72, cy + Math.sin(a) * 72);
  }
  g.closePath();
  g.fill();
  g.fillStyle = GREEN;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = `bold 96px ${FONT.race}`;
  g.fillText('1', cx, cy + 8);
  g.fillStyle = WHITE;
  g.textAlign = 'left';
  fitText(g, '黒鉄高速', `bold 30px ${FONT.jp}`, x + 210, y + 62, SIGN_W - 240);
  fitText(g, loop.jp, `bold 62px ${FONT.jp}`, x + 210, y + 128, SIGN_W - 240);
  fitText(g, loop.en, `22px ${FONT.display}`, x + 212, y + 186, SIGN_W - 240);
}

/**
 * Text squeezed to fit `room` pixels, never stretched.
 * @param {CanvasRenderingContext2D} g @param {string} text @param {string} font
 * @param {number} x @param {number} y @param {number} room
 */
function fitText(g, text, font, x, y, room) {
  g.font = font;
  const w = g.measureText(text).width;
  if (w <= room) {
    g.fillText(text, x, y);
    return;
  }
  g.save();
  g.translate(x, y);
  g.scale(room / w, 1);
  g.fillText(text, 0, 0);
  g.restore();
}
