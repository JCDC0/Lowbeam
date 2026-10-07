/**
 * The traffic network: every road as directed lanes, and how a car on one lane can get to
 * another. Pure, no three.js. Traffic keeps left (a lane's offset is positive to the left of
 * its travel), roads with `oneway` have a single direction, and two-way roads give one set
 * of lanes per direction.
 *
 * A lane is parameterised by `s`, meters along its own direction of travel. Links say where
 * a car on that lane may move to another: at the lane's end (continuing round a bend, a
 * ramp that meets an avenue) or part-way along it (an exit ramp, a turn at a crossing).
 * Crossings of city streets also get traffic lights.
 */

import { clamp } from '../core/mathx.js';

/** @typedef {import('../world/roads.js').Road} Road */
/**
 * @typedef {{ lane: Lane, at: number, toS: number, kind: 'end' | 'exit' | 'turn', weight: number }} Link
 * @typedef {{
 *   id: string, road: Road, dir: 1 | -1, index: number, offset: number, length: number, limit: number,
 *   cls: string, oneway: boolean, closed: boolean, width: number,
 *   ends: Link[], mids: Link[], stops: Stop[]
 * }} Lane
 * @typedef {{ s: number, node?: LightNode, axis?: 0 | 1, yield?: { lanes: Lane[], at: number } }} Stop
 * @typedef {{
 *   x: number, z: number, offset: number,
 *   _axes?: Map<string, 0 | 1>,
 *   _dirs?: Map<0 | 1, { tx: number, tz: number }>
 * }} LightNode
 */

const LANE_WIDTH = 3.5;
/** How near an end of a road must be to another road to join it, meters. */
const JOIN = 12;
const CYCLE = { green: 13, yellow: 2.2 };

/** Light phase for an axis at time t: 'green', 'yellow' or 'red'. @param {LightNode} [node] @param {0 | 1} [axis] @param {number} [t] */
export function lightState(node, axis, t = 0) {
  if (!node || axis === undefined) return 'green';
  const period = 2 * (CYCLE.green + CYCLE.yellow);
  let u = (t + node.offset) % period;
  if (axis === 1) u = (u + period / 2) % period;
  if (u < CYCLE.green) return 'green';
  if (u < CYCLE.green + CYCLE.yellow) return 'yellow';
  return 'red';
}

export class TrafficNet {
  /** @param {import('../world/roads.js').RoadNetwork} network */
  constructor(network) {
    this.network = network;
    /** @type {Lane[]} */
    this.lanes = [];
    /** @type {Map<string, Lane[]>} */
    this.byRoad = new Map();
    /** @type {LightNode[]} */
    this.nodes = [];
    for (const road of network.roads) this.addLanes(road);
    for (const road of network.roads) this.linkRoadEnds(road);
    for (const road of network.roads) if (road.def.link) this.linkRamp(road);
    this.linkCrossings();
    /** Total lane length, meters. */
    this.length = this.lanes.reduce((a, l) => a + l.length, 0);
  }

  /** @param {Road} road */
  addLanes(road) {
    const def = road.def;
    const oneway = !!def.oneway;
    const total = def.lanes || (oneway ? 1 : 2);
    const per = oneway ? total : Math.max(1, Math.round(total / 2));
    /** @type {Lane[]} */
    const list = [];
    for (const dir of /** @type {(1 | -1)[]} */ (oneway ? [1] : [1, -1])) {
      for (let i = 0; i < per; i++) {
        const width = oneway ? (2 * road.hw) / per : road.hw / per;
        const offset = road.hw - (i + 0.5) * width;
        list.push({
          id: `${road.id}:${dir > 0 ? 'f' : 'r'}${i}`,
          road, dir, index: i, offset, width,
          length: road.path.length,
          limit: (def.limit || 50) / 3.6,
          cls: def.cls || 'street',
          oneway,
          closed: road.path.closed,
          ends: [], mids: [], stops: [],
        });
      }
    }
    this.byRoad.set(road.id, list);
    this.lanes.push(...list);
  }

  /** @param {string} roadId @param {1 | -1} dir @param {number} [index] */
  lane(roadId, dir, index = 0) {
    return (this.byRoad.get(roadId) || []).find((l) => l.dir === dir && l.index === index);
  }

