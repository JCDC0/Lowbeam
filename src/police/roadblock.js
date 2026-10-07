/**
 * Roadblocks and spike strips, in the line of Most Wanted (2005). Pure, no three.js: the director
 * decides when, these functions decide where, the sim parks the units, the renderer draws the cars
 * and the strip. A roadblock is two or three units parked across the road a few hundred meters
 * ahead with a gap to aim for; a spike strip lies across that gap and flattens the tires.
 */

import { clamp } from '../core/mathx.js';

/** A roadblock goes in this far to `far` meters ahead of the player, along their lane. */
const NEAR = 250;
const FAR = 400;
/** How many units across a roadblock (the road is split into this many slots plus the gap). */
const ACROSS = [2, 3];
/** A roadblock is not set up where the player could watch it happen. */
const SETUP_RANGE = 150;
/** Half the depth of a strip along the road, plus a wheel's reach, meters. */
const STRIP_DEPTH = 1.4;
/** How long the tires stay flat, and the grip and top-speed penalty while they are. */
export const FLAT_TIME = 22;
const FLAT_GRIP = 0.62;
const FLAT_TOP = 0.72;

/**
 * Where a roadblock should stand: across the road of the player's lane a few hundred meters
 * ahead, the units spread over its whole width with a gap at one end. Returns the lane, the arc
 * length, the road's center there and one spot per unit, or null when the lane ends first.
 * @param {{ lane: any, s: number, sample: (lane: any, s: number, out: any) => any }} ctx the player's
 *   lane and arc length, and the net's sample
 * @param {number} heat the roadblock appears at heat 4 and up
 * @param {() => number} [rand] 0..1, Math.random by default
 */
export function planRoadblock(ctx, heat, rand = Math.random) {
  if (heat < 4) return null;
  const { lane, s, sample } = ctx;
  if (!lane) return null;
  let ahead = s + NEAR + rand() * (FAR - NEAR);
  if (lane.closed) ahead %= lane.length;
  else if (ahead >= lane.length - 20) return null;
  const q = sample(lane, ahead, {});
  if (!q || q.tx === undefined) return null;
  // The lane sample sits `offset` to the left of the road's center: step back to the center.
  const off = lane.offset || 0;
  const cx = q.x - q.tz * off;
  const cz = q.z + q.tx * off;
  const count = ACROSS[Math.floor(rand() * ACROSS.length)];
  const halfW = lane.road.hw;
  const slots = count + 1;
  const step = (halfW * 2) / slots;
  // Lateral runs to the right of travel; the gap is the leftmost or the rightmost slot.
  const gapAtLeft = rand() < 0.5;
  const units = [];
  for (let i = 0; i < slots; i++) {
    if (gapAtLeft ? i === 0 : i === slots - 1) continue;
    const lateral = -halfW + (i + 0.5) * step;
    units.push({
      x: cx - q.tz * lateral,
      z: cz + q.tx * lateral,
      y: q.y,
      // Parked across the road, nose to the side of the gap.
      yaw: Math.atan2(q.tx, q.tz) + (gapAtLeft ? -Math.PI / 2 : Math.PI / 2),
      index: units.length,
    });
  }
  const gap = { side: gapAtLeft ? -1 : 1, half: step / 2 };
  return { lane, s: ahead, x: cx, z: cz, y: q.y, units, gap, tx: q.tx, tz: q.tz, halfW };
}

/**
 * Whether a roadblock should be laid right now: at heat 4 and up, none standing, and the last
 * one long enough ago.
 * @param {{ x: number, z: number }} player @param {{ x: number, z: number } | null} existing
 * @param {number} heat @param {number} minGap seconds left before another may go up
 */
export function shouldSetRoadblock(player, existing, heat, minGap) {
  if (heat < 4) return false;
  if (existing) return false;
  if (minGap > 0) return false;
  return true;
}

/** Whether the player is close enough to watch a roadblock being set up. @param {any} block @param {{x:number,z:number}} player */
export function tooNearBlock(block, player) {
  if (!block) return true;
  return Math.hypot(block.x - player.x, block.z - player.z) < SETUP_RANGE;
}

/**
 * Lays a spike strip across a roadblock's gap. Returns its center, its axis across the road
 * (`nx`, `nz`, pointing right of travel), its length, and the yaw of the road there: a model
 * turned by it faces along the road with its x axis across.
 * @param {any} block the roadblock @param {number} heat heat 4 and up get a strip
 */
export function planSpikes(block, heat) {
  if (!block || !block.gap) return null;
  if (heat < 4) return null;
  const halfW = block.halfW ?? (block.lane ? block.lane.road.hw : 5);
  const lateral = block.gap.side * (halfW - block.gap.half);
  const nx = -block.tz;
  const nz = block.tx;
  const len = block.gap.half * 2;
  return {
    x: block.x + nx * lateral,
    z: block.z + nz * lateral,
    y: block.y,
    nx, nz, len,
    yaw: Math.atan2(block.tx, block.tz),
  };
}

/** Whether the car is over the strip: within its length across the road and its depth along it. @param {any} strip @param {{x:number,z:number}} s */
export function hitSpikes(strip, s) {
  if (!strip) return false;
  const dx = s.x - strip.x;
  const dz = s.z - strip.z;
  const across = dx * strip.nx + dz * strip.nz;
  const along = -dx * strip.nz + dz * strip.nx;
  return Math.abs(across) < strip.len / 2 + 0.9 && Math.abs(along) < STRIP_DEPTH;
}

/**
 * The spike effect on the car: how much grip and top speed are lost while the tires are flat,
 * and how long is left. Mended with time, at a pump, or by a tow.
 * @param {number} time seconds the tires have been flat
 */
export function spikePenalty(time) {
  const left = Math.max(0, FLAT_TIME - time);
  if (time <= 0 || time >= FLAT_TIME) return { grip: 1, top: 1, left: 0, active: false };
  const flat = clamp(time / 1.5, 0, 1);
  return { grip: 1 - (1 - FLAT_GRIP) * flat, top: 1 - (1 - FLAT_TOP) * flat, left, active: true };
}
