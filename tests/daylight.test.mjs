import test from 'node:test';
import assert from 'node:assert/strict';
import { CYCLE_RATE, CYCLE_SECONDS, HOURS, TIMES, advanceClock, isTime, nextTime, skyLook, sunAltitude, sunDirection, wrapHour } from '../src/render/daylight.js';
import { LEVELS, WEATHERS, weatherLook } from '../src/render/weather.js';

const lum = (c) => (c[0] + c[1] + c[2]) / 3;
const sat = (c) => Math.max(...c) - Math.min(...c);

test('the sun is highest at noon, lowest at midnight and on the horizon at six and eighteen', () => {
  assert.ok(Math.abs(sunAltitude(12) - 1) < 1e-9);
  assert.ok(Math.abs(sunAltitude(0) + 1) < 1e-9);
  assert.ok(Math.abs(sunAltitude(6)) < 1e-9);
  assert.ok(Math.abs(sunAltitude(18)) < 1e-9);
});

test('the sun rises in the east, stands in the south at noon and sets in the west', () => {
  for (let h = 0; h < 24; h += 0.5) {
    const d = sunDirection(h);
    assert.ok(Math.abs(Math.hypot(...d) - 1) < 1e-9, `a unit vector at ${h}`);
  }
  assert.ok(sunDirection(6.5)[0] > 0.8, 'east after sunrise');
  assert.ok(sunDirection(17.5)[0] < -0.8, 'west before sunset');
  const noon = sunDirection(12);
  assert.ok(noon[1] > 0.8 && noon[2] > 0, 'high and to the south at noon (north is -z)');
});

test('noon is bright with the lamps out, midnight is dark with them on and the stars out', () => {
  const noon = skyLook(HOURS.day);
  const night = skyLook(HOURS.night);
  assert.ok(noon.day > 0.95 && night.day < 0.05);
  assert.equal(noon.lamp, 0);
  assert.equal(noon.windows, 0);
  assert.equal(night.lamp, 1);
  assert.equal(night.windows, 1);
  assert.ok(noon.stars < 0.01 && night.stars > 0.9);
  assert.ok(lum(noon.zenith) > 5 * lum(night.zenith));
  assert.ok(lum(noon.fog) > 5 * lum(night.fog));
  assert.ok(noon.keyIntensity > 2 * night.keyIntensity, 'the sun outshines the moon');
  assert.ok(noon.keyDir[1] > 0.5 && night.keyDir[1] > 0.3, 'the key light is always above the horizon at its own hour');
});

test('the lamps come on as the sun goes down and go out as it comes up', () => {
  const at = (h) => skyLook(h).lamp;
  assert.ok(at(16) < 0.05, 'out in the afternoon');
  assert.ok(at(18.2) > 0.6, 'on at dusk');
  assert.ok(at(5.8) > 0.6, 'still on before dawn');
  assert.ok(at(8) < 0.05, 'out by morning');
});

test('dusk and dawn warm the horizon', () => {
  const dusk = skyLook(HOURS.dusk);
  const night = skyLook(HOURS.night);
  const noon = skyLook(HOURS.day);
  assert.ok(dusk.twilight > 0.6 && night.twilight < 0.01 && noon.twilight < 0.01);
  assert.ok(dusk.horizon[0] > dusk.horizon[2], 'redder than blue at the horizon');
  assert.ok(sat(dusk.horizon) > sat(night.horizon));
});

test('the twilight warms the sky toward the sun only, so dawn and dusk differ', () => {
  const dusk = skyLook(HOURS.dusk);
  assert.ok(dusk.horizon[0] - dusk.horizon[2] > dusk.horizonCool[0] - dusk.horizonCool[2] + 0.15, 'warmer toward the sun');
  const noon = skyLook(HOURS.day);
  for (let i = 0; i < 3; i++) assert.ok(Math.abs(noon.horizon[i] - noon.horizonCool[i]) < 0.03, 'no side at noon');
  assert.ok(sunDirection(HOURS.dawn)[0] > 0.8 && sunDirection(HOURS.dusk)[0] < -0.8, 'the sun is east at dawn and west at dusk');
});

