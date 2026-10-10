import { test } from 'node:test';
import assert from 'node:assert/strict';
import { barFlash, barOn, FLASH_CYCLE } from '../src/police/lights.js';
import { sirenPitch, doppler, sirenGain, sirenVoices, rotorSound, PATTERNS, SIREN_RANGE, SIREN_VOICES } from '../src/audio/siren.js';
import { MoodTracker, SpeedSwell, SWELL } from '../src/audio/soundtrack.js';

test('the light bar flashes red twice, then blue twice, never both at once', () => {
  let red = 0;
  let blue = 0;
  let both = 0;
  let edges = 0;
  let last = '';
  const steps = 800;
  for (let i = 0; i < steps; i++) {
    const f = barFlash((i / steps) * FLASH_CYCLE, 0);
    if (f.red) red++;
    if (f.blue) blue++;
    if (f.red && f.blue) both++;
    const now = f.red ? 'r' : f.blue ? 'b' : '';
    if (now && now !== last) edges++;
    last = now || last;
    if (!now) last = '';
  }
  assert.equal(both, 0, 'the halves take turns');
  assert.ok(red > steps * 0.15 && blue > steps * 0.15, 'each half is lit about a quarter of the time');
  assert.equal(edges, 4, 'four pulses a cycle: red, red, blue, blue');
  assert.notDeepEqual([0.05, 0.2, 0.45].map((t) => barFlash(t, 1)), [0.05, 0.2, 0.45].map((t) => barFlash(t, 2)), 'two cars do not flash in step');
  assert.ok(barOn({ pursuit: 'chase' }) && barOn({ mode: 'parked' }) && !barOn({ pursuit: false, mode: 'drive' }));
});

test('the siren patterns stay in their range; hi-lo has two tones, the wail sweeps', () => {
  for (const p of /** @type {const} */ (['wail', 'yelp', 'hilo'])) {
    for (let t = 0; t < 8; t += 0.01) {
      const f = sirenPitch(p, t);
      assert.ok(f >= PATTERNS[p].lo - 1e-6 && f <= PATTERNS[p].hi + 1e-6, `${p} at ${t.toFixed(2)}: ${f}`);
    }
  }
  const tones = new Set();
  for (let t = 0; t < 3; t += 0.05) tones.add(sirenPitch('hilo', t));
  assert.equal(tones.size, 2);
  const wail = [];
  for (let t = 0; t < PATTERNS.wail.period; t += 0.1) wail.push(sirenPitch('wail', t));
  assert.ok(Math.max(...wail) - Math.min(...wail) > 600, 'the wail covers its range in one period');
});

test('Doppler raises a siren coming at you and lowers one going away', () => {
  assert.ok(doppler(1000, 30) > 1080);
  assert.ok(doppler(1000, -30) < 925);
  assert.equal(doppler(1000, 0), 1000);
});

test('a siren is loud beside you and silent past its range', () => {
  assert.ok(sirenGain(5) > 0.7);
  assert.ok(sirenGain(100) < sirenGain(20));
  assert.equal(sirenGain(SIREN_RANGE + 1), 0);
});

test('the nearest units with their bars on are heard, wail far, yelp close, hi-lo parked', () => {
  const player = { x: 0, z: 0, vx: 0, vz: 20, yaw: 0 };
  const units = [
    { id: 1, x: 0, z: -30, vx: 0, vz: 25, pursuit: 'chase', mode: 'drive' },
    { id: 2, x: 0, z: -200, vx: 0, vz: 25, pursuit: 'chase', mode: 'drive' },
    { id: 3, x: -40, z: 300, vx: 0, vz: 0, pursuit: false, mode: 'parked' },
    { id: 4, x: 0, z: -20, vx: 0, vz: 20, pursuit: false, mode: 'drive' },
    { id: 5, x: 0, z: -100, vx: 0, vz: 20, pursuit: 'chase', mode: 'wreck' },
    { id: 6, x: 0, z: -250, vx: 0, vz: 20, pursuit: 'search', mode: 'drive' },
  ];
  const v = sirenVoices(units, player, 1);
  assert.equal(v.length, SIREN_VOICES);
  assert.deepEqual(v.map((x) => x.key), [1, 2, 6], 'nearest first; a patrol and a wreck are silent; past three is not heard');
  assert.equal(v[0].pattern, 'yelp');
  assert.equal(v[1].pattern, 'wail');
  const parked = sirenVoices(units.filter((u) => u.id === 3), player, 1)[0];
  assert.equal(parked.pattern, 'hilo');
  assert.ok(parked.pan > 0.05, `a roadblock ahead on the right pans right (${parked.pan.toFixed(2)})`);
  const behind = sirenVoices([units[0]], player, 1)[0];
  assert.ok(behind.pitch > sirenPitch('yelp', 1 + 0.61) * 1.005, 'a unit gaining from behind sounds higher');
});

test('the rotor is heard to 900 m and louder overhead', () => {
  assert.ok(rotorSound(20, 0).gain > rotorSound(400, 0).gain);
  assert.equal(rotorSound(950, 0).gain, 0);
  assert.ok(rotorSound(100, 0).rate > 8);
});

test('a pursuit is the pursuit mood at once, even on the pass, and holds the music up', () => {
  const m = new MoodTracker();
  m.update(0.1, { kmh: 40, mountain: false, rival: Infinity, pursuit: true });
  assert.equal(m.mood, 'pursuit');
  for (let t = 0; t < 30; t += 0.25) m.update(0.25, { kmh: 40, mountain: true, rival: Infinity, pursuit: true });
  assert.equal(m.mood, 'pursuit', 'a chase on the pass is still a chase');
  const swell = new SpeedSwell();
  for (let t = 0; t < 20; t += 0.1) swell.update(0.1, { kmh: 0, mountain: false, rival: Infinity, pursuit: true });
  assert.ok(swell.level >= SWELL.pursuitFloor - 1e-6, 'standing still in a pursuit, the music stays up');
});
