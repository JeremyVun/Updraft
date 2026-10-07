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
/** The stone tower: its radius at the water, how far behind the sails its middle stands, and its height out of the water. */
const TOWER_RADIUS = 1.35;
const TOWER_BACK = 1.8;
const TOWER_TOP = 3.1;

const MILL_VERT = /* glsl */ `
uniform float uTime;
uniform float uFlap;
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
    float course = vLocal.y * 3.2;
    float run = atan(vLocal.x, vLocal.z + ${TOWER_BACK.toFixed(2)}) * 4.0 + fract(floor(course) * 0.37) * 3.0;
    float joint = max(1.0 - smoothstep(0.0, 0.09, fract(course)), 1.0 - smoothstep(0.0, 0.06, fract(run)));
    alb = vec3(0.15, 0.14, 0.125) * (0.78 + 0.38 * fract(sin(dot(vec2(floor(course), floor(run)), vec2(12.9898, 78.233))) * 43758.5)) * (1.0 - 0.4 * joint);
    float moss = smoothstep(0.55, 0.8, vnoise(vLocal.xy * 1.3 + vLocal.z) * 0.7 + vnoise(vLocal.xy * 6.0) * 0.3 + 0.25 * (1.0 - smoothstep(0.0, 2.0, vLocal.y)));
    alb = mix(alb, vec3(0.09, 0.11, 0.045), moss * 0.75);
  } else if (kind == ${SHINGLE}) {
    float row = vLocal.y * 9.0;
    alb = vec3(0.11, 0.1, 0.09) * (0.75 + 0.4 * vnoise(vec2(atan(vLocal.x, vLocal.z) * 9.0, floor(row)))) * (0.75 + 0.3 * smoothstep(0.0, 0.25, fract(row)));
  } else if (kind == ${LINEN}) {
    alb = vec3(0.42, 0.39, 0.33) * (0.8 + 0.25 * vnoise(vLocal.xy * 9.0));
  } else if (kind == ${IRON}) {
    alb = vec3(0.05, 0.045, 0.045);
  } else if (kind == ${HOLLOW}) {
    alb = vec3(0.012, 0.012, 0.014);
  } else if (kind == ${BOARDS}) {
    float plank = atan(vLocal.x, vLocal.z + ${TOWER_BACK.toFixed(2)}) * 14.0 + vLocal.x * 4.0;
    float seam = 1.0 - smoothstep(0.0, 0.12, abs(fract(plank) - 0.5) * 2.0 - 0.8);
    alb = vec3(0.17, 0.145, 0.12) * (0.75 + 0.35 * vnoise(vec2(floor(plank), vLocal.y * 3.0))) * (1.0 - 0.35 * seam);
  } else {
    float grain = vnoise(vec2(vLocal.x * 2.0 + vLocal.y * 2.0, vLocal.z * 30.0)) * 0.6 + vnoise(vLocal.xy * 11.0) * 0.4;
    alb = mix(vec3(0.14, 0.12, 0.1), vec3(0.26, 0.22, 0.17), grain);
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

/** Where a drowned mill stands: the middle of its sails, and the way they face (a yaw, the way you look at them from). */
export interface MillSpot {
  hub: THREE.Vector3;
  facing: number;
}

/**
 * The sails' measurements, in a sail's own frame: out along its stock from the hub, across toward its leading side,
 * and forward out of the plane it turns in. The lattice hangs on the trailing side, its outer rail standing forward
 * of the stock as a weathered sail's does, so a child on the rail has the stock beside her hip and the lattice clear
 * of her body.
 */
export const SAIL = {
  /** Where the stock ends, and where the lattice starts and ends along it. */
  reach: 3.95, from: 0.9, to: 3.85,
  /** The rail: how far across from the stock, how far forward of the plane, how thick and how deep its top. */
  width: 1.0, forward: 0.42, rail: 0.12, railDepth: 0.36,
} as const;

/** How high the hub stands out of the water. */
export const HUB_HEIGHT = 4.6;

/**
 * On top of the boarding sail's rail, `along` it from the hub with the sail `angle` above level, in the mill's own
 * frame: x to the right seen from in front of the sails, y up from the water, z out of their front.
 */
export function railAt(angle: number, along: number): THREE.Vector3 {
  const across = -SAIL.width + SAIL.rail / 2;
  return new THREE.Vector3(-along * Math.cos(angle) + across * Math.sin(angle),
    HUB_HEIGHT + along * Math.sin(angle) + across * Math.cos(angle), SAIL.forward);
}

export type MillSound = 'start' | 'creak' | 'settle' | 'flap';

/**
 * An old tower mill standing in the flood to its shoulders, with two opposite sails left of its four. It turns one
 * way only, round its windshaft, from torque the player puts into it by circling round its hub on screen; it coasts
 * and brakes to a stop when they let go, and circling the wrong way only rocks it. The fog's breath sways the empty
 * sails a little. A crossing can hold it still, ease it into a dwell at an angle, or load it with a rider.
 */
export class Windmill {
  readonly group = new THREE.Group();
  readonly rotor = new THREE.Group();
  readonly objects: THREE.Object3D[];
  readonly hub = new THREE.Vector3();
  readonly facing: number;
  /** Radians turned, forward only: the boarding side's tip rising. */
  angle = 0;
  speed = 0;
  /** The give of a wrong-way turn, never more than a rock (radians, zero or less), and its spring's speed. */
  rock = 0;
  rockSpeed = 0;
  /** The player's turning, smoothed: radians a second the cursor goes round the hub on screen, forward positive. */
  drive = 0;
  /** A push of the world's own, in the same units, for the safety valve. */
  assist = 0;
  /** Set by a crossing: hold it where it is; ease into and stop at this angle of the boarding sail; she is aboard. */
  hold = false;
  dwellAt: number | null = null;
  aboard = false;
  /** Settled at `dwellAt`. */
  dwelling = false;
  /** Seconds since the player last turned it forward, and the way they last turned it. */
  quiet = Infinity;
  wrong = false;
  onSound: ((kind: MillSound, at: THREE.Vector3, strength: number) => void) | null = null;
  private breath = 0;
  private breathClock = 0;
  private braking = 0;
  private brakeFrom = 0;
  private moving = false;
  private turned = 0;
  private flapClock = 2;
  private readonly material: THREE.ShaderMaterial;
  private readonly tmp = new THREE.Vector3();
  private readonly tmp2 = new THREE.Vector3();
  private readonly screen = new THREE.Vector3();

  constructor(spot: MillSpot) {
    this.hub.copy(spot.hub);
    this.facing = spot.facing;
    this.group.position.set(spot.hub.x, 0, spot.hub.z);
    this.group.rotation.y = spot.facing;
    this.rotor.position.set(0, spot.hub.y, 0);
    this.group.add(this.rotor);
    this.material = new THREE.ShaderMaterial({
      vertexShader: MILL_VERT, fragmentShader: MILL_FRAG,
      uniforms: { ...atmo.uniforms, uFlap: { value: 0 } }, side: THREE.DoubleSide,
    });
    const body = new THREE.Mesh(this.body(spot.hub.y), this.material);
    const sails = new THREE.Mesh(this.sails(), this.material);
    for (const m of [body, sails]) {
      m.frustumCulled = false;
      m.layers.enable(REFLECTION_LAYER);
    }
    this.group.add(body);
    this.rotor.add(sails);
    this.group.layers.enable(REFLECTION_LAYER);
    this.objects = [this.group];
    this.reset();
  }

  reset(): void {
    this.angle = tuning.crossings.mill.rest;
    this.speed = this.rock = this.rockSpeed = this.drive = this.assist = this.breath = this.braking = this.turned = 0;
    this.hold = this.aboard = this.dwelling = this.moving = this.wrong = false;
    this.dwellAt = null;
    this.quiet = Infinity;
    this.pose();
  }

  /** The boarding side's sail, as an angle above level: whichever of the two is on that side. */
  get sail(): number {
    return sailAngle(this.shown);
  }

  /** The angle as drawn: the turn, the give of a rock, and the breath. */
  get shown(): number {
    return this.angle + this.rock + this.breath;
  }

  /** A point in the boarding sail's frame (out along the stock, across, forward), in the world as it is now. */
  sailPoint(out: THREE.Vector3, along: number, across: number, forward: number): THREE.Vector3 {
    const flip = Math.cos(this.shown - this.sail) > 0 ? 1 : -1;
    return this.rotor.localToWorld(out.set(-along * flip, across * flip, forward));
  }

  /** On top of the boarding sail's rail, `along` out from the hub, in the middle of its depth. */
  railTop(along: number, out: THREE.Vector3, forward: number = SAIL.forward): THREE.Vector3 {
    return this.sailPoint(out, along, -SAIL.width + SAIL.rail / 2, forward);
  }

  /** On the front of the boarding sail's stock, where a hand holds it. */
  stockAt(along: number, out: THREE.Vector3): THREE.Vector3 {
    return this.sailPoint(out, along, 0.02, 0.07);
  }

  /** The way along the rail toward its tip, level, as a yaw. */
  get outward(): number {
    return this.facing - Math.PI / 2;
  }

  /** In the sails' plane, round the hub: the boarding side's tip rising is forward. */
  toRotor(world: THREE.Vector3, out: THREE.Vector3): THREE.Vector3 {
    return this.rotor.worldToLocal(out.copy(world));
  }

  fromRotor(local: THREE.Vector3, out: THREE.Vector3): THREE.Vector3 {
    return this.rotor.localToWorld(out.copy(local));
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
      const weight = THREE.MathUtils.smoothstep(r, k.near, k.near * 2) * (1 - THREE.MathUtils.smoothstep(r, k.far * 0.65, k.far));
      turning = (-turned * weight * this.screenSense(camera)) / dt;
    }
    this.drive += (THREE.MathUtils.clamp(turning, -12, 12) - this.drive) * (1 - Math.exp(-dt * 6));
    if (this.drive > 0.6) {
      this.quiet = 0;
      this.wrong = false;
    } else this.quiet += dt;
    if (this.drive < -0.6) this.wrong = true;
  }

  /** 1 when forward is clockwise on screen (the sails seen from the front, clockwise being a negative turn), -1 from behind. */
  private screenSense(camera: THREE.Camera): number {
    const a = this.tmp.set(-1, 0, 0);
    this.rotor.localToWorld(a);
    const b = this.rotor.localToWorld(this.tmp2.set(-1, 0.1, 0));
    const h = this.screen.copy(this.hub).project(camera);
    a.project(camera);
    b.project(camera);
    const cross = (a.x - h.x) * (b.y - h.y) - (a.y - h.y) * (b.x - h.x);
    return cross < 0 ? 1 : -1;
  }

  update(dt: number): void {
    if (dt <= 0) return;
    const k = tuning.crossings.mill;
    const push = this.drive + this.assist;
    const cap = this.aboard ? k.capAboard : k.cap;
    const was = this.speed;
    if (this.hold) {
      this.speed = 0;
    } else {
      if (push > 0) this.speed += push * k.gain * dt;
      this.speed -= this.speed * k.drag * dt;
      if (push <= 0.6 && this.speed < k.settleSpeed && this.speed > 0.002) {
        if (this.braking === 0) this.brakeFrom = Math.max(this.speed, was);
        this.braking += dt;
        this.speed = Math.max(0, this.speed - (k.settleSpeed / k.brakeFor) * dt);
      } else if (push > 0.6) this.braking = 0;
      this.speed = THREE.MathUtils.clamp(this.speed, 0, cap);
      this.ease(dt);
      this.angle += this.speed * dt;
      this.turned += this.speed * dt;
    }

    /** The wrong way only gives a little against the spring, and less with her aboard; it never turns it back. */
    const give = this.aboard ? k.rockAboard : k.rockMax;
    const back = push < 0 && !this.hold ? push * k.gain * 1.6 : 0;
    this.rockSpeed += (back - k.rockStiffness * this.rock - k.rockDamping * this.rockSpeed) * dt;
    this.rock = THREE.MathUtils.clamp(this.rock + this.rockSpeed * dt, -give, 0);
    if (this.rock <= -give && this.rockSpeed < 0) this.rockSpeed = 0;
    if (this.rock >= 0 && this.rockSpeed > 0) this.rockSpeed = 0;

    const still = !this.aboard && !this.hold && !this.dwelling && this.speed < 0.02;
    this.breathClock += dt;
    const sway = k.breath * Math.sin((this.breathClock / k.breathFor) * Math.PI * 2) * (0.75 + 0.25 * Math.sin(this.breathClock * 0.37));
    this.breath += ((still ? sway : 0) - this.breath) * (1 - Math.exp(-dt * 0.8));

    this.sounds(dt);
    const flap = Math.min(1, Math.abs(this.speed) * 2.2 + Math.max(0, Math.abs(this.drive) - 0.5) * 0.08 + Math.abs(this.rockSpeed) * 0.6);
    const u = this.material.uniforms.uFlap;
    u.value += (flap - u.value) * (1 - Math.exp(-dt * 3));
    this.pose();
  }

  /** Into a dwell: slower and slower as the sail comes to it, never stopping short, then settled there. */
  private ease(dt: number): void {
    const k = tuning.crossings.mill;
    if (this.dwellAt === null) {
      this.dwelling = false;
      return;
    }
    const gap = ((this.dwellAt - sailAngle(this.angle)) % Math.PI + Math.PI) % Math.PI;
    if (this.dwelling && (gap < 1e-4 || gap > Math.PI - 1e-3)) {
      this.speed = 0;
      return;
    }
    this.dwelling = false;
    if (gap > k.ease) return;
    const most = Math.max(k.creep, (this.aboard ? k.capAboard : k.cap) * THREE.MathUtils.smoothstep(gap / k.ease, 0, 1));
    if (this.speed > 0 && this.speed < k.creep) this.speed = k.creep;
    this.speed = Math.min(this.speed, most);
    if (this.speed * dt >= gap) {
      this.angle += gap;
      this.speed = 0;
      this.dwelling = true;
      this.onSound?.('settle', this.hub, 0.7);
    }
  }

  private sounds(dt: number): void {
    const moving = this.speed > 0.05;
    if (moving && !this.moving) this.onSound?.('start', this.hub, Math.min(1, this.speed * 3));
    if (!moving && this.moving && !this.dwelling && this.braking > 0) this.onSound?.('settle', this.hub, Math.min(1, this.brakeFrom * 4 + 0.3));
    this.moving = moving;
    if (this.turned > 0.55) {
      this.turned = 0;
      this.onSound?.('creak', this.hub, Math.min(1, 0.35 + this.speed * 1.4));
    }
    this.flapClock -= dt * (0.4 + this.material.uniforms.uFlap.value * 2);
    if (this.flapClock <= 0) {
      this.flapClock = 1.4 + Math.random() * 2;
      this.onSound?.('flap', this.sailPoint(this.tmp, 1.6, -0.3, 0.1), 0.25 + this.material.uniforms.uFlap.value * 0.6);
    }
  }

  private pose(): void {
    this.rotor.rotation.z = -this.shown;
    this.group.updateMatrixWorld(true);
  }

  /** The stone tower, its wooden cap, and the windshaft out to the hub. */
  private body(hubY: number): THREE.BufferGeometry {
    const parts: THREE.BufferGeometry[] = [];
    const add = (g: THREE.BufferGeometry, kind: number) => parts.push(tagged(g.translate(0, 0, -TOWER_BACK), kind, 0, 0));
    const top = TOWER_RADIUS * 0.9, skirt = hubY - 0.45;
    add(new THREE.CylinderGeometry(top, TOWER_RADIUS, TOWER_TOP + 3, 22, 4).translate(0, (TOWER_TOP - 3) / 2, 0), STONE);
    add(new THREE.CylinderGeometry(top + 0.08, top + 0.08, 0.2, 22).translate(0, TOWER_TOP + 0.05, 0), WOOD);
    add(new THREE.BoxGeometry(0.42, 0.6, 0.2).translate(0, TOWER_TOP - 0.85, top + 0.02), HOLLOW);
    add(new THREE.CylinderGeometry(top - 0.12, top + 0.16, skirt - TOWER_TOP, 22, 1, true).translate(0, (skirt + TOWER_TOP) / 2 + 0.05, 0), BOARDS);
    add(new THREE.ConeGeometry(top + 0.02, hubY + 1.55 - skirt, 22, 1, true).translate(0, (hubY + 1.55 + skirt) / 2, 0), SHINGLE);
    const breast = new THREE.Shape([new THREE.Vector2(-0.5, -0.5), new THREE.Vector2(0.5, -0.5), new THREE.Vector2(0.5, 0.35),
      new THREE.Vector2(0, 0.75), new THREE.Vector2(-0.5, 0.35)]);
    add(new THREE.ExtrudeGeometry(breast, { depth: 1.1, bevelEnabled: false }).translate(0, hubY, top - 0.7), BOARDS);
    add(new THREE.BoxGeometry(0.62, 0.07, 1.2).rotateZ(0.68).translate(-0.27, hubY + 0.57, top - 0.12), SHINGLE);
    add(new THREE.BoxGeometry(0.62, 0.07, 1.2).rotateZ(-0.68).translate(0.27, hubY + 0.57, top - 0.12), SHINGLE);
    add(new THREE.CylinderGeometry(0.15, 0.18, TOWER_BACK - top - 0.2, 8).rotateX(Math.PI / 2).translate(0, hubY, (TOWER_BACK + top) / 2 + 0.1), WOOD);
    add(new THREE.CylinderGeometry(0.3, 0.28, 0.4, 12).rotateX(Math.PI / 2).translate(0, hubY, TOWER_BACK - 0.1), WOOD);
    add(new THREE.CylinderGeometry(0.11, 0.11, 0.46, 8).rotateX(Math.PI / 2).translate(0, hubY, TOWER_BACK + 0.06), IRON);
    return merged(parts);
  }

  /** Two opposite sails, each a stock with its lattice of bars, a rail and a few scraps of linen left on it. */
  private sails(): THREE.BufferGeometry {
    const parts: THREE.BufferGeometry[] = [];
    for (const side of [0, 1]) {
      const sail: THREE.BufferGeometry[] = [];
      const piece = (g: THREE.BufferGeometry, kind: number, shake: number | number[] = 0, phase = 0) => sail.push(tagged(g, kind, shake, phase));
      piece(new THREE.BoxGeometry(SAIL.reach + 0.35, 0.18, 0.16).translate(-(SAIL.reach + 0.35) / 2 + 0.35, 0, 0), WOOD);
      const railLen = SAIL.to - SAIL.from + 0.06;
      piece(new THREE.BoxGeometry(railLen, SAIL.rail, SAIL.railDepth).translate(-(SAIL.from + SAIL.to) / 2, -SAIL.width, SAIL.forward), WOOD);
      piece(new THREE.BoxGeometry(railLen, 0.07, 0.08).translate(-(SAIL.from + SAIL.to) / 2, -SAIL.width * 0.5, SAIL.forward * 0.5), WOOD);
      const bars = 7;
      const span = Math.hypot(SAIL.width, SAIL.forward);
      for (let i = 0; i < bars; i++) {
        /** Worn: one bar gone from one sail, and one on the other snapped and hanging from the stock. */
        if (side === 1 && i === 3) continue;
        const along = SAIL.from + 0.04 + (i / (bars - 1)) * (SAIL.to - SAIL.from - 0.08);
        const broken = side === 1 && i === 5;
        const len = broken ? span * 0.55 : span;
        const bar = new THREE.BoxGeometry(0.08, len, 0.08).translate(0, span / 2 - len / 2, 0);
        if (broken) bar.translate(0, -span / 2, 0).rotateZ(0.35).translate(0, span / 2, 0);
        bar.rotateX(-Math.atan2(SAIL.forward, SAIL.width)).translate(-along, -SAIL.width / 2, SAIL.forward / 2);
        piece(bar, WOOD);
      }
      for (const [at, span, drop, phase] of side === 0 ? [[1.55, 0.62, 0.85, 0.2], [2.5, 0.4, 0.5, 0.9], [3.45, 0.5, 0.62, 0.7]] : [[1.3, 0.45, 0.4, 0.6], [2.75, 0.8, 0.78, 0.4]]) {
        const cloth = new THREE.PlaneGeometry(span, drop, 4, 4);
        const pos = cloth.attributes.position;
        const shake: number[] = [];
        for (let i = 0; i < pos.count; i++) {
          const y = pos.getY(i);
          const hang = (drop / 2 - y) / drop;
          pos.setY(i, y - Math.max(0, Math.sin(pos.getX(i) * 6 + phase * 10)) * 0.14 * hang);
          shake.push(hang);
        }
        cloth.rotateX(-Math.atan2(SAIL.forward, SAIL.width)).translate(-at, -drop / 2 - 0.04, SAIL.forward * (drop / 2 + 0.04) / SAIL.width - 0.02);
        piece(cloth, LINEN, shake, phase);
      }
      const g = merged(sail);
      if (side === 1) g.rotateZ(Math.PI);
      parts.push(g);
    }
    return merged(parts);
  }
}

/** The angle above level of whichever of the two sails is on the boarding side. */
export function sailAngle(angle: number): number {
  return ((angle + Math.PI / 2) % Math.PI + Math.PI) % Math.PI - Math.PI / 2;
}
