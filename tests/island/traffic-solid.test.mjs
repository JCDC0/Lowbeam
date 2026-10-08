import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TrafficSim } from '../../src/traffic/sim.js';
import { KINDS } from '../../src/traffic/kinds.js';
import { CARS } from '../../src/vehicles/specs.js';
import { createVehicleState } from '../../src/vehicles/physics.js';
import { island, trafficNet } from '../island.mjs';

const ground = island();
const net = trafficNet();

function placeOn(sim, lane, s, speed, kind = KINDS[0]) {
  const q = { x: 0, z: 0, tx: 0, tz: 1, y: 0 };
  net.sample(lane, s, q);
  const a = {
    id: sim._nextId++,
    kind,
    paint: 0,
    lane,
    s,
    speed,
    factor: 1,
    x: q.x,
    y: q.y,
    z: q.z,
    yaw: Math.atan2(q.tx, q.tz),
    vx: 0,
    vz: 0,
    yawRate: 0,
    ex: 0,
    ez: 0,
    cap: Infinity,
    capUntil: 0,
    plan: null,
    end: null,
    changeDuration: 0,
    changeTimer: 0,
    changeStartX: 0,
    changeStartZ: 0,
    changePrevEx: 0,
    changePrevEz: 0,
    mode: /** @type {const} */ ('drive'),
    age: 0,
    wreckAge: 0,
    laneHold: 0,
    duel: false,
    signal: 0,
    signalTimer: 0,
    signalTarget: null,
    nextChange: 0,
    inertia: 1500,
    brake: 0,
    fade: 1,
  };
  sim.agents.push(a);
  return a;
}

test('no agent ends a 60 s run overlapping another or a parked unit, none deeper than 0.3 m', () => {
  const sim = new TrafficSim(net, { seed: 9, target: 36 });
  const player = { x: -300, z: -380, speed: 0 };
  sim.populate(player);

  const lane = sim.agents[0].lane;
  const qPark = net.sample(lane, sim.agents[0].s + 80, { x: 0, y: 0, z: 0, tx: 0, tz: 1, y: 0 });
  sim.spawnParked('police', { x: qPark.x, y: qPark.y, z: qPark.z, yaw: Math.atan2(qPark.tx, qPark.tz) }, lane, sim.agents[0].s + 80);

  let maxDepth = 0;
  for (let t = 0; t < 60; t += 1 / 30) {
    sim.update(1 / 30, player);
    for (let i = 0; i < sim.agents.length; i++) {
      for (let j = i + 1; j < sim.agents.length; j++) {
        const a = sim.agents[i];
        const b = sim.agents[j];
        if (Math.abs(a.y - b.y) > 2.5) continue;
        const dist = Math.hypot(a.x - b.x, a.z - b.z);
        const combinedRadius = (a.kind.width + b.kind.width) / 2;
        const reachA = Math.max(0, a.kind.length / 2 - a.kind.width / 2);
        const reachB = Math.max(0, b.kind.length / 2 - b.kind.width / 2);
        if (dist > reachA + reachB + combinedRadius) continue;

        const fxA = Math.sin(a.yaw), fzA = Math.cos(a.yaw);
        const fxB = Math.sin(b.yaw), fzB = Math.cos(b.yaw);
        const rA = a.kind.width / 2;
        const rB = b.kind.width / 2;
        for (let ia = -1; ia <= 1; ia++) {
          const cAx = a.x + fxA * ia * reachA;
          const cAz = a.z + fzA * ia * reachA;
          for (let ib = -1; ib <= 1; ib++) {
            const cBx = b.x + fxB * ib * reachB;
            const cBz = b.z + fzB * ib * reachB;
            const cd = Math.hypot(cAx - cBx, cAz - cBz);
            const d = rA + rB - cd;
            if (d > maxDepth) maxDepth = d;
          }
        }
      }
    }
  }

  assert.ok(maxDepth <= 0.3, `maximum penetration depth ${maxDepth.toFixed(3)} m exceeds 0.3 m`);

  let endingOverlaps = 0;
  for (let i = 0; i < sim.agents.length; i++) {
    for (let j = i + 1; j < sim.agents.length; j++) {
      const a = sim.agents[i];
      const b = sim.agents[j];
      if (Math.abs(a.y - b.y) > 2.5) continue;
      const reachA = Math.max(0, a.kind.length / 2 - a.kind.width / 2);
      const reachB = Math.max(0, b.kind.length / 2 - b.kind.width / 2);
      const rA = a.kind.width / 2, rB = b.kind.width / 2;
      const fxA = Math.sin(a.yaw), fzA = Math.cos(a.yaw);
      const fxB = Math.sin(b.yaw), fzB = Math.cos(b.yaw);
      let overlap = false;
      for (let ia = -1; ia <= 1; ia++) {
        const cAx = a.x + fxA * ia * reachA;
        const cAz = a.z + fzA * ia * reachA;
        for (let ib = -1; ib <= 1; ib++) {
          const cBx = b.x + fxB * ib * reachB;
          const cBz = b.z + fzB * ib * reachB;
          if (rA + rB - Math.hypot(cAx - cBx, cAz - cBz) > 0.05) overlap = true;
        }
      }
      if (overlap) endingOverlaps++;
    }
  }
  assert.equal(endingOverlaps, 0, `${endingOverlaps} pairs still overlap at the end of 60 s`);
});

