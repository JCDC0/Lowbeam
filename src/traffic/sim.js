/**
 * The traffic: cars, vans, trucks and buses driving the lanes of the network. Pure, no
 * three.js. Each agent follows a lane with the Intelligent Driver Model (accelerate toward
 * the wanted speed, brake for whatever is ahead), stops at red lights, changes lanes on
 * multi-lane roads to get past slower traffic, and now and then takes an exit or a turn.
 * Agents appear out of sight around the player and disappear when left far behind. A car
 * the player hits becomes a wreck: a free body that slides to a stop.
 */

import { makeRng } from '../core/rng.js';
import { wrapAngle, clamp, smoothstep } from '../core/mathx.js';
import { KINDS, RIVALS } from './kinds.js';
import { lightState } from './net.js';
import { collideCars, bodyOf } from '../vehicles/contact.js';

/** @typedef {import('./net.js').Lane} Lane */
/** @typedef {import('./net.js').Link} Link */
/** @typedef {import('./kinds.js').Kind} Kind */
/**
 * @typedef {{
 *   id: number, kind: Kind, paint: number, lane: Lane, s: number, speed: number, factor: number,
 *   x: number, y: number, z: number, yaw: number, vx: number, vz: number, yawRate: number,
 *   ex: number, ez: number, cap: number, capUntil: number, plan: Link | null, end: Link | null,
 *   changeDuration: number, changeTimer: number, changeStartX: number, changeStartZ: number,
 *   changePrevEx: number, changePrevEz: number,
 *   mode: 'drive' | 'wreck', age: number, wreckAge: number, laneHold: number, duel: boolean,
 *   signal: number, signalTimer: number, signalTarget: Lane | null,
 *   nextChange: number, inertia: number,
 *   brake: number, fade: number
 * }} Agent
 */

const SCAN = 90;
const MIN_GAP = 2.2;
const SPAWN_MIN = 190;
const SPAWN_MAX = 460;
const KEEP = 620;
const WRECK_TIME = 24;
/** Seconds between lane-change decisions for one agent. */
const CHANGE_EVERY = 0.8;
/** Seconds a civilian keeps the lane it just moved into before it will consider moving again. */
const LANE_HOLD = 8;
/** Clear gap a civilian needs ahead in the slow lane before drifting back into it. */
const SLOW_LANE_GAP = 120;
/** How far up the through road a car counts as approaching a give-way. */
const YIELD_LOOK = 45;
/** How close a car has to be, in seconds, to hold a give-way. */
const YIELD_TIME = 4.5;
/** How far short of the line a car waits when the junction is clear, so it can turn in. */
const YIELD_LINE = 0.4;
/** Seconds a civilian signals before it moves: the shortest and the longest a driver takes. */
const SIGNAL_MIN = 1.2;
const SIGNAL_MAX = 2.5;
/** How far up the road a car starts signalling for a turn or an exit. */
const SIGNAL_LEAD = 60;

const CLASS_DENSITY = { expressway: 4.5, arterial: 1.6, street: 1, ramp: 0.35, mountain: 0.5, forest: 0.4 };

/** IDM acceleration. @param {number} v @param {number} v0 @param {number} accel @param {number} gap @param {number} closing @param {boolean} [rival] */
function idm(v, v0, accel, gap, closing, rival = false) {
  const free = 1 - Math.pow(v / Math.max(v0, 0.1), 4);
  if (gap === Infinity) return accel * free;
  const s0 = rival ? 1.0 : MIN_GAP;
  const T = rival ? 0.6 : 1.25;
  const b = rival ? 5.0 : 3.2;
  const wanted = s0 + Math.max(0, v * T + (v * closing) / (2 * Math.sqrt(accel * b)));
  return accel * (free - (wanted / Math.max(gap, 0.2)) ** 2);
}

/** Lane pieces for spawning, and the grid they are filed in, meters. */
const PIECE = 40;
const PIECE_CELL = 160;

export class TrafficSim {
  /**
   * @param {import('./net.js').TrafficNet} net
   * @param {{ seed?: number, target?: number, rivals?: number }} [opts]
   */
  constructor(net, { seed = 77, target = 38, rivals = 5 } = {}) {
    this.net = net;
    this.rng = makeRng(seed);
    /** @type {Agent[]} */
    this.agents = [];
    this.target = target;
    this.rivalTarget = rivals;
    /** Road id the player is racing on, so traffic stays off it. Null outside a rally. */
    this.rallyRoad = /** @type {string | null} */ (null);
    this.time = 0;
    this.nextId = 1;
    this.spawnTimer = 0;
    /** @type {Map<Lane, Agent[]>} */
    this.byLane = new Map();
    const weights = net.lanes.map((l) => l.length * (CLASS_DENSITY[l.cls] ?? 1) * (l.index === 0 ? 1 : 0.7));
    this.laneWeights = weights;
    this.weightSum = weights.reduce((a, b) => a + b, 0);
    /**
     * Every lane cut into PIECE meter pieces, filed in a grid by where they are, so a spawn picks
     * from the lanes around the player and not from the whole island (where most of the city's
     * streets would be too far away to use).
     * @type {Map<number, { lane: Lane, s0: number, x: number, z: number, w: number }[]>}
     */
    this.pieces = new Map();
    const q = { x: 0, z: 0, tx: 0, tz: 1, y: 0 };
    net.lanes.forEach((lane, i) => {
      const w = (weights[i] / Math.max(1, lane.length)) * PIECE;
      for (let s0 = 0; s0 < lane.length; s0 += PIECE) {
        net.sample(lane, Math.min(lane.length, s0 + PIECE / 2), q);
        const key = this.pieceKey(Math.floor(q.x / PIECE_CELL), Math.floor(q.z / PIECE_CELL));
        let list = this.pieces.get(key);
        if (!list) this.pieces.set(key, (list = []));
        list.push({ lane, s0, x: q.x, z: q.z, w });
      }
    });
    this._q = { x: 0, z: 0, tx: 0, tz: 1, y: 0 };
    this._r = { x: 0, z: 0, tx: 0, tz: 1, y: 0 };
  }

