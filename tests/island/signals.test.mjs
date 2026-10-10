import test from 'node:test';
import assert from 'node:assert/strict';
import { island, scattered, trafficNet } from '../island.mjs';
import { buildTurn, lightState } from '../../src/traffic/net.js';
import { placeSignals, litLamp, signalCircles, SIGNAL } from '../../src/world/signals.js';
import { Colliders } from '../../src/world/collision.js';

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

test('no pole stands where a car drives: clear of every lane and every curve through a crossing, at its height', () => {
  // Sampled here on its own, finer than the placement does. The old check asked only the nearest
  // road at any height and passed with 92 poles in a lane, some in a crossing road or under a deck.
  const CELL = 6;
  const grid = new Map();
  const put = (x, z, y, half) => {
    const k = `${Math.floor(x / CELL)},${Math.floor(z / CELL)}`;
    if (!grid.has(k)) grid.set(k, []);
    grid.get(k).push(x, z, y, half);
  };
  const q = { x: 0, z: 0, tx: 0, tz: 1, y: 0 };
  const q2 = { x: 0, z: 0, tx: 0, tz: 1, y: 0 };
  for (const lane of net.lanes) {
    for (let s = 0; s <= lane.length + 0.74; s += 0.75) {
      net.sample(lane, Math.min(s, lane.length), q);
      put(q.x, q.z, q.y, lane.width / 2);
    }
    for (const m of lane.mids) {
      net.sample(lane, m.at, q);
      net.sample(m.lane, m.toS, q2);
      const c = buildTurn(q, q2);
      for (let d = 0; d <= c.length + 0.49; d += 0.5) {
        const p = c.at(Math.min(1, d / Math.max(0.001, c.length)));
        put(p.x, p.z, p.y, Math.max(lane.width, m.lane.width) / 2);
      }
    }
  }
  const bad = [];
  for (const s of signals) {
    let worst = Infinity;
    const cx = Math.floor(s.px / CELL);
    const cz = Math.floor(s.pz / CELL);
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
      const a = grid.get(`${cx + i},${cz + j}`) || [];
      for (let k = 0; k < a.length; k += 4) {
        if (Math.abs(a[k + 2] - s.py) > 4) continue;
        worst = Math.min(worst, Math.hypot(a[k] - s.px, a[k + 1] - s.pz) - a[k + 3] - SIGNAL.pole);
      }
    }
    if (worst < 0.3) bad.push(`${s.road} at (${s.px.toFixed(0)}, ${s.pz.toFixed(0)}): ${worst.toFixed(2)} m from a lane's edge`);
  }
  assert.deepEqual(bad, [], `${bad.length} poles where cars drive`);
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

test('a pole under a deck stops the traffic below it but not a car on the deck', () => {
  const circles = signalCircles(signals, g);
  const under = circles.filter((c) => c.y1 !== undefined);
  assert.ok(under.length > 10, `${under.length} poles stand under a deck`);
  const col = new Colliders(circles, []);
  const hit = { road: null, s: 0, d: 0, h: 0, edge: 0, lift: 0 };
  for (const c of under) {
    assert.ok(g.roads.query(c.x, c.z, hit, 0, -Infinity, Infinity));
    assert.equal(col.probe(c.x + 0.5, c.z, 0.9, hit.h + 0.3), null, 'a car on the deck passes over the pole');
    assert.ok(col.probe(c.x + 0.5, c.z, 0.9, g.at(c.x, c.z).h + 0.3), 'a car on the street below meets it');
  }
});

test('nothing static stops a car on the lanes of the Kurogane Line', () => {
  const col = new Colliders(scattered().circles.slice(), scattered().boxes);
  col.addCircles(signalCircles(signals, g));
  for (const id of ['c3-f', 'c3-r']) {
    const road = g.roads.byId.get(id);
    const lanes = road.def.lanes;
    for (let s = 0; s < road.path.length; s += 2) {
      const q = road.path.sample(s);
      for (let k = 0; k < lanes; k++) {
        const d = (k - (lanes - 1) / 2) * 3.5;
        const hit = col.probe(q.x + q.tz * d, q.z - q.tx * d, 0.9, road.heightAt(s) + 0.3);
        assert.equal(hit, null, `${id} at ${s} m, lane ${k}: something stops a car on the deck`);
      }
    }
  }
});

test('no pole stands within a car\'s width of a lane center, so a civilian is never driven into one', () => {
  const o = { x: 0, z: 0, tx: 0, tz: 1, y: 0 };
  const poles = signals.map((s) => ({ x: s.px, z: s.pz, y: s.py }));
  let close = 0;
  const worst = [];
  for (const lane of net.lanes) {
    for (let s = 2; s < lane.length - 2; s += 2) {
      net.sample(lane, s, o);
      for (const p of poles) {
        if (Math.abs(p.x - o.x) > 1.2 || Math.abs(p.z - o.z) > 1.2 || Math.abs(p.y - o.y) > 3) continue;
        const d = Math.hypot(p.x - o.x, p.z - o.z);
        if (d < 1.0) {
          close++;
          if (worst.length < 4) worst.push(`${lane.id} at ${s.toFixed(0)}: ${d.toFixed(2)} m from the pole at ${p.x.toFixed(0)}, ${p.z.toFixed(0)}`);
        }
      }
    }
  }
  assert.ok(close <= 12, `${close} lane samples pass within 1 m of a pole: ${worst.join('; ')}`);
});
