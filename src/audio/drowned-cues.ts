import type { DreamNote } from './dream-score-data';
import { tuning } from '../tuning';

/**
 * The drowned village's music from the air dying to the storm, in the approved drift's B minor, voices and voicings:
 * the water strings' chords, the cello's line, the felt's soft strikes and the undertow. The chase's pulse is the
 * felt in the low strings' register; `tension` keeps a note to the moments the chase presses between those amounts.
 */
export type CueNote = Omit<DreamNote, 'role'> & { role: DreamNote['role'] | 'accompaniment'; tension?: readonly [number, number] };
export interface Cue {
  seconds: number;
  loopFrom?: number;
  chords: { at: number; tones: readonly number[] }[];
  notes: CueNote[];
  variants?: CueNote[][];
}
type Chord = [at: number, tones: readonly number[], hold: number, level: number];

const note = (voice: string, pan: number, role: CueNote['role']) =>
  (at: number, midi: number, duration: number, level: number, tension?: readonly [number, number]): CueNote =>
    ({ voice, at, midi, duration, level, pan, role, ...(tension ? { tension } : {}) });
const cello = note('cello', -.12, 'melody');
const felt = note('felt', .17, 'melody');
const pulse = note('felt', .06, 'accompaniment');
const undertow = note('undertow', 0, 'weather');

/** A chord on the water strings, voiced and weighted as the drift's: the lowest voice a little under the rest. */
function strings([at, tones, hold, level]: Chord): CueNote[] {
  return tones.map((midi, i) => ({ voice: 'water-string', at: at + i * .045, midi, duration: hold + 2.2,
    level: i ? level : level * .78, pan: (i - (tones.length - 1) / 2) * .18, role: 'harmony' }));
}

function cue(seconds: number, chords: Chord[], notes: CueNote[], loopFrom?: number): Cue {
  return {
    seconds, loopFrom, chords: chords.map(([at, tones]) => ({ at, tones })),
    notes: [...chords.flatMap(strings), ...notes].sort((a, b) => a.at - b.at),
  };
}

/**
 * The air dies and the boat sticks: the becalmed phrase's A, F♯ and E over the drift's still chord, then the glass
 * (G), the fog rising on a C that does not belong to the key, and her decision on the dominant. Under it the chase's
 * pulse is born, slow at first and quickening as the cat bolts.
 */
const STUCK = cue(28, [
  [0, [45, 52, 54, 59], 7, .0075],
  [7, [43, 50, 54, 59], 6, .0065],
  [13, [40, 48, 55, 59], 6, .007],
  [19, [42, 49, 52, 59], 4, .007],
  [23, [42, 49, 52, 58], 5, .007],
], [
  undertow(13, 40, 9, .003),
  cello(11.5, 59, 5, .010), cello(16.5, 60, 3.2, .011), cello(19.6, 61, 3.8, .011), cello(23.5, 58, 4.4, .010),
  ...[[11.6, 43], [14.2, 40], [16.6, 40], [18.8, 40], [20.8, 42], [22.6, 42], [24.3, 42], [25.9, 42], [27.3, 42]]
    .map(([at, midi], i) => pulse(at, midi, 2, .0055 + i * .0003)),
], 7);

const BEAT = .8;
/** Two bars a chord; the turn is the dominant's suspension falling to its leading note halfway through. */
const CHASE_CHORDS: [tones: readonly number[], turn?: readonly [number, number]][] = [
  [[47, 54, 62, 64]], [[43, 50, 59, 66]], [[42, 50, 57, 64]], [[45, 52, 59, 62]],
  [[47, 54, 59, 62]], [[43, 50, 59, 64]], [[40, 47, 55, 66]], [[42, 49, 59, 64], [59, 58]],
  [[43, 50, 57, 59]], [[40, 47, 55, 62]], [[42, 47, 54, 62]], [[48, 55, 59, 64]],
  [[49, 57, 59, 64]], [[50, 57, 64, 66]], [[43, 52, 54, 59]], [[42, 49, 52, 59], [59, 58]],
];
/** Each chord's sigh: a step falling onto one of its tones. */
const SIGHS = [[66, 64], [67, 66], [66, 64], [64, 62], [64, 62], [66, 64], [67, 66], [66, 64],
  [61, 59], [64, 62], [64, 62], [66, 64], [66, 64], [67, 66], [61, 59], [66, 64]];
