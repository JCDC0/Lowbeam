/**
 * The HUD cluster styles other than the classic one (`cluster.js`), each the outside-view twin of a
 * car's own dashboard, drawn with the same painters as the cockpit (`vehicles/instruments.js`):
 *
 * - `twin` (Rampart): two big cream dials with numerals and red needles in a chrome-ringed housing,
 *   the gear in a window between them over small fuel and temperature bars and a shift lamp.
 * - `sport` (Vespera): one big yellow tach with the speed in a digital window inside it, the gear,
 *   five shift lights and fuel and temperature bars beside it.
 * - `digital` (Tsurugi): the modern LCD (`lcd`) in a glass bezel.
 * - `vfd` (Hikari): the 1984 fluorescent display (`vfd`) in its bezel.
 *
 * Every style draws the warning lamps (CHECK, DMG, REV, ENG OFF, HOT) in its own look and the shift
 * light. All of them fill the classic cluster's 400 by 300 canvas from the bottom, so the anchor and
 * footprint stay the same.
 */

import { FONT } from '../render/fonts.js';
import { paintDial, paintNeedle, paintScreen, readingOf } from '../vehicles/instruments.js';

/** @typedef {import('../vehicles/gauges.js').Gauges} Gauges */
/** @typedef {import('../vehicles/specs.js').CarSpec} CarSpec */
/** @typedef {'classic' | 'twin' | 'sport' | 'digital' | 'vfd'} ClusterStyle */
/**
 * Paints a dial face; the Cluster passes one that caches each face as an image.
 * @typedef {(g: CanvasRenderingContext2D, cx: number, cy: number, m: number,
 *   type: import('../vehicles/dash.js').GaugeType, spec: CarSpec, face: 'classic' | 'white' | 'yellow') => void} DialPainter
 */

/** @type {ClusterStyle[]} */
export const CLUSTER_STYLES = ['classic', 'twin', 'sport', 'digital', 'vfd'];

/** A car's own HUD style, or the override if one is chosen. @param {CarSpec} spec @param {string | null} [override] */
export function clusterStyleOf(spec, override = null) {
  const s = override && override !== 'car' ? override : spec.dash?.hud ?? 'classic';
  return /** @type {ClusterStyle} */ (CLUSTER_STYLES.includes(/** @type {ClusterStyle} */ (s)) ? s : 'classic');
}

const W = 400;
const H = 300;

/** Width over height of the cockpit screens, so the HUD copy is laid out the same. */
const SCREEN_ASPECT = { lcd: 2.375, vfd: 2.667 };

/**
 * The warning lamps, lit or not, in the order every style draws them.
 * @param {Gauges} gs @param {number} t
 * @returns {{ label: string, on: boolean, red: boolean }[]}
 */
export function warningLamps(gs, t) {
  const blink = Math.floor(t * 4) % 2 === 0;
  const fast = Math.floor(t * 12) % 2 === 0;
  return [
    { label: 'CHECK', on: !!gs.blown && blink, red: false },
    { label: 'DMG', on: (gs.damage ?? 0) > 0.3, red: false },
    { label: 'REV', on: (gs.overrev ?? 0) > 0 && fast, red: true },
    { label: 'ENG OFF', on: !gs.engineOn, red: true },
    { label: 'HOT', on: (gs.temp ?? 84) >= 115, red: true },
  ];
}

/**
 * How many of `n` shift lights are lit: they fill from 80 % of the upshift rpm to it and all
 * flash at it.
 * @param {Gauges} gs @param {CarSpec} spec @param {number} n @param {number} t
 */
export function shiftLightsLit(gs, spec, n, t) {
  if (!gs.engineOn) return 0;
  if (gs.shift || gs.limiter) return Math.floor(t * 12) % 2 === 0 ? n : 0;
  const top = spec.engine.shiftUp;
  const from = top * 0.8;
  return Math.max(0, Math.min(n, Math.floor(((gs.rpm - from) / (top - from)) * n)));
}

/** A rounded rectangle path. */
function rrect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.lineTo(x + w - r, y);
  g.arc(x + w - r, y + r, r, -Math.PI / 2, 0);
  g.lineTo(x + w, y + h - r);
  g.arc(x + w - r, y + h - r, r, 0, Math.PI / 2);
  g.lineTo(x + r, y + h);
  g.arc(x + r, y + h - r, r, Math.PI / 2, Math.PI);
  g.lineTo(x, y + r);
  g.arc(x + r, y + r, r, Math.PI, Math.PI * 1.5);
}

function housing(g, x, y, w, h, r, fill, edge, lw) {
  rrect(g, x, y, w, h, r);
  g.fillStyle = fill;
  g.fill();
  g.strokeStyle = edge;
  g.lineWidth = lw;
  g.stroke();
}

