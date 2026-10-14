/**
 * The engines of the cars around the player: which cars are heard, and what each one sounds
 * like. Pure; audio.js turns the result into oscillators and noise.
 *
 * Every kind belongs to a voice class (`VOICE_OF`), and every class is an engine: cylinders, idle
 * and redline, a gearbox spread over its top speed. A car's revs come from its speed through that
 * gearbox, its firing frequency from the revs, and the pitch the player hears from the Doppler
 * shift of the closing speed, so a bus at 40 km/h grumbles low and long and a street racer at
 * 250 screams up and drops away. The nearest `TRAFFIC_VOICES` cars are heard; each voice follows
 * one car by its id.
 */

import { doppler } from './siren.js';

/** Cars heard at once. */
export const TRAFFIC_VOICES = 4;
/** A car past this far is not heard, meters. */
export const TRAFFIC_RANGE = 110;

/**
 * @typedef {{
 *   cyl: number, idle: number, redline: number, gears: number, top: number,
 *   wave: OscillatorType, sub: number, cutoff: number, gain: number, tire: number,
 *   horn: [number, number]
 * }} VoiceClass
 * `top` is the speed in m/s the gearbox is spread over; `sub` the level of the octave below (the
 * body of a big engine); `cutoff` the low-pass over the voice at full revs; `tire` the road noise
 * at speed; `horn` the two notes of its horn, Hz.
 */

/** @type {Record<string, VoiceClass>} */
export const VOICES = {
  kei: { cyl: 3, idle: 950, redline: 7200, gears: 4, top: 36, wave: 'square', sub: 0.1, cutoff: 1500, gain: 0.5, tire: 0.35, horn: [560, 660] },
  sedan: { cyl: 4, idle: 750, redline: 6200, gears: 5, top: 50, wave: 'sawtooth', sub: 0.25, cutoff: 1100, gain: 0.55, tire: 0.5, horn: [400, 500] },
  six: { cyl: 6, idle: 700, redline: 5800, gears: 5, top: 52, wave: 'sawtooth', sub: 0.4, cutoff: 950, gain: 0.6, tire: 0.6, horn: [350, 440] },
  van: { cyl: 4, idle: 800, redline: 4400, gears: 5, top: 42, wave: 'square', sub: 0.45, cutoff: 700, gain: 0.6, tire: 0.6, horn: [330, 415] },
  diesel: { cyl: 6, idle: 600, redline: 2300, gears: 8, top: 30, wave: 'square', sub: 0.8, cutoff: 420, gain: 0.85, tire: 0.9, horn: [185, 233] },
  bus: { cyl: 6, idle: 620, redline: 2200, gears: 6, top: 26, wave: 'square', sub: 0.7, cutoff: 380, gain: 0.8, tire: 0.8, horn: [220, 277] },
  v8: { cyl: 8, idle: 750, redline: 6400, gears: 5, top: 70, wave: 'sawtooth', sub: 0.6, cutoff: 1300, gain: 0.8, tire: 0.6, horn: [370, 466] },
  racer: { cyl: 6, idle: 950, redline: 8200, gears: 6, top: 80, wave: 'sawtooth', sub: 0.3, cutoff: 2200, gain: 0.9, tire: 0.55, horn: [440, 554] },
  flat: { cyl: 4, idle: 900, redline: 7600, gears: 6, top: 70, wave: 'square', sub: 0.35, cutoff: 1700, gain: 0.85, tire: 0.55, horn: [440, 554] },
};

/** The voice class of each kind; street racers not named here are `racer`. @type {Record<string, string>} */
export const VOICE_OF = {
  kei: 'kei', keitruck: 'kei', sedan: 'sedan', hatch: 'sedan', wagon: 'sedan', taxi: 'sedan', minivan: 'van',
  suv: 'six', pickup: 'six', van: 'van', truck: 'diesel', tanker: 'diesel', semi: 'diesel', bus: 'bus',
  ambulance: 'van', firetruck: 'diesel', garbage: 'diesel', limo: 'six', exec: 'six', keivan: 'kei', offroad: 'six', coupe: 'v8',
  'rv-kei': 'kei', 'rv-v8drift': 'v8', 'rv-rampart': 'v8', 'rv-boxer': 'flat', 'rv-hayate': 'flat',
  police: 'v8', 'police-heavy': 'v8', 'police-fast': 'six', 'police-int': 'racer',
};

/** The voice class of a kind id. @param {string} id @returns {VoiceClass} */
export function voiceOf(id) {
  return VOICES[VOICE_OF[id] ?? (id.startsWith('rv-') ? 'racer' : 'sedan')];
}

