import * as THREE from 'three';
import { ATMO_GLSL, atmo } from './atmosphere';
import { REFLECTION_LAYER } from './water/reflection';
import { mulberry32 } from './noise';
import { tuning } from '../tuning';
import { DARK_WAY, darkWayPoint } from './drowned-way';

const VERT = /* glsl */ `
${ATMO_GLSL}
in vec2 aCorner;
in vec4 aPuff;
in vec4 aLook;
out vec2 vCorner;
out vec3 vWorld;
out vec4 vLook;
out vec4 vFog;
out float vSun;
void main() {
  vec3 c = aPuff.xyz;
  float r = aPuff.w;
  if (aLook.x <= 0.002 || r <= 0.0) {
    gl_Position = vec4(0.0, 0.0, 2.0, 1.0);
    return;
  }
  vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  vCorner = aCorner * 1.3;
  vWorld = c + (right * vCorner.x + up * vCorner.y) * r;
  vLook = aLook;
  // A ball the lens is inside of would fill the screen with one flat smear: it thins away first.
  vLook.x *= smoothstep(r * 0.5 + 0.5, r * 1.3 + 2.0, distance(c, cameraPosition));
  vec4 f = fogOf(c);
  f.a *= aLook.w;
  vFog = f;
  vSun = cloudShadow(c.xz);
  gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.0);
}`;

/**
 * Soft round billows, lumpy at the rim. Smoke is near black with violet in it, lit from the low sun at its edge and
 * lilac where the sky reaches it; storm cloud is the same stuff further off and bluer, its tops warmed by the sun.
 */
const FRAG = /* glsl */ `
${ATMO_GLSL}
uniform float uWarm;
in vec2 vCorner;
in vec3 vWorld;
in vec4 vLook;
in vec4 vFog;
in float vSun;
void main() {
  float d = length(vCorner);
  if (d >= 1.3) discard;
  float seed = vLook.z;
  float around = atan(vCorner.y, vCorner.x);
  float lump = vnoise(vec2(around * 1.6 + seed * 13.0, seed * 7.0 + uTime * 0.13))
    + 0.5 * vnoise(vec2(around * 4.2 - seed * 5.0, uTime * 0.21 + seed * 3.0));
  float tone = vLook.y;
  // Small round lumps along the rim, so a ball reads as a billow rather than a soft blot.
  float curl = vnoise(vCorner * 3.4 + vec2(seed * 17.0, uTime * 0.08)) * 0.5 + vnoise(vCorner * 7.1 - seed * 11.0) * 0.25;
  float rim = 0.58 + mix(0.24, 0.2, tone) * lump + 0.3 * curl;
  float body = 1.0 - smoothstep(rim - mix(0.2, 0.24, tone), rim, d);
  float a = body * vLook.x;
  if (a <= 0.004) discard;
  float k = min(d, 1.0);
  vec3 nv = vec3(vCorner / max(d, 1.0), sqrt(max(0.0, 1.0 - k * k)));
  nv.xy += (vec2(vnoise(vCorner * 2.3 + seed * 9.0), vnoise(vCorner * 2.3 - seed * 4.0)) - 0.5) * 0.7;
  vec3 N = normalize(transpose(mat3(viewMatrix)) * normalize(nv));
  vec3 V = normalize(cameraPosition - vWorld);
  vec3 alb = mix(vec3(0.062, 0.048, 0.078), vec3(0.075, 0.075, 0.13), tone);
  float wrap = clamp(dot(N, uSunDir) * 0.5 + 0.5, 0.0, 1.0);
  float toward = pow(max(0.0, dot(-V, uSunDir)), 3.0);
  float edge = pow(1.0 - clamp(nv.z, 0.0, 1.0), 1.6);
  // Under the storm the light is cold whatever the sunset is doing.
  vec3 sky = mix(uSkyAmbient, vec3(0.42, 0.45, 0.68) * dot(uSkyAmbient, vec3(0.33)), tone * 0.7) * mix(0.18, 1.6, pow(N.y * 0.5 + 0.5, 1.5));
  float lit = pow(wrap, mix(2.0, 3.5, tone));
  vec3 col = alb * (sky * 1.3 + uSunColor * lit * mix(2.4, 1.1, tone) * vSun * uWarm)
    + uSunColor * edge * (0.012 + 0.04 * tone + toward * 0.25) * vSun * uWarm;
  gl_FragColor = vec4(mix(col, vFog.rgb, vFog.a), a);
}`;

