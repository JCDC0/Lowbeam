/**
 * The pursuit: the police chase, the player loses them or gets caught, in the line of
 * Need for Speed: Most Wanted (2005). Pure, no three.js, no DOM, no audio. The caller feeds it
 * what it can see each step (is anyone looking, how many units, the player's speed) and plays
 * the events it returns, so the sirens, the radio and the HUD stay in their own layers.
 *
 * The states are the A13 `PursuitView` ones the HUD already draws: `pursuit` while they have
 * eyes on you, `evading` once you are out of sight and the evade bar is filling, `cooldown` once
 * they have lost you and are searching, then `busted` or `escaped`.
 */

import { RaceEvent } from './event.js';
import { clamp } from '../core/mathx.js';

/** How fast the evade bar fills per second at each heat: quicker the less they know about you. */
const EVADE_BASE = 0.025;
/** How fast the evade bar empties while a unit still has eyes on you. */
const EVADE_DRAIN = 0.35;
/** Seconds the cooldown takes to fill once they have lost you (before hiding makes it faster). */
const COOLDOWN_TIME = 12;
/** Hiding (a hideout, a deck, a closed lot) fills the cooldown this much faster. */
const HIDE_FACTOR = 3;
/** Below this speed, in m/s (about 10 km/h), a unit alongside can put the cuffs on. */
const BUST_SPEED = 2.78;
/** Seconds the bust bar takes to fill when they are on top of you. */
const BUST_TIME = 3;
/** How fast the bust bar empties once you pull away. */
const BUST_DRAIN = 0.5;
/** Bounty per second at heat 1, and the extra per heat level. */
const BOUNTY_BASE = 12;
const BOUNTY_HEAT = 8;
/** What each infraction is worth, in yen. */
const INFRACTION_BOUNTY = {
  speeding: 800,
  reckless: 1200,
  hitAndRun: 2500,
  ram: 1500,
  resist: 3000,
  offroad: 600,
  property: 900,
  tollRun: 2000,
};
/** Bounty added for each unit you take out of the pursuit. */
const UNIT_BOUNTY = 1200;

/** The infractions the caller can report, in the order Most Wanted lists them. */
export const INFRACTIONS = Object.keys(INFRACTION_BOUNTY);

/**
 * @typedef {import('./event.js').RaceEventMsg} RaceEventOut
 * @typedef {{
 *   speed?: number, seen?: boolean, units?: number, heli?: boolean, hiding?: boolean,
 *   wrecked?: boolean, damage?: number, events?: string[]
 * }} PursuitWorld
 */

/** The pursuit, from the first pair of eyes to the fine or the payout. */
export class Pursuit extends RaceEvent {
  constructor() {
    super('pursuit', 'pursuit', ['you', 'police']);
    /** @type {'pursuit' | 'evading' | 'cooldown' | 'busted' | 'escaped'} */
    this.pstate = 'pursuit';
    this.heat = 0;
    /** 0..1: fills while out of sight toward escape, drains while they can see you. */
    this.evade = 0;
    /** 0..1: fills once evaded, toward ESCAPED. */
    this.cooldown = 0;
    /** 0..1: rises while they are on top of you and you are slow. */
    this.bust = 0;
    this.units = 0;
    this.heli = false;
    this.bounty = 0;
    /** Yen of damage to police cars and property so far. */
    this.cost = 0;
    this.disabled = 0;
    this.involved = 0;
    /** @type {string[]} */
    this.infractions = [];
    /** @type {Set<string>} */
    this.seenOnce = new Set();
    this.hiding = false;
    /** @type {any} */
    this.report = null;
    /** The last known position of the player, widened as the search goes on. */
    this.last = { x: 0, z: 0, r: 40 };
    /** @type {{ x: number, z: number } | null} */
    this._lastAt = null;
  }

  /** @param {number} heat 1 to 5 @param {boolean} [heli] */
  setHeat(heat, heli = false) {
    this.heat = clamp(heat, 0, 5);
    this.heli = heli;
  }

  /** Records where they last saw the player and how wide their search has grown. */
  lastSeen(x, z) {
    this._lastAt = { x, z };
    this.last.x = x;
    this.last.z = z;
  }

