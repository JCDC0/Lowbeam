import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { carById } from '../src/vehicles/specs.js';

/** The player cars with a body made to order (C10), by car id; `?hero=<car>:<model>` draws them. */
const HEROES = { hikari: 'hikari_300zr' };

/** @param {string} name */
const load = (name) => JSON.parse(readFileSync(new URL(`../assets/models/${name}.json`, import.meta.url), 'utf8'));

/** Every vertex of a part, as [x, y, z]. */
function partVerts(model, part) {
  const p = model.position;
  const out = [];
  for (const g of model.groups) {
    if (model.materials[g.material].name !== part) continue;
    for (let k = g.start; k < g.start + g.count; k++) out.push([p[k * 3], p[k * 3 + 1], p[k * 3 + 2]]);
  }
  return out;
}

test('every hero body has its parts, the size of its car and no wheels of its own', () => {
  for (const [id, name] of Object.entries(HEROES)) {
    const spec = carById(id);
    const model = load(name);
    const names = model.materials.map((m) => m.name);
    for (const need of ['paint', 'glass', 'lamp', 'tail', 'trim', 'under', 'plate']) assert.ok(names.includes(need), `${name} has a ${need} part`);
    assert.ok(!names.includes('tire') && !names.includes('rim'), `${name} leaves its wheels to CarModel`);
    assert.equal(model.groups.reduce((n, g) => n + g.count, 0), model.position.length / 3, `${name}: the groups cover every vertex`);
    assert.ok(model.position.length / 9 <= 2000, `${name} is ${model.position.length / 9} triangles`);
    const paint = partVerts(model, 'paint');
    const zs = model.position.filter((_, i) => i % 3 === 2);
    const length = Math.max(...zs) - Math.min(...zs);
    assert.ok(Math.abs(length - spec.length) < 0.12, `${name} is ${length.toFixed(2)} m long, the car ${spec.length}`);
    const width = Math.max(...paint.map((v) => v[0])) - Math.min(...paint.map((v) => v[0]));
    assert.ok(Math.abs(width - spec.width) < 0.08, `${name}'s body is ${width.toFixed(2)} m wide, the car ${spec.width}`);
    const roof = Math.max(...paint.map((v) => v[1]));
    assert.ok(roof > 1.15 && roof < 1.45, `${name}'s roof at ${roof.toFixed(2)} m`);
  }
});

test('a hero body has its head lamps in the front quarter and its tail lamps in the back, on both sides', () => {
  for (const [id, name] of Object.entries(HEROES)) {
    const spec = carById(id);
    const model = load(name);
    const quarter = spec.length / 4;
    for (const [part, sign] of [['lamp', 1], ['tail', -1]]) {
      const v = partVerts(model, part);
      assert.ok(v.length, `${name} has ${part} faces`);
      for (const q of v) assert.ok(q[2] * sign > spec.length / 2 - quarter, `${name}'s ${part} vertex at z ${q[2].toFixed(2)} is out of its quarter`);
      assert.ok(v.some((q) => q[0] > 0.2) && v.some((q) => q[0] < -0.2), `${name}'s ${part} reaches both sides`);
    }
  }
});

test('a hero body\'s wheel arches stand over the spec\'s axles', () => {
  for (const [id, name] of Object.entries(HEROES)) {
    const spec = carById(id);
    const model = load(name);
    const body = ['paint', 'trim'].flatMap((p) => partVerts(model, p)).filter((v) => Math.abs(v[0]) > spec.track / 2 - 0.15);
    const top = spec.wheelRadius * 2;
    for (const axle of [spec.cgToFront, spec.cgToFront - spec.wheelbase]) {
      // Over the tire the body clears its top; a little past the tire's reach it comes down again.
      const over = body.filter((v) => Math.abs(v[2] - axle) < spec.wheelRadius * 0.6);
      assert.ok(over.length && Math.min(...over.map((v) => v[1])) > top, `${name}: the body over the axle at z ${axle.toFixed(2)} sits on the wheel`);
    }
  }
});
