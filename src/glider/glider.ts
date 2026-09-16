import * as THREE from 'three';
import { RibbonBatch, type Ribbon } from '../fx/ribbons';
import type { WindField, WindSample } from '../wind/field';
import { ATMO_GLSL, atmo } from '../world/atmosphere';
import { GRASS_LINE, heightAt } from '../world/island';

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
  float rim = pow(1.0 - max(dot(N, V), 0.0), 3.0);
  vec3 col = alb * (hemiLight(N) * 1.1 + uSunColor * (max(ndl, 0.0) * 0.7 + through)) + uSunColor * rim * 0.22;
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

function paperPlane(): THREE.BufferGeometry {
  const nose = [0, 0, 1.5];
  const tail = [0, 0.02, -0.95];
  const left = [-1.15, 0.16, -0.95];
  const right = [1.15, 0.16, -0.95];
  const keel = [0, -0.34, -0.8];
  const tris = [nose, tail, left, nose, right, tail, nose, keel, tail, nose, tail, keel];
  const pos = new Float32Array(tris.flat());
  const paper = new Float32Array(tris.flatMap(([x, y, z]) => [0.5 + x * 0.4 + (y < -0.1 ? 0.3 : 0), 0.5 + z * 0.4]));
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aPaper', new THREE.BufferAttribute(paper, 2));
  geo.computeVertexNormals();
  return geo;
}

const SCALE = 0.85;
/** How long a wingtip trail lingers in the air. */
const TRAIL_SECONDS = 1.6;

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
  /** How wet it is, 0 dry to 1 sodden: the storm soaks it and the player's wind dries it out again. */
  readonly soggy = { value: 0 };
  /**
   * Where the game would like the player to go next. The plane leans that way as it flies and banks back to it
   * when it strays past `homeRadius`, so following it is the same thing as getting on with the story.
   */
  readonly home = new THREE.Vector3(-6, 0, -14);
  homeRadius = 50;
  /** False while it is down on the water, where the child cannot go and fetch it. */
  private aground = true;
  private readonly body: THREE.Mesh;
  private readonly shadow: THREE.Mesh;
  private readonly shadowMat: THREE.ShaderMaterial;
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
    return !this.held && this.restTime > 1.2 && this.aground;
  }

  /** Keeps the plane in a hand, nose along `yaw`, tilted a little up. */
  hold(at: THREE.Vector3, yaw: number): void {
    this.held = true;
    this.restTime = 0;
    this.position.copy(at);
    this.velocity.set(0, 0, 0);
    this.yaw = yaw;
    this.pitch = 0.25;
    this.bank = 0;
    this.lift = 0;
  }

  launch(from: THREE.Vector3, velocity: THREE.Vector3): void {
    this.held = false;
    this.restTime = 0;
    this.position.copy(from);
    this.prev.copy(from);
    this.velocity.copy(velocity);
    this.thrust = velocity.length();
    this.yaw = Math.atan2(velocity.x, velocity.z);
    this.tipL.points.length = 0;
    this.tipR.points.length = 0;
    for (const laid of this.laid.values()) laid.length = 0;
  }

  depart(heading: THREE.Vector3): void {
    this.departing = heading.clone().normalize();
  }

  set visible(on: boolean) {
    this.group.visible = on;
    this.trails.mesh.visible = on;
  }

  update(dt: number, time: number): void {
    this.clock = time;
    if (this.held) {
      this.placeHeld();
      return;
    }
    if (this.departing) this.thrust = Math.max(this.thrust, 5.2);
    const p = this.position;
    const v = this.velocity;
    const w = this.wind.sample(p.x, p.z, this.sample);
    const ground = heightAt(p.x, p.z);
    const surface = Math.max(ground, 0);
    const clearance = ground > GRASS_LINE ? 1.8 : 0.45;
    const floor = surface + clearance;
    const altitude = p.y - floor;
    const windSpeed = Math.hypot(w.x, w.z);

    this.thrust = Math.max(0, this.thrust - dt * 2.8);
    const liftForce = w.energy * 8 + w.lift * 10 + Math.max(0, windSpeed - 5) * 0.25 + this.thrust * 0.42;
    this.lift += (Math.min(1, liftForce / 8) - this.lift) * (1 - Math.exp(-dt * 3));
    const resting = altitude < 0.3 && liftForce < 1.6;
    this.airborne = !resting;
    this.restTime = resting && Math.hypot(this.velocity.x, this.velocity.z) < 1.5 ? this.restTime + dt : 0;

    this.aground = ground > 0;
    const fx = Math.sin(this.yaw);
    const fz = Math.cos(this.yaw);
    const glide = resting ? 0 : 3.2;
    const grip = resting ? 0.15 : 1.4 + w.energy * 1.5;
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
    v.x += (w.x + gx * glide - v.x) * (1 - Math.exp(-dt * grip));
    v.z += (w.z + gz * glide - v.z) * (1 - Math.exp(-dt * grip));
    const vyTarget = resting ? 0 : liftForce - 2.4;
    v.y += (vyTarget - v.y) * (1 - Math.exp(-dt * 1.4));

    if (this.departing) {
      const k = 1 - Math.exp(-dt * 0.6);
      v.x += (this.departing.x * 9 - v.x) * k;
      v.z += (this.departing.z * 9 - v.z) * k;
    }
    const r = Math.hypot(p.x - this.home.x, p.z - this.home.z);
    if (r > this.homeRadius && !this.departing) {
      const pull = Math.min((r - this.homeRadius) * 0.5, 14) * dt;
      v.x -= ((p.x - this.home.x) / r) * pull;
      v.z -= ((p.z - this.home.z) / r) * pull;
    }
    /** Nothing is ever lost: a plane down on the water is picked up again by a gust of its own and flies back. */
    if (resting && !this.aground) {
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
    if (p.y > 32 && !this.departing) v.y -= (p.y - 32) * dt * 1.5;
    for (const o of this.obstacles) {
      const d = this.scratch.subVectors(p, o.centre);
      const len = d.length();
      const reach = o.radius + 1.8;
      if (len < reach && len > 1e-3) v.addScaledVector(d, ((reach - len) / len) * dt * 6);
    }

    p.addScaledVector(v, dt);
    const newFloor = Math.max(heightAt(p.x, p.z), 0) + clearance;
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

    if (altitude < 5 && hSpeed > 1.5) {
      this.wind.addSplat({
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

    this.shadow.position.set(p.x, surface + (ground > GRASS_LINE ? 1.6 : 0.05), p.z);
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
    this.group.position.copy(this.position);
    this.group.rotation.set(0, 0, 0);
    this.group.rotateY(this.yaw);
    this.group.rotateX(-this.pitch);
    this.group.updateMatrixWorld();
    this.shadowMat.uniforms.uOpacity.value = 0;
    this.tipL.alpha = this.tipR.alpha = 0;
    this.trails.update([this.tipL, this.tipR]);
  }

  private updateTrail(trail: Ribbon, side: number, speed: number): void {
    const tip = this.scratch.set(side * 1.15 * SCALE, 0.16 * SCALE, -0.95 * SCALE).applyMatrix4(this.group.matrixWorld);
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
    while (pts.length > 2 && this.clock - laid[0] > TRAIL_SECONDS) {
      pts.shift();
      laid.shift();
    }
    trail.alpha = 0.3 * Math.min(1, speed / 6) * (this.airborne ? 1 : 0.2);
  }
}
