import { decodeMusic } from './music-loading';
import { tuning } from '../tuning';

export type RecordedMusic = 'home' | 'birches' | 'lines' | 'boats' | 'stillDeparture';

export class RecordedScore {
  readonly ready: Promise<void>;
  private readonly bus: GainNode;
  private readonly request = new AbortController();
  private buffer: AudioBuffer | null = null;
  private source: AudioBufferSourceNode | null = null;
  private stopped = false;
  private active = false;
  private offset = 0;
  private level = 0;
  phase = '';
  private epoch = 0;
  private endsAt = Infinity;

  constructor(private readonly ctx: BaseAudioContext, output: AudioNode, readonly track: RecordedMusic) {
    this.bus = ctx.createGain();
    this.bus.gain.value = 0;
    this.bus.connect(output);
    this.ready = this.load();
  }

  private async load(): Promise<void> {
    try {
      const buffer = await decodeMusic(this.ctx, this.track, this.request.signal);
      if (this.stopped) return;
      this.buffer = buffer;
      this.play();
    } catch (error) {
      if (!this.stopped) console.warn(`Could not load ${this.track} music`, error);
    }
  }

  update(phase: string, level: number, offset = 0): void {
    if (this.stopped) return;
    this.phase = phase;
    if (!this.active) this.offset = offset;
    this.active = true;
    this.level = level;
    if (this.source) this.bus.gain.setTargetAtTime(level, this.ctx.currentTime, tuning.audio.recordedMusicFade);
    this.play();
  }

  private play(): void {
    if (this.stopped || !this.active || !this.buffer || this.source) return;
    const source = this.ctx.createBufferSource();
    source.buffer = this.buffer;
    source.loop = this.track !== 'stillDeparture';
    this.epoch = this.ctx.currentTime;
    const offset = source.loop ? this.offset % this.buffer.duration : Math.min(this.offset, this.buffer.duration);
    const envelope = source.loop ? null : this.ctx.createGain();
    if (envelope) {
      const duration = Math.max(0, Math.min(this.buffer.duration, tuning.audio.stillDepartureEnd) - offset);
      this.endsAt = this.epoch + duration;
      envelope.gain.setValueAtTime(1, Math.max(this.epoch, this.endsAt - tuning.audio.stillDepartureFadeOut));
      envelope.gain.linearRampToValueAtTime(0, this.endsAt);
      envelope.connect(this.bus);
    }
    source.connect(envelope ?? this.bus);
    this.bus.gain.setTargetAtTime(this.level, this.epoch, tuning.audio.recordedMusicFade);
    source.onended = () => {
      source.disconnect();
      envelope?.disconnect();
      source.buffer = null;
      this.source = null;
      this.bus.disconnect();
    };
    source.start(this.epoch, offset);
    if (envelope) source.stop(this.endsAt);
    this.source = source;
    this.buffer = null;
  }

  handoffAt(now: number): number {
    return this.track === 'stillDeparture' && Number.isFinite(this.endsAt) ? Math.max(now, this.endsAt) : now;
  }

  stop(fade = 1.8): void {
    if (this.stopped) return;
    this.stopped = true;
    this.request.abort();
    this.buffer = null;
    if (!this.source) { this.bus.disconnect(); return; }
    const now = this.ctx.currentTime;
    this.bus.gain.cancelAndHoldAtTime(now);
    this.bus.gain.setValueAtTime(this.bus.gain.value, now);
    this.bus.gain.linearRampToValueAtTime(0, now + fade);
    this.source.stop(Math.min(now + fade, this.endsAt));
  }
}
