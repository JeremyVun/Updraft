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

// Contours follow NOAA's humpback example: falling cries, uneven answers and a changing balance of partials.
const CALLS: Record<WhaleVoiceKind, readonly Moan[]> = {
  'whale-moan': [
    {
      pitch: [[0, 156], [0.7, 171], [1.6, 163], [3.2, 129], [4.5, 118]],
      swell: [[0, 0], [0.7, 0.8], [1.7, 1], [3.4, 0.75], [4.7, 0]],
      open: 0.3, rasp: 0.16, muffle: 1600, level: 1,
    },
    {
      pitch: [[5.6, 137], [6.3, 158], [7.8, 148], [8.5, 121], [10, 108]],
      swell: [[5.6, 0], [6.4, 0.75], [7.3, 0.9], [9, 0.6], [10.2, 0]],
      open: 0.15, rasp: 0.2, muffle: 1300, level: 0.85,
    },
  ],
  'whale-near': [{
    pitch: [[0, 182], [0.6, 193], [1.3, 174], [2.8, 136], [4.1, 124]],
    swell: [[0, 0], [0.55, 0.85], [1.2, 1], [2.7, 0.7], [4.4, 0]],
    open: 0.4, rasp: 0.14, muffle: 1600, level: 0.85,
  }],
  'whale-greet': [{
    pitch: [[0, 218], [0.4, 253], [1.1, 239], [1.8, 184], [3.4, 156]],
    swell: [[0, 0], [0.35, 0.8], [1, 1], [2.3, 0.6], [3.6, 0]],
    open: 0.55, rasp: 0.1, muffle: 2200, level: 0.8,
  }],
  'whale-song': [
    {
      pitch: [[0, 287], [0.45, 326], [0.9, 298], [1.45, 227], [2.3, 173]],
      swell: [[0, 0], [0.3, 0.8], [0.85, 1], [1.7, 0.65], [2.6, 0]],
      open: 0.75, rasp: 0.12, muffle: 2600, level: 0.95,
    },
    {
      pitch: [[3.15, 169], [3.9, 178], [4.4, 243], [4.9, 276], [5.45, 216], [6.25, 159]],
      swell: [[3.15, 0], [3.7, 0.7], [4.8, 1], [5.5, 0.7], [6.5, 0]],
      open: 0.6, rasp: 0.16, muffle: 2200, level: 1,
    },
  ],
  'whale-goodbye': [{
    pitch: [[0, 232], [0.6, 248], [1.7, 197], [2.8, 143], [4.4, 127]],
    swell: [[0, 0], [0.5, 0.8], [1.3, 1], [2.9, 0.65], [4.6, 0]],
    open: 0.45, rasp: 0.16, muffle: 1800, level: 0.95,
  }],
  'whale-deep': [{
    pitch: [[0, 112], [1.4, 124], [3, 101], [4.4, 82], [6.4, 71]],
    swell: [[0, 0], [1.2, 0.9], [3, 1], [5, 0.7], [6.8, 0]],
    open: 0.1, rasp: 0.22, muffle: 650, level: 0.85,
  }],
  'whale-echo': [{
    pitch: [[0, 186], [0.7, 201], [1.6, 164], [3.2, 128]],
    swell: [[0, 0], [0.6, 0.7], [2, 1], [3.6, 0]],
    open: 0.3, rasp: 0.05, muffle: 520, level: 0.35,
  }],
};

/** How long each call goes on (s), for the room the score makes under it. */
export const callLength = (kind: WhaleVoiceKind) => Math.max(...CALLS[kind].map((m) => m.swell[m.swell.length - 1][0]));

const PARTIALS = [[0.35, 0.75, 0.5], [0.58, 0.3, 0.08], [0.03, 0.16, 0.025], [0.008, 0.035, 0]] as const;

/** The whale's voice: its moans, synthesised whole for each call and let go when it ends. */
export class WhaleVoice {
  private out: AudioOut | null = null;
  private breath: AudioBuffer | null = null;

  setOutput(out: AudioOut | null): void {
    if (out && out.ctx !== this.out?.ctx) {
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
    if (!out || !this.breath || level < 0.002) return;
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
    for (const [i, shape] of PARTIALS.entries()) {
      const voice = keep(ctx.createOscillator()), colour = keep(ctx.createGain());
      glide(voice.frequency, m.pitch, at, i + 1);
      const length = end - from;
      colour.gain.setValueAtTime(shape[0] * (i > 1 ? m.open : 1), from);
      colour.gain.linearRampToValueAtTime(shape[1] * (i > 1 ? m.open : 1), from + length * 0.45);
      colour.gain.linearRampToValueAtTime(shape[2] * (i > 1 ? m.open : 1), end);
      voice.connect(colour).connect(sum);
      oscillators.push(voice);
    }
    const drift = new Float32Array(Math.ceil((end - from) * 3) + 1);
    for (let i = 0; i < drift.length; i++) drift[i] = (Math.random() - 0.5) * 12;
    for (const osc of oscillators) osc.detune.setValueCurveAtTime(drift, from, end - from);

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
