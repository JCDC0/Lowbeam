/**
 * Civilian clipping bench: runs the traffic for 70 s at seven places on the island and counts how
 * often a civilian driving on its lane has any of its three body circles inside a static shape (a
 * pole, a signal, a barrier, a wall), and with which shape, on which road. Civilians in `drive`
 * mode are not checked against the world by the sim (`B4-civilian-world-collisions.md`), so this
 * is the measure of that. `node tools/clipbench.mjs` takes about 2 minutes.
 */

import { Ground } from '../src/world/ground.js';
import { TrafficNet } from '../src/traffic/net.js';
import { scatterWorld } from '../src/world/scatter.js';
import { Colliders } from '../src/world/collision.js';
import { placeSignals, signalCircles } from '../src/world/signals.js';
import { TrafficSim } from '../src/traffic/sim.js';

const g = new Ground();
const net = new TrafficNet(g.roads);
const w = scatterWorld(g);
const circles = [...w.circles, ...signalCircles(placeSignals(net, g), g)];
const col = new Colliders(circles.slice(), w.boxes);
const hit = { road: null, s: 0, d: 0, h: 0, edge: 0, lift: 0 };

const classify = (px, pz) => {
  let best = 'none';
  let bd = 1.0;
  for (const c of circles) {
    if (Math.abs(c.x - px) > 3 || Math.abs(c.z - pz) > 3) continue;
    const d = Math.hypot(c.x - px, c.z - pz) - c.r;
    if (d < bd) { bd = d; best = `circle r${c.r.toFixed(2)}`; }
  }
  for (const b of w.boxes) {
    if (Math.abs(b.x - px) > 30 || Math.abs(b.z - pz) > 30) continue;
    const dx = px - b.x;
    const dz = pz - b.z;
    const cs = Math.cos(b.yaw || 0);
    const sn = Math.sin(b.yaw || 0);
    const lx = dx * cs - dz * sn;
    const lz = dx * sn + dz * cs;
    const d = Math.max(Math.abs(lx) - b.hx, Math.abs(lz) - b.hz);
    if (d < bd) { bd = d; best = `box ${(b.hx * 2).toFixed(1)}x${(b.hz * 2).toFixed(1)} ${b.y0 === undefined ? '' : 'y'}`; }
  }
  return best;
};

const spots = [
  ['downtown', 'chuo', 600], ['dori', 'dori', 900], ['harbor', 'harbor', 1200], ['route1', 'c1-f', 5000],
  ['kuroganeline', 'c3-f', 1500], ['r18', 'r18', 1500], ['naikan', 'naikan', 3000],
];
const wall = new Map();
const shapes = new Map();
const example = new Map();
const off = new Map();
let seen = 0;
for (const [name, id, s] of spots) {
  const road = g.roads.byId.get(id);
  const ss = Math.min(s, road.path.length - 10);
  const q = road.path.sample(ss);
  const sim = new TrafficSim(net, { seed: 5, target: 45, rivals: 0, patrols: 0 });
  sim.hitWorld = (x, z, r, y) => col.probe(x, z, r, y);
  const player = { x: q.x, y: road.heightAt(ss), z: q.z, speed: 0, yaw: 0 };
  for (let t = 0; t < 70; t += 1 / 30) {
    sim.update(1 / 30, player);
    if (t < 15 || Math.round(t * 30) % 15 !== 0) continue;
    for (const a of sim.agents) {
      if (a.mode !== 'drive') continue;
      seen++;
      const r = a.kind.width / 2;
      const reach = a.kind.length / 2 - r;
      for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const cx = a.x + Math.sin(a.yaw) * sz * a.kind.length * 0.45 + Math.cos(a.yaw) * sx * a.kind.width / 2;
        const cz = a.z + Math.cos(a.yaw) * sz * a.kind.length * 0.45 - Math.sin(a.yaw) * sx * a.kind.width / 2;
        if (!g.roads.query(cx, cz, hit, 0, -Infinity, a.y) || hit.edge > 0.1) {
          const key = `${a.kind.id} on ${a.lane.road ? a.lane.road.id : '?'}`;
          off.set(key, (off.get(key) || 0) + 1);
          break;
        }
      }
      for (const along of [reach, 0, -reach]) {
        const x = a.x + Math.sin(a.yaw) * along;
        const z = a.z + Math.cos(a.yaw) * along;
        const c = col.probe(x, z, r - 0.1, a.y);
        if (!c) continue;
        const what = classify(c.px, c.pz);
        const road2 = a.lane.road ? a.lane.road.id : '?';
        wall.set(`${a.kind.id} on ${road2}`, (wall.get(`${a.kind.id} on ${road2}`) || 0) + 1);
        const k2 = `${road2.replace(/\d+$/, '#')} ${what}`;
        shapes.set(k2, (shapes.get(k2) || 0) + 1);
        if (!example.has(k2)) example.set(k2, [Math.round(a.x), Math.round(a.z), a.kind.id, +c.depth.toFixed(2), a.lane.offset]);
        break;
      }
    }
  }
}
console.log('samples', seen, 'with a clip', [...wall.values()].reduce((a, b) => a + b, 0));
for (const [k, n] of [...shapes.entries()].sort((a, b) => b[1] - a[1]).slice(0, 18)) console.log(String(n).padStart(4), k, JSON.stringify(example.get(k)));
console.log('off the carriageway', [...off.values()].reduce((a, b) => a + b, 0));
for (const [k, n] of [...off.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12)) console.log(String(n).padStart(4), k);
