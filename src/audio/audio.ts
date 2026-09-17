import type { Cue } from '../story/cues';

/**
 * Everything is synthesised: filtered noise for air and sea, a slow pad that warms as the world comes back, chimes
 * that follow the player's gestures, skylarks over the hills, crickets and an owl at night, and short phrases that
 * answer the story's moments.
 */

export interface SoundState {
  /** Player gust speed, 0..~26. */
  gust: number;
  /** Pointer position across the screen, -1..1. */
  pan: number;
  /** Gesture direction on screen: +1 moving up/right, -1 down/left. */
  rise: number;
  /** Updraft charge while holding, 0..1. */
  charge: number;
  overLand: boolean;
  /** Natural breeze strength near the island, 0..1. */
  breeze: number;
  /** How hard the glider is being lifted, 0..1. */
  gliderLift: number;
  /** How alive the world is, 0 grey and still to 1. */
  life: number;
  /** 0 by day, 1 at full night. */
  night: number;
  /** How close the sea is: 1 on the island and at sea, falling away inland. */
  sea: number;
  /** 1 out over the green hills, where skylarks sing. */
  meadow: number;
  /** A passing shower, 0 dry to 1. */
  shower: number;
  /** How far the music pulls back, 0 normal to 1 almost gone, so a moment can be heard on its own. */
  hush: number;
  /** Which room's music is playing. */
  music: Mood;
  /** True while the story is playing a beat out on its own and the player's gestures are not driving anything. */
  scripted: boolean;
  cues: Cue[];
}

/**
 * Each room has its own music. Same instrument, same key family, different weather: the chords it turns over,
 * how long it holds each one, how bright the pad is allowed to be, how loud it sits, and the notes the player's
 * own gestures ring out of it. The voices glide between them over a couple of seconds, so a room change is a
 * modulation rather than a new track starting.
 */
export type Mood = 'still' | 'lines' | 'meadow' | 'drowned' | 'wood' | 'sea' | 'home';

interface MoodMusic {
  chords: number[][];
  /** How long each chord is held. */
  seconds: number;
  /** Where the pad's low-pass sits before life and night move it. */
  cutoff: number;
  /** How loud the pad sits in this room, 1 being the meadow. */
  level: number;
  /** The notes the player's gestures ring. */
  scale: number[];
}

const MOODS: Record<Mood, MoodMusic> = {
  /** Open fifths with no third in them: nothing has been decided yet, and nothing is moving. */
  still: { chords: [[50, 57, 62, 69], [45, 52, 57, 64]], seconds: 16, cutoff: 680, level: 0.8, scale: [62, 64, 69, 71, 74, 76, 81, 83, 86] },
  /** The first delight in the journey, and the brightest thing in it. */
  lines: { chords: [[50, 57, 64, 71], [43, 50, 59, 66], [45, 52, 61, 66], [47, 54, 57, 62]], seconds: 9, cutoff: 1500, level: 1, scale: [62, 64, 66, 69, 71, 73, 74, 76, 78, 81, 83, 86] },
  /** The last warm afternoon of the year: the fullest the music gets before the dark. */
  meadow: { chords: [[50, 57, 64, 66], [47, 54, 57, 62], [43, 50, 59, 66], [45, 52, 59, 64]], seconds: 8.5, cutoff: 1600, level: 1, scale: [62, 64, 66, 69, 71, 74, 76, 78, 81, 83, 86, 88] },
  /** Suspended, hollow, never landing on a third: homes the water took. */
  drowned: { chords: [[47, 54, 59, 66], [45, 52, 57, 64], [43, 50, 57, 62], [42, 49, 57, 64]], seconds: 13, cutoff: 820, level: 0.85, scale: [59, 62, 64, 66, 69, 71, 74, 76, 78, 81] },
  /** A drone and the semitone above it, turning over and never resolving. Barely music at all. */
  wood: { chords: [[38, 45, 50, 57], [38, 45, 51, 58]], seconds: 15, cutoff: 440, level: 0.65, scale: [50, 53, 57, 60, 62, 65, 69, 72] },
  /** Out of the dark and into open water, with the bass climbing under it. */
  sea: { chords: [[45, 52, 57, 64], [43, 50, 59, 66], [50, 57, 64, 71], [47, 54, 61, 69]], seconds: 11, cutoff: 1300, level: 1, scale: [62, 64, 66, 69, 71, 74, 76, 78, 81, 83, 86] },
  /** Clear, frozen and resolved: the only room whose chords come home. */
  home: { chords: [[50, 57, 62, 69], [43, 50, 59, 66], [45, 52, 61, 64], [50, 57, 64, 71]], seconds: 10, cutoff: 1450, level: 1.15, scale: [62, 66, 69, 71, 74, 78, 81, 83, 86, 90] },
};

