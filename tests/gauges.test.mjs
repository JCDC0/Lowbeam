import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CARS, carById } from '../src/vehicles/specs.js';
import { createVehicleState, placeVehicle, stepVehicle, DT } from '../src/vehicles/physics.js';
import { createGauges, stepGauges, WATER_MIN, WATER_MAX, EXH_MIN, EXH_MAX, INTAKE_MIN } from '../src/vehicles/gauges.js';

const flat = (surface = 'asphalt') => () => ({ h: 0, surface });

/** Drives a car with a scripted input and returns the gauge history. */
function drive(spec, seconds, inputAt, surface = 'asphalt') {
  const g = flat(surface);
  const s = createVehicleState(spec);
  placeVehicle(s, spec, 0, 0, 0, g);
  const gauges = createGauges(spec);
  const log = [];
  for (let t = 0; t < seconds; t += DT) {
    stepVehicle(s, spec, inputAt(t, s), g, DT);
    stepGauges(gauges, spec, s, DT);
    log.push({ t, ...gauges, speed: s.speed });
  }
  return log;
}

test('the turbo Hayate builds boost with lag and drops to vacuum off throttle', () => {
  const spec = carById('hayate');
  const log = drive(spec, 8, (t) => ({ throttle: t < 6 ? 1 : 0, brake: 0, steer: 0, handbrake: 0 }));
  const at = (t) => log.find((r) => r.t >= t);
  assert.ok(at(0.05).boost < 0.2, `boost ${at(0.05).boost} at 0.05 s should still be low`);
  const peak = Math.max(...log.filter((r) => r.t < 6).map((r) => r.boost));
  assert.ok(peak > 1.0 && peak <= 1.2 + 1e-9, `peak boost ${peak}`);
  assert.ok(at(7.5).boost < -0.4, `boost ${at(7.5).boost} after lifting`);
  for (const r of log) assert.equal(r.intake, 0);
});

test('the naturally aspirated cars read manifold vacuum, never boost', () => {
  for (const id of ['rampart', 'vespera']) {
    const spec = carById(id);
    const log = drive(spec, 6, (t) => ({ throttle: t < 3 ? 1 : 0, brake: 0, steer: 0, handbrake: 0 }));
    for (const r of log) {
      assert.equal(r.boost, 0, id);
      assert.ok(r.intake >= INTAKE_MIN && r.intake <= 0, `${id} intake ${r.intake}`);
    }
    const wot = log.find((r) => r.t >= 2.5);
    const lift = log.find((r) => r.t >= 5.5);
    assert.ok(wot.intake > -0.1, `${id} at full throttle reads ${wot.intake}`);
    assert.ok(lift.intake < -0.5, `${id} off throttle reads ${lift.intake}`);
  }
});

test('water and exhaust temperatures stay in range and follow the load', () => {
  for (const spec of CARS) {
    // Full throttle held against the brakes at walking pace: heavy load, no airflow.
    const hard = drive(spec, 90, () => ({ throttle: 1, brake: 1, steer: 0, handbrake: 0 }), 'gravel');
    const idle = drive(spec, 90, () => ({ throttle: 0, brake: 0, steer: 0, handbrake: 0 }));
    for (const r of [...hard, ...idle]) {
      assert.ok(r.water >= WATER_MIN && r.water <= WATER_MAX, `${spec.id} water ${r.water}`);
      assert.ok(r.exh >= EXH_MIN && r.exh <= EXH_MAX, `${spec.id} exh ${r.exh}`);
    }
    const h = hard[hard.length - 1];
    const i = idle[idle.length - 1];
    assert.ok(h.water > i.water + 3, `${spec.id} water hard ${h.water.toFixed(1)} vs idle ${i.water.toFixed(1)}`);
  }
  const spec = carById('vespera');
  const wot = drive(spec, 6, () => ({ throttle: 1, brake: 0, steer: 0, handbrake: 0 }));
  const idle = drive(spec, 6, () => ({ throttle: 0, brake: 0, steer: 0, handbrake: 0 }));
  assert.ok(wot[wot.length - 1].exh > idle[idle.length - 1].exh + 200, 'exhaust should run hot at full throttle');
});

test('the shift light comes on near the upshift point', () => {
  const spec = carById('rampart');
  const log = drive(spec, 3, () => ({ throttle: 1, brake: 0, steer: 0, handbrake: 0 }));
  assert.ok(log.some((r) => r.shift), 'shift light never lit');
  for (const r of log) if (r.shift) assert.ok(r.rpm > spec.engine.shiftUp * 0.95, `lit at ${r.rpm}`);
});
