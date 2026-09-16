import * as THREE from 'three';
import { GpuRunner, PingPong, simMaterial, simTarget } from '../gl/gpu';
import { Readback } from '../gl/readback';
import { atmo } from '../world/atmosphere';
import { WINDOW, onWindowMove } from '../world/window';
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
  SHIFT_FRAG,
  VORTICITY_FRAG,
} from './shaders';

/**
 * Two Jacobi relaxations in one pass, bit for bit what two passes of PRESSURE_FRAG produce: each neighbour's
 * relaxed pressure is rebuilt from the same texels (neighbour positions clamped to the grid first, as sampling
 * clamps them) and rounded to half float as the intermediate target would have rounded it. Half the passes,
 * and each pass on a tiled GPU costs a fixed load and store on top of its pixels.
 */
const PRESSURE2_FRAG = /* glsl */ `
uniform sampler2D uPressure;
uniform sampler2D uDivergence;
uniform vec2 uTexel;
in vec2 vUv;
float relaxed(vec2 uv) {
  float L = texture(uPressure, uv - vec2(uTexel.x, 0.0)).x;
  float R = texture(uPressure, uv + vec2(uTexel.x, 0.0)).x;
  float B = texture(uPressure, uv - vec2(0.0, uTexel.y)).x;
  float T = texture(uPressure, uv + vec2(0.0, uTexel.y)).x;
  float div = texture(uDivergence, uv).x;
  float p = (L + R + B + T - div) * 0.25;
  return unpackHalf2x16(packHalf2x16(vec2(p, 0.0))).x;
}
void main() {
  vec2 lo = 0.5 * uTexel;
  vec2 hi = 1.0 - lo;
  float L = relaxed(clamp(vUv - vec2(uTexel.x, 0.0), lo, hi));
  float R = relaxed(clamp(vUv + vec2(uTexel.x, 0.0), lo, hi));
  float B = relaxed(clamp(vUv - vec2(0.0, uTexel.y), lo, hi));
  float T = relaxed(clamp(vUv + vec2(0.0, uTexel.y), lo, hi));
  float div = texture(uDivergence, vUv).x;
  gl_FragColor = vec4((L + R + B + T - div) * 0.25, 0.0, 0.0, 1.0);
}`;

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

const PROBE = new Set((new URLSearchParams(location.search).get('probe') ?? '').split(','));
const READ_RES = 128;
const STEP = 1 / 60;

export interface WindOptions {
  /** Grid resolution; 256 by default. */
  res?: number;
  /** Jacobi pressure iterations per substep; 24 by default. */
  iterations?: number;
  /** Substeps a frame may run; 2 by default. */
  maxSubsteps?: number;
}

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
  private readonly readback: Readback<{ minX: number; minZ: number; size: number }>;
  private readonly cpu = new Float32Array(READ_RES * READ_RES * 4);
  private splats: Splat[] = [];

  private readonly forceMat: THREE.ShaderMaterial;
  private readonly curlMat: THREE.ShaderMaterial;
  private readonly vorticityMat: THREE.ShaderMaterial;
  private readonly divergenceMat: THREE.ShaderMaterial;
  private readonly pressureMat: THREE.ShaderMaterial;
  private readonly pressure2Mat: THREE.ShaderMaterial;
  private readonly gradientMat: THREE.ShaderMaterial;
  private readonly advectMat: THREE.ShaderMaterial;
  private readonly bendMat: THREE.ShaderMaterial;
  private readonly scaleMat: THREE.ShaderMaterial;
  private readonly shiftMat: THREE.ShaderMaterial;
  private cpuWindow = { minX: WINDOW.minX, minZ: WINDOW.minZ, size: WINDOW.size };
  private readonly iterations: number;
  private readonly maxSubsteps: number;

  constructor(renderer: THREE.WebGLRenderer, { res = 256, iterations = 24, maxSubsteps = 2 }: WindOptions = {}) {
    this.res = res;
    this.iterations = iterations;
    this.maxSubsteps = maxSubsteps;
    this.gpu = new GpuRunner(renderer);
    this.vel = new PingPong(res, res);
    this.bend = new PingPong(res, res);
    this.pressure = new PingPong(res, res, THREE.HalfFloatType, THREE.NearestFilter);
    this.curl = simTarget(res, res, THREE.HalfFloatType, THREE.NearestFilter);
    this.divergence = simTarget(res, res, THREE.HalfFloatType, THREE.NearestFilter);
    this.readTarget = simTarget(READ_RES, READ_RES, THREE.FloatType, THREE.NearestFilter);
    this.readback = new Readback(renderer, READ_RES, READ_RES, (data, window) => {
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
    this.pressure2Mat = simMaterial(PRESSURE2_FRAG, {
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
    this.shiftMat = simMaterial(SHIFT_FRAG, {
      uSrc: { value: null },
      uOffset: { value: new THREE.Vector2() },
      uOutside: { value: new THREE.Vector4() },
    });
    onWindowMove((dx, dz) => this.shift(dx, dz));

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

  /** Runs the substeps that fit `dt`, capped: a slow frame must not multiply the sim and get slower still. */
  step(dt: number, time: number): void {
    const steps = Math.min(this.maxSubsteps, Math.max(1, Math.round(dt / STEP)));
    if (!PROBE.has('nosim')) for (let i = 0; i < steps; i++) this.substep(time - (steps - 1 - i) * STEP, i === 0);
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
    const fused = PROBE.has('jacobi1') ? 0 : Math.floor(this.iterations / 2);
    for (let i = 0; i < this.iterations - fused; i++) {
      const mat = i < fused ? this.pressure2Mat : this.pressureMat;
      mat.uniforms.uPressure.value = this.pressure.texture;
      this.gpu.run(mat, this.pressure.write);
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

  /** Keeps the air where it is in the world when the window moves by (dx, dz) world units. */
  private shift(dx: number, dz: number): void {
    const su = this.shiftMat.uniforms;
    su.uOffset.value.set(dx / WINDOW.size, dz / WINDOW.size);
    for (const [pp, outside] of [
      [this.vel, new THREE.Vector4(this.breeze.x, this.breeze.y, 0, 0)],
      [this.bend, new THREE.Vector4(0, 0, 0, 0)],
    ] as const) {
      su.uSrc.value = pp.texture;
      su.uOutside.value.copy(outside);
      this.gpu.run(this.shiftMat, pp.write);
      pp.swap();
    }
    this.gpu.clear(this.pressure.read);
  }

  private readBack(): void {
    if (!this.readback.ready) return;
    this.scaleMat.uniforms.uSrc.value = this.vel.texture;
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
