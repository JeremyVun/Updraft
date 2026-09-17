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

const lite = q.has('lite') ? q.get('lite') !== '0' : window.matchMedia('(pointer: coarse)').matches;

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
  /** Storm override, 0 calm to 1 the full squall: the sea gets up, the weathervane spins, the herons go. */
  storm: num('storm'),
  /** Start later in the story: `crossing`, `washing`, `meadow`, `birches`, `drowned`, `wood`, `sea` or `summit`. */
  chapter: q.get('chapter'),
  /** Lighter simulation and world for weak GPUs (128² wind, fewer pressure iterations, one substep, sparser grass, coarser far terrain, the reflection on alternate frames). On by default for touch devices; `lite=0` forces it off. */
  lite,
  /** How often the sea's reflection is drawn: every frame (1), alternate frames (2, the lite default; a one-frame lag is faintly visible in still comparisons), or never (0, QA). */
  mirror: q.get('mirror') !== null ? Number(q.get('mirror')) || 0 : lite ? 2 : 1,
  /** QA: `mirrorlod=full` gives the sea's mirror the main view's terrain detail instead of a coarser set, for comparison. */
  mirrorlod: q.get('mirrorlod') ?? 'coarse',
  /** QA: `blades=direct` uses the old per-vertex grass shader instead of the blade table, for before/after comparison. */
  blades: q.get('blades') ?? 'table',
  /** QA: `hold=<frame>` freezes the world after that frame (it keeps drawing the same state), so two runs can capture the very same frame. */
  hold: num('hold'),
  /** QA: an on-screen readout of frame times, quality level and readbacks, for phones. */
  stats: q.has('stats'),
  /** QA: a whale surfaces ahead of the crossing a few seconds in (and again every so often), fish leap by the boat. */
  whale: q.has('whale'),
  /** Prototype: hangs the island of lines' washing over the still island. */
  lines: q.has('lines'),
};