  /**
   * One step. `world.seen` says whether a unit or the helicopter currently has eyes on the
   * player; everything else is reported state. Returns the events the caller should play.
   * @param {number} dt @param {PursuitWorld} [world]
   * @returns {RaceEventOut[]}
   */
  update(dt, world = {}) {
    this.time += dt;
    if (this.pstate === 'busted' || this.pstate === 'escaped') return [];
    const seen = !!world.seen;
    const speed = world.speed ?? 0;
    this.units = world.units ?? this.units;
    this.heli = !!world.heli || this.heli;
    this.hiding = !!world.hiding;

    const out = /** @type {RaceEventOut[]} */ [];
    if (world.damage) {
      this.cost += world.damage;
      this.bounty += world.damage;
    }
    if (world.wrecked) this.add('hitAndRun', out);

    // Bounty rises with time and how hard they are trying, the way Most Wanted counts it up.
    this.bounty += (BOUNTY_BASE + BOUNTY_HEAT * this.heat) * dt;

    // Each infraction only counts once per pursuit, and only the first time fires the event.
    for (const e of world.events || []) this.add(e, out);

    // The bust: they are on top of you and you have stopped.
    const boxed = speed < BUST_SPEED && (seen || this.units > 1);
    if (boxed && seen) this.bust = clamp(this.bust + dt / BUST_TIME, 0, 1);
    else this.bust = clamp(this.bust - BUST_DRAIN * dt, 0, 1);
    if (this.bust >= 1) return this.end('busted', out);

    // Losing them: the evade bar fills while out of sight, drains while they watch.
    if (this.pstate === 'pursuit') {
      if (seen) {
        this.evade = clamp(this.evade - EVADE_DRAIN * dt, 0, 1);
      } else {
        this.pstate = 'evading';
      }
    }
    if (this.pstate === 'evading') {
      if (seen) {
        // Back in sight: the bar drains and the pursuit is on again.
        this.evade = clamp(this.evade - EVADE_DRAIN * dt, 0, 1);
        if (this.evade <= 0) this.pstate = 'pursuit';
      } else {
        const rate = EVADE_BASE * (6 - this.heat);
        this.evade = clamp(this.evade + rate * dt, 0, 1);
        if (this.evade >= 1) {
          this.pstate = 'cooldown';
          this.cooldown = 0;
          out.push({ type: 'cooldown' });
        }
      }
    }
    // Cooldown: they search the last known position, widening, until it is full and they quit.
    if (this.pstate === 'cooldown') {
      if (seen) {
        this.pstate = 'pursuit';
        this.evade = 0;
        this.cooldown = 0;
      } else {
        const rate = (1 / COOLDOWN_TIME) * (this.hiding ? HIDE_FACTOR : 1);
        this.cooldown = clamp(this.cooldown + rate * dt, 0, 1);
        this.last.r = 40 + this.cooldown * 160;
        if (this.cooldown >= 1) return this.end('escaped', out);
      }
    }

    // Resisting arrest: a long unbroken pursuit is its own infraction.
    if (this.pstate === 'pursuit' && this.time >= 30) this.add('resist', out);
    return out;
  }

  /** Records an infraction the first time it happens this pursuit. */
  /** @param {string} name @param {RaceEventOut[]} out */
  add(name, out) {
    if (!INFRACTION_BOUNTY[name] || this.seenOnce.has(name)) return;
    this.seenOnce.add(name);
    this.infractions.push(name);
    this.bounty += INFRACTION_BOUNTY[name];
    out.push({ type: 'infraction', name, bounty: INFRACTION_BOUNTY[name] });
  }

  /** A unit was disabled this pursuit. */
  disable() {
    this.disabled++;
    this.bounty += UNIT_BOUNTY;
    return this.bounty;
  }

  /** A unit joined the pursuit. */
  involve() {
    this.involved++;
  }

  /**
   * @param {'busted' | 'escaped'} how @param {RaceEventOut[]} out
   * @returns {RaceEventOut[]}
   */
  end(how, out) {
    this.pstate = how;
    this.state = how === 'busted' ? 'lost' : 'won';
    const fine = how === 'busted' ? Math.round(this.bounty + 30000) : 0;
    this.report = {
      result: how,
      time: this.time,
      heat: this.heat,
      bounty: Math.round(this.bounty),
      fine,
      infractions: this.infractions,
      involved: this.involved,
      disabled: this.disabled,
      cost: Math.round(this.cost),
      roadblocks: 0,
      spikes: 0,
    };
    out.push({ type: how, bounty: this.report.bounty, fine, report: this.report });
    return out;
  }

  /** @returns {any} the report once the pursuit has ended, else null. */
  result() {
    return this.report;
  }

  /** The A13 `PursuitView`, exactly the fields the HUD and markers already read. */
  view() {
    if (this.pstate === 'busted' || this.pstate === 'escaped') return this.reportView();
    if (this.units === 0 && !this.heli) return null;
    return {
      state: this.pstate,
      heat: this.heat,
      evade: this.evade,
      cooldown: this.cooldown,
      bust: this.bust,
      units: this.units,
      heli: this.heli,
      bounty: Math.round(this.bounty),
      time: this.time,
      infractions: this.infractions,
      cost: Math.round(this.cost),
      disabled: this.disabled,
      involved: this.involved,
      hiding: this.hiding,
      chatter: null,
      report: null,
    };
  }

  /** The same view, but keeping the fields so the HUD can show the end card. */
  reportView() {
    const r = this.report || { result: this.pstate, time: this.time, heat: this.heat, bounty: 0, fine: 0, infractions: this.infractions, involved: this.involved, disabled: this.disabled, cost: this.cost, roadblocks: 0, spikes: 0 };
    return {
      state: this.pstate,
      heat: this.heat,
      evade: 1,
      cooldown: this.pstate === 'escaped' ? 1 : this.cooldown,
      bust: this.pstate === 'busted' ? 1 : this.bust,
      units: this.units,
      heli: this.heli,
      bounty: r.bounty,
      time: r.time,
      infractions: r.infractions,
      cost: r.cost,
      disabled: r.disabled,
      involved: r.involved,
      hiding: this.hiding,
      chatter: null,
      report: r,
    };
  }
}