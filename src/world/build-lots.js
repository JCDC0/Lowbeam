/**
 * Meshes for the landmark models made in Blender (assets/models/*.json, see lots.js for the data
 * and tools/blender/ for the scripts that build them). Each material becomes a PSX material: a
 * named texture from textures.js (window, metal, shutter, concrete, asphalt) or a sign painted
 * from the lot's name, lit by the light pools, or unlit when the model marks it emissive (lamps,
 * lit glass, signs).
 */

import { FONT } from '../render/fonts.js';
import * as THREE from 'three';
import { psxBasic, psxLambert } from '../render/psx.js';
import { asphaltTexture, canvasTexture, concreteTexture, makeCanvas, metalTexture, shutterTexture, windowTextures } from '../render/textures.js';
import { lotFrame } from './lots.js';

/** @typedef {import('./lots.js').ModelData} ModelData */

/**
 * Fetches every model the lots use. A model that fails to load is left out: its lot stays an
 * empty paved yard.
 * @param {string[]} names
 * @returns {Promise<Record<string, ModelData>>}
 */
export async function loadModels(names) {
  /** @type {Record<string, ModelData>} */
  const out = {};
  await Promise.all([...new Set(names)].map(async (name) => {
    try {
      const res = await fetch(`assets/models/${name}.json`);
      if (res.ok) out[name] = await res.json();
    } catch {
      // A missing model leaves an empty lot.
    }
  }));
  return out;
}

/** Sign colors per lot kind: background, text, border. */
const SIGN_STYLE = {
  police: ['#1d4fa6', '#ffffff', '#e8eef8'],
  garage: ['#f2c230', '#141416', '#d8382e'],
  hideout: ['#2a2a2a', '#c8c0b0', '#555'],
};

/** @param {string} text @param {string} kind */
function signTexture(text, kind) {
  const [bg, ink, edge] = SIGN_STYLE[kind] || SIGN_STYLE.garage;
  const c = makeCanvas(256, 64);
  const g = c.getContext('2d');
  g.fillStyle = bg;
  g.fillRect(0, 0, 256, 64);
  g.strokeStyle = edge;
  g.lineWidth = 4;
  g.strokeRect(4, 4, 248, 56);
  g.fillStyle = ink;
  g.font = `${text.length > 14 ? 26 : 32}px ${FONT.impact}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, 128, 34, 236);
  return canvasTexture(c);
}

/**
 * @param {ModelData} m @param {{ kind: string, sign?: string, name: string }} lot
 * @returns {THREE.Material[]}
 */
function materials(m, lot) {
  const win = windowTextures();
  return m.materials.map((mt) => {
    const color = mt.color;
    if (mt.tex.startsWith('sign:')) return psxBasic({ map: signTexture(lot.sign || lot.name, lot.kind) });
    if (mt.emissive) return psxBasic({ color });
    switch (mt.tex) {
      case 'window': return psxLambert({ color, map: win.map, emissiveMap: win.emissive, emissive: 0xffffff, baked: true });
      case 'metal': return psxLambert({ color, map: metalTexture(), baked: true });
      case 'shutter': return psxLambert({ color, map: shutterTexture(), baked: true });
      case 'concrete': return psxLambert({ color, map: concreteTexture(), baked: true });
      case 'asphalt': return psxLambert({ color, map: asphaltTexture(), baked: true });
      default: return psxLambert({ color, baked: true, side: THREE.DoubleSide });
    }
  });
}

/**
 * The model of each lot, placed and turned to its road.
 * @param {import('./lots.js').LotPad[]} lots @param {Record<string, ModelData>} models
 */
export function buildLots(lots, models) {
  const group = new THREE.Group();
  group.name = 'lots';
  /** @type {Map<string, THREE.BufferGeometry>} */
  const geos = new Map();
  for (const pad of lots) {
    const m = models[pad.lot.model];
    if (!m) continue;
    let geo = geos.get(m.name);
    if (!geo) {
      geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(m.position, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(m.normal, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(m.uv, 2));
      geo.setAttribute('bake', new THREE.Float32BufferAttribute(new Float32Array(m.position.length), 3));
      for (const gr of m.groups) geo.addGroup(gr.start, gr.count, gr.material);
      geo.computeBoundingSphere();
      geos.set(m.name, geo);
    }
    const mesh = new THREE.Mesh(geo, materials(m, pad.lot));
    const f = lotFrame(pad);
    mesh.position.set(f.x, f.y, f.z);
    mesh.rotation.y = f.yaw;
    mesh.name = `lot-${pad.lot.id}`;
    group.add(mesh);
  }
  return group;
}
