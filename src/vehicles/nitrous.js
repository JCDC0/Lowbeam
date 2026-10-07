/**
 * Nitrous: one bottle per car, held on a key, a shot of torque that costs the engine. Pure, no
 * three.js; `physics.js` calls `stepNitrous` each step and adds what it returns to the engine's
 * torque after the rev limiter has had its say.
 *
 * The cost is real, as Jc asked: the engine heats while it flows, every second of flow adds a little
 * damage (three times more near the limiter), and because the nitrous torque is not cut by the rev
 * limiter, holding it through a gear keeps driving the revs up past the redline into over-rev, and
 * past the blow limit the engine goes the way of a money shift. Shifting up in time is the skill.
 */

import { clamp } from '../core/mathx.js';

export const NITROUS = {
  /** Seconds a full bottle flows. */
  duration: 8,
  /** Extra torque while it flows, as a fraction of the engine's peak torque. */
  torque: 0.45,
  /** The throttle has to be at least this far open for it to flow. */
  minThrottle: 0.5,
  /** Coolant degrees per second it adds while it flows: a full bottle is about 20 degrees. */
  heat: 2.6,
  /** Damage per second of flow, and the extra per second right at the limiter. */
  damage: 0.004,
  limiterDamage: 0.012,
  /** From this fraction of the redline the limiter damage starts to count. */
  nearLimiter: 0.88,
  /** Yen for a full refill at a pump. */
  price: 6000,
};

/**
 * One step of the bottle. Returns the extra torque (N m) to add to the engine's, 0 when it does not
 * flow: the bottle empty, the key up, the throttle not open, the engine off or blown, or not in a
 * forward gear.
 * @param {{ n2o: number, n2oOn: boolean, engineOn: boolean, blown: boolean, gear: number, temp: number, damage: number }} s
 * @param {import('./specs.js').CarSpec} spec @param {boolean} want the key is held
 * @param {number} accel throttle 0..1 @param {number} rpm @param {number} dt
 */
export function stepNitrous(s, spec, want, accel, rpm, dt) {
  const flowing = !!want && s.n2o > 0 && s.engineOn && !s.blown && s.gear > 0 && accel >= NITROUS.minThrottle;
  s.n2oOn = flowing;
  if (!flowing) return 0;
  s.n2o = Math.max(0, s.n2o - dt / NITROUS.duration);
  s.temp += NITROUS.heat * dt;
  const near = clamp((rpm / spec.engine.redline - NITROUS.nearLimiter) / (1 - NITROUS.nearLimiter), 0, 1);
  s.damage = Math.min(1, s.damage + (NITROUS.damage + NITROUS.limiterDamage * near) * dt);
  return spec.engine.peakTorque * NITROUS.torque;
}

/** Yen to fill the bottle from where it is. @param {{ n2o: number }} s */
export const refillCost = (s) => Math.round(((1 - s.n2o) * NITROUS.price) / 100) * 100;
