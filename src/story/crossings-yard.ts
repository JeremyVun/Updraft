import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { Shot } from '../camera';
import type { Deck } from '../world/decks';
import { ATMO_GLSL, atmo } from '../world/atmosphere';
import { heightAt } from '../world/island';
import { REFLECTION_LAYER } from '../world/water/reflection';
import { BARK, merged, tube } from '../world/crossings/shapes';
import { barkMaterial } from '../world/crossings/topple-tree';
import { TreeCrossing } from '../world/crossings/tree-crossing';
import { SwingCrossing } from '../world/crossings/swing-crossing';
import type { Cast } from './cast';

const ROOF_VERT = /* glsl */ `
in vec3 color;
in vec3 aLocal;
in float aKind;
out vec3 vWorld;
out vec3 vNormal;
out vec3 vColor;
out vec3 vLocal;
out float vKind;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  vNormal = mat3(modelMatrix) * normal;
  vColor = color;
  vLocal = aLocal;
  vKind = aKind;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const ROOF_FRAG = /* glsl */ `
${ATMO_GLSL}
in vec3 vWorld;
in vec3 vNormal;
in vec3 vColor;
in vec3 vLocal;
in float vKind;
void main() {
  vec3 n = normalize(vNormal);
  if (!gl_FrontFacing) n = -n;
  int kind = int(vKind + 0.5);
  vec3 alb = vColor * (0.9 + 0.17 * (vnoise(vLocal.xy * 2.3 + vLocal.z) * 0.6 + vnoise(vLocal.xz * 5.5 + vLocal.y) * 0.4));
  if (kind == 1) {
    float row = vLocal.y * 3.4;
    alb *= (0.8 + 0.4 * vnoise(vec2((vLocal.x + vLocal.z) * 4.5, floor(row)))) * (0.8 + 0.25 * smoothstep(0.0, 0.2, fract(row)));
  } else if (kind == 2) {
    float course = vLocal.y * 3.4;
    float run = (vLocal.x + vLocal.z) * 1.5 + fract(floor(course) * 0.37) * 3.0;
    float joint = max(1.0 - smoothstep(0.0, 0.09, fract(course)), 1.0 - smoothstep(0.0, 0.07, fract(run)));
    alb *= (0.76 + 0.4 * fract(sin(dot(vec2(floor(course), floor(run)), vec2(12.9898, 78.233))) * 43758.5)) * (1.0 - 0.45 * joint);
  }
  float lap = 0.09 * sin(vWorld.x * 0.8 + uTime * 1.3) + 0.06 * sin(vWorld.z * 1.1 - uTime * 0.9);
  float wet = 1.0 - smoothstep(0.0, 0.85, vWorld.y - lap);
  alb = mix(alb, alb * vec3(0.3, 0.38, 0.29), wet * 0.92);
  float ndl = max(dot(n, uSunDir), 0.0);
  float wrap = max(dot(n, uSunDir) * 0.5 + 0.5, 0.0);
  float sun = cloudShadow(vWorld.xz);
  vec3 col = alb * (hemiLight(n) * mix(0.5, 1.0, smoothstep(-1.2, 2.8, vWorld.y)) + uSunColor * mix(ndl, wrap * wrap, 0.25) * sun);
  vec3 V = normalize(cameraPosition - vWorld);
  float back = pow(max(dot(-V, uSunDir), 0.0), 3.0);
  float edge = pow(1.0 - clamp(dot(n, V), 0.0, 1.0), 3.0);
  col += uSunColor * edge * back * sun * 0.16 * (0.35 + alb);
  gl_FragColor = vec4(applyFog(col, vWorld), 1.0);
}`;

const lin = (r: number, g: number, b: number) => new THREE.Color().setRGB(r, g, b);
const LIME = lin(0.33, 0.305, 0.265);
const SLATE = lin(0.052, 0.058, 0.07);
const STONE = lin(0.125, 0.12, 0.112);
const WALL = lin(0.15, 0.14, 0.125);
const IRON = lin(0.05, 0.05, 0.055);
const PLAIN = 0;
const SLATED = 1;
const COURSED = 2;
const OVERHANG = 0.28;

/** A drowned house in the yard: its middle, along-x length, depth across, and how it stands in the water. */
interface Roof {
  x: number;
  z: number;
  len: number;
  depth: number;
  wall: number;
  rise: number;
  sink: number;
  /** Which ends carry a chimney, -1 west and 1 east. */
  stacks: number[];
}
const ridgeOf = (h: Roof) => h.wall + h.rise + 0.04 - h.sink;
const eaveOf = (h: Roof) => h.wall - 0.1 - h.sink;
/** The height of the slates `across` from the ridge, either way. */
const slates = (h: Roof, across: number) => THREE.MathUtils.lerp(ridgeOf(h), eaveOf(h), Math.min(1, Math.abs(across) / (h.depth / 2 + OVERHANG)));

/**
 * The yard, in its own frame, laid out at the drowned village's own scale: x east, z south, the water at 0. The
 * ridge she waits on (her end of it at the origin), the lane, the wall along its far side with the dead tree behind
 * it; the wall up to the cottage, over its ridge and down to the corner of its north eave, the swing beside its
 * gable, and the nave's slope across the green.
 */
const STRAND: Roof = { x: -3.6, z: 0, len: 8, depth: 4.6, wall: 3.4, rise: 2.5, sink: 3.45, stacks: [-1] };
const GARDEN: Roof = { x: 6.8, z: -19.73, len: 10, depth: 6, wall: 3.4, rise: 2.5, sink: 2.95, stacks: [1] };
const NAVE: Roof = { x: 7.8, z: -32.69, len: 17, depth: 7.6, wall: 3.2, rise: 3.2, sink: 3.6, stacks: [] };
const COPING = 0.45;
const LANE = -6.7;
const END = new THREE.Vector3(0, ridgeOf(STRAND), 0);
/** Where the trunk comes down over the lane wall, square across it, and the corner where the wall turns for the cottage. */
const OVER = new THREE.Vector3(0.75, COPING, LANE);
const CORNER = new THREE.Vector3(3.5, COPING, LANE);
const ROOT_DEPTH = -2.6;
const ROOT = (() => {
  const d = new THREE.Vector2(OVER.x - END.x, OVER.z - END.z).normalize();
  return new THREE.Vector3(OVER.x + d.x * 1.5, ROOT_DEPTH, OVER.z + d.y * 1.5);
})();
const GARDEN_SOUTH = GARDEN.z + GARDEN.depth / 2 + OVERHANG;
const GARDEN_NORTH = GARDEN.z - GARDEN.depth / 2 - OVERHANG;
const DOWN_AT = GARDEN.x + GARDEN.len / 2 - 0.6;
const BOARD = new THREE.Vector3(DOWN_AT + 0.52, eaveOf(GARDEN), GARDEN_NORTH + 0.12);
/** Beside the cottage's east gable, so the back of each swing goes past its end rather than into its wall. */
const SWING_X = GARDEN.x + GARDEN.len / 2 + 1.05;
const PIVOT = new THREE.Vector3(SWING_X, 7.3, GARDEN_NORTH - 0.34);
const ROPE = 7;
const LANDING_Z = GARDEN_NORTH - 6.8;
const LANDING = new THREE.Vector3(SWING_X, slates(NAVE, LANDING_Z - NAVE.z), LANDING_Z);
const OLD_TREE = new THREE.Vector3(GARDEN.x + 0.7, -3.2, -27.6);

const WAY = {
  strand: { x0: -6, z0: 0, x1: END.x, z1: END.z, halfWidth: 0.45, height: END.y },
  lane: { x0: -1.2, z0: LANE, x1: CORNER.x, z1: LANE, halfWidth: 0.28, height: COPING },
  wall: { x0: CORNER.x, z0: LANE, x1: CORNER.x, z1: GARDEN_SOUTH, halfWidth: 0.28, height: COPING },
  gardenSlope: { x0: CORNER.x, z0: GARDEN_SOUTH, x1: CORNER.x, z1: GARDEN.z, halfWidth: 0.7, height: eaveOf(GARDEN), height1: ridgeOf(GARDEN) },
  gardenRidge: { x0: CORNER.x, z0: GARDEN.z, x1: DOWN_AT, z1: GARDEN.z, halfWidth: 0.45, height: ridgeOf(GARDEN) },
  gardenNorth: { x0: DOWN_AT, z0: GARDEN.z, x1: DOWN_AT, z1: GARDEN_NORTH + 0.05, halfWidth: 0.75, height: ridgeOf(GARDEN), height1: eaveOf(GARDEN) },
  eave: { x0: DOWN_AT - 0.4, z0: GARDEN_NORTH + 0.12, x1: BOARD.x + 0.1, z1: GARDEN_NORTH + 0.12, halfWidth: 0.2, height: eaveOf(GARDEN) },
  naveSlope: { x0: SWING_X, z0: LANDING_Z + 0.4, x1: SWING_X, z1: NAVE.z, halfWidth: 1.1, height: slates(NAVE, LANDING_Z + 0.4 - NAVE.z), height1: ridgeOf(NAVE) },
  naveRidge: { x0: SWING_X - 3, z0: NAVE.z, x1: SWING_X + 2.5, z1: NAVE.z, halfWidth: 0.45, height: ridgeOf(NAVE) },
} satisfies Record<string, Deck>;

type View = 'tree' | 'swing' | 'walk';

/**
 * QA only: the drowned village's two crossings set out on the sea off the QA stage, playable on their own
 * (`?chapter=stage`, then `play('crossing:tree')`, `play('crossing:swing')` or `play('crossing:run')` for both in a
 * row, or `&gap=tree|swing|run` in the address). Low dusk light, the air dead, the lens low and beside her.
 */
export class CrossingsYard {
  readonly group = new THREE.Group();
  readonly tree: TreeCrossing;
  readonly swing: SwingCrossing;
  readonly decks: Deck[] = Object.values(WAY).map((d) => ({ ...d }));
  /** What is being played: one crossing, both in a row, or nothing (the stage has the camera back). */
  playing: 'tree' | 'swing' | 'run' | null = null;
  private stage: 'tree' | 'walk' | 'swing' | 'done' = 'done';
  private view: View = 'tree';
  private readonly origin = new THREE.Vector3();
  private readonly tmp = new THREE.Vector3();
  private readonly eye = new THREE.Vector3();
  private readonly target = new THREE.Vector3();
  private readonly walk: THREE.Vector3[];

  constructor(private readonly cast: Cast, near: THREE.Vector3) {
    this.origin.copy(this.findWater(near));
    this.group.position.copy(this.origin);
    const at = (p: THREE.Vector3) => p.clone().add(this.origin);
    for (const d of this.decks) {
      d.x0 += this.origin.x; d.x1 += this.origin.x;
      d.z0 += this.origin.z; d.z1 += this.origin.z;
    }
    const crossingCast = { child: cast.child, wind: cast.wind, lines: cast.lines, input: cast.input };
    this.tree = new TreeCrossing({ root: at(ROOT), rest: at(END), over: at(OVER) }, {
      wait: at(new THREE.Vector3(-1.25, END.y, 0)),
      stepOff: at(new THREE.Vector3(OVER.x + 0.55, COPING, LANE)),
      onward: at(new THREE.Vector3(OVER.x + 1.9, COPING, LANE)),
    }, crossingCast);
    this.swing = new SwingCrossing({ pivot: at(PIVOT), toward: new THREE.Vector2(0, -1), rope: ROPE },
      { board: at(BOARD), landing: at(LANDING), onward: at(new THREE.Vector3(SWING_X + 0.4, 0, NAVE.z + 0.9)) }, crossingCast);
    this.walk = [
      new THREE.Vector3(CORNER.x, 0, LANE),
      new THREE.Vector3(CORNER.x, 0, GARDEN_SOUTH + 0.2),
      new THREE.Vector3(CORNER.x, 0, GARDEN.z + 0.1),
      new THREE.Vector3(DOWN_AT, 0, GARDEN.z),
      new THREE.Vector3(DOWN_AT, 0, GARDEN_NORTH + 0.35),
      new THREE.Vector3(BOARD.x, 0, BOARD.z),
    ].map(at);

    const scenery = this.build();
    scenery.layers.enable(REFLECTION_LAYER);
    this.group.add(scenery);
    const old = this.oldTree();
    old.layers.enable(REFLECTION_LAYER);
    this.group.add(old);
  }

  get objects(): THREE.Object3D[] {
    return [this.group, ...this.tree.tree.objects, ...this.swing.swing.objects];
  }

  /** The drawn gust while she waits at a gap, and the screen angle it is drawn at. */
  get invitation(): THREE.Vector3 | null {
    if (this.stage === 'tree') return this.tree.invitation;
    if (this.stage === 'swing') return this.swing.invitation;
    return null;
  }

  /** How wide what the drawn gust goes across is: the whole tree, or just the swing. */
  get invitationRadius(): number {
    return this.stage === 'tree' ? 2.2 : 1.2;
  }

  get heading(): number | null {
    if (this.stage === 'tree') return this.tree.heading;
    if (this.stage === 'swing') return this.swing.heading;
    return null;
  }

  /** For the capture tools: where everything has got to. */
  get state(): Record<string, unknown> {
    const t = this.tree.tree, s = this.swing.swing, c = this.cast.child;
    return {
      playing: this.playing, stage: this.stage,
      tree: { phase: this.tree.phase, state: t.state, lean: +t.lean.toFixed(3), loose: +t.loose.toFixed(3), progress: +t.progress.toFixed(3), valving: this.tree.valving },
      swing: { phase: this.swing.phase, angle: +s.angle.toFixed(3), best: +s.best.toFixed(3), peak: +s.peak.toFixed(3), valving: this.swing.valving },
      child: c.position.toArray().map((v) => +v.toFixed(2)),
      invitation: this.invitation !== null,
    };
  }

  play(name: string): boolean {
    const c = this.cast.child;
    if (!['tree', 'swing', 'run'].includes(name)) return false;
    this.playing = name as 'tree' | 'swing' | 'run';
    this.tree.reset();
    this.swing.reset();
    this.decks.length = Object.keys(WAY).length;
    c.decks = this.decks;
    c.dismount();
    c.stop();
    c.balance = 0;
    c.stroll = 1;
    c.lookAt = null;
    c.standUp();
    const k = this.cast.cygnet;
    k.visible = true;
    k.rideIn('satchel');
    this.cast.cat.visible = false;
    if (name === 'swing') {
      c.place(this.swing.way.board.x, this.swing.way.board.z, Math.atan2(1, 0) - 0.4);
      c.stowPlane(true, true);
      this.stage = 'swing';
      this.view = 'swing';
      this.swing.begin();
    } else {
      const wait = this.tree.way.wait;
      c.place(wait.x, wait.z, Math.atan2(this.tree.tree.spot.root.x - wait.x, this.tree.tree.spot.root.z - wait.z));
      c.stowPlane(false, true);
      this.stage = 'tree';
      this.view = 'tree';
      this.tree.begin();
    }
    return true;
  }

  stop(): void {
    this.playing = null;
    this.stage = 'done';
    this.cast.child.decks = [];
  }

  update(dt: number, camera: THREE.PerspectiveCamera | null): void {
    if (!camera || !this.playing) return;
    this.tree.update(dt, camera);
    this.swing.update(dt, camera);
    const c = this.cast.child;
    if (this.stage === 'tree' && this.tree.done) {
      if (this.playing === 'run') {
        this.stage = 'walk';
        this.view = 'walk';
        this.walkOn(0);
      } else this.stage = 'done';
    } else if (this.stage === 'swing' && this.swing.done) this.stage = 'done';
    if (this.stage === 'swing' && this.swing.phase === 'boarding') this.view = 'swing';
    c.stowPlane(this.stage === 'swing' || this.swing.phase === 'landed', false);
  }

  private walkOn(i: number): void {
    const c = this.cast.child;
    if (i >= this.walk.length) {
      this.stage = 'swing';
      this.view = 'swing';
      this.swing.begin();
      return;
    }
    const p = this.walk[i];
    c.walkTo(p.x, p.z, false, () => this.walkOn(i + 1), i === this.walk.length - 1 ? 0.12 : 0.35);
  }

  /**
   * Low and beside her, at roof height, looking across the gap into the low sun so whatever moves is rimmed in it;
   * on an upright screen it looks along her way so the gap stacks up the frame.
   */
  frame(shot: Shot): number {
    const c = this.cast.child.position;
    const upright = window.innerWidth / window.innerHeight < 0.9;
    const o = this.origin;
    shot.free = false;
    shot.from = undefined;
    shot.fitWidth = false;
    shot.subjects = undefined;
    const deck = this.tree.tree.deck;
    if (this.view === 'tree' && (this.tree.phase === 'crossing' || this.tree.phase === 'over') && !upright) {
      /** Ahead of her on the far side, a little off the trunk's line, so she comes toward us with her arms out wide. */
      const len = Math.hypot(deck.x1 - deck.x0, deck.z1 - deck.z0);
      const ux = (deck.x1 - deck.x0) / len, uz = (deck.z1 - deck.z0) / len;
      this.eye.set(deck.x1 + ux * 7 - uz * 7, (deck.height1 ?? deck.height) + 2.4, deck.z1 + uz * 7 + ux * 7);
      this.target.set(c.x * 0.6 + deck.x1 * 0.4, c.y + 0.6, c.z * 0.6 + deck.z1 * 0.4);
    } else if (this.view === 'tree') {
      const root = this.tree.tree.spot.root;
      const on = this.tree.phase === 'crossing' || this.tree.phase === 'over' ? 0.55 : 0;
      const z = THREE.MathUtils.lerp((c.z + root.z) / 2, c.z, on);
      if (upright) {
        /** Behind her on the line to the tree and above, so the tree stands over her and comes down toward us. */
        const away = this.tmp.set(c.x - root.x, 0, c.z - root.z).normalize();
        this.eye.set(c.x + away.x * 12 + away.z * 5, 7.4 - 2 * on, c.z + away.z * 12 - away.x * 5);
        this.target.set(c.x - away.x * 4.2, 2.2, c.z - away.z * 4.2);
      } else {
        this.eye.set(o.x + 16.5 - 3 * on, o.y + 2.6, z - 0.4);
        this.target.set((c.x + root.x) / 2, 2.6, z + 0.4);
      }
    } else if (this.view === 'swing') {
      const pivot = this.swing.swing.pivot;
      if (upright) {
        /** Behind her and a little above, so each swing goes away up the frame toward the slope she will land on. */
        this.eye.set(pivot.x + 10, 5.6, pivot.z + 11);
        this.target.set(pivot.x - 0.6, 2.6, pivot.z - 4);
      } else {
        this.eye.set(pivot.x + 18, 3.1, pivot.z - 3);
        this.target.set(pivot.x, 3.2, pivot.z - 2.7);
      }
    } else {
      const ahead = this.tmp.set(c.x, 0, c.z);
      if (upright) {
        this.eye.set(ahead.x + 3, c.y + 3.4, ahead.z + 9);
        this.target.set(ahead.x, c.y + 1.2, ahead.z - 3.5);
      } else {
        this.eye.set(ahead.x + 13, Math.max(2.6, c.y + 1.6), ahead.z + 1.5);
        this.target.set(ahead.x, c.y + 1.0, ahead.z - 1.5);
      }
    }
    shot.eye = (shot.eye ?? new THREE.Vector3()).copy(this.eye);
    shot.target.copy(this.target);
    shot.distance = this.eye.distanceTo(this.target);
    shot.height = this.eye.y - this.target.y;
    return 0.7;
  }

  /** Out from `near` until the whole yard is over open water. */
  private findWater(near: THREE.Vector3): THREE.Vector3 {
    const wet = (x: number, z: number) => {
      for (let dx = -10; dx <= 22; dx += 2) {
        for (let dz = -38; dz <= 6; dz += 2) if (heightAt(x + dx, z + dz) > -2.5) return false;
      }
      return true;
    };
    for (let reach = 40; reach < 600; reach += 4) {
      for (const [x, z] of [[near.x - 40, near.z + reach], [near.x + 50, near.z + reach]]) if (wet(x, z)) return new THREE.Vector3(x, 0, z);
    }
    return new THREE.Vector3(near.x - 40, 0, near.z + 120);
  }

  private build(): THREE.Mesh {
    const parts: THREE.BufferGeometry[] = [];
    const add = (geo: THREE.BufferGeometry, colour: THREE.Color, kind: number, m?: THREE.Matrix4) => {
      const g = geo.index ? geo.toNonIndexed() : geo;
      if (g.attributes.uv) g.deleteAttribute('uv');
      if (!g.attributes.normal) g.computeVertexNormals();
      const count = g.attributes.position.count;
      g.setAttribute('aLocal', new THREE.BufferAttribute(Float32Array.from(g.attributes.position.array), 3));
      const col = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) col.set([colour.r, colour.g, colour.b], i * 3);
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      g.setAttribute('aKind', new THREE.BufferAttribute(new Float32Array(count).fill(kind), 1));
      if (m) g.applyMatrix4(m);
      parts.push(g);
    };
    for (const h of [STRAND, GARDEN, NAVE]) this.house(h, add);
    const wall = (x0: number, z0: number, x1: number, z1: number, top: number, railed = false) => {
      const len = Math.hypot(x1 - x0, z1 - z0);
      const m = new THREE.Matrix4().makeTranslation((x0 + x1) / 2, 0, (z0 + z1) / 2).multiply(new THREE.Matrix4().makeRotationY(Math.atan2(-(z1 - z0), x1 - x0)));
      add(new THREE.BoxGeometry(len, top + 3.9, 0.42).translate(0, (top - 4.1) / 2, 0), WALL, COURSED, m);
      add(new THREE.BoxGeometry(len + 0.12, 0.14, 0.56).translate(0, top - 0.07, 0), STONE, PLAIN, m);
      if (!railed) return;
      const bars = Math.round(len / 0.26);
      for (let i = 0; i <= bars; i++) add(new THREE.BoxGeometry(0.035, 0.92, 0.035).translate(-len / 2 + (i * len) / bars, top + 0.46, 0), IRON, PLAIN, m);
      add(new THREE.BoxGeometry(len, 0.045, 0.05).translate(0, top + 0.86, 0), IRON, PLAIN, m);
    };
    wall(-1.4, LANE, CORNER.x, LANE, COPING);
    wall(CORNER.x, LANE, CORNER.x, GARDEN_SOUTH, COPING);
    wall(CORNER.x, LANE, 7.5, LANE - 0.4, 0.3);
    wall(-3.5, -24.5, GARDEN.x - 1.2, GARDEN_NORTH - 1.4, 0.25, true);
    const mesh = new THREE.Mesh(mergeGeometries(parts),
      new THREE.ShaderMaterial({ vertexShader: ROOF_VERT, fragmentShader: ROOF_FRAG, uniforms: { ...atmo.uniforms }, side: THREE.DoubleSide }));
    mesh.frustumCulled = false;
    return mesh;
  }

  /** Walls up from the bed to the eaves, slates to the ridge with a cap along it, and its chimneys. */
  private house(h: Roof, add: (g: THREE.BufferGeometry, c: THREE.Color, kind: number, m?: THREE.Matrix4) => void): void {
    const m = new THREE.Matrix4().makeTranslation(h.x, -h.sink, h.z);
    const half = h.depth / 2;
    const body = new THREE.Shape([new THREE.Vector2(-half, -2.6), new THREE.Vector2(half, -2.6), new THREE.Vector2(half, h.wall),
      new THREE.Vector2(0, h.wall + h.rise - 0.35), new THREE.Vector2(-half, h.wall)]);
    const along = (shape: THREE.Shape, len: number) =>
      new THREE.ExtrudeGeometry(shape, { depth: len, bevelEnabled: false }).rotateY(Math.PI / 2).translate(-len / 2, 0, 0);
    add(along(body, h.len), LIME, PLAIN, m);
    const o = half + OVERHANG, eave = h.wall - 0.1, apex = h.wall + h.rise, t = 0.2;
    const slate = new THREE.Shape([new THREE.Vector2(-o, eave), new THREE.Vector2(0, apex), new THREE.Vector2(o, eave),
      new THREE.Vector2(o - 0.14, eave - t), new THREE.Vector2(0, apex - t * 1.4), new THREE.Vector2(-o + 0.14, eave - t)]);
    add(along(slate, h.len + 0.22), SLATE, SLATED, m);
    add(new THREE.BoxGeometry(h.len + 0.4, 0.16, 0.36).translate(0, apex - 0.04, 0), SLATE, SLATED, m);
    for (const side of h.stacks) {
      const cx = side * (h.len / 2 - 0.75), top = apex + 1.2, shaft = top - (h.wall - 0.6);
      add(new THREE.BoxGeometry(0.82, shaft, 0.78).translate(cx, h.wall - 0.6 + shaft / 2, 0), STONE, COURSED, m);
      add(new THREE.BoxGeometry(1.04, 0.18, 1.0).translate(cx, top + 0.09, 0), STONE, PLAIN, m);
      add(new THREE.CylinderGeometry(0.13, 0.15, 0.4, 6).translate(cx, top + 0.38, 0), lin(0.135, 0.072, 0.042), PLAIN, m);
    }
  }

  /** The old tree on the green: a trunk standing in the flood to its fork, and the long bough the swing hangs from. */
  private oldTree(): THREE.Mesh {
    const base = OLD_TREE.clone();
    const fork = new THREE.Vector3(base.x + 0.2, 4.4, base.z - 0.1);
    const knot = PIVOT.clone().setY(PIVOT.y + 0.16);
    const parts = [
      tube([base, base.clone().lerp(fork, 0.5).add(new THREE.Vector3(0.15, 0, 0.05)), fork], 0.85, 0.55, 12, BARK, 0, 0, 0.3, 0.2),
      tube([fork.clone().setY(fork.y - 0.4), fork.clone().lerp(knot, 0.5).add(new THREE.Vector3(0, 1.1, 0)), knot,
        knot.clone().add(new THREE.Vector3(1.6, 0.5, 0.7))], 0.42, 0.1, 9, BARK, 0, 0.4, 0.7),
    ];
    const rand = (i: number) => (Math.sin(i * 12.9898 + 4.1) * 43758.5453) % 1;
    for (let i = 0; i < 6; i++) {
      const a = Math.PI * 0.9 + (i / 6) * Math.PI * 1.4 + 0.2 * Math.abs(rand(i));
      const out = 2.8 + 1.6 * Math.abs(rand(i + 7));
      const end = new THREE.Vector3(fork.x + Math.cos(a) * out, fork.y + 2.5 + 1.8 * Math.abs(rand(i + 3)), fork.z + Math.sin(a) * out);
      parts.push(tube([fork.clone().setY(fork.y - 0.2), fork.clone().lerp(end, 0.5).add(new THREE.Vector3(0, 0.8, 0)), end], 0.36, 0.12, 8, BARK, 0, 0.3, i * 0.37));
      for (let j = 0; j < 3; j++) {
        const b = a + (j - 1) * 0.9;
        const tip = end.clone().add(new THREE.Vector3(Math.cos(b) * 1.8, 1.2 + 0.4 * j, Math.sin(b) * 1.8));
        parts.push(tube([end, end.clone().lerp(tip, 0.5).add(new THREE.Vector3(0, 0.3, 0)), tip], 0.12, 0.03, 5, BARK, 0.3, 1, i + j * 0.3));
      }
    }
    const material = barkMaterial(12, 0);
    const mesh = new THREE.Mesh(merged(parts), material);
    mesh.frustumCulled = false;
    return mesh;
  }
}
