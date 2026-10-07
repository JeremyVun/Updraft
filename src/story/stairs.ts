import * as THREE from 'three';
import type { Shot } from '../camera';
import { tuning } from '../tuning';
import { roundedWaypoint } from '../traveller/navigation';
import type { Deck } from '../world/decks';
import type { StairsAir } from '../audio/stairs-air';
import { atmo } from '../world/atmosphere';
import { stairsDescent } from '../world/journey-rooms';
import { CloudStairs } from '../world/stairs';
import { BowLantern } from '../world/stairs-lantern';
import { lanternFlame } from '../traveller/boat/parts';
import { DRAFT, gunwale, gunwaleHalf, stationU } from '../traveller/boat/form';
import { LOOP_EYE, LOOP_LOOK, LOOP_ZOOM, drawIn, fromCopy, sizeOnBack, upBack } from '../world/stairs-penrose';
import {
  BELOW_CLOUD, CLOUD, CLOUD_BERTH, CLOUD_ROUTE, DESCENT_END, FOG_BANK, FLIGHTS, LOOSE, RUN_YAW, SIT, SLIPPERS, STAIRS_ARRIVAL, STAIRS_LOOK_FROM,
  STAIRS_LOOK_UP, STAIRS_LOOK_ZOOM, STAIRS_FOOT, STAIRS_GROUND, STEP, TOP, TOP_EDGE, TOP_OUT, LOOP, LOOP_BACK, LOOP_FAR, along, flight, landingOf, leftOf,
  levelHeight, onLanding,
} from '../world/stairs-layout';
import type { Cast, Chapter } from './cast';
import type { CheckpointPayload } from './checkpoint-data';
import { completeObjective, cue } from './cues';
import { OUT_OF_THE_WHITE, blend, frameVoyage, framingAt, type Framing } from './stairs-sail';
import { Track } from './stairs-track';

type Beat =
  | 'ashore' | 'wonder' | 'climb' | 'waiting' | 'hesitate' | 'birdFirst' | 'follow' | 'loop' | 'together' | 'emerge'
  | 'awe' | 'nest' | 'skein' | 'lean' | 'gather' | 'boarding' | 'sail' | 'fog' | 'thin' | 'down';

/** What the story asks of the cloud deck each frame; main eases the sky toward it. */
export interface CloudDeckState {
  amount: number;
  base: number;
  top: number;
  bubble: THREE.Vector4;
  /** How thick the cloud still is in the pocket round the child, per metre. */
  clearing?: number;
  /** Take the base as it is, at once, rather than easing to it: for a move made where nothing can be seen. */
  snap?: boolean;
  /** How far over its top the cloud thins away, metres, so coming up out of it is a slow clearing and not a ceiling. */
  crown?: number;
}


/** The beats spent under the cloud, while the sea below can be seen. */
const UNDER_THE_CLOUD: Beat[] = ['ashore', 'wonder', 'climb', 'waiting', 'hesitate', 'birdFirst'];

/** How long the lens takes to rise out over the loop to the one place it has to be seen from. */
const LOOP_SETTLE = 5;
/**
 * Once the bird has found the way on: how long the lens stays at the one place, then how long it takes to come round
 * and down beside the loop while its last flight lets go of the trick and climbs on past the corner into the air.
 */
const REVEAL_HOLD = 1.4;
const REVEAL = 7.5;

/**
 * Where the child stands aside on the last landing under the white, in its far corner, clear of the way the bird
 * goes past them and on up.
 */
const ASIDE = (() => {
  const L = landingOf(BELOW_CLOUD);
  return onLanding(L, L.openings.some(o => o.face === 'left') ? -0.42 : 0.42, 0.38);
})();

/** Where the kite flies from the bow while the boat waits: out over the open cloud and forward, clear of the landing and the hull. */
const KITE_WAITS = (() => {
  const way = along(CLOUD_BERTH.yaw);
  return Math.atan2(TOP_OUT.x + way.x, TOP_OUT.z + way.z);
})();
/** Where she stands to take it all in, a step in from the lip, and the bird beside her. */
const TAKE_IN = SIT.clone().addScaledVector(TOP_OUT, -0.45);
const BIRD_TAKES_IN = SLIPPERS.clone().addScaledVector(TOP_OUT, -0.4);
/** It stops a little short of where it makes for, so it is sent past the slippers, away from her, to keep clear of her coat. */
const BIRD_NESTS = SLIPPERS.clone().addScaledVector(SLIPPERS.clone().sub(SIT).setY(0).normalize(), 0.5);
/**
 * How long the lens rests over her shoulder into the sun, once it has come round with the swans, before the boat sets
 * off out of the cloud; how long after that they watch where the swans went before they turn to each other; and the
 * longest the boat waits whatever the lens is doing. Seconds.
 */
const HELD_INTO_THE_SUN = 5;
const WATCHED_ON = 3;
const BOAT_SETS_OFF_BY = 40;
/** How far into its tower the boat waits, as a share of the tower's size from its middle toward the landing. */
const HIDE_IN = 0.45;
/** How much faster the kite brings the boat on while it is still far out, metres a second. */
const FAR_OUT_SPEED = 7;
/** How long the lens takes to drift round her right to her side as she sits, and when the swans are sent; seconds into the sit. */
const TO_HER_SIDE = 7;
const SWANS_AT = 7;
/** Her side: turned from straight out ahead of her round toward her right, how far off, how high, and how high it looks. */
const SIDE_TURN = -1.13;
const SIDE_REACH = 6;
const SIDE_HEIGHT = 1.7;
const SIDE_LOOK = 0.3;
/**
 * The swans' way: they come from behind the landing, over the cloud off to her left and on out toward the sun.
 * Where they start, from where she sits (turned from straight behind her toward her left, how far off), which way
 * they fly (turned from the sun toward the right), and how high over the cloud.
 */
const SKEIN_FROM_TURN = 0.4;
const SKEIN_FROM = 220;
const SKEIN_HEADING = 0;
const SKEIN_HIGH = 16;
/**
 * They are turned off that the least it takes to keep clear of the towers of cumulus, never into one: the most
 * they may be turned, in steps of; how far out they fly before they are put away and how wide the V is, metres;
 * and how much room they keep from the towers' frayed edges, metres.
 */
const SKEIN_TURNS_AT_MOST = 0.2;
const SKEIN_TURN_STEP = 0.01;
const SKEIN_GOES = 1400;
const SKEIN_SPAN = 14;
const SKEIN_ROOM = 2;
/** How far short of the sun they are, seen from where she sits, when the lens has come back round behind her; radians. */
const SKEIN_SETTLES = 0.52;
/** How far from the middle of the frame the swans may go while the lens comes round with them, as shares of its half-width and half-height. */
const KEEP_THEM_IN = 0.6;
const KEEP_THEM_UNDER = 0.45;
/** How long she stands taking it in before she turns to the bird, seconds. */
const AWE_TURNS = 5.2;
const ease = (x: number) => 0.5 - 0.5 * Math.cos(Math.PI * THREE.MathUtils.clamp(x, 0, 1));
/** How high the hull rides on the top of the cloud, and on the sea. */
const RIDE = CLOUD.top + 0.45;
const SEA_RIDE = DRAFT;
/**
 * Under sail the pointer lands this high over the hull, about at the boom, so a stroke over the hull or across the
 * sail puts its wind on the boat from any of the lens's framings that look down on it.
 */
const POINTER_OVER_HULL = 1;
/** The white on the sea goes grey and blue with the dusk. */
const DUSK_MIST = new THREE.Color(0.9, 0.96, 1.14);
/** The gold of the low sun on the cloud, as `cloudGold` in the shaders. */
const CLOUD_GOLD = new THREE.Color(1.0, 0.8, 0.52);
const luma = (c: THREE.Color): number => c.r * 0.2126 + c.g * 0.7152 + c.b * 0.0722;

/** One stop on the way up: where to stand and the level of the landing or flight it is on. */
interface Stop { x: number; z: number; level: number }

/**
 * Every place on the way from the grass to the top landing: the top of each flight, and the middle of the landing
 * it arrives on, where the walk turns for the next. From one landing's middle to the next is a straight line.
 */
function route(): Stop[] {
  const stops: Stop[] = [{ x: STAIRS_FOOT.x, z: STAIRS_FOOT.z, level: 0 }];
  for (let i = 1; i <= FLIGHTS; i++) {
    const f = flight(i);
    const onto = f.top.clone().addScaledVector(along(f.yaw), 0.35);
    stops.push({ x: onto.x, z: onto.z, level: i });
    stops.push({ x: f.landing.x, z: f.landing.z, level: i });
  }
  return stops;
}

/**
 * The stairs in the clouds. Bedtime: a staircase that goes up into somewhere you can't see.
 *
 * Three of its flights hang loose in the air under the cloud, and the player's wind brings them home. Where the
 * last one goes up into the white the child stops, and the cygnet, carried everywhere until now, gets down and
 * goes up first. Above the cloud is the last sun of the year, a pair of slippers on the top step, the swans going
 * north far off, and the boat waiting on the cloud as if it were water. They sail on into the sunset, into a bank of
 * mist standing on the cloud, and out of it onto the dusk water of the drowned village.
 */
