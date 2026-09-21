import { polishPhrase, phrasePosition, phraseHandoff, schedulePhrase, type Phrase } from './phrasing';
/** Approved Meadow background: the walk after the piano, migration, paddle and onward companionship. */
export type MeadowScorePhase = 'walk' | 'flock' | 'pond' | 'return';
type Voice = 'pad' | 'soft' | 'pluck';
interface Note { voice: Voice; midi: number; at: number; duration: number; level: number; pan: number }
const beds: [number, number, number[], number][] = [
  [0, 9, [50,57,64,66], .006], [10, 9, [47,54,62,66], .0062],
  [20, 7, [43,50,59,64], .0045], [29, 7, [45,52,59,64], .0028],
  [37, 7, [47,54,62,66], .0028], [45, 8, [43,54,59,62], .0032],
  [54, 9, [50,57,64,66], .0058], [64, 5, [45,52,59,64], .0048],
];
/** Exact notes and instrument strengths from the approved 72-second listening study. */
export const MEADOW_AUDITION_NOTES: readonly Note[] = [
  ...beds.flatMap(([at, duration, chord, level]) => chord.map((midi, i): Note => ({ voice: 'pad', midi,
    at: at + i * .035, duration, level: level * (i === 0 ? .85 : 1), pan: (i - 1.5) * .23 }))),
  ...[[2,62,2.1,.0042], [5,64,1.8,.0038], [7.5,66,2.4,.0043], [11,71,2.8,.004],
    [16,69,2,.0036], [19,66,2.2,.0037], [57,66,2.3,.0035], [61,64,2,.0032], [65,62,3,.0035]]
    .map(([at, midi, duration, level]): Note => ({ voice: 'soft', at, midi, duration, level, pan: .08 })),
  ...[[1.25,57,.008], [7.25,62,.007], [13.75,59,.0075], [18.25,66,.0065],
    [55.5,62,.007], [60,57,.0065], [66.5,64,.006]]
    .map(([at, midi, level]): Note => ({ voice: 'pluck', at, midi, duration: 2.7, level, pan: -.22 })),
].sort((a, b) => a.at - b.at);

interface Section extends Phrase<Note> { chords: { at: number; tones: readonly number[] }[] }
const section = (from: number, to: number, seconds: number): Section => polishPhrase({ seconds,
  notes: MEADOW_AUDITION_NOTES.filter(n => n.at >= from && n.at < to).map(n => ({ ...n, at: n.at - from })),
  chords: beds.filter(([at]) => at >= from && at < to).map(([at, , tones]) => ({ at: at - from, tones })),
}, { loopFrom: from === 50 ? 4 : 0 });
export const MEADOW_SECTIONS: Record<MeadowScorePhase, Section> = {
  walk: section(0, 20, 24),
  flock: section(20, 37, 18),
  pond: section(37, 50, 18),
  // The pond's existing completion phrase has the foreground before harmony and melody return.
  return: section(50, Infinity, 24),
};

interface Part {
  phase: MeadowScorePhase;
  bus: GainNode;
  epoch: number;
  cycle: number;
  next: number;
  stopped: boolean;
  voices: Set<OscillatorNode>;
}
const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

export class MeadowScore {
  private readonly bus: GainNode;
  private readonly parts = new Set<Part>();
  private current: Part | null = null;
  private stopped = false;

  constructor(private readonly ctx: AudioContext, output: AudioNode) {
    this.bus = ctx.createGain(); this.bus.gain.value = 0; this.bus.connect(output);
  }

  chordAt(when: number): readonly number[] {
    const part = this.current, pattern = MEADOW_SECTIONS[part?.phase ?? 'walk'];
    const time = part ? phrasePosition(pattern, part.epoch, when) : 0;
    let tones = pattern.chords[0].tones;
    for (const chord of pattern.chords) { if (chord.at > time) break; tones = chord.tones; }
    return tones;
  }

