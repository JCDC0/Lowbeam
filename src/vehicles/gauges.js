/**
 * Simulated gauge readings for the HUD cluster and the cockpit dash, fed by the physics
 * state each tick. Pure, no three.js. None of these feed back into the physics; they
 * exist so the needles move the way a driver expects.
 *
 *  - water: coolant, 80 to 120 C. Load heats it, airflow from speed cools it, slowly.
 *  - boost: turbo cars, -0.7 to +1.2 bar. Builds above the spool rpm with lag, dumps on
 *    a shift and sits in vacuum off throttle.
 *  - intake: naturally aspirated cars, manifold pressure -0.8 to 0 bar. Deep vacuum on a
 *    closed throttle, near zero at full throttle.
 *  - exh: exhaust gas temperature, 300 to 900 C, following load and rpm.
 */

import { clamp } from '../core/mathx.js';

/** @typedef {import('./specs.js').CarSpec} CarSpec */
/** @typedef {ReturnType<typeof import('./physics.js').createVehicleState>} VehicleState */

export const WATER_MIN = 80;
export const WATER_MAX = 120;
export const BOOST_MIN = -0.7;
export const INTAKE_MIN = -0.8;
export const EXH_MIN = 300;
export const EXH_MAX = 900;

/** @param {CarSpec} spec */
export function createGauges(spec) {
  return {
    turbo: !!spec.engine.turbo,
    rpm: spec.engine.idle,
    kmh: 0,
    gear: 'N',
    fuel: spec.fuel.tank,
    tank: spec.fuel.tank,
    water: 84,
    boost: -0.6,
    intake: -0.65,
    exh: 360,
    load: 0,
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
  const rpmFrac = clamp(s.rpm / eng.redline, 0, 1);
  g.engineOn = on;
  g.rpm = s.rpm;
  g.kmh = Math.abs(s.vLong) * 3.6;
  g.gear = s.gear < 0 ? 'R' : s.speed < 0.3 && thr < 0.05 ? 'N' : String(s.gear);
  g.fuel = s.fuel;
  g.shift = on && s.gear > 0 && s.gear < spec.gears.length && s.rpm > eng.shiftUp * 0.96;
  g.limiter = s.limiter > 0;

  g.load = follow(g.load, thr * (0.35 + 0.65 * rpmFrac), 0.3, 0.6, dt);
  const airflow = clamp(s.speed / 28, 0, 1);
  const waterTarget = on ? 84 + 30 * g.load * (1.15 - 0.75 * airflow) + 7 * (1 - airflow) - 3 * airflow : 80;
  g.water = clamp(follow(g.water, waterTarget, 22, 40, dt), WATER_MIN, WATER_MAX);

  const exhTarget = on ? 330 + 560 * Math.pow(g.load, 0.85) * (0.45 + 0.55 * rpmFrac) : EXH_MIN;
  g.exh = clamp(follow(g.exh, exhTarget, 1.6, 3.5, dt), EXH_MIN, EXH_MAX);

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
