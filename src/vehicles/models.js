/**
 * Car models. Each body is lofted from hand-placed cross sections, then parts go on
 * top: lamps, grille, mirrors, plates, exhausts, scoops, wings and stripes. Everything
 * is flat-shaded through MeshBuilder, so a body is one draw call per material.
 *
 * Car space: origin at the center of gravity on the ground, +Z forward, +X is the car's
 * LEFT, +Y up. The front axle sits at cgToFront, the rear at -(wheelbase - cgToFront).
 */

import * as THREE from 'three';
import { MeshBuilder, buildWheel, smoothNormals } from '../render/builder.js';
import { psxBasic, psxLambert, psxPhong } from '../render/psx.js';
import { glassTexture, plateTexture, rimTexture, shadowTexture } from '../render/textures.js';
import { bakeGeometry } from '../render/bake.js';
import { clamp, damp } from '../core/mathx.js';
import { BAND, RING_POINTS, archStation, insetRing, loftZs, ringOf, roofHeight, stationCurve } from './loft.js';

/** @typedef {import('./specs.js').CarSpec} CarSpec */
/** @typedef {[number, number, number]} V3 */

/**
 * A cross section: [z, y0, w0, y1, w1, y2, w2, y3, w3]. Height y and half width w of the
 * rocker bottom, the shoulder, the belt line and the roof edge.
 * @typedef {number[]} Station
 */

/**
 * @typedef {{
 *   stations: Station[],
 *   glass: { side: number[], front: number[], rear: number[] },
 *   flare: number, tireWidth: number,
 *   rim: 'rally' | 'muscle' | 'exotic', rimColor: number | 'accent',
 *   plate: string, widePlate?: boolean, driver: number,
 *   parts: (k: Kit) => void, axles?: number[], accent?: number[]
 * }} BodyDef
 * `axles` adds wheels at more z positions (trucks, buses); `accent` fixes the accent color of
 * a baked body (a cargo box) instead of near black.
 */

/** Offsets from each axle where extra stations are inserted to cut the wheel arch. */
const ARCH = [-0.46, -0.415, -0.38, -0.3, -0.2, -0.1, 0, 0.1, 0.2, 0.3, 0.38, 0.415, 0.46];
/** Widest gap between two rings along the body. */
const MAX_GAP = 0.26;
/** How far the nose and tail are rounded in. */
const BEVEL = 0.03;
const ORDER = ['paint', 'accent', 'glass', 'trim', 'under', 'chrome', 'lamp', 'tail', 'plate'];
const TAIL_DIM = new THREE.Color(0.32, 0.015, 0.01);
const TAIL_LIT = new THREE.Color(1, 0.08, 0.05);
/** Height of the point the body leans around. */
const LEAN_Y = 0.45;