  /** @param {number} cx @param {number} cz */
  pieceKey(cx, cz) {
    return cx * 7919 + cz;
  }

  /**
   * A place on a lane between `min` and `max` meters from the player, busier roads more often.
   * @param {{ x: number, z: number }} player @param {number} min @param {number} max
   * @returns {{ lane: Lane, s: number } | null}
   */
  pickNear(player, min, max) {
    const found = [];
    let sum = 0;
    const c0 = Math.floor((player.x - max) / PIECE_CELL);
    const c1 = Math.floor((player.x + max) / PIECE_CELL);
    const r0 = Math.floor((player.z - max) / PIECE_CELL);
    const r1 = Math.floor((player.z + max) / PIECE_CELL);
    for (let cx = c0; cx <= c1; cx++) {
      for (let cz = r0; cz <= r1; cz++) {
        const list = this.pieces.get(this.pieceKey(cx, cz));
        if (!list) continue;
        for (const p of list) {
          const d = Math.hypot(p.x - player.x, p.z - player.z);
          if (d < min - PIECE / 2 || d > max + PIECE / 2) continue;
          found.push(p);
          sum += p.w;
        }
      }
    }
    if (!found.length) return null;
    let t = this.rng.next() * sum;
    for (const p of found) {
      t -= p.w;
      if (t <= 0) return { lane: p.lane, s: Math.min(p.lane.length, p.s0 + this.rng.next() * PIECE) };
    }
    const p = found[found.length - 1];
    return { lane: p.lane, s: p.s0 };
  }

  /** A lane drawn at random, longer and busier roads more often. */
  pickLane() {
    let t = this.rng.next() * this.weightSum;
    for (let i = 0; i < this.net.lanes.length; i++) {
      t -= this.laneWeights[i];
      if (t <= 0) return this.net.lanes[i];
    }
    return this.net.lanes[0];
  }

  /** @param {string} cls */
  pickKind(cls) {
    const w = KINDS.map((k) => k.weights[cls] ?? 1);
    let t = this.rng.next() * w.reduce((a, b) => a + b, 0);
    for (let i = 0; i < KINDS.length; i++) {
      t -= w[i];
      if (t <= 0) return KINDS[i];
    }
    return KINDS[0];
  }

  /** True for a street racer. @param {Agent} a */
  isRival(a) {
    return a.kind.id.startsWith('rv-');
  }

  /**
   * Adds a street racer on one of the fast lanes of Route 1, out of sight of the player.
   * @param {{ x: number, z: number, yaw?: number }} player @param {number} [min] @param {number} [max]
   * @returns {Agent | null}
   */
  spawnRival(player, min = 250, max = 460) {
    const lanes = this.net.lanes.filter((l) => l.cls === 'expressway' && l.index > 0);
    let aheadCount = 0;
    let behindCount = 0;
    for (const a of this.agents) {
      if (!this.isRival(a) || a.mode !== 'drive') continue;
      const dx = a.x - player.x;
      const dz = a.z - player.z;
      const dot = player.yaw !== undefined
        ? dx * Math.sin(player.yaw) + dz * Math.cos(player.yaw)
        : (a.vx !== 0 || a.vz !== 0 ? dx * a.vx + dz * a.vz : dx * Math.sin(a.yaw) + dz * Math.cos(a.yaw));
      if (dot >= 0) aheadCount++;
      else behindCount++;
    }
    const wantAhead = aheadCount < behindCount;
    const wantBehind = behindCount < aheadCount;

    for (let tries = 0; tries < 32; tries++) {
      const lane = this.rng.pick(lanes);
      const s = this.rng.next() * lane.length;
      const q = this.net.sample(lane, s, this._q);
      const dx = q.x - player.x;
      const dz = q.z - player.z;
      const d = Math.hypot(dx, dz);
      if (d < min || d > max || this.crowded(lane, s, 40)) continue;
      const dot = player.yaw !== undefined
        ? dx * Math.sin(player.yaw) + dz * Math.cos(player.yaw)
        : dx * q.tx + dz * q.tz;
      if (tries < 24) {
        if (wantAhead && dot <= 0) continue;
        if (wantBehind && dot >= 0) continue;
      }
      const w = RIVALS.map((k) => k.weights.expressway ?? 1);
      let t = this.rng.next() * w.reduce((a, b) => a + b, 0);
      let kind = RIVALS[0];
      for (let i = 0; i < RIVALS.length; i++) {
        t -= w[i];
        if (t <= 0) {
          kind = RIVALS[i];
          break;
        }
      }
      const factor = this.rng.range(kind.speed[0], kind.speed[1]);
      const a = /** @type {Agent} */ ({
        id: this.nextId++, kind, paint: this.rng.pick(kind.paint), lane, s, speed: lane.limit * factor, factor,
        x: q.x, y: q.y, z: q.z, yaw: Math.atan2(q.tx, q.tz), vx: 0, vz: 0, yawRate: 0,
        ex: 0, ez: 0, cap: Infinity, capUntil: 0, plan: null, end: null,
        changeDuration: 0, changeTimer: 0, changeStartX: 0, changeStartZ: 0, changePrevEx: 0, changePrevEz: 0,
        mode: 'drive', age: 0, wreckAge: 0, laneHold: 0, duel: false, signal: 0, signalTimer: 0, signalTarget: null,
        nextChange: this.rng.range(0, CHANGE_EVERY), inertia: kind.mass * (kind.length ** 2 + kind.width ** 2) / 12,
        brake: 0, fade: 1,
      });
      this.choose(a);
      this.agents.push(a);
      return a;
    }
    return null;
  }

