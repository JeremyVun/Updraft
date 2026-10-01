import * as THREE from 'three';
import { GpuRunner, PingPong, simMaterial, simTarget } from '../gl/gpu';
import { Readback } from '../gl/readback';
import { atmo } from '../world/atmosphere';
import { WINDOW, onWindowMove } from '../world/window';
import { tuning } from '../tuning';
import { WindClock, WIND_STEP, type TimedSplat } from './clock';
import {
  ADVECT_FRAG,
  CURL_VORTICITY_FRAG,
  DIVERGENCE_FRAG,
  FORCE_FRAG,
  GRADIENT_FRAG,
  MAX_SPLATS,
  SCALE_FRAG,
  SHIFT_FRAG,
  pressureFrag,
} from './shaders';

/** Pairs of pressure relaxations per pass: fewer passes, each reading a wider neighbourhood. */
const PAIRS_PER_PASS = 2;

/** A push of air along a segment, in world units. See docs/contracts/wind.md. */
export interface Splat {
  /** Stable producer identity: samples of one force are resampled into one splat per solver tick. */
  source: object | string;
  /** Endpoints describe movement during the frame, rather than a stationary brush segment. */
  trail?: boolean;
  /** One-shot event; otherwise this force is sustained over the current render interval. */
  impulse?: boolean;
  ax: number;
  az: number;
  bx: number;
  bz: number;
  vx: number;
  vz: number;
  radius: number;
  /** Gust energy added at the centre of the stroke (0..1). */
  energy: number;
  /** Tangential acceleration around the segment end, in units/s². */
  swirl: number;
  /** Updraft added per second at the segment end. */
  lift: number;
}

export interface WindSample {
  x: number;
  z: number;
  energy: number;
  lift: number;
}

const smooth = (from: number, to: number, x: number) => THREE.MathUtils.smoothstep(x, from, to);

/**
 * The wind as a hanging thing feels it; mirrors `feltWind` in GLSL. `calm` is `WindField.calm`. Writes x and z of
 * `out` and leaves the rest of the sample as it was.
 */
export function feltWind(sample: WindSample, calm: number, out: WindSample = sample): WindSample {
  const s = Math.hypot(sample.x, sample.z);
  if (s < 1e-4) {
    out.x = 0;
    out.z = 0;
    return out;
  }
  const arrived = smooth(tuning.wind.arriveFrom, tuning.wind.arriveFull, sample.energy);
  const quiet = calm * (1 - Math.exp(-s / Math.max(calm, 1e-3)));
  const k = (quiet + (s - quiet) * arrived) / s;
  out.x = sample.x * k;
  out.z = sample.z * k;
  return out;
}

/** The same spring the sway texture runs, for one thing on the CPU: a sail, a kite, a pinwheel. */
export class Sway {
  x = 0;
  z = 0;
  private vx = 0;
  private vz = 0;

  constructor(
    private readonly stiffness = tuning.wind.swayStiffness,
    private readonly damping = tuning.wind.swayDamping,
  ) {}

  update(feltX: number, feltZ: number, dt: number): void {
    for (let left = Math.min(dt, 0.1); left > 1e-5; left -= STEP) {
      const h = Math.min(STEP, left);
      this.vx += (this.stiffness * (feltX - this.x) - this.damping * this.vx) * h;
      this.vz += (this.stiffness * (feltZ - this.z) - this.damping * this.vz) * h;
      this.x += this.vx * h;
      this.z += this.vz * h;
    }
  }
}

const READ_RES = 128;
const STEP = WIND_STEP;

export interface WindOptions {
  /** Grid resolution; 256 by default. */
  res?: number;
  /** Jacobi pressure iterations per substep, an even number; 24 by default. */
  iterations?: number;
}

export class WindField {
  readonly res: number;
  readonly breeze = new THREE.Vector2();
  private readonly gpu: GpuRunner;
  /** The wind, the grass lean and the sway at the end of a tick, written together. */
  private readonly state: PingPong;
  /** The wind between the passes of a tick. */
  private readonly vel: PingPong;
  private readonly pressure: PingPong;
  private readonly divergence: THREE.WebGLRenderTarget;
  private readonly readTarget: THREE.WebGLRenderTarget;
  private readonly readback: Readback<{ minX: number; minZ: number; size: number }>;
  private readonly cpu = new Float32Array(READ_RES * READ_RES * 4);
  private readonly splats: Splat[] = [];
  private readonly runTick = (time: number, inputs: TimedSplat[]): void => this.substep(time, inputs);

  private readonly forceMat: THREE.ShaderMaterial;
  private readonly vorticityMat: THREE.ShaderMaterial;
  private readonly divergenceMat: THREE.ShaderMaterial;
  /** The relaxation passes of one tick, the first carrying the last solve over. */
  private readonly pressurePasses: THREE.ShaderMaterial[] = [];
  private readonly gradientMat: THREE.ShaderMaterial;
  private readonly advectMat: THREE.ShaderMaterial;
  private readonly scaleMat: THREE.ShaderMaterial;
  private readonly shiftMat: THREE.ShaderMaterial;
  private cpuWindow = { minX: WINDOW.minX, minZ: WINDOW.minZ, size: WINDOW.size };
  private readonly clock = new WindClock();
  private steppedSinceReadback = false;

