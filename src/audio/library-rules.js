/**
 * The player's own music, as pure rules: which files count as audio, their titles and ids, how a pick
 * of files groups into folders, and how the music settings are saved and put back. library.js keeps
 * the files in the browser and catalog.js loads and saves; this file touches neither.
 */
import { MOODS, folderId } from './soundtrack.js';

/** The file types the player accepts, by extension. */
export const AUDIO_EXTENSIONS = ['mp3', 'm4a', 'aac', 'ogg', 'oga', 'opus', 'wav', 'flac', 'weba'];

/** Where loose songs (picked one by one, not as a folder) go. */
export const LOOSE_FOLDER = 'My Songs';

/** Whether a file name is a song the player can play. @param {string} name */
export function isAudioName(name) {
  const m = /\.([a-z0-9]+)$/i.exec(name);
  return !!m && AUDIO_EXTENSIONS.includes(m[1].toLowerCase());
}

/** The title shown for a file: its name with no folder, no extension and spaces for underscores. @param {string} name */
export function titleOf(name) {
  const base = name.slice(Math.max(name.lastIndexOf('/'), name.lastIndexOf('\\')) + 1);
  return base.replace(/\.[a-z0-9]+$/i, '').replace(/_+/g, ' ').replace(/\s+/g, ' ').trim() || base;
}

/** The id of a folder the player made: kept apart from the game's own. @param {string} name */
export function userFolderId(name) {
  return `u-${folderId(name)}`;
}

/**
 * The id of a song the player added: the same file added twice is the same song.
 * @param {string} folder a folder id @param {{ name: string, size: number }} file
 */
export function userTrackId(folder, file) {
  return `${folder}/${folderId(titleOf(file.name))}-${Math.max(0, Math.floor(file.size)).toString(36)}`;
}

/**
 * @typedef {{ name: string, size: number, path?: string }} Pick
 * a file the player picked: its name and size, and, when it came from a folder pick, its relative path
 * (`MyFolder/sub/song.mp3`, the browser's `webkitRelativePath`).
 */

/**
 * Sorts a pick into folders. A folder pick makes one folder of its top directory, subfolders included
 * (a playlist folder is one playlist); loose songs go into `into`, or the loose folder. Files that are
 * not audio are counted and left out.
 * @param {Pick[]} picks @param {string} [into] the name of the folder loose songs go into
 * @returns {{ folders: { name: string, files: Pick[] }[], skipped: number }}
 */
export function groupPicks(picks, into = LOOSE_FOLDER) {
  /** @type {Map<string, { name: string, files: Pick[] }>} */
  const groups = new Map();
  let skipped = 0;
  for (const p of picks) {
    if (!isAudioName(p.name)) {
      skipped++;
      continue;
    }
    const top = p.path && p.path.includes('/') ? p.path.split('/')[0] : '';
    const name = top || into || LOOSE_FOLDER;
    const id = userFolderId(name);
    let g = groups.get(id);
    if (!g) groups.set(id, (g = { name, files: [] }));
    g.files.push(p);
  }
  return { folders: [...groups.values()], skipped };
}

/** A natural order for titles: "Track 2" before "Track 10". @param {{ title: string }} a @param {{ title: string }} b */
export function byTitle(a, b) {
  return a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: 'base' });
}

/** Whether text needs the Japanese face (anything outside basic Latin). @param {string} text */
export function needsJp(text) {
  return /[^\u0000-ɏ]/.test(text);
}

/** A file size for the panel: "12.3 MB". @param {number} bytes */
export function sizeText(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

/** A time for the panel: 83.4 is "1:23". @param {number} seconds */
export function clockText(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '--:--';
  const s = Math.floor(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/**
 * What the music settings save: the options, for each folder whether it is on and the moods it plays
 * for, and the marks the player made on songs (which have a singer).
 * @param {import('./soundtrack.js').Folder[]} folders
 * @param {{ vocals: boolean, shuffle: boolean, lock: string | null }} options
 * @param {Record<string, boolean>} [marks] a song's id and whether it has vocals
 */
export function snapshotPrefs(folders, options, marks = {}) {
  /** @type {Record<string, { enabled: boolean, moods: string[] }>} */
  const byFolder = {};
  for (const f of folders) byFolder[f.id] = { enabled: f.enabled, moods: [...f.moods] };
  return { vocals: options.vocals, shuffle: options.shuffle, lock: options.lock, folders: byFolder, marks: { ...marks } };
}

/**
 * Puts saved settings back on the folders and the options, in place. A folder that is gone, a mood
 * that does not exist and a lock on a missing folder are ignored; a folder with no saved entry keeps
 * its own roles. The marks are put on `tracks` and returned. @param {import('./soundtrack.js').Folder[]} folders
 * @param {{ vocals: boolean, shuffle: boolean, lock: string | null }} options @param {any} prefs
 * @param {import('./soundtrack.js').Track[]} [tracks]
 * @returns {Record<string, boolean>} the marks
 */
export function applyPrefs(folders, options, prefs, tracks = []) {
  /** @type {Record<string, boolean>} */
  const marks = {};
  if (!prefs || typeof prefs !== 'object') return marks;
  if (typeof prefs.vocals === 'boolean') options.vocals = prefs.vocals;
  if (typeof prefs.shuffle === 'boolean') options.shuffle = prefs.shuffle;
  const saved = prefs.folders && typeof prefs.folders === 'object' ? prefs.folders : {};
  for (const f of folders) {
    const s = saved[f.id];
    if (!s || typeof s !== 'object') continue;
    if (typeof s.enabled === 'boolean') f.enabled = s.enabled;
    if (Array.isArray(s.moods)) f.moods = /** @type {any} */ (s.moods.filter((/** @type {any} */ m) => MOODS.includes(m)));
  }
  options.lock = typeof prefs.lock === 'string' && folders.some((f) => f.id === prefs.lock) ? prefs.lock : null;
  const m = prefs.marks && typeof prefs.marks === 'object' ? prefs.marks : {};
  for (const tr of tracks) {
    if (typeof m[tr.id] !== 'boolean') continue;
    tr.vocal = m[tr.id];
    marks[tr.id] = m[tr.id];
  }
  return marks;
}

/**
 * A folder's moods with one switched: on adds it (in the order of MOODS), off removes it.
 * @param {string[]} moods @param {string} mood @returns {import('./soundtrack.js').Mood[]}
 */
export function toggleMood(moods, mood) {
  const next = moods.includes(mood) ? moods.filter((m) => m !== mood) : [...moods, mood];
  return /** @type {any} */ (MOODS.filter((m) => next.includes(m)));
}
