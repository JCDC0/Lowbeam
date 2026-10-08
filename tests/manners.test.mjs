import test from 'node:test';
import assert from 'node:assert/strict';
import { Manners, PANIC, HORN_GAP } from '../src/traffic/manners.js';
import { hornOf, panOf } from '../src/audio/traffic-voices.js';

// A civilian at the origin heading +z (its left is +x), and a player moving past it.
const civ = (extra = {}) => ({ id: 1, kind: { id: 'sedan' }, x: 0, z: 0, yaw: 0, speed: 15, mode: 'drive', cap: Infinity, capUntil: 0, ...extra });
const me = (x, z, yaw = 0, speed = 25) => ({ x, z, yaw, vx: Math.sin(yaw) * speed, vz: Math.cos(yaw) * speed, speed });

/** Steps the player through the given points, one step apart, and returns the horns. */
function run(m, agent, points, heat = 0) {
  points.forEach((p, i) => m.update(i * 0.1, [agent], p, heat));
  return m.take();
}

test('passing a car on its left (the wrong side, traffic keeps left) gets a long horn; on its right it does not', () => {
  const wrong = run(new Manners(), civ(), [me(3, -6), me(3, -2), me(3, 1)]);
  assert.equal(wrong.horns.length, 1);
  assert.equal(wrong.horns[0].reason, 'undertake');
  assert.equal(wrong.horns[0].blast, 'long');
  const right = run(new Manners(), civ(), [me(-3, -6), me(-3, -2), me(-3, 1)]);
  assert.equal(right.horns.length, 0);
});

test('cutting in close ahead makes the car honk and brake', () => {
  const a = civ();
  const out = run(new Manners(), a, [me(-3.5, 8), me(-2.5, 9), me(-0.5, 10)]);
  assert.equal(out.horns[0]?.reason, 'cut');
  assert.ok(a.cap < 15 && a.capUntil > 0, 'it brakes');
});

test('crossing fast in front of a car waiting at rest is running its red', () => {
  const out = run(new Manners(), civ({ speed: 0 }), [me(-6, 10, Math.PI / 2, 15), me(-2, 10, Math.PI / 2, 15), me(2, 10, Math.PI / 2, 15)]);
  assert.equal(out.horns[0]?.reason, 'red');
  const slow = run(new Manners(), civ({ speed: 0 }), [me(-6, 10, Math.PI / 2, 4), me(-2, 10, Math.PI / 2, 4), me(2, 10, Math.PI / 2, 4)]);
  assert.equal(slow.horns.length, 0, 'creeping across is not');
});

test('a car the player knocks aside honks twice; a police unit never honks', () => {
  const m = new Manners();
  const a = civ();
  m.update(0, [a], me(0, -20), 0);
  a.mode = 'knocked';
  m.update(0.1, [a], me(0, -20), 0);
  const out = m.take();
  assert.equal(out.horns[0]?.reason, 'scrape');
  assert.equal(out.horns[0]?.blast, 'double');
  const unit = civ({ kind: { id: 'police', lightBar: true } });
  assert.equal(run(new Manners(), unit, [me(3, -6), me(3, -2), me(3, 1)]).horns.length, 0);
});

test('one car honks at most once per HORN_GAP', () => {
  const m = new Manners();
  const a = civ();
  const pts = [me(3, -6), me(3, -2), me(3, 1), me(3, -3), me(3, 1)];
  pts.forEach((p, i) => m.update(i * 0.1, [a], p, 0));
  assert.equal(m.take().horns.length, 1);
  assert.ok(HORN_GAP >= 2);
});

test('in a pursuit nearby civilians panic: they crawl, edge to the curb and screech; with no pursuit they do not', () => {
  const calm = civ();
  run(new Manners(), calm, [me(-3, -20), me(-3, -19)], 0);
  assert.equal(calm.cap, Infinity);
  const a = civ();
  const out = run(new Manners(), a, [me(-3, -20), me(-3, -19)], 2);
  assert.equal(a.cap, PANIC.crawl);
  assert.equal(a.shy, PANIC.shy);
  assert.equal(out.screeches.length, 1, 'it was moving fast');
  const far = civ({ x: 0, z: 200 });
  run(new Manners(), far, [me(-3, -20), me(-3, -19)], 2);
  assert.equal(far.cap, Infinity, 'far from the chase it drives on');
});

test('a car near a chasing unit panics even with the player far away', () => {
  const a = civ();
  const unit = { id: 2, kind: { id: 'police', lightBar: true }, x: 0, z: 20, yaw: 0, speed: 40, mode: 'drive', pursuit: 'chase', cap: Infinity, capUntil: 0 };
  const m = new Manners();
  m.update(0, [a, unit], me(0, -150), 3);
  m.update(0.1, [a, unit], me(0, -150), 3);
  assert.equal(a.cap, PANIC.crawl);
});

test('horns: trucks and buses blow an air horn lower than a kei car, heard by distance and side', () => {
  const kei = hornOf('kei', 5);
  const truck = hornOf('semi', 5);
  assert.ok(truck.notes[0] < kei.notes[0] / 2);
  assert.equal(truck.wave, 'sawtooth');
  assert.ok(hornOf('sedan', 5).gain > hornOf('sedan', 60).gain && hornOf('sedan', 200).gain === 0);
  assert.ok(panOf({ x: 0, z: 0, yaw: 0 }, 10, 0) < 0, 'a car at +x is on the left');
});
