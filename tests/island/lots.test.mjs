import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { DISTRICTS, LOTS } from '../../src/world/layout.js';
import { padDistance } from '../../src/world/ground.js';
import { lotBays, lotContents, lotFrame, toWorld } from '../../src/world/lots.js';
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

/** The lots the placement search of 0.10.18 added come after the thirteen laid by hand. */
const SEARCHED = LOTS.slice(13);

test('the search added a police station for every district it could, and each district has one near', () => {
  const stations = g.lots.filter((p) => p.lot.kind === 'police');
  assert.equal(stations.length, 10);
  assert.equal(stations[0].lot.id, 'police', 'the HQ stays first');
  let close = 0;
  for (const d of DISTRICTS) {
    const nearest = Math.min(...stations.map((p) => Math.hypot(p.cx - d.center[0], p.cz - d.center[1])));
    assert.ok(nearest < 1100, `${d.name} has no station within 1100 m (${nearest.toFixed(0)} m)`);
    if (nearest < 700) close++;
  }
  assert.ok(close >= 8, `only ${close} districts have a station within 700 m`);
});

test('no two lots of a kind stand within 250 m of each other', () => {
  for (let i = 0; i < g.lots.length; i++) {
    for (let j = i + 1; j < g.lots.length; j++) {
      const a = g.lots[i];
      const b = g.lots[j];
      if (a.lot.kind !== b.lot.kind) continue;
      const d = Math.hypot(a.cx - b.cx, a.cz - b.cz);
      assert.ok(d >= 250, `${a.lot.id} and ${b.lot.id} are ${d.toFixed(0)} m apart`);
    }
  }
});

test('the lots the search placed keep 14 m from every street and from every other lot', () => {
  for (const lot of SEARCHED) {
    const pad = g.lots.find((p) => p.lot === lot);
    for (const road of g.roads.roads) {
      if (road.id === lot.road) continue;
      const p = road.path;
      for (let i = 0; i < p.n; i += 1) {
        const dx = p.x[i] - pad.cx;
        const dz = p.z[i] - pad.cz;
        const u = Math.abs(dx * pad.ux + dz * pad.uz) - pad.hw;
        const v = Math.abs(dx * pad.vx + dz * pad.vz) - pad.hd;
        const d = Math.hypot(Math.max(u, 0), Math.max(v, 0));
        const min = road.def.cls === 'street' ? 13.5 : 5;
        assert.ok(d >= min || Math.max(u, v) > 40, `${road.id} passes ${d.toFixed(1)} m from ${lot.id}`);
      }
    }
    for (const other of [...g.lots, ...g.pads]) {
      if (other === pad) continue;
      const corner = [[pad.hw, pad.hd], [-pad.hw, pad.hd], [pad.hw, -pad.hd], [-pad.hw, -pad.hd]].map(([u, v]) => padDistance(other, pad.cx + pad.ux * u + pad.vx * v, pad.cz + pad.uz * u + pad.vz * v));
      assert.ok(Math.min(...corner) > 14, `${lot.id} is too close to ${other.id}`);
    }
  }
});

test('a police lot has its bays, each on the lot, facing the street and clear of the model\'s colliders', () => {
  const stations = g.lots.filter((p) => p.lot.kind === 'police');
  let total = 0;
  for (const pad of stations) {
    const bays = lotBays(pad);
    assert.equal(bays.length, pad.lot.model === 'police_hq' ? 5 : 3, pad.lot.id);
    total += bays.length;
    const f = lotFrame(pad);
    const boxes = models[pad.lot.model].colliders.map((c) => ({ x: c.x, z: c.z, hx: c.hx, hz: c.hz }));
    for (const b of bays) {
      assert.ok(padDistance(pad, b.x, b.z) < -1, `${pad.lot.id} has a bay off its lot`);
      const toRoad = pad.road.path.nearest(b.x, b.z);
      const ahead = pad.road.path.nearest(b.x + Math.sin(b.yaw) * 6, b.z + Math.cos(b.yaw) * 6);
      assert.ok(Math.abs(ahead.d) < Math.abs(toRoad.d), `${pad.lot.id} has a bay whose nose points away from the street`);
      assert.ok(Math.abs(b.yaw - f.yaw) < 1e-9);
      // the car's body in the model's frame: 1.8 by 4.6 m, its long side along local z
      const c = Math.cos(f.yaw);
      const s = Math.sin(f.yaw);
      const lx = (b.x - f.x) * c - (b.z - f.z) * s;
      const lz = (b.x - f.x) * s + (b.z - f.z) * c;
      for (const box of boxes) {
        const gapX = Math.abs(lx - box.x) - (box.hx + 0.9);
        const gapZ = Math.abs(lz - box.z) - (box.hz + 2.3);
        assert.ok(gapX > 0 || gapZ > 0, `a car in a bay of ${pad.lot.id} stands in a collider at (${box.x}, ${box.z})`);
      }
    }
  }
  assert.equal(total, 5 + 3 * (stations.length - 1));
  assert.deepEqual(lotBays(g.lots.find((p) => p.lot.kind === 'garage')), [], 'a garage has no police bays');
});
