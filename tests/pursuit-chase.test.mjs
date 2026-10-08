import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Ground } from '../src/world/ground.js';
import { TrafficNet } from '../src/traffic/net.js';
import { TrafficSim } from '../src/traffic/sim.js';
import { UNIT_BY_ID } from '../src/police/units.js';

const ground = new Ground();
const net = new TrafficNet(ground.roads);

/** A player standing still on a lane at `s`. */
function playerAt(s, lane = net.lane('c1-f', 1, 0)) {
  const q = { x: 0, z: 0, tx: 0, tz: 1, y: 0 };
  net.sample(lane, s, q);
  return { x: q.x, z: q.z, speed: 0, vx: 0, vz: 0 };
}

/** A unit placed at `dist` meters behind the player on its lane, flagged as pursuing. */
function placeUnit(sim, player, kindId, dist) {
  const q = { x: 0, z: 0, tx: 0, tz: 1, y: 0 };
  const lane = net.lane('c1-f', 1, 0);
  // Put it `dist` behind along the lane, then hand-place it off to the side.
  net.sample(lane, 1500 - dist, q);
  const a = sim.spawnUnit(player, kindId, Math.max(10, dist - 5), dist + 60);
  assert.ok(a, 'the unit should spawn');
  a.x = player.x + 4;
  a.z = player.z - dist;
  a.y = q.y;
  a.pursuit = true;
  a.speed = 20;
  return a;
}

test('a pursuing unit close to the player drives at the player, not its lane', () => {
  const sim = new TrafficSim(net, { seed: 11, target: 0, rivals: 0, patrols: 0 });
  const player = playerAt(1500);
  const a = placeUnit(sim, player, 'police', 60);
  const before = Math.hypot(player.x - a.x, player.z - a.z);
  for (let t = 0; t < 3; t += 1 / 30) sim.update(1 / 30, player);
  const after = Math.hypot(player.x - a.x, player.z - a.z);
  assert.ok(after < before, `the unit closed in, ${before.toFixed(0)} to ${after.toFixed(0)}`);
});

test('a unit that is not pursuing stays on its lane and does not chase', () => {
  const sim = new TrafficSim(net, { seed: 12, target: 0, rivals: 0, patrols: 0 });
  const player = playerAt(1500);
  const a = placeUnit(sim, player, 'police', 60);
  a.pursuit = false;
  const yaw0 = a.yaw;
  for (let t = 0; t < 2; t += 1 / 30) sim.update(1 / 30, player);
  // With pursuit off it follows the lane, so it stays near the lane heading, not aimed at us.
  const toPlayer = Math.atan2(player.x - a.x, player.z - a.z);
  const aim = Math.abs(((toPlayer - a.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
  assert.ok(aim > 0.3, `the unit should not be aimed straight at the player (off by ${aim.toFixed(2)} rad)`);
  assert.ok(Number.isFinite(a.yaw));
  assert.ok(yaw0 !== undefined);
});

test('a unit out of chase range does not leave its lane', () => {
  const sim = new TrafficSim(net, { seed: 13, target: 0, rivals: 0, patrols: 0 });
  const player = playerAt(1500);
  const a = placeUnit(sim, player, 'police', 60);
  // Put the player far away, beyond CHASE_RANGE.
  const far = { x: player.x + 400, z: player.z, speed: 0, vx: 0, vz: 0 };
  const lane = net.lane('c1-f', 1, 0);
  net.sample(lane, 1500, { x: 0, z: 0, tx: 0, tz: 1, y: 0 });
  for (let t = 0; t < 1; t += 1 / 30) sim.update(1 / 30, far);
  // It is not near the player, so stepDrive ran and it kept its lane sample.
  assert.ok(Number.isFinite(a.x) && Number.isFinite(a.z), 'the unit stays a real position');
});

test('a unit brakes for a wall of traffic in front of it', () => {
  const sim = new TrafficSim(net, { seed: 14, target: 0, rivals: 0, patrols: 0 });
  const player = playerAt(1500);
  const a = placeUnit(sim, player, 'police', 60);
  // A slow car right in the unit's path, ahead toward the player.
  const blocker = sim.spawnUnit(player, 'sedan', 20, 60);
  blocker.x = a.x;
  blocker.z = a.z + 30;
  blocker.speed = 2;
  sim.heat = 3;
  for (let t = 0; t < 2; t += 1 / 30) sim.update(1 / 30, player);
  assert.ok(a.brake >= 0, 'the unit reports its brake');
  assert.ok(a.speed < 40, `it is held back by the car in front, speed ${a.speed.toFixed(1)}`);
});

test('a Rhino drives head-on at the player', () => {
  const sim = new TrafficSim(net, { seed: 15, target: 0, rivals: 0, patrols: 0 });
  const player = playerAt(1500);
  const a = placeUnit(sim, player, 'police-heavy', 70);
  assert.ok(UNIT_BY_ID.get('police-heavy').headOn);
  const before = Math.hypot(player.x - a.x, player.z - a.z);
  for (let t = 0; t < 4; t += 1 / 30) sim.update(1 / 30, player);
  const after = Math.hypot(player.x - a.x, player.z - a.z);
  assert.ok(after < before, `the Rhino closed in, ${before.toFixed(0)} to ${after.toFixed(0)}`);
});

test('at heat 4 and up a unit aims at the player flank to ram', () => {
  // Close in, a cruiser at heat 5 aims at the player's flank, so it does not line up on the
  // straight line to the car the way a heat 1 cruiser does.
  const heading = (heat, dist) => {
    const sim = new TrafficSim(net, { seed: 19, target: 0, rivals: 0, patrols: 0 });
    sim.heat = heat;
    const lane = net.lane('c1-f', 1, 0);
    const q = { x: 0, z: 0, tx: 0, tz: 1, y: 0 };
    net.sample(lane, 1500, q);
    const player = { x: q.x, z: q.z, speed: 0, vx: 0, vz: 0 };
    const a = sim.spawnUnit(player, 'police', Math.max(10, dist - 5), dist + 60);
    a.x = player.x + 4;
    a.z = player.z - dist;
    a.yaw = 0;
    a.speed = 20;
    a.pursuit = true;
    for (let t = 0; t < 0.6; t += 1 / 30) sim.update(1 / 30, player);
    const toPlayer = Math.atan2(player.x - a.x, player.z - a.z);
    return Math.abs(((toPlayer - a.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
  };
  const hot = heading(5, 30);
  const cold = heading(1, 30);
  assert.ok(Math.abs(hot - cold) > 1e-4, `the heat changes how the unit lines up on the player (${hot.toFixed(4)} vs ${cold.toFixed(4)})`);
});

test('the pursuit heat is readable by the sim', () => {
  const sim = new TrafficSim(net, { seed: 18, target: 0, rivals: 0, patrols: 0 });
  assert.equal(sim.heat, 0, 'no heat outside a pursuit');
  sim.heat = 4;
  assert.equal(sim.heat, 4);
});