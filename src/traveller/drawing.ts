import * as THREE from 'three';
import { PAPER_GRIP } from '../glider/glider';
import { tuning } from '../tuning';
import { ATMO_GLSL, atmo } from '../world/atmosphere';

/**
 * The sheet the paper plane was folded from, in the glider's own units: half of it across (the wing span plus the
 * keel), half of it along (the plane's length, nose at +y), and the wing creases at ±KEEL, which is how deep the
 * keel hangs. Folded, it is the plane; opened, it is the drawing. It is the same piece of paper either way.
 */
const HALF_W = 1.65;
const HALF_L = 1.225;
const KEEL = 0.5;
/** The glider's own scale, and how much of the sheet a child's hands keep hold of once it is open. */
const SCALE = 0.85;
const HELD = 0.68;
/**
 * Where the hand has hold of the folded paper: the glider's own grip, because folded, the sheet lies on the
 * glider's five points in the glider's own frame, so with the same grip, pose and scale the one can be exchanged
 * for the other in the child's hand without anything moving.
 */
const HOLD = [PAPER_GRIP.x, PAPER_GRIP.y, PAPER_GRIP.z] as const;
/** The paper's grain in the glider's own units, so the ruling on the folded sheet lies where the glider's does. */
const PAPER_U = 0.4;
/** Folded layers are held a hair apart, or two faces of paper fight for the same pixels. */
const LAYER = 0.013;
/** Midpoint splits of every crease-bounded facet: enough that the open sheet can bow and flutter. */
const SUB = 2;

const VERT = /* glsl */ `
in vec2 aPaper;
out vec2 vUv;
out vec2 vPaper;
out vec3 vWorld;
out vec3 vNormal;
void main() {
  vUv = uv;
  vPaper = aPaper;
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  vNormal = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

/**
 * Ruled notebook paper, and a child's crayon drawing that is not on it yet. Folded, the sheet is the glider's own
 * paper and nothing else: the same white, the same ruling, the same faint margin, lit the same way, so the plane
 * the child has carried all game can be exchanged for it without a frame changing. `uDrawn` runs the crayon in
 * from the bottom of the page as the paper comes flat — the sun, two green hills, a stone wall, a white cottage
 * with a red door and a lit window, a small yellow figure with a red scarf, and last of all a paper plane in the
 * sky. `uOpen` brings the creases up as it opens, and the back of the sheet stays bare paper throughout.
 */
const FRAG = /* glsl */ `
${ATMO_GLSL}
uniform float uDrawn;
uniform float uOpen;
in vec2 vUv;
in vec2 vPaper;
in vec3 vWorld;
in vec3 vNormal;

float scribble(vec2 uv, float angle, float freq, float cover) {
  vec2 d = vec2(cos(angle), sin(angle));
  float wobble = vnoise(uv * 14.0) * 2.4 + vnoise(uv * 40.0) * 0.8;
  float s = sin(dot(uv, d) * freq + wobble) * 0.5 + 0.5;
  float wax = smoothstep(0.35, 0.75, vnoise(uv * vec2(90.0, 60.0)));
  return smoothstep(1.0 - cover, 1.0 - cover + 0.18, s) * mix(0.55, 1.0, wax);
}

float stroke(float d, float width) {
  return 1.0 - smoothstep(width * 0.6, width, abs(d));
}

vec3 layer(vec3 base, vec3 crayon, float amount) {
  return mix(base, crayon, clamp(amount, 0.0, 1.0));
}

