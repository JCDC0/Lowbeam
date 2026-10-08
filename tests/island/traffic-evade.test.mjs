import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TrafficSim } from '../../src/traffic/sim.js';
import { KIND_BY_ID, RIVALS } from '../../src/traffic/kinds.js';
import { island, trafficNet } from '../island.mjs';

const ground = island();
const net = trafficNet();
const DT = 1 / 30;

/** A car of `kind` on lane `l` at `s`, driving at `speed`, and the sim it is in. */
function carOn(sim, l, s, speed, kind = KIND_BY_ID.get('sedan')) {
  const q = { x: 0, z: 0, tx: 0, tz: 0, y: 0 };
  net.sample(l, s, q);
  const a = sim.spawnUnit({ x: 0, z: 0, speed: 0 }, 'police', 0, 4000);
  a.kind = kind;
  a.inertia = (kind.mass * (kind.length ** 2 + kind.width ** 2)) / 12;
  a.pursuit = false;
  a.free = false;
  a.mode = 'drive';
  a.lane = l;
  a.s = s;
  a.factor = 1;
  a.plan = null;
  a.end = null;
  a.cap = Infinity;
  a.capUntil = 0;
  a.x = q.x;
  a.y = q.y;
  a.z = q.z;
  a.yaw = Math.atan2(q.tx, q.tz);
  a.speed = speed;
  a.vx = q.tx * speed;
  a.vz = q.tz * speed;
  a.ex = 0;
  a.ez = 0;
  return a;
}

/** The player `gap` m behind lane `l` at `s`, moving at `speed` along the lane. */
function playerBehind(l, s, gap, speed) {
  const q = { x: 0, z: 0, tx: 0, tz: 0, y: 0 };
  net.sample(l, s - gap, q);
  return { x: q.x, y: q.y, z: q.z, yaw: Math.atan2(q.tx, q.tz), speed, vx: q.tx * speed, vz: q.tz * speed };
}

/** Runs the sim for `seconds` with the player driving on, and reports what the car did. */
function watch(sim, a, l, P, seconds) {
  const lane0 = l;
  const out = { movedAt: null, vmax: a.speed, horns: [] };
  for (let t = 0; t < seconds; t += DT) {
    sim.update(DT, P);
    P.x += P.vx * DT;
    P.z += P.vz * DT;
    if (out.movedAt === null && a.lane !== lane0) out.movedAt = t;
    out.vmax = Math.max(out.vmax, a.speed);
    out.horns.push(...sim.takeSounds().horns.filter((h) => h.id === a.id));
  }
  return out;
}

test('a civilian with the player closing from 20 m behind moves over into a free lane within 3 s and honks', () => {
  const sim = new TrafficSim(net, { seed: 4, target: 0, rivals: 0, patrols: 0 });
  const l = net.lane('c1-f', 1, 1);
  const a = carOn(sim, l, 500, l.limit * 0.98);
  const out = watch(sim, a, l, playerBehind(l, 500, 20, a.speed + 12), 3);
  assert.ok(out.movedAt !== null && out.movedAt < 3, `it moved over at ${out.movedAt} s`);
  assert.equal(a.lane.index, l.index - 1, 'into the slow lane beside it');
  assert.ok(out.horns.some((h) => h.blast === 'short'), 'it honked a warning');
});

test('a racer closing from behind in the same lane makes a civilian move over at once', () => {
  const sim = new TrafficSim(net, { seed: 4, target: 0, rivals: 0, patrols: 0 });
  const l = net.lane('c1-f', 1, 1);
  const civ = carOn(sim, l, 500, l.limit * 0.98);
  const racer = carOn(sim, l, 480, civ.speed + 12, RIVALS[0]);
  racer.nextChange = Infinity;
  const out = watch(sim, civ, l, { x: 0, y: 0, z: 0, yaw: 0, speed: 0, vx: 0, vz: 0 }, 0.5);
  assert.ok(out.movedAt !== null && out.movedAt < 0.5, `it moved over at ${out.movedAt} s`);
});

test('with both lanes beside it taken, a civilian speeds up for a few seconds, up to 1.2 times its wanted speed, and honks', () => {
  const sim = new TrafficSim(net, { seed: 4, target: 0, rivals: 0, patrols: 0 });
  const l = net.lane('c1-f', 1, 1);
  const v = l.limit * 0.98;
  const a = carOn(sim, l, 500, v);
  for (const idx of [l.index - 1, l.index + 1]) {
    const other = carOn(sim, net.lane('c1-f', 1, idx), 500, v);
    other.nextChange = Infinity;
  }
  const out = watch(sim, a, l, playerBehind(l, 500, 20, v + 12), 1.4);
  assert.equal(a.lane, l, 'it stays in its lane');
  assert.ok(out.vmax > v + 1, `it speeds up: ${out.vmax.toFixed(1)} m/s from ${v.toFixed(1)}`);
  assert.ok(out.vmax <= l.limit * 1.2 + 0.01, `never past 1.2 times the wanted speed (${(l.limit * 1.2).toFixed(1)} m/s)`);
  assert.ok(out.horns.some((h) => h.blast === 'short'), 'it honked a warning');
});

test('a car closing slower than 8 m/s does not get out of the way', () => {
  const sim = new TrafficSim(net, { seed: 4, target: 0, rivals: 0, patrols: 0 });
  const l = net.lane('c1-f', 1, 1);
  const a = carOn(sim, l, 500, l.limit * 0.98);
  const out = watch(sim, a, l, playerBehind(l, 500, 20, a.speed + 5), 1.4);
  assert.equal(a.hurryUntil ?? 0, 0, 'it does not speed up');
  assert.ok(!out.horns.some((h) => h.blast === 'short'), 'it does not honk');
});

test('the warning horn sounds once per HORN_GAP for one car', () => {
  const sim = new TrafficSim(net, { seed: 4, target: 0, rivals: 0, patrols: 0 });
  const l = net.lane('c1-f', 1, 1);
  const a = carOn(sim, l, 500, 20);
  for (const t of [0, 1, 2]) {
    sim.time = t;
    sim.honk(a);
  }
  const first = sim.takeSounds().horns.filter((h) => h.id === a.id);
  assert.equal(first.length, 1, 'one honk inside the gap');
  sim.time = 3.5;
  sim.honk(a);
  assert.equal(sim.takeSounds().horns.filter((h) => h.id === a.id).length, 1, 'a second honk after the gap');
});