  /**
   * The nearest street racer within `range` meters of the player: the agent, its distance
   * and whether it is ahead of the car.
   * @param {{ x: number, z: number, yaw?: number }} player @param {number} range
   */
  nearestRival(player, range = 250) {
    let best = null;
    let bd = range;
    for (const a of this.agents) {
      if (!this.isRival(a) || a.mode !== 'drive') continue;
      const d = Math.hypot(a.x - player.x, a.z - player.z);
      if (d < bd) {
        bd = d;
        best = a;
      }
    }
    if (!best) return null;
    const yaw = player.yaw ?? 0;
    const ahead = (best.x - player.x) * Math.sin(yaw) + (best.z - player.z) * Math.cos(yaw) > 0;
    return { agent: best, distance: bd, ahead };
  }

  /**
   * Adds one agent on a random lane at a random spot between `min` and `max` meters from
   * the player, if there is room. Returns it, or null.
   * @param {{ x: number, z: number }} player @param {number} min @param {number} max
   * @returns {Agent | null}
   */
  spawn(player, min, max) {
    for (let tries = 0; tries < 16; tries++) {
      const pick = max < 1e6 ? this.pickNear(player, min, max) : null;
      const lane = pick ? pick.lane : this.pickLane();
      const s = pick ? pick.s : this.rng.next() * lane.length;
      if (this.rallyRoad && lane.road.id === this.rallyRoad) continue;
      const q = this.net.sample(lane, s, this._q);
      const d = Math.hypot(q.x - player.x, q.z - player.z);
      if (d < min || d > max) continue;
      if (this.crowded(lane, s, 30)) continue;
      const kind = this.pickKind(lane.cls);
      const [lo, hi] = kind.speed;
      const factor = this.rng.range(lo, hi);
      const a = /** @type {Agent} */ ({
        id: this.nextId++, kind, paint: this.rng.pick(kind.paint), lane, s, speed: lane.limit * factor * 0.9, factor,
        x: q.x, y: q.y, z: q.z, yaw: Math.atan2(q.tx, q.tz), vx: 0, vz: 0, yawRate: 0,
        ex: 0, ez: 0, cap: Infinity, capUntil: 0, plan: null, end: null,
        changeDuration: 0, changeTimer: 0, changeStartX: 0, changeStartZ: 0, changePrevEx: 0, changePrevEz: 0,
        mode: 'drive', age: 0, wreckAge: 0, laneHold: 0, duel: false, signal: 0, signalTimer: 0, signalTarget: null,
        nextChange: this.rng.range(0, CHANGE_EVERY), inertia: kind.mass * (kind.length ** 2 + kind.width ** 2) / 12,
        brake: 0, fade: 1,
      });
      this.choose(a);
      this.agents.push(a);
      return a;
    }
    return null;
  }

  /** True when another agent is within `gap` meters of s on the lane. */
  crowded(lane, s, gap) {
    for (const o of this.agents) {
      if (o.lane !== lane) continue;
      let d = Math.abs(o.s - s);
      if (lane.closed) d = Math.min(d, lane.length - d);
      if (d < gap) return true;
    }
    return false;
  }

  /** Fills the roads around the player at the start. @param {{ x: number, z: number }} player */
  populate(player) {
    for (let i = 0; i < this.target * 8 && this.agents.length < this.target; i++) this.spawn(player, 70, SPAWN_MAX);
    for (let i = 0; i < this.rivalTarget * 4 && this.countRivals() < this.rivalTarget; i++) this.spawnRival(player, 250, 460);
  }

  /** Picks this agent's turn off the lane and what happens at its end. @param {Agent} a */
  choose(a) {
    a.plan = null;
    // Street racers stay on the loop.
    for (const m of this.isRival(a) ? [] : a.lane.mids) {
      if (m.at <= a.s) continue;
      if (this.rng.chance(m.weight)) {
        a.plan = m;
        break;
      }
    }
    a.end = null;
    const ends = a.lane.ends;
    if (ends.length) {
      let t = this.rng.next() * ends.reduce((x, e) => x + e.weight, 0);
      a.end = ends[ends.length - 1];
      for (const e of ends) {
        t -= e.weight;
        if (t <= 0) {
          a.end = e;
          break;
        }
      }
    }
  }

