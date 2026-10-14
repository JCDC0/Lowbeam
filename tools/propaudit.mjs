/**
 * Placement audit (gate 2 of `docs/agents/tasks/BUGS.md`): every solid thing the island places (the
 * scatter's circles and boxes, and the traffic signals' poles) measured against where cars drive,
 * at the car's height. Where cars drive is every lane of the traffic net and every curve a car takes
 * through a crossing or onto an exit (`buildTurn`, the traffic's own curve), each as a band its
 * lane's width, and every junction's paved patch. A shape is on the carriageway when it overlaps one
 * of those bands at a height where the game's collision would meet a car on it (`sameLevel` in
 * `collision.js`). The 0.10.36 lesson: never ask only the nearest road, and never ignore the height.
 *
 * `node tools/propaudit.mjs` prints the count by kind and the worst cases; `auditProps` is pure and
 * the test in `tests/island/propaudit.test.mjs` runs it on the shared island.
 */

import { buildTurn } from '../src/traffic/net.js';
import { placeSignals, signalCircles } from '../src/world/signals.js';

/** The same give as `sameLevel` in `collision.js`: a car meets a shape from 1.2 m below it to 0.3 m above. */
const BELOW = 1.2;
const ABOVE = 0.3;
const CELL = 8;
/** Lane bands are sampled this often (m); the distance is to the segment, so nothing slips between. */
const STEP = 1.5;
/** A shape that overlaps a lane by less than this is a touch at the edge, not on the carriageway. */
export const TOLERANCE = 0.05;

/**
 * @typedef {{ x: number, z: number, r: number, y0?: number, y1?: number }} Circle
 * @typedef {{ x: number, z: number, hx: number, hz: number, yaw: number, y0?: number, y1?: number }} Box
 * @typedef {{ kind: string, x: number, z: number, y: number, depth: number, where: string, shape: string }} Finding
 *   `depth` is how far the shape reaches into the band (m); `where` the lane, the turn or the junction
 */

/** @param {{ y0?: number, y1?: number }} shape @param {number} y */
const sameLevel = (shape, y) => (shape.y0 === undefined || y >= shape.y0 - BELOW) && (shape.y1 === undefined || y <= shape.y1 + ABOVE);

/**
 * Every band a car drives in, as segments in a grid: x0, z0, x1, z1, y, half width, label index.
 * @param {import('../src/traffic/net.js').TrafficNet} net
 */
export function driveBands(net) {
  /** @type {Map<string, number[]>} */
  const grid = new Map();
  /** @type {string[]} */
  const labels = [];
  const add = (x0, z0, x1, z1, y, half, label) => {
    const r = half + 0.5;
    const cx0 = Math.floor((Math.min(x0, x1) - r) / CELL);
    const cx1 = Math.floor((Math.max(x0, x1) + r) / CELL);
    const cz0 = Math.floor((Math.min(z0, z1) - r) / CELL);
    const cz1 = Math.floor((Math.max(z0, z1) + r) / CELL);
    for (let i = cx0; i <= cx1; i++) {
      for (let j = cz0; j <= cz1; j++) {
        const k = `${i},${j}`;
        let a = grid.get(k);
        if (!a) grid.set(k, (a = []));
        a.push(x0, z0, x1, z1, y, half, label);
      }
    }
  };
  const q = { x: 0, z: 0, tx: 0, tz: 1, y: 0 };
  const q2 = { x: 0, z: 0, tx: 0, tz: 1, y: 0 };
  // A slip road's lane keeps its full width through the taper, but traffic joins an exit ramp past
  // the taper (a turn curve leads in) and leaves an entry ramp before it, so a lane is banded only
  // from where the first link lands on it to where the last one leaves.
  /** @type {Map<import('../src/traffic/net.js').Lane, number>} */
  const firstIn = new Map();
  for (const lane of net.lanes) {
    for (const e of lane.ends) firstIn.set(e.lane, Math.min(firstIn.get(e.lane) ?? Infinity, e.toS));
    for (const m of lane.mids) firstIn.set(m.lane, Math.min(firstIn.get(m.lane) ?? Infinity, m.toS));
  }
  for (const lane of net.lanes) {
    const label = labels.push(lane.id) - 1;
    const half = lane.width / 2;
    const s0 = Math.min(firstIn.get(lane) ?? 0, lane.length);
    const s1 = lane.ends.length || !lane.mids.length ? lane.length : Math.max(s0, ...lane.mids.map((m) => m.at));
    const n = Math.max(1, Math.ceil((s1 - s0) / STEP));
    net.sample(lane, s0, q);
    let px = q.x, pz = q.z, py = q.y;
    for (let i = 1; i <= n; i++) {
      net.sample(lane, s0 + ((s1 - s0) * i) / n, q);
      add(px, pz, q.x, q.z, Math.min(py, q.y), half, label);
      px = q.x; pz = q.z; py = q.y;
    }
    for (const m of lane.mids) {
      net.sample(lane, m.at, q);
      net.sample(m.lane, m.toS, q2);
      const curve = buildTurn(q, q2);
      const tl = labels.push(`${lane.id}->${m.lane.id}`) - 1;
      const mh = Math.max(lane.width, m.lane.width) / 2;
      const k = Math.max(1, Math.ceil(curve.length));
      let a = curve.at(0);
      for (let i = 1; i <= k; i++) {
        const b = curve.at(i / k);
        add(a.x, a.z, b.x, b.z, Math.min(a.y, b.y), mh, tl);
        a = b;
      }
    }
  }
  return { grid, labels };
}