  /**
   * Position, unit travel tangent and height of a lane at arc length s.
   * @param {Lane} lane @param {number} s
   * @param {{ x: number, z: number, tx: number, tz: number, y: number }} out
   */
  sample(lane, s, out) {
    const p = lane.road.path;
    const ps = lane.dir > 0 ? s : p.length - s;
    const q = _q;
    p.sample(lane.closed ? p.wrapS(ps) : clamp(ps, 0, p.length), q);
    const tx = lane.dir * q.tx;
    const tz = lane.dir * q.tz;
    out.x = q.x + tz * lane.offset;
    out.z = q.z - tx * lane.offset;
    out.tx = tx;
    out.tz = tz;
    out.y = lane.road.heightAt(lane.closed ? p.wrapS(ps) : clamp(ps, 0, p.length));
    return out;
  }

  /** Lane arc length for a position `ps` along the road's own path. @param {Lane} lane @param {number} ps */
  laneS(lane, ps) {
    return lane.dir > 0 ? ps : lane.road.path.length - ps;
  }

  /**
   * Every lane of the road under (x, z), with its arc length there: where a car standing at that
   * point could be met. `y` keeps a car under a deck from finding the road on top; `reach` lets a
   * point just off the road find it. Empty when no road is near.
   * @param {number} x @param {number} z @param {number} [y] @param {number} [reach]
   * @returns {{ lane: Lane, s: number }[]}
   */
  lanesAt(x, z, y = -Infinity, reach = 0) {
    if (!this.network.query(x, z, _hit, reach, -Infinity, y)) return [];
    const ps = _hit.s;
    return (this.byRoad.get(_hit.road.id) || []).map((lane) => ({ lane, s: this.laneS(lane, ps) }));
  }

  /**
   * The lane a car at (x, z) heading `yaw` is driving in: on the road under it, the direction
   * that matches its heading and the lane nearest its offset. Null off the road.
   * @param {number} x @param {number} z @param {number} yaw @param {number} [y] @param {number} [reach]
   * @returns {{ lane: Lane, s: number } | null}
   */
  locate(x, z, yaw, y = -Infinity, reach = 0) {
    let best = null;
    let bd = Infinity;
    const hx = Math.sin(yaw);
    const hz = Math.cos(yaw);
    for (const c of this.lanesAt(x, z, y, reach)) {
      this.sample(c.lane, c.s, _s);
      const back = _s.tx * hx + _s.tz * hz < 0 ? 100 : 0;
      const d = Math.hypot(_s.x - x, _s.z - z) + back;
      if (d < bd) {
        bd = d;
        best = c;
      }
    }
    return best;
  }

  /**
   * The shortest drive on the lanes from (lane, s) to any of `goals`: Dijkstra over the links (a
   * turn, an exit, the end of a lane), with a U-turn onto the other direction of a two-way road
   * costing `uturn` meters when it is given. Returns the cost in meters and the first move: the
   * link to take, a U-turn, or null when the goal is straight ahead on this lane. Null when no
   * goal is within `maxCost`.
   * @param {Lane} lane @param {number} s @param {{ lane: Lane, s: number }[]} goals
   * @param {{ maxCost?: number, uturn?: number }} [opts]
   * @returns {{ cost: number, first: null | { link: Link } | { uturn: Lane, s: number } } | null}
   */
  route(lane, s, goals, { maxCost = 2500, uturn = 0 } = {}) {
    if (!goals.length) return null;
    /** @type {Map<Lane, number[]>} */
    const goalAt = new Map();
    for (const g of goals) {
      const list = goalAt.get(g.lane);
      if (list) list.push(g.s);
      else goalAt.set(g.lane, [g.s]);
    }
    const heap = new MinHeap();
    /** @type {Map<string, number>} */
    const best = new Map();
    heap.push(0, { lane, s, first: null, done: false });
    let pops = 0;
    while (heap.size && pops++ < ROUTE_POPS) {
      const [cost, st] = heap.pop();
      if (cost > maxCost) return null;
      if (st.done) return { cost, first: st.first };
      const L = st.lane;
      const key = `${L.id}|${Math.round(st.s / 15)}`;
      if ((best.get(key) ?? Infinity) <= cost) continue;
      best.set(key, cost);
      const ahead = (at) => {
        let ds = at - st.s;
        if (L.closed && ds < 0) ds += L.length;
        return ds;
      };
      for (const gs of goalAt.get(L) || []) {
        const ds = ahead(gs);
        if (ds >= -3) heap.push(cost + Math.max(0, ds), { lane: L, s: gs, first: st.first, done: true });
      }
      for (const link of L.mids) {
        const ds = ahead(link.at);
        if (ds >= 0) heap.push(cost + ds + TURN_COST, { lane: link.lane, s: link.toS, first: st.first || { link }, done: false });
      }
      for (const link of L.ends) {
        const ds = ahead(link.at);
        if (ds >= 0) heap.push(cost + ds + TURN_COST, { lane: link.lane, s: link.toS, first: st.first || { link }, done: false });
      }
      if (uturn && !L.oneway) {
        const back = this.lane(L.road.id, L.dir > 0 ? -1 : 1, 0);
        if (back) {
          const bs = L.length - st.s;
          heap.push(cost + uturn, { lane: back, s: bs, first: st.first || { uturn: back, s: bs }, done: false });
        }
      }
    }
    return null;
  }

