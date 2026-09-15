import * as THREE from 'three';
import { GpuRunner, PingPong, simMaterial, simTarget } from '../gl/gpu';
import { DOMAIN } from '../world/island';
import {
  ADVECT_FRAG,
  BEND_FRAG,
  CURL_FRAG,
  DIVERGENCE_FRAG,
  FORCE_FRAG,
  GRADIENT_FRAG,
  MAX_SPLATS,
  PRESSURE_FRAG,
  SCALE_FRAG,
  VORTICITY_FRAG,
} from './shaders';

/** A push of air along a segment, in world units. See docs/contracts/wind.md. */
export interface Splat {
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

const READ_RES = 128;
const PRESSURE_ITERATIONS = 24;
const STEP = 1 / 60;

export class WindField {
  readonly res: number;
  readonly breeze = new THREE.Vector2();
  private readonly gpu: GpuRunner;
  private readonly vel: PingPong;
  private readonly bend: PingPong;
  private readonly pressure: PingPong;
  private readonly curl: THREE.WebGLRenderTarget;
  private readonly divergence: THREE.WebGLRenderTarget;
  private readonly readTarget: THREE.WebGLRenderTarget;
  private readonly cpu = new Float32Array(READ_RES * READ_RES * 4);
  private readonly readBuffer = new Float32Array(READ_RES * READ_RES * 4);
  private reading = false;
  private splats: Splat[] = [];

  private readonly forceMat: THREE.ShaderMaterial;
  private readonly curlMat: THREE.ShaderMaterial;
  private readonly vorticityMat: THREE.ShaderMaterial;
  private readonly divergenceMat: THREE.ShaderMaterial;
  private readonly pressureMat: THREE.ShaderMaterial;
  private readonly gradientMat: THREE.ShaderMaterial;
  private readonly advectMat: THREE.ShaderMaterial;
  private readonly bendMat: THREE.ShaderMaterial;
  private readonly scaleMat: THREE.ShaderMaterial;

  constructor(private readonly renderer: THREE.WebGLRenderer, res = 256) {
    this.res = res;
    this.gpu = new GpuRunner(renderer);
    this.vel = new PingPong(res, res);
    this.bend = new PingPong(res, res);
    this.pressure = new PingPong(res, res, THREE.HalfFloatType, THREE.NearestFilter);
    this.curl = simTarget(res, res, THREE.HalfFloatType, THREE.NearestFilter);
    this.divergence = simTarget(res, res, THREE.HalfFloatType, THREE.NearestFilter);
    this.readTarget = simTarget(READ_RES, READ_RES, THREE.FloatType, THREE.NearestFilter);

    const texel = { value: new THREE.Vector2(1 / res, 1 / res) };
    const domain = { value: new THREE.Vector4(DOMAIN.min, DOMAIN.min, 1 / DOMAIN.size, 1 / DOMAIN.size) };
    const dt = { value: STEP };

    this.forceMat = simMaterial(FORCE_FRAG, {
      uVel: { value: null },
      uDt: dt,
      uTime: { value: 0 },
      uDomain: domain,
      uBreeze: { value: this.breeze },
      uRelax: { value: 0.32 },
      uSplatCount: { value: 0 },
      uSplatSeg: { value: Array.from({ length: MAX_SPLATS }, () => new THREE.Vector4()) },
      uSplatVel: { value: Array.from({ length: MAX_SPLATS }, () => new THREE.Vector4()) },
      uSplatMix: { value: Array.from({ length: MAX_SPLATS }, () => new THREE.Vector4()) },
    });
    this.curlMat = simMaterial(CURL_FRAG, { uVel: { value: null }, uTexel: texel });
    this.vorticityMat = simMaterial(VORTICITY_FRAG, {
      uVel: { value: null },
      uCurl: { value: this.curl.texture },
      uStrength: { value: 9 },
      uDt: dt,
      uTexel: texel,
    });
    this.divergenceMat = simMaterial(DIVERGENCE_FRAG, { uVel: { value: null }, uTexel: texel });
    this.pressureMat = simMaterial(PRESSURE_FRAG, {
      uPressure: { value: null },
      uDivergence: { value: this.divergence.texture },
      uTexel: texel,
    });
    this.gradientMat = simMaterial(GRADIENT_FRAG, { uPressure: { value: null }, uVel: { value: null }, uTexel: texel });
    this.advectMat = simMaterial(ADVECT_FRAG, {
      uVel: { value: null },
      uDt: dt,
      uDomain: domain,
      uVelDissipation: { value: 0.12 },
      uEnergyDecay: { value: 1.1 },
      uLiftDecay: { value: 0.8 },
    });
    this.bendMat = simMaterial(BEND_FRAG, {
      uBend: { value: null },
      uVel: { value: null },
      uDt: dt,
      uStiffness: { value: 38 },
      uDamping: { value: 3.2 },
    });
    this.scaleMat = simMaterial(SCALE_FRAG, { uSrc: { value: null }, uScale: { value: 1 } });

    for (const rt of [this.vel.read, this.vel.write, this.bend.read, this.bend.write, this.pressure.read, this.pressure.write]) {
      this.gpu.clear(rt);
    }
  }

