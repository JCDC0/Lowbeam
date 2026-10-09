/**
 * The traffic signals at every crossing the traffic net lights (`TrafficNet.nodes`), Japanese
 * style: for each way into the crossing, a pole on the far left corner with an arm out over the
 * road and a horizontal head of three lamps, blue-green, amber and red from the left, facing the
 * cars that stop for it. The lamps follow `lightState`, the same phases the traffic obeys. Pure:
 * placement only; build-signals.js draws them.
 */

import { lightState } from '../traffic/net.js';
import { ELEVATED } from './roads.js';

/**
 * The head's height over the road and its width, the pole's radius, how far past the crossing's
 * far edge the pole stands, the shortest arm, and how far a pole keeps from every lane's center line
 * (a wide car's half width, the pole and a margin).
 */
export const SIGNAL = { height: 5.3, head: 1.25, pole: 0.13, past: 2.2, minArm: 1.2, clear: 1.3 };

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
  // The lanes through each crossing, sampled every 1.5 m from before its stop to 48 m after, so a
  // pole is never put where another road's lane passes the corner.
  /** @type {Map<any, { lane: any, s: number }[]>} */
  const through = new Map();
  for (const lane of net.lanes) {
    for (const stop of lane.stops) {
      if (!stop.node || stop.axis === undefined) continue;
      let list = through.get(stop.node);
      if (!list) through.set(stop.node, (list = []));
      list.push({ lane, s: stop.s });
    }
  }
  /** @type {Map<any, Float32Array>} */
  const lanePoints = new Map();
  const around = (/** @type {any} */ node) => {
    let a = lanePoints.get(node);
    if (a) return a;
    /** @type {number[]} */
    const v = [];
    const q = { x: 0, z: 0, tx: 0, tz: 1, y: 0 };
    for (const { lane, s } of through.get(node) || []) {
      for (let t = Math.max(0, s - 6); t <= Math.min(lane.length, s + 48); t += 1.5) {
        net.sample(lane, t, q);
        v.push(q.x, q.z);
      }
    }
    lanePoints.set(node, (a = new Float32Array(v)));
    return a;
  };
  const clear = (/** @type {any} */ node, /** @type {number} */ x, /** @type {number} */ z) => {
    const a = around(node);
    for (let i = 0; i < a.length; i += 2) if (Math.hypot(a[i] - x, a[i + 1] - z) < SIGNAL.clear) return false;
    return true;
  };
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
      const inRoad = () => ground.roads.query(px, pz, hit, 0) && Math.abs(hit.d) < hit.road.hwAt(hit.s) + 0.3;
      // A pole never stands in a carriageway: where the corner is another road's, no signal. Nor
      // where a lane of the crossing road passes: it steps back from the road, or there is none.
      if (inRoad()) continue;
      for (let k = 0; k < 4 && !clear(node, px, pz); k++) {
        side += 0.6;
        px = cx + lx * side;
        pz = cz + lz * side;
      }
      if (inRoad() || !clear(node, px, pz)) continue;
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
