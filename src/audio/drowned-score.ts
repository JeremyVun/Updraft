import { phrasePosition, phraseHandoff, schedulePhrase, type Phrase } from './phrasing';
import type { AudioOut } from '../creatures/voices';
import type { PianoStrings } from './audio';
import { tuning } from '../tuning';

/**
 * The drowned village's music, in the game's own voices: the detuned pad of the other rooms, the meadow's piano, its
 * soft sung voice and pluck. One tune belongs to the boat. It drifts in B minor turning to D; it is lost with the boat
 * in the fog, where only a sighing line climbs over a low tolling piano; a lullaby waits with the kittens; and when the
 * boat answers the bell it comes back in D major. The farewell accompanies her look back; the storm brings D minor.
 * Pieces hand over at chord changes, except the storm, whose darkening follows the weather immediately.
 */
export type DrownedScorePhase = 'drift' | 'fog' | 'refuge' | 'home' | 'farewell' | 'storm';

type Voice = 'pad' | 'piano' | 'soft' | 'pluck';
/** For the piano `level` is how hard the key is struck. */
interface Note { voice: Voice; at: number; midi: number; duration: number; level: number; pan: number; role: 'melody' | 'accompaniment' | 'harmony' }
interface Section extends Phrase<Note> { chords: { at: number; tones: readonly number[] }[] }
type Chord = readonly [at: number, tones: readonly number[]];
/** A tune as [start, pitch, length] in its own units. */
type Line = readonly (readonly [at: number, midi: number, length: number])[];

const BAR = 4;
/** The boat's lilt: six to a bar, long-short then long. */
const EIGHTH = BAR / 6;
const BEAT = BAR / 4;

/** Each chord holds into the next one's swell, so the drone crosses from chord to chord without a dip. */
function pad(chords: readonly Chord[], seconds: number, level: number): Note[] {
  return chords.flatMap(([at, tones], k) => {
    const end = chords[k + 1]?.[0] ?? seconds;
    return tones.map((midi, i): Note => ({ voice: 'pad', at: at + i * .035, midi, duration: end - at + .4,
      level: level * (i === 0 ? .85 : 1), pan: (i - 1.5) * .23, role: 'harmony' }));
  });
}

function sing(voice: Voice, line: Line, unit: number, level: number, { from = 0, shift = 0, pan = .06 } = {}): Note[] {
  return line.map(([at, midi, length]) => ({ voice, at: from + at * unit, midi: midi + shift, duration: length * unit,
    level, pan, role: 'melody' }));
}

/** The chord's root plucked softly after it comes in, in the register the birches' strings answer in. */
function plucks(chords: readonly Chord[], level: number): Note[] {
  return chords.map(([at, tones]): Note => ({ voice: 'pluck', at: at + .5, midi: tones[0] + 12, duration: 2.7, level,
    pan: -.2, role: 'accompaniment' }));
}

/** The low piano on each root and then its fifth, a bar apart, as on the sleeping island's climb. */
function tolling(chords: readonly Chord[]): Note[] {
  return chords.flatMap(([at, [root]]): Note[] => [
    { voice: 'piano', at: at + .15, midi: root, duration: 4, level: .13, pan: -.1, role: 'accompaniment' },
    { voice: 'piano', at: at + 4.15, midi: root + 7, duration: 4, level: .1, pan: -.1, role: 'accompaniment' },
  ]);
}

function section(seconds: number, chords: readonly Chord[], passes: Note[][], loopFrom = 0): Section {
  const variants = passes.map((notes) => [...notes].sort((a, b) => a.at - b.at));
  return { seconds, loopFrom, notes: variants[0], variants,
    chords: chords.map(([at, tones]) => ({ at, tones })),
    handoffs: [...chords.map(([at]) => at).filter((at) => at > 0), seconds] };
}

const pick = (line: Line, from: number, to: number): Line => line.filter(([at]) => at >= from && at < to);

/**
 * The boat's tune, in eighths. Over the drift's falling bass (B minor, A, G, F♯ minor) it sighs down and climbs to a
 * half close; then over G it asks the piano's question, D–E–F♯ up to B, and comes down by E minor to A.
 */
