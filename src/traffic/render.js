/**
 * Draws the traffic: one InstancedMesh per vehicle kind, so forty cars cost a dozen draw
 * calls. Paint is the instance color, brake lights come from an instanced attribute, and the
 * vehicles are lit by the same local light as the player's car.
 *
 * Each car within SHADOW_RANGE has a blob shadow on the road (one more draw call for all of them),
 * darker by day, as the player's car has.
 *
 * Their lamps: every car within FLARE_RANGE gets four flares (one more draw call for all of
 * them), white at the headlamps and red at the tail lamps, brighter when braking, found from the
 * body's own `lamp` vertices so they sit on the modeled lamps. The world shader's moving lights
 * (`uBeamPos` in psx.js) go first to the police light bars nearest the player, then to the lit
 * indicators, then to the headlight beams of the nearest cars.
 */

import * as THREE from 'three';
import { BEAMS, psxBasic, psxFlare, psxUniforms } from '../render/psx.js';
import { psxPhong } from '../render/psx.js';
import { flareTexture, shadowTexture } from '../render/textures.js';
import { ALL_KINDS } from './kinds.js';
import { buildKindGeometry } from './bodies.js';
import { barFlash, barOn } from '../police/lights.js';
import { DAMAGE, health, isUnit } from '../police/units.js';

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _c = new THREE.Color();
const UP = new THREE.Vector3(0, 1, 0);
/** Cars this close to the player show their lamp flares, meters. */
const FLARE_RANGE = 420;
const MAX_FLARE_CARS = 60;
/** Cars this close to the player have a shadow (a flat quad: at a distance it fights the road), at most MAX_SHADOWS. */
const SHADOW_RANGE = 160;
const MAX_SHADOWS = 64;
/** The shadow's opacity by day and by night: the sun throws a hard one, the lamps a faint one. */
const SHADOW_DAY = 0.9;
const SHADOW_NIGHT = 0.45;
/** Flares per car: four lamps, two on the roof of a police car with a light bar, and its watch mark. */
const FLARES_PER_CAR = 7;
/** The mark over a unit that sees the player before a pursuit: amber, red once the bar is nearly full. */
const WATCH = new THREE.Color(2.2, 1.3, 0.2);
const WATCH_HOT = new THREE.Color(2.6, 0.35, 0.15);
const HEAD = new THREE.Color(1.0, 0.92, 0.72);
const TAIL = new THREE.Color(0.85, 0.06, 0.04);
const TAIL_BRAKE = new THREE.Color(1.6, 0.12, 0.06);
/** An indicator: amber, at the same brightness as a head lamp flare. */
const SIGNAL = new THREE.Color(1.5, 0.62, 0.06);
/** A police light bar: red on the car's left, blue on its right, flashing (police/lights.js). */
const BAR_RED = new THREE.Color(2.6, 0.18, 0.12);
const BAR_BLUE = new THREE.Color(0.25, 0.45, 2.8);
/** The unlit half of a light bar (and a bar light between pulses): black adds nothing. */
const BAR_OFF = new THREE.Color(0, 0, 0);
/** How big a lit bar flare is against a head lamp's, and the indicator flare when it blinks. */
const BAR_SIZE = 1.9;
const SIGNAL_GROW = 1.35;
/**
 * What a bar throws on its surroundings: a light above the roof shining down and out, wide enough
 * to reach the walls beside it, on the nearest BAR_POOLS units.
 */
