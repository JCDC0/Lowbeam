/**
 * Authored data for Kurogane: the roads, gas stations, toll plazas, zones and the economy.
 * Coordinates are meters. North is -Z, east is +X. The map is 6 km square: a city on the
 * bay in the south, Route 1 (an expressway loop) around it, a mountain pass in the west,
 * a forest in the north. Pure data (plus the road generators), so tests and tools can read
 * it without a browser.
 */

import { Path } from './spline.js';
import { dualCarriageway, pathCrossing, diamond } from './roadgen.js';
import { cityStreets, pathPolygon, polygonMask } from './citygen.js';
import { inland } from './island.js';
import { slipRamp, slipMeta, heading, biarc } from './merge.js';

export const SEED = 0x10eb3a;
export const WORLD_HALF = 3000;
export const WATER_LEVEL = 0;

export { COAST } from './island.js';

/** Lakes: Kami-ike in the forest. */
export const LAKES = [{ id: 'kami', name: 'KAMI-IKE', x: 950, z: -1450, r: 190 }];
/** The bay: everything south of this line, between x = -SEA.xMax and SEA.xMax, is sea. */
export const SEA = { z: 2470, xMax: 2300 };

export const CITY = { x0: -1280, x1: 1280, z0: 520, z1: 2020 };

/**
 * @typedef {{ at: number[], height: number, half: number }} Bump
 * @typedef {{ at: number[], height: number, half: number, flat?: number, floor?: number }} Lift
 * @typedef {{ from?: number[], to?: number[], all?: boolean, every: number, side?: number, offset?: number }} LampRun
 * @typedef {{
 *   id: string, name: string, surface: string, hw: number, closed?: boolean,
 *   priority: number, smooth: number, lamps?: LampRun[],
 *   lines?: 'center' | 'lanes' | 'none', bumps?: Bump[], lifts?: Lift[], maxGrade?: number, points: number[][],
 *   cls?: 'expressway' | 'arterial' | 'street' | 'ramp' | 'mountain' | 'forest', lanes?: number, limit?: number,
 *   oneway?: boolean, median?: number, twin?: string,
 *   link?: { from: { id: string, s: number }, to: { id: string, s: number } },
 *   taper?: { from: number, to: number, s0: number, s1: number },
 *   slip?: import('./merge.js').SlipMeta, walk?: number, widen?: Widen[]
 * }} RoadDef
 * @typedef {{ x: number, z: number, by: number }} Widen a stretch around (x, z) where the road is
 *   `by` meters wider on its left (`Road.shiftAt`): a carriageway opening out to a toll plaza
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
/**
 * Where Route 1 rides on a viaduct 12 m up, like the Shuto Expressway: across the north-east corner
 * between KITA TOLL and the Route 1 east gas station (about 1.5 km, 0.6 km of it at full height), and
 * across the north-west corner between the West Ave and Route 18 interchanges (about 1.5 km). Both
 * stretches are clear of slip roads, plazas and crossings, so no ramp has to climb with them, and
 * the climbs stay under 4.5 %. Both carriageways share one deck: the median is decked over and keeps
 * its barrier and lamps (scatter.js, build-bridges.js).
 */
const C1_VIADUCTS = [
  { at: [1360, -215], height: 12, half: 760, flat: 640 },
  { at: [-1544, -141], height: 12, half: 740, flat: 640 },
];
C1[0].lifts = C1_VIADUCTS;
C1[1].lifts = C1_VIADUCTS;

/**
 * Route 2, the Bayshore Line: two lanes each way along the bay between the loop's south
 * corners, joined to Route 1 at both ends (see BAYSHORE_JCT below).
 */
const C2_POINTS = [[-850, 2420], [-500, 2420], [0, 2420], [500, 2420], [800, 2420]];
const c2Center = new Path(C2_POINTS, { closed: false, step: 2 });
const crossC2Toll = pathCrossing(c2Center, 'x', 450);
const C2_HW = 3.7;

const C2 = dualCarriageway(C2_POINTS, {
  id: 'c2', name: 'BAYSHORE LINE', surface: 'asphalt', hw: C2_HW, median: C1_MEDIAN, closed: false,
  priority: 3.2, smooth: 90, cls: 'expressway', lanes: 2, limit: 100, lines: 'lanes', maxGrade: 0.055,
  lifts: [{ at: [26.4, 2420], height: 7.4, half: 230, flat: 60 }],
});
C2[0].lamps = [{ all: true, every: 44, side: -1, offset: C2_HW + C1_MEDIAN / 2 }];


const ARTERIAL = {
  surface: 'asphalt', hw: 7, priority: 2.8, smooth: 90, cls: /** @type {const} */ ('arterial'), lanes: 4, limit: 60,
  lines: /** @type {const} */ ('center'), maxGrade: 0.055,
};
const LIFT = { height: 7.4, half: 230, flat: 60 };
const LIFT_SHORT = { height: 7.4, half: 190, flat: 60 };

/**
 * The north coast road: from the north-east cape, where it meets the east coast road, west along
 * the shore and round the north side of Kami-ike into the forest village, where it runs straight on
 * into Kuro Pass (its last segment lines up with the pass's first, so the join has no kink).
 * Route 18 meets it at a T just east of the village.
 */
