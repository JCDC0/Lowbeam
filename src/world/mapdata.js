/**
 * Everything a full-screen map needs, as plain data: the bounds, every road as a polyline
 * with its class, the points of interest and the named zones. Pure, so a map screen, the
 * minimap and tests all read the same thing. Built once from the ground and the layout.
 */

import { COAST, LAKES, SEA, STATIONS, TOLLS, WORLD_HALF, ZONES, RALLY } from './layout.js';

/**
 * @typedef {{ id: string, name: string, cls: string, surface: string, width: number, oneway: boolean,
 *   closed: boolean, points: number[][], lifted: number[][][] }} MapRoad
 * @typedef {{ kind: 'station' | 'toll' | 'start' | 'police' | 'garage' | 'hideout', id: string, name: string, x: number, z: number, brand?: string }} MapPoi
 */

/**
 * @param {import('./ground.js').Ground} ground
 * @param {{ step?: number }} [opts] meters between polyline points
 */
export function buildMapData(ground, { step = 24 } = {}) {
  /** @type {MapRoad[]} */
  const roads = ground.roads.roads.map((r) => {
    const p = r.path;
    const points = [];
    /** @type {number[][][]} */
    const lifted = [];
    let run = null;
    const every = Math.max(1, Math.round(step / p.step));
    const last = p.closed ? p.n : p.n - 1;
    for (let i = 0; i <= last; i += every) {
      const k = Math.min(i, last) % p.n;
      points.push([Math.round(p.x[k]), Math.round(p.z[k])]);
      const up = r.lift[k] > 2;
      if (up) {
        if (!run) lifted.push((run = []));
        run.push([Math.round(p.x[k]), Math.round(p.z[k])]);
      } else run = null;
    }
    return {
      id: r.id,
      name: r.name,
      cls: r.def.cls || 'street',
      surface: r.surface,
      width: r.hw * 2,
      oneway: !!r.def.oneway,
      closed: p.closed,
      points,
      lifted,
    };
  });

  /** @type {MapPoi[]} */
  const pois = [];
  for (const pad of ground.pads) pois.push({ kind: 'station', id: pad.id, name: pad.name, x: pad.cx, z: pad.cz, brand: pad.station.brand });
  for (const t of TOLLS) pois.push({ kind: 'toll', id: t.id, name: t.name, x: t.x, z: t.z });
  for (const pad of ground.lots) pois.push({ kind: pad.lot.kind, id: pad.lot.id, name: pad.lot.name, x: pad.cx, z: pad.cz });
  const kuro = ground.roads.byId.get(RALLY.road);
  if (kuro) {
    const q = kuro.path.sample(RALLY.startS);
    pois.push({ kind: 'start', id: RALLY.id, name: RALLY.name, x: q.x, z: q.z });
  }

  return {
    bounds: { half: WORLD_HALF },
    roads,
    pois,
    zones: ZONES.map((z) => ({ id: z.id, name: z.name, kind: z.kind, rect: z.rect || null, circle: z.circle || null })),
    water: { lakes: LAKES.map((l) => ({ ...l })), sea: { ...SEA }, coast: COAST.map((p) => [p[0], p[1]]) },
    stations: STATIONS.length,
  };
}
