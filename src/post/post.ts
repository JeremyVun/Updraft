import * as THREE from 'three';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { passJob, type CompileJob } from '../gl/boot';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import type { BloomLevel } from '../gl/quality';
import { DEPTH_BLUR, register, select, SUN_GLOW } from '../gl/variants';

const BLOOM_STRENGTH = 0.28;
/** Bloom fades in and out over the second the grass takes to change with the level. */
const BLOOM_FADE = 1;
/** The angular radius of the sky's sun disc, halfway through its edge (`skyRadiance`). */
const SUN_RADIUS = Math.acos(0.99965);
/**
 * The glow painted round the sun while bloom is off, matched to how bloom spreads it at Ultra: each layer's spread as a
 * fraction of the frame's height, and its share of the sun's light.
 */
const GLOW_SPREAD = [0.0129, 0.0366, 0.0782, 0.17];
const GLOW_SHARE = [0.32, 0.86, 0.65, 0.57];

/**
 * The depth blur, as in the room paintings, made the way a lens makes it: blur grows with the difference in inverse
 * distance from what is in focus (the child and the cygnet), so a near subject softens the foreground and the distance
 * as a miniature does, while a wide view stays clear. `aperture` turns dioptres into blur, which the distance's
 * reaches only up to `far`, and the sky's only up to `sky`.
 */
const BLUR = { aperture: 6.5, far: 0.35, sky: 0.08 };
/**
 * The blur's taps, in quarter-size texels apart, and how many times its two passes run. Taps further apart than a
 * texel and a half leave gaps that show as stepped copies of an edge, so a wider blur comes from running them again.
 */
const BLUR_SPREAD = 1.3;
const BLUR_ROUNDS = 2;
/** Seconds the blur takes to fade out and back in around a view whose depth is not the scene's (`holdBlur`). */
const BLUR_HOLD_FADE = 0.4;
/** How far a near object's blur spills over what is behind it, in full-size pixels at 1080 lines. */
const NEAR_SPILL = 9;

const BLUR_GLSL = /* glsl */ `
uniform sampler2D tDepth;
uniform vec2 uFocus;
uniform vec2 uDepthRange;
float inverseAt(float d) {
  return 1.0 / uDepthRange.x - d * (1.0 / uDepthRange.x - 1.0 / uDepthRange.y);
}
float nearAt(vec2 uv) {
  return clamp((inverseAt(texture2D(tDepth, uv).r) - 1.0 / uFocus.x) * ${BLUR.aperture.toFixed(3)}, 0.0, 1.0);
}
/** The most blur any near object close by spreads here: a near object's blur spills past its outline, as through a lens. */
float spillAt(vec2 uv, vec2 resolution) {
  vec2 reach = vec2(${NEAR_SPILL.toFixed(1)} / 1080.0) * vec2(resolution.y / resolution.x, 1.0);
  return max(max(nearAt(uv + reach), nearAt(uv - reach)), max(nearAt(uv + vec2(reach.x, -reach.y)), nearAt(uv - vec2(reach.x, -reach.y))));
}
float blurAt(vec2 uv) {
  float d = texture2D(tDepth, uv).r;
  float inverse = inverseAt(d);
  float near = (inverse - 1.0 / uFocus.x) * ${BLUR.aperture.toFixed(3)};
  float far = (1.0 / uFocus.y - inverse) * ${BLUR.aperture.toFixed(3)};
  return clamp(max(near, min(far, d > 0.99999 ? ${BLUR.sky.toFixed(3)} : ${BLUR.far.toFixed(3)})), 0.0, 1.0);
}`;

/**
 * The frame at a quarter of its size, each texel weighted by how soft it is to be, so the sharp subject is left out
 * of what is blurred behind it and never haloes it.
 */
const BLUR_DOWN_FRAG = /* glsl */ `
uniform sampler2D tDiffuse;
uniform vec2 uTexel;
varying vec2 vUv;
${BLUR_GLSL}
void main() {
  vec4 sum = vec4(0.0);
  // Beside a near object what lies behind it is mixed in too, so the object's own edge softens.
  float spill = spillAt(vUv, 1.0 / uTexel);
  for (int i = 0; i < 4; i++) {
    vec2 uv = vUv + uTexel * vec2(i < 2 ? -1.0 : 1.0, mod(float(i), 2.0) < 1.0 ? -1.0 : 1.0);
    float w = max(blurAt(uv), spill);
    sum += vec4(texture2D(tDiffuse, uv).rgb * w, w);
  }
  gl_FragColor = sum * 0.25;
}`;

