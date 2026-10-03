/**
 * What the player can hear around them: how much forest, town and lake there is near a
 * point. Pure, so it can be tested. The ambience mixer turns these into crickets, wind
 * in the trees, water lapping and the town hum.
 */

import { WORLD_HALF } from '../world/layout.js';
import { cityAmount, waterAmount } from '../world/zones.js';

const CELL = 40;
const N = Math.ceil((WORLD_HALF * 2) / CELL) + 1;
/** Trees in a 3 by 3 block of cells that count as a full forest. */
const FULL = 90;

/** @typedef {{ x: number, z: number, kind: number }} TreePoint */
/** @typedef {{ forest: number, town: number, water: number }} Around */

export class EnvMap {
  /** @param {TreePoint[]} trees @param {number} shrubKind species index that does not count as forest */
  constructor(trees, shrubKind = 7) {
    this.cells = new Uint16Array(N * N);
    for (const t of trees) {
      if (t.kind === shrubKind) continue;
      const i = Math.floor((t.x + WORLD_HALF) / CELL);
      const j = Math.floor((t.z + WORLD_HALF) / CELL);
      if (i >= 0 && j >= 0 && i < N && j < N) this.cells[j * N + i]++;
    }
    /** @type {Around} */
    this.out = { forest: 0, town: 0, water: 0 };
  }

  /**
   * Shared result object: read it before the next call.
   * @param {number} x @param {number} z
   * @returns {Around}
   */
  at(x, z) {
    const ci = Math.floor((x + WORLD_HALF) / CELL);
    const cj = Math.floor((z + WORLD_HALF) / CELL);
    let sum = 0;
    for (let j = cj - 1; j <= cj + 1; j++) {
      for (let i = ci - 1; i <= ci + 1; i++) {
        if (i >= 0 && j >= 0 && i < N && j < N) sum += this.cells[j * N + i];
      }
    }
    const o = this.out;
    o.forest = Math.min(1, sum / FULL);
    o.town = cityAmount(x, z);
    o.water = waterAmount(x, z);
    return o;
  }
}