  constructor(renderer: THREE.WebGLRenderer, { res = 256, iterations = 24 }: WindOptions = {}) {
    this.res = res;
    this.gpu = new GpuRunner(renderer);
    this.state = new PingPong(res, res, THREE.HalfFloatType, THREE.LinearFilter, 3);
    this.vel = new PingPong(res, res);
    this.pressure = new PingPong(res, res, THREE.HalfFloatType, THREE.NearestFilter);
    this.divergence = simTarget(res, res, THREE.HalfFloatType, THREE.NearestFilter);
    this.readTarget = simTarget(READ_RES, READ_RES, THREE.FloatType, THREE.NearestFilter);
    this.readback = new Readback(renderer, 'wind', READ_RES, READ_RES, (data, window) => {
      this.cpu.set(data);
      this.cpuWindow = window;
    });

    const texel = { value: new THREE.Vector2(1 / res, 1 / res) };
    const domain = atmo.uniforms.uDomain;
    const dt = { value: STEP };

    this.forceMat = simMaterial(FORCE_FRAG, {
      uVel: { value: null },
      uDt: dt,
      uTime: { value: 0 },
      uDomain: domain,
      uBreeze: { value: this.breeze },
      uRelax: { value: tuning.wind.relax },
      uAmbient: { value: 1 },
      uSplatCount: { value: 0 },
      uSplatSeg: { value: Array.from({ length: MAX_SPLATS }, () => new THREE.Vector4()) },
      uSplatVel: { value: Array.from({ length: MAX_SPLATS }, () => new THREE.Vector4()) },
      uSplatMix: { value: Array.from({ length: MAX_SPLATS }, () => new THREE.Vector4()) },
    });
    this.vorticityMat = simMaterial(CURL_VORTICITY_FRAG, {
      uVel: { value: null },
      uStrength: { value: tuning.wind.swirliness },
      uDt: dt,
    });
    this.divergenceMat = simMaterial(DIVERGENCE_FRAG, { uVel: { value: null }, uTexel: texel });
    if (iterations % 2) throw new Error('The pressure relaxes in pairs: give an even number of iterations');
    for (let done = 0; done < iterations / 2; done += PAIRS_PER_PASS) {
      this.pressurePasses.push(simMaterial(pressureFrag(Math.min(PAIRS_PER_PASS, iterations / 2 - done), done === 0), {
        uPressure: { value: null },
        uDivergence: { value: this.divergence.texture },
        uScale: { value: 0.8 },
        uZero: { value: 0 },
      }));
    }
    this.gradientMat = simMaterial(GRADIENT_FRAG, { uPressure: { value: null }, uVel: { value: null }, uTexel: texel });
    this.advectMat = simMaterial(ADVECT_FRAG, {
      uVel: { value: null },
      uBend: { value: null },
      uSway: { value: null },
      uDt: dt,
      uDomain: domain,
      uVelDissipation: { value: tuning.wind.dissipation },
      uEnergyDecay: { value: tuning.wind.energyDecay },
      uLiftDecay: { value: tuning.wind.liftDecay },
      uBendStiffness: { value: tuning.wind.grassStiffness },
      uBendDamping: { value: tuning.wind.grassDamping },
      uSwayStiffness: { value: tuning.wind.swayStiffness },
      uSwayDamping: { value: tuning.wind.swayDamping },
      uCalm: { value: 0 },
    });
    this.scaleMat = simMaterial(SCALE_FRAG, { uSrc: { value: null }, uScale: { value: 1 } });
    this.shiftMat = simMaterial(SHIFT_FRAG, {
      uVel: { value: null },
      uBend: { value: null },
      uSway: { value: null },
      uOffset: { value: new THREE.Vector2() },
      uOutside: { value: new THREE.Vector4() },
    });
    onWindowMove((dx, dz) => this.shift(dx, dz));

    for (const rt of [this.state.read, this.state.write, this.vel.read, this.vel.write, this.pressure.read, this.pressure.write]) {
      this.gpu.clear(rt);
    }
  }

  get texture(): THREE.Texture {
    return this.state.read.textures[0];
  }

  get bendTexture(): THREE.Texture {
    return this.state.read.textures[1];
  }

  get swayTexture(): THREE.Texture {
    return this.state.read.textures[2];
  }

  /** How hard air with no gust in it can be felt: it goes with the prevailing breeze, and dead air is dead. */
  get calm(): number {
    return tuning.wind.calm * this.breeze.length();
  }

  addSplat(splat: Splat): void {
    this.splats.push(splat);
  }

  /** A fixed simulation clock, independent of display refresh and the graphics preset. */
  step(dt: number, time: number, requestReadback = true): void {
    const steps = this.clock.advance(dt, time, this.splats, this.runTick);
    this.splats.length = 0;
    this.steppedSinceReadback ||= steps > 0;
    if (requestReadback && this.steppedSinceReadback) {
      this.readBack();
      this.steppedSinceReadback = false;
    }
  }

