/**
 * Engine sound, one voice, synthesized per sample. Pure: no Web Audio, no DOM, so Node can
 * test it and render it to a file. The AudioWorklet in engine-worklet.js is a thin shell
 * around `EngineVoice`.
 *
 * Model: every cylinder firing is an exhaust pulse (a fast attack and a slower decay) at
 * its place in the 720 degree cycle. The firing pattern gives each engine its character:
 * the unequal-length-header burble of the flat-four, the uneven lope of a cross-plane
 * V8, the smooth wail of a V12. The pulse train runs through a throttle-controlled low
 * pass (an open throttle is brighter) and two exhaust resonances, a little intake noise,
 * the turbo whistle and gear whine on the cars that have them, then a soft clip.
 * Off-throttle at high rpm it crackles.
 */

/**
 * @typedef {{
 *   cyl: number, pattern: number[], amps: number[], pipeHz: number, pipeQ: number,
 *   cutLow: number, cutHigh: number, body: number, noise: number, whistle: number,
 *   whine: number, pops: number, rough: number, width: number[], gain: number
 * }} VoiceSpec
 */

/** @type {Record<string, VoiceSpec>} */
export const VOICES = {
  // Flat-four turbo with unequal-length headers: firings come in close pairs.
  boxer: {
    cyl: 4,
    pattern: [0, 0.205, 0.5, 0.705],
    amps: [1, 0.82, 1, 0.82],
    pipeHz: 124,
    pipeQ: 3.2,
    cutLow: 520,
    cutHigh: 3400,
    body: 0.55,
    noise: 0.2,
    whistle: 1,
    whine: 0.0,
    pops: 0.55,
    rough: 0.014,
    width: [0.85, 0.34],
    gain: 0.95,
  },
  // Cross-plane V8: even crank intervals, but the banks fire in an uneven order.
  v8: {
    cyl: 8,
    pattern: [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875].map((o, i) => o + [0.0, 0.012, -0.01, 0.015, 0.0, -0.012, 0.01, -0.015][i]),
    amps: [1, 0.68, 0.96, 0.6, 1, 0.74, 0.92, 0.64],
    pipeHz: 74,
    pipeQ: 2.6,
    cutLow: 380,
    cutHigh: 2600,
    body: 0.85,
    noise: 0.16,
    whistle: 0,
    whine: 0.0,
    pops: 0.9,
    rough: 0.02,
    width: [0.95, 0.4],
    gain: 1.05,
  },
  // V12: twelve even firings, high and smooth, with a cam and gear whir.
  v12: {
    cyl: 12,
    pattern: Array.from({ length: 12 }, (_, i) => i / 12),
    amps: [1, 0.97, 1, 0.96, 1, 0.98, 1, 0.97, 1, 0.96, 1, 0.98],
    pipeHz: 176,
    pipeQ: 3.6,
    cutLow: 900,
    cutHigh: 5600,
    body: 0.4,
    noise: 0.14,
    whistle: 0,
    whine: 0.55,
    pops: 0.18,
    rough: 0.006,
    width: [0.9, 0.42],
    gain: 0.9,
  },
};

const TAU = Math.PI * 2;
/** Peak of the raw pulse shape, used to normalize it. */
const PULSE_PEAK = 0.57;
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const lerp = (a, b, t) => a + (b - a) * t;

/** Biquad in direct form I. Coefficients are set per block. */
class Biquad {
  constructor() {
    this.b0 = 1;
    this.b1 = 0;
    this.b2 = 0;
    this.a1 = 0;
    this.a2 = 0;
    this.x1 = 0;
    this.x2 = 0;
    this.y1 = 0;
    this.y2 = 0;
  }

  /** @param {number} sr @param {number} f cutoff Hz @param {number} q */
  lowpass(sr, f, q) {
    const w = (TAU * clamp(f, 20, sr * 0.45)) / sr;
    const c = Math.cos(w);
    const a = Math.sin(w) / (2 * q);
    const a0 = 1 + a;
    this.b0 = (1 - c) / 2 / a0;
    this.b1 = (1 - c) / a0;
    this.b2 = this.b0;
    this.a1 = (-2 * c) / a0;
    this.a2 = (1 - a) / a0;
  }

  /** @param {number} sr @param {number} f centre Hz @param {number} q */
  bandpass(sr, f, q) {
    const w = (TAU * clamp(f, 20, sr * 0.45)) / sr;
    const c = Math.cos(w);
    const a = Math.sin(w) / (2 * q);
    const a0 = 1 + a;
    this.b0 = a / a0;
    this.b1 = 0;
    this.b2 = -a / a0;
    this.a1 = (-2 * c) / a0;
    this.a2 = (1 - a) / a0;
  }

  /** @param {number} x */
  run(x) {
    const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1;
    this.x1 = x;
    this.y2 = this.y1;
    this.y1 = y;
    return y;
  }
}

const BLOCK = 64;

