import test from 'node:test';
import assert from 'node:assert/strict';
import { LAMPS_ON, TRAIL, tailLampsOn, trailGlow } from '../src/render/tail-lamps.js';
import { skyLook } from '../src/render/daylight.js';
import { LEVELS, weatherLook } from '../src/render/weather.js';

test('tail lamps run from dusk to dawn and in any rain, and are off on a clear day', () => {
  const at = (hour, weather = 0) => tailLampsOn(skyLook(hour, 0).lamp, weatherLook(weather).wet);
  for (const hour of [18, 18.5, 21, 0, 3, 5.5]) assert.ok(at(hour), `on at ${hour}:00`);
  for (const hour of [8, 12, 15]) assert.ok(!at(hour), `off at ${hour}:00 in clear weather`);
  for (const w of ['drizzle', 'rain', 'storm']) assert.ok(at(12, LEVELS[w]), `on at noon in ${w}`);
  assert.ok(!tailLampsOn(LAMPS_ON.lamp, LAMPS_ON.wet), 'the thresholds themselves are still off');
});

test('a light trail shows only with the lamps on, from 100 km/h, full at 180, brighter on the brake', () => {
  assert.equal(trailGlow(60, false), 0, 'no trail with the lamps off');
  assert.equal(trailGlow(TRAIL.from - 0.1, true), 0, 'none below 100 km/h');
  assert.equal(trailGlow(TRAIL.full, true), 1);
  assert.equal(trailGlow(90, true), 1, 'no brighter past full');
  const mid = trailGlow((TRAIL.from + TRAIL.full) / 2, true);
  assert.ok(Math.abs(mid - 0.5) < 1e-9, `half way is half (${mid})`);
  let last = 0;
  for (let v = TRAIL.from; v <= TRAIL.full; v += 1) {
    const g = trailGlow(v, true);
    assert.ok(g >= last, `rises with speed at ${v} m/s`);
    last = g;
  }
  assert.ok(Math.abs(trailGlow(TRAIL.full, true, 1) - TRAIL.brake) < 1e-9, 'braking brightens it');
});