  /** The lanes that can be entered from a point on another road's centerline, near `ps`. */
  joinTargets(road, ps, arrive, limit = -0.3) {
    const out = [];
    for (const lane of this.byRoad.get(road.id) || []) {
      if (lane.index !== 0) continue;
      const s = this.laneS(lane, ps);
      // A lane that ends right here leads nowhere: only lanes with road ahead can be entered.
      if (!lane.closed && lane.length - s < 15) continue;
      this.sample(lane, s, _s);
      if (_s.tx * arrive.tx + _s.tz * arrive.tz < limit) continue;
      out.push({ lane, s });
    }
    return out;
  }

  /** Joins at the ends of a road to other roads that start, end or pass nearby. @param {Road} road */
  linkRoadEnds(road) {
    if (road.path.closed) {
      for (const lane of this.byRoad.get(road.id) || []) lane.ends.push({ lane, at: lane.length, toS: 0, kind: 'end', weight: 1 });
      return;
    }
    const cls = road.def.cls;
    for (const lane of this.byRoad.get(road.id) || []) {
      this.sample(lane, lane.length, _a);
      const arrive = { tx: _a.tx, tz: _a.tz };
      const endS = lane.dir > 0 ? road.path.length : 0;
      const pEnd = road.path.sample(endS, _q2);
      const hEnd = road.heightAt(endS);
      for (const other of this.network.roads) {
        if (other === road || other.id === road.def.twin || other.def.cls === 'expressway') continue;
        if (cls === 'ramp' && road.def.link && other.id === road.def.link.from.id) continue;
        const hit = other.path.nearest(pEnd.x, pEnd.z);
        // Heights, not lifts: a road ending under a deck must not join it, but an elevated road
        // ending on a ramp lifted to meet it (the Kurogane Line) must.
        if (Math.hypot(pEnd.x - hit.x, pEnd.z - hit.z) > JOIN || Math.abs(other.heightAt(hit.s) - hEnd) > 2) continue;
        const nearEnd = hit.s < JOIN || other.path.length - hit.s < JOIN;
        if (!nearEnd && other.def.cls !== 'ramp') {
          const throughLanes = this.byRoad.get(other.id) || [];
          const stopS = Math.max(0, lane.length - (other.hw + 3.5));
          if (!lane.stops.some((st) => st.yield && Math.abs(st.s - stopS) < 5)) {
            lane.stops.push({ s: stopS, yield: { lanes: throughLanes, at: hit.s } });
          }
          for (const tl of throughLanes) {
            if (tl.index !== 0) continue;
            const targetS = this.laneS(tl, hit.s);
            if (!lane.ends.some((e) => e.lane === tl)) {
              lane.ends.push({ lane: tl, at: lane.length, toS: targetS, kind: 'turn', weight: 0.5 });
            }
          }
          const departLane = this.lane(road.id, lane.dir > 0 ? -1 : 1, 0);
          if (departLane) {
            for (const tl of throughLanes) {
              if (tl.index !== 0) continue;
              const throughS = this.laneS(tl, hit.s);
              if (!tl.mids.some((m) => m.lane === departLane && Math.abs(m.at - (throughS - 2)) < 15)) {
                tl.mids.push({ lane: departLane, at: Math.max(0, throughS - 2), toS: 3, kind: 'turn', weight: 0.14 });
              }
            }
          }
        } else {
          const turnLimit = Math.hypot(pEnd.x - hit.x, pEnd.z - hit.z) < 2 && (hit.s < 3 || other.path.length - hit.s < 3) ? -0.95 : -0.3;
          for (const t of this.joinTargets(other, hit.s, arrive, turnLimit)) {
            lane.ends.push({ lane: t.lane, at: lane.length, toS: t.s, kind: 'end', weight: 1 });
          }
        }
      }
    }
  }

