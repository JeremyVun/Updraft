import { tuning } from '../tuning';
import type { AudioOut } from '../creatures/voices';
import type { WhaleSound } from '../fx/sealife/wake';

export type Surface = 'grass' | 'sand' | 'wood' | 'water';
export type MaterialSound = 'cloth' | 'wool' | 'sail' | 'water' | 'paper' | 'door' | 'splash'
  | 'dolphin-surface' | WhaleSound;

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

  setOutput(out: AudioOut | null): void {
    if (out && out.ctx !== this.out?.ctx) {
      const length = out.ctx.sampleRate;
      this.noise = out.ctx.createBuffer(1, length, out.ctx.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    }
    this.out = out;
  }

  /** Brief physical sounds, driven by object motion rather than the pointer or a story reward. */
  material(kind: MaterialSound, amount: number, pan: number, closing = false): void {
    const now = this.out?.ctx.currentTime;
    if (now === undefined || amount < 0.015) return;
    const at = now + 0.005;
    const level = Math.min(1.5, amount) * tuning.audio.materialLevel;
    if (kind === 'cloth' || kind === 'wool' || kind === 'sail') {
      const wool = kind === 'wool', sail = kind === 'sail';
      this.puff({ at, len: wool ? 0.3 : 0.23, level: level * (wool ? 0.06 : 0.075), pan,
        type: 'bandpass', from: wool ? 850 : sail ? 650 : 1500, to: wool ? 480 : 700,
        q: 0.55, attack: 0.025, wet: 0.08 });
      if (!wool) this.puff({ at: at + 0.045, len: 0.07, level: level * 0.035, pan,
        type: 'lowpass', from: sail ? 380 : 650, attack: 0.012 });
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
      // A short sheet of water leaving the back; lighter than the landing splash.
      this.puff({ at, len: 0.38, level: level * 0.065, pan, type: 'bandpass',
        from: 1400, to: 650, q: 0.5, attack: 0.028, wet: 0.06 });
      this.puff({ at: at + 0.04, len: 0.2, level: level * 0.022, pan,
        type: 'highpass', from: 2300, attack: 0.025 });
    } else if (kind === 'whale-blow') {
      // An airy exhalation above the water, with a low body and a soft spray tail.
      this.puff({ at, len: 1.35, level: level * 0.17, pan, type: 'bandpass',
        from: 1250, to: 420, q: 0.45, attack: 0.065, wet: 0.04 });
      this.puff({ at, len: 0.9, level: level * 0.075, pan, type: 'lowpass',
        from: 380, to: 180, attack: 0.09 });
      this.puff({ at: at + 0.18, len: 0.85, level: level * 0.024, pan,
        type: 'highpass', from: 2200, attack: 0.12 });
    } else if (kind === 'whale-drain') {
      // Water pouring from the raised flukes, falling away into individual drops.
      this.puff({ at, len: 2.2, level: level * 0.075, pan, type: 'bandpass',
        from: 1900, to: 650, q: 0.5, attack: 0.18, wet: 0.05 });
      for (let i = 0; i < 5; i++) this.puff({ at: at + 0.25 + i * 0.24, len: 0.22,
        level: level * 0.022 * (1 - i * 0.12), pan, type: 'bandpass',
        from: 850 + i * 120, to: 380, q: 0.7, attack: 0.012 });
    } else if (kind === 'whale-surface' || kind === 'whale-dive') {
      const dive = kind === 'whale-dive';
      this.puff({ at, len: dive ? 2.1 : 1.6, level: level * (dive ? 0.17 : 0.13), pan,
        type: 'bandpass', from: dive ? 650 : 480, to: 180, q: 0.5, attack: dive ? 0.07 : 0.16, wet: 0.08 });
      this.puff({ at: at + 0.08, len: dive ? 1.1 : 0.8, level: level * 0.045, pan,
        type: 'bandpass', from: 1800, to: 700, q: 0.5, attack: 0.1 });
    } else {
      this.puff({ at, len: 0.66, level: level * 0.13, pan, type: 'bandpass',
        from: 950, to: 270, q: 0.5, attack: 0.016, wet: 0.18 });
      this.puff({ at: at + 0.08, len: 0.35, level: level * 0.048, pan,
        type: 'highpass', from: 1700, attack: 0.025, wet: 0.1 });
    }
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

  /** The last tiny pops stop with the flame. The waking alarm is deliberately silent. */
  hearth(flame:number,near:number,pan:number):void {
    if(!this.out || flame<.02 || near<.01)return;
    const at=this.out.ctx.currentTime;
    if(at<this.nextCrackle)return;
    this.nextCrackle=at+.18+Math.random()*.45;
    this.puff({at:at+.005,len:.10+Math.random()*.15,level:.018*flame*near,pan,type:'highpass',from:1100+Math.random()*1400,attack:.002});
    this.puff({at:at+.01,len:.4,level:.009*flame*near,pan,type:'lowpass',from:350,attack:.04});
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
  wingbeat(pan: number, far: number): void {
    const now = this.out?.ctx.currentTime;
    if (now === undefined) return;
    this.puff({ at: now + 0.005, len: 0.22, level: 0.03 * (1 - 0.7 * far), pan, type: 'bandpass', from: 760, to: 520, q: 1.6, attack: 0.06, wet: 0.3 + 0.4 * far });
  }
}
