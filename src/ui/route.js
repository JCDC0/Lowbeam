/**
 * GPS waypoint routing on the traffic network. Pure: no three.js, no DOM.
 * Snaps origin and destination to directed lanes, finds the shortest path
 * along legal lanes and links with A*, and produces polyline geometry.
 * RouteTracker tracks the car, reports remaining distance, detects arrival
 * and re-plans when off course.
 */

/** @typedef {import('../traffic/net.js').TrafficNet} TrafficNet */
/** @typedef {import('../traffic/net.js').Lane} Lane */
/** @typedef {import('../traffic/net.js').Link} Link */

/**
 * Binary min-heap for A* priority queue.
 */
class MinHeap {
  constructor() {
    this.heap = [];
  }

  push(node) {
    this.heap.push(node);
    let i = this.heap.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.heap[p].f <= this.heap[i].f) break;
      const tmp = this.heap[p];
      this.heap[p] = this.heap[i];
      this.heap[i] = tmp;
      i = p;
    }
  }

  pop() {
    if (this.heap.length === 0) return null;
    const top = this.heap[0];
    const bot = this.heap.pop();
    if (this.heap.length > 0) {
      this.heap[0] = bot;
      let i = 0;
      const len = this.heap.length;
      while (true) {
        const left = 2 * i + 1;
        const right = 2 * i + 2;
        let best = i;
        if (left < len && this.heap[left].f < this.heap[best].f) best = left;
        if (right < len && this.heap[right].f < this.heap[best].f) best = right;
        if (best === i) break;
        const tmp = this.heap[i];
        this.heap[i] = this.heap[best];
        this.heap[best] = tmp;
        i = best;
      }
    }
    return top;
  }

  get length() {
    return this.heap.length;
  }
}

/**
 * Samples lane position and tangent at arc length s.
 * @param {TrafficNet} net
 * @param {Lane} lane
 * @param {number} s
 * @param {{ x: number, z: number, tx: number, tz: number, y: number }} out
 */
export function sampleLane(net, lane, s, out) {
  const l = /** @type {any} */ (lane);
  if (net && typeof net.sample === 'function') {
    return net.sample(lane, s, out);
  }
  if (typeof l.sample === 'function') {
    return l.sample(s, out);
  }
  if (l.points && l.points.length >= 2) {
    const pts = l.points;
    const len = lane.length;
    const clampedS = lane.closed
      ? ((s % len) + len) % len
      : Math.max(0, Math.min(len, s));
    let cum = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i];
      const p1 = pts[i + 1];
      const p0x = Array.isArray(p0) ? p0[0] : p0.x;
      const p0z = Array.isArray(p0) ? p0[1] : p0.z;
      const p1x = Array.isArray(p1) ? p1[0] : p1.x;
      const p1z = Array.isArray(p1) ? p1[1] : p1.z;
      const segLen = Math.hypot(p1x - p0x, p1z - p0z) || 1e-4;
      if (cum + segLen >= clampedS || i === pts.length - 2) {
        const t = Math.max(0, Math.min(1, (clampedS - cum) / segLen));
        const tx = (p1x - p0x) / segLen;
        const tz = (p1z - p0z) / segLen;
        out.x = p0x + (p1x - p0x) * t;
        out.z = p0z + (p1z - p0z) * t;
        out.tx = tx;
        out.tz = tz;
        out.y = 0;
        return out;
      }
      cum += segLen;
    }
  }
  if (lane.road && lane.road.path) {
    const p = lane.road.path;
    const ps = lane.dir > 0 ? s : p.length - s;
    const q = { x: 0, z: 0, tx: 0, tz: 1 };
    p.sample(lane.closed ? p.wrapS(ps) : Math.max(0, Math.min(p.length, ps)), q);
    const tx = lane.dir * q.tx;
    const tz = lane.dir * q.tz;
    const off = lane.offset || 0;
    out.x = q.x + tz * off;
    out.z = q.z - tx * off;
    out.tx = tx;
    out.tz = tz;
    out.y = lane.road.heightAt
      ? lane.road.heightAt(lane.closed ? p.wrapS(ps) : Math.max(0, Math.min(p.length, ps)))
      : 0;
    return out;
  }
  out.x = 0;
  out.z = 0;
  out.tx = 0;
  out.tz = 1;
  out.y = 0;
  return out;
}

