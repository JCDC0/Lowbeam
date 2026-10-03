import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Ground } from '../src/world/ground.js';
import { ROADS, STATIONS, TOLLS, WORLD_HALF, ZONES, CITY } from '../src/world/layout.js';
import { insideLoop, zoneAt, cityAmount, waterAmount } from '../src/world/zones.js';
import { buildMapData } from '../src/world/mapdata.js';
import { baseHeight } from '../src/world/heightfield.js';

const g = new Ground();
const byId = (id) => g.roads.byId.get(id);

test('every road and every station lies inside the map', () => {
  for (const r of g.roads.roads) {
    for (let i = 0; i < r.path.n; i += 10) {
      assert.ok(Math.abs(r.path.x[i]) < WORLD_HALF - 60 && Math.abs(r.path.z[i]) < WORLD_HALF - 60, `${r.id} leaves the map`);
    }
  }
  for (const st of STATIONS) {
    const road = byId(st.road);
    assert.ok(road, `${st.id} is on a road that does not exist`);
    const hit = road.path.nearest(st.near[0], st.near[1]);
    assert.ok(Math.abs(hit.d) < 8, `${st.id} is ${hit.d.toFixed(1)} m from ${st.road}`);
  }
});

test('Route 1 is a closed loop of two one-way carriageways at the same heights', () => {
  const f = byId('c1-f');
  const r = byId('c1-r');
  assert.ok(f.path.closed && r.path.closed);
  assert.ok(f.def.oneway && r.def.oneway);
  assert.ok(f.path.length > 9000 && r.path.length > 9000, `loop is ${(f.path.length / 1000).toFixed(1)} km`);
  for (let s = 0; s < f.path.length; s += 150) {
    const p = f.path.sample(s);
    const hit = r.path.nearest(p.x, p.z);
    assert.ok(Math.abs(hit.d) > 7 && Math.abs(hit.d) < 15, `carriageways ${Math.abs(hit.d).toFixed(1)} m apart at s=${s}`);
    assert.ok(Math.abs(r.heightAt(hit.s) - f.heightAt(s)) < 0.5, `carriageways differ by ${(r.heightAt(hit.s) - f.heightAt(s)).toFixed(2)} m at s=${s}`);
  }
});

test('the four avenues pass over Route 1 and have a ramp pair on each carriageway', () => {
  for (const id of ['r18', 'harbor', 'west', 'east']) {
    const art = byId(id);
    assert.ok(art.lifted, id);
    for (const tag of ['fx', 'fn', 'rx', 'rn']) {
      const ramp = byId(`${id}-ramp-${tag}`);
      assert.ok(ramp, `${id} has no ${tag} ramp`);
      const end = tag.endsWith('x') ? ramp.path.n - 1 : 0;
      const hit = art.path.nearest(ramp.path.x[end], ramp.path.z[end]);
      assert.ok(Math.abs(hit.d) < 2.5, `${id}-${tag} meets the avenue ${hit.d.toFixed(1)} m off its center`);
      assert.ok(art.liftAt(hit.s) < 1.5, `${id}-${tag} meets the avenue on the deck`);
      const carriage = byId(tag.startsWith('f') ? 'c1-f' : 'c1-r');
      const join = tag.endsWith('x') ? 0 : ramp.path.n - 1;
      const c = carriage.path.nearest(ramp.path.x[join], ramp.path.z[join]);
      assert.ok(Math.abs(c.d) < 12, `${id}-${tag} starts ${Math.abs(c.d).toFixed(1)} m from its carriageway`);
    }
  }
});

test('roads only cross each other at overpasses', () => {
  const lines = g.roads.roads.map((r) => {
    const pts = [];
    for (let s = 0; s < r.path.length; s += 10) {
      const q = r.path.sample(s);
      pts.push([q.x, q.z, r.liftAt(s)]);
    }
    return pts;
  });
  const ccw = (a, b, c) => (c[1] - a[1]) * (b[0] - a[0]) > (b[1] - a[1]) * (c[0] - a[0]);
  const cross = (a, b, c, d) => ccw(a, c, d) !== ccw(b, c, d) && ccw(a, b, c) !== ccw(a, b, d);
  const flat = [];
  for (let a = 0; a < lines.length; a++) {
    for (let b = a + 1; b < lines.length; b++) {
      const ra = g.roads.roads[a];
      const rb = g.roads.roads[b];
      const streets = /^k-/.test(ra.id) && /^k-/.test(rb.id);
      for (let i = 0; i + 1 < lines[a].length && !streets; i++) {
        for (let j = 0; j + 1 < lines[b].length; j++) {
          if (Math.abs(lines[a][i][0] - lines[b][j][0]) > 30 || Math.abs(lines[a][i][1] - lines[b][j][1]) > 30) continue;
          if (!cross(lines[a][i], lines[a][i + 1], lines[b][j], lines[b][j + 1])) continue;
          const deck = lines[a][i][2] > 2 || lines[b][j][2] > 2;
          // Ramps end on the avenue they serve; that is a junction, not a crossing.
          const junction = /ramp/.test(ra.id + rb.id);
          if (!deck && !junction) flat.push(`${ra.id} x ${rb.id} near ${lines[a][i][0].toFixed(0)}, ${lines[a][i][1].toFixed(0)}`);
        }
      }
    }
  }
  assert.deepEqual(flat, [], `roads cross on the ground: ${flat.join('; ')}`);
});

