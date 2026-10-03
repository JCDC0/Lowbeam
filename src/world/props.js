/**
 * Street lamps and the town. Lamps are one mesh; the buildings are merged per 320 m cell (a
 * draw call per material each) so the far ones can be hidden. Trees live in build-trees.js.
 */

import * as THREE from 'three';
import { MeshBuilder } from '../render/builder.js';
import { psxBasic, psxLambert } from '../render/psx.js';
import { bakeGeometry } from '../render/bake.js';
import { metalTexture, shutterTexture, signAtlas, windowTextures } from '../render/textures.js';
import { makeRng } from '../core/rng.js';
import { LAMP_HEIGHT, LAMP_REACH, SIGN_COLORS } from './scatter.js';

/** @typedef {import('./scatter.js').Lamp} Lamp */
/** @typedef {import('./scatter.js').Building} Building */
/** @typedef {[number, number, number]} V3 */

/** Meters per facade texture tile (8 bays of 3 m). */
const FACADE = 24;

/**
 * @param {Lamp[]} lamps
 * @param {import('../render/bake.js').LightGrid} grid
 */
export function buildLamps(lamps, grid) {
  const b = new MeshBuilder();
  const H = LAMP_HEIGHT;
  /** One arm and its head, reaching `reach` along +Z at height `h`, scaled by `k`. */
  const arm = (reach, h, k) => {
    b.box('pole', 0, h - 0.05, reach / 2, 0.09, 0.09, reach);
    b.box('pole', 0, h - 0.12 * k, reach, 0.38 * k, 0.14 * k, 0.82 * k);
    const y = h - 0.195 * k;
    const w = 0.15 * k;
    const l = 0.36 * k;
    b.quad('lens', [-w, y, reach - l], [w, y, reach - l], [w, y, reach + l], [-w, y, reach + l]);
  };
  for (const l of lamps) {
    b.push(l.x, l.y, l.z, l.yaw);
    b.cylinder('pole', 0, H / 2, 0, 0.11, H, 6, 'y', { caps: false });
    arm(LAMP_REACH, H, 1);
    b.pop();
    b.push(l.x, l.y, l.z, l.yaw + Math.PI);
    const backH = l.back.hy - l.y;
    arm(l.back.reach, backH, l.back.reach < LAMP_REACH ? 0.7 : 1);
    b.pop();
  }
  const mesh = b.mesh({ pole: psxLambert({ color: 0x6c7076, baked: true }), lens: psxBasic({ color: 0xffb24c }) });
  bakeGeometry(mesh.geometry, grid);
  mesh.name = 'lamps';
  return mesh;
}

const WALL_TINTS = [0xd8d2c4, 0xc9cdd2, 0xbfb4a2, 0xd6cbb8, 0xa9b0b6, 0xe2ddd2, 0xb8a990];
const HOUSE_TINTS = [0xe4ddcc, 0xd2cab6, 0xc8ccc8, 0xbcae96, 0xe8e2d6, 0xa8a69c];
const ROOF_TINTS = [0x3a3d44, 0x4a3530, 0x34404a, 0x575a5e, 0x5c3f2c];
const METAL_TINTS = [0xc4cacd, 0xa9b4b8, 0x8fa3a8, 0xb8b0a0, 0x9ca88f, 0x7f97b0];
/** Buildings are merged per cell of this size, so the ones lost in the fog are not drawn. */
const TOWN_CELL = 320;

/**
 * The town, as one group of chunk meshes (one per TOWN_CELL square, a draw call per material
 * each). Each building kind has its own shape: offices and apartment blocks with lit windows and
 * roof clutter, towers with a stepped crown and a mast, houses with a pitched roof, warehouses and
 * sheds in corrugated metal with roller doors, garages with lit shutters, factories with a
 * saw-tooth roof, konbini with their glowing fronts.
 * @param {Building[]} buildings
 * @param {import('../render/bake.js').LightGrid} grid
 * @returns {THREE.Group}
 */
