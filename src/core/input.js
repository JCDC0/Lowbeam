/**
 * Keyboard and gamepad input. Menus read one-shot actions (`pressed`), driving reads
 * `drive(dt)`: ramped keyboard axes or the gamepad triggers and stick. Call `poll()`
 * once at the start of every frame and `endFrame()` at the end.
 */

import { approach } from './mathx.js';
import { store } from './store.js';

/** Default keyboard codes for each action. */
export const KEYS = {
  throttle: ['KeyW', 'ArrowUp'],
  brake: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  handbrake: ['Space', ''],
  shiftUp: ['ShiftLeft', 'KeyE'],
  shiftDown: ['ControlLeft', 'KeyQ'],
  camera: ['KeyC', ''],
  reset: ['KeyR', ''],
  interact: ['KeyF', ''],
  challenge: ['KeyH', ''],
  map: ['Tab', ''],
  pause: ['Escape', ''],
  confirm: ['Enter', 'NumpadEnter'],
  back: ['Escape', 'Backspace'],
  up: ['ArrowUp', 'KeyW'],
  down: ['ArrowDown', 'KeyS'],
};

/** The configurable actions in the controls menu. */
export const CONTROL_ACTIONS = /** @type {const} */ ([
  'throttle',
  'brake',
  'left',
  'right',
  'handbrake',
  'shiftUp',
  'shiftDown',
  'camera',
  'reset',
  'interact',
  'challenge',
  'map',
  'pause',
]);

/** Display names for configurable actions. */
export const ACTION_LABELS = {
  throttle: 'THROTTLE',
  brake: 'BRAKE / REVERSE',
  left: 'STEER LEFT',
  right: 'STEER RIGHT',
  handbrake: 'HANDBRAKE',
  shiftUp: 'SHIFT UP',
  shiftDown: 'SHIFT DOWN',
  camera: 'CYCLE CAMERA',
  reset: 'RESET / TOW',
  interact: 'REFUEL & REPAIR',
  challenge: 'CHALLENGE RACER',
  map: 'TACTICAL MAP',
  pause: 'PAUSE',
};

/** Read-only gamepad button labels for each action. */
export const PAD_LABELS = {
  throttle: 'RIGHT TRIGGER [RT]',
  brake: 'LEFT TRIGGER [LT]',
  left: 'LEFT STICK / D-PAD LEFT',
  right: 'LEFT STICK / D-PAD RIGHT',
  handbrake: 'A / X BUTTON',
  shiftUp: 'RIGHT BUMPER [RB]',
  shiftDown: 'LEFT BUMPER [LB]',
  camera: 'Y BUTTON',
  reset: 'BACK BUTTON',
  interact: 'HOLD B BUTTON',
  challenge: 'R3 (RIGHT STICK CLICK)',
  map: 'SELECT / BACK / X',
  pause: 'START BUTTON',
};

/** Standard gamepad buttons for each action. */
export const PAD = {
  throttle: [7],
  brake: [6],
  left: [14],
  right: [15],
  up: [12],
  down: [13],
  handbrake: [0, 2],
  confirm: [0, 9],
  back: [1, 8],
  pause: [9],
  camera: [3],
  reset: [8],
  interact: [1],
  challenge: [11],
  map: [8, 2],
  shiftUp: [5],
  shiftDown: [4],
};

/**
 * Returns a human-friendly label for a KeyboardEvent.code.
 * @param {string} code
 * @returns {string}
 */
export function keyLabel(code) {
  if (!code) return '--';
  if (code.startsWith('Key')) return code.slice(3).toUpperCase();
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return `NUM ${code.slice(6)}`;
  if (code === 'ArrowUp') return 'UP';
  if (code === 'ArrowDown') return 'DOWN';
  if (code === 'ArrowLeft') return 'LEFT';
  if (code === 'ArrowRight') return 'RIGHT';
  if (code === 'Space') return 'SPACE';
  if (code === 'Enter') return 'ENTER';
  if (code === 'Escape') return 'ESC';
  if (code === 'Backspace') return 'BACKSPACE';
  if (code === 'Tab') return 'TAB';
  if (code === 'ShiftLeft' || code === 'ShiftRight') return 'SHIFT';
  if (code === 'ControlLeft' || code === 'ControlRight') return 'CTRL';
  if (code === 'AltLeft' || code === 'AltRight') return 'ALT';
  if (code === 'CapsLock') return 'CAPS';
  return code.toUpperCase();
}

/**
 * Pure rebind helper: binds `code` to `action` at `slot` (0 or 1).
 * Refuses 'Escape' and 'Enter'/'NumpadEnter'.
 * If `code` is already bound to another action/slot in `map`, swaps the old key into the slot this one left.
 * @param {Record<string, string[]>} map
 * @param {string} action
 * @param {number} slot 0 or 1
 * @param {string} code
 * @returns {Record<string, string[]>}
 */
