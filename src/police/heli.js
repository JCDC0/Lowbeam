/**
 * The police helicopter. Pure: where it is, how it flies, where its searchlight falls and whether
 * the light is on the target. It parks on the helipad on the police headquarters' roof, spins up,
 * lifts off, follows a target from behind and above with some lead, keeps clear of the ground and
 * the tower tops (`Skyline`), banks and pitches with its acceleration, and flies back to land when
 * recalled. The light follows the target with a lag, so a hard turn can shake it, and it cannot see
 * through a deck: a car under a viaduct or an overpass is lost to it. heli-view.js draws it.
 *
 * Frame: the nose faces +z of the model, yaw 0 faces +Z (the same as the cars), forward is
 * (sin yaw, cos yaw) and left is (cos yaw, -sin yaw). Pitch is positive nose down, roll positive
 * left side up.
 */

import { lotFrame, toWorld } from '../world/lots.js';

/** Where the parts sit on the body, from tools/blender/heli.py. */
export const HELI_PARTS = { mast: [0, 2.95, 0.15], tail: [0.3, 2.05, -6.15], light: [0, 0.3, 2.1] };
/** The helipad on the police headquarters' roof, in the HQ model's frame (tools/blender/police_hq.py). */
export const HELIPAD = { x: -26, y: 13.0, z: -24 };
/**
 * How it flies. Speeds in m/s (75 is 270 km/h, so the fastest cars can outrun it on a straight),
 * heights in meters over whatever is below, times in seconds.
 */
export const HELI = {
  spinUp: 5, spinDown: 8, climb: 7, descend: 3.5, hover: 22,
  cruise: 55, clear: 28, maxSpeed: 75, accel: 9, vAccel: 5, vMax: 10, yawRate: 1.0, gain: 0.55,
  lead: 1.2, behind: 32, side: 14, lookahead: 2.5,
  lightRange: 190, spotR: 7, spotFollow: 2.2,
};

/**
 * Where each helicopter of a pursuit holds station on the target, by slot: `behind` meters back along
 * its heading (negative is ahead), `side` meters to its right. The first sits behind as before, the
 * others ahead on the left and wide on the right, so three searchlights cover different streets.
 */
export const HELI_SLOTS = [
  { behind: HELI.behind, side: HELI.side },
  { behind: -45, side: -26 },
  { behind: 8, side: 48 },
];

/** @typedef {{ x: number, y: number, z: number, vx: number, vz: number }} HeliTarget */
/**
 * What the helicopter needs from the world each step.
 * @typedef {{ target: HeliTarget | null, skyline: Skyline, groundAt: (x: number, z: number) => number,
 *   covered: (x: number, z: number, y: number) => boolean }} HeliWorld
 */

/** The helipad on the HQ in world space. @param {import('../world/lots.js').LotPad} hq */
export function helipadOf(hq) {
  const f = lotFrame(hq);
  const [x, z] = toWorld(f, HELIPAD.x, HELIPAD.z);
  return { x, y: f.y + HELIPAD.y, z, yaw: f.yaw };
}

/**
 * The highest thing in each 32 m cell, ground or roof, for the helicopter to clear. `at` reads the
 * cell and its eight neighbors, so a 13 m wide aircraft never clips a tower standing in the next one.
 */
export class Skyline {
  /**
   * @param {(x: number, z: number) => number} heightAt the ground
   * @param {{ x: number, z: number, y: number, w: number, d: number, h: number }[]} buildings
   * @param {number} half half the map's size @param {number} [cell]
   */
  constructor(heightAt, buildings, half, cell = 32) {
    this.cell = cell;
    this.half = half;
    this.n = Math.ceil((half * 2) / cell);
    const n = this.n;
    this.top = new Float32Array(n * n);
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const x0 = -half + i * cell;
        const z0 = -half + j * cell;
        let h = -Infinity;
        for (const [u, v] of [[0, 0], [1, 0], [0, 1], [1, 1], [0.5, 0.5]]) h = Math.max(h, heightAt(x0 + u * cell, z0 + v * cell));
        this.top[j * n + i] = h;
      }
    }
    for (const b of buildings) {
      const r = Math.hypot(b.w, b.d) / 2;
      const roof = b.y + b.h;
      for (let z = b.z - r; z <= b.z + r + cell; z += cell) {
        for (let x = b.x - r; x <= b.x + r + cell; x += cell) {
          const k = this.key(Math.min(x, b.x + r), Math.min(z, b.z + r));
          if (k >= 0 && this.top[k] < roof) this.top[k] = roof;
        }
      }
    }
  }

  /** @param {number} x @param {number} z */
  key(x, z) {
    const i = Math.floor((x + this.half) / this.cell);
    const j = Math.floor((z + this.half) / this.cell);
    if (i < 0 || j < 0 || i >= this.n || j >= this.n) return -1;
    return j * this.n + i;
  }

  /** The highest ground or roof within about a cell of (x, z). @param {number} x @param {number} z */
  at(x, z) {
    let h = -Infinity;
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        const k = this.key(x + dx * this.cell, z + dz * this.cell);
        if (k >= 0) h = Math.max(h, this.top[k]);
      }
    }
    return h === -Infinity ? 0 : h;
  }
}

