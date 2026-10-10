import * as THREE from 'three';
import { BOW_Z, STERN_Z, gunwaleHalf, stationU } from '../../traveller/boat/form';
import { tuning } from '../../tuning';
import { swellLift } from '../../world/water/swell';
import { BLOWHOLE, LENGTH, SPINE_END, TOP } from './anatomy';
import { SPINE_N } from './whaleShader';
import { NET, corkMaterial, netLook, ropeMaterial, sheetMaterial } from './netShader';
import type { SleepingWhale, Skin } from './sleeper';
import { MIST, type Spray } from './spray';
import { WindGesture } from '../wind-gesture';

const K = tuning.netWhale;

export type NetSound = 'net-sputter' | 'net-lift' | 'whale-call' | 'whale-glad' | 'cork-knock' | 'rope-pull' | 'net-slither' | 'loop-slip'
  | 'swimmer-out' | 'fold-lift' | 'net-heave';

/** Where the net's front edge lies along the whale (0 snout .. 1 flukes). */
const FRONT = 0.05;
const ROWS = 46;
const COLS = 28;
const NORMAL_NEIGHBOURS = new Uint16Array(ROWS * COLS * 4);
for (let i = 0; i < ROWS; i++) {
  for (let j = 0; j < COLS; j++) {
    const k = (i * COLS + j) * 4;
    NORMAL_NEIGHBOURS[k] = (Math.min(ROWS - 1, i + 1) * COLS + j) * 3;
    NORMAL_NEIGHBOURS[k + 1] = (Math.max(0, i - 1) * COLS + j) * 3;
    NORMAL_NEIGHBOURS[k + 2] = (i * COLS + Math.min(COLS - 1, j + 1)) * 3;
    NORMAL_NEIGHBOURS[k + 3] = (i * COLS + Math.max(0, j - 1)) * 3;
  }
}
/** Rows draped a frame while it lies far off, so laying it on costs no frame much. */
const ROWS_A_FRAME = 1;
/** How far out either side the skin is looked for across a row, and how finely (m). */
const REACH = 17;
const STEP = 0.6;
/** Points kept on each row's near side, from the net's edge down to the water: the lines run down them. */
const BELOW = 5;
/** The near edge hangs this far out onto the water past the waterline (m), and stays this far above the eye's middle round it. */
const AFLOAT_OUT = 1;
const EYE_CLEAR = 2.5;
/** Along the whale the edge keeps clear of the eye this far either side of it, and is back down at the water by `EYE_OPEN` (m). */
const EYE_HELD = 2;
const EYE_OPEN = 6.5;
/** Back along the whale from this far behind the eye the near edge climbs, to this far across from the crown line at its end (m). */
const BACK_FROM = 7;
const BACK_EDGE = 6.5;
/** Each point of the sheet comes to rest on whatever is under it or on its neighbours, less this sag, so it bridges hollows (m). */
const BRIDGE_SAG = 0.025;
const BRIDGE_PASSES = 80;
const FOLDS = 7;
/** The patch over the blowhole the updraft lifts, and the smaller dome each weak breath raises: half length and width (m). */
const PATCH = new THREE.Vector2(5, 3.5);
const DOME = new THREE.Vector2(1.6, 1.1);
/**
 * Peeled, each row slides off into the water and folds back and forth `FOLD_WIDE` metres out from the waterline,
 * the near edge furthest out. Hauled by the leader, the sheet doubles over at the leader's row: both halves trail
 * from that corner toward the snout, gathered to `GATHER` of their length, so the corner she hauled lies nearest
 * the boat and the rest floats beside the head, clear of the flipper.
 */
const FOLD_WIDE = 6;
const FOLD_FROM = 1;
const GATHER = 0.45;
/** The half of the sheet in front of the leader's row lies over the half behind it. */
const OVER = 0.07;
/** However it folds, it keeps this far from the boat at rest (m). */
const BOAT_CLEAR = 4.5;
/**
 * Peeling, each row of the sheet slides along its own drape toward the near side like a cloth pulled off a table, so
 * none of it stretches on the skin; the leader's row goes first and the rows furthest along it start `STAGGER` of the
 * peel later. Off the skin, a point is drawn across the water to its place in the floating mass over the cloth still
 * behind it plus `WATER_MIN` metres of slide, so the near edge comes all the way while the haul lasts.
 */
const STAGGER = 0.5;
const WATER_MIN = 3;
/** Points along each row's drape: the sheet across, then the line from its near edge down to the water. */
const PATH = COLS + BELOW - 1;
/** How far down the raft sinks before it is gone (m). */
const SINK_DEPTH = 4;
/**
 * Drifting off, the folded mass works loose into a raft this share of the sheet's length and breadth, its edge corks
 * round it, between these shares of the drift.
 */
const OPEN = new THREE.Vector2(0.42, 0.34);
const OPEN_FROM = 0.06;
const OPEN_TO = 0.4;
const LEADER = 17;
const LINK = 1.2;
/** The leader leaves the near edge at the cheek, this far in front of the eye; the loop's line this far behind it (m). */
const LEADER_BEFORE_EYE = 3.6;
const LOOP_BEHIND_EYE = 4.5;
/** Where the leader's near cork floats at first: this far out to port of the boat and this far ahead of its middle (m). */
const CORK_OUT = 3.4;
const CORK_AHEAD = 0.6;
/** How close to the planking a cork floats, and how hard it must knock to be heard (m/s). */
const CORK_CLEAR = NET.float + 0.03;
const KNOCK_FROM = 0.25;
/** A shove to the cork carries this much of itself along the last links of the line behind it. */
const DRAGGED = [1, 0.8, 0.6, 0.4, 0.2];
/** The line hauled in lies in a small coil on the boards this wide, and pays back out over the rail this fast (m/s). */
const COIL = 0.16;
const PAY_OUT = 1.6;
const LOOP_END = 2;
const END_POINTS = 10;
/** Where along the near flipper the loop sits, and how far past its tip it has gone once it is off (0 root .. 1 tip). */
const LOOP_FROM = 0.86;
const LOOP_PAST = 1.04;
const RING = 40;
const KNOT = 16;
const WEEDS = 40;
const WEED_POINTS = 6;
/**
 * The fold over its eye: a doubled flap of the net hanging from the near edge above the eye, `FOLD_HALF` metres
 * either side of it along the whale, down across the eye to `FOLD_BELOW` metres below its middle along the skin,
 * standing off the skin, and further where it bridges the eye; the second layer lies on the first. Weed hangs off
 * its lower part.
 */
const FOLD_ROWS = 11;
const FOLD_COLS = 9;
const FOLD_HALF = 3.4;
const FOLD_BELOW = 1.9;
const FOLD_STAND = 0.1;
const FOLD_BRIDGE = 0.4;
const FOLD_LAYER = 0.07;
const FOLD_WEEDS = 22;
/**
 * Billowing, the mesh over the head bellies up and out toward the boat, along the head as far as `BILLOW_PAST_EYE`
 * past the eye (m), across from `BILLOW_FAR` beyond the crown line on the far side, highest `BILLOW_CREST` of the way
 * down the near flank and still `BILLOW_EDGE` as high at the near edge, held there by the line she hauls.
 */
const BILLOW_PAST_EYE = 10;
const BILLOW_FAR = 2.5;
const BILLOW_CREST = 0.35;
const BILLOW_EDGE = 0.4;

const bump = (x: number) => (Math.abs(x) >= 1 ? 0 : 0.5 + 0.5 * Math.cos(Math.PI * x));

/** The leader's near cork, out on the water toward the boat. */
export interface NetFloat {
  /** Where it floats, riding the swell, and how fast it is moving across the water (m/s, y unused). */
  readonly position: THREE.Vector3;
  readonly velocity: THREE.Vector3;
  /** A shove across the water, in metres a second added to its velocity (y is ignored). */
  push(impulse: THREE.Vector3): void;
}

/** The boat the leader floats beside: its corks knock on its planking and never pass through it. */
export interface NetHull {
  readonly position: THREE.Vector3;
  readonly yaw: number;
}

/**
 * The leader in somebody's mittens: the line comes up out of the water into the outer mitten, through the inner one,
 * and down into a coil on the boards. `out` is how much of it is still out beyond the outer mitten (m); she hauls by
 * shortening it. Let go (`by` null), the net's weight draws the hauled line back out over the rail.
 */
export interface NetGrip {
  by: { mitten(hand: 0 | 1, out: THREE.Vector3): THREE.Vector3 } | null;
  readonly coil: THREE.Vector3;
  out: number;
}

interface Polyline {
  start: number;
  count: number;
  neighbours: Uint32Array;
}

/**
 * The old drifting net over the whale's head, blowhole and forward back: one faded brown-green sheet laid on its skin
 * by `surfaceAt` and kept there by its anchors as it breathes, with rows of corks along its edges and across the
 * blowhole, a few strands of weed, a float-line leader out toward the boat and one last loop round the near flipper.
 * A separate blue-green net covers the blowhole, domes with its breath and lifts independently.
 */
export class Net {
  readonly objects: THREE.Object3D[];
  /** The whale's own drawn gestures, laid over whatever its steps ask the wind to touch. */
  readonly gesture = new WindGesture('whale-invitation');
  private readonly parts: THREE.Object3D[];
  /** The blue-green net lifted clear of the crown, 0..1. */
  lift = 0;
  /** The separate upper net carried clear to the far side, 0..1. */
  slump = 0;
  /** Peeled back off the jaw and head into a floating mass beside it, 0..1. */
  peel = 0;
  /** The last loop slid along the near flipper and off its tip, 0..1. */
  loop = 0;
  /** The empty net drifted away on the water, worked loose into a raft, 0..1. */
  drift = 0;
  /** The raft sunk away into the deep and gone, 0..1. */
  sink = 0;
  /** How strongly the wind lifts under the patch right now, 0..1: it flutters in it like a sheet. */
  updraft = 0;
  /** The fold over its eye: lying across it at 0, lifted part way, flipped up and over onto the brow at 1. */
  flap = 0;
  /** The mesh over its head billowing up off it in the wind, 0..1. */
  billow = 0;
  /** The middle of the fold's lower edge, of the fold, and of the near edge it hangs from, in the world. */
  readonly foldTip = new THREE.Vector3();
  readonly foldMid = new THREE.Vector3();
  readonly foldTop = new THREE.Vector3();
  /** While true whatever drives the net leaves its four parts alone, so they can be posed by hand. */
  posed = false;
  /** Where the bill holds the loop's free end, or null while it lies on the water. */
  held: THREE.Vector3 | null = null;
  /** Whose bill holds it: read as the net is drawn, once the bird has moved this frame, so the end never lags it. */
  holder: { billTip(out: THREE.Vector3): THREE.Vector3 } | null = null;
  private readonly heldAt = new THREE.Vector3();
  /** Where the free end lies out on the water before anything takes it, or null for just beside the loop. */
  endRest: THREE.Vector3 | null = null;
  /** Where the loop falls as it slips off the flipper's tip into whatever pulls it; null, beside the floating net. */
  fallsTo: THREE.Vector3 | null = null;
  tension = 0;
  /** The loop's free end. */
  readonly loopEnd = new THREE.Vector3();
  readonly loopTie = new THREE.Vector3();
  /** Where the leader leaves the net for the water: what she hauls toward her. */
  readonly foot = new THREE.Vector3();
  readonly float: NetFloat;
  hull: NetHull | null = null;
  /** The leader as she holds it, or null while it floats free; `grip.out` grows back to the whole line once let go. */
  grip: NetGrip | null = null;
  onSound: ((kind: NetSound, at: THREE.Vector3, strength: number) => void) | null = null;

