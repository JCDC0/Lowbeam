/**
 * Street lamps, trees and the town. Lamps and buildings are merged into one mesh each
 * (a draw call per material); trees are instanced in square chunks that the world hides
 * past the fog.
 */

import * as THREE from 'three';
import { MeshBuilder } from '../render/builder.js';
import { psxBasic, psxLambert } from '../render/psx.js';
import { bakeGeometry } from '../render/bake.js';
import { signAtlas, windowTextures } from '../render/textures.js';
import { makeRng } from '../core/rng.js';
import { LAMP_HEIGHT, LAMP_REACH, SIGN_COLORS } from './scatter.js';

/** @typedef {import('./scatter.js').Lamp} Lamp */
/** @typedef {import('./scatter.js').Tree} Tree */
/** @typedef {import('./scatter.js').Building} Building */
/** @typedef {[number, number, number]} V3 */

/** Side of a square tree chunk, meters. */
export const TREE_CHUNK = 250;
/** Meters per facade texture tile (8 bays of 3 m). */
const FACADE = 24;

/**
 * @param {Lamp[]} lamps
 * @param {import('../render/bake.js').LightGrid} grid
 */
export function buildLamps(lamps, grid) {
  const b = new MeshBuilder();
  const H = LAMP_HEIGHT;
  for (const l of lamps) {
    b.push(l.x, l.y, l.z, l.yaw);
    b.cylinder('pole', 0, H / 2, 0, 0.11, H, 6, 'y', { caps: false });
    b.box('pole', 0, H - 0.05, LAMP_REACH / 2, 0.09, 0.09, LAMP_REACH);
    b.box('pole', 0, H - 0.12, LAMP_REACH, 0.38, 0.14, 0.82);
    const y = H - 0.195;
    b.quad('lens', [-0.15, y, LAMP_REACH - 0.36], [0.15, y, LAMP_REACH - 0.36], [0.15, y, LAMP_REACH + 0.36], [-0.15, y, LAMP_REACH + 0.36]);
    b.pop();
  }
  const mesh = b.mesh({ pole: psxLambert({ color: 0x6c7076, baked: true }), lens: psxBasic({ color: 0xffb24c }) });
  bakeGeometry(mesh.geometry, grid);
  mesh.name = 'lamps';
  return mesh;
}

/** A cone as a fan of `sides` triangles plus a downward base. */
function cone(b, y, r, h, sides) {
  for (let i = 0; i < sides; i++) {
    const a0 = (i / sides) * Math.PI * 2;
    const a1 = ((i + 1) / sides) * Math.PI * 2;
    /** @type {V3} */
    const p0 = [Math.cos(a0) * r, y, Math.sin(a0) * r];
    /** @type {V3} */
    const p1 = [Math.cos(a1) * r, y, Math.sin(a1) * r];
    b.tri('t', p1, p0, [0, y + h, 0]);
    b.tri('t', p0, p1, [0, y, 0]);
  }
}

function coniferGeometry() {
  const b = new MeshBuilder();
  b.setColor(0x3d2b1d);
  b.cylinder('t', 0, 0.8, 0, 0.17, 1.6, 5, 'y', { caps: false });
  b.setColor(0x1d3620);
  cone(b, 1.2, 2.3, 3.8, 7);
  b.setColor(0x21402a);
  cone(b, 3.0, 1.8, 3.4, 6);
  b.setColor(0x284a30);
  cone(b, 4.9, 1.2, 3.1, 5);
  return b.geometry().geometry;
}

function broadleafGeometry() {
  const b = new MeshBuilder();
  b.setColor(0x47331f);
  b.cylinder('t', 0, 1.1, 0, 0.2, 2.2, 5, 'y', { caps: false });
  const ico = new THREE.IcosahedronGeometry(2.2, 0);
  ico.scale(1, 0.85, 1);
  ico.translate(0, 3.6, 0);
  const p = ico.attributes.position;
  const rng = makeRng(5);
  for (let i = 0; i < p.count; i += 3) {
    b.setColor(rng.pick([0x2c4420, 0x32502a, 0x27401e]));
    b.tri('t', [p.getX(i), p.getY(i), p.getZ(i)], [p.getX(i + 1), p.getY(i + 1), p.getZ(i + 1)], [p.getX(i + 2), p.getY(i + 2), p.getZ(i + 2)]);
  }
  ico.dispose();
  return b.geometry().geometry;
}

/**
 * Trees as instanced meshes, one per chunk and kind.
 * @param {Tree[]} trees
 * @returns {{ group: THREE.Group, chunks: { mesh: THREE.InstancedMesh, x: number, z: number }[] }}
 */
