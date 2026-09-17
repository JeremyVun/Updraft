import * as THREE from 'three';
import { ATMO_GLSL, atmo } from '../world/atmosphere';
import { CREATURE_GLSL } from './shading';
import { blob, merge, type V3 } from './shapes';

const MAX = 26;

const VERT = /* glsl */ `
${ATMO_GLSL}
${CREATURE_GLSL}
in float aPart;
in vec4 aPlace;
in vec4 aBeat;
out vec3 vWorld;
out vec3 vNormal;
out float vFade;
void main() {
  vec3 p = position;
  vec3 n = normal;
  if (aPart > 0.5) {
    /** Wings hinge at the shoulder: the tip travels furthest, and the slope tips the normal with it. */
    float span = abs(p.x) / 1.85;
    float beat = sin(aBeat.x) * 0.55 - 0.08;
    float rise = beat * pow(span, 1.3) * 1.85;
    p.y += rise;
    float slope = beat * 1.3 * pow(max(span, 0.02), 0.3) * sign(p.x);
    n = normalize(vec3(n.x - slope * n.y, n.y + slope * n.x * 0.0 + slope * 0.0, n.z) + vec3(-slope, 0.0, 0.0));
  }
  float yaw = aPlace.w;
  float cy = cos(yaw), sy = sin(yaw);
  vec3 r = vec3(cy * p.x + sy * p.z, p.y, -sy * p.x + cy * p.z);
  vec3 rn = vec3(cy * n.x + sy * n.z, n.y, -sy * n.x + cy * n.z);
  vWorld = aPlace.xyz + r;
  vNormal = normalize(rn);
  vFade = aBeat.y;
  gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.0);
}`;

const FRAG = /* glsl */ `
${ATMO_GLSL}
${CREATURE_GLSL}
in vec3 vWorld;
in vec3 vNormal;
in float vFade;
void main() {
  if (vFade <= 0.01) discard;
  vec3 N = normalize(vNormal);
  vec3 col = shadeCreature(vec3(0.72, 0.68, 0.64), N, vWorld, 0.9, 0.7, 0.6, 1.0);
  gl_FragColor = vec4(applyFog(col, vWorld), 1.0);
}`;

function swanShape(): THREE.BufferGeometry {
  const at: V3 = [0, 0, 0];
  const parts = [
    blob({ part: 0, mat: 0, at, size: [0.11, 0.1, 0.62], detail: 1, shape: (u) => { u.z *= 1 + Math.max(0, u.z) * 0.5; } }),
    blob({ part: 0, mat: 0, at, size: [0.05, 0.05, 0.3], offset: [0, 0.02, 0.62], detail: 1 }),
    blob({ part: 1, mat: 0, at, size: [0.9, 0.018, 0.2], offset: [0.92, 0, -0.04], detail: 1, shape: (u) => { u.z *= 1 - Math.abs(u.x) * 0.55; } }),
    blob({ part: 2, mat: 0, at, size: [0.9, 0.018, 0.2], offset: [-0.92, 0, -0.04], detail: 1, shape: (u) => { u.z *= 1 - Math.abs(u.x) * 0.55; } }),
  ];
  return merge(parts);
}

/**
 * A skein of swans going over, high up and holding its V. The reason the whole journey happens: one of them
 * cannot keep up.
 */
export class SwanFlock {
  readonly mesh: THREE.Mesh;
  private readonly place: THREE.InstancedBufferAttribute;
  private readonly beat: THREE.InstancedBufferAttribute;
  private readonly birds: { offset: THREE.Vector3; phase: number; fade: number }[] = [];
  private readonly lead = new THREE.Vector3();
  private readonly dir = new THREE.Vector3(0, 0, -1);
  private flying = false;
  private readonly speed = 19;
  /** Centre and radius of a thermal the flock is wheeling up, or null when it is flying a line. */
  private thermal: { x: number; z: number; r: number; base: number } | null = null;
  private turn = 0;
  /** Set when a bird has dropped out, so the story knows where it came down. */
  readonly dropped = new THREE.Vector3();

  constructor() {
    const base = swanShape();
    const geo = new THREE.InstancedBufferGeometry();
    geo.index = base.index;
    for (const [name, attr] of Object.entries(base.attributes)) geo.setAttribute(name, attr);
    this.place = new THREE.InstancedBufferAttribute(new Float32Array(MAX * 4), 4);
    this.beat = new THREE.InstancedBufferAttribute(new Float32Array(MAX * 4), 4);
    this.place.setUsage(THREE.DynamicDrawUsage);
    this.beat.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('aPlace', this.place);
    geo.setAttribute('aBeat', this.beat);
    geo.instanceCount = 0;
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
    this.mesh = new THREE.Mesh(
      geo,
      new THREE.ShaderMaterial({ uniforms: atmo.uniforms, vertexShader: VERT, fragmentShader: FRAG }),
    );
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
  }

  get active(): boolean {
    return this.flying;
  }

  /** The bearing the skein is flying, so a bird that falls out of it keeps its line for a moment. */
  get heading(): number {
    return Math.atan2(this.dir.x, this.dir.z);
  }

  /** Where the head of the skein is, for the child to watch it go over. */
  get head(): THREE.Vector3 {
    return this.lead;
  }

  /** Where the bird at the back of the V is: the one that will fall out. */
  tail(out: THREE.Vector3): THREE.Vector3 {
    const last = this.birds[this.birds.length - 1];
    if (!last) return out.copy(this.lead);
    const yaw = Math.atan2(this.dir.x, this.dir.z);
    const cy = Math.cos(yaw);
    const sy = Math.sin(yaw);
    return out.set(
      this.lead.x + last.offset.x * cy + last.offset.z * sy,
      this.lead.y + last.offset.y,
      this.lead.z - last.offset.x * sy + last.offset.z * cy,
    );
  }

