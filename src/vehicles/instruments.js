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
import { dialAngle, gaugeScale, segmentsLit, tachZone } from './dash.js';

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
  tuner: { inner: '#1c1c21', outer: '#040405', tick: '#ff3a26', red: '#ffe6dc', numerals: true, needle: 0xff3020 },
};

/**
 * The warning and gauge symbols, drawn as strokes so they read at any size: `engine` (check
 * engine), `wrench` (damage), `overrev` (a gauge pinned), `battery` (engine off: no charge), `temp`
 * (a thermometer in coolant), `fuel` (a pump), `turbo` (a snail), `nitrous` (a bottle with its
 * valve). Centered on (x, y), `size` across.
 * @param {CanvasRenderingContext2D} g @param {IconName} name @param {number} x @param {number} y
 * @param {number} size @param {string} color @param {number} [glow] blur of the glow, 0 for none
 */
export function paintIcon(g, name, x, y, size, color, glow = 0) {
  const u = size / 24;
  const path = (pts, close = true) => {
    g.beginPath();
    pts.forEach(([a, b], i) => (i ? g.lineTo(x + a * u, y + b * u) : g.moveTo(x + a * u, y + b * u)));
    if (close) g.closePath();
    g.stroke();
  };
  g.strokeStyle = color;
  g.fillStyle = color;
  g.lineWidth = Math.max(1, 2 * u);
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.shadowColor = color;
  g.shadowBlur = glow;
  if (name === 'engine') {
    path([[-8, -2], [-6, -2], [-6, -5], [-3, -5], [-3, -8], [3, -8], [3, -5], [6, -5], [8, -3], [10, -3], [10, 4], [8, 4], [6, 7], [-3, 7], [-5, 4], [-8, 4]]);
    path([[-11, -3], [-11, 5]], false);
    path([[-11, 1], [-8, 1]], false);
  } else if (name === 'wrench') {
    g.lineWidth = Math.max(1, 3.2 * u);
    path([[-8, 8], [2, -2]], false);
    g.lineWidth = Math.max(1, 2.6 * u);
    g.beginPath();
    g.arc(x + 5 * u, y - 5 * u, 4.5 * u, -Math.PI / 4 + 0.8, -Math.PI / 4 - 0.8 + Math.PI * 2);
    g.stroke();
  } else if (name === 'overrev') {
    g.beginPath();
    g.arc(x, y + 5 * u, 11 * u, Math.PI * 1.05, Math.PI * 1.95);
    g.stroke();
    path([[-9, -1], [-7, 1]], false);
    path([[9, -1], [7, 1]], false);
    g.lineWidth = Math.max(1, 2.6 * u);
    path([[0, 5], [8, -3]], false);
    g.beginPath();
    g.arc(x, y + 5 * u, 2.4 * u, 0, Math.PI * 2);
    g.fill();
  } else if (name === 'battery') {
    g.strokeRect(x - 10 * u, y - 5 * u, 20 * u, 13 * u);
    g.fillRect(x - 7 * u, y - 8 * u, 4 * u, 3 * u);
    g.fillRect(x + 3 * u, y - 8 * u, 4 * u, 3 * u);
    path([[-7, 1.5], [-3, 1.5]], false);
    path([[3, 1.5], [7, 1.5]], false);
    path([[5, -0.5], [5, 3.5]], false);
  } else if (name === 'temp') {
    g.lineWidth = Math.max(1, 2.6 * u);
    path([[0, -10], [0, 3]], false);
    g.beginPath();
    g.arc(x, y + 5 * u, 3.4 * u, 0, Math.PI * 2);
    g.fill();
    g.lineWidth = Math.max(1, 1.8 * u);
    path([[2, -7], [5, -7]], false);
    path([[2, -3], [5, -3]], false);
    path([[-11, 10], [-9, 8], [-7, 10], [-5, 8]], false);
    path([[5, 8], [7, 10], [9, 8], [11, 10]], false);
  } else if (name === 'fuel') {
    g.strokeRect(x - 9 * u, y - 9 * u, 11 * u, 19 * u);
    g.fillRect(x - 7 * u, y - 7 * u, 7 * u, 5 * u);
    path([[2, -5], [6, -5], [8, -3], [8, 6], [6, 8]], false);
  } else if (name === 'nitrous') {
    path([[-4, -5], [-5, -3], [-5, 10], [5, 10], [5, -3], [4, -5], [2, -6], [-2, -6]]);
    g.fillRect(x - 2 * u, y - 9 * u, 4 * u, 3 * u);
    path([[0, -9], [0, -11], [6, -11]], false);
    path([[-5, 2], [5, 2]], false);
  } else {
    g.beginPath();
    g.arc(x, y, 9 * u, 0, Math.PI * 1.6);
    g.stroke();
    g.beginPath();
    g.arc(x, y, 4.2 * u, 0, Math.PI * 2);
    g.stroke();
    path([[2.8, -8.6], [11, -8.6], [11, -3]], false);
  }
  g.shadowBlur = 0;
  g.lineCap = 'butt';
  g.lineJoin = 'miter';
}

