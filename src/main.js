/**
 * Boot and the state machine: title, garage, and (later) driving.
 * `window.__lowbeam` exposes the pieces so a browser session can force a state and
 * call `shot(name)`, which writes tools/shots/<name>.png through the dev server.
 */

import { createStage } from './render/stage.js';
import { Input } from './core/input.js';
import { Garage } from './ui/garage.js';
import { titleScreen, toaster } from './ui/menus.js';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('view'));
const ui = /** @type {HTMLElement} */ (document.getElementById('ui'));

const version = await fetch('package.json')
  .then((r) => r.json())
  .then((p) => p.version)
  .catch(() => '');
await document.fonts.load('16px "Lowbeam Display"').catch(() => {});

const stage = createStage(canvas);
const input = new Input();
const toast = toaster(ui);
const title = titleScreen(ui, version);
const garage = new Garage(ui);

/** @typedef {'title' | 'garage'} State */
/** @type {State} */
let state = 'title';

/** @param {State} next */
function setState(next) {
  state = next;
  title.show(state === 'title');
  garage.show(state === 'garage');
}
setState('title');

let last = performance.now();
/** @param {number} now */
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  input.poll();
  if (state === 'title') {
    garage.update(dt, null);
    if (input.pressed('confirm')) setState('garage');
    garage.render(stage);
  } else if (state === 'garage') {
    const ev = garage.update(dt, input);
    if (ev === 'back') setState('title');
    else if (ev === 'drive') toast('THE VALLEY IS NOT BUILT YET');
    garage.render(stage);
  }
  input.endFrame();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

window.__lowbeam = {
  stage,
  input,
  garage,
  get state() {
    return state;
  },
  setState,
  /** @param {string} name */
  shot: (name) => stage.shot(name),
};
