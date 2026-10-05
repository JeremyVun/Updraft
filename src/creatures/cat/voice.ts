import type { AudioOut } from '../voices';

/**
 * How one kind of call goes, measured from public-domain kitten and cat recordings and reduced to numbers: the
 * measured call's length, then pitch (over its median) and level at eleven even steps through it, the levels of
 * harmonics 1–12 in dB as the mouth opens, at its widest and as it closes, breath noise against the voice at those
 * three moments, and how far the pitch flutters (cents) and the level shimmers.
 */
interface Shape {
  seconds: number;
  pitch: readonly number[];
  level: readonly number[];
  opening: readonly number[];
  open: readonly number[];
  closing: readonly number[];
  breath: readonly number[];
  flutter: number;
  shimmer: number;
}

/** A kitten's ordinary mew: a quick scoop up, a long gently falling top, the mouth opening onto the second harmonic. */
const MEW: Shape = {
  seconds: 0.49,
  pitch: [0.87, 0.97, 1.05, 1.05, 1.04, 1.03, 1.01, 0.98, 0.93, 0.87, 0.82],
  level: [0.19, 0.38, 0.54, 0.7, 0.66, 0.64, 0.61, 0.58, 0.5, 0.41, 0.26],
  opening: [0, -1, -4, -8, -13, -10, -14, -20, -24, -28, -26, -25],
  open: [-3, 0, -8, -11, -13, -15, -22, -22, -23, -29, -31, -31],
  closing: [0, -10, -25, -31, -34, -32, -32, -38, -40, -43, -41, -42],
  breath: [0.9, 0.5, 0.5],
  flutter: 16,
  shimmer: 0.2,
};

/** A kitten calling for help: higher arch, a bright pressed start, breathier, the level falling away from early on. */
const PLEA: Shape = {
  seconds: 0.39,
  pitch: [0.82, 0.92, 1.07, 1.15, 1.16, 1.11, 1.02, 0.96, 0.9, 0.88, 0.85],
  level: [0.06, 0.21, 0.43, 0.56, 0.61, 0.4, 0.32, 0.24, 0.24, 0.15, 0.09],
  opening: [-12, -9, -6, 0, -9, -22, -23, -24, -31, -36, -37, -37],
  open: [-11, -1, 0, -8, -19, -25, -31, -34, -35, -35, -34, -35],
  closing: [-11, 0, -22, -28, -35, -39, -37, -43, -48, -52, -46, -42],
  breath: [2.4, 1, 1],
  flutter: 55,
  shimmer: 0.45,
};

/** The rolled greeting: low, mouth nearly shut, lifting a little in the middle. */
const CHIRRUP: Shape = {
  seconds: 0.44,
  pitch: [0.91, 0.94, 0.98, 0.99, 1, 1.05, 1.04, 1.02, 0.96, 0.97, 0.96],
  level: [0.29, 0.44, 0.48, 0.61, 0.57, 0.56, 0.51, 0.47, 0.32, 0.28, 0.12],
  opening: [0, -6, -13, -22, -29, -30, -38, -37, -34, -34, -35, -36],
  open: [-3, -2, -8, -22, -24, -30, -32, -35, -35, -32, -35, -35],
  closing: [0, -7, -16, -24, -32, -31, -34, -36, -34, -32, -35, -37],
  breath: [2.4, 2.4, 2.4],
  flutter: 20,
  shimmer: 0.1,
};

/** A frightened cat's drawn-out mrrow: a breathy start, the second and third harmonics loudest, dark at the end. */
const YOWL: Shape = {
  seconds: 0.83,
  pitch: [0.9, 0.96, 1.03, 1.05, 1.03, 1.03, 1.01, 1, 0.97, 0.97, 0.96],
  level: [0.06, 0.16, 0.35, 0.32, 0.38, 0.51, 0.58, 0.27, 0.44, 0.24, 0.13],
  opening: [-4, -5, -14, -9, -11, -14, -12, -18, -29, -29, -22, -23],
  open: [-10, 0, -1, -10, -19, -26, -26, -33, -37, -38, -40, -42],
  closing: [0, -4, -25, -33, -34, -35, -37, -38, -43, -42, -39, -35],
  breath: [3.4, 0.8, 1],
  flutter: 18,
  shimmer: 0.32,
};

/** Harmonics past the twelfth measured keep falling about 1.7 dB each in the recordings, out to the twentieth. */
const PARTIALS = 20;
const ROLLOFF = 1.7;

