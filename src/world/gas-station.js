/**
 * The three gas stations: canopy with a lit underside, pump islands, a kiosk with a lit
 * shop front and a tall brand sign by the road. The service park (G3) gets a small
 * canopy, rally tents, floodlights and two rival cars parked under the tents.
 * Built in pad-local coordinates: u along the road, v away from it.
 */

import * as THREE from 'three';
import { MeshBuilder } from '../render/builder.js';
import { psxBasic, psxLambert } from '../render/psx.js';
import { bakeGeometry } from '../render/bake.js';
import { brandTexture } from '../render/textures.js';
import { CarModel } from '../vehicles/models.js';
import { CARS } from '../vehicles/specs.js';
import { padPoint } from './scatter.js';

/** @typedef {[number, number, number]} V3 */

const BRAND = { kitsune: 0xe2561a, hoshi: 0x1f4fb8 };
const TENT = [0xc8202a, 0xe8e8e8, 0x1d4fb0];

/**
 * A transform whose local X runs along +u, Z along +v (away from the road) and Y up,
 * with the origin at the pad center on the pad surface. Returns the sign that turns u
 * into local x, since a right-handed frame forces X = Y x Z.
 * @param {import('./ground.js').Pad} pad
 */
function padFrame(pad) {
  const X = new THREE.Vector3(pad.vz, 0, -pad.vx);
  const Y = new THREE.Vector3(0, 1, 0);
  const Z = new THREE.Vector3(pad.vx, 0, pad.vz);
  const m = new THREE.Matrix4().makeBasis(X, Y, Z).setPosition(pad.cx, pad.h, pad.cz);
  return { m, su: Math.sign(pad.ux * X.x + pad.uz * X.z) || 1 };
}

/** Down-facing quad. x0 < x1, z0 < z1. */
function under(b, key, x0, x1, z0, z1, y) {
  b.quad(key, [x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1]);
}

/**
 * @param {ReturnType<typeof import('./scatter.js').scatterWorld>['stations'][number]} st
 * @param {import('../render/bake.js').LightGrid} grid
 */
