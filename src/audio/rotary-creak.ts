import type { AudioOut } from '../creatures/voices';
import { tuning } from '../tuning';

export function rotaryCreak(out: AudioOut, noise: AudioBuffer, at: number, level: number, pan: number): void {
  const { ctx } = out, length = tuning.rotaryWashing.creakSeconds;
  const colour = .96 + Math.random() * .08;
  const count = 160, pressure = new Float32Array(count), pitch = new Float32Array(count);
  const slipRate = new Float32Array(count), slipDepth = new Float32Array(count);
  let wander = 0;
  for (let i = 0; i < count; i++) {
    const u = i / (count - 1);
    wander = wander * .75 + (Math.random() - .5) * .25;
    const grip = .7 + .18 * Math.sin(u * 83) + .12 * Math.sin(u * 173 + 1.1);
    const catchAgain = 1 - .78 * Math.exp(-(((u - .43) / .045) ** 2));
    pressure[i] = Math.min(1, u / .075) * Math.min(1, (1 - u) / .22) * grip * catchAgain;
    pitch[i] = colour * (710 + 170 * Math.sin(u * Math.PI) - 125 * u + 65 * wander);
    slipRate[i] = 31 + 32 * Math.sin(u * Math.PI) + 20 * wander;
    slipDepth[i] = 34 + 48 * Math.sin(u * Math.PI) ** 2;
  }

  const voice = ctx.createGain();
  voice.gain.value = level;
  const panner = ctx.createStereoPanner();
  panner.pan.value = Math.max(-.85, Math.min(.85, pan));
  const send = ctx.createGain(); send.gain.value = .018;
  voice.connect(panner).connect(out.bus);
  panner.connect(send).connect(out.reverb);
  const nodes: AudioNode[] = [voice, panner, send];
  const sources: AudioScheduledSourceNode[] = [];

  // Irregular slipping modulates inharmonic steel modes, rather than filtering a low wooden rasp.
  const slip = ctx.createOscillator(), depth = ctx.createGain();
  slip.type = 'triangle';
  slip.frequency.setValueCurveAtTime(slipRate, at, length);
  depth.gain.setValueCurveAtTime(slipDepth, at, length);
  slip.connect(depth);
  nodes.push(slip, depth); sources.push(slip);
  for (const [ratio, gain] of [[1, .19], [1.87, .067], [.37, .045]]) {
    const tone = ctx.createOscillator(), envelope = ctx.createGain();
    tone.frequency.setValueCurveAtTime(pitch.map(f => f * ratio), at, length);
    depth.connect(tone.frequency);
    envelope.gain.setValueCurveAtTime(pressure.map(p => p * gain), at, length);
    tone.connect(envelope).connect(voice);
    nodes.push(tone, envelope); sources.push(tone);
  }

  const scrape = ctx.createBufferSource(), band = ctx.createBiquadFilter(), scrapeGain = ctx.createGain();
  scrape.buffer = noise; scrape.loop = true;
  band.type = 'bandpass'; band.frequency.value = 1550 * colour; band.Q.value = .8;
  scrapeGain.gain.setValueCurveAtTime(pressure.map(p => p * .018), at, length);
  scrape.connect(band).connect(scrapeGain).connect(voice);
  nodes.push(scrape, band, scrapeGain); sources.push(scrape);

  // The collar's loose contact rings briefly as the strain lets go.
  for (const [frequency, gain] of [[1890, .027], [2873, .016]]) {
    const ring = ctx.createOscillator(), envelope = ctx.createGain();
    ring.frequency.value = frequency * colour;
    envelope.gain.setValueAtTime(0, at);
    for (const [fraction, amount] of [[.77, 1], [.86, .45]]) {
      const t = at + length * fraction;
      envelope.gain.setValueAtTime(0, t);
      envelope.gain.linearRampToValueAtTime(gain * amount, t + .002);
      envelope.gain.exponentialRampToValueAtTime(.00001, t + length * .085);
    }
    ring.connect(envelope).connect(voice);
    nodes.push(ring, envelope); sources.push(ring);
  }

  let playing = sources.length;
  for (const source of sources) {
    source.onended = () => { if (--playing === 0) for (const node of nodes) node.disconnect(); };
    source.start(at); source.stop(at + length + .015);
  }
}