export class StairsChapter implements Chapter {
  beat: Beat = 'ashore';
  breeze = 0.35;
  readonly worldLife = 1;
  pace = 0.35;
  haze = 0.62;
  dusk = 0.62;
  readonly season = 0.5;
  readonly music = 'birches' as const;
  readonly birchesScore = 'return' as const;
  hush = 0.35;
  readonly focus = new THREE.Vector3();
  /** The grass round the foot of the stair is trodden down, so the first flight stands clear of it. */
  readonly trodden = new THREE.Vector3(103, 6.5, -1233.5);
  readonly shot: Shot = { target: new THREE.Vector3(), distance: 24, height: 5 };
  readonly cloudDeck: CloudDeckState = { amount: 1, base: CLOUD.base, top: CLOUD.top, bubble: new THREE.Vector4(0, -1e4, 0, 0) };
  private readonly stops = route();
  private stop = -1;
  /** How far up the route the child may go before the stair runs out or the story wants them to wait. */
  private limit = 0;
  private now = 0;
  private beatStart = 0;
  private leg = 0;
  private skeinSent = false;
  private calledToThem = false;
  private birdStop = 0;
  /** The furthest stop the bird has got to in the cloud; the child never goes past it. */
  private birdReached = 0;
  /** Set once the cygnet has gone up into the cloud first; until then the child goes no further than its edge. */
  private birdLed = false;
  private readonly from = new THREE.Vector3();
  private readonly berth = new THREE.Vector2(CLOUD_BERTH.x, CLOUD_BERTH.z);
  private readonly world: CloudStairs;
  private readonly tmp = new THREE.Vector3();
  private readonly tmp2 = new THREE.Vector3();
  private readonly look = new THREE.Vector3();
  private readonly look2 = new THREE.Vector3();
  private readonly arrivalEye = new THREE.Vector3();
  private readonly birdAt = new THREE.Vector3();
  private readonly sun = new THREE.Vector3();
  private readonly subjects = { primary: new THREE.Vector3(), secondary: new THREE.Vector3(), tertiary: new THREE.Vector3(), margin: 0.8, extra: 10 };
  private readonly ashoreSubjects = { primary: new THREE.Vector3(), secondary: new THREE.Vector3(), margin: 0.8, extra: 6 };
  private readonly invitation = new THREE.Vector3();
  private lastPush = 0;
  /** The stop on the loop's near corner, where the bird sets off round it and comes back to; and how it is getting on. */
  private readonly loopStop: number;
  private looped = false;
  private lap = 0;
  private round: 'settle' | 'round' | 'puzzled' = 'settle';
  private roundT = 0;
  /** Whether it is on its way home round the loop, after it has come across onto the corner. */
  private homeward = false;
  /** The line up the stair the bird keeps to, and where on it the stops are. */
  private readonly track: Track;
  /** The bird's way round the loop: out to the top of its last flight, and home across the corner to where it set off. */
  private readonly roundOut: Track;
  private readonly roundHome: Track;
  private readonly sOnward: number;
  private readonly sBack: number;
  /** Where on the near corner the bird sets off from and comes back to, right over the child's head. */
  private readonly cornerSpot: THREE.Vector3;
  private readonly sCorner: number;
  /** Where the child waits, a few treads down the flight up onto the corner, below the ring. */
  private readonly waitBelow: THREE.Vector3;
  private loopFrom = 0;
  private readonly eyeFrom = new THREE.Vector3();
  private readonly lookFrom = new THREE.Vector3();
  private readonly loopEye = new THREE.Vector3();
  /** While the lens is up in the white over the loop, the cloud is kept deep enough round it. */
  private lofted = false;
  private trickGone = 0;
  /** When the bird found the way on, so the loop is seen to come apart; below zero until then. */
  private revealFrom = -1;
  private readonly revealEye = new THREE.Vector3();
  private readonly revealLook = new THREE.Vector3();
  private stuckLeft = Infinity;
  /** How far round the loop the bird had got last frame. */
  private alongWas = 0;
  private stuckSince = 0;
  private lastDt = 0;
  /** The halo round the boat's lantern for the way over the cloud, and the kite's tie-off at the bow. */
  private readonly lantern = new BowLantern();
  private readonly flame = lanternFlame();
  private readonly bow = new THREE.Vector3();
  private readonly stern = new THREE.Vector3();
  private readonly tow = { at: new THREE.Vector3(), heading: 0 };
  private berthed = false;
  /** The way the boat comes in to lie alongside the top landing, and how far along it it is. */
  private approach: THREE.Vector2[] = [];
  private approachLeg = 0;
  private comingFor = 0;
  /** Once the swans are over, the boat comes out of the cloud where it has been waiting. */
  private boatComing = false;
  /** Whether the lens is still going round with the swans, and how long it has rested since, seconds. */
  private lensWithSwans = true;
  private heldIntoTheSun = 0;
  /** The lens's authored moves on top: when the current one set off, from where round her, and how far it has come. */
  private arcFor: Beat | null = null;
  private arcAt = 0;
  private arcBearing = 0;
  private arcReach = 0;
  private skeinBearing = 0;
  private withThem = 0;
  private keepTurn = 0;
  private keepTilt = 0;
  private readonly arcEye = new THREE.Vector3();
  private readonly theirWay = new THREE.Vector3();
  private readonly waiting = new THREE.Vector2();
  private cuts = 0;
  /** How far the boat has come over the cloud, metres. */
  private sailed = 0;
  /** How much of the bank of mist there is; it is there by the time they are aboard. */
  private mist = 0;
  /** How far into the white they are, 0 to 1, for the sound. */
  private white = 0;
  /** The way the lens reckons as ahead: the run's over the cloud, the hull's on the sea. */
  private voyageYaw = RUN_YAW;
  /** Under way, how far they are turned to the side looking out, 0 to 1, and when the child last glanced at the bird. */
  private lookingOut = 0;
  /** The height the hull rides at over the cloud, following its billows. */
  private riding = RIDE;
  private perched = false;
  private readonly outThere = new THREE.Vector3();
  private readonly rail = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  private readonly framing: Framing = { ...OUT_OF_THE_WHITE };
  private readonly framingFrom: Framing = { ...OUT_OF_THE_WHITE };
  private readonly eye = new THREE.Vector3();
  /** Out of the white the lens makes room for the hull and the sail as the village's own lens will, so it takes over without a move. */
  private readonly hullFrame = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  private readonly outSubjects = { primary: new THREE.Vector3(), secondary: new THREE.Vector3(), points: this.hullFrame, margin: 0.8, extra: 16 };
  private readonly mistLight = new THREE.Color();
  private readonly tmpColor = new THREE.Color();
  private readonly air: StairsAir = { phase: 'under', cloud: 0, climb: 0, open: 0, fog: 0, speed: 0 };
  private readonly oldRadius: number;

  constructor(private readonly cast: Cast) {
    const world = cast.stairs;
    this.world = world;
    const { child, plane, cygnet, boat } = cast;
    this.loopStop = this.stops.findIndex(p => p.level === LOOP.corner && Math.abs(p.x - flight(LOOP.corner).landing.x) < 0.01);
    const on = (p: THREE.Vector3, yaw: number, d: number) => p.clone().addScaledVector(along(yaw), d);
    const into = flight(LOOP.corner), up = flight(LOOP.wait), on2 = flight(LOOP.onward), far = LOOP_FAR.flight;
    const corner = landingOf(LOOP.corner), wait = landingOf(LOOP.wait), onward = landingOf(LOOP.onward), farL = LOOP_FAR.landing;
    this.track = new Track(this.stops.map(p => new THREE.Vector3(p.x, levelHeight(p.level), p.z)));
    this.cornerSpot = onLanding(corner, -0.1, -0.2);
    this.sCorner = this.track.project(this.cornerSpot);
    this.waitBelow = on(into.top, into.yaw, -1.55).setY(into.top.y - STEP.rise * 5);
    this.roundOut = new Track([
      this.cornerSpot.clone(), on(up.bottom, up.yaw, 0.2), on(up.top, up.yaw, 0.35), wait.centre.clone(), onLanding(wait, wait.x1 - 0.25, 0),
      on(on2.bottom, on2.yaw, 0.2), on(on2.top, on2.yaw, 0.35), onward.centre.clone(), onLanding(onward, onward.x1 - 0.25, 0),
      on(far.bottom, far.yaw, 0.2), on(far.top, far.yaw, 0.35), farL.centre.clone(), onLanding(farL, farL.x1 - 0.25, 0),
      // Up the middle of the drawn-in flight, which bows and narrows toward its top.
      ...[0.08, 0.25, 0.4, 0.55, 0.7, 0.85, 1].map(t => drawIn(LOOP_BACK.bottom.clone().lerp(LOOP_BACK.top, t))),
      drawIn(on(LOOP_BACK.top, LOOP_BACK.yaw, 0.5)),
    ]);
    this.sOnward = this.roundOut.project(onward.centre);
    this.sBack = this.roundOut.project(LOOP_BACK.bottom);
    this.roundHome = new Track([onLanding(corner, corner.x1 - 0.2, 0), onLanding(corner, 0.2, -0.05), this.cornerSpot.clone()]);
    stairsDescent.down = false;
    world.onDocked = (index) => this.docked(index);
    world.ghostShown = 0;
    world.fleet.setOff();
    cygnet.mayFly = false;
    // Short careful steps: every tread of a household stair is a climb for something its size.
    cygnet.pace = 0.8;
    cygnet.decks = this.decks();
    child.decks = cygnet.decks;
    child.stowPlane(true);
    plane.hold(child);
    plane.visible = true;
    this.oldRadius = plane.homeRadius;
    boat.altitude = null;
    child.stepAshore(boat);
    this.limit = this.reachable();
    child.walkTo(STAIRS_ARRIVAL.x, STAIRS_ARRIVAL.y, false, () => this.to('wonder'), 0.8);
  }

  private to(beat: Beat): void {
    this.beat = beat;
    this.beatStart = this.now;
  }

  private get t(): number {
    return this.now - this.beatStart;
  }

  /** The walking surface: every flight that is in place, and the landings they arrive on. */
  private decks(): Deck[] {
    const decks: Deck[] = [];
    for (let i = 1; i <= FLIGHTS; i++) {
      const at = (LOOSE as readonly number[]).indexOf(i);
      if (at >= 0 && !this.world.pieces[at].docked) continue;
      decks.push(...CloudStairs.decks(i));
    }
    return decks;
  }

  /** The last stop the child can reach: the landing before the first flight still loose, or the top. */
  private reachable(): number {
    const loose = this.world.waiting;
    const level = loose ? loose.flight.index - 1 : this.birdLed ? FLIGHTS : BELOW_CLOUD;
    let last = 0;
    this.stops.forEach((s, i) => { if (s.level <= level) last = i; });
    // Wait in the lane the next flight leaves from, facing the gap; under the cloud, in the lane that goes up into it.
    return loose || this.birdLed ? last : last - 1;
  }

  get done(): boolean {
    return this.beat === 'down';
  }

  get scripted(): boolean {
    return ['hesitate', 'birdFirst', 'awe', 'nest', 'skein', 'lean', 'gather', 'boarding'].includes(this.beat);
  }

  get departureKite(): boolean {
    return ['emerge', 'awe', 'nest', 'skein', 'lean', 'gather', 'boarding', 'sail', 'fog'].includes(this.beat);
  }

  /** A slow sweep drawn across the loose flight when the stair has been waiting on it a while. */
  get windInvitation(): THREE.Vector3 | null {
    // Back where it started, and the cloud on the loop's far corner is still there: a sweep across it.
    if (this.beat === 'loop') {
      const bank = this.world.bank;
      return (this.lap >= 1 || this.round === 'puzzled') && !bank.cleared ? bank.centre : null;
    }
    if (this.beat !== 'waiting' || this.now - this.lastPush < 6) return null;
    const piece = this.world.waiting;
    if (!piece) return null;
    return this.world.pointOn(piece, this.tmp2.lerpVectors(piece.flight.bottom, piece.flight.landing, 0.5), this.invitation);
  }

  /** The heap on the loop's far corner: the sweep goes right across it, from the clear air on one side to the other. */
  get invitationRadius(): number {
    return this.beat === 'loop' ? this.world.bank.radius * 1.5 : 0;
  }

  /** Above the cloud the pointer lands on its top, so a gust meant for the sail reaches the sail. */
  get pointerFloor(): number | null {
    const hull = this.cast.boat.position.y + POINTER_OVER_HULL;
    if ((this.beat === 'sail' || this.beat === 'fog') && this.world.eye.y > hull + 0.4) return hull;
    return this.cast.child.position.y > CLOUD.top - 0.5 || this.beat === 'sail' ? CLOUD.top : null;
  }

  /** From the moment they are out on top, the kite is tied to the bow of the boat waiting on the cloud. */
  get kiteTow(): { at: THREE.Vector3; heading: number } | null {
    if (!this.berthed || this.beat === 'thin' || this.beat === 'down') return null;
    this.cast.boat.hullEnds(this.bow, this.stern);
    this.tow.at.copy(this.bow).y += 0.3;
    // Until they sail, the kite stands out over the open cloud beyond the landing, so its line never runs across it.
    this.tow.heading = this.beat === 'sail' || this.beat === 'fog' ? this.cast.boat.yaw : KITE_WAITS;
    return this.tow;
  }

  get cameraCut(): number {
    return this.cuts;
  }

  get stairsAir(): StairsAir {
    return this.air;
  }

