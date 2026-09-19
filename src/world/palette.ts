import * as THREE from 'three';
import { params } from '../params';
import { atmo } from './atmosphere';

interface Palette {
  sun: THREE.Color;
  zenith: THREE.Color;
  horizon: THREE.Color;
  horizonSun: THREE.Color;
  ambient: THREE.Color;
  bounce: THREE.Color;
  fog: number;
}

const hdr = (hex: string, k: number) => new THREE.Color(hex).multiplyScalar(k);

/** The still world: a pale, windless, overcast morning with a veil of mist. */
const STILL: Palette = {
  sun: hdr('#e6e2da', 1.7),
  zenith: hdr('#97a1ab', 0.9),
  horizon: hdr('#d2cfcb', 0.92),
  horizonSun: hdr('#ddd4c6', 1.02),
  ambient: hdr('#b7bec6', 0.56),
  bounce: hdr('#8c877b', 0.2),
  fog: 0.0019,
};

/** The world alive: golden late afternoon. */
const ALIVE: Palette = {
  sun: hdr('#ffd2a0', 2.7),
  zenith: hdr('#3f75b8', 1.0),
  horizon: hdr('#d8c8c4', 0.95),
  horizonSun: hdr('#ffb46a', 1.25),
  ambient: hdr('#8fb2dc', 0.5),
  bounce: hdr('#a4895c', 0.22),
  fog: 0.0011,
};

const SUNSET: Palette = {
  sun: hdr('#ff9650', 2.3),
  zenith: hdr('#3a4f8c', 0.85),
  horizon: hdr('#e5ae98', 0.95),
  horizonSun: hdr('#ff8338', 1.6),
  ambient: hdr('#a39ccb', 0.42),
  bounce: hdr('#a0674a', 0.2),
  fog: 0.0013,
};

const DUSK: Palette = {
  sun: hdr('#c0503a', 0.25),
  zenith: hdr('#1a2350', 0.6),
  horizon: hdr('#8a5f73', 0.7),
  horizonSun: hdr('#c65a3a', 0.9),
  ambient: hdr('#5a5f96', 0.32),
  bounce: hdr('#40303a', 0.12),
  fog: 0.0014,
};

/** Moonlight: the single light becomes the moon, low and cool. */
const NIGHT: Palette = {
  sun: hdr('#a9bdf0', 0.42),
  zenith: hdr('#0a1230', 0.42),
  horizon: hdr('#243058', 0.42),
  horizonSun: hdr('#3e4a7a', 0.5),
  ambient: hdr('#4f62a0', 0.3),
  bounce: hdr('#1b1f30', 0.1),
  fog: 0.0014,
};

/** A passing shower: the sun still out but veiled, the sky grey and bright, the haze thick. */
function veil(p: Palette, shower: number): void {
  if (shower <= 0) return;
  const grey = (c: THREE.Color, k: number, lift: number) => {
    const l = c.r * 0.2126 + c.g * 0.7152 + c.b * 0.0722;
    c.lerp(tmp.setRGB(l, l, l * 1.04), k * shower).multiplyScalar(1 + lift * shower);
  };
  p.sun.multiplyScalar(1 - 0.4 * shower);
  grey(p.zenith, 0.55, 0.1);
  grey(p.horizon, 0.35, 0.08);
  grey(p.horizonSun, 0.25, 0);
  grey(p.ambient, 0.3, 0.12);
  p.fog *= 1 + 1.4 * shower;
}

/**
 * The squall, which takes two things: the warmth out of the colours, so the safe afternoon hues go to slate
 * while a sky that is already cold is left alone, and the daylight, of which a night has none left to lose.
 */
function bruise(p: Palette, storm: number, night: number): void {
  if (storm <= 0) return;
  const dim = storm * (1 - night);
  const chill = (c: THREE.Color, k: number, d: number) => {
    const l = c.r * 0.2126 + c.g * 0.7152 + c.b * 0.0722;
    const warmth = THREE.MathUtils.clamp((c.r - c.b) / Math.max(l, 1e-4), 0, 1);
    c.lerp(tmp.setRGB(l * 0.84, l * 0.93, l * 1.08), k * storm * warmth).multiplyScalar(1 - d * dim);
  };
  chill(p.sun, 0.9, 0.45);
  chill(p.zenith, 0.7, 0.32);
  chill(p.horizon, 0.85, 0.3);
  chill(p.horizonSun, 0.95, 0.4);
  chill(p.ambient, 0.7, 0.22);
  chill(p.bounce, 0.8, 0.32);
  p.fog *= 1 + storm;
}

const tmp = new THREE.Color();

