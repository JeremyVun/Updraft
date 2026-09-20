import * as THREE from 'three';
import type { Shot } from '../camera';
import type { Coax } from '../fx/swirl';
import { tuning } from '../tuning';
import { heightAt } from '../world/island';
import { BED, BED_FACING, HILLTOP, PILLOW, WINDOW, SLEEP_LEDGE, SLEEP_APPROACH, CURTAIN_END, CURTAIN_KNOT, SLEEP_BERTH, SLEEP_LANDING } from '../world/sleeping';
import type { Cast, Chapter } from './cast';
import { completeObjective, cue } from './cues';

type Beat =
  | 'ashore'
  | 'toBed'
  | 'tuckIn'
  | 'asleep'
  | 'feather'
  | 'edge'
  | 'climb'
  | 'shiver'
  | 'unbinding'
  | 'hilltop'
  | 'reachRibbon'
  | 'pullRibbon'
  | 'glide'
  | 'waking'
  | 'lap'
  | 'toBoat'
  | 'push'
  | 'aboard';

const T = tuning.sleeping;
/** Across the bed, at right angles to the way its head end points. */
const BESIDE = new THREE.Vector2(-BED_FACING.y, BED_FACING.x);
/** Where the cygnet sits on the blanket: beside the child's knees, clear of their face in the bedside shot. */
const ON_BLANKET = new THREE.Vector3(
  BED.x - BESIDE.x * 0.6 - BED_FACING.x * 0.65,
  BED.y + 0.94,
  BED.z - BESIDE.y * 0.6 - BED_FACING.y * 0.65,
);
/** Where the child lies: the foot end of the mattress, at the height their body rides in it. */
const LIE_AT = new THREE.Vector3(BED.x - BED_FACING.x * 1.0, BED.y + T.lieHigh, BED.z - BED_FACING.y * 1.0);
/** Where they sit on the edge of it when they wake, before they put their boots on the frost. */
const SIT_AT = new THREE.Vector3(BED.x + BESIDE.x * 0.65, BED.y + T.sitHigh, BED.z + BESIDE.y * 0.65);
/** The way up: everything in this room happens along the line from the bed to the top of the hill. */
const UPHILL = new THREE.Vector2(HILLTOP.x - BED.x, HILLTOP.z - BED.z).normalize();
const TO_HILL = Math.hypot(HILLTOP.x - BED.x, HILLTOP.z - BED.z);
/** How far the grass round the bed is trodden flat, and where that gives out on the way up the hill. */
const TRODDEN = 7.5;
const EDGE = new THREE.Vector3(BED.x + UPHILL.x * TRODDEN, 0, BED.z + UPHILL.y * TRODDEN);
EDGE.y = Math.max(heightAt(EDGE.x, EDGE.z), 0);
/** Where the bird stands on the top: a little short of the summit, so the hill is still above it. */
const TOP = SLEEP_LEDGE;
const ROUTE_START = new THREE.Vector3(BED.x, BED.y, BED.z);


const lerp = THREE.MathUtils.lerp;
const smooth = THREE.MathUtils.smoothstep;

/**
 * The sleeping island: after the dark wood, before dawn, and the one room where the player leads the bird.
 *
 * The child has been up all night in a storm and there is a bed made up in the grass. They climb in with the paper
 * plane held against their chest and sleep, and they are plainly only asleep — the blanket rises and falls. What
 * worries the player is what is coming for them: the frost creeps in across the terrace, the fog thickens, the
 * light goes blue. The bird tries everything it has and none of it works, and then it calls once — the low hopeful
 * call, not the distress cry — and nothing answers.
 *
 * Then a brush of wind frees one long white feather from the pillow, and the controls do not change at all: the player blows a light
 * thing along and somebody follows it. The bird goes up the hill alone, and brings the morning back down it.
 */
export class SleepingChapter implements Chapter {
  beat: Beat = 'ashore';
  readonly breeze = 0.3;
  /** The last of the living world goes out of it as they come up the beach, and comes back with the morning. */
  worldLife = 1;
  pace = 0.4;
  haze = 0.82;
  dusk = 1.9;
  readonly season = 0.85;
  music: 'wood' | 'sea' = 'wood';
  hush = 0.5;
  readonly shot: Shot = { target: new THREE.Vector3(), distance: 16, height: 5, carry: true, clearance: 2.4 };
  readonly focus = new THREE.Vector3();
  trodden: THREE.Vector3 | null = null;

  private now = 0;
  private beatStart = 0;
  private moored = false;
  private tried = 0;
  private called = false;
  private callAt = 0;
  private pillowStroke = 0;
  private bedBreath = 0;
  private readonly bedEntry = new THREE.Vector3();
  private readonly birdEntry = new THREE.Vector3();
  private birdPlaced = false;
  private entryYaw = 0;
  private readonly blanketHand = [new THREE.Vector3(), new THREE.Vector3()];
  private readonly bedFocus = new THREE.Vector3();
  private readonly roomFocus = new THREE.Vector3();
  private readonly subjects = { primary: this.bedFocus, secondary: this.roomFocus, tertiary: undefined as THREE.Vector3 | undefined, margin: 0.76, extra: 9 };
  private looks = 0;
  private nextLook = 0;
  private turnAt = 0;
  private tighten = 0;

