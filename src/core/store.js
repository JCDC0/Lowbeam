/**
 * Small persistent state in localStorage: chosen car and paints, money, settings.
 * Every read falls back to a default, so a cleared or blocked storage still boots.
 */

const KEY = 'lowbeam.v1';

/** @type {Record<string, any>} */
let data = {};
try {
  data = JSON.parse(localStorage.getItem(KEY) || '{}') || {};
} catch {
  data = {};
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // Storage can be full or disabled. The game keeps running on the in-memory copy.
  }
}

export const store = {
  /** @template T @param {string} key @param {T} fallback @returns {T} */
  get(key, fallback) {
    return key in data ? data[key] : fallback;
  },
  /** @param {string} key @param {any} value */
  set(key, value) {
    data[key] = value;
    save();
  },
};
