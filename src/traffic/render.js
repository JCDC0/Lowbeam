/**
 * Draws the traffic: one InstancedMesh per vehicle kind, so forty cars cost a dozen draw
 * calls. Paint is the instance color, brake lights come from an instanced attribute, and the
 * vehicles are lit by the same local light as the player's car.
 */

import * as THREE from 'three';
import { psxLambert } from '../render/psx.js';
import { KINDS } from './kinds.js';
import { buildKindGeometry } from './bodies.js';

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _c = new THREE.Color();
const UP = new THREE.Vector3(0, 1, 0);

export class TrafficRenderer {
  /** @param {THREE.Object3D} parent */
  constructor(parent) {
    this.root = new THREE.Group();
    this.root.name = 'traffic';
    parent.add(this.root);
    this.material = psxLambert({ vertexColors: true, local: true, lamp: true, side: THREE.DoubleSide });
    /** @type {Map<string, { mesh: THREE.InstancedMesh, brake: THREE.InstancedBufferAttribute, max: number, n: number }>} */
    this.meshes = new Map();
    for (const kind of KINDS) {
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
      this.meshes.set(kind.id, { mesh, brake, max, n: 0 });
    }
  }

  /** @param {import('./sim.js').Agent[]} agents */
  update(agents) {
    for (const m of this.meshes.values()) m.n = 0;
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
    }
    for (const m of this.meshes.values()) {
      m.mesh.count = m.n;
      m.mesh.visible = m.n > 0;
      m.mesh.instanceMatrix.needsUpdate = true;
      if (m.mesh.instanceColor) m.mesh.instanceColor.needsUpdate = true;
      m.brake.needsUpdate = true;
    }
  }

  dispose() {
    this.root.parent?.remove(this.root);
    for (const m of this.meshes.values()) {
      m.mesh.geometry.dispose();
      m.mesh.dispose();
    }
    this.material.dispose();
  }
}
