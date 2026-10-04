export type QualityLevelName = 'ultra' | 'high' | 'medium' | 'low';

export interface QualityLevel {
  name: QualityLevelName;
  /** Render scale, in device pixels per CSS pixel. */
  ratio: number;
  /** Multisampling of the scene target. */
  samples: number;
}

export type QualityMode = 'auto' | QualityLevelName;

export interface WorldQuality {
  grassDensity: number;
  grassReach: number;
  terrainSplit: number;
  /** The sky mirror is redrawn every this many frames. */
  mirrorEvery: 1 | 2;
  mirrorScale: number;
  bloom: BloomLevel;
  /** The depth blur (`post.ts`), which needs bloom on. */
  depthBlur: boolean;
  sea: SeaEffects;
  /** Segments of the near grass's blades. */
  nearSegments: 6 | 5;
}

export type BloomLevel = 'full' | 'off';
/** The sea's effects: all of them, all but the hull's wet collar, or the plain sea (see `water.ts`). */
export type SeaEffects = 'all' | 'noCollar' | 'plain';

export const HIGH_GRASS_REACH = 1.15;

const FULL: WorldQuality = { grassDensity: 1, grassReach: HIGH_GRASS_REACH, terrainSplit: 1.6, mirrorEvery: 1, mirrorScale: 0.75, bloom: 'full', depthBlur: true, sea: 'all', nearSegments: 6 };

export const WORLD_QUALITY: Record<QualityLevelName, WorldQuality> = {
  ultra: FULL,
  high: FULL,
  medium: { grassDensity: 1, grassReach: 1, terrainSplit: 1.35, mirrorEvery: 1, mirrorScale: 0.625, bloom: 'full', depthBlur: false, sea: 'noCollar', nearSegments: 6 },
  low: { grassDensity: 1, grassReach: 1, terrainSplit: 1.1, mirrorEvery: 2, mirrorScale: 0.5, bloom: 'off', depthBlur: false, sea: 'plain', nearSegments: 5 },
};

const NAMES: QualityLevelName[] = ['ultra', 'high', 'medium', 'low'];
const HIGH_RATIO = 1.25;
const LOW_SCALE = 0.85;
const RECENT = 90;
/** Sustained Auto budget. Smooth vsync alone is not evidence of spare power. */
const AUTO_PIXELS = 2.4e6;
/** Fitting a large viewport to the budget never renders softer than this. */
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
 * submission. The next level up renders at most 1.56× the pixels (Medium → High), so 10 ms becomes at most about
 * 15.6 ms, inside one 16.7 ms refresh; under a device's 30 fps cap it gets twice as long. Timed from submission because
 * the frame's script doesn't grow with pixels; the 2–4 ms a browser takes to report a finished fence still counts
 * against it, so this errs safe.
 */
const HEADROOM_MS = 10;
/**
 * Timed frames needed in one review at 60 fps, and the share of them that must meet the deadline, to climb at once. The fence
 * is seen 2–4 ms after it finishes (Chrome), time that doesn't grow with pixels, so a frame just over still fits.
 */
const HEADROOM_PROBES = 30;
const HEADROOM_EARLY = 0.9;
/**
 * Fewer on time than this rules a climb out. In between, the smooth window decides: the evidence is noisy in the
 * first seconds of play and on a GPU shared with other work, and alternate-frame reflections at low detail split it.
 */
const HEADROOM_NONE = 0.25;
const REVIEW_MS = 1500;
const SETTLE_MS = 2500;
/** A level just climbed into shows whether it fits within a second; every further second spent finding out is spent hitching. */
const SETTLE_UP_MS = 1000;
const CLIMB_MS = 12000;

