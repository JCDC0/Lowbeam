/**
 * Pure: each car's instruments (which gauges, where, how big) and the scale and needle angle
 * of every gauge type. `cockpit.js` models them.
 */

/**
 * @typedef {'tach' | 'speed' | 'fuel' | 'temp' | 'boost' | 'oil' | 'volt'} GaugeType
 * @typedef {{ type: GaugeType, u: number, v: number, r: number }} GaugeSpot
 * @typedef {{ pod: 'cluster' | 'top' | 'center', w: number, h: number, gauges: GaugeSpot[], shift?: boolean }} DashPod
 */

/**
 * Each car's instruments: the Hayate has a boost pod on the dash top, the Rampart only a
 * speedometer and a tach, the Vespera no boost or exhaust gauge, the Tsurugi a three-gauge
 * center stack.
 * @type {Record<string, DashPod[]>}
 */
export const DASHES = {
  hayate: [
    { pod: 'cluster', w: 0.34, h: 0.16, shift: true, gauges: [
      { type: 'speed', u: -0.115, v: 0, r: 0.06 },
      { type: 'tach', u: 0.025, v: 0, r: 0.07 },
      { type: 'fuel', u: 0.135, v: 0.032, r: 0.03 },
      { type: 'temp', u: 0.135, v: -0.035, r: 0.03 },
    ] },
    { pod: 'top', w: 0.08, h: 0.08, gauges: [{ type: 'boost', u: 0, v: 0, r: 0.034 }] },
  ],
  rampart: [
    { pod: 'cluster', w: 0.32, h: 0.16, gauges: [
      { type: 'speed', u: -0.078, v: 0, r: 0.072 },
      { type: 'tach', u: 0.078, v: 0, r: 0.072 },
    ] },
  ],
  vespera: [
    { pod: 'cluster', w: 0.38, h: 0.17, shift: true, gauges: [
      { type: 'speed', u: -0.14, v: -0.005, r: 0.058 },
      { type: 'tach', u: 0, v: 0, r: 0.076 },
      { type: 'temp', u: 0.13, v: 0.032, r: 0.031 },
      { type: 'fuel', u: 0.13, v: -0.036, r: 0.031 },
    ] },
  ],
  tsurugi: [
    { pod: 'cluster', w: 0.38, h: 0.16, shift: true, gauges: [
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
};

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

