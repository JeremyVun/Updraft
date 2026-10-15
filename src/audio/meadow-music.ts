import walkUrl from '../../assets/music/meadow-walk.ogg?url';
import duetUrl from '../../assets/music/meadow-duet.ogg?url';
import afterUrl from '../../assets/music/meadow-after.ogg?url';
import endingUrl from '../../assets/music/meadow-ending.ogg?url';
import { MEADOW_MEASURED } from './meadow-cuts-measured';
import type { DuetClip, MeadowAnswer } from './meadow-duet';
import { tuning } from '../tuning';

/**
 * Where the meadow's music is: the walk to the stool, the duet, the warm bed through the flowers and seeds, the
 * listening rest and the family's departure in silence, and the ending from the feather. `onward` is the crossing
 * after it, which lets whatever is sounding finish and starts nothing.
 */
export type MeadowMusicPart = 'walk' | 'duet' | 'after' | 'listen' | 'quiet' | 'ending' | 'onward';
export type MeadowFile = 'walk' | 'duet' | 'after' | 'ending';

const URLS: Record<MeadowFile, string> = { walk: walkUrl, duet: duetUrl, after: afterUrl, ending: endingUrl };
const BEDS = { walk: MEADOW_MEASURED.walk, after: MEADOW_MEASURED.after, ending: MEADOW_MEASURED.ending };
type Bed = keyof typeof BEDS;
const TRIM: Record<Bed, () => number> = { walk: () => tuning.meadowMusic.walkDb, after: () => tuning.meadowMusic.afterDb, ending: () => tuning.meadowMusic.endingDb };
const gain = (db: number) => 10 ** (db / 20);

/** Which files the meadow needs soon, from where the story is: the walk and duet ahead of it, the rest during it. */
export function meadowFilesAhead(chapter: string, part: MeadowMusicPart | undefined, music: boolean): MeadowFile[] {
  const files: MeadowFile[] = chapter === 'boats' || chapter === 'toMeadow' ? ['walk', 'duet']
    : chapter !== 'meadow' ? []
    : part === 'walk' ? ['walk', 'duet']
    : part === 'duet' ? ['duet', 'after', 'ending']
    : part === 'after' ? ['after', 'ending']
    : part === 'ending' || part === 'listen' || part === 'quiet' ? ['ending'] : [];
  return music ? files : files.filter(file => file === 'duet');
}

/** What a restored meadow plays first, which the start waits to have decoded. */
export function meadowFilesAt(part: MeadowMusicPart | undefined): MeadowFile[] {
  return part === 'walk' ? ['walk', 'duet'] : part === 'duet' ? ['duet'] : part === 'after' ? ['after']
    : part === 'ending' ? ['ending'] : [];
}

interface Download { controller: AbortController; bytes: Promise<ArrayBuffer> }
interface Voice { source: AudioBufferSourceNode; gain: GainNode; ends: number }

