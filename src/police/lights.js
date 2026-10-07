/**
 * The police light bar's flash pattern, pure so it can be tested and shared by the renderer and
 * anything else that flashes. Most Wanted's quad flash: the red half (the car's left) gives two
 * quick pulses, then the blue half (the right) gives two, then again. Each car runs its own phase so
 * a roadblock does not flash in unison.
 */

/** Seconds for one full cycle: red, red, blue, blue. */
export const FLASH_CYCLE = 0.8;
/** The pulses in a cycle, as [start, end] fractions, for the red half and the blue half. */
const RED = [[0, 0.12], [0.18, 0.3]];
const BLUE = [[0.5, 0.62], [0.68, 0.8]];

/** @param {number[][]} pulses @param {number} u */
const lit = (pulses, u) => pulses.some(([a, b]) => u >= a && u < b);

/**
 * Which halves of the bar are lit at time t for car `id`.
 * @param {number} t seconds @param {number} id the car's id, for its own phase
 * @returns {{ red: boolean, blue: boolean }}
 */
export function barFlash(t, id) {
  const u = (((t + id * 0.137) % FLASH_CYCLE) + FLASH_CYCLE) % FLASH_CYCLE / FLASH_CYCLE;
  return { red: lit(RED, u), blue: lit(BLUE, u) };
}

/** Whether a unit's bar is running: chasing, searching, or parked in a roadblock. @param {{ pursuit?: any, mode?: string }} a */
export const barOn = (a) => !!a.pursuit || a.mode === 'parked';
