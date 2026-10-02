import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Colliders } from '../src/world/collision.js';
import { CARS } from '../src/vehicles/specs.js';
import { createVehicleState, placeVehicle, stepVehicle, DT } from '../src/vehicles/physics.js';

const flat = () => ({ h: 0, surface: 'asphalt' });
const coast = { throttle: 0, brake: 0, steer: 0, handbrake: 0 };

function run(col, s, spec, seconds, input = coast) {
  let hardest = 0;
  for (let t = 0; t < seconds; t += DT) {
    stepVehicle(s, spec, input, flat, DT);
    hardest = Math.max(hardest, col.resolve(s, spec));
  }
  return hardest;
}

test('a car driven into a wall stops at it and bounces back a little', () => {
  const spec = CARS[0];
  // A building 20 m ahead across the road, local X along world X.
  const col = new Colliders([], [{ x: 0, z: 25, hx: 10, hz: 5, yaw: 0 }]);
  const s = createVehicleState(spec);
  placeVehicle(s, spec, 0, 0, 0, flat);
  s.vz = 20;
  const hit = run(col, s, spec, 3);
  assert.ok(hit > 15, `impact ${hit}`);
  const front = s.z + (spec.cgToFront - spec.wheelbase / 2) + (spec.length / 2 - spec.width / 2) + spec.width / 2;
  assert.ok(front <= 20.05, `nose at ${front.toFixed(2)} is inside the wall`);
  assert.ok(s.vLong <= 0.5, `still pushing forward at ${s.vLong}`);
});

test('a glancing hit on a pole turns the car away from it', () => {
  const spec = CARS[1];
  // A pole a little left of the path (+X is left), so the left front corner clips it.
  const col = new Colliders([{ x: 0.9, z: 15, r: 0.25 }], []);
  const s = createVehicleState(spec);
  placeVehicle(s, spec, 0, 0, 0, flat);
  s.vz = 15;
  run(col, s, spec, 2);
  assert.ok(s.yaw < -0.02, `yaw ${s.yaw}: the car should turn right, away from the pole`);
  assert.ok(s.x < 0, `x ${s.x}`);
});

test('a car that starts inside a tree is pushed clear', () => {
  const spec = CARS[2];
  const col = new Colliders([{ x: 0.3, z: 0, r: 0.45 }], []);
  const s = createVehicleState(spec);
  placeVehicle(s, spec, 0, 0, 0, flat);
  run(col, s, spec, 0.5);
  assert.equal(col.probe(s.x, s.z, spec.width / 2), null);
});

test('the valley edge is a wall', () => {
  const spec = CARS[0];
  const col = new Colliders([], []);
  const s = createVehicleState(spec);
  placeVehicle(s, spec, 0, 985, 0, flat);
  s.vz = 30;
  run(col, s, spec, 2);
  assert.ok(s.z < 990, `z ${s.z}`);
});
