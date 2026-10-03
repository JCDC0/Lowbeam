/**
 * Car against car. Each car is three circles along its length, like the static collisions
 * in world/collision.js. Overlaps are pushed apart by inverse mass and a contact impulse
 * with restitution and friction is applied to both, so a heavy truck barely notices a hatch
 * and a glancing blow spins the lighter car. Pure, no three.js.
 */

const RESTITUTION = 0.2;
const FRICTION = 0.35;

/**
 * Anything with a position, a velocity and a mass can collide.
 * `reach` is the distance from the center to the middle circle at each end, `offset` shifts
 * the whole row of circles forward (a car's center of mass is not its middle).
 * @typedef {{
 *   x: number, z: number, yaw: number, vx: number, vz: number, yawRate: number,
 *   mass: number, inertia: number, width: number, length: number, offset: number
 * }} Body
 */

/** Circle centers of a body, three of them. @param {Body} b @param {number[]} out */
function circles(b, out) {
  const r = b.width / 2;
  const reach = Math.max(0, b.length / 2 - r);
  const fx = Math.sin(b.yaw);
  const fz = Math.cos(b.yaw);
  for (let k = 0; k < 3; k++) {
    const off = b.offset + (k - 1) * reach;
    out[k * 2] = b.x + fx * off;
    out[k * 2 + 1] = b.z + fz * off;
  }
  return r;
}

const _a = [0, 0, 0, 0, 0, 0];
const _b = [0, 0, 0, 0, 0, 0];

/**
 * Resolves overlaps between two bodies and returns the closing speed of the hardest hit
 * (0 when they do not touch). Both bodies are changed.
 * @param {Body} A @param {Body} B
 */
export function collideCars(A, B) {
  if (Math.hypot(A.x - B.x, A.z - B.z) > (A.length + B.length) / 2 + 1) return 0;
  const ra = circles(A, _a);
  const rb = circles(B, _b);
  const wa = 1 / A.mass;
  const wb = 1 / B.mass;
  let hardest = 0;
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      const dx = _a[i * 2] - _b[j * 2];
      const dz = _a[i * 2 + 1] - _b[j * 2 + 1];
      const d = Math.hypot(dx, dz);
      const depth = ra + rb - d;
      if (depth <= 0 || d < 1e-6) continue;
      const nx = dx / d;
      const nz = dz / d;
      // Push apart in proportion to how light each one is.
      const push = depth / (wa + wb);
      A.x += nx * push * wa;
      A.z += nz * push * wa;
      B.x -= nx * push * wb;
      B.z -= nz * push * wb;
      _a[i * 2] += nx * push * wa;
      _a[i * 2 + 1] += nz * push * wa;
      _b[j * 2] -= nx * push * wb;
      _b[j * 2 + 1] -= nz * push * wb;
      // Contact point halfway between the circle edges.
      const px = _a[i * 2] - nx * ra;
      const pz = _a[i * 2 + 1] - nz * ra;
      hardest = Math.max(hardest, impulse(A, B, px, pz, nx, nz));
    }
  }
  return hardest;
}

/** @param {Body} A @param {Body} B */
function impulse(A, B, px, pz, nx, nz) {
  const rax = px - A.x;
  const raz = pz - A.z;
  const rbx = px - B.x;
  const rbz = pz - B.z;
  // Velocity of the contact point on each: v + w x r, with w about +Y (positive yaw turns left).
  const vax = A.vx + A.yawRate * raz;
  const vaz = A.vz - A.yawRate * rax;
  const vbx = B.vx + B.yawRate * rbz;
  const vbz = B.vz - B.yawRate * rbx;
  const vn = (vax - vbx) * nx + (vaz - vbz) * nz;
  if (vn >= 0) return 0;
  const rna = raz * nx - rax * nz;
  const rnb = rbz * nx - rbx * nz;
  const k = 1 / A.mass + 1 / B.mass + (rna * rna) / A.inertia + (rnb * rnb) / B.inertia;
  const jn = (-(1 + RESTITUTION) * vn) / k;
  A.vx += (jn * nx) / A.mass;
  A.vz += (jn * nz) / A.mass;
  A.yawRate += (rna * jn) / A.inertia;
  B.vx -= (jn * nx) / B.mass;
  B.vz -= (jn * nz) / B.mass;
  B.yawRate -= (rnb * jn) / B.inertia;
  const tx = -nz;
  const tz = nx;
  const vt = (vax - vbx) * tx + (vaz - vbz) * tz;
  const rta = raz * tx - rax * tz;
  const rtb = rbz * tx - rbx * tz;
  const kt = 1 / A.mass + 1 / B.mass + (rta * rta) / A.inertia + (rtb * rtb) / B.inertia;
  const jt = Math.max(-FRICTION * jn, Math.min(FRICTION * jn, -vt / kt));
  A.vx += (jt * tx) / A.mass;
  A.vz += (jt * tz) / A.mass;
  A.yawRate += (rta * jt) / A.inertia;
  B.vx -= (jt * tx) / B.mass;
  B.vz -= (jt * tz) / B.mass;
  B.yawRate -= (rtb * jt) / B.inertia;
  return -vn;
}

/**
 * A physics state and its spec as a Body view. The returned object reads and writes the
 * state, so a collision changes the car.
 * @param {ReturnType<typeof import('./physics.js').createVehicleState>} s
 * @param {import('./specs.js').CarSpec} spec
 * @returns {Body}
 */
export function bodyOf(s, spec) {
  return {
    get x() { return s.x; }, set x(v) { s.x = v; },
    get z() { return s.z; }, set z(v) { s.z = v; },
    get yaw() { return s.yaw; }, set yaw(v) { s.yaw = v; },
    get vx() { return s.vx; }, set vx(v) { s.vx = v; },
    get vz() { return s.vz; }, set vz(v) { s.vz = v; },
    get yawRate() { return s.yawRate; }, set yawRate(v) { s.yawRate = v; },
    mass: spec.mass,
    inertia: spec.yawInertia,
    width: spec.width,
    length: spec.length,
    offset: spec.cgToFront - spec.wheelbase / 2,
  };
}
