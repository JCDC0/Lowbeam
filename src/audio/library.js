/**
 * The player's own music in the browser: folders and songs the player added, kept in IndexedDB so they
 * stay between visits. The files are copied in (the game never holds a path on the disk). Browser only;
 * the rules are in library-rules.js. Every call rejects when the browser has no storage (a private
 * window, blocked site data), and catalog.js carries on without the player's music then.
 */
import { MOODS, TARGET_LUFS } from './soundtrack.js';
import { byTitle, titleOf, userFolderId, userTrackId } from './library-rules.js';

const DB_NAME = 'lowbeam.music';
const VERSION = 1;

/** @type {Promise<IDBDatabase> | null} */
let opened = null;

function open() {
  if (opened) return opened;
  opened = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('no IndexedDB'));
      return;
    }
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      db.createObjectStore('folders', { keyPath: 'id' });
      db.createObjectStore('tracks', { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  opened.catch(() => {
    opened = null;
  });
  return opened;
}

/**
 * Runs `fn` on object stores in one transaction and resolves with its result once the transaction is done.
 * @template T @param {string[]} stores @param {'readonly' | 'readwrite'} mode
 * @param {(tx: IDBTransaction) => T | Promise<T>} fn @returns {Promise<T>}
 */
async function run(stores, mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(stores, mode);
    /** @type {T} */
    let out;
    tx.oncomplete = () => resolve(out);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
    Promise.resolve(fn(tx)).then((v) => {
      out = v;
    }, reject);
  });
}

/** @template T @param {IDBRequest<T>} req @returns {Promise<T>} */
function ask(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Object URLs of the songs already loaded, so a reload reuses them (a song playing must keep its URL). @type {Map<string, string>} */
const urls = new Map();

/**
 * Every folder and song the player added, as the game's own records (`user: true`, the song's object
 * URL in `url`), the songs of a folder in a natural order of their titles.
 * @returns {Promise<{ folders: import('./soundtrack.js').Folder[], tracks: import('./soundtrack.js').Track[] }>}
 */
export async function loadUser() {
  const { folderRows, trackRows } = await run(['folders', 'tracks'], 'readonly', async (tx) => ({
    folderRows: await ask(tx.objectStore('folders').getAll()),
    trackRows: await ask(tx.objectStore('tracks').getAll()),
  }));
  /** @type {import('./soundtrack.js').Folder[]} */
  const folders = folderRows.map((/** @type {any} */ r) => ({
    id: r.id,
    name: r.name,
    moods: Array.isArray(r.moods) ? r.moods.filter((/** @type {any} */ m) => MOODS.includes(m)) : [...MOODS],
    enabled: r.enabled !== false,
    user: true,
  }));
  folders.sort((a, b) => a.name.localeCompare(b.name));
  const known = new Set(folders.map((f) => f.id));
  /** @type {import('./soundtrack.js').Track[]} */
  const tracks = [];
  for (const r of trackRows) {
    if (!known.has(r.folder) || !(r.blob instanceof Blob)) continue;
    let url = urls.get(r.id);
    if (!url) urls.set(r.id, (url = URL.createObjectURL(r.blob)));
    const moods = /** @type {import('./soundtrack.js').Mood[]} */ ([]);
    tracks.push({ id: r.id, title: r.title, file: r.name, folder: r.folder, moods, mood: 'cruise', lufs: TARGET_LUFS, vocal: !!r.vocal, user: true, url, size: r.size });
  }
  tracks.sort(byTitle);
  return { folders, tracks };
}

/**
 * Copies songs into the player's folders. Each group is a folder (made if it is new) and the files that
 * go into it; a song that is there already (same name and size) is replaced by itself.
 * @param {{ name: string, files: File[] }[]} groups
 * @returns {Promise<{ folders: string[], added: number }>} the ids of the folders touched, and the new songs
 */
export async function addGroups(groups) {
  /** @type {string[]} */
  const touched = [];
  let added = 0;
  await run(['folders', 'tracks'], 'readwrite', async (tx) => {
    const fs = tx.objectStore('folders');
    const ts = tx.objectStore('tracks');
    for (const g of groups) {
      if (!g.files.length) continue;
      const id = userFolderId(g.name);
      const row = await ask(fs.get(id));
      if (!row) fs.put({ id, name: g.name, moods: [...MOODS], enabled: true });
      touched.push(id);
      for (const file of g.files) {
        const tid = userTrackId(id, file);
        const had = await ask(ts.getKey(tid));
        ts.put({ id: tid, folder: id, title: titleOf(file.name), name: file.name, size: file.size, type: file.type, blob: file, vocal: false });
        if (had === undefined) added++;
      }
    }
  });
  return { folders: touched, added };
}

/** Saves a folder's name-independent settings. @param {string} id @param {{ enabled: boolean, moods: string[] }} s */
export async function saveFolder(id, s) {
  await run(['folders'], 'readwrite', async (tx) => {
    const store = tx.objectStore('folders');
    const row = await ask(store.get(id));
    if (row) store.put({ ...row, enabled: s.enabled, moods: [...s.moods] });
  });
}

/** Marks a song of the player's as having a singer (or not). @param {string} id @param {boolean} vocal */
export async function setVocal(id, vocal) {
  await run(['tracks'], 'readwrite', async (tx) => {
    const store = tx.objectStore('tracks');
    const row = await ask(store.get(id));
    if (row) store.put({ ...row, vocal });
  });
}

/** Deletes one of the player's folders and every song in it. @param {string} id */
export async function removeFolder(id) {
  /** @type {string[]} */
  const gone = [];
  await run(['folders', 'tracks'], 'readwrite', async (tx) => {
    tx.objectStore('folders').delete(id);
    const ts = tx.objectStore('tracks');
    for (const r of await ask(ts.getAll())) {
      if (r.folder !== id) continue;
      ts.delete(r.id);
      gone.push(r.id);
    }
  });
  for (const tid of gone) forget(tid);
}

/** Deletes one of the player's songs. @param {string} id */
export async function removeTrack(id) {
  await run(['tracks'], 'readwrite', (tx) => {
    tx.objectStore('tracks').delete(id);
  });
  forget(id);
}

/** @param {string} id */
function forget(id) {
  const url = urls.get(id);
  if (url) URL.revokeObjectURL(url);
  urls.delete(id);
}

/** Bytes the player's songs take in the browser's storage. */
export async function usage() {
  const rows = await run(['tracks'], 'readonly', (tx) => ask(tx.objectStore('tracks').getAll()));
  return rows.reduce((/** @type {number} */ sum, /** @type {any} */ r) => sum + (r.size || 0), 0);
}

/** Asks the browser to keep the player's songs (it may otherwise clear them when space runs short). */
export async function keepStorage() {
  try {
    if (navigator.storage && navigator.storage.persist) await navigator.storage.persist();
  } catch {
    // A browser that says no still keeps the songs for now.
  }
}
