/**
 * Full-screen tactical map overlay for the island of Kurogane.
 * Pauses simulation, displays road network with hierarchy, gas stations, rally start,
 * zone names, player tracking arrow with heading and telemetry, scale bar, and north compass.
 * Supports pan (drag / WASD / arrows), zoom (wheel / +/-), and recenter (Home).
 */

import { LAKE, RALLY, WORLD_HALF, ZONES } from '../world/layout.js';
import { clamp } from '../core/mathx.js';
import { FONT as FACES } from '../render/fonts.js';
import { drawRoads } from './minimap.js';

const FONT = FACES.display;
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

  // The island's own areas (the names the drive shows); the map once kept the old valley's three.
  const zones = ZONES.map((zn) => zn.circle
    ? { name: zn.name, x: zn.circle.x, z: zn.circle.z, r: zn.circle.r }
    : { name: zn.name, x: (zn.rect.x0 + zn.rect.x1) / 2, z: (zn.rect.z0 + zn.rect.z1) / 2, r: Math.min(zn.rect.x1 - zn.rect.x0, zn.rect.z1 - zn.rect.z0) / 2 });

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
   * @param {() => Array<{ kind: 'police' | 'heli', x: number, z: number, yaw: number, search?: { x: number, z: number, r: number } }>} [getMarkers]
   * @param {() => { route?: any, destination?: any, distance?: number, arrived?: boolean } | null} [getRoute]
   * @param {(pt: { x: number, z: number }) => any} [setWaypoint]
   * @param {() => void} [clearWaypoint]
   */
  constructor(ui, world = null, getMarkers, getRoute, setWaypoint, clearWaypoint) {
    this.el = document.createElement('section');
    this.el.id = 'map';
    this.el.className = 'screen';
    ui.appendChild(this.el);

    this.canvas = document.createElement('canvas');
    this.el.appendChild(this.canvas);
    this.g = /** @type {CanvasRenderingContext2D} */ (this.canvas.getContext('2d'));

    this.world = world;
    this.getMarkers = getMarkers ?? (() => (/** @type {any} */ (globalThis).window?.__lowbeam?.getMarkers?.() ?? []));
    this.getRoute = getRoute ?? (() => (/** @type {any} */ (globalThis).window?.__lowbeam?.getRoute?.() ?? null));
    this.setWaypoint = setWaypoint ?? ((pt) => (/** @type {any} */ (globalThis).window?.__lowbeam?.setWaypoint?.(pt)));
    this.clearWaypoint = clearWaypoint ?? (() => (/** @type {any} */ (globalThis).window?.__lowbeam?.clearWaypoint?.()));
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
    let startX = 0;
    let startY = 0;

    // Setup input listeners
    this.canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        this.dragging = true;
        this.lastMouseX = e.clientX;
        this.lastMouseY = e.clientY;
        startX = e.clientX;
        startY = e.clientY;
      }
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

    window.addEventListener('mouseup', (e) => {
      if (this.dragging && e.button === 0) {
        this.dragging = false;
        const d = Math.hypot(e.clientX - startX, e.clientY - startY);
        if (d < 6) {
          this.handleClick(e.clientX, e.clientY);
        }
      }
    });

    this.canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      if (this.clearWaypoint) this.clearWaypoint();
    });

    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.15 : 0.87;
      this.targetZoom = clamp(this.targetZoom * factor, 0.18, 2.5);
    }, { passive: false });

    this.resize();
    window.addEventListener('resize', () => this.resize());
    if (world) this.setWorld(world);
  }

  /**
   * Handles click on canvas to set waypoint, snapping to landmark icon if near.
   * @param {number} clientX
   * @param {number} clientY
   */
  handleClick(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    const screenX = clientX - rect.left;
    const screenY = clientY - rect.top;
    const cx = this.width / 2;
    const cy = this.height / 2;
    const wx = this.camX + (screenX - cx) / this.zoom;
    const wz = this.camZ + (screenY - cy) / this.zoom;

    let targetX = wx;
    let targetZ = wz;

    if (this.data?.pois) {
      const snapDist = 20;
      let closest = null;
      let closestD = Infinity;
      for (const poi of this.data.pois) {
        const poiScreenX = cx + (poi.x - this.camX) * this.zoom;
        const poiScreenY = cy + (poi.z - this.camZ) * this.zoom;
        const d = Math.hypot(screenX - poiScreenX, screenY - poiScreenY);
        if (d < snapDist && d < closestD) {
          closestD = d;
          closest = poi;
        }
      }
      if (closest) {
        targetX = closest.x;
        targetZ = closest.z;
      }
    }

    if (this.setWaypoint) {
      this.setWaypoint({ x: targetX, z: targetZ });
    }
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

    const toCache = (x, z) => [x + half, z + half];

    const water = this.data.water;
    if (water?.coast && water.coast.length > 2) {
      cg.fillStyle = 'rgba(10, 24, 44, 0.85)';
      cg.beginPath();
      cg.rect(0, 0, size, size);
      for (let i = 0; i < water.coast.length; i++) {
        const [cx, cz] = toCache(water.coast[i][0], water.coast[i][1]);
        if (i === 0) cg.moveTo(cx, cz);
        else cg.lineTo(cx, cz);
      }
      cg.closePath();
      cg.fill('evenodd');

      cg.strokeStyle = 'rgba(42, 168, 216, 0.6)';
      cg.lineWidth = 4;
      cg.beginPath();
      for (let i = 0; i < water.coast.length; i++) {
        const [cx, cz] = toCache(water.coast[i][0], water.coast[i][1]);
        if (i === 0) cg.moveTo(cx, cz);
        else cg.lineTo(cx, cz);
      }
      cg.closePath();
      cg.stroke();
    } else if (water?.sea) {
      cg.fillStyle = 'rgba(10, 24, 44, 0.85)';
      const s = water.sea;
      const x0 = s.x0 ?? s.x ?? -half;
      const z0 = s.z0 ?? s.z ?? -half;
      const [sx0, sz0] = toCache(x0, z0);
      const w = s.x1 !== undefined ? s.x1 - s.x0 : s.w ?? size;
      const h = s.z1 !== undefined ? s.z1 - s.z0 : s.h ?? size;
      cg.fillRect(sx0, sz0, w, h);
    }

    if (water?.lakes) {
      cg.fillStyle = 'rgba(20, 50, 80, 0.5)';
      cg.strokeStyle = 'rgba(42, 168, 216, 0.5)';
      cg.lineWidth = 3;
      for (const lake of water.lakes) {
        cg.beginPath();
        const [lx, lz] = toCache(lake.x, lake.z);
        cg.arc(lx, lz, lake.r, 0, Math.PI * 2);
        cg.fill();
        cg.stroke();
      }
    } else if (LAKE) {
      cg.fillStyle = 'rgba(20, 50, 80, 0.4)';
      cg.strokeStyle = 'rgba(42, 168, 216, 0.5)';
      cg.lineWidth = 3;
      cg.beginPath();
      const [lx, lz] = toCache(LAKE.x, LAKE.z);
      cg.arc(lx, lz, LAKE.r, 0, Math.PI * 2);
      cg.fill();
      cg.stroke();
    }

    const cacheRoads = this.data.roads.map((r) => ({
      ...r,
      points: r.points.map(([x, z]) => toCache(x, z)),
      lifted: r.lifted ? r.lifted.map((run) => run.map(([x, z]) => toCache(x, z))) : undefined,
    }));

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
    if (input.pressed('map') || input.down.has('Escape')) {
      return 'close';
    }

    if (input.hit.has('Backspace')) {
      if (this.clearWaypoint) this.clearWaypoint();
    }

    if (input.hit.has('Enter') || input.hit.has('NumpadEnter')) {
      let targetX = this.camX;
      let targetZ = this.camZ;
      if (this.data?.pois) {
        let closest = null;
        let closestD = Infinity;
        for (const poi of this.data.pois) {
          const d = Math.hypot(this.camX - poi.x, this.camZ - poi.z);
          if (d < (28 / this.zoom) && d < closestD) {
            closestD = d;
            closest = poi;
          }
        }
        if (closest) {
          targetX = closest.x;
          targetZ = closest.z;
        }
      }
      if (this.setWaypoint) this.setWaypoint({ x: targetX, z: targetZ });
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

    // Active GPS route
    const routeInfo = this.getRoute ? this.getRoute() : null;
    const route = routeInfo?.route;
    if (route && route.points && route.points.length >= 2) {
      g.save();
      g.lineCap = 'round';
      g.lineJoin = 'round';
      g.strokeStyle = 'rgba(0, 229, 255, 0.4)';
      g.lineWidth = Math.max(6, 8 * z);
      g.beginPath();
      for (let i = 0; i < route.points.length; i++) {
        const [rx, ry] = toScreen(route.points[i][0], route.points[i][1]);
        if (i === 0) g.moveTo(rx, ry);
        else g.lineTo(rx, ry);
      }
      g.stroke();

      g.strokeStyle = '#00e5ff';
      g.lineWidth = Math.max(3, 4.2 * z);
      g.beginPath();
      for (let i = 0; i < route.points.length; i++) {
        const [rx, ry] = toScreen(route.points[i][0], route.points[i][1]);
        if (i === 0) g.moveTo(rx, ry);
        else g.lineTo(rx, ry);
      }
      g.stroke();
      g.restore();
    }

    if (routeInfo?.destination) {
      const dest = routeInfo.destination;
      const destX = Array.isArray(dest) ? dest[0] : dest.x;
      const destZ = Array.isArray(dest) ? dest[1] : dest.z;
      const [wpx, wpy] = toScreen(destX, destZ);

      g.save();
      const pulse = (Math.sin(performance.now() * 0.006) + 1) * 0.5;
      g.strokeStyle = 'rgba(0, 229, 255, 0.6)';
      g.lineWidth = 1.5;
      g.beginPath();
      g.arc(wpx, wpy, 11 + pulse * 4, 0, Math.PI * 2);
      g.stroke();

      g.fillStyle = '#00e5ff';
      g.strokeStyle = '#fff';
      g.lineWidth = 2;
      g.beginPath();
      g.arc(wpx, wpy - 8, 6, 0, Math.PI * 2);
      g.fill();
      g.stroke();

      g.beginPath();
      g.moveTo(wpx, wpy);
      g.lineTo(wpx - 4, wpy - 6);
      g.lineTo(wpx + 4, wpy - 6);
      g.closePath();
      g.fill();
      g.stroke();

      g.fillStyle = '#060a12';
      g.beginPath();
      g.arc(wpx, wpy - 8, 2.5, 0, Math.PI * 2);
      g.fill();

      const d = routeInfo.distance;
      const distStr = d !== undefined ? (d >= 1000 ? `${(d / 1000).toFixed(1)} KM` : `${Math.round(d)} M`) : '';
      if (distStr) {
        g.fillStyle = '#00e5ff';
        g.font = `bold 11px ${FONT}`;
        g.textAlign = 'center';
        g.fillText(`WAYPOINT // ${distStr}`, wpx, wpy - 20);
      }
      g.restore();
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

    // POIs
    for (const poi of this.data.pois) {
      const [px, py] = toScreen(poi.x, poi.z);
      if (px < -50 || px > w + 50 || py < -50 || py > h + 50) continue;

      drawPoiIcon(g, poi.kind, px, py, poi.brand);
      if (poi.name) {
        g.fillStyle = poi.kind === 'start' ? AMBER : INK;
        g.font = `10px ${FONT}`;
        g.textAlign = 'center';
        g.fillText(poi.name, px, py + 15);
      }
    }

    // Police and helicopter markers (A13)
    const markers = (this.getMarkers ? this.getMarkers() : null) || [];
    const sirenRed = Math.floor(performance.now() / 200) % 2 === 0;

    for (const m of markers) {
      // Helicopter searchlight circle
      if (m.kind === 'heli' && m.search && m.search.r > 0) {
        const [spotX, spotY] = toScreen(m.search.x, m.search.z);
        const spotRadius = m.search.r * z;
        g.save();
        g.beginPath();
        g.arc(spotX, spotY, spotRadius, 0, Math.PI * 2);
        g.fillStyle = 'rgba(255, 255, 230, 0.22)';
        g.fill();
        g.strokeStyle = 'rgba(255, 255, 200, 0.55)';
        g.lineWidth = 1.5;
        g.stroke();
        g.restore();
      }

      const [mx, my] = toScreen(m.x, m.z);
      if (mx < -50 || mx > w + 50 || my < -50 || my > h + 50) continue;

      g.save();
      g.translate(mx, my);
      g.rotate(-m.yaw);

      if (m.kind === 'heli') {
        g.fillStyle = '#5ad5ff';
        g.beginPath();
        g.arc(0, 0, 4, 0, Math.PI * 2);
        g.fill();
        g.strokeStyle = '#fff';
        g.lineWidth = 1.5;
        const rotorAng = (performance.now() * 0.025) % (Math.PI * 2);
        g.beginPath();
        g.moveTo(Math.cos(rotorAng) * 9, Math.sin(rotorAng) * 9);
        g.lineTo(-Math.cos(rotorAng) * 9, -Math.sin(rotorAng) * 9);
        g.moveTo(Math.cos(rotorAng + Math.PI / 2) * 9, Math.sin(rotorAng + Math.PI / 2) * 9);
        g.lineTo(-Math.cos(rotorAng + Math.PI / 2) * 9, -Math.sin(rotorAng + Math.PI / 2) * 9);
        g.stroke();
      } else {
        // Police car chevron pointing forward
        g.fillStyle = sirenRed ? '#ff2b3d' : '#2b7fff';
        g.strokeStyle = '#fff';
        g.lineWidth = 1.5;
        g.beginPath();
        g.moveTo(0, 8);
        g.lineTo(6, -6);
        g.lineTo(0, -3);
        g.lineTo(-6, -6);
        g.closePath();
        g.fill();
        g.stroke();
      }
      g.restore();
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
    g.fillText('// KUROGANE TACTICAL MAP // SATELLITE TELEMETRY', 24, 28);

    const legX = 24;
    const legY = 56;
    g.fillStyle = 'rgba(6, 10, 18, 0.82)';
    g.fillRect(legX, legY, 148, 142);
    g.strokeStyle = 'rgba(255, 180, 60, 0.35)';
    g.lineWidth = 1;
    g.strokeRect(legX, legY, 148, 142);

    g.fillStyle = AMBER;
    g.font = `bold 9px ${FONT}`;
    g.textAlign = 'left';
    g.fillText('// MAP LEGEND', legX + 10, legY + 16);

    const legendItems = [
      { kind: 'station', label: 'GAS STATION' },
      { kind: 'start', label: 'RALLY START' },
      { kind: 'toll', label: 'TOLL PLAZA' },
      { kind: 'police', label: 'POLICE HQ' },
      { kind: 'garage', label: 'GARAGE' },
      { kind: 'hideout', label: 'HIDEOUT' },
    ];
    let iy = legY + 32;
    for (const item of legendItems) {
      drawPoiIcon(g, item.kind, legX + 18, iy - 2);
      g.fillStyle = INK;
      g.font = `8px ${FONT}`;
      g.textAlign = 'left';
      g.fillText(item.label, legX + 34, iy + 1);
      iy += 18;
    }

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
    g.fillText('TAB / ESC  CLOSE    DRAG / ARROWS  PAN    WHEEL / +/-  ZOOM    HOME  RECENTER    CLICK / ENTER  WAYPOINT    BACKSPACE  CLEAR', w / 2, h - 16);

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
 * @param {() => Array<{ kind: 'police' | 'heli', x: number, z: number, yaw: number, search?: { x: number, z: number, r: number } }>} [getMarkers]
 * @param {() => { route?: any, destination?: any, distance?: number, arrived?: boolean } | null} [getRoute]
 * @param {(pt: { x: number, z: number }) => any} [setWaypoint]
 * @param {() => void} [clearWaypoint]
 */
export function mapScreen(ui, world = null, getMarkers, getRoute, setWaypoint, clearWaypoint) {
  return new MapScreen(ui, world, getMarkers, getRoute, setWaypoint, clearWaypoint);
}

/**
 * Draws the icon of a place onto a 2D canvas, as Most Wanted's radar does: a round badge in the
 * place's colour with a dark rim and a white glyph (a pump, a star, a wrench, a door, a gate, a
 * flag). The same icons on the minimap and the Tab map.
 * @param {CanvasRenderingContext2D} g
 * @param {string} kind
 * @param {number} px
 * @param {number} py
 * @param {string} [brand]
 */
export function drawPoiIcon(g, kind, px, py, brand) {
  if (kind === 'start') {
    g.fillStyle = '#fff';
    g.fillRect(px - 3, py - 9, 2, 17);
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        g.fillStyle = (i + j) % 2 ? '#111' : '#fff';
        g.fillRect(px - 1 + i * 3, py - 9 + j * 3, 3, 3);
      }
    }
    return;
  }
  const colour = { station: brand === 'hoshi' ? '#2f6fe0' : '#ef6a1f', police: '#2456c8', garage: '#21a564', hideout: '#8a4fd8', toll: '#e09a20' }[kind] ?? '#6b7280';
  g.save();
  g.translate(px, py);
  g.beginPath();
  g.arc(0, 0, 7.5, 0, Math.PI * 2);
  g.fillStyle = colour;
  g.fill();
  g.lineWidth = 1.6;
  g.strokeStyle = 'rgba(8, 10, 14, 0.95)';
  g.stroke();
  g.fillStyle = '#fff';
  g.strokeStyle = '#fff';
  g.lineCap = 'round';
  if (kind === 'station') {
    g.fillRect(-3.5, -4, 5, 8);
    g.fillStyle = colour;
    g.fillRect(-2.5, -3, 3, 2.4);
    g.lineWidth = 1.2;
    g.beginPath();
    g.moveTo(1.5, -2);
    g.lineTo(3.5, 0);
    g.lineTo(3.5, 3);
    g.stroke();
  } else if (kind === 'police') {
    g.beginPath();
    for (let k = 0; k < 10; k++) {
      const r = k % 2 ? 2.2 : 5;
      const t = -Math.PI / 2 + (k * Math.PI) / 5;
      if (k) g.lineTo(Math.cos(t) * r, Math.sin(t) * r);
      else g.moveTo(Math.cos(t) * r, Math.sin(t) * r);
    }
    g.closePath();
    g.fill();
  } else if (kind === 'garage') {
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(-3.5, 3.5);
    g.lineTo(2, -2);
    g.stroke();
    g.beginPath();
    g.arc(2.6, -2.6, 2.4, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = colour;
    g.beginPath();
    g.arc(3.4, -3.4, 1.2, 0, Math.PI * 2);
    g.fill();
  } else if (kind === 'hideout') {
    g.beginPath();
    g.moveTo(0, -5);
    g.lineTo(5, -0.5);
    g.lineTo(3.5, -0.5);
    g.lineTo(3.5, 4.5);
    g.lineTo(-3.5, 4.5);
    g.lineTo(-3.5, -0.5);
    g.lineTo(-5, -0.5);
    g.closePath();
    g.fill();
    g.fillStyle = colour;
    g.fillRect(-1.2, 1, 2.4, 3.5);
  } else if (kind === 'toll') {
    g.fillRect(-4.5, -1, 9, 2);
    g.fillRect(-4.5, -4, 2, 8);
  } else {
    g.beginPath();
    g.arc(0, 0, 2.5, 0, Math.PI * 2);
    g.fill();
  }
  g.restore();
}

