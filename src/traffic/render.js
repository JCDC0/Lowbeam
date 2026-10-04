/**
 * Draws the traffic: one InstancedMesh per vehicle kind, so forty cars cost a dozen draw
 * calls. Paint is the instance color, brake lights come from an instanced attribute, and the
 * vehicles are lit by the same local light as the player's car.
 *
 * Their lamps: every car within FLARE_RANGE gets four flares (one more draw call for all of
 * them), white at the headlamps and red at the tail lamps, brighter when braking, found from the
 * body's own `lamp` vertices so they sit on the modeled lamps. The cars nearest the player also
 * throw a headlight beam onto the road through the world shader (`uBeamPos` in psx.js).
 */

import * as THREE from 'three';
import { BEAMS, psxFlare, psxUniforms } from '../render/psx.js';
import { psxPhong } from '../render/psx.js';
import { flareTexture } from '../render/textures.js';
import { ALL_KINDS } from './kinds.js';
import { buildKindGeometry } from './bodies.js';

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _c = new THREE.Color();
const UP = new THREE.Vector3(0, 1, 0);
/** Cars this close to the player show their lamp flares, meters. */
const FLARE_RANGE = 420;
const MAX_FLARE_CARS = 60;
/** Flares per car: four lamps, plus two on the roof of a police car with a light bar. */
const FLARES_PER_CAR = 6;
const HEAD = new THREE.Color(1.0, 0.92, 0.72);
const TAIL = new THREE.Color(0.85, 0.06, 0.04);
const TAIL_BRAKE = new THREE.Color(1.6, 0.12, 0.06);
/** An indicator: amber, at the same brightness as a head lamp flare. */
const SIGNAL = new THREE.Color(1.5, 0.62, 0.06);
/** A police light bar: a bright red flash on the roof, left then right. */
const BAR = new THREE.Color(2.2, 0.16, 0.1);
/** The unlit half of a light bar: the flare mesh is still there, so it is scaled to nothing. */
const BAR_OFF = new THREE.Color(0, 0, 0);
/** Seconds on and off for an indicator, so a queue does not blink in unison. */
const BLINK = 0.33;
/** A headlight beam: range (m), where its cone ends (cosine) and how far down it aims. */
const BEAM = { range: 42, cos: 0.86, pitch: -0.09 };

/**
 * Where a body's lamps are: the middle of its head lamps and tail lamps on each side, from the
 * `lamp` vertex colors (tail lamps are the red ones, the same test the shader uses for braking).
 * @param {THREE.BufferGeometry} geo @param {import('./kinds.js').Kind} kind
 */
function lampSpots(geo, kind) {
  const pos = geo.attributes.position;
  const lamp = geo.attributes.lamp;
  const acc = { head: [[0, 0, 0, 0], [0, 0, 0, 0]], tail: [[0, 0, 0, 0], [0, 0, 0, 0]] };
  for (let i = 0; i < pos.count; i++) {
    const r = lamp.getX(i);
    const g = lamp.getY(i);
    const b = lamp.getZ(i);
    if (r + g + b < 0.3) continue;
    const z = pos.getZ(i);
    const tail = r - g - b > 0.2;
    if (tail ? z > 0 : z < 0) continue;
    const a = acc[tail ? 'tail' : 'head'][pos.getX(i) > 0 ? 0 : 1];
    a[0] += pos.getX(i);
    a[1] += pos.getY(i);
    a[2] += z;
    a[3]++;
  }
  const fallback = (tail, side) => [side * (kind.width / 2 - 0.3), 0.7, (tail ? -1 : 1) * (kind.length / 2)];
  const mean = (a, tail, side) => (a[3] ? [a[0] / a[3], a[1] / a[3], a[2] / a[3]] : fallback(tail, side));
  return {
    head: [mean(acc.head[0], false, 1), mean(acc.head[1], false, -1)],
    tail: [mean(acc.tail[0], true, 1), mean(acc.tail[1], true, -1)],
  };
}

