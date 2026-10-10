/**
 * The music the game can play, put together: the tracks in assets/music (tracks.json), the folders and
 * songs the player added (library.js), and the music settings saved in localStorage. Browser only.
 * `loadCatalog` fills `SOUNDTRACK`, `FOLDERS` and `OPTIONS` (soundtrack.js); the setters below change
 * them, save, and tell whoever listens (the player, the Settings panel).
 */
import { store } from '../core/store.js';
import { FOLDERS, MANIFEST, OPTIONS, SOUNDTRACK, parseManifest, setSoundtrack } from './soundtrack.js';
import { applyPrefs, groupPicks, snapshotPrefs, toggleMood } from './library-rules.js';
import * as library from './library.js';

/** @type {{ tracks: import('./soundtrack.js').Track[], folders: import('./soundtrack.js').Folder[] } | null} */
let builtin = null;
/** @type {Promise<void> | null} */
let loading = null;
/** @type {(() => void)[]} */
const listeners = [];
/** What the player said about songs: an id and whether it has vocals. @type {Record<string, boolean>} */
let marks = {};
/** Whether the browser can keep the player's songs. */
export const status = { storage: true, error: '' };

/** Calls `fn` after the catalog changes. @param {() => void} fn @returns {() => void} the way to stop */
export function onCatalogChange(fn) {
  listeners.push(fn);
  return () => {
    const i = listeners.indexOf(fn);
    if (i >= 0) listeners.splice(i, 1);
  };
}

function changed() {
  for (const fn of listeners.slice()) fn();
}

async function readBuiltin() {
  if (builtin) return builtin;
  builtin = { tracks: [], folders: [] };
  try {
    const res = await fetch(MANIFEST, { cache: 'no-store' });
    if (res.ok) {
      const { tracks, folders, skipped } = parseManifest(await res.json());
      if (skipped.length) console.warn(`music: ${MANIFEST} skipped ${skipped.join(', ')}`);
      builtin = { tracks, folders };
    }
  } catch (err) {
    console.warn('music: no track list', err);
  }
  return builtin;
}

/** Builds the lists from the game's tracks and the player's, with the saved settings on them. */
async function assemble() {
  const base = await readBuiltin();
  let user = { tracks: /** @type {import('./soundtrack.js').Track[]} */ ([]), folders: /** @type {import('./soundtrack.js').Folder[]} */ ([]) };
  try {
    user = await library.loadUser();
    status.storage = true;
  } catch (err) {
    status.storage = false;
    status.error = String(err && /** @type {any} */ (err).message || err);
  }
  const folders = [...base.folders.map((f) => ({ ...f })), ...user.folders];
  const tracks = [...base.tracks, ...user.tracks];
  marks = applyPrefs(folders, OPTIONS, store.get('music', null), tracks);
  if (!setSoundtrack(tracks, folders)) {
    SOUNDTRACK.splice(0, SOUNDTRACK.length);
    FOLDERS.splice(0, FOLDERS.length, ...folders);
  }
}

/** Loads the catalog once (and again after `reload`). Never rejects: with nothing, the synthesized music plays. */
export function loadCatalog() {
  if (!loading) loading = assemble().catch((err) => console.warn('music: catalog', err)).then(changed);
  return loading;
}

/** Reads everything again (after songs were added or removed). */
export async function reload() {
  loading = assemble().catch((err) => console.warn('music: catalog', err)).then(changed);
  return loading;
}

function save() {
  store.set('music', snapshotPrefs(FOLDERS, OPTIONS, marks));
  changed();
}

/** @param {'vocals' | 'shuffle'} key @param {boolean} on */
export function setOption(key, on) {
  OPTIONS[key] = !!on;
  save();
}

/** Plays one folder on its own (or the mood music again with null). @param {string | null} id */
export function setLock(id) {
  OPTIONS.lock = id && FOLDERS.some((f) => f.id === id) ? id : null;
  save();
}

/** @param {string} id @param {boolean} on */
export function setFolderEnabled(id, on) {
  const f = FOLDERS.find((x) => x.id === id);
  if (!f) return;
  f.enabled = on;
  if (!on && OPTIONS.lock === id) OPTIONS.lock = null;
  persistFolder(f);
  save();
}

/** Switches one mood on or off for a folder. @param {string} id @param {string} mood */
export function toggleFolderMood(id, mood) {
  const f = FOLDERS.find((x) => x.id === id);
  if (!f) return;
  f.moods = toggleMood(f.moods, mood);
  persistFolder(f);
  save();
}

/** Says whether a song has a singer, which the vocals option goes by. @param {string} id @param {boolean} vocal */
export function setTrackVocal(id, vocal) {
  const tr = SOUNDTRACK.find((x) => x.id === id);
  if (!tr) return;
  tr.vocal = vocal;
  marks[id] = vocal;
  save();
}

/** @param {import('./soundtrack.js').Folder} f */
function persistFolder(f) {
  if (f.user) library.saveFolder(f.id, f).catch(() => {});
}

/**
 * Adds what the player picked (songs, or a folder of them). Returns how many songs were new, how many
 * files were not audio, and the id of the first folder touched.
 * @param {File[]} files @param {string} [into] the folder loose songs go into
 * @returns {Promise<{ added: number, skipped: number, folder: string | null }>}
 */
export async function addFiles(files, into) {
  const picks = files.map((f) => ({ name: f.name, size: f.size, path: /** @type {any} */ (f).webkitRelativePath || '', file: f }));
  const { folders, skipped } = groupPicks(picks, into);
  const groups = folders.map((g) => ({ name: g.name, files: g.files.map((p) => /** @type {any} */ (p).file) }));
  const { added, folders: touched } = await library.addGroups(groups);
  library.keepStorage();
  await reload();
  return { added, skipped, folder: touched[0] ?? null };
}

/** Deletes one of the player's folders. @param {string} id */
export async function removeUserFolder(id) {
  if (OPTIONS.lock === id) OPTIONS.lock = null;
  await library.removeFolder(id);
  await reload();
  save();
}

/** Bytes the player's songs take. */
export function storageUsed() {
  return library.usage().catch(() => 0);
}
