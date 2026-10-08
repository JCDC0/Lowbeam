/**
 * Route 1's overhead sign gantries, after the Shuto Expressway's: before every exit a steel truss
 * across the carriageway, one standing about 500 m out with the distance on it and one at the start
 * of the exit lane with an arrow down to it, each carrying a green guide sign (the destination in
 * kanji and romaji, 出口 for an exit, JCT for a junction onto another expressway) beside a sign for
 * the loop itself. Pure: positions, the signs' words and the posts' colliders; build-highway.js
 * draws them.
 */

import { SKIRT } from './roads.js';
import { padDistance } from './ground.js';
import { AREA_JP } from './layout.js';

/**
 * Where an exit leads, by the road its ramp joins: the area's name under the road's. Roads not
 * listed show their own name only.
 * @type {Record<string, { jp: string, en: string }>}
 */
const AREA_OF = {
  r18: { jp: '北町', en: 'KITAMACHI' },
  harbor: { jp: '黒鉄港', en: 'KUROGANE HARBOR' },
  west: { jp: '西町', en: 'NISHIMACHI' },
  east: { jp: '東工業地帯', en: 'HIGASHI KOGYO' },
  c2: { jp: '湾岸', en: 'BAYSHORE' },
  c3: { jp: '都心', en: 'DOWNTOWN' },
};
/** The loop's two carriageways: the forward one is the outer loop, the reverse the inner. */
const LOOP = { 'c1-f': { jp: '外回り', en: 'OUTER LOOP' }, 'c1-r': { jp: '内回り', en: 'INNER LOOP' } };

/** Meters before the nose to try for the far gantry, nearest the ideal first. */
const FAR = [500, 450, 550, 400, 600, 350, 650, 300];
/** Meters before the exit lane opens to try for the near gantry. */
const NEAR = [40, 60, 25, 80, 100, 120];
/**
 * The truss: the posts stand `post` meters out from the outer edge and on the median's barrier;
 * the signs hang from `low` to `high` meters over the road. No gantry within `gap` meters of
 * another on the same carriageway.
 */
export const GANTRY = { post: 1.9, low: 5.5, high: 8.1, gap: 140, maxDrop: 8 };

/**
 * @typedef {{ jp: string, en: string, sub: { jp: string, en: string } | null, jct: boolean,
 *   distance: number | null }} ExitSign
 * @typedef {{ x: number, z: number, y: number, yaw: number, hw: number, median: number,
 *   outer: number, inner: number, exit: ExitSign, loop: { jp: string, en: string }, near: boolean,
 *   carriage: string, s: number, ramp: string }} Gantry
 * `x, z, y, yaw` is the carriageway's center line under the truss, facing the way traffic goes;
 * `ramp` is the exit's slip road;
 * `outer` and `inner` are how far below the road each post's foot stands (the ground falls away
 * from an embankment).
 */

/**
 * @param {import('./ground.js').Ground} ground
 * @param {(x: number, z: number) => boolean} inPlaza true near a toll plaza
 * @param {import('./scatter.js').Circle[]} circles
 * @returns {Gantry[]}
 */
export function placeGantries(ground, inPlaza, circles) {
  const q = { x: 0, z: 0, tx: 0, tz: 1 };
  const hit = { road: null, s: 0, d: 0, h: 0, edge: 0 };
  /** @type {Gantry[]} */
  const out = [];
  /** @type {Map<string, number[]>} */
  const taken = new Map();

  /**
   * The gantry at `s` on carriageway `C`, or null where it cannot stand: in a plaza, on a viaduct,
   * a post on another road or a forecourt, or the ground too far below.
   * @param {import('./roads.js').Road} C @param {number} s
   */
  const fit = (C, s) => {
    const p = C.path;
    s = p.wrapS(s);
    if (C.lifted && C.liftAt(s) > 1.2) return null;
    const near = taken.get(C.def.id) || [];
    if (near.some((t) => Math.abs(wrapDelta(t, s, p.length)) < GANTRY.gap)) return null;
    p.sample(s, q);
    const y = C.heightAt(s);
    const hw = C.hw;
    const median = /** @type {number} */ (C.def.median ?? 3.2) / 2 + hw;
    const lx = q.tz;
    const lz = -q.tx;
    if (inPlaza(q.x, q.z)) return null;
    const drops = [];
    for (const d of [hw + GANTRY.post, -median]) {
      const x = q.x + lx * d;
      const z = q.z + lz * d;
      for (const pad of ground.pads) if (padDistance(pad, x, z) < 8) return null;
      if (d > 0) {
        if (ground.roads.query(x, z, hit, SKIRT + 1.5) && hit.road && hit.road !== C && hit.road.def.cls !== 'expressway') return null;
        const g = ground.hf.at(x, z);
        if (y - g > GANTRY.maxDrop) return null;
        drops.push(Math.max(0, y - g) + 0.4);
      } else drops.push(0.4);
    }
    return { x: q.x, z: q.z, y, yaw: Math.atan2(q.tx, q.tz), hw, median, outer: drops[0], inner: drops[1], s, lx, lz };
  };

  for (const road of ground.roads.roads) {
    const slip = road.def.slip;
    if (!slip || slip.kind !== 'exit' || !LOOP[slip.carriageId]) continue;
    const C = /** @type {import('./roads.js').Road} */ (ground.roads.byId.get(slip.carriageId));
    const to = road.def.link?.to?.id;
    const dest = to && ground.roads.byId.get(to);
    if (!C || !dest) continue;
    const key = to.replace(/-[fr]$/, '');
    const name = dest.def.name;
    const jct = dest.def.cls === 'expressway';
    const base = { jp: AREA_JP[name] || name, en: name, sub: AREA_OF[key] || null, jct };
    const nose = slip.nose;
    const open = slip.attach[0];

    /** @param {number[]} tries @param {boolean} isNear @param {number} from */
    const stand = (tries, isNear, from) => {
      for (const back of tries) {
        const g = fit(C, from - back);
        if (!g) continue;
        const ahead = C.path.wrapS(nose - g.s + C.path.length) % C.path.length;
        /** @type {ExitSign} */
        const exit = { ...base, distance: isNear ? null : Math.round(ahead / 100) * 100 };
        out.push({ x: g.x, z: g.z, y: g.y, yaw: g.yaw, hw: g.hw, median: g.median, outer: g.outer, inner: g.inner,
          exit, loop: LOOP[slip.carriageId], near: isNear, carriage: C.def.id, s: g.s, ramp: road.def.id });
        const list = taken.get(C.def.id) || [];
        list.push(g.s);
        taken.set(C.def.id, list);
        for (const d of [g.hw + GANTRY.post, -g.median]) circles.push({ x: g.x + g.lx * d, z: g.z + g.lz * d, r: 0.35 });
        return;
      }
    };
    stand(NEAR, true, open);
    stand(FAR, false, nose);
  }
  return out;
}

/** The signed distance from `a` to `b` along a loop of `len`. */
function wrapDelta(a, b, len) {
  let d = b - a;
  if (d > len / 2) d -= len;
  if (d < -len / 2) d += len;
  return d;
}