const CALM = [0, .55] as const, QUARTERS = [.3, 2] as const, EIGHTHS = [.62, 2] as const;
const PICKUPS = [.82, 2] as const, TENSE = [.55, 2] as const, SWELL = [.7, 2] as const;
/** The cello while the fog is far or she is across: the drift's D–E–F♯ and B, in beats. */
const CHASE_LINES: [beat: number, midi: number, beats: number][][] = [[
  [1, 66, 4], [5, 64, 2.6], [8, 62, 5], [13, 59, 3], [17, 62, 3], [20, 64, 2.6], [22.5, 66, 4], [27, 64, 3], [30, 62, 3],
  [33, 66, 3.5], [37, 64, 2.6], [40, 62, 4], [44, 64, 3], [48, 67, 4], [52, 66, 4], [56, 64, 4], [60, 61, 3.5],
  [65, 62, 3], [68, 64, 3], [72, 67, 4], [76, 66, 3], [80, 62, 5], [85, 59, 2.6], [88, 64, 4], [92, 59, 3],
  [96, 61, 3], [99, 64, 3], [104, 66, 4], [108, 69, 3], [112, 66, 4], [116, 64, 3], [120, 59, 4], [124, 58, 3.5],
], [
  [2, 62, 5], [9, 64, 5], [17, 66, 6], [25, 59, 6], [34, 62, 4], [40, 59, 5], [48, 64, 6], [56, 66, 4], [60, 64, 3.5],
  [66, 59, 5], [72, 62, 6], [80, 66, 5], [88, 64, 5], [93, 67, 3], [97, 64, 5], [104, 66, 6], [112, 59, 4],
  [116, 62, 3.5], [120, 61, 4], [124, 58, 3.5],
]];

/**
 * Her run over the roofs: a pulse in the low strings' register under a slow round of B minor that climbs by
 * semitones (C, C♯, D) as it goes on. The nearer the fog, the tighter the pulse (half notes, then quarters, eighths and
 * a pickup into each bar) and the more the cello gives way to the felt's falling sighs; across a piece it eases and
 * the cello sings again. Two passes, the second with its own line, before anything repeats.
 */
function chase(): Cue {
  const chords: Chord[] = [], beats: CueNote[] = [], sighs: CueNote[][] = [[], []], swells: CueNote[] = [];
  CHASE_CHORDS.forEach(([tones, turn], c) => {
    const at = c * 8 * BEAT, next = CHASE_CHORDS[(c + 1) % CHASE_CHORDS.length][0];
    if (turn) {
      chords.push([at, tones, 4 * BEAT, .008], [at + 4 * BEAT, tones.map((m) => (m === turn[0] ? turn[1] : m)), 4 * BEAT, .008]);
    } else chords.push([at, tones, 8 * BEAT, .008]);
    const [low, fifth] = tones;
    for (let beat = 0; beat < 8; beat++) {
      const t = at + beat * BEAT;
      beats.push(beat % 2 ? pulse(t, fifth, 2, .0055, QUARTERS) : pulse(t, low, 2, .0075));
      beats.push(pulse(t + BEAT / 2, low + 12, 1.8, .0035, EIGHTHS));
    }
    beats.push(pulse(at + 3.75 * BEAT, low, 1.8, .004, PICKUPS), pulse(at + 7.75 * BEAT, next[0], 1.8, .004, PICKUPS));
    const [high, onto] = SIGHS[c];
    sighs[0].push(felt(at + 4 * BEAT, high, 1.8, .008, TENSE), felt(at + 5 * BEAT, onto, 2.4, .008, TENSE));
    sighs[1].push(felt(at + 6 * BEAT, high, 1.8, .008, TENSE), felt(at + 7 * BEAT, onto, 2.4, .008, TENSE));
    if (c % 4 === 3) swells.push(undertow(at, low, 9, .0035, SWELL));
  });
  const passes = CHASE_LINES.map((line, i) => [...chords.flatMap(strings), ...beats, ...swells, ...sighs[i],
    ...line.map(([beat, midi, held]) => cello(beat * BEAT, midi, held * BEAT, .014, CALM))].sort((a, b) => a.at - b.at));
  return { seconds: CHASE_CHORDS.length * 8 * BEAT, chords: chords.map(([at, tones]) => ({ at, tones })), notes: passes[0], variants: passes };
}

