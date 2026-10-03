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
import { asphaltTexture, concreteTexture, gravelTexture, laneAsphaltTexture, shoulderTexture } from '../render/textures.js';
import { SKIRT, SINK } from './roads.js';

/** Meters of road per texture tile. */
export const TILE = 12;

/** Samples per road chunk: 90 samples of 2 m, so each mesh is about 180 m long and can be culled. */
const CHUNK_ROWS = 90;

/**
 * The ribbon for samples r0 to r1 (inclusive) of a road.
 * @param {import('./roads.js').Road} road @param {number} r0 @param {number} r1
 */
function ribbon(road, r0, r1) {
  const p = road.path;
  const hw = road.hw;
  const lift = 0.012 * road.priority;
  const cols = [-(hw + SKIRT), -hw, -hw / 2, 0, hw / 2, hw, hw + SKIRT];
  const drop = [SINK - 0.02, 0, 0, 0, 0, 0, SINK - 0.02];
  const rows = r1 - r0 + 1;
  const nc = cols.length;
  const pos = new Float32Array(rows * nc * 3);
  const uv = new Float32Array(rows * nc * 2);
  for (let r = 0; r < rows; r++) {
    const i = (r0 + r) % p.n;
    const s = (r0 + r) * p.step;
    const x = p.x[i];
    const z = p.z[i];
    const lx = p.tz[i];
    const lz = -p.tx[i];
    const h = road.h[i] + lift;
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
 * A pad: a grid of concrete at pad height with a short curb face on every side.
 * @param {import('./ground.js').Pad} pad
 */
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
  // Winding depends on whether (u, v) is a right- or left-handed frame on the ground.
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
 * @param {import('./ground.js').Ground} ground
 * @param {import('../render/bake.js').LightGrid} grid
 */
export function buildRoads(ground, grid) {
  const shoulder = psxLambert({ map: shoulderTexture(), baked: true });
  const mats = {
    asphalt: psxLambert({ map: asphaltTexture(), baked: true }),
    gravel: psxLambert({ map: gravelTexture(), baked: true }),
  };
  /** One-way roads get lane lines; ramps get edge lines only. */
  const laneMats = new Map();
  const surfaceOf = (road) => {
    if (road.surface !== 'asphalt' || !road.def.lanes || road.def.lines === 'center' || !road.def.lines) return mats[road.surface] || mats.asphalt;
    const lanes = road.def.lines === 'none' ? 0 : road.def.lanes;
    if (!laneMats.has(lanes)) laneMats.set(lanes, psxLambert({ map: laneAsphaltTexture(lanes), baked: true }));
    return laneMats.get(lanes);
  };
  const group = new THREE.Group();
  group.name = 'roads';
  /** @type {{ mesh: THREE.Mesh, x: number, z: number }[]} */
  const chunks = [];
  group.userData.chunks = chunks;
  for (const road of ground.roads.roads) {
    const p = road.path;
    const last = p.closed ? p.n : p.n - 1;
    for (let r0 = 0; r0 < last; r0 += CHUNK_ROWS) {
      const r1 = Math.min(last, r0 + CHUNK_ROWS);
      const geo = bakeGeometry(ribbon(road, r0, r1), grid, { wrap: 0.6 });
      const mesh = new THREE.Mesh(geo, [surfaceOf(road), shoulder]);
      mesh.name = road.id;
      group.add(mesh);
      const mid = (r0 + r1) >> 1;
      chunks.push({ mesh, x: p.x[mid % p.n], z: p.z[mid % p.n] });
    }
  }
  const concrete = psxLambert({ map: concreteTexture(), baked: true });
  for (const pad of ground.pads) {
    const mesh = new THREE.Mesh(bakeGeometry(padGeometry(pad), grid, { wrap: 0.6 }), concrete);
    mesh.name = `pad-${pad.id}`;
    group.add(mesh);
  }
  return group;
}
