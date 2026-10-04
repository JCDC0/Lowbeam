import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Ground } from '../src/world/ground.js';
import { TrafficNet } from '../src/traffic/net.js';
import { TrafficSim } from '../src/traffic/sim.js';
import { KINDS, RIVALS } from '../src/traffic/kinds.js';

const ground = new Ground();
const net = new TrafficNet(ground.roads);

/**
 * Builds a car directly on a lane. Going through `spawn` picks its own lane and end link,
 * which fights the placement these tests need.
 */
function placeOn(sim, lane, s, speed, kind, extra = {}) {
  const q = { x: 0, z: 0, tx: 0, tz: 1, y: 0 };
  net.sample(lane, s, q);
  const a = {
    id: sim.nextId++,
    kind,
    paint: 0,
    lane,
    s,
    speed,
    factor: 1,
    x: q.x,
    y: q.y,
    z: q.z,
    yaw: Math.atan2(q.tx, q.tz),
    vx: 0,
    vz: 0,
    yawRate: 0,
    ex: 0,
    ez: 0,
    cap: Infinity,
    capUntil: 0,
    plan: null,
    end: null,
    changeDuration: 0,
    changeTimer: 0,
    changeStartX: 0,
    changeStartZ: 0,
    changePrevEx: 0,
    changePrevEz: 0,
    mode: 'drive',
    age: 0,
    wreckAge: 0,
    laneHold: 0,
    duel: false,
    signal: 0,
    signalTimer: 0,
    signalTarget: null,
    nextChange: 0,
    inertia: 1500,
    brake: 0,
    fade: 1,
    ...extra,
  };
  sim.agents.push(a);
  return a;
}

/** A sim with one slow car in lane 0 that the agent behind it wants to pass. */
function overtakeSetup(kind = KINDS[0]) {
  const sim = new TrafficSim(net, { seed: 2, target: 0, rivals: 0 });
  const lane0 = net.lane('c1-f', 1, 0);
  const q = { x: 0, z: 0, tx: 0, tz: 1, y: 0 };
  net.sample(lane0, 1500, q);
  const player = { x: q.x, z: q.z, speed: 0 };
  const a = placeOn(sim, lane0, 1500, 25, kind);
  // Something slow about 40 m up the same lane, so the agent wants to pass it.
  placeOn(sim, lane0, 1542, 12, KINDS[0]);
  return { sim, a, player, lane0 };
}

/** Steps the sim and records the signal and lane of `a` each frame. */
function watch(sim, a, player, seconds, dt = 1 / 30) {
  const log = [];
  for (let t = 0; t < seconds; t += dt) {
    sim.update(dt, player);
    // changeDuration going above 0 is the move starting, which is what the signal
    // announces; the lane itself changes over the following seconds.
    log.push({ t, signal: a.signal, lane: a.lane.id, moving: a.changeDuration > 0 });
  }
  return log;
}

test('a fresh agent has no signal', () => {
  const { a } = overtakeSetup();
  assert.equal(a.signal, 0);
  assert.equal(a.signalTimer, 0);
});

test('a lane change is signalled on the correct side for at least 1.2 s before it starts', () => {
  const { sim, a, player } = overtakeSetup();
  const log = watch(sim, a, player, 14);
  const firstSignal = log.find((r) => r.signal !== 0);
  assert.ok(firstSignal, 'the agent never signalled');
  const move = log.find((r) => r.moving);
  assert.ok(move, 'the agent never started moving over');
  // Lane index 0 is the leftmost, so moving up is to the right: signal +1.
  assert.equal(firstSignal.signal, 1, `signalled ${firstSignal.signal}`);
  assert.ok(move.t - firstSignal.t >= 1.2, `signalled ${(move.t - firstSignal.t).toFixed(2)} s before moving, need 1.2`);
  assert.equal(move.signal, 1, 'the signal is still on as the move starts');
});

test('the signal runs 1.2 to 2.5 s before the move starts', () => {
  let checked = 0;
  for (const seed of [2, 5, 9, 13, 21]) {
    const sim = new TrafficSim(net, { seed, target: 0, rivals: 0 });
    const lane0 = net.lane('c1-f', 1, 0);
    const q = { x: 0, z: 0, tx: 0, tz: 1, y: 0 };
    net.sample(lane0, 1500, q);
    const player = { x: q.x, z: q.z, speed: 0 };
    const a = placeOn(sim, lane0, 1500, 25, KINDS[0]);
    placeOn(sim, lane0, 1542, 12, KINDS[0]);
    const log = watch(sim, a, player, 14);
    const first = log.find((r) => r.signal !== 0);
    const move = log.find((r) => r.moving);
    if (!first || !move) continue;
    checked++;
    const held = move.t - first.t;
    assert.ok(held >= 1.2 && held <= 2.6, `seed ${seed}: signalled ${held.toFixed(2)} s before moving`);
  }
  assert.ok(checked >= 3, `only ${checked} seeds produced a signalled move`);
});

