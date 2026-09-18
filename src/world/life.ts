import * as THREE from 'three';
import { GpuRunner, PingPong, simMaterial, simTarget } from '../gl/gpu';
import { Readback } from '../gl/readback';
import { LIVING_BEYOND, atmo } from './atmosphere';
import { ISLES } from './heightfield';
import { WINDOW, onWindowMove } from './window';

const RES = 256;
const READ_RES = 64;

/**
 * Life comes back where the wind flows: gust energy and updrafts raise it, living ground fills itself in and
 * creeps outward, and it never falls.
 */
const LIFE_FRAG = /* glsl */ `
uniform sampler2D uLife;
uniform sampler2D uWindTex;
uniform sampler2D uHeightTex;
uniform float uDt;
uniform vec2 uTexel;
uniform vec4 uDomain;
uniform vec4 uWaiting;
in vec2 vUv;
void main() {
  float l = texture(uLife, vUv).r;
  vec4 w = texture(uWindTex, vUv);
  float land = smoothstep(-0.4, 0.4, texture(uHeightTex, vUv).r);
  /** The island that waits does not answer the wind at all: only the piano wakes it, and it wakes all of a piece. */
  vec2 world = uDomain.xy + vUv / uDomain.zw;
  if (uWaiting.z > 0.0 && length((world - uWaiting.xy) / uWaiting.zw) < 1.0) land = 0.0;
  float n = 0.25 * (texture(uLife, vUv + vec2(uTexel.x, 0.0)).r + texture(uLife, vUv - vec2(uTexel.x, 0.0)).r
                  + texture(uLife, vUv + vec2(0.0, uTexel.y)).r + texture(uLife, vUv - vec2(0.0, uTexel.y)).r);
  float wake = (w.z * 1.1 + w.w * 0.7) * land;
  float grow = l > 0.22 ? 0.06 * l : 0.0;
  float spread = max(n - l, 0.0) * 0.4;
  gl_FragColor = vec4(clamp(l + uDt * (wake + grow + spread), 0.0, 1.0), 0.0, 0.0, 1.0);
}`;

const SHIFT_FRAG = /* glsl */ `
uniform sampler2D uSrc;
uniform vec2 uOffset;
in vec2 vUv;
void main() {
  vec2 uv = vUv + uOffset;
  bool inside = all(greaterThanEqual(uv, vec2(0.0))) && all(lessThanEqual(uv, vec2(1.0)));
  gl_FragColor = inside ? texture(uSrc, uv) : vec4(0.0, 0.0, 0.0, 1.0);
}`;

const COPY_FRAG = /* glsl */ `
uniform sampler2D uSrc;
in vec2 vUv;
void main() { gl_FragColor = texture(uSrc, vUv); }`;

/** Regions the story has brought fully back to life, which stay alive when the window moves away. */
export interface LifeRegions {
  /** Centre (x, z) and radius of the still island, and how much of it counts as restored, 0..1. */
  island: THREE.Vector4;
  /** Origin (x, z), current radius and softness of the green wave rolling over the mainland. */
  wave: THREE.Vector4;
  /** The one island held back from the living world until its wave rolls: centre (x, z) and radii. */
  waiting: THREE.Vector4;
}

export class LifeField {
  readonly regions: LifeRegions = {
    island: new THREE.Vector4(-6, -14, 78, 0),
    wave: new THREE.Vector4(0, -700, -1, 90),
    waiting: atmo.uniforms.uWaiting.value,
  };
  private readonly gpu: GpuRunner;
  private readonly life = new PingPong(RES, RES, THREE.HalfFloatType, THREE.LinearFilter);
  private readonly readTarget = simTarget(READ_RES, READ_RES, THREE.FloatType, THREE.NearestFilter);
  private readonly lifeMat: THREE.ShaderMaterial;
  private readonly shiftMat: THREE.ShaderMaterial;
  private readonly copyMat: THREE.ShaderMaterial;
  private readonly readback: Readback<{ minX: number; minZ: number; size: number }>;
  private readonly cpu = new Float32Array(READ_RES * READ_RES * 4);
  private cpuWindow = { minX: WINDOW.minX, minZ: WINDOW.minZ, size: WINDOW.size };
  private sinceRead = 0;

