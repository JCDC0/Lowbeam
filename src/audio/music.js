/**
 * The music player. In the browser it streams the recorded soundtrack (soundtrack.js
 * decides the mood and the next track) through media elements, crossfading between tracks:
 * it switches early when the mood goes up (a racer appears, the car reaches the pass) and
 * lets a track finish when the mood comes down. Streaming keeps memory low; decoding all
 * eight tracks up front would take about 500 MB.
 *
 * The synthesized tracks are the fallback when the files cannot play, and what renders on an
 * offline context: it turns the note events from songs.js into sound with a small
 * synthesizer built from Web Audio nodes, and mixes the layers by speed so the music
 * builds as the car gets faster (pads and bass when parked, then the arpeggio, the drums
 * and finally the lead). Scheduling looks ahead of the audio clock, so a busy main thread
 * does not make the beat stutter, and the same code renders offline through `renderAhead`.
 */

import { composeTrack, midiToHz, LAYERS, TRACKS } from './songs.js';
import { SOUNDTRACK, OPTIONS, ENERGY, MANIFEST, MoodTracker, SpeedSwell, Shuffler, nextTrack, poolFor, parseManifest, setSoundtrack, trackGain } from './soundtrack.js';
import { clamp } from '../core/mathx.js';

/**
 * Level of the recorded tracks (already leveled to TARGET_LUFS) before the music channel. At
 * 1.0 they measure about 1.3 times quieter than the synthesized tracks did at the same settings.
 */
const FILE_LEVEL = 1.0;
/** Seconds two recorded tracks overlap when one hands over to the next. */
const CROSSFADE = 3;
/** A track that came in on a mood change plays at least this long before another one may cut in. */
const MIN_DWELL = 20;
/** Synthesized track that stands in for each mood when no file of it can play. */
const SYNTH_FOR = { menu: 'menu', cruise: 'kirigaoka', intense: 'lowbeam', mountain: 'ridge', pursuit: 'lowbeam', locked: 'kirigaoka' };
/** Low-pass cutoff (Hz) of the recorded tracks at swell 0; it opens an octave per sixth of the swell. */
const SWELL_CUTOFF = 320;
/** A track is announced (NOW PLAYING) once the swell makes it this loud. */
const SWELL_AUDIBLE = 0.15;

/** @typedef {import('./songs.js').NoteEvent} NoteEvent */
/** @typedef {import('./songs.js').Layer} Layer */

/** Seconds of notes scheduled ahead of the audio clock. A hidden tab may only tick once a second. */
const LOOKAHEAD = 1.4;
const TICK_MS = 100;
/** Overall level of the soundtrack before the music channel and master. */
const TRACK_LEVEL = 0.9;
/** How many times each driving track plays before the next one. */
const DRIVE_LOOPS = 2;
const DRIVE_PLAYLIST = ['kirigaoka', 'lowbeam'];

/** Relative loudness of each layer. */
const LEVEL = { pad: 0.55, bass: 0.8, arp: 0.5, lead: 0.55, kick: 0.95, snare: 0.6, hat: 0.34, perc: 0.55 };

/** Layer gain for a speed in km/h. Menu tracks ignore speed. @param {Layer} layer @param {number} kmh */
export function speedMix(layer, kmh) {
  const ramp = (a, b) => clamp((kmh - a) / (b - a), 0, 1);
  switch (layer) {
    case 'bass': return 0.55 + 0.45 * ramp(0, 15);
    case 'arp': return ramp(4, 24);
    case 'hat': return ramp(20, 50);
    case 'kick':
    case 'snare':
    case 'perc': return ramp(28, 62);
    case 'lead': return ramp(75, 115);
    default: return 1;
  }
}

/** A stereo room impulse: noise with a smooth exponential tail. @param {BaseAudioContext} c @param {number} seconds */
function reverbImpulse(c, seconds) {
  const n = Math.round(c.sampleRate * seconds);
  const buf = c.createBuffer(2, n, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let lp = 0;
    for (let i = 0; i < n; i++) {
      lp += ((Math.random() * 2 - 1) - lp) * 0.45;
      d[i] = lp * Math.pow(1 - i / n, 2.6);
    }
  }
  return buf;
}

