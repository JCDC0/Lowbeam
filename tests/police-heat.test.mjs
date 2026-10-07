import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Ground } from '../src/world/ground.js';
import { TrafficNet } from '../src/traffic/net.js';
import { TrafficSim } from '../src/traffic/sim.js';
import { KINDS, RIVALS, ALL_KINDS, KIND_BY_ID, UNIT_KINDS, isUnit } from '../src/traffic/kinds.js';
import { UNIT_BY_ID, roster, unitFor } from '../src/police/units.js';
import { Heat, HEAT_MAX, HEAT_STEP, HEAT_COOL, CALM_TIME, NOTICE_TIME, noticesSpeeding, noticesTrap } from '../src/police/heat.js';
import { buildKindGeometry } from '../src/traffic/bodies.js';

test('the police units are kinds the renderer can draw but the civilian pool never picks', () => {
  for (const k of UNIT_KINDS) {
    assert.ok(isUnit(k), `${k.id} should be a unit`);
    assert.ok(ALL_KINDS.includes(k), `${k.id} needs a mesh in the renderer`);
    assert.equal(KIND_BY_ID.get(k.id), k, `${k.id} should be registered`);
    assert.ok(!KINDS.includes(k), `${k.id} must stay out of the weighted civilian pool`);
    assert.ok(!RIVALS.includes(k), `${k.id} is not a street racer`);
  }
  assert.equal(UNIT_KINDS.length, 4, 'a cruiser, an unmarked, a heavy and an interceptor');
  assert.ok(UNIT_BY_ID.get('police').lightBar, 'the cruiser has a light bar');
  assert.ok(UNIT_BY_ID.get('police-fast').hidden, 'the unmarked unit hides its lights');
  assert.ok(UNIT_BY_ID.get('police-heavy').headOn, 'the Rhino drives head-on');
});

test('every unit builds a body from an existing model', () => {
  for (const k of UNIT_KINDS) {
    const geo = buildKindGeometry(k);
    assert.ok(geo.attributes.position.count > 0, `${k.id} body is empty`);
  }
});

test('heat puts more and heavier units on the road as it rises', () => {
  const r1 = roster(1);
  const r5 = roster(5);
  assert.ok(r5.length > r1.length, 'heat 5 fields more units than heat 1');
  assert.ok(r1.every((id) => id === 'police'), 'heat 1 is cruisers only');
  assert.ok(roster(3).includes('police-fast'), 'unmarked units join at 3');
  assert.ok(roster(4).includes('police-heavy'), 'the Rhinos join at 4');
  assert.ok(roster(5).includes('police-int'), 'the interceptor joins at 5');
  assert.equal(unitFor(1).id, 'police');
  assert.equal(unitFor(5).id, 'police-int');
});

test('heat starts unnoticed; a patrol watching the player fills its attention and starts a pursuit', () => {
  const h = new Heat();
  assert.equal(h.value, 0);
  assert.equal(h.level, 0, 'no level before the police notice anything');
  assert.equal(h.noticed, false);
  let started = -1;
  for (let t = 0; t < 3; t += 1 / 30) {
    if (h.update(1 / 30, { speeding: true }) && started < 0) started = t;
  }
  assert.ok(started > NOTICE_TIME - 0.1 && started < NOTICE_TIME + 0.1, `the pursuit starts after ${NOTICE_TIME} s of watching, at ${started.toFixed(2)}`);
  assert.equal(h.level, 0, 'attention alone is not heat');
  h.startPursuit();
  assert.equal(h.level, 1, 'a fresh pursuit is heat 1');
});

test('one speed trap is a warning, a second soon after starts a pursuit', () => {
  const h = new Heat();
  assert.equal(h.update(1 / 30, { trap: true }), false, 'one camera flash is not a pursuit');
  for (let t = 0; t < 5; t += 1 / 30) h.update(1 / 30, {});
  assert.equal(h.update(1 / 30, { trap: true }), true, 'the second one is');
  const g = new Heat();
  g.update(1 / 30, { trap: true });
  for (let t = 0; t < CALM_TIME + 10; t += 1 / 30) g.update(1 / 30, {});
  assert.equal(g.attention, 0, 'a lone trap is forgotten after the quiet time');
  assert.equal(g.update(1 / 30, { trap: true }), false, 'so the next one is a warning again');
});

