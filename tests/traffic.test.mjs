import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Ground } from '../src/world/ground.js';
import { TrafficNet, lightState } from '../src/traffic/net.js';
import { TrafficSim } from '../src/traffic/sim.js';
import { KINDS } from '../src/traffic/kinds.js';
import { collideCars } from '../src/vehicles/contact.js';
import { carById } from '../src/vehicles/specs.js';
import { createVehicleState } from '../src/vehicles/physics.js';

const ground = new Ground();
const net = new TrafficNet(ground.roads);

function reach(start) {
  const seen = new Set([start]);
  const stack = [start];
  while (stack.length) {
    const lane = stack.pop();
    for (const l of [...lane.ends, ...lane.mids]) {
      if (!seen.has(l.lane)) {
        seen.add(l.lane);
        stack.push(l.lane);
      }
    }
  }
  return seen;
}

test('every road has lanes, with keep-left offsets and a limit', () => {
  for (const road of ground.roads.roads) {
    const lanes = net.byRoad.get(road.id);
    assert.ok(lanes && lanes.length > 0, `${road.id} has no lanes`);
    for (const l of lanes) {
      assert.ok(l.limit > 5, `${l.id} limit ${l.limit}`);
      assert.ok(Math.abs(l.offset) <= road.hw, `${l.id} offset ${l.offset}`);
      assert.ok(road.def.oneway ? true : l.offset > 0, `${l.id} (two-way) is not on the left of its travel`);
    }
    assert.equal(lanes.filter((l) => l.dir === -1).length > 0, !road.def.oneway, `${road.id} directions`);
  }
  assert.equal(net.byRoad.get('c1-f').length, 3);
  assert.equal(net.byRoad.get('r18').length, 4);
});

test('the lanes join up: from the harbor you can drive to the loop, every avenue, the pass and the city', () => {
  const seen = reach(net.lane('harbor', 1, 0));
  for (const id of ['c1-f:f0', 'c1-r:f0', 'r18:f0', 'r18:r0', 'west:f0', 'west:r0', 'east:f0', 'kuro:f0', 'kuro:r0', 'k-ew3:f0', 'k-ns5:r0']) {
    const lane = net.lanes.find((l) => l.id === id);
    assert.ok(seen.has(lane), `cannot reach ${id} from Harbor Ave`);
  }
  // Every ramp is on a route somebody can drive.
  for (const road of ground.roads.roads.filter((r) => r.def.cls === 'ramp')) assert.ok(seen.has(net.lane(road.id, 1, 0)), `${road.id} is unreachable`);
});

test('a lane is where the road is: keep-left on a two-way road, traveling the right way', () => {
  const q = { x: 0, z: 0, tx: 0, tz: 1, y: 0 };
  const lane = net.lane('r18', 1, 0);
  net.sample(lane, 100, q);
  const road = lane.road;
  const hit = road.path.nearest(q.x, q.z);
  assert.ok(hit.d > 0 && Math.abs(hit.d - lane.offset) < 0.5, `forward lane at d ${hit.d}`);
  const back = net.lane('r18', -1, 0);
  net.sample(back, 100, q);
  const hb = road.path.nearest(q.x, q.z);
  assert.ok(hb.d < 0 && Math.abs(hb.d + back.offset) < 0.5, `reverse lane at d ${hb.d}`);
  const t = { x: 0, z: 0, tx: 0, tz: 0, y: 0 };
  net.sample(back, 100, t);
  const p = road.path.sample(road.path.length - 100);
  assert.ok(t.tx * p.tx + t.tz * p.tz < -0.9, 'the reverse lane should run against the path');
});

test('city streets have lights that alternate between the two axes', () => {
  assert.ok(net.nodes.length >= 90, `${net.nodes.length} light nodes`);
  const node = net.nodes[0];
  for (let t = 0; t < 120; t += 1.3) {
    const a = lightState(node, 0, t);
    const b = lightState(node, 1, t);
    assert.ok(!(a === 'green' && b === 'green'), `both axes green at ${t}`);
    assert.ok(['green', 'yellow', 'red'].includes(a));
  }
  const seen = new Set();
  for (let t = 0; t < 120; t += 0.5) seen.add(lightState(node, 0, t));
  assert.deepEqual([...seen].sort(), ['green', 'red', 'yellow']);
});

test('the traffic fills the roads, keeps its distance and respects the limits', () => {
  for (const at of [[-300, -380], [0, 1400], [-2400, -1400]]) {
    const sim = new TrafficSim(net, { seed: 9, target: 36 });
    const player = { x: at[0], z: at[1], speed: 0 };
    sim.populate(player);
    assert.ok(sim.agents.length >= 8, `only ${sim.agents.length} agents near ${at}`);
    let overlaps = 0;
    const last = new Map();
    for (let t = 0; t < 120; t += 1 / 30) {
      sim.update(1 / 30, player);
      for (const a of sim.agents) {
        assert.ok(Number.isFinite(a.x + a.z + a.speed + a.yaw), 'bad number');
        // Coming off a faster road, a car slows down to the new limit rather than jumping to it.
        const before = last.get(a.id) ?? 0;
        assert.ok(a.speed <= a.lane.limit * 1.16 + 0.5 || a.speed <= before + 0.05, `${a.kind.id} at ${(a.speed * 3.6).toFixed(0)} km/h in a ${(a.lane.limit * 3.6).toFixed(0)} lane`);
        last.set(a.id, a.speed);
      }
      if (Math.round(t * 30) % 30 === 0) {
        for (let i = 0; i < sim.agents.length; i++) {
          for (let j = i + 1; j < sim.agents.length; j++) {
            const a = sim.agents[i];
            const b = sim.agents[j];
            if (a.lane.road === b.lane.road && Math.hypot(a.x - b.x, a.z - b.z) < Math.min(a.kind.length, b.kind.length) * 0.4) overlaps++;
          }
        }
      }
    }
    assert.ok(overlaps <= 3, `${overlaps} overlapping pairs near ${at}`);
  }
});

