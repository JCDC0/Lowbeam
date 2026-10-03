import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Ground } from '../src/world/ground.js';
import { TrafficNet, lightState } from '../src/traffic/net.js';
import { TrafficSim } from '../src/traffic/sim.js';
import { KINDS, RIVALS } from '../src/traffic/kinds.js';
import { collideCars } from '../src/vehicles/contact.js';
import { carById } from '../src/vehicles/specs.js';
import { createVehicleState } from '../src/vehicles/physics.js';
import { wrapAngle } from '../src/core/mathx.js';

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
        const ceiling = sim.isRival(a) ? a.lane.limit * a.factor * 1.1 : a.lane.limit * 1.16;
        assert.ok(a.speed <= ceiling + 0.5 || a.speed <= before + 0.05, `${a.kind.id} at ${(a.speed * 3.6).toFixed(0)} km/h in a ${(a.lane.limit * 3.6).toFixed(0)} lane`);
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

test('street racers cruise Route 1 far above the limit, stay on it and are replaced when lost', () => {
  const lane = net.lane('c1-f', 1, 1);
  const q = { x: 0, z: 0, tx: 0, tz: 1, y: 0 };
  net.sample(lane, 1500, q);
  const player = { x: q.x, z: q.z, speed: 0 };
  const sim = new TrafficSim(net, { seed: 21, target: 30, rivals: 5 });
  sim.populate(player);
  assert.equal(sim.countRivals(), 5, 'rivals at the start');
  const seen = new Set();
  let racerSpeed = 0;
  let racerSamples = 0;
  let trafficSpeed = 0;
  let trafficSamples = 0;
  for (let t = 0; t < 90; t += 1 / 30) {
    sim.update(1 / 30, player);
    assert.ok(sim.countRivals() <= 5, 'too many rivals');
    for (const a of sim.agents) {
      assert.ok(Number.isFinite(a.x + a.z + a.speed), 'bad number');
      if (sim.isRival(a)) {
        seen.add(a.kind.id);
        assert.ok(a.lane.cls === 'expressway', `${a.kind.id} left the expressway for ${a.lane.id}`);
        racerSpeed += a.speed;
        racerSamples++;
      } else if (a.lane.cls === 'expressway') {
        trafficSpeed += a.speed;
        trafficSamples++;
      }
    }
  }
  assert.ok(racerSamples > 0 && trafficSamples > 0, 'nobody to compare');
  const ratio = racerSpeed / racerSamples / (trafficSpeed / trafficSamples);
  assert.ok(ratio > 1.4, `racers only ${ratio.toFixed(2)} times faster than traffic`);
  assert.ok(sim.countRivals() >= 3, `${sim.countRivals()} rivals left after 90 s`);
  for (const k of RIVALS) assert.ok(k.speed[0] > 1.0 && k.name && k.weights.expressway > 0, k.id);
});

test('the nearest rival is reported with its distance and whether it is ahead', () => {
  const sim = new TrafficSim(net, { seed: 5, target: 0, rivals: 0 });
  const lane = net.lane('c1-f', 1, 2);
  const q = { x: 0, z: 0, tx: 0, tz: 1, y: 0 };
  net.sample(lane, 800, q);
  const far = { x: q.x + 4000, z: q.z, speed: 0 };
  const a = sim.spawnRival({ x: q.x, z: q.z }, 0, 1e9);
  assert.ok(a);
  a.lane = lane;
  a.s = 800;
  a.x = q.x;
  a.z = q.z;
  const yaw = Math.atan2(q.tx, q.tz);
  const behind = { x: q.x - q.tx * 90, z: q.z - q.tz * 90, yaw };
  const hit = sim.nearestRival(behind, 200);
  assert.ok(hit && hit.agent === a);
  assert.ok(Math.abs(hit.distance - 90) < 0.5, `distance ${hit.distance}`);
  assert.equal(hit.ahead, true);
  const past = { x: q.x + q.tx * 60, z: q.z + q.tz * 60, yaw };
  assert.equal(sim.nearestRival(past, 200)?.ahead, false);
  assert.equal(sim.nearestRival(far, 200), null);
});

