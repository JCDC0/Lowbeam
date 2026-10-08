import test from 'node:test';
import assert from 'node:assert/strict';
import { island } from '../island.mjs';
import { placeHighway } from '../../src/world/highway.js';
import { GANTRY } from '../../src/world/gantries.js';
import { SKIRT } from '../../src/world/roads.js';

const g = island();
const { gantries } = placeHighway(g, [], [], []);
const exits = g.roads.roads.filter((r) => r.def.slip?.kind === 'exit' && r.def.slip.carriageId.startsWith('c1-'));
const ahead = (C, from, to) => (((to - from) % C.path.length) + C.path.length) % C.path.length;

test('every Route 1 exit has a gantry at its exit lane, and most a second one about 500 m out', () => {
  assert.ok(exits.length >= 10);
  let far = 0;
  for (const r of exits) {
    const slip = r.def.slip;
    const C = g.roads.byId.get(slip.carriageId);
    const mine = gantries.filter((x) => x.ramp === r.def.id);
    const near = mine.find((x) => x.near);
    assert.ok(near, `${r.def.id} has no gantry at its exit lane`);
    const before = ahead(C, near.s, slip.attach[0]);
    assert.ok(before >= 20 && before <= 125, `${r.def.id}: near gantry ${before.toFixed(0)} m before the exit lane`);
    const f = mine.find((x) => !x.near);
    if (!f) continue;
    far++;
    const out = ahead(C, f.s, slip.nose);
    assert.ok(out >= 290 && out <= 660, `${r.def.id}: far gantry ${out.toFixed(0)} m out`);
    assert.equal(f.exit.distance, Math.round(out / 100) * 100);
  }
  assert.ok(far >= exits.length - 3, `only ${far} of ${exits.length} exits have a far gantry`);
});

test('a junction onto another expressway is signed JCT, an exit to the streets 出口', () => {
  for (const x of gantries) assert.equal(x.exit.jct, /BAYSHORE LINE|KUROGANE LINE/.test(x.exit.en), x.exit.en);
  assert.ok(gantries.some((x) => x.exit.jct) && gantries.some((x) => !x.exit.jct));
});

test('gantry posts stand clear of every other road and of each other', () => {
  const hit = { road: null, s: 0, d: 0, h: 0, edge: 0 };
  for (const x of gantries) {
    const lx = Math.cos(x.yaw);
    const lz = -Math.sin(x.yaw);
    const d = x.hw + GANTRY.post;
    const px = x.x + lx * d;
    const pz = x.z + lz * d;
    if (g.roads.query(px, pz, hit, SKIRT)) {
      assert.ok(hit.road.def.cls === 'expressway', `${x.carriage} at ${x.s.toFixed(0)}: outer post on ${hit.road.def.id}`);
    }
    assert.ok(x.outer < GANTRY.maxDrop + 0.5);
  }
  for (const a of gantries) {
    for (const b of gantries) {
      if (a === b || a.carriage !== b.carriage) continue;
      assert.ok(Math.hypot(a.x - b.x, a.z - b.z) > GANTRY.gap - 5, `${a.carriage}: gantries at ${a.s.toFixed(0)} and ${b.s.toFixed(0)}`);
    }
  }
});
