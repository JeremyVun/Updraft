import * as THREE from 'three';
import type { Shot } from '../camera';
import { screenBrush } from '../creatures/motion';
import type { Net, NetGrip } from '../fx/sealife/net';
import { NET } from '../fx/sealife/netShader';
import { DIVE_AT, GOODBYE_AT, SONG_AT, SPOUT_FROM, SPOUT_TO, WAVE_AT, type Skin, type SleepingWhale } from '../fx/sealife/sleeper';
import type { Coax } from '../fx/swirl';
import { tuning } from '../tuning';
import { callLength } from '../audio/whale-voice';
import type { Cast } from './cast';
import { completeObjective } from './cues';
import { surgeAt, swellLift } from '../world/water/swell';
import { mirrorWater } from '../world/sky-mirror-layout';
import { BOW_Z, MAST_TOP, MAST_Z, SAIL_SPAN, SAIL_TACK, STERN_Z, gunwale, gunwaleHalf, stationU } from '../traveller/boat/form';

const K = tuning.netWhale;
/** Its saves, in the order they are taken. */
const WHALE_SAVES = ['whale-rest', 'whale-breath', 'whale-eye', 'whale-line', 'whale-heave', 'whale-flipper'];

/**
 * The encounter's steps, in order. `approach` until the boat is at rest beside its head; `breath`, `eye`, `line`,
 * `heave` and `flipper` are what the net asks of the player, the child and the cygnet; `free` from its spout until it
 * has gone under; `gone` once the boat may sail on.
 */
export type WhaleStep = 'approach' | 'breath' | 'eye' | 'line' | 'heave' | 'flipper' | 'free' | 'gone';
export const WHALE_STEPS: readonly WhaleStep[] = ['approach', 'breath', 'eye', 'line', 'heave', 'flipper', 'free', 'gone'];
/**
 * Seconds the empty net takes to drift away once the loop is off, working loose into a raft by the spout; and seconds
 * into its going free over which the raft sinks away into the deep, gone before it dives.
 */
const DRIFT_FROM = 1;
const DRIFT_TO = 24;
const SINK_FROM = SPOUT_TO;
/**
 * Free, in seconds: her eyes on its eye as it sings, then up into its mist coming down over her, and the cygnet calling
 * back to its song; then her eyes on its flipper as it waves, both her arms up waving back from `WAVE_BACK` until
 * it dives, and the cygnet calling with her.
 */
const MIST_LOOK = SONG_AT + 2.3;
const ANSWER_AT = SONG_AT + 3.3;
const FIN_LOOK = WAVE_AT + 0.6;
const WAVE_BACK = WAVE_AT + 2;
const CALL_WITH = GOODBYE_AT + 0.8;
/** About how long before it goes free the loop is let go, as the cygnet swims back and is lifted in (s). */
const FREED_BEFORE = 7.5;
const SINK_TO = DIVE_AT - 1;
/**
 * The valve's dolphin leaps from this far out on the near side of the blowhole, over the crown and down beyond it;
 * the last stretch of its run in rises straight along its leap for `RUN_UP` seconds.
 */
const LEAP_OUT = 14;
const RUN_UP = 0.35;
const LEAP_DOWN = 1.6;
/** How far out from the pod's anchor the bow is when it lets the boat come to rest alone (m). */
const POD_PARTS = 22;
/**
 * Where the pod waits while the boat does, in metres to port and ahead of the boat at rest: circling slowly behind
 * the camera, `POD_WAIT_RADIUS` across at `POD_WAIT_PACE` metres a second.
 */
const POD_WAIT = new THREE.Vector2(24, -18);
const POD_WAIT_RADIUS = 8;
const POD_WAIT_PACE = 2;
/**
 * The pod's way round as the whale spouts free, from wherever it is waiting behind the camera: up the port side past
 * the floating net and across just ahead of the bow, near enough that the camera sees its leaps against the water
 * rather than the whale's flank, and away along the flank to starboard, at `POD_PACE` metres a second with its lanes
 * drawn in by `POD_SPREAD`.
 */
const POD_WAY = [new THREE.Vector2(18, -2), new THREE.Vector2(10, 2), new THREE.Vector2(0, 5), new THREE.Vector2(-12, 7.5),
  new THREE.Vector2(-40, 22)];
const POD_PACE = 5.5;
/**
 * As it spouts, three of the pod leap clear round its head and catch the sun. Each leaves the water `along` metres
 * from the eye toward the snout (tailward when negative) and `out` metres from it toward the boat, leaps `run`
 * metres toward the snout (tailward when negative), `high` up at the top, `at` seconds into its going free, after
 * `SALUTE_SWIM` seconds in under from the pod. They are lent in slots of their own, clear of the valves' slot 0.
 */
const SALUTES = [
  { along: 11, out: 5, run: 6, high: 2.6, at: 6.2 },
  { along: -6, out: 7, run: 5.5, high: 2.3, at: 6.4 },
  { along: -20, out: 8.5, run: -6, high: 2.5, at: 6.6 },
];
const SALUTE_SWIM = 3;
const POD_SPREAD = 0.35;
/** Seconds the child holds a point toward a breath she knows is coming. */
const POINT_FOR = 3.6;
/**
 * Where she takes the line, in the boat's own frame (x to port, y up from its origin, z forward): coming up out of
 * the water into her outer mitten just outside the rail, through the inner one in toward her, and down in a coil on
 * the boards at her feet. `REACH_FROM`/`REACH_TO` bound where a cork is within her reach, and `REACH_HANDS` how far
 * out over the rail and down toward the water her mittens can go for it.
 */
const RAIL = new THREE.Vector3(1.05, 0.62, 0.1);
const INBOARD = new THREE.Vector3(0.55, 0.74, -0.05);
const COIL_AT = new THREE.Vector3(0.42, -0.17, 0.45);
const REACH_FROM = new THREE.Vector2(0.85, -0.9);
const REACH_TO = new THREE.Vector2(2.1, 1.4);
const REACH_HANDS = { out: 1.1, low: 0.45, back: -0.1, ahead: 0.35 };
/**
 * Seconds her mittens take to go down to the cork, and to bring it up to the rail once they have it; and after how
 * long leaning out she takes the line wherever the cork has come to, so nothing it snags on keeps her reaching.
 */
const REACH_FOR = 0.7;
const REACH_GIVE = 4;
/**
 * How far out from the boat's middle, its heel left out, the cork lies once it has come in against the planking beside
 * her, bobbing (m), and how far beyond the stretch of side her mittens go down over it may lie along the boat.
 */
const AGAINST = 1.32;
const ALONG = 0.25;
const LIFT_FOR = 0.45;
/** The valve's dolphin, nosing in: how near behind the cork its beak keeps, and how long it takes to turn away and go under. */
const NOSE_GAP = 0.3;
const NOSE_AWAY = 2.6;
/** Where along the flipper a sweep is looked for (0 root .. 1 tip), at how many points. */
const FIN_FROM = 0.35;
const FIN_TO = 1.02;
const FIN_STEPS = 9;
/**
 * The cygnet's way into the water from the satchel on its own side and round the stern to port, in the boat's own
 * frame (x to port, z forward); how near each waypoint it comes before making for the next, and how near the loop's
 * end it comes to take it (m). Each leg of a swim is a few seconds; after `SWIM_GIVE` it goes on from wherever it is,
 * so nothing in the water keeps it from the loop or from her.
 */
const ROUND_STERN = [new THREE.Vector3(-1.75, 0, -0.9), new THREE.Vector3(-1.3, 0, -2.5), new THREE.Vector3(1.3, 0, -2.5),
  new THREE.Vector3(2.1, 0, -0.8)];
const WAY_NEAR = 0.8;
const TAKES_AT = 0.3;
const SWIM_GIVE = 12;
/** Seconds it holds on as the loop comes free, backing off this far from it (m), and turning for the boat after. */
const PULL_FOR = 1.2;
const PULL_BACK = 0.8;
const LET_GO = 0.9;
/** Coming back: the water beside her it swims to, out from her seat (m); seconds on her side before she lifts it in. */
const BESIDE_WATER = 1.35;
const ON_THE_SIDE = 1.6;
const LIFTED_IN = 0.8;
/**
 * The flipper's valve dolphin: where along the flipper it comes up under it, how far under it its beak keeps (m), and
 * how long it rides up with it.
 */
const NUDGE_AT = 0.8;
const NUDGE_GAP = 0.45;
const NUDGE_FOR = 1.4;
const UP = new THREE.Vector3(0, 1, 0);
/** How high over the water the crossing's lens is held (m), as the camera holds any shot that does not say. */
const CROSSING_CLEARANCE = 2.8;

/** Where the dolphins are asked to run this frame, for `SeaLife.dolphinsWith`. */
export interface PodRun {
  near: THREE.Vector3 | null;
  heading: number;
  camera: number;
  busy: boolean;
  ready: boolean;
  lead: number;
  leaps: boolean;
  spread: number;
}

/**
 * The whale in the net, as the open sea plays it. It lies across the way from the start, a long low island in the
 * sunrise haze that breathes; once the pod has nudged the boat it leads it off its line, and the boat eases to rest
 * beside its head. The steps go in order, each started by `goTo`. Free, it spouts, rolls onto its back and lifts its
 * flukes as if waving, and goes under; the boat is let go the way it was held, and the pod goes with the whale.
 */
export class NetWhale {
  step: WhaleStep = 'approach';
  /** Seconds in the current step. */
  stepTime = 0;
  /** Where the boat comes to rest, and the way it faces there. */
  readonly rest = new THREE.Vector3();
  readonly yaw: number;
  /** The speed limit holding the boat, eased to nothing as it comes alongside and let go again after. */
  limit = Infinity;
  /** How far the crossing's view has given way to the hold beside it, 0..1. */
  hold = 0;
  /** How far the crossing's view has turned to look past the pod leading the boat in, 0..1. */
  private rise = 0;
  /** How far the child has turned on her seat toward it, radians. */
  turn = 0;
  /** How far the sea's score has thinned, 0..1: to almost nothing in its sorrow, a little way back once it knows her. */
  hush = 0;
  /** The pod has nudged the boat and now leads it; from here the encounter says where the dolphins run. */
  led = false;
  /** How many times it has sighed in the mist ahead as the boat is led in, heard and then its blow seen, and when it was heard. */
  private sighs = 0;
  private heard = 0;
  /** How far the patch of net over the blowhole has been lifted clear by circling, or by the valve's dolphin, 0..1. */
  progress = 0;
  /** What lifted it: the player's circles, or the dolphin sent once nothing had for a long while. */
  liftedBy: 'circles' | 'dolphin' | null = null;
  /** Seconds since the valve's dolphin was sent for, or -1. */
  valveT = -1;
  private readonly dir = new THREE.Vector2();
  private still = 0;
  /** Seconds at rest in a step without progress, toward its valve. */
  private waiting = 0;
  /** Seconds the step's gesture has been asked for, and since a stroke last landed on what it asks for. */
  private askedFor = 0;
  private sinceStroke = Infinity;
  /** Which step's valve dolphin is out, until it has gone back to the pod. */
  private valveStep: WhaleStep | null = null;
  private released = -1;
  private rested = false;
  private rewarded = false;
  private nextWave = 0;
  private wavingGoodbye = false;
  /** How far she has gone to the port rail to wave it goodbye, 0..1. */
  private railward = 0;
  /** When she began pointing toward its breath, or -1. */
  private pointing = -1;
  private nextPoint = 0;
  private knew = false;
  private reached = false;
  private spotted = false;
  /** How wet its bared head still is from the net coming off it, 0..1, and how far the net had come off last frame. */
  private wet = 0;
  private peeled = 0;
  private cygnetIn: 'cradle' | 'stowing' | 'satchel' | 'unstowing' | 'swimming' = 'cradle';
  private podGone = false;
  /** The way the pod goes once the whale has, or null to carry on along its way round. */
  private podYaw: number | null = null;
  /** How far round its wait, and how far along its way past the boat, the pod's anchor has come. */
  private waited = 0;
  private escort = 0;
  private readonly wayFrom = new THREE.Vector3();
  private readonly way = [new THREE.Vector3(), ...POD_WAY.map(() => new THREE.Vector3())];
  private readonly wayLengths = new Float32Array(POD_WAY.length);
  private wayLaid = false;
  private camera: THREE.PerspectiveCamera | null = null;
  private readonly asking: Coax = { at: new THREE.Vector3(), urgency: K.coaxUrgency, radius: K.coaxRadius, bold: K.coaxBold };
  private readonly anchor = new THREE.Vector3();
  private readonly look = new THREE.Vector3();
  private readonly lookFrom = new THREE.Vector3();
  private readonly p = new THREE.Vector3();
  private readonly a = new THREE.Vector3();
  private readonly b = new THREE.Vector3();
  private readonly forward = new THREE.Vector3();
  /** What the release keeps in frame besides her and the spout: its eye and its waving flipper. */
  private readonly freeing = [new THREE.Vector3(), new THREE.Vector3()];
  private readonly hull = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  private readonly hullAlone = this.hull.slice(0, 4);
  private readonly subjects: NonNullable<Shot['subjects']> & { tertiary: THREE.Vector3 } = { primary: new THREE.Vector3(),
    secondary: new THREE.Vector3(), tertiary: new THREE.Vector3(), margin: 0.85, extra: 10 };
  /** Seconds since the encounter began. */
  private clock = 0;
  /** How strongly the player's updraft is lifting under the patch right now, eased. */
  private wind = 0;
  private breathed = false;
  private greeted = false;
  /** Through the look between them: the view over her shoulder, its blink, and the cygnet's peep. */
  private looking = false;
  /** The mitten she waves goodbye with: the one on the side of her toward where it went down. */
  private blinked = false;
  private peeped = false;
  private answered = false;
  private calledWith = false;
  private freedAt: number | null = null;
  /** The valve's dolphin: where it left the pod, where it leaves the water, its heading over the crown and its throw. */
  private readonly vFrom = new THREE.Vector3();
  private readonly vLaunch = new THREE.Vector3();
  private readonly vDir = new THREE.Vector3();
  private vYaw = 0;
  private vSpeed = 0;
  private vRise = 0;
  private vAir = 0;
  private vFlung = false;
  private vDone = false;
  /** Where its beak is, while she can see it. */
  private readonly diver = new THREE.Vector3();
  private diverSeen = false;
  /**
   * The line: its near cork out on the water until she can reach it, her mittens going down for it, the haul, and
   * letting it go. `hauledIn` is how much of it her pulls have brought aboard (m).
   */
  haul: 'out' | 'reaching' | 'bracing' | 'heaving' | 'letting' = 'out';
  hauledIn = 0;
  /** What brought the cork to her: the player's sweeps, or the valve's dolphin. */
  broughtBy: 'sweeps' | 'dolphin' | null = null;
  /** How far along the thwart to port she has slid to lean out over the rail (m), and how far she leans out, 0..1. */
  slide = 0;
  private out = 0;
  /** How far she has leant out over the port rail toward its eye as it looks at her, 0..1. */
  private drawn = 0;
  private haulT = 0;
  private hauled = false;
  /**
   * The fold over its eye: how far strokes have lifted it, kept between them; how far it stands lifted now; seconds
   * since it flipped off, or -1, and how far up it stood then; what lifted it; and seconds since its eye came out from
   * under it, or -1.
   */
  fold = 0;
  private foldShown = 0;
  private foldGust = 0;
  foldT = -1;
  private flapFrom = 0;
  foldedBy: 'sweeps' | 'dolphin' | null = null;
  eyeT = -1;
  /**
   * The heave: heaves made, the stroke on its head so far and whether it has made its heave, the heaves asked for that
   * she has still to haul, how far the mesh over its head billows, which mitten pulls this heave, and what made them.
   */
  heaves = 0;
  private heaveSwept = 0;
  private strokeHeaved = false;
  private owed = 0;
  private billow = 0;
  private puller: 0 | 1 = 0;
  heavedBy: 'sweeps' | 'dolphin' | null = null;
  private eyed = false;
  private heaved = false;
  private readonly reach = Array.from({ length: 24 }, () => new THREE.Vector3());
  /** How much further the strokes have asked the cork to come toward her (m), and the way the last one bent it. */
  private corkCome = 0;
  private readonly corkBend = new THREE.Vector3();
  private readonly skin: Skin = { height: 0, normal: new THREE.Vector3() };
  /** Where the near cork lay when the line began: pushed out past it, away from the boat, it settles back. */
  private readonly corkHome = new THREE.Vector3();
  private corkLaid = false;
  /** The line's dolphin: how far behind the cork its beak still is, and when it turned away (s), or -1. */
  private noseGap = 0;
  private noseAway = -1;
  private readonly grip: NetGrip = { by: null, coil: new THREE.Vector3(), out: 0 };
  private readonly catchAt = new THREE.Vector3();
  private readonly inviting = new THREE.Vector3();
  private inviteHeading = 0;
  /** How long the drawn sweep is on screen (half-heights): as long as what it crosses, or 0 to fill the frame. */
  private inviteLength = 0;
  private readonly hand = [new THREE.Vector3(), new THREE.Vector3()];
  private readonly ray = new THREE.Vector3();
  /** The holds the camera eases between: what it was holding when the step changed, what it is going to, and how far. */
  private readonly holdFrom = new Float32Array(14);
  private readonly holdTo = new Float32Array(14);
  private readonly holdNow = new Float32Array(14);
  private readonly holdNext = new Float32Array(14);
  /** The drawn sweep: the encounter's clock when it was last drawn, seconds it has been offered, and how plainly it shows. */
  private sweptAt = 0;
  private sweepT = 0;
  private sweepAlpha = 0;
  /** The view has eased round to the farewell's hold, where it dives. */
  private farewelled = false;
  /** The light lent her in the look and the farewell (`Traveller.lent`), eased in and out with them. */
  private readonly lit = new THREE.Vector3();
  private readonly lending = new THREE.Vector3();
  /** How far round the hold's view is from the crossing's, unwound from frame to frame. */
  private apart: number | null = null;
  /** The world's clock this frame, for the swell under the boat. */
  private now = 0;
  private holdT = 1;
  private holdSet = false;
  /**
   * The cygnet's second swim: in at once and round the stern to the loop's free end, holding it, pulling it off as
   * the loop comes free, letting go, back to her, up her side, and lifted in.
   */
  bird: 'satchel' | 'out' | 'holding' | 'pulling' | 'letting' | 'back' | 'side' | 'lifted' | 'home' = 'satchel';
  private birdT = 0;
  private wayPoint = 0;
  private stationed = false;
  /** Seconds since the lift that takes the loop off began, or -1; and what lifted it, a sweep or the valve's dolphin. */
  slipT = -1;
  finnedBy: 'sweeps' | 'dolphin' | null = null;
  /** Stroke gathered near the flipper and the bird toward the next lift (normalised device units). */
  private finSwept = 0;
  private nudged = false;
  private finned = false;
  /** Seconds into the leap one of the pod makes as it spouts, or -1 before it, or Infinity once it is back. */
  private caught = 0;
  private readonly salutes = SALUTES.map(() => ({
    t: -1, from: new THREE.Vector3(), launch: new THREE.Vector3(), dir: new THREE.Vector3(), rise: 0, air: 0, speed: 0,
    at: new THREE.Vector3(), ahead: new THREE.Vector3(),
  }));
  private readonly station = new THREE.Vector3();
  private readonly falls = new THREE.Vector3();
  private readonly endRest = new THREE.Vector3();
  private readonly birdEye = new THREE.Vector3();
  private readonly herFace = new THREE.Vector3();
  private readonly mouth = new THREE.Vector3();
  private readonly mitts = [new THREE.Vector3(), new THREE.Vector3()];

