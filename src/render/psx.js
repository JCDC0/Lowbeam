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
};

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
      vs = 'attribute vec3 bake;\nvarying vec3 vBake;\n' + vs;
      vs = vs.replace('#include <begin_vertex>', '#include <begin_vertex>\nvBake = bake;');
      fs = 'varying vec3 vBake;\n' + fs;
      extra += '\ntotalEmissiveRadiance += vBake * diffuseColor.rgb;';
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
