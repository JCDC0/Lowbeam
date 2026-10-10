/**
 * The music player in Settings: what is playing and its transport, the folders (on or off, the moods each
 * plays for, one locked to play alone, their songs), and the player's own songs and folders. All of it
 * is clicks and touch; the Settings screen's MUSIC PLAYER row gives the keys (previous, next, pause).
 * Fonts: Michroma labels, M PLUS 1p for titles and folder names (they carry kana and kanji), Share Tech
 * Mono readouts and DSEG7 for the clock.
 */
import { audio } from '../audio/audio.js';
import { FOLDERS, MOODS, OPTIONS, SOUNDTRACK } from '../audio/soundtrack.js';
import { LOOSE_FOLDER, clockText, needsJp, sizeText } from '../audio/library-rules.js';
import * as catalog from '../audio/catalog.js';

/** What each mood is called on the panel. */
export const MOOD_NAMES = { menu: 'MENU', cruise: 'CRUISE', intense: 'RACE', mountain: 'PASS', pursuit: 'CHASE', locked: 'FOLDER' };

const ICON = {
  prev: '<svg viewBox="0 0 24 24"><path d="M5 5h3v14H5zM20 5v14L9 12z"/></svg>',
  next: '<svg viewBox="0 0 24 24"><path d="M16 5h3v14h-3zM4 5v14l11-7z"/></svg>',
  play: '<svg viewBox="0 0 24 24"><path d="M7 4v16l13-8z"/></svg>',
  pause: '<svg viewBox="0 0 24 24"><path d="M6 4h4v16H6zM14 4h4v16h-4z"/></svg>',
};

/** @param {string} s */
const esc = (s) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] || c);
/** The class that gives a name the Japanese face when it needs it. @param {string} s */
const jp = (s) => (needsJp(s) ? ' jp' : '');

/**
 * @param {{ onState?: (s: { paused: boolean, playing: boolean }) => void }} [opts] called as the player's
 *   state changes, for the Settings row that mirrors it
 */
