/**
 * Draws what the pursuit puts on the road besides the units: the spike strip across a roadblock's
 * gap, from the Blender model (tools/blender/spike_strip.py), stretched to the gap it covers. The
 * roadblock cars themselves are traffic agents and draw with the traffic.
 */

import * as THREE from 'three';
import { meshOf } from './heli-view.js';

/** The models World.create loads for it. */
export const PURSUIT_MODELS = ['spike_strip'];

/** The strip model's length across the road, meters (G1: 4.0). */
const STRIP_LENGTH = 4;

export class PursuitView {
  /** @param {Record<string, import('../world/lots.js').ModelData>} models */
  constructor(models) {
    this.group = new THREE.Group();
    this.group.name = 'pursuit-props';
    const m = models.spike_strip;
    /** @type {THREE.Object3D} */
    this.strip = m ? meshOf(m) : new THREE.Mesh(new THREE.BoxGeometry(STRIP_LENGTH, 0.06, 0.3), new THREE.MeshBasicMaterial({ color: 0x404448 }));
    this.strip.visible = false;
    this.group.add(this.strip);
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
}
