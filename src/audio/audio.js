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

import { SIREN_VOICES } from './siren.js';
import { store } from '../core/store.js';
import { clamp } from '../core/mathx.js';
import { MusicPlayer } from './music.js';
import { PassBy, passbyDuration, passbyGain } from './passby.js';
import { TRAFFIC_VOICES, trafficVoices, hornOf, panOf } from './traffic-voices.js';
import { rainGains } from './rain.js';
import { weatherLook } from '../render/weather.js';

/** @typedef {string} Channel */
/** @typedef {'title' | 'garage' | 'loading' | 'drive' | 'pause' | 'free'} Mode */
/** @typedef {{ volume: number, on: boolean }} ChannelSetting */
/** @typedef {import('./passby.js').PassByEvent} PassByEvent */

export const CHANNELS = /** @type {const} */ (['master', 'engine', 'effects', 'ambience', 'music', 'rain']);

/** @type {Record<Channel, ChannelSetting>} */
const DEFAULTS = {
  master: { volume: 0.85, on: true },
  engine: { volume: 0.9, on: true },
  effects: { volume: 0.9, on: true },
  ambience: { volume: 0.8, on: true },
  music: { volume: 0.55, on: true },
  rain: { volume: 0.85, on: true },
};

/** How loud each part of the world is on each screen. */
const MODES = {
  title: { engine: 0, fx: 0, amb: 0, music: 1, rain: 0 },
  garage: { engine: 0.75, fx: 0, amb: 0, music: 0.8, rain: 0.25 },
  loading: { engine: 0, fx: 0, amb: 0, music: 0.5, rain: 0 },
  drive: { engine: 1, fx: 1, amb: 1, music: 1, rain: 1 },
  pause: { engine: 0, fx: 0, amb: 0.2, music: 0.45, rain: 0.4 },
  free: { engine: 1, fx: 1, amb: 1, music: 1, rain: 1 },
};

