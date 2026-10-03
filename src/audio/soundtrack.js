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
  fastKmh: 150,
  fastHold: 4,
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
   * @param {{ kmh: number, mountain: boolean, rival: number }} scene `rival` is the distance to
   *   the nearest street racer in meters (Infinity for none)
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
    this.mood = this.mountain ? 'mountain' : this.intense ? 'intense' : 'cruise';
    return this.mood;
  }

  reset() {
    Object.assign(this, new MoodTracker());
  }
}
