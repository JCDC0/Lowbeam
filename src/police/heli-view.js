/**
 * Draws the police helicopter from its pure state (heli.js): the body, the main rotor and the tail
 * rotor as three meshes from the Blender models (tools/blender/heli.py), a faint cone of light
 * under it, and the searchlight on the ground, which goes into a free slot of the headlight beams
 * in the world shader after the traffic has taken its own (`uBeamPos` in psx.js). The body is lit
 * by the light pools like anything else, so it shows under the lamps when it lands.
 */

import * as THREE from 'three';
import { BEAMS, psxBasic, psxLambert, psxUniforms } from '../render/psx.js';
import { HELI, HELI_PARTS } from './heli.js';

/** The three models World.create loads for it. */
export const HELI_MODELS = ['heli', 'heli_rotor', 'heli_tail'];

/** A mesh of a Blender model with the game's materials. @param {import('../world/lots.js').ModelData} m */
export function meshOf(m) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(m.position, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(m.normal, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(m.uv, 2));
  geo.setAttribute('bake', new THREE.Float32BufferAttribute(new Float32Array(m.position.length), 3));
  for (const gr of m.groups) geo.addGroup(gr.start, gr.count, gr.material);
  geo.computeBoundingSphere();
  const mats = m.materials.map((mt) => (mt.emissive ? psxBasic({ color: mt.color }) : psxLambert({ color: mt.color, baked: true, side: THREE.DoubleSide })));
  return new THREE.Mesh(geo, mats);
}

const _o = new THREE.Vector3();
const _d = new THREE.Vector3();
const _down = new THREE.Vector3(0, -1, 0);

export class HeliView {
  /** @param {Record<string, import('../world/lots.js').ModelData>} models */
  constructor(models) {
    this.group = new THREE.Group();
    this.group.name = 'police-heli';
    this.group.rotation.order = 'YXZ';
    this.ok = HELI_MODELS.every((k) => models[k]);
    if (!this.ok) return;
    this.body = meshOf(models.heli);
    this.rotor = meshOf(models.heli_rotor);
    this.tail = meshOf(models.heli_tail);
    this.rotor.position.set(...HELI_PARTS.mast);
    this.tail.position.set(...HELI_PARTS.tail);
    this.group.add(this.body, this.rotor, this.tail);
    // The shaft of light: bright at the lamp, fading to nothing well above the ground, so a camera
    // standing in the spot is not looking through a wall of it.
    const cone = new THREE.ConeGeometry(1, 1, 16, 4, true);
    cone.translate(0, -0.5, 0);
    const pos = cone.getAttribute('position');
    const shade = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const k = Math.max(0, 1 + pos.getY(i) * 1.25) ** 2;
      shade.set([k, k, k], i * 3);
    }
    cone.setAttribute('color', new THREE.Float32BufferAttribute(shade, 3));
    this.cone = new THREE.Mesh(cone, psxBasic({
      color: 0x8a8576, vertexColors: true, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    }));
    this.cone.name = 'heli-searchlight';
    this.cone.frustumCulled = false;
    this.cone.visible = false;
    /** The beam slot this frame's searchlight went into, so it can be cleared when the light goes off. */
    this.slot = -1;
  }

  /** @param {import('./heli.js').Heli} h */
  update(h) {
    if (!this.ok) return;
    const g = this.group;
    // A backup helicopter put away in the sky is not drawn.
    g.visible = !(h.sky && h.state === 'parked');
    g.position.set(h.x, h.y, h.z);
    g.rotation.set(h.pitch, h.yaw, h.roll);
    this.rotor.rotation.y = h.rotorAngle;
    this.tail.rotation.x = h.tailAngle;
    g.updateMatrixWorld();
    const beamPos = psxUniforms.uBeamPos.value;
    const beamDir = psxUniforms.uBeamDir.value;
    const sp = h.spot;
    if (!sp.on) {
      this.cone.visible = false;
      if (this.slot >= 0 && beamPos[this.slot].w === this.lastW) beamPos[this.slot].w = 0;
      this.slot = -1;
      return;
    }
    _o.set(...HELI_PARTS.light);
    g.localToWorld(_o);
    _d.set(sp.x - _o.x, sp.y - _o.y, sp.z - _o.z);
    const len = _d.length();
    _d.divideScalar(Math.max(len, 1e-3));
    this.cone.visible = true;
    this.cone.position.copy(_o);
    this.cone.quaternion.setFromUnitVectors(_down, _d);
    this.cone.scale.set(sp.r, len, sp.r);
    this.cone.updateMatrixWorld();
    // The traffic fills the beams from slot 0 each frame and clears the rest; take the first free one.
    let slot = -1;
    for (let b = 0; b < BEAMS; b++) {
      if (beamPos[b].w <= 0 || (b === this.slot && beamPos[b].w === this.lastW)) {
        slot = b;
        break;
      }
    }
    if (slot < 0) slot = BEAMS - 1;
    const reach = Math.min(HELI.lightRange * 2, len * 3.6);
    beamPos[slot].set(_o.x, _o.y, _o.z, reach);
    beamDir[slot].set(_d.x, _d.y, _d.z, Math.cos(Math.atan2(sp.r * 1.25, len)));
    psxUniforms.uBeamCol.value[slot].set(1.05, 1.0, 0.92, 0);
    this.slot = slot;
    this.lastW = reach;
  }
}
