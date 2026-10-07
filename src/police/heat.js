/**
 * Heat: what the police notice, and how hard they come. Pure, no three.js, so a test can step it
 * and the director only has to feed it what happened this frame.
 *
 * Two numbers, as in Need for Speed: Most Wanted (2005). `attention` (0 to 1) is a patrol making up
 * its mind, the detection bar: it fills while a unit watches the player speed or race, jumps on a
 * speed trap, fills at once on a ram or a near miss, drains soon after no unit can see the player
 * (but not below what the speed cameras put on it), and a pursuit starts when it is full. `value` is the heat itself, 0 (nobody is looking for you) or 1 to
 * 5.99: a pursuit starts at level 1 or at the level the last one left, climbs a level for every
 * HEAT_STEP seconds of pursuit and a little per infraction, and after an escape it stays for the
 * session, cooling a level for every HEAT_COOL seconds of quiet. A bust wipes it.
 */

import { clamp } from '../core/mathx.js';

/** @typedef {{ x: number, z: number, speed?: number, limit?: number }} Seer */
/**
 * @typedef {{
 *   speeding?: boolean, duel?: boolean, trap?: boolean, hitPolice?: boolean, hitCivilian?: boolean,
 *   pursuit?: boolean, infractions?: number, seen?: boolean, provoke?: boolean
 * }} HeatEvents
 */

export const HEAT_MIN = 1;
export const HEAT_MAX = 5;

/** A patrol notices a speeder within this many meters. */
const NOTICE_RANGE = 60;
/** How far over the limit (km/h) the player has to be before a patrol cares. */
const NOTICE_OVER = 40;
/** A toll speed trap above this speed in km/h is a crime in itself. */
const TRAP_SPEED = 160;
/** Seconds a unit has to watch the player speeding or racing before it lights up. */
export const NOTICE_TIME = 1.5;
/** What one speed trap is worth: two in a row start a pursuit, one alone is forgotten. */
const TRAP_ATTENTION = 0.6;
/** Seconds of nothing before attention fades, and how fast it fades then (per second). */
export const CALM_TIME = 12;
const CALM_FADE = 0.1;
/** Seconds out of every unit's sight before the detection bar drains, and how fast it drains then. */
export const UNSEEN_GRACE = 1.5;
const UNSEEN_DRAIN = 0.4;
/** Seconds of pursuit per heat level, and the heat each new infraction adds. */
export const HEAT_STEP = 90;
const INFRACTION_HEAT = 0.12;
/** Seconds of quiet, out of a pursuit, that cool the heat by one level. */
export const HEAT_COOL = 120;

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

/** The police's attention to the player, and the heat once they are after them. */
export class Heat {
  constructor() {
    /** 0, or 1 to just under 6 while the police know the player: the level is its floor. */
    this.value = 0;
    /** 0 to 1: a patrol making up its mind; a pursuit starts when it fills. */
    this.attention = 0;
    /** Seconds since anything was noticed. */
    this.calm = CALM_TIME;
    /** Seconds of pursuit since the heat was last wiped. */
    this.pursuitTime = 0;
    /** Seconds since a unit last saw the player. */
    this.unseen = 0;
    /** What the speed cameras put on the attention: out of sight it drains to this, not below. */
    this.trapHold = 0;
  }

  /**
   * Steps the heat by one frame. Returns true on the frame the attention fills, which is when
   * the caller should start a pursuit (it calls `startPursuit`).
   * @param {number} dt seconds
   * @param {HeatEvents} [events] `speeding` and `duel` are watched (they fill the attention over
   *   NOTICE_TIME while they last); `trap` is one camera flash; `hitPolice` and `provoke` (a near
   *   miss) start a pursuit at once; `seen` says a unit can see the player (left out, the bar does
   *   not drain for want of it); `pursuit` says one is running; `infractions` is how many new ones
   *   this frame.
   */
  update(dt, events) {
    const e = events || {};
    const watched = !!(e.speeding || e.duel || e.hitCivilian);
    const before = this.attention;
    if (watched) this.attention += dt / NOTICE_TIME;
    if (e.trap) {
      this.attention += TRAP_ATTENTION;
      this.trapHold = Math.min(1, this.trapHold + TRAP_ATTENTION);
    }
    if (e.hitPolice || e.provoke) this.attention = 1;
    this.unseen = e.seen === false && !watched ? this.unseen + dt : 0;
    if (!e.pursuit && this.unseen > UNSEEN_GRACE && this.attention > this.trapHold) {
      this.attention = Math.max(this.trapHold, this.attention - UNSEEN_DRAIN * dt);
    }
    const noticed = watched || !!e.trap || !!e.hitPolice || !!e.provoke || !!e.pursuit;
    this.calm = noticed ? 0 : this.calm + dt;
    if (e.pursuit) {
      this.pursuitTime += dt;
      this.value += dt / HEAT_STEP + (e.infractions || 0) * INFRACTION_HEAT;
      this.attention = 0;
    } else {
      if (this.calm > CALM_TIME) {
        this.attention -= CALM_FADE * dt;
        this.trapHold = Math.max(0, this.trapHold - CALM_FADE * dt);
      }
      if (this.value > 0 && this.calm > CALM_TIME) {
        this.value -= dt / HEAT_COOL;
        if (this.value < HEAT_MIN) this.value = 0;
      }
    }
    this.attention = clamp(this.attention, 0, 1);
    this.value = clamp(this.value, 0, HEAT_MAX + 0.99);
    return !e.pursuit && before < 1 && this.attention >= 1;
  }

  /** A pursuit begins: at level 1, or at the level the police still hold against the player. */
  startPursuit() {
    this.value = Math.max(this.value, HEAT_MIN);
    this.attention = 0;
    this.trapHold = 0;
    this.calm = 0;
  }

  /** Busted: the slate is wiped. */
  wipe() {
    this.value = 0;
    this.attention = 0;
    this.pursuitTime = 0;
  }

  /** The heat as the HUD wants it: a whole level from 1 to 5, or 0 while nobody is looking. */
  get level() {
    if (this.value < HEAT_MIN) return 0;
    return clamp(Math.floor(this.value), HEAT_MIN, HEAT_MAX);
  }

  /** True once a patrol has the player in mind or the heat is up. */
  get noticed() {
    return this.attention > 0 || this.value > 0;
  }
}
