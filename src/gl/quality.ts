export interface QualityLevel {
  /** Render scale, in device pixels per CSS pixel. */
  ratio: number;
  /** Multisampling of the scene target. */
  samples: number;
  /** Geometry and reflection budget, independent of input hardware. */
  detail: 0 | 1 | 2;
  /** Auto's final fallback can thin grass beyond the player-facing Low preset. */
  grassDensity?: number;
  grassReach?: number;
}

export type QualityMode = 'auto' | 'high' | 'medium' | 'low';

export const WORLD_QUALITY = [
  { grassDensity: 0.55, grassReach: 0.85, terrainSplit: 1.1, mirrorEvery: 2, mirrorScale: 0.5 },
  { grassDensity: 0.8, grassReach: 0.95, terrainSplit: 1.35, mirrorEvery: 1, mirrorScale: 0.625 },
  { grassDensity: 1, grassReach: 1, terrainSplit: 1.6, mirrorEvery: 1, mirrorScale: 0.75 },
] as const;

const RECENT = 90;
/** Sustained Auto budget. Smooth vsync alone is not evidence of spare power. */
const AUTO_PIXELS = 2.4e6;
/** Auto's pixel-budget rung for very large viewports never renders softer than this. */
const MIN_BUDGET_RATIO = 0.5;
/** Trimmed mean interval above which the frame is judged over budget (a saturated GPU alternates 16.7 and 33 ms). */
const SLOW_MS = 17.6;
const SMOOTH_MS = 17.2;
const REFRESH_MS = 1000 / 60;
/** Presentation capped at 30 fps (iOS Low Power Mode, browser energy saving) delivers every other refresh. */
const CAPPED_MS = 1000 / 30;
/** Intervals faster than this cannot come from a 30 fps cap: the cap has been lifted. */
const UNCAPPED_MS = 25;
/** GPU timings needed in one review, and the share of them finished within a 60 Hz refresh, to prove a cap. */
const CAP_PROBES = 8;
const CAP_EARLY = 0.8;
/**
 * Below its ceiling, Auto climbs as soon as frames prove headroom: the GPU finishes a frame within this long of its
 * start. The next rung up renders up to 1.56× the pixels (1× → 1.25×), so 10 ms becomes at most about 15.6 ms, still
 * inside one 16.7 ms refresh. CPU time counts against the deadline without growing with pixels, so this errs safe.
 */
const HEADROOM_MS = 10;
/** Timed frames needed in one review, and the share of them that must meet the deadline, to climb at once. */
const HEADROOM_PROBES = 30;
const HEADROOM_EARLY = 0.95;
const REVIEW_MS = 1500;
const SETTLE_MS = 2500;
/** A level just climbed into shows whether it fits within a second; every further second spent finding out is spent hitching. */
const SETTLE_UP_MS = 1000;
const CLIMB_MS = 12000;

