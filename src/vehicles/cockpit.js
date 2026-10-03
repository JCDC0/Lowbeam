/**
 * The cockpit: a lofted interior with real modeled instruments. Every car has its own dash:
 * a hooded binnacle pod with round gauges (canvas faces, chrome bezels, depth cans and
 * needles that turn), and on some cars extra pods: a boost gauge on the dash top or a
 * three-gauge center stack. Readings come from `gauges.js` through `update`.
 *
 * Body space as in models.js: +Z forward, +X is the car's LEFT, y up. Gauge layouts are in
 * the plane of their pod: u to the driver's right, v up.
 */

import * as THREE from 'three';
import { MeshBuilder } from '../render/builder.js';
import { psxBasic, psxLambert, psxPhong } from '../render/psx.js';
import { canvasTexture, makeCanvas } from '../render/textures.js';
import { DASHES, gaugeScale, needleAngle } from './dash.js';

export { DASHES, gaugeScale, needleAngle };

/** Steering wheel turns per radian of front wheel angle. */
export const STEER_RATIO = 4.5;

/** @typedef {import('./dash.js').GaugeSpot} GaugeSpot */

/**
 * Draws a gauge face onto a canvas: dark dial, ticks and the red zone. No numerals: at 240
 * lines they cannot be read, so the needle against the ticks tells the story.
 */
function drawFace(type, spec) {
  const S = 128;
  const c = makeCanvas(S, S);
  const g = /** @type {CanvasRenderingContext2D} */ (c.getContext('2d'));
  const m = S / 2;
  const sc = gaugeScale(type, spec);
  g.fillStyle = '#07080a';
  g.fillRect(0, 0, S, S);
  const grad = g.createRadialGradient(m, m * 0.85, 4, m, m, m);
  grad.addColorStop(0, '#1a1c22');
  grad.addColorStop(1, '#0b0c0f');
  g.fillStyle = grad;
  g.beginPath();
  g.arc(m, m, m - 1, 0, Math.PI * 2);
  g.fill();
  const toXY = (a, rr) => [m + Math.sin(a) * rr, m - Math.cos(a) * rr];
  const R = m - 6;
  if (sc.red < sc.max) {
    g.strokeStyle = '#d0201a';
    g.lineWidth = sc.small ? 7 : 6;
    g.beginPath();
    const a0 = needleAngle(sc, sc.red) - Math.PI / 2;
    const a1 = needleAngle(sc, sc.max) - Math.PI / 2;
    g.arc(m, m, R - 3, a0, a1);
    g.stroke();
  }
  g.strokeStyle = '#e8e4da';
  for (let v = sc.min; v <= sc.max + 1e-6; v += sc.minor) {
    const major = Math.abs(((v - sc.min) / sc.major) - Math.round((v - sc.min) / sc.major)) < 1e-6;
    const a = needleAngle(sc, v);
    const [x0, y0] = toXY(a, R);
    const [x1, y1] = toXY(a, R - (major ? 13 : 7));
    g.lineWidth = major ? 4 : 2;
    g.beginPath();
    g.moveTo(x0, y0);
    g.lineTo(x1, y1);
    g.stroke();
  }
  return canvasTexture(c);
}

/** A small text texture, redrawn on change (the gear readout). */
function textTexture(w, h) {
  const c = makeCanvas(w, h);
  const g = /** @type {CanvasRenderingContext2D} */ (c.getContext('2d'));
  const tex = canvasTexture(c);
  let last = '';
  return {
    tex,
    set(text, color = '#ffb020') {
      if (text === last) return;
      last = text;
      g.fillStyle = '#050607';
      g.fillRect(0, 0, w, h);
      g.fillStyle = color;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.font = `bold ${Math.floor(h * 0.8)}px "Lowbeam Display", sans-serif`;
      g.fillText(text, w / 2, h / 2 + 1);
      tex.needsUpdate = true;
    },
  };
}

/** A group whose local axes are u (driver's right), v (up) and n (toward the eye). */
function podFrame(center, eye) {
  const n = new THREE.Vector3().subVectors(eye, center).normalize();
  const u = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), n).normalize();
  const v = new THREE.Vector3().crossVectors(n, u);
  const grp = new THREE.Group();
  grp.matrixAutoUpdate = false;
  grp.matrix.makeBasis(u, v, n).setPosition(center);
  return grp;
}

