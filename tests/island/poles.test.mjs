import test from 'node:test';
import assert from 'node:assert/strict';
import { island, scattered } from '../island.mjs';
import { POLE } from '../../src/world/poles.js';

const g = island();
const world = scattered();
const { poles, spans } = world.poles;
const hit = { road: null, s: 0, d: 0, h: 0, edge: 0 };

test('the back streets have utility poles strung with wires', () => {
  assert.ok(poles.length > 2000, `${poles.length} poles`);
  assert.ok(spans.length > poles.length * 0.6, `${spans.length} spans`);
  for (const [a, b] of spans) {
    const d = Math.hypot(poles[a].x - poles[b].x, poles[a].z - poles[b].z);
    assert.ok(d > 10 && d < POLE.maxSpan + 7, `a span of ${d.toFixed(1)} m`);
  }
});

test('a pole stands on a sidewalk, out of the carriageway, the junctions and the lamp posts', () => {
  const lamps = world.lamps;
  for (const p of poles) {
    assert.ok(g.roads.query(p.x, p.z, hit, 0.2), `pole at ${p.x.toFixed(0)}, ${p.z.toFixed(0)} off its sidewalk`);
    assert.ok(Math.abs(hit.d) > hit.road.hwAt(hit.s), `pole in ${hit.road.id}'s carriageway`);
    for (const j of g.junctions) assert.ok(Math.hypot(j.x - p.x, j.z - p.z) > j.r, 'pole in a junction');
    assert.ok(world.circles.some((c) => c.x === p.x && c.z === p.z), 'every pole is solid');
  }
  for (const l of lamps) {
    for (const p of poles) {
      if (Math.abs(l.x - p.x) > 3 || Math.abs(l.z - p.z) > 3) continue;
      assert.ok(Math.hypot(l.x - p.x, l.z - p.z) > 1.5, 'a pole on top of a lamp post');
    }
  }
});

test('no vending machine stands on a pole', () => {
  for (const m of world.vending) {
    for (const p of poles) {
      if (Math.abs(m.x - p.x) > 3 || Math.abs(m.z - p.z) > 3) continue;
      assert.ok(Math.hypot(m.x - p.x, m.z - p.z) > 1, 'a machine on a pole');
    }
  }
});
