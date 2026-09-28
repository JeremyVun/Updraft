import * as THREE from 'three';
import { ATMO_GLSL, atmo } from './atmosphere';
import { VAPOUR_GLSL } from './cloud-vapour';
import { tuning } from '../tuning';

/** How many knots of the wisp behind the hull are kept, and how far apart they are laid, metres. */
const KNOTS = 40;
const SPACING = 0.9;

interface Knot { p: THREE.Vector3; v: THREE.Vector3; age: number; life: number; strength: number }

const VERT = /* glsl */ `
${ATMO_GLSL}
in vec3 aKnot;
in vec3 aTangent;
in vec3 aState;
out vec3 vWorld;
out vec2 vAt;
out float vAlpha;
void main() {
  // aState: which side of the ribbon (-1 or 1), how old the knot is (0 to 1 of its life), and how far along the wake.
  float age = aState.y;
  vec3 view = normalize(aKnot - cameraPosition);
  vec3 side = normalize(cross(aTangent, view) + vec3(0.0, 1e-4, 0.0));
  // Laid thin off the stern, it spreads and lifts as it goes stale, and thins away.
  float width = 0.35 + 2.4 * sqrt(age);
  vWorld = aKnot + side * aState.x * width;
  vAt = vec2(aState.z, aState.x);
  float near = smoothstep(1.2, 3.5, distance(aKnot, cameraPosition));
  vAlpha = smoothstep(0.0, 0.05, age) * pow(1.0 - age, 1.6) * near;
  gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.0);
}`;

const FRAG = /* glsl */ `
${ATMO_GLSL}
${VAPOUR_GLSL}
uniform float uStrength;
in vec3 vWorld;
in vec2 vAt;
in float vAlpha;
void main() {
  // Streaks of vapour along the wake, soft across it, torn a little as they drift.
  float across = vAt.y;
  vec2 q = vec2(vAt.x * 0.45 - uTime * 0.12, across * 1.6);
  float streak = vnoise(q) * 0.6 + vnoise(q * vec2(2.3, 2.9) + 7.1) * 0.4;
  float body = exp(-across * across * 2.6) * smoothstep(0.2, 0.75, streak + 0.25 * (1.0 - abs(across)));
  float a = body * vAlpha * uStrength;
  if (a < 0.004) discard;
  vec3 col = vapourLight(vWorld, normalize(vWorld - cameraPosition), 0.5);
  gl_FragColor = vec4(applyFog(col, vWorld), a);
}`;

/**
 * The vapour the hull lifts off the top of the cloud: a soft wisp laid off the stern that spreads, lifts a little
 * and drifts off on the air as it thins away. Nothing is thrown up; the cloud only parts, and a breath of it follows.
 */
export class CloudWake {
  readonly mesh: THREE.Mesh;
  /** The height of the cloud's top under a point, so the wisp lies just over it. */
  groundAt: (x: number, z: number) => number = () => 0;
  private readonly knots: Knot[] = [];
  private readonly knot: THREE.BufferAttribute;
  private readonly tangent: THREE.BufferAttribute;
  private readonly state: THREE.BufferAttribute;
  private readonly strength = { value: 1 };
  private head = 0;
  private readonly laid = new THREE.Vector2(1e5, 1e5);
  private along = 0;
  private readonly wind = new THREE.Vector2();

