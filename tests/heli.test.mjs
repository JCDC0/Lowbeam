import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Heli, HELI, Skyline } from '../src/police/heli.js';

const PAD = { x: 0, y: 13, z: 0, yaw: 0 };
const DT = 1 / 30;

/** A flat island at height 0 with one 130 m tower at (400, 0), and an optional deck over x > 900. */
function world(target, deckFrom = Infinity) {
  const skyline = new Skyline(() => 0, [{ x: 400, z: 0, y: 0, w: 30, d: 30, h: 130 }], 3000);
  return {
    target,
    skyline,
    groundAt: () => 0,
    covered: (x) => x > deckFrom,
  };
}

/** A car driving along +x at `speed`, starting at x0. */
function car(speed, x0 = 100) {
  return { x: x0, y: 0, z: 20, vx: speed, vz: 0, move(dt) { this.x += this.vx * dt; } };
}

function run(h, w, seconds, each = () => {}) {
  for (let t = 0; t < seconds; t += DT) {
    w.target?.move?.(DT);
    h.update(DT, w);
    each(h);
  }
}

test('it spins up on the pad, lifts off and only then flies', () => {
  const h = new Heli(PAD);
  const w = world(car(0));
  h.launch();
  run(h, w, HELI.spinUp * 0.9);
  assert.equal(h.state, 'spinup');
  assert.equal(h.y, PAD.y, 'still on the pad while the rotor spins up');
  run(h, w, 12);
  assert.equal(h.state, 'chase');
  assert.ok(h.y > PAD.y + HELI.hover - 1, `climbed to ${h.y.toFixed(1)}`);
});

test('it follows a car at 100 km/h and keeps the light on it', () => {
  const h = new Heli(PAD);
  const target = car(28);
  const w = world(target);
  h.launch();
  run(h, w, 40);
  let seen = 0;
  let n = 0;
  let far = 0;
  run(h, w, 60, (hh) => {
    n++;
    if (hh.spot.sees) seen++;
    far = Math.max(far, Math.hypot(hh.x - target.x, hh.z - target.z));
  });
  assert.ok(seen / n > 0.85, `light on the car ${((seen / n) * 100).toFixed(0)} % of the time`);
  assert.ok(far < 140, `stayed within ${far.toFixed(0)} m`);
});

test('it never drops through a roof or the ground, tower or not', () => {
  const h = new Heli(PAD);
  const target = car(30, 0);
  const w = world(target);
  h.launch();
  let low = Infinity;
  run(h, w, 50, (hh) => {
    if (hh.airborne && hh.state !== 'takeoff') low = Math.min(low, hh.y - w.skyline.at(hh.x, hh.z));
  });
  assert.ok(target.x > 400, 'the car drove past the tower');
  assert.ok(low >= HELI.clear * 0.5 - 0.01, `came within ${low.toFixed(1)} m of what is below`);
});

test('a fast car outruns it on a straight', () => {
  const h = new Heli(PAD);
  const target = car(90);
  const w = world(target);
  h.launch();
  run(h, w, 15);
  const before = Math.hypot(h.x - target.x, h.z - target.z);
  run(h, w, 30);
  const after = Math.hypot(h.x - target.x, h.z - target.z);
  assert.ok(after > before + 300, `gap ${before.toFixed(0)} m to ${after.toFixed(0)} m`);
  assert.ok(Math.hypot(h.vx, h.vz) <= HELI.maxSpeed + 0.01);
});

test('a car under a deck is out of the light, and the lost time grows', () => {
  const h = new Heli(PAD);
  const target = car(25);
  const w = world(target, 900);
  h.launch();
  run(h, w, 30);
  assert.ok(target.x < 900 && h.spot.sees, 'sees it in the open');
  run(h, w, 40);
  assert.ok(target.x > 900);
  assert.equal(h.spot.sees, false);
  assert.ok(h.lost > 5, `lost for ${h.lost.toFixed(1)} s`);
});

test('recalled, it flies home, lands on the pad and spins down', () => {
  const h = new Heli(PAD);
  const target = car(20);
  const w = world(target);
  h.launch();
  run(h, w, 40);
  h.recall();
  w.target = null;
  run(h, w, 120);
  assert.equal(h.state, 'parked');
  assert.ok(Math.hypot(h.x - PAD.x, h.z - PAD.z) < 0.5, 'on the pad');
  assert.equal(h.y, PAD.y);
  assert.equal(h.rotor, 0);
});

test('banks into a turn and pitches nose down when it speeds up', () => {
  const h = new Heli(PAD);
  const w = world(car(0));
  h.state = 'chase';
  h.rotor = 1;
  h.y = 80;
  let pitch = 0;
  run(h, w, 0.5, () => {});
  w.target = { x: 0, y: 0, z: 2000, vx: 0, vz: 0 };
  run(h, w, 2, (hh) => { pitch = Math.max(pitch, hh.pitch); });
  assert.ok(pitch > 0.1, `nose down ${pitch.toFixed(2)} rad while accelerating`);
  let roll = 0;
  w.target = { x: -2000, y: 0, z: h.z, vx: 0, vz: 0 };
  run(h, w, 2, (hh) => { roll = Math.max(roll, Math.abs(hh.roll)); });
  assert.ok(roll > 0.1, `banked ${roll.toFixed(2)} rad in the turn`);
});
