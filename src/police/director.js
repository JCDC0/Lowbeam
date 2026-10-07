/**
 * The police director: one pure object that runs the police from the first glance to the end of a
 * pursuit, in the line of Need for Speed: Most Wanted (2005). No three.js, no DOM: each frame the
 * Drive tells it what is true (where the player is, where every unit is and whether it has a clear
 * line to the player, what happened) and carries out what it returns (spawn these units, chase or
 * search or patrol, the helicopter up or home, a roadblock to park, flat tires, money, the view
 * for the HUD). A whole chase can therefore be played in a test with a fake world.
 *
 * The life of a pursuit: none, then `pursuit` (a unit saw enough), `evading` and `cooldown` as the
 * player gets away, `busted` or `escaped`, then the report for REPORT_TIME, then none again, with
 * the heat kept after an escape and wiped after a bust.
 */

import { Heat, noticesSpeeding, noticesTrap } from './heat.js';
import { roster, UNIT_BY_ID } from './units.js';
import { planSpikes, shouldSetRoadblock, tooNearBlock, hitSpikes, spikePenalty } from './roadblock.js';
import { Pursuit } from '../race/pursuit.js';

/** A unit with a clear line sees the player this far while chasing, meters. */
export const SIGHT_RANGE = 150;
/** A patrol notices the player this far all round (mirrors and windows). */
export const PATROL_RANGE = 60;
/** Searching (cooldown), a unit sees this far ahead in its cone, and this far all round. */
export const CONE_RANGE = 60;
export const CONE_HALF = 0.61;
export const AROUND_RANGE = 25;
/** A unit this close to a stopped player is on top of them: the bust bar fills. */
export const BUST_RANGE = 12;
/** Seconds the end card stays before the police go back to patrol. */
export const REPORT_TIME = 6;
/** Seconds between two units joining the pursuit: backup arrives one car at a time. */
const BACKUP_EVERY = 1.5;
/** Seconds after a roadblock before the next one, and how long one may stand. */
const BLOCK_EVERY = 35;
const BLOCK_LIFE = 90;
/** The player within this far of a roadblock is at it; past it and this far away, it is behind. */
const BLOCK_AT = 35;
const BLOCK_PAST = 45;
/** A roadblock the player is this far from has been left behind for good. */
const BLOCK_GONE = 600;

/**
 * @typedef {{ id: number, x: number, z: number, yaw: number, d: number, clear: boolean, kind?: string }} UnitSight
 *   every live unit: its distance to the player and whether nothing stands between them
 * @typedef {{
 *   player: { x: number, z: number, speed: number },
 *   units: UnitSight[],
 *   limit?: number, patrols?: number,
 *   heliSees?: boolean,
 *   toll?: number | null, duel?: boolean, hitPolice?: number, wrecked?: number, destroyed?: string[],
 *   hiding?: boolean, money?: number,
 *   planBlock?: (heat: number) => any,
 * }} PoliceWorld
 *   `toll` is the km/h of a toll gate crossed this frame (one event, not a state), `hitPolice`
 *   yen of damage to police cars this frame, `wrecked` civilians wrecked, `destroyed` the kind of
 *   every unit destroyed this frame (each pays its bounty, counts as taken out and adds a little
 *   heat), `planBlock` plans a roadblock on the player's route (or null).
 * @typedef {{
 *   spawn: string[], chase: 'chase' | 'search' | 'patrol', search: { x: number, z: number, r: number } | null,
 *   heli: boolean, roadblock: any, spikes: any, clearRoadblock: boolean, release: boolean,
 *   tires: { grip: number, top: number, left: number, active: boolean },
 *   money: number, report: any, events: { type: string, [k: string]: any }[], view: any,
 * }} PoliceOrders
 */

/**
 * Whether a unit sees the player: a clear line and in range. Chasing, it has them anywhere in
 * SIGHT_RANGE; on patrol, all round within PATROL_RANGE; searching after it lost them, only in
 * its cone ahead or right beside it, so the player can slip past behind it.
 * @param {UnitSight} u @param {{ x: number, z: number }} p @param {'chase' | 'search' | 'patrol'} mode
 */
export function unitSees(u, p, mode) {
  if (!u.clear) return false;
  if (mode === 'chase') return u.d < SIGHT_RANGE;
  if (mode === 'patrol') return u.d < PATROL_RANGE;
  if (u.d < AROUND_RANGE) return true;
  if (u.d > CONE_RANGE) return false;
  const bearing = Math.atan2(p.x - u.x, p.z - u.z);
  let off = bearing - u.yaw;
  off = Math.atan2(Math.sin(off), Math.cos(off));
  return Math.abs(off) < CONE_HALF;
}