  /** The village's music is asked for as the fog closes round the boat: the sail fades, rests in the white, and it comes in. */
  get arrivalMusic(): 'drowned' | undefined {
    return this.air.phase === 'fog' || this.air.phase === 'down' ? 'drowned' : undefined;
  }

  get checkpoint(): string | null {
    if (this.beat !== 'waiting' && this.beat !== 'climb') return null;
    const n = this.world.docked;
    return n > 0 && n < LOOSE.length ? `flight-${n}` : n === LOOSE.length ? 'flight-3' : null;
  }

  saveCheckpoint(): CheckpointPayload<'stairs'> {
    return [this.world.docked];
  }

  restoreCheckpoint(_point: string, data: number[]): void {
    const n = THREE.MathUtils.clamp(Math.floor(data[0] ?? 0), 0, LOOSE.length);
    this.world.restore(n);
    const { child, cygnet } = this.cast;
    child.decks = cygnet.decks = this.decks();
    this.limit = this.reachable();
    const level = n < LOOSE.length ? LOOSE[n] - 1 : LOOSE[LOOSE.length - 1];
    let at = 0;
    this.stops.forEach((s, i) => { if (s.level <= level) at = i; });
    const s = this.stops[at];
    child.stop();
    child.position.y = level === 0 ? 0 : flight(level).top.y;
    const spot = n < LOOSE.length ? this.waitSpot(level) : s;
    child.place(spot.x, spot.z, Math.PI);
    // On its own feet a stop behind them, as it would be if they had climbed here together.
    const behind = this.stops[Math.max(0, at - 1)];
    if (cygnet.carried) cygnet.release(this.birdAt.set(behind.x, 0, behind.z));
    cygnet.standAt(behind.x, levelHeight(behind.level), behind.z, Math.PI);
    cygnet.stay = false;
    this.birdStop = Math.max(0, at - 1);
    this.stop = at;
    this.limit = n < LOOSE.length ? at : this.reachable();
    this.to(n < LOOSE.length ? 'waiting' : 'climb');
  }

  private docked(index: number): void {
    const { child, cygnet } = this.cast;
    child.decks = cygnet.decks = this.decks();
    cue('flightHome');
    if (index === LOOSE[LOOSE.length - 1]) completeObjective(); else cue('star');
    if (cygnet.carried) cygnet.mind.perform('wag', 0.9);
    this.limit = this.reachable();
    this.to('climb');
  }

  update(dt: number, _time: number): void {
    this.now += dt;
    const { child: c, cygnet: k, carry, plane } = this.cast;
    if (plane.held) plane.hold(c);
    this.sunPoint();
    this.world.fleet.shown = UNDER_THE_CLOUD.includes(this.beat);
    switch (this.beat) {
      case 'wonder':
        // Out of the satchel and down onto the grass: this room it climbs on its own feet. Then both of them look
        // up the stair to where it goes into the cloud.
        c.lookAt = this.look.copy(STAIRS_LOOK_UP).setY(CLOUD.base - 3);
        if (this.t > 0.8 && k.carried && !carry.busy) {
          const down = () => carry.setDown(() => {
            k.stay = true;
            this.beatStart = this.now;
          });
          if (k.seat === 'satchel') carry.unstow(down);
          else down();
        }
        if (!k.carried && !carry.busy) k.watch(this.look);
        if (this.t > 2 && !carry.busy && !c.busy && !k.carried && k.seat === null) {
          c.lookAt = null;
          k.watch(null);
          k.stay = false;
          c.stroll = tuning.stairs.climb;
          this.to('climb');
        }
        break;
      case 'climb':
        this.walkOn();
        this.birdBehind();
        break;
      case 'waiting': {
        this.birdBehind();
        const piece = this.world.waiting;
        c.lookAt = piece ? this.world.pointOn(piece, this.tmp.lerpVectors(piece.flight.bottom, piece.flight.landing, 0.5), this.look) : null;
        this.world.ghostShown = 1;
        if (piece && piece.worked > 0.01) { this.lastPush = this.now; piece.worked = 0; }
        break;
      }
      case 'hesitate': {
        // The white starts a few steps up. They have stepped aside on the landing; they look up into it, and hang
        // back. The bird comes up beside them and looks too.
        const up = flight(BELOW_CLOUD + 1);
        c.lookAt = this.look.copy(up.top).setY(CLOUD.base + 1.5);
        if (!c.moving) {
          c.lean = -0.06;
          c.faceToward(up.bottom.x, up.bottom.z, 1 - Math.exp(-dt * 3));
        }
        this.birdBehind();
        k.watch(this.look);
        if (this.t > 3.4 && !c.moving) {
          c.lean = 0;
          k.watch(null);
          k.stay = false;
          this.to('birdFirst');
        }
        break;
      }
      case 'birdFirst':
        this.birdGoesFirst();
        break;
      case 'follow':
        this.walkOn();
        this.birdAhead();
        break;
      case 'loop':
        this.goRound();
        break;
      case 'together':
        c.lookAt = null;
        this.walkOn();
        this.birdBehind();
        break;
      case 'emerge':
        if (!this.berthed) this.berthOnCloud();
        this.comeAlongside(dt);
        this.walkOn();
        if (c.position.y > CLOUD.top + 0.6 && !c.moving) this.takeIn();
        break;
      case 'awe': {
        // Standing a step from the edge she looks right across it, slowly, from off to the left round past the sun,
        // then at the bird beside her.
        const S = THREE.MathUtils.smootherstep;
        const across = THREE.MathUtils.lerp(0.8, -0.45, S(this.t, 1.2, 5.2));
        c.lookAt = this.t < AWE_TURNS || c.moving ? this.outOver(across, 6, this.look) : k.position;
        this.settle(dt);
        this.comeAlongside(dt);
        if (k.stay) k.watch(this.outOver(0.1, 10, this.look2));
        if (this.t > 6.6 && !c.moving) this.nest();
        break;
      }
      case 'nest':
        c.lookAt = this.outOver(0.1, 4, this.look);
        this.settle(dt);
        this.comeAlongside(dt);
        // The lens has come round to her side and she has swung her feet a while before the swans come.
        if (this.t > SWANS_AT && !this.skeinSent) this.sendSkein();
        break;
      case 'skein': {
        // The bird sees them first and calls to them as the lens starts to go with them, and she follows its look;
        // her feet go still while they watch them over. Then she turns to the bird, which is still looking where they went, and
        // the boat is coming.
        const flock = this.cast.flock;
        this.settle(dt);
        if (!this.calledToThem && this.withThem > 0.02) {
          this.calledToThem = true;
          k.call(true);
        }
        const over = this.comingFor > WATCHED_ON;
        if (flock.active) this.look2.copy(flock.head);
        k.watch(this.comingFor < WATCHED_ON + 2 ? this.look2 : this.cast.boat.position);
        c.lookAt = this.t < 1.1 ? this.outOver(0.1, 4, this.look) : !over ? this.look2
          : this.comingFor < WATCHED_ON + 3.5 ? k.position : this.cast.boat.position;
        c.dangle = over ? THREE.MathUtils.smoothstep(this.comingFor, WATCHED_ON + 2, WATCHED_ON + 4)
          : 1 - THREE.MathUtils.smoothstep(this.t, 1.2, 3);
        if (!this.lensWithSwans) this.heldIntoTheSun += dt;
        if (this.heldIntoTheSun > HELD_INTO_THE_SUN || this.t > BOAT_SETS_OFF_BY) this.boatComing = true;
        this.comeAlongside(dt);
        if (this.approachLeg === this.approach.length - 1) {
          k.watch(null);
          this.to('lean');
        }
        break;
      }
      case 'lean':
        this.comeAlongside(dt);
        c.lookAt = this.t < 2 ? this.cast.boat.position : k.position;
        if (this.t > 2.5 && !carry.busy && this.cast.boat.grounded) this.gather();
        break;
      case 'gather':
        break;
      case 'boarding':
        break;
      case 'sail':
        this.sail(dt);
        break;
      case 'fog':
        this.fog(dt);
        break;
      case 'thin':
        this.thin(dt);
        break;
      default:
        break;
    }
    this.keepOnTheStair();
    this.cloud(dt);
    this.mistBank(dt);
    this.loopScenery(dt);
    this.lanternGlow();
    this.world.cloud.holdOut(this.berthed && this.beat !== 'thin' && this.beat !== 'down' ? this.cast.boat : null);
    this.measureAir(dt);
    this.frame(dt);
  }

  /**
   * The loop's trick is drawn only while the lens is at the one place it works from, and after, until they are well
   * on up past it; the heap of cloud sits on its far corner from the time they come up into the loop.
   */
  private loopScenery(dt: number): void {
    const e = this.beat === 'loop' ? THREE.MathUtils.smoothstep(this.now - this.loopFrom, LOOP_SETTLE * 0.7, LOOP_SETTLE) : 0;
    if (this.looped && this.beat !== 'loop' && this.stop > this.loopStop + 6) this.trickGone = Math.min(1, this.trickGone + dt / 2);
    this.world.trickShown = this.beat === 'loop' ? e : this.looped ? 1 - this.trickGone : 0;
    this.world.undraw = this.revealFrom < 0 ? 0 : THREE.MathUtils.smoothstep(this.now - this.revealFrom, REVEAL_HOLD + 0.4, REVEAL - 1);
    this.world.bank.amount = this.cast.child.position.y > levelHeight(LOOP.corner - 1) - 1 ? 1 : 0;
    const k = this.cast.cygnet;
    const drawn = k.scale < 1;
    k.nudge = this.beat === 'loop' || this.lofted ? drawn ? this.drawnDepth(k.position) : 0 : null;
    k.nudgeSlope.set(0, 0, 0);
    if (k.nudge === null || !drawn) return;
    // The flight is pushed back more the higher up it is, so the bird is too, or its tail sinks behind the treads.
    for (let axis = 0; axis < 3; axis++) {
      const h = 0.05;
      const ahead = this.drawnDepth(this.tmp.copy(k.position).setComponent(axis, k.position.getComponent(axis) + h));
      const behind = this.drawnDepth(this.tmp.copy(k.position).setComponent(axis, k.position.getComponent(axis) - h));
      k.nudgeSlope.setComponent(axis, (ahead - behind) / (2 * h));
    }
  }

  /**
   * Seen from far above the loop the bird is drawn where it is, not pulled toward the lens, so the rails it walks
   * beside stand in front of it. Up the drawn-in flight, drawn smaller, it is pushed back to where it seems to be.
   */
  private drawnDepth(p: THREE.Vector3): number {
    const d = p.distanceTo(this.world.eye);
    return d * (1 - 1 / sizeOnBack(p)) / Math.max(0.2, THREE.MathUtils.smoothstep(d, 9, 34));
  }

