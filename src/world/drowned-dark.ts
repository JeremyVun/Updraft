import * as THREE from 'three';
import { atmo } from './atmosphere';
import { params } from '../params';
import { QA } from '../qa';
import { tuning } from '../tuning';
import { DARK_AT_STRAND, DARK_WAY, darkWayPoint } from './drowned-way';

const smooth = THREE.MathUtils.smoothstep;

/** How far along `DARK_WAY` the story brings its front while the boat lies becalmed: just behind the boat. */
const HELD = DARK_AT_STRAND - tuning.drowned.dark.holdBehind;
const CHURCH = DARK_WAY[DARK_WAY.length - 1];

const tmp = new THREE.Color();
const luminance = (c: THREE.Color) => c.r * 0.2126 + c.g * 0.7152 + c.b * 0.0722;

/** The hues it and the light it takes go toward, each at the brightness of what it tints. */
const HUE = {
  /** Its body risen far off, lilac grey; come close, steel blue; closed round, slate violet. */
  far: new THREE.Color(0.94, 0.88, 1.1),
  near: new THREE.Color(0.74, 0.85, 1.16),
  night: new THREE.Color(0.86, 0.86, 1.1),
  /** The low sun on its crest. */
  crest: new THREE.Color(2.2, 0.62, 0.32),
  /** What is left of the sunset aloft once the sun has gone. */
  rose: new THREE.Color(1.3, 0.7, 0.92),
  cold: new THREE.Color(0.84, 0.92, 1.16),
};

/** Moves a colour by k toward a hue at its own brightness, and scales it. */
function tint(c: THREE.Color, hue: THREE.Color, k: number, scale: number): THREE.Color {
  return c.lerp(tmp.copy(hue).multiplyScalar(luminance(c)), k).multiplyScalar(scale);
}

/**
 * The dark: a sea fog lying low on the water. It rises on the horizon the way they came and comes on over the
 * village, its crest gold in the last of the sun and its body cold; roofs at its edge fade into it and are gone. As
 * it nears it takes the sun, and at the church it closes round her and darkens into the storm's night.
 *
 * It is one field every shader reads (`seaFog` in `ATMO_GLSL`), so whatever is in it truly fades; and one
 * progression, from where it stands, drives it and the light it takes.
 */
export class DarkBank {
  /** How far its front has come along `DARK_WAY`, in metres. */
  reach = 0;
  /** 0 nothing on the horizon to 1 risen in full. */
  rise = 0;
  /** 0 a bank with a front to 1 closed round the eye and darkening into the storm's night. */
  close = 0;
  /** The way it comes where its front is now. */
  private readonly ahead = new THREE.Vector2().subVectors(DARK_WAY[1], DARK_WAY[0]).normalize();
  private readonly front = new THREE.Vector2();
  private readonly back = new THREE.Vector2();
  private readonly crest = new THREE.Color();
  private readonly body = new THREE.Color();

  get objects(): THREE.Object3D[] {
    return [];
  }

  /**
   * The one progression: 0 clear dusk, `fog.far` risen far off, `fog.near` come close with the sun taken (it stays
   * there while it holds behind her), 1 closed round and dark.
   */
  get progress(): number {
    const { far, farCome, near } = tuning.drowned.fog;
    const come = THREE.MathUtils.clamp(this.reach / HELD, 0, 1);
    return far * Math.min(this.rise, come / farCome) + (near - far) * Math.max(0, (come - farCome) / (1 - farCome)) + (1 - near) * this.close;
  }

  /** Where its front is, `aside` metres along it from the way (+ to its right as it comes), for whoever watches it. */
  frontAt(out: THREE.Vector2, aside = 0): THREE.Vector2 {
    const k = tuning.drowned.dark, u = aside / k.halfWidth;
    darkWayPoint(this.reach, out);
    return out.set(out.x - this.ahead.y * aside + this.ahead.x * k.flank * u * u, out.y + this.ahead.x * aside + this.ahead.y * k.flank * u * u);
  }

  /** Where a lens at `eye` looking along `view` sees its front, low over the water: what the depth blur keeps sharp. */
  seenAt(eye: THREE.Vector3, view: THREE.Vector3, out: THREE.Vector3): THREE.Vector3 {
    darkWayPoint(this.reach, this.front);
    const ax = this.ahead.x, az = this.ahead.y;
    const toward = Math.min(view.x * ax + view.z * az, -0.25);
    const along = ((this.front.x - eye.x) * ax + (this.front.y - eye.z) * az) / toward;
    const reach = tuning.drowned.dark.halfWidth * 0.7;
    const aside = THREE.MathUtils.clamp((eye.x + view.x * along - this.front.x) * -az + (eye.z + view.z * along - this.front.y) * ax, -reach, reach);
    this.frontAt(this.front, aside);
    return out.set(this.front.x, 2, this.front.y);
  }

