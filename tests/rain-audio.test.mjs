import test from 'node:test';
import assert from 'node:assert/strict';
import { rainGains } from '../src/audio/rain.js';
import { trafficVoices } from '../src/audio/traffic-voices.js';
import { EngineVoice } from '../src/audio/engine-dsp.js';
import { CARS } from '../src/vehicles/specs.js';

const player = { x: 0, y: 0, z: 0, vx: 0, vz: 0, yaw: 0 };
const car = (id, kind, x, z, vx = 0, vz = 0) => ({ id, kind: { id: kind }, x, y: 0, z, vx, vz, mode: 'drive' });

test('rainGains is zero when dry and grows with the level', () => {
  const dry = rainGains(0);
  assert.equal(dry.bed, 0);
  assert.equal(dry.patter, 0);
  assert.equal(dry.roof, 0);
  assert.equal(dry.wetTire, 0);

  const drizzle = rainGains(0.35);
  const rain = rainGains(0.7);
  const storm = rainGains(1.0);

  assert.ok(drizzle.bed > 0, 'drizzle bed is audible');
  assert.ok(rain.bed > drizzle.bed, 'rain bed is louder than drizzle');
  assert.ok(storm.bed > rain.bed, 'storm bed is louder than rain');
  assert.ok(rain.filterFreq > drizzle.filterFreq, 'filter opens with rain level');
  assert.ok(storm.filterFreq > rain.filterFreq, 'filter opens further in storm');
});

test('under a roof the rain bed drops and roof drumming replaces it', () => {
  const open = rainGains(1.0, { underRoof: false });
  const sheltered = rainGains(1.0, { underRoof: true });

  assert.ok(sheltered.bed < open.bed * 0.15, 'rain bed drops by about 88%');
  assert.ok(sheltered.roof > 0.1, 'roof drumming is active');
  assert.equal(open.roof, 0, 'open sky has no roof drumming');
  assert.equal(sheltered.patter, 0, 'direct car patter is suppressed under a roof');
});

test('patter rises when the car stops and dies with speed', () => {
  const stopped = rainGains(0.7, { speed: 0 });
  const slow = rainGains(0.7, { speed: 5 });
  const moderate = rainGains(0.7, { speed: 12 });
  const fast = rainGains(0.7, { speed: 25 });

  assert.ok(stopped.patter > slow.patter, 'patter is loudest when stopped');
  assert.ok(slow.patter > moderate.patter, 'patter decreases with speed');
  assert.equal(fast.patter, 0, 'patter dies at higher speeds');
});

test('wet hiss and filter shift in trafficVoices', () => {
  const agent = car(1, 'sedan', 0, 20, 0, 20);
  const dryVoice = trafficVoices([agent], player, 0)[0];
  const wetVoice = trafficVoices([agent], player, 1.0)[0];

  assert.equal(dryVoice.tireFilter, 900, 'dry tire filter is 900 Hz');
  assert.ok(wetVoice.tireFilter > 2000, 'wet tire filter shifts higher for hiss');
  assert.ok(wetVoice.tire > dryVoice.tire * 1.5, 'wet tires produce more noise from hiss');
});

test('trafficVoices skips roadblock barriers', () => {
  const barrier = { ...car(2, 'sedan', 0, 15, 0, 0), barrier: true, mode: 'parked' };
  const normalCar = car(3, 'sedan', 0, 20, 0, 20);
  const voices = trafficVoices([barrier, normalCar], player, 0);
  assert.equal(voices.length, 1, 'only the normal car is heard');
  assert.equal(voices[0].key, 3, 'barrier is skipped');
});

test('rain bed sits clearly under the engine at idle', () => {
  const SR = 48000;
  for (const spec of CARS) {
    const v = new EngineVoice(SR, spec.engine.voice);
    v.set({ on: 1, rpm: spec.engine.idle, load: 0.04 });
    const out = new Float32Array(SR);
    v.process(out);
    const idleRms = Math.sqrt(out.reduce((s, x) => s + x * x, 0) / out.length);

    const storm = rainGains(1.0);
    // Filtered pink noise bed amplitude has RMS approximately 0.25 * bed gain.
    const rainBedRms = storm.bed * 0.25;

    assert.ok(idleRms > 0.04, `${spec.id} idle voice produces measurable sound`);
    assert.ok(rainBedRms < idleRms, `rain bed (${rainBedRms.toFixed(3)}) sits under ${spec.id} idle (${idleRms.toFixed(3)})`);
  }
});

test('dry audio does not change', () => {
  const dryGains = rainGains(0);
  assert.equal(dryGains.bed, 0);
  assert.equal(dryGains.patter, 0);
  assert.equal(dryGains.roof, 0);
  assert.equal(dryGains.wetTire, 0);

  const agent = car(1, 'sedan', 0, 15, 0, 15);
  const vDefault = trafficVoices([agent], player)[0];
  const vZero = trafficVoices([agent], player, 0)[0];

  assert.equal(vDefault.tire, vZero.tire);
  assert.equal(vDefault.gain, vZero.gain);
  assert.equal(vDefault.cutoff, vZero.cutoff);
  assert.equal(vDefault.pitch, vZero.pitch);
  assert.equal(vZero.tireFilter, 900);
});
