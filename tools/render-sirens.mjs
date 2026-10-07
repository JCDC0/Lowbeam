// Renders the police sirens to a WAV so they can be heard without the game: a unit closing from
// 300 m behind on wail, switching to yelp inside 70 m, passing at +12 m/s and pulling away, then
// a roadblock on hi-lo. The pitch, Doppler, gain and pattern choice are the real `sirenVoices`
// from src/audio/siren.js; the tone is a square and a saw through a band-pass, as audio.js builds
// it, approximated here with simple filters.
//
//   node tools/render-sirens.mjs        writes tools/shots/audio/sirens.wav
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sirenVoices } from '../src/audio/siren.js';

const SR = 48000;
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'shots', 'audio');

/** @param {string} file @param {Float32Array} samples */
function writeWav(file, samples) {
  const data = Buffer.alloc(44 + samples.length * 2);
  data.write('RIFF', 0);
  data.writeUInt32LE(36 + samples.length * 2, 4);
  data.write('WAVEfmt ', 8);
  data.writeUInt32LE(16, 16);
  data.writeUInt16LE(1, 20);
  data.writeUInt16LE(1, 22);
  data.writeUInt32LE(SR, 24);
  data.writeUInt32LE(SR * 2, 28);
  data.writeUInt16LE(2, 32);
  data.writeUInt16LE(16, 34);
  data.write('data', 36);
  data.writeUInt32LE(samples.length * 2, 40);
  for (let i = 0; i < samples.length; i++) data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, samples[i])) * 32000), 44 + i * 2);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, data);
}

/**
 * One siren scene: `unitAt(t)` places the unit; the player drives along +z at 30 m/s.
 * @param {number} seconds @param {(t: number) => { x: number, z: number, vx: number, vz: number, mode: string, pursuit: any }} unitAt
 */
function scene(seconds, unitAt) {
  const out = new Float32Array(Math.round(seconds * SR));
  let ph1 = 0;
  let ph2 = 0;
  let lp = 0;
  let hp = 0;
  let gain = 0;
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    const player = { x: 0, z: 30 * t, vx: 0, vz: 30, yaw: 0 };
    const u = { id: 7, ...unitAt(t) };
    const [v] = sirenVoices([u], player, t);
    const f = v ? v.pitch : 0;
    gain += ((v ? v.gain : 0) - gain) * 0.002;
    ph1 = (ph1 + f / SR) % 1;
    ph2 = (ph2 + (f * 1.006) / SR) % 1;
    const raw = (ph1 < 0.5 ? 1 : -1) + 0.5 * (2 * ph2 - 1);
    // A crude band-pass: a one-pole low-pass near 3.6 kHz, minus a one-pole low-pass near 600 Hz.
    lp += (raw - lp) * 0.38;
    hp += (lp - hp) * 0.075;
    out[i] = (lp - hp) * gain * 0.45;
  }
  return out;
}

const chase = scene(16, (t) => {
  // From 300 m behind, closing at 12 m/s relative, then holding ahead.
  const rel = -300 + 42 * t;
  return { x: 3, z: 30 * t + rel, vx: 0, vz: 30 + (rel < 40 ? 12 : -6), mode: 'drive', pursuit: 'chase' };
});
const block = scene(8, (t) => ({ x: -4, z: 240, vx: 0, vz: 0, mode: 'parked', pursuit: false }));
const all = new Float32Array(chase.length + block.length + SR);
all.set(chase, 0);
all.set(block, chase.length + SR);
const file = path.join(OUT, 'sirens.wav');
writeWav(file, all);
console.log(`wrote ${path.relative(process.cwd(), file)} (${(all.length / SR).toFixed(1)} s)`);
