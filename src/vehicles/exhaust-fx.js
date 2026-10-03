/**
 * Flames, sparks and smoke at a car's tailpipes, drawn from the numbers in `exhaust.js`.
 * Flames are crossed additive fins parented to the body so they lean with it. Sparks and
 * smoke are pooled points in world space (`group`, which the caller adds to the scene root)
 * so they hang in the air behind a moving car.
 */

import * as THREE from 'three';
import { patchPsx, psxUniforms } from '../render/psx.js';

/**
 * Where each car's pipes end, in body space: x (local +X is the car's left), y, z.
 * A body that carries its own `exhaust` list wins.
 * @type {Record<string, number[][]>}
 */
const TIPS = {
  hayate: [[-0.5, 0.27, -2.52]],
  rampart: [[0.62, 0.28, -2.81], [-0.62, 0.28, -2.81]],
  vespera: [[0.1, 0.39, -1.99], [-0.1, 0.39, -1.99], [0.26, 0.39, -1.99], [-0.26, 0.39, -1.99]],
  tsurugi: [[0.3, 0.34, -2.54], [-0.3, 0.34, -2.54], [0.54, 0.34, -2.54], [-0.54, 0.34, -2.54]],
};

const SPARKS = 64;
const SMOKE = 40;
const SPARK_RATE = 80;
const SMOKE_RATE = 16;

