/**
 * What comes out of the tailpipes, as numbers. Pure, no three.js. `physics.js` calls
 * `stepExhaust` once per tick; `exhaust-fx.js` draws flames, sparks and smoke from the
 * result and `audio.js` turns `pops` into exhaust pops.
 *
 *  - flame 0 to 1: a flame at the tips. Bursts on a shift at high revs, flickers on a
 *    lift-off pop, crackles on the limiter and while over-revving.
 *  - sparks 0 to 1: a steady stream of sparks while over-revving, a short one on a shift.
 *  - smoke 0 to 1: a puff the moment the engine blows, then dense smoke for as long as it
 *    stays blown; thin smoke from a badly damaged engine.
 *  - pops: counter, +1 for every bang; `level` is the size of the last one.
 */

import { clamp, lerp } from '../core/mathx.js';

/** @typedef {import('./specs.js').CarSpec} CarSpec */
/** @typedef {ReturnType<typeof createFx>} Fx */

/** Rpm, as a fraction of the redline, above which a shift throws a flame. */
const SHIFT_FLAME_RPM = 0.8;
const BURST_TIME = 0.16;
const PUFF_TIME = 1.8;

export function createFx() {
  return {
    flame: 0, sparks: 0, smoke: 0, pops: 0, level: 0,
    burst: 0, puff: 0, queue: 0, gap: 0, crackle: 0, peak: 0, shifts: 0, blows: 0, seed: 1,
  };
}

/** @param {Fx} fx */
function rand(fx) {
  fx.seed = (Math.imul(fx.seed, 1664525) + 1013904223) >>> 0;
  return fx.seed / 4294967296;
}

/** One bang and its flame. @param {Fx} fx @param {number} level */
function pop(fx, level) {
  fx.pops++;
  fx.level = level;
  fx.flame = Math.max(fx.flame, 0.35 + 0.65 * level);
}

/**
 * @param {ReturnType<typeof import('./physics.js').createVehicleState>} s
 * @param {CarSpec} spec @param {number} dt
 */
export function stepExhaust(s, spec, dt) {
  const fx = s.fx;
  const red = spec.engine.redline;
  const frac = s.rpm / red;
  const on = s.engineOn;

  if (s.shiftCount !== fx.shifts) {
    fx.shifts = s.shiftCount;
    if (on && s.shiftRpm > red * SHIFT_FLAME_RPM) {
      fx.burst = BURST_TIME;
      pop(fx, 1);
    }
  }

  fx.peak = Math.max(s.throttle, fx.peak - dt * 2);
  if (on && s.throttle < 0.1 && fx.peak > 0.6 && frac > 0.55) {
    fx.queue = 2 + Math.floor(rand(fx) * 3);
    fx.gap = 0;
    fx.peak = 0;
  }
  if (fx.queue > 0) {
    fx.gap -= dt;
    if (fx.gap <= 0) {
      pop(fx, 0.35 + 0.4 * rand(fx));
      fx.queue--;
      fx.gap = 0.06 + 0.07 * rand(fx);
    }
  }

  const over = on ? s.overrev : 0;
  const limiting = on && s.limiter > 0 && s.throttle > 0.5 && frac > 0.9;
  if (over > 0 || limiting) {
    fx.crackle -= dt;
    if (fx.crackle <= 0) {
      pop(fx, clamp(0.3 + 0.7 * over + 0.2 * rand(fx), 0, 1));
      fx.crackle = lerp(0.14, 0.045, over) + 0.04 * rand(fx);
    }
  }

  fx.burst = Math.max(0, fx.burst - dt);
  fx.flame = Math.max(0, fx.flame - dt * 9);
  if (fx.burst > 0) fx.flame = Math.max(fx.flame, 0.7 + 0.3 * rand(fx));
  fx.sparks = over > 0 ? 0.35 + 0.65 * over : fx.burst > 0 ? 0.6 : 0;

  if (s.blowCount !== fx.blows) {
    fx.blows = s.blowCount;
    fx.puff = PUFF_TIME;
  }
  fx.puff = Math.max(0, fx.puff - dt);
  const steady = s.blown ? 0.7 : s.damage > 0.4 ? 0.2 * s.damage : 0;
  fx.smoke = on || s.blown ? Math.max(steady, Math.min(1, fx.puff / 0.8)) : 0;
}