const KITA_POINTS = [[2280, -2330], [2140, -2470], [1850, -2530], [1500, -2420], [1250, -2130], [1010, -1880], [800, -1830], [650, -1960]];
const kitaPath = new Path(KITA_POINTS, { step: 2 });
/**
 * The east coast road: from the port in the south-east up the coast past the industrial district
 * to the cape, where it runs on into the north coast road. East Ave ends on it at a T.
 */
const HIGASHI_POINTS = [
  [2250, 2380], [2420, 2150], [2490, 1800], [2480, 1450], [2470, 1130], [2510, 700], [2560, 200], [2530, -400],
  [2460, -1000], [2480, -1600], [2440, -2000], [2386, -2224], [2280, -2330],
];
const higashiPath = new Path(HIGASHI_POINTS, { step: 2 });
/** Where a road that ends on another's side meets it: the nearest point of that road's centre line. @param {Path} path @param {number} x @param {number} z */
function tee(path, x, z) {
  const q = path.sample(path.nearest(x, z).s);
  return [q.x, q.z];
}

const COUNTRY = {
  surface: 'asphalt', hw: 4.4, priority: 2.85, smooth: 45, lanes: 2, limit: 60, lines: /** @type {const} */ ('center'), maxGrade: 0.085,
};
/** @type {RoadDef[]} */
const KITA = [{ ...COUNTRY, id: 'kita', name: 'KITA COAST ROAD', cls: 'arterial', points: KITA_POINTS }];
/** @type {RoadDef[]} */
const HIGASHI = [{ ...COUNTRY, id: 'higashi', name: 'HIGASHI COAST ROAD', cls: 'arterial', hw: 5, lanes: 2, points: HIGASHI_POINTS }];

/** @type {RoadDef[]} */
const R18 = [{
  ...ARTERIAL, id: 'r18', name: 'ROUTE 18', smooth: 140,
  lifts: [{ at: [crossNorth.x, crossNorth.z], ...LIFT }],
  lamps: [{ from: [0, 760], to: [-170, 300], every: 36 }],
  points: [[0, 760], [0, 700], [-50, 620], [-180, 300], [-270, -80], [crossNorth.x, crossNorth.z], [-340, -700], [-280, -1000], [-100, -1300], [110, -1560], [380, -1700], [620, -1770], tee(kitaPath, 860, -1830)],
}];

/** @type {RoadDef[]} */
const HARBOR = [{
  ...ARTERIAL, id: 'harbor', name: 'HARBOR AVE',
  lifts: [{ at: [crossSouth.x, crossSouth.z], ...LIFT_SHORT }],
  lamps: [{ from: [0, 1860], to: [0, 2000], every: 36 }],
  points: [[0, 1860], [0, 2000], [crossSouth.x, crossSouth.z], [10, 2330], [30, 2440]],
}];

const WEST_POINTS = [[-2300, 500], [-2200, 800], [crossWest.x, crossWest.z], [-1600, 1140], [-1430, 1197], [-1330, 1200]];

/** @type {RoadDef[]} */
const WEST = [{
  ...ARTERIAL, id: 'west', name: 'WEST AVE',
  lifts: [{ at: [crossWest.x, crossWest.z], ...LIFT }],
  lamps: [{ from: [-1600, 1140], to: [-1330, 1200], every: 36 }],
  points: WEST_POINTS,
}];

