/**
 * The Kuro Pass time attack: a point to point run against the clock. Pure: no three.js,
 * no DOM, no store. The caller reads the stage road out of the world, steps the race with
 * the car's arc length along it, plays the events this returns, and owns the save.
 *
 * Rules, from the brief: a 3 s countdown, gates spaced evenly from `startS` to a finish
 * just short of the road's end, splits against the best time for the car, medals from the
 * average km/h targets in the config, and a 5 s penalty for putting the car back on the
 * stage. More than 25 m off the road for 3 s earns a 10 s countdown and then the run is
 * aborted. A ghost of the best run is recorded here; drawing it is the caller's job.
 */

import { RaceEvent } from './event.js';

/** Seconds of countdown before the clock starts. */
export const COUNTDOWN = 3;
/** Meters off the road that count as off course. */
export const OFF_COURSE = 25;
/** Seconds off course before the warning countdown starts. */
export const OFF_LIMIT = 3;
/** Seconds the warning countdown gives the driver to get back on the road. */
export const OFF_GRACE = 10;
/** Seconds added by putting the car back on the stage. */
export const PENALTY = 5;
/** Seconds between ghost samples. */
export const GHOST_STEP = 0.1;
/** How close to a gate counts as passing through it. */
export const GATE_TOLERANCE = 12;

/** @typedef {import('./event.js').RaceEventMsg} RaceEventMsg */
/**
 * @typedef {{ length: number, id?: string, path?: { length: number } }} StageRoad
 * @typedef {{ s: number, d?: number, pose?: { x: number, z: number, yaw: number } }} RallyWorld
 * @typedef {import('./event.js').RaceWorld & RallyWorld} RallyInput
 * @typedef {{ won: boolean, prize: number, rival: string, reason: string, time: number,
 *   medals: string[], splits: any[], avgKmh: number, best: number | null, record: boolean }} RallyResult
 */

/** One recorded ghost pose, in centimeters and centi-radians. */
const emptyGhost = () => [];

export class Rally extends RaceEvent {
  /**
   * @param {string} carId the car being timed, used for the best time and the ghost
   * @param {{ id: string, name: string, startS: number, finishEndOffset: number, checkpoints: number,
   *           medals: Record<string, number>, prize: Record<string, number> }} cfg the RALLY config
   * @param {{ length: number, id?: string, path?: { length: number } }} road the stage road; a
   *   `world/roads.js` Road is passed as `any` because its `length` lives on its `path`
   * @param {{ best?: number | null, bestSplits?: (number | null)[] | null }} [opts] the saved best
   *   time for this car and its splits, so each gate can say whether the driver is up or down
   */
  constructor(carId, cfg, road, opts = {}) {
    super(`rally-${cfg.id}-${carId}`, 'rally', [carId]);
    this.carId = carId;
    this.cfg = cfg;
    this.road = /** @type {StageRoad} */ (/** @type {any} */ (road));
    this.startS = cfg.startS;
    this.finishS = this.roadLength() - cfg.finishEndOffset;
    this.gates = this.placeGates(cfg.checkpoints);
    this.nextIndex = 0;
    this.gatesHit = 0;
    /** Seconds since the race object was made, countdown included. */
    this.elapsed = 0;
    /** Seconds on the clock, which only runs once the countdown is over. */
    this.lapTime = 0;
    this.penalty = 0;
    this.offTime = 0;
    this.offCountdown = 0;
    this.lastCount = COUNTDOWN + 1;
    /** @type {{ at: number, against: number | null, ahead: boolean }[]} */
    this.splits = [];
    this.best = opts.best ?? null;
    this.bestSplits = opts.bestSplits ?? null;
    /** @type {{ t: number, x: number, z: number, yaw: number }[]} */
    this.ghost = emptyGhost();
    this.ghostNext = 0;
    /** The last arc length the car was on the road, so an off-course step does not skip a gate. */
    this.lastS = this.startS;
    /** @type {RallyResult | null} */
    this.outcome = null;
  }

  /** Arc length of the stage road, whether it is a Road or a plain object. */
  roadLength() {
    const r = /** @type {StageRoad} */ (this.road);
    return typeof r.length === 'number' ? r.length : r.path.length;
  }

  /**
   * The gates, evenly spaced from the start to the finish.
   * @param {number} count
   */
  placeGates(count) {
    const from = this.startS;
    const span = (this.finishS - from) / (count + 1);
    const gates = [];
    for (let i = 1; i <= count; i++) gates.push(from + span * i);
    return gates;
  }

  /** The next gate the driver still has to drive through, or the finish once they are all hit. */
  nextGate() {
    return this.gatesHit < this.gates.length ? this.gates[this.gatesHit] : this.finishS;
  }

  /** Adds the reset penalty. */
  penalize() {
    this.penalty += PENALTY;
    return this.penalty;
  }

  /**
   * Records one ghost pose. Stored as whole centimeters and centi-radians so a saved
   * ghost stays small and compares exactly.
   * @param {number} t seconds into the run @param {{ x: number, z: number, yaw: number }} pose
   */
  recordGhost(t, pose) {
    this.ghost.push({
      t: Math.round(t * 1000),
      x: Math.round(pose.x * 100),
      z: Math.round(pose.z * 100),
      yaw: Math.round(pose.yaw * 100),
    });
  }

