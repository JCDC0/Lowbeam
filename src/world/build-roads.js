/**
 * Road ribbons and gas station forecourts. A ribbon has seven columns across: skirt,
 * edge, three across the lane surface, edge, skirt. The surface is flat across at the
 * road profile height; the skirts drop by SINK over SKIRT to the carved terrain, the
 * same shape Ground.at reports. Higher priority roads sit a few millimeters higher so
 * junctions never z-fight. A road with a sidewalk (`walk`) has four more: a curb up and the
 * sidewalk on each side, 16 cm above the road.
 *
 * Junctions (junctions.js) are paved as one patch each, and the ribbons drop their skirts and
 * sidewalks inside them. The ribbon pieces are merged per 256 m cell and material, so a city of
 * hundreds of streets costs a few draw calls per cell.
 */

import * as THREE from 'three';
import { psxLambert } from '../render/psx.js';
import { bakeGeometry } from '../render/bake.js';
import { MeshBuilder } from '../render/builder.js';
import { asphaltTexture, concreteTexture, gravelTexture, laneAsphaltTexture, shoulderTexture, makeCanvas, canvasTexture } from '../render/textures.js';
import { SKIRT, SINK } from './roads.js';
import { inStretch } from './merge.js';
import { MARKING, placeMarkings } from './markings.js';

export const TILE = 12;
const CHUNK_ROWS = 90;
/** Curb height, meters. */
const CURB = 0.16;
/** Side of the cells ribbons are merged in, meters. */
const MERGE_CELL = 256;

function goreTexture() {
  const c = makeCanvas(64, 64);
  const g = c.getContext('2d');
  g.fillStyle = '#4e5056';
  g.fillRect(0, 0, 64, 64);
  g.strokeStyle = '#f0eee6';
  g.lineWidth = 4;
  g.beginPath();
  for (let y = -32; y < 96; y += 16) {
    g.moveTo(4, y);
    g.lineTo(32, y + 16);
    g.lineTo(60, y);
  }
  g.stroke();
  g.fillStyle = '#f0eee6';
  g.fillRect(0, 0, 4, 64);
  g.fillRect(60, 0, 4, 64);
  return canvasTexture(c, { repeat: true, mips: true });
}

/** The thick dashed line between a carriageway and the lane a slip road adds beside it. */
function laneAddTexture() {
  const c = makeCanvas(32, 64);
  const g = c.getContext('2d');
  g.fillStyle = '#4e5056';
  g.fillRect(0, 0, 32, 64);
  g.fillStyle = '#e8e4d8';
  g.fillRect(12, 0, 8, 32);
  return canvasTexture(c, { repeat: true, mips: true });
}

/**
 * Where each road shares an edge with a slip road: on the carriageway its left side along the
 * attached stretch and the gore, on the slip road its right side over the same stretch. No
 * skirt is drawn there, so the two surfaces meet at one seam.
 * @param {import('./roads.js').RoadNetwork} roads
 * @returns {Map<import('./roads.js').Road, { side: 1 | -1, a: number, b: number }[]>}
 */
function sharedEdges(roads) {
  const out = new Map();
  const add = (road, side, a, b) => {
    if (!out.has(road)) out.set(road, []);
    out.get(road).push({ side, a, b });
  };
  for (const ramp of roads.roads) {
    const sl = ramp.def.slip;
    const carriage = sl && roads.byId.get(sl.carriageId);
    if (!sl || !carriage) continue;
    if (sl.kind === 'exit') {
      add(carriage, 1, sl.attach[0], sl.nose + sl.gore);
      add(ramp, -1, 0, sl.rampNose + sl.gore);
    } else {
      add(carriage, 1, sl.nose - sl.gore, sl.attach[1]);
      add(ramp, -1, sl.rampNose - sl.gore, ramp.path.length);
    }
  }
  return out;
}

/**
 * @param {import('./roads.js').Road} road @param {number} r0 @param {number} r1
 * @param {{ side: 1 | -1, a: number, b: number }[] | undefined} shared
 * @param {number[][] | undefined} inJunction stretches of this road inside a junction
 */
