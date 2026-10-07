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
import { DASHES, dialAngle, gaugeScale, needleAngle } from './dash.js';
import { makeScreen } from './screens.js';
import { FACES, paintDial, readingOf } from './instruments.js';
import { FONT } from '../render/fonts.js';

export { DASHES, gaugeScale, needleAngle };

/** Steering wheel turns per radian of front wheel angle. */
export const STEER_RATIO = 4.5;
/**
 * The cockpit camera, solved per car (`cockpitCamera`): the road shows from `road` meters ahead
 * over the cowl, the camera never closer than `headroom` to the roof liner, and it pitches down
 * `pitch` radians so the horizon sits about a third of the way down the frame.
 */
export const COCKPIT_VIEW = { road: 5, forward: 0.25, headroom: 0.09, pitch: 0.17 };

/**
 * The instruments are small and set back, as in a real car: the cluster binnacle stands on the dash
 * top `ahead` meters past the dash lip, under the windshield, everything in it scaled by `scale`,
 * its hood a short dark tunnel `tunnel` (pod units) deep so the dials sit in a recess and read as
 * moving needles more than numbers. The other pods (a boost gauge on the dash, a center stack)
 * shrink by `others`. The wheel's rim rises to `wheelGap` radians under the binnacle as the camera
 * sees it, so the wheel frames the cluster from below.
 */
export const BINNACLE = { ahead: 0.12, scale: 0.58, tunnel: 0.15, others: 0.8, wheelGap: 0.085 };

/**
 * Where the cockpit camera sits for a car, in body space (y is the height above the ground):
 * `COCKPIT_VIEW.forward` ahead of the modeled eye (so the roof header leaves the top of the frame),
 * high enough that the sight line over the cowl meets the road
 * `COCKPIT_VIEW.road` meters ahead of the camera, capped under the roof.
 * @param {{ x: number, y: number, z: number }} eye @param {number} cowlY @param {number} cowlZ @param {number} roofY
 */
export function cockpitCamera(eye, cowlY, cowlZ, roofY) {
  const D = COCKPIT_VIEW.road;
  const z = eye.z + COCKPIT_VIEW.forward;
  const run = Math.max(0.3, cowlZ - z);
  // The sight line over the cowl hits the ground at y * run / (y - cowlY) meters; solve for D.
  const want = (D * cowlY) / Math.max(0.5, D - run);
  const y = Math.min(roofY - COCKPIT_VIEW.headroom, Math.max(eye.y, want));
  return { x: eye.x, y, z, pitch: COCKPIT_VIEW.pitch, hit: (y * run) / Math.max(0.01, y - cowlY) };
}

/** @typedef {import('./dash.js').GaugeSpot} GaugeSpot */

/**
 * A gauge face as a texture (`paintDial`); the faces with numerals get the larger canvas.
 * @param {import('./dash.js').GaugeType} type @param {import('./specs.js').CarSpec} spec @param {keyof typeof FACES} face
 */
function drawFace(type, spec, face = 'classic') {
  const S = FACES[face].numerals ? 192 : 128;
  const c = makeCanvas(S, S);
  paintDial(/** @type {CanvasRenderingContext2D} */ (c.getContext('2d')), S / 2, S / 2, S / 2, type, spec, face, true);
  return canvasTexture(c);
}

/** A small text texture, redrawn on change (the gear readout, the racing tach's speed). */
function textTexture(w, h, font = FONT.display, align = 'center') {
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
      g.textAlign = /** @type {CanvasTextAlign} */ (align);
      g.textBaseline = 'middle';
      g.font = `bold ${Math.floor(h * 0.8)}px ${font}`;
      g.fillText(text, align === 'right' ? w - 2 : w / 2, h / 2 + 1);
      tex.needsUpdate = true;
    },
  };
}

/**
 * A group whose local axes are u (driver's right), v (up) and n (toward the eye), scaled by `scale`.
 * @param {THREE.Vector3} center @param {THREE.Vector3} eye @param {number} [scale]
 */
function podFrame(center, eye, scale = 1) {
  const n = new THREE.Vector3().subVectors(eye, center).normalize();
  const u = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), n).normalize();
  const v = new THREE.Vector3().crossVectors(n, u);
  const grp = new THREE.Group();
  grp.matrixAutoUpdate = false;
  grp.matrix.makeBasis(u.multiplyScalar(scale), v.multiplyScalar(scale), n.multiplyScalar(scale)).setPosition(center);
  return grp;
}

