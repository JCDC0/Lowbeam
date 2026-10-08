import test from 'node:test';
import assert from 'node:assert/strict';
import { Ground } from '../src/world/ground.js';
import { placeMarkings, MARKING } from '../src/world/markings.js';

const g = new Ground();
const marks = placeMarkings(g.junctions);
const hit = { road: null, s: 0, d: 0, h: 0, edge: 0 };

test('town junctions get zebra crossings and stop lines', () => {
  const zebras = marks.filter((m) => m.kind === 'zebra');
  const stops = marks.filter((m) => m.kind === 'stop');
  assert.ok(zebras.length > 3000, `${zebras.length} zebras`);
  assert.ok(stops.length > zebras.length * 0.95);
});

test('the paint lies on a road, not in the middle of the crossing', () => {
  for (const m of marks) {
    assert.ok(g.roads.query(m.x, m.z, hit, 0), `${m.kind} at ${m.x.toFixed(0)}, ${m.z.toFixed(0)} off every road`);
    const j = g.junctions.reduce((a, b) => (Math.hypot(b.x - m.x, b.z - m.z) < Math.hypot(a.x - m.x, a.z - m.z) ? b : a));
    const d = Math.hypot(j.x - m.x, j.z - m.z);
    assert.ok(d > MARKING.gap + MARKING.zebra / 2, `${m.kind} ${d.toFixed(1)} m from its junction's center`);
  }
});

test('a stop line covers the incoming lanes, ahead of where the traffic stops', () => {
  const tooFar = [];
  for (const j of g.junctions) {
    for (const arm of j.arms) {
      if (!arm.road.walk) continue;
      let cross = 0;
      for (const o of j.arms) if (o.road !== arm.road) cross = Math.max(cross, o.road.hwAt(o.road.path.wrapS(o.s)));
      if (!cross) continue;
      const line = cross + MARKING.gap + MARKING.zebra + MARKING.toLine + MARKING.line;
      // net.js stops cars 3.5 m past the crossed road's edge; sim.js keeps a 2.2 m gap to it.
      if (line > cross + 3.5 + 2.2) tooFar.push(arm.road.id);
    }
  }
  assert.deepEqual(tooFar, []);
  for (const m of marks.filter((x) => x.kind === 'stop')) {
    const road = g.roads.byId.get(m.road);
    const q = road.path.sample(road.path.nearest(m.x, m.z).s);
    const tx = Math.sin(m.yaw);
    const tz = Math.cos(m.yaw);
    // The arm points away from the junction; the cars coming in drive the other way and keep left.
    const side = (m.x - q.x) * -tz + (m.z - q.z) * tx;
    assert.ok(side > 0, `stop line on ${m.road} is on the outgoing side`);
  }
});
