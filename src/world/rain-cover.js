/**
 * Where it does not rain: under a bridge or a viaduct deck, a gas station's canopy and a toll plaza's
 * canopy. `placeCovers` finds, for any point, the height of the roof over it; `CoverGrid` keeps that
 * for the 64 m round the camera in a grid the rain shader reads (`render/rain.js`), so a streak under
 * a roof is not drawn. Pure: no three.
 */

import { ELEVATED } from './roads.js';

/** The value of a cell with nothing over it. */
export const NONE = -1e4;

/** The grid: `cells` square, `cell` meters each, re-centered when the camera is `recenter` meters off its middle; slits up to `gap` cells wide between roofs are closed. */
export const COVER = { cells: 64, cell: 1, recenter: 9, snap: 8, gap: 3 };

/**
 * @typedef {{ x: number, z: number, ax: number, az: number, bx: number, bz: number, ha: number, hb: number, top: number }} Roof
 *   an oriented rectangle: center, the two unit axes and the half extents along them, and the height
 *   of its top
 */

/**
 * The roofs of the gas stations' canopies (the box `buildStations` draws) and the toll plazas'.
 * @param {{ pad: any, layout: any }[]} stations @param {{ x: number, y: number, z: number, yaw: number, carriageway: number, laneWidth: number }[]} plazas
 * @returns {Roof[]}
 */
export function placeRoofs(stations, plazas) {
  /** @type {Roof[]} */
  const roofs = [];
  for (const st of stations) {
    const { pad, layout } = st;
    const c = layout.canopy;
    const Xx = pad.vz;
    const Xz = -pad.vx;
    const su = Math.sign(pad.ux * Xx + pad.uz * Xz) || 1;
    const cu0 = Math.min(c.u0 * su, c.u1 * su);
    const cu1 = Math.max(c.u0 * su, c.u1 * su);
    const lx = (cu0 + cu1) / 2;
    const lz = (c.v0 + c.v1) / 2;
    const deep = layout.tents.length ? 0.9 : 1.4;
    roofs.push({
      x: pad.cx + Xx * lx + pad.vx * lz, z: pad.cz + Xz * lx + pad.vz * lz,
      ax: Xx, az: Xz, bx: pad.vx, bz: pad.vz, ha: (cu1 - cu0) / 2, hb: (c.v1 - c.v0) / 2, top: pad.h + c.h + deep,
    });
  }
  for (const pl of plazas) {
    const span = pl.carriageway * 2 + pl.laneWidth * 3 + 3;
    roofs.push({
      x: pl.x, z: pl.z, ax: Math.cos(pl.yaw), az: -Math.sin(pl.yaw), bx: Math.sin(pl.yaw), bz: Math.cos(pl.yaw),
      ha: span / 2, hb: 6.5, top: pl.y + 6.6,
    });
  }
  return roofs;
}

/**
 * The height of the roof over a point: a deck above it (a road lifted more than `ELEVATED`, found
 * with the asker held high so decks count) or a canopy, whichever is higher; `NONE` if the sky is open.
 * @param {import('./ground.js').Ground} ground @param {Roof[]} roofs
 */
export function coverAt(ground, roofs) {
  const hit = { road: null, s: 0, d: 0, h: 0, edge: 0, lift: 0 };
  return (/** @type {number} */ x, /** @type {number} */ z) => {
    let top = NONE;
    for (const r of roofs) {
      const dx = x - r.x;
      const dz = z - r.z;
      if (Math.abs(dx * r.ax + dz * r.az) <= r.ha && Math.abs(dx * r.bx + dz * r.bz) <= r.hb && r.top > top) top = r.top;
    }
    if (ground.roads.query(x, z, hit, 0, -Infinity, Infinity) && hit.lift > ELEVATED && hit.edge <= 0 && hit.h > top) top = hit.h;
    return top;
  };
}

/** The cover over the cells round the camera. */
export class CoverGrid {
  /** @param {(x: number, z: number) => number} cover */
  constructor(cover) {
    this.cover = cover;
    this.cells = COVER.cells;
    this.data = new Float32Array(COVER.cells * COVER.cells).fill(NONE);
    this.x0 = NaN;
    this.z0 = NaN;
    this.size = COVER.cells * COVER.cell;
  }

  /**
   * Re-centers on (x, z) when it has drifted from the middle, refilling the cells.
   * @param {number} x @param {number} z @returns {boolean} whether the cells changed
   */
  follow(x, z) {
    const mx = this.x0 + this.size / 2;
    const mz = this.z0 + this.size / 2;
    if (Math.abs(x - mx) <= COVER.recenter && Math.abs(z - mz) <= COVER.recenter) return false;
    this.x0 = Math.round(x / COVER.snap) * COVER.snap - this.size / 2;
    this.z0 = Math.round(z / COVER.snap) * COVER.snap - this.size / 2;
    const n = this.cells;
    for (let j = 0; j < n; j++) {
      const z = this.z0 + (j + 0.5) * COVER.cell;
      for (let i = 0; i < n; i++) this.data[j * n + i] = this.cover(this.x0 + (i + 0.5) * COVER.cell, z);
    }
    this.close();
    return true;
  }

  /**
   * Closes the slits between two roofs, which would let a stripe of rain through: an uncovered cell
   * with a roof within `COVER.gap` cells on both sides, along either axis, takes the lower of the two.
   * The two carriageways of the Kurogane Line, for one, stand a median apart.
   */
  close() {
    const n = this.cells;
    const src = this.data.slice();
    const reach = COVER.gap;
    const nearest = (/** @type {number} */ i, /** @type {number} */ j, /** @type {number} */ di, /** @type {number} */ dj) => {
      for (let k = 1; k <= reach; k++) {
        const x = i + di * k;
        const y = j + dj * k;
        if (x < 0 || y < 0 || x >= n || y >= n) return NONE;
        const v = src[y * n + x];
        if (v > NONE / 2) return v;
      }
      return NONE;
    };
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        if (src[j * n + i] > NONE / 2) continue;
        const a = nearest(i, j, -1, 0);
        const b = nearest(i, j, 1, 0);
        const c = nearest(i, j, 0, -1);
        const d = nearest(i, j, 0, 1);
        let top = NONE;
        if (a > NONE / 2 && b > NONE / 2) top = Math.min(a, b);
        if (c > NONE / 2 && d > NONE / 2) top = Math.max(top, Math.min(c, d));
        this.data[j * n + i] = top;
      }
    }
  }

  /** The cover at a point from the cells, as the shader reads it. @param {number} x @param {number} z */
  at(x, z) {
    const i = Math.floor((x - this.x0) / COVER.cell);
    const j = Math.floor((z - this.z0) / COVER.cell);
    if (i < 0 || j < 0 || i >= this.cells || j >= this.cells) return NONE;
    return this.data[j * this.cells + i];
  }
}
