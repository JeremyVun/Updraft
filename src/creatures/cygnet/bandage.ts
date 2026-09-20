import * as THREE from 'three';
import { atmo, ATMO_GLSL } from '../../world/atmosphere';
import { tuning } from '../../tuning';
import type { WindSample } from '../../wind/field';
import { CREATURE_GLSL } from '../shading';
import { wingArmGeometry } from './body';

export type WingCare = 'bare' | 'hurt' | 'wrapped' | 'free';
const ROWS = 108;
const COLS = 5;
const AROUND = 12;
const smooth = THREE.MathUtils.smoothstep;

/** A single strip of warm linen. Its winding and its loose end are the same geometry throughout. */
export class WingBandage {
  state: WingCare = 'bare';
  recovery = 0;
  dressing = 0;
  /** Authored opening of both wings at the sleeping hilltop, before the first flight. */
  opening = 0;
  private releaseTime = -1;
  private driftTime = 0;
  private readonly drift = new THREE.Vector3();
  private readonly velocity = new THREE.Vector3();
  private readonly anchor = new THREE.Matrix4();
  private readonly p = new THREE.Vector3();
  private readonly end = new THREE.Vector3();
  private readonly skinPoint = new THREE.Vector3();
  private readonly skinOther = new THREE.Vector3();
  private readonly skinNormal = new THREE.Vector3();
  private readonly normalMatrix = new THREE.Matrix3();
  private readonly surface = wingArmGeometry();
  private readonly skinnedPosition = new Float64Array(this.surface.attributes.position.count * 3);
  private readonly skinnedNormal = new Float64Array(this.skinnedPosition.length);
  private readonly skinFresh = new Uint8Array(this.surface.attributes.position.count);
  private readonly ringX: number[] = [];
  private bones: readonly THREE.Matrix4[] = [];
  readonly mesh: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>;

