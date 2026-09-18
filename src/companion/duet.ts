/** One stretch of a shared moment. It ends after `dur` seconds, or when `until` says so (with `dur` then a limit). */
export interface Beat {
  name: string;
  dur: number;
  enter?: () => void;
  /** `k` runs 0 to 1 over the beat, already eased in and out; `t` is seconds since it began. */
  update?: (k: number, t: number, dt: number) => void;
  until?: (t: number) => boolean;
  exit?: () => void;
}

const smoother = (x: number) => x * x * x * (x * (x * 6 - 15) + 10);

/**
 * A moment two characters share, played from one clock so that neither can get ahead of the other: kneeling to it,
 * lifting it, setting it down. Beats run in order; each eases in and out so there is never a cut between two.
 */
export class Duet {
  private index = -1;
  private t = 0;
  done = false;

  constructor(
    readonly name: string,
    private readonly beats: Beat[],
    private readonly onDone?: () => void,
  ) {}

  get beat(): string {
    return this.beats[this.index]?.name ?? '';
  }

  update(dt: number): void {
    if (this.done) return;
    if (this.index < 0) this.next();
    const b = this.beats[this.index];
    this.t += dt;
    const k = smoother(Math.min(1, this.t / b.dur));
    b.update?.(k, this.t, dt);
    const over = this.t >= b.dur || (b.until?.(this.t) ?? false);
    if (over) {
      b.exit?.();
      this.next();
    }
  }

  private next(): void {
    this.index++;
    this.t = 0;
    if (this.index >= this.beats.length) {
      this.done = true;
      this.onDone?.();
      return;
    }
    this.beats[this.index].enter?.();
  }
}