/**
 * Camera-facing billows drawn in one call, sorted far to near every frame so the dark of one never cuts the soft edge
 * of another. Whoever owns a puff writes it each frame with `put`; anything not put that frame is not drawn.
 */
export class Billows {
  readonly mesh: THREE.Mesh;
  /** 1 lets the sun light the billows; the storm takes it down as it comes over. */
  readonly warm = { value: 1 };
  private readonly puff: THREE.InstancedBufferAttribute;
  private readonly look: THREE.InstancedBufferAttribute;
  private readonly stage: Float32Array;
  private readonly depth: Float32Array;
  private readonly order: number[] = [];
  private count = 0;

  constructor(readonly capacity: number) {
    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(12), 3));
    g.setAttribute('aCorner', new THREE.BufferAttribute(new Float32Array([-1, -1, 1, -1, 1, 1, -1, 1]), 2));
    g.setIndex([0, 1, 2, 0, 2, 3]);
    this.puff = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 4), 4).setUsage(THREE.DynamicDrawUsage);
    this.look = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 4), 4).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('aPuff', this.puff);
    g.setAttribute('aLook', this.look);
    g.instanceCount = 0;
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
    this.stage = new Float32Array(capacity * 8);
    this.depth = new Float32Array(capacity);
    this.mesh = new THREE.Mesh(g, new THREE.ShaderMaterial({
      uniforms: { ...atmo.uniforms, uWarm: this.warm },
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
    }));
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 2;
    this.mesh.layers.enable(REFLECTION_LAYER);
  }

  begin(): void { this.count = 0; }

  /** `tone` 0 smoke to 1 storm cloud; `haze` how much of the distance veil it takes, 1 all of it. */
  put(x: number, y: number, z: number, r: number, alpha: number, tone: number, seed: number, haze = 1): void {
    if (this.count >= this.capacity || alpha <= 0.002 || r <= 0) return;
    const s = this.stage, k = this.count * 8;
    s[k] = x; s[k + 1] = y; s[k + 2] = z; s[k + 3] = r;
    s[k + 4] = alpha; s[k + 5] = tone; s[k + 6] = seed; s[k + 7] = haze;
    this.count++;
  }

  end(eye: THREE.Vector3): void {
    const n = this.count, s = this.stage, order = this.order;
    order.length = n;
    for (let i = 0; i < n; i++) {
      const k = i * 8;
      this.depth[i] = (s[k] - eye.x) ** 2 + (s[k + 1] - eye.y) ** 2 + (s[k + 2] - eye.z) ** 2;
      order[i] = i;
    }
    order.sort((a, b) => this.depth[b] - this.depth[a]);
    const p = this.puff.array as Float32Array, l = this.look.array as Float32Array;
    for (let j = 0; j < n; j++) {
      const k = order[j] * 8;
      p[j * 4] = s[k]; p[j * 4 + 1] = s[k + 1]; p[j * 4 + 2] = s[k + 2]; p[j * 4 + 3] = s[k + 3];
      l[j * 4] = s[k + 4]; l[j * 4 + 1] = s[k + 5]; l[j * 4 + 2] = s[k + 6]; l[j * 4 + 3] = s[k + 7];
    }
    (this.mesh.geometry as THREE.InstancedBufferGeometry).instanceCount = n;
    this.puff.clearUpdateRanges(); this.look.clearUpdateRanges();
    this.puff.addUpdateRange(0, n * 4); this.look.addUpdateRange(0, n * 4);
    this.puff.needsUpdate = true; this.look.needsUpdate = true;
  }
}

