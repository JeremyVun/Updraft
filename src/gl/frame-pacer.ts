/** A presentation budget, independent of the simulation's elapsed-time clock. */
export class FramePacer {
  private next = 0;
  private previous = 0;
  private longest = 0;
  private rate = 60;
  /** Intentional skips must not look like GPU overload to the quality governor. */
  intervalMs = 1000 / 60;

  reset(now: number): void {
    this.previous = now;
    this.next = now + 1000 / this.rate;
    this.longest = 0;
  }

  due(now: number, rate: 30 | 60): boolean {
    const interval = 1000 / rate;
    if (rate !== this.rate) {
      this.rate = rate;
      this.next = this.previous + interval;
    }
    this.longest = Math.max(this.longest, now - this.previous);
    this.previous = now;
    // rAF timestamps have small rounding/refresh jitter. Keep 59.94 Hz at 59.94,
    // while distributing 60 presentations evenly across 90/120/144 Hz callbacks.
    if (now < this.next - 1) return false;
    this.intervalMs = Math.max(interval, this.longest);
    this.longest = 0;
    // No catch-up frames after a stall, and no accumulating debt when the display
    // runs just below the requested rate. Simulation still receives actual elapsed time.
    this.next = now - this.next >= interval ? now + interval : this.next + interval;
    return true;
  }
}
