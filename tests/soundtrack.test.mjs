import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { SOUNDTRACK, TARGET_LUFS, MoodTracker, MOOD_RULES, nextTrack, trackGain } from '../src/audio/soundtrack.js';

test('every track has its file, and each mood has two tracks to rotate', () => {
  for (const t of SOUNDTRACK) assert.ok(fs.existsSync(new URL(`../assets/music/${t.file}`, import.meta.url)), `missing ${t.file}`);
  for (const mood of ['menu', 'cruise', 'intense', 'mountain']) assert.equal(SOUNDTRACK.filter((t) => t.mood === mood).length, 2, mood);
  assert.equal(new Set(SOUNDTRACK.map((t) => t.id)).size, SOUNDTRACK.length);
});

test('the tracks are leveled to the same loudness', () => {
  for (const t of SOUNDTRACK) {
    const leveled = t.lufs + 20 * Math.log10(trackGain(t));
    assert.ok(Math.abs(leveled - TARGET_LUFS) < 1e-9, t.id);
  }
});

test('the next track of a mood is never the one that just played', () => {
  let last = null;
  for (let turn = 0; turn < 6; turn++) {
    const t = nextTrack('cruise', last, turn);
    assert.equal(t.mood, 'cruise');
    assert.notEqual(t.id, last);
    last = t.id;
  }
});

test('the mood goes up at once for a racer, after a held high speed, and comes down slowly', () => {
  const m = new MoodTracker();
  const run = (seconds, scene) => {
    for (let t = 0; t < seconds; t += 0.1) m.update(0.1, scene);
    return m.mood;
  };
  assert.equal(run(5, { kmh: 100, mountain: false, rival: Infinity }), 'cruise');
  assert.equal(run(0.1, { kmh: 100, mountain: false, rival: 120 }), 'intense');
  assert.equal(run(MOOD_RULES.calmHold - 2, { kmh: 90, mountain: false, rival: Infinity }), 'intense');
  assert.equal(run(3, { kmh: 90, mountain: false, rival: Infinity }), 'cruise');
  assert.equal(run(MOOD_RULES.fastHold - 1, { kmh: 170, mountain: false, rival: Infinity }), 'cruise');
  assert.equal(run(1.5, { kmh: 170, mountain: false, rival: Infinity }), 'intense');
  // A racer passing at a distance keeps it from calming down.
  m.reset();
  run(0.1, { kmh: 100, mountain: false, rival: 100 });
  assert.equal(run(40, { kmh: 90, mountain: false, rival: 250 }), 'intense');
});

test('the pass brings in the mountain tracks after a few seconds and lets them go after ten', () => {
  const m = new MoodTracker();
  const run = (seconds, scene) => {
    for (let t = 0; t < seconds; t += 0.1) m.update(0.1, scene);
    return m.mood;
  };
  assert.equal(run(MOOD_RULES.mountainIn - 1, { kmh: 80, mountain: true, rival: Infinity }), 'cruise');
  assert.equal(run(1.5, { kmh: 80, mountain: true, rival: Infinity }), 'mountain');
  assert.equal(run(1, { kmh: 80, mountain: true, rival: 100 }), 'mountain');
  assert.equal(run(MOOD_RULES.mountainOut - 1, { kmh: 80, mountain: false, rival: Infinity }), 'mountain');
  assert.equal(run(1.5, { kmh: 80, mountain: false, rival: Infinity }), 'intense');
});