  /**
   * Lays the whale beside `rest`, where a boat sailing in from `lead` comes to rest facing the way it came: its eye
   * `tuning.netWhale.eyeDistance` off to port, its length running away into the haze to starboard.
   */
  constructor(private readonly cast: Cast, lead: THREE.Vector2, rest: THREE.Vector2) {
    this.dir.subVectors(rest, lead).normalize();
    this.yaw = Math.atan2(this.dir.x, this.dir.y);
    this.rest.set(rest.x, 0, rest.y);
    const toEye = this.yaw + K.eyeBearing;
    this.p.set(rest.x + Math.sin(toEye) * K.eyeDistance, 0, rest.y + Math.cos(toEye) * K.eyeDistance);
    const whale = this.whale;
    whale.lie(this.p, this.yaw - K.bodyAngle + Math.PI, this.rest);
    whale.onExhale = (strength) => this.net.breathe(strength);
    this.net.drape(this.rest, this.yaw);
    this.net.hull = cast.boat;
    this.net.endRest = this.local(K.endOut, K.endAhead, this.endRest);
    this.local(K.birdOut, K.birdAhead, this.station);
    this.local(POD_WAIT.x + POD_WAIT_RADIUS, POD_WAIT.y, this.wayFrom);
  }

  get whale(): SleepingWhale {
    return this.cast.sealife.sleeper;
  }

  get net(): Net {
    return this.cast.sealife.net;
  }

  /** Moves the encounter on to `step`; what the whale does there begins with it. */
  goTo(step: WhaleStep): void {
    if (step === this.step) return;
    if (step === 'gone') this.cast.sealife.dolphinCatch = 0;
    if (this.step === 'breath') this.breathed = true;
    if (this.step === 'eye') this.eyed = true;
    if (this.step === 'line') this.hauled = true;
    if (this.step === 'flipper') this.finned = true;
    if (this.step === 'eye') this.whale.struggle = 0;
    this.step = step;
    this.stepTime = 0;
    this.waiting = this.askedFor = 0;
    this.sinceStroke = Infinity;
    this.inviteLength = 0;
    // A valve's dolphin still out finishes what it is doing before the next step may send one of its own.
    if (this.valveStep === null) {
      this.valveT = -1;
      this.vDone = this.diverSeen = false;
    }
    // The eye's hold is the look's, already easing in as the column falls.
    if (step !== 'eye' || !this.looking) this.holdFor(step, false);
    const whale = this.whale;
    if (step === 'free') {
      whale.free();
      this.freedAt ??= this.clock;
    }
    if (step === 'gone' && whale.phase !== 'gone') whale.vanish();
  }

  /**
   * Taken at rest beside it before the first step and again after each step (its first full breath, its eye, the
   * cork in her mittens, the heave as she lets the line go, the flipper with the cygnet back in the satchel), each kept
   * until the next, and the last once it has gone and the cygnet is back in her arms, so nothing in between ever falls
   * back to a save before it.
   */
  get checkpoint(): string | null {
    if (this.step === 'gone' && this.cygnetIn === 'cradle' && !this.cast.carry.busy) return 'whale-gone';
    if (this.finned) return 'whale-flipper';
    if (this.heaved) return 'whale-heave';
    if (this.hauled) return 'whale-line';
    if (this.eyed) return 'whale-eye';
    if (this.breathed) return 'whale-breath';
    if (this.step === 'breath' && this.progress === 0 && this.still > 1) this.rested = true;
    return this.rested ? 'whale-rest' : null;
  }

  /**
   * A save at rest finds it lying there still and the boat held; one after its breath finds the patch fallen aside
   * and its eye struggling under the fold; one after its eye finds the fold off and its eye open on her, the cork out
   * on the water; one after the line finds the cork in her mittens before the first heave; one after the heave finds
   * the net off its head into the water and the line let go; one after the flipper finds the net loose on the water,
   * the cygnet in the satchel and the whale free; one from after it has gone finds the way clear.
   */
  restore(point: string): void {
    const after = WHALE_SAVES.indexOf(point);
    if (after >= 0) {
      this.net.finishDraping();
      this.corkLaid = false;
      this.led = true;
      this.rested = true;
      this.waited = 1e-3;
      this.step = 'breath';
      this.stepTime = this.waiting = this.askedFor = this.inviteLength = 0;
      this.sinceStroke = Infinity;
      this.limit = 0;
      this.hold = 1;
      this.turn = this.turnToward();
      this.cygnetIn = this.cast.cygnet.seat === 'satchel' ? 'satchel' : 'cradle';
      if (after >= 1) {
        this.step = 'eye';
        this.progress = 1;
        this.breathed = this.looking = true;
        this.whale.awaken(null);
        this.net.lift = this.net.slump = 1;
      }
      if (after >= 2) {
        this.step = 'line';
        this.eyed = this.greeted = true;
        this.looking = false;
        this.fold = 1;
        this.foldT = this.eyeT = 1e3;
        this.whale.awaken(this.cast.child.position);
      }
      if (after >= 3) {
        this.step = 'heave';
        this.hauled = true;
        this.holdLine();
      }
      if (after >= 4) {
        this.step = 'flipper';
        this.heaved = true;
        this.heaves = K.heaves;
        this.haul = 'letting';
        this.net.grip = null;
        this.net.peel = 1;
      }
      this.farewelled = false;
      this.holdFor(this.step === 'eye' ? 'look' : this.step, true);
      if (point !== 'whale-rest' && this.cast.cygnet.seat === null) {
        this.cast.cygnet.rideIn('satchel');
        this.cygnetIn = 'satchel';
      }
      if (point === 'whale-flipper') {
        this.net.loop = 1;
        this.bird = 'home';
        // Let go as the cygnet came back with it, so it is a raft by the spout as it was.
        this.freedAt = this.clock - FREED_BEFORE;
        if (this.cygnetIn === 'cradle' && !this.cast.cygnet.visible) {
          this.cast.cygnet.rideIn('satchel');
          this.cygnetIn = 'satchel';
        }
        this.goTo('free');
      }
    } else if (point === 'whale-gone') {
      this.led = true;
      this.podGone = true;
      this.whale.vanish();
      this.net.hide();
      this.step = 'gone';
      this.stepTime = 100;
      this.released = 1e3;
      this.rewarded = true;
      this.limit = Infinity;
      this.cygnetIn = 'cradle';
    }
  }

  /** The boat may round its hold waypoint and sail on. */
  get passed(): boolean {
    return this.whale.going;
  }

  /** What the step asks of the player is still to do. */
  private get asks(): boolean {
    if (this.step === 'breath') return this.progress < 1;
    if (this.step === 'eye') return this.foldT < 0;
    if (this.step === 'line') return this.haul === 'out';
    if (this.step === 'heave') return this.haul === 'bracing';
    if (this.step === 'flipper') return this.bird === 'holding' && this.slipT < 0;
    return false;
  }

  /**
   * The whale's drawn gestures show the moment a step is asked, once its hold has settled, and repeat until a stroke
   * lands on what it asks for; they come back a few seconds after the last one.
   */
  private get invites(): boolean {
    return this.asks && this.valveT < 0 && this.askedFor > K.inviteSettle && this.sinceStroke > K.inviteBack;
  }

  /** Circling over the blowhole stands the column there, while the breath is what is asked. */
  get updraftTarget(): THREE.Vector3 | null {
    return this.step === 'breath' && this.remaining() < 8 && this.progress < 1 ? this.whale.blowhole : null;
  }

  get coax(): Coax | null {
    if (this.step !== 'breath' || !this.invites) return null;
    this.asking.at.copy(this.whale.blowhole);
    return this.asking;
  }

  /** The whale draws its own sweeps (`net.gesture`), drawn the moment each is asked; the shared ones draw nothing here. */
  get windInvitation(): THREE.Vector3 | null {
    return null;
  }

  get invitationRadius(): number {
    return 0;
  }

  get invitationHeading(): number | null {
    return null;
  }

  /**
   * Where the drawn sweep is offered now: up across its eye and over its brow; across the cork toward her; from its
   * head toward her as she braces; along the flipper once the cygnet holds the loop's end.
   */
  get offered(): THREE.Vector3 | null {
    return this.step !== 'breath' && this.invites ? this.inviting : null;
  }

  /** The rendered camera, for what a stroke crosses on screen and to draw the sweeps over what they ask for. */
  sees(camera: THREE.PerspectiveCamera): void {
    this.camera = camera;
    this.drawSweep(camera);
  }

  /**
   * The drawn sweep, from its first stroke the moment it is offered, across what the step asks the wind to touch
   * the way the help goes, again and again, large and bold enough to read against the gold sky and the sea.
   */
  private drawSweep(camera: THREE.PerspectiveCamera): void {
    const gesture = this.net.gesture;
    const dt = Math.max(0, this.clock - this.sweptAt);
    this.sweptAt = this.clock;
    const at = this.offered;
    this.sweepT = at ? this.sweepT + dt : 0;
    this.sweepAlpha += ((at ? 1 : 0) - this.sweepAlpha) * (1 - Math.exp(-dt * (at ? 6 : 12)));
    if (!at || this.sweepAlpha < 0.003) {
      gesture.hide();
      return;
    }
    // In front of what it crosses, so the surface never buries it.
    const centre = this.p.subVectors(camera.position, at).normalize().multiplyScalar(K.sweepLift).add(at).project(camera);
    // As long on screen as the frame allows along its heading, slid along it to stay whole in the frame.
    const aspect = camera.aspect;
    const h = this.inviteHeading;
    const ux = Math.cos(h);
    const uy = Math.sin(h);
    const roomX = K.sweepFrame * aspect;
    const length = Math.min(this.inviteLength || K.sweepScreen, (2 * roomX) / Math.max(Math.abs(ux), 1e-3), (2 * K.sweepFrame) / Math.max(Math.abs(uy), 1e-3));
    let x = centre.x * aspect;
    let y = centre.y;
    const half = length / 2;
    x = THREE.MathUtils.clamp(x, -roomX + half * Math.abs(ux), roomX - half * Math.abs(ux));
    y = THREE.MathUtils.clamp(y, -K.sweepFrame + half * Math.abs(uy), K.sweepFrame - half * Math.abs(uy));
    const along = (x - centre.x * aspect) * ux + (y - centre.y) * uy;
    centre.set(centre.x + (along * ux) / aspect, centre.y + along * uy, centre.z).unproject(camera);
    const depth = -this.a.copy(centre).applyMatrix4(camera.matrixWorldInverse).z;
    const span = length * depth * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
    const upward = Math.abs(uy) > Math.abs(ux);
    const cycle = K.sweepFor + K.sweepRest;
    gesture.draw(camera, centre, (this.sweepT % cycle) / K.sweepFor, span, this.sweepAlpha, K.sweepWidth, upward ? 'lift' : 'across', 1,
      upward ? h - Math.PI / 2 : h, K.sweepBold);
  }

