import test from 'node:test';
import assert from 'node:assert/strict';
import { island, scattered } from '../island.mjs';
import { GLOW, VENDING } from '../../src/world/vending.js';

const g = island();
const world = scattered();
const machines = world.vending;
const hit = { road: null, s: 0, d: 0, h: 0, edge: 0 };

test('the town has vending machines, solid, in every design', () => {
  assert.ok(machines.length > 600, `${machines.length} machines`);
  const designs = new Set(machines.map((m) => m.design));
  assert.equal(designs.size, VENDING.designs);
  for (const m of machines) {
    assert.ok(world.boxes.some((b) => b.x === m.x && b.z === m.z), 'every machine has a collider');
  }
});

test('a machine stands on its sidewalk facing the road, never in a carriageway or a junction', () => {
  for (const m of machines) {
    assert.ok(g.roads.query(m.x, m.z, hit, 0.2), `machine at ${m.x.toFixed(0)}, ${m.z.toFixed(0)} off its sidewalk`);
    const hw = hit.road.hwAt(hit.s);
    assert.ok(Math.abs(hit.d) > hw + VENDING.d / 2, `machine in ${hit.road.id}'s carriageway`);
    const q = hit.road.path.sample(hit.s);
    const toRoad = [q.x - m.x, q.z - m.z];
    const len = Math.hypot(toRoad[0], toRoad[1]);
    const facing = (Math.sin(m.yaw) * toRoad[0] + Math.cos(m.yaw) * toRoad[1]) / len;
    assert.ok(facing > 0.9, `machine on ${hit.road.id} faces away from the road`);
    for (const j of g.junctions) assert.ok(Math.hypot(j.x - m.x, j.z - m.z) > j.r + 8, 'machine in a junction');
  }
});

test('every cluster lights the pavement in front of it', () => {
  const glows = world.lights.filter((l) => l.range === GLOW.range && l.c[0] === GLOW.c[0] && l.c[2] === GLOW.c[2]);
  assert.ok(glows.length >= machines.length / 3, `${glows.length} glows for ${machines.length} machines`);
  for (const l of glows) {
    const near = machines.some((m) => Math.hypot(m.x - l.x, m.z - l.z) < VENDING.d / 2 + GLOW.ahead + 2.5);
    assert.ok(near, 'a glow with no machine behind it');
  }
});
