import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { KIND_MODELS, KIND_BY_ID } from '../src/traffic/kinds.js';

test('every Blender body a traffic kind names exists, is lit and tinted, and has the size the kind collides with', () => {
  assert.ok(Object.keys(KIND_MODELS).length >= 2);
  for (const [id, name] of Object.entries(KIND_MODELS)) {
    const kind = KIND_BY_ID.get(id);
    assert.ok(kind, `${id} is a kind`);
    assert.equal(kind.blender, name);
    const model = JSON.parse(readFileSync(new URL(`../assets/models/${name}.json`, import.meta.url), 'utf8'));
    const names = model.materials.map((m) => m.name);
    for (const need of ['paint', 'lamp', 'tail']) assert.ok(names.includes(need), `${name} has a ${need} material`);
    if (kind.lightBar) for (const need of ['lens-l', 'lens-r']) assert.ok(names.includes(need), `${name} has its ${need}`);
    const [w, h, l] = model.size;
    assert.ok(Math.abs(l - kind.length) < 0.35, `${name} is ${l} m long, the kind ${kind.length}`);
    assert.ok(w - kind.width < 0.3 && kind.width - w < 0.3, `${name} is ${w} m wide, the kind ${kind.width}`);
    assert.ok(Math.abs(h - kind.height) < 0.3, `${name} is ${h} m tall, the kind ${kind.height}`);
    assert.equal(model.groups.reduce((n, g) => n + g.count, 0), model.position.length / 3, `${name}: the groups cover every vertex`);
  }
});
