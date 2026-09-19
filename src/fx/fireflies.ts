import * as THREE from 'three';
import { tuning } from '../tuning';
import type { WindField, WindSample } from '../wind/field';
import { ATMO_GLSL, atmo } from '../world/atmosphere';
import { surfaceHeight } from '../world/island';

const OPEN_COUNT = 170;
const COUNT = Math.max(OPEN_COUNT, tuning.wood.fireflyCount);
const RANGE = 42;

const VERT = /* glsl */ `
in vec4 aFly;
uniform float uShelter;
out vec2 vUv;
out float vGlow;
out vec3 vWorld;
void main() {
  vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  float size = mix(0.14 + aFly.w * 0.22, 0.045 + aFly.w * 0.07, uShelter);
  size = mix(size, min(size, length(aFly.xyz - cameraPosition) * 0.002), uShelter);
  vWorld = aFly.xyz + (right * position.x + up * position.y) * size;
  vUv = position.xy;
  vGlow = aFly.w;
  gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.0);
}`;

const FRAG = /* glsl */ `
${ATMO_GLSL}
uniform float uShelter;
in vec2 vUv;
in float vGlow;
in vec3 vWorld;
void main() {
  float r = length(vUv);
  float core = 1.0 - smoothstep(0.0, 0.35, r);
  float halo = (1.0 - smoothstep(0.1, 1.0, r)) * 0.35;
  float a = (core + halo) * vGlow * uNight;
  if (a < 0.004) discard;
  vec4 f = fogOf(vWorld);
  gl_FragColor = vec4(mix(vec3(1.0, 0.93, 0.45), vec3(0.68, 0.94, 0.48), uShelter) * mix(3.2, 2.2, uShelter) * (1.0 - f.a * 0.7), a);
}`;

interface Fly {
  p: THREE.Vector3;
  v: THREE.Vector3;
  phase: number;
  period: number;
  seed: number;
}

/** Fireflies rising out of the grass at night: they wander, blink and drift wherever the player's wind takes them. */
export class Fireflies {
  readonly mesh: THREE.Mesh;
  private readonly flies: Fly[] = [];
  private readonly attr: THREE.InstancedBufferAttribute;
  private readonly sample: WindSample = { x: 0, z: 0, energy: 0, lift: 0 };
  private time = 0;
  private shelter = { value: 0 };
  private presence = 0;

  constructor(private readonly wind: WindField) {
    const quad = new THREE.PlaneGeometry(2, 2);
    const geo = new THREE.InstancedBufferGeometry();
    geo.index = quad.index;
    geo.setAttribute('position', quad.attributes.position);
    this.attr = new THREE.InstancedBufferAttribute(new Float32Array(COUNT * 4), 4).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('aFly', this.attr);
    geo.instanceCount = COUNT;
    this.mesh = new THREE.Mesh(
      geo,
      new THREE.ShaderMaterial({
        vertexShader: VERT,
        fragmentShader: FRAG,
        uniforms: { ...atmo.uniforms, uShelter: this.shelter },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 6;
    for (let i = 0; i < COUNT; i++) {
      this.flies.push({ p: new THREE.Vector3(), v: new THREE.Vector3(), phase: Math.random() * 10, period: 1.8 + Math.random() * 3, seed: Math.random() });
    }
  }

  update(dt: number, night: number, around: THREE.Vector3, sheltered = false): void {
    this.presence += (night - this.presence) * (1 - Math.exp(-dt * 2));
    this.mesh.visible = this.presence > 0.01;
    if (!this.mesh.visible) return;
    this.time += dt;
    this.shelter.value = sheltered ? 1 : 0;
    const count = sheltered ? tuning.wood.fireflyCount : OPEN_COUNT;
    const range = sheltered ? tuning.wood.fireflyRange : RANGE;
    (this.mesh.geometry as THREE.InstancedBufferGeometry).instanceCount = count;
    const a = this.attr.array as Float32Array;
    this.flies.forEach((f, i) => {
      if (i >= count) return;
      const dx = f.p.x - around.x;
      const dz = f.p.z - around.z;
      if (f.p.lengthSq() === 0 || dx * dx + dz * dz > range * range) {
        const ang = Math.random() * Math.PI * 2;
        const r = Math.sqrt(Math.random()) * range * 0.9;
        const x = around.x + Math.cos(ang) * r;
        const z = around.z + Math.sin(ang) * r;
        f.p.set(x, surfaceHeight(x, z) + 0.4 + Math.random() * 2.5, z);
      }
      const w = this.wind.sample(f.p.x, f.p.z, this.sample);
      const t = this.time * (0.4 + f.seed * 0.5) + f.seed * 50;
      f.v.x += (Math.sin(t * 1.3) * 0.8 + w.x * (sheltered ? 0.08 : 0.7) - f.v.x) * dt * 1.5;
      f.v.z += (Math.cos(t * 1.1) * 0.8 + w.z * (sheltered ? 0.08 : 0.7) - f.v.z) * dt * 1.5;
      f.v.y += (Math.sin(t * 0.9 + 2) * 0.35 + w.lift * 3 + w.energy * 1.5 - f.v.y) * dt * 1.5;
      f.p.addScaledVector(f.v, dt);
      const ground = surfaceHeight(f.p.x, f.p.z);
      f.p.y = Math.min(Math.max(f.p.y, ground + 0.3), ground + (sheltered ? 3.2 : 9));
      const blink = Math.max(0, Math.sin((this.time + f.phase) * (Math.PI * 2 / f.period))) ** 3;
      a[i * 4] = f.p.x;
      a[i * 4 + 1] = f.p.y;
      a[i * 4 + 2] = f.p.z;
      a[i * 4 + 3] = blink * this.presence;
    });
    this.attr.needsUpdate = true;
  }
}