const PULSE = 60 / 96 / 2;

/** The story's phrases as [midi, beats] pairs, in the pad's D major. */
const PHRASES: Record<Cue, [number, number][]> = {
  /** Never played: the cygnet's voice is its own, not a musical phrase. */
  distress: [],
  calling: [],
  breeze: [[74, 1], [78, 1], [81, 2]],
  delight: [[81, 1], [86, 1], [90, 2]],
  restored: [[62, 1], [66, 1], [69, 1], [74, 1], [78, 1], [81, 1], [86, 3]],
  /** High and thin and going away from you, the way a skein sounds when you look up too late. */
  skein: [[86, 2], [83, 2], [81, 3], [78, 2], [76, 4]],
  /** The fall: the same shape turned downward, and it does not resolve. */
  fallen: [[81, 2], [76, 2], [71, 3], [69, 2], [66, 6], [64, 8]],
  /** The air dies: low, slow and unanswered, under a room that has gone quiet. */
  becalmed: [[57, 4], [54, 5], [52, 8]],
  /** And the sail fills: the same notes, the other way up, and the music comes back with them. */
  filled: [[54, 1], [57, 1], [62, 1], [66, 2], [69, 4]],
  /** It has the air under it at last. The one phrase in the game that is allowed to sound like an answer. */
  lifted: [[62, 1], [66, 1], [69, 1], [74, 2], [78, 1], [81, 1], [86, 4], [83, 2], [86, 6]],
  wave: [[57, 1], [62, 1], [66, 1], [69, 1], [74, 2], [78, 2], [81, 4]],
  unfold: [[74, 2], [78, 1], [81, 1], [83, 2], [81, 1], [78, 1], [76, 2], [78, 1], [74, 3], [0, 2], [71, 1], [74, 1], [76, 2], [78, 1], [76, 1], [74, 4]],
  release: [[69, 1], [74, 1], [78, 1], [81, 1], [86, 2], [90, 2], [93, 5]],
  home: [[62, 2], [66, 2], [69, 2], [74, 6]],
};
const PHRASE_BEAT: Record<Cue, number> = { distress: 0.2, calling: 0.2, breeze: 0.3, delight: 0.14, restored: 0.22, skein: 0.34, fallen: 0.5, becalmed: 0.55, filled: 0.26, lifted: 0.3, wave: 0.2, unfold: 0.46, release: 0.3, home: 0.5 };

const hz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);

function pinkNoise(ctx: AudioContext, seconds: number): AudioBuffer {
  const buffer = ctx.createBuffer(2, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buffer.getChannelData(ch);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < d.length; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.969 * b2 + white * 0.153852;
      b3 = 0.8665 * b3 + white * 0.3104856;
      b4 = 0.55 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.016898;
      d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
      b6 = white * 0.115926;
    }
  }
  return buffer;
}

function impulse(ctx: AudioContext, seconds: number): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buffer.getChannelData(ch);
    for (let i = 0; i < len; i++) {
      const t = i / len;
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 3.2) * (i < ctx.sampleRate * 0.012 ? i / (ctx.sampleRate * 0.012) : 1);
    }
  }
  return buffer;
}

