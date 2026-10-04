/**
 * The HUD cluster styles other than the classic one (`cluster.js`), each the outside-view twin of a
 * car's own dashboard, drawn with the same painters as the cockpit (`vehicles/instruments.js`). Like
 * the classic one they float over the scene: no board or housing behind them, only the gauges.
 *
 * - `tuner` (Hayate): an aftermarket racing tach, black with red lit ticks and numerals and the speed
 *   in its LCD window, two small racing gauges for boost and temperature, a red fuel bar.
 * - `twin` (Rampart): two big cream dials with numerals and red needles in chrome rings, the gear in a
 *   small window between them over fuel and temperature bars, a shift lamp.
 * - `sport` (Vespera): one big yellow tach with the speed in a digital window in its open bottom; the
 *   gear, five shift lights and fuel and temperature bars beside it.
 * - `digital` (Tsurugi) and `vfd` (Hikari): the cockpit's LCD and fluorescent display with no glass
 *   behind them, leaned and tilted like a car display in Cyberpunk 2077, the lit segments glowing and
 *   the unlit ones a faint tint.
 *
 * Every style draws the warning lamps (CHECK, DMG, REV, ENG OFF, HOT) in its own look and the shift
 * light, in the classic cluster's 400 by 300 canvas, so the anchor and footprint stay the same.
 */

import { FONT } from '../render/fonts.js';
import { paintDial, paintNeedle, paintScreen, paintTunerReadout, readingOf } from '../vehicles/instruments.js';

/** @typedef {import('../vehicles/gauges.js').Gauges} Gauges */
/** @typedef {import('../vehicles/specs.js').CarSpec} CarSpec */
/** @typedef {'classic' | 'tuner' | 'twin' | 'sport' | 'digital' | 'vfd'} ClusterStyle */
/**
 * Paints a dial face; the Cluster passes one that caches each face as an image.
 * @typedef {(g: CanvasRenderingContext2D, cx: number, cy: number, m: number,
 *   type: import('../vehicles/dash.js').GaugeType, spec: CarSpec, face: import('../vehicles/dash.js').GaugeFace) => void} DialPainter
 */

/** @type {ClusterStyle[]} */
export const CLUSTER_STYLES = ['classic', 'tuner', 'twin', 'sport', 'digital', 'vfd'];

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

/** A dark shadow under floating text and bars, so they read over a lit road. */
function shade(g, on = true) {
  g.shadowColor = 'rgba(0, 0, 0, 0.85)';
  g.shadowBlur = on ? 4 : 0;
}

/** A chrome or steel ring round a dial. */
function ring(g, x, y, r, color, width) {
  g.strokeStyle = color;
  g.lineWidth = width;
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.stroke();
}

/**
 * The analog styles' lamps: only the lit ones, as small pills centered on x, so nothing is drawn
 * over the scene when all is well.
 * @param {CanvasRenderingContext2D} g @param {ReturnType<typeof warningLamps>} lamps
 */
function litPills(g, x, y, lamps) {
  const on = lamps.filter((l) => l.on);
  const w = 52;
  let px = x - (on.length * w) / 2;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = `bold 10px ${FONT.mono}`;
  for (const l of on) {
    const color = l.red ? '#ff3a2a' : '#ffa020';
    rrect(g, px + 2, y - 8, w - 4, 16, 3);
    g.fillStyle = color;
    g.shadowColor = color;
    g.shadowBlur = 8;
    g.fill();
    g.shadowBlur = 0;
    g.fillStyle = '#140a04';
    g.fillText(l.label, px + w / 2, y + 1);
    px += w;
  }
}

/**
 * The digital styles' lamps: every one as text, the lit ones glowing, the unlit a faint tint.
 * @param {CanvasRenderingContext2D} g @param {ReturnType<typeof warningLamps>} lamps @param {'lcd' | 'vfd'} kind
 */
function lampText(g, x0, x1, y, lamps, kind) {
  const step = (x1 - x0) / lamps.length;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = `bold 11px ${FONT.mono}`;
  lamps.forEach((l, i) => {
    const color = l.red ? '#ff3a2a' : '#ffa020';
    g.fillStyle = l.on ? color : kind === 'lcd' ? 'rgba(70, 232, 255, 0.2)' : 'rgba(255, 176, 46, 0.2)';
    g.shadowColor = color;
    g.shadowBlur = l.on ? 8 : 0;
    g.fillText(l.label, x0 + step * (i + 0.5), y);
  });
  g.shadowBlur = 0;
}

