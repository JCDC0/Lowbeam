/**
 * Authored data for Kurogane: the roads, gas stations, toll plazas, zones and the economy.
 * Coordinates are meters. North is -Z, east is +X. The map is 6 km square: a city on the
 * bay in the south, Route 1 (an expressway loop) around it, a mountain pass in the west,
 * a forest in the north. Pure data (plus the road generators), so tests and tools can read
 * it without a browser.
 */

import { Path } from './spline.js';
import { dualCarriageway, streetGrid, pathCrossing, diamond } from './roadgen.js';

export const SEED = 0x10eb3a;
export const WORLD_HALF = 3000;
export const WATER_LEVEL = 0;

/** Lakes: Kami-ike in the forest. */
export const LAKES = [{ id: 'kami', name: 'KAMI-IKE', x: 950, z: -1450, r: 190 }];
/** The bay: everything south of this line, between x = -SEA.xMax and SEA.xMax, is sea. */
export const SEA = { z: 2470, xMax: 2300 };

/** Downtown, where the buildings are tall and close. */
export const CITY = { x0: -850, x1: 850, z0: 740, z1: 1870 };

/**
 * @typedef {{ at: number[], height: number, half: number }} Bump
 * @typedef {{ at: number[], height: number, half: number, flat?: number }} Lift
 * @typedef {{ from?: number[], to?: number[], all?: boolean, every: number, side?: number, offset?: number }} LampRun
 * @typedef {{
 *   id: string, name: string, surface: string, hw: number, closed?: boolean,
 *   priority: number, smooth: number, lamps?: LampRun[],
 *   lines?: 'center' | 'lanes' | 'none', bumps?: Bump[], lifts?: Lift[], maxGrade?: number, points: number[][],
 *   cls?: 'expressway' | 'arterial' | 'street' | 'ramp' | 'mountain' | 'forest', lanes?: number, limit?: number,
 *   oneway?: boolean, median?: number, twin?: string,
 *   link?: { from: { id: string, s: number }, to: { id: string, s: number } },
 *   taper?: { from: number, to: number, s0: number, s1: number },
 *   gore?: { carriageId: string, carriageS: number, run: number, kind: 'exit' | 'entry', carriageHw?: number, rampHw?: number }
 * }} RoadDef
 */

/** Route 1: the centre line of the expressway, clockwise as seen on the map. */
const LOOP = [
  [-1450, -200], [-950, -330], [-300, -380], [350, -360], [1000, -290], [1550, -120], [1850, 250], [1950, 800],
  [1900, 1400], [1750, 1800], [1350, 2060], [800, 2150], [0, 2170], [-800, 2150], [-1350, 2060], [-1700, 1800],
  [-1850, 1400], [-1900, 850], [-1800, 350], [-1650, 0],
];
const loopCenter = new Path(LOOP, { closed: true, step: 2 });
const C1_HW = 5.6;
const C1_MEDIAN = 3.2;

/** @param {'x' | 'z'} axis @param {number} value @param {(p: { x: number, z: number }) => boolean} ok */
function onLoop(axis, value, ok) {
  const c = pathCrossing(loopCenter, axis, value, ok);
  return { x: c.x, z: c.z, s: c.s, yaw: Math.atan2(c.tx, c.tz) };
}

const crossNorth = onLoop('x', -300, (p) => p.z < 0);
const crossSouth = onLoop('x', 0, (p) => p.z > 1000);
const crossWest = onLoop('z', 1050, (p) => p.x < 0);
const crossEast = onLoop('z', 1150, (p) => p.x > 0);

const C1 = dualCarriageway(LOOP, {
  id: 'c1', name: 'ROUTE 1 EXPRESSWAY', surface: 'asphalt', hw: C1_HW, median: C1_MEDIAN, closed: true,
  priority: 3.2, smooth: 90, cls: 'expressway', lanes: 3, limit: 100, lines: 'lanes', maxGrade: 0.045,
});
C1[0].lamps = [{ all: true, every: 44, side: -1, offset: C1_HW + C1_MEDIAN / 2 }];

const ARTERIAL = {
  surface: 'asphalt', hw: 7, priority: 2.8, smooth: 90, cls: /** @type {const} */ ('arterial'), lanes: 4, limit: 60,
  lines: /** @type {const} */ ('center'), maxGrade: 0.055,
};
const LIFT = { height: 7.4, half: 230, flat: 60 };
const LIFT_SHORT = { height: 7.4, half: 190, flat: 60 };