export class Soundscape {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private reverb!: GainNode;
  private noise!: AudioBuffer;
  private breezeGain!: GainNode;
  private breezeFilter!: BiquadFilterNode;
  private gustGain!: GainNode;
  private gustFilter!: BiquadFilterNode;
  private gustPan!: StereoPannerNode;
  private whistleGain!: GainNode;
  private whistleFilter!: BiquadFilterNode;
  private rustleGain!: GainNode;
  private seaGain!: GainNode;
  private liftGain!: GainNode;
  private liftFilter!: BiquadFilterNode;
  private padVoices: { osc: OscillatorNode[]; gain: GainNode }[] = [];
  private padGain!: GainNode;
  private chord = -1;
  private mood: Mood | null = null;
  private noteIndex = 4;
  private lastNote = 0;
  private lastArp = 0;
  private wasGusting = false;
  private prevGliderLift = 0;
  private lastGlider = 0;
  private activity = 0;
  private muted = false;
  private padFilter!: BiquadFilterNode;
  private rainGain!: GainNode;
  private patterGain!: GainNode;
  private nextCricket = 0;
  private nextOwl = 20;
  private nextLark = 8;

  get running(): boolean {
    return this.ctx?.state === 'running' && !this.muted;
  }

  /** The live audio graph for other modules' sounds: connect to `bus` (dry) and optionally `reverb` (wet). Null until sound starts or while muted. */
  get output(): { ctx: AudioContext; bus: AudioNode; reverb: AudioNode } | null {
    return this.running && this.ctx ? { ctx: this.ctx, bus: this.master, reverb: this.reverb } : null;
  }

  /** Must be called from a user gesture. */
  start(): void {
    if (this.ctx) {
      void this.ctx.resume();
      return;
    }
    const ctx = new AudioContext();
    this.ctx = ctx;
    this.noise = pinkNoise(ctx, 6);

    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.ratio.value = 3;
    comp.connect(ctx.destination);
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.master.gain.setTargetAtTime(0.9, ctx.currentTime, 0.8);
    this.master.connect(comp);

    const convolver = ctx.createConvolver();
    convolver.buffer = impulse(ctx, 4.5);
    this.reverb = ctx.createGain();
    this.reverb.gain.value = 0.55;
    this.reverb.connect(convolver).connect(this.master);

    [this.breezeGain, this.breezeFilter] = this.noiseLayer('lowpass', 520, 0.4, 0);
    const breezeLfo = ctx.createOscillator();
    const breezeLfoGain = ctx.createGain();
    breezeLfo.frequency.value = 0.07;
    breezeLfoGain.gain.value = 180;
    breezeLfo.connect(breezeLfoGain).connect(this.breezeFilter.frequency);
    breezeLfo.start();

    this.gustPan = ctx.createStereoPanner();
    this.gustPan.connect(this.master);
    [this.gustGain, this.gustFilter] = this.noiseLayer('bandpass', 400, 1.1, 0.25, this.gustPan);
    [this.whistleGain, this.whistleFilter] = this.noiseLayer('bandpass', 1200, 14, 0.1, this.gustPan);
    [this.rustleGain] = this.noiseLayer('highpass', 2800, 0.6, 0.05, this.gustPan);
    [this.liftGain, this.liftFilter] = this.noiseLayer('bandpass', 300, 3, 0.3);

    const [seaGain] = this.noiseLayer('lowpass', 380, 0.5, 0);
    this.seaGain = seaGain;
    [this.rainGain] = this.noiseLayer('highpass', 2600, 0.5, 0.2);
    [this.patterGain] = this.noiseLayer('bandpass', 900, 0.7, 0.3);

    this.padGain = ctx.createGain();
    this.padGain.gain.value = 0.0;
    const padFilter = ctx.createBiquadFilter();
    padFilter.type = 'lowpass';
    padFilter.frequency.value = 1100;
    padFilter.Q.value = 0.3;
    this.padFilter = padFilter;
    this.padGain.connect(padFilter);
    padFilter.connect(this.master);
    padFilter.connect(this.reverb);
    for (let v = 0; v < 4; v++) {
      const gain = ctx.createGain();
      gain.gain.value = 0;
      gain.connect(this.padGain);
      const osc = [0, 1].map((k) => {
        const o = ctx.createOscillator();
        o.type = k === 0 ? 'triangle' : 'sine';
        o.detune.value = k === 0 ? -6 : 7;
        o.connect(gain);
        o.start();
        return o;
      });
      this.padVoices.push({ osc, gain });
    }
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (!this.ctx) return;
    this.master.gain.setTargetAtTime(muted ? 0 : 0.9, this.ctx.currentTime, 0.25);
  }

