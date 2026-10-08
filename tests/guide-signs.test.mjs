import test from 'node:test';
import assert from 'node:assert/strict';
import { Ground } from '../src/world/ground.js';
import { placeGuideSigns } from '../src/world/guide-signs.js';

const g = new Ground();
const signs = placeGuideSigns(g, []);
const hit = { road: null, s: 0, d: 0, h: 0, edge: 0 };

test('the avenue crossings have blue direction signs, each naming every way out once', () => {
  assert.ok(signs.length >= 15, `${signs.length} signs`);
  for (const s of signs) {
    assert.ok(s.ways.length >= 2, 'a sign with one way');
    const names = s.ways.map((w) => w.en);
    assert.equal(new Set(names).size, names.length, `${s.road}: ${names.join(', ')}`);
    for (const w of s.ways) assert.ok(w.jp, `${w.en} has no Japanese name`);
    assert.ok(s.ways.some((w) => Math.abs(w.angle) < 0.5) || s.ways.length === 2, 'no way straight on at a crossing');
  }
});

test('a sign hangs over its own lanes before the crossing, its pole on the sidewalk', () => {
  for (const s of signs) {
    const road = g.roads.byId.get(s.road);
    const h = road.path.nearest(s.x, s.z);
    const q = road.path.sample(h.s);
    const fx = Math.sin(s.yaw);
    const fz = Math.cos(s.yaw);
    assert.ok(Math.abs(q.tx * fx + q.tz * fz) > 0.9, 'the sign faces along its road');
    const left = (s.x - q.x) * fz - (s.z - q.z) * fx;
    assert.ok(left > 0 && left < road.hwAt(h.s), `${s.road}: panel ${left.toFixed(1)} m left of center`);
    // The first junction ahead on its road is an avenue crossing 20 to 80 m on.
    let first = null;
    let best = Infinity;
    for (const j of g.junctions) {
      const a = (j.x - s.x) * fx + (j.z - s.z) * fz;
      const side = Math.abs((j.x - s.x) * fz - (j.z - s.z) * fx);
      if (a > 0 && side < j.r + 12 && a < best) {
        best = a;
        first = j;
      }
    }
    assert.ok(first && best > 20 && best < 80, `${s.road}: the crossing is ${best.toFixed(0)} m ahead`);
    const avenues = new Set(first.arms.filter((a) => a.road.def.cls === 'arterial').map((a) => a.road.id));
    assert.ok(avenues.size >= 2, `${s.road}: the junction ahead is not an avenue crossing`);
    if (g.roads.query(s.px, s.pz, hit, 0)) assert.ok(Math.abs(hit.d) >= hit.road.hwAt(hit.s), `pole in ${hit.road.id}`);
  }
});
