import { audio, CHANNELS } from '../audio/audio.js';
import { store } from '../core/store.js';
import { SCREEN_FX, fxOn, setFx } from './screen-fx.js';

const FX_LABELS = { net: 'NET', vignette: 'VIGNETTE', blur: 'BLUR' };
import { RENDER_HEIGHTS, DEFAULT_LINES } from '../render/stage.js';
import { CLUSTER_STYLES } from './cluster-styles.js';
import { LEVELS, nextWeather } from '../render/weather.js';
import { applyTime, currentTime, currentWeather, saveTime, saveWeather } from './weather-setting.js';
import { nextTime } from '../render/daylight.js';
import { musicPanel } from './music-panel.js';
import { CONTROL_ACTIONS, ACTION_LABELS, PAD_LABELS, KEYS, keyLabel, rebind } from '../core/input.js';

/**
 * @param {HTMLElement} ui
 * @param {string} id
 * @param {string} html
 */
export function screen(ui, id, html) {
  const el = document.createElement('section');
  el.id = id;
  el.className = 'screen';
  el.innerHTML = html;
  ui.appendChild(el);
  return {
    el,
    /** @param {boolean} on */
    show(on) {
      el.classList.toggle('on', on);
    },
  };
}

/** @param {HTMLElement} ui @param {string} version */
export function titleScreen(ui, version) {
  return screen(
    ui,
    'title',
    `<div class="logo"><h1>LOWBEAM</h1><div class="sub-jp">黒鉄ナイトラン</div><h2>KUROGANE NIGHT RUN</h2></div>
     <div class="press">PRESS ENTER</div>
     <div class="foot">v${version} &nbsp; ALL MODELS, TEXTURES AND SOUNDS MADE IN CODE</div>`
  );
}

/** @param {HTMLElement} ui */
export function loadingScreen(ui) {
  const s = screen(ui, 'loading', `<div class="msg">LOADING</div>`);
  const msg = /** @type {HTMLElement} */ (s.el.querySelector('.msg'));
  return {
    ...s,
    /** @param {string} text */
    text(text) {
      msg.textContent = text;
    },
  };
}

/**
 * A short line of information near the top of the screen (a refuel, a toll, a camera): it slides
 * in and fades on its own.
 * @param {HTMLElement} ui
 */
export function toaster(ui) {
  const el = document.createElement('div');
  el.className = 'toast display';
  el.style.opacity = '0';
  ui.appendChild(el);
  let timer = 0;
  /** @param {string} text @param {number} [seconds] */
  return (text, seconds = 2.2) => {
    el.textContent = text;
    el.style.opacity = '1';
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
    clearTimeout(timer);
    timer = window.setTimeout(() => (el.style.opacity = '0'), seconds * 1000);
  };
}

/**
 * @typedef {'police' | 'good' | 'bad' | 'amber' | 'cool'} BannerTone
 * @typedef {(head: string, opts?: { sub?: string, tone?: BannerTone, seconds?: number }) => void} Banner
 */

/**
 * The event banner, after Most Wanted's: a big line in the middle of the screen that slams in
 * (scaled down from large in a fifth of a second), holds, and leaves in a sixth; a colored rule
 * above and below it by `tone` (police red over blue, green, red, amber, cyan) and an optional
 * second line. No pulsing: a new banner replaces the one showing.
 * @param {HTMLElement} ui
 * @returns {Banner}
 */
export function bannerer(ui) {
  const el = document.createElement('div');
  el.className = 'banner';
  el.innerHTML = '<b></b><span></span>';
  ui.appendChild(el);
  const head = /** @type {HTMLElement} */ (el.querySelector('b'));
  const sub = /** @type {HTMLElement} */ (el.querySelector('span'));
  let timer = 0;
  return (text, { sub: line = '', tone = 'amber', seconds = 2.2 } = {}) => {
    head.textContent = text;
    sub.textContent = line;
    sub.style.display = line ? 'block' : 'none';
    el.dataset.tone = tone;
    el.classList.remove('in', 'out');
    void el.offsetWidth;
    el.classList.add('in');
    clearTimeout(timer);
    timer = window.setTimeout(() => {
      el.classList.remove('in');
      el.classList.add('out');
    }, seconds * 1000);
  };
}

/**
 * A white flash over the whole screen, for a hit that matters (a unit taken out).
 * @param {HTMLElement} ui
 * @returns {() => void}
 */
export function flasher(ui) {
  const el = document.createElement('div');
  el.className = 'flash';
  ui.appendChild(el);
  return () => {
    el.classList.remove('go');
    void el.offsetWidth;
    el.classList.add('go');
  };
}

const MAIN_OPTIONS = /** @type {const} */ ([
  ['drive', '01', 'DRIVE', 'ドライブ', 'ENTRY TO VALLEY STAGE'],
  ['garage', '02', 'GARAGE', 'ガレージ', 'MACHINE SELECT & COLOR'],
  ['settings', '03', 'SETTINGS', '設定', 'AUDIO & TRANSMISSION CONFIG'],
  ['controls', '04', 'CONTROLS', '操作設定', 'PILOT INPUT ASSIGNMENT'],
]);

/**
 * Japanese arcade / Ace Combat styled Main Menu screen.
 * @param {HTMLElement} ui
 */