interface Heap { across: number; back: number; height: number; size: number; seed: number }

/**
 * The dark: low black smoke lying on the water, the sea coming back underneath it. It rises on the horizon where
 * they came from and comes on over the village, swallowing roofs, and wherever it stops it heaves. It is drawn as a
 * bank whose front lies across the way it comes, the flanks a little ahead, heaped higher toward the back.
 */
export class DarkBank {
  readonly billows = new Billows(tuning.drowned.dark.billows);
  /** How far its front has come along `DARK_WAY`, in metres. */
  reach = 0;
  /** 0 nothing on the horizon to 1 risen in full. */
  rise = 0;
  private readonly heaps: Heap[] = [];
  private readonly ahead = new THREE.Vector2().subVectors(DARK_WAY[1], DARK_WAY[0]).normalize();
  private readonly front = new THREE.Vector2();

  constructor() {
    const rand = mulberry32(5813);
    for (let i = 0; i < tuning.drowned.dark.billows; i++) {
      this.heaps.push({ across: rand() * 2 - 1, back: rand() ** 1.4, height: rand(), size: 0.7 + rand() * 0.6, seed: rand() });
    }
  }

  get objects(): THREE.Object3D[] {
    return [this.billows.mesh];
  }

  /** Where its front crosses the way, for whoever is keeping something just ahead of it. */
  frontAt(out: THREE.Vector2): THREE.Vector2 {
    return darkWayPoint(this.reach, out);
  }

  update(time: number, eye: THREE.Vector3): void {
    const k = tuning.drowned.dark;
    const b = this.billows;
    b.begin();
    const risen = THREE.MathUtils.smootherstep(this.rise, 0, 1);
    if (risen > 0.002) {
      darkWayPoint(this.reach, this.front);
      const ax = this.ahead.x, az = this.ahead.y;
      const heave = Math.sin(time * k.heaveRate) * k.heave;
      for (const h of this.heaps) {
        const u = h.across;
        const wobble = time * 0.05 + h.seed * 40;
        /** The front is ragged: fingers of it reach on ahead and draw back. */
        const finger = (1 - THREE.MathUtils.smoothstep(h.back, 0, 0.18)) * Math.sin(u * 23 + time * 0.09 + h.seed * 6) * k.fingers;
        const forward = k.flank * u * u + heave * (0.6 + 0.4 * Math.sin(u * 5 + time * 0.2)) + finger - h.back * k.depth;
        const side = u * k.halfWidth;
        const crest = 0.55 + 0.45 * Math.abs(Math.sin(u * 4.3 + 1.3)) + 0.2 * Math.sin(u * 13 + 0.4);
        const r = THREE.MathUtils.lerp(k.frontSize, k.backSize, h.back ** 0.7) * h.size
          * (1 + 0.07 * Math.sin(time * 0.4 + h.seed * 30)) * (0.35 + 0.65 * risen);
        const x = this.front.x + ax * forward - az * side + Math.cos(wobble) * 1.6;
        const z = this.front.y + az * forward + ax * side + Math.sin(wobble * 1.3) * 1.6;
        const y = (r * 0.3 + h.height * crest * THREE.MathUtils.lerp(1.5, k.heap, h.back)) * risen;
        const edge = 1 - THREE.MathUtils.smoothstep(Math.abs(u), 0.75, 1);
        const distance = Math.hypot(x - eye.x, z - eye.z);
        const haze = THREE.MathUtils.lerp(1, k.farHaze, THREE.MathUtils.smoothstep(distance, 60, 220));
        b.put(x, y, z, r, 0.95 * edge * THREE.MathUtils.smoothstep(risen, 0, 0.35), 0, h.seed, haze);
      }
    }
    b.end(eye);
  }
}