export function buildTrees(trees) {
  const geos = [coniferGeometry(), broadleafGeometry()];
  const mat = psxLambert({ vertexColors: true });
  /** @type {Map<string, Tree[]>} */
  const buckets = new Map();
  for (const t of trees) {
    const key = `${Math.floor(t.x / TREE_CHUNK)},${Math.floor(t.z / TREE_CHUNK)},${t.kind}`;
    let list = buckets.get(key);
    if (!list) buckets.set(key, (list = []));
    list.push(t);
  }
  const group = new THREE.Group();
  group.name = 'trees';
  const chunks = [];
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const pos = new THREE.Vector3();
  const scl = new THREE.Vector3();
  const col = new THREE.Color();
  const rng = makeRng(9);
  for (const [key, list] of buckets) {
    const [cx, cz, kind] = key.split(',').map(Number);
    const mesh = new THREE.InstancedMesh(geos[kind], mat, list.length);
    list.forEach((t, i) => {
      q.setFromAxisAngle(up, rng.range(0, Math.PI * 2));
      pos.set(t.x, t.y - 0.1, t.z);
      scl.set(t.s, t.s * rng.range(0.9, 1.15), t.s);
      mesh.setMatrixAt(i, m.compose(pos, q, scl));
      mesh.setColorAt(i, col.setRGB(t.tint, t.tint, t.tint * 0.95));
    });
    mesh.computeBoundingSphere();
    group.add(mesh);
    chunks.push({ mesh, x: (cx + 0.5) * TREE_CHUNK, z: (cz + 0.5) * TREE_CHUNK });
  }
  return { group, chunks };
}

const WALL_TINTS = [0xd8d2c4, 0xc9cdd2, 0xbfb4a2, 0xd6cbb8, 0xa9b0b6, 0xe2ddd2, 0xb8a990];

/**
 * @param {Building[]} buildings
 * @param {import('../render/bake.js').LightGrid} grid
 */
export function buildTown(buildings, grid) {
  const b = new MeshBuilder();
  for (const bd of buildings) {
    const rng = makeRng(bd.seed);
    const konbini = bd.kind === 'konbini';
    const h = konbini ? bd.h : Math.max(2, Math.round(bd.h / 3)) * 3 + 0.4;
    const hw = bd.w / 2;
    const hd = bd.d / 2;
    b.push(bd.x, bd.y, bd.z, bd.yaw);
    b.setColor(konbini ? 0xf2f2ee : rng.pick(WALL_TINTS));
    const u0 = rng.int(0, 7) / 8;
    const v0 = konbini ? 0.5 : rng.int(0, 7) / 8;
    const uv = (len) => [u0, v0, u0 + len / FACADE, v0 + h / FACADE];
    b.quad('wall', [-hw, 0, hd], [hw, 0, hd], [hw, h, hd], [-hw, h, hd], uv(bd.w));
    b.quad('wall', [hw, 0, -hd], [-hw, 0, -hd], [-hw, h, -hd], [hw, h, -hd], uv(bd.w));
    b.quad('wall', [hw, 0, hd], [hw, 0, -hd], [hw, h, -hd], [hw, h, hd], uv(bd.d));
    b.quad('wall', [-hw, 0, -hd], [-hw, 0, hd], [-hw, h, hd], [-hw, h, -hd], uv(bd.d));
    b.setColor(0x4a4c50);
    b.quad('roof', [hw, h, -hd], [-hw, h, -hd], [-hw, h, hd], [hw, h, hd]);
    if (!konbini) {
      for (let i = rng.int(0, 3); i > 0; i--) {
        b.box('roof', rng.range(-hw + 1.5, hw - 1.5), h + 0.5, rng.range(-hd + 1.5, hd - 1.5), rng.range(1.2, 2.4), 1, rng.range(1, 2));
      }
    } else {
      const z = hd + 0.02;
      b.setColor(0xffffff);
      b.quad('shop', [-hw * 0.86, 0.35, z], [hw * 0.86, 0.35, z], [hw * 0.86, 2.9, z], [-hw * 0.86, 2.9, z]);
      [[0x1aa04a, 3.0, 3.3], [0xf4f4f4, 3.3, 3.55], [0x2a6ad8, 3.55, 3.85]].forEach(([c, y0, y1]) => {
        b.setColor(c);
        b.quad('band', [-hw, y0, z], [hw, y0, z], [hw, y1, z], [-hw, y1, z]);
      });
    }
    if (bd.sign >= 0 && !konbini) {
      const i = bd.sign % 8;
      const sx = (rng.chance(0.5) ? 1 : -1) * (hw - 1.2);
      const y0 = Math.min(3.2, h - 5);
      const y1 = y0 + 4.4;
      const z0 = hd + 0.15;
      const z1 = hd + 1.25;
      const r = [i / 8, 0, (i + 1) / 8, 1];
      b.setColor(0xffffff);
      b.quad('sign', [sx + 0.03, y0, z1], [sx + 0.03, y0, z0], [sx + 0.03, y1, z0], [sx + 0.03, y1, z1], r);
      b.quad('sign', [sx - 0.03, y0, z0], [sx - 0.03, y0, z1], [sx - 0.03, y1, z1], [sx - 0.03, y1, z0], r);
    }
    b.pop();
  }
  const win = windowTextures();
  const mesh = b.mesh({
    wall: psxLambert({ map: win.map, emissiveMap: win.emissive, emissive: 0xffffff, vertexColors: true, baked: true }),
    roof: psxLambert({ vertexColors: true, baked: true }),
    shop: psxBasic({ color: 0xe8f4ff }),
    band: psxBasic({ vertexColors: true }),
    sign: psxBasic({ map: signAtlas(SIGN_COLORS) }),
  });
  bakeGeometry(mesh.geometry, grid);
  mesh.name = 'town';
  return mesh;
}
