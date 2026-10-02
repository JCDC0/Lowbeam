/**
 * Arc-length sampled centripetal Catmull-Rom paths. Every road, the rally stage and
 * the pace notes are built on this. Pure: no three.js.
 */

/**
 * @typedef {{ s: number, d: number, x: number, z: number, i: number }} PathHit
 * `d` is the signed lateral offset, positive to the left of the direction of travel.
 */

function catmull(p0, p1, p2, p3, t) {
  // Barry and Goldman pyramid with centripetal knots (alpha 0.5): no cusps or loops.
  const k = (a, b) => Math.max(Math.pow(Math.hypot(b[0] - a[0], b[1] - a[1]), 0.5), 1e-4);
  const t0 = 0;
  const t1 = t0 + k(p0, p1);
  const t2 = t1 + k(p1, p2);
  const t3 = t2 + k(p2, p3);
  const u = t1 + (t2 - t1) * t;
  const mix = (a, b, ta, tb) => {
    const w = (u - ta) / (tb - ta);
    return [a[0] + (b[0] - a[0]) * w, a[1] + (b[1] - a[1]) * w];
  };
  const a1 = mix(p0, p1, t0, t1);
  const a2 = mix(p1, p2, t1, t2);
  const a3 = mix(p2, p3, t2, t3);
  const b1 = mix(a1, a2, t0, t2);
  const b2 = mix(a2, a3, t1, t3);
  return mix(b1, b2, t1, t2);
}

export class Path {
  /**
   * @param {number[][]} points control points as [x, z]
   * @param {{ closed?: boolean, step?: number }} [opts]
   */
  constructor(points, { closed = false, step = 2 } = {}) {
    this.closed = closed;
    const pts = points.map((p) => [p[0], p[1]]);
    const count = pts.length;
    const at = (i) => {
      if (closed) return pts[((i % count) + count) % count];
      if (i < 0) return [2 * pts[0][0] - pts[1][0], 2 * pts[0][1] - pts[1][1]];
      if (i >= count) {
        const a = pts[count - 1];
        const b = pts[count - 2];
        return [2 * a[0] - b[0], 2 * a[1] - b[1]];
      }
      return pts[i];
    };

    // Dense polyline first, then resample at uniform arc length.
    const dense = [];
    const segs = closed ? count : count - 1;
    for (let i = 0; i < segs; i++) {
      const p0 = at(i - 1);
      const p1 = at(i);
      const p2 = at(i + 1);
      const p3 = at(i + 2);
      const n = Math.max(8, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / 0.5));
      for (let j = 0; j < n; j++) dense.push(catmull(p0, p1, p2, p3, j / n));
    }
    dense.push(closed ? dense[0] : at(count - 1));

    const cum = [0];
    for (let i = 1; i < dense.length; i++) {
      cum.push(cum[i - 1] + Math.hypot(dense[i][0] - dense[i - 1][0], dense[i][1] - dense[i - 1][1]));
    }
    const length = cum[cum.length - 1];
    const n = closed ? Math.max(3, Math.round(length / step)) : Math.max(2, Math.round(length / step) + 1);
    this.length = length;
    this.step = closed ? length / n : length / (n - 1);
    this.n = n;
    this.x = new Float64Array(n);
    this.z = new Float64Array(n);
    this.tx = new Float64Array(n);
    this.tz = new Float64Array(n);

