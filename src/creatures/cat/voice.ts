import type { AudioOut } from '../voices';

/**
 * The cat's voice and the small sounds of its paws, synthesised like every other animal's: a plaintive mew that
 * carries across the water, a rolled chirrup when it lands or greets, soft pads on slate and claws on stone.
 */
export class CatVoice {
  private out: AudioOut | null = null;
  private noise: AudioBuffer | null = null;
  private lastMew = -Infinity;
  private lastPat = -Infinity;

  setOutput(out: AudioOut | null): void {
    if (out && out.ctx !== this.out?.ctx) {
      const length = out.ctx.sampleRate;
      this.noise = out.ctx.createBuffer(1, length, out.ctx.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
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

  /**
   * "Mi-aow": the mouth opening from a thin "i" to a wide "a" and closing on "u", the pitch lifting and then falling
   * away. `plea` makes it higher with a drooping end, the voice of something stuck and asking; `length` is the
   * mouth's, so the two keep time.
   */
  mew(pan: number, loudness: number, plea = 1, length = 0.6 + 0.3 * plea): void {
    const now = this.out?.ctx.currentTime ?? 0;
    if (now - this.lastMew < 0.4) return;
    const v = this.voice(pan, 0.75, 0.55);
    if (!v) return;
    this.lastMew = now;
    const { ctx, input } = v;
    const t0 = now + 0.02;
    const len = length;
    const f0 = (560 + 120 * plea) * (0.92 + Math.random() * 0.16);
    const at = (k: number) => t0 + len * k;

    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(f0 * 0.82, t0);
    osc.frequency.exponentialRampToValueAtTime(f0 * 1.14, at(0.22));
    osc.frequency.exponentialRampToValueAtTime(f0, at(0.55));
    osc.frequency.exponentialRampToValueAtTime(f0 * (0.78 - 0.08 * plea), at(1));
    const vibrato = ctx.createOscillator();
    vibrato.frequency.value = 5.5 + Math.random() * 1.5;
    const depth = ctx.createGain();
    depth.gain.value = f0 * 0.018;
    vibrato.connect(depth).connect(osc.frequency);

    const soft = ctx.createBiquadFilter();
    soft.type = 'lowpass';
    soft.frequency.value = 4200;
    soft.Q.value = 0.5;
    const mouth = ctx.createGain();
    mouth.gain.value = 1;
    osc.connect(soft);
    for (const [from, mid, to, q, level] of [
      [480, 980, 620, 4, 1],
      [2300, 1650, 1050, 6, 0.55],
      [3100, 2900, 2600, 8, 0.2],
    ]) {
      const formant = ctx.createBiquadFilter();
      formant.type = 'bandpass';
      formant.Q.value = q;
      formant.frequency.setValueAtTime(from, t0);
      formant.frequency.linearRampToValueAtTime(mid, at(0.3));
      formant.frequency.linearRampToValueAtTime(to, at(1));
      const g = ctx.createGain();
      g.gain.value = level;
      soft.connect(formant).connect(g).connect(mouth);
    }

    const env = ctx.createGain();
    const peak = 0.09 * loudness;
    env.gain.setValueAtTime(0, t0);
    env.gain.linearRampToValueAtTime(peak * 0.6, t0 + 0.035);
    env.gain.linearRampToValueAtTime(peak, at(0.25));
    env.gain.setValueAtTime(peak, at(0.55));
    env.gain.exponentialRampToValueAtTime(0.0001, at(1));
    mouth.connect(env).connect(input);
    osc.start(t0);
    osc.stop(at(1) + 0.05);
    vibrato.start(t0);
    vibrato.stop(at(1) + 0.05);
  }

  /** "Mrrp?": a short rolled note going up, the sound a cat makes arriving somewhere it wanted to be. */
  chirrup(pan: number, loudness: number): void {
    const v = this.voice(pan, 0.8, 0.35);
    if (!v) return;
    const { ctx, input } = v;
    const t0 = ctx.currentTime + 0.01;
    const len = 0.17 + Math.random() * 0.06;
    const f0 = 360 * (0.92 + Math.random() * 0.16);
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(f0, t0);
    osc.frequency.exponentialRampToValueAtTime(f0 * 1.75, t0 + len);
    const trill = ctx.createOscillator();
    trill.frequency.value = 26 + Math.random() * 6;
    const roll = ctx.createGain();
    roll.gain.value = 0.55;
    const rollDepth = ctx.createGain();
    rollDepth.gain.value = 0.45;
    trill.connect(rollDepth).connect(roll.gain);
    const formant = ctx.createBiquadFilter();
    formant.type = 'bandpass';
    formant.frequency.setValueAtTime(700, t0);
    formant.frequency.linearRampToValueAtTime(1300, t0 + len);
    formant.Q.value = 1.6;
    const env = ctx.createGain();
    const peak = 0.075 * loudness;
    env.gain.setValueAtTime(0, t0);
    env.gain.linearRampToValueAtTime(peak, t0 + 0.02);
    env.gain.setValueAtTime(peak, t0 + len * 0.7);
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + len);
    osc.connect(formant).connect(roll).connect(env).connect(input);
    osc.start(t0);
    osc.stop(t0 + len + 0.03);
    trill.start(t0);
    trill.stop(t0 + len + 0.03);
  }

  private puff(at: number, len: number, level: number, pan: number, type: BiquadFilterType, freq: number, q: number): void {
    const v = this.voice(pan, 1, 0.12);
    if (!v || !this.noise) return;
    const { ctx, input } = v;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    filter.Q.value = q;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, at);
    env.gain.linearRampToValueAtTime(level, at + Math.min(0.01, len * 0.3));
    env.gain.exponentialRampToValueAtTime(0.0001, at + len);
    src.connect(filter).connect(env).connect(input);
    src.start(at, Math.random() * 0.8);
    src.stop(at + len + 0.02);
  }

  /** A soft pad on slate or wood, only heard close to. */
  pat(pan: number, loudness: number): void {
    const now = this.out?.ctx.currentTime;
    if (now === undefined || now - this.lastPat < 0.05) return;
    this.lastPat = now;
    this.puff(now + 0.005, 0.045, 0.018 * loudness, pan, 'lowpass', 900, 0.7);
  }

  /** All four paws arriving at once after a jump. */
  land(pan: number, loudness: number): void {
    const now = this.out?.ctx.currentTime;
    if (now === undefined) return;
    this.puff(now + 0.005, 0.11, 0.08 * loudness, pan, 'lowpass', 320, 0.8);
    this.puff(now + 0.03, 0.05, 0.02 * loudness, pan, 'bandpass', 1400, 1);
  }

  /** Claws catching on stone and ivy on the way up. */
  scrabble(pan: number, loudness: number): void {
    const now = this.out?.ctx.currentTime;
    if (now === undefined) return;
    for (let i = 0; i < 3; i++) this.puff(now + 0.005 + i * (0.025 + Math.random() * 0.02), 0.03, 0.022 * loudness, pan, 'bandpass', 2600 + Math.random() * 1400, 2.5);
  }
}
