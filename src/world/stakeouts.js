/**
 * Where the undercover cars wait (B5). Pure: no three, no DOM. Each spot is a place an unmarked car
 * can park without blocking a lane, with a clear line to the road it watches: a lay-by on an
 * avenue or a coast road, a shoulder behind Route 1's rail, a corner by a toll plaza, the mouth of a
 * side street in the city, the foot of Kuro Pass. They were found by `tools/stakeoutsearch.mjs`:
 * on land, level with the road it watches (never under a deck or on a bank), 80 m from every police
 * station and 250 m from each other, the car's footprint clear of every lane and every static
 * shape, and a clear line to at least four of the six stretches of road it can see.
 *
 * `x` and `z` are the car's center, `yaw` the way its nose points (0 faces +Z, forward is
 * (sin yaw, cos yaw)), turned toward the road; `roads` are the ids of the roads it watches, to be
 * matched with a car's `lane.road.id`. The height comes from the ground (`placeStakeouts`).
 * @typedef {{ id: string, kind: 'layby' | 'route1' | 'toll' | 'mouth' | 'pass', name: string,
 *   x: number, z: number, yaw: number, roads: string[] }} Stakeout
 * @typedef {Stakeout & { y: number }} StakeoutSpot
 * @type {Stakeout[]}
 */
export const STAKEOUTS = [
  { id: 'route-18-lay-by-south', kind: 'layby', name: 'ROUTE 18 LAY-BY SOUTH', x: -321.2, z: -583, yaw: -2.02, roads: ['r18'] },
  { id: 'route-18-lay-by-north', kind: 'layby', name: 'ROUTE 18 LAY-BY NORTH', x: 191.2, z: -1627.6, yaw: -0.08, roads: ['r18'] },
  { id: 'harbor-ave-lay-by', kind: 'layby', name: 'HARBOR AVE LAY-BY', x: 22.1, z: 2336.4, yaw: -2.02, roads: ['harbor'] },
  { id: 'west-ave-lay-by', kind: 'layby', name: 'WEST AVE LAY-BY', x: -1599.6, z: 1151.9, yaw: 2.24, roads: ['west'] },
  { id: 'east-ave-lay-by', kind: 'layby', name: 'EAST AVE LAY-BY', x: 1594.5, z: 1144.4, yaw: -0.45, roads: ['east'] },
  { id: 'higashi-coast-road-lay-by-north', kind: 'layby', name: 'HIGASHI COAST ROAD LAY-BY NORTH', x: 2520.4, z: -404, yaw: 1.07, roads: ['higashi'] },
  { id: 'higashi-coast-road-lay-by-south', kind: 'layby', name: 'HIGASHI COAST ROAD LAY-BY SOUTH', x: 2481.2, z: 1795.3, yaw: 0.91, roads: ['higashi'] },
  { id: 'kita-coast-road-lay-by', kind: 'layby', name: 'KITA COAST ROAD LAY-BY', x: 1854.4, z: -2521.6, yaw: 2.6, roads: ['kita'] },
  { id: 'route-1-north-shoulder', kind: 'route1', name: 'ROUTE 1 NORTH SHOULDER', x: -756.9, z: -372.3, yaw: -0.49, roads: ['c1-f', 'c1-r'] },
  { id: 'route-1-east-shoulder', kind: 'route1', name: 'ROUTE 1 EAST SHOULDER', x: 1887.6, z: 296.9, yaw: -1.8, roads: ['c1-f', 'c1-r'] },
  { id: 'route-1-south-shoulder', kind: 'route1', name: 'ROUTE 1 SOUTH SHOULDER', x: -945.8, z: 2154.6, yaw: 2.47, roads: ['c1-f', 'c1-r'] },
  { id: 'route-1-west-shoulder', kind: 'route1', name: 'ROUTE 1 WEST SHOULDER', x: -1869.5, z: 538.6, yaw: 0.75, roads: ['c1-f', 'c1-r'] },
  { id: 'kita-toll-watch', kind: 'toll', name: 'KITA TOLL WATCH', x: 448.9, z: -336.2, yaw: 2.49, roads: ['c1-f', 'c1-r'] },
  { id: 'higashi-toll-watch', kind: 'toll', name: 'HIGASHI TOLL WATCH', x: 1763.2, z: 1810.6, yaw: -2.83, roads: ['c1-f', 'c1-r'] },
  { id: 'minato-toll-watch', kind: 'toll', name: 'MINATO TOLL WATCH', x: -160, z: 2153.1, yaw: -0.59, roads: ['c1-f', 'c1-r'] },
  { id: 'shinmachi-side-street', kind: 'mouth', name: 'SHINMACHI SIDE STREET', x: -719.4, z: 1140.9, yaw: -2.79, roads: ['naikan'] },
  { id: 'minatomachi-side-street', kind: 'mouth', name: 'MINATOMACHI SIDE STREET', x: 770.9, z: 1236.4, yaw: 1.45, roads: ['naikan'] },
  { id: 'kuro-pass-foot', kind: 'pass', name: 'KURO PASS FOOT', x: -2311.5, z: 148.5, yaw: -1.98, roads: ['kuro'] },
];

/**
 * The spots with the ground's height under each, for the world to hand to the drive.
 * @param {{ at(x: number, z: number): { h: number } }} ground
 * @returns {StakeoutSpot[]}
 */
export function placeStakeouts(ground) {
  return STAKEOUTS.map((s) => ({ ...s, y: ground.at(s.x, s.z).h }));
}
