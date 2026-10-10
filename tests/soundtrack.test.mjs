import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  SOUNDTRACK, FOLDERS, OPTIONS, TARGET_LUFS, MOODS, MOOD_FALLBACK, MoodTracker, MOOD_RULES, SpeedSwell, SWELL, Shuffler,
  nextTrack, poolFor, trackGain, parseManifest, setSoundtrack, folderId,
} from '../src/audio/soundtrack.js';
import { makeRng } from '../src/core/rng.js';

/** Runs `fn` with a library in place of the game's, and puts everything back. */
function withLibrary(json, fn, options = {}) {
  const tracks = SOUNDTRACK.slice();
  const folders = FOLDERS.slice();
  const opts = { ...OPTIONS };
  try {
    const parsed = parseManifest(json);
    setSoundtrack(parsed.tracks, parsed.folders);
    Object.assign(OPTIONS, { vocals: true, shuffle: true, lock: null }, options);
    return fn(parsed);
  } finally {
    SOUNDTRACK.splice(0, SOUNDTRACK.length, ...tracks);
    FOLDERS.splice(0, FOLDERS.length, ...folders);
    Object.assign(OPTIONS, opts);
  }
}

const LIBRARY = {
  folders: [
    { name: 'Chase', moods: ['pursuit'] },
    { name: 'Chill', moods: ['cruise', 'menu'] },
    { name: 'LeisureRacing', moods: ['intense', 'mountain'] },
  ],
  tracks: [
    { file: 'Chase/a.m4a' }, { file: 'Chase/b.m4a', vocal: true }, { file: 'Chase/c.m4a' },
    { file: 'Chill/d.m4a' }, { file: 'Chill/e.m4a' }, { file: 'Chill/f.m4a', vocal: true }, { file: 'Chill/g.m4a' },
    { file: 'LeisureRacing/h.m4a' }, { file: 'LeisureRacing/i.m4a' },
  ],
};

test('the track list in assets/music/tracks.json names real files in real folders, and something plays for every mood', () => {
  const json = JSON.parse(fs.readFileSync(new URL('../assets/music/tracks.json', import.meta.url), 'utf8'));
  withLibrary(json, ({ tracks, folders, skipped }) => {
    assert.deepEqual(skipped, [], 'every entry is usable');
    assert.ok(tracks.length > 0 && folders.length > 0);
    for (const t of tracks) assert.ok(fs.existsSync(new URL(`../assets/music/${t.file}`, import.meta.url)), `missing ${t.file}`);
    for (const t of tracks) assert.ok(folders.some((fo) => fo.id === t.folder), `${t.id} is in no folder`);
    for (const mood of MOODS) assert.ok(poolFor(mood).length > 0, `nothing plays for ${mood}`);
    assert.equal(new Set(tracks.map((t) => t.id)).size, tracks.length, 'ids are unique');
  });
});

test('the tracks are leveled to the same loudness', () => {
  withLibrary(LIBRARY, ({ tracks }) => {
    for (const t of [...tracks, { ...tracks[0], lufs: -13.2 }, { ...tracks[0], lufs: -18.4 }]) {
      const leveled = t.lufs + 20 * Math.log10(trackGain(t));
      assert.ok(Math.abs(leveled - TARGET_LUFS) < 1e-9, t.id);
    }
  });
});

test('a shuffle bag deals every track once before any comes round, and a new round never opens with the one just played', () => {
  for (let seed = 1; seed <= 30; seed++) {
    const bag = new Shuffler(makeRng(seed).next);
    const ids = ['a', 'b', 'c', 'd'];
    let last = null;
    for (let round = 0; round < 4; round++) {
      const dealt = [];
      for (let i = 0; i < ids.length; i++) {
        const id = bag.next('cruise', ids, last);
        assert.notEqual(id, last, `seed ${seed} repeated ${id}`);
        dealt.push(id);
        last = id;
      }
      assert.deepEqual([...dealt].sort(), ids, `seed ${seed} round ${round} dealt ${dealt}`);
    }
  }
  assert.equal(new Shuffler().next('x', ['only'], 'only'), 'only', 'one track plays again rather than silence');
  assert.equal(new Shuffler().next('x', [], null), null);
});

test('the first track of a mood is not always the first in the list', () => {
  const firsts = new Set();
  for (let seed = 1; seed <= 40; seed++) firsts.add(new Shuffler(makeRng(seed).next).next('menu', ['a', 'b', 'c', 'd', 'e'], null));
  assert.ok(firsts.size >= 4, `only ${[...firsts]} came first in 40 sessions`);
});

