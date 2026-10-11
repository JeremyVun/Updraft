import { tuning } from './tuning';

export function openingTitleOpacity(crossingTime: number | undefined): number {
  if (crossingTime === undefined) return 0;
  const { afterFarewell, fadeIn, hold, fadeOut } = tuning.opening.title;
  const time = crossingTime - afterFarewell;
  const smooth = (value: number) => { const x = Math.max(0, Math.min(1, value)); return x * x * (3 - 2 * x); };
  return smooth(time / fadeIn) * (1 - smooth((time - fadeIn - hold) / fadeOut));
}
