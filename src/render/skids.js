/**
 * Skid marks: dark strips laid on the road behind a sliding tire, for every car (the player's, the
 * traffic's, the racers', the police's). One ring buffer of quads, one draw call; a new mark takes
 * the oldest slot when the buffer is full, and every mark fades out over `FADE` seconds. How hard a
 * car slides is decided in `skid-rules.js`.
 */

import * as THREE from 'three';

/** Quads in the ring buffer. */
const MAX = 3000;
/** Seconds a mark takes to fade away. */
export const FADE = 40;
/** A tire lays a new piece every time it has moved this far, meters. */
const STEP = 0.35;
/** Width of a mark, meters, and how far above the road it floats. */
const WIDTH = 0.24;
const LIFT = 0.03;

const VERT = /* glsl */ `
attribute float aAlpha;
varying float vAlpha;
void main() {
  vAlpha = aAlpha;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;
const FRAG = /* glsl */ `
varying float vAlpha;
void main() {
  if (vAlpha < 0.01) discard;
  gl_FragColor = vec4(0.02, 0.02, 0.025, vAlpha);
}
`;

export class SkidMarks {
  /** @param {THREE.Object3D} parent */
  constructor(parent) {
    this.pos = new Float32Array(MAX * 4 * 3).fill(-1000);
    this.alpha = new Float32Array(MAX * 4);
    this.base = new Float32Array(MAX);
    this.born = new Float32Array(MAX).fill(-1e9);
    const index = new Uint32Array(MAX * 6);
    for (let i = 0; i < MAX; i++) index.set([i * 4, i * 4 + 1, i * 4 + 2, i * 4 + 2, i * 4 + 1, i * 4 + 3], i * 6);
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.geo.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1));
    this.geo.setIndex(new THREE.BufferAttribute(index, 1));
    this.mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    this.mesh = new THREE.Mesh(this.geo, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 1;
    this.mesh.name = 'skids';
    parent.add(this.mesh);
    this.next = 0;
    this.time = 0;
    this.fadeTimer = 0;
    this.dirty = false;
    /** The last point each tire laid, by key ("id:side"). @type {Map<string, { x: number, y: number, z: number }>} */
    this.last = new Map();
  }

  /**
   * One tire this frame: at (x, y, z) on the road, sliding `amount` (0 to 1). A tire that stops
   * sliding ends its strip; the next slide starts a new one.
   * @param {string} key @param {number} x @param {number} y @param {number} z @param {number} amount
   */
  tire(key, x, y, z, amount) {
    const prev = this.last.get(key);
    if (amount < 0.08) {
      if (prev) this.last.delete(key);
      return;
    }
    if (!prev) {
      this.last.set(key, { x, y, z });
      return;
    }
    const dx = x - prev.x;
    const dz = z - prev.z;
    const d = Math.hypot(dx, dz);
    if (d < STEP) return;
    if (d > 4 || Math.abs(y - prev.y) > 1) {
      prev.x = x;
      prev.y = y;
      prev.z = z;
      return;
    }
    const nx = (-dz / d) * WIDTH * 0.5;
    const nz = (dx / d) * WIDTH * 0.5;
    const i = this.next;
    this.next = (this.next + 1) % MAX;
    const p = this.pos;
    const o = i * 12;
    p[o] = prev.x + nx; p[o + 1] = prev.y + LIFT; p[o + 2] = prev.z + nz;
    p[o + 3] = prev.x - nx; p[o + 4] = prev.y + LIFT; p[o + 5] = prev.z - nz;
    p[o + 6] = x + nx; p[o + 7] = y + LIFT; p[o + 8] = z + nz;
    p[o + 9] = x - nx; p[o + 10] = y + LIFT; p[o + 11] = z - nz;
    this.base[i] = 0.35 + 0.5 * amount;
    this.born[i] = this.time;
    this.alpha.fill(this.base[i], i * 4, i * 4 + 4);
    prev.x = x;
    prev.y = y;
    prev.z = z;
    this.dirty = true;
  }

  /** Ages the marks. @param {number} dt */
  step(dt) {
    this.time += dt;
    this.fadeTimer += dt;
    if (this.fadeTimer > 0.5) {
      this.fadeTimer = 0;
      for (let i = 0; i < MAX; i++) {
        const age = this.time - this.born[i];
        if (age > FADE + 1) continue;
        const a = this.base[i] * Math.max(0, 1 - age / FADE);
        this.alpha.fill(a, i * 4, i * 4 + 4);
      }
      this.dirty = true;
    }
    if (this.dirty) {
      this.geo.attributes.position.needsUpdate = true;
      this.geo.attributes.aAlpha.needsUpdate = true;
      this.dirty = false;
    }
  }

  dispose() {
    this.mesh.parent?.remove(this.mesh);
    this.geo.dispose();
    this.mat.dispose();
  }
}
