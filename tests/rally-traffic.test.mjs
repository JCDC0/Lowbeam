import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Ground } from '../src/world/ground.js';
import { TrafficNet } from '../src/traffic/net.js';
import { TrafficSim } from '../src/traffic/sim.js';
import { KINDS } from '../src/traffic/kinds.js';

const ground = new Ground();
const net = new TrafficNet(ground.roads);

/** The side road and its yield stop at a real T junction on the network. */
function tJunction() {
  for (const [, lanes] of net.byRoad) {
    for (const side of lanes) {
      const stop = side.stops.find((st) => st.yield);
      if (stop) return { side, stop };
    }
  }
  return null;
}

/**
 * Builds a car directly on a lane. Going through `spawn` picks its own lane and end link,
 * which fights the placement this test needs.
 */
function placeOn(sim, player, lane, s, speed) {
  const q = { x: 0, z: 0, tx: 0, tz: 1, y: 0 };
  net.sample(lane, s, q);
  const a = {
    id: sim.nextId++,
    kind: KINDS[0],
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
    nextChange: 1e9,
    inertia: 1500,
    brake: 0,
    fade: 1,
  };
  sim.agents.push(a);
  // The player reference is parked on the car, or the sim treats it as left far behind
  // and despawns it on the first step.
  player.x = q.x;
  player.z = q.z;
  return a;
}

test('the network has T junctions with a yield stop on the side road', () => {
  const t = tJunction();
  assert.ok(t, 'no T junction yield stop found on the network');
  assert.ok(t.stop.yield.lanes.length > 0, 'the yield stop names the through lanes');
  assert.equal(typeof t.stop.yield.at, 'number');
  for (const l of t.stop.yield.lanes) assert.notEqual(l, t.side, 'the through lanes are not the side road');
});

test('an agent stops at a yield stop while traffic is approaching the junction', () => {
  const t = tJunction();
  assert.ok(t, 'no T junction');
  const sim = new TrafficSim(net, { seed: 3, target: 0, rivals: 0 });
  const q = { x: 0, z: 0, tx: 0, tz: 1, y: 0 };
  net.sample(t.side, t.stop.s - 60, q);
  const player = { x: q.x, z: q.z, speed: 0 };
  const a = placeOn(sim, player, t.side, t.stop.s - 60, 16);
  // A car on a through lane, approaching the junction, keeps the side road held.
  placeOn(sim, player, t.stop.yield.lanes[0], t.stop.yield.at - 25, 16);
  // Both cars have to stay in the sim's keeping distance, so anchor the player between them.
  player.x = (a.x + t.stop.yield.at) / 2;
  player.z = a.z;

  let nearest = Infinity;
  for (let i = 0; i < 30 * 4; i++) {
    sim.update(1 / 30, player);
    nearest = Math.min(nearest, t.stop.s - a.s);
  }
  assert.ok(nearest > 1, `the agent drove through the stop (closest ${nearest.toFixed(1)} m short)`);
  assert.ok(a.speed < 8, `the agent should be slow at the stop, was ${a.speed.toFixed(1)}`);
});

test('the same agent goes once the through road is clear', () => {
  const t = tJunction();
  assert.ok(t, 'no T junction');
  const sim = new TrafficSim(net, { seed: 4, target: 0, rivals: 0 });
  const q = { x: 0, z: 0, tx: 0, tz: 1, y: 0 };
  net.sample(t.side, t.stop.s - 60, q);
  const player = { x: q.x + 300, z: q.z, speed: 0 };
  // Nothing on the through road at all, so the agent should not be held up.
  const a = placeOn(sim, player, t.side, t.stop.s - 60, 16);

  let released = false;
  // Every yield line sits about 11 m short of the lane end, so the side car reaches the
  // junction and turns onto the through road; what matters is that it is held while the
  // through road is busy and gets moving again once it is clear, rather than sitting at a
  // standstill forever.
  let moved = false;
  let wasLane = a.lane;
  for (let i = 0; i < 30 * 12; i++) {
    sim.update(1 / 30, player);
    if (a.s > t.stop.s - 3) moved = true;
    if (a.lane !== wasLane || a.speed > 6) {
      released = true;
      break;
    }
  }
  assert.ok(released, `the agent never got going again (lane ${a.lane.id}, s=${a.s.toFixed(1)}, stop ${t.stop.s.toFixed(1)}, v=${a.speed.toFixed(1)}, reached line ${moved})`);
});

test('a rally road clears traffic and keeps it from spawning', () => {
  const sim = new TrafficSim(net, { seed: 5, target: 20, rivals: 0 });
  const kuro = net.lanes.filter((l) => l.road.id === 'kuro');
  assert.ok(kuro.length > 0, 'no lanes on the pass');
  sim.rallyRoad = 'kuro';
  const q = { x: 0, z: 0, tx: 0, tz: 1, y: 0 };
  net.sample(kuro[0], 500, q);
  const player = { x: q.x, z: q.z, speed: 40 };

  const onRoad = () => sim.agents.filter((a) => a.mode === 'drive' && a.lane.road.id === 'kuro').length;
  for (let i = 0; i < 30 * 10; i++) sim.update(1 / 30, player);
  assert.equal(onRoad(), 0, 'no traffic should be left on the stage road');

  const before = sim.agents.length;
  for (let i = 0; i < 30 * 10; i++) sim.update(1 / 30, player);
  assert.equal(onRoad(), 0, 'nothing should spawn on the stage road while the rally runs');

  sim.rallyRoad = null;
  let spawned = false;
  for (let i = 0; i < 30 * 20; i++) {
    sim.update(1 / 30, player);
    if (onRoad() > 0) {
      spawned = true;
      break;
    }
  }
  assert.ok(spawned, 'traffic should come back when the rally ends');
  assert.ok(sim.agents.length >= before, 'the agent count should not have collapsed');
});

test('the rally road field does not affect other roads', () => {
  const sim = new TrafficSim(net, { seed: 6, target: 24, rivals: 0 });
  sim.rallyRoad = 'kuro';
  const q = { x: 0, z: 0, tx: 0, tz: 1, y: 0 };
  const other = net.lane('c1-f', 1, 1);
  assert.ok(other, 'no Route 1 lane');
  net.sample(other, 1500, q);
  const player = { x: q.x, z: q.z, speed: 40 };
  let onRoute = 0;
  for (let i = 0; i < 30 * 12; i++) {
    sim.update(1 / 30, player);
    onRoute = Math.max(onRoute, sim.agents.filter((a) => a.mode === 'drive' && a.lane.road.id === 'c1-f').length);
  }
  assert.ok(onRoute > 0, 'Route 1 should still have traffic during a rally');
});