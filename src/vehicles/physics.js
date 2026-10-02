/**
 * Vehicle dynamics. Pure: no three.js, no DOM. Stepped at a fixed 120 Hz.
 *
 * Conventions:
 *  - yaw 0 faces +Z. forward = (sin yaw, cos yaw). left = (cos yaw, -sin yaw).
 *    A positive yaw rate turns the car to its left.
 *  - Steering angle `steer` is positive when the front wheels point left.
 *  - Input steer is positive for RIGHT (the D key), so it is negated here.
 *
 * Model: a bicycle model with load transfer and a light magic-formula tire, plus a
 * separate vertical model that lets the car leave the ground over crests.
 */

import { surface } from './surfaces.js';
import { clamp, approach, lerp } from '../core/mathx.js';

export const G = 9.81;
export const DT = 1 / 120;
const RPM = 60 / (2 * Math.PI);

/** @typedef {import('./specs.js').CarSpec} CarSpec */
/** @typedef {{ throttle: number, brake: number, steer: number, handbrake: number, shiftUp?: boolean, shiftDown?: boolean, manual?: boolean }} DriveInput */
/** @typedef {(x: number, z: number) => { h: number, surface: string }} GroundFn */

/** @param {CarSpec} spec */
export function createVehicleState(spec) {
  return {
    x: 0, y: 0, z: 0, yaw: 0,
    vx: 0, vz: 0, vy: 0, yawRate: 0,
    steer: 0,
    gear: 1, shiftTimer: 0, revTimer: 0,
    rpm: spec.engine.idle, throttle: 0, limiter: 0,
    air: false, contact: true, airTime: 0, landing: 0,
    pitch: 0, roll: 0,
    aLong: 0, aLat: 0,
    vLong: 0, vLat: 0, speed: 0,
    slipFront: 0, slipRear: 0, skid: 0, wheelspin: 0,
    surfFront: 'asphalt', surfRear: 'asphalt',
    wheelAngle: 0,
    fuel: spec.fuel.tank, engineOn: true,
    handbrake: false, braking: false,
  };
}

/**
 * Places the car at rest on the ground.
 * @param {ReturnType<typeof createVehicleState>} s @param {CarSpec} spec
 * @param {number} x @param {number} z @param {number} yaw @param {GroundFn} ground
 */
export function placeVehicle(s, spec, x, z, yaw, ground) {
  s.x = x;
  s.z = z;
  s.yaw = yaw;
  s.vx = s.vz = s.vy = s.yawRate = 0;
  s.steer = 0;
  s.gear = 1;
  s.air = false;
  s.airTime = 0;
  s.aLong = s.aLat = 0;
  s.y = groundAt(s, spec, ground).y;
}

/** @param {CarSpec} spec @param {number} rpm */
export function torqueAt(spec, rpm) {
  const c = spec.engine.curve;
  if (rpm <= c[0][0]) return c[0][1];
  for (let i = 1; i < c.length; i++) {
    if (rpm <= c[i][0]) return lerp(c[i - 1][1], c[i][1], (rpm - c[i - 1][0]) / (c[i][0] - c[i - 1][0]));
  }
  return c[c.length - 1][1];
}

/** Lateral tire force for slip angle alpha. Peaks at the surface's peak angle, then fades. */
function tireForce(alpha, load, mu, surf) {
  const C = surf.shape;
  const B = Math.tan(Math.PI / (2 * C)) / surf.peak;
  return -mu * load * Math.sin(C * Math.atan(B * alpha));
}

const _gp = { y: 0, pitch: 0, roll: 0, surfF: 'asphalt', surfR: 'asphalt' };

/** Samples ground under both axles and both sides to get a height and a plane. */
function groundAt(s, spec, ground) {
  const fx = Math.sin(s.yaw);
  const fz = Math.cos(s.yaw);
  const lx = fz;
  const lz = -fx;
  const b = spec.cgToFront;
  const c = spec.wheelbase - b;
  const ht = spec.track / 2;
  let g = ground(s.x + fx * b, s.z + fz * b);
  const hF = g.h;
  _gp.surfF = g.surface;
  g = ground(s.x - fx * c, s.z - fz * c);
  const hR = g.h;
  _gp.surfR = g.surface;
  const hL = ground(s.x + lx * ht, s.z + lz * ht).h;
  const hRt = ground(s.x - lx * ht, s.z - lz * ht).h;
  _gp.y = (hF * c + hR * b) / spec.wheelbase;
  _gp.pitch = Math.atan2(hF - hR, spec.wheelbase);
  _gp.roll = Math.atan2(hL - hRt, spec.track);
  return _gp;
}