/** @param {number} a */
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
/** @param {number} v @param {number} lo @param {number} hi */
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/**
 * @typedef {'parked' | 'spinup' | 'takeoff' | 'chase' | 'return' | 'landing' | 'spindown'} HeliState
 */
export class Heli {
  /**
   * @param {{ x: number, y: number, z: number, yaw: number }} pad
   * @param {{ slot?: number, sky?: boolean }} [opts] `slot` picks where it holds station
   *   (`HELI_SLOTS`); a `sky` helicopter has no helipad: `pad` is a point in the sky it flies in from
   *   and back to, and it is put away there instead of landing.
   */
  constructor(pad, { slot = 0, sky = false } = {}) {
    this.pad = pad;
    this.slot = slot;
    this.sky = sky;
    this.x = pad.x;
    this.y = pad.y;
    this.z = pad.z;
    this.yaw = pad.yaw;
    this.vx = 0;
    this.vy = 0;
    this.vz = 0;
    this.pitch = 0;
    this.roll = 0;
    /** Rotor speed, 0 stopped to 1 flying. */
    this.rotor = 0;
    this.rotorAngle = 0;
    this.tailAngle = 0;
    /** @type {HeliState} */
    this.state = 'parked';
    /** Where the searchlight falls, and whether it is on the target. */
    this.spot = { x: pad.x, y: pad.y, z: pad.z, on: false, sees: false, r: HELI.spotR };
    /** Seconds since the light was last on the target. */
    this.lost = 0;
    this.time = 0;
  }

  get airborne() {
    return this.state === 'takeoff' || this.state === 'chase' || this.state === 'return' || this.state === 'landing';
  }

  /** Scrambles: spins up on the pad, or turns round if it was flying home. */
  launch() {
    if (this.sky && this.state === 'parked') {
      // Backup from out of town: it arrives already flying.
      this.x = this.pad.x;
      this.y = this.pad.y;
      this.z = this.pad.z;
      this.rotor = 1;
      this.state = 'chase';
      return;
    }
    if (this.state === 'parked' || this.state === 'spindown') this.state = 'spinup';
    else if (this.state === 'return' || this.state === 'landing') this.state = 'chase';
  }

  /** Sends it home to land. */
  recall() {
    if (this.state === 'spinup') this.state = 'spindown';
    else if (this.state === 'takeoff' || this.state === 'chase') this.state = 'return';
  }

  /** @param {number} dt @param {HeliWorld} w */
  update(dt, w) {
    this.time += dt;
    const P = this.pad;
    switch (this.state) {
      case 'parked':
        this.rotor = Math.max(0, this.rotor - dt / HELI.spinDown);
        break;
      case 'spinup':
        this.rotor = Math.min(1, this.rotor + dt / HELI.spinUp);
        if (this.rotor >= 1) this.state = 'takeoff';
        break;
      case 'takeoff':
        this.fly(dt, w, this.x, P.y + HELI.hover + 4, this.z, null);
        if (this.y > P.y + HELI.hover) this.state = w.target ? 'chase' : 'return';
        break;
      case 'chase': {
        const t = w.target;
        if (!t) {
          this.state = 'return';
          break;
        }
        const sp = Math.hypot(t.vx, t.vz);
        const dx = sp > 3 ? t.vx / sp : Math.sin(this.yaw);
        const dz = sp > 3 ? t.vz / sp : Math.cos(this.yaw);
        const st = HELI_SLOTS[this.slot] || HELI_SLOTS[0];
        const gx = t.x + t.vx * HELI.lead - dx * st.behind + dz * st.side;
        const gz = t.z + t.vz * HELI.lead - dz * st.behind - dx * st.side;
        this.fly(dt, w, gx, w.groundAt(gx, gz) + HELI.cruise, gz, t);
        break;
      }
      case 'return': {
        if (this.sky) {
          this.fly(dt, w, P.x, P.y, P.z, null);
          if (Math.hypot(this.x - P.x, this.z - P.z) < 40) {
            this.state = 'parked';
            this.rotor = 0;
            this.vx = this.vy = this.vz = 0;
          }
          break;
        }
        this.fly(dt, w, P.x, P.y + HELI.hover, P.z, null);
        if (Math.hypot(this.x - P.x, this.z - P.z) < 5 && Math.hypot(this.vx, this.vz) < 2.5) this.state = 'landing';
        break;
      }
      case 'landing': {
        const left = this.y - P.y;
        const down = Math.min(HELI.descend, left * 0.7 + 0.4);
        this.x += (P.x - this.x) * Math.min(1, dt * 2);
        this.z += (P.z - this.z) * Math.min(1, dt * 2);
        this.vx = 0;
        this.vz = 0;
        this.vy = -down;
        this.y = Math.max(P.y, this.y - down * dt);
        this.yaw += clamp(wrap(P.yaw - this.yaw), -HELI.yawRate * 0.5 * dt, HELI.yawRate * 0.5 * dt);
        this.pitch *= 1 - Math.min(1, dt * 2);
        this.roll *= 1 - Math.min(1, dt * 2);
        if (this.y <= P.y + 0.01) {
          this.y = P.y;
          this.vy = 0;
          this.state = 'spindown';
        }
        break;
      }
      case 'spindown':
        this.rotor = Math.max(0, this.rotor - dt / HELI.spinDown);
        if (this.rotor <= 0) this.state = 'parked';
        break;
    }
    this.rotorAngle = (this.rotorAngle + this.rotor * dt * Math.PI * 2 * 5.5) % (Math.PI * 2);
    this.tailAngle = (this.tailAngle + this.rotor * dt * Math.PI * 2 * 23) % (Math.PI * 2);
    this.light(dt, w);
  }

