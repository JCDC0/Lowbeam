/**
 * PS1-style materials. Every lit material in the game comes from here so they all share:
 *  - vertex snapping to the low-res pixel grid (the wobble),
 *  - optional per-vertex baked light (`bake` attribute) added on top of real lights,
 *  - optional local light: one color and direction for things that move (the player's
 *    car), sampled each frame from the same baked lights the world uses.
 */

import * as THREE from 'three';

/** Headlight beams the world shader takes from moving cars. */
export const BEAMS = 16;

/** Shared uniforms. stage.js writes the snap grid size when the render target resizes. */
export const psxUniforms = {
  uSnap: { value: new THREE.Vector2(320, 240) },
  uSnapOn: { value: 1 },
  /** Baked light around the player, linear rgb. */
  uLocalColor: { value: new THREE.Color(0, 0, 0) },
  /** Direction toward that light in view space. */
  uLocalDir: { value: new THREE.Vector3(0, 1, 0) },
  /** Per-pixel light pools (pools.js): every light, and a grid of which lights reach each cell. */
  uPoolLights: { value: /** @type {THREE.DataTexture | null} */ (null) },
  uPoolCells: { value: /** @type {THREE.DataTexture | null} */ (null) },
  /** Grid origin x and z, cell size, cells per side. */
  uPoolGrid: { value: new THREE.Vector4(0, 0, 24, 0) },
  /** 1 once installPools has run; until then baked materials use the `bake` attribute. */
  uPoolsOn: { value: 0 },
  /**
   * Moving lights (traffic/render.js, heli-view.js): headlight beams, police light bars, lit
   * indicators, the searchlight. Position and range, then direction and the cosine where the cone
   * ends, then the color (rgb). A range of 0 ends the list; a black slot is a light that is off.
   */
  uBeamPos: { value: Array.from({ length: BEAMS }, () => new THREE.Vector4()) },
  uBeamDir: { value: Array.from({ length: BEAMS }, () => new THREE.Vector4()) },
  uBeamCol: { value: Array.from({ length: BEAMS }, () => new THREE.Vector4(1, 0.94, 0.8, 0)) },
};

/**
 * Adds the moving lights (the beams) at a point to a light color and direction, the way the world
 * shader lights a surface there, so the player's car takes the red and blue of a light bar beside
 * it. `dir` is a unit vector toward the light, blended by how much each beam adds.
 * @param {number} x @param {number} y @param {number} z @param {THREE.Color} color @param {THREE.Vector3} dir
 */
export function addBeamLight(x, y, z, color, dir) {
  const pos = psxUniforms.uBeamPos.value;
  const bd = psxUniforms.uBeamDir.value;
  const col = psxUniforms.uBeamCol.value;
  const base = color.r + color.g + color.b;
  let wx = dir.x * base;
  let wy = dir.y * base;
  let wz = dir.z * base;
  for (let b = 0; b < BEAMS; b++) {
    const B = pos[b];
    if (B.w <= 0) break;
    const dx = B.x - x;
    const dy = B.y - y;
    const dz = B.z - z;
    const d = Math.hypot(dx, dy, dz);
    if (d >= B.w || d < 1e-3) continue;
    const toward = -(dx * bd[b].x + dy * bd[b].y + dz * bd[b].z) / d;
    const lo = bd[b].w;
    const hi = lo + (1 - lo) * 0.45;
    const t = Math.min(1, Math.max(0, (toward - lo) / (hi - lo)));
    const r = d / B.w;
    const e = t * t * (3 - 2 * t) * (1 - r) * (1 - r) * 1.6;
    if (e <= 0) continue;
    color.r += col[b].x * e;
    color.g += col[b].y * e;
    color.b += col[b].z * e;
    const k = e * (col[b].x + col[b].y + col[b].z) / d;
    wx += dx * k;
    wy += dy * k;
    wz += dz * k;
  }
  const n = Math.hypot(wx, wy, wz);
  if (n > 1e-6) dir.set(wx / n, wy / n, wz / n);
}

/**
 * The pools in the fragment shader. A light with `spot` 1 is a street lamp head: it lights a
 * cone under it, full inside about 50 degrees from straight down and fading out by 66, with a
 * faint spill beyond so the road between lamps is not black. The rest are round point lights.
 * The light is cut into bands (POOL_BANDS steps) the way the PS1 shaded, which is what makes a
 * pool read as a shape on the road rather than a smooth glow.
 */
