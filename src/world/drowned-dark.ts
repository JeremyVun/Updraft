import * as THREE from 'three';
import { SEA_FOG_TOP, atmo } from './atmosphere';
import { params } from '../params';
import { QA } from '../qa';
import { tuning } from '../tuning';
import { DARK_AT_STRAND, DARK_END, DARK_HEADING, DARK_TOPS, DARK_WAY, darkFrontPoint } from './drowned-way';
import { WOOD_LANDING } from './wood';

const smooth = THREE.MathUtils.smoothstep;

/** How far along `DARK_WAY` its front is when it has come up to the stranded boat and taken the light. */
const HELD = DARK_AT_STRAND - tuning.drowned.dark.holdBehind;
const CHURCH = DARK_WAY[DARK_WAY.length - 1];

const tmp = new THREE.Color();
const luminance = (c: THREE.Color) => c.r * 0.2126 + c.g * 0.7152 + c.b * 0.0722;

/** The hues it and the light it takes go toward, each at the brightness of what it tints. */
const HUE = {
  /** Its body deep in it risen far off, lilac grey; come close, steel blue; closed round, slate violet. */
  far: new THREE.Color(0.86, 0.84, 1.14),
  near: new THREE.Color(0.74, 0.85, 1.16),
  night: new THREE.Color(0.86, 0.86, 1.1),
  /** Its top where the sky lights it from above: a cold white. */
  top: new THREE.Color(0.93, 0.96, 1.07),
  /** The low sun on its billows' tops. */
  crest: new THREE.Color(2.4, 0.85, 0.5),
  /** What is left of the sunset aloft once the sun has gone. */
  rose: new THREE.Color(1.3, 0.7, 0.92),
  cold: new THREE.Color(0.84, 0.92, 1.16),
};

/** Moves a colour by k toward a hue at its own brightness, and scales it. */
function tint(c: THREE.Color, hue: THREE.Color, k: number, scale: number): THREE.Color {
  return c.lerp(tmp.copy(hue).multiplyScalar(luminance(c)), k).multiplyScalar(scale);
}

/**
 * The dark: a sea fog lying low on the water, a rising white tide. It rises on the horizon the way they came and comes
 * on over the village, its crest gold in the last of the sun and its body cold; roofs at its edge fade into it and are
 * gone, and it stands higher the further it comes. As it nears it takes the sun, and at the church it closes round her
 * and darkens into the storm's night.
 *
 * The story drives it by two numbers: its `front`, how far along `DARK_WAY` (the drift in, then her way over the
 * roofs to the tower) it has come, and its `level`, the height of its top. It is one field every shader reads
 * (`seaFog` in `ATMO_GLSL`), so whatever is in it truly fades; and one progression, from where it stands, drives it
 * and the light it takes.
 */
export class DarkBank {
  /** How far its front has come along `DARK_WAY`, in metres. */
  front = 0;
  /** How high its top stands over the water while it has a front, metres; its swells heave about it. */
  level = tuning.drowned.fog.level;
  /** 0 nothing on the horizon to 1 risen in full. */
  rise = 0;
  /** 0 a bank with a front to 1 closed round the eye and darkening into the storm's night. */
  close = 0;
  /** How far the storm's own night has taken over from the darkness the fog brought, 0 to 1. */
  storm = 0;
  /** How much of its swells' and heaps' height it keeps: 1 as it chases her, less lying still round the tower. */
  relief = 1;
  /** 0 to 1: how far its wing on the church's side has spread to its full width, so it lies all round the tower. */
  round = 0;
  /** Where it lies lower round a point: how far round (metres, 0 nowhere) and how high it lies there over the water. */
  readonly clearing = { x: 0, z: 0, radius: 0, floor: 1 };
  readonly ahead = DARK_HEADING.clone();
  private readonly at = new THREE.Vector2();
  private readonly crest = new THREE.Color();
  private readonly body = new THREE.Color();
  private readonly top = new THREE.Color();

  get objects(): THREE.Object3D[] {
    return [];
  }

