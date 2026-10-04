import * as THREE from 'three';
import { fixInPlace } from '../gl/fixed';
import { tuning } from '../tuning';
import type { WindField, WindSample } from '../wind/field';
import { ATMO_GLSL, atmo } from '../world/atmosphere';
import { surfaceHeight } from '../world/island';

const OPEN_COUNT = 170;
const COUNT = Math.max(OPEN_COUNT, tuning.wood.fireflyCount);
const RANGE = 42;

const VERT = /* glsl */ `
in vec4 aFly;
in float aBound;
uniform float uShelter;
out vec2 vUv;
out float vGlow;
out float vBound;
out vec3 vWorld;
void main() {
  vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  float size = mix(0.14 + aFly.w * 0.22, 0.045 + aFly.w * 0.07, uShelter);
  size = mix(size, min(size, length(aFly.xyz - cameraPosition) * 0.002), uShelter);
  size *= 1.0 + min(aBound, 1.0) * 0.9;
  if (aBound > 1.5) size = aBound - 2.0;
  vBound = aBound;
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
in float vBound;
in vec3 vWorld;
void main() {
  float r = length(vUv);
  vec4 f = fogOf(vWorld);
  if (vBound > 1.5) {
    // The soft light the gathered swarm makes together, so it reads as one lantern rather than a cloud of dots.
    float glow = exp(-r * r * 4.5) * (1.0 - smoothstep(0.7, 1.0, r));
    gl_FragColor = vec4(vec3(1.0, 0.86, 0.5) * (1.0 - f.a * 0.7), glow * vGlow * uNight);
    return;
  }
  float core = 1.0 - smoothstep(0.0, 0.35, r);
  float halo = (1.0 - smoothstep(0.1, 1.0, r)) * 0.35;
  float a = (core + halo) * vGlow * uNight;
  if (a < 0.004) discard;
  vec3 tint = mix(mix(vec3(1.0, 0.93, 0.45), vec3(0.68, 0.94, 0.48), uShelter), vec3(1.0, 0.88, 0.5), min(vBound, 1.0));
  gl_FragColor = vec4(tint * mix(3.2, 2.2, uShelter) * (1.0 - f.a * 0.7), a);
}`;

interface Fly {
  p: THREE.Vector3;
  v: THREE.Vector3;
  phase: number;
  period: number;
  seed: number;
}

/**
 * Fireflies rising out of the grass at night: they wander, blink and drift wherever the player's wind takes them.
 * Where a room asks for it (`gatherAt`), an updraft wound among them gathers them into one soft lantern that stays
 * where the circling is and drifts on the player's gusts, and lets them go again slowly when nobody tends it.
 */