  private sat = false;
  private roundedShoulder = false;
  private readonly leapFrom = new THREE.Vector3();
  private readonly grip = new THREE.Vector3();
  private readonly beak = new THREE.Vector3();
  private leapYaw = 0;
  private leapBearing = 0;
  private ribbonCaught = false;
  private ribbonDraw = 0;
  private landYaw = 0;
  private warmed = 0;
  private laid = false;
  private readonly seat = new THREE.Vector3();
  private readonly aim = new THREE.Vector3(-1, 0, 0);
  private readonly side = new THREE.Vector3();
  private readonly spot = new THREE.Vector3();
  /**
   * Anything handed to somebody else is handed to them by reference and read by them every frame after: where the
   * child is looking, where the bird is looking, what it is walking to, the flattened grass and the camera's eye.
   * Each of them owns a vector of its own, because sharing one makes the camera tell the bird where to walk.
   */
  private readonly look = new THREE.Vector3();
  private readonly told = new THREE.Vector3();
  private readonly carrot = new THREE.Vector3();
  private readonly flat = new THREE.Vector3();
  private readonly perch = new THREE.Vector3();
  private readonly ahead = new THREE.Vector3(0, 0, -1);
  private readonly air = { x: 0, z: 0, energy: 0, lift: 0 };
  private readonly coaxing = { at: new THREE.Vector3(), urgency: 0 };
  private readonly laneFrom = new THREE.Vector2(WINDOW.x, WINDOW.z);
  private readonly laneTo = new THREE.Vector2(BED.x, BED.z);

  constructor(private readonly cast: Cast) {
    const { child, cygnet, sleeping } = cast;
    child.dismount();
    cygnet.mayFly = false;
    cygnet.pace = 1;
    cygnet.stay = false;
    sleeping.fog = 1;
    sleeping.frost = 0.3;
    sleeping.dawn = 0;
    sleeping.curtains = 0;
    sleeping.blanket = 0;
    sleeping.sleeper = 0;
    child.lieOn(LIE_AT, BED_FACING);
    child.walkTo(SLEEP_LANDING.x - 9, SLEEP_LANDING.y - 1, false, () => this.to('toBed'), 1.4);
  }

  /** Theirs for everything except the beats the two of them play out on their own. */
  get scripted(): boolean {
    return this.beat === 'ashore' || this.beat === 'toBed' || this.beat === 'tuckIn' || this.beat === 'push' || this.beat === 'aboard';
  }

  get departureKite(): boolean { return ['toBoat', 'push', 'aboard'].includes(this.beat); }

  get done(): boolean {
    return this.beat === 'aboard';
  }

  get checkpoint(): string | null {
    if (this.beat === 'toBoat') return 'morning';
    const k = this.cast.cygnet.position;
    return this.beat === 'climb' && Math.hypot(k.x - BED.x, k.z - BED.z) > TRODDEN - 1 ? 'feather' : null;
  }
  restoreCheckpoint(point: string): void {
    const { child: c, sleeping, cygnet: k } = this.cast;
    this.moored = true;
    if (point === 'morning') {
      this.warmed = 1; this.worldLife = 1; this.dusk = 1.02; this.haze = 0.6;
      sleeping.lane(this.laneFrom, this.laneTo, T.dawnLaneWidth);
      sleeping.ribbon.released = true;
      sleeping.dawn = sleeping.curtains = sleeping.laneOpen = 1;
      sleeping.fog = sleeping.frost = 0;
      this.board();
    } else {
      this.laid = true; this.called = true;
      c.lieOn(LIE_AT, BED_FACING); c.position.copy(LIE_AT); c.abed = c.eyesShut = 1;
      sleeping.sleeper = 1; sleeping.frost = T.frostAsleep;
      // Resume once the bird has left the bed, so its low camera starts clear of the sleeping child.
      sleeping.feather.release(this.spot.copy(k.position).setY(k.position.y + 1.4), this.side.set(UPHILL.x * 0.4, 0.2, UPHILL.y * 0.4));
      sleeping.feather.goal.copy(SLEEP_APPROACH).setY(SLEEP_APPROACH.y + 1.6);
      sleeping.feather.routeStart = ROUTE_START;
      sleeping.feather.keepNear = TO_HILL;
      k.pace = 0.6;
      this.looks = 2; this.dusk = 1.9; this.beat = 'climb';
    }
  }

  /** The one thing the player is asked for by name, and only at the top of the hill. */
  get invitesFlight(): boolean {
    return this.beat === 'hilltop';
  }

  get twirlGain(): number { return this.invitesFlight ? T.twirlGain : 1; }

  get windInvitation(): THREE.Vector3 | null {
    return this.beat === 'asleep' && this.called && this.t > this.callAt + 8.5 ? PILLOW : null;
  }

  /** The existing screen-space sweep reaches the pillow even when the ground lies behind it. */
  brushDry(amount: number): void { this.bedBreath = amount; }

  get coax(): Coax | null {
    const { cygnet } = this.cast;
    if (this.beat !== 'hilltop' || cygnet.flying) return null;
    this.coaxing.at.copy(cygnet.position);
    this.coaxing.urgency = smooth(this.t, tuning.swirl.coaxAfter, tuning.swirl.coaxAfter + tuning.swirl.coaxRamp);
    return this.coaxing.urgency > 0 ? this.coaxing : null;
  }

  private to(beat: Beat): void {
    this.beat = beat;
    this.beatStart = this.now;
    if (beat === 'tuckIn') {
      this.bedEntry.copy(this.cast.child.position);
      this.entryYaw = this.cast.child.yaw;
    }
  }

  private get t(): number {
    return this.now - this.beatStart;
  }

  /** How hard the player is blowing on a place, 0 to 1. */
  private blowing(x: number, z: number): number {
    const w = this.cast.wind.sample(x, z, this.air);
    return Math.min(1, w.energy * 1.6 + Math.max(0, Math.hypot(w.x, w.z) - 1.5) * 0.06);
  }

