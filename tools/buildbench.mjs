/**
 * World-build bench. Node, pure modules only (no three, no DOM, no fetch). Times the stages
 * World.create runs before it builds any mesh, over three runs, and prints the median of each in
 * milliseconds with the counts they produce. Read only: src/world/ is measured, never changed.
 *
 *   npm run bench
 *
 * Stages inside a module (the street generator inside the layout, the junction finder and the
 * carve inside Ground, the building and forest placers inside the scatter) are timed by a loader
 * hook that wraps the call in the module's source as it is loaded; the files on disk are untouched.
 * Rows that are part of another row are indented, and their time is already counted in it.
 * Not measured here: the meshes, the light grid and the light pools, which need three.
 */

import { register } from 'node:module';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const RUNS = 3;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const world = pathToFileURL(path.join(root, 'src/world/')).href;

/** @type {Map<string, number>} */
let marks = new Map();
/**
 * Runs fn and adds its time to the named mark of this run.
 * @template T @param {string} name @param {() => T} fn @returns {T}
 */
globalThis.__bt = (name, fn) => {
  const t = performance.now();
  try {
    return fn();
  } finally {
    marks.set(name, (marks.get(name) ?? 0) + performance.now() - t);
  }
};

/** Exact-string wraps: file, text found in the source, text put in its place. */
const WRAPS = [
  ['citygen.js', 'export function cityStreets(', 'function __cityStreets(', 'export function cityStreets(a) { return globalThis.__bt("streets", () => __cityStreets(a)); }'],
  ['ground.js', 'this.roads = new RoadNetwork(ROADS);', 'this.roads = globalThis.__bt("roadnet", () => new RoadNetwork(ROADS));'],
  ['ground.js', 'this.junctions = findJunctions(this.roads.roads);', 'this.junctions = globalThis.__bt("junctions", () => findJunctions(this.roads.roads));'],
  ['ground.js', 'this.hf = new Heightfield();', 'this.hf = globalThis.__bt("heightfield", () => new Heightfield());'],
  ['ground.js', '    this.carve();\n', '    globalThis.__bt("carve", () => this.carve());\n'],
  ['scatter.js', 'const buildings = placeBuildings(ground, lights, boxes, SIGN_COLORS);', 'const buildings = globalThis.__bt("buildings", () => placeBuildings(ground, lights, boxes, SIGN_COLORS));'],
  ['scatter.js', 'const trees = placeForest(ground, buildings, circles, clearOfRoads);', 'const trees = globalThis.__bt("forest", () => placeForest(ground, buildings, circles, clearOfRoads));'],
];

const hooks = `
const WRAPS = ${JSON.stringify(WRAPS)};
export async function load(url, context, next) {
  const r = await next(url, context);
  const file = url.split('?')[0].split('/').pop();
  if (!url.includes('/src/world/') || r.format !== 'module') return r;
  let src = String(r.source);
  for (const [f, from, to, tail] of WRAPS) {
    if (f !== file) continue;
    if (!src.includes(from)) throw new Error('bench: ' + f + ' no longer contains ' + JSON.stringify(from));
    src = src.replace(from, to);
    if (tail) src += '\\n' + tail + '\\n';
  }
  return { ...r, source: src };
}`;
register('data:text/javascript,' + encodeURIComponent(hooks));

const median = (/** @type {number[]} */ a) => {
  const s = [...a].sort((x, y) => x - y);
  return s[(s.length - 1) >> 1];
};
const take = (/** @type {string} */ k) => marks.get(k) ?? 0;

const models = {};
for (const f of readdirSync(path.join(root, 'assets/models'))) {
  if (f.endsWith('.json')) models[f.slice(0, -5)] = JSON.parse(readFileSync(path.join(root, 'assets/models', f), 'utf8'));
}

// One unmeasured pass loads and parses every module and warms the engine, so the runs below
// time the work and not the first import.
const { Ground } = await import(world + 'ground.js');
const { scatterWorld } = await import(world + 'scatter.js');
{
  const g = new Ground();
  scatterWorld(g, { models });
}

const rows = [
  ['layout import, without streets', 'layout', 0],
  ['  citygen streets', 'streets', 1],
  ['Ground', 'ground', 0],
  ['  road network', 'roadnet', 1],
  ['  heightfield', 'heightfield', 1],
  ['  junction finder', 'junctions', 1],
  ['  carve', 'carve', 1],
  ['scatterWorld', 'scatter', 0],
  ['  placeBuildings', 'buildings', 1],
  ['  forest', 'forest', 1],
  ['  lamps, stations, bridges, highway, lots', 'scatterRest', 1],
];
/** @type {Record<string, number[]>} */
const times = Object.fromEntries(rows.map((r) => [r[1], []]));
/** @type {Record<string, number>} */
let counts = {};

for (let i = 0; i < RUNS; i++) {
  marks = new Map();
  let t = performance.now();
  await import(world + `layout.js?run=${i}`);
  const layoutTotal = performance.now() - t;
  times.layout.push(layoutTotal - take('streets'));
  times.streets.push(take('streets'));
  marks = new Map([['streets', take('streets')]]);

  t = performance.now();
  const ground = new Ground();
  times.ground.push(performance.now() - t);
  for (const k of ['roadnet', 'heightfield', 'junctions', 'carve']) times[k].push(take(k));

  marks = new Map();
  t = performance.now();
  const sc = scatterWorld(ground, { models });
  const scTotal = performance.now() - t;
  times.scatter.push(scTotal);
  times.buildings.push(take('buildings'));
  times.forest.push(take('forest'));
  times.scatterRest.push(scTotal - take('buildings') - take('forest'));

  counts = {
    roads: ground.roads.roads.length,
    streets: ground.roads.roads.filter((r) => r.def.cls === 'street').length,
    junctions: ground.junctions.length,
    buildings: sc.buildings.length,
    lamps: sc.lamps.length,
    trees: sc.trees.length ?? 0,
    lights: sc.lights.length,
  };
}

const pad = (/** @type {string} */ s, /** @type {number} */ n) => s.padEnd(n);
const total = rows.filter((r) => !r[2]).reduce((a, r) => a + median(times[r[1]]), 0);
console.log(`world build, median of ${RUNS} runs (ms)\n`);
console.log(pad('stage', 44) + 'median ms'.padStart(10) + 'share'.padStart(8));
for (const [label, key] of rows) {
  const m = median(times[key]);
  console.log(pad(label, 44) + m.toFixed(1).padStart(10) + `${((m / total) * 100).toFixed(0)}%`.padStart(8));
}
console.log(pad('total (top-level rows)', 44) + total.toFixed(1).padStart(10));
console.log('\ncounts');
for (const [k, v] of Object.entries(counts)) console.log(pad(k, 44) + String(v).padStart(10));
