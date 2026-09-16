import * as THREE from 'three';
import type { WindField, WindSample } from '../wind/field';
import { ATMO_GLSL, atmo } from '../world/atmosphere';
import { heightAt } from '../world/island';

const COUNT = 260;
/** How far from the child embers are kept; any that get further away are quietly moved back in. */
const RANGE = 52;
/** Below this an ember is out, and anything brighter counts toward a light the child can follow. */
const LIT = 0.24;

const VERT = /* glsl */ `
in vec4 aSpark;
out vec2 vUv;
out float vHeat;
out vec3 vWorld;
void main() {
  vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  float size = 0.035 + aSpark.w * 0.1;
  vWorld = aSpark.xyz + (right * position.x + up * position.y) * size;
  vUv = position.xy;
  vHeat = aSpark.w;
  gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.0);
}`;

const FRAG = /* glsl */ `
${ATMO_GLSL}
in vec2 vUv;
in float vHeat;
in vec3 vWorld;
void main() {
  float r = length(vUv);
  float core = 1.0 - smoothstep(0.0, 0.3, r);
  float halo = (1.0 - smoothstep(0.05, 1.0, r)) * 0.4;
  float a = (core + halo) * vHeat;
  if (a < 0.004) discard;
  /** Hot at the heart, going red as it cools, so a dying ember reads as dying rather than as a dimmer lamp. */
  vec3 col = mix(vec3(1.0, 0.22, 0.04), vec3(1.0, 0.66, 0.26), smoothstep(0.15, 0.9, vHeat));
  vec4 f = fogOf(vWorld);
  gl_FragColor = vec4(col * (1.0 + 2.2 * vHeat) * (1.0 - f.a * 0.75), a);
}`;

interface Spark {
  p: THREE.Vector3;
  v: THREE.Vector3;
  heat: number;
  seed: number;
}

/**
 * Embers in the leaf litter of the dark wood. In every other room the wind is seen in the grass; here there is no
 * grass and no light, and the wind is seen only in what it does to fire: a gust fans a handful of sparks awake and
 * carries them, and the child walks toward wherever the player has made it bright. The light is the only path.
 */
export class Embers {
  readonly mesh: THREE.Mesh;
  /** 0 nothing showing, 1 fully awake: the story fades them in with the wood and out again with the dawn. */
  presence = 0;
  private readonly sparks: Spark[] = [];
  private readonly attr: THREE.InstancedBufferAttribute;
  private readonly sample: WindSample = { x: 0, z: 0, energy: 0, lift: 0 };
  private readonly centre = new THREE.Vector3();
  private lit = 0;

  constructor(private readonly wind: WindField) {
    const quad = new THREE.PlaneGeometry(2, 2);
    const geo = new THREE.InstancedBufferGeometry();
    geo.index = quad.index;
    geo.setAttribute('position', quad.attributes.position);
    this.attr = new THREE.InstancedBufferAttribute(new Float32Array(COUNT * 4), 4).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('aSpark', this.attr);
    geo.instanceCount = COUNT;
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
    for (let i = 0; i < COUNT; i++) {
      this.sparks.push({ p: new THREE.Vector3(), v: new THREE.Vector3(), heat: 0, seed: Math.random() * 6.28 });
    }
    this.mesh = new THREE.Mesh(
      geo,
      new THREE.ShaderMaterial({
        uniforms: atmo.uniforms,
        vertexShader: VERT,
        fragmentShader: FRAG,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
  }

  private scatter(s: Spark, near: THREE.Vector3): void {
    const a = Math.random() * Math.PI * 2;
    const r = 6 + Math.sqrt(Math.random()) * RANGE * 0.8;
    s.p.set(near.x + Math.cos(a) * r, 0, near.z + Math.sin(a) * r);
    s.p.y = Math.max(heightAt(s.p.x, s.p.z), 0) + 0.08 + Math.random() * 0.3;
    s.v.set(0, 0, 0);
    s.heat = Math.random() * 0.06;
  }

  /**
   * Where the light is, for the child to walk toward: the hot centroid of everything still burning. Returns how
   * much light there is, so the story can tell the difference between a trail worth following and one spark.
   */
  brightest(out: THREE.Vector3): number {
    if (this.lit > 0) out.copy(this.centre);
    return this.lit;
  }

  /**
   * How much fire there is within `radius` of a point. The centroid is the wrong question for "is that corner of
   * the wood lit" — a wide gust averages out to the middle of nowhere — so this asks about the corner itself.
   */
  heatNear(x: number, z: number, radius: number): number {
    if (this.presence <= 0.01) return 0;
    let sum = 0;
    const r2 = radius * radius;
    for (const s of this.sparks) {
      if (s.heat <= LIT) continue;
      const dx = s.p.x - x;
      const dz = s.p.z - z;
      if (dx * dx + dz * dz < r2) sum += s.heat - LIT;
    }
    return sum * this.presence;
  }

  update(dt: number, near: THREE.Vector3, presence: number): void {
    this.presence += (presence - this.presence) * (1 - Math.exp(-dt * 0.7));
    this.mesh.visible = this.presence > 0.01;
    if (!this.mesh.visible) {
      this.lit = 0;
      return;
    }
    const data = this.attr.array as Float32Array;
    this.centre.set(0, 0, 0);
    let weight = 0;
    for (let i = 0; i < COUNT; i++) {
      const s = this.sparks[i];
      if (s.p.distanceToSquared(near) > RANGE * RANGE * 1.6 || (s.heat < 0.02 && Math.random() < dt * 0.4)) {
        this.scatter(s, near);
      }
      const w = this.wind.sample(s.p.x, s.p.z, this.sample);
      /** A gust is what wakes them: energy is breath on a coal, and it is the only thing that makes light here. */
      s.heat = Math.min(1, s.heat + (w.energy * 2.3 + w.lift * 1.3) * dt);
      s.heat *= Math.exp(-dt * (0.16 + 0.22 * s.heat));
      const ground = Math.max(heightAt(s.p.x, s.p.z), 0);
      const drag = 1 - Math.exp(-dt * 2.4);
      s.v.x += (w.x * 0.85 - s.v.x) * drag;
      s.v.z += (w.z * 0.85 - s.v.z) * drag;
      /** Hot ones ride their own heat upward and cold ones settle back into the litter. */
      s.v.y += (w.lift * 2.2 + s.heat * 1.15 - 0.55 - s.v.y * 1.6) * dt * 2.2;
      s.p.addScaledVector(s.v, dt);
      if (s.p.y < ground + 0.06) {
        s.p.y = ground + 0.06;
        s.v.y = Math.max(0, s.v.y);
      }
      const shown = s.heat * this.presence;
      const j = i * 4;
      data[j] = s.p.x;
      data[j + 1] = s.p.y;
      data[j + 2] = s.p.z;
      data[j + 3] = shown;
      if (s.heat > LIT) {
        const k = s.heat - LIT;
        this.centre.addScaledVector(s.p, k);
        weight += k;
      }
    }
    if (weight > 0) this.centre.divideScalar(weight);
    else this.centre.copy(near);
    this.lit = weight * this.presence;
    this.attr.needsUpdate = true;
  }
}
