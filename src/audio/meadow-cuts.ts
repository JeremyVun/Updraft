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
export interface MeadowCut {
  source: MeadowSource; from: number; to: number; fadeOut?: number; cents?: number; midi?: number;
  /**
   * `to` is the attack of the take's next phrase. The cut keeps the take until just before it, then its sound rings on
   * at the decay measured between the take's phrases, down to the take's own silence.
   */
  ringOut?: boolean;
  /** `to` is the attack of the take's next phrase: over this many seconds before it, the note ends as the take's phrases end. */
  release?: number;
}

/** The room reference every main section is levelled to (`docs/contracts/audio.md`, Room levels). */
export const MEADOW_REFERENCE_LUFS = -29;

export const MEADOW_CUTS = {
  /** Landing to the stool: the sad opening, repeated with a rest between. */
  walk: { file: 'meadow-walk.ogg', rest: 3, cuts: [{ source: 'O', from: 0, to: 27.2 }] },
  /** The bough's four calls, dark to bright. The first is held into the take's next phrase, so it is ended there. */
  calls: { file: 'meadow-duet.ogg', cuts: [
    { source: 'flute', from: 50.1, to: 57.84, release: 1.4, fadeOut: 0.3, cents: 20 },
    { source: 'flute', from: 34.5, to: 42.1, cents: 24 },
    { source: 'flute', from: 0, to: 5.6 },
    { source: 'flute', from: 5.6, to: 13.3 },
  ] },
  /**
   * Her four answers, each played whole at its own tempo once the guide is followed; her hands follow its onsets. The
   * take goes straight on from one to the next, so each rings out past where the next began.
   */
  answers: { file: 'meadow-duet.ogg', cuts: [
    { source: 'B', from: 0, to: 6.335, ringOut: true },
    { source: 'B', from: 6.1, to: 12.24, ringOut: true },
    { source: 'B', from: 12.0, to: 18.62, ringOut: true },
    { source: 'B', from: 18.4, to: 24.395, ringOut: true },
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
   * From the duet to the boat: from 0:22.60 to 2:53.05, then round and round from 1:36.60 with no rest. The last
   * `crossfade` seconds before the loop's end carry the music leading into its start (equal power), so the native loop
   * is seamless. Leaving, it goes over at a phrase end into `close`, the cadence the take ends on, which stops at `to` as
   * its last chord dies away, fading over `fadeOut`: after it the take has a low synth swell from generation, not music.
   */
  after: { file: 'meadow-after.ogg', cuts: [{ source: 'E', from: 22.6, to: 173.05, fadeOut: 0 }], loop: { from: 96.6, crossfade: 0.6 },
    close: { from: 223.6, to: 230.8, fadeOut: 2 } },
} satisfies Record<string, { file: string; cuts: MeadowCut[]; rest?: number; greenAt?: number; loop?: { from: number; crossfade: number };
  close?: { from: number; to: number; fadeOut: number } }>;

export type MeadowBeat = keyof typeof MEADOW_CUTS;
