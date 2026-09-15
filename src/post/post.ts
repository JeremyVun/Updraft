import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { params } from '../params';

const GRADE = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uExposure: { value: 1.0 },
    uResolution: { value: new THREE.Vector2(1, 1) },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uExposure;
    uniform vec2 uResolution;
    varying vec2 vUv;

    vec3 aces(vec3 x) {
      const float a = 2.51, b = 0.03, c = 2.43, d = 0.59, e = 0.14;
      return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
    }
    float hash(vec2 p) {
      vec3 p3 = fract(vec3(p.xyx) * 0.1031);
      p3 += dot(p3, p3.yzx + 33.33);
      return fract((p3.x + p3.y) * p3.z);
    }
    vec3 toSRGB(vec3 c) {
      return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
    }

    void main() {
      vec2 fromCentre = vUv - 0.5;
      float r2 = dot(fromCentre, fromCentre);
      vec2 shift = fromCentre * r2 * 0.006;
      vec3 hdr;
      hdr.r = texture2D(tDiffuse, vUv + shift).r;
      hdr.g = texture2D(tDiffuse, vUv).g;
      hdr.b = texture2D(tDiffuse, vUv - shift).b;
      hdr *= uExposure;

      float lum = dot(hdr, vec3(0.2126, 0.7152, 0.0722));
      vec3 shadowTint = vec3(0.92, 1.0, 1.1);
      vec3 highTint = vec3(1.06, 1.0, 0.9);
      float k = smoothstep(0.02, 0.9, lum);
      hdr *= mix(shadowTint, highTint, k);
      hdr = mix(vec3(lum), hdr, 1.1);

      vec3 col = aces(hdr);
      col *= 1.0 - smoothstep(0.18, 0.75, r2) * 0.4;
      col = toSRGB(col);
      float n = hash(vUv * uResolution + fract(uTime * 7.13) * 100.0) - 0.5;
      col += n * 0.028;
      gl_FragColor = vec4(col, 1.0);
    }`,
};

/** One bad pixel (NaN or a huge highlight) would otherwise be smeared across the screen by bloom. */
const SANITIZE = {
  uniforms: { tDiffuse: { value: null } },
  vertexShader: GRADE.vertexShader,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    varying vec2 vUv;
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      bool bad = any(isnan(c)) || any(isinf(c));
      gl_FragColor = bad ? vec4(0.0, 0.0, 0.0, 1.0) : min(c, vec4(40.0));
    }`,
};

export class Post {
  readonly composer: EffectComposer;
  private readonly grade: ShaderPass;
  private readonly bloom: UnrealBloomPass;

  constructor(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, pixelRatio: number) {
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    const samples = params.msaa ?? (pixelRatio >= 1.75 ? 2 : 4);
    const target = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples });
    this.composer = new EffectComposer(renderer, target);
    this.composer.addPass(new RenderPass(scene, camera));
    this.composer.addPass(new ShaderPass(SANITIZE));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.28, 0.45, 1.1);
    this.composer.addPass(this.bloom);
    this.grade = new ShaderPass(GRADE);
    this.composer.addPass(this.grade);
  }

  setSize(width: number, height: number, pixelRatio: number): void {
    this.composer.setPixelRatio(pixelRatio);
    this.composer.setSize(width, height);
    this.grade.uniforms.uResolution.value.set(width * pixelRatio, height * pixelRatio);
  }

  render(time: number): void {
    this.grade.uniforms.uTime.value = time;
    this.composer.render();
  }
}
