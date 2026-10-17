import { decodeMusic } from './music-loading';
import { tuning } from '../tuning';

export type RecordedMusic = 'home' | 'mirror' | 'birches' | 'stairs' | 'clouds' | 'villageApproach' | 'belfry' | 'lines' | 'boats' | 'stillDeparture';

export class RecordedScore {
  readonly ready: Promise<void>;
  private bus: GainNode;
  private readonly request = new AbortController();
  private buffer: AudioBuffer | null = null;
  private ending: AudioBuffer | null = null;
  /** In the order they sound, each with the time it is due to stop. */
  private sources: { node: AudioBufferSourceNode; until: number; bus: GainNode }[] = [];
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
  /** Where in the recording a kept-time entrance counts as on time, and the audio-clock moment it may not begin before. */
  private entry = 0;
  private startAt = 0;
  /** Until then a cued entrance shapes the level itself. */
  private settled = 0;
  /** Home steps away and comes back for the ending, so it holds its decoded recording until stopped. */
  private kept: AudioBuffer | null = null;
  private length = 0;
  private start = 0;
  /** Fading itself out to a scheduled end; level changes no longer apply. */
  private finishing = false;
  /** No longer looping: the pass under way plays to the end of the file and stops. */
  private playingOut = false;
  /** A cued pass looping over part of the recording, from where it was cued to its end. */
  private region: readonly [number, number] | null = null;
  /** Where the pass sounding before a cue was, until the cue begins. */
  private before: { start: number; epoch: number; region: readonly [number, number] | null } | null = null;
  /** Between passes of a recording that rests before it goes round: the next begins from its top then. */
  private restUntil = -Infinity;

  constructor(private readonly ctx: BaseAudioContext, private readonly output: AudioNode, readonly track: RecordedMusic) {
    this.bus = ctx.createGain();
    this.bus.gain.value = 0;
    this.bus.connect(output);
    this.ready = this.load();
  }