const mix = (a: readonly number[], b: readonly number[], k: number) => a.map((v, i) => v + (b[i] - v) * k);
const blend = (a: Shape, b: Shape, k: number): Shape => ({
  seconds: a.seconds + (b.seconds - a.seconds) * k,
  pitch: mix(a.pitch, b.pitch, k),
  level: mix(a.level, b.level, k),
  opening: mix(a.opening, b.opening, k),
  open: mix(a.open, b.open, k),
  closing: mix(a.closing, b.closing, k),
  breath: mix(a.breath, b.breath, k),
  flutter: a.flutter + (b.flutter - a.flutter) * k,
  shimmer: a.shimmer + (b.shimmer - a.shimmer) * k,
});

/**
 * Where a step through the measured call falls in one of `length` seconds, and back. A longer call keeps the real
 * onset and ending and draws out what lies between, as a cat holding a mew does.
 */
function stretch(seconds: number, length: number): { at: (step: number) => number; step: (at: number) => number } {
  if (length <= seconds) return { at: step => step * length, step: at => at / length };
  const rise = 0.4, fall = 0.8;
  const middle = length - seconds * (1 - fall + rise);
  return {
    at: step => step <= rise ? step * seconds
      : step >= fall ? length - (1 - step) * seconds
      : rise * seconds + ((step - rise) / (fall - rise)) * middle,
    step: at => at <= rise * seconds ? at / seconds
      : at >= length - (1 - fall) * seconds ? 1 - (length - at) / seconds
      : rise + ((at - rise * seconds) / middle) * (fall - rise),
  };
}

/** A smooth path through values at even steps from 0 to 1, read at `step`. */
function spline(values: readonly number[], step: number): number {
  const n = values.length - 1;
  const x = Math.max(0, Math.min(n, step * n));
  const i = Math.min(n - 1, Math.floor(x)), f = x - i;
  const p0 = values[Math.max(0, i - 1)], p1 = values[i], p2 = values[i + 1], p3 = values[Math.min(n, i + 2)];
  return p1 + 0.5 * f * (p2 - p0 + f * (2 * p0 - 5 * p1 + 4 * p2 - p3 + f * (3 * (p1 - p2) + p3 - p0)));
}

/** Where a spectrum's energy sits, in harmonics of the voice. */
function centroid(db: readonly number[]): number {
  let sum = 0, weighted = 0;
  db.forEach((d, k) => { const p = Math.pow(10, d / 10); sum += p; weighted += p * (k + 1); });
  return weighted / sum;
}

/**
 * The cat's voice and the small sounds of its paws, synthesised like every other animal's but shaped from measured
 * recordings: a kitten's mew that carries across the water, a rolled chirrup when it lands or greets, a frightened
 * mrrow, soft pads on slate and claws on stone.
 */
export class CatVoice {
  private out: AudioOut | null = null;
  private noise: AudioBuffer | null = null;
  private wobble: AudioBuffer | null = null;
  private lastMew = -Infinity;
  private lastPat = -Infinity;

  setOutput(out: AudioOut | null): void {
    if (out && out.ctx !== this.out?.ctx) {
      const rate = out.ctx.sampleRate;
      this.noise = out.ctx.createBuffer(1, rate, rate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < rate; i++) data[i] = Math.random() * 2 - 1;
      // Flutter changes no faster than about 30 Hz, so a coarse buffer carries it and costs little to make.
      this.wobble = out.ctx.createBuffer(1, 4 * 3000, 3000);
      const wob = this.wobble.getChannelData(0);
      const knots = Array.from({ length: 4 * 60 + 1 }, () => Math.random() * 2 - 1);
      let power = 0;
      for (let i = 0; i < wob.length; i++) {
        wob[i] = spline(knots, i / wob.length);
        power += wob[i] * wob[i];
      }
      const norm = 1 / Math.sqrt(power / wob.length);
      for (let i = 0; i < wob.length; i++) wob[i] *= norm;
    }
    this.out = out;
  }

  private voice(pan: number, dry: number, wet: number): { ctx: AudioContext; input: GainNode } | null {
    const out = this.out;
    if (!out) return null;
    const { ctx } = out;
    const input = ctx.createGain();
    const panner = ctx.createStereoPanner();
    panner.pan.value = Math.max(-0.85, Math.min(0.85, pan));
    const dryGain = ctx.createGain();
    dryGain.gain.value = dry;
    const wetGain = ctx.createGain();
    wetGain.gain.value = wet;
    input.connect(panner);
    panner.connect(dryGain).connect(out.bus);
    panner.connect(wetGain).connect(out.reverb);
    return { ctx, input };
  }