/** @type {RoadDef[]} */
const R18 = [{
  ...ARTERIAL, id: 'r18', name: 'ROUTE 18', smooth: 140,
  lifts: [{ at: [crossNorth.x, crossNorth.z], ...LIFT }],
  lamps: [{ from: [0, 760], to: [-170, 300], every: 36 }],
  taper: { from: 4.6, to: 7, s0: 0, s1: 35 },
  points: [[0, 760], [0, 700], [-50, 620], [-180, 300], [-270, -80], [crossNorth.x, crossNorth.z], [-340, -700], [-280, -1000], [-100, -1300], [110, -1560], [140, -1830], [360, -1990], [650, -1960]],
}];

/** @type {RoadDef[]} */
const HARBOR = [{
  ...ARTERIAL, id: 'harbor', name: 'HARBOR AVE',
  lifts: [{ at: [crossSouth.x, crossSouth.z], ...LIFT_SHORT }],
  lamps: [{ from: [0, 1860], to: [0, 2000], every: 36 }],
  taper: { from: 4.6, to: 7, s0: 0, s1: 35 },
  points: [[0, 1860], [0, 2000], [crossSouth.x, crossSouth.z], [10, 2330], [30, 2440]],
}];

/** @type {RoadDef[]} */
const WEST = [{
  ...ARTERIAL, id: 'west', name: 'WEST AVE',
  lifts: [{ at: [crossWest.x, crossWest.z], ...LIFT }],
  lamps: [{ from: [-1500, 1130], to: [-700, 1200], every: 36 }],
  taper: { from: 7, to: 4.6, s0: 1890, s1: 1925 },
  points: [[-2300, 500], [-2200, 800], [crossWest.x, crossWest.z], [-1500, 1130], [-1100, 1180], [-700, 1200]],
}];

/** @type {RoadDef[]} */
const EAST = [{
  ...ARTERIAL, id: 'east', name: 'EAST AVE',
  lifts: [{ at: [crossEast.x, crossEast.z], ...LIFT }],
  lamps: [{ from: [700, 1200], to: [1500, 1160], every: 36 }],
  taper: { from: 4.6, to: 7, s0: 0, s1: 35 },
  points: [[700, 1200], [1100, 1170], [1500, 1150], [crossEast.x, crossEast.z], [2200, 1150], [2390, 1130]],
}];

/**
 * The way from the forest village along the northern ridge and down the western mountain:
 * [x, z, elevation]. The terrain is shaped around this ledge (see heightfield.js), so the
 * road climbs and falls the way it is drawn here.
 */
export const PASS_PROFILE = [
  [650, -1960, 62], [420, -2200, 80], [100, -2420, 105], [-350, -2560, 130], [-850, -2590, 160], [-1350, -2520, 190],
  [-1750, -2380, 220], [-2000, -2180, 245], [-2250, -2050, 255], [-2450, -1880, 250], [-2320, -1700, 235],
  [-2500, -1520, 215], [-2640, -1350, 190], [-2480, -1200, 170], [-2650, -1000, 140], [-2520, -820, 118],
  [-2650, -620, 95], [-2500, -420, 70], [-2420, -170, 48], [-2320, 150, 32], [-2300, 500, 24],
];

/** @type {RoadDef[]} */
const KURO = [{
  surface: 'asphalt', hw: 4.4, priority: 2.6, smooth: 45, cls: 'mountain', lanes: 2, limit: 50, lines: 'center', maxGrade: 0.085,
  id: 'kuro', name: 'KURO PASS',
  points: PASS_PROFILE.map((p) => [p[0], p[1]]),
}];

const CITY_STREET = {
  surface: 'asphalt', hw: 4.6, priority: 2.5, smooth: 20, cls: /** @type {const} */ ('street'), lanes: 2, limit: 40, lines: /** @type {const} */ ('center'),
};
const GRID_EW = [840, 960, 1080, 1200, 1320, 1440, 1560, 1680, 1800];
const GRID_NS = [-700, -560, -420, -280, -140, 0, 140, 280, 420, 560, 700];
const STREETS = streetGrid({ x0: -840, x1: 840, z0: 760, z1: 1860 }, GRID_EW, GRID_NS, { ...CITY_STREET, prefix: 'k', nsPriority: 2.6 });

