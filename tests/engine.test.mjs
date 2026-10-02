import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EngineVoice, VOICES } from '../src/audio/engine-dsp.js';
import { CARS } from '../src/vehicles/specs.js';

const SR = 48000;

function render(voice, params, seconds = 1.5, skip = 0.5) {
  const v = new EngineVoice(SR, voice);
  v.set({ on: 1, ...params });
  const out = new Float32Array(Math.round(SR * seconds));
  v.process(out);
  return out.subarray(Math.round(SR * skip));
}

const rms = (a) => Math.sqrt(a.reduce((s, x) => s + x * x, 0) / a.length);
const peak = (a) => a.reduce((m, x) => Math.max(m, Math.abs(x)), 0);

function goertzel(a, f) {
  const w = (2 * Math.PI * f) / SR;
  const c = 2 * Math.cos(w);
  let s1 = 0;
  let s2 = 0;
  for (const x of a) {
    const s0 = x + c * s1 - s2;
    s2 = s1;
    s1 = s0;
  }
  return (Math.sqrt(s1 * s1 + s2 * s2 - c * s1 * s2) / a.length) * 2;
}

/** Energy on the engine-cycle harmonics against energy halfway between them. */
function lockRatio(a, rpm) {
  const fc = rpm / 120;
  let on = 0;
  let off = 0;
  for (let k = 1; k <= 24; k++) {
    on += goertzel(a, k * fc);
    off += goertzel(a, (k + 0.5) * fc);
  }
  return on / off;
}

test('every car spec has an engine voice with the right cylinder count', () => {
  for (const spec of CARS) {
    const voice = VOICES[spec.engine.voice];
    assert.ok(voice, `${spec.id} has no voice "${spec.engine.voice}"`);
    assert.equal(voice.cyl, spec.engine.cylinders, spec.id);
    assert.equal(voice.pattern.length, voice.cyl);
    assert.equal(voice.amps.length, voice.cyl);
  }
});

test('the note is locked to the rpm: the spectrum sits on the cycle harmonics', () => {
  for (const [voice, rpm] of [['boxer', 3200], ['v8', 2400], ['v12', 3600]]) {
    const a = render(voice, { rpm, load: 0.8 });
    const ratio = lockRatio(a, rpm);
    assert.ok(ratio > 2.5, `${voice} at ${rpm} rpm: harmonics only ${ratio.toFixed(2)}x the gaps`);
    const wrong = lockRatio(a, rpm * 1.37);
    assert.ok(ratio > wrong * 1.4, `${voice}: no clearer at the true rpm (${ratio.toFixed(2)}) than at a wrong one (${wrong.toFixed(2)})`);
  }
});

test('the smooth V12 fires evenly and the V8 and flat-four do not', () => {
  // Energy halfway between firing-rate harmonics: nothing for an even engine, a lot for a lumpy one.
  const lumpiness = (voice, rpm) => {
    const a = render(voice, { rpm, load: 0.9 });
    const fire = (rpm / 120) * VOICES[voice].cyl;
    const even = goertzel(a, fire) + goertzel(a, 2 * fire) + goertzel(a, 3 * fire);
    const half = goertzel(a, fire * 0.5) + goertzel(a, fire * 1.5) + goertzel(a, fire * 2.5);
    return half / even;
  };
  const v12 = lumpiness('v12', 3000);
  const v8 = lumpiness('v8', 3000);
  const boxer = lumpiness('boxer', 3000);
  assert.ok(v12 < 0.05, `v12 lumpiness ${v12.toFixed(3)}`);
  assert.ok(v8 > v12 * 4, `v8 ${v8.toFixed(3)} vs v12 ${v12.toFixed(3)}`);
  assert.ok(boxer > v12 * 4, `boxer ${boxer.toFixed(3)} vs v12 ${v12.toFixed(3)}`);
});