test('during any lane change the heading differs from the lane tangent by between 1 and 12 degrees and lateral speed is under 3 m/s', () => {
  const sim = new TrafficSim(net, { seed: 12, target: 0, rivals: 0 });
  const lane0 = net.lane('c1-f', 1, 0);
  const lane1 = net.lane('c1-f', 1, 1);
  assert.ok(lane0 && lane1);
  const q = { x: 0, z: 0, tx: 0, tz: 1, y: 0 };
  net.sample(lane0, 1000, q);
  const player = { x: q.x + 100, z: q.z, speed: 0 };
  const a = sim.spawn(player, 0, 1e9);
  assert.ok(a);
  a.lane = lane0;
  a.s = 1000;
  a.speed = 60 / 3.6;
  a.x = q.x;
  a.z = q.z;
  a.yaw = Math.atan2(q.tx, q.tz);
  a.nextChange = 0;
  sim.startLaneChange(a, lane1);
  assert.ok(a.changeDuration > 0);

  const DEG = Math.PI / 180;
  let samples = 0;
  let maxLatSpeed = 0;
  let prevX = a.x;
  let prevZ = a.z;

  for (let step = 0; step < 300 && a.changeDuration > 0; step++) {
    const dt = 1 / 30;
    sim.update(dt, player);
    const qLane = net.sample(a.lane, a.s, q);
    const laneTangentYaw = Math.atan2(qLane.tx, qLane.tz);
    const diff = Math.abs(wrapAngle(a.yaw - laneTangentYaw));
    const latMove = Math.abs((a.x - prevX) * (-qLane.tz) + (a.z - prevZ) * qLane.tx);
    const latSpeed = latMove / dt;
    maxLatSpeed = Math.max(maxLatSpeed, latSpeed);
    prevX = a.x;
    prevZ = a.z;

    if (a.changeDuration > 0) {
      assert.ok(diff >= 0.99 * DEG, `heading diff too small: ${(diff / DEG).toFixed(2)} deg`);
      assert.ok(diff <= 12.01 * DEG, `heading diff too large: ${(diff / DEG).toFixed(2)} deg`);
    } else {
      assert.ok(diff < 0.01 * DEG, `not straightened: ${(diff / DEG).toFixed(2)} deg`);
    }
    assert.ok(latSpeed <= 3.01, `lateral speed ${latSpeed.toFixed(2)} m/s > 3 m/s`);
    samples++;
  }
  assert.ok(samples > 10, `sampled ${samples} times`);
  assert.ok(maxLatSpeed > 0.5, `max lateral speed was only ${maxLatSpeed}`);
});

test('a civilian with a faster car 30 m behind and a free lane moves over within 3 s', () => {
  const sim = new TrafficSim(net, { seed: 42, target: 0, rivals: 0 });
  const lane0 = net.lane('c1-f', 1, 0);
  const lane1 = net.lane('c1-f', 1, 1);
  assert.ok(lane0 && lane1);
  const q = { x: 0, z: 0, tx: 0, tz: 1, y: 0 };
  net.sample(lane1, 2000, q);
  const player = { x: q.x + 100, z: q.z, speed: 0 };

  const civ = sim.spawn(player, 0, 1e9);
  assert.ok(civ);
  civ.lane = lane1;
  civ.s = 2000;
  civ.speed = 22;
  civ.nextChange = 0;

  const faster = sim.spawn(player, 0, 1e9);
  assert.ok(faster);
  faster.lane = lane1;
  faster.s = 1970;
  faster.speed = 36;

  let moved = false;
  for (let t = 0; t < 3.0; t += 1 / 30) {
    sim.update(1 / 30, player);
    if (civ.lane === lane0) {
      moved = true;
      break;
    }
  }
  assert.ok(moved, 'civilian did not move to the free left lane within 3 s');
});

