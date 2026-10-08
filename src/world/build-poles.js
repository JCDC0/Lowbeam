/**
 * Meshes for the utility poles (`poles.js`): tapered concrete poles with a crossarm, insulators, a
 * telephone bracket and on some a transformer drum, baked and merged in 700 m chunks culled with the
 * ground; and every wire as a sagging line of one pixel, in the same chunks.
 */

import * as THREE from 'three';
import { MeshBuilder } from '../render/builder.js';
import { psxLambert, psxLine } from '../render/psx.js';
import { bakeGeometry } from '../render/bake.js';
import { POLE, SAG, WIRES } from './poles.js';

const CHUNK = 700;
/** Straight pieces per wire per span. */
const PIECES = 6;

/**
 * @param {import('./poles.js').PoleLine} line
 * @param {import('../render/bake.js').LightGrid} grid
 */
export function buildPoles(line, grid) {
  const group = new THREE.Group();
  group.name = 'poles';
  /** @type {{ mesh: THREE.Object3D, x: number, z: number }[]} */
  const chunks = [];
  group.userData.chunks = chunks;
  const { poles, spans } = line;
  if (!poles.length) return group;
  const key = (x, z) => `${Math.floor(x / CHUNK)},${Math.floor(z / CHUNK)}`;
  /** @type {Map<string, { b: MeshBuilder, wires: number[], x: number, z: number, n: number }>} */
  const cells = new Map();
  const cellAt = (x, z) => {
    const k = key(x, z);
    let e = cells.get(k);
    if (!e) cells.set(k, (e = { b: new MeshBuilder(), wires: [], x: 0, z: 0, n: 0 }));
    return e;
  };
  for (const pole of poles) {
    const e = cellAt(pole.x, pole.z);
    e.x += pole.x;
    e.z += pole.z;
    e.n++;
    const b = e.b;
    b.push(pole.x, pole.y, pole.z, pole.yaw);
    b.box('pole', 0, POLE.h * 0.3, 0, POLE.r * 2, POLE.h * 0.6, POLE.r * 2);
    b.box('pole', 0, POLE.h * 0.8, 0, POLE.r * 1.6, POLE.h * 0.4, POLE.r * 1.6);
    b.box('pole', 0, POLE.arm, 0, 1.9, 0.12, 0.12, { bottom: true });
    for (const [wx, wy] of WIRES.slice(0, 3)) b.box('pole', wx, wy - 0.12, 0, 0.08, 0.16, 0.08);
    b.box('pole', 0.12, POLE.phone, 0, 0.3, 0.08, 0.08, { bottom: true });
    if (pole.transformer) b.box('pole', -0.42, POLE.arm - 1.6, 0, 0.55, 0.9, 0.55, { bottom: true });
    b.pop();
  }
  const local = (pole, wx, wy) => {
    const c = Math.cos(pole.yaw);
    const s = Math.sin(pole.yaw);
    return [pole.x + c * wx, pole.y + wy, pole.z - s * wx];
  };
  for (const [i, j] of spans) {
    const a = poles[i];
    const b = poles[j];
    const e = cellAt((a.x + b.x) / 2, (a.z + b.z) / 2);
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    for (const [wx, wy] of WIRES) {
      const p0 = local(a, wx, wy);
      const p1 = local(b, wx, wy);
      for (let k = 0; k < PIECES; k++) {
        for (const t of [k / PIECES, (k + 1) / PIECES]) {
          const sag = 4 * SAG * len * t * (1 - t);
          e.wires.push(p0[0] + (p1[0] - p0[0]) * t, p0[1] + (p1[1] - p0[1]) * t - sag, p0[2] + (p1[2] - p0[2]) * t);
        }
      }
    }
  }
  const mat = psxLambert({ color: 0x8c8a84, baked: true });
  // A shade lighter than the night sky, as wires look lit by the street below; black ones vanish.
  const wireMat = psxLine({ color: 0x4a4f5a });
  for (const e of cells.values()) {
    const x = e.n ? e.x / e.n : 0;
    const z = e.n ? e.z / e.n : 0;
    if (!e.b.isEmpty()) {
      const geo = e.b.geometry(['pole']);
      const mesh = new THREE.Mesh(bakeGeometry(geo.geometry, grid, { wrap: 0.6 }), geo.keys.map(() => mat));
      mesh.name = 'pole-chunk';
      group.add(mesh);
      chunks.push({ mesh, x, z });
    }
    if (e.wires.length) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(e.wires, 3));
      const wires = new THREE.LineSegments(geo, wireMat);
      wires.name = 'wire-chunk';
      group.add(wires);
      const w = e.wires;
      chunks.push({ mesh: wires, x: e.n ? x : w[0], z: e.n ? z : w[2] });
    }
  }
  return group;
}
