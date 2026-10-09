/**
 * Rain: thousands of one-pixel streaks falling through a box that follows the camera. The streaks
 * are placed and moved entirely in the vertex shader from a seed and the time, so the CPU does
 * nothing per streak; each leans away from the way the camera is moving, so at speed the rain
 * rushes at the windshield. They fade out with distance and are not vertex snapped (a streak is a
 * line, it would kink). A streak whose column has a roof over it (`world/rain-cover.js`: a deck, a
 * canopy) is not drawn below that roof, read from a grid texture round the camera.
 */

import * as THREE from 'three';
import { STREAKS, weatherLook } from './weather.js';
import { COVER, NONE } from '../world/rain-cover.js';

/** The size of the box round the camera that holds the streaks, in meters. */
const BOX = new THREE.Vector3(44, 26, 44);
/** Seconds of its own motion a streak is stretched over. */
const SHUTTER = 0.028;

const VERT = /* glsl */ `
attribute vec4 aSeed;
uniform vec3 uBox;
uniform vec3 uRain;
uniform vec3 uRel;
uniform float uTime;
uniform float uCount;
uniform sampler2D uCover;
uniform vec3 uCoverGrid;
varying float vFade;
void main() {
  float tail = float(gl_VertexID & 1);
  vec3 p = aSeed.xyz * uBox + uRain * uTime;
  vec3 c = cameraPosition;
  vec3 w = c + mod(p - c + uBox * 0.5, uBox) - uBox * 0.5;
  w.y += uBox.y * 0.15;
  vec2 cuv = (w.xz - uCoverGrid.xy) / uCoverGrid.z;
  float roof = -1.0e4;
  if (cuv.x >= 0.0 && cuv.y >= 0.0 && cuv.x < 1.0 && cuv.y < 1.0) roof = texture2D(uCover, cuv).r;
  float open = step(roof, w.y);
  w -= uRel * SHUTTER * tail;
  float d = length(w - c);
  vFade = (1.0 - smoothstep(9.0, 21.0, d)) * step(aSeed.w, uCount) * smoothstep(0.6, 2.0, d) * open;
  gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
}
`.replace('SHUTTER', SHUTTER.toFixed(3));

const FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uAlpha;
varying float vFade;
void main() {
  if (vFade <= 0.01) discard;
  gl_FragColor = vec4(uColor * vFade * uAlpha, 1.0);
}
`;

export class RainView {
  constructor() {
    const seeds = new Float32Array(STREAKS * 2 * 4);
    let s = 0x9e3779b9;
    const rnd = () => ((s = (Math.imul(s ^ (s >>> 15), 2246822519) + 0x6d2b79f5) >>> 0) / 4294967296);
    for (let i = 0; i < STREAKS; i++) {
      const x = rnd();
      const y = rnd();
      const z = rnd();
      const k = i / STREAKS;
      for (let v = 0; v < 2; v++) seeds.set([x, y, z, k], (i * 2 + v) * 4);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(STREAKS * 2 * 3), 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 4));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e9);
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uBox: { value: BOX },
        uRain: { value: new THREE.Vector3(0, -12, 0) },
        uRel: { value: new THREE.Vector3(0, -12, 0) },
        uTime: { value: 0 },
        uCount: { value: 0 },
        uColor: { value: new THREE.Color(0.5, 0.58, 0.74) },
        uAlpha: { value: 0.5 },
        uCover: { value: this.coverTexture(null) },
        uCoverGrid: { value: new THREE.Vector3(0, 0, COVER.cells * COVER.cell) },
      },
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
    });
    this.lines = new THREE.LineSegments(geo, this.material);
    this.lines.frustumCulled = false;
    this.lines.renderOrder = 20;
    this.lines.visible = false;
    this.time = 0;
    /** @type {import('../world/rain-cover.js').CoverGrid | null} */
    this.cover = null;
  }

  /**
   * A float texture over a grid's cells (a 1 by 1 one of open sky without a grid).
   * @param {import('../world/rain-cover.js').CoverGrid | null} grid
   */
  coverTexture(grid) {
    const n = grid ? grid.cells : 1;
    const t = new THREE.DataTexture(grid ? grid.data : new Float32Array([NONE]), n, n, THREE.RedFormat, THREE.FloatType);
    t.minFilter = t.magFilter = THREE.NearestFilter;
    t.generateMipmaps = false;
    t.needsUpdate = true;
    return t;
  }

  /** Gives the rain the roofs to keep out from under. @param {import('../world/rain-cover.js').CoverGrid} grid */
  setCover(grid) {
    this.cover = grid;
    this.material.uniforms.uCover.value.dispose();
    this.material.uniforms.uCover.value = this.coverTexture(grid);
  }

  /**
   * @param {number} dt seconds
   * @param {number} level 0 to 1
   * @param {{ vx: number, vy?: number, vz: number }} [cam] the camera's velocity
   * @param {{ x: number, z: number }} [at] where the camera is, for the roofs
   */
  update(dt, level, cam, at) {
    const look = weatherLook(level);
    this.lines.visible = look.streaks > 0;
    if (!this.lines.visible) return;
    if (this.cover && at && this.cover.follow(at.x, at.z)) {
      this.material.uniforms.uCover.value.needsUpdate = true;
      this.material.uniforms.uCoverGrid.value.set(this.cover.x0, this.cover.z0, this.cover.size);
    }
    this.time += dt;
    const u = this.material.uniforms;
    u.uTime.value = this.time;
    u.uCount.value = look.streaks / STREAKS;
    u.uAlpha.value = look.alpha;
    u.uRain.value.set(look.wind, -look.fall, look.wind * 0.4);
    u.uRel.value.set(look.wind - (cam?.vx ?? 0), -look.fall - (cam?.vy ?? 0), look.wind * 0.4 - (cam?.vz ?? 0));
  }
}
