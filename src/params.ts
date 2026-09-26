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

const lite = q.has('lite') && q.get('lite') !== '0';
const rawRatio = num('ratio');
/**
 * A malformed shared URL must not be able to request an enormous framebuffer or sample count. These are
 * sanity floors/ceilings only: ratio's true ceiling is the device pixel ratio the renderer actually uses,
 * and msaa's is the renderer's MAX_SAMPLES, clamped once the GL context exists (`gl/graphics-capability.ts`).
 */
const ratio = rawRatio !== null && rawRatio > 0 ? Math.min(rawRatio, 4) : null;
const rawMsaa = num('msaa');
const msaa = rawMsaa !== null ? Math.min(Math.max(0, rawMsaa), 16) : null;
const rawGrass = num('grass');
const grass = rawGrass !== null ? Math.min(Math.max(0, rawGrass), 4) : null;

export const params = {
  /** Set by the QA tools: exposes `window.__game`, `__stats`, `__ready` and steps time at a fixed rate. */
  shot: q.has('shot'),
  /** `wind` overlays the wind field. */
  debug: q.get('debug') ?? '',
  /** Fixed render scale; disables the automatic step-down. Clamped to (0, 4]. */
  ratio,
  /** Camera override: x,y,z,targetX,targetY,targetZ. */
  cam: nums('cam'),
  /** Sun override: azimuthDeg,elevationDeg (azimuth 0 = straight ahead of the default camera). */
  sun: nums('sun'),
  /** Fixed grass density multiplier; overrides the adaptive world tier. Clamped to [0, 4]. */
  grass,
  /** MSAA sample count for the scene render (default 4). Clamped to [0, 16] here, then to the device's MAX_SAMPLES once the GL context exists. */
  msaa,
  /** Time of day override: 0 afternoon, 1 sunset, 2 night. */
  dusk: num('dusk'),
  /** Shower override, 0 dry to 1. */
  shower: num('shower'),
  /** Storm override, 0 calm to 1 the full squall: the sea gets up, the weathervane spins, the herons go. */
  storm: num('storm'),
  /** Start later in the story: `crossing`, `washing`, `boats`, `meadow`, `birches`, `drowned`, `wood`, `sleeping`, `sea`, `mirror` or `summit`. */
  chapter: q.get('chapter'),
  /** Chapter/shot QA never reads or overwrites a player's save unless explicitly testing progress. */
  progress: q.has('progress') ? q.get('progress') === '1' : !q.has('shot') && !q.has('chapter'),
  /** Lighter simulation and world for weak GPUs (128² wind, fewer pressure iterations, sparser grass, coarser far terrain, the reflection on alternate frames). Explicit QA preset only; normal play adapts visual quality on every device. */
  lite,
  /** Fixed reflection cadence: every frame (1), alternate frames (2), or never (0). Otherwise follows world quality. */
  mirror: q.get('mirror') !== null ? Number(q.get('mirror')) || 0 : null,
  /** QA: `mirrorlod=full` gives the sea's mirror the main view's terrain detail instead of a coarser set, for comparison. */
  mirrorlod: q.get('mirrorlod') ?? 'coarse',
  /** QA: `blades=direct` uses the old per-vertex grass shader instead of the blade table, for before/after comparison. */
  blades: q.get('blades') ?? 'table',
  /** QA: `heights=direct` skips the distant-height atlas, so the ground beyond the window uses the height function as before. */
  heights: q.get('heights') ?? 'atlas',
  /** QA: `grasslod=<0|1>` is the coarsest grass level any tile may use. The picture should not change (beyond the second ring with `0`, where the finest blade has no second segment to close): a coarser level only ever stands in for blades that have already thinned and closed up to it. */
  grasslod: num('grasslod'),
  /** QA: `hold=<frame>` freezes the world after that frame (it keeps drawing the same state), so two runs can capture the very same frame. */
  hold: num('hold'),
  /** QA: an on-screen readout of frame times, quality level and readbacks, for phones. */
  stats: q.has('stats'),
  /** QA: a whale surfaces ahead of the crossing a few seconds in (and again every so often), fish leap by the boat. */
  whale: q.has('whale'),
  /** Prototype: hangs the island of lines' washing over the still island. */
  lines: q.has('lines'),
};
