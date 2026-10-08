import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Ground } from '../src/world/ground.js';
import { TrafficNet } from '../src/traffic/net.js';
import { TrafficSim } from '../src/traffic/sim.js';
import { PoliceDirector } from '../src/police/director.js';
import { UNIT_BY_ID, unitDamage, health, DAMAGE } from '../src/police/units.js';
import { CARS } from '../src/vehicles/specs.js';

const ground = new Ground();
const net = new TrafficNet(ground.roads);
const DT = 1 / 30;
const car = { mass: 1300, width: 1.75, length: 4.4, cgToFront: 1.2, wheelbase: 2.5, yawInertia: 2000 };

test('damage grows with the square of the hit, the heavy units shrug more off, a wall is worst', () => {
  const cruiser = UNIT_BY_ID.get('police');
  const rhino = UNIT_BY_ID.get('police-heavy');
  assert.equal(unitDamage(DAMAGE.floor, car.mass, cruiser.mass), 0, 'a touch does nothing');
  const d10 = unitDamage(10, car.mass, cruiser.mass);
  assert.ok(Math.abs(unitDamage(20, car.mass, cruiser.mass) / d10 - 4) < 1e-9, 'twice the speed, four times the damage');
  assert.ok(unitDamage(10, car.mass, rhino.mass) < d10, 'a Rhino takes less from the same car');
  assert.ok(unitDamage(10, Infinity, cruiser.mass) > d10, 'a wall hurts more than a car');
  assert.ok(4 * unitDamage(30 / 3.6, car.mass, cruiser.mass) < cruiser.hp, 'four bumps at 30 km/h leave a cruiser standing');
  assert.ok(unitDamage(15, Infinity, cruiser.mass) < 0.35 * cruiser.hp, 'a wall hit at 15 m/s costs under 35 % of a cruiser');
});

/** A chasing cruiser right in front of a stopped player, rammed at `closing` m/s. */
function ram(sim, player, a, closing) {
  a.x = player.x;
  a.z = player.z + 3.5;
  a.y = player.y;
  a.yaw = Math.PI;
  a.vx = 0;
  a.vz = -closing;
  a.speed = closing;
  if (a.mode !== 'wreck') a.mode = 'drive';
  a.free = false;
  sim.collideWithPlayer({ ...player, yaw: 0, vx: 0, vz: 0, yawRate: 0 }, car);
}

test('rams wear a unit down until it is destroyed: a wreck, its bar off, reported by kind', () => {
  const sim = new TrafficSim(net, { seed: 3, target: 0, rivals: 0, patrols: 0 });
  const player = { x: 0, y: 0, z: 0, speed: 0 };
  const a = sim.spawnUnit({ x: 0, z: 0, speed: 0 }, 'police', 0, 4000);
  a.pursuit = 'chase';
  let rams = 0;
  while (!a.destroyed && rams < 20) {
    ram(sim, player, a, 8);
    rams++;
    if (!a.destroyed) assert.notEqual(a.mode, 'wreck', `still running after ram ${rams} (${(health(a) * 100).toFixed(0)} %)`);
  }
  assert.ok(rams >= 6, `${rams} rams at 29 km/h destroy a cruiser (at least six)`);
  assert.equal(a.mode, 'wreck');
  assert.equal(a.pursuit, false, 'its bar and siren are off');
  const ev = sim.takeEvents();
  assert.deepEqual(ev.destroyed, ['police']);
  assert.equal(ev.lost, 1);
});

test('a destroyed unit pays its kind\'s bounty, counts as taken out and raises an event', () => {
  const dir = new PoliceDirector({ rand: () => 0.3 });
  const v = 170 / 3.6;
  const w = (t, extra = {}) => ({
    player: { x: 0, z: -20 + v * t * 0.2, speed: v },
    units: [{ id: 1, x: 8, z: 0, yaw: Math.PI, clear: true, kind: 'police', d: 10 }],
    patrols: 2, money: 1e6, ...extra,
  });
  for (let t = 0; t < 3; t += DT) dir.update(DT, w(t));
  assert.ok(dir.active, 'a pursuit is on');
  const before = dir.pursuit.bounty;
  const orders = dir.update(DT, w(3, { destroyed: ['police-heavy'] }));
  const e = orders.events.find((x) => x.type === 'destroyed');
  assert.ok(e, 'a destroyed event');
  assert.equal(e.bounty, UNIT_BY_ID.get('police-heavy').bounty);
  assert.ok(dir.pursuit.bounty - before >= e.bounty, 'the bounty grew by it');
  assert.equal(dir.pursuit.disabled, 1, 'one unit taken out');
});

test('a head-on at 30 m/s destroys a cruiser in one hit, whichever car hits it', () => {
  const cruiser = UNIT_BY_ID.get('police');
  for (const spec of CARS) {
    const dmg = unitDamage(30, spec.mass, cruiser.mass);
    assert.ok(dmg > cruiser.hp, `${spec.id} (${spec.mass} kg) does ${dmg.toFixed(1)} of ${cruiser.hp} hit points`);
  }
});

/** Rams from the test car needed to destroy a unit of kind `id` at `closing` m/s. */
function ramsToDestroy(id, closing) {
  const sim = new TrafficSim(net, { seed: 3, target: 0, rivals: 0, patrols: 0 });
  const player = { x: 0, y: 0, z: 0, speed: 0 };
  const a = sim.spawnUnit({ x: 0, z: 0, speed: 0 }, id, 0, 4000);
  a.pursuit = 'chase';
  let rams = 0;
  while (!a.destroyed && rams < 200) {
    ram(sim, player, a, closing, car);
    rams++;
  }
  return rams;
}

test('a Rhino takes about three times the rams a cruiser does', () => {
  const cruiser = ramsToDestroy('police', 8);
  const rhino = ramsToDestroy('police-heavy', 8);
  const ratio = rhino / cruiser;
  assert.ok(ratio > 2.5 && ratio < 3.5, `${rhino} rams for the Rhino, ${cruiser} for a cruiser: ${ratio.toFixed(2)} times`);
});
