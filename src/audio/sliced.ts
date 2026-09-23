/** Sample frames generated per step: a fraction of a millisecond on a desktop, about one on a phone. */
export const SLICE = 16384;

/**
 * Buffer synthesis advanced one bounded slice per rendered frame, so neither the Begin gesture nor a cue's frame
 * pays for a whole buffer. A sound needed before its turn finishes the remaining work at once.
 */
export class Sliced<T> {
  private result: T | undefined;

  constructor(private readonly work: Iterator<void, T>) {}

  get ready(): boolean {
    return this.result !== undefined;
  }

  /** Runs one slice; true once the result exists. */
  step(): boolean {
    if (this.result === undefined) {
      const next = this.work.next();
      if (next.done) this.result = next.value;
    }
    return this.result !== undefined;
  }

  finish(): T {
    while (!this.step());
    return this.result!;
  }
}

/** Index ranges of at most `SLICE` samples covering `length`. */
export function* slices(length: number): Generator<[number, number]> {
  for (let from = 0; from < length; from += SLICE) yield [from, Math.min(length, from + SLICE)];
}
