import * as THREE from 'three';
import { tuning } from '../../tuning';
import { ATMO_GLSL, atmo } from '../atmosphere';
import { REFLECTION_LAYER } from '../water/reflection';
import type { PointerInput } from '../../input/pointer';
import { merged, tagged } from './shapes';

const STONE = 0;
const WOOD = 1;
const SHINGLE = 2;
const LINEN = 3;
const IRON = 4;
const BOARDS = 5;
const HOLLOW = 6;
const ROPE = 7;
const BELT = 8;

/**
 * The stone tower: how far behind the sails' plane its middle stands, its radius at the water and under the cap, and
 * how far its curb stands above the hoist's top floor.
 */
const TOWER_BACK = 1.9;
const TOWER_FOOT = 1.6;
const TOWER_HEAD = 1.3;
const CURB_ABOVE = 3.4;
/** The hub stands this far above the hoist's top floor: the door, the beam over it, the curb and up into the cap. */
export const HUB_ABOVE = 4.2;

/**
 * The sails' measurements, in a sail's own frame: out along its stock from the hub, across toward its leading side,
 * and forward out of the plane it turns in. The lattice hangs on the trailing side.
 */
export const SAIL = {
  reach: 7.3, from: 1.3, to: 7.2,
  width: 1.45, forward: 0.3, stock: 0.15,
} as const;

/**
 * The sack hoist, in the mill's frame (x to the right seen from in front of the sails, z out of their front): the
 * rope hangs from the end of a beam out of a door on the left of the tower, behind the sails' plane, so the sweep
 * never comes near it. The basket's floor is square, open front and back between slatted sides, with a bar overhead
 * and a rope down from each end of it to the middle of each side, which she holds.
 */
export const HOIST = {
  x: -3.6, z: -TOWER_BACK,
  half: 0.5, rim: 0.85, bar: 2.45, barHalf: 0.34,
  /** Where she holds the side ropes, above the floor: at her shoulders. */
  grip: 1.45,
  beamAbove: 2.95, drumRadius: 0.2,
} as const;

const DRUM = new THREE.Vector3(-1.85, 0, -TOWER_BACK);
const SHEAVE_R = 0.12;

const MILL_VERT = /* glsl */ `
uniform float uTime;
uniform float uFlap;
uniform float uBelt;
in float aKind;
in float aShake;
in float aPhase;
out vec3 vWorld;
out vec3 vNormal;
out vec3 vLocal;
out float vKind;
void main() {
  vec3 p = position;
  if (aKind > ${LINEN - 0.5} && aKind < ${LINEN + 0.5}) {
    float t = uTime * (2.3 + uFlap * 3.0) + aPhase * 6.28;
    p.z += aShake * (0.08 + 0.26 * uFlap) * (sin(t + p.x * 3.1) * 0.7 + sin(t * 1.7 + p.y * 5.3) * 0.3);
    p.y -= aShake * aShake * 0.06 * (1.0 + sin(t * 0.6));
  }
  vec4 w = modelMatrix * vec4(p, 1.0);
  vWorld = w.xyz;
  vNormal = mat3(modelMatrix) * normal;
  vLocal = position;
  if (aKind > ${BELT - 0.5}) vLocal.y += uBelt;
  vKind = aKind;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const MILL_FRAG = /* glsl */ `
