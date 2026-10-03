/**
 * Bodies for the traffic, one geometry per kind. A kind with a `model` (the street racers,
 * and the player cars when they race) is the real lofted car baked by `vehicleGeometry`.
 * The rest are boxy stand-ins until their lofted bodies land: flat-shaded, a white `paint`
 * color the instance tint multiplies (`aPaint` marks it), dark glass and wheels, and a
 * `lamp` attribute for the head and tail lights.
 * Local axes: +Z forward, +X to the left, the origin on the ground at the center.
 */

import * as THREE from 'three';
import { BODIES, vehicleGeometry } from '../vehicles/models.js';
import { RACER_MODEL_BY_ID } from '../vehicles/bodies/racers.js';
import { carById } from '../vehicles/specs.js';

const PAINT = [1, 1, 1];
const GLASS = [0.1, 0.13, 0.18];
const DARK = [0.1, 0.1, 0.11];
const TIRE = [0.05, 0.05, 0.06];
const SILVER = [0.62, 0.64, 0.66];
const HEAD = [1, 0.9, 0.62];
const TAIL = [0.5, 0.02, 0.02];

class Parts {
  constructor() {
    this.pos = [];
    this.nor = [];
    this.col = [];
    this.lamp = [];
  }

  /** @param {number[]} a @param {number[]} b @param {number[]} c @param {number[]} color @param {number[]} [lamp] */
  tri(a, b, c, color, lamp = [0, 0, 0]) {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1;
    nx /= l; ny /= l; nz /= l;
    for (const p of [a, b, c]) {
      this.pos.push(p[0], p[1], p[2]);
      this.nor.push(nx, ny, nz);
      this.col.push(color[0], color[1], color[2]);
      this.lamp.push(lamp[0], lamp[1], lamp[2]);
    }
  }

  quad(a, b, c, d, color, lamp) {
    this.tri(a, b, c, color, lamp);
    this.tri(a, c, d, color, lamp);
  }

  /**
   * Box centered at (x, y, z). `c` is one color or { top, side, front, back }; `lamp` lights a face.
   * @param {number} x @param {number} y @param {number} z @param {number} w @param {number} h @param {number} d
   * @param {number[] | Record<string, number[]>} c @param {{ front?: number[], back?: number[] }} [lamp]
   */
  box(x, y, z, w, h, d, c, lamp = {}) {
    const col = Array.isArray(c) ? { top: c, side: c, front: c, back: c, bottom: c } : { bottom: DARK, ...c };
    const x0 = x - w / 2, x1 = x + w / 2, y0 = y - h / 2, y1 = y + h / 2, z0 = z - d / 2, z1 = z + d / 2;
    this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], col.front || col.side, lamp.front);
    this.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], col.back || col.side, lamp.back);
    this.quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], col.side);
    this.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], col.side);
    this.quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], col.top || col.side);
    this.quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], col.bottom);
  }

  /**
   * A box that narrows toward the top: the cabin of a car with raked glass.
   * @param {number} y0 @param {number} y1 @param {number} w @param {number} wTop
   * @param {number} zBack @param {number} zFront @param {number} backInset @param {number} frontInset
   * @param {{ side: number[], top: number[] }} c
   */
  cabin(y0, y1, w, wTop, zBack, zFront, backInset, frontInset, c) {
    const b = [[-w / 2, y0, zBack], [w / 2, y0, zBack], [w / 2, y0, zFront], [-w / 2, y0, zFront]];
    const t = [[-wTop / 2, y1, zBack + backInset], [wTop / 2, y1, zBack + backInset], [wTop / 2, y1, zFront - frontInset], [-wTop / 2, y1, zFront - frontInset]];
    // Left side is +X.
    this.quad(b[2], b[1], t[1], t[2], c.side);
    this.quad(b[0], b[3], t[3], t[0], c.side);
    this.quad(b[3], b[2], t[2], t[3], c.side);
    this.quad(b[1], b[0], t[0], t[1], c.side);
    this.quad(t[3], t[2], t[1], t[0], c.top);
  }

  /** A wheel: an eight-sided prism along X. */
  wheel(x, y, z, r, w) {
    const pts = [];
    for (let i = 0; i < 8; i++) pts.push([Math.cos((i / 8) * Math.PI * 2) * r, Math.sin((i / 8) * Math.PI * 2) * r]);
    for (let i = 0; i < 8; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % 8];
      this.quad([x - w / 2, y + a[0], z + a[1]], [x + w / 2, y + a[0], z + a[1]], [x + w / 2, y + b[0], z + b[1]], [x - w / 2, y + b[0], z + b[1]], TIRE);
    }
    this.quad([x + w / 2, y - r, z - r], [x + w / 2, y + r, z - r], [x + w / 2, y + r, z + r], [x + w / 2, y - r, z + r], DARK);
    this.quad([x - w / 2, y - r, z + r], [x - w / 2, y + r, z + r], [x - w / 2, y + r, z - r], [x - w / 2, y - r, z - r], DARK);
  }

  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setAttribute('lamp', new THREE.Float32BufferAttribute(this.lamp, 3));
    const paint = new Float32Array(this.col.length / 3);
    for (let i = 0; i < paint.length; i++) paint[i] = this.col[i * 3] === 1 && this.col[i * 3 + 1] === 1 && this.col[i * 3 + 2] === 1 ? 1 : 0;
    g.setAttribute('aPaint', new THREE.BufferAttribute(paint, 1));
    g.computeBoundingSphere();
    return g;
  }
}

