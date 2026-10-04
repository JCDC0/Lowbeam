import { test } from 'node:test';
import assert from 'node:assert/strict';
import { routeTo, snapToLane, RouteTracker } from '../src/ui/route.js';
import { Ground } from '../src/world/ground.js';
import { TrafficNet } from '../src/traffic/net.js';
import { STATIONS, LOTS } from '../src/world/layout.js';

/**
 * Builds a small hand-built network for pure unit tests:
 * A loop of two lanes (A and B) with a one-way exit ramp C leaving lane A at s=50,
 * and a T-junction where lane D meets lane E.
 */
function createMockNet() {
  // Loop: lane A from (0,0) to (100,0), lane B from (100,0) to (0,0)
  const laneA = {
    id: 'loopA',
    length: 100,
    closed: false,
    index: 0,
    points: [[0, 0], [100, 0]],
    ends: [],
    mids: [],
  };
  const laneB = {
    id: 'loopB',
    length: 100,
    closed: false,
    index: 0,
    points: [[100, 0], [0, 0]],
    ends: [],
    mids: [],
  };
  // Ramp C: one-way exit from A at s=50 to (50, 80)
  const rampC = {
    id: 'rampC',
    length: 80,
    closed: false,
    index: 0,
    points: [[50, 0], [50, 80]],
    ends: [],
    mids: [],
  };

  laneA.ends.push({ lane: laneB, at: 100, toS: 0, kind: 'end', weight: 1 });
  laneB.ends.push({ lane: laneA, at: 100, toS: 0, kind: 'end', weight: 1 });
  laneA.mids.push({ lane: rampC, at: 50, toS: 0, kind: 'exit', weight: 1 });

  // T-junction: stem lane D meets through lane E
  const laneD = {
    id: 'stemD',
    length: 60,
    closed: false,
    index: 0,
    points: [[200, 60], [200, 0]],
    ends: [],
    mids: [],
  };
  const laneE = {
    id: 'crossE',
    length: 100,
    closed: false,
    index: 0,
    points: [[150, 0], [250, 0]],
    ends: [],
    mids: [],
  };
  laneD.ends.push({ lane: laneE, at: 60, toS: 50, kind: 'turn', weight: 1 });

  return {
    lanes: [laneA, laneB, rampC, laneD, laneE],
  };
}

test('the route obeys one-way lanes and directed links', () => {
  const net = createMockNet();

  // Route from start of lane A to ramp C destination (50, 70)
  const toRamp = routeTo(net, { x: 10, z: 0 }, { x: 50, z: 70 });
  assert.ok(toRamp, 'route to ramp exists');
  assert.ok(toRamp.lanes.map((l) => l.id).includes('rampC'));

  // From ramp C back to lane A cannot go backwards along the one-way ramp
  const fromRamp = routeTo(net, { x: 50, z: 40 }, { x: 20, z: 0 });
  assert.equal(fromRamp, null, 'cannot drive backwards down a one-way ramp');

  // Route on loop must follow directed lanes: from s=80 on A to s=20 on A must go through B
  const loopRoute = routeTo(net, { x: 80, z: 0, yaw: Math.PI / 2 }, { x: 20, z: 0 });
  assert.ok(loopRoute, 'loop route exists');
  assert.ok(loopRoute.lanes.map((l) => l.id).includes('loopB'), 'must take loopB to return');
});

test('the route follows T junctions and turns', () => {
  const net = createMockNet();
  const route = routeTo(net, { x: 200, z: 50 }, { x: 240, z: 0 });
  assert.ok(route, 'T-junction turn route exists');
  const ids = route.lanes.map((l) => l.id);
  assert.deepEqual(ids, ['stemD', 'crossE']);
});

test('it re-plans after a wrong turn (more than 40 m off for 2 s)', () => {
  const net = createMockNet();
  const dest = { x: 50, z: 80 };
  const tracker = new RouteTracker(net, dest, { x: 10, z: 0 });
  assert.ok(tracker.route, 'initial route planned');
  const initialLen = tracker.distance;

  // Car drives along the route at (30, 0)
  const d1 = tracker.update({ x: 30, z: 0 }, 0.5);
  assert.ok(d1 < initialLen, 'distance decreases as car advances');
  assert.equal(tracker.offTimer, 0);

  // Car takes wrong turn: moves 50 m off course to (30, -50)
  tracker.update({ x: 30, z: -50 }, 1.0);
  assert.ok(tracker.offTimer >= 1.0, 'off timer accumulates');

  // Still off course after another 1.2 s (total 2.2 s > 2.0 s): triggers re-plan
  const prevRoute = tracker.route;
  tracker.update({ x: 30, z: -50 }, 1.2);
  assert.equal(tracker.offTimer, 0, 'off timer resets after re-plan');
  assert.notEqual(tracker.route, prevRoute, 're-planned a new route');
});

test('it reports arrival and clears within 25 m of destination', () => {
  const net = createMockNet();
  const dest = { x: 50, z: 80 };
  const tracker = new RouteTracker(net, dest, { x: 10, z: 0 });
  assert.equal(tracker.arrived, false);

  // Still 40 m away
  tracker.update({ x: 50, z: 40 });
  assert.equal(tracker.arrived, false);
  assert.ok(tracker.route !== null);

  // Moves to within 20 m of destination (50, 80) -> (50, 65)
  const dist = tracker.update({ x: 50, z: 65 });
  assert.equal(dist, 0);
  assert.equal(tracker.arrived, true);
  assert.equal(tracker.route, null);
  assert.equal(tracker.distance, 0);
});

test('on the real network a route from G1 to the police HQ exists and is under 1.6 times the straight-line distance', () => {
  const ground = new Ground();
  const net = new TrafficNet(ground.roads);

  const g1 = STATIONS[0];
  const hq = LOTS.find((l) => l.id === 'police');
  assert.ok(g1, 'G1 exists');
  assert.ok(hq, 'Police HQ exists');

  const from = { x: g1.near[0], z: g1.near[1] };
  const to = { x: hq.near[0], z: hq.near[1] };
  const straight = Math.hypot(to.x - from.x, to.z - from.z);

  const route = routeTo(net, from, to);
  assert.ok(route, 'route from G1 to Police HQ exists');
  assert.ok(route.points.length > 50, 'polyline has points');
  assert.ok(route.length > 0, 'route has positive length');

  const ratio = route.length / straight;
  assert.ok(ratio < 1.6, `route length ratio ${ratio.toFixed(3)} is under 1.6`);
});

test('cross-island route plans in under 30 ms in Node', () => {
  const ground = new Ground();
  const net = new TrafficNet(ground.roads);

  const g1 = STATIONS[0];
  const hq = LOTS.find((l) => l.id === 'police');
  const from = { x: g1.near[0], z: g1.near[1] };
  const to = { x: hq.near[0], z: hq.near[1] };

  // Warm-up JIT
  routeTo(net, from, to);

  const t0 = performance.now();
  const route = routeTo(net, from, to);
  const elapsed = performance.now() - t0;

  assert.ok(route !== null);
  assert.ok(elapsed < 30, `planning took ${elapsed.toFixed(2)} ms, must be under 30 ms`);
});
