import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ROADS, STATIONS, TOLLS, WORLD_HALF, ZONES, CITY } from '../../src/world/layout.js';
import { insideLoop, zoneAt, cityAmount, waterAmount } from '../../src/world/zones.js';
import { buildMapData } from '../../src/world/mapdata.js';
import { baseHeight } from '../../src/world/heightfield.js';
import { island, trafficNet } from '../island.mjs';

const g = island();
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

test('expressways and ramps only cross other roads at overpasses; town roads meet at junctions', () => {
  const grade = new Set(['street', 'arterial', 'mountain']);
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
      const streets = grade.has(ra.def.cls) && grade.has(rb.def.cls);
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

test('town roads that cross at grade are joined by a paved junction', () => {
  const near = (x, z) => g.junctions.some((j) => Math.hypot(j.x - x, j.z - z) < j.r + 6);
  const missed = [];
  const town = g.roads.roads.filter((r) => r.def.cls === 'street' || r.def.cls === 'arterial');
  for (let a = 0; a < town.length && missed.length < 10; a++) {
    for (let b = a + 1; b < town.length; b++) {
      const ra = town[a];
      const rb = town[b];
      for (let s = 0; s < ra.path.length; s += 6) {
        const q = ra.path.sample(s);
        const h = rb.path.nearest(q.x, q.z);
        if (Math.hypot(q.x - h.x, q.z - h.z) > 0.8 || ra.liftAt(s) > 0.5 || rb.liftAt(h.s) > 0.5) continue;
        if (!near(q.x, q.z)) missed.push(`${ra.id} x ${rb.id} at ${q.x.toFixed(0)}, ${q.z.toFixed(0)}`);
        break;
      }
    }
  }
  assert.deepEqual(missed, []);
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
    ['r18', 0, 'chuo', 0],
    ['west', g.roads.byId.get('west').path.length, 'dori', 0],
    ['east', 0, 'dori', g.roads.byId.get('dori').path.length],
    ['harbor', 0, 'chuo', g.roads.byId.get('chuo').path.length],
    ['kita', g.roads.byId.get('kita').path.length, 'kuro', 0],
    ['higashi', g.roads.byId.get('higashi').path.length, 'kita', 0],
  ]) {
    const a = g.roads.byId.get(aId), b = g.roads.byId.get(bId);
    maxLip = Math.max(maxLip, Math.abs(a.heightAt(sA) - b.heightAt(sB)));
  }
  assert.ok(maxLip < 0.05, `join lip exceeds 5 cm: ${(maxLip * 100).toFixed(1)} cm`);
  assert.ok(maxGradeBreak < 0.06, `grade break exceeds 6%: ${(maxGradeBreak * 100).toFixed(1)}%`);
});

test('slip roads grow out of Route 1 from a sliver and share its edge and height up to the nose', () => {
  const ramps = g.roads.roads.filter((r) => r.def.cls === 'ramp');
  assert.equal(ramps.length, 24);
  for (const ramp of ramps) {
    const sl = ramp.def.slip;
    assert.ok(sl, `ramp ${ramp.id} has no slip data`);
    const carriage = g.roads.byId.get(sl.carriageId);
    assert.ok(carriage, `carriageway missing for ${ramp.id}`);
    const tip = sl.kind === 'exit' ? 0 : ramp.path.length;
    assert.ok(ramp.hwAt(tip) < 0.3, `${ramp.id} starts ${ramp.hwAt(tip).toFixed(2)} m wide, not as a sliver`);
    const [a, b] = sl.rampAttach;
    let worstEdge = 0;
    let worstH = 0;
    for (let s = a; s <= b; s += 4) {
      const q = ramp.path.sample(s);
      const hit = carriage.path.nearest(q.x, q.z);
      worstEdge = Math.max(worstEdge, Math.abs(Math.abs(hit.d) - ramp.hwAt(s) - carriage.hw));
      worstH = Math.max(worstH, Math.abs(ramp.heightAt(s) - carriage.heightAt(hit.s)));
    }
    assert.ok(worstEdge < 0.12, `${ramp.id} inner edge strays ${worstEdge.toFixed(2)} m from the carriageway's edge`);
    assert.ok(worstH < 0.02, `${ramp.id} is ${(worstH * 100).toFixed(1)} cm off the carriageway's height`);
    assert.ok(b - a > 120, `${ramp.id} runs beside the carriageway for only ${(b - a).toFixed(0)} m`);
    const onRamp = sl.kind === 'exit' ? ramp.path.sample(sl.rampNose + 2) : ramp.path.sample(sl.rampNose - 2);
    const ground = g.at(onRamp.x, onRamp.z, carriage.heightAt(sl.nose) + 0.5);
    assert.equal(ground.road?.id, ramp.id, `${ramp.id}: the ground beside the nose is not the ramp`);
  }
});