export function mainMenuScreen(ui) {
  const s = screen(
    ui,
    'menu',
    `<div class="ac-frame">
      <div class="ac-header">
        <div class="ac-tag">// KIRIGAOKA TACTICAL RALLY // SYSTEM: ONLINE</div>
        <div class="ac-title">MAIN MENU</div>
        <div class="ac-line"></div>
      </div>
      <div class="ac-body">
        <div class="ac-menu-list">
          ${MAIN_OPTIONS.map(([id, num, label, jp, sub]) => `
            <div class="ac-opt click" data-id="${id}">
              <span class="ac-num">${num}</span>
              <div class="ac-label-col">
                <span class="ac-label">${label}</span>
                <span class="ac-label-jp">${jp}</span>
              </div>
              <span class="ac-sub">${sub}</span>
              <span class="ac-arrow">▶</span>
            </div>
          `).join('')}
        </div>
        <div class="ac-info-panel">
          <div class="ac-info-header">MACHINE TELEMETRY</div>
          <div class="ac-info-row"><span class="k">SELECTED CAR</span><span class="v" id="menu-car-name">--</span></div>
          <div class="ac-info-row"><span class="k">DRIVETRAIN</span><span class="v" id="menu-car-drive">--</span></div>
          <div class="ac-info-row"><span class="k">TRANSMISSION</span><span class="v" id="menu-trans-mode">AUTOMATIC</span></div>
          <div class="ac-info-row"><span class="k">AUDIO DSP</span><span class="v">SYNTHESIZED ACTIVE</span></div>
          <div class="ac-info-badge" id="menu-status-badge">SYS: READY FOR RUN</div>
        </div>
      </div>
      <div class="hints">
        <b>W / S</b> NAVIGATE <b>ENTER / SPACE</b> SELECT <b>ESC</b> TITLE
      </div>
    </div>`
  );
  const opts = /** @type {HTMLElement[]} */ ([...s.el.querySelectorAll('.ac-opt')]);
  const carName = /** @type {HTMLElement} */ (s.el.querySelector('#menu-car-name'));
  const carDrive = /** @type {HTMLElement} */ (s.el.querySelector('#menu-car-drive'));
  const transMode = /** @type {HTMLElement} */ (s.el.querySelector('#menu-trans-mode'));
  let sel = 0;
  /** @type {string | null} */
  let clicked = null;
  const mark = () => opts.forEach((o, i) => o.classList.toggle('sel', i === sel));

  s.el.addEventListener('click', (e) => {
    const t = /** @type {HTMLElement} */ (e.target).closest('.ac-opt');
    if (t) clicked = /** @type {HTMLElement} */ (t).dataset.id;
  });

  mark();
  return {
    ...s,
    /** @param {boolean} on */
    show(on) {
      if (on) {
        sel = 0;
        mark();
        this.refresh();
      }
      s.show(on);
    },
    /** @param {import('../vehicles/specs.js').CarSpec} [spec] */
    refresh(spec) {
      if (spec) {
        carName.textContent = spec.name.toUpperCase();
        carDrive.textContent = `${spec.layout} // ${spec.gears.length}-SPEED`;
      }
      const isManual = store.get('transmission', /** @type {string} */ ('auto')) === 'manual';
      const gearCount = spec ? spec.gears.length : 6;
      transMode.textContent = isManual ? `MANUAL (${gearCount}-SPEED SEQ)` : 'AUTOMATIC';
    },
    /**
     * @param {import('../core/input.js').Input} input
     * @returns {'drive' | 'garage' | 'settings' | 'controls' | 'title' | null}
     */
    update(input) {
      if (clicked) {
        const c = clicked;
        clicked = null;
        audio.ui('select');
        return /** @type {any} */ (c);
      }
      if (input.pressed('back')) {
        audio.ui('back');
        return 'title';
      }
      if (input.pressed('up')) {
        sel = (sel + opts.length - 1) % opts.length;
        audio.ui('move');
        mark();
      }
      if (input.pressed('down')) {
        sel = (sel + 1) % opts.length;
        audio.ui('move');
        mark();
      }
      if (input.pressed('confirm')) {
        audio.ui('select');
        return MAIN_OPTIONS[sel][0];
      }
      return null;
    },
  };
}

/**
 * Settings menu: Transmission mode (Auto vs Manual) and synthesized audio channels.
 * @param {HTMLElement} ui
 */
