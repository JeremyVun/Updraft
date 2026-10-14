import { decodeMusic, type MusicTrack } from './music-loading';

export type Clip = { source: AudioBufferSourceNode; gain: GainNode; finishing: boolean; at: number };

/** Excerpts of one supplied recording, each its own source on the shared audio clock, so tails may overlap. */
export class PhraseClips {
  readonly ready: Promise<void>;
  protected buffer: AudioBuffer | null = null;
  protected voice: Clip | null = null;
  protected readonly voices = new Set<Clip>();
  protected stopped = false;
  private readonly request = new AbortController();

  constructor(protected readonly ctx: BaseAudioContext, protected readonly output: AudioNode, readonly track: MusicTrack) {
    this.ready = this.load();
  }

  private async load(): Promise<void> {
    try {
      const buffer = await decodeMusic(this.ctx, this.track, this.request.signal);
      if (!this.stopped) this.buffer = buffer;
    } catch (error) {
      if (!this.stopped) console.warn(`Could not load ${this.track} phrases`, error);
    }
  }

  /** Nothing sounds, or the latest clip has played `spacing` seconds and the next may begin over its tail. */
  protected canStart(spacing: number, overlap: boolean): boolean {
    if (!this.voices.size) return true;
    return overlap && (!this.voice || this.ctx.currentTime - this.voice.at >= spacing);
  }

  protected play(from: number, to: number, level: number, fade: number, at = this.ctx.currentTime, fadeIn = .01): Clip | null {
    if (this.stopped || !this.buffer) return null;
    const source = this.ctx.createBufferSource(), gain = this.ctx.createGain();
    source.buffer = this.buffer;
    source.connect(gain); gain.connect(this.output);
    const duration = Math.min(to, this.buffer.duration) - from;
    const fadeOut = Math.min(fade, duration / 2);
    gain.gain.value = 0;
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(level, at + Math.min(fadeIn, duration / 4));
    gain.gain.setValueAtTime(level, at + duration - fadeOut);
    gain.gain.linearRampToValueAtTime(0, at + duration);
    const clip = { source, gain, finishing: false, at };
    this.voice = clip;
    this.voices.add(clip);
    source.onended = () => {
      source.disconnect(); source.buffer = null; gain.disconnect();
      this.voices.delete(clip);
      if (this.voice === clip) this.voice = null;
    };
    source.start(at, from, duration);
    return clip;
  }

  protected release(clip: Clip, fade: number): void {
    if (clip.finishing) return;
    const now = this.ctx.currentTime, end = Math.max(now, clip.at) + fade;
    clip.finishing = true;
    clip.gain.gain.cancelAndHoldAtTime(now);
    clip.gain.gain.setValueAtTime(clip.gain.gain.value, now);
    clip.gain.gain.linearRampToValueAtTime(0, end);
    clip.source.stop(end);
  }

  handoffAt(now: number): number { return now; }

  finish(fade: number): void {
    for (const clip of this.voices) this.release(clip, fade);
  }

  stop(fade: number): void {
    this.stopped = true;
    this.request.abort(); this.buffer = null;
    this.finish(fade);
  }
}
