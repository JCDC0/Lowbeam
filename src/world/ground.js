/**
 * The ground the car drives on: carved heightfield + roads + flat pads (gas station
 * forecourts, the service park). One function, `ground(x, z)`, answers height and
 * surface for physics, props and the camera. Pure, no three.js.
 */

import { Heightfield, baseHeight } from './heightfield.js';
import { RoadNetwork, SINK } from './roads.js';
import { ROADS, STATIONS, WATER_LEVEL } from './layout.js';
import { lerp, smoothstep } from '../core/mathx.js';

/** Terrain within this distance of a road edge is flattened to the road. Must exceed CELL * sqrt(2). */
export const FLAT = 9.5;
/** Then it blends back to nature over this distance. */
export const BLEND = 26;

/** Terrain surface codes stored per heightfield vertex. */
export const TERRAIN = { grass: 0, dirt: 1, rock: 2, sand: 3 };
const TERRAIN_NAMES = ['grass', 'dirt', 'rock', 'sand'];

/**
 * @typedef {{
 *   id: string, name: string, cx: number, cz: number, ux: number, uz: number,
 *   vx: number, vz: number, hw: number, hd: number, h: number, surface: string,
 *   road: import('./roads.js').Road, s: number, station: any
 * }} Pad
 */

/**
 * A forecourt beside a road. `u` runs along the road, `v` points away from it.
 * @param {RoadNetwork} net @param {any} st @returns {Pad}
 */
export function makePad(net, st) {
  const road = net.byId.get(st.road);
  const hit = road.path.nearest(st.near[0], st.near[1]);
  const p = road.path.sample(hit.s);
  const sign = st.side === 'left' ? 1 : -1;
  const vx = p.tz * sign;
  const vz = -p.tx * sign;
  const hd = st.d / 2;
  const off = road.hw + 0.4 + hd;
  return {
    id: st.id,
    name: st.name,
    cx: p.x + vx * off,
    cz: p.z + vz * off,
    ux: p.tx,
    uz: p.tz,
    vx,
    vz,
    hw: st.w / 2,
    hd,
    h: road.heightAt(hit.s),
    surface: 'concrete',
    road,
    s: hit.s,
    station: st,
  };
}

/** Signed distance from (x, z) to the pad rectangle; negative inside. @param {Pad} pad */
export function padDistance(pad, x, z) {
  const dx = x - pad.cx;
  const dz = z - pad.cz;
  const a = Math.abs(dx * pad.ux + dz * pad.uz) - pad.hw;
  const b = Math.abs(dx * pad.vx + dz * pad.vz) - pad.hd;
  if (a <= 0 && b <= 0) return Math.max(a, b);
  return Math.hypot(Math.max(a, 0), Math.max(b, 0));
}

export class Ground {
  constructor() {
    this.roads = new RoadNetwork(ROADS);
    /** @type {Pad[]} */
    this.pads = STATIONS.map((st) => makePad(this.roads, st));
    this.hf = new Heightfield();
    this.surface = new Uint8Array(this.hf.n * this.hf.n);
    this.carve();
    this._hit = { road: null, s: 0, d: 0, h: 0, edge: 0 };
    /** Shared result object. Read it before the next call. */
    this.out = { h: 0, surface: 'grass', road: null, pad: null, s: 0, d: 0 };
  }

  carve() {
    const hf = this.hf;
    const n = hf.n;
    const inf = { road: null, s: 0, d: 0, h: 0, edge: 0 };
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const x = hf.vx(i);
        const z = hf.vz(j);
        let h = baseHeight(x, z);
        let w = 0;
        let target = h;
        let surf = TERRAIN.grass;
        if (this.roads.influence(x, z, FLAT + BLEND, inf)) {
          w = 1 - smoothstep(FLAT, FLAT + BLEND, inf.edge);
          target = inf.h - SINK;
          if (inf.road.surface === 'gravel' && inf.edge < FLAT + 3) surf = TERRAIN.dirt;
        }
        for (const pad of this.pads) {
          const e = padDistance(pad, x, z);
          const pw = 1 - smoothstep(FLAT, FLAT + BLEND, e);
          if (pw > w) {
            w = pw;
            target = pad.h - SINK;
            if (pad.station.servicePark && e < FLAT + 4) surf = TERRAIN.dirt;
          }
        }
        h = lerp(h, target, w);
        if (h < WATER_LEVEL + 0.6 && w < 0.5) surf = TERRAIN.sand;
        hf.h[j * n + i] = h;
        this.surface[j * n + i] = surf;
      }
    }
    // Steep, untouched ground reads as rock.
    for (let j = 1; j < n - 1; j++) {
      for (let i = 1; i < n - 1; i++) {
        const k = j * n + i;
        if (this.surface[k] !== TERRAIN.grass) continue;
        const gx = (hf.h[k + 1] - hf.h[k - 1]) / (2 * hf.cell);
        const gz = (hf.h[k + n] - hf.h[k - n]) / (2 * hf.cell);
        if (gx * gx + gz * gz > 0.75) this.surface[k] = TERRAIN.rock;
      }
    }
  }

  /** @param {number} x @param {number} z */
  terrainSurface(x, z) {
    const hf = this.hf;
    const i = Math.round((x + hf.half) / hf.cell);
    const j = Math.round((z + hf.half) / hf.cell);
    if (i < 0 || j < 0 || i >= hf.n || j >= hf.n) return 'rock';
    return TERRAIN_NAMES[this.surface[j * hf.n + i]];
  }

  /**
   * Height and surface under (x, z). Roads win, then pads, then terrain.
   * @param {number} x @param {number} z
   */
  at(x, z) {
    const o = this.out;
    o.road = null;
    o.pad = null;
    const onRoad = this.roads.query(x, z, this._hit);
    // A pad beats the sloped road skirt it overlaps, never the road surface itself.
    if (!onRoad || this._hit.edge > 0) {
      for (const pad of this.pads) {
        if (padDistance(pad, x, z) <= 0) {
          o.h = pad.h;
          o.surface = pad.surface;
          o.pad = pad;
          return o;
        }
      }
    }
    if (onRoad) {
      o.h = this._hit.h;
      o.surface = this._hit.road.surface;
      o.road = this._hit.road;
      o.s = this._hit.s;
      o.d = this._hit.d;
      return o;
    }
    o.h = this.hf.at(x, z);
    o.surface = o.h < WATER_LEVEL - 0.35 ? 'water' : this.terrainSurface(x, z);
    return o;
  }

  /** Bound `at` for code that wants a plain function. */
  get fn() {
    return (x, z) => this.at(x, z);
  }
}