  update(dt: number, time: number): void {
    this.now = time;
    const { child: c, plane: p, sleeping } = this.cast;
    c.yawn = 0; c.sleepiness = 0;
    c.stroll = this.beat === 'ashore' || this.beat === 'toBed' ? T.tiredStroll : 1;

    switch (this.beat) {
      case 'ashore':
        c.lookAt = this.look.copy(sleeping.bedside).setY(sleeping.bedside.y + 0.9);
        break;
      case 'toBed':
        /** The boat goes round to the far shore while they are walking away from it, as it always does. */
        if (!this.moored && this.t > 2) {
          this.moored = true;
          this.cast.boat.beach(SLEEP_BERTH.x, SLEEP_BERTH.z, -1.76);
          this.cast.boat.grounded = true;
        }
        c.lookAt = this.look.copy(BED).setY(BED.y + 0.9);
        // Heavy eyelids, a slow yawn and two small recoveries before giving in at the bed.
        c.yawn = smooth(this.t, 2, 3.2) * (1 - smooth(this.t, 5, 6.5));
        c.sleepiness = 0.2 + 0.65 * (smooth(this.t, 8, 9.4) * (1 - smooth(this.t, 9.8, 10.5)));
        c.eyesShut = c.sleepiness * 0.65;
        if (!c.busy && !c.moving) c.walkTo(BED.x + BESIDE.x * 1.65, BED.z + BESIDE.y * 1.65, false, () => this.to('tuckIn'), 0.15);
        break;
      case 'tuckIn':
        this.tuckIn(dt);
        break;
      case 'asleep':
        this.asleep(dt);
        break;
      case 'feather':
        this.theFeather(dt);
        break;
      case 'edge':
        this.theEdge();
        break;
      case 'climb':
        this.climbing(dt);
        break;
      case 'shiver':
        this.shivering(dt);
        break;
      case 'hilltop':
        this.hilltop(dt);
        break;
      case 'unbinding':
        this.unbinding(dt);
        break;
      case 'reachRibbon':
        this.reachRibbon();
        break;
      case 'pullRibbon':
        this.pullRibbon(dt);
        break;
      case 'glide':
        this.gliding(dt);
        break;
      case 'waking':
        this.waking(dt);
        break;
      case 'lap':
        this.inTheLap(dt);
        break;
      case 'push':
        break;
      default:
        break;
    }

    /** The colour goes out of the world while the night has them, and comes back with the sun off the hill. */
    /** The bird brings life back: colour follows the light until the whole island is green again. */
    const warm = this.warmed > 0 ? lerp(0.06, 1, sleeping.dawn) : 0.06;
    this.worldLife += (warm - this.worldLife) * (1 - Math.exp(-dt * 0.4));
    /**
     * The sky goes from the wood's night, through the grey the hour before dawn actually is once the bird is out
     * on the hill, to the sunrise it brings back down. Nothing here gives the morning away before it arrives.
     */
    const atBed = this.beat === 'ashore' || this.beat === 'toBed' || this.beat === 'tuckIn' || this.beat === 'asleep' || this.beat === 'feather';
    const night = this.warmed > 0 ? lerp(1.9, 1.02, this.cast.sleeping.dawn) : 1.9;
    this.dusk += (night - this.dusk) * (1 - Math.exp(-dt * 0.22));
    /**
     * And the fog thickens over the bird's head as it goes: at the bed it lies low enough to see the room across,
     * and by the climb it is deep enough that the lanes the player carves are the only clear air in it.
     */
    sleeping.fogTop = this.warmed > 0 ? T.fogTop : atBed ? T.fogTop : T.fogClimbs;
    this.haze += ((this.warmed > 0 ? 0.6 : 0.82) - this.haze) * (1 - Math.exp(-dt * 0.2));
    this.tighten = Math.max(0, this.tighten - dt * 0.55);
    c.tighter = this.tighten;
    if (p.held) p.hold(c);
    /**
     * The plane stays tucked away through the embrace and returns to the satchel as they leave the bed. It is as
     * long as the child is tall, so holding it out where it could be seen over a sleeping child is the one thing
     * that cannot be staged: it is not lost, nobody fetches it, and it is exactly where they left it.
     */
    p.visible = c.abed < 0.55 && this.beat !== 'tuckIn' && this.beat !== 'waking' && this.beat !== 'lap';
    sleeping.sleeper = this.laid ? c.abed : 0;
    if (['edge', 'climb', 'shiver'].includes(this.beat)) {
      sleeping.feather.follow = this.cast.cygnet.position;
    } else sleeping.feather.follow = null;
    this.heading(dt);
    this.frame();
  }

