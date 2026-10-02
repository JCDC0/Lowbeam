/**
 * DOM screens that are not the garage or the HUD: title, loading and short toasts.
 */

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

const PAUSE_OPTIONS = /** @type {const} */ ([
  ['resume', 'RESUME'],
  ['garage', 'GARAGE'],
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
     <div class="keys">W S throttle and brake, A D steer, Space handbrake<br>C camera, R back on the road, E refuel at a pump</div></div>`
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
     * @returns {'resume' | 'garage' | 'title' | null}
     */
    update(input) {
      if (clicked) {
        const c = clicked;
        clicked = null;
        return /** @type {any} */ (c);
      }
      if (input.pressed('pause')) return 'resume';
      if (input.pressed('up')) sel = (sel + opts.length - 1) % opts.length;
      if (input.pressed('down')) sel = (sel + 1) % opts.length;
      mark();
      if (input.pressed('confirm')) return PAUSE_OPTIONS[sel][0];
      return null;
    },
  };
}
