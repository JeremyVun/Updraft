import { tuning } from '../tuning';

/**
 * Where `mirror.ogg` can stop: 30 ms before each attack that follows a rest, in seconds into the recording. Each rest
 * averages at least 5 dB under the piece's median level over its last 0.3 s, the level falls into it and the next
 * attack rises at least 9 dB out of it; attacks under 2 s apart keep the first. 0.32 is the first note after the
 * loop, so stopping there plays the piece's ending out to silence.
 */
export const MIRROR_SEAMS: readonly number[] = [
  .32, 4.84, 7.22, 9.4, 12.88, 16.26, 18.5, 20.87, 23.06, 25.38, 27.57, 29.89, 32.14, 36.7, 38.95, 41.2, 52.62, 54.95,
  63.63, 81.84, 86.03, 91.34, 100.42, 110.72, 118.62, 136.86, 154.71, 158.51, 164.22, 172.92, 177.09, 191.5, 209.71,
];

/** Seconds from now until the Mirror is silent, and how long it fades into that silence. */
export type MirrorEnding = { at: number; release: number };

/**
 * Leaving the Mirror with its recording `position` seconds in (looping every `length`) and Home due in `homeIn`
 * seconds: the latest seam at least `mirrorSeamLead` before Home, faded into over up to `mirrorFade`; failing that, a
 * `mirrorFade` fade at once.
 */
export function mirrorEnding(position: number, homeIn: number, length: number): MirrorEnding {
  const { mirrorSeamLead, mirrorSeamSoonest, mirrorFade } = tuning.audio;
  const ahead: number[] = [];
  for (const seam of MIRROR_SEAMS) {
    for (let at = ((seam - position) % length + length) % length; at <= homeIn; at += length) {
      if (at >= mirrorSeamSoonest) ahead.push(at);
    }
  }
  ahead.sort((a, b) => a - b);
  const at = ahead.filter(at => at <= homeIn - mirrorSeamLead).at(-1);
  if (at !== undefined) return { at, release: Math.min(mirrorFade, at) };
  const fade = Math.max(0, Math.min(mirrorFade, homeIn));
  return { at: fade, release: fade };
}