/** Two crossed fins pointing down -Z: hot yellow at the pipe, fading to black (invisible when added). */
function flameGeometry() {
  const pos = [];
  const col = [];
  const fin = (hot, len, w, vertical) => {
    const a = vertical ? [0, -w, 0] : [-w, 0, 0];
    const b = vertical ? [0, w, 0] : [w, 0, 0];
    pos.push(...a, ...b, 0, 0, -len);
    col.push(...hot, ...hot, 0, 0, 0);
  };
  for (const v of [false, true]) {
    fin([1, 0.55, 0.12], 1, 0.13, v);
    fin([1, 0.95, 0.75], 0.55, 0.07, v);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return g;
}

const SMOKE_VERT = /* glsl */ `
uniform vec2 uSnap;
attribute float aSize;
attribute float aAlpha;
varying float vAlpha;
void main() {
  vAlpha = aAlpha;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = min(64.0, aSize * projectionMatrix[1][1] * uSnap.y * 0.5 / max(-mv.z, 0.1));
}
`;

const SMOKE_FRAG = /* glsl */ `
uniform vec3 uColor;
varying float vAlpha;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float a = (1.0 - smoothstep(0.3, 1.0, d)) * vAlpha;
  if (a < 0.01) discard;
  gl_FragColor = vec4(uColor, a);
}
`;

export class ExhaustFx {
  /** @param {import('./models.js').CarModel} model */
  constructor(model) {
    this.model = model;
    const own = /** @type {any} */ (model.def).exhaust;
    const tips = own || TIPS[model.spec.id] || [[0, 0.3, -model.spec.length / 2]];
    this.tips = tips.map((t) => new THREE.Vector3(t[0], t[1], t[2]));
    this.group = new THREE.Group();
    this.group.name = 'exhaust-fx';

    this.flameGeo = flameGeometry();
    this.flameMat = patchPsx(new THREE.MeshBasicMaterial({
      vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false,
    }));
    this.flames = this.tips.map((t) => {
      const m = new THREE.Mesh(this.flameGeo, this.flameMat);
      m.position.copy(t);
      m.visible = false;
      m.frustumCulled = false;
      model.bodyRoot.add(m);
      return m;
    });

    this.sparkPos = new Float32Array(SPARKS * 3).fill(0);
    this.sparkCol = new Float32Array(SPARKS * 3).fill(0);
    this.sparkVel = new Float32Array(SPARKS * 3);
    this.sparkLife = new Float32Array(SPARKS);
    this.sparkMax = new Float32Array(SPARKS).fill(1);
    this.sparkGeo = new THREE.BufferGeometry();
    this.sparkGeo.setAttribute('position', new THREE.BufferAttribute(this.sparkPos, 3));
    this.sparkGeo.setAttribute('color', new THREE.BufferAttribute(this.sparkCol, 3));
    this.sparkMat = new THREE.PointsMaterial({
      size: 2, sizeAttenuation: false, vertexColors: true, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, fog: false,
    });
    this.sparks = new THREE.Points(this.sparkGeo, this.sparkMat);
    this.sparks.frustumCulled = false;
    this.group.add(this.sparks);

    this.smokePos = new Float32Array(SMOKE * 3).fill(0);
    this.smokeSize = new Float32Array(SMOKE);
    this.smokeAlpha = new Float32Array(SMOKE);
    this.smokeVel = new Float32Array(SMOKE * 3);
    this.smokeAge = new Float32Array(SMOKE).fill(99);
    this.smokeLife = new Float32Array(SMOKE).fill(1);
    this.smokeBase = new Float32Array(SMOKE).fill(0);
    this.smokeGeo = new THREE.BufferGeometry();
    this.smokeGeo.setAttribute('position', new THREE.BufferAttribute(this.smokePos, 3));
    this.smokeGeo.setAttribute('aSize', new THREE.BufferAttribute(this.smokeSize, 1));
    this.smokeGeo.setAttribute('aAlpha', new THREE.BufferAttribute(this.smokeAlpha, 1));
    this.smokeMat = new THREE.ShaderMaterial({
      uniforms: { uSnap: psxUniforms.uSnap, uColor: { value: new THREE.Color(0.2, 0.2, 0.22) } },
      vertexShader: SMOKE_VERT,
      fragmentShader: SMOKE_FRAG,
      transparent: true,
      depthWrite: false,
    });
    this.smoke = new THREE.Points(this.smokeGeo, this.smokeMat);
    this.smoke.frustumCulled = false;
    this.group.add(this.smoke);

    this.sparkAcc = 0;
    this.smokeAcc = 0;
    this.seed = 7;
  }

  rand() {
    this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }

  /**
   * @param {ReturnType<typeof import('./physics.js').createVehicleState>} s
   * @param {number} dt
   */
  update(s, dt) {
    const fx = s.fx;
    const group = this.model.group;
    const lit = fx.flame > 0.03;
    for (const m of this.flames) {
      m.visible = lit;
      if (lit) {
        const flick = 0.75 + 0.5 * this.rand();
        m.scale.set(0.6 + 0.6 * fx.flame, 0.6 + 0.6 * fx.flame, (0.35 + 1.15 * fx.flame) * flick);
      }
    }
    const wantSparks = fx.sparks > 0.01;
    const wantSmoke = fx.smoke > 0.02;
    if (wantSparks || wantSmoke) group.updateMatrixWorld(true);
    const bx = -Math.sin(s.yaw);
    const bz = -Math.cos(s.yaw);

    if (wantSparks) {
      this.sparkAcc += fx.sparks * SPARK_RATE * dt;
      while (this.sparkAcc >= 1) {
        this.sparkAcc -= 1;
        this.emitSpark(s, bx, bz);
      }
    } else this.sparkAcc = 0;
    if (wantSmoke) {
      this.smokeAcc += fx.smoke * SMOKE_RATE * dt;
      while (this.smokeAcc >= 1) {
        this.smokeAcc -= 1;
        this.emitSmoke(s, bx, bz, fx.smoke);
      }
    } else this.smokeAcc = 0;

    let sparksLive = false;
    for (let i = 0; i < SPARKS; i++) {
      if (this.sparkLife[i] <= 0) continue;
      this.sparkLife[i] -= dt;
      const i3 = i * 3;
      if (this.sparkLife[i] <= 0) {
        this.sparkPos[i3 + 1] = -1000;
        this.sparkCol[i3] = this.sparkCol[i3 + 1] = this.sparkCol[i3 + 2] = 0;
        continue;
      }
      sparksLive = true;
      this.sparkVel[i3 + 1] -= 9.8 * 0.7 * dt;
      this.sparkPos[i3] += this.sparkVel[i3] * dt;
      this.sparkPos[i3 + 1] += this.sparkVel[i3 + 1] * dt;
      this.sparkPos[i3 + 2] += this.sparkVel[i3 + 2] * dt;
      const k = Math.max(0, this.sparkLife[i] / this.sparkMax[i]);
      this.sparkCol[i3] = 1;
      this.sparkCol[i3 + 1] = 0.35 + 0.5 * k;
      this.sparkCol[i3 + 2] = 0.08 + 0.3 * k * k;
      this.sparkCol[i3] *= 0.4 + 0.6 * k;
      this.sparkCol[i3 + 1] *= 0.4 + 0.6 * k;
      this.sparkCol[i3 + 2] *= 0.4 + 0.6 * k;
    }
    this.sparks.visible = sparksLive || wantSparks;
    if (this.sparks.visible) {
      this.sparkGeo.attributes.position.needsUpdate = true;
      this.sparkGeo.attributes.color.needsUpdate = true;
    }

    let smokeLive = false;
    for (let i = 0; i < SMOKE; i++) {
      if (this.smokeAge[i] >= this.smokeLife[i]) continue;
      this.smokeAge[i] += dt;
      const i3 = i * 3;
      const u = this.smokeAge[i] / this.smokeLife[i];
      if (u >= 1) {
        this.smokeAlpha[i] = 0;
        this.smokePos[i3 + 1] = -1000;
        continue;
      }
      smokeLive = true;
      this.smokeVel[i3] *= 1 - 0.8 * dt;
      this.smokeVel[i3 + 2] *= 1 - 0.8 * dt;
      this.smokePos[i3] += this.smokeVel[i3] * dt;
      this.smokePos[i3 + 1] += this.smokeVel[i3 + 1] * dt;
      this.smokePos[i3 + 2] += this.smokeVel[i3 + 2] * dt;
      this.smokeSize[i] = 0.3 + 1.7 * Math.sqrt(u);
      this.smokeAlpha[i] = this.smokeBase[i] * Math.pow(1 - u, 1.3) * Math.min(1, u * 9);
    }
    this.smoke.visible = smokeLive || wantSmoke;
    if (this.smoke.visible) {
      this.smokeGeo.attributes.position.needsUpdate = true;
      this.smokeGeo.attributes.aSize.needsUpdate = true;
      this.smokeGeo.attributes.aAlpha.needsUpdate = true;
    }
  }

  /** World position of a random pipe tip into `out`. @param {THREE.Vector3} out */
  tipWorld(out) {
    out.copy(this.tips[Math.floor(this.rand() * this.tips.length) % this.tips.length]);
    return this.model.bodyRoot.localToWorld(out);
  }

  emitSpark(s, bx, bz) {
    let i = 0;
    while (i < SPARKS && this.sparkLife[i] > 0) i++;
    if (i === SPARKS) return;
    const p = this.tipWorld(new THREE.Vector3());
    const i3 = i * 3;
    const kick = 3 + 6 * this.rand();
    this.sparkPos[i3] = p.x;
    this.sparkPos[i3 + 1] = p.y;
    this.sparkPos[i3 + 2] = p.z;
    this.sparkVel[i3] = s.vx * 0.9 + bx * kick + (this.rand() - 0.5) * 3;
    this.sparkVel[i3 + 1] = 0.5 + 2.5 * this.rand();
    this.sparkVel[i3 + 2] = s.vz * 0.9 + bz * kick + (this.rand() - 0.5) * 3;
    this.sparkMax[i] = this.sparkLife[i] = 0.25 + 0.35 * this.rand();
  }

  emitSmoke(s, bx, bz, amount) {
    let i = 0;
    while (i < SMOKE && this.smokeAge[i] < this.smokeLife[i]) i++;
    if (i === SMOKE) return;
    const p = this.tipWorld(new THREE.Vector3());
    const i3 = i * 3;
    this.smokePos[i3] = p.x;
    this.smokePos[i3 + 1] = p.y;
    this.smokePos[i3 + 2] = p.z;
    const kick = 0.6 + 1.2 * this.rand();
    this.smokeVel[i3] = s.vx * 0.5 + bx * kick + (this.rand() - 0.5) * 0.6;
    this.smokeVel[i3 + 1] = 0.5 + 0.5 * this.rand();
    this.smokeVel[i3 + 2] = s.vz * 0.5 + bz * kick + (this.rand() - 0.5) * 0.6;
    this.smokeAge[i] = 0;
    this.smokeLife[i] = 1.6 + 0.9 * this.rand();
    this.smokeBase[i] = 0.3 + 0.4 * amount;
    this.smokeSize[i] = 0.3;
  }

  dispose() {
    this.model.bodyRoot.remove(...this.flames);
    this.flameGeo.dispose();
    this.flameMat.dispose();
    this.sparkGeo.dispose();
    this.sparkMat.dispose();
    this.smokeGeo.dispose();
    this.smokeMat.dispose();
  }
}