  update(phase: MeadowScorePhase, level: number, until = Infinity): void {
    if (this.stopped) return;
    const now = this.ctx.currentTime;
    this.bus.gain.setTargetAtTime(level, now, 0.8);
    if (this.current?.phase !== phase) {
      if (this.current) this.release(this.current);
      const bus = this.ctx.createGain(); bus.gain.value = 0; bus.connect(this.bus);
      bus.gain.setTargetAtTime(1, now, 0.8);
      this.current = { phase, bus, epoch: now + 0.08, cycle: 0, next: 0, stopped: false, voices: new Set() };
      this.parts.add(this.current);
    }
    const part = this.current, pattern = MEADOW_SECTIONS[phase];
    // Suspension freezes audio time. A stalled game frame skips missed notes instead of bunching them up.
    schedulePhrase(part, pattern, now, (note, at) => this.play(part, note, at), until);
  }

  handoffAt(now: number): number {
    return this.current ? phraseHandoff(MEADOW_SECTIONS[this.current.phase], this.current.epoch, now) : now;
  }

  stop(fade = 1.8): void {
    if (this.stopped) return;
    this.stopped = true;
    for (const part of this.parts) this.release(part, fade);
    this.disconnectIfDone();
  }

  private release(part: Part, fade = 1.8): void {
    if (part.stopped) return;
    part.stopped = true;
    const now = this.ctx.currentTime;
    part.bus.gain.cancelAndHoldAtTime(now);
    part.bus.gain.setValueAtTime(part.bus.gain.value, now);
    part.bus.gain.linearRampToValueAtTime(0, now + fade);
    for (const voice of part.voices) voice.stop(now + fade);
    if (!part.voices.size) this.finish(part);
  }

  private finish(part: Part): void {
    part.bus.disconnect(); this.parts.delete(part); this.disconnectIfDone();
  }

  private disconnectIfDone(): void {
    if (this.stopped && !this.parts.size) this.bus.disconnect();
  }

  private play(part: Part, note: Note, at: number): void {
    const ctx = this.ctx, pluck = note.voice === 'pluck', pad = note.voice === 'pad';
    const pan = ctx.createStereoPanner(); pan.pan.value = note.pan; pan.connect(part.bus);
    const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.Q.value = pluck ? 0.45 : 0.35;
    filter.frequency.setValueAtTime(pluck ? 3200 : pad ? 1000 : 1600, at);
    if (pluck) filter.frequency.exponentialRampToValueAtTime(900, at + 0.35);
    filter.connect(pan);
    const release = pad ? 2.4 : 2.2;
    const envelope = pluck ? null : ctx.createGain();
    if (envelope) {
      envelope.gain.setValueAtTime(0, at);
      envelope.gain.linearRampToValueAtTime(note.level, at + (pad ? 1.8 : 1.4));
      envelope.gain.setValueAtTime(note.level, at + note.duration);
      envelope.gain.exponentialRampToValueAtTime(0.00001, at + note.duration + release);
      envelope.connect(filter);
    }
    const partials: [number, number, OscillatorType, number][] = pluck
      ? [[1, 1, 'sine', 0], [2, 0.24, 'sine', 0], [3, 0.07, 'sine', 0], [4.015, 0.025, 'sine', 0]]
      : pad ? [[1, 0.65, 'triangle', -3], [1, 0.35, 'sine', 3]]
      : [[1, 1, 'sine', 0], [2, 0.08, 'sine', 0], [3, 0.014, 'sine', 0]];
    let remaining = partials.length;
    for (const [ratio, amplitude, type, detune] of partials) {
      const osc = ctx.createOscillator(), gain = ctx.createGain();
      osc.type = type; osc.frequency.value = hz(note.midi) * ratio; osc.detune.value = detune;
      if (pluck) {
        gain.gain.setValueAtTime(0, at);
        gain.gain.linearRampToValueAtTime(note.level * amplitude, at + 0.009);
        gain.gain.exponentialRampToValueAtTime(Math.max(0.00002, note.level * amplitude * 0.35), at + 0.12);
        gain.gain.exponentialRampToValueAtTime(0.00001, at + note.duration / Math.sqrt(ratio));
      } else gain.gain.value = amplitude;
      osc.connect(gain).connect(envelope ?? filter);
      part.voices.add(osc);
      osc.onended = () => {
        osc.disconnect(); gain.disconnect(); part.voices.delete(osc);
        if (--remaining === 0) { envelope?.disconnect(); filter.disconnect(); pan.disconnect(); }
        if (part.stopped && !part.voices.size) this.finish(part);
      };
      osc.start(at); osc.stop(at + note.duration + (pluck ? 0.05 : release + 0.1));
    }
  }
}