/**
 * The meadow's recordings. Its background (walk, warm bed, ending) goes through the music gates like every other
 * room's; the duet's calls, answers and finale are the bough's and the piano's own voices, so they sound with the
 * instruments, as their synthesised voices did. Buffers are decoded when a part is near and released once played.
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
  private bed: { name: Bed; bus: GainNode; voices: Set<Voice>; next: number; once: boolean } | null = null;
  private endingPlayed = false;
  private answer = -1;
  private readonly answerVoices: Voice[] = [];
  private lastNote = -Infinity;
  /** QA: what was last sounded from the duet, on the audio clock. */
  readonly log: { at: number; what: string }[] = [];

  attach(ctx: BaseAudioContext, instrument: AudioNode, background: AudioNode): void {
    if (this.ctx === ctx) return;
    this.stop(0);
    this.buffers.clear(); this.decoding.clear(); this.failed.clear();
    this.ctx = ctx; this.instrument = instrument; this.background = background;
  }

  /** QA: the part, the bed sounding and what is decoded. */
  get state(): { part: MeadowMusicPart | undefined; bed: string | null; decoded: MeadowFile[]; endingPlayed: boolean } {
    return { part: this.part, bed: this.bed ? `${this.bed.name}${this.bed.voices.size ? '' : ' (resting)'}` : null,
      decoded: [...this.buffers.keys()], endingPlayed: this.endingPlayed };
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
        for (const file of ['walk', 'duet', 'after', 'ending'] as const) this.release(file);
        this.endingPlayed = false;
      }
      this.part = undefined;
      return;
    }
    this.part = part;
    const music = (file: MeadowFile) => !musicMuted || this.buffers.has(file);
    const ahead = (file: MeadowFile) => { if (music(file)) void this.prepare(file); };
    if (part === 'walk' || part === 'duet') void this.prepare('duet');
    if (part === 'duet') ahead('after');
    if (part === 'after' || part === 'listen' || part === 'quiet') ahead('ending');
    if (part !== 'walk' && this.bed?.name !== 'walk') this.release('walk');
    if (part !== 'walk' && part !== 'duet') this.release('duet');
    if (part !== 'walk' && part !== 'duet' && part !== 'after') this.release('after');

    // The walk is never begun at the stool, the ending only once, and the crossing on from the meadow begins nothing.
    const current = this.bed?.name ?? null;
    const want: Bed | null = part === 'walk' ? 'walk' : part === 'duet' ? (current === 'walk' ? 'walk' : null)
      : part === 'after' ? 'after' : part === 'ending' ? (current === 'ending' || !this.endingPlayed ? 'ending' : null)
      : part === 'onward' ? current : null;
    if (this.bed && this.bed.name !== want) this.fadeBed(part === 'listen' ? tuning.meadowMusic.listenFade : 1.8);
    if (want && !this.bed && part !== 'duet' && part !== 'onward' && music(want)) {
      const buffer = this.buffers.get(want);
      if (!buffer) void this.prepare(want);
      else if (want !== 'walk' || open) {
        const bus = ctx.createGain();
        bus.gain.value = 0;
        bus.connect(this.background!);
        this.bed = { name: want, bus, voices: new Set(), next: now + 0.05, once: want === 'ending' };
        if (want === 'ending') this.endingPlayed = true;
      }
    }
    const bed = this.bed;
    if (!bed) return;
    if (bed.name === 'walk' && part === 'duet' && stool <= 0.001) { this.fadeBed(0.1); return; }
    if (bed.once && bed.next === Infinity && bed.voices.size === 0) { this.fadeBed(0); this.release(bed.name); return; }
    const level = gain(BEDS[bed.name].gainDb + TRIM[bed.name]()) * (bed.name === 'walk' ? Math.max(0, stool) : 1);
    bed.bus.gain.setTargetAtTime(level, now, 0.08);
    const buffer = this.buffers.get(bed.name);
    if (buffer && now + 0.25 >= bed.next) {
      const clip = BEDS[bed.name], at = Math.max(now, bed.next);
      this.voice(buffer, clip.at, clip.duration, at, bed.bus, 1, bed.voices);
      bed.next = bed.once ? Infinity : at + clip.duration + clip.rest;
    }
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

  private voice(buffer: AudioBuffer, offset: number, duration: number, at: number, out: AudioNode, level: number, into?: Set<Voice> | Voice[]): Voice {
    const ctx = this.ctx!;
    const source = ctx.createBufferSource(), g = ctx.createGain();
    source.buffer = buffer;
    g.gain.value = 0;
    g.gain.setValueAtTime(level, at);
    source.connect(g).connect(out);
    const voice = { source, gain: g, ends: at + duration };
    source.onended = () => {
      source.disconnect(); g.disconnect(); source.buffer = null;
      if (into instanceof Set) into.delete(voice);
      else if (into) { const i = into.indexOf(voice); if (i >= 0) into.splice(i, 1); }
    };
    source.start(at, offset, duration);
    if (into instanceof Set) into.add(voice); else into?.push(voice);
    return voice;
  }

  /** A bough call or the finale, `late` seconds into its recording. False if the duet is not decoded yet. */
  phrase(clip: DuetClip, late: number, what: string, trimDb: number): boolean {
    const buffer = this.buffers.get('duet'), ctx = this.ctx;
    if (!buffer || !ctx || !this.instrument || late >= clip.duration) return false;
    const now = ctx.currentTime, skip = Math.max(0, late);
    this.voice(buffer, clip.at + skip, clip.duration - skip, now, this.instrument, gain(clip.gainDb + trimDb));
    this.note(now, what);
    return true;
  }

  /**
   * One traced note of an answer. It starts on its onset and rings; the note before it eases down by
   * `answerEaseDb` over `answerEase`, and a fast stroke's notes are spaced `answerGap` apart rather than struck together.
   */
  answerNote(reply: MeadowAnswer, k: number): boolean {
    const buffer = this.buffers.get('duet'), ctx = this.ctx, note = reply.notes[k];
    if (!buffer || !ctx || !this.instrument || !note) return false;
    const t = tuning.meadowMusic;
    if (reply.index !== this.answer) { this.answer = reply.index; this.lastNote = -Infinity; }
    const at = Math.max(ctx.currentTime, this.lastNote + t.answerGap);
    this.lastNote = at;
    for (const older of this.answerVoices) {
      if (older.ends <= at) continue;
      const g = older.gain.gain;
      g.cancelAndHoldAtTime(at);
      g.setTargetAtTime(gain(t.answerEaseDb) * g.value, at, t.answerEase / 3);
    }
    this.voice(buffer, note.at, note.duration, at, this.instrument, gain(note.gainDb + t.answerDb), this.answerVoices);
    this.note(at, `answer ${reply.index + 1} note ${k + 1}`);
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
    for (const voice of this.answerVoices) {
      voice.gain.gain.cancelAndHoldAtTime(now);
      voice.gain.gain.setValueAtTime(voice.gain.gain.value, now);
      voice.gain.gain.linearRampToValueAtTime(0, now + Math.max(0.02, fade));
      voice.source.stop(now + Math.max(0.02, fade));
    }
  }
}

export const meadowMusic = new MeadowMusic();
