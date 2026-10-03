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
 * @typedef {{ s: number, node: LightNode, axis: 0 | 1 }} Stop
 * @typedef {{ x: number, z: number, offset: number }} LightNode
 */

const LANE_WIDTH = 3.5;
/** How near an end of a road must be to another road to join it, meters. */
const JOIN = 12;
const CYCLE = { green: 13, yellow: 2.2 };

/** Light phase for an axis at time t: 'green', 'yellow' or 'red'. @param {LightNode} node @param {0 | 1} axis @param {number} t */
export function lightState(node, axis, t) {
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
      // The end of a lane is the end of the road in its direction; a ramp's exit end is special-cased by its link.
      this.sample(lane, lane.length, _a);
      const arrive = { tx: _a.tx, tz: _a.tz };
      const pEnd = road.path.sample(lane.dir > 0 ? road.path.length : 0, _q2);
      for (const other of this.network.roads) {
        if (other === road || other.id === road.def.twin || other.def.cls === 'expressway') continue;
        if (cls === 'ramp' && road.def.link && other.id === road.def.link.from.id) continue;
        const hit = other.path.nearest(pEnd.x, pEnd.z);
        // `d` is only the sideways offset: a point far beyond the end of a road can have a small one.
        if (Math.hypot(pEnd.x - hit.x, pEnd.z - hit.z) > JOIN || other.liftAt(hit.s) > 2) continue;
        const turnLimit = Math.hypot(pEnd.x - hit.x, pEnd.z - hit.z) < 2 && (hit.s < 3 || other.path.length - hit.s < 3) ? -0.95 : -0.3;
        for (const t of this.joinTargets(other, hit.s, arrive, turnLimit)) {
          lane.ends.push({ lane: t.lane, at: lane.length, toS: t.s, kind: 'end', weight: 1 });
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
      if (cl) cl.mids.push({ lane: rl, at: this.laneS(cl, link.from.s), toS: 0, kind: 'exit', weight: 0.22 });
    } else {
      // An entry ramp starts on the avenue: cars turn in from either direction.
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

  /** Turns and traffic lights where city streets cross. */
  linkCrossings() {
    const streets = this.network.roads.filter((r) => r.def.cls === 'street');
    const pts = streets.map((r) => {
      const a = [];
      for (let s = 0; s < r.path.length; s += 8) {
        const q = r.path.sample(s);
        a.push([q.x, q.z, s]);
      }
      return a;
    });
    const ccw = (a, b, c) => (c[1] - a[1]) * (b[0] - a[0]) > (b[1] - a[1]) * (c[0] - a[0]);
    const cross = (a, b, c, d) => ccw(a, c, d) !== ccw(b, c, d) && ccw(a, b, c) !== ccw(a, b, d);
    let n = 0;
    for (let a = 0; a < streets.length; a++) {
      for (let b = a + 1; b < streets.length; b++) {
        for (let i = 0; i + 1 < pts[a].length; i++) {
          for (let j = 0; j + 1 < pts[b].length; j++) {
            const A = pts[a][i];
            const B = pts[a][i + 1];
            const C = pts[b][j];
            const D = pts[b][j + 1];
            if (Math.abs(A[0] - C[0]) > 20 || Math.abs(A[1] - C[1]) > 20 || !cross(A, B, C, D)) continue;
            const hitA = streets[a].path.nearest(A[0], A[1], undefined, Math.round((A[2] - 12) / 2), Math.round((A[2] + 20) / 2));
            this.crossAt(streets[a], streets[b], streets[a].path.sample(hitA.s), n++);
          }
        }
      }
    }
  }

  /** @param {Road} ra @param {Road} rb @param {{ x: number, z: number }} at @param {number} n */
  crossAt(ra, rb, at, n) {
    const ha = ra.path.nearest(at.x, at.z);
    const hb = rb.path.nearest(at.x, at.z);
    /** @type {LightNode} */
    const node = { x: at.x, z: at.z, offset: (n * 5.3) % 30 };
    this.nodes.push(node);
    const axisOf = (road, s) => {
      const q = road.path.sample(s);
      return /** @type {0 | 1} */ (Math.abs(q.tx) > Math.abs(q.tz) ? 0 : 1);
    };
    /** @type {[Road, number, Road, number][]} */
    const arms = [[ra, ha.s, rb, hb.s], [rb, hb.s, ra, ha.s]];
    for (const [road, ps, cross, cps] of arms) {
      for (const lane of this.byRoad.get(road.id) || []) {
        const s = this.laneS(lane, ps);
        lane.stops.push({ s: s - (cross.hw + 3.5), node, axis: axisOf(road, ps) });
        this.sample(lane, s, _a);
        for (const other of this.byRoad.get(cross.id) || []) {
          if (other.index !== 0) continue;
          const so = this.laneS(other, cps);
          this.sample(other, so, _s);
          const dot = _a.tx * _s.tx + _a.tz * _s.tz;
          if (Math.abs(dot) > 0.5) continue;
          lane.mids.push({ lane: other, at: s - 2, toS: so + 3, kind: 'turn', weight: 0.14 });
        }
      }
    }
    for (const lane of this.lanes) lane.stops.sort((a, b) => a.s - b.s);
    return node;
  }
}

const _q = { x: 0, z: 0, tx: 0, tz: 1 };
const _q2 = { x: 0, z: 0, tx: 0, tz: 1 };
const _a = { x: 0, z: 0, tx: 0, tz: 1, y: 0 };
const _s = { x: 0, z: 0, tx: 0, tz: 1, y: 0 };
