import test from 'node:test';
import assert from 'node:assert/strict';
import { layoutPursuit, clockText, lostKinds, risenKinds, iconStep, LEAVE_DELAY } from '../src/ui/pursuit.js';

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

test('layoutPursuit lays out Jc\'s sketch: the units by kind, assigned and destroyed', () => {
  const view = { state: 'pursuit', heat: 3, evade: 0.2, cooldown: 0, bust: 0, units: 7, heli: true, helis: 1, bounty: 9000, time: 30, disabled: 4, byKind: { police: 4, 'police-fast': 2, 'police-int': 1 }, assigned: 52 };
  const l = layoutPursuit(view);
  assert.deepEqual(l.kinds.map((k) => k.kind), ['police', 'police-fast', 'police-int', 'police-heavy']);
  assert.deepEqual(l.kinds.map((k) => k.n), [4, 2, 1, 0]);
  assert.equal(l.assignedText, '52');
  assert.equal(l.destroyedText, '4');
  assert.equal(l.helis, 1);
  assert.equal(layoutPursuit({ ...view, assigned: undefined, byKind: undefined }).assignedText, '--', 'a dash until the director keeps the pool');
  assert.equal(layoutPursuit({ ...view, reinforcements: true }).reinforcements, true);
});

test('counts are plain numbers: a destroyed tally of none reads 0, not 00', () => {
  const base = { state: 'pursuit', heat: 1, evade: 0, cooldown: 0, bust: 0, units: 0, heli: false, bounty: 0, time: 0 };
  assert.equal(layoutPursuit(base).destroyedText, '0');
  assert.equal(layoutPursuit({ ...base, disabled: 12 }).destroyedText, '12');
  assert.equal(layoutPursuit({ ...base, disabled: 140 }).destroyedText, '99', 'two digits at most');
});

test('an icon is seen once its kind has been in sight; an old view counts a kind with units as seen', () => {
  const view = { state: 'pursuit', heat: 3, evade: 0, cooldown: 0, bust: 0, units: 3, heli: true, helis: 1, bounty: 0, time: 0, byKind: { police: 3, 'police-fast': 0, 'police-int': 0, 'police-heavy': 0 } };
  const old = layoutPursuit(view);
  assert.deepEqual(old.kinds.map((k) => k.seen), [true, false, false, false]);
  assert.equal(old.heliSeen, true);
  const l = layoutPursuit({ ...view, seen: ['police', 'police-heavy'] });
  assert.deepEqual(l.kinds.map((k) => k.seen), [true, false, false, true], 'a seen kind with no units left still shows, at 0');
  assert.deepEqual(l.kinds.map((k) => k.n), [3, 0, 0, 0]);
  assert.equal(l.heliSeen, false, 'a helicopter overhead that has not been in sight stays hidden');
  assert.equal(layoutPursuit({ ...view, seen: ['heli'] }).heliSeen, true);
});

test('the resupply clock reads seconds and hundredths and drains its bar over a minute', () => {
  assert.equal(clockText(60), '60:00');
  assert.equal(clockText(12.345), '12:34');
  assert.equal(clockText(36.9), '36:90', 'a float that is a hair under 36.9 still reads 90');
  assert.equal(clockText(1.07), '01:07');
  assert.equal(clockText(0.009), '00:00');
  assert.equal(clockText(-3), '00:00');
  const base = { state: 'pursuit', heat: 2, evade: 0, cooldown: 0, bust: 0, units: 1, heli: false, bounty: 0, time: 0 };
  assert.equal(layoutPursuit(base).resupply, null, 'no clock until the backend sends one');
  const r = layoutPursuit({ ...base, resupply: 45 }).resupply;
  assert.equal(r.text, '45:00');
  assert.equal(r.fill, 0.75);
  assert.equal(layoutPursuit({ ...base, resupply: 0 }).resupply.fill, 0, 'an arrived clock is an empty bar');
  assert.equal(layoutPursuit({ ...base, resupply: 90 }).resupply.fill, 1, 'the bar never overfills');
});

