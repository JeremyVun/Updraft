import type { StairsAir } from './stairs-air';
import { tuning } from '../tuning';

/** How much of the shared beds and the birches' phrase the stairs leave playing; all 1 outside the room. */
export interface StairsMix {
  breeze: number;
  sea: number;
  birches: number;
  /** The birches' phrase has drained away in the white and can be let go. */
  birchesGone: boolean;
  /** The room's own score: the sail thins out into the fog. */
  score: number;
}

export const OUTSIDE_STAIRS: Readonly<StairsMix> = { breeze: 1, sea: 1, birches: 1, birchesGone: false, score: 1 };

const smooth = (from: number, to: number, x: number): number => {
  const k = Math.max(0, Math.min(1, (x - from) / (to - from)));
  return k * k * (3 - 2 * k);
};
const ease = (value: number, target: number, dt: number, seconds: number): number =>
  value + (target - value) * (1 - Math.exp(-dt / seconds));

/** The shared loop noise starts 40 ms in, past the blend of its seam. */
const NOISE_OVERLAP = 0.04;
/** Room sounds release and disconnect this long after the chapter stops describing its air. */
const LINGER = 5;

interface Layer { source: AudioBufferSourceNode; nodes: AudioNode[]; gain: GainNode }

/**
 * The air of the stairs in the clouds. In the white a close, muffled wind that buffets and moans more the higher
 * they climb; out on top almost nothing, a thin high air; over the cloud the hull's soft hiss through its tops;
 * the fog a soft wash. It also tells the shared beds how much of the breeze and the sea to keep, and drains the
 * birches' phrase as the travellers go up into the white.
 */
export class StairsSound {
  private readonly out: GainNode;
  private readonly wet: GainNode;
  private layers: Record<'body' | 'howl' | 'rush' | 'high' | 'hull', Layer> | null = null;
  private readonly howlFilter: BiquadFilterNode;
  private readonly bodyFilter: BiquadFilterNode;
  private readonly rushPan: StereoPannerNode;
  private readonly hullFilter: BiquadFilterNode;
  private readonly mix: StairsMix = { ...OUTSIDE_STAIRS };
  private drainTarget = 0;
  private drain = 0;
  private up = 0;
  private inside = 0;
  private open = 0;
  private fog = 0;
  private buffet = 0;
  private buffetPan = 0;
  private buffetPeak = 0;
  private buffetUntil = 0;
  private nextBuffet = 0;
  private swell = 0;
  private swellTarget = 0;
  private nextSwell = 0;
  private emerged = false;
  private absent = 0;
  private stopped = false;
  private readonly body: GainNode;
  private readonly howl: GainNode;
  private readonly rush: GainNode;
  private readonly high: GainNode;
  private readonly hull: GainNode;

  constructor(private readonly ctx: AudioContext, master: AudioNode, reverb: AudioNode) {
    this.out = ctx.createGain();
    this.out.gain.value = tuning.audio.stairsAirLevel;
    this.out.connect(master);
    this.wet = ctx.createGain();
    this.wet.connect(reverb);
    this.body = this.gain(0.08);
    this.bodyFilter = this.filter('lowpass', 420, 0.5);
    this.howl = this.gain(0.2);
    this.howlFilter = this.filter('bandpass', 300, 7);
    this.rush = this.gain(0.12);
    this.rushPan = ctx.createStereoPanner();
    this.high = this.gain(0.7);
    this.hull = this.gain(0.22);
    this.hullFilter = this.filter('bandpass', 1100, 0.55);
  }

  get finished(): boolean {
    return this.stopped;
  }

  private gain(send: number): GainNode {
    const gain = this.ctx.createGain();
    gain.gain.value = 0;
    gain.connect(this.out);
    const wet = this.ctx.createGain();
    wet.gain.value = send;
    gain.connect(wet).connect(this.wet);
    return gain;
  }

  private filter(type: BiquadFilterType, frequency: number, q: number): BiquadFilterNode {
    const filter = this.ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = frequency;
    filter.Q.value = q;
    return filter;
  }

