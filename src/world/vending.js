/**
 * Vending machines along the town's streets, the lit boxes every Japanese street has at night:
 * one to three side by side at the outer edge of a sidewalk, their backs to the frontage and their
 * fronts to the road, more in the residential streets than downtown. They keep clear of the
 * junctions, the lamp posts, the forecourts and the lots, and they are solid. Each cluster throws a
 * small cool light on the pavement in front of it (`GLOW`). Pure.
 */

import { makeRng } from '../core/rng.js';
import { cityStyle, SEED } from './layout.js';
import { padDistance } from './ground.js';

/** A machine's size, meters, and how many front designs there are. */
export const VENDING = { w: 0.95, d: 0.78, h: 1.83, designs: 4 };
/**
 * A cluster's light: a dim cool white, so in a crowded light cell it gives way to the street lamps
 * (the pools keep the strongest), meters in front of the machines, high and far it reaches.
 */
export const GLOW = { c: [0.62, 0.7, 0.82], ahead: 1.1, y: 1.0, range: 5.5 };
/** Meters of street between clusters, by the area's style. */
const EVERY = { residential: [70, 150], midtown: [110, 220], downtown: [160, 300] };

/**
 * @typedef {{ x: number, y: number, z: number, yaw: number, design: number }} Machine
 * Standing on (x, y, z), its front facing `yaw` (toward the road).
 */

/**
 * @param {import('./ground.js').Ground} ground
 * @param {import('./scatter.js').Circle[]} circles the lamp posts placed so far; the machines' own boxes go in `boxes`
 * @param {import('./scatter.js').Box[]} boxes
 * @param {import('./scatter.js').BakeLight[]} [lights]
 * @returns {Machine[]}
 */
export function placeVending(ground, circles, boxes, lights = []) {
  const rng = makeRng(SEED ^ 0x7e4d);
  /** @type {Machine[]} */
  const out = [];
  const q = { x: 0, z: 0, tx: 0, tz: 1 };
  const hit = { road: null, s: 0, d: 0, h: 0, edge: 0 };
  const posts = new Map();
  for (const c of circles) {
    const k = `${Math.floor(c.x / 20)},${Math.floor(c.z / 20)}`;
    const list = posts.get(k);
    if (list) list.push(c);
    else posts.set(k, [c]);
  }
  const nearPost = (x, z) => {
    const cx = Math.floor(x / 20);
    const cz = Math.floor(z / 20);
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        for (const c of posts.get(`${cx + dx},${cz + dz}`) || []) if (Math.hypot(c.x - x, c.z - z) < c.r + 1.2) return true;
      }
    }
    return false;
  };
  const nearJunction = (x, z) => ground.junctions.some((j) => Math.abs(j.x - x) < j.r + 12 && Math.abs(j.z - z) < j.r + 12 && Math.hypot(j.x - x, j.z - z) < j.r + 9);
  const nearPad = (x, z) => ground.flats.some((pad) => padDistance(pad, x, z) < 4);

  for (const road of ground.roads.roads) {
    if (road.def.cls !== 'street' || !road.walk || road.lifted) continue;
    const p = road.path;
    let s = rng.range(20, 80);
    while (s < p.length - 20) {
      p.sample(s, q);
      const style = cityStyle(q.x, q.z);
      const gap = style && EVERY[style];
      if (!gap) {
        s += 60;
        continue;
      }
      const side = rng.next() < 0.5 ? 1 : -1;
      const count = 1 + Math.floor(rng.next() * rng.next() * 3.2);
      const design = Math.floor(rng.next() * VENDING.designs);
      const lx = q.tz * side;
      const lz = -q.tx * side;
      const off = road.hwAt(s) + road.walk - VENDING.d / 2 - 0.08;
      const yaw = Math.atan2(-lx, -lz);
      const spots = [];
      for (let k = 0; k < count; k++) {
        const along = (k - (count - 1) / 2) * (VENDING.w + 0.06);
        const x = q.x + lx * off + q.tx * along;
        const z = q.z + lz * off + q.tz * along;
        spots.push({ x, z });
      }
      const clear = spots.every(({ x, z }) => {
        if (nearPost(x, z) || nearJunction(x, z) || nearPad(x, z)) return false;
        // On its own sidewalk and on no other road.
        if (ground.roads.query(x, z, hit, 0.2) && hit.road !== road) return false;
        // Nor in the carriageway of a road that crosses its sidewalk at a slant.
        return !ground.roads.carriageway(x, z, Math.hypot(VENDING.w / 2, VENDING.d / 2) + 0.1, road.heightAt(s));
      });
      if (clear) {
        const y = road.heightAt(s) + 0.16;
        spots.forEach(({ x, z }, k) => {
          out.push({ x, y, z, yaw, design: (design + (k === 1 ? 1 : 0)) % VENDING.designs });
          boxes.push({ x, z, hx: VENDING.w / 2, hz: VENDING.d / 2, yaw, y0: y - 0.2, y1: y + VENDING.h });
        });
        const cx = q.x + lx * (off - VENDING.d / 2 - GLOW.ahead);
        const cz = q.z + lz * (off - VENDING.d / 2 - GLOW.ahead);
        lights.push({ x: cx, y: y + GLOW.y, z: cz, c: [...GLOW.c], range: GLOW.range });
      }
      s += rng.range(gap[0], gap[1]);
    }
  }
  return out;
}