function ribbon(road, r0, r1, shared, inJunction) {
  const p = road.path;
  const lift = 0.012 * road.priority;
  const rows = r1 - r0 + 1;
  const walk = road.walk;
  const nc = walk ? 11 : 7;
  const pos = new Float32Array(rows * nc * 3);
  const uv = new Float32Array(rows * nc * 2);
  const isRamp = road.def.cls === 'ramp';
  for (let r = 0; r < rows; r++) {
    const i = (r0 + r) % p.n;
    const s = (r0 + r) * p.step;
    const x = p.x[i];
    const z = p.z[i];
    const lx = p.tz[i];
    const lz = -p.tx[i];
    const h = road.h[i] + lift;
    const hw = road.hwAt(s);
    let skirtL = SKIRT;
    let skirtR = SKIRT;
    let dropL = SINK - 0.02;
    let dropR = SINK - 0.02;
    let wL = walk;
    let wR = walk;
    for (const e of shared || []) {
      if (!inStretch(p.wrapS(s), [e.a, e.b], p.length, p.closed)) continue;
      if (e.side > 0) {
        skirtR = 0;
        dropR = 0;
      } else {
        skirtL = 0;
        dropL = 0;
      }
    }
    if (isRamp && (s < 12 || s > p.length - 12)) {
      skirtL = skirtR = 0;
      dropL = dropR = 0;
    }
    if (inJunction && inJunction.some(([a, b]) => s >= a && s <= b)) {
      skirtL = skirtR = 0;
      dropL = dropR = 0;
      wL = wR = 0;
    }
    const cols = walk
      ? [-(hw + wL + skirtL), -(hw + wL), -hw, -hw, -hw / 2, 0, hw / 2, hw, hw, hw + wR, hw + wR + skirtR]
      : [-(hw + skirtL), -hw, -hw / 2, 0, hw / 2, hw, hw + skirtR];
    const cL = wL ? CURB : 0;
    const cR = wR ? CURB : 0;
    const drop = walk ? [dropL - cL, -cL, -cL, 0, 0, 0, 0, 0, -cR, -cR, dropR - cR] : [dropL, 0, 0, 0, 0, 0, dropR];
    for (let c = 0; c < nc; c++) {
      const k = r * nc + c;
      const d = cols[c];
      pos[k * 3] = x + lx * d;
      pos[k * 3 + 1] = h - drop[c];
      pos[k * 3 + 2] = z + lz * d;
      uv[k * 2] = (d + hw) / (2 * hw);
      uv[k * 2 + 1] = s / TILE;
    }
  }
  const surf = [];
  const skirt = [];
  const side = [];
  const lane0 = walk ? 3 : 1;
  const lane1 = walk ? 7 : 5;
  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < nc - 1; c++) {
      const a = r * nc + c;
      const b = a + 1;
      const d = a + nc;
      const e = d + 1;
      const list = c === 0 || c === nc - 2 ? skirt : c >= lane0 && c < lane1 ? surf : side;
      list.push(a, e, b, a, d, e);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setIndex([...surf, ...skirt, ...side]);
  geo.addGroup(0, surf.length, 0);
  geo.addGroup(surf.length, skirt.length, 1);
  if (side.length) geo.addGroup(surf.length + skirt.length, side.length, 2);
  geo.computeVertexNormals();
  return geo;
}

/**
 * One paved patch per junction: a polygon through the edges (sidewalks included) of every road
 * leaving it, a little higher than the highest of them, so lane paint and curbs stop at it.
 * @param {import('./junctions.js').Junction[]} junctions
 */
function buildJunctions(junctions) {
  const b = new MeshBuilder();
  for (const j of junctions) {
    /** @type {{ a: number, p: number[] }[]} */
    const pts = [];
    let y = -Infinity;
    for (const arm of j.arms) {
      const road = arm.road;
      const s = road.path.wrapS(arm.s + arm.dir * (j.r + 2.5));
      const q = road.path.sample(s);
      const w = road.hwAt(s) + road.walk;
      y = Math.max(y, road.heightAt(road.path.wrapS(arm.s)) + 0.012 * road.priority);
      for (const k of [-1, 1]) {
        const x = q.x + q.tz * w * k;
        const z = q.z - q.tx * w * k;
        pts.push({ a: Math.atan2(x - j.x, z - j.z), p: [x, z] });
      }
    }
    if (pts.length < 3) continue;
    pts.sort((p, q) => p.a - q.a);
    y += 0.006;
    for (let k = 0; k < pts.length; k++) {
      const p0 = pts[k].p;
      const p1 = pts[(k + 1) % pts.length].p;
      b.tri('asphalt', [j.x, y, j.z], [p1[0], y, p1[1]], [p0[0], y, p0[1]], [j.x / TILE, j.z / TILE], [p1[0] / TILE, p1[1] / TILE], [p0[0] / TILE, p0[1] / TILE]);
    }
  }
  return b;
}

