/**
 * Where things go: street lamps, trees, town buildings, gas station furniture and the
 * baked light sources they carry. Pure: positions and sizes only, so the mesh builders,
 * the light baker and the collision grid all read the same lists.
 */

import { TOWN, SEED } from './layout.js';
import { padDistance } from './ground.js';
import { makeRng } from '../core/rng.js';
import { placeForest } from './forest.js';
import { SKIRT, ELEVATED } from './roads.js';

/** @typedef {import('./ground.js').Ground} Ground */
/** @typedef {import('./ground.js').Pad} Pad */

/**
 * A point light that only exists in the baked vertex light.
 * @typedef {{ x: number, y: number, z: number, c: number[], range: number }} BakeLight
 */
/** @typedef {{ x: number, z: number, y: number, yaw: number, hx: number, hy: number, hz: number }} Lamp */
/** @typedef {import('./forest.js').Tree} Tree */
/**
 * A box building. (x, z) is the footprint center, yaw turns its local +Z toward the
 * street, w runs along the street and d away from it.
 * @typedef {{ x: number, z: number, y: number, yaw: number, w: number, d: number, h: number, kind: string, seed: number, sign: number }} Building
 */
/** @typedef {{ x: number, z: number, r: number, y0?: number, y1?: number }} Circle */
/**
 * Oriented box. Local X is (cos yaw, -sin yaw), local Z is (sin yaw, cos yaw), the same
 * frame a car with that yaw has. For a pad, padYaw makes local X run along the road.
 * @typedef {{ x: number, z: number, hx: number, hz: number, yaw: number, y0?: number, y1?: number }} Box
 */

export const LAMP_HEIGHT = 7.2;
export const LAMP_REACH = 2.4;
const SODIUM = [5.5, 3.0, 1.1];
const CANOPY_WHITE = [0.6, 0.66, 0.74];

/**
 * Pad-local to world. u runs along the road, v away from it.
 * @param {Pad} pad @param {number} u @param {number} v
 */
export function padPoint(pad, u, v) {
  return { x: pad.cx + pad.ux * u + pad.vx * v, z: pad.cz + pad.uz * u + pad.vz * v };
}

/** Yaw that turns local +Z to point along the pad's +v (away from the road). @param {Pad} pad */
export function padYaw(pad) {
  return Math.atan2(pad.vx, pad.vz);
}

/**
 * Furniture of one gas station in pad-local coordinates (u along the road, v away).
 * @param {Pad} pad
 */
export function stationLayout(pad) {
  const hw = pad.hw;
  const hd = pad.hd;
  if (pad.station.servicePark) {
    return {
      canopy: { u0: -hw + 4, u1: -hw + 20, v0: -hd + 3, v1: -hd + 13, h: 5 },
      islands: [{ u: -hw + 12, v: -hd + 8, len: 9 }],
      pumps: [{ u: -hw + 9.5, v: -hd + 8 }, { u: -hw + 14.5, v: -hd + 8 }],
      kiosk: { u: -hw + 12, v: hd - 6, w: 10, d: 7, h: 3.6 },
      sign: { u: -hw + 2, v: -hd + 1.5 },
      tents: [-4, 9, 22].map((u) => ({ u, v: hd - 9, w: 7, d: 7 })),
      floods: [[-hw + 1, hd - 1], [hw - 1, hd - 1], [hw - 1, -hd + 1], [6, -hd + 1]].map(([u, v]) => ({ u, v })),
    };
  }
  return {
    canopy: { u0: -hw * 0.5, u1: hw * 0.5, v0: -hd + 5, v1: -hd + 5 + hd * 1.05, h: 5.2 },
    islands: [
      { u: 0, v: -hd + 10, len: hw * 0.62 },
      { u: 0, v: -hd + 10 + hd * 0.5, len: hw * 0.62 },
    ],
    pumps: [],
    kiosk: { u: hw * 0.45, v: hd - 6, w: 15, d: 9, h: 4.2 },
    sign: { u: -hw + 3, v: -hd + 1.5 },
    tents: [],
    floods: [],
  };
}

/**
 * Everything placed in the valley, computed once from the ground.
 * @param {Ground} ground
 */