const BOAT_TUNE: Line = [
  [0, 74, 4], [4, 73, 2], [6, 71, 6],
  [12, 73, 4], [16, 71, 2], [18, 69, 6],
  [24, 71, 2], [26, 74, 2], [28, 79, 2], [30, 78, 4], [34, 76, 2],
  [36, 73, 4], [40, 74, 2], [42, 73, 6],
  [48, 74, 2], [50, 76, 2], [52, 78, 2], [54, 83, 6],
  [60, 81, 4], [64, 78, 2], [66, 76, 2], [68, 74, 4],
  [72, 79, 4], [76, 78, 2], [78, 76, 6],
  [84, 74, 4], [88, 73, 2], [90, 69, 6],
];

/** The dusk drift and the rescue: a bar of B minor alone, then the boat's tune round and round. */
function drift(): Section {
  const intro = 8, body: Chord[] = [[0, [47, 54, 62, 64]], [8, [45, 52, 61, 64]], [16, [43, 50, 59, 64]],
    [24, [42, 49, 57, 64]], [32, [43, 50, 59, 66]], [40, [42, 50, 57, 64]], [48, [40, 47, 55, 62]], [56, [45, 52, 57, 64]]];
  const chords: Chord[] = [[0, body[0][1]], ...body.map(([at, tones]): Chord => [at + intro, tones])];
  const under = [...pad(chords, intro + 64, .0055), ...plucks(chords.slice(1), .0035)];
  const piano = (line: Line) => sing('piano', line, EIGHTH, .26, { from: intro, pan: .08 });
  const soft = (line: Line) => sing('soft', line, EIGHTH, .0028, { from: intro });
  return section(intro + 64, chords, [
    [...under, ...piano(BOAT_TUNE)],
    [...under, ...soft(BOAT_TUNE), ...piano(pick(BOAT_TUNE, 48, 96))],
    [...under, ...piano([...pick(BOAT_TUNE, 0, 24), ...pick(BOAT_TUNE, 48, 72)])],
  ], intro);
}

/**
 * The fog and the run over the roofs, in beats. The boat's tune is gone with the boat. Over B minor, G, E minor and F♯
 * a sung line tries a step up and falls back, each time a step higher; the second time round it sighs down the scale
 * and stops on F♯, unresolved. The low piano tolls under it.
 */
const FOG_RISING: Line = [
  [0, 66, 3], [3, 67, 1], [4, 66, 2], [6, 62, 2],
  [8, 67, 3], [11, 69, 1], [12, 67, 2], [14, 62, 2],
  [16, 71, 3], [19, 73, 1], [20, 71, 2], [22, 67, 2],
  [24, 73, 3], [27, 74, 1], [28, 73, 4],
];
const FOG_FALLING: Line = [
  [32, 74, 3], [35, 73, 1], [36, 71, 4],
  [40, 71, 3], [43, 69, 1], [44, 67, 4],
  [48, 67, 3], [51, 66, 1], [52, 64, 4],
  [56, 66, 3], [59, 64, 1], [60, 66, 4],
];
function fog(): Section {
  const round = [[47, 54, 59, 62], [43, 50, 59, 62], [40, 50, 55, 59]];
  const chords: Chord[] = [...round.map((tones, i): Chord => [i * 8, tones]), [24, [42, 49, 54, 59]],
    ...round.map((tones, i): Chord => [32 + i * 8, tones]), [56, [42, 49, 54, 57]]];
  const under = [...pad(chords, 64, .0042), ...tolling(chords)];
  const soft = (line: Line) => sing('soft', line, BEAT, .0024);
  return section(64, chords, [
    [...under, ...soft(FOG_FALLING)],
    [...under, ...soft(FOG_RISING), ...soft(FOG_FALLING)],
    [...under, ...soft(FOG_RISING), ...soft(FOG_FALLING), ...sing('piano', FOG_FALLING, BEAT, .2, { pan: .1 })],
  ]);
}

