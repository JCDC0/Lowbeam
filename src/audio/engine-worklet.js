// @ts-nocheck -- runs in AudioWorkletGlobalScope, whose globals (AudioWorkletProcessor,
// registerProcessor, sampleRate) are not in the DOM typings. The DSP itself is typed in engine-dsp.js.
/**
 * AudioWorklet shell around EngineVoice. The main thread creates one node per car with
 * `processorOptions: { voice }` and drives it with six k-rate parameters, which Web Audio
 * can schedule on a timeline, so the same graph works live and in an OfflineAudioContext.
 *
 * `bov` and `pop` are trigger counters: a rise in value fires one event of that size.
 */

import { EngineVoice } from './engine-dsp.js';

class EngineProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    const k = (name, defaultValue, minValue, maxValue) => ({ name, defaultValue, minValue, maxValue, automationRate: 'k-rate' });
    return [
      k('rpm', 900, 0, 20000),
      k('load', 0, 0, 1),
      k('boost', 0, 0, 1.4),
      k('limiter', 0, 0, 1),
      k('on', 1, 0, 1),
      k('bov', 0, 0, 1e9),
      k('pop', 0, 0, 1e9),
    ];
  }

  constructor(options) {
    super();
    const voice = (options.processorOptions && options.processorOptions.voice) || 'boxer';
    this.voice = new EngineVoice(sampleRate, voice);
    this.lastBov = 0;
    this.lastPop = 0;
  }

  process(inputs, outputs, p) {
    const out = outputs[0];
    const v = this.voice;
    v.set({ rpm: p.rpm[0], load: p.load[0], boost: p.boost[0], limiter: p.limiter[0], on: p.on[0] });
    const bov = p.bov[0];
    if (bov > this.lastBov) v.triggerBov(Math.min(1, bov - Math.floor(bov) || 1));
    this.lastBov = bov;
    const pop = p.pop[0];
    if (pop > this.lastPop) v.triggerPop(Math.min(1, pop - Math.floor(pop) || 1));
    this.lastPop = pop;
    v.process(out[0], out[0].length);
    for (let c = 1; c < out.length; c++) out[c].set(out[0]);
    return true;
  }
}

registerProcessor('lowbeam-engine', EngineProcessor);