/** One playing track: its own nodes, scheduling position and layer gains. */
class Playback {
  /**
   * @param {MusicPlayer} music @param {string} id @param {number} startAt context time
   * @param {{ loops: number, fadeIn: number }} opts
   */
  constructor(music, id, startAt, { loops, fadeIn }) {
    const c = music.ctx;
    this.music = music;
    this.id = id;
    this.track = composeTrack(id);
    this.spb = 60 / this.track.bpm;
    this.loopStart = startAt;
    this.endAt = Infinity;
    this.maxLoops = loops;
    this.loop = 0;
    this.index = 0;
    this.dead = false;
    this.finished = false;
    this.out = c.createGain();
    this.out.gain.setValueAtTime(fadeIn > 0 ? 0 : 1, startAt);
    if (fadeIn > 0) this.out.gain.linearRampToValueAtTime(1, startAt + fadeIn);
    this.out.connect(music.input);
    /** @type {Record<string, GainNode>} */
    this.layers = {};
    for (const l of LAYERS) {
      const g = c.createGain();
      g.gain.value = 0;
      g.connect(this.out);
      this.layers[l] = g;
    }
    this.duck = c.createGain();
    this.duck.connect(this.layers.pad);
    this.duckArp = c.createGain();
    this.duckArp.connect(this.layers.arp);
    music.delay.delayTime.setValueAtTime(this.spb * 0.75, startAt);
    this.setSpeed(0, startAt, true);
  }

  /** @param {number} kmh @param {number} at @param {boolean} [snap] */
  setSpeed(kmh, at, snap = false) {
    const menu = this.id === 'menu';
    for (const l of LAYERS) {
      const target = LEVEL[l] * (menu ? 1 : speedMix(l, kmh));
      const p = this.layers[l].gain;
      p.cancelScheduledValues(at);
      if (snap) p.setValueAtTime(target, at);
      else p.setTargetAtTime(target, at, 0.6);
    }
  }

  /**
   * Schedules every event that starts before `until`. Events already in the past (a tab
   * that was throttled) are skipped rather than played late all at once.
   * @param {number} until @param {number} [now]
   */
  schedule(until, now = -Infinity) {
    const ev = this.track.events;
    while (!this.finished) {
      const e = ev[this.index];
      const t = this.loopStart + e.t * this.spb;
      if (t >= until) return;
      if (t >= now - 0.02) this.play(e, t);
      this.index++;
      if (this.index >= ev.length) {
        this.index = 0;
        this.loopStart += this.track.loopBeats * this.spb;
        this.loop++;
        if (this.loop >= this.maxLoops) {
          this.finished = true;
          this.endAt = this.loopStart;
        }
      }
    }
  }

  /** @param {NoteEvent} e @param {number} t */
  play(e, t) {
    const m = this.music;
    const spb = this.spb;
    const dur = Math.max(0.05, e.dur * spb);
    const hz = midiToHz(e.midi);
    const v = e.vel;
    const bright = this.track.def.bright;
    switch (e.layer) {
      case 'pad': m.pad(this.duck, t, hz, dur, v, bright); break;
      case 'bass': m.bass(this.layers.bass, t, hz, dur, v, bright); break;
      case 'arp': m.arp(this.duckArp, t, hz, dur, v, bright); break;
      case 'lead': m.lead(this.layers.lead, t, hz, dur, v, bright); break;
      case 'kick':
        m.kick(this.layers.kick, t, v);
        if (this.track.def.sidechain) {
          /** @type {[AudioParam, number][]} */
          const pumps = [[this.duck.gain, 0.3], [this.duckArp.gain, 0.65]];
          for (const [g, depth] of pumps) {
            g.setValueAtTime(depth, t);
            g.linearRampToValueAtTime(1, t + spb * 0.55);
          }
        }
        break;
      case 'snare': m.snare(this.layers.snare, t, v); break;
      case 'hat': m.hat(this.layers.hat, t, v, !!e.open); break;
      case 'perc': m.tom(this.layers.perc, t, hz, v); break;
      default: break;
    }
  }