export class PoliceDirector {
  /** @param {{ rand?: () => number }} [opts] */
  constructor({ rand = Math.random } = {}) {
    this.rand = rand;
    this.heat = new Heat();
    /** @type {Pursuit | null} */
    this.pursuit = null;
    /** Seconds the end card has been up, while the ended pursuit is kept for it. */
    this.reportAge = 0;
    this.backupTimer = 0;
    /** @type {any} the standing roadblock. */
    this.roadblock = null;
    /** @type {any} its spike strip. */
    this.spikes = null;
    this.blockTimer = 0;
    this.blockAge = 0;
    this.blockReached = false;
    /** Seconds since the tires were spiked, 0 while they are whole. */
    this.flatTime = 0;
  }

  /** The pursuit is running (not ended, not just a report on screen). */
  get active() {
    const p = this.pursuit;
    return !!p && p.pstate !== 'busted' && p.pstate !== 'escaped';
  }

  /** The heat level, 0 to 5. */
  get level() {
    return this.heat.level;
  }

  /** The tires are mended (a pump, a tow). */
  mendTires() {
    this.flatTime = 0;
  }

  /**
   * One frame of the police.
   * @param {number} dt @param {PoliceWorld} w
   * @returns {PoliceOrders}
   */
  update(dt, w) {
    const p = w.player;
    /** @type {PoliceOrders} */
    const out = {
      spawn: [], chase: 'patrol', search: null, heli: false, roadblock: null, spikes: null,
      clearRoadblock: false, release: false, tires: spikePenalty(0), money: 0, report: null, events: [], view: null,
    };
    const mode = !this.active ? 'patrol' : /** @type {Pursuit} */ (this.pursuit).pstate === 'cooldown' ? 'search' : 'chase';
    let nearest = Infinity;
    let seen = false;
    let watcher = null;
    for (const u of w.units) {
      if (!unitSees(u, p, mode)) continue;
      seen = true;
      if (u.d < nearest) {
        nearest = u.d;
        watcher = u;
      }
    }
    if (this.active && w.heliSees) seen = true;

    // A finished pursuit only shows its card, then the police stand down.
    if (this.pursuit && !this.active) {
      this.reportAge += dt;
      out.view = this.pursuit.reportView();
      if (this.reportAge >= REPORT_TIME) {
        this.pursuit = null;
        out.view = null;
      }
      this.heat.update(dt, {});
      this.stepTires(dt, p, out);
      out.spawn = this.backup(dt, w, 0);
      return out;
    }

    const toll = w.toll != null && noticesTrap(w.toll);
    if (!this.active) {
      const watched = watcher && noticesSpeeding(p, watcher, w.limit ?? 100);
      const start = this.heat.update(dt, {
        speeding: !!watched, duel: !!(w.duel && seen), trap: toll, hitPolice: (w.hitPolice || 0) > 0,
      });
      if (start) this.begin(out);
    }

    if (this.active) {
      const pursuit = /** @type {Pursuit} */ (this.pursuit);
      const level = Math.max(1, this.heat.level);
      const heli = level >= 3;
      pursuit.setHeat(level, heli);
      if (seen) pursuit.lastSeen(p.x, p.z);
      /** @type {string[]} */
      const infractions = [];
      if (toll) infractions.push('tollRun');
      if ((w.hitPolice || 0) > 0) infractions.push('ram');
      if (seen && watcher && noticesSpeeding(p, watcher, w.limit ?? 100)) infractions.push('speeding');
      for (const id of w.destroyed || []) {
        const kind = UNIT_BY_ID.get(id);
        const bounty = kind?.bounty ?? 5000;
        pursuit.disable(bounty);
        infractions.push('ram');
        out.events.push({ type: 'destroyed', kind: id, name: kind?.name ?? 'UNIT', bounty });
      }
      const events = pursuit.update(dt, {
        speed: p.speed, seen, close: nearest < BUST_RANGE, units: w.units.length, heli,
        hiding: !!w.hiding, damage: w.hitPolice || 0, wrecked: (w.wrecked || 0) > 0, events: infractions,
      });
      const before = this.heat.level;
      this.heat.update(dt, { pursuit: true, infractions: events.filter((e) => e.type === 'infraction').length });
      if (this.heat.level > before) out.events.push({ type: 'heat', level: this.heat.level });
      out.events.push(...events);
      for (const e of events) {
        if (e.type === 'escaped') {
          out.money += e.bounty;
          this.end(out);
        } else if (e.type === 'busted') {
          out.money -= Math.min(e.fine, Math.max(0, w.money ?? e.fine));
          this.heat.wipe();
          this.end(out);
        }
      }
      if (this.active) {
        out.chase = pursuit.pstate === 'cooldown' ? 'search' : 'chase';
        out.search = pursuit.pstate === 'cooldown' ? { ...pursuit.last } : null;
        out.heli = heli;
        this.stepRoadblock(dt, w, out);
        out.view = pursuit.view();
      } else {
        out.view = /** @type {Pursuit} */ (this.pursuit).reportView();
      }
    }
    this.stepTires(dt, p, out);
    out.spawn = this.backup(dt, w, this.active ? roster(Math.max(1, this.heat.level)).length : w.patrols ?? 2);
    return out;
  }