  update(dt: number, time: number): void {
    this.clock += dt;
    this.now = time;
    this.stepTime += dt;
    const { boat } = this.cast;
    const whale = this.whale;
    const left = this.remaining();
    const resting = left < 1.5 && boat.speed < 0.2;
    this.still = resting ? this.still + dt : 0;
    if (this.step === 'approach' && this.still > 1) this.goTo('breath');
    // As the pod turns the boat toward it, it is heard in the mist ahead; then, nearer, its blow stands up white over it.
    if (this.led && this.step === 'approach' && this.sighs < 2
      && (this.sighs === 0 || (left < K.seenAt && this.clock - this.heard > K.seenAfter))) {
      // A breath just gone serves for its blow: it never breathes twice in a moment.
      if (this.sighs === 0 || whale.untilSigh < K.breathEvery - K.leadSigh) whale.sighIn(K.leadSigh, this.sighs === 0);
      if (this.sighs === 0) this.heard = this.clock;
      this.sighs++;
    }
    this.sinceStroke += dt;
    // A step is asked once the view has come to its hold.
    this.askedFor = this.asks && this.holdT > K.inviteHeld ? this.askedFor + dt : this.asks ? this.askedFor : 0;
    if (this.valveStep !== null && this.valveStep !== this.step) this.runValve(dt);
    if (this.step === 'breath') this.breathe(dt);
    if (this.step === 'eye') this.openEye(dt);
    if (this.step === 'line') this.haulLine(dt);
    if (this.step === 'heave') this.heave(dt);
    if (this.step === 'flipper') this.lastLoop(dt, time);
    this.drive(dt);
    if (this.step === 'free') this.salute(dt);
    if (this.step === 'free' && whale.spouting && !this.rewarded) {
      this.rewarded = true;
      completeObjective();
    }
    if (this.step === 'free' && whale.phase === 'gone') this.goTo('gone');
    if (this.released < 0 && whale.going) this.released = 0;
    if (this.released >= 0) this.released += dt;
    const approach = this.comingIn(left);
    const freed = this.released >= 0 ? K.release * this.released : 0;
    // Led in, and let go after, it sails no faster than the pod leads, so it comes round into the mirror's jetty gently.
    this.limit = Math.min(Math.max(approach, freed), K.leadSpeed);
    if (this.step !== 'approach' && this.released < 0) this.limit = Math.min(this.limit, approach);
    const near = 1 - THREE.MathUtils.smootherstep(left, K.holdFull, K.holdFrom);
    // Gone, the view goes back to the crossing's in one even ease from wherever the hold is, however the boat turns.
    if (this.step === 'gone') this.hold = Math.min(this.hold, Math.max(0, 1 - this.stepTime / K.handBack));
    else this.hold += ((this.step === 'approach' ? near : 1) - this.hold) * (1 - Math.exp(-dt * K.holdEase));
    const rising = this.led && this.step === 'approach' ? 1 - THREE.MathUtils.smootherstep(left, K.riseNear, K.riseFrom) : 0;
    this.rise += (rising - this.rise) * (1 - Math.exp(-dt * K.riseEase));
    const leaning = (this.step === 'line' && this.haul === 'reaching') || (this.step === 'heave' && this.haul !== 'letting');
    this.out += ((leaning ? 1 : 0) - this.out) * (1 - Math.exp(-dt * (leaning ? 3 : 1.6)));
    const drawing = this.looking && (this.step === 'eye' ? this.eyeT < K.lookFor - K.handOff : whale.time > K.lookIn + 1.6);
    this.drawn += ((drawing ? 1 : 0) - this.drawn) * (1 - Math.exp(-dt * (drawing ? 0.9 : 1.4)));
    const drawn = THREE.MathUtils.smoothstep(this.drawn, 0, 1);
    // As it dives she goes along the thwart to the port rail to wave, out from in front of the mast.
    this.railward += ((this.farewelled && this.step === 'free' ? 1 : 0) - this.railward) * (1 - Math.exp(-dt * K.farewellRailEase));
    this.slide = Math.max(K.haulSlide * THREE.MathUtils.smoothstep(this.out, 0, 1), K.lookSlide * drawn,
      K.farewellSlide * THREE.MathUtils.smoothstep(this.railward, 0, 1));
    let turning = this.step === 'gone' ? 0 : this.turnToward(this.farewelled ? whale.farewell : whale.eye) * (1 - THREE.MathUtils.smootherstep(left, 30, 120));
    // Waving goodbye, she turns her back to the view, a little toward it, so both her arms stand clear of her hood.
    if (this.step === 'free' && whale.time > FIN_LOOK) turning = this.turn + this.toView() + K.goodbyeTurn;
    const toward = THREE.MathUtils.lerp(turning, K.lookTurn, drawn);
    this.turn += (THREE.MathUtils.lerp(toward, K.haulTurn, this.out) - this.turn) * (1 - Math.exp(-dt * 1.2));
    if (this.step === 'free' && whale.diving >= 0 && !this.farewelled) {
      this.farewelled = true;
      this.holdFor('farewell', false);
    }
    const lend = this.looking ? K.lookLight : this.farewelled ? K.farewellLight : null;
    this.lit.lerp(lend ? this.lending.fromArray(lend) : this.lending.set(0, 0, 0), 1 - Math.exp(-dt * K.lightEase));
    this.cast.child.lent.copy(this.lit).multiplyScalar(this.step === 'gone' ? this.hold : 1);
    const move = this.looking ? K.lookMove : this.farewelled ? K.farewellMove : this.step === 'free' ? K.releaseMove : K.holdMove;
    this.holdT = Math.min(1, this.holdT + dt / move);
    whale.seenFrom = this.camera ? this.camera.position.distanceTo(whale.blowhole) : 0;
    const sorrow = this.step === 'approach' ? 1 - THREE.MathUtils.smootherstep(left, K.hushNear, K.hushFrom)
      : (this.step === 'breath' || this.step === 'eye') && !this.greeted ? 1 : this.step === 'free' || this.step === 'gone' ? 0 : K.hushCourage / K.hushSorrow;
    this.hush += (K.hushSorrow * sorrow - this.hush) * (1 - Math.exp(-dt * K.hushEase));
    this.hush = Math.max(this.hush, K.voiceRoom * this.sung());
  }

  /**
   * Where the pod runs while the encounter has it: ahead of the bow leading the boat in, gone under while the boat
   * waits, round the whale's head as it spouts free, and away with it as it goes.
   */
  pod(out: PodRun, dt: number): PodRun {
    const { boat } = this.cast;
    const whale = this.whale;
    out.camera = 1;
    out.busy = false;
    out.ready = false;
    out.lead = 0;
    out.leaps = false;
    out.spread = 1;
    out.heading = boat.yaw;
    out.near = null;
    if (this.step === 'approach') {
      if (this.remaining() > POD_PARTS) {
        out.near = boat.position;
        out.lead = K.podLead;
        // It turns off the boat's line toward the whale ahead of the bow, and the boat follows.
        out.heading = Math.atan2(this.rest.x - boat.position.x, this.rest.z - boat.position.z);
      }
      return out;
    }
    if ((this.step === 'free' && whale.going) || this.step === 'gone' || this.podGone) {
      // The pod goes with it: away over where it went down.
      if (!this.podGone && whale.diving >= 0) this.podYaw = Math.atan2(whale.farewell.x - this.anchor.x, whale.farewell.z - this.anchor.z);
      this.podGone = true;
      out.heading = this.podYaw ?? this.escortYaw();
      out.leaps = this.podYaw !== null;
      return out;
    }
    // It sets off round the whale as the cygnet is lifted in, so it is in the frame as the whale spouts.
    const coming = this.step === 'free' || (this.step === 'flipper' && this.bird === 'lifted');
    if (!coming) {
      // Gone under ahead of the boat as it came to rest, the pod comes back round behind it and waits there.
      if (this.waited === 0 && this.cast.sealife.dolphinsHere) return out;
      this.waited += (dt * POD_WAIT_PACE) / POD_WAIT_RADIUS;
      this.local(POD_WAIT.x + Math.cos(this.waited) * POD_WAIT_RADIUS, POD_WAIT.y + Math.sin(this.waited) * POD_WAIT_RADIUS, this.anchor);
      out.near = this.anchor;
      out.heading = this.yaw - this.waited;
      this.wayFrom.copy(this.anchor);
      return out;
    }
    this.escort = Math.min(1, this.escort + (dt * POD_PACE) / this.wayLength());
    this.wayAt(this.escort, this.anchor);
    out.near = this.anchor;
    out.heading = this.escortYaw();
    out.ready = this.step !== 'free' || whale.time > 1;
    out.leaps = true;
    out.spread = POD_SPREAD;
    // Their leaps are thrown out to the side of the camera, behind the boat.
    out.camera = -1;
    return out;
  }

  /** A point `left` metres to port of the boat at rest and `ahead` metres before it, in the world. */
  private local(left: number, ahead: number, out: THREE.Vector3): THREE.Vector3 {
    return out.set(this.rest.x + Math.sin(this.yaw) * ahead + Math.cos(this.yaw) * left, 0,
      this.rest.z + Math.cos(this.yaw) * ahead - Math.sin(this.yaw) * left);
  }

  /** A point `t` of the way along the pod's way round the whale, from where it was waiting, in the world. */
  private wayAt(t: number, out: THREE.Vector3): THREE.Vector3 {
    const way = this.layWay();
    let along = THREE.MathUtils.clamp(t, 0, 1) * this.wayLength();
    let i = 0;
    while (i < this.wayLengths.length - 1 && along > this.wayLengths[i]) along -= this.wayLengths[i++];
    const u = along / this.wayLengths[i];
    const a = way[Math.max(0, i - 1)];
    const b = way[i];
    const c = way[i + 1];
    const d = way[Math.min(way.length - 1, i + 2)];
    // Catmull-Rom through the waypoints, so the pod turns round its corners rather than at them.
    const u2 = u * u;
    const u3 = u2 * u;
    return out.set(0, 0, 0).addScaledVector(a, -0.5 * u3 + u2 - 0.5 * u).addScaledVector(b, 1.5 * u3 - 2.5 * u2 + 1)
      .addScaledVector(c, -1.5 * u3 + 2 * u2 + 0.5 * u).addScaledVector(d, 0.5 * u3 - 0.5 * u2);
  }

  private wayLength(): number {
    this.layWay();
    let length = 0;
    for (const l of this.wayLengths) length += l;
    return length;
  }

  /** The way's waypoints in the world, laid from wherever the pod was waiting when it set off. */
  private layWay(): THREE.Vector3[] {
    if (!this.wayLaid) {
      this.wayLaid = true;
      this.way[0].copy(this.wayFrom);
      POD_WAY.forEach((p, i) => this.local(p.x, p.y, this.way[i + 1]));
      for (let i = 0; i < this.wayLengths.length; i++) this.wayLengths[i] = Math.max(1e-3, this.way[i].distanceTo(this.way[i + 1]));
    }
    return this.way;
  }

  /** The way the pod swims along its way past the boat, and on as the whale goes. */
  private escortYaw(): number {
    this.wayAt(Math.min(1, this.escort + 0.02), this.forward);
    this.wayAt(Math.max(0, this.escort - 0.02), this.a);
    return Math.atan2(this.forward.x - this.a.x, this.forward.z - this.a.z);
  }

  /**
   * What the two of them do about it, over whatever the crossing had them doing. She knows it before the player
   * does: as it breathes in the haze she leans toward it and points, with the cygnet up in the satchel looking too.
   * At rest she watches the blowhole, and the eye when it opens on her; she leans out for the line and hauls it;
   * free, she waves.
   */
  direct(time: number): void {
    const { child, cygnet, carry } = this.cast;
    const whale = this.whale;
    const left = this.remaining();
    const near = 1 - THREE.MathUtils.smootherstep(left, 40, 160);
    if (this.step === 'gone') {
      child.lean = 0;
      this.stopPointing();
      this.stopWaving();
      if (this.cygnetIn === 'satchel' && this.stepTime > 2 && !carry.busy) {
        this.cygnetIn = 'unstowing';
        carry.unstow(() => (this.cygnetIn = 'cradle'));
      }
      return;
    }
    if (!this.led || near <= 0) return;
    if (this.cygnetIn === 'cradle' && !carry.busy && cygnet.seat === 'cradle') {
      this.cygnetIn = 'stowing';
      carry.stow(() => (this.cygnetIn = 'satchel'));
    }
    if (this.cygnetIn === 'stowing') return;
    const watching = this.watched();
    child.lookAt = watching;
    if (this.cygnetIn === 'satchel') cygnet.watch(watching, true);
    // Looked at, she leans a little toward it.
    const looked = this.eyeT >= 0 ? 0.05 : 0;
    child.lean = (this.step === 'approach' ? 0.18 : THREE.MathUtils.lerp(0.12 + looked, K.lookLean, THREE.MathUtils.smoothstep(this.drawn, 0, 1))) * near;
    if (this.step === 'approach') this.recognise(time);
    else this.stopPointing();
    if (this.step === 'eye') this.answer();
    if (this.step === 'line' || this.step === 'heave') this.haulHands();
    if (this.step === 'flipper') this.watchBird();
    const glad = whale.phase === 'free' && whale.time > SPOUT_FROM && whale.time < ANSWER_AT + 1;
    const thanked = whale.phase === 'free' && whale.time > WAVE_BACK && whale.time < DIVE_AT - 0.5;
    if (this.step === 'free' && (thanked || whale.fluking)) this.waveGoodbye(time);
    else this.stopWaving();
    if (this.step === 'free' && glad && time > this.nextWave) {
      child.wave();
      this.nextWave = time + 2.4;
    }
    if (this.step === 'free' && whale.time > ANSWER_AT && !this.answered && this.cygnetIn === 'satchel') {
      this.answered = true;
      cygnet.call(true);
    }
    if (this.step === 'free' && whale.time > CALL_WITH && !this.calledWith && this.cygnetIn === 'satchel') {
      this.calledWith = true;
      cygnet.call(true);
    }
  }

  /**
   * Her part in the cygnet's swim: watching it with her mittens to her mouth while it is out at the flipper, a mitten
   * down over the side toward it as it comes back, and both to it on the side as she lifts it in. Its eyes are on
   * the loop's end, then the loop, then her.
   */
  private watchBird(): void {
    const { child, cygnet } = this.cast;
    if (this.bird === 'satchel' || this.bird === 'lifted' || this.bird === 'home') return;
    child.lookAt = cygnet.eye(this.birdEye);
    if (this.bird === 'out' || this.bird === 'holding' || this.bird === 'pulling') {
      cygnet.watch(this.bird === 'out' ? this.endRest : this.whale.finTip);
      child.lean = 0.16;
      const mouth = child.breathFrom(this.mouth);
      const ahead = this.mitts[0].subVectors(mouth, child.face(this.mitts[1])).normalize();
      const left = this.mitts[1].crossVectors(UP, ahead).normalize();
      child.reachFor(0, this.hand[0].copy(mouth).addScaledVector(ahead, 0.06).addScaledVector(left, 0.045).addScaledVector(UP, -0.03));
      child.reachFor(1, this.hand[1].copy(mouth).addScaledVector(ahead, 0.075).addScaledVector(left, -0.04).addScaledVector(UP, -0.05));
      return;
    }
    cygnet.watch(child.face(this.herFace));
    child.lean = 0.12;
    if (this.bird === 'side') {
      child.reachFor(0, cygnet.grip('bellyL', this.hand[0]));
      child.reachFor(1, cygnet.grip('bellyR', this.hand[1]));
      return;
    }
    child.reachFor(1, null);
    const near = this.bird === 'back' && Math.hypot(cygnet.position.x - child.position.x, cygnet.position.z - child.position.z) < 2.2;
    child.reachFor(0, near ? this.beside(this.hand[0]).lerp(this.mitts[0].copy(cygnet.position).setY(0.35), 0.45) : null);
  }

