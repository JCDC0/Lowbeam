/**
 * Where the town's buildings go. Pure. Every street and avenue gets a row of buildings along each
 * side, set back to the sidewalk, and in the denser districts a second row behind it, so the
 * blocks read as built up from the street and from the expressway. What is built depends on the
 * district (`cityStyle` in layout.js): towers and offices downtown, offices and apartment blocks
 * in midtown, houses and small apartment blocks in the residential districts, warehouses, garages
 * and sheds in the port and the industrial east, a house here and there along country roads.
 *
 * Two grids keep it fast with tens of thousands of lots: a 2 m mask of every road surface,
 * sidewalk and forecourt (a footprint is tested cell by cell, not by asking the road network), and
 * a hash of the buildings placed so far for the overlap test.
 */

import { makeRng } from '../core/rng.js';
import { CITY, SEED, WATER_LEVEL, WORLD_HALF, cityStyle } from './layout.js';
import { padDistance } from './ground.js';
import { SKIRT } from './roads.js';

/** @typedef {import('./scatter.js').Building} Building */
/** @typedef {import('./scatter.js').BakeLight} BakeLight */
/** @typedef {import('./scatter.js').Box} Box */

const MASK_CELL = 2;
const MASK_OFF = WORLD_HALF + 50;
const MASK_N = Math.ceil((MASK_OFF * 2) / MASK_CELL);
/** Gap kept between a building and a road's outer edge (sidewalk included), meters. */
const SETBACK = 0.8;
/** Gap between neighboring buildings. */
const GAP = 1.2;
const HASH = 48;

/**
 * Lot rules per district style: a pick of building types with weights, and whether a second row
 * goes up behind the first.
 * @typedef {{ kind: string, w: number[], d: number[], h: number[], weight: number, roof?: string }} LotType
 * @type {Record<string, { types: LotType[], back: number, skip: number }>}
 */
const STYLES = {
  downtown: {
    back: 0.85,
    skip: 0.04,
    types: [
      { kind: 'tower', w: [18, 30], d: [18, 28], h: [45, 130], weight: 0.34 },
      { kind: 'block', w: [14, 26], d: [14, 24], h: [16, 42], weight: 0.6 },
      { kind: 'konbini', w: [16, 16], d: [12, 12], h: [4.2, 4.2], weight: 0.06 },
    ],
  },
  midtown: {
    back: 0.75,
    skip: 0.06,
    types: [
      { kind: 'tower', w: [16, 24], d: [16, 22], h: [32, 60], weight: 0.1 },
      { kind: 'block', w: [12, 24], d: [12, 20], h: [10, 30], weight: 0.62 },
      { kind: 'apartment', w: [20, 34], d: [10, 13], h: [12, 24], weight: 0.22 },
      { kind: 'konbini', w: [16, 16], d: [12, 12], h: [4.2, 4.2], weight: 0.06 },
    ],
  },
  residential: {
    back: 0.6,
    skip: 0.1,
    types: [
      { kind: 'house', w: [8, 11], d: [8, 10], h: [5.5, 7.5], weight: 0.62, roof: 'pitched' },
      { kind: 'apartment', w: [16, 26], d: [9, 12], h: [9, 16], weight: 0.27 },
      { kind: 'block', w: [9, 14], d: [9, 12], h: [6, 10], weight: 0.08 },
      { kind: 'konbini', w: [16, 16], d: [12, 12], h: [4.2, 4.2], weight: 0.03 },
    ],
  },
  port: {
    back: 0.45,
    skip: 0.15,
    types: [
      { kind: 'warehouse', w: [30, 60], d: [22, 36], h: [9, 14], weight: 0.66, roof: 'shed' },
      { kind: 'garage', w: [14, 20], d: [12, 16], h: [5, 6.5], weight: 0.16 },
      { kind: 'block', w: [12, 18], d: [10, 14], h: [8, 16], weight: 0.18 },
    ],
  },
  industrial: {
    back: 0.5,
    skip: 0.12,
    types: [
      { kind: 'warehouse', w: [26, 56], d: [20, 40], h: [8, 13], weight: 0.5, roof: 'shed' },
      { kind: 'garage', w: [14, 22], d: [12, 16], h: [5, 6.5], weight: 0.28 },
      { kind: 'factory', w: [30, 50], d: [24, 36], h: [10, 15], weight: 0.14, roof: 'saw' },
      { kind: 'block', w: [10, 14], d: [10, 12], h: [6, 10], weight: 0.08 },
    ],
  },
  country: {
    back: 0,
    skip: 0.9,
    types: [{ kind: 'house', w: [8, 11], d: [8, 10], h: [5.5, 7.5], weight: 1, roof: 'pitched' }],
  },
};