  /** A child trying to stay awake: pause, make room for the bird, sit, nod, recline, then draw the quilt up. */
  private tuckIn(dt: number): void {
    const { child: c, cygnet: k, sleeping } = this.cast;
    const birdAt = T.bedPauseFor;
    const sitAt = birdAt + T.bedBirdFor;
    const drowseAt = sitAt + T.bedSitFor;
    const lieAt = drowseAt + T.bedDrowseFor;
    const tuckAt = lieAt + T.climbsIn;
    const settleAt = tuckAt + T.bedTuckFor;
    const end = settleAt + T.bedSettleFor;
    c.stop();
    c.lookAt = k.eye(this.look);
    c.sleepiness = 0.3;
    c.eyesShut = 0.12;
    sleeping.blanket = 0.95 * (1 - smooth(this.t, tuckAt + 0.3, settleAt - 0.3));
    if (this.t < birdAt) {
      c.faceToward(BED.x, BED.z, 1 - Math.exp(-dt * 1.6));
      c.yawn = smooth(this.t, 0.4, 1.4) * (1 - smooth(this.t, 2.3, 3.6));
      return;
    }
    if (!this.birdPlaced) { this.birdEntry.copy(k.position); this.entryYaw = c.yaw; this.birdPlaced = true; }
    const step = smooth(this.t, birdAt, sitAt);
    this.spot.lerpVectors(this.birdEntry, ON_BLANKET, step);
    this.spot.y += Math.sin(step * Math.PI) * 0.18;
    k.perch(this.spot, this.onBlanket(dt));
    k.watch(c.face(this.told));
    c.lean = 0.24 * Math.sin(step * Math.PI);
    if (this.t < sitAt) return;
    // Turn before sitting; the hips arrive on the mattress before the shoulders begin to descend.
    const turn = smooth(this.t, sitAt, sitAt + 1.2);
    const seatYaw = Math.atan2(BESIDE.x, BESIDE.y);
    c.yaw = this.entryYaw + Math.atan2(Math.sin(seatYaw - this.entryYaw), Math.cos(seatYaw - this.entryYaw)) * turn;
    const seat = smooth(this.t, sitAt + 1.0, drowseAt);
    c.sitting = this.t > sitAt + 1.0;
    c.position.lerpVectors(this.bedEntry, SIT_AT, seat);
    c.position.y += Math.sin(seat * Math.PI) * 0.14;
    if (this.t < drowseAt) {
      c.lean = 0.18 * Math.sin(seat * Math.PI);
      return;
    }
    const d = this.t - drowseAt;
    c.yawn = smooth(d, 0, 0.9) * (1 - smooth(d, 1.7, 2.8));
    const nod = smooth(d, 2.5, 3.3) * (1 - smooth(d, 3.5, 4.2));
    c.sleepiness = 0.25 + nod * 0.75;
    c.eyesShut = nod * 0.9;
    if (this.t < lieAt) return;
    this.laid = true;
    c.yawn = 0;
    c.sleepiness = 0;
    c.lookAt = null;
    c.abed = smooth(this.t, lieAt, tuckAt);
    c.lean = 0.12 * (1 - c.abed);
    const pull = smooth(this.t, tuckAt - 0.9, tuckAt + 0.2) * (1 - smooth(this.t, settleAt - 0.5, settleAt + 0.7));
    sleeping.blanketPull = T.blanketHandLift * pull;
    for (const hand of [0, 1] as const) {
      if (pull > 0.02) c.reachFor(hand, sleeping.blanketEdge(hand === 0 ? -0.42 : 0.42, this.blanketHand[hand]));
      else c.reachFor(hand, null);
    }
    // One last blink at the bird, then a long exhale into the pillow.
    c.eyesShut = 0.35 * smooth(this.t, tuckAt, settleAt) + 0.65 * smooth(this.t, settleAt + 0.5, end - 0.5);
    if (this.t >= end) {
      c.position.copy(LIE_AT); c.sitting = false; c.abed = c.eyesShut = 1;
      c.lean = 0; c.sleepiness = c.yawn = 0;
      c.reachFor(0, null); c.reachFor(1, null);
      sleeping.blanket = sleeping.blanketPull = 0;
      k.bind(0.03);
      this.to('asleep');
    }
  }

  /**
   * Which way it faces on the blanket, eased from whichever way it was facing when it got there. Whoever perches
   * it says where it is every frame, so a fixed bearing would turn it through whatever angle it arrived at in one.
   */
  private onBlanket(dt: number): number {
    const want = Math.atan2(BESIDE.x, BESIDE.y);
    if (this.landYaw === 0) this.landYaw = this.cast.cygnet.yaw;
    const turn = want - this.landYaw;
    this.landYaw += Math.atan2(Math.sin(turn), Math.cos(turn)) * (1 - Math.exp(-dt * 1.8));
    return this.landYaw;
  }

  /**
   * Asleep, and the night closing in on them. The bird tries everything it has — the scarf, a flutter, its head
   * under their hand — and the child only turns over. A gust on the bed lifts the blanket and they pull it tighter:
   * answered, and no use. Then the one call, which nothing answers, and a brush of the pillow frees the feather.
   */
  private asleep(dt: number): void {
    const { child: c, cygnet: k, sleeping } = this.cast;
    k.perch(ON_BLANKET, this.onBlanket(dt));
    const noticing = this.called && this.t - this.callAt > 2 && this.t - this.callAt < 7.5;
    k.watch(noticing ? this.told.copy(WINDOW) : c.face(this.told));
    /** The frost comes in across the hollow toward the bed the whole time they lie there. */
    sleeping.frost = lerp(0.3, T.frostAsleep, smooth(this.t, 0, 40));
    this.hush = lerp(this.hush, this.called && this.t - this.callAt < 7 ? 0.95 : 0.55, 1 - Math.exp(-dt * 0.8));

    /** Blowing on the bed lifts the blanket — the room does that itself — and the child draws it back round them. */
    sleeping.bedWind = this.bedBreath;
    if ((this.bedBreath > 0.02 || this.blowing(BED.x, BED.z) > 0.3) && this.tighten <= 0.05) {
      this.tighten = 1;
      this.turnAt = this.now + 1.6;
    }

    if (this.tried < 3 && this.t > T.triesFrom + this.tried * T.triesEvery) {
      if (this.tried === 0) k.does('tug', c.face(this.spot), 2.8), (this.spot.y -= 0.3);
      else if (this.tried === 1) k.plead();
      else k.does('nudge', c.mitten(0, this.spot));
      this.tried++;
      this.turnAt = this.now + 2.6;
    }
    /** All they do is turn over. */
    if (this.turnAt > 0 && this.now > this.turnAt) {
      this.turnAt = 0;
      c.abedSide = -c.abedSide;
    }

    if (!this.called && this.t > T.triesFrom + 3 * T.triesEvery) {
      this.called = true;
      this.callAt = this.t;
      k.call(true);
      cue('calling');
    }
    // A few quiet strokes suffice; time and ambient breeze never release the feather.
    if (this.windInvitation) this.pillowStroke += Math.max(0, this.bedBreath) * dt;
    if (this.pillowStroke >= T.featherStroke) this.toFeather();
    this.bedBreath = 0;
  }

  /** A puff of down, and one long white feather that hangs there. The bird looks at it, and at the child. */
  private toFeather(): void {
    const { sleeping } = this.cast;
    sleeping.bedWind = 0;
    this.to('feather');
    sleeping.pillowPuff();
    sleeping.feather.release(
      this.spot.set(PILLOW.x, PILLOW.y + 0.6, PILLOW.z),
      this.side.set(UPHILL.x * 0.4, 0.2, UPHILL.y * 0.4),
    );
    sleeping.feather.goal.copy(EDGE).setY(EDGE.y + 1.4);
    sleeping.feather.keepNear = 16;
    sleeping.feather.routeStart = ROUTE_START;
    cue('lifted');
  }

