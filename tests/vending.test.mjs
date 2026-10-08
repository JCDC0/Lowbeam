import test from 'node:test';
import assert from 'node:assert/strict';
import { Ground } from '../src/world/ground.js';
import { scatterWorld } from '../src/world/scatter.js';
import { VENDING } from '../src/world/vending.js';

const g = new Ground();
const world = scatterWorld(g);
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