/** @type {RoadDef[]} */
const EAST = [{
  ...ARTERIAL, id: 'east', name: 'EAST AVE',
  lifts: [{ at: [crossEast.x, crossEast.z], ...LIFT }],
  lamps: [{ from: [1330, 1200], to: [1600, 1150], every: 36 }],
  points: [[1330, 1200], [1430, 1197], [1600, 1155], [crossEast.x, crossEast.z], [2200, 1150], tee(higashiPath, 2470, 1135)],
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

/**
 * The Bayshore junctions at the loop's south corners. Westbound, the Bayshore is a branch of
 * Route 1's outer carriageway: it leaves it at the south-east corner and rejoins it at the
 * south-west one, never crossing the loop. Eastbound traffic is on the inner carriageway, so
 * those two ramps fly over Route 1. Every ramp meets Route 1 as a slip road (merge.js) and
 * meets the Bayshore end to end, at the same width.
 * @returns {RoadDef[]}
 */
function bayshoreJunctions() {
  const C1F = new Path(C1[0].points, { closed: true, step: 2 });
  const C1R = new Path(C1[1].points, { closed: true, step: 2 });
  const south = (p) => p.z > 1500;
  const at = (C, x) => pathCrossing(C, 'x', x, south).s;
  const fStart = C2[0].points[0];
  const fEnd = C2[0].points[C2[0].points.length - 1];
  const rStart = C2[1].points[0];
  const rEnd = C2[1].points[C2[1].points.length - 1];
  /**
   * Where a ramp passes over the loop: straight across it (out of the loop or into it), turned
   * by `skew` radians toward the loop's direction of travel so the ramp's curves stay wide.
   */
  const over = (x, out, skew) => {
    const c = pathCrossing(loopCenter, 'x', x, south);
    const k = out ? 1 : -1;
    const n = [k * c.tz, -k * c.tx];
    const t = [-c.tx, -c.tz];
    const dir = [n[0] * Math.cos(skew) + t[0] * Math.sin(skew), n[1] * Math.cos(skew) + t[1] * Math.sin(skew)];
    return { p: [c.x, c.z], dir };
  };
  const base = {
    surface: 'asphalt', hw: C2_HW, priority: 2.9, smooth: 80, maxGrade: 0.06, cls: /** @type {const} */ ('ramp'),
    lanes: 2, limit: 70, lines: /** @type {const} */ ('lanes'), name: 'BAYSHORE JCT', oneway: true,
  };
  const lift = (p) => [{ at: p, height: 7.4, half: 200, flat: 50 }];
  const slip = (C, id, opts) => ({ C, id, opts: /** @type {import('./merge.js').SlipOptions} */ ({ carriageHw: C1_HW, hw: C2_HW, ...opts }) });
  /** @type {RoadDef[]} */
  const out = [];

  // West: inner carriageway out over the loop onto the eastbound Bayshore.
  {
    const s = slip(C1R, 'c1-r', { kind: 'exit', nose: at(C1R, -1450) });
    const pts = slipRamp(s.C, s.opts);
    const end = pts[pts.length - 1];
    const x = over(-1000, true, 0.5);
    const points = [...pts, ...biarc(end, heading(pts[pts.length - 2], end), x.p, x.dir), ...biarc(x.p, x.dir, fStart, [1, 0])];
    const m = slipMeta(points, s.C, s.id, s.opts);
    out.push({ ...base, id: 'bay-ramp-wf', points, lifts: lift(x.p), taper: m.taper, slip: m.slip,
      link: { from: { id: s.id, s: m.slip.attach[0] }, to: { id: 'c2-f', s: 0 } } });
  }
  // West: the westbound Bayshore merges into the outer carriageway at the corner.
  {
    const s = slip(C1F, 'c1-f', { kind: 'entry', nose: at(C1F, -1500) });
    const pts = slipRamp(s.C, s.opts);
    const points = [rEnd, ...biarc(rEnd, [-1, 0], pts[0], heading(pts[0], pts[1])).slice(0, -1), ...pts];
    const m = slipMeta(points, s.C, s.id, s.opts);
    out.push({ ...base, id: 'bay-ramp-wr', points, taper: m.taper, slip: m.slip,
      link: { from: { id: 'c2-r', s: new Path(C2[1].points, { step: 2 }).length }, to: { id: s.id, s: m.slip.attach[1] } } });
  }
  // East: the eastbound Bayshore climbs over the loop and merges into the inner carriageway.
  {
    const s = slip(C1R, 'c1-r', { kind: 'entry', nose: at(C1R, 1400) });
    const pts = slipRamp(s.C, s.opts);
    const x = over(950, false, 0.5);
    const points = [fEnd, ...biarc(fEnd, [1, 0], x.p, x.dir), ...biarc(x.p, x.dir, pts[0], heading(pts[0], pts[1])).slice(0, -1), ...pts];
    const m = slipMeta(points, s.C, s.id, s.opts);
    out.push({ ...base, id: 'bay-ramp-ef', points, lifts: lift(x.p), taper: m.taper, slip: m.slip,
      link: { from: { id: 'c2-f', s: new Path(C2[0].points, { step: 2 }).length }, to: { id: s.id, s: m.slip.attach[1] } } });
  }
  // East: the outer carriageway branches off down to the westbound Bayshore.
  {
    const s = slip(C1F, 'c1-f', { kind: 'exit', nose: at(C1F, 1250) });
    const pts = slipRamp(s.C, s.opts);
    const end = pts[pts.length - 1];
    const points = [...pts, ...biarc(end, heading(pts[pts.length - 2], end), rStart, [-1, 0])];
    const m = slipMeta(points, s.C, s.id, s.opts);
    out.push({ ...base, id: 'bay-ramp-er', points, taper: m.taper, slip: m.slip,
      link: { from: { id: s.id, s: m.slip.attach[0] }, to: { id: 'c2-r', s: 0 } } });
  }
  return out;
}
const BAYSHORE_JCT = bayshoreJunctions();

/**
 * Kurogane City. The frame roads are authored: Chuo-dori, the boulevard from Route 18 to Harbor
 * Ave; Kurogane-dori, across town from West Ave to East Ave; the inner ring (Naikan) round
 * downtown and the outer ring (Sotokan) round the midtown districts. Every district between them
 * fills with its own streets (citygen.js): downtown nearly square and dense, the midtown districts
 * turned and bent, the residential districts out to the expressway narrow and crooked.
 */
const CITY_ARTERIAL = { ...ARTERIAL, lamps: undefined, walk: 3 };
const CHUO_POINTS = [[0, 760], [25, 980], [-15, 1250], [20, 1520], [0, 1860]];
const DORI_POINTS = [[-1330, 1200], [-1000, 1180], [-500, 1235], [-15, 1250], [480, 1190], [1000, 1230], [1330, 1200]];
const NAIKAN = { x: 0, z: 1290, rx: 800, rz: 410 };
const NAIKAN_POINTS = Array.from({ length: 32 }, (_, i) => {
  const a = (i / 32) * Math.PI * 2;
  return [Math.round(NAIKAN.x + Math.sin(a) * NAIKAN.rx), Math.round(NAIKAN.z - Math.cos(a) * NAIKAN.rz)];
});
const SOTOKAN_POINTS = [
  [-1560, 1250], [-1580, 700], [-1480, 420], [-1250, 300], [-700, 280], [-190, 320], [400, 310], [1000, 300], [1400, 420],
  [1590, 700], [1600, 1250], [1560, 1600], [1380, 1840], [900, 1905], [0, 1900], [-900, 1905], [-1380, 1840], [-1540, 1600],
];
const lampsAll = (every) => [{ all: true, every }];
/** @type {RoadDef[]} */
const CITY_FRAME = [
  { ...CITY_ARTERIAL, id: 'chuo', name: 'CHUO-DORI', points: CHUO_POINTS, lamps: lampsAll(34) },
  { ...CITY_ARTERIAL, id: 'dori', name: 'KUROGANE-DORI', priority: 2.78, points: DORI_POINTS, lamps: lampsAll(34) },
  { ...CITY_ARTERIAL, id: 'naikan', name: 'NAIKAN RING', hw: 6.2, priority: 2.74, closed: true, points: NAIKAN_POINTS, lamps: lampsAll(36) },
  { ...CITY_ARTERIAL, id: 'sotokan', name: 'SOTOKAN RING', hw: 6.2, priority: 2.72, closed: true, points: SOTOKAN_POINTS, lamps: lampsAll(38) },
];

/**
 * The Kurogane Line, the city's second layer after the Shuto Expressway: a two-lane-each-way
 * elevated road 12 m up. It leaves the inner carriageway of Route 1 on the south side west of the
 * Harbor interchange, climbs north over the port streets and the outer ring, turns east onto
 * Kurogane-dori and runs above the avenue's middle across downtown, then turns south and comes back
 * to Route 1 east of the Harbor interchange. Both ends are junctions on the inner carriageway, which
 * has its exits and entries on the city side, so no ramp has to cross the loop: an exit and an entry
 * 550 m apart, each ramp turning a quarter circle and climbing to 6 m where it meets the line, whose
 * own deck eases from 6 m at its ends to 12 m. Everything under it stays on the ground: the avenue,
 * the streets that pass beneath, its piers (portal frames on the avenue's sidewalks).
 * @returns {{ roads: RoadDef[], ramps: RoadDef[] }}
 */
function kuroganeLine() {
  const C1R = new Path(C1[1].points, { closed: true, step: 2 });
  const dori = new Path(DORI_POINTS, { step: 2 });
  /** Radius of the ramps' quarter turn, and of the line's bends onto the avenue. */
  const TURN = 90;
  const BEND = 260;
  const RAMP_LIFT = 6;
  const half = C3_HW + C1_MEDIAN / 2;
  /** @param {'exit' | 'entry'} kind @param {number} nose @returns {import('./merge.js').SlipOptions} */
  const slipAt = (kind, nose) => ({ kind, nose, carriageHw: C1_HW, hw: C3_HW });
  /** Where an exit from the inner carriageway at `nose` heads north after a quarter turn to the left. */
  const turnedNorth = (nose) => {
    const pts = slipRamp(C1R, slipAt('exit', nose));
    const e = pts[pts.length - 1];
    const f = heading(pts[pts.length - 2], e);
    return [e[0] + TURN * (f[0] + f[1]), e[1] + TURN * (f[1] - f[0])];
  };
  const NOSE = { swExit: 2700, swEntry: 3250, seExit: 4520, seEntry: 5070 };
  const swF = turnedNorth(NOSE.swExit);
  const seR = turnedNorth(NOSE.seExit);
  const start = [swF[0] + half, swF[1]];
  const end = [seR[0] + half, seR[1]];
  const onDori = (x) => {
    const c = pathCrossing(dori, 'x', x);
    return { p: [c.x, c.z], t: [c.tx, c.tz], s: c.s };
  };
  const dw = onDori(start[0] + BEND);
  const de = onDori(end[0] - BEND);
  const kw = [start[0], dw.p[1] + BEND];
  const ke = [end[0], de.p[1] + BEND];
  /** @param {number[]} a @param {number[]} b */
  const straight = (a, b) => {
    const n = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / 40));
    return Array.from({ length: n }, (_, i) => [a[0] + ((b[0] - a[0]) * (i + 1)) / n, a[1] + ((b[1] - a[1]) * (i + 1)) / n]);
  };
  const along = [];
  for (let s = dw.s + 30; s < de.s - 15; s += 30) {
    const q = dori.sample(s);
    along.push([q.x, q.z]);
  }
  const center = [
    start, ...straight(start, kw),
    ...biarc(kw, [0, -1], dw.p, dw.t, 12),
    ...along,
    de.p, ...biarc(de.p, de.t, ke, [0, 1], 12),
    ...straight(ke, end),
  ];
  const path = new Path(center, { step: 2 });
  const mid = path.sample(path.length / 2);
  const C3 = dualCarriageway(center, {
    id: 'c3', name: 'KUROGANE LINE', surface: 'asphalt', hw: C3_HW, median: C1_MEDIAN, closed: false,
    // Just under Kurogane-dori's priority: the line takes the avenue's profile and rides 12 m over it.
    priority: 2.76, smooth: 90, cls: 'expressway', lanes: 2, limit: 80, lines: 'lanes', maxGrade: 0.06,
    lifts: [{ at: [mid.x, mid.z], height: 12, floor: RAMP_LIFT, flat: path.length - 460, half: path.length / 2 - 12 }],
  });
  C3[0].lamps = [{ all: true, every: 44, side: -1, offset: C3_HW + C1_MEDIAN / 2 }];
  const [fwd, rev] = C3;
  const fLen = new Path(fwd.points, { step: 2 }).length;
  const rLen = new Path(rev.points, { step: 2 }).length;
  const base = {
    surface: 'asphalt', hw: C3_HW, priority: 2.9, smooth: 80, maxGrade: 0.06, cls: /** @type {const} */ ('ramp'),
    lanes: 2, limit: 60, lines: /** @type {const} */ ('lanes'), name: 'KUROGANE JCT', oneway: true,
  };
  /** @param {number[]} p */
  const lift = (p) => [{ at: p, height: RAMP_LIFT, flat: 40, half: 220 }];
  /** @type {RoadDef[]} */
  const ramps = [];
  /** An exit from the inner carriageway at `nose` up to the start of `road`. */
  const exit = (id, nose, road) => {
    const o = slipAt('exit', nose);
    const pts = slipRamp(C1R, o);
    const e = pts[pts.length - 1];
    const to = road.points[0];
    const points = [...pts, ...biarc(e, heading(pts[pts.length - 2], e), to, heading(to, road.points[1]))];
    const m = slipMeta(points, C1R, 'c1-r', o);
    ramps.push({ ...base, id, points, lifts: lift(to), taper: m.taper, slip: m.slip,
      link: { from: { id: 'c1-r', s: m.slip.attach[0] }, to: { id: road.id, s: 0 } } });
  };
  /** An entry from the end of `road` down into the inner carriageway at `nose`. */
  const entry = (id, nose, road, len) => {
    const o = slipAt('entry', nose);
    const pts = slipRamp(C1R, o);
    const from = road.points[road.points.length - 1];
    const t = heading(road.points[road.points.length - 2], from);
    const points = [from, ...biarc(from, t, pts[0], heading(pts[0], pts[1])).slice(0, -1), ...pts];
    const m = slipMeta(points, C1R, 'c1-r', o);
    ramps.push({ ...base, id, points, lifts: lift(from), taper: m.taper, slip: m.slip,
      link: { from: { id: road.id, s: len }, to: { id: 'c1-r', s: m.slip.attach[1] } } });
  };
  exit('c3-ramp-wx', NOSE.swExit, fwd);
  entry('c3-ramp-wn', NOSE.swEntry, rev, rLen);
  exit('c3-ramp-ex', NOSE.seExit, rev);
  entry('c3-ramp-en', NOSE.seEntry, fwd, fLen);
  return { roads: C3, ramps };
}
const C3_HW = 3.7;
const KUROGANE_LINE = kuroganeLine();

