import * as THREE from 'three';
import { tuning } from '../tuning';
import type { WindField, WindSample } from '../wind/field';
import { ATMO_GLSL, atmo } from '../world/atmosphere';
import { heightAt } from '../world/island';

/** How long the feather is, in world units: a swan's primary beside a bird a unit and a half tall. */
const LENGTH = 0.82;
const STEPS = 14;

const VERT = /* glsl */ `
${ATMO_GLSL}
in vec2 aVane;
out vec3 vWorld;
out vec3 vNormal;
out vec2 vVane;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  vNormal = normalize(mat3(modelMatrix) * normal);
  vVane = aVane;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

/**
 * White, and thin enough that the light behind it comes through as much as the light on it bounces off. The barbs
 * are drawn rather than modelled, and the outer edge frays away to nothing so it never reads as a cut-out shape.
 */
const FRAG = /* glsl */ `
${ATMO_GLSL}
uniform float uFade;
in vec3 vWorld;
in vec3 vNormal;
in vec2 vVane;
void main() {
  float across = abs(vVane.x);
  float barbs = 0.86 + 0.14 * sin(vVane.y * 150.0 + across * 9.0);
  float edge = 1.0 - smoothstep(0.72, 1.0, across);
  float quill = 1.0 - smoothstep(0.0, 0.16, across);
  float a = max(edge * barbs, quill);
  if (a < 0.02) discard;
  vec3 N = normalize(vNormal) * (gl_FrontFacing ? 1.0 : -1.0);
  float ndl = dot(N, uSunDir);
  vec3 alb = mix(vec3(0.97, 0.97, 0.99), vec3(0.88, 0.87, 0.84), quill * 0.5);
  vec3 col = alb * (uSkyAmbient * 1.5 + uSunColor * (max(ndl, 0.0) * 0.5 + max(-ndl, 0.0) * 0.55));
  col += lampLight(vWorld, N) * 1.1 + dawnLight(vWorld, N) * 1.2;
  vec4 f = fogOf(vWorld);
  gl_FragColor = vec4(mix(col, f.rgb, f.a * 0.8), a * uFade);
}`;

/** A long primary: a curved spine, a vane that swells and tapers off it, and a bare quill at the root. */
function featherGeometry(): THREE.BufferGeometry {
  const pos: number[] = [];
  const vane: number[] = [];
  const index: number[] = [];
  const spine = (t: number): [number, number, number] => [0, Math.sin(t * 1.4) * 0.07 * t, (t - 0.42) * LENGTH];
  for (let i = 0; i <= STEPS; i++) {
    const t = i / STEPS;
    /** Bare for the first fifth, widest a third of the way up, and drawn to a point at the tip. */
    const width = Math.max(0.012, Math.sin(Math.min(1, Math.max(0, (t - 0.18) / 0.82)) ** 0.6 * Math.PI) * 0.082);
    const [x, y, z] = spine(t);
    for (const side of [-1, 1]) {
      pos.push(x + side * width, y + side * width * 0.16, z);
      vane.push(side, t);
    }
    if (i < STEPS) {
      const a = i * 2;
      index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('aVane', new THREE.Float32BufferAttribute(vane, 2));
  geo.setIndex(index);
  geo.computeVertexNormals();
  return geo;
}

/**
 * The one long white feather out of the pillow, and the whole of the sleeping island's control: the player blows a
 * light thing along and the bird follows it, exactly as the child follows the paper plane. It is the same idea as
 * `glider/glider.ts` and deliberately the slower, floatier version of it — it hangs, turns over, sinks at a walk,
 * and leans toward wherever the story wants the bird to be, so it never has to be fetched and can never be lost.
 */
export class Feather {
  readonly position = new THREE.Vector3();
  readonly velocity = new THREE.Vector3();
  /** Where the story wants it to end up; it drifts that way by itself, and is brought back if it strays. */
  readonly goal = new THREE.Vector3();
  /** How far from the goal it may wander before the air turns it round. */
  keepNear = 26;
  /** Keep the guide in sight of the bird while preserving small gust-driven detours. */
  follow: THREE.Vector3 | null = null;
  routeStart: THREE.Vector3 | null = null;
  encouragement = 0;
  /** 0 while it is still in the pillow, 1 once it is in the air. */
  flying = false;
  /** How much the wind is lifting it, 0..1, for whoever wants to hear or see that. */
  lift = 0;
  /** Fade into the window seam when the guide has delivered the bird. */
  fade = 1;

  private readonly mesh: THREE.Mesh;
  private readonly sample: WindSample = { x: 0, z: 0, energy: 0, lift: 0 };
  private readonly scratch = new THREE.Vector3();
  private readonly spin = new THREE.Euler(0, 0, 0, 'YXZ');
  private phase = Math.random() * 6.28;
  private rest = 0;
  private turn = 0;
  private yaw = 0;

  constructor(private readonly wind: WindField) {
    this.mesh = new THREE.Mesh(
      featherGeometry(),
      new THREE.ShaderMaterial({
        vertexShader: VERT,
        fragmentShader: FRAG,
        uniforms: { ...atmo.uniforms, uFade: { value: 1 } },
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    this.mesh.renderOrder = 3;
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
  }

  get objects(): THREE.Object3D[] {
    return [this.mesh];
  }

  set visible(on: boolean) {
    this.mesh.visible = on && this.flying;
  }

  /** Out of the pillow: it comes away slowly and hangs there, which is the whole of the invitation. */
  release(from: THREE.Vector3, drift: THREE.Vector3): void {
    this.position.copy(from);
    this.velocity.copy(drift);
    this.goal.copy(from);
    this.flying = true;
    this.fade = 1;
    this.rest = 0;
    this.mesh.visible = true;
  }

  /** How far above the ground it is hanging: what tells the bird to look up rather than down. */
  get height(): number {
    return this.position.y - Math.max(heightAt(this.position.x, this.position.z), 0);
  }

  update(dt: number, time: number): void {
    if (!this.flying) return;
    (this.mesh.material as THREE.ShaderMaterial).uniforms.uFade.value = this.fade;
    const t = tuning.sleeping;
    const p = this.position;
    const v = this.velocity;
    const w = this.wind.sample(p.x, p.z, this.sample);
    let floor = Math.max(heightAt(p.x, p.z), 0) + 0.06;

    /** It weighs almost nothing, so it takes the air's own speed rather than being pushed along by it. */
    const take = 1 - Math.exp(-dt * t.featherTakes);
    v.x += (w.x - v.x) * take;
    v.z += (w.z - v.z) * take;
    const rising = w.lift * t.featherLift + w.energy * t.featherGust;
    this.lift += (Math.min(1, rising / t.featherSink) - this.lift) * (1 - Math.exp(-dt * 3));
    /** It hangs: below the height it likes the air holds it up, and above it it sinks the way a feather does. */
    const hold = THREE.MathUtils.clamp((floor + t.featherHangs - p.y) * 0.5, -0.25, 0.6);
    v.y += (rising + hold - t.featherSink - v.y) * (1 - Math.exp(-dt * 2.2));

    /**
     * And it leans where the story wants it, harder the further off it has got, exactly as the paper plane does:
     * a player who never blows on it again still finds the bird walking up the hill behind it.
     */
    const dx = this.goal.x - p.x;
    const dz = this.goal.z - p.z;
    const away = Math.hypot(dx, dz);
    if (away > 0.4) {
      const pull = t.featherLean + Math.max(0, away - this.keepNear) * 0.6;
      v.x += (dx / away) * pull * dt;
      v.z += (dz / away) * pull * dt;
    }
    /** Never lost: down on the grass too long and a breath of its own picks it up again. */
    this.encouragement *= Math.exp(-dt * 0.75);
    if (this.follow && this.routeStart) {
      const rx = this.goal.x - this.routeStart.x, rz = this.goal.z - this.routeStart.z;
      const length = Math.hypot(rx, rz) || 1, ax = rx / length, az = rz / length;
      const side = THREE.MathUtils.clamp(-az * v.x + ax * v.z, -0.7, 0.7);
      const remaining = (this.goal.x - p.x) * ax + (this.goal.z - p.z) * az;
      const forward = THREE.MathUtils.clamp(remaining * 1.2, 0, 0.6 + this.encouragement * t.featherEncouragement);
      const blend = 1 - Math.exp(-dt * 5);
      v.x = ax * forward - az * side;
      v.z = az * forward + ax * side;
      const lateral = -az * (p.x - this.routeStart.x) + ax * (p.z - this.routeStart.z);
      const correction = (lateral - THREE.MathUtils.clamp(lateral, -t.featherCorridor, t.featherCorridor)) * blend;
      p.x += az * correction; p.z -= ax * correction;
      p.y += (floor + t.featherHangs - p.y) * (1 - Math.exp(-dt * 3));
    }
    const down = p.y <= floor + 0.05;
    this.rest = down ? this.rest + dt : 0;
    if (this.rest > t.featherRests) {
      v.y = Math.max(v.y, t.featherSink * 3);
      this.rest = 0;
    }
    p.addScaledVector(v, dt);
    if (this.follow) {
      const dx = p.x - this.follow.x, dz = p.z - this.follow.z;
      const gap = Math.hypot(dx, dz);
      if (gap > t.featherLead) {
        const pull = (gap - t.featherLead) * (1 - Math.exp(-dt * t.featherCatch));
        p.x -= dx / gap * pull; p.z -= dz / gap * pull;
      }
    }
    floor = Math.max(heightAt(p.x, p.z), 0) + 0.06;
    if (p.y < floor) {
      p.y = floor;
      v.y = Math.max(v.y, 0);
      v.x *= Math.exp(-dt * 3);
      v.z *= Math.exp(-dt * 3);
    }
    /** Never higher than a bird can see it against the fog, and never far enough up to be out of frame. */
    if (p.y > floor + t.featherCeiling) {
      p.y = floor + t.featherCeiling;
      v.y = Math.min(v.y, 0);
    }

    /**
     * How it hangs. A feather falls broadside on and rocks about its own length, turning over slowly: the sway is
     * its own, so it is never still even in dead air, and it lies across whatever way it is travelling.
     */
    const speed = Math.hypot(v.x, v.z);
    if (speed > 0.15) this.yaw += Math.atan2(Math.sin(Math.atan2(v.x, v.z) - this.yaw), Math.cos(Math.atan2(v.x, v.z) - this.yaw)) * (1 - Math.exp(-dt * 1.4));
    this.turn += dt * (0.5 + speed * 0.25 + this.lift * 1.4);
    const rock = Math.sin(time * 1.35 + this.phase);
    this.spin.set(-0.5 + Math.sin(time * 0.9 + this.phase) * 0.45 - Math.min(0.5, v.y * 0.4), this.yaw + Math.sin(this.turn) * 0.7, rock * 0.85 + this.turn * 0.12);
    this.mesh.position.copy(p);
    this.mesh.rotation.copy(this.spin);
  }

  /**
   * The player pushes what they see. The wind field is stirred where their cursor meets the ground, which is well
   * behind a feather hanging in the air, so a stroke that crosses it on screen carries it too (`Glider.brush`).
   */
  brush(camera: THREE.Camera, a: THREE.Vector2, b: THREE.Vector2, gust: number, dir: THREE.Vector2, charge: number, dt: number): void {
    if (!this.flying || gust <= tuning.pointer.minGust) return;
    const s = this.scratch.copy(this.position).project(camera);
    if (s.z > 1) return;
    const aspect = window.innerWidth / window.innerHeight;
    const px = s.x * aspect;
    const ax = a.x * aspect;
    const abx = b.x * aspect - ax;
    const aby = b.y - a.y;
    const k = THREE.MathUtils.clamp(((px - ax) * abx + (s.y - a.y) * aby) / Math.max(abx * abx + aby * aby, 1e-6), 0, 1);
    const d = Math.hypot(px - (ax + abx * k), s.y - (a.y + aby * k));
    const radius = tuning.sleeping.featherBrushRadius;
    if (d > radius) return;
    const f = (1 - d / radius) ** 2;
    const t = tuning.sleeping;
    this.encouragement = Math.min(1, this.encouragement + Math.min(gust, 14) * f * dt * 1.6);
    const push = Math.min(gust, 14) * t.featherBrush * f;
    const grip = 1 - Math.exp(-dt * 6 * f);
    if (this.follow && this.routeStart) {
      // Screen-to-ground projection changes sharply on the hill. A visible stroke encourages the route,
      // while ordinary free flight still uses the world-space direction below.
      this.velocity.y += (push * 0.2 + charge * 3) * f * dt;
      return;
    }
    this.velocity.x += (dir.x * push - this.velocity.x) * grip;
    this.velocity.z += (dir.y * push - this.velocity.z) * grip;
    this.velocity.y += (push * 0.35 + charge * 6) * f * dt * 5;
  }
}
