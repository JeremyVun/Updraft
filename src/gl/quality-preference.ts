import type { QualityMode } from './quality';

const KEY = 'updraft.quality.v2';
const OLD_KEY = 'updraft.quality.v1';

export function readQualityMode(): QualityMode {
  try {
    const mode = localStorage.getItem(KEY);
    if (mode === 'ultra' || mode === 'high' || mode === 'medium' || mode === 'low') return mode;
    if (mode !== null) return 'auto';
    const old = localStorage.getItem(OLD_KEY);
    // The old High rendered what Ultra renders.
    if (old === 'high') return 'ultra';
    if (old === 'medium' || old === 'low') return old;
  } catch { /* Storage may be unavailable; Auto remains the default. */ }
  return 'auto';
}

export function saveQualityMode(mode: QualityMode): void {
  try { localStorage.setItem(KEY, mode); } catch { /* The current session still uses the choice. */ }
}
