/**
 * The traffic signals at every crossing the traffic net lights (`TrafficNet.nodes`), Japanese
 * style: for each way into the crossing, a pole on the far left corner with an arm out over the
 * road and a horizontal head of three lamps, blue-green, amber and red from the left, facing the
 * cars that stop for it. The lamps follow `lightState`, the same phases the traffic obeys. Pure:
 * placement only; build-signals.js draws them.
 */

import { buildTurn, lightState } from '../traffic/net.js';
import { ELEVATED } from './roads.js';

/**
 * The head's height over the road and its width, the pole's radius, how far past the crossing's
 * far edge the pole stands, the shortest arm, how far a pole keeps from the edge of every lane and of
 * every path a car takes through a crossing, and how many 0.6 m steps back from the road it may take
 * to find that room. The clearance was once 1.3 m from a lane's center line, which is inside a 3 m
 * lane: 92 poles stood where cars drive.
 */
export const SIGNAL = { height: 5.3, head: 1.25, pole: 0.13, past: 2.2, minArm: 1.2, clear: 0.6, steps: 6 };

const CELL = 6;

/**
 * Where the cars drive: every lane, and every curve a car takes off its lane through a junction or onto
 * an exit (`buildTurn`, the curve the traffic follows), sampled, each sample with its height and the
 * half width of its lane. The answer says whether a point keeps `margin` meters clear of the edge of
 * all of them at its height (a deck's lanes do not count for the street under it).
 * @param {import('../traffic/net.js').TrafficNet} net
 * @returns {(x: number, z: number, y: number, margin: number) => boolean}
 */
export function drivePaths(net) {
  /** @type {Map<string, number[]>} */
  const grid = new Map();
  const put = (/** @type {number} */ x, /** @type {number} */ z, /** @type {number} */ y, /** @type {number} */ half) => {
    const k = `${Math.floor(x / CELL)},${Math.floor(z / CELL)}`;
    let a = grid.get(k);
    if (!a) grid.set(k, (a = []));
    a.push(x, z, y, half);
  };
  const q = { x: 0, z: 0, tx: 0, tz: 1, y: 0 };
  const q2 = { x: 0, z: 0, tx: 0, tz: 1, y: 0 };
  for (const lane of net.lanes) {
    const half = lane.width / 2;
    // The last sample sits on the lane's end, which is often at a corner where a pole would go.
    const n = Math.max(1, Math.ceil(lane.length / 1.5));
    for (let i = 0; i <= n; i++) {
      net.sample(lane, (lane.length * i) / n, q);
      put(q.x, q.z, q.y, half);
    }
    for (const m of lane.mids) {
      net.sample(lane, m.at, q);
      net.sample(m.lane, m.toS, q2);
      const curve = buildTurn(q, q2);
      const mh = Math.max(lane.width, m.lane.width) / 2;
      const n = Math.max(1, Math.ceil(curve.length));
      for (let i = 0; i <= n; i++) {
        const p = curve.at(i / n);
        put(p.x, p.z, p.y, mh);
      }
    }
  }
  return (x, z, y, margin) => {
    const cx = Math.floor(x / CELL);
    const cz = Math.floor(z / CELL);
    for (let i = -1; i <= 1; i++) {
      for (let j = -1; j <= 1; j++) {
        const a = grid.get(`${cx + i},${cz + j}`);
        if (!a) continue;
        for (let k = 0; k < a.length; k += 4) {
          if (Math.abs(a[k + 2] - y) > 4) continue;
          if (Math.hypot(a[k] - x, a[k + 1] - z) < a[k + 3] + margin) return false;
        }
      }
    }
    return true;
  };
}

/**
 * @typedef {{ x: number, y: number, z: number, yaw: number, px: number, py: number, pz: number,
 *   arm: number, node: import('../traffic/net.js').LightNode, axis: 0 | 1, road: string, dir: 1 | -1 }} Signal
 * The head's center (x, y, z), facing the cars that come up to it (`yaw` is their direction of
 * travel, the head looks back along it); the pole's foot (px, py, pz); the arm's length from the
 * pole to the head's far end; the road and the direction of the cars it stops.
 */

/**
 * @param {import('../traffic/net.js').TrafficNet} net
 * @param {import('./ground.js').Ground} ground
 * @returns {Signal[]}
 */
