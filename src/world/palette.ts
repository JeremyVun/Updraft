import * as THREE from 'three';
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

/** Sets the sky, sun and haze between the still world (0) and the living one (1). */
export function applyPalette(t: number): void {
  const u = atmo.uniforms;
  const k = THREE.MathUtils.smootherstep(t, 0, 1);
  u.uSunColor.value.copy(STILL.sun).lerp(ALIVE.sun, k);
  u.uSkyZenith.value.copy(STILL.zenith).lerp(ALIVE.zenith, k);
  u.uSkyHorizon.value.copy(STILL.horizon).lerp(ALIVE.horizon, k);
  u.uSkyHorizonSun.value.copy(STILL.horizonSun).lerp(ALIVE.horizonSun, k);
  u.uSkyAmbient.value.copy(STILL.ambient).lerp(ALIVE.ambient, k);
  u.uGroundBounce.value.copy(STILL.bounce).lerp(ALIVE.bounce, k);
  u.uFogDensity.value = THREE.MathUtils.lerp(STILL.fog, ALIVE.fog, k);
}
