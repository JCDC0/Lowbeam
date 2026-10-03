import { test } from 'node:test';
import assert from 'node:assert/strict';
import { carById } from '../src/vehicles/specs.js';
import { createVehicleState, placeVehicle, stepVehicle, DT } from '../src/vehicles/physics.js';

const flat = () => ({ h: 0, surface: 'asphalt' });

function rig(id, manual = true) {
  const spec = carById(id);
  const s = createVehicleState(spec);
  placeVehicle(s, spec, 0, 0, 0, flat);
  const run = (seconds, input = {}, each) => {
    for (let t = 0; t < seconds; t += DT) {
      stepVehicle(s, spec, { throttle: 0, brake: 0, steer: 0, handbrake: 0, manual, ...input }, flat, DT);
      if (each) each(t);
    }
  };
  return { spec, s, run };
}

test('a shift at high revs throws a flame and sparks, a shift at low revs does not', () => {
  const loud = rig('hayate');
  loud.run(1.85, { throttle: 1 });
  assert.ok(loud.s.rpm > loud.spec.engine.redline * 0.8, `rpm ${loud.s.rpm}`);
  const before = loud.s.fx.pops;
  let flame = 0;
  let sparks = 0;
  loud.run(0.1, { throttle: 1, shiftUp: true }, () => {
    flame = Math.max(flame, loud.s.fx.flame);
    sparks = Math.max(sparks, loud.s.fx.sparks);
  });
  assert.ok(flame > 0.6, `flame ${flame}`);
  assert.ok(sparks > 0.3, `sparks ${sparks}`);
  assert.ok(loud.s.fx.pops > before, 'no bang');

  const quiet = rig('hayate');
  quiet.run(0.6, { throttle: 0.6 });
  let any = 0;
  quiet.run(0.1, { throttle: 0.6, shiftUp: true }, () => {
    any = Math.max(any, quiet.s.fx.flame, quiet.s.fx.sparks);
  });
  assert.equal(any, 0, 'a gentle shift threw a flame');
});

test('lifting off at high revs crackles a few times and then goes quiet', () => {
  const { s, run } = rig('rampart', false);
  run(4, { throttle: 1 });
  const before = s.fx.pops;
  run(1.2, { throttle: 0 });
  const pops = s.fx.pops - before;
  assert.ok(pops >= 2 && pops <= 5, `${pops} pops`);
  const settled = s.fx.pops;
  run(1.5, { throttle: 0 });
  assert.equal(s.fx.pops, settled, 'still popping long after the lift');
});

test('over-revving sparks and crackles constantly', () => {
  const { s, run } = rig('hayate');
  s.gear = 2;
  s.vz = 33;
  s.speed = 33;
  let min = 1;
  const before = s.fx.pops;
  run(1.5, { throttle: 0 }, (t) => {
    if (t > 0.3) min = Math.min(min, s.fx.sparks);
  });
  assert.ok(s.overrev > 0, `over-rev ${s.overrev}`);
  assert.ok(min > 0.3, `sparks dropped to ${min}`);
  assert.ok(s.fx.pops - before >= 6, `${s.fx.pops - before} pops in 1.5 s`);
});

test('smoke: a puff when the engine blows, dense while it stays blown, none when healthy', () => {
  const healthy = rig('vespera');
  healthy.run(2, { throttle: 0.5 });
  assert.equal(healthy.s.fx.smoke, 0);

  const { s, run } = rig('hayate');
  s.gear = 3;
  s.vz = 40;
  s.speed = 40;
  run(0.05, { shiftDown: true });
  run(0.3, {});
  assert.ok(s.blown);
  let low = 1;
  run(4, { throttle: 0 }, () => {
    low = Math.min(low, s.fx.smoke);
  });
  assert.ok(s.fx.smoke >= 0.7, `smoke ${s.fx.smoke}`);
  assert.ok(low >= 0.7, `smoke thinned to ${low}`);
});
