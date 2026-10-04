/**
 * The arcade gauge cluster, drawn on a canvas in the bottom right: a big round
 * tachometer with a red zone, needle and shift lights, digital speed and gear in its
 * lower gap, and four small dials around it (FUEL, TEMP, BOOST or VAC, EXH).
 * Identically used for the 3rd person HUD and the cockpit binnacle texture.
 * This is the `classic` style (the Hayate's); `Cluster` draws the others from `cluster-styles.js`.
 */

import { BOOST_MIN, EXH_MAX, EXH_MIN, INTAKE_MIN, TEMP_MAX, TEMP_MIN, TEMP_RED } from '../vehicles/gauges.js';
import { clamp } from '../core/mathx.js';
import { clusterStyleOf, drawStyled } from './cluster-styles.js';
import { paintDial } from '../vehicles/instruments.js';

export { CLUSTER_STYLES, clusterStyleOf } from './cluster-styles.js';

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

/**
 * End of the tach scale: the redline plus 1,000 rpm, rounded up to the next 1,000. The blow
 * rpm (`engine.blowRpm`) stays in the engine logic and is never drawn, so the scale does not
 * read as a target.
 * @param {CarSpec} spec
 */
export const maxRpmOf = (spec) => Math.ceil((spec.engine.redline + 1000) / 1000) * 1000;

/**
 * Needle angle for an rpm on a car's tach. Past the end of the scale the needle pins at the
 * end stop; it never wraps round.
 * @param {number} rpm @param {CarSpec} spec
 */
export const tachAngle = (rpm, spec) => T0 + TSWEEP * clamp(rpm / maxRpmOf(spec), 0, 1);

/** Angle of the tach's end stop. */
export const TACH_END = T0 + TSWEEP;

/**
 * One small dial: a 270 degree scale, a warning band, a needle and a value/label.
 * @param {CanvasRenderingContext2D} g
 * @param {number} x @param {number} y @param {number} r
 * @param {number} frac
 * @param {string} label
 * @param {string} value
 * @param {boolean} warn
 * @param {number} warnFrom
 * @param {boolean} [warnHigh]
 * @param {boolean} [cockpit]
 * @param {boolean} [hot]
 */