  private readonly sheet: THREE.Mesh;
  private readonly breathNet: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
  private readonly breathPos: THREE.BufferAttribute;
  private readonly breathNormals: THREE.BufferAttribute;
  private readonly breathAfloat: THREE.BufferAttribute;
  private readonly breathContact: THREE.BufferAttribute;
  private readonly breathBounds = { i0: 0, i1: 0, j0: 0, j1: 0 };
  private readonly breathRest = new Float32Array(ROWS * COLS * 3);
  private breathReleased = false;
  private breathSettled = false;
  private breathHeight = 0;
  private readonly fold: THREE.Mesh;
  private readonly ropes: THREE.Mesh;
  private readonly corks: THREE.Mesh;
  private readonly n = ROWS * COLS;
  /** Each point of the sheet as draped, with the body's breathing and roll taken out. */
  private readonly rest = new Float32Array(ROWS * COLS * 3);
  private readonly floor = new Float32Array(ROWS * COLS);
  /** How far each point stands off the skin at rest, bridging a hollow or along a fold (m). */
  private readonly stand = new Float32Array(ROWS * COLS);
  /** How far out from the crown line it lies, for the body's roll; on the skin, and afloat, 0..1. */
  private readonly across = new Float32Array(ROWS * COLS);
  private readonly onSkin = new Float32Array(ROWS * COLS);
  private readonly onWater = new Float32Array(ROWS * COLS);
  private readonly liftShape = new Float64Array(ROWS * COLS);
  private readonly domes = new Float32Array(ROWS * COLS);
  /** Each row's drape as a path from its far edge to the water on the near side, and how far along it each point is (m). */
  private readonly path = new Float32Array(ROWS * PATH * 3);
  private readonly pathAcross = new Float32Array(ROWS * PATH);
  private readonly pathWater = new Uint8Array(ROWS * PATH);
  private readonly pathArc = new Float32Array(ROWS * PATH);
  /** How far each row has slid along its drape this frame (m). */
  private readonly slid = new Float32Array(ROWS);
  /** Where each point lies in the folded mass, along and across it and how high in the fold. */
  private readonly folded = new Float32Array(ROWS * COLS * 3);
  /** Where each point floats once it is all peeled, before it drifts. */
  private readonly afloatAt = new Float32Array(ROWS * COLS * 2);
  private readonly openAt = new Float32Array(ROWS * COLS * 2);
  private readonly openY = new Float32Array(ROWS * COLS);
  private readonly crowns = new Float32Array(ROWS);
  private readonly below = new Float32Array(ROWS * BELOW * 3);
  private readonly belowAcross = new Float32Array(ROWS * BELOW);
  private readonly pos: THREE.BufferAttribute;
  private readonly normals: THREE.BufferAttribute;
  /** Each point's place on the net laid flat, along it and across it from the crown line (m). */
  private readonly uv: THREE.BufferAttribute;
  /**
   * How far across its row the near edge is, down to the water or held up clear of the eye beside it (m), how much it
   * hangs in scallops between its corks there (none where it climbs round the eye), and how steeply it climbs.
   */
  private readonly edge: THREE.BufferAttribute;
  private uEye = 0;
  private eyeTop = 0;
  private readonly afloat: THREE.BufferAttribute;
  private readonly contact: THREE.BufferAttribute;
  private readonly cork: THREE.InstancedBufferAttribute;
  private readonly corkSize: THREE.InstancedBufferAttribute;
  private readonly corkAt: { i: number; j: number; f: number; leader: number; patch: boolean }[] = [];
  private readonly corkNow: Float32Array;
  private readonly corkVel: Float32Array;
  private readonly line: { pos: THREE.BufferAttribute; along: THREE.BufferAttribute; width: THREE.BufferAttribute; afloat: THREE.BufferAttribute; weed: THREE.BufferAttribute };
  private readonly polylines: Polyline[] = [];
  private readonly linePoints: number;
  private readonly leaderLine: Polyline;
  private readonly loopLine: Polyline;
  private readonly weedLines: Polyline[] = [];
  private readonly weedAt: { v: number; length: number; turn: number }[] = [];
  /** The leader: its points down the skin, then its links across the water, the last of them the near cork. */
  private readonly links = Math.round(LEADER / LINK);
  private readonly chain: Float32Array;
  private readonly chainVel: Float32Array;
  private leaderRow = 0;
  private loopRow = 0;
  private draped = ROWS;
  private whaleLength = 110;
  private readonly side = new THREE.Vector3();
  private readonly ahead = new THREE.Vector3();
  private readonly boat = new THREE.Vector3();
  private readonly mass = new THREE.Vector3();
  /** The spine's heights and the eye's as the net was laid on, and how far along the body the eye is. */
  private readonly refSpine = new Float32Array(SPINE_N);
  private refEye = 0;
  private sEye = 0;
  private eyeAcross = 8;
  private domeT = 10;
  private domeStrength = 1;
  private soundLift = 0;
  private soundAt = 0;
  private soundNext = 0;
  private clock = 0;
  private snap = true;
  private boatYaw = 0;
  /** The leader's links still out on the water (the rest are in her mittens or on the boards), and where it comes aboard. */
  private free = 0;
  private readonly outer = new THREE.Vector3();
  private readonly inner = new THREE.Vector3();
  private aboard = false;
  private soundPeel = 0;
  private peelAt = 0;
  private knockNext = 0;
  private readonly skin: Skin = { height: 0, normal: new THREE.Vector3() };
  private readonly p = new THREE.Vector3();
  private readonly q = new THREE.Vector3();
  private readonly r = new THREE.Vector3();
  private readonly t = new THREE.Vector3();
  private readonly flat = new THREE.Vector3();
  private readonly point = new THREE.Vector3();
  private readonly curl = new THREE.Vector3();
  private readonly tail = new THREE.Vector3();
  private readonly fall = new THREE.Vector3();
  private readonly lie = new THREE.Vector3();
  private readonly hang = new THREE.Vector3();
  private readonly drop = new THREE.Vector3();
  /** Where the slipped loop and its dropped end lie, from the floating corner they drift away with. */
  private readonly curlFrom = new THREE.Vector3();
  private readonly endFrom = new THREE.Vector3();
  private endDropped = false;
  /** How far the free end has come up into the bill, eased. */
  private holding = 0;
  private readonly profile = { h: new Float32Array(64), y: new Float32Array(64), skin: new Uint8Array(64), n: 0 };
  /** The fold as it lies across the eye, with the body's breathing taken out, and how far across each point is. */
  private readonly foldRest = new Float32Array(FOLD_ROWS * FOLD_COLS * 3);
  private readonly foldAcross = new Float32Array(FOLD_ROWS * FOLD_COLS);
  /** Each of its rows: where along the net, how far down from its hinge it hangs, and which way it turns to flip off. */
  private readonly foldU = new Float32Array(FOLD_ROWS);
  private readonly foldLong = new Float32Array(FOLD_ROWS);
  private readonly foldTurn = new Float32Array(FOLD_ROWS);
  private readonly foldPos: THREE.BufferAttribute;
  private readonly foldNormals: THREE.BufferAttribute;
  private readonly foldContact: THREE.BufferAttribute;
  private readonly foldAfloat: THREE.BufferAttribute;
  /** How much each point of the sheet billows: on the head, a belly standing highest on the upper near flank. */
  private readonly billows = new Float32Array(ROWS * COLS);
  /** How far the sheet stands up off the head this moment, following `billow`: up with the gust, settling slower. */
  private billowed = 0;
  private readonly foldWeeds: Polyline[] = [];
  private readonly foldWeedAt: { fr: number; m: number; length: number; turn: number }[] = [];
  private readonly hinge = new THREE.Vector3();
  private readonly axis = new THREE.Vector3();