  /** Each layer reads the shared loop noise from its own offset and speed, so no two move together. */
  private start(noise: AudioBuffer): void {
    const now = this.ctx.currentTime;
    const layer = (gain: GainNode, rate: number, chain: AudioNode[]): Layer => {
      const source = this.ctx.createBufferSource();
      source.buffer = noise;
      source.loop = true;
      source.loopStart = NOISE_OVERLAP;
      source.playbackRate.value = rate;
      let node: AudioNode = source;
      for (const next of chain) node = node.connect(next);
      node.connect(gain);
      source.start(now, Math.random() * 5);
      return { source, nodes: chain, gain };
    };
    const highpass = this.filter('highpass', 2600, 0.5), highTop = this.filter('lowpass', 7200, 0.4);
    const hullLow = this.filter('highpass', 260, 0.5), hullTop = this.filter('lowpass', 3800, 0.4);
    const rushBand = this.filter('bandpass', 1300, 0.8);
    this.layers = {
      body: layer(this.body, 0.93, [this.bodyFilter]),
      howl: layer(this.howl, 1.07, [this.howlFilter]),
      rush: layer(this.rush, 1, [rushBand, this.rushPan]),
      high: layer(this.high, 0.97, [highpass, highTop]),
      hull: layer(this.hull, 1.04, [hullLow, this.hullFilter, hullTop]),
    };
  }

  /** Follows the chapter's air; returns what the shared beds and the scores should keep. */
  update(air: StairsAir | undefined, noise: AudioBuffer | null, now: number, dt: number): StairsMix {
    if (this.stopped) return OUTSIDE_STAIRS;
    if (!this.layers && noise && air) this.start(noise);
    this.absent = air ? 0 : this.absent + dt;
    if (!air && this.absent > LINGER) {
      this.stop();
      return OUTSIDE_STAIRS;
    }
    const k = tuning.audio.stairsAir;
    const phase = air?.phase ?? 'down';
    const climb = air?.climb ?? 0;
    const inCloud = phase === 'cloud' || phase === 'under';
    // Heard from below as the bird goes first, then all round them in the white.
    const inside = air ? Math.max(air.cloud, phase === 'cloud' ? k.fromBelow : 0) * (inCloud ? 1 : 0) : 0;
    this.inside = ease(this.inside, inside * (1 - (air?.open ?? 0)), dt, inside > this.inside ? 0.8 : 0.45);
    this.up = ease(this.up, air ? smooth(0, 0.55, climb) : 0, dt, 1.2);
    this.open = ease(this.open, air ? air.open : 0, dt, 0.6);
    this.fog = ease(this.fog, air?.fog ?? 0, dt, 0.8);

    this.buffets(now, dt, climb, phase === 'fog');
    const buffet = this.buffet;
    const tension = 0.35 + 0.65 * climb;
    const fogWash = k.fogLevel * this.fog;
    const bodyLevel = Math.max(this.inside * tension * (0.72 + 0.55 * buffet), fogWash * (0.9 + 0.2 * buffet));
    this.set(this.body.gain, k.bodyLevel * bodyLevel, now, 0.08);
    this.bodyFilter.frequency.setTargetAtTime(330 + 280 * climb * this.inside + 380 * buffet * this.inside + 90 * this.fog, now, 0.12);
    const moan = this.inside * smooth(0.12, 0.85, climb) * (0.35 + 0.65 * buffet);
    this.set(this.howl.gain, k.howlLevel * moan, now, 0.1);
    this.howlFilter.frequency.setTargetAtTime((250 + 170 * climb) * (1 + 0.24 * buffet) * (1 + 0.035 * Math.sin(now * 0.23)), now, 0.25);
    this.set(this.rush.gain, k.rushLevel * this.inside * buffet * buffet * (0.3 + 0.7 * climb), now, 0.06);
    this.rushPan.pan.setTargetAtTime(this.buffetPan, now, 0.5);

    const breath = 0.8 + 0.2 * Math.sin(now * 0.31) * Math.sin(now * 0.113 + 1);
    this.set(this.high.gain, k.highLevel * this.open * this.up * (1 - 0.7 * this.fog) * breath, now, 0.4);

    const speed = air?.speed ?? 0, v = smooth(0.4, 5.5, speed);
    this.swells(now, dt);
    this.set(this.hull.gain, k.hullLevel * v * this.up * (1 - 0.55 * this.fog) * (0.85 + 0.25 * this.swell), now, 0.25);
    this.hullFilter.frequency.setTargetAtTime((800 + 1300 * v) * (1 - 0.35 * this.fog), now, 0.3);

    if (air?.phase === 'above' && !this.emerged) {
      this.emerged = true;
      if (noise) this.lastGust(noise, now);
    }

    const toward = !air ? this.drainTarget : phase !== 'under' ? 1 : smooth(0.05, 0.6, air.cloud);
    this.drainTarget = Math.max(this.drainTarget, toward);
    this.drain = ease(this.drain, this.drainTarget, dt, k.drain);
    const m = this.mix;
    m.birches = 1 - this.drain;
    m.birchesGone = m.birches < 0.005;
    m.breeze = (1 - 0.8 * this.up) * (1 - 0.55 * this.inside);
    m.sea = (1 - this.up) * (1 - 0.6 * this.fog);
    m.score = 1 - 0.85 * this.fog;
    return m;
  }