  /**
   * Her answer to its eye: her head tipped a little to it, and a mitten held out toward it across the water a while
   * after it blinks, then drawn back as her eyes go to the float line.
   */
  private answer(): void {
    const { child } = this.cast;
    const whale = this.whale;
    const t = this.eyeT;
    const looked = THREE.MathUtils.smoothstep(t, 1, 3) * (1 - THREE.MathUtils.smoothstep(t, K.lookFor - K.handOff, K.lookFor));
    child.tilt = -0.14 * looked;
    const reaching = t > K.reachFrom && t < K.lookFor - K.handOff;
    if (!reaching) {
      if (this.reached) child.reachFor(0, null);
      this.reached = false;
      return;
    }
    this.reached = true;
    // Out over the port rail toward it at the height of her face, so it shows against its flank beside her.
    const { boat } = this.cast;
    child.face(this.a);
    this.b.subVectors(whale.eye, this.a).setY(0).normalize();
    this.ray.set(Math.cos(boat.yaw), 0, -Math.sin(boat.yaw));
    const [port, toward, up] = K.lookReach;
    child.reachFor(0, this.p.copy(this.a).addScaledVector(this.ray, port).addScaledVector(this.b, toward).addScaledVector(UP, up));
  }

  /**
   * She knows it before the player does: a moment before each breath in the haze ahead she sits up straight and
   * holds an arm up toward it; at the first, the cygnet peeks out of the satchel at it too.
   */
  private recognise(time: number): void {
    const { child, cygnet } = this.cast;
    if (this.pointing < 0 && this.whale.untilSigh < K.knowsFirst && time > this.nextPoint && this.inView()) {
      this.pointing = time;
      if (!this.knew && this.cygnetIn === 'satchel') {
        this.knew = true;
        cygnet.does('peer', this.whale.blowhole, K.peekFor);
      }
    }
    if (this.pointing < 0) return;
    // Up straight and leaning toward it, as a child does who has seen something before anyone else.
    child.lean = K.knowsLean;
    if (time - this.pointing > POINT_FOR) {
      this.stopPointing();
      this.nextPoint = time + 4;
      return;
    }
    // An arm's length out and up toward its breath, well above her shoulder.
    child.face(this.a);
    this.b.subVectors(this.whale.blowhole, this.a).setY(0).normalize();
    this.p.copy(this.a).addScaledVector(this.b, 0.55).setY(this.a.y + 0.28);
    child.reachFor(0, this.p);
  }

  /**
   * Her goodbye, as it waves its flipper and as its flukes stand: both arms up in a wide V over her hood, swaying
   * together from side to side, as a child waves to someone going away.
   */
  private waveGoodbye(time: number): void {
    const { child } = this.cast;
    const [out, up, sway, rate] = K.goodbyeWave;
    child.face(this.a);
    // Out to either side as the view sees her, so the V of her arms stands clear of her hood whichever way she sits.
    if (this.camera) this.b.setFromMatrixColumn(this.camera.matrixWorld, 0).setY(0).normalize();
    else this.b.set(Math.cos(this.cast.boat.yaw), 0, -Math.sin(this.cast.boat.yaw));
    const left = child.fromBody(this.p.set(1, 0, 0), this.ray).sub(child.fromBody(this.p.set(0, 0, 0), this.hand[0])).dot(this.b) < 0 ? 1 : -1;
    const swing = sway * Math.sin(time * rate);
    for (const hand of [0, 1] as const) {
      const side = hand === 0 ? -left : left;
      child.reachFor(hand, this.hand[hand].copy(this.a).addScaledVector(this.b, side * out + swing).addScaledVector(UP, up));
    }
    this.wavingGoodbye = true;
  }

  private stopWaving(): void {
    if (this.wavingGoodbye) {
      this.cast.child.reachFor(0, null);
      this.cast.child.reachFor(1, null);
    }
    this.wavingGoodbye = false;
  }

  private stopPointing(): void {
    if (this.pointing >= 0) this.cast.child.reachFor(0, null);
    this.pointing = -1;
  }

  /** The breath is in the haze ahead of her rather than behind the sail. */
  private inView(): boolean {
    const { boat } = this.cast;
    const blow = this.whale.blowhole;
    const bearing = Math.atan2(blow.x - boat.position.x, blow.z - boat.position.z) - boat.yaw;
    return Math.cos(bearing) > 0.2;
  }

  /**
   * What they are both looking at: the breath, the dolphin that lifts the net, the column, the eye, the cork coming
   * in and the dolphin bringing it, the net coming off as she hauls, the spout, the flukes.
   */
  private watched(): THREE.Vector3 {
    const whale = this.whale;
    if (this.diverSeen && this.step !== 'flipper') return this.diver;
    if (this.step === 'line' && (this.haul === 'out' || this.haul === 'reaching')) return this.net.float.position;
    if (this.step === 'heave' && this.haul === 'letting' && this.haulT > K.sheSees) return this.finAt(0.9, this.look);
    // Braced, she looks up at the net on its head, ready; heaving, at where it comes off it.
    if (this.step === 'heave') return this.haul === 'heaving' ? this.net.foot : this.headNet(this.look);
    if (this.step === 'free') {
      if (whale.diving >= 0) return this.farewellLook(whale.diving);
      if (whale.time > FIN_LOOK) return this.look.copy(whale.finTip).lerp(whale.eye, 0.3);
      if (whale.time > MIST_LOOK) return this.look.copy(this.cast.boat.position).lerp(whale.eye, 0.3).setY(4.5);
      if (whale.time > SONG_AT) return whale.eye;
      return this.look.copy(whale.blowhole).setY(whale.blowhole.y + (whale.spouting ? 6 : 1));
    }
    if (this.step === 'eye' && this.eyeT > K.lookFor - K.handOff) return this.net.float.position;
    if (this.step === 'eye') return whale.eye;
    if (this.step === 'breath' && whale.phase === 'woken') {
      if (whale.time > K.lookIn) return whale.eye;
      return this.look.copy(whale.blowhole).setY(whale.blowhole.y + 1 + 2.5 * THREE.MathUtils.smoothstep(whale.time, 1, K.lookIn));
    }
    if (whale.awake) return whale.eye;
    return this.look.copy(whale.blowhole).setY(whale.blowhole.y + 0.6 + this.net.lift * K.netLift * 0.6);
  }

  /**
   * Where their eyes go as it dives, `t` seconds in: its eye going down, then the arch where it bends under, then up
   * with its flukes as they rise.
   */
  private farewellLook(t: number): THREE.Vector3 {
    const whale = this.whale;
    const arch = this.a.copy(whale.farewell).setY(3);
    const eye = this.look.copy(whale.eye).setY(Math.max(whale.eye.y, 1.5));
    eye.lerp(arch, THREE.MathUtils.smoothstep(t, 2.5, 6));
    return eye.lerp(arch.copy(whale.farewell).setY(Math.max(3, whale.flukes.y * 0.75)), whale.flukesShown);
  }

  /**
   * The breath: circling over the blowhole lifts the patch of net off it, and what the wind has lifted stays lifted.
   * Clear, it draws its first full breath up through the spiral; as the column falls its lid struggles under the fold
   * over its eye, the view comes in over her shoulder, and its eye is what is asked. Left a long while with nothing
   * lifted, a dolphin does it.
   */
  private breathe(dt: number): void {
    const whale = this.whale;
    if (this.progress >= 1) {
      if (this.valveStep === 'breath') this.valve(dt);
      this.wind += -this.wind * (1 - Math.exp(-dt * 2));
      if (whale.phase === 'resting') whale.drawBreath();
      if (whale.phase !== 'woken') return;
      if (whale.time > K.struggleFrom) whale.struggle = K.eyeTry;
      if (!this.looking && whale.time > K.lookIn) {
        this.looking = true;
        this.holdFor('look', false);
      }
      if (whale.time > K.eyeAsk) this.goTo('eye');
      return;
    }
    if (this.still > 0) this.waiting += dt;
    const { input } = this.cast;
    let lifting = 0;
    if (input.present && !input.muted) {
      const over = 1 - THREE.MathUtils.smoothstep(Math.hypot(input.updraftAt.x - whale.blowhole.x, input.updraftAt.z - whale.blowhole.z),
        K.reach * 0.5, K.reach);
      lifting = THREE.MathUtils.smoothstep(input.charge, K.liftFrom, K.liftFull) * over;
      if (lifting > 0.02) {
        this.progress = Math.min(1, this.progress + K.liftRate * lifting * dt);
        this.liftedBy ??= 'circles';
        this.waiting = this.sinceStroke = 0;
      }
    }
    this.wind += (lifting - this.wind) * (1 - Math.exp(-dt * 3));
    if (this.valveStep === 'breath' || (this.valveT < 0 && this.waiting > K.valveAfter)) this.valve(dt);
    whale.stir = this.progress;
  }

  /**
   * The eye: its lid struggles under the heavy fold of net and weed lying across it. A stroke over or near it lifts
   * the fold, part way for a weak one, sagging back a little after; enough, and the fold flips up and over off the
   * brow in one wet sheet, its eye opens wide and finds her, and the look between them holds before the line. Left a
   * long while with the fold on, a dolphin noses it off.
   */
  private openEye(dt: number): void {
    const whale = this.whale;
    this.foldGust *= Math.exp(-dt * K.foldEase);
    if (this.foldT < 0) {
      if (this.still > 0) this.waiting += dt;
      this.brushFold(dt);
      if (this.valveStep === 'eye' || (this.valveT < 0 && this.waiting > K.valveAfter)) this.noseFold(dt);
      const lifted = this.fold * (K.foldSettle + (1 - K.foldSettle) * this.foldGust);
      this.foldShown += (lifted - this.foldShown) * (1 - Math.exp(-dt * 6));
      whale.struggle = K.eyeTry + K.eyeTryLifted * this.foldShown;
      if (this.fold >= 1) {
        this.foldT = 0;
        this.flapFrom = K.foldPart * this.foldShown;
        this.foldedBy ??= 'sweeps';
        this.net.sound('fold-lift', whale.eye);
      }
    } else {
      this.foldT += dt;
      if (this.valveStep === 'eye') this.noseFold(dt);
      if (this.eyeT < 0 && this.foldT > K.foldOpens) {
        this.eyeT = 0;
        whale.struggle = 0;
      }
    }
    this.inviteEye();
    if (this.eyeT >= 0) {
      this.eyeT += dt;
      this.exchange(this.eyeT);
    }
  }

  /** Stroke landing this frame within `radius` of any of `points` on screen, weighted by how near (normalised device units). */
  private landed(radius: number, points: readonly THREE.Vector3[], count = points.length): number {
    const { input } = this.cast;
    const camera = this.camera;
    if (!camera || !input.present || input.muted) return 0;
    const moved = Math.hypot((input.ndc.x - input.prevNdc.x) * camera.aspect, input.ndc.y - input.prevNdc.y);
    if (moved < 1e-4) return 0;
    let hit = 0;
    for (let i = 0; i < count; i++) hit = Math.max(hit, screenBrush(camera, points[i], input.prevNdc, input.ndc, radius));
    // Anywhere near the middle of that wide area counts in full.
    return hit > 0.01 ? moved * Math.min(1, 1.6 * Math.sqrt(hit)) : 0;
  }

  /** A stroke in any direction over or near its eye lifts the fold off it, the more the longer the stroke. */
  private brushFold(dt: number): void {
    if (dt <= 0) return;
    const pts = this.reach;
    pts[0].copy(this.whale.eye);
    pts[1].copy(this.net.foldMid);
    pts[2].copy(this.net.foldTip);
    const hit = this.landed(K.foldRadius, pts, 3);
    if (hit <= 0) return;
    this.sinceStroke = this.waiting = 0;
    this.fold = Math.min(1, this.fold + hit / K.foldSweep);
    this.foldGust = 1;
  }

  /**
   * The drawn sweep goes up across the fold from just under its lower edge, over its eye, to the edge it hangs from,
   * and fades on over the brow the way the fold will flip: as long as the fold, so it lies on it rather than the sky.
   */
  private inviteEye(): void {
    const camera = this.camera;
    const net = this.net;
    const from = this.p.copy(net.foldTip).addScaledVector(this.a.subVectors(net.foldTop, net.foldTip), -K.eyeSweepUnder);
    const to = this.b.copy(net.foldTop);
    this.inviting.addVectors(from, to).multiplyScalar(0.5);
    if (!camera) return;
    from.project(camera);
    to.project(camera);
    const across = (to.x - from.x) * camera.aspect;
    this.inviteHeading = Math.atan2(to.y - from.y, across);
    this.inviteLength = Math.hypot(across, to.y - from.y);
  }

  /** Whichever valve dolphin is out, carried on to its end once its own step has passed. */
  private runValve(dt: number): void {
    const s = this.valveStep;
    if (s === 'breath') this.valve(dt);
    else if (s === 'eye') this.noseFold(dt);
    else if (s === 'line') this.noseCork(dt);
    else if (s === 'heave') this.nudgeHead(dt);
    else if (s === 'flipper') this.nudgeFin(dt);
  }

  /** The valve's dolphin has gone back to the pod. */
  private valveDone(): void {
    this.vDone = true;
    this.diverSeen = false;
    this.cast.sealife.handBackDolphin();
    if (this.valveStep !== this.step) {
      this.valveT = -1;
      this.vDone = false;
    }
    this.valveStep = null;
  }

  /**
   * The eye's valve: a dolphin from the waiting pod swims in under the water to beside its head below the eye, rises
   * up out of the sea nose first, catches the fold's lower edge on its beak and lifts it off (the same lift a stroke
   * gives it), and slips back under and away.
   */
  private noseFold(dt: number): void {
    const { sealife } = this.cast;
    const whale = this.whale;
    const p = this.diver;
    if (this.valveT < 0) {
      const from = sealife.lendDolphin();
      if (!from) return;
      this.valveT = 0;
      this.valveStep = 'eye';
      this.vFrom.set(from.x, from.y, from.z);
      this.vDir.subVectors(this.rest, whale.eye).setY(0).normalize();
      // Out from the eye toward the boat to where its flank meets the sea.
      let d = 0;
      while (d < 10 && whale.surfaceAt(whale.eye.x + this.vDir.x * d, whale.eye.z + this.vDir.z * d, this.skin).height > 0.2) d += 0.25;
      this.vLaunch.copy(whale.eye).addScaledVector(this.vDir, d + K.foldNoseOut).setY(0);
    }
    if (this.vDone) return;
    this.valveT += dt;
    const t = this.valveT;
    const yaw = Math.atan2(-this.vDir.x, -this.vDir.z);
    let pitch = 0;
    if (t < K.valveSwim) {
      const u = (t / K.valveSwim) ** 1.4;
      this.a.copy(this.vLaunch).setY(-1.6);
      this.b.copy(this.vLaunch).addScaledVector(this.vDir, 4).setY(-2.6);
      this.forward.copy(this.vFrom).setY(-2.4);
      bezier(this.vFrom, this.forward, this.b, this.a, u, p);
      bezier(this.vFrom, this.forward, this.b, this.a, Math.min(1, u + 0.01), this.ray);
      pitch = Math.atan2(this.ray.y - p.y, Math.hypot(this.ray.x - p.x, this.ray.z - p.z));
      sealife.poseDolphin(p.x, p.y, p.z, Math.atan2(this.ray.x - p.x, this.ray.z - p.z), pitch);
      this.diverSeen = p.y > -0.5;
      return;
    }
    const f = t - K.valveSwim;
    const top = Math.min(1.7, Math.max(0.8, this.net.foldTip.y + 0.15));
    const up = THREE.MathUtils.smootherstep(f, 0, 1.3) * (1 - THREE.MathUtils.smootherstep(f, 2.6, 4));
    p.copy(this.vLaunch).setY(-1.6 + (top + 1.6) * up);
    pitch = 1.25;
    if (f > 0.9 && this.foldT < 0) {
      this.fold = Math.max(this.fold, THREE.MathUtils.smoothstep(f, 0.9, 1.5));
      this.foldGust = 1;
      this.foldedBy ??= 'dolphin';
    }
    this.diverSeen = p.y > -0.5;
    sealife.poseDolphin(p.x, p.y, p.z, yaw, pitch);
    if (f > 4.4) this.valveDone();
  }