  constructor() {
    const surface = this.surface.attributes.position;
    for (let i = 0; i < (surface.count - 2) / AROUND; i++) {
      let x = 0;
      for (let j = 0; j < AROUND; j++) x += surface.getX(i * AROUND + j);
      this.ringX.push(x / AROUND);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array((ROWS + 1) * COLS * 3), 3).setUsage(THREE.DynamicDrawUsage));
    const uv: number[] = [], indices: number[] = [];
    for (let i = 0; i <= ROWS; i++) {
      for (let j = 0; j < COLS; j++) uv.push(i / ROWS, j / (COLS - 1));
      if (i < ROWS) for (let j = 0; j < COLS - 1; j++) {
        const a = i * COLS + j;
        indices.push(a, a + COLS, a + 1, a + 1, a + COLS, a + COLS + 1);
      }
    }
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(indices);
    this.mesh = new THREE.Mesh(geo, new THREE.ShaderMaterial({
      uniforms: { ...atmo.uniforms, uReveal: { value: 0 }, uFade: { value: 1 }, uNudge: { value: 0 } },
      side: THREE.DoubleSide,
      vertexShader: `${ATMO_GLSL}
        ${CREATURE_GLSL}
        uniform float uNudge;
        out vec3 vWorld; out vec3 vNormal; out vec2 vUv;
        void main() {
          vWorld = position; vNormal = normal; vUv = uv;
          gl_Position = projectionMatrix * nudgedView(vWorld, uNudge);
        }`,
      fragmentShader: `${ATMO_GLSL}
        uniform float uReveal; uniform float uFade;
        in vec3 vWorld; in vec3 vNormal; in vec2 vUv;
        void main() {
          if (vUv.x > uReveal) discard;
          // Fine woven variation and a slightly darker turned hem, never a medical symbol.
          float weave = 0.97 + 0.03 * sin(vUv.x * 710.0) * sin(vUv.y * 85.0);
          float hem = smoothstep(0.02, 0.11, vUv.y) * (1.0 - smoothstep(0.89, 0.98, vUv.y));
          float lap = 0.97 + 0.03 * sin(vUv.x * 3.25 / 0.84 * 6.283);
          vec3 N = normalize(vNormal) * (gl_FrontFacing ? 1.0 : -1.0);
          vec3 alb = vec3(0.74, 0.70, 0.61) * weave * lap * mix(0.70, 1.0, hem);
          vec3 col = alb * (uSkyAmbient * 1.25 + uSunColor * (0.15 + max(0.0, dot(N, uSunDir)) * 0.8));
          col += lampLight(vWorld, N) * 0.7 + dawnLight(vWorld, N) * 0.8;
          vec4 fog = fogOf(vWorld);
          gl_FragColor = vec4(mix(col, fog.rgb, fog.a), uFade);
        }`,
      transparent: true,
      depthWrite: true,
    }));
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
  }

  get flightReady(): boolean { return this.state === 'bare' || this.state === 'free'; }
  get covered(): number { return this.state === 'wrapped' ? this.dressing * (1 - smooth(this.releaseTime, 0, tuning.wingCare.unwindFor)) : 0; }
  get guard(): number { return this.flightReady ? 0 : (1 - this.recovery * 0.72) * (1 - this.opening); }

  restore(state: WingCare, recovery = 0): void {
    this.state = state;
    this.recovery = recovery;
    this.dressing = state === 'wrapped' ? 1 : 0;
    this.opening = 0;
    this.releaseTime = -1;
    this.driftTime = 0;
    this.drift.set(0, 0, 0);
    this.velocity.set(0, 0, 0);
    this.mesh.visible = false;
  }

  dress(amount: number): void {
    this.state = 'wrapped';
    this.dressing = THREE.MathUtils.clamp(amount, 0, 1);
  }

  release(): void {
    if (this.state === 'wrapped' && this.releaseTime < 0) this.releaseTime = 0;
  }

  /** Where the child's fingertips meet the end being wound, in world space. */
  tip(out: THREE.Vector3): THREE.Vector3 {
    this.skinFresh.fill(0);
    return this.point(this.dressing, 0, 0, 0, out);
  }

  /** Skin a sampled arm vertex once; the linen reuses those same triangles. */
  private skinVertex(i: number): void {
    const { position, normal, aSkin } = this.surface.attributes;
    const a = this.bones[aSkin.getX(i)], b = this.bones[aSkin.getY(i)];
    const blend = aSkin.getZ(i);
    this.skinPoint.fromBufferAttribute(position, i).applyMatrix4(a);
    this.skinOther.fromBufferAttribute(position, i).applyMatrix4(b);
    this.skinPoint.lerp(this.skinOther, blend).toArray(this.skinnedPosition, i * 3);
    // Padding follows the skinned displacement, including scale. Normalizing
    // it (or using an inverse-transpose normal matrix) would change the fit.
    this.skinNormal.fromBufferAttribute(normal, i).applyMatrix3(this.normalMatrix.setFromMatrix4(a));
    this.skinOther.fromBufferAttribute(normal, i).applyMatrix3(this.normalMatrix.setFromMatrix4(b));
    this.skinNormal.lerp(this.skinOther, blend).toArray(this.skinnedNormal, i * 3);
    this.skinFresh[i] = 1;
  }

  /** Sample the actual arm's triangles, with the same joint weights as its skin. */
  private fitted(x: number, angle: number, padding: number, out: THREE.Vector3): void {
    let ring = 0;
    while (ring < this.ringX.length - 2 && this.ringX[ring + 1] < x) ring++;
    const v = THREE.MathUtils.clamp((x - this.ringX[ring]) / (this.ringX[ring + 1] - this.ringX[ring]), 0, 1);
    const around = THREE.MathUtils.euclideanModulo(angle / (Math.PI * 2), 1) * AROUND;
    const j = Math.floor(around), u = around - j;
    const a = ring * AROUND + j, b = ring * AROUND + (j + 1) % AROUND;
    const d = a + AROUND, e = b + AROUND;
    out.set(0, 0, 0);
    if (u + v <= 1) {
      this.surfacePoint(a, padding, 1 - u - v, out);
      this.surfacePoint(b, padding, u, out);
      this.surfacePoint(d, padding, v, out);
    } else {
      this.surfacePoint(b, padding, 1 - v, out);
      this.surfacePoint(e, padding, u + v - 1, out);
      this.surfacePoint(d, padding, 1 - u, out);
    }
  }

  private surfacePoint(index: number, padding: number, weight: number, out: THREE.Vector3): void {
    if (!this.skinFresh[index]) this.skinVertex(index);
    const p = this.skinPoint.fromArray(this.skinnedPosition, index * 3);
    p.addScaledVector(this.skinOther.fromArray(this.skinnedNormal, index * 3), padding);
    out.addScaledVector(p, weight);
  }

  private point(s: number, width: number, time: number, unroll: number, out: THREE.Vector3): THREE.Vector3 {
    const turn = Math.min(s / 0.84, 1);
    const tail = Math.max(0, (s - 0.84) / 0.16);
    // The loose end comes away first; each part of the wrapping follows it continuously.
    const free = smooth(unroll, (1 - s) * 0.55, (1 - s) * 0.55 + 0.45);
    if (free < 1) {
      const a = turn * Math.PI * 6.5 + 0.4 + tail * 0.65;
      // A thin layer follows the broad shoulder down to the tapered wrist; the end stays tucked against it.
      const hem = Math.abs(width) / 0.022 * 0.0008;
      const padding = 0.005 + turn * 0.0065 + hem + Math.sin(tail * Math.PI) * 0.0015;
      this.fitted(0.163 + turn * 0.1 + width + Math.sin(a * 0.7) * 0.002 - tail * 0.006, a, padding, out);
    }
    this.end.set(-0.016 + width + s * 0.22, 0.028 + s * 0.12 + Math.sin(s * 9 - time * 4) * s * 0.025,
      -0.017 + s * 0.48 + Math.sin(time * 3 - s * 12) * s * 0.028).applyMatrix4(this.anchor);
    return free === 1 ? out.copy(this.end) : out.lerp(this.end, free);
  }

  update(dt: number, time: number, wing: THREE.Matrix4, bones: readonly THREE.Matrix4[], wind: WindSample, visible: boolean, nudge: number): void {
    this.bones = bones;
    if (this.state !== 'free' || this.releaseTime < 0) this.anchor.copy(wing);
    if (this.releaseTime >= 0 && this.state === 'wrapped') {
      this.releaseTime += dt;
      if (this.releaseTime >= tuning.wingCare.unwindFor) {
        this.state = 'free';
        this.velocity.set(wind.x * 0.08, 0.24, wind.z * 0.08);
      }
    }
    if (this.state === 'free' && this.releaseTime >= 0) {
      this.driftTime += dt;
      this.velocity.x += (wind.x * 0.18 - this.velocity.x) * Math.min(1, dt * 1.5);
      this.velocity.z += (wind.z * 0.18 - this.velocity.z) * Math.min(1, dt * 1.5);
      this.velocity.y += (wind.lift * 0.25 - 0.13 - this.velocity.y) * Math.min(1, dt);
      this.drift.addScaledVector(this.velocity, dt);
    }
    this.mesh.visible = visible && this.dressing > 0 && (this.state === 'wrapped' || this.releaseTime >= 0 && this.driftTime < 7);
    if (!this.mesh.visible) return;
    const unroll = this.releaseTime < 0 ? 0 : Math.min(1, this.releaseTime / tuning.wingCare.unwindFor);
    if (unroll < 1) this.skinFresh.fill(0);
    const position = this.mesh.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i <= ROWS; i++) for (let j = 0; j < COLS; j++) {
      const s = i / ROWS;
      const width = (j / (COLS - 1) * 2 - 1) * 0.022 * (1 - smooth(s, 0.92, 1) * 0.2);
      this.point(s, width, time, unroll, this.p).add(this.drift);
      position.setXYZ(i * COLS + j, this.p.x, this.p.y, this.p.z);
    }
    position.needsUpdate = true;
    this.mesh.geometry.computeVertexNormals();
    this.mesh.material.uniforms.uReveal.value = this.dressing;
    this.mesh.material.uniforms.uFade.value = 1 - smooth(this.driftTime, 4, 7);
    this.mesh.material.uniforms.uNudge.value = nudge * (1 - smooth(unroll, 0, 1));
  }
}
