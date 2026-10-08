import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { tuning } from '../../tuning';
import { ATMO_GLSL, atmo } from '../atmosphere';
import { BELFRY_GLSL, type BelfryLight } from '../belfry';
import type { MaterialSound } from '../../audio/foley';
import type { CrossingCast } from './tree-crossing';

/** Where the bell hangs: the middle of the line it swings about, and the level way its lip swings out for a positive swing. */
export interface BellSpot {
  pivot: THREE.Vector3;
  toward: THREE.Vector2;
  /** Half the span between its gudgeons, out to the bearings on its frame. */
  half: number;
}

export type BellEvent = 'ring' | 'touch';

/** A full ring, and the clapper only touching the bronze. */
export const BELL_SOUNDS = { ring: 'bell', touch: 'bell-touch' } as const satisfies Record<BellEvent, MaterialSound>;

/** The bell's size: its crown below the gudgeons, its height from crown to lip, and the lip's radius. */
const CROWN = 0.22;
const TALL = 1.75;
const LIP = 0.97;
/** The clapper hangs from inside the crown; its ball meets the sound bow at this swing against the bell (radians). */
const CLAPPER_FROM = CROWN + 0.12;
const CLAPPER = 1.2;
const CLAPPER_LIP = 0.46;

const OUTER: [number, number][] = [
  [0.001, 0], [0.2, -0.004], [0.36, -0.03], [0.45, -0.08], [0.5, -0.16], [0.515, -0.28], [0.52, -0.45], [0.53, -0.65],
  [0.56, -0.86], [0.61, -1.06], [0.69, -1.27], [0.79, -1.45], [0.88, -1.59], [0.94, -1.69], [LIP, -TALL],
];
const INNER: [number, number][] = [
  [0.9, -TALL], [0.85, -1.68], [0.76, -1.55], [0.65, -1.36], [0.56, -1.12], [0.49, -0.82], [0.45, -0.5], [0.42, -0.25],
  [0.34, -0.14], [0.18, -0.11], [0.001, -0.1],
];
const BRONZE = 0;
const OAK = 1;
const IRON = 2;

const BELL_VERT = /* glsl */ `
in float aKind;
in vec3 aLocal;
out vec3 vWorld;
out vec3 vNormal;
out vec3 vLocal;
out float vKind;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  vNormal = normalize(mat3(modelMatrix) * normal);
  vLocal = aLocal;
  vKind = aKind;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const BELL_FRAG = /* glsl */ `
