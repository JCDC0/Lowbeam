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

const CLIP_EXCEPTIONS = new Set([
  '66:ginza-b0:f0->dori:f0', '66:ginza-b0:f0->dori:r0',
  '67:dori:f0->ginza-b1:r0', '67:dori:f1->ginza-b1:r0', '67:dori:r0->ginza-b1:r0', '67:ginza-b1:r0->dori:r0',
  '75:ginza-b10:f0->dori:f0', '75:ginza-b10:f0->dori:r0',
]);

const ROAD_EXCEPTIONS = new Set([
  '1:shin-b46:f0->r18:r0', '1:shin-a57:f0->r18:f0',
  '4:r18:r0->kitaw-b142:f0', '4:r18:r0->kitaw-b142:r0', '4:kitaw-a148:f0->r18:f0', '4:kitaw-a148:r0->r18:f0',
  '6:r18:r0->kitaw-a147:f0',
  '12:west:r0->shin-a57:r0',
  '13:kitaw-b132:f0->west:f0', '13:kitaw-b132:r0->west:f0',
  '15:nishi-b331:f0->west:f0',
  '16:west:r0->nishi-a348:r0',
  '17:west:r0->nishi-a346:r0', '17:nishi-a346:f0->west:f0', '17:nishi-a346:r0->west:f0',
  '20:minato-b91:f0->east:f0', '20:minato-b91:r0->east:f0',
  '22:east:r0->minato-a103:f0',
]);

test('a car turning at every junction follows a curve clear of obstacles and on the road', () => {
  const widest = KINDS.find((k) => k.id === 'suv') || KINDS[0];
  const r = widest.width / 2;
  const reach = widest.length / 2 - r;
  const hit = { road: null, s: 0, d: 0, h: 0, edge: 0, lift: 0 };
  let tested = 0;
  const unexpectedClips = [];
  const unexpectedRoadFails = [];

  for (let ni = 0; ni < net.nodes.length; ni++) {
    const node = net.nodes[ni];
    const lanes = net.lanes.filter((l) => l.stops.some((st) => st.node === node));
    for (const l of lanes) {
      const st = l.stops.find((s) => s.node === node);
      if (!st) continue;
      const turns = l.mids.filter((m) => m.kind === 'turn' && Math.abs(m.at - st.s) < 25);
      for (const m of turns) {
        tested++;
        const turnKey = `${ni}:${l.id}->${m.lane.id}`;
        const p0 = net.sample(l, m.at, { x: 0, z: 0, tx: 0, tz: 1, y: 0 });
        const p1 = net.sample(m.lane, m.toS, { x: 0, z: 0, tx: 0, tz: 1, y: 0 });
        const curve = buildTurn(p0, p1);
        let turnClip = false;
        let turnOff = false;
        for (let dist = 0; dist <= curve.length; dist += 0.25) {
          const u = dist / Math.max(0.001, curve.length);
          const pt = curve.at(u);
          if (!turnClip) {
            for (const along of [reach, 0, -reach]) {
              const cx = pt.x + Math.sin(pt.yaw) * along;
              const cz = pt.z + Math.cos(pt.yaw) * along;
              const c = col.probe(cx, cz, r - 0.1, pt.y);
              if (c) {
                turnClip = true;
                if (!CLIP_EXCEPTIONS.has(turnKey)) unexpectedClips.push(turnKey);
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
                if (!ROAD_EXCEPTIONS.has(turnKey)) unexpectedRoadFails.push(turnKey);
                break;
              }
            }
          }
        }
      }
    }
  }

  assert.ok(tested > 9000, `tested ${tested} junction turns`);
  assert.deepEqual(unexpectedClips, [], 'all turns clear of static obstacles except named exceptions');
  assert.deepEqual(unexpectedRoadFails, [], 'all turns on carriageway except named exceptions');
});
