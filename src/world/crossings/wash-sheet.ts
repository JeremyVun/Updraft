import * as THREE from 'three';
import { tuning } from '../../tuning';
import { ATMO_GLSL, atmo } from '../atmosphere';
import { REFLECTION_LAYER } from '../water/reflection';
import type { PointerInput } from '../../input/pointer';
import type { WindField } from '../../wind/field';
import { segmentGap } from './shapes';

/** Where a washing line is made fast: round her chimney, and over the pulley on the far one's prop. */
export interface SheetSpot {
  from: THREE.Vector3;
  to: THREE.Vector3;
  /** How far along the line from `from` the sheet's trailing edge hangs before anything moves it (m). */
  start: number;
  /** Where each chimney's prop stands on its cap, under the end of the line; none where the line is tied to the stack itself. */
  props?: (THREE.Vector3 | null)[];
  /** How far short of the far pulley the knot on the line stops the leading ring (m). */
  stop?: number;
}

/** The sheet: its length along the line, its drop, how many rings carry it, and how close they bunch at the far end. */
export const SHEET = { length: 2.7, drop: 2.05, rings: 7, bunch: 0.1, fullness: 1.14 } as const;

const NX = 16;
const NY = 13;
/** The row of the trailing edge her mittens close on, beside her face: far enough down that the line clears her hood. */
const HOLD_ROW = 5;
/** How far under the line her mittens close on the trailing edge. */
export const HOLD_DROP = (HOLD_ROW * SHEET.drop) / (NY - 1);
const RING_EVERY = (NX - 1) / (SHEET.rings - 1);
const LINE_SAMPLES = 48;
const LINE_SIDES = 5;

const CLOTH_VERT = /* glsl */ `
in vec2 aUv;
out vec3 vWorld;
out vec3 vNormal;
out vec2 vUv;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  vNormal = mat3(modelMatrix) * normal;
  vUv = aUv;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const CLOTH_FRAG = /* glsl */ `
${ATMO_GLSL}
uniform float uThrough;
in vec3 vWorld;
in vec3 vNormal;
in vec2 vUv;
void main() {
  vec3 n = normalize(vNormal);
  if (!gl_FrontFacing) n = -n;
  vec3 alb = vec3(0.6, 0.565, 0.49) * (0.95 + 0.08 * vnoise(vUv * vec2(3.0, 2.4)));
  /** A faded red hem and a darned patch, the only marks on it. */
  float hem = smoothstep(0.915, 0.925, vUv.y) * (1.0 - smoothstep(0.95, 0.96, vUv.y));
  alb = mix(alb, vec3(0.24, 0.065, 0.05), hem * 0.8);
  vec2 darn = abs(vUv - vec2(0.68, 0.36)) - vec2(0.07, 0.06);
  alb *= 1.0 - 0.06 * (1.0 - smoothstep(0.0, 0.01, max(darn.x, darn.y)));
  float ndl = max(dot(n, uSunDir), 0.0);
  float sun = cloudShadow(vWorld.xz);
  float through = abs(dot(n, uSunDir)) * (1.0 - step(0.0, dot(n, uSunDir)));
  /** Thin cloth scatters: light wraps round its folds rather than leaving them in hard shadow. */
  float wrap = dot(n, uSunDir) * 0.5 + 0.5;
  vec3 col = alb * (0.5 * (hemiLight(n) + hemiLight(-n)) * 0.85 + uSunColor * sun * (mix(ndl, wrap * wrap, 0.55) + uThrough * through) + 0.06);
  vec3 V = normalize(cameraPosition - vWorld);
  float rim = pow(1.0 - clamp(abs(dot(n, V)), 0.0, 1.0), 3.0) * pow(max(dot(-V, uSunDir), 0.0), 2.0);
  col += uSunColor * rim * sun * 0.18;
  gl_FragColor = vec4(applyFog(col, vWorld), 1.0);
}`;

const HARD_VERT = /* glsl */ `
in vec3 color;
out vec3 vWorld;
out vec3 vNormal;
out vec3 vColor;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  #ifdef USE_INSTANCING
  w = modelMatrix * instanceMatrix * vec4(position, 1.0);
  vNormal = mat3(modelMatrix) * mat3(instanceMatrix) * normal;
  #else
  vNormal = mat3(modelMatrix) * normal;
  #endif
  vWorld = w.xyz;
  vColor = color;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const HARD_FRAG = /* glsl */ `
${ATMO_GLSL}
in vec3 vWorld;
in vec3 vNormal;
in vec3 vColor;
void main() {
  vec3 n = normalize(vNormal);
  if (!gl_FrontFacing) n = -n;
  float ndl = max(dot(n, uSunDir), 0.0);
  float sun = cloudShadow(vWorld.xz);
  vec3 col = vColor * (hemiLight(n) + uSunColor * ndl * sun);
  vec3 V = normalize(cameraPosition - vWorld);
  float rim = pow(1.0 - clamp(dot(n, V), 0.0, 1.0), 3.0) * pow(max(dot(-V, uSunDir), 0.0), 2.5);
  col += uSunColor * rim * sun * 0.2;
  gl_FragColor = vec4(applyFog(col, vWorld), 1.0);
}`;

