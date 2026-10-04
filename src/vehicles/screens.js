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
import { FONT } from '../render/fonts.js';
import { gaugeScale, segmentsLit, tachZone } from './dash.js';

/**
 * What a screen shows, from the gauge readings (`gauges.js`).
 * @typedef {{ kmh: number, rpm: number, gear: string, boost: number, fuel: number, temp: number,
 *   shift: boolean, limiter: boolean, warn: boolean, blown: boolean, time: number }} Reading
 */

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
  const tach = gaugeScale('tach', spec);
  const speedMax = gaugeScale('speed', spec).max;
  let key = '';
  return {
    tex,
    /** @param {Reading} r */
    draw(r) {
      const flash = (r.shift || r.limiter) && Math.floor(r.time * 10) % 2 === 0;
      const k = `${Math.round(r.kmh)}|${Math.round(r.rpm / 50)}|${r.gear}|${Math.round(r.boost * 20)}|${Math.round(r.fuel * 40)}|${Math.round(r.temp)}|${flash}|${r.warn}|${r.blown && Math.floor(r.time * 3) % 2}`;
      if (k === key) return;
      key = k;
      if (kind === 'lcd') drawLcd(g, W, H, r, spec, tach, speedMax, flash);
      else drawVfd(g, W, H, r, spec, tach, flash);
      tex.needsUpdate = true;
    },
  };
}

/** Right-aligned digits with every segment ghosted behind them. */
function segDigits(g, text, ghost, x, y, size, font, lit, unlit) {
  g.font = `bold ${size}px ${font}`;
  g.textAlign = 'right';
  g.textBaseline = 'alphabetic';
  g.fillStyle = unlit;
  g.fillText(ghost, x, y);
  g.fillStyle = lit;
  g.fillText(text, x, y);
}

/**
 * @param {CanvasRenderingContext2D} g @param {Reading} r @param {import('./specs.js').CarSpec} spec
 * @param {ReturnType<typeof gaugeScale>} tach
 */
function drawLcd(g, W, H, r, spec, tach, speedMax, flash) {
  g.fillStyle = '#020405';
  g.fillRect(0, 0, W, H);
  g.strokeStyle = '#0e2a33';
  g.lineWidth = 2;
  g.strokeRect(2, 2, W - 4, H - 4);
  // The tach: segments on an arc over the middle, from the lower left round to the lower right.
  const n = 44;
  const lit = segmentsLit(r.rpm, tach.max, n);
  const cx = W * 0.5;
  const cy = H * 0.97;
  const R = Math.min(W * 0.34, H * 0.84);
  for (let i = 0; i < n; i++) {
    const a0 = Math.PI * (1.08 + (i / n) * 0.84);
    const a1 = Math.PI * (1.08 + ((i + 0.72) / n) * 0.84);
    const red = ((i + 0.5) / n) * tach.max >= spec.engine.redline;
    g.beginPath();
    g.arc(cx, cy, R, a0, a1);
    g.arc(cx, cy, R - 12, a1, a0, true);
    g.closePath();
    g.fillStyle = i < lit ? (red ? '#ff3a2a' : flash ? '#ffffff' : '#46e8ff') : red ? '#2a0808' : '#08262c';
    g.fill();
  }
  g.font = `11px ${FONT.mono}`;
  g.fillStyle = '#5a8a94';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  for (let v = 0; v <= tach.max; v += 1000) {
    const a = Math.PI * (1.08 + (v / tach.max) * 0.84);
    g.fillText(String(v / 1000), cx + Math.cos(a) * (R - 21), cy + Math.sin(a) * (R - 21));
  }
  // Speed under the arc, its unit beneath.
  segDigits(g, String(Math.round(r.kmh)), '888', cx + 38, H * 0.8, 36, FONT.seg7, '#e8fbff', '#0a1a1e');
  g.font = `11px ${FONT.mono}`;
  g.fillStyle = '#46e8ff';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('km/h', cx, H * 0.9);
  // Gear in a box on the right.
  const gx = W - 42;
  g.strokeStyle = '#46e8ff';
  g.lineWidth = 2;
  g.strokeRect(gx, H * 0.3, 32, 40);
  g.font = `bold 26px ${FONT.seg14}`;
  g.textAlign = 'center';
  g.textBaseline = 'alphabetic';
  g.fillStyle = '#0a1a1e';
  g.fillText('~', gx + 16, H * 0.3 + 33);
  g.fillStyle = r.blown ? '#ff3a2a' : '#ffffff';
  g.fillText(r.gear, gx + 16, H * 0.3 + 33);
  // Boost, fuel and temperature as short vertical bars on the left, labels under them.
  const bars = [
    ['B', Math.max(0, r.boost) / 1.5, '#46e8ff'],
    ['F', r.fuel, r.fuel < 0.15 ? '#ff3a2a' : '#e8fbff'],
    ['T', (r.temp - 60) / 70, r.temp > 110 ? '#ff3a2a' : '#e8fbff'],
  ];
  bars.forEach(([label, v, color], i) => {
    const x = 10 + i * 12;
    const top = H * 0.3;
    const h = H * 0.42;
    g.fillStyle = '#08262c';
    g.fillRect(x, top, 7, h);
    const f = Math.max(0, Math.min(1, Number(v)));
    g.fillStyle = String(color);
    g.fillRect(x, top + h * (1 - f), 7, h * f);
    g.font = `10px ${FONT.mono}`;
    g.fillStyle = '#5a8a94';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(String(label), x + 3.5, top + h + 9);
  });
  if (r.warn || r.blown) {
    g.font = `bold 11px ${FONT.mono}`;
    g.fillStyle = '#ffa020';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(r.blown ? 'CHECK ENGINE' : 'WARNING', cx, H * 0.56);
  }
}