const BLUR_PASS_FRAG = /* glsl */ `
uniform sampler2D tDiffuse;
uniform vec2 uStep;
varying vec2 vUv;
void main() {
  vec4 sum = texture2D(tDiffuse, vUv) * 0.2;
  sum += (texture2D(tDiffuse, vUv + uStep) + texture2D(tDiffuse, vUv - uStep)) * 0.17;
  sum += (texture2D(tDiffuse, vUv + uStep * 2.0) + texture2D(tDiffuse, vUv - uStep * 2.0)) * 0.12;
  sum += (texture2D(tDiffuse, vUv + uStep * 3.0) + texture2D(tDiffuse, vUv - uStep * 3.0)) * 0.07;
  sum += (texture2D(tDiffuse, vUv + uStep * 4.0) + texture2D(tDiffuse, vUv - uStep * 4.0)) * 0.04;
  gl_FragColor = sum;
}`;

const QUAD_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

/** With the glow, the sun's light is read once for the frame: what of its disc is seen and bright enough to bloom. */
const GRADE_VERT = /* glsl */ `
varying vec2 vUv;
#if SUN_GLOW
uniform sampler2D tDiffuse;
uniform vec2 uResolution;
uniform vec4 uSun;
flat varying vec3 vSunLight;
#endif
void main() {
  vUv = uv;
#if SUN_GLOW
  vec3 sum = vec3(0.0);
  float taps = 0.0;
  for (int i = -2; i <= 2; i++) for (int j = -2; j <= 2; j++) {
    vec2 o = vec2(i, j) * 0.5;
    if (dot(o, o) > 1.0) continue;
    taps += 1.0;
    // Clamped to the frame's edge, as bloom's blur reads past it, so a sun half out of frame still glows.
    vec3 c = textureLod(tDiffuse, clamp(uSun.xy + o * uSun.z / uResolution, 0.0, 1.0), 0.0).rgb;
    sum += c * smoothstep(1.1, 1.11, dot(c, vec3(0.2126, 0.7152, 0.0722)));
  }
  vSunLight = sum / taps * uSun.w;
#endif
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

const GRADE_FRAG = /* glsl */ `
uniform sampler2D tDiffuse;
uniform float uTime;
#if DEPTH_BLUR
uniform sampler2D tBlur;
uniform float uDepthBlur;
${BLUR_GLSL}
#endif
uniform float uExposure;
uniform float uSaturation;
uniform vec2 uResolution;
varying vec2 vUv;
#if SUN_GLOW
uniform vec4 uSun;
uniform vec4 uGlowFalloff;
uniform vec4 uGlowShare;
flat varying vec3 vSunLight;
#endif

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
/** Hue in degrees. */
float hueOf(vec3 c, float chroma) {
  float mx = max(c.r, max(c.g, c.b));
  float d = max(chroma, 1e-4);
  float h = mx == c.r ? mod((c.g - c.b) / d, 6.0) : mx == c.g ? (c.b - c.r) / d + 2.0 : (c.r - c.g) / d + 4.0;
  return h * 60.0;
}

