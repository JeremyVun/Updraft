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

/** Her recorded answer, played whole at its own tempo once the guide is followed. */
export interface MeadowAnswer {
  readonly index: number;
  readonly clip: DuetClip;
  /** Seconds into the recording that it has rung down. */
  readonly end: number;
  /** Its notes' onsets and melody keys, which her hands and the keys follow. */
  readonly notes: readonly { readonly at: number; readonly midi: number }[];
  /** The melody's overall rise (positive) or fall, −1..1, which tilts the guide. */
  readonly tilt: number;
}

/** The recording starts this long before its first sound, so the flute is heard as the inhale ends. */
const LEAD = 0.05;
const phrase = (m: { at: number; duration: number; gainDb: number; attack: number; end: number }): WindPhrase => {
  const startAt = -Math.min(tuning.windBough.inhale, Math.max(0, m.attack - LEAD));
  return { duration: m.end + startAt, startAt, clip: { at: m.at, duration: m.duration, gainDb: m.gainDb } };
};

export const MEADOW_ANSWERS: readonly MeadowAnswer[] = MEADOW_MEASURED.answers.map((a, index) => ({
  index, clip: { at: a.at, duration: a.duration, gainDb: a.gainDb }, end: a.end, notes: a.notes, tilt: a.tilt,
}));

export const MEADOW_CALLS: readonly { call: WindPhrase; reply: MeadowAnswer }[] =
  MEADOW_MEASURED.calls.map((call, i) => ({ call: phrase(call), reply: MEADOW_ANSWERS[i] }));

/** `greenAt` is from the end of the inhale, like `duration`: the colour front starts on the arpeggio's arrival. */
export const MEADOW_FINALE: WindPhrase & { readonly greenAt: number } = (() => {
  const finale = phrase(MEADOW_MEASURED.finale);
  return { ...finale, greenAt: finale.startAt + MEADOW_MEASURED.finale.greenAt };
})();

/** The cygnet's footfalls on the keys: single recorded notes of the finale's chord, low to high. */
export const MEADOW_STEPS: readonly (DuetClip & { readonly midi: number })[] = MEADOW_MEASURED.steps;
