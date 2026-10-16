import walkUrl from '../../assets/music/meadow-walk.ogg?url';
import duetUrl from '../../assets/music/meadow-duet.ogg?url';
import afterUrl from '../../assets/music/meadow-after.ogg?url';
import { MEADOW_MEASURED } from './meadow-cuts-measured';
import type { DuetClip } from './meadow-duet';
import { tuning } from '../tuning';

/**
 * Where the meadow's music is: the walk to the stool, the duet, then the warm bed from the duet's end to the boat,
 * lowered a little under the family's calls (`swans`); `boat` is the way on after them, where a bed begun afresh (a
 * restored save) starts at its loop rather than its opening. `onward` is the push off and the crossing: the warm bed
 * goes over at its next phrase end into its own close and plays to the end, and nothing new begins.
 */
export type MeadowMusicPart = 'walk' | 'duet' | 'after' | 'swans' | 'boat' | 'onward';
export type MeadowFile = 'walk' | 'duet' | 'after';

const URLS: Record<MeadowFile, string> = { walk: walkUrl, duet: duetUrl, after: afterUrl };
const BEDS = { walk: MEADOW_MEASURED.walk, after: MEADOW_MEASURED.after };
type Bed = keyof typeof BEDS;
const TRIM: Record<Bed, () => number> = { walk: () => tuning.meadowMusic.walkDb, after: () => tuning.meadowMusic.afterDb };
const FADE_IN: Record<Bed, () => number> = { walk: () => 0, after: () => tuning.meadowMusic.afterFadeIn };
const gain = (db: number) => 10 ** (db / 20);
const smoothstep = (x: number) => { const k = Math.min(1, Math.max(0, x)); return k * k * (3 - 2 * k); };
/** Equal-power halves of the crossfade from the warm bed into its close. */
const OUT = Float32Array.from({ length: 64 }, (_, i) => Math.cos(i / 63 * Math.PI / 2));
const IN = Float32Array.from({ length: 64 }, (_, i) => Math.sin(i / 63 * Math.PI / 2));

/**
 * When the warm bed, begun at `startedAt` and looping natively, next reaches one of its phrase ends into the close no
 * sooner than `earliest`: seconds on the audio clock.
 */
export function nextCloseSeam(startedAt: number, earliest: number): number {
  const { loopStart, loopEnd, seams } = MEADOW_MEASURED.after, span = loopEnd - loopStart, from = earliest - startedAt;
  let best = Infinity;
  for (const seam of seams) {
    if (seam >= from) best = Math.min(best, seam);
    if (seam >= loopStart) {
      const first = loopEnd + seam - loopStart;
      best = Math.min(best, first + Math.max(0, Math.ceil((from - first) / span)) * span);
    }
  }
  return startedAt + best;
}

/** Which files the meadow needs soon, from where the story is: the walk and duet ahead of it, the rest during it. */
export function meadowFilesAhead(chapter: string, part: MeadowMusicPart | undefined, music: boolean): MeadowFile[] {
  const files: MeadowFile[] = chapter === 'boats' || chapter === 'toMeadow' ? ['walk', 'duet']
    : chapter !== 'meadow' ? []
    : part === 'walk' ? ['walk', 'duet']
    : part === 'duet' ? ['duet', 'after'] : ['after'];
  return music ? files : files.filter(file => file === 'duet');
}

/** What a restored meadow plays first, which the start waits to have decoded. */
export function meadowFilesAt(part: MeadowMusicPart | undefined): MeadowFile[] {
  return part === 'walk' ? ['walk', 'duet'] : part === 'duet' ? ['duet'] : part === 'onward' || part === undefined ? [] : ['after'];
}

interface Download { controller: AbortController; bytes: Promise<ArrayBuffer> }
interface Voice { source: AudioBufferSourceNode; gain: GainNode; ends: number }
interface Sounding {
  name: Bed; bus: GainNode; voices: Set<Voice>; next: number; once: boolean; from: number;
  /** Seconds into its cut that it begins. */
  start: number;
  /** When its looping voice would have begun, had it started from the top of the cut. */
  startedAt?: number;
  /** When its close, once under way, has played to the end. */
  closesAt?: number;
}

