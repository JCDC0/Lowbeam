import { island, scattered } from '../island.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { COVER, CoverGrid, NONE, coverAt, placeRoofs } from '../../src/world/rain-cover.js';

const g = island();
const world = scattered();
const roofs = placeRoofs(world.stations, world.highway.plazas);
const cover = coverAt(g, roofs);

/** A point `d` meters left of the Kurogane Line's road `id` at arc length `s`. */
function beside(id, s, d) {
  const road = g.roads.byId.get(id);
  const q = road.path.sample(s);
  const q2 = road.path.sample(s + 2);
  const yaw = Math.atan2(q2.x - q.x, q2.z - q.z);
  return { x: q.x + Math.cos(yaw) * d, z: q.z - Math.sin(yaw) * d, h: g.at(q.x, q.z).h };
}

test('the sky is open over a street and shut under the Kurogane Line', () => {
  const street = beside('dori', 400, 0);
  assert.equal(cover(street.x, street.z), NONE, 'no roof over the avenue where the line is not');
  const under = beside('dori', 1400, 5);
  const top = cover(under.x, under.z);
  assert.ok(top > under.h + 8, `a deck ${top - under.h} m over the avenue`);
  const apart = beside('dori', 1400, 30);
  assert.equal(cover(apart.x, apart.z), NONE, 'open 30 m from the deck');
});

test('over a deck the cover is the deck surface, so rain above it still falls on the road', () => {
  const road = g.roads.byId.get('c3-f');
  const s = road.path.length / 2;
  const q = road.path.sample(s);
  assert.ok(Math.abs(cover(q.x, q.z) - road.heightAt(s)) < 0.6, 'the roof is the deck itself');
});

test('a gas station canopy and a toll plaza canopy cover their ground', () => {
  for (const st of world.stations) {
    const c = st.layout.canopy;
    const su = Math.sign(st.pad.ux * st.pad.vz + st.pad.uz * -st.pad.vx) || 1;
    const lx = ((Math.min(c.u0 * su, c.u1 * su) + Math.max(c.u0 * su, c.u1 * su)) / 2);
    const lz = (c.v0 + c.v1) / 2;
    const x = st.pad.cx + st.pad.vz * lx + st.pad.vx * lz;
    const z = st.pad.cz - st.pad.vx * lx + st.pad.vz * lz;
    assert.ok(cover(x, z) > st.pad.h + c.h, `${st.pad.id}: the canopy is a roof`);
  }
  for (const pl of world.highway.plazas) {
    assert.ok(cover(pl.x, pl.z) > pl.y + 5.9, 'a plaza canopy covers the lanes');
    const out = { x: pl.x + Math.sin(pl.yaw) * 40, z: pl.z + Math.cos(pl.yaw) * 40 };
    assert.ok(cover(out.x, out.z) < pl.y + 5, 'and not 40 m up the road');
  }
});

test('the grid follows the camera, fills its cells from the cover and closes the slits between roofs', () => {
  const grid = new CoverGrid(cover);
  const p = beside('dori', 1400, 0);
  assert.equal(grid.follow(p.x, p.z), true, 'the first call fills the grid');
  assert.equal(grid.follow(p.x + 3, p.z - 3), false, 'a few meters off the middle changes nothing');
  assert.equal(grid.follow(p.x + 60, p.z), true, 'a long way off, it moves');
  grid.follow(p.x, p.z);
  let covered = 0;
  let wrong = 0;
  for (let i = 0; i < grid.cells; i += 3) {
    for (let j = 0; j < grid.cells; j += 3) {
      const x = grid.x0 + (i + 0.5) * COVER.cell;
      const z = grid.z0 + (j + 0.5) * COVER.cell;
      const v = grid.at(x, z);
      if (v > NONE / 2) covered++;
      if (cover(x, z) > NONE / 2 && Math.abs(v - cover(x, z)) > 1e-6) wrong++;
    }
  }
  assert.ok(covered > 20, `${covered} sampled cells under the deck`);
  assert.equal(wrong, 0, 'a cell with a roof keeps its height');
  for (let d = -6; d <= 6; d++) {
    const q = beside('dori', 1400, d);
    assert.ok(grid.at(q.x, q.z) > NONE / 2, `no stripe of sky ${d} m from the middle of the deck`);
  }
  assert.equal(grid.at(p.x + 500, p.z), NONE, 'outside the grid is open sky');
});
