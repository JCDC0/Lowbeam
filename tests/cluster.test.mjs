import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CARS, carById } from '../src/vehicles/specs.js';
import { createGauges } from '../src/vehicles/gauges.js';
import { blowRpmOf } from '../src/vehicles/thermal.js';
import { drawCluster, maxRpmOf, tachAngle, TACH_END } from '../src/ui/cluster.js';

/** Mock 2D canvas context for pure Node testing. */
function createMockContext() {
  const calls = [];
  const log = (fn) => (...args) => calls.push({ fn, args });
  return {
    calls,
    save: log('save'),
    restore: log('restore'),
    clearRect: log('clearRect'),
    translate: log('translate'),
    scale: log('scale'),
    beginPath: log('beginPath'),
    closePath: log('closePath'),
    arc: log('arc'),
    fill: log('fill'),
    stroke: log('stroke'),
    strokeRect: log('strokeRect'),
    fillRect: log('fillRect'),
    moveTo: log('moveTo'),
    lineTo: log('lineTo'),
    fillText: log('fillText'),
    createRadialGradient: () => ({ addColorStop: log('addColorStop') }),
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    shadowColor: '',
    shadowBlur: 0,
    textAlign: '',
    textBaseline: '',
    font: '',
  };
}

test('the tach scale is the redline plus 1,000 rounded up, and never reaches the blow rpm', () => {
  const expected = { hayate: 9000, rampart: 8000, vespera: 10000, tsurugi: 9000 };
  for (const car of CARS) {
    const max = maxRpmOf(car);
    const red = car.engine.redline;
    if (expected[car.id]) assert.equal(max, expected[car.id], car.id);
    assert.equal(max % 1000, 0, `${car.id} scale ends on a whole 1,000`);
    assert.ok(max >= red + 1000 && max < red + 2000, `${car.id} scale ${max} for redline ${red}`);
    assert.ok(max < blowRpmOf(car), `${car.id} scale ${max} reaches the blow rpm`);
  }
});

test('no tach numeral or band is drawn at or past the blow rpm', () => {
  for (const spec of CARS) {
    const gs = createGauges(spec);
    for (const cockpit of [false, true]) {
      const ctx = createMockContext();
      drawCluster(/** @type {*} */ (ctx), gs, spec, 0, 400, 300, cockpit);
      const top = maxRpmOf(spec) / 1000;
      const numerals = ctx.calls.filter((c) => c.fn === 'fillText' && /^\d+$/.test(c.args[0])).map((c) => Number(c.args[0]));
      assert.ok(numerals.includes(top), `${spec.id} shows its top numeral ${top}`);
      assert.ok(!numerals.includes(blowRpmOf(spec) / 1000), `${spec.id} draws the blow rpm numeral`);
      assert.ok(numerals.every((n) => n <= top), `${spec.id} numeral past the scale`);
    }
  }
});

test('the needle pins at the end stop past the scale and never wraps', () => {
  for (const spec of CARS) {
    const max = maxRpmOf(spec);
    assert.equal(tachAngle(max, spec), TACH_END);
    assert.equal(tachAngle(max + 500, spec), TACH_END);
    assert.equal(tachAngle(blowRpmOf(spec) + 4000, spec), TACH_END);
    assert.ok(tachAngle(max - 100, spec) < TACH_END);
    assert.ok(tachAngle(-300, spec) === tachAngle(0, spec));
  }
});

test('drawCluster renders both HUD and cockpit layouts for every car and gear 1..7', () => {
  for (const spec of CARS) {
    const gs = createGauges(spec);
    gs.gear = '7';
    gs.kmh = 120;
    gs.rpm = 9500;
    gs.temp = 116; // should trigger HOT lamp
    gs.overrev = 0.5;
    gs.damage = 0.4;
    gs.blown = true;

    // HUD mode: normal temp (90 C) displays TEMP
    gs.temp = 90;
    const ctxHudNorm = createMockContext();
    drawCluster(/** @type {*} */ (ctxHudNorm), gs, spec, 0.5, 400, 300, false);
    assert.ok(ctxHudNorm.calls.some((c) => c.fn === 'fillText' && c.args[0] === 'TEMP'), 'HUD should display TEMP dial');

    // HUD mode: hot temp (116 C) displays HOT lamp
    gs.temp = 116;
    const ctxHud = createMockContext();
    drawCluster(/** @type {*} */ (ctxHud), gs, spec, 0.5, 400, 300, false);
    assert.ok(ctxHud.calls.some((c) => c.fn === 'fillText' && c.args[0] === 'HOT'), 'HUD should display HOT when temp >= 115');
    assert.ok(ctxHud.calls.some((c) => c.fn === 'fillText' && c.args[0] === 'CHECK ENGINE'), 'HUD should display CHECK ENGINE when blown');

    // Cockpit mode (400x300 and 420x300)
    for (const [w, h] of [[400, 300], [420, 300]]) {
      const ctxCockpit = createMockContext();
      drawCluster(/** @type {*} */ (ctxCockpit), gs, spec, 0.5, w, h, true);
      assert.ok(ctxCockpit.calls.some((c) => c.fn === 'fillText' && c.args[0] === 'HOT'), 'Cockpit should display HOT when temp >= 115');
      assert.ok(ctxCockpit.calls.some((c) => c.fn === 'fillText' && c.args[0] === 'CHECK ENGINE'), 'Cockpit should display CHECK ENGINE when blown');
      assert.ok(ctxCockpit.calls.some((c) => c.fn === 'fillText' && c.args[0] === '7'), 'Cockpit gear box should render gear 7');
      assert.ok(ctxCockpit.calls.some((c) => c.fn === 'fillText' && c.args[0] === '120'), 'Cockpit should render speed');
    }
  }
});

