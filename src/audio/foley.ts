import { tuning } from '../tuning';
import type { AudioOut } from '../creatures/voices';
import type { NetSound } from '../fx/sealife/net';
import type { SleeperSound } from '../fx/sealife/sleeper';

export type Surface = 'grass' | 'sand' | 'wood' | 'water';
export type MaterialSound = 'cloth' | 'wool' | 'sail' | 'sail-settle' | 'water' | 'paper' | 'door' | 'splash' | 'peg'
  | 'dolphin-surface' | 'leaf-scuff' | 'swing-creak' | SleeperSound | Exclude<NetSound, 'whale-call' | 'whale-glad'>;

/**
 * The sounds a small body makes, as opposed to a voice. The cygnet never speaks except when it is lost, so this is
 * most of how it is heard: webbed feet on sand, a wing opened in a hurry, the whole of it shaken out after the rain.
 * All of it is synthesised from one noise buffer and a few tones, quiet enough to sit under the wind.
 * The same physical palette gives cloth, boats, paper and doors restrained sounds of their own.
 */
export class Foley {
  private out: AudioOut | null = null;
  private noise: AudioBuffer | null = null;
  private lastStep = -1;
  private lastFlap = -1;
  private frostHeard = false;
  private nextCrackle = 0;
  private hearthBed: { src: AudioBufferSourceNode; roar: BiquadFilterNode; gain: GainNode; pan: StereoPannerNode; quietSince: number | null } | null = null;
  private swanBeat = 0;