const BAR_LIGHT = { range: 18, cos: -0.35, lift: 1.2 };
const BAR_POOLS = 4;
const BAR_RED_LIGHT = new THREE.Color(1.5, 0.08, 0.05);
const BAR_BLUE_LIGHT = new THREE.Color(0.12, 0.3, 1.7);
/** A lit indicator's small amber pool at the front corner, on the nearest SIGNAL_POOLS. */
const SIGNAL_LIGHT = { range: 6.5, cos: 0.1 };
const SIGNAL_POOLS = 3;
const SIGNAL_LIGHT_COLOR = new THREE.Color(1.1, 0.48, 0.04);
/** A headlight beam's color. */
const HEAD_LIGHT = new THREE.Color(1.0, 0.94, 0.8);
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
    // Only the lamps in the front and back quarters: a taxi's lit roof sign is not a head lamp.
    if (tail ? z > -kind.length * 0.25 : z < kind.length * 0.25) continue;
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
  /**
   * @param {THREE.Object3D} parent
   * @param {Record<string, import('../world/build-lots.js').ModelData>} [models] Blender bodies by name (`KIND_MODELS`)
   */
  constructor(parent, models = {}) {
    this.root = new THREE.Group();
    this.root.name = 'traffic';
    parent.add(this.root);
    this.time = 0;
    this.material = psxPhong({ vertexColors: true, local: true, lamp: true, paint: true, specular: 0x303030, shininess: 34, side: THREE.DoubleSide });
    /** @type {Map<string, { mesh: THREE.InstancedMesh, brake: THREE.InstancedBufferAttribute, max: number, n: number, lamps: ReturnType<typeof lampSpots>, bar: number[] | null }>} */
    this.meshes = new Map();
    for (const kind of ALL_KINDS) {
      const max = kind.length > 7 ? 10 : 28;
      const geo = buildKindGeometry(kind, models);
      const brake = new THREE.InstancedBufferAttribute(new Float32Array(max), 1);
      geo.setAttribute('aBrake', brake);
      const mesh = new THREE.InstancedMesh(geo, this.material, max);
      mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3);
      mesh.frustumCulled = false;
      mesh.count = 0;
      mesh.name = kind.id;
      this.root.add(mesh);
      this.meshes.set(kind.id, { mesh, brake, max, n: 0, lamps: lampSpots(geo, kind), bar: geo.userData.bar || null });
    }
    const flat = new THREE.PlaneGeometry(1, 1);
    flat.rotateX(-Math.PI / 2);
    this.shadows = new THREE.InstancedMesh(flat, psxBasic({ map: shadowTexture(), transparent: true, depthWrite: false, color: 0xffffff }), MAX_SHADOWS);
    this.shadows.frustumCulled = false;
    this.shadows.renderOrder = -1;
    this.shadows.count = 0;
    this.shadows.name = 'traffic-shadows';
    this.root.add(this.shadows);
    const quad = new THREE.PlaneGeometry(1, 1);
    this.flareDir = new THREE.InstancedBufferAttribute(new Float32Array(MAX_FLARE_CARS * FLARES_PER_CAR * 3), 3);
    quad.setAttribute('aDir', this.flareDir);
    this.flares = new THREE.InstancedMesh(quad, psxFlare(flareTexture(), FLARE_RANGE), MAX_FLARE_CARS * FLARES_PER_CAR);
    this.flares.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX_FLARE_CARS * FLARES_PER_CAR * 3), 3);
    this.flares.frustumCulled = false;
    this.flares.renderOrder = 2;
    this.flares.count = 0;
    /** Ids of the units that see the player before a pursuit, and the detection bar (0 to 1). */
    this.watchers = new Set();
    this.detect = 0;
    this.flares.name = 'traffic-lamps';
    this.root.add(this.flares);
    /** @type {{ a: import('./sim.js').Agent, d: number }[]} */
    this.near = [];
    /** The player, whom the light bars face. @type {{ x: number, z: number } | undefined} */
    this.focus = undefined;
  }

  /**
   * @param {import('./sim.js').Agent[]} agents
   * @param {{ x: number, z: number }} [focus] the player, for the flares and the beams
   * @param {number} [time] seconds, for the indicator blink
   */
  update(agents, focus, time = 0) {
    this.time = time;
    this.focus = focus;
    for (const m of this.meshes.values()) m.n = 0;
    this.near.length = 0;
    let shadows = 0;
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
      _c.set(a.paint);
      // A destroyed unit is burnt black; a badly hurt one is dulled by smoke and dents.
      if (a.destroyed) _c.multiplyScalar(0.16);
      else if (isUnit(a.kind) && health(a) < DAMAGE.smoke) _c.multiplyScalar(0.72);
      m.mesh.setColorAt(i, _c);
      m.brake.setX(i, a.brake);
      if (shadows < MAX_SHADOWS && (!focus || Math.hypot(a.x - focus.x, a.z - focus.z) < SHADOW_RANGE)) {
        _p.set(a.x, a.y + 0.04, a.z);
        _s.set((a.kind.width + 0.5) * f, 1, (a.kind.length + 0.7) * f);
        _m.compose(_p, _q, _s);
        this.shadows.setMatrixAt(shadows++, _m);
      }
      if (focus) {
        const d = Math.hypot(a.x - focus.x, a.z - focus.z);
        // A burnt-out unit throws no light.
        if (d < FLARE_RANGE && a.fade > 0.2 && !a.destroyed) this.near.push({ a, d });
      }
    }
    this.lamps();
    this.shadows.count = shadows;
    this.shadows.visible = shadows > 0;
    this.shadows.instanceMatrix.needsUpdate = true;
    /** @type {THREE.MeshBasicMaterial} */ (this.shadows.material).opacity = SHADOW_DAY + (SHADOW_NIGHT - SHADOW_DAY) * psxUniforms.uLamp.value;
    for (const m of this.meshes.values()) {
      m.mesh.count = m.n;
      m.mesh.visible = m.n > 0;
      m.mesh.instanceMatrix.needsUpdate = true;
      if (m.mesh.instanceColor) m.mesh.instanceColor.needsUpdate = true;
      m.brake.needsUpdate = true;
    }
  }

  /**
   * Flares for the cars near the player, and the moving lights of the world shader: first the
   * light bars of the nearest units (red or blue as they flash, lighting the road, the walls and
   * the player's car), then the lit indicators nearest (a small amber pool at the corner), then
   * headlight beams for the nearest cars, until the slots run out.
   */
  lamps() {
    this.near.sort((p, q) => p.d - q.d);
    const beamPos = psxUniforms.uBeamPos.value;
    const beamDir = psxUniforms.uBeamDir.value;
    const beamCol = psxUniforms.uBeamCol.value;
    let f = 0;
    let beams = 0;
    /** @param {number} x @param {number} y @param {number} z @param {number} range @param {number} dx @param {number} dy @param {number} dz @param {number} cos @param {THREE.Color} col */
    const beam = (x, y, z, range, dx, dy, dz, cos, col) => {
      if (beams >= BEAMS) return;
      beamPos[beams].set(x, y, z, range);
      beamDir[beams].set(dx, dy, dz, cos);
      beamCol[beams].set(col.r, col.g, col.b, 0);
      beams++;
    };
    const bars = [];
    const signals = [];
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
          const grow = amber ? SIGNAL_GROW : 1;
          _s.set(size * k * grow, size * k * grow, size * k * grow);
          _m.compose(_p, _q.identity(), _s);
          this.flares.setMatrixAt(f, _m);
          this.flares.setColorAt(f, amber ? SIGNAL : color);
          this.flareDir.setXYZ(f, s * dir, 0, c * dir);
          f++;
          if (amber && dir > 0 && signals.length < SIGNAL_POOLS) signals.push([_p.x, _p.y, _p.z]);
        }
      }
      // A police light bar: red on the car's left, blue on its right, in the quad flash.
      if (a.kind.lightBar && barOn(a)) {
        const flash = barFlash(this.time, a.id);
        for (let i = 0; i < 2; i++) {
          const red = i === 0;
          const lit = red ? flash.red : flash.blue;
          // On the model's own lenses when it has them, else above the roof.
          const spot = m.bar ? [(red ? 1 : -1) * Math.abs(m.bar[0]), m.bar[1] + 0.02, m.bar[2]] : [(red ? 1 : -1) * 0.42, a.kind.height + 0.06, 0.1];
          world(spot);
          const k = lit ? BAR_SIZE : 0.35;
          _s.set(size * k, size * k, size * k);
          _m.compose(_p, _q.identity(), _s);
          this.flares.setMatrixAt(f, _m);
          this.flares.setColorAt(f, lit ? (red ? BAR_RED : BAR_BLUE) : BAR_OFF);
          // A bar is seen from every side: it faces whoever is watching, the player.
          const fx = this.focus ? this.focus.x - _p.x : 0;
          const fz = this.focus ? this.focus.z - _p.z : 0;
          const fl = Math.hypot(fx, fz) || 1;
          this.flareDir.setXYZ(f, (fx / fl) * 0.85, 0.5, (fz / fl) * 0.85);
          f++;
        }
        if (bars.length < BAR_POOLS) {
          world([0, a.kind.height + BAR_LIGHT.lift, 0]);
          bars.push([_p.x, _p.y, _p.z, flash.red ? BAR_RED_LIGHT : flash.blue ? BAR_BLUE_LIGHT : BAR_OFF]);
        }
      }
      if (this.watchers.has(a.id)) {
        world([0, a.kind.height + 1.15, 0]);
        const k = (0.8 + 0.25 * Math.sin(this.time * 9)) * (0.7 + 0.5 * this.detect);
        _s.set(size * k, size * k, size * k);
        _m.compose(_p, _q.identity(), _s);
        this.flares.setMatrixAt(f, _m);
        this.flares.setColorAt(f, this.detect > 0.66 ? WATCH_HOT : WATCH);
        const fx = this.focus ? this.focus.x - _p.x : 0;
        const fz = this.focus ? this.focus.z - _p.z : 0;
        const fl = Math.hypot(fx, fz) || 1;
        this.flareDir.setXYZ(f, (fx / fl) * 0.85, 0.5, (fz / fl) * 0.85);
        f++;
      }
    }
    for (const [x, y, z, col] of bars) beam(x, y, z, BAR_LIGHT.range, 0, -1, 0, BAR_LIGHT.cos, col);
    for (const [x, y, z] of signals) beam(x, y + 0.5, z, SIGNAL_LIGHT.range, 0, -1, 0, SIGNAL_LIGHT.cos, SIGNAL_LIGHT_COLOR);
    for (const { a } of this.near) {
      if (beams >= BEAMS) break;
      const m = this.meshes.get(a.kind.id);
      if (!m) continue;
      const c = Math.cos(a.yaw);
      const s = Math.sin(a.yaw);
      const h = m.lamps.head;
      const lx = (h[0][0] + h[1][0]) / 2;
      const lz = (h[0][2] + h[1][2]) / 2;
      const cp = Math.cos(BEAM.pitch);
      beam(a.x + lx * c + lz * s, a.y + (h[0][1] + h[1][1]) / 2, a.z - lx * s + lz * c, BEAM.range, s * cp, Math.sin(BEAM.pitch), c * cp, BEAM.cos, HEAD_LIGHT);
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
