/**
 * Heat: what the police notice, and how hard they come. Pure, no three.js, so a test can step it
 * and the drive loop only has to feed it what happened this frame.
 *
 * Four things draw a patrol's eye, each worth a different amount of heat: speeding past one, a
 * toll speed trap taken fast, hitting a police car, and a duel where a unit can see it. Heat is
 * 1 to 5: it rises with what they see and with every second spent in a pursuit, and it cools
 * slowly once nothing has been going on for a while. A patrol only reacts when it can see the
 * player, so the caller decides who saw what and reports it here.
 */

import { clamp } from '../core/mathx.js';

/** @typedef {{ x: number, z: number, speed?: number, limit?: number }} Seer */
/** @typedef {{ events?: string[], pursuit?: boolean }} HeatEvents */

export const HEAT_MIN = 1;
export const HEAT_MAX = 5;

/** A patrol notices a speeder within this many meters. */
const NOTICE_RANGE = 60;
/** How far over the limit (km/h) the player has to be before a patrol cares. */
const NOTICE_OVER = 40;
/** A toll speed trap above this speed in km/h is a crime in itself. */
const TRAP_SPEED = 160;
/** Heat a single notice is worth, and the seconds it takes to notice it. */
const NOTICE_HEAT = 0.5;
const NOTICE_TIME = 2;
/** Heat per second while a pursuit is running: a full five takes about a minute of running. */
const PURSUIT_HEAT = 0.08;
/** Heat lost per second once nothing has been noticed for COOL_TIME. */
const COOL_HEAT = 0.05;
const COOL_TIME = 12;

/**
 * Whether a patrol at `cop` has noticed the player speeding past. Over the limit by more than
 * `NOTICE_OVER` km/h and within `NOTICE_RANGE` m.
 * @param {{ x: number, z: number, speed: number }} player speed in m/s
 * @param {Seer} cop
 * @param {number} [limit] the road's limit in km/h
 */
export function noticesSpeeding(player, cop, limit = 100) {
  const over = player.speed * 3.6 - limit;
  if (over < NOTICE_OVER) return false;
  return Math.hypot(player.x - cop.x, player.z - cop.z) < NOTICE_RANGE;
}

/** Whether a toll speed trap caught the player going too fast. @param {number} speedKmh */
export function noticesTrap(speedKmh) {
  return speedKmh > TRAP_SPEED;
}

/**
 * The police's attention to the player. Heat starts at 0 (nobody is looking), and the first
 * notice takes it to 1: the police only exist to the player once they have heat.
 */
export class Heat {
  constructor() {
    /** 0 (unnoticed) to HEAT_MAX. */
    this.value = 0;
    /** Seconds since anything was noticed, for the cool-down. */
    this.calm = COOL_TIME;
    /** Seconds the pursuit has been running, which is what the HUD shows as the clock. */
    this.pursuitTime = 0;
  }

  /**
   * Steps the heat by one frame.
   * @param {number} dt seconds
   * @param {HeatEvents} [events] what happened this frame: `speeding`, `trap`, `hitPolice`,
   *   `hitCivilian` and `duel` are each one notice; `pursuit` says a pursuit is running.
   */
  update(dt, events) {
    const e = events || {};
    let noticed = false;
    for (const key of ['speeding', 'trap', 'hitPolice', 'hitCivilian', 'duel']) {
      if (e[key]) noticed = true;
    }
    if (noticed) {
      // A notice is worth a fixed amount of heat, but it takes a couple of seconds of being
      // noticed to add it, so a car streaking past does not jump a whole level at once.
      this.value += (NOTICE_HEAT * dt) / NOTICE_TIME;
      this.calm = 0;
    } else {
      this.calm += dt;
    }
    if (e.pursuit) {
      this.pursuitTime += dt;
      this.value += PURSUIT_HEAT * dt;
    }
    if (!noticed && this.calm > COOL_TIME) this.value -= COOL_HEAT * dt;
    this.value = clamp(this.value, 0, HEAT_MAX);
    return this.value;
  }

  /** The heat as the HUD wants it: a whole level from 1 to 5, or 0 while nobody is looking. */
  get level() {
    if (this.value <= 0) return 0;
    return clamp(Math.ceil(this.value), HEAT_MIN, HEAT_MAX);
  }

  /** True once a patrol knows about the player. */
  get noticed() {
    return this.value > 0;
  }
}