  /**
   * One step. `player` is the car being driven, so traffic can see it.
   * @param {number} dt @param {{ x: number, z: number, speed: number }} player
   */
  update(dt, player) {
    this.time += dt;
    this.sortLanes();
    for (const a of this.agents) {
      a.age += dt;
      if (this.rallyRoad && a.lane.road.id === this.rallyRoad && a.mode === 'drive') {
        // The stage belongs to the player during a run, so anything still on it fades out.
        a.fade -= dt * 2;
        continue;
      }
      if (a.mode === 'wreck') this.stepWreck(a, dt);
      else this.stepDrive(a, dt, player);
    }
    // Remove what was left behind, what ended and what has been a wreck long enough.
    const keep = [];
    for (const a of this.agents) {
      const far = Math.hypot(a.x - player.x, a.z - player.z);
      const gone = a.fade <= 0 || far > KEEP || (a.mode === 'wreck' && a.wreckAge > WRECK_TIME && far > 25);
      if (!gone) keep.push(a);
    }
    this.agents = keep;
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      const rivals = this.countRivals();
      if (rivals < this.rivalTarget) this.spawnRival(player, 250, 460);
      else if (this.agents.length - rivals < this.target) this.spawn(player, SPAWN_MIN, SPAWN_MAX);
      this.spawnTimer = 0.25;
    }
  }

  countRivals() {
    let n = 0;
    for (const a of this.agents) if (this.isRival(a)) n++;
    return n;
  }

  sortLanes() {
    this.byLane.clear();
    for (const a of this.agents) {
      let list = this.byLane.get(a.lane);
      if (!list) this.byLane.set(a.lane, (list = []));
      list.push(a);
    }
    for (const list of this.byLane.values()) list.sort((p, q) => p.s - q.s);
  }

  /**
   * The nearest obstacle ahead of an agent: another agent, a red light or the player.
   * @param {Agent} a @param {{ x: number, z: number, speed: number }} player
   */
  leader(a, player) {
    const lane = a.lane;
    let gap = Infinity;
    let v = 0;
    const list = this.byLane.get(lane) || [];
    const half = a.kind.length / 2;
    for (const o of list) {
      if (o === a) continue;
      let ds = o.s - a.s;
      if (lane.closed && ds < 0) ds += lane.length;
      if (ds <= 0) continue;
      const g = ds - half - o.kind.length / 2;
      if (g < gap) {
        gap = g;
        v = o.mode === 'wreck' ? 0 : o.speed;
      }
    }
    // Past the end of this lane, look into the lane it leads to.
    const room = lane.length - a.s;
    if (gap > room && a.end && room < SCAN) {
      for (const o of this.byLane.get(a.end.lane) || []) {
        const ds = o.s - a.end.toS;
        if (ds < -2) continue;
        const g = room + ds - half - o.kind.length / 2;
        if (g < gap) {
          gap = g;
          v = o.mode === 'wreck' ? 0 : o.speed;
        }
      }
    }
    for (const stop of lane.stops) {
      const d = stop.s - a.s - half;
      if (d < -1 || d > 70) continue;
      // A give-way at a T junction: hold while anything on the through road could
      // reach the junction. The network leaves this as data on the stop.
      if (stop.yield) {
        if (!this.yieldClear(stop.yield)) continue;
        // The line sits right at the end of the side road, so a car that is on top of
        // it has nothing left to give way to. Holding it there would creep it to a
        // standstill against the junction and never let it turn in.
        if (d < gap) {
          gap = Math.max(YIELD_LINE, d);
          v = 0;
        }
        continue;
      }
      const light = lightState(stop.node, stop.axis, this.time);
      const canStop = d > (a.speed * a.speed) / (2 * 4.5);
      if (light === 'red' || (light === 'yellow' && canStop)) {
        if (d < gap) {
          gap = Math.max(0.1, d);
          v = 0;
        }
      }
    }
    // The player's car, if it is in this lane's corridor ahead.
    const px = player.x - a.x;
    const pz = player.z - a.z;
    const tx = Math.sin(a.yaw);
    const tz = Math.cos(a.yaw);
    const ahead = px * tx + pz * tz;
    const side = px * tz - pz * tx;
    if (ahead > 0 && ahead < SCAN && Math.abs(side) < 2.3) {
      const g = ahead - half - 2.2;
      if (g < gap) {
        gap = g;
        v = player.speed;
      }
    }
    return { gap, v };
  }

  /**
   * Whether a T junction is safe to join: nothing on the through road could reach it in
   * time to matter. The network leaves this on the stop as `{ lanes, at }`.
   * @param {{ lanes: Lane[], at: number }} y
   */
  yieldClear(y) {
    for (const lane of y.lanes) {
      for (const o of this.byLane.get(lane) || []) {
        if (o.mode === 'wreck') continue;
        let ds = y.at - o.s;
        if (lane.closed && ds < 0) ds += lane.length;
        if (ds < -2 || ds > YIELD_LOOK) continue;
        // Far enough away, or slow enough, that it clears before the side car arrives.
        const gap = ds - o.kind.length / 2;
        if (gap > 25 && o.speed < 4) continue;
        if (gap <= 0) return false;
        const tta = gap / Math.max(1, o.speed);
        if (tta < YIELD_TIME) return false;
      }
    }
    return true;
  }

  /** @param {Agent} a @param {number} dt @param {{ x: number, z: number, speed: number }} player */
  stepDrive(a, dt, player) {
    const lane = a.lane;
    const lead = this.leader(a, player);
    const rival = this.isRival(a);
    // A racer in a duel stops cruising and goes for its top speed, and it will not drop
    // back to the slow lane while the duel is on.
    let v0 = a.duel ? a.lane.limit * a.kind.speed[1] : a.lane.limit * a.factor * (rival ? 1.08 : 1.0);
    if (this.time < a.capUntil) v0 = Math.min(v0, a.cap);
    v0 = Math.min(v0, this.curveSpeed(a));
    const effAccel = rival && v0 - a.speed > 3 ? a.kind.accel * 2.0 : a.kind.accel;
    const acc = idm(a.speed, v0, effAccel, lead.gap, a.speed - lead.v, rival);
    a.brake = acc < -1.2 ? 1 : 0;
    a.speed = Math.max(0, a.speed + clamp(acc, -9, effAccel) * dt);
    a.s += a.speed * dt;

    // A signal waits in real time; the move happens when it runs out.
    if (a.signalTimer > 0) a.signalTimer = Math.max(0, a.signalTimer - dt);
    this.maybeChange(a, lead, player);

    // Taking the exit or turn that was planned.
    if (a.plan && a.s >= a.plan.at) {
      const m = a.plan;
      a.plan = null;
      this.clearSignal(a);
      if (!this.crowded(m.lane, m.toS, 14)) this.moveTo(a, m.lane, m.toS + (a.s - m.at), m.kind === 'turn');
    }
    if (a.s >= lane.length && a.lane === lane) {
      if (lane.closed) a.s -= lane.length;
      else if (a.end && !this.crowded(a.end.lane, a.end.toS, 10)) this.moveTo(a, a.end.lane, a.end.toS + (a.s - lane.length), true);
      else if (a.end) a.s = lane.length - 0.1;
      else a.fade = 0;
    }
    if (a.s >= a.lane.length && !a.lane.closed) a.s = a.lane.length - 0.01;

    const q = this.net.sample(a.lane, a.s, this._q);
    const laneYaw = Math.atan2(q.tx, q.tz);

    if (a.changeDuration > 0) {
      a.changeTimer += dt;
      const u = Math.min(1, a.changeTimer / a.changeDuration);
      const k = 1 - smoothstep(0, 1, u);
      const curEx = a.changeStartX * k;
      const curEz = a.changeStartZ * k;
      a.x = q.x + curEx;
      a.z = q.z + curEz;
      a.y = q.y;

      const vxLat = (curEx - a.changePrevEx) / dt;
      const vzLat = (curEz - a.changePrevEz) / dt;
      a.changePrevEx = curEx;
      a.changePrevEz = curEz;

      if (u < 1) {
        const vFwd = Math.max(1, a.speed);
        const vx = vFwd * q.tx + vxLat;
        const vz = vFwd * q.tz + vzLat;
        const motionYaw = Math.atan2(vx, vz);
        let diff = wrapAngle(motionYaw - laneYaw);

        const sign = Math.sign(diff) || 1;
        const maxSteer = 11.5 * (Math.PI / 180);
        const minSteer = 1.2 * (Math.PI / 180);
        if (Math.abs(diff) > maxSteer) diff = sign * maxSteer;
        if (Math.abs(diff) < minSteer) diff = sign * minSteer;

        a.yaw = laneYaw + diff;
      } else {
        a.yaw = laneYaw;
        a.changeDuration = 0;
        a.changeStartX = 0;
        a.changeStartZ = 0;
        a.ex = 0;
        a.ez = 0;
        // The move is over, so the signal that announced it goes off.
        this.clearSignal(a);
      }
      a.vx = Math.sin(a.yaw) * a.speed;
      a.vz = Math.cos(a.yaw) * a.speed;
      a.yawRate = 0;
    } else {
      const k = Math.exp(-dt * (1.4 + a.speed * 0.05));
      a.ex *= k;
      a.ez *= k;
      a.x = q.x + a.ex;
      a.z = q.z + a.ez;
      a.y = q.y;
      const want = Math.atan2(q.tx, q.tz);
      a.yaw += wrapAngle(want - a.yaw) * Math.min(1, dt * 4.5);
      a.vx = Math.sin(a.yaw) * a.speed;
      a.vz = Math.cos(a.yaw) * a.speed;
      a.yawRate = 0;
    }
  }

  /** A slower speed for a tight bend ahead on this lane. @param {Agent} a */
  curveSpeed(a) {
    const lane = a.lane;
    const rival = this.isRival(a);
    if (lane.cls === 'expressway' && !rival) return Infinity;
    const grip = rival ? 8.83 : 3.2;
    const q0 = this.net.sample(lane, a.s, this._q);
    const t0x = q0.tx;
    const t0z = q0.tz;
    const q1 = this.net.sample(lane, Math.min(lane.length, a.s + 28), this._r);
    const turn = Math.abs(wrapAngle(Math.atan2(q1.tx, q1.tz) - Math.atan2(t0x, t0z)));
    return turn < 0.02 ? Infinity : Math.max(6, Math.sqrt(grip / (turn / 28)));
  }

  /** Moves an agent to another lane, keeping its place on screen and blending into the new one. */
  moveTo(a, lane, s, sharp) {
    const old = { x: a.x, z: a.z };
    a.lane = lane;
    a.s = clamp(s, 0, lane.length);
    const q = this.net.sample(lane, a.s, this._q);
    a.ex = old.x - q.x;
    a.ez = old.z - q.z;
    if (sharp && Math.hypot(a.ex, a.ez) > 2.5) {
      a.cap = 9;
      a.capUntil = this.time + 4;
    }
    this.choose(a);
  }

  /**
   * Free road ahead of s in a lane, up to 300 m.
   * @param {import('./net.js').Lane} lane @param {number} s
   */
  openAhead(lane, s) {
    let gap = 300;
    for (const o of this.byLane.get(lane) || []) {
      let ds = o.s - s;
      if (lane.closed && ds < 0) ds += lane.length;
      if (ds > 0 && ds < gap) gap = ds;
    }
    return gap;
  }

  /**
   * Starts a lateral lane change toward a target lane.
   * @param {Agent} a @param {Lane} target
   */
  startLaneChange(a, target) {
    const old = { x: a.x, z: a.z };
    a.lane = target;
    const q = this.net.sample(target, a.s, this._q);
    a.changeStartX = old.x - q.x;
    a.changeStartZ = old.z - q.z;
    a.changePrevEx = a.changeStartX;
    a.changePrevEz = a.changeStartZ;
    const isRiv = this.isRival(a);
    a.changeDuration = isRiv ? 1.5 : Math.max(Math.hypot(a.changeStartX, a.changeStartZ) * 1.5 / 2.7, clamp(1.86 + a.speed * 0.0386, 2.2, 4.2));
    a.changeTimer = 0;
    a.ex = 0;
    a.ez = 0;
    if (a.plan && a.plan.lane) a.plan = null;
    a.end = target.ends.length ? target.ends[0] : null;
    // A civilian that just moved settles in for a while. Racers keep weaving; they are
    // meant to look like they are fighting for the line.
    a.laneHold = isRiv ? 0 : this.time + LANE_HOLD;
    a.nextChange = this.time + (isRiv ? 0.6 : 3);
  }

  /**
   * True when the slow lane beside this one is worth drifting back into: a long clear
   * stretch ahead in it and nothing faster coming up from behind.
   * @param {Agent} a @param {Lane} [slow]
   */
  slowLaneClear(a, slow) {
    if (!slow) return false;
    if (this.openAhead(slow, a.s) < SLOW_LANE_GAP) return false;
    for (const o of this.byLane.get(slow) || []) {
      if (o === a) continue;
      let ds = a.s - o.s;
      if (slow.closed && ds < 0) ds += slow.length;
      if (ds > 0 && ds < 60 && o.speed > a.speed) return false;
    }
    return true;
  }

  /**
   * Which way a lane change goes, in the driver's own frame: -1 left, +1 right. Lane 0 is
   * the leftmost on a keep-left road, so a higher lane index is to the right.
   * @param {Agent} a @param {Lane} target
   */
  signalSide(a, target) {
    return target.index > a.lane.index ? 1 : -1;
  }

  /**
   * Starts a signal before a move. `side` is -1 left, +1 right, or 2 for the hazards on a
   * wreck. The move happens when the timer runs out, not before.
   * @param {Agent} a @param {number} side @param {Lane | null} [target] the lane it waits for
   */
  beginSignal(a, side, target = null) {
    a.signal = side;
    a.signalTarget = target;
    a.signalTimer = this.rng.range(SIGNAL_MIN, SIGNAL_MAX);
  }

  /** Takes the signal off a car that is no longer waiting to move. @param {Agent} a */
  clearSignal(a) {
    if (!a.signalTarget) return;
    a.signal = 0;
    a.signalTimer = 0;
    a.signalTarget = null;
  }

  /**
   * Signals for a turn at a junction or for an exit ramp as the car approaches it, which is
   * a long way ahead of the move itself.
   * @param {Agent} a
   */
  signalForTurn(a) {
    if (this.isRival(a) || a.signal !== 0 || !a.plan) return;
    const toGo = a.plan.at - a.s;
    if (toGo < 0 || toGo > SIGNAL_LEAD) return;
    // Exits leave to the right; a turn goes whichever way the target lane does.
    let side = 0;
    if (a.plan.kind === 'exit') side = 1;
    else {
      const siblings = (this.net.byRoad.get(a.lane.road.id) || []).filter((l) => l.dir === a.lane.dir);
      const from = siblings.findIndex((l) => l === a.lane);
      const to = siblings.findIndex((l) => l === a.plan.lane);
      if (from >= 0 && to >= 0 && to !== from) side = to > from ? 1 : -1;
    }
    if (side) this.beginSignal(a, side);
  }

  /**
   * Everything that has to hold before a car may move into `target`: no stop or turn in the
   * way, the player not in the way, and a safe gap ahead and behind on the target lane.
   * @param {Agent} a @param {Lane} target
   * @param {{ x: number, z: number, speed: number }} [player]
   */
  changeSafe(a, target, player) {
    const rival = this.isRival(a);
    for (const stop of a.lane.stops) {
      const d = stop.s - a.s;
      if (d >= -2 && d < 40) return false;
    }
    if (a.plan && a.plan.lane) {
      const d = a.plan.at - a.s;
      if (d >= 0 && d < 40) return false;
    }

    if (player) {
      const px = player.x - a.x;
      const pz = player.z - a.z;
      const tx = Math.sin(a.yaw);
      const tz = Math.cos(a.yaw);
      const pAhead = px * tx + pz * tz;
      const pSide = px * tz - pz * tx;
      if (Math.abs(pAhead) < a.kind.length / 2 + 3.5 && Math.abs(pSide) < 5.5) return false;
      const targetSide = pSide - (target.offset - a.lane.offset);
      if (Math.abs(targetSide) < 2.5) {
        if (pAhead > 0 && pAhead < 15 + a.speed * 0.4) return false;
        if (pAhead < 0) {
          const distBehind = -pAhead;
          if (distBehind < 16) return false;
          const closing = player.speed - a.speed;
          if (closing > 2 && distBehind < 50 && distBehind / closing < 3.5) return false;
        }
      }
    }

    const half = a.kind.length / 2;
    const minSafetyGap = rival ? 1.5 : (MIN_GAP + 5);
    for (const o of this.byLane.get(target) || []) {
      if (o === a) continue;
      let ds = o.s - a.s;
      if (target.closed) {
        if (ds > target.length / 2) ds -= target.length;
        else if (ds < -target.length / 2) ds += target.length;
      }
      const gap = Math.abs(ds) - half - o.kind.length / 2;
      if (gap < minSafetyGap) return false;
      if (ds > 0 && ds < (rival ? 10 + a.speed * 0.2 : 15 + a.speed * 0.4)) {
        const timeToHit = ds / Math.max(0.1, a.speed - o.speed);
        if (a.speed > o.speed && timeToHit < (rival ? 1.0 : 2.5)) return false;
      }
      if (ds < 0) {
        const distBehind = -ds;
        if (distBehind < (rival ? 6 : 16)) return false;
        const closing = o.speed - a.speed;
        if (closing > 2 && distBehind < 50 && distBehind / closing < (rival ? 2.0 : 3.5)) return false;
      }
    }
    return true;
  }

  /**
   * Evaluates lane change opportunities: overtaking slower cars, yielding to faster
   * vehicles closing from behind, and positioning for planned exits or turns.
   * @param {Agent} a @param {{ gap: number, v: number }} lead
   * @param {{ x: number, z: number, speed: number }} [player]
   */
  maybeChange(a, lead, player) {
    this.signalForTurn(a);
    if (a.changeDuration > 0 || this.time < a.nextChange) return;
    const rival = this.isRival(a);
    a.nextChange = this.time + (rival ? 0.3 : CHANGE_EVERY);
    const lane = a.lane;
    const siblings = this.net.byRoad.get(lane.road.id) || [];
    const same = siblings.filter((l) => l.dir === lane.dir);
    if (same.length < 2) return;

    let want = -1;
    const wanted = a.duel ? lane.limit * a.kind.speed[1] : lane.limit * a.factor;

    if (rival) {
      if (a.duel) {
        // A duelling racer only moves to get past something or to take a clearer line; it
        // never drifts back to the slow lane while the race is on.
        if (lead.gap < 140) {
          for (const idx of [lane.index + 1, lane.index - 1]) {
            const next = same.find((l) => l.index === idx);
            if (next && this.openAhead(next, a.s) > lead.gap + 15) want = idx;
          }
        }
      } else if (lead.gap < 140 && (wanted - lead.v > 1.5 || a.speed < wanted * 0.96)) {
        let bestRoom = Math.max(lead.gap + 15, 50);
        let bestIdx = -1;
        for (const idx of [lane.index + 1, lane.index - 1]) {
          const next = same.find((l) => l.index === idx);
          if (!next) continue;
          const room = this.openAhead(next, a.s);
          if (room > bestRoom) {
            bestRoom = room;
            bestIdx = idx;
          }
        }
        if (bestIdx >= 0) want = bestIdx;
      } else if (lane.index < same.length - 1 && lead.gap > 90) {
        const faster = same.find((l) => l.index === lane.index + 1);
        if (faster && this.openAhead(faster, a.s) > 90) {
          want = lane.index + 1;
        }
      }
    } else {
      // A planned exit or turn and something stopped ahead outrank the hold: those are
      // reasons to leave a lane no matter how recently the car moved into it.
      const planned = a.plan && a.plan.lane;
      const distToExit = planned ? a.plan.at - a.s : 0;
      const mustLeave = (planned && distToExit > 0 && distToExit < 250) || lead.gap < 38;
      const held = this.time < a.laneHold;
      if (lane.index > 0) {
        let closingBehind = false;
        for (const o of this.byLane.get(lane) || []) {
          if (o === a) continue;
          let ds = a.s - o.s;
          if (lane.closed && ds < 0) ds += lane.length;
          if (ds > 4 && ds < 45 && (o.speed > a.speed + 3 || (this.isRival(o) && ds < 35))) {
            closingBehind = true;
            break;
          }
        }
        if (!closingBehind && player) {
          const tx = Math.sin(a.yaw);
          const tz = Math.cos(a.yaw);
          const pAhead = (player.x - a.x) * tx + (player.z - a.z) * tz;
          const pSide = (player.x - a.x) * tz - (player.z - a.z) * tx;
          if (pAhead > -50 && pAhead < -4 && Math.abs(pSide) < 2.0 && player.speed > a.speed + 3) {
            closingBehind = true;
          }
        }
        if (closingBehind && !held) {
          want = lane.index - 1;
        } else if (planned && distToExit > 0 && distToExit < 250) {
          want = lane.index - 1;
        } else if (lead.gap < 38 && wanted - lead.v > 2) {
          want = lane.index + 1;
        } else if (lead.gap > 70 && a.speed < wanted * 1.02 && this.slowLaneClear(a, same[lane.index - 1])) {
          want = lane.index - 1;
        }
      } else if (lead.gap < 38 && wanted - lead.v > 2) {
        want = lane.index + 1;
      }
      if (held && !mustLeave) want = -1;
    }

    if (want < 0 || want >= same.length) {
      this.clearSignal(a);
      return;
    }
    const target = same.find((l) => l.index === want);
    if (!target) {
      this.clearSignal(a);
      return;
    }

    // A civilian signals first and moves when the signal has run its course, looking again
    // on the way: if the gap closed it drops the signal and stays where it is. Racers weave
    // and never signal.
    if (!rival) {
      if (a.signalTarget !== target) {
        if (!this.changeSafe(a, target, player)) {
          this.clearSignal(a);
          return;
        }
        this.beginSignal(a, this.signalSide(a, target), target);
        return;
      }
      if (a.signalTimer > 0) return;
      if (!this.changeSafe(a, target, player)) {
        this.clearSignal(a);
        return;
      }
    } else if (!this.changeSafe(a, target, player)) {
      return;
    }

    for (const stop of a.lane.stops) {
      const d = stop.s - a.s;
      if (d >= -2 && d < 40) return false;
    }
    if (a.plan && a.plan.lane) {
      const d = a.plan.at - a.s;
      if (d >= 0 && d < 40) return false;
    }

    if (player) {
      const px = player.x - a.x;
      const pz = player.z - a.z;
      const tx = Math.sin(a.yaw);
      const tz = Math.cos(a.yaw);
      const pAhead = px * tx + pz * tz;
      const pSide = px * tz - pz * tx;
      if (Math.abs(pAhead) < a.kind.length / 2 + 3.5 && Math.abs(pSide) < 5.5) return false;
      const latOffset = target.offset - a.lane.offset;
      const targetSide = pSide - latOffset;
      if (Math.abs(targetSide) < 2.5) {
        if (pAhead > 0 && pAhead < 15 + a.speed * 0.4) return false;
        if (pAhead < 0) {
          const distBehind = -pAhead;
          if (distBehind < 16) return false;
          const closing = player.speed - a.speed;
          if (closing > 2 && distBehind < 50 && distBehind / closing < 3.5) return false;
        }
      }
    }

    const half = a.kind.length / 2;
    const minSafetyGap = rival ? 1.5 : (MIN_GAP + 5);
    for (const o of this.byLane.get(target) || []) {
      if (o === a) continue;
      let ds = o.s - a.s;
      if (target.closed) {
        if (ds > target.length / 2) ds -= target.length;
        else if (ds < -target.length / 2) ds += target.length;
      }
      const gap = Math.abs(ds) - half - o.kind.length / 2;
      if (gap < minSafetyGap) return false;
      if (ds > 0 && ds < (rival ? 10 + a.speed * 0.2 : 15 + a.speed * 0.4)) {
        const timeToHit = ds / Math.max(0.1, a.speed - o.speed);
        if (a.speed > o.speed && timeToHit < (rival ? 1.0 : 2.5)) return false;
      }
      if (ds < 0) {
        const distBehind = -ds;
        if (distBehind < (rival ? 6 : 16)) return false;
        const closing = o.speed - a.speed;
        if (closing > 2 && distBehind < 50 && distBehind / closing < (rival ? 2.0 : 3.5)) return false;
      }
    }

    this.startLaneChange(a, target);
  }

  /** @param {Agent} a @param {number} dt */
  stepWreck(a, dt) {
    // A wreck sits with its hazards on both sides until it fades.
    a.signal = 2;
    a.signalTimer = 0;
    a.signalTarget = null;
    a.wreckAge += dt;
    const drag = Math.exp(-dt * 0.9);
    a.vx *= drag;
    a.vz *= drag;
    a.yawRate *= Math.exp(-dt * 1.4);
    const sp = Math.hypot(a.vx, a.vz);
    if (sp > 0.05) {
      const brake = Math.min(sp, 5.5 * dt);
      a.vx -= (a.vx / sp) * brake;
      a.vz -= (a.vz / sp) * brake;
    } else {
      a.vx = a.vz = 0;
    }
    a.x += a.vx * dt;
    a.z += a.vz * dt;
    a.yaw += a.yawRate * dt;
    a.speed = Math.hypot(a.vx, a.vz);
    if (a.wreckAge > WRECK_TIME - 3) a.fade = Math.max(0, (WRECK_TIME - a.wreckAge) / 3);
    a.brake = 1;
  }

  /**
   * Collides every agent near the player with the player's car. Returns the closing speed
   * of the hardest hit, in m/s.
   * @param {ReturnType<typeof import('../vehicles/physics.js').createVehicleState>} state
   * @param {import('../vehicles/specs.js').CarSpec} spec
   */
  collideWithPlayer(state, spec) {
    let hardest = 0;
    const me = bodyOf(state, spec);
    for (const a of this.agents) {
      if (Math.abs(a.x - state.x) > 14 || Math.abs(a.z - state.z) > 14) continue;
      if (Math.abs(a.y - state.y) > 2.5) continue;
      const body = {
        x: a.x, z: a.z, yaw: a.yaw, vx: a.vx, vz: a.vz, yawRate: a.yawRate,
        mass: a.kind.mass, inertia: a.inertia, width: a.kind.width, length: a.kind.length, offset: 0,
      };
      const hit = collideCars(me, body);
      if (hit <= 0) continue;
      hardest = Math.max(hardest, hit);
      a.x = body.x;
      a.z = body.z;
      a.vx = body.vx;
      a.vz = body.vz;
      a.yawRate = body.yawRate;
      if (a.mode === 'drive') {
        a.mode = 'wreck';
        a.wreckAge = 0;
        a.ex = a.ez = 0;
        a.changeDuration = 0;
      }
    }
    return hardest;
  }
}
