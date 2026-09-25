import { JOURNEY_THEME, isMelody, polishPhrase, phrasePosition, phraseHandoff, schedulePhrase, type Phrase } from './phrasing';
/** The approved Lines study, divided by the three curtains, family clothes, doorway and far shore. */
export type LinesScorePhase = 'first' | 'second' | 'third' | 'family' | 'door' | 'shore';
interface Note { voice: 'pad' | 'soft-reed'; midi: number; at: number; duration: number; level: number; pan: number }
const beds: [number, number, number[], number][] = [
  [0,7,[50,57,64],.005], [8,7,[47,54,62,66],.0045],
  [16,5,[43,55,62,67],.004], [22,6,[50,57,62,66],.0048],
  [29,4,[45,57,61,64],.0038], [34,7,[47,54,62,66],.0046],
  [42,4,[43,55,62,67],.004], [47,6,[43,55,59,62],.0058],
  [54,7,[50,57,62,66],.003], [63,6,[50,57,62,66],.0048],
];
const reed = ([at, midi, duration, level]: number[]): Note => ({ voice: 'soft-reed', at, midi, duration, level, pan: -.1 });
/** Preserve the audition exactly here; the independent melody trim is applied at playback. */
export const LINES_AUDITION_NOTES: readonly Note[] = [
  ...beds.flatMap(([at, duration, chord, level]) => chord.map((midi, i): Note => ({ voice: 'pad', midi,
    at: at + i * .035, duration, level: level * (i === 0 ? .85 : 1), pan: (i - (chord.length - 1) / 2) * .23 }))),
  ...[[2,69,1.6,.012], [4,66,1.15,.011], [5.4,64,1.8,.010],
    [9,66,1.15,.011], [10.5,62,1.3,.010],
    [22,66,1.15,.012], [23.4,69,1.15,.011], [24.8,74,1.15,.010],
    [34,71,1.3,.011], [35.6,69,1,.010], [36.8,66,1.05,.010],
    [47.4,67,1.2,.012], [48.9,71,1.25,.011], [50.4,69,1,.010], [51.7,67,1.25,.010],
    [64,69,1.25,.010], [65.6,66,1.15,.0095], [67,64,1.1,.009], [68.4,62,1.8,.009]]
    .map(reed),
].sort((a, b) => a.at - b.at);
/** Each curtain's figure gets a reply over its second chord, so it is not left hanging for the rest of the loop. */
const answers: Partial<Record<LinesScorePhase, number[][]>> = {
  first: [[17,71,1.15,.010], [18.4,69,1.15,.0095], [19.8,67,1.6,.009]],
  second: [[8,73,1.15,.010], [9.4,71,1.15,.0095], [10.8,69,1.6,.009]],
  third: [[9,67,1.15,.010], [10.4,69,1.15,.0095], [11.8,71,1.6,.009]],
  family: [[10,74,1.2,.010], [11.5,71,1.25,.0095], [13,69,1,.009], [14.3,67,1.6,.009]],
};
/** Melody attacks further apart than this belong to separate figures. */
const FIGURE_GAP = 1.5;

interface Section extends Phrase<Note> { chords: { at: number; tones: readonly number[] }[] }
const section = (phase: LinesScorePhase, from: number, to: number, seconds: number): Section => {
  const answer = (answers[phase] ?? []).map(reed);
  const polished = polishPhrase<Note, Section>({ seconds,
    notes: [...LINES_AUDITION_NOTES.filter(n => n.at >= from && n.at < to).map(n => ({ ...n, at: n.at - from })), ...answer]
      .sort((a, b) => a.at - b.at),
    chords: beds.filter(([at]) => at >= from && at < to).map(([at, , tones]) => ({ at: at - from, tones })),
  }, from === 0 ? { to: 8, melody: JOURNEY_THEME.slice(0, 3).map((midi, i): Note => ({
    voice: 'soft-reed', midi, at: [2, 4, 5.4][i], duration: 1.3, level: [0.011, 0.01, 0.009][i], pan: -.1,
  })) } : {});
  // The quieter verse rests the reply whole; dropping single notes left holes inside the figures.
  const rested = polished.notes.filter(n => !isMelody(n) || !answer.some(a => a.at === n.at && a.midi === n.midi));
  return { ...polished, variants: [polished.notes, rested, polished.variants?.[2] ?? polished.notes] };
};
export const LINES_SECTIONS: Record<LinesScorePhase, Section> = {
  first: section('first',0,22,26), second: section('second',22,34,18), third: section('third',34,47,18),
  family: section('family',47,54,18), door: section('door',54,63,12), shore: section('shore',63,Infinity,16),
};
interface Part {
  phase: LinesScorePhase; bus: GainNode; melody: GainNode; epoch: number; cycle: number; next: number;
  stopped: boolean; voices: Set<OscillatorNode>; melodyEnd: number; resting: boolean;
}
const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