/**
 * The revs of a class at a speed: idle from rest, then each gear pulling from about 55 % of the
 * redline to 88 % before the next.
 * @param {VoiceClass} v @param {number} speed m/s
 */
export function engineRpm(v, speed) {
  const span = v.top / v.gears;
  const s = Math.max(0, speed);
  const g = Math.min(v.gears - 1, Math.floor(s / span));
  const frac = Math.min(1.15, (s - g * span) / span);
  const from = g === 0 ? v.idle : v.redline * 0.55;
  return Math.min(v.redline, from + (v.redline * 0.88 - from) * frac);
}

/** The firing frequency at some revs, Hz: one pulse per cylinder every two turns. @param {VoiceClass} v @param {number} rpm */
export const firing = (v, rpm) => (rpm / 60) * (v.cyl / 2);

/** How loud a car is at `d` meters, 0 to 1. @param {number} d */
export function trafficGain(d) {
  if (d >= TRAFFIC_RANGE) return 0;
  return Math.min(1, 1 / (1 + d / 7) ** 1.3) * (1 - d / TRAFFIC_RANGE);
}

/**
 * A car's horn: its two notes, the wave (an air horn on the trucks and buses is brassier), and
 * how loud it is heard from `d` meters (horns carry further than engines).
 * @param {string} kindId @param {number} d
 * @returns {{ notes: [number, number], wave: OscillatorType, gain: number }}
 */
export function hornOf(kindId, d) {
  const cls = VOICE_OF[kindId] ?? (kindId.startsWith('rv-') ? 'racer' : 'sedan');
  const v = VOICES[cls];
  const air = cls === 'diesel' || cls === 'bus';
  return { notes: v.horn, wave: air ? 'sawtooth' : 'square', gain: d >= 160 ? 0 : (1 / (1 + d / 12)) * (1 - d / 160) * (air ? 1.3 : 1) };
}

/** Pan of a point seen from the player, -1 left to 1 right. @param {{ x: number, z: number, yaw: number }} player @param {number} x @param {number} z */
export function panOf(player, x, z) {
  const dx = x - player.x;
  const dz = z - player.z;
  const d = Math.max(1e-3, Math.hypot(dx, dz));
  const left = Math.cos(player.yaw) * (dx / d) - Math.sin(player.yaw) * (dz / d);
  return Math.max(-1, Math.min(1, -left));
}

/**
 * @typedef {{ key: number, wave: OscillatorType, pitch: number, sub: number, cutoff: number, gain: number, tire: number, tireFilter: number, pan: number, wet?: number }} TrafficVoice
 */

/**
 * The cars the player hears this frame, nearest first: wrecks are silent, as is a car on another
 * level of the road (a deck over a street).
 * @param {{ id: number, x: number, y: number, z: number, vx: number, vz: number, mode?: string, kind: { id: string }, barrier?: boolean }[]} agents
 * @param {{ x: number, y: number, z: number, vx: number, vz: number, yaw: number }} player
 * @param {number} [wet]
 * @returns {TrafficVoice[]}
 */
export function trafficVoices(agents, player, wet = 0) {
  const heard = [];
  for (const a of agents) {
    if (a.mode === 'wreck' || a.barrier) continue;
    if (Math.abs(a.y - player.y) > 8) continue;
    const dx = a.x - player.x;
    const dz = a.z - player.z;
    const d = Math.hypot(dx, dz);
    if (d >= TRAFFIC_RANGE) continue;
    heard.push({ a, d, dx, dz });
  }
  heard.sort((p, q) => p.d - q.d);
  return heard.slice(0, TRAFFIC_VOICES).map(({ a, d, dx, dz }) => {
    const v = voiceOf(a.kind.id);
    const speed = Math.hypot(a.vx, a.vz);
    const rpm = engineRpm(v, speed);
    const nx = dx / Math.max(d, 1e-3);
    const nz = dz / Math.max(d, 1e-3);
    const closing = (player.vx - a.vx) * nx + (player.vz - a.vz) * nz;
    const left = Math.cos(player.yaw) * nx - Math.sin(player.yaw) * nz;
    const rev = (rpm - v.idle) / (v.redline - v.idle);
    const near = trafficGain(d);
    const wetHiss = near * Math.min(1, speed / 25) * wet * 0.4;
    const tireFilter = 900 + wet * 1500;
    return {
      key: a.id,
      wave: v.wave,
      pitch: doppler(firing(v, rpm), closing),
      sub: v.sub,
      cutoff: v.cutoff * (0.45 + 0.55 * rev),
      gain: near * v.gain * (0.35 + 0.65 * rev),
      tire: near * v.tire * Math.min(1, speed / 30) + wetHiss,
      tireFilter,
      wet,
      pan: Math.max(-1, Math.min(1, -left)),
    };
  });
}
