/**
 * The recorded soundtrack: which file plays when. Pure, no Web Audio: music.js streams the
 * files, this decides the mood from what the player is doing and which track comes next.
 *
 * Moods: `menu` (title, garage, loading), `cruise` (driving around), `intense` (a street racer
 * close by, or holding a high speed) and `mountain` (Kuro Pass, and the rally later). A mood
 * goes up quickly and comes down slowly, so the music does not flick between tracks.
 */

/** @typedef {'menu' | 'cruise' | 'intense' | 'mountain'} Mood */
/** @typedef {{ id: string, title: string, file: string, mood: Mood, lufs: number }} Track */

/** Every track is played back at this loudness (LUFS). */
export const TARGET_LUFS = -16;

/**
 * The tracks in assets/music/. `lufs` is the measured integrated loudness
 * (`ffmpeg -af ebur128`), used to level them against each other.
 * @type {Track[]}
 */
export const SOUNDTRACK = [
  { id: 'shibuya-rain', title: 'Shibuya Rain', file: 'shibuya-rain.mp3', mood: 'menu', lufs: -16.3 },
  { id: 'shibuya-rain-vocal', title: 'Shibuya Rain (Vocal)', file: 'shibuya-rain-vocal.mp3', mood: 'menu', lufs: -17.5 },
  { id: 'midnight-expressway', title: 'Midnight Expressway', file: 'midnight-expressway.mp3', mood: 'cruise', lufs: -14.9 },
  { id: 'night-highway-drift', title: 'Night Highway Drift', file: 'night-highway-drift.mp3', mood: 'cruise', lufs: -16.7 },
  { id: 'redline-pact', title: 'Redline Pact', file: 'redline-pact.mp3', mood: 'intense', lufs: -15.9 },
  { id: 'dirt-to-crown', title: 'Dirt to Crown', file: 'dirt-to-crown.mp3', mood: 'intense', lufs: -15.0 },
  { id: 'touge-rush', title: 'Touge Rush', file: 'touge-rush.mp3', mood: 'mountain', lufs: -13.4 },
  { id: 'touge-overdrive', title: 'Touge Overdrive', file: 'touge-overdrive.mp3', mood: 'mountain', lufs: -13.1 },
];

/** Linear gain that brings a track to TARGET_LUFS. @param {Track} t */
export function trackGain(t) {
  return 10 ** ((TARGET_LUFS - t.lufs) / 20);
}

/**
 * Next track for a mood: any track of that mood but the one just played, in turn.
 * @param {Mood} mood @param {string | null} lastId @param {number} [turn] how many have played
 * @returns {Track}
 */
export function nextTrack(mood, lastId, turn = 0) {
  const pool = SOUNDTRACK.filter((t) => t.mood === mood);
  const list = pool.length > 1 ? pool.filter((t) => t.id !== lastId) : pool;
  return list[turn % list.length];
}

/** How high a mood ranks: the music switches early only to go up. */
export const ENERGY = { menu: 0, cruise: 1, intense: 2, mountain: 3 };

/** The thresholds of the driving moods. */
export const MOOD_RULES = {
  /** km/h that counts as fast, and how long it must be held. */
  fastKmh: 140,
  fastHold: 3,
  /** A street racer this close (m) makes it intense at once. */
  rivalNear: 150,
  /** Calm again: below this km/h, no racer within `rivalFar`, for `calmHold` seconds. */
  calmKmh: 110,
  rivalFar: 300,
  calmHold: 25,
  /** Seconds on (or off) the pass before the mountain mood starts (or ends). */
  mountainIn: 3,
  mountainOut: 10,
};

/**
 * How the music follows the speed while driving, the way Night-Runners does it: silent below
 * `quiet` km/h, swelling in as the car gets faster until it is full at `full` (`fullMountain`
 * on the pass, where nobody does 140). It rises slowly (`rise` per second, about 8 s from
 * silence to full) and falls slower still, and only after `holdDown` seconds of lower speed,
 * so a braking zone does not cut the track. A street racer close by keeps it at least at
 * `rivalFloor`.
 */
export const SWELL = {
  quiet: 50,
  full: 140,
  fullMountain: 100,
  rise: 0.13,
  fall: 0.06,
  holdDown: 3,
  rivalFloor: 0.55,
  /** A rally run holds the track up here, so it is never silent on the stage. */
  rallyFloor: 0.7,
  /** A police pursuit holds it higher still, through cooldown, whatever the speed. */
  pursuitFloor: 0.85,
};

/** Smooth 0 to 1 between a and b. @param {number} a @param {number} b @param {number} x */
function smooth(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/**
 * The music level (0 to 1) from the speed. music.js turns it into gain and a low-pass that
 * opens with it, so the track comes in muffled and escalates as the speed climbs.
 */
export class SpeedSwell {
  constructor() {
    this.level = 0;
    this.below = 0;
  }

  /**
   * @param {number} dt seconds since the last call
   * @param {{ kmh: number, mountain: boolean, rival: number, rally?: boolean, pursuit?: boolean }} scene
   * @returns {number} the level
   */
  update(dt, scene) {
    const S = SWELL;
    let want = smooth(S.quiet, scene.mountain ? S.fullMountain : S.full, scene.kmh);
    if (scene.rival < MOOD_RULES.rivalNear) want = Math.max(want, S.rivalFloor);
    if (scene.rally) want = Math.max(want, S.rallyFloor);
    if (scene.pursuit) want = Math.max(want, S.pursuitFloor);
    if (want >= this.level) {
      this.below = 0;
      this.level = Math.min(want, this.level + S.rise * dt);
    } else {
      this.below += dt;
      if (this.below >= S.holdDown) this.level = Math.max(want, this.level - S.fall * dt);
    }
    return this.level;
  }

  reset() {
    this.level = 0;
    this.below = 0;
  }
}

/**
 * Follows the driving situation and answers the mood. Call `update` a few times a second.
 */
export class MoodTracker {
  constructor() {
    /** @type {Mood} */
    this.mood = 'cruise';
    this.fast = 0;
    this.calm = 0;
    this.onPass = 0;
    this.offPass = 0;
    this.intense = false;
    this.mountain = false;
  }

  /**
   * @param {number} dt seconds since the last call
   * @param {{ kmh: number, mountain: boolean, rival: number, pursuit?: boolean }} scene `rival` is
   *   the distance to the nearest street racer in meters (Infinity for none); `pursuit` is a police
   *   pursuit running (cooldown included), which is the intense mood at once, even on the pass
   * @returns {Mood}
   */
  update(dt, scene) {
    const R = MOOD_RULES;
    this.fast = scene.kmh > R.fastKmh ? this.fast + dt : 0;
    const calm = scene.kmh < R.calmKmh && scene.rival > R.rivalFar;
    this.calm = calm ? this.calm + dt : 0;
    if (scene.rival < R.rivalNear || this.fast >= R.fastHold) this.intense = true;
    else if (this.calm >= R.calmHold) this.intense = false;
    this.onPass = scene.mountain ? this.onPass + dt : 0;
    this.offPass = scene.mountain ? 0 : this.offPass + dt;
    if (this.onPass >= R.mountainIn) this.mountain = true;
    else if (this.offPass >= R.mountainOut) this.mountain = false;
    if (scene.pursuit) this.intense = true;
    this.mood = scene.pursuit ? 'intense' : this.mountain ? 'mountain' : this.intense ? 'intense' : 'cruise';
    return this.mood;
  }

  reset() {
    Object.assign(this, new MoodTracker());
  }
}
