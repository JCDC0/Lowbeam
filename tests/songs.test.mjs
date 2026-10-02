import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TRACKS, LAYERS, MINOR, composeTrack, degreeNote } from '../src/audio/songs.js';
import { speedMix } from '../src/audio/music.js';

const ids = Object.keys(TRACKS);

test('composing is deterministic: the same track twice gives the same notes', () => {
  for (const id of ids) assert.deepEqual(composeTrack(id), composeTrack(id), id);
});

test('every track has every layer, in range, inside the loop', () => {
  for (const id of ids) {
    const t = composeTrack(id);
    assert.equal(t.loopBeats, t.bars * 4);
    for (const layer of LAYERS) {
      if (layer === 'perc' && !TRACKS[id].drums.perc) continue;
      assert.ok(t.events.some((e) => e.layer === layer), `${id} has no ${layer}`);
    }
    for (const e of t.events) {
      assert.ok(e.t >= 0 && e.t + 1e-9 < t.loopBeats, `${id} ${e.layer} starts at ${e.t} outside the loop`);
      assert.ok(e.vel > 0 && e.vel <= 1.01, `${id} ${e.layer} velocity ${e.vel}`);
      assert.ok(e.dur > 0, `${id} ${e.layer} duration ${e.dur}`);
      assert.ok(Number.isInteger(e.midi) && e.midi >= 24 && e.midi <= 96, `${id} ${e.layer} note ${e.midi}`);
    }
  }
});

test('pitched layers stay in the key of the track', () => {
  for (const id of ids) {
    const def = TRACKS[id];
    const t = composeTrack(id);
    const inKey = new Set(MINOR.map((n) => (def.root + n) % 12));
    for (const e of t.events) {
      if (!['pad', 'bass', 'arp', 'lead'].includes(e.layer)) continue;
      if (e.layer === 'bass' && !inKey.has(e.midi % 12)) assert.fail(`${id} bass ${e.midi} is out of key`);
      assert.ok(inKey.has(e.midi % 12), `${id} ${e.layer} note ${e.midi} (pitch class ${e.midi % 12}) is not in the scale`);
    }
  }
});

test('the bass plays the chord root on the first beat of every bar', () => {
  for (const id of ids) {
    const def = TRACKS[id];
    const t = composeTrack(id);
    for (let bar = 0; bar < t.bars; bar++) {
      const d = def.progression[bar % def.progression.length];
      const rootClass = degreeNote(def.root, MINOR, d) % 12;
      const first = t.events.find((e) => e.layer === 'bass' && Math.abs(e.t - bar * 4) < 1e-9);
      if (def.bass === 'offbeat' || def.bass === 'rolling' || def.bass === 'gallop' || def.bass === 'pedal') assert.ok(first, `${id} bar ${bar} has no bass on beat one`);
      assert.equal(first.midi % 12, rootClass, `${id} bar ${bar}: bass ${first.midi} is not the chord root`);
    }
  }
});

test('the lead is one voice at a time and ends its phrases on a chord tone', () => {
  for (const id of ids) {
    const t = composeTrack(id);
    const lead = t.events.filter((e) => e.layer === 'lead');
    assert.ok(lead.length >= 8, `${id} lead has only ${lead.length} notes`);
    for (let i = 1; i < lead.length; i++) assert.ok(lead[i].t >= lead[i - 1].t + lead[i - 1].dur - 1e-6, `${id} lead notes overlap at beat ${lead[i].t}`);
    const leaps = lead.slice(1).map((e, i) => Math.abs(e.midi - lead[i].midi));
    assert.ok(Math.max(...leaps) <= 12, `${id} lead leaps ${Math.max(...leaps)} semitones`);
    assert.ok(leaps.reduce((a, b) => a + b, 0) / leaps.length < 4.2, `${id} lead jumps around too much`);
    const def = TRACKS[id];
    const barsPer = def.progression.length;
    for (let p = 0; p < def.loops; p++) {
      const lastBar = (p + 1) * barsPer - 1;
      const inBar = lead.filter((e) => e.t >= lastBar * 4 && e.t < lastBar * 4 + 4);
      assert.ok(inBar.length > 0, `${id} phrase ${p} has no ending`);
      const d = def.progression[lastBar % barsPer];
      const tones = new Set([0, 2, 4, 6].map((o) => degreeNote(def.root, MINOR, d + o) % 12));
      assert.ok(tones.has(inBar[inBar.length - 1].midi % 12), `${id} phrase ${p} ends off the chord`);
    }
  }
});

test('the drums sit on the sixteenth grid and the tracks differ in tempo', () => {
  for (const id of ids) {
    const t = composeTrack(id);
    for (const e of t.events) if (['kick', 'snare', 'hat'].includes(e.layer)) assert.ok(Math.abs(e.t * 4 - Math.round(e.t * 4)) < 1e-9, `${id} ${e.layer} off the grid at ${e.t}`);
    assert.ok(t.events.filter((e) => e.layer === 'kick').length >= t.bars * 2, `${id} kick too sparse`);
  }
  assert.equal(new Set(ids.map((id) => TRACKS[id].bpm)).size, ids.length);
});

test('the music builds with speed: pads and bass parked, the lead only when fast', () => {
  assert.equal(speedMix('pad', 0), 1);
  assert.ok(speedMix('bass', 0) > 0.4 && speedMix('bass', 0) < 0.7);
  for (const l of ['arp', 'hat', 'kick', 'snare', 'perc', 'lead']) assert.equal(speedMix(l, 0), 0, `${l} should be silent when parked`);
  for (const l of LAYERS) assert.equal(speedMix(l, 160), 1, `${l} should be full at 160 km/h`);
  assert.ok(speedMix('arp', 20) > 0.5 && speedMix('kick', 20) === 0, 'the arpeggio comes before the drums');
  assert.ok(speedMix('kick', 60) > 0.9 && speedMix('lead', 60) === 0, 'the drums come before the lead');
  for (const l of LAYERS) {
    let last = 0;
    for (let kmh = 0; kmh <= 200; kmh += 5) {
      const v = speedMix(l, kmh);
      assert.ok(v >= last - 1e-9 && v >= 0 && v <= 1, `${l} is not monotonic at ${kmh}`);
      last = v;
    }
  }
});
