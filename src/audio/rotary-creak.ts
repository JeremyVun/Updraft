import type { AudioOut } from '../creatures/voices';
import encoded from '../../assets/audio/rotary-creak/clips.json?raw';

const recording = JSON.parse(encoded) as { sampleRate: number; clips: string[] };

export class RotaryCreak {
  private readonly buffers = new WeakMap<BaseAudioContext, AudioBuffer[]>();
  private next = 0;

  play(out: AudioOut, at: number, level: number, pan: number): void {
    const { ctx } = out;
    let clips = this.buffers.get(ctx);
    if (!clips) {
      // Inline PCM keeps the first creak synchronous with the bearing's movement.
      clips = recording.clips.map(clip => {
        const bytes = Uint8Array.from(atob(clip), c => c.charCodeAt(0));
        const pcm = new DataView(bytes.buffer);
        const buffer = ctx.createBuffer(1, bytes.length / 2, recording.sampleRate);
        const channel = buffer.getChannelData(0);
        for (let i = 0; i < channel.length; i++) channel[i] = pcm.getInt16(i * 2, true) / 32768;
        return buffer;
      });
      this.buffers.set(ctx, clips);
    }
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
