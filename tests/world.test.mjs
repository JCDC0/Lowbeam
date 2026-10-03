import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Ground } from '../src/world/ground.js';
import { STATIONS } from '../src/world/layout.js';

const g = new Ground();

test('every gas station has a flat concrete pad beside its road', () => {
  assert.equal(g.pads.length, STATIONS.length);
  assert.equal(g.pads.length, 4);
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
      // Ask from just above the surface, so a deck answers for itself.
      const hit = g.at(p.x, p.z, road.heightAt(s) + 0.3);
      assert.ok(hit.road, `${road.id} at s=${s} is not on a road`);
      assert.ok(g.hf.at(p.x, p.z) <= hit.h + 0.01, `${road.id} terrain pokes through at s=${s}`);
    }
  }
});

test('every road stays within its grade limit and every overpass clears what it crosses', () => {
  for (const road of g.roads.roads) {
    const limit = (road.def.maxGrade || 0.14) + (road.lifted ? 0.06 : 0.04);
    for (let s = 0; s < road.path.length - 12; s += 6) {
      const grade = Math.abs(road.grade(s, s + 12));
      assert.ok(grade <= limit, `${road.id} is ${(grade * 100).toFixed(1)} % at s=${s}, limit ${(limit * 100).toFixed(1)} %`);
    }
  }
  for (const id of ['r18', 'harbor', 'west', 'east']) {
    const art = g.roads.byId.get(id);
    assert.ok(art.lifted, `${id} has no overpass`);
    const top = Math.max(...art.lift);
    const peak = [];
    art.lift.forEach((v, i) => v >= top - 0.01 && peak.push(i));
    const mid = (peak.reduce((a, b) => a + b, 0) / peak.length) * art.path.step;
    const p = art.path.sample(mid);
    const hit = { road: null, s: 0, d: 0, h: 0, edge: 0 };
    assert.ok(g.roads.query(p.x, p.z, hit, 3), `${id}: nothing under its deck`);
    assert.ok(art.heightAt(mid) - hit.h > 5.5, `${id}: only ${(art.heightAt(mid) - hit.h).toFixed(1)} m over ${hit.road.id}`);
  }
});

test('the pass stays drivable and climbs to the ridge', () => {
  const kuro = g.roads.byId.get('kuro');
  for (let s = 0; s < kuro.path.length - 10; s += 5) {
    const grade = Math.abs(kuro.grade(s, s + 10));
    assert.ok(grade <= kuro.def.maxGrade + 0.01, `grade ${grade.toFixed(3)} at s=${s}`);
  }
  assert.ok(kuro.path.length > 5500, `pass only ${kuro.path.length.toFixed(0)} m`);
  assert.ok(Math.max(...kuro.h) - Math.min(...kuro.h) > 200, 'the pass should climb more than 200 m');
});
