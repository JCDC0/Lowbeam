/**
 * The recorded soundtrack: which file plays when. Pure, no Web Audio: music.js streams the
 * files, this decides the mood from what the player is doing and which track comes next.
 *
 * The music lives in folders under assets/music/ (and in the folders the player adds): a folder is a
 * playlist, and carries the moods it plays for. Moods: `menu` (title, garage, loading), `cruise`
 * (driving around), `intense` (a street racer close by, or holding a high speed), `mountain` (Kuro
 * Pass, and the rally later) and `pursuit` (the police are after the player). A mood goes up quickly
 * and comes down slowly, so the music does not flick between tracks. A mood no folder plays for falls
 * back to a neighbor (`MOOD_FALLBACK`), and a track is picked from a shuffle bag, so the first track
 * is a surprise and nothing repeats until every track of the mood has played.
 */

/** @typedef {'menu' | 'cruise' | 'intense' | 'mountain' | 'pursuit'} Mood */
/**
 * @typedef {{
 *   id: string, title: string, file: string, folder: string, moods: Mood[], mood: Mood, lufs: number,
 *   vocal?: boolean, user?: boolean, url?: string,
 * }} Track
 * `file` is the path under assets/music/ (`Chill/Night Drive.m4a`); a track the player added has
 * `user` and an object URL in `url` instead. `mood` is the first of `moods`.
 * @typedef {{ id: string, name: string, moods: Mood[], enabled: boolean, user?: boolean }} Folder
 */

/** Every track is played back at this loudness (LUFS). */
export const TARGET_LUFS = -16;

/** The track list the game reads at start (written by `npm run music`, roles edited by hand). */
export const MANIFEST = 'assets/music/tracks.json';
/** The moods a track can play for. */
export const MOODS = /** @type {const} */ (['menu', 'cruise', 'intense', 'mountain', 'pursuit']);

/** What plays when no enabled folder has a track for a mood, nearest first. @type {Record<Mood, Mood[]>} */
export const MOOD_FALLBACK = {
  menu: ['cruise'],
  cruise: [],
  intense: ['cruise'],
  mountain: ['intense', 'cruise'],
  pursuit: ['intense', 'cruise'],
};

/** The moods a folder plays for when its manifest entry names none, by its name (lower case). */
export const DEFAULT_ROLES = {
  chase: ['pursuit'],
  chill: ['cruise', 'menu'],
  leisureracing: ['intense', 'mountain'],
};

/**
 * The folders and tracks in play: filled from the manifest (and the player's own folders), empty until
 * they load, when the synthesized tracks play. `setSoundtrack` replaces them in place.
 * @type {Track[]}
 */
export const SOUNDTRACK = [];
/** @type {Folder[]} */
export const FOLDERS = [];

/**
 * What the player chose in the music settings: whether tracks with vocals play, whether the order is a
 * shuffle, and a folder to play on its own whatever the mood (its id, or null for the mood music).
 * @type {{ vocals: boolean, shuffle: boolean, lock: string | null }}
 */
export const OPTIONS = { vocals: true, shuffle: true, lock: null };

/** A folder id from its name: "LeisureRacing" is "leisureracing". @param {string} name */
export const folderId = (name) => name.toLowerCase().replace(/[^a-z0-9\u3040-\u30ff\u4e00-\u9fff]+/g, '-').replace(/^-+|-+$/g, '') || 'music';

/**
 * The folders and tracks of a manifest, checked. A track needs a file and at least one known mood: its
 * own `moods` (or the old single `mood`), else its folder's. The id defaults to the file name, the
 * title to the id, the loudness to TARGET_LUFS (not measured yet). Entries that are not usable are left
 * out and named in `skipped`.
 * @param {any} json the parsed tracks.json: `{ folders?: [...], tracks: [...] }` or the array itself
 * @returns {{ tracks: Track[], folders: Folder[], skipped: string[] }}
 */
export function parseManifest(json) {
  const list = Array.isArray(json) ? json : json && Array.isArray(json.tracks) ? json.tracks : [];
  const named = json && Array.isArray(json.folders) ? json.folders : [];
  /** @type {Map<string, Folder>} */
  const folders = new Map();
  const known = (/** @type {any} */ ms) => (Array.isArray(ms) ? ms.filter((m) => MOODS.includes(m)) : []);
  for (const e of named) {
    const name = e && typeof e.name === 'string' && e.name ? e.name : '';
    const id = e && typeof e.id === 'string' && e.id ? e.id : folderId(name);
    if (!id || folders.has(id)) continue;
    const moods = known(e.moods);
    folders.set(id, { id, name: name || id, moods: moods.length ? moods : DEFAULT_ROLES[id] || [...MOODS], enabled: e.enabled !== false });
  }
  /** @type {Track[]} */
  const tracks = [];
  const skipped = [];
  const ids = new Set();
  for (const e of list) {
    const file = e && typeof e.file === 'string' ? e.file : '';
    const id = e && typeof e.id === 'string' && e.id ? e.id : file.replace(/\.[a-z0-9]+$/i, '');
    const dir = file.includes('/') ? file.slice(0, file.lastIndexOf('/')) : '';
    const fid = e && typeof e.folder === 'string' && e.folder ? e.folder : folderId(dir.split('/')[0] || 'music');
    if (!folders.has(fid)) folders.set(fid, { id: fid, name: dir.split('/')[0] || fid, moods: DEFAULT_ROLES[fid] || [...MOODS], enabled: true });
    const own = known(e && (e.moods || (e.mood ? [e.mood] : [])));
    const moods = own.length ? own : /** @type {Folder} */ (folders.get(fid)).moods;
    if (!file || !moods.length || ids.has(id) || e.enabled === false) {
      skipped.push(file || String(e && e.id));
      continue;
    }
    ids.add(id);
    tracks.push({
      id, file, folder: fid, moods, mood: moods[0],
      title: typeof e.title === 'string' && e.title ? e.title : id,
      lufs: Number.isFinite(e.lufs) ? e.lufs : TARGET_LUFS,
      vocal: !!e.vocal,
    });
  }
  return { tracks, folders: [...folders.values()], skipped };
}

