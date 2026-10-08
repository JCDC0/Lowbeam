/**
 * Meshes for the blue direction signs (`guide-signs.js`): a cantilever pole on the left sidewalk, its
 * arm over the lanes holding the panel, and every panel drawn on one canvas: the crossing as white
 * arrows on blue, the stem coming up from the bottom, each way at its own angle with its place in
 * kanji and romaji at the tip.
 */

import * as THREE from 'three';
import { MeshBuilder } from '../render/builder.js';
import { psxBasic, psxLambert } from '../render/psx.js';
import { bakeGeometry } from '../render/bake.js';
import { canvasTexture, makeCanvas } from '../render/textures.js';
import { FONT } from '../render/fonts.js';
import { GUIDE } from './guide-signs.js';

const TW = 256;
const TH = 176;
const BLUE = '#0e4f9e';
const WHITE = '#f2f4f6';

/**
 * @param {import('./guide-signs.js').GuideSign[]} signs
 * @param {import('../render/bake.js').LightGrid} grid
 */
export function buildGuideSigns(signs, grid) {
  const group = new THREE.Group();
  group.name = 'guide-signs';
  if (!signs.length) return group;
  const cols = 8;
  const rows = Math.ceil(signs.length / cols);
  const c = makeCanvas(TW * cols, TH * rows);
  const g = /** @type {CanvasRenderingContext2D} */ (c.getContext('2d'));
  const b = new MeshBuilder();
  signs.forEach((s, i) => {
    const x0 = (i % cols) * TW;
    const y0 = Math.floor(i / cols) * TH;
    drawPanel(g, x0, y0, s);
    const uv = [x0 / c.width, 1 - (y0 + TH) / c.height, (x0 + TW) / c.width, 1 - y0 / c.height];
    b.push(s.x, s.y, s.z, s.yaw);
    const { w, h, pole } = GUIDE;
    const L = s.arm - w / 2;
    const foot = s.py - s.y;
    const top = h / 2 + 0.35;
    b.box('steel', L, (foot + top) / 2, 0.2, pole * 2, top - foot, pole * 2);
    b.box('steel', (L - w / 2) / 2, h / 2 + 0.15, 0.2, L + w / 2, 0.14, 0.14, { bottom: true });
    b.box('steel', (L - w / 2) / 2, -h / 4, 0.2, L + w / 2, 0.1, 0.1, { bottom: true });
    b.box('back', 0, 0, 0.1, w, h, 0.08);
    const x = w / 2;
    const y = h / 2;
    b.quad('sign', [x, -y, 0.04], [-x, -y, 0.04], [-x, y, 0.04], [x, y, 0.04], uv);
    b.pop();
  });
  const mats = {
    steel: psxLambert({ color: 0x9aa0a6, baked: true }),
    back: psxLambert({ color: 0x4a5056, baked: true }),
    sign: psxBasic({ map: canvasTexture(c), color: 0xcfcfcf, side: THREE.DoubleSide }),
  };
  const geo = b.geometry(['steel', 'back', 'sign']);
  const mesh = new THREE.Mesh(bakeGeometry(geo.geometry, grid, { wrap: 0.6 }), geo.keys.map((k) => mats[k]));
  mesh.name = 'guide-signs';
  group.add(mesh);
  return group;
}

/**
 * @param {CanvasRenderingContext2D} g @param {number} x0 @param {number} y0
 * @param {import('./guide-signs.js').GuideSign} s
 */
function drawPanel(g, x0, y0, s) {
  g.fillStyle = BLUE;
  g.fillRect(x0, y0, TW, TH);
  g.strokeStyle = WHITE;
  g.lineWidth = 3;
  g.strokeRect(x0 + 5, y0 + 5, TW - 10, TH - 10);
  const cx = x0 + TW / 2;
  const cy = y0 + TH * 0.62;
  g.strokeStyle = WHITE;
  g.fillStyle = WHITE;
  g.lineWidth = 9;
  g.lineCap = 'butt';
  g.beginPath();
  g.moveTo(cx, y0 + TH - 10);
  g.lineTo(cx, cy);
  g.stroke();
  for (const w of s.ways) {
    // Up the panel is straight on; a way to the left (positive angle) points left.
    const dx = -Math.sin(w.angle);
    const dy = -Math.cos(w.angle);
    const len = Math.abs(w.angle) < 0.5 ? 34 : 44;
    const tx = cx + dx * len;
    const ty = cy + dy * len;
    g.lineWidth = 9;
    g.beginPath();
    g.moveTo(cx, cy);
    g.lineTo(tx, ty);
    g.stroke();
    const nx = -dy;
    const ny = dx;
    g.beginPath();
    g.moveTo(tx + dx * 13, ty + dy * 13);
    g.lineTo(tx + nx * 10, ty + ny * 10);
    g.lineTo(tx - nx * 10, ty - ny * 10);
    g.closePath();
    g.fill();
    const lx = tx + dx * 18;
    const ly = ty + dy * 18;
    const straight = Math.abs(w.angle) < 0.5;
    g.textAlign = straight ? 'center' : dx < 0 ? 'right' : 'left';
    g.textBaseline = 'middle';
    const room = straight ? TW - 40 : dx < 0 ? lx - x0 - 10 : x0 + TW - 10 - lx;
    const top = straight ? y0 + 24 : ly - 8;
    fit(g, w.jp || w.en, `bold ${w.jp ? 30 : 16}px ${w.jp ? FONT.jp : FONT.display}`, straight ? cx : lx, top, room);
    if (w.jp) fit(g, w.en, `11px ${FONT.display}`, straight ? cx : lx, top + 23, room);
  }
}

/** Text squeezed into `room` pixels, never stretched. */
function fit(g, text, font, x, y, room) {
  g.font = font;
  const w = g.measureText(text).width;
  if (w <= room || room <= 0) {
    g.fillText(text, x, y);
    return;
  }
  g.save();
  g.translate(x, y);
  g.scale(room / w, 1);
  g.fillText(text, 0, 0);
  g.restore();
}