/** @type {Record<string, BodyDef>} */
export const BODIES = {
  hayate: {
    stations: [
      [-2.43, 0.32, 0.78, 0.56, 0.82, 0.9, 0.8, 0.95, 0.72],
      [-2.36, 0.24, 0.83, 0.62, 0.855, 0.97, 0.84, 1.0, 0.77],
      [-1.78, 0.21, 0.85, 0.66, 0.865, 0.99, 0.85, 1.02, 0.79],
      [-1.22, 0.21, 0.85, 0.66, 0.865, 0.99, 0.85, 1.4, 0.67],
      [0.08, 0.21, 0.85, 0.66, 0.865, 0.98, 0.85, 1.42, 0.67],
      [0.86, 0.21, 0.85, 0.66, 0.865, 0.95, 0.84, 0.99, 0.78],
      [1.62, 0.23, 0.84, 0.64, 0.855, 0.86, 0.82, 0.89, 0.74],
      [1.86, 0.27, 0.8, 0.58, 0.83, 0.79, 0.79, 0.82, 0.68],
      [1.92, 0.31, 0.76, 0.52, 0.8, 0.74, 0.75, 0.76, 0.62],
    ],
    glass: { side: [-1.5, 0.86], front: [0.08, 0.86], rear: [-1.78, -1.22] },
    flare: 0.035,
    tireWidth: 0.21,
    rim: 'rally',
    rimColor: 'accent',
    plate: 'KG 46-02',
    driver: -1,
    parts(k) {
      k.face('lamp', 'front', 0.4, 0.7, 0.58, 0.7, true);
      k.face('trim', 'front', -0.36, 0.36, 0.58, 0.7);
      k.face('under', 'front', -0.5, 0.5, 0.35, 0.43);
      k.face('plate', 'front', -0.19, 0.19, 0.45, 0.55);
      k.face('tail', 'rear', 0.46, 0.78, 0.74, 0.86, true);
      k.face('trim', 'rear', -0.46, 0.46, 0.76, 0.84);
      k.face('plate', 'rear', -0.19, 0.19, 0.52, 0.62);
      const hood = k.topY(1.28);
      k.b.box('paint', 0, hood + 0.03, 1.28, 0.5, 0.08, 0.34);
      k.face('under', 1.45 + 0.002, -0.19, 0.19, hood + 0.01, hood + 0.06);
      const deck = k.topY(-2.18);
      k.mirror((s) => {
        k.b.box('paint', s * 0.58, deck + 0.08, -2.18, 0.05, 0.16, 0.12);
        k.b.box('paint', s * 0.76, deck + 0.17, -2.2, 0.02, 0.11, 0.3);
        k.b.box('paint', s * 0.92, 1.03, 0.78, 0.12, 0.08, 0.06);
        k.b.box('trim', s * 0.73, 0.18, k.rearAxle - 0.5, 0.22, 0.24, 0.02);
        k.b.box('trim', s * 0.73, 0.18, k.frontAxle - 0.5, 0.22, 0.24, 0.02);
      });
      k.b.box('paint', 0, deck + 0.18, -2.2, 1.5, 0.035, 0.26);
      k.b.cylinder('chrome', -0.5, 0.27, -2.4, 0.05, 0.22, 6, 'z', { capKey: 'under' });
    },
  },
  rampart: {
    stations: [
      [-2.72, 0.34, 0.86, 0.58, 0.9, 0.9, 0.88, 0.97, 0.8],
      [-2.64, 0.25, 0.91, 0.64, 0.94, 0.95, 0.92, 0.99, 0.84],
      [-1.98, 0.22, 0.92, 0.67, 0.95, 0.96, 0.93, 1.01, 0.84],
      [-1.06, 0.22, 0.92, 0.67, 0.95, 0.97, 0.93, 1.31, 0.66],
      [-0.12, 0.22, 0.92, 0.67, 0.95, 0.97, 0.93, 1.33, 0.66],
      [0.52, 0.22, 0.92, 0.67, 0.95, 0.96, 0.93, 1.0, 0.84],
      [2.0, 0.24, 0.91, 0.64, 0.94, 0.92, 0.91, 0.95, 0.82],
      [2.16, 0.28, 0.88, 0.6, 0.92, 0.88, 0.89, 0.91, 0.8],
      [2.23, 0.32, 0.85, 0.56, 0.89, 0.86, 0.86, 0.88, 0.78],
    ],
    glass: { side: [-1.06, 0.53], front: [-0.12, 0.52], rear: [-1.98, -1.06] },
    flare: 0.03,
    tireWidth: 0.25,
    rim: 'muscle',
    rimColor: 0xc8ccd2,
    plate: 'HMC 440',
    driver: 1,
    parts(k) {
      k.face('under', 'front', -0.8, 0.8, 0.54, 0.8);
      k.face('lamp', 'front', 0.56, 0.74, 0.59, 0.75, true, 0.012);
      k.face('lamp', 'front', 0.34, 0.5, 0.61, 0.73, true, 0.012);
      k.face('chrome', 'front', -0.08, 0.08, 0.62, 0.72, false, 0.012);
      k.b.box('chrome', 0, 0.42, 2.25, 1.76, 0.1, 0.08);
      k.face('plate', 2.29 + 0.002, -0.17, 0.17, 0.3, 0.46);
      k.face('tail', 'rear', 0.12, 0.84, 0.7, 0.84, true);
      k.face('trim', 'rear', -0.12, 0.12, 0.7, 0.84);
      k.b.box('chrome', 0, 0.42, -2.73, 1.76, 0.1, 0.08);
      k.face('plate', 'rear', -0.17, 0.17, 0.5, 0.66);
      const hood = k.topY(1.3);
      k.b.box('trim', 0, hood + 0.06, 1.3, 0.56, 0.13, 0.5);
      k.face('under', 1.55 + 0.002, -0.22, 0.22, hood + 0.03, hood + 0.11);
      k.stripes(0.08, 0.22, k.zMin + 0.03, 2.2);
      k.ducktail(-2.62, 0.82, 0.08);
      k.mirror((s) => {
        k.b.box('chrome', s * 0.99, 1.03, 0.46, 0.1, 0.07, 0.07);
        k.b.cylinder('chrome', s * 0.62, 0.28, -2.7, 0.055, 0.2, 6, 'z', { capKey: 'under' });
      });
    },
  },
  vespera: {
    stations: [
      [-1.91, 0.32, 0.9, 0.54, 0.95, 0.84, 0.93, 0.88, 0.84],
      [-1.82, 0.23, 0.95, 0.6, 0.99, 0.9, 0.97, 0.93, 0.86],
      [-1.11, 0.2, 0.97, 0.66, 1.0, 0.95, 0.98, 0.96, 0.84],
      [-0.78, 0.2, 0.96, 0.6, 0.99, 0.92, 0.97, 0.97, 0.8],
      [-0.42, 0.2, 0.96, 0.57, 0.98, 0.9, 0.96, 1.13, 0.6],
      [0.22, 0.2, 0.95, 0.56, 0.97, 0.87, 0.94, 1.14, 0.6],
      [1.18, 0.2, 0.94, 0.58, 0.96, 0.8, 0.92, 0.83, 0.78],
      [1.54, 0.2, 0.94, 0.72, 0.97, 0.8, 0.9, 0.74, 0.68],
      [2.12, 0.21, 0.92, 0.5, 0.95, 0.62, 0.9, 0.62, 0.76],
      [2.46, 0.22, 0.85, 0.36, 0.88, 0.45, 0.84, 0.46, 0.74],
      [2.54, 0.24, 0.8, 0.31, 0.82, 0.37, 0.78, 0.38, 0.68],
    ],
    glass: { side: [-0.42, 1.18], front: [0.22, 1.18], rear: [-0.78, -0.42] },
    flare: 0.04,
    tireWidth: 0.27,
    rim: 'exotic',
    rimColor: 0x9a9ea6,
    plate: 'VG 600',
    widePlate: true,
    driver: 1,
    parts(k) {
      k.top('lamp', 0.44, 0.74, 2.16, 2.42, true);
      k.face('under', 'front', -0.7, 0.7, 0.25, 0.36);
      k.face('plate', 'front', -0.2, 0.2, 0.255, 0.335, false, 0.012);
      k.side('under', -0.62, -0.2, 0.36, 0.62);
      k.side('accent', -0.6, 1.06, 0.21, 0.3);
      k.top('under', -0.55, 0.55, -1.62, -0.86);
      for (let z = -1.57; z < -0.88; z += 0.1) k.b.box('trim', 0, k.topY(z) + 0.02, z, 1.04, 0.03, 0.04);
      k.face('tail', 'rear', 0.7, 0.86, 0.66, 0.78, true);
      k.face('tail', 'rear', 0.5, 0.66, 0.66, 0.78, true);
      k.face('under', 'rear', -0.72, 0.72, 0.33, 0.46);
      k.face('plate', 'rear', -0.24, 0.24, 0.5, 0.6);
      const deck = k.topY(-1.7);
      k.mirror((s) => {
        k.b.box('accent', s * 0.62, deck + 0.07, -1.7, 0.04, 0.14, 0.1);
        k.b.box('accent', s * 1.03, 0.9, 1.08, 0.1, 0.06, 0.08);
        for (const x of [0.1, 0.26]) k.b.cylinder('chrome', s * x, 0.39, -1.9, 0.045, 0.16, 6, 'z', { capKey: 'under' });
      });
      k.b.box('accent', 0, deck + 0.15, -1.72, 1.6, 0.03, 0.24);
    },
  },
  tsurugi: {
    stations: [
      [-2.46, 0.34, 0.8, 0.58, 0.86, 0.88, 0.84, 0.92, 0.72],
      [-2.38, 0.26, 0.88, 0.62, 0.92, 0.92, 0.9, 0.95, 0.8],
      [-1.93, 0.24, 0.94, 0.64, 0.96, 0.93, 0.93, 0.97, 0.84],
      [-0.95, 0.24, 0.95, 0.64, 0.97, 0.92, 0.92, 1.24, 0.7],
      [-0.4, 0.24, 0.95, 0.64, 0.97, 0.91, 0.92, 1.3, 0.68],
      [0.2, 0.24, 0.95, 0.64, 0.97, 0.9, 0.92, 1.31, 0.68],
      [1.0, 0.24, 0.95, 0.62, 0.97, 0.86, 0.93, 0.89, 0.84],
      [1.8, 0.24, 0.95, 0.6, 0.96, 0.8, 0.92, 0.83, 0.82],
      [2.0, 0.27, 0.92, 0.54, 0.94, 0.72, 0.9, 0.75, 0.78],
      [2.1, 0.29, 0.88, 0.48, 0.9, 0.66, 0.86, 0.68, 0.72],
      [2.14, 0.31, 0.84, 0.44, 0.86, 0.62, 0.82, 0.63, 0.68],
    ],
    glass: { side: [-1.6, 1.0], front: [0.2, 1.0], rear: [-1.93, -0.95] },
    flare: 0.03,
    tireWidth: 0.26,
    rim: 'exotic',
    rimColor: 0x8e929a,
    plate: 'TG 31-77',
    driver: -1,
    parts(k) {
      k.face('lamp', 'front', 0.4, 0.8, 0.5, 0.58, true);
      k.face('trim', 'front', -0.34, 0.34, 0.46, 0.58);
      k.face('plate', 'front', -0.19, 0.19, 0.37, 0.45);
      k.face('under', 'front', -0.7, 0.7, 0.32, 0.36);
      k.face('tail', 'rear', -0.82, 0.82, 0.74, 0.82);
      k.face('plate', 'rear', -0.2, 0.2, 0.5, 0.6);
      k.face('under', 'rear', -0.7, 0.7, 0.35, 0.47);
      k.side('trim', -0.75, 0.78, 0.22, 0.31);
      const hood = k.topY(1.5);
      k.b.box('paint', 0, hood + 0.025, 1.5, 0.44, 0.05, 0.62);
      k.mirror((s) => {
        k.b.box('trim', s * 0.34, k.topY(1.62) + 0.012, 1.62, 0.2, 0.025, 0.34);
        k.b.box('paint', s * 1.0, 0.95, 0.92, 0.12, 0.08, 0.08);
        for (const x of [0.3, 0.54]) k.b.cylinder('chrome', s * x, 0.34, -2.44, 0.05, 0.2, 8, 'z', { capKey: 'under' });
      });
      k.ducktail(-2.2, 0.82, 0.06);
    },
  },
};

