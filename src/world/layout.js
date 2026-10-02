/**
 * Authored data for the Kirigaoka valley: roads, gas stations, the town, the lake and
 * the rally stage. Coordinates are meters. North is -Z, east is +X.
 * Pure data, so tests and tools can read it without a browser.
 */

export const SEED = 0x10eb3a;
export const WORLD_HALF = 1000;
export const WATER_LEVEL = 0;

export const LAKE = { x: -330, z: 490, r: 170 };

/** Town footprint used for building placement and the area name. */
export const TOWN = { x0: -150, x1: 310, z0: 165, z1: 480 };

/**
 * @typedef {{ at: number[], height: number, half: number }} Bump
 * @typedef {{
 *   id: string, name: string, surface: string, hw: number, closed?: boolean,
 *   priority: number, smooth: number, lamps?: { from: number[], to: number[], every: number }[],
 *   lines?: 'center' | 'none', bumps?: Bump[], maxGrade?: number, points: number[][]
 * }} RoadDef
 */

/** @type {RoadDef[]} */
export const ROADS = [
  {
    id: 'r7',
    name: 'ROUTE 7',
    surface: 'asphalt',
    hw: 5,
    closed: true,
    priority: 3,
    smooth: 30,
    lines: 'center',
    // Lamps only near town and the truck stop. The rest of the loop is dark on purpose.
    lamps: [
      { from: [-360, 230], to: [300, 280], every: 34 },
      { from: [500, 40], to: [500, -140], every: 34 },
      { from: [-450, -80], to: [-430, 90], every: 40 },
    ],
    points: [
      [-250, 300], [-60, 310], [140, 300], [300, 280], [430, 200], [500, 40], [500, -140],
      [440, -300], [300, -420], [100, -470], [-100, -450], [-280, -380], [-400, -250],
      [-450, -80], [-430, 90], [-360, 230],
    ],
  },
  {
    id: 'ss1',
    name: 'KIRIGAOKA RIDGE',
    surface: 'gravel',
    hw: 3.8,
    priority: 1,
    smooth: 45,
    lines: 'none',
    maxGrade: 0.13,
    bumps: [{ at: [-22, -585], height: 1.6, half: 18 }],
    points: [
      [-438, 40], [-500, 32], [-565, 22], [-625, 5], [-668, -60], [-650, -115], [-639, -233],
      [-624, -318], [-631, -350], [-670, -327], [-732, -238], [-778, -137], [-805, -95],
      [-830, -130], [-822, -236], [-779, -363], [-700, -490], [-614, -573], [-556, -663],
      [-448, -717], [-350, -786], [-200, -830], [-74, -847], [0, -860], [115, -822],
      [137, -778], [26, -740], [-97, -693], [-120, -640], [-60, -600], [20, -560],
      [30, -510], [-12, -461],
    ],
  },
  {
    id: 'ekimae',
    name: 'EKIMAE-DORI',
    surface: 'asphalt',
    hw: 4,
    priority: 2.5,
    smooth: 20,
    lines: 'center',
    lamps: [{ from: [-20, 190], to: [-20, 420], every: 30 }],
    points: [[-20, 190], [-20, 300], [-20, 420]],
  },
  {
    id: 'sakura',
    name: 'SAKURA-DORI',
    surface: 'asphalt',
    hw: 4,
    priority: 2.5,
    smooth: 20,
    lines: 'center',
    lamps: [{ from: [180, 180], to: [180, 420], every: 30 }],
    points: [[180, 180], [180, 300], [180, 420]],
  },
  {
    id: 'kawa',
    name: 'KAWA-DORI',
    surface: 'asphalt',
    hw: 4,
    priority: 2,
    smooth: 20,
    lines: 'center',
    lamps: [{ from: [-130, 418], to: [270, 410], every: 32 }],
    points: [[-130, 418], [-20, 420], [80, 421], [180, 420], [270, 410]],
  },
];

/**
 * Gas stations. Each one sits beside a road: `near` is projected onto the road to find
 * where it attaches, `side` says which side of the direction of travel it is on.
 * `w` runs along the road, `d` runs away from it.
 */
export const STATIONS = [
  { id: 'g1', name: 'KITSUNE OIL KIRIGAOKA', brand: 'kitsune', road: 'r7', near: [-150, 305], side: 'right', w: 54, d: 36 },
  { id: 'g2', name: 'HOSHI GAS ROUTE 7', brand: 'hoshi', road: 'r7', near: [500, -50], side: 'right', w: 60, d: 40 },
  { id: 'g3', name: 'KITSUNE OIL SERVICE PARK', brand: 'kitsune', road: 'ss1', near: [-520, 28], side: 'right', w: 70, d: 46, servicePark: true },
];

/** The rally event that runs on `ss1`. Distances are meters along the road. */
export const RALLY = {
  id: 'ss1',
  name: 'SS1 KIRIGAOKA RIDGE',
  road: 'ss1',
  startS: 130,
  finishEndOffset: 70,
  checkpoints: 4,
  // Target average speeds in km/h for the medals.
  medals: { gold: 92, silver: 78, bronze: 64 },
  prize: { finish: 6000, bronze: 9000, silver: 14000, gold: 22000 },
};

export const ECONOMY = {
  startMoney: 15000,
  fuelPrice: 168,
  towCost: 5000,
  resetPenalty: 5,
};
