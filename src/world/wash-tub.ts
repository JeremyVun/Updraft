import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { FOAM, Marks, RING } from '../fx/sealife/marks';
import { screenBrush } from '../creatures/motion';
import type { PointerInput } from '../input/pointer';
import { tuning } from '../tuning';
import type { WindField } from '../wind/field';
import { INSIDE_HULL } from '../traveller/boat/waterline';
import { ATMO_GLSL, atmo } from './atmosphere';
import { REFLECTION_LAYER } from './water/reflection';
import { swellAt, swellUniforms, type Swell } from './water/swell';

/** Its size, in its own space: y up from the outside of its bottom. */
const BOTTOM = 0.37;
const TOP = 0.44;
const HEIGHT = 0.36;
const WALL = 0.028;
/** The boards it stands on inside, level, a little above its bottom. */
const FLOOR = 0.045;
const STAVES = 19;

const WOOD = 0;
const INSIDE = 1;
const RIM = 2;
const IRON = 3;
const BOARDS = 4;

const radiusAt = (y: number) => THREE.MathUtils.lerp(BOTTOM, TOP, y / HEIGHT);

function tagged(geo: THREE.BufferGeometry, kind: number): THREE.BufferGeometry {
  const g = geo.index ? geo.toNonIndexed() : geo;
  if (g.getAttribute('uv')) g.deleteAttribute('uv');
  const n = g.attributes.position.count;
  g.setAttribute('aKind', new THREE.BufferAttribute(new Float32Array(n).fill(kind), 1));
  return g;
}

/** A band round the tub from `y0` to `y1`, `out` beyond the wall's face (negative inside it), facing outward or in. */
function band(y0: number, y1: number, out: number, inward: boolean, kind: number): THREE.BufferGeometry {
  const pos: number[] = [];
  const nor: number[] = [];
  const slope = (TOP - BOTTOM) / HEIGHT;
  const segs = 48;
  for (let i = 0; i < segs; i++) {
    const a0 = (i / segs) * Math.PI * 2, a1 = ((i + 1) / segs) * Math.PI * 2;
    const at = (a: number, y: number) => [Math.cos(a) * (radiusAt(y) + out), y, Math.sin(a) * (radiusAt(y) + out)];
    const n = (a: number) => {
      const v = new THREE.Vector3(Math.cos(a), -slope, Math.sin(a)).normalize();
      return inward ? [-v.x, -v.y, -v.z] : [v.x, v.y, v.z];
    };
    const quad = inward
      ? [[a0, y0], [a0, y1], [a1, y1], [a0, y0], [a1, y1], [a1, y0]]
      : [[a0, y0], [a1, y1], [a0, y1], [a0, y0], [a1, y0], [a1, y1]];
    for (const [a, y] of quad) {
      pos.push(...at(a, y));
      nor.push(...n(a));
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  return tagged(g, kind);
}

/** The two taller staves either side, each with a hole cut through for a hand. */
function lug(side: number): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  const w = 0.075;
  shape.moveTo(-w, 0);
  shape.lineTo(-w, 0.06);
  shape.quadraticCurveTo(-w, 0.12, 0, 0.125);
  shape.quadraticCurveTo(w, 0.12, w, 0.06);
  shape.lineTo(w, 0);
  shape.closePath();
  const hole = new THREE.Path();
  hole.absellipse(0, 0.065, 0.032, 0.024, 0, Math.PI * 2, true);
  shape.holes.push(hole);
  const g = new THREE.ExtrudeGeometry(shape, { depth: WALL, bevelEnabled: false, curveSegments: 10 });
  g.translate(0, HEIGHT - 0.01, -WALL / 2);
  g.rotateY(side > 0 ? -Math.PI / 2 : Math.PI / 2);
  g.translate(side * (TOP - WALL / 2), 0, 0);
  return tagged(g, WOOD);
}

function tubGeometry(): THREE.BufferGeometry {
  const rim = new THREE.RingGeometry(TOP - WALL, TOP, 48, 1).rotateX(-Math.PI / 2).translate(0, HEIGHT, 0);
  const bottom = new THREE.CircleGeometry(BOTTOM, 40).rotateX(Math.PI / 2);
  const boards = new THREE.CircleGeometry(radiusAt(FLOOR) - WALL, 40).rotateX(-Math.PI / 2).translate(0, FLOOR, 0);
  return mergeGeometries([
    band(0, HEIGHT, 0, false, WOOD),
    band(FLOOR, HEIGHT, -WALL, true, INSIDE),
    tagged(rim, RIM),
    tagged(bottom, WOOD),
    tagged(boards, BOARDS),
    band(0.045, 0.09, 0.007, false, IRON),
    band(HEIGHT - 0.105, HEIGHT - 0.055, 0.007, false, IRON),
    lug(1),
    lug(-1),
  ]);
}

/**
 * A lid over its opening drawn only into the stencil before the sea, as the boat's is: a line of sight through it goes
 * down into the tub, so the sea is never drawn inside it however low it floats.
 */
function lid(): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.CircleGeometry(TOP - WALL * 0.5, 40).rotateX(-Math.PI / 2).translate(0, HEIGHT, 0), new THREE.MeshBasicMaterial({
    side: THREE.DoubleSide, colorWrite: false, depthWrite: false,
    stencilWrite: true, stencilRef: INSIDE_HULL, stencilFunc: THREE.AlwaysStencilFunc, stencilZPass: THREE.ReplaceStencilOp,
  }));
  mesh.renderOrder = -1;
  return mesh;
}

