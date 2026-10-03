import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RoadNetwork } from '../src/world/roads.js';
import { Colliders } from '../src/world/collision.js';
import { carById } from '../src/vehicles/specs.js';
import { createVehicleState, placeVehicle, stepVehicle, DT } from '../src/vehicles/physics.js';

/** A highway running east to west and an arterial that crosses over it at the origin. */
const net = new RoadNetwork([
  { id: 'main', name: 'MAIN', surface: 'asphalt', hw: 5.6, priority: 3, smooth: 40, lines: 'center', points: [[-400, 0], [0, 0], [400, 0]] },
  {
    id: 'over', name: 'OVER', surface: 'asphalt', hw: 4, priority: 2.5, smooth: 40, lines: 'center', maxGrade: 0.09,
    lifts: [{ at: [0, 0], height: 7.5, half: 150, flat: 50 }],
    points: [[0, -500], [0, -250], [0, 0], [0, 250], [0, 500]],
  },
]);
const main = /** @type {import('../src/world/roads.js').Road} */ (net.byId.get('main'));
const over = /** @type {import('../src/world/roads.js').Road} */ (net.byId.get('over'));

/** The same lookup the game's ground gives the physics: height from the road asked about. */
const ground = (x, z, y = -Infinity) => {
  const hit = { road: null, s: 0, d: 0, h: 0, edge: 0 };
  if (net.query(x, z, hit, 0, -Infinity, y)) return { h: hit.h, surface: 'asphalt' };
  return { h: main.heightAt(0) - 0.5, surface: 'grass' };
};

test('an overpass rises by its lift, holds, and comes back down within the grade cap', () => {
  const mid = over.path.nearest(0, 0).s;
  assert.ok(Math.abs(over.liftAt(mid) - 7.5) < 0.05, `lift ${over.liftAt(mid)}`);
  assert.equal(over.liftAt(mid - 160), 0);
  assert.equal(over.liftAt(mid + 160), 0);
  let steepest = 0;
  for (let s = mid - 150; s < mid + 150; s += 2) steepest = Math.max(steepest, Math.abs(over.grade(s, s + 6)));
  assert.ok(steepest < 0.12, `steepest ${steepest}`);
  assert.ok(Math.abs(over.heightAt(mid) - main.heightAt(main.path.nearest(0, 0).s) - 7.5) < 0.2, 'the deck is 7.5 m over the highway');
});

test('what you find at the crossing depends on how high you are', () => {
  const hit = { road: null, s: 0, d: 0, h: 0, edge: 0 };
  assert.ok(net.query(0, 0, hit));
  assert.equal(hit.road.id, 'main', 'no height given: the ground');
  assert.ok(net.query(0, 0, hit, 0, -Infinity, 0.4));
  assert.equal(hit.road.id, 'main', 'at ground level: the highway');
  const low = hit.h;
  assert.ok(net.query(0, 0, hit, 0, -Infinity, low + 7.5));
  assert.equal(hit.road.id, 'over', 'on the deck: the deck');
  assert.ok(Math.abs(hit.h - low - 7.5) < 0.3, `deck ${hit.h - low} m up`);
  assert.ok(net.query(0, 0, hit, 0, -Infinity, low + 5));
  assert.equal(hit.road.id, 'main', 'still too low to be on the deck');
});

test('terrain is shaped to the road below, not to the deck above', () => {
  const hit = { road: null, s: 0, d: 0, h: 0, edge: 0 };
  assert.ok(net.influence(0, 0, 8, hit));
  assert.equal(hit.road.id, 'main');
  assert.ok(net.influence(0, 120, 6, hit), 'the approach is still on the ground');
  assert.equal(hit.road.id, 'over');
});

test('a car drives under the overpass on the ground and over it on the deck', () => {
  const spec = carById('hayate');
  const lowSpeed = 22;

  const under = createVehicleState(spec);
  placeVehicle(under, spec, -300, 0, Math.PI / 2, ground);
  under.vx = lowSpeed;
  under.gear = 3;
  let worst = 0;
  for (let t = 0; t < 30 && under.x < 250; t += DT) {
    stepVehicle(under, spec, { throttle: 0.4, brake: 0, steer: 0, handbrake: 0 }, ground, DT);
    const road = main.heightAt(main.path.nearest(under.x, 0).s);
    worst = Math.max(worst, Math.abs(under.y - road));
  }
  assert.ok(under.x > 100, `only got to x ${under.x}`);
  assert.ok(worst < 0.5, `left the highway surface by ${worst} m going under`);
  const base = main.heightAt(main.path.nearest(0, 0).s);

  const over1 = createVehicleState(spec);
  placeVehicle(over1, spec, 0, -420, 0, ground);
  over1.vz = lowSpeed;
  over1.gear = 3;
  let peak = -Infinity;
  let air = 0;
  for (let t = 0; t < 40 && over1.z < 380; t += DT) {
    stepVehicle(over1, spec, { throttle: 0.4, brake: 0, steer: 0, handbrake: 0 }, ground, DT);
    peak = Math.max(peak, over1.y);
    if (over1.air) air += DT;
  }
  assert.ok(over1.z > 250, `only got to z ${over1.z}`);
  assert.ok(peak > base + 6.5, `peak ${peak - base} m over the highway`);
  assert.ok(air < 0.6, `fell off the deck for ${air} s`);
  assert.ok(Math.abs(over1.y - over.heightAt(over.path.nearest(over1.x, over1.z).s)) < 0.6, 'did not come back down onto the road on the far side');
});

test('a wall on the deck does not stop a car underneath, and a pier does not stop one on top', () => {
  const spec = carById('hayate');
  const wall = { x: 0, z: 0, hx: 0.3, hz: 3, yaw: 0, y0: 7, y1: 8.2 };
  const pier = { x: 20, z: 0, r: 0.9, y1: 6.5 };
  const colliders = new Colliders([pier], [wall]);
  const car = (x, y) => {
    const s = createVehicleState(spec);
    s.x = x;
    s.z = 0;
    s.y = y;
    s.vx = 0;
    s.vz = 10;
    return s;
  };
  const pushed = (x, y) => {
    const c = car(x, y);
    colliders.resolve(c, spec);
    return Math.abs(c.x - x);
  };
  assert.ok(pushed(0, 0) < 1e-9, 'a wall 7 m overhead stopped a car on the ground');
  assert.ok(pushed(0, 7.4) > 0.2, 'the wall on the deck did not stop a car on it');
  assert.ok(pushed(21.2, 0) > 0.2, 'a pier did not stop a car beside it');
  assert.ok(pushed(21.2, 7.4) < 1e-9, 'a pier stopped a car on the deck above it');
});