test('a car meeting a roadblock across two of three lanes passes in the third lane', () => {
  const sim = new TrafficSim(net, { seed: 1, target: 0, rivals: 0, patrols: 0 });
  const l0 = net.lane('c1-f', 1, 0);
  const l1 = net.lane('c1-f', 1, 1);
  const l2 = net.lane('c1-f', 1, 2);

  const q0 = net.sample(l0, 1000, { x: 0, y: 0, z: 0, tx: 0, tz: 1, y: 0 });
  const q1 = net.sample(l1, 1000, { x: 0, y: 0, z: 0, tx: 0, tz: 1, y: 0 });
  sim.spawnParked('police', { x: q0.x, y: q0.y, z: q0.z, yaw: Math.atan2(q0.tx, q0.tz) }, l0, 1000);
  sim.spawnParked('police', { x: q1.x, y: q1.y, z: q1.z, yaw: Math.atan2(q1.tx, q1.tz) }, l1, 1000);

  const car = placeOn(sim, l1, 850, 25);
  const player = { x: q1.x, z: q1.z, speed: 0 };

  let passedInThird = false;
  for (let t = 0; t < 15; t += 1 / 30) {
    sim.update(1 / 30, player);
    if (car.s > 1020 && car.lane === l2) {
      passedInThird = true;
      break;
    }
  }

  assert.ok(passedInThird, 'car did not pass roadblock via the third open lane');
});

test('a car meeting a roadblock across all lanes stops 6 m short', () => {
  const sim = new TrafficSim(net, { seed: 1, target: 0, rivals: 0, patrols: 0 });
  const l0 = net.lane('c1-f', 1, 0);
  const l1 = net.lane('c1-f', 1, 1);
  const l2 = net.lane('c1-f', 1, 2);

  const q0 = net.sample(l0, 1000, { x: 0, y: 0, z: 0, tx: 0, tz: 1, y: 0 });
  const q1 = net.sample(l1, 1000, { x: 0, y: 0, z: 0, tx: 0, tz: 1, y: 0 });
  const q2 = net.sample(l2, 1000, { x: 0, y: 0, z: 0, tx: 0, tz: 1, y: 0 });
  sim.spawnParked('police', { x: q0.x, y: q0.y, z: q0.z, yaw: Math.atan2(q0.tx, q0.tz) }, l0, 1000);
  const u1 = sim.spawnParked('police', { x: q1.x, y: q1.y, z: q1.z, yaw: Math.atan2(q1.tx, q1.tz) }, l1, 1000);
  sim.spawnParked('police', { x: q2.x, y: q2.y, z: q2.z, yaw: Math.atan2(q2.tx, q2.tz) }, l2, 1000);

  const car = placeOn(sim, l1, 850, 25);
  const player = { x: q1.x, z: q1.z, speed: 0 };

  for (let t = 0; t < 20; t += 1 / 30) {
    sim.update(1 / 30, player);
  }

  const gapToBlock = (u1.s - u1.kind.length / 2) - (car.s + car.kind.length / 2);
  assert.ok(car.speed < 0.1, `car did not come to a stop, speed is ${car.speed.toFixed(2)} m/s`);
  assert.ok(gapToBlock >= 5.5 && gapToBlock <= 6.5, `expected stop gap near 6 m, got ${gapToBlock.toFixed(2)} m`);
});