/** @param {RoadDef} def @returns {(s: number) => boolean} where a street may cross it: not on a lift */
function crossable(def) {
  const path = new Path(def.points, { closed: !!def.closed, step: 2 });
  const spans = (def.lifts || []).map((l) => [path.nearest(l.at[0], l.at[1]).s, l.half + 20]);
  return (s) => spans.every(([c, h]) => Math.abs(s - c) > h);
}
const inLoop = polygonMask(pathPolygon(loopCenter));
const inSoto = polygonMask(pathPolygon(new Path(SOTOKAN_POINTS, { closed: true, step: 4 })));
const inNaikan = (x, z, m) => ((x - NAIKAN.x) / (NAIKAN.rx + m)) ** 2 + ((z - NAIKAN.z) / (NAIKAN.rz + m)) ** 2 < 1;
/**
 * Landmark lots, modeled in Blender (tools/blender/, assets/models/): the police headquarters on
 * Hanazaki Cape, the tuning garages, the old warehouses where a car can hide. Each is a flat paved
 * lot beside a road like a gas station's forecourt (`road`, `near`, `side`, `w` along the road, `d`
 * away from it), with the model's front on the road. The street generator keeps clear of them.
 * `sign` is the text painted on the model's sign. Logic for them (the police, the helicopter,
 * hiding) comes later and finds them here. The headquarters comes first: the code that wants "the
 * police HQ" takes the first police lot. The two district stations (0.9.88) have their own model,
 * `police_station` (G7, 0.10.50), 36 by 28 m with a helipad on the roof.
 * Every lot was placed with a search that keeps it on land, flat and 14 m clear of every street the
 * city generator lays, so adding one does not move a single street.
 * @typedef {{ id: string, kind: 'police' | 'garage' | 'hideout', model: string, name: string, sign?: string,
 *   road: string, near: number[], side: 'left' | 'right', w: number, d: number }} Lot
 * @type {Lot[]}
 */