/** @typedef {'engine' | 'wrench' | 'overrev' | 'battery' | 'temp' | 'fuel' | 'turbo' | 'nitrous'} IconName */

/** The symbol for a gauge's label. @type {Partial<Record<import('./dash.js').GaugeType, IconName>>} */
const GAUGE_ICON = { fuel: 'fuel', temp: 'temp', boost: 'turbo' };

/** Units under a tuner gauge's readout. */
const TUNER_UNIT = { tach: 'km/h', speed: 'km/h', boost: 'bar', temp: '°C', fuel: '%', oil: 'bar', volt: 'V' };

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
  if (face === 'tuner') {
    paintTuner(g, cx, cy, m, type, sc);
    return;
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
    const a0 = dialAngle(sc, sc.red, face) - Math.PI / 2;
    const a1 = dialAngle(sc, sc.max, face) - Math.PI / 2;
    g.arc(cx, cy, R - 3 * k, a0, a1);
    g.stroke();
  }
  g.strokeStyle = F.tick;
  for (let v = sc.min; v <= sc.max + 1e-6; v += sc.minor) {
    const major = Math.abs(((v - sc.min) / sc.major) - Math.round((v - sc.min) / sc.major)) < 1e-6;
    const a = dialAngle(sc, v, face);
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
 * The aftermarket racing face: black, every tick and numeral lit red (white from the redline on),
 * X1000 and the unit word in red, and the dark LCD window in the open lower right with its unlit
 * segments showing. The live digits go on with `paintTunerReadout`.
 * @param {CanvasRenderingContext2D} g @param {number} cx @param {number} cy @param {number} m
 * @param {import('./dash.js').GaugeType} type @param {ReturnType<typeof gaugeScale>} sc
 */
function paintTuner(g, cx, cy, m, type, sc) {
  const F = FACES.tuner;
  const k = m / 64;
  const grad = g.createRadialGradient(cx, cy - m * 0.25, 2, cx, cy, m);
  grad.addColorStop(0, F.inner);
  grad.addColorStop(1, F.outer);
  g.fillStyle = grad;
  g.beginPath();
  g.arc(cx, cy, m - 1, 0, Math.PI * 2);
  g.fill();
  const toXY = (a, rr) => [cx + Math.sin(a) * rr, cy - Math.cos(a) * rr];
  const R = m - 5 * k;
  for (let v = sc.min; v <= sc.max + 1e-6; v += sc.minor) {
    const major = Math.abs(((v - sc.min) / sc.major) - Math.round((v - sc.min) / sc.major)) < 1e-6;
    const color = v >= sc.red - 1e-6 ? F.red : F.tick;
    const a = dialAngle(sc, v, 'tuner');
    const [x0, y0] = toXY(a, R);
    const [x1, y1] = toXY(a, R - (major ? 14 : 7) * k);
    g.strokeStyle = color;
    g.shadowColor = color;
    g.shadowBlur = 4 * k;
    g.lineWidth = (major ? 3.6 : 1.8) * k;
    g.beginPath();
    g.moveTo(x0, y0);
    g.lineTo(x1, y1);
    g.stroke();
    if (major && !sc.small) {
      const [tx, ty] = toXY(a, R - 25 * k);
      g.fillStyle = color;
      g.font = `bold ${Math.round(13 * k)}px ${FONT.tech}`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(String(Math.round((v / sc.div) * 10) / 10), tx, ty);
    }
  }
  g.fillStyle = F.tick;
  g.shadowColor = F.tick;
  g.textBaseline = 'middle';
  g.font = `bold ${Math.round(6 * k)}px ${FONT.tech}`;
  if (type === 'tach') {
    g.textAlign = 'center';
    g.fillText('X1000', cx - m * 0.25, cy + m * 0.06);
  }
  g.textAlign = 'right';
  g.font = `bold ${Math.round(9 * k)}px ${FONT.tech}`;
  const icon = GAUGE_ICON[type];
  if (icon) paintIcon(g, icon, cx + m * 0.48, cy + m * 0.08, m * 0.3, F.tick, 4 * k);
  else g.fillText(type === 'tach' ? 'RPM' : sc.label, cx + m * 0.78, cy + m * 0.16);
  g.shadowBlur = 0;
  const b = tunerBox(cx, cy, m);
  g.fillStyle = '#08090b';
  g.fillRect(b.x, b.y, b.w, b.h);
  g.strokeStyle = '#26282e';
  g.lineWidth = Math.max(1, k);
  g.strokeRect(b.x, b.y, b.w, b.h);
  paintTunerReadout(g, cx, cy, m, '888', 'rgba(255, 255, 255, 0.07)', false);
  g.fillStyle = F.tick;
  g.font = `${Math.round(6 * k)}px ${FONT.mono}`;
  g.textAlign = 'right';
  g.textBaseline = 'top';
  g.fillText(TUNER_UNIT[type] ?? '', b.x + b.w, b.y + b.h + 2 * k);
}

/** Where a tuner gauge's LCD window sits. */
function tunerBox(cx, cy, m) {
  return { x: cx + m * 0.14, y: cy + m * 0.27, w: m * 0.62, h: m * 0.32 };
}

/**
 * The live digits in a tuner gauge's LCD window, white with a glow.
 * @param {CanvasRenderingContext2D} g @param {number} cx @param {number} cy @param {number} m
 * @param {string} text @param {string} [color] @param {boolean} [glow]
 */
export function paintTunerReadout(g, cx, cy, m, text, color = '#f4f8ff', glow = true) {
  const b = tunerBox(cx, cy, m);
  g.font = `bold ${Math.round(b.h * 0.78)}px ${FONT.seg7}`;
  g.textAlign = 'right';
  g.textBaseline = 'alphabetic';
  g.fillStyle = color;
  g.shadowColor = color;
  g.shadowBlur = glow ? m * 0.08 : 0;
  g.fillText(text, b.x + b.w - m * 0.03, b.y + b.h * 0.88);
  g.shadowBlur = 0;
}

/**
 * A needle from just behind the hub to near the rim, and the hub over it. On the tuner face it is a
 * lit red bar with a glow.
 * @param {CanvasRenderingContext2D} g @param {number} cx @param {number} cy @param {number} m
 * @param {import('./dash.js').GaugeType} type @param {CarSpec} spec @param {number} value
 * @param {string} color @param {import('./dash.js').GaugeFace} [face]
 */
export function paintNeedle(g, cx, cy, m, type, spec, value, color, face) {
  const a = dialAngle(gaugeScale(type, spec), value, face);
  const s = Math.sin(a);
  const c = Math.cos(a);
  g.strokeStyle = color;
  g.lineWidth = Math.max(2, m * (face === 'tuner' ? 0.035 : 0.045));
  g.lineCap = 'round';
  if (face === 'tuner') {
    g.shadowColor = color;
    g.shadowBlur = m * 0.1;
  }
  g.beginPath();
  g.moveTo(cx - s * m * 0.16, cy + c * m * 0.16);
  g.lineTo(cx + s * m * 0.84, cy - c * m * 0.84);
  g.stroke();
  g.shadowBlur = 0;
  g.lineCap = 'butt';
  g.fillStyle = '#101012';
  g.beginPath();
  g.arc(cx, cy, Math.max(4, m * 0.09), 0, Math.PI * 2);
  g.fill();
}

/**
 * Paints a digital cluster over the whole W by H area (laid out for H = 128). `bare` leaves out the
 * glass behind it and draws the unlit segments as a faint tint of their lit color, so it floats over
 * the scene (the HUD, after Cyberpunk 2077's car displays); the lit elements glow.
 * @param {CanvasRenderingContext2D} g @param {'lcd' | 'vfd'} kind @param {number} W @param {number} H
 * @param {Reading} r @param {CarSpec} spec @param {boolean} [bare]
 */
export function paintScreen(g, kind, W, H, r, spec, bare = false) {
  const flash = (r.shift || r.limiter) && Math.floor(r.time * 10) % 2 === 0;
  const tach = gaugeScale('tach', spec);
  const c = bare ? (/** @type {string} */ x) => BARE[x] ?? x : (/** @type {string} */ x) => x;
  if (kind === 'lcd') drawLcd(g, W, H, r, spec, tach, flash, c, bare);
  else drawVfd(g, W, H, r, spec, tach, flash, c, bare);
  g.shadowBlur = 0;
}

/** The unlit colors on glass, and what they become with no glass behind them. */
const BARE = {
  '#2a0808': 'rgba(255, 58, 42, 0.16)',
  '#08262c': 'rgba(70, 232, 255, 0.16)',
  '#0a1a1e': 'rgba(232, 251, 255, 0.09)',
  '#0c2a18': 'rgba(90, 255, 138, 0.14)',
  '#2a1e08': 'rgba(255, 176, 46, 0.15)',
  '#2a0a08': 'rgba(255, 58, 42, 0.15)',
  '#062226': 'rgba(70, 240, 255, 0.10)',
  '#3a8a5a': '#6ac88a',
  '#5a8a94': '#7ab8c4',
};

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
function drawLcd(g, W, H, r, spec, tach, flash, c, bare) {
  if (!bare) {
    g.fillStyle = '#020405';
    g.fillRect(0, 0, W, H);
    g.strokeStyle = '#0e2a33';
    g.lineWidth = 2;
    g.strokeRect(2, 2, W - 4, H - 4);
  }
  const glow = (on) => {
    g.shadowColor = /** @type {string} */ (g.fillStyle);
    g.shadowBlur = bare && on ? 4 : 0;
  };
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
    g.fillStyle = i < lit ? (red ? '#ff3a2a' : flash ? '#ffffff' : '#46e8ff') : c(red ? '#2a0808' : '#08262c');
    glow(i < lit);
    g.fill();
  }
  glow(false);
  g.font = `11px ${FONT.mono}`;
  g.fillStyle = c('#5a8a94');
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  for (let v = 0; v <= tach.max; v += 1000) {
    const a = Math.PI * (1.08 + (v / tach.max) * 0.84);
    g.fillText(String(v / 1000), cx + Math.cos(a) * (R - 21), cy + Math.sin(a) * (R - 21));
  }
  // Speed under the arc, its unit beneath.
  g.shadowColor = '#46e8ff';
  g.shadowBlur = bare ? 4 : 0;
  segDigits(g, String(Math.round(r.kmh)), '888', cx + 38, H * 0.8, 36, FONT.seg7, '#e8fbff', c('#0a1a1e'));
  g.shadowBlur = 0;
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
  g.fillStyle = c('#0a1a1e');
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
    const x = 9 + i * 15;
    const top = H * 0.3;
    const h = H * 0.42;
    g.fillStyle = c('#08262c');
    g.fillRect(x, top, 7, h);
    const f = Math.max(0, Math.min(1, Number(v)));
    g.fillStyle = String(color);
    g.fillRect(x, top + h * (1 - f), 7, h * f);
    const icon = /** @type {IconName} */ ({ B: 'turbo', F: 'fuel', T: 'temp' }[String(label)]);
    paintIcon(g, icon, x + 3.5, top + h + 10, 12, f > 0 && String(color) === '#ff3a2a' ? '#ff3a2a' : c('#5a8a94'));
  });
  if (r.warn || r.blown) paintIcon(g, 'engine', 16, 14, 16, r.blown ? '#ff3a2a' : '#ffa020', bare ? 6 : 0);
}

