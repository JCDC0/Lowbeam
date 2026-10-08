/**
 * Utility poles and their overhead wires along the town's back streets, the way every Japanese
 * residential, port and industrial street has them (downtown and midtown run theirs underground):
 * concrete poles about 30 m apart on one side of the street at the sidewalk's outer edge, a crossarm
 * with three power lines near the top, two telephone lines lower down, a transformer on some. Poles
 * step aside from the street lamps and stay out of the junctions; the wires carry on across them.
 * Poles are solid. Pure.
 */

import { makeRng } from '../core/rng.js';
import { cityStyle, SEED } from './layout.js';

/** Meters: the pole's height and foot radius, the spacing, the longest span a wire makes. */
export const POLE = { h: 11.5, r: 0.18, every: 30, maxSpan: 48, arm: 10.4, phone: 6.6 };
/** The wires across the pole, in its frame (x across the road, positive to the left; y up), meters. */
export const WIRES = [[-0.75, 10.45], [0, 10.45], [0.75, 10.45], [0.22, 6.6], [0.22, 6.2]];
/** How far each wire sags at the middle of a span per meter of span. */
export const SAG = 0.018;

/**
 * @typedef {{ x: number, y: number, z: number, yaw: number, transformer: boolean }} Pole
 * @typedef {{ poles: Pole[], spans: [number, number][] }} PoleLine
 */

/**
 * @param {import('./ground.js').Ground} ground
 * @param {import('./scatter.js').Circle[]} circles the lamp posts so far; the poles' own circles are added
 * @returns {PoleLine}
 */
export function placePoles(ground, circles) {
  const rng = makeRng(SEED ^ 0x5017);
  /** @type {Pole[]} */
  const poles = [];
  /** @type {[number, number][]} */
  const spans = [];
  const q = { x: 0, z: 0, tx: 0, tz: 1 };
  const hit = { road: null, s: 0, d: 0, h: 0, edge: 0 };
  const index = new Map();
  for (const c of circles) {
    const k = `${Math.floor(c.x / 20)},${Math.floor(c.z / 20)}`;
    const list = index.get(k);
    if (list) list.push(c);
    else index.set(k, [c]);
  }
  const taken = (x, z, room) => {
    const cx = Math.floor(x / 20);
    const cz = Math.floor(z / 20);
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        for (const c of index.get(`${cx + dx},${cz + dz}`) || []) if (Math.hypot(c.x - x, c.z - z) < c.r + room) return true;
      }
    }
    return false;
  };
  const wired = new Set(['residential', 'port', 'industrial']);

  for (const road of ground.roads.roads) {
    if (road.def.cls !== 'street' || !road.walk || road.lifted) continue;
    const p = road.path;
    const side = rng.next() < 0.5 ? 1 : -1;
    const junctions = ground.junctionSpans.get(road) || [];
    let last = -1;
    let lastS = -Infinity;
    for (let s = rng.range(4, POLE.every); s < p.length - 4; s += POLE.every) {
      let placed = false;
      for (const shift of [0, 3, -3, 6]) {
        const ps = s + shift;
        if (ps < 2 || ps > p.length - 2) continue;
        if (junctions.some(([a, b]) => ps > a - 4 && ps < b + 4)) continue;
        p.sample(ps, q);
        if (!wired.has(/** @type {string} */ (cityStyle(q.x, q.z)))) break;
        const lx = q.tz * side;
        const lz = -q.tx * side;
        const off = road.hwAt(ps) + road.walk - 0.3;
        const x = q.x + lx * off;
        const z = q.z + lz * off;
        if (taken(x, z, 1.8)) continue;
        if (ground.roads.query(x, z, hit, 0) && hit.road !== road) continue;
        const y = road.heightAt(ps) + 0.16;
        if (last >= 0 && ps - lastS < POLE.maxSpan) spans.push([last, poles.length]);
        last = poles.length;
        lastS = ps;
        poles.push({ x, y, z, yaw: Math.atan2(q.tx, q.tz), transformer: rng.next() < 0.18 });
        const circle = { x, z, r: POLE.r + 0.04 };
        circles.push(circle);
        const k = `${Math.floor(x / 20)},${Math.floor(z / 20)}`;
        const list = index.get(k);
        if (list) list.push(circle);
        else index.set(k, [circle]);
        placed = true;
        break;
      }
      if (!placed && s - lastS > POLE.maxSpan) last = -1;
    }
  }
  return { poles, spans };
}
