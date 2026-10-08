/**
 * Rain: thousands of one-pixel streaks falling through a box that follows the camera. The streaks
 * are placed and moved entirely in the vertex shader from a seed and the time, so the CPU does
 * nothing per streak; each leans away from the way the camera is moving, so at speed the rain
 * rushes at the windshield. They fade out with distance and are not vertex snapped (a streak is a
 * line, it would kink).
 */

import * as THREE from 'three';
import { STREAKS, weatherLook } from './weather.js';

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
varying float vFade;
void main() {
  float tail = float(gl_VertexID & 1);
  vec3 p = aSeed.xyz * uBox + uRain * uTime;
  vec3 c = cameraPosition;
  vec3 w = c + mod(p - c + uBox * 0.5, uBox) - uBox * 0.5;
  w.y += uBox.y * 0.15;
  w -= uRel * SHUTTER * tail;
  float d = length(w - c);
  vFade = (1.0 - smoothstep(9.0, 21.0, d)) * step(aSeed.w, uCount) * smoothstep(0.6, 2.0, d);
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
  }

  /**
   * @param {number} dt seconds
   * @param {number} level 0 to 1
   * @param {{ vx: number, vy?: number, vz: number }} [cam] the camera's velocity
   */
  update(dt, level, cam) {
    const look = weatherLook(level);
    this.lines.visible = look.streaks > 0;
    if (!this.lines.visible) return;
    this.time += dt;
    const u = this.material.uniforms;
    u.uTime.value = this.time;
    u.uCount.value = look.streaks / STREAKS;
    u.uAlpha.value = look.alpha;
    u.uRain.value.set(look.wind, -look.fall, look.wind * 0.4);
    u.uRel.value.set(look.wind - (cam?.vx ?? 0), -look.fall - (cam?.vy ?? 0), look.wind * 0.4 - (cam?.vz ?? 0));
  }
}