/**
 * Plays these tracks and folders from now on. Any list with a track is taken, because a mood with
 * no track falls back to another. @param {Track[]} tracks @param {Folder[]} [folders]
 * @returns {boolean} whether the list was taken
 */
export function setSoundtrack(tracks, folders = []) {
  if (!tracks.length) return false;
  SOUNDTRACK.splice(0, SOUNDTRACK.length, ...tracks);
  FOLDERS.splice(0, FOLDERS.length, ...folders);
  return true;
}

/** Linear gain that brings a track to TARGET_LUFS. @param {Track} t */
export function trackGain(t) {
  return 10 ** ((TARGET_LUFS - t.lufs) / 20);
}

/** Whether a track may play now: its folder is on, and it has no vocals when they are off. @param {Track} t */
function playable(t) {
  const folder = FOLDERS.find((f) => f.id === t.folder);
  return (!folder || folder.enabled) && (OPTIONS.vocals || !t.vocal);
}

/**
 * The tracks that may play for a mood: the locked folder's, or the enabled folders' tracks that play
 * for the mood, or for the nearest mood that has any, or any enabled track.
 * @param {string} mood a `Mood`, or `'locked'`
 * @returns {Track[]}
 */
export function poolFor(mood) {
  if (OPTIONS.lock) {
    const own = SOUNDTRACK.filter((t) => t.folder === OPTIONS.lock && (OPTIONS.vocals || !t.vocal));
    if (own.length) return own;
  }
  const chain = [mood, .../** @type {Mood[]} */ (MOOD_FALLBACK[/** @type {Mood} */ (mood)] || [])];
  for (const m of chain) {
    const pool = SOUNDTRACK.filter((t) => t.moods.includes(/** @type {Mood} */ (m)) && playable(t));
    if (pool.length) return pool;
  }
  return SOUNDTRACK.filter(playable);
}

/** A shuffled copy. @template T @param {T[]} list @param {() => number} rng */
function shuffled(list, rng) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * A shuffle bag per key: every id is dealt once before any comes round again, and the first of a new
 * round is never the one that just played. Nothing is remembered between sessions, so the first track
 * of a mood is a surprise.
 */
export class Shuffler {
  /** @param {() => number} [rng] 0 to under 1 */
  constructor(rng = Math.random) {
    this.rng = rng;
    /** @type {Map<string, string[]>} */
    this.bags = new Map();
  }

  /**
   * @param {string} key the mood (or the lock) the bag belongs to
   * @param {string[]} ids what may play now @param {string | null} [lastId]
   * @returns {string | null}
   */
  next(key, ids, lastId = null) {
    if (!ids.length) return null;
    if (ids.length === 1) return ids[0];
    let bag = (this.bags.get(key) || []).filter((id) => ids.includes(id));
    if (!bag.length) {
      bag = shuffled(ids, this.rng);
      if (bag[0] === lastId) {
        const k = 1 + Math.floor(this.rng() * (bag.length - 1));
        [bag[0], bag[k]] = [bag[k], bag[0]];
      }
    }
    const id = /** @type {string} */ (bag.shift());
    this.bags.set(key, bag);
    return id;
  }
}

const SHARED = new Shuffler();

/**
 * Next track for a mood (or `'locked'` while a folder is locked): from the shuffle bag, or the next in
 * the folder's order when the shuffle is off; null when nothing may play.
 * @param {string} mood @param {string | null} lastId @param {Shuffler} [shuffler]
 * @returns {Track | null}
 */
export function nextTrack(mood, lastId, shuffler = SHARED) {
  const pool = poolFor(mood);
  if (!pool.length) return null;
  if (!OPTIONS.shuffle) {
    const at = pool.findIndex((t) => t.id === lastId);
    return pool[(at + 1) % pool.length];
  }
  const id = shuffler.next(OPTIONS.lock ? `lock:${OPTIONS.lock}` : mood, pool.map((t) => t.id), lastId);
  return pool.find((t) => t.id === id) || null;
}

/** How high a mood ranks: the music switches early only to go up. */
export const ENERGY = { menu: 0, cruise: 1, intense: 2, mountain: 3, pursuit: 4 };

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
 * on the pass, where the bends keep the speed down). It rises slowly (`rise` per second, about
 * 8 s from silence to full) and falls slower still, and only after `holdDown` seconds of lower speed,
 * so a braking zone does not cut the track. A street racer close by keeps it at least at
 * `rivalFloor`.
 */
export const SWELL = {
  quiet: 30,
  full: 75,
  fullMountain: 60,
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
   *   pursuit running (cooldown included), which is the pursuit mood at once, even on the pass
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
    this.mood = scene.pursuit ? 'pursuit' : this.mountain ? 'mountain' : this.intense ? 'intense' : 'cruise';
    return this.mood;
  }

  reset() {
    Object.assign(this, new MoodTracker());
  }
}