${ATMO_GLSL}
in vec3 vWorld;
in vec3 vNormal;
in vec3 vLocal;
in float vKind;
void main() {
  vec3 n = normalize(vNormal);
  if (!gl_FrontFacing) n = -n;
  int kind = int(vKind + 0.5);
  vec3 alb;
  if (kind == ${STONE}) {
    float course = vLocal.y * 3.0;
    float run = atan(vLocal.x, vLocal.z + ${TOWER_BACK.toFixed(2)}) * 5.0 + fract(floor(course) * 0.37) * 3.0;
    float joint = max(1.0 - smoothstep(0.0, 0.09, fract(course)), 1.0 - smoothstep(0.0, 0.06, fract(run)));
    alb = vec3(0.16, 0.15, 0.13) * (0.78 + 0.38 * fract(sin(dot(vec2(floor(course), floor(run)), vec2(12.9898, 78.233))) * 43758.5)) * (1.0 - 0.4 * joint);
    float moss = smoothstep(0.55, 0.8, vnoise(vLocal.xy * 1.3 + vLocal.z) * 0.7 + vnoise(vLocal.xy * 6.0) * 0.3 + 0.25 * (1.0 - smoothstep(0.0, 2.5, vLocal.y)));
    alb = mix(alb, vec3(0.09, 0.11, 0.045), moss * 0.75);
  } else if (kind == ${SHINGLE}) {
    float row = vLocal.y * 8.0;
    alb = vec3(0.12, 0.105, 0.09) * (0.75 + 0.4 * vnoise(vec2(atan(vLocal.x, vLocal.z + ${TOWER_BACK.toFixed(2)}) * 11.0, floor(row)))) * (0.75 + 0.3 * smoothstep(0.0, 0.25, fract(row)));
  } else if (kind == ${LINEN}) {
    alb = vec3(0.42, 0.39, 0.33) * (0.8 + 0.25 * vnoise(vLocal.xy * 9.0));
  } else if (kind == ${IRON}) {
    alb = vec3(0.05, 0.045, 0.045);
  } else if (kind == ${HOLLOW}) {
    alb = vec3(0.012, 0.012, 0.014);
  } else if (kind == ${BOARDS}) {
    float plank = vLocal.x * 7.0 + vLocal.z * 7.0;
    float seam = 1.0 - smoothstep(0.0, 0.12, abs(fract(plank) - 0.5) * 2.0 - 0.8);
    alb = vec3(0.19, 0.16, 0.125) * (0.75 + 0.35 * vnoise(vec2(floor(plank), vLocal.y * 3.0))) * (1.0 - 0.35 * seam);
  } else if (kind == ${ROPE} || kind == ${BELT}) {
    float twist = fract((vLocal.x + vLocal.y + vLocal.z) * (kind == ${ROPE} ? 14.0 : 5.0));
    alb = (kind == ${ROPE} ? vec3(0.3, 0.25, 0.17) : vec3(0.12, 0.085, 0.06)) * (0.7 + 0.45 * smoothstep(0.2, 0.5, twist) * (1.0 - smoothstep(0.6, 0.9, twist)));
  } else {
    float grain = vnoise(vec2(vLocal.x * 2.0 + vLocal.y * 2.0, vLocal.z * 30.0)) * 0.6 + vnoise(vLocal.xy * 11.0) * 0.4;
    alb = mix(vec3(0.14, 0.12, 0.1), vec3(0.27, 0.225, 0.17), grain);
  }
  float lap = 0.09 * sin(vWorld.x * 0.8 + uTime * 1.3) + 0.06 * sin(vWorld.z * 1.1 - uTime * 0.9);
  float wet = 1.0 - smoothstep(0.0, 0.7, vWorld.y - lap);
  alb = mix(alb, alb * vec3(0.3, 0.38, 0.29), wet * 0.9);
  float sun = cloudShadow(vWorld.xz);
  float ndl = max(dot(n, uSunDir), 0.0);
  float through = kind == ${LINEN} ? pow(max(dot(-n, uSunDir), 0.0), 1.5) * 0.45 : 0.0;
  vec3 col = alb * (hemiLight(n) + uSunColor * (ndl * 0.9 + through) * sun);
  vec3 V = normalize(cameraPosition - vWorld);
  float rim = pow(1.0 - clamp(dot(n, V), 0.0, 1.0), 3.0) * pow(max(dot(-V, uSunDir), 0.0), 2.5);
  col += uSunColor * rim * sun * 0.2;
  gl_FragColor = vec4(applyFog(col, vWorld), 1.0);
}`;

/**
 * Where a drowned mill stands: the middle of its sails (the hub's x and z) and the way they face (a yaw, the way you
 * look at them from), and the hoist's two floors above the water: `from` where the basket waits at her roof's edge,
 * `to` at the top, level with the door's sill. The tower is as tall as the hoist needs: the hub stands `HUB_ABOVE`
 * over `to`.
 */
export interface MillSpot {
  hub: THREE.Vector2;
  facing: number;
  from: number;
  to: number;
  /** How far the sails reach, where they must be smaller than the hoist's own. */
  reach?: number;
}

export type MillSound = 'start' | 'creak' | 'settle' | 'flap' | 'click';

/**
 * An old tower mill standing in the flood, four big sails on its cap and a sack hoist on its side: a beam out of a
 * door under the cap, a rope from a drum over the beam's sheave down to a slatted basket. The player's circling round
 * the hub on screen turns the sails, one way only; they gather speed with their weight, coast a little when the
 * circling stops and brake to a stop. Once the hoist is engaged the turning winds the rope onto its drum and the
 * basket rises; a pawl clicks over the drum's ratchet and holds it wherever the sails stop, so it never sinks back.
 * Circling the wrong way only rocks the sails against the pawl. The fog's breath sways the idle sails a little.
 */
export class Windmill {
  readonly group = new THREE.Group();
  readonly rotor = new THREE.Group();
  readonly basket = new THREE.Group();
  /** On the end of the first sail's stock, turning with it: what the cat rides. */
  readonly perch = new THREE.Object3D();
  readonly objects: THREE.Object3D[];
  readonly hub = new THREE.Vector3();
  readonly facing: number;
  readonly from: number;
  readonly to: number;
  /** Radians turned, forward only: the left side rising. */
  angle = 0;
  speed = 0;
  /** The give of a wrong-way turn against the pawl (radians, zero or less), and its spring's speed. */
  rock = 0;
  rockSpeed = 0;
  /** The player's turning, smoothed: radians a second the cursor goes round the hub on screen, forward positive. */
  drive = 0;
  /** A push of the world's own, in the same units, for the safety valve. */
  assist = 0;
  /** Set by a crossing: the brake on; the hoist winding with the sails; her weight in the basket. */
  hold = false;
  engaged = false;
  aboard = false;
  /** Set while the cat rides a sail: they turn no faster than it can keep its feet. */
  catRiding = false;
  /** Radians of turn wound onto the drum since the hoist was engaged at the bottom. */
  wound = 0;
  /** Seconds since the player last turned it forward, and whether they last turned it the wrong way. */
  quiet = Infinity;
  wrong = false;
  /** Ratchet teeth the pawl has clicked over: for the capture tools. */
  clicks = 0;
  onSound: ((kind: MillSound, at: THREE.Vector3, strength: number) => void) | null = null;
  private breath = 0;
  private breathClock = 0;
  private braking = 0;
  private brakeFrom = 0;
  private moving = false;
  private turned = 0;
  private tooth = 0;
  private flapClock = 2;
  private readonly material: THREE.ShaderMaterial;
  private readonly drum = new THREE.Group();
  private readonly coil: THREE.Mesh;
  private readonly fall: THREE.Mesh;
  private readonly pawl: THREE.Mesh;
  private readonly tmp = new THREE.Vector3();
  private readonly tmp2 = new THREE.Vector3();
  private readonly screen = new THREE.Vector3();

  constructor(spot: MillSpot) {
    this.facing = spot.facing;
    this.from = spot.from;
    this.to = spot.to;
    const hubY = spot.to + HUB_ABOVE;
    this.hub.set(spot.hub.x, hubY, spot.hub.y);
    this.group.position.set(spot.hub.x, 0, spot.hub.y);
    this.group.rotation.y = spot.facing;
    this.rotor.position.set(0, hubY, 0);
    this.group.add(this.rotor);
    this.material = new THREE.ShaderMaterial({
      vertexShader: MILL_VERT, fragmentShader: MILL_FRAG,
      uniforms: { ...atmo.uniforms, uFlap: { value: 0 }, uBelt: { value: 0 } }, side: THREE.DoubleSide,
    });
    const mesh = (g: THREE.BufferGeometry) => {
      const m = new THREE.Mesh(g, this.material);
      m.frustumCulled = false;
      m.layers.enable(REFLECTION_LAYER);
      return m;
    };
    this.group.add(mesh(this.body()));
    this.rotor.add(mesh(this.sails()));
    this.rotor.scale.setScalar((spot.reach ?? SAIL.reach) / SAIL.reach);
    this.perch.position.set(-SAIL.reach + 0.18, SAIL.stock / 2 + 0.02, 0.12);
    this.rotor.add(this.perch);

    const drumY = spot.to + HOIST.beamAbove + 0.4;
    this.drum.position.set(DRUM.x, drumY, DRUM.z);
    this.drum.add(mesh(this.drumParts()));
    this.coil = mesh(tagged(new THREE.CylinderGeometry(HOIST.drumRadius + 0.03, HOIST.drumRadius + 0.03, 1, 16, 1).rotateX(Math.PI / 2), ROPE, 0, 0));
    this.drum.add(this.coil);
    this.group.add(this.drum);
    this.pawl = mesh(tagged(new THREE.BoxGeometry(0.05, 0.3, 0.05).translate(0, 0.15, 0), IRON, 0, 0));
    this.pawl.position.set(DRUM.x + 0.2, drumY + 0.18, DRUM.z - 0.33);
    this.group.add(this.pawl);
    this.fall = mesh(tagged(new THREE.CylinderGeometry(0.03, 0.03, 1, 6, 1).translate(0, -0.5, 0), ROPE, 0, 0));
    this.fall.position.set(HOIST.x, spot.to + HOIST.beamAbove, HOIST.z);
    this.group.add(this.fall);
    this.basket.add(mesh(this.basketParts()));
    this.group.add(this.basket);
    this.group.layers.enable(REFLECTION_LAYER);
    this.objects = [this.group];
    this.reset();
  }

  reset(): void {
    this.angle = tuning.crossings.mill.rest;
    this.speed = this.rock = this.rockSpeed = this.drive = this.assist = this.breath = this.braking = this.turned = this.wound = this.tooth = 0;
    this.hold = this.engaged = this.aboard = this.moving = this.wrong = false;
    this.quiet = Infinity;
    this.clicks = 0;
    this.pose();
  }

  /** The angle as drawn: the turn, the give of a rock, and the breath. */
  get shown(): number {
    return this.angle + this.rock + this.breath;
  }

  /** The most the hoist can wind: the basket's floor level with the door's sill. */
  get full(): number {
    return (this.to - this.from) / tuning.crossings.mill.rise;
  }

  /** The basket's floor above the water. */
  get floor(): number {
    return this.from + Math.min(this.wound, this.full) * tuning.crossings.mill.rise;
  }

  get topped(): boolean {
    return this.wound >= this.full - 1e-4;
  }

  /** The middle of the basket's floor, in the world. */
  basketFloor(out: THREE.Vector3): THREE.Vector3 {
    return this.group.localToWorld(out.set(HOIST.x, this.floor, HOIST.z));
  }

  /** On the side rope she holds with `hand` (0 her left, the tower's side as she faces out past the sails), `up` above the floor. */
  grip(hand: 0 | 1, out: THREE.Vector3, up: number = HOIST.grip): THREE.Vector3 {
    const u = THREE.MathUtils.clamp((up - HOIST.rim) / (HOIST.bar - HOIST.rim), 0, 1);
    const side = (hand === 0 ? 1 : -1) * THREE.MathUtils.lerp(HOIST.half - 0.02, HOIST.barHalf, u);
    return this.group.localToWorld(out.set(HOIST.x + side, this.floor + up, HOIST.z));
  }

  /** A point in the mill's own frame, into the world, in place. */
  at(local: THREE.Vector3): THREE.Vector3 {
    return this.group.localToWorld(local);
  }

  /** Where the cat comes down on the cap, in the mill's own frame. */
  capTop(out: THREE.Vector3): THREE.Vector3 {
    return out.set(-0.35, this.to + CURB_ABOVE + 1.7, -TOWER_BACK + 0.45);
  }

  /**
   * Tangential cursor movement round the hub on screen is torque, whatever size the circle; too near the hub to tell
   * which way it is going, or far out across the screen, it counts for less and then nothing.
   */
  read(camera: THREE.PerspectiveCamera, input: PointerInput, dt: number): void {
    const k = tuning.crossings.mill;
    let turning = 0;
    const h = this.screen.copy(this.hub).project(camera);
    if (input.present && !input.muted && h.z < 1 && dt > 0) {
      const a = camera.aspect;
      const ax = (input.prevNdc.x - h.x) * a, ay = input.prevNdc.y - h.y;
      const bx = (input.ndc.x - h.x) * a, by = input.ndc.y - h.y;
      const turned = Math.atan2(ax * by - ay * bx, ax * bx + ay * by);
      const r = Math.min(Math.hypot(ax, ay), Math.hypot(bx, by)) / 2;
      const weight = THREE.MathUtils.smoothstep(r, k.near, k.near * 2) * (1 - THREE.MathUtils.smoothstep(r, k.far * 0.7, k.far));
      turning = (-turned * weight * this.screenSense(camera)) / dt;
    }
    this.drive += (THREE.MathUtils.clamp(turning, -14, 14) - this.drive) * (1 - Math.exp(-dt * 8));
    if (this.drive > 0.6) {
      this.quiet = 0;
      this.wrong = false;
    } else this.quiet += dt;
    if (this.drive < -0.6) this.wrong = true;
  }

  /** 1 when forward is clockwise on screen (the sails seen from the front), -1 from behind. */
  private screenSense(camera: THREE.Camera): number {
    const a = this.rotor.localToWorld(this.tmp.set(-1, 0, 0));
    const b = this.rotor.localToWorld(this.tmp2.set(-1, 0.1, 0));
    const h = this.screen.copy(this.hub).project(camera);
    a.project(camera);
    b.project(camera);
    const cross = (a.x - h.x) * (b.y - h.y) - (a.y - h.y) * (b.x - h.x);
    return cross < 0 ? 1 : -1;
  }

  /**
   * The sails come up toward the speed the circling asks for over a second or so, slower with her weight on the
   * hoist; with nothing asking they coast down and the pawl brakes them to a stop. Wound to the top, they ease into
   * the stop rather than hitting it.
   */
  update(dt: number): void {
    if (dt <= 0) return;
    const k = tuning.crossings.mill;
    const push = this.drive + this.assist;
    const loaded = this.engaged && this.aboard;
    const cap = this.catRiding ? k.capCat : loaded ? k.capAboard : k.cap;
    const was = this.speed;
    if (this.hold || (this.engaged && this.topped)) {
      this.speed = 0;
    } else {
      const want = Math.min(cap, Math.max(0, push) * k.ratio);
      if (want > this.speed) this.speed += (want - this.speed) * (1 - Math.exp(-dt / (loaded ? k.spinUpAboard : k.spinUp)));
      else this.speed -= this.speed * (loaded ? k.dragAboard : k.drag) * dt;
      if (push <= 0.6 && this.speed < k.settleSpeed && this.speed > 0.002) {
        if (this.braking === 0) this.brakeFrom = Math.max(this.speed, was);
        this.braking += dt;
        this.speed = Math.max(0, this.speed - (k.settleSpeed / k.brakeFor) * dt);
      } else if (push > 0.6) this.braking = 0;
      let step = this.speed * dt;
      if (this.engaged) {
        const gap = this.full - this.wound;
        if (this.speed > 0 && gap < k.ease) {
          const most = Math.max(k.creep, cap * THREE.MathUtils.smoothstep(gap / k.ease, 0, 1));
          this.speed = Math.min(Math.max(this.speed, k.creep), most);
        }
        step = Math.min(this.speed * dt, gap);
        this.wound += step;
        if (this.topped && step > 0) {
          this.speed = 0;
          this.onSound?.('settle', this.hub, 0.8);
        }
      }
      this.angle += step;
      this.turned += step;
    }

    const give = this.aboard ? k.rockAboard : k.rockMax;
    const back = push < 0 && !this.hold ? push * k.ratio * 4 : 0;
    this.rockSpeed += (back - k.rockStiffness * this.rock - k.rockDamping * this.rockSpeed) * dt;
    this.rock = THREE.MathUtils.clamp(this.rock + this.rockSpeed * dt, -give, 0);
    if (this.rock <= -give && this.rockSpeed < 0) {
      if (this.rockSpeed < -0.05) this.onSound?.('click', this.hub, 0.5);
      this.rockSpeed = 0;
    }
    if (this.rock >= 0 && this.rockSpeed > 0) this.rockSpeed = 0;

    const still = !this.aboard && !this.hold && this.speed < 0.02;
    this.breathClock += dt;
    const sway = k.breath * Math.sin((this.breathClock / k.breathFor) * Math.PI * 2) * (0.75 + 0.25 * Math.sin(this.breathClock * 0.37));
    this.breath += ((still ? sway : 0) - this.breath) * (1 - Math.exp(-dt * 0.8));

    this.sounds(dt);
    const flap = Math.min(1, Math.abs(this.speed) * 1.4 + Math.max(0, Math.abs(this.drive) - 0.5) * 0.06 + Math.abs(this.rockSpeed) * 0.6);
    const u = this.material.uniforms.uFlap;
    u.value += (flap - u.value) * (1 - Math.exp(-dt * 3));
    this.pose();
  }

  private sounds(dt: number): void {
    const k = tuning.crossings.mill;
    const moving = this.speed > 0.06;
    if (moving && !this.moving) this.onSound?.('start', this.hub, Math.min(1, 0.3 + this.speed));
    if (!moving && this.moving && this.braking > 0) this.onSound?.('settle', this.hub, Math.min(1, this.brakeFrom * 1.5 + 0.3));
    this.moving = moving;
    if (this.turned > k.creakEvery) {
      this.turned = 0;
      this.onSound?.('creak', this.hub, Math.min(1, 0.35 + this.speed * 0.6));
    }
    const teeth = Math.floor((this.wound * k.rise) / HOIST.drumRadius / ((Math.PI * 2) / k.teeth));
    if (teeth > this.tooth) {
      this.tooth = teeth;
      this.clicks++;
      this.onSound?.('click', this.drum.getWorldPosition(this.tmp), Math.min(1, 0.4 + this.speed * 0.4));
    }
    this.flapClock -= dt * (0.4 + this.material.uniforms.uFlap.value * 2);
    if (this.flapClock <= 0) {
      this.flapClock = 1.4 + Math.random() * 2;
      this.onSound?.('flap', this.rotor.localToWorld(this.tmp.set(-3, -0.6, 0.2)), 0.25 + this.material.uniforms.uFlap.value * 0.6);
    }
  }

  private pose(): void {
    const k = tuning.crossings.mill;
    this.rotor.rotation.z = -this.shown;
    const rope = this.wound * k.rise;
    this.drum.rotation.z = -rope / HOIST.drumRadius;
    const share = Math.min(1, this.wound / Math.max(this.full, 1e-3));
    const len = 0.04 + 0.44 * share;
    this.coil.scale.set(1 + share * 0.25, 1 + share * 0.25, len);
    this.coil.position.z = -0.23 + len / 2;
    const tooth = (rope / HOIST.drumRadius) / ((Math.PI * 2) / k.teeth);
    this.pawl.rotation.z = 0.5 + 0.3 * (tooth - Math.floor(tooth));
    this.material.uniforms.uBelt.value = rope * 1.2;
    this.basket.position.set(HOIST.x, this.floor, HOIST.z);
    const top = this.to + HOIST.beamAbove - 0.02;
    this.fall.position.y = top;
    this.fall.scale.y = Math.max(0.05, top - (this.floor + HOIST.bar + 0.05));
    this.group.updateMatrixWorld(true);
  }

  /** The stone tower, its curb and cap, the windshaft out to the hub, the hoist's door, beam, sheave and belt. */
  private body(): THREE.BufferGeometry {
    const parts: THREE.BufferGeometry[] = [];
    const add = (g: THREE.BufferGeometry, kind: number) => parts.push(tagged(g, kind, 0, 0));
    const back = (g: THREE.BufferGeometry) => g.translate(0, 0, -TOWER_BACK);
    const curb = this.to + CURB_ABOVE, hubY = this.to + HUB_ABOVE;
    const radiusAt = (y: number) => THREE.MathUtils.lerp(TOWER_FOOT, TOWER_HEAD, (y + 3) / (curb + 3));
    add(back(new THREE.CylinderGeometry(TOWER_HEAD, TOWER_FOOT, curb + 3, 24, 6).translate(0, (curb - 3) / 2, 0)), STONE);
    add(back(new THREE.CylinderGeometry(TOWER_HEAD + 0.12, TOWER_HEAD + 0.12, 0.22, 24).translate(0, curb + 0.05, 0)), WOOD);
    const cap = new THREE.SphereGeometry(1, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2).scale(TOWER_HEAD + 0.25, 1.7, 1.85);
    add(cap.translate(0, curb + 0.1, -TOWER_BACK + 0.25), SHINGLE);
    add(new THREE.BoxGeometry(0.16, 0.22, 3.3).translate(0, curb + 1.72, -TOWER_BACK + 0.1), WOOD);
    add(new THREE.CylinderGeometry(0.16, 0.19, 0.7, 8).rotateX(Math.PI / 2).translate(0, hubY, -0.25), WOOD);
    add(new THREE.CylinderGeometry(0.34, 0.32, 0.42, 12).rotateX(Math.PI / 2).translate(0, hubY, 0.05), WOOD);
    add(new THREE.CylinderGeometry(0.12, 0.12, 0.6, 8).rotateX(Math.PI / 2).translate(0, hubY, 0.2), IRON);
    for (const [y, a] of [[2.2, 0], [5.6, 0.2], [this.to - 2.2, -0.15]] as const) {
      const r = radiusAt(y);
      add(new THREE.BoxGeometry(0.42, 0.62, 0.3).translate(0, y, r - 0.1).rotateY(a).translate(0, 0, -TOWER_BACK), HOLLOW);
    }
    const doorX = -radiusAt(this.to + 0.8);
    add(new THREE.BoxGeometry(0.4, 1.5, 0.78).translate(doorX + 0.12, this.to + 0.75, HOIST.z), HOLLOW);
    add(new THREE.BoxGeometry(0.16, 0.14, 1.0).translate(doorX - 0.02, this.to - 0.04, HOIST.z), WOOD);
    add(new THREE.BoxGeometry(0.16, 0.14, 1.0).translate(doorX - 0.02, this.to + 1.56, HOIST.z), WOOD);
    const beamY = this.to + HOIST.beamAbove;
    const beamFrom = doorX + 0.5, beamTo = HOIST.x - 0.18;
    add(new THREE.BoxGeometry(beamFrom - beamTo, 0.24, 0.22).translate((beamFrom + beamTo) / 2, beamY + 0.12, HOIST.z), WOOD);
    const braceFrom = new THREE.Vector2(doorX + 0.05, this.to + 1.75), braceTo = new THREE.Vector2(HOIST.x + 1.0, beamY);
    const brace = braceTo.clone().sub(braceFrom);
    add(new THREE.BoxGeometry(brace.length(), 0.14, 0.14).rotateZ(Math.atan2(brace.y, brace.x))
      .translate((braceFrom.x + braceTo.x) / 2, (braceFrom.y + braceTo.y) / 2, HOIST.z), WOOD);
    const sheave = new THREE.Vector2(HOIST.x + SHEAVE_R, beamY - 0.02);
    add(new THREE.CylinderGeometry(SHEAVE_R + 0.03, SHEAVE_R + 0.03, 0.07, 12).rotateX(Math.PI / 2).translate(sheave.x, sheave.y, HOIST.z), WOOD);
    for (const s of [-1, 1]) add(new THREE.BoxGeometry(0.3, 0.34, 0.03).translate(sheave.x, beamY + 0.02, HOIST.z + s * 0.07), IRON);
    const drumY = beamY + 0.4;
    for (const s of [-1, 1]) add(new THREE.BoxGeometry(0.12, 0.55, 0.1).translate(DRUM.x, beamY + 0.4, DRUM.z + s * 0.29), WOOD);
    const run = new THREE.Vector2(sheave.x, beamY - 0.02 + SHEAVE_R).sub(new THREE.Vector2(DRUM.x, drumY + HOIST.drumRadius + 0.03));
    add(new THREE.CylinderGeometry(0.022, 0.022, run.length(), 5).rotateZ(Math.PI / 2 + Math.atan2(run.y, run.x))
      .translate(DRUM.x + run.x / 2, drumY + HOIST.drumRadius + 0.03 + run.y / 2, HOIST.z - 0.1), ROPE);
    const pulleyY = curb + 0.75, pulleyX = -(TOWER_HEAD + 0.25) * Math.sqrt(1 - (0.65 / 1.7) ** 2) - 0.05;
    add(new THREE.CylinderGeometry(0.26, 0.26, 0.08, 14).rotateX(Math.PI / 2).translate(pulleyX, pulleyY, HOIST.z + 0.36), WOOD);
    for (const s of [-1, 1]) {
      const a = new THREE.Vector2(DRUM.x + s * 0.24, drumY), b = new THREE.Vector2(pulleyX + s * 0.26, pulleyY);
      const d = b.clone().sub(a);
      add(new THREE.BoxGeometry(0.035, d.length(), 0.07).rotateZ(-Math.atan2(d.x, d.y)).translate((a.x + b.x) / 2, (a.y + b.y) / 2, HOIST.z + 0.36), BELT);
    }
    return merged(parts);
  }

  /** The drum on its axle: its barrel, the ratchet wheel on one end and the belt's pulley on the other. */
  private drumParts(): THREE.BufferGeometry {
    const parts: THREE.BufferGeometry[] = [];
    const add = (g: THREE.BufferGeometry, kind: number) => parts.push(tagged(g, kind, 0, 0));
    const r = HOIST.drumRadius;
    add(new THREE.CylinderGeometry(r, r, 0.5, 14).rotateX(Math.PI / 2), WOOD);
    add(new THREE.CylinderGeometry(0.05, 0.05, 0.86, 6).rotateX(Math.PI / 2), IRON);
    add(new THREE.CylinderGeometry(r + 0.06, r + 0.06, 0.04, 14).rotateX(Math.PI / 2).translate(0, 0, 0.25), WOOD);
    add(new THREE.CylinderGeometry(r + 0.06, r + 0.06, 0.04, 14).rotateX(Math.PI / 2).translate(0, 0, -0.25), WOOD);
    add(new THREE.CylinderGeometry(0.24, 0.24, 0.07, 14).rotateX(Math.PI / 2).translate(0, 0, 0.36), WOOD);
    add(new THREE.BoxGeometry(0.44, 0.05, 0.075).translate(0, 0, 0.4), IRON);
    add(new THREE.CylinderGeometry(0.22, 0.22, 0.05, 14).rotateX(Math.PI / 2).translate(0, 0, -0.33), IRON);
    const teeth = tuning.crossings.mill.teeth;
    for (let i = 0; i < teeth; i++) {
      const a = (i / teeth) * Math.PI * 2;
      add(new THREE.BoxGeometry(0.07, 0.08, 0.05).translate(0.25, 0.02, 0).rotateZ(a).translate(0, 0, -0.33), IRON);
    }
    return merged(parts);
  }

  /** The slatted basket: a floor of boards on skids, slatted sides, corner posts, a lip front and back, the bar and its ropes. */
  private basketParts(): THREE.BufferGeometry {
    const parts: THREE.BufferGeometry[] = [];
    const add = (g: THREE.BufferGeometry, kind: number) => parts.push(tagged(g, kind, 0, 0));
    const h = HOIST.half, rim = HOIST.rim;
    add(new THREE.BoxGeometry(h * 2, 0.07, h * 2).translate(0, -0.035, 0), BOARDS);
    for (const s of [-1, 1]) add(new THREE.BoxGeometry(0.08, 0.08, h * 2 + 0.08).translate(s * (h - 0.1), -0.11, 0), WOOD);
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) add(new THREE.BoxGeometry(0.07, rim + 0.06, 0.07).translate(sx * (h - 0.02), (rim + 0.06) / 2 - 0.04, sz * (h - 0.02)), WOOD);
      for (const y of [0.12, rim - 0.02]) add(new THREE.BoxGeometry(0.05, 0.06, h * 2).translate(sx * (h - 0.02), y, 0), WOOD);
      for (let i = 0; i < 5; i++) add(new THREE.BoxGeometry(0.03, rim - 0.08, 0.07).translate(sx * (h - 0.01), rim / 2, -h + 0.18 + i * ((h * 2 - 0.36) / 4)), WOOD);
    }
    for (const sz of [-1, 1]) add(new THREE.BoxGeometry(h * 2, 0.1, 0.05).translate(0, 0.05, sz * (h - 0.02)), WOOD);
    add(new THREE.CylinderGeometry(0.045, 0.045, HOIST.barHalf * 2 + 0.16, 7).rotateZ(Math.PI / 2).translate(0, HOIST.bar, 0), WOOD);
    for (const s of [-1, 1]) {
      const a = new THREE.Vector2(s * (h - 0.02), rim), b = new THREE.Vector2(s * HOIST.barHalf, HOIST.bar);
      const d = b.clone().sub(a);
      add(new THREE.CylinderGeometry(0.03, 0.03, d.length(), 6).rotateZ(-Math.atan2(d.x, d.y)).translate((a.x + b.x) / 2, (a.y + b.y) / 2, 0), ROPE);
    }
    add(new THREE.TorusGeometry(0.06, 0.018, 5, 10).translate(0, HOIST.bar + 0.08, 0), IRON);
    return merged(parts);
  }

  /** Four sails, each a stock with its lattice of bars and an outer rail, and scraps of old linen left on three of them. */
  private sails(): THREE.BufferGeometry {
    const parts: THREE.BufferGeometry[] = [];
    const w = SAIL.width, fwd = SAIL.forward, slope = Math.atan2(fwd, w);
    for (let side = 0; side < 4; side++) {
      const sail: THREE.BufferGeometry[] = [];
      const piece = (g: THREE.BufferGeometry, kind: number, shake: number | number[] = 0, phase = 0) => sail.push(tagged(g, kind, shake, phase));
      piece(new THREE.BoxGeometry(SAIL.reach + 0.4, SAIL.stock, 0.16).translate(-(SAIL.reach + 0.4) / 2 + 0.4, 0, 0.12), WOOD);
      const railLen = SAIL.to - SAIL.from + 0.08;
      piece(new THREE.BoxGeometry(railLen, 0.1, 0.1).translate(-(SAIL.from + SAIL.to) / 2, -w, fwd + 0.12), WOOD);
      piece(new THREE.BoxGeometry(railLen, 0.06, 0.06).translate(-(SAIL.from + SAIL.to) / 2, -w * 0.5, fwd * 0.5 + 0.12), WOOD);
      const bars = 11;
      const span = Math.hypot(w, fwd);
      for (let i = 0; i < bars; i++) {
        if ((side === 1 && i === 4) || (side === 3 && (i === 7 || i === 2))) continue;
        const along = SAIL.from + 0.04 + (i / (bars - 1)) * (SAIL.to - SAIL.from - 0.08);
        const broken = side === 2 && i === 6;
        const len = broken ? span * 0.55 : span;
        const bar = new THREE.BoxGeometry(0.07, len, 0.07).translate(0, span / 2 - len / 2, 0);
        if (broken) bar.translate(0, -span / 2, 0).rotateZ(0.35).translate(0, span / 2, 0);
        bar.rotateX(-slope).translate(-along, -w / 2, fwd / 2 + 0.12);
        piece(bar, WOOD);
      }
      const scraps = side === 0 ? [[2.1, 0.8, 1.1, 0.2], [3.6, 0.55, 0.7, 0.9], [5.6, 0.7, 0.9, 0.7]]
        : side === 2 ? [[1.9, 0.6, 0.6, 0.6], [4.4, 1.0, 1.0, 0.4], [6.2, 0.5, 0.5, 0.1]] : side === 1 ? [[3.0, 0.5, 0.45, 0.3]] : [];
      for (const [at, wide, drop, phase] of scraps) {
        const cloth = new THREE.PlaneGeometry(wide, drop, 4, 4);
        const pos = cloth.attributes.position;
        const shake: number[] = [];
        for (let i = 0; i < pos.count; i++) {
          const y = pos.getY(i);
          const hang = (drop / 2 - y) / drop;
          pos.setY(i, y - Math.max(0, Math.sin(pos.getX(i) * 6 + phase * 10)) * 0.14 * hang);
          shake.push(hang);
        }
        cloth.rotateX(-slope).translate(-at, -drop / 2 - 0.05, fwd * (drop / 2 + 0.05) / w + 0.1);
        piece(cloth, LINEN, shake, phase);
      }
      parts.push(merged(sail).rotateZ((side * Math.PI) / 2));
    }
    return merged(parts);
  }
}