export class TrafficRenderer {
  /** @param {THREE.Object3D} parent */
  constructor(parent) {
    this.root = new THREE.Group();
    this.root.name = 'traffic';
    parent.add(this.root);
    this.time = 0;
    this.material = psxPhong({ vertexColors: true, local: true, lamp: true, paint: true, specular: 0x303030, shininess: 34, side: THREE.DoubleSide });
    /** @type {Map<string, { mesh: THREE.InstancedMesh, brake: THREE.InstancedBufferAttribute, max: number, n: number, lamps: ReturnType<typeof lampSpots> }>} */
    this.meshes = new Map();
    for (const kind of ALL_KINDS) {
      const max = kind.length > 7 ? 10 : 28;
      const geo = buildKindGeometry(kind);
      const brake = new THREE.InstancedBufferAttribute(new Float32Array(max), 1);
      geo.setAttribute('aBrake', brake);
      const mesh = new THREE.InstancedMesh(geo, this.material, max);
      mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3);
      mesh.frustumCulled = false;
      mesh.count = 0;
      mesh.name = kind.id;
      this.root.add(mesh);
      this.meshes.set(kind.id, { mesh, brake, max, n: 0, lamps: lampSpots(geo, kind) });
    }
    const quad = new THREE.PlaneGeometry(1, 1);
    this.flareDir = new THREE.InstancedBufferAttribute(new Float32Array(MAX_FLARE_CARS * FLARES_PER_CAR * 3), 3);
    quad.setAttribute('aDir', this.flareDir);
    this.flares = new THREE.InstancedMesh(quad, psxFlare(flareTexture(), FLARE_RANGE), MAX_FLARE_CARS * FLARES_PER_CAR);
    this.flares.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX_FLARE_CARS * FLARES_PER_CAR * 3), 3);
    this.flares.frustumCulled = false;
    this.flares.renderOrder = 2;
    this.flares.count = 0;
    this.flares.name = 'traffic-lamps';
    this.root.add(this.flares);
    /** @type {{ a: import('./sim.js').Agent, d: number }[]} */
    this.near = [];
  }

  /**
   * @param {import('./sim.js').Agent[]} agents
   * @param {{ x: number, z: number }} [focus] the player, for the flares and the beams
   * @param {number} [time] seconds, for the indicator blink
   */
  update(agents, focus, time = 0) {
    this.time = time;
    for (const m of this.meshes.values()) m.n = 0;
    this.near.length = 0;
    for (const a of agents) {
      const m = this.meshes.get(a.kind.id);
      if (!m || m.n >= m.max) continue;
      const i = m.n++;
      _q.setFromAxisAngle(UP, a.yaw);
      _p.set(a.x, a.y, a.z);
      const f = a.fade < 1 ? Math.max(0.01, a.fade) : 1;
      _s.set(f, f, f);
      _m.compose(_p, _q, _s);
      m.mesh.setMatrixAt(i, _m);
      m.mesh.setColorAt(i, _c.set(a.paint));
      m.brake.setX(i, a.brake);
      if (focus) {
        const d = Math.hypot(a.x - focus.x, a.z - focus.z);
        if (d < FLARE_RANGE && a.fade > 0.2) this.near.push({ a, d });
      }
    }
    this.lamps();
    for (const m of this.meshes.values()) {
      m.mesh.count = m.n;
      m.mesh.visible = m.n > 0;
      m.mesh.instanceMatrix.needsUpdate = true;
      if (m.mesh.instanceColor) m.mesh.instanceColor.needsUpdate = true;
      m.brake.needsUpdate = true;
    }
  }

  /** Flares for the cars near the player, and beams for the nearest of them. */
  lamps() {
    this.near.sort((p, q) => p.d - q.d);
    const beamPos = psxUniforms.uBeamPos.value;
    const beamDir = psxUniforms.uBeamDir.value;
    let f = 0;
    let beams = 0;
    for (const { a } of this.near) {
      const m = this.meshes.get(a.kind.id);
      if (!m || f + FLARES_PER_CAR > MAX_FLARE_CARS * FLARES_PER_CAR) break;
      const c = Math.cos(a.yaw);
      const s = Math.sin(a.yaw);
      const world = (p) => _p.set(a.x + p[0] * c + p[2] * s, a.y + p[1], a.z - p[0] * s + p[2] * c);
      const size = Math.min(2.2, 1.25 + a.kind.width * 0.2);
      // An indicator takes over the outer lamp on the side being signalled, at both ends
      // of the car, and blinks about 1.5 Hz with a phase per car.
      const sig = a.signal || 0;
      const on = sig !== 0 && ((this.time * (1 / (BLINK * 2)) + a.id * 0.37) % 1) < 0.5;
      for (const [spots, color, dir, k] of [[m.lamps.head, HEAD, 1, 1], [m.lamps.tail, a.brake > 0.5 ? TAIL_BRAKE : TAIL, -1, a.brake > 0.5 ? 0.95 : 0.7]]) {
        for (let i = 0; i < spots.length; i++) {
          const p = spots[i];
          // Local +x is the car's left, and spot 0 is that side.
          const side = i === 0 ? -1 : 1;
          const amber = on && (sig === 2 || sig === side);
          world(p);
          _s.set(size * k, size * k, size * k);
          _m.compose(_p, _q.identity(), _s);
          this.flares.setMatrixAt(f, _m);
          this.flares.setColorAt(f, amber ? SIGNAL : color);
          this.flareDir.setXYZ(f, s * dir, 0, c * dir);
          f++;
        }
      }
      // A police light bar: two flares on the roof, alternating left and right at 2 Hz while
      // the unit is chasing. A standstill patrol carries no bar until a pursuit starts.
      if (a.kind.lightBar && a.pursuit) {
        const beat = (this.time * 2 + a.id * 0.21) % 1;
        for (let i = 0; i < 2; i++) {
          const lit = (beat < 0.5) === (i === 0);
          world([(i === 0 ? 1 : -1) * 0.42, a.kind.height + 0.06, 0.1]);
          _s.set(size * 0.8, size * 0.8, size * 0.8);
          _m.compose(_p, _q.identity(), _s);
          this.flares.setMatrixAt(f, _m);
          this.flares.setColorAt(f, lit ? BAR : BAR_OFF);
          this.flareDir.setXYZ(f, 0, 0.25, 0);
          f++;
        }
      }
      if (beams < BEAMS) {
        const h = m.lamps.head;
        world([(h[0][0] + h[1][0]) / 2, (h[0][1] + h[1][1]) / 2, (h[0][2] + h[1][2]) / 2]);
        beamPos[beams].set(_p.x, _p.y, _p.z, BEAM.range);
        const cp = Math.cos(BEAM.pitch);
        beamDir[beams].set(s * cp, Math.sin(BEAM.pitch), c * cp, BEAM.cos);
        beams++;
      }
    }
    for (let b = beams; b < BEAMS; b++) beamPos[b].w = 0;
    this.flares.count = f;
    this.flares.instanceMatrix.needsUpdate = true;
    if (this.flares.instanceColor) this.flares.instanceColor.needsUpdate = true;
    this.flareDir.needsUpdate = true;
  }

  dispose() {
    for (const b of psxUniforms.uBeamPos.value) b.w = 0;
    this.root.parent?.remove(this.root);
    for (const m of this.meshes.values()) {
      m.mesh.geometry.dispose();
      m.mesh.dispose();
    }
    this.material.dispose();
    this.flares.geometry.dispose();
    /** @type {THREE.Material} */ (this.flares.material).dispose();
  }
}
