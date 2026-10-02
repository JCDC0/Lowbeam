/**
 * All sound, synthesized: nothing is loaded from a file. One `audio` singleton owns the
 * Web Audio graph. The page calls `unlock()` on the first key or click (browsers keep
 * audio suspended until then), `setMode()` when the screen changes, `setCar()` when the
 * car changes and `update()` once per drive frame.
 *
 * Channels, each with a volume (0 to 1) and an on switch, saved in localStorage:
 *   master    everything
 *   engine    the engine voice
 *   effects   tires, road, wind, impacts, the pump, menu chirps
 *   ambience  crickets, wind in the trees, the lake, the town hum
 *   music     the soundtrack
 *
 * A settings menu needs only: `audio.settings`, `setVolume`, `setOn`, `toggle`, `onChange`
 * and `ui(name)` for menu chirps.
 *
 * Every time-dependent call takes an optional `at` (seconds on the context clock), so the
 * same code runs live and in an OfflineAudioContext for rendering and tests.
 */

import { store } from '../core/store.js';
import { clamp } from '../core/mathx.js';

/** @typedef {'master' | 'engine' | 'effects' | 'ambience' | 'music'} Channel */
/** @typedef {'title' | 'garage' | 'loading' | 'drive' | 'pause' | 'free'} Mode */
/** @typedef {{ volume: number, on: boolean }} ChannelSetting */

export const CHANNELS = /** @type {const} */ (['master', 'engine', 'effects', 'ambience', 'music']);

/** @type {Record<Channel, ChannelSetting>} */
const DEFAULTS = {
  master: { volume: 0.85, on: true },
  engine: { volume: 0.9, on: true },
  effects: { volume: 0.9, on: true },
  ambience: { volume: 0.8, on: true },
  music: { volume: 0.55, on: true },
};

/** How loud each part of the world is on each screen. */
const MODES = {
  title: { engine: 0, fx: 0, amb: 0, music: 1 },
  garage: { engine: 0.75, fx: 0, amb: 0, music: 0.8 },
  loading: { engine: 0, fx: 0, amb: 0, music: 0.5 },
  drive: { engine: 1, fx: 1, amb: 1, music: 1 },
  pause: { engine: 0, fx: 0, amb: 0.2, music: 0.45 },
  free: { engine: 1, fx: 1, amb: 1, music: 1 },
};

/** Low-pass cutoff and loudness of the vehicle sounds per camera. The cockpit is a closed room. */
const VIEW = {
  chase: { lp: 9000, gain: 1 },
  hood: { lp: 3600, gain: 0.95 },
  bumper: { lp: 12000, gain: 1.05 },
  cockpit: { lp: 1700, gain: 0.82 },
};

const LOOSE = new Set(['gravel', 'dirt', 'grass', 'sand', 'rock']);

/** @param {AudioParam} p @param {number} v @param {number} t @param {number} [tau] */
function glide(p, v, t, tau = 0.06) {
  p.cancelScheduledValues(t);
  p.setTargetAtTime(v, t, tau);
}

/** @param {AudioParam} p @param {number} v @param {number} t */
function put(p, v, t) {
  p.cancelScheduledValues(t);
  p.setValueAtTime(v, t);
}

/**
 * A looping noise buffer.
 * @param {BaseAudioContext} ctx @param {number} seconds @param {'white' | 'pink' | 'crackle'} kind
 */
function noiseBuffer(ctx, seconds, kind) {
  const n = Math.round(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = buf.getChannelData(0);
  if (kind === 'white') {
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  } else if (kind === 'pink') {
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < n; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + w * 0.0555179;
      b1 = 0.99332 * b1 + w * 0.0750759;
      b2 = 0.969 * b2 + w * 0.153852;
      b3 = 0.8665 * b3 + w * 0.3104856;
      b4 = 0.55 * b4 + w * 0.5329522;
      b5 = -0.7616 * b5 - w * 0.016898;
      d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
      b6 = w * 0.115926;
    }
  } else {
    const p = 600 / ctx.sampleRate;
    for (let i = 0; i < n; i++) d[i] = Math.random() < p ? (Math.random() * 2 - 1) * (0.3 + Math.random() * 0.7) : 0;
  }
  return buf;
}

