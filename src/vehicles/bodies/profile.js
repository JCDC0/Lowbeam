/**
 * Parametric car bodies: the station list for a body from a handful of dimensions, and
 * helpers that put the usual details on it (lamps, grille, plates, mirrors, wings, pipes).
 * A new body is a profile plus a few detail calls. Pure: the helpers only call the `Kit`
 * they are given.
 *
 * Car space as in models.js: +Z forward, +X is the car's LEFT, y up from the ground.
 */

/**
 * @typedef {{
 *   zMin: number, zMax: number, width: number,
 *   noseY: number, hoodY: number, deckY: number, tailY?: number,
 *   cabin?: number[], roofY?: number, roofW?: number,
 *   rocker?: number, sill?: number, shoulder?: number, tumble?: number,
 *   noseTaper?: number, tailTaper?: number, noseDrop?: number, noseLift?: number, tailLift?: number
 * }} Profile
 * `cabin` is [rear glass foot, rear roof edge, front roof edge, windshield foot] in z; leave it
 * out for an open car. Heights are belt-line heights: `hoodY` at the windshield foot, `noseY`
 * at the tip, `deckY` over the trunk, `tailY` at the tail edge.
 */

const clamp01 = (t) => Math.max(0, Math.min(1, t));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => t * t * (3 - 2 * t);

/**
 * The stations for a profile, rear to front.
 * @param {Profile} p @returns {number[][]}
 */
export function profileStations(p) {
  const rocker = p.rocker ?? 0.22;
  const sill = p.sill ?? 0.05;
  const shoulder = p.shoulder ?? 0.55;
  const tumble = p.tumble ?? 0.26;
  const noseTaper = p.noseTaper ?? 0.9;
  const tailTaper = p.tailTaper ?? 0.92;
  const noseDrop = p.noseDrop ?? 1.8;
  const tailY = p.tailY ?? p.deckY - 0.03;
  const cab = p.cabin ?? [lerp(p.zMin, p.zMax, 0.35), lerp(p.zMin, p.zMax, 0.4), lerp(p.zMin, p.zMax, 0.5), lerp(p.zMin, p.zMax, 0.55)];
  const [c0, c1, c2, c3] = cab;
  const belt = (z) => {
    if (z >= c3) return lerp(p.hoodY, p.noseY, clamp01((z - c3) / (p.zMax - c3)) ** noseDrop);
    if (z >= c0) return lerp(p.deckY, p.hoodY, (z - c0) / (c3 - c0));
    return lerp(tailY, p.deckY, ease(clamp01((z - p.zMin) / 0.3)));
  };
  const taper = (z) => {
    const n = ease(clamp01((z - (p.zMax - 0.55)) / 0.55));
    const t = ease(clamp01((p.zMin + 0.45 - z) / 0.45));
    return 1 - (1 - noseTaper) * n - (1 - tailTaper) * t;
  };
  const zs = [p.zMin, p.zMin + 0.08, p.zMin + 0.3, c0, (c0 + c1) / 2, c1, (c1 + c2) / 2, c2, c3, (c3 + p.zMax) / 2, p.zMax - 0.25, p.zMax - 0.08, p.zMax].sort((a, b) => a - b);
  const kept = zs.filter((z, i) => i === 0 || z - zs[i - 1] > 0.04);
  return kept.map((z) => {
    const k = taper(z);
    const y2 = belt(z);
    const lift = Math.max((p.noseLift ?? 0.09) * ease(clamp01((z - (p.zMax - 0.35)) / 0.35)), (p.tailLift ?? 0.1) * ease(clamp01((p.zMin + 0.3 - z) / 0.3)));
    const y0 = rocker + lift;
    const y1 = y0 + (y2 - y0) * shoulder;
    const w1 = p.width * k;
    const w0 = w1 - sill;
    const w2 = w1 - 0.035;
    let y3 = y2 + 0.03;
    let w3 = w2 - 0.08;
    if (p.cabin && p.roofY !== undefined) {
      const roofW = p.roofW ?? p.width - tumble;
      if (z > c0 && z < c3) {
        const top = z < c1 ? ease((z - c0) / (c1 - c0)) : z > c2 ? ease((c3 - z) / (c3 - c2)) : 1;
        y3 = lerp(y2 + 0.03, p.roofY, top);
        w3 = lerp(w2 - 0.08, roofW, Math.min(1, top * 1.6));
      }
    }
    return [z, y0, w0, y1, w1, y2, w2, y3, w3].map((v, i) => (i === 0 ? v : Math.round(v * 1000) / 1000));
  });
}

/**
 * A complete model: the dimensions plus a body from a profile and its details.
 * @param {{ id: string, name: string, width: number, wheelbase: number, cgToFront: number, track: number, wheelRadius: number }} car
 * @param {Profile} profile
 * @param {{ flare?: number, tireWidth?: number, rim?: 'rally' | 'muscle' | 'exotic', rimColor?: number, plate?: string,
 *   glass?: { side: number[], front: number[], rear: number[] }, axles?: number[], accent?: number[], parts: (k: any) => void }} look
 */
export function bodyModel(car, profile, look) {
  const stations = profileStations(profile);
  return {
    ...car,
    length: profile.zMax - profile.zMin,
    height: Math.max(...stations.map((s) => s[7])) + 0.03,
    body: {
      stations,
      glass: look.glass ?? profileGlass(profile),
      flare: look.flare ?? 0.02,
      tireWidth: look.tireWidth ?? 0.2,
      rim: look.rim ?? 'rally',
      rimColor: look.rimColor ?? 0x8c9096,
      plate: look.plate ?? 'KG 00-00',
      driver: -1,
      axles: look.axles,
      accent: look.accent,
      parts: look.parts,
    },
  };
}