  /**
   * The look between them, `t` seconds after its eye came out from under the fold: its eye opens slowly and finds her;
   * it blinks, slowly; it calls, low, as a friend does; the cygnet peeps up from the satchel; then her eyes go to the
   * float line by the boat and the view goes with them to the line.
   */
  private exchange(t: number): void {
    const { cygnet } = this.cast;
    const whale = this.whale;
    whale.look(this.cast.child.position);
    if (!this.blinked && t > K.blinkAt) {
      this.blinked = true;
      whale.blink();
    }
    if (!this.greeted && t > K.callAt) {
      this.greeted = true;
      this.net.sound('whale-call', whale.eye);
    }
    if (!this.peeped && t > K.peepAt && this.cygnetIn === 'satchel') {
      this.peeped = true;
      cygnet.does('peer', whale.eye, K.peekFor);
      cygnet.call(false, 'puzzled');
    }
    if (t > K.lookFor) {
      this.looking = false;
      this.goTo('line');
    }
  }

  /**
   * The valve: a dolphin from the waiting pod swims in under the water, leaps from beside the boat over the whale's
   * crown, catches the mesh on its nose and flicks the patch up off the blowhole, and goes in beyond the head.
   */
  private valve(dt: number): void {
    const { sealife } = this.cast;
    const whale = this.whale;
    if (this.valveT < 0) {
      const from = sealife.lendDolphin();
      if (!from) return;
      this.valveT = 0;
      this.valveStep = this.step;
      this.vFrom.set(from.x, from.y, from.z);
      const blow = whale.blowhole;
      this.vDir.subVectors(whale.eye, blow).setY(0);
      this.vDir.addScaledVector(whale.heading, -this.vDir.dot(whale.heading)).normalize();
      this.vLaunch.copy(blow).addScaledVector(this.vDir, LEAP_OUT).setY(0);
      this.vDir.negate();
      this.vYaw = Math.atan2(this.vDir.x, this.vDir.z);
      const height = blow.y + K.valveClear;
      const up = Math.sqrt((2 * height) / K.valveFall);
      this.vRise = K.valveFall * up;
      this.vSpeed = LEAP_OUT / up;
      this.vAir = 2 * up;
    }
    if (this.vDone) return;
    this.valveT += dt;
    const t = this.valveT;
    const swim = K.valveSwim;
    const p = this.diver;
    let pitch = 0;
    let yaw = this.vYaw;
    if (t < swim) {
      // In under the water from the pod to the foot of its leap, gathering speed, rising along it at the end.
      const u = (t / swim) ** 1.6;
      this.a.copy(this.vLaunch).addScaledVector(this.vDir, -this.vSpeed * RUN_UP).setY(-this.vRise * RUN_UP);
      this.b.copy(this.a).addScaledVector(this.vDir, -6).setY(-2.6);
      this.forward.copy(this.vFrom).setY(-2.2);
      bezier(this.vFrom, this.forward, this.b, this.a, u, p);
      bezier(this.vFrom, this.forward, this.b, this.a, Math.min(1, u + 0.01), this.lookFrom);
      yaw = Math.atan2(this.lookFrom.x - p.x, this.lookFrom.z - p.z);
      pitch = Math.atan2(this.lookFrom.y - p.y, Math.hypot(this.lookFrom.x - p.x, this.lookFrom.z - p.z));
    } else {
      const f = t - swim - RUN_UP;
      p.copy(this.vLaunch).addScaledVector(this.vDir, this.vSpeed * f);
      let rise: number;
      if (f < 0) {
        p.y = this.vRise * f;
        rise = this.vRise;
      } else if (f < this.vAir) {
        p.y = this.vRise * f - 0.5 * K.valveFall * f * f;
        rise = this.vRise - K.valveFall * f;
      } else {
        const x = Math.min(f - this.vAir, LEAP_DOWN) / LEAP_DOWN;
        p.y = -this.vRise * LEAP_DOWN * 0.5 * (1 - (1 - x) ** 2);
        rise = -this.vRise * (1 - x);
      }
      pitch = Math.atan2(rise, this.vSpeed);
      this.flick(p);
      if (f > this.vAir + LEAP_DOWN) {
        this.valveDone();
        return;
      }
    }
    this.diverSeen = p.y > -0.5;
    sealife.poseDolphin(p.x, p.y, p.z, yaw, pitch);
  }

  /** Three of the pod, lent for a moment, leap round its head as it spouts, and go back to them. */
  private salute(dt: number): void {
    const { sealife } = this.cast;
    const whale = this.whale;
    this.caught += ((this.salutes.some((s) => s.t >= 0 && s.t < Infinity) ? 1 : 0) - this.caught) * (1 - Math.exp(-dt * 1.5));
    sealife.dolphinCatch = this.caught;
    SALUTES.forEach((leap, i) => {
      const s = this.salutes[i];
      const slot = i + 1;
      if (s.t === Infinity) return;
      if (s.t < 0) {
        if (whale.phase !== 'free' || whale.time < leap.at - SALUTE_SWIM - RUN_UP) return;
        const from = sealife.lendDolphin(slot);
        if (!from) {
          s.t = Infinity;
          return;
        }
        s.t = 0;
        s.from.set(from.x, from.y, from.z);
        this.fromEye(leap.along, leap.out, s.launch);
        s.dir.subVectors(this.fromEye(leap.along + leap.run, leap.out, this.b), s.launch).setY(0);
        const run = s.dir.length();
        s.dir.normalize();
        const up = Math.sqrt((2 * leap.high) / K.valveFall);
        s.rise = K.valveFall * up;
        s.air = 2 * up;
        s.speed = run / s.air;
      }
      s.t += dt;
      const t = s.t;
      const p = s.at;
      let yaw = Math.atan2(s.dir.x, s.dir.z);
      let pitch = 0;
      if (t < SALUTE_SWIM) {
        const u = (t / SALUTE_SWIM) ** 1.4;
        this.a.copy(s.launch).addScaledVector(s.dir, -s.speed * RUN_UP).setY(-s.rise * RUN_UP);
        this.b.copy(this.a).addScaledVector(s.dir, -5).setY(-1.8);
        this.forward.copy(s.from).setY(-2.2);
        bezier(s.from, this.forward, this.b, this.a, u, p);
        bezier(s.from, this.forward, this.b, this.a, Math.min(1, u + 0.01), s.ahead);
        yaw = Math.atan2(s.ahead.x - p.x, s.ahead.z - p.z);
        pitch = Math.atan2(s.ahead.y - p.y, Math.hypot(s.ahead.x - p.x, s.ahead.z - p.z));
      } else {
        const f = t - SALUTE_SWIM - RUN_UP;
        p.copy(s.launch).addScaledVector(s.dir, s.speed * f);
        let rise: number;
        if (f < 0) {
          p.y = s.rise * f;
          rise = s.rise;
        } else if (f < s.air) {
          p.y = s.rise * f - 0.5 * K.valveFall * f * f;
          rise = s.rise - K.valveFall * f;
        } else {
          const x = Math.min(f - s.air, LEAP_DOWN) / LEAP_DOWN;
          p.y = -s.rise * LEAP_DOWN * 0.5 * (1 - (1 - x) ** 2);
          rise = -s.rise * (1 - x);
        }
        pitch = Math.atan2(rise, s.speed);
        if (f > s.air + LEAP_DOWN) {
          s.t = Infinity;
          sealife.handBackDolphin(slot);
          return;
        }
      }
      sealife.poseDolphin(p.x, p.y, p.z, yaw, pitch, slot);
    });
  }

  /** A point on the water `along` metres from the eye toward the snout and `out` metres from it toward the boat. */
  private fromEye(along: number, out: number, target: THREE.Vector3): THREE.Vector3 {
    const eye = this.whale.eye;
    const h = this.whale.heading;
    const len = Math.hypot(h.x, h.z) || 1;
    const hx = h.x / len;
    const hz = h.z / len;
    const toward = (this.rest.x - eye.x) * -hz + (this.rest.z - eye.z) * hx > 0 ? 1 : -1;
    return target.set(eye.x + hx * along - hz * out * toward, 0, eye.z + hz * along + hx * out * toward);
  }

  /** Its beak over the crown catches the mesh and flicks the patch up, which goes on rising after it has passed. */
  private flick(beak: THREE.Vector3): void {
    if (this.progress >= 1) return;
    const blow = this.whale.blowhole;
    const past = (beak.x - blow.x) * this.vDir.x + (beak.z - blow.z) * this.vDir.z;
    if (past > -2.5 && beak.y > blow.y - 0.5) {
      this.progress = Math.max(this.progress, 0.3 * THREE.MathUtils.smoothstep(past, -2.5, 0));
      this.liftedBy ??= 'dolphin';
    }
    if (past > 0) this.vFlung = true;
  }

  /**
   * The flipper. The last loop is round its outer part, out of her reach; the cygnet goes in after it at once and
   * takes the loop's end in its bill. A sweep along the flipper lifts it lazily out of the water; with the end held,
   * the loop slides along it toward the tip as it rises and slips off into the bird's pull as it goes back down.
   * Left a long while with the end held and nothing lifted, a dolphin comes up under the flipper and noses it up.
   */
  private lastLoop(dt: number, time: number): void {
    const { carry } = this.cast;
    const net = this.net;
    if (this.bird === 'satchel' && this.cygnetIn === 'satchel' && !carry.busy) {
      this.cygnetIn = 'swimming';
      this.birdTo('out');
      this.wayPoint = 0;
    }
    if (this.bird !== 'satchel' && this.bird !== 'home') this.swimBird(dt, time);
    const holding = this.bird === 'holding' && this.slipT < 0;
    if (holding && this.still > 0) this.waiting += dt;
    this.brushFin(dt);
    if (this.valveStep === 'flipper' || (this.valveT < 0 && holding && this.waiting > K.valveAfter)) this.nudgeFin(dt);
    if (this.slipT >= 0) {
      const was = net.loop;
      this.slipT += dt;
      const loop = 0.78 * THREE.MathUtils.smootherstep(this.slipT, 0.7, 3.6)
        + 0.22 * THREE.MathUtils.smoothstep(this.slipT, 3.6, K.slipFor);
      if (!net.posed) net.loop = Math.max(net.loop, loop);
      if (was < 0.8 && net.loop >= 0.8) net.sound('loop-slip', this.whale.finTip);
    }
    this.inviteFin();
  }

  /** The drawn strokes go up along the flipper's outer part toward the bird holding the loop, root to tip on screen. */
  private inviteFin(): void {
    const camera = this.camera;
    this.finAt(0.85, this.inviting).lerp(this.cast.cygnet.position, 0.35);
    this.inviting.y = Math.max(this.inviting.y, 0.3);
    if (!camera) return;
    this.finAt(0.45, this.a).project(camera);
    this.finAt(1, this.b).project(camera);
    this.inviteHeading = Math.atan2(this.b.y - this.a.y, (this.b.x - this.a.x) * camera.aspect);
  }

  /** The flipper lifts lazily, if it is not already; with the loop's end in the bill, that lift takes the loop off. */
  private liftFin(by: 'sweeps' | 'dolphin'): boolean {
    if (!this.whale.liftFlipper()) return false;
    if (this.bird === 'holding' && this.slipT < 0) {
      this.slipT = 0;
      this.finnedBy = by;
      this.waiting = 0;
    }
    return true;
  }

  /** A point `t` of the way out along the near flipper (0 root .. 1 tip), as posed this frame. */
  private finAt(t: number, out: THREE.Vector3): THREE.Vector3 {
    return out.copy(this.whale.finRoot).lerp(this.whale.finTip, t);
  }

  /**
   * A stroke in any direction near the flipper's outer part or the cygnet holding the loop's end on screen adds up
   * toward a lift, and what has been stroked stays toward it; enough, and the whale lifts its flipper. The breeze does
   * nothing.
   */
  private brushFin(dt: number): void {
    if (dt <= 0) return;
    const pts = this.reach;
    for (let i = 0; i < FIN_STEPS - 1; i++) this.finAt(FIN_FROM + ((FIN_TO - FIN_FROM) * i) / (FIN_STEPS - 2), pts[i]);
    const out = this.bird !== 'satchel' && this.bird !== 'lifted' && this.bird !== 'home';
    if (out) pts[FIN_STEPS - 1].copy(this.cast.cygnet.position);
    const hit = this.landed(K.finRadius, pts, out ? FIN_STEPS : FIN_STEPS - 1);
    if (hit <= 0) return;
    this.sinceStroke = 0;
    this.finSwept += hit;
    if (this.finSwept > K.finSweep && this.liftFin('sweeps')) this.finSwept = 0;
  }

  /**
   * The cygnet's second swim. It is the same bird that went into the dark for her: it goes in at once on its own
   * side and swims round the stern to the loop's free end, takes it in its bill and tows it out to where it holds it,
   * facing the loop and clear of the flipper; as the loop comes off it backs away with it and lets go, swims back,
   * climbs up her side and is lifted in.
   */
  private swimBird(dt: number, time: number): void {
    const { cygnet, boat, sealife } = this.cast;
    const net = this.net;
    this.birdT += dt;
    if (cygnet.state === 'swimming') {
      cygnet.swimLevel = swellLift(cygnet.position.x, cygnet.position.z, time) * (1 - mirrorWater(cygnet.position.x, cygnet.position.z));
      sealife.swimmerNear(cygnet.position, time);
    }
    const g = boat.group;
    g.updateMatrixWorld();
    const tip = this.forward.copy(this.whale.finTip).setY(0);
    if (this.bird === 'out') {
      const last = this.wayPoint >= ROUND_STERN.length;
      const aim = last ? this.endRest : g.localToWorld(this.a.copy(ROUND_STERN[this.wayPoint]));
      // Its second swim is a sure one: it sits high on the water and its down stays dry enough to show grey.
      cygnet.swimTo(aim, 0.6, 0.3);
      const gap = Math.hypot(aim.x - cygnet.position.x, aim.z - cygnet.position.z);
      const given = this.birdT > SWIM_GIVE;
      if (!last && (gap < WAY_NEAR || given)) {
        this.wayPoint++;
        this.birdT = 0;
      } else if (last && (gap < TAKES_AT || given)) this.birdTo('holding');
    } else if (this.bird === 'holding') {
      net.holder = cygnet;
      net.fallsTo = this.falls.copy(tip).lerp(this.station, 0.55);
      if (!this.stationed && Math.hypot(this.station.x - cygnet.position.x, this.station.z - cygnet.position.z) > 0.25) {
        cygnet.swimTo(this.station);
      } else {
        this.stationed = true;
        this.keepBird(this.station, tip, dt);
      }
      if (net.loop >= 1) this.birdTo('pulling');
    } else if (this.bird === 'pulling') {
      const away = this.b.subVectors(this.station, tip).setY(0).normalize();
      this.a.copy(this.station).addScaledVector(away, PULL_BACK * THREE.MathUtils.smootherstep(this.birdT, 0, PULL_FOR));
      this.keepBird(this.a, tip, dt);
      if (this.birdT > PULL_FOR) {
        net.held = net.fallsTo = net.holder = null;
        this.freedAt = this.clock;
        this.birdTo('letting');
      }
    } else if (this.bird === 'letting') {
      this.keepBird(cygnet.position, this.besideWater(this.a), dt);
      if (this.birdT > LET_GO) this.birdTo('back');
    } else if (this.bird === 'back') {
      const water = this.besideWater(this.a);
      cygnet.swimTo(water);
      if (Math.hypot(water.x - cygnet.position.x, water.z - cygnet.position.z) < 0.45 || this.birdT > SWIM_GIVE) {
        net.sound('swimmer-out', cygnet.position);
        cygnet.bind(0.15);
        this.birdTo('side');
      }
    }
    if (this.bird === 'side') {
      cygnet.perch(this.beside(this.a), boat.yaw - Math.PI / 2);
      if (this.birdT > ON_THE_SIDE) {
        this.cast.child.reachFor(0, null);
        this.cast.child.reachFor(1, null);
        cygnet.rideIn('cradle');
        this.birdTo('lifted');
        this.cast.sealife.cueDolphinLeap();
      }
    } else if (this.bird === 'lifted') {
      if (this.birdT > LIFTED_IN && this.cygnetIn === 'swimming') this.cygnetIn = 'cradle';
      if (this.cygnetIn === 'satchel') {
        this.birdTo('home');
        this.goTo('free');
      }
    }
  }

