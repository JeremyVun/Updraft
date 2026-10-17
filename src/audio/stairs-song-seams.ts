import { tuning } from '../tuning';

/**
 * Where the stairs song (`birches.ogg`) can stop, measured as `MIRROR_SEAMS` were: 30 ms before each attack out of a
 * rest at least 5 dB under the piece's median level over its last 0.3 s, the level falling into it and the next attack
 * rising at least 9 dB out of it; attacks under 2 s apart keep the first. 0.69 is the first note after the loop, so
 * stopping there plays the piece's ending out to silence.
 */
export const STAIRS_SONG_SEAMS: readonly number[] = [
  .69, 3.6, 7.79, 13.78, 16.93, 22.15, 24.97, 33, 39.83, 55.39, 58.53, 62.14, 65.47, 68.7, 71.98, 75.86, 84.65, 92.48,
  99.98, 103.88, 109.33, 114.02, 118.1, 121.91, 127.52, 131.2, 135.18, 138.63, 142.69, 147.06, 154.51, 162.17, 169.84,
  179, 182.88, 186.14, 189.8, 193.1, 197.43, 201.39, 204.44, 208.6, 212.73, 216.78,
];

/** The seams that close a phrase: the rest at least 14 dB under the median, and over the second before it at least 5 dB under. */
export const STAIRS_SONG_PHRASE_ENDS: readonly number[] = [.69, 24.97, 33, 58.53, 75.86, 109.33, 127.52, 147.06, 179];

/**
 * Reaching the landing below the white with the song `position` seconds in (looping every `length`): seconds from now
 * until it is silent and how long it fades into that. Its next phrase end within `stairsSongSeamWithin` rings out by
 * itself, held to `mirrorSeamRelease`; failing that its next seam, the figure under way faded into its rest over up to
 * `stairsSongEndFade`; failing both, one long fade over the whole of that time. Seams sooner than `mirrorSeamSoonest`
 * are passed over.
 */
export function stairsSongEnding(position: number, length: number): { at: number; release: number } {
  const { stairsSongSeamWithin: within, mirrorSeamSoonest: soonest, mirrorSeamRelease, stairsSongEndFade } = tuning.audio;
  const next = (seams: readonly number[]) => seams.map(seam => ((seam - position) % length + length) % length)
    .filter(at => at >= soonest && at <= within).sort((a, b) => a - b)[0];
  const phrase = next(STAIRS_SONG_PHRASE_ENDS);
  if (phrase !== undefined) return { at: phrase, release: Math.min(mirrorSeamRelease, phrase) };
  const seam = next(STAIRS_SONG_SEAMS);
  return seam === undefined ? { at: within, release: within } : { at: seam, release: Math.min(stairsSongEndFade, seam) };
}