/**
 * Returns lane s from path s.
 * @param {TrafficNet} net
 * @param {Lane} lane
 * @param {number} ps
 */
function laneS(net, lane, ps) {
  if (net && typeof net.laneS === 'function') return net.laneS(lane, ps);
  return lane.dir > 0 ? ps : (lane.road?.path ? lane.road.path.length - ps : lane.length - ps);
}

/**
 * Finds the nearest point along polyline points to (px, pz).
 * @param {({x: number, z: number} | number[])[]} pts
 * @param {number} px
 * @param {number} pz
 */
function nearestOnPoints(pts, px, pz) {
  let bestDist = Infinity;
  let bestS = 0;
  let cum = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i];
    const p1 = pts[i + 1];
    const p0x = Array.isArray(p0) ? p0[0] : p0.x;
    const p0z = Array.isArray(p0) ? p0[1] : p0.z;
    const p1x = Array.isArray(p1) ? p1[0] : p1.x;
    const p1z = Array.isArray(p1) ? p1[1] : p1.z;
    const dx = p1x - p0x;
    const dz = p1z - p0z;
    const l2 = dx * dx + dz * dz || 1e-4;
    const t = Math.max(0, Math.min(1, ((px - p0x) * dx + (pz - p0z) * dz) / l2));
    const qx = p0x + dx * t;
    const qz = p0z + dz * t;
    const d = Math.hypot(px - qx, pz - qz);
    const segLen = Math.sqrt(l2);
    if (d < bestDist) {
      bestDist = d;
      bestS = cum + segLen * t;
    }
    cum += segLen;
  }
  return { s: bestS, dist: bestDist };
}

/**
 * Snaps a 2D world position to the nearest lane in the network.
 * @param {TrafficNet} net
 * @param {{ x: number, z: number } | number[]} pt
 * @param {number} [yaw]
 * @returns {{ lane: Lane, s: number, dist: number, x: number, z: number } | null}
 */
export function snapToLane(net, pt, yaw) {
  if (!net || !net.lanes || net.lanes.length === 0) return null;
  const px = Array.isArray(pt) ? pt[0] : pt.x;
  const pz = Array.isArray(pt) ? pt[1] : pt.z;
  const hasYaw = typeof yaw === 'number' && !Number.isNaN(yaw);
  const fx = hasYaw ? Math.sin(yaw) : 0;
  const fz = hasYaw ? Math.cos(yaw) : 0;

  const out = { x: 0, z: 0, tx: 0, tz: 1, y: 0 };
  let candidateLanes = net.lanes;

  if (net.network && typeof net.network.query === 'function') {
    const hit = { road: null, s: 0, d: 0, h: 0, edge: 0 };
    if (net.network.query(px, pz, hit, 40)) {
      const roadLanes = net.byRoad?.get(hit.road.id);
      if (roadLanes && roadLanes.length > 0) candidateLanes = roadLanes;
    }
  }

  let best = null;
  let bestScore = Infinity;

  for (let i = 0; i < candidateLanes.length; i++) {
    const lane = candidateLanes[i];
    const l = /** @type {any} */ (lane);
    let s = 0;
    if (lane.road?.path) {
      const hit = lane.road.path.nearest(px, pz);
      s = laneS(net, lane, hit.s);
    } else if (l.points && l.points.length >= 2) {
      s = nearestOnPoints(l.points, px, pz).s;
    } else {
      const steps = Math.max(2, Math.ceil(lane.length / 20));
      let minD = Infinity;
      let minS = 0;
      for (let k = 0; k <= steps; k++) {
        const curS = (k / steps) * lane.length;
        sampleLane(net, lane, curS, out);
        const d = Math.hypot(px - out.x, pz - out.z);
        if (d < minD) {
          minD = d;
          minS = curS;
        }
      }
      s = minS;
    }

    if (lane.closed) {
      s = ((s % lane.length) + lane.length) % lane.length;
    } else {
      s = Math.max(0, Math.min(lane.length, s));
    }

    sampleLane(net, lane, s, out);
    const dist = Math.hypot(px - out.x, pz - out.z);
    let score = dist;
    if (hasYaw) {
      const dot = fx * out.tx + fz * out.tz;
      if (dot < 0) score += 40;
    }

    if (score < bestScore) {
      bestScore = score;
      best = { lane, s, dist, x: out.x, z: out.z };
    }
  }

  return best;
}