/**
 * Targets smooth 60 fps by stepping down render scale, world detail and multisampling
 * when frames run long. It judges by the trimmed mean and the 90th percentile of recent frame intervals, so a
 * single hitch (a window move, a tab switch) never costs quality, while a GPU that misses every other refresh is
 * caught at once. Auto opens at its ceiling. Below it, `probing` asks the caller to time each frame's GPU work
 * against `probeMs`; a review in which nearly every frame finished that early climbs one rung. Where frames can't
 * be timed, a long smooth stretch climbs instead.
 *
 * A steady 33 ms cadence is either a GPU missing every other refresh or a display capped at 30 fps. While frames
 * arrive that slowly, the probe asks whether the GPU finished each frame within one 60 Hz refresh. Frames that finish early yet still wait for every other refresh prove a cap, and Auto then
 * judges against 30 fps until faster intervals show the cap has gone.
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
  private selectedMode: QualityMode;
  private autoCeiling = 0;
  /** Index of the last rung of the fixed ladder; a pixel-budget rung for very large viewports may follow it. */
  private readonly fallback: number = 0;
  private capped = false;
  private lastInterval = 0;
  private probes = 0;
  private early = 0;
  private timed = 0;

  /** Auto opens at the top of its sustained pixel/scale budget, with full world detail. */
  constructor(maxRatio: number, samples: number, width: number, height: number, private readonly locked: boolean, private readonly apply: (level: QualityLevel) => void, mode: QualityMode = 'auto', private readonly autoMaxRatio = maxRatio) {
    this.selectedMode = locked ? 'auto' : mode;
    // QA overrides are exact, including subpixel scales; neither the startup cap nor
    // the adaptive ladder may silently substitute a different resolution.
    if (locked) {
      this.levels.push({ ratio: maxRatio, samples, detail: 2 });
      return;
    }
    for (let ratio = maxRatio; ratio > 1; ratio = Math.max(1, ratio - 0.25)) this.levels.push({ ratio, samples, detail: 2 });
    const baseRatio = Math.min(1, maxRatio);
    this.levels.push({ ratio: baseRatio, samples, detail: 2 });
    // Preserve the meadow before spending the remaining budget on extra antialiasing.
    if (samples > 2) this.levels.push({ ratio: baseRatio, samples: 2, detail: 2 });
    this.levels.push({ ratio: baseRatio, samples: Math.min(samples, 2), detail: 1 });
    this.levels.push({ ratio: baseRatio, samples: Math.min(samples, 2), detail: 0 });
    /**
     * Below one device pixel per pixel, and softer for it. Only a machine that is already missing every other
     * refresh ever gets here, and in a game this slow a soft frame that arrives is worth more than a sharp one
     * that does not: a saturated GPU also starves the readbacks the wind and the life are read back through.
     */
    this.levels.push({ ratio: baseRatio * 0.85, samples: Math.min(samples, 2), detail: 0 });
    this.levels.push({ ratio: baseRatio * 0.72, samples: Math.min(samples, 2), detail: 0 });
    this.levels.push({ ratio: baseRatio * 0.72, samples: Math.min(samples, 2), detail: 0, grassDensity: 0.25, grassReach: 0.7 });
    this.fallback = this.levels.length - 1;
    this.fitBudget(width, height);
    this.autoCeiling = this.index = this.ceilingIndex(width, height);
    if (this.selectedMode !== 'auto') this.index = this.presetIndex(this.selectedMode);
  }

  get mode(): QualityMode { return this.selectedMode; }
  get frameRate(): 30 | 60 { return this.selectedMode === 'low' ? 30 : 60; }

  /** Whether the caller should time the frame just submitted and report it through `gpu`. */
  get probing(): boolean {
    return this.probeMs > 0;
  }

  /** How long after the frame's start its GPU work must be finished to count as early; 0 when not probing. */
  get probeMs(): number {
    if (this.locked || this.selectedMode !== 'auto') return 0;
    if (!this.capped && this.lastInterval >= CAPPED_MS * 0.9) return REFRESH_MS;
    if (this.index > this.autoCeiling) return this.capped ? HEADROOM_MS * CAPPED_MS / REFRESH_MS : HEADROOM_MS;
    return 0;
  }

  /** One frame's GPU timing: whether it had finished by `probeMs`, or null when the timer fired too late to tell. */
  gpu(early: boolean | null): void {
    this.probes++;
    if (early) this.early++;
    if (early !== null) this.timed++;
  }

  private budgetRatio(width: number, height: number): number {
    return Math.min(this.autoMaxRatio, Math.sqrt(AUTO_PIXELS / Math.max(1, width * height)));
  }

  private ceilingIndex(width: number, height: number): number {
    const ratio = this.budgetRatio(width, height);
    const index = this.levels.findIndex(level => level.ratio <= ratio);
    return index < 0 ? this.levels.length - 1 : index;
  }

  /** Viewports too large for the fixed ladder's lowest scale get one more rung at the pixel budget. */
  private fitBudget(width: number, height: number): void {
    this.levels.length = this.fallback + 1;
    const last = this.levels[this.fallback];
    const ratio = Math.max(MIN_BUDGET_RATIO, this.budgetRatio(width, height));
    if (ratio < last.ratio) this.levels.push({ ...last, ratio });
  }

  /** Fullscreen/rotation cannot silently outgrow Auto's pixel budget. */
  resize(width: number, height: number, now: number): void {
    if (this.locked) return;
    const before = this.level.ratio;
    this.fitBudget(width, height);
    this.index = Math.min(this.index, this.levels.length - 1);
    this.autoCeiling = this.ceilingIndex(width, height);
    if (this.selectedMode === 'auto' && this.index < this.autoCeiling) {
      this.index = this.autoCeiling;
      this.reset(now);
      this.apply(this.level);
    } else if (this.level.ratio !== before) {
      this.apply(this.level);
    }
  }

  /** Manual settings hold. Auto resumes within its budget, with fresh timing and no old climb penalty. */
  setMode(mode: QualityMode, now: number): void {
    if (this.locked || mode === this.selectedMode) return;
    this.selectedMode = mode;
    this.lastStepUp = false;
    this.climbMs = CLIMB_MS;
    this.reset(now);
    if (mode !== 'auto') {
      this.index = this.presetIndex(mode);
      this.apply(this.level);
    } else if (this.index < this.autoCeiling) {
      this.index = this.autoCeiling;
      this.apply(this.level);
    }
  }

  private presetIndex(mode: Exclude<QualityMode, 'auto'>): number {
    if (mode === 'high') return 0;
    // Low preserves the meadow at a 30-fps-tolerant visual budget. The lower
    // rungs remain available to Auto when it needs more headroom for its 60 fps target.
    if (mode === 'low') return this.fallback - 2;
    return this.levels.findIndex(level => level.detail === 1);
  }

  /** Time behind the start screen or in a hidden tab is not evidence of smooth play. */
  reset(now: number): void {
    this.recent.length = 0;
    this.probes = this.early = this.timed = 0;
    this.changedAt = this.lastReview = this.smoothSince = now;
  }

  get level(): QualityLevel {
    return this.levels[this.index];
  }

  /** Records one real frame interval; may change the level (calling `apply`) about every 1.5 s. */
  frame(now: number, intervalMs: number): void {
    if (this.locked || this.selectedMode !== 'auto') return;
    this.lastInterval = intervalMs;
    this.recent.push(intervalMs);
    if (this.recent.length > RECENT) this.recent.shift();
    const settle = this.lastStepUp ? SETTLE_UP_MS : SETTLE_MS;
    if (now - this.lastReview < REVIEW_MS || now - this.changedAt < settle || this.recent.length < 8) return;
    this.lastReview = now;
    const sorted = [...this.recent].sort((a, b) => a - b);
    const kept = sorted.slice(0, Math.max(1, Math.floor(sorted.length * 0.95)));
    const mean = kept.reduce((a, b) => a + b, 0) / kept.length;
    const p90 = sorted[Math.floor(sorted.length * 0.9)];
    const p10 = sorted[Math.floor(sorted.length * 0.1)];
    if (this.capped && p10 < UNCAPPED_MS) this.capped = false;
    else if (!this.capped && p10 > CAPPED_MS * 0.9 && p90 < CAPPED_MS * 1.1
      && this.probes >= CAP_PROBES && this.early >= this.probes * CAP_EARLY) this.capped = true;
    // Fence evidence skips the smooth window's first wait, not the doubling a failed climb adds to it.
    const fenced = this.timed >= HEADROOM_PROBES;
    const climbMs = !fenced ? this.climbMs : this.early >= this.timed * HEADROOM_EARLY ? this.climbMs - CLIMB_MS : Infinity;
    this.probes = this.early = this.timed = 0;
    const scale = this.capped ? CAPPED_MS / REFRESH_MS : 1;
    if (mean > SLOW_MS * scale) {
      this.smoothSince = now;
      const step = mean > SLOW_MS * scale * 1.5 ? 2 : 1;
      if (this.index < this.levels.length - 1) this.change(now, Math.min(this.levels.length - 1, this.index + step));
    } else if (p90 > SMOOTH_MS * scale) {
      this.smoothSince = now;
    } else if (now - this.smoothSince > climbMs && this.index > this.autoCeiling) {
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
    this.probes = this.early = this.timed = 0;
    this.apply(this.level);
  }
}
