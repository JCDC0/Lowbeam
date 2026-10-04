// Renders the pass-by whoosh to a WAV so it can be listened to without the game: a car going
// past at 20, 60 and 120 km/h relative, plus a heavy truck at 60 for comparison. The tracker is
// the real `PassBy` and the sound is the real `renderPassby`, the same code the browser plays.
//
//   node tools/render-passby.mjs        writes tools/shots/audio/passby.wav
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PassBy, renderPassby, passbyDuration, passbyGain } from '../src/audio/passby.js';

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
 * Flies one car past a stationary player and renders the pass the tracker reports, so the WAV
 * is the actual event the game would hear, not a hand-built approximation.
 * @param {number} kmh relative speed @param {number} offset meters to the player's side
 * @param {{ id: string, mass: number }} kind
 */
function renderPass(kmh, offset, kind = { id: 'sedan', mass: 1350 }) {
  const speed = kmh / 3.6;
  const player = { x: 0, y: 0, z: 0, vx: 0, vz: 0, yaw: 0 };
  const pb = new PassBy();
  const dt = 1 / 120;
  // Start 120 m behind, so the car is well outside the tracker's range when the run begins.
  let event = null;
  const startZ = -120;
  // Long enough for the car to travel from behind the player to past them, whatever its speed.
  const seconds = 160 / speed;
  for (let t = 0; t < seconds && !event; t += dt) {
    const z = startZ + speed * t;
    const a = { id: 1, x: offset, y: 0, z, vx: 0, vz: speed, kind };
    const found = pb.update(player, [a]);
    if (found.length) event = found[0];
  }
  if (!event) throw new Error(`no pass detected at ${kmh} km/h`);
  return event;
}

const blocks = [];
const lead = new Float32Array(Math.round(0.4 * SR));
blocks.push(lead);

const passes = [
  [20, 3.2, { id: 'sedan', mass: 1350 }],
  [60, 3.2, { id: 'sedan', mass: 1350 }],
  [60, 3.2, { id: 'semi', mass: 24000 }],
  [120, 3.2, { id: 'sedan', mass: 1350 }],
];

console.log('pass                 rel speed   miss   gain   length');
for (const [kmh, offset, kind] of passes) {
  const ev = renderPass(kmh, offset, kind);
  const samples = renderPassby(ev, SR);
  let peak = 0;
  let sum = 0;
  for (const x of samples) {
    peak = Math.max(peak, Math.abs(x));
    sum += x * x;
  }
  const gain = passbyGain(ev.speed, ev.dist, ev.heavy);
  console.log(
    `${(kind.id + ' at ' + kmh + ' km/h').padEnd(20)}` +
    `${(ev.speed.toFixed(1) + ' m/s').padStart(9)}` +
    `${(ev.dist.toFixed(1) + ' m').padStart(7)}` +
    `${gain.toFixed(3).padStart(8)}` +
    `${passbyDuration(ev.speed).toFixed(2).padStart(8)} s` +
    `   peak ${peak.toFixed(2)} rms ${Math.sqrt(sum / samples.length).toFixed(3)}`,
  );
  blocks.push(samples);
  blocks.push(new Float32Array(Math.round(0.7 * SR)));
}

const total = blocks.reduce((n, b) => n + b.length, 0);
const all = new Float32Array(total);
let o = 0;
for (const b of blocks) {
  all.set(b, o);
  o += b.length;
}
const file = path.join(OUT, 'passby.wav');
writeWav(file, all);
console.log(`\n${(total / SR).toFixed(1)} s  ${file}`);
console.log('20 km/h is a short soft blip, 60 km/h a clear whoosh, 120 km/h a violent one; the semi at 60 has the low rumble under it.');