export const LOTS = [
  { id: 'police', kind: 'police', model: 'police_hq', name: 'KUROGANE POLICE HQ', sign: 'KUROGANE POLICE', road: 'higashi', near: [2400, -2150], side: 'right', w: 140, d: 110 },
  { id: 'garage-tsurugi', kind: 'garage', model: 'garage', name: 'TSURUGI WORKS', sign: 'TSURUGI WORKS', road: 'higashi', near: [2480, 1600], side: 'left', w: 34, d: 32 },
  { id: 'garage-koga', kind: 'garage', model: 'garage', name: 'KOGA SPEED', sign: 'KOGA SPEED', road: 'higashi', near: [2520, -300], side: 'right', w: 34, d: 32 },
  { id: 'garage-hoshi', kind: 'garage', model: 'garage', name: 'HOSHI AUTO', sign: 'HOSHI AUTO', road: 'west', near: [-2120, 870], side: 'left', w: 34, d: 32 },
  { id: 'hideout-futo', kind: 'hideout', model: 'hideout', name: 'FUTO WAREHOUSE', road: 'higashi', near: [2430, 2120], side: 'right', w: 48, d: 40 },
  { id: 'hideout-kita', kind: 'hideout', model: 'hideout', name: 'KITA WAREHOUSE', road: 'kita', near: [1650, -2470], side: 'right', w: 48, d: 40 },
  { id: 'hideout-nishi', kind: 'hideout', model: 'hideout', name: 'NISHI WAREHOUSE', road: 'west', near: [-2240, 640], side: 'right', w: 48, d: 40 },
  { id: 'police-kita', kind: 'police', model: 'police_station', name: 'KITAMACHI POLICE STATION', sign: 'KITAMACHI POLICE', road: 'r18', near: [-321, -862], side: 'right', w: 36, d: 28 },
  { id: 'police-toge', kind: 'police', model: 'police_station', name: 'KURO PASS POLICE STATION', sign: 'TOGE POLICE', road: 'kuro', near: [-2258, -2045], side: 'left', w: 36, d: 28 },
  { id: 'garage-sakura', kind: 'garage', model: 'garage', name: 'SAKURA MOTORS', sign: 'SAKURA MOTORS', road: 'west', near: [-1395, 1200], side: 'right', w: 34, d: 32 },
  { id: 'garage-mori', kind: 'garage', model: 'garage', name: 'MORI TUNING', sign: 'MORI TUNING', road: 'r18', near: [557, -1754], side: 'right', w: 34, d: 32 },
  { id: 'hideout-kawa', kind: 'hideout', model: 'hideout', name: 'KAWA YARD', road: 'east', near: [2244, 1148], side: 'left', w: 48, d: 40 },
  { id: 'hideout-mine', kind: 'hideout', model: 'hideout', name: 'MINE SHED', road: 'kuro', near: [47, -2444], side: 'right', w: 48, d: 40 },
  { id: 'police-ginza', kind: 'police', model: 'police_station', name: 'GINZA POLICE STATION', sign: 'GINZA POLICE', road: 'chuo', near: [15, 1064], side: 'left', w: 36, d: 28 },
  { id: 'police-shin', kind: 'police', model: 'police_station', name: 'SHINMACHI POLICE STATION', sign: 'SHINMACHI POLICE', road: 'dori', near: [-941, 1183], side: 'left', w: 36, d: 28 },
  { id: 'police-minato', kind: 'police', model: 'police_station', name: 'MINATOMACHI POLICE STATION', sign: 'MINATO POLICE', road: 'naikan', near: [499, 969], side: 'right', w: 36, d: 28 },
  { id: 'police-kitae', kind: 'police', model: 'police_station', name: 'HIGASHIMACHI POLICE STATION', sign: 'HIGASHI POLICE', road: 'sotokan', near: [870, 291], side: 'right', w: 36, d: 28 },
  { id: 'police-hama', kind: 'police', model: 'police_station', name: 'HAMACHO POLICE STATION', sign: 'HAMACHO POLICE', road: 'sotokan', near: [48, 1900], side: 'left', w: 36, d: 28 },
  { id: 'police-kogyo', kind: 'police', model: 'police_station', name: 'HIGASHI KOGYO POLICE STATION', sign: 'KOGYO POLICE', road: 'higashi', near: [2541, 440], side: 'left', w: 36, d: 28 },
  { id: 'police-nishi', kind: 'police', model: 'police_station', name: 'NISHIMACHI POLICE STATION', sign: 'NISHIMACHI POLICE', road: 'west', near: [-2029, 967], side: 'right', w: 36, d: 28 },
];
const lotDefs = [...HIGASHI, ...KITA, ...WEST, ...R18, ...EAST, ...KURO, ...HARBOR, ...CITY_FRAME];
/** The roads a lot may front: the avenues, the coast roads, the pass and the city's frame. */
export const LOT_ROADS = lotDefs.map((d) => d.id);
/** How far a lot keeps from every generated street, meters, so that the streets do not move for it. */
export const LOT_MARGIN = 14;
/** The rectangle of a lot, the same way ground.js makes its pad. @param {Lot} lot */
function lotRect(lot) {
  const def = /** @type {RoadDef} */ (lotDefs.find((d) => d.id === lot.road));
  const path = new Path(def.points, { closed: !!def.closed, step: 2 });
  const q = path.sample(path.nearest(lot.near[0], lot.near[1]).s);
  const sign = lot.side === 'left' ? 1 : -1;
  const vx = q.tz * sign;
  const vz = -q.tx * sign;
  const off = def.hw + (def.walk || 0) + 0.4 + lot.d / 2;
  return { cx: q.x + vx * off, cz: q.z + vz * off, ux: q.tx, uz: q.tz, vx, vz, hw: lot.w / 2, hd: lot.d / 2 };
}
const lotRects = LOTS.map(lotRect);
/** @param {number} x @param {number} z */
const onLot = (x, z) => lotRects.some((r) => {
  const dx = x - r.cx;
  const dz = z - r.cz;
  return Math.abs(dx * r.ux + dz * r.uz) < r.hw + LOT_MARGIN && Math.abs(dx * r.vx + dz * r.vz) < r.hd + LOT_MARGIN;
});