/**
 * Computes an A* route from `from` to `to` along traffic lanes and links.
 * @param {TrafficNet} net
 * @param {{ x: number, z: number, yaw?: number } | number[]} from
 * @param {{ x: number, z: number } | number[]} to
 * @returns {{ points: [number, number][], length: number, lanes: Lane[] } | null}
 */
export function routeTo(net, from, to) {
  if (!net || !net.lanes || net.lanes.length === 0) return null;
  const fromYaw = Array.isArray(from) ? undefined : from.yaw;
  const start = snapToLane(net, from, fromYaw);
  const target = snapToLane(net, to);
  if (!start || !target) return null;

  const sampleBuf = { x: 0, z: 0, tx: 0, tz: 1, y: 0 };
  sampleLane(net, target.lane, target.s, sampleBuf);
  const targetX = sampleBuf.x;
  const targetZ = sampleBuf.z;

  const laneMap = new Map();
  for (let i = 0; i < net.lanes.length; i++) laneMap.set(net.lanes[i], i);

  function nodeKey(lane, s) {
    const idx = laneMap.get(lane) ?? 0;
    return idx * 100000 + (Math.round(s) | 0);
  }

  const open = new MinHeap();
  const bestCost = new Map();

  sampleLane(net, start.lane, start.s, sampleBuf);
  const startH = Math.hypot(sampleBuf.x - targetX, sampleBuf.z - targetZ);
  open.push({ lane: start.lane, s: start.s, g: 0, f: startH, prev: null, exitS: start.s });
  bestCost.set(nodeKey(start.lane, start.s), 0);

  if (start.lane.index > 0 && net.byRoad) {
    const l0 = net.lane
      ? net.lane(start.lane.road.id, start.lane.dir, 0)
      : net.byRoad.get(start.lane.road.id)?.find((l) => l.dir === start.lane.dir && l.index === 0);
    if (l0 && l0 !== start.lane) {
      open.push({ lane: l0, s: start.s, g: 0, f: startH, prev: null, exitS: start.s });
      bestCost.set(nodeKey(l0, start.s), 0);
    }
  }

  let foundGoal = null;

  while (open.length > 0) {
    const curr = open.pop();
    const currK = nodeKey(curr.lane, curr.s);
    if (curr.g > (bestCost.get(currK) ?? Infinity)) continue;

    const isTargetLane = curr.lane === target.lane;
    const isParallelTarget =
      curr.lane.road &&
      target.lane.road &&
      curr.lane.road === target.lane.road &&
      curr.lane.dir === target.lane.dir;

    if (isTargetLane || isParallelTarget) {
      let canReach = false;
      let distAlong = 0;
      if (curr.lane.closed) {
        canReach = true;
        distAlong = (target.s - curr.s + curr.lane.length) % curr.lane.length;
      } else if (target.s >= curr.s) {
        canReach = true;
        distAlong = target.s - curr.s;
      }
      if (canReach) {
        foundGoal = { lane: curr.lane, s: curr.s, exitS: target.s, g: curr.g + distAlong, prev: curr.prev };
        break;
      }
    }

    const links =
      curr.lane.links ||
      (curr.lane._allLinks ||
        (curr.lane._allLinks = [...(curr.lane.ends || []), ...(curr.lane.mids || [])]));

    for (let i = 0; i < links.length; i++) {
      const lk = links[i];
      let canTake = false;
      let distAlong = 0;
      if (curr.lane.closed) {
        canTake = true;
        distAlong = (lk.at - curr.s + curr.lane.length) % curr.lane.length;
      } else if (lk.at >= curr.s) {
        canTake = true;
        distAlong = lk.at - curr.s;
      }
      if (!canTake) continue;

      const nextG = curr.g + distAlong;
      const nextLane = lk.lane;
      const nextS = lk.toS;
      const k = nodeKey(nextLane, nextS);

      if (nextG < (bestCost.get(k) ?? Infinity)) {
        bestCost.set(k, nextG);
        if (lk._wx === undefined) {
          sampleLane(net, nextLane, nextS, sampleBuf);
          lk._wx = sampleBuf.x;
          lk._wz = sampleBuf.z;
        }
        const h = Math.hypot(lk._wx - targetX, lk._wz - targetZ);
        open.push({
          lane: nextLane,
          s: nextS,
          g: nextG,
          f: nextG + h,
          prev: { lane: curr.lane, s: curr.s, exitS: lk.at, prev: curr.prev },
        });
      }
    }

    if (curr.lane.index > 0 && net.byRoad) {
      const l0 = net.lane
        ? net.lane(curr.lane.road.id, curr.lane.dir, 0)
        : net.byRoad.get(curr.lane.road.id)?.find((l) => l.dir === curr.lane.dir && l.index === 0);
      if (l0 && l0 !== curr.lane) {
        const k = nodeKey(l0, curr.s);
        if (curr.g < (bestCost.get(k) ?? Infinity)) {
          bestCost.set(k, curr.g);
          sampleLane(net, l0, curr.s, sampleBuf);
          const h = Math.hypot(sampleBuf.x - targetX, sampleBuf.z - targetZ);
          open.push({
            lane: l0,
            s: curr.s,
            g: curr.g,
            f: curr.g + h,
            prev: { lane: curr.lane, s: curr.s, exitS: curr.s, prev: curr.prev },
          });
        }
      }
    }
  }

  if (!foundGoal) return null;

  const segments = [];
  let walk = foundGoal;
  while (walk) {
    segments.push(walk);
    walk = walk.prev;
  }
  segments.reverse();

  const points = [];
  const STEP = 10;
  const usedLanes = [];

  function addPoint(x, z) {
    if (points.length > 0) {
      const last = points[points.length - 1];
      const d = Math.hypot(x - last[0], z - last[1]);
      if (d < 0.2) return;
    }
    const pt = [x, z];
    /** @type {any} */ (pt).x = x;
    /** @type {any} */ (pt).z = z;
    points.push(/** @type {any} */ (pt));
  }

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    if (!usedLanes.includes(seg.lane)) usedLanes.push(seg.lane);
    const lane = seg.lane;
    const fromS = seg.s;
    const toS = seg.exitS;

    if (lane.closed && toS < fromS) {
      for (let s = fromS; s < lane.length; s += STEP) {
        sampleLane(net, lane, s, sampleBuf);
        addPoint(sampleBuf.x, sampleBuf.z);
      }
      for (let s = 0; s < toS; s += STEP) {
        sampleLane(net, lane, s, sampleBuf);
        addPoint(sampleBuf.x, sampleBuf.z);
      }
    } else {
      const span = toS - fromS;
      if (span > 0.01) {
        const count = Math.max(1, Math.ceil(span / STEP));
        for (let k = 0; k <= count; k++) {
          const s = fromS + (k / count) * span;
          sampleLane(net, lane, s, sampleBuf);
          addPoint(sampleBuf.x, sampleBuf.z);
        }
      }
    }
  }

  sampleLane(net, target.lane, target.s, sampleBuf);
  addPoint(sampleBuf.x, sampleBuf.z);

  let totalLength = 0;
  for (let i = 0; i < points.length - 1; i++) {
    totalLength += Math.hypot(points[i + 1][0] - points[i][0], points[i + 1][1] - points[i][1]);
  }

  return {
    points,
    length: totalLength,
    lanes: usedLanes,
  };
}