  private async load(): Promise<void> {
    try {
      const [buffer, ending] = await decodeMusic(this.ctx, this.track, this.request.signal);
      if (this.stopped) return;
      this.buffer = buffer;
      this.ending = ending ?? null;
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
    if (changed && this.source && !this.finishing && this.ctx.currentTime >= this.settled) this.bus.gain.setTargetAtTime(level, this.ctx.currentTime, tuning.audio.recordedMusicFade);
    this.play();
  }

  private play(): void {
    if (this.stopped || !this.active || !this.buffer || this.source || this.ctx.currentTime < this.restUntil) return;
    const once = this.once, rest = this.rest, ending = once?.ending && this.ending ? { ...once.ending, buffer: this.ending } : null;
    this.epoch = Math.max(this.ctx.currentTime, this.startAt);
    if (this.keepTime) this.offset += this.epoch - this.asked;
    const length = ending ? ending.from + ending.buffer.duration : this.buffer.duration;
    const offset = once ? Math.min(this.offset, length) : this.offset % length;
    this.length = length; this.start = offset;
    const envelope = once ? this.ctx.createGain() : null;
    // An on-time entrance starts part-way up at once and rises; anything else fades in from silence.
    const enter = once?.enterFrom !== undefined && !this.late ? once.enterFrom : 1;
    if (once && envelope) {
      this.endsAt = this.epoch + Math.max(0, Math.min(length, once.end) - offset);
      const entered = this.epoch + (enter < 1 ? once.enterOver ?? 0 : 0);
      envelope.gain.setValueAtTime(enter, this.epoch);
      if (enter < 1) envelope.gain.linearRampToValueAtTime(1, entered);
      envelope.gain.setValueAtTime(1, Math.max(entered, this.endsAt - once.fadeOut));
      envelope.gain.linearRampToValueAtTime(0, this.endsAt);
      envelope.connect(this.bus);
    }
    if (enter < 1 || this.keepTime && offset - this.entry < tuning.audio.recordedMusicOnTime) this.bus.gain.setValueAtTime(this.level, this.epoch);
    else this.bus.gain.setTargetAtTime(this.level, this.epoch, tuning.audio.recordedMusicFadeIn[this.track] ?? tuning.audio.recordedMusicFade);
    const into = envelope ?? this.bus;
    if (!ending) this.schedule(this.buffer, into, this.epoch, offset, this.endsAt, !once && !this.playingOut && rest === undefined);
    else {
      // The ending starts on the same audio clock, sample-aligned with the recording, and fades in as it fades out.
      const handover = this.epoch + Math.max(0, ending.at - offset), crossed = handover + ending.crossfade;
      const incoming = this.ctx.createGain();
      if (offset < ending.at) {
        const outgoing = this.ctx.createGain();
        outgoing.gain.setValueAtTime(1, handover);
        outgoing.gain.linearRampToValueAtTime(0, crossed);
        this.schedule(this.buffer, into, this.epoch, offset, Math.min(this.endsAt, crossed), false, outgoing);
        incoming.gain.setValueAtTime(0, this.epoch);
        incoming.gain.setValueAtTime(0, handover);
        incoming.gain.linearRampToValueAtTime(1, crossed);
      }
      this.schedule(ending.buffer, into, handover, Math.max(offset, ending.at) - ending.from, this.endsAt, false, incoming);
    }
    if (this.track === 'home') this.kept = this.buffer;
    if (rest === undefined) this.buffer = null;
    this.ending = null;
  }

  private schedule(buffer: AudioBuffer, into: AudioNode, at: number, offset: number, until: number,
    loop: boolean | readonly [number, number], gain?: GainNode): void {
    const node = this.ctx.createBufferSource();
    node.buffer = buffer;
    node.loop = !!loop;
    if (typeof loop === 'object') [node.loopStart, node.loopEnd] = loop;
    if (gain) node.connect(gain).connect(into);
    else node.connect(into);
    const bus = this.bus, entry = { node, until, bus };
    node.onended = () => {
      node.disconnect();
      gain?.disconnect();
      node.buffer = null;
      this.sources = this.sources.filter(source => source !== entry);
      if (this.sources.some(source => source.bus === bus)) return;
      if (into !== bus) into.disconnect();
      if (bus === this.bus && this.rest !== undefined && this.buffer && !this.stopped && !this.finishing) {
        this.restUntil = this.epoch + this.length - this.start + this.rest;
        this.offset = 0; this.keepTime = false;
        bus.gain.setValueAtTime(0, this.ctx.currentTime);
        return;
      }
      if (bus === this.bus) this.buffer = null;
      bus.disconnect();
    };
    node.start(at, offset);
    if (Number.isFinite(until)) node.stop(until);
    this.sources.push(entry);
  }

  /** The source sounding now: the recording, then from its handover its ending. */
  private get source(): AudioBufferSourceNode | null {
    return this.sources[0]?.node ?? null;
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
    for (const { node } of this.sources) node.loop = false;
    if (this.source) this.buffer = null;
    else if (Number.isFinite(this.restUntil) && this.buffer) { this.buffer = null; this.bus.disconnect(); }
  }

  get duration(): number { return this.length; }

  /** Seconds into the recording now; undefined until it sounds. */
  position(now: number): number | undefined {
    if (!this.source) return undefined;
    const pass = now < this.epoch && this.before ? this.before : { start: this.start, epoch: this.epoch, region: this.region };
    const at = pass.start + now - pass.epoch;
    if (pass.region) return pass.region[0] + (at - pass.region[0]) % (pass.region[1] - pass.region[0]);
    return this.once ? at : at % this.length;
  }

  /**
   * From `at` on the audio clock, plays on from `offset` without looping, or round `loop` from `offset` to its end,
   * rising over `fadeIn` (at once when 0). A pass still sounding must already be finishing by then. Not yet decoded,
   * it begins there once it is, or joins where it would be by then.
   */
  cueAt(at: number, offset: number, fadeIn = 0, loop?: readonly [number, number]): void {
    if (this.stopped) return;
    this.active = this.playingOut = this.keepTime = true;
    this.offset = offset; this.asked = this.startAt = at; this.entry = fadeIn ? -Infinity : offset;
    const buffer = this.source?.buffer ?? this.kept;
    if (!buffer) { this.play(); return; }
    this.finishing = false;
    this.endsAt = Infinity;
    for (const source of this.sources) { source.node.loop = false; source.node.stop(Math.min(at, source.until)); }
    this.bus = this.ctx.createGain();
    this.bus.connect(this.output);
    this.bus.gain.value = 0;
    this.bus.gain.setValueAtTime(fadeIn ? 0 : this.level, at);
    if (fadeIn) this.bus.gain.linearRampToValueAtTime(this.level, at + fadeIn);
    this.settled = at + fadeIn;
    // A cue replacing one not yet begun keeps the pass that is actually sounding.
    if (this.ctx.currentTime >= this.epoch) this.before = this.source ? { start: this.start, epoch: this.epoch, region: this.region } : null;
    this.epoch = at; this.start = offset; this.length = buffer.duration; this.region = loop ?? null;
    this.schedule(buffer, this.bus, at, offset, Infinity, loop ?? false);
  }

  /** When the pass under way falls silent on the audio clock: `now` if nothing sounds, Infinity while it plays on. */
  silentFrom(now: number): number {
    return this.source ? Math.max(now, this.endsAt) : now;
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
    for (const { node, until } of this.sources) node.stop(Math.min(Math.max(from, at), until));
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
    this.kept = null;
    this.ending = null;
    if (!this.source) { this.bus.disconnect(); return; }
    const now = this.ctx.currentTime;
    this.bus.gain.cancelAndHoldAtTime(now);
    this.bus.gain.setValueAtTime(this.bus.gain.value, now);
    this.bus.gain.linearRampToValueAtTime(0, now + fade);
    for (const { node, until } of this.sources) node.stop(Math.min(now + fade, until));
  }
}
