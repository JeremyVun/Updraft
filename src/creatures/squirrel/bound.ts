/**
 * The body through a squirrel's bound, as fractions of a stride from the forepaws touching down: it comes down
 * long and nose first onto its forepaws, vaults over them with its back rounding up hard as the hind feet swing
 * through, is bunched tightest as they land ahead of the forepaws, drives off them long and nose up, and flies
 * stretched out to the next landing. Lengths are metres before scale.
 */
export interface BoundShape {
  /** The body raised (positive) from how it runs. */
  rise: number;
  /** The back rounded up (positive) or long and hollow. */
  flex: number;
  /** The trunk drawn out along the spine (positive) or bunched up short. */
  stretch: number;
  /** Nose up. */
  pitch: number;
  /** The tail's root lifted, a little behind the body. */
  tail: number;
}

type Keys = readonly (readonly [number, number])[];

const RISE: Keys = [[0, 0.002], [0.12, -0.006], [0.24, -0.01], [0.4, 0.012], [0.56, 0.034], [0.72, 0.048], [0.88, 0.03]];
const FLEX: Keys = [[0, -0.2], [0.12, 0.3], [0.24, 0.6], [0.4, 0.15], [0.56, -0.25], [0.76, -0.32], [0.92, -0.28]];
const STRETCH: Keys = [[0, 0.016], [0.12, -0.006], [0.24, -0.024], [0.4, -0.004], [0.56, 0.02], [0.76, 0.024], [0.92, 0.022]];
const PITCH: Keys = [[0, -0.16], [0.12, -0.1], [0.24, 0.02], [0.4, 0.14], [0.56, 0.1], [0.76, 0], [0.92, -0.12]];
const TAIL: Keys = [[0, 0.15], [0.25, -0.08], [0.5, 0.02], [0.75, 0.2]];

/** A smooth closed curve through values at phases round the stride. */
function loop(p: number, keys: Keys): number {
  const n = keys.length;
  let x = p - Math.floor(p);
  let i = n - 1;
  if (x < keys[0][0]) x += 1;
  else for (let j = 0; j < n; j++) if (keys[j][0] <= x) i = j;
  const at = (j: number): readonly [number, number] => {
    const k = ((j % n) + n) % n;
    return [keys[k][0] + Math.floor(j / n), keys[k][1]];
  };
  const [t0, v0] = at(i - 1), [t1, v1] = at(i), [t2, v2] = at(i + 1), [t3, v3] = at(i + 2);
  const h = t2 - t1;
  const u = (x - t1) / h;
  const m1 = ((v2 - v0) / (t2 - t0)) * h;
  const m2 = ((v3 - v1) / (t3 - t1)) * h;
  const u2 = u * u, u3 = u2 * u;
  return (2 * u3 - 3 * u2 + 1) * v1 + (u3 - 2 * u2 + u) * m1 + (-2 * u3 + 3 * u2) * v2 + (u3 - u2) * m2;
}

/** `size` scales the whole movement and `air` its rise: a trunk or the wool asks a smaller bound than open ground. */
export function boundShape(p: number, size: number, air: number, out: BoundShape): BoundShape {
  out.rise = loop(p, RISE) * size * air;
  out.flex = loop(p, FLEX) * size;
  out.stretch = loop(p, STRETCH) * size;
  out.pitch = loop(p, PITCH) * size * (0.4 + 0.6 * air);
  out.tail = loop(p, TAIL) * size;
  return out;
}

/**
 * How high its body is carried through a bound that leaves the ground, in metres: thrown up off its hind feet at
 * `lift`, it falls under gravity `g` until its forepaws land at 0, and while its paws are down its legs take that
 * fall and give it back in one smooth give (no deeper than a quick bound's, however slowly it goes, and only
 * `give` of that as it sets off). `period` is the stride's length in seconds.
 */
export function boundFlight(p: number, lift: number, period: number, g: number, give: number): number {
  const x = p - Math.floor(p);
  const flight = (1 - lift) * period;
  const up = (g * flight) / 2;
  if (x < lift) return ((-up * give * Math.min(lift * period, 0.2)) / Math.PI) * Math.sin((Math.PI * x) / lift);
  const t = (x - lift) * period;
  return up * t - (g * t * t) / 2;
}
