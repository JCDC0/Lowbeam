/**
 * Turns an outside low poly model (a .glb, such as Kenney's CC0 Car Kit) into the game's model JSON,
 * the same format the Blender kit exports (`tools/blender/kit.py`), with no Blender needed.
 *
 *   node tools/import-glb.mjs <model.glb> <name> [--size L,W,H] [--map "#rrggbb=paint,#rrggbb=glass,..."]
 *                             [--report] [--source "Kenney Car Kit 3.1, CC0"]
 *
 * Every triangle gets one flat color, sampled from the model's texture at the middle of its UVs (these
 * kits paint with a small palette texture), and a flat normal, for the game's PS1 look. Colors become
 * materials by `--map`: `paint` is tinted per car, `lamp` faces at the front are head lamps and `tail`
 * faces tail lamps (`traffic/bodies.js`), anything else keeps its color under its hex name. The model is
 * moved so it stands on y = 0, centered in x and z, front to +z, and `--size` scales it to a traffic kind's
 * length, width and height. `--report` prints the colors by area, where they sit and the bounds, to
 * write the map. The source goes into `assets/models/SOURCES.md` by hand.
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const [input, name] = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--') && args[i - 1] !== '--report'));
if (!input || !name) {
  console.error('usage: node tools/import-glb.mjs <model.glb> <name> [--size L,W,H] [--map "#rrggbb=paint,..."] [--report]');
  process.exit(1);
}

/** A PNG's pixels as RGBA (8 bit, non-interlaced; what these kits ship). */
function decodePng(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('not a png');
  let p = 8;
  let w = 0, h = 0, depth = 0, type = 0;
  const idat = [];
  let palette = null;
  let alpha = null;
  while (p < buf.length) {
    const len = buf.readUInt32BE(p);
    const kind = buf.toString('ascii', p + 4, p + 8);
    const data = buf.subarray(p + 8, p + 8 + len);
    if (kind === 'IHDR') {
      w = data.readUInt32BE(0);
      h = data.readUInt32BE(4);
      depth = data[8];
      type = data[9];
      if (data[12] !== 0) throw new Error('interlaced png');
    } else if (kind === 'PLTE') palette = data;
    else if (kind === 'tRNS') alpha = data;
    else if (kind === 'IDAT') idat.push(data);
    else if (kind === 'IEND') break;
    p += 12 + len;
  }
  if (depth !== 8) throw new Error(`png bit depth ${depth}`);
  const ch = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[type];
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = w * ch;
  const px = Buffer.alloc(h * stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)];
    const src = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const a = x >= ch ? px[y * stride + x - ch] : 0;
      const b = y > 0 ? px[(y - 1) * stride + x] : 0;
      const c = x >= ch && y > 0 ? px[(y - 1) * stride + x - ch] : 0;
      let v = src[x];
      if (f === 1) v += a;
      else if (f === 2) v += b;
      else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) {
        const pp = a + b - c;
        const pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      px[y * stride + x] = v & 255;
    }
  }
  const out = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    let r, g, b, al = 255;
    if (type === 3) {
      const k = px[i];
      r = palette[k * 3]; g = palette[k * 3 + 1]; b = palette[k * 3 + 2];
      if (alpha && k < alpha.length) al = alpha[k];
    } else if (type === 0 || type === 4) {
      r = g = b = px[i * ch];
      if (type === 4) al = px[i * ch + 1];
    } else {
      r = px[i * ch]; g = px[i * ch + 1]; b = px[i * ch + 2];
      if (type === 6) al = px[i * ch + 3];
    }
    out.set([r, g, b, al], i * 4);
  }
  return { w, h, rgba: out };
}

/** The glTF of a .glb and its binary chunk. */
function readGlb(file) {
  const b = fs.readFileSync(file);
  if (b.toString('ascii', 0, 4) !== 'glTF') throw new Error('not a glb');
  let p = 12;
  let json = null;
  let bin = null;
  while (p < b.length) {
    const len = b.readUInt32LE(p);
    const kind = b.readUInt32LE(p + 4);
    const data = b.subarray(p + 8, p + 8 + len);
    if (kind === 0x4e4f534a) json = JSON.parse(data.toString('utf8'));
    else if (kind === 0x004e4942) bin = data;
    p += 8 + len;
  }
  return { json, bin };
}

