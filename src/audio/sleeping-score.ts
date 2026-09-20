import type { AudioOut } from '../creatures/voices';
import type { PianoStrings } from './audio';

/** Approved Sleeping study, with player-paced rests rather than a timed soundtrack. */
export type SleepingScorePhase = 'shelter' | 'cold' | 'climb' | 'summit' | 'morning';
type Note = { voice: 'pad'; at: number; midi: number; duration: number; level: number; pan: number }
  | { voice: 'piano'; at: number; midi: number; velocity: number };
const beds: [number, number, number[], number][] = [
  [0, 9.5, [50,57,64,69], .0055], [10, 5, [43,55,62,69], .0042],
  [36, 8, [50,57,62,65], .0032], [45, 5, [46,53,57,62], .0028],
  [75, 8, [50,57,62,66], .005], [83, 8, [43,54,59,62], .0055],
  [92, 8, [50,57,64,66], .0055], [101, 3.5, [50,57,62,64], .0045],
];
export const SLEEPING_AUDITION_NOTES: readonly Note[] = [
  ...beds.flatMap(([at, duration, chord, level]) => chord.map((midi, i): Note => ({ voice: 'pad',
    at: at + i * .035, midi, duration, level: level * (i === 0 ? .85 : 1), pan: (i - 1.5) * .23 }))),
  ...[[2.5,69,.29], [6,64,.25], [10.5,62,.27], [14,57,.22],
    [38,65,.22], [42,64,.22], [47,62,.22], [50,57,.22],
    [89,69,.3], [92,64,.3], [94.5,66,.3], [98,62,.3], [102,64,.3], [104,62,.3]]
    .map(([at, midi, velocity]): Note => ({ voice: 'piano', at, midi, velocity })),
].sort((a, b) => a.at - b.at);

interface Section { seconds: number; notes: readonly Note[] }
const section = (from: number, to: number, seconds: number): Section => ({ seconds,
  notes: SLEEPING_AUDITION_NOTES.filter(n => n.at >= from && n.at < to).map(n => ({ ...n, at: n.at - from })),
});
export const SLEEPING_SECTIONS: Record<SleepingScorePhase, Section> = {
  shelter: section(0, 18, 32),
  cold: { seconds: 1, notes: [] },
  climb: section(36, 54, 32),
  summit: { seconds: 1, notes: [] },
  // The flight cue has five seconds alone. The piano answer waits nineteen seconds after commitment.
  morning: section(70, Infinity, 48),
};

interface Part {
  phase: SleepingScorePhase;
  out: AudioOut & { bus: GainNode; reverb: GainNode };
  piano: PianoStrings;
  epoch: number;
  cycle: number;
  next: number;
  stopped: boolean;
  voices: Set<AudioScheduledSourceNode>;
}

export class SleepingScore {
  private readonly output: AudioOut & { bus: GainNode; reverb: GainNode };
  private readonly parts = new Set<Part>();
  private current: Part | null = null;
  private stopped = false;

  constructor(out: AudioOut, private readonly makePiano: (out: AudioOut) => PianoStrings) {
    this.output = this.gates(out, 0);
  }

  private gates(out: AudioOut, level: number): AudioOut & { bus: GainNode; reverb: GainNode } {
    const bus = out.ctx.createGain(), reverb = out.ctx.createGain();
    bus.gain.value = reverb.gain.value = level;
    bus.connect(out.bus); reverb.connect(out.reverb);
    return { ctx: out.ctx, bus, reverb };
  }

  update(phase: SleepingScorePhase, level: number): void {
    if (this.stopped) return;
    const now = this.output.ctx.currentTime;
    for (const gain of [this.output.bus, this.output.reverb]) gain.gain.setTargetAtTime(level, now, .8);
    if (this.current?.phase !== phase) {
      if (this.current) this.release(this.current, 1.8);
      const out = this.gates(this.output, 1);
      this.current = { phase, out, piano: this.makePiano(out), epoch: now + .08, cycle: 0, next: 0,
        stopped: false, voices: new Set() };
      this.parts.add(this.current);
    }
    const part = this.current, pattern = SLEEPING_SECTIONS[phase];
    if (!pattern.notes.length) return;
    // Audio suspension freezes this clock. Slow frames skip missed attacks, never bunch them together.
    const cycle = Math.floor(Math.max(0, now - part.epoch) / pattern.seconds);
    if (cycle > part.cycle) { part.cycle = cycle; part.next = 0; }
    for (;;) {
      const note = pattern.notes[part.next], at = part.epoch + part.cycle * pattern.seconds + note.at;
      if (at > now + .25) break;
      if (at >= now - .04) this.play(part, note, Math.max(now + .008, at));
      if (++part.next === pattern.notes.length) { part.next = 0; part.cycle++; }
    }
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
    const now = this.output.ctx.currentTime;
    for (const gain of [part.out.bus, part.out.reverb]) {
      gain.gain.cancelAndHoldAtTime(now);
      gain.gain.linearRampToValueAtTime(0, now + fade);
    }
    for (const source of part.voices) source.stop(now + fade);
    if (!part.voices.size) this.finish(part);
  }

  private track(part: Part, source: AudioScheduledSourceNode): void {
    part.voices.add(source);
    source.addEventListener('ended', () => {
      part.voices.delete(source);
      if (part.stopped && !part.voices.size) this.finish(part);
    }, { once: true });
  }

  private finish(part: Part): void {
    part.out.bus.disconnect(); part.out.reverb.disconnect(); this.parts.delete(part); this.disconnectIfDone();
  }

  private disconnectIfDone(): void {
    if (this.stopped && !this.parts.size) { this.output.bus.disconnect(); this.output.reverb.disconnect(); }
  }

  private play(part: Part, note: Note, at: number): void {
    if (note.voice === 'piano') {
      for (const source of part.piano.note(note.midi, note.velocity, 0, .32, at)) this.track(part, source);
      return;
    }
    const ctx = this.output.ctx;
    const pan = ctx.createStereoPanner(); pan.pan.value = note.pan;
    pan.connect(part.out.bus);
    const send = ctx.createGain(); send.gain.value = .9; pan.connect(send).connect(part.out.reverb);
    const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.Q.value = .35;
    filter.frequency.value = 1000; filter.connect(pan);
    const envelope = ctx.createGain(); envelope.gain.value = 0; envelope.connect(filter);
    envelope.gain.setValueAtTime(0, at);
    envelope.gain.linearRampToValueAtTime(note.level, at + 1.8);
    envelope.gain.setValueAtTime(note.level, at + note.duration);
    envelope.gain.exponentialRampToValueAtTime(.00001, at + note.duration + 2.4);
    let remaining = 2;
    for (const [amplitude, type, detune] of [[.65, 'triangle', -3], [.35, 'sine', 3]] as const) {
      const osc = ctx.createOscillator(), gain = ctx.createGain();
      osc.type = type; osc.frequency.value = 440 * 2 ** ((note.midi - 69) / 12); osc.detune.value = detune;
      gain.gain.value = amplitude; osc.connect(gain).connect(envelope);
      osc.onended = () => {
        osc.disconnect(); gain.disconnect();
        if (--remaining === 0) { envelope.disconnect(); filter.disconnect(); pan.disconnect(); send.disconnect(); }
      };
      this.track(part, osc); osc.start(at); osc.stop(at + note.duration + 2.5);
    }
  }
}
