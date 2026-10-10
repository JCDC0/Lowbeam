/**
 * Rotating minimap, bottom left, after Most Wanted's radar: a dark disc with the sea and the lake in
 * blue and the roads in grey, the places as round badges, and the car at the center pointing up. It
 * zooms out with speed.
 *
 * The police heat sits on it as in the game: a flame with "x N" (the level) at the top left outside
 * the disc, and an amber arc round the rim that fills with the heat's progress to the next level
 * (it empties again as the heat cools). Police cars are small chevrons flashing red and blue in a
 * pursuit (grey on patrol, amber while one watches the player), each with its sight drawn as a cone
 * in its own red or blue that fades out with distance; a unit that sees the player wears a white
 * ring. A helicopter is a plain disc with a short tail and its searchlight's circle.
 */

import { RALLY, COAST, LAKES } from '../world/layout.js';
import { FONT } from '../render/fonts.js';
import { drawPoiIcon } from './map.js';
import { radarFrame, sightOf } from './radar.js';
import { weatherLook, FOG_DRY } from '../render/weather.js';

const SIZE = 220;
const R = SIZE / 2;
const LOT_ICON = 0.8;
const RED = [255, 43, 61];
const BLUE = [43, 127, 255];
const AMBER = '#ffa62b';
const lowbeam = () => /** @type {any} */ (globalThis).window?.__lowbeam;

/**
 * @typedef {{ kind: 'police' | 'heli', x: number, z: number, yaw: number, search?: { x: number, z: number, r: number },
 *   cone?: { r: number, half: number }, active?: boolean, sees?: boolean }} Marker
 * @typedef {{ level: number, value?: number, pursuit: boolean }} HeatInfo
 */