export function scatterWorld(ground) {
  /** @type {BakeLight[]} */
  const lights = [];
  /** @type {Circle[]} */
  const circles = [];
  /** @type {Box[]} */
  const boxes = [];
  const lamps = placeLamps(ground, lights, circles);
  const stations = ground.pads.map((pad) => placeStation(ground, pad, lights, circles, boxes));
  const buildings = placeBuildings(ground, lights, boxes);
  const trees = placeForest(ground, buildings, circles, clearOfRoads);
  const bridges = placeBridges(ground, circles, boxes);
  return { lamps, stations, buildings, trees, bridges, lights, circles, boxes };
}

/** Lift (m) from which a road gets side walls, and from which it counts as a deck with piers. */
export const WALL_LIFT = 1.2;
const PIER_EVERY = 22;
const WALL_SEGMENT = 6;

/**
 * Overpasses and viaducts: for every stretch of a lifted road that is clear of the ground,
 * the wall segments along both edges and the piers under it, with colliders at the right
 * height so a car underneath never touches them.
 *
 * @typedef {{ road: import('./roads.js').Road, i0: number, i1: number,
 *   piers: { x: number, z: number, top: number, bottom: number, yaw: number }[] }} Bridge
 * @param {Ground} ground @param {Circle[]} circles @param {Box[]} boxes
 * @returns {Bridge[]}
 */
function placeBridges(ground, circles, boxes) {
  /** @type {Bridge[]} */
  const out = [];
  const hit = { road: null, s: 0, d: 0, h: 0, edge: 0 };
  for (const road of ground.roads.roads) {
    if (!road.lifted) continue;
    const p = road.path;
    let start = -1;
    for (let i = 0; i <= p.n; i++) {
      const up = i < p.n && road.lift[i] > WALL_LIFT;
      if (up && start < 0) start = i;
      if (start >= 0 && !up) {
        out.push({ road, i0: start, i1: i - 1, piers: [] });
        start = -1;
      }
    }
  }
  for (const b of out) {
    const { road } = b;
    const p = road.path;
    const q = { x: 0, z: 0, tx: 0, tz: 1 };
    for (let s = b.i0 * p.step; s < b.i1 * p.step; s += WALL_SEGMENT) {
      const mid = Math.min(b.i1 * p.step, s + WALL_SEGMENT / 2);
      p.sample(mid, q);
      const top = road.heightAt(mid);
      const yaw = Math.atan2(q.tx, q.tz);
      for (const side of [1, -1]) {
        const off = road.hw + 0.35;
        boxes.push({ x: q.x + q.tz * off * side, z: q.z - q.tx * off * side, hx: 0.3, hz: WALL_SEGMENT / 2, yaw, y0: top - 0.3, y1: top + 1.0 });
      }
    }
    const spots = [];
    for (let s = b.i0 * p.step; s < b.i1 * p.step; s += PIER_EVERY) spots.push(s);
    // One under the middle of every lift, which is where the road it crosses has its median.
    for (const L of road.def.lifts || []) {
      const mid = p.nearest(L.at[0], L.at[1]).s;
      if (mid >= b.i0 * p.step && mid <= b.i1 * p.step) spots.push(mid);
    }
    for (const s of spots) {
      p.sample(s, q);
      if (road.liftAt(s) < ELEVATED + 1.5) continue;
      if (ground.roads.query(q.x, q.z, hit, -SKIRT)) continue;
      const top = road.heightAt(s);
      const bottom = ground.at(q.x, q.z).h;
      b.piers.push({ x: q.x, z: q.z, top, bottom, yaw: Math.atan2(q.tx, q.tz) });
      circles.push({ x: q.x, z: q.z, r: 0.9, y1: top - 0.8 });
    }
  }
  return out;
}

/** True when (x, z) is clear of every road surface, skirt and pad by `margin`. */
function clearOfRoads(ground, x, z, margin) {
  const hit = { road: null, s: 0, d: 0, h: 0, edge: 0 };
  if (ground.roads.influence(x, z, margin + SKIRT, hit) && hit.edge < margin + SKIRT) return false;
  for (const pad of ground.pads) if (padDistance(pad, x, z) < margin) return false;
  return true;
}