const COMP = { 5120: [1, 'getInt8'], 5121: [1, 'getUint8'], 5122: [2, 'getInt16'], 5123: [2, 'getUint16'], 5125: [4, 'getUint32'], 5126: [4, 'getFloat32'] };
const NUM = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };

function accessor(gltf, bin, index) {
  const a = gltf.accessors[index];
  const v = gltf.bufferViews[a.bufferView];
  const [size, getter] = COMP[a.componentType];
  const n = NUM[a.type];
  const stride = v.byteStride || size * n;
  const dv = new DataView(bin.buffer, bin.byteOffset + (v.byteOffset || 0) + (a.byteOffset || 0));
  const out = [];
  for (let i = 0; i < a.count; i++) {
    const row = [];
    for (let k = 0; k < n; k++) row.push(dv[getter](i * stride + k * size, true));
    out.push(row);
  }
  return out;
}

/** A node's local matrix (column-major 4x4) from its matrix or its translation, rotation and scale. */
function localMatrix(node) {
  if (node.matrix) return node.matrix;
  const [tx, ty, tz] = node.translation || [0, 0, 0];
  const [x, y, z, w] = node.rotation || [0, 0, 0, 1];
  const [sx, sy, sz] = node.scale || [1, 1, 1];
  return [
    (1 - 2 * (y * y + z * z)) * sx, 2 * (x * y + z * w) * sx, 2 * (x * z - y * w) * sx, 0,
    2 * (x * y - z * w) * sy, (1 - 2 * (x * x + z * z)) * sy, 2 * (y * z + x * w) * sy, 0,
    2 * (x * z + y * w) * sz, 2 * (y * z - x * w) * sz, (1 - 2 * (x * x + y * y)) * sz, 0,
    tx, ty, tz, 1,
  ];
}
const mul = (a, b) => {
  const o = new Array(16).fill(0);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k];
  return o;
};
const apply = (m, [x, y, z]) => [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]];

const { json: gltf, bin } = readGlb(input);
const texCache = new Map();
function textureOf(matIndex) {
  const mat = gltf.materials?.[matIndex];
  const t = mat?.pbrMetallicRoughness?.baseColorTexture;
  if (!t) return null;
  const img = gltf.images[gltf.textures[t.index].source];
  if (texCache.has(img)) return texCache.get(img);
  let png;
  if (img.uri) png = fs.readFileSync(path.join(path.dirname(input), decodeURI(img.uri)));
  else {
    const v = gltf.bufferViews[img.bufferView];
    png = bin.subarray(v.byteOffset || 0, (v.byteOffset || 0) + v.byteLength);
  }
  const tex = decodePng(png);
  texCache.set(img, tex);
  return tex;
}
const hex = (r, g, b) => '#' + [r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('');

/** Every triangle: three points, its color and the node it came from. */
const tris = [];
function walk(ni, parent) {
  const node = gltf.nodes[ni];
  const m = mul(parent, localMatrix(node));
  if (node.mesh !== undefined) {
    for (const prim of gltf.meshes[node.mesh].primitives) {
      if (prim.mode !== undefined && prim.mode !== 4) continue;
      const pos = accessor(gltf, bin, prim.attributes.POSITION).map((p) => apply(m, p));
      const uv = prim.attributes.TEXCOORD_0 !== undefined ? accessor(gltf, bin, prim.attributes.TEXCOORD_0) : null;
      const idx = prim.indices !== undefined ? accessor(gltf, bin, prim.indices).map((r) => r[0]) : pos.map((_, i) => i);
      const tex = textureOf(prim.material);
      const base = gltf.materials?.[prim.material]?.pbrMetallicRoughness?.baseColorFactor || [1, 1, 1, 1];
      for (let i = 0; i + 2 < idx.length; i += 3) {
        const [a, b, c] = [idx[i], idx[i + 1], idx[i + 2]];
        let col = base.slice(0, 3).map((v) => Math.round(v * 255));
        if (tex && uv) {
          const u = (uv[a][0] + uv[b][0] + uv[c][0]) / 3;
          const v = (uv[a][1] + uv[b][1] + uv[c][1]) / 3;
          const x = Math.min(tex.w - 1, Math.max(0, Math.floor((u - Math.floor(u)) * tex.w)));
          const y = Math.min(tex.h - 1, Math.max(0, Math.floor((v - Math.floor(v)) * tex.h)));
          const o = (y * tex.w + x) * 4;
          col = [tex.rgba[o], tex.rgba[o + 1], tex.rgba[o + 2]].map((c2, k) => Math.round((c2 * base[k])));
        }
        tris.push({ p: [pos[a], pos[b], pos[c]], color: hex(...col), node: node.name || `node${ni}` });
      }
    }
  }
  for (const c of node.children || []) walk(c, m);
}
const IDENT = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
for (const ni of gltf.scenes[gltf.scene || 0].nodes) walk(ni, IDENT);

const lo = [Infinity, Infinity, Infinity];
const hi = [-Infinity, -Infinity, -Infinity];
for (const t of tris) for (const q of t.p) for (let k = 0; k < 3; k++) {
  lo[k] = Math.min(lo[k], q[k]);
  hi[k] = Math.max(hi[k], q[k]);
}
const dims = [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]];
const size = flag('--size') ? flag('--size').split(',').map(Number) : null;
const scale = size ? [size[1] / dims[0], size[2] / dims[1], size[0] / dims[2]] : [1, 1, 1];
const place = (q) => [(q[0] - (lo[0] + hi[0]) / 2) * scale[0], (q[1] - lo[1]) * scale[1], (q[2] - (lo[2] + hi[2]) / 2) * scale[2]];

