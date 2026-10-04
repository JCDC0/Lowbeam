/**
 * Rotating minimap, bottom left: roads, forecourts, station and event icons, with the
 * car at the center pointing up. It zooms out with speed.
 */

import { RALLY } from '../world/layout.js';
import { drawPoiIcon } from './map.js';

const SIZE = 168;
const R = SIZE / 2;
const LOT_ICON = 0.8;

export class Minimap {
  /**
   * @param {HTMLElement} parent
   * @param {import('../world/ground.js').Ground} ground
   */
  constructor(parent, ground) {
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
  }

  /**
   * @param {number} x @param {number} z @param {number} yaw @param {number} speed m/s
   * @param {number} dt
   */
  draw(x, z, yaw, speed, dt) {
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
    g.strokeStyle = 'rgba(255, 180, 60, 0.6)';
    g.lineWidth = 2;
    g.beginPath();
    g.arc(R, R, R - 2, 0, Math.PI * 2);
    g.stroke();
    // North is world -Z; put an N on the ring in that direction.
    const nl = Math.hypot(cc, d) || 1;
    const nx = R + (-cc / nl) * (R - 11);
    const ny = R + (-d / nl) * (R - 11);
    g.fillStyle = '#e9edf2';
    g.font = '10px "Lowbeam Display", sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('N', nx, ny);
  }
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

