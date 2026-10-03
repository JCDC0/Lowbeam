/**
 * The traffic: cars, vans, trucks and buses driving the lanes of the network. Pure, no
 * three.js. Each agent follows a lane with the Intelligent Driver Model (accelerate toward
 * the wanted speed, brake for whatever is ahead), stops at red lights, changes lanes on
 * multi-lane roads to get past slower traffic, and now and then takes an exit or a turn.
 * Agents appear out of sight around the player and disappear when left far behind. A car
 * the player hits becomes a wreck: a free body that slides to a stop.
 */

import { makeRng } from '../core/rng.js';
import { wrapAngle, clamp } from '../core/mathx.js';
import { KINDS } from './kinds.js';
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
 *   mode: 'drive' | 'wreck', age: number, wreckAge: number, nextChange: number, inertia: number,
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

const CLASS_DENSITY = { expressway: 3, arterial: 1.6, street: 1, ramp: 0.35, mountain: 0.5, forest: 0.4 };

/** IDM acceleration. @param {number} v @param {number} v0 @param {number} accel @param {number} gap @param {number} closing */
function idm(v, v0, accel, gap, closing) {
  const free = 1 - Math.pow(v / Math.max(v0, 0.1), 4);
  if (gap === Infinity) return accel * free;
  const wanted = MIN_GAP + Math.max(0, v * 1.25 + (v * closing) / (2 * Math.sqrt(accel * 3.2)));
  return accel * (free - (wanted / Math.max(gap, 0.2)) ** 2);
}

export class TrafficSim {
  /**
   * @param {import('./net.js').TrafficNet} net
   * @param {{ seed?: number, target?: number }} [opts]
   */
  constructor(net, { seed = 77, target = 38 } = {}) {
    this.net = net;
    this.rng = makeRng(seed);
    /** @type {Agent[]} */
    this.agents = [];
    this.target = target;
    this.time = 0;
    this.nextId = 1;
    this.spawnTimer = 0;
    /** @type {Map<Lane, Agent[]>} */
    this.byLane = new Map();
    const weights = net.lanes.map((l) => l.length * (CLASS_DENSITY[l.cls] ?? 1) * (l.index === 0 ? 1 : 0.7));
    this.laneWeights = weights;
    this.weightSum = weights.reduce((a, b) => a + b, 0);
    this._q = { x: 0, z: 0, tx: 0, tz: 1, y: 0 };
    this._r = { x: 0, z: 0, tx: 0, tz: 1, y: 0 };
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

  /**
   * Adds one agent on a random lane at a random spot between `min` and `max` meters from
   * the player, if there is room. Returns it, or null.
   * @param {{ x: number, z: number }} player @param {number} min @param {number} max
   * @returns {Agent | null}
   */
  spawn(player, min, max) {
    for (let tries = 0; tries < 16; tries++) {
      const lane = this.pickLane();
      const s = this.rng.next() * lane.length;
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
        mode: 'drive', age: 0, wreckAge: 0, nextChange: this.rng.range(0, CHANGE_EVERY), inertia: kind.mass * (kind.length ** 2 + kind.width ** 2) / 12,
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
    for (let i = 0; i < this.target * 3 && this.agents.length < this.target; i++) this.spawn(player, 70, SPAWN_MAX);
  }

  /** Picks this agent's turn off the lane and what happens at its end. @param {Agent} a */
  choose(a) {
    a.plan = null;
    for (const m of a.lane.mids) {
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
    if (this.spawnTimer <= 0 && this.agents.length < this.target) {
      this.spawn(player, SPAWN_MIN, SPAWN_MAX);
      this.spawnTimer = 0.25;
    }
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

  /** @param {Agent} a @param {number} dt @param {{ x: number, z: number, speed: number }} player */
  stepDrive(a, dt, player) {
    const lane = a.lane;
    const lead = this.leader(a, player);
    let v0 = a.lane.limit * a.factor;
    if (this.time < a.capUntil) v0 = Math.min(v0, a.cap);
    v0 = Math.min(v0, this.curveSpeed(a));
    const acc = idm(a.speed, v0, a.kind.accel, lead.gap, a.speed - lead.v);
    a.brake = acc < -1.2 ? 1 : 0;
    a.speed = Math.max(0, a.speed + clamp(acc, -9, a.kind.accel) * dt);
    a.s += a.speed * dt;

    this.maybeChange(a, lead);

    // Taking the exit or turn that was planned.
    if (a.plan && a.s >= a.plan.at) {
      const m = a.plan;
      a.plan = null;
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

  /** A slower speed for a tight bend ahead on this lane. @param {Agent} a */
  curveSpeed(a) {
    const lane = a.lane;
    if (lane.cls === 'expressway') return Infinity;
    const q0 = this.net.sample(lane, a.s, this._q);
    const t0x = q0.tx;
    const t0z = q0.tz;
    const q1 = this.net.sample(lane, Math.min(lane.length, a.s + 28), this._r);
    const turn = Math.abs(wrapAngle(Math.atan2(q1.tx, q1.tz) - Math.atan2(t0x, t0z)));
    return turn < 0.02 ? Infinity : Math.max(6, Math.sqrt(3.2 / (turn / 28)));
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

  /** Overtaking on roads with more than one lane in the direction of travel. */
  maybeChange(a, lead) {
    if (this.time < a.nextChange) return;
    a.nextChange = this.time + CHANGE_EVERY;
    const lane = a.lane;
    const siblings = this.net.byRoad.get(lane.road.id) || [];
    const same = siblings.filter((l) => l.dir === lane.dir);
    if (same.length < 2) return;
    let want = -1;
    const wanted = lane.limit * a.factor;
    if (lead.gap < 38 && wanted - lead.v > 2) want = lane.index + 1;
    else if (lane.index > 0 && lead.gap > 70 && a.speed < wanted * 1.02) want = lane.index - 1;
    if (want < 0 || want >= same.length) return;
    const target = same.find((l) => l.index === want);
    if (!target || this.crowded(target, a.s, 15 + a.speed * 0.45)) return;
    const old = { x: a.x, z: a.z };
    a.lane = target;
    const q = this.net.sample(target, a.s, this._q);
    a.ex = old.x - q.x;
    a.ez = old.z - q.z;
    // Keep any planned exit: it belongs to the outer lane, so go back to it first.
    if (a.plan && a.plan.lane) a.plan = null;
    a.end = target.ends.length ? target.ends[0] : null;
    a.nextChange = this.time + 3;
  }

  /** @param {Agent} a @param {number} dt */
  stepWreck(a, dt) {
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
      }
    }
    return hardest;
  }
}
