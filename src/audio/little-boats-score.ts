import { JOURNEY_THEME, polishPhrase, phraseHandoff, schedulePhrase } from './phrasing';
/** The 36-second composition Jeremy approved in the September 20 listening preview. */
export const BOATS_PHRASE_SECONDS = 36;
export const BOATS_CHORDS = [
  [50, 57, 64, 66], [43, 54, 59, 62], [47, 54, 62, 66], [45, 52, 62, 64],
  [50, 57, 64, 71], [43, 54, 59, 64], [45, 52, 61, 67], [50, 57, 62, 66],
];
const phrases = [
  [[0.75,66],[1.5,69],[2.25,71],[3,69]],
  [[0.75,67],[1.5,66],[2.625,64],[3.375,71]],
  [[0.375,66],[1.5,74],[2.25,73],[3.375,69]],
  [[0.75,64],[1.5,67],[2.25,66],[3,64]],
  [[0.75,66],[1.5,69],[2.25,71],[2.625,76],[3.375,74]],
  [[0.75,71],[1.5,69],[2.25,67],[3.375,74]],
  [[0.75,67],[1.5,64],[3,61]],
  [[0.75,66],[1.5,64],[2.625,62]],
];
interface Note { role?: 'melody' | 'accompaniment'; voice: 'pad' | 'pluck'; midi: number; at: number; duration: number; level: number; pan: number }
export const BOATS_NOTES: readonly Note[] = BOATS_CHORDS.flatMap((chord, bar) => {
  const at = bar * 4.5, notes: Note[] = [];
  chord.slice(1, 3).forEach((midi, i) => notes.push({ voice: 'pad', midi, at: at + i * 0.035,
    duration: 3, level: 0.004 * (i === 0 ? 0.85 : 1), pan: (i - 0.5) * 0.23 }));
  notes.push({ role: 'accompaniment', voice: 'pluck', midi: chord[0], at: at + 0.125, duration: 2.5, level: 0.04, pan: -0.22 });
  if (bar !== 7) notes.push({ role: 'accompaniment', voice: 'pluck', midi: chord[1], at: at + 2.25, duration: 1.9, level: 0.025, pan: 0.22 });
  phrases[bar].forEach(([offset, midi], i) => notes.push({ voice: 'pluck', midi, at: at + offset,
    duration: i === phrases[bar].length - 1 ? 2.8 : 1.7,
    level: 0.044 * [1, 0.83, 0.94, 0.77, 0.87][i], pan: Math.sin(bar * 0.8 + i * 0.6) * 0.22 }));
  return notes;
}).sort((a, b) => a.at - b.at);

export const BOATS_PHRASE = polishPhrase({ seconds: BOATS_PHRASE_SECONDS, notes: BOATS_NOTES,
  handoffs: phrases.map((phrase,bar)=>bar*4.5+phrase[phrase.length-1][0]+.7) }, {
  to: 4.5, melody: JOURNEY_THEME.map((midi, i): Note => ({ voice: 'pluck', midi, at: [.75,1.5,2.25,3][i],
    duration: i === 3 ? 2.8 : 1.7, level: .04, pan: -.1 + i * .07 })),
});

const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

/** A chapter-local clock; hidden/muted AudioContext suspension preserves the phrase's position. */
export class LittleBoatsScore {
  private readonly bus: GainNode;
  epoch: number;
  private readonly voices = new Set<OscillatorNode>();
  cycle = 0;
  next = 0;
  private stopped = false;

  constructor(private readonly ctx: AudioContext, output: AudioNode) {
    this.bus = ctx.createGain(); this.bus.gain.value = 0; this.bus.connect(output);
    this.epoch = ctx.currentTime + 0.08;
  }

  chordAt(now: number): number {
    return Math.floor(Math.max(0, now - this.epoch) % BOATS_PHRASE_SECONDS / 4.5);
  }

  update(level: number, until = Infinity): void {
    if (this.stopped) return;
    const now = this.ctx.currentTime;
    this.bus.gain.setTargetAtTime(level, now, level < this.bus.gain.value ? 0.15 : 0.8);
    schedulePhrase(this, BOATS_PHRASE, now, (note, at) => this.play(note, at), until);
  }

  handoffAt(now: number): number { return phraseHandoff(BOATS_PHRASE, this.epoch, now); }

  stop(fade = 1.2): void {
    if (this.stopped) return;
    this.stopped = true;
    const now = this.ctx.currentTime;
    this.bus.gain.cancelAndHoldAtTime(now);
    this.bus.gain.setValueAtTime(this.bus.gain.value, now);
    this.bus.gain.linearRampToValueAtTime(0, now + fade);
    for (const voice of this.voices) voice.stop(now + fade);
    if (!this.voices.size) this.bus.disconnect();
  }

  private play(note: Note, at: number): void {
    const ctx = this.ctx, pad = note.voice === 'pad';
    const pan = ctx.createStereoPanner(); pan.pan.value = note.pan; pan.connect(this.bus);
    const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.Q.value = pad ? 0.35 : 0.45;
    filter.frequency.setValueAtTime(pad ? 1000 : 3200, at);
    if (!pad) filter.frequency.exponentialRampToValueAtTime(900, at + 0.35);
    filter.connect(pan);
    const partials: [number, number, OscillatorType, number][] = pad
      ? [[1, 0.65, 'triangle', -3], [1, 0.35, 'sine', 3]]
      : [[1, 1, 'sine', 0], [2, 0.24, 'sine', 0], [3, 0.07, 'sine', 0], [4.015, 0.025, 'sine', 0]];
    let remaining = partials.length;
    // The pad envelope precedes its partial gains, preserving the auditioned release floor.
    const envelope = pad ? ctx.createGain() : null;
    if (envelope) {
      envelope.gain.setValueAtTime(0, at);
      envelope.gain.linearRampToValueAtTime(note.level, at + 1.8);
      envelope.gain.setValueAtTime(note.level, at + note.duration);
      envelope.gain.exponentialRampToValueAtTime(0.00001, at + note.duration + 2.4);
      envelope.connect(filter);
    }
    for (const [ratio, amplitude, type, detune] of partials) {
      const osc = ctx.createOscillator(), gain = ctx.createGain();
      osc.type = type; osc.frequency.value = hz(note.midi) * ratio; osc.detune.value = detune;
      if (pad) gain.gain.value = amplitude;
      else {
        gain.gain.setValueAtTime(0, at);
        gain.gain.linearRampToValueAtTime(note.level * amplitude, at + 0.009);
        gain.gain.exponentialRampToValueAtTime(Math.max(0.00002, note.level * amplitude * 0.35), at + 0.12);
        gain.gain.exponentialRampToValueAtTime(0.00001, at + note.duration / Math.sqrt(ratio));
      }
      osc.connect(gain).connect(envelope ?? filter);
      this.voices.add(osc);
      osc.onended = () => {
        osc.disconnect(); gain.disconnect(); this.voices.delete(osc);
        if (--remaining === 0) { envelope?.disconnect(); filter.disconnect(); pan.disconnect(); }
        if (this.stopped && !this.voices.size) this.bus.disconnect();
      };
      osc.start(at); osc.stop(at + note.duration + (pad ? 2.5 : 0.05));
    }
  }
}
