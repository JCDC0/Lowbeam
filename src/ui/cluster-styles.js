/**
 * The HUD cluster styles other than the classic one (`cluster.js`), each the outside-view twin of a
 * car's own dashboard, drawn with the same painters as the cockpit (`vehicles/instruments.js`). Like
 * the classic one they float over the scene: no board or housing behind them, only the gauges.
 *
 * - `tuner` (Hayate): an aftermarket racing tach, black with red lit ticks and numerals, the speed in
 *   its LCD window and the gear under its hub; small racing gauges for boost, temperature and fuel.
 * - `twin` (Rampart): two big cream dials with numerals and red needles in chrome rings, the gear in a
 *   window in the tach's open bottom, small cream fuel and temperature gauges at the outer corners.
 * - `sport` (Vespera): one big yellow tach with the gear and the speed in one window in its open
 *   bottom; five shift lights and small yellow fuel and temperature gauges beside it.
 * - `digital` (Tsurugi) and `vfd` (Hikari): the cockpit's LCD and fluorescent display with no glass
 *   behind them, leaned and tilted like a car display in Cyberpunk 2077, the lit segments glowing and
 *   the unlit ones a faint tint.
 *
 * Warnings are symbols (`paintIcon`), never words: check engine, damage, over-rev, engine off, hot,
 * low fuel. Every symbol has its own fixed place and shows faintly when off, so one lighting up never
 * moves another. Everything fits the classic cluster's 400 by 300 canvas, the same anchor and footprint.
 */

import { FONT } from '../render/fonts.js';
import { paintDial, paintIcon, paintNeedle, paintScreen, paintTunerReadout, readingOf } from '../vehicles/instruments.js';

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
 * The warning lamps, lit or not, in the order every style draws them, each with its symbol.
 * @param {Gauges} gs @param {number} t
 * @returns {{ label: string, icon: import('../vehicles/instruments.js').IconName, on: boolean, red: boolean }[]}
 */
