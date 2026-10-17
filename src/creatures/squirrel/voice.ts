import type { AudioOut } from '../voices';

/**
 * The red squirrel's sounds, synthesised: the harsh "chuck" it scolds with (a hoarse, buzzing bark of a note that
 * drops as it ends, in runs of three to seven), the teeth-chatter it rattles off at the end of a run, a soft high
 * squeak as it bursts out of the leaves, its claws catching on bark as it climbs, its feet pattering over the litter,
 * a thump as it lands and a tiny gnawing at a nut.
 */
export class SquirrelVoice {
  private out: AudioOut | null = null;
  private noise: AudioBuffer | null = null;
  private lastPatter = -Infinity;
  private lastClaw = -Infinity;

  setOutput(out: AudioOut | null): void {
    if (out && out.ctx !== this.out?.ctx) {
      const rate = out.ctx.sampleRate;
      this.noise = out.ctx.createBuffer(1, rate, rate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < rate; i++) data[i] = Math.random() * 2 - 1;
    }
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

  private burst(input: AudioNode, at: number, len: number, level: number, type: BiquadFilterType, freq: number, q: number, sweep = 1): void {
    const ctx = this.out!.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.setValueAtTime(freq, at);
    if (sweep !== 1) filter.frequency.exponentialRampToValueAtTime(freq * sweep, at + len);
    filter.Q.value = q;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, at);
    env.gain.linearRampToValueAtTime(level, at + Math.min(0.004, len * 0.2));
    env.gain.exponentialRampToValueAtTime(0.0001, at + len);
    src.connect(filter).connect(env).connect(input);
    src.start(at, Math.random() * 0.9);
    src.stop(at + len + 0.02);
  }

  /**
   * One "chuck": a hoarse note around 1.4 kHz, buzzing at about 90 Hz as a squirrel's voice does, falling a
   * little at the end, with a breathy bark of noise over it.
   */
  chuck(pan: number, loudness: number): void {
    const v = this.voice(pan, 0.85, 0.35);
    if (!v || !this.noise) return;
    const { ctx, input } = v;
    const t0 = ctx.currentTime + 0.01;
    const len = 0.055 + Math.random() * 0.025;
    const f0 = 1250 + Math.random() * 350;
    const level = 0.05 * loudness;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(f0 * 1.06, t0);
    osc.frequency.exponentialRampToValueAtTime(f0 * 0.82, t0 + len);
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = f0 * 1.9;
    band.Q.value = 1.6;
    const buzz = ctx.createGain();
    buzz.gain.value = 0.55;
    const rasp = ctx.createOscillator();
    rasp.type = 'square';
    rasp.frequency.value = 80 + Math.random() * 25;
    const raspDepth = ctx.createGain();
    raspDepth.gain.value = 0.45;
    rasp.connect(raspDepth).connect(buzz.gain);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, t0);
    env.gain.linearRampToValueAtTime(level, t0 + 0.006);
    env.gain.setTargetAtTime(level * 0.55, t0 + 0.012, 0.015);
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + len);
    osc.connect(band).connect(buzz).connect(env).connect(input);
    osc.start(t0);
    rasp.start(t0);
    osc.stop(t0 + len + 0.02);
    rasp.stop(t0 + len + 0.02);
    this.burst(input, t0, len * 0.9, level * 0.9, 'bandpass', 2600 + Math.random() * 900, 1.4, 0.7);
  }

  /** The chatter: a fast rattle of tiny dry clicks, about eighteen a second, fading over most of a second. */
  chitter(pan: number, loudness: number): void {
    const v = this.voice(pan, 0.85, 0.3);
    if (!v || !this.noise) return;
    const { ctx, input } = v;
    const t0 = ctx.currentTime + 0.01;
    const count = 10 + Math.floor(Math.random() * 7);
    const rate = 16 + Math.random() * 5;
    for (let i = 0; i < count; i++) {
      const fade = 1 - (i / count) * 0.7;
      this.burst(input, t0 + i / rate + Math.random() * 0.006, 0.014, 0.03 * loudness * fade, 'bandpass', 3800 + Math.random() * 1600, 3);
    }
  }

  /** A soft high squeak, quickly up and falling away, as it bursts out of the leaves. */
  squeak(pan: number, loudness: number): void {
    const v = this.voice(pan, 0.8, 0.35);
    if (!v) return;
    const { ctx, input } = v;
    const t0 = ctx.currentTime + 0.01;
    const len = 0.11 + Math.random() * 0.05;
    const f0 = 3600 + Math.random() * 700;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(f0 * 0.8, t0);
    osc.frequency.exponentialRampToValueAtTime(f0 * 1.15, t0 + len * 0.3);
    osc.frequency.exponentialRampToValueAtTime(f0 * 0.75, t0 + len);
    const env = ctx.createGain();
    const level = 0.022 * loudness;
    env.gain.setValueAtTime(0, t0);
    env.gain.linearRampToValueAtTime(level, t0 + 0.012);
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + len);
    osc.connect(env).connect(input);
    osc.start(t0);
    osc.stop(t0 + len + 0.02);
  }

  /** Claws catching on bark: two or three tiny bright scratches close together. */
  claw(pan: number, loudness: number): void {
    const now = this.out?.ctx.currentTime;
    if (now === undefined || now - this.lastClaw < 0.04) return;
    this.lastClaw = now;
    const v = this.voice(pan, 1, 0.15);
    if (!v || !this.noise) return;
    const n = 2 + Math.floor(Math.random() * 2);
    for (let i = 0; i < n; i++) {
      this.burst(v.input, now + 0.005 + i * (0.012 + Math.random() * 0.014), 0.02, 0.02 * loudness, 'bandpass', 3200 + Math.random() * 2200, 2.2, 0.8);
    }
  }

  /** Light feet on the litter: a soft pad and the leaf under it crackling. */
  patter(pan: number, loudness: number): void {
    const now = this.out?.ctx.currentTime;
    if (now === undefined || now - this.lastPatter < 0.035) return;
    this.lastPatter = now;
    const v = this.voice(pan, 1, 0.12);
    if (!v || !this.noise) return;
    this.burst(v.input, now + 0.004, 0.035, 0.014 * loudness, 'lowpass', 700, 0.7);
    this.burst(v.input, now + 0.008, 0.03, 0.009 * loudness, 'bandpass', 2400 + Math.random() * 1500, 1.2);
  }

  /** All four feet coming down at once. */
  land(pan: number, loudness: number): void {
    const now = this.out?.ctx.currentTime;
    const v = this.voice(pan, 1, 0.15);
    if (now === undefined || !v || !this.noise) return;
    this.burst(v.input, now + 0.005, 0.08, 0.04 * loudness, 'lowpass', 380, 0.8);
  }

  /** Teeth at a nut: a few faint quick scrapes. */
  gnaw(pan: number, loudness: number): void {
    const now = this.out?.ctx.currentTime;
    const v = this.voice(pan, 1, 0.1);
    if (now === undefined || !v || !this.noise) return;
    for (let i = 0; i < 4; i++) this.burst(v.input, now + 0.005 + i * 0.075, 0.025, 0.006 * loudness, 'bandpass', 4200 + Math.random() * 1500, 2.5);
  }
}
