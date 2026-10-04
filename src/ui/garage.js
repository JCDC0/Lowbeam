/**
 * The garage: a dark showroom with a turntable, the chosen car on it and the Most
 * Wanted style card beside it (name, class, three bars, drivetrain, paint). Left and
 * right change the car, up and down change the paint, confirm drives.
 */

import * as THREE from 'three';
import { CARS } from '../vehicles/specs.js';
import { CarModel } from '../vehicles/models.js';
import { MeshBuilder } from '../render/builder.js';
import { psxBasic, psxLambert, psxPhong, psxUniforms } from '../render/psx.js';
import { store } from '../core/store.js';
import { damp } from '../core/mathx.js';
import { clusterStyleOf } from './cluster-styles.js';

const BAR_LABELS = { topSpeed: 'TOP SPEED', handling: 'HANDLING', accel: 'ACCELERATION' };
const CLUSTER_NAMES = { classic: 'CLASSIC', twin: 'TWIN DIAL', sport: 'SPORT TACH', digital: 'DIGITAL LCD', vfd: '1984 VFD' };

function buildRoom() {
  const b = new MeshBuilder();
  b.cylinder('floor', 0, -0.05, 0, 16, 0.1, 24, 'y', { caps: true });
  b.cylinder('table', 0, 0.05, 0, 3.1, 0.1, 32, 'y');
  b.cylinder('trim', 0, 0.03, 0, 3.16, 0.06, 32, 'y', { caps: false });
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    b.box('dot', Math.cos(a) * 3.165, 0.03, Math.sin(a) * 3.165, 0.07, 0.03, 0.07);
  }
  const room = b.mesh({
    floor: psxPhong({ color: 0x15171b, specular: 0x202428, shininess: 20 }),
    table: psxPhong({ color: 0x2a2e35, specular: 0x30343a, shininess: 30 }),
    trim: psxLambert({ color: 0x0c0d10 }),
    dot: psxBasic({ color: 0xffb43c }),
  });

  const w = new MeshBuilder();
  w.cylinder('wall', 0, 3.5, 0, 15, 7, 24, 'y', { caps: false });
  for (const [y, h] of [[0.5, 0.05], [2.6, 0.08], [2.75, 0.03]]) w.cylinder('neon', 0, y, 0, 14.95, h, 24, 'y', { caps: false });
  const wallMat = psxLambert({ color: 0x0d1015, side: THREE.BackSide });
  const neonMat = psxBasic({ color: 0x2aa8d8, side: THREE.BackSide });
  const walls = w.mesh({ wall: wallMat, neon: neonMat });
  const g = new THREE.Group();
  g.add(room, walls);
  return g;
}

export class Garage {
  /** @param {HTMLElement} ui */
  constructor(ui) {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x020306);
    this.scene.fog = new THREE.Fog(0x020306, 9, 22);
    this.camera = new THREE.PerspectiveCamera(36, 4 / 3, 0.1, 60);
    this.scene.add(buildRoom());

    this.scene.add(new THREE.HemisphereLight(0x8696b8, 0x0a0a0c, 0.7));
    const spot = new THREE.SpotLight(0xfff2de, 140, 0, 0.55, 0.65, 2);
    spot.position.set(0.4, 7.5, 1.2);
    spot.target.position.set(0, 0, 0);
    this.scene.add(spot, spot.target);
    const key = new THREE.DirectionalLight(0xffe8cc, 0.9);
    key.position.set(4, 3, 5);
    this.scene.add(key);
    const rimA = new THREE.PointLight(0x46c8ff, 26, 0, 2);
    rimA.position.set(-4.5, 1.6, -3.5);
    const rimB = new THREE.PointLight(0xffa040, 20, 0, 2);
    rimB.position.set(4.5, 1.2, -4);
    this.scene.add(rimA, rimB);

    this.table = new THREE.Group();
    this.scene.add(this.table);
    /** @type {Record<string, number>} */
    this.paints = store.get('paints', {});
    this.models = CARS.map((spec) => {
      const m = new CarModel(spec, this.paints[spec.id] || 0);
      const mid = (m.kit.zMin + m.kit.zMax) / 2;
      m.group.position.z = -mid;
      m.group.visible = false;
      this.table.add(m.group);
      return m;
    });
    this.index = Math.min(store.get('car', 0), CARS.length - 1);
    this.models[this.index].group.visible = true;
    this.spin = 0.6;
    this.spinRate = 0.32;
    this.orbit = 0;
    this.focus = 1;

