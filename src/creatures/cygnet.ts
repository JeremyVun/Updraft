import * as THREE from 'three';
import { heightAt } from '../world/island';
import { ease, easeAngle, wrapAngle } from './motion';
import { tuning } from '../tuning';
import { CallMarks } from '../fx/call-marks';
import type { WindSample } from '../wind/field';
import { BODY, BONES, FOOT_L, FOOT_R, FORE_L, HEAD, HOLDS, REST, ROOT, SIZE, SKELETON, cygnetGeometry } from './cygnet/body';
import { WingBandage } from './cygnet/bandage';
import { Gait } from './cygnet/gait';
import { Mind, type Act, type Senses } from './cygnet/mind';
import { Poser, type Drives } from './cygnet/pose';
import { applyLook, cygnetMaterial, downShells, newLook } from './cygnet/shader';
import { Ride, type Mount, type Seat } from './cygnet/ride';

/** How strong an updraft under it has to be before it looks up and opens its wings, and before it goes. */
const LIFT_TO_HOPE = 0.18;
const LIFT_TO_FLY = 0.5;
/** A climb made by the player's hand: units of height a second per unit of updraft, how fast it sinks without one, and the most it can rise a second. */
export interface Labour {
  gain: number;
  sink: number;
  rise: number;
}
/** It never climbs further above the ground than this, so a glide can never take it out of the frame. */
const CEILING = 7.5;
/** Nothing it can do keeps it up longer than this. */
const GLIDE_FOR = 9;
const HOP_FOR = 4.2;
/** How long a try at flying is a run, before it turns into a fall. */
const RUN_UNTIL = 2.6;

/** Other places a hand can go on it, in its body's own frame: under the breast and under the rump, for holding it across the chest. */
const GRIPS = { breast: [0, -0.1, 0.12], rump: [0, -0.09, -0.13] } as const;

/** Something it just did that can be heard. The cygnet only says what happened; the sound of it is made elsewhere. */
export interface Heard {
  kind: 'step' | 'flap' | 'flutter' | 'shake' | 'tumble' | 'rustle' | 'plunge' | 'paddle';
  amount: number;
}

export type CygnetState = 'flying' | 'falling' | 'downed' | 'fallen' | 'carried' | 'hooded' | 'following' | 'perched' | 'swimming' | 'gliding' | 'fledging' | 'leaving';

const clamp = THREE.MathUtils.clamp;
const lerp = THREE.MathUtils.lerp;

/**
 * The cygnet: too young to keep up with its flock, carried and walked and finally flown. The only other
 * character in the story, and like the child it never makes a sound, except when it is lost.
 */
export class Cygnet {
  readonly position = new THREE.Vector3();
  yaw = 0;
  /**
   * Somewhere it has gone off to by itself: a leaf that skittered past, a heap worth looking into. While this is
   * set it makes for it at its own speed and forgets about keeping with the child, and it clears when it arrives.
   */
  errand: THREE.Vector3 | null = null;
  state: CygnetState = 'flying';
  /** False where the story will not have it flown at all: in the dark wood it stays on the ground whatever the wind does. */
  mayFly = true;
  readonly wing = new WingBandage();
  /** It stands where it is, whatever it feels about the child: for the moments the story asks it to stop and look. */
  stay = false;
  /** How fast it walks, as a share of its usual. A bird following something floating in the air ambles after it. */
  pace = 1;
  /**
   * Still water it is allowed to come down on, where the story has put it beside any: the surface's height and a
   * test for whether a point is over it. A glide that ends over the water is a splash-down and not a landing.
   */
  water: { level: number; over(x: number, z: number): boolean } | null = null;
  /** What it did this frame that makes a sound; whoever plays them empties the list. */
  readonly heard: Heard[] = [];

  /** What it notices, how it feels, and what it does of its own accord. */
  readonly mind = new Mind();
  /**
   * The world as it reaches the cygnet. Whoever owns these things writes them here each frame; anything left null is
   * simply not there for it to notice.
   */
  readonly world: {
    face: THREE.Vector3;
    hands: THREE.Vector3 | null;
    plane: THREE.Vector3 | null;
    creature: THREE.Vector3 | null;
    flock: THREE.Vector3 | null;
    light: THREE.Vector3 | null;
    cold: number;
    rain: number;
    dark: number;
  } = { face: new THREE.Vector3(), hands: null, plane: null, creature: null, flock: null, light: null, cold: 0, rain: 0, dark: 0 };

  /** How close it stays and how often it looks up at the child: only ever rises. */
  get bond(): number {
    return this.mind.bond;
  }
  set bond(value: number) {
    this.mind.bond = value;
  }
  visible = false;
  /** A visual echo of its voice, shared by every chapter and carried pose. */
  private readonly callMarks = new CallMarks();
  private formationEffort = 0;
  private wasVisible = false;
  /** How many times the player has put it in the air. It has never flown before the first. */
  flights = 0;

  private readonly root = new THREE.Object3D();
  private readonly nodes: THREE.Object3D[] = [];
  private readonly mesh: THREE.Mesh;
  private readonly mat: THREE.ShaderMaterial;
  private readonly bones: THREE.Matrix4[] = [];
  /** How its surface looks this frame, as far as that follows from how it feels: set here, drawn by the shader. */
  readonly look = newLook();
  /** Takes a vertex from the rest space the mesh is authored in to each bone's own. */
  private readonly unbind: THREE.Matrix4[] = [];
  /** Where it is drawn: on the ground, on the child, in their hands, or on the way between. */
  readonly seating = new Ride();
  private time = 0;
  private readonly poser = new Poser();
  private readonly gait = new Gait();
  private readonly senses: Senses;
  private readonly drives: Drives;
  private readonly windNow = { x: 0, z: 0, energy: 0, lift: 0 };
  private hurry = 0;
  private readonly swimAim = new THREE.Vector3();
  private swum = 0;
  /** 1 as it goes under on the way in, falling away as it bobs back up. */
  private dunk = 0;
  private swimSpeed = 0;
  private nextPaddle = 0;
  private gaitStale = true;
  private actWas: Drives['act'] = null;
  private nextRustle = 0;

  private rideFor = 0;
  private calm = 0;
  private doze = 0;
  private wriggle = 0;
  private nextWriggle = 0;
  private bodyLift = 0.11;

  private stride = 0;
  private flapPhase = 0;
  private flap = 0;
  private effort = 0;
  private settle = 0;
  private glide = 0;
  private roll = 0;
  private pitch = 0;
  private slew = 0;
  private fallT = 0;
  private fallFor = 1;
  private readonly fallFrom = new THREE.Vector3();
  private readonly fallTo = new THREE.Vector3();
  private readonly fallDrift = new THREE.Vector3();
  private struggle = 0;
  /** On its side after the landing, until the first try rights it. */
  private flop = 0;
  private air = 0;
  private glideT = 0;
  private hope = 0;
  private hopT = 0;
  /** The updraft it takes to lift it, and how it climbs on one: a bound anywhere else, at the summit a slow labour that sinks the moment the wind stops. */
  private liftToFly = LIFT_TO_FLY;
  private labour: Labour | null = null;
  private hopLift = 0;
  private runBearing = 0;
  private awayFromChild = 0;
  /** 0 to 1: down on its breast with its tail in the air, after a try that did not work or a landing it got wrong. */
  private faceplant = 0;
  private landedAt = 0;
  private landing = 0;
  private leaveYaw = 0;
  /** The fledging: seconds into it, where it is round the child, and the bearing it comes round to hang on. */
  /** The one long glide: where it set off from, where it is going, how long it takes and how it has got on. */
  private readonly sailFrom = new THREE.Vector3();
  private readonly sailTo = new THREE.Vector3();
  private sailFor = 0;
  private sailT = 0;
  private sailArc = 0;
  private fledgeT = 0;
  private fledgeArc = 0;
  private fledgeFace = 0;
  private fledgeFrom = 0;
  /** How far its head is off the line of flight, how far its legs are up in it, and how far its wings are trimmed. */
  private craning = 0;
  private tucked = 0;
  private trim = 0;
  /** Seconds into the flight to its family, for the one last over-correction on the way. */
  private leftFor = 0;
  private readonly watching = new THREE.Vector3();
  private joining: ((out: THREE.Vector3) => THREE.Vector3 | null) | null = null;
  private readonly joinAt = new THREE.Vector3();
  private readonly flyTo = new THREE.Vector3();
  joined = false;
  private climb = 0;
  private notice = 0;
  private readonly childPrev = new THREE.Vector3();
  private childSpeed = 0;

  private blink = 0;
  private blinkT = 0;
  private nextBlink = 1.5;
  private beg = 0;
  private nextBeg = 0;
  private callT = 0;
  private callLong = false;
  private nextCall = 0;
  private breath = 0;
  private puff = 0;

  private get fear(): number {
    return this.mind.feel.fear;
  }
  private set fear(value: number) {
    this.mind.feel.fear = value;
  }

  /** QA: keeps it on its feet, and sets any bone's rotation over the top of the pose, so a shape can be found by hand. */
  readonly debug: { stand: boolean; bones: Record<number, [number, number, number]> } = { stand: false, bones: {} };

  private readonly to = new THREE.Vector3();
  private readonly tmp = new THREE.Vector3();
  private readonly tmp2 = new THREE.Vector3();
  private readonly tilt = new THREE.Quaternion();
  private readonly tiltBy = new THREE.Euler(0, 0, 0, 'YXZ');

