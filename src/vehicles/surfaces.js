import { smoothstep } from '../core/mathx.js';

/**
 * Surface properties for the tire model.
 * mu: grip multiplier. peak: slip angle (rad) of peak lateral force. shape: how much
 * grip falls away past the peak (higher slides more). roll: rolling resistance factor.
 * loose: true when the car's `looseGrip` applies (gravel tires vs slicks).
 * slipPeak, slipEnd, slide: the drive wheels' slip ratio (spin speed over road speed)
 * up to which they keep full traction, the ratio at which they are fully spinning, and
 * the fraction of traction left once they are.
 */
export const SURFACES = {
  asphalt: { mu: 1.28, peak: 0.1, shape: 1.3, roll: 1.0, loose: false, slipPeak: 0.12, slipEnd: 0.45, slide: 0.92 },
  concrete: { mu: 1.24, peak: 0.1, shape: 1.3, roll: 1.0, loose: false, slipPeak: 0.12, slipEnd: 0.45, slide: 0.92 },
  gravel: { mu: 0.7, peak: 0.17, shape: 1.45, roll: 1.8, loose: true, slipPeak: 0.22, slipEnd: 0.7, slide: 0.9 },
  dirt: { mu: 0.64, peak: 0.18, shape: 1.45, roll: 2.4, loose: true, slipPeak: 0.22, slipEnd: 0.7, slide: 0.9 },
  grass: { mu: 0.55, peak: 0.16, shape: 1.5, roll: 3.5, loose: true, slipPeak: 0.25, slipEnd: 0.7, slide: 0.88 },
  sand: { mu: 0.5, peak: 0.2, shape: 1.5, roll: 6, loose: true, slipPeak: 0.3, slipEnd: 0.8, slide: 0.88 },
  rock: { mu: 0.75, peak: 0.12, shape: 1.4, roll: 2.0, loose: true, slipPeak: 0.2, slipEnd: 0.6, slide: 0.88 },
  water: { mu: 0.35, peak: 0.2, shape: 1.6, roll: 14, loose: true, slipPeak: 0.3, slipEnd: 0.8, slide: 0.8 },
};

/** @param {string} name */
export function surface(name) {
  return SURFACES[name] || SURFACES.grass;
}

/**
 * Fraction of the drive traction that survives a slip ratio: 1 up to `slipPeak`, then
 * easing down to `slide`.
 * @param {number} kappa @param {typeof SURFACES.asphalt} surf
 */
export function slipFactor(kappa, surf) {
  return 1 - (1 - surf.slide) * smoothstep(surf.slipPeak, surf.slipEnd, kappa);
}
