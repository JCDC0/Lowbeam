/**
 * Tree meshes: nine low-poly species, each one geometry with baked vertex colors, drawn
 * as instanced meshes in square chunks that the world hides past the fog. Per-instance
 * color tints each tree; `treeTint` also shifts the maple between red, orange and gold.
 */

import * as THREE from 'three';
import { MeshBuilder } from '../render/builder.js';
import { psxLambert } from '../render/psx.js';
import { makeRng } from '../core/rng.js';
import { TREE, TREE_COUNT } from './forest.js';

/** @typedef {import('./forest.js').Tree} Tree */
/** @typedef {[number, number, number]} V3 */

/** Side of a square tree chunk, meters. */
export const TREE_CHUNK = 250;

const _m = new THREE.Matrix4();
const _t = new THREE.Matrix4();

/** A cone as a fan of `sides` triangles plus a downward base. */
function cone(b, x, y, z, r, h, sides, key = 't') {
  for (let i = 0; i < sides; i++) {
    const a0 = (i / sides) * Math.PI * 2;
    const a1 = ((i + 1) / sides) * Math.PI * 2;
    /** @type {V3} */
    const p0 = [x + Math.cos(a0) * r, y, z + Math.sin(a0) * r];
    /** @type {V3} */
    const p1 = [x + Math.cos(a1) * r, y, z + Math.sin(a1) * r];
    b.tri(key, p1, p0, [x, y + h, z]);
    b.tri(key, p0, p1, [x, y, z]);
  }
}

/**
 * A squashed icosahedron blob with per-face colors drawn from `palette`.
 * @param {MeshBuilder} b @param {number} x @param {number} y @param {number} z
 * @param {number} r @param {number} squash @param {number[]} palette @param {ReturnType<typeof makeRng>} rng
 */
function blob(b, x, y, z, r, squash, palette, rng) {
  const ico = new THREE.IcosahedronGeometry(r, 0);
  ico.scale(1, squash, 1);
  ico.translate(x, y, z);
  const p = ico.attributes.position;
  for (let i = 0; i < p.count; i += 3) {
    b.setColor(rng.pick(palette));
    b.tri('t', [p.getX(i), p.getY(i), p.getZ(i)], [p.getX(i + 1), p.getY(i + 1), p.getZ(i + 1)], [p.getX(i + 2), p.getY(i + 2), p.getZ(i + 2)]);
  }
  ico.dispose();
}

/**
 * A cylinder along a tilted axis through (x, 0, z): `lean` is (leanX, leanZ) radians.
 * Built by pushing a transform around MeshBuilder's axis-aligned cylinder.
 */
function stalk(b, x, y, z, r, len, sides, leanX, leanZ, r2 = r) {
  _m.makeRotationFromEuler(new THREE.Euler(leanX, 0, leanZ));
  _m.setPosition(x, y, z);
  _t.identity();
  b.pushMatrix(_m.clone().multiply(_t));
  b.cylinder('t', 0, len / 2, 0, r, len, sides, 'y', { caps: false, r2 });
  b.pop();
}

