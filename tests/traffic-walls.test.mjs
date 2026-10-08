import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Ground } from '../src/world/ground.js';
import { TrafficNet } from '../src/traffic/net.js';
import { TrafficSim } from '../src/traffic/sim.js';
import { Colliders } from '../src/world/collision.js';

const ground = new Ground();
const net = new TrafficNet(ground.roads);
const DT = 1 / 30;

/** A sim whose world is one building, 20 m square, at (bx, bz). */
function withBuilding(bx, bz) {
  const colliders = new Colliders([], [{ x: bx, z: bz, hx: 10, hz: 10, yaw: 0 }]);
  const sim = new TrafficSim(net, { seed: 21, target: 0, rivals: 0, patrols: 0 });
  sim.hitWorld = (x, z, r, y) => {
    const c = colliders.probe(x, z, r, y);
    return c && { ...c };
  };
  return { sim, colliders };
}

/** Whether any of a car's three circles overlaps the building. */
function inside(colliders, a) {
  const r = a.kind.width / 2;
  const reach = a.kind.length / 2 - r;
  for (const along of [reach, 0, -reach]) {
    const c = colliders.probe(a.x + Math.sin(a.yaw) * along, a.z + Math.cos(a.yaw) * along, r - 0.05, a.y);
    if (c) return true;
  }
  return false;
}

/** A spot on a lane far from the building, for spawning. */
const anywhere = { x: 0, z: 0, speed: 0 };

test('a wreck sliding at a building stops at its face instead of passing through', () => {
  const { sim, colliders } = withBuilding(1000, 1000);
  const a = sim.spawnUnit(anywhere, 'police', 0, 4000);
  a.mode = 'wreck';
  a.x = 1000;
  a.z = 1000 - 30;
  a.y = 0;
  a.yaw = 0;
  a.vx = 0;
  a.vz = 25;
  for (let t = 0; t < 4; t += DT) {
    sim.stepWreck(a, DT);
    sim.collideWorld(a);
    assert.ok(!inside(colliders, a), `the wreck is never inside the building (t ${t.toFixed(2)}, z ${a.z.toFixed(2)})`);
  }
  assert.ok(a.z < 1000 - 10, `it stopped at the south face (z ${a.z.toFixed(2)})`);
  assert.ok(Math.hypot(a.vx, a.vz) < 2, 'and the wall took its speed');
});

test('a glancing hit at the nose turns the car; a square hit does not', () => {
  const spin = (yaw) => {
    const { sim } = withBuilding(1000, 1000);
    const a = sim.spawnUnit(anywhere, 'police', 0, 4000);
    a.mode = 'wreck';
    a.x = 1000 - 6;
    a.z = 1000 - 14;
    a.y = 0;
    a.yaw = yaw;
    a.vx = Math.sin(yaw) * 20;
    a.vz = Math.cos(yaw) * 20;
    a.yawRate = 0;
    for (let t = 0; t < 1; t += DT) {
      sim.stepWreck(a, DT);
      sim.collideWorld(a);
    }
    return Math.abs(a.yawRate);
  };
  assert.ok(spin(0.6) > spin(0) + 0.05, `an angled hit spins it (${spin(0.6).toFixed(2)} vs ${spin(0).toFixed(2)} rad/s)`);
});

test('a unit driving free at the player through a block stops at the wall, wrecked if it hit hard', () => {
  const { sim, colliders } = withBuilding(1000, 1000);
  const a = sim.spawnUnit(anywhere, 'police', 0, 4000);
  a.pursuit = 'chase';
  a.free = true;
  a.x = 1000;
  a.z = 1000 - 20;
  a.y = 0;
  a.yaw = 0;
  a.speed = 30;
  const player = { x: 1000, y: 0, z: 1000 + 40, speed: 0, vx: 0, vz: 0 };
  for (let t = 0; t < 3; t += DT) {
    sim.update(DT, player);
    if (!sim.agents.includes(a)) break;
    assert.ok(!inside(colliders, a), `never inside the block (t ${t.toFixed(2)})`);
  }
  assert.ok(a.z < 1000 - 10, 'it did not reach the far side');
  assert.equal(a.mode, 'wreck', 'a hit at about 27 m/s on a wall wrecks it');
  assert.equal(sim.takeEvents().lost, 1, 'and the pursuit loses it');
});

test('cars on their lanes are not touched by the wall test', () => {
  const { sim } = withBuilding(1000, 1000);
  let calls = 0;
  const inner = sim.hitWorld;
  sim.hitWorld = (x, z, r, y) => {
    calls++;
    return inner(x, z, r, y);
  };
  for (let i = 0; i < 5; i++) sim.spawn(anywhere, 0, 3000);
  for (let t = 0; t < 1; t += DT) sim.update(DT, anywhere);
  assert.equal(calls, 0, 'lane followers cost nothing');
});