test('a change dropped because the gap closed turns the signal off again', () => {
  const sim = new TrafficSim(net, { seed: 3, target: 0, rivals: 0 });
  const lane0 = net.lane('c1-f', 1, 0);
  const lane1 = net.lane('c1-f', 1, 1);
  const q = { x: 0, z: 0, tx: 0, tz: 1, y: 0 };
  net.sample(lane0, 1500, q);
  const player = { x: q.x, z: q.z, speed: 0 };
  const a = placeOn(sim, lane0, 1500, 25, KINDS[0]);
  placeOn(sim, lane0, 1542, 12, KINDS[0]);
  const dt = 1 / 30;
  let blocker = null;
  for (let t = 0; t < 8; t += dt) {
    sim.update(dt, player);
    if (a.signal !== 0 && !blocker) {
      // Sit in the target lane right beside the agent, and stay there: a blocker that
      // drifts lets the change through after all, which is not what this is testing.
      blocker = placeOn(sim, lane1, a.s + 1, 2, KINDS[0]);
      blocker.nextChange = 1e9;
      blocker.plan = null;
      blocker.factor = 0;
    }
    if (blocker) {
      blocker.lane = lane1;
      blocker.s = a.s + 1;
      blocker.speed = 2;
      blocker.plan = null;
      blocker.fade = 1;
    }
  }
  assert.ok(blocker, 'the agent never signalled, so the test proved nothing');
  assert.equal(a.signal, 0, `the signal should be off again, it is ${a.signal}`);
  assert.equal(a.lane, lane0, 'the agent should still be in its original lane');
});

test('street racers never signal', () => {
  const kind = RIVALS.find((k) => k.id === 'rv-hyper');
  assert.ok(kind, 'no hypercar kind');
  const sim = new TrafficSim(net, { seed: 4, target: 0, rivals: 0 });
  const lane0 = net.lane('c1-f', 1, 1);
  const q = { x: 0, z: 0, tx: 0, tz: 1, y: 0 };
  net.sample(lane0, 1500, q);
  const player = { x: q.x, z: q.z, speed: 0 };
  const a = placeOn(sim, lane0, 1500, 30, kind);
  placeOn(sim, lane0, 1542, 10, KINDS[0]);
  const log = watch(sim, a, player, 8);
  assert.ok(!log.some((r) => r.signal !== 0), 'a racer signalled');
});

test('a wreck runs its hazards until it fades', () => {
  const sim = new TrafficSim(net, { seed: 6, target: 0, rivals: 0 });
  const lane0 = net.lane('c1-f', 1, 1);
  const q = { x: 0, z: 0, tx: 0, tz: 1, y: 0 };
  net.sample(lane0, 1500, q);
  const player = { x: q.x, z: q.z, speed: 0 };
  const a = placeOn(sim, lane0, 1500, 0, KINDS[0], { mode: 'wreck' });
  sim.update(1 / 30, player);
  assert.equal(a.signal, 2, 'a wreck should run both hazards');
  sim.update(1 / 30, player);
  assert.equal(a.signal, 2, 'hazards stay on while the wreck is there');
});

test('a civilian leaving for a planned exit signals toward it', () => {
  const sim = new TrafficSim(net, { seed: 8, target: 0, rivals: 0 });
  // Exits leave from the outer lane, so find the lane that actually has one.
  let lane = null;
  let mid = null;
  for (const [, lanes] of net.byRoad) {
    for (const l of lanes) {
      const m = l.mids.find((x) => x.kind === 'exit' && x.at > 400);
      if (m) {
        lane = l;
        mid = m;
      }
    }
    if (mid) break;
  }
  assert.ok(lane && mid, 'no exit ramp on the network');
  const q = { x: 0, z: 0, tx: 0, tz: 1, y: 0 };
  net.sample(lane, mid.at - 150, q);
  const player = { x: q.x, z: q.z, speed: 0 };
  const a = placeOn(sim, lane, mid.at - 150, 26, KINDS[0], { plan: mid });
  const dt = 1 / 30;
  let signalled = 0;
  let firstAt = -1;
  // The car takes the exit onto the ramp partway through, where s is on a different road,
  // so the loop stops as soon as the plan is used rather than waiting for s to pass mid.at.
  for (let t = 0; t < 15; t += dt) {
    sim.update(dt, player);
    if (a.signal !== 0 && !signalled) {
      signalled = a.signal;
      firstAt = a.s;
    }
    if (!a.plan) break;
  }
  assert.notEqual(signalled, 0, 'the car signalled nothing on its way to the exit');
  assert.equal(signalled, 1, 'an exit leaves to the right');
  assert.ok(mid.at - firstAt <= 60, `the signal started ${(mid.at - firstAt).toFixed(0)} m out, want about 60`);
  assert.ok(mid.at - firstAt >= 30, `the signal started only ${(mid.at - firstAt).toFixed(0)} m out`);
});