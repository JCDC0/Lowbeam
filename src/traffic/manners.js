/**
 * How the civilians answer the player's driving: they honk, and in a pursuit they panic. Pure;
 * the sim calls `Manners.update` every step and the Drive hands the sounds to the audio.
 *
 * Horns, after what makes a Japanese driver lean on one:
 * - `undertake`: the player passes them on their left. Traffic keeps left, so overtaking is on
 *   the right; coming past on the left is the wrong side.
 * - `cut`: the player swings across in front of them close enough to make them brake.
 * - `red`: the player crosses in front of them while they wait at rest (at a red light, or in a
 *   queue), fast and across their road.
 * - `scrape`: the player hits them and they are knocked aside.
 * Each car honks at most once every `HORN_GAP` seconds, and the street at most once every
 * `HORN_EVERY`, so a crowd does not drown the engine.
 *
 * Panic: while the police chase the player (`heat` above zero), a civilian within `PANIC.range`
 * of the player, or of a unit in the chase, brakes hard to a crawl, edges toward the curb (its
 * left), maybe honks, and screeches its tires if it was moving fast.
 */

import { makeRng } from '../core/rng.js';

/** Seconds between two honks of one car, and between any two honks at all. */
export const HORN_GAP = 3;
export const HORN_EVERY = 0.3;
/** Only cars this close notice the player's manners, meters. */
export const MANNERS_RANGE = 32;
/** The pursuit panic: range around the player or a chasing unit, the crawl, the shy to the curb (m), how long, how often, and the chance of a honk. */
export const PANIC = { range: 45, crawl: 2, shy: 1.4, time: 3.5, every: 7, honk: 0.5, screech: 9 };

/**
 * @typedef {'undertake' | 'cut' | 'red' | 'scrape' | 'panic'} HornReason
 * @typedef {{ id: number, kind: string, x: number, z: number, reason: HornReason, blast: 'short' | 'long' | 'double' }} Horn
 * @typedef {{ id: number, kind: string, x: number, z: number, speed: number }} Screech
 * @typedef {{
 *   id: number, kind: { id: string, lightBar?: boolean }, x: number, z: number, yaw: number, speed: number,
 *   mode: string, pursuit?: any, quarry?: any, cap: number, capUntil: number, shy?: number, shyUntil?: number
 * }} MannerAgent
 * @typedef {{ x: number, z: number, yaw: number, vx: number, vz: number, speed: number }} MannerPlayer
 */

/** The blast each reason gets: a quick tap, a long lean, or two taps. @type {Record<HornReason, 'short' | 'long' | 'double'>} */
const BLAST = { undertake: 'long', cut: 'long', red: 'long', scrape: 'double', panic: 'short' };

export class Manners {
  /** @param {number} [seed] */
  constructor(seed = 91) {
    this.rng = makeRng(seed);
    /** What each car saw last step, by id. @type {Map<number, { lon: number, lat: number, mode: string, hornAt: number, panicAt: number }>} */
    this.memory = new Map();
    this.lastHorn = -Infinity;
    /** @type {Horn[]} */
    this.horns = [];
    /** @type {Screech[]} */
    this.screeches = [];
  }

  /** The sounds since the last call. */
  take() {
    const out = { horns: this.horns, screeches: this.screeches };
    this.horns = [];
    this.screeches = [];
    return out;
  }

  /**
   * @param {number} time the sim's clock @param {MannerAgent[]} agents @param {MannerPlayer} player
   * @param {number} heat the pursuit's heat, 0 when none
   */
  update(time, agents, player, heat) {
    const seen = new Set();
    const chasers = heat > 0 ? agents.filter((a) => a.pursuit && a.mode !== 'wreck') : [];
    const pfx = Math.sin(player.yaw);
    const pfz = Math.cos(player.yaw);
    for (const a of agents) {
      if (a.kind.lightBar || a.pursuit || a.quarry) continue;
      const dx = player.x - a.x;
      const dz = player.z - a.z;
      const far = Math.hypot(dx, dz);
      let byChase = false;
      for (const u of chasers) if (!byChase && Math.hypot(u.x - a.x, u.z - a.z) < PANIC.range * 0.8) byChase = true;
      if (far > Math.max(MANNERS_RANGE, PANIC.range) + 20 && !byChase) {
        this.memory.delete(a.id);
        continue;
      }
      seen.add(a.id);
      const fx = Math.sin(a.yaw);
      const fz = Math.cos(a.yaw);
      // In the car's own frame: how far ahead of it the player is, and how far to its left.
      const lon = dx * fx + dz * fz;
      const lat = dx * fz - dz * fx;
      let m = this.memory.get(a.id);
      if (!m) {
        this.memory.set(a.id, { lon, lat, mode: a.mode, hornAt: -Infinity, panicAt: -Infinity });
        continue;
      }
      /** @type {HornReason | null} */
      let reason = null;
      if (a.mode === 'knocked' && m.mode === 'drive') reason = 'scrape';
      else if (a.mode === 'drive' && far < MANNERS_RANGE) {
        const along = player.vx * fx + player.vz * fz;
        const across = Math.abs(pfx * fx + pfz * fz);
        if (m.lon < 0 && lon >= 0 && lat > 1.2 && lat < 6 && along > a.speed + 2) reason = 'undertake';
        else if (a.speed > 5 && lon > 2 && lon < 16 && Math.abs(lat) < 1.5 && Math.abs(m.lat) >= 2 && m.lon > 0) {
          reason = 'cut';
          a.cap = Math.max(0, a.speed * 0.6);
          a.capUntil = time + 1.5;
        } else if (a.speed < 1.5 && player.speed > 8 && across < 0.6 && lon > 1 && lon < 25 && Math.sign(lat) !== Math.sign(m.lat) && Math.abs(m.lat) < 14) reason = 'red';
      }
      if (heat > 0 && a.mode === 'drive' && time - m.panicAt > PANIC.every) {
        if (far < PANIC.range || byChase) {
          m.panicAt = time;
          a.cap = PANIC.crawl;
          a.capUntil = time + PANIC.time;
          a.shy = PANIC.shy;
          a.shyUntil = time + PANIC.time + 1.5;
          if (a.speed > PANIC.screech) this.screeches.push({ id: a.id, kind: a.kind.id, x: a.x, z: a.z, speed: a.speed });
          if (!reason && this.rng.next() < PANIC.honk) reason = 'panic';
        }
      }
      if (reason && time - m.hornAt > HORN_GAP && time - this.lastHorn > HORN_EVERY) {
        m.hornAt = time;
        this.lastHorn = time;
        this.horns.push({ id: a.id, kind: a.kind.id, x: a.x, z: a.z, reason, blast: BLAST[reason] });
      }
      m.lon = lon;
      m.lat = lat;
      m.mode = a.mode;
    }
    for (const id of [...this.memory.keys()]) if (!seen.has(id)) this.memory.delete(id);
  }
}
