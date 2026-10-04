/**
 * The pass-by whoosh: the sound of a car going past you, as strong as the speed between you.
 * Pure, no Web Audio and no three.js, so a test can step it and a Node script can render the
 * same voice offline to a WAV.
 *
 * `PassBy` is the tracker: it watches every nearby agent's relative position and velocity and
 * emits one event when the closest approach happens, so a car going past never whooshes twice
 * for the same pass and a car matching your speed beside you never whooshes at all.
 *
 * `renderPassby` is the voice itself: filtered noise with a swell and decay, a band-pass that
 * sweeps down through the pass (Doppler) and a low rumble for the heavy vehicles. `passbyGain`
 * is the loudness curve both the voice and the tests read, so a pass that should be violent and
 * one that should be nearly nothing are decided in one place.
 */

import { clamp } from '../core/mathx.js';

/** @typedef {{ speed: number, dist: number, side: number, heavy: boolean, kind: string }} PassByEvent */
/** @typedef {{ x: number, y: number, z: number, vx: number, vz: number, yaw: number }} PlayerState */
/** @typedef {{ id: number, x: number, y: number, z: number, vx: number, vz: number, kind: { id: string, mass: number } }} TrackedAgent */

/** How close a car has to be, in meters, before it is tracked at all. */
const RANGE = 80;
/** The miss distance that still counts as a pass, in meters. */
const MISS = 14;
/** The relative speed a pass has to make to be worth hearing, m/s. A creep under this is nothing. */
const MIN_SPEED = 4;
/** A car over this mass is heavy enough to get the low rumble (trucks, buses, tankers, semis). */
const HEAVY_MASS = 4000;

/** Seconds a pass lasts: a short blip at speed, a long sweep when slow. @param {number} speed */
export const passbyDuration = (speed) => 0.25 + 6 / Math.max(speed, 1);

/**
 * Loudness of a pass, 0 to about 1.6. Strong at 30 m/s and up, falling with the miss distance
 * so a car that goes past 14 m away is nearly nothing. Heavy vehicles get a little more body.
 * @param {number} speed relative speed in m/s @param {number} dist miss distance in meters
 * @param {boolean} [heavy]
 */
export function passbyGain(speed, dist, heavy = false) {
  const bySpeed = Math.pow(clamp((speed - MIN_SPEED) / (30 - MIN_SPEED), 0, 1), 1.1) * 1.6;
  const byDist = 0.12 + 0.88 * Math.pow(clamp(1 - (dist - 1.5) / (MISS - 1.5), 0, 1), 1.4);
  return bySpeed * byDist * (heavy ? 1.2 : 1);
}

/** The band-pass center at the start and the end of a pass: it sweeps down as the car recedes. */
function doppler(speed) {
  const near = 520 + speed * 34;
  return { from: Math.min(near, 5200), to: Math.max(near * 0.42, 180) };
}

/** One-pole state variable filter, used as the band-pass and the low-pass. */
function svf(fc, q, sampleRate) {
  let low = 0;
  let band = 0;
  const f = 2 * Math.sin((Math.PI * Math.min(fc, sampleRate * 0.45)) / sampleRate);
  const damp = 1 / Math.max(q, 0.5);
  /** @param {number} x */
  return (x) => {
    low += f * band;
    const high = x - low - damp * band;
    band += f * high;
    return high;
  };
}

/**
 * Renders one pass into a Float32Array, exactly as the live voice in `audio.js` plays it.
 * @param {PassByEvent} ev @param {number} sampleRate @param {number} [seconds]
 * @returns {Float32Array}
 */
export function renderPassby(ev, sampleRate, seconds = passbyDuration(ev.speed)) {
  const n = Math.round(seconds * sampleRate);
  const out = new Float32Array(n);
  const gain = passbyGain(ev.speed, ev.dist, ev.heavy);
  const dur = seconds;
  const bp = doppler(ev.speed);
  let band = svf(bp.from, 1.4, sampleRate);
  let rumble = ev.heavy ? svf(90, 0.7, sampleRate) : null;
  let low = 0;
  for (let i = 0; i < n; i++) {
    const t = i / n;
    const sweep = bp.from + (bp.to - bp.from) * Math.pow(t, 0.7);
    if (i % 64 === 0) band = svf(sweep, 1.4, sampleRate);
    // Swell fast, decay slow: the swell is the car arriving, the decay is it going.
    const env = Math.pow(Math.sin(Math.PI * Math.pow(t, 0.65)), 1.6);
    const noise = Math.random() * 2 - 1;
    let v = band(noise) * env * gain * 1.7;
    if (rumble) {
      low += (noise - low) * 0.06;
      v += (rumble(noise) * 0.5 + low * 0.5) * env * gain * 1.0;
    }
    out[i] = clamp(v, -1, 1);
  }
  return out;
}

export class PassBy {
  constructor() {
    /** @type {Map<number, { fired: boolean, dot: number }>} */
    this.tracked = new Map();
  }

  /**
   * Steps every nearby agent and returns the passes that just happened. The relative position
   * and velocity's dot product turns from negative (closing) to positive (opening) at the closest
   * approach; that is the only moment a whoosh is emitted, once per pass.
   * @param {PlayerState} player @param {TrackedAgent[]} agents @returns {PassByEvent[]}
   */
  update(player, agents) {
    const events = [];
    const seen = new Set();
    const px = player.x;
    const pz = player.z;
    const pvx = player.vx || 0;
    const pvz = player.vz || 0;
    // The player's own frame: -1 is its left, 1 its right.
    const fx = Math.sin(player.yaw);
    const fz = Math.cos(player.yaw);
    const lx = fz;
    const lz = -fx;
    for (const a of agents) {
      if (Math.abs(a.y - player.y) > 6) continue;
      const rx = a.x - px;
      const rz = a.z - pz;
      const dist = Math.hypot(rx, rz);
      if (dist > RANGE) {
        this.tracked.delete(a.id);
        continue;
      }
      seen.add(a.id);
      const rvx = a.vx - pvx;
      const rvz = a.vz - pvz;
      const relSpeed = Math.hypot(rvx, rvz);
      const dot = rx * rvx + rz * rvz;
      const prev = this.tracked.get(a.id);
      if (!prev) {
        this.tracked.set(a.id, { fired: false, dot });
        continue;
      }
      // Closing (dot negative) turning to opening (dot positive) is the closest approach.
      const passed = prev.dot < 0 && dot >= 0;
      prev.dot = dot;
      if (!passed || prev.fired) continue;
      if (dist > MISS || relSpeed < MIN_SPEED) continue;
      prev.fired = true;
      const heavy = a.kind.mass > HEAVY_MASS;
      // Which side of the player the car is on, in the player's own frame.
      const lateral = rx * lx + rz * lz;
      events.push({ speed: relSpeed, dist, side: lateral > 0 ? -1 : 1, heavy, kind: a.kind.id });
    }
    for (const id of [...this.tracked.keys()]) if (!seen.has(id)) this.tracked.delete(id);
    return events;
  }
}