export class Fireflies {
  readonly mesh: THREE.Mesh;
  /** Where the gathered swarm hangs and how much of a light it makes, 0 to 1. */
  readonly lantern = { at: new THREE.Vector3(), power: 0 };
  /** The player's updraft, while the room lets it gather them; null lets them go. */
  gatherAt: THREE.Vector3 | null = null;
  gatherCharge = 0;
  /** Lets the swarm go faster than it would on its own, once it has done what it was gathered for. */
  release = false;
  /** Keeps a gathered swarm where it is, untouched by wind and time, while the room needs its light. */
  hold = false;
  private readonly flies: Fly[] = [];
  private readonly bound = new Float32Array(COUNT);
  private readonly lanternV = new THREE.Vector3();
  private readonly bindAttr: THREE.InstancedBufferAttribute;
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
    this.attr = new THREE.InstancedBufferAttribute(new Float32Array((COUNT + 1) * 4), 4).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('aFly', this.attr);
    this.bindAttr = new THREE.InstancedBufferAttribute(new Float32Array(COUNT + 1), 1).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('aBound', this.bindAttr);
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
    fixInPlace(this.mesh);
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
    (this.mesh.geometry as THREE.InstancedBufferGeometry).instanceCount = count + 1;
    const a = this.attr.array as Float32Array;
    const bind = this.bindAttr.array as Float32Array;
    const L = tuning.wood.lantern;
    const gathering = this.gatherAt !== null && this.gatherCharge > L.chargeFrom;
    const lamp = this.lantern;
    if (gathering) {
      const k = lamp.power < 0.05 ? 1 : 1 - Math.exp(-dt * L.follow);
      lamp.at.x += (this.gatherAt!.x - lamp.at.x) * k;
      lamp.at.z += (this.gatherAt!.z - lamp.at.z) * k;
      this.lanternV.multiplyScalar(Math.exp(-dt * 3));
    } else if (lamp.power > 0.01 && !this.hold) {
      const w = this.wind.sample(lamp.at.x, lamp.at.z, this.sample);
      const k = 1 - Math.exp(-dt * L.carryResponse);
      // Only the player's gusts carry it: the storm over the canopy does not reach down here.
      this.lanternV.x += ((w.x - this.wind.breeze.x) * L.carry - this.lanternV.x) * k;
      this.lanternV.z += ((w.z - this.wind.breeze.y) * L.carry - this.lanternV.z) * k;
      lamp.at.addScaledVector(this.lanternV, dt);
    }
    lamp.at.y = surfaceHeight(lamp.at.x, lamp.at.z) + L.height + Math.sin(this.time * 0.9) * 0.08;
    const loosen = this.hold ? 0 : dt / (this.release ? L.releaseFor : L.looseFor);
    let held = 0;
    this.flies.forEach((f, i) => {
      if (i >= count) return;
      const dx = f.p.x - around.x;
      const dz = f.p.z - around.z;
      if (f.p.lengthSq() === 0 || (this.bound[i] < 0.05 && dx * dx + dz * dz > range * range)) {
        const ang = Math.random() * Math.PI * 2;
        const r = Math.sqrt(Math.random()) * range * 0.9;
        const x = around.x + Math.cos(ang) * r;
        const z = around.z + Math.sin(ang) * r;
        f.p.set(x, surfaceHeight(x, z) + 0.4 + Math.random() * 2.5, z);
      }
      if (gathering) {
        const reach = Math.hypot(f.p.x - lamp.at.x, f.p.z - lamp.at.z);
        const pull = 1 - THREE.MathUtils.smoothstep(reach, L.gatherRadius * 0.5, L.gatherRadius);
        this.bound[i] = Math.min(1, this.bound[i] + dt * this.gatherCharge * L.gatherRate * pull);
      } else {
        this.bound[i] = Math.max(0, this.bound[i] - loosen);
      }
      const b = this.bound[i];
      held += b;
      const w = this.wind.sample(f.p.x, f.p.z, this.sample);
      const t = this.time * (0.4 + f.seed * 0.5) + f.seed * 50;
      f.v.x += (Math.sin(t * 1.3) * 0.8 + w.x * (sheltered ? 0.08 : 0.7) - f.v.x) * dt * 1.5;
      f.v.z += (Math.cos(t * 1.1) * 0.8 + w.z * (sheltered ? 0.08 : 0.7) - f.v.z) * dt * 1.5;
      f.v.y += (Math.sin(t * 0.9 + 2) * 0.35 + w.lift * 3 + w.energy * 1.5 - f.v.y) * dt * 1.5;
      if (b > 0) {
        const spin = this.time * (0.7 + f.seed * 0.9) * (f.seed > 0.5 ? 1 : -1) + f.phase;
        const rad = L.orbit * (0.35 + 0.65 * ((f.seed * 7.3) % 1));
        const tx = lamp.at.x + Math.cos(spin) * rad;
        const ty = lamp.at.y + Math.sin(spin * 1.7 + f.seed * 9) * rad * 0.6;
        const tz = lamp.at.z + Math.sin(spin) * rad;
        const k = Math.min(1, b * 1.6);
        const len = Math.hypot(tx - f.p.x, ty - f.p.y, tz - f.p.z);
        const pull = Math.min(3.5, L.flySpeed / Math.max(len, 0.001));
        f.v.x += ((tx - f.p.x) * pull - f.v.x) * k;
        f.v.y += ((ty - f.p.y) * pull - f.v.y) * k;
        f.v.z += ((tz - f.p.z) * pull - f.v.z) * k;
      }
      f.p.addScaledVector(f.v, dt);
      const ground = surfaceHeight(f.p.x, f.p.z);
      f.p.y = Math.min(Math.max(f.p.y, ground + 0.3), ground + (sheltered ? 3.2 : 9));
      const blink = Math.max(0, Math.sin((this.time + f.phase) * (Math.PI * 2 / f.period))) ** 3;
      const steady = 0.7 + 0.3 * Math.sin(this.time * 2.3 + f.phase * 3);
      a[i * 4] = f.p.x;
      a[i * 4 + 1] = f.p.y;
      a[i * 4 + 2] = f.p.z;
      a[i * 4 + 3] = (blink + (steady - blink) * b) * this.presence;
      bind[i] = b;
    });
    for (let i = count; i < COUNT; i++) this.bound[i] = 0;
    lamp.power = Math.min(1, held / L.full);
    a.set([lamp.at.x, lamp.at.y, lamp.at.z, lamp.power * L.haloAlpha * this.presence], count * 4);
    bind[count] = 2 + L.haloSize * (0.6 + 0.4 * lamp.power);
    this.bindAttr.needsUpdate = true;
    this.attr.needsUpdate = true;
  }
}
