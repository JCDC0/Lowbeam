/**
 * Meshes for the street vending machines (`vending.js`): a box each with its lit front drawn on one
 * canvas in four designs (a red cola, a blue sports drink, a white coffee, a green tea machine),
 * all in one mesh: a thousand machines are 14k triangles, and two draw calls for the island beat two
 * per chunk. The front is unlit, so it glows at night as a real one does; the cabinet takes the light
 * pools.
 */

import * as THREE from 'three';
import { MeshBuilder } from '../render/builder.js';
import { psxBasic, psxLambert } from '../render/psx.js';
import { bakeGeometry } from '../render/bake.js';
import { canvasTexture, makeCanvas } from '../render/textures.js';
import { VENDING } from './vending.js';

const TILE_W = 64;
const TILE_H = 128;
/**
 * Each design: the cabinet's color, its trim, and the colors of the drinks on show.
 * @type {[string, string, string[]][]}
 */
const DESIGNS = [
  ['#c8161c', '#f4f4f4', ['#d01818', '#f2f2f2', '#e8c020']],
  ['#1c56c0', '#f4f4f4', ['#2a7ae0', '#f2f2f2', '#9ad0f0']],
  ['#ecebe6', '#2a2c30', ['#6a3a1c', '#2a2a2a', '#c89040']],
  ['#2c8a3c', '#f4f4f4', ['#3a9a3a', '#c8d878', '#f2f2f2']],
];

/**
 * @param {import('./vending.js').Machine[]} machines
 * @param {import('../render/bake.js').LightGrid} grid
 */
export function buildVending(machines, grid) {
  const group = new THREE.Group();
  group.name = 'vending';
  if (!machines.length) return group;
  const atlas = frontAtlas();
  const mats = {
    body: psxLambert({ color: 0xd8d8d4, baked: true }),
    front: psxBasic({ map: atlas, color: 0xe6e6e6, side: THREE.DoubleSide }),
  };
  const b = new MeshBuilder();
  const { w, d, h } = VENDING;
  for (const m of machines) {
    b.push(m.x, m.y, m.z, m.yaw);
    b.box('body', 0, h / 2, -0.02, w, h, d - 0.04);
    const u0 = (m.design * TILE_W) / (TILE_W * DESIGNS.length);
    const u1 = ((m.design + 1) * TILE_W) / (TILE_W * DESIGNS.length);
    // The front faces local +z, toward the road; local +x is the machine's left seen from behind.
    const x = w / 2 - 0.02;
    const z = d / 2 - 0.01;
    b.quad('front', [x, 0.04, z], [-x, 0.04, z], [-x, h - 0.03, z], [x, h - 0.03, z], [u0, 0, u1, 1]);
    b.pop();
  }
  const geo = b.geometry(['body', 'front']);
  const mesh = new THREE.Mesh(bakeGeometry(geo.geometry, grid, { wrap: 0.6 }), geo.keys.map((k) => mats[k]));
  mesh.name = 'vending-machines';
  group.add(mesh);
  return group;
}

/** The four machine fronts side by side, each 64 by 128. */
function frontAtlas() {
  const c = makeCanvas(TILE_W * DESIGNS.length, TILE_H);
  const g = /** @type {CanvasRenderingContext2D} */ (c.getContext('2d'));
  DESIGNS.forEach(([body, trim, drinks], i) => {
    const x = i * TILE_W;
    g.fillStyle = body;
    g.fillRect(x, 0, TILE_W, TILE_H);
    g.fillStyle = '#f6fbff';
    g.fillRect(x + 4, 6, TILE_W - 8, 62);
    for (let r = 0; r < 3; r++) {
      for (let k = 0; k < 6; k++) {
        g.fillStyle = drinks[(r * 2 + k) % drinks.length];
        g.fillRect(x + 7 + k * 8.6, 10 + r * 19, 6, 12);
        g.fillStyle = '#20242a';
        g.fillRect(x + 7 + k * 8.6, 24 + r * 19, 6, 2);
        g.fillStyle = (r + k) % 4 === 0 ? '#e83030' : '#3ad04a';
        g.fillRect(x + 8 + k * 8.6, 27 + r * 19, 4, 1.5);
      }
    }
    g.fillStyle = trim;
    g.fillRect(x + 4, 72, TILE_W - 8, 4);
    g.fillStyle = '#121418';
    g.fillRect(x + 40, 82, 16, 14);
    g.fillStyle = '#ff9a3a';
    g.fillRect(x + 43, 85, 10, 3);
    g.fillStyle = '#121418';
    g.fillRect(x + 8, 104, TILE_W - 16, 16);
    g.fillStyle = trim;
    g.fillRect(x + 8, 102, TILE_W - 16, 2);
  });
  return canvasTexture(c);
}
