/**
 * Bakes point lights into a per-vertex `bake` attribute, the PS1 way of having hundreds
 * of lights for free. psx.js materials created with `baked: true` add it on top of the
 * real lights (moon, sky, headlights).
 */

import * as THREE from 'three';
import { psxUniforms } from './psx.js';

/** @typedef {import('../world/scatter.js').BakeLight} BakeLight */

const CELL = 32;

/** Spatial hash of lights so each vertex only looks at its neighbors. */
export class LightGrid {
  /** @param {BakeLight[]} lights */
  constructor(lights) {
    this.lights = lights;
    /** @type {Map<number, BakeLight[]>} */
    this.cells = new Map();
    for (const l of lights) {
      const r = Math.ceil(l.range / CELL);
      const cx = Math.floor(l.x / CELL);
      const cz = Math.floor(l.z / CELL);
      for (let dz = -r; dz <= r; dz++) {
        for (let dx = -r; dx <= r; dx++) {
          const k = this.key(cx + dx, cz + dz);
          let list = this.cells.get(k);
          if (!list) this.cells.set(k, (list = []));
          list.push(l);
        }
      }
    }
  }

  key(cx, cz) {
    return (cx + 1000) * 4096 + (cz + 1000);
  }

  /** @param {number} x @param {number} z */
  near(x, z) {
    return this.cells.get(this.key(Math.floor(x / CELL), Math.floor(z / CELL))) || EMPTY;
  }
}
const EMPTY = [];

/**
 * Writes the `bake` attribute of a geometry whose positions are in world space.
 * `wrap` lets light reach faces turned slightly away, which reads better on low-poly
 * ground than a hard Lambert cutoff. `floor` adds a constant (for emissive-ish props).
 * @param {THREE.BufferGeometry} geo
 * @param {LightGrid} grid
 * @param {{ wrap?: number, gain?: number, matrix?: THREE.Matrix4 }} [opts]
 */
export function bakeGeometry(geo, grid, { wrap = 0.35, gain = 1, matrix } = {}) {
  if (!geo.attributes.normal) geo.computeVertexNormals();
  // Once the per-pixel pools are on, baked materials ignore the attribute: skip the work.
  if (psxUniforms.uPoolsOn.value > 0.5) return noBake(geo);
  const pos = geo.attributes.position;
  const nrm = geo.attributes.normal;
  const n = pos.count;
  const out = new Float32Array(n * 3);
  const p = new THREE.Vector3();
  const q = new THREE.Vector3();
  const nm = matrix ? new THREE.Matrix3().getNormalMatrix(matrix) : null;
  for (let i = 0; i < n; i++) {
    p.fromBufferAttribute(pos, i);
    q.fromBufferAttribute(nrm, i);
    if (matrix) {
      p.applyMatrix4(matrix);
      q.applyMatrix3(nm).normalize();
    }
    let r = 0;
    let g = 0;
    let b = 0;
    for (const l of grid.near(p.x, p.z)) {
      const dx = l.x - p.x;
      const dy = l.y - p.y;
      const dz = l.z - p.z;
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (d >= l.range) continue;
      const fall = 1 - d / l.range;
      const lambert = Math.max(0, ((dx * q.x + dy * q.y + dz * q.z) / Math.max(d, 1e-3) + wrap) / (1 + wrap));
      const k = fall * fall * lambert * gain;
      r += l.c[0] * k;
      g += l.c[1] * k;
      b += l.c[2] * k;
    }
    out[i * 3] = r;
    out[i * 3 + 1] = g;
    out[i * 3 + 2] = b;
  }
  geo.setAttribute('bake', new THREE.BufferAttribute(out, 3));
  return geo;
}

/**
 * Sets a zero `bake` attribute so a geometry can use a baked material with no lights.
 * @param {THREE.BufferGeometry} geo
 */
export function noBake(geo) {
  geo.setAttribute('bake', new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count * 3), 3));
  return geo;
}

/**
 * The baked light at a point, for things that move: the sum of nearby lights and the
 * direction the strongest of them come from (world space, toward the lights).
 * @param {LightGrid} grid @param {number} x @param {number} y @param {number} z
 * @param {THREE.Color} color @param {THREE.Vector3} dir
 */
export function sampleLight(grid, x, y, z, color, dir) {
  color.setRGB(0, 0, 0);
  dir.set(0, 0, 0);
  for (const l of grid.near(x, z)) {
    const dx = l.x - x;
    const dy = l.y - y;
    const dz = l.z - z;
    const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (d >= l.range) continue;
    const fall = 1 - d / l.range;
    const k = fall * fall;
    color.r += l.c[0] * k;
    color.g += l.c[1] * k;
    color.b += l.c[2] * k;
    const w = (k * (l.c[0] + l.c[1] + l.c[2])) / Math.max(d, 0.5);
    dir.x += dx * w;
    dir.y += dy * w;
    dir.z += dz * w;
  }
  if (dir.lengthSq() < 1e-10) dir.set(0, 1, 0);
  else dir.normalize();
}
