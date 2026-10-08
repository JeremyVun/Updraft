import { DREAM_PALETTE, type DreamNote } from './dream-score-data';
import { tuning } from '../tuning';

/**
 * The drowned village's music from the air dying to the storm, in the approved drift's B minor (its relative D major
 * for home) and its instruments: the water strings' chords, the cello, the felt (soft, struck) and the undertow. Every
 * cue states or develops one theme, the piano's question D–E–F♯ rising to B and its answer B–F♯–E–D, in four-bar
 * phrases on a steady beat over four chords that come round, so the ear can learn both.
 */
export type CueNote = Omit<DreamNote, 'role'> & {
  role: DreamNote['role'] | 'accompaniment';
  /** How full the chase's pulse must be for this note to sound: 0 halves, 1 quarters, 2 eighths. */
  fill?: number;
  /** A shorter bow than the patch's release, so a quick step does not smear into the next. */
  release?: number;
};
interface Harmony { chords: { at: number; tones: readonly number[] }[] }
/** A stretch of the chase, chosen whole where it begins. */
export interface Passage extends Harmony { seconds: number; bar: number; notes: CueNote[] }
export interface Conductor {
  /** The next passage, from how hard the chase presses as it begins. */
  next(tension: number): Passage;
  /** How full the pulse is for the next bar. */
  fill(tension: number): number;
}
export interface Cue extends Harmony {
  seconds: number;
  loopFrom?: number;
  notes: CueNote[];
  variants?: CueNote[][];
  /** Seconds to cross into this cue, both ways, where its first notes come too soon for the usual fade. */
  fade?: number;
  conduct?: () => Conductor;
}
type Chord = [at: number, tones: readonly number[], hold: number, level: number];
/** A melody by the beat: where each note starts, its pitch and how many beats it holds. */
type Line = readonly (readonly [beat: number, midi: number, beats: number])[];

const note = (voice: string, pan: number, role: CueNote['role']) =>
  (at: number, midi: number, duration: number, level: number, extra: Partial<CueNote> = {}): CueNote =>
    ({ voice, at, midi, duration, level, pan, role, ...extra });
const cello = note('cello', -.12, 'melody');
const felt = note('felt', .17, 'melody');
const pulse = note('felt', .06, 'accompaniment');
const undertow = note('undertow', 0, 'weather');

/** A chord on the water strings, voiced and weighted as the drift's: the lowest voice a little under the rest. */
function strings([at, tones, hold, level]: Chord): CueNote[] {
  return tones.map((midi, i) => ({ voice: 'water-string', at: at + i * .045, midi, duration: hold + 2.2,
    level: i ? level : level * .78, pan: (i - (tones.length - 1) / 2) * .18, role: 'harmony' }));
}

/** A line from `start` at `beat` seconds a beat, `shift` semitones away: the felt rings on; the cello bows on. */
function sing(voice: 'cello' | 'felt', line: Line, start: number, beat: number, level: number, shift = 0): CueNote[] {
  return line.map(([at, midi, beats], i) => {
    const held = beats * beat, t = start + at * beat;
    if (voice === 'felt') return felt(t, midi + shift, held + DREAM_PALETTE.felt.release, level);
    const legato = (line[i + 1]?.[0] ?? Infinity) <= at + beats;
    const release = Math.min(legato ? .45 : DREAM_PALETTE.cello.release, held / 2);
    return cello(t, midi + shift, held + release, level, { release });
  });
}

function cue(seconds: number, chords: Chord[], passes: CueNote[][], extra: Partial<Cue> = {}): Cue {
  const variants = passes.map((notes) => [...chords.flatMap(strings), ...notes].sort((a, b) => a.at - b.at));
  return { seconds, chords: chords.map(([at, tones]) => ({ at, tones })), notes: variants[0],
    ...(variants.length > 1 ? { variants } : {}), ...extra };
}

const CHORD = {
  Bm: [47, 54, 59, 62], G: [43, 50, 57, 59], D: [38, 50, 54, 57], A: [45, 52, 57, 61], Asus4: [45, 52, 57, 62],
  Em: [40, 52, 55, 59], 'F#': [42, 49, 54, 58], 'F#7': [42, 49, 52, 58], Gmaj7: [43, 50, 54, 59],
} as const;
const Cs = 61, D = 62, E = 64, Fs = 66, G = 67, A = 69, As = 70, B = 71;
/** The question, D . . E | F♯ . . . | – D E F♯ | B . . . , and the answer, B . . A | F♯ . . . | E . F♯ . | D . . . */
const QUESTION: Line = [[0, D, 3], [3, E, 1], [4, Fs, 4], [9, D, 1], [10, E, 1], [11, Fs, 1], [12, B, 4]];
const ANSWER: Line = [[0, B, 3], [3, A, 1], [4, Fs, 4], [8, E, 2], [10, Fs, 2], [12, D, 4]];

