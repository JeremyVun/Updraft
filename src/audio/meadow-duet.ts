import { MEADOW_MEASURED } from './meadow-cuts-measured';
import { tuning } from '../tuning';

/** Where a recorded phrase lies in `meadow-duet.ogg`, and the gain that brings it to the room reference. */
export interface DuetClip { readonly at: number; readonly duration: number; readonly gainDb: number }

/** A bough phrase: the flute recording it sounds, timed from the end of the bough's inhale. */
export interface WindPhrase {
  /** Seconds from the end of the inhale until the flute has finished. */
  readonly duration: number;
  /** Seconds from the end of the inhale that the recording starts; negative where its first breath falls in the inhale. */
  readonly startAt: number;
  readonly clip: DuetClip;
}

/** One note of a traced answer: the recording from just before its onset, ringing on, and the key it is. */
export interface AnswerNote extends DuetClip {
  /** The share of the trace that sounds it. */
  readonly share: number;
  readonly midi: number;
}

export interface MeadowAnswer {
  readonly index: number;
  readonly notes: readonly AnswerNote[];
  /** The outline she traces, as (share of the trace, height −1..1) points along the answer's melody. */
  readonly outline: readonly (readonly [number, number])[];
  /** Up the keyboard or down it: the mirrored sweeps alternate. */
  readonly direction: 1 | -1;
}

/** The recording starts this long before its first sound, so the flute is heard as the inhale ends. */
const LEAD = 0.05;
const phrase = (m: { at: number; duration: number; gainDb: number; attack: number; end: number }): WindPhrase => {
  const startAt = -Math.min(tuning.windBough.inhale, Math.max(0, m.attack - LEAD));
  return { duration: m.end + startAt, startAt, clip: { at: m.at, duration: m.duration, gainDb: m.gainDb } };
};

export const MEADOW_ANSWERS: readonly MeadowAnswer[] = MEADOW_MEASURED.answers.map((a, index) => ({
  index,
  notes: a.slices.map(s => ({ at: s.at, duration: s.duration, gainDb: a.gainDb, share: s.share, midi: s.midi })),
  outline: a.points.map(([share, height]) => [share, height] as const),
  direction: index % 2 === 0 ? 1 : -1,
}));

export const MEADOW_CALLS: readonly { call: WindPhrase; reply: MeadowAnswer }[] =
  MEADOW_MEASURED.calls.map((call, i) => ({ call: phrase(call), reply: MEADOW_ANSWERS[i] }));

/** `greenAt` is from the end of the inhale, like `duration`: the colour front starts on the arpeggio's arrival. */
export const MEADOW_FINALE: WindPhrase & { readonly greenAt: number } = (() => {
  const finale = phrase(MEADOW_MEASURED.finale);
  return { ...finale, greenAt: finale.startAt + MEADOW_MEASURED.finale.greenAt };
})();