  /**
   * The one progression: 0 clear dusk, `fog.far` risen far off, `fog.near` come close with the sun taken (it stays
   * there while it holds behind her), 1 closed round and dark. It goes on steadily while the front, easing in and
   * out, is still far off, so the light drains through the whole approach rather than at its end.
   */
  get progress(): number {
    const { far, near, risen } = tuning.drowned.fog;
    const come = THREE.MathUtils.clamp(this.front / HELD, 0, 1);
    return far * smooth(this.rise, 0, risen) + (near - far) * Math.sqrt(come) + (1 - near) * this.close;
  }

  /**
   * Comes on to `front`, never back, and rises as it comes: toward the level its front calls for (`tide`), never
   * faster than `levelRate` metres a second and never falling.
   */
  comeOn(front: number, dt: number): void {
    this.front = Math.max(this.front, front);
    this.level = Math.max(this.level, Math.min(this.tide(this.front), this.level + tuning.drowned.fog.levelRate * dt));
  }

  /**
   * The level a front this far along `DARK_WAY` calls for: over everything it has taken (all it has come `levelBehind`
   * metres past) by `levelOver`, the boat's masthead first; and never below its steady climb from the stranding to the
   * tower, so it is always rising while it comes.
   */
  tide(front: number): number {
    const k = tuning.drowned.fog;
    let over = -Infinity;
    for (const t of DARK_TOPS) if (t.along <= front - k.levelBehind) over = Math.max(over, t.top);
    const climb = THREE.MathUtils.lerp(k.levelFrom, k.levelTo, THREE.MathUtils.clamp((front - DARK_AT_STRAND) / (DARK_END - DARK_AT_STRAND), 0, 1));
    return Math.max(k.level, climb, over + k.levelOver);
  }

  /** Where its top usually lies at a point behind its front, metres over the water; its heaps stand over that. */
  topAt(x: number, z: number): number {
    return this.levelAt(x, z) * (1 - this.relief * (1 - SEA_FOG_TOP.middle));
  }

  /** The most its heaps rise over its level, as a share of it. */
  get heaped(): number {
    return 1 + this.relief * (SEA_FOG_TOP.highest - 1);
  }

  private levelAt(x: number, z: number): number {
    const c = this.clearing, k = tuning.drowned.church.fog;
    if (c.radius <= 0) return this.level;
    const rim = smooth(Math.hypot(x - c.x, z - c.z), c.radius, c.radius * k.clearRim + k.clearSoft);
    return THREE.MathUtils.lerp(Math.min(this.level, c.floor), this.level, rim);
  }

  /** Where its front is, `aside` metres along it from the way (+ to its right as it comes), for whoever watches it. */
  frontAt(out: THREE.Vector2, aside = 0): THREE.Vector2 {
    const k = tuning.drowned.dark, u = aside / k.halfWidth;
    darkFrontPoint(this.front, out);
    return out.set(out.x - this.ahead.y * aside + this.ahead.x * k.flank * u * u, out.y + this.ahead.x * aside + this.ahead.y * k.flank * u * u);
  }

  /** Where a lens at `eye` looking along `view` sees its front, low over the water: what the depth blur keeps sharp. */
  seenAt(eye: THREE.Vector3, view: THREE.Vector3, out: THREE.Vector3): THREE.Vector3 {
    darkFrontPoint(this.front, this.at);
    const ax = this.ahead.x, az = this.ahead.y;
    const toward = Math.min(view.x * ax + view.z * az, -0.25);
    const along = ((this.at.x - eye.x) * ax + (this.at.y - eye.z) * az) / toward;
    const reach = tuning.drowned.dark.halfWidth * 0.7;
    const aside = THREE.MathUtils.clamp((eye.x + view.x * along - this.at.x) * -az + (eye.z + view.z * along - this.at.y) * ax, -reach, reach);
    this.frontAt(this.at, aside);
    return out.set(this.at.x, 2, this.at.y);
  }

  /** `?fog=` stands it where the progression puts it, whatever the story is doing. */
  private force(p: number): void {
    const { far, near, risen } = tuning.drowned.fog;
    this.rise = p < far ? risen * (0.5 - Math.sin(Math.asin(1 - 2 * p / far) / 3)) : 1;
    this.front = THREE.MathUtils.clamp((p - far) / (near - far), 0, 1) ** 2 * HELD;
    this.close = THREE.MathUtils.clamp((p - near) / (1 - near), 0, 1);
  }

