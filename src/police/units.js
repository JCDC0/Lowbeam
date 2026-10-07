/**
 * The police units, and which ones turn up at each heat level (A17, after Most Wanted 2005).
 * Pure data, no three.js: the kinds are handed to the traffic sim to spawn agents, the renderer
 * draws them, and `unitFor` tells the sim what a given heat level fields.
 *
 * Until Claude's police models land (the patrol car with its light bar, the Rhino, the unmarked
 * car, the interceptor), every unit borrows an existing body through its `model` id and wears the
 * police paint, so the swap to a proper model later is one line per kind. The unit kinds are kept
 * out of the civilian `KINDS` pool so the traffic weights never pick them by accident; the sim
 * spawns them deliberately.
 */

/** @typedef {import('../traffic/kinds.js').Kind} Kind */

/** The Japanese police two-tone: white upper, black lower (the `accent`). */
const CRUISER_PAINT = [0xf4f4f2];
/** An unmarked unit: dark, so it reads as a fast car until the lights come on. */
const UNMARKED_PAINT = [0x14161c];
/** The interceptor wears the police paint in a supercar body. */
const INTERCEPTOR_PAINT = [0xf4f4f2];

/**
 * The four unit kinds. `model` names an existing body in `traffic/bodies.js` until Claude's
 * police models land; `lightBar` and `headOn` drive the renderer's flares (a light bar, a Rhino
 * that drives straight at you from ahead); `top` is the unit's top speed in km/h, which is what
 * the player has to beat to outrun it.
 * @type {Kind[]}
 */
export const UNIT_KINDS = [
  {
    id: 'police', name: 'Patrol cruiser', length: 4.7, width: 1.8, height: 1.45, mass: 1500, accel: 2.7, top: 190, hp: 100, bounty: 5000,
    speed: [1.0, 1.25], paint: CRUISER_PAINT, accent: 0x14161c, model: 'rv-hothatch', lightBar: true,
    weights: { expressway: 3, arterial: 2, street: 3, ramp: 1, mountain: 0 },
  },
  {
    id: 'police-fast', name: 'Unmarked fast unit', length: 4.5, width: 1.85, height: 1.34, mass: 1400, accel: 4.6, top: 250, hp: 80, bounty: 8000,
    speed: [1.5, 1.9], paint: UNMARKED_PAINT, accent: 0x0b0c10, model: 'rv-wide', lightBar: true, hidden: true,
    weights: { expressway: 3, arterial: 1, street: 1, ramp: 1, mountain: 0 },
  },
  {
    id: 'police-heavy', name: 'Heavy SUV (Rhino)', length: 4.9, width: 2.0, height: 1.9, mass: 2400, accel: 2.2, top: 175, hp: 260, bounty: 20000,
    speed: [1.0, 1.3], paint: CRUISER_PAINT, accent: 0x14161c, model: 'suv', lightBar: true, headOn: true,
    weights: { expressway: 3, arterial: 3, street: 3, ramp: 1, mountain: 0 },
  },
  {
    id: 'police-int', name: 'Interceptor', length: 4.6, width: 2.0, height: 1.24, mass: 1450, accel: 5.6, top: 300, hp: 120, bounty: 12000,
    speed: [1.9, 2.4], paint: INTERCEPTOR_PAINT, accent: 0x14161c, model: 'rv-hyper', lightBar: true,
    weights: { expressway: 3, arterial: 1, street: 0.5, ramp: 1, mountain: 0 },
  },
];

/** @type {Map<string, Kind>} */
export const UNIT_BY_ID = new Map(UNIT_KINDS.map((k) => [k.id, k]));

/**
 * The unit kind ids on the road at a heat level, straight from the Most Wanted table: two or
 * three cruisers at 1, more cruisers at 2, unmarked fast units and the helicopter at 3, the
 * Rhinos and roadblocks at 4, and interceptors at 5. The list is what the sim spawns.
 * @param {number} heat 1 to 5
 * @returns {string[]}
 */
export function roster(heat) {
  const h = Math.max(1, Math.min(5, Math.round(heat)));
  switch (h) {
    case 1: return ['police', 'police', 'police'];
    case 2: return ['police', 'police', 'police', 'police', 'police'];
    case 3: return ['police', 'police', 'police', 'police-fast', 'police-fast'];
    case 4: return ['police', 'police', 'police', 'police-fast', 'police-fast', 'police-heavy', 'police-heavy'];
    default: return ['police', 'police', 'police', 'police-fast', 'police-fast', 'police-heavy', 'police-heavy', 'police-int', 'police-int'];
  }
}

/** The kind a single fresh unit spawns as at a heat level: the newest, fastest one in the roster. */
export function unitFor(heat) {
  const list = roster(heat);
  return UNIT_BY_ID.get(list[list.length - 1]) || UNIT_BY_ID.get('police');
}

/**
 * How a unit takes a hit: `k` hit points per (m/s)^2 of closing speed for an even share of the crash,
 * nothing under `floor` m/s, a wall counting as `wall` of an even share. Below `smoke` of its hit
 * points a unit smokes, below `limp` it limps at `limpSpeed` of its top speed, at zero it is destroyed.
 */
export const DAMAGE = { k: 0.35, floor: 2, wall: 1.2, smoke: 0.5, limp: 0.25, limpSpeed: 0.7 };

/**
 * Hit points a unit of mass `own` loses to a hit at `hit` m/s closing against something of mass
 * `other` (Infinity for a wall): the square of the closing speed times its share of the crash, so
 * a Rhino rammed by a light car takes less than a cruiser does, and a pillar is worst of all.
 * @param {number} hit @param {number} other @param {number} own
 */
export function unitDamage(hit, other, own) {
  if (hit <= DAMAGE.floor) return 0;
  const share = other === Infinity ? DAMAGE.wall : (2 * other) / (other + own);
  return DAMAGE.k * hit * hit * share;
}

/** What is left of a unit, 0..1. @param {{ hp?: number, kind: Kind }} a */
export const health = (a) => Math.max(0, (a.hp ?? a.kind.hp ?? 100) / (a.kind.hp ?? 100));

/** True for any police unit kind, whatever heat level it belongs to. */
export const isUnit = (kind) => kind.id.startsWith('police');