export class AudioSystem {
  constructor() {
    /** @type {Record<Channel, ChannelSetting>} */
    this.settings = JSON.parse(JSON.stringify(DEFAULTS));
    const saved = store.get('audio', null);
    if (saved) for (const c of CHANNELS) if (saved[c]) Object.assign(this.settings[c], { volume: clamp(Number(saved[c].volume), 0, 1), on: saved[c].on !== false });
    /** @type {(() => void)[]} */
    this.listeners = [];
    /** @type {BaseAudioContext | null} */
    this.ctx = null;
    this.built = false;
    /** @type {Mode} */
    this.mode = 'title';
    this.view = 'chase';
    /** @type {any} */
    this.bus = null;
    /** @type {any} */
    this.fx = null;
    /** @type {any} */
    this.amb = null;
    /** @type {any} */
    this.white = null;
    /** @type {any} */
    this.analyser = null;
    /** @type {any} */
    this.scratch = null;
    /** @type {any} */
    this.engine = null;
    this.spec = null;
    this.bovN = 0;
    this.popN = 0;
    this.lastGear = 1;
    this.lastThrottle = 0;
    this.pumping = false;
    this.music = null;
  }

  /** The graph node the music player connects to, once unlocked. */
  get musicBus() {
    return this.bus ? this.bus.musicMode : null;
  }

  /** Called after any setting changes. @param {() => void} fn */
  onChange(fn) {
    this.listeners.push(fn);
    return () => (this.listeners = this.listeners.filter((l) => l !== fn));
  }

  /** RMS of what is going to the speakers right now, 0 to 1. For checks and meters. */
  level() {
    if (!this.built) return 0;
    if (!this.analyser) {
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 1024;
      this.bus.out.connect(this.analyser);
      this.scratch = new Float32Array(1024);
    }
    this.analyser.getFloatTimeDomainData(this.scratch);
    let sum = 0;
    for (const x of this.scratch) sum += x * x;
    return Math.sqrt(sum / this.scratch.length);
  }

  /** @param {Channel} ch @param {number} v 0 to 1 */
  setVolume(ch, v) {
    this.settings[ch].volume = clamp(v, 0, 1);
    this.commit();
  }

  /** @param {Channel} ch @param {boolean} on */
  setOn(ch, on) {
    this.settings[ch].on = !!on;
    this.commit();
  }

  /** @param {Channel} ch */
  toggle(ch) {
    this.setOn(ch, !this.settings[ch].on);
    return this.settings[ch].on;
  }

  commit() {
    store.set('audio', this.settings);
    this.applyChannels();
    for (const l of this.listeners) l();
  }

  applyChannels(at = this.ctx ? this.ctx.currentTime : 0) {
    if (!this.bus) return;
    for (const c of CHANNELS) {
      const s = this.settings[c];
      glide(this.bus[c].gain, s.on ? s.volume * s.volume : 0, at, 0.04);
    }
  }

