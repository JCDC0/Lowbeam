import test from 'node:test';
import assert from 'node:assert/strict';
import { VOICES, VOICE_OF, voiceOf, engineRpm, firing, trafficVoices, trafficGain, TRAFFIC_VOICES, TRAFFIC_RANGE } from '../src/audio/traffic-voices.js';
import { dyingSiren, sirenVoices, DIE_TIME } from '../src/audio/siren.js';
import { KINDS, RIVALS, UNIT_KINDS } from '../src/traffic/kinds.js';

const player = { x: 0, y: 0, z: 0, vx: 0, vz: 0, yaw: 0 };
const car = (id, kind, x, z, vx = 0, vz = 0, extra = {}) => ({ id, kind: { id: kind }, x, y: 0, z, vx, vz, mode: 'drive', ...extra });

test('every civilian kind has its own voice class, every racer and unit one too', () => {
  for (const k of KINDS) assert.ok(VOICES[VOICE_OF[k.id]], `${k.id} has a voice`);
  for (const k of [...RIVALS, ...UNIT_KINDS]) assert.ok(voiceOf(k.id), `${k.id} has a voice`);
  const classes = new Set(KINDS.map((k) => VOICE_OF[k.id]));
  assert.ok(classes.size >= 5, 'kei, sedan, van, diesel and bus at least');
});

test('revs idle at rest, climb through each gear, and never pass the redline', () => {
  for (const v of Object.values(VOICES)) {
    assert.equal(engineRpm(v, 0), v.idle);
    let max = 0;
    for (let s = 0; s <= v.top * 1.5; s += 0.5) max = Math.max(max, engineRpm(v, s));
    assert.ok(max <= v.redline, 'under the redline');
    const span = v.top / v.gears;
    assert.ok(engineRpm(v, span * 0.9) > engineRpm(v, span * 0.2), 'first gear pulls up');
  }
});

test('a bus at 40 grumbles far below a street racer at 250', () => {
  const bus = firing(VOICES.bus, engineRpm(VOICES.bus, 40 / 3.6));
  const racer = firing(VOICES.racer, engineRpm(VOICES.racer, 250 / 3.6));
  assert.ok(racer > bus * 2.5, `racer ${racer.toFixed(0)} Hz, bus ${bus.toFixed(0)} Hz`);
  const kei = firing(VOICES.kei, engineRpm(VOICES.kei, 0));
  const truck = firing(VOICES.diesel, engineRpm(VOICES.diesel, 0));
  assert.ok(kei < 40 && truck < 40, 'idles are a low rumble');
});

test('a car coming at the player sounds higher than the same car going away, and is panned to its side', () => {
  const coming = trafficVoices([car(1, 'sedan', 0, 20, 0, -25)], player)[0];
  const going = trafficVoices([car(1, 'sedan', 0, 20, 0, 25)], player)[0];
  assert.ok(coming.pitch > going.pitch * 1.1);
  const left = trafficVoices([car(2, 'sedan', 10, 0)], player)[0];
  const right = trafficVoices([car(3, 'sedan', -10, 0)], player)[0];
  assert.ok(left.pan < -0.5 && right.pan > 0.5, 'the car at +x (the left of a player facing +z) pans left');
});

test('only the nearest cars on the same level are heard; wrecks are silent', () => {
  const agents = [
    car(1, 'sedan', 0, 5), car(2, 'kei', 0, 12), car(3, 'bus', 0, 30), car(4, 'truck', 0, 40), car(5, 'van', 0, 50),
    car(6, 'sedan', 0, 3, 0, 0, { mode: 'wreck' }), { ...car(7, 'sedan', 0, 2), y: 12 }, car(8, 'sedan', 0, TRAFFIC_RANGE + 5),
  ];
  const v = trafficVoices(agents, player);
  assert.equal(v.length, TRAFFIC_VOICES);
  assert.deepEqual(v.map((x) => x.key), [1, 2, 3, 4]);
  assert.ok(trafficGain(2) > trafficGain(30) && trafficGain(TRAFFIC_RANGE) === 0);
});

test('a destroyed unit siren winds down over DIE_TIME, then is gone', () => {
  let last = Infinity;
  for (let a = 0; a <= DIE_TIME; a += 0.1) {
    const d = dyingSiren(a);
    assert.ok(d.pitch < last);
    last = d.pitch;
  }
  assert.ok(dyingSiren(DIE_TIME).level < 1e-6);
  const unit = { id: 9, x: 0, z: 30, vx: 0, vz: 0, mode: 'wreck', destroyed: true, pursuit: false, wreckAge: 0.3 };
  const v = sirenVoices([unit], player, 0);
  assert.equal(v.length, 1);
  assert.equal(v[0].pattern, 'die');
  assert.equal(sirenVoices([{ ...unit, wreckAge: DIE_TIME + 0.1 }], player, 0).length, 0);
  assert.equal(sirenVoices([{ ...unit, destroyed: false }], player, 0).length, 0, 'an ordinary wreck stays silent');
});
