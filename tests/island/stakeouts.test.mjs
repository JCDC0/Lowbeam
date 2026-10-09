import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STAKEOUTS, placeStakeouts } from '../../src/world/stakeouts.js';
import { Colliders } from '../../src/world/collision.js';
import { padDistance } from '../../src/world/ground.js';
import { clearLine } from '../../src/police/sight.js';
import { island, scattered } from '../island.mjs';

const g = island();
const w = scattered();
const colliders = new Colliders(w.circles, w.boxes);
const solid = (x, z, y) => colliders.solidAt(x, z, y) || g.hf.at(x, z) > y + 0.5;
const stations = g.lots.filter((p) => p.lot.kind === 'police');

/** The five points of a car's footprint: its center and four corners. */
function footprint(s) {
  const fx = Math.sin(s.yaw);
  const fz = Math.cos(s.yaw);
  const lx = Math.cos(s.yaw);
  const lz = -Math.sin(s.yaw);
  return [[0, 0], [2.2, 0.9], [2.2, -0.9], [-2.2, 0.9], [-2.2, -0.9]].map(([a, b]) => ({ x: s.x + fx * a + lx * b, z: s.z + fz * a + lz * b }));
}

test('there are about eighteen spots, each kind among them, with unique ids', () => {
  assert.ok(STAKEOUTS.length >= 16 && STAKEOUTS.length <= 20, `${STAKEOUTS.length} spots`);
  assert.equal(new Set(STAKEOUTS.map((s) => s.id)).size, STAKEOUTS.length);
  for (const kind of ['layby', 'route1', 'toll', 'mouth', 'pass']) assert.ok(STAKEOUTS.some((s) => s.kind === kind), `no ${kind} spot`);
  for (const s of STAKEOUTS) {
    assert.ok(Number.isFinite(s.x) && Number.isFinite(s.z) && Math.abs(s.yaw) <= Math.PI, s.id);
    assert.ok(s.roads.length > 0 && s.roads.every((id) => g.roads.byId.has(id)), `${s.id} watches a road that does not exist`);
  }
});

test('placeStakeouts gives every spot the ground\'s height', () => {
  const spots = placeStakeouts(g);
  assert.equal(spots.length, STAKEOUTS.length);
  for (const s of spots) assert.ok(Math.abs(s.y - g.hf.at(s.x, s.z)) < 0.5, `${s.id} is at ${s.y}`);
});

test('every spot is on land, level with the road it watches and not on a deck', () => {
  for (const s of STAKEOUTS) {
    const y = g.hf.at(s.x, s.z);
    assert.ok(y > 1.5, `${s.id} is in the water`);
    const near = s.roads.map((id) => g.roads.byId.get(id)).map((road) => ({ road, hit: road.path.nearest(s.x, s.z) }));
    const best = near.reduce((a, b) => (Math.abs(a.hit.d) < Math.abs(b.hit.d) ? a : b));
    assert.ok(Math.abs(y - best.road.heightAt(best.hit.s)) < 2, `${s.id} is not level with ${best.road.id}`);
    assert.ok(best.road.liftAt(best.hit.s) <= 0.5, `${s.id} stands beside a deck`);
    assert.ok(Math.abs(best.hit.d) < 40, `${s.id} is ${Math.abs(best.hit.d).toFixed(0)} m from the road it watches`);
  }
});

test('a spot keeps 80 m from every police station and 250 m from every other spot', () => {
  for (const s of STAKEOUTS) {
    for (const p of stations) assert.ok(Math.hypot(p.cx - s.x, p.cz - s.z) >= 80, `${s.id} is beside ${p.id}`);
  }
  for (let i = 0; i < STAKEOUTS.length; i++) {
    for (let j = i + 1; j < STAKEOUTS.length; j++) {
      const d = Math.hypot(STAKEOUTS[i].x - STAKEOUTS[j].x, STAKEOUTS[i].z - STAKEOUTS[j].z);
      assert.ok(d >= 250, `${STAKEOUTS[i].id} and ${STAKEOUTS[j].id} are ${d.toFixed(0)} m apart`);
    }
  }
});

test('a car at a spot is off every lane, off every pad and clear of every static shape', () => {
  const hit = { road: null, s: 0, d: 0, h: 0, edge: 0 };
  for (const s of STAKEOUTS) {
    for (const p of footprint(s)) {
      if (g.roads.query(p.x, p.z, hit, 0)) assert.ok(hit.edge + hit.road.walk >= 0.5, `${s.id} stands on the tarmac of ${hit.road.id}`);
    }
    for (const pad of g.flats) assert.ok(padDistance(pad, s.x, s.z) > 3, `${s.id} is on ${pad.id}`);
    const y = g.hf.at(s.x, s.z);
    for (const a of [-1.3, 0, 1.3]) {
      const c = colliders.probe(s.x + Math.sin(s.yaw) * a, s.z + Math.cos(s.yaw) * a, 1.15, y);
      assert.equal(c, null, `${s.id} is inside something`);
    }
  }
});

test('from a spot the officer sees at least four of the six stretches of the road it watches', () => {
  for (const s of STAKEOUTS) {
    const y = g.hf.at(s.x, s.z);
    let best = 0;
    for (const id of s.roads) {
      const road = g.roads.byId.get(id);
      const s0 = road.path.nearest(s.x, s.z).s;
      let seen = 0;
      for (const ds of [-60, -40, -20, 20, 40, 60]) {
        const at = road.path.wrapS(s0 + ds);
        const q = road.path.sample(at);
        if (clearLine({ x: s.x, y, z: s.z }, { x: q.x, y: road.heightAt(at), z: q.z }, solid)) seen++;
      }
      best = Math.max(best, seen);
    }
    assert.ok(best >= 4, `${s.id} sees ${best} of 6`);
  }
});
