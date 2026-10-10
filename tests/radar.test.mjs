import { test } from 'node:test';
import assert from 'node:assert/strict';
import { radarFrame, sightOf, CHASE_SIGHT, PATROL_NOTICE } from '../src/ui/radar.js';
import { makeRng } from '../src/core/rng.js';

const TAU = Math.PI * 2;
/** Two angles are the same direction. */
const same = (p, q) => Math.abs(Math.atan2(Math.sin(p - q), Math.cos(p - q))) < 1e-9;
/** The old formula, kept to show what it got wrong. */
const oldScreenYaw = (x, z, yaw, s, wyaw) => {
  const c = Math.cos(yaw), n = Math.sin(yaw);
  const a = -s * c, b = -s * n, cc = s * n, d = -s * c;
  return Math.atan2(cc * Math.sin(wyaw) + d * Math.cos(wyaw), a * Math.sin(wyaw) + b * Math.cos(wyaw));
};

test('a unit heading is shown as the direction it really moves on the radar, whatever way the player faces', () => {
  const r = makeRng(7);
  for (let i = 0; i < 400; i++) {
    const px = (r.next() - 0.5) * 6000;
    const pz = (r.next() - 0.5) * 6000;
    const yaw = r.next() * TAU;
    const scale = 0.2 + r.next() * 0.5;
    const w = r.next() * TAU;
    const f = radarFrame(px, pz, yaw, scale, 110);
    const ux = px + (r.next() - 0.5) * 400;
    const uz = pz + (r.next() - 0.5) * 400;
    const [x0, y0] = f.toScreen(ux, uz);
    const [x1, y1] = f.toScreen(ux + Math.sin(w) * 10, uz + Math.cos(w) * 10);
    assert.ok(same(f.screenYaw(w), Math.atan2(y1 - y0, x1 - x0)), `player ${yaw.toFixed(2)}, unit ${w.toFixed(2)}`);
  }
});

test('ahead of the player is up on the radar, its right is right, behind is down', () => {
  for (const yaw of [0, 0.7, 2.1, -1.3, 3.0, 5.5]) {
    const f = radarFrame(120, -340, yaw, 0.4, 110);
    assert.ok(same(f.screenYaw(yaw), -Math.PI / 2), `ahead at ${yaw}`);
    assert.ok(same(f.screenYaw(yaw - Math.PI / 2), 0), `right at ${yaw}`);
    assert.ok(same(f.screenYaw(yaw + Math.PI / 2), Math.PI), `left at ${yaw}`);
    assert.ok(same(f.screenYaw(yaw + Math.PI), Math.PI / 2), `behind at ${yaw}`);
    const [cx, cy] = f.toScreen(120, -340);
    assert.ok(Math.abs(cx - 110) < 1e-9 && Math.abs(cy - 110) < 1e-9, 'the player is the center');
  }
});

test('the old formula turned every unit with the player: a car going the same way did not point up', () => {
  const yaw = 1.0;
  assert.ok(!same(oldScreenYaw(0, 0, yaw, 0.4, yaw), -Math.PI / 2), 'it showed 2x the player yaw');
  assert.ok(same(oldScreenYaw(0, 0, 0, 0.4, 0.8), radarFrame(0, 0, 0, 0.4, 110).screenYaw(0.8)), 'right only when the player faced +Z');
});

test('a chasing unit sees all round to its range, a patrol notices in a ring, a searching unit keeps its cone, and fog shortens them', () => {
  assert.deepEqual(sightOf({ active: true }, 1), { r: CHASE_SIGHT, half: Math.PI });
  assert.deepEqual(sightOf({ active: false }, 1), { r: PATROL_NOTICE, half: Math.PI });
  assert.deepEqual(sightOf({ active: true, cone: { r: 60, half: 0.61 } }, 1), { r: 60, half: 0.61 });
  assert.equal(sightOf({ active: true }, 0.55).r, CHASE_SIGHT * 0.55);
  assert.equal(sightOf({ active: false }, 0.55).r, PATROL_NOTICE * 0.55);
  assert.equal(CHASE_SIGHT, 150, 'the radar draws what the director uses');
});
