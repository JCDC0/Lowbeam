/**
 * Boot and the state machine: title, garage, loading, drive and pause, plus a free
 * camera for development. `window.__lowbeam` exposes the pieces so a browser session
 * can force a state and call `shot(name)`, which writes tools/shots/<name>.png.
 */

import * as THREE from 'three';
import { createStage, DEFAULT_LINES } from './render/stage.js';
import { Input } from './core/input.js';
import { Garage } from './ui/garage.js';
import { Hud } from './ui/hud.js';
import { bannerer, controlsScreen, flasher, loadingScreen, mainMenuScreen, pauseScreen, settingsScreen, titleScreen, toaster } from './ui/menus.js';
import { mapScreen } from './ui/map.js';
import { pursuitHud } from './ui/pursuit.js';
import { statsOverlay } from './ui/stats.js';
import { RouteTracker } from './ui/route.js';
import { routeHud } from './ui/route-hud.js';
import { World } from './world/world.js';
import { Drive } from './drive.js';
import { audio } from './audio/audio.js';
import { store } from './core/store.js';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('view'));
const ui = /** @type {HTMLElement} */ (document.getElementById('ui'));

const version = await fetch('package.json')
  .then((r) => r.json())
  .then((p) => p.version)
  .catch(() => '');
await document.fonts.load('16px "Lowbeam Display"').catch(() => {});

const stage = createStage(canvas);
stage.configure({ lines: store.get('renderHeight', DEFAULT_LINES) });
const input = new Input();
// Browsers keep audio suspended until a key or click; the first one starts it.
for (const type of ['keydown', 'pointerdown']) {
  window.addEventListener(type, async function start() {
    if (await audio.unlock()) window.removeEventListener(type, start);
  });
}
const title = titleScreen(ui, version);
const menu = mainMenuScreen(ui);
const settings = settingsScreen(ui, stage);
const controls = controlsScreen(ui, input);
const loading = loadingScreen(ui);
const garage = new Garage(ui);
const hud = new Hud(ui);
const pause = pauseScreen(ui);
const map = mapScreen(ui);
const pursuit = pursuitHud(ui);
const toast = toaster(ui);
const banner = bannerer(ui);
const flash = flasher(ui);
const tracker = new RouteTracker(null);
const rHud = routeHud(ui);
const stats = statsOverlay(ui, stage, () => drive?.traffic?.agents?.length ?? 0);
audio.onTrack = (t) => {
  if (state === 'drive') toast(`NOW PLAYING   ${t.title.toUpperCase()}`, 3);
};
/** @type {'menu' | 'pause'} */
let prevSettingsState = 'menu';
/** @type {'menu' | 'pause' | 'settings'} */
let prevControlsState = 'menu';

/** @type {World | null} */
let world = null;
/** @type {Drive | null} */
let drive = null;
/** @type {import('./ui/pursuit.js').PursuitView | null} */
let pursuitMock = null;
/** @type {import('./ui/pursuit.js').PoliceMarker[] | null} */
let markersMock = null;
const fly = { x: 0, y: 30, z: 0, yaw: 0, pitch: -0.2 };

/** @typedef {'title' | 'menu' | 'garage' | 'loading' | 'drive' | 'pause' | 'settings' | 'controls' | 'map' | 'free'} State */
/** @type {State} */
let state = 'title';

/** @param {State} next */
function setState(next) {
  state = next;
  title.show(state === 'title');
  menu.show(state === 'menu');
  garage.show(state === 'garage');
  settings.show(state === 'settings');
  controls.show(state === 'controls');
  loading.show(state === 'loading');
  hud.show(state === 'drive' || state === 'pause');
  rHud.show(state === 'drive' || state === 'pause');
  pause.show(state === 'pause');
  map.show(state === 'map', drive?.car);
  if (state === 'menu') menu.refresh(garage.spec);
  const audioMode = state === 'menu' ? 'title' : (state === 'controls' ? (prevControlsState === 'pause' ? 'pause' : 'title') : (state === 'settings' ? (prevSettingsState === 'pause' ? 'pause' : 'title') : (state === 'map' ? 'pause' : state)));
  audio.setMode(/** @type {import('./audio/audio.js').Mode} */ (audioMode));
  if (state === 'garage') garageSound();
}

let soundCar = -1;
/** Gives the garage the chosen car's idle, with a blip when the choice changes. */
function garageSound() {
  if (soundCar === garage.index) return;
  soundCar = garage.index;
  audio.setCar(garage.spec);
  audio.garageBlip();
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
    drive = new Drive({ world, stage, input, hud, toast, banner, flash });
    map.setWorld(world);
  }
  drive.start(garage.spec, garage.model.paintIndex);
  setState('drive');
}

/**
 * The pursuit view with the units on the scene counted by kind, for the row over the pursuit HUD,
 * when the Drive does not count them itself.
 * @param {any} view
 */
