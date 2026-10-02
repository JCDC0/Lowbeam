// Renders each car's engine to a WAV file so it can be listened to without the game.
// A scripted run: idle, a pull through the gears with the shift cuts, a lift-off, idle again.
//
//   node tools/render-engines.mjs        writes tools/shots/audio/engine-<car>.wav
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { EngineVoice } from '../src/audio/engine-dsp.js';
import { CARS } from '../src/vehicles/specs.js';

const SR = 48000;
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'shots', 'audio');

/** @param {string} file @param {Float32Array} samples */
export function writeWav(file, samples) {
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

for (const spec of CARS) {
  const eng = spec.engine;
  const v = new EngineVoice(SR, eng.voice);
  const blocks = [];
  /** Runs `seconds` of the voice with a rpm and load function of t in [0, 1]. */
  const run = (seconds, fn, tail = {}) => {
    const n = Math.round(seconds * SR);
    const step = 128;
    const out = new Float32Array(n);
    for (let i = 0; i < n; i += step) {
      const t = i / n;
      const { rpm, load, boost = 0, limiter = 0 } = fn(t);
      v.set({ rpm, load, boost, limiter, on: 1 });
      v.process(out.subarray(i, Math.min(n, i + step)));
    }
    blocks.push(out);
    return tail;
  };
  run(2.5, () => ({ rpm: eng.idle, load: 0.04 }));
  const gears = Math.min(4, spec.gears.length);
  let rpm = eng.idle * 1.6;
  for (let g = 0; g < gears; g++) {
    const top = eng.shiftUp;
    const span = g === 0 ? 2.2 : 2.6;
    run(span, (t) => {
      const r = rpm + (top - rpm) * Math.pow(t, 0.8);
      const boost = eng.turbo ? eng.turbo.boost * Math.min(1, Math.max(0, (r - eng.turbo.spoolRpm * 0.6) / (eng.turbo.spoolRpm * 0.6))) : 0;
      return { rpm: r, load: 1, boost };
    });
    if (g < gears - 1) {
      v.triggerPop(0.9);
      run(0.22, (t) => ({ rpm: top - (top - top * 0.62) * t, load: 0.05 }));
      rpm = top * 0.62;
    }
  }
  if (eng.turbo) v.triggerBov(1);
  run(3.2, (t) => ({ rpm: eng.shiftUp - (eng.shiftUp - eng.idle * 1.4) * Math.pow(t, 0.6), load: 0.0 }));
  run(2, () => ({ rpm: eng.idle, load: 0.04 }));
  run(2.2, (t) => ({ rpm: eng.idle + (eng.redline - eng.idle) * Math.min(1, t * 1.3), load: 1, limiter: t > 0.78 ? 1 : 0, boost: eng.turbo ? eng.turbo.boost : 0 }));
  run(1.5, () => ({ rpm: eng.idle, load: 0.04 }));

  const total = blocks.reduce((n, b) => n + b.length, 0);
  const all = new Float32Array(total);
  let o = 0;
  for (const b of blocks) {
    all.set(b, o);
    o += b.length;
  }
  const file = path.join(OUT, `engine-${spec.id}.wav`);
  writeWav(file, all);
  let peak = 0;
  let sum = 0;
  for (const x of all) {
    peak = Math.max(peak, Math.abs(x));
    sum += x * x;
  }
  console.log(`${spec.name.padEnd(12)} ${(total / SR).toFixed(1)} s  rms ${Math.sqrt(sum / total).toFixed(3)}  peak ${peak.toFixed(2)}  ${file}`);
}