  /** Fades out and marks for removal. @param {number} at @param {number} fade */
  stop(at, fade) {
    this.finished = true;
    this.out.gain.cancelScheduledValues(at);
    this.out.gain.setValueAtTime(this.out.gain.value, at);
    this.out.gain.linearRampToValueAtTime(0, at + fade);
    this.deadAt = at + fade + 4;
  }
}

/** One recorded track streaming from its file through a media element. */
class Stream {
  /**
   * @param {MusicPlayer} music @param {import('./soundtrack.js').Track} track
   * @param {string} mood the mood it was picked for, or 'locked'
   * @param {number} at context time to start @param {number} fade seconds of fade-in
   */
  constructor(music, track, mood, at, fade) {
    const c = /** @type {AudioContext} */ (music.ctx);
    this.track = track;
    this.mood = mood;
    this.started = at;
    this.failed = false;
    this.blocked = false;
    this.announced = false;
    this.stopAt = Infinity;
    this.el = new Audio();
    this.el.preload = 'auto';
    this.el.src = track.url || `assets/music/${track.file.split('/').map(encodeURIComponent).join('/')}`;
    this.el.addEventListener('error', () => {
      this.failed = true;
    });
    this.node = c.createMediaElementSource(this.el);
    this.out = c.createGain();
    const g = trackGain(track);
    this.out.gain.setValueAtTime(0, at);
    this.out.gain.linearRampToValueAtTime(g, at + Math.max(0.05, fade));
    this.node.connect(this.out).connect(music.files);
    this.play();
  }

  /** Starts the element; a browser that wants a click first is retried on the next tick. */
  play() {
    this.blocked = false;
    this.el.play().catch((e) => {
      if (e && e.name === 'NotAllowedError') this.blocked = true;
      else this.failed = true;
    });
  }

  /** Seconds left before the end of the file, Infinity until its length is known. */
  remaining() {
    const d = this.el.duration;
    return Number.isFinite(d) ? d - this.el.currentTime : Infinity;
  }

  /** @param {number} at @param {number} fade */
  stop(at, fade) {
    const g = this.out.gain;
    g.cancelScheduledValues(at);
    g.setValueAtTime(g.value, at);
    g.linearRampToValueAtTime(0, at + fade);
    this.stopAt = at + fade + 0.2;
  }

  dispose() {
    this.el.pause();
    this.el.removeAttribute('src');
    this.el.load();
    this.node.disconnect();
    this.out.disconnect();
  }
}

export class MusicPlayer {
  /** @param {import('./audio.js').AudioSystem} audio */
  constructor(audio) {
    this.audio = audio;
    this.ctx = /** @type {BaseAudioContext} */ (audio.ctx);
    const c = this.ctx;
    this.input = c.createGain();
    this.input.gain.value = TRACK_LEVEL;
    this.input.connect(audio.musicBus);

    this.white = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
    const d = this.white.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;

    this.verb = c.createConvolver();
    this.verb.buffer = reverbImpulse(c, 2.4);
    this.verbIn = c.createGain();
    this.verbIn.gain.value = 0.35;
    this.verbIn.connect(this.verb);
    this.verb.connect(this.input);

    this.delay = c.createDelay(2);
    this.delay.delayTime.value = 0.4;
    const fb = c.createGain();
    fb.gain.value = 0.36;
    const tone = c.createBiquadFilter();
    tone.type = 'lowpass';
    tone.frequency.value = 2600;
    this.delayIn = c.createGain();
    this.delayIn.gain.value = 0.4;
    this.delayIn.connect(this.delay);
    this.delay.connect(tone).connect(fb).connect(this.delay);
    tone.connect(this.input);

    /** @type {Playback[]} */
    this.playbacks = [];
    /** @type {Playback | null} */
    this.current = null;
    this.kmh = 0;
    this.playlistIndex = 0;
    this.override = null;
    this.timer = 0;
    this.live = !('startRendering' in c);

    this.files = c.createGain();
    this.files.gain.value = FILE_LEVEL;
    this.swellLp = c.createBiquadFilter();
    this.swellLp.type = 'lowpass';
    this.swellLp.Q.value = 0.9;
    this.swellLp.frequency.value = 20000;
    this.swellGain = c.createGain();
    this.files.connect(this.swellLp).connect(this.swellGain).connect(audio.musicBus);
    /** Speed swell of the recorded tracks while driving (see SWELL in soundtrack.js). */
    this.swell = new SpeedSwell();
    /** Stream the recorded soundtrack; off on an offline context, which renders the synth. */
    this.recorded = this.live && typeof Audio !== 'undefined';
    /** @type {Stream | null} */
    this.stream = null;
    /** @type {Stream[]} */
    this.fading = [];
    /** Track ids that failed to load; their mood falls back to another file, then the synth. */
    this.broken = new Set();
    this.moods = new MoodTracker();
    this.scene = { kmh: 0, mountain: false, rival: Infinity, rally: false, pursuit: false };
    this.mode = /** @type {import('./audio.js').Mode} */ ('title');
    this.shuffler = new Shuffler();
    this.lastId = /** @type {string | null} */ (null);
    this.lastTick = c.currentTime;
    this.switchedAt = -Infinity;

    /** False until the track list has loaded or failed: until then nothing is chosen, so no synthesized track starts for a moment. */
    this.loaded = !this.recorded;
    if (this.live) this.timer = window.setInterval(() => this.tick(), TICK_MS);
    if (this.recorded) this.loadManifest().finally(() => { this.loaded = true; });
  }

