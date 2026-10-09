// Finds places for landmark lots (police stations, garages, hideouts) and prints them as `LOTS` lines.
//   node tools/lotsearch.mjs check            the rules against the lots already in layout.js
//   node tools/lotsearch.mjs police           a police station in every district that has none
// A district is served by a station inside it or within SERVED m of its center.
// A spot is accepted when its pad is on land, flat against the road it fronts, and 14 m clear of every
// other road and every other lot, so the street generator, which keeps off lots by the same margin,
// lays exactly the roads it laid without it. Check that after adding a lot: the fingerprint of every
// road point must not change (see the changelog of 0.10.17).
import { Ground, makePad, padDistance } from '../src/world/ground.js';
import { baseHeight } from '../src/world/heightfield.js';
import { DISTRICTS, LOTS, LOT_ROADS, LOT_MARGIN } from '../src/world/layout.js';

const STEP = 4;
const FLAT_TOLERANCE = 3;
const SAME_KIND_GAP = 250;
const SERVED = 600;
const REACH = 700;
const CELL = 16;

const g = new Ground();

/** A hash of every road's samples, to ask what lies near a point without walking the roads. */
const grid = new Map();
for (const road of g.roads.roads) {
  const p = road.path;
  const reach = road.hw + road.walk;
  for (let i = 0; i < p.n; i++) {
    const key = `${Math.floor(p.x[i] / CELL)},${Math.floor(p.z[i] / CELL)}`;
    let cell = grid.get(key);
    if (!cell) grid.set(key, (cell = []));
    cell.push(p.x[i], p.z[i], reach, road.index, road.def.cls === 'street' ? 1 : 0);
  }
}

/**
 * The road other than `own` that a point of a pad's footprint is too near, or null. On the pad itself
 * no road's surface or sidewalk may come within a meter; in the margin round it, the street
 * generator's rule: no street's center line within 14 m, and any other road 6 m from its edge.
 */
function roadNear(x, z, own, onPad) {
  const reachMax = onPad ? 1 : LOT_MARGIN;
  const cx = Math.floor(x / CELL);
  const cz = Math.floor(z / CELL);
  const span = Math.ceil((reachMax + 12) / CELL);
  for (let dz = -span; dz <= span; dz++) {
    for (let dx = -span; dx <= span; dx++) {
      const cell = grid.get(`${cx + dx},${cz + dz}`);
      if (!cell) continue;
      for (let k = 0; k < cell.length; k += 5) {
        if (cell[k + 3] === own.index) continue;
        const street = cell[k + 4] === 1;
        const dist = Math.hypot(cell[k] - x, cell[k + 1] - z);
        const bad = onPad ? dist - cell[k + 2] < 1 : street ? dist < LOT_MARGIN : dist - cell[k + 2] < 6;
        if (bad) return g.roads.roads[cell[k + 3]];
      }
    }
  }
  return null;
}

/**
 * Why a pad does not fit, or null when it does. `others` are the pads it must keep 14 m from.
 * @param {import('../src/world/ground.js').Pad} pad @param {import('../src/world/ground.js').Pad[]} others
 */
function reject(pad, others) {
  const m = LOT_MARGIN;
  let worst = 0;
  for (let u = -pad.hw - m; u <= pad.hw + m; u += STEP) {
    for (let v = -pad.hd - m; v <= pad.hd + m; v += STEP) {
      const x = pad.cx + pad.ux * u + pad.vx * v;
      const z = pad.cz + pad.uz * u + pad.vz * v;
      const inside = Math.abs(u) <= pad.hw && Math.abs(v) <= pad.hd;
      const h = baseHeight(x, z);
      if (h < 2) return 'water';
      if (inside || Math.abs(u) <= pad.hw + 3 && Math.abs(v) <= pad.hd + 3) worst = Math.max(worst, Math.abs(h - pad.h));
      const road = roadNear(x, z, pad.road, inside);
      if (road) return `road ${road.id}`;
      for (const o of others) if (padDistance(o, x, z) < (inside ? m : 2)) return `lot ${o.id}`;
    }
  }
  if (worst > FLAT_TOLERANCE) return `slope ${worst.toFixed(1)} m`;
  return null;
}

