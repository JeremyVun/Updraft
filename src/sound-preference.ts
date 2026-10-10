const SOUND_KEY = 'updraft.sound.v1';
const MUSIC_KEY = 'updraft.music.v1';

/** Guarded like `gl/quality-preference.ts`: unavailable storage falls back to the default, sound on. */
function readPreference(key: string): boolean {
  try {
    const value = localStorage.getItem(key);
    if (value === 'on') return true;
    if (value === 'off') return false;
  } catch { /* Storage may be unavailable; sound defaults on. */ }
  return true;
}

function savePreference(key: string, on: boolean): void {
  try { localStorage.setItem(key, on ? 'on' : 'off'); } catch { /* The current session still uses the choice. */ }
}

export const readSoundPreference = (): boolean => readPreference(SOUND_KEY);
export const saveSoundPreference = (on: boolean): void => savePreference(SOUND_KEY, on);
export const readMusicPreference = (): boolean => readPreference(MUSIC_KEY);
export const saveMusicPreference = (on: boolean): void => savePreference(MUSIC_KEY, on);
