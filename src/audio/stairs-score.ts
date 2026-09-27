import { phrasePosition, phraseHandoff, schedulePhrase, type Phrase } from './phrasing';
import type { StairsAir } from './stairs-air';
import { tuning } from '../tuning';

/**
 * Proposal, awaiting Jeremy's audition. Above the cloud the question the piano asked in the meadow comes back, and
 * opens one step further than it ever has (D–E–F♯–C♯, over G with a sharpened fourth): somewhere else. The sail
 * walks its bass up the scale from D to B under a plucked ripple, and asks the whole question, D–E–F♯–B.
 */
export type StairsScorePhase = 'above' | 'sail';

type Voice = 'deep' | 'haze' | 'light' | 'song' | 'harp';
interface Note {
  voice: Voice; midi: number; at: number; duration: number; level: number; pan: number;
  role: 'melody' | 'harmony' | 'accompaniment';
  attack?: number;
}
interface Patch {
  attack: number; release: number; cutoff: number;
  /** Ratio, level and detune in cents. */
  partials: [number, number, number][];
  vibrato: number; rate: number;
  pluck?: boolean;
}

const PALETTE: Record<Voice, Patch> = {
  deep: { attack: 2.6, release: 3, cutoff: 520, partials: [[1, 1, 0], [2, .28, 0], [3, .08, 0]], vibrato: 0, rate: 0 },
  haze: { attack: 2.4, release: 3, cutoff: 1500, partials: [[1, .5, -4], [1, .5, 4], [2, .09, 0], [3, .025, 0]], vibrato: 0, rate: 0 },
  light: { attack: 1.3, release: 3, cutoff: 3800, partials: [[1, 1, 0], [2, .06, 0], [3, .014, 0]], vibrato: 2.2, rate: 4.3 },
  song: { attack: .45, release: 1.7, cutoff: 2600, partials: [[1, 1, 0], [2, .22, 0], [3, .09, 0], [4, .035, 0], [5, .012, 0]], vibrato: 4, rate: 4.8 },
  harp: { attack: .006, release: 0, cutoff: 3000, partials: [[1, 1, 0], [2, .38, 0], [3, .16, 0], [4, .07, 0], [5, .03, 0], [6, .012, 0]], vibrato: 0, rate: 0, pluck: true },
};

interface Chord { at: number; deep: number[]; haze: number[] }

function harmony(chords: Chord[], seconds: number, overlap: number, level: number, deepLevel: number, firstAttack?: number): Note[] {
  return chords.flatMap((c, index) => {
    // The first chord is where the loop comes back to, so the last one lasts until the section's end.
    const end = chords[index + 1]?.at ?? seconds;
    const duration = end - c.at + overlap;
    const attack = index === 0 ? firstAttack : undefined;
    return [
      ...c.deep.map((midi, i): Note => ({ voice: 'deep', midi, at: c.at + i * .05, duration, level: deepLevel, pan: 0, role: 'harmony', attack })),
      ...c.haze.map((midi, i): Note => ({ voice: 'haze', midi, at: c.at + .08 + i * .06, duration, level,
        pan: (i / Math.max(1, c.haze.length - 1) - .5) * .9, role: 'harmony', attack })),
    ];
  });
}

const line = (voice: Voice, notes: [number, number, number, number][], pan: number): Note[] =>
  notes.map(([at, midi, duration, level]) => ({ voice, midi, at, duration, level, pan, role: 'melody' }));

interface Section extends Phrase<Note> { chords: { at: number; tones: readonly number[] }[]; wet: number }

function section(seconds: number, loopFrom: number, chords: Chord[], notes: Note[], spare: Note[], wet: number): Section {
  const sorted = (list: Note[]) => [...list].sort((a, b) => a.at - b.at);
  const full = sorted(notes), sparse = sorted(spare);
  return { seconds, loopFrom, notes: full, variants: [full, sparse, full], wet,
    chords: chords.map(c => ({ at: c.at, tones: [...c.deep, ...c.haze] })) };
}

/** Out on top: three seconds of nothing, then D opens out under them, wide and high. */
const ABOVE_CHORDS: Chord[] = [
  { at: 3, deep: [38, 45], haze: [54, 64, 69, 76] },
  { at: 11, deep: [38], haze: [55, 66, 71, 73] },
  { at: 19, deep: [47], haze: [54, 64, 69, 74] },
  { at: 27, deep: [40], haze: [55, 62, 66, 71] },
];
const ABOVE_HARMONY = harmony(ABOVE_CHORDS, 35, 3.2, .0039, .0031, 5.5);
const ABOVE_MELODY = line('light', [
  [6.5, 74, 3.8, .0094], [9.5, 76, 3.4, .009], [12.5, 78, 4.4, .0094], [16.5, 85, 6.4, .0081],
  [24, 83, 3.4, .0081], [27.5, 79, 3.6, .0077], [31, 78, 4.8, .0072],
], -.08);
const ABOVE_SPARE = line('light', [[16.5, 85, 6.4, .0072], [24, 83, 3.4, .0068], [31, 78, 4.8, .0064]], -.08);

