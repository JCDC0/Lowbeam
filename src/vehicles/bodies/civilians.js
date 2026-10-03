/**
 * The traffic fleet as lofted bodies, one per traffic kind: cars and vans from profiles,
 * trucks, the tanker, the bus and the semi as a lofted cab with their cargo built on. Pure
 * data plus detail functions that run on a `Kit`. Keyed by the kind id in `traffic/kinds.js`.
 */

import { bodyModel, endFace, grille, headlights, mirrors, plates, taillights } from './profile.js';

const WHITE = [0.82, 0.82, 0.8];
const GREY = [0.55, 0.57, 0.6];

/** Head and tail lamps on a box face at z, a lamp a side. */
function boxLamps(k, z, key, y, w, size = 0.22, back = false) {
  k.mirror((s) => k.b.box(key, s * (w - size), y, z + (back ? -0.01 : 0.01), size * 1.4, size * 0.6, 0.04));
}

/** A cargo box from z0 to z1 (z0 < z1), sitting on the frame at `y0`. */
function cargo(k, z0, z1, y0, y1, w, key = 'accent') {
  k.b.box(key, 0, (y0 + y1) / 2, (z0 + z1) / 2, w * 2, y1 - y0, z1 - z0, { bottom: true });
  k.b.box('under', 0, y0 - 0.12, (z0 + z1) / 2 + 0.3, w * 1.5, 0.22, z1 - z0 + 0.8);
}