const lin = (r: number, g: number, b: number) => new THREE.Color().setRGB(r, g, b);
const ROPE = lin(0.13, 0.11, 0.085);
const IRON = lin(0.045, 0.043, 0.045);
const PEG = lin(0.3, 0.25, 0.18);
const POLE = lin(0.16, 0.13, 0.1);

function coloured(geo: THREE.BufferGeometry, colour: THREE.Color): THREE.BufferGeometry {
  const g = geo.index ? geo.toNonIndexed() : geo;
  if (g.attributes.uv) g.deleteAttribute('uv');
  const col = new Float32Array(g.attributes.position.count * 3);
  for (let i = 0; i < g.attributes.position.count; i++) col.set([colour.r, colour.g, colour.b], i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

export type SheetSound = 'fill' | 'sag' | 'flap';

/**
 * A big cream sheet on rings on a washing line strung up from her chimney across a lane to a higher roof's. The
 * player's strokes across it, the way the line climbs, fill it: it bellies out and its hem lifts and streams toward
 * the far roof, a beat after the stroke, and sags back and swings when the gust dies. Held at its trailing edge and
 * full, it runs up the line like a sail, its rings bunching at the far pulley. The cloth is a small mass-spring sheet
 * pinned to its rings, so everything it does is cloth answering air.
 */
export class WashSheet {
  readonly group = new THREE.Group();
  readonly objects: THREE.Object3D[];
  readonly from = new THREE.Vector3();
  readonly to = new THREE.Vector3();
  /** Along the line, level, from her side to the far side. */
  readonly along = new THREE.Vector3();
  readonly length: number;
  /** How far along the line the trailing ring is, which is where she holds. */
  travel: number;
  readonly start: number;
  readonly stop: number;
  /** The air the player has put into it: what it is being asked to do, and the cloth's fullness as seen. */
  press = 0;
  fill = 0;
  /** Set while she hangs from it, and where the cat is while it runs the line. */
  held = false;
  cat: THREE.Vector3 | null = null;
  /** Seconds since a stroke last filled it; the way the last stroke went (1 up the line, -1 back). */
  quiet = Infinity;
  onSound: ((kind: SheetSound, at: THREE.Vector3, strength: number) => void) | null = null;
  private incoming = 0;
  /** Where along the sheet (0 trailing to 1 leading) the last stroke met it, and how far its air has spread since. */
  private hitAt = 0.5;
  private spread = 9;
  private holdDip = 0;
  private holdDipSpeed = 0;
  private catDip = 0;
  private catAlong = 0;
  private wasFull = false;
  private flapClock = 1;
  private readonly pos: THREE.Vector3[] = [];
  private readonly prev: THREE.Vector3[] = [];
  private readonly normals: THREE.Vector3[] = [];
  private readonly links: [number, number, number, number][] = [];
  private readonly pins = new Map<number, THREE.Vector3>();
  private readonly rings: number[] = [];
  private readonly clothGeo: THREE.BufferGeometry;
  private readonly lineGeo: THREE.BufferGeometry;
  private readonly ringMesh: THREE.InstancedMesh;
  private readonly clothMaterial: THREE.ShaderMaterial;
  private readonly sample = { x: 0, z: 0, energy: 0, lift: 0 };
  private readonly out = new THREE.Vector3();
  private readonly air = new THREE.Vector3();
  private readonly tmp = new THREE.Vector3();
  private readonly tmp2 = new THREE.Vector3();
  private readonly matrix = new THREE.Matrix4();
  private readonly quat = new THREE.Quaternion();
  private readonly projected = new THREE.Vector3();
  private readonly sa = new THREE.Vector2();
  private readonly sb = new THREE.Vector2();
  private readonly sc = new THREE.Vector2();
  private readonly sd = new THREE.Vector2();
  private readonly corners = [new THREE.Vector2(), new THREE.Vector2(), new THREE.Vector2(), new THREE.Vector2()];

  constructor(spot: SheetSpot) {
    this.from.copy(spot.from);
    this.to.copy(spot.to);
    this.length = this.from.distanceTo(this.to);
    this.along.set(this.to.x - this.from.x, 0, this.to.z - this.from.z).normalize();
    this.start = this.travel = spot.start;
    this.stop = spot.stop ?? 0.22;

    for (let k = 0; k < NY; k++) {
      for (let j = 0; j < NX; j++) {
        this.pos.push(new THREE.Vector3());
        this.prev.push(new THREE.Vector3());
        this.normals.push(new THREE.Vector3());
      }
    }
    /** The cloth is wider than the line it is pegged along, so it hangs in soft folds between the rings. */
    const dx = (SHEET.length * SHEET.fullness) / (NX - 1), dy = SHEET.drop / (NY - 1);
    const link = (a: number, b: number, length: number, stiff: number) => this.links.push([a, b, length, stiff]);
    for (let k = 0; k < NY; k++) {
      for (let j = 0; j < NX; j++) {
        const i = k * NX + j;
        if (j + 1 < NX) link(i, i + 1, dx, 1);
        if (k + 1 < NY) link(i, i + NX, dy, 1);
        if (j + 1 < NX && k + 1 < NY) {
          link(i, i + NX + 1, Math.hypot(dx, dy), 0.5);
          link(i + 1, i + NX, Math.hypot(dx, dy), 0.5);
        }
        if (j + 2 < NX) link(i, i + 2, dx * 2, 0.12);
        if (k + 2 < NY) link(i, i + 2 * NX, dy * 2, 0.12);
      }
    }
    for (let r = 0; r < SHEET.rings; r++) this.rings.push(Math.round(r * RING_EVERY));

    this.clothGeo = new THREE.BufferGeometry();
    this.clothGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NX * NY * 3), 3));
    this.clothGeo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(NX * NY * 3), 3));
    const uv = new Float32Array(NX * NY * 2);
    const idx: number[] = [];
    for (let k = 0; k < NY; k++) {
      for (let j = 0; j < NX; j++) {
        uv.set([j / (NX - 1), k / (NY - 1)], (k * NX + j) * 2);
        if (j + 1 < NX && k + 1 < NY) {
          const i = k * NX + j;
          idx.push(i, i + NX, i + 1, i + 1, i + NX, i + NX + 1);
        }
      }
    }
    this.clothGeo.setAttribute('aUv', new THREE.BufferAttribute(uv, 2));
    this.clothGeo.setIndex(idx);
    this.clothMaterial = new THREE.ShaderMaterial({
      vertexShader: CLOTH_VERT, fragmentShader: CLOTH_FRAG,
      uniforms: { ...atmo.uniforms, uThrough: { value: tuning.crossings.sheet.through } }, side: THREE.DoubleSide,
    });
    const cloth = new THREE.Mesh(this.clothGeo, this.clothMaterial);

    const hard = new THREE.ShaderMaterial({ vertexShader: HARD_VERT, fragmentShader: HARD_FRAG, uniforms: { ...atmo.uniforms }, side: THREE.DoubleSide });
    this.lineGeo = new THREE.BufferGeometry();
    this.lineGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(LINE_SAMPLES * LINE_SIDES * 3), 3));
    this.lineGeo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(LINE_SAMPLES * LINE_SIDES * 3), 3));
    const col = new Float32Array(LINE_SAMPLES * LINE_SIDES * 3);
    for (let i = 0; i < LINE_SAMPLES * LINE_SIDES; i++) col.set([ROPE.r, ROPE.g, ROPE.b], i * 3);
    this.lineGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const lidx: number[] = [];
    for (let i = 0; i + 1 < LINE_SAMPLES; i++) {
      for (let s = 0; s < LINE_SIDES; s++) {
        const a = i * LINE_SIDES + s, b = i * LINE_SIDES + (s + 1) % LINE_SIDES;
        lidx.push(a, a + LINE_SIDES, b, b, a + LINE_SIDES, b + LINE_SIDES);
      }
    }
    this.lineGeo.setIndex(lidx);
    const line = new THREE.Mesh(this.lineGeo, hard);

    const ring = new THREE.TorusGeometry(0.045, 0.011, 5, 10).rotateY(Math.PI / 2);
    const peg = new THREE.BoxGeometry(0.03, 0.13, 0.045).translate(0, -0.075, 0);
    const ringParts = [coloured(ring, IRON), coloured(peg, PEG)];
    const ringGeo = mergeParts(ringParts);
    this.ringMesh = new THREE.InstancedMesh(ringGeo, hard, SHEET.rings);

    const fixed = this.fixtures(spot);
    const fixtures = new THREE.Mesh(fixed, hard);
    for (const m of [cloth, line, this.ringMesh, fixtures]) {
      m.frustumCulled = false;
      m.layers.enable(REFLECTION_LAYER);
      this.group.add(m);
    }
    this.group.layers.enable(REFLECTION_LAYER);
    this.objects = [this.group];
    this.reset();
  }

  reset(): void {
    this.travel = this.start;
    this.press = this.fill = this.incoming = this.holdDip = this.holdDipSpeed = this.catDip = 0;
    this.held = false;
    this.cat = null;
    this.quiet = Infinity;
    this.wasFull = false;
    this.spread = 9;
    this.layRings();
    const dy = SHEET.drop / (NY - 1);
    for (let k = 0; k < NY; k++) {
      for (let j = 0; j < NX; j++) {
        const i = k * NX + j;
        const top = this.lineAt(this.travel + (j / (NX - 1)) * SHEET.length, this.tmp);
        const fold = Math.sin((j / RING_EVERY) * Math.PI) * (j % (2 * RING_EVERY) < RING_EVERY ? 1 : -1);
        this.pos[i].set(top.x - this.along.z * fold * 0.12, top.y - k * dy - 0.06 * Math.abs(fold), top.z + this.along.x * fold * 0.12);
        this.prev[i].copy(this.pos[i]);
      }
    }
    for (let i = 0; i < 90; i++) this.step(1 / 60, 0);
    this.draw();
  }

  /** On the line, `d` metres from where it is made fast on her side, as it hangs now under what weighs on it. */
  lineAt(d: number, out: THREE.Vector3): THREE.Vector3 {
    const L = this.length;
    const u = THREE.MathUtils.clamp(d / L, 0, 1);
    out.lerpVectors(this.from, this.to, u);
    out.y -= tuning.crossings.sheet.slack * L * 4 * u * (1 - u);
    out.y -= this.holdDip * vee(u, this.travel / L);
    out.y -= this.catDip * vee(u, this.catAlong / L);
    return out;
  }

  /** The height of the line under a point of the world, for the cat that runs it. */
  floor(x: number, z: number): number {
    const d = (x - this.from.x) * this.along.x + (z - this.from.z) * this.along.z;
    const level = Math.hypot(this.to.x - this.from.x, this.to.z - this.from.z);
    return this.lineAt((d / level) * this.length, this.tmp2).y;
  }

  /** Where she holds the trailing edge, just under its ring, with `side` (m) along the line either way for each mitten. */
  hold(out: THREE.Vector3, side = 0): THREE.Vector3 {
    this.lineAt(this.travel + side, out);
    out.y -= HOLD_DROP;
    return out;
  }

  /** How far the trailing ring can go before the rings ahead of it are bunched against the far pulley. */
  get end(): number {
    return this.length - this.stop - (SHEET.rings - 1) * SHEET.bunch;
  }

  /** The middle of the cloth as it hangs now. */
  middle(out: THREE.Vector3): THREE.Vector3 {
    return out.copy(this.pos[Math.floor(NY / 2) * NX + Math.floor(NX / 2)]);
  }

  /** The way up the line on screen, as an angle anticlockwise from the right. */
  heading(camera: THREE.Camera): number {
    const a = this.projected.copy(this.lineAt(this.travel, this.tmp)).project(camera);
    const ax = a.x, ay = a.y;
    const b = this.projected.copy(this.lineAt(Math.min(this.length, this.travel + SHEET.length), this.tmp)).project(camera);
    return Math.atan2(b.y - ay, (b.x - ax) * ((camera as THREE.PerspectiveCamera).aspect ?? 1));
  }

  /**
   * A stroke that passes over the sheet on screen is air on it: the part of it going up the line fills it, a beat
   * late; back down the line only puffs it back toward her. It counts by how much of the sheet's own length it swept
   * across, so a sheet small or steep on screen takes the same strokes as one seen large. Returns the push taken, in
   * sheet lengths.
   */
  brush(camera: THREE.PerspectiveCamera, input: PointerInput, wind: WindField, dt: number): number {
    if (!input.present || input.muted || dt <= 0) return 0;
    const k = tuning.crossings.sheet;
    const aspect = camera.aspect;
    const sx = (input.ndc.x - input.prevNdc.x) * aspect * 0.5, sy = (input.ndc.y - input.prevNdc.y) * 0.5;
    const travel = Math.hypot(sx, sy);
    if (travel < 1e-5) return 0;
    const screen = (p: THREE.Vector3, out: THREE.Vector2) => {
      this.projected.copy(p).project(camera);
      return out.set(this.projected.x * aspect * 0.5, this.projected.y * 0.5);
    };
    const [c0, c1, c2, c3] = this.corners;
    screen(this.pos[0], c0);
    screen(this.pos[NX - 1], c1);
    screen(this.pos[NX * NY - 1], c2);
    screen(this.pos[(NY - 1) * NX], c3);
    this.sc.set(input.prevNdc.x * aspect * 0.5, input.prevNdc.y * 0.5);
    this.sd.set(input.ndc.x * aspect * 0.5, input.ndc.y * 0.5);
    const inside = inQuad(this.sc, this.corners) || inQuad(this.sd, this.corners);
    let gap = inside ? 0 : Infinity;
    for (let e = 0; e < 4 && gap > 0; e++) gap = Math.min(gap, segmentGap(this.sc, this.sd, this.corners[e], this.corners[(e + 1) % 4]));
    const hit = gap < k.reach ? Math.min(1, 1.3 * (1 - gap / k.reach)) : 0;
    if (hit <= 0) return 0;
    const heading = this.heading(camera);
    const across = Math.max(0.02, Math.hypot((c1.x + c2.x - c0.x - c3.x) / 2, (c1.y + c2.y - c0.y - c3.y) / 2));
    const up = (sx * Math.cos(heading) + sy * Math.sin(heading)) / across;
    const firm = THREE.MathUtils.lerp(k.soft, 1, THREE.MathUtils.smoothstep(travel / dt / across, k.gentle, k.firm));
    const push = up * hit * firm;
    this.incoming += push * (push > 0 ? k.push : k.against);
    if (push > 0.002) this.quiet = 0;
    /** The stroke's air comes into the cloth where it crossed it and spreads from there. */
    const mid = this.sa.copy(this.sc).add(this.sd).multiplyScalar(0.5);
    const lead = this.sb.copy(c1).add(c2).multiplyScalar(0.5);
    const trail = this.sc.copy(c0).add(c3).multiplyScalar(0.5);
    const span = lead.sub(trail);
    this.hitAt = THREE.MathUtils.clamp(mid.sub(trail).dot(span) / Math.max(span.lengthSq(), 1e-6), 0, 1);
    this.spread = 0;
    this.middle(this.tmp);
    wind.addSplat({ source: this, ax: this.tmp.x, az: this.tmp.z, bx: this.tmp.x, bz: this.tmp.z,
      vx: input.gustDir.x * input.gust, vz: input.gustDir.y * input.gust, radius: 2, energy: Math.min(0.3, input.gust / 40) * hit, lift: 0, swirl: 0 });
    return push;
  }

  /** A push of the world's own, as a stroke sweeping `amount` of the sheet's length up the line would give. */
  nudge(amount: number): void {
    this.incoming += amount * tuning.crossings.sheet.push;
    this.hitAt = 0.3;
    this.spread = 0;
  }

  update(dt: number, camera: THREE.Camera, wind: WindField): void {
    if (dt <= 0) return;
    const k = tuning.crossings.sheet;
    this.quiet += dt;
    const take = 1 - Math.exp(-dt / k.lag);
    const arriving = this.incoming * take;
    this.incoming -= arriving;
    this.press = THREE.MathUtils.clamp(this.press + arriving, -k.backMax, k.pressMax) * Math.exp(-dt / k.hold);
    this.fill += (Math.max(0, this.press) - this.fill) * (1 - Math.exp(-dt * k.fillRate));
    this.spread += dt * k.spreadSpeed;

    /** Her weight sags the line at her hands, with a little give as it takes her; the cat's only dips it. */
    const sag = this.held ? k.holdDip : 0;
    this.holdDipSpeed += ((sag - this.holdDip) * 60 - this.holdDipSpeed * 7) * dt;
    this.holdDip += this.holdDipSpeed * dt;
    if (this.cat) {
      const d = (this.cat.x - this.from.x) * this.along.x + (this.cat.z - this.from.z) * this.along.z;
      this.catAlong = THREE.MathUtils.clamp(d / Math.hypot(this.to.x - this.from.x, this.to.z - this.from.z), 0, 1) * this.length;
    }
    this.catDip += ((this.cat ? k.catDip : 0) - this.catDip) * (1 - Math.exp(-dt * 10));

    this.layRings();
    const steps = Math.min(4, Math.max(1, Math.ceil(dt * 120)));
    const ambient = wind.sample(this.middle(this.tmp).x, this.tmp.z, this.sample);
    for (let s = 0; s < steps; s++) this.step(dt / steps, Math.hypot(ambient.x, ambient.z), camera);
    this.draw();

    const full = this.fill > k.fullAt;
    if (full && !this.wasFull) this.onSound?.('fill', this.middle(this.tmp), Math.min(1, this.fill));
    if (!full && this.wasFull && this.press < k.fullAt * 0.5) this.onSound?.('sag', this.middle(this.tmp), 0.5);
    this.wasFull = full;
    this.flapClock -= dt * (0.3 + this.fill * 2.5);
    if (this.flapClock <= 0) {
      this.flapClock = 0.9 + Math.random() * 1.4;
      if (this.fill > 0.12) this.onSound?.('flap', this.middle(this.tmp), 0.2 + this.fill * 0.5);
    }
  }

  /** The rings along the line: spread as pegged from the trailing one, bunching against the far pulley. */
  private layRings(): void {
    const space = SHEET.length / (SHEET.rings - 1);
    for (let r = 0; r < SHEET.rings; r++) {
      const d = Math.min(this.travel + r * space, this.length - this.stop - (SHEET.rings - 1 - r) * SHEET.bunch);
      const at = this.lineAt(d, this.out);
      let pin = this.pins.get(this.rings[r]);
      if (!pin) this.pins.set(this.rings[r], pin = new THREE.Vector3());
      pin.copy(at);
      this.matrix.compose(at, this.quat.setFromAxisAngle(this.tmp.set(0, 1, 0), Math.atan2(this.along.x, this.along.z)), this.tmp2.set(1, 1, 1));
      this.ringMesh.setMatrixAt(r, this.matrix);
    }
    this.ringMesh.instanceMatrix.needsUpdate = true;
    const holdAt = HOLD_ROW * NX;
    if (this.held) {
      let pin = this.pins.get(holdAt);
      if (!pin) this.pins.set(holdAt, pin = new THREE.Vector3());
      this.hold(pin);
    } else this.pins.delete(holdAt);
  }

  /**
   * One step of the cloth: gravity, the air on each part of it across its face and along it, and its threads held to
   * their lengths. The player's air comes up the line, out of the side it is seen from, and lifts the hem.
   */
  private step(dt: number, ambient: number, camera?: THREE.Camera): void {
    const k = tuning.crossings.sheet;
    this.normalsNow();
    const out = this.out.set(-this.along.z, 0, this.along.x);
    if (camera && out.dot(this.tmp.subVectors(camera.position, this.from)) < 0) out.negate();
    const g = 9.81 * k.gravity;
    const t = atmo.uniforms.uTime.value;
    const press = this.press;
    const dd = dt * dt;
    for (let kk = 0; kk < NY; kk++) {
      const down = kk / (NY - 1);
      for (let j = 0; j < NX; j++) {
        const i = kk * NX + j;
        const p = this.pos[i], q = this.prev[i];
        if (this.pins.has(i)) {
          q.copy(p);
          p.copy(this.pins.get(i)!);
          continue;
        }
        const u = j / (NX - 1);
        /** The stroke's air reaches the part it crossed first and the rest of the cloth after. */
        const reached = 1 - THREE.MathUtils.smoothstep(Math.abs(u - this.hitAt) - this.spread, 0, 0.35);
        const gust = press * (0.35 + 0.65 * reached);
        const flutter = (Math.sin(t * 7.3 + u * 9 + down * 5) * 0.6 + Math.sin(t * 11.1 - u * 13 + down * 3) * 0.4) * (Math.abs(gust) + ambient * 0.05)
          + k.breath * (Math.sin(t * 0.7 + u * 2.1) * 0.7 + Math.sin(t * 0.43 - down * 1.7) * 0.3);
        const air = this.air.copy(this.along).multiplyScalar(gust * k.forward)
          .addScaledVector(out, Math.abs(gust) * k.belly * (0.4 + 0.6 * Math.sin(u * Math.PI)) + flutter * k.flutter)
          .setY(Math.max(0, gust) * k.lift * down);
        const vx = (p.x - q.x) / dt, vy = (p.y - q.y) / dt, vz = (p.z - q.z) / dt;
        const rx = air.x - vx, ry = air.y - vy, rz = air.z - vz;
        const n = this.normals[i];
        const across = rx * n.x + ry * n.y + rz * n.z;
        const ax = n.x * across * k.face + (rx - n.x * across) * k.drag;
        const ay = n.y * across * k.face + (ry - n.y * across) * k.drag - g;
        const az = n.z * across * k.face + (rz - n.z * across) * k.drag;
        const keep = 1 - k.damping * dt;
        const nx = p.x + (p.x - q.x) * keep + ax * dd;
        const ny = p.y + (p.y - q.y) * keep + ay * dd;
        const nz = p.z + (p.z - q.z) * keep + az * dd;
        q.copy(p);
        p.set(nx, ny, nz);
      }
    }
    for (let it = 0; it < k.iterations; it++) {
      for (const [a, b, rest, stiff] of this.links) {
        const pa = this.pos[a], pb = this.pos[b];
        const dx = pb.x - pa.x, dy = pb.y - pa.y, dz = pb.z - pa.z;
        const d = Math.hypot(dx, dy, dz);
        if (d < 1e-6) continue;
        /** Threads do not stretch, but gathered cloth folds rather than pushing its rings apart. */
        const over = d - rest;
        if (over < 0 && stiff >= 1) continue;
        const ma = this.pins.has(a) ? 0 : 1, mb = this.pins.has(b) ? 0 : 1;
        if (ma + mb === 0) continue;
        const f = (over / d) * stiff / (ma + mb);
        pa.x += dx * f * ma; pa.y += dy * f * ma; pa.z += dz * f * ma;
        pb.x -= dx * f * mb; pb.y -= dy * f * mb; pb.z -= dz * f * mb;
      }
    }
  }

  private normalsNow(): void {
    for (let kk = 0; kk < NY; kk++) {
      for (let j = 0; j < NX; j++) {
        const i = kk * NX + j;
        const l = this.pos[kk * NX + Math.max(0, j - 1)], r = this.pos[kk * NX + Math.min(NX - 1, j + 1)];
        const u = this.pos[Math.max(0, kk - 1) * NX + j], d = this.pos[Math.min(NY - 1, kk + 1) * NX + j];
        this.tmp.subVectors(r, l);
        this.tmp2.subVectors(d, u);
        this.normals[i].crossVectors(this.tmp2, this.tmp).normalize();
      }
    }
  }

  private draw(): void {
    const pos = this.clothGeo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < NX * NY; i++) pos.setXYZ(i, this.pos[i].x, this.pos[i].y, this.pos[i].z);
    pos.needsUpdate = true;
    this.clothGeo.computeVertexNormals();
    this.clothGeo.computeBoundingSphere();

    const lp = this.lineGeo.attributes.position as THREE.BufferAttribute;
    const ln = this.lineGeo.attributes.normal as THREE.BufferAttribute;
    const side = this.tmp2.set(-this.along.z, 0, this.along.x);
    for (let i = 0; i < LINE_SAMPLES; i++) {
      const c = this.lineAt((i / (LINE_SAMPLES - 1)) * this.length, this.out);
      for (let s = 0; s < LINE_SIDES; s++) {
        const a = (s / LINE_SIDES) * Math.PI * 2;
        const nx = side.x * Math.cos(a), ny = Math.sin(a), nz = side.z * Math.cos(a);
        lp.setXYZ(i * LINE_SIDES + s, c.x + nx * 0.016, c.y + ny * 0.016, c.z + nz * 0.016);
        ln.setXYZ(i * LINE_SIDES + s, nx, ny, nz);
      }
    }
    lp.needsUpdate = ln.needsUpdate = true;
    this.lineGeo.computeBoundingSphere();
  }

  /** The lashings at each end, the far pulley, the knot that stops the rings, and the props the line runs over. */
  private fixtures(spot: SheetSpot): THREE.BufferGeometry {
    const parts: THREE.BufferGeometry[] = [];
    const yaw = Math.atan2(this.along.x, this.along.z);
    const at = (g: THREE.BufferGeometry, p: THREE.Vector3) => g.applyMatrix4(new THREE.Matrix4().makeRotationY(yaw)).translate(p.x, p.y, p.z);
    parts.push(coloured(at(new THREE.TorusGeometry(0.07, 0.02, 5, 10).rotateX(Math.PI / 2), this.from.clone().setY(this.from.y - 0.05)), ROPE));
    parts.push(coloured(at(new THREE.CylinderGeometry(0.1, 0.1, 0.04, 12).rotateZ(Math.PI / 2), this.to.clone().setY(this.to.y - 0.08)), IRON));
    const knot = this.lineAt(this.length - this.stop + 0.04, new THREE.Vector3());
    parts.push(coloured(new THREE.SphereGeometry(0.04, 6, 4).translate(knot.x, knot.y, knot.z), ROPE));
    for (const [i, foot] of (spot.props ?? []).entries()) {
      if (!foot) continue;
      const end = i === 0 ? this.from : this.to;
      const top = end.clone().setY(end.y - 0.1);
      const low = foot.clone().setY(foot.y - 0.55);
      const len = low.distanceTo(top);
      const pole = new THREE.CylinderGeometry(0.04, 0.055, len, 6).translate(0, len / 2, 0);
      pole.applyMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), top.clone().sub(low).normalize())));
      parts.push(coloured(pole.translate(low.x, low.y, low.z), POLE));
      for (const s of [-1, 1]) {
        const tine = new THREE.CylinderGeometry(0.022, 0.032, 0.24, 5).translate(0, 0.12, 0).rotateX(s * 0.4);
        parts.push(coloured(at(tine, top.clone().setY(top.y - 0.02)), POLE));
      }
      for (const h of [0.05, 0.4]) {
        parts.push(coloured(new THREE.TorusGeometry(0.07, 0.016, 4, 10).rotateX(Math.PI / 2).translate(foot.x, foot.y - 0.5 + h, foot.z), ROPE));
      }
    }
    return mergeParts(parts);
  }
}

/** A point load's sag along a taut line, peaking where the load is (both as shares of the line). */
function vee(u: number, at: number): number {
  const a = THREE.MathUtils.clamp(at, 0.02, 0.98);
  return u < a ? u / a : (1 - u) / (1 - a);
}

function inQuad(p: THREE.Vector2, q: THREE.Vector2[]): boolean {
  let sign = 0;
  for (let i = 0; i < 4; i++) {
    const a = q[i], b = q[(i + 1) % 4];
    const c = (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
    if (c !== 0) {
      if (sign === 0) sign = Math.sign(c);
      else if (Math.sign(c) !== sign) return false;
    }
  }
  return true;
}

function mergeParts(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const pos: number[] = [], nrm: number[] = [], col: number[] = [];
  for (const g of parts) {
    const p = g.attributes.position, n = g.attributes.normal, c = g.attributes.color;
    for (let i = 0; i < p.count; i++) {
      pos.push(p.getX(i), p.getY(i), p.getZ(i));
      nrm.push(n.getX(i), n.getY(i), n.getZ(i));
      col.push(c.getX(i), c.getY(i), c.getZ(i));
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return geo;
}
