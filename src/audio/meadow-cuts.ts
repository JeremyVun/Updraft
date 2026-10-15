/**
 * The meadow's recorded music, cut from four source takes. Swapping a take or a cut is an edit here and a rerun of
 * `node tools/meadow-music-cuts.mjs`, which writes the cut files into `assets/music/` and their measurements into
 * `meadow-cuts-measured.ts`. Times are seconds in the source. Edges fade over 20 ms unless `fadeOut` says otherwise;
 * `cents` retunes a cut by varispeed toward the answers' tuning.
 */
export const MEADOW_SOURCES = {
  flute: 'flute_meadow_phrases.ogg',
  B: 'A Light Left On - A Light Left On - Sleeping Meadow - Treblo (Reference 2) - Treblo (1).ogg',
  /** Take E (`…Reference 2) - Treblo (3).ogg`) as Jeremy extended it: identical to about 1:55, then new music to a soft close. */
  E: 'meadow_extended.ogg',
  O: 'A Light Left On - Sleeping Meadow - Treblo.ogg',
} as const;

export type MeadowSource = keyof typeof MEADOW_SOURCES;
export interface MeadowCut { source: MeadowSource; from: number; to: number; fadeOut?: number; cents?: number; midi?: number }

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
  /** Her four answers, each played whole at its own tempo once the guide is followed; her hands follow its onsets. */
  answers: { file: 'meadow-duet.ogg', cuts: [
    { source: 'B', from: 0, to: 5.6, fadeOut: 0.8 },
    { source: 'B', from: 6.1, to: 11.4, fadeOut: 0.8 },
    { source: 'B', from: 12.0, to: 17.6, fadeOut: 0.8 },
    { source: 'B', from: 18.4, to: 24.2, fadeOut: 0.8 },
  ] },
  /**
   * The cygnet's steps on the keys under the finale: single notes of the finale's chord (A♭ major) from the answers'
   * take, each from just before its attack to just before the next note. The A♭ rings over the C before it.
   */
  steps: { file: 'meadow-duet.ogg', cuts: [
    { source: 'B', from: 0.2, to: 0.566, fadeOut: 0.1, midi: 60 },
    { source: 'B', from: 0.566, to: 0.831, fadeOut: 0.1, midi: 68 },
    { source: 'B', from: 87.325, to: 87.826, fadeOut: 0.12, midi: 75 },
  ] },
  /**
   * The finale under the greening: a rising A♭-major arpeggio, then a long held close. `greenAt` (seconds in the
   * source) pins the colour front; left out, it is the measured arrival at the top of the opening arpeggio.
   */
  finale: { file: 'meadow-duet.ogg', cuts: [{ source: 'flute', from: 93.2, to: 124.0 }] as MeadowCut[], greenAt: undefined as number | undefined },
  /**
   * Flowers and seeds until the listening rest: from 0:22.60 to 2:53.05, then round and round from 1:36.60 with no
   * rest. The last `crossfade` seconds before the loop's end carry the music leading into its start (equal power),
   * so the native loop is seamless.
   */
  after: { file: 'meadow-after.ogg', cuts: [{ source: 'E', from: 22.6, to: 173.05, fadeOut: 0 }], loop: { from: 96.6, crossfade: 0.6 } },
  /** From the feather to the boat, once. The take's tail is still sounding (−47 dB) at its very end, so it fades. */
  ending: { file: 'meadow-ending.ogg', cuts: [{ source: 'E', from: 196.3, to: Infinity, fadeOut: 0.5 }] },
} satisfies Record<string, { file: string; cuts: MeadowCut[]; rest?: number; greenAt?: number; loop?: { from: number; crossfade: number } }>;

export type MeadowBeat = keyof typeof MEADOW_CUTS;
