import { tuning } from '../tuning';

/** Each passage of the ending's music starts this long before its attack. */
export const HOME_JUMP_LEAD = .03;

/**
 * Seconds of the ending, timed from the music: its first attack, at the ask's next phrase after the updraft's success,
 * lands `homeJumpAt` in.
 */
export const HOME_ENDING = {
  /**
   * The ending's music: passages of `home.ogg`, each [from, to] in the recording and starting `HOME_JUMP_LEAD` before
   * an attack, played back to back, the first entering mid-phrase. The big low section's first round comes three
   * times, joined attack to attack on the same chord; the minor bridge from 114.8 s is cut, the big section's last rest
   * going straight to the soft pass after it.
   */
  passages: [
    [47.62, 100.545], [86.441, 100.545], [86.441, 114.8], [143.135, Infinity],
  ] as readonly (readonly [number, number])[],
  /** The pan up from the cottage settles on the moon. */
  moonAt: 120.15,
  /** The closing line, as `home.ogg` has rung out (about −64 dB, 175.7 s); the music is cut with it. */
  musicEndsAt: 128.4,
  creditsAt: 128.4,
  reunionAt: 37.067,
  drawingAt: 59.383,
};

/** Where `home.ogg` is `e` seconds into the ending. */
export function homeEndingPosition(e: number): number {
  let at = tuning.audio.homeJumpAt - HOME_JUMP_LEAD;
  for (const [from, to] of HOME_ENDING.passages) {
    if (e < at + to - from) return from + e - at;
    at += to - from;
  }
  return Infinity;
}

/** When, in the ending, the passage after the one sounding at `e` takes over, and where it starts. */
export function homeEndingNext(e: number): { at: number; from: number } | undefined {
  let at = tuning.audio.homeJumpAt - HOME_JUMP_LEAD;
  for (const [i, [from, to]] of HOME_ENDING.passages.entries()) {
    at += to - from;
    const next = HOME_ENDING.passages[i + 1];
    if (next && at > e) return { at, from: next[0] };
  }
  return undefined;
}
