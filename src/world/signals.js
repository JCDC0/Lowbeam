/**
 * The traffic signals at every crossing the traffic net lights (`TrafficNet.nodes`), Japanese
 * style: for each way into the crossing, a pole on the far left corner with an arm out over the
 * road and a horizontal head of three lamps, blue-green, amber and red from the left, facing the
 * cars that stop for it. The lamps follow `lightState`, the same phases the traffic obeys. Pure:
 * placement only; build-signals.js draws them.
 */

import { lightState } from '../traffic/net.js';

/**
 * The head's height over the road and its width, the pole's radius, how far past the crossing's
 * far edge the pole stands and the shortest arm.
 */
export const SIGNAL = { height: 5.3, head: 1.25, pole: 0.13, past: 2.2, minArm: 1.2 };

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
      const side = hw + Math.max(1, road.walk) * 0.5;
      const px = cx + lx * side;
      const pz = cz + lz * side;
      // A pole never stands in a carriageway: where the corner is another road's, no signal.
      if (ground.roads.query(px, pz, hit, 0) && Math.abs(hit.d) < hit.road.hwAt(hit.s) + 0.3) continue;
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
