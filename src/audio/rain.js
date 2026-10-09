/**
 * Rain audio synthesis and parameter curves (B3 part 2).
 * Pure: calculates gains and filter frequencies for rain bed, patter, roof drumming
 * and wet tire hiss.
 */

import { clamp } from '../core/mathx.js';

/**
 * Calculates rain audio levels and filter frequencies from weather level, speed and shelter.
 * @param {number} level 0 dry to 1 a storm (from world.weather)
 * @param {{ underRoof?: boolean, speed?: number }} [opts]
 * @returns {{ bed: number, patter: number, roof: number, wetTire: number, filterFreq: number }}
 */
export function rainGains(level, opts = {}) {
  const l = clamp(level || 0, 0, 1);
  if (l <= 0) {
    return { bed: 0, patter: 0, roof: 0, wetTire: 0, filterFreq: 1200 };
  }
  const underRoof = !!opts.underRoof;
  const speed = Math.max(0, opts.speed || 0);

  // Bed: broad hiss that rises with rain level; significantly reduced under a roof.
  // In drizzle (0.35) ~0.04; in storm (1.0) ~0.16.
  const baseBed = 0.02 + 0.14 * Math.pow(l, 1.2);
  const bed = underRoof ? baseBed * 0.12 : baseBed;

  // Filter frequency: opens up from a soft patter in drizzle to a broad hiss in a storm.
  const filterFreq = 1600 + l * 2600;

  // Patter: raindrops hitting the stationary car and windshield.
  // Rises when stopped/slow, masked by speed and wind when fast; zero under a roof.
  const stoppedFactor = Math.pow(1 - clamp(speed / 20, 0, 1), 1.5);
  const patter = underRoof ? 0 : (0.02 + 0.09 * l) * stoppedFactor;

  // Roof patter: rain drumming on a metal canopy, concrete slab or bridge deck overhead.
  // Active only when sheltered under a roof in rain.
  const roof = underRoof ? 0.04 + 0.12 * l : 0;

  // Wet tire hiss: high-frequency hiss from rolling on wet tarmac with speed.
  const wetTire = clamp(speed / 35, 0, 1) * Math.min(1, l * 1.5) * 0.22;

  return { bed, patter, roof, wetTire, filterFreq };
}