const blank = (): Palette => ({
  sun: new THREE.Color(),
  zenith: new THREE.Color(),
  horizon: new THREE.Color(),
  horizonSun: new THREE.Color(),
  ambient: new THREE.Color(),
  bounce: new THREE.Color(),
  fog: 0,
});
const dayMix = blank();
const outMix = blank();

function mixInto(out: Palette, a: Palette, b: Palette, t: number): Palette {
  out.sun.copy(a.sun).lerp(b.sun, t);
  out.zenith.copy(a.zenith).lerp(b.zenith, t);
  out.horizon.copy(a.horizon).lerp(b.horizon, t);
  out.horizonSun.copy(a.horizonSun).lerp(b.horizonSun, t);
  out.ambient.copy(a.ambient).lerp(b.ambient, t);
  out.bounce.copy(a.bounce).lerp(b.bounce, t);
  out.fog = THREE.MathUtils.lerp(a.fog, b.fog, t);
  return out;
}

export function sunDirection(azDeg: number, elDeg: number, out = new THREE.Vector3()): THREE.Vector3 {
  const az = THREE.MathUtils.degToRad(azDeg);
  const el = THREE.MathUtils.degToRad(elDeg);
  return out.set(-Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el));
}

/**
 * Where the moon hangs at night (azimuth, elevation in degrees). Low, because the end of the story is watched
 * from a hill over the sea: a moon any higher throws its path onto water too near the shore to be seen, and
 * cannot be held in the same frame as the sea it lights.
 */
export const MOON = { az: -38, el: 12 } as const;

/** Where the light comes from for a time of day: the sun sinks into the north-west, then the moon takes over. */
function lightAngles(dusk: number): [number, number] {
  if (params.sun) return [params.sun[0], params.sun[1]];
  if (dusk <= 1) return [THREE.MathUtils.lerp(52, 32, dusk), THREE.MathUtils.lerp(13, 3.2, dusk)];
  if (dusk <= 1.5) return [32, THREE.MathUtils.lerp(3.2, -2.5, (dusk - 1) / 0.5)];
  return [MOON.az, MOON.el];
}

/**
 * Sets sky, light and haze from how alive the world is (0 still, 1 living) and the time of day
 * (`dusk`: 0 golden afternoon, 1 sunset, 1.5 last light, 2 night), veiled by a passing `shower` (0..1)
 * and drained by a `storm` (0..1).
 */
export function applyPalette(life: number, dusk: number, shower = 0, storm = 0): void {
  const u = atmo.uniforms;
  const k = THREE.MathUtils.smootherstep(life, 0, 1);
  u.uWorldLife.value = k;
  const day = mixInto(dayMix, STILL, ALIVE, k);
  let p = day;
  if (dusk > 0) {
    if (dusk <= 1) p = mixInto(outMix, day, SUNSET, THREE.MathUtils.smoothstep(dusk, 0, 1));
    else if (dusk <= 1.5) p = mixInto(outMix, SUNSET, DUSK, (dusk - 1) / 0.5);
    else p = mixInto(outMix, DUSK, NIGHT, THREE.MathUtils.smoothstep(dusk, 1.5, 2));
  }
  veil(p, shower);
  const night = THREE.MathUtils.smoothstep(dusk, 1.45, 1.95);
  /** After the shower, which brightens as it greys: in a squall the weather takes the light, it does not lift it. */
  bruise(p, storm, night);
  u.uShower.value = shower;

  u.uSunColor.value.copy(p.sun);
  u.uSkyZenith.value.copy(p.zenith);
  u.uSkyHorizon.value.copy(p.horizon);
  u.uSkyHorizonSun.value.copy(p.horizonSun);
  u.uSkyAmbient.value.copy(p.ambient);
  u.uGroundBounce.value.copy(p.bounce);
  u.uNight.value = night;
  /**
   * Once the very last of the day is out of the sky and no weather is in the way, the air is at its clearest:
   * the haze thins, the veil the world ends in draws back (main.ts), and the sea starts catching the stars.
   * Only the top of the dial, so a room that plays at nightfall keeps whatever murk it was built with.
   */
  const starlight = THREE.MathUtils.smoothstep(dusk, 1.92, 1.99) * (1 - storm);
  u.uStarlight.value = starlight;
  u.uFogDensity.value = p.fog * (1 - 0.35 * starlight);
  u.uMist.value = Math.max(0.42 * (1 - k), 0.3 * night * (1 - 0.6 * starlight)) + 0.22 * shower;
  const [az, el] = lightAngles(dusk);
  sunDirection(az, el, u.uSunDir.value);
}