const CITY_STREET = {
  surface: 'asphalt', hw: 4.6, priority: 2.5, smooth: 20, cls: /** @type {const} */ ('street'), lanes: 2, limit: 40,
  lines: /** @type {const} */ ('center'), maxGrade: 0.09, lamps: lampsAll(34), walk: 2.4,
};
/**
 * The nine districts the city generator lays its grids in: where each is (`center`, `inside`) and
 * how its streets run. The landmark lots are placed against them (`tools/lotsearch.mjs`: a police
 * station in each).
 */
export const DISTRICTS = [
  { id: 'ginza', name: 'GINZA-MACHI', center: [0, 1290], angle: 0.08, spacing: [100, 92], bend: 7, breaks: 0.2,
    inside: (x, z) => inNaikan(x, z, -26) },
  { id: 'shin', name: 'SHINMACHI', center: [-700, 1300], angle: -0.32, spacing: [118, 104], bend: 15, breaks: 0.35,
    inside: (x, z) => x < -24 && inSoto(x, z) && !inNaikan(x, z, 26) },
  { id: 'minato', name: 'MINATOMACHI', center: [700, 1300], angle: 0.36, spacing: [124, 110], bend: 15, breaks: 0.35,
    inside: (x, z) => x > 24 && inSoto(x, z) && !inNaikan(x, z, 26) },
  { id: 'kitaw', name: 'KITAMACHI', center: [-900, 0], angle: 0.55, spacing: [92, 84], bend: 22, breaks: 0.4, hw: 3.9, priority: 2.4, walk: 1.6,
    inside: (x, z) => x < -20 && z < 1700 && inLoop(x, z) && !inSoto(x, z) },
  { id: 'kitae', name: 'HIGASHIMACHI', center: [900, 0], angle: -0.42, spacing: [96, 86], bend: 22, breaks: 0.4, hw: 3.9, priority: 2.4, walk: 1.6,
    inside: (x, z) => x > 20 && z < 1700 && inLoop(x, z) && !inSoto(x, z) },
  { id: 'hama', name: 'HAMACHO', center: [0, 2000], angle: 0, spacing: [150, 70], bend: 10, breaks: 0.3, hw: 3.9, priority: 2.4, walk: 1.6,
    inside: (x, z) => z >= 1700 && inLoop(x, z) && !inSoto(x, z) },
  // Outside the loop: the industrial east coast, the port behind the Bayshore Line and the west
  // side under the mountains. The ridge between the loop and the forest valley stays wooded.
  { id: 'kogyo', name: 'HIGASHI KOGYO', center: [2350, 400], angle: 0.04, spacing: [170, 130], bend: 12, breaks: 0.45, hw: 4.6, priority: 2.45, walk: 1.2,
    inside: (x, z) => x > 1950 && z > -1500 && z < 2330 && !inLoop(x, z) && inland(x, z) > 70 },
  { id: 'futo', name: 'KUROGANE FUTO', center: [0, 2290], angle: 0, spacing: [180, 95], bend: 6, breaks: 0.3, hw: 4.6, priority: 2.45, walk: 1.2,
    inside: (x, z) => z > 2150 && Math.abs(x) < 1900 && !inLoop(x, z) && inland(x, z) > 40 },
  { id: 'nishi', name: 'NISHIMACHI', center: [-2150, 800], angle: 0.18, spacing: [110, 95], bend: 20, breaks: 0.4, hw: 3.9, priority: 2.4, walk: 1.6,
    inside: (x, z) => x < -1900 && x > -2290 && z > -300 && z < 1950 && !inLoop(x, z) },
];