export function placeSignals(net, ground) {
  /** @type {Signal[]} */
  const out = [];
  const seen = new Set();
  const o = { x: 0, z: 0, tx: 0, tz: 1, y: 0 };
  // Every lane and every curve through a crossing, of every road (not only the crossing's own), so a
  // pole is never put where any car drives.
  const free = drivePaths(net);
  const clear = (/** @type {number} */ x, /** @type {number} */ z, /** @type {number} */ y) => free(x, z, y, SIGNAL.clear + SIGNAL.pole);
  const hit = { road: null, s: 0, d: 0, h: 0, edge: 0 };
  for (const lane of net.lanes) {
    for (const stop of lane.stops) {
      const node = stop.node;
      if (!node || stop.axis === undefined) continue;
      // A street that ends at a T has a stop on its outgoing lanes too, before their start.
      if (stop.s < 1 || stop.s > lane.length - 1) continue;
      const key = `${net.nodes.indexOf(node)}:${lane.road.id}:${lane.dir}`;
      if (seen.has(key)) continue;
      seen.add(key);
      net.sample(lane, stop.s, o);
      const ds = (node.x - o.x) * o.tx + (node.z - o.z) * o.tz;
      if (ds < 3 || ds > 40) continue;
      const y = o.y;
      // Past the crossing's far edge along the lane itself, so a ring road's curve is followed; a
      // street that ends at the crossing carries on straight from its end.
      const along = 2 * ds - 3.5 + SIGNAL.past;
      const fs = lane.closed ? stop.s + along : Math.min(stop.s + along, lane.length);
      net.sample(lane, fs, o);
      const extra = stop.s + along - fs;
      const lx = o.tz;
      const lz = -o.tx;
      const cx = o.x - lx * lane.offset + o.tx * extra;
      const cz = o.z - lz * lane.offset + o.tz * extra;
      const road = lane.road;
      const ps = net.laneS(lane, fs);
      const hw = road.hwAt(road.path.closed ? road.path.wrapS(ps) : ps);
      let side = hw + Math.max(1, road.walk) * 0.5;
      let px = cx + lx * side;
      let pz = cz + lz * side;
      // In a carriageway at the pole's own height, so the street under a deck counts and not the deck.
      // This asks the nearest road only; `clear` asks every lane of every road.
      const inRoad = () => !!(ground.roads.query(px, pz, hit, 0, -Infinity, y + 1.5) && Math.abs(hit.d) < hit.road.hwAt(hit.s) + 0.3);
      // A pole never stands where a car drives: it steps back from the road, or there is none. The
      // lanes are compared at the height of the pole's foot, not of the lane it serves.
      const foot = () => ground.at(px, pz, y + 1.5).h;
      if (inRoad()) continue;
      for (let k = 0; k < SIGNAL.steps && !clear(px, pz, foot()); k++) {
        side += 0.6;
        px = cx + lx * side;
        pz = cz + lz * side;
      }
      if (inRoad() || !clear(px, pz, foot())) continue;
      const head = hw / 2;
      const x = cx + lx * head;
      const z = cz + lz * head;
      const py = ground.at(px, pz, y + 1.5).h;
      out.push({ x, y: y + SIGNAL.height, z, yaw: Math.atan2(o.tx, o.tz), px, py, pz,
        arm: Math.max(SIGNAL.minArm, side - head + SIGNAL.head / 2), node, axis: stop.axis, road: road.id, dir: lane.dir });
    }
  }
  return out;
}

/** Which lamp of a signal is lit at time t: 0 blue-green, 1 amber, 2 red. @param {Signal} s @param {number} t */
export function litLamp(s, t) {
  const state = lightState(s.node, s.axis, t);
  return state === 'green' ? 0 : state === 'yellow' ? 1 : 2;
}

/**
 * The solid foot of each pole, for the colliders. A pole standing under a deck (the Kurogane Line
 * over Kurogane-dori) ends under its slab, so it stops the traffic below and not a car driving on the
 * deck above, which an unbounded circle did.
 * @param {Signal[]} signals @param {import('./ground.js').Ground} ground
 * @returns {import('./scatter.js').Circle[]}
 */
export function signalCircles(signals, ground) {
  const hit = { road: null, s: 0, d: 0, h: 0, edge: 0, lift: 0 };
  return signals.map((s) => {
    /** @type {import('./scatter.js').Circle} */
    const c = { x: s.px, z: s.pz, r: SIGNAL.pole + 0.05 };
    if (ground.roads.query(s.px, s.pz, hit, 0, -Infinity, Infinity) && hit.lift > ELEVATED && hit.edge <= 0.5 && hit.h > s.py + 2.5) c.y1 = hit.h - 1.0;
    return c;
  });
}