/** The refuge: a lullaby for the kittens on the bell's own notes, rocking down over G, B minor, E minor and A. */
const LULLABY: Line = [
  [0, 78, 4], [4, 74, 2], [6, 71, 6],
  [12, 78, 4], [16, 74, 2], [18, 69, 6],
  [24, 76, 4], [28, 74, 2], [30, 71, 6],
  [36, 74, 4], [40, 73, 2], [42, 69, 6],
];
function refuge(): Section {
  const chords: Chord[] = [[0, [43, 54, 59, 62]], [8, [47, 54, 57, 62]], [16, [40, 50, 55, 59]], [24, [45, 52, 57, 64]]];
  const under = pad(chords, 32, .0036);
  const piano = (line: Line) => sing('piano', line, EIGHTH, .2, { pan: .1 });
  return section(32, chords, [
    [...under, ...piano(LULLABY)],
    [...under, ...piano([...pick(LULLABY, 0, 12), ...pick(LULLABY, 24, 36)])],
  ]);
}

/**
 * The boat comes home: its tune in D major, the first half a third higher over the bass walking down from D, the
 * second half the drift's own question, closing on A to come round to D.
 */
const HOME_TUNE: Line = [
  [0, 78, 4], [4, 76, 2], [6, 74, 6],
  [12, 76, 4], [16, 74, 2], [18, 73, 6],
  [24, 74, 2], [26, 78, 2], [28, 83, 2], [30, 81, 4], [34, 79, 2],
  [36, 78, 4], [40, 79, 2], [42, 78, 6],
  ...pick(BOAT_TUNE, 48, 84),
  [84, 74, 4], [88, 73, 2], [90, 76, 6],
];
function home(): Section {
  const chords: Chord[] = [[0, [50, 57, 64, 66]], [8, [49, 52, 57, 64]], [16, [47, 54, 62, 66]], [24, [45, 54, 62, 66]],
    [32, [43, 50, 59, 66]], [40, [42, 50, 57, 64]], [48, [40, 47, 55, 62]], [56, [45, 52, 57, 64]]];
  const under = [...pad(chords, 64, .0052), ...plucks(chords, .0033)];
  const piano = sing('piano', HOME_TUNE, EIGHTH, .27, { pan: .08 });
  const below = (from: number, to: number) => sing('soft', pick(HOME_TUNE, from, to), EIGHTH, .0018, { shift: -12, pan: -.06 });
  return section(64, chords, [[...under, ...piano, ...below(48, 96)], [...under, ...piano, ...below(0, 48)]]);
}

/**
 * Letting go: the answer B–A–F♯, E–F♯–D, G–F♯–E–C♯ down to D, the piano with the soft voice an octave under it. Then
 * D turns minor and the dark comes: D minor, B♭, G minor and D over the storm's low D, the question gone cold to
 * D–E–F; then the same round again, fainter, for as long as the storm takes to reach the wood. Every chord keeps D and A
 * for the wood's drone to come in on.
 */
const ANSWER: Line = [
  [0, 83, 4], [4, 81, 2], [6, 78, 6],
  [12, 76, 4], [16, 78, 2], [18, 74, 6],
  [24, 79, 3], [27, 78, 3], [30, 76, 3], [33, 73, 3],
  [36, 74, 12],
];
const COLD: Line = [[1, 62, 2], [3, 64, 1], [4, 65, 4], [16.5, 67, 2.5], [19, 65, 1], [20, 64, 4], [25, 62, 5]];
function farewell(): Section {
  const goodbye: Chord[] = [[0, [43, 50, 59, 66]], [8, [42, 50, 57, 64]], [16, [40, 47, 55, 62]],
    [20, [45, 52, 57, 64]], [24, [38, 50, 57, 66]]];
  return section(32, goodbye, [[...pad(goodbye, 32, .005), ...sing('piano', ANSWER, EIGHTH, .25, { pan: .08 }),
    ...sing('soft', ANSWER, EIGHTH, .0018, { shift: -12, pan: -.06 })]], 24);
}

function storm(): Section {
  const round: Chord[] = [[0, [38, 45, 53, 64]], [8, [38, 46, 53, 57]], [16, [38, 46, 55, 57]], [24, [38, 45, 50, 52]]];
  return section(32, round, [
    [...pad(round, 32, .0036), ...sing('soft', COLD, 1, .0024)],
    [...pad(round, 32, .0024), ...sing('soft', COLD, 1, .0015)],
  ]);
}

