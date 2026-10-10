import { tuning } from '../tuning';
import type { AudioOut } from '../creatures/voices';
import type { WhaleCall } from '../fx/sealife/sleeper';

/** Every call it makes: its own, and its greeting as its eye opens on her and its far echo on the first crossing. */
export type WhaleVoiceKind = WhaleCall | 'whale-greet' | 'whale-echo';

/**
 * Pitch and swell through each phrase; breath brightness, breath amount, lowpass and relative level.
 */
interface Moan {
  pitch: readonly (readonly [number, number])[];
  swell: readonly (readonly [number, number])[];
  open: number;
  rasp: number;
  muffle: number;
  level: number;
}

/**
 * Its calls, in a humpback's manner and the sea score's key (D): slow moans that glide, low enough to be felt, the
 * harmonics a phone's speaker carries. Tired and sagging in the mist; a soft rise for the friend it knows; glad and
 * rising, in two phrases, as it breathes free; down and up again for goodbye; last and lowest from the deep.
 */
const CALLS: Record<WhaleVoiceKind, readonly Moan[]> = {
  'whale-moan': [{
    pitch: [[0, 52], [2.5, 69], [4.8, 73.4], [7.6, 64], [10, 49]],
    swell: [[0, 0], [0.9, 0.85], [2.8, 1], [7.6, 0.9], [10.2, 0]],
    open: 0.25, rasp: 0.3, muffle: 900, level: 1,
  }],
  'whale-greet': [{
    pitch: [[0, 73.4], [0.9, 82.4], [1.7, 92.5], [3.4, 82.4]],
    swell: [[0, 0], [0.6, 0.8], [1.8, 1], [3.6, 0]],
    open: 0.45, rasp: 0.08, muffle: 1600, level: 0.6,
  }],
  'whale-song': [
    {
      pitch: [[0, 92.5], [1.1, 110], [2.2, 104], [2.9, 98]],
      swell: [[0, 0], [0.5, 0.7], [2.1, 1], [3.1, 0]],
      open: 0.6, rasp: 0.1, muffle: 2200, level: 0.9,
    },
    {
      pitch: [[3.3, 98], [4.4, 123.5], [5.3, 146.8], [5.9, 138.6], [6.4, 130.8]],
      swell: [[3.3, 0], [3.9, 0.75], [5.1, 1], [5.7, 0.85], [6.5, 0]],
      open: 0.8, rasp: 0.06, muffle: 2600, level: 1,
    },
  ],
  'whale-goodbye': [{
    pitch: [[0, 110], [1, 92.5], [2.1, 73.4], [2.8, 77], [4, 110], [4.4, 104]],
    swell: [[0, 0], [0.5, 0.8], [1.9, 0.9], [3.6, 1], [4.6, 0]],
    open: 0.55, rasp: 0.12, muffle: 2000, level: 1,
  }],
  'whale-deep': [{
    pitch: [[0, 46.2], [2, 55], [4.4, 49], [6.4, 41.2]],
    swell: [[0, 0], [1.2, 0.9], [3, 1], [5, 0.7], [6.8, 0]],
    open: 0.15, rasp: 0.25, muffle: 420, level: 1,
  }],
  'whale-echo': [{
    pitch: [[0, 110], [1, 92.5], [2.1, 73.4], [3.2, 92.5]],
    swell: [[0, 0], [0.6, 0.7], [2, 1], [3.6, 0]],
    open: 0.3, rasp: 0.05, muffle: 520, level: 0.35,
  }],
};

/** How long each call goes on (s), for the room the score makes under it. */
export const callLength = (kind: WhaleVoiceKind) => Math.max(...CALLS[kind].map((m) => m.swell[m.swell.length - 1][0]));

const HARMONICS = [0, 1, 0.42, 0.28, 0.1, 0.035];

/** The whale's voice: its moans, synthesised whole for each call and let go when it ends. */
export class WhaleVoice {
  private out: AudioOut | null = null;
  private wave: PeriodicWave | null = null;
  private breath: AudioBuffer | null = null;

  setOutput(out: AudioOut | null): void {
    if (out && out.ctx !== this.out?.ctx) {
      const imag = new Float32Array(HARMONICS.length);
      this.wave = out.ctx.createPeriodicWave(Float32Array.from(HARMONICS), imag);
      this.breath = out.ctx.createBuffer(1, out.ctx.sampleRate * 4, out.ctx.sampleRate);
      const samples = this.breath.getChannelData(0);
      for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
    }
    this.out = out;
  }

