import { PhraseClips, type Clip } from './phrase-clips';
import { tuning } from '../tuning';

/**
 * Cut points in the supplied `sea.ogg` ("Another Shore"), each just before the next attack. The crossing runs to the
 * near-silent break before the bass enters; five four-bar phrases follow, then the recording's closing section.
 */
export const SEA_INTRO_END = 56.43;
/** The crossing's last note has died away by here: a rest at the whale from now on may cut the break short. */
export const SEA_BREAK = 54.5;
/** At rest (A), then after the breath, eye, line and heave (B to E), then free: [from, to, fade out]. */
export const SEA_PHRASES: readonly (readonly [number, number, number])[] = [
  [56.43, 70.94, .4], [70.94, 85.245, .4], [85.245, 98.885, .4], [98.885, 112.385, .4], [112.385, 129.93, 1.5],
  [159.47, Infinity, 0],
];
const INTRO_FADE = .3;

/**
 * The open sea's recording. The crossing plays from the passage clock up to the break, then waits in silence for the
 * boat to rest beside the whale; each step of the rescue then plays its own phrase once, and the release the
 * recording's close through to the Mirror. Clips overlap a previous tail only by Still's spacing rule.
 */
export class SeaMusic extends PhraseClips {
  private intro: Clip | null = null;
  private introFrom = 0;
  private introTried = false;
  /** The latest phrase the rescue has reached that has played or been passed over; null before the first update. */
  private heard: number | null = null;
  private pending = -1;

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
   * and one more with each completed step to 5 once free. A save or a late start resuming mid-rescue waits for the
   * next step; at rest or once free it plays that phrase at once.
   */
  update(time: number, phrase: number, level: number): void {
    if (this.stopped) return;
    const now = this.ctx.currentTime, bus = (this.output as GainNode).gain;
    if (this.heard === null) {
      bus.setValueAtTime(level, now);
      this.heard = phrase >= 1 && phrase <= 4 ? phrase : phrase - 1;
    } else bus.setTargetAtTime(level, now, .25);
    if (phrase > this.heard) { this.heard = phrase; this.pending = phrase; }
    if (!this.buffer) return;
    if (!this.introTried && time >= 0) {
      this.introTried = true;
      if (time < SEA_BREAK && this.heard <= 0) {
        // Within a frame or two of its start it begins from the top; a later start joins the passage's own time.
        this.introFrom = time < .1 ? 0 : time;
        this.intro = this.play(this.introFrom, SEA_INTRO_END, 1, INTRO_FADE, now, this.introFrom ? .5 : .01);
      }
    }
    if (this.pending < 0) return;
    const [from, to, fade] = SEA_PHRASES[this.pending];
    if (this.pending === 0 && this.intro && this.voices.has(this.intro) && !this.intro.finishing) {
      const position = this.introFrom + now - this.intro.at;
      if (position < SEA_BREAK) {
        // Still in the crossing's phrases: A follows them on the recording's own beat.
        this.intro = null; this.pending = -1;
        this.play(from, to, 1, fade, now + SEA_INTRO_END - position);
        return;
      }
      this.release(this.intro, INTRO_FADE);
      this.intro = null;
    } else if (!this.canStart(tuning.audio.seaPhraseSpacing, true)) return;
    this.pending = -1;
    this.play(from, to, 1, fade);
  }
}
