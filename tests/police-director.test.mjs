import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PoliceDirector, REPORT_TIME, unitSees, BUST_RANGE } from '../src/police/director.js';
import { HEAT_STEP } from '../src/police/heat.js';
import { roster } from '../src/police/units.js';
import { FLAT_TIME } from '../src/police/roadblock.js';

const DT = 1 / 30;

/**
 * A fake world for scripted chases: the player drives along +z, units stand where the story puts
 * them. `units` are { x, z, yaw, kind, clear }; distances are measured each frame.
 */
function world(player, units, extra = {}) {
  return {
    player,
    units: units.map((u, i) => ({ id: i + 1, yaw: 0, clear: true, kind: 'police', ...u, d: Math.hypot(u.x - player.x, u.z - player.z) })),
    patrols: 2,
    money: 1e6,
    ...extra,
  };
}

/** Runs `seconds` of frames, building the world each frame from `make(t)`; returns every order. */
function run(dir, seconds, make) {
  const all = [];
  for (let t = 0; t < seconds; t += DT) all.push(dir.update(DT, make(t)));
  return all;
}

const events = (orders, type) => orders.flatMap((o) => o.events).filter((e) => e.type === type);

/** A unit parked beside the road and a player passing it at `kmh`. */
function speedPast(dir, kmh = 170) {
  const v = kmh / 3.6;
  return run(dir, 3, (t) => world({ x: 0, z: -20 + v * t * 0.2, speed: v }, [{ x: 8, z: 0, yaw: Math.PI }]));
}

test('speeding past a unit starts a pursuit, and the units are sent to chase', () => {
  const dir = new PoliceDirector({ rand: () => 0.3 });
  const orders = speedPast(dir);
  assert.equal(events(orders, 'start').length, 1, 'one pursuit starts');
  assert.ok(dir.active);
  assert.equal(dir.level, 1, 'at heat 1');
  const last = orders[orders.length - 1];
  assert.equal(last.chase, 'chase');
  assert.ok(last.view && last.view.state === 'pursuit', 'the HUD shows the pursuit');
});

test('a car within the limit passes a unit without a pursuit', () => {
  const dir = new PoliceDirector();
  const orders = speedPast(dir, 90);
  assert.equal(events(orders, 'start').length, 0);
  assert.equal(dir.active, false);
});

test('a unit behind a building sees nothing; a patrol sees all round, a search only ahead', () => {
  const dir = new PoliceDirector();
  const v = 170 / 3.6;
  const orders = run(dir, 3, () => world({ x: 0, z: 10, speed: v }, [{ x: 8, z: 0, clear: false }]));
  assert.equal(events(orders, 'start').length, 0, 'no line, no notice');
  const away = { id: 1, x: 0, z: 0, yaw: Math.PI, d: 40, clear: true };
  assert.ok(unitSees(away, { x: 0, z: 40 }, 'patrol'), 'a patrol notices a car 40 m behind it');
  assert.equal(unitSees(away, { x: 0, z: 40 }, 'search'), false, 'a searching unit facing away does not');
  assert.ok(unitSees({ ...away, yaw: 0 }, { x: 0, z: 40 }, 'search'), 'but facing the player it does');
  assert.equal(unitSees({ ...away, d: 80 }, { x: 0, z: 80 }, 'patrol'), false, 'a patrol only notices up close');
  assert.ok(unitSees({ ...away, d: 120 }, { x: 0, z: 120 }, 'chase'), 'once chasing it sees all round to 150 m');
});

