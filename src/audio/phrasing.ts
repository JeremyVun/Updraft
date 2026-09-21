import { tuning } from '../tuning';

/** The piano's opening question; rooms remember different amounts of it. */
export const JOURNEY_THEME = [62, 64, 66, 71] as const;
export const JOURNEY_ANSWER = [71, 66, 64, 62] as const;
export const WINTER_THEME = [62, 64, 65] as const;

export interface PhraseNote {
  at: number; midi: number; voice: string; duration?: number;
  level?: number; velocity?: number; pan?: number; role?: 'melody' | 'accompaniment' | 'harmony' | 'weather' | 'star';
}
export interface Phrase<N extends PhraseNote> {
  seconds: number; notes: readonly N[]; loopFrom?: number; variants?: readonly (readonly N[])[];
}
export interface PhraseClock { epoch: number; cycle: number; next: number }
export const isMelody = (n: PhraseNote): boolean => n.role ? n.role === 'melody' : n.voice !== 'pad';

/** Keep the original orchestration, extend harmony under loop joins, and leave space in alternate verses. */
export function polishPhrase<N extends PhraseNote, P extends Phrase<N>>(pattern: P,
  options: { loopFrom?: number; sustain?: boolean; from?: number; to?: number; melody?: readonly N[] } = {}): P {
  const loopFrom = options.loopFrom ?? 0;
  const sustain = (notes: readonly N[]): N[] => {
    const pads = notes.filter(n => n.voice === 'pad').map(n => n.at).sort((a, b) => a - b);
    return notes.map(n => {
      if (options.sustain === false || n.voice !== 'pad' || n.duration === undefined) return n;
      const next = pads.find(at => at > n.at + .2) ?? pattern.seconds + (pads[0] ?? loopFrom) - loopFrom;
      return { ...n, duration: Math.max(n.duration, next - n.at - tuning.audio.phraseReleaseLead) };
    });
  };
  const original = sustain(pattern.notes);
  const notes = options.melody ? sustain([
    ...pattern.notes.filter(n => !isMelody(n) || n.at < (options.from ?? 0) || n.at >= (options.to ?? Infinity)),
    ...options.melody,
  ].sort((a, b) => a.at - b.at)) : original;
  let melodyIndex = 0;
  const spare = notes.filter(n => !isMelody(n) || melodyIndex++ % 2 === 0).map(n => isMelody(n)
    ? { ...n, ...(n.level !== undefined ? { level: n.level * .85 } : { velocity: (n.velocity ?? .25) * .9 }) } : n);
  return { ...pattern, notes, loopFrom, variants: [notes, spare, original] };
}

export function phrasePosition(pattern: Phrase<PhraseNote>, epoch: number, when: number): number {
  const elapsed = Math.max(0, when - epoch), from = pattern.loopFrom ?? 0;
  return elapsed < pattern.seconds ? elapsed : from + (elapsed - pattern.seconds) % (pattern.seconds - from);
}
function cycleAt(pattern: Phrase<PhraseNote>, epoch: number, now: number): number {
  const elapsed = Math.max(0, now - epoch);
  return elapsed < pattern.seconds ? 0 : 1 + Math.floor((elapsed - pattern.seconds) / (pattern.seconds - (pattern.loopFrom ?? 0)));
}
function notesAt<N extends PhraseNote>(pattern: Phrase<N>, cycle: number): readonly N[] {
  return pattern.variants?.[cycle % pattern.variants.length] ?? pattern.notes;
}

/** One scheduler for introductory rests, repeating bodies, sparse verses, lookahead and missed frames. */
export function schedulePhrase<N extends PhraseNote>(clock: PhraseClock, pattern: Phrase<N>, now: number,
  play: (note: N, at: number) => void, until = Infinity): void {
  if (!pattern.notes.length) return;
  const cycle = cycleAt(pattern, clock.epoch, now), from = pattern.loopFrom ?? 0;
  if (cycle > clock.cycle) { clock.cycle = cycle; clock.next = 0; }
  for (;;) {
    const notes = notesAt(pattern, clock.cycle), note = notes[clock.next];
    if (!note) { clock.next = 0; clock.cycle++; continue; }
    const at = clock.epoch + clock.cycle * (pattern.seconds - from) + note.at;
    if (at > now + .25 || at >= until) return;
    if ((clock.cycle === 0 || note.at >= from) && at >= now - .04) play(note, Math.max(now + .008, at));
    clock.next++;
  }
}

/** Wait only for a nearby end of a melodic gesture, never a whole player-paced loop. */
export function phraseHandoff(pattern: Phrase<PhraseNote>, epoch: number, now: number): number {
  const cycle = cycleAt(pattern, epoch, now), from = pattern.loopFrom ?? 0;
  const base = epoch + cycle * (pattern.seconds - from);
  const melody = notesAt(pattern, cycle).filter(isMelody);
  for (let i = 0; i < melody.length; i++) {
    const note = melody[i], start = base + note.at, end = start + (note.duration ?? 2.5);
    const next = melody[i + 1];
    if (start <= now && end > now && end <= now + tuning.audio.arrivalPhraseWait
      && (!next || base + next.at >= end + .3)) return end;
  }
  return now;
}