  private substep(time: number, inputs: TimedSplat[]): void {
    const fu = this.forceMat.uniforms;
    fu.uTime.value = time;
    // Eight uniforms per pass, not eight accepted strokes. Busy scenes with more sources
    // may need another force pass; pressure, advection and springs still run only once per tick.
    for (let offset = 0; offset < Math.max(1, inputs.length); offset += MAX_SPLATS) {
      fu.uVel.value = offset === 0 ? this.texture : this.vel.texture;
      fu.uAmbient.value = offset === 0 ? 1 : 0;
      const count = Math.min(MAX_SPLATS, inputs.length - offset);
      fu.uSplatCount.value = count;
      for (let i = 0; i < count; i++) {
        const { splat: s, weight } = inputs[offset + i];
        fu.uSplatSeg.value[i].set(s.ax, s.az, s.bx, s.bz);
        fu.uSplatVel.value[i].set(s.vx, s.vz, s.radius, s.lift);
        fu.uSplatMix.value[i].set(s.energy, s.swirl, weight, 0);
      }
      this.gpu.run(this.forceMat, this.vel.write);
      this.vel.swap();
    }

    this.vorticityMat.uniforms.uVel.value = this.vel.texture;
    this.gpu.run(this.vorticityMat, this.vel.write);
    this.vel.swap();

    this.divergenceMat.uniforms.uVel.value = this.vel.texture;
    this.gpu.run(this.divergenceMat, this.divergence);

    for (const pass of this.pressurePasses) {
      pass.uniforms.uPressure.value = this.pressure.texture;
      this.gpu.run(pass, this.pressure.write);
      this.pressure.swap();
    }

    this.gradientMat.uniforms.uPressure.value = this.pressure.texture;
    this.gradientMat.uniforms.uVel.value = this.vel.texture;
    this.gpu.run(this.gradientMat, this.vel.write);
    this.vel.swap();

    const au = this.advectMat.uniforms;
    au.uVel.value = this.vel.texture;
    au.uBend.value = this.bendTexture;
    au.uSway.value = this.swayTexture;
    au.uCalm.value = this.calm;
    this.gpu.run(this.advectMat, this.state.write);
    this.state.swap();
  }

  /** Keeps the air where it is in the world when the window moves by (dx, dz) world units. */
  private shift(dx: number, dz: number): void {
    const su = this.shiftMat.uniforms;
    su.uOffset.value.set(dx / WINDOW.size, dz / WINDOW.size);
    su.uOutside.value.set(this.breeze.x, this.breeze.y, 0, 0);
    su.uVel.value = this.texture;
    su.uBend.value = this.bendTexture;
    su.uSway.value = this.swayTexture;
    this.gpu.run(this.shiftMat, this.state.write);
    this.state.swap();
    this.gpu.clear(this.pressure.read);
    // The shaders still hold this frame's unshifted textures, which they would read against the moved window.
    const u = atmo.uniforms;
    u.uWindTex.value = this.texture;
    u.uBendTex.value = this.bendTexture;
    u.uSwayTex.value = this.swayTexture;
  }

  private readBack(): void {
    if (!this.readback.ready) return;
    this.scaleMat.uniforms.uSrc.value = this.texture;
    this.scaleMat.uniforms.uScale.value = 1;
    this.gpu.run(this.scaleMat, this.readTarget);
    this.readback.request(this.readTarget, { minX: WINDOW.minX, minZ: WINDOW.minZ, size: WINDOW.size });
  }

  /** Wind at a world position, bilinear over the CPU copy (one or two frames behind the GPU). */
  sample(x: number, z: number, out: WindSample): WindSample {
    const w = this.cpuWindow;
    const fx = ((x - w.minX) / w.size) * READ_RES - 0.5;
    const fz = ((z - w.minZ) / w.size) * READ_RES - 0.5;
    const x0 = Math.max(0, Math.min(READ_RES - 2, Math.floor(fx)));
    const z0 = Math.max(0, Math.min(READ_RES - 2, Math.floor(fz)));
    const tx = Math.max(0, Math.min(1, fx - x0));
    const tz = Math.max(0, Math.min(1, fz - z0));
    const c = this.cpu;
    const i00 = (z0 * READ_RES + x0) * 4;
    const i10 = i00 + 4;
    const i01 = i00 + READ_RES * 4;
    const i11 = i01 + 4;
    const w00 = (1 - tx) * (1 - tz);
    const w10 = tx * (1 - tz);
    const w01 = (1 - tx) * tz;
    const w11 = tx * tz;
    out.x = c[i00] * w00 + c[i10] * w10 + c[i01] * w01 + c[i11] * w11;
    out.z = c[i00 + 1] * w00 + c[i10 + 1] * w10 + c[i01 + 1] * w01 + c[i11 + 1] * w11;
    out.energy = c[i00 + 2] * w00 + c[i10 + 2] * w10 + c[i01 + 2] * w01 + c[i11 + 2] * w11;
    out.lift = c[i00 + 3] * w00 + c[i10 + 3] * w10 + c[i01 + 3] * w01 + c[i11 + 3] * w11;
    return out;
  }
}