/** @param {Station[]} list @param {number} z @returns {Station} */
function interp(list, z) {
  if (z <= list[0][0]) return list[0].slice();
  for (let i = 1; i < list.length; i++) {
    if (z <= list[i][0]) {
      const a = list[i - 1];
      const b = list[i];
      const t = (z - a[0]) / (b[0] - a[0]);
      return a.map((v, j) => v + (b[j] - v) * t);
    }
  }
  return list[list.length - 1].slice();
}

const inRange = (z, r) => z >= r[0] && z <= r[1];

/**
 * The lofted body plus helpers for placing parts on its surface.
 */
export class Kit {
  /** @param {CarSpec} spec @param {BodyDef} def */
  constructor(spec, def) {
    this.spec = spec;
    this.def = def;
    this.b = new MeshBuilder();
    this.frontAxle = spec.cgToFront;
    this.rearAxle = spec.cgToFront - spec.wheelbase;
    const curve = stationCurve(def.stations);
    const axles = [this.rearAxle, this.frontAxle];
    /** @type {Station[]} */
    this.stations = loftZs(def.stations, axles, ARCH, MAX_GAP).map((z) => {
      let st = curve(z);
      for (const a of axles) if (Math.abs(z - a) < 0.55) st = archStation(st, z - a, spec.wheelRadius, def.flare);
      return st;
    });
    this.zMin = this.stations[0][0] - BEVEL;
    this.zMax = this.stations[this.stations.length - 1][0] + BEVEL;
  }

  /** The body section at z, from the final station list. @param {number} z */
  at(z) {
    return interp(this.stations, z);
  }

  /** Height of the roof band (hood, roof, deck) at z, on the center line. @param {number} z */
  topY(z) {
    return roofHeight(this.at(z), 0);
  }

  /** Height of the roof band at z and x, following the crown. @param {number} z @param {number} x */
  roofY(z, x) {
    return roofHeight(this.at(z), x);
  }

  /** Half width of the body side at height y and length z. @param {number} z @param {number} y */
  sideX(z, y) {
    const st = this.at(z);
    const pts = [[st[2], st[1]], [st[4], st[3]], [st[6], st[5]], [st[8], st[7]]];
    if (y <= pts[0][1]) return pts[0][0];
    for (let i = 1; i < 4; i++) {
      const [w0, y0] = pts[i - 1];
      const [w1, y1] = pts[i];
      if (y <= y1 && y1 > y0) return w0 + ((w1 - w0) * (y - y0)) / (y1 - y0);
    }
    return pts[3][0];
  }