/** Every road surface, sidewalk and skirt, and every forecourt, as a 2 m grid. */
export class RoadMask {
  /** @param {import('./ground.js').Ground} ground @param {number} margin extra meters marked past each edge */
  constructor(ground, margin = SETBACK) {
    this.m = new Uint8Array(MASK_N * MASK_N);
    for (const road of ground.roads.roads) {
      const p = road.path;
      for (let i = 0; i < p.n; i++) {
        const r = road.hwAt(i * p.step) + road.walk + SKIRT + margin;
        this.disc(p.x[i], p.z[i], r);
      }
    }
    for (const pad of ground.pads) {
      const r = Math.hypot(pad.hw, pad.hd) + 4;
      for (let z = pad.cz - r; z <= pad.cz + r; z += MASK_CELL) {
        for (let x = pad.cx - r; x <= pad.cx + r; x += MASK_CELL) if (padDistance(pad, x, z) < 4) this.set(x, z);
      }
    }
  }

  /** @param {number} x @param {number} z */
  key(x, z) {
    const i = Math.floor((x + MASK_OFF) / MASK_CELL);
    const j = Math.floor((z + MASK_OFF) / MASK_CELL);
    if (i < 0 || j < 0 || i >= MASK_N || j >= MASK_N) return -1;
    return j * MASK_N + i;
  }

  /** @param {number} x @param {number} z */
  set(x, z) {
    const k = this.key(x, z);
    if (k >= 0) this.m[k] = 1;
  }

  /** @param {number} x @param {number} z @param {number} r */
  disc(x, z, r) {
    for (let dz = -r; dz <= r; dz += MASK_CELL / 2) {
      const w = Math.sqrt(Math.max(0, r * r - dz * dz));
      for (let dx = -w; dx <= w; dx += MASK_CELL / 2) this.set(x + dx, z + dz);
    }
  }

  /** @param {number} x @param {number} z */
  at(x, z) {
    const k = this.key(x, z);
    return k < 0 || this.m[k] === 1;
  }
}

/**
 * @param {import('./ground.js').Ground} ground
 * @param {BakeLight[]} lights
 * @param {Box[]} boxes
 * @param {number[][]} signColors
 * @returns {Building[]}
 */
