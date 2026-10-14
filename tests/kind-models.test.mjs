import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { KINDS, KIND_MODELS, KIND_BY_ID } from '../src/traffic/kinds.js';
import { CIVILIAN_MODEL_BY_ID } from '../src/vehicles/bodies/civilians.js';

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

test('every civilian kind has collision dimensions matching its body model', () => {
  assert.equal(KINDS.length, 22, 'twenty-two civilian traffic kinds');
  for (const kind of KINDS) {
    if (kind.blender) {
      const model = JSON.parse(readFileSync(new URL(`../assets/models/${kind.blender}.json`, import.meta.url), 'utf8'));
      const names = model.materials.map((m) => m.name);
      for (const need of ['paint', 'lamp', 'tail']) assert.ok(names.includes(need), `${kind.blender} has a ${need} material`);
      const [w, h, l] = model.size;
      assert.ok(Math.abs(l - kind.length) < 0.35, `${kind.id} blender length ${l} m matches kind ${kind.length}`);
      assert.ok(Math.abs(w - kind.width) < 0.3, `${kind.id} blender width ${w} m matches kind ${kind.width}`);
      assert.ok(Math.abs(h - kind.height) < 0.3, `${kind.id} blender height ${h} m matches kind ${kind.height}`);
    } else {
      const m = CIVILIAN_MODEL_BY_ID.get(kind.id);
      assert.ok(m, `${kind.id} has a civilian body model`);
      const modelLength = kind.id === 'truck' ? 7.2 : kind.id === 'tanker' ? 9.0 : kind.id === 'semi' ? 16.0 : m.length;
      const modelHeight = kind.id === 'truck' ? 3.2 : kind.id === 'tanker' ? 3.0 : kind.id === 'bus' ? 3.1 : kind.id === 'semi' ? 3.6 : m.height;
      assert.ok(Math.abs(modelLength - kind.length) < 0.35, `${kind.id} length ${kind.length} m matches model ${modelLength}`);
      assert.ok(Math.abs(m.width - kind.width) < 0.3, `${kind.id} width ${kind.width} m matches model ${m.width}`);
      assert.ok(Math.abs(modelHeight - kind.height) < 0.3, `${kind.id} height ${kind.height} m matches model ${modelHeight}`);
    }
  }
});