    let j = 0;
    for (let i = 0; i < n; i++) {
      const s = i * this.step;
      while (j < cum.length - 2 && cum[j + 1] < s) j++;
      const span = cum[j + 1] - cum[j] || 1;
      const f = Math.min(1, Math.max(0, (s - cum[j]) / span));
      this.x[i] = dense[j][0] + (dense[j + 1][0] - dense[j][0]) * f;
      this.z[i] = dense[j][1] + (dense[j + 1][1] - dense[j][1]) * f;
    }
    for (let i = 0; i < n; i++) {
      const a = this.wrapIndex(i - 1);
      const b = this.wrapIndex(i + 1);
      const dx = this.x[b] - this.x[a];
      const dz = this.z[b] - this.z[a];
      const l = Math.hypot(dx, dz) || 1;
      this.tx[i] = dx / l;
      this.tz[i] = dz / l;
    }
  }

  /** @param {number} i */
  wrapIndex(i) {
    if (this.closed) return ((i % this.n) + this.n) % this.n;
    return i < 0 ? 0 : i >= this.n ? this.n - 1 : i;
  }

  /** @param {number} s */
  wrapS(s) {
    if (this.closed) return ((s % this.length) + this.length) % this.length;
    return s < 0 ? 0 : s > this.length ? this.length : s;
  }

  /**
   * Position and unit tangent at arc length s.
   * @param {number} s
   * @param {{x:number,z:number,tx:number,tz:number}} [out]
   */
  sample(s, out = { x: 0, z: 0, tx: 0, tz: 1 }) {
    s = this.wrapS(s);
    const fi = s / this.step;
    const i = Math.min(Math.floor(fi), this.closed ? this.n - 1 : this.n - 2);
    const f = fi - i;
    const k = this.wrapIndex(i + 1);
    out.x = this.x[i] + (this.x[k] - this.x[i]) * f;
    out.z = this.z[i] + (this.z[k] - this.z[i]) * f;
    const tx = this.tx[i] + (this.tx[k] - this.tx[i]) * f;
    const tz = this.tz[i] + (this.tz[k] - this.tz[i]) * f;
    const l = Math.hypot(tx, tz) || 1;
    out.tx = tx / l;
    out.tz = tz / l;
    return out;
  }

  /**
   * Refines a hit around sample i by projecting onto the two neighboring segments.
   * @param {number} i @param {number} x @param {number} z @param {PathHit} out
   */
  refine(i, x, z, out) {
    let best = Infinity;
    for (let k = -1; k <= 0; k++) {
      let a = i + k;
      let b = a + 1;
      if (!this.closed && (a < 0 || b >= this.n)) continue;
      a = this.wrapIndex(a);
      b = this.wrapIndex(b);
      const ax = this.x[a];
      const az = this.z[a];
      const sx = this.x[b] - ax;
      const sz = this.z[b] - az;
      const l2 = sx * sx + sz * sz || 1;
      const t = Math.min(1, Math.max(0, ((x - ax) * sx + (z - az) * sz) / l2));
      const px = ax + sx * t;
      const pz = az + sz * t;
      const d2 = (x - px) * (x - px) + (z - pz) * (z - pz);
      if (d2 < best) {
        best = d2;
        const l = Math.sqrt(l2);
        const tx = sx / l;
        const tz = sz / l;
        out.s = this.wrapS((i + k + t) * this.step);
        out.x = px;
        out.z = pz;
        out.i = t < 0.5 ? a : b;
        // Left of travel is (tz, -tx): see the yaw convention in vehicles/physics.js.
        out.d = (x - px) * tz - (z - pz) * tx;
      }
    }
    return out;
  }

  /**
   * Nearest point by brute force over a sample index window.
   * @param {number} x @param {number} z
   * @param {PathHit} [out]
   * @param {number} [from] first sample index
   * @param {number} [to] last sample index (inclusive, may exceed n on closed paths)
   */
  nearest(x, z, out = { s: 0, d: 0, x: 0, z: 0, i: 0 }, from = 0, to = this.n - 1) {
    let bi = 0;
    let bd = Infinity;
    for (let j = from; j <= to; j++) {
      const i = this.wrapIndex(j);
      const dx = this.x[i] - x;
      const dz = this.z[i] - z;
      const d2 = dx * dx + dz * dz;
      if (d2 < bd) {
        bd = d2;
        bi = i;
      }
    }
    return this.refine(bi, x, z, out);
  }
}
