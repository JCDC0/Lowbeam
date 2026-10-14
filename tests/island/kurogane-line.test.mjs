import test from 'node:test';
import assert from 'node:assert/strict';
import { island, trafficNet } from '../island.mjs';

const g = island();
const net = trafficNet();
const road = (id) => /** @type {import('../../src/world/roads.js').Road} */ (g.roads.byId.get(id));

test('the Kurogane Line rides 12 m over Kurogane-dori, the avenue on the ground beneath it', () => {
  const dori = road('dori');
  const line = road('c3-f');
  let over = 0;
  for (let s = 0; s < line.path.length; s += 20) {
    const q = line.path.sample(s);
    const below = dori.path.nearest(q.x, q.z);
    if (Math.abs(below.d) > 7) continue;
    over++;
    const gap = line.heightAt(s) - dori.heightAt(below.s);
    assert.ok(Math.abs(gap - 12) < 0.6, `at ${q.x.toFixed(0)}, ${q.z.toFixed(0)} the deck is ${gap.toFixed(1)} m over the avenue`);
    assert.equal(g.at(q.x, q.z, line.heightAt(s) + 0.5).road?.id, 'c3-f', 'a car at deck height is on the line');
    const ground = g.at(q.x, q.z, dori.heightAt(below.s) + 0.5).road;
    assert.ok(ground && !ground.id.startsWith('c3'), `a car on the avenue stays on the ground, not ${ground?.id}`);
  }
  assert.ok(over * 20 > 1000, `only ${over * 20} m of the line runs over the avenue`);
});

test('streets pass under the line without a junction, and none meets it on the ground', () => {
  const line = road('c3-r');
  const under = new Set();
  for (let s = 0; s < line.path.length; s += 4) {
    const q = line.path.sample(s);
    assert.ok(line.liftAt(s) >= 5.9, `the line is only ${line.liftAt(s).toFixed(1)} m up at s=${s}`);
    const hit = { road: null, s: 0, d: 0, h: 0, edge: 0 };
    if (g.roads.query(q.x, q.z, hit) && hit.road.def.cls === 'street') under.add(hit.road.id);
  }
  assert.ok(under.size >= 6, `${under.size} streets pass under the line`);
  for (const j of g.junctions) {
    const q = line.path.nearest(j.x, j.z);
    if (Math.abs(q.d) < 2) assert.ok(line.liftAt(q.s) > 5, 'a junction under the line is on the ground, not on the deck');
  }
});

test('traffic can drive from Route 1 onto the line at one end and off it at the other, both ways', () => {
  const inner = net.lane('c1-r', 1, 0);
  const fwd = net.lane('c3-f', 1, 0);
  const rev = net.lane('c3-r', 1, 0);
  assert.ok(inner && fwd && rev);
  const mid = (l) => [{ lane: l, s: l.length / 2 }];
  assert.ok(net.route(inner, 2000, mid(fwd), { maxCost: 4000 }), 'the south-west exit leads onto the eastbound line');
  assert.ok(net.route(inner, 4000, mid(rev), { maxCost: 4000 }), 'the south-east exit leads onto the westbound line');
  assert.ok(net.route(fwd, fwd.length / 2, [{ lane: inner, s: 5600 }], { maxCost: 4000 }), 'the eastbound line comes down onto Route 1');
  assert.ok(net.route(rev, rev.length / 2, [{ lane: inner, s: 3700 }], { maxCost: 4000 }), 'the westbound line comes down onto Route 1');
});

test('a median barrier runs the whole deck with no gap, past both ends into the fork of the ramps', async () => {
  const { placeHighway, SEGMENT } = await import('../../src/world/highway.js');
  const { barrier } = placeHighway(g, [], [], []);
  const line = road('c3-f');
  const half = line.def.median / 2 + line.hw;
  const on = barrier.filter((b) => {
    const n = line.path.nearest(b.x, b.z);
    return Math.abs(Math.hypot(b.x - line.path.sample(n.s).x, b.z - line.path.sample(n.s).z) - half) < 0.6 && Math.abs(b.y - line.heightAt(n.s)) < 1;
  });
  const cover = on.map((b) => line.path.nearest(b.x, b.z).s).sort((a, b) => a - b);
  assert.ok(cover.length > line.path.length / SEGMENT - 2, `${cover.length} pieces along ${line.path.length.toFixed(0)} m`);
  for (let i = 1; i < cover.length; i++) assert.ok(cover[i] - cover[i - 1] <= SEGMENT + 0.5, `a gap at ${cover[i - 1].toFixed(0)} m`);
  const nose = (s, dir) => {
    const q = line.path.sample(s);
    return on.some((b) => (b.x - q.x) * q.tx * dir + (b.z - q.z) * q.tz * dir > 0 && b.len > SEGMENT);
  };
  assert.ok(nose(0, -1) && nose(line.path.length, 1), 'a nose past each end');
});

test('vehicles over 12 m (semi) never choose or spawn onto Kurogane Line ramps', async () => {
  const { TrafficSim } = await import('../../src/traffic/sim.js');
  const { KINDS } = await import('../../src/traffic/kinds.js');
  const sim = new TrafficSim(net, { seed: 42, target: 40, rivals: 0, patrols: 0 });
  const semi = KINDS.find((k) => k.id === 'semi');
  assert.ok(semi && semi.length > 12);
  const c1Lane = net.lane('c1-r', 1, 0);
  assert.ok(c1Lane);
  const agent = {
    id: 1, kind: semi, lane: c1Lane, s: 3500, mode: 'drive',
    plan: null, end: null, changeDuration: 0,
  };
  const { makeRng } = await import('../../src/core/rng.js');
  for (let seed = 0; seed < 50; seed++) {
    sim.rng = makeRng(seed);
    sim.choose(agent);
    if (agent.plan) {
      assert.ok(!agent.plan.lane.road.id.startsWith('c3-ramp'), `semi must not take c3-ramp exit (planned ${agent.plan.lane.road.id})`);
    }
  }

  // Spawning check: spawning on a c3-ramp never produces a vehicle > 12 m
  const c3RampLanes = net.lanes.filter((l) => l.road.id.startsWith('c3-ramp'));
  assert.ok(c3RampLanes.length > 0);
  for (const rampLane of c3RampLanes) {
    const q = net.sample(rampLane, rampLane.length / 2, {});
    const player = { x: q.x + 80, z: q.z + 80, speed: 0 };
    for (let i = 0; i < 20; i++) {
      const a = sim.spawn(player, 60, 200);
      if (a && a.lane.road.id.startsWith('c3-ramp')) {
        assert.ok(a.kind.length <= 12, `vehicle on ${a.lane.road.id} has length ${a.kind.length} <= 12 m`);
      }
    }
  }
});