/**
 * The meadow's recordings. Its background (walk, warm bed) goes through the music gates like every other room's; the
 * duet's calls, answers and finale are the bough's and the piano's own voices, so they sound with the instruments, as
 * their synthesised voices did. Buffers are decoded when a part is near and released once played.
 */
class MeadowMusic {
  private ctx: BaseAudioContext | null = null;
  private instrument: AudioNode | null = null;
  private background: AudioNode | null = null;
  private readonly downloads = new Map<MeadowFile, Download>();
  private readonly decoding = new Map<MeadowFile, Promise<AudioBuffer | null>>();
  private readonly buffers = new Map<MeadowFile, AudioBuffer>();
  private readonly failed = new Set<MeadowFile>();
  private wanted = '';
  private part: MeadowMusicPart | undefined;
  private bed: Sounding | null = null;
  /** How far the warm bed has gone down for the family's calls, 0..1, on the audio clock. */
  private dip = 0;
  private dipAt = 0;
  private readonly duetVoices = new Set<Voice>();
  /** QA: what was last sounded from the duet, on the audio clock. */
  readonly log: { at: number; what: string }[] = [];

  attach(ctx: BaseAudioContext, instrument: AudioNode, background: AudioNode): void {
    if (this.ctx === ctx) return;
    this.stop(0);
    this.buffers.clear(); this.decoding.clear(); this.failed.clear();
    this.ctx = ctx; this.instrument = instrument; this.background = background;
  }

  /** QA: the part, the bed sounding, how far it is down for the family, and what is decoded. */
  get state(): { part: MeadowMusicPart | undefined; bed: string | null; dip: number; closesAt: number | undefined; decoded: MeadowFile[] } {
    return { part: this.part, bed: this.bed ? `${this.bed.name}${this.bed.voices.size ? '' : ' (resting)'}` : null,
      dip: this.dip, closesAt: this.bed?.closesAt, decoded: [...this.buffers.keys()] };
  }

  /** While the warm bed plays out to its close: when it has finished, on the audio clock, which the next room's music waits for. */
  get closesAt(): number | undefined {
    return this.bed?.closesAt;
  }

  /** Keeps the compressed files the story needs soon, and only those that are not already decoded or decoding. */
  prefetch(files: MeadowFile[]): void {
    const key = files.join();
    if (key === this.wanted) return;
    this.wanted = key;
    for (const [file, download] of this.downloads) {
      if (!files.includes(file) && !this.decoding.has(file)) { download.controller.abort(); this.downloads.delete(file); }
    }
    for (const file of files) if (!this.downloads.has(file) && !this.buffers.has(file)) this.downloads.set(file, this.download(file));
  }