/**
 * The painted gore of every slip road: the wedge between the carriageway's left edge and the
 * ramp's right edge from the nose until the gap is about a lane wide.
 */
function buildGores(ground) {
  const b = new MeshBuilder();
  const N = 16;
  for (const road of ground.roads.roads) {
    const g = road.def.slip;
    const carriage = g && ground.roads.byId.get(g.carriageId);
    if (!g || !carriage) continue;
    const exit = g.kind === 'exit';
    const dir = exit ? 1 : -1;
    const far = carriage.path.sample(carriage.path.wrapS(g.nose + dir * g.gore));
    const reach = carriage.hw + road.hw + 3.5;
    const rFar = road.path.nearest(far.x + far.tz * reach, far.z - far.tx * reach).s;
    const ptsC = [];
    const ptsR = [];
    for (let k = 0; k <= N; k++) {
      const t = k / N;
      const sC = carriage.path.wrapS(g.nose + dir * t * g.gore);
      const sR = g.rampNose + (rFar - g.rampNose) * t;
      const pC = carriage.path.sample(sC);
      const pR = road.path.sample(sR);
      const hwC = carriage.hwAt(sC);
      const hwR = road.hwAt(sR);
      const yC = carriage.heightAt(sC) + 0.012 * carriage.priority + 0.004;
      const yR = road.heightAt(sR) + 0.012 * road.priority + 0.004;
      ptsC.push([pC.x + pC.tz * hwC, yC, pC.z - pC.tx * hwC]);
      ptsR.push([pR.x - pR.tz * hwR, yR, pR.z + pR.tx * hwR]);
    }
    for (let k = 0; k < N; k++) {
      const [c0, c1, r0, r1] = exit ? [ptsC[k], ptsC[k + 1], ptsR[k], ptsR[k + 1]] : [ptsC[k + 1], ptsC[k], ptsR[k + 1], ptsR[k]];
      const v0 = (k / N) * (g.gore / 8);
      const v1 = ((k + 1) / N) * (g.gore / 8);
      b.quad('gore', c0, r0, r1, c1, exit ? [0, v0, 1, v1] : [0, v1, 1, v0]);
    }

    // The dashed line over the seam where the slip road runs beside the carriageway. It covers
    // both roads' solid edge lines, and narrows with the ramp so it never hangs over the grass.
    const [a, z] = g.attach;
    const len = carriage.path.closed ? carriage.path.wrapS(z - a) : z - a;
    const steps = Math.ceil(len / 4);
    let prev = null;
    for (let k = 0; k <= steps; k++) {
      const s = a + (k / steps) * len;
      const sC = carriage.path.wrapS(s);
      const pC = carriage.path.sample(sC);
      const edge = carriage.hwAt(sC);
      const on = road.path.nearest(pC.x + pC.tz * edge, pC.z - pC.tx * edge);
      const outer = Math.max(0, Math.min(0.6, 2 * road.hwAt(on.s) - 0.1));
      const y = carriage.heightAt(sC) + 0.012 * carriage.priority + 0.004;
      const at = (d) => [pC.x + pC.tz * (edge + d), y, pC.z - pC.tx * (edge + d)];
      const row = { i: at(-0.8), o: at(outer), v: s / 12, f: (0.8 + outer) / 1.4 };
      if (prev) {
        b.tri('dash', prev.i, prev.o, row.o, [0, prev.v], [prev.f, prev.v], [row.f, row.v]);
        b.tri('dash', prev.i, row.o, row.i, [0, prev.v], [row.f, row.v], [0, row.v]);
      }
      prev = row;
    }
  }
  return b;
}