const STREETS = cityStreets({
  seed: SEED,
  blocked: onLot,
  base: CITY_STREET,
  frame: [...CITY_FRAME, ...R18, ...HARBOR, ...WEST, ...EAST, ...HIGASHI].map((d) => ({
    id: d.id, path: new Path(d.points, { closed: !!d.closed, step: 2 }), hw: d.hw, cross: crossable(d),
  })),
  avoid: [
    ...[...C1, ...C2].map((d) => ({ path: new Path(d.points, { closed: !!d.closed, step: 2 }), clear: d.hw + 42 })),
    ...[...interchanges, ...BAYSHORE_JCT, ...KUROGANE_LINE.ramps].map((d) => ({ path: new Path(d.points, { step: 2 }), clear: d.hw + 26 })),
    // The pass runs on a ledge above the west side's streets: they keep clear of it.
    ...KURO.map((d) => ({ path: new Path(d.points, { step: 2 }), clear: d.hw + 30 })),
  ],
  districts: DISTRICTS,
});

/**
 * What a place in town is built like, for the buildings: `downtown` towers inside the inner ring,
 * `midtown` offices and apartments inside the outer ring, `residential` houses and small blocks
 * out to the expressway and beyond, `port` and `industrial` warehouses and yards, or null for
 * the countryside.
 * @param {number} x @param {number} z
 * @returns {'downtown' | 'midtown' | 'residential' | 'port' | 'industrial' | null}
 */
export function cityStyle(x, z) {
  if (inNaikan(x, z, 30)) return 'downtown';
  if (inSoto(x, z)) return 'midtown';
  if (x > 1950 && z > -1500 && z < 2400) return 'industrial';
  if (z > 2150 && Math.abs(x) < 2000) return 'port';
  if (inLoop(x, z)) return z > 1750 ? 'port' : 'residential';
  if (x < -1880 && x > -2400 && z > -350 && z < 2000) return 'residential';
  return null;
}

/** @type {RoadDef[]} */
export const ROADS = [...C1, ...C2, ...R18, ...HARBOR, ...WEST, ...EAST, ...KURO, ...KITA, ...HIGASHI, ...CITY_FRAME, ...STREETS, ...interchanges, ...BAYSHORE_JCT, ...KUROGANE_LINE.roads, ...KUROGANE_LINE.ramps];

