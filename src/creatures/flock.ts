import * as THREE from 'three';
import { ATMO_GLSL, atmo } from '../world/atmosphere';
import { easeAngle } from './motion';
import { CREATURE_GLSL } from './shading';
import { blob, merge, type V3 } from './shapes';

const MAX = 26;
/** How fast a skein travels when it is going somewhere. */
const SPEED = 19;

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
  /** Slate grey, the way a crane is: pale birds in a pale sky are no birds at all at this distance. */
  vec3 col = shadeCreature(vec3(0.56, 0.54, 0.53), N, vWorld, 0.9, 0.7, 0.6, 1.0);
  gl_FragColor = vec4(applyFog(col, vWorld), 1.0);
}`;

function craneShape(): THREE.BufferGeometry {
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
 * A skein of cranes going over, high up and holding its V. The reason the whole journey happens: one of them
 * cannot keep up.
 */
export class CraneFlock {
  readonly mesh: THREE.Mesh;
  private readonly place: THREE.InstancedBufferAttribute;
  private readonly beat: THREE.InstancedBufferAttribute;
  /** `slot` is where a bird is heading in the V while a gathering strings itself out; null once it is a line. */
  private readonly birds: { offset: THREE.Vector3; slot: THREE.Vector3 | null; yaw: number; phase: number; fade: number }[] = [];
  private readonly lead = new THREE.Vector3();
  private readonly dir = new THREE.Vector3(0, 0, -1);
  private flying = false;
  private speed = SPEED;
  /** Centre and radius of a thermal the flock is wheeling up, or null when it is flying a line. */
  private thermal: { x: number; z: number; r: number; base: number } | null = null;
  private turn = 0;
  /** How fast the air is carrying the whole flock upward: a thermal lifts it, a line climbs out on it. */
  private climb = 0;
  /** Set when a bird has dropped out, so the story knows where it came down. */
  readonly dropped = new THREE.Vector3();

  constructor() {
    const base = craneShape();
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

  /** What to watch the flock by: the head of the skein, or the foot of the column a gathering is turning up. */
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

  /** Where the i-th bird flies in the V: the leader in front, the rest falling back from it in pairs. */
  private slot(i: number): THREE.Vector3 {
    const side = i === 0 ? 0 : i % 2 === 0 ? 1 : -1;
    const rank = Math.ceil(i / 2);
    return new THREE.Vector3(side * rank * 3.1, (Math.random() - 0.5) * 1.6, -rank * 4.4 - Math.random() * 1.2);
  }

  /** Sends a skein over, passing above (x, z) at the given height on the given bearing, from `from` units back. */
  pass(x: number, z: number, height: number, bearing: number, count = 15, from = 115, climb = 0): void {
    this.birds.length = 0;
    const c = Math.min(count, MAX);
    for (let i = 0; i < c; i++) {
      this.birds.push({ offset: this.slot(i), slot: null, yaw: bearing, phase: Math.random() * 6.28 + i * 0.25, fade: 1 });
    }
    this.speed = SPEED;
    this.dir.set(Math.sin(bearing), 0, Math.cos(bearing));
    this.lead.set(x, height, z).addScaledVector(this.dir, -from);
    /** The skein is put away once it has flown far enough from where it came in, not from wherever one last fell. */
    this.dropped.copy(this.lead);
    this.thermal = null;
    this.climb = climb;
    this.flying = true;
    this.mesh.visible = true;
  }

  /**
   * A gathering, spiralling up a thermal the way cranes do before they go on. Meant to be understood without a
   * word: that is where the others are. `rise` is how far apart in height the column strings them — wide and
   * tall for one seen from across the meadow, short and close for one that has come down over your head — and
   * `climb` is how fast the thermal carries the whole column up.
   */
  circle(x: number, z: number, base: number, radius: number, count = 26, rise = 46, climb = 0): void {
    this.birds.length = 0;
    const c = Math.min(count, MAX);
    for (let i = 0; i < c; i++) {
      this.birds.push({
        offset: new THREE.Vector3(
          (i / c) * Math.PI * 2 + Math.random() * 0.4,
          (i / c) * rise + Math.random() * rise * 0.17,
          0.85 + Math.random() * 0.3,
        ),
        slot: null,
        yaw: 0,
        phase: Math.random() * 6.28,
        fade: 1,
      });
    }
    this.thermal = { x, z, r: radius, base };
    this.lead.set(x, base, z);
    this.turn = 0;
    this.climb = climb;
    this.flying = true;
    this.mesh.visible = true;
  }

  /**
   * The gathering goes on without the one it left behind. Each bird glides out of the wheel into its place in
   * the V, and turns onto the new heading as it gets there, so the family never cuts from one shape to the other.
   */
  goOn(bearing: number, climb: number, speed: number, time: number): void {
    const t = this.thermal;
    if (!t) return;
    this.speed = speed;
    const cy = Math.cos(bearing);
    const sy = Math.sin(bearing);
    let mid = 0;
    for (const b of this.birds) mid += b.offset.y / this.birds.length;
    this.dir.set(sy, 0, cy);
    this.lead.set(t.x, t.base + mid, t.z);
    this.dropped.copy(this.lead);
    for (const b of this.birds) {
      const a = b.offset.x + this.turn;
      const dx = t.x + Math.cos(a) * t.r * b.offset.z - this.lead.x;
      const dy = t.base + b.offset.y + Math.sin(time * 0.3 + b.phase) * 2.5 - this.lead.y;
      const dz = t.z + Math.sin(a) * t.r * b.offset.z - this.lead.z;
      b.offset.set(cy * dx - sy * dz, dy, sy * dx + cy * dz);
    }
    /** Whoever is furthest along the new heading already leads, so nobody flies back through the flock. */
    const order = this.birds.map((_, i) => i).sort((a, b) => this.birds[b].offset.z - this.birds[a].offset.z);
    order.forEach((bird, place) => (this.birds[bird].slot = this.slot(place)));
    this.thermal = null;
    this.climb = climb;
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
    t.base += this.climb * dt;
    this.lead.set(t.x, t.base, t.z);
    let drawn = 0;
    for (const b of this.birds) {
      const a = b.offset.x + this.turn;
      const x = t.x + Math.cos(a) * t.r * b.offset.z;
      const z = t.z + Math.sin(a) * t.r * b.offset.z;
      const y = t.base + b.offset.y + Math.sin(time * 0.3 + b.phase) * 2.5;
      b.yaw = a + Math.PI * 0.5;
      this.place.setXYZW(drawn, x, y, z, b.yaw);
      this.beat.setXYZW(drawn, time * 2.6 + b.phase, b.fade, 0, 0);
      drawn++;
    }
    (this.mesh.geometry as THREE.InstancedBufferGeometry).instanceCount = drawn;
    this.place.needsUpdate = true;
    this.beat.needsUpdate = true;
  }

  /**
   * The last bird in the skein loses the formation. Returns where it was when it fell out, so the colt can take
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
    this.lead.y += this.climb * dt;
    const yaw = Math.atan2(this.dir.x, this.dir.z);
    const cy = Math.cos(yaw);
    const sy = Math.sin(yaw);
    let drawn = 0;
    let anyVisible = false;
    for (const b of this.birds) {
      if (b.fade <= 0) continue;
      if (b.slot) {
        b.offset.lerp(b.slot, 1 - Math.exp(-dt * 0.5));
        b.yaw = easeAngle(b.yaw, yaw, 1.1, dt);
      } else b.yaw = yaw;
      const ox = b.offset.x * cy + b.offset.z * sy;
      const oz = -b.offset.x * sy + b.offset.z * cy;
      const x = this.lead.x + ox;
      const z = this.lead.z + oz;
      const y = this.lead.y + b.offset.y + Math.sin(time * 0.6 + b.phase) * 0.6;
      this.place.setXYZW(drawn, x, y, z, b.yaw);
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
