/**
 * Keyboard and gamepad input. Menus read one-shot actions (`pressed`), driving reads
 * `drive(dt)`: ramped keyboard axes or the gamepad triggers and stick. Call `poll()`
 * once at the start of every frame and `endFrame()` at the end.
 */

import { approach } from './mathx.js';
import { store } from './store.js';

/** Keyboard codes for each action. */
const KEYS = {
  left: ['ArrowLeft', 'KeyA'],
  right: ['ArrowRight', 'KeyD'],
  up: ['ArrowUp', 'KeyW'],
  down: ['ArrowDown', 'KeyS'],
  confirm: ['Enter', 'NumpadEnter', 'Space'],
  back: ['Escape', 'Backspace'],
  pause: ['Escape'],
  camera: ['KeyC'],
  reset: ['KeyR'],
  interact: ['KeyF'],
  map: ['Tab'],
  shiftUp: ['ShiftLeft', 'ShiftRight', 'KeyE'],
  shiftDown: ['ControlLeft', 'ControlRight', 'KeyQ'],
};

/** Standard gamepad buttons for each action. */
const PAD = {
  left: [14],
  right: [15],
  up: [12],
  down: [13],
  confirm: [0, 9],
  back: [1, 8],
  pause: [9],
  camera: [3],
  reset: [8],
  interact: [1],
  map: [8, 2],
  shiftUp: [5],
  shiftDown: [4],
};

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

  /** True while the action's key or button is held. @param {keyof typeof KEYS} action */
  held(action) {
    if (KEYS[action].some((k) => this.down.has(k))) return true;
    const b = this.pad && this.pad.buttons;
    return !!b && PAD[action].some((i) => b[i] && b[i].pressed);
  }

  /**
   * Driving axes for this frame. Throttle and brake are 0 to 1, steer is -1 (left) to 1
   * (right), handbrake 0 or 1.
   * @param {number} dt
   * @returns {import('../vehicles/physics.js').DriveInput}
   */
  drive(dt) {
    const k = (...codes) => codes.some((c) => this.down.has(c));
    const d = this.driveState;
    const thr = k('KeyW', 'ArrowUp') ? 1 : 0;
    const brk = k('KeyS', 'ArrowDown') ? 1 : 0;
    const st = (k('KeyD', 'ArrowRight') ? 1 : 0) - (k('KeyA', 'ArrowLeft') ? 1 : 0);
    d.throttle = approach(d.throttle, thr, (thr > d.throttle ? RAMP.throttleUp : RAMP.throttleDown) * dt);
    d.brake = approach(d.brake, brk, (brk > d.brake ? RAMP.brakeUp : RAMP.brakeDown) * dt);
    const back = st === 0 || Math.sign(st) !== Math.sign(d.steer);
    d.steer = approach(d.steer, st, (back ? RAMP.steerOut : RAMP.steerIn) * dt);
    d.handbrake = k('Space') ? 1 : 0;
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