/**
 * Gas stations. Each one sits beside a road: `near` is projected onto the road to find
 * where it attaches, `side` says which side of the direction of travel it is on.
 * `w` runs along the road, `d` runs away from it.
 */
export const STATIONS = [
  { id: 'g1', name: 'KITSUNE OIL HARBOR', brand: 'kitsune', road: 'harbor', near: [0, 1940], side: 'right', w: 54, d: 36 },
  { id: 'g2', name: 'HOSHI GAS ROUTE 1 EAST', brand: 'hoshi', road: 'c1-f', near: [1919, 449], side: 'left', w: 60, d: 40 },
  { id: 'g3', name: 'KITSUNE OIL MORI', brand: 'kitsune', road: 'kita', near: [1180, -2040], side: 'left', w: 54, d: 36 },
  { id: 'g4', name: 'HOSHI GAS TOGE', brand: 'hoshi', road: 'kuro', near: [-2310, 330], side: 'right', w: 54, d: 36 },
];

/** Toll plazas on Route 1 and the Bayshore Line. */
export const TOLLS = [
  { id: 'toll-n', name: 'KITA TOLL', ...onLoop('x', 450, (p) => p.z < 0), fee: 700, road: 'c1' },
  { id: 'toll-e', name: 'HIGASHI TOLL', ...onLoop('z', 1800, (p) => p.x > 0), fee: 700, road: 'c1' },
  { id: 'toll-s', name: 'MINATO TOLL', ...onLoop('x', -160, (p) => p.z > 1000), fee: 700, road: 'c1' },
  { id: 'toll-bayshore', name: 'BAYSHORE TOLL', x: crossC2Toll.x, z: crossC2Toll.z, s: crossC2Toll.s, yaw: Math.atan2(crossC2Toll.tx, crossC2Toll.tz), fee: 600, road: 'c2' },
];

/** How wide a toll plaza's divider island is (m); the booth stands on it. */
export const PLAZA_ISLAND = 1.3;
// Each plaza widens its carriageways outward, the median edge staying put, so every booth lane is a
// full lane plus room for a curve between its islands: before, the islands stood on the lane lines and left
// a semi 2.43 m of a lane's 3.73 (T-01).
for (const t of TOLLS) {
  for (const def of t.road === 'c2' ? C2 : C1) {
    const lanes = def.lanes || 2;
    (def.widen ||= []).push({ x: t.x, z: t.z, by: (lanes * (PLAZA_ISLAND + 0.35)) / 2 });
  }
}

/**
 * The Japanese name of every place the HUD can name (zones, named roads, tolls, the fallbacks in
 * `Drive.areaName`), for a subtitle under the area name. A name missing here simply has none.
 * @type {Record<string, string>}
 */
export const AREA_JP = {
  'KUROGANE CITY': '黒鉄市',
  'KUROGANE HARBOR': '黒鉄港',
  'KAMI-IKE': '上池',
  'MORI FOREST': '森林地帯',
  'KURO PASS': '黒峠',
  'HANAZAKI CAPE': '花崎岬',
  'KITA COAST': '北海岸',
  'HIGASHI INDUSTRIAL': '東工業地帯',
  'KURO MOUNTAINS': '黒山地',
  'KUROGANE OUTSKIRTS': '黒鉄郊外',
  'ROUTE 1 EXPRESSWAY': '黒鉄高速1号線',
  'ROUTE 1 RAMP': '1号線ランプ',
  'BAYSHORE LINE': '湾岸線',
  'BAYSHORE JCT': '湾岸ジャンクション',
  'KUROGANE LINE': '黒鉄線',
  'KUROGANE JCT': '黒鉄ジャンクション',
  'ROUTE 18': '国道18号',
  'HARBOR AVE': '港通り',
  'WEST AVE': '西通り',
  'EAST AVE': '東通り',
  'CHUO-DORI': '中央通り',
  'KUROGANE-DORI': '黒鉄通り',
  'NAIKAN RING': '内環状線',
  'SOTOKAN RING': '外環状線',
  'HIGASHI COAST ROAD': '東海岸道路',
  'KITA COAST ROAD': '北海岸道路',
  'KITA TOLL': '北料金所',
  'HIGASHI TOLL': '東料金所',
  'MINATO TOLL': '港料金所',
  'BAYSHORE TOLL': '湾岸料金所',
  'GINZA-MACHI': '銀座町',
  'SHINMACHI': '新町',
  'MINATOMACHI': '港町',
  'KITAMACHI': '北町',
  'HIGASHIMACHI': '東町',
  'HAMACHO': '浜町',
  'HIGASHI KOGYO': '東工業',
  'KUROGANE FUTO': '黒鉄埠頭',
  'NISHIMACHI': '西町',
};

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
  { id: 'cape', name: 'HANAZAKI CAPE', kind: 'coast', rect: { x0: 2150, x1: 3000, z0: -3000, z1: -2150 } },
  { id: 'kita', name: 'KITA COAST', kind: 'coast', rect: { x0: 600, x1: 2150, z0: -3000, z1: -2200 } },
  { id: 'industrial', name: 'HIGASHI INDUSTRIAL', kind: 'industrial', rect: { x0: 2100, x1: 3000, z0: -1600, z1: 2300 } },
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
