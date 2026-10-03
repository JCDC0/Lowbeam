import { test } from 'node:test';
import assert from 'node:assert/strict';
import { poolGrid, POOL_CELL, POOL_PER_CELL } from '../src/render/pool-grid.js';

const lamp = (x, z, power = 1) => ({ x, y: 7, z, c: [power, power, power], range: 20, spot: 1 });

test('a light is listed in every cell it reaches and in no other', () => {
  const g = poolGrid([lamp(0, 0)], 300);
  const listed = (x, z) => {
    const cx = Math.floor((x - g.x0) / POOL_CELL);
    const cz = Math.floor((z - g.x0) / POOL_CELL);
    return g.cells[(cz * g.dims + cx) * POOL_PER_CELL] === 0;
  };
  assert.ok(listed(0, 0));
  assert.ok(listed(18, 0));
  assert.ok(listed(-14, 14));
  assert.ok(!listed(60, 0));
  assert.ok(!listed(0, -70));
});

test('a crowded cell keeps the strongest lights first and never overflows', () => {
  const lights = [];
  for (let i = 0; i < 30; i++) lights.push(lamp((i % 6) * 3 - 8, Math.floor(i / 6) * 3 - 6, 1 + (i === 17 ? 10 : 0)));
  const g = poolGrid(lights, 300);
  const cx = Math.floor((0 - g.x0) / POOL_CELL);
  const cz = Math.floor((0 - g.x0) / POOL_CELL);
  const ids = Array.from(g.cells.subarray((cz * g.dims + cx) * POOL_PER_CELL, (cz * g.dims + cx + 1) * POOL_PER_CELL));
  assert.equal(ids[0], 17);
  assert.ok(ids.every((i) => i >= 0));
  assert.equal(new Set(ids).size, POOL_PER_CELL);
});
