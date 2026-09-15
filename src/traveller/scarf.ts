import * as THREE from 'three';
import type { WindSample } from '../wind/field';
import { ATMO_GLSL, atmo } from '../world/atmosphere';
import { PALETTE } from './body';

const POINTS = 15;
const SEGMENT = 0.16;
const WIDTH = 0.2;

const VERT = /* glsl */ `
in float aAlong;
out vec3 vWorld;
out vec3 vNormal;
out float vAlong;
void main() {
  vWorld = position;
  vNormal = normal;
  vAlong = aAlong;
  gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0);
}`;

const FRAG = /* glsl */ `
${ATMO_GLSL}
uniform vec3 uColor;
uniform vec3 uGroundPos;
in vec3 vWorld;
in vec3 vNormal;
in float vAlong;
void main() {
  vec3 N = normalize(vNormal) * (gl_FrontFacing ? 1.0 : -1.0);
  vec3 V = normalize(cameraPosition - vWorld);
  float ndl = dot(N, uSunDir);
  float sun = groundAt(uGroundPos.xz).w * cloudShadow(uGroundPos.xz);
  float through = max(-ndl, 0.0) * 0.9 + pow(max(dot(-V, uSunDir), 0.0), 3.0) * 0.6;
  float stripe = step(0.5, fract(vAlong * 5.0)) * 0.08;
  vec3 alb = uColor * (1.0 - stripe);
  vec3 col = alb * (hemiLight(N) + uSunColor * (max(ndl, 0.0) * 0.8 + through) * sun);
  gl_FragColor = vec4(applyFog(col, vWorld), 1.0);
}`;

/** The long red scarf: a chain of points blown by the wind field, drawn as a two-sided ribbon. */
export class Scarf {
  readonly mesh: THREE.Mesh;
  private readonly pts: THREE.Vector3[] = [];
  private readonly prev: THREE.Vector3[] = [];
  private readonly positions = new Float32Array(POINTS * 2 * 3);
  private readonly normals = new Float32Array(POINTS * 2 * 3);
  private readonly geo = new THREE.BufferGeometry();
  private readonly tmp = new THREE.Vector3();
  private readonly dir = new THREE.Vector3();
  private readonly side = new THREE.Vector3();
  private readonly n = new THREE.Vector3();
  private readonly material: THREE.ShaderMaterial;
  private time = 0;

  constructor() {
    for (let i = 0; i < POINTS; i++) {
      this.pts.push(new THREE.Vector3(0, -i * SEGMENT, 0));
      this.prev.push(new THREE.Vector3(0, -i * SEGMENT, 0));
    }
    const along = new Float32Array(POINTS * 2);
    const index: number[] = [];
    for (let i = 0; i < POINTS; i++) {
      along[i * 2] = along[i * 2 + 1] = i / (POINTS - 1);
      if (i < POINTS - 1) {
        const a = i * 2;
        index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('normal', new THREE.BufferAttribute(this.normals, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('aAlong', new THREE.BufferAttribute(along, 1));
    this.geo.setIndex(index);
    this.material = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: { ...atmo.uniforms, uColor: { value: PALETTE.scarf }, uGroundPos: { value: new THREE.Vector3() } },
      side: THREE.DoubleSide,
    });
    this.mesh = new THREE.Mesh(this.geo, this.material);
    this.mesh.frustumCulled = false;
  }

  /** Snaps the whole scarf to hang from `anchor` (after teleporting the child). */
  reset(anchor: THREE.Vector3): void {
    this.pts.forEach((p, i) => p.copy(anchor).add(this.tmp.set(0, -i * SEGMENT * 0.7, -i * SEGMENT * 0.7)));
    this.prev.forEach((p, i) => p.copy(this.pts[i]));
  }

  /**
   * `anchor` is the knot at the neck, `bodyCentre` and `bodyRadius` keep the scarf outside the child,
   * `wind` is the air at the child, `ground` the surface height below.
   */
  update(dt: number, anchor: THREE.Vector3, bodyCentre: THREE.Vector3, bodyRadius: number, wind: WindSample, ground: number, groundPos: THREE.Vector3): void {
    this.time += dt;
    const h = Math.min(dt, 1 / 30);
    const speed = Math.hypot(wind.x, wind.z);
    const gust = Math.min(1, speed / 14 + wind.energy * 0.5);
    this.pts[0].copy(anchor);
    this.prev[0].copy(anchor);
    for (let i = 1; i < POINTS; i++) {
      const p = this.pts[i];
      const q = this.prev[i];
      const f = i / (POINTS - 1);
      const flutter = Math.sin(this.time * (7 + gust * 9) - i * 0.9) * (0.4 + gust * 2.4) * f;
      const ax = (wind.x * 1.6 - (p.x - q.x) / h) * 1.8 + flutter * -wind.z * 0.2;
      const az = (wind.z * 1.6 - (p.z - q.z) / h) * 1.8 + flutter * wind.x * 0.2;
      const ay = -5.5 + gust * 4.5 + wind.lift * 5 + Math.sin(this.time * 5.3 + i * 1.3) * (0.6 + gust * 2.2) * f;
      this.tmp.copy(p);
      p.x += (p.x - q.x) * 0.965 + ax * h * h;
      p.y += (p.y - q.y) * 0.965 + ay * h * h;
      p.z += (p.z - q.z) * 0.965 + az * h * h;
      q.copy(this.tmp);
    }
    for (let k = 0; k < 5; k++) {
      this.pts[0].copy(anchor);
      for (let i = 1; i < POINTS; i++) {
        const a = this.pts[i - 1];
        const b = this.pts[i];
        this.dir.subVectors(b, a);
        const len = this.dir.length() || 1e-5;
        b.copy(a).addScaledVector(this.dir, SEGMENT / len);
        this.tmp.subVectors(b, bodyCentre);
        const d = this.tmp.length();
        if (d < bodyRadius) b.copy(bodyCentre).addScaledVector(this.tmp, bodyRadius / Math.max(d, 1e-4));
        if (b.y < ground + 0.04) b.y = ground + 0.04;
      }
    }
    this.writeRibbon();
    this.material.uniforms.uGroundPos.value.copy(groundPos);
  }

  private writeRibbon(): void {
    for (let i = 0; i < POINTS; i++) {
      const a = this.pts[Math.max(0, i - 1)];
      const b = this.pts[Math.min(POINTS - 1, i + 1)];
      this.dir.subVectors(b, a).normalize();
      this.side.set(-this.dir.z, 0, this.dir.x);
      if (this.side.lengthSq() < 1e-4) this.side.set(1, 0, 0);
      this.side.normalize();
      const twist = Math.sin(this.time * 3 + i * 0.5) * 0.5;
      this.side.applyAxisAngle(this.dir, twist);
      this.n.crossVectors(this.dir, this.side).normalize();
      const w = WIDTH * (i === 0 ? 0.6 : 1 - (i / POINTS) * 0.15) * 0.5;
      const p = this.pts[i];
      for (let s = 0; s < 2; s++) {
        const o = (i * 2 + s) * 3;
        const sign = s === 0 ? -1 : 1;
        this.positions[o] = p.x + this.side.x * w * sign;
        this.positions[o + 1] = p.y + this.side.y * w * sign;
        this.positions[o + 2] = p.z + this.side.z * w * sign;
        this.normals[o] = this.n.x;
        this.normals[o + 1] = this.n.y;
        this.normals[o + 2] = this.n.z;
      }
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.normal.needsUpdate = true;
  }
}
