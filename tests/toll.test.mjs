import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Ground } from '../src/world/ground.js';
import { placeHighway, SEGMENT } from '../src/world/highway.js';
import { TollMeter } from '../src/world/toll.js';
import { Colliders } from '../src/world/collision.js';
import { carById } from '../src/vehicles/specs.js';
import { createVehicleState } from '../src/vehicles/physics.js';

const g = new Ground();
const boxes = [];
const circles = [];
const lights = [];
const highway = placeHighway(g, boxes, circles, lights);
const pl = highway.plazas[0];
const fx = Math.sin(pl.yaw);
const fz = Math.cos(pl.yaw);
const at = (u, v) => ({ x: pl.x + fz * u + fx * v, z: pl.z - fx * u + fz * v });

test('crossing a plaza reads the speed, charges the toll and remembers the best', () => {
  const meter = new TollMeter(highway.plazas, {});
  const lane = pl.lanes[1];
  assert.equal(meter.step(at(lane.u, -3), at(lane.u, -1), 90, 0), null, 'not there yet');
  const first = meter.step(at(lane.u, -1), at(lane.u, 1.5), 187, 1);
  assert.ok(first, 'no event on crossing');
  assert.equal(first.id, pl.toll.id);
  assert.equal(first.speed, 187);
  assert.equal(first.fee, pl.toll.fee);
  assert.ok(first.record && first.best === 187);
  assert.equal(first.direction, 1);
  assert.equal(pl.lanes[first.lane].u, lane.u, 'wrong lane');
  assert.equal(meter.step(at(lane.u, 1.5), at(lane.u, 3), 187, 2), null, 'charged twice');
  assert.equal(meter.step(at(lane.u, 1), at(lane.u, -1), 140, 3), null, 'the cooldown should hold for a few seconds');
  const second = meter.step(at(lane.u, 1), at(lane.u, -1), 140, 20);
  assert.ok(second && !second.record && second.best === 187 && second.direction === -1);
});

test('a car outside the gate lanes, or beside the plaza, does not trigger it', () => {
  const meter = new TollMeter(highway.plazas, {});
  assert.equal(meter.step(at(40, -1), at(40, 1), 100, 0), null);
  assert.equal(meter.step(at(-40, 1), at(-40, -1), 100, 0), null);
});

test('best speeds carry over from the save', () => {
  const meter = new TollMeter(highway.plazas, { [pl.toll.id]: 250 });
  const u = pl.lanes[4].u;
  const e = meter.step(at(u, -1), at(u, 1), 200, 0);
  assert.ok(e && !e.record && e.best === 250);
});

test('the median has a barrier everywhere but at the plazas and the guard rails keep off ramps', () => {
  assert.ok(highway.barrier.length > 1500, `${highway.barrier.length} barrier segments`);
  assert.ok(highway.rails.length > 2000, `${highway.rails.length} rail segments`);
  for (const p of highway.plazas) {
    for (const s of highway.barrier) assert.ok(Math.hypot(s.x - p.x, s.z - p.z) > 20, 'barrier through a plaza');
  }
  for (const road of g.roads.roads.filter((r) => r.def.cls === 'ramp')) {
    for (let s = 20; s < road.path.length - 20; s += 25) {
      const q = road.path.sample(s);
      const clear = road.hwAt(s) + 0.5;
      const y = road.heightAt(s);
      for (const r of highway.rails) {
        if (Math.abs(r.y - y) > 2) continue;
        assert.ok(Math.hypot(r.x - q.x, r.z - q.z) > clear, `rail on ${road.id} at s=${s}`);
      }
    }
  }
  assert.equal(SEGMENT, 6);
});

test('a car cannot drive across the median but can use the lanes between the booths', () => {
  const spec = carById('hayate');
  const col = new Colliders(circles, boxes);
  const seg = highway.barrier[Math.floor(highway.barrier.length / 3)];
  const s = createVehicleState(spec);
  s.x = seg.x;
  s.z = seg.z;
  s.y = seg.y;
  assert.ok(col.probe(s.x, s.z, spec.width / 2, s.y), 'the median barrier is not solid');
  const lane = pl.lanes[1];
  const p = at(lane.u, 0);
  assert.equal(col.probe(p.x, p.z, spec.width / 2, pl.y), null, 'a gate lane is blocked');
  const booth = at(pl.dividers[0], 0);
  assert.ok(col.probe(booth.x, booth.z, spec.width / 2, pl.y), 'a booth island is not solid');
  assert.equal(col.probe(seg.x, seg.z, spec.width / 2, seg.y + 8), null, 'the barrier blocks something passing 8 m over it');
});
