/**
 * Pure: each car's instruments (which gauges, where, how big) and the scale and needle angle
 * of every gauge type. `cockpit.js` models them.
 */

/**
 * @typedef {'tach' | 'speed' | 'fuel' | 'temp' | 'boost' | 'oil' | 'volt'} GaugeType
 * @typedef {'classic' | 'white' | 'yellow' | 'tuner'} GaugeFace
 * @typedef {{ type: GaugeType, u: number, v: number, r: number, face?: GaugeFace }} GaugeSpot
 * @typedef {{ pod: 'cluster' | 'top' | 'center', w: number, h: number, gauges: GaugeSpot[], shift?: boolean,
 *   screen?: 'lcd' | 'vfd' }} DashPod
 *
 * A gauge's `face` is how its dial is painted: `classic` black with white ticks (the Hayate's, the
 * original), `white` cream with black ticks and numerals (a 60s and 70s muscle car), `yellow` with
 * black ticks and numerals (an Italian exotic's tach), `tuner` an aftermarket racing gauge (black,
 * red lit ticks and numerals, white past the redline, a small LCD readout in the open lower right,
 * the needle parked straight down; it sweeps 270 degrees from 6 o'clock to 3 o'clock). A pod with a `screen` is not dials but one
 * display drawn every frame (screens.js): `lcd` a modern digital cluster, `vfd` an 80s vacuum
 * fluorescent one; its `gauges` list what the screen shows, laid out as a strip.
 */

/**
 * Each car's instruments: the Hayate the classic black dials with an aftermarket racing tach in the
 * middle and a racing boost gauge in a pod on the dash top (the tuner's), the
 * Rampart only a big white speedometer and tach, the Vespera yellow dials with no boost or exhaust
 * gauge, the Tsurugi a digital LCD cluster and a three-gauge center stack, the Hikari a green and
 * amber fluorescent display.
 * @type {Record<string, DashPod[]>}
 */
export const DASHES = {
  hayate: [
    { pod: 'cluster', w: 0.34, h: 0.16, shift: true, gauges: [
      { type: 'speed', u: -0.115, v: 0, r: 0.06 },
      { type: 'tach', u: 0.025, v: 0, r: 0.07, face: 'tuner' },
      { type: 'fuel', u: 0.135, v: 0.032, r: 0.03 },
      { type: 'temp', u: 0.135, v: -0.035, r: 0.03 },
    ] },
    { pod: 'top', w: 0.08, h: 0.08, gauges: [{ type: 'boost', u: 0, v: 0, r: 0.034, face: 'tuner' }] },
  ],
  rampart: [
    { pod: 'cluster', w: 0.32, h: 0.16, gauges: [
      { type: 'speed', u: -0.078, v: 0, r: 0.072, face: 'white' },
      { type: 'tach', u: 0.078, v: 0, r: 0.072, face: 'white' },
    ] },
  ],
  vespera: [
    { pod: 'cluster', w: 0.38, h: 0.17, shift: true, gauges: [
      { type: 'speed', u: -0.14, v: -0.005, r: 0.058, face: 'yellow' },
      { type: 'tach', u: 0, v: 0, r: 0.076, face: 'yellow' },
      { type: 'temp', u: 0.13, v: 0.032, r: 0.031, face: 'yellow' },
      { type: 'fuel', u: 0.13, v: -0.036, r: 0.031, face: 'yellow' },
    ] },
  ],
  tsurugi: [
    { pod: 'cluster', w: 0.38, h: 0.16, shift: true, screen: 'lcd', gauges: [
      { type: 'speed', u: -0.135, v: 0, r: 0.058 },
      { type: 'tach', u: 0, v: 0, r: 0.072 },
      { type: 'fuel', u: 0.128, v: 0.032, r: 0.03 },
      { type: 'temp', u: 0.128, v: -0.035, r: 0.03 },
    ] },
    { pod: 'center', w: 0.24, h: 0.08, gauges: [
      { type: 'boost', u: -0.075, v: 0, r: 0.03 },
      { type: 'oil', u: 0, v: 0, r: 0.03 },
      { type: 'volt', u: 0.075, v: 0, r: 0.03 },
    ] },
  ],
  hikari: [
    { pod: 'cluster', w: 0.4, h: 0.15, shift: true, screen: 'vfd', gauges: [
      { type: 'tach', u: -0.16, v: 0, r: 0.03 },
      { type: 'speed', u: -0.08, v: 0, r: 0.03 },
      { type: 'boost', u: 0, v: 0, r: 0.03 },
      { type: 'fuel', u: 0.08, v: 0, r: 0.03 },
      { type: 'temp', u: 0.16, v: 0, r: 0.03 },
    ] },
  ],
};