/** Over the cloud the bass walks up the scale, D to B, and comes home by G and A. */
const SAIL_CHORDS: Chord[] = [
  { at: 0, deep: [38], haze: [57, 62, 64, 66] },
  { at: 6, deep: [40], haze: [55, 59, 62, 66] },
  { at: 12, deep: [42], haze: [57, 62, 64, 69] },
  { at: 18, deep: [43], haze: [55, 59, 61, 66] },
  { at: 24, deep: [45], haze: [57, 61, 64, 71] },
  { at: 30, deep: [47], haze: [54, 57, 62, 64] },
  { at: 36, deep: [43], haze: [57, 59, 62, 66] },
  { at: 42, deep: [45], haze: [57, 62, 64, 69] },
];
const RIPPLES = [[57, 64, 69, 66], [59, 66, 71, 67], [57, 62, 69, 66], [59, 66, 73, 67], [57, 64, 71, 69], [59, 66, 69, 64], [59, 66, 69, 67], [57, 62, 69, 64]];
const RIPPLE_AT = [.05, 1.57, 3.04, 4.53];
const RIPPLE_LEVEL = [.0056, .0042, .0048, .0038];
const SAIL_RIPPLE = SAIL_CHORDS.flatMap((c, chord) => RIPPLES[chord].map((midi, i): Note => ({
  voice: 'harp', midi, at: c.at + RIPPLE_AT[i], duration: 2.8, level: RIPPLE_LEVEL[i],
  pan: (i % 2 ? .24 : -.24) * (chord % 2 ? -1 : 1), role: 'accompaniment',
})));
const SAIL_HARMONY = harmony(SAIL_CHORDS, 48, 2.6, .0042, .0044);
const SAIL_MELODY = line('song', [
  [6.75, 71, 2, .012], [8.75, 76, 3.2, .013],
  [12.75, 74, 2, .012], [14.75, 69, 3.2, .0115],
  [18.75, 74, 1.3, .0115], [20.1, 76, 1.3, .012], [21.5, 78, 2.6, .0125],
  [24.4, 83, 5.2, .0115],
  [30.75, 81, 2, .0115], [32.75, 78, 3.2, .012],
  [36.75, 76, 2, .0115], [38.75, 74, 3.2, .0115],
  [42.75, 76, 1.8, .011], [44.6, 69, 3.6, .0105],
], .06);
const SAIL_SPARE = line('song', [
  [18.75, 74, 1.3, .0105], [20.1, 76, 1.3, .011], [21.5, 78, 2.6, .0115], [24.4, 83, 5.2, .0105],
  [42.75, 76, 1.8, .01], [44.6, 69, 3.6, .0095],
], .06);

export const STAIRS_SECTIONS: Record<StairsScorePhase, Section> = {
  above: section(35, 3, ABOVE_CHORDS, [...ABOVE_HARMONY, ...ABOVE_MELODY], [...ABOVE_HARMONY, ...ABOVE_SPARE], .8),
  sail: section(48, 0, SAIL_CHORDS, [...SAIL_HARMONY, ...SAIL_RIPPLE, ...SAIL_MELODY], [...SAIL_HARMONY, ...SAIL_RIPPLE, ...SAIL_SPARE], .35),
};

/** The music of the room follows the air: nothing in the white, the bloom on top, the sail over it and into the fog. */
export function stairsScorePhase(air: StairsAir): StairsScorePhase | undefined {
  if (air.phase === 'above') return 'above';
  if (air.phase === 'sail' || air.phase === 'fog') return 'sail';
  return undefined;
}

interface Part {
  phase: StairsScorePhase;
  bus: GainNode;
  send: GainNode;
  epoch: number;
  cycle: number;
  next: number;
  stopped: boolean;
  voices: Set<OscillatorNode>;
}
const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);
const RISE = new Float32Array([0, .038, .146, .309, .5, .691, .854, .962, 1]);

export class StairsScore {
  private readonly bus: GainNode;
  private readonly send: GainNode;
  private readonly parts = new Set<Part>();
  private current: Part | null = null;
  private stopped = false;

  /** `wet` feeds the shared reverb beside the background's own send, so the cloud top can sound as big as it looks. */
  constructor(private readonly ctx: AudioContext, output: AudioNode, wet: AudioNode) {
    this.bus = ctx.createGain(); this.bus.gain.value = 0; this.bus.connect(output);
    this.send = ctx.createGain(); this.send.gain.value = 0; this.send.connect(wet);
  }

  chordAt(when: number): readonly number[] {
    const part = this.current, pattern = STAIRS_SECTIONS[part?.phase ?? 'above'];
    const time = part ? phrasePosition(pattern, part.epoch, when) : 0;
    let chord = pattern.chords[pattern.chords.length - 1].tones;
    for (const next of pattern.chords) { if (next.at > time) break; chord = next.tones; }
    return chord;
  }

