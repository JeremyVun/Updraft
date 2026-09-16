import * as THREE from 'three';
import { CREATURE_GLSL } from '../../creatures/shading';
import { ATMO_GLSL, atmo } from '../../world/atmosphere';
import { Marks, RING } from './marks';
import { Spray } from './spray';

const MAX = 8;
const GRAVITY = 9.8;
const rand = (lo: number, hi: number) => lo + (hi - lo) * Math.random();

const VERT = /* glsl */ `
${ATMO_GLSL}
${CREATURE_GLSL}
in vec4 iPos;
in vec4 iAtt;
out vec3 vWorld;
out vec3 vNormal;
out vec3 vRest;
void main() {
  vec3 p = position;
  vec3 n = normal;
  float tail = smoothstep(0.05, -0.3, position.z);
  float wag = sin(iAtt.z) * 0.5 * tail;
  p = rotY(p - vec3(0.0, 0.0, 0.05), wag) + vec3(0.0, 0.0, 0.05);
  n = rotY(n, wag);
  p = rotY(rotX(rotZ(p * iAtt.w, iAtt.y), -iAtt.x), iPos.w);
  n = rotY(rotX(rotZ(n, iAtt.y), -iAtt.x), iPos.w);
  vWorld = iPos.xyz + p;
  vNormal = n;
  vRest = position;
  gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.0);
}`;

const FRAG = /* glsl */ `
${ATMO_GLSL}
uniform vec3 uBack;
uniform vec3 uSilver;
in vec3 vWorld;
in vec3 vNormal;
in vec3 vRest;
void main() {
  vec3 N = normalize(vNormal) * (gl_FrontFacing ? 1.0 : -1.0);
  vec3 V = normalize(cameraPosition - vWorld);
  float top = smoothstep(0.02, 0.07, vRest.y + sin(vRest.z * 60.0) * 0.006);
  float fin = step(vRest.z, -0.27);
  vec3 alb = mix(uSilver, uBack, max(top, fin * 0.6));
  float sun = cloudShadow(vWorld.xz);
  vec3 R = reflect(-V, N);
  vec3 env = R.y > 0.0 ? skyColor(R) : uSkyAmbient * vec3(0.35, 0.6, 0.7);
  float mirror = (1.0 - top) * (1.0 - fin * 0.5);
  float ndl = dot(N, uSunDir);
  vec3 col = alb * (hemiLight(N) * 0.6 + uSunColor * max(ndl * 0.5 + 0.5, 0.0) * 0.45 * sun);
  col = mix(col, env * alb * 1.3, mirror * 0.7);
  col += uSunColor * pow(max(dot(R, uSunDir), 0.0), 70.0) * 8.0 * mirror * sun;
  col += uSunColor * pow(max(dot(R, uSunDir), 0.0), 8.0) * 0.7 * mirror * sun;
  gl_FragColor = vec4(applyFog(col, vWorld), 1.0);
}`;

/** A slim fish, nose along +z: a laterally flattened body, a forked tail and a little dorsal fin. */
function fishGeometry(): THREE.BufferGeometry {
  const rings = 16;
  const around = 12;
  const pos: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i <= rings; i++) {
    const t = i / rings;
    const z = 0.3 - t * 0.58;
    const h = 0.075 * Math.sin(Math.PI * Math.min(1, t ** 0.75 * 1.02)) + 0.008;
    const w = h * 0.55;
    for (let j = 0; j < around; j++) {
      const a = (j / around) * Math.PI * 2;
      pos.push(Math.sin(a) * w, Math.cos(a) * h, z);
    }
  }
  for (let i = 0; i < rings; i++) {
    for (let j = 0; j < around; j++) {
      const a = i * around + j;
      const b = i * around + ((j + 1) % around);
      idx.push(a, b, a + around, b, b + around, a + around);
    }
  }
  const fin = (points: number[][]) => {
    const base = pos.length / 3;
    for (const p of points) pos.push(p[0], p[1], p[2]);
    for (let k = 1; k < points.length - 1; k++) idx.push(base, base + k, base + k + 1);
  };
  fin([[0, 0, -0.26], [0, 0.13, -0.42], [0, 0.03, -0.36], [0, 0, -0.34], [0, -0.03, -0.36], [0, -0.13, -0.42]]);
  fin([[0, 0.07, 0.04], [0, 0.13, -0.06], [0, 0.06, -0.12]]);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

interface Leap {
  x: number;
  z: number;
  yaw: number;
  dist: number;
  height: number;
  duration: number;
  t: number;
  roll: number;
  twist: number;
  size: number;
  out: boolean;
}

/** Small silver fish leaping out of the sea in short arcs near a point, flashing the sun off their flanks. */
export class Fish {
  readonly mesh: THREE.Mesh;
  private readonly leaps: Leap[] = [];
  private readonly iPos: THREE.InstancedBufferAttribute;
  private readonly iAtt: THREE.InstancedBufferAttribute;
  private readonly geo = new THREE.InstancedBufferGeometry();
  private readonly near = new THREE.Vector3();
  private readonly probe = new THREE.Vector3();
  private readonly toCamera = new THREE.Vector3();
  private liveliness = 0;
  private hasNear = false;
  private wait = 1;
  private time = 0;