/**
 * The pod shell in pod space: a backing plate, sides buried back into the dash, and a hood
 * arched over the top that reaches toward the driver.
 */
function podShell(w, h, hood) {
  const b = new MeshBuilder();
  const hw = w / 2 + 0.02;
  const hh = h / 2 + 0.02;
  const back = -0.09;
  b.quad('pod', [-hw, -hh, 0], [hw, -hh, 0], [hw, hh, 0], [-hw, hh, 0]);
  b.quad('pod', [-hw, -hh, back], [hw, -hh, back], [hw, -hh, 0], [-hw, -hh, 0]);
  b.quad('pod', [hw, -hh, back], [hw, hh, back], [hw, hh, 0], [hw, -hh, 0]);
  b.quad('pod', [-hw, hh, back], [-hw, -hh, back], [-hw, -hh, 0], [-hw, hh, 0]);
  if (hood) {
    const steps = 10;
    const arch = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const a = Math.PI * (1 - t);
      arch.push([Math.cos(a) * (hw + 0.012), hh - 0.03 + Math.sin(a) * 0.06]);
    }
    const front = hood;
    for (let i = 0; i < steps; i++) {
      const [x0, y0] = arch[i];
      const [x1, y1] = arch[i + 1];
      b.quad('pod', [x0, y0, back], [x1, y1, back], [x1, y1, front], [x0, y0, front]);
      b.quad('pod', [x0, y0 - 0.012, front], [x1, y1 - 0.012, front], [x1, y1, front], [x0, y0, front]);
    }
  }
  return b;
}

/**
 * One gauge in pod space: depth can, chrome bezel, face, needle (in its own group so it can
 * turn) and a hub cap.
 */
function makeGauge(spot, spec, mats) {
  const grp = new THREE.Group();
  grp.position.set(spot.u, spot.v, 0.004);
  const can = new THREE.Mesh(new THREE.CylinderGeometry(spot.r * 1.04, spot.r * 1.04, 0.035, 20, 1, true), mats.can);
  can.rotation.x = Math.PI / 2;
  can.position.z = -0.012;
  const bezel = new THREE.Mesh(new THREE.TorusGeometry(spot.r * 1.04, Math.max(0.003, spot.r * 0.07), 4, 24), mats.bezel);
  bezel.position.z = 0.004;
  const faceMat = psxBasic({ map: drawFace(spot.type, spec), color: 0xd8d8d8 });
  const face = new THREE.Mesh(new THREE.CircleGeometry(spot.r, 24), faceMat);
  const pivot = new THREE.Group();
  pivot.position.z = 0.006;
  const len = spot.r * 0.86;
  const w = Math.max(0.0022, spot.r * 0.06);
  const ng = new THREE.BufferGeometry();
  ng.setAttribute('position', new THREE.Float32BufferAttribute([-w, -spot.r * 0.18, 0, w, -spot.r * 0.18, 0, w * 0.35, len, 0, -w, -spot.r * 0.18, 0, w * 0.35, len, 0, -w * 0.35, len, 0], 3));
  const needle = new THREE.Mesh(ng, mats.needle);
  pivot.add(needle);
  const cap = new THREE.Mesh(new THREE.CircleGeometry(spot.r * 0.13, 10), mats.can);
  cap.position.z = 0.009;
  grp.add(can, bezel, face, pivot, cap);
  return { grp, pivot, scale: gaugeScale(spot.type, spec), type: spot.type, faceMat, value: gaugeScale(spot.type, spec).min };
}

/**
 * Builds the interior for the cockpit camera, in body space so it leans with the body.
 * @param {import('./models.js').CarModel} model
 */
