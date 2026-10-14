// Finds the stakeout spots (src/world/stakeouts.js): where an undercover car can wait, off the lanes,
// with a clear line to the road it watches. Prints `STAKEOUTS` lines for the module.
//   node tools/stakeoutsearch.mjs
// Every request is a kind, a name, the roads to look along and a hint to search round; the best
// fitting spot within its radius wins (the clearest view of the road, then the nearest to the hint).
// A spot is on land, level with the road it watches (not under a deck or on a bank), 80 m from every
// police station, 250 m from every other spot, with the car's footprint clear of every lane and every
// static collider and a clear line to at least four of the six stretches of road it watches.
import { Ground, padDistance } from '../src/world/ground.js';
import { scatterWorld } from '../src/world/scatter.js';
import { Colliders } from '../src/world/collision.js';
import { clearLine } from '../src/police/sight.js';
import { LOTS } from '../src/world/layout.js';

const STATION_GAP = 80;
const SPOT_GAP = 250;
const ROAD_CLEAR = 0.8;
const STEP = 8;

const g = new Ground();
const colliders = new Colliders(...(({ circles, boxes }) => [circles, boxes])(scatterWorld(g)));
const terrain = g.hf;
const solid = (x, z, y) => colliders.solidAt(x, z, y) || terrain.at(x, z) > y + 0.5;
const stations = g.lots.filter((p) => p.lot.kind === 'police');

const CELL = 16;
const grid = new Map();
for (const road of g.roads.roads) {
  const p = road.path;
  for (let i = 0; i < p.n; i++) {
    const key = `${Math.floor(p.x[i] / CELL)},${Math.floor(p.z[i] / CELL)}`;
    let cell = grid.get(key);
    if (!cell) grid.set(key, (cell = []));
    cell.push(p.x[i], p.z[i], road.hwAt(i * p.step));
  }
}

/** Whether a point is clear of every road surface by `ROAD_CLEAR`. */
function offRoads(x, z) {
  const cx = Math.floor(x / CELL);
  const cz = Math.floor(z / CELL);
  for (let dz = -1; dz <= 1; dz++) {
    for (let dx = -1; dx <= 1; dx++) {
      const cell = grid.get(`${cx + dx},${cz + dz}`);
      if (!cell) continue;
      for (let k = 0; k < cell.length; k += 3) if (Math.hypot(cell[k] - x, cell[k + 1] - z) - cell[k + 2] < ROAD_CLEAR) return false;
    }
  }
  return true;
}

/** Whether a car at (x, z) facing `yaw` fits: off every lane, off every static shape, on land, on no pad. */
function fits(x, z, yaw) {
  const fx = Math.sin(yaw);
  const fz = Math.cos(yaw);
  const lx = Math.cos(yaw);
  const lz = -Math.sin(yaw);
  const y = terrain.at(x, z);
  if (y < 1.5) return false;
  for (const [a, b] of [[0, 0], [2.2, 0.9], [2.2, -0.9], [-2.2, 0.9], [-2.2, -0.9]]) {
    if (!offRoads(x + fx * a + lx * b, z + fz * a + lz * b)) return false;
  }
  for (const a of [-1.3, 0, 1.3]) if (colliders.probe(x + fx * a, z + fz * a, 1.15, y)) return false;
  for (const pad of g.flats) if (padDistance(pad, x, z) < 4) return false;
  return true;
}

/** How many of six stretches of `road` round `s` the spot sees, and the roads near that it sees. */
function sees(x, z, road, s) {
  const y = terrain.at(x, z);
  let n = 0;
  for (const ds of [-60, -40, -20, 20, 40, 60]) {
    const q = road.path.sample(road.path.wrapS(s + ds));
    if (clearLine({ x, y, z }, { x: q.x, y: road.heightAt(road.path.wrapS(s + ds)), z: q.z }, solid)) n++;
  }
  return n;
}

const chosen = [];
const apart = (x, z) => stations.every((p) => Math.hypot(p.cx - x, p.cz - z) >= STATION_GAP) && chosen.every((c) => Math.hypot(c.x - x, c.z - z) >= SPOT_GAP);

/** Spots beside a road: on the verge or the sidewalk, facing the road at an angle toward the oncoming lane. */
function along(req) {
  const found = [];
  for (const id of req.roads) {
    const road = g.roads.byId.get(id);
    const s0 = road.path.nearest(req.near[0], req.near[1]).s;
    for (let ds = -req.radius; ds <= req.radius; ds += STEP) {
      const s = road.path.wrapS(s0 + ds);
      if (!road.path.closed && (s <= 70 || s >= road.path.length - 70)) continue;
      if (road.liftAt(s) > 0.5) continue;
      const q = road.path.sample(s);
      for (const sign of [1, -1]) {
        const nx = q.tz * sign;
        const nz = -q.tx * sign;
        for (const lateral of [road.hw + 2.8, road.hw + 4.2, road.hw + 6]) {
          const x = q.x + nx * lateral;
          const z = q.z + nz * lateral;
          const along = sign > 0 ? -1 : 1;
          const yaw = Math.atan2(along * q.tx * 0.55 - nx * 0.83, along * q.tz * 0.55 - nz * 0.83);
          if (!apart(x, z) || Math.abs(terrain.at(x, z) - road.heightAt(s)) > 2) continue;
          if (!fits(x, z, yaw)) continue;
          const seen = sees(x, z, road, s);
          if (seen < 4) continue;
          found.push({ x, z, yaw, road, s, score: seen * 100 - Math.hypot(x - req.near[0], z - req.near[1]) - lateral * 3 });
          break;
        }
      }
    }
  }
  return found;
}

