/**
 * The soundtrack as data. Each track is composed here, deterministically, into a flat
 * list of note events that the player in music.js turns into sound. Pure: no Web Audio.
 *
 * A track is a chord progression over a minor scale plus patterns for each layer: pad
 * chords, a bass line, an arpeggio, a lead melody built from a motif, and drums on a
 * 16-step grid. Chords come from scale degrees, so everything stays in key. Times are
 * in beats from the start of the loop; a bar is four beats.
 *
 * @typedef {'pad' | 'bass' | 'arp' | 'lead' | 'kick' | 'snare' | 'hat' | 'perc'} Layer
 * @typedef {{ t: number, dur: number, midi: number, vel: number, layer: Layer, open?: boolean }} NoteEvent
 */

import { makeRng } from '../core/rng.js';

export const MINOR = [0, 2, 3, 5, 7, 8, 10];

/** Layers that exist in every track, in mixing order. */
export const LAYERS = /** @type {const} */ (['pad', 'bass', 'arp', 'lead', 'kick', 'snare', 'hat', 'perc']);

/**
 * MIDI note of a scale degree. Degrees may be negative or past the octave.
 * @param {number} root MIDI note of degree 0 @param {number[]} scale @param {number} degree
 */
export function degreeNote(root, scale, degree) {
  const n = scale.length;
  const oct = Math.floor(degree / n);
  return root + scale[((degree % n) + n) % n] + 12 * oct;
}

/** Scale degrees of the triad plus the seventh built on a degree. @param {number} d */
function chordDegrees(d) {
  return [d, d + 2, d + 4, d + 6];
}

/**
 * @typedef {{
 *   name: string, bpm: number, root: number, progression: number[], loops: number,
 *   bass: 'rolling' | 'offbeat' | 'gallop' | 'pedal',
 *   arp: { rate: number, pattern: number[], octave: number },
 *   drums: { kick: string, snare: string, hat: string, perc?: string, hatVel?: number[] },
 *   lead: { density: number, low: number, high: number },
 *   sidechain: boolean, bright: number, seed: number
 * }} TrackDef
 */

