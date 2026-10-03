import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RaceEvent } from '../src/race/event.js';
import { Duel, duelPrize, canChallenge, COUNTDOWN, WIN_GAP, GAUGE_FREE, GAUGE_FAST, HIT_DRAIN } from '../src/race/duel.js';

const RIVAL = { id: 'rv-hyper', name: 'VESPERA ZERO', speedFactor: 2.7 };

/** Runs a duel for `seconds` at a constant gap, optionally with hits. */
function run(duel, seconds, world) {
  const events = [];
  for (let t = 0; t < seconds; t += 1 / 30) events.push(...duel.update(1 / 30, { gap: 0, ...world }));
  return events;
}

test('the race event base carries the shared shape', () => {
  const e = new RaceEvent('id-1', 'duel', ['you', RIVAL.id]);
  assert.equal(e.id, 'id-1');
  assert.equal(e.kind, 'duel');
  assert.deepEqual(e.participants, ['you', RIVAL.id]);
  assert.equal(e.state, 'countdown');
  assert.equal(e.time, 0);
  assert.deepEqual(e.update(1 / 60, {}), []);
  assert.equal(e.result(), null);
});

test('the countdown blocks the gauge and beeps once a second then go', () => {
  const duel = new Duel(RIVAL);
  const seen = [];
  for (let t = 0; t < COUNTDOWN; t += 1 / 30) {
    seen.push(...duel.update(1 / 30, { gap: 400 }));
    assert.equal(duel.gauge.player, 1, 'the player gauge moved during the countdown');
    assert.equal(duel.gauge.rival, 1, 'the rival gauge moved during the countdown');
  }
  const counts = seen.filter((e) => e.type === 'count').length;
  assert.equal(counts, 3, `three counts expected, got ${counts}`);
  assert.equal(duel.state, 'running', 'the duel should be running after the countdown');
  seen.push(...duel.update(1 / 30, { gap: 400 }));
  const gos = seen.filter((e) => e.type === 'go').length;
  assert.equal(gos, 1, `one go expected, got ${gos}`);
});

test('the trailing driver loses gauge and it grows with the gap', () => {
  const near = new Duel(RIVAL);
  run(near, COUNTDOWN + 0.1, {});
  run(near, 4, { gap: GAUGE_FREE - 2 });
  const far = new Duel(RIVAL);
  run(far, COUNTDOWN + 0.1, {});
  run(far, 4, { gap: GAUGE_FAST + 50 });
  const nearLoss = 1 - near.gauge.player;
  const farLoss = 1 - far.gauge.player;
  assert.ok(nearLoss <= 0.001, `under ${GAUGE_FREE} m the gauge should hold, lost ${nearLoss}`);
  assert.ok(farLoss > nearLoss * 4, `far gap lost ${farLoss.toFixed(3)}, near lost ${nearLoss.toFixed(3)}`);
});

test('the leader recovers gauge after losing some of it', () => {
  const duel = new Duel(RIVAL);
  run(duel, COUNTDOWN + 0.1, {});
  duel.update(1 / 30, { gap: 0, hits: { player: 4 } });
  const drained = duel.gauge.player;
  assert.ok(drained < 1, 'the player should have lost gauge to the hits');
  run(duel, 3, { gap: -5 });
  assert.ok(duel.gauge.player > drained, `the leader recovered ${duel.gauge.player} from ${drained}`);
  assert.ok(duel.gauge.player <= 1, 'the gauge never goes above 1');
});

test('the gap closes back toward the leader gauge when the player is ahead', () => {
  const duel = new Duel(RIVAL);
  run(duel, COUNTDOWN + 0.1, {});
  run(duel, 3, { gap: -(GAUGE_FAST + 40) });
  assert.ok(duel.gauge.rival < 1, 'the rival behind should be losing');
  assert.equal(duel.gauge.player, 1, 'the player in front keeps the full gauge');
});

