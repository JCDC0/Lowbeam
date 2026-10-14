/**
 * Where surface roads meet: crossings (two roads pass through each other) and T junctions (a road
 * ends on the side of another), found from the road geometry rather than from a grid. Pure. The
 * road builder paves each junction as one patch and stops skirts and sidewalks short of it; the
 * traffic network can use the same list. Lifted parts of roads (bridges, decks) never form a
 * junction with what passes under them.
 */

/** Road classes that meet at junctions. Expressways and ramps only meet through slip roads. */
const MEETS = new Set(['street', 'arterial', 'mountain']);
const STEP = 4;
const CELL = 48;
/** Junction points closer than this are one junction. */
const MERGE = 10;
/** Lift above which a road is on a bridge, not at a junction. */
const LIFTED = 0.5;

/**
 * @typedef {import('./roads.js').Road} Road
 * @typedef {{ road: Road, s: number, dir: 1 | -1 }} Arm  a road leaving the junction: from s, in direction dir
 * @typedef {{ x: number, z: number, arms: Arm[], r: number, kind: 'cross' | 'tee' }} Junction
 *   `r` is the radius of the paved patch: the widest crossing road's half width plus a little
 */

/**
 * @param {Road[]} roads
 * @returns {Junction[]}
 */
export function findJunctions(roads) {
  const list = roads.filter((r) => MEETS.has(r.def.cls || 'street') && r.surface === 'asphalt');
  /** @type {{ x: number, z: number, hits: { road: Road, s: number }[], tee: boolean }[]} */
  const points = [];
  /** @type {Map<number, { r: number, s0: number, x0: number, z0: number, x1: number, z1: number }[]>} */
  const cells = new Map();
  const key = (cx, cz) => cx * 92821 + cz;
  list.forEach((road, ri) => {
    const p = road.path;
    for (let s = 0; s < p.length; s += STEP) {
      const s1 = Math.min(p.length, s + STEP);
      const a = p.sample(s);
      const b = p.sample(s1);
      const seg = { r: ri, s0: s, x0: a.x, z0: a.z, x1: b.x, z1: b.z };
      const cx0 = Math.floor(Math.min(a.x, b.x) / CELL);
      const cx1 = Math.floor(Math.max(a.x, b.x) / CELL);
      const cz0 = Math.floor(Math.min(a.z, b.z) / CELL);
      const cz1 = Math.floor(Math.max(a.z, b.z) / CELL);
      for (let cx = cx0; cx <= cx1; cx++) {
        for (let cz = cz0; cz <= cz1; cz++) {
          const k = key(cx, cz);
          let c = cells.get(k);
          if (!c) cells.set(k, (c = []));
          c.push(seg);
        }
      }
    }
  });
  const seen = new Set();
  for (const segs of cells.values()) {
    for (let i = 0; i < segs.length; i++) {
      for (let j = i + 1; j < segs.length; j++) {
        const A = segs[i];
        const B = segs[j];
        if (A.r === B.r) continue;
        const hit = intersect(A, B);
        if (!hit) continue;
        const ra = list[A.r];
        const rb = list[B.r];
        const sa = A.s0 + hit.t * STEP;
        const sb = B.s0 + hit.u * STEP;
        const tag = `${Math.min(A.r, B.r)}:${Math.max(A.r, B.r)}:${Math.round(hit.x / 4)}:${Math.round(hit.z / 4)}`;
        if (seen.has(tag)) continue;
        seen.add(tag);
        if (ra.liftAt(sa) > LIFTED || rb.liftAt(sb) > LIFTED) continue;
        points.push({ x: hit.x, z: hit.z, hits: [{ road: ra, s: sa }, { road: rb, s: sb }], tee: false });
      }
    }
  }
  // T junctions: a road's end on the side of another road (a crossing found above may already
  // hold it when the end pokes a little past the centre line).
  for (const road of list) {
    if (road.path.closed) continue;
    for (const s of [0, road.path.length]) {
      const q = road.path.sample(s);
      if (road.liftAt(s) > LIFTED) continue;
      let best = null;
      for (const other of list) {
        if (other === road) continue;
        const h = other.path.nearest(q.x, q.z);
        const d = Math.abs(h.d);
        const atEnd = !other.path.closed && (h.s < 6 || h.s > other.path.length - 6);
        if (d > other.hwAt(h.s) + 3 || atEnd || other.liftAt(h.s) > LIFTED) continue;
        if (!best || d < best.d) best = { other, s: h.s, d };
      }
      if (best) {
        const o = best.other.path.sample(best.s);
        points.push({ x: o.x, z: o.z, hits: [{ road, s }, { road: best.other, s: best.s }], tee: true });
      }
    }
  }
  return merge(points);
}

