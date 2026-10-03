/**
 * The toll gates: watches the car cross the line of a plaza, reads its speed, charges the
 * toll and keeps the best speed through each gate. Pure, so it can be tested. The plazas
 * come from highway.js (`placeHighway`).
 */

/** @typedef {import('./highway.js').Plaza} Plaza */
/**
 * @typedef {{
 *   id: string, name: string, fee: number, speed: number, best: number, record: boolean,
 *   lane: number, cash: boolean, direction: 1 | -1
 * }} TollEvent
 */

/** Seconds before the same gate can charge again. */
const COOLDOWN = 8;

export class TollMeter {
  /**
   * @param {Plaza[]} plazas
   * @param {Record<string, number>} [best] best speed in km/h per plaza id
   */
  constructor(plazas, best = {}) {
    this.plazas = plazas;
    /** @type {Record<string, number>} */
    this.best = { ...best };
    /** @type {Map<string, number>} */
    this.last = new Map();
  }

  /**
   * Call once per frame with the car's previous and current position. Returns an event on
   * the frame the car crosses a plaza's line between the booths and the edge of the road.
   * @param {{ x: number, z: number }} prev @param {{ x: number, z: number }} cur
   * @param {number} speed km/h @param {number} now seconds
   * @returns {TollEvent | null}
   */
  step(prev, cur, speed, now) {
    for (const pl of this.plazas) {
      const fx = Math.sin(pl.yaw);
      const fz = Math.cos(pl.yaw);
      const v0 = (prev.x - pl.x) * fx + (prev.z - pl.z) * fz;
      const v1 = (cur.x - pl.x) * fx + (cur.z - pl.z) * fz;
      if (v0 === v1 || v0 * v1 > 0 || (v0 === 0 && v1 === 0)) continue;
      const f = v0 / (v0 - v1);
      const x = prev.x + (cur.x - prev.x) * f;
      const z = prev.z + (cur.z - prev.z) * f;
      const u = (x - pl.x) * fz - (z - pl.z) * fx;
      if (Math.abs(u) > pl.carriageway + pl.laneWidth * 1.7) continue;
      if (now - (this.last.get(pl.toll.id) ?? -1e9) < COOLDOWN) continue;
      this.last.set(pl.toll.id, now);
      let lane = 0;
      let nearest = Infinity;
      pl.lanes.forEach((l, i) => {
        const d = Math.abs(l.u - u);
        if (d < nearest) {
          nearest = d;
          lane = i;
        }
      });
      const previous = this.best[pl.toll.id] || 0;
      const record = speed > previous;
      if (record) this.best[pl.toll.id] = speed;
      return {
        id: pl.toll.id,
        name: pl.toll.name,
        fee: pl.toll.fee,
        speed,
        best: this.best[pl.toll.id],
        record,
        lane,
        cash: pl.lanes[lane].cash,
        direction: v1 > v0 ? 1 : -1,
      };
    }
    return null;
  }
}