  setOutput(out: AudioOut | null): void {
    if (out && out.ctx !== this.out?.ctx) {
      const length = out.ctx.sampleRate;
      this.noise = out.ctx.createBuffer(1, length, out.ctx.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    }
    if (out !== this.out && this.hearthBed) {
      this.hearthBed.src.stop();
      this.hearthBed = null;
    }
    this.out = out;
  }

  /** Brief physical sounds, driven by object motion rather than the pointer or a story reward. */
  material(kind: MaterialSound, amount: number, pan: number, closing = false): void {
    const now = this.out?.ctx.currentTime;
    if (now === undefined || amount < 0.015) return;
    const at = now + 0.005;
    const level = Math.min(1.5, amount) * tuning.audio.materialLevel;
    if (kind === 'sail-settle') {
      // Heavy canvas settling: low air movement, with the scratchy upper noise filtered away.
      this.puff({ at, len: 0.5, level: level * 0.085 * 10 ** (tuning.audio.sailSettleBoostDb / 20), pan,
        type: 'lowpass', from: 320, to: 150, q: 0.5, attack: 0.12, wet: 0.04 });
    } else if (kind === 'cloth' || kind === 'wool' || kind === 'sail') {
      const wool = kind === 'wool', sail = kind === 'sail';
      this.puff({ at, len: wool ? 0.3 : 0.23, level: level * (wool ? 0.06 : 0.075), pan,
        type: 'bandpass', from: wool ? 850 : sail ? 650 : 1500, to: wool ? 480 : 700,
        q: 0.55, attack: 0.025, wet: 0.08 });
      if (!wool) this.puff({ at: at + 0.045, len: 0.07, level: level * 0.035, pan,
        type: 'lowpass', from: sail ? 380 : 650, attack: 0.012 });
    } else if (kind === 'peg') {
      // A wooden peg springing off the line: a dry snap, then the knock of its two legs clapping shut.
      const colour = 0.9 + Math.random() * 0.2;
      this.puff({ at, len: 0.035, level: level * 0.07, pan, type: 'bandpass', from: 2600 * colour, q: 1.2, attack: 0.002 });
      this.blip(at + 0.012, 1250 * colour, 900 * colour, 0.05, level * 0.02, pan, 'triangle', 0.04);
    } else if (kind === 'leaf-scuff') {
      // A few dry folds under a foot, never a continuous bed of crackle.
      const colour = 0.9 + Math.random() * 0.2;
      this.puff({ at, len: 0.17, level: level * 0.055, pan, type: 'bandpass',
        from: 1700 * colour, to: 900 * colour, q: 0.65, attack: 0.018 });
      this.puff({ at: at + 0.04, len: 0.045, level: level * 0.028, pan,
        type: 'bandpass', from: 2900 * colour, q: 0.7, attack: 0.008 });
      this.puff({ at: at + 0.095, len: 0.055, level: level * 0.018, pan,
        type: 'bandpass', from: 2100 * colour, q: 0.6, attack: 0.01 });
    } else if (kind === 'swing-creak') {
      // Low rope friction and wood flex; no piercing, pitched playground squeak.
      const colour = 0.92 + Math.random() * 0.16;
      this.puff({ at, len: 0.34, level: level * 0.055, pan, type: 'bandpass',
        from: 290 * colour, to: 190 * colour, q: 3.5, attack: 0.065, wet: 0.03 });
      this.puff({ at: at + 0.04, len: 0.19, level: level * 0.022, pan,
        type: 'bandpass', from: 720 * colour, to: 460 * colour, q: 2, attack: 0.045 });
    } else if (kind === 'water') {
      this.puff({ at, len: 0.58, level: level * 0.055, pan, type: 'bandpass', from: 620,
        to: 320, q: 0.65, attack: 0.1, wet: 0.08 });
      this.puff({ at: at + 0.12, len: 0.27, level: level * 0.016, pan,
        type: 'bandpass', from: 2400, to: 1100, q: 0.5, attack: 0.06 });
    } else if (kind === 'paper') {
      const paperLevel = level * tuning.audio.paperLevel;
      this.puff({ at, len: 0.18, level: paperLevel * 0.055, pan, type: 'highpass', from: 1900,
        attack: 0.018 });
      for (let i = 0; i < 3; i++) this.puff({ at: at + i * 0.038, len: 0.025,
        level: paperLevel * 0.025, pan, type: 'bandpass', from: 2800 + i * 450, q: 0.6 });
    } else if (kind === 'door') {
      if (closing) {
        this.blip(at, 115, 65, 0.15, level * 0.035, pan, 'triangle', 0.08);
        this.puff({ at, len: 0.09, level: level * 0.045, pan, type: 'lowpass', from: 700 });
      } else {
        this.puff({ at, len: 0.32, level: level * 0.024, pan, type: 'bandpass',
          from: 220, to: 340, q: 6, attack: 0.055, wet: 0.05 });
        this.blip(at, 155, 205, 0.22, level * 0.006, pan, 'triangle');
      }
    } else if (kind === 'dolphin-surface') {
      // A soft sheet of water, with a filtered spray rather than a bright hiss.
      const dolphin = level * tuning.audio.dolphinLevel;
      this.puff({ at, len: 0.46, level: dolphin * 0.065, pan, type: 'bandpass',
        from: 1000, to: 450, q: 0.5, attack: tuning.audio.dolphinAttack, wet: 0.04 });
      this.puff({ at: at + 0.06, len: 0.25, level: dolphin * 0.016, pan,
        type: 'bandpass', from: 1700, to: 800, q: 0.5, attack: 0.06 });
    } else if (kind === 'whale-blow') {
      // An airy exhalation above the water, with a low body and a soft spray tail.
      this.puff({ at, len: 1.65, level: level * 0.13, pan, type: 'bandpass',
        from: 650, to: 260, q: 0.45, attack: tuning.audio.whaleAttack, wet: 0.025 });
      this.puff({ at, len: 1.1, level: level * 0.06, pan, type: 'lowpass',
        from: 280, to: 150, attack: 0.22 });
      this.puff({ at: at + 0.22, len: 0.95, level: level * 0.012, pan,
        type: 'bandpass', from: 1100, to: 500, q: 0.45, attack: 0.18 });
    } else if (kind === 'whale-drain') {
      // Water pouring from the raised flukes, falling away into individual drops.
      this.puff({ at, len: 2.2, level: level * 0.075, pan, type: 'bandpass',
        from: 1250, to: 500, q: 0.5, attack: tuning.audio.whaleAttack, wet: 0.035 });
      for (let i = 0; i < 5; i++) this.puff({ at: at + 0.25 + i * 0.24, len: 0.22,
        level: level * 0.022 * (1 - i * 0.12), pan, type: 'bandpass',
        from: 650 + i * 80, to: 320, q: 0.5, attack: 0.05 });
    } else if (kind === 'whale-sigh') {
      // A sleeper's slow breath out: mostly low air, barely a hiss on top.
      this.puff({ at, len: 2.3, level: level * 0.05, pan, type: 'lowpass', from: 300, to: 130, attack: 0.5, wet: 0.03 });
      this.puff({ at: at + 0.15, len: 1.6, level: level * 0.012, pan, type: 'bandpass', from: 760, to: 360, q: 0.5, attack: 0.4 });
    } else if (kind === 'whale-breath') {
      // Drawing the waking breath: the air rises in pitch and swells toward the spout.
      this.puff({ at, len: 1.7, level: level * 0.08, pan, type: 'bandpass', from: 200, to: 620, q: 0.6, attack: 1.2, wet: 0.03 });
      this.puff({ at, len: 1.6, level: level * 0.05, pan, type: 'lowpass', from: 110, to: 220, attack: 1.0 });
    } else if (kind === 'net-sputter') {
      // A weak breath forced out through wet mesh: a low push of air broken into small wet bursts.
      this.puff({ at, len: 1.4, level: level * 0.06, pan, type: 'lowpass', from: 260, to: 140, attack: 0.25, wet: 0.03 });
      let t = at + 0.12;
      for (let i = 0; i < 7; i++) {
        t += 0.06 + Math.random() * 0.14;
        this.puff({ at: t, len: 0.05 + Math.random() * 0.05, level: level * (0.06 + Math.random() * 0.05) * (1 - i * 0.09), pan,
          type: 'bandpass', from: 520 + Math.random() * 700, to: 380, q: 2.2, attack: 0.004, wet: 0.02 });
      }
    } else if (kind === 'net-lift') {
      // Old wet rope taking the weight, the corks knocking on their lines, and the water it brings up dripping off.
      this.puff({ at, len: 0.3, level: level * 0.09, pan, type: 'bandpass', from: 360 + Math.random() * 80, to: 520, q: 4, attack: 0.05 });
      for (let i = 0; i < 3; i++) {
        const k = at + 0.04 + Math.random() * 0.3;
        this.blip(k, 640 + Math.random() * 260, 520, 0.05, level * 0.02, pan, 'triangle', 0.03);
      }
      for (let i = 0; i < 2; i++) this.puff({ at: at + 0.15 + Math.random() * 0.4, len: 0.04, level: level * 0.025, pan,
        type: 'bandpass', from: 2400 + Math.random() * 900, q: 3, attack: 0.003 });
    } else if (kind === 'cork-knock') {
      // A wet cork float bumping the planking: a hollow wooden tock, a softer second bump, a lap of water.
      this.blip(at, 420 + Math.random() * 60, 300, 0.07, level * 0.07, pan, 'triangle', 0.02);
      this.puff({ at, len: 0.05, level: level * 0.05, pan, type: 'bandpass', from: 900, to: 600, q: 3, attack: 0.002 });
      this.blip(at + 0.11, 380 + Math.random() * 40, 290, 0.05, level * 0.025, pan, 'triangle', 0.02);
      this.puff({ at: at + 0.04, len: 0.3, level: level * 0.02, pan, type: 'bandpass', from: 1300, to: 700, q: 0.7, attack: 0.03 });
    } else if (kind === 'rope-pull') {
      // Wet rope drawn hard through mittens: a soft creaking rasp, the water squeezed out of it, a cork tapping the rail.
      this.puff({ at, len: 0.55, level: level * 0.06, pan, type: 'bandpass', from: 700, to: 420, q: 2.5, attack: 0.12 });
      this.puff({ at: at + 0.05, len: 0.4, level: level * 0.035, pan, type: 'bandpass', from: 2600, to: 1800, q: 1.2, attack: 0.08 });
      for (let i = 0; i < 3; i++) this.puff({ at: at + 0.25 + Math.random() * 0.35, len: 0.04, level: level * 0.02, pan,
        type: 'bandpass', from: 2200 + Math.random() * 1000, q: 3, attack: 0.003 });
      this.blip(at + 0.4 + Math.random() * 0.1, 520 + Math.random() * 80, 400, 0.05, level * 0.02, pan, 'triangle', 0.02);
    } else if (kind === 'net-slither') {
      // Wet mesh sliding off smooth skin into the sea: a long low hush and a spill of water as it goes in.
      this.puff({ at, len: 1.1, level: level * 0.06, pan, type: 'bandpass', from: 520, to: 260, q: 0.8, attack: 0.25, wet: 0.03 });
      this.puff({ at: at + 0.3, len: 0.8, level: level * 0.04, pan, type: 'bandpass', from: 1400, to: 650, q: 0.6, attack: 0.2, wet: 0.04 });
    } else if (kind === 'flipper-pour') {
      // The sea running off a broad flipper as it comes up out of it: a sheet of water thinning into drops.
      this.puff({ at, len: 2.4, level: level * 0.07, pan, type: 'bandpass', from: 850, to: 1400, q: 0.5, attack: 0.5, wet: 0.04 });
      this.puff({ at, len: 1.6, level: level * 0.04, pan, type: 'lowpass', from: 420, to: 260, attack: 0.35, wet: 0.03 });
      for (let i = 0; i < 6; i++) this.puff({ at: at + 1.2 + i * 0.22 + Math.random() * 0.1, len: 0.16,
        level: level * 0.02 * (1 - i * 0.12), pan, type: 'bandpass', from: 700 + Math.random() * 500, to: 380, q: 0.9, attack: 0.03 });
    } else if (kind === 'loop-slip') {
      // Wet rope sliding off smooth skin: a soft rubbing rasp, then the slack of it slapping onto the water.
      this.puff({ at, len: 0.6, level: level * 0.05, pan, type: 'bandpass', from: 520, to: 880, q: 2.2, attack: 0.15 });
      this.puff({ at: at + 0.55, len: 0.35, level: level * 0.06, pan, type: 'bandpass', from: 1300, to: 600, q: 0.7, attack: 0.01, wet: 0.05 });
      this.puff({ at: at + 0.6, len: 0.5, level: level * 0.025, pan, type: 'bandpass', from: 2400, to: 1000, q: 0.5, attack: 0.04 });
    } else if (kind === 'swimmer-out') {
      // A small bird scrambling up out of the sea: a quick wet slap and the water running off it.
      this.puff({ at, len: 0.2, level: level * 0.09, pan, type: 'bandpass', from: 1700, to: 900, q: 0.7, attack: 0.006, wet: 0.2 });
      for (let i = 0; i < 5; i++) this.blip(at + 0.08 + i * 0.05 + Math.random() * 0.03, 1300 + Math.random() * 1400, 700, 0.04,
        level * 0.016, pan);
    } else if (kind === 'whale-slap') {
      // A broad flipper laid flat on the water: a wet clap, a low thump under it, the spray falling back.
      this.puff({ at, len: 0.12, level: level * 0.11, pan, type: 'bandpass', from: 1300, to: 800, q: 0.7, attack: 0.004, wet: 0.06 });
      this.blip(at, 95, 55, 0.24, level * 0.05, pan, 'triangle', 0.05);
      this.puff({ at: at + 0.06, len: 0.75, level: level * 0.035, pan, type: 'bandpass', from: 2100, to: 850, q: 0.5, attack: 0.06, wet: 0.04 });
    } else if (kind === 'whale-surface' || kind === 'whale-dive') {
      const dive = kind === 'whale-dive';
      this.puff({ at, len: dive ? 2.1 : 1.6, level: level * (dive ? 0.17 : 0.13), pan,
        type: 'bandpass', from: dive ? 480 : 380, to: 160, q: 0.5, attack: tuning.audio.whaleAttack, wet: 0.05 });
      this.puff({ at: at + 0.08, len: dive ? 1.1 : 0.8, level: level * 0.045, pan,
        type: 'bandpass', from: 1100, to: 450, q: 0.5, attack: 0.2 });
    } else {
      const dolphin = level * tuning.audio.dolphinLevel;
      this.puff({ at, len: 0.8, level: dolphin * 0.13, pan, type: 'bandpass',
        from: 700, to: 220, q: 0.5, attack: tuning.audio.dolphinAttack, wet: 0.08 });
      this.puff({ at: at + 0.09, len: 0.4, level: dolphin * 0.024, pan,
        type: 'bandpass', from: 1500, to: 650, q: 0.5, attack: 0.07, wet: 0.04 });
    }
  }

  /**
   * The whale's voice, once in greeting and once in goodbye: a low soft call rising a fourth from A to D and settling
   * on B, in the sea score's own notes, hollow rather than bright and long in the reverb. `far` is the same call heard
   * from a long way off over the water: darker, quieter, and coming back once. `glad` is the same voice breathing
   * free: a little brighter, and instead of settling it goes on up to E.
   */
  call(level: number, pan: number, far = false, glad = false): void {
    const out = this.out;
    if (!out || level < 0.005) return;
    const { ctx } = out;
    const at = ctx.currentTime + 0.02;
    const len = 3.6;
    const voice = (start: number, gain: number, cutoff: number, wet: number) => {
      const env = ctx.createGain();
      env.gain.setValueAtTime(0, start);
      env.gain.linearRampToValueAtTime(gain, start + 0.6);
      env.gain.setValueAtTime(gain, start + len - 1.4);
      env.gain.exponentialRampToValueAtTime(0.0001, start + len);
      const tone = ctx.createBiquadFilter();
      tone.type = 'lowpass';
      tone.Q.value = 0.7;
      tone.frequency.setValueAtTime(cutoff * 0.6, start);
      tone.frequency.linearRampToValueAtTime(cutoff, start + 1.3);
      tone.frequency.linearRampToValueAtTime(cutoff * 0.7, start + len);
      const hollow = ctx.createBiquadFilter();
      hollow.type = 'peaking';
      hollow.frequency.value = 340;
      hollow.Q.value = 2.5;
      hollow.gain.value = 7;
      const p = ctx.createStereoPanner();
      p.pan.value = Math.max(-0.85, Math.min(0.85, pan));
      const vibrato = ctx.createOscillator();
      vibrato.frequency.value = 4.2;
      const depth = ctx.createGain();
      depth.gain.setValueAtTime(0, start);
      depth.gain.linearRampToValueAtTime(1.6, start + 1.2);
      vibrato.connect(depth);
      const nodes: AudioNode[] = [env, tone, hollow, p, vibrato, depth];
      for (const [type, share] of [['sawtooth', glad ? 0.45 : 0.35], ['sine', 1]] as const) {
        const osc = ctx.createOscillator();
        osc.type = type;
        osc.frequency.setValueAtTime(110, start);
        osc.frequency.exponentialRampToValueAtTime(146.83, start + 1.4);
        osc.frequency.setValueAtTime(146.83, start + 1.9);
        osc.frequency.exponentialRampToValueAtTime(glad ? 164.81 : 123.47, start + 3.3);
        depth.connect(osc.frequency);
        const g = ctx.createGain();
        g.gain.value = share;
        osc.connect(g).connect(env);
        osc.start(start);
        osc.stop(start + len + 0.05);
        nodes.push(osc, g);
        osc.onended = () => nodes.forEach((n) => n.disconnect());
      }
      env.connect(tone).connect(hollow).connect(p).connect(out.bus);
      const send = ctx.createGain();
      send.gain.value = wet;
      p.connect(send).connect(out.reverb);
      nodes.push(send);
      vibrato.start(start);
      vibrato.stop(start + len + 0.05);
    };
    if (far) {
      voice(at, level * 0.02, 260, 0.6);
      voice(at + 0.55, level * 0.009, 200, 0.8);
    } else voice(at, level * 0.035, glad ? 860 : 620, glad ? 0.45 : 0.35);
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
    env.gain.value = 0;
    env.gain.setValueAtTime(0, o.at);
    env.gain.linearRampToValueAtTime(o.level, o.at + (o.attack ?? 0.006));
    env.gain.exponentialRampToValueAtTime(0.0001, o.at + o.len);
    const pan = ctx.createStereoPanner();
    pan.pan.value = Math.max(-0.85, Math.min(0.85, o.pan));
    src.connect(filter).connect(env).connect(pan).connect(out.bus);
    const send = o.wet ? ctx.createGain() : null;
    if (send) {
      send.gain.value = o.wet ?? 0;
      pan.connect(send).connect(out.reverb);
    }
    src.onended = () => { src.disconnect(); filter.disconnect(); env.disconnect(); pan.disconnect(); send?.disconnect(); };
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
    const send = wet ? ctx.createGain() : null;
    if (send) {
      send.gain.value = wet;
      p.connect(send).connect(out.reverb);
    }
    osc.onended = () => { osc.disconnect(); env.disconnect(); p.disconnect(); send?.disconnect(); };
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

  /** A fine crystalline settling, then a low airy resonance as the warm refuge cools. */
  frost(cold:number):void {
    if(cold<.04)this.frostHeard=false;
    if(cold<.18 || this.frostHeard || !this.out)return;
    this.frostHeard=true;
    const at=this.out.ctx.currentTime+.01;
    for(let i=0;i<5;i++) {
      this.blip(at+i*.24,1800-i*170,1100-i*80,.6,.005,-.2+i*.1,'sine',.55);
      this.puff({at:at+i*.17,len:.21,level:.008,pan:-.25+i*.12,type:'highpass',from:4200,attack:.06,wet:.3});
    }
    this.puff({at:at+.35,len:2.5,level:.018,pan:0,type:'bandpass',from:460,to:240,q:1.2,attack:.7,wet:.45});
  }

  /**
   * Wood burning: a low roar that breathes under it all, and crackles in small uneven clusters with now and then a
   * sharper snap. The last of them stop with the flame. The waking alarm is deliberately silent.
   */
  hearth(flame: number, near: number, pan: number): void {
    const out = this.out;
    if (!out || !this.noise) return;
    const { ctx } = out;
    const at = ctx.currentTime;
    const level = flame * near;
    if (!this.hearthBed) {
      if (level < 0.01) return;
      const src = ctx.createBufferSource();
      src.buffer = this.noise;
      src.loop = true;
      const roar = ctx.createBiquadFilter();
      roar.type = 'lowpass';
      roar.Q.value = 0.4;
      const gain = ctx.createGain();
      gain.gain.value = 0;
      const panner = ctx.createStereoPanner();
      src.connect(roar).connect(gain).connect(panner).connect(out.bus);
      src.start();
      this.hearthBed = { src, roar, gain, pan: panner, quietSince: null };
    }
    const bed = this.hearthBed;
    if (level >= 0.01) bed.quietSince = null;
    else if (bed.quietSince === null) bed.quietSince = at;
    else if (at - bed.quietSince > 2) {
      bed.gain.gain.setTargetAtTime(0, at, 0.05);
      bed.src.stop(at + 0.5);
      this.hearthBed = null;
      return;
    }
    const breath = 0.72 + 0.28 * Math.sin(at * 1.3) * Math.sin(at * 0.47 + 1.1);
    bed.gain.gain.setTargetAtTime(0.05 * level * breath, at, 0.25);
    bed.roar.frequency.setTargetAtTime(240 + 220 * flame * breath, at, 0.3);
    bed.pan.pan.setTargetAtTime(Math.max(-0.85, Math.min(0.85, pan)), at, 0.2);
    if (level < 0.01 || at < this.nextCrackle) return;
    this.nextCrackle = at - Math.log(1 - Math.random()) * 0.3 / Math.max(0.3, flame);
    let t = at + 0.005;
    for (let i = 0, n = 1 + Math.floor(Math.random() ** 2 * 5); i < n; i++) {
      this.puff({ at: t, len: 0.006 + Math.random() * 0.014, level: 0.1 * level * (0.35 + Math.random() * 0.65) * (i ? 0.65 : 1),
        pan: pan + (Math.random() - 0.5) * 0.15, type: 'bandpass', from: 1800 + Math.random() * 3600, q: 1.3, attack: 0.001 });
      t += 0.012 + Math.random() * 0.05;
    }
    if (Math.random() < 0.08) {
      this.puff({ at: t + 0.02, len: 0.03, level: 0.16 * level, pan, type: 'bandpass', from: 900 + Math.random() * 600, q: 1.8, attack: 0.001, wet: 0.06 });
      this.puff({ at: t + 0.02, len: 0.05, level: 0.05 * level, pan, type: 'highpass', from: 3200, attack: 0.001 });
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

  /** Close feather friction and uneven wing strokes, separated from the fading thunder by the held recoil. */
  scramble(pan: number): void {
    const now = this.out?.ctx.currentTime;
    if (now === undefined) return;
    for (let i = 0; i < 9; i++) {
      const at = now + 0.01 + i * 0.105;
      const level = tuning.wood.scrambleGain * (1 - i / 13);
      this.puff({ at, len: 0.15, level, pan, type: 'bandpass', from: 3200 + (i % 3) * 450, to: 1500, q: 0.55, attack: 0.018 });
      this.puff({ at: at + 0.018, len: 0.12, level: level * 0.55, pan, type: 'lowpass', from: 1500, to: 450, attack: 0.025 });
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

  /** The throb of big wings going over: one soft pulse of air per beat, the sound a skein makes before you see it. */
  wingbeat(dt: number, pan: number, far: number): void {
    this.swanBeat += dt * 3.4;
    if (this.swanBeat <= Math.PI * 2) return;
    // Inaudible beats still pass: approaching swans must not replay a distant backlog.
    this.swanBeat %= Math.PI * 2;
    if (far >= 0.75) return;
    const now = this.out?.ctx.currentTime;
    if (now === undefined) return;
    this.puff({ at: now + 0.005, len: 0.22, level: 0.03 * (1 - 0.7 * far), pan, type: 'bandpass', from: 760, to: 520, q: 1.6, attack: 0.06, wet: 0.3 + 0.4 * far });
  }
}