/**
 * @param {CanvasRenderingContext2D} g @param {Reading} r @param {import('./specs.js').CarSpec} spec
 * @param {ReturnType<typeof gaugeScale>} tach
 */
function drawVfd(g, W, H, r, spec, tach, flash) {
  g.shadowBlur = 0;
  g.fillStyle = '#020a08';
  g.fillRect(0, 0, W, H);
  g.fillStyle = '#041410';
  g.fillRect(4, 4, W - 8, H - 8);
  const glow = (color) => {
    g.shadowColor = color;
    g.shadowBlur = 8;
    g.fillStyle = color;
  };
  const dim = (color) => {
    g.shadowBlur = 0;
    g.fillStyle = color;
  };
  const COLORS = { green: '#5aff8a', amber: '#ffb02e', red: '#ff3a2a' };
  const GHOST = { green: '#0c2a18', amber: '#2a1e08', red: '#2a0a08' };
  // Bar-graph tach across the top.
  const n = 36;
  const lit = segmentsLit(r.rpm, tach.max, n);
  const x0 = 12;
  const w = (W - 24) / n;
  for (let i = 0; i < n; i++) {
    const zone = tachZone(i, n, tach.max, spec.engine.redline);
    const h = 10 + (i / n) * 16;
    if (i < lit) glow(flash && zone !== 'red' ? '#ffffff' : COLORS[zone]);
    else dim(GHOST[zone]);
    g.fillRect(x0 + i * w + 1, 38 - h, w - 3, h);
  }
  dim('#3a8a5a');
  g.font = `10px ${FONT.mono}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  for (let v = 1000; v < tach.max; v += 1000) g.fillText(String(v / 1000), x0 + (v / tach.max) * (W - 24), 46);
  g.textAlign = 'left';
  g.fillText('x1000 RPM', x0, 56);
  // Speed in cyan, fourteen segments, with the unlit segments behind.
  g.textBaseline = 'alphabetic';
  g.font = `bold 40px ${FONT.seg14}`;
  g.textAlign = 'right';
  dim('#062226');
  g.fillText('~~~', W * 0.62, H * 0.84);
  glow('#46f0ff');
  g.fillText(String(Math.round(r.kmh)), W * 0.62, H * 0.84);
  dim('#2a8a9a');
  g.font = `11px ${FONT.mono}`;
  g.textAlign = 'left';
  g.fillText('km/h', W * 0.63, H * 0.82);
  // Gear in amber on the right.
  g.font = `bold 34px ${FONT.seg14}`;
  g.textAlign = 'center';
  dim('#2a1e08');
  g.fillText('~', W - 30, H * 0.84);
  if (r.blown) glow('#ff3a2a');
  else glow('#ffb02e');
  g.fillText(r.gear, W - 30, H * 0.84);
  // TURBO lamp and boost bar, fuel and temperature as segment bars on the left.
  g.font = `bold 11px ${FONT.mono}`;
  g.textAlign = 'left';
  if (r.boost > 0.3) glow('#ffb02e');
  else dim('#2a1e08');
  g.fillText('TURBO', 10, 72);
  const segBar = (label, v, y, color, ghost, warn) => {
    dim('#3a8a5a');
    g.font = `10px ${FONT.mono}`;
    g.fillText(label, 10, y + 6);
    const m = 8;
    const on = segmentsLit(v, 1, m);
    for (let i = 0; i < m; i++) {
      if (i < on) glow(warn ? '#ff3a2a' : color);
      else dim(ghost);
      g.fillRect(44 + i * 9, y, 7, 8);
    }
  };
  segBar('BST', Math.max(0, r.boost) / 1.0, 78, '#ffb02e', '#2a1e08', false);
  segBar('FUEL', r.fuel, 92, '#5aff8a', '#0c2a18', r.fuel < 0.15);
  segBar('TEMP', (r.temp - 60) / 70, 106, '#5aff8a', '#0c2a18', r.temp > 110);
  if (r.warn || r.blown) {
    glow('#ff3a2a');
    g.font = `bold 11px ${FONT.mono}`;
    g.textAlign = 'center';
    g.fillText(r.blown ? 'CHECK ENGINE' : 'CHECK', W * 0.5, H * 0.97);
  }
  g.shadowBlur = 0;
}
