import { decodeMusic } from './music-loading';
import { tuning } from '../tuning';

export type RecordedMusic = 'home' | 'mirror' | 'birches' | 'stairs' | 'clouds' | 'villageApproach' | 'belfry' | 'lines' | 'boats' | 'stillDeparture';

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
  private late = false;
  private keepTime = false;
  private asked = 0;
  private length = 0;
  private start = 0;
  /** Fading itself out to a scheduled end; level changes no longer apply. */
  private finishing = false;
  /** No longer looping: the pass under way plays to the end of the file and stops. */
  private playingOut = false;
  /** Between passes of a recording that rests before it goes round: the next begins from its top then. */
  private restUntil = -Infinity;

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

  /**
   * `late` joins a once-played recording already under way, without its entrance. `keepTime` holds a recording to the
   * moment it was first asked for: begun then from its top, it sounds at full level from its own first note; begun later
   * (still decoding), it joins where it would have been, fading in.
   */
  update(phase: string, level: number, offset = 0, late = false, keepTime = false): void {
    if (this.stopped) return;
    this.phase = phase;
    if (!this.active) { this.offset = offset; this.late = late; this.keepTime = keepTime; this.asked = this.ctx.currentTime; }
    this.active = true;
    // Re-aiming at an unchanged level would cut short a slower entrance.
    const changed = level !== this.level;
    this.level = level;
    if (changed && this.source && !this.finishing) this.bus.gain.setTargetAtTime(level, this.ctx.currentTime, tuning.audio.recordedMusicFade);
    this.play();
  }

  private play(): void {
    if (this.stopped || !this.active || !this.buffer || this.source || this.ctx.currentTime < this.restUntil) return;
    const source = this.ctx.createBufferSource();
    source.buffer = this.buffer;
    const once = this.once, rest = this.rest;
    source.loop = !once && !this.playingOut && rest === undefined;
    this.epoch = this.ctx.currentTime;
    if (this.keepTime) this.offset += this.epoch - this.asked;
    const offset = once ? Math.min(this.offset, this.buffer.duration) : this.offset % this.buffer.duration;
    this.length = this.buffer.duration; this.start = offset;
    const envelope = once ? this.ctx.createGain() : null;
    // An on-time entrance starts part-way up at once and rises; anything else fades in from silence.
    const enter = once?.enterFrom !== undefined && !this.late ? once.enterFrom : 1;
    if (once && envelope) {
      this.endsAt = this.epoch + Math.max(0, Math.min(this.buffer.duration, once.end) - offset);
      const entered = this.epoch + (enter < 1 ? once.enterOver ?? 0 : 0);
      envelope.gain.setValueAtTime(enter, this.epoch);
      if (enter < 1) envelope.gain.linearRampToValueAtTime(1, entered);
      envelope.gain.setValueAtTime(1, Math.max(entered, this.endsAt - once.fadeOut));
      envelope.gain.linearRampToValueAtTime(0, this.endsAt);
      envelope.connect(this.bus);
    }
    source.connect(envelope ?? this.bus);
    if (enter < 1 || this.keepTime && offset < tuning.audio.recordedMusicOnTime) this.bus.gain.setValueAtTime(this.level, this.epoch);
    else this.bus.gain.setTargetAtTime(this.level, this.epoch, tuning.audio.recordedMusicFadeIn[this.track] ?? tuning.audio.recordedMusicFade);
    source.onended = () => {
      source.disconnect();
      envelope?.disconnect();
      source.buffer = null;
      this.source = null;
      const rest = this.rest;
      if (rest !== undefined && !this.stopped && !this.finishing) {
        this.restUntil = this.epoch + this.length - this.start + rest;
        this.offset = 0; this.keepTime = false;
        this.bus.gain.setValueAtTime(0, this.ctx.currentTime);
        return;
      }
      this.buffer = null;
      this.bus.disconnect();
    };
    source.start(this.epoch, offset);
    if (envelope) source.stop(this.endsAt);
    this.source = source;
    if (rest === undefined) this.buffer = null;
  }

  private get rest() {
    return this.playingOut ? undefined : tuning.audio.recordedMusicLoop[this.track]?.rest;
  }

  private get once() {
    return tuning.audio.recordedMusicOnce[this.track];
  }

  /** Stops looping for good; the pass under way, or the first if none has begun, plays to the end of the file. */
  playOut(): void {
    this.playingOut = true;
    if (this.source) { this.source.loop = false; this.buffer = null; }
    else if (Number.isFinite(this.restUntil) && this.buffer) { this.buffer = null; this.bus.disconnect(); }
  }

  get duration(): number { return this.length; }

  /** Seconds into the recording now; undefined until it sounds. */
  position(now: number): number | undefined {
    if (!this.source) return undefined;
    const at = this.start + now - this.epoch;
    return this.once ? at : at % this.length;
  }

  /** Fades to silence over `release` seconds ending at `at` on the audio clock, and stops there. */
  finishAt(at: number, release: number): void {
    if (this.stopped || !this.source) return;
    this.finishing = true;
    const gain = this.bus.gain, now = this.ctx.currentTime, from = Math.max(now, at - release);
    gain.cancelAndHoldAtTime(from);
    // A settled level has no event to hold, so anchor the ramp's start explicitly.
    gain.setValueAtTime(from > now ? this.level : gain.value, from);
    gain.linearRampToValueAtTime(0, Math.max(from, at));
    this.source.stop(Math.max(from, at));
    this.endsAt = Math.min(this.endsAt, at);
  }

  handoffAt(now: number): number {
    return Number.isFinite(this.endsAt) ? Math.max(now, this.endsAt) : now;
  }

  /** The next room's music waits for this recording's end fade, however long that is. */
  get holdsHandoff(): boolean {
    return !!this.once?.holdsHandoff && !!this.source && this.endsAt > this.ctx.currentTime;
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