/** @type {Record<string, TrackDef>} */
export const TRACKS = {
  // Slow synthwave for cruising the valley: A minor, 92 bpm.
  kirigaoka: {
    name: 'KIRIGAOKA NIGHTS',
    bpm: 92,
    root: 57,
    progression: [0, 5, 2, 6, 0, 5, 6, 4],
    loops: 2,
    bass: 'rolling',
    arp: { rate: 0.5, pattern: [0, 1, 2, 3, 2, 1, 2, 3], octave: 12 },
    drums: { kick: 'x.....x.x.......', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.', hatVel: [0.7, 0.4, 0.55, 0.4] },
    lead: { density: 0.55, low: 64, high: 81 },
    sidechain: true,
    bright: 1,
    seed: 0x4b17,
  },
  // Street pace, four on the floor: D minor, 118 bpm.
  lowbeam: {
    name: 'LOW BEAM',
    bpm: 118,
    root: 50,
    progression: [0, 5, 2, 6],
    loops: 4,
    bass: 'offbeat',
    arp: { rate: 0.25, pattern: [0, 2, 1, 3, 2, 3, 1, 2], octave: 12 },
    drums: { kick: 'x...x...x...x...', snare: '....x.......x...', hat: '..o...o...o...o.', perc: '..x...x...x...x.', hatVel: [0.8, 0.5] },
    lead: { density: 0.7, low: 66, high: 86 },
    sidechain: true,
    bright: 1.25,
    seed: 0x1a2b,
  },
  // Rally stage, fast and tense: E minor, 138 bpm.
  ridge: {
    name: 'RIDGE RUN',
    bpm: 138,
    root: 52,
    progression: [0, 0, 5, 6, 0, 0, 3, 6],
    loops: 2,
    bass: 'gallop',
    arp: { rate: 0.25, pattern: [0, 0, 2, 0, 1, 0, 3, 1], octave: 12 },
    drums: { kick: 'x..x..x...x.x...', snare: '....x.......x..x', hat: 'xxxxxxxxxxxxxxxx', perc: '...............x', hatVel: [0.9, 0.35, 0.55, 0.35] },
    lead: { density: 0.8, low: 60, high: 79 },
    sidechain: true,
    bright: 1.4,
    seed: 0x77e5,
  },
  // Title and garage: slow, wide and heroic. F sharp minor, 76 bpm.
  menu: {
    name: 'NIGHT BRIEFING',
    bpm: 76,
    root: 54,
    progression: [0, 5, 2, 6],
    loops: 4,
    bass: 'pedal',
    arp: { rate: 0.5, pattern: [0, 2, 1, 3, 2, 1, 3, 2], octave: 12 },
    drums: { kick: 'x.......x.......', snare: '................', hat: 'x.x.x.x.x.x.x.x.', hatVel: [0.35, 0.2] },
    lead: { density: 0.55, low: 66, high: 85 },
    sidechain: false,
    bright: 0.8,
    seed: 0x9e31,
  },
};

const OFFBEAT = 'x.xx.x.xx.xx.x.x';
const GALLOP = 'x.xxx.xxx.xxx.xx';

/** Parses a 16-step drum string into (step, velocity, open) triples. @param {string} pattern */
function steps(pattern) {
  const out = [];
  for (let i = 0; i < pattern.length; i++) if (pattern[i] !== '.') out.push({ step: i, open: pattern[i] === 'o' });
  return out;
}

/**
 * A phrase for the lead: for each bar a rhythm drawn from a few shapes, with notes that
 * start on chord tones and walk by step through the scale. The last bar of a phrase
 * lands on the chord root or fifth.
 * @param {TrackDef} def @param {ReturnType<typeof makeRng>} rng @param {number[]} chordRoots degree per bar
 * @param {number} bars
 * @returns {NoteEvent[]}
 */
function leadPhrase(def, rng, chordRoots, bars) {
  /** @type {number[][][]} */
  const shapes = [
    [[0, 1.5], [1.5, 0.5], [2, 1], [3, 1]],
    [[0, 1], [1, 1], [2, 2]],
    [[0.5, 0.5], [1, 1.5], [2.5, 0.5], [3, 1]],
    [[0, 3]],
    [[0, 0.75], [0.75, 0.75], [1.5, 0.5], [2, 2]],
  ];
  const out = [];
  const lo = def.lead.low;
  const hi = def.lead.high;
  let deg = chordRoots[0] + 7;
  let last = degreeNote(def.root, MINOR, deg);
  for (let bar = 0; bar < bars; bar++) {
    if (rng.next() > def.lead.density && bar % 4 !== 0 && bar !== bars - 1) continue;
    const root = chordRoots[bar];
    const tones = chordDegrees(root).map((d) => d + 7);
    const shape = bar === bars - 1 ? [[0, 1.5], [1.5, 2.5]] : shapes[rng.int(0, shapes.length - 1)];
    shape.forEach(([at, len], i) => {
      if (i === 0 || rng.chance(0.4)) {
        // A chord tone, one of the two nearest the last note, so the line moves by step or small leap.
        const near = [...tones.slice(0, 3), ...tones.slice(0, 3).map((d) => d - 7)].sort((a, b) => Math.abs(degreeNote(def.root, MINOR, a) - last) - Math.abs(degreeNote(def.root, MINOR, b) - last));
        deg = near[rng.int(0, 1)];
      } else deg += rng.pick([-2, -1, 1, 1, 2]);
      if (bar === bars - 1 && i === shape.length - 1) deg = rng.chance(0.6) ? tones[0] : tones[2];
      while (degreeNote(def.root, MINOR, deg) > hi) deg -= 7;
      while (degreeNote(def.root, MINOR, deg) < lo) deg += 7;
      last = degreeNote(def.root, MINOR, deg);
      out.push({ t: bar * 4 + at, dur: Math.max(0.25, len * 0.92), midi: last, vel: 0.6 + 0.3 * rng.next() * (i === 0 ? 1.1 : 0.9), layer: 'lead' });
    });
  }
  return out;
}

/**
 * Composes a whole loop of a track.
 * @param {string} id key of TRACKS
 */
export function composeTrack(id) {
  const def = TRACKS[id];
  const rng = makeRng(def.seed);
  const barsPer = def.progression.length;
  const bars = barsPer * def.loops;
  /** @type {number[]} */
  const chordRoots = [];
  for (let i = 0; i < bars; i++) chordRoots.push(def.progression[i % barsPer]);
  /** @type {NoteEvent[]} */
  const events = [];
  const note = (d) => degreeNote(def.root, MINOR, d);

  for (let bar = 0; bar < bars; bar++) {
    const t0 = bar * 4;
    const d = chordRoots[bar];
    const tones = chordDegrees(d);
    for (const [k, deg] of tones.entries()) events.push({ t: t0, dur: 3.96, midi: note(deg), vel: 0.55 - 0.05 * k, layer: 'pad' });
    events.push({ t: t0, dur: 3.96, midi: note(d) - 12, vel: 0.4, layer: 'pad' });

    const bassRoot = note(d) - 24 < 33 ? note(d) - 12 : note(d) - 24;
    if (def.bass === 'rolling') {
      for (let i = 0; i < 8; i++) events.push({ t: t0 + i * 0.5, dur: 0.42, midi: bassRoot + ([0, 0, 12, 0, 0, 0, 12, 7][i]), vel: i % 2 ? 0.55 : 0.8, layer: 'bass' });
    } else if (def.bass === 'offbeat') {
      for (let i = 0; i < 16; i++) {
        if (OFFBEAT[i] === '.') continue;
        events.push({ t: t0 + i * 0.25, dur: 0.2, midi: bassRoot + (i % 4 === 3 ? 12 : 0), vel: i % 4 === 0 ? 0.9 : 0.65, layer: 'bass' });
      }
    } else if (def.bass === 'gallop') {
      for (let i = 0; i < 16; i++) {
        if (GALLOP[i] !== '.') events.push({ t: t0 + i * 0.25, dur: 0.2, midi: bassRoot + (i % 8 === 7 ? 12 : i % 8 === 5 ? 7 : 0), vel: i % 4 === 0 ? 0.95 : 0.7, layer: 'bass' });
      }
    } else {
      events.push({ t: t0, dur: 3.9, midi: bassRoot, vel: 0.8, layer: 'bass' });
      events.push({ t: t0 + 3, dur: 0.9, midi: bassRoot + 7, vel: 0.5, layer: 'bass' });
    }

    const rate = def.arp.rate;
    const count = Math.round(4 / rate);
    for (let i = 0; i < count; i++) {
      const idx = def.arp.pattern[i % def.arp.pattern.length];
      events.push({ t: t0 + i * rate, dur: rate * 0.85, midi: note(tones[idx]) + def.arp.octave, vel: i % 4 === 0 ? 0.75 : 0.5, layer: 'arp' });
    }

    const lastBarOfFour = bar % 4 === 3;
    for (const s of steps(def.drums.kick)) events.push({ t: t0 + s.step * 0.25, dur: 0.2, midi: 36, vel: s.step === 0 ? 1 : 0.85, layer: 'kick' });
    for (const s of steps(def.drums.snare)) events.push({ t: t0 + s.step * 0.25, dur: 0.2, midi: 38, vel: 0.9, layer: 'snare' });
    const hv = def.drums.hatVel || [0.6];
    for (const s of steps(def.drums.hat)) events.push({ t: t0 + s.step * 0.25, dur: s.open ? 0.4 : 0.1, midi: 42, vel: hv[s.step % hv.length], layer: 'hat', open: s.open });
    if (def.drums.perc) for (const s of steps(def.drums.perc)) events.push({ t: t0 + s.step * 0.25, dur: 0.25, midi: 50 - (s.step % 3) * 3, vel: 0.7, layer: 'perc' });
    if (bar === bars - 1 || (lastBarOfFour && bar % 8 === 7)) {
      for (let i = 0; i < 4; i++) events.push({ t: t0 + 3 + i * 0.25, dur: 0.2, midi: 38, vel: 0.5 + i * 0.12, layer: 'snare' });
    }
  }

  const phrase = barsPer;
  for (let p = 0; p < def.loops; p++) {
    const sub = leadPhrase(def, makeRng(def.seed + (p % 2) * 977), chordRoots.slice(p * phrase, (p + 1) * phrase), phrase);
    for (const e of sub) events.push({ ...e, t: e.t + p * phrase * 4 });
  }

  events.sort((a, b) => a.t - b.t || LAYERS.indexOf(a.layer) - LAYERS.indexOf(b.layer));
  return { id, name: def.name, bpm: def.bpm, bars, loopBeats: bars * 4, events, def };
}

/** MIDI note to frequency in Hz. @param {number} m */
export const midiToHz = (m) => 440 * Math.pow(2, (m - 69) / 12);