  /** Sends a skein over, passing above (x, z) at the given height on the given bearing, from `from` units back. */
  pass(x: number, z: number, height: number, bearing: number, count = 15, from = 115): void {
    this.birds.length = 0;
    const c = Math.min(count, MAX);
    for (let i = 0; i < c; i++) {
      const side = i === 0 ? 0 : i % 2 === 0 ? 1 : -1;
      const rank = Math.ceil(i / 2);
      this.birds.push({
        offset: new THREE.Vector3(side * rank * 3.1, (Math.random() - 0.5) * 1.6, -rank * 4.4 - Math.random() * 1.2),
        phase: Math.random() * 6.28 + rank * 0.5,
        fade: 1,
      });
    }
    this.dir.set(Math.sin(bearing), 0, Math.cos(bearing));
    this.lead.set(x, height, z).addScaledVector(this.dir, -from);
    /** The skein is put away once it has flown far enough from where it came in, not from wherever one last fell. */
    this.dropped.copy(this.lead);
    this.thermal = null;
    this.flying = true;
    this.mesh.visible = true;
  }

  /**
   * A gathering, spiralling up a thermal the way the flock does before they go on. Meant to be understood without a
   * word: that is where the others are. `rise` is how far the column climbs — wide and tall for one seen from
   * across the meadow, short and close for one that has come down over your head.
   */
  circle(x: number, z: number, base: number, radius: number, count = 26, rise = 46): void {
    this.birds.length = 0;
    const c = Math.min(count, MAX);
    for (let i = 0; i < c; i++) {
      this.birds.push({
        offset: new THREE.Vector3(
          (i / c) * Math.PI * 2 + Math.random() * 0.4,
          (i / c) * rise + Math.random() * rise * 0.17,
          0.85 + Math.random() * 0.3,
        ),
        phase: Math.random() * 6.28,
        fade: 1,
      });
    }
    this.thermal = { x, z, r: radius, base };
    this.lead.set(x, base, z);
    this.turn = 0;
    this.flying = true;
    this.mesh.visible = true;
  }

  /** Stops whatever the flock is doing and puts it away. */
  clear(): void {
    this.flying = false;
    this.thermal = null;
    this.mesh.visible = false;
    (this.mesh.geometry as THREE.InstancedBufferGeometry).instanceCount = 0;
  }

  /** Birds strung round a rising spiral: angle in offset.x, height in offset.y, radius scale in offset.z. */
  private wheel(dt: number, time: number): void {
    const t = this.thermal!;
    this.turn += dt * 0.22;
    let drawn = 0;
    for (const b of this.birds) {
      const a = b.offset.x + this.turn;
      const x = t.x + Math.cos(a) * t.r * b.offset.z;
      const z = t.z + Math.sin(a) * t.r * b.offset.z;
      const y = t.base + b.offset.y + Math.sin(time * 0.3 + b.phase) * 2.5;
      this.place.setXYZW(drawn, x, y, z, a + Math.PI * 0.5);
      this.beat.setXYZW(drawn, time * 2.6 + b.phase, b.fade, 0, 0);
      drawn++;
    }
    (this.mesh.geometry as THREE.InstancedBufferGeometry).instanceCount = drawn;
    this.place.needsUpdate = true;
    this.beat.needsUpdate = true;
  }

  /**
   * The last bird in the skein loses the formation. Returns where it was when it fell out, so the cygnet can take
   * over from exactly that point in the sky and come down in view.
   */
  dropOne(out: THREE.Vector3): boolean {
    const last = this.birds[this.birds.length - 1];
    if (!last || last.fade <= 0) return false;
    const yaw = Math.atan2(this.dir.x, this.dir.z);
    const cy = Math.cos(yaw);
    const sy = Math.sin(yaw);
    out.set(
      this.lead.x + last.offset.x * cy + last.offset.z * sy,
      this.lead.y + last.offset.y,
      this.lead.z - last.offset.x * sy + last.offset.z * cy,
    );
    last.fade = 0;
    this.dropped.copy(out);
    return true;
  }

  update(dt: number, time: number): void {
    if (!this.flying) return;
    if (this.thermal) {
      this.wheel(dt, time);
      return;
    }
    this.lead.addScaledVector(this.dir, this.speed * dt);
    const yaw = Math.atan2(this.dir.x, this.dir.z);
    const cy = Math.cos(yaw);
    const sy = Math.sin(yaw);
    let drawn = 0;
    let anyVisible = false;
    for (const b of this.birds) {
      if (b.fade <= 0) continue;
      const ox = b.offset.x * cy + b.offset.z * sy;
      const oz = -b.offset.x * sy + b.offset.z * cy;
      const x = this.lead.x + ox;
      const z = this.lead.z + oz;
      const y = this.lead.y + b.offset.y + Math.sin(time * 0.6 + b.phase) * 0.6;
      this.place.setXYZW(drawn, x, y, z, yaw);
      this.beat.setXYZW(drawn, time * 3.4 + b.phase, b.fade, 0, 0);
      drawn++;
      anyVisible = true;
    }
    (this.mesh.geometry as THREE.InstancedBufferGeometry).instanceCount = drawn;
    this.place.needsUpdate = true;
    this.beat.needsUpdate = true;
    if (!anyVisible || this.lead.distanceToSquared(this.dropped) > 1400 * 1400) {
      this.flying = false;
      this.mesh.visible = false;
    }
  }
}
