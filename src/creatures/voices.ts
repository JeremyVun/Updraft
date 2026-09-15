import { mulberry32 } from '../world/noise';

export interface AudioOut {
  ctx: AudioContext;
  bus: AudioNode;
  reverb: AudioNode;
}

/** Soft synthesised calls: songbird cheeps and distant gull cries, sparse enough to sit under the music. */
export class Voices {
  private out: AudioOut | null = null;
  private readonly rand = mulberry32(404);
  private lastCheep = 0;
  private lastCry = 0;

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
      const peak = 0.03 * loudness;
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
      const peak = 0.018 * loudness;
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
}
