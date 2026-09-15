import { mulberry32 } from '../world/noise';

export interface AudioOut {
  ctx: AudioContext;
  bus: AudioNode;
  reverb: AudioNode;
}

/** Soft synthesised calls: songbird cheeps, distant gull cries and bleating sheep, sparse enough to sit under the music. */
export class Voices {
  private out: AudioOut | null = null;
  private readonly rand = mulberry32(404);
  private lastCheep = -Infinity;
  private lastCry = -Infinity;
  private lastBaa = -Infinity;

  setOutput(out: AudioOut | null): void {
    this.out = out;
  }

  private voice(pan: number, dry: number, wet: number): { ctx: AudioContext; input: GainNode } | null {
    const out = this.out;
    if (!out) return null;
    const { ctx } = out;
    const input = ctx.createGain();
    const panner = ctx.createStereoPanner();
    panner.pan.value = Math.max(-0.85, Math.min(0.85, pan));
    const dryGain = ctx.createGain();
    dryGain.gain.value = dry;
    const wetGain = ctx.createGain();
    wetGain.gain.value = wet;
    input.connect(panner);
    panner.connect(dryGain).connect(out.bus);
    panner.connect(wetGain).connect(out.reverb);
    return { ctx, input };
  }

  /** A few quick rising chirps. */
  cheep(pan: number, loudness: number): void {
    const now = this.out?.ctx.currentTime ?? 0;
    if (now - this.lastCheep < 0.06) return;
    const v = this.voice(pan, 1, 0.3);
    if (!v) return;
    this.lastCheep = now;
    const { ctx, input } = v;
    const rand = this.rand;
    const base = 3300 + rand() * 1500;
    const notes = 1 + Math.floor(rand() * 3);
    for (let k = 0; k < notes; k++) {
      const t0 = now + 0.01 + k * (0.06 + rand() * 0.04);
      const f0 = base * (0.85 + rand() * 0.3);
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f0 * 0.8, t0);
      osc.frequency.exponentialRampToValueAtTime(f0 * (1.15 + rand() * 0.2), t0 + 0.035);
      osc.frequency.exponentialRampToValueAtTime(f0 * 0.95, t0 + 0.06);
      const env = ctx.createGain();
      const peak = 0.04 * loudness;
      env.gain.setValueAtTime(0, t0);
      env.gain.linearRampToValueAtTime(peak, t0 + 0.005);
      env.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.07);
      osc.connect(env).connect(input);
      osc.start(t0);
      osc.stop(t0 + 0.09);
    }
  }

  /** A far-off "kee-ow", sometimes repeated. */
  cry(pan: number, loudness: number): void {
    const now = this.out?.ctx.currentTime ?? 0;
    if (now - this.lastCry < 1.5) return;
    const v = this.voice(pan, 0.55, 1);
    if (!v) return;
    this.lastCry = now;
    const { ctx, input } = v;
    const rand = this.rand;
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 1500 + rand() * 300;
    band.Q.value = 2.2;
    band.connect(input);
    const calls = 1 + Math.floor(rand() * 3);
    const pitch = 0.9 + rand() * 0.25;
    for (let k = 0; k < calls; k++) {
      const t0 = now + 0.02 + k * (0.42 + rand() * 0.12);
      const len = 0.34 + rand() * 0.1;
      const drop = 1 - k * 0.06;
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(640 * pitch * drop, t0);
      osc.frequency.exponentialRampToValueAtTime(1080 * pitch * drop, t0 + 0.07);
      osc.frequency.exponentialRampToValueAtTime(560 * pitch * drop, t0 + len);
      const vibrato = ctx.createOscillator();
      const depth = ctx.createGain();
      vibrato.frequency.value = 24;
      depth.gain.value = 18;
      vibrato.connect(depth).connect(osc.frequency);
      const env = ctx.createGain();
      const peak = 0.06 * loudness;
      env.gain.setValueAtTime(0, t0);
      env.gain.linearRampToValueAtTime(peak, t0 + 0.03);
      env.gain.setValueAtTime(peak, t0 + len * 0.45);
      env.gain.exponentialRampToValueAtTime(0.0001, t0 + len);
      osc.connect(env).connect(band);
      osc.start(t0);
      osc.stop(t0 + len + 0.05);
      vibrato.start(t0);
      vibrato.stop(t0 + len + 0.05);
    }
  }

  /** A nasal, wavering "baa"; lambs higher, quicker and shorter. */
  baa(pan: number, loudness: number, lamb: boolean): void {
    const now = this.out?.ctx.currentTime ?? 0;
    if (now - this.lastBaa < 0.35) return;
    const v = this.voice(pan, 0.8, 0.5);
    if (!v) return;
    this.lastBaa = now;
    const { ctx, input } = v;
    const rand = this.rand;
    const t0 = now + 0.02;
    const len = lamb ? 0.3 + rand() * 0.15 : 0.55 + rand() * 0.3;
    const f0 = (lamb ? 470 : 230) * (0.9 + rand() * 0.2);
    const voice = lamb ? 1.3 : 1;

    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(f0 * 0.84, t0);
    osc.frequency.exponentialRampToValueAtTime(f0 * 1.04, t0 + 0.07);
    osc.frequency.exponentialRampToValueAtTime(f0, t0 + len * 0.5);
    osc.frequency.exponentialRampToValueAtTime(f0 * 0.8, t0 + len);
    const quaver = ctx.createOscillator();
    quaver.frequency.value = (lamb ? 9 : 7) + rand() * 2;
    const pitchWobble = ctx.createGain();
    pitchWobble.gain.value = f0 * 0.035;
    quaver.connect(pitchWobble).connect(osc.frequency);

    const mouth = ctx.createBiquadFilter();
    mouth.type = 'lowpass';
    mouth.Q.value = 0.9;
    mouth.frequency.setValueAtTime(380 * voice, t0);
    mouth.frequency.exponentialRampToValueAtTime(3200 * voice, t0 + 0.07);
    mouth.frequency.setValueAtTime(3200 * voice, t0 + len * 0.7);
    mouth.frequency.exponentialRampToValueAtTime(1100 * voice, t0 + len);
    const tremolo = ctx.createGain();
    tremolo.gain.value = 0.7;
    const tremoloDepth = ctx.createGain();
    tremoloDepth.gain.value = 0.3;
    quaver.connect(tremoloDepth).connect(tremolo.gain);
    for (const [freq, q] of [
      [720 * voice, 3],
      [1650 * voice, 5],
    ]) {
      const formant = ctx.createBiquadFilter();
      formant.type = 'bandpass';
      formant.frequency.value = freq;
      formant.Q.value = q;
      mouth.connect(formant).connect(tremolo);
    }

    const env = ctx.createGain();
    const peak = 0.085 * loudness;
    env.gain.setValueAtTime(0, t0);
    env.gain.linearRampToValueAtTime(peak, t0 + 0.04);
    env.gain.setValueAtTime(peak, t0 + len * 0.55);
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + len);
    osc.connect(mouth);
    tremolo.connect(env).connect(input);
    osc.start(t0);
    osc.stop(t0 + len + 0.05);
    quaver.start(t0);
    quaver.stop(t0 + len + 0.05);
  }
}
