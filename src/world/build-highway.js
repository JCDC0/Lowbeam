/**
 * Meshes for Route 1: the median barrier and guard rails in 180 m chunks (so they can be
 * culled like the road), and the three toll plazas with canopy, booths, islands and lane
 * lights.
 */

import * as THREE from 'three';
import { MeshBuilder } from '../render/builder.js';
import { psxBasic, psxLambert } from '../render/psx.js';
import { bakeGeometry } from '../render/bake.js';
import { canvasTexture, concreteTexture, makeCanvas } from '../render/textures.js';
import { BARRIER, RAIL } from './highway.js';

const CANOPY_Y = 5.9;

/** A white-on-green plaza sign. @param {string} name */
function signTexture(name) {
  const c = makeCanvas(256, 64);
  const g = c.getContext('2d');
  g.fillStyle = '#0d5a3a';
  g.fillRect(0, 0, 256, 64);
  g.strokeStyle = '#e8f0ea';
  g.lineWidth = 3;
  g.strokeRect(3, 3, 250, 58);
  g.fillStyle = '#f2f6f2';
  g.font = 'bold 26px sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(name, 128, 24);
  g.font = 'bold 15px sans-serif';
  g.fillStyle = '#ffd34a';
  g.fillText('ETC   CASH', 128, 49);
  return canvasTexture(c);
}

/**
 * @param {ReturnType<typeof import('./highway.js').placeHighway>} highway
 * @param {import('../render/bake.js').LightGrid} grid
 */
export function buildHighway(highway, grid) {
  const group = new THREE.Group();
  group.name = 'highway';
  /** @type {{ mesh: THREE.Mesh, x: number, z: number }[]} */
  const chunks = [];
  group.userData.chunks = chunks;

  const concrete = psxLambert({ map: concreteTexture(), baked: true, side: THREE.DoubleSide });
  const steel = psxLambert({ color: 0xaab2b8, baked: true, side: THREE.DoubleSide });
  const post = psxLambert({ color: 0x555a60, baked: true });
  const mats = { c: concrete, steel, post };

  /** @type {Map<number, { b: MeshBuilder, x: number, z: number, n: number }>} */
  const builders = new Map();
  const of = (key, x, z) => {
    let e = builders.get(key);
    if (!e) builders.set(key, (e = { b: new MeshBuilder(), x: 0, z: 0, n: 0 }));
    e.x += x;
    e.z += z;
    e.n++;
    return e.b;
  };

  const { halfBase: hb, halfTop: ht, height: H } = BARRIER;
  for (const s of highway.barrier) {
    const b = of(s.chunk, s.x, s.z);
    const L = s.len / 2;
    b.push(s.x, s.y, s.z, s.yaw);
    const u = s.len / 4;
    b.quad('c', [-hb, 0, -L], [-hb, 0, L], [-ht, H, L], [-ht, H, -L], [0, 0, u, 1]);
    b.quad('c', [-ht, H, -L], [-ht, H, L], [ht, H, L], [ht, H, -L], [0, 0, u, 0.3]);
    b.quad('c', [ht, H, -L], [ht, H, L], [hb, 0, L], [hb, 0, -L], [0, 0, u, 1]);
    b.pop();
  }
  for (const s of highway.rails) {
    const b = of(s.chunk + 100000, s.x, s.z);
    const L = s.len / 2;
    b.push(s.x, s.y, s.z, s.yaw);
    b.box('steel', 0, (RAIL.low + RAIL.high) / 2, 0, 0.07, RAIL.high - RAIL.low, s.len, { top: true });
    b.box('post', 0.06, RAIL.high / 2 - 0.05, -L, 0.14, RAIL.high, 0.14);
    b.pop();
  }
  for (const [, e] of builders) {
    const geo = e.b.geometry(['c', 'steel', 'post']);
    const mesh = new THREE.Mesh(bakeGeometry(geo.geometry, grid, { wrap: 0.6 }), geo.keys.map((k) => mats[k]));
    mesh.name = 'highway-furniture';
    group.add(mesh);
    chunks.push({ mesh, x: e.x / e.n, z: e.z / e.n });
  }

  for (const pl of highway.plazas) group.add(buildPlaza(pl, grid, mats));
  return group;
}