/** Four wheels, or more for long vehicles: axle z positions. */
function wheels(p, axles, track, r, w) {
  for (const z of axles) {
    p.wheel(track, r, z, r, w);
    p.wheel(-track, r, z, r, w);
  }
}

/** Head and tail lights across the front and back faces. */
function lights(p, W, y, L, size = 0.28) {
  for (const s of [1, -1]) {
    p.box(s * (W / 2 - 0.3), y, L / 2 + 0.01, size * 1.3, size * 0.7, 0.06, DARK, { front: HEAD });
    p.box(s * (W / 2 - 0.3), y, -L / 2 - 0.01, size * 1.3, size * 0.7, 0.06, DARK, { back: TAIL });
  }
}

/**
 * The geometry for a traffic kind.
 * @param {import('./kinds.js').Kind} k
 */
export function buildKindGeometry(k) {
  if (k.model) {
    const racer = RACER_MODEL_BY_ID.get(k.model);
    if (racer) return vehicleGeometry(racer, racer.body, { wheelSides: 10 });
    const spec = carById(k.model);
    return vehicleGeometry(spec, BODIES[spec.id], { wheelSides: 10 });
  }
  const p = new Parts();
  const { length: L, width: W, height: H } = k;
  const r = k.id === 'bus' || k.id === 'semi' || k.id === 'truck' || k.id === 'tanker' ? 0.5 : 0.31;
  const wheelW = r * 0.7;
  const track = W / 2 - wheelW / 2 + 0.02;

  if (k.id.startsWith('rv-')) {
    // A racer: low and wide, a small cabin set back, a wing, big wheels.
    const belt = H * 0.5;
    const low = 0.2;
    p.box(0, (low + belt) / 2, 0, W, belt - low, L, PAINT);
    p.cabin(belt, H, W * 0.88, W * 0.7, -L * 0.28, L * 0.12, 0.7, 0.9, { side: GLASS, top: PAINT });
    p.box(0, belt + 0.02, L * 0.3, W * 0.5, 0.06, L * 0.2, PAINT);
    p.box(0, H + 0.12, -L / 2 + 0.25, W * 0.92, 0.07, 0.4, DARK);
    for (const s of [1, -1]) p.box(s * W * 0.38, H + 0.02, -L / 2 + 0.25, 0.06, 0.2, 0.3, DARK);
    p.box(0, 0.3, L / 2 - 0.04, W - 0.04, 0.22, 0.14, DARK);
    p.box(0, 0.3, -L / 2 + 0.04, W - 0.04, 0.22, 0.14, DARK);
    lights(p, W, belt - 0.1, L, 0.3);
    wheels(p, [L * 0.3, -L * 0.3], W / 2 - 0.12, 0.33, 0.27);
  } else if (['sedan', 'hatch', 'kei', 'wagon', 'taxi', 'suv', 'minivan'].includes(k.id)) {
    const belt = H * (k.id === 'suv' || k.id === 'minivan' ? 0.5 : 0.52);
    const low = 0.24;
    p.box(0, (low + belt) / 2, 0, W, belt - low, L, { top: PAINT, side: PAINT, front: PAINT, back: PAINT });
    const tall = k.id === 'kei' || k.id === 'minivan';
    const cabLen = L * (k.id === 'sedan' || k.id === 'taxi' ? 0.5 : tall ? 0.72 : 0.62);
    const zBack = k.id === 'hatch' || k.id === 'wagon' || tall || k.id === 'suv' ? -L / 2 + 0.2 : -L * 0.3;
    const rake = tall ? 0.12 : 0.42;
    p.cabin(belt, H, W * 0.94, W * 0.84, zBack, zBack + cabLen, tall || k.id === 'wagon' ? 0.1 : 0.55, rake, { side: GLASS, top: PAINT });
    if (k.id === 'taxi') p.box(0, H + 0.1, zBack + cabLen * 0.45, 0.7, 0.2, 0.3, DARK, { front: [1, 0.85, 0.3], back: [1, 0.85, 0.3] });
    p.box(0, 0.4, L / 2 - 0.05, W - 0.06, 0.28, 0.14, DARK);
    p.box(0, 0.4, -L / 2 + 0.05, W - 0.06, 0.28, 0.14, DARK);
    lights(p, W, belt - 0.14, L);
    wheels(p, [L * 0.3, -L * 0.3], track, r, wheelW);
  } else if (k.id === 'van') {
    p.box(0, 0.24 + (H * 0.5 - 0.24) / 2, 0, W, H * 0.5 - 0.24, L, PAINT);
    p.cabin(H * 0.5, H, W * 0.96, W * 0.92, -L / 2, L / 2 - 0.9, 0.05, 0.1, { side: PAINT, top: PAINT });
    p.box(0, H * 0.7, L / 2 - 0.45, W * 0.9, H * 0.32, 0.9, { top: GLASS, side: GLASS, front: GLASS, back: GLASS });
    lights(p, W, H * 0.4, L);
    wheels(p, [L * 0.3, -L * 0.3], track, r, wheelW);
  } else if (k.id === 'pickup') {
    p.box(0, 0.4 + 0.3, 0, W, 0.6, L, PAINT);
    p.cabin(0.9, H, W * 0.94, W * 0.84, -0.4, L / 2 - 0.9, 0.1, 0.35, { side: GLASS, top: PAINT });
    p.box(0, 0.9, -L / 2 + 1.0, W * 0.95, 0.1, 1.9, DARK);
    lights(p, W, 0.78, L);
    wheels(p, [L * 0.3, -L * 0.3], track, r, wheelW);
  } else if (k.id === 'keitruck') {
    p.box(0, 0.7, L / 2 - 0.9, W, 1.0, 1.4, { top: PAINT, side: PAINT, front: GLASS, back: PAINT });
    p.box(0, 0.62, -0.6, W, 0.12, L - 1.4, DARK);
    p.box(0, 0.95, -0.6, W - 0.1, 0.5, L - 1.5, { top: PAINT, side: PAINT });
    lights(p, W, 0.5, L, 0.2);
    wheels(p, [L * 0.3, -L * 0.3], track, r, wheelW);
  } else if (k.id === 'truck' || k.id === 'tanker' || k.id === 'semi') {
    const cab = k.id === 'semi' ? 2.4 : 2.3;
    const cargo = L - cab - 0.3;
    p.box(0, 1.3, L / 2 - cab / 2, W * 0.96, 2.0, cab, { top: PAINT, side: PAINT, front: GLASS, back: PAINT }, { front: undefined });
    p.box(0, 1.7, L / 2 - 0.1, W * 0.9, 0.9, 0.2, GLASS);
    p.box(0, 0.7, -0.15, W * 0.9, 0.3, L - 0.4, DARK);
    if (k.id === 'tanker') {
      const rr = W * 0.46;
      const sides = 10;
      const z0 = -L / 2;
      const z1 = z0 + cargo;
      for (let i = 0; i < sides; i++) {
        const a0 = (i / sides) * Math.PI * 2;
        const a1 = ((i + 1) / sides) * Math.PI * 2;
        const pt = (a, z) => [Math.cos(a) * rr, 1.55 + Math.sin(a) * rr, z];
        p.quad(pt(a0, z0), pt(a0, z1), pt(a1, z1), pt(a1, z0), PAINT);
      }
    } else {
      p.box(0, 0.8 + (H - 0.8) / 2, -L / 2 + cargo / 2, W, H - 0.8, cargo, { top: PAINT, side: PAINT, front: PAINT, back: PAINT });
    }
    lights(p, W, 0.9, L, 0.34);
    const axles = k.id === 'semi' ? [L / 2 - 1.3, -L / 2 + 1.4, -L / 2 + 2.7, -L / 2 + 4.0] : [L / 2 - 1.2, -L / 2 + 1.3, -L / 2 + 2.5];
    wheels(p, axles, track, r, wheelW);
  } else if (k.id === 'bus') {
    p.box(0, 0.55 + (H - 0.55) / 2, 0, W, H - 0.55, L, { top: PAINT, side: PAINT, front: GLASS, back: PAINT });
    p.box(0, 1.9, 0, W + 0.02, 0.9, L - 0.5, { top: GLASS, side: GLASS, front: GLASS, back: GLASS });
    p.box(0, H + 0.1, 0, W * 0.8, 0.2, L * 0.4, SILVER);
    lights(p, W, 0.9, L, 0.34);
    wheels(p, [L / 2 - 1.8, -L / 2 + 2.2], track, r, wheelW);
  }
  return p.geometry();
}
