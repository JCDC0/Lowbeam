/**
 * Road ribbons and gas station forecourts. A ribbon has seven columns across: skirt,
 * edge, three across the lane surface, edge, skirt. The surface is flat across at the
 * road profile height; the skirts drop by SINK over SKIRT to the carved terrain, the
 * same shape Ground.at reports. Higher priority roads sit a few millimeters higher so
 * junctions never z-fight.
 */

import * as THREE from 'three';
import { psxLambert } from '../render/psx.js';
import { bakeGeometry } from '../render/bake.js';
import { MeshBuilder } from '../render/builder.js';
import { asphaltTexture, concreteTexture, gravelTexture, laneAsphaltTexture, shoulderTexture, makeCanvas, canvasTexture } from '../render/textures.js';
import { SKIRT, SINK } from './roads.js';
import { inStretch } from './merge.js';
import { GRID } from './layout.js';

export const TILE = 12;
const CHUNK_ROWS = 90;

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

/** @param {import('./roads.js').Road} road @param {{ side: 1 | -1, a: number, b: number }[] | undefined} shared */
function ribbon(road, r0, r1, shared) {
  const p = road.path;
  const lift = 0.012 * road.priority;
  const rows = r1 - r0 + 1;
  const nc = 7;
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
    if (isRamp) {
      if (s < 12 || s > p.length - 12) {
        skirtL = 0;
        skirtR = 0;
        dropL = 0;
        dropR = 0;
      }
    }
    if (road.def.cls === 'street' || road.def.cls === 'arterial') {
      if (x > GRID.rect.x0 - 20 && x < GRID.rect.x1 + 20 && z > GRID.rect.z0 - 10 && z < GRID.rect.z1 + 10) {
        for (const ew of GRID.ew) {
          if (Math.abs(z - ew) < hw + 0.5) {
            for (const ns of GRID.ns) {
              if (Math.abs(x - ns) < hw + 0.5) {
                dropL = 0;
                dropR = 0;
                skirtL = 0;
                skirtR = 0;
                break;
              }
            }
            break;
          }
        }
      }
    }
    const cols = [-(hw + skirtL), -hw, -hw / 2, 0, hw / 2, hw, hw + skirtR];
    const drop = [dropL, 0, 0, 0, 0, 0, dropR];
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
  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < nc - 1; c++) {
      const a = r * nc + c;
      const b = a + 1;
      const d = a + nc;
      const e = d + 1;
      const list = c === 0 || c === nc - 2 ? skirt : surf;
      list.push(a, e, b, a, d, e);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setIndex([...surf, ...skirt]);
  geo.addGroup(0, surf.length, 0);
  geo.addGroup(surf.length, skirt.length, 1);
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
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

function buildCityCrossingsAndCurbs(ground) {
  const b = new MeshBuilder();
  const GRID_EW = GRID.ew;
  const GRID_NS = GRID.ns;
  const crossings = [];
  for (const z of GRID_EW) {
    for (const x of GRID_NS) {
      crossings.push([x, z]);
    }
  }
  const hw = 4.6;
  const R = 3.0;
  const H = 0.16;

  for (const [cx, cz] of crossings) {
    const y = ground.at(cx, cz).h + 0.005;
    const u0 = (cx - hw) / 12;
    const u1 = (cx + hw) / 12;
    const v0 = (cz - hw) / 12;
    const v1 = (cz + hw) / 12;
    b.quad('asphalt', [cx - hw, y, cz - hw], [cx + hw, y, cz - hw], [cx + hw, y, cz + hw], [cx - hw, y, cz + hw], [u0, v0, u1, v1]);

    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const ox = cx + sx * (hw + R);
        const oz = cz + sz * (hw + R);
        const steps = 4;
        const ptsArc = [];
        for (let j = 0; j <= steps; j++) {
          const a = (j / steps) * (Math.PI / 2);
          const angle = sx > 0
            ? (sz > 0 ? Math.PI + a : Math.PI / 2 + a)
            : (sz > 0 ? (3 * Math.PI) / 2 + a : a);
          const px = ox + Math.cos(angle) * R;
          const pz = oz + Math.sin(angle) * R;
          ptsArc.push([px, pz]);
        }
        for (let j = 0; j < steps; j++) {
          const p0 = ptsArc[j];
          const p1 = ptsArc[j + 1];
          b.quad('curb', [p0[0], y, p0[1]], [p1[0], y, p1[1]], [p1[0], y + H, p1[1]], [p0[0], y + H, p0[1]], [0, 0, 0.2, 0.16]);
          b.quad('curb', [p0[0], y + H, p0[1]], [p1[0], y + H, p1[1]], [ox, y + H, oz], [ox, y + H, oz], [p0[0] / 4, p0[1] / 4, p1[0] / 4, p1[1] / 4]);
        }
      }
    }
  }

  for (let i = 0; i < GRID_NS.length - 1; i++) {
    for (let j = 0; j < GRID_EW.length; j++) {
      const x0 = GRID_NS[i] + hw + R;
      const x1 = GRID_NS[i + 1] - (hw + R);
      const cz = GRID_EW[j];
      const y = ground.at((x0 + x1) / 2, cz).h + 0.005;
      for (const sz of [-1, 1]) {
        const zRoad = cz + sz * hw;
        const zWalk = cz + sz * (hw + 2.4);
        b.quad('curb', [x0, y, zRoad], [x1, y, zRoad], [x1, y + H, zRoad], [x0, y + H, zRoad], [0, 0, (x1 - x0) / 4, 0.16]);
        b.quad('curb', [x0, y + H, zRoad], [x1, y + H, zRoad], [x1, y + H, zWalk], [x0, y + H, zWalk], [x0 / 4, zRoad / 4, x1 / 4, zWalk / 4]);
      }
    }
  }

  for (let i = 0; i < GRID_NS.length; i++) {
    for (let j = 0; j < GRID_EW.length - 1; j++) {
      const z0 = GRID_EW[j] + hw + R;
      const z1 = GRID_EW[j + 1] - (hw + R);
      const cx = GRID_NS[i];
      const y = ground.at(cx, (z0 + z1) / 2).h + 0.005;
      for (const sx of [-1, 1]) {
        const xRoad = cx + sx * hw;
        const xWalk = cx + sx * (hw + 2.4);
        b.quad('curb', [xRoad, y, z0], [xRoad, y, z1], [xRoad, y + H, z1], [xRoad, y + H, z0], [0, 0, (z1 - z0) / 4, 0.16]);
        b.quad('curb', [xRoad, y + H, z0], [xRoad, y + H, z1], [xWalk, y + H, z1], [xWalk, y + H, z0], [xRoad / 4, z0 / 4, xWalk / 4, z1 / 4]);
      }
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
  for (const road of ground.roads.roads) {
    const p = road.path;
    const last = p.closed ? p.n : p.n - 1;
    for (let r0 = 0; r0 < last; r0 += CHUNK_ROWS) {
      const r1 = Math.min(last, r0 + CHUNK_ROWS);
      const geo = bakeGeometry(ribbon(road, r0, r1, shared.get(road)), grid, { wrap: 0.6 });
      const mesh = new THREE.Mesh(geo, [surfaceOf(road), shoulder]);
      mesh.name = road.id;
      group.add(mesh);
      const mid = (r0 + r1) >> 1;
      chunks.push({ mesh, x: p.x[mid % p.n], z: p.z[mid % p.n] });
    }
  }
  const concrete = psxLambert({ map: concreteTexture(), baked: true, side: THREE.DoubleSide });
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

  const cityCrossingsBuilder = buildCityCrossingsAndCurbs(ground);
  const cityData = cityCrossingsBuilder.geometry(['asphalt', 'curb']);
  if (cityData.geometry.attributes.position && cityData.geometry.attributes.position.count > 0) {
    const cityMesh = new THREE.Mesh(bakeGeometry(cityData.geometry, grid, { wrap: 0.6 }), [mats.asphalt, concrete]);
    cityMesh.name = 'city-crossings-and-curbs';
    group.add(cityMesh);
  }

  return group;
}