export const CIVILIAN_MODELS = [
  bodyModel(
    { id: 'sedan', name: 'Sedan', width: 1.78, wheelbase: 2.7, cgToFront: 1.35, track: 1.52, wheelRadius: 0.31 },
    { zMin: -2.3, zMax: 2.25, width: 0.89, noseY: 0.7, hoodY: 0.9, deckY: 0.96, tailY: 0.94, cabin: [-1.25, -0.75, 0.55, 1.2], roofY: 1.42, roofW: 0.66 },
    { parts(k) { headlights(k, 'slim'); grille(k, 0.3, 0.5); taillights(k, 'block'); plates(k, false); mirrors(k, 1.12); } }
  ),
  bodyModel(
    { id: 'hatch', name: 'Hatchback', width: 1.7, wheelbase: 2.5, cgToFront: 1.15, track: 1.46, wheelRadius: 0.29 },
    { zMin: -2.0, zMax: 1.95, width: 0.85, noseY: 0.66, hoodY: 0.88, deckY: 0.95, tailY: 0.94, cabin: [-1.95, -1.7, 0.3, 1.05], roofY: 1.45, roofW: 0.64, tailTaper: 0.96 },
    { tireWidth: 0.18, parts(k) { headlights(k, 'slim'); grille(k, 0.26, 0.5); taillights(k, 'block'); plates(k, false); mirrors(k, 0.98); } }
  ),
  bodyModel(
    { id: 'kei', name: 'Kei car', width: 1.48, wheelbase: 2.45, cgToFront: 1.22, track: 1.3, wheelRadius: 0.27 },
    { zMin: -1.7, zMax: 1.7, width: 0.74, noseY: 0.72, hoodY: 0.9, deckY: 0.95, tailY: 0.95, cabin: [-1.66, -1.55, 0.85, 1.25], roofY: 1.62, roofW: 0.66, tumble: 0.08, noseDrop: 1.2, noseTaper: 0.95, tailTaper: 0.98 },
    { tireWidth: 0.16, parts(k) { headlights(k, 'round'); grille(k, 0.2, 0.4); taillights(k, 'block'); plates(k, false); mirrors(k, 1.18); } }
  ),
  bodyModel(
    { id: 'wagon', name: 'Wagon', width: 1.78, wheelbase: 2.75, cgToFront: 1.35, track: 1.52, wheelRadius: 0.31 },
    { zMin: -2.45, zMax: 2.25, width: 0.89, noseY: 0.7, hoodY: 0.9, deckY: 0.97, tailY: 0.96, cabin: [-2.38, -2.2, 0.5, 1.2], roofY: 1.48, roofW: 0.67, tailTaper: 0.97 },
    {
      parts(k) {
        headlights(k, 'slim');
        grille(k, 0.3, 0.5);
        taillights(k, 'block');
        plates(k, false);
        mirrors(k, 1.12);
        k.mirror((s) => k.b.box('trim', s * 0.58, k.topY(-0.8) + 0.03, -0.8, 0.04, 0.04, 2.6));
      },
    }
  ),
  bodyModel(
    { id: 'taxi', name: 'Taxi', width: 1.7, wheelbase: 2.68, cgToFront: 1.3, track: 1.45, wheelRadius: 0.3 },
    { zMin: -2.4, zMax: 2.2, width: 0.85, noseY: 0.78, hoodY: 0.88, deckY: 0.92, tailY: 0.9, cabin: [-1.3, -0.9, 0.45, 1.0], roofY: 1.5, roofW: 0.68, noseTaper: 0.97, tailTaper: 0.97, noseDrop: 3, tumble: 0.16 },
    {
      rimColor: 0x9a9ea4,
      parts(k) {
        headlights(k, 'pair');
        grille(k, 0.3, 0);
        const f = endFace(k, 'front');
        k.b.box('chrome', 0, f.y0 + 0.07, k.zMax + 0.02, f.w * 2 + 0.06, 0.08, 0.06);
        const r = endFace(k, 'rear');
        k.b.box('chrome', 0, r.y0 + 0.07, k.zMin - 0.02, r.w * 2 + 0.06, 0.08, 0.06);
        taillights(k, 'block');
        plates(k, false);
        k.b.box('lamp', 0, k.topY(-0.2) + 0.09, -0.2, 0.42, 0.14, 0.16);
        k.mirror((s) => k.b.box('chrome', s * 0.62, k.topY(1.6) + 0.07, 1.6, 0.05, 0.07, 0.07));
      },
    }
  ),
  bodyModel(
    { id: 'suv', name: 'SUV', width: 1.9, wheelbase: 2.75, cgToFront: 1.3, track: 1.62, wheelRadius: 0.37 },
    { zMin: -2.5, zMax: 2.2, width: 0.95, rocker: 0.38, noseY: 0.92, hoodY: 1.08, deckY: 1.12, tailY: 1.1, cabin: [-2.42, -2.25, 0.55, 1.2], roofY: 1.75, roofW: 0.74, tumble: 0.2, noseTaper: 0.94, tailTaper: 0.97 },
    {
      flare: 0.04, tireWidth: 0.24, rimColor: 0x6e7278,
      parts(k) {
        headlights(k, 'slim');
        grille(k, 0.38, 0.55);
        taillights(k, 'block');
        plates(k, false);
        mirrors(k, 1.12);
        k.mirror((s) => k.b.box('trim', s * 0.6, k.topY(-0.7) + 0.04, -0.7, 0.05, 0.05, 2.4));
      },
    }
  ),
  bodyModel(
    { id: 'minivan', name: 'Minivan', width: 1.8, wheelbase: 2.9, cgToFront: 1.45, track: 1.55, wheelRadius: 0.32 },
    { zMin: -2.5, zMax: 2.3, width: 0.9, noseY: 0.8, hoodY: 1.0, deckY: 1.0, tailY: 1.0, cabin: [-2.44, -2.3, 1.0, 1.75], roofY: 1.78, roofW: 0.76, noseDrop: 1.3, tumble: 0.14, tailTaper: 0.98 },
    {
      parts(k) {
        headlights(k, 'slim');
        grille(k, 0.3, 0.5);
        taillights(k, 'block');
        plates(k, false);
        mirrors(k, 1.6);
        k.side('trim', -0.9, 0.2, 1.0, 1.03);
      },
    }
  ),
  bodyModel(
    { id: 'van', name: 'Panel van', width: 1.85, wheelbase: 3.0, cgToFront: 1.75, track: 1.6, wheelRadius: 0.32 },
    { zMin: -2.45, zMax: 2.45, width: 0.925, rocker: 0.3, noseY: 1.0, hoodY: 1.05, deckY: 1.05, tailY: 1.05, cabin: [-2.4, -2.3, 2.0, 2.4], roofY: 2.0, roofW: 0.85, tumble: 0.08, noseTaper: 0.97, tailTaper: 0.99, noseDrop: 1 },
    {
      glass: { side: [1.2, 2.35], front: [2.0, 2.4], rear: [-2.4, -2.3] },
      parts(k) {
        headlights(k, 'slim');
        grille(k, 0.4, 0.5);
        taillights(k, 'block');
        plates(k, false);
        mirrors(k, 2.1, 'trim');
        k.side('trim', 1.05, 1.08, 0.5, 1.9);
      },
    }
  ),
  bodyModel(
    { id: 'pickup', name: 'Pickup', width: 1.9, wheelbase: 3.1, cgToFront: 1.75, track: 1.6, wheelRadius: 0.36 },
    { zMin: -2.6, zMax: 2.6, width: 0.95, rocker: 0.4, noseY: 0.95, hoodY: 1.08, deckY: 1.12, tailY: 1.1, cabin: [-0.35, -0.2, 0.75, 1.35], roofY: 1.8, roofW: 0.76, tumble: 0.16, noseTaper: 0.95 },
    {
      flare: 0.04, tireWidth: 0.24, rimColor: 0x6e7278,
      parts(k) {
        headlights(k, 'slim');
        grille(k, 0.45, 0.55);
        taillights(k, 'block');
        plates(k, false);
        mirrors(k, 1.25);
        k.top('under', -0.82, 0.82, k.zMin + 0.08, -0.42, false, 0.004);
      },
    }
  ),
  bodyModel(
    { id: 'keitruck', name: 'Kei truck', width: 1.48, wheelbase: 1.9, cgToFront: 1.25, track: 1.3, wheelRadius: 0.26 },
    { zMin: -1.7, zMax: 1.7, width: 0.74, rocker: 0.3, noseY: 0.95, hoodY: 0.95, deckY: 0.9, tailY: 0.9, cabin: [-0.05, 0.05, 1.45, 1.66], roofY: 1.8, roofW: 0.68, tumble: 0.06, noseTaper: 0.97, tailTaper: 1, noseDrop: 1 },
    {
      tireWidth: 0.15, glass: { side: [0.6, 1.6], front: [1.45, 1.66], rear: [-0.05, 0.05] },
      parts(k) {
        headlights(k, 'round');
        taillights(k, 'block');
        plates(k, false);
        mirrors(k, 1.5, 'trim');
        k.top('under', -0.66, 0.66, k.zMin + 0.06, -0.12, false, 0.004);
      },
    }
  ),
  bodyModel(
    { id: 'truck', name: 'Box truck', width: 2.3, wheelbase: 4.7, cgToFront: 2.4, track: 1.9, wheelRadius: 0.5 },
    { zMin: 1.3, zMax: 3.6, width: 1.15, rocker: 0.55, noseY: 1.4, hoodY: 1.45, deckY: 1.45, tailY: 1.45, cabin: [1.35, 1.4, 3.35, 3.55], roofY: 2.75, roofW: 1.05, tumble: 0.06, noseTaper: 0.98, tailTaper: 1, noseDrop: 1, noseLift: 0, tailLift: 0 },
    {
      tireWidth: 0.3, accent: WHITE, glass: { side: [2.5, 3.35], front: [3.35, 3.55], rear: [0, 0] },
      parts(k) {
        headlights(k, 'slim');
        grille(k, 0.5, 0);
        cargo(k, -3.6, 1.2, 1.0, 3.2, 1.15);
        boxLamps(k, -3.6, 'tail', 1.0, 1.1, 0.24, true);
        mirrors(k, 3.3, 'trim');
      },
    }
  ),
  bodyModel(
    { id: 'tanker', name: 'Tanker', width: 2.4, wheelbase: 5.6, cgToFront: 3.3, track: 1.95, wheelRadius: 0.5 },
    { zMin: 2.2, zMax: 4.5, width: 1.2, rocker: 0.55, noseY: 1.4, hoodY: 1.45, deckY: 1.45, tailY: 1.45, cabin: [2.25, 2.3, 4.25, 4.45], roofY: 2.8, roofW: 1.1, tumble: 0.06, noseTaper: 0.98, tailTaper: 1, noseDrop: 1, noseLift: 0, tailLift: 0 },
    {
      tireWidth: 0.3, axles: [-3.5], glass: { side: [3.4, 4.25], front: [4.25, 4.45], rear: [0, 0] },
      parts(k) {
        headlights(k, 'slim');
        grille(k, 0.5, 0);
        k.b.cylinder('chrome', 0, 1.65, -1.25, 1.05, 6.4, 14, 'z');
        k.b.box('under', 0, 0.8, -1.0, 1.6, 0.3, 7.2);
        boxLamps(k, -4.45, 'tail', 0.9, 1.1, 0.24, true);
        mirrors(k, 4.2, 'trim');
      },
    }
  ),
  bodyModel(
    { id: 'bus', name: 'City bus', width: 2.5, wheelbase: 6.2, cgToFront: 3.6, track: 2.05, wheelRadius: 0.5 },
    { zMin: -5.25, zMax: 5.25, width: 1.25, rocker: 0.45, noseY: 1.3, hoodY: 1.35, deckY: 1.35, tailY: 1.35, cabin: [-5.15, -5.05, 5.0, 5.2], roofY: 2.5, roofW: 1.18, tumble: 0.07, noseTaper: 0.985, tailTaper: 0.985, noseDrop: 1, noseLift: 0, tailLift: 0 },
    {
      tireWidth: 0.3, accent: GREY,
      parts(k) {
        k.b.box('paint', 0, 2.78, 0, 2.36, 0.56, 10.3);
        k.b.box('accent', 0, 3.1, -0.5, 1.6, 0.12, 4.0);
        const f = endFace(k, 'front');
        k.mirror((s) => k.b.box('lamp', s * 0.95, f.y0 + 0.25, k.zMax + 0.01, 0.3, 0.14, 0.04));
        boxLamps(k, k.zMin, 'tail', 0.9, 1.15, 0.2, true);
        k.face('plate', 'front', -0.2, 0.2, f.y0 + 0.08, f.y0 + 0.2, false, 0.012);
        k.side('trim', -2.2, 4.4, 0.5, 0.52);
      },
    }
  ),
  bodyModel(
    { id: 'semi', name: 'Semi trailer', width: 2.5, wheelbase: 2.4, cgToFront: 7.0, track: 2.0, wheelRadius: 0.52 },
    { zMin: 5.6, zMax: 8.0, width: 1.2, rocker: 0.6, noseY: 1.5, hoodY: 1.55, deckY: 1.55, tailY: 1.55, cabin: [5.65, 5.7, 7.7, 7.95], roofY: 3.0, roofW: 1.1, tumble: 0.06, noseTaper: 0.98, tailTaper: 1, noseDrop: 1, noseLift: 0, tailLift: 0 },
    {
      tireWidth: 0.32, accent: WHITE, axles: [3.4, -5.2, -6.5], glass: { side: [6.8, 7.7], front: [7.7, 7.95], rear: [0, 0] },
      parts(k) {
        headlights(k, 'slim');
        grille(k, 0.55, 0);
        cargo(k, -8.0, 5.3, 1.3, 3.75, 1.25);
        k.b.box('under', 0, 1.0, 4.4, 1.0, 0.25, 2.6);
        boxLamps(k, -8.0, 'tail', 1.1, 1.15, 0.24, true);
        mirrors(k, 7.6, 'trim');
      },
    }
  ),
];

/** @type {Map<string, ReturnType<typeof bodyModel>>} */
export const CIVILIAN_MODEL_BY_ID = new Map(CIVILIAN_MODELS.map((m) => [m.id, m]));
