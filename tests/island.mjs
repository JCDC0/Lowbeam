/**
 * The island the world-heavy tests share. The ground takes about 2 s to build, its traffic net
 * 2.6 s and the scatter 1 s, and some thirty test files each built their own, so a full run spent
 * most of its time building the same island. The files in `tests/island/` take it from here instead,
 * built on first use, and the `island-*.test.mjs` groups import them a handful to a process so each
 * process builds it once. A test must not change what it gets here.
 */
import { Ground } from '../src/world/ground.js';
import { TrafficNet } from '../src/traffic/net.js';
import { scatterWorld } from '../src/world/scatter.js';

/** @type {Ground | null} */
let ground = null;
/** @type {TrafficNet | null} */
let net = null;
/** @type {ReturnType<typeof scatterWorld> | null} */
let world = null;

/** The island's ground: roads, junctions, terrain, lots. */
export function island() {
  return (ground ??= new Ground());
}

/** The traffic net over the island's roads. */
export function trafficNet() {
  return (net ??= new TrafficNet(island().roads));
}

/** Everything the scatter places on the island (lamps, trees, buildings, lights, colliders). */
export function scattered() {
  return (world ??= scatterWorld(island()));
}