export const DROWNED_SECTIONS: Record<DrownedScorePhase, Section> = {
  drift: drift(), fog: fog(), refuge: refuge(), home: home(), farewell: farewell(), storm: storm(),
};

interface Part {
  phase: DrownedScorePhase;
  out: AudioOut & { bus: GainNode; reverb: GainNode };
  piano: PianoStrings;
  epoch: number;
  cycle: number;
  next: number;
  /** Where this piece hands over to the next one the story has asked for. */
  until: number;
  stopped: boolean;
  voices: Set<AudioScheduledSourceNode>;
  envelopes: Set<AudioParam>;
}
const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);
/** The tune's piano a little nearer than the bedside piano's 0.32: high notes die quickly and the tune is the point. */
const TUNE_NEAR = .45;

export class DrownedScore {
  private readonly output: AudioOut & { bus: GainNode; reverb: GainNode };
  private readonly parts = new Set<Part>();
  private current: Part | null = null;
  private stopped = false;

  constructor(out: AudioOut, private readonly makePiano: (out: AudioOut) => PianoStrings) {
    this.output = this.gates(out, 0);
  }

  chordAt(when: number): readonly number[] {
    const part = [...this.parts].reverse().find((p) => p.epoch <= when) ?? this.current;
    const pattern = DROWNED_SECTIONS[part?.phase ?? 'drift'];
    const time = part ? phrasePosition(pattern, part.epoch, when) : 0;
    return [...pattern.chords].reverse().find((c) => c.at <= time)?.tones ?? pattern.chords[0].tones;
  }

  update(phase: DrownedScorePhase, level: number, until = Infinity): void {
    if (this.stopped) return;
    const now = this.output.ctx.currentTime;
    for (const gain of [this.output.bus, this.output.reverb]) gain.gain.setTargetAtTime(level, now, .8);
    if (!this.current) this.current = this.begin(phase, now + .08);
    let part = this.current;
    if (phase === part.phase) part.until = Infinity;
    else if (part.until === Infinity) part.until = phase === 'storm' ? now + .3 : this.nextChange(part, now + .3);
    if (part.until <= now + .25) {
      this.release(part, part.until, tuning.audio.drownedCrossFade);
      part = this.current = this.begin(phase, part.until);
    }
    schedulePhrase(part, DROWNED_SECTIONS[part.phase], now, (note, at) => this.play(part, note, at), Math.min(until, part.until));
  }

  handoffAt(now: number): number {
    return this.current ? phraseHandoff(DROWNED_SECTIONS[this.current.phase], this.current.epoch, now) : now;
  }

  stop(fade = 1.8): void {
    if (this.stopped) return;
    this.stopped = true;
    for (const part of this.parts) this.release(part, this.output.ctx.currentTime, fade);
    this.disconnectIfDone();
  }

  private nextChange(part: Part, after: number): number {
    const section = DROWNED_SECTIONS[part.phase], from = section.loopFrom ?? 0, body = section.seconds - from;
    const ends = section.handoffs ?? [section.seconds];
    for (let cycle = Math.max(0, Math.floor((after - part.epoch - section.seconds) / body)); ; cycle++) {
      for (const end of ends) {
        if (cycle > 0 && end <= from) continue;
        const at = part.epoch + cycle * body + end;
        if (at >= after) return at;
      }
    }
  }

  private gates(out: AudioOut, level: number): AudioOut & { bus: GainNode; reverb: GainNode } {
    const bus = out.ctx.createGain(), reverb = out.ctx.createGain();
    bus.gain.value = reverb.gain.value = level;
    bus.connect(out.bus); reverb.connect(out.reverb);
    return { ctx: out.ctx, bus, reverb };
  }

  private begin(phase: DrownedScorePhase, epoch: number): Part {
    const out = this.gates(this.output, 1);
    const part: Part = { phase, out, piano: this.makePiano(out), epoch, cycle: 0, next: 0, until: Infinity,
      stopped: false, voices: new Set(), envelopes: new Set() };
    this.parts.add(part);
    return part;
  }