export function buildTown(buildings, grid) {
  /** @type {Map<string, { b: MeshBuilder, x: number, z: number, n: number }>} */
  const cells = new Map();
  for (const bd of buildings) {
    const key = `${Math.floor(bd.x / TOWN_CELL)},${Math.floor(bd.z / TOWN_CELL)}`;
    let cell = cells.get(key);
    if (!cell) cells.set(key, (cell = { b: new MeshBuilder(), x: 0, z: 0, n: 0 }));
    cell.x += bd.x;
    cell.z += bd.z;
    cell.n++;
    addBuilding(cell.b, bd);
  }
  const win = windowTextures();
  const mats = {
    wall: psxLambert({ map: win.map, emissiveMap: win.emissive, emissive: 0xffffff, vertexColors: true, baked: true }),
    roof: psxLambert({ vertexColors: true, baked: true }),
    metal: psxLambert({ map: metalTexture(), vertexColors: true, baked: true }),
    shutter: psxLambert({ map: shutterTexture(), vertexColors: true, baked: true }),
    shop: psxBasic({ color: 0xe8f4ff }),
    band: psxBasic({ vertexColors: true }),
    sign: psxBasic({ map: signAtlas(SIGN_COLORS) }),
  };
  const group = new THREE.Group();
  group.name = 'town';
  /** @type {{ mesh: THREE.Mesh, x: number, z: number }[]} */
  const chunks = [];
  group.userData.chunks = chunks;
  for (const [key, cell] of cells) {
    const mesh = cell.b.mesh(mats);
    bakeGeometry(mesh.geometry, grid);
    mesh.name = `town-${key}`;
    group.add(mesh);
    chunks.push({ mesh, x: cell.x / cell.n, z: cell.z / cell.n });
  }
  return group;
}

/**
 * Four walls of a box footprint with one material, the texture running round.
 * @param {MeshBuilder} b @param {string} key @param {number} hw @param {number} hd @param {number} h
 * @param {(len: number, h: number) => number[]} uv
 */
function walls(b, key, hw, hd, h, uv) {
  b.quad(key, [-hw, 0, hd], [hw, 0, hd], [hw, h, hd], [-hw, h, hd], uv(hw * 2, h));
  b.quad(key, [hw, 0, -hd], [-hw, 0, -hd], [-hw, h, -hd], [hw, h, -hd], uv(hw * 2, h));
  b.quad(key, [hw, 0, hd], [hw, 0, -hd], [hw, h, -hd], [hw, h, hd], uv(hd * 2, h));
  b.quad(key, [-hw, 0, -hd], [-hw, 0, hd], [-hw, h, hd], [-hw, h, -hd], uv(hd * 2, h));
}

/** @param {MeshBuilder} b @param {Building} bd */
function addBuilding(b, bd) {
  const rng = makeRng(bd.seed);
  const hw = bd.w / 2;
  const hd = bd.d / 2;
  b.push(bd.x, bd.y, bd.z, bd.yaw);
  const kind = bd.kind;
  if (kind === 'warehouse' || kind === 'garage' || kind === 'factory') shed(b, rng, bd, hw, hd);
  else if (kind === 'house') house(b, rng, bd, hw, hd);
  else if (kind === 'konbini') konbiniBox(b, bd, hw, hd);
  else office(b, rng, bd, hw, hd);
  b.pop();
}

/**
 * Offices, apartment blocks and towers.
 * @param {MeshBuilder} b @param {ReturnType<typeof makeRng>} rng @param {Building} bd @param {number} hw @param {number} hd
 */