    this.el = document.createElement('section');
    this.el.id = 'garage';
    this.el.className = 'screen';
    ui.appendChild(this.el);
    this.el.innerHTML = `
      <div class="head"><div class="label">GARAGE</div><div class="count"></div></div>
      <button class="arrow l display" data-go="-1">&lt;</button>
      <button class="arrow r display" data-go="1">&gt;</button>
      <div class="card">
        <div class="maker"></div>
        <div class="name"></div>
        <div class="klass"></div>
        <div class="blurb"></div>
        <div class="bars"></div>
        <div class="spec"></div>
        <div class="paint"></div>
      </div>
      <div class="hints"><b>&lt; &gt;</b>CAR<b>^ v</b>PAINT<b>ENTER</b>DRIVE<b>ESC</b>BACK</div>`;
    /** @type {string | null} */
    this.clicked = null;
    this.el.addEventListener('click', (e) => {
      const t = /** @type {HTMLElement} */ (e.target).closest('[data-go],[data-paint]');
      if (!t) return;
      const el = /** @type {HTMLElement} */ (t);
      if (el.dataset.go) this.select(this.index + Number(el.dataset.go));
      if (el.dataset.paint) this.paint(Number(el.dataset.paint));
    });
    this.fill();
  }

  get model() {
    return this.models[this.index];
  }

  get spec() {
    return CARS[this.index];
  }

  /** @param {number} i */
  select(i) {
    const n = CARS.length;
    this.model.group.visible = false;
    this.index = ((i % n) + n) % n;
    this.model.group.visible = true;
    this.spinRate = 2.4;
    store.set('car', this.index);
    this.fill();
  }

  /** @param {number} i */
  paint(i) {
    const n = this.spec.paints.length;
    const p = ((i % n) + n) % n;
    this.model.setPaint(p);
    this.paints[this.spec.id] = p;
    store.set('paints', this.paints);
    this.fill();
  }

  fill() {
    const s = this.spec;
    const q = (sel) => /** @type {HTMLElement} */ (this.el.querySelector(sel));
    const isManual = store.get('transmission', /** @type {string} */ ('auto')) === 'manual';
    const trans = isManual ? 'MANUAL' : 'AUTO';
    q('.count').textContent = `${this.index + 1} / ${CARS.length}`;
    q('.maker').textContent = s.maker;
    q('.name').textContent = s.name;
    q('.klass').textContent = s.klass;
    q('.blurb').textContent = s.blurb;
    q('.bars').innerHTML = Object.entries(BAR_LABELS)
      .map(([k, label]) => {
        const v = Math.min(10, Math.max(0, Math.round(s.bars[k])));
        const cells = Array.from({ length: 10 }, (_, i) => `<i class="${i < v ? 'on' : ''}"></i>`).join('');
        return `<div class="bar"><span class="k">${label}</span><span class="v">${cells}</span></div>`;
      })
      .join('');
    const styleKey = clusterStyleOf(s);
    const styleName = CLUSTER_NAMES[styleKey] ?? styleKey.toUpperCase();
    q('.spec').innerHTML = `
      <span class="k">LAYOUT</span><span>${s.layout}</span>
      <span class="k">ENGINE</span><span>${s.engineLabel}</span>
      <span class="k">GEARBOX</span><span>${s.gears.length}-SPEED ${trans}</span>
      <span class="k">CLUSTER</span><span>${styleName}</span>
      <span class="k">WEIGHT</span><span>${s.mass.toLocaleString('en-US')} kg</span>`;
    const pi = this.model.paintIndex;
    const hex = (c) => `#${c.toString(16).padStart(6, '0')}`;
    q('.paint').innerHTML =
      s.paints.map((p, i) => `<span class="sw click${i === pi ? ' sel' : ''}" data-paint="${i}" style="background:${hex(p.color)}"></span>`).join('') +
      `<span class="pname">${s.paints[pi].name}</span>`;
  }

  /** @param {boolean} on */
  show(on) {
    if (on) this.fill();
    this.el.classList.toggle('on', on);
  }

  /**
   * @param {number} dt
   * @param {import('../core/input.js').Input | null} input null on the title screen
   * @returns {'drive' | 'back' | null}
   */
  update(dt, input) {
    this.spinRate = damp(this.spinRate, 0.32, 2.5, dt);
    this.spin += this.spinRate * dt;
    this.table.rotation.y = this.spin;
    this.orbit += dt;
    this.focus = damp(this.focus, input ? 1 : 0, 3, dt);
    if (!input) return null;
    if (input.pressed('left')) this.select(this.index - 1);
    if (input.pressed('right')) this.select(this.index + 1);
    if (input.pressed('up')) this.paint(this.model.paintIndex - 1);
    if (input.pressed('down')) this.paint(this.model.paintIndex + 1);
    if (input.pressed('confirm')) return 'drive';
    if (input.pressed('back')) return 'back';
    return null;
  }

  /** @param {ReturnType<typeof import('../render/stage.js').createStage>} stage */
  render(stage) {
    const cam = this.camera;
    if (cam.aspect !== stage.camera.aspect) {
      cam.aspect = stage.camera.aspect;
      cam.updateProjectionMatrix();
    }
    // Title: a slow low orbit with the car centered. Garage: fixed three-quarter view
    // with the car pushed left of the card.
    const f = this.focus;
    const a = 0.75 + Math.sin(this.orbit * 0.15) * 0.3 * (1 - f);
    const d = 11 - 1.4 * f;
    cam.position.set(Math.sin(a) * d, 0.9 + 0.9 * f, Math.cos(a) * d);
    // Center the car in the part of the screen the card leaves free.
    const w = window.innerWidth;
    const card = w > 720 ? Math.min(400, 0.38 * w) / w : 0;
    const side = card * d * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)) * cam.aspect * f;
    cam.lookAt(Math.cos(a) * side, 1.9 - 1.4 * f, -Math.sin(a) * side);
    psxUniforms.uLocalColor.value.setRGB(0, 0, 0);
    stage.render(this.scene, cam);
  }
}
