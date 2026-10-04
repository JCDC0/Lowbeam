import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RALLY } from '../src/world/layout.js';
import { Rally, OFF_COURSE, OFF_LIMIT, PENALTY, COUNTDOWN } from '../src/race/rally.js';

/** A fake stage road: a straight path of `length` meters. */
function road(length) {
  return { length, id: RALLY.road };
}

/** Runs the rally forward at `speed` m/s, calling `each(t)` with the elapsed time. */
function run(rally, seconds, world, speed = 30) {
  const dt = 1 / 60;
  const events = [];
  for (let t = 0; t < seconds; t += dt) {
    events.push(...rally.update(dt, { s: speed * t, ...world }));
  }
  return events;
}

test('the rally starts on the stage with a 3 s countdown', () => {
  const rally = new Rally('hayate', RALLY, road(6400));
  assert.equal(rally.kind, 'rally');
  assert.equal(rally.state, 'countdown');
  assert.deepEqual(rally.participants, ['hayate']);
  const seen = [];
  for (let t = 0; t < COUNTDOWN; t += 1 / 60) seen.push(...rally.update(1 / 60, { s: 0 }));
  assert.equal(seen.filter((e) => e.type === 'count').length, 3);
  assert.equal(rally.state, 'running');
  assert.equal(rally.time, 0, 'the clock should not start until the countdown is over');
});

test('the gates are spaced evenly between the start and the finish', () => {
  const roadLen = 6400;
  const rally = new Rally('hayate', RALLY, road(roadLen));
  const finish = roadLen - RALLY.finishEndOffset;
  assert.equal(rally.gates.length, RALLY.checkpoints);
  assert.ok(rally.gates[0] > RALLY.startS, 'the first gate is past the start');
  assert.ok(rally.gates[rally.gates.length - 1] < finish, 'the last gate is before the finish');
  const spans = [];
  for (let i = 1; i < rally.gates.length; i++) spans.push(rally.gates[i] - rally.gates[i - 1]);
  const first = rally.gates[0] - RALLY.startS;
  for (const s of spans) assert.ok(Math.abs(s - first) < 1e-6, `gates unevenly spaced: ${JSON.stringify(spans)}`);
});

test('a run that hits every gate finishes with the right time and a medal', () => {
  const roadLen = 6400;
  const rally = new Rally('hayate', RALLY, road(roadLen));
  const finish = roadLen - RALLY.finishEndOffset;
  for (let t = 0; t < COUNTDOWN; t += 1 / 60) rally.update(1 / 60, { s: 0 });
  const speed = 90;
  let s = 0;
  const dt = 1 / 60;
  let t = 0;
  while (rally.state === 'running' && t < 600) {
    s = speed * t;
    rally.update(dt, { s });
    t += dt;
  }
  assert.equal(rally.state, 'won');
  const r = rally.result();
  assert.ok(r, 'a finished run has a result');
  assert.equal(r.won, true);
  assert.ok(r.time > 0, 'the time should be recorded');
  assert.ok(r.medals.length > 0, 'finishing awards at least bronze');
  assert.ok(r.medals.length <= 4, 'no more than four medals');
  assert.ok(r.prize > 0, 'finishing pays something');
  assert.ok(s >= finish, `the run reached ${s.toFixed(0)}, finish is ${finish}`);
});

test('skipping a gate does not finish', () => {
  const roadLen = 6400;
  const rally = new Rally('hayate', RALLY, road(roadLen));
  for (let t = 0; t < COUNTDOWN; t += 1 / 60) rally.update(1 / 60, { s: 0 });
  // Jump past the first two gates without passing through them.
  const finish = roadLen - RALLY.finishEndOffset;
  let s = 0;
  const dt = 1 / 60;
  let t = 0;
  while (rally.state === 'running' && t < 600) {
    s = (rally.nextGate() + 40) + (finish - (rally.nextGate() + 40)) * (t / 30);
    rally.update(dt, { s });
    t += dt;
    if (t > 30) break;
  }
  assert.notEqual(rally.state, 'won', 'jumping the gates must not finish the run');
  assert.equal(rally.gatesHit, 0, 'no gate was passed through');
});