  update(phase: StairsScorePhase, level: number, until = Infinity): void {
    if (this.stopped) return;
    const now = this.ctx.currentTime;
    this.bus.gain.setTargetAtTime(level, now, .8);
    this.send.gain.setTargetAtTime(level, now, .8);
    if (this.current?.phase !== phase) {
      if (this.current) this.release(this.current, tuning.audio.stairsPhaseFade);
      const bus = this.ctx.createGain(); bus.connect(this.bus);
      const send = this.ctx.createGain(); send.connect(this.send);
      bus.gain.setValueAtTime(0, now); bus.gain.linearRampToValueAtTime(1, now + 1);
      send.gain.setValueAtTime(0, now); send.gain.linearRampToValueAtTime(STAIRS_SECTIONS[phase].wet, now + 1);
      this.current = { phase, bus, send, epoch: now + .08, cycle: 0, next: 0, stopped: false, voices: new Set() };
      this.parts.add(this.current);
    }
    const part = this.current;
    schedulePhrase(part, STAIRS_SECTIONS[phase], now, (note, at) => this.play(part, note, at), until);
  }

  handoffAt(now: number): number {
    return this.current ? phraseHandoff(STAIRS_SECTIONS[this.current.phase], this.current.epoch, now) : now;
  }

  stop(fade = 1.8): void {
    if (this.stopped) return;
    this.stopped = true;
    for (const part of this.parts) this.release(part, fade);
    this.disconnectIfDone();
  }

  private release(part: Part, fade: number): void {
    if (part.stopped) return;
    part.stopped = true;
    const now = this.ctx.currentTime;
    for (const gain of [part.bus.gain, part.send.gain]) {
      gain.cancelAndHoldAtTime(now);
      gain.setValueAtTime(gain.value, now);
      gain.linearRampToValueAtTime(0, now + fade);
    }
    for (const voice of part.voices) voice.stop(now + fade);
    if (!part.voices.size) this.finish(part);
  }

  private finish(part: Part): void {
    part.bus.disconnect(); part.send.disconnect(); this.parts.delete(part); this.disconnectIfDone();
  }

  private disconnectIfDone(): void {
    if (this.stopped && !this.parts.size) { this.bus.disconnect(); this.send.disconnect(); }
  }

  private play(part: Part, note: Note, at: number): void {
    const ctx = this.ctx, patch = PALETTE[note.voice], end = at + note.duration;
    const pan = ctx.createStereoPanner(); pan.pan.value = note.pan;
    pan.connect(part.bus); pan.connect(part.send);
    const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.Q.value = .45;
    if (patch.pluck) {
      filter.frequency.setValueAtTime(patch.cutoff, at);
      filter.frequency.exponentialRampToValueAtTime(1100, at + .5);
    } else filter.frequency.value = patch.cutoff;
    filter.connect(pan);
    const env = ctx.createGain(); env.connect(filter);
    if (patch.pluck) {
      env.gain.value = note.level;
    } else {
      const attack = note.attack ?? patch.attack;
      env.gain.setValueAtTime(0, at);
      env.gain.setValueCurveAtTime(RISE.map(v => v * note.level), at, attack);
      env.gain.linearRampToValueAtTime(note.level * .84, Math.max(at + attack + .01, end - patch.release));
      env.gain.linearRampToValueAtTime(0, end);
    }
    const lfo = patch.vibrato ? ctx.createOscillator() : null, depth = lfo ? ctx.createGain() : null;
    if (lfo && depth) {
      lfo.frequency.value = patch.rate; depth.gain.value = patch.vibrato;
      lfo.connect(depth); lfo.start(at); lfo.stop(end + .02); part.voices.add(lfo);
    }
    let left = patch.partials.length;
    for (const [ratio, amplitude, detune] of patch.partials) {
      const osc = ctx.createOscillator(), gain = ctx.createGain();
      osc.frequency.value = hz(note.midi) * ratio; osc.detune.value = detune;
      depth?.connect(osc.detune);
      const stop = patch.pluck ? at + note.duration / Math.pow(ratio, .7) : end;
      if (patch.pluck) {
        gain.gain.setValueAtTime(0, at);
        gain.gain.linearRampToValueAtTime(amplitude, at + patch.attack);
        gain.gain.exponentialRampToValueAtTime(amplitude * .35, at + .25);
        gain.gain.exponentialRampToValueAtTime(.00001, stop - .03);
        gain.gain.linearRampToValueAtTime(0, stop);
      } else gain.gain.value = amplitude;
      osc.connect(gain).connect(env);
      part.voices.add(osc);
      osc.onended = () => {
        osc.disconnect(); gain.disconnect(); part.voices.delete(osc);
        if (--left === 0) {
          env.disconnect(); filter.disconnect(); pan.disconnect();
          if (lfo) { lfo.disconnect(); depth!.disconnect(); part.voices.delete(lfo); }
        }
        if (part.stopped && !part.voices.size) this.finish(part);
      };
      osc.start(at); osc.stop(stop + .015);
    }
  }
}