function buildStation(st, grid) {
  const pad = st.pad;
  const L = st.layout;
  const brand = pad.station.brand;
  const { m, su } = padFrame(pad);
  const b = new MeshBuilder();
  b.pushMatrix(m);
  const U = (u) => u * su;

  const c = L.canopy;
  const cu0 = Math.min(U(c.u0), U(c.u1));
  const cu1 = Math.max(U(c.u0), U(c.u1));
  const cw = cu1 - cu0;
  const cd = c.v1 - c.v0;
  const cx = (cu0 + cu1) / 2;
  const cz = (c.v0 + c.v1) / 2;
  b.box('white', cx, c.h + 0.45, cz, cw, 0.9, cd);
  b.box('brand', cx, c.h + 0.45, cz, cw + 0.08, 0.32, cd + 0.08, { top: false });
  under(b, 'ceiling', cu0 + 0.05, cu1 - 0.05, c.v0 + 0.05, c.v1 - 0.05, c.h - 0.01);
  for (const l of st.canopyLights) under(b, 'light', U(l.u) - 0.9, U(l.u) + 0.9, l.v - 0.35, l.v + 0.35, c.h - 0.03);
  for (const p of st.pillars) b.box('steel', U(p.u), c.h / 2, p.v, 0.42, c.h, 0.42);
  for (const isl of L.islands) b.box('curb', U(isl.u), 0.12, isl.v, isl.len, 0.24, 1.4);
  for (const p of st.pumps) {
    b.box('white', U(p.u), 1.05, p.v, 0.75, 1.7, 0.55);
    b.box('brand', U(p.u), 1.65, p.v, 0.78, 0.35, 0.58);
    b.box('screen', U(p.u), 1.2, p.v, 0.4, 0.22, 0.6, { top: false });
  }

  const k = L.kiosk;
  const kx = U(k.u);
  b.box('white', kx, k.h / 2, k.v, k.w, k.h, k.d);
  b.box('brand', kx, k.h - 0.3, k.v, k.w + 0.1, 0.5, k.d + 0.1, { top: false });
  const fz = k.v - k.d / 2 - 0.02;
  b.quad('shop', [kx + k.w * 0.4, 0.2, fz], [kx - k.w * 0.4, 0.2, fz], [kx - k.w * 0.4, k.h - 0.7, fz], [kx + k.w * 0.4, k.h - 0.7, fz]);

  const sx = U(L.sign.u);
  const sz = L.sign.v;
  b.cylinder('steel', sx, 3.5, sz, 0.16, 7, 6, 'y', { caps: false });
  b.box('steel', sx, 8.6, sz, 1.6, 3.4, 0.36);
  const fx0 = sx - 0.7;
  const fx1 = sx + 0.7;
  b.quad('sign', [fx1, 7.0, sz - 0.19], [fx0, 7.0, sz - 0.19], [fx0, 10.2, sz - 0.19], [fx1, 10.2, sz - 0.19]);
  b.quad('sign', [fx0, 7.0, sz + 0.19], [fx1, 7.0, sz + 0.19], [fx1, 10.2, sz + 0.19], [fx0, 10.2, sz + 0.19]);

  L.tents.forEach((t, i) => {
    const tx = U(t.u);
    const hw = t.w / 2;
    const hd = t.d / 2;
    for (const [dx, dz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) b.box('steel', tx + dx * hw, 1.2, t.v + dz * hd, 0.08, 2.4, 0.08);
    b.setColor(TENT[i % TENT.length]);
    /** @type {V3} */
    const apex = [tx, 3.6, t.v];
    /** @type {V3[]} */
    const ring = [[tx - hw, 2.4, t.v - hd], [tx + hw, 2.4, t.v - hd], [tx + hw, 2.4, t.v + hd], [tx - hw, 2.4, t.v + hd]];
    for (let j = 0; j < 4; j++) {
      const p = ring[j];
      const q = ring[(j + 1) % 4];
      b.tri('tent', p, apex, q);
      b.tri('tent', q, apex, p);
    }
    b.setColor(0xffffff);
  });
  for (const f of L.floods) {
    const fx = U(f.u);
    b.cylinder('steel', fx, 4.5, f.v, 0.14, 9, 6, 'y', { caps: false });
    b.box('steel', fx, 9.1, f.v, 1.2, 0.5, 0.5);
    const dir = -Math.sign(f.v) || 1;
    b.quad('light', [fx - 0.5, 8.9, f.v + dir * 0.26], [fx + 0.5, 8.9, f.v + dir * 0.26], [fx + 0.5, 9.3, f.v + dir * 0.26], [fx - 0.5, 9.3, f.v + dir * 0.26]);
    b.quad('light', [fx + 0.5, 8.9, f.v + dir * 0.26], [fx - 0.5, 8.9, f.v + dir * 0.26], [fx - 0.5, 9.3, f.v + dir * 0.26], [fx + 0.5, 9.3, f.v + dir * 0.26]);
  }
  b.pop();

  const mesh = b.mesh({
    white: psxLambert({ color: 0xe6e6e2, baked: true }),
    brand: psxBasic({ color: BRAND[brand] }),
    light: psxBasic({ color: 0xf4f8ff }),
    ceiling: psxLambert({ color: 0x55585e, baked: true }),
    steel: psxLambert({ color: 0x8a8e94, baked: true }),
    curb: psxLambert({ color: 0xb8b2a0, baked: true }),
    screen: psxBasic({ color: 0x6aff8a }),
    shop: psxBasic({ color: 0xfff0d4 }),
    sign: psxBasic({ map: brandTexture(brand) }),
    tent: psxLambert({ vertexColors: true, baked: true, side: THREE.FrontSide }),
  });
  bakeGeometry(mesh.geometry, grid, { wrap: 0.8 });
  mesh.name = `station-${pad.id}`;
  return mesh;
}

/**
 * @param {ReturnType<typeof import('./scatter.js').scatterWorld>['stations']} stations
 * @param {import('../render/bake.js').LightGrid} grid
 */
export function buildStations(stations, grid) {
  const group = new THREE.Group();
  group.name = 'stations';
  for (const st of stations) {
    group.add(buildStation(st, grid));
    if (st.pad.station.servicePark) {
      st.layout.tents.slice(0, 2).forEach((t, i) => {
        const spec = CARS[(i + 1) % CARS.length];
        const car = new CarModel(spec, 2 + i, { light: 'baked' });
        const p = padPoint(st.pad, t.u, t.v);
        car.group.position.set(p.x, st.pad.h, p.z);
        car.group.rotation.y = st.yaw + Math.PI;
        car.bake(grid);
        group.add(car.group);
      });
    }
  }
  return group;
}