void main() {
  vec2 uv = vUv;
  vec2 jitter = vec2(vnoise(uv * 23.0), vnoise(uv * 23.0 + 7.0)) * 0.006;
  vec2 p = uv + jitter;
  /** The glider's paper, to its own numbers: whatever else happens on this sheet, it is made of that. */
  vec3 paper = vec3(0.96, 0.93, 0.87);
  float ruled = 1.0 - smoothstep(0.0, 0.05, abs(fract(vPaper.y * 9.0) - 0.5) - 0.42);
  paper = mix(paper, vec3(0.55, 0.7, 0.95), ruled * 0.3);
  float margin = 1.0 - smoothstep(0.0, 0.019, abs(uv.x - 0.09));
  paper = mix(paper, vec3(0.95, 0.45, 0.45), margin * 0.35);
  vec3 col = paper;

  float back = 0.56 + 0.07 * sin(p.x * 5.2 + 0.6) + 0.03 * sin(p.x * 13.0);
  float front = 0.36 + 0.09 * sin(p.x * 3.4 + 2.1) + 0.02 * sin(p.x * 11.0);
  float sky = step(back, p.y);
  col = layer(col, vec3(0.5, 0.72, 0.93), sky * scribble(p, 0.35, 260.0, 0.42));

  vec2 sunC = vec2(0.2, 0.8);
  float sunD = length((p - sunC) * vec2(1.48, 1.0));
  col = layer(col, vec3(0.98, 0.72, 0.18), (1.0 - smoothstep(0.075, 0.085, sunD)) * scribble(p, 1.2, 320.0, 0.75));
  float rays = step(0.1, sunD) * step(sunD, 0.16) * step(0.72, sin(atan(p.y - sunC.y, (p.x - sunC.x) * 1.48) * 11.0) * 0.5 + 0.5);
  col = layer(col, vec3(0.97, 0.62, 0.15), rays * 0.9);

  float backHill = step(p.y, back) * step(front, p.y);
  col = layer(col, vec3(0.5, 0.74, 0.3), backHill * scribble(p, -0.4, 240.0, 0.6));
  col = layer(col, vec3(0.28, 0.5, 0.18), stroke(p.y - back, 0.006));
  float frontHill = step(p.y, front);
  col = layer(col, vec3(0.2, 0.52, 0.22), frontHill * scribble(p, 0.9, 230.0, 0.66));

  float wallY = 0.24 + 0.05 * sin(p.x * 6.5 + 0.4);
  float dash = step(0.35, fract(p.x * 42.0));
  col = layer(col, vec3(0.45, 0.45, 0.46), stroke(p.y - wallY, 0.012) * dash);

  vec2 h = p - vec2(0.68, 0.5);
  float walls = step(abs(h.x), 0.064) * step(-0.045, h.y) * step(h.y, 0.02);
  col = layer(col, vec3(0.97, 0.96, 0.92), walls);
  col = layer(col, vec3(0.3, 0.28, 0.27), walls * (1.0 - step(abs(h.x), 0.058) * step(-0.039, h.y) * step(h.y, 0.014)));
  float roof = step(0.02, h.y) * step(h.y, 0.02 + (0.078 - abs(h.x)) * 0.86) * step(abs(h.x), 0.078);
  col = layer(col, vec3(0.68, 0.48, 0.2), roof * scribble(p, 2.2, 400.0, 0.8));
  col = layer(col, vec3(0.8, 0.2, 0.16), step(abs(h.x - 0.005), 0.011) * step(-0.045, h.y) * step(h.y, -0.012));
  col = layer(col, vec3(0.98, 0.82, 0.3), step(abs(h.x + 0.036), 0.01) * step(abs(h.y + 0.012), 0.009));
  col = layer(col, vec3(0.98, 0.82, 0.3), step(abs(h.x - 0.041), 0.01) * step(abs(h.y + 0.012), 0.009));
  vec2 smoke = p - vec2(0.728, 0.575);
  col = layer(col, vec3(0.6, 0.6, 0.62), stroke(length(smoke * vec2(1.0, 1.4)) - 0.018 - 0.01 * sin(atan(smoke.y, smoke.x) * 3.0), 0.005) * step(0.0, smoke.y));

  vec2 k = p - vec2(0.39, 0.29);
  float body = step(abs(k.x), 0.023 - k.y * 0.3) * step(-0.05, k.y) * step(k.y, 0.0);
  col = layer(col, vec3(0.93, 0.68, 0.16), body * scribble(p, 1.6, 500.0, 0.85));
  col = layer(col, vec3(0.97, 0.8, 0.66), 1.0 - smoothstep(0.013, 0.016, length((k - vec2(0.0, 0.018)) * vec2(1.14, 1.0))));
  col = layer(col, vec3(0.85, 0.2, 0.16), stroke(k.y - 0.002 + (k.x - 0.02) * 0.3, 0.005) * step(-0.018, k.x) * step(k.x, 0.045));
  col = layer(col, vec3(0.2, 0.15, 0.12), (1.0 - smoothstep(0.002, 0.003, length(k - vec2(-0.005, 0.02)))) + (1.0 - smoothstep(0.002, 0.003, length(k - vec2(0.005, 0.02)))));

  vec2 pl = p - vec2(0.5, 0.78);
  float plane = step(abs(pl.y), 0.02 - abs(pl.x) * 0.35) * step(abs(pl.x), 0.045);
  col = layer(col, vec3(0.35, 0.35, 0.4), stroke(abs(pl.y) - (0.02 - abs(pl.x) * 0.35), 0.004) * step(abs(pl.x), 0.045));
  col = layer(col, vec3(0.99, 0.99, 0.97), plane * 0.6);
  col = layer(col, vec3(0.45, 0.45, 0.5), stroke(pl.y + 0.03 + 0.012 * sin(pl.x * 60.0), 0.003) * step(0.045, -pl.x) * step(-pl.x, 0.18) * step(0.5, fract(pl.x * 30.0)));

  /**
   * The crayon comes in from the foot of the page upward, with a waxy edge, so the ground and the wall are there
   * before the house and the house before the sun and the little plane: it draws itself while the paper flattens.
   */
  float wob = (vnoise(p * 9.0) - 0.5) * 0.17;
  float nib = mix(-0.25, 1.3, uDrawn);
  float ink = 1.0 - smoothstep(nib - 0.24, nib, p.y + wob);
  col = mix(paper, col, ink);

  /** The creases it was folded on: the spine, the two wing folds, and the two the nose was made from. */
  vec2 pp = (uv - 0.5) * vec2(${(2 * HALF_W).toFixed(3)}, ${(2 * HALF_L).toFixed(3)});
  float cx = abs(pp.x);
  float crease = stroke(cx, 0.022);
  crease = max(crease, stroke(cx - ${KEEL.toFixed(3)}, 0.022));
  crease = max(crease, stroke(pp.y - (${HALF_L.toFixed(3)} - cx), 0.022));
  crease *= 0.75 * smoothstep(0.1, 0.5, uOpen);

  vec3 N = normalize(vNormal) * (gl_FrontFacing ? 1.0 : -1.0);
  vec3 V = normalize(cameraPosition - vWorld);
  vec3 alb = mix(gl_FrontFacing ? col : paper, paper * 0.72, crease);
  float ndl = dot(N, uSunDir);
  float through = max(-ndl, 0.0) * 0.45;
  float rim = pow(1.0 - max(dot(N, V), 0.0), 3.0);
  vec3 lit = alb * (hemiLight(N) * 1.1 + uSunColor * (max(ndl, 0.0) * 0.7 + through)) + uSunColor * rim * 0.22;
  gl_FragColor = vec4(applyFog(lit, vWorld), 1.0);
}`;

/** One crease-bounded piece of the sheet: which folds carry it, and where it lies while the paper is flat. */
interface Facet {
  poly: number[][];
  /** On a nose flap, folded over about the diagonal crease that runs out of the nose. */
  flap: number;
  /** Which half of the sheet it is on: -1 the side whose wing comes up first, +1 the other. */
  side: number;
  /** Outside the wing crease, so it is a wing and not a side of the keel. */
  wing: number;
}

function facets(): Facet[] {
  const out: Facet[] = [];
  for (const s of [-1, 1]) {
    out.push({ poly: [[s * HALF_W, -HALF_L], [s * KEEL, -HALF_L], [s * KEEL, HALF_L - KEEL], [s * HALF_W, HALF_L - HALF_W]], flap: 0, side: s, wing: 1 });
    out.push({ poly: [[s * KEEL, -HALF_L], [0, -HALF_L], [0, HALF_L], [s * KEEL, HALF_L - KEEL]], flap: 0, side: s, wing: 0 });
    out.push({ poly: [[0, HALF_L], [s * KEEL, HALF_L - KEEL], [s * HALF_W, HALF_L - KEEL], [s * HALF_W, HALF_L]], flap: 1, side: s, wing: 0 });
    out.push({ poly: [[s * KEEL, HALF_L - KEEL], [s * HALF_W, HALF_L - HALF_W], [s * HALF_W, HALF_L - KEEL]], flap: 1, side: s, wing: 1 });
  }
  return out;
}

type Tri = number[][];

function split(tris: Tri[]): Tri[] {
  const out: Tri[] = [];
  for (const [a, b, c] of tris) {
    const ab = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const bc = [(b[0] + c[0]) / 2, (b[1] + c[1]) / 2];
    const ca = [(c[0] + a[0]) / 2, (c[1] + a[1]) / 2];
    out.push([a, ab, ca], [ab, b, bc], [ca, bc, c], [ab, bc, ca]);
  }
  return out;
}

/**
 * The paper: the plane the child has carried the whole way, and the drawing of home it was folded from. `open`
 * runs it from the one to the other — the wings come up, the sheet opens out of the fold down its middle, the nose
 * corners flip back — and `lift` carries it from one hand up into both.
 */
export class Drawing {
  readonly mesh: THREE.Mesh;
  /** 0 folded into the plane, 1 the flat sheet. */
  open = 0;
  /** 0 held in one hand as a plane, 1 held up in front of them in both. */
  lift = 0;
  /** 0 bare paper, 1 the crayon all there: the drawing is not on the sheet until it is coming flat. */
  drawn = 0;
  /** 0 lying along the hand the way a plane is carried, 1 turned up and round to be looked at. */
  turn = 0;
  private readonly material: THREE.ShaderMaterial;
  private readonly paper: Float32Array;
  private readonly flags: Float32Array;
  private readonly position: THREE.BufferAttribute;
  private readonly normal: THREE.BufferAttribute;
  private readonly count: number;
  private time = 0;
  private readonly p = new THREE.Vector3();
  private readonly ab = new THREE.Vector3();
  private readonly ac = new THREE.Vector3();
  private readonly n = new THREE.Vector3();
  private readonly at = new THREE.Vector3();
  private readonly axis = new THREE.Vector3();
  private readonly face = new THREE.Vector3();
  private readonly up = new THREE.Vector3();
  private readonly basis = new THREE.Matrix4();
  private readonly presented = new THREE.Quaternion();
  private readonly inHand = new THREE.Quaternion();
  private readonly offset = new THREE.Vector3();

  constructor() {
    this.material = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: { ...atmo.uniforms, uDrawn: { value: 0 }, uOpen: { value: 0 } },
      side: THREE.DoubleSide,
    });

    const tris: { tri: Tri; facet: Facet }[] = [];
    for (const facet of facets()) {
      let fan: Tri[] = [];
      for (let i = 1; i + 1 < facet.poly.length; i++) fan.push([facet.poly[0], facet.poly[i], facet.poly[i + 1]]);
      for (let i = 0; i < SUB; i++) fan = split(fan);
      for (const tri of fan) tris.push({ tri, facet });
    }
    this.count = tris.length * 3;
    this.paper = new Float32Array(this.count * 2);
    this.flags = new Float32Array(this.count * 3);
    const uv = new Float32Array(this.count * 2);
    const grain = new Float32Array(this.count * 2);
    let i = 0;
    for (const { tri, facet } of tris) {
      /** Every facet is wound the same way round, so the drawn side of the paper is the drawn side everywhere. */
      const [a, b, c] = tri;
      const area = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
      for (const [x, y] of area < 0 ? [a, c, b] : tri) {
        this.paper[i * 2] = x;
        this.paper[i * 2 + 1] = y;
        this.flags[i * 3] = facet.flap;
        this.flags[i * 3 + 1] = facet.side;
        this.flags[i * 3 + 2] = facet.wing;
        uv[i * 2] = 0.5 + x / (2 * HALF_W);
        uv[i * 2 + 1] = (y + HALF_L) / (2 * HALF_L);
        grain[i * 2] = 0.5 + x * PAPER_U;
        grain[i * 2 + 1] = 0.5 + y * PAPER_U;
        i++;
      }
    }
    const geo = new THREE.BufferGeometry();
    this.position = new THREE.BufferAttribute(new Float32Array(this.count * 3), 3);
    this.normal = new THREE.BufferAttribute(new Float32Array(this.count * 3), 3);
    this.position.setUsage(THREE.DynamicDrawUsage);
    this.normal.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', this.position);
    geo.setAttribute('normal', this.normal);
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setAttribute('aPaper', new THREE.BufferAttribute(grain, 2));
    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.visible = false;
    this.mesh.frustumCulled = false;
  }

  /** How far through one stage of the unfolding: 1 while that fold is still closed, 0 once it is open. */
  private stage(from: number, to: number): number {
    return 1 - THREE.MathUtils.smoothstep(this.open, from, to);
  }

  /** The near wing comes up first (A), then the far one falls open after it (B), then the sheet, then the nose. */
  private get wingA(): number {
    return this.stage(0, 0.2) * Math.PI * 0.5;
  }
  private get wingB(): number {
    return this.stage(0.08, 0.3) * Math.PI * 0.5;
  }
  private get book(): number {
    return this.stage(0.24, 0.56) * Math.PI * 0.5;
  }
  private get flapA(): number {
    return this.stage(0.5, 0.74) * Math.PI;
  }
  private get flapB(): number {
    return this.stage(0.57, 0.82) * Math.PI;
  }

  /**
   * Where a point of the sheet has got to, in the paper's own frame, with every fold it lies under applied in the
   * order it was made: the nose flap first, then the wing, then the fold down the middle that everything rides on.
   */
  private fold(px: number, py: number, flap: number, side: number, wing: number, out: THREE.Vector3): THREE.Vector3 {
    let x = px;
    let y = py;
    /** Open and held up it is not a board: it bows between the hands and breathes. */
    const loose = THREE.MathUtils.smoothstep(this.open, 0.7, 0.95);
    const across = px / HALF_W;
    let z = loose * (0.09 * (across * across - 0.34) + 0.03 * Math.sin(this.time * 1.5 + py * 1.3) * (1 - Math.abs(across)));

    if (flap > 0) {
      const angle = side > 0 ? this.flapA : this.flapB;
      if (angle > 1e-4) {
        /** About the crease out of the nose, folding over onto the drawn side, which is how the drawing is hidden. */
        const dx = -Math.SQRT1_2;
        const dy = side * Math.SQRT1_2;
        const vx = x;
        const vy = y - HALF_L;
        const cos = Math.cos(angle);
        const k = (dx * vx + dy * vy) * (1 - cos);
        z += (dx * vy - dy * vx) * Math.sin(angle) + LAYER * Math.sin(angle * 0.5);
        x = vx * cos + dx * k;
        y = HALF_L + vy * cos + dy * k;
      }
    }

    const book = this.book;
    z -= LAYER * Math.sin(book);
    if (wing > 0) {
      const angle = side * (side > 0 ? this.wingA : this.wingB);
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const dx = x - side * KEEL;
      x = side * KEEL + dx * cos + z * sin;
      z = z * cos - dx * sin;
    }
    if (book > 1e-4) {
      const cos = Math.cos(book);
      const sin = Math.sin(-side * book);
      const nx = x * cos + z * sin;
      z = z * cos - x * sin;
      x = nx;
    }
    /** Out of the sheet's frame into the plane's: across, along and off the page become span, nose and up. */
    return out.set(-x, z, y);
  }

  /** Which folds a point of the flat sheet lies under. */
  private flagsAt(px: number, py: number): number[] {
    const side = px < 0 ? -1 : 1;
    const flap = py > HALF_L - Math.abs(px) ? 1 : 0;
    const wing = flap ? (py < HALF_L - KEEL ? 1 : 0) : Math.abs(px) > KEEL ? 1 : 0;
    return [flap, side, wing];
  }

  /** Where a point of the sheet (paper coordinates, ±HALF_W across by ±HALF_L along) has got to in the world. */
  point(px: number, py: number, out: THREE.Vector3): THREE.Vector3 {
    const [flap, side, wing] = this.flagsAt(px, py);
    this.fold(px, py, flap, side, wing, out);
    return out.applyMatrix4(this.mesh.matrixWorld);
  }

  /**
   * Holds the paper: at the same grip and orientation as the carried plane, and up in front of
   * them at `up`, turned to face `toward`, once it is open. `lift` carries it from the one to the other.
   */
  place(hand: THREE.Vector3, up: THREE.Vector3, toward: THREE.Vector3, time: number, carried: THREE.Quaternion): void {
    this.time = time;
    this.material.uniforms.uDrawn.value = this.drawn;
    this.material.uniforms.uOpen.value = this.open;
    const raise = THREE.MathUtils.smootherstep(this.lift, 0, 1);
    const round = THREE.MathUtils.smootherstep(this.turn, 0, 1);
    /**
     * Start at the carried plane's scale and open to the familiar drawing size as the folds spread.
     */
    const size = THREE.MathUtils.lerp(tuning.paperCarry.scale, SCALE * HELD, THREE.MathUtils.smoothstep(this.open, 0.05, 0.45));
    this.mesh.scale.setScalar(size);

    /** Begin in the same carry pose as the glider, including its bank and the child's lean. */
    this.inHand.copy(carried);
    /** Open: the drawn side of it turned to them, the sun end of it up. */
    this.face.subVectors(toward, up).normalize();
    this.up.set(0, 1, 0).addScaledVector(this.face, -this.face.y).normalize();
    this.axis.crossVectors(this.face, this.up).normalize();
    this.basis.makeBasis(this.axis, this.face, this.up);
    this.presented.setFromRotationMatrix(this.basis);
    this.mesh.quaternion.copy(this.inHand).slerp(this.presented, round);

    /** The plane hangs from the hand by its keel; the open sheet is held about its middle. */
    this.at.copy(hand).lerp(up, raise);
    this.offset.set(HOLD[0], HOLD[1], HOLD[2]).multiplyScalar(size * (1 - round)).applyQuaternion(this.mesh.quaternion);
    this.mesh.position.copy(this.at).sub(this.offset);
    this.mesh.updateMatrixWorld();
    this.shape();
  }

  /** Folds every vertex of the sheet to where it is this frame, and gives each triangle its own normal. */
  private shape(): void {
    const pos = this.position.array as Float32Array;
    const nor = this.normal.array as Float32Array;
    for (let i = 0; i < this.count; i++) {
      this.fold(this.paper[i * 2], this.paper[i * 2 + 1], this.flags[i * 3], this.flags[i * 3 + 1], this.flags[i * 3 + 2], this.p);
      pos[i * 3] = this.p.x;
      pos[i * 3 + 1] = this.p.y;
      pos[i * 3 + 2] = this.p.z;
    }
    for (let t = 0; t < this.count; t += 3) {
      const o = t * 3;
      this.ab.set(pos[o + 3] - pos[o], pos[o + 4] - pos[o + 1], pos[o + 5] - pos[o + 2]);
      this.ac.set(pos[o + 6] - pos[o], pos[o + 7] - pos[o + 1], pos[o + 8] - pos[o + 2]);
      this.n.crossVectors(this.ab, this.ac).normalize();
      for (let k = 0; k < 3; k++) {
        nor[o + k * 3] = this.n.x;
        nor[o + k * 3 + 1] = this.n.y;
        nor[o + k * 3 + 2] = this.n.z;
      }
    }
    this.position.needsUpdate = true;
    this.normal.needsUpdate = true;
  }
}

/** The sheet's own size, for anything that wants to take hold of a corner of it. */
export const SHEET = { halfWidth: HALF_W, halfLength: HALF_L, keel: KEEL } as const;