function padGeometry(pad) {
  const step = 3;
  const nu = Math.ceil((pad.hw * 2) / step) + 1;
  const nv = Math.ceil((pad.hd * 2) / step) + 1;
  const pos = [];
  const uv = [];
  const idx = [];
  const y = pad.h + 0.006;
  for (let j = 0; j < nv; j++) {
    for (let i = 0; i < nu; i++) {
      const u = -pad.hw + (i / (nu - 1)) * pad.hw * 2;
      const v = -pad.hd + (j / (nv - 1)) * pad.hd * 2;
      const x = pad.cx + pad.ux * u + pad.vx * v;
      const z = pad.cz + pad.uz * u + pad.vz * v;
      pos.push(x, y, z);
      uv.push(x / 4, z / 4);
    }
  }
  const flip = pad.ux * pad.vz - pad.uz * pad.vx > 0;
  for (let j = 0; j < nv - 1; j++) {
    for (let i = 0; i < nu - 1; i++) {
      const a = j * nu + i;
      const b = a + 1;
      const c = a + nu;
      const d = c + 1;
      if (flip) idx.push(a, d, b, a, c, d);
      else idx.push(a, b, d, a, d, c);
    }
  }
  const curb = (u0, v0, u1, v1) => {
    const base = pos.length / 3;
    for (const [u, v] of [[u0, v0], [u1, v1]]) {
      const x = pad.cx + pad.ux * u + pad.vx * v;
      const z = pad.cz + pad.uz * u + pad.vz * v;
      pos.push(x, y, z, x, pad.h - SINK - 0.1, z);
      uv.push(0, 0, 0, 0.1, 0, 0, 0, 0.1);
    }
    idx.push(base, base + 1, base + 3, base, base + 3, base + 2);
  };
  const { hw, hd } = pad;
  const corners = [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]];
  for (let i = 0; i < 4; i++) {
    const [a, b] = flip ? [corners[(i + 1) % 4], corners[i]] : [corners[i], corners[(i + 1) % 4]];
    curb(a[0], a[1], b[0], b[1]);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
}

/**
 * Concatenates geometries that share the same group layout (material index per group).
 * @param {THREE.BufferGeometry[]} geos @param {number} groups
 */