  /** Runs fn for the left (+1) and right (-1) side. @param {(s: number) => void} fn */
  mirror(fn) {
    fn(1);
    fn(-1);
  }

  /** Lofts the shell, bevels and closes both ends. */
  loft() {
    const b = this.b;
    const g = this.def.glass;
    const rings = this.stations.map((st) => ({ z: st[0], st, pts: ringOf(st) }));
    rings.unshift({ z: this.zMin, st: rings[0].st, pts: insetRing(rings[0].pts, BEVEL) });
    const last = rings[rings.length - 1];
    rings.push({ z: this.zMax, st: last.st, pts: insetRing(last.pts, BEVEL) });
    const n = RING_POINTS;
    for (let i = 0; i < rings.length - 1; i++) {
      const A = rings[i];
      const B = rings[i + 1];
      const za = A.z;
      const zb = B.z;
      const zm = (za + zb) / 2;
      for (let k = 0; k < n; k++) {
        const k1 = (k + 1) % n;
        const band = A.pts[k].band;
        let key = band === BAND.UNDER ? 'under' : 'paint';
        /** @type {number[][] | undefined} */
        let uv;
        if (band === BAND.GREEN && inRange(zm, g.side)) {
          key = 'glass';
          const t = (z) => (z - g.side[0]) / (g.side[1] - g.side[0]);
          uv = [[t(za), A.pts[k].g], [t(zb), B.pts[k].g], [t(zb), B.pts[k1].g], [t(za), A.pts[k1].g]];
        } else if (band === BAND.ROOF && (inRange(zm, g.front) || inRange(zm, g.rear))) {
          key = 'glass';
          const r = inRange(zm, g.front) ? g.front : g.rear;
          const t = (z) => (z - r[0]) / (r[1] - r[0]);
          const v = (R, p) => (R.st[8] > 0 ? (p.x + R.st[8]) / (2 * R.st[8]) : 0.5);
          uv = [[t(za), v(A, A.pts[k])], [t(zb), v(B, B.pts[k])], [t(zb), v(B, B.pts[k1])], [t(za), v(A, A.pts[k1])]];
        }
        const P = (R, p) => /** @type {V3} */ ([R.pts[p].x, R.pts[p].y, R.z]);
        this.quadUV(key, P(A, k), P(B, k), P(B, k1), P(A, k1), uv);
      }
    }
    const cap = (pts, z, front) => {
      const cx = pts.reduce((sum, p) => sum + p.x, 0) / n;
      const cy = pts.reduce((sum, p) => sum + p.y, 0) / n;
      const c = /** @type {V3} */ ([cx, cy, z]);
      for (let k = 0; k < n; k++) {
        const p = pts[k];
        const q = pts[(k + 1) % n];
        const P = /** @type {V3} */ ([p.x, p.y, z]);
        const Q = /** @type {V3} */ ([q.x, q.y, z]);
        if (front) b.tri('paint', c, Q, P);
        else b.tri('paint', c, P, Q);
      }
    };
    cap(rings[rings.length - 1].pts, this.zMax, true);
    cap(rings[0].pts, this.zMin, false);
    this.wheelWells();
  }