  private release(part: Part, at: number, fade: number): void {
    if (part.stopped && at >= part.until) return;
    part.stopped = true;
    part.until = at;
    const now = this.output.ctx.currentTime;
    // Let the bus fade carry held notes across the handoff instead of losing their tails underneath it.
    for (const envelope of part.envelopes) envelope.cancelAndHoldAtTime(Math.max(now, at));
    for (const gain of [part.out.bus, part.out.reverb]) {
      // A crossing scheduled for a later phrase end can be brought forward by a stop.
      gain.gain.cancelAndHoldAtTime(Math.max(now, at));
      gain.gain.setValueAtTime(at > now ? 1 : gain.gain.value, Math.max(now, at));
      gain.gain.linearRampToValueAtTime(0, Math.max(now, at) + fade);
    }
    for (const source of part.voices) source.stop(Math.max(now, at) + fade);
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
    if (!this.parts.delete(part)) return;
    part.out.bus.disconnect(); part.out.reverb.disconnect(); this.disconnectIfDone();
  }

  private disconnectIfDone(): void {
    if (this.stopped && !this.parts.size) { this.output.bus.disconnect(); this.output.reverb.disconnect(); }
  }

  private play(part: Part, note: Note, at: number): void {
    if (note.voice === 'piano') {
      for (const source of part.piano.note(note.midi, note.level, note.pan, note.role === 'melody' ? TUNE_NEAR : .32, at)) this.track(part, source);
      return;
    }
    const ctx = this.output.ctx, pad = note.voice === 'pad', pluck = note.voice === 'pluck';
    const pan = ctx.createStereoPanner(); pan.pan.value = note.pan;
    pan.connect(part.out.bus);
    const send = ctx.createGain(); send.gain.value = .9; pan.connect(send).connect(part.out.reverb);
    const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.Q.value = pluck ? .45 : .35;
    filter.frequency.setValueAtTime(pluck ? 3200 : pad ? 1000 : 1600, at);
    if (pluck) filter.frequency.exponentialRampToValueAtTime(900, at + .35);
    filter.connect(pan);
    const attack = pad ? 1.8 : .4, release = pad ? 2.4 : 1.6;
    const envelope = pluck ? null : ctx.createGain();
    if (envelope) {
      part.envelopes.add(envelope.gain);
      envelope.gain.setValueAtTime(0, at);
      envelope.gain.linearRampToValueAtTime(note.level, at + attack);
      envelope.gain.setValueAtTime(note.level, at + Math.max(attack, note.duration));
      envelope.gain.exponentialRampToValueAtTime(.00001, at + Math.max(attack, note.duration) + release);
      envelope.connect(filter);
    }
    const partials: (readonly [number, number, OscillatorType, number])[] = pad
      ? [[1, .65, 'triangle', -3], [1, .35, 'sine', 3]]
      : pluck ? [[1, 1, 'sine', 0], [2, .24, 'sine', 0], [3, .07, 'sine', 0], [4.015, .025, 'sine', 0]]
      : [[1, 1, 'sine', 0], [2, .08, 'sine', 0], [3, .014, 'sine', 0]];
    const end = at + (pluck ? note.duration : Math.max(attack, note.duration) + release) + .05;
    let remaining = partials.length;
    for (const [ratio, amplitude, type, detune] of partials) {
      const osc = ctx.createOscillator(), gain = ctx.createGain();
      osc.type = type; osc.frequency.value = hz(note.midi) * ratio; osc.detune.value = detune;
      if (pluck) {
        gain.gain.setValueAtTime(0, at);
        gain.gain.linearRampToValueAtTime(note.level * amplitude, at + .009);
        gain.gain.exponentialRampToValueAtTime(Math.max(.00002, note.level * amplitude * .35), at + .12);
        gain.gain.exponentialRampToValueAtTime(.00001, at + note.duration / Math.sqrt(ratio));
      } else gain.gain.value = amplitude;
      osc.connect(gain).connect(envelope ?? filter);
      osc.onended = () => {
        osc.disconnect(); gain.disconnect();
        if (--remaining === 0) {
          if (envelope) part.envelopes.delete(envelope.gain);
          envelope?.disconnect(); filter.disconnect(); pan.disconnect(); send.disconnect();
        }
      };
      this.track(part, osc); osc.start(at); osc.stop(end);
    }
  }
}
