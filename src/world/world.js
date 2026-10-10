/**
 * The island of Kurogane as a scene: ground data, scatter, every mesh, the baked light,
 * moonlight, fog and sky. `World.create` builds it in stages so a loading screen can
 * repaint between them.
 */

import * as THREE from 'three';
import { Ground } from './ground.js';
import { scatterWorld } from './scatter.js';
import { placeStakeouts } from './stakeouts.js';
import { LightGrid, sampleLight } from '../render/bake.js';
import { addBeamLight, psxUniforms } from '../render/psx.js';
import { installPools } from '../render/pools.js';
import { WORLD_HALF } from './layout.js';
import { buildTerrain, buildWater } from './build-terrain.js';
import { buildRoads } from './build-roads.js';
import { buildBridges } from './build-bridges.js';
import { buildHighway } from './build-highway.js';
import { buildVending } from './build-vending.js';
import { buildPoles } from './build-poles.js';
import { buildGuideSigns } from './build-guide-signs.js';
import { buildLamps, buildTown } from './props.js';
import { LampGlow } from './build-lamp-glow.js';
import { buildTrees } from './build-trees.js';
import { buildLots, loadModels } from './build-lots.js';
import { HELI_MODELS } from '../police/heli-view.js';
import { PURSUIT_MODELS } from '../police/pursuit-view.js';
import { KIND_MODELS } from '../traffic/kinds.js';
import { loadFonts } from '../render/fonts.js';
import { LOTS } from './layout.js';
import { buildStations } from './gas-station.js';
import { SkyView, setSrgb } from '../render/sky.js';
import { CYCLE_START, HOURS, advanceClock, skyLook } from '../render/daylight.js';
import { RainView } from '../render/rain.js';
import { CoverGrid, coverAt, placeRoofs } from './rain-cover.js';
import { weatherLook } from '../render/weather.js';

const _dir = new THREE.Vector3();

export const FOG = { color: 0x070a14, near: 30, far: 420 };
/** Chunks whose center is farther than this from the camera are hidden: they are lost in the fog. */
const TREE_DRAW = FOG.far + 180;
const GROUND_DRAW = FOG.far + 200;

export class World {
  /**
   * @param {(label: string) => Promise<void>} [step]
   */
  static async create(step = async () => {}) {
    const w = new World();
    const t0 = performance.now();
    await step('SURVEYING KUROGANE');
    await loadFonts();
    w.ground = new Ground();
    await step('PLACING LAMPS AND TREES');
    const models = await loadModels([...LOTS.map((l) => l.model), ...HELI_MODELS, ...PURSUIT_MODELS, ...Object.values(KIND_MODELS)]);
    /** Every Blender model loaded for the world (the landmarks, the police helicopter, the spike strip). */
    w.models = models;
    w.scatter = scatterWorld(w.ground, { models });
    w.stakeouts = placeStakeouts(w.ground);
    w.grid = new LightGrid(w.scatter.lights);
    installPools(w.scatter.lights, WORLD_HALF + 100);
    w.rain.setCover(new CoverGrid(coverAt(w.ground, placeRoofs(w.scatter.stations, w.scatter.highway.plazas))));
    await step('CUTTING THE TERRAIN');
    const terrain = buildTerrain(w.ground, w.grid);
    w.add(terrain);
    w.groundChunks.push(...terrain.userData.chunks);
    w.add(buildWater());
    await step('LAYING THE ROADS');
    const roads = buildRoads(w.ground, w.grid);
    w.add(roads);
    w.groundChunks.push(...roads.userData.chunks);
    w.add(buildBridges(w.scatter.bridges, w.ground, w.grid));
    const highway = buildHighway(w.scatter.highway, w.grid);
    w.add(highway);
    w.groundChunks.push(...highway.userData.chunks);
    await step('BUILDING THE CITY');
    w.add(buildLamps(w.scatter.lamps, w.grid));
    w.lampGlow = new LampGlow(w.scatter.lamps);
    w.add(w.lampGlow.mesh);
    w.add(buildVending(w.scatter.vending, w.grid));
    w.add(buildGuideSigns(w.scatter.guides, w.grid));
    const poles = buildPoles(w.scatter.poles, w.grid);
    w.add(poles);
    w.groundChunks.push(...poles.userData.chunks);
    const town = buildTown(w.scatter.buildings, w.grid);
    w.add(town);
    w.groundChunks.push(...town.userData.chunks);
    w.add(buildLots(w.ground.lots, models));
    w.add(buildStations(w.scatter.stations, w.grid));
    await step('GROWING THE FOREST');
    const trees = buildTrees(w.scatter.trees);
    w.treeChunks = trees.chunks;
    w.add(trees.group);
    w.buildMs = performance.now() - t0;
    return w;
  }

