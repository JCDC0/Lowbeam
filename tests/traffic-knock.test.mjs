import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Ground } from '../src/world/ground.js';
import { TrafficNet } from '../src/traffic/net.js';
import { TrafficSim } from '../src/traffic/sim.js';
import { KIND_BY_ID } from '../src/traffic/kinds.js';
import { createVehicleState } from '../src/vehicles/physics.js';
import { carById } from '../src/vehicles/specs.js';

const ground = new Ground();
const net = new TrafficNet(ground.roads);
const DT = 1 / 30;
const spec = carById('hayate');
const anywhere = { x: 0, z: 0, speed: 0 };

/** A civilian of `kind` driving at `speed` on a lane, and the sim it is in. */
function civilian(kind, speed, sim = new TrafficSim(net, { seed: 4, target: 0, rivals: 0, patrols: 0 })) {
  const a = sim.spawnUnit(anywhere, 'police', 0, 4000);
  a.kind = KIND_BY_ID.get(kind);
  a.inertia = (a.kind.mass * (a.kind.length ** 2 + a.kind.width ** 2)) / 12;
  a.pursuit = false;
  a.speed = speed;
  a.vx = Math.sin(a.yaw) * speed;
  a.vz = Math.cos(a.yaw) * speed;
  return { sim, a };
}

/** The player's car right behind `a`, closing on it at `closing` m/s. */
function behind(a, closing) {
  const s = createVehicleState(spec);
  const fx = Math.sin(a.yaw);
  const fz = Math.cos(a.yaw);
  const gap = a.kind.length / 2 + spec.length / 2 - 0.5;
  s.x = a.x - fx * gap;
  s.z = a.z - fz * gap;
  s.y = a.y;
  s.yaw = a.yaw;
  s.vx = a.vx + fx * closing;
  s.vz = a.vz + fz * closing;
  s.speed = Math.hypot(s.vx, s.vz);
  return s;
}

test('a tap knocks a car off its line; it settles and drives on instead of becoming a wreck', () => {
  const { sim, a } = civilian('sedan', 14);
  const hit = sim.collideWithPlayer(behind(a, 5), spec);
  assert.ok(hit > 3, `the cars touched (${hit.toFixed(1)} m/s)`);
  assert.equal(a.mode, 'knocked');
  let t = 0;
  while (a.mode === 'knocked' && t < 8) {
    sim.stepKnocked(a, DT);
    t += DT;
  }
  assert.equal(a.mode, 'drive', `after ${t.toFixed(1)} s it is ${a.mode}`);
  assert.ok(t < 6, `it drove on after ${t.toFixed(1)} s`);
});

test('a hard hit wrecks a car', () => {
  const { sim, a } = civilian('sedan', 10);
  sim.collideWithPlayer(behind(a, 22), spec);
  assert.equal(a.mode, 'wreck');
});

test('a civilian hit under 18 m/s is knocked, not wrecked; a harder one wrecks it', () => {
  const soft = civilian('sedan', 14);
  const hit = soft.sim.collideWithPlayer(behind(soft.a, 17), spec);
  assert.ok(hit > 16 && hit < 18, `the hit was ${hit.toFixed(1)} m/s`);
  assert.equal(soft.a.mode, 'knocked', 'a 17 m/s hit knocks it off its line');
  const hard = civilian('sedan', 14);
  hard.sim.collideWithPlayer(behind(hard.a, 19), spec);
  assert.equal(hard.a.mode, 'wreck', 'a 19 m/s hit wrecks it');
});

test('a knocked car keeps its hazards off and is back in drive within 1.5 s, whatever the hit', () => {
  for (const closing of [5, 10, 15, 17]) {
    const { sim, a } = civilian('sedan', 14);
    sim.collideWithPlayer(behind(a, closing), spec);
    assert.equal(a.mode, 'knocked', `a ${closing} m/s hit knocks it`);
    let t = 0;
    let signal = a.signal;
    while (a.mode === 'knocked' && t < 3) {
      sim.stepKnocked(a, DT);
      signal = Math.max(signal, a.signal);
      t += DT;
    }
    assert.equal(signal, 0, `a ${closing} m/s hit leaves the hazards off`);
    assert.equal(a.mode, 'drive', `after ${t.toFixed(2)} s a ${closing} m/s knock is ${a.mode}`);
    assert.ok(t <= 1.5, `it drove on after ${t.toFixed(2)} s`);
  }
});

test('mass counts both ways: a kei car is thrown, a bus barely moves and stops the player', () => {
  const hitBy = (kind) => {
    const { sim, a } = civilian(kind, 0);
    const s = behind(a, 12);
    const v0 = Math.hypot(s.vx, s.vz);
    sim.collideWithPlayer(s, spec);
    return { thrown: Math.hypot(a.vx, a.vz), lost: v0 - Math.hypot(s.vx, s.vz) };
  };
  const kei = hitBy('kei');
  const bus = hitBy('bus');
  assert.ok(kei.thrown > bus.thrown * 5, `kei car ${kei.thrown.toFixed(1)} m/s, bus ${bus.thrown.toFixed(1)} m/s`);
  assert.ok(bus.lost > kei.lost * 1.6, `the player loses ${bus.lost.toFixed(1)} m/s on the bus, ${kei.lost.toFixed(1)} on the kei car`);
});

test('a knocked car sliding into another knocks that one too', () => {
  const { sim, a } = civilian('sedan', 0);
  const { a: b } = civilian('wagon', 0, sim);
  const fx = Math.sin(a.yaw);
  const fz = Math.cos(a.yaw);
  b.x = a.x + fx * 6;
  b.z = a.z + fz * 6;
  b.y = a.y;
  b.yaw = a.yaw;
  a.mode = 'knocked';
  a.knockAge = 0;
  a.vx = fx * 9;
  a.vz = fz * 9;
  for (let t = 0; t < 1.5 && b.mode === 'drive'; t += DT) {
    sim.stepKnocked(a, DT);
    sim.collideAgents();
  }
  assert.equal(b.mode, 'knocked', 'the second car was pushed off its line');
  assert.ok(Math.hypot(b.vx, b.vz) > 1, 'and moves');
});