  constructor() {
    this.nodes[ROOT] = this.root;
    for (const [bone, parent, [x, y, z]] of SKELETON) {
      const o = new THREE.Object3D();
      o.position.set(x, y, z);
      this.nodes[parent].add(o);
      this.nodes[bone] = o;
    }
    for (let i = 0; i < BONES; i++) {
      this.bones.push(new THREE.Matrix4());
      this.unbind.push(new THREE.Matrix4().makeTranslation(-REST[i][0], -REST[i][1], -REST[i][2]));
    }

    this.senses = {
      eye: new THREE.Vector3(),
      face: this.world.face,
      childSpeed: 0,
      gap: 0,
      hands: null,
      plane: null,
      creature: null,
      flock: null,
      light: null,
      wind: this.windNow,
      cold: 0,
      rain: 0,
      dark: 0,
      where: 'afoot',
      busy: false,
      locked: false,
    };
    this.drives = {
      time: 0, carried: false, seat: null, inHands: false, move: null, jostle: 0, falling: false, gliding: false, leaving: false, afoot: false, downed: false, afloat: false, perched: false,
      settle: 0, fear: 0, bond: 0, cold: 0, effort: 0, flap: 0, flapPhase: 0, glide: 0, look: 0, tucked: 0, hope: 0, hopLift: 0, crouch: 0, landing: 0, faceplant: 0, flop: 0, doze: 0, wriggle: 0,
      puff: 0, stride: 0, hurry: 0, pitch: 0, roll: 0, beg: 0, call: { env: 0, note: 0, long: false }, gaze: { yaw: 0, pitch: 0, firm: false, wandering: true },
      act: null, actK: 0, actEnv: 0, actSide: 1, actYaw: 0, breath: 0, blink: 0, wingGuard: 0, wingOpening: 0, wind: { x: 0, z: 0 },
      gait: { on: false, feet: [{ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }], sway: 0, roll: 0, twist: 0, dip: 0, pace: 0 },
    };
    this.mat = cygnetMaterial(this.bones);
    this.mesh = new THREE.Mesh(cygnetGeometry(), this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    /** The coat hangs off the skin as a child of it, so it is shown, hidden and drawn with the bird and never apart. */
    this.mesh.add(downShells(this.mat));
  }

  get objects(): THREE.Object3D[] {
    return [this.mesh, this.callMarks.sprite, this.wing.mesh];
  }

  /** The same bird flies, struggles, and falls: no adult-to-baby swap at separation. */
  flyWith(from: THREE.Vector3, heading: number, effort: number): void {
    if (!this.visible) {
      this.seating.seat = null;
      this.seating.held = false;
      this.seating.snap();
    }
    this.visible = true;
    this.state = 'flying';
    this.position.copy(from);
    this.yaw = heading;
    this.formationEffort = effort;
  }

  /**
   * Out of the flock and down. A long shallow descent with the wings going the whole way and no lift in them,
   * then a hard landing. It is the only thing in the game that is not gentle, and it is meant to hurt.
   */
  plummet(from: THREE.Vector3, to: THREE.Vector3, seconds: number, heading?: number): void {
    this.fallFrom.copy(from);
    this.fallTo.copy(to);
    this.fallTo.y = Math.max(heightAt(to.x, to.z), 0);
    const line = heading ?? Math.atan2(to.x - from.x, to.z - from.z);
    const ahead = (to.x - from.x) * Math.sin(line) + (to.z - from.z) * Math.cos(line);
    /**
     * It carries on the flock's line for a moment, sinking, before it peels away. That first stretch is the only
     * thing that tells the player it fell out of the V rather than choosing to come down.
     * When the landing is ahead, keep the tangent short enough that the curve never passes it and doubles back.
     */
    this.fallDrift
      .set(Math.sin(line), 0, Math.cos(line))
      .multiplyScalar(ahead > 0 ? Math.min(38, ahead * 0.7) : 38)
      .add(from)
      .setY(from.y - (from.y - this.fallTo.y) * 0.1);
    this.fallFor = seconds;
    this.fallT = 0;
    this.roll = 0;
    this.slew = 0;
    this.state = 'falling';
    this.visible = true;
    this.position.copy(from);
    this.yaw = line;
    this.seating.seat = null;
    this.seating.held = false;
    this.seating.snap();
    this.fear = 0.5;
    this.nextCall = this.time + 0.6;
  }

  /** How hard it is still trying to get up, 1 at the moment it lands and 0 once it gives in. */
  get effortLeft(): number {
    return this.state === 'downed' ? 1 - this.struggle : 0;
  }

  get grounded(): boolean {
    return this.state === 'downed' || this.state === 'fallen';
  }

  /** Up on the player's wind. */
  get flying(): boolean {
    return this.state === 'gliding';
  }

  /** How near it is to going: 0 nothing under it, 1 about to leave the ground. Its wings show this. */
  get hoping(): number {
    return this.hope;
  }

  /**
   * Let go for good. Once the player's wind has it up, it stops being carried by them and starts flying: it climbs
   * away on its own and it does not come back. Nothing else in the game is allowed to leave.
   */
  leave(bearing: number): void {
    if (this.state === 'leaving') return;
    this.state = 'leaving';
    this.leaveYaw = bearing;
    this.climb = 0;
    this.joined = false;
    this.flights++;
  }

  /**
   * Its own flight at last. Off the player's wind and flying by itself: a wobbly circuit round the child that
   * steadies as it goes, then round to hang in front of them, facing them, for the one call that is answered.
   */
  fledge(child: THREE.Vector3, facing: number): void {
    if (this.state === 'fledging' || this.state === 'leaving') return;
    this.state = 'fledging';
    this.fledgeT = 0;
    /** It picks the circuit up from wherever the player's wind left it, so nothing about the hand-over is a cut. */
    const f = tuning.fledge;
    this.fledgeArc = Math.atan2(this.position.x - child.x, (this.position.z - child.z - f.offset) / f.squash);
    this.fledgeFrom = this.position.y - Math.max(heightAt(child.x, child.z), 0);
    this.fledgeFace = facing;
    this.hopT = 0;
    this.landing = 0;
    this.settle = 0;
    this.fear = 0;
    this.flights++;
  }

  /** Where the fledging has got to: round the child, hanging in front of them, or done and ready to go. */
  get fledgePhase(): 'loop' | 'turn' | 'ready' | null {
    if (this.state !== 'fledging') return null;
    const f = tuning.fledge;
    return this.fledgeT < f.loopFor + f.swingFor ? 'loop' : this.fledgeT < f.loopFor + f.swingFor + f.hangFor ? 'turn' : 'ready';
  }

  /** Goes to its family: flies to wherever `where` says they are and, once there, holds its place among them. */
  join(where: (out: THREE.Vector3) => THREE.Vector3 | null): void {
    this.joining = where;
    this.watch(null);
    this.leftFor = 0;
    this.leave(this.yaw);
    /** It stopped itself dead to say goodbye, so it has to find its speed again — but it knows how to now. */
    this.climb = 0.1;
  }

  /** On its way and not coming back. */
  get gone(): boolean {
    return this.state === 'leaving';
  }

  /**
   * A run at it: feet slapping, wings going, a bound or two, and down on its breast. It is trying to get up by
   * itself, and it cannot. It runs the way it is told, or else away from the child, who is watching.
   */
  /** What the wind has to do under it before it goes, and how it climbs on it, from here on. */
  needs(lift: number, labour: Labour | null): void {
    this.liftToFly = lift;
    this.labour = labour;
  }

  tryToFly(bearing?: number): void {
    if (!this.wing.flightReady) return;
    if ((this.state === 'following' || this.state === 'fallen') && this.hopT <= 0) {
      this.state = 'following';
      this.hopT = HOP_FOR;
      this.hopLift = 0;
      this.runBearing = bearing ?? this.awayFromChild;
    }
  }

  /**
   * The longest glide it has made, and the first it makes for somebody rather than because somebody lifted it: it
   * lets go of the hill and goes down the whole slope to a point far below, alone. Whoever asked for it says where
   * it lands, and takes it over the moment it is down, because it comes in on its breast.
   */
  glideTo(to: THREE.Vector3, seconds: number, arc: number): void {
    const alreadyFlying = this.flying;
    this.sailFrom.copy(this.position);
    this.sailTo.copy(to);
    this.sailFor = seconds;
    this.sailT = 0;
    this.sailArc = arc;
    this.state = 'gliding';
    this.glideT = 0;
    this.air = 0;
    this.hopT = 0;
    this.settle = 0;
    this.landing = 0;
    this.fear = 0;
    if (!alreadyFlying) this.flights++;
    this.mind.trust(1);
  }

  /** How far down that glide it has got, 0 to 1: what the morning coming down the hill with it is run from. */
  get sailing(): number {
    return this.sailFor > 0 ? clamp(this.sailT / this.sailFor, 0, 1) : 0;
  }

  /** Reaches up and flutters at somebody, which is what a chick does when it wants to be noticed. */
  plead(): void {
    this.beg = 1.6;
    this.nextBeg = this.time + 3;
    this.heard.push({ kind: 'flutter', amount: 0.7 });
  }

  /** Told to do a particular thing, at something: worrying at the scarf, pushing under a hand, looking back. */
  does(act: Act, at?: THREE.Vector3, dur?: number): void {
    if (at) this.mind.actAt.copy(at);
    this.mind.perform(act, dur ?? Number.NaN);
  }

  /** Dozed off on a long quiet carry. */
  get asleep(): boolean {
    return this.doze > 0.6;
  }

  /** How frightened it is, 0 to 1. */
  get frightened(): number {
    return this.fear;
  }

  /** Riding with the child, in the arms or in the satchel. */
  get carried(): boolean {
    return this.state === 'carried' || this.state === 'hooded';
  }

  /** Comes down out of the flock and lands in the grass, too tired to go on. */
  fall(x: number, z: number, yaw: number): void {
    this.position.set(x, Math.max(heightAt(x, z), 0), z);
    this.yaw = yaw;
    this.seating.seat = null;
    this.seating.snap();
    this.state = 'fallen';
    this.settle = 1;
    this.visible = true;
  }

  /** Who carries it. Set once; every seat is a place on their body. */
  set mount(m: Mount) {
    this.seating.mount = m;
  }

  /** Which seat it is in, if it is riding. */
  get seat(): Seat | null {
    return this.carried ? this.seating.seat : null;
  }

  /**
   * Riding on the child: held across the chest, or in the satchel on their back. Going from one to the other it
   * climbs over their shoulder; from anywhere else it is simply gathered up (the shared moments in `companion/`
   * do that properly, with the child's hands; this is the plain version for story starts and fallbacks).
   */
  rideIn(seat: Seat): void {
    const next: CygnetState = seat === 'satchel' ? 'hooded' : 'carried';
    const was = this.state;
    if (was === next && this.seating.seat === seat) return;
    const riding = this.carried;
    this.state = next;
    this.rideFor = 0;
    this.doze = 0;
    this.nextWriggle = this.time + 4 + Math.random() * 4;
    this.visible = true;
    if (was === 'flying' || !this.wasVisible) {
      this.seating.seat = seat;
      this.seating.held = false;
      this.seating.snap();
    } else if (this.seating.held) this.seating.go({ seat, held: false }, 'settle', 0.35);
    else if (riding) {
      this.seating.go({ seat }, 'climb', 1.7);
      this.heard.push({ kind: 'flutter', amount: 0.5 });
    }
    else this.seating.go({ seat }, 'lift', 0.6, 0.18);
    this.fear = Math.min(this.fear, 0.25);
  }

  /**
   * In the child's hands. From here until `release` or `rideIn`, whoever is holding it says where it is every frame
   * (`seating.hold`), so it goes exactly where the mittens go.
   */
  takeUp(hop = false): void {
    this.state = 'carried';
    if (hop) {
      this.seating.go({ seat: null, held: true }, 'hop', 0.6, 0.14);
      this.heard.push({ kind: 'flutter', amount: 0.7 });
    }
    else this.seating.go({ seat: null, held: true }, 'settle', 0.25);
    this.settle = 0;
    this.hopT = 0;
  }

  /** Where a seat would have it this frame, for whoever is carrying it there by hand. */
  seatFrame(seat: Seat, out: { p: THREE.Vector3; q: THREE.Quaternion }): { p: THREE.Vector3; q: THREE.Quaternion } {
    return this.seating.frameOf(seat, this.bodyLift, out);
  }

  /** Off the hands and onto the grass at `spot`, with a hop: it gets down by itself, the way it got up. */
  release(spot: THREE.Vector3): void {
    this.position.set(spot.x, Math.max(heightAt(spot.x, spot.z), 0), spot.z);
    this.yaw = this.seating.yaw;
    this.seating.go({ seat: null, held: false }, 'hop', 0.72, 0.1);
    this.state = 'following';
    this.settle = 0.1;
    this.landedAt = this.time;
  }

  /** Where a holding hand goes, in the world: under the belly either side, on the back, under the breast or the rump. */
  grip(name: keyof typeof GRIPS | keyof typeof HOLDS, out: THREE.Vector3): THREE.Vector3 {
    const body = this.nodes[BODY];
    body.updateWorldMatrix(true, false);
    const at = name in GRIPS ? GRIPS[name as keyof typeof GRIPS] : HOLDS[name as keyof typeof HOLDS];
    return out.set(at[0], at[1], at[2]).applyMatrix4(body.matrixWorld);
  }

  /** Gone to ground and staying there: hunched as small as it can make itself, in the dark, waiting to be found. */
  cower(): void {
    if (this.carried) this.seating.go({ seat: null }, 'dash', 1.1, 0.5);
    this.state = 'fallen';
    this.settle = 1;
    this.flap = 0;
    this.effort = 0;
    this.hopT = 0;
    this.fear = 1;
    this.visible = true;
    this.nextCall = this.time + 1.5;
  }

  /** Set down to walk at the child's heel. */
  follow(): void {
    this.position.y = Math.max(heightAt(this.position.x, this.position.z), 0);
    if (this.carried) {
      this.seating.go({ seat: null }, 'hop', 0.55, 0.35);
      this.settle = 0.2;
      this.landedAt = this.time;
    } else if (this.state !== 'following') this.settle = 0.6;
    this.state = 'following';
    this.visible = true;
    this.fear = Math.min(this.fear, 0.2);
  }

  /**
   * Standing on something that is not the ground and may be moving, like the side of the boat. Whoever put it there
   * says where that is every frame. Getting there from the child's arms is a hop of its own.
   */
  perch(at: THREE.Vector3, yaw: number): void {
    if (this.state !== 'perched') {
      if (this.carried) {
        this.seating.go({ seat: null, held: false }, 'hop', 0.6, 0.16);
        this.heard.push({ kind: 'flutter', amount: 0.6 });
      } else if (this.state === 'swimming') {
        this.seating.go({ seat: null, held: false }, 'hop', 0.7, 0.3);
        this.heard.push({ kind: 'flutter', amount: 0.9 });
        this.mind.perform('shake', 1.1);
      }
      this.state = 'perched';
      this.settle = 0;
    }
    this.position.copy(at);
    this.yaw = yaw;
  }

  /**
   * Into the water, and swimming for the place it is given, which whoever is sailing beside it moves along. It has
   * never done this before the first time, and goes in like a dropped loaf.
   */
  swimTo(target: THREE.Vector3): void {
    if (this.state !== 'swimming') {
      this.seating.go({ seat: null, held: false }, 'hop', 0.75, 0.22);
      this.position.set(target.x, this.swimLevel, target.z);
      this.state = 'swimming';
      this.swum = 0;
      this.dunk = 1;
      this.swims++;
      this.mind.wet = 1;
    }
    this.swimAim.copy(target);
  }

  /** The height of whatever it is swimming on: the sea, or a pond up the hill. */
  swimLevel = 0;
  /** Playful paddling in the toy pools; zero keeps the later open-sea swim's existing character. */
  swimPlay = 0;
  private swimJoy = 0;
  /** Alternating foot phase for water kicked up by the room beneath it. */
  get paddlePhase(): number { return this.stride; }

  /**
   * Out of the water and up the bank: a scramble, a shake, and it is a land animal again, which is the state
   * everything else it does on the ground starts from.
   */
  ashore(x: number, z: number, yaw: number): void {
    if (this.state !== 'swimming') return;
    this.seating.go({ seat: null, held: false }, 'hop', 0.7, 0.3);
    this.state = 'following';
    this.swimPlay = 0;
    this.swimJoy = 0;
    this.position.set(x, Math.max(heightAt(x, z), 0), z);
    this.yaw = yaw;
    this.landedAt = this.time;
    this.landing = 0;
    this.settle = 0;
    this.heard.push({ kind: 'flutter', amount: 0.9 });
    this.mind.perform('shake', 1.1);
  }

  /** How many times it has taken to the water, and how far behind the place it is making for it has fallen. */
  swims = 0;
  get astern(): number {
    return this.state === 'swimming' ? Math.hypot(this.swimAim.x - this.position.x, this.swimAim.z - this.position.z) : 0;
  }

  /** A moment shared: the bond only ever goes up. */
  bind(amount: number): void {
    this.bond = Math.min(1, this.bond + amount);
  }

  watch(target: THREE.Vector3 | null): void {
    this.mind.told = target;
  }

  /** QA: where a foot is in the world and whether it is meant to be standing still, left (0) or right (1). */
  footAt(side: 0 | 1, out: THREE.Vector3): boolean {
    this.nodes[side === 0 ? FOOT_L : FOOT_R].getWorldPosition(out);
    return this.drives.gait.on && this.gait.feet[side].planted;
  }

  /** QA: which way up its body is, in the world. */
  bodyTurn(out: THREE.Quaternion): THREE.Quaternion {
    return this.nodes[BODY].getWorldQuaternion(out);
  }

  /** Where the child should look to meet its eye. */
  eye(out: THREE.Vector3): THREE.Vector3 {
    this.nodes[HEAD].updateMatrixWorld(true);
    return out.setFromMatrixPosition(this.nodes[HEAD].matrixWorld);
  }

  update(dt: number, time: number, child: THREE.Vector3, wind: WindSample): void {
    this.time = time;
    this.mesh.visible = this.visible;
    this.wasVisible = this.visible;
    if (!this.visible) {
      this.wing.mesh.visible = false;
      this.callT = 0;
      this.callMarks.hide();
      return;
    }
    dt = Math.min(dt, 0.05);
    this.childSpeed = ease(this.childSpeed, dt > 0 ? Math.min(8, this.tmp.copy(child).sub(this.childPrev).length() / dt) : 0, 8, dt);
    this.childPrev.copy(child);
    this.awayFromChild = Math.atan2(this.position.x - child.x, this.position.z - child.z);

    const afoot = this.state === 'following' || this.state === 'fallen';
    /** It only ever goes up on wind that is actually under it, so the player learns where to hold the pointer. */
    const lift = afoot || this.state === 'gliding' ? wind.lift : 0;
    this.hope = ease(this.hope, afoot && this.hopT <= 0 ? THREE.MathUtils.smoothstep(lift, LIFT_TO_HOPE, this.liftToFly) : 0, 2.5, dt);

    if (this.state === 'flying') {
      this.effort = this.formationEffort;
      this.flap = 0.6 + this.effort * 0.4;
      this.flapPhase += dt * (7 + this.effort * 7);
      this.pitch = ease(this.pitch, 0.12 - this.effort * 0.3, 3, dt);
      this.roll = ease(this.roll, Math.sin(time * 2.1) * 0.12 * (1 - this.effort), 3, dt);
    } else if (this.state === 'leaving') this.climbOut(dt, child);
    else if (this.state === 'fledging') this.fledging(dt, child);
    else if (this.state === 'gliding') this.sailFor > 0 ? this.sail(dt) : this.soar(dt, wind, child);
    else if (this.state === 'following') this.walk(dt, child);
    else if (this.state === 'swimming') this.paddling(dt);
    else if (this.state === 'perched') {
      this.effort = 0;
      /**
       * Tumbled onto something rather than set down on it: it goes over onto its breast as it arrives and picks
       * itself up off it in its own time. Eased on the way in as well as out, because a pose that switches is a pop.
       */
      this.faceplant = ease(this.faceplant, this.time - this.landedAt < 0.55 ? 0.8 : 0, 3, dt);
      this.roll = ease(this.roll, 0, 4, dt);
      this.pitch = ease(this.pitch, 0, 4, dt);
    }
    else if (this.state === 'fallen') this.rest(dt, child);
    else if (this.state === 'falling') this.descend(dt);
    else if (this.state === 'downed') this.struggling(dt);
    else this.passenger(dt);

    /** Enough wind under it and it goes — but not the instant it lands, or one long hold would juggle it. */
    /** Wind under it during the run of a try is the try working: the bound that was never enough is, this once. */
    const running = this.hopT > 0 && this.hopT < HOP_FOR - 0.8 && this.faceplant === 0;
    if (this.mayFly && this.wing.flightReady && afoot && lift > this.liftToFly && (this.hopT <= 0 || running) && this.landing <= 0 && time - this.landedAt > 1.6) this.takeOff();

    /** The updraft holds its wings all the way out; flying itself, only as much of them is trimmed as it is resting. */
    const wings = this.state === 'gliding' ? 1 : this.state === 'fledging' || this.state === 'leaving' ? this.trim : this.hope * 0.5;
    this.glide = ease(this.glide, wings, 3, dt);
    this.look.air =
      this.state === 'falling'
        ? clamp((this.seating.shown.p.y - this.fallTo.y) / 6, 0, 1)
        : this.state === 'flying' || this.state === 'gliding' || this.state === 'fledging' || this.state === 'leaving'
          ? clamp((this.seating.shown.p.y - Math.max(heightAt(this.seating.shown.p.x, this.seating.shown.p.z), 0)) / 4, 0, 1)
          : 0;
    this.windNow.x = wind.x;
    this.windNow.z = wind.z;
    this.windNow.energy = wind.energy;
    this.windNow.lift = wind.lift;
    this.live(dt, child);
    this.pose(dt);
    if (this.carried && this.seating.riding && !this.seating.move) this.position.copy(this.seating.shown.p);
    this.callMarks.update(dt, this.seating.shown.p, this.callT);
  }

  /**
   * The circuit round the child on its own wings: wide and high by the end, with the lurches in height and heading
   * of a bird that has only just found out it can, dying away as it goes. Then round to hang in front of the child.
   */
  private fledging(dt: number, child: THREE.Vector3): void {
    this.fledgeT += dt;
    this.flap = ease(this.flap, 1, 6, dt);
    const ground = Math.max(heightAt(child.x, child.z), 0);
    if (this.fledgeT < tuning.fledge.loopFor) this.circuit(dt, child, ground);
    else this.turnBack(dt, this.fledgeT - tuning.fledge.loopFor, child, ground);
  }

  /**
   * Round and round the child. The first lap is all recovery — it sags, throws a wing down, over-corrects the
   * heading and beats far too fast — and every lap it is a little more of the bird that has been flying all along:
   * wider, higher, quicker, and finally holding one long bank with its neck out and its feet up behind it.
   */
  private circuit(dt: number, child: THREE.Vector3, ground: number): void {
    const f = tuning.fledge;
    const t = this.fledgeT;
    const p = this.position;
    const steady = THREE.MathUtils.smoothstep(t / f.loopFor, 0, 1);
    const wobble = (1 - steady) ** 1.4;
    /** It loses the air every couple of seconds early on and grabs it back; by the last lap they have gone. */
    const lurch = Math.max(0, Math.sin(t * 2.3)) ** 2 * wobble;
    const drift = Math.sin(t * 1.27 + 1) * wobble;
    const r = lerp(f.radiusFrom, f.radiusTo, steady);
    const along = Math.hypot(Math.cos(this.fledgeArc) * r, Math.sin(this.fledgeArc) * r * f.squash);
    this.fledgeArc += (lerp(f.speedFrom, f.speedTo, steady) / Math.max(along, 1)) * dt;
    const a = this.fledgeArc;
    /** It takes over at whatever height the player's wind had it at, and sinks onto its own line rather than to it. */
    const high = lerp(this.fledgeFrom, lerp(f.heightFrom, f.heightTo, steady), THREE.MathUtils.smoothstep(t, 0, 2));
    this.flyTo.set(child.x + Math.sin(a) * r, ground + high - lurch * f.sag + drift * 0.7, child.z + f.offset + Math.cos(a) * r * f.squash);
    const was = p.y;
    p.lerp(this.flyTo, 1 - Math.exp(-dt * (3 + 3 * steady)));
    /** The pitch is whatever the climb is really doing, so a sag drops the nose and the recovery lifts it. */
    const rise = dt > 0 ? (p.y - was) / dt : 0;
    this.pitch = ease(this.pitch, clamp(-rise * 0.16, -0.4, 0.45), 4, dt);
    /**
     * Halfway round it remembers who is down there, and puts a wing down to see them: the head turning alone is
     * nothing at this distance, so the whole bird leans over into the look and that is what the player reads.
     */
    const looking = Math.max(0, Math.sin(((t - f.loopFor * 0.42) / f.looksFor) * Math.PI));
    this.craning = ease(this.craning, looking * 0.6, 2.5, dt);
    this.watch(looking > 0.05 ? this.watching.set(child.x, child.y + 1.55, child.z) : null);
    const heading = Math.atan2(Math.cos(a), -Math.sin(a) * f.squash);
    this.yaw = easeAngle(this.yaw, heading + (drift - lurch) * f.yawThrow, 2.2 + 2.5 * steady, dt);
    this.roll = ease(this.roll, -f.bank * (0.3 + 0.7 * steady + looking * 0.6) + (drift - lurch * 1.4) * f.wingDrop, 2.5 + 2 * steady, dt);
    /** `pose` adds the body's own idle beat to the phase, so what is asked for here is the stroke over and above it. */
    this.flapPhase += dt * (Math.PI * 2 * lerp(f.beatFrom, f.beatTo, steady) - (5 + this.glide * 3));
    this.effort = 0.8 - 0.35 * steady;
    this.trim = ease(this.trim, 0.1 + 0.28 * steady, 2, dt);
    this.tucked = ease(this.tucked, 0.3 + 0.6 * steady, 1.5, dt);
  }

  /**
   * Out of the circuit and round to the child: a long banked turn that runs out of speed, and then a flare — nose
   * up, feet down, wings forward — that stops it dead in front of their face. A swan cannot hang in the air, and
   * this one only just can, for as long as it takes to look at them and call. A dream is allowed that much.
   */
  private turnBack(dt: number, t: number, child: THREE.Vector3, ground: number): void {
    const f = tuning.fledge;
    const p = this.position;
    const swing = THREE.MathUtils.smoothstep(t / f.swingFor, 0, 1);
    const hang = Math.max(0, t - f.swingFor);
    this.watch(this.watching.set(child.x, child.y + 1.55, child.z));
    this.craning = ease(this.craning, 1, 3.5, dt);
    this.trim = ease(this.trim, 0.06, 3, dt);
    this.tucked = ease(this.tucked, 0.15, 2, dt);

    /** It is still flying its circuit as it breaks out of it, so the line it comes in on is a curve and not a slide. */
    const r = f.radiusTo;
    const along = Math.hypot(Math.cos(this.fledgeArc) * r, Math.sin(this.fledgeArc) * r * f.squash);
    this.fledgeArc += (f.speedTo / Math.max(along, 1)) * dt * (1 - swing);
    this.flyTo.set(child.x + Math.sin(this.fledgeArc) * r, ground + f.heightTo, child.z + f.offset + Math.cos(this.fledgeArc) * r * f.squash);
    this.tmp.set(child.x + Math.sin(this.fledgeFace) * f.hangAt, ground + f.hangHigh + Math.sin(hang * 1.9) * 0.16, child.z + Math.cos(this.fledgeFace) * f.hangAt);
    this.flyTo.lerp(this.tmp, swing);
    const fromX = p.x;
    const fromZ = p.z;
    p.lerp(this.flyTo, 1 - Math.exp(-dt * lerp(1.1, 3, swing)));

    const travel = Math.hypot(p.x - fromX, p.z - fromZ) > 1e-4 ? Math.atan2(p.x - fromX, p.z - fromZ) : this.yaw;
    const toChild = Math.atan2(child.x - p.x, child.z - p.z);
    /** It flies the way it is going until it has nearly stopped, and only then comes round to face them. */
    const round = THREE.MathUtils.smoothstep(t, f.swingFor * 0.5, f.swingFor * 1.1);
    this.yaw = easeAngle(this.yaw, travel + wrapAngle(toChild - travel) * round, 3, dt);
    this.roll = ease(this.roll, -f.bank * (1 - swing) + Math.sin(hang * 1.5) * 0.11 * swing, 2.5, dt);
    this.pitch = ease(this.pitch, -f.flare * swing, 2.5 + swing, dt);
    this.flapPhase += dt * (Math.PI * 2 * lerp(f.beatTo, f.hangBeat, swing) - (5 + this.glide * 3));
    this.effort = 0.45 + 0.5 * swing;
  }

  /**
   * Climbing away north, finding its own strength as it goes, until the night has it; or, joining its family, to
   * wherever they are, and then holding its place among them however they fly.
   */
  private climbOut(dt: number, child: THREE.Vector3): void {
    this.climb = Math.min(1, this.climb + dt * 0.3);
    this.leftFor += dt;
    this.craning = ease(this.craning, 0, 3, dt);
    this.trim = ease(this.trim, 0.3, 1.5, dt);
    this.tucked = ease(this.tucked, 1, 2, dt);
    const f = tuning.fledge;
    /** One last over-correction on the way to them, and a stroke rushed to answer it: it is not a grown bird yet. */
    const wonk = this.joined ? 0 : Math.sin(Math.PI * clamp((this.leftFor - f.wonkAt) / f.wonkFor, 0, 1));
    const p = this.position;
    const target = this.joining?.(this.joinAt);
    if (target) {
      /** Its own bob in the line, once it has its place: a station held, but not the way its family holds one. */
      if (this.joined) target.y += Math.sin(this.time * 2.1) * f.joinBob;
      const dx = target.x - p.x;
      const dz = target.z - p.z;
      const gap = Math.hypot(dx, dz);
      this.yaw = easeAngle(this.yaw, Math.atan2(dx, dz) + wonk * 0.3, this.joined ? 3 : 1.8, dt);
      const speed = Math.min(3.5 + this.climb * 9.5, 3 + gap * 1.2);
      p.x += Math.sin(this.yaw) * speed * dt;
      p.z += Math.cos(this.yaw) * speed * dt;
      p.y += clamp((target.y - p.y) * 0.9, -2.5, 3.2) * dt;
      if (gap < 3.5) this.joined = true;
      /** Once it is in the line it is held to its place, give or take a wobble of its own. */
      if (this.joined) p.lerp(target, 1 - Math.exp(-dt * 2.5));
      if (p.distanceTo(child) > 420 || p.y > 150) this.visible = false;
    } else {
      this.yaw = easeAngle(this.yaw, this.leaveYaw, 0.7, dt);
      const speed = 3.4 + this.climb * 7.5;
      p.x += Math.sin(this.yaw) * speed * dt;
      p.z += Math.cos(this.yaw) * speed * dt;
      p.y += (3.1 - this.climb * 1.1) * dt;
    }
    this.flap = 1;
    /** The long steady stroke of a bird that has found out it can, and the one that is rushed on the way there. */
    this.flapPhase += dt * (Math.PI * 2 * (f.beatTo + wonk * 1.1) - (5 + this.glide * 3));
    this.effort = 0.5 + 0.25 * Math.max(0, Math.sin(this.flapPhase)) + wonk * 0.25;
    this.roll = ease(this.roll, Math.sin(this.time * 0.6) * 0.1 - wonk * 0.5, 2.5, dt);
    this.pitch = ease(this.pitch, -0.28 + Math.sin(this.flapPhase) * 0.05 + wonk * 0.12, 4, dt);
    if (this.position.y > 150) this.visible = false;
  }

  /**
   * The glide itself. It goes off the top slowly, finds the line, and holds it the whole way down with its wings
   * out and nothing else to do but steer a little; the ground is never allowed near it until the last of it, and
   * it arrives with speed still on and goes over onto its breast, because it has never landed well yet.
   */
  private sail(dt: number): void {
    this.sailT += dt;
    const k = clamp(this.sailT / this.sailFor, 0, 1);
    /** Away gently and down at a steady pace: a glide that eased to a stop at the bottom would be a lift, not a fall. */
    const e = (k * k * (3 - 2 * k)) * 0.35 + k * 0.65;
    const p = this.position;
    const from = this.sailFrom;
    const to = this.sailTo;
    /** A long lazy wander across the line, dying out as it comes in, which is what keeps a glide from being a rail. */
    const side = Math.sin(this.sailT * 0.55) * 1.1 * (1 - k);
    const ax = to.z - from.z;
    const az = -(to.x - from.x);
    const across = Math.hypot(ax, az) || 1;
    const was = p.y;
    p.set(
      from.x + (to.x - from.x) * e + (ax / across) * side,
      lerp(from.y, to.y, e) + Math.sin(e * Math.PI) * this.sailArc,
      from.z + (to.z - from.z) * e + (az / across) * side,
    );
    /**
     * Never nearer the hillside than a bird would fly it, except at the two ends: it leaves the ground it was
     * standing on rather than being lifted off it, and it comes down onto what it is aimed at.
     */
    const clear = Math.max(heightAt(p.x, p.z), 0) + 1.5 * (1 - k * k) * THREE.MathUtils.smoothstep(k, 0, 0.14);
    if (p.y < clear) p.y = clear;

    const rise = dt > 0 ? (p.y - was) / dt : 0;
    const travel = Math.atan2(to.x - p.x, to.z - p.z);
    /** It levels out over the last of it, so that arriving is a flare and not the frame its bank went to nothing. */
    const level = 1 - THREE.MathUtils.smoothstep(k, 0.86, 1);
    this.yaw = easeAngle(this.yaw, travel + Math.cos(this.sailT * 0.55) * 0.22 * (1 - k), 2.2, dt);
    this.roll = ease(this.roll, (-Math.cos(this.sailT * 0.55) * 0.3 * (1 - k) + Math.sin(this.time * 0.8) * 0.06) * level, 2.5, dt);
    this.pitch = ease(this.pitch, clamp(-rise * 0.14, -0.4, 0.3) * level, 3.5, dt);
    this.craning = ease(this.craning, 0.15, 2, dt);
    this.trim = ease(this.trim, 0.2, 2, dt);
    this.tucked = ease(this.tucked, 0.85, 1.5, dt);
    /** A few strokes to hold the line at the start, and none at all once it is riding the wind down. */
    const working = Math.max(0, 1 - k * 3);
    this.effort = ease(this.effort, working * 0.5, 3, dt);
    this.flap = ease(this.flap, working * 0.7, 3, dt);
    this.flapPhase += dt * (3 + working * 6);
    if (k >= 1) {
      this.sailFor = 0;
      this.state = 'perched';
      this.heard.push({ kind: 'tumble', amount: 0.7 });
      this.effort = 0;
      this.flap = 0;
      this.settle = 0;
      this.landedAt = this.time;
      this.bind(0.15);
      this.mind.startle(0);
    }
  }

  private takeOff(): void {
    this.state = 'gliding';
    this.hopT = 0;
    this.hopLift = 0;
    this.glideT = 0;
    this.air = 2.4;
    this.settle = 0;
    this.flights++;
    this.fear = 0;
  }

  /**
   * The cygnet on the wing, for as long as the player can hold it there. It is not flying — it is being flown, and
   * the moment the updraft stops it sinks. This is where a player finds out they are the reason it can go home.
   */
  private soar(dt: number, wind: WindSample, child: THREE.Vector3): void {
    this.glideT += dt;
    const afloat = this.water && this.water.over(this.position.x, this.position.z) ? this.water.level : null;
    const ground = afloat ?? Math.max(heightAt(this.position.x, this.position.z), 0);
    const room = 1 - THREE.MathUtils.smoothstep(this.position.y - ground, CEILING - 2, CEILING);
    const l = this.labour;
    /**
     * Laboured, it goes up only as fast as the wind is wound and comes down the moment it stops, for as long as the
     * player keeps at it: the climb is theirs to make and theirs to lose.
     */
    const fading = l ? 1 : 1 - THREE.MathUtils.smoothstep(this.glideT, GLIDE_FOR - 2.5, GLIDE_FOR);
    this.air += (wind.lift * (l?.gain ?? 9) * room * fading - (l?.sink ?? 3.4)) * dt;
    this.air = clamp(this.air, -3.2, l?.rise ?? 3.6);
    this.position.y += this.air * dt;

    /** It cannot steer: it goes where the air goes, sliding downwind and turning to face its own drift. Held in a column, hardly at all. */
    const drift = l ? 0.04 : 0.22 + this.glide * 0.3;
    const headway = l ? 0.25 : 1.1;
    let vx = wind.x * drift + Math.sin(this.yaw) * headway;
    let vz = wind.z * drift + Math.cos(this.yaw) * headway;
    /** Capped, so a hard gust cannot carry it out of the frame and lose the player the only thing they care about. */
    const speed = Math.hypot(vx, vz);
    if (speed > 2.6) {
      vx *= 2.6 / speed;
      vz *= 2.6 / speed;
    }
    this.position.x += vx * dt;
    this.position.z += vz * dt;
    if (Math.hypot(wind.x, wind.z) > 0.6) {
      this.yaw = easeAngle(this.yaw, Math.atan2(wind.x, wind.z), 1.1, dt);
    }
    this.roll = ease(this.roll, Math.sin(this.time * 0.9) * 0.2, 2, dt);
    /** Nose up while the air carries it, down as it sinks: the whole bird tells you which way it is going. */
    this.pitch = ease(this.pitch, clamp(-this.air * 0.16, -0.45, 0.35), 3, dt);
    const climbing = this.air > 0.4;
    this.flap = ease(this.flap, climbing ? 0.8 : 0.15, 3, dt);
    this.flapPhase += dt * (climbing ? 7 : 3);
    this.effort = Math.max(0, this.air) * 0.18;
    /** It looks down at the one who is watching it fly. */


    if (this.position.y <= ground && afloat !== null) {
      /** It came down over the water, which is the one landing it cannot make badly: it simply floats. */
      this.swimLevel = afloat;
      this.swimTo(this.tmp.set(this.position.x, afloat, this.position.z));
      this.dunk = 1;
      this.bind(0.12);
      return;
    }
    if (this.position.y <= ground) {
      this.position.y = ground;
      this.state = 'following';
      this.landedAt = this.time;
      this.landing = 0.75 + 0.5 / Math.max(1, this.flights);
      this.heard.push({ kind: 'tumble', amount: 0.4 });
      this.roll = 0;
      this.pitch = 0;
      this.effort = 0;
      this.settle = 0;
      /** It goes up because of the player and comes down safe because of the player, and it knows. */
      this.bind(0.12);
    }
  }

  /**
   * The descent. Along the flock's line at first, sinking; then away from it and down. Every burst of flapping
   * lifts it a little and pitches it up, and every time the burst gives out it sags, drops a wing and slews.
   * By the end it has no control left at all and goes into the grass on its side.
   */
  private descend(dt: number): void {
    this.fallT = Math.min(1, this.fallT + dt / this.fallFor);
    const k = this.fallT;
    const phase = ((k * this.fallFor) / 2.05) * Math.PI * 2;
    const burst = THREE.MathUtils.smoothstep(Math.sin(phase), -0.1, 0.55);
    this.effort = burst;
    this.flap = 0.3 + burst * 0.7;
    this.flapPhase += dt * (5 + burst * 8);

    const u = 1 - k;
    const drop = this.fallFrom.y - this.fallTo.y;
    this.position.set(
      u * u * this.fallFrom.x + 2 * u * k * this.fallDrift.x + k * k * this.fallTo.x,
      u * u * this.fallFrom.y + 2 * u * k * this.fallDrift.y + k * k * this.fallTo.y + burst * 0.07 * u * drop,
      u * u * this.fallFrom.z + 2 * u * k * this.fallDrift.z + k * k * this.fallTo.z,
    );
    const ground = Math.max(heightAt(this.position.x, this.position.z), 0);
    this.position.y = Math.max(this.position.y, ground);

    const losing = THREE.MathUtils.smoothstep(k, 0.86, 1);
    this.roll = Math.sin(phase * 0.63 + 0.8) * (0.45 + 0.45 * k) * (1 - burst * 0.5) + losing * 1.35;
    this.pitch = lerp(0.42 + 0.2 * k, -0.4, burst) + losing * 0.3;
    this.slew = Math.sin(phase * 0.41) * 0.5;
    const travel = Math.atan2(this.fallTo.x - this.fallFrom.x, this.fallTo.z - this.fallFrom.z);
    const line = Math.atan2(this.fallDrift.x - this.fallFrom.x, this.fallDrift.z - this.fallFrom.z);
    this.yaw = line + wrapAngle(travel - line) * k + this.slew;
    if (this.time > this.nextCall) {
      this.call(false);
      this.nextCall = this.time + 1.2 + Math.random() * 0.5;
    }

    if (this.fallT >= 1) {
      this.wing.restore('hurt');
      this.state = 'downed';
      this.heard.push({ kind: 'tumble', amount: 1 });
      this.struggle = 0;
      this.settle = 1;
      this.flop = 1;
      this.roll = 0;
      this.pitch = 0;
      this.position.y = ground;
      this.fear = 0.9;
      this.puff = 1;
    }
  }

  /** On the ground: three goes at getting up, each weaker than the last, and then it stops trying. */
  private struggling(dt: number): void {
    this.struggle = Math.min(1, this.struggle + dt / 9);
    const s = this.struggle;
    let rise = 0;
    let amp = 0;
    for (const [start, strength] of [
      [0.05, 1],
      [0.38, 0.72],
      [0.7, 0.45],
    ]) {
      const w = (s - start) / 0.2;
      if (w >= 0 && w <= 1) {
        rise = Math.sin(w * Math.PI) ** 0.8 * strength;
        amp = strength;
      }
    }
    this.effort = rise;
    this.flap = rise > 0.05 ? 1 : 0;
    this.flapPhase += dt * (4 + rise * 14);
    /** The first push is what rights it; after that it is upright and simply cannot stay up. */
    this.flop = Math.max(0, Math.min(this.flop, 1 - s * 4));
    this.settle = 1 - rise;
    const ground = Math.max(heightAt(this.position.x, this.position.z), 0);
    this.position.y = ground + rise * rise * 0.1 * amp;
    if (rise > 0.3) {
      this.stride += dt * 9 * amp;
      this.position.x += Math.sin(this.yaw) * dt * 0.35 * amp;
      this.position.z += Math.cos(this.yaw) * dt * 0.35 * amp;
    }
    this.roll = ease(this.roll, rise > 0.05 ? Math.sin(this.stride * 0.5) * 0.25 * amp : 0, 4, dt);
    if (rise < 0.05 && this.time > this.nextCall) {
      this.call(false);
      this.nextCall = this.time + 2 + Math.random() * 0.8;
    }
    if (this.struggle >= 1) {
      this.state = 'fallen';
      this.settle = 1;
      this.flop = 0;
      this.fear = 0.7;
    }
  }

  /** Down and staying down, in the grass or in the dark, calling now and then and watching for the child. */
  private rest(dt: number, child: THREE.Vector3): void {
    this.settle = Math.min(1, this.settle + dt * 0.5);
    this.effort = 0;
    const gap = Math.hypot(child.x - this.position.x, child.z - this.position.z);
    /** It stays frightened until the child is there. That is what the child is for. */
    if (gap < 3) this.fear = Math.max(0.15, this.fear - dt * 0.12);
    if (this.time > this.nextCall) {
      this.call(false);
      this.nextCall = this.time + (this.fear > 0.6 ? 3.6 : 7) + Math.random() * 2;
    }
    this.position.y = Math.max(heightAt(this.position.x, this.position.z), 0);
    this.begging(gap);
  }

  private walk(dt: number, child: THREE.Vector3): void {
    const ground = Math.max(heightAt(this.position.x, this.position.z), 0);
    if (this.debug.stand) {
      this.position.y = ground;
      return;
    }
    if (this.hopT > 0) {
      this.hopping(dt, ground);
      return;
    }
    if (this.landing > 0) {
      /** Flares, hits the ground running, and takes two or three steps to stop. */
      this.landing -= dt;
      const run = clamp(this.landing / 0.75, 0, 1);
      this.stride += dt * 13 * run;
      this.position.x += Math.sin(this.yaw) * 1.6 * run * dt;
      this.position.z += Math.cos(this.yaw) * 1.6 * run * dt;
      this.flap = ease(this.flap, run, 5, dt);
      this.effort = ease(this.effort, 0, 6, dt);
      this.hurry = run;
      this.position.y = Math.max(heightAt(this.position.x, this.position.z), 0);
      /** Its first landings end on its breast; it gets better at them, and never good. */
      const clumsy = 1 / Math.max(1, this.flights);
      this.faceplant = clumsy * Math.sin(clamp(1 - this.landing / 0.75, 0, 1) * Math.PI) ** 0.7;
      if (this.landing <= 0) {
        this.faceplant = 0;
        this.mind.perform('shake');
        this.mind.startle(0);
      }
      return;
    }
    this.effort = 0;
    /** Frightened, it wants to be right at their feet, and runs there. */
    const seeking = this.mind.seeking && !this.errand;
    /** Off on something of its own, it makes for that instead, and nothing about the child comes into it. */
    const goal = this.errand ?? child;
    const keep = this.errand ? 0.3 : seeking ? 0.6 : 2.6 - this.bond * 1.6;
    const dx = goal.x - this.position.x;
    const dz = goal.z - this.position.z;
    const gap = Math.hypot(dx, dz);
    if (this.errand && gap < 0.45) this.errand = null;
    /** It is a beat behind: it notices the child has gone before it goes after them. */
    if (gap > keep + 0.6 && this.childSpeed > 1) this.notice = Math.min(0.45, this.notice + dt);
    else this.notice = Math.max(0, this.notice - dt * 2);
    const wants = this.errand ? clamp((gap - keep) / 1.0, 0, 1) : seeking ? clamp((gap - keep) / 1.2, 0, 1) : this.notice >= 0.45 || gap > keep + 4 ? clamp((gap - keep) / 5, 0, 1) : 0;
    const hurry = this.stay ? 0 : wants;
    this.hurry = ease(this.hurry, hurry, 4, dt);
    const speed = this.hurry * (1.5 + 2.9 * this.hurry) * this.pace;
    if (gap > 0.2 && speed > 0.05) this.turnTo(Math.atan2(dx, dz), 4 + 3 * hurry, 1.7 + 1.0 * hurry, dt);
    if (speed > 0.02) {
      this.position.x += Math.sin(this.yaw) * speed * dt;
      this.position.z += Math.cos(this.yaw) * speed * dt;
      this.stride += dt * (6 + speed * 2.8);
      this.settle = Math.max(0, this.settle - dt * 2.5);
    } else {
      /** Stands a while, then sits down where it is, and sooner the more it trusts them to come back. */
      this.settle = Math.min(1, this.settle + dt * (0.12 + this.bond * 0.1));
      if (gap > 0.6 && gap < 3.5 && this.settle < 0.5) this.turnTo(Math.atan2(dx, dz), 1.2, 1.4, dt);
      /** Left standing, it now and then stretches up and calls for the family that is not there. */
      if (this.childSpeed < 0.3 && this.time > this.nextCall && !this.mind.told) {
        this.call(true);
        this.nextCall = this.time + 11 + Math.random() * 7;
      }
    }
    /** Wings out for balance when it runs, the way a chick that cannot fly still uses them. */
    this.flap = ease(this.flap, this.hurry > 0.5 ? 0.75 : 0, 5, dt);
    if (this.mind.act === 'bowled') {
      /** Knocked a step or two downwind, and no further. */
      const push = this.mind.actEnv * 1.3 * dt;
      const speedNow = Math.hypot(this.windNow.x, this.windNow.z) || 1;
      this.position.x += (this.windNow.x / speedNow) * push;
      this.position.z += (this.windNow.z / speedNow) * push;
      this.stride += dt * 14 * this.mind.actEnv;
    }
    this.position.y = Math.max(heightAt(this.position.x, this.position.z), 0);
    this.begging(gap);
  }

  /** Turns toward a bearing no faster than its feet can take it round: a body that spins over planted feet is sliding. */
  private turnTo(bearing: number, rate: number, limit: number, dt: number): void {
    const step = wrapAngle(bearing - this.yaw) * (1 - Math.exp(-rate * dt));
    this.yaw += clamp(step, -limit * dt, limit * dt);
  }

  /**
   * Afloat. It makes for the place it was given at its own best speed, which is not much, works harder the further
   * behind it falls, and rides whatever the sea is doing. Nothing about this can go wrong: it floats.
   */
  private paddling(dt: number): void {
    this.swum += dt;
    const entering = this.seating.move !== null;
    if (!entering && this.dunk === 1) {
      this.heard.push({ kind: 'plunge', amount: 1 });
      this.dunk = 0.999;
    }
    if (!entering) this.dunk = Math.max(0, this.dunk - dt * 1.1);
    const dx = this.swimAim.x - this.position.x;
    const dz = this.swimAim.z - this.position.z;
    const gap = Math.hypot(dx, dz);
    this.swimJoy = ease(this.swimJoy, entering ? 0 : this.swimPlay, 3, dt);
    const burst = this.swimJoy * (0.5 + 0.5 * Math.sin(this.swum * 2.4)) ** 2;
    const top = 2.3 + (tuning.littleBoats.swimSpeed - 2.3) * burst;
    const want = entering ? 0 : clamp(gap * (1.1 + burst * 0.65), 0, top);
    this.swimSpeed = ease(this.swimSpeed, want, 1.6, dt);
    if (gap > 0.15) this.turnTo(Math.atan2(dx, dz), 3, 2.2, dt);
    this.position.x += Math.sin(this.yaw) * this.swimSpeed * dt;
    this.position.z += Math.cos(this.yaw) * this.swimSpeed * dt;
    /** Down with the plunge and up again past where it floats, then the sea's own slow lift. */
    const bobbing = Math.sin(this.time * 1.3 + 0.7) * 0.03 + Math.sin(this.time * 2.7) * 0.012;
    this.position.y = this.swimLevel + bobbing - 0.26 * Math.sin(this.dunk * Math.PI) * this.dunk;
    this.effort = ease(this.effort, Math.max(clamp((gap - 2.5) / 4, 0, 0.6), burst * 0.6), 3, dt);
    // Little wing flicks and quick alternating kicks between calmer glides.
    this.flap = ease(this.flap, Math.max(this.effort > 0.3 ? 0.5 : 0, burst * 0.8), 5, dt);
    this.hurry = clamp(this.swimSpeed / 2.3, 0, 1);
    this.stride += dt * (2.5 + this.swimSpeed * 3.2 + burst * 6);
    this.position.y += burst * 0.025 * Math.sin(this.stride * 2);
    if (this.time > this.nextPaddle && this.swimSpeed > 0.3) {
      this.heard.push({ kind: 'paddle', amount: this.hurry });
      this.nextPaddle = this.time + 0.62 / (0.5 + this.hurry);
    }
    this.settle = 0;
  }

  /** A chick flutters and reaches up when someone it trusts comes back to it, or stands right over it. */
  private begging(gap: number): void {
    if (this.time < this.nextBeg || this.fear > 0.5) return;
    const returning = this.bond > 0.3 && gap < 1.8 && this.childSpeed > 0.8;
    const overIt = gap < 1.5 && this.childSpeed < 0.3;
    if (returning || overIt) {
      this.beg = 1.4;
      this.nextBeg = this.time + (overIt ? 4.5 : 9);
    }
  }

  /** A crouch and a look up, then everything it has straight up, three times, and a stumble when it comes down. */
  private hopping(dt: number, ground: number): void {
    this.hopT -= dt;
    const t = HOP_FOR - this.hopT;
    let hop = 0;
    let run = 0;
    this.turnTo(this.runBearing, 6, 4.5, dt);
    if (t < 0.8) {
      /** It gathers itself: a crouch, a long look up at where it means to go, wings coming off its back. */
      this.effort = 0.3;
      this.flap = ease(this.flap, 0.5, 6, dt);
      this.settle = ease(this.settle, 0.45, 8, dt);
    } else if (t < RUN_UNTIL) {
      /** The run: feet slapping, wings going as hard as they will, and each bound a little higher than the last. */
      const w = (t - 0.8) / (RUN_UNTIL - 0.8);
      run = 0.8 + 2.6 * w;
      const bound = (t - 0.8) / 0.42;
      hop = Math.max(0, Math.sin((bound - Math.floor(bound)) * Math.PI)) ** 1.3 * (0.05 + w * 0.2);
      this.effort = 1;
      this.flap = 1;
      this.flapPhase += dt * 17;
      this.settle = 0;
      this.roll = ease(this.roll, Math.sin(bound * Math.PI) * 0.16, 6, dt);
    } else {
      /** And it is not enough. It comes down on its breast, slides, and lies there a moment before it sits up. */
      const w = (t - RUN_UNTIL) / (HOP_FOR - RUN_UNTIL);
      if (this.faceplant === 0) this.heard.push({ kind: 'tumble', amount: 0.55 });
      run = 2.2 * Math.max(0, 1 - w * 3.2);
      /** Down hard, and then it lies there. Getting up again is slower than going down, which is what makes it tender. */
      this.faceplant = Math.max(0.001, Math.min(1, w * 3.4) ** 0.6 * (1 - THREE.MathUtils.smoothstep(w, 0.55, 1)));
      this.effort = ease(this.effort, 0, 8, dt);
      this.flap = ease(this.flap, 0.25 * (1 - w), 6, dt);
      this.roll = ease(this.roll, 0, 5, dt);
      if (this.hopT <= 0.3 && this.hopT > 0.25) this.mind.perform('shake');
    }
    this.hurry = ease(this.hurry, run > 0.1 ? 1 : 0, 8, dt);
    this.position.x += Math.sin(this.yaw) * run * dt;
    this.position.z += Math.cos(this.yaw) * run * dt;
    this.hopLift = ease(this.hopLift, hop, 30, dt);
    this.position.y = Math.max(heightAt(this.position.x, this.position.z), 0) + this.hopLift;
    if (this.hopT <= 0) {
      this.landedAt = this.time;
      this.settle = 0;
      this.faceplant = 0;
      /** The first thing it does afterwards is look at whoever was watching. */
      this.mind.startle(0);
    }
  }

  /** Riding: shifting its weight, dozing off on a long quiet stretch, and watching what the child watches. */
  private passenger(dt: number): void {
    this.rideFor += dt;
    this.effort = 0;
    this.flap = ease(this.flap, 0, 6, dt);
    this.calm = this.seating.calm;
    const dozy = this.seating.riding && this.bond > 0.45 && this.rideFor > 22 && this.calm > 0.85 && this.fear < 0.3;
    this.doze = ease(this.doze, dozy ? 1 : 0, dozy ? 0.15 : 3, dt);
    if (this.time > this.nextWriggle && this.doze < 0.5 && this.seating.move === null) {
      this.wriggle = 0.8;
      this.nextWriggle = this.time + 7 + Math.random() * 8;
    }
    this.wriggle = Math.max(0, this.wriggle - dt);
    /**
     * A passenger's own balance: it leans against every turn the child makes and rocks a little with their walking,
     * and when they stop it comes upright and stays there. All of it off the seat's own lag, so none of it is jitter.
     */
    const against = clamp(-this.seating.jostle.x * 3.5, -0.13, 0.13);
    const rock = Math.sin(this.time * 2.1) * 0.022 * clamp(this.seating.speed * 0.6, 0, 1);
    this.roll = ease(this.roll, (against + rock) * (1 - this.doze * 0.8), 3, dt);
    if (this.mind.told && this.state === 'hooded' && this.time > this.nextCall) {
      /** In the hood with the family in sight: it stretches up and calls to them, and nothing answers. */
      this.call(true);
      this.nextCall = this.time + 5 + Math.random() * 1.5;
    }
  }

  /** Blinking and breathing, and then the mind: what it notices, how that makes it feel, and what it does about it. */
  private live(dt: number, child: THREE.Vector3): void {
    this.nextBlink -= dt;
    if (this.nextBlink <= 0 && this.blinkT <= 0) {
      this.blinkT = 0.16;
      this.nextBlink = Math.random() < 0.25 ? 0.25 : (1.8 + Math.random() * 3.5) / (1 + this.fear);
    }
    if (this.blinkT > 0) {
      this.blinkT -= dt;
      this.blink = Math.sin(clamp(this.blinkT / 0.16, 0, 1) * Math.PI);
    } else this.blink = 0;
    this.beg = Math.max(0, this.beg - dt);
    this.callT = Math.max(0, this.callT - dt);
    /** Breathing hard after the fall, slow and deep asleep, quick when it is frightened. */
    this.puff = Math.max(0, this.puff - dt * 0.05);
    const rate = lerp(0.9 + this.fear * 1.4 + this.puff * 1.6 + this.effort * 1.2, 0.45, this.doze);
    this.breath += dt * rate * Math.PI * 2;

    const s = this.senses;
    const w = this.world;
    const st = this.state;
    this.eye(s.eye);
    s.childSpeed = this.childSpeed;
    s.gap = Math.hypot(child.x - this.position.x, child.z - this.position.z);
    s.hands = w.hands;
    s.plane = w.plane;
    s.creature = w.creature;
    s.flock = w.flock;
    s.light = w.light;
    s.cold = w.cold;
    s.rain = w.rain;
    s.dark = w.dark;
    /** On the side of the boat it is riding too: a gust may ruffle it there, but never bowl it off the gunwale into the sea. */
    s.where = this.carried || st === 'perched' || st === 'swimming' ? 'riding' : st === 'following' ? 'afoot' : st === 'fallen' || st === 'downed' ? 'down' : 'airborne';
    s.locked = this.hopT > 0 || this.landing > 0 || this.seating.move !== null || this.seating.held;
    s.busy = s.locked || this.callT > 0 || this.doze > 0.3 || this.hope > 0.3;
    this.mind.update(dt, s);
  }

  /** Stretches up and opens its bill, two or three times; the sound is the story's to make, at the same moment. */
  call(longing: boolean): void {
    this.callT = longing ? 1.4 : 0.8 - this.fear * 0.25;
    this.callLong = longing;
  }

  private pose(dt: number): void {
    const n = this.nodes;
    const st = this.state;
    const d = this.drives;
    // The grass visibility bias must ease away afloat, or submerged feet draw over the water.
    this.mat.uniforms.uNudge.value = ease(this.mat.uniforms.uNudge.value, st === 'swimming' ? 0 : 2.4, 8, dt);
    const m = this.mind;
    if (this.debug.stand) this.settle = 0;
    d.time = this.time;
    d.carried = this.carried;
    d.seat = this.seating.seat;
    d.inHands = this.seating.held;
    d.move = this.seating.move?.kind ?? null;
    d.jostle = this.carried ? this.seating.jostle.z : 0;
    d.falling = st === 'falling';
    d.gliding = st === 'flying' || st === 'gliding' || st === 'fledging';
    d.leaving = st === 'leaving';
    d.afoot = st === 'following';
    d.downed = st === 'downed';
    d.afloat = st === 'swimming' && this.seating.move === null;
    d.perched = st === 'perched';
    d.settle = this.grounded || st === 'following' ? this.settle : 0;
    d.fear = this.fear;
    d.bond = this.bond;
    d.cold = m.feel.cold;
    d.effort = this.effort;
    d.flap = this.flap;
    d.glide = this.glide;
    d.look = this.craning;
    d.tucked = this.tucked;
    d.hope = this.hope;
    d.hopLift = this.hopLift;
    d.crouch = this.hopT > HOP_FOR - 0.8 ? 1 : 0;
    d.landing = clamp(this.landing / 0.75, 0, 1);
    d.faceplant = this.faceplant;
    d.flop = this.flop;
    d.doze = this.doze;
    d.wriggle = this.wriggle;
    d.puff = this.puff;
    d.stride = this.stride;
    d.hurry = this.hurry;
    d.pitch = this.pitch;
    d.roll = this.roll;
    d.beg = this.beg;
    const callFor = this.callLong ? 1.4 : 0.8 - this.fear * 0.25;
    d.call.env = this.callT > 0 ? Math.sin(Math.min(1, this.callT / callFor) * Math.PI) ** 0.5 : 0;
    d.call.note = this.callLong ? Math.max(0, Math.sin(this.callT * Math.PI * 1.45)) : Math.max(0, Math.sin(this.callT * Math.PI * 3.8));
    d.call.long = this.callLong;
    d.act = m.act;
    d.actK = m.actK;
    d.actEnv = m.actEnv;
    d.actSide = m.actSide;
    d.breath = this.breath;
    d.blink = this.blink;
    d.wingGuard = this.wing.guard;
    d.wingOpening = this.wing.opening;

    const yaw = this.seating.yaw;
    const cy = Math.cos(yaw);
    const sy = Math.sin(yaw);
    d.wind.x = this.windNow.x * cy - this.windNow.z * sy;
    d.wind.z = this.windNow.x * sy + this.windNow.z * cy;
    d.actYaw = wrapAngle(Math.atan2(m.actAt.x - this.position.x, m.actAt.z - this.position.z) - yaw);
    this.aim(yaw);

    /** On its own feet and not hopping, its legs belong to the ground it is walking on. */
    const walking = st === 'following' && this.hopT <= 0 && this.landing <= 0 && this.seating.move === null && !this.seating.held;
    d.gait.on = walking;
    if (walking) {
      const g = this.gait;
      g.update(dt, this.position, this.yaw, heightAt);
      for (let i = 0; i < g.footfalls; i++) this.heard.push({ kind: 'step', amount: 0.6 + g.pace * 0.6 });
      for (const [i, f] of g.feet.entries()) {
        const out = d.gait.feet[i];
        const rx = (f.at.x - this.position.x) / SIZE;
        const rz = (f.at.z - this.position.z) / SIZE;
        out.x = rx * cy - rz * sy;
        out.z = rx * sy + rz * cy;
        out.y = (f.at.y - this.position.y) / SIZE;
      }
      d.gait.sway = g.sway;
      d.gait.roll = g.roll;
      d.gait.twist = g.twist;
      d.gait.dip = g.dip;
      d.gait.pace = g.pace;
    } else this.gaitStale = true;
    if (walking && this.gaitStale) {
      this.gait.reset(this.position, this.yaw);
      this.gaitStale = false;
    }

    const strokeWas = Math.floor(this.flapPhase / (Math.PI * 2));
    this.flapPhase += dt * (5 + this.glide * 3 + (st === 'following' ? this.hurry * 6 : 0));
    d.flapPhase = this.flapPhase;
    const beating = Math.max(this.effort, this.flap * 0.7);
    if (beating > 0.3 && Math.floor(this.flapPhase / (Math.PI * 2)) !== strokeWas) this.heard.push({ kind: 'flap', amount: beating });
    if (m.act !== this.actWas) {
      if (m.act === 'shake') this.heard.push({ kind: 'shake', amount: 1 });
      else if (m.act === 'bowled') this.heard.push({ kind: 'flutter', amount: 0.9 });
      else if (m.act === 'ask') this.heard.push({ kind: 'flutter', amount: 0.5 });
      /** Cold all through it, and the breath that gets it up again: both of them are its own down moving. */
      else if (m.act === 'shiver') this.heard.push({ kind: 'rustle', amount: 0.5 });
      else if (m.act === 'into-wind') this.heard.push({ kind: 'rustle', amount: 0.7 });
      this.actWas = m.act;
    }
    if (this.seating.move?.kind === 'climb' && this.time > this.nextRustle) {
      this.heard.push({ kind: 'rustle', amount: 1 });
      this.nextRustle = this.time + 0.16 + Math.random() * 0.14;
    }

    this.root.scale.setScalar(SIZE);
    const posed = this.poser.update(n, d, dt);
    this.bodyLift = posed.bodyLift;

    const look = this.look;
    look.blink = posed.blink;
    look.fluff = posed.fluff;
    look.sleek = posed.sleek;
    look.wet = m.wet;
    look.wingOpen = posed.wingOpen;
    look.wind.set(this.windNow.x, this.windNow.z);
    applyLook(this.mat, look);
    this.mat.uniforms.uBandage.value = this.wing.covered;

    /** Placed last, once the pose knows how high the body rides on its origin, so a seat or a hand holds the body itself. */
    this.seating.tick(dt);
    this.seating.stand(this.position, this.yaw);
    this.seating.update(dt, this.bodyLift);
    this.root.position.copy(this.seating.shown.p);
    this.root.quaternion.copy(this.seating.shown.q).multiply(this.tilt.setFromEuler(this.tiltBy.set(posed.rootPitch, 0, posed.rootRoll)));
    for (const [bone, r] of Object.entries(this.debug.bones)) n[Number(bone)].rotation.set(r[0], r[1], r[2]);
    this.root.updateMatrixWorld(true);
    for (let i = 0; i < BONES; i++) this.bones[i].multiplyMatrices(n[i].matrixWorld, this.unbind[i]);
    this.wing.update(dt, this.time, n[FORE_L].matrixWorld, this.bones, this.windNow, this.visible, this.mat.uniforms.uNudge.value);
  }

  /** Turns what the mind is looking at into a direction for the head, relative to the way the body faces. */
  private aim(yaw: number): void {
    const m = this.mind;
    const g = this.drives.gaze;
    g.firm = m.interest === 'told';
    g.wandering = !m.hasGaze;
    if (!m.hasGaze) {
      /** Looking at nothing: the head drifts, and mostly ahead. */
      g.yaw = Math.sin(this.time * 0.31) * 0.5 + Math.sin(this.time * 0.13 + 2) * 0.4;
      g.pitch = Math.sin(this.time * 0.23) * 0.12;
      return;
    }
    this.to.copy(m.gaze);
    /** Told to watch someone standing near it, it looks at their face, not their boots. */
    const near = Math.hypot(m.gaze.x - this.seating.shown.p.x, m.gaze.z - this.seating.shown.p.z) < 4;
    if (g.firm && near && Math.abs(m.gaze.y - Math.max(heightAt(m.gaze.x, m.gaze.z), 0)) < 0.6) this.to.y += 1.9;
    this.to.sub(this.eye(this.tmp2));
    g.yaw = clamp(wrapAngle(Math.atan2(this.to.x, this.to.z) - yaw), -1.5, 1.5);
    g.pitch = -clamp(Math.atan2(this.to.y, Math.hypot(this.to.x, this.to.z)), -1.1, 0.9);
  }
}