  private measureAir(dt: number): void {
    const { child, boat } = this.cast;
    const a = this.air;
    const afloat = ['sail', 'fog', 'thin', 'down'].includes(this.beat);
    const y = afloat ? RIDE : child.position.y;
    const S = THREE.MathUtils.smoothstep;
    a.climb = THREE.MathUtils.clamp((y - CLOUD.base) / (CLOUD.top - CLOUD.base), 0, 1);
    // Up to white in the cloud bank, and thinning again over the village's water.
    a.fog = this.beat === 'fog' || this.beat === 'thin' ? this.white : 0;
    a.cloud = afloat ? a.fog : S(y, CLOUD.base - 1.5, CLOUD.base + 1.5) * (1 - S(y, CLOUD.top - 1.2, CLOUD.top + 0.4));
    const top = ['awe', 'nest', 'skein', 'lean', 'gather', 'boarding'].includes(this.beat);
    const out = afloat || top || (y > CLOUD.top - 0.4 && this.beat === 'emerge');
    a.open += ((out ? 1 - a.fog : 0) - a.open) * (1 - Math.exp(-dt * 0.8));
    a.speed = afloat ? boat.speed : 0;
    a.phase = this.beat === 'down' ? 'down' : this.beat === 'fog' || this.beat === 'thin' ? 'fog' : this.beat === 'sail' ? 'sail'
      : out ? 'above' : a.cloud > 0.5 || ['hesitate', 'birdFirst', 'follow', 'loop', 'together', 'emerge'].includes(this.beat) ? 'cloud' : 'under';
  }

  /** Where they wait on a landing for its next flight: its back corner away from that flight, clear of its drawing. */
  private waitSpot(level: number): THREE.Vector3 {
    const L = landingOf(level);
    return onLanding(L, L.openings.some(o => o.face === 'left') ? -0.5 : 0.5, -0.35, this.tmp);
  }

  /** Up the stair, stop by stop, as far as it goes. */
  private walkOn(): void {
    const { child: c } = this.cast;
    if (c.moving || c.busy) return;
    // Up the flight onto the loop's corner as far as a few treads short of it, below the ring, out of the bird's way.
    if (this.beat === 'follow' && this.stop === this.loopStop - 2 && !this.looped) {
      this.goRoundFirst();
      return;
    }
    // In the cloud the bird goes first, and the child goes only as far as it has.
    if (this.beat === 'follow' && this.stop + 1 > this.birdReached && this.stop + 1 < this.stops.length - 1) return;
    if (this.stop >= this.limit) {
      if (this.world.waiting) {
        this.to('waiting');
        const spot = this.waitSpot(this.stops[this.stop].level);
        c.walkTo(spot.x, spot.z, false, undefined, 0.12);
        return;
      }
      if (this.beat === 'climb') {
        this.to('hesitate');
        c.walkTo(ASIDE.x, ASIDE.z, false, undefined, 0.12);
        return;
      }
      if (this.beat === 'follow' || this.beat === 'together' || this.beat === 'emerge') { this.to('emerge'); return; }
      return;
    }
    this.stop++;
    const s = this.stops[this.stop];
    c.walkTo(s.x, s.z, false, undefined, 0.22);
    if ((this.beat === 'follow' || this.beat === 'together') && s.level >= FLIGHTS) this.to('emerge');
  }

  /**
   * Past them on the landing, it looks up the flight into the white, hops up it a few treads into the cloud, and
   * turns round to wait: the one who has been carried everywhere goes first.
   */
  private birdGoesFirst(): void {
    const { cygnet: k, child: c } = this.cast;
    const f = flight(BELOW_CLOUD + 1);
    const up = this.tmp2.copy(f.bottom).addScaledVector(along(f.yaw), STEP.going * 7).setY(f.bottom.y + STEP.rise * 7);
    const left = this.track.lead(k.position, this.track.project(up), this.birdAt);
    c.lookAt = k.position;
    if (!k.stay && left > 0.5 && this.t < 14) {
      k.errand = this.birdAt;
      return;
    }
    if (!k.stay) {
      k.stay = true;
      k.errand = null;
      k.does('look-back', c.position, 2.2);
      this.beatStart = this.now;
    }
    if (this.t > 3) {
      this.birdLed = true;
      this.birdStop = this.limit + 1;
      this.limit = this.reachable();
      this.to('follow');
    }
  }

  /**
   * In the cloud it keeps a few treads ahead, stop by stop, and waits on each landing until they come. On the loop's
   * landing it waits at the foot of the next flight up for them.
   */
  private birdAhead(): void {
    const { cygnet: k, child: c } = this.cast;
    c.lookAt = k.position;
    if (this.birdStop < this.stop) this.birdStop = this.stop;
    const last = this.looped ? this.stops.length - 1 : this.loopStop;
    const spot = (i: number) => (!this.looped && i === this.loopStop ? this.sCorner : this.track.to(i));
    // A stop it is already up past counts as reached: it is never sent back down the stair to it.
    const s = this.track.project(k.position);
    const past = (i: number) => s > spot(i) - 0.5;
    while (past(this.birdStop) && this.birdStop < Math.min(this.stop + 2, last)) this.birdReached = Math.max(this.birdReached, this.birdStop++);
    const reached = past(this.birdStop);
    if (reached) this.birdReached = Math.max(this.birdReached, this.birdStop);
    const waiting = reached && (this.birdStop >= this.stop + 2 || this.birdStop === last);
    if (!waiting) this.track.lead(k.position, spot(this.birdStop), this.birdAt);
    k.stay = waiting;
    k.errand = waiting ? null : this.birdAt;
  }

  private goRoundFirst(): void {
    const { child: c, cygnet: k } = this.cast;
    this.looped = true;
    this.lofted = true;
    this.lap = 0;
    this.round = 'settle';
    this.homeward = false;
    this.roundT = this.now;
    this.loopFrom = this.now;
    this.eyeFrom.copy(this.world.eye);
    this.lookFrom.copy(this.world.looking);
    k.decks = [...this.decks(), ...CloudStairs.loopDecks()];
    c.walkTo(this.waitBelow.x, this.waitBelow.z, false, undefined, 0.12);
    this.to('loop');
  }

  /**
   * Halfway up the white the stair goes round a square, and seen from the one place the lens rises to, it climbs for
   * ever. The child waits just below it; the bird runs up it, round, up and up and up, and comes up onto the corner
   * it set off from, right over the child. It looks up the way it went, and back the way it came, and down at the
   * child, and asks. And again. A heap of cloud sits on the far corner; when the player's wind blows it off, there is
   * a flight going on up from there that nobody could see, and the bird takes it next time round, and the lens comes
   * away after them, and the square comes apart.
   */
  private goRound(): void {
    const { cygnet: k, child: c } = this.cast;
    const bank = this.world.bank;
    const dt = this.now - this.roundT;
    c.lookAt = k.position;
    bank.yielding = this.lap >= 1 || this.round === 'puzzled';
    const way = this.homeward ? this.roundHome : this.roundOut;
    k.scale = this.round === 'round' && !this.homeward && way.project(k.position) > this.sBack ? sizeOnBack(k.position) : 1;
    switch (this.round) {
      case 'settle': {
        const left = this.track.lead(k.position, this.sCorner, this.birdAt);
        k.stay = left < 0.5;
        k.errand = k.stay ? null : this.birdAt;
        if (this.now - this.loopFrom > LOOP_SETTLE - 0.5) this.setOff();
        break;
      }
      case 'round': {
        k.stay = false;
        k.pace = 0.75;
        const left = way.lead(k.position, way.length, this.birdAt);
        k.errand = this.birdAt;
        this.unstick(left);
        if (!this.homeward) {
          // With the cloud gone off the far corner, it sees the way on as it comes onto that corner, and takes it.
          // Round the corner it cuts inside the turn, so it counts as there once it has come past it.
          const along = way.project(k.position);
          const there = this.alongWas < this.sOnward + 0.2 && along >= this.sOnward - 0.4;
          this.alongWas = along;
          if (bank.cleared && there) {
            k.scale = 1;
            k.decks = this.decks();
            k.mind.perform('wag', 0.9);
            this.revealFrom = this.now;
            this.birdStop = this.loopStop + 4;
            this.birdReached = this.birdStop;
            this.limit = this.reachable();
            this.to('follow');
            break;
          }
          // Over the top of the drawn-in flight it steps onto the corner, which from here is the same place: it is
          // put there at once, along its own sightline.
          if (upBack(k.position) > 1) {
            fromCopy(k.position, this.tmp);
            k.scale = 1;
            k.standAt(this.tmp.x, this.tmp.y, this.tmp.z, k.yaw);
            // Should it ever come down short of the corner, it is on the corner all the same.
            if (k.position.y < this.tmp.y - 0.3) {
              onLanding(landingOf(LOOP.corner), landingOf(LOOP.corner).x1 - 0.2, 0, this.tmp);
              k.standAt(this.tmp.x, this.tmp.y, this.tmp.z, k.yaw);
            }
            this.homeward = true;
            this.stuckLeft = Infinity;
          }
          break;
        }
        if (left < 0.5) {
          this.round = 'puzzled';
          this.roundT = this.now;
          k.errand = null;
          k.stay = true;
          k.does('look-about', undefined, 2);
        }
        break;
      }
      case 'puzzled': {
        // It has come back onto the corner it set off from, right over the child. It looks up the way it went, and
        // back the way it came, and down at the child, and asks.
        const again = this.lap > 0;
        if (dt > 2.1 && this.lastDt <= 2.1) k.does('look-back', this.look.copy(flight(LOOP.wait).top), 1.2);
        if (dt > 3.3 && this.lastDt <= 3.3) k.does('look-back', this.look.copy(LOOP_BACK.top).lerp(LOOP_BACK.bottom, 0.5), 1.2);
        if (dt > 4.5 && this.lastDt <= 4.5) {
          k.call(false, 'puzzled');
          k.does('look-back', this.look.copy(c.position).setY(c.position.y + 1), 1.4);
        }
        if (again && dt > 5.6 && this.lastDt <= 5.6) k.call(false, 'puzzled');
        if (again && dt > 6.2 && this.lastDt <= 6.2) k.does('shake', undefined, 0.9);
        // Then they both look across at the cloud on the far corner.
        if (dt > 5.2) c.lookAt = this.look2.copy(bank.centre);
        if (dt > (again ? 6.6 : 5.4) && this.lastDt <= (again ? 6.6 : 5.4)) k.does('look-back', this.look2, 1.2);
        if (dt > (again ? 7.4 : 6.2)) {
          this.lap++;
          this.setOff();
        }
        break;
      }
    }
    this.lastDt = dt;
  }

  private setOff(): void {
    this.round = 'round';
    this.homeward = false;
    this.alongWas = 0;
    this.stuckLeft = Infinity;
  }

  /**
   * Should it ever stop making way along its line and stay stopped, it is set on along it inside a wisp of the white.
   */
  private unstick(left: number): void {
    const k = this.cast.cygnet;
    if (left < this.stuckLeft - 0.1) {
      this.stuckLeft = left;
      this.stuckSince = this.now;
      return;
    }
    if (this.now - this.stuckSince < 3) return;
    this.world.wisps.engulf(this.tmp.copy(k.position).setY(k.position.y + 0.3), 1.2);
    k.standAt(this.birdAt.x, this.birdAt.y, this.birdAt.z, k.yaw);
    this.stuckSince = this.now;
    this.stuckLeft = Infinity;
  }

  /**
   * Once they are up the stair the bird is always on it. Should anything ever put it off, it is back on it a stop
   * behind the child inside a wisp of cloud, rather than left on the grass or the sea far below them.
   */
  private keepOnTheStair(): void {
    const k = this.cast.cygnet;
    if (k.carried || this.stop < 2 || !['climb', 'waiting', 'hesitate', 'birdFirst', 'follow', 'loop', 'together', 'emerge'].includes(this.beat)) return;
    // It trails her by a whole flight, and from the grass below the first tread by nearly 3 m.
    if (k.position.y > this.cast.child.position.y - 3.5) return;
    const back = this.stops[Math.max(0, this.stop - 1)];
    k.standAt(back.x, levelHeight(back.level), back.z, k.yaw);
    this.world.wisps.engulf(this.tmp.copy(k.position).setY(k.position.y + 0.3), 1.2);
    this.birdStop = Math.max(0, this.stop - 1);
  }

