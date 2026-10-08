/**
 * The traffic: cars, vans, trucks and buses driving the lanes of the network. Pure, no
 * three.js. Each agent follows a lane with the Intelligent Driver Model (accelerate toward
 * the wanted speed, brake for whatever is ahead), stops at red lights, changes lanes on
 * multi-lane roads to get past slower traffic, and now and then takes an exit or a turn.
 * Agents appear out of sight around the player and disappear when left far behind. A car
 * the player hits is knocked: a free body on its tires that slides, spins and settles, then drives on
 * from where it stopped; a hard hit wrecks it. Knocked cars and wrecks hit the other traffic too.
 */

import { makeRng } from '../core/rng.js';
import { wrapAngle, clamp, smoothstep } from '../core/mathx.js';
import { KINDS, RIVALS, UNIT_KINDS, UNIT_BY_ID, isUnit } from './kinds.js';
import { lightState } from './net.js';
import { Manners, HORN_GAP, HORN_EVERY } from './manners.js';
import { collideCars, bodyOf } from '../vehicles/contact.js';
import { DAMAGE, health, unitDamage } from '../police/units.js';

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
 *   mode: 'drive' | 'knocked' | 'wreck' | 'parked', age: number, wreckAge: number, knockAge?: number, laneHold: number, duel: boolean,
 *   signal: number, signalTimer: number, signalTarget: Lane | null,
 *   nextChange: number, inertia: number,
 *   brake: number, fade: number, pursuit?: boolean | 'chase' | 'search',
 *   free?: boolean, blind?: number, offroad?: number, routeTimer?: number, routeLane?: Lane | null,
 *   noRoute?: number, leave?: boolean, hp?: number, destroyed?: boolean,
 *   quarry?: Agent | null, tailTime?: number, chasedBy?: number | null, shy?: number, shyUntil?: number,
 *   hurry?: number, hurryUntil?: number
 * }} Agent
 * A police unit's `pursuit` is 'chase' (drive at the player: along the lanes by the shortest
 * route, straight at them once close with a clear line, `free`), 'search' (drive to where they
 * were last seen) or false (patrol like traffic); `true` is read as 'chase'. A roadblock unit is
 * `parked`. `leave` sends a unit home: it goes once it is out of sight.
 */

const SCAN = 90;
const MIN_GAP = 2.2;
const SPAWN_MIN = 190;
const SPAWN_MAX = 460;
const KEEP = 620;
const WRECK_TIME = 24;
/** A civilian or racer hit harder than this (closing speed, m/s) is wrecked; a lighter hit knocks it. */
const CIVIL_WRECK_HIT = 18;
/**
 * A knocked car on its tires: how fast its sideways slide dies and how hard its driver brakes (m/s2),
 * how fast its spin settles (1/s), the sideways speed (m/s) below which the slide is over and it tries
 * its lane again, and how long it may sit off every lane before it counts as a wreck.
 */
const KNOCK = { grip: 7.5, brake: 4.5, spin: 2.2, slide: 0.6, stranded: 6 };
/**
 * A civilian with a faster car (the player or a racer) closing on it from behind within `range` m at
 * `closing` m/s or more gets out of the way: over into a free lane, else it raises the speed it aims for
 * to `hurry` times its wanted speed for `hurryFor` s.
 */
const AVOID = { range: 25, closing: 8, hurry: 1.2, hurryFor: 4 };
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

/** Within this many meters a pursuing unit stops following its lane and drives at the player. */
const CHASE_RANGE = 120;
/** How far ahead the unit aims, the player's own speed times this lead. */
const CHASE_LEAD = 1.2;
/** How hard a unit steers toward its aim point, radians per second at the limit. */
const CHASE_STEER = 3.4;
/** Seconds between two route searches for one pursuing unit. */
const ROUTE_EVERY = 0.6;
/** A U-turn on a two-way road counts this many meters in a route. */
const UTURN_COST = 45;
/** Farthest a unit will drive to reach the player before it is sent somewhere better. */
const ROUTE_MAX = 2000;
/**
 * Patrols chasing street racers, while no pursuit of the player is on. Every `every` seconds a patrol
 * with a racer in sight within `range` m, going faster than `over` times the limit, takes it up with
 * probability `chance`, at most `max` at a time. It gives up after `time` s, or when the racer is
 * `lose` m ahead, wrecked or gone. A chased racer pushes on at `flee` times its pace.
 */