/** @param {Ground} ground @param {BakeLight[]} lights @param {Circle[]} circles */
function placeLamps(ground, lights, circles) {
  /** @type {Lamp[]} */
  const lamps = [];
  for (const road of ground.roads.roads) {
    const p = road.path;
    for (const run of road.def.lamps || []) {
      const s0 = p.nearest(run.from[0], run.from[1]).s;
      let s1 = p.nearest(run.to[0], run.to[1]).s;
      if (p.closed && s1 < s0) s1 += p.length;
      let k = 0;
      for (let s = s0; s <= s1 + 0.1; s += run.every, k++) {
        const q = p.sample(s);
        const side = k % 2 === 0 ? 1 : -1;
        const lx = q.tz * side;
        const lz = -q.tx * side;
        const off = road.hw + SKIRT + 0.8;
        const x = q.x + lx * off;
        const z = q.z + lz * off;
        if (!clearOfRoads(ground, x, z, 0.5)) continue;
        const y = ground.at(x, z).h;
        const yaw = Math.atan2(-lx, -lz);
        const hx = x - lx * LAMP_REACH;
        const hz = z - lz * LAMP_REACH;
        lamps.push({ x, y, z, yaw, hx, hy: y + LAMP_HEIGHT, hz });
        lights.push({ x: hx, y: y + LAMP_HEIGHT, z: hz, c: SODIUM, range: 19 });
        circles.push({ x, z, r: 0.22 });
      }
    }
  }
  return lamps;
}

/**
 * @param {Ground} ground @param {Pad} pad @param {BakeLight[]} lights
 * @param {Circle[]} circles @param {Box[]} boxes
 */
function placeStation(ground, pad, lights, circles, boxes) {
  const L = stationLayout(pad);
  const yaw = padYaw(pad);
  const c = L.canopy;
  /** @type {{ u: number, v: number }[]} */
  const canopyLights = [];
  for (let u = c.u0 + 3; u < c.u1 - 1; u += 6) {
    for (let v = c.v0 + 2.5; v < c.v1 - 1; v += 5) {
      const p = padPoint(pad, u, v);
      canopyLights.push({ u, v });
      lights.push({ x: p.x, y: pad.h + c.h - 0.6, z: p.z, c: CANOPY_WHITE, range: 13 });
    }
  }
  /** @type {{ x: number, z: number, u: number, v: number }[]} */
  const pillars = [];
  for (const isl of L.islands) {
    for (const s of [-1, 1]) {
      const u = isl.u + s * (isl.len / 2 + 0.6);
      const p = padPoint(pad, u, isl.v);
      pillars.push({ ...p, u, v: isl.v });
      circles.push({ x: p.x, z: p.z, r: 0.4 });
    }
    const p = padPoint(pad, isl.u, isl.v);
    boxes.push({ x: p.x, z: p.z, hx: isl.len / 2, hz: 0.7, yaw });
  }
  const pumps = L.pumps.length
    ? L.pumps
    : L.islands.flatMap((isl) => [-0.25, 0.25].map((f) => ({ u: isl.u + f * isl.len, v: isl.v })));
  const k = L.kiosk;
  const kp = padPoint(pad, k.u, k.v);
  boxes.push({ x: kp.x, z: kp.z, hx: k.w / 2, hz: k.d / 2, yaw });
  const kf = padPoint(pad, k.u, k.v - k.d / 2 - 1.5);
  lights.push({ x: kf.x, y: pad.h + 2.6, z: kf.z, c: [1.6, 1.35, 0.95], range: 10 });
  const sp = padPoint(pad, L.sign.u, L.sign.v);
  circles.push({ x: sp.x, z: sp.z, r: 0.35 });
  lights.push({ x: sp.x, y: pad.h + 7, z: sp.z, c: pad.station.brand === 'hoshi' ? [0.3, 0.5, 1.0] : [1.0, 0.45, 0.15], range: 10 });
  for (const t of L.tents) {
    for (const [du, dv] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      const p = padPoint(pad, t.u + (du * t.w) / 2, t.v + (dv * t.d) / 2);
      circles.push({ x: p.x, z: p.z, r: 0.12 });
    }
    const p = padPoint(pad, t.u, t.v);
    lights.push({ x: p.x, y: pad.h + 2.4, z: p.z, c: [1.0, 0.9, 0.7], range: 8 });
  }
  for (const f of L.floods) {
    const p = padPoint(pad, f.u, f.v);
    circles.push({ x: p.x, z: p.z, r: 0.25 });
    const inward = padPoint(pad, f.u * 0.8, f.v * 0.8);
    lights.push({ x: inward.x, y: pad.h + 8, z: inward.z, c: [1.5, 1.6, 1.7], range: 28 });
  }
  return { pad, layout: L, yaw, pillars, canopyLights, pumps: pumps.map((q) => ({ ...q, ...padPoint(pad, q.u, q.v) })) };
}

