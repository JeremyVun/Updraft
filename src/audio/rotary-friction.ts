type Curve = readonly (readonly [number, number])[];

const pressure: Curve[] = [
  [[0, 0], [.055, .015], [.075, .1], [.102, .94], [.13, .8], [.15, .46], [.178, .88],
    [.205, .63], [.228, .94], [.253, .62], [.28, .42], [.31, .13], [.35, .055], [.41, .004], [.62, 0]],
  [[0, 0], [.045, .01], [.06, .6], [.077, .92], [.093, .68], [.112, .32], [.137, .58],
    [.16, .32], [.185, .39], [.215, .12], [.26, .032], [.32, .012], [.42, 0], [.62, 0]],
];
const pitch: Curve[] = [
  [[0, 2868], [.085, 2871], [.125, 2886], [.23, 2880], [.27, 2902], [.315, 2940], [.62, 2936]],
  [[0, 2855], [.075, 2868], [.092, 2910], [.107, 2966], [.126, 2953], [.155, 2915],
    [.19, 2930], [.27, 2942], [.62, 2935]],
];

function curve(points: Curve, t: number): number {
  for (let i = 1; i < points.length; i++) if (t <= points[i][0]) {
    const [a, x] = points[i - 1], [b, y] = points[i];
    const u = (t - a) / (b - a);
    return x + (y - x) * u * u * (3 - 2 * u);
  }
  return points[points.length - 1][1];
}

export function rotaryFriction(ctx: BaseAudioContext, variant: number): AudioBuffer {
  const rate = 24000, duration = .62;
  const buffer = ctx.createBuffer(1, Math.round(duration * rate), rate);
  const data = buffer.getChannelData(0);
  let seed = variant ? 48271 : 712;
  const random = () => ((seed = Math.imul(seed, 1664525) + 1013904223 | 0) >>> 0) / 2147483648 - 1;
  let phase = 0, upper = 0, overtone = 0, rough = 0, drift = 0, scrape1 = 0, scrape2 = 0;
  const driftRate = 1 - Math.exp(-1 / (.005 * rate));
  const roughRate = 1 - Math.exp(-1 / (.0007 * rate));
  const decay = Math.exp(-Math.PI * 850 / rate), resonance = 2 * decay * Math.cos(2 * Math.PI * 3800 / rate);
  const contacts = variant ? [[.334, .7], [.431, 1]] : [[.331, .35], [.397, 1], [.48, .3]];
  let peak = 0;
  for (let i = 0; i < data.length; i++) {
    const t = i / rate, load = curve(pressure[variant], t);
    drift += (random() - drift) * driftRate;
    rough += (random() - rough) * roughRate;
    const frequency = curve(pitch[variant], t) + drift * 115;
    phase += 2 * Math.PI * frequency / rate;
    upper += 2 * Math.PI * (frequency * 2 + 7 + drift * 24) / rate;
    overtone += 2 * Math.PI * (frequency * 3 - 13 - drift * 40) / rate;
    const chatter = Math.max(.1, 1 + rough * 1.7 + .1 * Math.sin(t * 2 * Math.PI * (61 + 12 * t)));
    const second = variant ? .18 : .75, third = variant ? .22 : .36;
    const ring = Math.sin(phase) + second * Math.sin(upper + .8) + third * Math.sin(overtone + 2.1);
    const scrape = random() * (1 - decay) + resonance * scrape1 - decay * decay * scrape2;
    scrape2 = scrape1; scrape1 = scrape;
    let collar = 0;
    for (const [when, strength] of contacts) {
      const release = t - when;
      if (release <= 0) continue;
      const contact = .4 * random() * Math.exp(-release / .009)
        + .45 * Math.sin(2 * Math.PI * 4670 * release) * Math.exp(-release / .024)
        + .09 * Math.sin(2 * Math.PI * 6350 * release) * Math.exp(-release / .019)
        + .07 * Math.sin(2 * Math.PI * 10440 * release) * Math.exp(-release / .014);
      collar += strength * (1 - Math.exp(-release / .0008)) * contact;
    }
    const edge = Math.min(1, t / .006, (data.length - 1 - i) / (.04 * rate));
    data[i] = (load * (ring * chatter + scrape * .17) + collar) * Math.sin(edge * Math.PI / 2) ** 2;
    peak = Math.max(peak, Math.abs(data[i]));
  }
  const gain = 10 ** (-12 / 20) / peak;
  for (let i = 0; i < data.length; i++) data[i] *= gain;
  return buffer;
}