const BEAT = .8, BAR = 4 * BEAT;

/**
 * The air dies and the boat sticks. No pulse: the strings rock B minor to G under the becalmed phrase, and the cello
 * asks the question at half speed and stops on its F♯ as the chord turns to the dominant, unfinished. There a soft
 * heartbeat starts, as the cat bolts, and holds on F♯ for her decision. If the story holds, it beats on round the
 * chords and the cello leaves the question unasked.
 */
function stuck(): Cue {
  const chords: Chord[] = [[0, CHORD.Bm, 2 * BAR, .0075], [2 * BAR, CHORD.G, 2 * BAR, .007],
    [4 * BAR, CHORD['F#'], 2 * BAR, .0075], [6 * BAR, CHORD['F#7'], 2 * BAR, .0075]];
  const heart = (bar: number, root: number) => [0, 2].flatMap((beat) => {
    const at = bar * BAR + beat * BEAT;
    return [pulse(at, root, 1.8, .0085), pulse(at, root + 12, 1.8, .003), pulse(at + .22, root, 1.8, .0055)];
  });
  const first = [...sing('cello', QUESTION.slice(0, 3), 2 * BAR, 2 * BEAT, .013),
    ...[4, 5, 6, 7].flatMap((bar) => heart(bar, 42))];
  const held = [47, 47, 43, 43, 42, 42, 42, 42].flatMap((root, bar) => heart(bar, root));
  return cue(8 * BAR, chords, [first, held]);
}

/** One bar of the chase's pulse on a chord's root: halves always, its fifth on the quarters, the octave on the eighths. */
function beats(at: number, root: number): CueNote[] {
  return [0, 1, 2, 3].flatMap((beat) => {
    const t = at + beat * BEAT;
    const on = beat % 2 ? [pulse(t, root + 7, 2, .0064, { fill: 1 })] : [pulse(t, root, 2, .008), pulse(t, root + 12, 2, .0033)];
    return [...on, pulse(t + BEAT / 2, root + 12, 1.8, .005, { fill: 2 })];
  });
}

function passage(chords: readonly (readonly number[])[], ...lines: CueNote[][]): Passage {
  return {
    seconds: chords.length * BAR, bar: BAR, chords: chords.map((tones, i) => ({ at: i * BAR, tones })),
    notes: [...chords.flatMap((tones, i) => [...strings([i * BAR, tones, BAR, .0085]), ...beats(i * BAR, tones[0])]),
      ...lines.flat()].sort((a, b) => a.at - b.at),
  };
}

const EASED = [CHORD.Bm, CHORD.G, CHORD.D, CHORD.A], ANSWERED = [CHORD.Bm, CHORD.G, CHORD.D, CHORD.Asus4];
const PRESSED = [CHORD.Bm, CHORD.G, CHORD.Em, CHORD['F#7']];
/** The cello's counter-line under the felt: down the scale against the question's rise, up against the answer's fall. */
const UNDER_QUESTION: Line = [[0, 59, 2], [2, 57, 2], [4, 55, 4], [8, 54, 4], [12, 52, 4]];
const UNDER_ANSWER: Line = [[0, 54, 4], [4, 55, 4], [8, 57, 4], [12, 52, 4]];
/** The question's head a step higher each bar (D E F♯, E F♯ G, F♯ G A) to the leading note, rising to the answer's B. */
const SEQUENCE: Line = [[0, D, 1], [1, E, 1], [2, Fs, 2], [4, E, 1], [5, Fs, 1], [6, G, 2], [8, Fs, 1], [9, G, 1],
  [10, A, 2], [12, As, 4]];