function mergeGroups(geos, groups) {
  let verts = 0;
  for (const g of geos) verts += g.attributes.position.count;
  const pos = new Float32Array(verts * 3);
  const nrm = new Float32Array(verts * 3);
  const uv = new Float32Array(verts * 2);
  /** @type {number[][]} */
  const idx = Array.from({ length: groups }, () => []);
  let base = 0;
  for (const g of geos) {
    pos.set(/** @type {Float32Array} */ (g.attributes.position.array), base * 3);
    nrm.set(/** @type {Float32Array} */ (g.attributes.normal.array), base * 3);
    uv.set(/** @type {Float32Array} */ (g.attributes.uv.array), base * 2);
    const index = /** @type {THREE.BufferAttribute} */ (g.index).array;
    for (const gr of g.groups) {
      const list = idx[gr.materialIndex ?? 0];
      for (let k = gr.start; k < gr.start + gr.count; k++) list.push(index[k] + base);
    }
    base += g.attributes.position.count;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  const all = [];
  let start = 0;
  idx.forEach((list, m) => {
    if (!list.length) return;
    geo.addGroup(start, list.length, m);
    for (const v of list) all.push(v);
    start += list.length;
  });
  geo.setIndex(all);
  geo.computeBoundingSphere();
  return geo;
}

export function buildRoads(ground, grid) {
  const shoulder = psxLambert({ map: shoulderTexture(), baked: true });
  const mats = {
    asphalt: psxLambert({ map: asphaltTexture(), baked: true }),
    gravel: psxLambert({ map: gravelTexture(), baked: true }),
  };
  const laneMats = new Map();
  const surfaceOf = (road) => {
    if (road.surface !== 'asphalt' || !road.def.lanes || road.def.lines === 'center' || !road.def.lines) return mats[road.surface] || mats.asphalt;
    const lanes = road.def.lines === 'none' ? 0 : road.def.lanes;
    if (!laneMats.has(lanes)) laneMats.set(lanes, psxLambert({ map: laneAsphaltTexture(lanes), baked: true }));
    return laneMats.get(lanes);
  };
  const group = new THREE.Group();
  group.name = 'roads';
  const chunks = [];
  group.userData.chunks = chunks;
  const shared = sharedEdges(ground.roads);
  const concrete = psxLambert({ map: concreteTexture(), baked: true, side: THREE.DoubleSide });
  const walkMat = psxLambert({ map: concreteTexture(), baked: true, color: 0xb8b6b0 });
  /** @type {Map<string, { geos: THREE.BufferGeometry[], mats: THREE.Material[], x: number, z: number, n: number }>} */
  const buckets = new Map();
  for (const road of ground.roads.roads) {
    const p = road.path;
    const last = p.closed ? p.n : p.n - 1;
    const surface = surfaceOf(road);
    for (let r0 = 0; r0 < last; r0 += CHUNK_ROWS) {
      const r1 = Math.min(last, r0 + CHUNK_ROWS);
      const geo = ribbon(road, r0, r1, shared.get(road), ground.junctionSpans.get(road));
      const mid = ((r0 + r1) >> 1) % p.n;
      const key = `${Math.floor(p.x[mid] / MERGE_CELL)},${Math.floor(p.z[mid] / MERGE_CELL)},${surface.uuid}`;
      let bucket = buckets.get(key);
      if (!bucket) buckets.set(key, (bucket = { geos: [], mats: [surface, shoulder, walkMat], x: 0, z: 0, n: 0 }));
      bucket.geos.push(geo);
      bucket.x += p.x[mid];
      bucket.z += p.z[mid];
      bucket.n++;
    }
  }
  for (const [key, bucket] of buckets) {
    const geo = bakeGeometry(mergeGroups(bucket.geos, 3), grid, { wrap: 0.6 });
    for (const g of bucket.geos) g.dispose();
    const mesh = new THREE.Mesh(geo, bucket.mats);
    mesh.name = `roads-${key.split(',').slice(0, 2).join(',')}`;
    group.add(mesh);
    chunks.push({ mesh, x: bucket.x / bucket.n, z: bucket.z / bucket.n });
  }
  for (const pad of ground.pads) {
    const mesh = new THREE.Mesh(bakeGeometry(padGeometry(pad), grid, { wrap: 0.6 }), concrete);
    mesh.name = `pad-${pad.id}`;
    group.add(mesh);
  }

  const goreMeshBuilder = buildGores(ground);
  const goreData = goreMeshBuilder.geometry(['gore', 'dash']);
  if (goreData.geometry.attributes.position && goreData.geometry.attributes.position.count > 0) {
    const goreMat = psxLambert({ map: goreTexture(), baked: true, side: THREE.DoubleSide });
    const dashMat = psxLambert({ map: laneAddTexture(), baked: true, side: THREE.DoubleSide });
    const goreMesh = new THREE.Mesh(bakeGeometry(goreData.geometry, grid, { wrap: 0.6 }), [goreMat, dashMat]);
    goreMesh.name = 'road-gores';
    group.add(goreMesh);
  }

  const junctionData = buildJunctions(ground.junctions).geometry(['asphalt']);
  if (junctionData.geometry.attributes.position && junctionData.geometry.attributes.position.count > 0) {
    const mesh = new THREE.Mesh(bakeGeometry(junctionData.geometry, grid, { wrap: 0.6 }), [mats.asphalt]);
    mesh.name = 'junctions';
    group.add(mesh);
  }

  const paint = buildMarkings(placeMarkings(ground.junctions));
  if (paint) {
    const mesh = new THREE.Mesh(bakeGeometry(paint.geometry, grid, { wrap: 0.6 }), paint.keys.map((k) => markingMats()[k]));
    mesh.name = 'road-markings';
    group.add(mesh);
  }

  return group;
}

/** The zebra crossings and stop lines at the town's junctions (`markings.js`), as one mesh. */
function buildMarkings(markings) {
  if (!markings.length) return null;
  const b = new MeshBuilder();
  const period = MARKING.bar + MARKING.space;
  for (const m of markings) {
    b.push(m.x, m.y, m.z, m.yaw);
    const x = m.w / 2;
    const z = m.d / 2;
    // The zebra's bars run with the traffic, so its texture repeats across the road.
    const uv = m.kind === 'zebra' ? [-x / period, 0, x / period, 1] : [0, 0, 1, 1];
    b.quad(m.kind, [x, 0, -z], [-x, 0, -z], [-x, 0, z], [x, 0, z], uv);
    b.pop();
  }
  return b.geometry(['zebra', 'stop']);
}

let _markingMats = null;
function markingMats() {
  if (!_markingMats) {
    const c = makeCanvas(16, 4);
    const g = /** @type {CanvasRenderingContext2D} */ (c.getContext('2d'));
    g.fillStyle = '#e4e2da';
    g.fillRect(0, 0, 8, 4);
    _markingMats = {
      zebra: psxLambert({ map: canvasTexture(c, { repeat: true }), baked: true, alphaTest: 0.5, side: THREE.DoubleSide }),
      stop: psxLambert({ color: 0xe4e2da, baked: true, side: THREE.DoubleSide }),
    };
  }
  return _markingMats;
}