  private theFeather(dt: number): void {
    const { child: c, cygnet: k, sleeping } = this.cast;
    const f = sleeping.feather;
    this.hush = lerp(this.hush, 0.8, 1 - Math.exp(-dt * 0.8));
    if (this.t < 5.5) {
      k.perch(ON_BLANKET, this.onBlanket(dt));
      /** At the feather, then at the child, and then it goes. That order is the whole decision. */
      k.watch(this.t < 2.6 || this.t > 4.4 ? f.position : c.face(this.told));
      return;
    }
    /** Off the blanket and onto the grass beside the bed, by hopping down off it rather than by appearing there. */
    k.release(this.spot.set(BED.x + BESIDE.x * 1.5, 0, BED.z + BESIDE.y * 1.5));
    k.pace = 0.6;
    this.to('edge');
  }

  /** Its fear is leaving the child. It goes as far as the trodden grass goes, and stops, and looks back. */
  private theEdge(): void {
    const { cygnet: k, sleeping } = this.cast;
    const f = sleeping.feather;
    this.trodden = this.flat.set(BED.x, TRODDEN + 2, BED.z);
    const gap = Math.hypot(k.position.x - EDGE.x, k.position.z - EDGE.z);
    if (gap > 1.8 && this.looks === 0 && this.t < T.edgeFor) {
      this.lead(f.position);
      return;
    }
    k.stay = true;
    k.errand = null;
    if (this.looks === 0 && this.nextLook === 0) this.nextLook = this.now + 0.4;
    if (this.looks < 1 && this.now > this.nextLook) {
      this.looks++;
      k.does('look-back', this.told.copy(BED).setY(BED.y + 1.1), T.looksBack);
      k.watch(this.told);
      this.nextLook = this.now + T.looksBack + 1.2;
    }
    if (this.looks >= 1 && this.now > this.nextLook) {
      k.stay = false;
      k.watch(null);
      f.goal.copy(SLEEP_APPROACH).setY(SLEEP_APPROACH.y + 1.6);
      f.routeStart = EDGE;
      f.keepNear = TO_HILL;
      this.to('climb');
    }
  }

  /** Up the hill behind the feather, with the fog shutting behind it and the bed gone. */
  private climbing(dt: number): void {
    const { cygnet: k, sleeping } = this.cast;
    if (!this.roundedShoulder && k.position.distanceTo(SLEEP_APPROACH) < 2) {
      this.roundedShoulder = true;
      sleeping.feather.routeStart = SLEEP_APPROACH;
      sleeping.feather.goal.copy(TOP).setY(TOP.y + 1.4);
    }
    this.lead(sleeping.feather.position);
    k.pace = 0.58 + sleeping.feather.encouragement * 0.28;
    this.trodden = null;
    this.hush = lerp(this.hush, 0.75, 1 - Math.exp(-dt * 0.5));
    sleeping.frost = Math.min(T.frostWorst, sleeping.frost + dt * 0.012);
    /** A first touch of light on the crest ahead of it, which is the only reason to keep walking into the dark. */
    sleeping.dawn = Math.min(0.04, sleeping.dawn + dt * 0.006);
    const up = Math.hypot(k.position.x - BED.x, k.position.z - BED.z) / TO_HILL;
    if (!this.sat && up > T.shiverAt) {
      this.sat = true;
      k.stay = true;
      k.errand = null;
      k.does('shiver', undefined, 40);
      this.to('shiver');
      return;
    }
    if (this.roundedShoulder && Math.hypot(k.position.x - TOP.x, k.position.z - TOP.z) < 0.85) {
      k.stay = true;
      k.errand = null;
      k.watch(null);
      k.needs(T.liftToFly, null);
      k.mayFly = false;
      k.wing.recovery = 1;
      sleeping.feather.goal.copy(TOP).setY(TOP.y + 2.2);
      k.watch(this.told.copy(BED));
      this.to('unbinding');
      this.leapFrom.copy(k.position);
    }
  }

  /**
   * The fog has shut behind it and it cannot see the child any more, so it sits down where it is. Until now only
   * the child being near it could stop that. Here a breath from the player ruffles its down and it gets up, which
   * is the player being its company; left alone it gets up by itself, because nobody is stranded on this island.
   */
  private shivering(dt: number): void {
    const { cygnet: k, sleeping } = this.cast;
    const f = sleeping.feather;
    f.goal.set(
      k.position.x + UPHILL.x * 2.4,
      Math.max(heightAt(k.position.x, k.position.z), 0) + 1.3,
      k.position.z + UPHILL.y * 2.4,
    );
    k.watch(f.position);
    this.hush = lerp(this.hush, 0.9, 1 - Math.exp(-dt * 0.8));
    const breath = this.blowing(k.position.x, k.position.z);
    if (this.t > 1.6 && (breath > 0.12 || this.t > T.shiverFor)) {
      k.mind.trust(0.4);
      k.does('into-wind', undefined, 1.8);
      k.stay = false;
      f.goal.copy(this.roundedShoulder ? TOP : SLEEP_APPROACH);
      f.goal.y += 1.6;
      f.routeStart = this.roundedShoulder ? SLEEP_APPROACH : EDGE;
      this.to('climb');
    }
  }

  /**
   * The summit window holds a seam of morning above the fog, and the bed is nowhere. This is the one thing the player is
   * asked for: circles drawn round the bird stand a column at it and it goes, and a plain gust only makes it hope.
   * The invitation repeats until their circles lift it; the morning follows the flight.
   */
  private hilltop(dt: number): void {
    const { cygnet: k, sleeping } = this.cast;
    sleeping.feather.goal.set(k.position.x, Math.max(heightAt(k.position.x, k.position.z), 0) + 2.2, k.position.z);
    this.hush = lerp(this.hush, 0.85, 1 - Math.exp(-dt * 0.6));
    /** A faint spill at the curtain seam; full morning still waits for the updraft. */
    sleeping.dawn = Math.min(0.12, sleeping.dawn + dt * 0.03);
    sleeping.frost = Math.min(T.frostWorst, sleeping.frost + dt * 0.02);
    k.watch(this.told.copy(CURTAIN_END));
    const facing = Math.atan2(CURTAIN_END.x - k.position.x, CURTAIN_END.z - k.position.z);
    k.yaw += Math.atan2(Math.sin(facing - k.yaw), Math.cos(facing - k.yaw)) * (1 - Math.exp(-dt * 2.8));
    if (k.flying) {
      this.leapFrom.copy(k.position);
      this.leapBearing = k.yaw;
      this.leapYaw = Math.atan2(CURTAIN_KNOT.x - CURTAIN_END.x, CURTAIN_KNOT.z - CURTAIN_END.z);
      k.mayFly = false;
      this.to('reachRibbon');
    }
  }

