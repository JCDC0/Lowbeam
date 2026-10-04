import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Pursuit, INFRACTIONS } from '../src/race/pursuit.js';

/** Steps a pursuit with a constant world, collecting the events it returns. */
function run(p, seconds, world = {}, dt = 1 / 30) {
  const events = [];
  for (let t = 0; t < seconds; t += dt) events.push(...p.update(dt, world));
  return events;
}

test('a fresh pursuit is not yet a pursuit for the HUD', () => {
  const p = new Pursuit();
  assert.equal(p.view(), null, 'no units means nothing on screen');
  p.setHeat(2, false);
  p.update(1 / 30, { units: 1, seen: true });
  const v = p.view();
  assert.ok(v, 'once a unit is involved the HUD has something to show');
  assert.equal(v.state, 'pursuit');
  assert.equal(v.heat, 2);
  assert.equal(v.units, 1);
});

test('going out of sight starts the evade bar, and it fills faster at low heat', () => {
  const cold = new Pursuit();
  cold.setHeat(1);
  run(cold, 2, { units: 2, seen: false });
  const hot = new Pursuit();
  hot.setHeat(5);
  run(hot, 2, { units: 2, seen: false });
  assert.equal(cold.pstate, 'evading');
  assert.ok(cold.evade > 0, 'the evade bar fills while out of sight');
  assert.ok(cold.evade > hot.evade, 'low heat fills faster than high heat');
});

test('a full evade bar starts the cooldown, and the helicopter counts as seeing you', () => {
  const p = new Pursuit();
  p.setHeat(1);
  // Out of sight just long enough to fill the evade bar at heat 1 (about 8 s) and slip into
  // the search, but not so long the cooldown also completes and it escapes.
  const ev = run(p, 10, { units: 2, seen: false });
  assert.equal(p.pstate, 'cooldown', 'the pursuit became a search');
  assert.ok(ev.some((e) => e.type === 'cooldown'), 'and it announced the cooldown');
  // The helicopter seeing you drops it straight back into pursuit.
  p.update(1 / 30, { units: 1, seen: true, heli: true });
  assert.equal(p.pstate, 'pursuit', 'the air unit spotted you again');
});

test('the cooldown fills over time, faster while hiding, and ends in escaped', () => {
  const p = new Pursuit();
  p.setHeat(1);
  run(p, 10, { units: 2, seen: false });
  assert.equal(p.pstate, 'cooldown');
  const ev = run(p, 20, { units: 2, seen: false });
  assert.equal(p.pstate, 'escaped');
  const end = ev.find((e) => e.type === 'escaped');
  assert.ok(end, 'it announced the escape');
  assert.ok(end.report.fine === 0, 'an escape costs nothing');
  assert.equal(p.result().result, 'escaped');
});

test('hiding fills the cooldown three times faster', () => {
  const open = new Pursuit();
  open.setHeat(1);
  run(open, 10, { units: 2, seen: false });
  const hidden = new Pursuit();
  hidden.setHeat(1);
  // Evade fills in about 8 s, then a hidden cooldown finishes 3 times sooner (4 s): about 12 s.
  run(hidden, 14, { units: 2, seen: false, hiding: true });
  assert.equal(open.pstate, 'cooldown');
  assert.equal(hidden.pstate, 'escaped', 'a hideout gets you out three times sooner');
});

test('the search starts at the last known position and widens as it goes on', () => {
  const p = new Pursuit();
  p.setHeat(1);
  p.lastSeen(100, -200);
  assert.equal(p.last.x, 100);
  assert.equal(p.last.z, -200);
  const narrow = p.last.r;
  run(p, 60, { units: 2, seen: false });
  run(p, 4, { units: 2, seen: false });
  assert.ok(p.last.r > narrow, 'the search widens with time');
  assert.equal(p.last.x, 100, 'but stays centered on where they lost you');
});

test('stopping with a unit on you fills the bust bar and ends in busted', () => {
  const p = new Pursuit();
  p.setHeat(2);
  const ev = run(p, 5, { units: 1, seen: true, speed: 0 });
  const bust = ev.find((e) => e.type === 'busted');
  assert.ok(bust, 'the pursuit ended in a bust');
  assert.ok(bust.fine > 30000, 'the fine is the bounty plus thirty thousand');
  assert.equal(p.result().result, 'busted');
});

