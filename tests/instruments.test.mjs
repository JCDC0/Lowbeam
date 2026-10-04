import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CARS } from '../src/vehicles/specs.js';
import { createGauges } from '../src/vehicles/gauges.js';
import { dialAngle, gaugeScale } from '../src/vehicles/dash.js';
import { paintDial, paintScreen, readingOf } from '../src/vehicles/instruments.js';
import { CLUSTER_STYLES, drawStyled } from '../src/ui/cluster-styles.js';

/** A 2D context that records every call and accepts any property. */
function mockContext() {
  const calls = [];
  const props = {};
  return new Proxy(props, {
    get(_, key) {
      if (key === 'calls') return calls;
      if (key in props) return props[key];
      if (key === 'createRadialGradient' || key === 'createLinearGradient') return () => ({ addColorStop() {} });
      return (...args) => calls.push({ fn: key, args });
    },
    set(_, key, value) {
      props[key] = value;
      return true;
    },
  });
}

const texts = (ctx) => ctx.calls.filter((c) => c.fn === 'fillText').map((c) => String(c.args[0]));

test('a numbered dial face shows every tach numeral up to its scale and none past it', () => {
  for (const spec of CARS) {
    const ctx = mockContext();
    paintDial(/** @type {*} */ (ctx), 80, 80, 80, 'tach', spec, 'white');
    const top = gaugeScale('tach', spec).max / 1000;
    const nums = texts(ctx).filter((t) => /^\d+$/.test(t)).map(Number);
    for (let n = 0; n <= top; n++) assert.ok(nums.includes(n), `${spec.id} shows ${n}`);
    assert.ok(nums.every((n) => n <= top), `${spec.id} ${nums}`);
    const plain = mockContext();
    paintDial(/** @type {*} */ (plain), 64, 64, 64, 'tach', spec, 'classic');
    assert.equal(texts(plain).length, 0, 'the classic face has no numerals');
  }
});

test('both screens draw the speed and the gear from the gauges', () => {
  for (const kind of /** @type {const} */ (['lcd', 'vfd'])) {
    const spec = CARS[0];
    const g = createGauges(spec);
    Object.assign(g, { kmh: 212.6, rpm: 6000, gear: '5' });
    const ctx = mockContext();
    paintScreen(/** @type {*} */ (ctx), kind, 320, 128, readingOf(g, spec, 0), spec);
    assert.ok(texts(ctx).includes('213'), kind);
    assert.ok(texts(ctx).includes('5'), kind);
  }
});

test('every HUD style shows the gear, the digital ones the speed, and no tach numeral past its scale', () => {
  for (const style of CLUSTER_STYLES.filter((s) => s !== 'classic')) {
    for (const spec of CARS) {
      const g = createGauges(spec);
      Object.assign(g, { kmh: 187.4, rpm: spec.engine.redline - 200, gear: '4' });
      const ctx = mockContext();
      drawStyled(/** @type {*} */ (ctx), style, g, spec, 0);
      const t = texts(ctx);
      assert.ok(t.includes('4'), `${style} ${spec.id} shows the gear`);
      if (style !== 'twin') assert.ok(t.includes('187'), `${style} ${spec.id} shows the speed in digits`);
      const top = gaugeScale('tach', spec).max / 1000;
      const past = t.filter((s) => /^\d+$/.test(s) && Number(s) > top && Number(s) < 40);
      assert.equal(past.length, 0, `${style} ${spec.id} tach numerals ${past}`);
    }
  }
});

test("the racing tach parks its needle straight down and sweeps to 3 o'clock", () => {
  const sc = gaugeScale('tach', CARS[0]);
  assert.equal(dialAngle(sc, 0, 'tuner'), Math.PI);
  assert.ok(Math.abs(dialAngle(sc, sc.max, 'tuner') - Math.PI * 2.5) < 1e-9);
  assert.equal(dialAngle(sc, sc.max * 2, 'tuner'), dialAngle(sc, sc.max, 'tuner'));
  const ctx = mockContext();
  paintDial(/** @type {*} */ (ctx), 96, 96, 96, 'tach', CARS[0], 'tuner');
  const t = texts(ctx);
  assert.ok(t.includes('RPM') && t.includes('X1000') && t.includes('km/h'));
  for (let n = 0; n <= sc.max / 1000; n++) assert.ok(t.includes(String(n)), `numeral ${n}`);
});
