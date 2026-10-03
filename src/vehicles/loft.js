/**
 * Pure loft math for the car bodies: smooth interpolation between the authored cross
 * sections, wheel arches, the cross-section ring with its bands and the roof crown.
 * `models.js` turns the result into triangles; this file has no three.js so tests can
 * check the shapes.
 *
 * A station is [z, y0, w0, y1, w1, y2, w2, y3, w3]: rocker bottom, shoulder, belt line and
 * roof edge, each a height and a half width.
 */

/** Ring bands, used to pick materials. */
export const BAND = { UNDER: 0, LOWER: 1, UPPER: 2, GREEN: 3, ROOF: 4 };

/** Points in one ring. */
export const RING_POINTS = 19;

/**
 * Monotone cubic (Fritsch-Carlson) through (xs, ys). Smooth, and it never overshoots the
 * data, so a nose or a tail cannot bulge past its stations.
 * @param {number[]} xs ascending @param {number[]} ys @returns {(x: number) => number}
 */
export function monotone(xs, ys) {
  const n = xs.length;
  if (n < 2) return () => ys[0];
  const d = [];
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
  const m = new Array(n).fill(0);
  m[0] = d[0];
  m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) {
      m[i] = 0;
      m[i + 1] = 0;
      continue;
    }
    const a = m[i] / d[i];
    const b = m[i + 1] / d[i];
    const s = a * a + b * b;
    if (s > 9) {
      const t = 3 / Math.sqrt(s);
      m[i] = t * a * d[i];
      m[i + 1] = t * b * d[i];
    }
  }
  return (x) => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let i = 0;
    while (x > xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i];
    const t = (x - xs[i]) / h;
    const t2 = t * t;
    const t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * m[i + 1];
  };
}

/**
 * Smooth interpolation of a station list in z.
 * @param {number[][]} list sorted by z @returns {(z: number) => number[]}
 */
export function stationCurve(list) {
  const zs = list.map((s) => s[0]);
  const fns = [];
  for (let j = 1; j < 9; j++) fns.push(monotone(zs, list.map((s) => s[j])));
  return (z) => [z, ...fns.map((f) => f(z))];
}

/**
 * A station near an axle with the rocker raised into the wheel arch (a circle of radius
 * `wheelRadius + 0.08`) and the fender flared. `off` is the distance from the axle.
 * @param {number[]} st @param {number} off @param {number} wheelRadius @param {number} flare
 */
export function archStation(st, off, wheelRadius, flare) {
  const out = st.slice();
  const R = wheelRadius + 0.08;
  if (Math.abs(off) < R) out[1] = Math.max(out[1], wheelRadius + Math.sqrt(R * R - off * off));
  if (out[3] < out[1] + 0.05) out[3] = out[1] + 0.05;
  if (out[5] < out[3] + 0.04) out[5] = out[3] + 0.04;
  if (out[7] < out[5] + 0.01) out[7] = out[5] + 0.01;
  const f = flare * Math.max(0, 1 - (off / 0.55) ** 2);
  out[2] += f;
  out[4] += f;
  return out;
}

/**
 * The z of every ring: the authored stations, the arch offsets around each axle that fall
 * inside the body (they win over an authored station closer than 3 cm), then extra rings so
 * no gap is wider than `maxGap`. A truck cab that ends before its rear axle gets no arch there.
 * @param {number[][]} list @param {number[]} axles @param {number[]} arch @param {number} maxGap
 */
export function loftZs(list, axles, arch, maxGap) {
  const lo = list[0][0];
  const hi = list[list.length - 1][0];
  const archZ = axles.flatMap((a) => arch.map((o) => a + o)).filter((z) => z > lo + 0.02 && z < hi - 0.02);
  const zs = [...list.map((s) => s[0]).filter((z) => !archZ.some((a) => Math.abs(a - z) < 0.03)), ...archZ].sort((a, b) => a - b);
  const out = [zs[0]];
  for (let i = 1; i < zs.length; i++) {
    const gap = zs[i] - zs[i - 1];
    const n = Math.ceil(gap / maxGap - 1e-9);
    for (let k = 1; k < n; k++) out.push(zs[i - 1] + (gap * k) / n);
    out.push(zs[i]);
  }
  return out;
}

