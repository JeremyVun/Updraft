import type { AudioOut } from '../creatures/voices';
import { rotaryFriction } from './rotary-friction';

export class RotaryCreak {
  private readonly buffers = new WeakMap<BaseAudioContext, AudioBuffer[]>();
  private next = 0;

  prepare(ctx: BaseAudioContext): AudioBuffer[] {
    let clips = this.buffers.get(ctx);
    if (!clips) {
      clips = [rotaryFriction(ctx, 0), rotaryFriction(ctx, 1)];
      this.buffers.set(ctx, clips);
    }
    return clips;
  }

  play(out: AudioOut, at: number, level: number, pan: number): void {
    const { ctx } = out, clips = this.prepare(ctx);
    const source = ctx.createBufferSource();
    source.buffer = clips[this.next++ % clips.length];
    const gain = ctx.createGain(); gain.gain.value = level;
    const panner = ctx.createStereoPanner();
    panner.pan.value = Math.max(-.85, Math.min(.85, pan));
    const send = ctx.createGain(); send.gain.value = .018;
    source.connect(gain).connect(panner).connect(out.bus);
    panner.connect(send).connect(out.reverb);
    source.onended = () => { source.disconnect(); gain.disconnect(); panner.disconnect(); send.disconnect(); };
    source.start(at);
  }
}