  /** A quad with one uv per corner, skipped when it has no area. */
  quadUV(key, a, b, c, d, uv) {
    if (!uv) return this.quad(key, a, b, c, d);
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    if (Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx) < 1e-6) return;
    this.b.tri(key, a, b, c, uv[0], uv[1], uv[2]);
    this.b.tri(key, a, c, d, uv[0], uv[2], uv[3]);
  }

  /** Dark liners inside each arch, so you cannot see through the car past the wheel. */
  wheelWells() {
    const tw = this.def.tireWidth;
    const x = this.spec.track / 2 - tw / 2 - 0.03;
    for (const axle of [this.rearAxle, this.frontAxle]) {
      const top = this.at(axle)[1] + 0.02;
      this.mirror((s) => {
        const xs = s * x;
        const z0 = axle - 0.46;
        const z1 = axle + 0.46;
        if (s > 0) this.quad('under', [xs, 0.05, z1], [xs, 0.05, z0], [xs, top, z0], [xs, top, z1]);
        else this.quad('under', [xs, 0.05, z0], [xs, 0.05, z1], [xs, top, z1], [xs, top, z0]);
      });
    }
  }

  /** Quad that skips itself when it has no area. */
  quad(key, a, b, c, d, uv) {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    const wx = d[0] - a[0], wy = d[1] - a[1], wz = d[2] - a[2];
    const area = Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx) + Math.hypot(vy * wz - vz * wy, vz * wx - vx * wz, vx * wy - vy * wx);
    if (area < 1e-6) return;
    this.b.quad(key, a, b, c, d, uv);
  }

  /**
   * A flat rectangle on an end face. `where` is 'front', 'rear', or an explicit z for a
   * face that points forward. x0 < x1. `both` adds the mirror image.
   * @param {string} key @param {'front' | 'rear' | number} where
   * @param {number} x0 @param {number} x1 @param {number} y0 @param {number} y1
   */
  face(key, where, x0, x1, y0, y1, both = false, lift = 0.006) {
    const rear = where === 'rear';
    const z = where === 'front' ? this.zMax + lift : rear ? this.zMin - lift : /** @type {number} */ (where);
    const put = (a, c) => {
      if (rear) this.b.quad(key, [c, y0, z], [a, y0, z], [a, y1, z], [c, y1, z]);
      else this.b.quad(key, [a, y0, z], [c, y0, z], [c, y1, z], [a, y1, z]);
    };
    put(x0, x1);
    if (both) put(-x1, -x0);
  }

  /**
   * A strip lying on the roof band (hood, roof or deck) between z0 and z1, split at every
   * station so it follows the surface. x0 < x1.
   */
  top(key, x0, x1, z0, z1, both = false, lift = 0.008, skipGlass = false) {
    const zs = [z0, ...this.stations.map((s) => s[0]).filter((z) => z > z0 && z < z1), z1];
    const g = this.def.glass;
    const put = (a, c) => {
      for (let i = 0; i < zs.length - 1; i++) {
        const za = zs[i];
        const zb = zs[i + 1];
        const zm = (za + zb) / 2;
        if (skipGlass && (inRange(zm, g.front) || inRange(zm, g.rear))) continue;
        const h = (z, x) => this.roofY(z, x) + lift;
        this.b.quad(key, [c, h(za, c), za], [a, h(za, a), za], [a, h(zb, a), zb], [c, h(zb, c), zb]);
      }
    };
    put(x0, x1);
    if (both) put(-x1, -x0);
  }

  /**
   * An upturned lip at the back of the deck: from z0 on the deck to just past the rear
   * face, rising by `rise`. Half width w.
   */
  ducktail(z0, w, rise) {
    const b = this.b;
    const zr = this.zMin - 0.03;
    const t = this.topY(z0);
    const e = this.topY(this.zMin);
    const lip = e + rise;
    /** @type {V3[]} */
    const top = [[w, lip, zr], [-w, lip, zr], [-w, t, z0], [w, t, z0]];
    b.quad('paint', ...top);
    b.quad('paint', [w, e - 0.01, zr + 0.02], [-w, e - 0.01, zr + 0.02], [-w, lip, zr], [w, lip, zr]);
    b.tri('paint', [w, t, z0], [w, e - 0.01, zr + 0.02], [w, lip, zr]);
    b.tri('paint', [-w, t, z0], [-w, lip, zr], [-w, e - 0.01, zr + 0.02]);
  }

  /** Two accent stripes over the top of the car. */
  stripes(x0, x1, z0, z1) {
    this.top('accent', x0, x1, z0, z1, true, 0.006, true);
  }

  /** A rectangle on both body sides, following the side surface. */
  side(key, z0, z1, y0, y1, lift = 0.016) {
    const zs = [z0, ...this.stations.map((s) => s[0]).filter((z) => z > z0 && z < z1), z1];
    for (let i = 0; i < zs.length - 1; i++) {
      const za = zs[i];
      const zb = zs[i + 1];
      const xa0 = this.sideX(za, y0) + lift, xa1 = this.sideX(za, y1) + lift;
      const xb0 = this.sideX(zb, y0) + lift, xb1 = this.sideX(zb, y1) + lift;
      this.b.quad(key, [xb0, y0, zb], [xa0, y0, za], [xa1, y1, za], [xb1, y1, zb]);
      this.b.quad(key, [-xa0, y0, za], [-xb0, y0, zb], [-xb1, y1, zb], [-xa1, y1, za]);
    }
  }
}

/**
 * @param {CarSpec} spec @param {{ color: number, accent: number }} paint @param {BodyDef} def
 * @param {'local' | 'baked'} light
 */
function makeMaterials(spec, paint, def, light) {
  const o = light === 'baked' ? { baked: true } : { local: true };
  const dbl = { side: THREE.DoubleSide };
  return {
    paint: psxPhong({ color: paint.color, specular: 0x3a3a3a, shininess: 36, ...dbl, ...o }),
    accent: psxPhong({ color: paint.accent, specular: 0x2a2a2a, shininess: 30, ...dbl, ...o }),
    glass: psxPhong({ map: glassTexture(), specular: 0x383838, shininess: 60, ...o }),
    trim: psxLambert({ color: 0x1e1f22, ...dbl, ...o }),
    under: psxLambert({ color: 0x060606, ...dbl, ...o }),
    chrome: psxPhong({ color: 0xb4b8be, specular: 0xffffff, shininess: 90, ...dbl, ...o }),
    lamp: psxBasic({ color: 0xfff1d0 }),
    tail: psxBasic({ color: TAIL_DIM.clone() }),
    plate: psxLambert({ map: plateTexture(def.plate, def.widePlate), ...o }),
    tire: psxLambert({ color: 0x151515, ...o }),
    rim: psxPhong({ map: rimTexture(def.rim), color: def.rimColor === 'accent' ? paint.accent : def.rimColor, specular: 0x777777, shininess: 60, ...o }),
  };
}

/**
 * One car: lofted body, four wheels, a blob shadow. `group` takes the physics pose,
 * `lean` adds body roll and pitch on top of it.
 */
export class CarModel {
  /**
   * `light` picks how world lamps reach the car: 'local' (the default) follows the
   * player's sampled light each frame; 'baked' is for parked cars, see `bake`.
   * @param {CarSpec} spec @param {number} [paintIndex] @param {{ light?: 'local' | 'baked' }} [opts]
   */
  constructor(spec, paintIndex = 0, { light = 'local' } = {}) {
    this.spec = spec;
    this.def = BODIES[spec.id];
    this.paintIndex = paintIndex;
    this.mats = makeMaterials(spec, spec.paints[paintIndex], this.def, light);

    this.group = new THREE.Group();
    this.group.rotation.order = 'YXZ';
    this.lean = new THREE.Group();
    this.lean.rotation.order = 'YXZ';
    this.lean.position.y = LEAN_Y;
    this.group.add(this.lean);
    const bodyRoot = new THREE.Group();
    bodyRoot.position.y = -LEAN_Y;
    this.lean.add(bodyRoot);
    this.bodyRoot = bodyRoot;

    this.kit = new Kit(spec, this.def);
    this.kit.loft();
    this.def.parts(this.kit);
    this.body = this.kit.b.mesh(this.mats, ORDER);
    smoothNormals(this.body.geometry, 38);
    bodyRoot.add(this.body);

    const wb = new MeshBuilder();
    buildWheel(wb, spec.wheelRadius, this.def.tireWidth);
    const wheelGeo = smoothNormals(wb.geometry(['tire', 'rim']).geometry, 30);
    this.wheelGeo = wheelGeo;
    /** @type {{ pivot: THREE.Group, spin: THREE.Group, front: boolean }[]} */
    this.wheels = [];
    for (const front of [true, false]) {
      for (const s of [1, -1]) {
        const pivot = new THREE.Group();
        pivot.position.set((s * spec.track) / 2, spec.wheelRadius, front ? this.kit.frontAxle : this.kit.rearAxle);
        const spin = new THREE.Group();
        const mesh = new THREE.Mesh(wheelGeo, [this.mats.tire, this.mats.rim]);
        if (s < 0) mesh.rotation.y = Math.PI;
        spin.add(mesh);
        pivot.add(spin);
        this.group.add(pivot);
        this.wheels.push({ pivot, spin, front });
      }
    }

    const shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(spec.width + 0.5, spec.length + 0.7),
      psxBasic({ map: shadowTexture(), transparent: true, depthWrite: false, color: 0xffffff })
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.03;
    shadow.renderOrder = -1;
    this.group.add(shadow);
    this.shadow = shadow;

    this.leanRoll = 0;
    this.leanPitch = 0;
    this.brake = 0;
  }

