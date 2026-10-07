/**
 * The Kirigaoka valley as a scene: ground data, scatter, every mesh, the baked light,
 * moonlight, fog and sky. `World.create` builds it in stages so a loading screen can
 * repaint between them.
 */

import * as THREE from 'three';
import { Ground } from './ground.js';
import { scatterWorld } from './scatter.js';
import { LightGrid, sampleLight } from '../render/bake.js';
import { addBeamLight, psxUniforms } from '../render/psx.js';
import { installPools } from '../render/pools.js';
import { WORLD_HALF } from './layout.js';
import { buildTerrain, buildWater } from './build-terrain.js';
import { buildRoads } from './build-roads.js';
import { buildBridges } from './build-bridges.js';
import { buildHighway } from './build-highway.js';
import { buildLamps, buildTown } from './props.js';
import { buildTrees } from './build-trees.js';
import { buildLots, loadModels } from './build-lots.js';
import { HELI_MODELS } from '../police/heli-view.js';
import { PURSUIT_MODELS } from '../police/pursuit-view.js';
import { loadFonts } from '../render/fonts.js';
import { LOTS } from './layout.js';
import { buildStations } from './gas-station.js';
import { buildSky, MOON_DIR } from '../render/sky.js';

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
    const models = await loadModels([...LOTS.map((l) => l.model), ...HELI_MODELS, ...PURSUIT_MODELS]);
    /** Every Blender model loaded for the world (the landmarks, the police helicopter, the spike strip). */
    w.models = models;
    w.scatter = scatterWorld(w.ground, { models });
    w.grid = new LightGrid(w.scatter.lights);
    installPools(w.scatter.lights, WORLD_HALF + 100);
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
    this.sky = buildSky();
    this.scene.add(this.sky);
    this.scene.add(new THREE.HemisphereLight(0x4a5a82, 0x101012, 1.0));
    const moon = new THREE.DirectionalLight(0xa4b6e0, 0.9);
    moon.position.copy(MOON_DIR).multiplyScalar(100);
    this.scene.add(moon, moon.target);
    this.moon = moon;
    this.root = new THREE.Group();
    this.scene.add(this.root);
    /** @type {Ground} */
    this.ground = null;
    /** @type {ReturnType<typeof scatterWorld>} */
    this.scatter = null;
    /** @type {LightGrid} */
    this.grid = null;
    /** @type {{ mesh: THREE.InstancedMesh, x: number, z: number }[]} */
    this.treeChunks = [];
    /** @type {{ mesh: THREE.Mesh, x: number, z: number }[]} */
    this.groundChunks = [];
    this.buildMs = 0;
  }

  /** @param {THREE.Object3D} obj */
  add(obj) {
    this.root.add(obj);
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
    for (const c of this.treeChunks) c.mesh.visible = Math.hypot(c.x - p.x, c.z - p.z) < TREE_DRAW;
    for (const c of this.groundChunks) c.mesh.visible = Math.hypot(c.x - p.x, c.z - p.z) < GROUND_DRAW;
    if (focus) {
      sampleLight(this.grid, focus.x, focus.y + 0.8, focus.z, psxUniforms.uLocalColor.value, _dir);
      addBeamLight(focus.x, focus.y + 0.8, focus.z, psxUniforms.uLocalColor.value, _dir);
      psxUniforms.uLocalDir.value.copy(_dir).transformDirection(camera.matrixWorldInverse);
    }
  }
}