/** She reaches the tower: the pulse slows to nothing and the cello climbs D–E–F♯ with her up the ivy. */
const CLIMB = cue(16, [
  [0, [47, 54, 62, 64], 6.5, .007],
  [6.5, [43, 50, 57, 59], 5.5, .007],
  [12, [42, 50, 57, 64], 4, .007],
], [
  ...[0.3, 1.3, 2.5, 4, 5.8].map((at, i) => pulse(at, 47, 2, .0072 - i * .0007)),
  cello(6.8, 62, 2.6, .012), cello(9, 64, 2.4, .012), cello(11.2, 66, 4.6, .012),
], 6.5);

/**
 * The belfry: the felt's small figure over the kittens, then the fog sea on the bell's own chord (B, D, F♯), and the
 * strings alone turning slowly (G, E minor, B minor) while the bell waits to be rung: nothing to strike against it.
 */
const BELFRY = cue(40.4, [
  [0, [43, 50, 59, 66], 6.4, .0055],
  [6.4, [47, 54, 59, 62], 6, .005],
  [12.4, [43, 50, 59, 66], 7, .005],
  [19.4, [40, 47, 55, 66], 7, .005],
  [26.4, [42, 47, 54, 62], 7, .005],
  [33.4, [47, 54, 62, 64], 7, .005],
], [
  felt(1.2, 66, 1.8, .0075), felt(2, 69, 1.8, .0075), felt(3, 71, 3, .0075), felt(4.6, 69, 2.4, .0065),
  cello(7.5, 54, 5, .008),
], 12.4);

/**
 * Each answer of the lantern turns the harmony a step toward D major (G, E minor, the suspended dominant) and sings
 * the next note of the piano's question (D, E, F♯): the felt strikes it and the cello swells under it, as the glow
 * does. If the next ring is slow in coming, the strings rock between two voicings of the chord.
 */
function answer(tones: readonly number[], rocking: readonly number[], sung: number, level: number): Cue {
  return cue(24, [[0, tones, 8, level], [8, rocking, 8, level], [16, tones, 8, level]],
    [felt(.25, sung, 2.6, .011), cello(.5, sung, 4.5, .011)], 8);
}

/**
 * The fourth answer lands: D major, the felt on B (the bell's own note) completing the question, the cello answering
 * B–F♯–E–D. Then a warm round (G, E minor, the dominant, D) while she climbs down and the boat comes in.
 */
const HOME = cue(41, [
  [0, [38, 50, 57, 62, 66], 9, .009],
  [9, [47, 55, 57, 62], 8, .010],
  [17, [40, 47, 55, 62], 8, .010],
  [25, [45, 52, 55, 62], 4, .010],
  [29, [45, 52, 55, 61], 4, .010],
  [33, [50, 57, 62, 66], 8, .010],
], [
  felt(.25, 71, 3, .011),
  cello(1.6, 66, 2.4, .015), cello(3.6, 64, 2.2, .015), cello(5.4, 62, 5, .015),
  cello(9.8, 59, 3, .015), cello(12.8, 62, 2.2, .015), cello(15, 64, 2.5, .015),
  cello(17.5, 67, 3.5, .014), felt(20, 71, 2.2, .009), cello(21, 66, 2.2, .014), cello(23, 64, 2.5, .014),
  cello(25.5, 62, 3.5, .014), cello(29, 61, 2.4, .014), cello(31, 64, 2.2, .014),
  cello(33.5, 66, 4, .015), felt(36, 69, 2.2, .009), cello(37.5, 62, 3.5, .015),
], 9);

/** Aboard, she looks up: D major held, and at the cat's slow blink the felt rises F♯–A–D, glad, before the storm. */
const FAREWELL = cue(9, [[0, [50, 57, 62, 66], 9, .010]], [
  cello(.8, 57, 4.5, .012),
  felt(2.3, 66, 1.8, .010), felt(2.85, 69, 1.8, .010), felt(3.5, 74, 3, .010),
]);

export type DrownedCuePhase = 'stuck' | 'chase' | 'climb' | 'belfry' | 'answer1' | 'answer2' | 'answer3' | 'home' | 'farewell';
export const DROWNED_CUES: Record<DrownedCuePhase, Cue> = {
  stuck: STUCK, chase: chase(), climb: CLIMB, belfry: BELFRY,
  answer1: answer([43, 50, 59, 66], [43, 52, 59, 62], 62, .006),
  answer2: answer([40, 47, 55, 62, 66], [40, 50, 55, 64], 64, .0065),
  answer3: answer([45, 52, 55, 62], [45, 55, 59, 62], 66, .007),
  home: HOME, farewell: FAREWELL,
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