/**
 * Advances the car by dt seconds.
 * @param {ReturnType<typeof createVehicleState>} s
 * @param {CarSpec} spec
 * @param {DriveInput} input
 * @param {GroundFn} ground
 * @param {number} dt
 */
export function stepVehicle(s, spec, input, ground, dt = DT) {
  const m = spec.mass;
  const L = spec.wheelbase;
  const b = spec.cgToFront;
  const c = L - b;
  const r = spec.wheelRadius;
  const W = m * G;
  const eng = spec.engine;

  const fx = Math.sin(s.yaw);
  const fz = Math.cos(s.yaw);
  const lx = fz;
  const lz = -fx;
  let vF = s.vx * fx + s.vz * fz;
  let vL = s.vx * lx + s.vz * lz;
  const speed = Math.hypot(s.vx, s.vz);

  // ── Ground and vertical motion ────────────────────────────────────────────
  const gp = groundAt(s, spec, ground);
  s.surfFront = gp.surfF;
  s.surfRear = gp.surfR;
  const follow = vF * Math.tan(gp.pitch) + vL * Math.tan(gp.roll);
  s.landing = 0;
  if (!s.air) {
    const need = (follow - s.vy) / dt;
    if (need < -G * 1.15 && speed > 6) {
      s.air = true;
      s.vy -= G * dt;
      s.y += s.vy * dt;
    } else {
      s.vy = follow;
      s.y = gp.y;
    }
  } else {
    s.vy -= G * dt;
    s.y += s.vy * dt;
    if (s.y <= gp.y) {
      s.landing = Math.max(0, follow - s.vy);
      s.y = gp.y;
      s.vy = follow;
      s.air = false;
    }
  }
  // Short hops keep the tires working: the suspension has some droop.
  s.contact = !s.air || s.y - gp.y < 0.12;
  s.airTime = s.air ? s.airTime + dt : 0;
  if (s.contact) {
    s.pitch = gp.pitch;
    s.roll = gp.roll;
  }

  // ── Gear selection ────────────────────────────────────────────────────────
  const manual = !!input.manual;
  const nG = spec.gears.length;

  if (manual) {
    s.shiftTimer = Math.max(0, s.shiftTimer - dt);
    if (input.shiftUp && s.shiftTimer <= 0) {
      if (s.gear === -1) s.gear = 1;
      else if (s.gear < nG) s.gear++;
      s.shiftTimer = 0.18;
    } else if (input.shiftDown && s.shiftTimer <= 0) {
      if (s.gear > 1) {
        // Prevent downshift if it would over-rev the engine past redline
        const lowerRpm = (Math.abs(vF) / r) * spec.gears[s.gear - 2] * spec.finalDrive * RPM;
        if (lowerRpm <= eng.redline + 200) {
          s.gear--;
          s.shiftTimer = 0.18;
        }
      } else if (s.gear === 1 && Math.abs(vF) < 3) {
        s.gear = -1;
        s.shiftTimer = 0.18;
      }
    }
  } else {
    if (s.gear > 0) {
      if (input.brake > 0.5 && input.throttle < 0.1 && vF < 0.6) {
        s.revTimer += dt;
        if (s.revTimer > 0.3) {
          s.gear = -1;
          s.revTimer = 0;
        }
      } else s.revTimer = 0;
    } else if (input.throttle > 0.5 && input.brake < 0.1 && vF > -0.6) {
      s.revTimer += dt;
      if (s.revTimer > 0.12) {
        s.gear = 1;
        s.revTimer = 0;
      }
    } else s.revTimer = 0;
  }

  const accel = s.gear > 0 ? input.throttle : input.brake;
  const brakeIn = s.gear > 0 ? input.brake : input.throttle;
  s.throttle = s.engineOn ? accel : 0;
  s.braking = brakeIn > 0.05 && Math.abs(vF) > 0.3;
  s.handbrake = input.handbrake > 0.5;

  const ratio = s.gear > 0 ? spec.gears[s.gear - 1] : spec.reverse;
  const total = ratio * spec.finalDrive;
  const wheelRpm = (Math.abs(vF) / r) * total * RPM;

  if (!manual) {
    s.shiftTimer = Math.max(0, s.shiftTimer - dt);
    if (s.gear > 0 && s.shiftTimer <= 0 && s.contact) {
      if (wheelRpm > eng.shiftUp && s.gear < nG) {
        s.gear++;
        s.shiftTimer = 0.22;
      } else if (s.gear > 1) {
        const lower = (Math.abs(vF) / r) * spec.gears[s.gear - 2] * spec.finalDrive * RPM;
        if (wheelRpm < eng.shiftDown && lower < eng.shiftUp * 0.9) {
          s.gear--;
          s.shiftTimer = 0.15;
        }
      }
    }
  }

  // ── Engine ────────────────────────────────────────────────────────────────
  let rpm = wheelRpm;
  if (s.gear === 1 || s.gear === -1) rpm = Math.max(rpm, lerp(eng.idle, eng.launch, accel));
  if (s.shiftTimer > 0) rpm = lerp(s.rpm, rpm, 0.2);
  rpm = Math.max(rpm, eng.idle);
  let torque = 0;
  if (!s.engineOn) {
    rpm = 0;
  } else if (s.shiftTimer <= 0) {
    if (rpm < eng.redline) torque = torqueAt(spec, rpm) * eng.peakTorque * accel;
    else s.limiter = 0.08;
  }
  s.limiter = Math.max(0, s.limiter - dt);
  if (s.limiter > 0) torque = 0;
  let drive = ((torque * total * spec.efficiency) / r) * (s.gear > 0 ? 1 : -1);
  if (accel < 0.05 && s.engineOn && Math.abs(vF) > 0.5) drive -= Math.sign(vF) * eng.braking * clamp(rpm / eng.redline, 0.2, 1);

  // ── Loads and grip ────────────────────────────────────────────────────────
  const transfer = (spec.cgHeight / L) * m * s.aLong;
  const Nf = clamp((W * c) / L - transfer, 0.15 * W, 0.85 * W);
  const Nr = W - Nf;
  const sfF = surface(s.surfFront);
  const sfR = surface(s.surfRear);
  const muF = spec.tire.mu * sfF.mu * (sfF.loose ? spec.tire.looseGrip : 1);
  const hb = s.handbrake ? 0.5 : 1;
  const muR = spec.tire.mu * spec.tire.rearMu * sfR.mu * (sfR.loose ? spec.tire.looseGrip : 1);
  const capF = muF * Nf;
  const capR = muR * Nr;

  let FxF = 0;
  let FxR = 0;
  if (spec.drive === 'AWD') {
    FxF = drive * spec.frontShare;
    FxR = drive * (1 - spec.frontShare);
  } else if (spec.drive === 'FWD') FxF = drive;
  else FxR = drive;
  // Traction control: the driven axles never use all their grip for drive, so some is
  // always left for cornering. tc closer to 1 means a looser, more lurid car.
  let spin = 0;
  const tc = spec.tire.tc;
  if (Math.abs(FxF) > capF * tc) {
    spin += Math.max(0, Math.abs(FxF) - capF);
    FxF = Math.sign(FxF) * capF * tc;
  }
  if (Math.abs(FxR) > capR * tc) {
    spin += Math.max(0, Math.abs(FxR) - capR);
    FxR = Math.sign(FxR) * capR * tc;
  }
  if (s.braking) {
    const fb = spec.brake * brakeIn * Math.sign(vF);
    FxF -= fb * 0.62;
    FxR -= fb * 0.38;
  }
  if (s.handbrake && Math.abs(vF) > 0.3) FxR -= Math.sign(vF) * spec.handbrake;
  if (Math.abs(FxF) > capF) FxF = Math.sign(FxF) * capF;
  if (Math.abs(FxR) > capR) FxR = Math.sign(FxR) * capR;
  s.wheelspin = s.contact && accel > 0.1 ? clamp(spin / (0.25 * W), 0, 1) : 0;

  // ── Steering ──────────────────────────────────────────────────────────────
  const lock = spec.steer.max / (1 + Math.abs(vF) / spec.steer.falloff);
  let target = -input.steer * lock;
  if (vF > 3 && s.contact) {
    // Point the wheels a little toward where the car is actually going: built-in countersteer.
    const beta = Math.atan2(vL, Math.abs(vF));
    target += beta * spec.steer.assist;
  }
  target = clamp(target, -spec.steer.max, spec.steer.max);
  s.steer = approach(s.steer, target, spec.steer.speed * dt);
  const cs = Math.cos(s.steer);
  const sn = Math.sin(s.steer);

  // ── Tire forces ───────────────────────────────────────────────────────────
  let FyF = 0;
  let FyR = 0;
  if (s.contact) {
    const vLf = vL + s.yawRate * b;
    const vFw = vF * cs + vLf * sn;
    const vLw = -vF * sn + vLf * cs;
    const alphaF = Math.atan2(vLw, Math.max(Math.abs(vFw), 1.5));
    const vLr = vL - s.yawRate * c;
    const alphaR = Math.atan2(vLr, Math.max(Math.abs(vF), 1.5));
    const latCapF = Math.sqrt(Math.max(0, capF * capF - FxF * FxF));
    const latCapR = Math.sqrt(Math.max(0, capR * hb * (capR * hb) - FxR * FxR));
    FyF = clamp(tireForce(alphaF, Nf, muF, sfF), -latCapF, latCapF);
    FyR = clamp(tireForce(alphaR, Nr, muR * hb, sfR), -latCapR, latCapR);
    s.slipFront = Math.abs(vLw);
    s.slipRear = Math.abs(vLr);
  } else {
    FxF = FxR = 0;
    s.slipFront = s.slipRear = 0;
  }
  s.skid = s.contact ? Math.max(s.slipFront, s.slipRear, s.wheelspin * 8, s.braking && brakeIn > 0.9 ? Math.abs(vF) * 0.3 : 0) : 0;

  // ── Sum forces in the body frame ─────────────────────────────────────────
  let Ff = FxF * cs - FyF * sn + FxR;
  let Fl = FxF * sn + FyF * cs + FyR;
  const yawTorque = s.contact ? b * (FxF * sn + FyF * cs) - c * FyR : 0;
  Ff -= spec.drag * vF * Math.abs(vF);
  Fl -= spec.drag * 2 * vL * Math.abs(vL);
  if (s.contact) {
    const roll = ((sfF.roll + sfR.roll) / 2) * spec.rolling * W;
    Ff -= roll * clamp(vF / 0.5, -1, 1);
    Ff -= W * Math.sin(s.pitch);
    Fl -= W * Math.sin(s.roll);
  }

  const aF = Ff / m;
  const aL = Fl / m;
  s.vx += (aF * fx + aL * lx) * dt;
  s.vz += (aF * fz + aL * lz) * dt;
  s.yawRate += (yawTorque / spec.yawInertia) * dt;
  if (!s.contact) s.yawRate *= 1 - 0.4 * dt;

  // ── Low speed: blend toward rolling without slip, and park when idle ─────
  vF = s.vx * fx + s.vz * fz;
  vL = s.vx * lx + s.vz * lz;
  const sp = Math.hypot(s.vx, s.vz);
  if (s.contact && sp < 4) {
    const k = 1 - sp / 4;
    const kin = (vF * Math.tan(s.steer)) / L;
    const blend = 1 - Math.exp(-14 * k * dt);
    s.yawRate = lerp(s.yawRate, kin, blend);
    vL = lerp(vL, 0, blend);
    s.vx = vF * fx + vL * lx;
    s.vz = vF * fz + vL * lz;
    if (sp < 0.4 && accel < 0.05) {
      s.vx = s.vz = 0;
      s.yawRate = 0;
    }
  }

  s.yaw += s.yawRate * dt;
  s.x += s.vx * dt;
  s.z += s.vz * dt;

  // Filtered accelerations feed load transfer and body roll.
  s.aLong = lerp(s.aLong, s.contact ? aF + G * Math.sin(s.pitch) : 0, 0.15);
  s.aLat = lerp(s.aLat, s.contact ? aL : 0, 0.15);
  s.vLong = vF;
  s.vLat = vL;
  s.speed = sp;
  s.rpm = lerp(s.rpm, rpm + s.wheelspin * 1500, 0.25);
  s.wheelAngle += ((vF + Math.sign(drive) * s.wheelspin * 6) / r) * dt;

  if (s.engineOn) {
    s.fuel -= (0.0012 + spec.fuel.burn * accel * clamp(rpm / eng.redline, 0.2, 1)) * dt;
    if (s.fuel <= 0) {
      s.fuel = 0;
      s.engineOn = false;
    }
  }
  return s;
}