/** And the answer from that B, which cannot come home: it ends on C♯ over the dominant and climbs again. */
const DENIED: Line = [[0, B, 3], [3, A, 1], [4, Fs, 4], [8, E, 2], [10, Fs, 2], [12, Cs, 4]];
/** Under the felt, the cello on the roots an octave up, or holding B over the round and falling to the leading note. */
const UNDER_SEQUENCE: Line = [[0, 59, 4], [4, 55, 4], [8, 52, 4], [12, 54, 4]];
const UNDER_DENIED: Line = [[0, 59, 4], [4, 59, 4], [8, 59, 4], [12, 58, 4]];
const SUNG = .014, STRUCK = .0105, UNDER = .0095;
/**
 * Three times round the period before it repeats: the cello; the felt an octave up over the cello's counter-line; the
 * cello asking and the felt answering.
 */
const CALM: Passage[] = [
  passage(EASED, sing('cello', QUESTION, 0, BEAT, SUNG)),
  passage(ANSWERED, sing('cello', ANSWER, 0, BEAT, SUNG)),
  passage(EASED, sing('felt', QUESTION, 0, BEAT, STRUCK, 12), sing('cello', UNDER_QUESTION, 0, BEAT, UNDER)),
  passage(ANSWERED, sing('felt', ANSWER, 0, BEAT, STRUCK, 12), sing('cello', UNDER_ANSWER, 0, BEAT, UNDER)),
  passage(EASED, sing('cello', QUESTION, 0, BEAT, SUNG)),
  passage(ANSWERED, sing('felt', ANSWER, 0, BEAT, STRUCK, 12), sing('cello', UNDER_ANSWER, 0, BEAT, UNDER)),
];
const pressed = (...lines: CueNote[][]) => passage(PRESSED, ...lines, [undertow(3 * BAR, 42, 7, .005)]);
/**
 * Pressing, the climb and the denied answer make the period, the undertow swelling on each dominant; three times
 * round before it repeats: the cello; the felt doubling it an octave up, then over the cello's held B; the felt alone
 * over the roots, then both.
 */
const PRESS: Passage[] = [
  pressed(sing('cello', SEQUENCE, 0, BEAT, SUNG)),
  pressed(sing('cello', DENIED, 0, BEAT, SUNG)),
  pressed(sing('cello', SEQUENCE, 0, BEAT, SUNG), sing('felt', SEQUENCE, 0, BEAT, STRUCK * .85, 12)),
  pressed(sing('felt', DENIED, 0, BEAT, STRUCK, 12), sing('cello', UNDER_DENIED, 0, BEAT, UNDER)),
  pressed(sing('felt', SEQUENCE, 0, BEAT, STRUCK, 12), sing('cello', UNDER_SEQUENCE, 0, BEAT, UNDER)),
  pressed(sing('cello', DENIED, 0, BEAT, SUNG), sing('felt', DENIED, 0, BEAT, STRUCK * .85, 12)),
];
/** A bar of the pulse alone on the dominant, carrying the stuck boat's heartbeat into the run. */
const SET_OFF = passage([CHORD['F#']]);

/**
 * The chase, a passage at a time: the theme over B minor, G, D, A while the fog is far or she is across a piece; the
 * question's head climbing over B minor, G, E minor, F♯ while it presses, then its denied answer. Which one is read
 * only where a phrase begins, with a margin either way so it does not turn at every phrase, and a return to ease
 * begins at the question. The pulse fills in or thins bar by bar.
 */
class Chase implements Conductor {
  private begun = false;
  private pressing = false;
  private calm = 0;
  private pressed = 0;
  private full = 0;
  next(tension: number): Passage {
    if (!this.begun) {
      this.begun = true;
      return SET_OFF;
    }
    const k = tuning.audio.drownedChase;
    if (this.pressing ? tension < k.relax : tension >= k.press) {
      this.pressing = !this.pressing;
      this.pressed = 0;
      this.calm += this.calm % 2;
    }
    return this.pressing ? PRESS[this.pressed++ % PRESS.length] : CALM[this.calm++ % CALM.length];
  }
  fill(tension: number): number {
    const { quarters, eighths, give } = tuning.audio.drownedChase, at = [quarters, eighths];
    while (this.full < at.length && tension >= at[this.full]) this.full++;
    while (this.full > 0 && tension < at[this.full - 1] - give) this.full--;
    return this.full;
  }
}

/** The chase as it runs while the fog stays far: the set-off and the theme once round, for what reads it whole. */
function chase(): Cue {
  const easy = new Chase(), passages = [easy.next(0), easy.next(0), easy.next(0)];
  const chords: Cue['chords'] = [], notes: CueNote[] = [];
  let at = 0;
  for (const p of passages) {
    chords.push(...p.chords.map((c) => ({ at: c.at + at, tones: c.tones })));
    notes.push(...p.notes.map((n) => ({ ...n, at: n.at + at })));
    at += p.seconds;
  }
  return { seconds: at, loopFrom: SET_OFF.seconds, chords, notes, conduct: () => new Chase() };
}