  /**
   * Starts audio. Call from a key or click; later calls only resume a suspended context.
   * @param {BaseAudioContext} [context] an OfflineAudioContext, for rendering
   */
  async unlock(context) {
    if (!this.ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!context && !Ctx) return false;
      this.ctx = context || new Ctx({ latencyHint: 'interactive' });
      try {
        await this.build(this.ctx);
      } catch (err) {
        console.warn('audio: could not start', err);
        this.ctx = null;
        return false;
      }
    }
    if (this.ctx.state === 'suspended' && !('startRendering' in this.ctx)) await /** @type {AudioContext} */ (this.ctx).resume();
    return true;
  }

  /** @param {BaseAudioContext} c */
  async build(c) {
    await c.audioWorklet.addModule(new URL('./engine-worklet.js', import.meta.url).href);
    const g = (v = 0) => {
      const n = c.createGain();
      n.gain.value = v;
      return n;
    };
    const bq = (type, f, q = 1) => {
      const n = c.createBiquadFilter();
      n.type = type;
      n.frequency.value = f;
      n.Q.value = q;
      return n;
    };
    /** @type {any} */
    const bus = (this.bus = {});
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.knee.value = 14;
    comp.ratio.value = 4;
    comp.attack.value = 0.004;
    comp.release.value = 0.2;
    bus.master = g(0);
    bus.out = comp;
    bus.master.connect(comp).connect(c.destination);
    for (const ch of CHANNELS) if (ch !== 'master') (bus[ch] = g(0)).connect(bus.master);
    bus.modeEngine = g(0);
    bus.modeFx = g(0);
    bus.modeAmb = g(0);
    bus.musicMode = g(0);
    bus.view = bq('lowpass', 9000, 0.7);
    bus.viewGain = g(1);
    bus.view.connect(bus.viewGain);
    bus.viewGain.connect(bus.modeFx);
    bus.viewE = bq('lowpass', 9000, 0.7);
    bus.viewEGain = g(1);
    bus.engineIn = g(1);
    bus.engineIn.connect(bus.modeEngine);
    bus.modeEngine.connect(bus.viewE);
    bus.viewE.connect(bus.viewEGain);
    bus.viewEGain.connect(bus.engine);
    bus.modeFx.connect(bus.effects);
    bus.modeAmb.connect(bus.ambience);
    bus.musicMode.connect(bus.music);
    bus.ui = g(0.5);
    bus.ui.connect(bus.effects);

    const white = noiseBuffer(c, 2, 'white');
    const pink = noiseBuffer(c, 4, 'pink');
    const crackle = noiseBuffer(c, 3, 'crackle');
    this.white = white;
    /** @param {AudioBuffer} buf */
    const loop = (buf) => {
      const s = c.createBufferSource();
      s.buffer = buf;
      s.loop = true;
      s.start(0, Math.random() * buf.duration);
      return s;
    };
    /** Looped noise through a filter into a gain that is returned. */
    const layer = (buf, filter, dest = bus.view) => {
      const gain = g(0);
      loop(buf).connect(filter).connect(gain).connect(dest);
      return { gain, filter };
    };

    this.fx = {
      road: layer(pink, bq('lowpass', 260, 0.7)),
      gravel: layer(crackle, bq('bandpass', 2300, 0.6)),
      wind: layer(pink, bq('bandpass', 700, 0.5)),
      scrub: layer(white, bq('bandpass', 950, 1.3)),
      squeal: layer(white, bq('bandpass', 1250, 14)),
      squeal2: layer(white, bq('bandpass', 2150, 9)),
    };
    const pumpHum = c.createOscillator();
    pumpHum.type = 'triangle';
    pumpHum.frequency.value = 93;
    pumpHum.start();
    const pumpGain = g(0);
    pumpHum.connect(bq('lowpass', 420)).connect(pumpGain).connect(bus.view);
    const pumpFlow = layer(pink, bq('lowpass', 520, 0.8));
    this.fx.pump = { gain: pumpGain, flow: pumpFlow.gain };

    const lfo = (type, freq, depth, target) => {
      const o = c.createOscillator();
      o.type = type;
      o.frequency.value = freq;
      const d = g(depth);
      o.connect(d).connect(target);
      o.start();
      return o;
    };
    /** @type {any} */
    const amb = (this.amb = {});
    const ambLayer = (buf, filter, base, lfoHz, lfoDepth) => {
      const mod = g(base);
      loop(buf).connect(filter).connect(mod);
      if (lfoHz) lfo('sine', lfoHz, lfoDepth, mod.gain);
      const level = g(0);
      mod.connect(level).connect(bus.modeAmb);
      return level;
    };
    amb.trees = ambLayer(pink, bq('bandpass', 560, 0.45), 0.6, 0.071, 0.4);
    amb.breeze = ambLayer(pink, bq('lowpass', 380, 0.5), 0.7, 0.043, 0.3);
    amb.water = ambLayer(pink, bq('lowpass', 520, 0.6), 0.55, 0.19, 0.45);
    amb.crickets = g(0);
    amb.crickets.connect(bus.modeAmb);
    [[4300, 31, 0.19], [4750, 27, 0.27], [5180, 36, 0.11], [5600, 24, 0.35]].forEach(([f, rate, burstRate]) => {
      const o = c.createOscillator();
      o.type = 'sine';
      o.frequency.value = f;
      o.start();
      const gate = g(0.5);
      lfo('square', rate, 0.5, gate.gain);
      const burst = g(0.5);
      lfo('sine', burstRate, 0.5, burst.gain);
      o.connect(gate).connect(burst).connect(amb.crickets);
    });
    const saw = c.createOscillator();
    saw.type = 'sawtooth';
    saw.frequency.value = 100;
    saw.start();
    amb.town = g(0);
    saw.connect(bq('lowpass', 240)).connect(amb.town);
    const neon = c.createOscillator();
    neon.type = 'square';
    neon.frequency.value = 120;
    neon.start();
    neon.connect(bq('bandpass', 1900, 3)).connect(amb.town);
    amb.town.connect(bus.modeAmb);
    const hum = c.createOscillator();
    hum.type = 'sine';
    hum.frequency.value = 120;
    hum.start();
    const hum2 = c.createOscillator();
    hum2.type = 'sine';
    hum2.frequency.value = 240;
    hum2.start();
    amb.pad = g(0);
    hum.connect(amb.pad);
    hum2.connect(g(0.4)).connect(amb.pad);
    amb.pad.connect(bus.modeAmb);

    this.built = true;
    this.applyChannels(0);
    this.setMode(this.mode, 0);
    if (this.spec) this.setCar(this.spec);
    this.music?.attach?.(this);
  }

  /** @param {Mode} mode @param {number} [at] */
  setMode(mode, at) {
    this.mode = mode;
    if (!this.built) return;
    const t = at ?? this.ctx.currentTime;
    const m = MODES[mode] || MODES.drive;
    glide(this.bus.modeEngine.gain, m.engine, t, 0.12);
    glide(this.bus.modeFx.gain, m.fx, t, 0.08);
    glide(this.bus.modeAmb.gain, m.amb, t, 0.4);
    glide(this.bus.musicMode.gain, m.music, t, 0.5);
    if (mode === 'title' || mode === 'loading') this.pump(false, t);
    this.music?.setMode?.(mode, t);
  }

  /** @param {'chase' | 'hood' | 'bumper' | 'cockpit'} view @param {number} [at] */
  setView(view, at) {
    if (view === this.view || !this.built) {
      this.view = view;
      return;
    }
    this.view = view;
    const t = at ?? this.ctx.currentTime;
    const v = VIEW[view] || VIEW.chase;
    for (const [filter, gain] of [[this.bus.view, this.bus.viewGain], [this.bus.viewE, this.bus.viewEGain]]) {
      glide(filter.frequency, v.lp, t, 0.05);
      glide(gain.gain, v.gain, t, 0.05);
    }
  }

  /** Builds a fresh engine voice for the car. @param {import('../vehicles/specs.js').CarSpec} spec */
  setCar(spec) {
    this.spec = spec;
    if (!this.built) return;
    const c = this.ctx;
    if (this.engine) {
      this.engine.node.disconnect();
      this.engine = null;
    }
    const node = new AudioWorkletNode(c, 'lowbeam-engine', { numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [1], processorOptions: { voice: spec.engine.voice } });
    node.connect(this.bus.engineIn);
    const p = node.parameters;
    this.engine = { node, rpm: p.get('rpm'), load: p.get('load'), boost: p.get('boost'), limiter: p.get('limiter'), on: p.get('on'), bov: p.get('bov'), pop: p.get('pop') };
    put(this.engine.rpm, spec.engine.idle, c.currentTime);
    put(this.engine.on, 1, c.currentTime);
    this.bovN = 0;
    this.popN = 0;
  }

  /** The engine blips when a car is chosen in the garage. @param {number} [at] */
  garageBlip(at) {
    if (!this.engine || !this.spec) return;
    const t = at ?? this.ctx.currentTime;
    const e = this.engine;
    const idle = this.spec.engine.idle;
    const top = Math.min(this.spec.engine.redline * 0.62, 5200);
    for (const [p, v0, v1, v2] of [[e.rpm, idle, top, idle], [e.load, 0.04, 1, 0.04]]) {
      p.cancelScheduledValues(t);
      p.setValueAtTime(v0, t);
      p.linearRampToValueAtTime(v1, t + 0.16);
      p.setValueAtTime(v1, t + 0.28);
      p.linearRampToValueAtTime(v2, t + 0.85);
    }
    put(e.on, 1, t);
    if (this.spec.engine.turbo) {
      put(e.boost, 0, t);
      e.boost.setValueAtTime(0, t);
      e.boost.linearRampToValueAtTime(this.spec.engine.turbo.boost * 0.7, t + 0.3);
      e.boost.linearRampToValueAtTime(0, t + 0.9);
      this.bovN++;
      put(e.bov, this.bovN + 0.8, t + 0.3);
    }
  }

  /**
   * One drive frame. `f.state` is the vehicle state, `f.boost` the gauge boost in bar,
   * `f.env` the EnvMap result around the car.
   * @param {{ dt: number, state: any, spec: any, boost: number, view: string, env: { forest: number, town: number, water: number }, pad: boolean }} f
   * @param {number} [at]
   */
  update(f, at) {
    if (!this.built || !this.engine) return;
    const t = at ?? this.ctx.currentTime;
    const s = f.state;
    const spec = f.spec;
    this.setView(/** @type {any} */ (f.view), t);

    const e = this.engine;
    const shifting = s.shiftTimer > 0;
    const load = s.engineOn ? (shifting ? 0.08 : s.throttle) : 0;
    put(e.rpm, s.rpm, t);
    put(e.load, load, t);
    put(e.on, s.engineOn ? 1 : 0, t);
    put(e.limiter, s.limiter > 0 ? 1 : 0, t);
    const turbo = !!spec.engine.turbo;
    put(e.boost, turbo ? clamp(f.boost, 0, 1.4) : 0, t);
    if (turbo && this.lastThrottle > 0.6 && load < 0.12 && f.boost > 0.35) {
      this.bovN++;
      put(e.bov, this.bovN + clamp(f.boost / 1.2, 0.3, 1), t);
    }
    if (s.gear !== this.lastGear && s.gear > 1 && this.lastThrottle > 0.7 && s.rpm > spec.engine.redline * 0.4) {
      this.popN++;
      put(e.pop, this.popN + 0.5 + 0.4 * Math.random(), t);
    }
    this.lastGear = s.gear;
    this.lastThrottle = load;

    const speed = s.speed;
    const loose = LOOSE.has(s.surfRear) || LOOSE.has(s.surfFront);
    const skidN = s.contact ? clamp((s.skid - 1.2) / 5.5, 0, 1) : 0;
    const fx = this.fx;
    glide(fx.road.gain.gain, s.contact ? Math.pow(clamp(speed / 40, 0, 1), 0.8) * (loose ? 0.3 : 0.2) : 0, t);
    glide(fx.gravel.gain.gain, loose && s.contact ? clamp(speed / 25, 0, 1) * (0.5 + 0.5 * skidN) * 0.6 : 0, t);
    glide(fx.wind.gain.gain, Math.pow(clamp((speed - 8) / 60, 0, 1), 2) * 0.55, t);
    glide(fx.wind.filter.frequency, 450 + speed * 14, t);
    glide(fx.scrub.gain.gain, skidN * (loose ? 0.45 : 0.12), t);
    // A narrow band-pass keeps only a sliver of the noise power, so the gains are large.
    const sq = loose ? 0 : Math.pow(skidN, 1.2) * 1.9;
    glide(fx.squeal.gain.gain, sq, t, 0.04);
    glide(fx.squeal2.gain.gain, sq * 0.55, t, 0.04);
    const pitch = 820 + speed * 9 + skidN * 260;
    glide(fx.squeal.filter.frequency, pitch, t, 0.08);
    glide(fx.squeal2.filter.frequency, pitch * 1.63, t, 0.08);
    if (s.landing > 1.5) this.impact(clamp(s.landing * 0.9, 2, 20), t);

    const env = f.env;
    const a = this.amb;
    const quiet = 1 - clamp(speed / 30, 0, 1) * 0.7;
    glide(a.crickets.gain, 0.07 * (1 - env.town * 0.9) * quiet * (1 - env.forest * 0.15), t, 0.5);
    glide(a.trees.gain, (0.05 + env.forest * 0.3) * quiet, t, 0.5);
    glide(a.breeze.gain, 0.12 * quiet, t, 0.5);
    glide(a.water.gain, env.water * 0.65 * quiet, t, 0.5);
    glide(a.town.gain, env.town * 0.06, t, 0.5);
    glide(a.pad.gain, f.pad ? 0.05 : 0, t, 0.3);
  }

  /** @param {boolean} on @param {number} [at] */
  pump(on, at) {
    if (!this.built || on === this.pumping) return;
    this.pumping = on;
    const t = at ?? this.ctx.currentTime;
    glide(this.fx.pump.gain.gain, on ? 0.2 : 0, t, 0.12);
    glide(this.fx.pump.flow.gain, on ? 0.32 : 0, t, 0.15);
    this.click(t, on ? 1 : 0.7);
  }

  /** A short mechanical click. @param {number} t @param {number} amount */
  click(t, amount = 1) {
    if (!this.built) return;
    this.noiseBurst(t, { f: 1800, q: 1.5, dur: 0.04, gain: 0.5 * amount, dest: this.bus.modeFx });
  }

  /**
   * A burst of noise through a band-pass with an exponential decay.
   * @param {number} t @param {{ f: number, q: number, dur: number, gain: number, dest?: AudioNode, type?: BiquadFilterType }} o
   */
  noiseBurst(t, { f, q, dur, gain, dest = this.bus.view, type = 'bandpass' }) {
    const c = this.ctx;
    const src = c.createBufferSource();
    src.buffer = this.white;
    const filt = c.createBiquadFilter();
    filt.type = type;
    filt.frequency.value = f;
    filt.Q.value = q;
    const env = c.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.linearRampToValueAtTime(gain, t + 0.003);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filt).connect(env).connect(dest);
    src.start(t, Math.random() * 1.5);
    src.stop(t + dur + 0.05);
  }

  /** A pitched blip. @param {number} t @param {{ f: number, f2?: number, dur: number, gain: number, type?: OscillatorType, dest?: AudioNode }} o */
  blip(t, { f, f2, dur, gain, type = 'square', dest }) {
    const c = this.ctx;
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    const env = c.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.linearRampToValueAtTime(gain, t + 0.004);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(env).connect(dest || this.bus.ui);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  /** A crash. `speed` is the closing speed in m/s. @param {number} speed @param {number} [at] */
  impact(speed, at) {
    if (!this.built) return;
    const t = at ?? this.ctx.currentTime;
    const k = clamp(speed / 14, 0.12, 1);
    this.noiseBurst(t, { f: 700 + 900 * k, q: 0.7, dur: 0.12 + 0.3 * k, gain: 0.9 * k, type: 'lowpass' });
    this.noiseBurst(t, { f: 2100, q: 8, dur: 0.18 + 0.4 * k, gain: 0.3 * k });
    this.blip(t, { f: 150 * (1.2 - 0.4 * k), f2: 42, dur: 0.22 + 0.15 * k, gain: 0.9 * k, type: 'sine', dest: this.bus.view });
  }

  /** Menu chirps for the screens. @param {'move' | 'select' | 'back' | 'error'} name @param {number} [at] */
  ui(name, at) {
    if (!this.built) return;
    const t = at ?? this.ctx.currentTime;
    if (name === 'move') this.blip(t, { f: 1320, f2: 1480, dur: 0.045, gain: 0.32 });
    else if (name === 'select') {
      this.blip(t, { f: 880, dur: 0.06, gain: 0.34 });
      this.blip(t + 0.06, { f: 1760, dur: 0.12, gain: 0.34 });
    } else if (name === 'back') {
      this.blip(t, { f: 740, dur: 0.05, gain: 0.3 });
      this.blip(t + 0.05, { f: 494, dur: 0.1, gain: 0.3 });
    } else this.blip(t, { f: 160, f2: 110, dur: 0.18, gain: 0.4 });
  }

  /** Countdown tones for the rally start. @param {'count' | 'go'} kind @param {number} [at] */
  beep(kind, at) {
    if (!this.built) return;
    const t = at ?? this.ctx.currentTime;
    if (kind === 'count') this.blip(t, { f: 880, dur: 0.3, gain: 0.5, type: 'sine' });
    else this.blip(t, { f: 1760, dur: 0.65, gain: 0.5, type: 'sine' });
  }
}

export const audio = new AudioSystem();