/** Distance from a point to a segment. */
function segDist(px, pz, x0, z0, x1, z1) {
  const dx = x1 - x0;
  const dz = z1 - z0;
  const l2 = dx * dx + dz * dz;
  const t = l2 > 0 ? Math.max(0, Math.min(1, ((px - x0) * dx + (pz - z0) * dz) / l2)) : 0;
  return Math.hypot(px - x0 - t * dx, pz - z0 - t * dz);
}

/** Distance from a segment to an oriented box (0 when they meet), in the box's own frame. @param {Box} b */
function boxSegDist(b, x0, z0, x1, z1) {
  const c = Math.cos(b.yaw || 0);
  const s = Math.sin(b.yaw || 0);
  const lx = (x, z) => (x - b.x) * c - (z - b.z) * s;
  const lz = (x, z) => (x - b.x) * s + (z - b.z) * c;
  const ax = lx(x0, z0), az = lz(x0, z0), bx = lx(x1, z1), bz = lz(x1, z1);
  // Liang-Barsky: does the segment cross the box?
  let t0 = 0, t1 = 1;
  const dx = bx - ax, dz = bz - az;
  const clip = (p, q) => {
    if (p === 0) return q >= 0;
    const r = q / p;
    if (p < 0) { if (r > t1) return false; if (r > t0) t0 = r; } else { if (r < t0) return false; if (r < t1) t1 = r; }
    return true;
  };
  if (clip(-dx, ax + b.hx) && clip(dx, b.hx - ax) && clip(-dz, az + b.hz) && clip(dz, b.hz - az)) return 0;
  const pt = (x, z) => Math.hypot(Math.max(0, Math.abs(x) - b.hx), Math.max(0, Math.abs(z) - b.hz));
  let d = Math.min(pt(ax, az), pt(bx, bz));
  for (const [cx, cz] of [[b.hx, b.hz], [-b.hx, b.hz], [b.hx, -b.hz], [-b.hx, -b.hz]]) d = Math.min(d, segDist(cx, cz, ax, az, bx, bz));
  return d;
}

/**
 * Names what a shape is by the scatter's own lists, for the report.
 * @param {ReturnType<typeof import('../src/world/scatter.js').scatterWorld>} w
 * @param {{ px: number, pz: number }[]} signals
 */
function namer(w, signals) {
  /** @type {Map<string, [string, number, number][]>} */
  const grid = new Map();
  const put = (kind, x, z) => {
    const k = `${Math.floor(x / 4)},${Math.floor(z / 4)}`;
    let a = grid.get(k);
    if (!a) grid.set(k, (a = []));
    a.push([kind, x, z]);
  };
  for (const l of w.lamps) put('lamp', l.x, l.z);
  for (const g of w.guides) put('guide sign', g.px, g.pz);
  for (const p of w.poles.poles) put('utility pole', p.x, p.z);
  for (const v of w.vending) put('vending', v.x, v.z);
  for (const b of w.buildings) put(`building ${b.kind}`, b.x, b.z);
  for (const t of w.trees) put('tree', t.x, t.z);
  for (const b of w.highway.barrier) put('barrier', b.x, b.z);
  for (const r of w.highway.rails) put('rail', r.x, r.z);
  for (const g of w.highway.gantries) put('gantry', g.x, g.z);
  for (const s of signals) put('signal pole', s.px, s.pz);
  for (const b of w.bridges) for (const p of b.piers) for (const l of p.legs || []) put('portal leg', l.x, l.z);
  return (/** @type {number} */ x, /** @type {number} */ z) => {
    for (const p of w.highway.plazas) if (Math.hypot(p.toll.x - x, p.toll.z - z) < 40) return 'toll plaza';
    let best = 'other';
    let bd = 3;
    const cx = Math.floor(x / 4);
    const cz = Math.floor(z / 4);
    for (let i = -1; i <= 1; i++) {
      for (let j = -1; j <= 1; j++) {
        for (const [kind, ix, iz] of grid.get(`${cx + i},${cz + j}`) || []) {
          const d = Math.hypot(ix - x, iz - z);
          if (d < bd) { bd = d; best = kind; }
        }
      }
    }
    return best;
  };
}

