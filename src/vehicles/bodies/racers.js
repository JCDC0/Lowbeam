/**
 * The street racers' cars: twelve bodies built from profiles, with the dimensions the loft
 * and the traffic need. Pure data plus detail functions that run on a `Kit`.
 *
 * Axle positions follow the player specs: the front axle sits at `cgToFront`, the rear at
 * `cgToFront - wheelbase`; `zMax` and `zMin` are the nose and tail.
 */

import { endFace, grille, headlights, hoodScoop, mirrors, pipes, plates, profileGlass, profileStations, skirts, taillights, wing } from './profile.js';

/**
 * @typedef {{
 *   id: string, name: string, maker: string,
 *   length: number, width: number, height: number, wheelbase: number, cgToFront: number,
 *   track: number, wheelRadius: number, mass: number, accel: number, speed: [number, number],
 *   body: import('../models.js').BodyDef
 * }} RacerModel
 */

/**
 * @param {Omit<RacerModel, 'body' | 'length' | 'height'>} car
 * @param {import('./profile.js').Profile} profile
 * @param {{ flare?: number, tireWidth?: number, rim?: 'rally' | 'muscle' | 'exotic', rimColor?: number, plate?: string, parts: (k: any) => void }} look
 * @returns {RacerModel}
 */
function racer(car, profile, look) {
  const stations = profileStations(profile);
  const height = Math.max(...stations.map((s) => s[7])) + 0.03;
  return {
    ...car,
    length: profile.zMax - profile.zMin,
    height,
    body: {
      stations,
      glass: profileGlass(profile),
      flare: look.flare ?? 0.03,
      tireWidth: look.tireWidth ?? 0.22,
      rim: look.rim ?? 'exotic',
      rimColor: look.rimColor ?? 0x9ea2aa,
      plate: look.plate ?? 'KG 00-00',
      driver: -1,
      parts: look.parts,
    },
  };
}