  private birdTo(phase: NetWhale['bird']): void {
    this.bird = phase;
    this.birdT = 0;
  }

  /** Keeps it paddling gently where it is put, turned to face `toward`, rather than swimming for a place of its own. */
  private keepBird(at: THREE.Vector3, toward: THREE.Vector3, dt: number): void {
    const { cygnet } = this.cast;
    const k = 1 - Math.exp(-dt * 1.5);
    cygnet.position.x += (at.x - cygnet.position.x) * k;
    cygnet.position.z += (at.z - cygnet.position.z) * k;
    cygnet.swimTo(cygnet.position);
    const want = Math.atan2(toward.x - cygnet.position.x, toward.z - cygnet.position.z);
    cygnet.yaw += Math.atan2(Math.sin(want - cygnet.yaw), Math.cos(want - cygnet.yaw)) * (1 - Math.exp(-dt * 2));
  }

  /** On the port side by her seat: the water beside it, and the side of the boat it climbs up onto. */
  private besideWater(out: THREE.Vector3): THREE.Vector3 {
    const { boat } = this.cast;
    return boat.seat(out).add(this.ray.set(Math.cos(boat.yaw), 0, -Math.sin(boat.yaw)).multiplyScalar(BESIDE_WATER)).setY(0);
  }

  private beside(out: THREE.Vector3): THREE.Vector3 {
    const { boat } = this.cast;
    return boat.seat(out).add(this.ray.set(Math.cos(boat.yaw), 0, -Math.sin(boat.yaw)).multiplyScalar(0.82)).setY(boat.position.y + 0.1);
  }

  /**
   * The flipper's valve: a dolphin from the waiting pod swims in deep under the flipper's outer part, comes up under
   * it and noses it up (the same lazy lift a sweep gives it), rides up with it a moment, and turns away under.
   */
  private nudgeFin(dt: number): void {
    const { sealife } = this.cast;
    const p = this.diver;
    if (this.valveT < 0) {
      const from = sealife.lendDolphin();
      if (!from) return;
      this.valveT = 0;
      this.valveStep = this.step;
      this.vFrom.set(from.x, from.y, from.z);
      this.noseAway = -1;
      this.nudged = false;
      this.vDir.subVectors(this.whale.finTip, this.whale.finRoot).setY(0).normalize();
    }
    if (this.vDone) return;
    this.valveT += dt;
    const t = this.valveT;
    const under = this.finAt(NUDGE_AT, this.b);
    under.y -= NUDGE_GAP;
    let yaw = Math.atan2(-this.vDir.x, -this.vDir.z);
    let pitch = 0;
    if (t < K.valveSwim) {
      const u = (t / K.valveSwim) ** 1.4;
      this.a.copy(under);
      this.lookFrom.copy(under).addScaledVector(this.vDir, 3).setY(under.y - 2.6);
      this.forward.copy(this.vFrom).setY(-2.4);
      bezier(this.vFrom, this.forward, this.lookFrom, this.a, u, p);
      bezier(this.vFrom, this.forward, this.lookFrom, this.a, Math.min(1, u + 0.01), this.ray);
      yaw = Math.atan2(this.ray.x - p.x, this.ray.z - p.z);
      pitch = Math.atan2(this.ray.y - p.y, Math.hypot(this.ray.x - p.x, this.ray.z - p.z));
    } else if (!this.nudged || t < K.valveSwim + NUDGE_FOR) {
      if (!this.nudged && this.liftFin('dolphin')) {
        this.nudged = true;
        this.valveT = K.valveSwim;
      }
      p.copy(under);
      pitch = 0.9;
    } else {
      if (this.noseAway < 0) this.noseAway = t;
      const f = Math.min(1, (t - this.noseAway) / NOSE_AWAY);
      p.addScaledVector(this.vDir, 2.4 * dt);
      p.y -= 1.6 * dt * THREE.MathUtils.smoothstep(f, 0, 0.4);
      pitch = THREE.MathUtils.lerp(0.9, -0.5, THREE.MathUtils.smoothstep(f, 0, 0.5));
      yaw = Math.atan2(this.vDir.x, this.vDir.z);
      if (f >= 1) {
        this.valveDone();
        return;
      }
    }
    this.diverSeen = p.y > -0.5;
    sealife.poseDolphin(p.x, p.y, p.z, yaw, pitch);
  }

  /**
   * The line. Its near cork floats a few metres off the port side; a stroke in any direction across it or the line
   * behind it on screen sets it moving toward her, its path bent a little the stroke's way. Within her reach she leans
   * out over the rail and takes the line in both mittens, and the heave begins. Left a long while with the cork out, a
   * dolphin noses it in.
   */
  private haulLine(dt: number): void {
    const { boat, child } = this.cast;
    boat.group.updateMatrixWorld();
    boat.group.localToWorld(this.catchAt.copy(RAIL));
    this.haulT += dt;
    if (this.valveStep === 'line') this.noseCork(dt);
    if (this.haul === 'out') {
      if (this.still > 0) this.waiting += dt;
      this.brushCork(dt);
      this.glideCork(dt);
      this.settleCork(dt);
      if (this.waiting > K.valveAfter && this.valveT < 0) this.noseCork(dt);
      this.invite();
      if (this.withinReach()) {
        this.broughtBy = this.valveStep === 'line' ? 'dolphin' : 'sweeps';
        this.to('reaching');
      }
    } else if (this.haul === 'reaching') {
      this.drawCork();
      if ((this.haulT > REACH_FOR && this.underHands()) || this.haulT > REACH_GIVE) {
        for (const h of [0, 1] as const) boat.group.worldToLocal(child.mitten(h, this.hand[h]));
        this.grip.by = child;
        this.grip.out = this.net.lineLength;
        boat.group.localToWorld(this.grip.coil.copy(COIL_AT));
        this.net.grip = this.grip;
        this.to('bracing');
        this.goTo('heave');
      }
    }
  }

  /** As a save with the cork in her mittens resumes: braced at the rail with the line in both mittens. */
  private holdLine(): void {
    const { boat, child } = this.cast;
    boat.group.updateMatrixWorld();
    this.hand[0].copy(RAIL);
    this.hand[1].copy(INBOARD);
    this.grip.by = child;
    this.grip.out = this.net.lineLength;
    boat.group.localToWorld(this.grip.coil.copy(COIL_AT));
    this.net.grip = this.grip;
    this.out = 1;
    this.to('bracing');
  }

  /**
   * The heave. She hauls, but the net is caught on the knobs of its head; she leans back on the line and it will not
   * come. A stroke in any direction over the net on its head, or over the water between it and the boat, billows the
   * mesh up off the head; while it is up she hauls a long arm's length and the net slides toward the boat, and she
   * braces for the next. The last heave brings it off its head into the water, and she lets the line go. Left a long
   * while braced, a dolphin comes up under the net's edge and lifts it for her.
   */
  private heave(dt: number): void {
    const net = this.net;
    const { boat } = this.cast;
    boat.group.updateMatrixWorld();
    boat.group.localToWorld(this.catchAt.copy(RAIL));
    boat.group.localToWorld(this.grip.coil.copy(COIL_AT));
    this.haulT += dt;
    this.billow *= Math.exp(-dt * K.billowFall);
    if (this.haul !== 'letting') this.brushHead(dt);
    if (this.valveStep === 'heave' || (this.haul === 'bracing' && this.valveT < 0 && this.waiting > K.valveAfter)) this.nudgeHead(dt);
    if (this.haul === 'bracing') {
      if (this.still > 0) this.waiting += dt;
      if (this.owed > 0 && this.haulT > K.braceFor) {
        this.owed--;
        this.heaveNow('sweeps');
      }
      this.inviteHead();
    } else if (this.haul === 'heaving') {
      const w = Math.min(1, this.haulT / K.heaveTime);
      const drawn = THREE.MathUtils.smootherstep(w / K.pullDraw, 0, 1);
      // The mesh stays up off its head while she draws, and comes down as she braces for the next.
      this.billow = Math.max(this.billow, 1 - THREE.MathUtils.smoothstep(w, K.pullDraw, 1));
      this.hauledIn = Math.min(K.heaves, this.heaves + drawn) * K.pullTake;
      this.grip.out = net.lineLength - this.hauledIn;
      if (!net.posed) net.peel = this.hauledIn / (K.heaves * K.pullTake);
      if (w >= 1 && this.heaves < K.heaves) {
        this.heaves++;
        if (this.heaves < K.heaves) this.to('bracing');
      }
      if (this.heaves < K.heaves) return;
      if (this.haulT > K.heaveTime + K.haulHold) {
        this.grip.by = null;
        // Saved before the cygnet goes in: a save written with it in the water would resume it there.
        this.heaved = true;
        this.to('letting');
      }
    } else {
      // The net off its head bares the loop on the flipper: the cygnet sees it first, then she does.
      if (!this.spotted && this.haulT > K.birdSees && this.cygnetIn === 'satchel') {
        this.spotted = true;
        this.cast.cygnet.does('peer', this.finAt(0.9, this.p), K.peekFor);
        this.cast.cygnet.call(false, 'puzzled');
      }
      if (this.haulT > K.letGo) this.goTo('flipper');
    }
  }

  /** The mesh is up off its head: she hauls. */
  private heaveNow(by: 'sweeps' | 'dolphin'): void {
    this.heavedBy ??= by;
    this.waiting = 0;
    this.puller = this.heaves % 2 === 0 ? 0 : 1;
    this.billow = 1;
    this.to('heaving');
    this.net.sound('net-heave', this.headNet(this.a));
    this.net.sound('rope-pull', this.cast.child.mitten(this.puller, this.b), 1);
  }

  /** The net on its head near the boat: between its eye and its crown, a little toward the snout. */
  private headNet(out: THREE.Vector3): THREE.Vector3 {
    const whale = this.whale;
    return out.copy(whale.eye).lerp(whale.blowhole, 0.45).lerp(whale.jaw, 0.2);
  }

  /** A stroke in any direction over the net on its head or the water between it and the boat billows the mesh up. */
  private brushHead(dt: number): void {
    if (dt <= 0) return;
    const whale = this.whale;
    const pts = this.reach;
    // Over the whole of its head between its eye, its crown and its jaw, and on across the water to her.
    let n = 0;
    for (let i = 0; i <= 3; i++) {
      for (let j = 0; i + j <= 3; j++) {
        pts[n++].copy(whale.eye).multiplyScalar(1 - (i + j) / 3).addScaledVector(whale.blowhole, i / 3).addScaledVector(whale.jaw, j / 3);
      }
    }
    pts[n++].copy(this.net.foot);
    for (let i = 1; i < 6; i++) pts[n++].copy(this.net.foot).lerp(this.catchAt, i / 6).setY(0.1);
    this.headNet(pts[n]).lerp(this.net.foot, 0.5);
    const hit = this.landed(K.heaveRadius, pts, n + 1);
    if (hit <= 0) {
      if (this.sinceStroke > K.heaveGap) {
        this.heaveSwept = 0;
        this.strokeHeaved = false;
      }
      return;
    }
    this.sinceStroke = 0;
    this.billow = Math.min(1, this.billow + hit * K.billowGain);
    this.heaveSwept += hit;
    if (this.heaveSwept < (this.strokeHeaved ? K.heaveStroke : K.heaveSweep)) return;
    this.heaveSwept = 0;
    this.strokeHeaved = true;
    this.owed = Math.max(0, Math.min(this.owed + 1, K.heaves - this.heaves - (this.haul === 'heaving' ? 1 : 0)));
  }

  /** The drawn sweep runs from its head toward her, over the water between. */
  private inviteHead(): void {
    const camera = this.camera;
    this.headNet(this.a);
    this.inviting.copy(this.a).lerp(this.catchAt, 0.5).setY(1.2);
    if (!camera) return;
    this.b.copy(this.catchAt).project(camera);
    this.a.project(camera);
    this.inviteHeading = Math.atan2(this.b.y - this.a.y, (this.b.x - this.a.x) * camera.aspect);
  }

  /**
   * The heave's valve: a dolphin from the waiting pod swims in under the water to the net's edge at its head and comes
   * up under it, lifting the mesh on its back as a gust would (so she hauls), and again each time she braces, until
   * the net is off; then it turns away under.
   */
  private nudgeHead(dt: number): void {
    const { sealife } = this.cast;
    const p = this.diver;
    const foot = this.net.foot;
    if (this.valveT < 0) {
      const from = sealife.lendDolphin();
      if (!from) return;
      this.valveT = 0;
      this.valveStep = 'heave';
      this.vFrom.set(from.x, from.y, from.z);
      this.noseAway = -1;
      this.nudged = false;
      this.vDir.subVectors(this.catchAt, foot).setY(0).normalize();
    }
    if (this.vDone) return;
    this.valveT += dt;
    const t = this.valveT;
    const under = this.b.copy(foot).addScaledVector(this.vDir, 1.2);
    let yaw = Math.atan2(-this.vDir.x, -this.vDir.z);
    let pitch = 0;
    if (t < K.valveSwim) {
      const u = (t / K.valveSwim) ** 1.4;
      this.a.copy(under).setY(-1.4);
      this.lookFrom.copy(under).addScaledVector(this.vDir, 4).setY(-2.6);
      this.forward.copy(this.vFrom).setY(-2.4);
      bezier(this.vFrom, this.forward, this.lookFrom, this.a, u, p);
      bezier(this.vFrom, this.forward, this.lookFrom, this.a, Math.min(1, u + 0.01), this.ray);
      yaw = Math.atan2(this.ray.x - p.x, this.ray.z - p.z);
      pitch = Math.atan2(this.ray.y - p.y, Math.hypot(this.ray.x - p.x, this.ray.z - p.z));
    } else if (this.noseAway < 0) {
      const c = (t - K.valveSwim) % K.nudgeEvery;
      const rise = THREE.MathUtils.smootherstep(c, 0, 0.7) * (1 - THREE.MathUtils.smootherstep(c, 1.3, 2.2));
      p.copy(under).setY(-1.4 + 1.5 * rise);
      pitch = 0.7 * (1 - rise) - 0.2;
      if (c < 0.9) this.nudged = false;
      if (c > 0.6 && !this.nudged && this.haul === 'bracing') {
        this.nudged = true;
        this.billow = 1;
        this.heaveNow('dolphin');
      }
      if (this.haul === 'letting' || this.step !== 'heave') this.noseAway = t;
    } else {
      const f = Math.min(1, (t - this.noseAway) / NOSE_AWAY);
      p.addScaledVector(this.vDir, -2 * dt);
      p.y -= 1.4 * dt * THREE.MathUtils.smoothstep(f, 0, 0.4);
      pitch = -0.4;
      yaw = Math.atan2(-this.vDir.x, -this.vDir.z);
      if (f >= 1) {
        this.valveDone();
        return;
      }
    }
    this.diverSeen = p.y > -0.5;
    sealife.poseDolphin(p.x, p.y, p.z, yaw, pitch);
  }