  /** The wing has healed. Looking back for the child gives it a reason to trust that wing again. */
  private unbinding(dt: number): void {
    const { cygnet: k, sleeping } = this.cast;
    const care = tuning.wingCare;
    const feather = sleeping.feather;
    if (feather.flying) {
      feather.goal.copy(WINDOW).setY(WINDOW.y + 0.4);
      feather.position.lerp(feather.goal, 1 - Math.exp(-dt * 1.6));
      feather.velocity.multiplyScalar(Math.exp(-dt * 4));
      feather.fade = 1 - smooth(this.t, 2.5, 5.5);
      if (this.t >= 5.5) { feather.flying = false; feather.visible = false; }
    }
    k.stay = true; k.errand = null; k.mayFly = false;
    if (this.t < T.ledgeStudyFor) {
      k.watch(this.told.copy(CURTAIN_END));
      const reach = smooth(this.t, 0.8, 2.2) * (1 - smooth(this.t, 3.2, 4.5));
      this.spot.copy(this.leapFrom).lerp(TOP, reach * 0.6);
      k.perch(this.spot, Math.atan2(CURTAIN_END.x - k.position.x, CURTAIN_END.z - k.position.z));
      if (this.t > 1 && this.t < 1 + dt) k.plead();
      return;
    }
    k.watch(this.told.copy(BED));
    const facing = Math.atan2(BED.x - k.position.x, BED.z - k.position.z);
    k.yaw += Math.atan2(Math.sin(facing - k.yaw), Math.cos(facing - k.yaw)) * (1 - Math.exp(-dt * 1.4));
    k.wing.opening = smooth(this.t - T.ledgeStudyFor, care.lookBackFor, care.lookBackFor + care.openFor);
    sleeping.dawn = Math.min(0.12, sleeping.dawn + dt * 0.02);
    if (this.t - T.ledgeStudyFor > care.lookBackFor + care.openFor) k.wing.release();
    if (k.wing.flightReady && this.t - T.ledgeStudyFor > care.lookBackFor + care.openFor + care.unwindFor + 0.8) {
      k.watch(null);
      k.release(this.spot.copy(k.position));
      k.stay = true;
      k.mayFly = true;
      this.to('hilltop');
    }
  }

  /** The updraft earns the commitment. The last part of the reach solves the bill onto the loose end. */
  private reachRibbon(): void {
    const { cygnet: k, sleeping } = this.cast;
    const u = smooth(this.t, 0, T.leapFor);
    sleeping.ribbon.gripAt(0, this.grip);
    this.spot.copy(this.grip).add(this.side.set(-Math.sin(this.leapYaw) * 0.5, -1.25, -Math.cos(this.leapYaw) * 0.5));
    this.spot.lerpVectors(this.leapFrom, this.spot, u);
    this.spot.y += Math.sin(u * Math.PI) * 0.8;
    const yaw = this.leapBearing + Math.atan2(Math.sin(this.leapYaw - this.leapBearing), Math.cos(this.leapYaw - this.leapBearing)) * smooth(this.t, 0.5, T.leapFor);
    k.perch(this.spot, yaw);
    k.flightPose = smooth(this.t, 0, 0.5);
    k.billGrip = this.grip;
    k.billGripWeight = smooth(this.t, T.leapFor - 0.55, T.leapFor);
    k.watch(this.told.copy(CURTAIN_KNOT));
    sleeping.feather.flying = false;
    sleeping.feather.visible = false;
    if (this.t >= T.leapFor) {
      this.ribbonCaught = k.billTip(this.beak).distanceTo(this.grip) < 0.08;
      if (this.ribbonCaught) this.to('pullRibbon');
    }
  }

  /** Only a caught ribbon can be pulled. The knot runs out at the end of the physical draw. */
  private pullRibbon(dt: number): void {
    const { cygnet: k, sleeping } = this.cast;
    const touching = k.billTip(this.beak).distanceTo(this.grip) < 0.08;
    if (this.ribbonCaught && touching) this.ribbonDraw = Math.min(1, this.ribbonDraw + dt / T.ribbonTugFor);
    const pull = smooth(this.ribbonDraw, 0.12, 1);
    sleeping.ribbon.pull = pull;
    sleeping.ribbon.gripAt(pull, this.grip);
    k.billGrip = this.grip; k.billGripWeight = 1; k.flightPose = 0.75;
    k.watch(this.told.copy(CURTAIN_KNOT));
    if (pull >= 1 && touching) {
      sleeping.ribbon.released = true;
      k.billGrip = null; k.billGripWeight = 0; k.flightPose = 0.75;
      this.away();
    }
  }

  /** Off the top, alone, by its own choice, and the longest glide it has ever made. */
  private away(): void {
    const { cygnet: k, sleeping } = this.cast;
    this.to('glide');
    k.wing.opening = 0;
    k.stay = false;
    k.glideTo(this.spot.copy(ON_BLANKET), T.glideFor, T.glideArc, true);
    sleeping.lane(this.laneFrom, this.laneTo, T.dawnLaneWidth);
    sleeping.laneOpen = 0;
    sleeping.feather.goal.copy(BED).setY(BED.y + 2.6);
    this.music = 'sea';
    cue('lifted');
  }