function subDial(g, x, y, r, frac, label, value, warn, warnFrom, warnHigh = true, cockpit = false, hot = false) {
  g.fillStyle = BG;
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = 'rgba(255, 180, 60, 0.45)';
  g.lineWidth = cockpit ? 3 : 1.5;
  g.stroke();

  const arcR = r - (cockpit ? 7 : 6);
  g.lineWidth = cockpit ? 6 : 3;
  g.strokeStyle = 'rgba(233, 237, 242, 0.25)';
  g.beginPath();
  g.arc(x, y, arcR, A0, A0 + SWEEP);
  g.stroke();

  if (warnFrom > 0 && warnFrom < 1) {
    g.strokeStyle = RED;
    g.beginPath();
    if (warnHigh) g.arc(x, y, arcR, A0 + SWEEP * warnFrom, A0 + SWEEP);
    else g.arc(x, y, arcR, A0, A0 + SWEEP * warnFrom);
    g.stroke();
  }

  g.strokeStyle = INK;
  g.lineWidth = cockpit ? 2.5 : 1.5;
  const ticks = cockpit ? 2 : 4;
  for (let i = 0; i <= ticks; i++) {
    const a = A0 + (SWEEP * i) / ticks;
    const len = cockpit ? 8 : 7;
    g.beginPath();
    g.moveTo(x + Math.cos(a) * (r - 11), y + Math.sin(a) * (r - 11));
    g.lineTo(x + Math.cos(a) * (r - 11 + len), y + Math.sin(a) * (r - 11 + len));
    g.stroke();
  }

  const a = A0 + SWEEP * clamp(frac, 0, 1);
  g.strokeStyle = warn ? RED : AMBER;
  g.lineWidth = cockpit ? 5 : 2.5;
  g.shadowColor = g.strokeStyle;
  g.shadowBlur = cockpit ? 8 : 6;
  g.beginPath();
  g.moveTo(x - Math.cos(a) * (cockpit ? 6 : 4), y - Math.sin(a) * (cockpit ? 6 : 4));
  g.lineTo(x + Math.cos(a) * (r - (cockpit ? 8 : 7)), y + Math.sin(a) * (r - (cockpit ? 8 : 7)));
  g.stroke();
  g.shadowBlur = 0;

  g.fillStyle = '#1b1f27';
  g.beginPath();
  g.arc(x, y, cockpit ? 5 : 3.5, 0, Math.PI * 2);
  g.fill();

  g.textAlign = 'center';
  g.textBaseline = 'middle';
  if (cockpit) {
    if (hot) {
      g.fillStyle = RED;
      g.font = `bold 22px ${FONT}`;
      g.fillText('HOT', x, y - r * 0.28);
    } else {
      const shortLabel = label === 'FUEL' ? 'F' : label === 'TEMP' ? 'T' : label === 'BOOST' ? 'B' : label === 'VAC' ? 'V' : 'E';
      g.fillStyle = warn ? RED : DIM;
      g.font = `bold 24px ${FONT}`;
      g.fillText(shortLabel, x, y - r * 0.28);
    }
  } else {
    g.fillStyle = hot ? RED : DIM;
    g.font = `7px ${FONT}`;
    g.fillText(hot ? 'HOT' : label, x, y - r * 0.38);
    g.fillStyle = warn ? RED : INK;
    g.font = `8px ${FONT}`;
    g.fillText(value, x, y + r * 0.6);
  }
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
 * and gear in the lower gap, and four round sub-dials around it (FUEL, TEMP, BOOST or VAC, EXH).
 * When `cockpit` is true, renders high-contrast bold dials suitable for 240p interior view.
 * @param {CanvasRenderingContext2D} g
 * @param {Gauges} gs
 * @param {CarSpec} spec
 * @param {number} t seconds, for blinking
 * @param {number} [w]
 * @param {number} [h]
 * @param {boolean} [cockpit]
 */
export function drawCluster(g, gs, spec, t, w = W, h = H, cockpit = Boolean(/** @type {*} */ (g).cockpit)) {
  g.clearRect(0, 0, w, h);
  g.save();
  const s = Math.min(w / W, h / H);
  const ox = (w - W * s) / 2;
  const oy = (h - H * s) / 2;
  if (ox !== 0 || oy !== 0) g.translate(ox, oy);
  if (s !== 1) g.scale(s, s);

  const max = maxRpmOf(spec);
  const red = spec.engine.redline;
  const { x: cx, y: cy, r: R } = TACH;
  const rpmA = (rpm) => tachAngle(rpm, spec);
  const flash = Math.floor(t * 12) % 2 === 0;

  const temp = gs.temp ?? 84;
  const exh = gs.exh ?? 360;
  const overrev = gs.overrev ?? 0;
  const damage = gs.damage ?? 0;
  const blown = Boolean(gs.blown);

  const fuelFrac = gs.tank > 0 ? gs.fuel / gs.tank : 0;
  subDial(g, SUBS[0].x, SUBS[0].y, SUBS[0].r, fuelFrac, 'FUEL', `${gs.fuel.toFixed(0)}L`, fuelFrac < 0.15 && flash, 0.15, false, cockpit);

  const tMin = TEMP_MIN ?? 80;
  const tMax = TEMP_MAX ?? 120;
  const tRed = TEMP_RED ?? 110;
  const tf = (temp - tMin) / (tMax - tMin);
  const hot = temp >= 115;
  const tempWarn = temp >= tRed;
  const tempWarnFrom = (tRed - tMin) / (tMax - tMin);
  subDial(g, SUBS[1].x, SUBS[1].y, SUBS[1].r, tf, 'TEMP', `${Math.round(temp)}°C`, tempWarn, tempWarnFrom, true, cockpit, hot);

  if (gs.turbo) {
    const top = spec.engine.turbo?.boost ?? 1.2;
    const bf = (gs.boost - BOOST_MIN) / (top - BOOST_MIN);
    const sign = gs.boost >= 0 ? '+' : '';
    subDial(g, SUBS[2].x, SUBS[2].y, SUBS[2].r, bf, 'BOOST', `${sign}${gs.boost.toFixed(1)}`, gs.boost > top * 0.9, (top * 0.9 - BOOST_MIN) / (top - BOOST_MIN), true, cockpit);
  } else {
    const vf = (gs.intake - INTAKE_MIN) / -INTAKE_MIN;
    subDial(g, SUBS[2].x, SUBS[2].y, SUBS[2].r, vf, 'VAC', gs.intake.toFixed(2), false, 1.01, true, cockpit);
  }

  const ef = (exh - EXH_MIN) / (EXH_MAX - EXH_MIN);
  subDial(g, SUBS[3].x, SUBS[3].y, SUBS[3].r, ef, 'EXH', `${Math.round(exh)}°C`, exh > 820, (820 - EXH_MIN) / (EXH_MAX - EXH_MIN), true, cockpit);

  const bg = g.createRadialGradient(cx, cy, R * 0.2, cx, cy, R);
  bg.addColorStop(0, 'rgba(14, 18, 28, 0.9)');
  bg.addColorStop(1, 'rgba(4, 6, 10, 0.92)');
  g.fillStyle = bg;
  g.beginPath();
  g.arc(cx, cy, R, 0, Math.PI * 2);
  g.fill();

  g.strokeStyle = 'rgba(255, 180, 60, 0.55)';
  g.lineWidth = cockpit ? 3 : 2;
  g.stroke();
  g.strokeStyle = 'rgba(255, 255, 255, 0.06)';
  g.lineWidth = 1;
  g.beginPath();
  g.arc(cx, cy, R - 5, 0, Math.PI * 2);
  g.stroke();

  const bandR = R - (cockpit ? 15 : 13);
  g.lineWidth = cockpit ? 14 : 9;
  g.strokeStyle = ((gs.limiter || overrev > 0) && flash) ? '#ff8070' : 'rgba(255, 59, 47, 0.85)';
  g.beginPath();
  g.arc(cx, cy, bandR, rpmA(red), T0 + TSWEEP);
  g.stroke();

  g.lineWidth = cockpit ? 6 : 3;
  g.strokeStyle = 'rgba(255, 180, 60, 0.85)';
  g.beginPath();
  g.arc(cx, cy, R - (cockpit ? 15 : 10), T0, rpmA(Math.min(gs.rpm, max)));
  g.stroke();

  g.textAlign = 'center';
  g.textBaseline = 'middle';
  if (cockpit) {
    for (let rpm = 0; rpm <= max; rpm += 1000) {
      const a = rpmA(rpm);
      const isRed = rpm >= red;
      g.strokeStyle = isRed ? RED : INK;
      g.lineWidth = 4;
      g.beginPath();
      g.moveTo(cx + Math.cos(a) * (R - 6), cy + Math.sin(a) * (R - 6));
      g.lineTo(cx + Math.cos(a) * (R - 22), cy + Math.sin(a) * (R - 22));
      g.stroke();
      g.fillStyle = isRed ? RED : INK;
      g.font = `bold 24px ${FONT}`;
      g.fillText(String(rpm / 1000), cx + Math.cos(a) * (R - 38), cy + Math.sin(a) * (R - 38));
    }
  } else {
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
        g.font = `14px ${FONT}`;
        g.fillText(String(rpm / 1000), cx + Math.cos(a) * (R - 32), cy + Math.sin(a) * (R - 32));
      }
    }
    g.fillStyle = DIM;
    g.font = `7px ${FONT}`;
    g.fillText('x1000 r/min', cx, cy - R * 0.2);
  }

  const leds = 5;
  const from = spec.engine.shiftUp * 0.8;
  const ledSpacing = cockpit ? 16 : 13;
  const ledRadius = cockpit ? 6 : 4;
  for (let i = 0; i < leds; i++) {
    const on = gs.engineOn && (gs.shift ? flash : gs.rpm > from + ((spec.engine.shiftUp - from) * i) / leds);
    const color = i < 2 ? '#3dff6a' : i < 4 ? AMBER : RED;
    const lx = cx + (i - (leds - 1) / 2) * ledSpacing;
    const ly = cy - R * 0.42;
    g.fillStyle = on ? (gs.shift ? RED : color) : 'rgba(255, 255, 255, 0.08)';
    g.shadowColor = g.fillStyle;
    g.shadowBlur = on ? (cockpit ? 10 : 8) : 0;
    g.beginPath();
    g.arc(lx, ly, ledRadius, 0, Math.PI * 2);
    g.fill();
  }
  g.shadowBlur = 0;

  if (blown) {
    g.fillStyle = flash ? RED : 'rgba(255, 59, 47, 0.2)';
    g.font = cockpit ? `bold 24px ${FONT}` : `11px ${FONT}`;
    g.fillText('CHECK ENGINE', cx, cy - R * (cockpit ? 0.18 : 0.05));
  } else if (overrev > 0) {
    g.fillStyle = flash ? RED : 'rgba(255, 59, 47, 0.2)';
    g.font = cockpit ? `bold 24px ${FONT}` : `11px ${FONT}`;
    g.fillText('OVERREV', cx, cy - R * (cockpit ? 0.18 : 0.05));
  } else if (damage > 0.3) {
    g.fillStyle = AMBER;
    g.font = cockpit ? `bold 24px ${FONT}` : `11px ${FONT}`;
    g.fillText('DMG', cx, cy - R * (cockpit ? 0.18 : 0.05));
  }

  const kmh = String(Math.round(gs.kmh));
  if (cockpit) {
    g.fillStyle = INK;
    g.font = `bold 50px ${FONT}`;
    g.fillText(kmh, cx - 18, cy + R * 0.58);
    g.fillStyle = DIM;
    g.font = `bold 22px ${FONT}`;
    g.fillText('KM/H', cx - 18, cy + R * 0.84);

    const gx = cx + R * 0.16;
    const gy = cy + R * 0.16;
    const gw = 40;
    const gh = 44;
    g.strokeStyle = 'rgba(255, 180, 60, 0.7)';
    g.lineWidth = 3;
    g.strokeRect(gx, gy, gw, gh);
    g.fillStyle = gs.gear === 'R' ? RED : AMBER;
    g.font = `bold 34px ${FONT}`;
    g.fillText(gs.gear, gx + gw / 2, gy + gh / 2 + 1);
  } else {
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
  }

  const a = rpmA(gs.rpm);
  g.strokeStyle = '#fff4e0';
  g.shadowColor = AMBER;
  g.shadowBlur = cockpit ? 12 : 10;
  g.lineWidth = cockpit ? 7 : 3.5;
  g.beginPath();
  g.moveTo(cx - Math.cos(a) * (cockpit ? 16 : 14), cy - Math.sin(a) * (cockpit ? 16 : 14));
  g.lineTo(cx + Math.cos(a) * (R - (cockpit ? 10 : 12)), cy + Math.sin(a) * (R - (cockpit ? 10 : 12)));
  g.stroke();
  g.shadowBlur = 0;

  g.fillStyle = '#20242c';
  g.beginPath();
  g.arc(cx, cy, cockpit ? 10 : 8, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = AMBER;
  g.lineWidth = cockpit ? 2.5 : 1.5;
  g.stroke();

  if (!gs.engineOn) {
    g.fillStyle = flash ? RED : 'rgba(255, 59, 47, 0.4)';
    g.font = cockpit ? `bold 24px ${FONT}` : `10px ${FONT}`;
    g.fillText('ENGINE OFF', cx, cy - R * (cockpit ? 0.65 : 0.62));
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

  /**
   * The car, and optionally one style for every car (`CLUSTER_STYLES`, or 'car' or null for the
   * car's own, `spec.dash.hud`).
   * @param {CarSpec} spec @param {string | null} [override]
   */
  setSpec(spec, override = this.override ?? null) {
    this.spec = spec;
    this.override = override;
    this.style = clusterStyleOf(spec, override);
    this.maxRpm = maxRpmOf(spec);
    /** @type {Map<string, HTMLCanvasElement>} */
    this.faces = new Map();
  }

  /**
   * Dial faces are painted once per car into an image at twice the size and drawn from there.
   * @type {import('./cluster-styles.js').DialPainter}
   */
  dial = (g, cx, cy, m, type, spec, face) => {
    const key = `${type}|${face}|${m}`;
    let c = this.faces.get(key);
    if (!c) {
      c = document.createElement('canvas');
      c.width = c.height = Math.ceil(m * 4);
      const cg = /** @type {CanvasRenderingContext2D} */ (c.getContext('2d'));
      cg.scale(2, 2);
      paintDial(cg, m, m, m, type, spec, face);
      this.faces.set(key, c);
    }
    g.drawImage(c, cx - m, cy - m, m * 2, m * 2);
  };

  /** @param {boolean} on */
  show(on) {
    this.canvas.style.display = on ? 'block' : 'none';
  }

  /** @param {Gauges} gs @param {number} dt */
  draw(gs, dt) {
    this.t += dt;
    if (this.style === 'classic') drawCluster(this.g, gs, this.spec, this.t, W, H, false);
    else drawStyled(this.g, this.style, gs, this.spec, this.t, this.dial);
  }
}