  /** At the child's heel, one stop behind, all the way up; on the grass it just keeps close. */
  private birdBehind(): void {
    const { cygnet: k } = this.cast;
    if (this.stop < 1) {
      k.errand = null;
      k.stay = false;
      return;
    }
    this.birdStop = Math.max(this.birdStop, this.stop - 1);
    // Off the start of the line it would count itself at the foot of the stair from anywhere on the grass.
    const there = this.track.lead(k.position, this.track.to(this.birdStop), this.birdAt) < 0.5
      && Math.hypot(this.birdAt.x - k.position.x, this.birdAt.z - k.position.z) < 0.6;
    k.stay = there;
    k.errand = there ? null : this.birdAt;
  }


  /** Up on top: a step from the edge she stops and takes it all in, and the bird comes up beside her. */
  private takeIn(): void {
    const { child: c, cygnet: k } = this.cast;
    this.to('awe');
    k.decks = this.decks();
    k.errand = this.birdAt.copy(BIRD_TAKES_IN);
    k.stay = false;
    c.walkTo(TAKE_IN.x, TAKE_IN.z, false, () => c.faceToward(TAKE_IN.x + TOP_OUT.x, TAKE_IN.z + TOP_OUT.z, 1), 0.12);
  }

  /** Then she sits on the lip with her feet over the cloud, swinging them, and the bird gets into a slipper. */
  private nest(): void {
    const { child: c, cygnet: k } = this.cast;
    this.to('nest');
    k.watch(null);
    k.errand = this.birdAt.copy(BIRD_NESTS);
    k.stay = false;
    c.walkTo(SIT.x, SIT.z, false, () => {
      c.faceToward(SIT.x + TOP_OUT.x, SIT.z + TOP_OUT.z, 1);
      c.sitDown(1.4);
      c.dangle = 1;
    }, 0.12);
  }

  /** Once it has got where it was going on the landing, the bird stays there. */
  private settle(dt: number): void {
    const { child: c, cygnet: k } = this.cast;
    if (c.sitting) c.faceToward(this.sun.x, this.sun.z, 1 - Math.exp(-dt * 3));
    if (!k.stay && k.errand && Math.hypot(k.position.x - this.birdAt.x, k.position.z - this.birdAt.z) < 0.35) {
      k.stay = true;
      k.errand = null;
    }
  }

  /** A point out over the cloud from the top landing, `turn` radians to the left of the sun and `up` metres above it. */
  private outOver(turn: number, up: number, out: THREE.Vector3): THREE.Vector3 {
    out.copy(this.sun).sub(TOP).setY(0).normalize().applyAxisAngle(THREE.Object3D.DEFAULT_UP, turn);
    return out.multiplyScalar(60).add(TOP).setY(TOP.y + up);
  }

  /**
   * A skein of swans comes from behind the landing, high over the cloud off to her left, and goes on out toward the
   * sun without them.
   */
  private sendSkein(): void {
    this.skeinSent = true;
    const behind = Math.atan2(-TOP_OUT.x, -TOP_OUT.z) - SKEIN_FROM_TURN;
    const x = SIT.x + Math.sin(behind) * SKEIN_FROM;
    const z = SIT.z + Math.cos(behind) * SKEIN_FROM;
    const high = CLOUD.top + SKEIN_HIGH;
    const heading = this.clearWay(x, z, high, Math.atan2(this.sun.x - SIT.x, this.sun.z - SIT.z) - SKEIN_HEADING);
    const run = 140;
    this.cast.flock.pass(x + Math.sin(heading) * run, z + Math.cos(heading) * run, high, heading, 9, run, false);
    this.to('skein');
  }

  /**
   * The heading nearest `heading` on which the whole skein, from (x, z) at height y, flies clear of every tower
   * of cumulus until it is put away, rather than through one; or the clearest there is.
   */
  private clearWay(x: number, z: number, y: number, heading: number): number {
    const towers = this.world.cloud.towers;
    const from = this.tmp, dir = this.tmp2;
    let best = heading, clearest = -Infinity;
    for (let i = 0; i <= 2 * SKEIN_TURNS_AT_MOST / SKEIN_TURN_STEP; i++) {
      const way = heading + (i % 2 ? 1 : -1) * Math.ceil(i / 2) * SKEIN_TURN_STEP;
      dir.set(Math.sin(way), 0, Math.cos(way));
      let clear = Infinity;
      for (const side of [-SKEIN_SPAN, 0, SKEIN_SPAN]) {
        clear = Math.min(clear, towers.clearanceAlong(from.set(x + dir.z * side, y, z - dir.x * side), dir, SKEIN_GOES));
      }
      if (clear > SKEIN_ROOM) return way;
      if (clear > clearest) { clearest = clear; best = way; }
    }
    return best;
  }

  private gather(): void {
    const { child: c, cygnet: k, carry, boat } = this.cast;
    this.to('gather');
    c.standUp();
    k.stay = false;
    k.watch(null);
    carry.gatherUp(() => {
      const beside = boat.boardingPoint(this.tmp);
      const edge = this.tmp2.copy(TOP_EDGE).addScaledVector(TOP_OUT, -0.25);
      const way = along(CLOUD_BERTH.yaw);
      edge.addScaledVector(way, THREE.MathUtils.clamp((beside.x - edge.x) * way.x + (beside.z - edge.z) * way.z, -0.8, 0.8));
      c.walkTo(edge.x, edge.z, false, () => {
        this.to('boarding');
        c.faceToward(boat.position.x, boat.position.z, 1);
        c.board(boat, () => {
          c.stroll = 1;
          c.decks = [];
          k.decks = [];
          k.pace = 1;
          c.stowPlane(false);
          this.cast.plane.homeRadius = this.oldRadius;
          boat.mooring = null;
          boat.grounded = false;
          boat.canGround = false;
          boat.speedLimit = tuning.sail.topSpeed * 0.7;
          this.leg = 0;
          boat.steerFor = CLOUD_ROUTE[0];
          this.to('sail');
        });
      }, 0.25);
    });
  }

  /**
   * The boat has been out on the cloud all along, waiting inside the foot of a tower of cumulus off to the right of
   * the sun, under the swans' way, so nobody sees it until it comes out. The lantern is already lit.
   */
  private berthOnCloud(): void {
    const { boat } = this.cast;
    this.berthed = true;
    const way = along(CLOUD_BERTH.yaw);
    const toSun = this.tmp.copy(this.sun).sub(TOP).setY(0).normalize();
    // Out of the cloud toward them, coming round onto the line of the landing's open edge a few lengths short of it.
    const short = new THREE.Vector2(CLOUD_BERTH.x - way.x * 9, CLOUD_BERTH.z - way.z * 9);
    this.harbour(toSun, this.waiting);
    this.approach = [short, new THREE.Vector2(CLOUD_BERTH.x, CLOUD_BERTH.z)];
    boat.position.set(this.waiting.x, RIDE, this.waiting.y);
    boat.yaw = Math.atan2(short.x - this.waiting.x, short.y - this.waiting.y);
    boat.altitude = RIDE;
    boat.afloat = true;
    boat.grounded = false;
    boat.canGround = false;
    boat.speed = 0;
    boat.steerFor = null;
    boat.mooring = null;
    this.world.group.add(this.lantern.glow);
    this.lantern.brightness = 1;
  }

  /**
   * The nearest tower a little to the right of the sun, where the swans go over: the boat waits inside its foot and
   * comes out of it toward the landing. Without one it waits far off toward the sun.
   */
  private harbour(toSun: THREE.Vector3, out: THREE.Vector2): THREE.Vector2 {
    let best: { centre: THREE.Vector3; size: number } | null = null;
    let nearest = Infinity;
    for (const t of this.world.cloud.towers.towers) {
      const dx = t.centre.x - TOP.x, dz = t.centre.z - TOP.z, d = Math.hypot(dx, dz);
      const right = Math.atan2(toSun.x * dz - toSun.z * dx, toSun.x * dx + toSun.z * dz);
      if (d > 90 && d < 200 && right > 0.15 && right < 0.7 && d < nearest) { best = t; nearest = d; }
    }
    if (!best) return out.set(CLOUD_BERTH.x + toSun.x * 80, CLOUD_BERTH.z + toSun.z * 80);
    const home = out.set(TOP.x - best.centre.x, TOP.z - best.centre.z).normalize();
    return home.multiplyScalar(best.size * HIDE_IN).add({ x: best.centre.x, y: best.centre.z });
  }

  /**
   * Once the swans are over, the kite brings the boat out of the cloud and in across it to them: it comes round
   * onto the line of the landing's edge and slows, and lies alongside, close enough to step into.
   */
  private comeAlongside(dt: number): void {
    const { boat } = this.cast;
    if (!this.approach.length || boat.grounded) return;
    if (!this.boatComing) {
      boat.position.set(this.waiting.x, RIDE, this.waiting.y);
      boat.speed = 0;
      return;
    }
    const to = this.approach[this.approachLeg];
    const last = this.approachLeg === this.approach.length - 1;
    if (!last && Math.hypot(to.x - boat.position.x, to.y - boat.position.z) < 5) this.approachLeg++;
    boat.steerFor = this.approach[this.approachLeg];
    const berth = this.approach[this.approach.length - 1];
    const left = Math.hypot(berth.x - boat.position.x, berth.y - boat.position.z);
    boat.mooring = CLOUD_BERTH;
    boat.becalmed = 1;
    const S = THREE.MathUtils.smoothstep;
    // Well slowed by the time it is near, so it is plainly coming alongside rather than running into them.
    const cruise = THREE.MathUtils.lerp(1.2, 3.2, S(left, 3, 20)) + FAR_OUT_SPEED * S(left, 35, 95);
    boat.speed = Math.max(boat.speed, cruise * S(this.comingFor += dt, 0, 3));
    this.world.sailing(boat, dt);
  }

  /** The halo sits on the flame of the lantern on the boat's stem post. */
  private lanternGlow(): void {
    if (!this.berthed || !this.lantern.glow.parent) return;
    const { boat } = this.cast;
    boat.group.updateMatrixWorld(true);
    this.lantern.glow.position.copy(this.flame).applyMatrix4(boat.group.matrixWorld);
  }

  /** On along the way over the cloud, waypoint by waypoint; the last lies far on past the bank of mist. */
  private steer(): void {
    const { boat } = this.cast;
    const from = this.leg === 0 ? this.berth : CLOUD_ROUTE[this.leg - 1];
    const wp = CLOUD_ROUTE[this.leg];
    if (this.leg < CLOUD_ROUTE.length - 1 && roundedWaypoint(boat.position.x, boat.position.z, from.x, from.y, wp.x, wp.y, 9)) {
      boat.steerFor = CLOUD_ROUTE[++this.leg];
    }
  }