  /** @param {PoliceOrders} out */
  begin(out) {
    this.heat.startPursuit();
    this.pursuit = new Pursuit();
    this.pursuit.setHeat(this.heat.level, false);
    this.reportAge = 0;
    this.backupTimer = 0;
    this.blockTimer = BLOCK_EVERY / 2;
    out.events.push({ type: 'start', heat: this.heat.level });
  }

  /** The pursuit is over: the units go home, the roadblock comes down. @param {PoliceOrders} out */
  end(out) {
    const pursuit = /** @type {Pursuit} */ (this.pursuit);
    out.report = pursuit.result();
    out.release = true;
    out.chase = 'patrol';
    out.heli = false;
    this.reportAge = 0;
    this.heat.calm = 0;
    if (this.roadblock) out.clearRoadblock = true;
    this.roadblock = null;
    this.spikes = null;
  }

  /**
   * Which units to send out now: what the roster for the heat wants (or the patrols when there
   * is no pursuit), minus what is already out, one at a time.
   * @param {number} dt @param {PoliceWorld} w @param {number} want
   * @returns {string[]}
   */
  backup(dt, w, want) {
    this.backupTimer -= dt;
    if (w.units.length >= want || this.backupTimer > 0) return [];
    this.backupTimer = this.active ? BACKUP_EVERY : 0;
    if (!this.active) return ['police'];
    // The roster for the heat, minus the kinds already on the road: the missing one goes out.
    const left = roster(Math.max(1, this.heat.level));
    for (const u of w.units) {
      const i = left.indexOf(u.kind || 'police');
      if (i >= 0) left.splice(i, 1);
    }
    return [left.length ? left[left.length - 1] : 'police'];
  }

  /**
   * Roadblocks at heat 4 and up: one at a time, out of the player's sight, on their route. Passing
   * one counts as dodged, and a strip passed untouched too.
   * @param {number} dt @param {PoliceWorld} w @param {PoliceOrders} out
   */
  stepRoadblock(dt, w, out) {
    const p = w.player;
    const pursuit = /** @type {Pursuit} */ (this.pursuit);
    this.blockTimer = Math.max(0, this.blockTimer - dt);
    if (this.roadblock) {
      const b = this.roadblock;
      this.blockAge += dt;
      const d = Math.hypot(p.x - b.x, p.z - b.z);
      const past = (p.x - b.x) * b.tx + (p.z - b.z) * b.tz > 0;
      if (d < BLOCK_AT) this.blockReached = true;
      if (this.spikes && !this.spikes.hit && hitSpikes(this.spikes, p)) {
        this.spikes.hit = true;
        this.flatTime = 1e-3;
        out.events.push({ type: 'spiked' });
      }
      if (this.blockReached && past && d > BLOCK_PAST) {
        pursuit.roadblocks++;
        out.events.push({ type: 'roadblockDodged' });
        if (this.spikes && !this.spikes.hit) pursuit.spikes++;
        out.clearRoadblock = true;
      } else if (d > BLOCK_GONE || this.blockAge > BLOCK_LIFE) out.clearRoadblock = true;
      if (out.clearRoadblock) {
        this.roadblock = null;
        this.spikes = null;
        this.blockTimer = BLOCK_EVERY;
      }
      return;
    }
    if (pursuit.pstate === 'cooldown' || !w.planBlock) return;
    if (!shouldSetRoadblock(p, this.roadblock, this.heat.level, this.blockTimer)) return;
    const block = w.planBlock(this.heat.level);
    if (!block || tooNearBlock(block, p)) {
      this.blockTimer = 2;
      return;
    }
    this.roadblock = block;
    // Spike strips in half the roadblocks at heat 4, in all of them at 5.
    this.spikes = this.heat.level >= 5 || this.rand() < 0.5 ? planSpikes(block, this.heat.level) : null;
    this.blockAge = 0;
    this.blockReached = false;
    out.roadblock = block;
    out.spikes = this.spikes;
    out.events.push({ type: 'roadblock', spikes: !!this.spikes });
  }

  /** @param {number} dt @param {{ x: number, z: number }} p @param {PoliceOrders} out */
  stepTires(dt, p, out) {
    if (this.flatTime > 0) {
      this.flatTime += dt;
      const pen = spikePenalty(this.flatTime);
      if (!pen.active) this.flatTime = 0;
      out.tires = pen;
    }
  }
}