test('a folder plays for its moods, the nearest mood stands in for one nobody plays, and the options narrow it', () => {
  withLibrary(LIBRARY, ({ tracks }) => {
    const ids = (mood) => poolFor(mood).map((t) => t.file.split("/")[1][0]).sort().join("");
    assert.equal(ids('pursuit'), 'abc');
    assert.equal(ids('cruise'), 'defg');
    assert.equal(ids('menu'), 'defg');
    assert.equal(ids('intense'), 'hi');
    assert.equal(ids('mountain'), 'hi');
    OPTIONS.vocals = false;
    assert.equal(ids('pursuit'), 'ac', 'no vocals');
    OPTIONS.vocals = true;
    FOLDERS.find((fo) => fo.id === 'chase').enabled = false;
    assert.equal(ids('pursuit'), 'hi', 'a folder that is off falls back to the nearest mood with tracks');
    FOLDERS.find((fo) => fo.id === 'leisureracing').enabled = false;
    assert.equal(ids('pursuit'), 'defg', 'and on down the chain');
    OPTIONS.lock = 'chase';
    assert.equal(ids('cruise'), 'abc', 'a locked folder plays whatever the mood, switched on or off');
    assert.equal(nextTrack('cruise', null, new Shuffler(makeRng(3).next)).folder, 'chase');
    assert.equal(tracks.length, 9);
  });
  assert.deepEqual(MOOD_FALLBACK.cruise, [], 'cruise is the last resort');
});

test('the shuffle is on by default and a mood plays its folder in order when it is off', () => {
  const play = (n, shuffler) => {
    let last = null;
    const order = [];
    for (let i = 0; i < n; i++) {
      const tr = nextTrack('cruise', last, shuffler);
      order.push(tr.file.split('/')[1][0]);
      last = tr.id;
    }
    return order.join('');
  };
  withLibrary(LIBRARY, () => {
    const runs = new Set();
    for (let seed = 1; seed <= 12; seed++) {
      const order = play(8, new Shuffler(makeRng(seed).next));
      runs.add(order);
      assert.deepEqual([...order.slice(0, 4)].sort().join(''), 'defg', 'each round is every track once');
    }
    assert.ok(runs.size > 3, 'different sessions deal different orders');
  });
  withLibrary(LIBRARY, () => {
    assert.equal(play(6, new Shuffler(makeRng(1).next)), 'defgde', 'in order from the first, wrapping round');
  }, { shuffle: false });
});

test('nothing in the library is not an error: no track, and the synthesized music plays', () => {
  const before = SOUNDTRACK.slice();
  const beforeFolders = FOLDERS.slice();
  try {
    SOUNDTRACK.splice(0, SOUNDTRACK.length);
    assert.equal(nextTrack('pursuit', null), null);
    assert.equal(setSoundtrack([]), false, 'an empty list is not taken');
  } finally {
    setSoundtrack(before, beforeFolders);
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

test('a police pursuit is its own mood, ranked above the rest', () => {
  const m = new MoodTracker();
  for (let s = 0; s < 5; s += 0.1) m.update(0.1, { kmh: 100, mountain: false, rival: Infinity, pursuit: true });
  assert.equal(m.mood, 'pursuit');
  for (let s = 0; s < 5; s += 0.1) m.update(0.1, { kmh: 80, mountain: true, rival: Infinity, pursuit: true });
  assert.equal(m.mood, 'pursuit', 'even on the pass');
});

test('a manifest entry gets defaults from its folder, a bad one is skipped, and the old single mood still works', () => {
  const { tracks, folders, skipped } = parseManifest({ tracks: [
    { file: 'Chill/new-song.mp3' },
    { file: 'Chase/own.mp3', moods: ['cruise', 'disco'] },
    { file: 'Old/old.mp3', mood: 'mountain' },
    { file: 'Mine/anything.mp3' },
    { file: 'loose.mp3' },
    { file: 'Chill/off.mp3', enabled: false },
    { file: 'Chill/new-song.mp3' },
    { mood: 'menu' },
  ] });
  assert.deepEqual(tracks.map((tr) => tr.id), ['Chill/new-song', 'Chase/own', 'Old/old', 'Mine/anything', 'loose']);
  assert.deepEqual(tracks[0].moods, ['cruise', 'menu'], 'a Chill file plays for the drive and the menus');
  assert.equal(tracks[0].folder, 'chill');
  assert.equal(tracks[0].title, 'Chill/new-song');
  assert.equal(tracks[0].lufs, TARGET_LUFS);
  assert.deepEqual(tracks[1].moods, ['cruise'], 'its own moods win, the unknown one dropped');
  assert.deepEqual(tracks[2].moods, ['mountain'], 'the old single mood is a folder of one role');
  assert.deepEqual(tracks[3].moods, [...MOODS], 'an unknown folder plays for every mood');
  assert.equal(tracks[4].folder, 'music', 'a file with no folder is in the music folder');
  assert.equal(skipped.length, 3);
  assert.deepEqual(folders.map((fo) => fo.id), ['chill', 'chase', 'old', 'mine', 'music']);
  assert.equal(folderId('LeisureRacing'), 'leisureracing');
  assert.equal(folderId('夜 のドライブ'), '夜-のドライブ');
});
