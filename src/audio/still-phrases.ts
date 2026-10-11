import { decodeMusic } from './music-loading';
import { tuning } from '../tuning';

// Quiet gaps in the supplied recording. The later material belongs to the crossing.
export const STILL_PHRASES: readonly (readonly [number, number])[] = [
  [.69, 9.55], [9.65, 19.31], [19.41, 27.40], [27.50, 34.40],
  [34.50, 41.65], [41.75, 49.64], [49.74, 57.39], [57.49, 65.51],
  [65.61, 73.71], [73.81, 81.61], [81.71, 89.71], [89.81, 98.34],
  [98.44, 107.53], [107.63, 116.90],
];
export const STILL_CROSSING = [117, 175.20] as const;
type Voice = { source: AudioBufferSourceNode; gain: GainNode; finishing: boolean; at: number };

export class StillPhrases {
  readonly ready: Promise<void>;
  private readonly request = new AbortController();
  private buffer: AudioBuffer | null = null;
  private voice: Voice | null = null;
  private readonly voices = new Set<Voice>();
  private stopped = false;
  private next = 0;
  private lastPhraseAt = -Infinity;
  private crossingStarted = false;

  constructor(private readonly ctx: BaseAudioContext, private readonly output: AudioNode) {
    this.ready = this.load();
  }

  private async load(): Promise<void> {
    try {
      const buffer = await decodeMusic(this.ctx, 'still', this.request.signal);
      if (!this.stopped) this.buffer = buffer;
    } catch (error) {
      if (!this.stopped) console.warn('Could not load Still phrases', error);
    }
  }

  trigger(spacing = tuning.audio.stillPhraseSpacing): boolean {
    if (this.crossingStarted || this.ctx.currentTime - this.lastPhraseAt < spacing) return false;
    const [from, to] = STILL_PHRASES[this.next];
    if (!this.play(from, to, true)) return false;
    this.lastPhraseAt = this.ctx.currentTime;
    this.next = (this.next + 1) % STILL_PHRASES.length;
    return true;
  }

  crossing(elapsed: number): void {
    if (elapsed < 0) { this.finish(); return; }
    if (this.crossingStarted) return;
    const [from, to] = STILL_CROSSING;
    if (elapsed >= to - from) { this.crossingStarted = true; return; }
    if (this.play(from + elapsed, to)) this.crossingStarted = true;
  }

  private play(from: number, to: number, overlap = false): boolean {
    if (this.stopped || !this.buffer) return false;
    if (this.voices.size && (!overlap || (this.voice && this.ctx.currentTime - this.voice.at < tuning.audio.stillPhraseSpacing))) return false;
    const source = this.ctx.createBufferSource(), gain = this.ctx.createGain();
    source.buffer = this.buffer;
    source.connect(gain); gain.connect(this.output);
    const now = this.ctx.currentTime, duration = Math.min(to, this.buffer.duration) - from;
    const level = 10 ** (tuning.audio.stillPhraseDb / 20), fade = Math.min(tuning.audio.stillPhraseFade, duration / 2);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(level, now + Math.min(.01, duration / 4));
    gain.gain.setValueAtTime(level, now + duration - fade);
    gain.gain.linearRampToValueAtTime(0, now + duration);
    const voice = { source, gain, finishing: false, at: now };
    this.voice = voice;
    this.voices.add(voice);
    source.onended = () => {
      source.disconnect(); source.buffer = null; gain.disconnect();
      this.voices.delete(voice);
      if (this.voice === voice) this.voice = null;
    };
    source.start(now, from, duration);
    return true;
  }

  handoffAt(now: number): number { return now; }

  finish(fade = tuning.audio.stillPhraseFade): void {
    const now = this.ctx.currentTime, end = now + fade;
    for (const voice of this.voices) {
      if (voice.finishing) continue;
      voice.finishing = true;
      voice.gain.gain.cancelAndHoldAtTime(now);
      voice.gain.gain.setValueAtTime(voice.gain.gain.value, now);
      voice.gain.gain.linearRampToValueAtTime(0, end);
      voice.source.stop(end);
    }
  }

  stop(fade = tuning.audio.stillPhraseFade): void {
    this.stopped = true;
    this.request.abort(); this.buffer = null;
    this.finish(fade);
  }
}
