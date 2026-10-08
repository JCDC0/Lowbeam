/**
 * The sky: a gradient dome with banded clouds, a few hundred stars, the moon and the sun. It follows
 * the camera, ignores fog and draws first. Everything it shows comes from `skyLook` in
 * `render/daylight.js` (the hour and the cloud cover); `SkyView.update` writes it into the uniforms,
 * so a change of hour or weather costs a handful of uniform writes.
 */

import * as THREE from 'three';
import { makeRng } from '../core/rng.js';

const R = 700;

const DOME_VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const DOME_FRAG = /* glsl */ `
uniform vec3 uZenith;
uniform vec3 uMid;
uniform vec3 uHorizon;
uniform vec3 uGlow;
uniform vec3 uBelow;
uniform vec3 uSunDir;
uniform vec3 uSunCol;
uniform vec3 uCloudLit;
uniform vec3 uCloudDark;
uniform float uSunGlow;
uniform float uCity;
uniform float uCloud;
uniform float uTime;
varying vec3 vDir;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fbm(vec2 p) {
  float a = 0.5;
  float s = 0.0;
  for (int i = 0; i < 4; i++) {
    s += a * vnoise(p);
    p = p * 2.03 + 17.0;
    a *= 0.5;
  }
  return s;
}

void main() {
  vec3 d = normalize(vDir);
  float y = d.y;
  vec3 c;
  if (y < 0.0) c = mix(uBelow, uHorizon, max(0.0, 1.0 + y * 8.0));
  else if (y < 0.25) c = mix(uHorizon, uMid, y / 0.25);
  else c = mix(uMid, uZenith, min(1.0, (y - 0.25) / 0.6));
  float south = max(0.0, d.z) * max(0.0, 1.0 - abs(y) * 6.0);
  c = mix(c, uGlow, south * 0.45 * max(0.0, 1.0 - abs(d.x) * 0.6) * uCity);
  float sd = max(dot(d, uSunDir), 0.0);
  c += uSunCol * (pow(sd, 6.0) * 0.22 + pow(sd, 48.0) * 0.55) * uSunGlow;
  if (y > 0.0 && uCloud > 0.01) {
    vec2 p = d.xz / (y + 0.2) * 1.4 + vec2(uTime * 0.012, uTime * 0.005);
    float n = fbm(p);
    float t = mix(0.7, 0.2, uCloud);
    float cov = smoothstep(t, t + 0.14, n) * smoothstep(0.0, 0.14, y);
    cov = floor(cov * 4.0 + 0.5) / 4.0;
    float nSun = fbm(p + uSunDir.xz * 0.12);
    float shade = clamp(1.0 - smoothstep(t, t + 0.35, n) * 0.7 + (n - nSun) * 2.5, 0.0, 1.0);
    shade = floor(shade * 5.0 + 0.5) / 5.0;
    c = mix(c, mix(uCloudDark, uCloudLit, shade), cov);
  }
  gl_FragColor = vec4(c, 1.0);
}
`;

const _c = new THREE.Color();
/** An sRGB triple as a linear color, the working space. @param {THREE.Color} out @param {number[]} rgb */
export function setSrgb(out, rgb) {
  return out.setRGB(rgb[0], rgb[1], rgb[2], THREE.SRGBColorSpace);
}

export class SkyView {
  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'sky';
    this.time = 0;