/** @type {RacerModel[]} */
export const RACER_MODELS = [
  racer(
    { id: 'rv-kei', name: 'HOSHI KEI-S', maker: 'Hoshi', width: 1.475, wheelbase: 2.24, cgToFront: 1.06, track: 1.3, wheelRadius: 0.27, mass: 760, accel: 3.6, speed: [1.8, 2.1] },
    { zMin: -1.69, zMax: 1.61, width: 0.737, noseY: 0.58, hoodY: 0.74, deckY: 0.78, cabin: [-1.15, -0.78, 0.12, 0.6], roofY: 1.15, roofW: 0.55, noseTaper: 0.92 },
    {
      flare: 0.02, tireWidth: 0.17, rim: 'rally', rimColor: 0xd0d2d6, plate: 'HS 66-60',
      parts(k) {
        headlights(k, 'round');
        grille(k, 0.18, 0.55);
        taillights(k, 'round');
        plates(k);
        mirrors(k, 0.52);
        pipes(k, [-0.3]);
      },
    }
  ),
  racer(
    { id: 'rv-rotary', name: 'MAZUMA RX-COUPE', maker: 'Mazuma', width: 1.76, wheelbase: 2.43, cgToFront: 1.15, track: 1.48, wheelRadius: 0.31, mass: 1250, accel: 4.6, speed: [2.0, 2.35] },
    { zMin: -2.25, zMax: 2.03, width: 0.88, noseY: 0.56, hoodY: 0.82, deckY: 0.86, tailY: 0.82, cabin: [-1.55, -0.75, 0.15, 0.85], roofY: 1.22, roofW: 0.6, noseDrop: 1.4, noseTaper: 0.86 },
    {
      flare: 0.04, tireWidth: 0.23, rim: 'exotic', rimColor: 0xb8bcc2, plate: 'MZ 13-B',
      parts(k) {
        headlights(k, 'hidden');
        const f = endFace(k, 'front');
        k.face('under', 'front', -f.w * 0.55, f.w * 0.55, f.y0 + 0.02, f.y0 + 0.14);
        taillights(k, 'round');
        plates(k);
        wing(k, -1.98, 0.1, 0.64, 'paint', 0.18);
        mirrors(k, 0.75);
        pipes(k, [0.32, -0.32]);
        skirts(k);
      },
    }
  ),
  racer(
    { id: 'rv-hothatch', name: 'KAGERO HOT-GT', maker: 'Kagero Motors', width: 1.7, wheelbase: 2.62, cgToFront: 1.0, track: 1.47, wheelRadius: 0.3, mass: 1150, accel: 4.2, speed: [1.9, 2.2] },
    { zMin: -2.18, zMax: 1.82, width: 0.85, noseY: 0.6, hoodY: 0.83, deckY: 0.9, tailY: 0.9, cabin: [-2.12, -1.8, 0.1, 1.02], roofY: 1.34, roofW: 0.6, tailTaper: 0.95, noseDrop: 1.5 },
    {
      tireWidth: 0.2, rim: 'rally', rimColor: 0xd8d8d8, plate: 'KG 18-99',
      parts(k) {
        headlights(k, 'slim');
        grille(k, 0.3, 0.6);
        taillights(k, 'block');
        plates(k);
        wing(k, -1.96, 0.02, 0.62, 'paint', 0.2);
        mirrors(k, 0.85);
        pipes(k, [-0.45]);
      },
    }
  ),
  racer(
    { id: 'rv-boxer', name: 'KAGERO LANCER-X', maker: 'Kagero Motors', width: 1.77, wheelbase: 2.63, cgToFront: 1.15, track: 1.52, wheelRadius: 0.32, mass: 1400, accel: 4.8, speed: [2.0, 2.35] },
    { zMin: -2.45, zMax: 2.05, width: 0.885, noseY: 0.68, hoodY: 0.9, deckY: 0.98, tailY: 0.96, cabin: [-1.45, -0.95, 0.35, 1.0], roofY: 1.42, roofW: 0.66 },
    {
      tireWidth: 0.23, rim: 'rally', rimColor: 0xd2d4d8, plate: 'KG 90-09',
      parts(k) {
        headlights(k, 'slim');
        grille(k, 0.34, 0.7);
        hoodScoop(k, 1.45, 0.2, 0.42, 0.06);
        taillights(k, 'block');
        plates(k);
        wing(k, -2.2, 0.22, 0.76, 'paint', 0.26);
        mirrors(k, 0.95);
        pipes(k, [-0.5], 0.3, 0.06);
        skirts(k);
      },
    }
  ),
  racer(
    { id: 'rv-v8drift', name: 'HALDEN DRIFTER', maker: 'Halden Motor Co.', width: 1.92, wheelbase: 2.72, cgToFront: 1.3, track: 1.6, wheelRadius: 0.34, mass: 1550, accel: 5.0, speed: [2.05, 2.4] },
    { zMin: -2.53, zMax: 2.25, width: 0.96, noseY: 0.74, hoodY: 0.94, deckY: 0.98, tailY: 0.95, cabin: [-1.55, -0.85, 0.2, 0.95], roofY: 1.36, roofW: 0.64, noseTaper: 0.94, tailTaper: 0.95 },
    {
      tireWidth: 0.26, rim: 'muscle', rimColor: 0x2a2c30, plate: 'HMC 500',
      parts(k) {
        headlights(k, 'slim', 0.08);
        grille(k, 0.5, 0.75);
        hoodScoop(k, 1.5, 0.25, 0.6, 0.07, 'accent');
        taillights(k, 'block');
        plates(k);
        k.ducktail(-2.3, 0.8, 0.06);
        k.stripes(0.07, 0.2, k.zMin + 0.05, k.zMax - 0.05);
        mirrors(k, 0.9);
        pipes(k, [0.62, -0.62]);
        skirts(k);
      },
    }
  ),
  racer(
    { id: 'rv-wedge', name: 'TSURUGI WEDGE', maker: 'Tsurugi Heavy Industries', width: 1.86, wheelbase: 2.55, cgToFront: 1.5, track: 1.58, wheelRadius: 0.32, mass: 1350, accel: 5.6, speed: [2.2, 2.5] },
    { zMin: -1.95, zMax: 2.45, width: 0.93, noseY: 0.5, hoodY: 0.78, deckY: 0.88, tailY: 0.86, cabin: [-0.95, -0.55, 0.3, 1.25], roofY: 1.13, roofW: 0.58, noseDrop: 1.1, noseTaper: 0.92 },
    {
      flare: 0.04, tireWidth: 0.26, rim: 'exotic', rimColor: 0x9a9ea6, plate: 'TS 0-001',
      parts(k) {
        headlights(k, 'hidden');
        const f = endFace(k, 'front');
        k.face('under', 'front', -f.w * 0.75, f.w * 0.75, f.y0, f.y0 + 0.1);
        k.side('under', -0.9, -0.45, 0.42, 0.62);
        for (let z = -1.5; z < -1.0; z += 0.1) k.b.box('trim', 0, k.topY(z) + 0.02, z, 1.0, 0.03, 0.04);
        taillights(k, 'bar');
        plates(k);
        wing(k, -1.75, 0.14, 0.8, 'paint', 0.22);
        mirrors(k, 1.05);
        pipes(k, [0.2, -0.2], 0.36);
      },
    }
  ),
  racer(
    { id: 'rv-hardtop', name: 'KENRO HARDTOP', maker: 'Kenro', width: 1.66, wheelbase: 2.57, cgToFront: 1.15, track: 1.4, wheelRadius: 0.3, mass: 1150, accel: 4.2, speed: [1.9, 2.2] },
    { zMin: -2.43, zMax: 1.97, width: 0.83, noseY: 0.76, hoodY: 0.86, deckY: 0.9, tailY: 0.88, cabin: [-1.4, -0.95, 0.25, 0.85], roofY: 1.38, roofW: 0.66, noseTaper: 0.97, tailTaper: 0.97, noseDrop: 3, tumble: 0.2, shoulder: 0.6 },
    {
      flare: 0.07, tireWidth: 0.22, rim: 'muscle', rimColor: 0x1c1d20, plate: 'KR 20-00',
      parts(k) {
        const f = endFace(k, 'front');
        k.face('chrome', 'front', -f.w + 0.18, f.w - 0.18, f.y0 + (f.y1 - f.y0) * 0.45, f.y1 - 0.03);
        headlights(k, 'pair');
        k.b.box('chrome', 0, f.y0 + 0.08, k.zMax + 0.02, f.w * 2 + 0.06, 0.08, 0.07);
        const r = endFace(k, 'rear');
        k.b.box('chrome', 0, r.y0 + 0.08, k.zMin - 0.02, r.w * 2 + 0.06, 0.08, 0.07);
        taillights(k, 'round');
        plates(k, false);
        k.mirror((s) => k.b.box('chrome', s * 0.62, k.topY(1.35) + 0.07, 1.35, 0.06, 0.07, 0.08));
        pipes(k, [-0.5]);
      },
    }
  ),
  racer(
    { id: 'rv-roadster', name: 'HOSHI BEAT', maker: 'Hoshi', width: 1.4, wheelbase: 2.28, cgToFront: 1.2, track: 1.22, wheelRadius: 0.27, mass: 780, accel: 3.8, speed: [1.8, 2.1] },
    { zMin: -1.65, zMax: 1.75, width: 0.7, noseY: 0.56, hoodY: 0.78, deckY: 0.8, noseTaper: 0.9 },
    {
      flare: 0.02, tireWidth: 0.17, rim: 'rally', rimColor: 0xd0d2d6, plate: 'HS 82-01',
      parts(k) {
        k.top('under', -0.55, 0.55, -0.55, 0.45, false, 0.004);
        const yb = k.topY(0.55);
        k.b.quad('glass', [-0.58, yb, 0.55], [0.58, yb, 0.55], [0.54, yb + 0.34, 0.3], [-0.54, yb + 0.34, 0.3]);
        k.b.box('trim', 0, yb + 0.35, 0.3, 1.12, 0.03, 0.04);
        k.mirror((s) => {
          k.b.box('trim', s * 0.3, k.topY(-0.62) + 0.2, -0.62, 0.05, 0.4, 0.05);
          k.b.box('trim', s * 0.3, k.topY(-0.4) + 0.12, -0.4, 0.36, 0.28, 0.08);
        });
        headlights(k, 'round');
        taillights(k, 'round');
        plates(k);
        k.side('under', -0.75, -0.35, 0.4, 0.58);
        mirrors(k, 0.5);
        pipes(k, [0.2]);
      },
    }
  ),
  racer(
    { id: 'rv-wide', name: 'KAGERO RS-WIDE', maker: 'Kagero Motors', width: 1.95, wheelbase: 2.67, cgToFront: 1.25, track: 1.6, wheelRadius: 0.33, mass: 1500, accel: 5.2, speed: [2.1, 2.45] },
    { zMin: -2.43, zMax: 2.17, width: 0.975, noseY: 0.68, hoodY: 0.9, deckY: 0.96, tailY: 0.93, cabin: [-1.5, -1.0, 0.3, 0.95], roofY: 1.36, roofW: 0.64, tumble: 0.33 },
    {
      flare: 0.07, tireWidth: 0.27, rim: 'exotic', rimColor: 0x6a6e76, plate: 'KG 34-GT',
      parts(k) {
        headlights(k, 'pair');
        grille(k, 0.36, 0.75);
        hoodScoop(k, 1.55, 0.26, 0.36, 0.035, 'trim');
        taillights(k, 'round');
        plates(k);
        wing(k, -2.15, 0.2, 0.8, 'accent', 0.26);
        mirrors(k, 0.9);
        pipes(k, [-0.4, -0.55]);
        skirts(k);
      },
    }
  ),
  racer(
    { id: 'rv-hyper', name: 'VESPERA ZERO', maker: 'Carrozzeria Vespera', width: 2.04, wheelbase: 2.7, cgToFront: 1.55, track: 1.7, wheelRadius: 0.34, mass: 1400, accel: 6.4, speed: [2.3, 2.7] },
    { zMin: -2.05, zMax: 2.6, width: 1.02, noseY: 0.46, hoodY: 0.74, deckY: 0.86, tailY: 0.84, cabin: [-0.8, -0.35, 0.45, 1.4], roofY: 1.1, roofW: 0.55, noseDrop: 1.2, tumble: 0.42, noseTaper: 0.86 },
    {
      flare: 0.05, tireWidth: 0.29, rim: 'exotic', rimColor: 0x2c2e33, plate: 'VZ 000',
      parts(k) {
        headlights(k, 'slim');
        const f = endFace(k, 'front');
        k.face('under', 'front', -f.w * 0.8, f.w * 0.8, f.y0, f.y0 + 0.12);
        k.side('under', -0.7, -0.2, 0.36, 0.62);
        for (let z = -1.6; z < -0.95; z += 0.1) k.b.box('trim', 0, k.topY(z) + 0.02, z, 1.1, 0.03, 0.04);
        taillights(k, 'bar');
        plates(k);
        wing(k, -1.85, 0.18, 0.86, 'accent', 0.28);
        pipes(k, [0.12, -0.12], 0.5, 0.05);
      },
    }
  ),
  racer(
    { id: 'rv-sakura', name: 'KENRO SAKURA S', maker: 'Kenro', width: 1.7, wheelbase: 2.53, cgToFront: 1.17, track: 1.48, wheelRadius: 0.31, mass: 1240, accel: 4.4, speed: [1.95, 2.3] },
    { zMin: -2.42, zMax: 2.03, width: 0.85, noseY: 0.62, hoodY: 0.86, deckY: 0.92, tailY: 0.9, cabin: [-1.35, -0.9, 0.25, 0.9], roofY: 1.29, roofW: 0.62 },
    {
      flare: 0.03, tireWidth: 0.23, rim: 'exotic', rimColor: 0xc0c4ca, plate: 'KR 15-15',
      parts(k) {
        headlights(k, 'slim');
        grille(k, 0.25, 0.7);
        taillights(k, 'block');
        plates(k);
        wing(k, -2.2, 0.12, 0.7, 'paint', 0.2);
        mirrors(k, 0.85);
        pipes(k, [-0.48]);
        skirts(k);
      },
    }
  ),
  racer(
    { id: 'rv-vip', name: 'KAGERO ARISTO VIP', maker: 'Kagero Motors', width: 1.82, wheelbase: 2.92, cgToFront: 1.25, track: 1.56, wheelRadius: 0.34, mass: 1680, accel: 4.6, speed: [1.95, 2.3] },
    { zMin: -2.75, zMax: 2.2, width: 0.91, rocker: 0.17, noseY: 0.72, hoodY: 0.92, deckY: 0.98, tailY: 0.96, cabin: [-1.7, -1.1, 0.3, 0.98], roofY: 1.42, roofW: 0.68, noseTaper: 0.93 },
    {
      flare: 0.02, tireWidth: 0.25, rim: 'exotic', rimColor: 0xd6d8dc, plate: 'KG 88-88',
      parts(k) {
        headlights(k, 'pair');
        grille(k, 0.4, 0.7);
        const f = endFace(k, 'front');
        k.face('chrome', 'front', -0.4, 0.4, f.y0 + (f.y1 - f.y0) * 0.82, f.y0 + (f.y1 - f.y0) * 0.86, false, 0.01);
        taillights(k, 'bar');
        plates(k, false);
        k.side('chrome', k.rearAxle + 0.5, k.frontAxle - 0.5, 0.52, 0.54);
        mirrors(k, 1.0);
        pipes(k, [0.55, -0.55]);
      },
    }
  ),
];

/** @type {Map<string, RacerModel>} */
export const RACER_MODEL_BY_ID = new Map(RACER_MODELS.map((m) => [m.id, m]));