  private to(haul: NetWhale['haul']): void {
    this.haul = haul;
    this.haulT = 0;
  }

  /** The near cork is near enough the rail beside her for her mittens to go down to it. */
  private withinReach(): boolean {
    const local = this.cast.boat.group.worldToLocal(this.a.copy(this.net.float.position));
    return local.x > REACH_FROM.x && local.x < REACH_TO.x && local.z > REACH_FROM.y && local.z < REACH_TO.y;
  }

  /** Where her mittens go down to it: over the cork, as far out and down as she can lean, in the world. */
  private reachPoint(out: THREE.Vector3): THREE.Vector3 {
    const g = this.cast.boat.group;
    const local = g.worldToLocal(out.copy(this.net.float.position));
    local.set(REACH_HANDS.out, REACH_HANDS.low, THREE.MathUtils.clamp(local.z, REACH_HANDS.back, REACH_HANDS.ahead));
    return g.localToWorld(local);
  }

  /**
   * Her reach draws the cork the last little way in along the side, to where it lies against the planking under her
   * outer mitten, wherever her lean and the boat's heel have put it. It is drawn to the planking, never pressed into
   * it, so the line behind it is not hauled in round the bow.
   */
  private drawCork(): void {
    const { boat, child } = this.cast;
    const float = this.net.float;
    const z = THREE.MathUtils.clamp(boat.group.worldToLocal(child.mitten(0, this.b)).z, REACH_HANDS.back, REACH_HANDS.ahead);
    const x = gunwaleHalf(stationU(z)) + NET.float + 0.03;
    const s = Math.sin(boat.yaw), c = Math.cos(boat.yaw);
    const want = this.b.set(boat.position.x + c * x + s * z, 0, boat.position.z - s * x + c * z).sub(float.position).setY(0).multiplyScalar(3);
    if (want.length() > 1.5) want.setLength(1.5);
    float.push(want.sub(float.velocity).setY(0));
  }

  /**
   * The cork has come in against the planking along the stretch of side her mittens go down over: judged from the
   * boat, level, so neither her pose in the wind nor the heel decides whether she takes it.
   */
  private underHands(): boolean {
    const { boat } = this.cast;
    const dx = this.net.float.position.x - boat.position.x, dz = this.net.float.position.z - boat.position.z;
    const s = Math.sin(boat.yaw), c = Math.cos(boat.yaw);
    const along = dx * s + dz * c;
    return dx * c - dz * s < AGAINST && along > REACH_HANDS.back - ALONG && along < REACH_HANDS.ahead + ALONG;
  }

  /**
   * A stroke in any direction across the near cork on screen, or across the line behind it, sets it gliding across
   * the water toward her at once, the further the longer the stroke, its path bent a little the way the stroke goes.
   */
  private brushCork(dt: number): void {
    const { input } = this.cast;
    const camera = this.camera;
    if (!camera || dt <= 0) return;
    const float = this.net.float;
    const pts = this.reach;
    pts[0].copy(float.position);
    for (let i = 1; i < 5; i++) this.net.link(i, pts[i]);
    const hit = this.landed(K.corkRadius, pts, 5);
    if (hit <= 0) return;
    this.sinceStroke = this.waiting = 0;
    this.corkCome = Math.min(K.corkComeMax, this.corkCome + hit * K.corkCome);
    const dx = input.ndc.x - input.prevNdc.x;
    const dy = input.ndc.y - input.prevNdc.y;
    // The stroke's way across the water at the cork: a step along it on screen, followed down onto the water.
    const step = 0.02 / Math.max(Math.hypot(dx, dy), 1e-6);
    this.p.copy(float.position).project(camera);
    this.b.set(this.p.x + dx * step, this.p.y + dy * step, 0.5).unproject(camera).sub(camera.position);
    if (this.b.y > -1e-3) return;
    this.b.multiplyScalar((float.position.y - camera.position.y) / this.b.y).add(camera.position).sub(float.position).setY(0);
    if (this.b.lengthSq() > 1e-8) this.corkBend.copy(this.b.normalize());
  }

  /** What the strokes have asked of the cork, it does: it glides toward her that far, bent a little their way. */
  private glideCork(dt: number): void {
    const float = this.net.float;
    this.corkBend.multiplyScalar(Math.exp(-dt * 1.5));
    if (this.corkCome <= 0) return;
    const toward = this.a.subVectors(this.catchAt, float.position).setY(0).normalize();
    const way = this.b.copy(this.corkBend).addScaledVector(toward, -this.corkBend.dot(toward)).multiplyScalar(K.corkBend).add(toward).normalize();
    const pace = Math.min(K.corkGlide, 0.6 + 1.8 * this.corkCome);
    const more = pace - float.velocity.dot(way);
    if (more > 0) float.push(this.ray.copy(way).multiplyScalar(more * (1 - Math.exp(-dt * 8))));
    this.corkCome = Math.max(0, this.corkCome - Math.max(0.2, float.velocity.dot(toward)) * dt);
  }

  /** Pushed out past where it lay, the weight of the net on its line draws the cork back there, and no nearer. */
  private settleCork(dt: number): void {
    const float = this.net.float;
    const boat = this.cast.boat.position;
    if (!this.corkLaid) {
      this.corkLaid = true;
      this.corkHome.copy(float.position).setY(0);
    }
    const outward = this.a.set(this.corkHome.x - boat.x, 0, this.corkHome.z - boat.z).normalize();
    const out = (float.position.x - this.corkHome.x) * outward.x + (float.position.z - this.corkHome.z) * outward.z;
    if (out <= 0) return;
    const more = (Math.min(K.corkSettle * out, K.corkSettleMax) + float.velocity.dot(outward)) * (1 - Math.exp(-dt * 3));
    if (more > 0) float.push(this.ray.copy(outward).multiplyScalar(-more));
  }

  /** Where the drawn sweep goes: across the cork and on toward her, and which way that is on screen. */
  private invite(): void {
    const camera = this.camera;
    const cork = this.net.float.position;
    this.inviting.copy(cork).lerp(this.catchAt, 0.45).setY(cork.y);
    if (!camera) return;
    this.a.copy(cork).project(camera);
    this.b.copy(this.catchAt).project(camera);
    this.inviteHeading = Math.atan2(this.b.y - this.a.y, (this.b.x - this.a.x) * camera.aspect);
  }

  /**
   * The line's valve: a dolphin from the waiting pod swims in under the water, rises just behind the cork and noses
   * it in to her at an easy pace (the same push a sweep gives it); once she can reach it, it turns away and goes under.
   */
  private noseCork(dt: number): void {
    const { sealife } = this.cast;
    const float = this.net.float;
    const cork = float.position;
    if (this.valveT < 0) {
      const from = sealife.lendDolphin();
      if (!from) return;
      this.valveT = 0;
      this.valveStep = this.step;
      this.vFrom.set(from.x, from.y, from.z);
      this.vDir.subVectors(this.catchAt, cork).setY(0).normalize();
      this.vLaunch.copy(cork).addScaledVector(this.vDir, -K.noseFrom).setY(0);
      this.noseGap = K.noseFrom;
      this.noseAway = -1;
    }
    if (this.vDone) return;
    this.valveT += dt;
    const t = this.valveT;
    const p = this.diver;
    let yaw = Math.atan2(this.vDir.x, this.vDir.z);
    let pitch = 0;
    if (t < K.valveSwim) {
      const u = (t / K.valveSwim) ** 1.4;
      this.a.copy(this.vLaunch).setY(0.02);
      this.b.copy(this.vLaunch).addScaledVector(this.vDir, -5).setY(-1.8);
      this.forward.copy(this.vFrom).setY(-2.2);
      bezier(this.vFrom, this.forward, this.b, this.a, u, p);
      bezier(this.vFrom, this.forward, this.b, this.a, Math.min(1, u + 0.01), this.lookFrom);
      yaw = Math.atan2(this.lookFrom.x - p.x, this.lookFrom.z - p.z);
      pitch = Math.atan2(this.lookFrom.y - p.y, Math.hypot(this.lookFrom.x - p.x, this.lookFrom.z - p.z));
    } else if (this.haul === 'out' && this.noseAway < 0) {
      this.b.subVectors(this.catchAt, cork).setY(0).normalize();
      this.vDir.lerp(this.b, 1 - Math.exp(-dt * 2)).normalize();
      this.noseGap = Math.max(NOSE_GAP, this.noseGap - K.noseSpeed * dt);
      p.copy(cork).addScaledVector(this.vDir, -this.noseGap).setY(0.02);
      yaw = Math.atan2(this.vDir.x, this.vDir.z);
      if (this.noseGap <= NOSE_GAP + 1e-3) {
        const more = K.noseSpeed - float.velocity.dot(this.vDir);
        if (more > 0) float.push(this.ray.copy(this.vDir).multiplyScalar(more));
      }
    } else {
      if (this.noseAway < 0) this.noseAway = t;
      const f = Math.min(1, (t - this.noseAway) / NOSE_AWAY);
      this.b.subVectors(p, this.catchAt).setY(0).normalize();
      this.vDir.lerp(this.b, 1 - Math.exp(-dt * 1.5)).normalize();
      p.addScaledVector(this.vDir, 2.2 * dt);
      p.y = 0.02 - 2.4 * THREE.MathUtils.smoothstep(f, 0.15, 1);
      yaw = Math.atan2(this.vDir.x, this.vDir.z);
      pitch = -0.4 * Math.sin(Math.PI * THREE.MathUtils.smoothstep(f, 0.15, 1));
      if (f >= 1) {
        this.valveDone();
        return;
      }
    }
    this.diverSeen = p.y > -0.5;
    sealife.poseDolphin(p.x, p.y, p.z, yaw, pitch);
  }

  /**
   * Her body on the line: watching the cork come in; leaning out over the port rail for it with both mittens going
   * down to it; hauling it hand over hand, one mitten drawing the line in to her while the other goes back out along
   * it to the rail, rocking back with each pull; then sitting back up once it is let go.
   */
  private haulHands(): void {
    const { child, boat } = this.cast;
    const g = boat.group;
    g.updateMatrixWorld();
    if (this.haul === 'out' || this.haul === 'letting') {
      child.reachFor(0, null);
      child.reachFor(1, null);
      // Let go, she sits back and breathes out.
      const back = this.haul === 'letting' ? THREE.MathUtils.smoothstep(this.haulT, 0.1, 0.7) * (1 - THREE.MathUtils.smoothstep(this.haulT, 1.6, 2.6)) : 0;
      child.lean = THREE.MathUtils.lerp(0.12 + 0.1 * this.out, -0.12, back);
      return;
    }
    if (this.haul === 'reaching') {
      child.lean = K.reachLean * this.out;
      this.reachPoint(this.a);
      this.b.subVectors(this.net.link(1, this.b), this.a).setY(0).normalize();
      child.reachFor(0, this.hand[0].copy(this.a));
      child.reachFor(1, this.hand[1].copy(this.a).addScaledVector(this.b, 0.2).setY(this.a.y + 0.05));
      return;
    }
    // Braced, both mittens on the line and leaning back on it, straining; each heave one long pull hand over hand.
    const heaving = this.haul === 'heaving';
    const w = heaving ? Math.min(1, this.haulT / K.heaveTime) : 0;
    const drawn = THREE.MathUtils.smootherstep(w / K.pullDraw, 0, 1);
    const back = w < K.pullDraw ? drawn : 1 - THREE.MathUtils.smootherstep((w - K.pullDraw) / (1 - K.pullDraw), 0, 1);
    const lift = THREE.MathUtils.smootherstep(this.stepTime / LIFT_FOR, 0, 1);
    child.lean = (K.haulLean - K.braceBack - 0.3 * back + 0.02 * (1 - back) * Math.sin(this.clock * 9)) * this.out;
    const puller = heaving ? this.puller : this.heaves % 2 === 0 ? 0 : 1;
    for (const h of [0, 1] as const) {
      const pulling = h === puller;
      const from = pulling ? RAIL : INBOARD;
      const to = pulling ? INBOARD : RAIL;
      const at = this.a.copy(from).lerp(to, heaving ? drawn : 0);
      at.y += Math.sin(Math.PI * drawn) * (pulling ? 0.08 : 0.18) * (heaving ? 1 : 0);
      if (!pulling && heaving) at.x += Math.sin(Math.PI * drawn) * 0.05;
      g.localToWorld(at.lerp(this.hand[h], 1 - lift));
      child.reachFor(h, at);
    }
  }

  /** The net's four parts, from where the encounter is; its eye on her while it is awake; its goodbye. */
  private drive(dt: number): void {
    const net = this.net;
    const whale = this.whale;
    if (this.vFlung && this.progress < 1) this.progress = Math.min(1, this.progress + K.valveFling * dt);
    const swimming = this.step === 'flipper' && this.bird !== 'satchel' && this.bird !== 'lifted' && this.bird !== 'home';
    if (this.step !== 'breath' && this.step !== 'approach' && this.step !== 'eye' && whale.phase === 'woken') {
      whale.look(swimming ? this.cast.cygnet.position : this.cast.child.position);
    }
    const peeling = (net.peel - this.peeled) / Math.max(dt, 1e-3);
    this.peeled = net.peel;
    this.wet += ((peeling > 0.01 ? 1 : 0) - this.wet) * (1 - Math.exp(-dt * (peeling > 0.01 ? 2 : 0.4)));
    if (this.wet > 0.02 && whale.phase === 'woken') whale.stream(this.wet * THREE.MathUtils.smoothstep(net.peel, 0.1, 0.5), dt);
    if (net.posed) return;
    const held = this.progress >= 1 ? 1 : this.progress * (K.netSettle + (1 - K.netSettle) * this.wind);
    net.lift += (held - net.lift) * (1 - Math.exp(-dt * 2.5));
    // Once its breath has gone up through it, nothing holds the patch up: it falls back loose and slumps aside.
    if (whale.awake) net.slump = Math.max(net.slump, whale.phase === 'woken' ? THREE.MathUtils.smootherstep(whale.time, K.slumpFrom, K.slumpFrom + K.slumpFor) : 1);
    net.updraft = this.wind;
    net.flap = this.foldT >= 0 ? THREE.MathUtils.lerp(this.flapFrom, 1, THREE.MathUtils.smootherstep(this.foldT / K.foldFlip, 0, 1))
      : K.foldPart * this.foldShown;
    net.billow = this.billow;
    if (this.freedAt !== null) net.drift = THREE.MathUtils.smoothstep(this.clock - this.freedAt, DRIFT_FROM, DRIFT_TO);
    if (whale.phase === 'free') net.sink = THREE.MathUtils.smoothstep(whale.time, SINK_FROM, SINK_TO);
  }

