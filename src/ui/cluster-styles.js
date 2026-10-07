/**
 * The HUD cluster styles other than the classic one (`cluster.js`), each the outside-view twin of a
 * car's own dashboard, drawn with the same painters as the cockpit (`vehicles/instruments.js`). Like
 * the classic one they float over the scene: no board or housing behind them, only the gauges.
 *
 * Every style stands upright in the same 300 by 400 canvas: the main dial at the bottom right, and
 * the small gauges curving up its left side and over its top on one arc (`arcSpot`), the way the
 * classic cluster first did. The warning symbols sit inside the main dial (`dialLamps`).
 *
 * - `tuner` (Hayate): an aftermarket racing tach, black with red lit ticks and numerals, the speed in
 *   its LCD window and the gear under its hub; small racing gauges for boost, temperature and fuel.
 * - `twin` (Rampart): the cream speedometer stands above the cream tach, the gear in a window in the
 *   tach's open bottom, small cream fuel and temperature gauges on the arc.
 * - `sport` (Vespera): one big yellow tach with the gear and the speed in one window in its open
 *   bottom; five shift lights over its top and small yellow fuel and temperature gauges on the arc.
 * - `digital` (Tsurugi) and `vfd` (Hikari): a tall display with no glass behind it, leaned like a
 *   car display in Cyberpunk 2077: the rev bar curves up the left side and over the top, the speed,
 *   the gear and the warnings inside the curve, the fuel, temperature and boost bars in its corner.
 *
 * Warnings are symbols (`paintIcon`), never words: check engine, damage, over-rev, engine off, hot,
 * low fuel. Every symbol has its own fixed place and shows faintly when off, so one lighting up never
 * moves another.
 */

import { FONT } from '../render/fonts.js';
import { segmentsLit, tachZone, gaugeScale } from '../vehicles/dash.js';
import { paintDial, paintIcon, paintNeedle, paintTunerReadout } from '../vehicles/instruments.js';

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

/** The cluster canvas, upright. */
export const CLUSTER_W = 300;
export const CLUSTER_H = 400;
/** Where the main dial of every style sits, and its radius. */
export const MAIN = { x: 172, y: 290, r: 100 };

/**
 * A spot on the arc the small gauges follow round the main dial: `deg` measured on the canvas
 * (180 is straight left, 270 straight up), `gap` from the main dial's rim to the small one's center.
 * @param {number} deg @param {number} gap @param {{ x: number, y: number, r: number }} [main]
 */
export function arcSpot(deg, gap, main = MAIN) {
  const a = (deg * Math.PI) / 180;
  const d = main.r + gap;
  return { x: main.x + Math.cos(a) * d, y: main.y + Math.sin(a) * d };
}

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

/** The colors of a lit warning symbol. */
export const LAMP_AMBER = '#ffa020';
export const LAMP_RED = '#ff3a2a';

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
export function lampIcons(g, x0, x1, y, size, lamps, off) {
  const step = (x1 - x0) / lamps.length;
  paintLamps(g, lamps.map((_, i) => [x0 + step * (i + 0.5), y]), size, lamps, off);
}

/** @param {CanvasRenderingContext2D} g @param {number[][]} spots @param {number} size @param {ReturnType<typeof warningLamps>} lamps @param {string} off */
function paintLamps(g, spots, size, lamps, off) {
  lamps.forEach((l, i) => {
    const [x, y] = spots[i];
    if (l.on) paintIcon(g, l.icon, x, y, size, l.red ? LAMP_RED : LAMP_AMBER, 9);
    else paintIcon(g, l.icon, x, y, size, off, 0);
  });
  g.shadowBlur = 0;
}

/**
 * Where a dial carries its warning symbols, in fractions of its radius: a straight `row` across the
 * face (`y` from the hub, negative above it, `span` each side), or an `arc` round the hub (`radius`,
 * from `from` to `to` degrees on the canvas, 270 straight up) where the numerals leave no room for
 * a row.
 * `size` is the symbols' size, 0.14 of the radius unless given.
 * @typedef {({ row: true, y: number, span: number } | { arc: true, radius: number, from: number, to: number }) & { size?: number }} LampPlace
 */

/**
 * The warning symbols inside a main dial, as a real cluster carries its tell-tales in the dial.
 * @param {CanvasRenderingContext2D} g @param {number} cx @param {number} cy @param {number} r
 * @param {ReturnType<typeof warningLamps>} lamps @param {string} off @param {LampPlace} place
 */