export class Minimap {
  /**
   * @param {HTMLElement} parent
   * @param {import('../world/ground.js').Ground} ground
   * @param {() => Marker[]} [getMarkers]
   * @param {() => { route?: any, destination?: any, distance?: number, arrived?: boolean } | null} [getRoute]
   * @param {() => HeatInfo | null} [getHeat]
   */
  constructor(parent, ground, getMarkers, getRoute, getHeat) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = SIZE;
    this.canvas.height = SIZE;
    this.canvas.className = 'minimap';
    parent.appendChild(this.canvas);
    this.flame = document.createElement('div');
    this.flame.className = 'mm-heat';
    this.flame.innerHTML =
      '<svg viewBox="0 0 16 20" aria-hidden="true"><path d="M8 1c1 4 6 6 6 11a6 6 0 0 1-12 0c0-3 2-5 3-6 0 2 1 3 2 3 0-3-1-5 1-8z"/></svg><span></span>';
    parent.appendChild(this.flame);
    /** @type {HTMLElement | null} */
    this.flameText = this.flame.querySelector ? this.flame.querySelector('span') : null;
    this.shownLevel = -1;
    this.g = /** @type {CanvasRenderingContext2D} */ (this.canvas.getContext('2d'));
    this.roads = ground.roads.roads.map((r) => {
      const pts = [];
      for (let i = 0; i < r.path.n; i += 3) pts.push(r.path.x[i], r.path.z[i]);
      if (r.path.closed) pts.push(r.path.x[0], r.path.z[0]);
      else pts.push(r.path.x[r.path.n - 1], r.path.z[r.path.n - 1]);
      return { pts, w: r.hw * 2, gravel: r.surface === 'gravel', cls: r.def.cls };
    });
    this.pads = ground.pads.map((p) => ({
      corners: [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => [p.cx + p.ux * a * p.hw + p.vx * b * p.hd, p.cz + p.uz * a * p.hw + p.vz * b * p.hd]),
      x: p.cx,
      z: p.cz,
      brand: p.station.brand,
    }));
    this.lots = (ground.lots ?? []).map((p) => ({ x: p.cx, z: p.cz, kind: p.lot.kind }));
    const ss1 = ground.roads.byId.get(RALLY.road);
    const start = ss1.path.sample(RALLY.startS);
    this.flag = { x: start.x, z: start.z };
    this.scale = 0.55;
    this.time = 0;
    const lb = () => /** @type {any} */ (globalThis).window?.__lowbeam;
    this.getMarkers = getMarkers ?? (() => lb()?.getMarkers?.() ?? []);
    this.getRoute = getRoute ?? (() => lb()?.getRoute?.() ?? null);
    this.getHeat = getHeat ?? (() => lb()?.getHeat?.() ?? null);
  }

  /**
   * @param {number} x @param {number} z @param {number} yaw @param {number} speed m/s
   * @param {number} dt
   * @param {HeatInfo} [heatArg] the police heat; `getHeat` wins when it answers (it carries the
   *   heat's `value`, whose fraction is the progress to the next level)
   */
  draw(x, z, yaw, speed, dt, heatArg = { level: 0, pursuit: false }) {
    const heat = this.getHeat() ?? heatArg;
    const g = this.g;
    const want = 0.62 - Math.min(0.3, speed * 0.006);
    this.scale += (want - this.scale) * Math.min(1, dt * 2);
    const s = this.scale;
    const { a, b, cc, d, e, f, toScreen, screenYaw } = radarFrame(x, z, yaw, s, R);
    const fogScale = weatherLook(lowbeam()?.world?.weather ?? 0).fogFar / FOG_DRY.far;
    this.time += dt;

    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, SIZE, SIZE);
    g.save();
    g.beginPath();
    g.arc(R, R, R - 2, 0, Math.PI * 2);
    g.clip();
    // The sea under everything, the island over it, the lake in it.
    g.fillStyle = 'rgba(14, 44, 70, 0.92)';
    g.fillRect(0, 0, SIZE, SIZE);
    g.setTransform(a, b, cc, d, e, f);
    g.fillStyle = 'rgba(12, 15, 21, 0.94)';
    g.beginPath();
    COAST.forEach(([px, pz], i) => (i ? g.lineTo(px, pz) : g.moveTo(px, pz)));
    g.closePath();
    g.fill();
    g.fillStyle = 'rgba(30, 92, 128, 0.9)';
    for (const lake of LAKES) {
      g.beginPath();
      g.arc(lake.x, lake.z, lake.r, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = 'rgba(120, 128, 142, 0.3)';
    for (const p of this.pads) {
      g.beginPath();
      p.corners.forEach(([px, pz], i) => (i ? g.lineTo(px, pz) : g.moveTo(px, pz)));
      g.closePath();
      g.fill();
    }
    drawRoads(g, this.roads, 2.4 / s, 'radar');

    const routeInfo = this.getRoute ? this.getRoute() : null;
    const route = routeInfo?.route;
    if (route && route.points && route.points.length >= 2) {
      g.strokeStyle = '#00e5ff';
      g.lineWidth = 3.6 / s;
      g.lineCap = 'round';
      g.lineJoin = 'round';
      g.beginPath();
      for (let i = 0; i < route.points.length; i++) {
        const pt = route.points[i];
        const px = pt[0] ?? pt.x;
        const pz = pt[1] ?? pt.z;
        if (i === 0) g.moveTo(px, pz);
        else g.lineTo(px, pz);
      }
      g.stroke();
    }

    g.setTransform(1, 0, 0, 1, 0, 0);
    for (const p of this.pads) {
      const [sx, sy] = toScreen(p.x, p.z);
      if (Math.hypot(sx - R, sy - R) > R + 12) continue;
      g.save();
      g.translate(sx, sy);
      g.scale(LOT_ICON, LOT_ICON);
      drawPoiIcon(g, 'station', 0, 0, p.brand);
      g.restore();
    }
    for (const lot of this.lots) {
      const [sx, sy] = toScreen(lot.x, lot.z);
      if (Math.hypot(sx - R, sy - R) > R + 12) continue;
      g.save();
      g.translate(sx, sy);
      g.scale(LOT_ICON, LOT_ICON);
      drawPoiIcon(g, lot.kind, 0, 0);
      g.restore();
    }
    {
      const [sx, sy] = toScreen(this.flag.x, this.flag.z);
      if (Math.hypot(sx - R, sy - R) <= R + 12) {
        g.save();
        g.translate(sx, sy);
        g.scale(LOT_ICON, LOT_ICON);
        drawPoiIcon(g, 'start', 0, 0);
        g.restore();
      }
    }

    // Police and helicopters (A13): sight first, under every marker.
    const flash = Math.floor(this.time / 0.2) % 2 === 0;
    const markers = (this.getMarkers ? this.getMarkers() : null) || [];
    markers.forEach((m, i) => {
      if (m.kind === 'heli') {
        if (m.search && m.search.r > 0) {
          const [hx, hy] = toScreen(m.search.x, m.search.z);
          const r = Math.max(4, m.search.r * s);
          const grad = g.createRadialGradient(hx, hy, 0, hx, hy, r);
          grad.addColorStop(0, 'rgba(235, 245, 255, 0.4)');
          grad.addColorStop(1, 'rgba(235, 245, 255, 0)');
          g.fillStyle = grad;
          g.beginPath();
          g.arc(hx, hy, r, 0, Math.PI * 2);
          g.fill();
        }
        return;
      }
      const [mx, my] = toScreen(m.x, m.z);
      const rgb = m.active === false ? (m.sees ? [255, 166, 43] : [150, 160, 176]) : i % 2 ? BLUE : RED;
      const sight = sightOf(m, fogScale);
      const alpha = m.active === false ? (m.sees ? 0.34 : 0.22) : sight.half >= Math.PI ? 0.24 : 0.42;
      drawSight(g, mx, my, sight.r * s, screenYaw(m.yaw), sight.half, rgb, alpha);
    });

    const edgeMarkers = [];
    markers.forEach((m, i) => {
      const [mx, my] = toScreen(m.x, m.z);
      const dist = Math.hypot(mx - R, my - R);
      if (dist > R - 6) {
        edgeMarkers.push({ m, mx, my, i });
        return;
      }
      g.save();
      g.translate(mx, my);
      if (m.kind === 'police' && m.sees && m.active !== false) {
        g.beginPath();
        g.arc(0, 0, 8, 0, Math.PI * 2);
        g.strokeStyle = 'rgba(255, 255, 255, 0.9)';
        g.lineWidth = 1.4;
        g.stroke();
      }
      g.rotate(screenYaw(m.yaw));
      if (m.kind === 'heli') {
        g.fillStyle = '#e8eef6';
        g.strokeStyle = '#0b0f16';
        g.lineWidth = 1.2;
        g.beginPath();
        g.moveTo(-3, 0);
        g.lineTo(-10, 0);
        g.lineWidth = 2;
        g.strokeStyle = '#e8eef6';
        g.stroke();
        g.beginPath();
        g.arc(0, 0, 4.2, 0, Math.PI * 2);
        g.fill();
        g.strokeStyle = '#0b0f16';
        g.lineWidth = 1.2;
        g.stroke();
      } else {
        const colour = m.active === false
          ? (m.sees ? (flash ? AMBER : '#7a5410') : '#9aa3b2')
          : (flash !== (i % 2 === 1) ? `rgb(${RED})` : `rgb(${BLUE})`);
        chevron(g, colour, 5.5);
      }
      g.restore();
    });

    for (const { m, mx, my } of edgeMarkers) {
      const ang = Math.atan2(my - R, mx - R);
      const er = R - 7;
      g.save();
      g.translate(R + Math.cos(ang) * er, R + Math.sin(ang) * er);
      g.rotate(ang);
      if (m.kind === 'heli') {
        g.fillStyle = '#e8eef6';
        g.beginPath();
        g.arc(0, 0, 3.4, 0, Math.PI * 2);
        g.fill();
      } else {
        chevron(g, m.active === false ? '#9aa3b2' : flash ? `rgb(${RED})` : `rgb(${BLUE})`, 4.5);
      }
      g.restore();
    }

    if (routeInfo?.destination) {
      const dest = routeInfo.destination;
      const destX = Array.isArray(dest) ? dest[0] : dest.x;
      const destZ = Array.isArray(dest) ? dest[1] : dest.z;
      const [sx, sy] = toScreen(destX, destZ);
      const distFromCenter = Math.hypot(sx - R, sy - R);
      g.save();
      if (distFromCenter <= R - 8) {
        g.fillStyle = '#00e5ff';
        g.strokeStyle = '#fff';
        g.lineWidth = 1.5;
        g.beginPath();
        g.arc(sx, sy, 4.5, 0, Math.PI * 2);
        g.fill();
        g.stroke();
      } else {
        const ang = Math.atan2(sy - R, sx - R);
        g.translate(R + Math.cos(ang) * (R - 7), R + Math.sin(ang) * (R - 7));
        g.rotate(ang);
        chevron(g, '#00e5ff', 5);
      }
      g.restore();
    }
    g.restore();

    // The player's arrow.
    g.fillStyle = '#ffb43c';
    g.strokeStyle = '#000';
    g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(R, R - 8);
    g.lineTo(R + 6, R + 7);
    g.lineTo(R, R + 4);
    g.lineTo(R - 6, R + 7);
    g.closePath();
    g.fill();
    g.stroke();

    // The rim: a dark ring, and the amber arc of the heat's progress to its next level.
    g.lineCap = 'butt';
    g.strokeStyle = 'rgba(10, 12, 18, 0.9)';
    g.lineWidth = 6;
    g.beginPath();
    g.arc(R, R, R - 3, 0, Math.PI * 2);
    g.stroke();
    const level = Math.floor(heat.level || 0);
    const value = heat.value ?? level;
    const progress = level >= 5 ? 1 : level > 0 ? Math.max(0, Math.min(1, value - Math.floor(value))) : 0;
    g.strokeStyle = 'rgba(255, 166, 43, 0.28)';
    g.lineWidth = 4;
    g.beginPath();
    g.arc(R, R, R - 3, 0, Math.PI * 2);
    g.stroke();
    if (progress > 0) {
      g.strokeStyle = AMBER;
      g.beginPath();
      g.arc(R, R, R - 3, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2);
      g.stroke();
    }
    // North is world -Z; put an N on the ring in that direction.
    const nl = Math.hypot(cc, d) || 1;
    g.fillStyle = '#e9edf2';
    g.font = `10px ${FONT.display}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('N', R + (-cc / nl) * (R - 13), R + (-d / nl) * (R - 13));

    if (level !== this.shownLevel && this.flameText) {
      this.shownLevel = level;
      this.flame.style.display = level > 0 ? 'flex' : 'none';
      this.flameText.textContent = `x${level}`;
      this.flame.classList.toggle('hot', !!heat.pursuit);
    }
  }
}

/** A small arrowhead pointing along +x. @param {CanvasRenderingContext2D} g @param {string} colour @param {number} size */
function chevron(g, colour, size) {
  g.fillStyle = colour;
  g.strokeStyle = 'rgba(0, 0, 0, 0.85)';
  g.lineWidth = 1.2;
  g.beginPath();
  g.moveTo(size, 0);
  g.lineTo(-size * 0.8, -size * 0.8);
  g.lineTo(-size * 0.35, 0);
  g.lineTo(-size * 0.8, size * 0.8);
  g.closePath();
  g.fill();
  g.stroke();
}

/**
 * A unit's sight: a wedge `half` radians either side of `ang` (a full disc at half = PI) filled with
 * its colour, strongest at the unit and fading to nothing at its reach.
 * @param {CanvasRenderingContext2D} g @param {number} x @param {number} y @param {number} r pixels
 * @param {number} ang @param {number} half @param {number[]} rgb @param {number} alpha
 */
function drawSight(g, x, y, r, ang, half, rgb, alpha) {
  if (r < 2) return;
  const grad = g.createRadialGradient(x, y, 0, x, y, r);
  grad.addColorStop(0, `rgba(${rgb}, ${alpha})`);
  grad.addColorStop(0.6, `rgba(${rgb}, ${alpha * 0.35})`);
  grad.addColorStop(1, `rgba(${rgb}, 0)`);
  g.fillStyle = grad;
  g.beginPath();
  if (half >= Math.PI) g.arc(x, y, r, 0, Math.PI * 2);
  else {
    g.moveTo(x, y);
    g.arc(x, y, r, ang - half, ang + half);
    g.closePath();
  }
  g.fill();
}

/**
 * Draws roads onto any 2D canvas context. `style` 'map' is the Tab map's bright roads, 'radar' the
 * minimap's greys.
 * @param {CanvasRenderingContext2D} g
 * @param {Array<{ pts?: number[], points?: number[][], w?: number, hw?: number, gravel?: boolean, cls?: string, lifted?: number[][][] }>} roads
 * @param {number} [minWidth]
 * @param {'map' | 'radar'} [style]
 */
export function drawRoads(g, roads, minWidth = 0, style = 'map') {
  const radar = style === 'radar';
  g.lineCap = 'round';
  g.lineJoin = 'round';
  for (const r of roads) {
    if (r.cls === 'expressway') {
      g.strokeStyle = radar ? 'rgba(196, 202, 212, 0.95)' : 'rgba(255, 255, 255, 0.95)';
    } else if (r.gravel || r.cls === 'rally') {
      g.strokeStyle = radar ? 'rgba(150, 120, 86, 0.85)' : 'rgba(196, 150, 96, 0.9)';
    } else if (r.cls === 'mountain') {
      g.strokeStyle = radar ? 'rgba(136, 142, 154, 0.85)' : 'rgba(180, 190, 205, 0.85)';
    } else {
      g.strokeStyle = radar ? 'rgba(148, 154, 166, 0.9)' : 'rgba(205, 212, 226, 0.9)';
    }
    const baseW = r.w ?? (r.hw ? r.hw * 2 : 6);
    g.lineWidth = Math.max(baseW, minWidth);
    g.beginPath();
    if (r.pts) {
      for (let i = 0; i < r.pts.length; i += 2) {
        if (i) g.lineTo(r.pts[i], r.pts[i + 1]);
        else g.moveTo(r.pts[i], r.pts[i + 1]);
      }
    } else if (r.points) {
      for (let i = 0; i < r.points.length; i++) {
        if (i) g.lineTo(r.points[i][0], r.points[i][1]);
        else g.moveTo(r.points[i][0], r.points[i][1]);
      }
    }
    g.stroke();
  }

  for (const r of roads) {
    if (!r.lifted || !r.lifted.length) continue;
    const baseW = (r.w ?? (r.hw ? r.hw * 2 : 6)) + 2;
    for (const run of r.lifted) {
      if (!run || run.length < 2) continue;
      g.strokeStyle = 'rgba(10, 15, 25, 0.95)';
      g.lineWidth = Math.max(baseW + 5, minWidth + 4);
      g.beginPath();
      for (let i = 0; i < run.length; i++) {
        if (i === 0) g.moveTo(run[i][0], run[i][1]);
        else g.lineTo(run[i][0], run[i][1]);
      }
      g.stroke();

      g.strokeStyle = r.cls === 'expressway' ? 'rgba(255, 255, 255, 0.98)' : 'rgba(230, 235, 245, 0.95)';
      g.lineWidth = Math.max(baseW, minWidth + 1);
      g.beginPath();
      for (let i = 0; i < run.length; i++) {
        if (i === 0) g.moveTo(run[i][0], run[i][1]);
        else g.lineTo(run[i][0], run[i][1]);
      }
      g.stroke();
    }
  }
}