export const TAIL = { every: 1, range: 80, over: 1.25, chance: 0.3, max: 1, time: 45, lose: 380, flee: 1.15 };
/** Seconds a unit may lose its clear line before it goes back to the lanes. */
const BLIND_TIME = 1;
/** Seconds a unit may be off every road before it is given up. */
const OFFROAD_TIME = 5;
/** A unit that has gone home leaves once it is this far from the player. */
const LEAVE_RANGE = 150;
/** A car against a wall: the part of its speed into the wall it bounces back with, the part along the wall it loses, and how much an end hit spins it. */
const WALL_BOUNCE = 0.2;
const WALL_SCRAPE = 0.35;
const WALL_SPIN = 0.4;
/** Within this many meters of the player a chasing unit holds the player's speed. */
const CONTACT_RANGE = 6;
/** Half the player's car, for the gap a unit keeps; and how far into it a ramming unit aims. */
const PLAYER_HALF = 2.2;
const RAM_REACH = 1.5;

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
   * @param {{ seed?: number, target?: number, rivals?: number, patrols?: number }} [opts]
   */
  constructor(net, { seed = 77, target = 38, rivals = 5, patrols = 2 } = {}) {
    this.net = net;
    this.rng = makeRng(seed);
    /** @type {Agent[]} */
    this.agents = [];
    this.target = target;
    this.rivalTarget = rivals;
    /** How many patrol cars cruise among the traffic when nothing is happening. */
    this.patrolTarget = patrols;
    /** 1 to 5 while a pursuit is on: how hard the units drive, and whether they ram. */
    this.heat = 0;
    /** The civilians' horns and their panic in a pursuit (manners.js); `takeSounds` empties it. */
    this.manners = new Manners(seed + 14);
    /** When each civilian last blew its warning horn (`honk`), by id. @type {Map<number, number>} */
    this.honkAt = new Map();
    /**
     * Hooks the Drive sets so units respect the world (the sim stays pure; tests leave them null):
     * `clear(unit, player)` says nothing solid stands between them, `groundAt(x, z, y)` is the
     * road or ground height under a unit driving off its lane.
     * @type {((a: { x: number, y: number, z: number }, b: { x: number, y?: number, z: number }) => boolean) | null}
     */
    this.clear = null;
    /** @type {((x: number, z: number, y: number) => number) | null} */
    this.groundAt = null;
    /**
     * The deepest contact of a circle with the world's walls, barriers and posts at height y, or
     * null (`Colliders.probe`). With it set, every car off its lane (a wreck, a unit driving free)
     * hits what it meets instead of passing through it.
     * @type {((x: number, z: number, r: number, y: number) => { nx: number, nz: number, depth: number, px: number, pz: number } | null) | null}
     */
    this.hitWorld = null;
    /** Where the searching units drive to while the police look for the player. @type {{ x: number, z: number, r: number } | null} */
    this.search = null;
    /**
     * Since the last `takeEvents`: units lost (destroyed or left behind), yen-worthy hits on units,
     * civilians wrecked, and the kind of every unit destroyed (its hit points gone).
     */
    this.lost = 0;
    this.policeHit = 0;
    this.civilWrecks = 0;
    /** @type {string[]} */
    this.destroyed = [];
    /** @type {{ lane: Lane, s: number }[]} the lanes at the player, refreshed each step while units chase. */
    this.goals = [];
    /** @type {{ lane: Lane, s: number }[]} */
    this.searchGoals = [];
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

  /**
   * Spawns one police unit of `kindId` on a lane between `min` and `max` meters from the player,
   * the way the motor pool sends one out. With `reach`, only where a route of at most that many
   * meters leads to the player (so backup never starts on the far carriageway of Route 1).
   * Returns the agent, or null if there was no room.
   * @param {{ x: number, z: number, y?: number }} player @param {string} kindId @param {number} min @param {number} max
   * @param {number} [reach]
   * @returns {Agent | null}
   */
  spawnUnit(player, kindId, min, max, reach = 0) {
    const goals = reach ? this.net.lanesAt(player.x, player.z, (player.y ?? -Infinity) + 0.5, 40) : [];
    if (reach && !goals.length) reach = 0;
    const kind = UNIT_BY_ID.get(kindId) || UNIT_BY_ID.get('police');
    for (let tries = 0; tries < 16; tries++) {
      const pick = this.pickNear(player, min, max);
      const lane = pick ? pick.lane : this.pickLane();
      const s = pick ? pick.s : this.rng.next() * lane.length;
      if (this.rallyRoad && lane.road.id === this.rallyRoad) continue;
      const q = this.net.sample(lane, s, this._q);
      const d = Math.hypot(q.x - player.x, q.z - player.z);
      if (d < min || d > max) continue;
      if (this.crowded(lane, s, 30)) continue;
      if (reach && !this.net.route(lane, s, goals, { maxCost: reach, uturn: UTURN_COST })) continue;
      const factor = this.rng.range(kind.speed[0], kind.speed[1]);
      const a = /** @type {Agent} */ ({
        id: this.nextId++, kind, paint: this.rng.pick(kind.paint), lane, s, speed: lane.limit * factor * 0.9, factor,
        x: q.x, y: q.y, z: q.z, yaw: Math.atan2(q.tx, q.tz), vx: 0, vz: 0, yawRate: 0,
        ex: 0, ez: 0, cap: Infinity, capUntil: 0, plan: null, end: null,
        changeDuration: 0, changeTimer: 0, changeStartX: 0, changeStartZ: 0, changePrevEx: 0, changePrevEz: 0,
        mode: 'drive', age: 0, wreckAge: 0, laneHold: 0, duel: false, signal: 0, signalTimer: 0, signalTarget: null,
        nextChange: this.rng.range(0, CHANGE_EVERY), inertia: kind.mass * (kind.length ** 2 + kind.width ** 2) / 12,
        brake: 0, fade: 1, pursuit: false,
      });
      this.choose(a);
      this.agents.push(a);
      return a;
    }
    return null;
  }

  /**
   * Parks a roadblock unit at a spot planned by `planRoadblock`, across the road.
   * @param {string} kindId @param {{ x: number, y: number, z: number, yaw: number }} spot @param {Lane} lane @param {number} s
   * @returns {Agent}
   */
  spawnParked(kindId, spot, lane, s) {
    const kind = UNIT_BY_ID.get(kindId) || UNIT_BY_ID.get('police');
    let targetLane = lane;
    let targetS = s;
    if (lane && lane.road) {
      const siblings = (this.net.byRoad.get(lane.road.id) || []).filter((l) => l.dir === lane.dir);
      let bestD = Infinity;
      for (const l of siblings) {
        const q = this.net.sample(l, s, this._q);
        const d = Math.hypot(q.x - spot.x, q.z - spot.z);
        if (d < bestD) {
          bestD = d;
          targetLane = l;
        }
      }
    }
    const a = /** @type {Agent} */ ({
      id: this.nextId++, kind, paint: this.rng.pick(kind.paint), lane: targetLane, s: targetS, speed: 0, factor: 1,
      x: spot.x, y: spot.y, z: spot.z, yaw: spot.yaw, vx: 0, vz: 0, yawRate: 0,
      ex: 0, ez: 0, cap: Infinity, capUntil: 0, plan: null, end: null,
      changeDuration: 0, changeTimer: 0, changeStartX: 0, changeStartZ: 0, changePrevEx: 0, changePrevEz: 0,
      mode: 'parked', age: 0, wreckAge: 0, laneHold: 0, duel: false, signal: 0, signalTimer: 0, signalTarget: null,
      nextChange: 0, inertia: kind.mass * (kind.length ** 2 + kind.width ** 2) / 12,
      brake: 1, fade: 1, pursuit: false,
    });
    this.agents.push(a);
    return a;
  }

  /**
   * Sets every unit to chase, search or patrol. Parked units stay parked unless `unpark`. With
   * `keep`, units past that many go home (`leave`).
   * @param {false | 'chase' | 'search'} mode @param {{ keep?: number, unpark?: boolean }} [opts]
   */
  command(mode, { keep = Infinity, unpark = false } = {}) {
    let n = 0;
    for (const a of this.agents) {
      if (!isUnit(a.kind) || a.mode === 'wreck') continue;
      if (a.mode === 'parked') {
        if (!unpark && mode) continue;
        a.mode = 'drive';
        a.free = true;
      }
      if (a.leave) continue;
      if (++n > keep) {
        a.leave = true;
        a.pursuit = false;
        continue;
      }
      // A pursuit of the player comes first: any racer chase is dropped.
      if (mode && a.quarry) this.endTail(a);
      a.pursuit = mode;
      if (!mode && a.free) this.rejoin(a);
    }
  }

  /** What happened to the units and the traffic since the last call, for the police. */
  takeEvents() {
    const out = { lost: this.lost, policeHit: this.policeHit, civilWrecks: this.civilWrecks, destroyed: this.destroyed };
    this.lost = 0;
    this.policeHit = 0;
    this.civilWrecks = 0;
    this.destroyed = [];
    return out;
  }

  /** The horns and the screeching tires since the last call, for the audio. */
  takeSounds() {
    return this.manners.take();
  }

  /** Every live police unit. @returns {Agent[]} */
  units() {
    return this.agents.filter((a) => isUnit(a.kind));
  }

  /** How many police units are alive. */
  countUnits() {
    let n = 0;
    for (const a of this.agents) if (isUnit(a.kind)) n++;
    return n;
  }

  /** The police units within `range` of the player, nearest first. @param {{ x: number, z: number }} player @param {number} range */
  unitsNear(player, range) {
    return this.units()
      .map((a) => ({ agent: a, d: Math.hypot(a.x - player.x, a.z - player.z) }))
      .filter((u) => u.d < range)
      .sort((p, q) => p.d - q.d);
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
   * @param {number} dt @param {{ x: number, y?: number, z: number, speed: number }} player
   */
  update(dt, player) {
    this.time += dt;
    this.sortLanes();
    let chasing = false;
    let searching = false;
    for (const a of this.agents) {
      if (a.pursuit === 'search') searching = true;
      else if (a.pursuit) chasing = true;
    }
    if (chasing) this.goals = this.net.lanesAt(player.x, player.z, (player.y ?? -Infinity) + 0.5, 40);
    if (searching && this.search) this.searchGoals = this.net.lanesAt(this.search.x, this.search.z, -Infinity, 60);
    for (const a of this.agents) {
      a.age += dt;
      if (this.rallyRoad && a.lane.road.id === this.rallyRoad && a.mode === 'drive') {
        // The stage belongs to the player during a run, so anything still on it fades out.
        a.fade -= dt * 2;
        continue;
      }
      if (a.mode === 'wreck') this.stepWreck(a, dt);
      else if (a.mode === 'knocked') this.stepKnocked(a, dt);
      else if (a.mode === 'parked') this.stepParked(a);
      else if (a.pursuit) this.stepPursuit(a, dt, player, a.pursuit === 'search' ? this.searchGoals : this.goals);
      else if (a.quarry) this.stepTail(a, dt);
      else this.stepDrive(a, dt, player);
      if (this.hitWorld && (a.mode === 'wreck' || a.mode === 'knocked' || a.free)) this.collideWorld(a);
    }
    this.collideAgents();
    const driver = /** @type {any} */ (player);
    if (driver.yaw !== undefined) this.manners.update(this.time, this.agents, driver, this.heat);
    this.startTails(dt);
    // Remove what was left behind, what ended and what has been a wreck long enough. A chasing
    // unit left behind is lost to the pursuit.
    const keep = [];
    for (const a of this.agents) {
      const far = Math.hypot(a.x - player.x, a.z - player.z);
      const gone = a.fade <= 0 || far > KEEP || (a.mode === 'wreck' && a.wreckAge > WRECK_TIME && far > 25) || (a.leave && far > LEAVE_RANGE);
      if (!gone) keep.push(a);
      else if (a.pursuit && a.mode !== 'wreck' && isUnit(a.kind) && far > KEEP) this.lost++;
    }
    this.agents = keep;
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      const rivals = this.countRivals();
      // Racers only spawn on Route 1; far from it no racer can be placed, and the civilians must
      // still be refilled (before 0.9.79 the city emptied once its first traffic had gone).
      const racer = rivals < this.rivalTarget ? this.spawnRival(player, 250, 460) : null;
      if (!racer && this.agents.length - rivals < this.target) this.spawn(player, SPAWN_MIN, SPAWN_MAX);
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
      if (a.mode === 'wreck') {
        const at = this.net.locate(a.x, a.z, a.yaw, a.y + 0.5, 6);
        if (at) {
          a.lane = at.lane;
          a.s = at.s;
        }
      }
      let list = this.byLane.get(a.lane);
      if (!list) this.byLane.set(a.lane, (list = []));
      list.push(a);

      if ((a.mode === 'parked' || a.mode === 'wreck') && a.lane && a.lane.road) {
        const siblings = (this.net.byRoad.get(a.lane.road.id) || []).filter((l) => l.dir === a.lane.dir);
        const reach = (a.mode === 'parked' ? Math.max(a.kind.length, a.kind.width) : a.kind.width) / 2;
        for (const l of siblings) {
          if (l === a.lane) continue;
          const q = this.net.sample(l, a.s, this._q);
          const d = Math.hypot(q.x - a.x, q.z - a.z);
          if (d < l.width / 2 + reach * 0.7) {
            let sibList = this.byLane.get(l);
            if (!sibList) this.byLane.set(l, (sibList = []));
            if (!sibList.includes(a)) sibList.push(a);
          }
        }
      }
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
      const s0 = this.isRival(a) ? 1.0 : MIN_GAP;
      const reach = o.mode === 'parked' ? Math.max(o.kind.length, o.kind.width) / 2 : o.kind.length / 2;
      const physicalDist = ds - half - reach;
      const targetStop = o.mode === 'parked' ? 6.0 : s0;
      const g = physicalDist - (targetStop - s0);
      if (g < gap) {
        gap = Math.max(0.1, g);
        v = (o.mode === 'wreck' || o.mode === 'parked') ? 0 : o.speed;
      }
    }
    // Past the end of this lane, look into the lane it leads to.
    const room = lane.length - a.s;
    if (gap > room && a.end && room < SCAN) {
      for (const o of this.byLane.get(a.end.lane) || []) {
        const ds = o.s - a.end.toS;
        if (ds < -2) continue;
        const s0 = this.isRival(a) ? 1.0 : MIN_GAP;
        const reach = o.mode === 'parked' ? Math.max(o.kind.length, o.kind.width) / 2 : o.kind.length / 2;
        const physicalDist = room + ds - half - reach;
        const targetStop = o.mode === 'parked' ? 6.0 : s0;
        const g = physicalDist - (targetStop - s0);
        if (g < gap) {
          gap = Math.max(0.1, g);
          v = (o.mode === 'wreck' || o.mode === 'parked') ? 0 : o.speed;
        }
      }
    }
    for (const stop of a.pursuit ? [] : lane.stops) {
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
    if (!a.pursuit && ahead > 0 && ahead < SCAN && Math.abs(side) < 2.3) {
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
    if (this.time < (a.hurryUntil ?? 0)) v0 = Math.max(v0, a.hurry ?? v0);
    // Sirens on: a unit drives as fast as the chase needs, up to its own top speed, whatever the
    // limit; a search is brisk but not flat out.
    if (a.pursuit || a.quarry) v0 = this.pursuitSpeed(a, player);
    if (a.chasedBy != null) v0 *= TAIL.flee;
    if (this.time < a.capUntil) v0 = Math.min(v0, a.cap);
    v0 = Math.min(v0, this.curveSpeed(a));
    const fast = rival || !!a.pursuit;
    const effAccel = a.pursuit ? a.kind.accel * 1.6 : rival && v0 - a.speed > 3 ? a.kind.accel * 2.0 : a.kind.accel;
    const acc = idm(a.speed, v0, effAccel, lead.gap, a.speed - lead.v, fast);
    a.brake = acc < -1.2 ? 1 : 0;
    a.speed = Math.max(0, a.speed + clamp(acc, -9, effAccel) * dt);
    a.s += a.speed * dt;

    // A signal waits in real time; the move happens when it runs out.
    if (a.signalTimer > 0) a.signalTimer = Math.max(0, a.signalTimer - dt);
    if (!isUnit(a.kind) && !rival && a.changeDuration === 0 && this.closingBehind(a, player) > 0) this.avoid(a, player);
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
      // A panicking car edges toward the curb (its left) and holds there until it calms down.
      const shy = a.shy && this.time < (a.shyUntil ?? 0) ? a.shy : 0;
      const sx = q.tz * shy;
      const sz = -q.tx * shy;
      a.ex = sx + (a.ex - sx) * k;
      a.ez = sz + (a.ez - sz) * k;
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

  /**
   * A pursuing unit within `CHASE_RANGE` of the player stops following its lane and drives at
   * the player directly: it aims at where the player will be (`CHASE_LEAD` seconds ahead),
   * brakes for the traffic in its way, and at heat 4 and up aims at the player's flank to ram.
   * A Rhino (`headOn`) always drives straight at the player from ahead instead of chasing.
   * @param {Agent} a @param {number} dt @param {{ x: number, z: number, speed: number, vx?: number, vz?: number }} player
   */
  stepChase(a, dt, player) {
    const dist = Math.hypot(player.x - a.x, player.z - a.z);
    // The player's own velocity, so the aim leads a moving target.
    const pvx = player.vx ?? 0;
    const pvz = player.vz ?? 0;
    const lead = CHASE_LEAD;
    let tx = player.x + pvx * lead;
    let tz = player.z + pvz * lead;
    // At heat 4 and up a cruiser aims at the player's side to PIT them; the very close in it
    // still aims at the car itself, so it does not swing wide at the last moment.
    if (this.heat >= 4 && !a.kind.headOn && dist < 40) {
      const px = Math.sin(a.yaw);
      const pz = Math.cos(a.yaw);
      const side = 2.2 * (a.id % 2 ? 1 : -1);
      tx += pz * side;
      tz += -px * side;
    }
    const aimYaw = Math.atan2(tx - a.x, tz - a.z);
    const diff = wrapAngle(aimYaw - a.yaw);
    const turn = clamp(diff, -CHASE_STEER * dt, CHASE_STEER * dt);
    a.yawRate = dt > 0 ? turn / dt : 0;
    a.yaw += turn;

    // It drives hard, but brakes for whatever is directly in front, the way a real chase does.
    let v0 = a.kind.top ? this.pursuitSpeed(a, player) : a.lane.limit * a.kind.speed[1] * (0.7 + 0.12 * this.heat);
    // On the player's bumper it matches their speed: a nudge at heat 1, a shove from heat 2 up,
    // never an engine that pushes the player's car along.
    if (dist < CONTACT_RANGE) v0 = Math.min(v0, player.speed + (this.heat >= 2 ? 3 : 0.5));
    const aheadX = a.x + Math.sin(a.yaw) * 18;
    const aheadZ = a.z + Math.cos(a.yaw) * 18;
    let block = Infinity;
    for (const o of this.agents) {
      if (o === a || o.mode === 'wreck') continue;
      const dx = o.x - aheadX;
      const dz = o.z - aheadZ;
      const d = Math.hypot(dx, dz);
      if (d < 6) block = Math.min(block, d);
    }
    let acc = idm(a.speed, v0, a.kind.accel * 1.6, block, a.speed, true);
    // The player ahead is the car it follows: it closes fast and brakes in time instead of
    // piling into a car that stopped. From heat 2 it aims a little into the bumper.
    const toward = (Math.sin(a.yaw) * (player.x - a.x) + Math.cos(a.yaw) * (player.z - a.z)) / Math.max(dist, 1e-3);
    if (toward > 0.85) {
      const pAlong = (player.vx ?? 0) * Math.sin(a.yaw) + (player.vz ?? 0) * Math.cos(a.yaw);
      const gap = dist - a.kind.length / 2 - PLAYER_HALF + (this.heat >= 2 ? RAM_REACH : 0);
      acc = Math.min(acc, idm(a.speed, v0, a.kind.accel * 1.6, Math.max(0.2, gap), a.speed - pAlong, true));
    }
    a.brake = acc < -1.2 ? 1 : 0;
    a.speed = Math.max(0, a.speed + clamp(acc, -11, a.kind.accel * 1.6) * dt);

    a.vx = Math.sin(a.yaw) * a.speed;
    a.vz = Math.cos(a.yaw) * a.speed;
    a.x += a.vx * dt;
    a.z += a.vz * dt;
    if (this.groundAt) a.y = this.groundAt(a.x, a.z, a.y);
  }

  /**
   * How fast a unit with its sirens on wants to go: chasing, faster than the player (more the
   * further back it is), never past its kind's top speed; searching, a brisk patrol.
   * @param {Agent} a @param {{ x: number, z: number, speed: number }} player
   */
  pursuitSpeed(a, player) {
    const top = ((a.kind.top ?? 160) / 3.6) * (health(a) < DAMAGE.limp ? DAMAGE.limpSpeed : 1);
    const base = a.lane.limit * a.kind.speed[1];
    if (a.pursuit === 'search') return Math.min(top, base);
    const behind = Math.hypot(player.x - a.x, player.z - a.z);
    const catchUp = player.speed * (1.1 + 0.05 * this.heat) + clamp(behind / 20, 0, 15);
    return Math.min(top, Math.max(base * (0.95 + 0.1 * this.heat), catchUp));
  }

  /**
   * A unit with its sirens on. Close, on the same level and with a clear line, it drives straight
   * at the player (`stepChase`); otherwise it takes the lanes, re-planning the shortest route to
   * the player (or to the search area) every ROUTE_EVERY seconds, U-turns included.
   * @param {Agent} a @param {number} dt @param {{ x: number, y?: number, z: number, speed: number }} player
   */
  stepPursuit(a, dt, player, goals) {
    const search = a.pursuit === 'search';
    const d = Math.hypot(player.x - a.x, player.z - a.z);
    const level = player.y === undefined || Math.abs(a.y - player.y) < 3;
    if (!search && d < CHASE_RANGE && level) {
      const clear = !this.clear || this.clear(a, player);
      a.blind = clear ? 0 : (a.blind || 0) + dt;
      if (clear || (a.free && a.blind < BLIND_TIME)) {
        a.free = true;
        a.offroad = 0;
        this.stepChase(a, dt, player);
        return;
      }
    }
    if (a.free && !this.rejoin(a)) {
      // Off every road (it followed the player through a car park): keep after them a while.
      a.offroad = (a.offroad || 0) + dt;
      if (a.offroad > OFFROAD_TIME) {
        a.fade = 0;
        this.lost++;
      } else this.stepChase(a, dt, player);
      return;
    }
    a.routeTimer = (a.routeTimer ?? 0) - dt;
    if (a.routeTimer <= 0 || a.routeLane !== a.lane) this.planRoute(a, goals, d);
    this.stepDrive(a, dt, player);
  }

  /**
   * Patrols take up racers they see speeding (`TAIL`), only while the player is not being chased.
   * @param {number} dt
   */
  startTails(dt) {
    this.tailTimer = (this.tailTimer ?? TAIL.every) - dt;
    if (this.tailTimer > 0) return;
    this.tailTimer = TAIL.every;
    let tails = 0;
    for (const a of this.agents) {
      if (a.pursuit) return;
      if (a.quarry) tails++;
    }
    for (const a of this.agents) {
      if (tails >= TAIL.max) return;
      if (!isUnit(a.kind) || a.mode !== 'drive' || a.quarry || a.leave) continue;
      for (const r of this.agents) {
        if (!this.isRival(r) || r.mode !== 'drive' || r.duel || r.chasedBy != null) continue;
        if (Math.abs(r.x - a.x) > TAIL.range || Math.abs(r.z - a.z) > TAIL.range || Math.abs(r.y - a.y) > 3) continue;
        if (Math.hypot(r.x - a.x, r.z - a.z) > TAIL.range || r.speed < r.lane.limit * TAIL.over) continue;
        if (this.clear && !this.clear(a, r)) continue;
        if (this.rng.next() > TAIL.chance) continue;
        a.quarry = r;
        a.tailTime = 0;
        a.routeLane = null;
        r.chasedBy = a.id;
        tails++;
        break;
      }
    }
  }

  /**
   * A patrol chasing a racer: lights and siren on, driven like a pursuit with the racer as its
   * target, until it gives up.
   * @param {Agent} a @param {number} dt
   */
  stepTail(a, dt) {
    const q = /** @type {Agent} */ (a.quarry);
    a.tailTime = (a.tailTime || 0) + dt;
    const gone = !this.agents.includes(q) || q.mode === 'wreck' || q.fade < 1;
    if (gone || a.tailTime > TAIL.time || Math.hypot(q.x - a.x, q.z - a.z) > TAIL.lose) {
      this.endTail(a);
      return;
    }
    this.stepPursuit(a, dt, q, [{ lane: q.lane, s: q.s }]);
  }

  /** The patrol gives up its racer and goes back to patrolling. @param {Agent} a */
  endTail(a) {
    if (a.quarry) a.quarry.chasedBy = null;
    a.quarry = null;
    a.routeLane = null;
    if (a.free) this.rejoin(a);
  }

  /**
   * Points a unit's next turn along the shortest route to `goals`. A unit with no route for a
   * while, far from the player, is taken off the board for the director to send a better one.
   * @param {Agent} a @param {{ lane: Lane, s: number }[]} goals @param {number} d its distance to the player
   */
  planRoute(a, goals, d) {
    a.routeTimer = ROUTE_EVERY;
    a.routeLane = a.lane;
    if (!goals.length) return;
    const r = this.net.route(a.lane, a.s, goals, { maxCost: ROUTE_MAX, uturn: UTURN_COST });
    if (!r) {
      a.noRoute = (a.noRoute || 0) + 1;
      if (a.noRoute > 4 && d > 250) a.fade = 0;
      return;
    }
    a.noRoute = 0;
    const f = r.first;
    if (!f) {
      a.plan = null;
      return;
    }
    if ('uturn' in f) {
      this.moveTo(a, f.uturn, f.s, true);
      a.routeLane = null;
      return;
    }
    if (f.link.kind === 'end') {
      a.plan = null;
      a.end = f.link;
    } else a.plan = f.link;
  }

  /**
   * Puts a unit that was driving free back on the lane under it, facing its way. False when it
   * is off every road.
   * @param {Agent} a
   */
  rejoin(a) {
    const at = this.net.locate(a.x, a.z, a.yaw, a.y + 0.5, 6);
    if (!at) return false;
    a.free = false;
    a.speed = Math.hypot(a.vx, a.vz);
    this.moveTo(a, at.lane, at.s, false);
    a.routeLane = null;
    return true;
  }

  /** A roadblock unit: parked, lights on, waiting. @param {Agent} a */
  stepParked(a) {
    a.speed = 0;
    a.vx = 0;
    a.vz = 0;
    a.yawRate = 0;
    a.brake = 1;
  }

  /** A slower speed for a tight bend ahead on this lane. @param {Agent} a */
  curveSpeed(a) {
    const lane = a.lane;
    const rival = this.isRival(a) || !!a.pursuit;
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
    for (const o of this.agents) {
      if (o === a || !o.lane || o.lane.road !== target.road || o.lane.dir !== target.dir) continue;
      if (o.changeDuration > 0 || o.signalTarget === target) {
        let ds = o.s - a.s;
        if (target.closed) {
          if (ds > target.length / 2) ds -= target.length;
          else if (ds < -target.length / 2) ds += target.length;
        }
        if (Math.abs(ds) < (rival ? 10 : 25)) return false;
      }
    }
    return true;
  }

  /**
   * The closing speed (m/s) of the nearest faster car behind a civilian in its own lane: the player
   * (within `AVOID.range` and in the lane) or a racer. Zero when none closes at `AVOID.closing` or more.
   * @param {Agent} a @param {{ x: number, z: number, speed: number }} [player]
   */
  closingBehind(a, player) {
    let best = 0;
    const fx = Math.sin(a.yaw);
    const fz = Math.cos(a.yaw);
    if (player) {
      const dx = player.x - a.x;
      const dz = player.z - a.z;
      const behind = -(dx * fx + dz * fz);
      const side = dx * fz - dz * fx;
      const closing = player.speed - a.speed;
      if (behind > 0 && behind < AVOID.range && Math.abs(side) < 2 && closing >= AVOID.closing) best = closing;
    }
    for (const o of this.byLane.get(a.lane) || []) {
      if (o === a || o.mode !== 'drive' || !this.isRival(o)) continue;
      let ds = a.s - o.s;
      if (a.lane.closed && ds < 0) ds += a.lane.length;
      const closing = o.speed - a.speed;
      if (ds > 0 && ds < AVOID.range && closing >= AVOID.closing) best = Math.max(best, closing);
    }
    return best;
  }

  /**
   * A civilian with a faster car closing on it gets out of the way: over into a lane that is free
   * (`changeSafe`), slow side first, at once and without its usual signal wait; with no lane free it
   * raises the speed it aims for to `AVOID.hurry` times its wanted speed for `AVOID.hurryFor` s. Either
   * way it honks, the short warning blast.
   * @param {Agent} a @param {{ x: number, z: number, speed: number }} [player]
   */
  avoid(a, player) {
    const same = (this.net.byRoad.get(a.lane.road.id) || []).filter((l) => l.dir === a.lane.dir);
    for (const idx of [a.lane.index - 1, a.lane.index + 1]) {
      const target = same.find((l) => l.index === idx);
      if (!target || !this.changeSafe(a, target, player)) continue;
      this.beginSignal(a, this.signalSide(a, target), target);
      a.signalTimer = 0;
      this.startLaneChange(a, target);
      this.honk(a);
      return;
    }
    if (this.time >= (a.hurryUntil ?? 0)) {
      a.hurry = a.lane.limit * a.factor * AVOID.hurry;
      a.hurryUntil = this.time + AVOID.hurryFor;
    }
    this.honk(a);
  }

  /**
   * The short horn a civilian blows as it gets out of the way: once per `HORN_GAP` for each car and
   * once per `HORN_EVERY` for the street, as manners.js does. It takes the `panic` blast, because
   * manners.js is not the backend's to extend with a reason of its own.
   * @param {Agent} a
   */
  honk(a) {
    const m = this.manners;
    for (const [id, t] of this.honkAt) if (this.time - t > HORN_GAP) this.honkAt.delete(id);
    if (this.time - (this.honkAt.get(a.id) ?? -Infinity) <= HORN_GAP || this.time - m.lastHorn <= HORN_EVERY) return;
    this.honkAt.set(a.id, this.time);
    m.lastHorn = this.time;
    m.horns.push({ id: a.id, kind: a.kind.id, x: a.x, z: a.z, reason: 'panic', blast: 'short' });
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
      const obstacleAhead = (lead.v === 0 && lead.gap < 75) || (lead.gap < 38 && wanted - lead.v > 2);
      const mustLeave = (planned && distToExit > 0 && distToExit < 250) || obstacleAhead;
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
        } else if (obstacleAhead) {
          let bestRoom = Math.max(lead.gap + 15, 30);
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
          else if (lane.index + 1 < same.length) want = lane.index + 1;
          else if (lane.index - 1 >= 0) want = lane.index - 1;
        } else if (lead.gap > 70 && a.speed < wanted * 1.02 && this.slowLaneClear(a, same[lane.index - 1])) {
          want = lane.index - 1;
        }
      } else if (obstacleAhead) {
        let bestRoom = Math.max(lead.gap + 15, 30);
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
        else if (lane.index + 1 < same.length) want = lane.index + 1;
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
        if (lead.v === 0 && lead.gap < 75) a.signalTimer = Math.min(a.signalTimer, 0.4);
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
  /**
   * A car off its lane against the world: three circles along its length, like the player's car.
   * Each contact pushes it out, takes its speed into the wall with a little bounce and some
   * scrape, and spins it by where along the car it hit. A unit hit hard enough is wrecked and lost
   * to the pursuit; a free unit keeps what is left of its speed along its heading.
   * @param {Agent} a
   */
  collideWorld(a) {
    const hit = /** @type {NonNullable<TrafficSim['hitWorld']>} */ (this.hitWorld);
    const r = a.kind.width / 2;
    const reach = Math.max(0, a.kind.length / 2 - r);
    const fx = Math.sin(a.yaw);
    const fz = Math.cos(a.yaw);
    let hardest = 0;
    for (const along of [reach, 0, -reach]) {
      const c = hit(a.x + fx * along, a.z + fz * along, r, a.y);
      if (!c) continue;
      a.x += c.nx * c.depth;
      a.z += c.nz * c.depth;
      const vn = a.vx * c.nx + a.vz * c.nz;
      if (vn >= 0) continue;
      hardest = Math.max(hardest, -vn);
      const tx = -c.nz;
      const tz = c.nx;
      const vt = (a.vx * tx + a.vz * tz) * (1 - WALL_SCRAPE);
      const vOut = -vn * WALL_BOUNCE;
      a.vx = tx * vt + c.nx * vOut;
      a.vz = tz * vt + c.nz * vOut;
      // A hit at the nose or the tail turns the car; one at its middle only stops it.
      a.yawRate += WALL_SPIN * (along / a.kind.length) * (fz * c.nx - fx * c.nz) * -vn;
    }
    if (!hardest) return;
    if (a.mode === 'wreck') {
      a.speed = Math.hypot(a.vx, a.vz);
      return;
    }
    a.speed = Math.max(0, a.vx * fx + a.vz * fz);
    if (isUnit(a.kind)) {
      if (this.hurt(a, unitDamage(hardest, Infinity, a.kind.mass))) this.destroy(a);
    } else if (hardest > CIVIL_WRECK_HIT) {
      a.mode = 'wreck';
      a.wreckAge = 0;
      a.free = false;
      a.ex = a.ez = 0;
      a.changeDuration = 0;
    }
  }

  /**
   * A hit agent. A civilian or racer is wrecked by a hit over CIVIL_WRECK_HIT, else knocked off its
   * line. A unit loses hit points by the hit and what it hit (`unitDamage`) and is destroyed when they
   * are gone; short of that, in a pursuit it is only shoved and drives on free from where it was
   * pushed to, and a parked one stays put.
   * @param {Agent} a @param {number} hit closing speed, m/s @param {number} other mass of what hit it
   */
  knock(a, hit, other) {
    if (a.mode === 'wreck') return;
    if (hit < 3) return;
    if (a.mode === 'parked' && hit <= 6) return;
    const unit = isUnit(a.kind);
    if (unit ? this.hurt(a, unitDamage(hit, other, a.kind.mass)) : hit > CIVIL_WRECK_HIT) {
      if (unit) {
        this.destroy(a);
        return;
      }
      this.civilWrecks++;
      a.mode = 'wreck';
      a.wreckAge = 0;
      a.free = false;
      a.ex = a.ez = 0;
      a.changeDuration = 0;
      return;
    }
    if (a.mode === 'parked') {
      a.mode = 'knocked';
      a.knockAge = 0;
      a.ex = a.ez = 0;
      a.changeDuration = 0;
      return;
    }
    if (unit && a.pursuit) {
      if (a.mode === 'drive') a.free = true;
      return;
    }
    if (a.mode !== 'knocked') a.knockAge = 0;
    a.mode = 'knocked';
    a.ex = a.ez = 0;
    a.changeDuration = 0;
  }

  /**
   * Takes `damage` hit points from a unit. True when that leaves none.
   * @param {Agent} a @param {number} damage
   */
  hurt(a, damage) {
    if (a.destroyed) return false;
    a.hp = (a.hp ?? a.kind.hp ?? 100) - damage;
    return a.hp <= 0;
  }

  /**
   * A unit with no hit points left: it is a wreck, its bar and siren die with it, it is lost to the
   * pursuit and reported by kind for the bounty. It burns where it stops (`damage-fx.js`).
   * @param {Agent} a
   */
  destroy(a) {
    a.hp = 0;
    a.destroyed = true;
    a.pursuit = false;
    a.mode = 'wreck';
    a.wreckAge = 0;
    a.free = false;
    a.ex = a.ez = 0;
    a.changeDuration = 0;
    this.lost++;
    this.destroyed.push(a.kind.id);
  }

  /**
   * A knocked car: a free body on its tires. The sideways slide dies at the tires' grip, the driver
   * brakes, the spin settles; its place on its lane follows it so the cars behind see where it is.
   * Slow and straight enough on a lane facing its way, it drives on; stranded off every lane, it is a
   * wreck.
   * @param {Agent} a @param {number} dt
   */
  stepKnocked(a, dt) {
    a.knockAge = (a.knockAge || 0) + dt;
    const fx = Math.sin(a.yaw);
    const fz = Math.cos(a.yaw);
    let vF = a.vx * fx + a.vz * fz;
    let vL = a.vx * fz - a.vz * fx;
    vL -= Math.sign(vL) * Math.min(Math.abs(vL), KNOCK.grip * dt);
    vF -= Math.sign(vF) * Math.min(Math.abs(vF), KNOCK.brake * dt);
    a.vx = fx * vF + fz * vL;
    a.vz = fz * vF - fx * vL;
    a.yawRate *= Math.exp(-dt * KNOCK.spin);
    a.x += a.vx * dt;
    a.z += a.vz * dt;
    a.yaw += a.yawRate * dt;
    a.speed = Math.max(0, vF);
    a.brake = 1;
    if (this.groundAt) a.y = this.groundAt(a.x, a.z, a.y);
    const q = this.net.sample(a.lane, a.s, this._q);
    a.s = clamp(a.s + (a.vx * q.tx + a.vz * q.tz) * dt, 0, a.lane.length);
    if (Math.abs(vL) < KNOCK.slide && Math.abs(a.yawRate) < 0.35 && a.knockAge > 0.8) {
      const at = this.net.locate(a.x, a.z, a.yaw, a.y + 0.5, 2);
      if (at) {
        this.net.sample(at.lane, at.s, q);
        if (q.tx * fx + q.tz * fz > 0.8) {
          a.mode = 'drive';
          a.signal = 0;
          a.signalTimer = 0;
          a.signalTarget = null;
          a.speed = Math.max(0, vF);
          this.moveTo(a, at.lane, at.s, false);
          return;
        }
      }
    }
    if (a.knockAge > KNOCK.stranded) {
      a.mode = 'wreck';
      a.wreckAge = 0;
    }
  }

  /**
   * Resolves overlaps between any two agents in any mode (drive, knocked, wreck, parked) by inverse mass,
   * keeping parked units immovable below 6 m/s closing speed and knocking neither below 3 m/s.
   */
  collideAgents() {
    const n = this.agents.length;
    for (let it = 0; it < 2; it++) {
      for (let i = 0; i < n; i++) {
        const a = this.agents[i];
        for (let j = i + 1; j < n; j++) {
          const o = this.agents[j];
          if (Math.abs(o.x - a.x) > 12 || Math.abs(o.z - a.z) > 12 || Math.abs(o.y - a.y) > 2.5) continue;
          if (a.mode === 'parked' && o.mode === 'parked') continue;

          if (a.mode === 'parked') {
            const A = this.bodyOfAgent(a);
            A.mass = Infinity;
            A.inertia = Infinity;
            const B = this.bodyOfAgent(o);
            const hit = collideCars(A, B);
            if (hit <= 0) continue;
            if (hit <= 6) {
              this.applyBody(o, B);
              if (hit >= 3 && it === 0) this.knock(o, hit, a.kind.mass);
            } else {
              const Areal = this.bodyOfAgent(a);
              const Breal = this.bodyOfAgent(o);
              collideCars(Areal, Breal);
              this.applyBody(a, Areal);
              this.applyBody(o, Breal);
              if (it === 0) {
                this.knock(a, hit, o.kind.mass);
                this.knock(o, hit, a.kind.mass);
              }
            }
          } else if (o.mode === 'parked') {
            const A = this.bodyOfAgent(a);
            const B = this.bodyOfAgent(o);
            B.mass = Infinity;
            B.inertia = Infinity;
            const hit = collideCars(A, B);
            if (hit <= 0) continue;
            if (hit <= 6) {
              this.applyBody(a, A);
              if (hit >= 3 && it === 0) this.knock(a, hit, o.kind.mass);
            } else {
              const Areal = this.bodyOfAgent(a);
              const Breal = this.bodyOfAgent(o);
              collideCars(Areal, Breal);
              this.applyBody(a, Areal);
              this.applyBody(o, Breal);
              if (it === 0) {
                this.knock(a, hit, o.kind.mass);
                this.knock(o, hit, a.kind.mass);
              }
            }
          } else {
            const A = this.bodyOfAgent(a);
            const B = this.bodyOfAgent(o);
            const hit = collideCars(A, B);
            if (hit <= 0) continue;
            this.applyBody(a, A);
            this.applyBody(o, B);
            if (hit >= 3 && it === 0) {
              this.knock(a, hit, o.kind.mass);
              this.knock(o, hit, a.kind.mass);
            }
          }
        }
      }
    }
  }

  /** @param {Agent} a */
  bodyOfAgent(a) {
    return {
      x: a.x, z: a.z, yaw: a.yaw, vx: a.vx, vz: a.vz, yawRate: a.yawRate,
      mass: a.kind.mass, inertia: a.inertia, width: a.kind.width, length: a.kind.length, offset: 0,
    };
  }

  /** @param {Agent} a @param {ReturnType<TrafficSim['bodyOfAgent']>} b */
  applyBody(a, b) {
    const oldX = a.x;
    const oldZ = a.z;
    a.x = b.x;
    a.z = b.z;
    a.vx = b.vx;
    a.vz = b.vz;
    a.yawRate = b.yawRate;
    // What the hit left of its speed along its heading is what it drives on with.
    a.speed = a.mode === 'wreck' ? Math.hypot(a.vx, a.vz) : Math.max(0, a.vx * Math.sin(a.yaw) + a.vz * Math.cos(a.yaw));
    if (a.mode === 'drive' && a.lane) {
      const q = this.net.sample(a.lane, a.s, this._q);
      const dx = a.x - oldX;
      const dz = a.z - oldZ;
      const ds = dx * q.tx + dz * q.tz;
      const dex = dx - ds * q.tx;
      const dez = dz - ds * q.tz;
      a.s = clamp(a.s + ds, 0, a.lane.length);
      a.ex += dex;
      a.ez += dez;
      if (a.changeDuration > 0) {
        a.changeStartX += dex;
        a.changeStartZ += dez;
        a.changePrevEx += dex;
        a.changePrevEz += dez;
      }
    }
  }

  stepWreck(a, dt) {
    // A wreck sits with its hazards on both sides until it fades.
    a.signal = 2;
    a.signalTimer = 0;
    a.signalTarget = null;
    a.wreckAge += dt;
    // A wreck scrubs off its speed at about the grip of sliding tires (0.7 g), so one hit on the
    // expressway slides a long way instead of stopping dead.
    const drag = Math.exp(-dt * 0.15);
    a.vx *= drag;
    a.vz *= drag;
    a.yawRate *= Math.exp(-dt * 1.4);
    const sp = Math.hypot(a.vx, a.vz);
    if (sp > 0.05) {
      const brake = Math.min(sp, 6.8 * dt);
      a.vx -= (a.vx / sp) * brake;
      a.vz -= (a.vz / sp) * brake;
    } else {
      a.vx = a.vz = 0;
    }
    a.x += a.vx * dt;
    a.z += a.vz * dt;
    a.yaw += a.yawRate * dt;
    a.speed = Math.hypot(a.vx, a.vz);
    if (this.groundAt && a.speed > 0.05) a.y = this.groundAt(a.x, a.z, a.y);
    if (a.wreckAge > WRECK_TIME - 3) a.fade = Math.max(0, (WRECK_TIME - a.wreckAge) / 3);
    // A burnt-out unit is dark: no brake lamps, no hazards.
    a.brake = a.destroyed ? 0 : 1;
    if (a.destroyed) a.signal = 0;
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
      if (a.mode === 'parked') {
        const body = this.bodyOfAgent(a);
        body.mass = Infinity;
        body.inertia = Infinity;
        const hit = collideCars(me, body);
        if (hit <= 0) continue;
        hardest = Math.max(hardest, hit);
        if (hit > 6) {
          const bodyReal = this.bodyOfAgent(a);
          collideCars(me, bodyReal);
          this.applyBody(a, bodyReal);
          if (isUnit(a.kind)) this.policeHit += hit;
          this.knock(a, hit, spec.mass);
        }
      } else {
        const body = this.bodyOfAgent(a);
        const hit = collideCars(me, body);
        if (hit <= 0) continue;
        hardest = Math.max(hardest, hit);
        this.applyBody(a, body);
        if (isUnit(a.kind)) this.policeHit += hit;
        this.knock(a, hit, spec.mass);
      }
    }
    return hardest;
  }
}