/**
 * How many of `n` segments a bar graph lights for a value from 0 to `max`.
 * @param {number} value @param {number} max @param {number} n
 */
export function segmentsLit(value, max, n) {
  return Math.max(0, Math.min(n, Math.round((value / max) * n)));
}

/**
 * The color zone of segment `i` of an `n` segment tach that runs to `max` rpm: red from the
 * redline, amber for the 1,500 rpm before it, green below.
 * @param {number} i @param {number} n @param {number} max @param {number} redline
 * @returns {'green' | 'amber' | 'red'}
 */
export function tachZone(i, n, max, redline) {
  const rpm = ((i + 0.5) / n) * max;
  return rpm >= redline ? 'red' : rpm >= redline - 1500 ? 'amber' : 'green';
}

/** Needle sweep: from 225 degrees (lower left) clockwise through the top to -45 (lower right). */
const SWEEP = (270 * Math.PI) / 180;
const SMALL_SWEEP = (100 * Math.PI) / 180;

/**
 * The scale of a gauge for a car: min, max, numeral step, minor tick step, red zone start,
 * label, and whether it is a small arc gauge.
 * @param {GaugeType} type @param {import('./specs.js').CarSpec} spec
 */
export function gaugeScale(type, spec) {
  const e = spec.engine;
  switch (type) {
    case 'tach': {
      const max = Math.ceil((e.redline + 1000) / 1000) * 1000;
      return { min: 0, max, major: 1000, minor: 500, red: e.redline, label: 'x1000', small: false, div: 1000 };
    }
    case 'speed': {
      const max = 160 + spec.bars.topSpeed * 20;
      return { min: 0, max, major: 40, minor: 20, red: Infinity, label: 'km/h', small: false, div: 1 };
    }
    case 'fuel':
      return { min: 0, max: 1, major: 0.5, minor: 0.25, red: Infinity, label: 'FUEL', small: true, div: 1 };
    case 'temp':
      return { min: 60, max: 130, major: 35, minor: 17.5, red: 110, label: 'TEMP', small: true, div: 1 };
    case 'boost':
      return { min: -1, max: 1.5, major: 1, minor: 0.5, red: 1.3, label: 'BOOST', small: false, div: 1 };
    case 'oil':
      return { min: 0, max: 8, major: 4, minor: 1, red: Infinity, label: 'OIL', small: false, div: 1 };
    default:
      return { min: 8, max: 18, major: 5, minor: 1, red: 16, label: 'VOLT', small: false, div: 1 };
  }
}

/**
 * Angle of the needle from straight up, clockwise positive, for a value.
 * @param {ReturnType<typeof gaugeScale>} scale @param {number} value
 */
export function needleAngle(scale, value) {
  const t = Math.max(0, Math.min(1, (value - scale.min) / (scale.max - scale.min)));
  return scale.small ? -SMALL_SWEEP / 2 + SMALL_SWEEP * t : -SWEEP / 2 + SWEEP * t;
}

/**
 * The needle angle on a given face: the `tuner` face parks the needle straight down and sweeps
 * 270 degrees clockwise to 3 o'clock, leaving the lower right for its readout; the others as
 * `needleAngle`.
 * @param {ReturnType<typeof gaugeScale>} scale @param {number} value @param {GaugeFace} [face]
 */
export function dialAngle(scale, value, face) {
  if (face !== 'tuner') return needleAngle(scale, value);
  const t = Math.max(0, Math.min(1, (value - scale.min) / (scale.max - scale.min)));
  return Math.PI + SWEEP * t;
}

