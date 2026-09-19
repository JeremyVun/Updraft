import type { Cygnet } from '../creatures/cygnet';

/** No checkpoint occurs during treatment or unwrapping; chapter and safe exit fully determine the wing's history. */
export function restoreWingCare(k: Cygnet, chapter: string, point = 'entry'): void {
  if (chapter === 'stage') return;
  if (chapter === 'island') {
    k.wing.restore(point === 'entry' ? 'bare' : 'wrapped');
    return;
  }
  const after = ['toMirror', 'mirror', 'toHarbour', 'toHome', 'home'].includes(chapter)
    || chapter === 'sleeping' && point === 'morning';
  const recovery = chapter === 'sleeping' || chapter === 'toSleeping' ? 1
    : ['wood', 'toWood', 'drowned'].includes(chapter) ? 0.8
    : ['birches', 'toBirches'].includes(chapter) ? 0.65
    : ['meadow', 'toMeadow'].includes(chapter) ? 0.4
    : ['boats', 'toBoats'].includes(chapter) ? 0.22 : 0.08;
  k.wing.restore(after ? 'free' : 'wrapped', after ? 1 : recovery);
}
