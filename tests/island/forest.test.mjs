import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Colliders } from '../../src/world/collision.js';
import { TREE, TREE_COUNT } from '../../src/world/forest.js';
import { inland } from '../../src/world/island.js';
import { WORLD_HALF } from '../../src/world/layout.js';
import { island, scattered } from '../island.mjs';

const g = island();
const w = scattered();

test('every species is planted, and the valley is not one or two kinds', () => {
  const counts = new Array(TREE_COUNT).fill(0);
  for (const t of w.trees) counts[t.kind]++;
  for (let k = 0; k < TREE_COUNT; k++) assert.ok(counts[k] > 150, `species ${k} has only ${counts[k]} trees`);
  const valley = w.trees.filter((t) => Math.hypot(t.x, t.z) < 480 && Math.hypot(t.x + 330, t.z - 490) > 260);
  const kinds = new Set(valley.map((t) => t.kind));
  assert.ok(kinds.size >= 6, `valley floor has only ${kinds.size} species`);
  assert.ok(w.trees.length > 30000, `only ${w.trees.length} trees`);
});

test('trees keep clear of roads and pads', () => {
  for (const t of w.trees) {
    const hit = g.at(t.x, t.z);
    assert.equal(hit.road, null, `tree on a road at ${t.x.toFixed(0)}, ${t.z.toFixed(0)}`);
    assert.equal(hit.pad, null);
  }
});

test('the island is ringed by sea: every way off it ends in the water', () => {
  for (let t = -WORLD_HALF; t <= WORLD_HALF; t += 40) {
    for (const [x, z] of [[t, -WORLD_HALF + 30], [t, WORLD_HALF - 30], [-WORLD_HALF + 30, t], [WORLD_HALF - 30, t]]) {
      const hit = g.at(x, z);
      assert.equal(hit.surface, 'water', `land at the map edge at ${x}, ${z} (${hit.h.toFixed(1)} m)`);
    }
  }
});

test('the shore is lined with pines, not a forest wall', () => {
  const shore = w.trees.filter((t) => inland(t.x, t.z) < 120);
  assert.ok(shore.length > 500, `only ${shore.length} trees along the shore`);
  const pines = shore.filter((t) => t.kind === TREE.pine).length;
  assert.ok(pines > shore.length * 0.45, `${pines} of ${shore.length} shore trees are pines`);
});

test('shrubs do not collide, other species do', () => {
  const before = w.circles.length;
  assert.ok(before > w.trees.filter((t) => t.kind !== TREE.shrub).length * 0.9);
  const shrubs = w.trees.filter((t) => t.kind === TREE.shrub).slice(0, 200);
  const col = new Colliders(w.circles, []);
  const hits = shrubs.filter((t) => col.probe(t.x, t.z, 0.1) && col.probe(t.x, t.z, 0.1).depth > 0.4).length;
  assert.ok(hits < shrubs.length * 0.5, `${hits} of ${shrubs.length} shrubs sit inside a collider`);
});