export function rebind(map, action, slot, code) {
  if (code === 'Escape' || code === 'Enter' || code === 'NumpadEnter') {
    return map;
  }
  /** @type {Record<string, string[]>} */
  const next = {};
  for (const [k, v] of Object.entries(map)) {
    next[k] = [...v];
  }
  if (!next[action]) next[action] = ['', ''];
  while (next[action].length < 2) next[action].push('');

  const prevOld = next[action][slot] || '';

  // Check if code is already bound to another action and slot
  let foundAction = null;
  let foundSlot = -1;
  for (const a of Object.keys(next)) {
    for (let s = 0; s < next[a].length; s++) {
      if (next[a][s] === code) {
        foundAction = a;
        foundSlot = s;
        break;
      }
    }
    if (foundAction) break;
  }

  if (foundAction && (foundAction !== action || foundSlot !== slot)) {
    // Swap
    next[foundAction][foundSlot] = prevOld;
  }
  next[action][slot] = code;

  return next;
}

/**
 * Keyboard ramps per second. The throttle takes about a third of a second to reach full,
 * so a tap does not light up the rear tires of the RWD cars on gravel.
 */
const RAMP = { throttleUp: 3.2, throttleDown: 9, brakeUp: 7, brakeDown: 12, steerIn: 3.4, steerOut: 6 };
const DEAD = 0.12;

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
    /** @type {import('../vehicles/physics.js').DriveInput} */
    this.driveState = { throttle: 0, brake: 0, steer: 0, handbrake: 0 };
    /** @type {Record<string, string[]>} */
    this.bindings = {};
    this.loadBindings();

    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.down.add(e.code);
      this.hit.add(e.code);
      if (e.code.startsWith('Arrow') || e.code === 'Space' || e.code === 'Tab') e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.down.delete(e.code));
    window.addEventListener('blur', () => this.down.clear());
  }

  /** Loads bindings from store under 'keys', falling back to defaults. */
  loadBindings() {
    const saved = store.get('keys', null);
    /** @type {Record<string, string[]>} */
    const map = {};
    for (const [k, v] of Object.entries(KEYS)) {
      map[k] = [...v];
    }
    if (saved && typeof saved === 'object') {
      for (const [k, v] of Object.entries(saved)) {
        if (Array.isArray(v)) map[k] = [...v];
      }
    }
    this.bindings = map;
  }

  /**
   * Updates active bindings in memory and persists them.
   * @param {Record<string, string[]>} map
   */
  setBindings(map) {
    this.bindings = { ...map };
    store.set('keys', this.bindings);
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

  /** One-shot: true on the frame the action was pressed. @param {string} action */
  pressed(action) {
    if (this.padHit.has(action)) return true;
    const list = this.bindings[action] || KEYS[action] || [];
    return list.some((k) => k && this.hit.has(k));
  }

  /** True while the action's key or button is held. @param {string} action */
  held(action) {
    const list = this.bindings[action] || KEYS[action] || [];
    if (list.some((k) => k && this.down.has(k))) return true;
    const b = this.pad && this.pad.buttons;
    return !!b && !!PAD[action] && PAD[action].some((i) => b[i] && b[i].pressed);
  }

  /**
   * Driving axes for this frame. Throttle and brake are 0 to 1, steer is -1 (left) to 1
   * (right), handbrake 0 or 1.
   * @param {number} dt
   * @returns {import('../vehicles/physics.js').DriveInput}
   */
  drive(dt) {
    const k = (action, fallbackCodes = []) => {
      const list = this.bindings[action] || fallbackCodes;
      return list.some((c) => c && this.down.has(c));
    };
    const d = this.driveState;
    const thr = k('throttle', ['KeyW', 'ArrowUp']) ? 1 : 0;
    const brk = k('brake', ['KeyS', 'ArrowDown']) ? 1 : 0;
    const st = (k('right', ['KeyD', 'ArrowRight']) ? 1 : 0) - (k('left', ['KeyA', 'ArrowLeft']) ? 1 : 0);
    d.throttle = approach(d.throttle, thr, (thr > d.throttle ? RAMP.throttleUp : RAMP.throttleDown) * dt);
    d.brake = approach(d.brake, brk, (brk > d.brake ? RAMP.brakeUp : RAMP.brakeDown) * dt);
    const back = st === 0 || Math.sign(st) !== Math.sign(d.steer);
    d.steer = approach(d.steer, st, (back ? RAMP.steerOut : RAMP.steerIn) * dt);
    d.handbrake = k('handbrake', ['Space']) ? 1 : 0;
    let { throttle, brake, steer, handbrake } = d;
    if (this.pad) {
      const b = this.pad.buttons;
      const v = (i) => (b[i] ? b[i].value : 0);
      throttle = Math.max(throttle, v(7));
      brake = Math.max(brake, v(6));
      const ax = this.pad.axes[0] || 0;
      const a = Math.abs(ax) < DEAD ? 0 : (Math.sign(ax) * (Math.abs(ax) - DEAD)) / (1 - DEAD);
      const curved = Math.sign(a) * a * a * 0.6 + a * 0.4;
      if (Math.abs(curved) > Math.abs(steer)) steer = curved;
      if (v(0) > 0.5 || v(2) > 0.5) handbrake = 1;
    }
    const manual = store.get('transmission', /** @type {string} */ ('auto')) === 'manual';
    const shiftUp = this.pressed('shiftUp');
    const shiftDown = this.pressed('shiftDown');
    return { throttle, brake, steer, handbrake, shiftUp, shiftDown, manual };
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
