/**
 * The vehicles that fill the roads: sizes, how fast and how willing they are, and where
 * they are common. Pure data. The meshes come from `src/traffic/render.js` for now (boxy
 * stand-ins) and from the body files of task A3/A4 later; `id` is the key either way.
 *
 * weights: relative chance on each road class (expressway, arterial, street, ramp, mountain).
 * speed: how the driver's wanted speed relates to the limit, as [min, max].
 */

import { RACER_MODELS } from '../vehicles/bodies/racers.js';
import { CARS } from '../vehicles/specs.js';
import { UNIT_KINDS, isUnit } from '../police/units.js';

/**
 * @typedef {{
 *   id: string, name: string, length: number, width: number, height: number, mass: number,
 *   accel: number, speed: [number, number], weights: Record<string, number>,
 *   paint: number[], wheels?: number, model?: string, accent?: number, lightBar?: boolean,
 *   hidden?: boolean, headOn?: boolean, top?: number, blender?: string, hp?: number, bounty?: number
 * }} Kind
 * `top` is a police unit's own top speed in km/h: in a chase it drives as fast as the chase needs
 * up to this, whatever the road's limit. `blender` names a model in `assets/models/` (made in
 * Blender, `tools/blender/`) drawn instead of the lofted or boxy body once it has loaded.
 */

const MUTED = [0xe8e8e6, 0xc9ccd0, 0x2a2d33, 0x1b1d22, 0x6b7077, 0x8a1c22, 0x24407a, 0xa89a7e, 0x3b5a46];
const BRIGHT = [0xf2d23a, 0xd8d8d6, 0x2f6fd0, 0xc23a2a, 0x2a2d33];

/** @type {Kind[]} */
export const KINDS = [
  { id: 'sedan', name: 'Sedan', length: 4.55, width: 1.78, height: 1.42, mass: 1350, accel: 2.4, speed: [0.85, 1.12], paint: MUTED, weights: { expressway: 5, arterial: 4, street: 4, ramp: 3, mountain: 2 } },
  { id: 'hatch', name: 'Hatchback', length: 3.95, width: 1.7, height: 1.45, mass: 1080, accel: 2.6, speed: [0.85, 1.15], paint: BRIGHT.concat(MUTED), weights: { expressway: 3, arterial: 4, street: 5, ramp: 3, mountain: 3 } },
  { id: 'kei', name: 'Kei car', length: 3.4, width: 1.48, height: 1.62, mass: 840, accel: 2.0, speed: [0.78, 1.0], paint: BRIGHT.concat(MUTED), weights: { expressway: 1, arterial: 3, street: 6, ramp: 2, mountain: 3 } },
  { id: 'wagon', name: 'Wagon', length: 4.7, width: 1.78, height: 1.5, mass: 1450, accel: 2.2, speed: [0.85, 1.1], paint: MUTED, weights: { expressway: 3, arterial: 3, street: 3, ramp: 2, mountain: 2 } },
  { id: 'taxi', name: 'Taxi', length: 4.6, width: 1.78, height: 1.5, mass: 1400, accel: 2.3, speed: [0.9, 1.1], paint: [0xf2c230, 0x111317], weights: { expressway: 1, arterial: 4, street: 6, ramp: 1, mountain: 0 } },
  { id: 'suv', name: 'SUV', length: 4.7, width: 1.9, height: 1.75, mass: 1900, accel: 2.1, speed: [0.85, 1.1], paint: MUTED, weights: { expressway: 3, arterial: 3, street: 2, ramp: 2, mountain: 3 } },
  { id: 'minivan', name: 'Minivan', length: 4.8, width: 1.8, height: 1.78, mass: 1800, accel: 2.0, speed: [0.82, 1.05], paint: MUTED, weights: { expressway: 2, arterial: 3, street: 3, ramp: 2, mountain: 1 } },
  { id: 'van', name: 'Panel van', length: 4.9, width: 1.85, height: 2.0, mass: 2100, accel: 1.8, speed: [0.82, 1.05], paint: [0xe8e8e6, 0xd8d8d6, 0x2f6fd0, 0x3b5a46], weights: { expressway: 3, arterial: 3, street: 3, ramp: 2, mountain: 1 } },
  { id: 'pickup', name: 'Pickup', length: 5.2, width: 1.9, height: 1.8, mass: 2100, accel: 2.0, speed: [0.85, 1.08], paint: MUTED, weights: { expressway: 2, arterial: 2, street: 1, ramp: 1, mountain: 3 } },
  { id: 'keitruck', name: 'Kei truck', length: 3.4, width: 1.48, height: 1.8, mass: 900, accel: 1.8, speed: [0.7, 0.95], paint: [0xe8e8e6, 0xc9ccd0, 0x3b5a46], weights: { expressway: 0, arterial: 2, street: 3, ramp: 0, mountain: 4 } },
  { id: 'truck', name: 'Box truck', length: 7.2, width: 2.3, height: 3.2, mass: 6500, accel: 1.2, speed: [0.72, 0.92], paint: [0xe8e8e6, 0x2f6fd0, 0xd8d8d6], weights: { expressway: 3, arterial: 3, street: 1, ramp: 2, mountain: 0.5 } },
  { id: 'tanker', name: 'Tanker', length: 9.0, width: 2.4, height: 3.0, mass: 12000, accel: 1.0, speed: [0.7, 0.9], paint: [0xc9ccd0, 0xe8e8e6], weights: { expressway: 1.2, arterial: 1, street: 0, ramp: 1, mountain: 0 } },
  { id: 'bus', name: 'City bus', length: 10.5, width: 2.5, height: 3.1, mass: 11000, accel: 1.1, speed: [0.7, 0.9], paint: [0x2f6fd0, 0xc23a2a, 0xe8e8e6], weights: { expressway: 0.5, arterial: 2, street: 3, ramp: 0, mountain: 0 } },
  { id: 'semi', name: 'Semi trailer', length: 16, width: 2.5, height: 3.6, mass: 24000, accel: 0.9, speed: [0.72, 0.9], paint: [0xe8e8e6, 0xc9ccd0, 0x24407a], weights: { expressway: 2, arterial: 0.5, street: 0, ramp: 1, mountain: 0 } },
];

