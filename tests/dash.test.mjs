import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DASHES, gaugeScale, needleAngle } from '../src/vehicles/dash.js';
import { CARS } from '../src/vehicles/specs.js';

const types = (id) => DASHES[id].flatMap((p) => p.gauges.map((g) => g.type));

test('every playable car has its own dash with a tach and a speedometer in the cluster', () => {
  for (const car of CARS) {
    assert.ok(DASHES[car.id], `${car.id} has no dash`);
    const cluster = DASHES[car.id].find((p) => p.pod === 'cluster');
    assert.ok(cluster, `${car.id} has no cluster`);
    const t = cluster.gauges.map((g) => g.type);
    assert.ok(t.includes('tach') && t.includes('speed'), car.id);
  }
});

test('the dashes differ the way the cars do', () => {
  assert.deepEqual(types('rampart').sort(), ['speed', 'tach']);
  assert.ok(!types('vespera').includes('boost'));
  assert.ok(types('hayate').includes('boost') && types('tsurugi').includes('boost'));
  assert.deepEqual(DASHES.tsurugi.find((p) => p.pod === 'center').gauges.map((g) => g.type), ['boost', 'oil', 'volt']);
  for (const car of CARS) if (!car.engine.turbo) assert.ok(!types(car.id).includes('boost'), `${car.id} has no turbo`);
});

test('gauges in a pod do not overlap and fit inside it', () => {
  for (const [id, pods] of Object.entries(DASHES)) {
    for (const pod of pods) {
      for (const g of pod.gauges) {
        assert.ok(Math.abs(g.u) + g.r <= pod.w / 2 + 0.01 && Math.abs(g.v) + g.r <= pod.h / 2 + 0.01, `${id} ${g.type} spills out of its pod`);
      }
      for (let i = 0; i < pod.gauges.length; i++) {
        for (let j = i + 1; j < pod.gauges.length; j++) {
          const a = pod.gauges[i];
          const b = pod.gauges[j];
          assert.ok(Math.hypot(a.u - b.u, a.v - b.v) >= (a.r + b.r) * 1.02, `${id} ${a.type} overlaps ${b.type}`);
        }
      }
    }
  }
});

test('the tach ends within 1,000 rpm past the redline, never at the blow rpm', () => {
  for (const car of CARS) {
    const s = gaugeScale('tach', car);
    assert.ok(s.max > car.engine.redline && s.max <= car.engine.redline + 2000 && s.max < (car.engine.blowRpm ?? 11000), `${car.id} tach to ${s.max}`);
    assert.equal(s.red, car.engine.redline);
  }
});

test('needles sweep clockwise and stop at the ends of the scale', () => {
  const s = gaugeScale('speed', CARS[0]);
  let last = -Infinity;
  for (let v = s.min; v <= s.max; v += 10) {
    const a = needleAngle(s, v);
    assert.ok(a > last);
    last = a;
  }
  assert.equal(needleAngle(s, s.max * 3), needleAngle(s, s.max));
  assert.equal(needleAngle(s, -50), needleAngle(s, s.min));
  const f = gaugeScale('fuel', CARS[0]);
  assert.ok(Math.abs(needleAngle(f, 0.5)) < 1e-9, 'a half tank points straight up');
});