  private noiseLayer(
    type: BiquadFilterType,
    freq: number,
    q: number,
    reverbSend: number,
    out?: AudioNode,
  ): [GainNode, BiquadFilterNode] {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    src.loopStart = Math.random() * 3;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    filter.Q.value = q;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    src.connect(filter).connect(gain);
    gain.connect(out ?? this.master);
    if (reverbSend > 0) {
      const send = ctx.createGain();
      send.gain.value = reverbSend;
      gain.connect(send).connect(this.reverb);
    }
    src.start(0, Math.random() * 5);
    return [gain, filter];
  }

  private chime(midi: number, velocity: number, pan: number, when: number, decay = 2.2): void {
    const ctx = this.ctx!;
    const out = ctx.createGain();
    const panner = ctx.createStereoPanner();
    panner.pan.value = Math.max(-0.8, Math.min(0.8, pan));
    out.connect(panner);
    panner.connect(this.master);
    const send = ctx.createGain();
    send.gain.value = 0.9;
    panner.connect(send).connect(this.reverb);
    const f = hz(midi);
    const partials: [number, number][] = [[1, 1], [2.0, 0.28], [3.01, 0.1], [4.2, 0.04]];
    for (const [ratio, amp] of partials) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f * ratio;
      const g = ctx.createGain();
      const peak = velocity * amp * 0.16;
      g.gain.setValueAtTime(0, when);
      g.gain.linearRampToValueAtTime(peak, when + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, when + decay / ratio);
      o.connect(g).connect(out);
      o.start(when);
      o.stop(when + decay + 0.1);
    }
  }

  /** A short tone with its own envelope, for birds and insects. */
  private tone(freq: number, to: number, when: number, length: number, level: number, pan: number, wet: number, type: OscillatorType = 'sine'): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, when);
    o.frequency.exponentialRampToValueAtTime(to, when + length);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(level, when + Math.min(0.02, length * 0.3));
    g.gain.exponentialRampToValueAtTime(0.0001, when + length);
    const panner = ctx.createStereoPanner();
    panner.pan.value = pan;
    o.connect(g).connect(panner).connect(this.master);
    if (wet > 0) {
      const send = ctx.createGain();
      send.gain.value = wet;
      panner.connect(send).connect(this.reverb);
    }
    o.start(when);
    o.stop(when + length + 0.05);
  }

  /** A field cricket: three quick pulses of a high tone. */
  private cricket(when: number, pan: number, level: number): void {
    const f = 4300 + Math.random() * 600;
    for (let i = 0; i < 3; i++) this.tone(f, f * 0.98, when + i * 0.045, 0.03, level, pan, 0.15);
  }

  /** A tawny owl far off: a soft hoo, a pause, a long wavering hoooo. */
  private owl(when: number, pan: number): void {
    this.tone(390, 370, when, 0.35, 0.05, pan, 0.8);
    this.tone(395, 360, when + 1.1, 1.3, 0.045, pan, 0.8);
  }

  /** A skylark high over the hills: a run of quick, bright, tumbling notes. */
  private skylark(when: number, pan: number, level: number): void {
    let t = when;
    const notes = 18 + Math.floor(Math.random() * 20);
    for (let i = 0; i < notes; i++) {
      const f = 2600 + Math.random() * 2400;
      const len = 0.04 + Math.random() * 0.06;
      this.tone(f, f * (0.9 + Math.random() * 0.25), t, len, level * (0.6 + Math.random() * 0.4), pan, 0.35);
      t += len + Math.random() * 0.05;
    }
  }

  /**
   * The cygnet's voice. It is the only sound either traveller ever makes, so it is kept for the few moments that
   * matter: a small bird calling for a family that is not coming back. Thin, high, and pitched to be heard over
   * nothing at all.
   */
  private peep(loudness = 1, longing = false): void {
    const ctx = this.ctx!;
    const t0 = ctx.currentTime + 0.02;
    const out = ctx.createGain();
    const panner = ctx.createStereoPanner();
    panner.pan.value = (Math.random() - 0.5) * 0.3;
    out.connect(panner);
    panner.connect(this.master);
    const send = ctx.createGain();
    send.gain.value = 0.8;
    panner.connect(send).connect(this.reverb);

    /** Calling out to them is lower and longer than calling for help: less panic in it, and more hope. */
    const calls = longing ? 2 : 2 + Math.floor(Math.random() * 2);
    let at = t0;
    for (let i = 0; i < calls; i++) {
      const len = (longing ? 0.4 : 0.16) + Math.random() * 0.08;
      /** A cygnet's note is a thin whistle, well above where a crane chick's sat. */
      const f = (longing ? 1480 : 2050) + Math.random() * 380 - i * 70;
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f * 0.72, at);
      osc.frequency.exponentialRampToValueAtTime(f * 1.12, at + len * 0.3);
      osc.frequency.exponentialRampToValueAtTime(f * 0.62, at + len);
      const waver = ctx.createOscillator();
      waver.frequency.value = 17 + Math.random() * 6;
      const depth = ctx.createGain();
      depth.gain.value = f * 0.035;
      waver.connect(depth).connect(osc.frequency);
      const throat = ctx.createBiquadFilter();
      throat.type = 'bandpass';
      throat.frequency.value = f * 1.5;
      throat.Q.value = 2.2;
      const env = ctx.createGain();
      const peak = 0.075 * loudness * (1 - i * 0.16);
      env.gain.setValueAtTime(0, at);
      env.gain.linearRampToValueAtTime(peak, at + 0.03);
      env.gain.setValueAtTime(peak, at + len * 0.5);
      env.gain.exponentialRampToValueAtTime(0.0001, at + len);
      osc.connect(throat).connect(env).connect(out);
      osc.start(at);
      osc.stop(at + len + 0.05);
      waver.start(at);
      waver.stop(at + len + 0.05);
      at += len + (longing ? 0.34 : 0.1) + Math.random() * 0.07;
    }
  }

  private phrase(name: Cue): void {
    const beat = PHRASE_BEAT[name];
    let at = this.nextPulse() + 0.05;
    for (const [midi, beats] of PHRASES[name]) {
      if (midi > 0) this.chime(midi, name === 'unfold' ? 0.55 : 0.5, 0, at, Math.max(2.2, beats * beat * 3));
      at += beats * beat;
    }
  }

  private nextPulse(): number {
    const now = this.ctx!.currentTime;
    return Math.ceil(now / PULSE) * PULSE;
  }

  update(dt: number, s: SoundState): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    const tc = 0.08;
    const g = Math.min(s.gust / 26, 1);
    this.activity += (Math.max(g, s.charge) - this.activity) * (1 - Math.exp(-dt * (g > this.activity ? 2 : 0.25)));

    this.breezeGain.gain.setTargetAtTime(0.02 + s.breeze * 0.2, now, 0.5);
    this.rainGain.gain.setTargetAtTime(s.shower * 0.07, now, 1.2);
    this.patterGain.gain.setTargetAtTime(s.shower * (0.05 + 0.02 * Math.sin(now * 1.7)), now, 1.2);
    this.seaGain.gain.setTargetAtTime((0.05 + 0.035 * Math.sin(now * 0.8) * Math.sin(now * 0.37)) * (0.15 + 0.85 * s.sea) * (0.4 + 0.6 * s.breeze), now, 0.3);
    this.gustGain.gain.setTargetAtTime(Math.pow(g, 1.4) * 0.55, now, tc);
    this.gustFilter.frequency.setTargetAtTime(260 + g * 1100, now, tc);
    this.gustPan.pan.setTargetAtTime(s.pan * 0.7, now, tc);
    this.whistleGain.gain.setTargetAtTime(Math.max(0, g - 0.55) * 0.12, now, tc);
    this.whistleFilter.frequency.setTargetAtTime(900 + g * 900, now, tc);
    this.rustleGain.gain.setTargetAtTime(s.overLand ? Math.pow(g, 1.2) * 0.2 : 0, now, tc);
    this.liftGain.gain.setTargetAtTime(s.charge * 0.35, now, 0.15);
    this.liftFilter.frequency.setTargetAtTime(220 + s.charge * 1500, now, 0.2);

    const mood = MOODS[s.music] ?? MOODS.meadow;
    const chord = Math.floor(now / mood.seconds) % mood.chords.length;
    if (chord !== this.chord || s.music !== this.mood) {
      /** A room change glides the voices to their new notes rather than cutting: the chord bends into the next. */
      const glide = s.music !== this.mood ? 3.5 : 1.2;
      this.chord = chord;
      this.mood = s.music;
      this.padVoices.forEach((voice, i) => {
        const f = hz(mood.chords[chord][i]);
        voice.osc.forEach((o) => o.frequency.setTargetAtTime(f, now, glide));
        voice.gain.gain.setTargetAtTime(0.25, now, 2.5);
      });
    }
    const hush = 1 - 0.92 * s.hush;
    this.padGain.gain.setTargetAtTime(
      ((0.012 + 0.045 * s.life) * (1 - 0.35 * s.night) + this.activity * 0.09) * hush * mood.level,
      now,
      s.hush > 0.5 ? 0.7 : 1.5,
    );
    this.padFilter.frequency.setTargetAtTime(mood.cutoff + 260 * s.life - 200 * s.night, now, 2.5);

    for (const name of s.cues) {
      if (name === 'distress') this.peep(1);
      else if (name === 'calling') this.peep(0.95, true);
      else this.phrase(name);
    }

    if (s.night > 0.3 && now > this.nextCricket) {
      this.cricket(now + 0.05, Math.random() * 1.6 - 0.8, 0.012 * s.night);
      this.nextCricket = now + 0.25 + Math.random() * (1.6 - s.night);
    }
    if (s.night > 0.7 && now > this.nextOwl) {
      this.owl(now + 0.1, Math.random() * 1.2 - 0.6);
      this.nextOwl = now + 25 + Math.random() * 30;
    }
    if (s.meadow > 0.5 && s.night < 0.2 && s.shower < 0.2 && now > this.nextLark) {
      this.skylark(now + 0.1, Math.random() * 1.4 - 0.7, 0.01 * s.meadow);
      this.nextLark = now + 6 + Math.random() * 10;
    }

    /** The chimes are the player's own voice in the music, so they only answer gestures that are doing something. */
    const gusting = s.gust > 7 && !s.scripted;
    if (gusting) {
      const interval = s.gust > 17 ? PULSE : PULSE * 2;
      const at = this.nextPulse();
      if (!this.wasGusting || at - this.lastNote >= interval - 1e-3) {
        if (at > this.lastNote + 1e-3) {
          const step = (s.rise >= 0 ? 1 : -1) * (s.gust > 18 ? 2 : 1);
          this.noteIndex += step;
          if (this.noteIndex > mood.scale.length - 1) this.noteIndex -= 5;
          if (this.noteIndex < 0) this.noteIndex += 5;
          this.chime(mood.scale[Math.min(this.noteIndex, mood.scale.length - 1)], 0.45 + g * 0.55, s.pan, at);
          this.lastNote = at;
        }
      }
    }
    this.wasGusting = gusting;

    if (s.charge > 0.2 && !s.scripted) {
      const interval = PULSE * (s.charge > 0.7 ? 1 : 2);
      const at = this.nextPulse();
      if (at - this.lastArp >= interval - 1e-3) {
        const chordTones = mood.chords[this.chord % mood.chords.length].map((m) => m + 12);
        const tone = chordTones[Math.floor((now / interval) % chordTones.length)] + (s.charge > 0.6 ? 12 : 0);
        this.chime(tone, 0.25 + s.charge * 0.35, s.pan, at, 1.6);
        this.lastArp = at;
      }
    }

    if (s.gliderLift > 0.45 && this.prevGliderLift <= 0.45 && now - this.lastGlider > 2.5 && !s.scripted) {
      const base = mood.chords[this.chord % mood.chords.length][0] + 24;
      this.chime(base, 0.4, 0, this.nextPulse(), 1.8);
      this.chime(base + 7, 0.35, 0, this.nextPulse() + PULSE, 2.2);
      this.lastGlider = now;
    }
    this.prevGliderLift = s.gliderLift;
  }
}
