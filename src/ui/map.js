/**
 * Full-screen tactical map overlay for the Kirigaoka valley.
 * Pauses simulation, displays road network with hierarchy, gas stations, rally start,
 * zone names, player tracking arrow with heading and telemetry, scale bar, and north compass.
 * Supports pan (drag / WASD / arrows), zoom (wheel / +/-), and recenter (Home).
 */

import { LAKE, RALLY, TOWN, WORLD_HALF } from '../world/layout.js';
import { clamp } from '../core/mathx.js';
import { drawRoads } from './minimap.js';

const FONT = '"Lowbeam Display", "Eurostile", "Arial Black", sans-serif';
const AMBER = '#ffb43c';
const CYAN = '#2aa8d8';
const RED = '#e04040';
const INK = '#e9edf2';
const DIM = '#6f7a8a';
const BG = 'rgba(4, 6, 12, 0.88)';

/**
 * Extracts or builds map data structure from the world.
 * When world.mapData lands, it is used directly.
 * @param {any} world
 */
export function mapDataOf(world) {
  if (world?.mapData) return world.mapData;

  const roads = [];
  if (world?.ground?.roads?.roads) {
    for (const r of world.ground.roads.roads) {
      const points = [];
      for (let i = 0; i < r.path.n; i++) {
        points.push([r.path.x[i], r.path.z[i]]);
      }
      if (r.path.closed) points.push([r.path.x[0], r.path.z[0]]);
      const isRally = r.surface === 'gravel';
      const isExpressway = r.hw >= 5 && !isRally;
      const isMountain = r.id === 'ss1' || r.id.startsWith('pass');
      const cls = isRally ? 'rally' : isExpressway ? 'expressway' : isMountain ? 'mountain' : 'road';
      roads.push({
        id: r.id,
        name: r.name || r.id.toUpperCase(),
        cls,
        points,
        gravel: isRally,
        hw: r.hw,
      });
    }
  }

  const pois = [];
  if (world?.scatter?.stations) {
    for (const s of world.scatter.stations) {
      pois.push({
        kind: 'station',
        name: s.pad.name,
        brand: s.brand,
        x: s.pad.cx,
        z: s.pad.cz,
      });
    }
  }

  if (world?.ground?.roads?.byId) {
    const ss1 = world.ground.roads.byId.get(RALLY.road);
    if (ss1) {
      const start = ss1.path.sample(RALLY.startS);
      pois.push({
        kind: 'start',
        name: 'SS1 RALLY START',
        brand: 'rally',
        x: start.x,
        z: start.z,
      });
    }
  }

  const zones = [
    { name: 'KIRIGAOKA TOWN', x: (TOWN.x0 + TOWN.x1) / 2, z: (TOWN.z0 + TOWN.z1) / 2, r: 200 },
    { name: 'LAKE KIRIGAOKA', x: LAKE.x, z: LAKE.z, r: LAKE.r },
    { name: 'KIRIGAOKA RIDGE', x: -650, z: -200, r: 280 },
  ];

  const half = world?.ground?.roads?.half || WORLD_HALF;
  return {
    bounds: { half },
    roads,
    pois,
    zones,
  };
}

