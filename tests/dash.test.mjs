import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DASHES, gaugeScale, needleAngle, segmentsLit, tachZone } from '../src/vehicles/dash.js';
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

test('each car has its own kind of instruments: dials in four faces, an LCD and a VFD', () => {
  const cluster = (id) => DASHES[id].find((p) => p.pod === 'cluster');
  assert.equal(cluster('hayate').gauges.find((g) => g.type === 'tach').face, 'tuner', 'the tuner swapped in a racing tach');
  assert.ok(cluster('hayate').gauges.filter((g) => g.type !== 'tach').every((g) => !g.face || g.face === 'classic') && !cluster('hayate').screen);
  assert.ok(cluster('rampart').gauges.every((g) => g.face === 'white'));
  assert.equal(cluster('vespera').gauges.find((g) => g.type === 'tach').face, 'yellow');
  assert.equal(cluster('tsurugi').screen, 'lcd');
  assert.equal(cluster('hikari').screen, 'vfd');
  for (const car of CARS) assert.ok(car.dash && car.dash.hud, `${car.id} names its HUD cluster style`);
  assert.equal(new Set(CARS.map((c) => c.dash.hud)).size, CARS.length, 'every car has its own HUD style');
});

test('the bar graph tach lights segments in proportion and colors the redline red', () => {
  assert.equal(segmentsLit(0, 8000, 40), 0);
  assert.equal(segmentsLit(4000, 8000, 40), 20);
  assert.equal(segmentsLit(12000, 8000, 40), 40);
  const car = CARS.find((c) => c.id === 'hikari');
  const max = gaugeScale('tach', car).max;
  const zones = Array.from({ length: 40 }, (_, i) => tachZone(i, 40, max, car.engine.redline));
  assert.equal(zones[0], 'green');
  assert.equal(zones[39], 'red');
  assert.ok(zones.includes('amber'));
  assert.ok(zones.indexOf('amber') < zones.indexOf('red'));
});
