export interface QualityLevel {
  /** Render scale, in device pixels per CSS pixel. */
  ratio: number;
  /** Multisampling of the scene target. */
  samples: number;
}

const RECENT = 90;
/** Pixels the opening level may render; the level climbs from there if frames prove smooth. */
const OPENING_PIXELS = 2.2e6;
/** Trimmed mean interval above which the frame is judged over budget (a saturated GPU alternates 16.7 and 33 ms). */
const SLOW_MS = 17.6;
const SMOOTH_MS = 17.2;
const REVIEW_MS = 1500;
const SETTLE_MS = 2500;
const CLIMB_MS = 12000;

/**
 * Keeps the frame under the display's refresh by stepping the render scale down (then the multisampling)
 * when frames run long, and creeping back up after a long smooth stretch. It judges by the trimmed mean and
 * the 90th percentile of recent frame intervals, so a single hitch (a window move, a tab switch) never costs
 * quality, while a GPU that misses every other refresh is caught at once.
 */
export class Quality {
  private readonly levels: QualityLevel[] = [];
  private index = 0;
  private readonly recent: number[] = [];
  private changedAt = 0;
  private smoothSince = 0;
  private lastReview = 0;
  private climbMs = CLIMB_MS;
  private lastStepUp = false;

  /** Opens at the highest level within the pixel budget for a `width` × `height` view (and `startRatio`); the rest is climbed into. */
  constructor(maxRatio: number, samples: number, width: number, height: number, startRatio: number, private readonly locked: boolean, private readonly apply: (level: QualityLevel) => void) {
    if (!location.search.includes('nocap')) startRatio = Math.min(startRatio, Math.sqrt(OPENING_PIXELS / Math.max(1, width * height)));
    for (let ratio = maxRatio; ratio > 1; ratio = Math.max(1, ratio - 0.25)) this.levels.push({ ratio, samples });
    this.levels.push({ ratio: 1, samples });
    if (samples > 2) this.levels.push({ ratio: 1, samples: 2 });
    /**
     * Below one device pixel per pixel, and softer for it. Only a machine that is already missing every other
     * refresh ever gets here, and in a game this slow a soft frame that arrives is worth more than a sharp one
     * that does not: a saturated GPU also starves the readbacks the wind and the life are read back through.
     */
    this.levels.push({ ratio: 0.85, samples: Math.min(samples, 2) });
    this.levels.push({ ratio: 0.72, samples: Math.min(samples, 2) });
    this.index = Math.max(0, this.levels.findIndex((l) => l.ratio <= startRatio));
  }

  get level(): QualityLevel {
    return this.levels[this.index];
  }

  /** Records one real frame interval; may change the level (calling `apply`) about every 1.5 s. */
  frame(now: number, intervalMs: number): void {
    if (this.locked) return;
    this.recent.push(intervalMs);
    if (this.recent.length > RECENT) this.recent.shift();
    if (now - this.lastReview < REVIEW_MS || now - this.changedAt < SETTLE_MS || this.recent.length < 8) return;
    this.lastReview = now;
    const sorted = [...this.recent].sort((a, b) => a - b);
    const kept = sorted.slice(0, Math.max(1, Math.floor(sorted.length * 0.95)));
    const mean = kept.reduce((a, b) => a + b, 0) / kept.length;
    const p90 = sorted[Math.floor(sorted.length * 0.9)];
    if (mean > SLOW_MS) {
      this.smoothSince = now;
      const step = mean > SLOW_MS * 1.5 ? 2 : 1;
      if (this.index < this.levels.length - 1) this.change(now, Math.min(this.levels.length - 1, this.index + step));
    } else if (p90 > SMOOTH_MS) {
      this.smoothSince = now;
    } else if (now - this.smoothSince > this.climbMs && this.index > 0) {
      this.change(now, this.index - 1);
    }
  }

  /** A step down that undoes a recent step up doubles the wait before the next climb, so levels never oscillate. */
  private change(now: number, index: number): void {
    const up = index < this.index;
    if (!up && this.lastStepUp) this.climbMs = Math.min(this.climbMs * 2, 120000);
    this.lastStepUp = up;
    this.index = index;
    this.changedAt = now;
    this.smoothSince = now;
    this.recent.length = 0;
    this.apply(this.level);
  }
}