  /** A random wander `depth` deep into each of `params`, from a random place in the shared wobble. */
  private wander(ctx: AudioContext, params: AudioParam[], depth: number, t0: number, end: number): void {
    if (!this.wobble) return;
    const src = ctx.createBufferSource();
    src.buffer = this.wobble;
    const gain = ctx.createGain();
    gain.gain.value = depth;
    src.connect(gain);
    for (const p of params) gain.connect(p);
    src.start(t0, Math.random() * (this.wobble.duration - end + t0 - 0.1));
    src.stop(end);
  }

  /**
   * One call: the harmonics as three spectra (opening, open, closing) on oscillators that share one pitch path and
   * cross-fade into each other, breath noise under them where the voice is loudest, the pitch fluttering and the level
   * shimmering. Each call varies its arch, lean and brightness a little, as a real cat's do. `roll` is a trill's rate.
   */
  private sing(pan: number, peak: number, shape: Shape, f0: number, length: number, wet: number, roll = 0): void {
    const v = this.voice(pan, 0.8, wet);
    if (!v || !this.noise) return;
    const { ctx, input } = v;
    const t0 = ctx.currentTime + 0.02;
    const time = stretch(shape.seconds, length);
    const at = (i: number) => t0 + time.at(i / 10);
    const end = t0 + length;
    const arch = 0.7 + Math.random() * 0.6;
    const lean = (Math.random() - 0.5) * 0.08;
    const tilt = (Math.random() - 0.5) * 10;

    const am = ctx.createGain();
    const env = ctx.createGain();
    am.connect(env).connect(input);
    env.gain.setValueAtTime(0, t0);
    env.gain.linearRampToValueAtTime(peak * shape.level[0], t0 + 0.015);
    for (let i = 1; i < 10; i++) {
      env.gain.linearRampToValueAtTime(peak * shape.level[i] * (0.88 + Math.random() * 0.24), at(i));
    }
    env.gain.linearRampToValueAtTime(peak * shape.level[10], Math.max(at(9), end - 0.025));
    env.gain.linearRampToValueAtTime(0, end);

    const pitch = new Float32Array(Math.ceil(length * 200) + 1);
    for (let j = 0; j < pitch.length; j++) {
      const step = time.step((j / (pitch.length - 1)) * length);
      pitch[j] = f0 * (1 + (spline(shape.pitch, step) - 1) * arch + lean * (step - 0.5));
    }
    const detunes: AudioParam[] = [];
    const spectra = [shape.opening, shape.open, shape.closing];
    const weights = [[1, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]];
    spectra.forEach((db, s) => {
      const imag = new Float32Array(PARTIALS + 1);
      let power = 0;
      for (let k = 1; k <= PARTIALS; k++) {
        const d = k <= db.length ? db[k - 1] : db[db.length - 1] - ROLLOFF * (k - db.length);
        const a = Math.pow(10, (d + (tilt * Math.log2(k)) / 3.6 + (Math.random() - 0.5) * 3) / 20);
        imag[k] = a;
        power += a * a;
      }
      for (let k = 1; k < imag.length; k++) imag[k] /= Math.sqrt(power);
      const osc = ctx.createOscillator();
      osc.setPeriodicWave(ctx.createPeriodicWave(new Float32Array(imag.length), imag, { disableNormalization: true }));
      osc.frequency.setValueCurveAtTime(pitch, t0, length);
      const g = ctx.createGain();
      const w = weights[s];
      g.gain.setValueAtTime(w[0], t0);
      [1, 5, 9].forEach((i, n) => g.gain.linearRampToValueAtTime(w[n + 1], at(i)));
      osc.connect(g).connect(am);
      osc.start(t0);
      osc.stop(end + 0.02);
      detunes.push(osc.detune);
    });
    this.wander(ctx, detunes, shape.flutter * (0.5 + Math.random()), t0, end + 0.02);
    this.wander(ctx, [am.gain], shape.shimmer, t0, end + 0.02);
    if (roll > 0) {
      const trill = ctx.createOscillator();
      trill.setPeriodicWave(ctx.createPeriodicWave([0, 0, 0.45], [0, 1, 0]));
      trill.frequency.value = roll;
      this.wander(ctx, [trill.frequency], roll * 0.12, t0, end + 0.02);
      const pulse = ctx.createGain();
      pulse.gain.value = 0.4;
      trill.connect(pulse).connect(am.gain);
      const warble = ctx.createGain();
      warble.gain.value = 90;
      trill.connect(warble);
      for (const d of detunes) warble.connect(d);
      trill.start(t0);
      trill.stop(end + 0.02);
    }

    const breath = ctx.createBufferSource();
    breath.buffer = this.noise;
    breath.loop = true;
    const air = ctx.createGain();
    let tail: AudioNode = breath;
    for (let n = 0; n < 2; n++) {
      const band = ctx.createBiquadFilter();
      band.type = 'bandpass';
      band.Q.value = 1.2;
      spectra.forEach((db, s) => {
        const hz = f0 * centroid(db);
        if (s === 0) band.frequency.setValueAtTime(hz, t0);
        else band.frequency.linearRampToValueAtTime(hz, at(s === 1 ? 5 : 9));
      });
      tail = tail.connect(band);
    }
    air.gain.setValueAtTime(shape.breath[0], t0);
    air.gain.linearRampToValueAtTime(shape.breath[0], at(1));
    air.gain.linearRampToValueAtTime(shape.breath[1], at(5));
    air.gain.linearRampToValueAtTime(shape.breath[2], end);
    tail.connect(air).connect(env);
    breath.start(t0, Math.random() * 0.9);
    breath.stop(end + 0.02);
  }