export function settingsScreen(ui, stage = null) {
  /** @type {Record<import('../audio/audio.js').Channel, string>} */
  const CH_NAMES = {
    master: 'MASTER AUDIO',
    engine: 'ENGINE SOUND',
    effects: 'TIRES & WIND FX',
    ambience: 'ENVIRONMENT SOUNDS',
    music: 'SOUNDTRACK MUSIC',
    rain: 'RAIN AUDIO',
  };
  const HEIGHTS = RENDER_HEIGHTS;

  const s = screen(
    ui,
    'settings',
    `<div class="ac-frame">
      <div class="ac-header">
        <div class="ac-tag">// SYSTEM CONFIGURATION // RUNTIME PARAMETERS</div>
        <div class="ac-title">SETTINGS</div>
        <div class="ac-line"></div>
      </div>
      <div class="ac-body">
        <div class="ac-settings-table">
          <div class="ac-row click" data-row="trans">
            <span class="ac-rlabel">TRANSMISSION</span>
            <span class="ac-pill click" data-act="toggle-trans" id="set-trans-val">AUTO</span>
            <span class="hints-inline">MANUAL: [Q/E] OR [SHIFT/CTRL]</span>
          </div>
          <div class="ac-row click" data-row="render">
            <span class="ac-rlabel">RENDER HEIGHT</span>
            <span class="ac-pill click" data-act="toggle-render" id="set-render-val">240 LINES</span>
            <span class="hints-inline">TARGET: 240 / 360 / 480 LINES</span>
          </div>
          <div class="ac-row click" data-row="cluster">
            <span class="ac-rlabel">SPEEDOMETER</span>
            <span class="ac-pill click" data-act="toggle-cluster" id="set-cluster-val">PER CAR</span>
            <span class="hints-inline">PER CAR / CLASSIC / RACING / TWIN / SPORT / DIGITAL / VFD</span>
          </div>
          <div class="ac-row click" data-row="weather">
            <span class="ac-rlabel">WEATHER</span>
            <span class="ac-pill click" data-act="toggle-weather" id="set-weather-val">CLEAR</span>
            <span class="hints-inline">CLEAR / DRIZZLE / RAIN / STORM</span>
          </div>
          <div class="ac-row click" data-row="time">
            <span class="ac-rlabel">TIME OF DAY</span>
            <span class="ac-pill click" data-act="toggle-time" id="set-time-val">NIGHT</span>
            <span class="hints-inline">NIGHT / DUSK / DAWN / DAY / CYCLE</span>
          </div>
          <div class="ac-row click" data-row="fx">
            <span class="ac-rlabel">SCREEN FX</span>
            <span class="ac-pills">${SCREEN_FX.map((f) => `<span class="ac-pill click" data-act="toggle-fx" data-fx="${f}" id="set-fx-${f}">${FX_LABELS[f]}</span>`).join('')}</span>
          </div>
          <div class="ac-row click" data-row="controls">
            <span class="ac-rlabel">CONTROLS</span>
            <span class="ac-pill click" data-act="open-controls">CONFIGURE</span>
            <span class="hints-inline">CUSTOMIZE KEYBOARD BINDINGS</span>
          </div>
          ${CHANNELS.map((c) => `
            <div class="ac-row click" data-row="${c}">
              <span class="ac-rlabel">${CH_NAMES[c]}</span>
              <span class="ac-pill click" data-act="toggle-audio" data-ch="${c}" id="set-pill-${c}">ON</span>
              <div class="ac-meter" data-ch="${c}">
                ${Array.from({ length: 10 }, (_, i) => `<i class="seg click" data-ch="${c}" data-step="${i}"></i>`).join('')}
                <span class="pct" id="set-pct-${c}">80%</span>
              </div>
            </div>
          `).join('')}
          <div class="ac-row click" data-row="player">
            <span class="ac-rlabel">MUSIC PLAYER</span>
            <span class="ac-pill click" data-act="music-toggle" id="set-music-val">PAUSE</span>
            <span class="hints-inline">A / D PREVIOUS / NEXT TRACK</span>
          </div>
          <div class="ac-row click" data-row="back">
            <span class="ac-rlabel">BACK</span>
            <span class="ac-pill click" data-act="back">RETURN</span>
            <span class="hints-inline">SAVE & RETURN TO MENU</span>
          </div>
        </div>
        <div class="ac-side">
          <div class="ac-tabs"><span class="ac-tab click" data-tab="music">MUSIC</span><span class="ac-tab click" data-tab="help">HELP</span></div>
          <div class="ac-info-panel ac-tabpane mp-pane" data-pane="music"></div>
          <div class="ac-info-panel ac-tabpane" data-pane="help" hidden>
          <div class="ac-info-header">CONFIGURATION HELP</div>
          <div class="ac-info-row"><span class="k">TRANSMISSION</span><span class="v">AUTO / MANUAL</span></div>
          <div class="ac-info-row"><span class="k">DISPLAY TARGET</span><span class="v">240 TO 1080 LINES</span></div>
          <div class="ac-info-row"><span class="k">SPEEDOMETER</span><span class="v">PER CAR / 6 STYLES</span></div>
          <div class="ac-info-row"><span class="k">SCREEN FX</span><span class="v">NET / VIGNETTE / BLUR</span></div>
          <div class="ac-info-row"><span class="k">CONTROLS</span><span class="v">KEY BINDINGS</span></div>
          <div class="ac-notice">
            <b>MANUAL MODE:</b> Sequential shifting (N, R, 1..7). Tap <b>Shift</b> or <b>E</b> to upshift, <b>Ctrl</b> or <b>Q</b> to downshift. The rev limiter cuts ignition at redline. Over-rev downshifts cause money shift damage.<br><br>
            <b>RENDER HEIGHT:</b> Target vertical scanlines. 240 is the authentic PS1 resolution; 480 (default) keeps the dither and 15-bit color with a clearer picture.<br><br>
            <b>SPEEDOMETER:</b> HUD cluster style in outside views. PER CAR matches each vehicle's instruments; or lock to Classic, Racing, Twin, Sport, Digital or VFD.<br><br>
            <b>WEATHER:</b> Rain soaks the roads so the lamps shine in them, closes the fog in and streaks the air; a storm is the thickest. Looks only for now: the car grips the same.<br><br>
            <b>TIME OF DAY:</b> Night, dusk, dawn or day, or a cycle that runs from dusk through the night to the next day in 24 minutes. The lamps and the lit windows go out by day; rain brings the clouds.<br><br>
            <b>AUDIO DSP:</b> Procedural synthesis for engines, wind, tires and nature. Volumes and toggles save to local storage automatically.<br><br>
            <b>MUSIC:</b> Each folder of songs plays for the moods you give it: the menus, a quiet drive, a race, the pass, a police chase. Lock one folder to hear only it, switch a folder off, add your own songs or a whole folder, and mark the songs with a singer to skip them with VOCALS OFF. Your songs stay in this browser.
          </div>
          </div>
        </div>
      </div>
      <div class="hints">
        <b>W / S</b> ROW <b>A / D</b> ADJUST <b>ENTER / CLICK</b> TOGGLE <b>ESC</b> BACK
      </div>
    </div>`
  );

  const rows = /** @type {HTMLElement[]} */ ([...s.el.querySelectorAll('.ac-row')]);
  const transEl = /** @type {HTMLElement} */ (s.el.querySelector('#set-trans-val'));
  const renderEl = /** @type {HTMLElement} */ (s.el.querySelector('#set-render-val'));
  const clusterEl = /** @type {HTMLElement} */ (s.el.querySelector('#set-cluster-val'));
  const weatherEl = /** @type {HTMLElement} */ (s.el.querySelector('#set-weather-val'));
  const timeEl = /** @type {HTMLElement} */ (s.el.querySelector('#set-time-val'));
  const CLUSTER_CHOICES = ['car', ...CLUSTER_STYLES];
  const CLUSTER_LABELS = { car: 'PER CAR', classic: 'CLASSIC', tuner: 'RACING TACH', twin: 'TWIN DIAL', sport: 'SPORT TACH', digital: 'DIGITAL LCD', vfd: '1984 VFD' };
  let sel = 0;
  /** Which of the SCREEN FX row's three pills A and D point at. */
  let fxSel = 0;
  /** @type {string | null} */
  let clickedFx = null;
  /** @type {string | null} */
  let clickedAction = null;
  /** @type {string | null} */
  let clickedCh = null;
  /** @type {number | null} */
  let clickedStep = null;

  const mark = () => {
    if (rows[sel]?.dataset.row === 'player' && tab !== 'music') showTab('music');
    rows.forEach((r, i) => r.classList.toggle('sel', i === sel));
    SCREEN_FX.forEach((f, i) => /** @type {HTMLElement} */ (s.el.querySelector(`#set-fx-${f}`)).classList.toggle('focus', rows[sel]?.dataset.row === 'fx' && i === fxSel));
  };
  const FX_ROW = rows.findIndex((r) => r.dataset.row === 'fx');
  const WEATHER_ROW = rows.findIndex((r) => r.dataset.row === 'weather');
  const TIME_ROW = rows.findIndex((r) => r.dataset.row === 'time');
  const AUDIO_ROW = rows.findIndex((r) => r.dataset.row === CHANNELS[0]);
  const CONTROLS_ROW = rows.findIndex((r) => r.dataset.row === 'controls');
  const MUSIC_ROW = rows.findIndex((r) => r.dataset.row === 'player');
  const musicVal = /** @type {HTMLElement} */ (s.el.querySelector('#set-music-val'));
  const tabs = /** @type {HTMLElement[]} */ ([...s.el.querySelectorAll('.ac-tab')]);
  const panes = /** @type {HTMLElement[]} */ ([...s.el.querySelectorAll('.ac-tabpane')]);
  const player = musicPanel({
    onState: ({ paused, playing }) => {
      musicVal.textContent = !playing ? 'PLAY' : paused ? 'PLAY' : 'PAUSE';
      musicVal.classList.toggle('on', playing && !paused);
    },
  });
  /** @type {HTMLElement} */ (s.el.querySelector('[data-pane="music"]')).appendChild(player.el);
  /** The side of the screen shows the music player or the help; the choice is kept. @type {'music' | 'help'} */
  let tab = store.get('settingsTab', /** @type {string} */ ('music')) === 'help' ? 'help' : 'music';
  let visible = false;

  /** @param {'music' | 'help'} name */
  function showTab(name) {
    tab = name;
    store.set('settingsTab', name);
    tabs.forEach((x) => x.classList.toggle('on', x.dataset.tab === name));
    panes.forEach((p) => {
      p.hidden = p.dataset.pane !== name;
    });
    player.show(visible && name === 'music');
  }
  tabs.forEach((x) => x.addEventListener('click', () => {
    audio.ui('select');
    showTab(x.dataset.tab === 'help' ? 'help' : 'music');
  }));

  function toggleMusic() {
    const m = audio.music;
    if (!m) return;
    if (m.paused) m.resume();
    else m.pause();
  }

  function setRenderHeight(h) {
    store.set('renderHeight', h);
    const st = stage || window.__lowbeam?.stage;
    if (typeof st?.setHeight === 'function') st.setHeight(h);
    else if (typeof st?.configure === 'function') st.configure({ lines: h });
    sync();
  }

  function setClusterChoice(style) {
    store.set('clusterStyle', style);
    const drive = window.__lowbeam?.drive;
    if (drive?.cluster && drive.car?.spec) {
      drive.cluster.setSpec(drive.car.spec, style);
    }
    sync();
  }

  /** @param {import('../render/weather.js').Weather} w */
  function setWeatherChoice(w) {
    saveWeather(w);
    window.__lowbeam?.world?.setWeather(LEVELS[w]);
    sync();
  }

  /** @param {import('../render/daylight.js').TimeSetting} t */
  function setTimeChoice(t) {
    saveTime(t);
    const w = window.__lowbeam?.world;
    if (w) applyTime(w, t);
    sync();
  }

  function sync() {
    const isManual = store.get('transmission', /** @type {string} */ ('auto')) === 'manual';
    transEl.textContent = isManual ? 'MANUAL' : 'AUTO';
    transEl.classList.toggle('cyan', isManual);
    transEl.classList.toggle('on', !isManual);

    const curH = store.get('renderHeight', DEFAULT_LINES);
    renderEl.textContent = `${curH} LINES`;
    renderEl.classList.toggle('cyan', curH > 240);
    renderEl.classList.toggle('on', curH === 240);

    const curCluster = store.get('clusterStyle', 'car');
    clusterEl.textContent = CLUSTER_LABELS[curCluster] ?? String(curCluster).toUpperCase();
    clusterEl.classList.toggle('cyan', curCluster !== 'car');
    clusterEl.classList.toggle('on', curCluster === 'car');

    const curWeather = currentWeather();
    weatherEl.textContent = curWeather.toUpperCase();
    weatherEl.classList.toggle('cyan', curWeather !== 'clear');
    weatherEl.classList.toggle('on', curWeather === 'clear');

    const curTime = currentTime();
    timeEl.textContent = curTime.toUpperCase();
    timeEl.classList.toggle('cyan', curTime !== 'night');
    timeEl.classList.toggle('on', curTime === 'night');

    for (const f of SCREEN_FX) {
      const pill = /** @type {HTMLElement} */ (s.el.querySelector(`#set-fx-${f}`));
      pill.classList.toggle('on', fxOn(f));
      pill.classList.toggle('off', !fxOn(f));
    }

    for (const c of CHANNELS) {
      const setting = audio.settings[c];
      const pill = /** @type {HTMLElement | null} */ (s.el.querySelector(`#set-pill-${c}`));
      const pct = /** @type {HTMLElement | null} */ (s.el.querySelector(`#set-pct-${c}`));
      if (pill) {
        pill.textContent = setting.on ? 'ON' : 'OFF';
        pill.classList.toggle('on', setting.on);
      }
      if (pct) {
        pct.textContent = setting.on ? `${Math.round(setting.volume * 100)}%` : 'MUTED';
      }
      const segs = s.el.querySelectorAll(`.seg[data-ch="${c}"]`);
      const filled = setting.on ? Math.round(setting.volume * 10) : 0;
      segs.forEach((seg, idx) => seg.classList.toggle('on', idx < filled));
    }
  }

  s.el.addEventListener('click', (e) => {
    const target = /** @type {HTMLElement} */ (e.target);
    const seg = target.closest('.seg');
    if (seg) {
      clickedAction = 'step';
      clickedCh = /** @type {HTMLElement} */ (seg).dataset.ch || null;
      clickedStep = Number((/** @type {HTMLElement} */ (seg)).dataset.step);
      return;
    }
    const act = target.closest('[data-act]');
    if (act) {
      clickedAction = (/** @type {HTMLElement} */ (act)).dataset.act || null;
      clickedCh = (/** @type {HTMLElement} */ (act)).dataset.ch || null;
      clickedFx = (/** @type {HTMLElement} */ (act)).dataset.fx || null;
      return;
    }
    const row = target.closest('.ac-row');
    if (row) {
      const rowId = (/** @type {HTMLElement} */ (row)).dataset.row;
      if (rowId === 'back') {
        clickedAction = 'back';
        return;
      }
      if (rowId === 'trans') {
        clickedAction = 'toggle-trans';
        return;
      }
      if (rowId === 'render') {
        clickedAction = 'toggle-render';
        return;
      }
      if (rowId === 'cluster') {
        clickedAction = 'toggle-cluster';
        return;
      }
      if (rowId === 'weather') {
        clickedAction = 'toggle-weather';
        return;
      }
      if (rowId === 'time') {
        clickedAction = 'toggle-time';
        return;
      }
      if (rowId === 'controls') {
        clickedAction = 'open-controls';
        return;
      }
      const idx = rows.indexOf(/** @type {HTMLElement} */ (row));
      if (idx !== -1) {
        sel = idx;
        mark();
      }
    }
  });

  /** @type {(() => void) | null} */
  let unbindAudio = null;

  mark();
  return {
    ...s,
    /** @param {boolean} on */
    show(on) {
      if (on) {
        sync();
        if (!unbindAudio) unbindAudio = audio.onChange(sync);
      } else if (unbindAudio) {
        unbindAudio();
        unbindAudio = null;
      }
      visible = on;
      showTab(tab);
      s.show(on);
    },
    /**
     * @param {import('../core/input.js').Input} input
     * @returns {'back' | 'controls' | null}
     */
    update(input) {
      if (clickedAction) {
        const action = clickedAction;
        const ch = /** @type {import('../audio/audio.js').Channel | null} */ (clickedCh);
        const step = clickedStep;
        clickedAction = null;
        clickedCh = null;
        clickedStep = null;

        if (action === 'toggle-fx' && clickedFx) {
          setFx(/** @type {import('./screen-fx.js').ScreenFx} */ (clickedFx));
          clickedFx = null;
          audio.ui('select');
          sync();
        } else if (action === 'toggle-trans') {
          const cur = store.get('transmission', /** @type {string} */ ('auto'));
          store.set('transmission', cur === 'auto' ? 'manual' : 'auto');
          audio.ui('select');
          sync();
        } else if (action === 'toggle-render') {
          const curH = store.get('renderHeight', DEFAULT_LINES);
          const nextH = HEIGHTS[(HEIGHTS.indexOf(curH) + 1) % HEIGHTS.length];
          setRenderHeight(nextH);
          audio.ui('select');
        } else if (action === 'toggle-cluster') {
          const curC = store.get('clusterStyle', 'car');
          const nextC = CLUSTER_CHOICES[(CLUSTER_CHOICES.indexOf(curC) + 1) % CLUSTER_CHOICES.length];
          setClusterChoice(nextC);
          audio.ui('select');
        } else if (action === 'toggle-weather') {
          setWeatherChoice(nextWeather(currentWeather()));
          audio.ui('select');
        } else if (action === 'toggle-time') {
          setTimeChoice(nextTime(currentTime()));
          audio.ui('select');
        } else if (action === 'open-controls') {
          audio.ui('select');
          return 'controls';
        } else if (action === 'music-toggle') {
          toggleMusic();
          audio.ui('select');
        } else if (action === 'toggle-audio' && ch) {
          audio.toggle(ch);
          audio.ui('select');
          sync();
        } else if (action === 'step' && ch && step !== null) {
          audio.setOn(ch, true);
          audio.setVolume(ch, (step + 1) / 10);
          audio.ui('move');
          sync();
        } else if (action === 'back') {
          audio.ui('back');
          return 'back';
        }
      }

      if (input.pressed('back')) {
        audio.ui('back');
        return 'back';
      }
      if (input.pressed('up')) {
        sel = (sel + rows.length - 1) % rows.length;
        audio.ui('move');
        mark();
      }
      if (input.pressed('down')) {
        sel = (sel + 1) % rows.length;
        audio.ui('move');
        mark();
      }
      if (input.pressed('left')) {
        if (sel === FX_ROW) {
          fxSel = (fxSel + SCREEN_FX.length - 1) % SCREEN_FX.length;
          audio.ui('move');
          mark();
        } else if (sel === 0) {
          const cur = store.get('transmission', /** @type {string} */ ('auto'));
          store.set('transmission', cur === 'auto' ? 'manual' : 'auto');
          audio.ui('select');
          sync();
        } else if (sel === 1) {
          const curH = store.get('renderHeight', DEFAULT_LINES);
          const idx = HEIGHTS.indexOf(curH);
          const nextH = HEIGHTS[(idx + HEIGHTS.length - 1) % HEIGHTS.length];
          setRenderHeight(nextH);
          audio.ui('move');
        } else if (sel === 2) {
          const curC = store.get('clusterStyle', 'car');
          const idx = CLUSTER_CHOICES.indexOf(curC);
          const nextC = CLUSTER_CHOICES[(idx + CLUSTER_CHOICES.length - 1) % CLUSTER_CHOICES.length];
          setClusterChoice(nextC);
          audio.ui('move');
        } else if (sel === WEATHER_ROW) {
          setWeatherChoice(nextWeather(currentWeather(), -1));
          audio.ui('move');
        } else if (sel === TIME_ROW) {
          setTimeChoice(nextTime(currentTime(), -1));
          audio.ui('move');
        } else if (sel >= AUDIO_ROW && sel < AUDIO_ROW + CHANNELS.length) {
          const ch = CHANNELS[sel - AUDIO_ROW];
          const curV = audio.settings[ch].volume;
          const nextV = Math.max(0, Math.round((curV - 0.1) * 10) / 10);
          audio.setVolume(ch, nextV);
          audio.ui('move');
          sync();
        } else if (sel === MUSIC_ROW) {
          audio.music?.previous();
          audio.ui('move');
        }
      }
      if (input.pressed('right')) {
        if (sel === FX_ROW) {
          fxSel = (fxSel + 1) % SCREEN_FX.length;
          audio.ui('move');
          mark();
        } else if (sel === 0) {
          const cur = store.get('transmission', /** @type {string} */ ('auto'));
          store.set('transmission', cur === 'auto' ? 'manual' : 'auto');
          audio.ui('select');
          sync();
        } else if (sel === 1) {
          const curH = store.get('renderHeight', DEFAULT_LINES);
          const idx = HEIGHTS.indexOf(curH);
          const nextH = HEIGHTS[(idx + 1) % HEIGHTS.length];
          setRenderHeight(nextH);
          audio.ui('move');
        } else if (sel === 2) {
          const curC = store.get('clusterStyle', 'car');
          const idx = CLUSTER_CHOICES.indexOf(curC);
          const nextC = CLUSTER_CHOICES[(idx + 1) % CLUSTER_CHOICES.length];
          setClusterChoice(nextC);
          audio.ui('move');
        } else if (sel === WEATHER_ROW) {
          setWeatherChoice(nextWeather(currentWeather()));
          audio.ui('move');
        } else if (sel === TIME_ROW) {
          setTimeChoice(nextTime(currentTime()));
          audio.ui('move');
        } else if (sel >= AUDIO_ROW && sel < AUDIO_ROW + CHANNELS.length) {
          const ch = CHANNELS[sel - AUDIO_ROW];
          const curV = audio.settings[ch].volume;
          const nextV = Math.min(1, Math.round((curV + 0.1) * 10) / 10);
          if (!audio.settings[ch].on && nextV > 0) audio.setOn(ch, true);
          audio.setVolume(ch, nextV);
          audio.ui('move');
          sync();
        } else if (sel === MUSIC_ROW) {
          audio.music?.skip();
          audio.ui('move');
        }
      }
      if (input.pressed('confirm')) {
        if (sel === 0) {
          const cur = store.get('transmission', /** @type {string} */ ('auto'));
          store.set('transmission', cur === 'auto' ? 'manual' : 'auto');
          audio.ui('select');
          sync();
        } else if (sel === 1) {
          const curH = store.get('renderHeight', DEFAULT_LINES);
          const idx = HEIGHTS.indexOf(curH);
          const nextH = HEIGHTS[(idx + 1) % HEIGHTS.length];
          setRenderHeight(nextH);
          audio.ui('select');
        } else if (sel === 2) {
          const curC = store.get('clusterStyle', 'car');
          const idx = CLUSTER_CHOICES.indexOf(curC);
          const nextC = CLUSTER_CHOICES[(idx + 1) % CLUSTER_CHOICES.length];
          setClusterChoice(nextC);
          audio.ui('select');
        } else if (sel === WEATHER_ROW) {
          setWeatherChoice(nextWeather(currentWeather()));
          audio.ui('select');
        } else if (sel === TIME_ROW) {
          setTimeChoice(nextTime(currentTime()));
          audio.ui('select');
        } else if (sel === FX_ROW) {
          setFx(SCREEN_FX[fxSel]);
          audio.ui('select');
          sync();
        } else if (sel === MUSIC_ROW) {
          toggleMusic();
          audio.ui('select');
        } else if (sel === CONTROLS_ROW) {
          audio.ui('select');
          return 'controls';
        } else if (sel >= AUDIO_ROW && sel < AUDIO_ROW + CHANNELS.length) {
          const ch = CHANNELS[sel - AUDIO_ROW];
          audio.toggle(ch);
          audio.ui('select');
          sync();
        } else {
          audio.ui('back');
          return 'back';
        }
      }
      return null;
    },
  };
}