/**
 * She reaches the tower and climbs: the question's head goes up a step a bar over B minor, G and A (– D E F♯,
 * – E F♯ G, – F♯ G A), each top note held over into the next chord, the pulse slowing to nothing under it. It stops at
 * the top on A over the suspended chord, a step short of B.
 */
function climb(): Cue {
  const bars = [0, 3.2, 6.7, 10.6], beat = [.8, .875, .975];
  const chords: Chord[] = [[0, CHORD.Bm, 3.2, .0064], [3.2, CHORD.G, 3.5, .0064], [6.7, CHORD.A, 3.9, .0064],
    [10.6, CHORD.Asus4, 5.4, .0064]];
  const line = [[D, E, Fs], [E, Fs, G], [Fs, G, A]].flatMap((steps, bar) => steps.map((midi, i) => {
    const at = bars[bar] + (i + 1) * beat[bar], top = i === 2;
    const held = !top ? beat[bar] : bar < 2 ? bars[bar + 1] + beat[bar + 1] - at : 5;
    const release = top && bar === 2 ? DREAM_PALETTE.cello.release : Math.min(.45, held / 2);
    return cello(at, midi, held + release, .0112, { release });
  }));
  const slowing = ([[0, 47, .0072], [1.6, 47, .006], [3.2, 43, .0052], [4.95, 43, .0036], [6.7, 45, .0028]] as const)
    .flatMap(([at, root, level]) => [pulse(at, root, 2, level), pulse(at, root + 12, 2, level * .4)]);
  return cue(16, chords, [[...line, ...slowing], line], { fade: 1 });
}

/**
 * The belfry, hushed: the strings rock B minor to Gmaj7, a chord every 8 s, and once a cycle the felt sings the theme
 * an octave up and slow, a lullaby for the kittens, then leaves a long space. Every note sits clear of the bell's
 * ringing partials (B2, B3, D4, F♯4, B4): the felt above them, the strings on them or well away.
 */
function belfry(): Cue {
  const chords = [0, 1, 2, 3, 4, 5].map((i): Chord => [i * 8, i % 2 ? CHORD.Gmaj7 : CHORD.Bm, 8, .006]);
  return cue(48, chords, [[...sing('felt', QUESTION, 4, 1, .008, 12), ...sing('felt', ANSWER, 20, 1, .008, 12)]]);
}

/**
 * Each answer of the lantern sings the question so far, a note further each time (D over G, D–E over E minor, D–E–F♯
 * over the suspended A), once the bell's strike has passed: the felt struck in the lullaby's octave, above the bell's
 * ringing partials, and the cello swelling below them. If the next ring is slow in coming, the strings turn through
 * voicings of the chord and the cello recalls the notes so far at half speed.
 */
function answer(sung: number, level: number, ...voicings: (readonly number[])[]): Cue {
  const so = [D, E, Fs].slice(0, sung), last = sung - 1;
  const struck: Line = so.map((midi, i) => [i, midi, i === last ? 2 : 1]);
  const bowed: Line = so.map((midi, i) => [i, midi, i === last ? 5 : 1]);
  const recalled: Line = so.map((midi, i) => [2 * i, midi, i === last ? 6 : 2]);
  const chords = [...voicings, voicings[0]].map((tones, i): Chord => [i * 8, tones, 8, level]);
  return cue(32, chords, [[...sing('felt', struck, .9, BEAT, .011, 12), ...sing('cello', bowed, .6, BEAT, .012, -12),
    ...sing('cello', recalled, 9, BEAT, .008, -12)]], { loopFrom: 8, fade: 1 });
}

const HOME_BEAT = .9, HOME_BAR = 4 * HOME_BEAT;
const UNDER_HOME_QUESTION: Line = [[0, 54, 4], [4, 52, 4], [8, 50, 4], [12, 47, 4]];
const UNDER_HOME_ANSWER: Line = [[0, 50, 4], [4, 52, 4], [8, 54, 4], [12, 55, 4]];

/**
 * The fourth answer lands: B over D major, the felt completing the question above the bell with the cello below.
 * Then the theme whole in D major over D, A, B minor and G, question then answer, warm, while she climbs down and the
 * boat comes in; each time round the orchestration turns (the cello; the felt an octave up over the cello's
 * counter-line; the cello asking and the felt answering), over a soft beat at the bar.
 */
