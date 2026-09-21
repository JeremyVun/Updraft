import { JOURNEY_THEME, polishPhrase, phrasePosition, phraseHandoff, schedulePhrase, type Phrase } from './phrasing';
/** The approved sea revision, divided at its existing musical transitions for live story timing. */
export type SeaScorePhase = 'open' | 'swim' | 'return' | 'arrival';
type Voice = 'pad' | 'soft' | 'pluck';
interface Note { role?: 'melody' | 'accompaniment'; voice: Voice; midi: number; at: number; duration: number; level: number; pan: number }
const beds: [number, number, number[], number][] = [
  [0, 14, [45, 57, 64, 69], 0.0065],
  [12, 12, [43, 54, 59, 64], 0.0075],
  [24, 10, [50, 57, 64, 66], 0.008],
  [33, 13, [47, 54, 61, 66], 0.0045],
  [44, 9, [43, 54, 62, 66], 0.007],
  [53, 8, [50, 57, 64, 69], 0.006],
];
export const SEA_CHORDS = beds.map(([, , chord]) => chord);
/** Retain the audition's exact notes, strengths and envelopes; only section lengths follow the story. */
export const SEA_AUDITION_NOTES: readonly Note[] = [
  ...beds.flatMap(([at, duration, chord, level]) => chord.map((midi, i): Note => ({ voice: 'pad', midi,
    at: at + i * 0.035, duration, level: level * (i === 0 ? 0.85 : 1), pan: (i - 1.5) * 0.23 }))),
  ...[[8,69,3.5,0.0055], [14,71,3.5,0.006], [21,74,4,0.0065], [29,71,3.5,0.006],
    [49,69,4,0.005], [55,66,3,0.0045]].map(([at, midi, duration, level]): Note =>
      ({ voice: 'soft', midi, at, duration, level: level * 0.5, pan: 0.05 })),
  ...[[18.5,64], [26.5,66], [51.5,64]].map(([at, midi]): Note =>
    ({ role: 'accompaniment', voice: 'pluck', midi, at, duration: 3, level: 0.004, pan: -0.18 })),
].sort((a, b) => a.at - b.at);

interface Section extends Phrase<Note> { chords: [number, number][] }
const section = (from: number, to: number, seconds: number): Section => polishPhrase({ seconds,
  notes: SEA_AUDITION_NOTES.filter(n => n.at >= from && n.at < to).map(n => ({ ...n, at: n.at - from })),
  chords: beds.flatMap(([at], index) => at >= from && at < to ? [[at - from, index] as [number, number]] : []),
}, from === 0 ? { melody: JOURNEY_THEME.map((midi, i): Note => ({ voice: 'soft', midi,
  at: [8,14,21,29][i], duration: 3.5, level: [.00275,.003,.00325,.003][i], pan: .05,
})) } : {});
export const SEA_SECTIONS: Record<SeaScorePhase, Section> = {
  open: section(0, 33, 36),
  swim: section(33, 44, 13),
  return: section(44, Infinity, 18),
  arrival: { seconds: 9, notes: SEA_AUDITION_NOTES.filter(n => n.voice === 'pad' && n.at >= 53)
    .map(n => ({ ...n, at: n.at - 53 })), chords: [[0, 5]] },
};

interface Part {
  phase: SeaScorePhase;
  bus: GainNode;
  epoch: number;
  cycle: number;
  next: number;
  stopped: boolean;
  voices: Set<OscillatorNode>;
}
const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

export class SeaScore {
  private readonly bus: GainNode;
  private readonly parts = new Set<Part>();
  private current: Part | null = null;
  private stopped = false;

  constructor(private readonly ctx: AudioContext, output: AudioNode) {
    this.bus = ctx.createGain(); this.bus.gain.value = 0; this.bus.connect(output);
  }

  update(phase: SeaScorePhase, level: number, until = Infinity): void {
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
    const part = this.current, pattern = SEA_SECTIONS[phase];
    // Suspension freezes audio time. A stalled game frame skips missed notes instead of bunching them up.
    schedulePhrase(part, pattern, now, (note, at) => this.play(part, note, at), until);
  }

  chordAt(now: number): number {
    if (!this.current) return 0;
    const pattern = SEA_SECTIONS[this.current.phase];
    const time = phrasePosition(pattern, this.current.epoch, now);
    for (let i = pattern.chords.length - 1; i >= 0; i--) if (pattern.chords[i][0] <= time) return pattern.chords[i][1];
    return pattern.chords[0][1];
  }

  handoffAt(now: number): number {
    return this.current ? phraseHandoff(SEA_SECTIONS[this.current.phase], this.current.epoch, now) : now;
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
