import test from 'node:test';
import assert from 'node:assert/strict';
import { speedFx, fxOn, setFx, SCREEN_FX, VIGNETTE_KMH, BLUR_KMH } from '../src/ui/screen-fx.js';

test('the vignette and the blur are nothing when slow, full when fast, and smooth between', () => {
  const on = { vignette: true, blur: true };
  assert.deepEqual(speedFx(60, on), { vignette: 0, blur: 0 });
  assert.equal(speedFx(VIGNETTE_KMH[1] + 10, on).vignette, 1);
  assert.equal(speedFx(BLUR_KMH[1] + 10, on).blur, 1);
  assert.equal(speedFx(180, on).blur, 0, 'no blur below 200 km/h');
  let last = 0;
  for (let k = 100; k <= 320; k += 5) {
    const v = speedFx(k, on).vignette;
    assert.ok(v >= last && v - last < 0.12, `the vignette climbs smoothly at ${k}`);
    last = v;
  }
  assert.deepEqual(speedFx(300, { vignette: false, blur: false }), { vignette: 0, blur: 0 }, 'off is off');
});

test('every screen effect is on by default and toggles', () => {
  for (const f of SCREEN_FX) assert.equal(fxOn(f), true);
  setFx('blur', false);
  assert.equal(fxOn('blur'), false);
  setFx('blur');
  assert.equal(fxOn('blur'), true);
});
