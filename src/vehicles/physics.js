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
 *
 * Drivetrain: `gear` is -1 (R), 0 (N) or 1 to the number of forward gears. The engine
 * is tied to the driven wheels through the gearbox, and the wheels may turn faster than
 * the road passes under them: `slip` (m/s) is that extra surface speed. Engine rpm comes
 * from the wheel speed, so a spinning car revs to the limiter, and a car that is yawing
 * or sliding sideways does not drag its rpm around with its heading. Heat, over-rev and
 * the money shift live in `thermal.js`.
 */

import { surface, slipFactor } from './surfaces.js';
import { clamp, approach, lerp } from '../core/mathx.js';
import { LIMP_RPM, healthScale, stepEngineHealth, thermalDerate, TEMP_START, EXH_START } from './thermal.js';
import { createFx, stepExhaust } from './exhaust.js';

export const G = 9.81;
export const DT = 1 / 120;
const RPM = 60 / (2 * Math.PI);

/** Seconds the clutch is open on a manual shift. */
const CLUTCH_TIME = 0.1;
/** Extra engine rpm, as a fraction of wheel rpm, while the clutch slips in first and reverse. */
const CLUTCH_SLIP = 0.35;
/** Slip (m/s) below which the driven wheels count as gripping. */
const SPIN_EPS = 0.05;
/** Kilograms of rotating wheel and driveline mass per driven axle, as inertia in kg m^2. */
const WHEEL_INERTIA = 2.2;
const DEFAULT_ENGINE_INERTIA = 0.25;

/** @typedef {import('./specs.js').CarSpec} CarSpec */
/** @typedef {{ throttle: number, brake: number, steer: number, handbrake: number, shiftUp?: boolean, shiftDown?: boolean, manual?: boolean }} DriveInput */
/** @typedef {(x: number, z: number, y?: number) => { h: number, surface: string }} GroundFn */