  /** Gusts in the white come every few seconds low down and every second or two near the top. */
  private buffets(now: number, dt: number, climb: number, gentle: boolean): void {
    if (now >= this.nextBuffet) {
      this.buffetPeak = (gentle ? 0.25 : 0.35 + 0.65 * Math.random());
      this.buffetUntil = now + 0.35 + Math.random() * 0.9;
      this.nextBuffet = now + (4.6 - 3 * climb) * (0.55 + Math.random() * 0.9);
      this.buffetPan = Math.random() * 1.4 - 0.7;
    }
    const target = now < this.buffetUntil ? this.buffetPeak : 0;
    this.buffet = ease(this.buffet, target, dt, target > this.buffet ? 0.28 : 0.9);
  }

  /** The hull meets the billows unevenly: a slow wander, never a beat. */
  private swells(now: number, dt: number): void {
    if (now >= this.nextSwell) {
      this.swellTarget = Math.random() * 2 - 1;
      this.nextSwell = now + 1.4 + Math.random() * 2.8;
    }
    this.swell = ease(this.swell, this.swellTarget, dt, 1.1);
  }

  private set(param: AudioParam, value: number, now: number, tc: number): void {
    param.setTargetAtTime(value, now, tc);
  }

  /** Coming out on top, the last of the wind goes past them and away, and then there is nothing. */
  private lastGust(noise: AudioBuffer, now: number): void {
    const ctx = this.ctx;
    const source = ctx.createBufferSource();
    source.buffer = noise;
    source.loop = true;
    source.loopStart = NOISE_OVERLAP;
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.Q.value = 0.9;
    band.frequency.setValueAtTime(950, now);
    band.frequency.exponentialRampToValueAtTime(240, now + 2.6);
    const gain = ctx.createGain();
    const peak = tuning.audio.stairsAir.lastGustLevel;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(peak, now + 0.35);
    gain.gain.exponentialRampToValueAtTime(peak * 0.02, now + 2.8);
    gain.gain.linearRampToValueAtTime(0, now + 3);
    const pan = ctx.createStereoPanner();
    const side = Math.random() < 0.5 ? -1 : 1;
    pan.pan.setValueAtTime(0.1 * side, now);
    pan.pan.linearRampToValueAtTime(0.75 * side, now + 2.6);
    const send = ctx.createGain();
    send.gain.value = 0.35;
    source.connect(band).connect(gain).connect(pan).connect(this.out);
    pan.connect(send).connect(this.wet);
    source.onended = () => { source.disconnect(); band.disconnect(); gain.disconnect(); pan.disconnect(); send.disconnect(); };
    source.start(now, Math.random() * 5);
    source.stop(now + 3.05);
  }

  stop(): void {
    if (this.stopped) return;
    this.stopped = true;
    const now = this.ctx.currentTime;
    for (const gain of [this.body, this.howl, this.rush, this.high, this.hull]) {
      gain.gain.cancelScheduledValues(now);
      gain.gain.setValueAtTime(gain.gain.value, now);
      gain.gain.linearRampToValueAtTime(0, now + 0.3);
    }
    const layers = this.layers ? Object.values(this.layers) : [];
    if (!layers.length) {
      this.out.disconnect();
      this.wet.disconnect();
      return;
    }
    let remaining = layers.length;
    for (const layer of layers) {
      layer.source.onended = () => {
        layer.source.disconnect();
        for (const node of layer.nodes) node.disconnect();
        if (--remaining === 0) {
          for (const gain of [this.body, this.howl, this.rush, this.high, this.hull]) gain.disconnect();
          this.out.disconnect();
          this.wet.disconnect();
        }
      };
      layer.source.stop(now + 0.35);
    }
  }
}

