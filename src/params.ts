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
  /** Start later in the story: `crossing` or `hills`. */
  chapter: q.get('chapter'),
};