test('a parked unit stays put below 6 m/s closing hit and moves when hit harder', () => {
  const l0 = net.lane('c1-f', 1, 0);
  const q0 = net.sample(l0, 1000, { x: 0, y: 0, z: 0, tx: 0, tz: 1, y: 0 });

  {
    const sim = new TrafficSim(net, { seed: 1, target: 0, rivals: 0, patrols: 0 });
    const parked = sim.spawnParked('police', { x: q0.x, y: q0.y, z: q0.z, yaw: Math.atan2(q0.tx, q0.tz) }, l0, 1000);
    const startX = parked.x, startZ = parked.z;
    const qHit = net.sample(l0, 1000 - parked.kind.length / 2 - 2.0, { x: 0, y: 0, z: 0, tx: 0, tz: 1, y: 0 });
    const hitter = {
      id: 999, kind: KINDS[0], paint: 0, lane: l0, s: 995, speed: 4, factor: 1,
      x: qHit.x, y: qHit.y, z: qHit.z, yaw: Math.atan2(q0.tx, q0.tz),
      vx: q0.tx * 4, vz: q0.tz * 4, yawRate: 0, ex: 0, ez: 0,
      cap: Infinity, capUntil: 0, plan: null, end: null, changeDuration: 0, changeTimer: 0,
      changeStartX: 0, changeStartZ: 0, changePrevEx: 0, changePrevEz: 0,
      mode: /** @type {const} */ ('knocked'), knockAge: 0, age: 0, wreckAge: 0, laneHold: 0, duel: false,
      signal: 0, signalTimer: 0, signalTarget: null, nextChange: 0, inertia: 1500, brake: 0, fade: 1,
    };
    sim.agents.push(hitter);
    sim.collideAgents();
    const moved = Math.hypot(parked.x - startX, parked.z - startZ);
    assert.equal(moved, 0, `parked unit moved by ${moved.toFixed(3)} m when hit at 4 m/s`);
    assert.equal(parked.mode, 'parked');
  }

  {
    const sim = new TrafficSim(net, { seed: 1, target: 0, rivals: 0, patrols: 0 });
    const parked = sim.spawnParked('police', { x: q0.x, y: q0.y, z: q0.z, yaw: Math.atan2(q0.tx, q0.tz) }, l0, 1000);
    const startX = parked.x, startZ = parked.z;
    const qHit = net.sample(l0, 1000 - parked.kind.length / 2 - 2.0, { x: 0, y: 0, z: 0, tx: 0, tz: 1, y: 0 });
    const hitter = {
      id: 999, kind: KINDS[0], paint: 0, lane: l0, s: 995, speed: 10, factor: 1,
      x: qHit.x, y: qHit.y, z: qHit.z, yaw: Math.atan2(q0.tx, q0.tz),
      vx: q0.tx * 10, vz: q0.tz * 10, yawRate: 0, ex: 0, ez: 0,
      cap: Infinity, capUntil: 0, plan: null, end: null, changeDuration: 0, changeTimer: 0,
      changeStartX: 0, changeStartZ: 0, changePrevEx: 0, changePrevEz: 0,
      mode: /** @type {const} */ ('knocked'), knockAge: 0, age: 0, wreckAge: 0, laneHold: 0, duel: false,
      signal: 0, signalTimer: 0, signalTarget: null, nextChange: 0, inertia: 1500, brake: 0, fade: 1,
    };
    sim.agents.push(hitter);
    sim.collideAgents();
    const moved = Math.hypot(parked.x - startX, parked.z - startZ);
    assert.ok(moved > 0.05, `parked unit did not move when hit at 10 m/s (moved ${moved.toFixed(3)} m)`);
    assert.equal(parked.mode, 'knocked');
  }
});

