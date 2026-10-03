/**
 * PS1-style materials. Every lit material in the game comes from here so they all share:
 *  - vertex snapping to the low-res pixel grid (the wobble),
 *  - optional per-vertex baked light (`bake` attribute) added on top of real lights,
 *  - optional local light: one color and direction for things that move (the player's
 *    car), sampled each frame from the same baked lights the world uses.
 */

import * as THREE from 'three';

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
};

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
varying vec3 vPoolPos;
varying vec3 vPoolN;
vec3 poolLight(vec3 p, vec3 n) {
  vec2 c = floor((p.xz - uPoolGrid.xy) / uPoolGrid.z);
  if (c.x < 0.0 || c.y < 0.0 || c.x >= uPoolGrid.w || c.y >= uPoolGrid.w) return vec3(0.0);
  vec3 sum = vec3(0.0);
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
      for (const k of ['uPoolLights', 'uPoolCells', 'uPoolGrid', 'uPoolsOn']) shader.uniforms[k] = psxUniforms[k];
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
      fs = `varying vec3 vBake;\n#define POOL_BANDS ${POOL_BANDS.toFixed(1)}\n${POOL_FRAGMENT}${fs}`;
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