/**
 * The lamps in a row between x0 and x1, centered on y.
 * @param {CanvasRenderingContext2D} g @param {ReturnType<typeof warningLamps>} lamps
 * @param {'analog' | 'lcd' | 'vfd'} look
 */
function lampRow(g, x0, x1, y, lamps, look) {
  const step = (x1 - x0) / lamps.length;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  lamps.forEach((l, i) => {
    const x = x0 + step * (i + 0.5);
    const color = l.red ? '#ff3a2a' : '#ffa020';
    if (look === 'analog') {
      rrect(g, x - step / 2 + 3, y - 8, step - 6, 16, 3);
      g.fillStyle = l.on ? color : '#18181b';
      g.fill();
      g.font = `bold 10px ${FONT.mono}`;
      g.fillStyle = l.on ? '#140a04' : '#3c3c42';
      g.fillText(l.label, x, y + 1);
    } else {
      g.font = `bold 11px ${FONT.mono}`;
      if (look === 'vfd' && l.on) {
        g.shadowColor = color;
        g.shadowBlur = 8;
      }
      g.fillStyle = l.on ? color : look === 'vfd' ? '#2a1e08' : '#0f2a30';
      g.fillText(l.label, x, y);
      g.shadowBlur = 0;
    }
  });
}

/** A short horizontal bar with a label, for fuel and temperature beside analog dials. */
function hbar(g, label, x, y, w, frac, fill, warn) {
  g.font = `bold 12px ${FONT.mono}`;
  g.textAlign = 'right';
  g.textBaseline = 'middle';
  g.fillStyle = fill;
  g.fillText(label, x - 6, y + 6);
  g.fillStyle = '#0c0c0e';
  g.fillRect(x, y, w, 12);
  g.fillStyle = warn ? '#ff3a2a' : fill;
  g.fillRect(x + 2, y + 2, (w - 4) * Math.max(0, Math.min(1, frac)), 8);
}

const fuelOf = (gs) => (gs.tank > 0 ? gs.fuel / gs.tank : 0);
const tempOf = (gs) => ((gs.temp ?? 84) - 60) / 70;

/**
 * Draws one of the non-classic styles over the whole 400 by 300 canvas, scaled to w by h.
 * @param {CanvasRenderingContext2D} g @param {ClusterStyle} style @param {Gauges} gs @param {CarSpec} spec
 * @param {number} t seconds, for blinking @param {DialPainter} [dial] @param {number} [w] @param {number} [h]
 */
export function drawStyled(g, style, gs, spec, t, dial = paintDial, w = W, h = H) {
  g.clearRect(0, 0, w, h);
  g.save();
  const s = Math.min(w / W, h / H);
  g.translate((w - W * s) / 2, (h - H * s) / 2);
  g.scale(s, s);
  const lamps = warningLamps(gs, t);
  if (style === 'twin') drawTwin(g, gs, spec, t, dial, lamps);
  else if (style === 'sport') drawSport(g, gs, spec, t, dial, lamps);
  else drawScreenStyle(g, style === 'vfd' ? 'vfd' : 'lcd', gs, spec, t, lamps);
  g.restore();
}

