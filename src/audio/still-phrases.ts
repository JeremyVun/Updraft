import { PhraseClips } from './phrase-clips';
import { tuning } from '../tuning';

// Quiet gaps in the supplied recording. The later material belongs to the crossing.
export const STILL_PHRASES: readonly (readonly [number, number])[] = [
  [.69, 9.55], [9.65, 19.31], [19.41, 27.40], [27.50, 34.40],
  [34.50, 41.65], [41.75, 49.64], [49.74, 57.39], [57.49, 65.51],
  [65.61, 73.71], [73.81, 81.61], [81.71, 89.71], [89.81, 98.34],
  [98.44, 107.53], [107.63, 116.90],
];
export const STILL_CROSSING = [117, 175.20] as const;

export class StillPhrases extends PhraseClips {
  private next = 0;
  private lastPhraseAt = -Infinity;
  private crossingStarted = false;

  constructor(ctx: BaseAudioContext, output: AudioNode) {
    super(ctx, output, 'still');
  }

  trigger(spacing = tuning.audio.stillPhraseSpacing): boolean {
    if (this.crossingStarted || this.ctx.currentTime - this.lastPhraseAt < spacing) return false;
    const [from, to] = STILL_PHRASES[this.next];
    if (!this.canStart(tuning.audio.stillPhraseSpacing, true) || !this.excerpt(from, to)) return false;
    this.lastPhraseAt = this.ctx.currentTime;
    this.next = (this.next + 1) % STILL_PHRASES.length;
    return true;
  }

  crossing(elapsed: number): void {
    if (elapsed < 0) { this.finish(); return; }
    if (this.crossingStarted) return;
    const [from, to] = STILL_CROSSING;
    if (elapsed >= to - from) { this.crossingStarted = true; return; }
    if (this.canStart(0, false) && this.excerpt(from + elapsed, to)) this.crossingStarted = true;
  }

  private excerpt(from: number, to: number): boolean {
    return !!this.play(from, to, 10 ** (tuning.audio.stillPhraseDb / 20), tuning.audio.stillPhraseFade);
  }

  finish(fade = tuning.audio.stillPhraseFade): void { super.finish(fade); }

  stop(fade = tuning.audio.stillPhraseFade): void { super.stop(fade); }
}