  /**
   * Bakes world lights into a parked car. Call after placing `group` in the world.
   * @param {import('../render/bake.js').LightGrid} grid
   */
  bake(grid) {
    this.group.updateMatrixWorld(true);
    bakeGeometry(this.body.geometry, grid, { matrix: this.body.matrixWorld, wrap: 0.5 });
    const wheel = /** @type {THREE.Mesh} */ (this.wheels[0].spin.children[0]);
    bakeGeometry(this.wheelGeo, grid, { matrix: wheel.matrixWorld, wrap: 0.5 });
  }

  /** @param {number} i */
  setPaint(i) {
    const p = this.spec.paints[i];
    this.paintIndex = i;
    this.mats.paint.color.set(p.color);
    this.mats.accent.color.set(p.accent);
    if (this.def.rimColor === 'accent') this.mats.rim.color.set(p.accent);
  }

  /** @param {number} level 0 to 1 */
  setBrake(level) {
    if (level === this.brake) return;
    this.brake = level;
    this.mats.tail.color.copy(TAIL_DIM).lerp(TAIL_LIT, level);
  }

  /**
   * Places the model from a physics state. `pos` overrides the position when the caller
   * interpolates between physics steps.
   * @param {ReturnType<typeof import('./physics.js').createVehicleState>} s
   * @param {number} dt
   * @param {{ x: number, y: number, z: number, yaw: number }} [pos]
   */
  pose(s, dt, pos) {
    const p = pos || s;
    this.group.position.set(p.x, p.y, p.z);
    this.group.rotation.set(-s.pitch, p.yaw, s.roll);
    this.leanRoll = damp(this.leanRoll, clamp(s.aLat * 0.011, -0.075, 0.075), 7, dt);
    this.leanPitch = damp(this.leanPitch, clamp(-s.aLong * 0.007, -0.05, 0.05), 7, dt);
    this.lean.rotation.set(this.leanPitch, 0, this.leanRoll);
    for (const w of this.wheels) {
      w.spin.rotation.x = s.wheelAngle;
      if (w.front) w.pivot.rotation.y = s.steer;
    }
    this.setBrake(s.braking ? 1 : 0);
  }

  dispose() {
    this.body.geometry.dispose();
    this.wheelGeo.dispose();
    this.shadow.geometry.dispose();
    for (const m of Object.values(this.mats)) m.dispose();
    /** @type {THREE.Material} */ (this.shadow.material).dispose();
  }
}

/** Fixed colors for the parts of a body baked into one geometry; paint is tinted per instance. */
const BAKED = {
  paint: { color: [1, 1, 1], paint: 1 },
  accent: { color: [0.07, 0.07, 0.08] },
  glass: { color: [0.035, 0.045, 0.065] },
  trim: { color: [0.1, 0.1, 0.11] },
  under: { color: [0.03, 0.03, 0.035] },
  chrome: { color: [0.68, 0.7, 0.73] },
  lamp: { color: [1, 0.95, 0.8], lamp: [0.9, 0.8, 0.55] },
  tail: { color: [0.5, 0.03, 0.02], lamp: [0.5, 0.02, 0.02] },
  plate: { color: [0.82, 0.82, 0.78] },
  tire: { color: [0.05, 0.05, 0.06] },
  rim: { color: [0.62, 0.64, 0.67] },
};

/**
 * A whole car (body and four wheels) baked into one vertex-colored geometry for instancing:
 * `color` per part, `aPaint` 1 where the instance color should tint (the paint), `lamp` for
 * head and tail lights. Used for traffic and street racers.
 * @param {{ cgToFront: number, wheelbase: number, wheelRadius: number, track: number }} spec
 * @param {BodyDef} def @param {{ wheelSides?: number, accent?: number[] }} [opts]
 */
export function vehicleGeometry(spec, def, { wheelSides = 12, accent } = {}) {
  const kit = new Kit(/** @type {CarSpec} */ (spec), def);
  kit.loft();
  def.parts(kit);
  const b = kit.b;
  for (const axle of [kit.frontAxle, kit.rearAxle, ...(def.axles || [])]) {
    for (const s of [1, -1]) {
      b.push((s * spec.track) / 2, spec.wheelRadius, axle, s < 0 ? Math.PI : 0);
      buildWheel(b, spec.wheelRadius, def.tireWidth, wheelSides);
      b.pop();
    }
  }
  const { geometry, keys } = b.geometry(ORDER);
  smoothNormals(geometry, 38);
  const n = geometry.getAttribute('position').count;
  const col = new Float32Array(n * 3);
  const paint = new Float32Array(n);
  const lamp = new Float32Array(n * 3);
  for (const g of geometry.groups) {
    const look = BAKED[keys[g.materialIndex ?? 0]] || BAKED.trim;
    const key = keys[g.materialIndex ?? 0];
    let c = key === 'accent' && (accent || def.accent) ? accent || def.accent : look.color;
    if (key === 'rim' && typeof def.rimColor === 'number') c = new THREE.Color(def.rimColor).toArray().map((v) => v * 0.85);
    for (let i = g.start; i < g.start + g.count; i++) {
      col.set(c, i * 3);
      paint[i] = look.paint ?? 0;
      if (look.lamp) lamp.set(look.lamp, i * 3);
    }
  }
  geometry.clearGroups();
  geometry.deleteAttribute('uv');
  geometry.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geometry.setAttribute('aPaint', new THREE.BufferAttribute(paint, 1));
  geometry.setAttribute('lamp', new THREE.BufferAttribute(lamp, 3));
  return geometry;
}