// A wheel keeps its shape: its center follows the body's scale, but it is scaled by the vertical
// factor in y and z, so a toy car stretched to a real one's length keeps round wheels on the ground.
/** @type {Map<string, { lo: number[], hi: number[] }>} */
const wheels = new Map();
for (const t of tris) {
  if (!/wheel/i.test(t.node)) continue;
  let b = wheels.get(t.node);
  if (!b) wheels.set(t.node, (b = { lo: [Infinity, Infinity, Infinity], hi: [-Infinity, -Infinity, -Infinity] }));
  for (const q of t.p) for (let k = 0; k < 3; k++) {
    b.lo[k] = Math.min(b.lo[k], q[k]);
    b.hi[k] = Math.max(b.hi[k], q[k]);
  }
}
const pts = (t) => {
  const b = wheels.get(t.node);
  if (!b) return t.p.map(place);
  const c = [0, 1, 2].map((k) => (b.lo[k] + b.hi[k]) / 2);
  const pc = place(c);
  return t.p.map((q) => [pc[0] + (q[0] - c[0]) * scale[0], pc[1] + (q[1] - c[1]) * scale[1], pc[2] + (q[2] - c[2]) * scale[1]]);
};

const area = (t) => {
  const [a, b, c] = pts(t);
  const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  const len = Math.hypot(...n);
  return { area: len / 2, normal: len > 0 ? n.map((x) => x / len) : [0, 1, 0], mid: [0, 1, 2].map((k) => (a[k] + b[k] + c[k]) / 3) };
};

if (args.includes('--report')) {
  const by = new Map();
  for (const t of tris) {
    const { area: ar, normal, mid } = area(t);
    const e = by.get(t.color) || { area: 0, tris: 0, z: 0, y: 0, front: 0, back: 0, nodes: new Set() };
    e.area += ar;
    e.tris++;
    e.z += mid[2] * ar;
    e.y += mid[1] * ar;
    if (normal[2] > 0.5) e.front += ar;
    if (normal[2] < -0.5) e.back += ar;
    e.nodes.add(t.node);
    by.set(t.color, e);
  }
  console.log(`${tris.length} triangles; source bounds ${dims.map((d) => d.toFixed(3)).join(' x ')} (x, y, z); scaled to ${dims.map((d, k) => (d * scale[k]).toFixed(2)).join(' x ')}`);
  for (const [c, e] of [...by].sort((a, b) => b[1].area - a[1].area)) {
    console.log(`${c}  area ${e.area.toFixed(2)} m2  tris ${e.tris}  mean y ${(e.y / e.area).toFixed(2)}  mean z ${(e.z / e.area).toFixed(2)}  facing front ${e.front.toFixed(2)} back ${e.back.toFixed(2)}  in ${[...e.nodes].join(' ')}`);
  }
  process.exit(0);
}

const map = new Map((flag('--map') || '').split(',').filter(Boolean).map((s) => {
  const [c, m] = s.split('=');
  return [c.trim().toLowerCase(), m.trim()];
}));

