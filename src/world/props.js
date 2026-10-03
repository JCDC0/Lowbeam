/**
 * Street lamps and the town. Lamps and buildings are merged into one mesh each (a draw
 * call per material). Trees live in build-trees.js.
 */

import * as THREE from 'three';
import { MeshBuilder } from '../render/builder.js';
import { psxBasic, psxLambert } from '../render/psx.js';
import { bakeGeometry } from '../render/bake.js';
import { signAtlas, windowTextures } from '../render/textures.js';
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

/**
 * @param {Building[]} buildings
 * @param {import('../render/bake.js').LightGrid} grid
 */
export function buildTown(buildings, grid) {
  const b = new MeshBuilder();
  for (const bd of buildings) {
    const rng = makeRng(bd.seed);
    const konbini = bd.kind === 'konbini';
    const h = konbini ? bd.h : Math.max(2, Math.round(bd.h / 3)) * 3 + 0.4;
    const hw = bd.w / 2;
    const hd = bd.d / 2;
    b.push(bd.x, bd.y, bd.z, bd.yaw);
    b.setColor(konbini ? 0xf2f2ee : rng.pick(WALL_TINTS));
    const u0 = rng.int(0, 7) / 8;
    const v0 = konbini ? 0.5 : rng.int(0, 7) / 8;
    const uv = (len) => [u0, v0, u0 + len / FACADE, v0 + h / FACADE];
    b.quad('wall', [-hw, 0, hd], [hw, 0, hd], [hw, h, hd], [-hw, h, hd], uv(bd.w));
    b.quad('wall', [hw, 0, -hd], [-hw, 0, -hd], [-hw, h, -hd], [hw, h, -hd], uv(bd.w));
    b.quad('wall', [hw, 0, hd], [hw, 0, -hd], [hw, h, -hd], [hw, h, hd], uv(bd.d));
    b.quad('wall', [-hw, 0, -hd], [-hw, 0, hd], [-hw, h, hd], [-hw, h, -hd], uv(bd.d));
    b.setColor(0x4a4c50);
    b.quad('roof', [hw, h, -hd], [-hw, h, -hd], [-hw, h, hd], [hw, h, hd]);
    if (!konbini) {
      for (let i = rng.int(0, 3); i > 0; i--) {
        b.box('roof', rng.range(-hw + 1.5, hw - 1.5), h + 0.5, rng.range(-hd + 1.5, hd - 1.5), rng.range(1.2, 2.4), 1, rng.range(1, 2));
      }
    } else {
      const z = hd + 0.02;
      b.setColor(0xffffff);
      b.quad('shop', [-hw * 0.86, 0.35, z], [hw * 0.86, 0.35, z], [hw * 0.86, 2.9, z], [-hw * 0.86, 2.9, z]);
      [[0x1aa04a, 3.0, 3.3], [0xf4f4f4, 3.3, 3.55], [0x2a6ad8, 3.55, 3.85]].forEach(([c, y0, y1]) => {
        b.setColor(c);
        b.quad('band', [-hw, y0, z], [hw, y0, z], [hw, y1, z], [-hw, y1, z]);
      });
    }
    if (bd.sign >= 0 && !konbini) {
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
    b.pop();
  }
  const win = windowTextures();
  const mesh = b.mesh({
    wall: psxLambert({ map: win.map, emissiveMap: win.emissive, emissive: 0xffffff, vertexColors: true, baked: true }),
    roof: psxLambert({ vertexColors: true, baked: true }),
    shop: psxBasic({ color: 0xe8f4ff }),
    band: psxBasic({ vertexColors: true }),
    sign: psxBasic({ map: signAtlas(SIGN_COLORS) }),
  });
  bakeGeometry(mesh.geometry, grid);
  mesh.name = 'town';
  return mesh;
}