/**
 * @param {CanvasRenderingContext2D} g @param {Reading} r @param {import('./specs.js').CarSpec} spec
 * @param {ReturnType<typeof gaugeScale>} tach
 */
function drawVfd(g, W, H, r, spec, tach, flash, c, bare) {
  g.shadowBlur = 0;
  if (!bare) {
    g.fillStyle = '#020a08';
    g.fillRect(0, 0, W, H);
    g.fillStyle = '#041410';
    g.fillRect(4, 4, W - 8, H - 8);
  }
  const glow = (color) => {
    g.shadowColor = color;
    g.shadowBlur = bare ? 5 : 8;
    g.fillStyle = color;
  };
  const dim = (color) => {
    g.shadowBlur = 0;
    g.fillStyle = c(color);
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
  // Boost (its turbo symbol lights on boost, the old TURBO lamp), fuel and temperature as segment bars.
  const segBar = (icon, v, y, color, ghost, warn, lit) => {
    paintIcon(g, icon, 17, y + 4, 12, lit ? (warn ? '#ff3a2a' : color) : c('#3a8a5a'), lit ? 6 : 0);
    const m = 8;
    const on = segmentsLit(v, 1, m);
    for (let i = 0; i < m; i++) {
      if (i < on) glow(warn ? '#ff3a2a' : color);
      else dim(ghost);
      g.fillRect(32 + i * 9, y, 7, 8);
    }
  };
  segBar('turbo', Math.max(0, r.boost) / 1.0, 74, '#ffb02e', '#2a1e08', false, r.boost > 0.3);
  segBar('fuel', r.fuel, 90, '#5aff8a', '#0c2a18', r.fuel < 0.15, r.fuel < 0.15);
  segBar('temp', (r.temp - 60) / 70, 106, '#5aff8a', '#0c2a18', r.temp > 110, r.temp > 110);
  if (r.warn || r.blown) paintIcon(g, 'engine', W * 0.5, H * 0.93, 14, r.blown ? '#ff3a2a' : '#ffb02e', 8);
  g.shadowBlur = 0;
}
