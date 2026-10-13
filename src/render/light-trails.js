/**
 * Light trails: the red streaks a fast car's tail lamps leave at night (`TRAIL` in `tail-lamps.js`).
 * Each trail is a ribbon through its lamp's recent positions, one point every `TRAIL.spacing` meters
 * and the head on the lamp itself, turned to face the camera in the vertex shader, brightest at the
 * lamp and fading over `TRAIL.life` seconds. It thins near the camera (the chase camera sits in the
 * trail) and fades into the fog. One draw call for every trail of an owner; additive, so a dark trail
 * costs nothing on screen.
 */

import * as THREE from 'three';
import { psxUniforms } from './psx.js';
import { TRAIL } from './tail-lamps.js';

/** Points a trail keeps: enough for `TRAIL.life` at 120 m/s at the spacing. */
const POINTS = 40;
/** A jump longer than this between frames (a reset, a tow) starts the trail again, meters. */
const JUMP = 15;
const COLOR = new THREE.Color(1.5, 0.08, 0.04);

/**
 * @typedef {{ x: number, y: number, z: number, t: number, glow: number }} TrailPoint
 * @typedef {{ pts: TrailPoint[] }} Trail
 */

export class LightTrails {
  /**
   * @param {number} max how many trails at once (two per car)
   * @param {number} [far] meters at which they are gone in the fog
   */
  constructor(max, far = 420) {
    this.max = max;
    /** @type {Map<string | number, Trail>} */
    this.trails = new Map();
    const verts = max * POINTS * 2;
    const geo = new THREE.BufferGeometry();
    this.pos = new THREE.BufferAttribute(new Float32Array(verts * 3), 3);
    this.dir = new THREE.BufferAttribute(new Float32Array(verts * 3), 3);
    this.glow = new THREE.BufferAttribute(new Float32Array(verts), 1);
    const side = new Float32Array(verts);
    const width = new Float32Array(verts);
    for (let s = 0; s < max; s++) {
      for (let i = 0; i < POINTS; i++) {
        const v = (s * POINTS + i) * 2;
        side[v] = -1;
        side[v + 1] = 1;
        width[v] = width[v + 1] = TRAIL.width * (1 - 0.75 * (i / (POINTS - 1)));
      }
    }
    for (const a of [this.pos, this.dir, this.glow]) a.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', this.pos);
    geo.setAttribute('aDir', this.dir);
    geo.setAttribute('aGlow', this.glow);
    geo.setAttribute('aSide', new THREE.BufferAttribute(side, 1));
    geo.setAttribute('aWidth', new THREE.BufferAttribute(width, 1));
    const index = [];
    for (let s = 0; s < max; s++) {
      for (let i = 0; i < POINTS - 1; i++) {
        const a = (s * POINTS + i) * 2;
        index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    geo.setIndex(index);
    this.mesh = new THREE.Mesh(geo, trailMaterial(far));
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 3;
    this.mesh.name = 'light-trails';
    this.mesh.visible = false;
  }

  /**
   * One lamp's place this frame. A trail that is not fed ages out and is dropped.
   * @param {string | number} key stable per lamp @param {number} x @param {number} y @param {number} z
   * @param {number} glow 0 to about 1.4 (`trailGlow`) @param {number} time seconds
   */
  feed(key, x, y, z, glow, time) {
    let tr = this.trails.get(key);
    if (!tr) {
      if (glow <= 0 || this.trails.size >= this.max) return;
      tr = { pts: [] };
      this.trails.set(key, tr);
    }
    const pts = tr.pts;
    const head = pts[0];
    if (head && Math.hypot(x - head.x, y - head.y, z - head.z) > JUMP) pts.length = 0;
    const second = pts[1];
    // The head rides on the lamp; a new point is left behind every `spacing` meters.
    if (!pts.length || !second || Math.hypot(x - second.x, z - second.z) > TRAIL.spacing) {
      pts.unshift({ x, y, z, t: time, glow });
      if (pts.length > POINTS) pts.length = POINTS;
    } else {
      Object.assign(pts[0], { x, y, z, t: time, glow });
    }
  }

  /**
   * Ages the trails and writes them for drawing; call once a frame after every `feed`.
   * @param {number} time seconds, the same clock as `feed`
   */
  update(time) {
    let slot = 0;
    for (const [key, tr] of this.trails) {
      const pts = tr.pts;
      while (pts.length && time - pts[pts.length - 1].t > TRAIL.life) pts.pop();
      if (pts.length < 2 || pts.every((p) => p.glow <= 0)) {
        if (!pts.length) this.trails.delete(key);
        continue;
      }
      this.write(slot++, pts, time);
    }
    for (let s = slot; s < this.max; s++) this.clear(s);
    this.mesh.visible = slot > 0;
    this.pos.needsUpdate = this.dir.needsUpdate = this.glow.needsUpdate = true;
  }

  /** @param {number} s @param {TrailPoint[]} pts @param {number} time */
  write(s, pts, time) {
    const n = pts.length;
    for (let i = 0; i < POINTS; i++) {
      const p = pts[Math.min(i, n - 1)];
      const a = pts[Math.max(0, Math.min(i, n - 1) - 1)];
      const b = pts[Math.min(n - 1, i + 1)];
      let dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z;
      const l = Math.hypot(dx, dy, dz) || 1;
      dx /= l; dy /= l; dz /= l;
      const age = Math.min(1, (time - p.t) / TRAIL.life);
      const g = i < n ? p.glow * (1 - age) * (1 - age) : 0;
      for (let k = 0; k < 2; k++) {
        const v = (s * POINTS + i) * 2 + k;
        this.pos.setXYZ(v, p.x, p.y, p.z);
        this.dir.setXYZ(v, dx, dy, dz);
        this.glow.setX(v, g);
      }
    }
  }

  /** @param {number} s */
  clear(s) {
    for (let v = s * POINTS * 2; v < (s + 1) * POINTS * 2; v++) this.glow.setX(v, 0);
  }

  dispose() {
    this.mesh.parent?.remove(this.mesh);
    this.mesh.geometry.dispose();
    /** @type {THREE.Material} */ (this.mesh.material).dispose();
  }
}

/** @param {number} far */
function trailMaterial(far) {
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: COLOR }, uFar: { value: far }, uSnap: psxUniforms.uSnap, uSnapOn: psxUniforms.uSnapOn },
    vertexShader: /* glsl */ `
      uniform vec2 uSnap;
      uniform float uSnapOn;
      uniform float uFar;
      uniform vec3 uColor;
      attribute vec3 aDir;
      attribute float aGlow;
      attribute float aSide;
      attribute float aWidth;
      varying vec3 vTint;
      varying float vEdge;
      void main() {
        vec3 toCam = cameraPosition - position;
        float dist = length(toCam);
        vec3 side = cross(aDir, toCam / max(dist, 0.001));
        float sl = length(side);
        side = sl > 0.001 ? side / sl : vec3(1.0, 0.0, 0.0);
        vec3 p = position + side * aSide * aWidth * (1.0 + dist * 0.004);
        gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
        if (uSnapOn > 0.5 && gl_Position.w > 0.0) {
          vec2 grid = uSnap * 0.5;
          gl_Position.xy = floor(gl_Position.xy / gl_Position.w * grid + 0.5) / grid * gl_Position.w;
        }
        float near = smoothstep(1.0, 5.0, dist);
        float fog = 1.0 - smoothstep(uFar * 0.55, uFar, dist);
        vTint = uColor * aGlow * near * fog;
        vEdge = aSide;
      }`,
    fragmentShader: /* glsl */ `
      varying vec3 vTint;
      varying float vEdge;
      void main() {
        float core = 1.0 - abs(vEdge);
        gl_FragColor = vec4(vTint * (0.35 + 0.65 * core * core), 1.0);
      }`,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}
