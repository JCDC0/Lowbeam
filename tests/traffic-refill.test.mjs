import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Ground } from '../src/world/ground.js';
import { TrafficNet } from '../src/traffic/net.js';
import { TrafficSim } from '../src/traffic/sim.js';

test('far from Route 1, where no street racer can spawn, the civilians are still refilled', () => {
  const ground = new Ground();
  const net = new TrafficNet(ground.roads);
  const express = [];
  const q = { x: 0, z: 0, tx: 0, tz: 1, y: 0 };
  for (const l of net.lanes.filter((l) => l.cls === 'expressway' && l.index > 0)) {
    for (let s = 0; s < l.length; s += 40) {
      net.sample(l, s, q);
      express.push([q.x, q.z]);
    }
  }
  let spot = null;
  for (const l of net.lanes.filter((l) => l.cls === 'street' || l.cls === 'arterial')) {
    net.sample(l, l.length / 2, q);
    if (express.every(([x, z]) => Math.hypot(x - q.x, z - q.z) > 520)) {
      spot = { x: q.x, y: q.y, z: q.z, yaw: Math.atan2(q.tx, q.tz), vx: 0, vz: 0, speed: 0 };
      break;
    }
  }
  assert.ok(spot, 'a street more than 520 m from Route 1');
  const sim = new TrafficSim(net, { seed: 5, target: 20, rivals: 5, patrols: 0 });
  for (let i = 0; i < 120; i++) sim.update(1 / 10, spot);
  const civilians = sim.agents.filter((a) => !sim.isRival(a) && !a.kind.lightBar);
  assert.ok(civilians.length >= 15, `${civilians.length} civilians after 12 s`);
});