/**
 * Auto holds each level's frame rate by moving between the named levels when frames run long. It judges by the
 * trimmed mean and the 90th percentile of recent frame intervals, so a single hitch (a window move, a tab switch)
 * never costs quality, while a GPU that misses every other refresh is caught at once. Auto opens at its ceiling.
 * Below it, `probing` asks the caller to time each frame's GPU work against `probeDeadline`; a review in which
 * nearly every frame finished that early climbs one level. Where frames can't be timed, a long smooth stretch
 * climbs instead.
 *
 * At a 60 fps level a steady 33 ms cadence is either a GPU missing every other refresh or a display capped at
 * 30 fps. While frames arrive that slowly, the probe asks whether the GPU finished each frame within one 60 Hz
 * refresh. Frames that finish early yet still wait for every other refresh prove a cap, and Auto then judges against
 * 30 fps until faster intervals show the cap has gone.
 */
export class Quality {
  private readonly levels: QualityLevel[];
  /** Auto's levels for this viewport, from its ceiling down, fitted to the pixel budget. */
  private ladder: QualityLevel[] = [];
  private rung = 0;
  private current: QualityLevel;
  private readonly recent: number[] = [];
  private changedAt = 0;
  private smoothSince = 0;
  private lastReview = 0;
  private climbMs = CLIMB_MS;
  private lastStepUp = false;
  private selectedMode: QualityMode;
  private capped = false;
  private lastInterval = 0;
  private probes = 0;
  private early = 0;
  private timed = 0;

  constructor(maxRatio: number, samples: number, width: number, height: number, private readonly locked: boolean, private readonly apply: (level: QualityLevel) => void, mode: QualityMode = 'auto', private readonly autoMaxRatio = maxRatio) {
    this.selectedMode = locked ? 'auto' : mode;
    const top: QualityLevel = { name: 'ultra', ratio: maxRatio, samples };
    const base = Math.min(1, maxRatio), few = Math.min(samples, 2);
    // QA overrides are exact, including subpixel scales: no budget fit and no ladder.
    this.levels = locked ? [top] : [
      top,
      { name: 'high', ratio: Math.min(maxRatio, HIGH_RATIO), samples },
      { name: 'medium', ratio: base, samples: few },
      { name: 'low', ratio: base * LOW_SCALE, samples: few },
    ];
    this.current = top;
    if (locked) return;
    if (this.selectedMode !== 'auto') this.current = this.preset(this.selectedMode);
    this.fit(width, height);
    if (this.selectedMode === 'auto') this.current = this.ladder[0];
  }

  get mode(): QualityMode { return this.selectedMode; }
  get level(): QualityLevel { return this.current; }

  /** Whether the caller should time the frame just submitted and report it through `gpu`. */
  get probing(): boolean {
    return this.probingCap || (this.adapting && this.rung > 0);
  }

  private get adapting(): boolean {
    return !this.locked && this.selectedMode === 'auto';
  }

  private get probingCap(): boolean {
    return this.adapting && !this.capped && this.lastInterval >= CAPPED_MS * 0.9;
  }

  /** How many 60 Hz refreshes a frame may take. */
  private get refreshes(): number {
    return this.capped ? CAPPED_MS / REFRESH_MS : 1;
  }

  /** By when the frame that began at `start` and was submitted at `submitted` must have finished to count as early. */
  probeDeadline(start: number, submitted: number): number {
    if (this.probingCap) return start + REFRESH_MS;
    return submitted + HEADROOM_MS * this.refreshes;
  }

  /** One frame's GPU timing: whether it had finished by `probeDeadline`, or null when the timer fired too late to tell. */
  gpu(early: boolean | null): void {
    this.probes++;
    if (early) this.early++;
    if (early !== null) this.timed++;
  }

  /** A level that would render exactly as the one above it is no step at all, so the ladder leaves it out. */
  private fit(width: number, height: number): void {
    const budget = Math.max(MIN_BUDGET_RATIO, Math.sqrt(AUTO_PIXELS / Math.max(1, width * height)));
    const ceiling = Math.max(0, this.levels.findIndex(level => level.ratio <= this.autoMaxRatio));
    this.ladder = [];
    for (const level of this.levels.slice(ceiling)) {
      const fitted = { ...level, ratio: Math.min(level.ratio, budget) };
      const above = this.ladder[this.ladder.length - 1];
      if (!above || !rendersAlike(above, fitted)) this.ladder.push(fitted);
    }
    this.rung = this.rungOf(this.current.name);
  }

