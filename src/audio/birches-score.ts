import { JOURNEY_ANSWER, polishPhrase, phrasePosition, phraseHandoff, schedulePhrase, type Phrase } from './phrasing';
/** The approved Birches revision: autumn walk, optional swing, scarf work and the far beach. */
export type BirchesScorePhase = 'walk' | 'swing' | 'scarf' | 'return';
type Voice = 'pad' | 'muted-string';
interface Note { voice: Voice; midi: number; at: number; duration: number; level: number; pan: number; role?: 'melody' | 'accompaniment' }
const beds: [number, number, number[], number][] = [
  [0,8,[50,57,62,66],.006], [9,7,[48,55,60,64],.0055],
  [18,7,[47,55,62,67],.006], [26,7,[45,52,57,60],.0056],
  [35,8,[50,57,62,66],.0035], [45,7,[48,55,60,64],.0034],
  [54,7,[47,55,62,67],.0032], [63,7,[45,52,57,60],.003],
  [73,5,[47,55,62,67],.0048], [79,3,[45,52,57,60],.0042],
];
/** Exact pitches, articulation and strengths from the approved 84-second revision. */
export const BIRCHES_AUDITION_NOTES: readonly Note[] = [
  ...beds.flatMap(([at, duration, chord, level]) => chord.map((midi, i): Note => ({ voice: 'pad', midi,
    at: at + i * .035, duration, level: level * (i === 0 ? .85 : 1), pan: (i - 1.5) * .23 }))),
  ...[[2,69,.011,2.9], [4.5,66,.010,2.7], [7,62,.009,2.6],
    [9.5,64,.009,1.5], [10.625,62,.0065,.85], [11.75,60,.0085,1.8],
    [19.5,59,.009,2.6], [22,62,.010,2.7], [24.5,67,.011,2.8],
    [27,64,.009,2.7], [29.5,60,.0085,2.7], [32,57,.008,3.4],
    [75,62,.008,2.7], [77.5,59,.0075,2.8], [80,57,.007,3.2]]
    .map(([at, midi, level, duration]): Note => ({ voice: 'muted-string', role: 'melody', at, midi, level, duration, pan: .08 })),
  ...[[.7,50,.0055], [6,57,.0038], [18.5,47,.005], [27,45,.0048],
    [37,50,.0032], [48,55,.0028], [60,55,.0027], [74,47,.004]]
    .map(([at, midi, level]): Note => ({ voice: 'muted-string', role: 'accompaniment', at, midi, level, duration: 3.8, pan: -.2 })),
].sort((a, b) => a.at - b.at);

interface Section extends Phrase<Note> { chords: { at: number; tones: readonly number[] }[] }
const section = (from: number, to: number, seconds: number): Section => polishPhrase({ seconds,
  notes: BIRCHES_AUDITION_NOTES.filter(n => n.at >= from && n.at < to).map(n => ({ ...n, at: n.at - from })),
  chords: beds.filter(([at]) => at >= from && at < to).map(([at, , tones]) => ({ at: at - from, tones })),
}, from === 0 ? { to: 9, melody: JOURNEY_ANSWER.slice(0, 4).map((midi, i): Note => ({
  voice: 'muted-string', midi, at: [2, 4.5, 6, 7.5][i], duration: 1.3, level: [0.009, 0.009, 0.008, 0.008][i], pan: -.1,
})) } : {});
export const BIRCHES_SECTIONS: Record<BirchesScorePhase, Section> = {
  walk: section(0, 18, 22),
  swing: section(18, 35, 22),
  scarf: section(35, 73, 40),
  return: section(73, Infinity, 18),
};
interface Part {
  phase: BirchesScorePhase;
  bus: GainNode;
  epoch: number;
  cycle: number;
  next: number;
  stopped: boolean;
  voices: Set<OscillatorNode>;
}
const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

export class BirchesScore {
  private readonly bus: GainNode;
  private readonly parts = new Set<Part>();
  private current: Part | null = null;
  private stopped = false;