  /** Reads the track list (assets/music/tracks.json) and plays from it from the next track on. */
  async loadManifest() {
    try {
      const res = await fetch(MANIFEST, { cache: 'no-store' });
      if (!res.ok) return;
      const { tracks, folders, skipped } = parseManifest(await res.json());
      if (skipped.length) console.warn(`music: ${MANIFEST} skipped ${skipped.join(', ')}`);
      if (!setSoundtrack(tracks, folders)) console.warn(`music: ${MANIFEST} has no track; the synthesized music plays`);
    } catch (err) {
      // No manifest, or one that does not parse: the synthesized music plays.
      console.warn('music: no track list', err);
    }
  }

  /** @param {import('./audio.js').Mode} mode @param {number} [at] */
  setMode(mode, at) {
    const t = at ?? this.ctx.currentTime;
    const menu = mode === 'title' || mode === 'garage' || mode === 'loading';
    this.mode = mode;
    if (this.recorded) {
      if (this.live) this.tick();
      return;
    }
    if (this.override) return;
    if (menu) {
      if (!this.current || this.current.id !== 'menu') this.play('menu', t, { loops: Infinity, fade: 1.2 });
    } else if (!this.current || this.current.id === 'menu') this.play(DRIVE_PLAYLIST[this.playlistIndex], t, { loops: DRIVE_LOOPS, fade: 1.2 });
  }

  /**
   * Starts a track, fading the current one out. @param {string} id @param {number} [at]
   * @param {{ loops?: number, fade?: number }} [opts]
   */
  play(id, at, { loops = DRIVE_LOOPS, fade = 1 } = {}) {
    if (!TRACKS[id]) return;
    const t = Math.max(at ?? 0, this.live ? this.ctx.currentTime : 0) + 0.05;
    if (this.current) this.current.stop(t, fade);
    const pb = new Playback(this, id, t, { loops, fadeIn: fade });
    pb.setSpeed(this.kmh, t, true);
    this.current = pb;
    this.playbacks.push(pb);
    if (this.live) this.tick();
  }

  /**
   * Holds a track (the rally stage) until `release`. With the recorded soundtrack `ridge`
   * means the mountain tracks.
   * @param {string} id
   */
  hold(id) {
    this.override = id;
    if (this.recorded) this.tick();
    else this.play(id, undefined, { loops: Infinity, fade: 0.8 });
  }

  release() {
    this.override = null;
    this.setMode(this.audio.mode);
  }

  /** @param {number} kmh @param {number} [at] */
  setSpeed(kmh, at) {
    this.kmh = kmh;
    this.scene.kmh = kmh;
    if (this.current) this.current.setSpeed(kmh, at ?? this.ctx.currentTime);
  }

  /**
   * What the driving looks like, for the mood: whether the car is on the pass, how far the
   * nearest street racer is (meters, Infinity for none), and whether the police are after it.
   * @param {boolean} mountain @param {number} rival @param {boolean} [pursuit]
   */
  setScene(mountain, rival, pursuit = false) {
    this.scene.mountain = mountain;
    this.scene.rival = rival;
    this.scene.pursuit = pursuit;
  }