  constructor(
    private readonly camera: THREE.Camera,
    private readonly spray: Spray,
    private readonly foam: Marks,
  ) {
    const base = fishGeometry();
    this.geo.index = base.index;
    this.geo.setAttribute('position', base.attributes.position);
    this.geo.setAttribute('normal', base.attributes.normal);
    this.iPos = new THREE.InstancedBufferAttribute(new Float32Array(MAX * 4), 4).setUsage(THREE.DynamicDrawUsage);
    this.iAtt = new THREE.InstancedBufferAttribute(new Float32Array(MAX * 4), 4).setUsage(THREE.DynamicDrawUsage);
    this.geo.setAttribute('iPos', this.iPos);
    this.geo.setAttribute('iAtt', this.iAtt);
    this.geo.instanceCount = 0;
    this.mesh = new THREE.Mesh(
      this.geo,
      new THREE.ShaderMaterial({
        vertexShader: VERT,
        fragmentShader: FRAG,
        uniforms: { ...atmo.uniforms, uBack: { value: new THREE.Color('#38626b') }, uSilver: { value: new THREE.Color('#c9d3d8') } },
        side: THREE.DoubleSide,
      }),
    );
    this.mesh.frustumCulled = false;
  }

  setNear(near: THREE.Vector3 | null, liveliness: number): void {
    this.hasNear = near !== null;
    if (near) this.near.copy(near);
    this.liveliness = liveliness;
  }

  update(dt: number, time: number): void {
    this.time += dt;
    this.wait -= dt * this.liveliness;
    if (this.hasNear && this.wait <= 0) {
      this.wait = rand(1.2, 3.8);
      const leap = this.spawn();
      if (leap && Math.random() < 0.4) this.companion(leap);
    }
    let n = 0;
    const P = this.iPos.array as Float32Array;
    const A = this.iAtt.array as Float32Array;
    for (let i = this.leaps.length - 1; i >= 0; i--) {
      const f = this.leaps[i];
      f.t += dt;
      if (f.t < 0) continue;
      const u = f.t / f.duration;
      if (u >= 1) {
        this.splash(f.x + Math.sin(f.yaw) * f.dist, f.z + Math.cos(f.yaw) * f.dist, time, 0.8);
        this.leaps.splice(i, 1);
        continue;
      }
      if (!f.out && u > 0.06) {
        f.out = true;
        this.splash(f.x + Math.sin(f.yaw) * f.dist * 0.06, f.z + Math.cos(f.yaw) * f.dist * 0.06, time, 1);
      }
      const along = f.dist * u;
      const y = 4 * f.height * u * (1 - u) - 0.25;
      const vy = (4 * f.height * (1 - 2 * u)) / f.duration;
      const pitch = Math.atan2(vy, f.dist / f.duration);
      const k = n * 4;
      P[k] = f.x + Math.sin(f.yaw) * along;
      P[k + 1] = y;
      P[k + 2] = f.z + Math.cos(f.yaw) * along;
      P[k + 3] = f.yaw;
      A[k] = pitch;
      A[k + 1] = f.roll + f.twist * u;
      A[k + 2] = this.time * 22 + i;
      A[k + 3] = f.size;
      n++;
    }
    this.geo.instanceCount = n;
    this.iPos.needsUpdate = true;
    this.iAtt.needsUpdate = true;
    this.mesh.visible = n > 0;
  }

  /** Picks a spot in view around the near point and turns the fish so its flank swings through the sun's glint. */
  private spawn(): Leap | null {
    if (this.leaps.length >= MAX - 1) return null;
    for (let tries = 0; tries < 8; tries++) {
      const a = Math.random() * Math.PI * 2;
      const r = rand(5, 15);
      this.probe.set(this.near.x + Math.cos(a) * r, 0, this.near.z + Math.sin(a) * r);
      this.toCamera.copy(this.probe).project(this.camera);
      if (this.toCamera.z > 1 || Math.abs(this.toCamera.x) > 0.85 || Math.abs(this.toCamera.y) > 0.85) continue;
      const height = rand(0.55, 1.3);
      const leap: Leap = {
        x: this.probe.x,
        z: this.probe.z,
        yaw: this.glintYaw() + rand(-0.6, 0.6),
        dist: rand(1.6, 3.2),
        height,
        duration: 2 * Math.sqrt((2 * height) / GRAVITY) * 1.1,
        t: 0,
        roll: rand(-0.3, 0.2),
        twist: rand(0.6, 1.4) * (Math.random() < 0.5 ? -1 : 1),
        size: rand(1.0, 1.45),
        out: false,
      };
      this.leaps.push(leap);
      return leap;
    }
    return null;
  }

  private companion(lead: Leap): void {
    const side = rand(0.6, 1.6) * (Math.random() < 0.5 ? -1 : 1);
    this.leaps.push({
      ...lead,
      x: lead.x + Math.cos(lead.yaw) * side,
      z: lead.z - Math.sin(lead.yaw) * side,
      height: lead.height * rand(0.7, 1),
      duration: lead.duration * rand(0.85, 1),
      t: -rand(0.15, 0.5),
      twist: lead.twist * rand(0.6, 1.2),
      size: lead.size * rand(0.85, 1.05),
      out: false,
    });
  }

  /** Heading that puts the fish's flank across the half-way direction between the sun and the camera. */
  private glintYaw(): number {
    const sun = atmo.uniforms.uSunDir.value;
    this.toCamera.copy(this.camera.position).sub(this.probe).normalize().add(sun);
    return Math.atan2(this.toCamera.z, -this.toCamera.x);
  }

  private splash(x: number, z: number, time: number, strength: number): void {
    this.spray.plip(x, z, strength);
    this.foam.add(RING, x, z, 0.2, 2, time, 0.5 * strength, 0.7);
  }
}