test('no grade breaks or lips at road joins', () => {
  let maxLip = 0;
  let maxGradeBreak = 0;
  for (const r of g.roads.roads) {
    if (r.def.link) {
      for (const [targetEnd, sRamp] of [[r.def.link.from, 0], [r.def.link.to, r.path.length]]) {
        const target = g.roads.byId.get(targetEnd.id);
        if (!target) continue;
        const hRamp = r.heightAt(sRamp);
        const hTarget = target.heightAt(targetEnd.s);
        const lip = Math.abs(hRamp - hTarget);
        maxLip = Math.max(maxLip, lip);
        const gRamp = sRamp === 0 ? r.grade(0, 6) : r.grade(r.path.length - 6, r.path.length);
        const gTarget = target.grade(target.path.wrapS(targetEnd.s - 3), target.path.wrapS(targetEnd.s + 3));
        maxGradeBreak = Math.max(maxGradeBreak, Math.abs(gRamp - gTarget));
      }
    }
  }
  for (const [aId, sA, bId, sB] of [
    ['r18', 0, 'k-ns5', 0],
    ['west', g.roads.byId.get('west').path.length, 'k-ew3', 140],
    ['east', 0, 'k-ew3', g.roads.byId.get('k-ew3').path.length - 140],
    ['harbor', 0, 'k-ns5', g.roads.byId.get('k-ns5').path.length],
  ]) {
    const a = g.roads.byId.get(aId), b = g.roads.byId.get(bId);
    maxLip = Math.max(maxLip, Math.abs(a.heightAt(sA) - b.heightAt(sB)));
  }
  assert.ok(maxLip < 0.05, `join lip exceeds 5 cm: ${(maxLip * 100).toFixed(1)} cm`);
  assert.ok(maxGradeBreak < 0.06, `grade break exceeds 6%: ${(maxGradeBreak * 100).toFixed(1)}%`);
});

test('ramps taper into Route 1 with gores and matching heights', () => {
  const ramps = g.roads.roads.filter((r) => r.def.cls === 'ramp');
  assert.equal(ramps.length, 16);
  for (const ramp of ramps) {
    assert.ok(ramp.def.gore, `ramp ${ramp.id} missing gore definition`);
    const carriage = g.roads.byId.get(ramp.def.gore.carriageId);
    assert.ok(carriage, `carriageway missing for ${ramp.id}`);
    const exit = ramp.def.gore.kind === 'exit';
    const sRamp = exit ? 0 : ramp.path.length;
    const sCarriage = ramp.def.gore.carriageS;
    const diffH = Math.abs(ramp.heightAt(sRamp) - carriage.heightAt(sCarriage));
    assert.ok(diffH < 0.02, `${ramp.id} height diff at gore is ${(diffH * 100).toFixed(1)} cm`);
    const pRamp = ramp.path.sample(sRamp);
    const hit = carriage.path.nearest(pRamp.x, pRamp.z);
    const innerDist = Math.abs(hit.d) - ramp.hw;
    assert.ok(Math.abs(innerDist - carriage.hw) < 0.1, `${ramp.id} inner edge offset ${innerDist.toFixed(2)} m does not touch carriageway ${carriage.hw} m`);
  }
});

test('the toll plazas sit on both carriageways of Route 1', () => {
  assert.equal(TOLLS.length, 3);
  for (const t of TOLLS) {
    for (const id of ['c1-f', 'c1-r']) {
      const hit = byId(id).path.nearest(t.x, t.z);
      assert.ok(Math.abs(hit.d) < 9, `${t.id} is ${Math.abs(hit.d).toFixed(1)} m from ${id}`);
    }
  }
});

test('the zones answer where things are', () => {
  assert.equal(zoneAt(0, 1300).id, 'city');
  assert.equal(zoneAt(950, -1450).id, 'kami');
  assert.equal(zoneAt(-2500, -600).id, 'pass');
  assert.equal(zoneAt(2900, 2900), null);
  assert.ok(insideLoop(0, 1300) && insideLoop(-1000, 400) && !insideLoop(0, -1000) && !insideLoop(2500, 1000));
  assert.equal(cityAmount((CITY.x0 + CITY.x1) / 2, (CITY.z0 + CITY.z1) / 2), 1);
  assert.equal(cityAmount(2000, -2000), 0);
  assert.ok(waterAmount(950, -1450 - 180) > 0.9 && waterAmount(0, 2700) > 0.99 && waterAmount(0, 1000) === 0);
  for (const z of ZONES) assert.ok(z.rect || z.circle, z.id);
});

test('the terrain has a bay in the south, mountains around the edge and flat ground downtown', () => {
  assert.ok(baseHeight(0, 2800) < -3, 'the bay should be below the water');
  assert.ok(baseHeight(-2900, -1200) > 150, 'the western mountains should be high');
  assert.ok(baseHeight(0, -2900) > 120, 'the northern mountains should be high');
  const c = [(CITY.x0 + CITY.x1) / 2, (CITY.z0 + CITY.z1) / 2];
  for (const [dx, dz] of [[-300, -200], [300, 200], [0, 0], [200, -300]]) assert.ok(Math.abs(baseHeight(c[0] + dx, c[1] + dz) - 6.5) < 2.5, 'downtown is not flat');
});

test('the map data lists every road, station and toll for a full-screen map', () => {
  const data = buildMapData(g);
  assert.equal(data.roads.length, ROADS.length);
  assert.equal(data.bounds.half, WORLD_HALF);
  assert.equal(data.pois.filter((p) => p.kind === 'station').length, STATIONS.length);
  assert.equal(data.pois.filter((p) => p.kind === 'toll').length, TOLLS.length);
  assert.ok(data.pois.some((p) => p.kind === 'start'));
  const c1 = data.roads.find((r) => r.id === 'c1-f');
  assert.ok(c1.closed && c1.points.length > 300 && c1.cls === 'expressway');
  assert.ok(data.roads.find((r) => r.id === 'r18').lifted.length >= 1, 'the overpass is marked');
});
