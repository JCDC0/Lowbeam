import { audio, CHANNELS } from '../audio/audio.js';
import { store } from '../core/store.js';
import { RENDER_HEIGHTS, DEFAULT_LINES } from '../render/stage.js';
import { CLUSTER_STYLES } from './cluster-styles.js';

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
    `<div class="logo"><h1>LOWBEAM</h1><h2>KIRIGAOKA NIGHT RALLY</h2></div>
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
 * A short message near the top of the screen that fades on its own.
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
    clearTimeout(timer);
    timer = window.setTimeout(() => (el.style.opacity = '0'), seconds * 1000);
  };
}

const MAIN_OPTIONS = /** @type {const} */ ([
  ['drive', '01', 'DRIVE', 'ENTRY TO VALLEY STAGE'],
  ['garage', '02', 'GARAGE', 'MACHINE SELECT & COLOR'],
  ['settings', '03', 'SETTINGS', 'AUDIO & TRANSMISSION CONFIG'],
  ['controls', '04', 'CONTROLS', 'PILOT INPUT ASSIGNMENT'],
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
          ${MAIN_OPTIONS.map(([id, num, label, sub]) => `
            <div class="ac-opt click" data-id="${id}">
              <span class="ac-num">${num}</span>
              <span class="ac-label">${label}</span>
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
          <div class="ac-row click" data-row="back">
            <span class="ac-rlabel">BACK</span>
            <span class="ac-pill click" data-act="back">RETURN</span>
            <span class="hints-inline">SAVE & RETURN TO MENU</span>
          </div>
        </div>
        <div class="ac-info-panel">
          <div class="ac-info-header">CONFIGURATION HELP</div>
          <div class="ac-info-row"><span class="k">TRANSMISSION</span><span class="v">AUTO / MANUAL</span></div>
          <div class="ac-info-row"><span class="k">DISPLAY TARGET</span><span class="v">240 TO 1080 LINES</span></div>
          <div class="ac-info-row"><span class="k">SPEEDOMETER</span><span class="v">PER CAR / 5 STYLES</span></div>
          <div class="ac-notice">
            <b>MANUAL MODE:</b> Sequential shifting (N, R, 1..7). Tap <b>Shift</b> or <b>E</b> to upshift, <b>Ctrl</b> or <b>Q</b> to downshift. The rev limiter cuts ignition at redline. Over-rev downshifts cause money shift damage.<br><br>
            <b>RENDER HEIGHT:</b> Target vertical scanlines. 240 is the authentic PS1 resolution; 480 (default) keeps the dither and 15-bit color with a clearer picture.<br><br>
            <b>SPEEDOMETER:</b> HUD cluster style in outside views. PER CAR matches each vehicle's instruments; or lock to Classic, Racing, Twin, Sport, Digital or VFD.<br><br>
            <b>AUDIO DSP:</b> Procedural synthesis for engines, wind, tires and nature. Volumes and toggles save to local storage automatically.
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
  const CLUSTER_CHOICES = ['car', ...CLUSTER_STYLES];
  const CLUSTER_LABELS = { car: 'PER CAR', classic: 'CLASSIC', tuner: 'RACING TACH', twin: 'TWIN DIAL', sport: 'SPORT TACH', digital: 'DIGITAL LCD', vfd: '1984 VFD' };
  let sel = 0;
  /** @type {string | null} */
  let clickedAction = null;
  /** @type {string | null} */
  let clickedCh = null;
  /** @type {number | null} */
  let clickedStep = null;

  const mark = () => rows.forEach((r, i) => r.classList.toggle('sel', i === sel));

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
      s.show(on);
    },
    /**
     * @param {import('../core/input.js').Input} input
     * @returns {'back' | null}
     */
    update(input) {
      if (clickedAction) {
        const action = clickedAction;
        const ch = /** @type {import('../audio/audio.js').Channel | null} */ (clickedCh);
        const step = clickedStep;
        clickedAction = null;
        clickedCh = null;
        clickedStep = null;

        if (action === 'toggle-trans') {
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
        if (sel === 0) {
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
        } else if (sel >= 3 && sel < 3 + CHANNELS.length) {
          const ch = CHANNELS[sel - 3];
          const curV = audio.settings[ch].volume;
          const nextV = Math.max(0, Math.round((curV - 0.1) * 10) / 10);
          audio.setVolume(ch, nextV);
          audio.ui('move');
          sync();
        }
      }
      if (input.pressed('right')) {
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
          audio.ui('move');
        } else if (sel === 2) {
          const curC = store.get('clusterStyle', 'car');
          const idx = CLUSTER_CHOICES.indexOf(curC);
          const nextC = CLUSTER_CHOICES[(idx + 1) % CLUSTER_CHOICES.length];
          setClusterChoice(nextC);
          audio.ui('move');
        } else if (sel >= 3 && sel < 3 + CHANNELS.length) {
          const ch = CHANNELS[sel - 3];
          const curV = audio.settings[ch].volume;
          const nextV = Math.min(1, Math.round((curV + 0.1) * 10) / 10);
          if (!audio.settings[ch].on && nextV > 0) audio.setOn(ch, true);
          audio.setVolume(ch, nextV);
          audio.ui('move');
          sync();
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
        } else if (sel >= 3 && sel < 3 + CHANNELS.length) {
          const ch = CHANNELS[sel - 3];
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
 * Tactical Controls briefing screen.
 * @param {HTMLElement} ui
 */
export function controlsScreen(ui) {
  const s = screen(
    ui,
    'controls',
    `<div class="ac-frame">
      <div class="ac-header">
        <div class="ac-tag">// PILOT INTERFACE // CONTROL MAPPING</div>
        <div class="ac-title">CONTROLS BRIEFING</div>
        <div class="ac-line"></div>
      </div>
      <div class="ac-controls-grid">
        <div class="ac-col-box">
          <div class="ac-col-title">KEYBOARD ASSIGNMENT</div>
          <div class="ac-binding-row"><span class="k">THROTTLE</span><span class="v">W / UP ARROW</span></div>
          <div class="ac-binding-row"><span class="k">BRAKE / REVERSE</span><span class="v">S / DOWN ARROW</span></div>
          <div class="ac-binding-row"><span class="k">STEERING</span><span class="v">A / D / LEFT / RIGHT</span></div>
          <div class="ac-binding-row"><span class="k">HANDBRAKE</span><span class="v">SPACEBAR</span></div>
          <div class="ac-binding-row"><span class="k">MANUAL GEARS</span><span class="v">R &nbsp; N &nbsp; 1 .. 7</span></div>
          <div class="ac-binding-row"><span class="k">UPSHIFT (MANUAL)</span><span class="v">SHIFT / E</span></div>
          <div class="ac-binding-row"><span class="k">DOWNSHIFT (MANUAL)</span><span class="v">CTRL / Q</span></div>
          <div class="ac-binding-row"><span class="k">CYCLE CAMERA</span><span class="v">C (5 VIEWS: CHASE, CAR, HOOD, BUMPER, COCKPIT)</span></div>
          <div class="ac-binding-row"><span class="k">TACTICAL MAP</span><span class="v">TAB</span></div>
          <div class="ac-binding-row"><span class="k">REFUEL & REPAIR</span><span class="v">HOLD F (AT STATION)</span></div>
          <div class="ac-binding-row"><span class="k">RESET / TOW</span><span class="v">R</span></div>
          <div class="ac-binding-row"><span class="k">CHALLENGE RACER</span><span class="v">H (RACER AHEAD ON ROUTE 1 OR THE BAYSHORE LINE)</span></div>
          <div class="ac-binding-row"><span class="k">PAUSE</span><span class="v">ESCAPE</span></div>
        </div>
        <div class="ac-col-box">
          <div class="ac-col-title">GAMEPAD ASSIGNMENT (XINPUT)</div>
          <div class="ac-binding-row"><span class="k">THROTTLE</span><span class="v">RIGHT TRIGGER [RT]</span></div>
          <div class="ac-binding-row"><span class="k">BRAKE / REVERSE</span><span class="v">LEFT TRIGGER [LT]</span></div>
          <div class="ac-binding-row"><span class="k">STEERING</span><span class="v">LEFT STICK / D-PAD</span></div>
          <div class="ac-binding-row"><span class="k">HANDBRAKE</span><span class="v">A / X BUTTON</span></div>
          <div class="ac-binding-row"><span class="k">UPSHIFT (MANUAL)</span><span class="v">RIGHT BUMPER [RB]</span></div>
          <div class="ac-binding-row"><span class="k">DOWNSHIFT (MANUAL)</span><span class="v">LEFT BUMPER [LB]</span></div>
          <div class="ac-binding-row"><span class="k">CYCLE CAMERA</span><span class="v">Y BUTTON</span></div>
          <div class="ac-binding-row"><span class="k">TACTICAL MAP</span><span class="v">SELECT / BACK / X</span></div>
          <div class="ac-binding-row"><span class="k">REFUEL & REPAIR</span><span class="v">HOLD B (AT STATION)</span></div>
          <div class="ac-binding-row"><span class="k">RESET / TOW</span><span class="v">BACK BUTTON</span></div>
          <div class="ac-binding-row"><span class="k">CHALLENGE RACER</span><span class="v">R3 (BOTH BUMPERS ARE THE MANUAL GEARS)</span></div>
          <div class="ac-binding-row"><span class="k">PAUSE</span><span class="v">START BUTTON</span></div>
        </div>
      </div>
      <div class="ac-notice">
        <b>COCKPIT VIEW:</b> Press <b>C</b> to enter interior POV. The dash cluster displays analog tachometer, sweeping needle, speedometer, boost/vacuum dial, water temp, and sequential shift indicator LEDs.
      </div>
      <div class="hints" style="margin-top: 14px;">
        <span class="click ac-pill on" id="btn-ctrl-back" style="padding: 6px 20px; font-size: 11px;">RETURN [ESC / ENTER]</span>
      </div>
    </div>`
  );

  let clicked = false;
  s.el.addEventListener('click', () => (clicked = true));

  return {
    ...s,
    /**
     * @param {import('../core/input.js').Input} input
     * @returns {'back' | null}
     */
    update(input) {
      if (clicked || input.pressed('back') || input.pressed('confirm') || input.pressed('pause')) {
        clicked = false;
        audio.ui('back');
        return 'back';
      }
      return null;
    },
  };
}

const PAUSE_OPTIONS = /** @type {const} */ ([
  ['resume', 'RESUME'],
  ['settings', 'SETTINGS'],
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
     * @returns {'resume' | 'settings' | 'garage' | 'menu' | 'title' | null}
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
