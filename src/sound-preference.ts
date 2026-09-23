const KEY = 'updraft.sound.v1';

/** Guarded like `gl/quality-preference.ts`: unavailable storage falls back to the default, sound on. */
export function readSoundPreference(): boolean {
  try {
    const value = localStorage.getItem(KEY);
    if (value === 'on') return true;
    if (value === 'off') return false;
  } catch { /* Storage may be unavailable; sound defaults on. */ }
  return true;
}

export function saveSoundPreference(on: boolean): void {
  try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch { /* The current session still uses the choice. */ }
}