  /** Where Auto stands when `name` is in use: that level, or the nearest one above that its ladder keeps. */
  private rungOf(name: QualityLevelName): number {
    const order = NAMES.indexOf(name);
    let rung = 0;
    while (rung < this.ladder.length - 1 && NAMES.indexOf(this.ladder[rung + 1].name) <= order) rung++;
    return rung;
  }

  private preset(mode: Exclude<QualityMode, 'auto'>): QualityLevel {
    return this.levels.find(level => level.name === mode)!;
  }

  private show(level: QualityLevel, now: number): void {
    const before = this.current;
    this.current = level;
    if (before.name === level.name && before.ratio === level.ratio) return;
    this.reset(now);
    this.apply(level);
  }

  /** Fullscreen/rotation cannot silently outgrow Auto's pixel budget. */
  resize(width: number, height: number, now: number): void {
    if (this.locked) return;
    this.fit(width, height);
    if (this.selectedMode === 'auto') this.show(this.ladder[this.rung], now);
  }

  /** Manual settings hold. Auto resumes from the level in use, with fresh timing and no old climb penalty. */
  setMode(mode: QualityMode, now: number): void {
    if (this.locked || mode === this.selectedMode) return;
    this.selectedMode = mode;
    this.lastStepUp = false;
    this.climbMs = CLIMB_MS;
    this.reset(now);
    if (mode !== 'auto') this.rung = this.rungOf(mode);
    this.show(mode === 'auto' ? this.ladder[this.rung] : this.preset(mode), now);
  }

  /** Time behind the start screen or in a hidden tab is not evidence of smooth play. */
  reset(now: number): void {
    this.recent.length = 0;
    this.probes = this.early = this.timed = 0;
    this.changedAt = this.lastReview = this.smoothSince = now;
  }

  /** Records one real frame interval; may change the level (calling `apply`) about every 1.5 s. */
  frame(now: number, intervalMs: number): void {
    if (!this.adapting) return;
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
    else if (this.probingCap && p10 > CAPPED_MS * 0.9 && p90 < CAPPED_MS * 1.1
      && this.probes >= CAP_PROBES && this.early >= this.probes * CAP_EARLY) this.capped = true;
    const scale = this.refreshes;
    let climbMs = this.climbMs;
    // A review holds half as many frames at 30 fps.
    if (this.timed >= HEADROOM_PROBES / scale) {
      // Fence evidence skips the smooth window's first wait, not the doubling a failed climb adds to it.
      if (this.early >= this.timed * HEADROOM_EARLY) climbMs -= CLIMB_MS;
      else if (this.early < this.timed * HEADROOM_NONE) climbMs = Infinity;
    }
    this.probes = this.early = this.timed = 0;
    const lowest = this.ladder.length - 1;
    if (mean > SLOW_MS * scale) {
      this.smoothSince = now;
      if (this.rung === lowest) return;
      this.change(now, this.rung + 1);
    } else if (p90 > SMOOTH_MS * scale) {
      this.smoothSince = now;
    } else if (now - this.smoothSince > climbMs && this.rung > 0) {
      this.change(now, this.rung - 1);
    }
  }

  /** A step down that undoes a recent step up doubles the wait before the next climb, so levels never oscillate. */
  private change(now: number, rung: number): void {
    const up = rung < this.rung;
    if (!up && this.lastStepUp) this.climbMs = Math.min(this.climbMs * 2, 120000);
    this.lastStepUp = up;
    this.rung = rung;
    this.current = this.ladder[rung];
    this.changedAt = now;
    this.smoothSince = now;
    this.recent.length = 0;
    this.probes = this.early = this.timed = 0;
    this.apply(this.current);
  }
}

function rendersAlike(a: QualityLevel, b: QualityLevel): boolean {
  return a.ratio === b.ratio && a.samples === b.samples && WORLD_QUALITY[a.name] === WORLD_QUALITY[b.name];
}