/** Hue (degrees), saturation and value of a #rrggbb. */
function hsv(h) {
  const r = parseInt(h.slice(1, 3), 16) / 255, g = parseInt(h.slice(3, 5), 16) / 255, b = parseInt(h.slice(5, 7), 16) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let hue = 0;
  if (d > 0) hue = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: (hue * 60 + 360) % 360, s: mx ? d / mx : 0, v: mx, r, g, b };
}

/**
 * The part a triangle belongs to, for kits that paint with a shaded palette (Kenney's): a wheel's
 * dark faces are tire and the rest rim; on the body the most common saturated hue is the paint,
 * pale blue is glass, yellow at the front a head lamp, red at the back a tail lamp, near-white the
 * plates, near-black the trim, the grey-blue the lower body and bumpers.
 */
function partOf(t, paintHue, len) {
  const c = hsv(t.color);
  const { mid, normal } = area(t);
  if (/wheel/i.test(t.node)) return c.v < 0.36 ? 'tire' : 'rim';
  if (c.s > 0.55 && c.h >= 38 && c.h <= 62 && mid[2] > 0) return 'lamp';
  if (c.s > 0.55 && (c.h < 6 || c.h > 345) && mid[2] < -0.4 * len && normal[2] < -0.3) return 'tail';
  if (c.s > 0.4 && Math.abs(((c.h - paintHue + 540) % 360) - 180) < 14) return 'paint';
  if (c.v > 0.85 && c.b > c.r + 0.04) return 'glass';
  if (c.v > 0.72 && c.s < 0.14) return 'plate';
  if (c.v < 0.33) return 'trim';
  return 'under';
}
const auto = args.includes('--auto');
let paintHue = 0;
if (auto) {
  const hues = new Map();
  for (const t of tris) {
    if (/wheel/i.test(t.node)) continue;
    const c = hsv(t.color);
    if (c.s < 0.4) continue;
    const k = Math.round(c.h / 10);
    hues.set(k, (hues.get(k) || 0) + area(t).area);
  }
  paintHue = ([...hues].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 0) * 10;
}
const groups = new Map();
for (const t of tris) {
  const mname = map.get(t.color) || (auto ? partOf(t, paintHue, dims[2] * scale[2]) : `c-${t.color.slice(1)}`);
  if (!groups.has(mname)) groups.set(mname, { color: t.color, pos: [], nrm: [], sum: [0, 0, 0], area: 0 });
  const g = groups.get(mname);
  const { normal, area: ar } = area(t);
  const c = hsv(t.color);
  g.sum[0] += c.r * ar;
  g.sum[1] += c.g * ar;
  g.sum[2] += c.b * ar;
  g.area += ar;
  for (const q of pts(t)) g.pos.push(...q.map((x) => Math.round(x * 10000) / 10000));
  for (let i = 0; i < 3; i++) g.nrm.push(...normal.map((x) => Math.round(x * 10000) / 10000));
}
// One flat color a part: the area-weighted mean of its shades.
if (auto) for (const g of groups.values()) if (g.area > 0) g.color = hex(...g.sum.map((v) => Math.round((v / g.area) * 255)));
if (args.includes('--parts')) for (const [k, g] of groups) console.log(`${k.padEnd(6)} ${g.color}  ${g.area.toFixed(2)} m2  ${g.pos.length / 9} tris`);
const out = { name, size: dims.map((d, k) => Math.round(d * scale[k] * 100) / 100), materials: [], groups: [], position: [], normal: [], uv: [], colliders: [], lights: [] };
const EMISSIVE = new Set(['lamp', 'tail']);
let start = 0;
for (const [mname, g] of groups) {
  out.materials.push({ name: mname, color: parseInt(g.color.slice(1), 16), tex: '', emissive: EMISSIVE.has(mname) });
  const count = g.pos.length / 3;
  out.groups.push({ material: out.materials.length - 1, start, count });
  start += count;
  out.position.push(...g.pos);
  out.normal.push(...g.nrm);
  out.uv.push(...new Array(count * 2).fill(0));
}
const file = path.join('assets', 'models', `${name}.json`);
fs.writeFileSync(file, JSON.stringify(out));
console.log(`${file}: ${tris.length} triangles, ${out.materials.length} materials (${out.materials.map((m) => m.name).join(', ')}), size ${out.size.join(' x ')} (w, h, d)`);
if (flag('--source')) console.log(`source: ${flag('--source')} (add it to assets/models/SOURCES.md)`);
