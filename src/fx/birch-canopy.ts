import * as THREE from 'three';
import { GpuRunner, PingPong, simMaterial } from '../gl/gpu';
import { ATMO_GLSL } from '../world/atmosphere';
import { glsl, tuning } from '../tuning';

/** The canopy's shedding cards keep their own position, velocity and time since release. */
export class BirchCanopyMotion {
  readonly uniform: THREE.IUniform;
  private readonly pos: PingPong;
  private readonly vel: PingPong;
  private readonly gpu: GpuRunner;
  private readonly velocity: THREE.ShaderMaterial;
  private readonly position: THREE.ShaderMaterial;

  constructor(renderer: THREE.WebGLRenderer, width: number, height: number, leaves: Float32Array,
    trees: string, uniforms: Record<string, THREE.IUniform>) {
    this.gpu = new GpuRunner(renderer);
    this.pos = new PingPong(width, height, THREE.FloatType, THREE.NearestFilter);
    this.vel = new PingPong(width, height, THREE.FloatType, THREE.NearestFilter);
    this.gpu.clear(this.pos.read);
    this.gpu.clear(this.vel.read);
    this.uniform = { value: this.pos.texture };
    const seed = new THREE.DataTexture(leaves, width, height, THREE.RGBAFormat, THREE.FloatType);
    seed.needsUpdate = true;
    const shared = {
      ...uniforms,
      uSeed: { value: seed },
      uPosition: this.uniform,
      uVelocity: { value: this.vel.texture },
      uDt: { value: 1 / 60 },
    };
    this.velocity = simMaterial(`
      ${ATMO_GLSL}
      uniform sampler2D uPosition;
      uniform sampler2D uVelocity;
      uniform sampler2D uSeed;
      uniform float uDt;
      in vec2 vUv;
      void main() {
        vec4 p = texture(uPosition, vUv);
        vec3 v = texture(uVelocity, vUv).xyz;
        if (p.w <= 0.0 || p.w >= ${glsl(tuning.birches.shedFlight)}) {
          gl_FragColor = vec4(0.0);
          return;
        }
        float seed = texture(uSeed, vUv).w;
        vec2 uv = domainUv(p.xz);
        vec4 wind = insideUv(uv) ? texture(uWindTex, uv) : vec4(0.0);
        // Drag changes velocity, never rewrites the distance already travelled.
        float drag = ${glsl(tuning.birches.shedDrag)} * (0.7 + seed * 0.6);
        vec3 target = vec3(wind.x * 0.55, -1.4 + min(wind.z, 1.0) * 2.2, wind.y * 0.55);
        target.xz += vec2(sin(uTime * 2.1 + seed * 41.0), cos(uTime * 1.7 + seed * 31.0)) * 0.65;
        v = mix(v, target, 1.0 - exp(-drag * uDt));
        gl_FragColor = vec4(v, 0.0);
      }`, shared);
    this.position = simMaterial(`
      ${ATMO_GLSL}
      ${trees}
      uniform sampler2D uSeed;
      uniform sampler2D uPosition;
      uniform sampler2D uVelocity;
      uniform float uDt;
      in vec2 vUv;
      void main() {
        vec4 p = texture(uPosition, vUv);
        vec4 leaf = texture(uSeed, vUv);
        rootBirch(int(gl_FragCoord.y));
        if (p.w <= 0.0) {
          p.xyz = birchPlace(leaf.xyz);
          if (birchS.z > leaf.w) p.w = uDt;
        } else if (p.w < ${glsl(tuning.birches.shedFlight)}) {
          p.xyz += texture(uVelocity, vUv).xyz * uDt;
          vec2 uv = domainUv(p.xz);
          if (insideUv(uv)) p.y = max(p.y, max(0.0, texture(uHeightTex, uv).r) + 0.05);
          p.w += uDt;
        }
        gl_FragColor = p;
      }`, shared);
  }

  update(dt: number): void {
    this.velocity.uniforms.uDt.value = Math.min(dt, 1 / 30);
    this.gpu.run(this.velocity, this.vel.write);
    this.vel.swap();
    this.velocity.uniforms.uVelocity.value = this.vel.texture;
    this.gpu.run(this.position, this.pos.write);
    this.pos.swap();
    this.uniform.value = this.pos.texture;
  }
}
