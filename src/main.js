/**
 * Boot and the state machine: title, garage, loading, drive and pause, plus a free
 * camera for development. `window.__lowbeam` exposes the pieces so a browser session
 * can force a state and call `shot(name)`, which writes tools/shots/<name>.png.
 */

import * as THREE from 'three';
import { createStage } from './render/stage.js';
import { Input } from './core/input.js';
import { Garage } from './ui/garage.js';
import { Hud } from './ui/hud.js';
import { loadingScreen, pauseScreen, titleScreen, toaster } from './ui/menus.js';
import { World } from './world/world.js';
import { Drive } from './drive.js';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('view'));
const ui = /** @type {HTMLElement} */ (document.getElementById('ui'));

const version = await fetch('package.json')
  .then((r) => r.json())
  .then((p) => p.version)
  .catch(() => '');
await document.fonts.load('16px "Lowbeam Display"').catch(() => {});

const stage = createStage(canvas);
const input = new Input();
const title = titleScreen(ui, version);
const loading = loadingScreen(ui);
const garage = new Garage(ui);
const hud = new Hud(ui);
const pause = pauseScreen(ui);
const toast = toaster(ui);

/** @type {World | null} */
let world = null;
/** @type {Drive | null} */
let drive = null;
const fly = { x: 0, y: 30, z: 0, yaw: 0, pitch: -0.2 };

/** @typedef {'title' | 'garage' | 'loading' | 'drive' | 'pause' | 'free'} State */
/** @type {State} */
let state = 'title';

/** @param {State} next */
function setState(next) {
  state = next;
  title.show(state === 'title');
  garage.show(state === 'garage');
  loading.show(state === 'loading');
  hud.show(state === 'drive' || state === 'pause');
  pause.show(state === 'pause');
}
setState('title');

// A timer, not requestAnimationFrame, so loading also finishes in a hidden tab.
const paint = () => new Promise((r) => setTimeout(r, 20));

async function enterWorld() {
  setState('loading');
  if (!world) {
    world = await World.create(async (label) => {
      loading.text(label);
      await paint();
    });
    console.log(`world built in ${world.buildMs.toFixed(0)} ms`);
    drive = new Drive({ world, stage, input, hud, toast });
  }
  drive.start(garage.spec, garage.model.paintIndex);
  setState('drive');
}

/** Free camera for development: WASD to move, arrows to look, Q and E for height, Shift for speed. */
function updateFly(dt) {
  const k = (c) => input.key(c);
  const look = 1.6 * dt;
  if (k('ArrowLeft')) fly.yaw += look;
  if (k('ArrowRight')) fly.yaw -= look;
  if (k('ArrowUp')) fly.pitch = Math.min(1.4, fly.pitch + look);
  if (k('ArrowDown')) fly.pitch = Math.max(-1.4, fly.pitch - look);
  const v = (k('ShiftLeft') || k('ShiftRight') ? 90 : 18) * dt;
  const fx = Math.sin(fly.yaw);
  const fz = Math.cos(fly.yaw);
  const f = (k('KeyW') ? 1 : 0) - (k('KeyS') ? 1 : 0);
  const s = (k('KeyA') ? 1 : 0) - (k('KeyD') ? 1 : 0);
  fly.x += (fx * f + fz * s) * v;
  fly.z += (fz * f - fx * s) * v;
  fly.y += ((k('KeyE') ? 1 : 0) - (k('KeyQ') ? 1 : 0)) * v;
  fly.y = Math.max(fly.y, world.ground.at(fly.x, fly.z).h + 0.5);
}

function placeFly() {
  const cam = stage.camera;
  cam.position.set(fly.x, fly.y, fly.z);
  const cp = Math.cos(fly.pitch);
  cam.up.set(0, 1, 0);
  cam.lookAt(fly.x + Math.sin(fly.yaw) * cp, fly.y + Math.sin(fly.pitch), fly.z + Math.cos(fly.yaw) * cp);
  cam.updateMatrixWorld();
}

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
    else if (ev === 'drive') enterWorld();
    garage.render(stage);
  } else if (state === 'drive') {
    if (drive.update(dt) === 'pause') setState('pause');
    drive.render();
  } else if (state === 'pause') {
    const pick = pause.update(input);
    if (pick === 'resume') setState('drive');
    else if (pick === 'garage') setState('garage');
    else if (pick === 'title') setState('title');
    drive.render();
  } else if (state === 'free' && world) {
    updateFly(dt);
    if (input.pressed('back')) setState('drive');
    placeFly();
    world.update(stage.camera, drive.car.group.position);
    stage.render(world.scene, stage.camera);
  }
  input.endFrame();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

window.__lowbeam = {
  THREE,
  stage,
  input,
  garage,
  get world() {
    return world;
  },
  get drive() {
    return drive;
  },
  get state() {
    return state;
  },
  setState,
  enterWorld,
  /** Puts the free camera somewhere and draws one frame. */
  fly(x, y, z, yaw = fly.yaw, pitch = fly.pitch) {
    Object.assign(fly, { x, y, z, yaw, pitch });
    placeFly();
    world.update(stage.camera, drive.car.group.position);
    stage.render(world.scene, stage.camera);
  },
  /**
   * Runs the drive loop for `seconds` of game time with fixed inputs, without waiting
   * for frames, then renders once. For checks in a hidden browser tab.
   * @param {number} seconds @param {Partial<import('./vehicles/physics.js').DriveInput>} [hold]
   */
  simulate(seconds, hold = {}) {
    const step = 1 / 60;
    const saved = input.drive;
    input.drive = () => ({ throttle: 0, brake: 0, steer: 0, handbrake: 0, ...hold });
    for (let t = 0; t < seconds; t += step) {
      input.poll();
      drive.update(step);
      input.endFrame();
    }
    input.drive = saved;
    drive.render();
  },
  /** @param {string} name */
  shot: (name) => stage.shot(name),
  toast,
};