/**
 * Interactive Controls settings and key rebinding screen.
 * @param {HTMLElement} ui
 * @param {import('../core/input.js').Input | null} [initialInput]
 */
export function controlsScreen(ui, initialInput = null) {
  let activeInput = initialInput;
  const s = screen(
    ui,
    'controls',
    `<div class="ac-frame">
      <div class="ac-header">
        <div class="ac-tag">// PILOT INTERFACE // CONTROL CONFIGURATION</div>
        <div class="ac-title">CONTROLS</div>
        <div class="ac-line"></div>
      </div>
      <div class="ac-body ac-controls-body">
        <div class="ac-controls-table-wrap">
          <div class="ac-controls-header-row">
            <span class="ac-ch-action">ACTION</span>
            <span class="ac-ch-key">KEY 1</span>
            <span class="ac-ch-key">KEY 2</span>
            <span class="ac-ch-pad">GAMEPAD</span>
          </div>
          <div class="ac-controls-table">
            ${CONTROL_ACTIONS.map((act) => `
              <div class="ac-ctrl-row click" data-act="${act}">
                <span class="ac-ctrl-name">${ACTION_LABELS[act]}</span>
                <span class="ac-pill ac-key-slot click" data-slot="0" id="slot-${act}-0">--</span>
                <span class="ac-pill ac-key-slot click" data-slot="1" id="slot-${act}-1">--</span>
                <span class="ac-ctrl-pad">${PAD_LABELS[act]}</span>
              </div>
            `).join('')}
            <div class="ac-ctrl-row click" data-special="reset">
              <span class="ac-ctrl-name">RESET TO DEFAULTS</span>
              <span class="ac-pill click" data-special="reset" style="grid-column: span 2; text-align: center;">RESET DEFAULTS</span>
              <span class="ac-ctrl-pad">RESTORE DEFAULT KEYBOARD KEYS</span>
            </div>
            <div class="ac-ctrl-row click" data-special="back">
              <span class="ac-ctrl-name">BACK</span>
              <span class="ac-pill click" data-special="back" style="grid-column: span 2; text-align: center;">RETURN</span>
              <span class="ac-ctrl-pad">SAVE &amp; RETURN</span>
            </div>
          </div>
        </div>
        <div class="ac-info-panel">
          <div class="ac-info-header">CONTROLS BRIEFING</div>
          <div class="ac-info-row"><span class="k">MANUAL SHIFT</span><span class="v">SEQUENTIAL N R 1..7</span></div>
          <div class="ac-info-row"><span class="k">CAMERA VIEWS</span><span class="v">CHASE / HOOD / COCKPIT</span></div>
          <div class="ac-info-row"><span class="k">RADAR &amp; MAP</span><span class="v">TAB TACTICAL MAP</span></div>
          <div class="ac-info-row"><span class="k">SERVICE STATIONS</span><span class="v">HOLD F REFUEL &amp; REPAIR</span></div>
          <div class="ac-notice" style="margin-top: 14px;">
            <b>KEY REBINDING:</b> Select a slot with <b>W/S</b> and <b>A/D</b> (or click), then press <b>Enter</b> to rebind. Press the new key, or <b>Esc</b> to cancel. If a key is already assigned, it will swap places automatically.<br><br>
            <b>MANUAL GEARS:</b> Tap <b>Shift</b> or <b>E</b> to upshift, <b>Ctrl</b> or <b>Q</b> to downshift. Mind the tachometer: over-rev downshifts cause thermal damage.<br><br>
            <b>COCKPIT VIEW:</b> Press <b>C</b> to cycle camera views. Cockpit features tachometer needle, digital speed, boost gauge, water temp, and sequential shift lamps.<br><br>
            <b>HIGHWAY DUELS:</b> Press <b>H</b> while tailing a rival on Route 1 or the Bayshore Line to challenge them to a street race.<br><br>
            <b>NITROUS:</b> Hold <b>N</b> at full throttle for a shot of torque. It heats the engine and wears it a little; held on the limiter it over-revs and hurts it. Shift up in time. Refill at any pump.
          </div>
        </div>
      </div>
      <div class="hints" id="controls-hints">
        <b>W / S</b> ROW &nbsp; <b>A / D</b> SLOT &nbsp; <b>ENTER / CLICK</b> REBIND &nbsp; <b>ESC</b> BACK
      </div>
    </div>`
  );

  const rows = /** @type {HTMLElement[]} */ ([...s.el.querySelectorAll('.ac-ctrl-row')]);
  const hintsEl = /** @type {HTMLElement} */ (s.el.querySelector('#controls-hints'));

  let selRow = 0;
  let selCol = 0;
  /** @type {{ action: string, slot: number } | null} */
  let listening = null;
  /** @type {string | null} */
  let clickedAction = null;
  /** @type {number | null} */
  let clickedSlot = null;
  /** @type {string | null} */
  let clickedSpecial = null;

  function sync(inp = null) {
    const input = inp || activeInput;
    if (!input) return;
    const bindings = input.bindings || KEYS;

    for (let i = 0; i < CONTROL_ACTIONS.length; i++) {
      const act = CONTROL_ACTIONS[i];
      const list = bindings[act] || KEYS[act] || [];
      const s0 = /** @type {HTMLElement | null} */ (s.el.querySelector(`#slot-${act}-0`));
      const s1 = /** @type {HTMLElement | null} */ (s.el.querySelector(`#slot-${act}-1`));

      const isListen0 = listening && listening.action === act && listening.slot === 0;
      const isListen1 = listening && listening.action === act && listening.slot === 1;

      if (s0) {
        s0.textContent = isListen0 ? 'PRESS KEY' : keyLabel(list[0]);
        s0.classList.toggle('listening', !!isListen0);
        s0.classList.toggle('focused', !listening && selRow === i && selCol === 0);
      }
      if (s1) {
        s1.textContent = isListen1 ? 'PRESS KEY' : keyLabel(list[1]);
        s1.classList.toggle('listening', !!isListen1);
        s1.classList.toggle('focused', !listening && selRow === i && selCol === 1);
      }
    }

    rows.forEach((r, idx) => r.classList.toggle('sel', idx === selRow));

    if (hintsEl) {
      hintsEl.innerHTML = listening
        ? '<b>PRESS ANY KEY</b> TO BIND &nbsp;//&nbsp; <b>ESC</b> CANCEL'
        : '<b>W / S</b> ROW &nbsp; <b>A / D</b> SLOT &nbsp; <b>ENTER / CLICK</b> REBIND &nbsp; <b>ESC</b> BACK';
    }
  }

  s.el.addEventListener('click', (e) => {
    const target = /** @type {HTMLElement} */ (e.target);
    const slotEl = target.closest('.ac-key-slot');
    if (slotEl) {
      const rowEl = slotEl.closest('.ac-ctrl-row');
      if (rowEl) {
        const act = /** @type {HTMLElement} */ (rowEl).dataset.act;
        const slot = Number(/** @type {HTMLElement} */ (slotEl).dataset.slot);
        if (act !== undefined) {
          clickedAction = act;
          clickedSlot = slot;
        }
      }
      return;
    }
    const specialEl = target.closest('[data-special]');
    if (specialEl) {
      clickedSpecial = /** @type {HTMLElement} */ (specialEl).dataset.special || null;
      return;
    }
    const rowEl = /** @type {HTMLElement | null} */ (target.closest('.ac-ctrl-row'));
    if (rowEl) {
      const idx = rows.indexOf(/** @type {HTMLElement} */ (rowEl));
      if (idx !== -1) {
        selRow = idx;
        if (rowEl.dataset.special) clickedSpecial = rowEl.dataset.special;
      }
    }
  });

  return {
    ...s,
    /** @param {boolean} on */
    show(on) {
      if (on) {
        listening = null;
        selRow = 0;
        selCol = 0;
        sync(activeInput);
      }
      s.show(on);
    },
    /**
     * @param {import('../core/input.js').Input} input
     * @returns {'back' | null}
     */
    update(input) {
      activeInput = input;

      if (listening) {
        if (clickedSpecial || input.pressed('back') || input.hit.has('Escape')) {
          clickedSpecial = null;
          clickedAction = null;
          clickedSlot = null;
          listening = null;
          audio.ui('back');
          sync(input);
          return null;
        }
        for (const code of input.hit) {
          if (code === 'Escape') continue;
          if (code === 'Enter' || code === 'NumpadEnter') {
            listening = null;
            audio.ui('back');
            sync(input);
            return null;
          }
          const next = rebind(input.bindings, listening.action, listening.slot, code);
          input.setBindings(next);
          audio.ui('select');
          listening = null;
          sync(input);
          return null;
        }
        return null;
      }

      if (clickedAction && clickedSlot !== null) {
        const act = clickedAction;
        const slot = clickedSlot;
        clickedAction = null;
        clickedSlot = null;
        const actIdx = CONTROL_ACTIONS.indexOf(/** @type {any} */ (act));
        if (actIdx !== -1) {
          selRow = actIdx;
          selCol = slot;
          listening = { action: act, slot };
          audio.ui('select');
          sync(input);
          return null;
        }
      }

      if (clickedSpecial) {
        const sp = clickedSpecial;
        clickedSpecial = null;
        if (sp === 'reset') {
          input.setBindings(KEYS);
          audio.ui('select');
          sync(input);
          return null;
        }
        if (sp === 'back') {
          audio.ui('back');
          return 'back';
        }
      }

      if (input.pressed('back')) {
        audio.ui('back');
        return 'back';
      }
      if (input.pressed('up')) {
        selRow = (selRow + rows.length - 1) % rows.length;
        audio.ui('move');
        sync(input);
      }
      if (input.pressed('down')) {
        selRow = (selRow + 1) % rows.length;
        audio.ui('move');
        sync(input);
      }
      if (input.pressed('left')) {
        if (selRow < CONTROL_ACTIONS.length && selCol > 0) {
          selCol = 0;
          audio.ui('move');
          sync(input);
        }
      }
      if (input.pressed('right')) {
        if (selRow < CONTROL_ACTIONS.length && selCol < 1) {
          selCol = 1;
          audio.ui('move');
          sync(input);
        }
      }
      if (input.pressed('confirm')) {
        if (selRow < CONTROL_ACTIONS.length) {
          listening = { action: CONTROL_ACTIONS[selRow], slot: selCol };
          audio.ui('select');
          sync(input);
        } else if (selRow === CONTROL_ACTIONS.length) {
          input.setBindings(KEYS);
          audio.ui('select');
          sync(input);
        } else {
          audio.ui('back');
          return 'back';
        }
      }

      return null;
    },
  };
}