/** Height of the roof crown above the roof edge, from the roof width. @param {number[]} st */
export function crownOf(st) {
  return 0.045 * Math.min(1, Math.max(0, st[8]) / 0.75);
}

/** Roof height at x across a station: the edge plus a parabolic crown. */
export function roofHeight(st, x) {
  const w = st[8];
  if (w <= 0 || Math.abs(x) >= w) return st[7];
  return st[7] + crownOf(st) * (1 - (x / w) ** 2);
}

const cr = (p0, p1, p2, p3) => 0.5 * (2 * p1 + 0.5 * (p2 - p0) + 0.25 * (2 * p0 - 5 * p1 + 4 * p2 - p3) + 0.125 * (-p0 + 3 * p1 - 3 * p2 + p3));
/** Catmull-Rom halfway between b and c. */
const mid = (a, b, c, d) => [Math.max(0, cr(a[0], b[0], c[0], d[0])), cr(a[1], b[1], c[1], d[1])];

/**
 * @typedef {{ x: number, y: number, band: number, g: number }} RingPoint
 * `band` is the band of the segment that starts at the point; `g` runs 0 at the belt line to
 * 1 at the roof edge along the greenhouse, for the side glass texture.
 */

/**
 * The cross-section ring of a station: 19 points from the right rocker (local -X is the
 * car's right) up the side, over the crowned roof and down the left side. Segment i runs
 * from point i to point i + 1; the last one closes the underside.
 * @param {number[]} st @returns {RingPoint[]}
 */
export function ringOf(st) {
  const P = [[st[2], st[1]], [st[4], st[3]], [st[6], st[5]], [st[8], st[7]]];
  const side = [P[0], mid(P[0], P[0], P[1], P[2]), P[1], mid(P[0], P[1], P[2], P[3]), P[2], mid(P[1], P[2], P[3], P[3]), P[3]];
  const sideBand = [BAND.LOWER, BAND.LOWER, BAND.UPPER, BAND.UPPER, BAND.GREEN, BAND.GREEN, BAND.ROOF];
  const sideG = [0, 0, 0, 0, 0, 0.5, 1];
  const crown = crownOf(st);
  const w3 = st[8];
  const roofAt = (f) => st[7] + crown * (1 - f * f);
  /** @type {RingPoint[]} */
  const pts = [];
  for (let i = 0; i < 7; i++) pts.push({ x: -side[i][0], y: side[i][1], band: sideBand[i], g: sideG[i] });
  for (const f of [0.75, 0.38, 0, -0.38, -0.75]) pts.push({ x: f === 0 ? 0 : -f * w3, y: roofAt(f), band: BAND.ROOF, g: 0 });
  const leftBand = [BAND.UNDER, BAND.LOWER, BAND.LOWER, BAND.UPPER, BAND.UPPER, BAND.GREEN, BAND.GREEN];
  for (let i = 6; i >= 0; i--) pts.push({ x: side[i][0], y: side[i][1], band: leftBand[i], g: sideG[i] });
  return pts;
}

/**
 * A ring pulled toward its center by `d` meters, for the bevel round the nose and tail.
 * @param {RingPoint[]} pts @param {number} d
 */
export function insetRing(pts, d) {
  const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
  const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
  return pts.map((p) => {
    const dx = cx - p.x;
    const dy = cy - p.y;
    const len = Math.hypot(dx, dy);
    const t = len > 1e-6 ? Math.min(1, d / len) : 0;
    return { ...p, x: p.x + dx * t, y: p.y + dy * t };
  });
}
