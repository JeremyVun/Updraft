import { tuning } from '../tuning';

/**
 * Where `home.ogg` can stop, measured as `MIRROR_SEAMS` were: 30 ms before each attack out of a rest at least 5 dB under
 * the piece's median level over its last 0.3 s, the level not rising into it and the attack at least 9 dB over it;
 * attacks under 2 s apart keep the first. The full sections from 86.4 s and 114.8 s have none. The file's end, rung out
 * to silence, also serves.
 */
export const HOME_SEAMS: readonly number[] = [
  4.05, 7.86, 11.6, 18.95, 22.57, 25.3, 29.95, 36.77, 39.69, 42.08, 47.62, 50.28, 53.78, 58.14, 61.78, 65.25, 68.81,
  72.36, 82.86, 86.4, 114.8, 146.41, 149.95, 153.5, 157.13, 164.46, 168.22,
];

/**
 * The whole piece turns on one four-bar cycle, C, D, A♭, G, at 68 bpm (about 14.2 s a pass). These are the seams where
 * a pass has ended, out of a rest, so the cycle's own opening can follow any of them; the file's end, rung out on G,
 * also serves.
 */
export const HOME_CYCLE_SEAMS: readonly number[] = [29.95, 43.82, 58.14, 72.36, 86.4, 114.8, 157.13];

/**
 * While the cygnet asks, Home plays its own quiet opening, the cycle's first two passes from 30 ms before the file's
 * first note to the seam before the third, over and over: both ends sit in rests.
 */
export const HOME_ASK = { from: .16, to: 29.95 } as const;
/**
 * Where the ask hands over to the ending: its seams, and the bar line where its second pass reaches C with no rest
 * between, which it breathes into over `homeBreathRelease`.
 */
const ASK_EXITS: readonly number[] = [HOME_ASK.from, 4.05, 7.86, 11.6, 15.26, 18.95, 22.57, 25.3];
const ASK_BREATH = 15.26;

/** Seconds from now until Home is silent, and how long it fades into that silence. */
export type HomeEnding = { at: number; release: number };

/**
 * With the recording `position` seconds in (looping every `length`): its next seam at least `mirrorSeamSoonest` ahead
 * if one comes within `within`, faded into over up to `mirrorSeamRelease`; otherwise a `fade` from now.
 */
export function homeEnding(position: number, length: number, within: number, fade: number): HomeEnding {
  const { mirrorSeamSoonest, mirrorSeamRelease } = tuning.audio;
  const into = position % length;
  const at = [...HOME_SEAMS, length, ...HOME_SEAMS.map(seam => seam + length)]
    .map(seam => seam - into).find(at => at >= mirrorSeamSoonest);
  return at !== undefined && at <= within ? { at, release: Math.min(mirrorSeamRelease, at) } : { at: fade, release: fade };
}

/**
 * Seconds from now to the first cycle seam from `homeAskEarly` before the set-down, `expected` seconds ahead, to
 * `homeAskWithin` after it, and at least `mirrorSeamSoonest` ahead; undefined if none comes then.
 */
export function homeAskEntry(position: number, length: number, expected: number): number | undefined {
  const { mirrorSeamSoonest, homeAskEarly, homeAskWithin } = tuning.audio;
  const into = position % length;
  const seams = [...HOME_CYCLE_SEAMS, length];
  return [...seams, ...seams.map(seam => seam + length)].map(seam => seam - into)
    .find(at => at >= Math.max(mirrorSeamSoonest, expected - homeAskEarly) && at <= expected + homeAskWithin);
}

/**
 * The ask's exits on the audio clock for a loop begun at `askAt`, its first exit being that moment itself, in order
 * from `after`, each with how long it fades into it.
 */
function* askExits(askAt: number, after: number): Generator<{ at: number; release: number }> {
  const length = HOME_ASK.to - HOME_ASK.from;
  for (let pass = Math.max(0, Math.floor((after - askAt) / length)); ; pass++) {
    for (const exit of ASK_EXITS) {
      const at = askAt + pass * length + exit - HOME_ASK.from;
      if (at >= after) yield { at, release: exit === ASK_BREATH ? tuning.audio.homeBreathRelease : tuning.audio.homeSeamCut };
    }
  }
}

/** The ask's first exit at or after `from`. */
export function homeAskExit(askAt: number, from: number): { at: number; release: number } {
  return askExits(askAt, from).next().value!;
}

/** The ask's exit within `homeExitSnap` of `wanted`, if it is still ahead of `now`. */
export function homeAskExitNear(askAt: number, now: number, wanted: number): { at: number; release: number } | undefined {
  const exit = askExits(askAt, Math.max(now + .01, wanted - tuning.audio.homeExitSnap)).next().value!;
  return Math.abs(exit.at - wanted) <= tuning.audio.homeExitSnap ? exit : undefined;
}
