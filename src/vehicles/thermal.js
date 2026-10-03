/**
 * Engine health: coolant and exhaust temperature, over-rev damage, the money shift and
 * limp mode. Pure, no three.js. `physics.js` calls `stepEngineHealth` once per tick with
 * the engine rpm it just used, and reads `thermalDerate` and `limpScale` back when it
 * works out torque.
 *
 *  - temp: coolant, 80 to 120 C. Load heats it, airflow from speed cools it, slowly.
 *    From `TEMP_RED` (110 C) the engine loses power, down to 70 % at 120 C.
 *  - exh: exhaust gas temperature, 300 to 900 C, follows load and rpm.
 *  - overrev: 0 to 1, how far the engine rpm is past the redline toward the blow limit
 *    (`engine.blowRpm`, 11,000 for every car). A small dead zone ignores limiter chatter.
 *  - damage: 0 to 1, builds while over-revving. At 1 the engine is blown.
 *  - blown: the engine is wrecked. Rpm driven by the wheels at or above the blow limit
 *    (a money shift: 5th to 1st at speed, or into reverse while moving) blows it at once.
 *    Temperature and exhaust peg at their maximum, torque falls to a quarter, the rpm is
 *    capped and the car creeps. `repairEngine` clears all of it.
 */

import { clamp, smoothstep } from '../core/mathx.js';

/** @typedef {import('./specs.js').CarSpec} CarSpec */
/** @typedef {ReturnType<typeof import('./physics.js').createVehicleState>} VehicleState */

export const TEMP_MIN = 80;
export const TEMP_MAX = 120;
export const TEMP_RED = 110;
export const TEMP_START = 84;
export const EXH_MIN = 300;
export const EXH_MAX = 900;
export const EXH_START = 360;
/** Rpm at which a wheel-driven engine blows, for any car without its own `engine.blowRpm`. */
export const BLOW_RPM = 11000;
/** Rpm past the redline that does not count as an over-rev, so limiter chatter is harmless. */
const OVERREV_DEADZONE = 150;
/** Damage per second at full over-rev. */
const DAMAGE_RATE = 0.18;
/** A blown engine makes this fraction of its torque and may not rev past `LIMP_RPM`. */
export const LIMP_TORQUE = 0.25;
export const LIMP_RPM = 2000;
/** Meters per second above which a blown engine's torque tapers to nothing. */
const LIMP_SPEED = [14, 18];
/** Seconds the wheels grab when the engine seizes at the moment it blows. */
const SEIZE_TIME = 0.35;

/** @param {CarSpec} spec */
export const blowRpmOf = (spec) => spec.engine.blowRpm || BLOW_RPM;

/** Torque multiplier from heat: 1 up to 108 C, 0.7 at 120 C. @param {number} temp */
export function thermalDerate(temp) {
  return 1 - 0.3 * smoothstep(108, 120, temp);
}

/**
 * Torque multiplier from damage and limp mode.
 * @param {VehicleState} s
 */
export function healthScale(s) {
  if (!s.blown) return 1 - 0.2 * s.damage;
  const v = Math.abs(s.vLong);
  return LIMP_TORQUE * (1 - smoothstep(LIMP_SPEED[0], LIMP_SPEED[1], v));
}

/** First-order lag toward a target with separate rise and fall time constants. */
function follow(v, target, rise, fall, dt) {
  const tau = target > v ? rise : fall;
  return v + (target - v) * (1 - Math.exp(-dt / tau));
}

/**
 * @param {VehicleState} s @param {CarSpec} spec
 * @param {number} rpm engine rpm used this tick
 * @param {number} wheelRpm rpm the driven wheels are forcing on the engine, 0 in neutral
 * @param {number} dt
 */
export function stepEngineHealth(s, spec, rpm, wheelRpm, dt) {
  const eng = spec.engine;
  const on = s.engineOn;
  const blow = blowRpmOf(spec);
  const rpmFrac = clamp(rpm / eng.redline, 0, 1);

  s.load = follow(s.load, on ? s.throttle * (0.35 + 0.65 * rpmFrac) : 0, 0.3, 0.6, dt);
  s.overrev = on ? clamp((rpm - eng.redline - OVERREV_DEADZONE) / (blow - eng.redline - OVERREV_DEADZONE), 0, 1) : 0;
  s.seize = Math.max(0, s.seize - dt);

  if (!s.blown) {
    s.damage = Math.min(1, s.damage + DAMAGE_RATE * Math.pow(s.overrev, 1.5) * dt);
    if (on && (wheelRpm >= blow || s.damage >= 1)) {
      s.blown = true;
      s.damage = 1;
      s.blowCount++;
      s.seize = SEIZE_TIME;
    }
  }

  const airflow = clamp(s.speed / 28, 0, 1);
  const tempTarget = on ? 84 + 30 * s.load * (1.15 - 0.75 * airflow) + 7 * (1 - airflow) - 3 * airflow + 22 * s.overrev : 80;
  s.temp = clamp(follow(s.temp, tempTarget, 22, 40, dt), TEMP_MIN, TEMP_MAX);
  const exhTarget = on ? 330 + 560 * Math.pow(s.load, 0.85) * (0.45 + 0.55 * rpmFrac) + 140 * s.overrev : EXH_MIN;
  s.exh = clamp(follow(s.exh, exhTarget, 1.6, 3.5, dt), EXH_MIN, EXH_MAX);
  if (s.blown) {
    s.temp = TEMP_MAX;
    s.exh = EXH_MAX;
  }
}

/**
 * A new engine: clears damage, the blown state and the heat.
 * @param {VehicleState} s
 */
export function repairEngine(s) {
  s.damage = 0;
  s.blown = false;
  s.overrev = 0;
  s.seize = 0;
  s.temp = TEMP_START;
  s.exh = EXH_START;
  s.load = 0;
}

/**
 * What a full repair costs in yen, scaled by how hurt the engine is.
 * @param {VehicleState} s
 */
export function repairCost(s) {
  return s.blown ? 12000 : Math.round((s.damage * 8000) / 100) * 100;
}