  /** `?fog=` stands it where the progression puts it, whatever the story is doing. */
  private force(p: number): void {
    const { far, farCome, near } = tuning.drowned.fog;
    this.rise = THREE.MathUtils.clamp(p / far, 0, 1);
    this.reach = (farCome * this.rise + (1 - farCome) * THREE.MathUtils.clamp((p - far) / (near - far), 0, 1)) * HELD;
    this.close = THREE.MathUtils.clamp((p - near) / (1 - near), 0, 1);
  }

  /** Lays the fog out for every shader and takes the light it takes; after the palette has been set for the step. */
  update(_time: number, eye: THREE.Vector3): void {
    if (QA && params.fog !== null) this.force(params.fog);
    const u = atmo.uniforms;
    // It belongs to the village: on the way to the forest beach it gives the sea over to the storm's own weather.
    const here = 1 - smooth(Math.hypot(eye.x - CHURCH.x, eye.z - CHURCH.y), 200, 320);
    const amount = smooth(this.rise, 0, 0.5) * here;
    u.uSeaFogShape.value.w = amount;
    if (amount <= 0) {
      u.uSeaFogCrest.value.w = 0;
      return;
    }
    const k = tuning.drowned.fog, d = tuning.drowned.dark;
    const { far, near } = k;
    const p = this.progress;

    darkWayPoint(this.reach, this.front);
    darkWayPoint(this.reach - 40, this.back);
    if (this.front.distanceToSquared(this.back) > 1) this.ahead.subVectors(this.front, this.back).normalize();
    u.uSeaFog.value.set(this.front.x, this.front.y, this.ahead.x, this.ahead.y);
    // Low on the horizon as it rises, and standing higher the nearer it comes.
    const top = k.top * (0.25 + 0.75 * smooth(this.rise, 0, 1)) * (0.7 + 0.3 * smooth(p, far, near)) * (1 + 0.4 * this.close);
    u.uSeaFogShape.value.set(top, d.flank / (d.halfWidth * d.halfWidth), this.close, amount);
    u.uSeaFogSides.value.set(d.halfWidth, d.halfWidth * 1.8, d.wing * d.halfWidth, (d.wing + 0.3) * d.halfWidth);

    const taken = smooth(p, far + 0.02, near) * here;
    const night = smooth(p, near + 0.05, 1) * here;
    const crestGone = smooth(p, far + 0.08, near + 0.15);
    // White is what the light makes of it: as bright as the sky round it lights it, never a white of its own.
    const sky = luminance(u.uSkyAmbient.value) * 0.9 + luminance(u.uSkyHorizon.value) * 0.3;
    this.body.copy(HUE.far).lerp(HUE.near, taken).lerp(HUE.night, night)
      .multiplyScalar(sky * k.body);
    this.crest.copy(HUE.crest).multiplyScalar(luminance(u.uSunColor.value) * k.crest * (1 - 0.9 * crestGone));
    u.uSeaFogBody.value.set(this.body.r, this.body.g, this.body.b, k.air * smooth(p, far, near) * (1 - 0.6 * this.close));
    u.uSeaFogCrest.value.set(this.crest.r, this.crest.g, this.crest.b, k.stir * night);

    if (taken <= 0) return;
    tint(u.uSunColor.value, HUE.cold, 0.5 * taken, 1 - 0.88 * taken);
    // What the sun gave the near things the fog gives back softly from all round, cold.
    tint(u.uSkyAmbient.value, HUE.cold, 0.55 * taken, (1 + 0.2 * taken) * (1 - 0.45 * night));
    tint(u.uGroundBounce.value, HUE.cold, 0.5 * taken, 1 - 0.3 * taken);
    tint(u.uSkyZenith.value, HUE.cold, 0.3 * taken, (1 - 0.12 * taken) * (1 - 0.7 * night));
    tint(u.uSkyHorizon.value, HUE.far, 0.5 * taken, (1 - 0.15 * taken) * (1 - 0.7 * night));
    tint(u.uSkyHorizonSun.value, HUE.rose, 0.75 * taken, (1 - 0.4 * taken) * (1 - 0.75 * night));
  }
}
