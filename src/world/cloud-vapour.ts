import * as THREE from 'three';
import { ATMO_GLSL, atmo } from './atmosphere';
import { tuning } from '../tuning';

/**
 * The light of thin vapour over the top of the cloud: lilac from the sky, peach from the low sun across it, and
 * bright against the sun, where the light comes through it. rd is the sightline, thin how little there is of it.
 */
export const VAPOUR_GLSL = /* glsl */ `
vec3 vapourLight(vec3 world, vec3 rd, float thin) {
  vec3 L = normalize(uSunDir);
  float toward = pow(max(dot(rd, L), 0.0), 4.0);
  vec3 col = uSkyAmbient * vec3(1.3, 1.02, 1.22) + uGroundBounce * 0.25;
  col += uSunColor * vec3(0.44, 0.33, 0.3) * (0.7 + 0.3 * thin);
  col += uSunColor * vec3(1.0, 0.88, 0.72) * toward * (0.25 + 0.9 * thin);
  return col;
}`;

const SEGMENTS = 10;

interface Streamer { x: number; z: number; length: number; width: number; lift: number; age: number; life: number; speed: number; seed: number; strength: number }

const VERT = /* glsl */ `
${ATMO_GLSL}
uniform vec2 uWispAxis;
in vec3 aCentre;
in vec3 aShape;
in vec2 aState;
out vec3 vWorld;
out vec3 vAt;
out float vAlpha;
out vec4 vFog;
void main() {
  // aShape: which side (-1 or 1), how far along (-1 to 1), half its width; aState: how much of it there is, its seed.
  vec3 axis = vec3(uWispAxis.x, 0.0, uWispAxis.y);
  vec3 view = normalize(aCentre - cameraPosition);
  vec3 side = normalize(cross(axis, view) + vec3(0.0, 1e-4, 0.0));
  // Never stood straight up at the lens: tipped toward lying along the tops.
  side = normalize(side * vec3(1.0, 0.6, 1.0));
  vWorld = aCentre + side * aShape.x * aShape.z;
  vAt = vec3(aShape.x, aShape.y, aState.y);
  float near = smoothstep(4.0, 14.0, distance(aCentre, cameraPosition));
  vAlpha = aState.x * near;
  vFog = fogOf(vWorld);
  gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.0);
}`;

const FRAG = /* glsl */ `
${ATMO_GLSL}
${VAPOUR_GLSL}
uniform float uWispAmount;
in vec3 vWorld;
in vec3 vAt;
in float vAlpha;
in vec4 vFog;
void main() {
  float across = vAt.x, along = vAt.y;
  // Long and thin along the air, streaked and torn, soft at both ends.
  vec2 q = vec2(along * 2.2 + vAt.z * 13.1 - uTime * 0.03, across * 1.7 + vAt.z * 5.3);
  float streak = vnoise(q * vec2(1.0, 1.0)) * 0.55 + vnoise(q * vec2(2.7, 3.3) + 3.1) * 0.3 + vnoise(q * vec2(6.1, 7.7)) * 0.15;
  float ends = pow(max(0.0, 1.0 - along * along), 1.5);
  float soft = 1.0 - across * across;
  float body = soft * soft * ends * smoothstep(0.3, 0.8, streak);
  float a = body * vAlpha * uWispAmount;
  if (a < 0.003) discard;
  vec3 col = vapourLight(vWorld, normalize(vWorld - cameraPosition), 0.7);
  gl_FragColor = vec4(mix(col, vFog.rgb, vFog.a), a);
}`;

/**
 * Low wisps of vapour streaming across the top of the cloud on the air, lying over the tops and following them
 * over the heaps, each drifting a while and thinning away, and others coming. Round the eye, never at it.
 */
export class CloudStreamers {
  readonly mesh: THREE.Mesh;
  /** The height of the cloud's top under a point. */
  groundAt: (x: number, z: number) => number = () => 0;
  /** 0 none, 1 the full stream; eased toward. */
  amount = 0;
  private readonly streamers: Streamer[] = [];
  private readonly centre: THREE.BufferAttribute;
  private readonly shape: THREE.BufferAttribute;
  private readonly state: THREE.BufferAttribute;
  private readonly uniforms = { uWispAxis: { value: new THREE.Vector2(1, 0) }, uWispAmount: { value: 0 } };
  private seed = 11;
  private started = false;
  private readonly eye = new THREE.Vector3();