/**
 * Every solid shape that stands where a car drives.
 * @param {import('../src/world/ground.js').Ground} ground
 * @param {import('../src/traffic/net.js').TrafficNet} net
 * @param {ReturnType<typeof import('../src/world/scatter.js').scatterWorld>} w
 * @returns {Finding[]}
 */
export function auditProps(ground, net, w) {
  const signals = placeSignals(net, ground);
  /** @type {Circle[]} */
  const circles = [...w.circles, ...signalCircles(signals, ground)];
  const { grid, labels } = driveBands(net);
  const name = namer(w, signals);
  /** @type {Finding[]} */
  const out = [];
  /**
   * @param {Circle | Box} shape @param {number} reach its half extent, for the grid
   * @param {(x0: number, z0: number, x1: number, z1: number) => number} dist @param {string} desc
   */
  const check = (shape, reach, dist, desc) => {
    const cx0 = Math.floor((shape.x - reach) / CELL);
    const cx1 = Math.floor((shape.x + reach) / CELL);
    const cz0 = Math.floor((shape.z - reach) / CELL);
    const cz1 = Math.floor((shape.z + reach) / CELL);
    let worst = TOLERANCE;
    let where = '';
    let wy = 0;
    for (let i = cx0; i <= cx1; i++) {
      for (let j = cz0; j <= cz1; j++) {
        const a = grid.get(`${i},${j}`);
        if (!a) continue;
        for (let k = 0; k < a.length; k += 7) {
          if (!sameLevel(shape, a[k + 4])) continue;
          const depth = a[k + 5] - dist(a[k], a[k + 1], a[k + 2], a[k + 3]);
          if (depth > worst) { worst = depth; where = labels[a[k + 6]]; wy = a[k + 4]; }
        }
      }
    }
    if (where) out.push({ kind: name(shape.x, shape.z), x: shape.x, z: shape.z, y: wy, depth: worst, where, shape: desc });
  };
  for (const c of circles) {
    check(c, c.r + 3, (x0, z0, x1, z1) => segDist(c.x, c.z, x0, z0, x1, z1) - c.r, `circle r ${c.r.toFixed(2)}`);
  }
  for (const b of w.boxes) {
    check(b, Math.hypot(b.hx, b.hz) + 3, (x0, z0, x1, z1) => boxSegDist(b, x0, z0, x1, z1), `box ${(b.hx * 2).toFixed(1)} by ${(b.hz * 2).toFixed(1)}`);
  }
  return out.sort((a, b) => b.depth - a.depth);
}

/** Findings counted by kind. @param {Finding[]} list */
export function byKind(list) {
  /** @type {Record<string, number>} */
  const n = {};
  for (const f of list) n[f.kind] = (n[f.kind] || 0) + 1;
  return n;
}

if (import.meta.url === new URL(`file:///${process.argv[1].replace(/\\/g, '/')}`).href) {
  const { Ground } = await import('../src/world/ground.js');
  const { TrafficNet } = await import('../src/traffic/net.js');
  const { scatterWorld } = await import('../src/world/scatter.js');
  const t0 = performance.now();
  const g = new Ground();
  const net = new TrafficNet(g.roads);
  const w = scatterWorld(g);
  const t1 = performance.now();
  const list = auditProps(g, net, w);
  const t2 = performance.now();
  console.log(`island ${((t1 - t0) / 1000).toFixed(1)} s, audit ${((t2 - t1) / 1000).toFixed(1)} s; ${w.circles.length} circles, ${w.boxes.length} boxes`);
  console.log(`${list.length} shapes where cars drive`, byKind(list));
  const limit = Number(process.argv[2]) || 40;
  for (const f of list.slice(0, limit)) {
    console.log(`${f.kind.padEnd(18)} (${f.x.toFixed(1)}, ${f.y.toFixed(1)}, ${f.z.toFixed(1)}) ${f.depth.toFixed(2)} m into ${f.where}; ${f.shape}`);
  }
}