    const u = (v) => ({ value: v });
    this.uniforms = {
      uZenith: u(new THREE.Color()), uMid: u(new THREE.Color()), uHorizon: u(new THREE.Color()), uGlow: u(new THREE.Color()),
      uBelow: u(new THREE.Color()), uSunDir: u(new THREE.Vector3(0, 1, 0)), uSunCol: u(new THREE.Color()),
      uCloudLit: u(new THREE.Color()), uCloudDark: u(new THREE.Color()),
      uSunGlow: u(0), uCity: u(1), uCloud: u(0), uTime: u(0),
    };
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(R, 32, 16),
      new THREE.ShaderMaterial({ uniforms: this.uniforms, vertexShader: DOME_VERT, fragmentShader: DOME_FRAG, side: THREE.BackSide, fog: false, depthWrite: false })
    );
    dome.renderOrder = -10;
    this.group.add(dome);

    const rng = makeRng(77);
    const n = 700;
    const sp = new Float32Array(n * 3);
    const sc = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      let x, y, z, l;
      do {
        x = rng.range(-1, 1);
        y = rng.range(0.06, 1);
        z = rng.range(-1, 1);
        l = Math.hypot(x, y, z);
      } while (l > 1 || l < 0.2);
      const k = (R * 0.95) / l;
      sp.set([x * k, y * k, z * k], i * 3);
      const b = rng.chance(0.08) ? rng.range(0.7, 1) : rng.range(0.18, 0.5);
      const tint = rng.range(-0.08, 0.08);
      sc.set([b * (1 + tint), b, b * (1 - tint)], i * 3);
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    sg.setAttribute('color', new THREE.BufferAttribute(sc, 3));
    this.stars = new THREE.Points(sg, new THREE.PointsMaterial({ size: 1, sizeAttenuation: false, vertexColors: true, transparent: true, fog: false, depthWrite: false }));
    this.stars.renderOrder = -9;
    this.group.add(this.stars);

    this.moon = new THREE.Mesh(new THREE.CircleGeometry(16, 14), new THREE.MeshBasicMaterial({ color: 0xece6cf, transparent: true, fog: false, depthWrite: false }));
    this.moon.renderOrder = -8;
    this.moonHalo = new THREE.Mesh(
      new THREE.CircleGeometry(60, 20),
      new THREE.MeshBasicMaterial({ color: 0x223050, transparent: true, opacity: 0.35, fog: false, depthWrite: false, blending: THREE.AdditiveBlending })
    );
    this.moonHalo.renderOrder = -9;
    this.sun = new THREE.Mesh(new THREE.CircleGeometry(20, 14), new THREE.MeshBasicMaterial({ color: 0xfff6dc, transparent: true, fog: false, depthWrite: false }));
    this.sun.renderOrder = -8;
    this.sunHalo = new THREE.Mesh(
      new THREE.CircleGeometry(90, 20),
      new THREE.MeshBasicMaterial({ color: 0x7a5a30, transparent: true, opacity: 0.4, fog: false, depthWrite: false, blending: THREE.AdditiveBlending })
    );
    this.sunHalo.renderOrder = -9;
    this.group.add(this.moonHalo, this.moon, this.sunHalo, this.sun);
  }

  /**
   * Writes a look into the dome, the stars and the two discs.
   * @param {ReturnType<typeof import('./daylight.js').skyLook>} look @param {number} [dt] seconds, for the clouds' drift
   */
  update(look, dt = 0) {
    this.time += dt;
    const U = this.uniforms;
    setSrgb(U.uZenith.value, look.zenith);
    setSrgb(U.uMid.value, look.mid);
    setSrgb(U.uHorizon.value, look.horizon);
    setSrgb(U.uGlow.value, look.glow);
    setSrgb(U.uBelow.value, look.below);
    setSrgb(U.uSunCol.value, look.sunColor);
    setSrgb(U.uCloudLit.value, look.cloudLit);
    setSrgb(U.uCloudDark.value, look.cloudDark);
    U.uSunDir.value.set(look.sunDir[0], look.sunDir[1], look.sunDir[2]);
    U.uSunGlow.value = look.sunGlow;
    U.uCity.value = look.city;
    U.uCloud.value = look.cloud;
    U.uTime.value = this.time;

    this.stars.visible = look.stars > 0.01;
    /** @type {THREE.PointsMaterial} */ (this.stars.material).opacity = look.stars;

    const place = (/** @type {THREE.Object3D} */ o, /** @type {number[]} */ dir, /** @type {number} */ k) => {
      o.position.set(dir[0], dir[1], dir[2]).multiplyScalar(R * k);
      o.lookAt(0, 0, 0);
    };
    place(this.moon, look.moonDir, 0.9);
    place(this.moonHalo, look.moonDir, 0.909);
    place(this.sun, look.sunDir, 0.9);
    place(this.sunHalo, look.sunDir, 0.909);
    this.moon.visible = this.moonHalo.visible = look.moonAlpha > 0.01 && look.moonDir[1] > -0.1;
    this.sun.visible = this.sunHalo.visible = look.sunAlpha > 0.01 && look.sunDir[1] > -0.1;
    /** @type {THREE.MeshBasicMaterial} */ (this.moon.material).opacity = look.moonAlpha;
    /** @type {THREE.MeshBasicMaterial} */ (this.moonHalo.material).opacity = 0.35 * look.moonAlpha;
    /** @type {THREE.MeshBasicMaterial} */ (this.sun.material).opacity = look.sunAlpha;
    /** @type {THREE.MeshBasicMaterial} */ (this.sunHalo.material).opacity = 0.4 * look.sunAlpha;
    setSrgb(_c, look.sunColor);
    /** @type {THREE.MeshBasicMaterial} */ (this.sun.material).color.copy(_c).lerp(_white, 0.5);
  }
}

const _white = new THREE.Color(1, 1, 1);
