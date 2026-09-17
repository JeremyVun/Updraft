import type { AudioOut } from '../creatures/voices';

export type Surface = 'grass' | 'sand' | 'wood' | 'water';

/**
 * The sounds a small body makes, as opposed to a voice. The cygnet never speaks except when it is lost, so this is
 * most of how it is heard: webbed feet on sand, a wing opened in a hurry, the whole of it shaken out after the rain.
 * All of it is synthesised from one noise buffer and a few tones, quiet enough to sit under the wind.
 * The grown swans are another matter: they are other animals, and they are as loud as swans are.
 */
export class Foley {
  private out: AudioOut | null = null;
  private noise: AudioBuffer | null = null;
  private lastStep = -1;
  private lastFlap = -1;

  setOutput(out: AudioOut | null): void {
    if (out && out.ctx !== this.out?.ctx) {
      const length = out.ctx.sampleRate;
      this.noise = out.ctx.createBuffer(1, length, out.ctx.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    }
    this.out = out;
  }

  /** One burst of filtered noise with its own envelope: the raw material of every sound here. */
  private puff(o: { at: number; len: number; level: number; pan: number; type: BiquadFilterType; from: number; to?: number; q?: number; attack?: number; wet?: number }): void {
    const out = this.out;
    if (!out || !this.noise || o.level <= 0.0002) return;
    const { ctx } = out;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    src.loopStart = Math.random() * 0.5;
    const filter = ctx.createBiquadFilter();
    filter.type = o.type;
    filter.Q.value = o.q ?? 0.9;
    filter.frequency.setValueAtTime(o.from, o.at);
    if (o.to) filter.frequency.exponentialRampToValueAtTime(o.to, o.at + o.len);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, o.at);
    env.gain.linearRampToValueAtTime(o.level, o.at + (o.attack ?? 0.006));
    env.gain.exponentialRampToValueAtTime(0.0001, o.at + o.len);
    const pan = ctx.createStereoPanner();
    pan.pan.value = Math.max(-0.85, Math.min(0.85, o.pan));
    src.connect(filter).connect(env).connect(pan).connect(out.bus);
    if (o.wet) {
      const send = ctx.createGain();
      send.gain.value = o.wet;
      pan.connect(send).connect(out.reverb);
    }
    src.start(o.at, Math.random() * 0.4);
    src.stop(o.at + o.len + 0.05);
  }

