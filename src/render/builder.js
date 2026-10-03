/**
 * Accumulates flat-shaded triangles into material groups and emits one BufferGeometry.
 * Cars, buildings, gas stations and props are all modeled through this, so a whole
 * category of static scenery ends up as one draw call per material.
 */

import * as THREE from 'three';

/** @typedef {[number, number, number]} V3 */

const _m = new THREE.Matrix4();
const _v = new THREE.Vector3();

export class MeshBuilder {
  constructor() {
    /** @type {Map<string, { pos: number[], col: number[], uv: number[] }>} */
    this.parts = new Map();
    /** Optional transform applied to every vertex added (set with `push`/`pop`). */
    this.matrix = new THREE.Matrix4();
    this.stack = [];
    this.color = new THREE.Color(1, 1, 1);
  }

  part(key) {
    let p = this.parts.get(key);
    if (!p) {
      p = { pos: [], col: [], uv: [] };
      this.parts.set(key, p);
    }
    return p;
  }

  /** Pushes a transform: translate, then rotate about Y. */
  push(x = 0, y = 0, z = 0, rotY = 0) {
    this.stack.push(this.matrix.clone());
    _m.makeRotationY(rotY).setPosition(x, y, z);
    this.matrix.multiply(_m);
    return this;
  }

  pushMatrix(m) {
    this.stack.push(this.matrix.clone());
    this.matrix.multiply(m);
    return this;
  }

  pop() {
    this.matrix.copy(this.stack.pop());
    return this;
  }

  /** @param {number | string | THREE.Color} c */
  setColor(c) {
    this.color.set(c);
    return this;
  }

  _vert(p, v, uv) {
    _v.set(v[0], v[1], v[2]).applyMatrix4(this.matrix);
    p.pos.push(_v.x, _v.y, _v.z);
    p.col.push(this.color.r, this.color.g, this.color.b);
    p.uv.push(uv ? uv[0] : 0, uv ? uv[1] : 0);
  }

  /** Counter-clockwise triangle (seen from the front). */
  tri(key, a, b, c, ua, ub, uc) {
    const p = this.part(key);
    this._vert(p, a, ua);
    this._vert(p, b, ub);
    this._vert(p, c, uc);
    return this;
  }

  /** Quad a-b-c-d, counter-clockwise from the front. Optional uv rect [u0, v0, u1, v1]. */
  quad(key, a, b, c, d, uv) {
    const u = uv || [0, 0, 1, 1];
    this.tri(key, a, b, c, [u[0], u[1]], [u[2], u[1]], [u[2], u[3]]);
    this.tri(key, a, c, d, [u[0], u[1]], [u[2], u[3]], [u[0], u[3]]);
    return this;
  }

  /**
   * Axis-aligned box centered at (x, y, z) in the current transform.
   * `faces` can skip faces: { top, bottom, sides } default true.
   * `uvScale` maps world meters to uv when given (for tiling textures).
   */
  box(key, x, y, z, sx, sy, sz, { bottom = false, top = true, uvScale = 0 } = {}) {
    const hx = sx / 2;
    const hy = sy / 2;
    const hz = sz / 2;
    const x0 = x - hx, x1 = x + hx, y0 = y - hy, y1 = y + hy, z0 = z - hz, z1 = z + hz;
    const uvs = (w, h) => (uvScale ? [0, 0, w * uvScale, h * uvScale] : undefined);
    this.quad(key, [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], uvs(sx, sy)); // +z
    this.quad(key, [x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], uvs(sx, sy)); // -z
    this.quad(key, [x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], uvs(sz, sy)); // +x
    this.quad(key, [x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], uvs(sz, sy)); // -x
    if (top) this.quad(key, [x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], uvs(sx, sz));
    if (bottom) this.quad(key, [x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], uvs(sx, sz));
    return this;
  }

