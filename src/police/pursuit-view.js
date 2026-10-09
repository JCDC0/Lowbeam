/**
 * Draws what the pursuit puts on the road besides the units: the spike strip across a roadblock's
 * gap, from the Blender model (tools/blender/spike_strip.py), stretched to the gap it covers. The
 * roadblock cars themselves are traffic agents and draw with the traffic.
 */

import * as THREE from 'three';
import { meshOf } from './heli-view.js';

/** The models World.create loads for it. */
export const PURSUIT_MODELS = ['spike_strip', 'police_barrier'];

/** The strip model's length across the road, meters (G1: 4.0). */
const STRIP_LENGTH = 4;
const BARRIER_WIDTH = 2.4;

export class PursuitView {
  /** @param {Record<string, import('../world/lots.js').ModelData>} models */
  constructor(models) {
    this.models = models;
    this.group = new THREE.Group();
    this.group.name = 'pursuit-props';
    const m = models.spike_strip;
    /** @type {THREE.Object3D} */
    this.strip = m ? meshOf(m) : new THREE.Mesh(new THREE.BoxGeometry(STRIP_LENGTH, 0.06, 0.3), new THREE.MeshBasicMaterial({ color: 0x404448 }));
    this.strip.visible = false;
    this.group.add(this.strip);

    this.barrierGroup = new THREE.Group();
    this.barrierGroup.name = 'barriers';
    this.group.add(this.barrierGroup);

    /** @type {THREE.Mesh[]} */
    this.barrierMeshes = [];
    this.time = 0;
  }

  /**
   * Shows the strip where the director laid it, or hides it.
   * @param {{ x: number, y: number, z: number, yaw: number, len: number } | null} strip
   */
  setStrip(strip) {
    this.strip.visible = !!strip;
    if (!strip) return;
    this.strip.position.set(strip.x, strip.y + 0.01, strip.z);
    this.strip.rotation.y = strip.yaw;
    this.strip.scale.set(strip.len / STRIP_LENGTH, 1, 1);
  }

  /**
   * Draws barriers from the police_barrier model and flashes the lamp on top at ~2 Hz.
   * @param {number} dt
   * @param {any[]} [barriers]
   */
  step(dt, barriers = []) {
    this.time += dt;
    const lit = (this.time * 2) % 1 < 0.5;

    while (this.barrierMeshes.length < barriers.length) {
      const bm = this.models.police_barrier;
      let mesh;
      if (bm) {
        mesh = meshOf(bm);
        if (Array.isArray(mesh.material)) {
          const lampIdx = bm.materials.findIndex((mt) => mt && mt.name === 'lamp');
          if (lampIdx >= 0) {
            mesh.material = [...mesh.material];
            mesh.material[lampIdx] = mesh.material[lampIdx].clone();
            mesh.userData.lampMat = mesh.material[lampIdx];
          }
        }
      } else {
        const mat = new THREE.MeshBasicMaterial({ color: 0xd42418 });
        mesh = new THREE.Mesh(
          new THREE.BoxGeometry(BARRIER_WIDTH, 1.1, 0.55),
          mat
        );
        mesh.userData.lampMat = mat;
      }
      this.barrierGroup.add(mesh);
      this.barrierMeshes.push(mesh);
    }

    for (let i = 0; i < this.barrierMeshes.length; i++) {
      const mesh = this.barrierMeshes[i];
      if (i < barriers.length) {
        const bar = barriers[i];
        mesh.visible = true;
        mesh.position.set(bar.x, (bar.y || 0) + 0.01, bar.z);
        mesh.rotation.y = bar.yaw;
        if (bar.mode === 'knocked' || bar.flattened) {
          mesh.rotation.x = Math.min(Math.PI / 2, ((bar.knockAge || 0) + 0.05) * 8);
        } else {
          mesh.rotation.x = 0;
        }
        if (mesh.userData.lampMat) {
          mesh.userData.lampMat.color.setHex(lit ? 0xff9c14 : 0x221100);
        }
      } else {
        mesh.visible = false;
      }
    }
  }
}