/** @param {CarSpec} spec */
export function createVehicleState(spec) {
  return {
    x: 0, y: 0, z: 0, yaw: 0,
    vx: 0, vz: 0, vy: 0, yawRate: 0,
    steer: 0,
    gear: 1, shiftTimer: 0, revTimer: 0, manual: false,
    shiftCount: 0, shiftFrom: 1, shiftTo: 1, shiftRpm: 0,
    rpm: spec.engine.idle, throttle: 0, limiter: 0, slip: 0,
    temp: TEMP_START, exh: EXH_START, load: 0,
    overrev: 0, damage: 0, blown: false, blowCount: 0, seize: 0,
    idleTime: 0,
    fx: createFx(),
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
  s.slip = 0;
  s.air = false;
  s.airTime = 0;
  s.aLong = s.aLat = 0;
  // Placed on the ground, never on a deck above it.
  s.y = -Infinity;
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
  const y = s.y;
  let g = ground(s.x + fx * b, s.z + fz * b, y);
  const hF = g.h;
  _gp.surfF = g.surface;
  g = ground(s.x - fx * c, s.z - fz * c, y);
  const hR = g.h;
  _gp.surfR = g.surface;
  const hL = ground(s.x + lx * ht, s.z + lz * ht, y).h;
  const hRt = ground(s.x - lx * ht, s.z - lz * ht, y).h;
  _gp.y = (hF * c + hR * b) / spec.wheelbase;
  _gp.pitch = Math.atan2(hF - hR, spec.wheelbase);
  _gp.roll = Math.atan2(hL - hRt, spec.track);
  return _gp;
}

/**
 * Moves the gear selector and starts the clutch time.
 * @param {ReturnType<typeof createVehicleState>} s @param {number} to @param {number} time
 */
function shiftTo(s, to, time) {
  s.shiftCount++;
  s.shiftFrom = s.gear;
  s.shiftTo = to;
  s.shiftRpm = s.rpm;
  s.gear = to;
  s.shiftTimer = time;
}

/**
 * Engine rpm with the gearbox in neutral or the clutch out: the engine spins freely, so
 * it climbs at a rate set by its inertia and falls back to idle on its own friction.
 * @param {ReturnType<typeof createVehicleState>} s @param {CarSpec} spec @param {number} accel @param {number} dt
 */
function freeRev(s, spec, accel, dt) {
  if (s.blown) {
    s.idleTime = (s.idleTime || 0) + dt;
    const phase = s.idleTime * 4 + s.x * 0.05 + s.z * 0.05;
    const noise = Math.sin(phase) * 240 + Math.sin(phase * 2.3 + 1.1) * 110;
    const target = clamp(1450 + noise + accel * 200, 1100, 1850);
    const rpm = s.rpm + (target - s.rpm) * (1 - Math.exp(-dt / 0.15));
    return clamp(rpm, 900, LIMP_RPM);
  }
  const e = spec.engine;
  const torque = torqueAt(spec, s.rpm) * e.peakTorque * accel;
  const friction = e.peakTorque * (0.06 + 0.22 * (s.rpm / e.redline) ** 2);
  const idleHold = e.peakTorque * 0.3 * clamp((e.idle - s.rpm) / 150, 0, 1);
  const alpha = (torque - friction + idleHold) / (e.inertia || DEFAULT_ENGINE_INERTIA);
  return Math.max(e.idle * 0.85, s.rpm + alpha * RPM * dt);
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
  const vF0 = vF;
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
  s.manual = manual;
  s.shiftTimer = Math.max(0, s.shiftTimer - dt);

  if (manual) {
    // R, N, 1 ... n in order, at any speed. Nothing is refused: shift down too far and the
    // engine pays for it (see thermal.js).
    if (s.shiftTimer <= 0) {
      if (input.shiftUp && s.gear < nG) shiftTo(s, s.gear + 1, CLUTCH_TIME);
      else if (input.shiftDown && s.gear > -1) shiftTo(s, s.gear - 1, CLUTCH_TIME);
    }
  } else {
    if (s.gear === 0) s.gear = 1;
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

  const dir = s.gear > 0 ? 1 : s.gear < 0 ? -1 : 0;
  const accel = manual ? input.throttle : s.gear > 0 ? input.throttle : input.brake;
  const brakeIn = manual ? input.brake : s.gear > 0 ? input.brake : input.throttle;
  s.throttle = s.engineOn ? accel : 0;
  s.braking = brakeIn > 0.05 && Math.abs(vF) > 0.3;
  s.handbrake = input.handbrake > 0.5;

  const ratio = s.gear > 0 ? spec.gears[s.gear - 1] : s.gear < 0 ? spec.reverse : 0;
  const total = ratio * spec.finalDrive;
  const wheelSpeed = vF + dir * s.slip;
  const wheelRpm = dir === 0 ? 0 : (Math.abs(wheelSpeed) / r) * total * RPM;

  if (!manual && dir > 0) {
    // The automatic shifts on road speed, so a spinning wheel does not make it hunt.
    const roadRpm = (Math.abs(vF) / r) * total * RPM;
    if (s.shiftTimer <= 0 && s.contact) {
      if (roadRpm > eng.shiftUp && s.gear < nG) shiftTo(s, s.gear + 1, 0.22);
      else if (s.gear > 1) {
        const lower = (Math.abs(vF) / r) * spec.gears[s.gear - 2] * spec.finalDrive * RPM;
        if (roadRpm < eng.shiftDown && lower < eng.shiftUp * 0.9) shiftTo(s, s.gear - 1, 0.15);
      }
    }
  }

  // ── Engine ────────────────────────────────────────────────────────────────
  let rpm;
  if (dir === 0 || s.blown) rpm = freeRev(s, spec, accel, dt);
  else {
    rpm = wheelRpm;
    // The clutch slips in the launch gears: the engine runs above the wheels, by an amount that
    // fades as the car picks up speed, so the needle climbs instead of sitting on one number.
    if (Math.abs(s.gear) === 1) {
      rpm = Math.max(rpm, lerp(eng.idle, eng.launch, accel) + CLUTCH_SLIP * rpm);
    }
    if (s.shiftTimer > 0) rpm = lerp(s.rpm, rpm, 0.2);
    rpm = Math.max(rpm, eng.idle);
  }
  if (s.blown) rpm = Math.min(rpm, LIMP_RPM);
  let torque = 0;
  if (!s.engineOn) {
    rpm = 0;
  } else if (s.shiftTimer <= 0 || dir === 0) {
    const cap = s.blown ? Math.min(LIMP_RPM, eng.redline) : eng.redline;
    if (s.blown || rpm < cap) torque = torqueAt(spec, rpm) * eng.peakTorque * accel;
    else s.limiter = 0.08;
  }
  s.limiter = Math.max(0, s.limiter - dt);
  if (s.limiter > 0) torque = 0;
  torque *= thermalDerate(s.temp) * healthScale(s);
  const wheelForce = (torque * total * spec.efficiency) / r;
  let drive = wheelForce * dir;
  if (dir !== 0 && s.engineOn) {
    if (accel < 0.05 && Math.abs(vF) > 0.5) drive -= Math.sign(vF) * eng.braking * clamp(rpm / eng.redline, 0.2, 1);
    // Wheels forcing the engine past its limit drag the car back, harder the further it goes.
    if (s.overrev > 0) drive -= Math.sign(wheelSpeed) * eng.braking * 2.5 * s.overrev;
  }
  if (s.seize > 0) drive -= Math.sign(vF) * 0.5 * W;

  // ── Loads and grip ────────────────────────────────────────────────────────
  const transfer = (spec.cgHeight / L) * m * s.aLong;
  const Nf = clamp((W * c) / L - transfer, 0.15 * W, 0.85 * W);
  const Nr = W - Nf;
  const sfF = surface(s.surfFront);
  const sfR = surface(s.surfRear);
  // Downforce adds grip on hard surfaces only; on loose ground the tires sink in and it does little.
  const v2 = speed * speed;
  const downF = sfF.loose ? 0 : spec.aero.front * v2;
  const downR = sfR.loose ? 0 : spec.aero.rear * v2;
  const muF = spec.tire.mu * sfF.mu * (sfF.loose ? spec.tire.looseGrip : 1);
  const hb = s.handbrake ? 0.5 : 1;
  const muR = spec.tire.mu * spec.tire.rearMu * sfR.mu * (sfR.loose ? spec.tire.looseGrip : 1);
  const capF = muF * (Nf + downF);
  const capR = muR * (Nr + downR);

  let FxF = 0;
  let FxR = 0;
  if (spec.drive === 'AWD') {
    FxF = drive * spec.frontShare;
    FxR = drive * (1 - spec.frontShare);
  } else if (spec.drive === 'FWD') FxF = drive;
  else FxR = drive;
  // Traction control: the driven axles never use all their grip for drive, so some is
  // always left for cornering. tc closer to 1 means a looser, more lurid car. The
  // friction circle for cornering uses these clamped values; what actually reaches the
  // road is lower once the wheels are spinning (slipFactor).
  const tc = spec.tire.tc;
  const kappa = s.slip / Math.max(Math.abs(vF), 2);
  const spinning = dir !== 0 && s.slip > SPIN_EPS;
  const demandF = FxF;
  const demandR = FxR;
  if (spinning) {
    // A spinning axle slides: it passes its sliding limit whatever the engine is doing,
    // which keeps pushing the car while the wheels spin down.
    FxF = spec.drive !== 'RWD' ? dir * capF * tc : 0;
    FxR = spec.drive !== 'FWD' ? dir * capR * tc : 0;
  } else {
    if (Math.abs(FxF) > capF * tc) FxF = Math.sign(FxF) * capF * tc;
    if (Math.abs(FxR) > capR * tc) FxR = Math.sign(FxR) * capR * tc;
  }
  const circleF = FxF;
  const circleR = FxR;
  FxF *= slipFactor(kappa, sfF);
  FxR *= slipFactor(kappa, sfR);
  const sent = FxF + FxR;
  const pushed = demandF + demandR;
  let brakeF = 0;
  let brakeR = 0;
  if (s.braking) {
    const fb = spec.brake * brakeIn * Math.sign(vF);
    brakeF = -fb * 0.62;
    brakeR = -fb * 0.38;
  }
  if (s.handbrake && Math.abs(vF) > 0.3) brakeR -= Math.sign(vF) * spec.handbrake;
  const limit = (v, cap) => (Math.abs(v) > cap ? Math.sign(v) * cap : v);
  const lateralUseF = limit(circleF + brakeF, capF);
  const lateralUseR = limit(circleR + brakeR, capR);
  FxF = limit(FxF + brakeF, capF);
  FxR = limit(FxR + brakeR, capR);

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
    const latCapF = Math.sqrt(Math.max(0, capF * capF - lateralUseF * lateralUseF));
    const latCapR = Math.sqrt(Math.max(0, capR * hb * (capR * hb) - lateralUseR * lateralUseR));
    FyF = clamp(tireForce(alphaF, Nf + downF, muF, sfF), -latCapF, latCapF);
    FyR = clamp(tireForce(alphaR, Nr + downR, muR * hb, sfR), -latCapR, latCapR);
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

  // ── Driven wheels: what the engine pushes that the tires cannot pass on spins them ─
  if (dir === 0 || s.seize > 0) s.slip = 0;
  else {
    const excess = s.contact ? dir * (pushed - sent) : dir * pushed;
    const driven = s.shiftTimer > 0 ? 0 : (eng.inertia || DEFAULT_ENGINE_INERTIA) * total * total;
    const inertia = ((spec.drive === 'AWD' ? 2 : 1) * WHEEL_INERTIA + driven) / (r * r);
    // Gripping wheels turn with the road, so only a wheel already spinning, or one the
    // engine is pushing past what the tires can pass on, changes its slip.
    if (!spinning && excess <= 0) s.slip = 0;
    else s.slip = clamp(s.slip + (excess / inertia) * dt - dir * (vF - vF0), 0, 90);
    if (s.slip < SPIN_EPS && excess <= 0) s.slip = 0;
  }
  const kappaNow = s.slip / Math.max(Math.abs(vF), 2);
  s.wheelspin = s.contact && dir !== 0 && accel > 0.1 ? clamp((kappaNow - 0.1) / 0.4, 0, 1) : 0;

  // Filtered accelerations feed load transfer and body roll.
  s.aLong = lerp(s.aLong, s.contact ? aF + G * Math.sin(s.pitch) : 0, 0.15);
  s.aLat = lerp(s.aLat, s.contact ? aL : 0, 0.15);
  s.vLong = vF;
  s.vLat = vL;
  s.speed = sp;
  s.rpm = dir === 0 || s.blown ? rpm : lerp(s.rpm, rpm, 0.25);
  s.wheelAngle += ((vF + dir * s.slip * (spec.drive === 'AWD' ? 1 : 0.6)) / r) * dt;

  stepEngineHealth(s, spec, rpm, dir === 0 || s.shiftTimer > 0 ? 0 : wheelRpm, dt);
  stepExhaust(s, spec, dt);

  if (s.engineOn) {
    s.fuel -= (0.0012 + spec.fuel.burn * accel * clamp(rpm / eng.redline, 0.2, 1)) * dt;
    if (s.fuel <= 0) {
      s.fuel = 0;
      s.engineOn = false;
    }
  }
  return s;
}