${ATMO_GLSL}
${BELFRY_GLSL}
uniform float uIndoors;
uniform float uShimmer;
in vec3 vWorld;
in vec3 vNormal;
in vec3 vLocal;
in float vKind;
void main() {
  vec3 n = normalize(vNormal);
  if (!gl_FrontFacing) n = -n;
  int kind = int(vKind + 0.5);
  vec3 V = normalize(cameraPosition - vWorld);
  float sun = mix(cloudShadow(vWorld.xz), belfrySun(vWorld), uIndoors);
  float ndl = max(dot(n, uSunDir), 0.0);
  float wrap = clamp(dot(n, uSunDir) * 0.5 + 0.5, 0.0, 1.0);
  vec3 ambient = hemiLight(n) * mix(1.0, 0.42, uIndoors) + uSunColor * vec3(1.0, 0.76, 0.48) * 0.09 * uIndoors;
  vec3 col;
  if (kind == ${BRONZE}) {
    /** Old bronze gone dark, green where the weather has run down it and all round the lip. */
    float a = atan(vLocal.z, vLocal.x);
    float y = vLocal.y;
    float runs = vnoise(vec2(a * 11.0, y * 1.1)) * 0.6 + vnoise(vec2(a * 27.0, y * 4.0)) * 0.4;
    float green = smoothstep(-1.1, -1.62, y) * (0.65 + 0.6 * runs) + smoothstep(0.6, 0.82, runs) * smoothstep(-0.25, -0.9, y) * 0.7;
    green = clamp(green + 0.25 * smoothstep(0.7, 0.9, vnoise(vec2(a * 6.0, y * 7.0))), 0.0, 1.0);
    vec3 metal = mix(vec3(0.075, 0.062, 0.048), vec3(0.2, 0.155, 0.1), 0.35 + 0.65 * vnoise(vec2(a * 4.0, y * 2.5)));
    vec3 verd = mix(vec3(0.1, 0.22, 0.19), vec3(0.2, 0.36, 0.3), runs);
    vec3 alb = mix(metal, verd, green);
    float shine = 1.0 - 0.85 * green;
    col = alb * (ambient + uSunColor * wrap * wrap * sun * mix(1.0, 0.55, shine));
    vec3 h = normalize(uSunDir + V);
    vec3 tint = mix(vec3(1.0), vec3(1.0, 0.8, 0.58), 0.6);
    col += tint * uSunColor * (pow(max(dot(n, h), 0.0), 46.0) * 0.9 + pow(max(dot(n, h), 0.0), 7.0) * 0.12) * sun * shine;
    /** Bronze shows what is round it: indoors the dim timbers and stone, and the sky only where it looks out through a light. */
    vec3 r = reflect(-V, n);
    float sky = smoothstep(-0.15, 0.2, r.y) * (1.0 - smoothstep(0.35, 0.85, r.y));
    float open = mix(sky, belfryOpen(vWorld + r * 0.05, r), uIndoors);
    float fres = 0.3 + 0.7 * pow(1.0 - clamp(dot(n, V), 0.0, 1.0), 3.0);
    vec3 room = mix(uSkyAmbient * 0.15, uSunColor * vec3(1.0, 0.7, 0.45) * 0.05 + uSkyAmbient * 0.04, uIndoors);
    col += mix(room, mix(uSkyHorizon, uSkyHorizonSun, 0.5) * mix(0.7, 0.4, uIndoors), open) * mix(vec3(1.0), metal * 3.0, 0.6) * fres * shine;
    /** Struck, the bronze shivers: a sheen runs round the sound bow and up the waist as it rings. */
    float band = 0.5 + 0.5 * sin(a * 6.0 + y * 9.0 - uTime * 40.0);
    col += uSkyHorizonSun * tint * uShimmer * (0.35 + 0.65 * band) * smoothstep(-0.4, -1.5, y) * shine * 0.6;
  } else if (kind == ${OAK}) {
    float grain = vnoise(vec2(vLocal.x * 1.3, (vLocal.y + vLocal.z) * 26.0)) * 0.6 + vnoise(vec2(vLocal.x * 6.0, (vLocal.y - vLocal.z) * 55.0)) * 0.4;
    vec3 alb = vec3(0.15, 0.095, 0.055) * (0.74 + 0.42 * grain);
    col = alb * (ambient + uSunColor * mix(ndl, wrap * wrap, 0.2) * sun);
  } else {
    vec3 alb = vec3(0.05, 0.048, 0.05);
    col = alb * (ambient + uSunColor * ndl * sun) + uSunColor * pow(max(dot(n, normalize(uSunDir + V)), 0.0), 30.0) * 0.1 * sun;
  }
  gl_FragColor = vec4(applyFog(col, vWorld), 1.0);
}`;

function part(geo: THREE.BufferGeometry, kind: number, m?: THREE.Matrix4): THREE.BufferGeometry {
  const g = geo.index ? geo.toNonIndexed() : geo;
  for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal') g.deleteAttribute(name);
  if (!g.attributes.normal) g.computeVertexNormals();
  g.setAttribute('aLocal', new THREE.BufferAttribute(Float32Array.from(g.attributes.position.array), 3));
  g.setAttribute('aKind', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count).fill(kind), 1));
  if (m) g.applyMatrix4(m);
  return g;
}

/** The bronze: its lathe-turned body, the raised lines round its shoulder and above its sound bow, its lip. */
function bellGeometry(): THREE.BufferGeometry {
  const lathe = (pts: [number, number][]) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), 40);
  const radius = (y: number) => {
    for (let i = 1; i < OUTER.length; i++) {
      const [r0, y0] = OUTER[i - 1], [r1, y1] = OUTER[i];
      if (y <= y0 && y >= y1) return r0 + (r1 - r0) * ((y - y0) / (y1 - y0));
    }
    return LIP;
  };
  const parts = [part(lathe(OUTER), BRONZE), part(lathe(INNER), BRONZE),
    part(new THREE.RingGeometry(0.9, LIP, 40).rotateX(Math.PI / 2).translate(0, -TALL, 0), BRONZE)];
  for (const y of [-0.2, -0.27, -1.33, -1.4, -1.62]) {
    parts.push(part(new THREE.TorusGeometry(radius(y) + 0.004, 0.012, 4, 48).rotateX(Math.PI / 2).translate(0, y, 0), BRONZE));
  }
  parts.push(part(new THREE.CylinderGeometry(0.2, 0.26, 0.08, 16).translate(0, 0.02, 0), BRONZE));
  return mergeGeometries(parts);
}

/**
 * The belfry's bell as a piece: big old bronze hung by its headstock between two gudgeons, swinging in one plane.
 * One good stroke across it on screen swings it, and as the swing tops out the clapper meets the sound bow and it
 * rings, once: a stroke sets a swing rather than adding to one, so it is never pumped up as a rope swing is, and
 * weaker strokes only rock it, the clapper just touching. Each ring calls `onRing` (the waves it sends out, and
 * whatever answers it); nothing is timed or failed. A stalled player is shown the stroke across it, and after long
 * enough without a ring the world's own gust swings it.
 */
export class Bell {
  readonly group = new THREE.Group();
  readonly objects: THREE.Object3D[];
  readonly pivot = new THREE.Vector3();
  readonly toward = new THREE.Vector2();
  /** Radians out of true, its lip toward `toward` positive, and how fast; the clapper's swing against it. */
  angle = 0;
  speed = 0;
  clapper = 0;
  clapperSpeed = 0;
  rings = 0;
  touches = 0;
  /** Seconds since a stroke last moved it, and since it last rang. */
  quiet = 0;
  sinceRing = 0;
  invitation: THREE.Vector3 | null = null;
  heading = 0;
  onEvent: ((kind: BellEvent, at: THREE.Vector3, strength: number) => void) | null = null;
  onRing: ((strength: number) => void) | null = null;
  /** QA: the most recent swing's top (radians), and the swing a stroke last asked for. */
  peak = 0;
  ask = 0;
  private askWay = 1;
  private askAge = Infinity;
  private armed = false;
  private sweep = 0;
  private strokeAge = Infinity;
  private shudder = 0;
  private valveClock = 0;
  private valveOn = false;
  private readonly swing = new THREE.Group();
  private readonly hanger = new THREE.Group();
  private readonly material: THREE.ShaderMaterial;
  private readonly sc = new THREE.Vector2();
  private readonly sd = new THREE.Vector2();
  private readonly v = new THREE.Vector3();
  private readonly w = new THREE.Vector3();
  private readonly middleAt = new THREE.Vector3();
  private readonly axisA = new THREE.Vector2();
  private readonly axisB = new THREE.Vector2();
  private readonly centreAt = new THREE.Vector2();

  constructor(spot: BellSpot, private readonly cast: CrossingCast, light: BelfryLight | null = null) {
    this.pivot.copy(spot.pivot);
    this.toward.copy(spot.toward).normalize();
    const body = bellGeometry();
    body.translate(0, -CROWN, 0);
    const hang = mergeGeometries([
      part(new THREE.BoxGeometry(2 * spot.half - 0.16, 0.3, 0.34).translate(0, 0.02, 0), OAK),
      ...[-1, 1].map((s) => part(new THREE.CylinderGeometry(0.05, 0.05, 0.2, 10).rotateZ(Math.PI / 2).translate(s * (spot.half - 0.04), 0, 0), IRON)),
      ...[-1, 1].flatMap((sx) => [-1, 1].map((sz) => part(new THREE.BoxGeometry(0.07, 0.36, 0.025).translate(sx * 0.19, -0.16, sz * 0.18), IRON))),
      ...[-1, 1].map((s) => part(new THREE.BoxGeometry(0.06, 0.04, 0.4).translate(s * 0.55, 0.19, 0), IRON)),
    ]);
    const clapper = mergeGeometries([
      part(new THREE.CylinderGeometry(0.026, 0.03, CLAPPER - 0.08, 8).translate(0, -(CLAPPER - 0.08) / 2, 0), IRON),
      part(new THREE.SphereGeometry(0.095, 12, 10).translate(0, -CLAPPER, 0), IRON),
      part(new THREE.CylinderGeometry(0.035, 0.02, 0.14, 8).translate(0, -CLAPPER - 0.15, 0), IRON),
    ]);
    this.material = new THREE.ShaderMaterial({
      vertexShader: BELL_VERT, fragmentShader: BELL_FRAG, side: THREE.DoubleSide,
      uniforms: {
        ...atmo.uniforms,
        ...(light ?? {
          uBelfry: { value: new THREE.Vector4() }, uBelfrySize: { value: new THREE.Vector4() }, uBelfryLight: { value: new THREE.Vector4() },
          uBellPivot: { value: new THREE.Vector3() }, uBellDown: { value: new THREE.Vector3() },
        }),
        uIndoors: { value: light ? 1 : 0 },
        uShimmer: { value: 0 },
      },
    });
    const mesh = (g: THREE.BufferGeometry) => {
      const m = new THREE.Mesh(g, this.material);
      m.frustumCulled = false;
      return m;
    };
    this.swing.add(mesh(body), mesh(hang), this.hanger);
    this.hanger.position.y = -CLAPPER_FROM;
    this.hanger.add(mesh(clapper));
    this.swing.rotation.order = 'YXZ';
    this.swing.position.copy(this.pivot);
    this.group.add(this.swing);
    this.objects = [this.group];
    this.pose();
  }

  reset(): void {
    this.angle = this.speed = this.clapper = this.clapperSpeed = 0;
    this.rings = this.touches = 0;
    this.quiet = this.sinceRing = 0;
    this.ask = this.peak = this.shudder = 0;
    this.askAge = this.strokeAge = Infinity;
    this.armed = this.valveOn = false;
    this.sweep = this.valveClock = 0;
    this.invitation = null;
    this.pose();
  }

  /** Straight down from the gudgeons through the bell as it hangs now. */
  down(out: THREE.Vector3): THREE.Vector3 {
    return out.set(this.toward.x * Math.sin(this.angle), -Math.cos(this.angle), this.toward.y * Math.sin(this.angle));
  }

  /** The middle of the bronze, now. */
  middle(out: THREE.Vector3): THREE.Vector3 {
    return out.copy(this.pivot).addScaledVector(this.down(this.v), CROWN + TALL * 0.62);
  }

  /** Where its lip is on the side it swings toward. */
  lip(out: THREE.Vector3): THREE.Vector3 {
    this.down(this.v);
    return out.copy(this.pivot).addScaledVector(this.v, CROWN + TALL).add(this.w.set(this.toward.x * Math.cos(this.angle), Math.sin(this.angle), this.toward.y * Math.cos(this.angle)).multiplyScalar(LIP));
  }

  /** Once the world's own gust has taken over, it goes on ringing it until the player takes it back. */
  get valving(): boolean {
    if (this.sinceRing > tuning.crossings.bell.valveAfter) this.valveOn = true;
    return this.valveOn;
  }

  /**
   * A stroke across the bronze on screen: the share of its own width it sweeps along its swing, firmer for faster.
   * Each stroke asks for a swing of its own; the strongest stroke of a run wins.
   */
  brush(camera: THREE.PerspectiveCamera, dt: number): void {
    const { input } = this.cast;
    this.strokeAge += dt;
    if (!input.present || input.muted || dt <= 0) return;
    const k = tuning.crossings.bell;
    const aspect = camera.aspect;
    this.sc.set(input.prevNdc.x * aspect * 0.5, input.prevNdc.y * 0.5);
    this.sd.set(input.ndc.x * aspect * 0.5, input.ndc.y * 0.5);
    const travel = this.sc.distanceTo(this.sd);
    if (travel < 1e-5) return;
    const screen = (p: THREE.Vector3, out: THREE.Vector2) => {
      this.w.copy(p).project(camera);
      return out.set(this.w.x * aspect * 0.5, this.w.y * 0.5);
    };
    this.middle(this.middleAt);
    screen(this.middleAt, this.centreAt);
    screen(this.v.copy(this.middleAt).add(this.w.set(this.toward.x, 0, this.toward.y).multiplyScalar(LIP * 0.85)), this.axisA).sub(this.centreAt);
    screen(this.v.copy(this.middleAt).addScaledVector(this.down(this.w), TALL * 0.55), this.axisB).sub(this.centreAt);
    const width = Math.max(0.01, this.axisA.length());
    const det = this.axisA.x * this.axisB.y - this.axisA.y * this.axisB.x;
    if (Math.abs(det) < 1e-6) return;
    let nearest = Infinity;
    for (let i = 0; i <= 6; i++) {
      const px = this.sc.x + (this.sd.x - this.sc.x) * (i / 6) - this.centreAt.x, py = this.sc.y + (this.sd.y - this.sc.y) * (i / 6) - this.centreAt.y;
      const a = (px * this.axisB.y - py * this.axisB.x) / det, b = (this.axisA.x * py - this.axisA.y * px) / det;
      nearest = Math.min(nearest, Math.hypot(a, b));
    }
    const hit = 1 - THREE.MathUtils.smoothstep(nearest, 1, 1 + k.reach / width);
    if (hit <= 0) return;
    const along = ((this.sd.x - this.sc.x) * this.axisA.x + (this.sd.y - this.sc.y) * this.axisA.y) / (width * 2 * width);
    const firm = THREE.MathUtils.lerp(k.soft, 1, THREE.MathUtils.smoothstep(travel / dt / (2 * width), k.gentle, k.firm));
    if (this.strokeAge > 0.3) this.sweep = 0;
    this.strokeAge = 0;
    this.sweep += along * hit * firm;
    const want = Math.min(k.most, Math.abs(this.sweep) * k.perWidth);
    if (want > 0.02) this.quiet = 0;
    if (want > this.ask || this.askAge > k.lag * 3) {
      this.ask = want;
      this.askWay = Math.sign(this.sweep) || 1;
      this.askAge = 0;
      this.armed = true;
      this.valveOn = false;
    }
  }

  update(dt: number, camera: THREE.PerspectiveCamera): void {
    if (dt <= 0) return;
    const k = tuning.crossings.bell;
    this.quiet += dt;
    this.sinceRing += dt;
    this.askAge += dt;
    this.brush(camera, dt);
    if (this.valving) this.blow(dt);

    const energy = 0.5 * this.speed * this.speed + k.pull * (1 - Math.cos(this.angle));
    const wanted = k.pull * (1 - Math.cos(this.ask));
    const going = Math.abs(this.speed) < 0.05 || Math.sign(this.speed) === this.askWay;
    const driving = this.askAge < k.lag * 2.5 && (!going || energy < wanted);
    const push = driving ? this.askWay * k.drive : 0;
    const before = this.speed;
    this.speed += (-k.pull * Math.sin(this.angle) + push) * dt;
    this.speed *= Math.exp(-dt * k.damping);
    this.angle += this.speed * dt;
    const accel = (this.speed - before) / dt;

    /** The clapper hangs on inside, lagging the bell, and is thrown against the bronze as the swing tops out. */
    this.clapperSpeed += (-14 * this.clapper - 2.4 * this.clapperSpeed - accel * 0.9) * dt;
    this.clapper += this.clapperSpeed * dt;
    if (Math.abs(this.clapper) > CLAPPER_LIP) {
      this.clapper = Math.sign(this.clapper) * CLAPPER_LIP;
      this.clapperSpeed *= -0.35;
    }

    if (this.armed && !driving && this.strokeAge > 0.12 && this.angle * this.speed > 0) {
      const top = Math.acos(THREE.MathUtils.clamp(Math.cos(this.angle) - (this.speed * this.speed) / (2 * k.pull), -1, 1));
      if (top - Math.abs(this.angle) < Math.abs(this.speed) * 0.07 + 0.003) this.strike(top);
    }
    this.shudder = Math.max(0, this.shudder - dt * 0.7);

    const resting = Math.abs(this.angle) < 0.03 && Math.abs(this.speed) < 0.05;
    const asking = this.quiet > k.inviteAfter && resting && !this.valving;
    this.invitation = asking ? this.middle(new THREE.Vector3()) : null;
    if (asking) this.heading = this.screenHeading(camera);
    this.pose();
  }

  /** The screen angle of the way its lip swings out, for the drawn stroke. */
  screenHeading(camera: THREE.Camera): number {
    this.middle(this.middleAt);
    const a = this.v.copy(this.middleAt).project(camera);
    const b = this.w.copy(this.middleAt).add(new THREE.Vector3(this.toward.x, 0, this.toward.y)).project(camera);
    return Math.atan2(b.y - a.y, (b.x - a.x) * (camera as THREE.PerspectiveCamera).aspect);
  }

  /** The clapper meets the bronze at the top of the swing: a ring if the swing was a good one, a touch if not. */
  private strike(top: number): void {
    const k = tuning.crossings.bell;
    this.armed = false;
    this.peak = top;
    if (top < k.touchAt) return;
    const at = this.lip(new THREE.Vector3());
    const way = Math.sign(this.angle) || 1;
    this.clapper = way * CLAPPER_LIP;
    if (top >= k.ringAt) {
      const strength = THREE.MathUtils.lerp(0.55, 1, THREE.MathUtils.smoothstep(top, k.ringAt, k.fullAt));
      this.clapperSpeed = -way * 2.2;
      this.shudder = strength;
      this.rings++;
      this.sinceRing = 0;
      this.onEvent?.('ring', at, strength);
      this.onRing?.(strength);
    } else {
      const strength = THREE.MathUtils.lerp(0.15, 0.55, THREE.MathUtils.smoothstep(top, k.touchAt, k.ringAt));
      this.clapperSpeed = -way * 0.6;
      this.touches++;
      this.onEvent?.('touch', at, strength);
    }
  }

  /** The world's own gust through the opening and across the bell, as a good stroke would be. */
  private blow(dt: number): void {
    const k = tuning.crossings.bell;
    this.valveClock -= dt;
    if (this.valveClock > 0 || Math.abs(this.angle) > 0.08) return;
    this.valveClock = k.valveEvery;
    const mid = this.middle(this.middleAt);
    const t = this.toward;
    this.cast.lines.gust(mid.x - t.x * 2.5, mid.z - t.y * 2.5, t.x, t.y, 6, 9);
    this.ask = k.fullAt + 0.02;
    this.askWay = 1;
    this.askAge = 0;
    this.armed = true;
  }

  private pose(): void {
    this.material.uniforms.uShimmer.value = this.shudder * this.shudder;
    const quiver = this.shudder * 0.006 * Math.sin(performance.now() * 0.09);
    this.swing.rotation.set(-(this.angle + quiver), Math.atan2(this.toward.x, this.toward.y), 0);
    this.hanger.rotation.set(-this.clapper, 0, 0);
    this.group.updateMatrixWorld(true);
  }
}

const WAVE_VERT = /* glsl */ `
out vec3 vWorld;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const WAVES = 6;
const WAVE_FRAG = /* glsl */ `
${ATMO_GLSL}
uniform vec4 uWaves[${WAVES}];
uniform vec3 uCentre;
in vec3 vWorld;
void main() {
  vec2 d2 = vWorld.xz - uCentre.xz;
  float d = length(d2);
  float ang = atan(d2.y, d2.x);
  float glow = 0.0;
  for (int i = 0; i < ${WAVES}; i++) {
    vec4 w = uWaves[i];
    if (w.y <= 0.0) continue;
    float x = (d - w.x) / w.w;
    /** A bright leading crest and a fainter second one behind it, broken up along their length like a ripple catching light. */
    float crest = exp(-x * x * 5.0) + 0.45 * exp(-(x + 2.6) * (x + 2.6) * 4.0);
    float broken = smoothstep(0.25, 0.75, vnoise(vec2(ang * 34.0 + float(i) * 3.1, d * 1.3 - w.x * 0.2)));
    float ruffle = 0.35 + 0.65 * broken;
    glow += crest * ruffle * w.y * (1.0 - smoothstep(0.35, 1.0, w.z));
  }
  if (glow < 0.004) discard;
  vec2 sun = normalize(uSunDir.xz + 1e-5);
  float toward = pow(max(dot(d2 / max(d, 1e-3), sun), 0.0), 2.0);
  vec3 col = mix(uSkyHorizon * 1.3 + uSkyAmbient * 0.25, uSkyHorizonSun * 1.25, 0.25 + 0.6 * toward);
  gl_FragColor = vec4(applyFog(col, vWorld), clamp(glow * 0.5, 0.0, 0.75));
}`;