/**
 * Tracks the car along a route, detects arrival and wrong turns.
 */
export class RouteTracker {
  /**
   * @param {TrafficNet} net
   * @param {{ x: number, z: number } | number[] | null} [destination]
   * @param {{ x: number, z: number, yaw?: number } | null} [car]
   */
  constructor(net, destination = null, car = null) {
    this.net = net;
    this.destination = destination;
    this.route = null;
    this.distance = 0;
    this.arrived = false;
    this.offTimer = 0;

    if (destination && car) {
      this.plan(car);
    }
  }

  /**
   * Sets a new destination, clears previous arrival state and plans route if car is given.
   * @param {{ x: number, z: number } | number[] | null} dest
   * @param {{ x: number, z: number, yaw?: number }} [car]
   */
  setDestination(dest, car) {
    this.destination = dest;
    this.arrived = false;
    this.offTimer = 0;
    if (!dest) {
      this.clear();
      return;
    }
    if (car) {
      this.plan(car);
    }
  }

  /** Clears the current route and destination. */
  clear() {
    this.destination = null;
    this.route = null;
    this.distance = 0;
    this.offTimer = 0;
  }

  /**
   * Plans route from car to current destination.
   * @param {{ x: number, z: number, yaw?: number }} car
   */
  plan(car) {
    if (!this.destination || !car) return null;
    this.route = routeTo(this.net, car, this.destination);
    if (this.route) {
      this.distance = this.route.length;
    } else {
      this.distance = 0;
    }
    return this.route;
  }

