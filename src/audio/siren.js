/**
 * Police sirens and the helicopter's rotor, the parts that are numbers: which units are heard,
 * the pitch of each siren pattern over time, the Doppler shift from the closing speed, and how
 * loud a source is at a distance. Pure; audio.js turns the result into oscillators.
 *
 * A unit far off wails; one close behind the player yelps, the way a real driver switches when
 * they are on someone's bumper; a roadblock sits on hi-lo. Each unit runs its own phase.
 */

/** Speed of sound, m/s, for the Doppler shift. */
const SOUND = 343;
/** Units heard at once; the rest are drowned out by the nearest. */
export const SIREN_VOICES = 3;
/** A siren past this far is not heard, meters. */
export const SIREN_RANGE = 380;
/** A chasing unit this close switches from wail to yelp. */
const YELP_RANGE = 70;
/** The patterns: low and high pitch (Hz) and the seconds for one rise and fall (wail, yelp) or one tone (hi-lo). */
export const PATTERNS = {
  wail: { lo: 640, hi: 1380, period: 4.2 },
  yelp: { lo: 700, hi: 1500, period: 0.34 },
  hilo: { lo: 770, hi: 960, period: 0.55 },
};

/** @typedef {'wail' | 'yelp' | 'hilo'} Pattern */

/**
 * The pitch of a pattern at time t, Hz. Wail and yelp sweep up quickly and fall back slowly, like
 * a motor siren spinning up; hi-lo alternates two tones.
 * @param {Pattern} pattern @param {number} t seconds
 */
export function sirenPitch(pattern, t) {
  const p = PATTERNS[pattern];
  if (pattern === 'hilo') return Math.floor(t / p.period) % 2 ? p.lo : p.hi;
  const u = ((t / p.period) % 1 + 1) % 1;
  const k = u < 0.4 ? Math.sin((u / 0.4) * Math.PI / 2) : Math.cos(((u - 0.4) / 0.6) * Math.PI / 2);
  return p.lo + (p.hi - p.lo) * k;
}

/**
 * A pitch heard from a source closing at `closing` m/s (positive: coming nearer).
 * @param {number} f Hz @param {number} closing
 */
export function doppler(f, closing) {
  const v = Math.max(-150, Math.min(150, closing));
  return (f * SOUND) / (SOUND - v);
}

/** How loud a siren is at `d` meters, 0 to 1: loud up close, fading to nothing at SIREN_RANGE. @param {number} d */
export function sirenGain(d) {
  if (d >= SIREN_RANGE) return 0;
  const fade = 1 - d / SIREN_RANGE;
  return Math.min(1, 1 / (1 + d / 18) ** 1.2) * fade;
}

/**
 * The sirens the player hears this frame: the nearest SIREN_VOICES units with their bars on, each
 * with its pattern, pitch, gain, pan (-1 left to 1 right of the player's heading) and voice key
 * (the unit's id, so a voice follows one car).
 * @param {{ id: number, x: number, z: number, vx: number, vz: number, pursuit?: any, mode?: string }[]} units
 * @param {{ x: number, z: number, vx: number, vz: number, yaw: number }} player
 * @param {number} t seconds
 */
export function sirenVoices(units, player, t) {
  const heard = [];
  for (const u of units) {
    if (!u.pursuit && u.mode !== 'parked') continue;
    if (u.mode === 'wreck') continue;
    const dx = u.x - player.x;
    const dz = u.z - player.z;
    const d = Math.hypot(dx, dz);
    if (d >= SIREN_RANGE) continue;
    heard.push({ u, d, dx, dz });
  }
  heard.sort((a, b) => a.d - b.d);
  return heard.slice(0, SIREN_VOICES).map(({ u, d, dx, dz }) => {
    /** @type {Pattern} */
    const pattern = u.mode === 'parked' ? 'hilo' : d < YELP_RANGE && u.pursuit !== 'search' ? 'yelp' : 'wail';
    const nx = dx / Math.max(d, 1e-3);
    const nz = dz / Math.max(d, 1e-3);
    // Closing speed: how fast the unit and the player approach along the line between them.
    const closing = (player.vx - u.vx) * nx + (player.vz - u.vz) * nz;
    const left = Math.cos(player.yaw) * nx - Math.sin(player.yaw) * nz;
    return {
      key: u.id,
      pattern,
      pitch: doppler(sirenPitch(pattern, t + u.id * 0.61), closing),
      gain: sirenGain(d),
      pan: Math.max(-1, Math.min(1, -left)),
    };
  });
}

/**
 * The rotor of the helicopter: blade thump rate (Hz) and loudness 0 to 1 by distance, heard to
 * 900 m. The thump rises a little with the closing speed.
 * @param {number} d meters @param {number} closing m/s
 */
export function rotorSound(d, closing) {
  if (d >= 900) return { rate: 0, gain: 0 };
  return { rate: 11.5 * (SOUND / (SOUND - Math.max(-100, Math.min(100, closing)))), gain: Math.min(1, 1 / (1 + d / 40)) * (1 - d / 900) };
}
