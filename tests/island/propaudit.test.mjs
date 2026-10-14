import test from 'node:test';
import assert from 'node:assert/strict';
import { island, scattered, trafficNet } from '../island.mjs';
import { auditProps, driveBands } from '../../tools/propaudit.mjs';

const found = auditProps(island(), trafficNet(), scattered());

/**
 * Gate 2 of the bug board, at 0 since T-01 (0.10.48): the Kurogane Line's portal legs keep off the
 * Ginza cross streets and the toll plazas widen their carriageways round the islands and booths.
 */
test('nothing solid stands where a car drives', () => {
  assert.deepEqual(found.map((f) => `${f.kind} at (${f.x.toFixed(1)}, ${f.z.toFixed(1)}): ${f.depth.toFixed(2)} m into ${f.where}`), []);
});

test('the audit sees a shape in a lane, at the lane\'s height only', () => {
  const net = trafficNet();
  const lane = net.lanes.find((l) => l.road.id === 'c3-f');
  const q = { x: 0, z: 0, tx: 0, tz: 1, y: 0 };
  net.sample(lane, lane.length / 2, q);
  const w = scattered();
  const probe = (/** @type {import('../../src/world/scatter.js').Circle} */ c) =>
    auditProps(island(), net, { ...w, circles: [c], boxes: [] }).filter((f) => f.x === c.x && f.z === c.z);
  assert.equal(probe({ x: q.x, z: q.z, r: 0.2, y0: q.y - 0.5, y1: q.y + 2 }).length, 1, 'a post on the deck stops a car on it');
  assert.equal(probe({ x: q.x, z: q.z, r: 0.2, y0: q.y + 3 }).length, 0, 'a beam over the deck does not');
});

test('a slip road is banded from where traffic joins it, not through its taper', () => {
  const { labels } = driveBands(trafficNet());
  assert.ok(labels.includes('r18-ramp-fx:f0'));
  const ramp = trafficNet().lanes.find((l) => l.id === 'r18-ramp-fx:f0');
  const joins = trafficNet().lanes.flatMap((l) => l.mids.filter((m) => m.lane === ramp));
  assert.ok(joins.length && joins.every((m) => m.toS > 40), 'traffic joins the exit ramp past its taper');
});
