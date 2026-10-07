import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Ground } from '../src/world/ground.js';
import { TrafficNet } from '../src/traffic/net.js';
import { TrafficSim } from '../src/traffic/sim.js';
import { makeRng } from '../src/core/rng.js';

const ground = new Ground();
const net = new TrafficNet(ground.roads);
const DT = 1 / 30;

/** A player standing on a city street at a seeded random spot. */
function streetPlayer(seed) {
  const rng = makeRng(seed);
  const streets = net.lanes.filter((l) => l.cls === 'street' && l.length > 200);
  const lane = streets[Math.floor(rng.next() * streets.length)];
  const q = net.sample(lane, lane.length / 2, { x: 0, z: 0, tx: 0, tz: 1, y: 0 });
  return { x: q.x, y: q.y, z: q.z, speed: 0, vx: 0, vz: 0, yaw: Math.atan2(q.tx, q.tz) };
}

/** The closest a unit came to the player over `seconds`. */
function chase(sim, a, player, seconds) {
  let best = Infinity;
  for (let t = 0; t < seconds; t += DT) {
    sim.update(DT, player);
    if (!sim.agents.includes(a)) break;
    best = Math.min(best, Math.hypot(a.x - player.x, a.z - player.z));
  }
  return best;
}

test('the network finds a lane route to a spot across the city, U-turns included', () => {
  const p = streetPlayer(3);
  const goals = net.lanesAt(p.x, p.z, p.y + 0.5);
  assert.ok(goals.length >= 1, 'the player is on a road with lanes');
  // Every city lane spot 150 to 450 m from the player, every 25 m, then a seeded handful of them.
  // Expressways and their ramps are left out: from Route 1 or the Kurogane Line's deck the way to a
  // street is through an interchange, which may be farther than the route limit.
  const ring = [];
  const q = { x: 0, z: 0, tx: 0, tz: 1, y: 0 };
  for (const lane of net.lanes) {
    for (let s = 0; s < lane.length; s += 25) {
      net.sample(lane, s, q);
      const d = Math.hypot(q.x - p.x, q.z - p.z);
      if (d > 150 && d < 450 && lane.cls !== 'expressway' && lane.cls !== 'ramp') ring.push({ lane, s, d });
    }
  }
  const rng = makeRng(9);
  let found = 0;
  let tried = 0;
  for (; tried < 30; tried++) {
    const { lane, s, d } = ring[Math.floor(rng.next() * ring.length)];
    const r = net.route(lane, s, goals, { maxCost: 2500, uturn: 45 });
    if (r) {
      found++;
      assert.ok(r.cost >= d * 0.9, `a route is no shorter than the straight line (${r.cost.toFixed(0)} vs ${d.toFixed(0)})`);
    }
  }
  assert.ok(ring.length > 100, 'there are lanes around the player');
  assert.ok(found >= tried * 0.75, `most places 150 to 450 m away have a route (${found} of ${tried})`);
});

test('a chasing unit with no clear line still reaches the player by the lanes', () => {
  for (const seed of [3, 5, 8]) {
    const player = streetPlayer(seed);
    const sim = new TrafficSim(net, { seed, target: 0, rivals: 0, patrols: 0 });
    sim.clear = () => false;
    const a = sim.spawnUnit(player, 'police', 200, 330, 900);
    assert.ok(a, `seed ${seed}: a unit spawns with a route to the player`);
    a.pursuit = 'chase';
    const d0 = Math.hypot(a.x - player.x, a.z - player.z);
    const best = chase(sim, a, player, 60);
    assert.ok(best < 25, `seed ${seed}: from ${d0.toFixed(0)} m it came within ${best.toFixed(0)} m`);
  }
});

test('close with a clear line a unit drives straight at the player and keeps to the ground', () => {
  const player = streetPlayer(4);
  const sim = new TrafficSim(net, { seed: 4, target: 0, rivals: 0, patrols: 0 });
  let groundCalls = 0;
  sim.groundAt = (x, z, y) => {
    groundCalls++;
    return ground.at(x, z, y + 1).h;
  };
  const a = sim.spawnUnit(player, 'police', 150, 330, 900);
  a.pursuit = 'chase';
  const best = chase(sim, a, player, 45);
  assert.ok(best < 6, `it reached the player (${best.toFixed(1)} m)`);
  assert.ok(a.free, 'driving free at the end');
  assert.ok(groundCalls > 0, 'and its height came from the ground');
  assert.ok(Math.abs(a.y - player.y) < 2, 'level with the player');
});