test('clouds grey the sky, hide the stars and the moon and dim the sun', () => {
  const clear = skyLook(12.5, 0);
  const over = skyLook(12.5, 1);
  assert.ok(sat(over.zenith) < sat(clear.zenith) * 0.6, 'the blue goes out of the sky');
  assert.ok(over.keyIntensity < clear.keyIntensity * 0.6);
  assert.ok(over.sunAlpha < clear.sunAlpha * 0.2);
  const dryNight = skyLook(HOURS.night, 0);
  const cloudyNight = skyLook(HOURS.night, 1);
  assert.ok(cloudyNight.stars < dryNight.stars * 0.05);
  assert.ok(cloudyNight.moonAlpha < dryNight.moonAlpha * 0.2);
  assert.ok(lum(cloudyNight.zenith) < 0.2, 'a night stays dark under cloud');
  assert.ok(over.lamp > clear.lamp, 'a dark overcast day brings the lamps up a little');
});

test('a look is finite and in range at every hour and cloud cover', () => {
  for (let h = 0; h < 24; h += 0.25) {
    for (const c of [0, 0.3, 0.7, 1]) {
      const look = skyLook(h, c);
      for (const key of ['zenith', 'mid', 'horizon', 'glow', 'below', 'fog', 'hemiSky', 'hemiGround', 'sunColor', 'cloudLit', 'cloudDark']) {
        for (const v of look[key]) assert.ok(Number.isFinite(v) && v >= -1e-9 && v <= 1 + 1e-9, `${key} at ${h}, ${c}: ${v}`);
      }
      for (const key of ['hemi', 'keyIntensity', 'stars', 'sunAlpha', 'moonAlpha', 'sunGlow', 'city', 'lamp', 'windows', 'cloud', 'day', 'twilight']) {
        assert.ok(Number.isFinite(look[key]) && look[key] >= 0, `${key} at ${h}, ${c}`);
      }
      assert.ok(look.lamp <= 1 && look.stars <= 1 && look.windows <= 1);
    }
  }
});

test('the sky changes smoothly through the day', () => {
  let prev = skyLook(0, 0.4);
  for (let h = 0.1; h <= 24; h += 0.1) {
    const look = skyLook(h, 0.4);
    for (const key of ['horizon', 'fog', 'zenith', 'hemiSky']) {
      for (let i = 0; i < 3; i++) assert.ok(Math.abs(look[key][i] - prev[key][i]) < 0.09, `${key} jumps at ${h.toFixed(1)}`);
    }
    assert.ok(Math.abs(look.hemi - prev.hemi) < 0.15, `hemi jumps at ${h.toFixed(1)}`);
    assert.ok(Math.abs(look.lamp - prev.lamp) < 0.15, `the lamps jump at ${h.toFixed(1)}`);
    prev = look;
  }
});

test('the weather brings the cloud: a few wisps when clear, a solid sky in rain', () => {
  const covers = WEATHERS.map((w) => weatherLook(LEVELS[w]).cloud);
  assert.ok(covers[0] > 0.1 && covers[0] < 0.3, 'wisps when clear');
  for (let i = 1; i < covers.length; i++) assert.ok(covers[i] > covers[i - 1], 'more cloud with more rain');
  assert.ok(covers[2] > 0.9, 'a solid sky in rain');
  assert.equal(covers[3], 1);
});

test('the clock wraps, runs a day in 24 minutes and the settings cycle', () => {
  assert.equal(wrapHour(25), 1);
  assert.equal(wrapHour(-1), 23);
  assert.ok(Math.abs(CYCLE_RATE * CYCLE_SECONDS - 24) < 1e-9);
  let h = 12;
  for (let t = 0; t < CYCLE_SECONDS; t += 1) h = advanceClock(h, 1);
  assert.ok(Math.abs(h - 12) < 1e-6, 'a day later it is the same hour');
  assert.equal(advanceClock(23.99, 10) < 1, true, 'past midnight it wraps');
  let t = 'night';
  const seen = [];
  for (let i = 0; i < TIMES.length; i++) {
    seen.push(t);
    t = nextTime(t);
  }
  assert.deepEqual(seen, [...TIMES]);
  assert.equal(t, 'night');
  assert.equal(nextTime('night', -1), 'cycle');
  assert.ok(isTime('dusk') && !isTime('noon') && !isTime(null));
  for (const k of TIMES.filter((x) => x !== 'cycle')) assert.ok(HOURS[k] >= 0 && HOURS[k] < 24);
});
