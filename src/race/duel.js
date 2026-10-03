/**
 * A one-on-one duel with a street racer, Tokyo Xtreme Racer style. Pure: no three.js,
 * no DOM and no audio. The caller feeds it the gap each step and plays the events it
 * returns, so the countdown beeps and the go tone stay in the audio layer.
 */

import { RaceEvent } from './event.js';
import { clamp } from '../core/mathx.js';

/** Seconds of countdown before the gauge starts moving. */
export const COUNTDOWN = 3;
/** Under this gap the trailing driver loses nothing. */
export const GAUGE_FREE = 10;
/** At this gap and beyond the loss rate is at its worst. */
export const GAUGE_FAST = 150;
/** Gauge a single wall or traffic hit costs the driver who caused it. */
export const HIT_DRAIN = 0.06;
/** Gauge per second lost at the worst gap. */
export const DRAIN_MAX = 0.22;
/** Gauge per second the leader gets back. */
export const RECOVER = 0.02;
/** A gap this big decides the race on the spot. */
export const WIN_GAP = 500;
/** Roads a duel may be started on. */
export const DUEL_ROADS = ['c1-f', 'c2-f'];
/** How far ahead a rival may be and still be challenged. */
export const CHALLENGE_RANGE = 60;

/**
 * What a win pays: `4000 + 6000 * speedFactor`, rounded to the nearest 500.
 * @param {number} speedFactor
 */
export function duelPrize(speedFactor) {
  return Math.round((4000 + 6000 * speedFactor) / 500) * 500;
}

/**
 * Whether a rival can be challenged: ahead, within `CHALLENGE_RANGE`, on one of the two
 * expressways. A rival behind cannot be, because a duel starts from behind its dust.
 * @param {{ distance: number, ahead: boolean, road: string } | null | undefined} target
 */
export function canChallenge(target) {
  if (!target) return false;
  if (!target.ahead || target.distance > CHALLENGE_RANGE) return false;
  return DUEL_ROADS.includes(target.road);
}

/** @typedef {import('./event.js').RaceEventMsg} RaceEventOut @typedef {import('./event.js').RaceWorld} RaceWorld @typedef {import('./event.js').RaceResult} RaceResult */

/** A duel against one street racer. */
export class Duel extends RaceEvent {
  /**
   * @param {{ id: string, name: string, speedFactor: number }} rival
   */
  constructor(rival) {
    super(`duel-${rival.id}`, 'duel', ['you', rival.id]);
    this.rival = rival;
    /** Each driver's gauge, 1 at the start, 0 loses. */
    this.gauge = { player: 1, rival: 1 };
    this.gap = 0;
    /** The countdown step last announced, so each one beeps once. */
    this.lastCount = COUNTDOWN + 1;
    /** @type {RaceResult | null} */
    this.outcome = null;
  }

  /**
   * @param {number} dt @param {RaceWorld} world
   * @returns {import('./event.js').RaceEventMsg[]}
   */
  update(dt, world) {
    this.time += dt;
    if (this.state === 'won' || this.state === 'lost' || this.state === 'aborted') return [];

    if (this.state === 'countdown') {
      const step = Math.min(Math.ceil(COUNTDOWN - this.time), COUNTDOWN);
      if (this.time >= COUNTDOWN) {
        this.state = 'running';
        return [{ type: 'go' }];
      }
      if (step < this.lastCount) {
        this.lastCount = step;
        return [{ type: 'count', n: step }];
      }
      return [];
    }

    this.gap = world.gap || 0;
    const trailing = this.gap > 0 ? 'player' : 'rival';
    const leader = this.gap > 0 ? 'rival' : 'player';
    const gap = Math.abs(this.gap);

    if (gap > WIN_GAP) return this.end(leader === 'player', 'blown');

    // The drain curve: nothing close in, worst from 150 m out.
    const t = clamp((gap - GAUGE_FREE) / (GAUGE_FAST - GAUGE_FREE), 0, 1);
    this.gauge[trailing] = Math.max(0, this.gauge[trailing] - DRAIN_MAX * t * dt);
    this.gauge[leader] = Math.min(1, this.gauge[leader] + RECOVER * dt);

    const hits = world.hits;
    if (hits) {
      if (hits.player) this.gauge.player = Math.max(0, this.gauge.player - HIT_DRAIN * hits.player);
      if (hits.rival) this.gauge.rival = Math.max(0, this.gauge.rival - HIT_DRAIN * hits.rival);
    }

    if (this.gauge.player <= 0) return this.end(false, 'drained');
    if (this.gauge.rival <= 0) return this.end(true, 'drained');
    return [];
  }

  /**
   * @param {boolean} won @param {string} reason
   * @returns {import('./event.js').RaceEventMsg[]}
   */
  end(won, reason) {
    this.state = won ? 'won' : 'lost';
    this.outcome = {
      won,
      prize: won ? duelPrize(this.rival.speedFactor) : 0,
      rival: this.rival.id,
      reason,
    };
    return [{ type: 'end', won, prize: this.outcome.prize }];
  }

  /** @returns {RaceResult | null} */
  result() {
    return this.outcome;
  }
}