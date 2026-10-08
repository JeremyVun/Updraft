import { tuning } from '../tuning';
import type { AudioOut } from '../creatures/voices';
import type { WhaleSound } from '../fx/sealife/wake';

export type Surface = 'grass' | 'sand' | 'wood' | 'water';
export type MaterialSound = 'cloth' | 'wool' | 'sail' | 'sail-settle' | 'water' | 'paper' | 'door' | 'splash' | 'peg'
  | 'dolphin-surface' | 'leaf-scuff' | 'swing-creak' | 'tub' | WhaleSound
  | 'tree-creak' | 'roots-give' | 'root-tear' | 'tree-fall' | 'bough-creak' | 'slate-land'
  | 'mill-start' | 'mill-creak' | 'mill-settle' | 'mill-click' | 'linen-flap' | 'hull-scrape' | 'hull-strain';

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
    } else if (kind === 'tub') {
      // A wooden tub knocking against slates or a hull: a hollow low knock, and the water slapping in round it.
      const colour = 0.9 + Math.random() * 0.2;
      this.blip(at, 210 * colour, 150 * colour, 0.16, level * 0.05, pan, 'triangle', 0.06);
      this.puff({ at, len: 0.06, level: level * 0.05, pan, type: 'bandpass', from: 900 * colour, q: 1.4, attack: 0.002 });
      this.puff({ at: at + 0.05, len: 0.3, level: level * 0.03, pan, type: 'bandpass', from: 700, to: 380, q: 0.6, attack: 0.03, wet: 0.05 });
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
    } else if (kind === 'tree-creak') {
      // A dead trunk working on rotten roots: a slow, deep stick-slip creak, never a door's squeal.
      const colour = 0.88 + Math.random() * 0.24, rising = Math.random() < 0.6;
      const len = 0.55 + 0.5 * Math.min(1, amount);
      this.rasp({ at, len, from: (rising ? 24 : 36) * colour, to: (rising ? 36 : 25) * colour, jitter: 0.22,
        bodies: [[200 * colour, 7, 1], [460 * colour, 6, 0.8], [1100 * colour, 5, 0.4]], level: level * 0.11, pan, attack: 0.12, wet: 0.06 });
      this.puff({ at: at + 0.05, len: len * 0.8, level: level * 0.006, pan, type: 'bandpass', from: 900 * colour, to: 650 * colour, q: 1, attack: 0.15 });
    } else if (kind === 'roots-give') {
      // Roots tearing a step under the water: a deep groan, a few muffled snaps in the earth, then mud bubbling up.
      const colour = 0.9 + Math.random() * 0.2;
      this.rasp({ at, len: 1.2, from: 17 * colour, to: 12 * colour, jitter: 0.25,
        bodies: [[135 * colour, 6, 1], [320 * colour, 5, 0.55], [780 * colour, 4, 0.18]], level: level * 0.18, pan, attack: 0.08, wet: 0.08 });
      for (let i = 0, t = at + 0.06; i < 5; i++, t += 0.04 + Math.random() * 0.12) {
        this.puff({ at: t, len: 0.035, level: level * (0.04 + Math.random() * 0.03), pan, type: 'lowpass', from: 900 + Math.random() * 600, attack: 0.001 });
        if (i % 2 === 0) this.blip(t, 210 * colour, 130 * colour, 0.05, level * 0.016, pan, 'triangle');
      }
      this.puff({ at: at + 0.1, len: 0.9, level: level * 0.015, pan, type: 'bandpass', from: 420, to: 250, q: 0.7, attack: 0.15, wet: 0.05 });
      this.bubbles(at + 0.35, 9, 1.8, 260, 520, level * 0.02, pan);
    } else if (kind === 'root-tear') {
      // The whole plate tearing out: roots ripping in a run of snaps over a fibrous rip and a long groan, water sucked in after.
      const colour = 0.9 + Math.random() * 0.2;
      this.rasp({ at, len: 1.7, from: 13 * colour, to: 22 * colour, jitter: 0.28,
        bodies: [[115 * colour, 6, 1], [290 * colour, 5, 0.6], [690 * colour, 4, 0.25]], level: level * 0.21, pan, attack: 0.25, wet: 0.08 });
      this.puff({ at: at + 0.1, len: 1.4, level: level * 0.03, pan, type: 'bandpass', from: 480, to: 1100, q: 0.8, attack: 0.4 });
      for (let i = 0, t = at + 0.05; i < 26; i++) {
        const u = i / 25;
        this.puff({ at: t, len: 0.012 + Math.random() * 0.025, level: level * (0.03 + Math.random() * 0.05) * (1 - 0.5 * u), pan: pan + (Math.random() - 0.5) * 0.2,
          type: 'bandpass', from: 700 + Math.random() * 1900, q: 1.2, attack: 0.001 });
        if (Math.random() < 0.25) this.blip(t, 150 + Math.random() * 110, 100, 0.045, level * 0.02, pan, 'triangle');
        t += 0.015 + 0.09 * Math.abs(u - 0.35) * Math.random();
      }
      this.puff({ at: at + 0.5, len: 1.3, level: level * 0.0175, pan, type: 'lowpass', from: 320, to: 150, attack: 0.2, wet: 0.06 });
      this.bubbles(at + 0.7, 10, 1.4, 180, 380, level * 0.025, pan);
    } else if (kind === 'tree-fall') {
      // A heavy trunk landing across the gap: a deep thud and a knock of wood on stone, its crown cracking, then the splash.
      this.blip(at, 85, 45, 0.55, level * 0.12, pan, 'sine', 0.12);
      this.puff({ at, len: 0.42, level: level * 0.1, pan, type: 'lowpass', from: 260, to: 90, attack: 0.004, wet: 0.08 });
      this.puff({ at, len: 0.25, level: level * 0.08, pan, type: 'lowpass', from: 520, to: 170, attack: 0.003 });
      this.blip(at + 0.01, 160, 100, 0.24, level * 0.07, pan, 'triangle', 0.05);
      this.puff({ at: at + 0.005, len: 0.05, level: level * 0.042, pan, type: 'bandpass', from: 750, q: 1.4, attack: 0.001 });
      for (let i = 0; i < 6; i++) this.puff({ at: at + 0.02 + Math.random() * 0.25, len: 0.02, level: level * (0.014 + Math.random() * 0.021), pan: pan + (Math.random() - 0.5) * 0.3,
        type: 'bandpass', from: 1800 + Math.random() * 1500, q: 1.4, attack: 0.001 });
      this.puff({ at: at + 0.03, len: 1.1, level: level * 0.1, pan, type: 'bandpass', from: 1500, to: 480, q: 0.5, attack: 0.015, wet: 0.15 });
      this.puff({ at: at + 0.04, len: 0.4, level: level * 0.021, pan, type: 'highpass', from: 2600, attack: 0.01 });
      for (let i = 0; i < 12; i++) {
        const f = 1000 + Math.random() * 1600;
        this.blip(at + 0.25 + Math.random() * 1.05, f, f * 0.55, 0.05, level * 0.012, pan + (Math.random() - 0.5) * 0.5);
      }
      this.puff({ at: at + 0.3, len: 1.6, level: level * 0.035, pan, type: 'bandpass', from: 520, to: 260, q: 0.6, attack: 0.25, wet: 0.1 });
    } else if (kind === 'bough-creak') {
      // Thick old rope working round a bough as the swing turns: a soft, low, fibrous creak, slower than the dead tree's.
      const colour = 0.9 + Math.random() * 0.2, rising = Math.random() < 0.5;
      this.rasp({ at, len: 0.5, from: (rising ? 26 : 36) * colour, to: (rising ? 34 : 24) * colour, jitter: 0.14,
        bodies: [[300 * colour, 6, 1], [720 * colour, 5, 0.6]], level: level * 0.06, pan, attack: 0.1, wet: 0.04 });
      this.puff({ at: at + 0.04, len: 0.32, level: level * 0.0028, pan, type: 'bandpass', from: 1400 * colour, to: 900 * colour, q: 1, attack: 0.09 });
    } else if (kind === 'mill-start') {
      // The old windshaft taking up: a dull knock as the brake lets go, then a dry axle groan whose stick-slip quickens.
      const colour = 0.9 + Math.random() * 0.2;
      this.blip(at, 120 * colour, 85 * colour, 0.18, level * 0.05, pan, 'triangle', 0.05);
      this.puff({ at, len: 0.06, level: level * 0.05, pan, type: 'bandpass', from: 650 * colour, q: 1.3, attack: 0.002 });
      this.rasp({ at: at + 0.08, len: 1.3, from: 9 * colour, to: 26 * colour, jitter: 0.3,
        bodies: [[150 * colour, 6, 1], [370 * colour, 5, 0.7], [880 * colour, 4, 0.3]], level: level * 0.12, pan, attack: 0.18, wet: 0.05 });
      this.puff({ at: at + 0.15, len: 1.1, level: level * 0.008, pan, type: 'bandpass', from: 1100, to: 1500, q: 1.2, attack: 0.3 });
    } else if (kind === 'mill-creak') {
      // Wood working through the turn: the stock in its canister, drier and higher than the dead tree, and short.
      const colour = 0.88 + Math.random() * 0.24, rising = Math.random() < 0.5;
      this.rasp({ at, len: 0.42 + 0.25 * Math.min(1, amount), from: (rising ? 30 : 44) * colour, to: (rising ? 42 : 30) * colour, jitter: 0.18,
        bodies: [[260 * colour, 6, 1], [620 * colour, 5, 0.7], [1350 * colour, 4, 0.3]], level: level * 0.07, pan, attack: 0.08, wet: 0.04 });
    } else if (kind === 'mill-settle') {
      // Coming to rest as if braked: the shaft dragging to a stop in a slowing judder, then a soft wooden settle.
      const colour = 0.9 + Math.random() * 0.2;
      this.rasp({ at, len: 0.75, from: 30 * colour, to: 8 * colour, jitter: 0.2,
        bodies: [[180 * colour, 6, 1], [440 * colour, 5, 0.6], [1000 * colour, 4, 0.25]], level: level * 0.1, pan, attack: 0.04, wet: 0.05 });
      this.puff({ at, len: 0.7, level: level * 0.02, pan, type: 'bandpass', from: 900, to: 420, q: 0.9, attack: 0.05 });
      this.blip(at + 0.72, 105 * colour, 80 * colour, 0.2, level * 0.04, pan, 'triangle', 0.06);
      this.puff({ at: at + 0.72, len: 0.08, level: level * 0.03, pan, type: 'lowpass', from: 500, attack: 0.003 });
    } else if (kind === 'mill-click') {
      // The hoist's pawl dropping over a tooth of the drum's ratchet: a small dry iron tick on a wooden knock.
      const colour = 0.94 + Math.random() * 0.12;
      this.puff({ at, len: 0.018, level: level * 0.05, pan, type: 'bandpass', from: 3200 * colour, q: 5, attack: 0.0008 });
      this.blip(at, 1700 * colour, 1500 * colour, 0.03, level * 0.012, pan, 'triangle');
      this.blip(at + 0.004, 240 * colour, 190 * colour, 0.05, level * 0.025, pan, 'triangle', 0.02);
    } else if (kind === 'hull-scrape') {
      // The keel running up onto slates under the water: a grinding drag that slows, a hollow knock in the hull as it stops.
      const colour = 0.9 + Math.random() * 0.2;
      this.rasp({ at, len: 0.9, from: 34 * colour, to: 11 * colour, jitter: 0.35,
        bodies: [[170 * colour, 5, 1], [420 * colour, 4, 0.7], [1500 * colour, 3, 0.35]], level: level * 0.16, pan, attack: 0.03, wet: 0.06 });
      this.puff({ at, len: 0.8, level: level * 0.04, pan, type: 'bandpass', from: 2400 * colour, to: 900 * colour, q: 0.8, attack: 0.02 });
      this.blip(at + 0.82, 95 * colour, 60 * colour, 0.32, level * 0.09, pan, 'triangle', 0.08);
      this.puff({ at: at + 0.82, len: 0.1, level: level * 0.04, pan, type: 'lowpass', from: 420, attack: 0.002 });
      this.puff({ at: at + 0.86, len: 0.6, level: level * 0.02, pan, type: 'bandpass', from: 650, to: 340, q: 0.6, attack: 0.05, wet: 0.06 });
    } else if (kind === 'hull-strain') {
      // The hull pressed by its sail against what holds it: planks and keel working on the slates, a slow deep creak.
      const colour = 0.9 + Math.random() * 0.2;
      this.rasp({ at, len: 0.8, from: 16 * colour, to: 26 * colour, jitter: 0.24,
        bodies: [[150 * colour, 6, 1], [380 * colour, 5, 0.6], [900 * colour, 4, 0.25]], level: level * 0.11, pan, attack: 0.15, wet: 0.05 });
      this.puff({ at: at + 0.3, len: 0.35, level: level * 0.015, pan, type: 'bandpass', from: 1300 * colour, to: 700 * colour, q: 1.1, attack: 0.08 });
    } else if (kind === 'linen-flap') {
      // Torn scraps of old sail-cloth lifting and falling back: two or three soft, papery flaps, never a snap.
      const colour = 0.9 + Math.random() * 0.2;
      for (let i = 0, t = at; i < 2 + Math.floor(Math.random() * 2); i++, t += 0.09 + Math.random() * 0.08) {
        this.puff({ at: t, len: 0.12, level: level * (0.05 - i * 0.012), pan, type: 'bandpass', from: 1100 * colour, to: 600 * colour, q: 0.6, attack: 0.02, wet: 0.04 });
      }
    } else if (kind === 'slate-land') {
      // Small boots and a hand coming down on wet slates: a soft thump, a clack or two of slate, a short scuff.
      const colour = 0.92 + Math.random() * 0.16;
      this.blip(at, 150 * colour, 80, 0.12, level * 0.04, pan, 'sine', 0.04);
      this.puff({ at, len: 0.07, level: level * 0.051, pan, type: 'lowpass', from: 600, attack: 0.002 });
      for (const [dt, f] of [[0, 2900], [0.028, 3300], [0.075, 2500]] as const) {
        this.puff({ at: at + dt, len: 0.03, level: level * 0.075, pan, type: 'bandpass', from: f * colour, q: 4, attack: 0.001 });
        this.blip(at + dt, 1900 * colour, 1600 * colour, 0.05, level * 0.012, pan, 'triangle');
      }
      this.puff({ at: at + 0.06, len: 0.2, level: level * 0.03, pan, type: 'bandpass', from: 1900, to: 900, q: 0.7, attack: 0.03 });
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

  /**
   * Stick-slip friction, the heart of a creak: a train of pulses at a rate gliding `from` to `to` (with `jitter`, as
   * wood and rope grab unevenly), rung through the resonances of what is creaking (`bodies`: hertz, Q, gain).
   */
  private rasp(o: { at: number; len: number; from: number; to: number; jitter: number; bodies: readonly (readonly [number, number, number])[]; level: number; pan: number; attack: number; wet: number }): void {
    const out = this.out;
    if (!out || o.level <= 0.0002) return;
    const { ctx } = out;
    const steps = Math.max(8, Math.round(o.len * 24));
    const rate = new Float32Array(steps), grip = new Float32Array(steps);
    for (let i = 0; i < steps; i++) {
      rate[i] = o.from * (o.to / o.from) ** (i / (steps - 1)) * (1 + (Math.random() - 0.5) * 2 * o.jitter);
      grip[i] = 0.5 + 0.5 * Math.random();
    }
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueCurveAtTime(rate, o.at, o.len);
    const grab = ctx.createGain();
    grab.gain.setValueCurveAtTime(grip, o.at, o.len);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, o.at);
    env.gain.linearRampToValueAtTime(o.level, o.at + o.attack);
    env.gain.setValueAtTime(o.level, o.at + Math.max(o.attack, o.len * 0.55));
    env.gain.exponentialRampToValueAtTime(0.0001, o.at + o.len);
    const p = ctx.createStereoPanner();
    p.pan.value = Math.max(-0.85, Math.min(0.85, o.pan));
    osc.connect(grab);
    const nodes: AudioNode[] = [osc, grab, env, p];
    for (const [f, q, gain] of o.bodies) {
      const body = ctx.createBiquadFilter();
      body.type = 'bandpass';
      body.frequency.value = f;
      body.Q.value = q;
      const g = ctx.createGain();
      g.gain.value = gain;
      grab.connect(body).connect(g).connect(env);
      nodes.push(body, g);
    }
    env.connect(p).connect(out.bus);
    if (o.wet) {
      const send = ctx.createGain();
      send.gain.value = o.wet;
      p.connect(send).connect(out.reverb);
      nodes.push(send);
    }
    osc.onended = () => { for (const n of nodes) n.disconnect(); };
    osc.start(o.at);
    osc.stop(o.at + o.len + 0.05);
  }

  /** Bubbles breaking the surface, `count` of them over `over` seconds and thinning out: each a little rising tone. */
  private bubbles(at: number, count: number, over: number, low: number, high: number, level: number, pan: number): void {
    for (let i = 0; i < count; i++) {
      const t = at + over * (i / count) ** 1.6 + Math.random() * 0.06;
      const f = low + Math.random() * (high - low);
      this.blip(t, f, f * (1.5 + Math.random() * 0.4), 0.04 + Math.random() * 0.05, level * (1 - 0.5 * i / count) * (0.6 + 0.4 * Math.random()), pan + (Math.random() - 0.5) * 0.3);
    }
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
