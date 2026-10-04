/**
 * The concrete of overpasses and viaducts: the slab's side faces, its underside, the
 * parapets along both edges and the piers. The road surface itself is the normal ribbon
 * from build-roads.js; this adds what holds it up. Where the road sits on a low
 * embankment (a lift under about two meters) the side faces reach down to the ground, so
 * the approach ramps read as retaining walls.
 *
 * A dual carriageway on a viaduct (a road with a `median`, Route 1) is one deck: the forward
 * carriageway's slab runs on under the median to the far edge of the reverse one, the median is
 * decked over, and neither carriageway has a parapet or a slab face on its median side.
 */

import * as THREE from 'three';
import { MeshBuilder } from '../render/builder.js';
import { psxLambert } from '../render/psx.js';
import { bakeGeometry } from '../render/bake.js';
import { concreteTexture } from '../render/textures.js';
import { SKIRT, SINK, ELEVATED } from './roads.js';

/** Thickness of the slab under the road surface. */
const SLAB = 1.25;
const PARAPET_HEIGHT = 0.95;
const PARAPET_THICK = 0.45;

/**
 * @param {import('./scatter.js').Bridge[]} bridges
 * @param {import('./ground.js').Ground} ground
 * @param {import('../render/bake.js').LightGrid} grid
 */
export function buildBridges(bridges, ground, grid) {
  const group = new THREE.Group();
  group.name = 'bridges';
  if (!bridges.length) return group;
  const mat = psxLambert({ map: concreteTexture(), baked: true, side: THREE.DoubleSide });
  // The underside takes no light pools: they stand on the deck, so their light never reaches under it.
  const under = psxLambert({ map: concreteTexture(), color: 0x8a8a8a, side: THREE.DoubleSide });
  const b = new MeshBuilder();
  const below = (x, z) => ground.at(x, z).h;

  for (const br of bridges) {
    const road = br.road;
    const p = road.path;
    const hw = road.hw;
    const edge = hw + SKIRT;
    const lift = 0.012 * road.priority;
    const top = (i) => road.h[i] + lift;
    const at = (i, d, y) => [p.x[i] + p.tz[i] * d, y, p.z[i] - p.tx[i] * d];
    const groundAt = (i, d) => below(p.x[i] + p.tz[i] * d, p.z[i] - p.tx[i] * d);
    for (let i = br.i0; i < br.i1; i++) {
      const j = i + 1;
      const elevated = road.lift[i] > ELEVATED - 0.3 || road.lift[j] > ELEVATED - 0.3;
      const uA = (i * p.step) / 4;
      const uB = (j * p.step) / 4;
      const median = road.def.median || 0;
      const twin = median && road.def.id.endsWith('-f');
      const far = -(hw + median + hw + SKIRT);
      for (const side of [1, -1]) {
        if (side < 0 && median) {
          if (!twin) continue;
          const lowI = Math.max(groundAt(i, far) - 0.15, top(i) - SINK - SLAB);
          const lowJ = Math.max(groundAt(j, far) - 0.15, top(j) - SINK - SLAB);
          b.quad('c', at(j, far, lowJ), at(i, far, lowI), at(i, far, top(i) - SINK), at(j, far, top(j) - SINK), [uA, 0, uB, 1]);
          b.quad('c', at(i, -hw, top(i) - 0.02), at(j, -hw, top(j) - 0.02), at(j, -hw - median, top(j) - 0.02), at(i, -hw - median, top(i) - 0.02), [uA, 0, uB, 0.8]);
          continue;
        }
        const dEdge = side * edge;
        const lowI = Math.max(groundAt(i, dEdge) - 0.15, top(i) - SINK - SLAB);
        const lowJ = Math.max(groundAt(j, dEdge) - 0.15, top(j) - SINK - SLAB);
        b.quad('c', at(i, dEdge, lowI), at(j, dEdge, lowJ), at(j, dEdge, top(j) - SINK), at(i, dEdge, top(i) - SINK), [uA, 0, uB, 1]);
        const dOut = side * (hw + 0.05);
        const dIn = side * (hw + 0.05 - PARAPET_THICK);
        b.quad('c', at(i, dOut, top(i)), at(j, dOut, top(j)), at(j, dOut, top(j) + PARAPET_HEIGHT), at(i, dOut, top(i) + PARAPET_HEIGHT), [uA, 0, uB, 0.4]);
        b.quad('c', at(i, dIn, top(i)), at(j, dIn, top(j)), at(j, dIn, top(j) + PARAPET_HEIGHT), at(i, dIn, top(i) + PARAPET_HEIGHT), [uA, 0, uB, 0.4]);
        b.quad('c', at(i, dIn, top(i) + PARAPET_HEIGHT), at(j, dIn, top(j) + PARAPET_HEIGHT), at(j, dOut, top(j) + PARAPET_HEIGHT), at(i, dOut, top(i) + PARAPET_HEIGHT), [uA, 0, uB, 0.2]);
      }
      if (elevated && (!median || twin)) {
        const d0 = twin ? far : -edge;
        b.quad('u', at(i, d0, top(i) - SINK - SLAB), at(j, d0, top(j) - SINK - SLAB), at(j, edge, top(j) - SINK - SLAB), at(i, edge, top(i) - SINK - SLAB), [uA, 0, uB, 1]);
      }
    }
    for (const pier of br.piers) {
      const height = pier.top - SLAB - SINK - pier.bottom;
      if (height < 0.5) continue;
      b.cylinder('c', pier.x, pier.bottom + height / 2 - 0.2, pier.z, 0.75, height + 0.4, 8, 'y', { caps: false });
      b.push(pier.x, 0, pier.z, pier.yaw);
      b.box('c', 0, pier.top - SLAB - SINK - 0.3, 0, hw * 1.35, 0.6, 1.5);
      b.pop();
    }
  }
  if (b.isEmpty()) return group;
  const built = b.geometry(['c', 'u']);
  const geo = bakeGeometry(built.geometry, grid, { wrap: 0.6 });
  const mesh = new THREE.Mesh(geo, built.keys.map((k) => (k === 'u' ? under : mat)));
  mesh.name = 'bridge-concrete';
  group.add(mesh);
  return group;
}