export class MapScreen {
  /**
   * @param {HTMLElement} ui
   * @param {any} [world]
   */
  constructor(ui, world = null) {
    this.el = document.createElement('section');
    this.el.id = 'map';
    this.el.className = 'screen';
    ui.appendChild(this.el);

    this.canvas = document.createElement('canvas');
    this.el.appendChild(this.canvas);
    this.g = /** @type {CanvasRenderingContext2D} */ (this.canvas.getContext('2d'));

    this.world = world;
    this.data = null;
    this.cacheCanvas = null;
    this.cacheW = 0;
    this.cacheH = 0;

    // View coordinates (world space)
    this.camX = 0;
    this.camZ = 0;
    this.zoom = 0.55;
    this.targetZoom = 0.55;

    // Mouse drag state
    this.dragging = false;
    this.lastMouseX = 0;
    this.lastMouseY = 0;
    this.hasMoved = false;

    // Setup input listeners
    this.canvas.addEventListener('mousedown', (e) => {
      this.dragging = true;
      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;
    });

    window.addEventListener('mousemove', (e) => {
      if (!this.dragging) return;
      const dx = e.clientX - this.lastMouseX;
      const dy = e.clientY - this.lastMouseY;
      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;
      // Screen pixels to world delta
      this.camX -= dx / this.zoom;
      this.camZ -= dy / this.zoom;
      this.hasMoved = true;
    });

    window.addEventListener('mouseup', () => {
      this.dragging = false;
    });

    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.15 : 0.87;
      this.targetZoom = clamp(this.targetZoom * factor, 0.18, 2.5);
    }, { passive: false });

    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const w = window.innerWidth || 800;
    const h = window.innerHeight || 600;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = w * dpr;
    this.canvas.height = h * dpr;
    this.width = w;
    this.height = h;
    this.dpr = dpr;
  }

  setWorld(world) {
    this.world = world;
    this.data = mapDataOf(world);
    this.buildCache();
  }

  buildCache() {
    if (!this.data) return;
    const half = this.data.bounds.half || WORLD_HALF;
    const size = Math.round(half * 2);
    const cvs = document.createElement('canvas');
    cvs.width = size;
    cvs.height = size;
    const cg = /** @type {CanvasRenderingContext2D} */ (cvs.getContext('2d'));

    // World to cache space: (0, 0) is (-half, -half)
    const toCache = (x, z) => [x + half, z + half];

    // Lake water
    cg.fillStyle = 'rgba(20, 50, 80, 0.4)';
    cg.strokeStyle = 'rgba(42, 168, 216, 0.5)';
    cg.lineWidth = 3;
    cg.beginPath();
    const [lx, lz] = toCache(LAKE.x, LAKE.z);
    cg.arc(lx, lz, LAKE.r, 0, Math.PI * 2);
    cg.fill();
    cg.stroke();

    // Road lines by hierarchy using shared drawRoads
    const cacheRoads = this.data.roads.map((r) => ({
      ...r,
      points: r.points.map(([x, z]) => toCache(x, z)),
    }));

    // Road background outline
    cg.lineCap = 'round';
    cg.lineJoin = 'round';
    cg.strokeStyle = 'rgba(10, 15, 25, 0.8)';
    for (const r of cacheRoads) {
      if (r.points.length < 2) continue;
      const baseW = r.cls === 'expressway' ? 10 : r.cls === 'rally' ? 5 : r.cls === 'mountain' ? 4 : 6;
      cg.lineWidth = baseW + 4;
      cg.beginPath();
      for (let i = 0; i < r.points.length; i++) {
        const [px, pz] = r.points[i];
        if (i === 0) cg.moveTo(px, pz);
        else cg.lineTo(px, pz);
      }
      cg.stroke();
    }

    // Road surface pass using shared drawRoads
    drawRoads(cg, cacheRoads);

    this.cacheCanvas = cvs;
    this.cacheHalf = half;
  }

  /**
   * @param {boolean} on
   * @param {any} [car]
   */
  show(on, car = null) {
    this.el.classList.toggle('on', on);
    if (on) {
      this.resize();
      if (!this.data && this.world) this.setWorld(this.world);
      if (car) {
        this.camX = car.state.x;
        this.camZ = car.state.z;
        this.hasMoved = false;
      }
    }
  }

  /**
   * Updates map input and handles zooming/panning.
   * @param {import('../core/input.js').Input} input
   * @param {any} [car]
   * @returns {'close' | null}
   */
  update(input, car = null) {
    if (input.pressed('map') || input.pressed('back') || input.pressed('pause')) {
      return 'close';
    }

    const panSpeed = (350 / this.zoom) * (1 / 60);
    if (input.down.has('KeyA') || input.down.has('ArrowLeft')) {
      this.camX -= panSpeed;
      this.hasMoved = true;
    }
    if (input.down.has('KeyD') || input.down.has('ArrowRight')) {
      this.camX += panSpeed;
      this.hasMoved = true;
    }
    if (input.down.has('KeyW') || input.down.has('ArrowUp')) {
      this.camZ -= panSpeed;
      this.hasMoved = true;
    }
    if (input.down.has('KeyS') || input.down.has('ArrowDown')) {
      this.camZ += panSpeed;
      this.hasMoved = true;
    }

    // Zoom keys (+ / -)
    if (input.down.has('Equal') || input.down.has('NumpadAdd')) {
      this.targetZoom = clamp(this.targetZoom * 1.03, 0.18, 2.5);
    }
    if (input.down.has('Minus') || input.down.has('NumpadSubtract')) {
      this.targetZoom = clamp(this.targetZoom * 0.97, 0.18, 2.5);
    }

    // Recenter
    if (input.down.has('Home') && car) {
      this.camX = car.state.x;
      this.camZ = car.state.z;
      this.hasMoved = false;
    }

    this.zoom += (this.targetZoom - this.zoom) * 0.2;
    return null;
  }

  /**
   * Renders tactical map view.
   * @param {any} car
   */
  render(car) {
    if (!this.data) {
      if (car?.model?.group?.parent) this.setWorld(car.world || window.__lowbeam?.world);
      if (!this.data) return;
    }

    const g = this.g;
    const w = this.width;
    const h = this.height;
    const dpr = this.dpr;

    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, w * dpr, h * dpr);
    g.scale(dpr, dpr);

    // Dark tactical background
    g.fillStyle = BG;
    g.fillRect(0, 0, w, h);

    // Center of map viewport
    const cx = w / 2;
    const cy = h / 2;
    const z = this.zoom;

    // Tactical grid lines
    g.strokeStyle = 'rgba(255, 180, 60, 0.07)';
    g.lineWidth = 1;
    const gridStep = Math.max(40, 200 * z);
    const ox = ((cx - this.camX * z) % gridStep + gridStep) % gridStep;
    const oy = ((cy - this.camZ * z) % gridStep + gridStep) % gridStep;
    for (let x = ox; x < w; x += gridStep) {
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x, h);
      g.stroke();
    }
    for (let y = oy; y < h; y += gridStep) {
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(w, y);
      g.stroke();
    }

    // World to screen transform
    const toScreen = (wx, wz) => [
      cx + (wx - this.camX) * z,
      cy + (wz - this.camZ) * z,
    ];

    // Draw cached road network
    if (this.cacheCanvas) {
      const half = this.cacheHalf;
      const [left, top] = toScreen(-half, -half);
      g.drawImage(this.cacheCanvas, left, top, half * 2 * z, half * 2 * z);
    }

    // Zone names
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = `bold ${Math.max(11, Math.round(16 * z))}px ${FONT}`;
    for (const zn of this.data.zones) {
      const [zx, zy] = toScreen(zn.x, zn.z);
      if (zx < -150 || zx > w + 150 || zy < -50 || zy > h + 50) continue;
      g.fillStyle = 'rgba(233, 237, 242, 0.35)';
      g.fillText(zn.name, zx, zy);
    }

    // POIs (Gas stations & rally)
    for (const poi of this.data.pois) {
      const [px, py] = toScreen(poi.x, poi.z);
      if (px < -50 || px > w + 50 || py < -50 || py > h + 50) continue;

      if (poi.kind === 'station') {
        const isHoshi = poi.brand === 'hoshi';
        const brandColor = isHoshi ? '#3a7bff' : '#ff6a1f';
        g.fillStyle = brandColor;
        g.fillRect(px - 7, py - 7, 14, 14);
        g.fillStyle = '#fff';
        g.fillRect(px - 3, py - 4, 6, 8);

        // Station label
        g.fillStyle = INK;
        g.font = `10px ${FONT}`;
        g.textAlign = 'center';
        g.fillText(poi.name, px, py + 15);
      } else if (poi.kind === 'start') {
        // Checkered flag marker
        g.fillStyle = '#fff';
        g.fillRect(px - 2, py - 9, 3, 16);
        for (let i = 0; i < 3; i++) {
          for (let j = 0; j < 2; j++) {
            g.fillStyle = (i + j) % 2 ? '#111' : '#fff';
            g.fillRect(px + 1 + i * 3, py - 9 + j * 3, 3, 3);
          }
        }
        g.fillStyle = AMBER;
        g.font = `10px ${FONT}`;
        g.textAlign = 'center';
        g.fillText(poi.name, px, py + 15);
      }
    }

    // Player arrow
    if (car) {
      const s = car.state;
      const [px, py] = toScreen(s.x, s.z);
      const heading = s.yaw;

      g.save();
      g.translate(px, py);
      // Car yaw: 0 is forward (+Z), rotation around Y
      g.rotate(-heading);

      // Player chevron
      g.fillStyle = AMBER;
      g.strokeStyle = '#000';
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(0, 10);
      g.lineTo(8, -8);
      g.lineTo(0, -4);
      g.lineTo(-8, -8);
      g.closePath();
      g.fill();
      g.stroke();

      g.restore();

      // Player telemetry tag
      g.fillStyle = AMBER;
      g.font = `bold 10px ${FONT}`;
      g.textAlign = 'left';
      g.fillText(`${car.spec.name.toUpperCase()} // ${Math.round(s.speed * 3.6)} KM/H`, px + 14, py - 4);
      g.fillStyle = DIM;
      g.font = `9px ${FONT}`;
      g.fillText(`GEAR: ${s.gear < 0 ? 'R' : s.gear === 0 ? 'N' : s.gear}`, px + 14, py + 8);
    }

    // Tactical frame overlays
    this.renderFrame(g, w, h);
  }

  /**
   * @param {CanvasRenderingContext2D} g
   * @param {number} w @param {number} h
   */
  renderFrame(g, w, h) {
    // Header bar
    g.fillStyle = 'rgba(6, 10, 18, 0.75)';
    g.fillRect(0, 0, w, 46);
    g.strokeStyle = 'rgba(255, 180, 60, 0.4)';
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(0, 46);
    g.lineTo(w, 46);
    g.stroke();

    g.fillStyle = AMBER;
    g.font = `bold 13px ${FONT}`;
    g.textAlign = 'left';
    g.fillText('// KIRIGAOKA TACTICAL MAP // SATELLITE TELEMETRY', 24, 28);

    // Footer bar
    g.fillStyle = 'rgba(6, 10, 18, 0.75)';
    g.fillRect(0, h - 38, w, 38);
    g.beginPath();
    g.moveTo(0, h - 38);
    g.lineTo(w, h - 38);
    g.stroke();

    g.fillStyle = DIM;
    g.font = `10px ${FONT}`;
    g.textAlign = 'center';
    g.fillText('TAB / ESC  CLOSE    DRAG / ARROWS  PAN    WHEEL / +/-  ZOOM    HOME  RECENTER', w / 2, h - 16);

    // North Compass (Top Right)
    const nX = w - 48;
    const nY = 82;
    g.strokeStyle = 'rgba(255, 180, 60, 0.6)';
    g.lineWidth = 1.5;
    g.beginPath();
    g.arc(nX, nY, 18, 0, Math.PI * 2);
    g.stroke();

    // North arrow points up (-Z in world is up on map screen)
    g.fillStyle = RED;
    g.beginPath();
    g.moveTo(nX, nY - 14);
    g.lineTo(nX + 5, nY);
    g.lineTo(nX - 5, nY);
    g.closePath();
    g.fill();

    g.fillStyle = INK;
    g.beginPath();
    g.moveTo(nX, nY + 14);
    g.lineTo(nX + 5, nY);
    g.lineTo(nX - 5, nY);
    g.closePath();
    g.fill();

    g.fillStyle = INK;
    g.font = `bold 9px ${FONT}`;
    g.textAlign = 'center';
    g.fillText('N', nX, nY - 22);

    // Scale bar (Bottom Left)
    const sbX = 24;
    const sbY = h - 60;
    // Length in meters that looks reasonable on screen (e.g. 100 px)
    const mPerPx = 1 / this.zoom;
    let distM = 200;
    if (mPerPx * 100 > 800) distM = 1000;
    else if (mPerPx * 100 > 350) distM = 500;
    else if (mPerPx * 100 < 80) distM = 50;
    else if (mPerPx * 100 < 150) distM = 100;

    const barW = distM * this.zoom;
    g.strokeStyle = INK;
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(sbX, sbY - 4);
    g.lineTo(sbX, sbY);
    g.lineTo(sbX + barW, sbY);
    g.lineTo(sbX + barW, sbY - 4);
    g.stroke();

    g.fillStyle = INK;
    g.font = `10px ${FONT}`;
    g.textAlign = 'left';
    g.fillText(`${distM} M`, sbX + barW + 8, sbY - 1);
  }
}

/**
 * Creates MapScreen instance.
 * @param {HTMLElement} ui
 * @param {any} [world]
 */
export function mapScreen(ui, world = null) {
  return new MapScreen(ui, world);
}