  /**
   * Over the cloud the hull rises and falls on the billows going under it, slowly, on the mean of the tops under its
   * bow, its stern and either side, so it sits down in them by about as much as it always has.
   */
  private onTheBillows(dt: number): void {
    const { boat } = this.cast;
    const cloud = this.world.cloud;
    const p = boat.position, fx = Math.sin(boat.yaw) * 1.8, fz = Math.cos(boat.yaw) * 1.8;
    const under = (cloud.surfaceAt(p.x + fx, p.z + fz) + cloud.surfaceAt(p.x - fx, p.z - fz)
      + cloud.surfaceAt(p.x + fz * 0.5, p.z - fx * 0.5) + cloud.surfaceAt(p.x - fz * 0.5, p.z + fx * 0.5)) / 4;
    this.riding += (under - 0.35 - this.riding) * (1 - Math.exp(-dt * 1.2));
    boat.altitude = this.riding;
  }

  private sail(dt: number): void {
    const { boat } = this.cast;
    const k = tuning.stairs;
    this.onTheBillows(dt);
    boat.speedLimit = k.sailSpeed;
    boat.becalmed = 0;
    this.world.sailing(boat, dt);
    // The kite draws them the whole way, so nobody has to blow; it takes up the tow gently off the landing.
    boat.speed = Math.max(boat.speed, k.kiteDraws * THREE.MathUtils.smoothstep(this.t, 0, 7));
    this.sailed += boat.speed * dt;
    this.steer();
    this.lookOut(dt);
    if (this.world.cloud.fog.depthOf(boat.position.x, boat.position.z) > 0) this.to('fog');
  }

  /** A point on the starboard gunwale, `z` along the hull from amidships, a little inboard of the rail. */
  private onRail(z: number, inboard: number, out: THREE.Vector3): THREE.Vector3 {
    const u = stationU(z);
    return this.cast.boat.group.localToWorld(out.set(-(gunwaleHalf(u) - inboard), gunwale(u), z));
  }

  /**
   * Under way they look out. The bird hops up onto the gunwale on the sunward side, just forward of her, and the
   * child turns on the thwart toward it, arms folded on the rail, both of them watching the cloud go by; now and then
   * she looks at the bird. As the bank of mist comes up it goes back into her arms and she sits round again.
   */
  private lookOut(dt: number): void {
    const { boat, child: c, cygnet: k, carry } = this.cast;
    const ahead = this.world.cloud.fog.depthOf(boat.position.x, boat.position.z);
    const out = this.sailed > 22 && ahead < -45;
    if (out && !this.perched && k.seat === 'cradle' && !carry.busy) this.perched = true;
    if (!out && this.perched) {
      this.perched = false;
      k.watch(null);
      k.rideIn('cradle');
    }
    this.lookingOut = THREE.MathUtils.clamp(this.lookingOut + (this.perched ? dt : -dt) / 2.2, 0, 1);
    const turned = THREE.MathUtils.smootherstep(this.lookingOut, 0, 1);
    boat.group.updateMatrixWorld(true);
    // Shifted toward the starboard side on the thwart and turned to it.
    const seat = this.onRail(-0.25, 0, this.rail[2]).lerp(boat.seat(this.tmp), 1 - 0.32 * turned);
    c.ride(seat, boat.yaw - 0.55 * turned, boat);
    // Toward the low sun, a little above the tops, wherever the wander has the bow: where it is all going.
    const sun = atmo.uniforms.uSunDir.value;
    const flat = Math.hypot(sun.x, sun.z) || 1;
    this.outThere.set(boat.position.x + sun.x / flat * 40, boat.position.y + 4, boat.position.z + sun.z / flat * 40);
    c.lean = 0.14 * turned;
    if (this.perched) {
      k.perch(this.onRail(0.25, 0.08, this.tmp2), boat.yaw - 0.9);
      k.watch(this.outThere);
    }
    if (turned > 0.35) {
      c.reachFor(0, this.onRail(0.05, 0.05, this.rail[0]));
      c.reachFor(1, this.onRail(-0.2, 0.04, this.rail[1]));
    } else {
      c.reachFor(0, null);
      c.reachFor(1, null);
    }
    const glance = this.perched && this.t % 11 > 8.5;
    c.lookAt = turned < 0.05 ? null : glance ? k.eye(this.tmp) : this.outThere;
  }

  /**
   * Into the bank of mist, level: the bow and the lantern go into the white first, then the child. Far enough in
   * there is nothing but the white and the lantern, and the hull is let down onto the sea, which nobody can see.
   */
  private fog(dt: number): void {
    const { boat, child: c } = this.cast;
    const k = tuning.stairs;
    const depth = this.world.cloud.fog.depthOf(boat.position.x, boat.position.z);
    this.onTheBillows(dt);
    boat.speedLimit = THREE.MathUtils.lerp(k.sailSpeed, k.fogSpeed, THREE.MathUtils.smoothstep(depth, 0, 20));
    boat.becalmed = 0;
    // The white carries them on; nobody is left waiting in it.
    boat.speed = Math.max(boat.speed, 2.6);
    this.world.sailing(boat, dt);
    this.sailed += boat.speed * dt;
    this.steer();
    if (depth > k.bankSwap) this.downOntoTheSea();
    c.ride(boat.seat(this.tmp), boat.yaw, boat);
  }

  /**
   * In the white the hull is let down onto the sea where the drowned village begins, as far short of it as the
   * white takes to thin, on the heading it had; the bank of mist, the spray off the hull and the camera go with it.
   */
  private downOntoTheSea(): void {
    const { boat } = this.cast;
    const fog = this.world.cloud.fog;
    const short = tuning.stairs.fogLift * 3;
    const x = DESCENT_END.x - Math.sin(boat.yaw) * short, z = DESCENT_END.y - Math.cos(boat.yaw) * short;
    const dx = x - boat.position.x, dy = SEA_RIDE - boat.position.y, dz = z - boat.position.z;
    boat.position.set(x, SEA_RIDE, z);
    // The hull as drawn goes with it now, so the child is seated in it where it is this very frame.
    boat.group.position.set(boat.group.position.x + dx, boat.group.position.y + dy, boat.group.position.z + dz);
    boat.group.updateMatrixWorld(true);
    boat.altitude = null;
    fog.at.x += dx;
    fog.at.y += dz;
    this.world.cloud.wake.shift(dx, dy, dz);
    this.world.sailing(null, 0);
    boat.steerFor = DESCENT_END;
    // The village is there under the white from now on, coming up out of its own veil before the white thins.
    stairsDescent.down = true;
    Object.assign(this.framingFrom, this.framing);
    this.cuts++;
    this.to('thin');
  }

  /**
   * Still in the white, but on the water now: it goes from the gold of the cloud to the grey and blue of dusk as
   * it thins, and they sail out of the back of it into the village.
   */
  private thin(dt: number): void {
    const { boat, child: c } = this.cast;
    c.ride(boat.seat(this.tmp), boat.yaw, boat);
    boat.speedLimit = 3.4;
    boat.speed = Math.max(boat.speed, 2.6);
    this.dusk = THREE.MathUtils.lerp(0.62, 0.75, THREE.MathUtils.smoothstep(this.t, 0, tuning.stairs.fogLift));
    // The lens comes round onto the way the hull is going as the village comes up ahead.
    const turn = Math.atan2(Math.sin(boat.yaw - this.voyageYaw), Math.cos(boat.yaw - this.voyageYaw));
    this.voyageYaw += turn * (1 - Math.exp(-dt * 0.6));
    // The flame gutters out as they come down onto the water.
    this.lantern.brightness = 1 - THREE.MathUtils.smoothstep(this.t, 0.4, 3);
    if (this.t > tuning.stairs.fogLift) {
      this.world.group.remove(this.lantern.glow);
      this.world.cloudHole = true;
      this.to('down');
    }
  }

  /**
   * The bank of mist: standing on the cloud across the way, visible from the landing on; and after they are let
   * down, round the boat on the sea, gold at first as it was up there, then grey and blue as it thins and the boat
   * sails out of the back of it. Nobody asks for it before they board or once the village has them.
   */
  private mistBank(dt: number): void {
    if (!['gather', 'boarding', 'sail', 'fog', 'thin'].includes(this.beat)) return;
    const { boat } = this.cast;
    const k = tuning.stairs;
    const S = THREE.MathUtils.smoothstep;
    const fog = this.world.cloud.fog.ask();
    const u = atmo.uniforms;
    this.mist = Math.min(1, this.mist + dt / 4);
    // The white up there: cream, the low sun through it and the light of the sky, without the sky's colours, as the cloud is lit.
    fog.light.copy(CLOUD_GOLD).multiplyScalar(0.33 * luma(u.uSunColor.value))
      .addScalar(1.32 * luma(u.uSkyAmbient.value) + 0.33 * luma(u.uSkyHorizon.value));
    fog.glow = 1;
    if (this.beat !== 'thin') {
      fog.face(FOG_BANK.x, FOG_BANK.z, FOG_BANK.yaw);
      fog.floor = CLOUD.top - 0.3;
      fog.top = CLOUD.top + k.bankHeight;
      fog.deep = 1e4;
      fog.amount = this.mist;
      const depth = fog.depthOf(boat.position.x, boat.position.z);
      this.white = S(depth, -6, k.bankSwap);
      fog.clear = 0.85 - 0.55 * S(depth, k.bankSwap - 12, k.bankSwap);
      return;
    }
    // On the sea: the same bank over the water, which the boat sails out of the back of as the white thins.
    const t = this.t, lift = k.fogLift;
    fog.floor = SEA_RIDE - (RIDE - CLOUD.top + 0.3);
    fog.top = fog.floor + k.bankHeight;
    // Its back comes to meet them unseen, then goes by slowly over the last tens of metres, where the white can be seen
    // to thin, so they drift out of it, with the bank left lying behind them on the water and melting away.
    const out = THREE.MathUtils.clamp((t - 7) / (lift * 0.85 - 7), 0, 1);
    const ahead = THREE.MathUtils.lerp(300, 30, S(t, 2, 7)) - 42 * out;
    fog.deep = fog.depthOf(boat.position.x, boat.position.z) + ahead;
    fog.amount = 1 - S(t, lift * 0.65, lift);
    fog.clear = 0.3 + 0.55 * S(t, 0.3, 3);
    this.white = 1 - S(t, 5, lift * 0.8);
    // From the gold of the cloud to the grey and blue of the dusk over the sea, and the sun going out of it.
    const dusk = this.mistLight.copy(u.uSkyAmbient.value).multiplyScalar(1.4).add(this.tmpColor.copy(u.uSkyHorizon.value).multiplyScalar(0.35))
      .multiply(DUSK_MIST);
    fog.light.lerp(dusk, S(t, 1.2, 5.5));
    fog.glow = 1 - 0.6 * S(t, 1.2, 5.5);
  }

  /** A point out toward the setting sun, level with the top landing, wherever the sky has put it. */
  private sunPoint(): void {
    const d = atmo.uniforms.uSunDir.value;
    const len = Math.hypot(d.x, d.z) || 1;
    this.sun.set(TOP.x + d.x / len * 60, TOP.y + 3, TOP.z + d.z / len * 60);
  }

