import * as THREE from 'three';
import { tuning } from '../../tuning';
import { ATMO_GLSL, atmo } from '../atmosphere';
import { REFLECTION_LAYER } from '../water/reflection';
import { feltWind, type WindField, type WindSample } from '../../wind/field';
import type { PointerInput } from '../../input/pointer';
import { screenBrush } from '../../creatures/motion';
import { PLANK, ROPE, merged, tagged, tube } from './shapes';

const SWING_VERT = /* glsl */ `
in float aKind;
out vec3 vWorld;
out vec3 vNormal;
out vec3 vLocal;
out float vKind;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  vNormal = mat3(modelMatrix) * normal;
  vLocal = position;
  vKind = aKind;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const SWING_FRAG = /* glsl */ `
${ATMO_GLSL}
in vec3 vWorld;
in vec3 vNormal;
in vec3 vLocal;
in float vKind;
void main() {
  vec3 n = normalize(vNormal);
  if (!gl_FrontFacing) n = -n;
  vec3 alb;
  if (vKind < ${ROPE + 0.5}) {
    /** Old hemp, twisted: a spiral of lighter and darker strands down its length. */
    float twist = sin(vLocal.y * 38.0 + atan(vLocal.z, vLocal.x) * 3.0);
    alb = vec3(0.3, 0.24, 0.16) * (0.82 + 0.18 * twist) * (0.9 + 0.2 * vnoise(vLocal.xy * 6.0));
  } else {
    float grain = vnoise(vec2(vLocal.x * 3.0, vLocal.z * 40.0)) * 0.6 + vnoise(vLocal.xz * 13.0) * 0.4;
    alb = mix(vec3(0.26, 0.18, 0.1), vec3(0.4, 0.29, 0.17), grain);
  }
  vec3 V = normalize(cameraPosition - vWorld);
  float sun = cloudShadow(vWorld.xz);
  vec3 col = alb * (hemiLight(n) + uSunColor * max(dot(n, uSunDir), 0.0) * 0.85 * sun);
  float rim = pow(1.0 - clamp(dot(n, V), 0.0, 1.0), 3.0) * pow(max(dot(-V, uSunDir), 0.0), 2.5);
  col += uSunColor * rim * sun * 0.18;
  gl_FragColor = vec4(applyFog(col, vWorld), 1.0);
}`;

/** Where a rope swing hangs and which way it swings. */
export interface SwingSpot {
  /** Where the ropes are tied round the bough. */
  pivot: THREE.Vector3;
  /** Level, the way it swings out toward the far side. */
  toward: THREE.Vector2;
  /** From the bough to the seat. */
  rope: number;
}

const SEAT_HALF = 0.36;

/**
 * A rope swing hanging from a bough over open water: two old ropes and a plank. It swings in one plane, pushed
 * along its travel by whatever gust reaches its seat, whichever way the gust is blowing, so a player who keeps at it
 * always gets height and never has to time a thing.
 */
export class RopeSwing {
  readonly group = new THREE.Group();
  readonly objects: THREE.Object3D[];
  readonly pivot = new THREE.Vector3();
  readonly toward = new THREE.Vector2();
  readonly rope: number;
  /** Radians out of true, positive toward the far side, and how fast. */
  angle = 0;
  speed = 0;
  /** Drawn out of its plane toward someone getting on, radians. */
  aside = 0;
  /** 0 empty to 1 with her on it: a loaded swing takes more pushing. */
  rider = 0;
  /** Someone has ridden it since it was last set still: empty after that, it dies away. */
  ridden = false;
  /** Held where it is by someone getting on. */
  held = false;
  /** Seconds since a stroke last crossed it on screen. */
  brushAge = Infinity;
  /** The highest it has swung toward the far side since it was last set going, radians. */
  best = 0;
  private readonly air: WindSample = { x: 0, z: 0, energy: 0, lift: 0 };
  private readonly seatAt = new THREE.Vector3();

  constructor(spot: SwingSpot) {
    this.pivot.copy(spot.pivot);
    this.toward.copy(spot.toward).normalize();
    this.rope = spot.rope;
    const L = this.rope;
    const parts = [
      tagged(new THREE.BoxGeometry(SEAT_HALF * 2 + 0.16, 0.09, 0.34).translate(0, -L - 0.01, 0), PLANK, 0, 0),
      ...[-1, 1].map((side) => tube([
        new THREE.Vector3(side * 0.06, 0.12, 0), new THREE.Vector3(side * SEAT_HALF * 0.6, -L * 0.5, 0), new THREE.Vector3(side * SEAT_HALF, -L + 0.03, 0),
      ], 0.03, 0.026, 6, ROPE, 0, 0, side)),
      ...[-1, 1].map((side) => tube([
        new THREE.Vector3(side * SEAT_HALF, -L + 0.03, -0.1), new THREE.Vector3(side * (SEAT_HALF + 0.02), -L - 0.05, 0), new THREE.Vector3(side * SEAT_HALF, -L + 0.03, 0.1),
      ], 0.028, 0.028, 5, ROPE, 0, 0, side)),
      tube([new THREE.Vector3(-0.12, 0.12, 0), new THREE.Vector3(0, 0.2, 0.03), new THREE.Vector3(0.12, 0.12, 0)], 0.045, 0.045, 6, ROPE, 0, 0, 0),
    ];
    const material = new THREE.ShaderMaterial({ vertexShader: SWING_VERT, fragmentShader: SWING_FRAG, uniforms: { ...atmo.uniforms }, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(merged(parts), material);
    mesh.frustumCulled = false;
    this.group.add(mesh);
    this.group.position.copy(this.pivot);
    this.group.rotation.order = 'YXZ';
    this.objects = [this.group];
    this.group.layers.enable(REFLECTION_LAYER);
    mesh.layers.enable(REFLECTION_LAYER);
    this.pose();
  }

  reset(): void {
    this.angle = this.speed = this.aside = this.rider = 0;
    this.held = this.ridden = false;
    this.brushAge = Infinity;
    this.best = 0;
    this.pose();
  }

  /** Where the middle of the seat is now. */
  seat(out: THREE.Vector3): THREE.Vector3 {
    return this.seatFor(this.angle, out);
  }

  seatFor(angle: number, out: THREE.Vector3): THREE.Vector3 {
    const aside = Math.sin(this.aside) * this.rope;
    const reach = this.rope * Math.sin(angle) * Math.cos(this.aside);
    return out.set(
      this.pivot.x + this.toward.x * reach + this.toward.y * aside,
      this.pivot.y - this.rope * Math.cos(angle) * Math.cos(this.aside),
      this.pivot.z + this.toward.y * reach - this.toward.x * aside);
  }

  /** The seat's velocity, units a second. */
  velocity(out: THREE.Vector3): THREE.Vector3 {
    const v = this.rope * this.speed;
    return out.set(this.toward.x * Math.cos(this.angle) * v, Math.sin(this.angle) * v, this.toward.y * Math.cos(this.angle) * v);
  }

  get gravity(): number {
    return 9.81 * tuning.crossings.swing.gravity;
  }

  /** How high this swing toward the far side will carry it, radians, if nothing more pushes it. */
  get peak(): number {
    if (this.speed <= 0) return this.angle;
    const c = Math.cos(this.angle) - (this.rope * this.speed * this.speed) / (2 * this.gravity);
    return Math.acos(THREE.MathUtils.clamp(c, -1, 1));
  }

  /** A stroke that crosses the seat or the ropes on screen lays a gust there, as on the birches' swing. */
  brush(camera: THREE.Camera, input: PointerInput, wind: WindField): void {
    if (input.muted || !input.present || input.gust < 1.4) return;
    const seat = this.seat(this.seatAt);
    let touch = screenBrush(camera, seat, input.prevNdc, input.ndc, 0.25);
    const mid = this.seatAt.lerp(this.pivot, 0.45);
    touch = Math.max(touch, screenBrush(camera, mid, input.prevNdc, input.ndc, 0.2) * 0.7);
    if (touch < 0.01) return;
    this.brushAge = 0;
    this.seat(this.seatAt);
    wind.addSplat({ source: this, ax: this.seatAt.x, az: this.seatAt.z, bx: this.seatAt.x, bz: this.seatAt.z,
      vx: input.gustDir.x * input.gust, vz: input.gustDir.y * input.gust,
      radius: 3, energy: Math.min(0.8, input.gust / 20) * Math.sqrt(touch), lift: 0, swirl: 0 });
  }

  /** A gust of the world's own at the seat, carrying `energy`. */
  blow(wind: WindField, energy: number): void {
    this.seat(this.seatAt);
    const way = this.speed >= 0 ? 1 : -1;
    wind.addSplat({ source: this, impulse: true, ax: this.seatAt.x, az: this.seatAt.z, bx: this.seatAt.x, bz: this.seatAt.z,
      vx: this.toward.x * way * 8, vz: this.toward.y * way * 8, radius: 3.5, energy, lift: 0, swirl: 0 });
  }

  update(dt: number, wind: WindField): void {
    if (dt <= 0) return;
    const k = tuning.crossings.swing;
    this.brushAge += dt;
    this.seat(this.seatAt);
    const w = feltWind(wind.sample(this.seatAt.x, this.seatAt.z, this.air), wind.calm);
    if (!this.held) {
      const load = 1 + this.rider * 0.8;
      const along = (w.x * this.toward.x + w.z * this.toward.y) - this.rope * this.speed * Math.cos(this.angle) * 0.5;
      const way = Math.abs(this.speed) > 0.03 ? Math.sign(this.speed) : Math.sign(along) || 1;
      const push = along * k.along + w.energy * k.pump * way;
      this.speed += ((-this.gravity * Math.sin(this.angle)) + push / load) / this.rope * dt;
      if (this.rider > 0) this.ridden = true;
      this.speed *= Math.exp(-dt * (this.ridden && this.rider === 0 ? k.emptyDamping : k.damping));
      this.angle += this.speed * dt;
      if (Math.abs(this.angle) > 1.25) {
        this.angle = Math.sign(this.angle) * 1.25;
        this.speed *= -0.3;
      }
      this.best = Math.max(this.best, this.angle);
      this.aside *= Math.exp(-dt * 1.5);
    }
    this.pose();
  }

  private pose(): void {
    this.group.rotation.set(-this.angle, Math.atan2(this.toward.x, this.toward.y), this.aside);
    this.group.updateMatrixWorld(true);
  }
}