let knockBuffer: { ctx: BaseAudioContext; buffer: AudioBuffer } | null = null;

/**
 * A loose flight knocking home: the soft wooden tok of a toy block set down on a stair, a smaller tk as it settles,
 * and a little puff of the cloud it pushed out of the way.
 */
export function flightKnock(ctx: AudioContext, master: AudioNode, reverb: AudioNode, noise: AudioBuffer | null): void {
  const k = tuning.audio.flightKnock;
  const t0 = ctx.currentTime + 0.02;
  const out = ctx.createGain();
  out.gain.value = k.level;
  out.connect(master);
  const send = ctx.createGain();
  send.gain.value = k.reverb;
  out.connect(send).connect(reverb);
  const nodes: AudioNode[] = [out, send];
  const sources: AudioScheduledSourceNode[] = [];
  if (knockBuffer?.ctx !== ctx) {
    const length = Math.floor(ctx.sampleRate * 0.03);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const d = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 4);
    knockBuffer = { ctx, buffer };
  }
  const soft = ctx.createBiquadFilter();
  soft.type = 'lowpass';
  soft.frequency.value = 2600;
  soft.Q.value = 0.4;
  soft.connect(out);
  nodes.push(soft);
  /** A small block of wood rings at a few inharmonic modes, the higher ones gone almost at once. */
  const tok = (at: number, strength: number, pitch: number): void => {
    for (const [ratio, amp, life] of [[1, 1, 0.16], [2.41, 0.42, 0.07], [4.36, 0.16, 0.04]] as const) {
      const o = ctx.createOscillator();
      o.frequency.value = k.pitch * pitch * ratio;
      const g = ctx.createGain();
      const top = strength * amp * 0.5;
      g.gain.setValueAtTime(0, at);
      g.gain.linearRampToValueAtTime(top, at + 0.0025);
      g.gain.exponentialRampToValueAtTime(0.0001, at + life);
      g.gain.linearRampToValueAtTime(0, at + life + 0.01);
      o.connect(g).connect(soft);
      nodes.push(g);
      sources.push(o);
      o.start(at);
      o.stop(at + life + 0.02);
    }
    const thump = ctx.createOscillator();
    thump.frequency.setValueAtTime(k.pitch * pitch * 0.5, at);
    thump.frequency.exponentialRampToValueAtTime(k.pitch * pitch * 0.4, at + 0.08);
    const tg = ctx.createGain();
    tg.gain.setValueAtTime(0, at);
    tg.gain.linearRampToValueAtTime(strength * 0.35, at + 0.004);
    tg.gain.exponentialRampToValueAtTime(0.0001, at + 0.1);
    tg.gain.linearRampToValueAtTime(0, at + 0.11);
    thump.connect(tg).connect(soft);
    nodes.push(tg);
    sources.push(thump);
    thump.start(at);
    thump.stop(at + 0.12);
    const click = ctx.createBufferSource();
    click.buffer = knockBuffer!.buffer;
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 1500 * pitch;
    band.Q.value = 1.1;
    const cg = ctx.createGain();
    cg.gain.value = strength * 0.5;
    click.connect(band).connect(cg).connect(soft);
    nodes.push(band, cg);
    sources.push(click);
    click.start(at);
  };
  tok(t0, 1, 1);
  tok(t0 + 0.105 + Math.random() * 0.02, 0.42, 1.03);
  tok(t0 + 0.19 + Math.random() * 0.02, 0.14, 1.05);
  if (noise) {
    const puff = ctx.createBufferSource();
    puff.buffer = noise;
    puff.loop = true;
    puff.loopStart = NOISE_OVERLAP;
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.Q.value = 0.7;
    band.frequency.setValueAtTime(1500, t0);
    band.frequency.exponentialRampToValueAtTime(480, t0 + 0.8);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(k.puff, t0 + 0.04);
    g.gain.exponentialRampToValueAtTime(k.puff * 0.01, t0 + 0.85);
    g.gain.linearRampToValueAtTime(0, t0 + 0.9);
    puff.connect(band).connect(g).connect(out);
    nodes.push(band, g);
    sources.push(puff);
    puff.start(t0, Math.random() * 5);
    puff.stop(t0 + 0.92);
  }
  let remaining = sources.length;
  for (const source of sources) {
    source.onended = () => {
      source.disconnect();
      if (--remaining === 0) for (const node of nodes) node.disconnect();
    };
  }
}
