import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { LOTS } from '../../src/world/layout.js';
import { lotContents, lotFrame, toWorld } from '../../src/world/lots.js';
import { scatterWorld } from '../../src/world/scatter.js';
import { island } from '../island.mjs';

const g = island();
const models = Object.fromEntries([...new Set(LOTS.map((l) => l.model))].map((m) => [m, JSON.parse(fs.readFileSync(new URL(`../../assets/models/${m}.json`, import.meta.url), 'utf8'))]));

test('every landmark model exists and is a sane low-poly mesh', () => {
  for (const [name, m] of Object.entries(models)) {
    assert.equal(m.position.length, m.normal.length, name);
    assert.equal(m.position.length / 3, m.uv.length / 2, name);
    const verts = m.position.length / 3;
    assert.ok(verts % 3 === 0 && verts < 6000, `${name} has ${verts} vertices`);
    assert.equal(m.groups.reduce((a, gr) => a + gr.count, 0), verts, name);
    assert.ok(m.colliders.length > 3 && m.lights.length > 0, name);
  }
});

test('every lot is on land, flat, and clear of every road but its own', () => {
  const hit = { road: null };
  for (const pad of g.lots) {
    for (let u = -pad.hw + 1; u <= pad.hw - 1; u += 4) {
      for (let v = -pad.hd + 1; v <= pad.hd - 1; v += 4) {
        const x = pad.cx + pad.ux * u + pad.vx * v;
        const z = pad.cz + pad.uz * u + pad.vz * v;
        if (g.roads.query(x, z, hit, 1)) assert.equal(hit.road.id, pad.lot.road, `${pad.lot.id} overlaps ${hit.road.id}`);
        const at = g.at(x, z);
        assert.notEqual(at.surface, 'water', `${pad.lot.id} is in the water`);
        if (!at.road) assert.ok(Math.abs(at.h - pad.h) < 0.05, `${pad.lot.id} is not flat at ${u}, ${v}`);
      }
    }
  }
});

test('a model faces its road and its colliders and lights land on its lot', () => {
  const { boxes, lights } = lotContents(g.lots, models);
  const total = LOTS.reduce((a, l) => a + models[l.model].colliders.length, 0);
  assert.equal(boxes.length, total);
  for (const pad of g.lots) {
    const f = lotFrame(pad);
    const front = toWorld(f, 0, pad.hd);
    const road = g.roads.byId.get(pad.lot.road);
    const toRoad = Math.abs(road.path.nearest(front[0], front[1]).d);
    const back = toWorld(f, 0, -pad.hd);
    assert.ok(toRoad < Math.abs(road.path.nearest(back[0], back[1]).d), `${pad.lot.id} turns its back to the road`);
  }
  for (const l of lights) assert.ok(g.lots.some((p) => Math.hypot(p.cx - l.x, p.cz - l.z) < Math.hypot(p.hw, p.hd) + 5));
});

test('the scatter takes the lots\' colliders and lights, and builds nothing on a lot', () => {
  const w = scatterWorld(g, { models });
  const lot = lotContents(g.lots, models);
  assert.ok(lot.boxes.every((b) => w.boxes.includes(b) || w.boxes.some((o) => o.x === b.x && o.z === b.z)));
  for (const b of w.buildings) {
    for (const pad of g.lots) {
      const dx = b.x - pad.cx;
      const dz = b.z - pad.cz;
      assert.ok(Math.abs(dx * pad.ux + dz * pad.uz) > pad.hw || Math.abs(dx * pad.vx + dz * pad.vz) > pad.hd, `a building stands on ${pad.lot.id}`);
    }
  }
});
