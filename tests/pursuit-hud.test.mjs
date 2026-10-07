import test from 'node:test';
import assert from 'node:assert/strict';
import { layoutPursuit } from '../src/ui/pursuit.js';

test('layoutPursuit returns null when view is null', () => {
  assert.equal(layoutPursuit(null), null);
});

test('layoutPursuit formats heat, pursuit state, evade bar and units', () => {
  const view = {
    state: 'pursuit',
    heat: 2,
    evade: 0.45,
    cooldown: 0,
    bust: 0,
    units: 3,
    heli: false,
    bounty: 15000,
    time: 75,
  };
  const res = layoutPursuit(view);
  assert.ok(res);
  assert.equal(res.state, 'pursuit');
  assert.equal(res.stateText, 'PURSUIT');
  assert.equal(res.heat, 2);
  assert.equal(res.barType, 'evade');
  assert.equal(res.barFill, 0.45);
  assert.equal(res.showBust, false);
  assert.equal(res.units, 3);
  assert.equal(res.heli, false);
  assert.equal(res.bountyText, '¥15,000');
  assert.equal(res.timeText, '01:15');
  assert.equal(res.isTerminal, false);
});

test('layoutPursuit formats cooldown state with cooldown bar and helicopter', () => {
  const view = {
    state: 'cooldown',
    heat: 4,
    evade: 1.0,
    cooldown: 0.65,
    bust: 0,
    units: 5,
    heli: true,
    bounty: 120500,
    time: 210,
  };
  const res = layoutPursuit(view);
  assert.ok(res);
  assert.equal(res.state, 'cooldown');
  assert.equal(res.stateText, 'COOLDOWN');
  assert.equal(res.heat, 4);
  assert.equal(res.barType, 'cooldown');
  assert.equal(res.barFill, 0.65);
  assert.equal(res.heli, true);
  assert.equal(res.timeText, '03:30');
});

test('layoutPursuit activates bust bar when bust > 0', () => {
  const view = {
    state: 'pursuit',
    heat: 3,
    evade: 0.2,
    cooldown: 0,
    bust: 0.85,
    units: 2,
    heli: false,
    bounty: 25000,
    time: 40,
  };
  const res = layoutPursuit(view);
  assert.ok(res);
  assert.equal(res.showBust, true);
  assert.equal(res.bustFill, 0.85);
});

test('layoutPursuit marks busted and escaped as terminal states', () => {
  const busted = layoutPursuit({
    state: 'busted',
    heat: 1,
    evade: 0,
    cooldown: 0,
    bust: 1.0,
    units: 1,
    heli: false,
    bounty: 5000,
    time: 12,
  });
  assert.ok(busted.isTerminal);
  assert.equal(busted.stateText, 'BUSTED');

  const escaped = layoutPursuit({
    state: 'escaped',
    heat: 5,
    evade: 1,
    cooldown: 1,
    bust: 0,
    units: 0,
    heli: false,
    bounty: 250000,
    time: 420,
  });
  assert.ok(escaped.isTerminal);
  assert.equal(escaped.stateText, 'ESCAPED');
});

test('layoutPursuit counts the scene, the units in sight, the units taken out and the helicopters, and the fine on a bust', () => {
  const res = layoutPursuit({
    state: 'busted', heat: 4, evade: 0, cooldown: 0, bust: 1, units: 6, heli: true, helis: 2, nearby: 3, disabled: 2,
    bounty: 52000, time: 200, report: { fine: 82000 },
  });
  assert.equal(res.units, 6);
  assert.equal(res.nearby, 3);
  assert.equal(res.destroyed, 2);
  assert.equal(res.helis, 2);
  assert.equal(res.fineText, '¥82,000');
  assert.equal(res.isTerminal, true);
  assert.equal(layoutPursuit({ state: 'pursuit', heat: 3, evade: 0, cooldown: 0, bust: 0, units: 1, heli: true, bounty: 0, time: 0 }).helis, 1, 'an old view with only `heli` shows one');
});