  /**
   * Its `kind` of call at `level`, from `pan` on the screen, `far` 0 beside it .. 1 far off in the mist: farther, it is
   * more muffled and more of it is the sea's echo.
   */
  call(kind: WhaleVoiceKind, level: number, pan: number, far: number): void {
    const out = this.out;
    if (!out || !this.wave || level < 0.002) return;
    const at = out.ctx.currentTime + 0.03;
    for (const moan of CALLS[kind]) this.moan(moan, at, level * moan.level, pan, far);
  }

  private moan(m: Moan, at: number, level: number, pan: number, far: number): void {
    const out = this.out!;
    const { ctx } = out;
    const V = tuning.audio.whaleVoice;
    const from = at + m.swell[0][0];
    const end = at + m.swell[m.swell.length - 1][0];
    const nodes: AudioNode[] = [];
    const keep = <T extends AudioNode>(n: T) => (nodes.push(n), n);

    const sum = keep(ctx.createGain());
    const oscillators: OscillatorNode[] = [];
    const voice = keep(ctx.createOscillator());
    voice.setPeriodicWave(this.wave!);
    glide(voice.frequency, m.pitch, at, 1);
    voice.connect(sum);
    oscillators.push(voice);
    // A slow wander in its pitch, never a singer's vibrato.
    const wander = keep(ctx.createOscillator());
    wander.frequency.value = 0.19;
    const wanderBy = keep(ctx.createGain());
    wanderBy.gain.value = 9;
    wander.connect(wanderBy);
    for (const osc of oscillators) wanderBy.connect(osc.detune);
    oscillators.push(wander);

    const breath = keep(ctx.createBufferSource());
    breath.buffer = this.breath;
    breath.loop = true;
    const air = keep(ctx.createBiquadFilter());
    air.type = 'bandpass';
    air.frequency.value = 420 + m.open * 280;
    air.Q.value = 0.6;
    const breathGain = keep(ctx.createGain());
    breathGain.gain.value = m.rasp * 0.16;
    breath.connect(air).connect(breathGain).connect(sum);

    // Fixed throat peaks and delayed glides made the harmonics surge like a revving engine.
    const muffle = keep(ctx.createBiquadFilter());
    muffle.type = 'lowpass';
    muffle.Q.value = 0.6;
    muffle.frequency.value = m.muffle * (1 - 0.6 * far);
    sum.connect(muffle);

    const env = keep(ctx.createGain());
    env.gain.value = 0;
    env.gain.setValueAtTime(0, from);
    for (const [t, v] of m.swell) env.gain.linearRampToValueAtTime(Math.max(0, v) * level * V.level, at + t);
    muffle.connect(env);
    const p = keep(ctx.createStereoPanner());
    p.pan.value = Math.max(-0.7, Math.min(0.7, pan));
    env.connect(p);
    const dry = keep(ctx.createGain());
    dry.gain.value = 1 - 0.55 * far;
    p.connect(dry).connect(out.bus);
    const wet = keep(ctx.createGain());
    wet.gain.value = V.wet + (1 - V.wet) * 0.6 * far;
    p.connect(wet).connect(out.reverb);
    const stop = end + 0.05;
    breath.start(from);
    breath.stop(stop);
    for (const osc of oscillators) {
      osc.start(from);
      osc.stop(stop);
    }
    oscillators[0].onended = () => nodes.forEach((n) => n.disconnect());
  }
}

function glide(param: AudioParam, keys: readonly (readonly [number, number])[], at: number, by: number): void {
  const from = keys[0][0], duration = keys[keys.length - 1][0] - from;
  const count = Math.ceil(duration * 128) + 1;
  let segment = 1;
  const values = Float32Array.from({ length: count }, (_, j) => {
    const time = from + duration * j / (count - 1);
    while (segment < keys.length - 1 && time > keys[segment][0]) segment++;
    const [start, a] = keys[segment - 1], [end, b] = keys[segment];
    const t = (time - start) / (end - start), eased = t * t * (3 - 2 * t);
    return a * (b / a) ** eased * by;
  });
  param.setValueCurveAtTime(values, at + from, duration);
}