test('the penalty adds 5 s to the final time', () => {
  const roadLen = 6400;
  const clean = new Rally('hayate', RALLY, road(roadLen));
  for (let t = 0; t < COUNTDOWN; t += 1 / 60) clean.update(1 / 60, { s: 0 });
  let s = 0;
  let t = 0;
  while (clean.state === 'running' && t < 600) {
    s = 90 * t;
    clean.update(1 / 60, { s });
    t += 1 / 60;
  }
  assert.equal(clean.state, 'won');

  const hit = new Rally('hayate', RALLY, road(roadLen));
  for (let t = 0; t < COUNTDOWN; t += 1 / 60) hit.update(1 / 60, { s: 0 });
  hit.penalize();
  assert.equal(hit.penalty, PENALTY);
  assert.equal(PENALTY, 5);
  let s2 = 0;
  let t2 = 0;
  while (hit.state === 'running' && t2 < 600) {
    s2 = 90 * t2;
    hit.update(1 / 60, { s: s2 });
    t2 += 1 / 60;
  }
  assert.equal(hit.state, 'won');
  assert.ok(Math.abs(hit.result().time - clean.result().time - PENALTY) < 0.5, 'the penalty adds 5 s');
});

test('more than 25 m off course for 3 s starts a countdown and then aborts', () => {
  const rally = new Rally('hayate', RALLY, road(6400));
  for (let t = 0; t < COUNTDOWN; t += 1 / 60) rally.update(1 / 60, { s: 0 });
  const off = { s: 100, d: OFF_COURSE + 5 };
  let s = 100;
  let t = 0;
  const dt = 1 / 60;
  while (t < OFF_LIMIT + 1) {
    s += 30 * dt;
    rally.update(dt, { s, d: OFF_COURSE + 5 });
    t += dt;
  }
  assert.equal(rally.offTime > 0, true, 'off-course time should be counting');
  // Let the 10 s countdown elapse.
  for (let i = 0; i < 60 * 11; i++) {
    s += 30 * dt;
    rally.update(dt, { s, d: OFF_COURSE + 5 });
  }
  assert.equal(rally.state, 'aborted', 'a long time off course aborts the run');
  assert.equal(rally.result(), null, 'an abort has no result');
});

test('coming back on course clears the off-course timer', () => {
  const rally = new Rally('hayate', RALLY, road(6400));
  for (let t = 0; t < COUNTDOWN; t += 1 / 60) rally.update(1 / 60, { s: 0 });
  const dt = 1 / 60;
  let s = 100;
  for (let i = 0; i < 120; i++) {
    s += 30 * dt;
    rally.update(dt, { s, d: OFF_COURSE + 5 });
  }
  assert.ok(rally.offTime > 0);
  rally.update(dt, { s, d: 0 });
  assert.equal(rally.offTime, 0, 'back on the road clears the timer');
  assert.equal(rally.state, 'running');
});

test('ghostAt interpolates between samples', () => {
  const rally = new Rally('hayate', RALLY, road(6400));
  // Two samples 1 s apart: x 0 to 1000 cm, yaw 0 to 2 rad.
  rally.recordGhost(0, { x: 0, z: 0, yaw: 0 });
  rally.recordGhost(1, { x: 1000, z: 200, yaw: 2 });
  const mid = rally.ghostAt(0.5);
  assert.ok(Math.abs(mid.x - 500) < 1, `x was ${mid.x}`);
  assert.ok(Math.abs(mid.z - 100) < 1, `z was ${mid.z}`);
  assert.ok(Math.abs(mid.yaw - 1) < 0.01, `yaw was ${mid.yaw}`);
  const start = rally.ghostAt(0);
  assert.equal(start.x, 0);
  const end = rally.ghostAt(1);
  assert.equal(end.x, 1000);
  assert.equal(rally.ghostAt(-1), null, 'before the ghost starts there is nothing to draw');
  assert.equal(rally.ghostAt(5), null, 'after the ghost finishes there is nothing to draw');
});

test('the ghost records x, z and yaw as rounded integers', () => {
  const rally = new Rally('hayate', RALLY, road(6400));
  rally.recordGhost(0, { x: 1.234, z: -5.678, yaw: 0.9876 });
  const s = rally.ghost;
  assert.equal(s[0].x, 123);
  assert.equal(s[0].z, -568);
  assert.equal(s[0].yaw, 99);
  assert.equal(Number.isInteger(s[0].x), true);
  assert.equal(Number.isInteger(s[0].z), true);
  assert.equal(Number.isInteger(s[0].yaw), true);
});

