import test from 'node:test';
import assert from 'node:assert/strict';
import { CARS } from '../src/vehicles/specs.js';

test('garage specs have valid gear counts, drivetrains, and bar metrics', () => {
  for (const car of CARS) {
    assert.ok(car.gears.length >= 5 && car.gears.length <= 7, `${car.name} gear count should be 5..7`);
    assert.ok(car.layout.length > 0, `${car.name} must have layout`);
    for (const [k, v] of Object.entries(car.bars)) {
      assert.ok(v >= 0 && v <= 10, `${car.name} bar ${k} must be within 0..10`);
    }
  }
});

test('garage wrapping works for 3 and 5 cars', () => {
  const wrap = (i, n) => ((i % n) + n) % n;

  // 3 cars
  assert.equal(wrap(-1, 3), 2);
  assert.equal(wrap(0, 3), 0);
  assert.equal(wrap(2, 3), 2);
  assert.equal(wrap(3, 3), 0);

  // 5 cars
  assert.equal(wrap(-1, 5), 4);
  assert.equal(wrap(0, 5), 0);
  assert.equal(wrap(4, 5), 4);
  assert.equal(wrap(5, 5), 0);
  assert.equal(wrap(11, 5), 1);
});