  /** The mood the music should be in right now. @returns {import('./soundtrack.js').Mood} */
  wantedMood() {
    if (this.override) return 'mountain';
    const m = this.mode;
    if (m === 'title' || m === 'garage' || m === 'loading') return 'menu';
    return this.moods.mood;
  }

  /** What is playing, for checks: the recorded track or the synthesized one. */
  nowPlaying() {
    if (this.stream) return { id: this.stream.track.id, title: this.stream.track.title, mood: this.stream.mood, time: this.stream.el.currentTime, file: true, swell: this.swell.level };
    return this.current ? { id: this.current.id, title: this.current.id, mood: null, time: 0, file: false } : null;
  }

  /**
   * Starts the next recorded track of a mood, crossfading from the one playing. Falls back to
   * the synthesized track for that mood when every file of it has failed.
   * @param {string} mood a mood, or 'locked' while one folder plays on its own
   * @param {number} t @param {number} fade
   */
  startMood(mood, t, fade) {
    let track = nextTrack(mood, this.lastId, this.shuffler);
    for (let i = 0; track && i < SOUNDTRACK.length && this.broken.has(track.id); i++) track = nextTrack(mood, track.id, this.shuffler);
    if (this.stream) {
      this.stream.stop(t, fade);
      this.fading.push(this.stream);
      this.stream = null;
    }
    if (!track || this.broken.has(track.id)) {
      const synth = SYNTH_FOR[mood] || SYNTH_FOR.cruise;
      if (!this.current || this.current.id !== synth || this.current.finished) this.play(synth, t, { loops: Infinity, fade });
      return;
    }
    if (this.current && !this.current.finished) {
      this.current.stop(t, fade);
      this.current = null;
    }
    this.lastId = track.id;
    this.stream = new Stream(this, track, mood, t, fade);
    this.switchedAt = t;
  }

  /**
   * Sets the swell from the speed: full on the menus, held in pause, following the speed while
   * driving. Gain and the low-pass glide toward it. @param {number} dt @param {number} now
   */
  applySwell(dt, now) {
    const m = this.mode;
    if (m === 'drive' || m === 'free') this.swell.update(dt, this.scene);
    else if (m !== 'pause') this.swell.reset();
    const level = m === 'drive' || m === 'free' || m === 'pause' ? this.swell.level : 1;
    this.swellGain.gain.setTargetAtTime(level, now, 0.25);
    this.swellLp.frequency.setTargetAtTime(Math.min(20000, SWELL_CUTOFF * 2 ** (level * 6)), now, 0.25);
    const s = this.stream;
    if (s && !s.announced && level >= SWELL_AUDIBLE) {
      s.announced = true;
      this.audio.onTrack?.(s.track);
    }
  }

  /** The recorded soundtrack's part of a tick. @param {number} now */
  tickRecorded(now) {
    if (!this.loaded) return;
    const dt = Math.min(1, now - this.lastTick);
    this.lastTick = now;
    if (this.mode === 'drive' || this.mode === 'free') this.moods.update(dt, this.scene);
    const want = OPTIONS.lock ? 'locked' : this.wantedMood();
    const s = this.stream;
    if (s && s.failed) {
      this.broken.add(s.track.id);
      this.startMood(want, now, 0.5);
    } else if (s && s.blocked) s.play();
    if (!this.stream) {
      const playingSynth = this.current && !this.current.finished && this.current.id === (SYNTH_FOR[want] || SYNTH_FOR.cruise);
      if (!playingSynth || poolFor(want).some((tr) => !this.broken.has(tr.id))) this.startMood(want, now, 1.5);
    } else if (this.stream.mood !== want) {
      const menuChange = want === 'menu' || this.stream.mood === 'menu';
      const chase = want === 'pursuit';
      const up = ENERGY[want] > ENERGY[this.stream.mood];
      const dwelt = now - this.switchedAt > MIN_DWELL;
      if (menuChange || chase || (up && dwelt) || this.override) this.startMood(want, now, menuChange || chase ? 1.5 : CROSSFADE);
    }
    if (this.stream && this.stream.remaining() < CROSSFADE) this.startMood(want, now, CROSSFADE);
    this.applySwell(dt, now);
    this.fading = this.fading.filter((f) => {
      if (now < f.stopAt) return true;
      f.dispose();
      return false;
    });
  }