  constructor(renderer: THREE.WebGLRenderer) {
    this.gpu = new GpuRunner(renderer);
    this.readback = new Readback(renderer, READ_RES, READ_RES, (data, window) => {
      this.cpu.set(data);
      this.cpuWindow = window;
    }, 2);
    this.lifeMat = simMaterial(LIFE_FRAG, {
      uLife: { value: null },
      uWindTex: atmo.uniforms.uWindTex,
      uHeightTex: atmo.uniforms.uHeightTex,
      uDt: { value: 1 / 60 },
      uTexel: { value: new THREE.Vector2(1 / RES, 1 / RES) },
      uDomain: atmo.uniforms.uDomain,
      uWaiting: atmo.uniforms.uWaiting,
    });
    this.shiftMat = simMaterial(SHIFT_FRAG, { uSrc: { value: null }, uOffset: { value: new THREE.Vector2() } });
    this.copyMat = simMaterial(COPY_FRAG, { uSrc: { value: null } });
    this.gpu.clear(this.life.read);
    this.gpu.clear(this.life.write);
    atmo.uniforms.uLifeTex.value = this.life.texture;
    atmo.uniforms.uIslandLife.value = this.regions.island;
    atmo.uniforms.uLifeWave.value = this.regions.wave;
    /**
     * The meadow is the one island that waits, and it waits all over: a green shore around a grey interior read as
     * a bug, and gave away from the boat what the climb up the bank is meant to keep. Its own colour comes back
     * from the piano, in one patch and then in waves.
     */
    this.regions.waiting.set(ISLES.meadow.x, ISLES.meadow.z, ISLES.meadow.rx + 6, ISLES.meadow.rz + 6);
    onWindowMove((dx, dz) => {
      this.shiftMat.uniforms.uSrc.value = this.life.texture;
      this.shiftMat.uniforms.uOffset.value.set(dx / WINDOW.size, dz / WINDOW.size);
      this.gpu.run(this.shiftMat, this.life.write);
      this.life.swap();
      atmo.uniforms.uLifeTex.value = this.life.texture;
    });
  }

  update(dt: number): void {
    this.lifeMat.uniforms.uDt.value = dt;
    this.lifeMat.uniforms.uLife.value = this.life.texture;
    this.gpu.run(this.lifeMat, this.life.write);
    this.life.swap();
    atmo.uniforms.uLifeTex.value = this.life.texture;

    this.sinceRead += dt;
    if (this.sinceRead < 0.25 || !this.readback.ready) return;
    this.sinceRead = 0;
    this.copyMat.uniforms.uSrc.value = this.life.texture;
    this.gpu.run(this.copyMat, this.readTarget);
    this.readback.request(this.readTarget, { minX: WINDOW.minX, minZ: WINDOW.minZ, size: WINDOW.size });
  }

  /** Life at a world position as the shaders see it (one or two readbacks behind). */
  at(x: number, z: number): number {
    const w = this.cpuWindow;
    const i = Math.floor(((x - w.minX) / w.size) * READ_RES);
    const j = Math.floor(((z - w.minZ) / w.size) * READ_RES);
    const local = i >= 0 && j >= 0 && i < READ_RES && j < READ_RES ? this.cpu[(j * READ_RES + i) * 4] : 0;
    return Math.max(local, this.regionLife(x, z));
  }

  /** Mean life over the samples for which `include` is true (e.g. the island's land). */
  mean(include: (x: number, z: number) => boolean): number {
    const w = this.cpuWindow;
    let sum = 0;
    let n = 0;
    for (let j = 0; j < READ_RES; j++) {
      for (let i = 0; i < READ_RES; i++) {
        const x = w.minX + ((i + 0.5) / READ_RES) * w.size;
        const z = w.minZ + ((j + 0.5) / READ_RES) * w.size;
        if (!include(x, z)) continue;
        sum += Math.max(this.cpu[(j * READ_RES + i) * 4], this.regionLife(x, z));
        n++;
      }
    }
    return n ? sum / n : 0;
  }

  /** Mirrors `regionLife` in `ATMO_GLSL`; keep the two in step. */
  private regionLife(x: number, z: number): number {
    const is = this.regions.island;
    const island = Math.hypot(x - is.x, z - is.y) < is.z ? is.w : 0;
    const wt = this.regions.waiting;
    const held = wt.z > 0 && Math.hypot((x - wt.x) / wt.z, (z - wt.y) / wt.w) < 1;
    const ahead = z < LIVING_BEYOND && !held ? 1 : 0;
    const wv = this.regions.wave;
    const d = Math.hypot(x - wv.x, z - wv.y);
    const wave = wv.z < 0 ? 0 : Math.min(1, Math.max(0, (wv.z - d) / wv.w));
    return Math.max(Math.max(island, ahead), wave);
  }
}
