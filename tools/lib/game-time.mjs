// Waits measured in game time. Shot mode steps the game 1/60 s per drawn frame and reads a stroke's speed per frame,
// so on a shared or busy GPU the game runs behind the wall clock and wall-timed gestures blow harder than written.
// Before the game reports frames (or across a reload) these fall back to the wall clock.
const STEP_MS = 1000 / 60;

export function gameTime(page) {
  const frame = () => page.evaluate(() => window.__stats?.frame ?? null).catch(() => null);
  const until = (target) => page.evaluate((target) => new Promise((done) => {
    const tick = () => (window.__stats?.frame ?? Infinity) >= target ? done() : requestAnimationFrame(tick);
    tick();
  }), target).catch(() => {});
  return {
    frame,
    /** Resolves `ms` of game time from now. */
    async wait(ms) {
      const now = await frame();
      if (now === null) return page.waitForTimeout(ms);
      return until(now + Math.max(1, Math.round(ms / STEP_MS)));
    },
    /** Resolves true once `fn(arg)` holds in the page, or false after `ms` of game time. */
    within(fn, arg, ms) {
      return page.evaluate(({ src, arg, n }) => new Promise((done) => {
        const fn = (0, eval)(`(${src})`), end = (window.__stats?.frame ?? 0) + n;
        const tick = () => fn(arg) ? done(true) : (window.__stats?.frame ?? Infinity) >= end ? done(false) : requestAnimationFrame(tick);
        tick();
      }), { src: fn.toString(), arg, n: Math.round(ms / STEP_MS) }).catch(() => false);
    },
    /** A clock for paced gestures: `at(ms)` resolves once `ms` of game time has passed since it was started. */
    async start() {
      const from = await frame();
      const wall = Date.now();
      return (ms) => from === null ? page.waitForTimeout(Math.max(0, wall + ms - Date.now())) : until(from + Math.round(ms / STEP_MS));
    },
  };
}