/** A short horizontal bar with a label, for fuel and temperature beside a dial. */
function hbar(g, label, x, y, w, frac, fill, warn) {
  shade(g);
  g.font = `bold 12px ${FONT.mono}`;
  g.textAlign = 'right';
  g.textBaseline = 'middle';
  g.fillStyle = fill;
  g.fillText(label, x - 6, y + 6);
  g.fillStyle = 'rgba(8, 8, 10, 0.7)';
  g.fillRect(x, y, w, 12);
  shade(g, false);
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
  if (style === 'tuner') drawTuner(g, gs, spec, t, dial, lamps);
  else if (style === 'twin') drawTwin(g, gs, spec, t, dial, lamps);
  else if (style === 'sport') drawSport(g, gs, spec, t, dial, lamps);
  else drawScreenStyle(g, style === 'vfd' ? 'vfd' : 'lcd', gs, spec, t, lamps);
  g.shadowBlur = 0;
  g.restore();
}

/** @param {CanvasRenderingContext2D} g @param {Gauges} gs @param {CarSpec} spec @param {number} t @param {DialPainter} dial */
function drawTuner(g, gs, spec, t, dial, lamps) {
  const shift = shiftLightsLit(gs, spec, 1, t) > 0;
  const gauge = (type, x, y, m, value, readout, flash) => {
    ring(g, x, y, m + 4, '#2a2c32', 9);
    ring(g, x, y, m + 4, flash ? '#ff4030' : '#c4c8d0', 5);
    if (flash) {
      g.shadowColor = '#ff4030';
      g.shadowBlur = 14;
      ring(g, x, y, m + 4, '#ff4030', 3);
      g.shadowBlur = 0;
    }
    dial(g, x, y, m, type, spec, 'tuner');
    paintTunerReadout(g, x, y, m, readout);
    paintNeedle(g, x, y, m, type, spec, value, '#ff3a20', 'tuner');
  };
  const cx = 280;
  const cy = 166;
  const R = 108;
  gauge('tach', cx, cy, R, gs.rpm, String(Math.round(gs.kmh)), shift);
  // The gear in white segments under the hub, above the 0, its unlit segments showing.
  g.font = `bold ${Math.round(R * 0.2)}px ${FONT.seg14}`;
  g.textAlign = 'center';
  g.textBaseline = 'alphabetic';
  g.fillStyle = 'rgba(255, 255, 255, 0.07)';
  g.fillText('~', cx - R * 0.05, cy + R * 0.38);
  g.fillStyle = gs.blown ? '#ff3a2a' : '#f4f8ff';
  g.shadowColor = g.fillStyle;
  g.shadowBlur = 8;
  g.fillText(gs.gear, cx - R * 0.05, cy + R * 0.38);
  g.shadowBlur = 0;
  const boost = gs.turbo ? gs.boost : gs.intake;
  gauge('boost', 88, 100, 50, boost, `${boost >= 0 ? '' : '-'}${Math.abs(boost).toFixed(1)}`, false);
  gauge('temp', 88, 214, 50, gs.temp ?? 84, String(Math.round(gs.temp ?? 84)), (gs.temp ?? 84) >= 115);
  // Fuel: ten red segments under the small gauges.
  const f = fuelOf(gs);
  const lit = Math.round(f * 10);
  shade(g);
  g.font = `bold 9px ${FONT.tech}`;
  g.textAlign = 'left';
  g.textBaseline = 'middle';
  g.fillStyle = '#ff3a26';
  g.fillText('FUEL', 40, 281);
  for (let i = 0; i < 10; i++) {
    const on = i < lit;
    g.fillStyle = on ? (f < 0.15 && Math.floor(t * 4) % 2 ? '#ffe6dc' : '#ff3a26') : 'rgba(255, 58, 38, 0.18)';
    g.shadowColor = on ? '#ff3a26' : 'rgba(0, 0, 0, 0.85)';
    g.shadowBlur = on ? 6 : 3;
    g.fillRect(76 + i * 7, 276, 5, 11);
  }
  g.shadowBlur = 0;
  litPills(g, cx, 30, lamps);
}