test('CLUSTER_STYLES lists five styles and clusterStyleOf picks correctly', async () => {
  const { CLUSTER_STYLES, clusterStyleOf } = await import('../src/ui/cluster-styles.js');
  assert.deepEqual(CLUSTER_STYLES, ['classic', 'twin', 'sport', 'digital', 'vfd']);

  const mockSpec = { dash: { hud: 'sport' } };
  assert.equal(clusterStyleOf(/** @type {*} */ (mockSpec)), 'sport');
  assert.equal(clusterStyleOf(/** @type {*} */ (mockSpec), 'twin'), 'twin');
  assert.equal(clusterStyleOf(/** @type {*} */ (mockSpec), 'car'), 'sport');
  assert.equal(clusterStyleOf(/** @type {*} */ ({})), 'classic');
  assert.equal(clusterStyleOf(/** @type {*} */ ({ dash: {} })), 'classic');
});

test('warningLamps and shiftLightsLit evaluate correctly across gauge states', async () => {
  const { warningLamps, shiftLightsLit } = await import('../src/ui/cluster-styles.js');
  const spec = carById('hayate');
  const gs = createGauges(spec);

  // Normal running state
  let lamps = warningLamps(gs, 0);
  assert.equal(lamps.find((l) => l.label === 'CHECK').on, false);
  assert.equal(lamps.find((l) => l.label === 'DMG').on, false);
  assert.equal(lamps.find((l) => l.label === 'REV').on, false);
  assert.equal(lamps.find((l) => l.label === 'ENG OFF').on, false);
  assert.equal(lamps.find((l) => l.label === 'HOT').on, false);

  // Damaged, blown, engine off, overrev, hot
  gs.damage = 0.5;
  gs.blown = true;
  gs.engineOn = false;
  gs.overrev = 1.0;
  gs.temp = 120;
  lamps = warningLamps(gs, 0);
  assert.equal(lamps.find((l) => l.label === 'CHECK').on, true);
  assert.equal(lamps.find((l) => l.label === 'DMG').on, true);
  assert.equal(lamps.find((l) => l.label === 'REV').on, true);
  assert.equal(lamps.find((l) => l.label === 'ENG OFF').on, true);
  assert.equal(lamps.find((l) => l.label === 'HOT').on, true);

  // Shift lights
  gs.engineOn = true;
  gs.rpm = spec.engine.shiftUp * 0.7;
  assert.equal(shiftLightsLit(gs, spec, 5, 0), 0);
  gs.rpm = spec.engine.shiftUp * 0.9;
  assert.ok(shiftLightsLit(gs, spec, 5, 0) >= 2);
  gs.rpm = spec.engine.shiftUp;
  assert.equal(shiftLightsLit(gs, spec, 5, 0), 5);
  gs.shift = true;
  assert.equal(shiftLightsLit(gs, spec, 5, 0), 5);
});

test('drawStyled renders all styles without crashing', async () => {
  const { drawStyled, CLUSTER_STYLES } = await import('../src/ui/cluster-styles.js');
  for (const style of CLUSTER_STYLES) {
    if (style === 'classic') continue;
    for (const spec of CARS) {
      const gs = createGauges(spec);
      gs.kmh = 160;
      gs.rpm = spec.engine.redline - 500;
      gs.gear = '4';
      const ctx = createMockContext();
      drawStyled(/** @type {*} */ (ctx), style, gs, spec, 0.5);
      assert.ok(ctx.calls.length > 0, `${style} for ${spec.id} drew canvas operations`);
    }
  }
});