  /** Lays the fog out for every shader and takes the light it takes; after the palette has been set for the step. */
  update(_time: number, boat: THREE.Vector3, _dt = 1 / 60): void {
    if (QA && params.fog !== null) this.force(params.fog);
    const u = atmo.uniforms;
    // It belongs to the village: it thins off as the forest beach comes up out of it, leaving the storm's own weather.
    const k = tuning.drowned.fog, d = tuning.drowned.dark;
    const here = (1 - smooth(Math.hypot(boat.x - CHURCH.x, boat.z - CHURCH.y), 200, 320))
      * smooth(Math.hypot(boat.x - WOOD_LANDING.x, boat.z - WOOD_LANDING.y), k.shoreGone, k.shoreFrom);
    const amount = smooth(this.rise, 0, 0.5) * here;
    const drawnAmount = params.villageFog ? amount : 0;
    u.uSeaFogShape.value.w = drawnAmount;
    if (amount <= 0) {
      u.uSeaFogCrest.value.w = 0;
      return;
    }
    const { far, near } = k;
    const p = this.progress;
    const risen = smooth(this.rise, 0, k.risen);

    darkFrontPoint(this.front, this.at);
    u.uSeaFog.value.set(this.at.x, this.at.y, this.ahead.x, this.ahead.y);
    const drawn = smooth(p, far, near);
    const top = this.level * (0.3 + 0.7 * risen) * THREE.MathUtils.lerp(1, k.closedTop, this.close);
    u.uSeaFogShape.value.set(top, d.flank / (d.halfWidth * d.halfWidth), this.close, drawnAmount);
    const wing = THREE.MathUtils.lerp(THREE.MathUtils.lerp(d.wingFar, d.wing, drawn), 1, this.round);
    const fade = THREE.MathUtils.lerp(THREE.MathUtils.lerp(d.wingFadeFar, d.wingFade, drawn), 0.8, this.round);
    u.uSeaFogSides.value.set(d.halfWidth, d.halfWidth * 1.8, wing * d.halfWidth, (wing + fade) * d.halfWidth);
    u.uSeaFogRelief.value = this.relief;
    u.uSeaFogClear.value.set(this.clearing.x, this.clearing.z, this.clearing.radius, this.clearing.floor);

    const taken = THREE.MathUtils.clamp((p - far) / (near - far), 0, 1) * here;
    const night = smooth(p, near + 0.05, 1) * here * (1 - this.storm);
    const crestGone = smooth(p, far, near + 0.1);
    // White is what the light makes of it: lit from above by the sky round it, never a white of its own.
    const sky = luminance(u.uSkyAmbient.value) * 0.9 + luminance(u.uSkyHorizon.value) * 0.3;
    this.body.copy(HUE.far).lerp(HUE.near, taken).lerp(HUE.night, night)
      .multiplyScalar(sky * THREE.MathUtils.lerp(THREE.MathUtils.lerp(k.body, k.bodyNear, taken), k.night, night));
    // Closed round into the night it has no lit top: it is all one slate.
    this.top.copy(HUE.top).multiplyScalar(sky * THREE.MathUtils.lerp(k.top, k.topNear, taken)).lerp(this.body, night);
    // The low sun on the crests that face it; once the sun has gone from it only a little rose is left there.
    this.crest.copy(HUE.crest).multiplyScalar(luminance(u.uSunColor.value) * k.crest)
      .lerp(tmp.copy(HUE.rose).multiplyScalar(luminance(this.top) * k.roseLeft), crestGone);
    u.uSeaFogBody.value.set(this.body.r, this.body.g, this.body.b, k.air * risen * THREE.MathUtils.lerp(k.airFar, 1, drawn) * (1 - 0.6 * this.close));
    u.uSeaFogTop.value.copy(this.top);
    u.uSeaFogCrest.value.set(this.crest.r, this.crest.g, this.crest.b, k.stir * night);
    u.uSeaFogRim.value = k.rim * (1 - this.close);
    u.uSeaFogGlow.value = THREE.MathUtils.lerp(1, k.glowNear, crestGone);
    u.uSeaFogHaze.value = THREE.MathUtils.lerp(k.haze, k.hazeNear, drawn) * (1 - this.close);
    u.uSeaFogReach.value = THREE.MathUtils.lerp(k.airReachFar, k.airReach, drawn);

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
