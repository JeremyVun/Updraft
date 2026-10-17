import * as THREE from 'three';
import type { Traveller } from '../traveller/traveller';
import { tuning } from '../tuning';
import { RibbonBatch, type Ribbon } from '../fx/ribbons';
import { feltWind, type WindField, type WindSample } from '../wind/field';
import { ATMO_GLSL, atmo } from '../world/atmosphere';
import { GRASS_LINE, heightAt } from '../world/island';
import { STILL_CENTRE } from '../world/geography';

const PAPER_VERT = /* glsl */ `
${ATMO_GLSL}
in vec2 aPaper;
out vec3 vWorld;
out vec3 vNormal;
out vec2 vPaper;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  vNormal = normalize(mat3(modelMatrix) * normal);
  vPaper = aPaper;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const PAPER_FRAG = /* glsl */ `
${ATMO_GLSL}
uniform float uSodden;
in vec3 vWorld;
in vec3 vNormal;
in vec2 vPaper;
void main() {
  vec3 V = normalize(cameraPosition - vWorld);
  vec3 N = normalize(vNormal) * (gl_FrontFacing ? 1.0 : -1.0);
  vec3 alb = vec3(0.96, 0.93, 0.87);
  /** Wet paper: dark, blotched and heavy, and it stops glowing when the light is behind it. */
  alb = mix(alb, vec3(0.19, 0.185, 0.175) * (0.75 + 0.5 * vnoise(vPaper * 7.0)), uSodden);
  float ruled = 1.0 - smoothstep(0.0, 0.05, abs(fract(vPaper.y * 9.0) - 0.5) - 0.42);
  alb = mix(alb, vec3(0.55, 0.7, 0.95), ruled * 0.3);
  float margin = 1.0 - smoothstep(0.0, 0.025, abs(vPaper.x - 0.72));
  alb = mix(alb, vec3(0.95, 0.45, 0.45), margin * 0.35);
  float ndl = dot(N, uSunDir);
  float through = max(-ndl, 0.0) * 0.45 * (1.0 - uSodden);
  float rim = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 3.0);
  vec3 col = alb * (hemiLight(N) * 1.1 + uSunColor * (max(ndl, 0.0) * 0.7 + through)) + uSunColor * rim * 0.22;
  /** Paper held against a child in bed: it takes the room's own light, and the lamp on the side turned to it. */
  col += alb * (emberLight(vWorld, N) + dawnLight(vWorld, N) + lanternLight(vWorld, N));
  if (uLamp.w > 0.0) {
    vec3 toLamp = uLamp.xyz - vWorld;
    float lampSide = clamp(dot(N, toLamp) * inversesqrt(max(dot(toLamp, toLamp), 1e-4)) * 0.5 + 0.5, 0.0, 1.0);
    col += alb * lampLight(vWorld, N) * pow(lampSide, 3.0);
  }
  col = applyFog(col, vWorld);
  gl_FragColor = vec4(col, 1.0);
}`;

const SHADOW_FRAG = /* glsl */ `
uniform float uOpacity;
in vec2 vUv;
void main() {
  float r = length(vUv - 0.5) * 2.0;
  gl_FragColor = vec4(0.04, 0.08, 0.1, uOpacity * (1.0 - smoothstep(0.2, 1.0, r)));
}`;

/** The folded paper's triangles, in its own units before it is scaled: both wings, and the keel folded under them. */
export const PAPER_TRIANGLES: readonly (readonly [number, number, number])[][] = (() => {
  const nose = [0, 0, 1.5] as const;
  const tail = [0, 0.02, -0.95] as const;
  const left = [-1.15, 0.16, -0.95] as const;
  const right = [1.15, 0.16, -0.95] as const;
  const keel = [0, -0.34, -0.8] as const;
  return [[nose, tail, left], [nose, right, tail], [nose, keel, tail], [nose, tail, keel]];
})();

/** The tip of its nose, in its own units. */
export const PAPER_NOSE = new THREE.Vector3(...PAPER_TRIANGLES[0][0]);

function paperPlane(): THREE.BufferGeometry {
  const tris = PAPER_TRIANGLES.flat();
  const pos = new Float32Array(tris.flat());
  const paper = new Float32Array(tris.flatMap(([x, y, z]) => [0.5 + x * 0.4 + (y < -0.1 ? 0.3 : 0), 0.5 + z * 0.4]));
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aPaper', new THREE.BufferAttribute(paper, 2));
  geo.computeVertexNormals();
  return geo;
}

const SCALE = 0.85;
/** The pinch point on the centre fold, below the wings and forward of the tail. */
export const PAPER_GRIP = new THREE.Vector3(0, -0.2, -0.45);
/** How long a wingtip trail lingers in the air, and the most of the air it strings across, metres. */
const TRAIL_SECONDS = 1.6;
const TRAIL_REACH = 7;
/**
 * How a plane that is let go leaves: ground speed along its heading, how firmly it holds that against the air
 * (per second), and a climb rate, or null to keep its own lift.
 */
export interface Departure { speed: number; grip: number; rise: number | null }
const HOME_DEPARTURE: Departure = { speed: 9, grip: 0.6, rise: null };

/** A paper glider carried by the wind. It glides forward, sinks slowly, rides gusts and updrafts, and never leaves the island for long. */
export class Glider {
  readonly group = new THREE.Group();
  readonly trails: RibbonBatch;
  readonly position = new THREE.Vector3();
  readonly velocity = new THREE.Vector3();
  /** How much the wind is currently lifting the glider, 0..1 (for sound). */
  lift = 0;
  airborne = true;
  /** In the child's hand: no physics, placed each frame by `hold`. */
  held = false;
  /** Seconds it has lain still since it last flew. */
  restTime = 0;
  /** Set once it has been let go at the end: it climbs away along this heading and never comes back. */
  departing: THREE.Vector3 | null = null;
  private departure: Departure = HOME_DEPARTURE;
  /** How wet it is, 0 dry to 1 sodden: the storm soaks it and the player's wind dries it out again. */
  readonly soggy = { value: 0 };
  /**
   * Where the game would like the player to go next. The plane leans that way as it flies and banks back to it
   * when it strays past `homeRadius`, so following it is the same thing as getting on with the story.
   */
  readonly home = new THREE.Vector3(STILL_CENTRE.x, 0, STILL_CENTRE.z);
  homeRadius = 50;
  /** A walking destination: let gestures play, but do not let the prevailing breeze choose the route. */
  guided = false;
  private settlingAt: THREE.Vector3 | null = null;
  /** Optional walking companion. The chapter clears this for authored scenes and sailing. */
  companion: THREE.Vector3 | null = null;
  private waiting = false;
  private waitBlend = 0;
  private turnSide = 1;
  /** A chapter may offer a landing surface over water; null keeps the shared terrain and sea behaviour. */
  landingGround: ((x: number, z: number) => number | null) | null = null;
  /** Inland water is also unreachable by the child, even when its bed is above sea level. */
  water: { level: number; over(x: number, z: number): boolean } | null = null;
  /**
   * A chapter may keep play on the side of a line the camera can follow: `back` points into play and the line lies
   * `at` along it. Gusts lose their hold on the plane as it nears the line, and one that comes down beyond is lifted home.
   */
  playEdge: { back: THREE.Vector2; at: number } | null = null;
  /** False while it is down on the water, where the child cannot go and fetch it. */
  private aground = true;
  private readonly body: THREE.Mesh;
  private readonly shadow: THREE.Mesh;
  private readonly shadowMat: THREE.ShaderMaterial;
  private carrier: Traveller | null = null;
  /** Set down by hand rather than landed from flight, it keeps the size it is carried at. */
  keptSmall = false;
  private reception: {
    child: Traveller; from: THREE.Vector3; tangent: THREE.Vector3; at: THREE.Vector3;
    rotation: THREE.Quaternion; flight: THREE.Quaternion;
    scale: number; yaw: number; duration: number; time: number;
    phase: 'approach' | 'catch' | 'recover';
  } | null = null;
  private readonly gripOffset = new THREE.Vector3();
  private readonly catchTilt = new THREE.Quaternion();
  private catchTurn = 0;
  /** A story object resting in the world until picked up (the wet paper in the wood). */
  private restingAt: THREE.Vector3 | null = null;
  private pinned = false;
  private readonly restingRotation = new THREE.Euler();
  private readonly heldRotation = new THREE.Quaternion();
  private readonly releasedRotation = new THREE.Quaternion();
  private releaseBlend = 0;
  private yaw = 0.6;
  private bank = 0;
  private pitch = 0;
  private wobble = 0;
  /** Energy from a throw or a push, spent over a few seconds as lift. */
  private thrust = 0;
  private readonly sample: WindSample = { x: 0, z: 0, energy: 0, lift: 0 };
  private readonly prev = new THREE.Vector3();
  private readonly tipL: Ribbon = { points: [], alpha: 0.35, width: 0.12 };
  private readonly tipR: Ribbon = { points: [], alpha: 0.35, width: 0.12 };
  /** When each trail point was laid, so a fast plane's trail stays short instead of stringing back to where it was thrown. */
  private readonly laid = new Map<Ribbon, number[]>([
    [this.tipL, []],
    [this.tipR, []],
  ]);
  private clock = 0;
  private readonly scratch = new THREE.Vector3();

  constructor(
    private readonly wind: WindField,
    private readonly obstacles: { centre: THREE.Vector3; radius: number }[],
  ) {
    const mat = new THREE.ShaderMaterial({
      vertexShader: PAPER_VERT,
      fragmentShader: PAPER_FRAG,
      uniforms: { ...atmo.uniforms, uSodden: this.soggy },
      side: THREE.DoubleSide,
    });
    this.body = new THREE.Mesh(paperPlane(), mat);
    this.body.scale.setScalar(SCALE);
    this.group.add(this.body);

    this.shadowMat = new THREE.ShaderMaterial({
      vertexShader: /* glsl */ `out vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: SHADOW_FRAG,
      uniforms: { uOpacity: { value: 0.3 } },
      transparent: true,
      depthWrite: false,
    });
    const sg = new THREE.PlaneGeometry(2.4, 2.4);
    sg.rotateX(-Math.PI / 2);
    this.shadow = new THREE.Mesh(sg, this.shadowMat);
    this.shadow.renderOrder = 4;

    this.trails = new RibbonBatch(120, '#ffffff');
    this.reset();
  }

  get objects(): THREE.Object3D[] {
    return [this.group, this.shadow, this.trails.mesh];
  }

  reset(): void {
    this.position.set(this.home.x, Math.max(heightAt(this.home.x, this.home.z), 0) + 9, this.home.z);
    this.velocity.set(2, 0, -1);
    this.prev.copy(this.position);
  }

  get landed(): boolean {
    return !this.pinned && !this.held && this.restTime > 1.2 && this.aground;
  }

  /** Held by the keel, or secured to the satchel when the child's arms are occupied. */
  hold(child: Traveller): void {
    this.settlingAt = null;
    this.guided = false;
    this.pinned = false;
    this.restingAt = null;
    this.carrier = child;
    child.carryingPlane = true;
    this.releaseBlend = 0;
    this.held = true;
    this.restTime = 0;
    this.departing = null;
    this.velocity.set(0, 0, 0);
    this.yaw = child.yaw;
    this.lift = 0;
    this.placeHeld();
  }

  launch(from: THREE.Vector3, velocity: THREE.Vector3): void {
    this.cancelReturn();
    this.settlingAt = null;
    this.pinned = false;
    this.restingAt = null;
    /** Release from the paper's actual centre, so the keel offset does not become a jump. */
    const carried = this.held;
    if (carried) {
      this.releasedRotation.copy(this.group.quaternion);
      this.releaseBlend = 1;
    }
    if (this.carrier) this.carrier.carryingPlane = false;
    this.carrier = null;
    this.held = false;
    this.restTime = 0;
    /** A new flight is never still the old one: the ending asks for `depart` again after it launches. */
    this.departing = null;
    if (!carried) this.position.copy(from);
    this.prev.copy(this.position);
    this.velocity.copy(velocity);
    this.thrust = velocity.length();
    this.yaw = Math.atan2(velocity.x, velocity.z);
    this.tipL.points.length = 0;
    this.tipR.points.length = 0;
    for (const laid of this.laid.values()) laid.length = 0;
  }

  /** Lay paper in the leaves. Wind can reveal it without turning the pickup into a moving target. */
  layDown(at: THREE.Vector3): void {
    this.launch(at, new THREE.Vector3());
    this.restingAt = at.clone();
    this.position.copy(at);
    this.restTime = 0;
    this.aground = true;
    this.airborne = false;
    this.lift = 0;
    this.restingRotation.set(-0.05, this.yaw, 0.12);
    this.trails.update([]);
  }

  /** An authored snag or heavy fall owns the pose; residual wind cannot turn it into free flight. */
  pin(at: THREE.Vector3, rotation: THREE.Euler): void {
    if (!this.restingAt) this.layDown(at);
    this.pinned = true;
    this.restingAt!.copy(at);
    this.position.copy(at);
    this.restingRotation.copy(rotation);
    this.restTime = 0;
    this.airborne = true;
  }

  depart(heading: THREE.Vector3, departure: Departure = HOME_DEPARTURE): void {
    this.cancelReturn();
    this.settlingAt = null;
    this.departing = heading.clone().normalize();
    this.departure = departure;
  }

  /** Finish an arrival by flying down to a fixed, reachable pickup spot. Never teleport the paper. */
  settleAt(at: THREE.Vector3): void {
    this.settlingAt = at.clone();
    this.companion = null;
    this.guided = true;
  }

  get visible(): boolean {
    return this.group.visible;
  }

  get returning(): boolean { return this.reception !== null; }

  returnTo(child: Traveller): void {
    if (this.held || this.reception) return;
    const k = tuning.planeCatch;
    const direction = this.position.clone().sub(child.position).setY(0);
    if (direction.lengthSq() < 0.01) direction.set(Math.sin(child.yaw), 0, Math.cos(child.yaw));
    direction.normalize();
    const at = child.position.clone().addScaledVector(direction, k.approachDistance);
    at.add(new THREE.Vector3(direction.z, 0, -direction.x).multiplyScalar(k.hand[0]));
    at.y = Math.max(child.position.y + k.approachHeight,
      (this.landingGround?.(at.x, at.z) ?? heightAt(at.x, at.z)) + k.groundClearance);
    const duration = Math.max(k.minApproachSeconds, this.position.distanceTo(at) / k.speed);
    const tangent = this.velocity.clone().multiplyScalar(duration);
    tangent.clampLength(0, Math.min(this.position.distanceTo(at) * 0.4, this.position.distanceTo(child.position) * 0.5));
    const yaw = Math.atan2(direction.x, direction.z);
    this.reception = { child, from: this.position.clone(), tangent, at,
      rotation: this.group.quaternion.clone(),
      flight: new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw + Math.PI, 0.12, 'YXZ')),
      scale: this.body.scale.x, yaw,
      duration, time: 0, phase: 'approach' };
    this.catchTurn = k.wristTurn;
    this.settlingAt = this.restingAt = null;
    this.companion = null;
    this.pinned = false;
    child.stop();
    child.standUp();
    child.stowPlane(false, true);
  }

  private cancelReturn(): void {
    this.reception?.child.reachFor(0, null);
    this.reception = null;
    this.catchTurn = 0;
  }

  private updateReturn(dt: number): void {
    const r = this.reception!, c = r.child, k = tuning.planeCatch;
    r.time += dt;
    c.faceToward(c.position.x + Math.sin(r.yaw), c.position.z + Math.cos(r.yaw), 1 - Math.exp(-dt * k.turnRate));
    this.prev.copy(this.position);
    if (r.phase === 'recover') {
      this.placeHeld();
      if (r.time >= k.recoverSeconds) this.reception = null;
      return;
    }
    const u = Math.min(1, r.time / r.duration), ease = u * u * (3 - 2 * u);
    if (r.phase === 'approach') {
      this.position.lerpVectors(r.from, r.at, ease).addScaledVector(r.tangent, u * (1 - u) ** 2);
      const ground = this.landingGround?.(this.position.x, this.position.z) ?? heightAt(this.position.x, this.position.z);
      this.position.y = Math.max(this.position.y, ground + k.groundClearance);
      this.body.scale.setScalar(THREE.MathUtils.lerp(r.scale, tuning.paperCarry.scale, ease));
      this.group.quaternion.copy(r.rotation).slerp(r.flight, ease);
      if (u >= k.reachAt) c.reachLocal(0, this.scratch.fromArray(k.hand));
    } else {
      // Contact uses this frame's posed mitten, after the child has moved.
      c.planeQuaternion(this.heldRotation);
      this.heldRotation.premultiply(this.catchTilt.setFromAxisAngle(this.gripOffset.set(0, 1, 0), k.wristTurn));
      c.handPosition(this.scratch);
      this.scratch.sub(this.gripOffset.copy(PAPER_GRIP).multiplyScalar(this.body.scale.x).applyQuaternion(this.heldRotation));
      this.position.lerpVectors(r.from, this.scratch, ease);
      this.group.quaternion.copy(r.rotation).slerp(this.heldRotation, THREE.MathUtils.smoothstep(u, 0, k.levelAt));
    }
    this.velocity.subVectors(this.position, this.prev).divideScalar(Math.max(dt, 1e-6));
    this.airborne = true;
    this.restTime = 0;
    this.lift = 0;
    this.group.position.copy(this.position);
    this.group.updateMatrixWorld(true);
    this.shadowMat.uniforms.uOpacity.value = 0;
    this.trails.update([]);
    if (u < 1) return;
    r.time = 0;
    if (r.phase === 'approach') {
      r.phase = 'catch';
      r.from.copy(this.position);
      r.rotation.copy(this.group.quaternion);
      r.duration = k.catchSeconds;
    } else {
      r.phase = 'recover';
      this.hold(c);
      c.reachFor(0, null);
    }
  }

  set visible(on: boolean) {
    this.group.visible = on;
    this.trails.mesh.visible = on;
  }

  update(dt: number, time: number): void {
    this.clock = time;
    if (this.reception) { this.updateReturn(dt); return; }
    const size = this.held || this.keptSmall ? tuning.paperCarry.scale : SCALE;
    this.body.scale.setScalar(THREE.MathUtils.lerp(this.body.scale.x, size, 1 - Math.exp(-dt * tuning.paperCarry.sizeRate)));
    if (this.restingAt) {
      this.position.copy(this.restingAt);
      this.velocity.set(0, 0, 0);
      if (!this.pinned) this.restTime += dt;
      this.group.position.copy(this.position);
      this.group.rotation.copy(this.restingRotation);
      this.group.updateMatrixWorld();
      this.shadow.position.copy(this.position).setY(this.position.y - 0.04);
      this.shadow.scale.setScalar(1);
      this.shadowMat.uniforms.uOpacity.value = this.pinned ? 0 : 0.32;
      return;
    }
    if (this.held) {
      this.waiting = false;
      this.waitBlend = 0;
      this.placeHeld();
      return;
    }
    if (this.departing) this.thrust = Math.max(this.thrust, 5.2);
    const p = this.position;
    const v = this.velocity;
    if (this.settlingAt) this.home.copy(this.settlingAt);
    // Only the player's gusts carry it; the prevailing breeze never chooses its course.
    const w = feltWind(this.wind.sample(p.x, p.z, this.sample), 0);
    if (this.settlingAt) w.x = w.z = w.energy = w.lift = 0;
    const ground = this.landingGround?.(p.x, p.z) ?? heightAt(p.x, p.z);
    const waterLevel = this.water?.over(p.x, p.z) ? this.water.level : 0;
    const surface = Math.max(ground, waterLevel);
    const clearance = ground > waterLevel && ground > GRASS_LINE ? 1.8 : 0.45;
    const floor = surface + clearance;
    const altitude = p.y - floor;
    const windSpeed = Math.hypot(w.x, w.z);

    this.thrust = Math.max(0, this.thrust - dt * 2.8);
    const liftForce = this.settlingAt ? 0 : w.energy * 8 + w.lift * 10 + Math.max(0, windSpeed - 5) * 0.25 + this.thrust * 0.42;
    this.lift += (Math.min(1, liftForce / 8) - this.lift) * (1 - Math.exp(-dt * 3));
    const resting = altitude < 0.3 && liftForce < 1.6;
    this.airborne = !resting;
    this.restTime = resting && Math.hypot(this.velocity.x, this.velocity.z) < 1.5 ? this.restTime + dt : 0;

    this.aground = ground > waterLevel;
    const fx = Math.sin(this.yaw);
    const fz = Math.cos(this.yaw);
    const glide = resting ? 0 : 3.2;
    const grip = resting ? 4 : 1.4 + w.energy * 1.5;
    /**
     * It leans toward wherever the story wants them next, and leans harder the higher it is: send it up and it
     * comes down nearer whatever there is to do. Over water it turns for land whatever height it is at, because
     * a paper plane sitting out on the sea is the one thing in this game the player cannot answer.
     */
    let gx = fx;
    let gz = fz;
    const steer = this.departing ? 0 : this.aground ? Math.min(0.5, altitude / 30) : 0.7;
    const dx = this.home.x - p.x;
    const dz = this.home.z - p.z;
    const toHome = Math.hypot(dx, dz);
    if (steer > 0 && toHome > 3) {
      gx += (dx / toHome - fx) * steer;
      gz += (dz / toHome - fz) * steer;
      const n = Math.hypot(gx, gz) || 1;
      gx /= n;
      gz /= n;
    }
    const escort = this.companion && !this.departing ? this.companion : null;
    const guide = tuning.meadowPlane;
    if (escort) {
      const gap = Math.hypot(p.x - escort.x, p.z - escort.z);
      if (!this.waiting && gap > guide.waitAt) {
        this.waiting = true;
        // Keep the same side through a waiting turn; no alternating left/right corrections.
        this.turnSide = fx * dz - fz * dx >= 0 ? 1 : -1;
      } else if (gap < guide.resumeAt) this.waiting = false;
      this.waitBlend += ((this.waiting ? 1 : 0) - this.waitBlend) * (1 - Math.exp(-dt * guide.turnRate));
      const hx = this.home.x - escort.x, hz = this.home.z - escort.z;
      const length = Math.hypot(hx, hz) || 1;
      const tx = dx - hz / length * guide.turnWidth * this.turnSide;
      const tz = dz + hx / length * guide.turnWidth * this.turnSide;
      const turn = Math.hypot(tx, tz) || 1;
      gx += (tx / turn - gx) * this.waitBlend;
      gz += (tz / turn - gz) * this.waitBlend;
    } else {
      this.waiting = false;
      this.waitBlend = 0;
    }
    v.x += (w.x + gx * glide - v.x) * (1 - Math.exp(-dt * grip));
    v.z += (w.z + gz * glide - v.z) * (1 - Math.exp(-dt * grip));
    const vyTarget = resting ? 0 : this.departing && this.departure.rise !== null ? this.departure.rise : liftForce - 2.4;
    v.y += (vyTarget - v.y) * (1 - Math.exp(-dt * 1.4));

    if (this.guided && !this.departing) {
      const k = tuning.planeGuide;
      // Local gesture energy keeps the player's gust; quiet air restores a definite course,
      // including near the ground where altitude-only steering used to disappear.
      const assistance = this.settlingAt ? 1 : 1 - THREE.MathUtils.smoothstep(Math.max(w.energy, w.lift), k.gustFrom, k.gustFull);
      const speed = resting && !this.settlingAt ? 0 : Math.min(k.speed, toHome * k.approach);
      const response = 1 - Math.exp(-dt * k.response * assistance);
      v.x += ((toHome > 0 ? dx / toHome * speed : 0) - v.x) * response;
      v.z += ((toHome > 0 ? dz / toHome * speed : 0) - v.z) * response;
      if (this.settlingAt) {
        // Stay above intervening ground, then come down at the pickup spot.
        const landing = Math.max(this.landingGround?.(this.home.x, this.home.z) ?? heightAt(this.home.x, this.home.z), 0);
        const y = Math.max(floor, landing + clearance + Math.min(k.travelHeight, toHome));
        v.y += (THREE.MathUtils.clamp((y - p.y) * k.approach, -k.sinkSpeed, k.sinkSpeed) - v.y) * (1 - Math.exp(-dt * k.response));
      }
    }

    if (this.departing) {
      const k = 1 - Math.exp(-dt * this.departure.grip);
      v.x += (this.departing.x * this.departure.speed - v.x) * k;
      v.z += (this.departing.z * this.departure.speed - v.z) * k;
    }
    const r = Math.hypot(p.x - this.home.x, p.z - this.home.z);
    if (r > this.homeRadius && !this.departing) {
      const pull = Math.min((r - this.homeRadius) * 0.5, 14) * dt;
      v.x -= ((p.x - this.home.x) / r) * pull;
      v.z -= ((p.z - this.home.z) / r) * pull;
    }
    const edge = this.departing ? null : this.playEdge;
    const past = edge ? edge.at - (p.x * edge.back.x + p.z * edge.back.y) : -Infinity;
    if (edge && !resting) {
      const k = tuning.planeEdge;
      const brake = THREE.MathUtils.smoothstep(past, -k.margin, 0);
      const outward = -(v.x * edge.back.x + v.z * edge.back.y);
      const limit = k.freeSpeed * (1 - brake) - k.returnSpeed * brake;
      if (outward > limit) {
        v.x += edge.back.x * (outward - limit);
        v.z += edge.back.y * (outward - limit);
      }
    }
    /** Nothing is ever lost: a plane down on the water or out of play is picked up again by a gust of its own and flies back. */
    if (resting && (!this.aground || past > 0)) {
      if (this.restTime > 0.9) {
        this.thrust = Math.max(this.thrust, 5);
        this.restTime = 0;
        v.y = Math.max(v.y, 2.4);
      }
      if (r > 1) {
        v.x -= ((p.x - this.home.x) / r) * 3.2 * dt;
        v.z -= ((p.z - this.home.z) / r) * 3.2 * dt;
      }
    }
    // Walking flight uses the companion-relative ceiling below, even on the high meadow slopes.
    if (p.y > 32 && !this.departing && !escort) v.y -= (p.y - 32) * dt * 1.5;
    for (const o of this.obstacles) {
      const d = this.scratch.subVectors(p, o.centre);
      const len = d.length();
      const reach = o.radius + 1.8;
      if (len < reach && len > 1e-3) v.addScaledVector(d, ((reach - len) / len) * dt * 6);
    }

    if (this.guided && !this.departing && r > this.homeRadius) {
      // A prolonged gust must not win forever against a small acceleration toward home.
      // Spill outward speed at the edge; sideways play remains free and recovery is continuous.
      const k = tuning.planeGuide;
      const brake = THREE.MathUtils.smoothstep(r, this.homeRadius, this.homeRadius + k.returnMargin);
      const radial = -(v.x * dx + v.z * dz) / r;
      const limit = k.speed * (1 - brake) - k.returnSpeed * brake;
      if (radial > limit) {
        v.x -= dx / r * (limit - radial);
        v.z -= dz / r * (limit - radial);
      }
    }

    if (escort) {
      // Spill only the outward part of a gust. Sideways play and lift remain responsive.
      // This bounds velocity, not position: even an old far-away save flies home continuously.
      const ex = p.x - escort.x, ez = p.z - escort.z;
      const gap = Math.hypot(ex, ez);
      if (gap > guide.brakeFrom) {
        const radial = (v.x * ex + v.z * ez) / gap;
        const brake = THREE.MathUtils.smoothstep(gap, guide.brakeFrom, guide.reach);
        const limit = guide.outwardSpeed * (1 - brake)
          - guide.returnSpeed * THREE.MathUtils.smoothstep(gap, guide.waitAt, guide.reach);
        if (radial > limit) {
          v.x += ex / gap * (limit - radial);
          v.z += ez / gap * (limit - radial);
        }
      }
      const high = p.y - escort.y;
      if (high > guide.heightBrake) {
        const brake = THREE.MathUtils.smoothstep(high, guide.heightBrake, guide.height);
        v.y = Math.min(v.y, guide.riseSpeed * (1 - brake)
          - guide.returnSpeed * THREE.MathUtils.smoothstep(high, guide.height, guide.height + guide.heightBrake));
      }
    }

    p.addScaledVector(v, dt);
    const newFloor = Math.max(this.landingGround?.(p.x, p.z) ?? heightAt(p.x, p.z),
      this.water?.over(p.x, p.z) ? this.water.level : 0) + clearance;
    if (p.y < newFloor) {
      p.y += (newFloor - p.y) * (1 - Math.exp(-dt * 12));
      if (v.y < 0) v.y *= 0.3;
      v.x *= Math.exp(-dt * 1.2);
      v.z *= Math.exp(-dt * 1.2);
    }

    const hSpeed = Math.hypot(v.x, v.z);
    const prevYaw = this.yaw;
    if (hSpeed > 0.6) {
      const targetYaw = Math.atan2(v.x, v.z);
      let dy = targetYaw - this.yaw;
      dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      this.yaw += dy * (1 - Math.exp(-dt * 2.2));
    }
    const yawRate = Math.atan2(Math.sin(this.yaw - prevYaw), Math.cos(this.yaw - prevYaw)) / dt;
    this.wobble += dt * (2 + windSpeed * 0.3);
    const turbulence = Math.sin(this.wobble * 3.1) * 0.05 + Math.sin(this.wobble * 1.7) * 0.08;
    const bankTarget = resting ? 0.12 : THREE.MathUtils.clamp(-yawRate * 0.45, -0.85, 0.85) + turbulence * (0.5 + this.lift);
    this.bank += (bankTarget - this.bank) * (1 - Math.exp(-dt * 4));
    const pitchTarget = resting ? -0.05 : THREE.MathUtils.clamp(Math.atan2(v.y, Math.max(hSpeed, 1)) * 0.8, -0.5, 0.6);
    this.pitch += (pitchTarget - this.pitch) * (1 - Math.exp(-dt * 3));

    this.group.position.copy(p);
    if (resting) this.group.position.y += Math.sin(time * 1.3) * 0.05;
    this.group.rotation.set(0, 0, 0);
    this.group.rotateY(this.yaw);
    this.group.rotateX(-this.pitch);
    this.group.rotateZ(this.bank);
    if (this.releaseBlend > 0) {
      this.releaseBlend = Math.max(0, this.releaseBlend - dt / tuning.paperCarry.releaseSeconds);
      this.group.quaternion.slerp(this.releasedRotation, THREE.MathUtils.smoothstep(this.releaseBlend, 0, 1));
    }

    if (altitude < 5 && hSpeed > 1.5) {
      this.wind.addSplat({ source: this, trail: true,
        ax: this.prev.x,
        az: this.prev.z,
        bx: p.x,
        bz: p.z,
        vx: v.x * 0.9,
        vz: v.z * 0.9,
        radius: 1.8,
        energy: 0,
        swirl: 0,
        lift: 0,
      });
    }
    this.prev.copy(p);

    this.shadow.position.set(p.x, surface + (this.aground && ground > GRASS_LINE ? 1.6 : 0.05), p.z);
    const shadowAlt = p.y - this.shadow.position.y;
    this.shadow.scale.setScalar(1 + shadowAlt * 0.08);
    this.shadowMat.uniforms.uOpacity.value = 0.32 * Math.exp(-shadowAlt * 0.09);

    this.group.updateMatrixWorld();
    this.updateTrail(this.tipL, -1, hSpeed);
    this.updateTrail(this.tipR, 1, hSpeed);
    this.trails.update([this.tipL, this.tipR]);
  }

  /**
   * The player pushes what they see: a swipe that passes over the glider on screen carries it, even though
   * the ground under the cursor (where the wind field is pushed) lies well behind it.
   */
  brush(camera: THREE.Camera, a: THREE.Vector2, b: THREE.Vector2, gust: number, dir: THREE.Vector2, charge: number, dt: number): void {
    if (this.restingAt || this.settlingAt || this.reception) return;
    if (this.held) return;
    const s = this.scratch.copy(this.position).project(camera);
    const aspect = window.innerWidth / window.innerHeight;
    const px = s.x * aspect;
    const ax = a.x * aspect;
    const bx = b.x * aspect;
    const abx = bx - ax;
    const aby = b.y - a.y;
    const t = THREE.MathUtils.clamp(((px - ax) * abx + (s.y - a.y) * aby) / Math.max(abx * abx + aby * aby, 1e-6), 0, 1);
    const d = Math.hypot(px - (ax + abx * t), s.y - (a.y + aby * t));
    const radius = 0.2;
    if (d > radius || s.z > 1) return;
    const f = (1 - d / radius) ** 2;
    if (gust > 1) {
      const push = Math.min(gust, 13);
      this.thrust = Math.max(this.thrust, push * 0.5 * f);
      const k = 1 - Math.exp(-dt * 7 * f);
      this.velocity.x += (dir.x * push - this.velocity.x) * k;
      this.velocity.z += (dir.y * push - this.velocity.z) * k;
      this.velocity.y += push * 0.3 * f * dt * 7;
    }
    if (charge > 0) this.velocity.y += charge * 14 * f * dt;
  }

  private placeHeld(): void {
    if (!this.carrier) return;
    /** Sample after the child's pose, including the boat's roll and this frame's step. */
    this.carrier.planeQuaternion(this.heldRotation);
    if (this.catchTurn) {
      const reach = this.carrier.reached(0);
      const turn = this.catchTurn * THREE.MathUtils.smoothstep(reach, 0, 0.15);
      this.heldRotation.premultiply(this.catchTilt.setFromAxisAngle(this.gripOffset.set(0, 1, 0), turn));
      if (!this.reception && reach < 0.001) this.catchTurn = 0;
    }
    this.carrier.handPosition(this.position);
    this.position.sub(this.scratch.copy(PAPER_GRIP).multiplyScalar(this.body.scale.x).applyQuaternion(this.heldRotation));
    this.group.position.copy(this.position);
    this.group.quaternion.copy(this.heldRotation);
    this.group.updateMatrixWorld();
    this.shadowMat.uniforms.uOpacity.value = 0;
    this.tipL.alpha = this.tipR.alpha = 0;
    this.trails.update([this.tipL, this.tipR]);
  }

  private updateTrail(trail: Ribbon, side: number, speed: number): void {
    const tip = this.scratch.set(side * 1.15 * this.body.scale.x, 0.16 * this.body.scale.x, -0.95 * this.body.scale.x).applyMatrix4(this.group.matrixWorld);
    const pts = trail.points;
    const laid = this.laid.get(trail)!;
    const n = pts.length;
    if (n < 2 || pts[n - 2].distanceTo(tip) > 0.5) {
      pts.push(tip.clone());
      laid.push(this.clock);
      if (pts.length > 56) {
        pts.shift();
        laid.shift();
      }
    } else {
      pts[n - 1].copy(tip);
    }
    let reach = 0;
    for (let i = 1; i < pts.length; i++) reach += pts[i].distanceTo(pts[i - 1]);
    while (pts.length > 2 && (this.clock - laid[0] > TRAIL_SECONDS || reach > TRAIL_REACH)) {
      reach -= pts[1].distanceTo(pts[0]);
      pts.shift();
      laid.shift();
    }
    trail.alpha = 0.3 * Math.min(1, speed / 6) * (this.airborne ? 1 : 0.2);
  }
}