  constructor(private readonly whale: SleepingWhale, private readonly spray: Spray) {
    const geo = new THREE.BufferGeometry();
    this.pos = new THREE.BufferAttribute(new Float32Array(this.n * 3), 3).setUsage(THREE.DynamicDrawUsage);
    this.normals = new THREE.BufferAttribute(new Float32Array(this.n * 3), 3).setUsage(THREE.DynamicDrawUsage);
    this.afloat = new THREE.BufferAttribute(new Float32Array(this.n), 1).setUsage(THREE.DynamicDrawUsage);
    this.contact = new THREE.BufferAttribute(new Float32Array(this.n), 1).setUsage(THREE.DynamicDrawUsage);
    this.uv = new THREE.BufferAttribute(new Float32Array(this.n * 2), 2);
    this.edge = new THREE.BufferAttribute(new Float32Array(this.n * 3), 3);
    const index: number[] = [];
    for (let i = 0; i < ROWS; i++) {
      for (let j = 0; j < COLS - 1; j++) {
        const k = i * COLS + j;
        if (i < ROWS - 1) index.push(k, k + COLS, k + 1, k + 1, k + COLS, k + COLS + 1);
      }
    }
    geo.setAttribute('position', this.pos);
    geo.setAttribute('normal', this.normals);
    geo.setAttribute('uv', this.uv);
    geo.setAttribute('afloat', this.afloat);
    geo.setAttribute('contact', this.contact);
    geo.setAttribute('edge', this.edge);
    geo.setIndex(index);
    this.sheet = new THREE.Mesh(geo, sheetMaterial());
    this.sheet.renderOrder = 4;

    const breathGeo = new THREE.BufferGeometry();
    this.breathPos = this.pos.clone();
    this.breathNormals = this.normals.clone();
    this.breathAfloat = this.afloat.clone();
    this.breathContact = this.contact.clone();
    breathGeo.setAttribute('position', this.breathPos);
    breathGeo.setAttribute('normal', this.breathNormals);
    breathGeo.setAttribute('afloat', this.breathAfloat);
    breathGeo.setAttribute('contact', this.breathContact);
    breathGeo.setAttribute('uv', this.uv.clone());
    breathGeo.setAttribute('edge', this.edge.clone());
    breathGeo.setIndex([]);
    const upper = sheetMaterial();
    upper.uniforms.uStrand = { value: new THREE.Color('#399ec9') };
    upper.uniforms.uWeed = { value: new THREE.Color('#357e91') };
    upper.uniforms.uRope = { value: new THREE.Color('#7fc8e5') };
    upper.uniforms.uSunk = { value: 0 };
    upper.uniforms.uFade = { value: 1 };
    upper.uniforms.uCell.value = K.breathNetCell;
    this.breathNet = new THREE.Mesh(breathGeo, upper);
    this.breathNet.renderOrder = 5;

    const fn = FOLD_ROWS * FOLD_COLS * 2;
    const foldGeo = new THREE.BufferGeometry();
    this.foldPos = new THREE.BufferAttribute(new Float32Array(fn * 3), 3).setUsage(THREE.DynamicDrawUsage);
    this.foldNormals = new THREE.BufferAttribute(new Float32Array(fn * 3), 3).setUsage(THREE.DynamicDrawUsage);
    this.foldContact = new THREE.BufferAttribute(new Float32Array(fn), 1).setUsage(THREE.DynamicDrawUsage);
    const foldIndex: number[] = [];
    for (let l = 0; l < 2; l++) {
      for (let i = 0; i < FOLD_ROWS - 1; i++) {
        for (let j = 0; j < FOLD_COLS - 1; j++) {
          const k = l * FOLD_ROWS * FOLD_COLS + i * FOLD_COLS + j;
          foldIndex.push(k, k + FOLD_COLS, k + 1, k + 1, k + FOLD_COLS, k + FOLD_COLS + 1);
        }
      }
    }
    foldGeo.setAttribute('position', this.foldPos);
    foldGeo.setAttribute('normal', this.foldNormals);
    foldGeo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(fn * 2), 2));
    this.foldAfloat = new THREE.BufferAttribute(new Float32Array(fn), 1).setUsage(THREE.DynamicDrawUsage);
    foldGeo.setAttribute('afloat', this.foldAfloat);
    foldGeo.setAttribute('contact', this.foldContact);
    foldGeo.setAttribute('edge', new THREE.BufferAttribute(new Float32Array(fn * 3), 3));
    foldGeo.setIndex(foldIndex);
    // The same material as the sheet, so the fold is drawn by the program already compiled for it.
    this.fold = new THREE.Mesh(foldGeo, this.sheet.material);
    this.fold.renderOrder = 4;

    this.chain = new Float32Array((this.links + 1) * 3);
    this.chainVel = new Float32Array((this.links + 1) * 2);
    const float = this;
    const at = new THREE.Vector3();
    const vel = new THREE.Vector3();
    this.float = {
      position: at,
      velocity: vel,
      push(impulse: THREE.Vector3): void {
        // The line behind it comes with it, so it is not held back on a taut tether.
        for (let m = 0; m < DRAGGED.length; m++) {
          float.chainVel[(float.links - m) * 2] += impulse.x * DRAGGED[m];
          float.chainVel[(float.links - m) * 2 + 1] += impulse.z * DRAGGED[m];
        }
      },
    };

    this.placeCorks();
    const corkGeo = new THREE.InstancedBufferGeometry().copy(new THREE.IcosahedronGeometry(1, 2) as unknown as THREE.InstancedBufferGeometry);
    this.cork = new THREE.InstancedBufferAttribute(new Float32Array(this.corkAt.length * 4), 4).setUsage(THREE.DynamicDrawUsage);
    this.corkSize = new THREE.InstancedBufferAttribute(new Float32Array(this.corkAt.length), 1);
    corkGeo.setAttribute('iCork', this.cork);
    corkGeo.setAttribute('iSize', this.corkSize);
    corkGeo.instanceCount = this.corkAt.length;
    this.corkNow = new Float32Array(this.corkAt.length * 3);
    this.corkVel = new Float32Array(this.corkAt.length * 3);
    this.corks = new THREE.Mesh(corkGeo, corkMaterial());

    // Two more points than links: where the line comes up into each mitten.
    this.leaderLine = this.polyline(BELOW + this.links + 2);
    this.loopLine = this.polyline(BELOW + 1 + RING + KNOT + END_POINTS);
    for (let w = 0; w < FOLD_WEEDS; w++) {
      this.foldWeeds.push(this.polyline(WEED_POINTS));
      const seed = Math.sin(w * 57.1) * 0.5 + 0.5;
      this.foldWeedAt.push({ fr: 1 + ((w * 7) % (FOLD_ROWS - 2)), m: FOLD_COLS - 1 - (w % 4), length: 0.7 + seed * 0.9, turn: seed * 6.28 });
    }
    for (let w = 0; w < WEEDS; w++) {
      this.weedLines.push(this.polyline(WEED_POINTS));
      const seed = Math.sin(w * 91.7) * 0.5 + 0.5;
      const across = (Math.sin(w * 37.3) * 0.5 + 0.5) ** 1.6;
      const row = Math.floor(((w * 0.6180339 + 0.13) % 1) * ROWS);
      this.weedAt.push({ v: row * COLS + COLS - 1 - Math.floor(across * COLS * 0.8), length: 1 + seed * 2.2, turn: seed * 6.28 });
    }
    this.linePoints = this.polylines.reduce((n, l) => n + l.count, 0);
    const lineGeo = new THREE.BufferGeometry();
    const v = this.linePoints * 2;
    const attr = (size: number) => new THREE.BufferAttribute(new Float32Array(v * size), size).setUsage(THREE.DynamicDrawUsage);
    this.line = { pos: attr(3), along: attr(3), width: attr(1), afloat: attr(1), weed: attr(1) };
    const sides = new Float32Array(v);
    for (let i = 0; i < v; i++) sides[i] = i % 2 ? 1 : -1;
    const lineIndex: number[] = [];
    for (const l of this.polylines) {
      for (let i = 0; i < l.count - 1; i++) {
        const a = (l.start + i) * 2;
        lineIndex.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    lineGeo.setAttribute('position', this.line.pos);
    lineGeo.setAttribute('along', this.line.along);
    lineGeo.setAttribute('side', new THREE.BufferAttribute(sides, 1));
    lineGeo.setAttribute('width', this.line.width);
    lineGeo.setAttribute('afloat', this.line.afloat);
    lineGeo.setAttribute('weed', this.line.weed);
    lineGeo.setIndex(lineIndex);
    this.ropes = new THREE.Mesh(lineGeo, ropeMaterial());
    this.ropes.renderOrder = 5;
    const size = new THREE.Vector2();
    this.ropes.onBeforeRender = (renderer) => {
      renderer.getDrawingBufferSize(size);
      netLook.uRes.value.set(size.x / 2, size.y / 2);
    };
    this.parts = [this.sheet, this.breathNet, this.fold, this.ropes, this.corks];
    this.objects = [...this.parts, this.gesture.batch.mesh];
    for (const o of this.parts) {
      o.frustumCulled = false;
      o.visible = false;
    }
  }

  /** Laid on the whale, which has just been laid beside `boat` (resting facing `yaw`): row by row over the next frames, or at once. */
  drape(boat: THREE.Vector3, yaw: number, now = false): void {
    const whale = this.whale;
    this.boat.copy(boat);
    this.boatYaw = yaw;
    this.grip = null;
    this.whaleLength = LENGTH * whale.scale;
    this.ahead.copy(whale.heading).setY(0).normalize();
    whale.point(1, TOP(0.2), 0.2, this.side).sub(whale.point(0, TOP(0.2), 0.2, this.p)).setY(0).normalize();
    for (let k = 0; k < SPINE_N; k++) this.refSpine[k] = whale.spine[k].y;
    this.refEye = whale.eye.y;
    this.eyeAcross = Math.max(1, this.offAxis(whale.eye));
    const nose = whale.spine[0];
    const sEye = ((nose.x - whale.eye.x) * this.ahead.x + (nose.z - whale.eye.z) * this.ahead.z) / this.whaleLength;
    this.sEye = sEye;
    this.uEye = (sEye - FRONT) * this.whaleLength;
    const c = whale.point(0, TOP(sEye), sEye, this.q);
    this.profileFrom(c, 1, sEye);
    this.eyeTop = this.arcNearest(this.offAxis(whale.eye) - this.offAxis(c), whale.eye.y) - EYE_CLEAR;
    this.lift = this.slump = this.peel = this.loop = this.drift = this.sink = this.flap = this.billow = this.billowed = 0;
    this.peelAt = this.soundPeel = 0;
    this.domeT = 10;
    this.breathReleased = false;
    this.breathSettled = false;
    this.held = this.fallsTo = this.holder = null;
    this.curlFrom.set(0, 0, 0);
    this.endDropped = false;
    this.holding = 0;
    this.tension = 0;
    this.draped = 0;
    this.snap = true;
    netLook.uFade.value = 1;
    netLook.uSunk.value = 0;
    for (const o of this.parts) o.visible = false;
    if (now) this.finishDraping();
  }

  /** Whatever is still to drape, now. */
  finishDraping(): void {
    while (this.draped < ROWS) this.drapeRow(this.draped++);
    this.laidOn();
  }

  /** Taken off the world with the whale. */
  hide(): void {
    this.draped = ROWS;
    for (const o of this.parts) o.visible = false;
  }

  /** The leader's link `back` links in from its near cork, in the world. */
  link(back: number, out: THREE.Vector3): THREE.Vector3 {
    return out.fromArray(this.chain, Math.max(0, this.links - back) * 3);
  }

  /** The whole leader, from where it leaves the net to its near cork (m). */
  get lineLength(): number {
    return this.links * LINK;
  }

  /** How lost in the morning haze it is from far off, with the whale it lies on, 0..1. */
  set lost(amount: number) {
    netLook.uLost.value = amount;
  }

  get shown(): boolean {
    return this.sheet.visible;
  }

  /** A weak breath out under it, as strong as `strength`: the mesh domes over the blowhole, and sputters while it lies on it. */
  breathe(strength: number): void {
    if (!this.sheet.visible) return;
    this.domeT = 0;
    this.domeStrength = strength;
    if (this.lift > 0.6 || this.peel > 0.3) return;
    const b = this.whale.blowhole;
    for (let i = 0; i < 9; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 0.5 + Math.random() * 0.9;
      this.spray.emit(MIST, b.x + Math.cos(a) * r, b.y + 0.35, b.z + Math.sin(a) * r, Math.cos(a) * 0.5, 0.5 + Math.random() * 0.7,
        Math.sin(a) * 0.5, 0.18 + Math.random() * 0.12, 1.2 + Math.random(), 0.25, 0.06);
    }
    if (this.whale.breathAudible) this.onSound?.('net-sputter', b, strength);
  }

  /** A sound from the net, or from the whale under it. */
  sound(kind: NetSound, at: THREE.Vector3, strength = 1): void {
    this.onSound?.(kind, at, strength);
  }

  update(dt: number, time: number): void {
    this.clock += dt;
    if (this.holder) this.held = this.holder.billTip(this.heldAt);
    this.holding += ((this.held ? 1 : 0) - this.holding) * (1 - Math.exp(-dt * 4));
    if (this.draped < ROWS) {
      for (let r = 0; r < ROWS_A_FRAME && this.draped < ROWS; r++) this.drapeRow(this.draped++);
      if (this.draped === ROWS) this.laidOn();
      return;
    }
    if (!this.sheet.visible) return;
    if (this.sink >= 1) {
      for (const o of this.parts) o.visible = false;
      return;
    }
    this.domeT += dt;
    this.billowed = this.snap ? this.billow
      : this.billowed + (this.billow - this.billowed) * (1 - Math.exp(-dt * (this.billow > this.billowed ? K.billowRise : K.billowSettle)));
    // It settles first, its floats awash a while, and then goes down.
    netLook.uSunk.value = SINK_DEPTH * this.sink ** 2;
    netLook.uFade.value = 1 - THREE.MathUtils.smoothstep(this.sink, 0.8, 1);
    this.layOn(time);
    this.layBreathNet(time);
    this.layFold();
    this.sounds();
    this.moveLeader(dt, time);
    this.hangCorks(dt);
    this.drawLines();
    this.snap = false;
  }

  /** The skin's breathing and roll at `across` metres out from the crown line, since it was draped. */
  /**
   * How far the skin under a point `across` from the crown line at `s` has moved up since the net was laid on: the
   * back swells with a breath more than the head, and rolled, the near side rises.
   */
  private bodyShift(across: number, s: number): number {
    return this.spineShift(s) + (across / this.eyeAcross) * (this.whale.eye.y - this.refEye - this.spineShift(this.sEye));
  }

  private spineShift(s: number): number {
    const fi = THREE.MathUtils.clamp(s / SPINE_END, 0, 1) * (SPINE_N - 1);
    const k = Math.min(Math.floor(fi), SPINE_N - 2);
    const f = fi - k;
    const spine = this.whale.spine;
    return (spine[k].y - this.refSpine[k]) * (1 - f) + (spine[k + 1].y - this.refSpine[k + 1]) * f;
  }

  /** Where row `i` crosses the whale's length (0 snout .. 1 flukes). */
  private rowS(i: number): number {
    return FRONT + ((i / (ROWS - 1)) * NET.long) / this.whaleLength;
  }

  /** How far out from the whale's crown line `p` is, toward the boat. */
  private offAxis(p: THREE.Vector3): number {
    const nose = this.whale.spine[0];
    return (p.x - nose.x) * this.side.x + (p.z - nose.z) * this.side.z;
  }

  private acrossOf(k: number): number {
    return this.uv.getY(k);
  }

  /**
   * One row across the whale: the skin's profile there (down into the water where it goes under, or hanging straight
   * from the bulge where it curves back under), and each of the row's points laid along it at its own distance from
   * the crown line, so the mesh keeps its size over the curve. Its near edge lies out on the water past the
   * waterline, except beside the eye, where it is held up clear of it.
   */
  private drapeRow(i: number): void {
    const u = (i / (ROWS - 1)) * NET.long;
    const s = this.rowS(i);
    const c = this.whale.point(0, TOP(s), s, this.q);
    let crown = 0;
    for (const dir of [1, -1]) {
      crown = this.profileFrom(c, dir, s);
      if (dir === 1) {
        const water = this.profileWater();
        const held = 1 - THREE.MathUtils.smoothstep(Math.abs(u - this.uEye), EYE_HELD, EYE_OPEN);
        const out = Math.min(water + AFLOAT_OUT, THREE.MathUtils.lerp(water + AFLOAT_OUT, BACK_EDGE, THREE.MathUtils.smoothstep(u - this.uEye, BACK_FROM, NET.long - this.uEye)));
        const near = Math.min(NET.near, THREE.MathUtils.lerp(out, Math.min(out, this.eyeTop), held));
        for (let j = 0; j < COLS; j++) {
          const k = i * COLS + j;
          const a = -NET.far + (j / (COLS - 1)) * (near + NET.far);
          this.uv.setXY(k, u, a);
          this.edge.setXYZ(k, near, held < 0.01 || held > 0.99 ? 1 : 0, 0);
          const cloth = near - a;
          const layer = Math.floor(cloth / FOLD_WIDE);
          const into = cloth - layer * FOLD_WIDE;
          this.folded[k * 3 + 1] = FOLD_FROM + (layer % 2 ? into : FOLD_WIDE - into) + Math.sin(u * 0.9 + a) * 0.3;
        }
        const end = Math.max(near, water);
        for (let k = 0; k < BELOW; k++) {
          const arc = near + ((end - near) * k) / (BELOW - 1);
          this.alongProfile(arc, c, 1, -1);
          this.p.toArray(this.below, (i * BELOW + k) * 3);
          this.belowAcross[i * BELOW + k] = this.r.x;
        }
      }
      for (let j = 0; j < COLS; j++) {
        const a = this.acrossOf(i * COLS + j);
        if (Math.sign(a || 1) !== dir) continue;
        this.alongProfile(Math.abs(a), c, dir, i * COLS + j);
      }
    }
    this.crowns[i] = crown - this.bodyShift(0, s);
    this.layPath(i);
  }

  /** The skin's profile across the whale from its crown line at `c` (`s` along it) toward `dir`, into `this.profile`; the crown's height. */
  private profileFrom(c: THREE.Vector3, dir: number, s: number): number {
    const pr = this.profile;
    pr.n = 0;
    let lastY = this.skinAt(c, 0, s);
    const crown = lastY;
    this.addProfile(0, lastY, true);
    for (let h = STEP; h <= REACH; h += STEP) {
      const y = this.skinAt(c, h * dir, s);
      if (y === -Infinity || y < 0) {
        if (y === -Infinity && lastY > 0) this.addProfile(h - STEP + Math.min(0.3, lastY * 0.12), 0, false);
        else if (y < 0) this.addProfile(h - STEP * (y / (y - lastY)), 0, true);
        this.addProfile(REACH * 3, 0, false);
        break;
      }
      this.addProfile(h, y, true);
      lastY = y;
    }
    if (pr.h[pr.n - 1] < REACH * 3) this.addProfile(REACH * 3, Math.max(0, lastY), false);
    return crown;
  }

  /** How far along the profile from the crown line it comes nearest (`h` out, `y` up). */
  private arcNearest(h: number, y: number): number {
    const pr = this.profile;
    let arc = 0;
    let best = Infinity;
    let at = 0;
    for (let k = 1; k < pr.n; k++) {
      const dh = pr.h[k] - pr.h[k - 1];
      const dy = pr.y[k] - pr.y[k - 1];
      const len = Math.hypot(dh, dy);
      const f = len > 0 ? THREE.MathUtils.clamp(((h - pr.h[k - 1]) * dh + (y - pr.y[k - 1]) * dy) / (len * len), 0, 1) : 0;
      const d = Math.hypot(pr.h[k - 1] + dh * f - h, pr.y[k - 1] + dy * f - y);
      if (d < best) {
        best = d;
        at = arc + len * f;
      }
      arc += len;
    }
    return at;
  }

  /** Row `i`'s drape as one path, far edge to the water below its near edge, with the distance along it to each point. */
  private layPath(i: number): void {
    let arc = 0;
    for (let v = 0; v < PATH; v++) {
      const o = i * PATH + v;
      if (v < COLS) {
        const k = i * COLS + v;
        this.path.set(this.rest.subarray(k * 3, k * 3 + 3), o * 3);
        this.pathAcross[o] = this.across[k];
        this.pathWater[o] = this.onWater[k];
      } else {
        const b = i * BELOW + v - COLS + 1;
        this.path.set(this.below.subarray(b * 3, b * 3 + 3), o * 3);
        this.pathAcross[o] = this.belowAcross[b];
        this.pathWater[o] = this.below[b * 3 + 1] > 0.05 ? 0 : 1;
      }
      if (v > 0) arc += Math.hypot(this.path[o * 3] - this.path[o * 3 - 3], this.path[o * 3 + 1] - this.path[o * 3 - 2], this.path[o * 3 + 2] - this.path[o * 3 - 1]);
      this.pathArc[o] = arc;
    }
  }

  /** The point `q` metres along row `i`'s drape, as the body lies this frame, and whether it is on the water there. */
  private alongPath(i: number, q: number, out: THREE.Vector3, spine: number, roll: number): number {
    const base = i * PATH;
    let v = 1;
    while (v < PATH - 1 && this.pathArc[base + v] < q) v++;
    const a = base + v - 1;
    const b = base + v;
    const span = this.pathArc[b] - this.pathArc[a];
    const f = span > 1e-6 ? THREE.MathUtils.clamp((q - this.pathArc[a]) / span, 0, 1) : 1;
    out.set(this.path[a * 3] + (this.path[b * 3] - this.path[a * 3]) * f, this.path[a * 3 + 1] + (this.path[b * 3 + 1] - this.path[a * 3 + 1]) * f,
      this.path[a * 3 + 2] + (this.path[b * 3 + 2] - this.path[a * 3 + 2]) * f);
    const water = f < 0.5 ? this.pathWater[a] : this.pathWater[b];
    if (!water) out.y += spine + ((this.pathAcross[a] + (this.pathAcross[b] - this.pathAcross[a]) * f) / this.eyeAcross) * roll;
    return water;
  }

  private skinAt(c: THREE.Vector3, h: number, s: number): number {
    const y = this.whale.surfaceAt(c.x + this.side.x * h, c.z + this.side.z * h, this.skin).height;
    return y === -Infinity ? y : y - this.bodyShift(h, s);
  }

  private addProfile(h: number, y: number, skin: boolean): void {
    const pr = this.profile;
    if (pr.n >= pr.h.length) return;
    pr.h[pr.n] = h;
    pr.y[pr.n] = y;
    pr.skin[pr.n] = skin && y > 0 ? 1 : 0;
    pr.n++;
  }

  /** The distance along the profile from the crown line to where it reaches the water. */
  private profileWater(): number {
    const pr = this.profile;
    let arc = 0;
    for (let k = 1; k < pr.n; k++) {
      arc += Math.hypot(pr.h[k] - pr.h[k - 1], pr.y[k] - pr.y[k - 1]);
      if (pr.y[k] <= 0) return arc + 0.6;
    }
    return arc;
  }

  /**
   * The point `arc` metres along the profile from the crown line, into `this.p` (with the body's motion taken out),
   * and `this.r.x` its distance out across; written into point `k` of the sheet unless `k` is -1.
   */
  private alongProfile(arc: number, c: THREE.Vector3, dir: number, k: number): void {
    const pr = this.profile;
    let left = arc;
    let h = pr.h[pr.n - 1];
    let y = 0;
    let skin = 0;
    let water = 1;
    for (let m = 1; m < pr.n; m++) {
      const len = Math.hypot(pr.h[m] - pr.h[m - 1], pr.y[m] - pr.y[m - 1]);
      if (left <= len || m === pr.n - 1) {
        const f = len > 0 ? Math.min(1, left / len) : 0;
        h = pr.h[m - 1] + (pr.h[m] - pr.h[m - 1]) * f;
        y = pr.y[m - 1] + (pr.y[m] - pr.y[m - 1]) * f;
        skin = pr.skin[m - 1] && pr.skin[m] ? 1 : 0;
        water = y <= 0.001 ? 1 : 0;
        break;
      }
      left -= len;
    }
    this.p.set(c.x + this.side.x * h * dir, y + (skin ? 0.05 : 0.02), c.z + this.side.z * h * dir);
    this.r.x = h * dir;
    if (k < 0) return;
    this.p.toArray(this.rest, k * 3);
    this.across[k] = h * dir;
    this.onSkin[k] = skin;
    this.onWater[k] = water;
  }

  /** Once it is all draped: where the patch, the leader, the loop and the folded mass lie. */
  private laidOn(): void {
    for (let i = 0; i < ROWS; i++) {
      const slope = (this.edge.getX(Math.min(ROWS - 1, i + 1) * COLS) - this.edge.getX(Math.max(0, i - 1) * COLS)) / (2 * NET.long / (ROWS - 1));
      for (let j = 0; j < COLS; j++) this.edge.setZ(i * COLS + j, slope);
    }
    this.bridge();
    this.foldOver();
    for (let i = 0; i < ROWS; i++) this.layPath(i);
    this.uv.needsUpdate = this.edge.needsUpdate = true;
    const w = this.whale;
    const nose = w.spine[0];
    const sBlow = ((nose.x - w.blowhole.x) * this.ahead.x + (nose.z - w.blowhole.z) * this.ahead.z) / this.whaleLength;
    const uBlow = (sBlow - FRONT) * this.whaleLength;
    this.cutBreathOpening(uBlow);
    for (let i = 0; i < ROWS; i++) {
      for (let j = 0; j < COLS; j++) {
        const k = i * COLS + j;
        const du = (i / (ROWS - 1)) * NET.long - uBlow;
        const da = this.acrossOf(k);
        this.liftShape[k] = Math.pow(bump(du / PATCH.x) * bump(da / PATCH.y), 0.65);
        this.domes[k] = bump(du / DOME.x) * bump(da / DOME.y);
        const u = (i / (ROWS - 1)) * NET.long;
        const crest = this.edge.getX(k) * BILLOW_CREST;
        this.billows[k] = (1 - THREE.MathUtils.smoothstep(u, this.uEye + 3, this.uEye + BILLOW_PAST_EYE))
          * (da < crest ? THREE.MathUtils.smoothstep(da, -BILLOW_FAR, crest)
            : 1 - (1 - BILLOW_EDGE) * THREE.MathUtils.smoothstep(da, crest, this.edge.getX(k)));
      }
    }
    // The leader comes down off the cheek in front of the eye and the loop's line behind it, toward the flipper: never across the eye.
    const sEye = ((nose.x - w.eye.x) * this.ahead.x + (nose.z - w.eye.z) * this.ahead.z) / this.whaleLength;
    const eyeRow = ((sEye - FRONT) * this.whaleLength / NET.long) * (ROWS - 1);
    const perRow = (ROWS - 1) / NET.long;
    this.leaderRow = THREE.MathUtils.clamp(Math.round(eyeRow - LEADER_BEFORE_EYE * perRow), 0, ROWS - 1);
    this.loopRow = THREE.MathUtils.clamp(Math.round(eyeRow + LOOP_BEHIND_EYE * perRow), 0, ROWS - 1);
    this.layLeader();
    this.layAfloat();
    this.foldOn();
    const sizes = this.corkSize.array as Float32Array;
    this.corkAt.forEach((at, c) => {
      sizes[c] = at.leader >= 0 ? NET.float : at.patch && Math.abs(this.acrossOf(at.i * COLS + at.j)) > PATCH.y * 0.75 ? 0 : NET.cork;
    });
    this.corkSize.needsUpdate = true;
    this.breathRest.set(this.rest);
    for (const o of this.parts) o.visible = true;
    this.snap = true;
  }

  /**
   * The sheet comes to rest over the skin: on it where the skin bulges, across hollows where it does not, sagging a
   * little between. Its neighbours along the whale count only where they lie as far across theirs.
   */
  private bridge(): void {
    const R = this.rest;
    const floor = this.floor;
    for (let k = 0; k < this.n; k++) floor[k] = R[k * 3 + 1];
    for (let pass = 0; pass < BRIDGE_PASSES; pass++) {
      for (let i = 0; i < ROWS; i++) {
        for (let j = 0; j < COLS; j++) {
          const k = i * COLS + j;
          if (this.onWater[k]) continue;
          const a = this.acrossOf(k);
          let sum = 0;
          let count = 0;
          for (const o of [k - COLS, k + COLS]) {
            if (o < 0 || o >= this.n || Math.abs(this.acrossOf(o) - a) > 0.3) continue;
            sum += R[o * 3 + 1];
            count++;
          }
          // An edge has a neighbour on one side only, which would hold it out off a steep flank like a stiff skirt.
          if (j > 0 && j < COLS - 1) {
            sum += R[(k - 1) * 3 + 1] + R[(k + 1) * 3 + 1];
            count += 2;
          }
          if (count) R[k * 3 + 1] = Math.max(floor[k], sum / count - BRIDGE_SAG);
        }
      }
    }
    for (let k = 0; k < this.n; k++) this.stand[k] = R[k * 3 + 1] - floor[k];
  }

  /**
   * Soft folds where the old net has been dragged and gathered: ridges standing off the skin across it, rising from
   * the crown line, where it is held, and settling again before its edges.
   */
  private foldOver(): void {
    const R = this.rest;
    const n = this.r;
    for (let i = 0; i < ROWS; i++) {
      const u = (i / (ROWS - 1)) * NET.long;
      for (let j = 0; j < COLS; j++) {
        const k = i * COLS + j;
        if (this.onWater[k]) continue;
        const a = this.acrossOf(k);
        const reach = a > 0 ? this.edge.getX(k) : NET.far;
        const span = THREE.MathUtils.smoothstep(Math.abs(a), 1, 3.5) * (1 - THREE.MathUtils.smoothstep(Math.abs(a), reach - 2.5, reach - 0.6));
        if (span <= 0) continue;
        let up = 0;
        for (let f = 0; f < FOLDS; f++) {
          const at = 3 + f * (NET.long / FOLDS) + Math.sin(f * 7.1) * 1.6 + a * 0.18 * Math.sin(f * 3.3);
          const seed = Math.sin(f * 12.9) * 0.5 + 0.5;
          up = Math.max(up, (0.18 + 0.32 * seed) * bump((u - at) / (1.3 + 0.8 * seed)));
        }
        up *= span;
        if (up <= 0.005) continue;
        this.restNormal(i, j, n);
        R[k * 3] += n.x * up;
        R[k * 3 + 1] += n.y * up;
        R[k * 3 + 2] += n.z * up;
        this.stand[k] += up;
      }
    }
  }

  /** Which way the sheet faces at point (i, j) as it lies at rest, out from the skin. */
  private restNormal(i: number, j: number, out: THREE.Vector3): THREE.Vector3 {
    const R = this.rest;
    const a = (Math.min(ROWS - 1, i + 1) * COLS + j) * 3;
    const b = (Math.max(0, i - 1) * COLS + j) * 3;
    const c = (i * COLS + Math.min(COLS - 1, j + 1)) * 3;
    const d = (i * COLS + Math.max(0, j - 1)) * 3;
    this.p.set(R[a] - R[b], R[a + 1] - R[b + 1], R[a + 2] - R[b + 2]);
    this.q.set(R[c] - R[d], R[c + 1] - R[d + 1], R[c + 2] - R[d + 2]);
    out.crossVectors(this.q, this.p);
    if (out.y < 0) out.negate();
    return out.normalize();
  }

  /**
   * The leader's links laid out across the water from its foot at the cheek to its near cork a few metres off the
   * boat's port side, bowed out a little away from the boat.
   */
  private layLeader(): void {
    const k = (this.leaderRow * BELOW + BELOW - 1) * 3;
    const fx = this.below[k];
    const fz = this.below[k + 2];
    const s = Math.sin(this.boatYaw);
    const c = Math.cos(this.boatYaw);
    const ex = this.boat.x + c * CORK_OUT + s * CORK_AHEAD;
    const ez = this.boat.z - s * CORK_OUT + c * CORK_AHEAD;
    const dx = ex - fx;
    const dz = ez - fz;
    const d = Math.hypot(dx, dz) || 1;
    const reach = Math.min(d, this.links * LINK * 0.96);
    const bow = Math.sqrt(Math.max(0, (this.links * LINK * 0.92) ** 2 - reach * reach)) * 0.3;
    const out = (fx - this.boat.x) * -dz + (fz - this.boat.z) * dx > 0 ? 1 : -1;
    for (let m = 0; m <= this.links; m++) {
      const f = m / this.links;
      const bend = Math.sin(f * Math.PI) * bow * out;
      this.chain[m * 3] = fx + (dx / d) * f * reach - (dz / d) * bend;
      this.chain[m * 3 + 1] = 0;
      this.chain[m * 3 + 2] = fz + (dz / d) * f * reach + (dx / d) * bend;
      this.chainVel[m * 2] = this.chainVel[m * 2 + 1] = 0;
    }
    this.free = this.links;
    this.aboard = false;
  }

  /** Where each point will float once peeled: out from the waterline beside the head, doubled over at the leader's row, folded. */
  private layAfloat(): void {
    this.mass.set(0, 0, 0);
    const uLeader = (this.leaderRow / (ROWS - 1)) * NET.long;
    for (let k = 0; k < this.n; k++) {
      const u = (Math.floor(k / COLS) / (ROWS - 1)) * NET.long;
      const across = this.acrossOf(k);
      const near = this.edge.getX(k);
      const along = uLeader - Math.abs(u - uLeader) * GATHER + Math.sin(across * 1.3 + u * 0.2) * 0.3;
      this.folded[k * 3] = along;
      const layer = Math.floor((near - across) / FOLD_WIDE);
      this.folded[k * 3 + 2] = 0.04 + layer * 0.06 + Math.max(0, Math.sin(u * 1.7 + across * 0.8)) * 0.06 + (u < uLeader ? OVER : 0);
      const row = THREE.MathUtils.clamp((along / NET.long) * (ROWS - 1), 0, ROWS - 1);
      const i0 = Math.floor(row);
      const i1 = Math.min(ROWS - 1, i0 + 1);
      const a = (i0 * BELOW + BELOW - 1) * 3;
      const b = (i1 * BELOW + BELOW - 1) * 3;
      const f = row - i0;
      // Ahead of the net's front edge it floats on past the snout.
      const ahead = Math.min(0, along);
      const out = this.folded[k * 3 + 1];
      let x = this.below[a] + (this.below[b] - this.below[a]) * f + this.side.x * out - this.ahead.x * ahead;
      let z = this.below[a + 2] + (this.below[b + 2] - this.below[a + 2]) * f + this.side.z * out - this.ahead.z * ahead;
      const d = Math.hypot(x - this.boat.x, z - this.boat.z);
      if (d < BOAT_CLEAR) {
        x = this.boat.x + ((x - this.boat.x) / d) * BOAT_CLEAR;
        z = this.boat.z + ((z - this.boat.z) / d) * BOAT_CLEAR;
      }
      this.afloatAt[k * 2] = x;
      this.afloatAt[k * 2 + 1] = z;
      this.mass.x += x / this.n;
      this.mass.z += z / this.n;
      const long = (NET.long / 2 - u) * OPEN.x;
      const wide = (across - (near - NET.far) / 2) * OPEN.y;
      // Worked loose, it lies in no straight line: its edges wander and its mesh bunches here and opens there.
      const alongBy = long + Math.sin(u * 0.31 + across * 0.23) * 1.3 + Math.sin(across * 0.9) * 0.5;
      const wideBy = wide + Math.sin(across * 0.37 + u * 0.17) * 1.1 + Math.sin(u * 0.8) * 0.4;
      this.openAt[k * 2] = this.ahead.x * alongBy + this.side.x * wideBy;
      this.openAt[k * 2 + 1] = this.ahead.z * alongBy + this.side.z * wideBy;
      this.openY[k] = 0.04 + Math.max(0, Math.sin(u * 0.7 + across * 0.5) * Math.sin(across * 0.4 - u * 0.2)) * 0.14;
    }
  }

  /** Where point `k` floats this moment, once peeled: in the folded mass beside the head, or drifting away with it. */
  private floating(k: number, out: THREE.Vector3): THREE.Vector3 {
    const drift = THREE.MathUtils.smoothstep(this.drift, 0, 1);
    const turn = drift * K.raftTurn;
    const c = Math.cos(turn);
    const s = Math.sin(turn);
    const open = THREE.MathUtils.smootherstep(this.drift, OPEN_FROM, OPEN_TO);
    const x = THREE.MathUtils.lerp(this.afloatAt[k * 2] - this.mass.x, this.openAt[k * 2], open);
    const z = THREE.MathUtils.lerp(this.afloatAt[k * 2 + 1] - this.mass.z, this.openAt[k * 2 + 1], open);
    const away = 1 - (1 - drift) ** 2;
    const yaw = this.boatYaw;
    const toX = this.boat.x + Math.sin(yaw) * K.raftAhead + Math.cos(yaw) * K.raftPort - this.mass.x;
    const toZ = this.boat.z + Math.cos(yaw) * K.raftAhead - Math.sin(yaw) * K.raftPort - this.mass.z;
    return out.set(this.mass.x + c * x + s * z + toX * away, THREE.MathUtils.lerp(this.folded[k * 3 + 2], this.openY[k], open),
      this.mass.z - s * x + c * z + toZ * away);
  }

  private cutBreathOpening(uBlow: number): void {
    const b = this.breathBounds;
    const perRow = (ROWS - 1) / NET.long;
    b.i0 = Math.max(1, Math.floor((uBlow - K.breathFlapAlong) * perRow));
    b.i1 = Math.min(ROWS - 2, Math.ceil((uBlow + K.breathFlapAlong) * perRow));
    const near = this.nearAt(uBlow * perRow);
    b.j0 = Math.max(1, Math.floor((NET.far - K.breathFlapAcross) / (near + NET.far) * (COLS - 1)));
    b.j1 = Math.min(COLS - 2, Math.ceil((NET.far + K.breathFlapAcross) / (near + NET.far) * (COLS - 1)));
    const nearEnd = Math.min(COLS - 1, b.j1 + Math.ceil(K.breathNetDrape / (near + NET.far) * (COLS - 1)));
    const sheet: number[] = [], flap: number[] = [];
    for (let i = 0; i < ROWS - 1; i++) {
      for (let j = 0; j < COLS - 1; j++) {
        const k = i * COLS + j;
        if (i < b.i0 || i >= b.i1 || j < b.j0 || j >= b.j1)
          sheet.push(k, k + COLS, k + 1, k + 1, k + COLS, k + COLS + 1);
        if (i >= b.i0 - 1 && i <= b.i1 && j >= b.j0 - 1 && j < nearEnd)
          flap.push(k, k + COLS, k + 1, k + 1, k + COLS, k + COLS + 1);
      }
    }
    this.sheet.geometry.setIndex(sheet);
    this.breathNet.geometry.setIndex(flap);
    // Its near edge drapes over the orange sheet so the second net reads from the low boat.
    b.i0--; b.i1++; b.j0--; b.j1 = nearEnd;
    const length = (b.i1 - b.i0) / perRow;
    const width = (near + NET.far) * (b.j1 - b.j0) / (COLS - 1);
    const uv = this.breathNet.geometry.getAttribute('uv'), edge = this.breathNet.geometry.getAttribute('edge');
    for (let i = b.i0; i <= b.i1; i++) {
      for (let j = b.j0; j <= b.j1; j++) {
        const k = i * COLS + j;
        uv.setXY(k, (i - b.i0) / perRow, width * ((j - b.j0) / (b.j1 - b.j0) - 0.5));
        edge.setXYZ(k, width * 0.5, 0, 0);
      }
    }
    this.breathNet.material.uniforms.uSize.value.set(length, width * 0.5);
    uv.needsUpdate = edge.needsUpdate = true;
  }

  private layBreathNet(time: number): void {
    // Once afloat, the shader supplies all its motion.
    if (this.breathSettled && this.slump === 1) return;
    const b = this.breathBounds;
    if (!this.breathReleased) {
      if (this.slump === 0) {
        this.breathRest.set(this.pos.array);
        this.breathHeight = this.whale.blowhole.y;
      }
      else this.breathReleased = true;
    }
    const away = this.slump;
    const down = THREE.MathUtils.smootherstep(away, 0.65, 1);
    const dome = K.netDome * this.domeStrength * THREE.MathUtils.smoothstep(this.domeT, 0, 0.35)
      * Math.exp(-Math.max(0, this.domeT - 0.35) * 1.6) * (1 - away);
    for (let i = b.i0; i <= b.i1; i++) {
      for (let j = b.j0; j <= b.j1; j++) {
        const k = i * COLS + j, shape = this.liftShape[k];
        this.p.fromArray(this.breathRest, k * 3);
        this.p.addScaledVector(this.side, -K.breathNetAside * away).addScaledVector(this.ahead, -K.breathNetAlong * away);
        const ripple = Math.sin(time * 2.4 + i * 0.8 - j * 0.6) * this.lift * (0.12 + 0.3 * this.updraft);
        const up = K.breathNetGap + this.lift * K.netLift * (0.65 + 0.35 * shape) + dome * this.domes[k];
        const clear = THREE.MathUtils.lerp(this.p.y, Math.max(this.p.y, this.breathHeight), this.lift);
        this.p.y = THREE.MathUtils.lerp(clear + up, 0.08, down)
          + (ripple + K.breathNetArc * Math.sin(Math.PI * away)) * (1 - down);
        this.breathPos.setXYZ(k, this.p.x, this.p.y, this.p.z);
        this.breathAfloat.setX(k, down);
        this.breathContact.setX(k, this.contact.getX(k) * (1 - this.lift) * (1 - away));
      }
    }
    this.breathPos.needsUpdate = this.breathAfloat.needsUpdate = this.breathContact.needsUpdate = true;
    this.breathNet.geometry.computeVertexNormals();
    this.breathSettled = this.slump === 1;
  }

  /** The orange sheet follows the skin, then slides off with the later heaves. */
  private layOn(time: number): void {
    const P = this.pos.array as Float32Array;
    const A = this.afloat.array as Float32Array;
    const C = this.contact.array as Float32Array;
    const roll = this.whale.eye.y - this.refEye - this.spineShift(this.sEye);
    const uLeader = (this.leaderRow / (ROWS - 1)) * NET.long;
    const far = Math.max(uLeader, NET.long - uLeader);
    for (let i = 0; i < ROWS; i++) {
      const u = (i / (ROWS - 1)) * NET.long;
      const end = this.pathArc[i * PATH + PATH - 1];
      const row = THREE.MathUtils.clamp(this.peel * (1 + STAGGER) - (STAGGER * Math.abs(u - uLeader)) / far, 0, 1);
      const slide = row * (end + WATER_MIN);
      this.slid[i] = slide;
      const spine = this.spineShift(this.rowS(i));
      let v = 1;
      for (let j = 0; j < COLS; j++) {
        const k = i * COLS + j;
        const arc = this.pathArc[i * PATH + j];
        const q = arc + slide;
        if (q <= end) {
          const water = this.alongPath(i, q, this.t, spine, roll);
          let up = 0;
          const billows = this.billowed > 0.001 ? this.billowAt(i, q, (v = this.pathIndex(i, q, v)), end) : 0;
          if (billows > 0) {
            // Ripples run across it toward the boat with the wind, as through a sheet held up on a line.
            const ripple = Math.sin(time * 5.2 - q * 0.9 - u * 0.35) + 0.5 * Math.sin(time * 8.1 - u * 0.8 + j * 0.5);
            const b = this.billowed * K.billowHeight * billows * (0.82 + 0.12 * ripple);
            up += b;
            this.t.x += this.side.x * b * K.billowOut;
            this.t.z += this.side.z * b * K.billowOut;
          }
          P[k * 3] = this.t.x;
          P[k * 3 + 1] = this.t.y + up;
          P[k * 3 + 2] = this.t.z;
          A[k] = water;
          C[k] = water ? 0 : 1 - THREE.MathUtils.smoothstep(up + this.stand[k], 0.05, 0.3);
        } else {
          const t = THREE.MathUtils.smoothstep((q - end) / (arc + WATER_MIN), 0, 1);
          const w = (i * PATH + PATH - 1) * 3;
          this.floating(k, this.r);
          P[k * 3] = this.path[w] + (this.r.x - this.path[w]) * t;
          P[k * 3 + 1] = this.path[w + 1] + (this.r.y - this.path[w + 1]) * t;
          P[k * 3 + 2] = this.path[w + 2] + (this.r.z - this.path[w + 2]) * t;
          A[k] = 1;
          C[k] = 0;
        }
      }
    }
    this.normalsFrom(P);
    this.pos.needsUpdate = this.afloat.needsUpdate = this.contact.needsUpdate = this.normals.needsUpdate = true;
  }

  /** The first of row `i`'s cloth points at least `q` along its drape, searching from `from`. */
  private pathIndex(i: number, q: number, from: number): number {
    let v = from;
    while (v > 1 && this.pathArc[i * PATH + v - 1] >= q) v--;
    while (v < COLS - 1 && this.pathArc[i * PATH + v] < q) v++;
    return v;
  }

  /**
   * How much the mesh billows at `q` along row `i`'s drape, by where it lies on the head now rather than which part of
   * the cloth it is, so the belly stays over the head as the net slides through it, fading to the water below.
   */
  private billowAt(i: number, q: number, v: number, end: number): number {
    const base = i * PATH;
    const a = this.pathArc[base + v - 1];
    const f = THREE.MathUtils.clamp((q - a) / Math.max(1e-6, this.pathArc[base + v] - a), 0, 1);
    const w = this.billows[i * COLS + v - 1] * (1 - f) + this.billows[i * COLS + v] * f;
    const edge = this.pathArc[base + COLS - 1];
    return q > edge ? w * (1 - THREE.MathUtils.smoothstep(q, edge, end)) : w;
  }

  private normalsFrom(P: Float32Array): void {
    const N = this.normals.array as Float32Array;
    for (let k = 0; k < this.n; k++) {
      const a = NORMAL_NEIGHBOURS[k * 4], b = NORMAL_NEIGHBOURS[k * 4 + 1];
      const c = NORMAL_NEIGHBOURS[k * 4 + 2], d = NORMAL_NEIGHBOURS[k * 4 + 3];
      const px = P[a] - P[b], py = P[a + 1] - P[b + 1], pz = P[a + 2] - P[b + 2];
      const qx = P[c] - P[d], qy = P[c + 1] - P[d + 1], qz = P[c + 2] - P[d + 2];
      let x = qy * pz - qz * py, y = qz * px - qx * pz, z = qx * py - qy * px;
      if (y < 0) { x = -x; y = -y; z = -z; }
      const inverse = 1 / (Math.sqrt(x * x + y * y + z * z) || 1);
      N[k * 3] = x * inverse;
      N[k * 3 + 1] = y * inverse;
      N[k * 3 + 2] = z * inverse;
    }
  }

  /** The wet rope and corks as the patch comes up, and the mesh slithering off the skin as it peels, as loud as each is quick. */
  private sounds(): void {
    if (this.snap) {
      this.soundAt = this.lift;
      this.peelAt = this.peel;
    }
    this.soundLift += Math.max(0, this.lift - this.soundAt);
    this.soundAt = this.lift;
    if (this.soundLift > 0.05 && this.clock > this.soundNext) {
      this.soundNext = this.clock + 0.25;
      this.onSound?.('net-lift', this.whale.blowhole, Math.min(1.5, this.soundLift * 6));
      this.soundLift = 0;
    }
    this.soundPeel += Math.max(0, this.peel - this.peelAt);
    this.peelAt = this.peel;
    if (this.soundPeel > 0.03 && this.clock > this.soundNext) {
      this.soundNext = this.clock + 0.3;
      this.sheetPoint(this.leaderRow, COLS - 1, this.r);
      this.onSound?.('net-slither', this.r, Math.min(1.5, this.soundPeel * 9));
      this.soundPeel = 0;
    }
  }

  /** A point of the sheet by row and column, as laid this frame. */
  private sheetPoint(i: number, j: number, out: THREE.Vector3): THREE.Vector3 {
    const k = i * COLS + j;
    return out.fromArray(this.pos.array, k * 3);
  }

  /**
   * Where a row's line runs down its near side from the net's edge to the water: on the skin as draped, gathered up
   * into the edge where the edge has slid down past it.
   */
  private downSide(i: number, m: number, out: THREE.Vector3): THREE.Vector3 {
    if (m === 0) return this.sheetPoint(i, COLS - 1, out);
    const v = i * PATH + COLS - 1 + m;
    if (this.slid[i] + this.pathArc[i * PATH + COLS - 1] >= this.pathArc[v]) return this.sheetPoint(i, COLS - 1, out);
    const b = (i * BELOW + m) * 3;
    const y = this.below[b + 1];
    return out.set(this.below[b], y + (y > 0.05 ? this.bodyShift(this.belowAcross[i * BELOW + m], this.rowS(i)) : 0), this.below[b + 2]);
  }

  /**
   * The float-line on the water: dragged by its foot, still in the breeze, stilled by the water, shoved by `push`,
   * kept off the boat's planking. Held, the links beyond what is still out run up into her mittens and down onto the
   * boards; let go, they pay back out over the rail.
   */
  private moveLeader(dt: number, time: number): void {
    const C = this.chain;
    const V = this.chainVel;
    this.downSide(this.leaderRow, BELOW - 1, this.p);
    this.foot.copy(this.p);
    C[0] = this.p.x;
    C[2] = this.p.z;
    const whole = this.links * LINK;
    const grip = this.grip;
    let out = whole;
    if (grip) {
      if (grip.by) {
        grip.by.mitten(0, this.outer);
        grip.by.mitten(1, this.inner);
        // The outer mitten is the one the line comes up to from the water.
        const f = this.free > 1 ? Math.ceil(this.free) - 1 : 0;
        const ox = C[f * 3], oz = C[f * 3 + 2];
        if (Math.hypot(this.inner.x - ox, this.inner.z - oz) < Math.hypot(this.outer.x - ox, this.outer.z - oz)) {
          this.t.copy(this.outer);
          this.outer.copy(this.inner);
          this.inner.copy(this.t);
        }
        this.aboard = true;
      } else {
        grip.out = Math.min(whole, grip.out + PAY_OUT * dt);
        this.inner.copy(this.outer);
      }
      out = THREE.MathUtils.clamp(grip.out, Math.min(whole, Math.hypot(this.outer.x - C[0], this.outer.z - C[2]) + 0.2), whole);
      if (!grip.by && grip.out >= whole) {
        this.grip = null;
        this.aboard = false;
      }
    }
    this.free = this.aboard ? out / LINK : this.links;
    const last = this.aboard ? Math.max(0, Math.ceil(this.free - 1e-6) - 1) : this.links;
    const still = Math.exp(-dt * K.floatDrag);
    for (let m = 1; m <= last; m++) {
      V[m * 2] *= still;
      V[m * 2 + 1] *= still;
      C[m * 3] += V[m * 2] * dt;
      C[m * 3 + 2] += V[m * 2 + 1] * dt;
    }
    const rest = out - last * LINK;
    for (let pass = 0; pass < 4; pass++) {
      for (let m = 1; m <= last; m++) {
        const dx = C[m * 3] - C[(m - 1) * 3];
        const dz = C[m * 3 + 2] - C[(m - 1) * 3 + 2];
        const d = Math.hypot(dx, dz);
        if (d <= LINK) continue;
        const pull = (d - LINK) / d;
        const share = m === 1 ? 1 : 0.5;
        C[m * 3] -= dx * pull * share;
        C[m * 3 + 2] -= dz * pull * share;
        if (m > 1) {
          C[(m - 1) * 3] += dx * pull * (1 - share);
          C[(m - 1) * 3 + 2] += dz * pull * (1 - share);
        }
      }
      if (this.aboard && last > 0) {
        const dx = C[last * 3] - this.outer.x;
        const dz = C[last * 3 + 2] - this.outer.z;
        const d = Math.hypot(dx, dz);
        if (d > rest) {
          C[last * 3] -= (dx * (d - rest)) / d;
          C[last * 3 + 2] -= (dz * (d - rest)) / d;
        }
      }
      this.offHull(last, pass === 0);
    }
    const settle = 1 - Math.exp(-dt * 8);
    for (let m = 0; m <= last; m++) {
      const y = swellLift(C[m * 3], C[m * 3 + 2], time) + 0.03;
      C[m * 3 + 1] = this.snap ? y : C[m * 3 + 1] + (y - C[m * 3 + 1]) * settle;
    }
    const follow = this.snap ? 1 : 1 - Math.exp(-dt * 14);
    for (let m = last + 1; m <= this.links; m++) {
      this.aboardAt(m * LINK - out, this.t);
      C[m * 3] += (this.t.x - C[m * 3]) * follow;
      C[m * 3 + 1] += (this.t.y - C[m * 3 + 1]) * follow;
      C[m * 3 + 2] += (this.t.z - C[m * 3 + 2]) * follow;
      V[m * 2] = V[m * 2 + 1] = 0;
    }
    const end = this.links;
    this.float.position.set(C[end * 3], C[end * 3 + 1] + (last === end ? NET.float * 0.3 : 0), C[end * 3 + 2]);
    this.float.velocity.set(V[end * 2], 0, V[end * 2 + 1]);
  }

  /** `s` metres of hauled line past the outer mitten: through the inner one, down to the boards and round the coil. */
  private aboardAt(s: number, out: THREE.Vector3): THREE.Vector3 {
    const grip = this.grip;
    const coil = grip ? grip.coil : this.outer;
    const a = this.outer.distanceTo(this.inner);
    if (s <= a) return out.copy(this.outer).lerp(this.inner, a > 0 ? s / a : 1);
    const b = this.inner.distanceTo(coil);
    if (s <= a + b) return out.copy(this.inner).lerp(coil, b > 0 ? (s - a) / b : 1);
    const turn = (s - a - b) / COIL;
    return out.set(coil.x + Math.cos(turn) * COIL, coil.y + 0.03 * turn / (Math.PI * 2), coil.z + Math.sin(turn) * COIL);
  }

  /** The links out on the water kept outside the planking; the near cork knocks on it when it comes in hard. */
  private offHull(last: number, hear: boolean): void {
    const hull = this.hull;
    if (!hull) return;
    const C = this.chain;
    const V = this.chainVel;
    const s = Math.sin(hull.yaw);
    const c = Math.cos(hull.yaw);
    for (let m = 1; m <= last; m++) {
      const dx = C[m * 3] - hull.position.x;
      const dz = C[m * 3 + 2] - hull.position.z;
      const fore = dx * s + dz * c;
      if (fore < STERN_Z - CORK_CLEAR || fore > BOW_Z + CORK_CLEAR) continue;
      const port = dx * c - dz * s;
      const half = gunwaleHalf(stationU(fore)) + CORK_CLEAR;
      if (Math.abs(port) >= half) continue;
      const side = port < 0 ? -1 : 1;
      const nx = c * side;
      const nz = -s * side;
      C[m * 3] += nx * (half * side - port);
      C[m * 3 + 2] += nz * (half * side - port);
      const into = V[m * 2] * nx + V[m * 2 + 1] * nz;
      if (into >= 0) continue;
      V[m * 2] -= nx * into * 1.3;
      V[m * 2 + 1] -= nz * into * 1.3;
      if (hear && m === this.links && -into > KNOCK_FROM && this.clock > this.knockNext) {
        this.knockNext = this.clock + 0.2;
        this.onSound?.('cork-knock', this.float.position, Math.min(1.5, -into));
      }
    }
  }

  /** The corks: resting on the skin, riding the water, or hanging by their short lines under a lifted mesh, with weight. */
  private hangCorks(dt: number): void {
    const now = this.corkNow;
    const vel = this.corkVel;
    const out = this.cork.array as Float32Array;
    const N = this.normals.array as Float32Array;
    const A = this.afloat.array as Float32Array;
    const sizes = this.corkSize.array as Float32Array;
    for (let c = 0; c < this.corkAt.length; c++) {
      const at = this.corkAt[c];
      let afloat: number;
      const size = sizes[c];
      if (at.leader >= 0) {
        this.t.fromArray(this.chain, at.leader * 3).setY(size * 0.3 + this.chain[at.leader * 3 + 1]);
        afloat = 0;
      } else {
        const i1 = Math.min(ROWS - 1, at.i + 1);
        this.sheetPoint(at.i, at.j, this.p).lerp(this.sheetPoint(i1, at.j, this.q), at.f);
        const k = at.i * COLS + at.j;
        afloat = A[k];
        this.q.fromArray(N, k * 3);
        this.t.copy(this.p).addScaledVector(this.q, size * 0.8 * (1 - afloat));
        this.t.y += afloat ? size * 0.3 - this.p.y * afloat : 0;
      }
      const o = c * 3;
      if (this.snap) {
        now[o] = this.t.x;
        now[o + 1] = this.t.y;
        now[o + 2] = this.t.z;
        vel[o] = vel[o + 1] = vel[o + 2] = 0;
      } else {
        // A cork on its short line swings after what it hangs from; one lying on something, or tied into a sheet
        // billowing in the wind, follows it closely.
        const w = afloat > 0.5 || at.leader >= 0 ? 30 : THREE.MathUtils.lerp(8, 30, THREE.MathUtils.smoothstep(this.billowed, 0, 0.2));
        for (let e = 0; e < 3; e++) {
          const pull = (this.t.getComponent(e) - now[o + e]) * w * w - vel[o + e] * 2 * 0.55 * w;
          vel[o + e] += pull * dt;
          now[o + e] += vel[o + e] * dt;
        }
      }
      out[c * 4] = now[o];
      out[c * 4 + 1] = now[o + 1];
      out[c * 4 + 2] = now[o + 2];
      out[c * 4 + 3] = at.leader >= 0 ? 0 : afloat;
    }
    this.cork.needsUpdate = true;
  }

  /** Corks along the orange net and one at each leader link. */
  private placeCorks(): void {
    const along = (j: number) => {
      for (let u = 0.6; u < NET.long; u += NET.corkStep) {
        const fi = (u / NET.long) * (ROWS - 1);
        this.corkAt.push({ i: Math.floor(fi), j, f: fi - Math.floor(fi), leader: -1, patch: false });
      }
    };
    const acrossRow = (i: number, patch = false, every = 2) => {
      for (let j = 1; j < COLS - 1; j += every) this.corkAt.push({ i, j, f: 0, leader: -1, patch });
    };
    along(0);
    along(COLS - 1);
    acrossRow(0, false, 3);
    acrossRow(ROWS - 1, false, 3);
    acrossRow(Math.round((((BLOWHOLE - FRONT) * LENGTH * this.whale.scale) / NET.long) * (ROWS - 1)), true, 1);
    for (let m = 2; m <= this.links; m++) this.corkAt.push({ i: 0, j: 0, f: 0, leader: m, patch: false });
  }

  private polyline(count: number): Polyline {
    const start = this.polylines.reduce((n, l) => n + l.count, 0);
    const neighbours = new Uint32Array(count * 2);
    for (let m = 0; m < count; m++) {
      neighbours[m * 2] = (start + Math.max(0, m - 1)) * 6;
      neighbours[m * 2 + 1] = (start + Math.min(count - 1, m + 1)) * 6;
    }
    const l = { start, count, neighbours };
    this.polylines.push(l);
    return l;
  }

  /** The leader, the loop with its free end, and the weed, as lines a pixel or more wide. */
  private drawLines(): void {
    this.drawLeader();
    this.drawLoop();
    this.drawWeed();
    this.drawFoldWeed();
    const L = this.line;
    L.pos.needsUpdate = L.along.needsUpdate = L.width.needsUpdate = L.afloat.needsUpdate = L.weed.needsUpdate = true;
  }

  private setPoint(l: Polyline, m: number, p: THREE.Vector3, width: number, afloat: number, weed: number): void {
    const L = this.line;
    const P = L.pos.array as Float32Array;
    const W = L.width.array as Float32Array;
    const F = L.afloat.array as Float32Array;
    const G = L.weed.array as Float32Array;
    for (let e = 0; e < 2; e++) {
      const v = (l.start + m) * 2 + e;
      P[v * 3] = p.x;
      P[v * 3 + 1] = p.y;
      P[v * 3 + 2] = p.z;
      W[v] = width;
      F[v] = afloat;
      G[v] = weed;
    }
  }

  /** Each point's direction along its line, from its neighbours. */
  private tangents(l: Polyline): void {
    const P = this.line.pos.array as Float32Array;
    const T = this.line.along.array as Float32Array;
    for (let m = 0; m < l.count; m++) {
      const a = l.neighbours[m * 2], b = l.neighbours[m * 2 + 1];
      const x = P[b] - P[a], y = P[b + 1] - P[a + 1], z = P[b + 2] - P[a + 2];
      const inverse = 1 / (Math.sqrt(x * x + y * y + z * z) || 1);
      const k = (l.start + m) * 6;
      T[k] = T[k + 3] = x * inverse;
      T[k + 1] = T[k + 4] = y * inverse;
      T[k + 2] = T[k + 5] = z * inverse;
    }
  }

  /** Down the skin, across the water, and once she has it up into her mittens and down onto the boards. */
  private drawLeader(): void {
    const l = this.leaderLine;
    for (let m = 0; m < BELOW; m++) this.setPoint(l, m, this.downSide(this.leaderRow, m, this.q), NET.line, 0, 0);
    const last = this.aboard ? Math.max(0, Math.ceil(this.free - 1e-6) - 1) : this.links;
    let v = BELOW;
    for (let m = 1; m <= last; m++) this.setPoint(l, v++, this.q.fromArray(this.chain, m * 3), NET.line, 0, 0);
    if (this.aboard) {
      this.setPoint(l, v++, this.outer, NET.line, 0, 0);
      this.setPoint(l, v++, this.inner, NET.line, 0, 0);
    }
    for (let m = last + 1; m <= this.links; m++) this.setPoint(l, v++, this.q.fromArray(this.chain, m * 3), NET.line, 0, 0);
    this.q.fromArray(this.chain, this.links * 3);
    while (v < l.count) this.setPoint(l, v++, this.q, NET.line, 0, 0);
    this.tangents(l);
  }

  /**
   * The line from the net's near edge down to the near flipper, the slack loop round its outer part, and the free end
   * beyond it: round the flipper while it is on, sliding to the tip and off, then a slack curl beside the floating net.
   */
  private drawLoop(): void {
    const w = this.whale;
    const l = this.loopLine;
    for (let m = 0; m < BELOW; m++) this.setPoint(l, m, this.downSide(this.loopRow, m, this.q), NET.line, 0, 0);
    const slide = THREE.MathUtils.smoothstep(this.loop, 0, 0.8);
    const off = THREE.MathUtils.smoothstep(this.loop, 0.75, 1);
    const along = THREE.MathUtils.lerp(LOOP_FROM, LOOP_PAST, slide);
    this.floating(this.loopRow * COLS + COLS - 1, this.t).addScaledVector(this.side, 1.2);
    if (this.fallsTo) this.curlFrom.subVectors(this.fallsTo, this.t).setY(0);
    const fall = this.fall.copy(this.t).add(this.curlFrom);
    const point = this.point;
    for (let m = 0; m <= RING; m++) {
      const a = (m / RING) * Math.PI * 2;
      w.flipperRim(along + 0.004 * Math.sin(a), a, NET.loop * 0.7, point);
      if (off > 0) point.lerp(this.curl.set(fall.x + Math.cos(a) * 0.9, 0.02, fall.z + Math.sin(a) * 0.6), off);
      this.setPoint(l, BELOW + m, point, NET.loop, off > 0.5 ? 1 : 0, 0);
    }
    for (let m = 1; m <= KNOT; m++) {
      const u = m / KNOT, turn = u * Math.PI * 2;
      w.flipperRim(along + 0.009 * Math.sin(turn), 0.22 * Math.sin(turn * 2), NET.loop * (1.5 + 0.65 * Math.cos(turn)), point);
      if (off > 0) point.lerp(this.curl.set(fall.x + 0.9, 0.02, fall.z), off);
      this.setPoint(l, BELOW + RING + m, point, NET.loop, off > 0.5 ? 1 : 0, 0);
    }
    const tail = this.tail.copy(point);
    this.loopTie.copy(tail);
    const out = this.side;
    if (this.held) {
      this.endFrom.subVectors(this.held, this.t);
      this.endDropped = true;
    }
    const dropped = this.endDropped ? this.drop.copy(this.t).add(this.endFrom) : null;
    const bill = this.held ?? dropped;
    const sag = bill ? Math.min(1.2, 0.24 * tail.distanceTo(bill)) * (1 - 0.94 * this.tension) : 0;
    for (let m = 1; m <= END_POINTS; m++) {
      const f = m / END_POINTS;
      if (dropped && off > 0) this.lie.lerpVectors(tail, dropped, f);
      else if (this.endRest) this.lie.lerpVectors(tail, this.endRest, f);
      else this.lie.set(tail.x + out.x * LOOP_END * f, 0, tail.z + out.z * LOOP_END * f);
      this.lie.y = Math.max(0.02, tail.y * (1 - f));
      point.copy(this.lie);
      if (bill && this.holding > 0.001) {
        this.hang.lerpVectors(tail, bill, f).y -= Math.sin(f * Math.PI) * sag;
        point.lerp(this.hang, this.holding);
      }
      this.setPoint(l, BELOW + RING + KNOT + m, point, NET.loop * 0.7, f * (1 - this.holding), 0);
    }
    this.loopEnd.copy(point);
    this.tangents(l);
  }

  /** The fold over its eye laid on, as it lies across the eye: hanging from the near edge above it down past it. */
  private foldOn(): void {
    const w = this.whale;
    const perRow = (ROWS - 1) / NET.long;
    const uv = this.fold.geometry.getAttribute('uv') as THREE.BufferAttribute;
    const edge = this.fold.geometry.getAttribute('edge') as THREE.BufferAttribute;
    const plane = FOLD_ROWS * FOLD_COLS;
    for (let fr = 0; fr < FOLD_ROWS; fr++) {
      const du = ((fr / (FOLD_ROWS - 1)) * 2 - 1) * FOLD_HALF;
      const u = this.uEye + du;
      this.foldU[fr] = u;
      const s = FRONT + u / this.whaleLength;
      const c = w.point(0, TOP(s), s, this.q);
      this.profileFrom(c, 1, s);
      const near = this.nearAt(u * perRow);
      const eyeArc = this.arcNearest(this.offAxis(w.eye) - this.offAxis(c), w.eye.y);
      const reach = Math.min(eyeArc + FOLD_BELOW, this.profileWater() - 0.9) - near;
      const long = Math.max(0.3, reach * (0.2 + 0.8 * bump(du / (FOLD_HALF * 1.05)) ** 0.6));
      this.foldLong[fr] = long;
      for (let m = 0; m < FOLD_COLS; m++) {
        const k = fr * FOLD_COLS + m;
        this.alongProfile(near + (long * m) / (FOLD_COLS - 1), c, 1, -1);
        const skin = w.surfaceAt(this.p.x, this.p.z, this.skin);
        const n = skin.height === -Infinity ? this.t.set(this.side.x, 0.4, this.side.z).normalize() : skin.normal;
        this.p.addScaledVector(n, FOLD_STAND + FOLD_BRIDGE * bump(this.p.distanceTo(w.eye) / 2.6));
        this.p.toArray(this.foldRest, k * 3);
        this.foldAcross[k] = this.r.x;
        for (let l = 0; l < 2; l++) {
          uv.setXY(l * plane + k, u + l * 0.43, near + (long * m) / (FOLD_COLS - 1) + l * 0.61);
          edge.setXYZ(l * plane + k, near + long + l * 0.61, 1, 0);
        }
      }
    }
    for (let fr = 0; fr < FOLD_ROWS; fr++) {
      const a = Math.max(0, fr - 1) * FOLD_COLS * 3;
      const b = Math.min(FOLD_ROWS - 1, fr + 1) * FOLD_COLS * 3;
      this.axis.set(this.foldRest[b] - this.foldRest[a], this.foldRest[b + 1] - this.foldRest[a + 1], this.foldRest[b + 2] - this.foldRest[a + 2]);
      const h = fr * FOLD_COLS * 3;
      const mid = (fr * FOLD_COLS + FOLD_COLS - 1) * 3;
      this.p.set(this.foldRest[mid] - this.foldRest[h], this.foldRest[mid + 1] - this.foldRest[h + 1], this.foldRest[mid + 2] - this.foldRest[h + 2]);
      // Turned the way that swings it out from the skin first, toward the boat and up.
      const swing = this.r.crossVectors(this.axis, this.p);
      this.foldTurn[fr] = swing.x * this.side.x + swing.z * this.side.z + swing.y * 0.3 >= 0 ? 1 : -1;
    }
    uv.needsUpdate = edge.needsUpdate = true;
  }

  /** How far across the near edge of the sheet lies at fractional row `row`. */
  private nearAt(row: number): number {
    const i0 = THREE.MathUtils.clamp(Math.floor(row), 0, ROWS - 1);
    const i1 = Math.min(ROWS - 1, i0 + 1);
    const f = THREE.MathUtils.clamp(row - i0, 0, 1);
    return this.edge.getX(i0 * COLS) * (1 - f) + this.edge.getX(i1 * COLS) * f;
  }

  /** The sheet as laid this frame at fractional row `row` and `across` metres from the crown line, and its facing. */
  private sheetAcross(row: number, across: number, out: THREE.Vector3, normal: THREE.Vector3): void {
    const P = this.pos.array as Float32Array;
    const N = this.normals.array as Float32Array;
    const A = this.afloat.array as Float32Array;
    const i0 = THREE.MathUtils.clamp(Math.floor(row), 0, ROWS - 1);
    const i1 = Math.min(ROWS - 1, i0 + 1);
    const f = THREE.MathUtils.clamp(row - i0, 0, 1);
    out.set(0, 0, 0);
    normal.set(0, 0, 0);
    let afloat = 0;
    for (const [i, wi] of [[i0, 1 - f], [i1, f]] as const) {
      const near = this.edge.getX(i * COLS);
      const jf = THREE.MathUtils.clamp(((across + NET.far) / (near + NET.far)) * (COLS - 1), 0, COLS - 1);
      const j0 = Math.floor(jf);
      const j1 = Math.min(COLS - 1, j0 + 1);
      const g = jf - j0;
      for (const [j, wj] of [[j0, 1 - g], [j1, g]] as const) {
        const k = i * COLS + j;
        out.x += P[k * 3] * wi * wj;
        out.y += P[k * 3 + 1] * wi * wj;
        out.z += P[k * 3 + 2] * wi * wj;
        normal.x += N[k * 3] * wi * wj;
        normal.y += N[k * 3 + 1] * wi * wj;
        normal.z += N[k * 3 + 2] * wi * wj;
        afloat += A[k] * wi * wj;
      }
    }
    normal.normalize();
    this.foldFloat = afloat;
  }

  private foldFloat = 0;

  /**
   * The fold this frame: lying across the eye with the body as it breathes, swung up off it about the near edge it
   * hangs from as it is lifted, and flipped right over onto the brow, lying doubled on the sheet there and going
   * wherever the sheet goes after.
   */
  private layFold(): void {
    const P = this.foldPos.array as Float32Array;
    const C = this.foldContact.array as Float32Array;
    const F = this.foldAfloat.array as Float32Array;
    const plane = FOLD_ROWS * FOLD_COLS;
    const angle = Math.PI * THREE.MathUtils.clamp(this.flap, 0, 1);
    const toBrow = THREE.MathUtils.smoothstep(this.flap, 0.6, 1);
    const perRow = (ROWS - 1) / NET.long;
    const R = this.foldRest;
    const roll = this.whale.eye.y - this.refEye - this.spineShift(this.sEye);
    for (let fr = 0; fr < FOLD_ROWS; fr++) {
      const u = this.foldU[fr];
      const s = FRONT + u / this.whaleLength;
      const spine = this.spineShift(s);
      const row = u * perRow;
      const near = this.nearAt(row);
      this.sheetAcross(row, near, this.hinge, this.curl);
      const h = fr * FOLD_COLS;
      this.q.fromArray(R, h * 3);
      this.q.y += spine + (this.foldAcross[h] / this.eyeAcross) * roll;
      this.drop.subVectors(this.hinge, this.q);
      const a = Math.max(0, fr - 1) * FOLD_COLS * 3;
      const b = Math.min(FOLD_ROWS - 1, fr + 1) * FOLD_COLS * 3;
      this.axis.set(R[b] - R[a], R[b + 1] - R[a + 1], R[b + 2] - R[a + 2]).normalize().multiplyScalar(this.foldTurn[fr]);
      for (let m = 0; m < FOLD_COLS; m++) {
        const k = h + m;
        this.p.fromArray(R, k * 3).add(this.drop);
        this.p.y += spine + (this.foldAcross[k] / this.eyeAcross) * roll;
        this.p.sub(this.hinge).applyAxisAngle(this.axis, angle).add(this.hinge);
        let afloat = 0;
        if (toBrow > 0) {
          this.sheetAcross(row, near - (this.foldLong[fr] * m) / (FOLD_COLS - 1), this.lie, this.curl);
          this.lie.addScaledVector(this.curl, 0.09);
          this.p.lerp(this.lie, toBrow);
          afloat = this.foldFloat * toBrow;
        }
        this.p.toArray(P, k * 3);
        F[k] = F[plane + k] = afloat;
        C[k] = C[plane + k] = (1 - THREE.MathUtils.smoothstep(this.flap, 0.02, 0.2)) + 0.5 * toBrow;
      }
    }
    const N = this.foldNormals.array as Float32Array;
    for (let fr = 0; fr < FOLD_ROWS; fr++) {
      for (let m = 0; m < FOLD_COLS; m++) {
        const k = fr * FOLD_COLS + m;
        const a = (Math.min(FOLD_ROWS - 1, fr + 1) * FOLD_COLS + m) * 3;
        const b = (Math.max(0, fr - 1) * FOLD_COLS + m) * 3;
        const c = (fr * FOLD_COLS + Math.min(FOLD_COLS - 1, m + 1)) * 3;
        const d = (fr * FOLD_COLS + Math.max(0, m - 1)) * 3;
        this.p.set(P[a] - P[b], P[a + 1] - P[b + 1], P[a + 2] - P[b + 2]);
        this.q.set(P[c] - P[d], P[c + 1] - P[d + 1], P[c + 2] - P[d + 2]);
        this.r.crossVectors(this.q, this.p).normalize();
        this.r.toArray(N, k * 3);
        this.r.toArray(N, (plane + k) * 3);
        P[(plane + k) * 3] = P[k * 3] + this.r.x * FOLD_LAYER;
        P[(plane + k) * 3 + 1] = P[k * 3 + 1] + this.r.y * FOLD_LAYER;
        P[(plane + k) * 3 + 2] = P[k * 3 + 2] + this.r.z * FOLD_LAYER;
      }
    }
    const mid = Math.floor(FOLD_ROWS / 2) * FOLD_COLS;
    this.foldTip.fromArray(P, (mid + FOLD_COLS - 1) * 3);
    this.foldMid.fromArray(P, (mid + Math.floor(FOLD_COLS / 2)) * 3);
    this.foldTop.fromArray(P, mid * 3);
    this.foldPos.needsUpdate = this.foldNormals.needsUpdate = this.foldContact.needsUpdate = this.foldAfloat.needsUpdate = true;
  }

  /** Weed hanging off the fold's lower part: down its face as it lies, straight down as it swings up off the eye. */
  private drawFoldWeed(): void {
    const time = this.clock;
    const P = this.foldPos.array as Float32Array;
    const N = this.foldNormals.array as Float32Array;
    const F = this.foldAfloat.array as Float32Array;
    const hanging = THREE.MathUtils.smoothstep(this.flap, 0.05, 0.3) * (1 - THREE.MathUtils.smoothstep(this.flap, 0.6, 1));
    for (let w = 0; w < FOLD_WEEDS; w++) {
      const at = this.foldWeedAt[w];
      const l = this.foldWeeds[w];
      const k = at.fr * FOLD_COLS + at.m;
      this.p.fromArray(P, k * 3);
      this.q.fromArray(N, k * 3);
      if (this.q.dot(this.side) < 0) this.q.negate();
      this.r.set(0, -1, 0).addScaledVector(this.q, this.q.y * (1 - hanging));
      if (this.r.lengthSq() < 0.05) this.r.set(Math.cos(at.turn), -0.2, Math.sin(at.turn));
      this.r.normalize();
      this.flat.crossVectors(this.q, this.r).normalize();
      const afloat = F[k];
      for (let m = 0; m < WEED_POINTS; m++) {
        const f = m / (WEED_POINTS - 1);
        const wave = Math.sin(f * 3.2 + at.turn + time * 0.8) * 0.14 * f * at.length;
        this.t.copy(this.p).addScaledVector(this.r, f * at.length).addScaledVector(this.flat, wave).addScaledVector(this.q, 0.05);
        this.setPoint(l, m, this.t, 0.12 * (0.45 + 0.75 * Math.sin(Math.PI * (0.15 + f * 0.7))) * (1 - f * 0.4), afloat, 1);
      }
      this.tangents(l);
    }
  }

  /** Strands of weed caught in it: lying down the skin, hanging under the lifted mesh, trailing on the water. */
  private drawWeed(): void {
    const time = this.clock;
    const P = this.pos.array as Float32Array;
    const N = this.normals.array as Float32Array;
    const A = this.afloat.array as Float32Array;
    for (let w = 0; w < WEEDS; w++) {
      const at = this.weedAt[w];
      const l = this.weedLines[w];
      const k = at.v;
      this.p.fromArray(P, k * 3);
      this.q.fromArray(N, k * 3);
      const afloat = A[k];
      // Weed trails down the skin or along the water after the net is peeled away.
      this.r.set(0, -1, 0).addScaledVector(this.q, this.q.y).normalize();
      if (this.r.lengthSq() < 0.5) this.r.set(Math.cos(at.turn), 0, Math.sin(at.turn));
      this.r.lerp(this.t.set(Math.cos(at.turn), 0, Math.sin(at.turn)), afloat).normalize();
      this.flat.crossVectors(this.q, this.r).normalize();
      for (let m = 0; m < WEED_POINTS; m++) {
        const f = m / (WEED_POINTS - 1);
        const wave = Math.sin(f * 3.2 + at.turn + time * 0.7) * 0.16 * f * at.length;
        this.t.copy(this.p).addScaledVector(this.r, f * at.length).addScaledVector(this.flat, wave).addScaledVector(this.q, 0.03);
        if (afloat) this.t.y = THREE.MathUtils.lerp(this.t.y, 0.02, afloat);
        this.setPoint(l, m, this.t, 0.11 * (0.45 + 0.75 * Math.sin(Math.PI * (0.15 + f * 0.7))) * (1 - f * 0.4), afloat, 1);
      }
      this.tangents(l);
    }
  }
}
