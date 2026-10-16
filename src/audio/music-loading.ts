import boatsUrl from '../../assets/music/boats.ogg?url';
import homeUrl from '../../assets/music/home.ogg?url';
import linesUrl from '../../assets/music/lines.ogg?url';
import birchesUrl from '../../assets/music/red_door.ogg?url';
import stairsUrl from '../../assets/music/birches.ogg?url';
import cloudsUrl from '../../assets/music/clouds.ogg?url';
import mirrorUrl from '../../assets/music/mirror.ogg?url';
import seaUrl from '../../assets/music/sea.ogg?url';
import stillUrl from '../../assets/music/still.ogg?url';
import stillDepartureUrl from '../../assets/music/still_2.ogg?url';
import villageApproachUrl from '../../assets/music/village_approach.ogg?url';
import belfryUrl from '../../assets/music/belfry.ogg?url';
import belfryEndingUrl from '../../assets/music/belfry_ending.ogg?url';
import sleepingUrl from '../../assets/music/sleeping.ogg?url';
import cygnetBraveUrl from '../../assets/music/cygnet_brave.ogg?url';
import type { SleepingGate } from './sleeping-music';
import type { StairsPhase } from './stairs-air';
import { tuning } from '../tuning';

export type MusicTrack = 'home' | 'mirror' | 'sea' | 'birches' | 'stairs' | 'clouds' | 'villageApproach' | 'belfry' | 'sleeping' | 'cygnetBrave' | 'lines' | 'boats' | 'still' | 'stillDeparture';
const urls: Record<MusicTrack, string> = { home: homeUrl, mirror: mirrorUrl, sea: seaUrl, birches: birchesUrl, stairs: stairsUrl, clouds: cloudsUrl,
  villageApproach: villageApproachUrl, belfry: belfryUrl, sleeping: sleepingUrl, cygnetBrave: cygnetBraveUrl, lines: linesUrl, boats: boatsUrl,
  still: stillUrl, stillDeparture: stillDepartureUrl };
/** Derived endings (`recordedMusicOnce` `ending`), fetched and decoded with their recordings. */
const endings: Partial<Record<MusicTrack, string>> = { belfry: belfryEndingUrl };
type Download = { track: MusicTrack; controller: AbortController; bytes: Promise<ArrayBuffer[]> };
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
  const parts = [urls[track], endings[track]].filter((url): url is string => !!url);
  const bytes = abortable(Promise.all(parts.map(url => fetch(url, { signal: controller.signal }).then(response => {
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.arrayBuffer();
  }))), controller.signal).finally(() => clearTimeout(timer));
  void bytes.catch(() => {});
  return { track, controller, bytes };
}

/** Keep only the next compressed recording; decoding belongs to the unlocked audio context. */
export function prefetchMusic(track: MusicTrack | null): void {
  if (prefetched?.track === track) return;
  prefetched?.controller.abort();
  prefetched = track ? download(track) : null;
}

/**
 * The recording, then its ending where it has one. A failed download or decode is fetched afresh after each of
 * `musicRetryAfter`, within the one deadline.
 */
export async function decodeMusic(ctx: BaseAudioContext, track: MusicTrack, signal: AbortSignal): Promise<AudioBuffer[]> {
  let pending = prefetched?.track === track ? prefetched : download(track);
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
    for (let attempt = 0; ; attempt++) {
      try {
        const bytes = await abortable(pending.bytes, controller.signal);
        return await abortable(Promise.all(bytes.map(part => ctx.decodeAudioData(part))), controller.signal);
      } catch (error) {
        const wait = tuning.audio.musicRetryAfter[attempt];
        if (controller.signal.aborted || wait === undefined) throw error;
        console.warn(`Retrying ${track} music`, error);
        await abortable(new Promise(resolve => setTimeout(resolve, wait * 1000)), controller.signal);
        pending = download(track);
      }
    }
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
  // Past the loop the stairs song has faded in the white; the top of the cloud is next.
  if (['cloud', 'nest'].includes(chapter) || chapter === 'stairs' && typeof choice === 'object' && choice?.point === 'cloud') return 'clouds';
  if (['birches', 'autumn'].includes(chapter)) return 'birches';
  // The birches' recording never begins once they have sailed: a crossing start is quiet until the stairs song.
  if (['stairs', 'clouds'].includes(chapter)) return 'stairs';
  // The village's start has its approach; a storm save is past the bells, so the belfry's goodbye plays on load.
  if (['drowned', 'village'].includes(chapter) && (typeof choice !== 'object' || !choice?.point)) return 'villageApproach';
  if (chapter === 'storm' || chapter === 'drowned' && typeof choice === 'object' && choice?.point === 'storm') return 'belfry';
  // Sleeping starts at bedtime with its lullaby; the feather's save resumes the climb; its morning is silent until the sea.
  if (chapter === 'ribbon') return 'cygnetBrave';
  if (chapter === 'sleeping') {
    const point = typeof choice === 'object' ? choice?.point : undefined;
    return point === 'feather' ? 'cygnetBrave' : point === 'morning' ? null : 'sleeping';
  }
  if (['toMirror', 'sea', 'dolphins', 'whale'].includes(chapter)) return 'sea';
  if (chapter === 'mirror' || chapter === 'mirrorEnd') return 'mirror';
  if (['home', 'summit', 'jetty', 'toHarbour', 'toHome'].includes(chapter)) return 'home';
  return null;
}

/**
 * In the stairs, `stairs` says where: once they are up in the white, `clouds.ogg` is in hand and the village is next.
 * In Sleeping, `sleeping` does: the climb's recording until she is asleep, then the sea's.
 */
export function nextMusicForChapter(chapter: string, stairs?: StairsPhase, sleeping?: SleepingGate): MusicTrack | null {
  if (chapter === 'island') return tuning.audio.stillPhraseExperiment ? 'stillDeparture' : null;
  if (chapter === 'toLines') return 'lines';
  if (chapter === 'lines' || chapter === 'toBoats') return 'boats';
  if (chapter === 'meadow' || chapter === 'toBirches') return 'birches';
  if (chapter === 'birches' || chapter === 'toStairs') return 'stairs';
  if (chapter === 'stairs' && stairs && stairs !== 'under') return 'villageApproach';
  if (chapter === 'stairs') return 'clouds';
  if (chapter === 'drowned') return 'belfry';
  if (chapter === 'wood' || chapter === 'toSleeping') return 'sleeping';
  if (chapter === 'sleeping') return sleeping === 'bedtime' || sleeping === 'asleep' ? 'cygnetBrave' : 'sea';
  if (chapter === 'toMirror') return 'mirror';
  if (chapter === 'mirror') return 'home';
  return null;
}