  /**
   * The wind that carries it is the wind that tears the fog open, so a lane of sunlight comes down the hill with
   * it and the frost goes out of the grass under it. The freed curtains open after the tug; their light
   * reaches the child as the bird lands on the blanket.
   */
  private gliding(dt: number): void {
    const { cygnet: k, sleeping } = this.cast;
    k.flightPose = 0.75 * (1 - smooth(this.t, 0, 1.2));
    const down = k.sailing;
    sleeping.laneOpen = Math.max(sleeping.laneOpen, down);
    sleeping.dawn = Math.max(sleeping.dawn, 0.12 + 0.88 * down);
    sleeping.fog = Math.min(sleeping.fog, 1 - 0.8 * down);
    sleeping.frost = Math.min(sleeping.frost, T.frostWorst * (1 - down));
    // The completed tug releases the cloth; opening alone does not yet warm the bed.
    if (sleeping.ribbon.released) sleeping.curtains = Math.max(sleeping.curtains, smooth(this.t, 0, T.curtainsFor));
    this.warmed = 1;
    this.hush = lerp(this.hush, 0.35, 1 - Math.exp(-dt * 0.5));
    if (k.state === 'perched' || down >= 1) {
      /** It comes in on the heading it was flying and turns to the child over the next breath, never in a frame. */
      this.landYaw = k.yaw;
      this.to('waking');
      completeObjective();
    }
  }

  /** The light has reached the terrace, the bird is on the blanket, and the child wakes up warm. */
  private waking(dt: number): void {
    const { child: c, cygnet: k, sleeping } = this.cast;
    k.perch(ON_BLANKET, this.onBlanket(dt));
    sleeping.laneOpen = 1;
    sleeping.dawn = 1;
    sleeping.fog = Math.max(0, sleeping.fog - dt * 0.6);
    sleeping.frost = Math.max(0, sleeping.frost - dt * 0.5);
    sleeping.curtains = 1;
    this.hush = lerp(this.hush, 0.2, 1 - Math.exp(-dt * 0.6));
    if (this.t > 2.2) {
      c.eyesShut = 0;
      k.watch(c.face(this.told));
    }
    /** They sit up in it, and the bird is what they see. */
    if (this.t > 3.6) {
      c.position.copy(SIT_AT);
      c.sitting = true;
      c.yaw = Math.atan2(BESIDE.x, BESIDE.y);
      c.abed = Math.max(0, 1 - (this.t - 3.6) / 2.2);
      c.lookAt = k.eye(this.look);
    }
    if (this.t > T.wakeFor) {
      /** Into their arms, which puts the plane back in the satchel and their hands back on the bird. */
      this.laid = false;
      k.rideIn('cradle');
      k.bind(0.12);
      k.mayFly = false;
      this.to('lap');
    }
  }

  /** A few breaths of the two of them in the sunrise the bird brought, and then the boat. */
  private inTheLap(dt: number): void {
    const { child: c, cygnet: k, sleeping } = this.cast;
    c.lookAt = k.eye(this.look);
    k.watch(c.face(this.told));
    sleeping.blanket = Math.min(0.5, sleeping.blanket + dt * 0.25);
    sleeping.fog = 0;
    sleeping.frost = 0;
    sleeping.dawn = 1;
    this.hush = lerp(this.hush, 0.1, 1 - Math.exp(-dt * 0.8));
    if (this.t > 6.5) {
      c.abed = 0;
      c.standUp();
      const b = sleeping.bedside;
      this.spot.set(b.x, Math.max(heightAt(b.x, b.z), 0), b.z);
      const off = smooth(this.t, 6.5, 8.2);
      c.position.lerpVectors(SIT_AT, this.spot, off);
      c.position.y += Math.sin(off * Math.PI) * 0.14;
      k.rideIn('cradle');
      if (off >= 1) this.board();
    }
  }

  /** Keeping the bird walking after the feather: it makes for whatever is under it, and never has to be fetched. */
  private lead(at: THREE.Vector3): void {
    const { cygnet: k } = this.cast;
    k.stay = false;
    k.errand = this.carrot.set(at.x, Math.max(heightAt(at.x, at.z), 0), at.z);
    k.watch(at);
  }

  private board(): void {
    const { child: c, boat, cygnet: k } = this.cast;
    this.to('toBoat');
    /** Nothing of this room goes on board with them: it is the bird's own again from here. */
    k.watch(null);
    k.errand = null;
    k.stay = false;
    k.pace = 1;
    this.trodden = null;
    c.lookAt = null;
    const beside = boat.boardingPoint(this.seat);
    c.walkTo(beside.x, beside.z, false, () => {
      this.to('push');
      c.faceToward(boat.position.x, boat.position.z, 1);
      c.board(boat, () => this.to('aboard'));
    }, 0.8);
  }

  /** Where the walk is pointing, and where the bird is going, both eased, so no shot ever snaps round. */
  private heading(dt: number): void {
    const c = this.cast.child.position;
    const to = this.beat === 'toBoat' || this.beat === 'push' ? this.cast.boat.position : BED;
    this.side.set(to.x - c.x, 0, to.z - c.z);
    if (this.side.lengthSq() > 1) {
      this.aim.lerp(this.side.normalize(), 1 - Math.exp(-dt * 0.6));
      if (this.aim.lengthSq() > 0.01) this.aim.normalize();
    }
    const k = this.cast.cygnet;
    this.ahead.lerp(this.side.set(Math.sin(k.yaw), 0, Math.cos(k.yaw)), 1 - Math.exp(-dt * 1.2));
    if (this.ahead.lengthSq() > 0.01) this.ahead.normalize();
  }

