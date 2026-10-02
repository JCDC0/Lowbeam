/**
 * Keyboard and gamepad input. Menus read one-shot actions (`pressed`), driving reads
 * held keys and analog axes. Call `poll()` once at the start of every frame and
 * `endFrame()` at the end.
 */

/** Keyboard codes for each action. */
const KEYS = {
  left: ['ArrowLeft', 'KeyA'],
  right: ['ArrowRight', 'KeyD'],
  up: ['ArrowUp', 'KeyW'],
  down: ['ArrowDown', 'KeyS'],
  confirm: ['Enter', 'NumpadEnter', 'Space'],
  back: ['Escape', 'Backspace'],
};

/** Standard gamepad buttons for each action. */
const PAD = {
  left: [14],
  right: [15],
  up: [12],
  down: [13],
  confirm: [0, 9],
  back: [1, 8],
};

export class Input {
  constructor() {
    /** @type {Set<string>} */
    this.down = new Set();
    /** @type {Set<string>} */
    this.hit = new Set();
    /** @type {boolean[]} */
    this.padPrev = [];
    /** @type {Gamepad | null} */
    this.pad = null;
    /** @type {Set<string>} */
    this.padHit = new Set();
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.down.add(e.code);
      this.hit.add(e.code);
      if (e.code.startsWith('Arrow') || e.code === 'Space' || e.code === 'Tab') e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.down.delete(e.code));
    window.addEventListener('blur', () => this.down.clear());
  }

  poll() {
    this.pad = null;
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of pads) {
      if (p && p.connected && p.mapping === 'standard') {
        this.pad = p;
        break;
      }
    }
    this.padHit.clear();
    if (!this.pad) return;
    const b = this.pad.buttons;
    for (const [action, list] of Object.entries(PAD)) {
      for (const i of list) {
        const now = !!(b[i] && b[i].pressed);
        if (now && !this.padPrev[i]) this.padHit.add(action);
      }
    }
    // Stick flicks count as d-pad presses in menus.
    const ax = this.pad.axes[0] || 0;
    const ay = this.pad.axes[1] || 0;
    const flick = (name, on, idx) => {
      if (on && !this.padPrev[idx]) this.padHit.add(name);
      this.padPrev[idx] = on;
    };
    for (let i = 0; i < b.length; i++) this.padPrev[i] = !!b[i].pressed;
    flick('left', ax < -0.6, 100);
    flick('right', ax > 0.6, 101);
    flick('up', ay < -0.6, 102);
    flick('down', ay > 0.6, 103);
  }

  /** One-shot: true on the frame the action was pressed. @param {keyof typeof KEYS} action */
  pressed(action) {
    if (this.padHit.has(action)) return true;
    return KEYS[action].some((k) => this.hit.has(k));
  }

  /** True on the frame this key code went down. @param {string} code */
  keyHit(code) {
    return this.hit.has(code);
  }

  /** @param {string} code */
  key(code) {
    return this.down.has(code);
  }

  endFrame() {
    this.hit.clear();
  }
}
