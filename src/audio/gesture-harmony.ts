/** Preserve a gesture's register/contour while choosing only pitches belonging to the sounding harmony. */
export function chordNote(wanted: number, chord: readonly number[], low = wanted - 12, high = wanted + 12): number {
  let best = wanted, distance = Infinity;
  for (let midi = Math.ceil(low); midi <= high; midi++) {
    if (!chord.some(tone => (tone - midi) % 12 === 0)) continue;
    const away = Math.abs(midi - wanted);
    if (away < distance) { best = midi; distance = away; }
  }
  return best;
}
