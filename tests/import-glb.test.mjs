import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

/**
 * A .glb of one triangle per material on a `body` node and one on a `wheel_fl` node, each placed in the
 * game's car frame, as a model made to order arrives (C10).
 * @param {{ node: string, material: string, color: number[], tri: number[][] }[]} parts
 */
function glb(parts) {
  const mats = [...new Set(parts.map((p) => p.material))];
  const floats = parts.flatMap((p) => p.tri.flat());
  const bin = Buffer.from(new Float32Array(floats).buffer);
  const nodes = [...new Set(parts.map((p) => p.node))];
  const json = {
    asset: { version: '2.0' },
    scene: 0,
    scenes: [{ nodes: nodes.map((_, i) => i) }],
    nodes: nodes.map((n, i) => ({ name: n, mesh: i })),
    meshes: nodes.map((n) => ({
      primitives: parts.map((p, i) => [p, i]).filter(([p]) => p.node === n).map(([p, i]) => ({ attributes: { POSITION: i }, material: mats.indexOf(p.material) })),
    })),
    materials: mats.map((m) => ({ name: m, pbrMetallicRoughness: { baseColorFactor: [...parts.find((p) => p.material === m).color, 1] } })),
    accessors: parts.map((p, i) => ({ bufferView: 0, byteOffset: i * 36, componentType: 5126, count: 3, type: 'VEC3' })),
    bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: bin.length }],
    buffers: [{ byteLength: bin.length }],
  };
  let js = Buffer.from(JSON.stringify(json));
  js = Buffer.concat([js, Buffer.alloc((4 - (js.length % 4)) % 4, 0x20)]);
  const head = Buffer.alloc(12);
  head.writeUInt32LE(0x46546c67, 0);
  head.writeUInt32LE(2, 4);
  head.writeUInt32LE(12 + 8 + js.length + 8 + bin.length, 8);
  const chunk = (buf, type) => {
    const h = Buffer.alloc(8);
    h.writeUInt32LE(buf.length, 0);
    h.writeUInt32LE(type, 4);
    return Buffer.concat([h, buf]);
  };
  return Buffer.concat([head, chunk(js, 0x4e4f534a), chunk(bin, 0x004e4942)]);
}

test('--names, --drop-wheels and --frame keep a named model as it was made', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lowbeam-glb-'));
  const src = path.join(dir, 'car.glb');
  const out = path.join(dir, 'car.json');
  const front = [[0.6, 0.5, 2.3], [0.4, 0.5, 2.3], [0.5, 0.6, 2.3]];
  fs.writeFileSync(src, glb([
    { node: 'body', material: 'paint', color: [1, 1, 1], tri: [[0.8, 0.3, -2.2], [-0.8, 0.3, -2.2], [0, 1.2, 0]] },
    { node: 'body', material: 'lamp', color: [1, 1, 0.9], tri: front },
    { node: 'body', material: 'signal', color: [1, 0.55, 0], tri: front.map(([x, y, z]) => [x + 0.2, y, z]) },
    { node: 'wheel_fl', material: 'tire', color: [0.1, 0.1, 0.1], tri: [[0.75, 0, 1.2], [0.75, 0.6, 1.2], [0.75, 0.3, 1.5]] },
  ]));
  try {
    execFileSync(process.execPath, ['tools/import-glb.mjs', src, 'car', '--names', '--drop-wheels', '--frame', '--out', out], { stdio: 'pipe' });
    const m = JSON.parse(fs.readFileSync(out, 'utf8'));
    const names = m.materials.map((x) => x.name);
    assert.deepEqual(names.sort(), ['lamp', 'paint', 'signal'], 'named parts pass through, the wheel is gone');
    assert.equal(m.materials.find((x) => x.name === 'signal').emissive, false, 'a name that is not a part is never lit');
    assert.equal(m.materials.find((x) => x.name === 'lamp').emissive, true);
    assert.equal(m.materials.find((x) => x.name === 'signal').color, 0xff8c00);
    const ys = m.position.filter((_, i) => i % 3 === 1);
    const zs = m.position.filter((_, i) => i % 3 === 2);
    assert.equal(Math.max(...zs), 2.3, 'the model keeps its own frame: nothing recentered');
    assert.equal(Math.min(...ys), 0.3, 'nor dropped to the ground');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
