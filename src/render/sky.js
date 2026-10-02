/**
 * Night sky: a gradient dome, a few hundred stars and the moon. It follows the camera,
 * ignores fog and draws first. The horizon band is a little brighter than the fog, so
 * the ridgelines read as dark silhouettes against it.
 */

import * as THREE from 'three';
import { makeRng } from '../core/rng.js';

/** Direction the moonlight comes from (toward the moon). North-west, fairly high. */
export const MOON_DIR = new THREE.Vector3(-0.42, 0.55, -0.72).normalize();

const R = 700;

export function buildSky() {
  const group = new THREE.Group();
  group.name = 'sky';

  const dome = new THREE.SphereGeometry(R, 32, 16);
  const pos = dome.attributes.position;
  const col = new Float32Array(pos.count * 3);
  const zenith = new THREE.Color(0x020309);
  const mid = new THREE.Color(0x0a0f22);
  const horizon = new THREE.Color(0x1e2540);
  const glow = new THREE.Color(0x3a2a30);
  const below = new THREE.Color(0x07090f);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) / R;
    const y = pos.getY(i) / R;
    const z = pos.getZ(i) / R;
    if (y < 0) c.copy(below).lerp(horizon, Math.max(0, 1 + y * 8));
    else if (y < 0.25) c.copy(horizon).lerp(mid, y / 0.25);
    else c.copy(mid).lerp(zenith, Math.min(1, (y - 0.25) / 0.6));
    // The town glows a little on the southern horizon.
    const south = Math.max(0, z) * Math.max(0, 1 - Math.abs(y) * 6);
    c.lerp(glow, south * 0.45 * Math.max(0, 1 - Math.abs(x) * 0.6));
    col[i * 3] = c.r;
    col[i * 3 + 1] = c.g;
    col[i * 3 + 2] = c.b;
  }
  dome.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const domeMesh = new THREE.Mesh(dome, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
  domeMesh.renderOrder = -10;
  group.add(domeMesh);

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
  const stars = new THREE.Points(sg, new THREE.PointsMaterial({ size: 1, sizeAttenuation: false, vertexColors: true, fog: false, depthWrite: false }));
  stars.renderOrder = -9;
  group.add(stars);

  const moonPos = MOON_DIR.clone().multiplyScalar(R * 0.9);
  const moon = new THREE.Mesh(new THREE.CircleGeometry(16, 14), new THREE.MeshBasicMaterial({ color: 0xece6cf, fog: false, depthWrite: false }));
  moon.position.copy(moonPos);
  moon.lookAt(0, 0, 0);
  moon.renderOrder = -8;
  const halo = new THREE.Mesh(
    new THREE.CircleGeometry(60, 20),
    new THREE.MeshBasicMaterial({ color: 0x223050, transparent: true, opacity: 0.35, fog: false, depthWrite: false, blending: THREE.AdditiveBlending })
  );
  halo.position.copy(moonPos).multiplyScalar(1.01);
  halo.lookAt(0, 0, 0);
  halo.renderOrder = -9;
  group.add(halo, moon);
  return group;
}