const POOL_FRAGMENT = /* glsl */ `
uniform sampler2D uPoolLights;
uniform sampler2D uPoolCells;
uniform vec4 uPoolGrid;
uniform float uPoolsOn;
uniform vec4 uBeamPos[BEAMS];
uniform vec4 uBeamDir[BEAMS];
uniform vec4 uBeamCol[BEAMS];
varying vec3 vPoolPos;
varying vec3 vPoolN;
vec3 beamLight(vec3 p, vec3 n) {
  vec3 sum = vec3(0.0);
  for (int b = 0; b < BEAMS; b++) {
    vec4 B = uBeamPos[b];
    if (B.w <= 0.0) break;
    vec3 dv = B.xyz - p;
    float d = length(dv);
    if (d >= B.w) continue;
    vec3 l = dv / max(d, 0.001);
    float cone = smoothstep(uBeamDir[b].w, mix(uBeamDir[b].w, 1.0, 0.45), dot(-l, uBeamDir[b].xyz));
    float r = d / B.w;
    float e = cone * (1.0 - r) * (1.0 - r) * 1.6;
    e = floor(e * POOL_BANDS + 0.35) / POOL_BANDS;
    sum += uBeamCol[b].rgb * e * clamp((dot(n, l) + 0.3) / 1.3, 0.0, 1.0);
  }
  return sum;
}
vec3 poolLight(vec3 p, vec3 n) {
  vec3 sum = beamLight(p, n);
  vec2 c = floor((p.xz - uPoolGrid.xy) / uPoolGrid.z);
  if (c.x < 0.0 || c.y < 0.0 || c.x >= uPoolGrid.w || c.y >= uPoolGrid.w) return sum;
  for (int t = 0; t < 3; t++) {
    vec4 ids = texelFetch(uPoolCells, ivec2(int(c.x) * 3 + t, int(c.y)), 0);
    for (int k = 0; k < 4; k++) {
      float id = ids[k];
      if (id < 0.0) return sum;
      int i = int(id + 0.5);
      ivec2 a = ivec2((i % 1024) * 2, i / 1024);
      vec4 L0 = texelFetch(uPoolLights, a, 0);
      vec4 L1 = texelFetch(uPoolLights, a + ivec2(1, 0), 0);
      vec3 dv = L0.xyz - p;
      float d = length(dv);
      if (d >= L0.w) continue;
      vec3 l = dv / max(d, 0.001);
      float lam = clamp((dot(n, l) + 0.45) / 1.45, 0.0, 1.0);
      float r = d / L0.w;
      float e;
      if (L1.w > 0.5) {
        float cone = smoothstep(0.41, 0.66, l.y);
        e = mix(0.12, 1.0, cone) * (1.0 - r * r) * (1.0 - r * r) * 0.62;
      } else {
        e = (1.0 - r) * (1.0 - r);
      }
      e = floor(e * POOL_BANDS + 0.35) / POOL_BANDS;
      sum += L1.rgb * e * lam;
    }
  }
  return sum;
}
`;
const POOL_BANDS = 7;

const SNAP_VERTEX = /* glsl */ `
#include <project_vertex>
if (uSnapOn > 0.5 && gl_Position.w > 0.0) {
  vec2 grid = uSnap * 0.5;
  vec4 p = gl_Position;
  p.xy = floor(p.xy / p.w * grid + 0.5) / grid * p.w;
  gl_Position = p;
}
`;

/**
 * @param {THREE.Material} mat
 * @param {{ baked?: boolean, local?: boolean, lamp?: boolean, paint?: boolean }} opts
 *   `lamp` reads a `lamp` vertex color that is added as emissive light, scaled up on red
 *   lamps by an instanced `aBrake` attribute (brake lights). `paint` limits the instance
 *   color to the vertices whose `aPaint` attribute is 1, so glass and trim keep their color.
 */
