/**
 * The vehicles that fill the roads: sizes, how fast and how willing they are, and where
 * they are common. Pure data. The meshes come from `src/traffic/render.js` for now (boxy
 * stand-ins) and from the body files of task A3/A4 later; `id` is the key either way.
 *
 * weights: relative chance on each road class (expressway, arterial, street, ramp, mountain).
 * speed: how the driver's wanted speed relates to the limit, as [min, max].
 */

/**
 * @typedef {{
 *   id: string, name: string, length: number, width: number, height: number, mass: number,
 *   accel: number, speed: [number, number], weights: Record<string, number>,
 *   paint: number[], wheels?: number
 * }} Kind
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

const HOT = [0xc23a2a, 0x2f6fd0, 0xf2d23a, 0xe8e8e6, 0x111317, 0x6a2fa8, 0x1f9a6a, 0xff7a1a];

/**
 * The street racers that cruise Route 1 fast. They are drawn as low, wide stand-ins until
 * their bodies arrive. `speed` is relative to the limit of the road they are on.
 * @type {Kind[]}
 */
export const RIVALS = [
  { id: 'rv-kei', name: 'HOSHI KEI-S', length: 3.4, width: 1.48, height: 1.2, mass: 760, accel: 3.4, speed: [1.5, 1.8], paint: HOT, weights: { expressway: 3, ramp: 1 } },
  { id: 'rv-rotary', name: 'MAZUMA RX-COUPE', length: 4.3, width: 1.78, height: 1.25, mass: 1250, accel: 4.4, speed: [1.7, 2.0], paint: HOT, weights: { expressway: 3, ramp: 1 } },
  { id: 'rv-hothatch', name: 'KAGERO HOT-GT', length: 3.95, width: 1.74, height: 1.38, mass: 1150, accel: 4.0, speed: [1.55, 1.85], paint: HOT, weights: { expressway: 3, ramp: 1 } },
  { id: 'rv-boxer', name: 'KAGERO LANCER-X', length: 4.5, width: 1.78, height: 1.42, mass: 1400, accel: 4.6, speed: [1.7, 2.0], paint: HOT, weights: { expressway: 3, ramp: 1 } },
  { id: 'rv-v8drift', name: 'HALDEN DRIFTER', length: 4.7, width: 1.82, height: 1.35, mass: 1500, accel: 4.8, speed: [1.8, 2.1], paint: HOT, weights: { expressway: 3, ramp: 1 } },
  { id: 'rv-wedge', name: 'TSURUGI WEDGE', length: 4.4, width: 1.85, height: 1.15, mass: 1350, accel: 5.4, speed: [2.0, 2.3], paint: HOT, weights: { expressway: 2, ramp: 1 } },
  { id: 'rv-hardtop', name: 'KENRO HARDTOP', length: 4.55, width: 1.72, height: 1.38, mass: 1250, accel: 4.2, speed: [1.6, 1.9], paint: HOT, weights: { expressway: 3, ramp: 1 } },
  { id: 'rv-roadster', name: 'HOSHI BEAT', length: 3.5, width: 1.64, height: 1.15, mass: 780, accel: 3.6, speed: [1.5, 1.8], paint: HOT, weights: { expressway: 3, ramp: 1 } },
  { id: 'rv-wide', name: 'KAGERO RS-WIDE', length: 4.4, width: 1.95, height: 1.3, mass: 1450, accel: 5.0, speed: [1.9, 2.2], paint: HOT, weights: { expressway: 2, ramp: 1 } },
  { id: 'rv-hyper', name: 'VESPERA ZERO', length: 4.5, width: 2.0, height: 1.1, mass: 1400, accel: 6.2, speed: [2.2, 2.6], paint: HOT, weights: { expressway: 1, ramp: 0.5 } },
];

/** Every kind a renderer has to draw. */
export const ALL_KINDS = [...KINDS, ...RIVALS];
for (const k of RIVALS) KIND_BY_ID.set(k.id, k);