/**
 * The pod shell in pod space: a backing plate, sides buried back into the dash, and a hood
 * arched over the top that reaches `hood` toward the driver. With `tunnel` the sides and a sill
 * also come forward that far, so the dials sit at the back of a recess.
 * @param {number} w @param {number} h @param {number} hood @param {boolean} [tunnel]
 */
function podShell(w, h, hood, tunnel = false) {
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
    if (tunnel) {
      const sx = hw + 0.012;
      const top = hh - 0.03;
      for (const s of [1, -1]) {
        b.quad('pod', [s * sx, -hh, 0], [s * sx, -hh, front], [s * sx, top, front], [s * sx, top, 0]);
        b.quad('pod', [s * sx, -hh, front], [s * (sx + 0.012), -hh, front], [s * (sx + 0.012), top, front], [s * sx, top, front]);
      }
      b.quad('pod', [-sx, -hh, 0], [sx, -hh, 0], [sx, -hh, front], [-sx, -hh, front]);
      b.quad('pod', [-sx, -hh - 0.012, front], [sx, -hh - 0.012, front], [sx, -hh, front], [-sx, -hh, front]);
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
  const faceMat = psxBasic({ map: drawFace(spot.type, spec, spot.face), color: 0xd8d8d8 });
  const face = new THREE.Mesh(new THREE.CircleGeometry(spot.r, 24), faceMat);
  const pivot = new THREE.Group();
  pivot.position.z = 0.006;
  const len = spot.r * 0.86;
  const w = Math.max(0.0022, spot.r * 0.06);
  const ng = new THREE.BufferGeometry();
  ng.setAttribute('position', new THREE.Float32BufferAttribute([-w, -spot.r * 0.18, 0, w, -spot.r * 0.18, 0, w * 0.35, len, 0, -w, -spot.r * 0.18, 0, w * 0.35, len, 0, -w * 0.35, len, 0], 3));
  const needle = new THREE.Mesh(ng, spot.face && spot.face !== 'classic' ? mats.needleRed : mats.needle);
  pivot.add(needle);
  const cap = new THREE.Mesh(new THREE.CircleGeometry(spot.r * 0.13, 10), mats.can);
  cap.position.z = 0.009;
  grp.add(can, bezel, face, pivot, cap);
  return { grp, pivot, scale: gaugeScale(spot.type, spec), type: spot.type, face: spot.face, faceMat, value: gaugeScale(spot.type, spec).min };
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
  const cam = cockpitCamera(eye, cowlY, cowlZ, roofY);
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
  q('pillar', [-w3r, roofY, roofZ], [w3r, roofY, roofZ], [w3r - 0.02, roofY - 0.05, roofZ - 0.03], [-w3r + 0.02, roofY - 0.05, roofZ - 0.03]);
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
    needleRed: psxBasic({ color: 0xd01010, ...dbl }),
    rim: psxPhong({ color: 0x4a4a52, specular: 0x666666, shininess: 30, ...o }),
    marker: psxBasic({ color: 0xf2c51c }),
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
  /** The live speed in a racing tach's LCD window. */
  let speedLcd = null;
  let gearColor = '#ffb020';
  let warn = null;
  /** @type {ReturnType<typeof makeScreen> | null} */
  let screen = null;
  /** The cluster binnacle's center and half height, for the wheel. */
  let binnacle = null;
  /** The nitrous strip at the binnacle's right edge: its fill grows up from the bottom. */
  let n2oFill = null;
  for (const pod of DASHES[spec.id] || DASHES.hayate) {
    let center;
    let hood = 0;
    let scale = BINNACLE.others;
    if (pod.pod === 'cluster') {
      // A small binnacle standing on the dash top under the windshield, its gauges in a recess.
      scale = BINNACLE.scale;
      const z = dashBack + BINNACLE.ahead;
      const t = (z - dashBack) / Math.max(0.05, cowlZ + 0.02 - dashBack);
      const top = beltY + (cowlY - beltY) * Math.min(1, t);
      center = new THREE.Vector3(dx, top + ((pod.h + 0.04) / 2) * scale, z);
      hood = BINNACLE.tunnel;
      binnacle = { center, half: ((pod.h + 0.04) / 2) * scale };
    } else if (pod.pod === 'top') {
      center = new THREE.Vector3(dx * 0.35, beltY + 0.05, dashBack + 0.08);
      hood = 0.03;
    } else {
      center = new THREE.Vector3(0, beltY - 0.13, dashBack - 0.07);
    }
    const frame = podFrame(center, eye, scale);
    const pb = podShell(pod.w, pod.h, hood, pod.pod === 'cluster');
    const pm = pb.mesh({ pod: mats.pod });
    geos.push(pm.geometry);
    frame.add(pm);
    if (pod.pod === 'cluster') {
      const len = pod.h * 0.7;
      const back = new THREE.Mesh(new THREE.PlaneGeometry(0.009, len + 0.004), psxBasic({ color: 0x06080c }));
      back.position.set(pod.w / 2 - 0.008, 0, 0.005);
      const fillGeo = new THREE.PlaneGeometry(0.006, len).translate(0, len / 2, 0);
      n2oFill = new THREE.Mesh(fillGeo, psxBasic({ color: 0x2a7cff }));
      n2oFill.position.set(pod.w / 2 - 0.008, -len / 2, 0.006);
      frame.add(back, n2oFill);
      extras.push(back.material, back.geometry, n2oFill.material, fillGeo);
    }
    if (pod.screen) {
      // One display instead of dials: it draws the gear, the shift light and the warnings itself.
      screen = makeScreen(pod.screen, spec, pod.w / pod.h);
      const sm = psxBasic({ map: screen.tex });
      const sq = new THREE.Mesh(new THREE.PlaneGeometry(pod.w, pod.h), sm);
      sq.position.z = 0.004;
      frame.add(sq);
      extras.push(sm, screen.tex, sq.geometry);
      frame.updateMatrixWorld(true);
      group.add(frame);
      pods.push(frame);
      continue;
    }
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
      if (tach.face === 'tuner') {
        // The racing tach: the gear small and white under the hub, the speed in its LCD window.
        gearColor = '#f4f8ff';
        gq.scale.setScalar(0.62);
        gq.position.set(tach.u - tach.r * 0.05, tach.v - tach.r * 0.3, 0.011);
        speedLcd = textTexture(64, 32, FONT.seg7, 'right');
        const sm = psxBasic({ map: speedLcd.tex });
        const sq = new THREE.Mesh(new THREE.PlaneGeometry(tach.r * 0.62, tach.r * 0.31), sm);
        sq.position.set(tach.u + tach.r * 0.45, tach.v - tach.r * 0.43, 0.011);
        frame.add(sq);
        extras.push(sm, speedLcd.tex, sq.geometry);
      }
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

  // Steering wheel: a rim with three spokes and a hub.
  const wheel = new THREE.Group();
  // Its rim's top sits just under the binnacle as the camera sees it, so the wheel frames the
  // cluster from below. The tilt brings the rim's top 0.18 sin 0.4 toward the driver and 0.18 cos 0.4
  // above the hub.
  const tilt = -0.4;
  const topZ = cam.z + 0.2;
  const under = binnacle
    ? Math.atan2(cam.y - (binnacle.center.y - binnacle.half), binnacle.center.z - cam.z) + BINNACLE.wheelGap
    : 0.6;
  const topY = cam.y - (topZ - cam.z) * Math.tan(under);
  wheel.position.set(dx, topY - 0.18 * Math.cos(tilt), topZ - 0.18 * Math.sin(tilt));
  wheel.rotation.x = tilt;
  const spin = new THREE.Group();
  wheel.add(spin);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.019, 6, 24), mats.rim);
  const wb = new MeshBuilder();
  wb.box('s', 0, -0.09, 0, 0.045, 0.16, 0.02);
  wb.box('s', -0.1, -0.01, 0, 0.16, 0.035, 0.02);
  wb.box('s', 0.1, -0.01, 0, 0.16, 0.035, 0.02);
  wb.box('s', 0, -0.01, -0.012, 0.1, 0.075, 0.035);
  // The racing marker at twelve o'clock, so the wheel reads against the dark dash and shows its turn.
  wb.box('m', 0, 0.178, 0.006, 0.01, 0.022, 0.04);
  const spokes = wb.mesh({ s: mats.trim, m: mats.marker });
  spin.add(rim, spokes);
  group.add(wheel);
  group.visible = false;
  model.bodyRoot.add(group);

  return {
    group,
    wheel: spin,
    eye,
    /** The camera's place and pitch in body space (`cockpitCamera`). */
    camera: cam,
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
        gg.pivot.rotation.z = -dialAngle(gg.scale, gg.value, gg.face);
      }
      if (screen) {
        screen.draw(readingOf(g, spec, time));
      }
      if (gear) gear.set(g.gear, g.blown ? '#ff3020' : gearColor);
      if (n2oFill) {
        n2oFill.visible = g.n2o > 0.001;
        n2oFill.scale.y = Math.max(0.001, g.n2o);
        /** @type {THREE.MeshBasicMaterial} */ (n2oFill.material).color.set(g.n2oOn ? 0x8fd8ff : 0x2a7cff);
      }
      if (speedLcd) speedLcd.set(String(Math.round(g.kmh)), '#f4f8ff');
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
