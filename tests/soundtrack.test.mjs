import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { SOUNDTRACK, TARGET_LUFS, MOODS, MoodTracker, MOOD_RULES, SpeedSwell, SWELL, nextTrack, trackGain, parseManifest, setSoundtrack } from '../src/audio/soundtrack.js';

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

test('the music stays silent below 30 km/h, swells in slowly and is full by 75', () => {
  const w = new SpeedSwell();
  const run = (seconds, scene) => {
    for (let t = 0; t < seconds; t += 0.1) w.update(0.1, scene);
    return w.level;
  };
  const road = (kmh) => ({ kmh, mountain: false, rival: Infinity });
  assert.equal(run(30, road(28)), 0);
  const early = run(2, road(180));
  assert.ok(early > 0.15 && early < 0.4, `two seconds in ${early}`);
  assert.ok(run(8, road(180)) > 0.99);
  const half = new SpeedSwell();
  for (let t = 0; t < 30; t += 0.1) half.update(0.1, road(52.5));
  assert.ok(half.level > 0.4 && half.level < 0.6, `52 km/h ${half.level}`);
  const full = new SpeedSwell();
  for (let t = 0; t < 30; t += 0.1) full.update(0.1, road(75));
  assert.ok(full.level > 0.99, `75 km/h is full, ${full.level}`);
});

test('the swell holds through a short braking zone and fades out slowly after it', () => {
  const w = new SpeedSwell();
  const run = (seconds, scene) => {
    for (let t = 0; t < seconds; t += 0.1) w.update(0.1, scene);
    return w.level;
  };
  run(20, { kmh: 200, mountain: false, rival: Infinity });
  assert.ok(run(SWELL.holdDown - 0.5, { kmh: 30, mountain: false, rival: Infinity }) > 0.99);
  const fading = run(5, { kmh: 30, mountain: false, rival: Infinity });
  assert.ok(fading > 0.6 && fading < 0.95, `after the hold ${fading}`);
  assert.equal(run(30, { kmh: 30, mountain: false, rival: Infinity }), 0);
});

test('the pass reaches full swell sooner, and a racer close by keeps the music up', () => {
  const pass = new SpeedSwell();
  for (let t = 0; t < 20; t += 0.1) pass.update(0.1, { kmh: 60, mountain: true, rival: Infinity });
  assert.ok(pass.level > 0.99);
  const duel = new SpeedSwell();
  for (let t = 0; t < 20; t += 0.1) duel.update(0.1, { kmh: 20, mountain: false, rival: 80 });
  assert.ok(Math.abs(duel.level - SWELL.rivalFloor) < 1e-9);
});

test('the track list in assets/music/tracks.json names real files and covers every mood', () => {
  const json = JSON.parse(fs.readFileSync(new URL('../assets/music/tracks.json', import.meta.url), 'utf8'));
  const { tracks, skipped } = parseManifest(json);
  assert.deepEqual(skipped, [], 'every entry is usable');
  for (const t of tracks) assert.ok(fs.existsSync(new URL(`../assets/music/${t.file}`, import.meta.url)), `missing ${t.file}`);
  for (const mood of MOODS) assert.ok(tracks.some((t) => t.mood === mood), `no ${mood} track`);
});

test('a manifest entry gets defaults, a bad one is skipped, and a list without a mood is refused', () => {
  const { tracks, skipped } = parseManifest({ tracks: [
    { file: 'new-song.mp3', mood: 'cruise' },
    { file: 'odd.mp3', mood: 'disco' },
    { mood: 'menu' },
    { file: 'off.mp3', mood: 'menu', enabled: false },
    { file: 'new-song.mp3', mood: 'intense' },
  ] });
  assert.equal(tracks.length, 1);
  assert.deepEqual(tracks[0], { id: 'new-song', file: 'new-song.mp3', mood: 'cruise', title: 'new-song', lufs: TARGET_LUFS, vocal: false });
  assert.equal(skipped.length, 4);
  const before = SOUNDTRACK.slice();
  assert.equal(setSoundtrack(tracks), false, 'cruise alone leaves three moods silent');
  assert.deepEqual(SOUNDTRACK, before, 'so the list stays');
  const full = MOODS.map((mood) => ({ id: mood, file: `${mood}.mp3`, mood, title: mood, lufs: -16 }));
  assert.equal(setSoundtrack(full), true);
  assert.equal(nextTrack('mountain', null).id, 'mountain');
  setSoundtrack(before);
});
