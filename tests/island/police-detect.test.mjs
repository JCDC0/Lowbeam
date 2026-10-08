import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Heat, UNSEEN_GRACE, NOTICE_TIME } from '../../src/police/heat.js';
import { PoliceDirector, NEAR_MISS } from '../../src/police/director.js';
import { TrafficSim, TAIL } from '../../src/traffic/sim.js';
import { KIND_BY_ID } from '../../src/traffic/kinds.js';
import { barOn } from '../../src/police/lights.js';
import { island, trafficNet } from '../island.mjs';

const DT = 1 / 30;

test('the detection bar fills while watched and drains soon after no unit can see the player', () => {
  const h = new Heat();
  for (let t = 0; t < NOTICE_TIME * 0.6; t += DT) h.update(DT, { speeding: true, seen: true });
  const filled = h.attention;
  assert.ok(filled > 0.5 && filled < 1, `filled to ${filled.toFixed(2)}`);
  for (let t = 0; t < UNSEEN_GRACE * 0.8; t += DT) h.update(DT, { seen: false });
  assert.ok(Math.abs(h.attention - filled) < 1e-9, 'it holds through the grace');
  for (let t = 0; t < 3; t += DT) h.update(DT, { seen: false });
  assert.ok(h.attention < 0.05, `out of sight it drains (${h.attention.toFixed(2)})`);
});

test('out of sight the bar does not drain below what a speed camera put on it', () => {
  const h = new Heat();
  h.update(DT, { trap: true, seen: false });
  for (let t = 0; t < 5; t += DT) h.update(DT, { seen: false });
  assert.ok(h.attention >= 0.59, `the camera's share holds (${h.attention.toFixed(2)})`);
  assert.equal(h.update(DT, { trap: true, seen: false }), true, 'and a second trap starts a pursuit');
});

/** A unit standing at x 2.5 and a player passing it at `kmh`. */
function pass(kmh, gap = 2.5) {
  const dir = new PoliceDirector({ rand: () => 0.3 });
  const v = kmh / 3.6;
  const orders = dir.update(DT, {
    player: { x: 0, z: 0, speed: v, vx: 0, vz: v },
    units: [{ id: 7, x: gap, z: 0, yaw: 0, d: gap, clear: true, kind: 'police', vx: 0, vz: 0 }],
    patrols: 2, money: 1e6, limit: 200,
  });
  return { dir, orders };
}

test('shaving past a unit fast provokes it at once; a slow pass or a wide one does not', () => {
  const fast = pass(NEAR_MISS.speed * 3.6 + 20);
  assert.ok(fast.dir.active, 'a near miss at speed starts a pursuit');
  assert.ok(fast.orders.events.some((e) => e.type === 'provoked'));
  assert.equal(pass(50).dir.active, false, 'a slow pass is nothing');
  assert.equal(pass(NEAR_MISS.speed * 3.6 + 20, NEAR_MISS.range + 2).dir.active, false, 'a wide pass is nothing');
});

test('the orders name the units watching the player and how full the bar is', () => {
  const { orders } = pass(60);
  assert.deepEqual(orders.detect.watchers, [7]);
  assert.equal(orders.detect.level, 0, 'within the limit nothing fills');
});

test('a patrol takes up a street racer it sees speeding, with its lights on, and gives up when it is gone', () => {
  const ground = island();
  const net = trafficNet();
  const sim = new TrafficSim(net, { seed: 5, target: 0, rivals: 0, patrols: 0 });
  const chance = TAIL.chance;
  TAIL.chance = 1;
  try {
    const lane = net.lane('c1-f', 1, 1);
    const q = { x: 0, z: 0, tx: 0, tz: 1, y: 0 };
    const put = (a, s, speed) => {
      a.lane = lane;
      a.s = s;
      net.sample(lane, s, q);
      a.x = q.x;
      a.z = q.z;
      a.y = q.y;
      a.yaw = Math.atan2(q.tx, q.tz);
      a.speed = speed;
      a.ex = a.ez = 0;
      // Whatever turn it planned on the lane it spawned on no longer applies.
      a.plan = null;
      a.end = null;
    };
    const cop = sim.spawnUnit({ x: 0, z: 0, speed: 0 }, 'police', 0, 4000);
    const racer = sim.spawnUnit({ x: 0, z: 0, speed: 0 }, 'police', 0, 4000);
    racer.kind = KIND_BY_ID.get('rv-wedge');
    racer.factor = 2;
    put(cop, 2000, lane.limit);
    put(racer, 2040, lane.limit * 1.8);
    const player = { x: cop.x, y: cop.y, z: cop.z, speed: 0 };
    for (let t = 0; t < 2 && !cop.quarry; t += DT) sim.update(DT, player);
    assert.ok(cop.quarry === racer, 'the patrol goes after the racer');
    assert.ok(barOn(cop), 'with its bar on');
    assert.equal(racer.chasedBy, cop.id);
    sim.agents = sim.agents.filter((a) => a !== racer);
    sim.update(DT, player);
    assert.ok(cop.quarry === null, 'it gives up once the racer is gone');
  } finally {
    TAIL.chance = chance;
  }
});