export class EngineVoice {
  /** @param {number} sampleRate @param {string} [voice] */
  constructor(sampleRate, voice = 'boxer') {
    this.sr = sampleRate;
    this.setVoice(voice);
    this.rpm = 900;
    this.load = 0;
    this.boost = 0;
    this.limiter = false;
    this.on = true;
    this.target = { rpm: 900, load: 0, boost: 0, limiter: 0, on: 1, damage: 0, overrev: 0 };
    this.damage = 0;
    this.overrev = 0;
    this.blow = 0;
    this.clank = 0;
    this.stutter = 0;
    this.knock = 0;
    this.blowLp = 0;
    this.knockPhase = 0;
    this.clankPhase = 0;
    this.clankPhase2 = 0;
    this.level = 0;
    this.phase = 0;
    this.cycle = 0;
    this.seed = 0x9e3779b9;
    this.rpmWobble = 0;
    this.hp = 0;
    this.lp1 = new Biquad();
    this.lp2 = new Biquad();
    this.pipe = new Biquad();
    this.pipe2 = new Biquad();
    this.noiseLp = 0;
    this.whistlePhase = 0;
    this.whinePhase = 0;
    this.bov = 0;
    this.pop = 0;
    this.popLp = 0;
    this.bovLp = 0;
    this.lastBov = 0;
    this.lastPop = 0;
    this.sinceBlock = BLOCK;
    this.jitter = new Float64Array(12).fill(1);
    this.refreshJitter();
  }

  /** @param {string} name */
  setVoice(name) {
    this.v = VOICES[name] || VOICES.boxer;
    this.name = name;
    this.jitter = new Float64Array(this.v.cyl).fill(1);
  }

  /**
   * Targets for the next blocks. Values are smoothed inside.
   * @param {{ rpm?: number, load?: number, boost?: number, limiter?: number | boolean, on?: number | boolean, damage?: number, overrev?: number }} p
   */
  set(p) {
    const t = this.target;
    if (p.rpm !== undefined) t.rpm = p.rpm;
    if (p.load !== undefined) t.load = clamp(p.load, 0, 1);
    if (p.boost !== undefined) t.boost = clamp(p.boost, 0, 1.4);
    if (p.limiter !== undefined) t.limiter = +p.limiter;
    if (p.on !== undefined) t.on = +p.on;
    if (p.damage !== undefined) t.damage = clamp(p.damage, 0, 1);
    if (p.overrev !== undefined) t.overrev = clamp(p.overrev, 0, 1);
  }

  /** Blow-off valve release: the hiss after lifting off at boost. @param {number} amount 0 to 1 */
  triggerBov(amount) {
    this.bov = Math.max(this.bov, amount);
  }

  /** A single exhaust pop, for upshifts and decel. @param {number} amount 0 to 1 */
  triggerPop(amount) {
    this.pop = Math.max(this.pop, amount);
  }

  /** The engine blowing: a bang, a metal clank and a stumble. */
  triggerBlow() {
    this.blow = 1;
    this.clank = 1;
    this.stutter = 1;
  }

  rand() {
    let x = this.seed;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.seed = x >>> 0;
    return this.seed / 4294967296;
  }

  /** Per-cycle amplitude variation so no two firings are identical. */
  refreshJitter() {
    const n = this.v.cyl;
    const roughness = 0.04 + 0.1 * (1 - this.load);
    for (let k = 0; k < n; k++) {
      let j = 1 + (this.rand() - 0.5) * 2 * roughness;
      if (this.limiter && (this.cycle & 1) === 0) j = this.rand() < 0.75 ? 0 : j;
      if (this.damage > 0.02) {
        // A hurt engine misses firings and fires the rest unevenly.
        if (this.rand() < this.damage * 0.5) j = 0;
        else j *= 1 + (this.rand() - 0.5) * this.damage * 1.4;
      }
      this.jitter[k] = j;
    }
    if (this.damage > 0.02) this.knock = Math.max(this.knock, this.damage * (0.4 + 0.6 * this.rand()));
  }

  /** Recomputes smoothed parameters and filter coefficients. */
  updateBlock() {
    const dt = BLOCK / this.sr;
    const t = this.target;
    const k = (tau) => 1 - Math.exp(-dt / tau);
    this.rpm += (t.rpm - this.rpm) * k(0.03);
    this.load += (t.load - this.load) * k(0.05);
    this.boost += (t.boost - this.boost) * k(0.12);
    this.level += (t.on - this.level) * k(t.on > this.level ? 0.15 : 0.04);
    this.damage += (t.damage - this.damage) * k(0.15);
    this.overrev += (t.overrev - this.overrev) * k(0.08);
    this.stutter = Math.max(0, this.stutter - dt / 0.45);
    this.limiter = t.limiter > 0.5;
    this.rpmWobble += (this.rand() - 0.5 - this.rpmWobble * 0.4) * 0.35;
    const v = this.v;
    const bright = clamp(this.load * 0.85 + (this.rpm / 8000) * 0.25, 0, 1);
    this.lp1.lowpass(this.sr, lerp(v.cutLow, v.cutHigh, bright), 0.8);
    this.lp2.lowpass(this.sr, lerp(v.cutLow, v.cutHigh, bright) * 1.9, 0.6);
    this.pipe.bandpass(this.sr, v.pipeHz * (0.85 + this.rpm / 22000), v.pipeQ);
    this.pipe2.bandpass(this.sr, v.pipeHz * 3.9 * (0.9 + this.rpm / 30000), 2.2);
  }

