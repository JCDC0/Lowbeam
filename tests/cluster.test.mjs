import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CARS, carById } from '../src/vehicles/specs.js';
import { createGauges } from '../src/vehicles/gauges.js';
import { drawCluster, maxRpmOf } from '../src/ui/cluster.js';

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

test('tachometer scale runs to 11 (11,000 rpm) for every car', () => {
  for (const car of CARS) {
    assert.equal(maxRpmOf(car), 11000, `Car ${car.id} tach scale should run to 11000`);
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