test('closing speed under 3 m/s pushes agents apart without knock, faster hit knocks them', () => {
  const l0 = net.lane('c1-f', 1, 0);
  const q0 = net.sample(l0, 1000, { x: 0, y: 0, z: 0, tx: 0, tz: 1, y: 0 });

  {
    const sim = new TrafficSim(net, { seed: 1, target: 0, rivals: 0, patrols: 0 });
    const a = placeOn(sim, l0, 1000, 20);
    const b = placeOn(sim, l0, 1000 - a.kind.length + 0.1, 22);
    b.vx = q0.tx * 22;
    b.vz = q0.tz * 22;
    a.vx = q0.tx * 20;
    a.vz = q0.tz * 20;
    sim.collideAgents();
    assert.equal(a.mode, 'drive', 'light nudge under 3 m/s must not knock');
    assert.equal(b.mode, 'drive', 'light nudge under 3 m/s must not knock');
  }

  {
    const sim = new TrafficSim(net, { seed: 1, target: 0, rivals: 0, patrols: 0 });
    const a = placeOn(sim, l0, 1000, 20);
    const b = placeOn(sim, l0, 1000 - a.kind.length + 0.1, 25);
    b.vx = q0.tx * 25;
    b.vz = q0.tz * 25;
    a.vx = q0.tx * 20;
    a.vz = q0.tz * 20;
    sim.collideAgents();
    assert.equal(a.mode, 'knocked', 'hit at 5 m/s closing speed must knock');
    assert.equal(b.mode, 'knocked', 'hit at 5 m/s closing speed must knock');
  }
});

test('a player ram at 20 m/s moves the unit and keeps the player moving forward', () => {
  const sim = new TrafficSim(net, { seed: 1, target: 0, rivals: 0, patrols: 0 });
  const l0 = net.lane('c1-f', 1, 0);
  const q0 = net.sample(l0, 1000, { x: 0, y: 0, z: 0, tx: 0, tz: 1, y: 0 });
  const parked = sim.spawnParked('police', { x: q0.x, y: q0.y, z: q0.z, yaw: Math.atan2(q0.tx, q0.tz) }, l0, 1000);
  const startX = parked.x, startZ = parked.z;

  const spec = CARS[0];
  const state = createVehicleState(spec);
  const qPlayer = net.sample(l0, 1000 - (parked.kind.length + spec.length) / 2 + 0.5, { x: 0, y: 0, z: 0, tx: 0, tz: 1, y: 0 });
  state.x = qPlayer.x;
  state.y = qPlayer.y;
  state.z = qPlayer.z;
  state.yaw = Math.atan2(q0.tx, q0.tz);
  state.vx = q0.tx * 20;
  state.vz = q0.tz * 20;

  const hit = sim.collideWithPlayer(state, spec);
  assert.ok(hit > 6, `expected hit > 6, got ${hit.toFixed(2)}`);
  const moved = Math.hypot(parked.x - startX, parked.z - startZ);
  assert.ok(moved > 0.05, `parked unit did not move (moved ${moved.toFixed(3)} m)`);
  const forwardSpeed = state.vx * q0.tx + state.vz * q0.tz;
  assert.ok(forwardSpeed > 0, `player did not keep forward momentum, forwardSpeed = ${forwardSpeed.toFixed(2)} m/s`);
});
