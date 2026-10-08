import * as THREE from 'three';
import { atmo, ATMO_GLSL } from '../../world/atmosphere';
import { CREATURE_GLSL } from '../shading';

const DROPS = 400;
const GRAVITY = 9.8;
const GONE = -1e4;

const VERT = /* glsl */ `
uniform float uRadius;
uniform float uHalfHeight;
attribute float aSize;
attribute float aLeft;
varying vec3 vWorld;
varying float vCover;
void main() {
  vWorld = position;
  vec4 view = viewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * view;
  /** Shrinking as it goes; a drop finer than a pixel is drawn at a pixel and a half and fainter for it. */
  float px = 2.0 * uRadius * aSize * sqrt(aLeft) * projectionMatrix[1][1] * uHalfHeight / max(-view.z, 0.05);
  gl_PointSize = clamp(px, 1.5, 12.0);
  vCover = clamp(px / 1.5, 0.0, 1.0) * smoothstep(0.0, 0.25, aLeft);
}`;

const FRAG = /* glsl */ `
${ATMO_GLSL}
${CREATURE_GLSL}
varying vec3 vWorld;
varying float vCover;
const vec3 WATER = vec3(0.3, 0.36, 0.4);
void main() {
  vec2 c = gl_PointCoord * 2.0 - 1.0;
  float r2 = dot(c, c);
  if (r2 > 1.0 || vCover < 0.01) discard;
  /**
   * Each drop a tiny clear ball, lit as the cat's coat is by the sun, the sky and the lantern: mostly what it
   * reflects at its rim, and the low sun caught in it as a glint.
   */
  vec3 N = normalize(transpose(mat3(viewMatrix)) * vec3(c.x, -c.y, sqrt(1.0 - r2)));
  vec3 V = normalize(cameraPosition - vWorld);
  float rim = pow(1.0 - max(dot(N, V), 0.0), 2.0);
  vec3 col = shadeCreature(WATER, N, vWorld, 1.0, 0.0, 0.8, 1.0) + uSkyAmbient * rim * 0.9;
  float glint = pow(max(dot(reflect(-V, N), uSunDir), 0.0), 40.0) * cloudShadow(vWorld.xz);
  col += uSunColor * glint * 1.4;
  float alpha = vCover * clamp(0.35 + 0.55 * rim + glint, 0.0, 1.0);
  gl_FragColor = vec4(max(applyFog(col, vWorld), 0.0), alpha);
}`;

/** The water a wet cat throws off as it shakes: drops flung out from its coat that fall away and are gone. */
export class Spray {
  readonly points: THREE.Points;
  private readonly at = new Float32Array(DROPS * 3).fill(GONE);
  private readonly vel = new Float32Array(DROPS * 3);
  private readonly life = new Float32Array(DROPS);
  private readonly span = new Float32Array(DROPS).fill(1);
  private readonly size = new Float32Array(DROPS);
  private readonly left = new Float32Array(DROPS);
  private readonly attrs: THREE.BufferAttribute[];
  private readonly viewport = new THREE.Vector2();
  private next = 0;
  private live = 0;

  /** `radius` is a drop's, in metres. */
  constructor(radius: number) {
    const geo = new THREE.BufferGeometry();
    this.attrs = [
      new THREE.BufferAttribute(this.at, 3),
      new THREE.BufferAttribute(this.size, 1),
      new THREE.BufferAttribute(this.left, 1),
    ];
    for (const a of this.attrs) a.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', this.attrs[0]);
    geo.setAttribute('aSize', this.attrs[1]);
    geo.setAttribute('aLeft', this.attrs[2]);
    const half = { value: 450 };
    const mat = new THREE.ShaderMaterial({
      uniforms: { ...atmo.uniforms, uRadius: { value: radius }, uHalfHeight: half },
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    this.points.onBeforeRender = (renderer) => {
      half.value = renderer.getDrawingBufferSize(this.viewport).y / 2;
    };
  }

  /** One drop leaving the coat at `from`, flung off at `velocity` metres a second. */
  fling(from: THREE.Vector3, velocity: THREE.Vector3): void {
    const i = this.next;
    this.next = (this.next + 1) % DROPS;
    this.at.set([from.x, from.y, from.z], i * 3);
    this.vel.set([velocity.x, velocity.y, velocity.z], i * 3);
    this.life[i] = this.span[i] = 0.3 + Math.random() * 0.25;
    this.size[i] = 0.6 + Math.random() * 0.7;
    this.left[i] = 1;
    this.live = 1;
  }

  update(dt: number): void {
    if (!this.live) return;
    let any = 0;
    for (let i = 0; i < DROPS; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      this.left[i] = Math.max(0, this.life[i] / this.span[i]);
      const j = i * 3;
      this.vel[j + 1] -= GRAVITY * dt;
      this.at[j] += this.vel[j] * dt;
      this.at[j + 1] += this.vel[j + 1] * dt;
      this.at[j + 2] += this.vel[j + 2] * dt;
      if (this.life[i] <= 0) this.at[j + 1] = GONE;
      else any = 1;
    }
    this.live = any;
    for (const a of this.attrs) a.needsUpdate = true;
  }
}