/** @param {Ground} ground @param {BakeLight[]} lights @param {Box[]} boxes */
function placeBuildings(ground, lights, boxes) {
  const rng = makeRng(SEED ^ 0xb11d);
  /** @type {Building[]} */
  const out = [];
  const inTown = (x, z) => x > TOWN.x0 && x < TOWN.x1 && z > TOWN.z0 && z < TOWN.z1;
  const corners = (b) => {
    const c = Math.cos(b.yaw);
    const s = Math.sin(b.yaw);
    const pts = [];
    for (const [a, d] of [[-1, -1], [1, -1], [1, 1], [-1, 1], [0, 0], [0, -1], [0, 1], [-1, 0], [1, 0]]) {
      const lx = (a * b.w) / 2;
      const lz = (d * b.d) / 2;
      pts.push([b.x + lx * c + lz * s, b.z - lx * s + lz * c]);
    }
    return pts;
  };
  const overlaps = (b) =>
    out.some((o) => Math.hypot(o.x - b.x, o.z - b.z) < (Math.max(o.w, o.d) + Math.max(b.w, b.d)) * 0.55);
  let konbini = 0;
  for (const road of ground.roads.roads) {
    if (road.surface !== 'asphalt') continue;
    const p = road.path;
    for (let s = 6; s < p.length - 6; s += rng.range(13, 19)) {
      const q = p.sample(s);
      if (!inTown(q.x, q.z)) continue;
      for (const side of [1, -1]) {
        if (rng.chance(0.18)) continue;
        const lx = q.tz * side;
        const lz = -q.tx * side;
        const w = rng.range(8, 15);
        const d = rng.range(8, 14);
        const setback = road.hw + SKIRT + 3 + d / 2;
        const x = q.x + lx * setback;
        const z = q.z + lz * setback;
        const isKonbini = konbini < 2 && rng.chance(0.08);
        const b = {
          x,
          z,
          y: 0,
          yaw: Math.atan2(-lx, -lz),
          w: isKonbini ? 16 : w,
          d: isKonbini ? 12 : d,
          h: isKonbini ? 4.2 : rng.chance(0.3) ? rng.range(12, 22) : rng.range(5, 11),
          kind: isKonbini ? 'konbini' : 'block',
          seed: rng.int(0, 1e6),
          sign: rng.chance(0.55) ? rng.int(0, 7) : -1,
        };
        if (!inTown(x, z) || overlaps(b)) continue;
        if (!corners(b).every(([cx, cz]) => clearOfRoads(ground, cx, cz, 1.5))) continue;
        let lo = Infinity;
        for (const [cx, cz] of corners(b)) lo = Math.min(lo, ground.at(cx, cz).h);
        b.y = lo - 0.3;
        if (isKonbini) konbini++;
        out.push(b);
        boxes.push({ x: b.x, z: b.z, hx: b.w / 2, hz: b.d / 2, yaw: b.yaw });
        const fx = x - lx * (b.d / 2 + 1.2);
        const fz = z - lz * (b.d / 2 + 1.2);
        if (b.kind === 'konbini') lights.push({ x: fx, y: b.y + 2.5, z: fz, c: [1.8, 2.0, 2.0], range: 15 });
        else if (b.sign >= 0) lights.push({ x: fx, y: b.y + 4, z: fz, c: SIGN_COLORS[b.sign % SIGN_COLORS.length], range: 7 });
      }
    }
  }
  return out;
}

/** Neon sign colors, indexed by Building.sign. */
export const SIGN_COLORS = [
  [1.0, 0.25, 0.6],
  [0.3, 0.9, 1.0],
  [1.0, 0.7, 0.2],
  [0.4, 1.0, 0.45],
  [1.0, 0.3, 0.25],
  [0.75, 0.45, 1.0],
  [1.0, 0.95, 0.5],
  [0.3, 0.55, 1.0],
];