const PAUSE_OPTIONS = /** @type {const} */ ([
  ['resume', 'RESUME'],
  ['settings', 'SETTINGS'],
  ['controls', 'CONTROLS'],
  ['garage', 'GARAGE'],
  ['menu', 'MAIN MENU'],
  ['title', 'QUIT TO TITLE'],
]);

/**
 * Pause menu. Up and down move, confirm picks, Esc resumes.
 * @param {HTMLElement} ui
 */
export function pauseScreen(ui) {
  const s = screen(
    ui,
    'pause',
    `<div class="box"><h3>PAUSED</h3>${PAUSE_OPTIONS.map(([id, label]) => `<div class="opt click" data-id="${id}">${label}</div>`).join('')}
     <div class="keys">W S throttle and brake, A D steer, Space handbrake<br>Q/E or Shift/Ctrl manual shift (N R 1..7), C camera, Tab map, R reset, F refuel & repair</div></div>`
  );
  const opts = /** @type {HTMLElement[]} */ ([...s.el.querySelectorAll('.opt')]);
  let sel = 0;
  /** @type {string | null} */
  let clicked = null;
  const mark = () => opts.forEach((o, i) => o.classList.toggle('sel', i === sel));
  s.el.addEventListener('click', (e) => {
    const t = /** @type {HTMLElement} */ (e.target).closest('.opt');
    if (t) clicked = /** @type {HTMLElement} */ (t).dataset.id;
  });
  mark();
  return {
    ...s,
    /** @param {boolean} on */
    show(on) {
      if (on) {
        sel = 0;
        mark();
      }
      s.show(on);
    },
    /**
     * @param {import('../core/input.js').Input} input
     * @returns {'resume' | 'settings' | 'controls' | 'garage' | 'menu' | 'title' | null}
     */
    update(input) {
      if (clicked) {
        const c = clicked;
        clicked = null;
        audio.ui('select');
        return /** @type {any} */ (c);
      }
      if (input.pressed('pause')) {
        audio.ui('back');
        return 'resume';
      }
      if (input.pressed('up')) {
        sel = (sel + opts.length - 1) % opts.length;
        audio.ui('move');
        mark();
      }
      if (input.pressed('down')) {
        sel = (sel + 1) % opts.length;
        audio.ui('move');
        mark();
      }
      if (input.pressed('confirm')) {
        audio.ui('select');
        return PAUSE_OPTIONS[sel][0];
      }
      return null;
    },
  };
}

