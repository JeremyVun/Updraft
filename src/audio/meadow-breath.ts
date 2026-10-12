import type { AudioOut } from '../creatures/voices';
import { tuning } from '../tuning';

const buffers = new WeakMap<BaseAudioContext, AudioBuffer>();

export function meadowBreath(out: AudioOut, midi: number, pan: number, strength = 1): void {
  const { ctx } = out;
  const now = ctx.currentTime + 0.015;
  const duration = 1.8;
  const pitch = 440 * 2 ** ((midi - 69) / 12);
  const gain = ctx.createGain(), stereo = ctx.createStereoPanner(), wet = ctx.createGain();
  stereo.pan.value = Math.max(-0.75, Math.min(0.75, pan));
  wet.gain.value = 0.25;
  gain.connect(stereo);
  stereo.connect(out.bus);
  stereo.connect(wet).connect(out.reverb);
  const level = tuning.meadowEchoes.voice * strength;
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(level, now + 0.12);
  gain.gain.linearRampToValueAtTime(level * 0.65, now + 0.7);
  gain.gain.exponentialRampToValueAtTime(0.00001, now + duration);
  const parts: AudioScheduledSourceNode[] = [];
  const nodes: AudioNode[] = [gain, stereo, wet];
  for (const [ratio, amount] of [[1, 0.55], [2, 0.12], [3, 0.025]]) {
    const tone = ctx.createOscillator(), volume = ctx.createGain();
    tone.frequency.setValueAtTime(pitch * ratio * 0.995, now);
    tone.frequency.exponentialRampToValueAtTime(pitch * ratio, now + 0.18);
    volume.gain.value = amount;
    tone.connect(volume).connect(gain);
    parts.push(tone); nodes.push(tone, volume);
  }
  let noise = buffers.get(ctx);
  if (!noise) {
    noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = noise.getChannelData(0);
    let seed = 1234567;
    for (let i = 0; i < data.length; i++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
      data[i] = (seed >>> 0) / 2147483648 - 1;
    }
    buffers.set(ctx, noise);
  }
  const air = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), breath = ctx.createGain();
  air.buffer = noise; filter.type = 'bandpass'; filter.frequency.value = pitch * 2.2; filter.Q.value = 0.8;
  breath.gain.value = 0.09;
  air.connect(filter).connect(breath).connect(gain);
  parts.push(air); nodes.push(air, filter, breath);
  let left = parts.length;
  for (const part of parts) {
    part.onended = () => { if (--left === 0) for (const node of nodes) node.disconnect(); };
    part.start(now); part.stop(now + duration + 0.05);
  }
}