  get texture(): THREE.Texture {
    return this.vel.texture;
  }

  get bendTexture(): THREE.Texture {
    return this.bend.texture;
  }

  addSplat(splat: Splat): void {
    if (this.splats.length < MAX_SPLATS) this.splats.push(splat);
  }

  step(dt: number, time: number): void {
    const steps = Math.min(3, Math.max(1, Math.round(dt / STEP)));
    for (let i = 0; i < steps; i++) this.substep(time - (steps - 1 - i) * STEP, i === 0);
    this.splats.length = 0;
    this.readBack();
  }

  private substep(time: number, withSplats: boolean): void {
    const fu = this.forceMat.uniforms;
    fu.uTime.value = time;
    fu.uVel.value = this.vel.texture;
    const splats = withSplats ? this.splats : [];
    fu.uSplatCount.value = splats.length;
    splats.forEach((s, i) => {
      fu.uSplatSeg.value[i].set(s.ax, s.az, s.bx, s.bz);
      fu.uSplatVel.value[i].set(s.vx, s.vz, s.radius, s.lift);
      fu.uSplatMix.value[i].set(s.energy, s.swirl, 0, 0);
    });
    this.gpu.run(this.forceMat, this.vel.write);
    this.vel.swap();

    this.curlMat.uniforms.uVel.value = this.vel.texture;
    this.gpu.run(this.curlMat, this.curl);

    this.vorticityMat.uniforms.uVel.value = this.vel.texture;
    this.gpu.run(this.vorticityMat, this.vel.write);
    this.vel.swap();

    this.divergenceMat.uniforms.uVel.value = this.vel.texture;
    this.gpu.run(this.divergenceMat, this.divergence);

    this.scaleMat.uniforms.uSrc.value = this.pressure.texture;
    this.scaleMat.uniforms.uScale.value = 0.8;
    this.gpu.run(this.scaleMat, this.pressure.write);
    this.pressure.swap();
    for (let i = 0; i < PRESSURE_ITERATIONS; i++) {
      this.pressureMat.uniforms.uPressure.value = this.pressure.texture;
      this.gpu.run(this.pressureMat, this.pressure.write);
      this.pressure.swap();
    }

    this.gradientMat.uniforms.uPressure.value = this.pressure.texture;
    this.gradientMat.uniforms.uVel.value = this.vel.texture;
    this.gpu.run(this.gradientMat, this.vel.write);
    this.vel.swap();

    this.advectMat.uniforms.uVel.value = this.vel.texture;
    this.gpu.run(this.advectMat, this.vel.write);
    this.vel.swap();

    this.bendMat.uniforms.uBend.value = this.bend.texture;
    this.bendMat.uniforms.uVel.value = this.vel.texture;
    this.gpu.run(this.bendMat, this.bend.write);
    this.bend.swap();
  }

  private readBack(): void {
    if (this.reading) return;
    this.scaleMat.uniforms.uSrc.value = this.vel.texture;
    this.scaleMat.uniforms.uScale.value = 1;
    this.gpu.run(this.scaleMat, this.readTarget);
    this.reading = true;
    this.renderer
      .readRenderTargetPixelsAsync(this.readTarget, 0, 0, READ_RES, READ_RES, this.readBuffer)
      .then(() => this.cpu.set(this.readBuffer))
      .catch(() => {})
      .finally(() => {
        this.reading = false;
      });
  }

  /** Wind at a world position, bilinear over the CPU copy (one or two frames behind the GPU). */
  sample(x: number, z: number, out: WindSample): WindSample {
    const fx = ((x - DOMAIN.min) / DOMAIN.size) * READ_RES - 0.5;
    const fz = ((z - DOMAIN.min) / DOMAIN.size) * READ_RES - 0.5;
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