/** Glass ranges that match a profile's cabin. @param {Profile} p */
export function profileGlass(p) {
  if (!p.cabin) return { side: [0, 0], front: [0, 0], rear: [0, 0] };
  const [c0, c1, c2, c3] = p.cabin;
  return { side: [c0 + 0.12, c3 - 0.05], front: [c2, c3], rear: [c0, c1] };
}

/**
 * The height range of an end face (rocker to belt) and its half width.
 * @param {any} k @param {'front' | 'rear'} end
 */
export function endFace(k, end) {
  const st = k.at(end === 'front' ? k.zMax : k.zMin);
  return { y0: st[1] + 0.04, y1: st[5] - 0.02, w: st[4] - 0.06 };
}

const at = (f, t) => f.y0 + (f.y1 - f.y0) * t;

/**
 * Headlamps on the nose. `style`: 'slim' (a wide strip), 'pair' (two lamps a side), 'round'
 * (square lamps standing in for round ones), 'hidden' (pop-ups: only a thin turn lamp).
 * @param {any} k @param {string} style
 */
export function headlights(k, style = 'slim', inset = 0.06) {
  const f = endFace(k, 'front');
  const x1 = f.w - inset;
  if (style === 'slim') k.face('lamp', 'front', x1 * 0.5, x1, at(f, 0.62), at(f, 0.8), true);
  else if (style === 'pair') {
    k.face('lamp', 'front', x1 * 0.72, x1, at(f, 0.55), at(f, 0.82), true);
    k.face('lamp', 'front', x1 * 0.46, x1 * 0.68, at(f, 0.55), at(f, 0.82), true);
  } else if (style === 'round') k.face('lamp', 'front', x1 * 0.62, x1 * 0.92, at(f, 0.5), at(f, 0.85), true);
  else k.face('lamp', 'front', x1 * 0.7, x1, at(f, 0.52), at(f, 0.6), true);
}

/** A grille between the lamps and a lower intake. @param {any} k */
export function grille(k, width = 0.32, intake = 0.62) {
  const f = endFace(k, 'front');
  k.face('trim', 'front', -width, width, at(f, 0.5), at(f, 0.8));
  if (intake > 0) k.face('under', 'front', -f.w * intake, f.w * intake, at(f, 0.06), at(f, 0.3));
}

/** Tail lamps. `style`: 'bar' (full width), 'block' (a lamp each side), 'round' (two a side). @param {any} k */
export function taillights(k, style = 'block') {
  const f = endFace(k, 'rear');
  const x1 = f.w - 0.04;
  if (style === 'bar') k.face('tail', 'rear', -x1, x1, at(f, 0.7), at(f, 0.86));
  else if (style === 'round') {
    k.face('tail', 'rear', x1 * 0.78, x1, at(f, 0.62), at(f, 0.86), true);
    k.face('tail', 'rear', x1 * 0.5, x1 * 0.72, at(f, 0.62), at(f, 0.86), true);
  } else k.face('tail', 'rear', x1 * 0.55, x1, at(f, 0.6), at(f, 0.86), true);
}

/** Front and rear plates, the rear one over a dark diffuser or bumper band. @param {any} k */
export function plates(k, diffuser = true) {
  const f = endFace(k, 'front');
  k.face('plate', 'front', -0.17, 0.17, at(f, 0.18), at(f, 0.42), false, 0.012);
  const r = endFace(k, 'rear');
  k.face('plate', 'rear', -0.18, 0.18, at(r, 0.3), at(r, 0.55), false, 0.012);
  if (diffuser) k.face('under', 'rear', -r.w * 0.8, r.w * 0.8, at(r, 0), at(r, 0.22));
}

/** Door mirrors at z, just above the belt line. @param {any} k @param {number} z */
export function mirrors(k, z, key = 'paint') {
  const st = k.at(z);
  k.mirror((s) => k.b.box(key, s * (st[4] + 0.05), st[5] + 0.06, z, 0.11, 0.07, 0.07));
}

/**
 * A rear wing on two posts. `z` is its center, `h` its height above the deck, `w` its half
 * span; `key` colors the blade.
 * @param {any} k @param {number} z @param {number} h @param {number} w
 */
export function wing(k, z, h, w, key = 'accent', chord = 0.24) {
  const deck = k.topY(z);
  k.b.box(key, 0, deck + h, z, w * 2, 0.035, chord);
  k.mirror((s) => {
    k.b.box(key, s * w, deck + h - 0.03, z, 0.02, 0.12, chord + 0.04);
    k.b.box('trim', s * w * 0.62, deck + h / 2, z - 0.02, 0.04, h, 0.08);
  });
}

/** Tailpipes at x offsets (left side positive), `y` high, poking out of the tail. @param {any} k @param {number[]} xs */
export function pipes(k, xs, y = 0.3, r = 0.045) {
  for (const x of xs) k.b.cylinder('chrome', x, y, k.zMin + 0.02, r, 0.2, 8, 'z', { capKey: 'under' });
}

/** A raised scoop or bulge on the hood at z. @param {any} k @param {number} z */
export function hoodScoop(k, z, w = 0.22, len = 0.5, h = 0.06, key = 'paint') {
  const y = k.topY(z);
  k.b.box(key, 0, y + h / 2 - 0.01, z, w * 2, h, len);
  k.face('under', z + len / 2 + 0.002, -w * 0.8, w * 0.8, y + 0.005, y + h - 0.015);
}

/** Dark side skirts along the rocker between the arches. @param {any} k */
export function skirts(k, key = 'trim') {
  k.side(key, k.rearAxle + 0.48, k.frontAxle - 0.48, k.at(0)[1], k.at(0)[1] + 0.09);
}
