import * as THREE from 'three';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import type { BloomLevel } from '../gl/quality';

const BLOOM_STRENGTH = 0.28;
/** Bloom fades in and out over the second the grass takes to change with the level. */
const BLOOM_FADE = 1;

const QUAD_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

const GRADE_FRAG = /* glsl */ `
uniform sampler2D tDiffuse;
uniform float uTime;
uniform float uExposure;
uniform float uSaturation;
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
  hdr = mix(vec3(lum) * mix(vec3(0.96, 0.98, 1.03), vec3(1.0), uSaturation), hdr, 1.1 * uSaturation);

  vec3 col = aces(hdr);
  col *= 1.0 - smoothstep(0.18, 0.75, r2) * 0.4;
  col = toSRGB(col);
  float n = hash(vUv * uResolution + fract(uTime * 7.13) * 100.0) - 0.5;
  col += n * 0.028;
  gl_FragColor = vec4(col, 1.0);
}`;

/** Resolves the scene and clamps it: one bad pixel (NaN or a huge highlight) would otherwise be smeared across the screen by bloom. */
const RESOLVE_FRAG = /* glsl */ `
uniform sampler2D tDiffuse;
varying vec2 vUv;
void main() {
  vec4 c = texture2D(tDiffuse, vUv);
  bool bad = any(isnan(c)) || any(isinf(c));
  gl_FragColor = bad ? vec4(0.0, 0.0, 0.0, 1.0) : min(c, vec4(40.0));
}`;

function quadMaterial(fragmentShader: string, uniforms: Record<string, THREE.IUniform>): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({ vertexShader: QUAD_VERT, fragmentShader, uniforms, depthTest: false, depthWrite: false });
}

/**
 * The frame's image chain: the scene into one multisampled half-float target, one resolve-and-clamp pass into
 * a plain target, bloom added there, and the grade straight to the screen. Only the scene target is multisampled.
 */
export class Post {
  /** Where the scene is drawn; also the target to precompile scene materials against. */
  readonly sceneTarget: THREE.WebGLRenderTarget;
  private readonly clean: THREE.WebGLRenderTarget;
  private readonly bloom: UnrealBloomPass;
  private readonly quad = new FullScreenQuad();
  private readonly resolveMat: THREE.ShaderMaterial;
  private readonly gradeMat: THREE.ShaderMaterial;
  private readonly size = new THREE.Vector2();
  private bloomLevel: BloomLevel = 'full';
  /** How much of the bloom is drawn, easing toward 0 while it is off and 1 while it is on. */
  private bloomShown = 1;
  private bloomReleased = false;
  private lastTime = NaN;

  constructor(
    private readonly renderer: THREE.WebGLRenderer,
    private readonly scene: THREE.Scene,
    private readonly camera: THREE.Camera,
    samples: number,
  ) {
    const size = renderer.getDrawingBufferSize(this.size);
    this.sceneTarget = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples, depthBuffer: true, stencilBuffer: true });
    this.clean = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, depthBuffer: false });
    this.bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), BLOOM_STRENGTH, 0.45, 1.1);
    this.resolveMat = quadMaterial(RESOLVE_FRAG, { tDiffuse: { value: this.sceneTarget.texture } });
    this.gradeMat = quadMaterial(GRADE_FRAG, {
      tDiffuse: { value: this.clean.texture },
      uTime: { value: 0 },
      uExposure: { value: 1.0 },
      uSaturation: { value: 1.0 },
      uResolution: { value: new THREE.Vector2(size.x, size.y) },
    });
  }

  get samples(): number {
    return this.sceneTarget.samples;
  }

  /** Changes the scene target's multisampling; it is rebuilt on the next frame. */
  set samples(value: number) {
    if (value === this.sceneTarget.samples) return;
    this.sceneTarget.samples = value;
    this.sceneTarget.dispose();
  }

  setSize(width: number, height: number, pixelRatio: number): void {
    const w = Math.round(width * pixelRatio);
    const h = Math.round(height * pixelRatio);
    this.size.set(w, h);
    this.sceneTarget.setSize(w, h);
    this.clean.setSize(w, h);
    this.sizeBloom();
    this.gradeMat.uniforms.uResolution.value.set(w, h);
  }

  /** The bloom's resolution while it is drawn: the frame's, or half of it on half. */
  get bloomScale(): number {
    return this.bloomLevel === 'half' ? 0.5 : 1;
  }

  /** Full, half resolution, or off: its passes skipped and its targets released once it has faded out. */
  setBloom(level: BloomLevel, immediate = false): void {
    this.bloomLevel = level;
    if (immediate) this.bloomShown = level === 'off' ? 0 : 1;
    this.sizeBloom();
  }

  private sizeBloom(): void {
    // A fading bloom keeps the resolution it is fading from.
    if (this.bloomLevel === 'off') return;
    this.bloom.setSize(Math.round(this.size.x * this.bloomScale), Math.round(this.size.y * this.bloomScale));
  }

  private releaseBloom(): void {
    const b = this.bloom;
    for (const target of [b.renderTargetBright, ...b.renderTargetsHorizontal, ...b.renderTargetsVertical]) target.dispose();
    this.bloomReleased = true;
  }

  /** 0 is the grey still world, 1 full colour. */
  set saturation(value: number) {
    this.gradeMat.uniforms.uSaturation.value = value;
  }

  /** `warm` draws the bloom even while it is off, so its programs are built before Begin whatever the level. */
  render(time: number, warm = false): void {
    const r = this.renderer;
    const dt = Math.min(Math.max(time - this.lastTime, 0), 0.1) || 0;
    this.lastTime = time;
    const target = this.bloomLevel === 'off' ? 0 : 1;
    this.bloomShown = target > this.bloomShown ? Math.min(target, this.bloomShown + dt / BLOOM_FADE) : Math.max(target, this.bloomShown - dt / BLOOM_FADE);
    r.setRenderTarget(this.sceneTarget);
    r.render(this.scene, this.camera);

    this.quad.material = this.resolveMat;
    r.setRenderTarget(this.clean);
    this.quad.render(r);

    if (this.bloomShown > 0 || warm) {
      this.bloom.strength = BLOOM_STRENGTH * this.bloomShown;
      this.bloom.render(r, this.clean, this.clean, 0, false);
      this.bloomReleased = false;
    }
    if (this.bloomShown === 0 && !this.bloomReleased) this.releaseBloom();

    this.gradeMat.uniforms.uTime.value = time;
    this.quad.material = this.gradeMat;
    r.setRenderTarget(null);
    this.quad.render(r);
  }
}
