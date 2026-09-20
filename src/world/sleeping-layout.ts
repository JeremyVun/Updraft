/** Walking targets follow the existing grassy flank. They never sculpt or flatten the terrain. */
export const SLEEP_PATH = [
  [-176.5, -1911], [-171, -1918], [-161, -1919.2], [-156, -1923.4],
  [-153, -1926.6], [-152.8, -1928.6], [-156.8, -1932.5], [-161, -1935.2],
  [-165, -1937.2], [-171, -1939.6], [-177.3, -1940.8],
] as const;
export const SLEEP_SNOW_STOP = 3;
export const SLEEP_MIST_STOP = 7;

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
