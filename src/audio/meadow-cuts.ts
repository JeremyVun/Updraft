/**
 * The meadow's recorded music, cut from four source takes. Swapping a take or a cut is an edit here and a rerun of
 * `node tools/meadow-music-cuts.mjs`, which writes the cut files into `assets/music/` and their measurements into
 * `meadow-cuts-measured.ts`. Times are seconds in the source. Edges fade over 20 ms unless `fadeOut` says otherwise;
 * `cents` retunes a cut by varispeed toward the answers' tuning.
 */
export const MEADOW_SOURCES = {
  flute: 'flute_meadow_phrases.ogg',
  B: 'A Light Left On - A Light Left On - Sleeping Meadow - Treblo (Reference 2) - Treblo (1).ogg',
  E: 'A Light Left On - A Light Left On - Sleeping Meadow - Treblo (Reference 2) - Treblo (3).ogg',
  O: 'A Light Left On - Sleeping Meadow - Treblo.ogg',
} as const;

export type MeadowSource = keyof typeof MEADOW_SOURCES;
export interface MeadowCut { source: MeadowSource; from: number; to: number; fadeOut?: number; cents?: number }

/** The room reference every main section is levelled to (`docs/contracts/audio.md`, Room levels). */
export const MEADOW_REFERENCE_LUFS = -29;

export const MEADOW_CUTS = {
  /** Landing to the stool: the sad opening, repeated with a rest between. */
  walk: { file: 'meadow-walk.ogg', rest: 3, cuts: [{ source: 'O', from: 0, to: 27.2 }] },
  /** The bough's four calls, dark to bright. The first is cut where the take runs on into its next phrase. */
  calls: { file: 'meadow-duet.ogg', cuts: [
    { source: 'flute', from: 50.1, to: 57.9, fadeOut: 0.35, cents: 20 },
    { source: 'flute', from: 34.5, to: 42.1, cents: 24 },
    { source: 'flute', from: 0, to: 5.6 },
    { source: 'flute', from: 5.6, to: 13.3 },
  ] },
  /** Her four answers, sliced at their note onsets; each rings on with its own tail. */
  answers: { file: 'meadow-duet.ogg', ring: 2, cuts: [
    { source: 'B', from: 0, to: 5.6, fadeOut: 0.8 },
    { source: 'B', from: 6.1, to: 11.4, fadeOut: 0.8 },
    { source: 'B', from: 12.0, to: 17.6, fadeOut: 0.8 },
    { source: 'B', from: 18.4, to: 24.2, fadeOut: 0.8 },
  ] },
  /**
   * The finale under the greening: a rising A♭-major arpeggio, then a long held close. `greenAt` (seconds in the
   * source) pins the colour front; left out, it is the measured arrival at the top of the opening arpeggio.
   */
  finale: { file: 'meadow-duet.ogg', cuts: [{ source: 'flute', from: 93.2, to: 124.0 }] as MeadowCut[], greenAt: undefined as number | undefined },
  /** Flowers and seeds until the listening rest, repeated with a rest between. */
  after: { file: 'meadow-after.ogg', rest: 5, cuts: [{ source: 'E', from: 22.6, to: 119.6 }] },
  /** From the feather to the boat, once. The take swells into a hard stop, so its last seconds fade. */
  ending: { file: 'meadow-ending.ogg', cuts: [{ source: 'E', from: 119.6, to: 155.9, fadeOut: 3 }] },
} satisfies Record<string, { file: string; cuts: MeadowCut[]; rest?: number; ring?: number; greenAt?: number }>;

export type MeadowBeat = keyof typeof MEADOW_CUTS;
