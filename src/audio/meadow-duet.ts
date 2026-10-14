export interface WindPhrase {
  readonly notes: readonly (readonly [at: number, midi: number, strength: number])[];
  readonly duration: number;
}

// Provisional notes; replace these timings with Jeremy's edited phrases when the recordings arrive.
export const MEADOW_CALLS: readonly { call: WindPhrase; reply: readonly number[] }[] = [
  { call: { duration: 3.2, notes: [[0, 62, 1], [.6, 64, .85], [1.2, 66, .9], [1.9, 71, 1]] }, reply: [0, 1, 2, 4] },
  { call: { duration: 3.5, notes: [[0, 74, .9], [.65, 71, 1], [1.3, 66, .9], [2.05, 64, .8]] }, reply: [5, 4, 2, 1] },
  { call: { duration: 3.8, notes: [[0, 62, .8], [.7, 66, .9], [1.4, 71, 1], [2.2, 74, 1.1]] }, reply: [0, 2, 4, 5] },
  { call: { duration: 4.1, notes: [[0, 71, 1], [.7, 66, .9], [1.5, 64, .85], [2.45, 62, 1]] }, reply: [4, 2, 1, 0] },
];

export const MEADOW_FINALE: WindPhrase & { readonly greenAt: number } = {
  duration: 12.5,
  greenAt: 2.1,
  notes: [[0, 62, .8], [.65, 66, .9], [1.35, 69, 1], [2.1, 74, 1.4], [3.15, 78, 1.2],
    [4.15, 81, 1.3], [5.6, 78, 1.1], [6.55, 74, 1.1], [7.5, 71, 1], [8.5, 66, .9], [10, 62, 1]],
};
