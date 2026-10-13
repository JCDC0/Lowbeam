/**
 * A reader for binary FBX files (7.x, what Blender and most low poly packs export), enough for
 * `tools/import-glb.mjs`: the meshes as triangles in world space, each with its material's diffuse color
 * and the name of the model node it belongs to. No textures, skins or animation.
 *
 *   import { readFbx } from './fbx.mjs';
 *   const { tris, up } = readFbx(buffer); // tris: [{ p: [[x,y,z] x3], color: '#rrggbb', node, material }]
 */
import zlib from 'node:zlib';

/** The node tree of a binary FBX: `{ name, props, children }`. */
function parse(buf) {
  if (buf.toString('latin1', 0, 18) !== 'Kaydara FBX Binary') throw new Error('not a binary fbx');
  const version = buf.readUInt32LE(23);
  const wide = version >= 7500;
  let p = 27;
  const u = () => {
    const v = wide ? Number(buf.readBigUInt64LE(p)) : buf.readUInt32LE(p);
    p += wide ? 8 : 4;
    return v;
  };
  const array = (size, read) => {
    const n = buf.readUInt32LE(p);
    const enc = buf.readUInt32LE(p + 4);
    const len = buf.readUInt32LE(p + 8);
    p += 12;
    let data = buf.subarray(p, p + len);
    p += len;
    if (enc === 1) data = zlib.inflateSync(data);
    const out = new Array(n);
    for (let i = 0; i < n; i++) out[i] = read(data, i * size);
    return out;
  };
  const prop = () => {
    const t = String.fromCharCode(buf[p++]);
    let v;
    switch (t) {
      case 'Y': v = buf.readInt16LE(p); p += 2; break;
      case 'C': v = buf[p] !== 0; p += 1; break;
      case 'I': v = buf.readInt32LE(p); p += 4; break;
      case 'F': v = buf.readFloatLE(p); p += 4; break;
      case 'D': v = buf.readDoubleLE(p); p += 8; break;
      case 'L': v = Number(buf.readBigInt64LE(p)); p += 8; break;
      case 'f': v = array(4, (d, o) => d.readFloatLE(o)); break;
      case 'd': v = array(8, (d, o) => d.readDoubleLE(o)); break;
      case 'l': v = array(8, (d, o) => Number(d.readBigInt64LE(o))); break;
      case 'i': v = array(4, (d, o) => d.readInt32LE(o)); break;
      case 'b': v = array(1, (d, o) => d[o] !== 0); break;
      case 'S': case 'R': {
        const n = buf.readUInt32LE(p);
        p += 4;
        v = t === 'S' ? buf.toString('utf8', p, p + n) : buf.subarray(p, p + n);
        p += n;
        break;
      }
      default: throw new Error(`fbx property type ${t} at ${p - 1}`);
    }
    return v;
  };
  const node = () => {
    const end = u();
    const nprops = u();
    u();
    const nameLen = buf[p++];
    if (end === 0) return null;
    const name = buf.toString('latin1', p, p + nameLen);
    p += nameLen;
    const props = [];
    for (let i = 0; i < nprops; i++) props.push(prop());
    const children = [];
    while (p < end) {
      const c = node();
      if (!c) break;
      children.push(c);
    }
    p = end;
    return { name, props, children };
  };
  const top = [];
  while (p < buf.length - 160) {
    const n = node();
    if (!n) break;
    top.push(n);
  }
  return top;
}

const child = (n, name) => n.children.find((c) => c.name === name);
/** A node's Properties70 as name to its values. */
function props70(n) {
  const out = new Map();
  const p = n && child(n, 'Properties70');
  for (const c of p ? p.children : []) out.set(c.props[0], c.props.slice(4));
  return out;
}

const deg = Math.PI / 180;
/** Column-major 4x4 helpers. */
const ident = () => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
function mul(a, b) {
  const o = new Array(16).fill(0);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k];
  return o;
}
const translate = ([x, y, z]) => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1];
const scaleM = ([x, y, z]) => [x, 0, 0, 0, 0, y, 0, 0, 0, 0, z, 0, 0, 0, 0, 1];
/** FBX's default rotation order (XYZ): x first, so R = Rz Ry Rx. */
function rotate([x, y, z]) {
  const [cx, sx, cy, sy, cz, sz] = [Math.cos(x * deg), Math.sin(x * deg), Math.cos(y * deg), Math.sin(y * deg), Math.cos(z * deg), Math.sin(z * deg)];
  const rx = [1, 0, 0, 0, 0, cx, sx, 0, 0, -sx, cx, 0, 0, 0, 0, 1];
  const ry = [cy, 0, -sy, 0, 0, 1, 0, 0, sy, 0, cy, 0, 0, 0, 0, 1];
  const rz = [cz, sz, 0, 0, -sz, cz, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  return mul(rz, mul(ry, rx));
}
const apply = (m, [x, y, z]) => [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]];
/** A material's diffuse color is linear (what Blender writes); the game's colors are sRGB, as a texture's are. */
const srgb = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);
const hex = (rgb) => '#' + rgb.map((c) => Math.max(0, Math.min(255, Math.round(srgb(Math.max(0, c)) * 255))).toString(16).padStart(2, '0')).join('');