export function musicPanel(opts = {}) {
  const el = document.createElement('div');
  el.className = 'mp';
  el.innerHTML = `
    <div class="mp-now">
      <div class="mp-kicker"><span id="mp-status">NOW PLAYING</span><span class="mp-mood" id="mp-mood"></span></div>
      <div class="mp-title" id="mp-title">--</div>
      <div class="mp-where" id="mp-where"></div>
      <div class="mp-bar"><i id="mp-fill"></i></div>
      <div class="mp-clock"><span id="mp-time">0:00</span><span id="mp-dur">0:00</span></div>
      <div class="mp-transport">
        <span class="mp-btn click" data-mp="prev" title="PREVIOUS">${ICON.prev}</span>
        <span class="mp-btn mp-play click" data-mp="play" id="mp-play" title="PLAY / PAUSE">${ICON.pause}</span>
        <span class="mp-btn click" data-mp="next" title="NEXT">${ICON.next}</span>
        <span class="ac-pill click" data-mp="shuffle" id="mp-shuffle">SHUFFLE</span>
        <span class="ac-pill click" data-mp="vocals" id="mp-vocals">VOCALS</span>
      </div>
    </div>
    <div class="mp-modes">
      <span class="mp-label">PLAYS</span>
      <span class="ac-pill click" data-mp="auto" id="mp-auto">MOOD MUSIC</span>
      <span class="mp-lockinfo" id="mp-lockinfo"></span>
    </div>
    <div class="mp-list" id="mp-list"></div>
    <div class="mp-add">
      <span class="ac-pill click" data-mp="add-folder">+ ADD FOLDER</span>
      <span class="ac-pill click" data-mp="add-songs">+ ADD SONGS</span>
      <span class="mp-store" id="mp-store"></span>
    </div>
    <div class="mp-note" id="mp-note"></div>
    <input type="file" id="mp-in-folder" webkitdirectory multiple hidden>
    <input type="file" id="mp-in-songs" accept="audio/*,.mp3,.m4a,.aac,.ogg,.opus,.wav,.flac" multiple hidden>`;

  /** @param {string} id */
  const q = (id) => /** @type {HTMLElement} */ (el.querySelector(`#${id}`));
  const list = q('mp-list');
  const folderInput = /** @type {HTMLInputElement} */ (q('mp-in-folder'));
  const songInput = /** @type {HTMLInputElement} */ (q('mp-in-songs'));

  /** The folder whose songs are listed. @type {string | null} */
  let open = null;
  /** The folder whose delete button was pressed once. @type {string | null} */
  let confirming = null;
  let confirmTimer = 0;
  let noteTimer = 0;
  let timer = 0;
  let unwatch = /** @type {(() => void) | null} */ (null);
  let lastPlaying = '';

  /** @param {string} text @param {boolean} [warn] */
  function note(text, warn = false) {
    const n = q('mp-note');
    n.textContent = text;
    n.classList.toggle('warn', warn);
    clearTimeout(noteTimer);
    if (text) noteTimer = window.setTimeout(() => (n.textContent = ''), 6000);
  }

  function renderList() {
    const now = audio.music?.state().track?.id ?? '';
    list.innerHTML = FOLDERS.map((f) => {
      const songs = SOUNDTRACK.filter((t) => t.folder === f.id);
      const locked = OPTIONS.lock === f.id;
      const tracks = open === f.id
        ? `<div class="mp-tracks">${songs.map((t, i) => `
            <div class="mp-track click${t.id === now ? ' now' : ''}" data-mp="song" data-id="${esc(t.id)}">
              <span class="mp-tn">${String(i + 1).padStart(2, '0')}</span>
              <span class="mp-tt${jp(t.title)}">${esc(t.title)}</span>
              <span class="mp-tv click${t.vocal ? ' on' : ''}" data-mp="vocal" data-id="${esc(t.id)}" title="MARK AS HAVING A SINGER">${t.vocal ? 'VOCAL' : 'INST'}</span>
            </div>`).join('')}</div>`
        : '';
      return `
        <div class="mp-folder${f.enabled ? ' on' : ''}${locked ? ' lock' : ''}${open === f.id ? ' open' : ''}">
          <div class="mp-fhead">
            <span class="mp-dot click${f.enabled ? ' on' : ''}" data-mp="folder-on" data-id="${esc(f.id)}" title="${f.enabled ? 'ON' : 'OFF'}"></span>
            <span class="mp-fname click${jp(f.name)}" data-mp="open" data-id="${esc(f.id)}">${esc(f.name.toUpperCase())}${f.user ? '<em>MINE</em>' : ''}</span>
            <span class="mp-fcount">${songs.length}</span>
            <span class="mp-fbtn click${locked ? ' on' : ''}" data-mp="lock" data-id="${esc(f.id)}">${locked ? 'LOCKED' : 'LOCK'}</span>
            ${f.user ? `<span class="mp-fbtn danger click${confirming === f.id ? ' on' : ''}" data-mp="remove" data-id="${esc(f.id)}">${confirming === f.id ? 'SURE?' : 'DELETE'}</span>` : ''}
          </div>
          <div class="mp-roles">${MOODS.map((m) => `<span class="mp-chip click${f.moods.includes(m) ? ' on' : ''}" data-mp="role" data-id="${esc(f.id)}" data-mood="${m}">${MOOD_NAMES[m]}</span>`).join('')}</div>
          ${tracks}
        </div>`;
    }).join('') || '<div class="mp-empty">NO TRACKS YET. ADD A FOLDER OF SONGS BELOW.</div>';
  }

  function renderOptions() {
    const sh = q('mp-shuffle');
    sh.textContent = OPTIONS.shuffle ? 'SHUFFLE ON' : 'SHUFFLE OFF';
    sh.classList.toggle('on', OPTIONS.shuffle);
    const vo = q('mp-vocals');
    vo.textContent = OPTIONS.vocals ? 'VOCALS ON' : 'VOCALS OFF';
    vo.classList.toggle('on', OPTIONS.vocals);
    q('mp-auto').classList.toggle('on', !OPTIONS.lock);
    const lockFolder = FOLDERS.find((f) => f.id === OPTIONS.lock);
    q('mp-lockinfo').textContent = lockFolder ? `LOCKED TO ${lockFolder.name.toUpperCase()}` : 'EACH FOLDER PLAYS FOR ITS MOODS';
    q('mp-lockinfo').className = `mp-lockinfo${lockFolder ? ' on' : ''}${lockFolder ? jp(lockFolder.name) : ''}`;
  }

  async function renderStore() {
    const out = q('mp-store');
    if (!catalog.status.storage) {
      out.textContent = 'STORAGE BLOCKED';
      return;
    }
    const bytes = await catalog.storageUsed();
    out.textContent = bytes ? `YOURS ${sizeText(bytes)}` : '';
  }

  function render() {
    renderOptions();
    renderList();
    renderStore();
    tick();
  }

  /** The now-playing block, called a few times a second while the panel is on screen. */
  function tick() {
    const m = audio.music;
    const s = m && m.state();
    const status = q('mp-status');
    if (!m || !s) {
      status.textContent = 'AUDIO STARTS ON YOUR FIRST KEY OR CLICK';
      q('mp-title').textContent = '--';
      q('mp-title').className = 'mp-title';
      opts.onState?.({ paused: false, playing: false });
      return;
    }
    const tr = s.track;
    status.textContent = !s.ready ? 'LOADING' : s.paused ? 'PAUSED' : tr ? 'NOW PLAYING' : s.synth ? 'SYNTHESIZED' : 'SILENT';
    const title = tr ? tr.title : s.synth ? 'NO RECORDED TRACK' : '--';
    q('mp-title').textContent = title;
    q('mp-title').className = `mp-title${jp(title)}`;
    q('mp-where').textContent = tr ? (s.folder || '').toUpperCase() : '';
    q('mp-where').className = `mp-where${jp(s.folder || '')}`;
    q('mp-mood').textContent = s.mood ? MOOD_NAMES[/** @type {keyof typeof MOOD_NAMES} */ (s.mood)] ?? '' : '';
    q('mp-time').textContent = clockText(s.time);
    q('mp-dur').textContent = s.duration ? clockText(s.duration) : '--:--';
    q('mp-fill').style.width = s.duration ? `${Math.min(100, (s.time / s.duration) * 100).toFixed(1)}%` : '0%';
    q('mp-play').innerHTML = s.paused ? ICON.play : ICON.pause;
    const id = tr ? tr.id : '';
    if (id !== lastPlaying) {
      lastPlaying = id;
      for (const row of list.querySelectorAll('.mp-track')) row.classList.toggle('now', /** @type {HTMLElement} */ (row).dataset.id === id);
    }
    opts.onState?.({ paused: s.paused, playing: !!tr });
  }

  /** @param {File[]} files @param {string} [into] */
  async function add(files, into) {
    if (!files.length) return;
    note(`ADDING ${files.length} FILE${files.length === 1 ? '' : 'S'}`);
    try {
      const { added, skipped, folder } = await catalog.addFiles(files, into);
      if (folder) open = folder;
      render();
      note(added || !skipped ? `ADDED ${added} SONG${added === 1 ? '' : 'S'}${skipped ? `, ${skipped} NOT AUDIO LEFT OUT` : ''}` : `NO SONG FOUND: ${skipped} FILE${skipped === 1 ? '' : 'S'} NOT AUDIO`, !added && !!skipped);
    } catch (err) {
      note('THE BROWSER WOULD NOT KEEP THE SONGS (PRIVATE WINDOW OR BLOCKED SITE DATA)', true);
      console.warn('music: add', err);
    }
  }

  folderInput.addEventListener('change', () => {
    const files = [...(folderInput.files || [])];
    folderInput.value = '';
    add(files);
  });
  songInput.addEventListener('change', () => {
    const files = [...(songInput.files || [])];
    songInput.value = '';
    const target = FOLDERS.find((f) => f.id === open && f.user);
    add(files, target ? target.name : LOOSE_FOLDER);
  });

  el.addEventListener('click', (e) => {
    const hit = /** @type {HTMLElement | null} */ ((/** @type {HTMLElement} */ (e.target)).closest('[data-mp]'));
    if (!hit) return;
    const act = hit.dataset.mp;
    const id = hit.dataset.id || '';
    const m = audio.music;
    const folder = FOLDERS.find((f) => f.id === id);
    switch (act) {
      case 'prev': m?.previous(); break;
      case 'next': m?.skip(); break;
      case 'play': {
        if (!m) break;
        if (m.paused) m.resume();
        else m.pause();
        break;
      }
      case 'shuffle': catalog.setOption('shuffle', !OPTIONS.shuffle); break;
      case 'vocals': catalog.setOption('vocals', !OPTIONS.vocals); break;
      case 'auto': catalog.setLock(null); break;
      case 'lock': catalog.setLock(OPTIONS.lock === id ? null : id); break;
      case 'folder-on': if (folder) catalog.setFolderEnabled(id, !folder.enabled); break;
      case 'role': catalog.toggleFolderMood(id, hit.dataset.mood || ''); break;
      case 'open': open = open === id ? null : id; renderList(); break;
      case 'song': {
        const song = SOUNDTRACK.find((t) => t.id === id);
        const home = song && FOLDERS.find((f) => f.id === song.folder);
        if (!m || !song || !home) break;
        if (!home.enabled) catalog.setFolderEnabled(home.id, true);
        if (OPTIONS.lock && OPTIONS.lock !== home.id) catalog.setLock(home.id);
        m.playId(id);
        tick();
        break;
      }
      case 'vocal': {
        const song = SOUNDTRACK.find((t) => t.id === id);
        if (song) catalog.setTrackVocal(id, !song.vocal);
        break;
      }
      case 'remove': {
        if (confirming !== id) {
          confirming = id;
          clearTimeout(confirmTimer);
          confirmTimer = window.setTimeout(() => {
            confirming = null;
            renderList();
          }, 3000);
          renderList();
        } else {
          confirming = null;
          if (open === id) open = null;
          catalog.removeUserFolder(id).then(() => note('FOLDER DELETED')).catch(() => note('COULD NOT DELETE THE FOLDER', true));
        }
        break;
      }
      case 'add-folder': folderInput.click(); break;
      case 'add-songs': songInput.click(); break;
      default: break;
    }
    audio.ui('select');
  });

  return {
    el,
    /** The panel is on screen: it follows the player and the catalog. @param {boolean} on */
    show(on) {
      clearInterval(timer);
      timer = 0;
      unwatch?.();
      unwatch = null;
      if (!on) return;
      catalog.loadCatalog().then(render);
      unwatch = catalog.onCatalogChange(render);
      timer = window.setInterval(tick, 250);
      render();
    },
  };
}
