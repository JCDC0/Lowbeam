import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Ground } from '../src/world/ground.js';
import { scatterWorld } from '../src/world/scatter.js';
import { EnvMap } from '../src/audio/env.js';
import { LAKE, TOWN } from '../src/world/layout.js';

const w = scatterWorld(new Ground());
const env = new EnvMap(w.trees);

test('the edge forest is thick and the middle of town has none', () => {
  const belt = env.at(0, -930).forest;
  const town = env.at((TOWN.x0 + TOWN.x1) / 2, (TOWN.z0 + TOWN.z1) / 2);
  assert.ok(belt > 0.8, `belt forest ${belt}`);
  assert.ok(town.forest < 0.2, `town forest ${town.forest}`);
  assert.equal(town.town, 1);
});

test('the lake is loud at its shore and silent across the valley', () => {
  assert.ok(env.at(LAKE.x, LAKE.z - LAKE.r + 10).water > 0.95);
  assert.equal(env.at(500, -300).water, 0);
});

test('values stay in 0 to 1 everywhere, including outside the map', () => {
  for (let x = -1100; x <= 1100; x += 137) {
    for (let z = -1100; z <= 1100; z += 151) {
      const a = env.at(x, z);
      for (const v of [a.forest, a.town, a.water]) assert.ok(v >= 0 && v <= 1 && Number.isFinite(v), `${x},${z}: ${v}`);
    }
  }
});