function home(): Cue {
  const major = [CHORD.D, CHORD.A, CHORD.Bm, CHORD.G];
  const chords: Chord[] = [[0, [38, 50, 57, 62, 66], HOME_BAR, .0093],
    ...[1, 5].flatMap((from) => major.map((tones, i): Chord => [(from + i) * HOME_BAR, tones, HOME_BAR, .0093]))];
  const ask = HOME_BAR, reply = 5 * HOME_BAR;
  const beat = [1, 2, 3, 4, 5, 6, 7, 8].flatMap((bar) => {
    const root = major[(bar - 1) % 4][0], at = bar * HOME_BAR;
    return [pulse(at, root, 2, .005), pulse(at, root + 12, 2, .002), pulse(at + 2 * HOME_BEAT, root, 2, .0035)];
  });
  const passes = [
    [felt(1, B + 12, 3.4, .0105), cello(1.3, B - 12, 4.4, .0102),
      ...sing('cello', QUESTION, ask, HOME_BEAT, .014), ...sing('cello', ANSWER, reply, HOME_BEAT, .014)],
    [...sing('felt', QUESTION, ask, HOME_BEAT, .011, 12), ...sing('cello', UNDER_HOME_QUESTION, ask, HOME_BEAT, .0102),
      ...sing('felt', ANSWER, reply, HOME_BEAT, .011, 12), ...sing('cello', UNDER_HOME_ANSWER, reply, HOME_BEAT, .0102)],
    [...sing('cello', QUESTION, ask, HOME_BEAT, .014),
      ...sing('felt', ANSWER, reply, HOME_BEAT, .011, 12), ...sing('cello', UNDER_HOME_ANSWER, reply, HOME_BEAT, .0102)],
  ];
  return cue(9 * HOME_BAR, chords, passes.map((pass) => [...pass, ...beat]), { loopFrom: HOME_BAR, fade: 1 });
}

/**
 * Aboard, she looks up: the answer's last phrase as a cadence, F♯–E–D over G, A and D, the felt over the cello's bass,
 * landing on D as the cat gives its slow blink; then D major held until the storm's gathering darkens it.
 */
function farewell(): Cue {
  const cadence = [[43, 59, Fs], [45, 61, E], [50, 57, D]].flatMap(([bass, inner, top], i) => {
    const at = .9 + i * .95, landing = i === 2;
    return [cello(at, bass, landing ? 6.4 : 1.35, .012, { release: landing ? DREAM_PALETTE.cello.release : .4 }),
      felt(at, inner, landing ? 4 : 2.4, .008), felt(at, top, landing ? 4.4 : 2.4, .011)];
  });
  return cue(12, [[0, CHORD.G, 2.6, .0085], [1.6, [38, 50, 57, 62, 66], 8, .0095]], [cadence], { fade: 1 });
}

export type DrownedCuePhase = 'stuck' | 'chase' | 'climb' | 'belfry' | 'answer1' | 'answer2' | 'answer3' | 'home' | 'farewell';
export const DROWNED_CUES: Record<DrownedCuePhase, Cue> = {
  stuck: stuck(), chase: chase(), climb: climb(), belfry: belfry(),
  answer1: answer(1, .006, [43, 50, 59, 66], [43, 52, 59, 62], [43, 50, 57, 66]),
  answer2: answer(2, .0065, [40, 47, 55, 62, 66], [40, 50, 55, 64], [40, 47, 55, 59]),
  answer3: answer(3, .007, [45, 52, 57, 62], [45, 55, 59, 62], [45, 52, 57, 64]),
  home: home(), farewell: farewell(),
};

/** The bell's answers in order: before the first, after each, and the fourth bringing the boat home. */
export const BELL_ANSWERS = ['belfry', 'answer1', 'answer2', 'answer3', 'home'] as const;

/**
 * How hard the chase presses, 0 to 1: the fog's nearness behind her (`gap` metres along its way), less while she
 * walks than while she works a piece, and eased for a while once she is across one (`across` seconds since).
 */
export function chaseTension(gap: number, working: boolean, across: number): number {
  const k = tuning.audio.drownedChase;
  const x = Math.min(1, Math.max(0, (gap - k.near) / (k.far - k.near)));
  return (1 - x * x * (3 - 2 * x)) * (working ? 1 : k.walking) * (1 - k.relief * Math.exp(-across / k.reliefFor));
}