test('a searching unit drives to the search area', () => {
  const player = streetPlayer(6);
  const sim = new TrafficSim(net, { seed: 6, target: 0, rivals: 0, patrols: 0 });
  sim.search = { x: player.x, z: player.z, r: 40 };
  const a = sim.spawnUnit(player, 'police', 200, 330, 900);
  a.pursuit = 'search';
  // The player is somewhere else entirely; the unit goes where they were last seen.
  const away = { x: player.x + 3000, z: player.z, speed: 0 };
  let best = Infinity;
  for (let t = 0; t < 60; t += DT) {
    sim.update(DT, { ...away, x: player.x, z: player.z + 0.01 });
    best = Math.min(best, Math.hypot(a.x - player.x, a.z - player.z));
  }
  assert.ok(best < 30, `it reached the last known position (${best.toFixed(0)} m)`);
});

test('roadblock units stay parked until the block comes down, then chase', () => {
  const player = streetPlayer(7);
  const sim = new TrafficSim(net, { seed: 7, target: 0, rivals: 0, patrols: 0 });
  const at = net.locate(player.x, player.z, player.yaw, player.y + 0.5);
  const spot = { x: player.x + 60, y: player.y, z: player.z, yaw: 1 };
  const a = sim.spawnParked('police', spot, at.lane, at.s);
  for (let t = 0; t < 3; t += DT) sim.update(DT, player);
  assert.equal(a.mode, 'parked');
  assert.equal(a.x, spot.x, 'it does not move');
  sim.command('chase');
  assert.equal(a.mode, 'parked', 'a chase order leaves the roadblock standing');
  sim.command('chase', { unpark: true });
  assert.equal(a.mode, 'drive');
  assert.equal(a.pursuit, 'chase');
});

test('released units beyond the patrol count go home once out of sight', () => {
  const player = streetPlayer(8);
  const sim = new TrafficSim(net, { seed: 8, target: 0, rivals: 0, patrols: 0 });
  for (let i = 0; i < 4; i++) sim.spawnUnit(player, 'police', 160, 400);
  assert.equal(sim.countUnits(), 4);
  sim.command('chase');
  sim.command(false, { keep: 1 });
  assert.equal(sim.units().filter((a) => a.leave).length, 3, 'three are sent home');
  for (let t = 0; t < 2; t += DT) sim.update(DT, player);
  assert.equal(sim.countUnits(), 1, 'and leave at once when already out of sight');
  assert.equal(sim.takeEvents().lost, 0, 'going home is not a unit lost');
});

test('a soft bump leaves a unit running; a hard hit wrecks it and counts it lost', () => {
  const player = streetPlayer(9);
  const sim = new TrafficSim(net, { seed: 9, target: 0, rivals: 0, patrols: 0 });
  const spec = { mass: 1300, width: 1.75, length: 4.4, cgToFront: 1.2, wheelbase: 2.5, yawInertia: 2000 };
  const make = (closing) => {
    const a = sim.spawnUnit(player, 'police', 150, 400);
    a.pursuit = 'chase';
    a.x = player.x;
    a.z = player.z + 3.5;
    a.y = player.y;
    a.yaw = Math.PI;
    a.vx = 0;
    a.vz = -closing;
    a.speed = closing;
    const state = { ...player, yaw: 0, vx: 0, vz: 0, yawRate: 0 };
    sim.collideWithPlayer(state, spec);
    return a;
  };
  const soft = make(4);
  assert.notEqual(soft.mode, 'wreck', 'a nudge is not a wreck');
  const ev = sim.takeEvents();
  assert.equal(ev.lost, 0);
  assert.ok(ev.policeHit > 0, 'but it is a hit on a police car');
  const hard = make(25);
  assert.equal(hard.mode, 'wreck');
  assert.equal(sim.takeEvents().lost, 1, 'a wrecked unit is lost to the pursuit');
});
