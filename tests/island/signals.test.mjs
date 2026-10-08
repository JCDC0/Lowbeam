import test from 'node:test';
import assert from 'node:assert/strict';
import { island, trafficNet } from '../island.mjs';
import { lightState } from '../../src/traffic/net.js';
import { placeSignals, litLamp, SIGNAL } from '../../src/world/signals.js';

const g = island();
const net = trafficNet();
const signals = placeSignals(net, g);

test('most lit crossings get a signal for each way in', () => {
  assert.ok(signals.length > 2000, `only ${signals.length} signals`);
  const nodes = new Set(signals.map((s) => s.node));
  assert.ok(nodes.size > net.nodes.length * 0.9, `${nodes.size} of ${net.nodes.length} crossings signed`);
});

test('a head hangs over its own lanes past the crossing, facing the cars it stops', () => {
  for (const s of signals) {
    const road = g.roads.byId.get(s.road);
    const h = road.path.nearest(s.x, s.z);
    const q = road.path.sample(h.s);
    const tx = q.tx * s.dir;
    const tz = q.tz * s.dir;
    assert.ok(tx * Math.sin(s.yaw) + tz * Math.cos(s.yaw) > 0.9, `${s.road}: head faces across its road`);
    const left = (s.x - q.x) * tz - (s.z - q.z) * tx;
    assert.ok(left > 0 && left < road.hwAt(h.s), `${s.road}: head ${left.toFixed(1)} m left of center`);
    const ahead = (s.x - s.node.x) * tx + (s.z - s.node.z) * tz;
    assert.ok(ahead > 0 && ahead < 40, `${s.road}: head ${ahead.toFixed(1)} m past the crossing`);
    assert.ok(s.y - s.py > SIGNAL.height - 2.5, 'the pole reaches the head');
  }
});

test('no pole stands in a carriageway', () => {
  const hit = { road: null, s: 0, d: 0, h: 0, edge: 0 };
  for (const s of signals) {
    if (!g.roads.query(s.px, s.pz, hit, 0)) continue;
    assert.ok(Math.abs(hit.d) >= hit.road.hwAt(hit.s), `pole in ${hit.road.id}`);
  }
});

test('the lamps show the phase the traffic obeys, and crossing ways are never green together', () => {
  const byNode = new Map();
  for (const s of signals) byNode.set(s.node, [...(byNode.get(s.node) || []), s]);
  for (let t = 0; t < 70; t += 0.7) {
    for (const [node, list] of byNode) {
      const green = new Set();
      for (const s of list) {
        const state = lightState(node, s.axis, t);
        assert.equal(litLamp(s, t), state === 'green' ? 0 : state === 'yellow' ? 1 : 2);
        if (state === 'green') green.add(s.axis);
      }
      assert.ok(green.size < 2);
    }
  }
});
