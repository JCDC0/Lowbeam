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
