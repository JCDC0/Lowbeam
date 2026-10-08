/**
 * Road paint at the town's junctions, Japanese style: a zebra crossing across every arm that has a
 * sidewalk, just outside the road it crosses, and a stop line across the lanes coming in behind it.
 * The traffic stops 3.5 m past the crossed road's edge plus its gap (net.js, sim.js), so the line
 * lies about a meter ahead of the waiting cars' bumpers. Pure.
 */

/**
 * Meters: the gap from the crossed road's edge to the zebra, the zebra's depth, its bars and
 * spaces, the gap to the stop line and the line's width.
 */
export const MARKING = { gap: 0.6, zebra: 3.2, bar: 0.45, space: 0.45, toLine: 0.4, line: 0.45 };

/**
 * @typedef {{ x: number, y: number, z: number, yaw: number, w: number, d: number, kind: 'zebra' | 'stop', road: string }} Marking
 * A painted rectangle centered on (x, y, z), `w` across the road and `d` along it, its local +z
 * along the road (`yaw`), pointing away from its junction.
 */

/**
 * @param {import('./junctions.js').Junction[]} junctions
 * @returns {Marking[]}
 */
export function placeMarkings(junctions) {
  /** @type {Marking[]} */
  const out = [];
  const q = { x: 0, z: 0, tx: 0, tz: 1 };
  const M = MARKING;
  // Where two junctions sit close, an arm's paint can fall in the other one: it is left out there.
  const inOther = (j, x, z) => junctions.some((o) => o !== j && Math.abs(o.x - x) < o.r + 3 && Math.abs(o.z - z) < o.r + 3 && Math.hypot(o.x - x, o.z - z) < o.r + 2);
  for (const j of junctions) {
    let y = -Infinity;
    for (const arm of j.arms) y = Math.max(y, arm.road.heightAt(arm.road.path.wrapS(arm.s)) + 0.012 * arm.road.priority);
    y += 0.006 + 0.008;
    for (const arm of j.arms) {
      const road = arm.road;
      if (!road.walk) continue;
      let cross = 0;
      for (const other of j.arms) if (other.road !== road) cross = Math.max(cross, other.road.hwAt(other.road.path.wrapS(other.s)));
      if (cross === 0) continue;
      const at = (dist) => {
        const s = road.path.closed ? road.path.wrapS(arm.s + arm.dir * dist) : arm.s + arm.dir * dist;
        if (s < 0 || s > road.path.length) return null;
        road.path.sample(s, q);
        return { x: q.x, z: q.z, tx: q.tx * arm.dir, tz: q.tz * arm.dir, hw: road.hwAt(s) };
      };
      const z = at(cross + M.gap + M.zebra / 2);
      if (!z || inOther(j, z.x, z.z)) continue;
      out.push({ x: z.x, y, z: z.z, yaw: Math.atan2(z.tx, z.tz), w: z.hw * 2 - 0.5, d: M.zebra, kind: 'zebra', road: road.id });
      const l = at(cross + M.gap + M.zebra + M.toLine + M.line / 2);
      if (!l || inOther(j, l.x, l.z)) continue;
      // The lanes coming in are on the left of the way they come, which is back along the arm.
      const lx = -l.tz;
      const lz = l.tx;
      const w = l.hw - 0.3;
      out.push({ x: l.x + lx * (w / 2 + 0.15), y, z: l.z + lz * (w / 2 + 0.15), yaw: Math.atan2(l.tx, l.tz), w, d: M.line, kind: 'stop', road: road.id });
    }
  }
  return out;
}