  tick() {
    const now = this.ctx.currentTime;
    if (this.recorded) this.tickRecorded(now);
    for (const pb of this.playbacks) {
      if (!pb.finished) pb.schedule(now + LOOKAHEAD, now);
      if (pb === this.current && pb.finished && pb.endAt !== Infinity && this.current.id !== 'menu' && !this.override) this.next(pb.endAt);
    }
    this.playbacks = this.playbacks.filter((pb) => !(pb.deadAt && now > pb.deadAt) && !(pb.finished && pb.endAt !== Infinity && now > pb.endAt + 6));
  }

  /** The next driving track starts where the last one ends, with no gap. @param {number} at */
  next(at) {
    this.playlistIndex = (this.playlistIndex + 1) % DRIVE_PLAYLIST.length;
    const pb = new Playback(this, DRIVE_PLAYLIST[this.playlistIndex], at, { loops: DRIVE_LOOPS, fadeIn: 0 });
    pb.setSpeed(this.kmh, at, true);
    this.current = pb;
    this.playbacks.push(pb);
  }

  /** Schedules everything up to `seconds` on an offline context. @param {number} seconds */
  renderAhead(seconds) {
    for (const pb of this.playbacks) pb.schedule(seconds);
    if (this.current && this.current.finished && this.current.endAt < seconds && this.current.id !== 'menu') {
      this.next(this.current.endAt);
      this.renderAhead(seconds);
    }
  }

  // Voices. Each takes the node to connect to, a start time and the note.

  /** @param {AudioNode} dest @param {number} t @param {number} hz @param {number} dur @param {number} v @param {number} bright */
  pad(dest, t, hz, dur, v, bright) {
    const c = this.ctx;
    const env = c.createGain();
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(500 * bright, t);
    lp.frequency.linearRampToValueAtTime((1100 + 900 * v) * bright, t + dur * 0.6);
    lp.Q.value = 0.6;
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(0.11 * v, t + 0.55);
    env.gain.setValueAtTime(0.11 * v, t + dur);
    env.gain.linearRampToValueAtTime(0, t + dur + 1.1);
    for (const det of [-8, 8]) {
      const o = c.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = hz;
      o.detune.value = det;
      o.connect(lp);
      o.start(t);
      o.stop(t + dur + 1.2);
    }
    lp.connect(env).connect(dest);
    env.connect(this.verbIn);
  }

  bass(dest, t, hz, dur, v, bright) {
    const c = this.ctx;
    const env = c.createGain();
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = 3;
    lp.frequency.setValueAtTime(1000 * bright * (0.6 + 0.5 * v), t);
    lp.frequency.exponentialRampToValueAtTime(190 * bright, t + Math.min(0.35, dur));
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(0.38 * v, t + 0.006);
    env.gain.setValueAtTime(0.38 * v, t + Math.max(0.02, dur - 0.05));
    env.gain.linearRampToValueAtTime(0, t + dur + 0.04);
    const saw = c.createOscillator();
    saw.type = 'sawtooth';
    saw.frequency.value = hz;
    const sub = c.createOscillator();
    sub.type = 'sine';
    sub.frequency.value = hz;
    const subGain = c.createGain();
    subGain.gain.value = 0.9;
    saw.connect(lp);
    sub.connect(subGain).connect(env);
    lp.connect(env);
    env.connect(dest);
    for (const o of [saw, sub]) {
      o.start(t);
      o.stop(t + dur + 0.1);
    }
  }

  arp(dest, t, hz, dur, v, bright) {
    const c = this.ctx;
    const env = c.createGain();
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(3600 * bright * (0.6 + 0.6 * v), t);
    lp.frequency.exponentialRampToValueAtTime(900 * bright, t + 0.22);
    const decay = Math.max(0.2, dur * 1.8);
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(0.2 * v, t + 0.003);
    env.gain.exponentialRampToValueAtTime(0.0008, t + decay);
    const o = c.createOscillator();
    o.type = 'square';
    o.frequency.value = hz;
    const o2 = c.createOscillator();
    o2.type = 'sawtooth';
    o2.frequency.value = hz;
    o2.detune.value = 9;
    const g2 = c.createGain();
    g2.gain.value = 0.5;
    o.connect(lp);
    o2.connect(g2).connect(lp);
    lp.connect(env).connect(dest);
    env.connect(this.delayIn);
    for (const x of [o, o2]) {
      x.start(t);
      x.stop(t + decay + 0.05);
    }
  }