  private download(file: MeadowFile): Download {
    const controller = new AbortController();
    const bytes = fetch(URLS[file], { signal: controller.signal }).then(response => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.arrayBuffer();
    });
    void bytes.catch(() => {});
    return { controller, bytes };
  }

  /** Decodes a file once, retrying a failed fetch after each of `musicRetryAfter`; null if it cannot be had. */
  prepare(file: MeadowFile): Promise<AudioBuffer | null> {
    const ready = this.buffers.get(file);
    if (ready) return Promise.resolve(ready);
    const pending = this.decoding.get(file);
    if (pending) return pending;
    const ctx = this.ctx;
    if (!ctx || this.failed.has(file)) return Promise.resolve(null);
    let work: Promise<AudioBuffer | null>;
    // Released or replaced while it was decoding, the result is dropped.
    const live = () => this.ctx === ctx && this.decoding.get(file) === work;
    work = (async () => {
      for (let attempt = 0; ; attempt++) {
        const download = this.downloads.get(file) ?? this.download(file);
        this.downloads.delete(file);
        try {
          const buffer = await ctx.decodeAudioData(await download.bytes);
          if (!live()) return null;
          this.buffers.set(file, buffer);
          return buffer;
        } catch (error) {
          const wait = tuning.audio.musicRetryAfter[attempt];
          if (!live()) return null;
          if (wait === undefined) { console.warn(`Could not load meadow ${file} music`, error); this.failed.add(file); return null; }
          await new Promise(resolve => setTimeout(resolve, wait * 1000));
        }
      }
    })().finally(() => { if (this.decoding.get(file) === work) this.decoding.delete(file); });
    this.decoding.set(file, work);
    return work;
  }

  /** Resolves once the start's first music is decoded, or after the shared deadline. */
  prepareFor(files: MeadowFile[]): Promise<void> {
    const all = Promise.all(files.map(file => this.prepare(file))).then(() => undefined);
    return Promise.race([all, new Promise<void>(resolve => setTimeout(resolve, tuning.audio.musicLoadTimeoutMs))]);
  }

  private release(file: MeadowFile): void {
    this.buffers.delete(file);
    this.decoding.delete(file);
  }

  /**
   * Once a frame from the soundscape. `stool` is the walk's fade as she sits (1 − `pianoMix`); `open` says the
   * background gate is open, so a walk arriving through the handoff begins on its first note rather than under the
   * gate's rise. Leaving the meadow (`part` undefined) fades what is sounding over `fade` and lets every buffer go.
   */
  update(part: MeadowMusicPart | undefined, stool: number, musicMuted: boolean, open: boolean, fade: number): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const now = ctx.currentTime;
    if (part === undefined) {
      if (this.part !== undefined) {
        this.stop(fade);
        for (const file of ['walk', 'duet', 'after'] as const) this.release(file);
      }
      this.part = undefined;
      return;
    }
    this.part = part;
    const music = (file: MeadowFile) => !musicMuted || this.buffers.has(file);
    if (part === 'walk' || part === 'duet') void this.prepare('duet');
    if (part === 'duet' && music('after')) void this.prepare('after');
    if (part !== 'walk' && this.bed?.name !== 'walk') this.release('walk');
    if (part !== 'walk' && part !== 'duet') this.release('duet');

    // The walk is never begun at the stool, and the push off and the crossing begin nothing.
    const current = this.bed?.name ?? null;
    const want: Bed | null = part === 'walk' ? 'walk' : part === 'duet' ? (current === 'walk' ? 'walk' : null)
      : part === 'onward' ? current : 'after';
    if (this.bed && this.bed.name !== want) this.fadeBed(1.8);
    if (want && !this.bed && part !== 'duet' && part !== 'onward' && music(want)) {
      const buffer = this.buffers.get(want);
      if (!buffer) void this.prepare(want);
      else if (want !== 'walk' || open) {
        const bus = ctx.createGain();
        bus.gain.value = 0;
        bus.connect(this.background!);
        this.bed = { name: want, bus, voices: new Set(), next: now + 0.05, once: false, from: now + 0.05,
          start: part === 'boat' ? BEDS.after.loopStart : 0 };
      }
    }
    const { swanDipDb, swanDipIn, swanDipOut } = tuning.meadowMusic;
    const elapsed = Math.max(0, now - this.dipAt);
    this.dip = part === 'swans' ? Math.min(1, this.dip + elapsed / swanDipIn) : Math.max(0, this.dip - elapsed / swanDipOut);
    this.dipAt = now;
    const bed = this.bed;
    if (!bed) return;
    if (bed.name === 'walk' && part === 'duet' && stool <= 0.001) { this.fadeBed(0.1); return; }
    if (bed.once && bed.next === Infinity && bed.voices.size === 0) { this.fadeBed(0); this.release(bed.name); return; }
    const fadeIn = FADE_IN[bed.name]();
    const rise = fadeIn > 0 ? smoothstep((now - bed.from) / fadeIn) : 1;
    const level = gain(BEDS[bed.name].gainDb + TRIM[bed.name]() + swanDipDb * smoothstep(this.dip))
      * (bed.name === 'walk' ? Math.max(0, stool) : 1) * rise;
    bed.bus.gain.setTargetAtTime(level, now, 0.08);
    const buffer = this.buffers.get(bed.name);
    if (buffer && now + 0.25 >= bed.next) {
      const clip = BEDS[bed.name], at = Math.max(now, bed.next);
      // The warm bed loops natively, round its seam, with no rest; the walk rests between its passes.
      const loop = 'loopEnd' in clip ? [clip.at + clip.loopStart, clip.at + clip.loopEnd] as const : undefined;
      this.voice(buffer, clip.at + bed.start, clip.duration - bed.start, at, bed.bus, 1, bed.voices, loop);
      if (loop) bed.startedAt = at - bed.start;
      bed.next = bed.once || loop ? Infinity : at + clip.duration + clip.rest;
    }
    if (part === 'onward' && bed.name === 'after' && bed.startedAt !== undefined && bed.closesAt === undefined && buffer) {
      this.close(bed, buffer, now);
    }
  }

  /**
   * The warm bed stops looping: at its next phrase end into the close it crossfades (equal power, as its loop does)
   * into the cadence the take ends on, which plays to the end of the recording.
   */
  private close(bed: Sounding, buffer: AudioBuffer, now: number): void {
    const { close, crossfade } = MEADOW_MEASURED.after;
    const seam = nextCloseSeam(bed.startedAt!, now + crossfade + 0.1), from = seam - crossfade;
    if (!Number.isFinite(seam)) { this.fadeBed(1.8); return; }
    for (const voice of bed.voices) {
      voice.gain.gain.setValueCurveAtTime(OUT, from, crossfade);
      voice.source.stop(seam + 0.02);
    }
    const into = this.voice(buffer, close.at + close.entry - crossfade, close.duration - close.entry + crossfade, from, bed.bus, 1, bed.voices);
    into.gain.gain.cancelScheduledValues(0);
    into.gain.gain.setValueCurveAtTime(IN, from, crossfade);
    bed.once = true;
    bed.closesAt = seam + close.duration - close.entry;
  }

  private fadeBed(fade: number): void {
    const bed = this.bed;
    if (!bed || !this.ctx) return;
    this.bed = null;
    const now = this.ctx.currentTime, g = bed.bus.gain;
    g.cancelAndHoldAtTime(now);
    g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(0, now + fade);
    for (const voice of bed.voices) voice.source.stop(now + fade);
    if (!bed.voices.size) bed.bus.disconnect();
    else for (const voice of bed.voices) voice.source.addEventListener('ended', () => { if (!bed.voices.size) bed.bus.disconnect(); });
  }

  private voice(buffer: AudioBuffer, offset: number, duration: number, at: number, out: AudioNode, level: number,
    into?: Set<Voice> | Voice[], loop?: readonly [number, number]): Voice {
    const ctx = this.ctx!;
    const source = ctx.createBufferSource(), g = ctx.createGain();
    source.buffer = buffer;
    g.gain.value = 0;
    g.gain.setValueAtTime(level, at);
    source.connect(g).connect(out);
    const voice = { source, gain: g, ends: loop ? Infinity : at + duration };
    source.onended = () => {
      source.disconnect(); g.disconnect(); source.buffer = null;
      if (into instanceof Set) into.delete(voice);
      else if (into) { const i = into.indexOf(voice); if (i >= 0) into.splice(i, 1); }
    };
    if (loop) {
      source.loop = true;
      [source.loopStart, source.loopEnd] = loop;
      source.start(at, offset);
    } else source.start(at, offset, duration);
    if (into instanceof Set) into.add(voice); else into?.push(voice);
    return voice;
  }

  /**
   * A phrase of the duet (a bough call, her answer, the finale or a cygnet's step), `late` seconds into its recording,
   * at its measured gain plus `trimDb`. False if the duet is not decoded yet.
   */
  duet(clip: DuetClip, late: number, what: string, trimDb: number): boolean {
    const buffer = this.buffers.get('duet'), ctx = this.ctx;
    if (!buffer || !ctx || !this.instrument || late >= clip.duration) return false;
    const now = ctx.currentTime, skip = Math.max(0, late);
    this.voice(buffer, clip.at + skip, clip.duration - skip, now, this.instrument, gain(clip.gainDb + trimDb), this.duetVoices);
    this.note(now, what);
    return true;
  }

  private note(at: number, what: string): void {
    this.log.push({ at: Math.round(at * 100) / 100, what });
    if (this.log.length > 60) this.log.shift();
  }

  stop(fade = 1.8): void {
    this.fadeBed(fade);
    const ctx = this.ctx;
    if (!ctx) return;
    const now = ctx.currentTime;
    for (const voice of this.duetVoices) {
      voice.gain.gain.cancelAndHoldAtTime(now);
      voice.gain.gain.setValueAtTime(voice.gain.gain.value, now);
      voice.gain.gain.linearRampToValueAtTime(0, now + Math.max(0.02, fade));
      voice.source.stop(now + Math.max(0.02, fade));
    }
  }
}

export const meadowMusic = new MeadowMusic();