  /**
   * Cylinder along an axis. axis 'y' stands it up, 'x' lays it sideways (wheels).
   * Center at (x, y, z), `sides` segments, optional caps.
   */
  cylinder(key, x, y, z, r, len, sides = 8, axis = 'y', { caps = true, capKey = key, r2 = r } = {}) {
    const pts = [];
    for (let i = 0; i < sides; i++) {
      const a = (i / sides) * Math.PI * 2;
      pts.push([Math.cos(a), Math.sin(a)]);
    }
    const P = (c, s, t, rad) => {
      const u = c * rad;
      const v = s * rad;
      if (axis === 'y') return [x + u, y + t, z + v];
      if (axis === 'x') return [x + t, y + v, z + u];
      return [x + u, y + v, z + t];
    };
    const h = len / 2;
    // The y and x mappings are odd permutations of (u, v, t); z is even, so it winds the other way.
    const flip = axis === 'z';
    for (let i = 0; i < sides; i++) {
      const a = flip ? pts[(i + 1) % sides] : pts[i];
      const b = flip ? pts[i] : pts[(i + 1) % sides];
      const u0 = i / sides;
      const u1 = (i + 1) / sides;
      this.quad(key, P(a[0], a[1], -h, r), P(a[0], a[1], h, r2), P(b[0], b[1], h, r2), P(b[0], b[1], -h, r), [u0, 0, u1, 1]);
      if (caps) {
        const cuv = (p) => [0.5 + p[0] * 0.5, 0.5 + p[1] * 0.5];
        this.tri(capKey, P(0, 0, h, 0), P(b[0], b[1], h, r2), P(a[0], a[1], h, r2), [0.5, 0.5], cuv(b), cuv(a));
        if (axis !== 'y') this.tri(capKey, P(0, 0, -h, 0), P(a[0], a[1], -h, r), P(b[0], b[1], -h, r), [0.5, 0.5], cuv(a), cuv(b));
      }
    }
    return this;
  }

  /** Cone or pyramid standing on y. */
  cone(key, x, y, z, r, height, sides = 6) {
    for (let i = 0; i < sides; i++) {
      const a0 = (i / sides) * Math.PI * 2;
      const a1 = ((i + 1) / sides) * Math.PI * 2;
      this.tri(key, [x + Math.cos(a1) * r, y, z + Math.sin(a1) * r], [x + Math.cos(a0) * r, y, z + Math.sin(a0) * r], [x, y + height, z]);
    }
    return this;
  }

  isEmpty() {
    for (const p of this.parts.values()) if (p.pos.length) return false;
    return true;
  }

  /**
   * One geometry with a group per part, in the order of `order` (keys not listed go last).
   * @param {string[]} [order]
   */
  geometry(order = []) {
    const keys = [...order.filter((k) => this.parts.has(k)), ...[...this.parts.keys()].filter((k) => !order.includes(k))];
    let count = 0;
    for (const k of keys) count += this.parts.get(k).pos.length / 3;
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const uv = new Float32Array(count * 2);
    const g = new THREE.BufferGeometry();
    let o = 0;
    keys.forEach((k, gi) => {
      const p = this.parts.get(k);
      const n = p.pos.length / 3;
      pos.set(p.pos, o * 3);
      col.set(p.col, o * 3);
      uv.set(p.uv, o * 2);
      g.addGroup(o, n, gi);
      o += n;
    });
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.computeVertexNormals();
    g.computeBoundingSphere();
    return { geometry: g, keys };
  }

  /**
   * Builds a mesh, picking each group's material from `materials` by part key.
   * @param {Record<string, THREE.Material>} materials
   * @param {string[]} [order]
   */
  mesh(materials, order = []) {
    const { geometry, keys } = this.geometry(order);
    const mats = keys.map((k) => {
      const m = materials[k];
      if (!m) throw new Error(`MeshBuilder: no material for part "${k}"`);
      return m;
    });
    return new THREE.Mesh(geometry, mats);
  }
}

/**
 * Replaces the flat normals of a builder geometry with averaged ones wherever faces meet at
 * less than `crease` degrees, so curved panels shade smoothly and real edges stay sharp.
 * Faces are weighted by area. Works on the non-indexed geometry MeshBuilder makes.
 * @param {THREE.BufferGeometry} geo @param {number} [crease]
 */
