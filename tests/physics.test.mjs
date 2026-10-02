import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CARS } from '../src/vehicles/specs.js';
import { createVehicleState, placeVehicle, stepVehicle, DT } from '../src/vehicles/physics.js';

const flat = (surface) => () => ({ h: 0, surface });

function dragRun(spec) {
  const g = flat('asphalt');
  const s = createVehicleState(spec);
  placeVehicle(s, spec, 0, 0, 0, g);
  let t = 0;
  let quarter = 0;
  let top = 0;
  while (t < 60) {
    stepVehicle(s, spec, { throttle: 1, brake: 0, steer: 0, handbrake: 0 }, g, DT);
    t += DT;
    if (!quarter && s.z >= 402) quarter = t;
    top = Math.max(top, s.speed * 3.6);
  }
  return { quarter, top };
}

function cornering(spec, surface) {
  const g = flat(surface);
  const s = createVehicleState(spec);
  placeVehicle(s, spec, 0, 0, 0, g);
  s.vz = 20;
  s.gear = 2;
  let t = 0;
  let sum = 0;
  let n = 0;
  while (t < 6) {
    const throttle = Math.min(1, Math.max(0, (20 - s.speed) * 0.4 + 0.15));
    stepVehicle(s, spec, { throttle, brake: 0, steer: t > 0.5 ? 0.5 : 0, handbrake: 0 }, g, DT);
    t += DT;
    if (t > 2.5) {
      sum += Math.abs(s.aLat);
      n++;
    }
  }
  return sum / n;
}

/** Asserts that ranking cars by `measure` gives the same order as ranking by their bar. */
function assertOrder(bar, measure, higherIsBetter = true) {
  const byBar = [...CARS].sort((a, b) => b.bars[bar] - a.bars[bar]).map((c) => c.id);
  const scored = CARS.map((c) => ({ id: c.id, v: measure(c) }));
  const byMeasure = scored.sort((a, b) => (higherIsBetter ? b.v - a.v : a.v - b.v)).map((c) => c.id);
  assert.deepEqual(byMeasure, byBar, `${bar}: ${JSON.stringify(scored)}`);
}

test('the Top Speed bar matches simulated top speed', () => {
  assertOrder('topSpeed', (c) => dragRun(c).top);
});

test('the Acceleration bar matches the simulated quarter mile', () => {
  assertOrder('accel', (c) => dragRun(c).quarter, false);
});

test('the Handling bar matches mean cornering grip on tarmac and gravel', () => {
  assertOrder('handling', (c) => (cornering(c, 'asphalt') + cornering(c, 'gravel')) / 2);
});

test('braking from 100 km/h stops the car and it stays parked', () => {
  for (const spec of CARS) {
    const g = flat('asphalt');
    const s = createVehicleState(spec);
    placeVehicle(s, spec, 0, 0, 0, g);
    s.vz = 100 / 3.6;
    s.speed = s.vz;
    // Let go once stopped: holding the brake at rest selects reverse, which is tested below.
    let held = true;
    for (let i = 0; i < 120 * 6; i++) {
      if (s.speed < 0.5) held = false;
      stepVehicle(s, spec, { throttle: 0, brake: held ? 1 : 0, steer: 0, handbrake: 0 }, g, DT);
    }
    assert.ok(s.speed < 0.05, `${spec.id} still moving at ${s.speed}`);
    assert.ok(s.z < 60, `${spec.id} took ${s.z.toFixed(1)} m`);
  }
});

test('holding brake at rest selects reverse and backs up', () => {
  const spec = CARS[0];
  const g = flat('asphalt');
  const s = createVehicleState(spec);
  placeVehicle(s, spec, 0, 0, 0, g);
  for (let i = 0; i < 240; i++) stepVehicle(s, spec, { throttle: 0, brake: 1, steer: 0, handbrake: 0 }, g, DT);
  assert.equal(s.gear, -1);
  assert.ok(s.vLong < -1, `vLong ${s.vLong}`);
});

test('a sharp crest at speed launches the car and it lands again', () => {
  const spec = CARS[0];
  // A 1.6 m cosine bump 36 m long at z = 100.
  const g = (x, z) => {
    const u = (z - 100) / 18;
    return { h: Math.abs(u) < 1 ? 0.8 * (1 + Math.cos(Math.PI * u)) : 0, surface: 'gravel' };
  };
  const s = createVehicleState(spec);
  placeVehicle(s, spec, 0, 0, 0, g);
  s.vz = 32;
  let flew = false;
  for (let i = 0; i < 120 * 6; i++) {
    stepVehicle(s, spec, { throttle: 1, brake: 0, steer: 0, handbrake: 0 }, g, DT);
    if (s.air && s.y - g(s.x, s.z).h > 0.3) flew = true;
  }
  assert.ok(flew, 'never left the ground');
  assert.equal(s.air, false);
});
