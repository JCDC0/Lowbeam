import test from 'node:test';
import assert from 'node:assert/strict';
import { CARS, carById } from '../src/vehicles/specs.js';
import { createVehicleState, placeVehicle, stepVehicle, DT } from '../src/vehicles/physics.js';
import { NITROUS, refillCost, stepNitrous } from '../src/vehicles/nitrous.js';

const flat = () => ({ h: 0, surface: 'asphalt' });

/** Full throttle from rest for `seconds`; nitrous held from 15 m/s when `n2o`. */
function launch(spec, n2o, seconds = 30) {
  const s = createVehicleState(spec);
  placeVehicle(s, spec, 0, 0, 0, flat);
  let t = 0;
  let t160 = 0;
  while (t < seconds) {
    stepVehicle(s, spec, { throttle: 1, brake: 0, steer: 0, handbrake: 0, nitrous: n2o && s.speed > 15 }, flat, DT);
    t += DT;
    if (!t160 && s.speed * 3.6 >= 160) t160 = t;
  }
  return { s, t160 };
}

test('nitrous flows only with the key, the throttle open, a forward gear and a running engine', () => {
  const spec = carById('hayate');
  const base = { n2o: 1, n2oOn: false, engineOn: true, blown: false, gear: 3, temp: 90, damage: 0 };
  assert.ok(stepNitrous({ ...base }, spec, true, 1, 5000, DT) > 0);
  assert.equal(stepNitrous({ ...base }, spec, false, 1, 5000, DT), 0);
  assert.equal(stepNitrous({ ...base }, spec, true, 0.3, 5000, DT), 0);
  assert.equal(stepNitrous({ ...base, gear: -1 }, spec, true, 1, 5000, DT), 0);
  assert.equal(stepNitrous({ ...base, gear: 0 }, spec, true, 1, 5000, DT), 0);
  assert.equal(stepNitrous({ ...base, blown: true }, spec, true, 1, 5000, DT), 0);
  assert.equal(stepNitrous({ ...base, n2o: 0 }, spec, true, 1, 5000, DT), 0);
});

test('a full bottle lasts its duration, heats the engine and costs a little of it', () => {
  const spec = carById('rampart');
  const s = { n2o: 1, n2oOn: false, engineOn: true, blown: false, gear: 3, temp: 90, damage: 0 };
  let t = 0;
  while (stepNitrous(s, spec, true, 1, 3000, DT) > 0) t += DT;
  assert.ok(Math.abs(t - NITROUS.duration) < 0.05, `lasted ${t.toFixed(2)} s`);
  assert.ok(s.temp - 90 > 15 && s.temp - 90 < 25, `heat ${(s.temp - 90).toFixed(1)}`);
  assert.ok(s.damage > 0.02 && s.damage < 0.05, `damage away from the limiter ${s.damage.toFixed(3)}`);
  const hot = { ...s, n2o: 1, damage: 0 };
  while (stepNitrous(hot, spec, true, 1, spec.engine.redline, DT) > 0);
  assert.ok(hot.damage > s.damage * 3, `damage at the limiter ${hot.damage.toFixed(3)}`);
});

test('every car is quicker on nitrous, and a straight launch costs little engine', () => {
  for (const spec of CARS) {
    const dry = launch(spec, false);
    const wet = launch(spec, true);
    assert.ok(wet.t160 < dry.t160 - 0.3, `${spec.id}: 0-160 ${dry.t160.toFixed(2)} dry, ${wet.t160.toFixed(2)} on nitrous`);
    assert.ok(wet.s.n2o === 0, `${spec.id}: the bottle runs dry`);
    assert.ok(wet.s.damage < 0.1 && !wet.s.blown, `${spec.id}: damage ${wet.s.damage.toFixed(3)}`);
    assert.equal(dry.s.n2o, 1, 'the dry run leaves the bottle full');
  }
});

test('held through the limiter in a gear, nitrous over-revs the engine past the redline and hurts it', () => {
  for (const spec of CARS) {
    const s = createVehicleState(spec);
    placeVehicle(s, spec, 0, 0, 0, flat);
    s.vz = s.speed = 25;
    s.gear = 3;
    s.manual = true;
    let peak = 0;
    let over = 0;
    for (let t = 0; t < NITROUS.duration + 1; t += DT) {
      stepVehicle(s, spec, { throttle: 1, brake: 0, steer: 0, handbrake: 0, manual: true, nitrous: true }, flat, DT);
      peak = Math.max(peak, s.rpm);
      over = Math.max(over, s.overrev);
    }
    assert.ok(peak > spec.engine.redline + 400, `${spec.id}: peak ${peak.toFixed(0)} against a ${spec.engine.redline} redline`);
    assert.ok(over > 0, `${spec.id}: it counts as an over-rev`);
    assert.ok(s.damage > 0.08, `${spec.id}: damage ${s.damage.toFixed(3)}`);
  }
});

test('a refill costs the empty part of the bottle', () => {
  assert.equal(refillCost({ n2o: 0 }), NITROUS.price);
  assert.equal(refillCost({ n2o: 1 }), 0);
  assert.equal(refillCost({ n2o: 0.5 }), NITROUS.price / 2);
});
