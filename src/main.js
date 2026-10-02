/**
 * Boot and the state machine: title, garage, loading and the world.
 * `window.__lowbeam` exposes the pieces so a browser session can force a state and
 * call `shot(name)`, which writes tools/shots/<name>.png through the dev server.
 */

import * as THREE from 'three';
import { createStage } from './render/stage.js';
import { Input } from './core/input.js';
import { Garage } from './ui/garage.js';
import { loadingScreen, titleScreen, toaster } from './ui/menus.js';
import { World } from './world/world.js';
import { CarModel } from './vehicles/models.js';

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
const loading = loadingScreen(ui);
const garage = new Garage(ui);

/** @type {World | null} */
let world = null;
/** @type {CarModel | null} */
let car = null;
const fly = { x: 0, y: 30, z: 0, yaw: 0, pitch: -0.2 };

/** @typedef {'title' | 'garage' | 'loading' | 'free'} State */
/** @type {State} */
let state = 'title';

/** @param {State} next */
function setState(next) {
  state = next;
  title.show(state === 'title');
  garage.show(state === 'garage');
  loading.show(state === 'loading');
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
  }
  if (car) {
    world.root.remove(car.group);
    car.dispose();
  }
  car = new CarModel(garage.spec, garage.model.paintIndex);
  const pad = world.ground.pads[0];
  const yaw = Math.atan2(pad.ux, pad.uz);
  car.group.position.set(pad.cx, pad.h, pad.cz);
  car.group.rotation.y = yaw;
  world.add(car.group);
  Object.assign(fly, { x: pad.cx - Math.sin(yaw) * 9, y: pad.h + 3, z: pad.cz - Math.cos(yaw) * 9, yaw, pitch: -0.12 });
  setState('free');
}

/** Free camera: WASD to move, arrows to look, Q and E for height, Shift for speed. */
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

function placeCamera() {
  const cam = stage.camera;
  cam.position.set(fly.x, fly.y, fly.z);
  const cp = Math.cos(fly.pitch);
  cam.lookAt(fly.x + Math.sin(fly.yaw) * cp, fly.y + Math.sin(fly.pitch), fly.z + Math.cos(fly.yaw) * cp);
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
  } else if (state === 'free' && world) {
    updateFly(dt);
    if (input.pressed('back')) setState('garage');
    placeCamera();
    world.update(stage.camera, car.group.position);
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
  get car() {
    return car;
  },
  get state() {
    return state;
  },
  setState,
  enterWorld,
  /** Puts the free camera somewhere and draws one frame. */
  fly(x, y, z, yaw = fly.yaw, pitch = fly.pitch) {
    Object.assign(fly, { x, y, z, yaw, pitch });
    placeCamera();
    stage.camera.updateMatrixWorld();
    world.update(stage.camera, car.group.position);
    stage.render(world.scene, stage.camera);
  },
  /** @param {string} name */
  shot: (name) => stage.shot(name),
  toast,
};