void main() {
  vec2 fromCentre = vUv - 0.5;
  float r2 = dot(fromCentre, fromCentre);
  vec2 shift = fromCentre * r2 * 0.006;
  vec3 hdr;
  hdr.r = texture2D(tDiffuse, vUv + shift).r;
  hdr.g = texture2D(tDiffuse, vUv).g;
  hdr.b = texture2D(tDiffuse, vUv - shift).b;
#if SUN_GLOW
  vec2 px = (vUv - uSun.xy) * uResolution;
  hdr += vSunLight * dot(uGlowShare, exp2(-dot(px, px) * uGlowFalloff));
#endif
#if DEPTH_BLUR
  vec4 blurred = texture2D(tBlur, vUv);
  float amount = max(blurAt(vUv), spillAt(vUv, uResolution) * 0.85);
  hdr = mix(hdr, blurred.rgb / max(blurred.a, 1e-4), amount * smoothstep(0.0, 0.02, blurred.a) * uDepthBlur);
#endif
  hdr *= uExposure;

  float lum = dot(hdr, vec3(0.2126, 0.7152, 0.0722));
  vec3 shadowTint = vec3(0.92, 1.0, 1.1);
  vec3 highTint = vec3(1.06, 1.0, 0.9);
  float k = smoothstep(0.02, 0.9, lum);
  hdr *= mix(shadowTint, highTint, k);
  hdr = mix(vec3(lum) * mix(vec3(0.96, 0.98, 1.03), vec3(1.0), uSaturation), hdr, 1.1 * uSaturation);

  vec3 col = toSRGB(aces(hdr));
  float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
  float chroma = max(col.r, max(col.g, col.b)) - min(col.r, min(col.g, col.b));
  float h = hueOf(col, chroma);
  /**
   * Muted colours gain most, so what is already vivid does not clip; the grey still world (0.62) gains none. Pinks
   * and magentas gain little, the bright ones nothing, and the brightest go whiter, so cloud lit by a low sun stays
   * gold and white instead of turning purple.
   */
  float pink = max(smoothstep(288.0, 305.0, h), 1.0 - smoothstep(12.0, 30.0, h));
  float held = pink * (0.5 + 0.5 * smoothstep(0.5, 0.68, l));
  col = mix(vec3(l), col, 1.0 + 0.4 * smoothstep(0.62, 1.0, uSaturation) * (1.0 - chroma) * (1.0 - held) - 0.35 * pink * smoothstep(0.6, 0.9, l));
  col *= mix(l, l * l * (3.0 - 2.0 * l), 0.2) / max(l, 1e-4);
  // Shadows go blue rather than black, leaving true black and pinks alone so the dark wood stays dark.
  float low = smoothstep(0.0, 0.12, l) * (1.0 - smoothstep(0.12, 0.5, l)) * (1.0 - pink);
  col *= 1.0 + vec3(-0.07, -0.01, 0.12) * low + vec3(0.012, 0.0, -0.02) * smoothstep(0.45, 1.0, l);
  col *= 1.0 - smoothstep(0.18, 0.75, r2) * 0.15;
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

function quadMaterial(fragmentShader: string, uniforms: Record<string, THREE.IUniform>, vertexShader = QUAD_VERT): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({ vertexShader, fragmentShader, uniforms, depthTest: false, depthWrite: false });
}

/**
 * The frame's image chain: the scene into one multisampled float target, one resolve-and-clamp pass into a plain
 * target, bloom added there, and the grade straight to the screen. Only the scene target is multisampled. Nothing in
 * the chain reads alpha, so its targets drop it (and negative colour) where the device allows. While bloom is on, the
 * finished frame is also blurred at a quarter of its size for the grade's depth blur, which reads the scene's depth.
 * While bloom is off the grade paints a glow round the sun in its place, so the sun is not a hard white disc.
 */
export class Post {
  /** Where the scene is drawn; also the target its programs are compiled against. */
  readonly sceneTarget: THREE.WebGLRenderTarget;
  private readonly clean: THREE.WebGLRenderTarget;
  private readonly bloom: UnrealBloomPass;
  private readonly quad = new FullScreenQuad();
  private readonly resolveMat: THREE.ShaderMaterial;
  private readonly gradeMat: THREE.ShaderMaterial;
  private readonly blurDownMat: THREE.ShaderMaterial;
  private readonly blurPassMat: THREE.ShaderMaterial;
  /** The depth blur's quarter-size frame and its other half-pass. */
  private readonly blurA: THREE.WebGLRenderTarget;
  private readonly blurB: THREE.WebGLRenderTarget;
  private readonly focus = new THREE.Vector2(10, 10);
  /** Set while the depth in view is not the scene's own, as through the island of lines' door: the blur fades out. */
  holdBlur = false;
  private blurShown = 1;
  private depthBlurOn = true;
  /** How much of the depth blur the quality level shows, easing as bloom does. */
  private depthBlurShown = 1;
  private blurReleased = false;
  private readonly size = new THREE.Vector2();
  private bloomLevel: BloomLevel = 'full';
  /** How much of the bloom is drawn, easing toward 0 while it is off and 1 while it is on. */
  private bloomShown = 1;
  private bloomReleased = false;
  private lastTime = NaN;
  private readonly sunAt = new THREE.Vector4();