  /**
   * The deck as this beat needs it: its underside lowered to the sea for the way down, and a pocket round whoever
   * is in it that closes in and thickens the higher they climb, with the cloud streaming through it on the wind.
   */
  private cloud(dt: number): void {
    const { child: c, boat } = this.cast;
    const d = this.cloudDeck;
    const k = tuning.stairs;
    const S = THREE.MathUtils.smoothstep;
    d.amount = 1;
    d.top = CLOUD.top;
    d.clearing = undefined;
    // Down on the sea the deck is put out of the way under it at once, in the white, so no ceiling hangs over the village.
    d.snap = this.beat === 'thin' || this.beat === 'down';
    // Soft over its top while they come up out of it, clearing away once they are sitting in the sun.
    const rising = ['hesitate', 'birdFirst', 'follow', 'loop', 'together', 'emerge'].includes(this.beat);
    d.crown = rising ? k.crown : Math.max(0, (d.crown ?? 0) - dt * k.crown / 7);
    const wisps = this.world.wisps;
    if (this.beat === 'fog' || this.beat === 'thin' || this.beat === 'down') {
      const sea = this.beat !== 'fog';
      d.base = sea ? -60 : CLOUD.base;
      d.top = sea ? -50 : CLOUD.top;
      // And goes, all but a trace that keeps the bank of mist drawn until it too has gone.
      d.amount = sea ? 0.001 : 1;
      this.world.cloudHole = false;
      // The pocket of clearer air in the white takes in the boat and the lens behind it.
      const hull = boat.position;
      const mid = this.tmp2.copy(hull).lerp(this.eye, 0.45);
      d.bubble.set(mid.x, hull.y + 1.8, mid.z, 0.55 * this.framing.distance + 3);
      // The white streams past them in the bank itself; the rags of cloud from the climb have no place in it.
      wisps.amount = 0;
      // On the sea the air and the swell rise to the village's as the white thins, so they are there when it has them.
      this.breeze = sea ? THREE.MathUtils.lerp(0.35, 1, S(this.t, 1, tuning.stairs.fogLift)) : 0.35;
      return;
    }
    d.base = CLOUD.base;
    const climb = this.air.climb;
    const inCloud = c.position.y > CLOUD.base - 3 && c.position.y < CLOUD.top - 0.3;
    d.bubble.set(c.position.x, c.position.y + 1.1, c.position.z, inCloud ? THREE.MathUtils.lerp(k.bubble, k.bubbleTop, climb) : 0);
    if (inCloud) {
      // Seen from further off, the pocket is clearer too, or the length of it would still hide her.
      d.clearing = THREE.MathUtils.lerp(THREE.MathUtils.lerp(k.clearing, k.clearingTop, climb), 0.02, this.takeInTheLens(d.bubble));
    }
    // Over the loop the clear air opens out into a hollow in the white big enough for the lens and the whole
    // square; the cloud is made deep enough overhead that the lens, up there, is still in it. It stays open while
    // the lens comes down after them, so the square is seen to come apart, and closes in once the lens is down.
    if (this.beat === 'loop' || this.lofted) {
      // The pocket's clear heart reaches from the lens to just past the loop; beyond that it thickens to white, and
      // the cloud goes on down under the loop far enough that nothing shows through from below. Wherever the lens is,
      // on its way up to the one place or coming round beside the loop after, the pocket goes with it.
      const lens = this.world.eye;
      const heart = lens.distanceTo(LOOP_LOOK) / 2 + 2.5;
      d.bubble.set((lens.x + LOOP_LOOK.x) / 2, (lens.y + LOOP_LOOK.y) / 2, (lens.z + LOOP_LOOK.z) / 2, heart / 0.6);
      d.clearing = 0.006;
      d.base = LOOP_LOOK.y - 14;
    }
    if (this.lofted && this.beat !== 'loop' && !this.revealing && this.world.eye.y < CLOUD.top - 1.5) this.lofted = false;
    if (this.lofted) d.top = LOOP_EYE.y + 6;
    this.world.hideTop = this.lofted;
    const white = ['hesitate', 'birdFirst', 'follow', 'loop', 'together', 'emerge'].includes(this.beat);
    wisps.amount = (white ? S(c.position.y + 1.2, CLOUD.base - 2, CLOUD.base + 0.8) * (1 - S(c.position.y, CLOUD.top - 0.8, CLOUD.top + 0.6)) : 0)
      * (this.beat === 'loop' ? 0.35 : 1);
    wisps.centre.set(c.position.x, c.position.y + 1, c.position.z);
    wisps.child.copy(c.position);
    wisps.bird.copy(this.cast.cygnet.position);
    // Across both the side view up the stair and the view along it on the ring's landing.
    wisps.wind.set(0.7, 0.12, -0.7).normalize().multiplyScalar(k.windInCloud * (0.45 + 0.55 * climb));
    // The wind in the white rises as they climb; on top it falls to a soft air that keeps the cloud moving, and
    // freshens a little behind them once they are under way.
    const out = this.air.open;
    const aloft = this.beat === 'sail' ? THREE.MathUtils.lerp(0.25, 0.5, S(this.t, 0, 12)) : 0.25;
    this.breeze = white ? THREE.MathUtils.lerp(0.35, 1.3, climb) * (1 - out) + aloft * out : out > 0.5 ? aloft : 0.35;
  }

  /**
   * In the white the pocket of clearer air is round the child, and the lens, close behind her, is in its thin edge.
   * When the lens is further off than that, coming back to her from somewhere else, the pocket stretches to take it
   * in too, so it is never left in blank white looking for her; it draws back round her as the lens comes in.
   */
  private takeInTheLens(bubble: THREE.Vector4): number {
    const lens = this.world.eye;
    const far = lens.distanceTo(this.tmp2.set(bubble.x, bubble.y, bubble.z));
    const w = THREE.MathUtils.smoothstep(far, 6, 10);
    if (w <= 0) return 0;
    const mid = this.tmp2.lerp(lens, 0.5 * w);
    const heart = Math.max(mid.distanceTo(lens), mid.distanceTo(this.tmp.set(bubble.x, bubble.y, bubble.z))) + 1.5;
    bubble.set(mid.x, mid.y, mid.z, Math.max(bubble.w, w * heart / 0.6));
    return w;
  }

  /** Whether the lens is still showing the loop come apart after the bird found the way on. */
  private get revealing(): boolean {
    return this.revealFrom >= 0 && this.now - this.revealFrom < REVEAL;
  }

  /**
   * The lens stays a moment where the loop closes, then comes round beside it and lower, while its last flight lets
   * go of the trick: seen from here it climbs on past the corner and stops in the air, a whole round too high.
   */
  private revealShot(): void {
    const s = this.shot;
    const e = THREE.MathUtils.smoothstep(this.now - this.revealFrom, REVEAL_HOLD, REVEAL);
    const from = this.tmp.subVectors(LOOP_EYE, LOOP_LOOK);
    // Round and down to nearly level with the loop, where the last flight is plainly a storey too high, and inside
    // the white again, so the hollow can close behind the lens.
    const reach = from.length() * THREE.MathUtils.lerp(1, 0.65, e);
    const rise = THREE.MathUtils.lerp(Math.asin(from.y / from.length()), 0.18, e);
    const bearing = Math.atan2(from.x, from.z) + 0.95 * e;
    this.revealLook.copy(LOOP_LOOK).y += 1.2 * e;
    s.eye = this.revealEye.set(Math.sin(bearing) * Math.cos(rise), Math.sin(rise), Math.cos(bearing) * Math.cos(rise))
      .multiplyScalar(reach).add(this.revealLook);
    s.target.copy(this.revealLook);
    s.exact = true;
    s.zoom = THREE.MathUtils.lerp(LOOP_ZOOM, 1.5, e);
    this.focus.copy(LOOP_LOOK);
    this.pace = 0.25;
  }

  /**
   * As she sits, the lens drifts round her right, away from the sun, to her side out over the cloud: her feet hanging
   * over the lip and swinging, and the bird beside her in its slipper.
   */
  private toHerSide(): void {
    const s = this.shot;
    if (this.arcFor !== this.beat) this.lensSetsOff(SIT);
    const u = ease((this.now - this.arcAt) / TO_HER_SIDE);
    const side = Math.atan2(TOP_OUT.x, TOP_OUT.z) + SIDE_TURN;
    const b = THREE.MathUtils.lerp(this.arcBearing, this.arcBearing + THREE.MathUtils.euclideanModulo(side - this.arcBearing, Math.PI * 2), u);
    const reach = THREE.MathUtils.lerp(this.arcReach, SIDE_REACH, u);
    // It keeps its height until it is past the rail on her right, then comes down beside her.
    const down = ease(((this.now - this.arcAt) / TO_HER_SIDE - 0.35) / 0.65);
    s.eye = this.arcEye.set(SIT.x + Math.sin(b) * reach, THREE.MathUtils.lerp(this.eyeFrom.y, TOP.y + SIDE_HEIGHT, down), SIT.z + Math.cos(b) * reach);
    s.target.copy(SIT).setY(TOP.y + SIDE_LOOK).lerp(this.lookFrom, 1 - u);
    s.exact = true;
    this.focus.copy(SIT);
  }

  /**
   * The swans come in at the left of that and the lens goes with them, back round her and up, as far as they have
   * come round toward the sun, until it is behind the two of them looking up at the sky they are crossing.
   */
  private withTheSwans(dt: number): boolean {
    const s = this.shot;
    const flock = this.cast.flock;
    const bearing = flock.active ? Math.atan2(flock.head.x - SIT.x, flock.head.z - SIT.z) : this.skeinBearing;
    const wide = THREE.MathUtils.degToRad(32), high = THREE.MathUtils.degToRad(19);
    if (this.arcFor !== this.beat) {
      this.lensSetsOff(SIT);
      // It waits for them to come well into the frame before it goes with them.
      this.skeinBearing = this.arcBearing + Math.PI + wide * KEEP_THEM_IN;
      this.withThem = this.keepTurn = this.keepTilt = 0;
    }
    const sun = Math.atan2(this.sun.x - SIT.x, this.sun.z - SIT.z);
    const settles = sun + SKEIN_SETTLES;
    const way = THREE.MathUtils.euclideanModulo(this.skeinBearing - settles + Math.PI, Math.PI * 2) - Math.PI;
    const come = THREE.MathUtils.euclideanModulo(this.skeinBearing - bearing + Math.PI, Math.PI * 2) - Math.PI;
    const goal = flock.active ? THREE.MathUtils.clamp(come / way, 0, 1) : 1;
    this.withThem += (Math.max(goal, this.withThem) - this.withThem) * (1 - Math.exp(-dt * 1.5));
    const u = this.withThem > 0.995 ? 1 : this.withThem;
    // Where it arrives is where the loop's framing for the skein holds it.
    const behind = Math.atan2(TOP.x - this.sun.x, TOP.z - this.sun.z) + 0.1;
    const b = THREE.MathUtils.lerp(this.arcBearing, this.arcBearing - THREE.MathUtils.euclideanModulo(this.arcBearing - behind, Math.PI * 2), u);
    const reach = THREE.MathUtils.lerp(this.arcReach, 10, u);
    const centre = this.tmp.copy(SIT).lerp(SLIPPERS, 0.5 * u);
    const at = this.tmp2.copy(SIT).lerp(SLIPPERS, 0.5).setY(TOP.y + 2.6);
    s.eye = this.arcEye.set(centre.x + Math.sin(b) * reach, THREE.MathUtils.lerp(this.eyeFrom.y, at.y - 0.3, u), centre.z + Math.cos(b) * reach);
    s.target.lerpVectors(this.lookFrom, at, u);
    // It turns and tilts only as far as it takes to keep them in the frame.
    const look = this.theirWay.copy(s.target).sub(s.eye);
    const range = look.length();
    const yaw = Math.atan2(look.x, look.z), pitch = Math.asin(look.y / range);
    let turn = 0, tilt = 0;
    if (flock.active) {
      const to = this.tmp.copy(flock.head).sub(s.eye);
      const off = THREE.MathUtils.euclideanModulo(Math.atan2(to.x, to.z) - yaw + Math.PI, Math.PI * 2) - Math.PI;
      const seen = 1 - THREE.MathUtils.smoothstep(Math.abs(off), wide * 0.85, wide * 1.1);
      turn = (off - THREE.MathUtils.clamp(off, -wide * KEEP_THEM_IN, wide * KEEP_THEM_IN)) * seen;
      tilt = Math.max(0, Math.asin(to.y / to.length()) - pitch - high * KEEP_THEM_UNDER) * seen;
    }
    this.keepTurn += (turn - this.keepTurn) * (1 - Math.exp(-dt * 2));
    this.keepTilt += (tilt - this.keepTilt) * (1 - Math.exp(-dt * 2));
    const y = yaw + this.keepTurn, p = pitch + this.keepTilt;
    s.target.set(Math.sin(y) * Math.cos(p), Math.sin(p), Math.cos(y) * Math.cos(p)).multiplyScalar(range).add(s.eye);
    s.exact = true;
    this.focus.copy(SIT);
    return u < 1 || Math.abs(this.keepTurn) + this.keepTilt > 0.01;
  }

