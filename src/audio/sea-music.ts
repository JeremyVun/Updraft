import { PhraseClips, type Clip } from './phrase-clips';

/**
 * Cut points in the supplied `sea.ogg` ("Another Shore"), each just before the next attack. The crossing runs to the
 * near-silent break before the bass enters; the rescue takes the four two-bar phrases of the high, wind-like section
 * that follows the bass, back to back in the recording, and the release the closing build from 2:39.
 * Each is [from, to, fade out].
 */
export const SEA_INTRO_END = 56.43;
/** Nothing at rest; then the net lifting off the blowhole, the fold off its eye, her first pull, the cygnet's pull; free. */
export const SEA_PHRASES: readonly (readonly [number, number, number] | null)[] = [
  null, [129.93, 136.3, .4], [136.3, 143.1, .4], [143.1, 150, .4], [150, 159.47, .4], [159.47, Infinity, 0],
];
const INTRO_FADE = .3;

type Placed = { clip: Clip; to: number; fade: number; end: number };

/**
 * The open sea's recording. The crossing plays from the passage clock to the break, timed so it ends as the boat comes
 * to rest beside the whale; the rescue is silent but for one phrase as each of its acts begins, and the release plays
 * the recording's close through to the Mirror. Phrases never overlap or cut each other: one asked for while another
 * sounds waits for it, and since they follow each other in the recording, a waiting phrase joins the last without a
 * seam, so a quick rescue plays the recording as written.
 */
export class SeaMusic extends PhraseClips {
  private introTried = false;
  /** The latest phrase the rescue has reached; null before the first update. */
  private heard: number | null = null;
  /** The latest phrase played or passed over. */
  private placed = -1;
  private last: Placed | null = null;

  constructor(ctx: BaseAudioContext, output: AudioNode) {
    super(ctx, SeaMusic.bus(ctx, output), 'sea');
  }

  private static bus(ctx: BaseAudioContext, output: AudioNode): GainNode {
    const bus = ctx.createGain();
    bus.gain.value = 0;
    bus.connect(output);
    return bus;
  }

  /**
   * `time` is recording time on the passage clock (negative before it begins); `phrase` is -1 coming in, 0 at rest
   * and one more as each act of the rescue begins, to 5 once free. A save resuming mid-rescue waits for the next act;
   * once free it plays the close at once.
   */
  update(time: number, phrase: number, level: number): void {
    if (this.stopped) return;
    const now = this.ctx.currentTime, bus = (this.output as GainNode).gain;
    if (this.heard === null) {
      bus.setValueAtTime(level, now);
      this.placed = phrase >= 5 ? phrase - 1 : phrase;
    } else bus.setTargetAtTime(level, now, .25);
    this.heard = Math.max(this.heard ?? phrase, phrase);
    if (!this.buffer) return;
    if (!this.introTried && time >= 0) {
      this.introTried = true;
      // Within a frame or two of its start it begins from the top; a later start joins the passage's own time.
      const from = time < .1 ? 0 : time;
      if (from < SEA_INTRO_END - 1 && phrase < 0) this.play(from, SEA_INTRO_END, 1, INTRO_FADE, now, from ? .5 : .01);
    }
    while (this.placed < this.heard) {
      const cut = SEA_PHRASES[this.placed + 1];
      if (!cut) { this.placed++; continue; }
      const last = this.last && this.voices.has(this.last.clip) && !this.last.clip.finishing ? this.last : null;
      let at = now;
      if (last && last.to === cut[0]) {
        // Carry straight on: drop the last phrase's fade so the recording runs on unbroken.
        at = Math.max(now, last.end);
        last.clip.gain.gain.cancelScheduledValues(Math.max(now, last.end - last.fade - 1e-3));
      } else if (this.voices.size) return;
      const clip = this.play(cut[0], cut[1], 1, cut[2], at, at > now ? 1e-3 : .01);
      if (!clip) return;
      this.placed++;
      this.last = { clip, to: cut[1], fade: cut[2], end: at + Math.min(cut[1], this.buffer.duration) - cut[0] };
    }
  }
}
