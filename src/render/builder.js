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