export function smoothNormals(geo, crease = 40) {
  const pos = geo.getAttribute('position');
  const n = pos.count;
  const p = pos.array;
  const face = new Float32Array(n);
  const fn = new Float32Array((n / 3) * 3);
  for (let f = 0; f < n / 3; f++) {
    const a = f * 9;
    const ux = p[a + 3] - p[a], uy = p[a + 4] - p[a + 1], uz = p[a + 5] - p[a + 2];
    const vx = p[a + 6] - p[a], vy = p[a + 7] - p[a + 1], vz = p[a + 8] - p[a + 2];
    fn[f * 3] = uy * vz - uz * vy;
    fn[f * 3 + 1] = uz * vx - ux * vz;
    fn[f * 3 + 2] = ux * vy - uy * vx;
  }
  const unit = (f) => {
    const x = fn[f * 3], y = fn[f * 3 + 1], z = fn[f * 3 + 2];
    const l = Math.hypot(x, y, z) || 1;
    return [x / l, y / l, z / l];
  };
  /** @type {Map<string, number[]>} */
  const buckets = new Map();
  for (let i = 0; i < n; i++) {
    face[i] = Math.floor(i / 3);
    const key = `${Math.round(p[i * 3] * 2000)},${Math.round(p[i * 3 + 1] * 2000)},${Math.round(p[i * 3 + 2] * 2000)}`;
    let list = buckets.get(key);
    if (!list) buckets.set(key, (list = []));
    list.push(i);
  }
  const cos = Math.cos((crease * Math.PI) / 180);
  const out = new Float32Array(n * 3);
  for (const list of buckets.values()) {
    const units = list.map((i) => unit(face[i]));
    for (let a = 0; a < list.length; a++) {
      let x = 0, y = 0, z = 0;
      for (let b = 0; b < list.length; b++) {
        if (units[a][0] * units[b][0] + units[a][1] * units[b][1] + units[a][2] * units[b][2] < cos) continue;
        const f = face[list[b]];
        x += fn[f * 3];
        y += fn[f * 3 + 1];
        z += fn[f * 3 + 2];
      }
      const l = Math.hypot(x, y, z) || 1;
      const i = list[a];
      out[i * 3] = x / l;
      out[i * 3 + 1] = y / l;
      out[i * 3 + 2] = z / l;
    }
  }
  geo.setAttribute('normal', new THREE.BufferAttribute(out, 3));
  return geo;
}

/**
 * A road wheel along X, outer face at +X: a rounded tread, a sidewall down to the rim, a
 * rim lip and a dished face that carries the rim texture. Parts 'tire' and 'rim'.
 * @param {MeshBuilder} b @param {number} r @param {number} width @param {number} [sides]
 */
export function buildWheel(b, r, width, sides = 16) {
  const h = width / 2;
  const rimR = r * 0.7;
  const shoulder = Math.min(0.03, width * 0.15);
  const ring = (x, rad) => {
    const pts = [];
    for (let i = 0; i < sides; i++) {
      const a = (i / sides) * Math.PI * 2;
      pts.push([x, Math.sin(a) * rad, Math.cos(a) * rad]);
    }
    return pts;
  };
  /** Joins two rings with outward-facing quads (outward when ring a is toward -X of b). */
  const band = (key, A, B, uvOf) => {
    for (let i = 0; i < sides; i++) {
      const j = (i + 1) % sides;
      if (uvOf) b.tri(key, A[i], B[i], B[j], uvOf(A[i]), uvOf(B[i]), uvOf(B[j])).tri(key, A[i], B[j], A[j], uvOf(A[i]), uvOf(B[j]), uvOf(A[j]));
      else b.quad(key, A[i], B[i], B[j], A[j]);
    }
  };
  const tex = (scale) => (p) => [0.5 + (p[2] / rimR) * scale, 0.5 + (p[1] / rimR) * scale];
  const inSide = ring(-h, r - shoulder);
  const inTread = ring(-h + shoulder, r);
  const outTread = ring(h - shoulder, r);
  const outSide = ring(h, r - shoulder);
  const lip = ring(h, rimR);
  const seat = ring(h - 0.025, rimR);
  const inner = ring(-h, rimR * 0.6);
  band('tire', inSide, inTread);
  band('tire', inTread, outTread);
  band('tire', outTread, outSide);
  band('tire', outSide, lip);
  band('rim', lip, seat, tex(0.36));
  const hub = [h - 0.06, 0, 0];
  for (let i = 0; i < sides; i++) {
    const j = (i + 1) % sides;
    b.tri('rim', hub, seat[j], seat[i], [0.5, 0.5], tex(0.36)(seat[j]), tex(0.36)(seat[i]));
  }
  band('tire', inner, inSide);
  const back = [-h, 0, 0];
  for (let i = 0; i < sides; i++) {
    const j = (i + 1) % sides;
    b.tri('tire', back, inner[i], inner[j]);
  }
  return b;
}
