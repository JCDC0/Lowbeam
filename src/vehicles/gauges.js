/**
 * Simulated gauge readings for the HUD cluster and the cockpit dash, fed by the physics
 * state each tick. Pure, no three.js. Temperature, exhaust temperature, damage and the
 * blown state belong to the physics (`thermal.js`) because they change how the car
 * drives; the gauges mirror them. Boost and manifold vacuum are cosmetic.
 *
 *  - temp: engine temperature, 80 to 120 C. Red from 110 C, where power starts to fall.
 *  - boost: turbo cars, -0.7 to +1.2 bar. Builds above the spool rpm with lag, dumps on
 *    a shift and sits in vacuum off throttle.
 *  - intake: naturally aspirated cars, manifold pressure -0.8 to 0 bar. Deep vacuum on a
 *    closed throttle, near zero at full throttle.
 *  - exh: exhaust gas temperature, 300 to 900 C, following load and rpm.
 *  - gear: 'R', 'N' or '1' to the car's top gear; `gears` is how many forward gears it has.
 *  - overrev (0 to 1, toward the blow rpm), damage (0 to 1) and blown (limp mode).
 */

import { clamp } from '../core/mathx.js';
import { TEMP_MAX, TEMP_MIN, TEMP_RED, EXH_MAX, EXH_MIN } from './thermal.js';

export { TEMP_MAX, TEMP_MIN, TEMP_RED, EXH_MAX, EXH_MIN };

/** @typedef {import('./specs.js').CarSpec} CarSpec */
/** @typedef {ReturnType<typeof import('./physics.js').createVehicleState>} VehicleState */

export const BOOST_MIN = -0.7;
export const INTAKE_MIN = -0.8;

/** @param {CarSpec} spec */
export function createGauges(spec) {
  return {
    turbo: !!spec.engine.turbo,
    rpm: spec.engine.idle,
    kmh: 0,
    gear: 'N',
    gears: spec.gears.length,
    fuel: spec.fuel.tank,
    tank: spec.fuel.tank,
    temp: 84,
    boost: -0.6,
    intake: -0.65,
    exh: 360,
    load: 0,
    overrev: 0,
    damage: 0,
    blown: false,
    shift: false,
    limiter: false,
    engineOn: true,
  };
}

/** @typedef {ReturnType<typeof createGauges>} Gauges */

/** First-order lag toward a target with separate rise and fall time constants. */
function follow(v, target, rise, fall, dt) {
  const tau = target > v ? rise : fall;
  return v + (target - v) * (1 - Math.exp(-dt / tau));
}

/**
 * @param {Gauges} g @param {CarSpec} spec @param {VehicleState} s @param {number} dt
 */
export function stepGauges(g, spec, s, dt) {
  const eng = spec.engine;
  const on = s.engineOn;
  const thr = on ? s.throttle : 0;
  g.engineOn = on;
  g.rpm = s.rpm;
  // The magnitude of the velocity, not its forward part, so a spinning car's speedo does not swing.
  g.kmh = s.speed * 3.6;
  g.gear = s.gear < 0 ? 'R' : s.gear === 0 ? 'N' : !s.manual && s.speed < 0.3 && thr < 0.05 ? 'N' : String(s.gear);
  g.gears = spec.gears.length;
  g.fuel = s.fuel;
  g.shift = on && s.gear > 0 && s.gear < spec.gears.length && s.rpm > eng.shiftUp * 0.96;
  g.limiter = s.limiter > 0;
  g.load = s.load;
  g.temp = s.temp;
  g.exh = s.exh;
  g.overrev = s.overrev;
  g.damage = s.damage;
  g.blown = s.blown;

  const rpmFrac = clamp(s.rpm / eng.redline, 0, 1);
  const vacuum = on ? -0.55 - 0.2 * rpmFrac : 0;
  if (eng.turbo) {
    const t = eng.turbo;
    const spool = clamp((s.rpm - t.spoolRpm * 0.6) / (t.spoolRpm * 0.6), 0, 1);
    let target = thr > 0.08 ? -0.15 + (t.boost + 0.15) * thr * spool : vacuum;
    if (s.shiftTimer > 0) target = Math.min(target, -0.2);
    g.boost = clamp(follow(g.boost, target, t.lag, 0.18, dt), BOOST_MIN, t.boost);
    g.intake = 0;
  } else {
    const target = thr > 0.02 ? vacuum * (1 - thr) * (1 - thr) : vacuum;
    g.intake = clamp(follow(g.intake, target, 0.07, 0.12, dt), INTAKE_MIN, 0);
    g.boost = 0;
  }
  return g;
}
