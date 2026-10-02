/**
 * PS1-style materials. Every lit material in the game comes from here so they all share:
 *  - vertex snapping to the low-res pixel grid (the wobble),
 *  - optional per-vertex baked light (`bake` attribute) added on top of real lights.
 */

import * as THREE from 'three';

/** Shared uniforms. stage.js writes the snap grid size when the render target resizes. */
export const psxUniforms = {
  uSnap: { value: new THREE.Vector2(320, 240) },
  uSnapOn: { value: 1 },
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
 * @param {{ baked?: boolean }} opts
 */
export function patchPsx(mat, { baked = false } = {}) {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uSnap = psxUniforms.uSnap;
    shader.uniforms.uSnapOn = psxUniforms.uSnapOn;
    let vs = 'uniform vec2 uSnap;\nuniform float uSnapOn;\n' + shader.vertexShader;
    vs = vs.replace('#include <project_vertex>', SNAP_VERTEX);
    if (baked) {
      vs = 'attribute vec3 bake;\nvarying vec3 vBake;\n' + vs;
      vs = vs.replace('#include <begin_vertex>', '#include <begin_vertex>\nvBake = bake;');
      let fs = 'varying vec3 vBake;\n' + shader.fragmentShader;
      fs = fs.replace(
        '#include <emissivemap_fragment>',
        '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vBake * diffuseColor.rgb;'
      );
      shader.fragmentShader = fs;
    }
    shader.vertexShader = vs;
  };
  mat.customProgramCacheKey = () => (baked ? 'psx-baked' : 'psx');
  return mat;
}

/**
 * Lambert material with the PSX patch.
 * @param {THREE.MeshLambertMaterialParameters & { baked?: boolean }} params
 */
export function psxLambert(params = {}) {
  const { baked, ...rest } = params;
  return patchPsx(new THREE.MeshLambertMaterial(rest), { baked });
}

/**
 * Phong material with the PSX patch, for car paint, glass and chrome.
 * @param {THREE.MeshPhongMaterialParameters & { baked?: boolean }} params
 */
export function psxPhong(params = {}) {
  const { baked, ...rest } = params;
  return patchPsx(new THREE.MeshPhongMaterial(rest), { baked });
}

/**
 * Unlit material with the PSX patch, for signs, lamps and anything that glows.
 * @param {THREE.MeshBasicMaterialParameters} params
 */
export function psxBasic(params = {}) {
  return patchPsx(new THREE.MeshBasicMaterial(params));
}