test('moving away empties the bust bar', () => {
  const p = new Pursuit();
  p.setHeat(2);
  run(p, 1.5, { units: 1, seen: true, speed: 0 });
  const part = p.bust;
  assert.ok(part > 0, 'the bust bar started filling');
  run(p, 2, { units: 1, seen: true, speed: 30 });
  assert.equal(p.bust, 0, 'driving off empties it again');
  assert.equal(p.pstate, 'pursuit', 'and you are not caught yet');
});

test('a fast car alongside you does not fill the bust bar', () => {
  const p = new Pursuit();
  p.setHeat(2);
  run(p, 5, { units: 1, seen: true, speed: 25 });
  assert.equal(p.bust, 0, 'you only get busted when you stop');
});

test('each infraction fires once per pursuit and adds bounty', () => {
  const p = new Pursuit();
  p.setHeat(3);
  const first = run(p, 1, { units: 1, seen: true, events: ['speeding'] });
  assert.ok(first.some((e) => e.type === 'infraction' && e.name === 'speeding'), 'the first time fires');
  const second = run(p, 1, { units: 1, seen: true, events: ['speeding'] });
  assert.equal(second.filter((e) => e.type === 'infraction').length, 0, 'and only the first time');
  assert.equal(p.infractions.filter((x) => x === 'speeding').length, 1);
});

test('a wreck is a hit and run, and every known infraction is accepted', () => {
  const p = new Pursuit();
  p.setHeat(2);
  const ev = run(p, 1, { units: 1, seen: true, wrecked: true });
  assert.ok(ev.some((e) => e.type === 'infraction' && e.name === 'hitAndRun'));
  for (const name of INFRACTIONS) {
    const q = new Pursuit();
    q.setHeat(1);
    run(q, 0.1, { units: 1, seen: true, events: [name] });
    assert.ok(q.infractions.includes(name), `${name} should be an infraction`);
  }
});

test('a unit rammed is an infraction, and disabling one pays bounty', () => {
  const p = new Pursuit();
  p.setHeat(3);
  const ev = run(p, 1, { units: 1, seen: true, events: ['ram'] });
  assert.ok(ev.some((e) => e.type === 'infraction' && e.name === 'ram'));
  const before = p.bounty;
  p.disable();
  assert.ok(p.bounty > before, 'taking a unit out pays');
  assert.equal(p.disabled, 1);
});

test('bounty rises with time and with heat, and the cost to state counts', () => {
  const low = new Pursuit();
  low.setHeat(1);
  run(low, 10, { units: 1, seen: true });
  const high = new Pursuit();
  high.setHeat(5);
  run(high, 10, { units: 1, seen: true });
  assert.ok(high.bounty > low.bounty, 'a hotter pursuit is worth more');
  const p = new Pursuit();
  p.setHeat(1);
  run(p, 1, { units: 1, seen: true, damage: 5000 });
  assert.ok(p.cost >= 5000, 'damage to state is tracked');
});

test('thirty seconds of pursuit is resisting arrest', () => {
  const p = new Pursuit();
  p.setHeat(2);
  const ev = run(p, 31, { units: 2, seen: true, speed: 25 });
  assert.ok(ev.some((e) => e.type === 'infraction' && e.name === 'resist'), 'running long is its own infraction');
});

test('the end card carries the whole story for the report', () => {
  const p = new Pursuit();
  p.setHeat(4);
  p.involve();
  p.involve();
  p.disable();
  // Moving fast for 31 s, so the bust bar never fills, then stopping dead to be caught.
  run(p, 31, { units: 2, seen: true, speed: 25, events: ['speeding'] });
  assert.equal(p.pstate, 'pursuit', 'the player is still running at 31 s');
  const ev = run(p, 5, { units: 1, seen: true, speed: 0 });
  const report = ev.find((e) => e.type === 'busted').report;
  assert.equal(report.result, 'busted');
  assert.equal(report.heat, 4);
  assert.equal(report.involved, 2);
  assert.equal(report.disabled, 1);
  assert.ok(report.infractions.includes('speeding'));
  assert.ok(report.infractions.includes('resist'));
  assert.ok(report.time >= 30);
  assert.ok(report.fine > 0);
});