  /**
   * A ramp's two joins: the exit ramp leaves the left lane of its carriageway part-way along it,
   * the entry ramp merges into that lane at the end.
   * @param {Road} ramp
   */
  linkRamp(ramp) {
    const link = /** @type {NonNullable<typeof ramp.def.link>} */ (ramp.def.link);
    const rl = this.lane(ramp.id, 1, 0);
    if (!rl) return;
    const from = this.network.byId.get(link.from.id);
    const to = this.network.byId.get(link.to.id);
    if (!from || !to) return;
    if (from.def.cls === 'expressway') {
      const cl = this.lane(from.id, 1, 0);
      const atEnd = !from.path.closed && link.from.s >= from.path.length - 1;
      if (cl && !atEnd) cl.mids.push({ lane: rl, at: this.laneS(cl, link.from.s), toS: 0, kind: 'exit', weight: 0.22 });
    } else {
      for (const dir of /** @type {const} */ ([1, -1])) {
        const al = this.lane(from.id, dir, 0);
        if (al) al.mids.push({ lane: rl, at: this.laneS(al, link.from.s) - 6, toS: 0, kind: 'turn', weight: 0.2 });
      }
    }
    if (to.def.cls === 'expressway') {
      const cl = this.lane(to.id, 1, 0);
      if (cl) {
        rl.ends.length = 0;
        rl.ends.push({ lane: cl, at: rl.length, toS: this.laneS(cl, link.to.s), kind: 'end', weight: 1 });
      }
    }
  }

