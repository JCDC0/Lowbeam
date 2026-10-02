/**
 * The arcade gauge cluster, drawn on a canvas in the bottom right: a big round
 * tachometer with a red zone, needle and shift lights, digital speed and gear in its
 * lower gap, and four small dials around it (FUEL, WATER, BOOST or VAC, EXH).
 * `drawDash` draws the same readings in a wide layout for the cockpit binnacle.
 */

import { BOOST_MIN, EXH_MAX, EXH_MIN, INTAKE_MIN, WATER_MAX, WATER_MIN } from '../vehicles/gauges.js';
import { clamp } from '../core/mathx.js';

/** @typedef {import('../vehicles/gauges.js').Gauges} Gauges */
/** @typedef {import('../vehicles/specs.js').CarSpec} CarSpec */

const FONT = '"Lowbeam Display", "Eurostile", "Arial Black", sans-serif';
const AMBER = '#ffb43c';
const RED = '#ff3b2f';
const INK = '#e9edf2';
const DIM = '#6f7a8a';
const BG = 'rgba(6, 9, 15, 0.86)';

/** Small dial sweep: 270 degrees clockwise from lower left, leaving the bottom open. */
const A0 = Math.PI * 0.75;
const SWEEP = Math.PI * 1.5;
/** The tach sweeps 240 degrees so the speed digits fit in the wider gap below. */
const T0 = (Math.PI * 5) / 6;
const TSWEEP = (Math.PI * 4) / 3;

const W = 400;
const H = 300;
const TACH = { x: 290, y: 190, r: 102 };

/** @param {CarSpec} spec */
const maxRpmOf = (spec) => Math.ceil(spec.engine.redline / 1000) * 1000 + 1000;

/**
 * One small dial: a 270 degree scale, a warning band, a needle and a value.
 * @param {CanvasRenderingContext2D} g
 */
function subDial(g, x, y, r, frac, label, value, warn, warnFrom, warnHigh = true) {
  g.fillStyle = BG;
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = 'rgba(255, 180, 60, 0.35)';
  g.lineWidth = 1.5;
  g.stroke();
  g.lineWidth = 3;
  g.strokeStyle = 'rgba(233, 237, 242, 0.25)';
  g.beginPath();
  g.arc(x, y, r - 6, A0, A0 + SWEEP);
  g.stroke();
  if (warnFrom > 0 && warnFrom < 1) {
    g.strokeStyle = RED;
    g.beginPath();
    if (warnHigh) g.arc(x, y, r - 6, A0 + SWEEP * warnFrom, A0 + SWEEP);
    else g.arc(x, y, r - 6, A0, A0 + SWEEP * warnFrom);
    g.stroke();
  }
  g.strokeStyle = INK;
  g.lineWidth = 1.5;
  for (let i = 0; i <= 4; i++) {
    const a = A0 + (SWEEP * i) / 4;
    g.beginPath();
    g.moveTo(x + Math.cos(a) * (r - 10), y + Math.sin(a) * (r - 10));
    g.lineTo(x + Math.cos(a) * (r - 3), y + Math.sin(a) * (r - 3));
    g.stroke();
  }
  const a = A0 + SWEEP * clamp(frac, 0, 1);
  g.strokeStyle = warn ? RED : AMBER;
  g.lineWidth = 2.5;
  g.shadowColor = g.strokeStyle;
  g.shadowBlur = 6;
  g.beginPath();
  g.moveTo(x - Math.cos(a) * 4, y - Math.sin(a) * 4);
  g.lineTo(x + Math.cos(a) * (r - 7), y + Math.sin(a) * (r - 7));
  g.stroke();
  g.shadowBlur = 0;
  g.fillStyle = '#1b1f27';
  g.beginPath();
  g.arc(x, y, 3.5, 0, Math.PI * 2);
  g.fill();
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = DIM;
  g.font = `7px ${FONT}`;
  g.fillText(label, x, y - r * 0.38);
  g.fillStyle = warn ? RED : INK;
  g.font = `8px ${FONT}`;
  g.fillText(value, x, y + r * 0.6);
}

/** Positions of the four sub-dials around the tach, upper left of it. */
const SUBS = [180, 148, 116, 84].map((deg) => {
  const t = (deg * Math.PI) / 180;
  const d = TACH.r + 46;
  return { x: TACH.x + Math.cos(t) * d, y: TACH.y - Math.sin(t) * d, r: 33 };
});

