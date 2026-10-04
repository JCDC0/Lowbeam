/**
 * Roadblocks and spike strips, in the line of Most Wanted (2005). Pure, no three.js: the sim and
 * the drive loop place the units and lay the spikes, the renderer draws the cars and the strip,
 * and the maps show them as markers. A roadblock is two or three units parked across the road a
 * few hundred meters ahead with a gap to aim for; a spike strip is a line across that gap (or a
 * lane) that flattens the tires.
 */

import { clamp } from '../core/mathx.js';

/** @typedef {{ lane: any, s: number, x: number, z: number, y: number, tx: number, tz: number }} Spot */

/** A roadblock goes in this far to `far` meters ahead of the player, along their lane. */
const NEAR = 250;
const FAR = 400;
/** How many units across a roadblock (the road is split into this many slots plus the gap). */
const ACROSS = [2, 3];
/** A roadblock is set up only while the player cannot see it. */
const SETUP_RANGE = 150;
/** A spike strip this close to the player, flattened tires. */
const STRIP_HIT = 2.5;
/** How long the tires stay flat, and the grip and top-speed penalty while they are. */
const FLAT_TIME = 22;
const FLAT_GRIP = 0.62;
const FLAT_TOP = 0.72;

/**
 * Where a roadblock should stand: on the player's lane a few hundred meters ahead, the units
 * spread across its width with a gap to aim for. Returns the lane, the arc length and one spot
 * per unit, or null when there is no clear stretch of road to block.
 * @param {{ lane: any, s: number, sample: (lane: any, s: number, out: any) => any }} ctx the player's
 *   current lane and arc length, and the net's sample
 * @param {number} heat the roadblock appears at heat 4 and up
 */
export function planRoadblock(ctx, heat) {
  if (heat < 4) return null;
  const { lane, s, sample } = ctx;
  if (!lane) return null;
  const ahead = s + NEAR + Math.random() * (FAR - NEAR);
  if (ahead >= lane.length) return null;
  const q = sample(lane, ahead, {});
  if (!q || q.tx === undefined) return null;
  const count = ACROSS[Math.floor(Math.random() * ACROSS.length)];
  // The units spread across the road, one slot left open as the gap to thread. The gap slot is
  // at one end (left or right), chosen per roadblock.
  const halfW = lane.road.hw;
  const slots = count + 1;
  const step = (halfW * 2) / slots;
  // The gap is slot 0 (left end) or the last slot (right end).
  const gapAtLeft = Math.random() < 0.5;
  const units = [];
  for (let i = 0; i < slots; i++) {
    if (gapAtLeft ? i === 0 : i === slots - 1) continue;
    const lateral = -halfW + (i + 0.5) * step;
    units.push({
      x: q.x - q.tz * lateral,
      z: q.z + q.tx * lateral,
      y: q.y,
      yaw: Math.atan2(q.tx, q.tz),
      index: units.length,
    });
  }
  const gap = { side: gapAtLeft ? -1 : 1, half: step / 2 };
  return { lane, s: ahead, x: q.x, z: q.z, y: q.y, units, gap, tx: q.tx, tz: q.tz };
}

/**
 * Whether a roadblock should be laid right now: at heat 4 and up, one is not already standing,
 * and the player is too far off to see it being set up.
 * @param {{ x: number, z: number }} player @param {{ x: number, z: number } | null} existing
 * @param {number} heat @param {number} minGap seconds since the last one
 */
export function shouldSetRoadblock(player, existing, heat, minGap) {
  if (heat < 4) return false;
  if (existing) return false;
  if (minGap > 0) return false;
  return true;
}

/** Whether the player is too close to a standing roadblock to place another. @param {any} block @param {{x:number,z:number}} player */
export function tooNearBlock(block, player) {
  if (!block) return true;
  return Math.hypot(block.x - player.x, block.z - player.z) < SETUP_RANGE;
}

/**
 * Lays a spike strip across a roadblock's gap (or a lane ahead). Returns the strip's line, so
 * the renderer can draw it and the tests can reason about it.
 * @param {any} block the roadblock (its `gap`) or `{ lane, s, sample }` for a plain lane strip
 * @param {number} heat heat 4 and up get a strip across the gap
 */
export function planSpikes(block, heat) {
  if (!block) return null;
  if (heat < 4) return null;
  const halfW = block.lane ? block.lane.road.hw : 5;
  const lateral = (block.gap ? block.gap.side : 1) * (halfW - block.gap ? block.gap.half : 1.7);
  const nx = -block.tz;
  const nz = block.tx;
  const len = (block.gap ? block.gap.half : 1.7) * 2;
  return {
    x: block.x + nx * lateral,
    z: block.z + nz * lateral,
    y: block.y,
    nx, nz, len,
    yaw: Math.atan2(nx, nz),
  };
}

/** Whether the car has just run over a strip. @param {any} strip @param {{x:number,z:number}} s */
export function hitSpikes(strip, s) {
  if (!strip) return false;
  return Math.hypot(strip.x - s.x, strip.z - s.z) < STRIP_HIT + 1.6;
}

/**
 * The spike effect on the car: how much grip and top speed are lost while the tires are flat,
 * and how long is left. Mend is by escaping or at a pump.
 * @param {number} time seconds the tires have been flat
 */
export function spikePenalty(time) {
  const left = Math.max(0, FLAT_TIME - time);
  if (time >= FLAT_TIME) return { grip: 1, top: 1, left: 0, active: false };
  const flat = clamp(time / 6, 0, 1);
  return { grip: 1 - (1 - FLAT_GRIP) * flat, top: 1 - (1 - FLAT_TOP) * flat, left, active: true };
}