export function warningLamps(gs, t) {
  const blink = Math.floor(t * 4) % 2 === 0;
  const fast = Math.floor(t * 12) % 2 === 0;
  return [
    { label: 'CHECK', icon: 'engine', on: !!gs.blown && blink, red: false },
    { label: 'DMG', icon: 'wrench', on: (gs.damage ?? 0) > 0.3, red: false },
    { label: 'REV', icon: 'overrev', on: (gs.overrev ?? 0) > 0 && fast, red: true },
    { label: 'ENG OFF', icon: 'battery', on: !gs.engineOn, red: true },
    { label: 'HOT', icon: 'temp', on: (gs.temp ?? 84) >= 115, red: true },
    { label: 'FUEL', icon: 'fuel', on: gs.tank > 0 && gs.fuel / gs.tank < 0.15, red: false },
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

/** A dark shadow under floating parts, so they read over a lit road. */
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
 * The warning symbols in fixed slots from x0 to x1 on y: lit ones in amber or red with a glow, the
 * rest a faint outline in `off`, so nothing moves when one lights.
 * @param {CanvasRenderingContext2D} g @param {ReturnType<typeof warningLamps>} lamps
 */
function lampIcons(g, x0, x1, y, size, lamps, off) {
  const step = (x1 - x0) / lamps.length;
  lamps.forEach((l, i) => {
    const x = x0 + step * (i + 0.5);
    if (l.on) paintIcon(g, l.icon, x, y, size, l.red ? '#ff3a2a' : '#ffa020', 9);
    else {
      shade(g);
      paintIcon(g, l.icon, x, y, size, off, 0);
      g.shadowColor = 'rgba(0, 0, 0, 0.85)';
      g.shadowBlur = 0;
    }
  });
}

/**
 * A small fuel or temperature gauge: ring, face, its symbol in the lower half, needle.
 * @param {CanvasRenderingContext2D} g @param {DialPainter} dial @param {'fuel' | 'temp'} type
 * @param {'white' | 'yellow'} face
 */
function smallGauge(g, dial, type, x, y, m, spec, value, face, warn) {
  shade(g);
  ring(g, x, y, m + 3, face === 'white' ? '#cfcfd6' : '#2a2418', 4);
  shade(g, false);
  dial(g, x, y, m, type, spec, face);
  paintIcon(g, type, x, y + m * 0.45, m * 0.5, warn ? '#c01818' : '#202020');
  paintNeedle(g, x, y, m, type, spec, value, '#d01010');
}

const fuelOf = (gs) => (gs.tank > 0 ? gs.fuel / gs.tank : 0);

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
  const cx = 278;
  const cy = 170;
  const R = 106;
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
  const temp = gs.temp ?? 84;
  gauge('boost', 66, 58, 40, boost, `${boost >= 0 ? '' : '-'}${Math.abs(boost).toFixed(1)}`, false);
  gauge('temp', 66, 150, 40, temp, String(Math.round(temp)), temp >= 115);
  gauge('fuel', 66, 242, 40, fuelOf(gs), String(Math.round(fuelOf(gs) * 100)), fuelOf(gs) < 0.15 && Math.floor(t * 4) % 2 === 0);
  lampIcons(g, 176, 382, 24, 22, lamps, 'rgba(255, 58, 38, 0.22)');
}

/** @param {CanvasRenderingContext2D} g @param {Gauges} gs @param {CarSpec} spec @param {number} t @param {DialPainter} dial */
function drawTwin(g, gs, spec, t, dial, lamps) {
  const R = 72;
  const y = 192;
  for (const [type, x, value] of /** @type {const} */ ([['speed', 122, gs.kmh], ['tach', 278, gs.rpm]])) {
    shade(g);
    ring(g, x, y, R + 4, '#cfcfd6', 6);
    shade(g, false);
    ring(g, x, y, R + 1, '#6a6a72', 1.5);
    dial(g, x, y, R, type, spec, 'white');
  }
  // The gear in a small window in the tach's open bottom, under the needle like a real one.
  rrect(g, 278 - 14, y + R * 0.52, 28, 24, 3);
  g.fillStyle = '#0a0a0c';
  g.fill();
  g.font = `bold 20px ${FONT.mono}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = gs.blown ? '#ff3a2a' : '#f2eee2';
  g.fillText(gs.gear, 278, y + R * 0.52 + 13);
  paintNeedle(g, 122, y, R, 'speed', spec, gs.kmh, '#d01010');
  paintNeedle(g, 278, y, R, 'tach', spec, gs.rpm, '#d01010');
  // The shift lamp between the rings.
  const lit = shiftLightsLit(gs, spec, 1, t) > 0;
  g.fillStyle = lit ? '#ff3020' : 'rgba(80, 20, 14, 0.85)';
  g.shadowColor = lit ? '#ff3020' : 'rgba(0, 0, 0, 0.85)';
  g.shadowBlur = lit ? 10 : 3;
  g.beginPath();
  g.arc(200, 138, 6, 0, Math.PI * 2);
  g.fill();
  g.shadowBlur = 0;
  const temp = gs.temp ?? 84;
  smallGauge(g, dial, 'fuel', 38, 264, 24, spec, fuelOf(gs), 'white', fuelOf(gs) < 0.15);
  smallGauge(g, dial, 'temp', 362, 264, 24, spec, temp, 'white', temp > 110);
  lampIcons(g, 110, 290, 96, 20, lamps, 'rgba(242, 238, 226, 0.22)');
}

/** @param {CanvasRenderingContext2D} g @param {Gauges} gs @param {CarSpec} spec @param {number} t @param {DialPainter} dial */
function drawSport(g, gs, spec, t, dial, lamps) {
  const cx = 262;
  const cy = 176;
  const R = 106;
  shade(g);
  ring(g, cx, cy, R + 4, '#2a2418', 7);
  shade(g, false);
  dial(g, cx, cy, R, 'tach', spec, 'yellow');
  // One black window in the open bottom: the gear on the left, the speed on the right.
  rrect(g, cx - 46, cy + 60, 92, 32, 5);
  g.fillStyle = '#0a0a0a';
  g.fill();
  g.textBaseline = 'alphabetic';
  g.textAlign = 'center';
  g.font = `bold 22px ${FONT.seg14}`;
  g.fillStyle = '#2a1e08';
  g.fillText('~', cx - 32, cy + 86);
  g.fillStyle = gs.blown ? '#ff3a2a' : '#f6f2e6';
  g.fillText(gs.gear, cx - 32, cy + 86);
  g.fillStyle = '#3a3220';
  g.fillRect(cx - 18, cy + 65, 1.5, 22);
  g.font = `bold 22px ${FONT.seg7}`;
  g.textAlign = 'right';
  g.fillStyle = '#2a1e08';
  g.fillText('888', cx + 41, cy + 86);
  g.fillStyle = '#ffb02e';
  g.fillText(String(Math.round(gs.kmh)), cx + 41, cy + 86);
  g.font = `bold 10px ${FONT.mono}`;
  g.textAlign = 'center';
  g.fillStyle = '#141414';
  g.fillText('km/h', cx + 12, cy + 54);
  paintNeedle(g, cx, cy, R, 'tach', spec, gs.rpm, '#d01010');
  // Beside it: five shift lights over small yellow fuel and temperature gauges.
  const n = 5;
  const lit = shiftLightsLit(gs, spec, n, t);
  for (let i = 0; i < n; i++) {
    const on = i < lit;
    const color = i >= 3 || gs.shift ? '#ff3020' : '#3aff6a';
    g.fillStyle = on ? color : 'rgba(30, 30, 26, 0.85)';
    g.shadowColor = on ? color : 'rgba(0, 0, 0, 0.85)';
    g.shadowBlur = on ? 10 : 3;
    g.beginPath();
    g.arc(30 + i * 22, 54, 7, 0, Math.PI * 2);
    g.fill();
  }
  g.shadowBlur = 0;
  const temp = gs.temp ?? 84;
  smallGauge(g, dial, 'fuel', 76, 118, 36, spec, fuelOf(gs), 'yellow', fuelOf(gs) < 0.15);
  smallGauge(g, dial, 'temp', 76, 206, 36, spec, temp, 'yellow', temp > 110);
  lampIcons(g, 8, 148, 272, 18, lamps, 'rgba(242, 204, 42, 0.25)');
}

/**
 * The digital styles: the cockpit's screen with no glass behind it, leaned forward and rising to
 * the right like a car display in Cyberpunk 2077, the warning symbols along its top edge.
 * @param {CanvasRenderingContext2D} g @param {'lcd' | 'vfd'} kind @param {Gauges} gs @param {CarSpec} spec @param {number} t
 */
function drawScreenStyle(g, kind, gs, spec, t, lamps) {
  const sw = 128 * SCREEN_ASPECT[kind];
  const k = 364 / sw;
  const sh = 128 * k;
  g.save();
  g.translate(30, 294 - sh);
  g.transform(1, -0.05, -0.16, 1, 0, 0);
  lampIcons(g, 40, sw * k - 10, -12, 17, lamps, kind === 'lcd' ? 'rgba(70, 232, 255, 0.28)' : 'rgba(255, 176, 46, 0.28)');
  g.scale(k, k);
  paintScreen(g, kind, sw, 128, readingOf(gs, spec, t), spec, true);
  g.restore();
}