export function placeBuildings(ground, lights, boxes, signColors) {
  const rng = makeRng(SEED ^ 0xb11d);
  const mask = new RoadMask(ground);
  /** @type {Building[]} */
  const out = [];
  /** @type {Map<number, Building[]>} */
  const hash = new Map();
  const hkey = (cx, cz) => cx * 50021 + cz;
  const neighbors = (x, z, r) => {
    const res = [];
    for (let cx = Math.floor((x - r) / HASH); cx <= Math.floor((x + r) / HASH); cx++) {
      for (let cz = Math.floor((z - r) / HASH); cz <= Math.floor((z + r) / HASH); cz++) {
        const list = hash.get(hkey(cx, cz));
        if (list) res.push(...list);
      }
    }
    return res;
  };
  const heart = [(CITY.x0 + CITY.x1) / 2, 1290];
  let konbini = 0;

  /** @param {Building} b */
  const fits = (b) => {
    const c = Math.cos(b.yaw);
    const s = Math.sin(b.yaw);
    let lo = Infinity;
    let hi = -Infinity;
    const nu = Math.ceil(b.w / MASK_CELL);
    const nv = Math.ceil(b.d / MASK_CELL);
    for (let iu = 0; iu <= nu; iu++) {
      const u = -b.w / 2 + (iu / nu) * b.w;
      for (let iv = 0; iv <= nv; iv++) {
        const v = -b.d / 2 + (iv / nv) * b.d;
        const x = b.x + u * c + v * s;
        const z = b.z - u * s + v * c;
        if (mask.at(x, z)) return false;
        const h = ground.hf.at(x, z);
        lo = Math.min(lo, h);
        hi = Math.max(hi, h);
      }
    }
    if (lo < WATER_LEVEL + 0.6 || hi - lo > 4) return false;
    const r = Math.hypot(b.w, b.d) / 2;
    for (const o of neighbors(b.x, b.z, r + 40)) if (overlap(o, b)) return false;
    b.y = lo - 0.3;
    return true;
  };
  /** @param {Building} b */
  const add = (b) => {
    out.push(b);
    const k = hkey(Math.floor(b.x / HASH), Math.floor(b.z / HASH));
    if (!hash.has(k)) hash.set(k, []);
    /** @type {Building[]} */ (hash.get(k)).push(b);
    boxes.push({ x: b.x, z: b.z, hx: b.w / 2, hz: b.d / 2, yaw: b.yaw });
  };

  for (const road of ground.roads.roads) {
    const cls = road.def.cls || 'street';
    if (road.surface !== 'asphalt' || cls === 'expressway' || cls === 'ramp') continue;
    const p = road.path;
    const country = cls === 'mountain' || !road.walk;
    for (const side of [1, -1]) {
      for (let s = 8; s < p.length - 8;) {
        if (road.liftAt(s) > 0.5) {
          s += 10;
          continue;
        }
        const q = p.sample(s);
        const lx = q.tz * side;
        const lz = -q.tx * side;
        const edge = road.hwAt(s) + road.walk + SKIRT + SETBACK + MASK_CELL;
        const style = cityStyle(q.x + lx * (edge + 10), q.z + lz * (edge + 10)) ?? (country ? 'country' : null);
        if (!style) {
          s += 20;
          continue;
        }
        const rules = STYLES[style];
        const type = pickType(rng, rules.types, konbini < 14);
        const w = type.kind === 'konbini' ? 16 : rng.range(type.w[0], type.w[1]);
        s += w / 2;
        if (rng.chance(rules.skip)) {
          s += w / 2 + GAP;
          continue;
        }
        const at = p.sample(Math.min(s, p.length - 1));
        const ax = at.tz * side;
        const az = -at.tx * side;
        const d = rng.range(type.d[0], type.d[1]);
        const core = Math.max(0, 1 - Math.hypot(at.x - heart[0], (at.z - heart[1]) * 1.6) / 900);
        const h = heightFor(rng, type, core);
        const front = makeBuilding(rng, type, at.x + ax * (edge + d / 2), at.z + az * (edge + d / 2), Math.atan2(-ax, -az), w, d, h);
        if (fits(front)) {
          add(front);
          if (front.kind === 'konbini') konbini++;
          light(front, ax, az, lights, signColors);
          if (rng.chance(rules.back)) {
            const back = rng.pick(rules.types.filter((t) => t.kind !== 'konbini'));
            const d2 = rng.range(back.d[0], back.d[1]);
            const w2 = Math.min(w + rng.range(-4, 6), back.w[1]);
            const off = edge + d + GAP + d2 / 2 + rng.range(0, 3);
            const rear = makeBuilding(rng, back, at.x + ax * off, at.z + az * off, Math.atan2(-ax, -az), Math.max(back.w[0], w2), d2, heightFor(rng, back, core) * (style === 'downtown' ? 1.15 : 1));
            if (fits(rear)) add(rear);
          }
        }
        s += w / 2 + GAP + (country ? rng.range(30, 120) : 0);
      }
    }
  }
  return out;
}