  /**
   * The most the boat may make `left` metres short of the rest: way taken off at `slowing` until the hull's own carry
   * can take it the rest of the way, so it comes to rest there in a few seconds without a creep and is never braked.
   */
  private comingIn(left: number): number {
    const carry = tuning.sail.carries, kept = K.slowing / carry, from = K.restShort + kept / carry;
    return left > from ? Math.sqrt(kept * kept + 2 * K.slowing * (left - from)) - kept : 0;
  }

  /** How much of a call it is making now, swelling in and dying away: the score makes room under it. */
  private sung(): number {
    const { called, sinceCall } = this.whale;
    if (!called) return 0;
    const length = callLength(called);
    return THREE.MathUtils.smoothstep(sinceCall, 0, 1) * (1 - THREE.MathUtils.smoothstep(sinceCall, length - 1, length + 1.5));
  }

  /** Sailing distance still to go before the boat is at rest beside it, along the way it comes in. */
  remaining(): number {
    const p = this.cast.boat.position;
    return (this.rest.x - p.x) * this.dir.x + (this.rest.z - p.z) * this.dir.y;
  }

  /** How far round her seat must turn for her to face the way the view looks (radians). */
  private toView(): number {
    if (!this.camera) return 0;
    const { child } = this.cast;
    this.b.setFromMatrixColumn(this.camera.matrixWorld, 2).negate();
    child.fromBody(this.p.set(0, 0, 1), this.a).sub(child.fromBody(this.p.set(0, 0, 0), this.ray));
    const want = Math.atan2(this.b.x, this.b.z) - Math.atan2(this.a.x, this.a.z);
    return Math.atan2(Math.sin(want), Math.cos(want));
  }

  /** The seat turned toward `at` (its eye, unless given), at most 0.6 radians. */
  private turnToward(at = this.whale.eye): number {
    const { boat } = this.cast;
    const bearing = Math.atan2(at.x - boat.position.x, at.z - boat.position.z) - boat.yaw;
    return THREE.MathUtils.clamp(Math.atan2(Math.sin(bearing), Math.cos(bearing)), -0.6, 0.6);
  }

  /**
   * The hold for `step`, eased to over `holdMove` from wherever the camera is holding now, or taken at once: high
   * behind the boat for the breath with the blowhole in reach of a circle, closer and lower for the line with her
   * mittens, the cork and the net coming off its head in frame, and closer and lower again for the flipper. Free,
   * it eases out in one move to the release's, low and wider, the spout leaving the top of the frame.
   */
  private holdFor(step: WhaleStep | 'look' | 'farewell', now: boolean): void {
    const to = this.holdTo;
    const { breath, look, line, flipper, release, farewell } = K.phone;
    if (step === 'look' || step === 'eye') {
      to.set([K.lookDistance, K.lookHeight, K.lookBearing, K.lookLookY, K.lookToward, 0, look.distance, look.height, look.turn,
        look.lookY, look.toward, 1, 1, 0]);
    } else if (step === 'line' || step === 'heave') {
      const back = step === 'heave' ? K.heaveBack : 0;
      to.set([K.lineDistance + back, K.lineHeight, K.lineBearing, K.lineLookY, K.lineToward, 0, line.distance + back, line.height,
        line.turn, line.lookY, line.toward, 0, line.eyeward, 0]);
    } else if (step === 'flipper') {
      to.set([K.flipperDistance, K.flipperHeight, K.flipperBearing, K.flipperLookY, K.flipperToward, 1, flipper.distance,
        flipper.height, flipper.turn, flipper.lookY, flipper.toward, 0, 0, 0]);
    } else if (step === 'farewell' || (step === 'gone' && this.farewelled)) {
      to.set([K.farewellDistance, K.farewellHeight, K.farewellBearing, K.farewellLookY, K.farewellToward, 0, farewell.distance,
        farewell.height, farewell.turn, farewell.lookY, farewell.toward, 0, 0, 1]);
    } else if (step === 'free' || step === 'gone') {
      to.set([K.releaseDistance, K.releaseHeight, K.releaseBearing, K.releaseLookY, K.releaseToward, 0, release.distance,
        release.height, release.turn, release.lookY, release.toward, 0, 0, 0]);
    } else {
      to.set([K.holdDistance, K.holdHeight, K.holdBearing, K.holdLookY, K.holdToward, 0, breath.distance, breath.height,
        breath.turn, breath.lookY, breath.toward, 0, 0, 0]);
    }
    const same = this.holdSet && this.holdNext.every((v, i) => v === to[i]);
    this.holdNext.set(to);
    if (same && !now) return;
    if (now || !this.holdSet) {
      this.holdFrom.set(to);
      this.holdNow.set(to);
      this.holdT = 1;
      this.holdSet = true;
      return;
    }
    this.holdFrom.set(this.holdNow);
    this.holdT = 0;
  }

  /**
   * The boat's bow, the corners of its transom and its masthead, and with `sail` the clew of its sail, joining the
   * framing by `h` from `rest`.
   */
  private wholeBoat(sail: boolean, rest: THREE.Vector3, h: number): THREE.Vector3[] {
    const boat = this.cast.boat;
    const [bow, port, starboard, head, clew] = this.hull;
    boat.group.updateMatrixWorld(true);
    const m = boat.group.matrixWorld;
    bow.set(0, gunwale(1), BOW_Z).applyMatrix4(m);
    port.set(gunwaleHalf(0), gunwale(0), STERN_Z).applyMatrix4(m);
    starboard.set(-gunwaleHalf(0), gunwale(0), STERN_Z).applyMatrix4(m);
    head.set(0, MAST_TOP, MAST_Z).applyMatrix4(m);
    clew.set(-boat.sailSide * SAIL_SPAN * 0.6, SAIL_TACK + 0.4, MAST_Z - SAIL_SPAN * 0.8).applyMatrix4(m);
    for (const p of this.hull) p.lerp(rest, 1 - h);
    return sail ? this.hull : this.hullAlone;
  }

  /**
   * Eases the crossing's view from behind the sail to the step's hold beside the boat: a little to port of astern
   * in landscape, so what the step asks for stands clear of the sail; in portrait on the line from its head through
   * the boat, nearer, so boat, eye and head stack up the frame. Free, it eases back out to see the spout, and
   * glances round to its flukes as they wave.
   */
  frame(shot: Shot): void {
    const h = THREE.MathUtils.smootherstep(this.hold, 0, 1);
    if (!this.holdSet) this.holdFor(this.step, true);
    shot.clearance = undefined;
    // Its holds are composed here, the same however the boat came in.
    shot.authored = h > 0.001;
    // Led off its line, the view comes down and in toward her, so the way she leans toward it reads against the haze,
    // and the look goes on toward the long low island it is making for while the eye stays behind the boat.
    const rise = THREE.MathUtils.smootherstep(this.rise, 0, 1);
    shot.height -= K.leadDrop * rise;
    shot.distance -= K.leadIn * rise;
    this.b.copy(shot.target);
    const phone = (this.camera?.aspect ?? 16 / 9) < 1;
    shot.target.lerp(this.a.copy(this.whale.eye).setY(K.riseLook), (phone ? K.riseTowardPhone : K.riseToward) * rise);
    shot.distance += Math.hypot(shot.target.x - this.b.x, shot.target.z - this.b.z);
    if (h <= 0.001) {
      this.apart = null;
      return;
    }
    // Down beside it the lens sits low over the water, so its back stands against the sky.
    shot.clearance = THREE.MathUtils.lerp(CROSSING_CLEARANCE, K.holdClearance, h);
    const whale = this.whale;
    const boat = this.cast.boat.position;
    const portrait = (this.camera?.aspect ?? 16 / 9) < 1;
    const now = this.holdNow;
    const moved = THREE.MathUtils.smootherstep(this.holdT, 0, 1);
    for (let i = 0; i < now.length; i++) now[i] = THREE.MathUtils.lerp(this.holdFrom[i], this.holdTo[i], moved);
    const [holdDistance, holdHeight, bearing, lookY, toward, fin, phoneDistance, phoneHeight, phoneTurn, phoneLookY, phoneToward, eyeward,
      phoneEyeward, farewell] = now;
    // The head's middle, or its eye: for the look between them, and on a phone for the haul its eye is on; as it dives,
    // where it bends down under and its flukes will rise.
    const head = this.p.copy(whale.eye).lerp(whale.blowhole, 0.5 * (1 - (portrait ? phoneEyeward : eyeward)));
    if (farewell > 0) head.lerp(whale.farewell, farewell);
    // At the flipper what matters lies between its tip and where the cygnet holds the loop's end.
    const focus = this.b.copy(head).lerp(this.a.copy(whale.finTip).lerp(this.station, 0.5), fin).setY(portrait ? phoneLookY : lookY);
    this.look.copy(boat).setY(1.2).lerp(focus, portrait ? phoneToward : toward);
    // Behind the boat: just to port of astern, or in portrait on the line from what matters through the boat.
    // Turned between the head and the flipper by angle rather than through the point between them, which can pass
    // close by the boat and swing the view round fast.
    let aim = this.yaw - bearing;
    if (portrait) {
      this.ray.copy(whale.finTip).lerp(this.station, 0.5);
      const toFin = Math.atan2(this.ray.x - boat.x, this.ray.z - boat.z);
      const toHead = Math.atan2(head.x - boat.x, head.z - boat.z);
      aim = toHead + Math.atan2(Math.sin(toFin - toHead), Math.cos(toFin - toHead)) * fin + phoneTurn;
    }
    const distance = portrait ? phoneDistance : holdDistance;
    const height = portrait ? phoneHeight : holdHeight;
    // The lens rides the sea's own swell with the boat, but not the swell it leaves going under, which lifts the boat.
    this.lookFrom.set(boat.x - Math.sin(aim) * distance, boat.y - surgeAt(boat.x, boat.z, this.now) + height,
      boat.z - Math.cos(aim) * distance);
    this.forward.subVectors(this.lookFrom, this.look).setY(0);
    const reach = this.forward.length();
    this.forward.normalize();
    shot.target.lerp(this.look, h);
    const from = shot.from ?? this.a.set(0, 0, 1);
    const was = Math.atan2(from.x, from.z);
    const want = Math.atan2(this.forward.x, this.forward.z);
    // The crossing's view swings round as the boat comes about: keep turning between the two the same way round
    // rather than flip to the other side as they pass opposite each other.
    let apart = Math.atan2(Math.sin(want - was), Math.cos(want - was));
    if (this.apart !== null) apart = this.apart + Math.atan2(Math.sin(apart - this.apart), Math.cos(apart - this.apart));
    this.apart = apart;
    const turned = was + apart * h;
    shot.from = from.set(Math.sin(turned), 0, Math.cos(turned));
    shot.distance = THREE.MathUtils.lerp(shot.distance, reach, h);
    shot.height = THREE.MathUtils.lerp(shot.height, this.lookFrom.y - this.look.y, h);
    // What the step is about, and its eye, join the travelling pair by degrees.
    const s = this.subjects;
    const pair = shot.subjects;
    // Leaning out over the rail toward its eye, she is where her face is rather than where she sits.
    if (this.looking) this.cast.child.face(s.primary);
    else s.primary.copy(this.cast.child.position).y += 1.2;
    const rest = pair?.secondary ?? s.primary;
    // A phone's narrow frame keeps the net on its head rather than its foot at the cheek, which lies off to the side.
    if (this.step === 'line' && (this.haul === 'out' || this.haul === 'reaching')) s.secondary.copy(this.net.float.position);
    else if (this.step === 'line' || this.step === 'heave') {
      if (portrait) this.headNet(s.secondary);
      else s.secondary.copy(this.net.foot);
    }
    else if (this.step === 'flipper') {
      const out = this.bird !== 'satchel' && this.bird !== 'lifted' && this.bird !== 'home';
      s.secondary.copy(out ? this.cast.cygnet.position : whale.finTip).y += out ? 0.4 : 0;
    } else if (this.looking) s.secondary.copy(whale.eye);
    else s.secondary.copy(whale.blowhole).y += 2.5;
    if (farewell > 0) s.secondary.lerp(this.a.copy(whale.farewell).setY(K.farewellLookY * 0.6), farewell);
    // Going free, what the view keeps in frame moves from the flipper to the spout with the view's own ease.
    const freeing = this.step === 'free' || this.step === 'gone';
    const into = this.step === 'free' ? moved : 1;
    if (into < 1) s.secondary.lerp(whale.finTip, 1 - into);
    // A phone's narrow frame stacks the step over the boat; fitting the eye in beside them would only back it off.
    // Going free the boat comes near and the whale lies across the middle distance, its plume leaving the frame.
    // Diving, its eye goes down into the deep: what it keeps in frame is where it went down, on a phone too.
    if ((portrait && (this.step === 'line' || this.step === 'heave' || this.step === 'flipper')) || (!portrait && freeing) || farewell > 0) {
      s.tertiary.copy(s.secondary);
    }
    else if (this.step === 'heave') this.headNet(s.tertiary);
    else s.tertiary.copy(this.step === 'flipper' ? whale.finTip : whale.eye);
    // Free, its eye stays in the frame with her, and the flipper it waves as it thanks her. On a phone the steps keep
    // the whole hull in, and the haul its sail too; beside the bird there is no room for the sail.
    const whole = portrait && (this.step === 'line' || this.step === 'heave' || this.step === 'flipper');
    s.points = this.step === 'free' && farewell < 1 ? this.freeing : whole ? this.wholeBoat(this.step !== 'flipper', rest, h) : undefined;
    if (s.points === this.freeing) {
      this.freeing[0].copy(whale.eye).lerp(rest, 1 - h);
      this.freeing[1].copy(whale.finTip).lerp(whale.eye, 1 - whale.flipperLift).lerp(rest, 1 - h);
    }
    if (portrait && into < 1) s.tertiary.lerp(whale.finTip, 1 - into);
    s.secondary.lerp(rest, 1 - h);
    s.tertiary.lerp(rest, 1 - h);
    // Each hold is composed as it stands: the look is never backed off, the steps only a little if what they ask for strays.
    s.margin = THREE.MathUtils.lerp(pair?.margin ?? 0.85, this.looking ? 1 : 0.85, h);
    const room = freeing ? THREE.MathUtils.lerp(K.holdRoom, portrait ? K.phone.releaseRoom : K.releaseRoom, into) : K.holdRoom;
    // Handing back, what it held lets go rather than backing the view away from the boat to keep it.
    s.extra = THREE.MathUtils.lerp(pair?.extra ?? (this.step === 'gone' ? 0 : 10), this.looking ? 0 : room, h);
    shot.subjects = s;
  }
}

/** A point `t` of the way along the cubic from `a` to `d` drawn toward `b` and `c`. */
function bezier(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3, t: number, out: THREE.Vector3): THREE.Vector3 {
  const u = 1 - t;
  return out.copy(a).multiplyScalar(u * u * u).addScaledVector(b, 3 * u * u * t).addScaledVector(c, 3 * u * t * t).addScaledVector(d, t * t * t);
}