/**
 * The rings a bell sends out over what lies below its tower: each a crest of pale light, a little ruffled, rolling
 * out at walking pace's ten times from the tower's foot and fading as it goes. `level` is the surface it rolls over
 * (the water on the stage's yard; the fog's top in the room).
 */
export class BellWaves {
  readonly mesh: THREE.Mesh;
  level: number;
  private readonly waves: { age: number; strength: number }[] = [];
  private readonly uniforms: { uWaves: { value: THREE.Vector4[] }; uCentre: { value: THREE.Vector3 } };

  constructor(readonly centre: THREE.Vector3, level: number, private readonly from: number) {
    this.level = level;
    const k = tuning.crossings.bell;
    const reach = from + k.waveSpeed * k.waveLife + 6;
    this.uniforms = { uWaves: { value: Array.from({ length: WAVES }, () => new THREE.Vector4()) }, uCentre: { value: centre.clone() } };
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(reach * 2, reach * 2).rotateX(-Math.PI / 2), new THREE.ShaderMaterial({
      vertexShader: WAVE_VERT, fragmentShader: WAVE_FRAG, uniforms: { ...atmo.uniforms, ...this.uniforms },
      transparent: true, depthWrite: false,
    }));
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 3;
    this.mesh.position.set(centre.x, level, centre.z);
  }

  emit(strength: number): void {
    if (this.waves.length >= WAVES) this.waves.shift();
    this.waves.push({ age: 0, strength });
  }

  get count(): number {
    return this.waves.length;
  }

  reset(): void {
    this.waves.length = 0;
  }

  update(dt: number): void {
    const k = tuning.crossings.bell;
    for (const w of this.waves) w.age += dt;
    while (this.waves.length && this.waves[0].age > k.waveLife) this.waves.shift();
    this.mesh.position.y = this.level;
    this.uniforms.uCentre.value.copy(this.centre);
    this.uniforms.uWaves.value.forEach((v, i) => {
      const w = this.waves[i];
      if (!w) v.set(0, 0, 0, 1);
      else v.set(this.from + w.age * k.waveSpeed, w.strength * Math.min(1, w.age * 4), w.age / k.waveLife, k.waveWidth * (1 + w.age * 0.25));
    });
  }
}
