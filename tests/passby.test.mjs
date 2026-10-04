import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PassBy, passbyGain, passbyDuration, renderPassby } from '../src/audio/passby.js';

/** A player at the origin driving north (yaw 0 faces +Z). */
const player = () => ({ x: 0, y: 0, z: 0, vx: 0, vz: 0, yaw: 0 });

/** A car with an id, a kind and a world velocity. */
const car = (id, kind = { id: 'sedan', mass: 1350 }, extra = {}) => ({
  id, x: 0, y: 0, z: 0, vx: 0, vz: 0, kind, ...extra,
});

/**
 * Runs one car past a stationary player: it starts 60 m behind on the right, drives past at
 * `speed` and ends 60 m ahead, stepped at 30 Hz. Returns the events the tracker emitted.
 */
function run(carX0, carZ0, vx, vz, { dt = 1 / 30, seconds = 6, kind, playerAt = player() } = {}) {
  const pb = new PassBy();
  const events = [];
  const steps = Math.round(seconds / dt);
  for (let i = 0; i < steps; i++) {
    const t = i * dt;
    const a = car(1, kind || { id: 'sedan', mass: 1350 }, { x: carX0 + vx * t, z: carZ0 + vz * t, vx, vz });
    events.push(...pb.update(playerAt, [a]));
  }
  return events;
}

test('a car driven past the player emits exactly one event', () => {
  // At yaw 0 the player faces +Z, and its left is +X, so a car at +X passes on its left.
  const events = run(3.5, -60, 0, 30);
  assert.equal(events.length, 1, `got ${events.length} events`);
  const e = events[0];
  assert.ok(e.speed > 25, `relative speed ${e.speed}`);
  assert.ok(e.dist < 14, `miss distance ${e.dist}`);
  assert.equal(e.side, -1, 'a car on the player left passes on the left');
});

test('the same car whooshes once, not once per frame', () => {
  const pb = new PassBy();
  const count = () => {
    let n = 0;
    for (let i = 0; i < 180; i++) {
      const t = i / 30;
      n += pb.update(player(), [car(1, undefined, { x: 3.5, z: -60 + 30 * t, vz: 30 })]).length;
    }
    return n;
  };
  assert.equal(count(), 1);
  // Stepping on far past the pass, and back again, is still one.
  for (let i = 0; i < 120; i++) pb.update(player(), [car(1, undefined, { x: 3.5, z: 60 + i, vz: 30 })]);
  assert.equal(pb.update(player(), [car(1, undefined, { x: 3.5, z: 400, vz: 30 })]).length, 0);
});

test('a car matching the player speed beside you never whooshes', () => {
  // Same velocity as the player, so the relative speed is zero.
  const p = { x: 0, y: 0, z: 0, vx: 0, vz: 20, yaw: 0 };
  const pb = new PassBy();
  let n = 0;
  for (let i = 0; i < 240; i++) {
    const t = i / 30;
    n += pb.update(p, [car(1, undefined, { x: 3, z: -80 + 20 * t, vx: 0, vz: 20 })]).length;
  }
  assert.equal(n, 0, 'a car matching speed should be silent');
});

test('a car creeping by at low relative speed is silent', () => {
  // 2 m/s relative is well under the MIN_SPEED of 8.
  const events = run(3.5, -60, 0, 2, { seconds: 90 });
  assert.equal(events.length, 0, `got ${events.length} events for a 2 m/s pass`);
});

test('a car that misses at 30 m never whooshes', () => {
  const events = run(30, -60, 0, 30);
  assert.equal(events.length, 0, `got ${events.length} events for a 30 m miss`);
});

test('a car on the player right passes on the right', () => {
  const events = run(-3.5, -60, 0, 30);
  assert.equal(events.length, 1);
  assert.equal(events[0].side, 1, 'a car on the player right passes on the right');
});

test('a heavy vehicle is flagged heavy', () => {
  const heavy = run(3.5, -60, 0, 30, { kind: { id: 'semi', mass: 24000 } });
  assert.equal(heavy.length, 1);
  assert.equal(heavy[0].heavy, true);
  const light = run(3.5, -60, 0, 30);
  assert.equal(light[0].heavy, false, 'a sedan should not be heavy');
});

test('louder for faster and closer', () => {
  // Faster is louder at the same distance.
  const fast = passbyGain(40, 5);
  const slow = passbyGain(12, 5);
  assert.ok(fast > slow, `${fast} should exceed ${slow}`);
  // Closer is louder at the same speed.
  const near = passbyGain(30, 2);
  const far = passbyGain(30, 13);
  assert.ok(near > far, `${near} should exceed ${far}`);
  // The brief's extremes: 120 km/h relative is violent, 15 km/h is nearly nothing.
  assert.ok(passbyGain(33, 3) > 0.6, 'a 120 km/h pass should be strong');
  assert.ok(passbyGain(4.2, 3) < 0.05, 'a 15 km/h creep should be nearly nothing');
});

test('a faster pass is shorter than a slow one', () => {
  assert.ok(passbyDuration(40) < passbyDuration(10), 'fast passes are shorter');
});

test('the render produces a loud swell that decays, and scales with speed', () => {
  const loud = renderPassby({ speed: 33, dist: 2, side: 1, heavy: false, kind: 'sedan' }, 48000);
  const quiet = renderPassby({ speed: 6, dist: 12, side: 1, heavy: false, kind: 'sedan' }, 48000);
  const peak = (a) => a.reduce((m, x) => Math.max(m, Math.abs(x)), 0);
  const rms = (a) => Math.sqrt(a.reduce((s, x) => s + x * x, 0) / a.length);
  assert.ok(peak(loud) > 0.2, `loud pass peak ${peak(loud)}`);
  assert.ok(rms(loud) > rms(quiet) * 3, `${rms(loud)} vs ${rms(quiet)}`);
  // The swell peaks near the middle, and the head and tail are quiet: the envelope shape.
  const head = Math.abs(loud[10]);
  const mid = Math.abs(loud[Math.floor(loud.length / 2)]);
  assert.ok(mid > head * 2, 'the pass should swell, not start at full');
});