test('the toll plazas sit on both carriageways of their expressways', () => {
  assert.equal(TOLLS.length, 4);
  for (const t of TOLLS) {
    const road = t.road || 'c1';
    for (const id of [`${road}-f`, `${road}-r`]) {
      const hit = byId(id).path.nearest(t.x, t.z);
      assert.ok(Math.abs(hit.d) < 9, `${t.id} is ${Math.abs(hit.d).toFixed(1)} m from ${id}`);
    }
  }
});

test('the Bayshore Line runs along the bay and joins Route 1 at both ends, at the same width', () => {
  const f = byId('c2-f');
  const r = byId('c2-r');
  assert.ok(f && r, 'c2 carriageways exist');
  assert.ok(f.def.oneway && r.def.oneway && !f.path.closed && !r.path.closed);
  assert.equal(f.def.cls, 'expressway');
  assert.ok(TOLLS.find((t) => t.road === 'c2'), 'c2 has its own toll plaza');
  // Each way: Route 1, a ramp, the Bayshore, a ramp, Route 1 again.
  for (const [into, bay, outOf, from, to] of [['bay-ramp-wf', f, 'bay-ramp-ef', 'c1-r', 'c1-r'], ['bay-ramp-er', r, 'bay-ramp-wr', 'c1-f', 'c1-f']]) {
    const a = byId(into);
    const b = byId(outOf);
    assert.equal(a.def.slip.carriageId, from);
    assert.equal(b.def.slip.carriageId, to);
    const aEnd = a.path.sample(a.path.length);
    const bayStart = bay.path.sample(0);
    const bayEnd = bay.path.sample(bay.path.length);
    const bStart = b.path.sample(0);
    assert.ok(Math.hypot(aEnd.x - bayStart.x, aEnd.z - bayStart.z) < 0.5, `${into} does not meet ${bay.id}`);
    assert.ok(Math.hypot(bayEnd.x - bStart.x, bayEnd.z - bStart.z) < 0.5, `${bay.id} does not meet ${outOf}`);
    assert.equal(a.hwAt(a.path.length), bay.hw);
    assert.equal(b.hwAt(0), bay.hw);
    assert.ok(Math.abs(a.heightAt(a.path.length) - bay.heightAt(0)) < 0.05, `${into} steps onto ${bay.id}`);
    assert.ok(Math.abs(b.heightAt(0) - bay.heightAt(bay.path.length)) < 0.05, `${bay.id} steps onto ${outOf}`);
    const route = a.path.length + bay.path.length + b.path.length;
    assert.ok(route > 3000 && route < 6000, `the Bayshore route is ${(route / 1000).toFixed(2)} km`);
  }
  for (const id of ['bay-ramp-wf', 'bay-ramp-ef']) assert.ok(byId(id).lifted, `${id} should fly over Route 1`);
  // Traffic can take the Bayshore both ways and come back onto Route 1.
  const net = trafficNet();
  const reach = (from) => {
    const seen = new Set([from]);
    const queue = [from];
    while (queue.length) {
      const lane = queue.shift();
      for (const link of [...lane.ends, ...lane.mids]) if (!seen.has(link.lane)) { seen.add(link.lane); queue.push(link.lane); }
    }
    return seen;
  };
  for (const [carriage, bay, back] of [['c1-f', 'c2-r', 'c1-f'], ['c1-r', 'c2-f', 'c1-r']]) {
    assert.ok(reach(net.lane(carriage, 1, 0)).has(net.lane(bay, 1, 0)), `${carriage} does not lead onto ${bay}`);
    assert.ok(reach(net.lane(bay, 1, 0)).has(net.lane(back, 1, 0)), `${bay} does not lead back onto ${back}`);
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

test('the terrain is an island: a bay in the south, mountains in the west, a low east coast, flat ground downtown', () => {
  assert.ok(baseHeight(0, 2800) < -3, 'the bay should be below the water');
  assert.ok(baseHeight(-2500, -1200) > 150, 'the western mountains should be high');
  assert.ok(baseHeight(-2960, -1200) < 0, 'the western mountains should fall into the sea');
  assert.ok(baseHeight(-600, -2400) > 100, 'the northern ridge should be high');
  assert.ok(baseHeight(0, -2970) < 0, 'the north should end in the sea');
  assert.ok(baseHeight(2450, 400) < 40, 'the east coast should be low land');
  assert.ok(baseHeight(2950, 400) < 0, 'the east should end in the sea');
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
