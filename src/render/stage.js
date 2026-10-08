/**
 * Renderer, low-resolution render target and the PSX post pass.
 *
 * The scene renders into a small target (240 lines by default). A full-screen pass
 * then upscales it with nearest filtering, converts to sRGB, applies a 4x4 ordered
 * dither and quantizes to 5 bits per channel, which is the PS1 framebuffer look.
 *
 * At speed the same pass closes a vignette in from the corners (`uVig`) and smears the frame
 * outward from the center (`uBlur`, a zoom blur of six taps); both are 0 when off or slow, and
 * both are dithered with the rest.
 */

import * as THREE from 'three';
import { psxUniforms } from './psx.js';

const POST_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const POST_FRAG = /* glsl */ `
precision highp float;
uniform sampler2D tColor;
uniform vec2 uRes;
uniform float uPsx;
uniform float uFade;
uniform float uVig;
uniform float uBlur;
varying vec2 vUv;

float bayer4(vec2 p) {
  ivec2 i = ivec2(mod(p, 4.0));
  int idx = i.x + i.y * 4;
  int m[16] = int[16](0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5);
  return float(m[idx]) / 16.0 - 0.5;
}

vec3 toSRGB(vec3 c) {
  c = clamp(c, 0.0, 1.0);
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}

void main() {
  vec3 lin = texture2D(tColor, vUv).rgb;
  if (uBlur > 0.001) {
    vec2 dir = vUv - 0.5;
    vec3 acc = lin;
    for (int i = 1; i < 6; i++) acc += texture2D(tColor, vUv - dir * (float(i) / 5.0) * uBlur * 0.045).rgb;
    lin = acc / 6.0;
  }
  vec3 c = toSRGB(lin);
  if (uVig > 0.001) {
    vec2 d = (vUv - 0.5) * vec2(uRes.x / uRes.y, 1.0);
    c *= 1.0 - uVig * 0.62 * smoothstep(0.32, 0.95, length(d));
  }
  if (uPsx > 0.5) {
    vec2 px = floor(vUv * uRes);
    c += bayer4(px) / 31.0;
    c = floor(c * 31.0 + 0.5) / 31.0;
  }
  c *= uFade;
  gl_FragColor = vec4(c, 1.0);
}
`;

/** Render heights the settings offer, in lines. */
export const RENDER_HEIGHTS = [240, 360, 480, 600, 720, 1080];
/** Default render height: 480 lines keeps the dither and the wobble but reads far better than 240. */
export const DEFAULT_LINES = /** @type {number} */ (480);

export function createStage(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1);
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.autoClear = true;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(62, 4 / 3, 0.25, 760);

  const target = new THREE.WebGLRenderTarget(320, 240, {
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    depthBuffer: true,
    type: THREE.HalfFloatType,
  });

  const post = new THREE.ShaderMaterial({
    vertexShader: POST_VERT,
    fragmentShader: POST_FRAG,
    uniforms: {
      tColor: { value: target.texture },
      uRes: { value: new THREE.Vector2(320, 240) },
      uPsx: { value: 1 },
      uFade: { value: 1 },
      uVig: { value: 0 },
      uBlur: { value: 0 },
    },
    depthTest: false,
    depthWrite: false,
  });
  const postScene = new THREE.Scene();
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), post);
  quad.frustumCulled = false;
  postScene.add(quad);
  const postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  const settings = { lines: DEFAULT_LINES, psx: true };

  function resize() {
    const w = Math.max(1, window.innerWidth);
    const h = Math.max(1, window.innerHeight);
    renderer.setSize(w, h, false);
    const lines = settings.lines > 0 ? settings.lines : h;
    const th = Math.min(lines, h);
    const tw = Math.max(1, Math.round((th * w) / h));
    target.setSize(tw, th);
    post.uniforms.uRes.value.set(tw, th);
    psxUniforms.uSnap.value.set(tw, th);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();

  /** @param {{ lines?: number, psx?: boolean }} s */
  function configure(s) {
    Object.assign(settings, s);
    post.uniforms.uPsx.value = settings.psx ? 1 : 0;
    psxUniforms.uSnapOn.value = settings.psx ? 1 : 0;
    resize();
  }

  /** @type {[THREE.Scene, THREE.Camera]} */
  let last = [scene, camera];

  /** @param {THREE.Scene} [sc] @param {THREE.Camera} [cam] */
  function render(sc = scene, cam = camera) {
    last = [sc, cam];
    renderer.setRenderTarget(target);
    renderer.render(sc, cam);
    renderer.setRenderTarget(null);
    renderer.render(postScene, postCam);
  }

  /**
   * Renders the last drawn scene again and posts it to the dev server, which writes
   * tools/shots/<name>.png.
   * @param {string} name
   */
  async function shot(name = 'shot') {
    render(...last);
    const data = canvas.toDataURL('image/png');
    const res = await fetch('/__shot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, data, png: true }),
    });
    return res.json();
  }

  /**
   * The speed effects for the next frames, 0 to 1 each (`ui/screen-fx.js` decides them).
   * @param {{ vignette: number, blur: number }} fx
   */
  function setSpeedFx(fx) {
    post.uniforms.uVig.value = fx.vignette;
    post.uniforms.uBlur.value = fx.blur;
  }

  return { renderer, scene, camera, target, post, render, resize, configure, shot, settings, setSpeedFx };
}
