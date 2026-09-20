/** Bounded catch-up: discard excess stall time rather than carrying an ever-growing backlog. */
export const MAX_FRAME_TIME = 0.1;
// World mechanics already support 30 Hz. Preserve ordinary 30–144 fps updates rather than
// doubling all CPU work whenever a frame lands just below 60 fps. Wind has its own 60 Hz clock.
export const MAX_SIMULATION_STEP = 1 / 30;
export const MAX_SIMULATION_STEPS = 3;

export function frameTiming(elapsed: number): { dt: number; steps: number; stepDt: number } {
  const dt = Number.isFinite(elapsed) ? Math.max(0, Math.min(elapsed, MAX_FRAME_TIME)) : 0;
  const steps = dt > 0 ? Math.min(MAX_SIMULATION_STEPS, Math.max(1, Math.ceil(dt / MAX_SIMULATION_STEP - 1e-9))) : 0;
  return { dt, steps, stepDt: steps ? dt / steps : 0 };
}