/** Steering wheel turns per radian of front wheel angle. */
export const STEER_RATIO = 4.5;

/**
 * The interior for the cockpit camera, in body space so it leans with the body: dash,
 * binnacle with the gauge face, steering wheel, A-pillars, roof header and liner, door
 * panels, mirror, console and the passenger seat. Interior quads are wound to face the
 * driver's eye. `gauge` is the plane the dash gauges are drawn on.
 * @param {CarModel} model
 */
export function buildCockpit(model) {
  const k = model.kit;
  const def = model.def;
  const cowlZ = def.glass.front[1];
  const roofZ = def.glass.front[0];
  const sc = k.at(cowlZ);
  const sr = k.at(roofZ);
  const beltY = sc[5];
  const halfIn = sc[6] - 0.07;
  const roofY = sr[7];
  const cowlY = sc[7];
  const floorY = sc[1] + 0.02;
  const dx = def.driver * Math.min(0.4, halfIn * 0.45);
  const eye = new THREE.Vector3(dx, roofY - 0.23, roofZ - 0.48);
  const dashBack = eye.z + 0.64;
  const b = new MeshBuilder();
  const E = [eye.x, eye.y, eye.z];
  /** Quad wound toward the eye. */
  const q = (key, a, c, d, e, uv) => {
    const ux = c[0] - a[0], uy = c[1] - a[1], uz = c[2] - a[2];
    const vx = d[0] - a[0], vy = d[1] - a[1], vz = d[2] - a[2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const toward = (E[0] - a[0]) * nx + (E[1] - a[1]) * ny + (E[2] - a[2]) * nz;
    if (toward >= 0) b.quad(key, a, c, d, e, uv);
    else b.quad(key, a, e, d, c, uv);
  };

  // Recessed binnacle hood over driver instrument cluster (4:3 aspect ratio, 30x22.5 cm)
  const gw = 0.15;
  const bTopY = beltY + 0.04;
  const gh1 = beltY + 0.035;
  const gh0 = beltY - 0.19;
  const gz0 = dashBack + 0.06;
  const gz1 = dashBack + 0.01;
  const bRearZ = dashBack - 0.04;
  const bFwdZ = dashBack + 0.14;

  const x0 = dx - gw;
  const x1 = dx + gw;

  // Dashboard top (with cutout for driver binnacle):
  // 1. From -halfIn to x0
  q('dash',
    [-halfIn, beltY, dashBack],
    [x0, beltY, dashBack],
    [x0, cowlY, cowlZ + 0.02],
    [-halfIn, cowlY, cowlZ + 0.02]
  );
  // 2. From x1 to +halfIn
  q('dash',
    [x1, beltY, dashBack],
    [halfIn, beltY, dashBack],
    [halfIn, cowlY, cowlZ + 0.02],
    [x1, cowlY, cowlZ + 0.02]
  );
  // 3. Between x0 and x1, forward of binnacle to the cowl
  q('dash',
    [x0, beltY, bFwdZ],
    [x1, beltY, bFwdZ],
    [x1, cowlY, cowlZ + 0.02],
    [x0, cowlY, cowlZ + 0.02]
  );

  // Binnacle hood: rises at most 4 cm above dash top
  q('dash',
    [x0, bTopY, bRearZ],
    [x1, bTopY, bRearZ],
    [x1, bTopY, bFwdZ],
    [x0, bTopY, bFwdZ]
  );
  // Binnacle hood front slope sealing down to dash top at bFwdZ
  q('dash',
    [x0, bTopY, bFwdZ],
    [x1, bTopY, bFwdZ],
    [x1, beltY, bFwdZ],
    [x0, beltY, bFwdZ]
  );
  // Binnacle side cheeks (sealing hood down to dash top and gauge face)
  q('dash',
    [x1, gh0, gz0],
    [x1, beltY, bFwdZ],
    [x1, bTopY, bFwdZ],
    [x1, bTopY, bRearZ]
  );
  q('dash',
    [x0, beltY, bFwdZ],
    [x0, gh0, gz0],
    [x0, bTopY, bRearZ],
    [x0, bTopY, bFwdZ]
  );

  // Dashboard vertical front face:
  // Non-driver sections
  q('dash',
    [x0, beltY - 0.38, dashBack],
    [-halfIn, beltY - 0.38, dashBack],
    [-halfIn, beltY, dashBack],
    [x0, beltY, dashBack]
  );
  q('dash',
    [halfIn, beltY - 0.38, dashBack],
    [x1, beltY - 0.38, dashBack],
    [x1, beltY, dashBack],
    [halfIn, beltY, dashBack]
  );
  // Under the gauge cluster: vertical face drops from gh0 down to beltY - 0.38
  q('dash',
    [x1, beltY - 0.38, dashBack],
    [x0, beltY - 0.38, dashBack],
    [x0, gh0, gz0],
    [x1, gh0, gz0]
  );

  // Dashboard firewall/bulkhead: drops to floor so light cannot leak from under
  q('floor',
    [halfIn, floorY, cowlZ + 0.02],
    [-halfIn, floorY, cowlZ + 0.02],
    [-halfIn, cowlY, cowlZ + 0.02],
    [halfIn, cowlY, cowlZ + 0.02]
  );
  // Cabin floor pan: from firewall back to behind seats
  q('floor',
    [-halfIn, floorY, cowlZ + 0.02],
    [halfIn, floorY, cowlZ + 0.02],
    [halfIn, floorY, eye.z - 0.95],
    [-halfIn, floorY, eye.z - 0.95]
  );

  // Center console
  b.box('dash', 0, beltY - 0.32, dashBack - 0.28, 0.28, 0.22, 0.65);

  // Gauge cluster face recessed inside the hooded binnacle (4:3 aspect, 30x22.5 cm).
  // Car local +X is car's LEFT.
  // vBL is driver's left (+X), vBR is driver's right (-X).
  // u=0 is driver's left, u=1 is driver's right.
  const vBL = [dx + gw, gh0, gz0];
  const vBR = [dx - gw, gh0, gz0];
  const vTR = [dx - gw, gh1, gz1];
  const vTL = [dx + gw, gh1, gz1];
  b.tri('gauge', vBL, vBR, vTR, [0, 0], [1, 0], [1, 1]);
  b.tri('gauge', vBL, vTR, vTL, [0, 0], [1, 1], [0, 1]);

  const w3c = sc[8];
  const y3c = sc[7];
  const w3r = sr[8];
  for (const s of [1, -1]) {
    // A-pillars
    q('pillar',
      [s * w3c, y3c, cowlZ],
      [s * (w3c - 0.11), y3c - 0.01, cowlZ - 0.04],
      [s * (w3r - 0.11), roofY - 0.03, roofZ - 0.04],
      [s * w3r, roofY, roofZ]
    );
    // Seal pillar base to cowl and beltline
    b.tri('pillar',
      [s * w3c, y3c, cowlZ],
      [s * halfIn, beltY, cowlZ - 0.06],
      [s * (w3c - 0.11), y3c - 0.01, cowlZ - 0.04]
    );
    // Door panels
    q('panel',
      [s * halfIn, floorY, cowlZ - 0.04],
      [s * halfIn, floorY, eye.z - 0.95],
      [s * halfIn, beltY, eye.z - 0.95],
      [s * halfIn, beltY, cowlZ - 0.04]
    );
    // Door sill / shoulder cap
    q('dash',
      [s * halfIn, beltY, cowlZ - 0.04],
      [s * halfIn, beltY, eye.z - 0.95],
      [s * (halfIn + 0.07), beltY + 0.01, eye.z - 0.95],
      [s * (halfIn + 0.07), beltY + 0.01, cowlZ - 0.04]
    );
  }
  // Windshield top header and roof liner
  q('pillar',
    [-w3r, roofY, roofZ],
    [w3r, roofY, roofZ],
    [w3r - 0.02, roofY - 0.09, roofZ - 0.03],
    [-w3r + 0.02, roofY - 0.09, roofZ - 0.03]
  );
  q('liner',
    [-w3r, roofY - 0.02, roofZ],
    [w3r, roofY - 0.02, roofZ],
    [w3r, roofY - 0.02, roofZ - 1.6],
    [-w3r, roofY - 0.02, roofZ - 1.6]
  );
  // Rearview mirror: compact and tucked high against roof header
  b.box('dash', 0, roofY - 0.04, roofZ + 0.04, 0.14, 0.035, 0.02);
  q('mirror',
    [-0.065, roofY - 0.055, roofZ + 0.025],
    [0.065, roofY - 0.055, roofZ + 0.025],
    [0.065, roofY - 0.025, roofZ + 0.025],
    [-0.065, roofY - 0.025, roofZ + 0.025]
  );
  // Passenger seat
  b.box('seat', -dx, floorY + 0.14, eye.z + 0.05, 0.48, 0.22, 0.48);
  b.box('seat', -dx, floorY + 0.52, eye.z - 0.22, 0.48, 0.65, 0.12);

  const o = { local: true };
  const dbl = { side: THREE.DoubleSide };
  const mats = {
    dash: psxLambert({ color: 0x222328, ...dbl, ...o }),
    pillar: psxLambert({ color: 0x2a2b30, ...dbl, ...o }),
    panel: psxLambert({ color: 0x302e2b, ...dbl, ...o }),
    liner: psxLambert({ color: 0x3e3c38, ...dbl, ...o }),
    floor: psxLambert({ color: 0x141518, ...dbl, ...o }),
    mirror: psxBasic({ color: 0x101622, ...dbl }),
    seat: psxLambert({ color: 0x24201e, ...dbl, ...o }),
    gauge: psxBasic({ color: 0x0a0b0d, ...dbl }),
  };
  const shell = b.mesh(mats);

  const wheel = new THREE.Group();
  wheel.position.set(dx, eye.y - 0.38, eye.z + 0.42);
  wheel.rotation.x = -0.38;
  const spin = new THREE.Group();
  wheel.add(spin);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.022, 4, 12), mats.dash);
  const wb = new MeshBuilder();
  wb.box('s', 0, -0.09, 0, 0.04, 0.18, 0.025);
  wb.box('s', -0.09, 0, 0, 0.18, 0.035, 0.025);
  wb.box('s', 0.09, 0, 0, 0.18, 0.035, 0.025);
  wb.box('s', 0, 0, -0.01, 0.09, 0.07, 0.04);
  const spokes = wb.mesh({ s: mats.dash });
  spin.add(rim, spokes);

  const group = new THREE.Group();
  group.name = 'cockpit';
  group.add(shell, wheel);
  group.visible = false;
  model.bodyRoot.add(group);
  return { group, wheel: spin, eye, gaugeMat: mats.gauge, dispose: () => [shell.geometry, rim.geometry, spokes.geometry, ...Object.values(mats)].forEach((x) => x.dispose()) };
}