  /**
   * Flies toward (gx, gy, gz): a velocity toward it, eased in by the acceleration limits, never
   * lower than the clearance over the skyline here and a little ahead. Faces the way it flies when
   * moving, or `face` when hovering.
   * @param {number} dt @param {HeliWorld} w @param {number} gx @param {number} gy @param {number} gz
   * @param {HeliTarget | null} face
   */
  fly(dt, w, gx, gy, gz, face) {
    const aheadX = this.x + this.vx * HELI.lookahead;
    const aheadZ = this.z + this.vz * HELI.lookahead;
    const floor = Math.max(w.skyline.at(this.x, this.z), w.skyline.at(aheadX, aheadZ), w.skyline.at(gx, gz)) + HELI.clear;
    const ty = Math.max(gy, floor);
    let wx = (gx - this.x) * HELI.gain;
    let wz = (gz - this.z) * HELI.gain;
    const ws = Math.hypot(wx, wz);
    if (ws > HELI.maxSpeed) {
      wx *= HELI.maxSpeed / ws;
      wz *= HELI.maxSpeed / ws;
    }
    const wy = clamp((ty - this.y) * 0.8, -HELI.vMax, HELI.vMax);
    let ax = (wx - this.vx) / Math.max(dt, 1e-3);
    let az = (wz - this.vz) / Math.max(dt, 1e-3);
    const a = Math.hypot(ax, az);
    if (a > HELI.accel) {
      ax *= HELI.accel / a;
      az *= HELI.accel / a;
    }
    const ay = clamp((wy - this.vy) / Math.max(dt, 1e-3), -HELI.vAccel, HELI.vAccel);
    this.vx += ax * dt;
    this.vz += az * dt;
    this.vy += ay * dt;
    this.x += this.vx * dt;
    this.z += this.vz * dt;
    this.y += this.vy * dt;
    // Hard floor: never through a roof or a hillside, whatever the easing says.
    const hard = w.skyline.at(this.x, this.z) + HELI.clear * 0.5;
    if (this.y < hard) {
      this.y = hard;
      this.vy = Math.max(this.vy, 0);
    }
    const speed = Math.hypot(this.vx, this.vz);
    const want = speed > 10 ? Math.atan2(this.vx, this.vz) : face ? Math.atan2(face.x - this.x, face.z - this.z) : this.yaw;
    this.yaw = wrap(this.yaw + clamp(wrap(want - this.yaw), -HELI.yawRate * dt, HELI.yawRate * dt));
    const fx = Math.sin(this.yaw);
    const fz = Math.cos(this.yaw);
    const along = ax * fx + az * fz;
    const across = ax * fz - az * fx;
    const fwd = this.vx * fx + this.vz * fz;
    const pitch = clamp(along * 0.03 + fwd * 0.0035, -0.3, 0.35);
    const roll = clamp(-across * 0.045, -0.5, 0.5);
    const k = Math.min(1, dt * 2.5);
    this.pitch += (pitch - this.pitch) * k;
    this.roll += (roll - this.roll) * k;
  }

  /** The searchlight: on while flying high enough, chasing the target with a lag. @param {number} dt @param {HeliWorld} w */
  light(dt, w) {
    const sp = this.spot;
    const t = w.target;
    const high = this.airborne && this.y - w.groundAt(this.x, this.z) > 8;
    sp.on = high;
    if (!high) {
      sp.sees = false;
      this.lost += dt;
      return;
    }
    let tx;
    let tz;
    if (t && this.state === 'chase') {
      tx = t.x + t.vx * 0.25;
      tz = t.z + t.vz * 0.25;
    } else {
      tx = this.x + Math.sin(this.yaw) * 30;
      tz = this.z + Math.cos(this.yaw) * 30;
    }
    const k = 1 - Math.exp(-HELI.spotFollow * dt);
    sp.x += (tx - sp.x) * k;
    sp.z += (tz - sp.z) * k;
    sp.y = t && this.state === 'chase' && Math.hypot(sp.x - t.x, sp.z - t.z) < sp.r * 2 ? t.y : w.groundAt(sp.x, sp.z);
    const range = Math.hypot(sp.x - this.x, sp.y - this.y, sp.z - this.z);
    sp.sees = !!t && this.state === 'chase' && range < HELI.lightRange && Math.hypot(sp.x - t.x, sp.z - t.z) < sp.r * 1.2 && !w.covered(t.x, t.z, t.y);
    this.lost = sp.sees ? 0 : this.lost + dt;
  }
}