/** Low-pass cutoff and loudness of the vehicle sounds per camera. The cockpit is a closed room. */
const VIEW = {
  chase: { lp: 9000, gain: 1 },
  car: { lp: 9500, gain: 1 },
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

/** Peak gain of a siren right beside the player, and of the rotor overhead. */
const SIREN_LEVEL = 0.16;
const ROTOR_LEVEL = 0.9;
/** Peak gain of a nearby car's engine, and of its tires on the road. */
const TRAFFIC_LEVEL = 0.32;
const TRAFFIC_TIRE_LEVEL = 0.2;
/** Peak gain of a horn beside the player, and of a car's tires screeching to a stop. */
const HORN_LEVEL = 0.25;
const SCREECH_LEVEL = 0.5;
/** The nitrous hiss while it flows. */
const N2O_LEVEL = 0.14;

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
    this.blowN = 0;
    this.lastPops = 0;
    this.lastBlow = 0;
    this.lastGear = 1;
    this.lastThrottle = 0;
    this.lastN2o = false;
    this.pumping = false;
    this.music = null;
    /** Watches the nearby traffic for cars going past the player. */
    this.passby = new PassBy();
    /** Called with each recorded track as it starts, for a "now playing" line. */
    this.onTrack = /** @type {((t: import('./soundtrack.js').Track) => void) | null} */ (null);
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
    bus.modeRain = g(0);
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
    bus.viewRain = bq('lowpass', 9500, 0.7);
    bus.viewRainGain = g(1);
    bus.viewRain.connect(bus.viewRainGain);
    bus.viewRainGain.connect(bus.modeRain);
    bus.modeFx.connect(bus.effects);
    bus.modeAmb.connect(bus.ambience);
    bus.musicMode.connect(bus.music);
    bus.modeRain.connect(bus.rain);
    bus.ui = g(0.5);
    bus.ui.connect(bus.effects);
    // The pass-by whoosh is panned to the side the car went past on.
    bus.passPan = c.createStereoPanner ? c.createStereoPanner() : g(1);
    bus.passPan.connect(bus.view);

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
      // Nitrous: a high hiss from the lines while it flows.
      n2o: layer(white, bq('highpass', 3400, 0.7)),
      // Wet tire hiss on tarmac at speed.
      wetTire: layer(white, bq('highpass', 3200, 0.7)),
    };

    // Rain bed, stationary patter and roof drumming (under shelter).
    const rainBedFilter = bq('lowpass', 2400, 0.7);
    const rainBedGain = g(0);
    loop(pink).connect(rainBedFilter).connect(rainBedGain).connect(bus.viewRain);

    const rainPatterFilter = bq('bandpass', 1500, 1.8);
    const rainPatterGain = g(0);
    loop(crackle).connect(rainPatterFilter).connect(rainPatterGain).connect(bus.viewRain);

    const roofPatterFilter = bq('bandpass', 920, 2.5);
    const roofPatterGain = g(0);
    loop(white).connect(roofPatterFilter).connect(roofPatterGain).connect(bus.viewRain);

    this.rainNodes = {
      bedFilter: rainBedFilter, bedGain: rainBedGain,
      patterFilter: rainPatterFilter, patterGain: rainPatterGain,
      roofFilter: roofPatterFilter, roofGain: roofPatterGain,
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

    // Three police sirens: a square and a slightly detuned saw through a band-pass (the horn) into
    // a panner, through the camera low-pass so the cockpit muffles them like the tires.
    this.sirenSlots = Array.from({ length: SIREN_VOICES }, () => {
      const osc = c.createOscillator();
      osc.type = 'square';
      osc.frequency.value = 700;
      const osc2 = c.createOscillator();
      osc2.type = 'sawtooth';
      osc2.frequency.value = 704;
      const horn = bq('bandpass', 1500, 0.8);
      const soft = bq('lowpass', 3600, 0.7);
      const gain = g(0);
      const pan = c.createStereoPanner ? c.createStereoPanner() : g(1);
      osc.connect(horn);
      osc2.connect(g(0.5)).connect(horn);
      horn.connect(soft).connect(gain).connect(pan).connect(bus.view);
      osc.start();
      osc2.start();
      return { osc, osc2, gain, pan, key: -1 };
    });
    // The cars around the player (traffic-voices.js): an engine (its wave and the octave below it)
    // through a low-pass that opens with the revs, and its tires on the road, panned together.
    this.trafficSlots = Array.from({ length: TRAFFIC_VOICES }, () => {
      const osc = c.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = 40;
      const subOsc = c.createOscillator();
      subOsc.type = 'square';
      subOsc.frequency.value = 20;
      const sub = g(0);
      const tone = bq('lowpass', 800, 1.6);
      const gain = g(0);
      const pan = c.createStereoPanner ? c.createStereoPanner() : g(1);
      osc.connect(tone);
      subOsc.connect(sub).connect(tone);
      tone.connect(gain).connect(pan);
      const tire = g(0);
      const tireFilter = bq('bandpass', 900, 0.7);
      loop(white).connect(tireFilter).connect(tire).connect(pan);
      pan.connect(bus.view);
      osc.start();
      subOsc.start();
      return { osc, subOsc, sub, tone, gain, tire, tireFilter, pan, key: -1 };
    });
    // The rotor: low noise chopped by the blade pass.
    {
      const chop = g(0.5);
      const lfoOsc = c.createOscillator();
      lfoOsc.type = 'triangle';
      lfoOsc.frequency.value = 11;
      lfoOsc.connect(g(0.5)).connect(chop.gain);
      lfoOsc.start();
      const level = g(0);
      loop(pink).connect(bq('lowpass', 170, 0.9)).connect(chop).connect(level).connect(bus.view);
      this.rotor = { lfo: lfoOsc, level };
    }

    this.built = true;
    this.applyChannels(0);
    this.setMode(this.mode, 0);
    if (this.spec) this.setCar(this.spec);
    this.music = new MusicPlayer(this);
    this.music.setMode(this.mode, 0);
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
    glide(this.bus.modeRain.gain, m.rain ?? 0, t, 0.3);
    if (mode === 'title' || mode === 'loading') this.pump(false, t);
    this.music?.setMode(mode, t);
  }

  /** @param {'chase' | 'car' | 'hood' | 'bumper' | 'cockpit'} view @param {number} [at] */
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
    const interior = view === 'cockpit';
    glide(this.bus.viewRain.frequency, interior ? 1600 : 9500, t, 0.05);
    glide(this.bus.viewRainGain.gain, interior ? 0.55 : 1, t, 0.05);
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
    this.engine = { node, rpm: p.get('rpm'), load: p.get('load'), boost: p.get('boost'), limiter: p.get('limiter'), on: p.get('on'), bov: p.get('bov'), pop: p.get('pop'), damage: p.get('damage'), overrev: p.get('overrev'), blow: p.get('blow') };
    put(this.engine.rpm, spec.engine.idle, c.currentTime);
    put(this.engine.on, 1, c.currentTime);
    this.bovN = 0;
    this.popN = 0;
    this.blowN = 0;
    this.lastPops = 0;
    this.lastBlow = 0;
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
   * `f.env` the EnvMap result around the car. `f.mountain` (on the pass) and `f.rival` (meters
   * to the nearest street racer) set the music's mood.
   * `f.sirens` are the police sirens heard this frame and `f.rotor` the helicopter (siren.js);
   * `f.pursuit` says the police are after the player, for the music.
   * `f.horns` and `f.screeches` are the civilians' horns and tires since the last frame (manners.js).
   * @param {{ dt: number, state: any, spec: any, boost: number, view: string, env: { forest: number, town: number, water: number }, pad: boolean, mountain?: boolean, rival?: number, rally?: boolean, traffic?: any[], sirens?: ReturnType<typeof import('./siren.js').sirenVoices>, rotor?: { rate: number, gain: number }, pursuit?: boolean, horns?: import('../traffic/manners.js').Horn[], screeches?: import('../traffic/manners.js').Screech[], weather?: number, underRoof?: boolean }} f
   * @param {number} [at]
   */
  update(f, at) {
    if (!this.built || !this.engine) return;
    const t = at ?? this.ctx.currentTime;
    const s = f.state;
    const spec = f.spec;
    const weather = f.weather || 0;
    const wet = weatherLook(weather).wet;
    this.setView(/** @type {any} */ (f.view), t);
    this.music?.setSpeed(f.state.speed * 3.6, t);
    this.music?.setScene(!!f.mountain, f.rival ?? Infinity, !!f.pursuit);
    this.sirens(f.sirens || [], f.rotor || { rate: 0, gain: 0 }, t);
    if (f.traffic) for (const ev of this.passby.update(s, f.traffic)) this.passbyVoice(ev, t);
    this.trafficEngines(f.traffic ? trafficVoices(f.traffic, s, wet) : [], t);
    for (const h of f.horns || []) this.horn(h, s, t);
    for (const k of f.screeches || []) this.screech(k, s, t, wet);

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
    put(e.damage, s.blown ? 1 : s.damage, t);
    put(e.overrev, s.overrev, t);
    if (s.blowCount !== this.lastBlow) {
      this.lastBlow = s.blowCount;
      this.blowN++;
      put(e.blow, this.blowN, t);
    }
    if (s.fx.pops !== this.lastPops) {
      this.lastPops = s.fx.pops;
      this.popN++;
      put(e.pop, this.popN + clamp(s.fx.level, 0.15, 0.95), t);
    }
    this.lastGear = s.gear;
    this.lastThrottle = load;
    const n2o = !!s.n2oOn;
    glide(this.fx.n2o.gain.gain, n2o ? N2O_LEVEL : 0, t, n2o ? 0.03 : 0.08);
    // The solenoid: a thunk as it opens, a short purge as it closes.
    if (n2o !== this.lastN2o) {
      this.lastN2o = n2o;
      if (n2o) this.noiseBurst(t, { f: 300, q: 0.8, dur: 0.06, gain: 0.5, type: 'lowpass' });
      else this.noiseBurst(t, { f: 4200, q: 0.9, dur: 0.35, gain: 0.35, type: 'highpass' });
    }

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
    const sq = loose ? 0 : Math.pow(skidN, 1.2) * 1.9 * (1 - 0.35 * wet);
    const sqTau = 0.04 + 0.04 * wet;
    glide(fx.squeal.gain.gain, sq, t, sqTau);
    glide(fx.squeal2.gain.gain, sq * 0.55, t, sqTau);
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

    if (this.rainNodes) {
      const rg = rainGains(weather, { speed, underRoof: !!f.underRoof });
      const rn = this.rainNodes;
      glide(rn.bedGain.gain, rg.bed, t, 0.25);
      glide(rn.bedFilter.frequency, rg.filterFreq, t, 0.25);
      glide(rn.patterGain.gain, rg.patter, t, 0.2);
      glide(rn.roofGain.gain, rg.roof, t, 0.25);
      if (fx.wetTire) glide(fx.wetTire.gain.gain, rg.wetTire, t, 0.1);
    }
  }

  /**
   * The police sirens and the helicopter rotor for this frame. Each siren voice follows one unit
   * (by its key) so a car's sweep does not jump between voices; a voice with no unit fades out.
   * @param {ReturnType<typeof import('./siren.js').sirenVoices>} voices
   * @param {{ rate: number, gain: number }} rotor @param {number} t
   */
  sirens(voices, rotor, t) {
    const slots = this.sirenSlots;
    if (!slots) return;
    const used = new Set();
    for (const v of voices) {
      let slot = slots.find((s) => s.key === v.key);
      if (!slot) slot = slots.find((s) => !used.has(s) && !voices.some((w) => w.key === s.key));
      if (!slot) continue;
      used.add(slot);
      slot.key = v.key;
      glide(slot.osc.frequency, v.pitch, t, 0.012);
      glide(slot.osc2.frequency, v.pitch * 1.006, t, 0.012);
      glide(slot.gain.gain, v.gain * SIREN_LEVEL, t, 0.05);
      if ('pan' in slot.pan) glide(slot.pan.pan, v.pan * 0.8, t, 0.05);
    }
    for (const s of slots) {
      if (used.has(s)) continue;
      s.key = -1;
      glide(s.gain.gain, 0, t, 0.15);
    }
    glide(this.rotor.lfo.frequency, Math.max(1, rotor.rate), t, 0.2);
    glide(this.rotor.level.gain, rotor.gain * ROTOR_LEVEL, t, 0.2);
  }

  /**
   * The engines and tires of the nearest cars for this frame. As with the sirens, each voice
   * follows one car by its key so a pass sweeps down smoothly; a voice with no car fades out.
   * @param {import('./traffic-voices.js').TrafficVoice[]} voices @param {number} t
   */
  trafficEngines(voices, t) {
    const slots = this.trafficSlots;
    if (!slots) return;
    const used = new Set();
    for (const v of voices) {
      let slot = slots.find((s) => s.key === v.key);
      const fresh = !slot;
      if (!slot) slot = slots.find((s) => !used.has(s) && !voices.some((w) => w.key === s.key));
      if (!slot) continue;
      used.add(slot);
      slot.key = v.key;
      if (slot.osc.type !== v.wave) slot.osc.type = v.wave;
      // A new car starts at its own pitch; one already heard glides, so the Doppler drop is smooth.
      const lag = fresh ? 0.001 : 0.05;
      glide(slot.osc.frequency, v.pitch, t, lag);
      glide(slot.subOsc.frequency, v.pitch / 2, t, lag);
      glide(slot.sub.gain, v.sub, t, 0.1);
      glide(slot.tone.frequency, v.cutoff, t, 0.08);
      glide(slot.gain.gain, v.gain * TRAFFIC_LEVEL, t, 0.08);
      glide(slot.tire.gain, v.tire * TRAFFIC_TIRE_LEVEL, t, 0.08);
      if (slot.tireFilter) glide(slot.tireFilter.frequency, v.tireFilter ?? 900, t, 0.08);
      if ('pan' in slot.pan) glide(slot.pan.pan, v.pan * 0.85, t, 0.06);
    }
    for (const s of slots) {
      if (used.has(s)) continue;
      s.key = -1;
      glide(s.gain.gain, 0, t, 0.2);
      glide(s.tire.gain, 0, t, 0.2);
    }
  }

  /**
   * A civilian's horn: its two notes together through a band-pass, as a quick tap, a long lean or
   * two taps, panned to where the car is.
   * @param {import('../traffic/manners.js').Horn} h @param {{ x: number, z: number, yaw: number }} player @param {number} t
   */
  horn(h, player, t) {
    const d = Math.hypot(h.x - player.x, h.z - player.z);
    const { notes, wave, gain } = hornOf(h.kind, d);
    if (gain < 0.01) return;
    const c = this.ctx;
    const out = c.createGain();
    out.gain.value = 0;
    const pan = c.createStereoPanner ? c.createStereoPanner() : c.createGain();
    if ('pan' in pan) pan.pan.value = panOf(player, h.x, h.z) * 0.85;
    const band = c.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = notes[1] * 2.2;
    band.Q.value = 0.9;
    band.connect(out).connect(pan).connect(this.bus.view);
    const blasts = h.blast === 'double' ? [[0, 0.16], [0.28, 0.2]] : h.blast === 'long' ? [[0, 0.85]] : [[0, 0.28]];
    const peak = gain * HORN_LEVEL;
    for (const [at, len] of blasts) {
      out.gain.setValueAtTime(0, t + at);
      out.gain.linearRampToValueAtTime(peak, t + at + 0.015);
      out.gain.setValueAtTime(peak, t + at + len);
      out.gain.linearRampToValueAtTime(0, t + at + len + 0.04);
    }
    const end = t + blasts[blasts.length - 1][0] + blasts[blasts.length - 1][1] + 0.1;
    for (const f of notes) {
      const o = c.createOscillator();
      o.type = wave;
      o.frequency.value = f;
      o.connect(band);
      o.start(t);
      o.stop(end);
    }
  }

  /**
   * A civilian's tires screeching as it brakes hard: a narrow band of noise that falls in pitch as
   * the car slows, longer from a higher speed.
   * @param {import('../traffic/manners.js').Screech} k @param {{ x: number, z: number, yaw: number }} player @param {number} t @param {number} [wet]
   */
  screech(k, player, t, wet = 0) {
    const d = Math.hypot(k.x - player.x, k.z - player.z);
    if (d > 120) return;
    const wetFactor = 1 - 0.35 * clamp(wet, 0, 1);
    const gain = (1 / (1 + d / 10)) * (1 - d / 120) * SCREECH_LEVEL * wetFactor;
    const dur = Math.min(1.8, (0.35 + k.speed * 0.035) * (1 + 0.35 * clamp(wet, 0, 1)));
    const c = this.ctx;
    const src = c.createBufferSource();
    src.buffer = this.white;
    const band = c.createBiquadFilter();
    band.type = 'bandpass';
    band.Q.value = 7;
    band.frequency.setValueAtTime(1500, t);
    band.frequency.exponentialRampToValueAtTime(1050, t + dur);
    const env = c.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.linearRampToValueAtTime(gain, t + 0.05);
    env.gain.setValueAtTime(gain, t + dur * 0.7);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const pan = c.createStereoPanner ? c.createStereoPanner() : c.createGain();
    if ('pan' in pan) pan.pan.value = panOf(player, k.x, k.z) * 0.85;
    src.connect(band).connect(env).connect(pan).connect(this.bus.view);
    src.start(t, Math.random() * 1.5);
    src.stop(t + dur + 0.05);
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

  /** A unit taken out: the crash, a deep boom under it and a ring of torn metal. @param {number} [at] */
  takedown(at) {
    if (!this.built) return;
    const t = at ?? this.ctx.currentTime;
    this.impact(20, t);
    this.blip(t + 0.02, { f: 95, f2: 28, dur: 0.65, gain: 1.0, type: 'sine', dest: this.bus.view });
    this.noiseBurst(t + 0.03, { f: 3400, q: 12, dur: 0.55, gain: 0.25 });
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

  /**
   * The whoosh of a car going past. Filtered noise with a swell and a decay, a band-pass that
   * sweeps down through the pass (Doppler) and a low rumble for the heavy vehicles, through the
   * effects channel and the camera low-pass so the cockpit muffles it like the tires.
   * @param {PassByEvent} ev @param {number} [at]
   */
  passbyVoice(ev, at) {
    if (!this.built) return;
    const t = at ?? this.ctx.currentTime;
    const speed = ev.speed;
    const gain = passbyGain(speed, ev.dist, ev.heavy);
    if (gain < 0.02) return;
    const dur = passbyDuration(speed);
    if (this.bus.passPan.pan) put(this.bus.passPan.pan, ev.side * 0.85, t);
    const swell = dur * 0.34;
    // The noise, band-passed and sweeping down as the car recedes.
    const src = this.ctx.createBufferSource();
    src.buffer = this.white;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 1.4;
    bp.frequency.setValueAtTime(Math.min(520 + speed * 34, 5200), t);
    bp.frequency.exponentialRampToValueAtTime(Math.max((520 + speed * 34) * 0.42, 180), t + dur);
    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.linearRampToValueAtTime(gain * 1.7, t + swell);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(bp).connect(env).connect(this.bus.passPan);
    src.start(t, Math.random() * 1.5);
    src.stop(t + dur + 0.05);
    if (ev.heavy) {
      const rumble = this.ctx.createBiquadFilter();
      rumble.type = 'lowpass';
      rumble.frequency.value = 110;
      const rg = this.ctx.createGain();
      rg.gain.setValueAtTime(0.0001, t);
      rg.gain.linearRampToValueAtTime(gain * 1.0, t + swell);
      rg.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(rumble).connect(rg).connect(this.bus.passPan);
    }
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