const VERT = /* glsl */ `
${ATMO_GLSL}
in float aKind;
out vec3 vWorld;
out vec3 vNormal;
out vec3 vLocal;
out float vKind;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  vNormal = normalize(mat3(modelMatrix) * normal);
  vLocal = position;
  vKind = aKind;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const FRAG = /* glsl */ `
${ATMO_GLSL}
uniform float uWater;
in vec3 vWorld;
in vec3 vNormal;
in vec3 vLocal;
in float vKind;
void main() {
  vec3 n = normalize(vNormal);
  if (!gl_FrontFacing) n = -n;
  int kind = int(vKind + 0.5);
  float around = atan(vLocal.z, vLocal.x) / 6.28318 + 0.5;
  float s = around * ${STAVES}.0;
  float stave = floor(s);
  float seam = 1.0 - smoothstep(0.0, 0.07 + fwidth(s), min(fract(s), 1.0 - fract(s)));
  /** Old pine gone silver-brown in the weather, each stave its own shade, the grain running up it. */
  vec3 alb = vec3(0.088, 0.068, 0.052) * (0.8 + 0.36 * hash12(vec2(stave, 7.0)));
  alb *= 0.86 + 0.24 * vnoise(vec2(s * 3.1, vLocal.y * 34.0 + stave * 3.7));
  if (kind == ${INSIDE}) alb *= 0.38 + 0.37 * smoothstep(0.05, ${HEIGHT.toFixed(3)}, vLocal.y);
  if (kind == ${BOARDS}) {
    float plank = floor((vLocal.x + 0.5) * 6.0);
    alb = vec3(0.09, 0.066, 0.048) * (0.8 + 0.3 * hash12(vec2(plank, 3.0))) * (0.85 + 0.25 * vnoise(vec2(plank * 5.0, vLocal.z * 30.0)));
    alb *= 1.0 - 0.5 * (1.0 - smoothstep(0.0, 0.04, abs(fract((vLocal.x + 0.5) * 6.0) - 0.5) * 2.0 - 0.9));
    alb *= 0.55;
  } else if (kind == ${IRON}) {
    alb = mix(vec3(0.045, 0.043, 0.046), vec3(0.16, 0.075, 0.035), smoothstep(0.35, 0.8, vnoise(vec2(around * 60.0, vLocal.y * 40.0))));
  } else if (kind != ${RIM}) {
    alb *= 1.0 - seam * 0.55;
  }
  /** Dark and slick where the water has it, with a pale line where it laps. */
  float above = vWorld.y - uWater;
  if (kind == ${WOOD} || kind == ${IRON}) {
    float wet = 1.0 - smoothstep(-0.01, 0.07, above);
    alb = mix(alb, alb * vec3(0.42, 0.48, 0.42), wet);
    alb += vec3(0.02, 0.022, 0.018) * (1.0 - smoothstep(0.0, 0.02, abs(above - 0.075)));
  }
  float ndl = max(dot(n, uSunDir), 0.0);
  float wrap = max(dot(n, uSunDir) * 0.5 + 0.5, 0.0);
  float sun = cloudShadow(vWorld.xz);
  float hollow = kind == ${INSIDE} || kind == ${BOARDS} ? 0.55 : 1.0;
  vec3 col = alb * (hemiLight(n) * hollow + uSunColor * mix(ndl, wrap * wrap, 0.3) * sun * hollow);
  vec3 V = normalize(cameraPosition - vWorld);
  float back = pow(max(dot(-V, uSunDir), 0.0), 3.0);
  float edge = pow(1.0 - clamp(dot(n, V), 0.0, 1.0), 3.0);
  col += uSunColor * edge * back * sun * 0.25 * (0.35 + alb);
  if (kind == ${IRON}) col += uSunColor * pow(max(dot(reflect(-V, n), uSunDir), 0.0), 24.0) * sun * 0.12;
  gl_FragColor = vec4(applyFog(col, vWorld), 1.0);
}`;

/** An oriented box at the waterline the tub cannot pass into: a middle, a heading, and half its length and depth. */
export interface TubWall {
  x: number;
  z: number;
  yaw: number;
  len: number;
  depth: number;
}

/**
 * A wooden wash-tub adrift in the drowned village. Only the player's wind moves it: a stroke across it on screen
 * pushes it and lays a gust at it, and the breeze never moves it. It turns and rocks as it goes, leaves a little wake,
 * slows and settles where it is left, and comes gently back toward its water when it is pushed away from it. The story
 * gives it somewhere to be drawn into (a dock), holds it while something climbs in or out, and in the end can let the
 * world's own air carry it.
 */
export class WashTub {
  readonly group = new THREE.Group();
  /** Where it floats, on the water. */
  readonly position = new THREE.Vector3();
  readonly velocity = new THREE.Vector2();
  yaw = 0;
  /** The water it belongs on: pushed out of it, it drifts back toward the middle. */
  readonly water = { x: 0, z: 0, r: 6 };
  /** Roofs and the hull: it stops against them. */
  walls: TubWall[] = [];
  /** A place it is drawn into and settles at once it comes within `reach`. */
  dock: { x: number; z: number; reach: number } | null = null;
  /** True once it has come to rest in the dock. */
  docked = false;
  /** Held where it is (something is climbing in or out). */
  held = false;
  /** Carried toward a point on the world's own air, for a player who has not managed it. */
  carry: THREE.Vector2 | null = null;
  /** Something is riding in it: it sits lower. */
  laden = false;
  /** How hard it struck a wall this frame, metres a second into it; 0 when it did not. */
  bump = 0;
  /** Seconds since a stroke last crossed it on screen. */
  sinceBrushed = Infinity;
  /**
   * Where it is being brought: once it is within `tuning.drowned.tub.easeFrom` of it, strokes that are roughly that
   * way are bent the rest of the way toward it and it drifts on in by itself, so bringing it is never fiddly.
   */
  goal: THREE.Vector2 | null = null;

  private readonly mesh: THREE.Mesh;
  private readonly waterline = { value: 0 };
  private readonly marks = new Marks(0.5);
  private readonly shove = new THREE.Vector2();
  /** How fast a stroke is driving it this frame. */
  private pushed = 0;
  private readonly from = new THREE.Vector3();
  private readonly to = new THREE.Vector3();
  private readonly ray = new THREE.Vector3();
  private readonly sea: Swell = { height: 0, slopeX: 0, slopeZ: 0 };
  private readonly at = new THREE.Vector3();
  private readonly side = new THREE.Vector3();
  private readonly mid = new THREE.Vector3();
  private spin = 0;
  private pitch = 0;
  private roll = 0;
  private readonly tiltV = new THREE.Vector2();
  private settle = 0;
  private wakeIn = 0;
  private rippleIn = 1;

  constructor(private readonly wind: WindField) {
    this.mesh = new THREE.Mesh(tubGeometry(), new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG, side: THREE.DoubleSide,
      uniforms: { ...atmo.uniforms, ...swellUniforms, uWater: this.waterline },
    }));
    this.mesh.layers.enable(REFLECTION_LAYER);
    this.group.add(this.mesh, lid());
    this.group.rotation.order = 'YXZ';
    this.group.visible = false;
  }

  get objects(): THREE.Object3D[] {
    return [this.group, this.marks.mesh];
  }

  get visible(): boolean {
    return this.group.visible;
  }

  set visible(on: boolean) {
    this.group.visible = on;
  }

  /** The level boards inside, in its own space, for whatever rides in it. */
  static readonly floor = FLOOR;
  static readonly radius = TOP;

  place(x: number, z: number, yaw = this.yaw): void {
    this.position.set(x, 0, z);
    this.velocity.set(0, 0);
    this.yaw = yaw;
    this.spin = 0;
    this.docked = false;
    this.held = false;
    this.carry = null;
    this.pose(0, 0);
  }

  /**
   * A stroke that crosses it on screen pushes it the way the stroke goes over the water, as fast as the stroke goes
   * there, and lays a gust at it so the water and the air answer too. Under a low lens the stroke's own wind lands on
   * the water far beyond anything floating this near, so it is pushed by the stroke itself, as the paper plane is.
   */
  brush(camera: THREE.Camera, input: PointerInput, dt: number): void {
    const k = tuning.drowned.tub;
    if (!this.visible || dt <= 0 || input.muted || !input.present || input.ndc.distanceToSquared(input.prevNdc) < 1e-8) return;
    const centre = this.at.copy(this.position).setY(this.position.y + HEIGHT * 0.5);
    const middle = this.mid.copy(centre).project(camera);
    const rim = this.side.setFromMatrixColumn(camera.matrixWorld, 0).multiplyScalar(k.brushReach).add(centre).project(camera);
    const radius = Math.abs(rim.x - middle.x) * ((camera as THREE.PerspectiveCamera).aspect ?? 1);
    const touch = screenBrush(camera, centre, input.prevNdc, input.ndc, Math.max(radius, k.brushFloor));
    if (touch < 0.01) return;
    const a = this.onWater(camera, input.prevNdc, this.from), b = this.onWater(camera, input.ndc, this.to);
    if (!a || !b) return;
    const dx = b.x - a.x, dz = b.z - a.z, len = Math.hypot(dx, dz);
    if (len < 1e-4) return;
    /** A flick is meant; the hand drifting back across it on the way to the next one hardly is. */
    const flick = Math.hypot((input.ndc.x - input.prevNdc.x) * ((camera as THREE.PerspectiveCamera).aspect ?? 1), input.ndc.y - input.prevNdc.y) / 2 / dt;
    const weight = Math.min(1, touch * 3) * THREE.MathUtils.smoothstep(flick, k.flickFrom, k.flickFull);
    if (weight <= 0) return;
    this.shove.x += dx * weight;
    this.shove.y += dz * weight;
    this.sinceBrushed = 0;
    const gust = Math.min(tuning.pointer.maxGust, len / dt);
    this.wind.addSplat({
      source: this,
      ax: this.position.x - dx / len * 1.2, az: this.position.z - dz / len * 1.2,
      bx: this.position.x + dx / len * 0.4, bz: this.position.z + dz / len * 0.4,
      vx: dx / len * gust, vz: dz / len * gust, radius: k.windRadius,
      energy: Math.min(0.7, gust / k.energyScale) * weight, lift: 0, swirl: 0,
    });
  }

  /** Where a point of the screen falls on the water at the tub's height, or null if it looks above the horizon. */
  private onWater(camera: THREE.Camera, ndc: THREE.Vector2, out: THREE.Vector3): THREE.Vector3 | null {
    const dir = this.ray.set(ndc.x, ndc.y, 0.5).unproject(camera).sub(camera.position);
    const down = camera.position.y - this.position.y;
    if (dir.y > -1e-4 * dir.length() || down <= 0) return null;
    return out.copy(camera.position).addScaledVector(dir, down / -dir.y);
  }

  update(dt: number, time: number): void {
    this.marks.update(time);
    if (!this.visible || dt <= 0) return;
    const k = tuning.drowned.tub;
    this.sinceBrushed += dt;
    this.bump = 0;
    const p = this.position, v = this.velocity;

    /**
     * Only the player moves it: a stroke across it drives it the way the stroke went, up to the stroke's own pace, and
     * nothing else does.
     */
    const shoved = this.shove.length();
    this.pushed = 0;
    const goal = this.goal;
    const toGoal = goal ? Math.hypot(goal.x - p.x, goal.y - p.z) : Infinity;
    /** Only while the player is bringing it: left alone, it stays where it is. */
    const nearing = goal ? (1 - THREE.MathUtils.smoothstep(toGoal, k.easeFrom * 0.6, k.easeFrom)) * (1 - THREE.MathUtils.smoothstep(this.sinceBrushed, k.easeFor, k.easeFor + 1)) : 0;
    if (shoved > 1e-5) {
      const want = Math.min(k.topSpeed, (shoved / dt) * k.take);
      let ux = this.shove.x / shoved, uz = this.shove.y / shoved;
      if (goal && nearing > 0 && toGoal > 1e-3) {
        const gx = (goal.x - p.x) / toGoal, gz = (goal.y - p.z) / toGoal;
        const bend = nearing * THREE.MathUtils.smoothstep(ux * gx + uz * gz, k.aimFrom, 0.9);
        ux += (gx - ux) * bend;
        uz += (gz - uz) * bend;
        const u = Math.hypot(ux, uz) || 1;
        ux /= u;
        uz /= u;
      }
      const along = v.x * ux + v.y * uz;
      if (want > along) {
        const grip = 1 - Math.exp(-dt * k.grip);
        v.x += ux * (want - along) * grip;
        v.y += uz * (want - along) * grip;
        this.pushed = want;
      }
      this.shove.set(0, 0);
    }
    v.multiplyScalar(Math.exp(-dt * k.drag * (this.pushed > 0 ? 0.2 : 1)));
    if (goal && nearing > 0 && toGoal > 1e-3 && !this.held) {
      const drift = Math.min(k.easeSpeed, toGoal * 0.5) * nearing;
      const along = (v.x * (goal.x - p.x) + v.y * (goal.y - p.z)) / toGoal;
      if (along < drift) {
        const grip = 1 - Math.exp(-dt * 1.5);
        v.x += (goal.x - p.x) / toGoal * (drift - along) * grip;
        v.y += (goal.y - p.z) / toGoal * (drift - along) * grip;
      }
    }

    const fromMiddle = Math.hypot(p.x - this.water.x, p.z - this.water.z);
    if (fromMiddle > this.water.r) {
      const home = Math.min(k.homeSpeed, (fromMiddle - this.water.r) * k.homePull);
      const ease = shoved > 1e-5 ? 0 : 1 - Math.exp(-dt * 0.8);
      v.x += ((this.water.x - p.x) / fromMiddle * home - v.x) * ease;
      v.y += ((this.water.z - p.z) / fromMiddle * home - v.y) * ease;
    }
    if (this.carry) {
      const dx = this.carry.x - p.x, dz = this.carry.y - p.z, d = Math.hypot(dx, dz) || 1;
      const drift = Math.min(k.carrySpeed, d * 0.5);
      v.x += (dx / d * drift - v.x) * (1 - Math.exp(-dt * 0.6));
      v.y += (dz / d * drift - v.y) * (1 - Math.exp(-dt * 0.6));
    }

    const dock = this.dock;
    if (dock) {
      const dx = dock.x - p.x, dz = dock.z - p.z, d = Math.hypot(dx, dz);
      if (this.docked || d < dock.reach) {
        /** Drawn in on a soft spring, so it eases up to the place and stays there whatever the air does. */
        const pull = this.docked ? 6 : k.dockPull * (1 - d / dock.reach * 0.5);
        v.x += (dx * pull - v.x) * (1 - Math.exp(-dt * 3));
        v.y += (dz * pull - v.y) * (1 - Math.exp(-dt * 3));
        if (!this.docked && d < 0.12 && v.length() < 0.25) {
          this.docked = true;
          this.bump = Math.max(this.bump, 0.25);
        }
      }
    } else this.docked = false;
    if (this.held) v.multiplyScalar(Math.exp(-dt * 8));

    p.x += v.x * dt;
    p.z += v.y * dt;
    this.walled(v);

    /** It turns as it goes, the way a round thing does on water, and keeps turning a little after. */
    const speed = v.length();
    const want = (v.x * 0.7 - v.y * 0.5) * k.turn + Math.sin(time * 0.13) * 0.06;
    this.spin += (want - this.spin) * (1 - Math.exp(-dt * (speed > 0.2 ? 1.5 : 0.4)));
    this.yaw += this.spin * dt;

    /** It leans back from a push it has just been given and rocks itself level again. */
    this.tiltV.x += (-(v.x * Math.cos(this.yaw) - v.y * Math.sin(this.yaw)) * 0.05 - this.roll) * 18 * dt - this.tiltV.x * 3.2 * dt;
    this.tiltV.y += ((v.x * Math.sin(this.yaw) + v.y * Math.cos(this.yaw)) * 0.05 - this.pitch) * 18 * dt - this.tiltV.y * 3.2 * dt;
    this.roll += this.tiltV.x * dt;
    this.pitch += this.tiltV.y * dt;
    this.settle += ((this.laden ? 1 : 0) - this.settle) * (1 - Math.exp(-dt * 3));
    this.pose(time, dt);
    this.wake(dt, time, speed);
  }

  /** Out of anything it has run into, losing the way it had into it. */
  private walled(v: THREE.Vector2): void {
    const p = this.position, r = TOP;
    for (const wall of this.walls) {
      const c = Math.cos(wall.yaw), s = Math.sin(wall.yaw);
      const dx = p.x - wall.x, dz = p.z - wall.z;
      const lx = dx * c - dz * s, lz = dx * s + dz * c;
      const ox = wall.len + r - Math.abs(lx), oz = wall.depth + r - Math.abs(lz);
      if (ox <= 0 || oz <= 0) continue;
      /** Pushed out across whichever side it is nearer, along the wall's own axes. */
      let nx: number, nz: number, depth: number;
      if (ox < oz) {
        const sign = Math.sign(lx) || 1;
        nx = c * sign; nz = -s * sign; depth = ox;
      } else {
        const sign = Math.sign(lz) || 1;
        nx = s * sign; nz = c * sign; depth = oz;
      }
      p.x += nx * depth;
      p.z += nz * depth;
      const into = -(v.x * nx + v.y * nz);
      if (into > 0) {
        v.x += nx * into * 1.35;
        v.y += nz * into * 1.35;
        this.bump = Math.max(this.bump, into);
        this.spin += (Math.random() - 0.5) * into * 1.5;
      }
    }
  }

  private pose(time: number, dt: number): void {
    const p = this.position;
    swellAt(p.x, p.z, time, this.sea);
    const draft = THREE.MathUtils.lerp(tuning.drowned.tub.draft, tuning.drowned.tub.ladenDraft, this.settle);
    const bob = Math.sin(time * 1.7 + 0.4) * 0.012 + Math.sin(time * 2.9) * 0.006;
    p.y = this.sea.height + bob;
    this.waterline.value = p.y;
    this.group.position.set(p.x, p.y - draft, p.z);
    this.group.rotation.set(
      -this.sea.slopeZ * 0.8 + this.pitch + Math.sin(time * 1.3) * 0.02,
      this.yaw,
      this.sea.slopeX * 0.8 + this.roll + Math.sin(time * 1.1 + 1) * 0.024,
    );
    this.group.updateMatrixWorld(true);
    if (dt === 0) this.tiltV.set(0, 0);
  }

  /** A thin wake while it is moving, a ring off its side when it rocks, and a slap of rings when it strikes something. */
  private wake(dt: number, time: number, speed: number): void {
    const p = this.position;
    this.wakeIn -= dt;
    if (speed > 0.18 && this.wakeIn <= 0) {
      this.wakeIn = 0.14;
      const ux = this.velocity.x / speed, uz = this.velocity.y / speed;
      const strength = Math.min(0.55, speed * 0.3);
      this.marks.add(FOAM, p.x - ux * TOP * 0.9, p.z - uz * TOP * 0.9, 0.16, 2.2, time, strength, 0.12,
        Math.atan2(uz, ux), 1.8);
      this.marks.add(RING, p.x + ux * TOP * 0.6, p.z + uz * TOP * 0.6, TOP * 0.9, 1.4, time, strength * 1.4, 0.35);
    }
    this.rippleIn -= dt;
    if (this.rippleIn <= 0) {
      this.rippleIn = 1.6 + Math.random() * 1.2;
      this.marks.add(RING, p.x, p.z, TOP * 1.05, 2.2, time, 0.5, 0.22);
    }
    if (this.bump > 0.12) {
      this.marks.add(RING, p.x, p.z, TOP, 1.8, time, Math.min(1.4, this.bump * 1.6), 0.6);
      this.marks.add(FOAM, p.x, p.z, TOP * 1.1, 1.2, time, Math.min(0.6, this.bump * 0.5), 0.2);
    }
  }
}