test('out of sight the pursuit goes evading, cooldown, escaped; the bounty is paid and the units go home', () => {
  const dir = new PoliceDirector({ rand: () => 0.3 });
  speedPast(dir);
  assert.ok(dir.active);
  // The player gets away: the only unit is 500 m back with no line.
  const orders = run(dir, 90, () => world({ x: 0, z: 1000, speed: 40 }, [{ x: 0, z: 500, clear: false }]));
  const states = new Set(orders.map((o) => o.view?.state).filter(Boolean));
  assert.ok(states.has('evading'), 'evading first');
  assert.ok(states.has('cooldown'), 'then cooldown');
  assert.ok(states.has('escaped'), 'then escaped');
  const escaped = events(orders, 'escaped')[0];
  assert.ok(escaped && escaped.bounty > 0, 'the escape carries the bounty');
  const paid = orders.reduce((a, o) => a + o.money, 0);
  assert.equal(paid, escaped.bounty, 'and the bounty is paid once');
  const end = orders.find((o) => o.report);
  assert.ok(end.release, 'the units are released');
  assert.equal(end.heli, false, 'the helicopter goes home');
  const search = orders.find((o) => o.chase === 'search');
  assert.ok(search && search.search, 'in cooldown the units search the last known position');
  assert.equal(orders[orders.length - 1].view, null, `the report goes away after ${REPORT_TIME} s`);
  assert.equal(dir.pursuit, null, 'and there is no pursuit');
});

test('a second pursuit starts after the first, at the heat the first left', () => {
  const dir = new PoliceDirector({ rand: () => 0.3 });
  speedPast(dir);
  // Run long enough to reach heat 2 in sight, then escape.
  run(dir, HEAT_STEP + 2, (t) => world({ x: 0, z: 40 * t, speed: 40 }, [{ x: 0, z: 40 * t - 30 }]));
  assert.equal(dir.level, 2);
  run(dir, 90, () => world({ x: 0, z: 9000, speed: 40 }, [{ x: 0, z: 8000, clear: false }]));
  assert.equal(dir.pursuit, null, 'the first one is over');
  const orders = speedPast(dir);
  assert.equal(events(orders, 'start').length, 1, 'a second pursuit starts');
  assert.equal(events(orders, 'start')[0].heat, 2, 'at the heat the police still hold');
});

test('one toll trap at 180 km/h is a warning that fades; a second soon after is a pursuit', () => {
  const dir = new PoliceDirector();
  const quiet = (seconds) => run(dir, seconds, () => world({ x: 0, z: 0, speed: 30 }, []));
  dir.update(DT, world({ x: 0, z: 0, speed: 50 }, [], { toll: 180 }));
  assert.equal(dir.active, false, 'one trap is not a pursuit');
  assert.ok(dir.heat.attention > 0, 'but the police have noticed');
  quiet(40);
  assert.equal(dir.heat.attention, 0, 'and forget it after the quiet time');
  dir.update(DT, world({ x: 0, z: 0, speed: 50 }, [], { toll: 180 }));
  quiet(3);
  dir.update(DT, world({ x: 0, z: 0, speed: 50 }, [], { toll: 185 }));
  assert.ok(dir.active, 'two traps in a row start a pursuit');
  const slow = new PoliceDirector();
  slow.update(DT, world({ x: 0, z: 0, speed: 40 }, [], { toll: 140 }));
  assert.equal(slow.heat.attention, 0, 'a legal pass is nothing');
});

test('a duel nobody sees adds no heat; one a unit watches starts a pursuit', () => {
  const unseen = new PoliceDirector();
  run(unseen, 10, (t) => world({ x: 0, z: 50 * t, speed: 50 }, [{ x: 0, z: -400, clear: false }], { duel: true }));
  assert.equal(unseen.heat.attention, 0);
  assert.equal(unseen.active, false);
  const seen = new PoliceDirector();
  run(seen, 3, () => world({ x: 0, z: 30, speed: 25 }, [{ x: 4, z: 0 }], { duel: true }));
  assert.ok(seen.active, 'a race in front of a unit is a pursuit');
});

test('stopping beside a unit for three seconds is a bust: the fine is taken and the heat wiped', () => {
  const dir = new PoliceDirector();
  speedPast(dir);
  const orders = run(dir, 5, () => world({ x: 0, z: 0, speed: 0 }, [{ x: BUST_RANGE / 2, z: 0 }], { money: 20000 }));
  const bust = events(orders, 'busted')[0];
  assert.ok(bust, 'busted');
  assert.ok(bust.fine > 30000, 'the fine is the bounty plus thirty thousand');
  assert.equal(orders.reduce((a, o) => a + o.money, 0), -20000, 'the player pays what they have');
  assert.equal(dir.level, 0, 'the heat is wiped');
  const far = new PoliceDirector();
  speedPast(far);
  const o2 = run(far, 5, () => world({ x: 0, z: 0, speed: 0 }, [{ x: 60, z: 0 }]));
  assert.equal(events(o2, 'busted').length, 0, 'a unit watching from 60 m cannot cuff a stopped car');
});

