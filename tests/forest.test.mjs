import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Ground } from '../src/world/ground.js';
import { scatterWorld } from '../src/world/scatter.js';
import { Colliders } from '../src/world/collision.js';
import { BELT, TREE, TREE_COUNT, ringPoint } from '../src/world/forest.js';
import { CARS } from '../src/vehicles/specs.js';
import { WORLD_HALF } from '../src/world/layout.js';

const g = new Ground();
const w = scatterWorld(g);

test('every species is planted, and the valley is not one or two kinds', () => {
  const counts = new Array(TREE_COUNT).fill(0);
  for (const t of w.trees) counts[t.kind]++;
  for (let k = 0; k < TREE_COUNT; k++) assert.ok(counts[k] > 150, `species ${k} has only ${counts[k]} trees`);
  const valley = w.trees.filter((t) => Math.hypot(t.x, t.z) < 480 && Math.hypot(t.x + 330, t.z - 490) > 260);
  const kinds = new Set(valley.map((t) => t.kind));
  assert.ok(kinds.size >= 6, `valley floor has only ${kinds.size} species`);
  assert.ok(w.trees.length > 30000, `only ${w.trees.length} trees`);
});

test('trees keep clear of roads and pads, belt included', () => {
  for (const t of w.trees) {
    const hit = g.at(t.x, t.z);
    assert.equal(hit.road, null, `tree on a road at ${t.x.toFixed(0)}, ${t.z.toFixed(0)}`);
    assert.equal(hit.pad, null);
  }
});

test('the thicket lies inside the collision wall', () => {
  assert.ok(BELT.thicket[1] + 1.5 < WORLD_HALF - 12);
  const [x, z] = ringPoint(BELT.thicket[0], 0);
  assert.equal(Math.max(Math.abs(x), Math.abs(z)), BELT.thicket[0]);
});

test('no car can drive through the edge forest', () => {
  const spec = CARS.reduce((a, c) => (c.width < a.width ? c : a));
  const r = spec.width / 2;
  const col = new Colliders(w.circles, w.boxes);
  const cell = 1;
  const lo = BELT.inner;
  const hi = BELT.thicket[1] + 8;
  const n = Math.round((WORLD_HALF * 2) / cell);
  // A strip around the whole ring, indexed by (ring position, depth). Free means a car
  // centered there touches nothing. Flood from the inner edge and require that no free
  // path reaches the outer edge.
  const depth = hi - lo;
  const rows = depth / cell;
  const free = (s, d) => {
    const rho = lo + (d + 0.5) * cell;
    const [x, z] = ringPoint(rho, (s + 0.5) * cell * (rho / lo));
    return col.probe(x, z, r) === null;
  };
  const cols = Math.floor((8 * lo) / cell);
  assert.ok(cols > 0 && n > 0);
  const seen = new Uint8Array(cols * rows);
  const stack = [];
  for (let s = 0; s < cols; s++) {
    if (free(s, 0)) {
      seen[s * rows] = 1;
      stack.push(s, 0);
    }
  }
  assert.ok(stack.length > 0, 'the inner edge of the belt is blocked everywhere, so the test proves nothing');
  let deepest = 0;
  while (stack.length) {
    const d = stack.pop();
    const s = stack.pop();
    deepest = Math.max(deepest, d);
    for (const [ds, dd] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ns = (s + ds + cols) % cols;
      const nd = d + dd;
      if (nd < 0 || nd >= rows) continue;
      const k = ns * rows + nd;
      if (seen[k] || !free(ns, nd)) continue;
      seen[k] = 1;
      stack.push(ns, nd);
    }
  }
  const crossed = lo + (deepest + 1) * cell;
  assert.ok(crossed < BELT.thicket[1], `a car-sized gap reaches ring ${crossed.toFixed(1)}, past the thicket at ${BELT.thicket[1]}`);
});

test('shrubs do not collide, other species do', () => {
  const before = w.circles.length;
  assert.ok(before > w.trees.filter((t) => t.kind !== TREE.shrub).length * 0.9);
  const shrubs = w.trees.filter((t) => t.kind === TREE.shrub).slice(0, 200);
  const col = new Colliders(w.circles, []);
  const hits = shrubs.filter((t) => col.probe(t.x, t.z, 0.1) && col.probe(t.x, t.z, 0.1).depth > 0.4).length;
  assert.ok(hits < shrubs.length * 0.5, `${hits} of ${shrubs.length} shrubs sit inside a collider`);
});