test('cars stop at a red light and go again on green', () => {
  const sim = new TrafficSim(net, { seed: 3, target: 0 });
  const lane = net.lane('k-ns5', 1, 0);
  const stop = lane.stops[0];
  const here = net.sample(lane, stop.s, { x: 0, z: 0, tx: 0, tz: 1, y: 0 });
  const player = { x: here.x + 300, z: here.z, speed: 0 };
  const a = sim.spawn(player, 0, 1e9);
  assert.ok(a);
  sim.agents.length = 0;
  const car = /** @type {any} */ ({
    ...a, lane, s: Math.max(1, stop.s - 60), speed: 12, factor: 1, plan: null, end: null, kind: KINDS[0], cap: Infinity, capUntil: 0, mode: 'drive',
  });
  sim.agents.push(car);
  // Find a moment when this axis is red or about to be.
  let t = 0;
  while (lightState(stop.node, stop.axis, t) !== 'red' && t < 200) t += 0.25;
  sim.time = t - 4;
  let minGap = Infinity;
  for (let i = 0; i < 25 * 30; i++) {
    sim.update(1 / 30, player);
    if (lightState(stop.node, stop.axis, sim.time) === 'red') minGap = Math.min(minGap, stop.s - car.s);
    assert.ok(car.s < stop.s + 2 || lightState(stop.node, stop.axis, sim.time) !== 'red' || sim.time > t + 12, 'ran the light');
  }
  assert.ok(car.s > stop.s, `never got going again: at ${car.s} of ${stop.s}`);
  assert.ok(minGap > -1.5, `crossed the stop line by ${-minGap}`);
});

test('the player hitting a car makes a wreck and moves both', () => {
  const sim = new TrafficSim(net, { seed: 4, target: 0 });
  const lane = net.lane('c1-f', 1, 1);
  const spec = carById('hayate');
  const q = { x: 0, z: 0, tx: 0, tz: 1, y: 0 };
  net.sample(lane, 500, q);
  const far = { x: q.x + 250, z: q.z + 250, speed: 0 };
  const a = sim.spawn(far, 0, 1e9);
  sim.agents.length = 0;
  const kind = KINDS[0];
  const car = /** @type {any} */ ({ ...a, lane, s: 500, speed: 20, factor: 1, plan: null, end: null, kind, mode: 'drive', cap: Infinity, capUntil: 0, x: q.x, y: q.y, z: q.z, yaw: Math.atan2(q.tx, q.tz) });
  sim.agents.push(car);
  const me = createVehicleState(spec);
  me.x = q.x - q.tx * 3.5;
  me.z = q.z - q.tz * 3.5;
  me.y = q.y;
  me.yaw = car.yaw;
  me.vx = q.tx * 45;
  me.vz = q.tz * 45;
  sim.update(1 / 60, far);
  const closing = sim.collideWithPlayer(me, spec);
  assert.ok(closing > 10, `closing speed ${closing}`);
  assert.equal(car.mode, 'wreck');
  const ahead = (car.vx * q.tx + car.vz * q.tz);
  assert.ok(ahead > 20, `the car ahead was knocked to ${ahead} m/s`);
  assert.ok(me.vx * q.tx + me.vz * q.tz < 45, 'the player lost no speed');
  for (let i = 0; i < 60 * 30; i++) sim.update(1 / 60, far);
  assert.ok(car.speed < 0.1 || sim.agents.length === 0, 'the wreck never stopped');
});

test('contact between two cars conserves momentum and does not need the same mass', () => {
  const mk = (x, vx, mass) => ({ x, z: 0, yaw: Math.PI / 2, vx, vz: 0, yawRate: 0, mass, inertia: mass * 3, width: 1.8, length: 4.5, offset: 0 });
  const a = mk(0, 20, 1500);
  const b = mk(4, 0, 6000);
  const before = a.vx * a.mass + b.vx * b.mass;
  const hit = collideCars(a, b);
  assert.ok(hit > 10);
  const after = a.vx * a.mass + b.vx * b.mass;
  assert.ok(Math.abs(after - before) / before < 0.02, `momentum ${before} to ${after}`);
  assert.ok(a.vx < 5 && b.vx > 0, 'the light car should bounce off the heavy one');
  assert.ok(Math.hypot(a.x - b.x, a.z - b.z) > 4, 'still overlapping');
});