export function patchPsx(mat, { baked = false, local = false, lamp = false, paint = false } = {}) {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uSnap = psxUniforms.uSnap;
    shader.uniforms.uSnapOn = psxUniforms.uSnapOn;
    let vs = 'uniform vec2 uSnap;\nuniform float uSnapOn;\n' + shader.vertexShader;
    vs = vs.replace('#include <project_vertex>', SNAP_VERTEX);
    let fs = shader.fragmentShader;
    let extra = '';
    if (baked) {
      for (const k of ['uPoolLights', 'uPoolCells', 'uPoolGrid', 'uPoolsOn', 'uBeamPos', 'uBeamDir', 'uBeamCol']) shader.uniforms[k] = psxUniforms[k];
      vs = 'attribute vec3 bake;\nvarying vec3 vBake;\nvarying vec3 vPoolPos;\nvarying vec3 vPoolN;\n' + vs;
      vs = vs.replace('#include <begin_vertex>', `#include <begin_vertex>
vBake = bake;
vec4 poolW = vec4(transformed, 1.0);
vec3 poolN = objectNormal;
#ifdef USE_INSTANCING
poolW = instanceMatrix * poolW;
poolN = mat3(instanceMatrix) * poolN;
#endif
poolW = modelMatrix * poolW;
vPoolPos = poolW.xyz;
vPoolN = normalize(mat3(modelMatrix) * poolN);`);
      fs = `varying vec3 vBake;\n#define POOL_BANDS ${POOL_BANDS.toFixed(1)}\n#define BEAMS ${BEAMS}\n${POOL_FRAGMENT}${fs}`;
      extra += '\ntotalEmissiveRadiance += (uPoolsOn > 0.5 ? poolLight(vPoolPos, normalize(vPoolN)) : vBake) * diffuseColor.rgb;';
    }
    if (lamp) {
      vs = 'attribute vec3 lamp;\nattribute float aBrake;\nvarying vec3 vLamp;\n' + vs;
      vs = vs.replace('#include <begin_vertex>', '#include <begin_vertex>\nfloat tailLamp = step(0.2, lamp.r - lamp.g - lamp.b);\nvLamp = lamp * (1.0 + tailLamp * 2.6 * aBrake);');
      fs = 'varying vec3 vLamp;\n' + fs;
      extra += '\ntotalEmissiveRadiance += vLamp;';
    }
    if (paint) {
      vs = 'attribute float aPaint;\n' + vs;
      vs = vs.replace('#include <color_vertex>', '#include <color_vertex>\n#ifdef USE_INSTANCING_COLOR\nvColor.rgb = color * mix(vec3(1.0), instanceColor.rgb, aPaint);\n#endif');
    }
    if (local) {
      shader.uniforms.uLocalColor = psxUniforms.uLocalColor;
      shader.uniforms.uLocalDir = psxUniforms.uLocalDir;
      fs = 'uniform vec3 uLocalColor;\nuniform vec3 uLocalDir;\n' + fs;
      extra += '\ntotalEmissiveRadiance += uLocalColor * diffuseColor.rgb * (0.3 + 0.7 * max(dot(normal, uLocalDir), 0.0));';
    }
    fs = fs.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>' + extra);
    shader.vertexShader = vs;
    shader.fragmentShader = fs;
  };
  mat.customProgramCacheKey = () => `psx${baked ? '-baked' : ''}${local ? '-local' : ''}${lamp ? '-lamp' : ''}${paint ? '-paint' : ''}`;
  return mat;
}

/**
 * Lambert material with the PSX patch.
 * @param {THREE.MeshLambertMaterialParameters & { baked?: boolean, local?: boolean, lamp?: boolean, paint?: boolean }} params
 */
export function psxLambert(params = {}) {
  const { baked, local, lamp, paint, ...rest } = params;
  return patchPsx(new THREE.MeshLambertMaterial(rest), { baked, local, lamp, paint });
}

/**
 * Phong material with the PSX patch, for car paint, glass and chrome.
 * @param {THREE.MeshPhongMaterialParameters & { baked?: boolean, local?: boolean, lamp?: boolean, paint?: boolean }} params
 */
export function psxPhong(params = {}) {
  const { baked, local, lamp, paint, ...rest } = params;
  return patchPsx(new THREE.MeshPhongMaterial(rest), { baked, local, lamp, paint });
}

/**
 * Unlit material with the PSX patch, for signs, lamps and anything that glows.
 * @param {THREE.MeshBasicMaterialParameters} params
 */
export function psxBasic(params = {}) {
  return patchPsx(new THREE.MeshBasicMaterial(params));
}

/**
 * Additive camera-facing flares for lamps that should read from a distance: traffic head and
 * tail lights. One quad per instance; the instance matrix gives the center and the size (its x
 * scale), `instanceColor` the color and `aDir` the way the lamp faces, so a headlight flares from
 * the front and shrinks to a dot from the side. They fade out toward the fog distance `far`.
 * @param {THREE.Texture} map a radial glow
 * @param {number} far
 */
export function psxFlare(map, far) {
  return new THREE.ShaderMaterial({
    uniforms: { map: { value: map }, uFar: { value: far }, uSnap: psxUniforms.uSnap, uSnapOn: psxUniforms.uSnapOn },
    vertexShader: /* glsl */ `
      uniform vec2 uSnap;
      uniform float uSnapOn;
      uniform float uFar;
      attribute vec3 aDir;
      varying vec2 vUv;
      varying vec3 vTint;
      void main() {
        vec3 center = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
        float size = length(instanceMatrix[0].xyz);
        vec3 toCam = cameraPosition - center;
        float dist = length(toCam);
        float facing = smoothstep(-0.15, 0.55, dot(toCam / max(dist, 0.001), aDir));
        float fade = 1.0 - smoothstep(uFar * 0.55, uFar, dist);
        vec4 mv = viewMatrix * vec4(center, 1.0);
        mv.xy += position.xy * size * (0.35 + 0.65 * facing) * (1.0 + dist * 0.012);
        gl_Position = projectionMatrix * mv;
        if (uSnapOn > 0.5 && gl_Position.w > 0.0) {
          vec2 grid = uSnap * 0.5;
          gl_Position.xy = floor(gl_Position.xy / gl_Position.w * grid + 0.5) / grid * gl_Position.w;
        }
        vUv = uv;
        vTint = instanceColor * (0.25 + 0.75 * facing) * fade;
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D map;
      varying vec2 vUv;
      varying vec3 vTint;
      void main() {
        gl_FragColor = vec4(vTint * texture2D(map, vUv).r, 1.0);
      }`,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
}