  constructor() {
    /** @type {Record<string, import('./lots.js').ModelData>} */
    this.models = {};
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(FOG.color);
    this.scene.fog = new THREE.Fog(FOG.color, FOG.near, FOG.far);
    this.skyView = new SkyView();
    this.sky = this.skyView.group;
    this.scene.add(this.sky);
    this.rain = new RainView();
    this.scene.add(this.rain.lines);
    /** The weather level, 0 dry to 1 a storm (`render/weather.js`). */
    this.weather = 0;
    this.hemi = new THREE.HemisphereLight(0x4a5a82, 0x101012, 1.0);
    this.key = new THREE.DirectionalLight(0xa4b6e0, 0.9);
    this.scene.add(this.hemi, this.key, this.key.target);
    /** The hour of the day, 0 to 24 (`render/daylight.js`), and whether it runs. */
    this.hour = HOURS.night;
    this.cycling = false;
    /** The cloud cover, 0 to 1, from the weather. */
    this.cloud = 0;
    this.look = skyLook(this.hour, this.cloud);
    this.applySky();
    this.root = new THREE.Group();
    this.scene.add(this.root);
    /** @type {Ground} */
    this.ground = null;
    /** @type {ReturnType<typeof scatterWorld>} */
    this.scatter = null;
    /** Where the undercover cars wait, with the ground's height under each (world/stakeouts.js). @type {import('./stakeouts.js').StakeoutSpot[]} */
    this.stakeouts = [];
    /** @type {LightGrid} */
    this.grid = null;
    /** @type {{ mesh: THREE.InstancedMesh, x: number, z: number }[]} */
    this.treeChunks = [];
    /** @type {{ mesh: THREE.Mesh, x: number, z: number }[]} */
    this.groundChunks = [];
    this.buildMs = 0;
    /** @type {LampGlow | null} */
    this.lampGlow = null;
  }

  /** @param {THREE.Object3D} obj */
  add(obj) {
    this.root.add(obj);
  }

  /**
   * Sets the weather: the roads soak, the fog closes in and the rain falls.
   * @param {number} level 0 to 1
   */
  setWeather(level) {
    this.weather = level;
    const look = weatherLook(level);
    this.cloud = look.cloud;
    this.applySky();
    psxUniforms.uWet.value = look.wet;
    const fog = /** @type {THREE.Fog} */ (this.scene.fog);
    fog.near = look.fogNear;
    fog.far = look.fogFar;
  }

  /**
   * Fixes the time of day. @param {number} hour 0 to 24
   */
  setTime(hour) {
    this.hour = hour;
    this.cycling = false;
    this.applySky();
  }

  /**
   * Starts the clock running from an hour; a day takes 24 minutes.
   * @param {number} [from]
   */
  startCycle(from = CYCLE_START) {
    this.hour = from;
    this.cycling = true;
    this.applySky();
  }

  /**
   * Sets the light, the fog and the sky from the hour and the cloud cover.
   * @param {number} [dt] seconds, for the clouds' drift
   */
  applySky(dt = 0) {
    const look = skyLook(this.hour, this.cloud);
    this.look = look;
    this.skyView.update(look, dt);
    setSrgb(this.hemi.color, look.hemiSky);
    setSrgb(this.hemi.groundColor, look.hemiGround);
    this.hemi.intensity = look.hemi;
    setSrgb(this.key.color, look.keyColor);
    this.key.intensity = look.keyIntensity;
    this.key.position.set(look.keyDir[0], look.keyDir[1], look.keyDir[2]).multiplyScalar(100);
    setSrgb(/** @type {THREE.Color} */ (this.scene.background), look.fog);
    setSrgb(/** @type {THREE.Fog} */ (this.scene.fog).color, look.fog);
    psxUniforms.uLamp.value = look.lamp;
    psxUniforms.uWindows.value = look.windows;
  }

  /**
   * Per frame: runs the clock and drifts the clouds. @param {number} dt
   */
  stepSky(dt) {
    if (this.cycling) this.hour = advanceClock(this.hour, dt);
    this.applySky(dt);
  }

  /**
   * Per frame: moves the rain. @param {number} dt
   * @param {{ vx: number, vy?: number, vz: number }} [vel] the camera's velocity
   * @param {{ x: number, z: number }} [at] the camera's position
   */
  stepWeather(dt, vel, at) {
    this.rain.update(dt, this.weather, vel, at);
  }

  /**
   * Per frame: keep the sky around the camera, hide tree chunks lost in the fog, and
   * set the local light (psx.js) from the baked lights around `focus`, the player car.
   * @param {THREE.Camera} camera
   * @param {THREE.Vector3} [focus]
   */
  update(camera, focus) {
    const p = camera.position;
    this.sky.position.copy(p);
    this.lampGlow?.update(p, this.look.lamp, psxUniforms.uWet.value);
    for (const c of this.treeChunks) c.mesh.visible = Math.hypot(c.x - p.x, c.z - p.z) < TREE_DRAW;
    for (const c of this.groundChunks) c.mesh.visible = Math.hypot(c.x - p.x, c.z - p.z) < GROUND_DRAW;
    if (focus) {
      sampleLight(this.grid, focus.x, focus.y + 0.8, focus.z, psxUniforms.uLocalColor.value, _dir);
      psxUniforms.uLocalColor.value.multiplyScalar(this.look.lamp);
      addBeamLight(focus.x, focus.y + 0.8, focus.z, psxUniforms.uLocalColor.value, _dir);
      psxUniforms.uLocalDir.value.copy(_dir).transformDirection(camera.matrixWorldInverse);
    }
  }
}
