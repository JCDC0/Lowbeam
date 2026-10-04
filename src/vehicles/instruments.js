/**
 * Painting the instruments onto a 2D canvas, shared by the cockpit (`cockpit.js`, `screens.js`) and
 * the HUD cluster in the outside views (`ui/cluster-styles.js`), so a car's gauges look the same
 * from both. Nothing here touches three.js or creates DOM; it only draws into a context it is given.
 *
 * - `paintDial`: a round gauge face (classic black, white, yellow) with ticks, the red zone and, on
 *   the white and yellow faces, numerals in Share Tech Mono.
 * - `paintNeedle`: a needle and hub over a face.
 * - `paintScreen`: the digital clusters, `lcd` (the Tsurugi's modern one) and `vfd` (the Hikari's
 *   1984 vacuum fluorescent display), laid out for a screen 128 px tall.
 */

import { FONT } from '../render/fonts.js';
import { gaugeScale, needleAngle, segmentsLit, tachZone } from './dash.js';

/** @typedef {import('./specs.js').CarSpec} CarSpec */

/**
 * What a screen shows, from the gauge readings (`gauges.js`).
 * @typedef {{ kmh: number, rpm: number, gear: string, boost: number, fuel: number, temp: number,
 *   shift: boolean, limiter: boolean, warn: boolean, blown: boolean, time: number }} Reading
 */

/** How each face is painted: dial, ticks, red zone, numerals (only on the big dials), needle. */
export const FACES = {
  classic: { inner: '#1a1c22', outer: '#0b0c0f', tick: '#e8e4da', red: '#d0201a', numerals: false, needle: 0xff5a1e },
  white: { inner: '#f2eee2', outer: '#d8d2c0', tick: '#141414', red: '#c01818', numerals: true, needle: 0xd01010 },
  yellow: { inner: '#f2cc2a', outer: '#d8a814', tick: '#141414', red: '#c01818', numerals: true, needle: 0xd01010 },
};

/**
 * The reading a screen draws, from the gauges.
 * @param {import('./gauges.js').Gauges} g @param {CarSpec} spec @param {number} time
 * @returns {Reading}
 */
export function readingOf(g, spec, time) {
  return {
    kmh: g.kmh, rpm: g.rpm, gear: g.gear, boost: g.engineOn ? g.boost ?? 0 : 0, fuel: g.fuel / spec.fuel.tank, temp: g.temp,
    shift: !!g.shift, limiter: !!g.limiter, blown: !!g.blown, warn: g.damage > 0.3 || g.temp > 115 || !g.engineOn, time,
  };
}

/**
 * Paints a gauge face of radius `m` centered on (cx, cy): the dial, ticks, the red zone, and on
 * the white and yellow faces the numerals (the classic black face has none: the needle against the
 * ticks is enough). `square` fills the square around it first, as a texture wants.
 * @param {CanvasRenderingContext2D} g @param {number} cx @param {number} cy @param {number} m
 * @param {import('./dash.js').GaugeType} type @param {CarSpec} spec @param {keyof typeof FACES} [face]
 * @param {boolean} [square]
 */
export function paintDial(g, cx, cy, m, type, spec, face = 'classic', square = false) {
  const F = FACES[face];
  const sc = gaugeScale(type, spec);
  if (square) {
    g.fillStyle = '#07080a';
    g.fillRect(cx - m, cy - m, m * 2, m * 2);
  }
  const grad = g.createRadialGradient(cx, cy - m * 0.15, 4, cx, cy, m);
  grad.addColorStop(0, F.inner);
  grad.addColorStop(1, F.outer);
  g.fillStyle = grad;
  g.beginPath();
  g.arc(cx, cy, m - 1, 0, Math.PI * 2);
  g.fill();
  const toXY = (a, rr) => [cx + Math.sin(a) * rr, cy - Math.cos(a) * rr];
  const k = m / 64;
  const R = m - 6 * (m / (F.numerals ? 96 : 64));
  if (sc.red < sc.max) {
    g.strokeStyle = F.red;
    g.lineWidth = (sc.small ? 7 : 6) * k;
    g.beginPath();
    const a0 = needleAngle(sc, sc.red) - Math.PI / 2;
    const a1 = needleAngle(sc, sc.max) - Math.PI / 2;
    g.arc(cx, cy, R - 3 * k, a0, a1);
    g.stroke();
  }
  g.strokeStyle = F.tick;
  for (let v = sc.min; v <= sc.max + 1e-6; v += sc.minor) {
    const major = Math.abs(((v - sc.min) / sc.major) - Math.round((v - sc.min) / sc.major)) < 1e-6;
    const a = needleAngle(sc, v);
    const [x0, y0] = toXY(a, R);
    const [x1, y1] = toXY(a, R - (major ? 13 : 7) * k);
    g.lineWidth = (major ? 4 : 2) * k;
    g.beginPath();
    g.moveTo(x0, y0);
    g.lineTo(x1, y1);
    g.stroke();
    // Numerals on every major tick of the tach, every other one on the speedometer (three digits).
    const step = Math.round((v - sc.min) / sc.major);
    if (major && F.numerals && !sc.small && (type === 'tach' || (type === 'speed' && step % 2 === 0))) {
      const [tx, ty] = toXY(a, R - 24 * k);
      g.fillStyle = F.tick;
      g.font = `bold ${Math.round((type === 'tach' ? 17 : 13) * k)}px ${FONT.mono}`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(String(Math.round(v / sc.div)), tx, ty);
    }
  }
  if (F.numerals && !sc.small) {
    g.fillStyle = F.tick;
    g.font = `${Math.round(11 * k)}px ${FONT.mono}`;
    g.textAlign = 'center';
    g.fillText(sc.label, cx, type === 'tach' ? cy - R * 0.3 : cy + R * 0.42);
  }
}

/**
 * A needle from just behind the hub to near the rim, and the hub over it.
 * @param {CanvasRenderingContext2D} g @param {number} cx @param {number} cy @param {number} m
 * @param {import('./dash.js').GaugeType} type @param {CarSpec} spec @param {number} value
 * @param {string} color
 */
export function paintNeedle(g, cx, cy, m, type, spec, value, color) {
  const a = needleAngle(gaugeScale(type, spec), value);
  const s = Math.sin(a);
  const c = Math.cos(a);
  g.strokeStyle = color;
  g.lineWidth = Math.max(2, m * 0.045);
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(cx - s * m * 0.16, cy + c * m * 0.16);
  g.lineTo(cx + s * m * 0.84, cy - c * m * 0.84);
  g.stroke();
  g.lineCap = 'butt';
  g.fillStyle = '#101012';
  g.beginPath();
  g.arc(cx, cy, Math.max(4, m * 0.09), 0, Math.PI * 2);
  g.fill();
}

/**
 * Paints a digital cluster over the whole W by H area (laid out for H = 128).
 * @param {CanvasRenderingContext2D} g @param {'lcd' | 'vfd'} kind @param {number} W @param {number} H
 * @param {Reading} r @param {CarSpec} spec
 */
export function paintScreen(g, kind, W, H, r, spec) {
  const flash = (r.shift || r.limiter) && Math.floor(r.time * 10) % 2 === 0;
  const tach = gaugeScale('tach', spec);
  if (kind === 'lcd') drawLcd(g, W, H, r, spec, tach, flash);
  else drawVfd(g, W, H, r, spec, tach, flash);
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
function drawLcd(g, W, H, r, spec, tach, flash) {
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
    g.textAlign = 'left';
    g.textBaseline = 'middle';
    g.fillText(r.blown ? 'CHECK ENGINE' : 'WARNING', 9, 14);
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