function office(b, rng, bd, hw, hd) {
  const h = Math.max(2, Math.round(bd.h / 3)) * 3 + 0.4;
  b.setColor(rng.pick(WALL_TINTS));
  const u0 = rng.int(0, 7) / 8;
  const v0 = rng.int(0, 7) / 8;
  /** @param {number} len @param {number} hh */
  const uv = (len, hh) => [u0, v0, u0 + len / FACADE, v0 + hh / FACADE];
  const tower = bd.kind === 'tower';
  // A tower steps in for its top fifth and carries a mast with a red aviation lamp.
  const base = tower ? Math.round((h * 0.8) / 3) * 3 + 0.4 : h;
  walls(b, 'wall', hw, hd, base, uv);
  b.setColor(0x4a4c50);
  b.quad('roof', [hw, base, -hd], [-hw, base, -hd], [-hw, base, hd], [hw, base, hd]);
  if (tower) {
    const k = 0.72;
    const top = h - base;
    b.push(0, base, 0);
    b.setColor(rng.pick(WALL_TINTS));
    walls(b, 'wall', hw * k, hd * k, top, uv);
    b.setColor(0x3e4044);
    b.quad('roof', [hw * k, top, -hd * k], [-hw * k, top, -hd * k], [-hw * k, top, hd * k], [hw * k, top, hd * k]);
    b.box('roof', 0, top + 4, 0, 0.5, 8, 0.5);
    b.setColor(0xff2a1a);
    b.box('band', 0, top + 8.2, 0, 0.6, 0.5, 0.6);
    b.pop();
  } else {
    b.setColor(0x55585c);
    for (let i = rng.int(0, 3); i > 0; i--) {
      b.box('roof', rng.range(-hw + 1.5, hw - 1.5), h + 0.5, rng.range(-hd + 1.5, hd - 1.5), rng.range(1.2, 2.4), 1, rng.range(1, 2));
    }
    if (bd.kind === 'apartment') {
      b.setColor(0xcfcac0);
      for (let y = 3; y < h - 1; y += 3) b.box('roof', 0, y - 0.1, hd + 0.55, bd.w - 0.6, 0.18, 1.1);
    }
  }
  if (bd.sign >= 0) sign(b, rng, bd, hw, hd, h);
}

/**
 * A two-storey house with a pitched roof along its width.
 * @param {MeshBuilder} b @param {ReturnType<typeof makeRng>} rng @param {Building} bd @param {number} hw @param {number} hd
 */
function house(b, rng, bd, hw, hd) {
  const h = Math.max(3, bd.h - 2.2);
  b.setColor(rng.pick(HOUSE_TINTS));
  const u0 = rng.int(0, 7) / 8;
  const v0 = rng.int(0, 7) / 8;
  walls(b, 'wall', hw, hd, h, (len, hh) => [u0, v0, u0 + len / FACADE, v0 + hh / FACADE]);
  const ridge = h + Math.min(hd, 4) * 0.6;
  const o = 0.5;
  b.setColor(rng.pick(ROOF_TINTS));
  b.quad('roof', [-hw - o, h - 0.2, hd + o], [hw + o, h - 0.2, hd + o], [hw + o, ridge, 0], [-hw - o, ridge, 0]);
  b.quad('roof', [hw + o, h - 0.2, -hd - o], [-hw - o, h - 0.2, -hd - o], [-hw - o, ridge, 0], [hw + o, ridge, 0]);
  b.setColor(rng.pick(HOUSE_TINTS));
  b.tri('roof', [hw, h, hd], [hw, h, -hd], [hw, ridge, 0]);
  b.tri('roof', [-hw, h, -hd], [-hw, h, hd], [-hw, ridge, 0]);
}

/**
 * Warehouses, sheds, garages and factories: corrugated walls, roller doors, a low roof.
 * @param {MeshBuilder} b @param {ReturnType<typeof makeRng>} rng @param {Building} bd @param {number} hw @param {number} hd
 */