/** @type {Map<string, Kind>} */
export const KIND_BY_ID = new Map(KINDS.map((k) => [k.id, k]));

for (const k of UNIT_KINDS) KIND_BY_ID.set(k.id, k);
export const POLICE = UNIT_KINDS[0];
export const isPolice = isUnit;
export { UNIT_KINDS, isUnit };
export { UNIT_BY_ID } from '../police/units.js';

const HOT = [0xc23a2a, 0x2f6fd0, 0xf2d23a, 0xe8e8e6, 0x111317, 0x6a2fa8, 0x1f9a6a, 0xff7a1a];

/**
 * The street racers that cruise Route 1 fast: the twelve racer models, and the four player
 * cars driven by rivals. `model` names the body that `traffic/bodies.js` lofts; `speed` is
 * relative to the limit of the road they are on.
 * @type {Kind[]}
 */
export const RIVALS = [
  ...RACER_MODELS.map((m) => ({
    id: m.id, name: m.name, model: m.id, length: m.length, width: m.width, height: m.height, mass: m.mass,
    accel: m.accel, speed: m.speed, paint: HOT, weights: { expressway: 3, ramp: 1 },
  })),
  // The Hikari (1984) is not among the street racers yet: adding a kind reshuffles every seeded
  // pick, and the traffic tests' racer speed and lane change samples sit close to their limits.
  ...CARS.filter((c) => c.id !== 'hikari').map((c) => {
    const top = Math.min(2.7, 1.5 + c.bars.topSpeed * 0.11);
    return {
      id: `rv-${c.id}`, name: c.name, model: c.id, length: c.length, width: c.width, height: 1.35, mass: c.mass,
      accel: 3.8 + c.bars.accel * 0.25, speed: /** @type {[number, number]} */ ([top - 0.25, top]), paint: c.paints.map((p) => p.color),
      weights: { expressway: 2, ramp: 1 },
    };
  }),
];

/** Every kind a renderer has to draw. */
export const ALL_KINDS = [...KINDS, ...RIVALS, ...UNIT_KINDS];

/**
 * Bodies made in Blender, by kind: Gemini's models (tasks G2, G3, G5, G6) as they pass review. The
 * `_full` export carries its own wheels, which is all traffic needs (its wheels do not turn).
 * @type {Record<string, string>}
 */
export const KIND_MODELS = {
  'rv-rotary': 'rv_rotary_full',
  'rv-kei': 'rv_kei_full',
  'rv-hothatch': 'rv_hothatch_full',
  'rv-boxer': 'rv_boxer_full',
  'rv-v8drift': 'rv_v8drift_full',
  'rv-wedge': 'rv_wedge_full',
  'rv-hardtop': 'rv_hardtop_full',
  'rv-roadster': 'rv_roadster_full',
  'rv-wide': 'rv_wide_full',
  police: 'police_cruiser_full',
  'police-fast': 'police_unmarked_full',
  'police-heavy': 'police_rhino_full',
  'police-int': 'police_interceptor_full',
};
for (const k of ALL_KINDS) if (KIND_MODELS[k.id]) k.blender = KIND_MODELS[k.id];
for (const k of RIVALS) KIND_BY_ID.set(k.id, k);