export function buildCockpit(model) {
  const k = model.kit;
  const def = model.def;
  const spec = model.spec;
  const cowlZ = def.glass.front[1];
  const roofZ = def.glass.front[0];
  const sc = k.at(cowlZ);
  const sr = k.at(roofZ);
  const beltY = sc[5];
  const halfIn = sc[6] - 0.07;
  const roofY = sr[7];
  const cowlY = sc[7];
  const floorY = sc[1] + 0.02;
  const dx = def.driver * Math.min(0.4, halfIn * 0.45);
  const eye = new THREE.Vector3(dx, roofY - 0.23, roofZ - 0.48);
  const dashBack = eye.z + 0.64;
  const b = new MeshBuilder();
  const E = [eye.x, eye.y, eye.z];
  /** Quad wound toward the eye. */
  const q = (key, a, c, d, e) => {
    const ux = c[0] - a[0], uy = c[1] - a[1], uz = c[2] - a[2];
    const vx = d[0] - a[0], vy = d[1] - a[1], vz = d[2] - a[2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const toward = (E[0] - a[0]) * nx + (E[1] - a[1]) * ny + (E[2] - a[2]) * nz;
    if (toward >= 0) b.quad(key, a, c, d, e);
    else b.quad(key, a, e, d, c);
  };

  // Dash top from the windshield back to the lip, rounded over the lip, then the face.
  q('dash', [-halfIn, beltY, dashBack], [halfIn, beltY, dashBack], [halfIn, cowlY, cowlZ + 0.02], [-halfIn, cowlY, cowlZ + 0.02]);
  q('dash', [-halfIn, beltY - 0.03, dashBack - 0.04], [halfIn, beltY - 0.03, dashBack - 0.04], [halfIn, beltY, dashBack], [-halfIn, beltY, dashBack]);
  q('dash', [-halfIn, beltY - 0.4, dashBack - 0.02], [halfIn, beltY - 0.4, dashBack - 0.02], [halfIn, beltY - 0.03, dashBack - 0.04], [-halfIn, beltY - 0.03, dashBack - 0.04]);
  q('floor', [halfIn, floorY, cowlZ + 0.02], [-halfIn, floorY, cowlZ + 0.02], [-halfIn, cowlY, cowlZ + 0.02], [halfIn, cowlY, cowlZ + 0.02]);
  q('floor', [-halfIn, floorY, cowlZ + 0.02], [halfIn, floorY, cowlZ + 0.02], [halfIn, floorY, eye.z - 0.95], [-halfIn, floorY, eye.z - 0.95]);
  // Center console and the trim strip across the dash face.
  b.box('dash', 0, beltY - 0.33, dashBack - 0.3, 0.26, 0.2, 0.64);
  b.box('trim', 0, beltY - 0.06, dashBack - 0.045, halfIn * 2 - 0.1, 0.012, 0.01);
  // Vents either side of the cluster and in the middle.
  for (const x of [-dx * 1.75, dx * 0.12]) b.box('vent', x, beltY - 0.12, dashBack - 0.045, 0.12, 0.05, 0.012);

  const w3c = sc[8];
  const y3c = sc[7];
  const w3r = sr[8];
  for (const s of [1, -1]) {
    q('pillar', [s * w3c, y3c, cowlZ], [s * (w3c - 0.11), y3c - 0.01, cowlZ - 0.04], [s * (w3r - 0.11), roofY - 0.03, roofZ - 0.04], [s * w3r, roofY, roofZ]);
    b.tri('pillar', [s * w3c, y3c, cowlZ], [s * halfIn, beltY, cowlZ - 0.06], [s * (w3c - 0.11), y3c - 0.01, cowlZ - 0.04]);
    q('panel', [s * halfIn, floorY, cowlZ - 0.04], [s * halfIn, floorY, eye.z - 0.95], [s * halfIn, beltY, eye.z - 0.95], [s * halfIn, beltY, cowlZ - 0.04]);
    q('dash', [s * halfIn, beltY, cowlZ - 0.04], [s * halfIn, beltY, eye.z - 0.95], [s * (halfIn + 0.07), beltY + 0.01, eye.z - 0.95], [s * (halfIn + 0.07), beltY + 0.01, cowlZ - 0.04]);
    b.box('trim', s * (halfIn - 0.01), beltY - 0.12, eye.z + 0.1, 0.03, 0.03, 0.18);
  }
  q('pillar', [-w3r, roofY, roofZ], [w3r, roofY, roofZ], [w3r - 0.02, roofY - 0.09, roofZ - 0.03], [-w3r + 0.02, roofY - 0.09, roofZ - 0.03]);
  q('liner', [-w3r, roofY - 0.02, roofZ], [w3r, roofY - 0.02, roofZ], [w3r, roofY - 0.02, roofZ - 1.6], [-w3r, roofY - 0.02, roofZ - 1.6]);
  b.box('dash', 0, roofY - 0.045, roofZ + 0.04, 0.16, 0.045, 0.025);
  q('mirror', [-0.07, roofY - 0.064, roofZ + 0.026], [0.07, roofY - 0.064, roofZ + 0.026], [0.07, roofY - 0.028, roofZ + 0.026], [-0.07, roofY - 0.028, roofZ + 0.026]);
  b.box('seat', -dx, floorY + 0.14, eye.z + 0.05, 0.48, 0.22, 0.48);
  b.box('seat', -dx, floorY + 0.52, eye.z - 0.22, 0.48, 0.65, 0.12);

  const o = { local: true };
  const dbl = { side: THREE.DoubleSide };
  const mats = {
    dash: psxLambert({ color: 0x222328, ...dbl, ...o }),
    trim: psxPhong({ color: 0x55585e, specular: 0x444444, shininess: 40, ...dbl, ...o }),
    vent: psxLambert({ color: 0x0c0d10, ...dbl, ...o }),
    pillar: psxLambert({ color: 0x2a2b30, ...dbl, ...o }),
    panel: psxLambert({ color: 0x302e2b, ...dbl, ...o }),
    liner: psxLambert({ color: 0x3e3c38, ...dbl, ...o }),
    floor: psxLambert({ color: 0x141518, ...dbl, ...o }),
    mirror: psxBasic({ color: 0x101622, ...dbl }),
    seat: psxLambert({ color: 0x24201e, ...dbl, ...o }),
    pod: psxLambert({ color: 0x18191d, ...dbl, ...o }),
    can: psxBasic({ color: 0x050506, ...dbl }),
    bezel: psxPhong({ color: 0x9a9ea6, specular: 0xffffff, shininess: 80, ...o }),
    needle: psxBasic({ color: 0xff5a1e, ...dbl }),
    lampOff: psxBasic({ color: 0x1a0c08 }),
  };
  const shell = b.mesh(mats);

  const group = new THREE.Group();
  group.name = 'cockpit';
  group.add(shell);
  /** @type {ReturnType<typeof makeGauge>[]} */
  const gauges = [];
  /** @type {THREE.Object3D[]} */
  const pods = [];
  const geos = [];
  const extras = [];
  let shiftLamp = null;
  let gear = null;
  let warn = null;
  for (const pod of DASHES[spec.id] || DASHES.hayate) {
    let center;
    let hood = 0;
    if (pod.pod === 'cluster') {
      center = new THREE.Vector3(dx, beltY - 0.065, dashBack - 0.06);
      hood = 0.07;
    } else if (pod.pod === 'top') {
      center = new THREE.Vector3(dx * 0.35, beltY + 0.05, dashBack + 0.08);
      hood = 0.03;
    } else {
      center = new THREE.Vector3(0, beltY - 0.13, dashBack - 0.07);
    }
    const frame = podFrame(center, eye);
    const pb = podShell(pod.w, pod.h, hood);
    const pm = pb.mesh({ pod: mats.pod });
    geos.push(pm.geometry);
    frame.add(pm);
    for (const spot of pod.gauges) {
      const gg = makeGauge(spot, spec, mats);
      frame.add(gg.grp);
      gauges.push(gg);
      geos.push(...gg.grp.children.map((c) => /** @type {THREE.Mesh} */ (c).geometry).filter(Boolean));
      extras.push(gg.faceMat, /** @type {THREE.Material} */ (gg.faceMat).map);
    }
    if (pod.pod === 'cluster') {
      const tach = pod.gauges.find((x) => x.type === 'tach') || pod.gauges[0];
      gear = textTexture(32, 32);
      const gm = psxBasic({ map: gear.tex });
      const gq = new THREE.Mesh(new THREE.PlaneGeometry(tach.r * 0.42, tach.r * 0.42), gm);
      gq.position.set(tach.u, tach.v - tach.r * 0.5, 0.011);
      frame.add(gq);
      extras.push(gm, gear.tex, gq.geometry);
      if (pod.shift) {
        shiftLamp = new THREE.Mesh(new THREE.PlaneGeometry(tach.r * 0.9, 0.008), psxBasic({ color: 0x1a0c08 }));
        shiftLamp.position.set(tach.u, tach.v + tach.r + 0.016, 0.004);
        frame.add(shiftLamp);
        extras.push(shiftLamp.material, shiftLamp.geometry);
      }
      warn = new THREE.Mesh(new THREE.PlaneGeometry(0.03, 0.012), psxBasic({ color: 0x1a0c08 }));
      warn.position.set(tach.u - tach.r * 0.55, tach.v - tach.r * 1.1, 0.004);
      frame.add(warn);
      extras.push(warn.material, warn.geometry);
    }
    frame.updateMatrixWorld(true);
    group.add(frame);
    pods.push(frame);
  }

  // Steering wheel: a rim with three spokes and a hub, low enough to see the gauges over it.
  const wheel = new THREE.Group();
  wheel.position.set(dx, eye.y - 0.45, eye.z + 0.4);
  wheel.rotation.x = -0.4;
  const spin = new THREE.Group();
  wheel.add(spin);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.019, 6, 24), mats.dash);
  const wb = new MeshBuilder();
  wb.box('s', 0, -0.09, 0, 0.045, 0.16, 0.02);
  wb.box('s', -0.1, -0.01, 0, 0.16, 0.035, 0.02);
  wb.box('s', 0.1, -0.01, 0, 0.16, 0.035, 0.02);
  wb.box('s', 0, -0.01, -0.012, 0.1, 0.075, 0.035);
  const spokes = wb.mesh({ s: mats.dash });
  spin.add(rim, spokes);
  group.add(wheel);
  group.visible = false;
  model.bodyRoot.add(group);

  return {
    group,
    wheel: spin,
    eye,
    gauges,
    /**
     * Moves the needles and lamps from the gauge readings. Needles chase their target a
     * little, like the real thing.
     * @param {ReturnType<typeof import('./gauges.js').createGauges>} g @param {number} dt @param {number} time
     */
    update(g, dt, time) {
      const oil = g.engineOn ? 1.2 + 4.6 * Math.min(1, g.rpm / spec.engine.redline) : 0;
      for (const gg of gauges) {
        const target =
          gg.type === 'tach' ? g.rpm
            : gg.type === 'speed' ? g.kmh
              : gg.type === 'fuel' ? g.fuel / spec.fuel.tank
                : gg.type === 'temp' ? g.temp
                  : gg.type === 'boost' ? (g.engineOn ? g.boost ?? g.intake ?? 0 : 0)
                    : gg.type === 'oil' ? oil
                      : g.engineOn ? 13.9 + 0.3 * Math.sin(time * 0.7) : 12.2;
        const rate = gg.type === 'tach' || gg.type === 'boost' ? 30 : 10;
        gg.value += (target - gg.value) * Math.min(1, rate * dt);
        gg.pivot.rotation.z = -needleAngle(gg.scale, gg.value);
      }
      if (gear) gear.set(g.gear, g.blown ? '#ff3020' : '#ffb020');
      if (shiftLamp) /** @type {THREE.MeshBasicMaterial} */ (shiftLamp.material).color.set(g.limiter && Math.floor(time * 12) % 2 ? 0x101010 : g.shift || g.limiter ? 0xff2a10 : 0x1a0c08);
      if (warn) {
        const on = g.blown ? Math.floor(time * 3) % 2 === 0 : g.damage > 0.3 || g.temp > 115 || !g.engineOn;
        /** @type {THREE.MeshBasicMaterial} */ (warn.material).color.set(on ? 0xffa010 : 0x1a0c08);
      }
    },
    dispose() {
      for (const x of [shell.geometry, rim.geometry, spokes.geometry, ...geos, ...Object.values(mats), ...extras]) x?.dispose();
    },
  };
}