  /** Out of the white and on while she takes it in: from behind her, risen and drawn back as the cloud opens out to the sun. */
  private overTheCloud(open: number): void {
    const s = this.shot;
    const c = this.cast.child.position;
    const back = this.tmp.copy(TOP).sub(this.sun).setY(0).normalize();
    s.from = this.from.copy(back).applyAxisAngle(THREE.Object3D.DEFAULT_UP, 0.25 * (1 - open));
    s.target.copy(c).addScaledVector(back, -2.5 * open);
    s.target.y = TOP.y + 1.3 + open * 0.8;
    s.distance = THREE.MathUtils.lerp(4, 12, open);
    s.height = THREE.MathUtils.lerp(0.5, 3.6, open);
    s.clearance = 0.4;
    this.pace = 0.16;
  }

  /** Starts an authored move from wherever the lens is, measured round `about`. */
  private lensSetsOff(about: THREE.Vector3): void {
    this.arcFor = this.beat;
    this.arcAt = this.now;
    this.eyeFrom.copy(this.world.eye);
    this.lookFrom.copy(this.world.looking);
    this.arcBearing = Math.atan2(this.eyeFrom.x - about.x, this.eyeFrom.z - about.z);
    this.arcReach = Math.hypot(this.eyeFrom.x - about.x, this.eyeFrom.z - about.z);
  }

  private frame(dt: number): void {
    const s = this.shot;
    const { child, boat, cygnet } = this.cast;
    const c = child.position;
    s.subjects = undefined;
    s.eye = undefined;
    s.carry = false;
    s.carryAnchor = undefined;
    s.clearance = undefined;
    s.smoothFit = undefined;
    s.exact = false;
    s.zoom = undefined;
    this.focus.copy(c);
    switch (this.beat) {
      case 'ashore':
      case 'wonder': {
        if (this.beat === 'wonder') {
          // Where she stops: low on the slope behind her and off to one side, looking up past her the way she looks,
          // up the stair to where it goes into the cloud.
          s.eye = this.arrivalEye.copy(STAIRS_LOOK_FROM).setY(c.y + 1.4);
          s.target.copy(STAIRS_LOOK_UP).setY(c.y + 4);
          s.zoom = STAIRS_LOOK_ZOOM;
          s.clearance = 0.9;
          this.pace = 0.3;
          return;
        }
        // Up the grass from the boat with her, the foot of the stair ahead of them.
        s.from = this.from.set(-0.42, 0, 1).normalize();
        const portrait = typeof window !== 'undefined' && window.innerHeight > window.innerWidth;
        s.target.copy(c).lerp(STAIRS_FOOT, portrait ? 0.12 : 0.35);
        s.target.y = c.y + 2.4;
        s.distance = 12.5;
        s.height = 1.4;
        // A narrow screen loses her off the side of this view as she walks up from the boat.
        this.ashoreSubjects.primary.copy(c).y += 1.1;
        this.ashoreSubjects.secondary.copy(this.ashoreSubjects.primary);
        s.subjects = this.ashoreSubjects;
        this.pace = 0.35;
        return;
      }
      case 'climb':
      case 'waiting': {
        // From behind them and above, looking up the stair the way it climbs, and the same way on through the
        // puzzle: the gold drawing of the missing flight straight on up the stair from them, the loose flight
        // hanging level with it off to one side, so that a stroke carries it across the screen onto its drawing;
        // and holding still while it is moved.
        s.from = this.from.set(0.12, 0, 1).normalize();
        this.subjects.primary.copy(c).y += 1.1;
        const piece = this.world.waiting;
        const high = c.y > levelHeight(BELOW_CLOUD - 1);
        if (piece && this.beat === 'waiting') {
          const home = this.tmp2.lerpVectors(piece.flight.bottom, piece.flight.landing, 0.5);
          this.world.pointOn(piece, home, this.subjects.secondary);
          this.subjects.tertiary.copy(home);
          s.subjects = this.subjects;
          s.smoothFit = 1.5;
          s.target.copy(c).lerp(home, 0.6);
          s.target.y = THREE.MathUtils.lerp(c.y + 1, home.y, 0.5);
          s.distance = 13;
          // Up over the gap, but never into the cloud.
          s.height = Math.min(6.5, CLOUD.base - 2.4 - s.target.y);
        } else if (c.y < STAIRS_GROUND + 0.3) {
          // Still on the grass: from the south, the stair ahead of them, as they first saw it.
          s.from = this.from.set(-0.1, 0, 1).normalize();
          s.target.set(THREE.MathUtils.lerp(c.x, STAIRS_FOOT.x, 0.4), c.y + 2.2, c.z);
          s.distance = 14;
          s.height = 1.8;
        } else {
          s.target.set(c.x, c.y + 1.4, c.z);
          s.distance = high ? 11 : 13;
          s.height = Math.min(4.5, CLOUD.base - 2.4 - s.target.y);
        }
        this.pace = 0.4;
        return;
      }
      case 'hesitate':
      case 'birdFirst': {
        // Out past the landing's far corner, level with her and clear of the flight overhead: her face turned up at
        // where the stair goes into the white, and that flight going up beside her, the bird on it.
        const L = landingOf(BELOW_CLOUD);
        s.from = this.from.copy(along(L.yaw)).addScaledVector(leftOf(L.yaw), 0.5).normalize();
        s.target.copy(c).lerp(cygnet.position, 0.35);
        s.target.y = c.y + 1.3;
        s.distance = 5.8;
        s.height = 0.2;
        s.clearance = 0.4;
        this.pace = 0.3;
        return;
      }
      case 'loop': {
        // Up out of the white over the loop, to the one place it climbs for ever from, and held there dead still.
        const e = THREE.MathUtils.smoothstep(this.now - this.loopFrom, 0, LOOP_SETTLE);
        s.eye = this.loopEye.lerpVectors(this.eyeFrom, LOOP_EYE, e);
        s.target.lerpVectors(this.lookFrom, LOOP_LOOK, e);
        s.exact = true;
        s.zoom = LOOP_ZOOM;
        this.focus.copy(LOOP_LOOK);
        this.pace = 0.25;
        return;
      }
      case 'follow':
      case 'together':
      case 'emerge': {
        if (this.revealing) {
          this.revealShot();
          return;
        }
        if (this.beat === 'emerge' && c.y - CLOUD.top > -0.6) {
          this.overTheCloud(THREE.MathUtils.smoothstep(this.t, 0.5, 8));
          return;
        }
        // In the cloud: from below and behind, the way they came, so each flight goes up and away from the lens to
        // one side or the other, the bird a few treads off and the rail between them and the white.
        s.from = this.from.set(0.12, 0, 1).normalize();
        s.target.copy(c).lerp(cygnet.position, 0.4);
        s.target.y = Math.max(c.y, cygnet.position.y) + 1.0;
        s.distance = 4.8;
        s.height = 0.5;
        s.clearance = 0.4;
        this.pace = 0.3;
        return;
      }
      case 'awe':
      case 'nest':
      case 'skein':
      case 'lean':
      case 'gather':
      case 'boarding': {
        const back = this.tmp.copy(TOP).sub(this.sun).setY(0).normalize();
        s.target.copy(SIT).lerp(SLIPPERS, 0.5);
        this.focus.copy(SIT);
        if (this.beat === 'nest') {
          this.toHerSide();
          return;
        }
        if (this.beat === 'skein') {
          this.lensWithSwans = this.withTheSwans(dt);
          if (this.lensWithSwans) return;
        }
        if (this.beat === 'awe') {
          // Settled out behind her, low enough that the sun stays in the frame while she takes it all in.
          s.from = this.from.copy(back).applyAxisAngle(THREE.Object3D.DEFAULT_UP, 0.3);
          s.target.y = TOP.y + 1.8;
          s.distance = 11;
          s.height = 1.4;
          this.pace = 0.2;
          return;
        }
        if (this.beat === 'skein') {
          // Behind them, looking up at the sky the swans are crossing, as the boat comes out.
          s.from = this.from.copy(back).applyAxisAngle(THREE.Object3D.DEFAULT_UP, 0.1);
          s.target.y = TOP.y + 2.6;
          s.distance = 10;
          s.height = -0.3;
          this.pace = 0.32;
          return;
        }
        // Their faces in the last of the sun as the boat comes alongside.
        s.from = this.from.copy(back).negate().applyAxisAngle(THREE.Object3D.DEFAULT_UP, -0.45);
        s.target.y = TOP.y + 0.75;
        s.distance = 5.2;
        s.height = 0.5;
        this.pace = 0.2;
        return;
      }
      default: {
        // Over the cloud the lens goes once round the boat, from its starboard bow across to port and astern, by how
        // far they have come; on the sea, as the white thins, back and up behind them to where the village's own
        // lens takes them.
        const S = THREE.MathUtils.smootherstep;
        const f = this.beat === 'down' ? Object.assign(this.framing, OUT_OF_THE_WHITE)
          : this.beat === 'thin' ? blend(this.framingFrom, OUT_OF_THE_WHITE, S(this.t, 1, 8), this.framing)
            : framingAt(this.sailed, this.framing);
        frameVoyage(s, f, boat.position, child.position, this.voyageYaw, this.eye);
        if (this.beat === 'sail' || this.beat === 'fog') {
          // Never into the cloud: over its tops, and round the side of a tower rather than through it.
          const cloud = this.world.cloud;
          this.eye.y = Math.max(this.eye.y, cloud.surfaceAt(this.eye.x, this.eye.z) + 1.2);
          cloud.towers.keepOut(this.eye, 4);
        }
        if ((this.beat === 'thin' && this.t > 6) || this.beat === 'down') {
          this.outSubjects.primary.copy(c).y += 1.2;
          boat.sailPoint(this.outSubjects.secondary);
          this.hullFrame[0].copy(boat.position);
          boat.hullEnds(this.hullFrame[1], this.hullFrame[2]);
          s.subjects = this.outSubjects;
        }
        this.pace = 0.5;
        this.focus.copy(boat.position);
      }
    }
  }
}
