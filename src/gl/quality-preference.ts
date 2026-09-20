import type { QualityMode } from './quality';

const KEY = 'updraft.quality.v1';

export function readQualityMode(): QualityMode {
  try {
    const mode = localStorage.getItem(KEY);
    if (mode === 'high' || mode === 'medium' || mode === 'low') return mode;
  } catch { /* Storage may be unavailable; Auto remains the default. */ }
  return 'auto';
}

export function saveQualityMode(mode: QualityMode): void {
  try { localStorage.setItem(KEY, mode); } catch { /* The current session still uses the choice. */ }
}