  constructor(private readonly ctx: AudioContext, output: AudioNode) {
    this.bus = ctx.createGain(); this.bus.gain.value = 0; this.bus.connect(output);
  }

  /** Gesture harmony follows this section; the shared pad's transition clock remains independent. */
  chordAt(when: number): readonly number[] {
    const part = this.current, pattern = BIRCHES_SECTIONS[part?.phase ?? 'walk'];
    const time = part ? phrasePosition(pattern, part.epoch, when) : 0;
    let chord = pattern.chords[0].tones;
    for (const next of pattern.chords) { if (next.at > time) break; chord = next.tones; }
    return chord;
  }

  update(phase: BirchesScorePhase, level: number, until = Infinity): void {
    if (this.stopped) return;
    const now = this.ctx.currentTime;
    this.bus.gain.setTargetAtTime(level, now, .8);
    if (this.current?.phase !== phase) {
      if (this.current) this.release(this.current);
      const bus = this.ctx.createGain(); bus.gain.value = 0; bus.connect(this.bus);
      bus.gain.setTargetAtTime(1, now, .8);
      this.current = { phase, bus, epoch: now + .08, cycle: 0, next: 0, stopped: false, voices: new Set() };
      this.parts.add(this.current);
    }
    const part = this.current, pattern = BIRCHES_SECTIONS[phase];
    // Audio suspension freezes the phrase; missed frames skip old attacks instead of playing a burst.
    schedulePhrase(part, pattern, now, (note, at) => this.play(part, note, at), until);
  }

  handoffAt(now: number): number {
    return this.current ? phraseHandoff(BIRCHES_SECTIONS[this.current.phase], this.current.epoch, now) : now;
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
    const ctx = this.ctx, pad = note.voice === 'pad';
    const pan = ctx.createStereoPanner(); pan.pan.value = note.pan; pan.connect(part.bus);
    const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.Q.value = pad ? .35 : .4;
    filter.frequency.setValueAtTime(pad ? 1000 : 2400, at);
    if (!pad) filter.frequency.exponentialRampToValueAtTime(850, at + .55);
    filter.connect(pan);
    const envelope = pad ? ctx.createGain() : null;
    if (envelope) {
      envelope.gain.setValueAtTime(0, at);
      envelope.gain.linearRampToValueAtTime(note.level, at + 1.8);
      envelope.gain.setValueAtTime(note.level, at + note.duration);
      envelope.gain.exponentialRampToValueAtTime(.00001, at + note.duration + 2.4);
      envelope.connect(filter);
    }
    const partials: [number, number, OscillatorType, number][] = pad
      ? [[1,.65,'triangle',-3], [1,.35,'sine',3]]
      : [[1,1,'sine',0], [2,.32,'sine',0], [3,.14,'sine',0], [4,.055,'sine',0], [5,.025,'sine',0], [6,.012,'sine',0]];
    let remaining = partials.length;
    for (const [ratio, amplitude, type, detune] of partials) {
      const osc = ctx.createOscillator(), gain = ctx.createGain();
      osc.type = type; osc.frequency.value = hz(note.midi) * ratio; osc.detune.value = detune;
      const end = at + note.duration / Math.sqrt(ratio);
      if (pad) gain.gain.value = amplitude;
      else {
        gain.gain.setValueAtTime(0, at);
        gain.gain.linearRampToValueAtTime(note.level * amplitude, at + .018);
        gain.gain.exponentialRampToValueAtTime(note.level * amplitude * .42, at + .22);
        gain.gain.exponentialRampToValueAtTime(.000001, end - .04);
        gain.gain.linearRampToValueAtTime(0, end);
      }
      osc.connect(gain).connect(envelope ?? filter);
      part.voices.add(osc);
      osc.onended = () => {
        osc.disconnect(); gain.disconnect(); part.voices.delete(osc);
        if (--remaining === 0) { envelope?.disconnect(); filter.disconnect(); pan.disconnect(); }
        if (part.stopped && !part.voices.size) this.finish(part);
      };
      osc.start(at); osc.stop(pad ? at + note.duration + 2.5 : end + .01);
    }
  }
}