test('a destroyed unit glitches its own icon, and a unit that left does not', () => {
  const at = (n, destroyed) => ({ destroyed, kinds: [{ kind: 'police', n: n[0] }, { kind: 'police-fast', n: n[1] }, { kind: 'police-int', n: n[2] }, { kind: 'police-heavy', n: n[3] }] });
  assert.deepEqual(lostKinds(at([3, 1, 0, 0], 0), at([2, 1, 0, 0], 1)), ['police']);
  assert.deepEqual(lostKinds(at([3, 1, 1, 0], 0), at([2, 0, 1, 0], 2)), ['police', 'police-fast'], 'two at once glitch two icons');
  assert.deepEqual(lostKinds(at([3, 1, 0, 0], 1), at([2, 1, 0, 0], 1)), [], 'the tally did not rise: they went home');
  assert.deepEqual(lostKinds(at([2, 1, 0, 0], 1), at([3, 1, 0, 0], 1)), [], 'a unit arriving is not a loss');
  assert.deepEqual(lostKinds(null, at([2, 1, 0, 0], 1)), [], 'nothing to compare on the first frame');
});

test('an icon comes in when its kind is seen and has units, rests at 0, leaves, and comes back with units', () => {
  const out = { in: false, zero: 0 };
  assert.equal(iconStep(out, false, 3, 0.1).in, false, 'units not yet in sight bring no icon');
  assert.equal(iconStep(out, true, 0, 0.1).in, false, 'a seen kind with no units has no icon to show');
  let s = iconStep(out, true, 3, 0.1);
  assert.equal(s.in, true);
  assert.equal(iconStep(s, false, 3, 0.1).in, true, 'once in, it stays while the kind has units, seen or not');
  s = iconStep(s, true, 0, LEAVE_DELAY / 2);
  assert.equal(s.in, true, 'it rests at 0 while the glitch plays');
  s = iconStep(s, true, 0, LEAVE_DELAY / 2);
  assert.equal(s.in, false, 'then it leaves and the row closes up');
  assert.equal(iconStep(s, true, 0, 5).in, false, 'it does not come back by itself');
  assert.equal(iconStep(s, true, 2, 0.1).in, true, 'a seen kind that returns with units does');
  assert.equal(iconStep({ in: true, zero: LEAVE_DELAY * 0.9 }, true, 1, 0.1).zero, 0, 'a unit arriving cancels the leaving');
});

test('reinforcements added under their symbols are the counts that rose', () => {
  const at = (n, helis) => ({ helis, kinds: [{ kind: 'police', n: n[0] }, { kind: 'police-fast', n: n[1] }, { kind: 'police-int', n: n[2] }, { kind: 'police-heavy', n: n[3] }] });
  assert.deepEqual(risenKinds(at([1, 0, 0, 0], 0), at([3, 1, 0, 0], 0)), ['police', 'police-fast']);
  assert.deepEqual(risenKinds(at([3, 1, 0, 0], 1), at([3, 1, 0, 0], 2)), ['heli']);
  assert.deepEqual(risenKinds(at([3, 1, 0, 0], 1), at([2, 1, 0, 0], 1)), [], 'a count that fell is not a rise');
  assert.deepEqual(risenKinds(null, at([3, 1, 0, 0], 1)), [], 'the first frame has nothing to compare');
});

test('a helicopter that needs fuel is low, then leaving, and nothing otherwise', () => {
  const base = { state: 'pursuit', heat: 3, evade: 0, cooldown: 0, bust: 0, units: 1, heli: true, helis: 1, bounty: 0, time: 0 };
  assert.equal(layoutPursuit(base).fuel, null);
  assert.equal(layoutPursuit({ ...base, heliFuel: 'low' }).fuel, 'low');
  assert.equal(layoutPursuit({ ...base, heliFuel: 'leaving' }).fuel, 'leaving');
  assert.equal(layoutPursuit({ ...base, heliFuel: 'full' }).fuel, null, 'an unknown state shows nothing');
});