test('splits are recorded at each gate and compared against a best time', () => {
  const roadLen = 6400;
  const bestSplits = [100, 200, 300, 400, 500];
  const rally = new Rally('hayate', RALLY, road(roadLen), { best: 300, bestSplits });
  for (let t = 0; t < COUNTDOWN; t += 1 / 60) rally.update(1 / 60, { s: 0 });
  const dt = 1 / 60;
  let s = 0;
  let t = 0;
  while (rally.state === 'running' && t < 600) {
    s = 90 * t;
    rally.update(dt, { s });
    t += dt;
  }
  assert.equal(rally.splits.length, RALLY.checkpoints + 1, 'one split per gate plus the finish');
  for (const sp of rally.splits) {
    assert.equal(typeof sp.against, 'number', 'each split knows the best to beat');
    assert.equal(typeof sp.ahead, 'boolean');
  }
  assert.ok(rally.splits[0].ahead, 'a 100 s first gate beats a 300 s best');
});

test('a run with no best time has nothing to compare against', () => {
  const rally = new Rally('hayate', RALLY, road(6400));
  for (let t = 0; t < COUNTDOWN; t += 1 / 60) rally.update(1 / 60, { s: 0 });
  const dt = 1 / 60;
  let s = 0;
  let t = 0;
  while (rally.state === 'running' && t < 600) {
    s = 90 * t;
    rally.update(dt, { s });
    t += dt;
  }
  for (const sp of rally.splits) assert.equal(sp.against, null);
});

test('medals come from RALLY.medals and the prize from RALLY.prize', () => {
  const roadLen = 6400;
  const rally = new Rally('hayate', RALLY, road(roadLen));
  for (let t = 0; t < COUNTDOWN; t += 1 / 60) rally.update(1 / 60, { s: 0 });
  const finish = roadLen - RALLY.finishEndOffset;
  const dt = 1 / 60;
  let s = 0;
  let t = 0;
  while (rally.state === 'running' && t < 600) {
    s = 90 * t;
    rally.update(dt, { s });
    t += dt;
  }
  const r = rally.result();
  const names = ['bronze', 'silver', 'gold'];
  for (const m of r.medals) assert.ok(names.includes(m), `unknown medal ${m}`);
  assert.ok(Object.values(RALLY.prize).includes(r.prize), `prize ${r.prize} is not one of RALLY.prize`);
});

test('aborting mid run gives no result', () => {
  const rally = new Rally('hayate', RALLY, road(6400));
  for (let t = 0; t < COUNTDOWN; t += 1 / 60) rally.update(1 / 60, { s: 0 });
  rally.abort();
  assert.equal(rally.state, 'aborted');
  assert.equal(rally.result(), null);
});

test('RALLY is not edited by the rally module', () => {
  assert.equal(RALLY.id, 'kuro');
  assert.equal(RALLY.road, 'kuro');
  assert.ok(RALLY.startS > 0);
  assert.ok(RALLY.finishEndOffset > 0);
  assert.ok(RALLY.checkpoints > 0);
  assert.ok(RALLY.medals.gold > RALLY.medals.silver);
  assert.ok(RALLY.prize.gold > RALLY.prize.bronze);
});

test('a run faster than the gold target wins gold', () => {
  const rally = new Rally('hayate', RALLY, road(6400));
  for (let t = 0; t < COUNTDOWN; t += 1 / 60) rally.update(1 / 60, { s: 0 });
  const finish = 6400 - RALLY.finishEndOffset;
  const dt = 1 / 60;
  let t = 0;
  let s = 0;
  const speed = finish / 40;
  while (rally.state === 'running' && t < 600) {
    s = speed * t;
    rally.update(dt, { s });
    t += dt;
  }
  const r = rally.result();
  assert.ok(r, 'finished');
  assert.equal(r.medals[0], 'gold', `expected gold first, got ${JSON.stringify(r.medals)}`);
  assert.equal(r.prize, RALLY.prize.gold);
});