  constructor() {
    for (let i = 0; i < KNOTS; i++) this.knots.push({ p: new THREE.Vector3(0, -1e4, 0), v: new THREE.Vector3(), age: 1, life: 1, strength: 0 });
    const geometry = new THREE.BufferGeometry();
    this.knot = new THREE.Float32BufferAttribute(new Float32Array(KNOTS * 2 * 3), 3).setUsage(THREE.DynamicDrawUsage);
    this.tangent = new THREE.Float32BufferAttribute(new Float32Array(KNOTS * 2 * 3), 3).setUsage(THREE.DynamicDrawUsage);
    this.state = new THREE.Float32BufferAttribute(new Float32Array(KNOTS * 2 * 3), 3).setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(KNOTS * 2 * 3), 3));
    geometry.setAttribute('aKnot', this.knot);
    geometry.setAttribute('aTangent', this.tangent);
    geometry.setAttribute('aState', this.state);
    const index: number[] = [];
    for (let i = 0; i < KNOTS - 1; i++) {
      const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
      index.push(a, c, b, b, c, d);
    }
    geometry.setIndex(index);
    this.mesh = new THREE.Mesh(geometry, new THREE.ShaderMaterial({
      uniforms: { ...atmo.uniforms, uStrength: this.strength },
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    }));
    this.mesh.name = 'cloud-wake';
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 6;
    this.mesh.visible = false;
  }

  /** Lays a knot off the stern each time the hull has gone a little further. */
  emit(hull: { position: THREE.Vector3; yaw: number; speed: number } | null, dt: number): void {
    if (!hull || dt <= 0) return;
    const fx = Math.sin(hull.yaw), fz = Math.cos(hull.yaw);
    const x = hull.position.x - fx * 1.7, z = hull.position.z - fz * 1.7;
    const moved = Math.hypot(x - this.laid.x, z - this.laid.y);
    if (moved < SPACING) return;
    this.along += Math.min(moved, SPACING * 2);
    this.laid.set(x, z);
    const k = this.knots[this.head];
    this.head = (this.head + 1) % KNOTS;
    k.p.set(x, this.groundAt(x, z) + 0.2, z);
    // It keeps a little of the hull's way, then the air has it.
    k.v.set(fx * hull.speed * 0.15, 0.1, fz * hull.speed * 0.15);
    k.age = 0;
    k.life = tuning.stairs.wakeLife * (0.85 + 0.3 * ((this.head * 0.618) % 1));
    k.strength = Math.min(1, hull.speed / 2.5);
  }

  /** Moves everything the hull has left at once, with the hull. */
  shift(dx: number, dy: number, dz: number): void {
    for (const k of this.knots) k.p.set(k.p.x + dx, k.p.y + dy, k.p.z + dz);
    this.laid.set(this.laid.x + dx, this.laid.y + dz);
  }

  /** The air the wake drifts off on, metres a second. */
  setWind(x: number, z: number): void {
    this.wind.set(x, z);
  }

  update(dt: number): void {
    let alive = false;
    for (const k of this.knots) {
      k.age = Math.min(k.life, k.age + dt);
      if (k.age >= k.life) continue;
      alive = true;
      k.v.x += (this.wind.x - k.v.x) * (1 - Math.exp(-dt * 0.6));
      k.v.z += (this.wind.y - k.v.z) * (1 - Math.exp(-dt * 0.6));
      k.v.y *= Math.exp(-dt * 0.35);
      k.p.addScaledVector(k.v, dt);
    }
    this.mesh.visible = alive;
    if (!alive) return;
    // Oldest first along the strip, so each knot's neighbours are the ones laid just before and after it.
    for (let n = 0; n < KNOTS; n++) {
      const k = this.knots[(this.head + n) % KNOTS];
      const a = this.knots[(this.head + Math.max(0, n - 1)) % KNOTS], b = this.knots[(this.head + Math.min(KNOTS - 1, n + 1)) % KNOTS];
      let tx = b.p.x - a.p.x, ty = b.p.y - a.p.y, tz = b.p.z - a.p.z;
      const len = Math.hypot(tx, ty, tz) || 1;
      tx /= len; ty /= len; tz /= len;
      // Spent knots, and the ends of the strip, are drawn as spent, so the strip has no cut-off edge.
      const spent = k.age >= k.life || k.strength <= 0;
      const end = Math.min(1, n / 3, (KNOTS - 1 - n) / 1.5);
      const age = spent ? 1 : 1 - (1 - k.age / k.life) * end;
      for (let s = 0; s < 2; s++) {
        const v = n * 2 + s;
        this.knot.setXYZ(v, k.p.x, k.p.y, k.p.z);
        this.tangent.setXYZ(v, tx, ty, tz);
        this.state.setXYZ(v, s ? 1 : -1, age, this.along - (KNOTS - 1 - n) * SPACING);
      }
    }
    this.knot.needsUpdate = this.tangent.needsUpdate = this.state.needsUpdate = true;
  }
}