/**
 * The triangles of a binary FBX in world space, y up (the file's own axes are turned to y up, the
 * scene's unit scale is not applied: the importer scales to a size anyway).
 * @param {Buffer} buf
 */
export function readFbx(buf) {
  const top = parse(buf);
  const objects = top.find((n) => n.name === 'Objects');
  const conns = top.find((n) => n.name === 'Connections');
  if (!objects || !conns) throw new Error('fbx without Objects or Connections');
  const byId = new Map();
  for (const o of objects.children) byId.set(o.props[0], o);
  /** child id to parent ids, in file order */
  const parents = new Map();
  /** parent id to child ids */
  const kids = new Map();
  for (const c of conns.children) {
    if (c.name !== 'C') continue;
    const [, a, b] = c.props;
    if (!parents.has(a)) parents.set(a, []);
    parents.get(a).push(b);
    if (!kids.has(b)) kids.set(b, []);
    kids.get(b).push(a);
  }
  const local = (model) => {
    const pr = props70(model);
    const v = (k, d) => (pr.has(k) ? pr.get(k).map(Number) : d);
    return mul(translate(v('Lcl Translation', [0, 0, 0])), mul(rotate(v('PreRotation', [0, 0, 0])), mul(rotate(v('Lcl Rotation', [0, 0, 0])), scaleM(v('Lcl Scaling', [1, 1, 1])))));
  };
  const world = (id) => {
    const m = byId.get(id);
    if (!m || m.name !== 'Model') return ident();
    const parent = (parents.get(id) || []).find((q) => byId.get(q)?.name === 'Model');
    return parent !== undefined ? mul(world(parent), local(m)) : local(m);
  };
  // The file's up axis to y.
  const gs = props70(top.find((n) => n.name === 'GlobalSettings'));
  const upAxis = gs.has('UpAxis') ? gs.get('UpAxis')[0] : 1;
  const upSign = gs.has('UpAxisSign') ? gs.get('UpAxisSign')[0] : 1;
  const toY = upAxis === 2 ? (q) => [q[0], q[2] * upSign, -q[1] * upSign] : upAxis === 0 ? (q) => [-q[1], q[0] * upSign, q[2]] : (q) => [q[0], q[1] * upSign, q[2] * upSign];

  const tris = [];
  for (const geo of objects.children) {
    if (geo.name !== 'Geometry') continue;
    const verts = child(geo, 'Vertices')?.props[0];
    const index = child(geo, 'PolygonVertexIndex')?.props[0];
    if (!verts || !index) continue;
    const layer = child(geo, 'LayerElementMaterial');
    const mapping = layer ? child(layer, 'MappingInformationType')?.props[0] : 'AllSame';
    const mats = layer ? child(layer, 'Materials')?.props[0] || [0] : [0];
    for (const modelId of parents.get(geo.props[0]) || []) {
      const model = byId.get(modelId);
      if (!model || model.name !== 'Model') continue;
      const mp = props70(model);
      const gv = (k, d) => (mp.has(k) ? mp.get(k).map(Number) : d);
      const geom = mul(translate(gv('GeometricTranslation', [0, 0, 0])), mul(rotate(gv('GeometricRotation', [0, 0, 0])), scaleM(gv('GeometricScaling', [1, 1, 1]))));
      const m = mul(world(modelId), geom);
      const materials = (kids.get(modelId) || []).map((k) => byId.get(k)).filter((o) => o && o.name === 'Material');
      const nodeName = String(model.props[1]).split('\0')[0];
      let poly = [];
      let pi = 0;
      for (const raw of index) {
        poly.push(raw < 0 ? -raw - 1 : raw);
        if (raw >= 0) continue;
        const mi = mapping === 'AllSame' ? mats[0] : mats[pi] ?? 0;
        const mat = materials[mi];
        const mprops = props70(mat);
        const col = mprops.get('DiffuseColor') || mprops.get('Diffuse') || [0.8, 0.8, 0.8];
        const color = hex(col.map(Number));
        const at = (k) => toY(apply(m, [verts[k * 3], verts[k * 3 + 1], verts[k * 3 + 2]]));
        for (let k = 1; k + 1 < poly.length; k++) {
          tris.push({ p: [at(poly[0]), at(poly[k]), at(poly[k + 1])], color, node: nodeName, material: mat ? String(mat.props[1]).split('\0')[0] : '' });
        }
        poly = [];
        pi++;
      }
    }
  }
  return { tris, up: upAxis };
}
