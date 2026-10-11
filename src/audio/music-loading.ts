import boatsUrl from '../../assets/music/boats.ogg?url';
import homeUrl from '../../assets/music/home.ogg?url';
import linesUrl from '../../assets/music/lines.ogg?url';
import birchesUrl from '../../assets/music/birches.ogg?url';
import stillUrl from '../../assets/music/still.ogg?url';
import stillDepartureUrl from '../../assets/music/still_2.ogg?url';
import { tuning } from '../tuning';

export type MusicTrack = 'home' | 'birches' | 'lines' | 'boats' | 'still' | 'stillDeparture';
const urls: Record<MusicTrack, string> = { home: homeUrl, birches: birchesUrl, lines: linesUrl, boats: boatsUrl, still: stillUrl, stillDeparture: stillDepartureUrl };
type Download = { track: MusicTrack; controller: AbortController; bytes: Promise<ArrayBuffer> };
let prefetched: Download | null = null;

function abortable<T>(work: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () => reject(signal.reason);
    if (signal.aborted) reject(signal.reason);
    else signal.addEventListener('abort', abort, { once: true });
    work.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
  });
}

function download(track: MusicTrack): Download {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error('Music download timed out')), tuning.audio.musicLoadTimeoutMs);
  const bytes = abortable(fetch(urls[track], { signal: controller.signal }).then(response => {
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.arrayBuffer();
  }), controller.signal).finally(() => clearTimeout(timer));
  void bytes.catch(() => {});
  return { track, controller, bytes };
}

/** Keep only the next compressed recording; decoding belongs to the unlocked audio context. */
export function prefetchMusic(track: MusicTrack | null): void {
  if (prefetched?.track === track) return;
  prefetched?.controller.abort();
  prefetched = track ? download(track) : null;
}

export async function decodeMusic(ctx: BaseAudioContext, track: MusicTrack, signal: AbortSignal): Promise<AudioBuffer> {
  const pending = prefetched?.track === track ? prefetched : download(track);
  if (prefetched === pending) prefetched = null;
  const controller = new AbortController();
  const abort = () => { controller.abort(signal.reason); pending.controller.abort(); };
  signal.addEventListener('abort', abort, { once: true });
  if (signal.aborted) abort();
  const timer = setTimeout(() => {
    controller.abort(new Error('Music preparation timed out'));
    pending.controller.abort();
  }, tuning.audio.musicLoadTimeoutMs);
  try {
    const bytes = await abortable(pending.bytes, controller.signal);
    return await abortable(ctx.decodeAudioData(bytes), controller.signal);
  } finally {
    clearTimeout(timer);
    signal.removeEventListener('abort', abort);
  }
}

export function musicForStart(choice: string | { chapter: string; point?: string } | null): MusicTrack | null {
  const chapter = typeof choice === 'object' ? choice?.chapter ?? 'island' : choice ?? 'island';
  if ((chapter === 'lines' && typeof choice === 'string') || ['tree', 'toLines', 'crossing'].includes(chapter)
    || chapter === 'island' && typeof choice === 'object' && choice?.point === 'companion') return tuning.audio.stillPhraseExperiment ? 'stillDeparture' : null;
  if (chapter === 'island') return tuning.audio.stillPhraseExperiment ? 'still' : null;
  if (['lines', 'washing', 'door', 'shore', 'toBoats'].includes(chapter)) return 'lines';
  if (['boats', 'toMeadow'].includes(chapter)) return 'boats';
  if (['birches', 'autumn', 'toStairs', 'stairs', 'clouds'].includes(chapter)) return 'birches';
  if (['home', 'summit', 'jetty', 'toHarbour', 'toHome'].includes(chapter)) return 'home';
  return null;
}

export function nextMusicForChapter(chapter: string): MusicTrack | null {
  if (chapter === 'island') return tuning.audio.stillPhraseExperiment ? 'stillDeparture' : null;
  if (chapter === 'toLines') return 'lines';
  if (chapter === 'lines' || chapter === 'toBoats') return 'boats';
  if (chapter === 'meadow' || chapter === 'toBirches') return 'birches';
  if (chapter === 'mirror') return 'home';
  return null;
}