test('ramming a police car starts a pursuit at once', () => {
  const h = new Heat();
  assert.equal(h.update(1 / 30, { hitPolice: true }), true);
});

test('heat climbs a level for every HEAT_STEP of pursuit and tops out at five', () => {
  const h = new Heat();
  h.startPursuit();
  for (let t = 0; t < HEAT_STEP + 1; t += 1 / 30) h.update(1 / 30, { pursuit: true });
  assert.equal(h.level, 2, 'one step of pursuit is heat 2');
  for (let t = 0; t < 60 * 10; t += 1 / 30) h.update(1 / 30, { pursuit: true });
  assert.equal(h.level, HEAT_MAX, 'a long pursuit pins the heat at the top');
  assert.ok(h.value < HEAT_MAX + 1, 'and never past it');
  assert.ok(h.pursuitTime > 600, `pursuit clock ${h.pursuitTime}`);
});

test('after an escape the heat stays, then cools a level for every HEAT_COOL of quiet', () => {
  const h = new Heat();
  h.startPursuit();
  for (let t = 0; t < HEAT_STEP * 2 + 5; t += 1 / 30) h.update(1 / 30, { pursuit: true });
  assert.equal(h.level, 3);
  const hot = h.value;
  for (let t = 0; t < 5; t += 1 / 30) h.update(1 / 30, {});
  assert.equal(h.value, hot, 'heat holds for the quiet time first');
  for (let t = 0; t < CALM_TIME + HEAT_COOL; t += 1 / 30) h.update(1 / 30, {});
  assert.equal(h.level, 2, 'a level gone after HEAT_COOL');
  for (let t = 0; t < HEAT_COOL * 4; t += 1 / 30) h.update(1 / 30, {});
  assert.equal(h.value, 0, 'heat falls all the way back to nothing');
  assert.equal(h.noticed, false, 'and the police forget the player');
  h.startPursuit();
  for (let t = 0; t < HEAT_STEP * 3; t += 1 / 30) h.update(1 / 30, { pursuit: true });
  h.wipe();
  assert.equal(h.level, 0, 'a bust wipes the heat');
});

test('a patrol notices speeding only well over the limit and only up close', () => {
  const cop = { x: 0, z: 0 };
  assert.ok(noticesSpeeding({ x: 10, z: 0, speed: 150 / 3.6 }, cop), 'a clear speeder beside a patrol is noticed');
  assert.equal(noticesSpeeding({ x: 10, z: 0, speed: 130 / 3.6 }, cop), false, 'a mild speeder is ignored');
  assert.equal(noticesSpeeding({ x: 200, z: 0, speed: 200 / 3.6 }, cop), false, 'a speeder far away is not seen');
});

test('a toll speed trap only bites above 160 km/h', () => {
  assert.equal(noticesTrap(159), false);
  assert.ok(noticesTrap(161));
});

const ground = new Ground();
const net = new TrafficNet(ground.roads);

test('the sim spawns a police unit on the road and counts it as one', () => {
  const sim = new TrafficSim(net, { seed: 5, target: 0, rivals: 0, patrols: 0 });
  const a = sim.spawnUnit({ x: 0, z: 0 }, 'police', 10, 400);
  assert.ok(a, 'a patrol should spawn');
  assert.equal(a.kind.id, 'police');
  assert.equal(sim.countUnits(), 1, 'the sim counts it as a unit');
  assert.ok(isUnit(a.kind));
  const b = sim.spawnUnit({ x: 0, z: 0 }, 'no-such-kind', 10, 400);
  assert.ok(b && b.kind.id === 'police', 'an unknown kind id falls back to the cruiser');
});

test('unitsNear finds the police within range and leaves the rest', () => {
  const sim = new TrafficSim(net, { seed: 6, target: 0, rivals: 0, patrols: 0 });
  const a = sim.spawnUnit({ x: 0, z: 0 }, 'police', 10, 400);
  assert.ok(a);
  const near = sim.unitsNear({ x: a.x, z: a.z }, 60);
  assert.equal(near.length, 1, 'the unit beside the player is found');
  assert.equal(near[0].agent, a);
  assert.equal(sim.unitsNear({ x: a.x + 5000, z: a.z }, 60).length, 0, 'and none when it is far away');
});