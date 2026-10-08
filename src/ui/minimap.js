/**
 * Rotating minimap, bottom left: roads, forecourts, station and event icons, with the
 * car at the center pointing up. It zooms out with speed. As on Most Wanted's radar the police
 * heat sits on its rim (five marks over the top), the rim turns red on the left and blue on the
 * right in a pursuit, searching units show their sight cone and units that see the player a ring.
 */

import { RALLY } from '../world/layout.js';
import { FONT } from '../render/fonts.js';
import { drawPoiIcon } from './map.js';

const SIZE = 220;
const HEAT_MARKS = 5;
/** The arc the heat marks span over the top of the rim, in radians. */
const HEAT_ARC = 1.1;
const R = SIZE / 2;
const LOT_ICON = 0.8;

export class Minimap {
  /**
   * @param {HTMLElement} parent
   * @param {import('../world/ground.js').Ground} ground
   * @param {() => Array<{ kind: 'police' | 'heli', x: number, z: number, yaw: number, search?: { x: number, z: number, r: number }, cone?: { r: number, half: number }, active?: boolean, sees?: boolean }>} [getMarkers]
   * @param {() => { route?: any, destination?: any, distance?: number, arrived?: boolean } | null} [getRoute]
   */
  constructor(parent, ground, getMarkers, getRoute) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = SIZE;
    this.canvas.height = SIZE;
    this.canvas.className = 'minimap';
    parent.appendChild(this.canvas);
    this.g = /** @type {CanvasRenderingContext2D} */ (this.canvas.getContext('2d'));
    this.roads = ground.roads.roads.map((r) => {
      const pts = [];
      for (let i = 0; i < r.path.n; i += 3) pts.push(r.path.x[i], r.path.z[i]);
      if (r.path.closed) pts.push(r.path.x[0], r.path.z[0]);
      else pts.push(r.path.x[r.path.n - 1], r.path.z[r.path.n - 1]);
      return { pts, w: r.hw * 2, gravel: r.surface === 'gravel' };
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
    this.getMarkers = getMarkers ?? (() => (/** @type {any} */ (globalThis).window?.__lowbeam?.getMarkers?.() ?? []));
    this.getRoute = getRoute ?? (() => (/** @type {any} */ (globalThis).window?.__lowbeam?.getRoute?.() ?? null));
  }

  /**
   * @param {number} x @param {number} z @param {number} yaw @param {number} speed m/s
   * @param {number} dt
   * @param {{ level: number, pursuit: boolean }} [heat] the police heat (held after a pursuit too)
   */
  draw(x, z, yaw, speed, dt, heat = { level: 0, pursuit: false }) {
    const g = this.g;
    const want = 0.62 - Math.min(0.3, speed * 0.006);
    this.scale += (want - this.scale) * Math.min(1, dt * 2);
    const s = this.scale;
    const c = Math.cos(yaw);
    const n = Math.sin(yaw);
    // Ahead of the car is up, its left is left. Map world (x, z) to canvas pixels.
    const a = -s * c;
    const b = -s * n;
    const cc = s * n;
    const d = -s * c;
    const e = R - a * x - cc * z;
    const f = R - b * x - d * z;
    const toScreen = (wx, wz) => [a * wx + cc * wz + e, b * wx + d * wz + f];

    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, SIZE, SIZE);
    g.save();
    g.beginPath();
    g.arc(R, R, R - 2, 0, Math.PI * 2);
    g.clip();
    g.fillStyle = 'rgba(6, 10, 18, 0.82)';
    g.fillRect(0, 0, SIZE, SIZE);

    g.setTransform(a, b, cc, d, e, f);
    g.fillStyle = 'rgba(140, 150, 170, 0.35)';
    for (const p of this.pads) {
      g.beginPath();
      p.corners.forEach(([px, pz], i) => (i ? g.lineTo(px, pz) : g.moveTo(px, pz)));
      g.closePath();
      g.fill();
    }
    drawRoads(g, this.roads, 2.4 / s);

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
      g.fillStyle = p.brand === 'hoshi' ? '#3a7bff' : '#ff6a1f';
      g.fillRect(sx - 5, sy - 5, 10, 10);
      g.fillStyle = '#fff';
      g.fillRect(sx - 2, sy - 3, 4, 6);
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
      g.fillStyle = '#fff';
      g.fillRect(sx - 1, sy - 7, 2, 12);
      for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) {
        g.fillStyle = (i + j) % 2 ? '#111' : '#fff';
        g.fillRect(sx + 1 + i * 3, sy - 7 + j * 3, 3, 3);
      }
    }

    // Police and helicopter markers (A13)
    this.time += dt;
    const sirenRed = Math.floor(this.time / 0.2) % 2 === 0;
    const markers = (this.getMarkers ? this.getMarkers() : null) || [];
    const edgeMarkers = [];

    for (const m of markers) {
      // Helicopter searchlight circle in world coordinates
      if (m.kind === 'heli' && m.search && m.search.r > 0) {
        const [spotX, spotY] = toScreen(m.search.x, m.search.z);
        const spotRadius = m.search.r * s;
        g.save();
        g.beginPath();
        g.arc(spotX, spotY, spotRadius, 0, Math.PI * 2);
        g.fillStyle = 'rgba(255, 255, 230, 0.22)';
        g.fill();
        g.strokeStyle = 'rgba(255, 255, 200, 0.45)';
        g.lineWidth = 1;
        g.stroke();
        g.restore();
      }

      const [mx, my] = toScreen(m.x, m.z);
      const distFromCenter = Math.hypot(mx - R, my - R);
      const screenYaw = Math.atan2(cc * Math.sin(m.yaw) + d * Math.cos(m.yaw), a * Math.sin(m.yaw) + b * Math.cos(m.yaw));

      if (m.cone && m.cone.r > 0 && distFromCenter <= R + m.cone.r * s) {
        g.save();
        g.beginPath();
        g.moveTo(mx, my);
        g.arc(mx, my, m.cone.r * s, screenYaw - m.cone.half, screenYaw + m.cone.half);
        g.closePath();
        g.fillStyle = 'rgba(255, 176, 32, 0.16)';
        g.fill();
        g.strokeStyle = 'rgba(255, 176, 32, 0.5)';
        g.lineWidth = 1;
        g.stroke();
        g.restore();
      }

      if (distFromCenter <= R - 6) {
        // Inside minimap circle
        g.save();
        g.translate(mx, my);
        if (m.kind === 'police' && m.active && m.sees) {
          g.beginPath();
          g.arc(0, 0, 8, 0, Math.PI * 2);
          g.fillStyle = 'rgba(255, 255, 255, 0.22)';
          g.fill();
          g.strokeStyle = '#fff';
          g.lineWidth = 1.4;
          g.stroke();
        }
        g.rotate(screenYaw);

        if (m.kind === 'heli') {
          // Helicopter rotor glyph (cross with spinning rotor blades)
          g.fillStyle = '#5ad5ff';
          g.beginPath();
          g.arc(0, 0, 3, 0, Math.PI * 2);
          g.fill();
          g.strokeStyle = '#fff';
          g.lineWidth = 1.2;
          const rotorAng = (this.time * 25) % (Math.PI * 2);
          g.beginPath();
          g.moveTo(Math.cos(rotorAng) * 6, Math.sin(rotorAng) * 6);
          g.lineTo(-Math.cos(rotorAng) * 6, -Math.sin(rotorAng) * 6);
          g.moveTo(Math.cos(rotorAng + Math.PI / 2) * 6, Math.sin(rotorAng + Math.PI / 2) * 6);
          g.lineTo(-Math.cos(rotorAng + Math.PI / 2) * 6, -Math.sin(rotorAng + Math.PI / 2) * 6);
          g.stroke();
        } else {
          // Police car arrow: in a pursuit its siren blinks red and blue (0.4 s cycle); on patrol it is
          // grey, and amber, blinking, while it watches the player.
          const watchBlink = Math.floor(this.time * 6) % 2 === 0;
          g.fillStyle = m.active === false ? (m.sees ? (watchBlink ? '#ffb020' : '#7a5410') : '#aab0ba') : sirenRed ? '#ff2b3d' : '#2b7fff';
          g.strokeStyle = '#fff';
          g.lineWidth = 1.2;
          g.beginPath();
          g.moveTo(5, 0);
          g.lineTo(-4, -4);
          g.lineTo(-2, 0);
          g.lineTo(-4, 4);
          g.closePath();
          g.fill();
          g.stroke();
        }
        g.restore();
      } else {
        // Outside minimap circle: clip to rim as edge indicator
        edgeMarkers.push({ m, mx, my, distFromCenter });
      }
    }

    // Edge markers clamped to rim
    for (const { m, mx, my } of edgeMarkers) {
      const angleToEdge = Math.atan2(my - R, mx - R);
      const edgeR = R - 7;
      const ex = R + Math.cos(angleToEdge) * edgeR;
      const ey = R + Math.sin(angleToEdge) * edgeR;

      g.save();
      g.translate(ex, ey);
      g.rotate(angleToEdge);

      if (m.kind === 'heli') {
        g.fillStyle = '#5ad5ff';
        g.strokeStyle = '#fff';
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(4, 0);
        g.lineTo(-3, -3);
        g.lineTo(-3, 3);
        g.closePath();
        g.fill();
        g.stroke();
      } else {
        g.fillStyle = sirenRed ? '#ff2b3d' : '#2b7fff';
        g.strokeStyle = '#fff';
        g.lineWidth = 1.2;
        g.beginPath();
        g.moveTo(4, 0);
        g.lineTo(-3, -3.5);
        g.lineTo(-3, 3.5);
        g.closePath();
        g.fill();
        g.stroke();
      }
      g.restore();
    }

    if (routeInfo?.destination) {
      const dest = routeInfo.destination;
      const destX = Array.isArray(dest) ? dest[0] : dest.x;
      const destZ = Array.isArray(dest) ? dest[1] : dest.z;
      const [sx, sy] = toScreen(destX, destZ);
      const distFromCenter = Math.hypot(sx - R, sy - R);

      if (distFromCenter <= R - 8) {
        g.save();
        g.fillStyle = '#00e5ff';
        g.strokeStyle = '#fff';
        g.lineWidth = 1.5;
        g.beginPath();
        g.arc(sx, sy, 4.5, 0, Math.PI * 2);
        g.fill();
        g.stroke();
        g.fillStyle = '#fff';
        g.beginPath();
        g.arc(sx, sy, 1.8, 0, Math.PI * 2);
        g.fill();
        g.restore();
      } else {
        const angleToEdge = Math.atan2(sy - R, sx - R);
        const edgeR = R - 7;
        const ex = R + Math.cos(angleToEdge) * edgeR;
        const ey = R + Math.sin(angleToEdge) * edgeR;

        g.save();
        g.translate(ex, ey);
        g.rotate(angleToEdge);
        g.fillStyle = '#00e5ff';
        g.strokeStyle = '#000';
        g.lineWidth = 1.2;
        g.beginPath();
        g.moveTo(5, 0);
        g.lineTo(-4, -4);
        g.lineTo(-2, 0);
        g.lineTo(-4, 4);
        g.closePath();
        g.fill();
        g.stroke();
        g.restore();
      }
    }
    g.restore();

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
    if (heat.pursuit) {
      // Red on the left, blue on the right, as the light bars; it holds, it does not flash.
      g.lineWidth = 3;
      g.strokeStyle = '#ff2b3d';
      g.beginPath();
      g.arc(R, R, R - 2, Math.PI / 2, Math.PI * 1.5);
      g.stroke();
      g.strokeStyle = '#2b7fff';
      g.beginPath();
      g.arc(R, R, R - 2, -Math.PI / 2, Math.PI / 2);
      g.stroke();
    } else {
      g.strokeStyle = 'rgba(255, 180, 60, 0.6)';
      g.lineWidth = 2;
      g.beginPath();
      g.arc(R, R, R - 2, 0, Math.PI * 2);
      g.stroke();
    }
    drawHeatMarks(g, heat.level, heat.pursuit);
    // North is world -Z; put an N on the ring in that direction.
    const nl = Math.hypot(cc, d) || 1;
    const nx = R + (-cc / nl) * (R - 11);
    const ny = R + (-d / nl) * (R - 11);
    g.fillStyle = '#e9edf2';
    g.font = `10px ${FONT.display}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('N', nx, ny);
  }
}

/**
 * The heat level on the rim: five marks spread over the top, lit up to the level (the held heat
 * shows dim after a pursuit, lit in one).
 * @param {CanvasRenderingContext2D} g @param {number} level @param {boolean} pursuit
 */
function drawHeatMarks(g, level, pursuit) {
  const lit = Math.max(0, Math.min(HEAT_MARKS, Math.floor(level)));
  g.save();
  g.lineCap = 'butt';
  const step = HEAT_ARC / HEAT_MARKS;
  for (let i = 0; i < HEAT_MARKS; i++) {
    const mid = -Math.PI / 2 - HEAT_ARC / 2 + step * (i + 0.5);
    g.beginPath();
    g.arc(R, R, R - 4, mid - step * 0.38, mid + step * 0.38);
    g.strokeStyle = '#000';
    g.lineWidth = 11;
    g.stroke();
    g.beginPath();
    g.arc(R, R, R - 4, mid - step * 0.32, mid + step * 0.32);
    g.strokeStyle = i < lit ? (pursuit ? '#ff3b4a' : 'rgba(255, 110, 120, 0.7)') : 'rgba(196, 204, 220, 0.5)';
    g.lineWidth = 7;
    g.stroke();
  }
  g.restore();
}

/**
 * Draws roads onto any 2D canvas context.
 * @param {CanvasRenderingContext2D} g
 * @param {Array<{ pts?: number[], points?: number[][], w?: number, hw?: number, gravel?: boolean, cls?: string, lifted?: number[][][] }>} roads
 * @param {number} [minWidth]
 */
export function drawRoads(g, roads, minWidth = 0) {
  g.lineCap = 'round';
  g.lineJoin = 'round';
  for (const r of roads) {
    if (r.cls === 'expressway') {
      g.strokeStyle = 'rgba(255, 255, 255, 0.95)';
    } else if (r.gravel || r.cls === 'rally') {
      g.strokeStyle = 'rgba(196, 150, 96, 0.9)';
    } else if (r.cls === 'mountain') {
      g.strokeStyle = 'rgba(180, 190, 205, 0.85)';
    } else {
      g.strokeStyle = 'rgba(205, 212, 226, 0.9)';
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
        const px = run[i][0];
        const pz = run[i][1];
        if (i === 0) g.moveTo(px, pz);
        else g.lineTo(px, pz);
      }
      g.stroke();

      g.strokeStyle = r.cls === 'expressway' ? 'rgba(255, 255, 255, 0.98)' : 'rgba(230, 235, 245, 0.95)';
      g.lineWidth = Math.max(baseW, minWidth + 1);
      g.beginPath();
      for (let i = 0; i < run.length; i++) {
        const px = run[i][0];
        const pz = run[i][1];
        if (i === 0) g.moveTo(px, pz);
        else g.lineTo(px, pz);
      }
      g.stroke();
    }
  }
}