test('backup arrives one car at a time, from the roster for the heat', () => {
  const dir = new PoliceDirector();
  speedPast(dir);
  const units = [{ x: 0, z: -30 }];
  const sent = [];
  for (let t = 0; t < 10; t += DT) {
    const o = dir.update(DT, world({ x: 0, z: 0, speed: 30 }, units));
    for (const k of o.spawn) {
      sent.push(k);
      units.push({ x: 0, z: -60 - units.length * 10, kind: k });
    }
  }
  assert.equal(units.length, roster(1).length, 'heat 1 fields its roster');
  assert.ok(sent.every((k) => k === 'police'), 'cruisers only at heat 1');
});

test('at heat 4 a roadblock is set out of sight; passing it is dodged, its strip flattens the tires', () => {
  const dir = new PoliceDirector({ rand: () => 0.9 });
  speedPast(dir);
  dir.heat.value = 5.2;
  // A straight road along +z; the planner puts the block 300 m ahead of the player.
  const plan = (p) => (level) => {
    const z = p.z + 300;
    return {
      x: 0, z, y: 0, tx: 0, tz: 1, halfW: 5, s: z, lane: null,
      units: [{ x: -2, z, y: 0, yaw: 0 }, { x: 1.5, z, y: 0, yaw: 0 }],
      gap: { side: 1, half: 1.5 },
    };
  };
  let z = 0;
  const v = 40;
  const orders = [];
  let block = null;
  for (let t = 0; t < 30 && !block; t += DT) {
    z += v * DT;
    const p = { x: 3.5, z, speed: v };
    const o = dir.update(DT, world(p, [{ x: 0, z: z - 20 }], { planBlock: plan(p) }));
    orders.push(o);
    if (o.roadblock) block = o.roadblock;
  }
  assert.ok(block, 'a roadblock goes up');
  assert.ok(block.z - z > 150, 'out of the player\'s sight');
  const strip = dir.spikes;
  assert.ok(strip, 'heat 5 lays a strip');
  // Drive straight through the gap, over the strip.
  for (let t = 0; t < 15; t += DT) {
    z += v * DT;
    orders.push(dir.update(DT, world({ x: strip.x, z, speed: v }, [{ x: 0, z: z - 20 }])));
  }
  assert.equal(events(orders, 'spiked').length, 1, 'the strip got the tires');
  assert.equal(events(orders, 'roadblockDodged').length, 1, 'the roadblock was passed');
  assert.ok(orders.some((o) => o.clearRoadblock), 'and it comes down behind the player');
  assert.equal(dir.pursuit.roadblocks, 1);
  assert.equal(dir.pursuit.spikes, 0, 'a strip that bit is not dodged');
  const tires = orders[orders.length - 1].tires;
  assert.ok(tires.active && tires.grip < 1 && tires.top < 1, 'the tires are flat');
  dir.mendTires();
  const fixed = dir.update(DT, world({ x: 0, z, speed: 10 }, []));
  assert.equal(fixed.tires.active, false, 'a pump mends them');
  assert.ok(FLAT_TIME > 10);
});

test('hitting a police car is an instant pursuit and a ram on the sheet', () => {
  const dir = new PoliceDirector();
  const o = run(dir, 0.5, (t) => world({ x: 0, z: 0, speed: 20 }, [{ x: 3, z: 0 }], { hitPolice: t < DT ? 3000 : 0 }));
  assert.equal(events(o, 'start').length, 1);
  assert.ok(dir.pursuit.infractions.includes('ram'));
  assert.ok(dir.pursuit.cost >= 3000, 'the damage is a cost to the state');
});