/**
 * Renders the arcade gauge cluster onto any canvas context: one large round tachometer
 * with an illuminated rpm arc, red zone, shift lights, sweeping needle, digital speed
 * and gear in the lower gap, and four round sub-dials around it (FUEL, WATER, BOOST or VAC, EXH).
 * Identically used for the 3rd person HUD and the cockpit binnacle texture.
 * @param {CanvasRenderingContext2D} g
 * @param {Gauges} gs
 * @param {CarSpec} spec
 * @param {number} t seconds, for blinking
 * @param {number} [w]
 * @param {number} [h]
 */
export function drawCluster(g, gs, spec, t, w = W, h = H) {
  g.save();
  if (w !== W || h !== H) {
    g.scale(w / W, h / H);
  }
  const max = maxRpmOf(spec);
  const red = spec.engine.redline;
  const { x: cx, y: cy, r: R } = TACH;
  const rpmA = (rpm) => T0 + TSWEEP * clamp(rpm / max, 0, 1);
  const flash = Math.floor(t * 12) % 2 === 0;
  g.clearRect(0, 0, W, H);

  const fuelFrac = gs.fuel / gs.tank;
  subDial(g, SUBS[0].x, SUBS[0].y, SUBS[0].r, fuelFrac, 'FUEL', `${gs.fuel.toFixed(0)}L`, fuelFrac < 0.15 && flash, 0.15, false);
  const wf = (gs.water - WATER_MIN) / (WATER_MAX - WATER_MIN);
  subDial(g, SUBS[1].x, SUBS[1].y, SUBS[1].r, wf, 'WATER', `${gs.water.toFixed(0)}°C`, gs.water > 110, 0.75);
  if (gs.turbo) {
    const top = spec.engine.turbo.boost;
    const bf = (gs.boost - BOOST_MIN) / (top - BOOST_MIN);
    const sign = gs.boost >= 0 ? '+' : '';
    subDial(g, SUBS[2].x, SUBS[2].y, SUBS[2].r, bf, 'BOOST', `${sign}${gs.boost.toFixed(1)}`, gs.boost > top * 0.9, (top * 0.9 - BOOST_MIN) / (top - BOOST_MIN));
  } else {
    const vf = (gs.intake - INTAKE_MIN) / -INTAKE_MIN;
    subDial(g, SUBS[2].x, SUBS[2].y, SUBS[2].r, vf, 'VAC', gs.intake.toFixed(2), false, 1.01);
  }
  const ef = (gs.exh - EXH_MIN) / (EXH_MAX - EXH_MIN);
  subDial(g, SUBS[3].x, SUBS[3].y, SUBS[3].r, ef, 'EXH', `${Math.round(gs.exh)}°C`, gs.exh > 820, (820 - EXH_MIN) / (EXH_MAX - EXH_MIN));

  const bg = g.createRadialGradient(cx, cy, R * 0.2, cx, cy, R);
  bg.addColorStop(0, 'rgba(14, 18, 28, 0.9)');
  bg.addColorStop(1, 'rgba(4, 6, 10, 0.92)');
  g.fillStyle = bg;
  g.beginPath();
  g.arc(cx, cy, R, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = 'rgba(255, 180, 60, 0.55)';
  g.lineWidth = 2;
  g.stroke();
  g.strokeStyle = 'rgba(255, 255, 255, 0.06)';
  g.lineWidth = 1;
  g.beginPath();
  g.arc(cx, cy, R - 5, 0, Math.PI * 2);
  g.stroke();

  g.lineWidth = 9;
  g.strokeStyle = gs.limiter && flash ? '#ff8070' : 'rgba(255, 59, 47, 0.85)';
  g.beginPath();
  g.arc(cx, cy, R - 13, rpmA(red), T0 + TSWEEP);
  g.stroke();
  g.lineWidth = 3;
  g.strokeStyle = 'rgba(255, 180, 60, 0.85)';
  g.beginPath();
  g.arc(cx, cy, R - 10, T0, rpmA(Math.min(gs.rpm, max)));
  g.stroke();

  g.textAlign = 'center';
  g.textBaseline = 'middle';
  for (let rpm = 0; rpm <= max; rpm += 250) {
    const a = rpmA(rpm);
    const major = rpm % 1000 === 0;
    const half = rpm % 500 === 0;
    const len = major ? 15 : half ? 9 : 5;
    g.strokeStyle = rpm >= red ? RED : INK;
    g.lineWidth = major ? 3 : half ? 2 : 1;
    g.beginPath();
    g.moveTo(cx + Math.cos(a) * (R - 6), cy + Math.sin(a) * (R - 6));
    g.lineTo(cx + Math.cos(a) * (R - 6 - len), cy + Math.sin(a) * (R - 6 - len));
    g.stroke();
    if (major) {
      g.fillStyle = rpm >= red ? RED : INK;
      g.font = `15px ${FONT}`;
      g.fillText(String(rpm / 1000), cx + Math.cos(a) * (R - 34), cy + Math.sin(a) * (R - 34));
    }
  }
  g.fillStyle = DIM;
  g.font = `7px ${FONT}`;
  g.fillText('x1000 r/min', cx, cy - R * 0.2);

  const leds = 5;
  const from = spec.engine.shiftUp * 0.8;
  for (let i = 0; i < leds; i++) {
    const on = gs.engineOn && (gs.shift ? flash : gs.rpm > from + ((spec.engine.shiftUp - from) * i) / leds);
    const color = i < 2 ? '#3dff6a' : i < 4 ? AMBER : RED;
    const x = cx + (i - (leds - 1) / 2) * 13;
    const y = cy - R * 0.42;
    g.fillStyle = on ? (gs.shift ? RED : color) : 'rgba(255, 255, 255, 0.08)';
    g.shadowColor = g.fillStyle;
    g.shadowBlur = on ? 8 : 0;
    g.beginPath();
    g.arc(x, y, 4, 0, Math.PI * 2);
    g.fill();
  }
  g.shadowBlur = 0;

  const kmh = String(Math.round(gs.kmh));
  g.fillStyle = INK;
  g.font = `30px ${FONT}`;
  g.fillText(kmh, cx, cy + R * 0.62);
  g.fillStyle = DIM;
  g.font = `8px ${FONT}`;
  g.fillText('KM/H', cx, cy + R * 0.87);
  g.strokeStyle = 'rgba(255, 180, 60, 0.6)';
  g.lineWidth = 1.5;
  g.strokeRect(cx + R * 0.18, cy + R * 0.02, 30, 32);
  g.fillStyle = gs.gear === 'R' ? RED : AMBER;
  g.font = `22px ${FONT}`;
  g.fillText(gs.gear, cx + R * 0.18 + 15, cy + R * 0.02 + 17);

  const a = rpmA(gs.rpm);
  g.strokeStyle = '#fff4e0';
  g.shadowColor = AMBER;
  g.shadowBlur = 10;
  g.lineWidth = 3.5;
  g.beginPath();
  g.moveTo(cx - Math.cos(a) * 14, cy - Math.sin(a) * 14);
  g.lineTo(cx + Math.cos(a) * (R - 12), cy + Math.sin(a) * (R - 12));
  g.stroke();
  g.shadowBlur = 0;
  g.fillStyle = '#20242c';
  g.beginPath();
  g.arc(cx, cy, 8, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = AMBER;
  g.lineWidth = 1.5;
  g.stroke();

  if (!gs.engineOn) {
    g.fillStyle = flash ? RED : 'rgba(255, 59, 47, 0.4)';
    g.font = `10px ${FONT}`;
    g.fillText('ENGINE OFF', cx, cy - R * 0.62);
  }

  g.restore();
}

export class Cluster {
  /** @param {HTMLElement} parent @param {CarSpec} spec */
  constructor(parent, spec) {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'gauges';
    parent.appendChild(this.canvas);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = W * dpr;
    this.canvas.height = H * dpr;
    this.g = /** @type {CanvasRenderingContext2D} */ (this.canvas.getContext('2d'));
    this.g.scale(dpr, dpr);
    this.setSpec(spec);
    this.t = 0;
  }

  /** @param {CarSpec} spec */
  setSpec(spec) {
    this.spec = spec;
    this.maxRpm = maxRpmOf(spec);
  }

  /** @param {boolean} on */
  show(on) {
    this.canvas.style.display = on ? 'block' : 'none';
  }

  /** @param {Gauges} gs @param {number} dt */
  draw(gs, dt) {
    this.t += dt;
    drawCluster(this.g, gs, this.spec, this.t, W, H);
  }
}