/** @param {CanvasRenderingContext2D} g @param {Gauges} gs @param {CarSpec} spec @param {number} t @param {DialPainter} dial */
function drawTwin(g, gs, spec, t, dial, lamps) {
  const R = 78;
  const y = 208;
  for (const [type, x, value] of /** @type {const} */ ([['speed', 96, gs.kmh], ['tach', 304, gs.rpm]])) {
    shade(g);
    ring(g, x, y, R + 4, '#cfcfd6', 6);
    shade(g, false);
    ring(g, x, y, R + 1, '#6a6a72', 1.5);
    dial(g, x, y, R, type, spec, 'white');
    paintNeedle(g, x, y, R, type, spec, value, '#d01010');
  }
  // Between the dials: the shift lamp, fuel and temperature bars, the gear window.
  const lit = shiftLightsLit(gs, spec, 1, t) > 0;
  g.fillStyle = lit ? '#ff3020' : 'rgba(80, 20, 14, 0.8)';
  g.shadowColor = '#ff3020';
  g.shadowBlur = lit ? 10 : 0;
  g.beginPath();
  g.arc(200, 150, 6, 0, Math.PI * 2);
  g.fill();
  const bars = [['F', fuelOf(gs), fuelOf(gs) < 0.15], ['T', tempOf(gs), (gs.temp ?? 84) > 110]];
  bars.forEach(([label, f, warn], i) => {
    const x = 187 + i * 20;
    shade(g);
    g.fillStyle = 'rgba(8, 8, 10, 0.75)';
    g.fillRect(x - 1, 166, 9, 62);
    shade(g, false);
    g.fillStyle = warn ? '#ff3a2a' : '#f2eee2';
    const fh = 58 * Math.max(0, Math.min(1, Number(f)));
    g.fillRect(x + 1, 226 - fh, 5, fh);
    shade(g);
    g.font = `bold 10px ${FONT.mono}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = '#f2eee2';
    g.fillText(String(label), x + 3.5, 238);
  });
  rrect(g, 184, 250, 32, 32, 4);
  g.fillStyle = 'rgba(4, 4, 6, 0.85)';
  g.fill();
  shade(g, false);
  g.strokeStyle = '#cfcfd6';
  g.lineWidth = 2;
  g.stroke();
  g.font = `bold 24px ${FONT.mono}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = gs.blown ? '#ff3a2a' : '#f2eee2';
  g.fillText(gs.gear, 200, 267);
  litPills(g, 200, 112, lamps);
}

/** @param {CanvasRenderingContext2D} g @param {Gauges} gs @param {CarSpec} spec @param {number} t @param {DialPainter} dial */
function drawSport(g, gs, spec, t, dial, lamps) {
  const cx = 262;
  const cy = 178;
  const R = 106;
  shade(g);
  ring(g, cx, cy, R + 4, '#2a2418', 7);
  shade(g, false);
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
  // Beside it: the gear, the shift lights, fuel and temperature, each floating on its own.
  shade(g);
  rrect(g, 52, 88, 64, 70, 8);
  g.fillStyle = 'rgba(6, 6, 6, 0.82)';
  g.fill();
  shade(g, false);
  g.strokeStyle = '#f2cc2a';
  g.lineWidth = 2;
  g.stroke();
  g.font = `bold 50px ${FONT.mono}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = gs.blown ? '#ff3a2a' : '#f6f2e6';
  g.fillText(gs.gear, 84, 125);
  const n = 5;
  const lit = shiftLightsLit(gs, spec, n, t);
  for (let i = 0; i < n; i++) {
    const on = i < lit;
    const color = i >= 3 || gs.shift ? '#ff3020' : '#3aff6a';
    g.fillStyle = on ? color : 'rgba(30, 30, 26, 0.8)';
    g.shadowColor = on ? color : 'rgba(0, 0, 0, 0.85)';
    g.shadowBlur = on ? 10 : 3;
    g.beginPath();
    g.arc(40 + i * 22, 178, 7, 0, Math.PI * 2);
    g.fill();
  }
  g.shadowBlur = 0;
  hbar(g, 'F', 48, 202, 94, fuelOf(gs), '#f2cc2a', fuelOf(gs) < 0.15);
  hbar(g, 'T', 48, 224, 94, tempOf(gs), '#f2cc2a', (gs.temp ?? 84) > 110);
  litPills(g, 90, 262, lamps.slice(0, 3));
  litPills(g, 90, 284, lamps.slice(3));
}

/**
 * The digital styles: the cockpit's screen with no glass behind it, leaned forward and rising to
 * the right like a car display in Cyberpunk 2077, the lamps along its top edge.
 * @param {CanvasRenderingContext2D} g @param {'lcd' | 'vfd'} kind @param {Gauges} gs @param {CarSpec} spec @param {number} t
 */
function drawScreenStyle(g, kind, gs, spec, t, lamps) {
  const sw = 128 * SCREEN_ASPECT[kind];
  const k = 330 / sw;
  const sh = 128 * k;
  g.save();
  g.translate(48, 292 - sh);
  g.transform(1, -0.07, -0.24, 1, 0, 0);
  lampText(g, 20, sw * k - 10, -10, lamps, kind);
  g.scale(k, k);
  paintScreen(g, kind, sw, 128, readingOf(gs, spec, t), spec, true);
  g.restore();
}