  /**
   * Fills `out` with mono samples.
   * @param {Float32Array} out @param {number} n
   */
  process(out, n = out.length) {
    const v = this.v;
    const sr = this.sr;
    const N = v.cyl;
    for (let i = 0; i < n; i++) {
      if (this.sinceBlock >= BLOCK) {
        this.updateBlock();
        this.sinceBlock = 0;
      }
      this.sinceBlock++;
      const load = this.load;
      const rpm = this.rpm * (1 + v.rough * this.rpmWobble * (1.3 - load));
      this.phase += rpm / 120 / sr;
      if (this.phase >= 1) {
        this.phase -= 1;
        this.cycle++;
        this.refreshJitter();
      }
      const width = (lerp(v.width[0], v.width[1], load) / N) * 1.0;
      let e = 0;
      for (let k = 0; k < N; k++) {
        let d = this.phase - v.pattern[k];
        if (d < 0) d += 1;
        if (d < width) {
          const u = d / width;
          e += v.amps[k] * this.jitter[k] * (1 - Math.exp(-u * 16)) * Math.exp(-u * 3.5);
        }
      }
      e /= PULSE_PEAK;
      const drive = (0.34 + 0.66 * load) * (1 - 0.35 * this.damage);
      this.hp += (e - this.hp) * 0.003;
      let x = (e - this.hp) * drive;

      const white = this.rand() * 2 - 1;
      this.noiseLp += (white - this.noiseLp) * lerp(0.08, 0.3, load);
      x += this.noiseLp * v.noise * (0.12 + 0.88 * load) * (0.3 + 0.7 * Math.min(1, rpm / 4000)) * (1 + 1.6 * this.damage);

      let y = this.lp2.run(this.lp1.run(x));
      y += this.pipe.run(y) * v.body + this.pipe2.run(y) * v.body * 0.45;

      if (v.whistle) {
        const b = clamp(this.boost, 0, 1.3) / 1.3;
        this.whistlePhase += (TAU * (1400 + 2800 * b + (rpm / 8000) * 700)) / sr;
        if (this.whistlePhase > TAU) this.whistlePhase -= TAU;
        y += Math.sin(this.whistlePhase) * 0.085 * b * b * (0.5 + 0.5 * Math.min(1, rpm / 5000)) * (0.7 + 0.3 * white);
      }
      if (v.whine) {
        this.whinePhase += (TAU * (rpm / 60) * 7.3) / sr;
        if (this.whinePhase > TAU) this.whinePhase -= TAU;
        y += Math.sin(this.whinePhase) * v.whine * 0.035 * (0.35 + 0.65 * load) * Math.min(1, rpm / 3000);
      }

      if (this.load < 0.06 && rpm > 3200 && v.pops > 0 && this.rand() < (v.pops * 9 * (rpm / 8000)) / sr) this.pop = Math.max(this.pop, 0.35 + 0.65 * this.rand());
      if (this.pop > 0.001) {
        this.popLp += (white - this.popLp) * 0.12;
        y += this.popLp * this.pop * 1.4;
        this.pop *= 0.9975;
        if (this.pop < 0.002) this.pop = 0;
      }
      if (this.knock > 0.002) {
        this.knockPhase += (TAU * (170 + 90 * this.knock)) / sr;
        if (this.knockPhase > TAU) this.knockPhase -= TAU;
        y += (Math.sin(this.knockPhase) * 0.5 + (white - this.noiseLp) * 0.5) * this.knock * 0.55;
        this.knock *= 0.9987;
      }
      if (this.overrev > 0.01) {
        // Valves floating and the whole engine screaming: a harsh rasp and more drive.
        y += (white - this.noiseLp) * this.overrev * 0.22;
        y *= 1 + 0.5 * this.overrev;
      }
      let crash = 0;
      if (this.blow > 0.001) {
        this.blowLp += (white - this.blowLp) * 0.09;
        crash += this.blowLp * this.blow * 8;
        this.blow *= 0.99988;
      }
      if (this.clank > 0.001) {
        this.clankPhase += (TAU * 640) / sr;
        this.clankPhase2 += (TAU * 1130) / sr;
        if (this.clankPhase > TAU) this.clankPhase -= TAU;
        if (this.clankPhase2 > TAU) this.clankPhase2 -= TAU;
        crash += (Math.sin(this.clankPhase) * 0.5 + Math.sin(this.clankPhase2) * 0.35) * this.clank * 1.6;
        this.clank *= 0.99955;
      }
      if (this.bov > 0.001) {
        this.bovLp += (white - this.bovLp) * 0.55;
        y += (white - this.bovLp) * this.bov * 0.55;
        this.bov *= 0.99992;
      }

      y = Math.tanh(y * 1.25 * v.gain) * this.level * (1 - 0.85 * this.stutter * (0.5 + 0.5 * Math.sin(this.cycle * 2.7)));
      out[i] = (y + Math.tanh(crash)) * 0.62;
    }
    return out;
  }
}