  /**
   * Updates tracking along the route.
   * Returns distance left in meters.
   * @param {{ x?: number, z?: number, yaw?: number, state?: { x: number, z: number, yaw: number } }} car
   * @param {number} [dt]
   * @returns {number}
   */
  update(car, dt = 1 / 60) {
    if (!this.destination) {
      this.distance = 0;
      return 0;
    }

    const cx = car.x ?? car.state?.x ?? 0;
    const cz = car.z ?? car.state?.z ?? 0;
    const cyaw = car.yaw ?? car.state?.yaw ?? 0;

    const destX = Array.isArray(this.destination) ? this.destination[0] : this.destination.x;
    const destZ = Array.isArray(this.destination) ? this.destination[1] : this.destination.z;
    const distToDest = Math.hypot(cx - destX, cz - destZ);

    if (distToDest < 25) {
      this.arrived = true;
      this.route = null;
      this.distance = 0;
      return 0;
    }

    if (!this.route) {
      this.plan({ x: cx, z: cz, yaw: cyaw });
      if (!this.route) {
        this.distance = 0;
        return 0;
      }
    }

    const pts = this.route.points;
    let minD = Infinity;
    let sAtMin = 0;
    let cum = 0;

    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i];
      const p1 = pts[i + 1];
      const p0x = p0[0];
      const p0z = p0[1];
      const p1x = p1[0];
      const p1z = p1[1];
      const dx = p1x - p0x;
      const dz = p1z - p0z;
      const l2 = dx * dx + dz * dz || 1e-4;
      const t = Math.max(0, Math.min(1, ((cx - p0x) * dx + (cz - p0z) * dz) / l2));
      const qx = p0x + dx * t;
      const qz = p0z + dz * t;
      const d = Math.hypot(cx - qx, cz - qz);
      const segLen = Math.sqrt(l2);
      if (d < minD) {
        minD = d;
        sAtMin = cum + segLen * t;
      }
      cum += segLen;
    }

    this.distance = Math.max(0, this.route.length - sAtMin);

    const stepDt = typeof dt === 'number' && dt > 0 ? dt : 1 / 60;
    if (minD > 40) {
      this.offTimer += stepDt;
      if (this.offTimer >= 2.0) {
        this.offTimer = 0;
        this.plan({ x: cx, z: cz, yaw: cyaw });
      }
    } else {
      this.offTimer = 0;
    }

    return this.distance;
  }
}