/** Segment intersection, with the fraction along each. */
function intersect(A, B) {
  const ax = A.x1 - A.x0;
  const az = A.z1 - A.z0;
  const bx = B.x1 - B.x0;
  const bz = B.z1 - B.z0;
  const den = ax * bz - az * bx;
  if (Math.abs(den) < 1e-9) return null;
  const cx = B.x0 - A.x0;
  const cz = B.z0 - A.z0;
  const t = (cx * bz - cz * bx) / den;
  const u = (cx * az - cz * ax) / den;
  if (t < 0 || t > 1 || u < 0 || u > 1) return null;
  return { t, u, x: A.x0 + ax * t, z: A.z0 + az * t };
}

/**
 * Joins points closer than MERGE into one junction and turns each road through it into arms.
 * @param {{ x: number, z: number, hits: { road: Road, s: number }[], tee: boolean }[]} points
 * @returns {Junction[]}
 */
function merge(points) {
  /** @type {Junction[]} */
  const out = [];
  const used = new Uint8Array(points.length);
  for (let i = 0; i < points.length; i++) {
    if (used[i]) continue;
    const group = [points[i]];
    used[i] = 1;
    for (let k = 0; k < group.length; k++) {
      for (let j = 0; j < points.length; j++) {
        if (used[j]) continue;
        if (Math.hypot(points[j].x - group[k].x, points[j].z - group[k].z) < MERGE) {
          used[j] = 1;
          group.push(points[j]);
        }
      }
    }
    const x = group.reduce((a, p) => a + p.x, 0) / group.length;
    const z = group.reduce((a, p) => a + p.z, 0) / group.length;
    /** @type {Map<Road, number>} */
    const at = new Map();
    for (const p of group) for (const h of p.hits) if (!at.has(h.road)) at.set(h.road, h.s);
    /** @type {Arm[]} */
    const arms = [];
    let r = 0;
    for (const [road, s0] of at) {
      const s = road.path.nearest(x, z).s;
      const hw = road.hwAt(s);
      r = Math.max(r, hw);
      const len = road.path.length;
      if (road.path.closed || s > 6) arms.push({ road, s, dir: -1 });
      if (road.path.closed || s < len - 6) arms.push({ road, s, dir: 1 });
      void s0;
    }
    out.push({ x, z, arms, r: r + 1.5, kind: group.some((p) => p.tee) && arms.length < 4 ? 'tee' : 'cross' });
  }
  return out;
}

/**
 * The stretches of each road that lie inside a junction, for the road builder to drop skirts and
 * sidewalks there: per road, [s0, s1] pairs.
 * @param {Junction[]} junctions
 * @returns {Map<Road, number[][]>}
 */
export function junctionSpans(junctions) {
  /** @type {Map<Road, number[][]>} */
  const out = new Map();
  for (const j of junctions) {
    for (const arm of j.arms) {
      const reach = j.r + 2.5;
      const span = arm.dir > 0 ? [arm.s - 1, arm.s + reach] : [arm.s - reach, arm.s + 1];
      if (!out.has(arm.road)) out.set(arm.road, []);
      out.get(arm.road).push(span);
    }
  }
  return out;
}

/**
 * The paved patch of a junction: a polygon through the edges (sidewalks included) of every road
 * leaving it, 2.5 m past its radius, sorted round the center, and the height it is laid at (a
 * little above the highest road there, so lane paint and curbs stop at it). Null with fewer than
 * three corners. The road builder paves it and the seam audit (`tools/seamaudit.mjs`) checks it.
 * @param {Junction} j
 * @returns {{ pts: [number, number][], y: number } | null}
 */
export function junctionOutline(j) {
  /** @type {{ a: number, p: [number, number] }[]} */
  const pts = [];
  let y = -Infinity;
  for (const arm of j.arms) {
    const road = arm.road;
    const s = road.path.wrapS(arm.s + arm.dir * (j.r + 2.5));
    const q = road.path.sample(s);
    const w = road.hwAt(s) + road.walk;
    y = Math.max(y, road.heightAt(road.path.wrapS(arm.s)) + 0.012 * road.priority);
    for (const k of [-1, 1]) {
      const x = q.x + q.tz * w * k;
      const z = q.z - q.tx * w * k;
      pts.push({ a: Math.atan2(x - j.x, z - j.z), p: [x, z] });
    }
  }
  if (pts.length < 3) return null;
  pts.sort((p, q) => p.a - q.a);
  return { pts: pts.map((p) => p.p), y: y + 0.006 };
}
