/**
 * The blue direction signs (案内標識) before the crossings where two avenues meet: on every avenue
 * way in, about 45 m before the crossing, a cantilever over the lanes holding a blue panel that draws
 * the crossing as arrows (each way out at its own angle) with the place each one leads to, in kanji
 * and romaji. A way's place is the district its road reaches about 600 m on, or the zone outside the
 * town; where two ways would read the same, the later one tries farther on (1.2 km, the road's end)
 * and at last the road's own name. Crossings with fewer than two ways out (an avenue bending into
 * another road) get none. Pure.
 */

import { AREA_JP } from './layout.js';
import { zoneAt } from './zones.js';

/** Meters: how far before the crossing, the panel's size and height, the pole's radius. */
export const GUIDE = { back: [45, 35, 58, 28, 22], w: 3.8, h: 2.6, low: 5.0, pole: 0.16, reach: [600, 1200, Infinity] };

/**
 * @typedef {{ angle: number, jp: string, en: string }} Way an arrow: `angle` from straight ahead, positive to the left
 * @typedef {{ x: number, y: number, z: number, yaw: number, px: number, pz: number, py: number, arm: number,
 *   ways: Way[], road: string }} GuideSign
 * The panel's center (x, y, z) facing the cars coming up (`yaw` their direction); the pole's foot;
 * the arm's length from the pole to the panel's far edge.
 */

/**
 * @param {import('./ground.js').Ground} ground
 * @param {import('./scatter.js').Circle[]} circles the posts placed so far; the signs' own are added
 * @returns {GuideSign[]}
 */
export function placeGuideSigns(ground, circles) {
  /** @type {GuideSign[]} */
  const out = [];
  const avenue = (r) => r.def.cls === 'arterial';
  const q = { x: 0, z: 0, tx: 0, tz: 1 };
  const hit = { road: null, s: 0, d: 0, h: 0, edge: 0 };
  for (const j of ground.junctions) {
    const roads = new Set(j.arms.filter((a) => avenue(a.road)).map((a) => a.road));
    if (roads.size < 2) continue;
    if (j.arms.length < 3) continue;
    /** @type {Map<import('./junctions.js').Arm, { jp: string, en: string }[]>} */
    const places = new Map();
    for (const arm of j.arms) places.set(arm, placesAlong(ground, arm));
    for (const arm of j.arms) {
      if (!avenue(arm.road) || !arm.road.walk) continue;
      const road = arm.road;
      for (const back of GUIDE.back) {
        const s = arm.s + arm.dir * (j.r + back);
        if (!road.path.closed && (s < 0 || s > road.path.length)) continue;
        const sw = road.path.wrapS(s);
        road.path.sample(sw, q);
        if (ground.junctions.some((o) => o !== j && Math.hypot(o.x - q.x, o.z - q.z) < o.r + 10)) continue;
        // The cars come in against the arm's direction; their left is the sign's side.
        const fx = -q.tx * arm.dir;
        const fz = -q.tz * arm.dir;
        // No side street between the sign and its crossing, or the arrows would point at the wrong one.
        const toJ = (j.x - q.x) * fx + (j.z - q.z) * fz;
        const between = ground.junctions.some((o) => {
          if (o === j) return false;
          const a = (o.x - q.x) * fx + (o.z - q.z) * fz;
          const side = Math.abs((o.x - q.x) * fz - (o.z - q.z) * fx);
          return a > -o.r && a < toJ && side < o.r + 12;
        });
        if (between) continue;
        const lx = fz;
        const lz = -fx;
        const hw = road.hwAt(sw);
        const side = hw + road.walk * 0.6;
        const px = q.x + lx * side;
        const pz = q.z + lz * side;
        if (ground.roads.query(px, pz, hit, 0) && hit.road !== road) continue;
        if (circles.some((c) => Math.abs(c.x - px) < 2 && Math.abs(c.z - pz) < 2 && Math.hypot(c.x - px, c.z - pz) < c.r + 1.2)) continue;
        const head = Math.max(hw * 0.5, GUIDE.w / 2 + 0.3);
        const outs = [];
        for (const other of j.arms) {
          if (other === arm) continue;
          const o = other.road.path.sample(other.road.path.wrapS(other.s + other.dir * (j.r + 10)));
          const dx = o.x - j.x;
          const dz = o.z - j.z;
          outs.push({ angle: Math.atan2(dx * lx + dz * lz, dx * fx + dz * fz), other });
        }
        // Straight on is labeled first; each way then takes its first place not already on the sign.
        outs.sort((a, b) => Math.abs(a.angle) - Math.abs(b.angle));
        const used = new Set();
        /** @type {Way[]} */
        const ways = outs.map(({ angle, other }) => {
          const list = /** @type {{ jp: string, en: string }[]} */ (places.get(other));
          const pick = list.find((p) => !used.has(p.en)) || list[list.length - 1];
          used.add(pick.en);
          return { angle, en: pick.en, jp: pick.jp };
        });
        const y = road.heightAt(sw) + GUIDE.low + GUIDE.h / 2;
        out.push({ x: q.x + lx * head, y, z: q.z + lz * head, yaw: Math.atan2(fx, fz), px, pz,
          py: road.heightAt(sw) + 0.16, arm: side - head + GUIDE.w / 2, ways, road: road.id });
        // As tall as the sign, so a car on a deck above the avenue does not meet the pole.
        circles.push({ x: px, z: pz, r: GUIDE.pole + 0.04, y0: road.heightAt(sw), y1: road.heightAt(sw) + GUIDE.low + GUIDE.h });
        break;
      }
    }
  }
  return out;
}

/**
 * The places a way out of a crossing leads to, nearest first: the zone or the district its road is
 * in 600 m on, 1.2 km on and at its end, then the road's own name.
 * @param {import('./ground.js').Ground} ground @param {import('./junctions.js').Arm} arm
 */
function placesAlong(ground, arm) {
  const road = arm.road;
  const p = road.path;
  const names = [];
  for (const reach of GUIDE.reach) {
    // A ring road has no end: half way round is as far as it goes.
    let s = arm.s + arm.dir * Math.min(reach, p.closed ? p.length / 2 : reach);
    if (!p.closed) s = Math.max(0, Math.min(p.length, s));
    const q = p.sample(p.wrapS(s));
    const zone = zoneAt(q.x, q.z);
    let en = zone && zone.id !== 'city' ? zone.name : '';
    if (!en) {
      let best = Infinity;
      for (const r of ground.roads.roads) {
        if (r.def.cls !== 'street') continue;
        const h = r.path.nearest(q.x, q.z);
        const d = Math.hypot(h.x - q.x, h.z - q.z);
        if (d < best) {
          best = d;
          en = r.def.name;
        }
      }
      if (best > 150) en = '';
    }
    if (en && !names.includes(en)) names.push(en);
  }
  names.push(road.def.name);
  return names.map((en) => ({ en, jp: AREA_JP[en] || '' }));
}