export class LinesScore {
  private readonly bus: GainNode;
  private readonly parts = new Set<Part>();
  private current: Part | null = null;
  private stopped = false;

  constructor(private readonly ctx: AudioContext, output: AudioNode) {
    this.bus = ctx.createGain(); this.bus.gain.value = 0; this.bus.connect(output);
  }

  chordAt(when: number): readonly number[] {
    const part = this.current, pattern = LINES_SECTIONS[part?.phase ?? 'first'];
    const time = part ? phrasePosition(pattern, part.epoch, when) : 0;
    let chord = pattern.chords[0].tones;
    for (const next of pattern.chords) { if (next.at > time) break; chord = next.tones; }
    return chord;
  }

  update(phase: LinesScorePhase, level: number, melodyLevel: number, quiet = false, until = Infinity): void {
    if (this.stopped) return;
    const now = this.ctx.currentTime;
    this.bus.gain.setTargetAtTime(level, now, .8);
    if (this.current?.phase !== phase) {
      if (this.current) this.release(this.current);
      const bus = this.ctx.createGain(); bus.gain.value = 0; bus.connect(this.bus);
      bus.gain.setTargetAtTime(1, now, .8);
      const melody = this.ctx.createGain(); melody.gain.value = quiet ? 0 : melodyLevel; melody.connect(bus);
      this.current = { phase, bus, melody, epoch: now + .08, cycle: 0, next: 0, stopped: false, voices: new Set(),
        melodyEnd: -Infinity, resting: quiet };
      this.parts.add(this.current);
    }
    // Cue space lets a sounding figure finish, then quiets it, including a retiring phrase's lookahead notes.
    for (const part of this.parts) {
      const clear = quiet && now >= part.melodyEnd;
      part.melody.gain.setTargetAtTime(clear ? 0 : melodyLevel, now, clear ? .06 : .5);
    }
    const part = this.current, pattern = LINES_SECTIONS[phase];
    schedulePhrase(part, pattern, now, (note, at) => {
      if (note.voice === 'soft-reed') {
        if (at > part.melodyEnd + FIGURE_GAP) part.resting = quiet;
        if (part.resting) return;
        part.melodyEnd = Math.max(part.melodyEnd, at + note.duration);
      }
      this.play(part, note, at);
    }, until);
  }

  handoffAt(now: number): number {
    return this.current ? phraseHandoff(LINES_SECTIONS[this.current.phase], this.current.epoch, now) : now;
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
    part.melody.disconnect(); part.bus.disconnect(); this.parts.delete(part); this.disconnectIfDone();
  }
  private disconnectIfDone(): void { if (this.stopped && !this.parts.size) this.bus.disconnect(); }

  private play(part: Part, note: Note, at: number): void {
    const ctx = this.ctx, pad = note.voice === 'pad', end = at + note.duration;
    const pan = ctx.createStereoPanner(); pan.pan.value = note.pan; pan.connect(pad ? part.bus : part.melody);
    const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.Q.value = .35;
    filter.frequency.value = pad ? 1000 : 1800; filter.connect(pan);
    const env = ctx.createGain(); env.connect(filter);
    env.gain.setValueAtTime(0, at);
    env.gain.linearRampToValueAtTime(note.level, at + (pad ? 1.8 : .16));
    if (pad) {
      env.gain.setValueAtTime(note.level, end);
      env.gain.exponentialRampToValueAtTime(.00001, end + 2.4);
    } else {
      env.gain.linearRampToValueAtTime(note.level * .8, at + note.duration * .55);
      env.gain.setValueAtTime(note.level * .8, end - .3);
      env.gain.linearRampToValueAtTime(0, end);
    }
    const partials: [number, number, OscillatorType, number][] = pad
      ? [[1,.65,'triangle',-3], [1,.35,'sine',3]]
      : [[1,1,'sine',0], [2,.035,'sine',0], [3,.17,'sine',0], [5,.035,'sine',0]];
    let remaining = partials.length;
    for (const [ratio, amplitude, type, detune] of partials) {
      const osc = ctx.createOscillator(), gain = ctx.createGain();
      osc.type = type; osc.frequency.value = hz(note.midi) * ratio; osc.detune.value = detune;
      gain.gain.value = amplitude; osc.connect(gain).connect(env); part.voices.add(osc);
      osc.onended = () => {
        osc.disconnect(); gain.disconnect(); part.voices.delete(osc);
        if (--remaining === 0) { env.disconnect(); filter.disconnect(); pan.disconnect(); }
        if (part.stopped && !part.voices.size) this.finish(part);
      };
      osc.start(at); osc.stop(end + (pad ? 2.5 : .01));
    }
  }
}