test('fewer than one civilian lane change in ten is reversed within 6 s', () => {
  const sim = new TrafficSim(net, { seed: 21, target: 38, rivals: 5 });
  const startLane = net.lane('c1-f', 1, 1);
  const q = { x: 0, z: 0, tx: 0, tz: 1, y: 0 };
  net.sample(startLane, 0, q);
  const player = { x: q.x, z: q.z, speed: 30, yaw: Math.atan2(q.tx, q.tz) };
  sim.populate(player);

  const orig = TrafficSim.prototype.startLaneChange;
  /** Per agent: the lane before its last change, the lane it moved into, and when. */
  const hist = new Map();
  let changes = 0;
  let reversed = 0;
  TrafficSim.prototype.startLaneChange = function (a, target) {
    if (!this.isRival(a) && a.mode === 'drive') {
      changes++;
      const h = hist.get(a);
      if (h && h.from === target && this.time - h.at <= 6) reversed++;
      hist.set(a, { from: a.lane, to: target, at: this.time });
    }
    return orig.call(this, a, target);
  };

  const dt = 1 / 30;
  try {
    for (let step = 0; step < 180 * 30; step++) {
      net.sample(startLane, (step * dt * 30) % startLane.length, q);
      player.x = q.x;
      player.z = q.z;
      player.yaw = Math.atan2(q.tx, q.tz);
      sim.update(dt, player);
    }
  } finally {
    TrafficSim.prototype.startLaneChange = orig;
  }

  assert.ok(changes > 100, `only ${changes} civilian lane changes to judge`);
  const share = reversed / changes;
  assert.ok(share < 0.1, `${reversed} of ${changes} civilian lane changes reversed within 6 s (${(share * 100).toFixed(1)} %)`);
});

test('over 3 minutes headless with traffic, racers mean speed is above 190 km/h and top above 240', () => {
  const sim = new TrafficSim(net, { seed: 77, target: 38, rivals: 5 });
  const startLane = net.lane('c1-f', 1, 1);
  const q = { x: 0, z: 0, tx: 0, tz: 1, y: 0 };
  net.sample(startLane, 0, q);
  const player = { x: q.x, z: q.z, speed: 30, yaw: Math.atan2(q.tx, q.tz) };
  sim.populate(player);

  let speedSum = 0;
  let speedCount = 0;
  let topSpeed = 0;
  let aheadCount = 0;
  let behindCount = 0;
  const dt = 1 / 30;
  for (let step = 0; step < 180 * 30; step++) {
    const sPlayer = (step * 30 * dt) % startLane.length;
    net.sample(startLane, sPlayer, q);
    player.x = q.x;
    player.z = q.z;
    player.yaw = Math.atan2(q.tx, q.tz);
    sim.update(dt, player);
    for (const a of sim.agents) {
      if (sim.isRival(a) && a.mode === 'drive') {
        const kmh = a.speed * 3.6;
        speedSum += kmh;
        speedCount++;
        if (kmh > topSpeed) topSpeed = kmh;
        const dx = a.x - player.x;
        const dz = a.z - player.z;
        const dot = dx * Math.sin(player.yaw) + dz * Math.cos(player.yaw);
        if (dot >= 0) aheadCount++;
        else behindCount++;
      }
    }
  }
  const meanSpeed = speedSum / speedCount;
  assert.ok(speedCount > 1000, `sampled ${speedCount} times`);
  assert.ok(meanSpeed > 190, `mean speed ${meanSpeed.toFixed(1)} km/h <= 190 km/h`);
  assert.ok(topSpeed > 240, `top speed ${topSpeed.toFixed(1)} km/h <= 240 km/h`);
  assert.ok(aheadCount > 0 && behindCount > 0, `ahead ${aheadCount}, behind ${behindCount}`);
});