  /**
   * A mew `length` seconds long, the mouth keeping time with it. `plea` 0 is a kitten's ordinary mew; towards 1 it
   * becomes the call of something stuck and asking: lower, a higher arch, a bright pressed start and more breath.
   */
  mew(pan: number, loudness: number, plea = 1, length = 0.6 + 0.3 * plea): void {
    const now = this.out?.ctx.currentTime ?? 0;
    if (now - this.lastMew < 0.4) return;
    this.lastMew = now;
    const k = Math.max(0, Math.min(1, plea));
    const f0 = (1100 - 250 * k) * (0.94 + Math.random() * 0.12);
    this.sing(pan, 0.057 * loudness, blend(MEW, PLEA, k), f0, length, 0.55);
  }

  /** "Mrrp": a short rolled note, the sound a cat makes arriving somewhere it wanted to be, or greeting. */
  chirrup(pan: number, loudness: number): void {
    const f0 = 600 * (0.92 + Math.random() * 0.16);
    this.sing(pan, 0.033 * loudness, CHIRRUP, f0, 0.3 + Math.random() * 0.15, 0.35, 22 + Math.random() * 12);
  }

  /** A frightened mrrow, low and drawn out, `length` seconds. */
  yowl(pan: number, loudness: number, length = 0.75 + Math.random() * 0.2): void {
    const now = this.out?.ctx.currentTime ?? 0;
    if (now - this.lastMew < 0.4) return;
    this.lastMew = now;
    this.sing(pan, 0.073 * loudness, YOWL, 500 * (0.94 + Math.random() * 0.12), length, 0.55);
  }

  private puff(at: number, len: number, level: number, pan: number, type: BiquadFilterType, freq: number, q: number): void {
    const v = this.voice(pan, 1, 0.12);
    if (!v || !this.noise) return;
    const { ctx, input } = v;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    filter.Q.value = q;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, at);
    env.gain.linearRampToValueAtTime(level, at + Math.min(0.01, len * 0.3));
    env.gain.exponentialRampToValueAtTime(0.0001, at + len);
    src.connect(filter).connect(env).connect(input);
    src.start(at, Math.random() * 0.8);
    src.stop(at + len + 0.02);
  }

  /** A soft pad on slate or wood, only heard close to. */
  pat(pan: number, loudness: number): void {
    const now = this.out?.ctx.currentTime;
    if (now === undefined || now - this.lastPat < 0.05) return;
    this.lastPat = now;
    this.puff(now + 0.005, 0.045, 0.018 * loudness, pan, 'lowpass', 900, 0.7);
  }

  /** All four paws arriving at once after a jump. */
  land(pan: number, loudness: number): void {
    const now = this.out?.ctx.currentTime;
    if (now === undefined) return;
    this.puff(now + 0.005, 0.11, 0.08 * loudness, pan, 'lowpass', 320, 0.8);
    this.puff(now + 0.03, 0.05, 0.02 * loudness, pan, 'bandpass', 1400, 1);
  }

  /** Claws catching on stone and ivy on the way up. */
  scrabble(pan: number, loudness: number): void {
    const now = this.out?.ctx.currentTime;
    if (now === undefined) return;
    for (let i = 0; i < 3; i++) this.puff(now + 0.005 + i * (0.025 + Math.random() * 0.02), 0.03, 0.022 * loudness, pan, 'bandpass', 2600 + Math.random() * 1400, 2.5);
  }
}
