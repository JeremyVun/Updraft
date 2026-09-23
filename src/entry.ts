import { startScreen } from './start-screen';
import './controls';
import { telemetry } from './analytics/telemetry';
import { contextRecovery } from './gl/context-recovery';

declare global {
  interface Window { __cancelEntryWatchdog?: () => void }
}
// The module has now loaded and begun running: index.html's inline watchdog no longer needs to
// suspect a failed or stalled fetch of this chunk. Later failures are this module's own to handle.
window.__cancelEntryWatchdog?.();

const loadingStarted = performance.now();
let previous = loadingStarted, worst = 0, loading = true;
function measureLoading(now: number): void {
  if (!document.hidden) worst = Math.max(worst, now - previous);
  previous = now;
  if (loading) requestAnimationFrame(measureLoading);
}
requestAnimationFrame(measureLoading);
window.addEventListener('error', event => telemetry.failure('runtime', event.error));
window.addEventListener('unhandledrejection', event => telemetry.failure('promise', event.reason));
document.addEventListener('visibilitychange', () => {
  previous = performance.now(); // Time spent in a hidden tab is not a main-thread stall.
  if (document.hidden) telemetry.flush();
});

// Paint the lightweight veil before evaluating the world. A failed game chunk or boot keeps a retry available.
requestAnimationFrame(() => requestAnimationFrame(() => {
  void import('./main').then(game => game.bootReady).then(() => {
    loading = false; if (!contextRecovery.lost) telemetry.loadingFinished(performance.now() - loadingStarted, worst);
  }).catch(error => {
    loading = false; telemetry.failure('boot', error);
    console.error('Game startup failed', error);
    startScreen.fail();
  });
}));
