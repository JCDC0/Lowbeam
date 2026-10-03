/**
 * Per-pixel light pools. The world's lights (street lamps, canopies, konbini, neon, floods) go
 * into two float textures: one holds every light, the other a grid over the map where each cell
 * lists the lights that reach it. psx.js materials made with `baked: true` read them in the
 * fragment shader once `installPools` has run, so a lamp throws a real pool with an edge onto the
 * road instead of the vertex glow the baked attribute gave on 8 m terrain cells and 7-column road
 * ribbons. The grid is built once with the world; the lights never move.
 */

import * as THREE from 'three';
import { psxUniforms } from './psx.js';
import { POOL_CELL, POOL_PER_CELL, poolGrid } from './pool-grid.js';

/** @typedef {import('../world/scatter.js').BakeLight} BakeLight */

/** Lights per row of the light texture (two texels each). */
const ROW = 1024;

/**
 * Uploads the lights and switches every baked material over to per-pixel pools.
 * @param {BakeLight[]} lights @param {number} half
 */
export function installPools(lights, half) {
  const { dims, x0, cells } = poolGrid(lights, half);
  const rows = Math.max(1, Math.ceil(lights.length / ROW));
  const L = new Float32Array(ROW * 2 * rows * 4);
  lights.forEach((l, i) => {
    const o = ((Math.floor(i / ROW) * ROW * 2) + (i % ROW) * 2) * 4;
    L.set([l.x, l.y, l.z, l.range, l.c[0], l.c[1], l.c[2], l.spot ?? 0], o);
  });
  const lightTex = new THREE.DataTexture(L, ROW * 2, rows, THREE.RGBAFormat, THREE.FloatType);
  const C = new Float32Array(cells.length);
  C.set(cells);
  const cellTex = new THREE.DataTexture(C, dims * (POOL_PER_CELL / 4), dims, THREE.RGBAFormat, THREE.FloatType);
  for (const t of [lightTex, cellTex]) {
    t.magFilter = THREE.NearestFilter;
    t.minFilter = THREE.NearestFilter;
    t.generateMipmaps = false;
    t.needsUpdate = true;
  }
  psxUniforms.uPoolLights.value?.dispose();
  psxUniforms.uPoolCells.value?.dispose();
  psxUniforms.uPoolLights.value = lightTex;
  psxUniforms.uPoolCells.value = cellTex;
  psxUniforms.uPoolGrid.value.set(x0, x0, POOL_CELL, dims);
  psxUniforms.uPoolsOn.value = 1;
}