/** Four ramps for each place an avenue passes over Route 1. */
const OVERPASSES = [
  { road: R18[0], cross: crossNorth, reach: 235 },
  { road: HARBOR[0], cross: crossSouth, reach: 200 },
  { road: WEST[0], cross: crossWest, reach: 235 },
  { road: EAST[0], cross: crossEast, reach: 235 },
];
const interchanges = OVERPASSES.flatMap(({ road, cross, reach }) =>
  diamond({
    id: `${road.id}-ramp`,
    arterial: new Path(road.points, { step: 2 }),
    cross: [cross.x, cross.z],
    fwd: new Path(C1[0].points, { closed: true, step: 2 }),
    rev: new Path(C1[1].points, { closed: true, step: 2 }),
    hw: 3.7,
    carriageHw: C1_HW,
    reach,
    ids: { arterial: road.id, fwd: 'c1-f', rev: 'c1-r' },
    base: { surface: 'asphalt', hw: 3.7, priority: 2.9, smooth: 80, maxGrade: 0.06, cls: 'ramp', lanes: 1, limit: 50, lines: 'none', name: 'ROUTE 1 RAMP' },
  })
);

/** @type {RoadDef[]} */
export const ROADS = [...C1, ...R18, ...HARBOR, ...WEST, ...EAST, ...KURO, ...STREETS, ...interchanges];

/**
 * Gas stations. Each one sits beside a road: `near` is projected onto the road to find
 * where it attaches, `side` says which side of the direction of travel it is on.
 * `w` runs along the road, `d` runs away from it.
 */
export const STATIONS = [
  { id: 'g1', name: 'KITSUNE OIL HARBOR', brand: 'kitsune', road: 'harbor', near: [0, 1940], side: 'right', w: 54, d: 36 },
  { id: 'g2', name: 'HOSHI GAS ROUTE 1 EAST', brand: 'hoshi', road: 'c1-f', near: [1960, 1000], side: 'left', w: 60, d: 40 },
  { id: 'g3', name: 'KITSUNE OIL MORI', brand: 'kitsune', road: 'r18', near: [231, -1926], side: 'right', w: 54, d: 36 },
  { id: 'g4', name: 'HOSHI GAS TOGE', brand: 'hoshi', road: 'kuro', near: [-2310, 330], side: 'right', w: 54, d: 36 },
];

/** Toll plazas on Route 1, across both carriageways at the given point of the center line. */
export const TOLLS = [
  { id: 'toll-n', name: 'KITA TOLL', ...onLoop('x', 450, (p) => p.z < 0), fee: 700 },
  { id: 'toll-e', name: 'HIGASHI TOLL', ...onLoop('z', 1800, (p) => p.x > 0), fee: 700 },
  { id: 'toll-s', name: 'MINATO TOLL', ...onLoop('x', -450, (p) => p.z > 1000), fee: 700 },
];

/**
 * Named places, for the area name, the ambience and where the trees thin out.
 * `kind` picks the habitat; a zone is a rectangle or a circle.
 * @typedef {{ id: string, name: string, kind: string, rect?: { x0: number, x1: number, z0: number, z1: number }, circle?: { x: number, z: number, r: number } }} Zone
 * @type {Zone[]}
 */
export const ZONES = [
  { id: 'city', name: 'KUROGANE CITY', kind: 'city', rect: CITY },
  { id: 'harbor', name: 'KUROGANE HARBOR', kind: 'harbor', rect: { x0: -1500, x1: 1500, z0: 2200, z1: 3000 } },
  { id: 'kami', name: 'KAMI-IKE', kind: 'lake', circle: { x: 950, z: -1450, r: 300 } },
  { id: 'forest', name: 'MORI FOREST', kind: 'forest', rect: { x0: -1100, x1: 1500, z0: -2350, z1: -560 } },
  { id: 'pass', name: 'KURO PASS', kind: 'mountain', rect: { x0: -3000, x1: -2000, z0: -2500, z1: 700 } },
];

/** The time attack on the pass. Distances are meters along the road. */
export const RALLY = {
  id: 'kuro',
  name: 'KURO PASS TIME ATTACK',
  road: 'kuro',
  startS: 400,
  finishEndOffset: 70,
  checkpoints: 4,
  medals: { gold: 92, silver: 78, bronze: 64 },
  prize: { finish: 6000, bronze: 9000, silver: 14000, gold: 22000 },
};

export const ECONOMY = {
  startMoney: 15000,
  fuelPrice: 168,
  towCost: 5000,
  resetPenalty: 5,
};

/** Back-compat names for code that has not moved to ZONES and LAKES yet. */
export const TOWN = CITY;
export const LAKE = LAKES[0];
