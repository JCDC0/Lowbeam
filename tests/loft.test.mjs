import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BAND, RING_POINTS, archStation, insetRing, loftZs, monotone, ringOf, roofHeight, stationCurve } from '../src/vehicles/loft.js';

const ST = [0, 0.22, 0.95, 0.64, 0.97, 0.9, 0.92, 1.31, 0.68];

test('the monotone curve passes through its points and never overshoots them', () => {
  const xs = [0, 1, 1.2, 3, 3.1];
  const ys = [0.3, 0.3, 0.9, 1.0, 0.4];
  const f = monotone(xs, ys);
  xs.forEach((x, i) => assert.ok(Math.abs(f(x) - ys[i]) < 1e-9));
  for (let i = 0; i < xs.length - 1; i++) {
    const lo = Math.min(ys[i], ys[i + 1]);
    const hi = Math.max(ys[i], ys[i + 1]);
    for (let t = 0; t <= 1; t += 0.05) {
      const y = f(xs[i] + (xs[i + 1] - xs[i]) * t);
      assert.ok(y >= lo - 1e-9 && y <= hi + 1e-9, `overshoot at segment ${i}: ${y}`);
    }
  }
});

test('a ring is 19 points, mirror symmetric, crowned on top and banded side to side', () => {
  const r = ringOf(ST);
  assert.equal(r.length, RING_POINTS);
  for (let i = 0; i < r.length; i++) {
    const j = r.length - 1 - i;
    assert.ok(Math.abs(r[i].x + r[j].x) < 1e-9 && Math.abs(r[i].y - r[j].y) < 1e-9, `point ${i} is not mirrored`);
  }
  const top = r[9];
  assert.equal(top.x, 0);
  assert.ok(top.y > ST[7] + 0.03, 'no crown');
  assert.equal(roofHeight(ST, 0), top.y);
  assert.equal(r[18].band, BAND.UNDER);
  assert.deepEqual(r.slice(6, 12).map((p) => p.band), Array(6).fill(BAND.ROOF));
  assert.equal(r.filter((p) => p.band === BAND.GREEN).length, 4);
  // The side mid points bow outward from the straight line between the control points.
  const chord = (ST[2] + ST[4]) / 2;
  assert.ok(-r[1].x >= chord - 1e-9);
});

test('rings are spaced at most the gap asked for and the arch stations are kept exactly', () => {
  const list = [[-2.4, ...ST.slice(1)], [-1, ...ST.slice(1)], [0.4, ...ST.slice(1)], [2.1, ...ST.slice(1)]];
  const zs = loftZs(list, [-1.5, 1.2], [-0.46, 0, 0.46], 0.26);
  for (let i = 1; i < zs.length; i++) assert.ok(zs[i] - zs[i - 1] <= 0.26 + 1e-9 && zs[i] > zs[i - 1]);
  for (const z of [-1.96, -1.5, -1.04, 0.74, 1.2, 1.66]) assert.ok(zs.some((v) => Math.abs(v - z) < 1e-9), `missing arch ring at ${z}`);
  assert.equal(zs[0], -2.4);
  assert.equal(zs[zs.length - 1], 2.1);
  const curve = stationCurve(list);
  assert.deepEqual(curve(-1).slice(1), ST.slice(1));
});

test('the arch lifts the rocker over the wheel and flares the fender', () => {
  const a = archStation(ST, 0, 0.33, 0.04);
  assert.ok(Math.abs(a[1] - (0.33 + 0.41)) < 1e-9);
  assert.ok(a[2] > ST[2] && a[3] >= a[1] + 0.05);
  const far = archStation(ST, 0.6, 0.33, 0.04);
  assert.deepEqual(far, ST);
});

test('the end bevel pulls every point inward', () => {
  const r = ringOf(ST);
  const inset = insetRing(r, 0.03);
  const cx = r.reduce((s, p) => s + p.x, 0) / r.length;
  const cy = r.reduce((s, p) => s + p.y, 0) / r.length;
  r.forEach((p, i) => assert.ok(Math.hypot(inset[i].x - cx, inset[i].y - cy) < Math.hypot(p.x - cx, p.y - cy) + 1e-9));
});
