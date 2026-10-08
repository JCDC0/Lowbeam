import test from 'node:test';
import assert from 'node:assert/strict';
import { FOG_DRY, FOG_STORM, LEVELS, STREAKS, WEATHERS, isWeather, nextWeather, weatherLook } from '../src/render/weather.js';

test('clear is dry, with the dry fog and no rain', () => {
  const look = weatherLook(LEVELS.clear);
  assert.equal(look.wet, 0);
  assert.equal(look.streaks, 0);
  assert.equal(look.fogNear, FOG_DRY.near);
  assert.equal(look.fogFar, FOG_DRY.far);
});

test('a storm is the wettest, the thickest and the rainiest', () => {
  const storm = weatherLook(LEVELS.storm);
  assert.equal(storm.wet, 1);
  assert.equal(storm.streaks, STREAKS);
  assert.equal(storm.fogNear, FOG_STORM.near);
  assert.equal(storm.fogFar, FOG_STORM.far);
});

test('every look grows with the level, and the roads soak before the rain is heavy', () => {
  let prev = weatherLook(0);
  for (const w of WEATHERS.slice(1)) {
    const look = weatherLook(LEVELS[w]);
    assert.ok(look.wet > prev.wet || prev.wet === 1, `${w} is wetter`);
    assert.ok(look.streaks > prev.streaks, `${w} has more rain`);
    assert.ok(look.fogFar < prev.fogFar, `${w} has less sight`);
    assert.ok(look.fall >= prev.fall && look.alpha > prev.alpha, `${w} falls harder`);
    prev = look;
  }
  assert.ok(weatherLook(0.5).wet > 0.5, 'half the rain is more than half wet');
});

test('a level out of range is clamped', () => {
  assert.deepEqual(weatherLook(-3), weatherLook(0));
  assert.deepEqual(weatherLook(9), weatherLook(1));
});

test('the settings cycle both ways and know their names', () => {
  let w = 'clear';
  const seen = [];
  for (let i = 0; i < WEATHERS.length; i++) {
    seen.push(w);
    w = nextWeather(w);
  }
  assert.deepEqual(seen, WEATHERS);
  assert.equal(w, 'clear', 'a full turn comes back');
  assert.equal(nextWeather('clear', -1), 'storm');
  assert.ok(isWeather('rain') && !isWeather('snow') && !isWeather(undefined));
});