function shed(b, rng, bd, hw, hd) {
  const h = bd.h;
  const tint = rng.pick(METAL_TINTS);
  b.setColor(tint);
  walls(b, 'metal', hw, hd, h, (len, hh) => [0, 0, len / 6, hh / 6]);
  const garage = bd.kind === 'garage';
  const doors = garage ? Math.max(2, Math.floor(bd.w / 6)) : bd.kind === 'warehouse' ? Math.max(1, Math.floor(bd.w / 18)) : 1;
  const dw = garage ? 3.6 : 5;
  const dh = garage ? 3.2 : 4.6;
  const span = bd.w / doors;
  for (let i = 0; i < doors; i++) {
    const cx = -hw + span * (i + 0.5);
    b.setColor(garage ? 0xd8dadc : 0xb4b8bc);
    b.quad('shutter', [cx - dw / 2, 0.05, hd + 0.05], [cx + dw / 2, 0.05, hd + 0.05], [cx + dw / 2, dh, hd + 0.05], [cx - dw / 2, dh, hd + 0.05], [0, 0, 1, 1]);
    if (garage) {
      b.setColor(0xfff2c8);
      b.box('band', cx, dh + 0.35, hd + 0.2, 0.9, 0.12, 0.25);
    }
  }
  b.setColor(0x5b6066);
  if (bd.roof === 'saw') {
    const n = Math.max(2, Math.round(bd.d / 7));
    const step = bd.d / n;
    for (let i = 0; i < n; i++) {
      const z0 = -hd + i * step;
      const z1 = z0 + step;
      b.setColor(0x5b6066);
      b.quad('roof', [-hw, h, z0], [hw, h, z0], [hw, h + 2.2, z1], [-hw, h + 2.2, z1]);
      b.setColor(0x2c3a48);
      b.quad('roof', [hw, h, z1], [-hw, h, z1], [-hw, h + 2.2, z1], [hw, h + 2.2, z1]);
    }
  } else {
    const ridge = h + Math.min(2.4, bd.d * 0.08);
    b.quad('roof', [-hw, h, hd], [hw, h, hd], [hw, ridge, 0], [-hw, ridge, 0]);
    b.quad('roof', [hw, h, -hd], [-hw, h, -hd], [-hw, ridge, 0], [hw, ridge, 0]);
    b.setColor(tint);
    b.tri('metal', [hw, h, hd], [hw, h, -hd], [hw, ridge, 0], [0, 0], [hd / 3, 0], [hd / 6, (ridge - h) / 6]);
    b.tri('metal', [-hw, h, -hd], [-hw, h, hd], [-hw, ridge, 0], [0, 0], [hd / 3, 0], [hd / 6, (ridge - h) / 6]);
  }
  if (bd.kind === 'factory') {
    b.setColor(0x8a8c8e);
    b.cylinder('roof', hw - 3, h + 7, -hd + 3, 0.9, 14, 8, 'y', { caps: false });
  }
}

/** @param {MeshBuilder} b @param {Building} bd @param {number} hw @param {number} hd */
function konbiniBox(b, bd, hw, hd) {
  const h = bd.h;
  b.setColor(0xf2f2ee);
  walls(b, 'wall', hw, hd, h, (len, hh) => [0, 0.5, len / FACADE, 0.5 + hh / FACADE]);
  b.setColor(0x4a4c50);
  b.quad('roof', [hw, h, -hd], [-hw, h, -hd], [-hw, h, hd], [hw, h, hd]);
  const z = hd + 0.02;
  b.setColor(0xffffff);
  b.quad('shop', [-hw * 0.86, 0.35, z], [hw * 0.86, 0.35, z], [hw * 0.86, 2.9, z], [-hw * 0.86, 2.9, z]);
  for (const [c, y0, y1] of [[0x1aa04a, 3.0, 3.3], [0xf4f4f4, 3.3, 3.55], [0x2a6ad8, 3.55, 3.85]]) {
    b.setColor(c);
    b.quad('band', [-hw, y0, z], [hw, y0, z], [hw, y1, z], [-hw, y1, z]);
  }
}

/**
 * A vertical neon sign on the street face.
 * @param {MeshBuilder} b @param {ReturnType<typeof makeRng>} rng @param {Building} bd
 * @param {number} hw @param {number} hd @param {number} h
 */
function sign(b, rng, bd, hw, hd, h) {
  const i = bd.sign % 8;
  const sx = (rng.chance(0.5) ? 1 : -1) * (hw - 1.2);
  const y0 = Math.min(3.2, h - 5);
  const y1 = y0 + 4.4;
  const z0 = hd + 0.15;
  const z1 = hd + 1.25;
  const r = [i / 8, 0, (i + 1) / 8, 1];
  b.setColor(0xffffff);
  b.quad('sign', [sx + 0.03, y0, z1], [sx + 0.03, y0, z0], [sx + 0.03, y1, z0], [sx + 0.03, y1, z1], r);
  b.quad('sign', [sx - 0.03, y0, z0], [sx - 0.03, y0, z1], [sx - 0.03, y1, z1], [sx - 0.03, y1, z0], r);
}