export function dialLamps(g, cx, cy, r, lamps, off, place) {
  const size = r * (place.size ?? 0.14);
  if ('row' in place) {
    lampIcons(g, cx - r * place.span, cx + r * place.span, cy + r * place.y, size, lamps, off);
    return;
  }
  const n = lamps.length;
  const spots = lamps.map((_, i) => {
    const a = ((place.from + ((place.to - place.from) * i) / (n - 1)) * Math.PI) / 180;
    return [cx + Math.cos(a) * r * place.radius, cy + Math.sin(a) * r * place.radius];
  });
  paintLamps(g, spots, size, lamps, off);
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
 * Draws one of the non-classic styles over the whole 300 by 400 canvas, scaled to w by h.
 * @param {CanvasRenderingContext2D} g @param {ClusterStyle} style @param {Gauges} gs @param {CarSpec} spec
 * @param {number} t seconds, for blinking @param {DialPainter} [dial] @param {number} [w] @param {number} [h]
 */
export function drawStyled(g, style, gs, spec, t, dial = paintDial, w = CLUSTER_W, h = CLUSTER_H) {
  g.clearRect(0, 0, w, h);
  g.save();
  const s = Math.min(w / CLUSTER_W, h / CLUSTER_H);
  g.translate((w - CLUSTER_W * s) / 2, (h - CLUSTER_H * s) / 2);
  g.scale(s, s);
  const lamps = warningLamps(gs, t);
  if (style === 'tuner') drawTuner(g, gs, spec, t, dial, lamps);
  else if (style === 'twin') drawTwin(g, gs, spec, t, dial, lamps);
  else if (style === 'sport') drawSport(g, gs, spec, t, dial, lamps);
  else drawTallScreen(g, style === 'vfd' ? 'vfd' : 'lcd', gs, spec, t, lamps);
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
  const { x: cx, y: cy, r: R } = MAIN;
  const boost = gs.turbo ? gs.boost : gs.intake;
  const temp = gs.temp ?? 84;
  const small = [['boost', 198], ['temp', 229], ['fuel', 260]].map(([type, deg]) => ({ type, ...arcSpot(/** @type {number} */ (deg), 44) }));
  gauge('boost', small[0].x, small[0].y, 32, boost, `${boost >= 0 ? '' : '-'}${Math.abs(boost).toFixed(1)}`, false);
  gauge('temp', small[1].x, small[1].y, 32, temp, String(Math.round(temp)), temp >= 115);
  gauge('fuel', small[2].x, small[2].y, 32, fuelOf(gs), String(Math.round(fuelOf(gs) * 100)), fuelOf(gs) < 0.15 && Math.floor(t * 4) % 2 === 0);
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
  dialLamps(g, cx, cy, R, lamps, 'rgba(255, 58, 38, 0.24)', { arc: true, radius: 0.29, from: 203, to: 337, size: 0.105 });
}

/** @param {CanvasRenderingContext2D} g @param {Gauges} gs @param {CarSpec} spec @param {number} t @param {DialPainter} dial */
function drawTwin(g, gs, spec, t, dial, lamps) {
  const T = { x: MAIN.x, y: MAIN.y, r: 94 };
  // The speedometer stands above the tach, a little to its left, on the same arc as the gauges.
  const S = { ...arcSpot(258, 82, T), r: 56 };
  for (const [type, d, value] of /** @type {const} */ ([['speed', S, gs.kmh], ['tach', T, gs.rpm]])) {
    shade(g);
    ring(g, d.x, d.y, d.r + 4, '#cfcfd6', 6);
    shade(g, false);
    ring(g, d.x, d.y, d.r + 1, '#6a6a72', 1.5);
    dial(g, d.x, d.y, d.r, type, spec, 'white');
  }
  // The gear in a small window in the tach's open bottom, under the needle like a real one.
  rrect(g, T.x - 14, T.y + T.r * 0.52, 28, 24, 3);
  g.fillStyle = '#0a0a0c';
  g.fill();
  g.font = `bold 20px ${FONT.mono}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = gs.blown ? '#ff3a2a' : '#f2eee2';
  g.fillText(gs.gear, T.x, T.y + T.r * 0.52 + 13);
  // The shift lamp in the tach's face, under the numerals.
  const lit = shiftLightsLit(gs, spec, 1, t) > 0;
  g.fillStyle = lit ? '#ff3020' : 'rgba(80, 20, 14, 0.5)';
  g.shadowColor = lit ? '#ff3020' : 'transparent';
  g.shadowBlur = lit ? 10 : 0;
  g.beginPath();
  g.arc(T.x, T.y - T.r * 0.32, 5, 0, Math.PI * 2);
  g.fill();
  g.shadowBlur = 0;
  dialLamps(g, T.x, T.y, T.r, lamps, 'rgba(20, 20, 20, 0.22)', { row: true, y: 0.28, span: 0.28, size: 0.12 });
  paintNeedle(g, S.x, S.y, S.r, 'speed', spec, gs.kmh, '#d01010');
  paintNeedle(g, T.x, T.y, T.r, 'tach', spec, gs.rpm, '#d01010');
  const temp = gs.temp ?? 84;
  const fuel = arcSpot(194, 36, T);
  const hot = arcSpot(222, 36, T);
  smallGauge(g, dial, 'fuel', fuel.x, fuel.y, 26, spec, fuelOf(gs), 'white', fuelOf(gs) < 0.15);
  smallGauge(g, dial, 'temp', hot.x, hot.y, 26, spec, temp, 'white', temp > 110);
}

/** @param {CanvasRenderingContext2D} g @param {Gauges} gs @param {CarSpec} spec @param {number} t @param {DialPainter} dial */
function drawSport(g, gs, spec, t, dial, lamps) {
  const { x: cx, y: cy } = MAIN;
  const R = 104;
  // Five shift lights over the top of the tach, on its own curve.
  const n = 5;
  const lit = shiftLightsLit(gs, spec, n, t);
  for (let i = 0; i < n; i++) {
    const on = i < lit;
    const color = i >= 3 || gs.shift ? '#ff3020' : '#3aff6a';
    const p = arcSpot(244 + i * 13, 22, { x: cx, y: cy, r: R });
    g.fillStyle = on ? color : 'rgba(30, 30, 26, 0.85)';
    g.shadowColor = on ? color : 'rgba(0, 0, 0, 0.85)';
    g.shadowBlur = on ? 10 : 3;
    g.beginPath();
    g.arc(p.x, p.y, 7, 0, Math.PI * 2);
    g.fill();
  }
  g.shadowBlur = 0;
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
  dialLamps(g, cx, cy, R, lamps, 'rgba(20, 20, 20, 0.2)', { row: true, y: 0.33, span: 0.28, size: 0.12 });
  paintNeedle(g, cx, cy, R, 'tach', spec, gs.rpm, '#d01010');
  const temp = gs.temp ?? 84;
  const fuel = arcSpot(198, 42, { x: cx, y: cy, r: R });
  const hot = arcSpot(230, 42, { x: cx, y: cy, r: R });
  smallGauge(g, dial, 'fuel', fuel.x, fuel.y, 32, spec, fuelOf(gs), 'yellow', fuelOf(gs) < 0.15);
  smallGauge(g, dial, 'temp', hot.x, hot.y, 32, spec, temp, 'yellow', temp > 110);
}

/** Lit and unlit colors of the tall displays. */
const SCREENS = {
  lcd: {
    seg: '#46e8ff', segOff: 'rgba(70, 232, 255, 0.14)', red: '#ff3a2a', redOff: 'rgba(255, 58, 42, 0.15)',
    digits: '#e8fbff', digitsOff: 'rgba(232, 251, 255, 0.09)', digitFont: 'seg7', gear: '#ffffff', gearOff: 'rgba(232, 251, 255, 0.09)',
    label: '#7ab8c4', bar: '#e8fbff', barOff: 'rgba(70, 232, 255, 0.16)', boost: '#46e8ff', lampOff: 'rgba(70, 232, 255, 0.26)',
  },
  vfd: {
    seg: '#5aff8a', segOff: 'rgba(90, 255, 138, 0.13)', red: '#ff3a2a', redOff: 'rgba(255, 58, 42, 0.15)',
    digits: '#46f0ff', digitsOff: 'rgba(70, 240, 255, 0.10)', digitFont: 'seg14', gear: '#ffb02e', gearOff: 'rgba(255, 176, 46, 0.15)',
    label: '#6ac88a', bar: '#5aff8a', barOff: 'rgba(90, 255, 138, 0.14)', boost: '#ffb02e', lampOff: 'rgba(255, 176, 46, 0.28)',
  },
};

/**
 * The digital styles, upright: the rev bar curves from the bottom left up the side and over the top,
 * on one arc round the lower right corner; inside the curve the warnings, the gear, the speed, and in
 * the corner the boost, fuel and temperature bars. No glass behind it: lit segments glow, unlit ones
 * are a faint tint. The whole display leans back a little, like a car display in Cyberpunk 2077.
 * @param {CanvasRenderingContext2D} g @param {'lcd' | 'vfd'} kind @param {Gauges} gs @param {CarSpec} spec
 * @param {number} t @param {ReturnType<typeof warningLamps>} lamps
 */
function drawTallScreen(g, kind, gs, spec, t, lamps) {
  const P = SCREENS[kind];
  const tach = gaugeScale('tach', spec);
  const flash = (gs.shift || gs.limiter) && Math.floor(t * 10) % 2 === 0;
  g.save();
  g.translate(22, 4);
  g.transform(1, -0.02, -0.055, 1, 0, 0);
  // The rev bar: segments on a quarter circle round (cx, cy), from straight left to straight up.
  const cx = 270;
  const cy = 372;
  const R = 248;
  const n = 40;
  const lit = segmentsLit(gs.rpm, tach.max, n);
  const glow = (color, on) => {
    g.fillStyle = color;
    g.shadowColor = color;
    g.shadowBlur = on ? 5 : 0;
  };
  for (let i = 0; i < n; i++) {
    const a0 = Math.PI * (1 + (i / n) * 0.5);
    const a1 = Math.PI * (1 + ((i + 0.72) / n) * 0.5);
    const red = tachZone(i, n, tach.max, spec.engine.redline) === 'red';
    // The bar thickens as it climbs, so the top of the range reads as the loud end.
    const thick = 12 + (i / n) * 10;
    g.beginPath();
    g.arc(cx, cy, R, a0, a1);
    g.arc(cx, cy, R - thick, a1, a0, true);
    g.closePath();
    if (i < lit) glow(red ? P.red : flash ? '#ffffff' : P.seg, true);
    else glow(red ? P.redOff : P.segOff, false);
    g.fill();
  }
  g.shadowBlur = 0;
  g.font = `12px ${FONT.mono}`;
  g.fillStyle = P.label;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  for (let v = 0; v <= tach.max; v += 1000) {
    const a = Math.PI * (1 + (v / tach.max) * 0.5);
    g.fillStyle = v >= spec.engine.redline ? P.red : P.label;
    g.fillText(String(v / 1000), cx + Math.cos(a) * (R - 36), cy + Math.sin(a) * (R - 36));
  }
  g.fillStyle = P.label;
  g.font = `10px ${FONT.mono}`;
  g.textAlign = 'right';
  g.fillText('x1000 r/min', cx - 56, 214);
  // The gear in a frame, the warnings under it in their fixed slots, the speed at the bottom.
  g.strokeStyle = P.seg;
  g.lineWidth = 2;
  g.shadowColor = P.seg;
  g.shadowBlur = 3;
  g.strokeRect(cx - 48, 194, 44, 54);
  g.shadowBlur = 0;
  g.font = `bold 40px ${FONT.seg14}`;
  g.textAlign = 'center';
  g.textBaseline = 'alphabetic';
  g.fillStyle = P.gearOff;
  g.fillText('~', cx - 26, 239);
  glow(gs.blown ? P.red : P.gear, true);
  g.fillText(gs.gear, cx - 26, 239);
  g.shadowBlur = 0;
  lampIcons(g, 106, 272, 272, 18, lamps, P.lampOff);
  g.font = `bold 60px ${FONT[P.digitFont]}`;
  g.textAlign = 'right';
  g.fillStyle = P.digitsOff;
  g.fillText(P.digitFont === 'seg7' ? '888' : '~~~', cx, 350);
  glow(P.digits, true);
  g.fillText(String(Math.round(gs.kmh)), cx, 350);
  g.shadowBlur = 0;
  g.font = `12px ${FONT.mono}`;
  g.fillStyle = P.label;
  g.fillText('km/h', cx, 368);
  // Boost, fuel and temperature as short bars in the lower left corner, their symbols under them.
  const bars = [
    ['turbo', gs.turbo ? Math.max(0, gs.boost) / (spec.engine.turbo?.boost ?? 1.2) : 0, P.boost, false],
    ['fuel', fuelOf(gs), P.bar, fuelOf(gs) < 0.15],
    ['temp', ((gs.temp ?? 84) - 60) / 70, P.bar, (gs.temp ?? 84) > 110],
  ];
  bars.forEach(([icon, v, color, warn], i) => {
    const x = 82 + i * 19;
    const top = 292;
    const h = 56;
    const m = 8;
    const on = segmentsLit(Math.max(0, Math.min(1, Number(v))), 1, m);
    for (let k = 0; k < m; k++) {
      if (k < on) glow(warn ? P.red : String(color), true);
      else glow(P.barOff, false);
      g.fillRect(x, top + h - (k + 1) * (h / m) + 1, 10, h / m - 2);
    }
    g.shadowBlur = 0;
    paintIcon(g, /** @type {any} */ (icon), x + 5, top + h + 12, 13, warn ? P.red : P.label, warn ? 6 : 0);
  });
  g.restore();
}
