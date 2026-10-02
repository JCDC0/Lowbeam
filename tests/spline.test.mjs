import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Path } from '../src/world/spline.js';

test('a straight open path has its control length and a signed lateral offset', () => {
  const p = new Path([[0, 0], [0, 50], [0, 100]]);
  assert.ok(Math.abs(p.length - 100) < 0.5, `length ${p.length}`);
  // Travel is +Z, so the left of travel is +X (see vehicles/physics.js).
  const left = p.nearest(3, 40);
  assert.ok(Math.abs(left.s - 40) < 0.5);
  assert.ok(Math.abs(left.d - 3) < 1e-6, `d ${left.d}`);
  assert.ok(p.nearest(-2, 70).d < 0);
});

test('a closed circle wraps arc length', () => {
  const pts = [];
  for (let i = 0; i < 16; i++) pts.push([Math.cos((i / 16) * Math.PI * 2) * 100, Math.sin((i / 16) * Math.PI * 2) * 100]);
  const p = new Path(pts, { closed: true });
  assert.ok(Math.abs(p.length - 2 * Math.PI * 100) < 3, `length ${p.length}`);
  const a = p.sample(-10);
  const b = p.sample(p.length - 10);
  assert.ok(Math.hypot(a.x - b.x, a.z - b.z) < 1e-6);
});