  /** Turns and traffic lights where city streets and surface arterials cross. */
  linkCrossings() {
    const surfaceRoads = this.network.roads.filter(
      (r) => !r.def.oneway && (r.def.cls === 'street' || r.def.cls === 'arterial')
    );
    const pts = surfaceRoads.map((r) => {
      const a = [];
      for (let s = 0; s < r.path.length; s += 8) {
        const q = r.path.sample(s);
        a.push([q.x, q.z, s]);
      }
      if (a.length === 0 || a[a.length - 1][2] < r.path.length) {
        const q = r.path.sample(r.path.length);
        a.push([q.x, q.z, r.path.length]);
      }
      return a;
    });
    const ccw = (a, b, c) => (c[1] - a[1]) * (b[0] - a[0]) > (b[1] - a[1]) * (c[0] - a[0]);
    const cross = (a, b, c, d) => ccw(a, c, d) !== ccw(b, c, d) && ccw(a, b, c) !== ccw(a, b, d);

    /** @type {{ ra: Road, sa: number, rb: Road, sb: number, x: number, z: number }[]} */
    const intersections = [];

    for (let a = 0; a < surfaceRoads.length; a++) {
      for (let b = a + 1; b < surfaceRoads.length; b++) {
        const ra = surfaceRoads[a];
        const rb = surfaceRoads[b];
        for (let i = 0; i + 1 < pts[a].length; i++) {
          for (let j = 0; j + 1 < pts[b].length; j++) {
            const A = pts[a][i];
            const B = pts[a][i + 1];
            const C = pts[b][j];
            const D = pts[b][j + 1];
            if (Math.abs(A[0] - C[0]) > 20 || Math.abs(A[1] - C[1]) > 20 || !cross(A, B, C, D)) continue;
            const hitA = ra.path.nearest(A[0], A[1], undefined, Math.round((A[2] - 12) / 2), Math.round((A[2] + 20) / 2));
            const hitB = rb.path.nearest(C[0], C[1], undefined, Math.round((C[2] - 12) / 2), Math.round((C[2] + 20) / 2));
            if (ra.liftAt(hitA.s) > 2 || rb.liftAt(hitB.s) > 2) continue;
            intersections.push({ ra, sa: hitA.s, rb, sb: hitB.s, x: hitA.x, z: hitA.z });
          }
        }
      }
    }

    for (const ix of intersections) {
      let node = this.nodes.find((n) => Math.hypot(n.x - ix.x, n.z - ix.z) < 25);
      if (!node) {
        node = {
          x: ix.x,
          z: ix.z,
          offset: (this.nodes.length * 5.3) % 30,
          _axes: new Map(),
          _dirs: new Map(),
        };
        this.nodes.push(node);
      }
      if (!node._axes) {
        node._axes = new Map();
        node._dirs = new Map();
      }

      const getAxis = (road, s) => {
        if (node._axes.has(road.id)) return node._axes.get(road.id);
        const q = road.path.sample(s);
        if (node._axes.size === 0) {
          node._axes.set(road.id, 0);
          node._dirs.set(0, { tx: q.tx, tz: q.tz });
          return 0;
        }
        if (!node._dirs.has(1)) {
          node._axes.set(road.id, 1);
          node._dirs.set(1, { tx: q.tx, tz: q.tz });
          return 1;
        }
        const d0 = node._dirs.get(0);
        const d1 = node._dirs.get(1);
        const dot0 = Math.abs(d0.tx * q.tx + d0.tz * q.tz);
        const dot1 = Math.abs(d1.tx * q.tx + d1.tz * q.tz);
        const axis = dot0 >= dot1 ? 0 : 1;
        node._axes.set(road.id, axis);
        return axis;
      };

      const axisA = getAxis(ix.ra, ix.sa);
      const axisB = getAxis(ix.rb, ix.sb);

      const arms = [
        { road: ix.ra, ps: ix.sa, axis: axisA, crossRoad: ix.rb, cps: ix.sb },
        { road: ix.rb, ps: ix.sb, axis: axisB, crossRoad: ix.ra, cps: ix.sa },
      ];
      for (const { road, ps, axis, crossRoad, cps } of arms) {
        for (const lane of this.byRoad.get(road.id) || []) {
          const s = this.laneS(lane, ps);
          const stopS = s - (crossRoad.hw + 3.5);
          if (!lane.stops.some((st) => st.node === node && Math.abs(st.s - stopS) < 15)) {
            lane.stops.push({ s: stopS, node, axis });
          }
          this.sample(lane, s, _a);
          for (const other of this.byRoad.get(crossRoad.id) || []) {
            if (other.index !== 0) continue;
            const so = this.laneS(other, cps);
            this.sample(other, so, _s);
            const dot = _a.tx * _s.tx + _a.tz * _s.tz;
            if (Math.abs(dot) > 0.85) continue;
            if (!lane.mids.some((m) => m.lane === other && Math.abs(m.at - (s - 2)) < 15)) {
              lane.mids.push({ lane: other, at: s - 2, toS: so + 3, kind: 'turn', weight: 0.14 });
            }
          }
        }
      }
    }

    for (const lane of this.lanes) lane.stops.sort((a, b) => a.s - b.s);
  }
}

/** Meters a turn costs on top of its length, so a route does not zigzag for nothing. */
const TURN_COST = 8;
/** States a route search may expand before it gives up. */
const ROUTE_POPS = 6000;

/** A binary min-heap of [cost, item] pairs. */
class MinHeap {
  constructor() {
    /** @type {[number, any][]} */
    this.a = [];
  }

  get size() {
    return this.a.length;
  }

  /** @param {number} cost @param {any} item */
  push(cost, item) {
    const a = this.a;
    a.push([cost, item]);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p][0] <= a[i][0]) break;
      [a[p], a[i]] = [a[i], a[p]];
      i = p;
    }
  }

  /** @returns {[number, any]} */
  pop() {
    const a = this.a;
    const top = a[0];
    const last = /** @type {[number, any]} */ (a.pop());
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && a[l][0] < a[m][0]) m = l;
        if (r < a.length && a[r][0] < a[m][0]) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]];
        i = m;
      }
    }
    return top;
  }
}

/** @type {import('../world/roads.js').RoadHit} */
const _hit = { road: /** @type {any} */ (null), s: 0, d: 0, h: 0, edge: 0 };
const _q = { x: 0, z: 0, tx: 0, tz: 1 };
const _q2 = { x: 0, z: 0, tx: 0, tz: 1 };
const _a = { x: 0, z: 0, tx: 0, tz: 1, y: 0 };
const _s = { x: 0, z: 0, tx: 0, tz: 1, y: 0 };
