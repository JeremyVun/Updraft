/** A forgiving sweep along the visible invitation; distances are measured in screen heights. */
export class PianoStroke {
  progress = 0;
  private started = false;
  private start = 0;
  private furthest = 0;
  reset(): void { this.progress = 0; this.started = false; this.start = 0; this.furthest = 0; }
  step(previous: number, current: number, distance: number, tolerance: number): number {
    if (distance > tolerance || current <= previous || current - previous > 0.5 || current < -0.15 || previous > 1.15) return this.progress;
    if (!this.started) {
      if (previous > 0.28 || current < 0) return this.progress;
      this.started = true;
      this.start = Math.max(0, previous);
      this.furthest = this.start;
    }
    // Credit distance actually traced, not a jump to the far end after leaving the path.
    if (previous > this.furthest + 0.18) return this.progress;
    this.furthest = Math.max(this.furthest, current);
    this.progress = Math.min(1, (this.furthest - this.start) / (0.92 - this.start));
    return this.progress;
  }
}