  /**
   * The ghost's pose at time `t`, interpolated between the samples around it, or null
   * outside the recorded span so the caller knows not to draw anything.
   * @param {number} t
   */
  ghostAt(t) {
    const g = this.ghost;
    if (g.length === 0 || t < g[0].t / 1000 || t > g[g.length - 1].t / 1000) return null;
    let i = 0;
    while (i < g.length - 1 && g[i + 1].t / 1000 <= t) i++;
    const a = g[i];
    const b = g[i + 1];
    if (!b) return { t, x: a.x / 100, z: a.z / 100, yaw: a.yaw / 100 };
    const span = (b.t - a.t) / 1000;
    const f = span > 0 ? Math.min(1, Math.max(0, (t - a.t / 1000) / span)) : 0;
    return {
      t,
      x: (a.x + (b.x - a.x) * f) / 100,
      z: (a.z + (b.z - a.z) * f) / 100,
      yaw: (a.yaw + (b.yaw - a.yaw) * f) / 100,
    };
  }

  /**
   * Advances the run. `world.s` is the car's arc length along the stage and `world.d` its
   * lateral offset from the centerline, positive to the left.
   * @param {number} dt
   * @param {RallyInput} world
   * @returns {RaceEventMsg[]}
   */
  update(dt, world) {
    if (this.state === 'won' || this.state === 'lost' || this.state === 'aborted') return [];

    if (this.state === 'countdown') {
      const step = Math.min(Math.ceil(COUNTDOWN - this.elapsed), COUNTDOWN);
      this.elapsed += dt;
      this.time = 0;
      if (this.elapsed >= COUNTDOWN) {
        this.state = 'running';
        this.lapTime = 0;
        return [{ type: 'go' }];
      }
      if (step < this.lastCount) {
        this.lastCount = step;
        return [{ type: 'count', n: step }];
      }
      return [];
    }

    // Off course: a countdown the driver has to answer by getting back on the road.
    const off = Math.abs(world.d || 0) > OFF_COURSE;
    if (off) {
      this.offTime += dt;
      if (this.offCountdown > 0) {
        this.offCountdown -= dt;
        if (this.offCountdown <= 0) {
          this.abort();
          return [{ type: 'abort', reason: 'off-course' }];
        }
      } else if (this.offTime >= OFF_LIMIT) {
        this.offCountdown = OFF_GRACE;
        return [{ type: 'offcourse', grace: OFF_GRACE }];
      }
    } else {
      this.offTime = 0;
      this.offCountdown = 0;
    }

    this.lapTime += dt;
    // The base class exposes `time`; for a timed run that is the clock, not the countdown.
    this.time = this.lapTime;

    // Ghost samples on a fixed clock, independent of the frame rate.
    if (this.lapTime >= this.ghostNext) {
      this.ghostNext += GHOST_STEP;
      this.recordGhost(this.lapTime, world.pose || { x: 0, z: 0, yaw: 0 });
    }

    const s = world.s;
    // Gates only count if the driver is actually on the road when they pass.
    if (!off && this.gatesHit < this.gates.length && Math.abs(s - this.gates[this.gatesHit]) <= GATE_TOLERANCE) {
      this.gatesHit++;
      return [this.recordSplit()];
    }
    // The finish only counts once every gate has been driven through.
    if (!off && this.gatesHit >= this.gates.length && s >= this.finishS) {
      const split = this.recordSplit();
      return [split, this.finish()];
    }
    return [];
  }

  /** Records the split at a gate and says whether the driver is up or down on the best. */
  recordSplit() {
    const i = this.splits.length;
    const against = this.bestSplits && this.bestSplits[i] != null ? this.bestSplits[i] : null;
    const ahead = against !== null && this.lapTime < against;
    this.splits.push({ at: this.lapTime, against, ahead });
    return { type: 'split', index: i, at: this.lapTime, against, ahead };
  }

  /** Works out the medals and the prize and ends the run. */
  finish() {
    const time = this.lapTime + this.penalty;
    const distance = this.finishS - this.startS;
    // The medal targets are average km/h, so a slow run gets less.
    const avgKmh = distance > 0 ? (distance / time) * 3.6 : 0;
    const m = this.cfg.medals;
    /** @type {string[]} */
    const medals = [];
    if (avgKmh >= m.gold) medals.push('gold', 'silver', 'bronze');
    else if (avgKmh >= m.silver) medals.push('silver', 'bronze');
    else if (avgKmh >= m.bronze) medals.push('bronze');
    this.state = 'won';
    const prize = medals.length ? this.cfg.prize[medals[0]] : 0;
    this.outcome = {
      won: true,
      prize,
      rival: this.road.id || this.cfg.id,
      reason: 'finished',
      time,
      avgKmh,
      medals,
      splits: this.splits,
      best: this.best,
      record: this.best === null || time < this.best,
    };
    return { type: 'end', won: true, prize, time, medals };
  }

  /** @returns {RallyResult | null} */
  result() {
    return this.outcome;
  }
}