/** @param {CanvasRenderingContext2D} g @param {Gauges} gs @param {CarSpec} spec @param {number} t @param {DialPainter} dial */
function drawTwin(g, gs, spec, t, dial, lamps) {
  housing(g, 8, 100, 384, 196, 40, 'rgba(10, 10, 12, 0.9)', '#8e8e96', 3);
  lampRow(g, 40, 360, 118, lamps, 'analog');
  const R = 78;
  const y = 212;
  for (const [type, x, value] of /** @type {const} */ ([['speed', 96, gs.kmh], ['tach', 304, gs.rpm]])) {
    g.strokeStyle = '#cfcfd6';
    g.lineWidth = 6;
    g.beginPath();
    g.arc(x, y, R + 4, 0, Math.PI * 2);
    g.stroke();
    dial(g, x, y, R, type, spec, 'white');
    paintNeedle(g, x, y, R, type, spec, value, '#d01010');
  }
  // Between the dials: the shift lamp, fuel and temperature bars, the gear window.
  const lit = shiftLightsLit(gs, spec, 1, t) > 0;
  g.fillStyle = lit ? '#ff3020' : '#2a0c08';
  g.beginPath();
  g.arc(200, 150, 7, 0, Math.PI * 2);
  g.fill();
  const bars = [['F', fuelOf(gs), fuelOf(gs) < 0.15], ['T', tempOf(gs), (gs.temp ?? 84) > 110]];
  bars.forEach(([label, f, warn], i) => {
    const x = 186 + i * 22;
    g.fillStyle = '#050506';
    g.fillRect(x - 1, 166, 9, 66);
    g.fillStyle = warn ? '#ff3a2a' : '#f2eee2';
    const fh = 62 * Math.max(0, Math.min(1, Number(f)));
    g.fillRect(x + 1, 230 - fh, 5, fh);
    g.font = `bold 10px ${FONT.mono}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = '#b8b4a8';
    g.fillText(String(label), x + 3.5, 242);
  });
  g.fillStyle = '#020203';
  g.fillRect(182, 252, 36, 34);
  g.strokeStyle = '#5a5a62';
  g.lineWidth = 2;
  g.strokeRect(182, 252, 36, 34);
  g.font = `bold 26px ${FONT.mono}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = gs.blown ? '#ff3a2a' : '#f2eee2';
  g.fillText(gs.gear, 200, 270);
}

/** @param {CanvasRenderingContext2D} g @param {Gauges} gs @param {CarSpec} spec @param {number} t @param {DialPainter} dial */
function drawSport(g, gs, spec, t, dial, lamps) {
  housing(g, 8, 56, 384, 240, 44, 'rgba(12, 10, 6, 0.9)', '#4a4130', 3);
  const cx = 262;
  const cy = 178;
  const R = 106;
  g.strokeStyle = '#2a2418';
  g.lineWidth = 6;
  g.beginPath();
  g.arc(cx, cy, R + 4, 0, Math.PI * 2);
  g.stroke();
  dial(g, cx, cy, R, 'tach', spec, 'yellow');
  // The speed in a black window in the open bottom of the tach, clear of the numerals.
  rrect(g, cx - 40, cy + 62, 80, 34, 5);
  g.fillStyle = '#0a0a0a';
  g.fill();
  g.font = `bold 26px ${FONT.seg7}`;
  g.textAlign = 'right';
  g.textBaseline = 'alphabetic';
  g.fillStyle = '#2a1e08';
  g.fillText('888', cx + 34, cy + 91);
  g.fillStyle = '#ffb02e';
  g.fillText(String(Math.round(gs.kmh)), cx + 34, cy + 91);
  g.font = `bold 10px ${FONT.mono}`;
  g.textAlign = 'center';
  g.fillStyle = '#141414';
  g.fillText('km/h', cx, cy + 54);
  paintNeedle(g, cx, cy, R, 'tach', spec, gs.rpm, '#d01010');
  // Left column: the gear, the shift lights, fuel and temperature, the lamps.
  rrect(g, 44, 74, 72, 76, 8);
  g.fillStyle = '#060606';
  g.fill();
  g.strokeStyle = '#f2cc2a';
  g.lineWidth = 2;
  g.stroke();
  g.font = `bold 54px ${FONT.mono}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = gs.blown ? '#ff3a2a' : '#f6f2e6';
  g.fillText(gs.gear, 80, 114);
  const n = 5;
  const lit = shiftLightsLit(gs, spec, n, t);
  for (let i = 0; i < n; i++) {
    g.fillStyle = i < lit ? (i >= 3 || gs.shift ? '#ff3020' : '#3aff6a') : '#1a1a16';
    g.beginPath();
    g.arc(36 + i * 22, 170, 7, 0, Math.PI * 2);
    g.fill();
  }
  hbar(g, 'F', 44, 192, 94, fuelOf(gs), '#f2cc2a', fuelOf(gs) < 0.15);
  hbar(g, 'T', 44, 214, 94, tempOf(gs), '#f2cc2a', (gs.temp ?? 84) > 110);
  lampRow(g, 22, 146, 248, lamps.slice(0, 3), 'analog');
  lampRow(g, 22, 146, 270, lamps.slice(3), 'analog');
}

/**
 * The digital styles: the same screen the cockpit shows, in a bezel with the lamps above it.
 * @param {CanvasRenderingContext2D} g @param {'lcd' | 'vfd'} kind @param {Gauges} gs @param {CarSpec} spec @param {number} t
 */
function drawScreenStyle(g, kind, gs, spec, t, lamps) {
  const sw = 128 * SCREEN_ASPECT[kind];
  const k = 380 / sw;
  const sh = 128 * k;
  const top = 290 - sh;
  housing(g, 4, top - 34, 392, sh + 40, kind === 'lcd' ? 22 : 14, kind === 'lcd' ? '#050608' : '#0a0c0b', kind === 'lcd' ? '#1d2a30' : '#2a2f2c', 3);
  lampRow(g, 30, 370, top - 16, lamps, kind === 'lcd' ? 'lcd' : 'vfd');
  g.save();
  g.translate(10, top);
  g.scale(k, k);
  paintScreen(g, kind, sw, 128, readingOf(gs, spec, t), spec);
  g.restore();
}
