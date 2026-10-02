/**
 * Surface properties for the tire model.
 * mu: grip multiplier. peak: slip angle (rad) of peak lateral force. shape: how much
 * grip falls away past the peak (higher slides more). roll: rolling resistance factor.
 * loose: true when the car's `looseGrip` applies (gravel tires vs slicks).
 */
export const SURFACES = {
  asphalt: { mu: 1.0, peak: 0.1, shape: 1.3, roll: 1.0, loose: false },
  concrete: { mu: 0.97, peak: 0.1, shape: 1.3, roll: 1.0, loose: false },
  gravel: { mu: 0.7, peak: 0.17, shape: 1.45, roll: 1.8, loose: true },
  dirt: { mu: 0.64, peak: 0.18, shape: 1.45, roll: 2.4, loose: true },
  grass: { mu: 0.55, peak: 0.16, shape: 1.5, roll: 3.5, loose: true },
  sand: { mu: 0.5, peak: 0.2, shape: 1.5, roll: 6, loose: true },
  rock: { mu: 0.75, peak: 0.12, shape: 1.4, roll: 2.0, loose: true },
  water: { mu: 0.35, peak: 0.2, shape: 1.6, roll: 14, loose: true },
};

/** @param {string} name */
export function surface(name) {
  return SURFACES[name] || SURFACES.grass;
}
