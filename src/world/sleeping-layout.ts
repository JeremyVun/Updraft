/**
 * Walking targets over the hill's own shapes (`heightfield.ts`): east along the lower slope, up through the notch, back
 * west along the horn and up the bank onto the shoulder, down into the saddle and up the last crest to the window's
 * ledge. They never sculpt or flatten the terrain.
 */
export const SLEEP_PATH = [
  [-176.5, -1911], [-171, -1918], [-164.2, -1920.3], [-158.2, -1920.2], [-153.6, -1918.6], [-150.7, -1919.8],
  [-150.9, -1923.9], [-150.6, -1928.7], [-152.1, -1929.85], [-154.4, -1931.75], [-156.6, -1933.25],
  [-158.6, -1935.2], [-161.6, -1936.5], [-164.8, -1937.15], [-168.5, -1938.45], [-170.9, -1939.25],
  [-174, -1939.6], [-177.3, -1940.8],
] as const;
/** A frozen trickle running down across the lower slope, which the bird hops over by itself. */
export const SLEEP_TRICKLE = [-160.3, -1920.24] as const;
/** Below the drift packed into the notch. */
export const SLEEP_DRIFT_STOP = 6;
/** At the foot of the frost-heaved bank. */
export const SLEEP_STEP_STOP = 9;
/** In the saddle, where the fog pools. */
export const SLEEP_FOG_STOP = 14;
/** Out of the fog at the foot of the last crest. */
export const SLEEP_CREST_STOP = 15;

/** Keep incidental props off the bird's route without marking that route on the ground. */
export function sleepPathAt(x: number, z: number): { distance: number } {
  let best = Infinity;
  for (let i = 1; i < SLEEP_PATH.length; i++) {
    const a = SLEEP_PATH[i - 1], b = SLEEP_PATH[i];
    const dx = b[0] - a[0], dz = b[1] - a[1];
    const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz)));
    best = Math.min(best, Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t));
  }
  return { distance: best };
}