/** @param {ReturnType<typeof makeRng>} rng @param {LotType[]} types @param {boolean} konbiniOk */
function pickType(rng, types, konbiniOk) {
  const list = konbiniOk ? types : types.filter((t) => t.kind !== 'konbini');
  const total = list.reduce((a, t) => a + t.weight, 0);
  let r = rng.next() * total;
  for (const t of list) {
    r -= t.weight;
    if (r <= 0) return t;
  }
  return list[list.length - 1];
}

/** Towers rise toward the middle of downtown. @param {ReturnType<typeof makeRng>} rng @param {LotType} t @param {number} core */
function heightFor(rng, t, core) {
  if (t.kind === 'tower') return t.h[0] + (t.h[1] - t.h[0]) * Math.min(1, rng.next() * (0.35 + 0.9 * core));
  return rng.range(t.h[0], t.h[1]);
}

/**
 * @param {ReturnType<typeof makeRng>} rng @param {LotType} t @param {number} x @param {number} z
 * @param {number} yaw @param {number} w @param {number} d @param {number} h
 * @returns {Building}
 */
function makeBuilding(rng, t, x, z, yaw, w, d, h) {
  const signs = t.kind === 'block' || t.kind === 'tower' || t.kind === 'apartment';
  return {
    x, z, y: 0, yaw, w, d, h,
    kind: t.kind,
    roof: t.roof || 'flat',
    seed: rng.int(0, 1e6),
    sign: signs && rng.chance(t.kind === 'apartment' ? 0.15 : 0.45) ? rng.int(0, 7) : -1,
  };
}

/** The light a building throws on the street: a konbini's front, a sign's glow, a garage's lamp. */
function light(b, ax, az, lights, signColors) {
  const fx = b.x - ax * (b.d / 2 + 1.2);
  const fz = b.z - az * (b.d / 2 + 1.2);
  if (b.kind === 'konbini') lights.push({ x: fx, y: b.y + 2.5, z: fz, c: [1.8, 2.0, 2.0], range: 15 });
  else if (b.kind === 'garage') lights.push({ x: fx, y: b.y + 4.2, z: fz, c: [1.5, 1.45, 1.2], range: 11 });
  else if (b.sign >= 0) lights.push({ x: fx, y: b.y + 4, z: fz, c: signColors[b.sign % signColors.length], range: 7 });
}

/** Do two oriented footprints overlap (with the gap between buildings)? @param {Building} a @param {Building} b */
function overlap(a, b) {
  if (Math.hypot(a.x - b.x, a.z - b.z) > (Math.hypot(a.w, a.d) + Math.hypot(b.w, b.d)) / 2 + GAP) return false;
  for (const box of [a, b]) {
    const c = Math.cos(box.yaw);
    const s = Math.sin(box.yaw);
    for (const [ux, uz] of [[c, -s], [s, c]]) {
      const pa = project(a, ux, uz);
      const pb = project(b, ux, uz);
      if (pa[1] + GAP / 2 <= pb[0] - GAP / 2 || pb[1] + GAP / 2 <= pa[0] - GAP / 2) return false;
    }
  }
  return true;
}

/** Interval of a footprint projected on an axis. @param {Building} b @param {number} ux @param {number} uz */
function project(b, ux, uz) {
  const c = Math.cos(b.yaw);
  const s = Math.sin(b.yaw);
  const center = b.x * ux + b.z * uz;
  const r = Math.abs((b.w / 2) * (c * ux - s * uz)) + Math.abs((b.d / 2) * (s * ux + c * uz));
  return [center - r, center + r];
}