  constructor(
    private readonly renderer: THREE.WebGLRenderer,
    private readonly scene: THREE.Scene,
    private readonly camera: THREE.Camera,
    samples: number,
    /** The direction of the sun (or the moon) in the sky. */
    private readonly sun: THREE.Vector3,
    /** The chain's targets as R11F_G11F_B10F rather than half-float RGBA (`compactFrameFormat`). */
    compact: boolean,
  ) {
    const size = renderer.getDrawingBufferSize(this.size);
    this.sceneTarget = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples, depthBuffer: true, stencilBuffer: true });
    const depth = new THREE.DepthTexture(size.x, size.y, THREE.UnsignedInt248Type);
    depth.format = THREE.DepthStencilFormat;
    this.sceneTarget.depthTexture = depth;
    // Resolving stencil is slow on Direct3D, and nothing reads it after the scene.
    this.sceneTarget.resolveStencilBuffer = false;
    const quarter = (n: number) => Math.max(1, Math.round(n / 4));
    this.blurA = new THREE.WebGLRenderTarget(quarter(size.x), quarter(size.y), { type: THREE.HalfFloatType, depthBuffer: false });
    this.blurB = this.blurA.clone();
    this.clean = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, depthBuffer: false });
    this.bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), BLOOM_STRENGTH, 0.45, 1.1);
    const b = this.bloom;
    if (compact) {
      for (const target of [this.sceneTarget, this.clean, b.renderTargetBright, ...b.renderTargetsHorizontal, ...b.renderTargetsVertical]) {
        target.texture.format = THREE.RGBFormat;
        target.texture.internalFormat = 'R11F_G11F_B10F';
      }
    }
    this.resolveMat = quadMaterial(RESOLVE_FRAG, { tDiffuse: { value: this.sceneTarget.texture } });
    this.gradeMat = quadMaterial(GRADE_FRAG, {
      tDiffuse: { value: this.clean.texture },
      uTime: { value: 0 },
      uExposure: { value: 1.0 },
      uSaturation: { value: 1.0 },
      uResolution: { value: new THREE.Vector2(size.x, size.y) },
      uSun: { value: new THREE.Vector4() },
      uGlowFalloff: { value: new THREE.Vector4() },
      uGlowShare: { value: new THREE.Vector4() },
    }, GRADE_VERT);
    const depthUniforms = {
      tDepth: { value: depth },
      uFocus: { value: this.focus },
      uDepthRange: { value: new THREE.Vector2(0.5, 7000) },
    };
    Object.assign(this.gradeMat.uniforms, depthUniforms, { tBlur: { value: this.blurA.texture }, uDepthBlur: { value: 1 } });
    register(this.gradeMat, SUN_GLOW, DEPTH_BLUR);
    this.blurDownMat = quadMaterial(BLUR_DOWN_FRAG, { ...depthUniforms, tDiffuse: { value: this.clean.texture }, uTexel: { value: new THREE.Vector2(1 / size.x, 1 / size.y) } });
    this.blurPassMat = quadMaterial(BLUR_PASS_FRAG, { tDiffuse: { value: this.blurA.texture }, uStep: { value: new THREE.Vector2() } });
  }

  /** The nearest and farthest of what should be sharp, as distances along the view. */
  focusOn(near: number, far: number): void {
    this.focus.set(Math.max(near, 0.5), Math.max(far, near, 0.5));
  }

  /** The chain's passes: into offscreen targets, but the grade, which draws to the screen. */
  compileJobs(): CompileJob[] {
    const b = this.bloom;
    return [
      passJob([this.resolveMat, b.materialHighPassFilter, ...b.separableBlurMaterials, b.compositeMaterial, b.blendMaterial], this.clean),
      passJob([this.blurDownMat, this.blurPassMat], this.blurA),
      passJob([this.gradeMat], null),
    ];
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
    this.blurDownMat.uniforms.uTexel.value.set(1 / w, 1 / h);
  }

  /** Full, or off: its passes skipped and its targets released once it has faded out. */
  setBloom(level: BloomLevel, immediate = false): void {
    this.bloomLevel = level;
    if (immediate) this.bloomShown = level === 'off' ? 0 : 1;
    this.sizeBloom();
  }

  private sizeBloom(): void {
    if (this.bloomLevel === 'off') return;
    this.bloom.setSize(this.size.x, this.size.y);
    this.sizeBlur();
  }

  private sizeBlur(): void {
    if (!this.depthBlurOn) return;
    const w = Math.max(1, Math.round(this.size.x / 4)), h = Math.max(1, Math.round(this.size.y / 4));
    this.blurA.setSize(w, h);
    this.blurB.setSize(w, h);
  }

  /** On, or off: its passes skipped and its targets released once it has faded out. */
  setDepthBlur(on: boolean, immediate = false): void {
    this.depthBlurOn = on;
    if (immediate) this.depthBlurShown = on ? 1 : 0;
    this.sizeBlur();
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

  private aimGlow(strength: number): void {
    const u = this.gradeMat.uniforms;
    const projection = this.camera.projectionMatrix;
    const at = this.sunAt.set(this.sun.x, this.sun.y, this.sun.z, 0).applyMatrix4(this.camera.matrixWorldInverse).applyMatrix4(projection);
    const height = this.size.y;
    const radius = Math.tan(SUN_RADIUS) * projection.elements[5] * height * 0.5;
    const ahead = at.w > 1e-4;
    u.uSun.value.set(ahead ? at.x / at.w * 0.5 + 0.5 : -1, ahead ? at.y / at.w * 0.5 + 0.5 : -1, radius, ahead ? strength * Math.PI * radius * radius : 0);
    const falloff = u.uGlowFalloff.value as THREE.Vector4;
    const share = u.uGlowShare.value as THREE.Vector4;
    for (let i = 0; i < 4; i++) {
      // The disc spreads like a point blurred by a quarter of its radius squared more.
      const spread = (GLOW_SPREAD[i] * height) ** 2 + radius * radius * 0.25;
      falloff.setComponent(i, Math.LOG2E / (2 * spread));
      share.setComponent(i, GLOW_SHARE[i] / (2 * Math.PI * spread));
    }
  }

  private blurForDepth(): void {
    const r = this.renderer;
    const camera = this.camera as THREE.PerspectiveCamera;
    (this.blurDownMat.uniforms.uDepthRange.value as THREE.Vector2).set(camera.near, camera.far);
    this.quad.material = this.blurDownMat;
    r.setRenderTarget(this.blurA);
    this.quad.render(r);
    const step = this.blurPassMat.uniforms.uStep.value as THREE.Vector2;
    this.quad.material = this.blurPassMat;
    for (let round = 0; round < BLUR_ROUNDS; round++) {
      for (const [from, to, x, y] of [[this.blurA, this.blurB, 1, 0], [this.blurB, this.blurA, 0, 1]] as const) {
        this.blurPassMat.uniforms.tDiffuse.value = from.texture;
        step.set(x * BLUR_SPREAD / from.width, y * BLUR_SPREAD / from.height);
        r.setRenderTarget(to);
        this.quad.render(r);
      }
    }
  }

  /** `warm` draws the bloom and the sun's glow even while they are off, so their programs are built before Begin whatever the level. */
  render(time: number, warm = false): void {
    const r = this.renderer;
    const dt = Math.min(Math.max(time - this.lastTime, 0), 0.1) || 0;
    this.lastTime = time;
    const target = this.bloomLevel === 'off' ? 0 : 1;
    this.bloomShown = target > this.bloomShown ? Math.min(target, this.bloomShown + dt / BLOOM_FADE) : Math.max(target, this.bloomShown - dt / BLOOM_FADE);
    this.depthBlurShown = this.depthBlurOn ? Math.min(1, this.depthBlurShown + dt / BLOOM_FADE) : Math.max(0, this.depthBlurShown - dt / BLOOM_FADE);
    const depthBlur = Math.min(this.bloomShown, this.depthBlurShown);
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
    if (depthBlur > 0 || warm) {
      this.blurForDepth();
      this.blurReleased = false;
    }
    if (this.bloomShown === 0 && !this.bloomReleased) this.releaseBloom();
    if (depthBlur === 0 && !this.blurReleased) {
      this.blurA.dispose();
      this.blurB.dispose();
      this.blurReleased = true;
    }

    const glow = 1 - this.bloomShown;
    if (glow > 0 || warm) this.aimGlow(glow);
    this.gradeMat.uniforms.uTime.value = time;
    this.quad.material = this.gradeMat;
    r.setRenderTarget(null);
    const blur = depthBlur > 0 || warm;
    this.blurShown = this.holdBlur ? Math.max(0, this.blurShown - dt / BLUR_HOLD_FADE) : Math.min(1, this.blurShown + dt / BLUR_HOLD_FADE);
    this.gradeMat.uniforms.uDepthBlur.value = depthBlur * this.blurShown;
    if (warm) {
      select(this.gradeMat, { SUN_GLOW: glow === 0, DEPTH_BLUR: blur });
      this.quad.render(r);
    }
    select(this.gradeMat, { SUN_GLOW: glow > 0, DEPTH_BLUR: blur });
    this.quad.render(r);
  }
}