/** The pad a lot would have, from a point on its road. */
function padAt(spec, road, s, side) {
  const q = road.path.sample(s);
  return makePad(g.roads, { ...spec, road: road.id, near: [q.x, q.z], side });
}

const roadIds = LOT_ROADS;

function check() {
  for (const pad of g.lots) {
    const why = reject(pad, [...g.lots.filter((o) => o !== pad), ...g.pads]);
    console.log(`${pad.id.padEnd(16)} ${why ?? 'fits'}`);
  }
}

/**
 * The best fitting pad inside `region`, nearest to `target`, or null.
 * @param {{ id: string, w: number, d: number }} spec
 * @param {(x: number, z: number) => boolean} region
 * @param {number[]} target
 * @param {import('../src/world/ground.js').Pad[]} others
 * @param {string[]} [roads]
 */
function search(spec, region, target, others, roads = roadIds) {
  const found = [];
  for (const id of roads) {
    const road = g.roads.byId.get(id);
    for (let s = 0; s < road.path.length; s += 6) {
      for (const side of ['left', 'right']) {
        const pad = padAt(spec, road, s, side);
        if (!region(pad.cx, pad.cz)) continue;
        const dist = Math.hypot(pad.cx - target[0], pad.cz - target[1]);
        found.push({ pad, side, s, dist });
      }
    }
  }
  found.sort((a, b) => a.dist - b.dist);
  for (const f of found) if (!reject(f.pad, others)) return f;
  return null;
}

const line = (lot) => `  { id: '${lot.id}', kind: '${lot.kind}', model: '${lot.model}', name: '${lot.name}', sign: '${lot.sign}', road: '${lot.road}', near: [${lot.near.join(', ')}], side: '${lot.side}', w: ${lot.w}, d: ${lot.d} },`;

function police() {
  const spec = { w: 36, d: 28 };
  const names = {
    ginza: ['GINZA', 'GINZA'], shin: ['SHINMACHI', 'SHINMACHI'], minato: ['MINATOMACHI', 'MINATO'], kitaw: ['KITAMACHI', 'KITAMACHI'],
    kitae: ['HIGASHIMACHI', 'HIGASHI'], hama: ['HAMACHO', 'HAMACHO'], kogyo: ['HIGASHI KOGYO', 'KOGYO'], futo: ['KUROGANE FUTO', 'FUTO'],
    nishi: ['NISHIMACHI', 'NISHIMACHI'],
  };
  const stations = LOTS.filter((l) => l.kind === 'police').map((l) => g.lots.find((p) => p.id === l.id));
  const added = [];
  for (const dist of DISTRICTS) {
    const has = [...stations, ...added.map((a) => a.pad)].some((p) => dist.inside(p.cx, p.cz) || Math.hypot(p.cx - dist.center[0], p.cz - dist.center[1]) < SERVED);
    if (has) {
      console.log(`// ${dist.name}: served`);
      continue;
    }
    const others = [...g.lots, ...g.pads, ...added.map((a) => a.pad)];
    const tooClose = (x, z) => [...stations, ...added.map((a) => a.pad)].every((p) => Math.hypot(p.cx - x, p.cz - z) >= SAME_KIND_GAP);
    const f = search({ id: `police-${dist.id}`, ...spec }, (x, z) => Math.hypot(x - dist.center[0], z - dist.center[1]) < REACH && tooClose(x, z), dist.center, others);
    if (!f) {
      console.log(`// ${dist.name}: nothing fits within ${REACH} m`);
      continue;
    }
    const [town, sign] = names[dist.id];
    const q = f.pad.road.path.sample(f.s);
    const lot = {
      id: `police-${dist.id}`, kind: 'police', model: 'police_station', name: `${town} POLICE STATION`, sign: `${sign} POLICE`,
      road: f.pad.road.id, near: [Math.round(q.x), Math.round(q.z)], side: f.side, w: spec.w, d: spec.d,
    };
    added.push({ pad: padAt(lot, f.pad.road, f.s, f.side), lot });
    console.log(`${line(lot)}  // ${Math.round(f.dist)} m from the center of ${dist.name}`);
  }
}

const mode = process.argv[2] || 'check';
if (mode === 'check') check();
else if (mode === 'police') police();
else console.log('usage: node tools/lotsearch.mjs check | police');
