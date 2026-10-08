import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Ground } from '../src/world/ground.js';
import { TrafficNet } from '../src/traffic/net.js';
import { TrafficSim } from '../src/traffic/sim.js';
import { DAMAGE, unitHealthScale } from '../src/police/units.js';

const ground = new Ground();
const net = new TrafficNet(ground.roads);

test("a step in the player's heading changes a unit's yaw rate by at most the grip cap and not before 0.15 s", () => {
  const sim = new TrafficSim(net, { seed: 101, target: 0, rivals: 0, patrols: 0 });
  const player = { x: 0, z: 60, speed: 20, vx: 0, vz: 20, yaw: 0 };
  const a = sim.spawnUnit(player, 'police', 10, 80);
  assert.ok(a);
  a.x = 0;
  a.z = 0;
  a.yaw = 0;
  a.speed = 20;
  a.pursuit = 'chase';
  a.free = true;

  const DT = 1 / 60;
  for (let t = 0; t < 1.0; t += DT) {
    player.z += player.vz * DT;
    sim.update(DT, player);
  }
  assert.equal(a.yawRate, 0, 'unit tracks straight ahead initially');

  player.yaw = Math.PI / 4;
  player.vx = player.speed * Math.sin(player.yaw);
  player.vz = player.speed * Math.cos(player.yaw);

  let reacted = false;
  for (let t = 0; t < 1.0; t += DT) {
    player.x += player.vx * DT;
    player.z += player.vz * DT;
    sim.update(DT, player);

    const gripCap = 8 / Math.max(1, a.speed);
    assert.ok(Math.abs(a.yawRate) <= gripCap + 1e-4, `yaw rate ${a.yawRate.toFixed(3)} must not exceed grip cap ${gripCap.toFixed(3)}`);

    if (t < 0.15) {
      assert.equal(a.yawRate, 0, `yaw rate must not change before 0.15 s (at t=${t.toFixed(3)})`);
    } else if (Math.abs(a.yawRate) > 1e-4) {
      reacted = true;
    }
  }
  assert.ok(reacted, 'the unit eventually reacts to the player turn after the delay');
});

test('a unit behind a stopped car in its path stops without contact', () => {
  const sim = new TrafficSim(net, { seed: 102, target: 0, rivals: 0, patrols: 0 });
  const player = { x: 0, z: 80, speed: 0, vx: 0, vz: 0, yaw: 0 };
  const a = sim.spawnUnit(player, 'police', 10, 80);
  assert.ok(a);
  a.x = 0;
  a.z = 0;
  a.yaw = 0;
  a.speed = 25;
  a.pursuit = 'chase';
  a.free = true;

  const blocker = sim.spawnUnit(player, 'sedan', 20, 100);
  assert.ok(blocker);
  blocker.x = 0;
  blocker.z = 40;
  blocker.yaw = 0;
  blocker.speed = 0;
  blocker.mode = 'parked';

  const DT = 1 / 30;
  const safeMinDist = (a.kind.length + blocker.kind.length) / 2;
  for (let t = 0; t < 6.0; t += DT) {
    sim.update(DT, player);
    const dist = Math.hypot(a.x - blocker.x, a.z - blocker.z);
    assert.ok(dist > safeMinDist, `no contact at t=${t.toFixed(2)}, dist=${dist.toFixed(2)} > safe=${safeMinDist.toFixed(2)}`);
  }
  assert.equal(a.speed, 0, 'the unit came to a complete stop');
  const finalDist = Math.hypot(a.x - blocker.x, a.z - blocker.z);
  assert.ok(finalDist > safeMinDist + 1.0, `stopped safely behind the blocker with buffer (${finalDist.toFixed(2)} m)`);
  assert.ok(finalDist < safeMinDist + 8.0, `stopped within reasonable distance of the blocker (${finalDist.toFixed(2)} m)`);
});

test('the speed curve is continuous and never rises as hit points fall', () => {
  let prevScale = unitHealthScale(1.0);
  assert.equal(prevScale, 1.0, 'full speed at 100% health');

  const steps = 1000;
  for (let i = 1; i <= steps; i++) {
    const h = 1.0 - i / steps;
    const scale = unitHealthScale(h);

    assert.ok(scale <= prevScale + 1e-9, `speed curve never rises as health falls: h=${h.toFixed(3)}, scale=${scale} <= prev=${prevScale}`);
    assert.ok(Math.abs(scale - prevScale) < 0.01, `speed curve is continuous: delta=${Math.abs(scale - prevScale)}`);
    assert.ok(scale >= DAMAGE.limpSpeed - 1e-9, `never drops below limpSpeed: scale=${scale}`);
    assert.ok(scale <= 1.0, `never exceeds 1.0: scale=${scale}`);
    prevScale = scale;
  }

  assert.equal(unitHealthScale(0.5), 1.0, '100% speed at 50% health');
  assert.equal(unitHealthScale(0.25), 0.85, '85% speed at 25% health');
  assert.equal(unitHealthScale(0), DAMAGE.limpSpeed, 'limpSpeed at 0% health');
});

test('below half health a unit driving free wobbles slightly on its aim', () => {
  const sim = new TrafficSim(net, { seed: 103, target: 0, rivals: 0, patrols: 0 });
  const player = { x: 0, z: 60, speed: 0, vx: 0, vz: 0, yaw: 0 };
  const a = sim.spawnUnit(player, 'police', 10, 80);
  assert.ok(a);
  a.x = 0;
  a.z = 0;
  a.yaw = 0;
  a.speed = 10;
  a.pursuit = 'chase';
  a.free = true;

  sim.update(1 / 30, player);

  a.hp = 40;
  const yaws = [];
  for (let t = 0; t < 2.0; t += 1 / 30) {
    sim.update(1 / 30, player);
    yaws.push(a.yaw);
  }
  const minYaw = Math.min(...yaws);
  const maxYaw = Math.max(...yaws);
  const span = maxYaw - minYaw;
  assert.ok(span > 0.05, `wobble causes yaw oscillation: span=${span.toFixed(3)} rad`);
});
