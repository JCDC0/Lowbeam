/**
 * When a car's tires leave marks and smoke: how hard each car is sliding, 0 (gripping) to 1 (a full
 * slide), from what each kind of car knows about itself. Pure, so a test can check the rules; the
 * marks and the smoke are drawn by `skids.js` and `traffic/damage-fx.js`.
 *
 * The player's car has the physics' slip (`skid`, the larger of the axles' slip and a locked or
 * spinning wheel) and `wheelspin`. Traffic has no tire model: a car knocked aside or wrecked slides by
 * its sideways speed, a car driving its lane by the grip its turn asks for (speed times yaw rate).
 */

/** The player's slip (`skid`) where marks start and where they are full. @type {[number, number]} */
export const PLAYER_SKID = [1.6, 5];
/** Sideways speed (m/s) of a knocked car or a wreck where marks start and where full. @type {[number, number]} */
export const SIDE_SLIP = [1.5, 6];
/** Lateral acceleration (m/s2) of a driving car's turn where marks start and where full. @type {[number, number]} */
export const TURN_GRIP = [6.5, 10];
/** Surfaces that take a mark; gravel, dirt and grass throw dust instead. */
export const MARKED = new Set(['asphalt', 'concrete']);

/** @param {number} v @param {[number, number]} r */
const ramp = (v, [a, b]) => Math.max(0, Math.min(1, (v - a) / (b - a)));

/**
 * How hard the player's car slides, 0 to 1. In the air or off the tarmac it leaves nothing.
 * @param {{ contact: boolean, skid: number, wheelspin: number, surfRear?: string, speed: number }} s
 */
export function playerSlide(s) {
  if (!s.contact || (s.surfRear && !MARKED.has(s.surfRear))) return 0;
  return Math.max(ramp(s.skid, PLAYER_SKID), ramp(s.wheelspin, [0.35, 0.9]));
}

/**
 * How hard a traffic car slides, 0 to 1. `turn` is its yaw rate this frame (rad/s), from the yaw it
 * had the frame before.
 * @param {{ mode: string, yaw: number, vx: number, vz: number, speed?: number }} a @param {number} turn
 */
export function agentSlide(a, turn) {
  if (a.mode === 'parked') return 0;
  const speed = Math.hypot(a.vx, a.vz);
  if (speed < 2) return 0;
  if (a.mode === 'knocked' || a.mode === 'wreck') {
    const side = Math.abs(a.vx * Math.cos(a.yaw) - a.vz * Math.sin(a.yaw));
    return ramp(side, SIDE_SLIP);
  }
  return ramp(speed * Math.abs(turn), TURN_GRIP);
}
