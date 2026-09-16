const q = new URLSearchParams(location.search);

function nums(key: string): number[] | null {
  const raw = q.get(key);
  if (!raw) return null;
  const values = raw.split(',').map(Number);
  return values.every(Number.isFinite) ? values : null;
}

function num(key: string): number | null {
  const raw = q.get(key);
  return raw !== null && Number.isFinite(Number(raw)) ? Number(raw) : null;
}

export const params = {
  /** Set by the QA tools: exposes `window.__game`, `__stats`, `__ready` and steps time at a fixed rate. */
  shot: q.has('shot'),
  /** `wind` overlays the wind field. */
  debug: q.get('debug') ?? '',
  /** Fixed render scale; disables the automatic step-down. */
  ratio: num('ratio'),
  /** Camera override: x,y,z,targetX,targetY,targetZ. */
  cam: nums('cam'),
  /** Sun override: azimuthDeg,elevationDeg (azimuth 0 = straight ahead of the default camera). */
  sun: nums('sun'),
  /** Grass density multiplier. */
  grass: num('grass'),
  /** MSAA sample count for the scene render (default 4). */
  msaa: num('msaa'),
  /** Time of day override: 0 afternoon, 1 sunset, 2 night. */
  dusk: num('dusk'),
  /** Shower override, 0 dry to 1. */
  shower: num('shower'),
  /** Start later in the story: `crossing`, `hills` or `summit`. */
  chapter: q.get('chapter'),
  /** QA: an on-screen readout of frame times, quality level and readbacks, for phones. */
  stats: q.has('stats'),
  /** QA: a whale surfaces ahead of the crossing a few seconds in (and again every so often), fish leap by the boat. */
  whale: q.has('whale'),
  /** Prototype: hangs the island of lines' washing over the still island. */
  lines: q.has('lines'),
};
