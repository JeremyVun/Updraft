const SOUND_KEY = 'updraft.sound.v1';
const VOLUME_KEY = 'updraft.volume.v1';

/** Guarded like `gl/quality-preference.ts`: unavailable storage falls back to the default, sound on at full volume. */
export function readSoundPreference(): boolean {
  try {
    if (localStorage.getItem(SOUND_KEY) === 'off') return false;
  } catch { /* Storage may be unavailable; sound defaults on. */ }
  return true;
}

export function saveSoundPreference(on: boolean): void {
  try { localStorage.setItem(SOUND_KEY, on ? 'on' : 'off'); } catch { /* The current session still uses the choice. */ }
}

export function readVolumePreference(): number {
  try {
    const value = Number(localStorage.getItem(VOLUME_KEY) ?? 1);
    if (Number.isFinite(value)) return Math.min(1, Math.max(0, value));
  } catch { /* Storage may be unavailable; full volume. */ }
  return 1;
}

export function saveVolumePreference(volume: number): void {
  try { localStorage.setItem(VOLUME_KEY, String(volume)); } catch { /* The current session still uses the choice. */ }
}
