import test from 'node:test';
import assert from 'node:assert/strict';
import { island, scattered, trafficNet } from '../island.mjs';
import { buildTurn } from '../../src/traffic/net.js';
import { Colliders } from '../../src/world/collision.js';
import { placeSignals, signalCircles } from '../../src/world/signals.js';
import { KINDS } from '../../src/traffic/kinds.js';

const g = island();
const net = trafficNet();
const world = scattered();
const circles = [...world.circles, ...signalCircles(placeSignals(net, g), g)];
const col = new Colliders(circles.slice(), world.boxes);

test('a car turning at every junction follows a curve clear of obstacles and on the road', () => {
  const widest = KINDS.find((k) => k.id === 'suv') || KINDS[0];
  const r = widest.width / 2;
  const reach = widest.length / 2 - r;
  const hit = { road: null, s: 0, d: 0, h: 0, edge: 0, lift: 0 };
  let tested = 0;
  let cleanClips = 0;
  let cleanRoad = 0;

  for (const node of net.nodes) {
    const lanes = net.lanes.filter((l) => l.stops.some((st) => st.node === node));
    for (const l of lanes) {
      const st = l.stops.find((s) => s.node === node);
      if (!st) continue;
      const turns = l.mids.filter((m) => m.kind === 'turn' && Math.abs(m.at - st.s) < 25);
      for (const m of turns) {
        const p0 = net.sample(l, m.at, { x: 0, z: 0, tx: 0, tz: 1, y: 0 });
        const p1 = net.sample(m.lane, m.toS, { x: 0, z: 0, tx: 0, tz: 1, y: 0 });
        const curve = buildTurn(p0, p1);
        for (const speed of [8, 14]) {
          tested++;
          const dt = 1 / 30;
          let dist = 0;
          let turnClip = false;
          let turnOff = false;
          while (dist <= curve.length) {
            const u = dist / Math.max(0.001, curve.length);
            const pt = curve.at(u);
            if (!turnClip) {
              for (const along of [reach, 0, -reach]) {
                const cx = pt.x + Math.sin(pt.yaw) * along;
                const cz = pt.z + Math.cos(pt.yaw) * along;
                const c = col.probe(cx, cz, r - 0.1, pt.y);
                if (c) {
                  turnClip = true;
                  break;
                }
              }
            }
            if (!turnOff) {
              for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
                const bx = pt.x + Math.sin(pt.yaw) * sz * widest.length * 0.45 + Math.cos(pt.yaw) * sx * widest.width / 2;
                const bz = pt.z + Math.cos(pt.yaw) * sz * widest.length * 0.45 - Math.sin(pt.yaw) * sx * widest.width / 2;
                const onRoad = g.roads.query(bx, bz, hit, 0, -Infinity, pt.y);
                if (!onRoad || hit.edge > 0.1) {
                  turnOff = true;
                  break;
                }
              }
            }
            dist += speed * dt;
          }
          if (!turnClip) cleanClips++;
          if (!turnOff) cleanRoad++;
        }
      }
    }
  }

  assert.ok(tested > 8000, `tested ${tested} junction turns`);
  assert.ok(cleanClips / tested > 0.995, `clean clips ${cleanClips}/${tested}`);
  assert.ok(cleanRoad / tested > 0.995, `clean road ${cleanRoad}/${tested}`);
});