/** Spots at the mouth of a side street: a little way up it, at the curb, facing the main road. */
function mouths(req) {
  const found = [];
  const mains = req.roads.map((id) => g.roads.byId.get(id));
  for (const street of g.roads.roads) {
    if (street.def.cls !== 'street') continue;
    const p = street.path;
    for (const end of [0, p.length]) {
      const e = p.sample(end);
      if (Math.hypot(e.x - req.near[0], e.z - req.near[1]) > req.radius) continue;
      for (const main of mains) {
        const hit = main.path.nearest(e.x, e.z);
        if (Math.abs(hit.d) > main.hw + 4 || main.liftAt(hit.s) > 0.5) continue;
        for (const back of [14, 22, 30]) {
          const q = p.sample(end === 0 ? back : p.length - back);
          for (const sign of [1, -1]) {
            for (const lateral of [street.hw + 1.9, street.hw + 2.5]) {
              const x = q.x + q.tz * sign * lateral;
              const z = q.z - q.tx * sign * lateral;
              const yaw = Math.atan2(e.x - x, e.z - z);
              if (!apart(x, z) || !fits(x, z, yaw)) continue;
              const seen = sees(x, z, main, hit.s);
              if (seen < 3) continue;
              found.push({ x, z, yaw, road: main, s: hit.s, score: seen * 100 - Math.hypot(x - req.near[0], z - req.near[1]) - back });
              break;
            }
          }
        }
      }
    }
  }
  return found;
}

const REQUESTS = [
  { kind: 'layby', name: 'ROUTE 18 LAY-BY SOUTH', roads: ['r18'], near: [-300, -380], radius: 220 },
  { kind: 'layby', name: 'ROUTE 18 LAY-BY NORTH', roads: ['r18'], near: [200, -1620], radius: 220 },
  { kind: 'layby', name: 'HARBOR AVE LAY-BY', roads: ['harbor'], near: [10, 2330], radius: 200 },
  { kind: 'layby', name: 'WEST AVE LAY-BY', roads: ['west'], near: [-1600, 1140], radius: 220 },
  { kind: 'layby', name: 'EAST AVE LAY-BY', roads: ['east'], near: [1600, 1155], radius: 220 },
  { kind: 'layby', name: 'HIGASHI COAST ROAD LAY-BY NORTH', roads: ['higashi'], near: [2520, -400], radius: 260 },
  { kind: 'layby', name: 'HIGASHI COAST ROAD LAY-BY SOUTH', roads: ['higashi'], near: [2490, 1800], radius: 260 },
  { kind: 'layby', name: 'KITA COAST ROAD LAY-BY', roads: ['kita'], near: [1850, -2530], radius: 260 },
  { kind: 'route1', name: 'ROUTE 1 NORTH SHOULDER', roads: ['c1-f', 'c1-r'], near: [-752, -363], radius: 260 },
  { kind: 'route1', name: 'ROUTE 1 EAST SHOULDER', roads: ['c1-f', 'c1-r'], near: [1880, 304], radius: 260 },
  { kind: 'route1', name: 'ROUTE 1 SOUTH SHOULDER', roads: ['c1-f', 'c1-r'], near: [-941, 2145], radius: 260 },
  { kind: 'route1', name: 'ROUTE 1 WEST SHOULDER', roads: ['c1-f', 'c1-r'], near: [-1859, 537], radius: 260 },
  { kind: 'toll', name: 'KITA TOLL WATCH', roads: ['c1-f', 'c1-r'], near: [450, -353], radius: 240 },
  { kind: 'toll', name: 'HIGASHI TOLL WATCH', roads: ['c1-f', 'c1-r'], near: [1750, 1800], radius: 240 },
  { kind: 'toll', name: 'MINATO TOLL WATCH', roads: ['c1-f', 'c1-r'], near: [-160, 2170], radius: 240 },
  { kind: 'mouth', name: 'SHINMACHI SIDE STREET', roads: ['dori', 'naikan', 'sotokan'], near: [-700, 1200], radius: 450 },
  { kind: 'mouth', name: 'MINATOMACHI SIDE STREET', roads: ['dori', 'naikan', 'sotokan'], near: [700, 1230], radius: 450 },
  { kind: 'pass', name: 'KURO PASS FOOT', roads: ['kuro'], near: [-2320, 150], radius: 240 },
];

const slug = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const fmt = (n, d) => Number(n.toFixed(d));

for (const req of REQUESTS) {
  const found = (req.kind === 'mouth' ? mouths(req) : along(req)).sort((a, b) => b.score - a.score);
  const best = found[0];
  if (!best) {
    console.log(`// ${req.name}: nothing fits within ${req.radius} m of (${req.near})`);
    continue;
  }
  const x = fmt(best.x, 1);
  const z = fmt(best.z, 1);
  const yaw = fmt(best.yaw, 2);
  chosen.push({ x, z });
  const roads = req.kind === 'route1' || req.kind === 'toll' ? req.roads : [best.road.id];
  console.log(`  { id: '${slug(req.name)}', kind: '${req.kind}', name: '${req.name}', x: ${x}, z: ${z}, yaw: ${yaw}, roads: [${roads.map((r) => `'${r}'`).join(', ')}] },  // sees ${best.score >= 0 ? Math.round(best.score / 100) : 0} of 6, ${Math.round(Math.hypot(x - req.near[0], z - req.near[1]))} m from the hint`);
}
console.log(`// ${chosen.length} of ${REQUESTS.length} spots; ${LOTS.length} lots keep 80 m clear`);
