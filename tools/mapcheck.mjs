// Numbers for the map layout: every road's length, height range, steepest grade and how far
// the terrain had to be cut or filled to carry it, plus the places roads cross.
//   node tools/mapcheck.mjs [roadId ...]
import { ROADS, STATIONS, TOLLS, WORLD_HALF } from '../src/world/layout.js';
import { RoadNetwork } from '../src/world/roads.js';
import { baseHeight } from '../src/world/heightfield.js';

const t0 = performance.now();
const net = new RoadNetwork(ROADS);
console.log(`${ROADS.length} roads, network built in ${(performance.now() - t0).toFixed(0)} ms, world ${WORLD_HALF * 2} m`);
const only = process.argv.slice(2);

let total = 0;
for (const r of net.roads) {
  const p = r.path;
  total += p.length;
  if (only.length && !only.includes(r.id)) continue;
  if (!only.length && /^k-/.test(r.id)) continue;
  let lo = Infinity, hi = -Infinity, steep = 0, cut = 0, fill = 0, steepAt = 0;
  for (let i = 0; i < p.n; i++) {
    lo = Math.min(lo, r.h[i]);
    hi = Math.max(hi, r.h[i]);
    const nat = baseHeight(p.x[i], p.z[i]);
    cut = Math.max(cut, nat - r.h[i]);
    fill = Math.max(fill, r.h[i] - nat);
    if (i + 5 < p.n || p.closed) {
      const j = p.wrapIndex(i + 5);
      const g = Math.abs(r.h[j] - r.h[i]) / (5 * p.step);
      if (g > steep) { steep = g; steepAt = i * p.step; }
    }
  }
  const lift = r.lifted ? Math.max(...r.lift).toFixed(1) : '0';
  console.log(`${r.id.padEnd(12)} ${(p.length / 1000).toFixed(2).padStart(6)} km  h ${lo.toFixed(0).padStart(4)}..${hi.toFixed(0).padEnd(4)} grade ${(steep * 100).toFixed(1).padStart(4)}%  cut ${cut.toFixed(0).padStart(3)} fill ${fill.toFixed(0).padStart(3)}  lift ${lift}  steepest at s=${steepAt.toFixed(0)}`);
}
console.log(`total road ${(total / 1000).toFixed(1)} km`);

for (const s of STATIONS) {
  const r = net.byId.get(s.road);
  const hit = r.path.nearest(s.near[0], s.near[1]);
  console.log(`station ${s.id} on ${s.road} at s=${hit.s.toFixed(0)} off ${Math.abs(hit.d).toFixed(1)} m, ground ${baseHeight(s.near[0], s.near[1]).toFixed(0)} m`);
}
for (const t of TOLLS) console.log(`toll ${t.id} at ${t.x.toFixed(0)}, ${t.z.toFixed(0)} yaw ${(t.yaw * 57.3).toFixed(0)}`);

// Where roads cross: report crossings between roads that are not meant to meet at a node.
const segs = net.roads.map((r) => {
  const pts = [];
  for (let s = 0; s < r.path.length; s += 12) {
    const q = r.path.sample(s);
    pts.push([q.x, q.z, r.liftAt(s)]);
  }
  return pts;
});
const ccw = (a, b, c) => (c[1] - a[1]) * (b[0] - a[0]) > (b[1] - a[1]) * (c[0] - a[0]);
const cross = (a, b, c, d) => ccw(a, c, d) !== ccw(b, c, d) && ccw(a, b, c) !== ccw(a, b, d);
const found = new Map();
for (let a = 0; a < net.roads.length; a++) {
  for (let b = a + 1; b < net.roads.length; b++) {
    const ra = net.roads[a], rb = net.roads[b];
    if (/^k-/.test(ra.id) && /^k-/.test(rb.id)) continue;
    for (let i = 0; i + 1 < segs[a].length; i++) {
      for (let j = 0; j + 1 < segs[b].length; j++) {
        if (Math.abs(segs[a][i][0] - segs[b][j][0]) > 40 || Math.abs(segs[a][i][1] - segs[b][j][1]) > 40) continue;
        if (cross(segs[a][i], segs[a][i + 1], segs[b][j], segs[b][j + 1])) {
          const key = `${ra.id} x ${rb.id}`;
          const lifted = segs[a][i][2] > 2 || segs[b][j][2] > 2;
          const e = found.get(key) || { n: 0, lifted: 0, at: [segs[a][i][0], segs[a][i][1]] };
          e.n++;
          if (lifted) e.lifted++;
          found.set(key, e);
        }
      }
    }
  }
}
for (const [key, e] of found) console.log(`cross ${key}: ${e.n}x${e.lifted ? `, ${e.lifted} on a deck` : ''} near ${e.at.map((v) => v.toFixed(0)).join(', ')}`);
