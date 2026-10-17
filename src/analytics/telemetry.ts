import { Analytics } from './client';
import { publicConfig } from '../public-config';
import { QA } from '../qa';
import type { QualityLevelName } from '../gl/quality';
import type { ChapterName } from '../story/journey';

declare const __BUILD_ID__: string;
type Dims = Record<string, string>;
const q = new URLSearchParams(location.search);
const optedOut = q.get('analytics') === '0' || navigator.doNotTrack === '1';
const endpoint = (import.meta.env.VITE_ANALYTICS_URL ?? publicConfig.analyticsUrl ?? '').trim();
/** No persistent identity, session ID, presence heartbeat, URLs, messages or gesture coordinates. */
const client = new Analytics({
  endpoint: !optedOut && (!QA || q.get('analytics') === '1') ? endpoint : '',
  project: publicConfig.analyticsProject,
  ingestKey: import.meta.env.VITE_ANALYTICS_KEY,
  beatIntervalMs: 0,
});
const build = typeof __BUILD_ID__ === 'string' ? __BUILD_ID__ : 'development';
const environment = QA || build.endsWith('-dirty') ? 'qa' : 'production';
const chapters: Record<ChapterName, true> = {
  island: true, toLines: true, lines: true, toBoats: true, boats: true, toMeadow: true, meadow: true,
  toBirches: true, birches: true, toStairs: true, stairs: true, drowned: true, toWood: true, wood: true,
  toSleeping: true, sleeping: true, toMirror: true, mirror: true, toHarbour: true, toHome: true, home: true, stage: true,
};
let chapter = 'loading', level = 'unknown', started = false, completed = false;
let frames = 0, elapsed = 0, hitches = 0;
const failures = new Set<string>();
const band = (value: number, bounds: number[], names: string[]) => names[bounds.findIndex(b => value < b)] ?? names[names.length - 1];
function count(type: string, dims: Dims = {}): void {
  try { client.count(type, { d: { build, environment, chapter, ...dims } }); } catch { /* Never affect play. */ }
}
export const telemetry = {
  enabled: () => client.enabled(),
  loadingFinished(ms: number, worstMs: number): void {
    count('loading_finished', { duration: band(ms,[2000,5000,10000],['under_2s','2_5s','5_10s','10s_plus']), stall: band(worstMs,[50,100,250,500],['under_50ms','50_100ms','100_250ms','250_500ms','500ms_plus']) });
  },
  start(name: string, resumed: boolean, finished = false): void {
    if (started) return;
    started = true; completed = finished;
    chapter = Object.hasOwn(chapters, name) ? name : 'unknown';
    count('game_started', { mode: resumed ? 'continued' : 'new' });
    count('chapter_entered');
  },
  chapter(name: string): void {
    if (!started || name === chapter || !Object.hasOwn(chapters, name)) return;
    this.performance();
    chapter = name;
    count('chapter_entered');
  },
  quality(name: QualityLevelName): void {
    const direction = level === 'unknown' ? 'initial' : 'changed';
    this.performance();
    level = name;
    count('quality_changed', { level, direction });
  },
  frame(intervalMs: number): void {
    if (!started || !client.enabled() || document.hidden || !Number.isFinite(intervalMs) || intervalMs <= 0) return;
    elapsed += intervalMs; frames++; if (intervalMs > 50) hitches++;
  },
  performance(): void {
    if (elapsed >= 10000 && frames) {
      const fps = band(frames * 1000 / elapsed,[25,40,55],['under_25','25_39','40_54','55_plus']);
      count('performance_sampled', {
        fps, hitches: band(hitches,[1,6],['0','1_5','6_plus']), 'chapter.fps': `${chapter}.${fps}`, 'level.fps': `${level}.${fps}`,
      });
    }
    elapsed = frames = hitches = 0;
  },
  complete(): void {
    if (completed) return;
    completed = true; this.performance(); count('game_completed'); client.flush();
  },
  failure(phase: 'boot' | 'runtime' | 'promise' | 'graphics' | 'audio', error?: unknown): void {
    const kind = error instanceof TypeError ? 'type_error' : error instanceof RangeError ? 'range_error' : 'other';
    const key = `${phase}.${kind}`;
    if (failures.has(key)) return;
    failures.add(key); count('game_failed', { phase, kind }); client.flush();
  },
  recovery(): void { count('recovery_requested'); client.flush(); },
  flush(): void { this.performance(); client.flush(true); },
};
