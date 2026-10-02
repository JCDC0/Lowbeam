/**
 * Terrain mesh from the carved heightfield, in square chunks so the camera can cull
 * them. Each cell is split along the same diagonal as Heightfield.at, from (i, j) to
 * (i + 1, j + 1), so the car sits exactly on the triangles you see. Normals come from
 * the whole grid, so chunk edges do not show a seam.
 */

import * as THREE from 'three';
import { psxLambert, psxPhong } from '../render/psx.js';
import { bakeGeometry } from '../render/bake.js';
import { terrainTexture } from '../render/textures.js';
import { fbm } from '../core/rng.js';
import { LAKE, WATER_LEVEL } from './layout.js';

/** Cells per chunk side. */
const CHUNK = 32;
/** Meters per repeat of the detail texture. */
const DETAIL = 10;

const SURFACE_COLORS = [0x34431f, 0x5a4a34, 0x5a5955, 0x8a7d5e].map((h) => new THREE.Color(h));

/**
 * @param {import('./ground.js').Ground} ground
 * @param {import('../render/bake.js').LightGrid} grid
 */
export function buildTerrain(ground, grid) {
  const hf = ground.hf;
  const n = hf.n;
  const cells = n - 1;
  const cs = hf.cell;
  const mat = psxLambert({ vertexColors: true, map: terrainTexture(), baked: true });
  const group = new THREE.Group();
  group.name = 'terrain';
  const col = new THREE.Color();
  const H = (i, j) => hf.h[Math.min(n - 1, Math.max(0, j)) * n + Math.min(n - 1, Math.max(0, i))];

  for (let cj = 0; cj < cells; cj += CHUNK) {
    for (let ci = 0; ci < cells; ci += CHUNK) {
      const ni = Math.min(CHUNK, cells - ci) + 1;
      const nj = Math.min(CHUNK, cells - cj) + 1;
      const count = ni * nj;
      const pos = new Float32Array(count * 3);
      const nrm = new Float32Array(count * 3);
      const clr = new Float32Array(count * 3);
      const uv = new Float32Array(count * 2);
      let k = 0;
      for (let j = 0; j < nj; j++) {
        for (let i = 0; i < ni; i++, k++) {
          const gi = ci + i;
          const gj = cj + j;
          const x = hf.vx(gi);
          const z = hf.vz(gj);
          const h = H(gi, gj);
          pos[k * 3] = x;
          pos[k * 3 + 1] = h;
          pos[k * 3 + 2] = z;
          const gx = (H(gi + 1, gj) - H(gi - 1, gj)) / (2 * cs);
          const gz = (H(gi, gj + 1) - H(gi, gj - 1)) / (2 * cs);
          const l = Math.hypot(gx, 1, gz);
          nrm[k * 3] = -gx / l;
          nrm[k * 3 + 1] = 1 / l;
          nrm[k * 3 + 2] = -gz / l;
          const surf = ground.surface[gj * n + gi];
          col.copy(SURFACE_COLORS[surf]);
          const v = 0.82 + 0.3 * fbm(x * 0.02, z * 0.02, 91, 3);
          const slope = Math.min(1, Math.hypot(gx, gz));
          col.multiplyScalar(v * (1 - 0.25 * slope));
          if (h < WATER_LEVEL + 0.2) col.multiplyScalar(0.6);
          clr[k * 3] = col.r;
          clr[k * 3 + 1] = col.g;
          clr[k * 3 + 2] = col.b;
          uv[k * 2] = x / DETAIL;
          uv[k * 2 + 1] = z / DETAIL;
        }
      }
      const idx = [];
      for (let j = 0; j < nj - 1; j++) {
        for (let i = 0; i < ni - 1; i++) {
          const a00 = j * ni + i;
          const a10 = a00 + 1;
          const a01 = a00 + ni;
          const a11 = a01 + 1;
          idx.push(a00, a11, a10, a00, a01, a11);
        }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
      geo.setAttribute('color', new THREE.BufferAttribute(clr, 3));
      geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      geo.setIndex(idx);
      geo.computeBoundingSphere();
      bakeGeometry(geo, grid);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.matrixAutoUpdate = false;
      group.add(mesh);
    }
  }
  return group;
}

/** The lake surface: a flat disc a little wider than the lake. */
export function buildWater() {
  const geo = new THREE.CircleGeometry(LAKE.r + 25, 28);
  geo.rotateX(-Math.PI / 2);
  const mat = psxPhong({ color: 0x07121e, specular: 0x141c2a, shininess: 120 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(LAKE.x, WATER_LEVEL + 0.02, LAKE.z);
  mesh.name = 'water';
  return mesh;
}