/**
 * One toll plaza in its own frame: x is across (positive to the left), z is along the road.
 * @param {import('./highway.js').Plaza} pl @param {import('../render/bake.js').LightGrid} grid
 * @param {Record<string, THREE.Material>} shared
 */
function buildPlaza(pl, grid, shared) {
  const b = new MeshBuilder();
  const y = pl.y;
  b.push(pl.x, 0, pl.z, pl.yaw);
  const span = pl.carriageway * 2 + pl.laneWidth * 3 + 3;
  b.box('c', 0, y + CANOPY_Y, 0, span, 0.7, 13, { bottom: true });
  b.box('c', 0, y + CANOPY_Y + 0.55, 6.4, span, 0.5, 0.3);
  b.box('c', 0, y + CANOPY_Y + 0.55, -6.4, span, 0.5, 0.3);
  for (const u of [...pl.dividers, 0]) b.box('c', u, y + (CANOPY_Y - 0.35) / 2 - 0.05, 0, 0.9, CANOPY_Y - 0.35, 0.9);
  for (const u of pl.dividers) {
    b.box('c', u, y + 0.13, 0, 1.3, 0.26, 18);
    b.box('booth', u, y + 1.56, 0, 1.5, 2.6, 3.2);
    for (const sign of [1, -1]) b.quad('glass', [u - 0.5, y + 1.4, sign * 1.62], [u + 0.5, y + 1.4, sign * 1.62], [u + 0.5, y + 2.4, sign * 1.62], [u - 0.5, y + 2.4, sign * 1.62]);
  }
  b.box('c', 0, y + 0.13, 0, 3.0, 0.26, 24);
  for (const lane of pl.lanes) {
    b.box(lane.cash ? 'amber' : 'green', lane.u, y + CANOPY_Y - 0.6, 6.15, 0.9, 0.45, 0.12);
    b.box(lane.cash ? 'amber' : 'green', lane.u, y + CANOPY_Y - 0.6, -6.15, 0.9, 0.45, 0.12);
  }
  // Barrier arms stand upright beside each booth on the cash side.
  for (const u of pl.dividers) {
    b.box('arm', u + 0.1, y + 1.6, 1.9, 0.12, 3.1, 0.12);
  }
  b.pop();
  const sign = signTexture(pl.toll.name);
  const mats = {
    c: shared.c,
    booth: psxLambert({ color: 0xd6dade, baked: true }),
    glass: psxBasic({ color: 0xbfe8ff, side: THREE.DoubleSide }),
    amber: psxBasic({ color: 0xffb02e }),
    green: psxBasic({ color: 0x3dff7a }),
    arm: psxLambert({ color: 0xf4f4f4, baked: true }),
  };
  const geo = b.geometry(['c', 'booth', 'glass', 'amber', 'green', 'arm']);
  const group = new THREE.Group();
  group.name = `plaza-${pl.toll.id}`;
  group.add(new THREE.Mesh(bakeGeometry(geo.geometry, grid, { wrap: 0.6 }), geo.keys.map((k) => mats[k])));

  // The name board on top of the canopy, facing both ways.
  const board = new THREE.Mesh(new THREE.PlaneGeometry(14, 3.5), psxBasic({ map: sign, side: THREE.DoubleSide }));
  board.position.set(pl.x, y + CANOPY_Y + 2.8, pl.z);
  board.rotation.y = pl.yaw;
  group.add(board);
  const posts = new MeshBuilder();
  posts.push(pl.x, 0, pl.z, pl.yaw);
  for (const u of [-5, 5]) posts.box('post', u, y + CANOPY_Y + 1.2, 0, 0.3, 2.4, 0.3);
  posts.pop();
  group.add(new THREE.Mesh(posts.geometry(['post']).geometry, shared.post));
  return group;
}