test('a hit costs the driver who hit it gauge', () => {
  const duel = new Duel(RIVAL);
  run(duel, COUNTDOWN + 0.1, {});
  const before = duel.gauge.player;
  duel.update(1 / 30, { gap: 0, hits: { player: 1 } });
  assert.ok(before - duel.gauge.player >= HIT_DRAIN - 1e-9, 'a player hit cost gauge');
  const mid = duel.gauge.rival;
  duel.update(1 / 30, { gap: 0, hits: { rival: 2 } });
  assert.ok(mid - duel.gauge.rival >= HIT_DRAIN * 2 - 1e-9, 'two rival hits cost double');
});

test('the first gauge to zero loses', () => {
  const duel = new Duel(RIVAL);
  run(duel, COUNTDOWN + 0.1, {});
  let t = 0;
  while (duel.state === 'running' && t < 200) {
    duel.update(1 / 30, { gap: 120 });
    t += 1 / 30;
  }
  assert.equal(duel.state, 'lost');
  const r = duel.result();
  assert.equal(r.won, false);
  assert.equal(duel.gauge.player, 0);
});

test('a lead past 500 m wins at once for the leader', () => {
  const duel = new Duel(RIVAL);
  run(duel, COUNTDOWN + 0.1, {});
  const events = run(duel, 0.5, { gap: WIN_GAP + 10 });
  assert.equal(duel.state, 'lost', 'a 510 m deficit should end it at once');
  assert.ok(events.some((e) => e.type === 'end'), 'an end event is emitted');
});

test('the same lead for the rival wins the duel', () => {
  const duel = new Duel(RIVAL);
  run(duel, COUNTDOWN + 0.1, {});
  run(duel, 0.5, { gap: -(WIN_GAP + 10) });
  assert.equal(duel.state, 'won');
  assert.equal(duel.result().won, true);
});

test('an aborted duel has no result and no prize', () => {
  const duel = new Duel(RIVAL);
  duel.update(1 / 30, {});
  duel.abort();
  assert.equal(duel.state, 'aborted');
  assert.equal(duel.result(), null);
});

test('the prize rounds to 500 and grows with the rival speed', () => {
  assert.equal(duelPrize(1.75), 14500);
  assert.equal(duelPrize(2.0), 16000);
  assert.equal(duelPrize(2.7), 20000);
  for (const f of [1.75, 1.9, 2.1, 2.35, 2.5, 2.7]) {
    assert.equal(duelPrize(f) % 500, 0, `${f} did not round to 500`);
  }
});

test('a win pays the prize and a loss pays nothing', () => {
  const duel = new Duel(RIVAL);
  run(duel, COUNTDOWN + 0.1, {});
  run(duel, 0.5, { gap: -(WIN_GAP + 10) });
  assert.equal(duel.result().prize, duelPrize(RIVAL.speedFactor));
  const lost = new Duel(RIVAL);
  run(lost, COUNTDOWN + 0.1, {});
  let t = 0;
  while (lost.state === 'running' && t < 200) {
    lost.update(1 / 30, { gap: 120 });
    t += 1 / 30;
  }
  assert.equal(lost.result().prize, 0);
});

test('a challenge is refused when the rival is behind or too far away', () => {
  assert.ok(canChallenge({ distance: 30, ahead: true, road: 'c1-f' }), '30 m ahead on Route 1');
  assert.ok(canChallenge({ distance: 60, ahead: true, road: 'c2-f' }), '60 m ahead on the Bayshore Line');
  assert.ok(!canChallenge({ distance: 30, ahead: false, road: 'c1-f' }), 'a rival behind cannot be challenged');
  assert.ok(!canChallenge({ distance: 61, ahead: true, road: 'c1-f' }), '61 m is too far');
  assert.ok(!canChallenge({ distance: 20, ahead: true, road: 'r18' }), 'only the two expressways');
  assert.ok(!canChallenge(null), 'no rival at all');
});