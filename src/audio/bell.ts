import { tuning } from '../tuning';
import type { AudioOut } from '../creatures/voices';

/**
 * A minor-third church bell's partials against its strike note: ratio, level, how long it lasts against the hum, and
 * the slow beat of its doublet (Hz), the two nearly equal modes of a cast bell that make its tone waver. Hum, prime,
 * tierce, quint and nominal carry the note; the partials above them make the strike's brightness and are gone soon.
 */
const PARTIALS: [ratio: number, level: number, lasts: number, beat: number][] = [
  [0.5, 0.5, 1, 0.42],
  [1, 0.46, 0.62, 0.8],
  [1.189, 0.42, 0.5, 1.15],
  [1.498, 0.16, 0.3, 0.55],
  [2, 0.58, 0.36, 1.05],
  [2.51, 0.17, 0.16, 1.6],
  [2.67, 0.1, 0.13, 0],
  [3.01, 0.22, 0.11, 2.2],
  [4.03, 0.12, 0.07, 0],
  [5.06, 0.06, 0.045, 0],
];
/** The clang that is gone in a moment: high, out of tune with the note, louder the harder the stroke. */
const CLANG: [ratio: number, level: number, seconds: number][] = [[6.13, 0.08, 0.18], [7.4, 0.06, 0.12], [9.2, 0.04, 0.08]];

const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

/**
 * One stroke of the clapper on the bell at `at` on the audio clock: `strength` 0..1, panned. A ring is struck hard,
 * with the clapper's knock and the clang over the note, and hums on long after; a touch is the clapper only meeting
 * the bronze, a soft knock and the note barely woken.
 */
export function strikeBell(out: AudioOut, at: number, strength: number, pan: number, touch = false): void {
  const k = tuning.crossings.bell;
  const { ctx } = out;
  const s = Math.min(1, strength);
  const f0 = hz(k.note);
  const voice = ctx.createGain();
  voice.gain.value = k.level * (touch ? 0.35 : 1);
  const panner = ctx.createStereoPanner();
  panner.pan.value = Math.max(-0.7, Math.min(0.7, pan));
  const send = ctx.createGain();
  send.gain.value = k.wet;
  voice.connect(panner).connect(out.bus);
  panner.connect(send).connect(out.reverb);
  const hum = touch ? k.hum * 0.3 : k.hum;
  let left = 0;
  const done = () => {
    if (--left > 0) return;
    voice.disconnect();
    panner.disconnect();
    send.disconnect();
  };
  const tone = (freq: number, level: number, decay: number, attack: number) => {
    if (level < 1e-4) return;
    const osc = ctx.createOscillator();
    osc.frequency.value = freq;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, at);
    env.gain.linearRampToValueAtTime(level, at + attack);
    env.gain.setTargetAtTime(0, at + attack, decay);
    osc.connect(env).connect(voice);
    const end = at + attack + Math.min(decay * 7, 40);
    osc.start(at);
    osc.stop(end);
    left++;
    osc.onended = () => {
      osc.disconnect();
      env.disconnect();
      done();
    };
  };
  const bright = touch ? 0.15 * s : s ** 1.4;
  for (const [i, [ratio, level, lasts, beat]] of PARTIALS.entries()) {
    const low = i <= 4;
    const amount = level * (low ? (touch ? 0.6 * s : 0.55 + 0.45 * s) : bright);
    const decay = hum * lasts / 3;
    const attack = i === 0 ? 0.03 : 0.004;
    tone(f0 * ratio, amount * (beat ? 0.68 : 1), decay, attack);
    if (beat) tone(f0 * ratio + beat, amount * 0.46, decay * 0.92, attack);
  }
  if (!touch) for (const [ratio, level, seconds] of CLANG) tone(f0 * ratio * (0.995 + Math.random() * 0.01), level * s * s, seconds, 0.002);

  /** The clapper's iron meeting the bronze: a dull knock under the note, and a short bright tick on a hard stroke. */
  const knock = ctx.createOscillator();
  knock.type = 'triangle';
  knock.frequency.setValueAtTime(touch ? 150 : 210, at);
  knock.frequency.exponentialRampToValueAtTime(touch ? 90 : 120, at + 0.09);
  const knockEnv = ctx.createGain();
  knockEnv.gain.setValueAtTime(0, at);
  knockEnv.gain.linearRampToValueAtTime((touch ? 0.12 : 0.09) * s, at + 0.003);
  knockEnv.gain.exponentialRampToValueAtTime(0.0001, at + 0.12);
  knock.connect(knockEnv).connect(voice);
  knock.start(at);
  knock.stop(at + 0.15);
  left++;
  knock.onended = () => {
    knock.disconnect();
    knockEnv.disconnect();
    done();
  };
  if (!touch) {
    const length = Math.ceil(ctx.sampleRate * 0.05);
    const noise = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 3;
    const tick = ctx.createBufferSource();
    tick.buffer = noise;
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 3200;
    band.Q.value = 0.9;
    const tickEnv = ctx.createGain();
    tickEnv.gain.value = 0.16 * s * s;
    tick.connect(band).connect(tickEnv).connect(voice);
    tick.start(at);
    left++;
    tick.onended = () => {
      tick.disconnect();
      band.disconnect();
      tickEnv.disconnect();
      done();
    };
  }
}