function withKinds(view) {
  if (!view || view.byKind) return view;
  /** @type {Record<string, number>} */
  const byKind = {};
  for (const u of drive?.traffic?.units?.() ?? []) {
    if (!u.pursuit || u.mode === 'wreck') continue;
    byKind[u.kind.id] = (byKind[u.kind.id] || 0) + 1;
  }
  return { ...view, byKind };
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
    if (input.pressed('confirm')) {
      audio.ui('select');
      setState('menu');
    }
    garage.render(stage);
  } else if (state === 'menu') {
    garage.update(dt, null);
    const ev = menu.update(input);
    if (ev === 'drive') enterWorld();
    else if (ev === 'garage') setState('garage');
    else if (ev === 'settings') {
      prevSettingsState = 'menu';
      setState('settings');
    } else if (ev === 'controls') {
      prevControlsState = 'menu';
      setState('controls');
    } else if (ev === 'title') setState('title');
    garage.render(stage);
  } else if (state === 'garage') {
    const ev = garage.update(dt, input);
    garageSound();
    if (ev === 'back') setState('menu');
    else if (ev === 'drive') enterWorld();
    garage.render(stage);
  } else if (state === 'settings') {
    const ev = settings.update(input);
    if (drive?.cluster && drive.car?.spec) {
      drive.cluster.setSpec(drive.car.spec, store.get('clusterStyle', 'car'));
    }
    if (ev === 'back') setState(prevSettingsState);
    else if (ev === 'controls') {
      prevControlsState = 'settings';
      setState('controls');
    }
    if (prevSettingsState === 'pause' && drive) drive.render();
    else {
      garage.update(dt, null);
      garage.render(stage);
    }
  } else if (state === 'controls') {
    const ev = controls.update(input);
    if (ev === 'back') setState(prevControlsState);
    if (prevControlsState === 'pause' && drive) drive.render();
    else {
      garage.update(dt, null);
      garage.render(stage);
    }
  } else if (state === 'drive') {
    if (input.pressed('map')) {
      audio.ui('select');
      setState('map');
    } else {
      if (drive.update(dt) === 'pause') setState('pause');
      drive.render();
    }
  } else if (state === 'map') {
    if (drive) drive.render();
    const ev = map.update(input, drive?.car);
    if (ev === 'close' || input.pressed('map') || input.pressed('back')) {
      audio.ui('back');
      setState('drive');
    } else if (drive?.car) {
      map.render(drive.car);
    }
  } else if (state === 'pause') {
    const pick = pause.update(input);
    if (pick === 'resume') setState('drive');
    else if (pick === 'settings') {
      prevSettingsState = 'pause';
      setState('settings');
    }
    else if (pick === 'controls') {
      prevControlsState = 'pause';
      setState('controls');
    }
    else if (pick === 'garage') setState('garage');
    else if (pick === 'menu') setState('menu');
    else if (pick === 'title') setState('title');
    drive.render();
  } else if (state === 'free' && world) {
    updateFly(dt);
    if (input.pressed('back')) setState('drive');
    placeFly();
    world.update(stage.camera, drive.car.group.position);
    stage.render(world.scene, stage.camera);
  }
  if (drive?.trafficNet && tracker.net !== drive.trafficNet) tracker.net = drive.trafficNet;
  if (drive?.car) tracker.update(drive.car, dt);
  rHud.update(tracker, dt);
  // The pursuit HUD belongs to the drive screen: anywhere else (the garage, a menu, the map) it is gone.
  const driving = state === 'drive';
  pursuit.update(pursuitMock ?? (driving ? withKinds(/** @type {any} */ (drive)?.pursuitView?.() ?? null) : null), dt, driving ? drive?.detect ?? null : null);
  input.endFrame();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

window.__lowbeam = {
  THREE,
  audio,
  stage,
  input,
  garage,
  menu,
  settings,
  controls,
  map,
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
  pursuit,
  /**
   * Sets pursuit mock view and optional markers for testing and capturing screenshots.
   * @param {import('./ui/pursuit.js').PursuitView | string | null} [view]
   * @param {import('./ui/pursuit.js').PoliceMarker[]} [markers]
   */
  pursuitDemo(view = 'pursuit', markers = []) {
    if (typeof view === 'string') {
      const presets = {
        pursuit: { state: 'pursuit', heat: 2, evade: 0.35, cooldown: 0, bust: 0, units: 3, heli: false, bounty: 12500, time: 48 },
        evading: { state: 'evading', heat: 3, evade: 0.72, cooldown: 0, bust: 0, units: 4, heli: true, bounty: 45000, time: 115 },
        cooldown: { state: 'cooldown', heat: 3, evade: 1.0, cooldown: 0.45, bust: 0, units: 4, heli: true, bounty: 45000, time: 130 },
        busted: { state: 'busted', heat: 2, evade: 0.1, cooldown: 0, bust: 1.0, units: 2, heli: false, bounty: 18000, time: 62 },
        escaped: { state: 'escaped', heat: 3, evade: 1.0, cooldown: 1.0, bust: 0, units: 0, heli: false, bounty: 50000, time: 155 },
      };
      pursuitMock = presets[view] ?? null;
    } else {
      pursuitMock = view;
    }
    markersMock = markers;
    pursuit.update(pursuitMock, 0);
    return pursuitMock;
  },
  getMarkers() {
    return markersMock ?? (/** @type {any} */ (drive)?.policeMarkers?.() ?? []);
  },
  tracker,
  routeHud: rHud,
  setWaypoint(pt) {
    tracker.setDestination(pt);
  },
  clearWaypoint() {
    tracker.clear();
  },
  /** The police heat for the minimap's flame and rim: the level, its value (the fraction is the progress to the next level) and whether a pursuit is on. */
  getHeat() {
    const police = /** @type {any} */ (drive)?.police;
    if (!police || state !== 'drive') return null;
    return { level: police.level, value: police.heat?.value ?? police.level, pursuit: !!police.active };
  },
  getRoute() {
    return tracker.getRouteInfo();
  },
};
