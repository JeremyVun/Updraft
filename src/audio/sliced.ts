/** Sample frames generated per step: a small fraction of a millisecond, even on a phone. */
export const SLICE = 4096;
/** Steps per second of story time: about 16k samples in a 60 Hz frame, and the Begin buffers in about a second. */
export const SLICES_PER_SECOND = 240;
/** Yielded before a step that is long and indivisible (a convolver analysing its impulse): it gets a frame to itself. */
export const ALONE = Symbol('alone');
export type Pace = typeof ALONE | void;

/**
 * Audio preparation advanced in bounded steps across rendered frames, so neither the Begin gesture nor a cue's frame
 * pays for a whole buffer or convolver. A sound needed before its turn finishes the remaining work at once.
 */
export class Sliced<T> {
  private done = false;
  private result!: T;
  /** The next step must run alone in its frame. */
  alone = false;

  constructor(private readonly work: Iterator<Pace, T>) {}

  get ready(): boolean {
    return this.done;
  }

  /** Runs one step; true once the work is complete. */
  step(): boolean {
    if (!this.done) {
      const next = this.work.next();
      if (next.done) {
        this.done = true;
        this.result = next.value;
      } else this.alone = next.value === ALONE;
    }
    return this.done;
  }

  finish(): T {
    while (!this.step());
    return this.result;
  }
}

/** Runs queued work for one frame: `share` slices, or a single step that needs the frame alone. */
export function advance(queue: Sliced<unknown>[], share: number): void {
  for (let steps = share; steps > 0 && queue.length;) {
    const job = queue[0];
    if (job.ready) queue.shift();
    else if (job.alone) {
      if (steps === share) job.step();
      return;
    } else {
      job.step();
      steps--;
    }
  }
}

/** Index ranges of at most `SLICE` samples covering `length`. */
export function* slices(length: number): Generator<[number, number]> {
  for (let from = 0; from < length; from += SLICE) yield [from, Math.min(length, from + SLICE)];
}