const GEOMETRY = [
  function spruce() {
    const b = new MeshBuilder();
    b.setColor(0x3d2b1d);
    b.cylinder('t', 0, 0.8, 0, 0.17, 1.6, 5, 'y', { caps: false });
    b.setColor(0x1d3620);
    cone(b, 0, 1.2, 0, 2.3, 3.8, 7);
    b.setColor(0x21402a);
    cone(b, 0, 3.0, 0, 1.8, 3.4, 6);
    b.setColor(0x284a30);
    cone(b, 0, 4.9, 0, 1.2, 3.1, 5);
    return b;
  },
  function broadleaf() {
    const b = new MeshBuilder();
    const rng = makeRng(5);
    b.setColor(0x47331f);
    b.cylinder('t', 0, 1.1, 0, 0.2, 2.2, 5, 'y', { caps: false });
    blob(b, 0, 3.6, 0, 2.2, 0.85, [0x2c4420, 0x32502a, 0x27401e], rng);
    return b;
  },
  function sugi() {
    const b = new MeshBuilder();
    b.setColor(0x4a3322);
    b.cylinder('t', 0, 1.6, 0, 0.24, 3.2, 5, 'y', { caps: false, r2: 0.18 });
    const shades = [0x16302a, 0x1a362e, 0x1e3b30, 0x234335];
    [[2.0, 1.45, 4.6], [4.4, 1.2, 4.4], [6.8, 0.95, 4.2], [9.0, 0.65, 3.8]].forEach(([y, r, h], i) => {
      b.setColor(shades[i]);
      cone(b, 0, y, 0, r, h, 6);
    });
    return b;
  },
  function birch() {
    const b = new MeshBuilder();
    const rng = makeRng(6);
    b.setColor(0xd9d5c8);
    b.cylinder('t', 0, 2.2, 0, 0.13, 4.4, 5, 'y', { caps: false, r2: 0.09 });
    b.setColor(0x2a2824);
    for (const y of [0.7, 1.5, 2.6, 3.4]) b.box('t', 0.115, y, 0, 0.03, 0.14, 0.2);
    const leaf = [0x6f9a43, 0x7aa84d, 0x5f8a3a];
    blob(b, 0, 5.0, 0, 1.25, 1.1, leaf, rng);
    blob(b, 0.7, 4.1, 0.3, 0.85, 0.9, leaf, rng);
    blob(b, -0.6, 4.4, -0.4, 0.9, 0.95, leaf, rng);
    return b;
  },
  function maple() {
    const b = new MeshBuilder();
    const rng = makeRng(7);
    b.setColor(0x3b2a1b);
    b.cylinder('t', 0, 1.0, 0, 0.26, 2.0, 5, 'y', { caps: false, r2: 0.2 });
    const fall = [0xc9601c, 0xd47a24, 0xb94a18, 0xdc9230];
    blob(b, 0, 3.4, 0, 2.3, 0.82, fall, rng);
    blob(b, 1.4, 2.9, 0.6, 1.3, 0.8, fall, rng);
    blob(b, -1.3, 3.0, -0.7, 1.4, 0.8, fall, rng);
    return b;
  },
  function pine() {
    const b = new MeshBuilder();
    b.setColor(0x3e2c1e);
    stalk(b, 0, 0, 0, 0.26, 2.6, 5, 0, -0.1, 0.2);
    stalk(b, -0.26, 2.55, 0, 0.19, 2.4, 5, 0.12, 0.2, 0.1);
    const shades = [0x24432a, 0x2a4a2e, 0x30522f];
    [[-0.1, 4.3, 0.3, 2.3], [0.4, 5.1, -0.2, 1.8], [-0.4, 5.8, 0.1, 1.25]].forEach(([x, y, z, r], i) => {
      b.setColor(shades[i]);
      b.cylinder('t', x, y, z, r, 0.55, 7, 'y', { caps: true, r2: r * 0.78 });
    });
    return b;
  },
  function bamboo() {
    const b = new MeshBuilder();
    const rng = makeRng(8);
    for (let i = 0; i < 9; i++) {
      const a = rng.range(0, Math.PI * 2);
      const d = rng.range(0, 0.85);
      const h = rng.range(5.5, 8.5);
      const lx = rng.range(-0.1, 0.1);
      const lz = rng.range(-0.1, 0.1);
      b.setColor(rng.pick([0x86a64a, 0x7a9c44, 0x92b052]));
      stalk(b, Math.cos(a) * d, 0, Math.sin(a) * d, 0.055, h, 4, lx, lz, 0.04);
      b.setColor(rng.pick([0x4f7a2f, 0x5a8836]));
      cone(b, Math.cos(a) * d + Math.sin(lz) * -h, h - 1.4, Math.sin(a) * d + Math.sin(lx) * h, 0.7, 1.7, 4);
    }
    return b;
  },
  function shrub() {
    const b = new MeshBuilder();
    const rng = makeRng(9);
    const leaf = [0x2d4a24, 0x35552a, 0x274120];
    blob(b, 0, 0.55, 0, 0.9, 0.75, leaf, rng);
    blob(b, 0.7, 0.4, 0.3, 0.6, 0.8, leaf, rng);
    blob(b, -0.5, 0.4, -0.4, 0.65, 0.8, leaf, rng);
    return b;
  },
  function snag() {
    const b = new MeshBuilder();
    b.setColor(0x4a4036);
    stalk(b, 0, 0, 0, 0.24, 5.2, 5, 0.04, 0.06, 0.08);
    b.setColor(0x57493c);
    stalk(b, 0, 3.2, 0, 0.07, 1.7, 4, 0.0, -0.95, 0.03);
    stalk(b, 0, 3.9, 0, 0.06, 1.4, 4, 0.8, 0.2, 0.03);
    stalk(b, 0, 2.4, 0, 0.06, 1.2, 4, -0.7, 0.5, 0.03);
    return b;
  },
];

/** The nine species as geometries, in the order of TREE. */
export function treeGeometries() {
  return GEOMETRY.map((make) => make().geometry().geometry);
}

/**
 * Per-instance color: brightness from `tint`, and hue shifts for the species that have them.
 * @param {number} kind @param {number} tint @param {number} hue 0 to 1 @param {THREE.Color} out
 */
export function treeTint(kind, tint, hue, out) {
  if (kind === TREE.maple) {
    if (hue < 0.4) out.setRGB(1, 1, 1);
    else if (hue < 0.75) out.setRGB(1.05, 0.5, 0.45);
    else out.setRGB(1.1, 1.2, 0.5);
  } else if (kind === TREE.birch) out.setRGB(1, hue < 0.25 ? 1.1 : 1, hue < 0.25 ? 0.8 : 1);
  else if (kind === TREE.broadleaf) out.setRGB(hue < 0.2 ? 1.2 : 1, hue < 0.2 ? 1.2 : 1, hue < 0.2 ? 0.7 : 1);
  else out.setRGB(1, 1, 0.95);
  return out.multiplyScalar(tint);
}

/**
 * Trees as instanced meshes, one per chunk and species.
 * @param {Tree[]} trees
 * @returns {{ group: THREE.Group, chunks: { mesh: THREE.InstancedMesh, x: number, z: number }[] }}
 */
export function buildTrees(trees) {
  const geos = treeGeometries();
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
      pos.set(t.x, t.y, t.z);
      scl.set(t.s, t.s * rng.range(0.9, 1.15), t.s);
      mesh.setMatrixAt(i, m.compose(pos, q, scl));
      mesh.setColorAt(i, treeTint(kind, t.tint, t.hue, col));
    });
    mesh.computeBoundingSphere();
    group.add(mesh);
    chunks.push({ mesh, x: (cx + 0.5) * TREE_CHUNK, z: (cz + 0.5) * TREE_CHUNK });
  }
  return { group, chunks };
}

export { TREE_COUNT };