  private blip(at: number, from: number, to: number, len: number, level: number, pan: number, type: OscillatorType = 'sine', wet = 0): void {
    const out = this.out;
    if (!out) return;
    const { ctx } = out;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(from, at);
    osc.frequency.exponentialRampToValueAtTime(to, at + len);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, at);
    env.gain.linearRampToValueAtTime(level, at + Math.min(0.012, len * 0.3));
    env.gain.exponentialRampToValueAtTime(0.0001, at + len);
    const p = ctx.createStereoPanner();
    p.pan.value = Math.max(-0.85, Math.min(0.85, pan));
    osc.connect(env).connect(p).connect(out.bus);
    if (wet) {
      const send = ctx.createGain();
      send.gain.value = wet;
      p.connect(send).connect(out.reverb);
    }
    osc.start(at);
    osc.stop(at + len + 0.05);
  }

  /** A webbed foot coming down: a soft slap, drier on sand, a knock on the boat's boards, a plip in the shallows. */
  step(surface: Surface, weight: number, pan: number): void {
    const now = this.out?.ctx.currentTime;
    if (now === undefined || now - this.lastStep < 0.045) return;
    this.lastStep = now;
    const at = now + 0.005;
    const v = 0.5 + Math.random() * 0.5;
    if (surface === 'grass') this.puff({ at, len: 0.07, level: 0.02 * weight * v, pan, type: 'bandpass', from: 2300 + Math.random() * 700, q: 0.8 });
    else if (surface === 'sand') {
      this.puff({ at, len: 0.06, level: 0.03 * weight * v, pan, type: 'bandpass', from: 1100 + Math.random() * 300, q: 1.1 });
      this.puff({ at: at + 0.012, len: 0.05, level: 0.012 * weight, pan, type: 'highpass', from: 3800 });
    } else if (surface === 'wood') {
      this.blip(at, 240 + Math.random() * 40, 150, 0.06, 0.035 * weight * v, pan, 'triangle');
      this.puff({ at, len: 0.02, level: 0.02 * weight, pan, type: 'bandpass', from: 1700, q: 1.5 });
    } else {
      this.blip(at, 1000 + Math.random() * 300, 420, 0.07, 0.02 * weight * v, pan);
      this.puff({ at, len: 0.09, level: 0.014 * weight, pan, type: 'bandpass', from: 2600, to: 1200, q: 0.7 });
    }
  }

  /** One downstroke of a small wing: more air than feather. */
  flap(effort: number, pan: number): void {
    const now = this.out?.ctx.currentTime;
    if (now === undefined || now - this.lastFlap < 0.05) return;
    this.lastFlap = now;
    this.puff({ at: now + 0.005, len: 0.11, level: 0.035 * effort, pan, type: 'lowpass', from: 900 + 500 * effort, to: 380, attack: 0.02, wet: 0.15 });
  }

  /** A flurry of them: a hop into the hands, a scramble up the coat, a wobble it had to catch. */
  flutter(strokes: number, effort: number, pan: number): void {
    const now = this.out?.ctx.currentTime;
    if (now === undefined) return;
    for (let i = 0; i < strokes; i++) {
      const at = now + 0.01 + i * (0.055 + Math.random() * 0.015);
      this.puff({ at, len: 0.07, level: 0.03 * effort * (1 - i / (strokes * 1.6)), pan, type: 'lowpass', from: 1300, to: 500, attack: 0.012 });
    }
  }

  /** Shaken out from bill to tail: down against down, fast, and then a settle. */
  shake(pan: number, wet: number): void {
    const out = this.out;
    if (!out || !this.noise) return;
    const now = out.ctx.currentTime + 0.01;
    for (let i = 0; i < 14; i++) {
      const at = now + i * 0.034;
      const k = Math.sin((i / 13) * Math.PI);
      this.puff({ at, len: 0.04, level: (0.012 + 0.02 * k) * (1 + wet), pan: pan + (i % 2 ? 0.06 : -0.06), type: 'bandpass', from: 2800 + 1400 * k, q: 0.7 });
      /** Wet, it throws water. */
      if (wet > 0.3 && i % 3 === 0) this.blip(at + 0.01, 2200 + Math.random() * 1500, 1200, 0.03, 0.006 * wet, pan + (Math.random() - 0.5) * 0.5);
    }
  }

  /** Coming down harder than it meant to: the thump of something light and round, and the grass it slides through. */
  tumble(hard: number, pan: number): void {
    const now = this.out?.ctx.currentTime;
    if (now === undefined) return;
    const at = now + 0.005;
    this.blip(at, 120, 52, 0.16, 0.07 * hard, pan, 'sine', 0.2);
    this.puff({ at, len: 0.09, level: 0.05 * hard, pan, type: 'lowpass', from: 700, to: 250 });
    this.puff({ at: at + 0.05, len: 0.45 * hard + 0.15, level: 0.03 * hard, pan, type: 'bandpass', from: 2400, to: 900, q: 0.6, attack: 0.04 });
  }

  /** Down and mitten, down and coat: the sound of being handled gently, and of climbing somebody. */
  rustle(amount: number, pan: number): void {
    const now = this.out?.ctx.currentTime;
    if (now === undefined) return;
    this.puff({ at: now + 0.005, len: 0.12 + Math.random() * 0.08, level: 0.014 * amount, pan, type: 'bandpass', from: 3400 + Math.random() * 1200, q: 0.5, attack: 0.03 });
  }

  /** Into the water all at once, and bobbing up. */
  plunge(pan: number): void {
    const now = this.out?.ctx.currentTime;
    if (now === undefined) return;
    const at = now + 0.005;
    this.puff({ at, len: 0.5, level: 0.07, pan, type: 'bandpass', from: 1800, to: 500, q: 0.6, attack: 0.015, wet: 0.25 });
    this.blip(at + 0.03, 320, 140, 0.18, 0.05, pan, 'sine', 0.2);
    for (let i = 0; i < 6; i++) this.blip(at + 0.12 + i * 0.05 + Math.random() * 0.03, 1400 + Math.random() * 1600, 700, 0.05, 0.012, pan + (Math.random() - 0.5) * 0.4);
  }

  /** One stroke of a paddling foot under the surface. */
  paddle(effort: number, pan: number): void {
    const now = this.out?.ctx.currentTime;
    if (now === undefined) return;
    this.puff({ at: now + 0.005, len: 0.16, level: 0.012 + 0.02 * effort, pan, type: 'bandpass', from: 900, to: 450, q: 0.8, attack: 0.04 });
  }

  /**
   * A grown swan calling on the wing: two bugled notes, the second higher, nasal and carrying. `far` is 0 overhead
   * to 1 a long way off, which takes the top off it and leaves most of it in the air.
   */
  bugle(pan: number, far: number, loudness = 1): void {
    const out = this.out;
    if (!out) return;
    const { ctx } = out;
    const now = ctx.currentTime + 0.02;
    const base = 470 + Math.random() * 90;
    const voice = ctx.createGain();
    const tone = ctx.createBiquadFilter();
    tone.type = 'lowpass';
    tone.frequency.value = 4200 - 3000 * far;
    const p = ctx.createStereoPanner();
    p.pan.value = Math.max(-0.85, Math.min(0.85, pan));
    const dry = ctx.createGain();
    dry.gain.value = 1 - 0.6 * far;
    const send = ctx.createGain();
    send.gain.value = 0.5 + 0.5 * far;
    voice.connect(tone).connect(p);
    p.connect(dry).connect(out.bus);
    p.connect(send).connect(out.reverb);
    let at = now;
    for (const [ratio, len] of [
      [1, 0.2],
      [1.26, 0.34],
    ]) {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      const f = base * ratio;
      osc.frequency.setValueAtTime(f * 0.9, at);
      osc.frequency.exponentialRampToValueAtTime(f, at + 0.05);
      osc.frequency.exponentialRampToValueAtTime(f * 0.95, at + len);
      /** Two fixed resonances over a moving note are what make it a throat and not a horn. */
      const mouth = ctx.createBiquadFilter();
      mouth.type = 'bandpass';
      mouth.frequency.value = 950;
      mouth.Q.value = 3;
      const nose = ctx.createBiquadFilter();
      nose.type = 'bandpass';
      nose.frequency.value = 1750;
      nose.Q.value = 4;
      const env = ctx.createGain();
      const peak = 0.05 * loudness * (1 - 0.55 * far);
      env.gain.setValueAtTime(0, at);
      env.gain.linearRampToValueAtTime(peak, at + 0.035);
      env.gain.setValueAtTime(peak * 0.8, at + len * 0.6);
      env.gain.exponentialRampToValueAtTime(0.0001, at + len);
      osc.connect(mouth).connect(env);
      const thin = ctx.createGain();
      thin.gain.value = 0.5;
      osc.connect(nose).connect(thin).connect(env);
      env.connect(voice);
      osc.start(at);
      osc.stop(at + len + 0.05);
      at += len + 0.05;
    }
  }

  /** The throb of big wings going over: one soft pulse of air per beat, the sound a skein makes before you see it. */
  wingbeat(pan: number, far: number): void {
    const now = this.out?.ctx.currentTime;
    if (now === undefined) return;
    this.puff({ at: now + 0.005, len: 0.22, level: 0.03 * (1 - 0.7 * far), pan, type: 'bandpass', from: 760, to: 520, q: 1.6, attack: 0.06, wet: 0.3 + 0.4 * far });
  }
}
