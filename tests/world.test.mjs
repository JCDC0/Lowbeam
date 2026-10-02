import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Ground } from '../src/world/ground.js';
import { STATIONS } from '../src/world/layout.js';

const g = new Ground();

test('every gas station has a flat concrete pad beside its road', () => {
  assert.equal(g.pads.length, STATIONS.length);
  assert.equal(g.pads.length, 3);
  for (const pad of g.pads) {
    const hit = g.at(pad.cx, pad.cz);
    assert.equal(hit.surface, 'concrete', pad.id);
    assert.ok(Math.abs(hit.h - pad.h) < 1e-6, pad.id);
  }
});

test('the road surface reports its own surface type and sits above the terrain', () => {
  for (const road of g.roads.roads) {
    for (let s = 5; s < road.path.length - 5; s += 25) {
      const p = road.path.sample(s);
      const hit = g.at(p.x, p.z);
      assert.ok(hit.road, `${road.id} at s=${s} is not on a road`);
      assert.ok(g.hf.at(p.x, p.z) <= hit.h + 0.01, `${road.id} terrain pokes through at s=${s}`);
    }
  }
});

test('the rally stage stays drivable: grades within the cap except at the jump', () => {
  const ss1 = g.roads.byId.get('ss1');
  const bump = ss1.path.nearest(ss1.def.bumps[0].at[0], ss1.def.bumps[0].at[1]).s;
  for (let s = 0; s < ss1.path.length - 10; s += 5) {
    if (Math.abs(s - bump) < 30) continue;
    const grade = Math.abs(ss1.grade(s, s + 10));
    assert.ok(grade <= ss1.def.maxGrade + 0.01, `grade ${grade.toFixed(3)} at s=${s}`);
  }
  assert.ok(ss1.path.length > 2500, `stage only ${ss1.path.length.toFixed(0)} m`);
});