  /** The destination and the bird share the shot, including the first spill of morning. */
  private summitFrame(): void {
    const k = this.cast.cygnet;
    const s = this.shot;
    this.bedFocus.copy(k.position).setY(k.position.y + 0.65);
    this.roomFocus.copy(WINDOW).setY(WINDOW.y + 0.5);
    s.target.lerpVectors(this.bedFocus, this.roomFocus, 0.5).lerp(CURTAIN_END, 0.15);
    this.subjects.tertiary = CURTAIN_END;
    const ex = WINDOW.x + 9.6, ez = WINDOW.z + 7.2;
    s.eye = this.perch.set(ex, SLEEP_LEDGE.y + 3.2, ez);
    this.subjects.margin = 0.55;
    this.subjects.extra = 14;
    s.subjects = this.subjects;
    s.clearance = 0.9;
    this.pace = 0.9;
    this.focus.copy(k.position);
  }

  /**
   * The camera as a sequence, never a cut: in low behind the child through the fog, down close at the bed, and
   * then right down to the bird's own eye for the climb, where the same world is enormous. A shot's `clearance`
   * is what lets it come down there without changing the rig for any other room.
   */
  private frame(): void {
    const { child, cygnet: k } = this.cast;
    const c = child.position;
    const s = this.shot;
    this.subjects.margin = 0.76; this.subjects.extra = 9; this.subjects.tertiary = undefined;
    s.from = undefined;
    s.subjects = undefined;
    s.fitWidth = false;
    switch (this.beat) {
      case 'ashore':
      case 'toBed': {
        const ground = Math.max(heightAt(c.x, c.z), 0);
        s.target.set(c.x + this.aim.x * 3.2, ground + 1.6, c.z + this.aim.z * 3.2);
        const ex = c.x - this.aim.x * 9 - this.aim.z * 2.4;
        const ez = c.z - this.aim.z * 9 + this.aim.x * 2.4;
        s.eye = this.perch.set(ex, Math.max(ground, Math.max(heightAt(ex, ez), 0)) + 1.9, ez);
        s.clearance = 2.2;
        this.pace = 0.5;
        this.focus.copy(c);
        return;
      }
      case 'tuckIn':
      case 'asleep':
      case 'feather':
      case 'waking':
      case 'lap': {
        // One deliberate view connects the cold bed to the seam of morning before the bird leaves.
        if (this.beat === 'asleep' && this.called && this.t - this.callAt > 2 && this.t - this.callAt < 7.5) {
          this.bedFocus.copy(BED).setY(BED.y + 1.2);
          this.roomFocus.copy(WINDOW);
          s.target.lerpVectors(this.bedFocus, this.roomFocus, 0.28);
          s.eye = this.perch.set(BED.x + 14, BED.y + 7, BED.z + 15);
          s.subjects = this.subjects; s.clearance = 1.2;
          this.pace = 0.75; this.focus.copy(BED);
          return;
        }
        // The bed and both travellers stay together in portrait as well as landscape.
        this.bedFocus.copy(BED).setY(BED.y + 1.05);
        this.roomFocus.copy(this.beat === 'tuckIn' ? c : k.position).setY(this.beat === 'tuckIn' ? c.y + 1.4 : k.position.y + 0.65);
        s.target.copy(this.bedFocus);
        s.eye = this.perch.set(BED.x + 7.1, BED.y + 4.0, BED.z + 6.4);
        s.subjects = this.subjects;
        s.clearance = 1.0;
        this.pace = 0.8;
        this.focus.copy(BED);
        return;
      }
      case 'edge':
      case 'climb':
      case 'shiver': {
        /**
         * Down at the bird's eye, where the grass is over its head and the fog top is the sky. It stands behind
         * the way up rather than behind the bird: a bird that stops to look at something must not swing the
         * whole world round with its head.
         */
        const ground = Math.max(heightAt(k.position.x, k.position.z), 0);
        this.bedFocus.copy(k.position).setY(ground + 0.7);
        this.roomFocus.copy(WINDOW).setY(WINDOW.y + 0.5);
        s.target.lerpVectors(this.bedFocus, this.roomFocus, 0.16);
        const ex = k.position.x - UPHILL.x * 5.4 - UPHILL.y;
        const ez = k.position.z - UPHILL.y * 5.4 + UPHILL.x;
        s.eye = this.perch.set(ex, Math.max(heightAt(ex, ez), 0) + 1.5, ez);
        s.subjects = this.subjects;
        s.clearance = 0.7;
        this.pace = 0.7;
        this.focus.copy(k.position);
        return;
      }
      case 'unbinding':
      case 'hilltop':
      case 'reachRibbon':
      case 'pullRibbon': {
        this.summitFrame();
        return;
      }
      case 'glide': {
        // Hold the reveal while the curtains open, then follow the bird down the light.
        if (this.t < T.windowRevealFor) { this.summitFrame(); return; }
        /** Behind it and a little above, so the lane of sun opening down the hill is what lies ahead of it. */
        s.target.set(k.position.x - UPHILL.x * 1.2, k.position.y + 0.5, k.position.z - UPHILL.y * 1.2);
        const ex = k.position.x + UPHILL.x * 6.5;
        const ez = k.position.z + UPHILL.y * 6.5;
        s.eye = this.perch.set(ex, k.position.y + 3.4, ez);
        s.clearance = 1.2;
        this.pace = 1.1;
        this.focus.copy(k.position);
        return;
      }
      case 'toBoat': {
        // Stay with the child while leaving the bed; the distant boat midpoint loses them in portrait.
        this.bedFocus.copy(c).setY(c.y + 1.25);
        this.roomFocus.copy(this.bedFocus).addScaledVector(this.aim, 5);
        s.target.copy(this.bedFocus).addScaledVector(this.aim, 1.2);
        s.eye = this.perch.set(c.x + 7.1, c.y + 4.2, c.z + 6.4);
        s.subjects = this.subjects;
        s.clearance = 1.4;
        this.pace = 1.2;
        this.focus.copy(c);
        return;
      }
      default: {
        const b = this.cast.boat.position;
        s.eye = undefined;
        s.target.set((c.x + b.x) / 2, b.y + 2, (c.z + b.z) / 2);
        s.distance = 20;
        s.height = 6;
        s.clearance = 2.8;
        this.pace = 0.4;
        this.focus.copy(b);
      }
    }
  }
}
