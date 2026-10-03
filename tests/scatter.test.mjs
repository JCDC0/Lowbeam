import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Ground, padDistance } from '../src/world/ground.js';
import { LAMP_REACH, scatterWorld } from '../src/world/scatter.js';

const g = new Ground();
const w = scatterWorld(g);

test('street lamps stand off the road and reach over it', () => {
  assert.ok(w.lamps.length > 30, `only ${w.lamps.length} lamps`);
  for (const l of w.lamps) {
    // A pole may stand on a sidewalk, never on the carriageway.
    const hit = g.at(l.x, l.z);
    if (hit.road) assert.ok(Math.abs(hit.d) > hit.road.hwAt(hit.s) + 0.3, `lamp pole on a road at ${l.x.toFixed(0)}, ${l.z.toFixed(0)}`);
    assert.ok(Math.abs(Math.hypot(l.hx - l.x, l.hz - l.z) - LAMP_REACH) < 1e-6);
  }
});

test('trees and buildings keep clear of roads and pads', () => {
  assert.ok(w.trees.length > 5000, `only ${w.trees.length} trees`);
  for (const t of w.trees) {
    const hit = g.at(t.x, t.z);
    assert.equal(hit.road, null);
    assert.equal(hit.pad, null);
  }
  assert.ok(w.buildings.length > 40, `only ${w.buildings.length} buildings`);
  for (const b of w.buildings) {
    for (const pad of g.pads) assert.ok(padDistance(pad, b.x, b.z) > Math.max(b.w, b.d) / 2, `building in pad ${pad.id}`);
    const c = Math.cos(b.yaw);
    const s = Math.sin(b.yaw);
    for (const [a, d] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      const x = b.x + ((a * b.w) / 2) * c + ((d * b.d) / 2) * s;
      const z = b.z - ((a * b.w) / 2) * s + ((d * b.d) / 2) * c;
      assert.equal(g.at(x, z).road, null, `building corner on a road at ${x.toFixed(0)}, ${z.toFixed(0)}`);
    }
  }
});

test('every station has pumps on its pad and baked canopy lights', () => {
  assert.equal(w.stations.length, 4);
  for (const st of w.stations) {
    assert.ok(st.pumps.length >= 2, st.pad.id);
    for (const p of st.pumps) assert.ok(padDistance(st.pad, p.x, p.z) < 0, `${st.pad.id} pump off the pad`);
    assert.ok(st.canopyLights.length >= 2, st.pad.id);
  }
});