  lead(dest, t, hz, dur, v, bright) {
    const c = this.ctx;
    const env = c.createGain();
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 2800 * bright;
    lp.Q.value = 1.2;
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(0.16 * v, t + 0.025);
    env.gain.setValueAtTime(0.14 * v, t + Math.max(0.05, dur - 0.05));
    env.gain.linearRampToValueAtTime(0, t + dur + 0.25);
    const vib = c.createOscillator();
    vib.frequency.value = 5.4;
    const vibDepth = c.createGain();
    vibDepth.gain.setValueAtTime(0, t);
    vibDepth.gain.linearRampToValueAtTime(9, t + 0.35);
    vib.connect(vibDepth);
    vib.start(t);
    vib.stop(t + dur + 0.3);
    for (const det of [-6, 6]) {
      const o = c.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = hz;
      o.detune.value = det;
      vibDepth.connect(o.detune);
      o.connect(lp);
      o.start(t);
      o.stop(t + dur + 0.3);
    }
    lp.connect(env).connect(dest);
    env.connect(this.delayIn);
    env.connect(this.verbIn);
  }

  kick(dest, t, v) {
    const c = this.ctx;
    const o = c.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(165, t);
    o.frequency.exponentialRampToValueAtTime(46, t + 0.18);
    const env = c.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(0.85 * v, t + 0.002);
    env.gain.exponentialRampToValueAtTime(0.001, t + 0.34);
    o.connect(env).connect(dest);
    o.start(t);
    o.stop(t + 0.4);
    this.noise(dest, t, { f: 3200, q: 0.8, type: 'lowpass', dur: 0.012, gain: 0.25 * v });
  }

  snare(dest, t, v) {
    const c = this.ctx;
    this.noise(dest, t, { f: 1900, q: 0.7, type: 'bandpass', dur: 0.19, gain: 0.55 * v, send: this.verbIn });
    const o = c.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(230, t);
    o.frequency.exponentialRampToValueAtTime(165, t + 0.09);
    const env = c.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(0.4 * v, t + 0.002);
    env.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    o.connect(env).connect(dest);
    o.start(t);
    o.stop(t + 0.15);
  }

  hat(dest, t, v, open) {
    this.noise(dest, t, { f: 7600, q: 0.7, type: 'highpass', dur: open ? 0.22 : 0.045, gain: 0.3 * v });
  }

  tom(dest, t, hz, v) {
    const c = this.ctx;
    const o = c.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(hz * 3, t);
    o.frequency.exponentialRampToValueAtTime(hz * 1.4, t + 0.2);
    const env = c.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(0.55 * v, t + 0.003);
    env.gain.exponentialRampToValueAtTime(0.001, t + 0.26);
    o.connect(env).connect(dest);
    o.start(t);
    o.stop(t + 0.3);
  }

  /** Enveloped filtered noise. @param {AudioNode} dest @param {number} t @param {{ f: number, q: number, type: BiquadFilterType, dur: number, gain: number, send?: AudioNode }} o */
  noise(dest, t, { f, q, type, dur, gain, send }) {
    const c = this.ctx;
    const src = c.createBufferSource();
    src.buffer = this.white;
    const filt = c.createBiquadFilter();
    filt.type = type;
    filt.frequency.value = f;
    filt.Q.value = q;
    const env = c.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(gain, t + 0.002);
    env.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    src.connect(filt).connect(env).connect(dest);
    if (send) env.connect(send);
    src.start(t, Math.random() * 1.5);
    src.stop(t + dur + 0.05);
  }

  dispose() {
    if (this.timer) clearInterval(this.timer);
    for (const st of [this.stream, ...this.fading]) st?.dispose();
    this.stream = null;
    this.fading = [];
  }
}