test('the firing rate follows the cylinder count', () => {
  // At the same rpm a V12 fires 1.5 times as often as a V8: its strongest line sits higher.
  const strongest = (voice, rpm) => {
    const fire = (rpm / 120) * VOICES[voice].cyl;
    let best = 0;
    let bestF = 0;
    for (let f = fire * 0.5; f <= fire * 1.1; f += rpm / 120 / 4) {
      const m = goertzel(render(voice, { rpm, load: 1 }), f);
      if (m > best) {
        best = m;
        bestF = f;
      }
    }
    return bestF;
  };
  assert.ok(strongest('v12', 3000) > strongest('v8', 3000) * 1.05);
});

test('more throttle is louder and brighter, and the level stays in range', () => {
  for (const voice of Object.keys(VOICES)) {
    const idle = render(voice, { rpm: 3000, load: 0.05 });
    const wot = render(voice, { rpm: 3000, load: 1 });
    assert.ok(rms(wot) > rms(idle) * 1.3, `${voice}: ${rms(wot).toFixed(3)} vs ${rms(idle).toFixed(3)}`);
    const bright = (a) => goertzel(a, 1400) + goertzel(a, 1900) + goertzel(a, 2600);
    assert.ok(bright(wot) > bright(idle), `${voice} should be brighter on throttle`);
    for (const rpm of [800, 4000, 8600]) {
      const a = render(voice, { rpm, load: 1 });
      assert.ok(peak(a) < 0.95, `${voice} ${rpm} rpm peaks at ${peak(a)}`);
      assert.ok(rms(a) > 0.04, `${voice} ${rpm} rpm is nearly silent`);
      assert.ok(a.every(Number.isFinite), `${voice} ${rpm} rpm produced NaN`);
    }
  }
});

test('the rev limiter chops the note and ignition off goes quiet', () => {
  const free = render('v8', { rpm: 6200, load: 1 });
  const cut = render('v8', { rpm: 6200, load: 1, limiter: 1 });
  assert.ok(rms(cut) < rms(free) * 0.9, `limiter ${rms(cut).toFixed(3)} vs ${rms(free).toFixed(3)}`);
  const off = render('v8', { rpm: 3000, load: 0.5, on: 0 }, 2, 1.5);
  assert.ok(rms(off) < 0.002, `ignition off still at ${rms(off)}`);
});

test('the turbo whistle appears as a sharp tone under boost', () => {
  // A quarter second window is 4 Hz wide per line, so a 2 Hz step cannot step over the tone.
  const sharpest = (a) => {
    const w = a.subarray(0, SR / 4);
    let best = 0;
    for (let f = 3000; f <= 5600; f += 2) best = Math.max(best, goertzel(w, f));
    return best;
  };
  const boosted = sharpest(render('boxer', { rpm: 5000, load: 1, boost: 1.2 }));
  const dry = sharpest(render('boxer', { rpm: 5000, load: 1, boost: 0 }));
  assert.ok(boosted > dry * 3, `whistle peak ${boosted.toFixed(4)} vs ${dry.toFixed(4)} without boost`);
  const v8 = sharpest(render('v8', { rpm: 5000, load: 1, boost: 1.2 }));
  assert.ok(boosted > v8 * 3, `the V8 has no turbo, but its peak is ${v8.toFixed(4)}`);
});

test('blow-off hisses and pops crack, then both die away', () => {
  const highBand = (a) => {
    let e = 0;
    for (let f = 7000; f <= 12000; f += 500) e += goertzel(a, f);
    return e;
  };
  for (const [event, call] of [['blow-off', (v) => v.triggerBov(1)], ['pop', (v) => v.triggerPop(1)]]) {
    const v = new EngineVoice(SR, 'boxer');
    v.set({ rpm: 2500, load: 0, on: 1 });
    v.process(new Float32Array(SR));
    call(v);
    const after = new Float32Array(SR);
    v.process(after);
    const head = after.subarray(0, 2400);
    const tail = after.subarray(SR - 2400);
    assert.ok(highBand(head) > highBand(tail) * 2, `${event}: ${highBand(head).toFixed(4)} then ${highBand(tail).toFixed(4)}`);
  }
});