  constructor(count = 30) {
    const verts = (SEGMENTS + 1) * 2;
    const geometry = new THREE.BufferGeometry();
    this.centre = new THREE.Float32BufferAttribute(new Float32Array(count * verts * 3), 3).setUsage(THREE.DynamicDrawUsage);
    this.shape = new THREE.Float32BufferAttribute(new Float32Array(count * verts * 3), 3).setUsage(THREE.DynamicDrawUsage);
    this.state = new THREE.Float32BufferAttribute(new Float32Array(count * verts * 2), 2).setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(count * verts * 3), 3));
    geometry.setAttribute('aCentre', this.centre);
    geometry.setAttribute('aShape', this.shape);
    geometry.setAttribute('aState', this.state);
    const index: number[] = [];
    for (let s = 0; s < count; s++) {
      for (let i = 0; i < SEGMENTS; i++) {
        const a = s * verts + i * 2, b = a + 1, c = a + 2, d = a + 3;
        index.push(a, c, b, b, c, d);
      }
      this.streamers.push({ x: 0, z: 0, length: 1, width: 1, lift: 1, age: 0, life: 1, speed: 1, seed: 0, strength: 0 });
    }
    geometry.setIndex(index);
    this.mesh = new THREE.Mesh(geometry, new THREE.ShaderMaterial({
      uniforms: { ...atmo.uniforms, ...this.uniforms },
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    }));
    this.mesh.name = 'cloud-streamers';
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 5;
    this.mesh.visible = false;
  }

  private random(): number {
    this.seed = (this.seed * 16807) % 2147483647;
    return (this.seed - 1) / 2147483646;
  }

  /** Anywhere round the eye to begin with; after that upwind of it, so they come on the air. */
  private spawn(s: Streamer, upwind: boolean): void {
    const r = () => this.random();
    const wind = this.uniforms.uWispAxis.value;
    const reach = tuning.stairs.wispReach;
    const angle = r() * Math.PI * 2;
    const dist = reach * (0.12 + 0.88 * Math.sqrt(r()));
    s.x = this.eye.x + Math.cos(angle) * dist;
    s.z = this.eye.z + Math.sin(angle) * dist;
    if (upwind) {
      s.x -= wind.x * reach * 0.6;
      s.z -= wind.y * reach * 0.6;
    }
    s.length = 16 + r() * 34;
    s.width = 1.6 + r() * 2.6;
    s.lift = 0.9 + r() * 1.6;
    s.life = 22 + r() * 22;
    s.age = upwind ? 0 : r() * s.life;
    s.speed = tuning.stairs.wispSpeed * (0.75 + 0.5 * r());
    s.seed = r();
    s.strength = 0.18 + 0.22 * r();
  }

  update(dt: number, eye: THREE.Vector3, visible: boolean): void {
    this.uniforms.uWispAmount.value += ((visible ? this.amount : 0) - this.uniforms.uWispAmount.value) * (1 - Math.exp(-dt * 0.8));
    this.mesh.visible = this.uniforms.uWispAmount.value > 0.005;
    if (!this.mesh.visible) return;
    this.eye.copy(eye);
    if (!this.started) {
      this.started = true;
      for (const s of this.streamers) this.spawn(s, false);
    }
    const wind = this.uniforms.uWispAxis.value;
    const reach = tuning.stairs.wispReach;
    const verts = (SEGMENTS + 1) * 2;
    this.streamers.forEach((s, n) => {
      s.age += dt;
      s.x += wind.x * s.speed * dt;
      s.z += wind.y * s.speed * dt;
      if (s.age > s.life || Math.hypot(s.x - eye.x, s.z - eye.z) > reach * 1.25) this.spawn(s, true);
      const fade = Math.min(1, s.age / 5, (s.life - s.age) / 6);
      for (let i = 0; i <= SEGMENTS; i++) {
        const t = (i / SEGMENTS) * 2 - 1;
        const x = s.x + wind.x * t * s.length * 0.5, z = s.z + wind.y * t * s.length * 0.5;
        // It lies over the tops, following them up over a heap and down between them.
        const y = this.groundAt(x, z) + s.lift + s.width * 0.35;
        for (let k = 0; k < 2; k++) {
          const v = n * verts + i * 2 + k;
          this.centre.setXYZ(v, x, y, z);
          this.shape.setXYZ(v, k ? 1 : -1, t, s.width);
          this.state.setXY(v, s.strength * Math.max(0, fade), s.seed);
        }
      }
    });
    this.centre.needsUpdate = this.shape.needsUpdate = this.state.needsUpdate = true;
  }

  /** The way the air over the cloud goes, as a unit vector across the ground. */
  setWind(x: number, z: number): void {
    const len = Math.hypot(x, z) || 1;
    this.uniforms.uWispAxis.value.set(x / len, z / len);
  }
}
