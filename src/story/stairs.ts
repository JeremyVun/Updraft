import * as THREE from 'three';
import type { Shot } from '../camera';
import { tuning } from '../tuning';
import { roundedWaypoint } from '../traveller/navigation';
import type { Deck } from '../world/decks';
import type { StairsAir } from '../audio/stairs-air';
import { atmo } from '../world/atmosphere';
import { CloudStairs } from '../world/stairs';
import { BowLantern } from '../world/stairs-lantern';
import { LOOP_EYE, LOOP_LOOK, LOOP_ZOOM, drawIn, fromCopy, sizeOnBack, upBack } from '../world/stairs-penrose';
import {
  BELOW_CLOUD, CLOUD, CLOUD_BERTH, CLOUD_ROUTE, DESCENT_END, FOG_BANK, FLIGHTS, LOOSE, RUN_YAW, SIT, SLIPPERS, STAIRS_ARRIVAL,
  STAIRS_FOOT, STAIRS_GROUND, STEP, TOP, TOP_EDGE, TOP_OUT, LOOP, LOOP_BACK, LOOP_FAR, along, flight, landingOf, levelHeight, onLanding,
} from '../world/stairs-layout';
import type { Cast, Chapter } from './cast';
import type { CheckpointPayload } from './checkpoint-data';
import { completeObjective, cue } from './cues';
import { OUT_OF_THE_WHITE, blend, frameVoyage, framingAt, type Framing } from './stairs-sail';
import { Track } from './stairs-track';

type Beat =
  | 'ashore' | 'wonder' | 'climb' | 'waiting' | 'hesitate' | 'birdFirst' | 'follow' | 'loop' | 'together' | 'emerge'
  | 'nest' | 'skein' | 'lean' | 'gather' | 'boarding' | 'sail' | 'fog' | 'thin' | 'down';

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
}


/** How long the lens takes to rise out over the loop to the one place it has to be seen from. */
const LOOP_SETTLE = 5;

/**
 * Where the child stands aside on the last landing under the white, in its far corner, clear of the way the bird
 * goes past them and on up.
 */
const ASIDE = (() => {
  const L = landingOf(BELOW_CLOUD);
  return onLanding(L, L.openings.some(o => o.face === 'left') ? -0.42 : 0.42, 0.38);
})();

/** How high the hull rides on the top of the cloud, and on the sea. */
const RIDE = CLOUD.top + 0.45;
const SEA_RIDE = 0.4;

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
 * north far off, and the boat waiting on the cloud as if it were water. They sail into the sunset and sink through
 * the cloud onto the dusk water of the drowned village.
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
  private readonly birdAt = new THREE.Vector3();
  private readonly sun = new THREE.Vector3();
  private readonly subjects = { primary: new THREE.Vector3(), secondary: new THREE.Vector3(), tertiary: new THREE.Vector3(), margin: 0.8, extra: 10 };
  private readonly invitation = new THREE.Vector3();
  private lastPush = 0;
  /** The stop on the loop's landing where the child waits while the bird goes round, and how the bird is getting on. */
  private readonly loopStop: number;
  private looped = false;
  private lap = 0;
  private round: 'settle' | 'round' | 'puzzled' = 'settle';
  private roundT = 0;
  /** Whether it is on its way home round the loop, after it has come across onto the corner. */
  private homeward = false;
  /** The line up the stair the bird keeps to, and where on it the stops are. */
  private readonly track: Track;
  /** The bird's way round the loop: out to the top of its last flight, and home from the corner to the child. */
  private readonly roundOut: Track;
  private readonly roundHome: Track;
  private readonly sOnward: number;
  private readonly sBack: number;
  /** Where it waits for the child on the loop's first flight, on its first tread. */
  private readonly waitUp: THREE.Vector3;
  private readonly sWaitUp: number;
  private readonly waitAside: THREE.Vector3;
  private loopFrom = 0;
  private readonly eyeFrom = new THREE.Vector3();
  private readonly lookFrom = new THREE.Vector3();
  private readonly loopEye = new THREE.Vector3();
  /** While the lens is up in the white over the loop, the cloud is kept deep enough round it. */
  private lofted = false;
  private trickGone = 0;
  private stuckLeft = Infinity;
  /** How far round the loop the bird had got last frame. */
  private alongWas = 0;
  private stuckSince = 0;
  private lastDt = 0;
  /** The lantern hung at the bow for the way over the cloud, and the kite's tie-off there. */
  private readonly lantern = new BowLantern();
  private readonly bow = new THREE.Vector3();
  private readonly stern = new THREE.Vector3();
  private readonly tow = { at: new THREE.Vector3(), heading: 0 };
  private berthed = false;
  private cuts = 0;
  /** How far the boat has come over the cloud, metres. */
  private sailed = 0;
  /** How much of the bank of mist there is; it is there by the time they are aboard. */
  private mist = 0;
  /** How far into the white they are, 0 to 1, for the sound. */
  private white = 0;
  /** The way the lens reckons as ahead: the run's over the cloud, the hull's on the sea. */
  private voyageYaw = RUN_YAW;
  private readonly framing: Framing = { ...OUT_OF_THE_WHITE };
  private readonly framingFrom: Framing = { ...OUT_OF_THE_WHITE };
  private readonly eye = new THREE.Vector3();
  private readonly glowFrom = new THREE.Color();
  private readonly tmpColor = new THREE.Color();
  private readonly air: StairsAir = { phase: 'under', cloud: 0, climb: 0, open: 0, fog: 0, speed: 0 };
  private readonly oldRadius: number;

  constructor(private readonly cast: Cast) {
    const world = cast.stairs;
    this.world = world;
    const { child, plane, cygnet, boat } = cast;
    this.loopStop = this.stops.findIndex(p => p.level === LOOP.wait && Math.abs(p.x - flight(LOOP.wait).landing.x) < 0.01);
    const on = (p: THREE.Vector3, yaw: number, d: number) => p.clone().addScaledVector(along(yaw), d);
    const up = flight(LOOP.wait + 1), into = flight(LOOP.wait), far = LOOP_FAR.flight;
    const wait = landingOf(LOOP.wait);
    const onward = landingOf(LOOP.onward), corner = landingOf(LOOP.corner), farL = LOOP_FAR.landing;
    this.track = new Track(this.stops.map(p => new THREE.Vector3(p.x, levelHeight(p.level), p.z)));
    this.waitUp = on(up.bottom, up.yaw, 0.3).setY(up.bottom.y + STEP.rise);
    this.sWaitUp = this.track.project(this.waitUp);
    this.roundOut = new Track([
      this.waitUp.clone(), on(up.top, up.yaw, 0.35), onward.centre.clone(), onLanding(onward, onward.x1 - 0.2, 0),
      on(far.bottom, far.yaw, 0.2), on(far.top, far.yaw, 0.35), farL.centre.clone(), onLanding(farL, farL.x1 - 0.2, 0),
      on(LOOP_BACK.bottom, LOOP_BACK.yaw, 0.2), drawIn(LOOP_BACK.top.clone()), drawIn(on(LOOP_BACK.top, LOOP_BACK.yaw, 0.8)),
    ]);
    this.sOnward = this.roundOut.project(onward.centre);
    this.sBack = this.roundOut.project(LOOP_BACK.bottom);
    this.roundHome = new Track([
      onLanding(corner, corner.x1 - 0.15, 0), corner.centre.clone(), on(into.bottom, into.yaw, 0.25),
      on(into.top, into.yaw, 0.3), onLanding(wait, 0, -0.45),
    ]);
    this.waitAside = onLanding(wait, -0.42, 0.38);
    world.onDocked = (index) => this.docked(index);
    world.ghostShown = 0;
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
    child.dismount();
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
    return ['hesitate', 'birdFirst', 'nest', 'skein', 'lean', 'gather', 'boarding'].includes(this.beat);
  }

  get departureKite(): boolean {
    return ['emerge', 'nest', 'skein', 'lean', 'gather', 'boarding', 'sail', 'fog'].includes(this.beat);
  }

  get invitesSail(): boolean {
    return this.beat === 'sail' && this.cast.boat.speed < 0.6;
  }

  /** A slow sweep drawn across the loose flight when the stair has been waiting on it a while. */
  get windInvitation(): THREE.Vector3 | null {
    // Round the loop a second time and the cloud on its far corner is still there: a sweep across it.
    if (this.beat === 'loop') return this.lap >= 2 && !this.world.bank.cleared ? this.world.bank.centre : null;
    if (this.beat !== 'waiting' || this.now - this.lastPush < 6) return null;
    const piece = this.world.waiting;
    if (!piece) return null;
    return this.world.pointOn(piece, this.tmp2.lerpVectors(piece.flight.bottom, piece.flight.landing, 0.5), this.invitation);
  }

  /** Above the cloud the pointer lands on its top, so a gust meant for the sail reaches the sail. */
  get pointerFloor(): number | null {
    return this.cast.child.position.y > CLOUD.top - 0.5 || this.beat === 'sail' ? CLOUD.top : null;
  }

  /** From the moment they are out on top, the kite is tied to the bow of the boat waiting on the cloud. */
  get kiteTow(): { at: THREE.Vector3; heading: number } | null {
    if (!this.berthed || this.beat === 'thin' || this.beat === 'down') return null;
    this.cast.boat.hullEnds(this.bow, this.stern);
    this.tow.at.copy(this.bow).y += 0.3;
    this.tow.heading = this.cast.boat.yaw;
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
    switch (this.beat) {
      case 'wonder':
        // Out of the satchel and down onto the grass: this room it climbs on its own feet. Then both of them look
        // up the stair to where it goes into the cloud.
        c.lookAt = this.look.set(STAIRS_FOOT.x, CLOUD.base - 3, STAIRS_FOOT.z - 12);
        if (this.t > 0.8 && k.carried && !carry.busy) {
          const down = () => carry.setDown(() => {
            k.stay = true;
            this.beatStart = this.now;
          });
          if (k.seat === 'satchel') carry.unstow(down);
          else down();
        }
        if (!k.carried && !carry.busy) k.watch(this.look);
        if (this.t > 2.6 && !carry.busy && !c.busy && !k.carried && k.seat === null) {
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
        this.walkOn();
        if (c.position.y > CLOUD.top + 0.6 && !c.moving) this.nest();
        break;
      case 'nest':
        c.lookAt = this.sun;
        if (c.sitting) c.faceToward(this.sun.x, this.sun.z, 1 - Math.exp(-dt * 3));
        if (!k.stay && Math.hypot(k.position.x - this.birdAt.x, k.position.z - this.birdAt.z) < 0.35) {
          k.stay = true;
          k.errand = null;
        }
        if (this.t > 5 && !this.skeinSent) this.sendSkein();
        if (this.skeinSent && this.t > 4) this.to('skein');
        break;
      case 'skein':
        if (c.sitting) c.faceToward(this.sun.x, this.sun.z, 1 - Math.exp(-dt * 3));
        c.lookAt = this.cast.flock.active ? this.cast.flock.head : this.sun;
        k.watch(this.cast.flock.active ? this.cast.flock.head : null);
        if (this.t > 16 || (!this.cast.flock.active && this.t > 6)) {
          k.watch(null);
          this.to('lean');
        }
        break;
      case 'lean':
        c.lookAt = k.position;
        if (this.t > 2.5 && !carry.busy) this.gather();
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
    this.cloud();
    this.mistBank(dt);
    this.loopScenery(dt);
    this.lanternGlow();
    this.measureAir(dt);
    this.frame();
  }

  /**
   * The loop's trick is drawn only while the lens is at the one place it works from, and after, until they are well
   * on up past it; the heap of cloud sits on its far corner from the time they come up into the loop.
   */
  private loopScenery(dt: number): void {
    const e = this.beat === 'loop' ? THREE.MathUtils.smoothstep(this.now - this.loopFrom, LOOP_SETTLE * 0.7, LOOP_SETTLE) : 0;
    if (this.looped && this.beat !== 'loop' && this.stop > this.loopStop + 4) this.trickGone = Math.min(1, this.trickGone + dt / 2);
    this.world.trickShown = this.beat === 'loop' ? e : this.looped ? 1 - this.trickGone : 0;
    this.world.bank.amount = this.cast.child.position.y > levelHeight(LOOP.corner - 1) - 1 ? 1 : 0;
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
    const top = ['nest', 'skein', 'lean', 'gather', 'boarding'].includes(this.beat);
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
    // Onto the loop's landing, and straight across to its far corner, out of the bird's way.
    if (this.beat === 'follow' && this.stop === this.loopStop - 1 && !this.looped) {
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
    const spot = (i: number) => (!this.looped && i === this.loopStop ? this.sWaitUp : this.track.to(i));
    let left = this.track.lead(k.position, spot(this.birdStop), this.birdAt);
    const reached = left < 0.5;
    if (reached) this.birdReached = Math.max(this.birdReached, this.birdStop);
    if (reached && this.birdStop < Math.min(this.stop + 2, last)) left = this.track.lead(k.position, spot(++this.birdStop), this.birdAt);
    const waiting = left < 0.5 && (this.birdStop >= this.stop + 2 || this.birdStop === last);
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
    this.stop = this.loopStop;
    c.walkTo(this.waitAside.x, this.waitAside.z, false, undefined, 0.12);
    this.to('loop');
  }

  /**
   * Halfway up the white the stair goes round a square, and seen from the one place the lens rises to, it climbs for
   * ever. The bird runs up it, round, up and up, and comes up the flight below behind the child, where it started.
   * It looks up the way it went, and down the way it came, and asks. And again. A heap of cloud sits on the far
   * corner; when the player's wind blows it off, there is a flight going on up from there that nobody could see, and
   * the bird takes it next time round, and the lens comes down after them, and the square comes apart.
   */
  private goRound(): void {
    const { cygnet: k, child: c } = this.cast;
    const bank = this.world.bank;
    const dt = this.now - this.roundT;
    c.lookAt = k.position;
    bank.yielding = this.lap >= 1;
    const way = this.homeward ? this.roundHome : this.roundOut;
    k.scale = this.round === 'round' && !this.homeward && way.project(k.position) > this.sBack ? sizeOnBack(k.position) : 1;
    switch (this.round) {
      case 'settle': {
        const left = this.track.lead(k.position, this.sWaitUp, this.birdAt);
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
            this.birdStop = this.loopStop + 2;
            this.birdReached = this.birdStop;
            this.limit = this.reachable();
            this.to('follow');
            break;
          }
          // Past the top of the drawn-in flight it is on the copy of the corner: it goes across at once onto the
          // corner itself, which from here is the same place.
          if (upBack(k.position) > 1) {
            fromCopy(k.position, this.tmp);
            k.scale = 1;
            k.standAt(this.tmp.x, this.tmp.y, this.tmp.z, k.yaw);
            // Should it ever come down short of the corner, it is on the corner all the same.
            if (k.position.y < this.tmp.y - 0.3) {
              onLanding(landingOf(LOOP.corner), 0.7, 0, this.tmp);
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
        // It came up behind them. It looks up the way it went, and down the way it came, and asks.
        const again = this.lap > 0;
        if (dt > 0.5 && this.lastDt <= 0.5) { cue('puzzled'); k.call(false); }
        if (dt > 1.6 && this.lastDt <= 1.6) k.does('look-back', this.look.copy(flight(LOOP.wait + 1).top), 1.6);
        if (again && dt > 2.2 && this.lastDt <= 2.2) { cue('puzzled'); k.call(false); }
        if (again && dt > 3.0 && this.lastDt <= 3.0) k.does('shake', undefined, 0.9);
        if (dt > (again ? 4.6 : 3.4)) {
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
    const { child: c, cygnet: k } = this.cast;
    if (k.carried || this.stop < 2 || !['climb', 'waiting', 'hesitate', 'birdFirst', 'follow', 'loop', 'together', 'emerge'].includes(this.beat)) return;
    if (k.position.y > c.position.y - 3) return;
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
    const there = this.track.lead(k.position, this.track.to(this.birdStop), this.birdAt) < 0.5;
    k.stay = there;
    k.errand = there ? null : this.birdAt;
  }


  private nest(): void {
    const { child: c, cygnet: k } = this.cast;
    this.to('nest');
    k.decks = this.decks();
    k.errand = this.birdAt.set(SLIPPERS.x, 0, SLIPPERS.z - 0.05);
    k.stay = false;
    c.walkTo(SIT.x - TOP_OUT.x * 0.3, SIT.z - TOP_OUT.z * 0.3, false, () => {
      c.walkTo(SIT.x, SIT.z, false, () => {
        c.faceToward(this.sun.x, this.sun.z, 1);
        c.sitDown();
      }, 0.12);
    }, 0.2);
  }

  /** Far off, across the sun, a skein of swans goes north over the cloud. */
  private sendSkein(): void {
    this.skeinSent = true;
    const toward = this.tmp.copy(this.sun).sub(TOP).setY(0).normalize();
    const x = TOP.x + toward.x * 170, z = TOP.z + toward.z * 170;
    // Across the line of sight, and north: they are going on without it.
    const bearing = Math.atan2(-toward.z, toward.x);
    this.cast.flock.pass(x, z, CLOUD.top + 34, bearing, 9, 140, false);
    const k = this.cast.cygnet;
    k.stay = true;
    k.errand = null;
  }

  private gather(): void {
    const { child: c, cygnet: k, carry, boat } = this.cast;
    this.to('gather');
    c.standUp();
    k.stay = false;
    k.watch(null);
    carry.gatherUp(() => {
      boat.mooring = CLOUD_BERTH;
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
          boat.becalmed = 0.85;
          boat.speedLimit = tuning.sail.topSpeed * 0.7;
          this.leg = 0;
          boat.steerFor = CLOUD_ROUTE[0];
          this.to('sail');
        });
      }, 0.25);
    });
  }

  /**
   * The boat has been waiting on the cloud all along, under the kite: it is made fast there while nobody can see,
   * so it is simply there when they come out on top. The lantern is already lit.
   */
  private berthOnCloud(): void {
    const { boat } = this.cast;
    this.berthed = true;
    // A little way off the landing to begin with, under the kite; it comes alongside when they are ready.
    const way = along(CLOUD_BERTH.yaw);
    const wait = { x: CLOUD_BERTH.x + TOP_OUT.x * 4 + way.x * 3, z: CLOUD_BERTH.z + TOP_OUT.z * 4 + way.z * 3, yaw: CLOUD_BERTH.yaw };
    boat.position.set(wait.x, RIDE, wait.z);
    boat.yaw = wait.yaw;
    boat.altitude = RIDE;
    boat.afloat = true;
    boat.grounded = false;
    boat.speed = 0;
    boat.mooring = wait;
    this.lantern.body.position.set(0, 0.28, 2.0);
    boat.group.add(this.lantern.body);
    this.world.group.add(this.lantern.glow);
    this.lantern.brightness = 1;
  }

  /** The halo sits on the flame while the lantern is aboard, and where the bow is after it has gone. */
  private lanternGlow(): void {
    if (!this.berthed || !this.lantern.glow.parent) return;
    const { boat } = this.cast;
    if (this.lantern.body.parent) {
      boat.group.updateMatrixWorld(true);
      this.lantern.glow.position.copy(BowLantern.FLAME).applyMatrix4(this.lantern.body.matrixWorld);
    } else {
      boat.hullEnds(this.bow, this.stern);
      this.lantern.glow.position.copy(this.bow).y += 0.5;
    }
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

  private sail(dt: number): void {
    const { boat, child: c } = this.cast;
    c.ride(boat.seat(this.tmp), boat.yaw, boat.roll, boat.pitch);
    boat.altitude = RIDE;
    boat.speedLimit = tuning.stairs.sailSpeed;
    if (boat.speed > 1.5) boat.becalmed = Math.max(0, boat.becalmed - 0.01);
    this.world.sailing(boat, dt);
    this.sailed += boat.speed * dt;
    this.steer();
    if (this.world.cloud.fog.depthOf(boat.position.x, boat.position.z) > 0) this.to('fog');
  }

  /**
   * Into the bank of mist, level: the bow and the lantern go into the white first, then the child. Far enough in
   * there is nothing but the white and the lantern, and the hull is let down onto the sea, which nobody can see.
   */
  private fog(dt: number): void {
    const { boat, child: c } = this.cast;
    const k = tuning.stairs;
    const depth = this.world.cloud.fog.depthOf(boat.position.x, boat.position.z);
    boat.altitude = RIDE;
    boat.speedLimit = THREE.MathUtils.lerp(k.sailSpeed, k.fogSpeed, THREE.MathUtils.smoothstep(depth, 0, 20));
    boat.becalmed = 0;
    // The white carries them on; nobody is left waiting in it.
    boat.speed = Math.max(boat.speed, 1.6);
    this.world.sailing(boat, dt);
    this.sailed += boat.speed * dt;
    this.steer();
    if (depth > k.bankSwap) this.downOntoTheSea();
    c.ride(boat.seat(this.tmp), boat.yaw, boat.roll, boat.pitch);
  }

  /**
   * In the white the hull is let down onto the sea where the drowned village begins, as far short of it as the
   * white takes to thin, on the heading it had; the bank of mist, the streaming cloud and the camera go with it.
   */
  private downOntoTheSea(): void {
    const { boat } = this.cast;
    const fog = this.world.cloud.fog;
    const short = tuning.stairs.fogLift * 3;
    const x = DESCENT_END.x - Math.sin(boat.yaw) * short, z = DESCENT_END.y - Math.cos(boat.yaw) * short;
    const dx = x - boat.position.x, dy = SEA_RIDE - boat.position.y, dz = z - boat.position.z;
    boat.position.set(x, SEA_RIDE, z);
    boat.altitude = null;
    fog.at.x += dx;
    fog.at.y += dz;
    this.world.wisps.shift(dx, dy, dz);
    this.world.cloud.wake.shift(dx, dy, dz);
    this.world.sailing(null, 0);
    boat.steerFor = DESCENT_END;
    boat.group.remove(this.lantern.body);
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
    c.ride(boat.seat(this.tmp), boat.yaw, boat.roll, boat.pitch);
    boat.speedLimit = 3;
    boat.speed = Math.max(boat.speed, 1.6);
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
    // The white up there: the low sun through it, and the sky.
    fog.light.copy(u.uSunColor.value).multiplyScalar(0.3).add(this.glowFrom.copy(u.uSkyAmbient.value).multiplyScalar(1.2))
      .add(this.tmpColor.copy(u.uSkyHorizon.value).multiplyScalar(0.3));
    fog.glow = 1;
    if (this.beat !== 'thin') {
      fog.face(FOG_BANK.x, FOG_BANK.z, FOG_BANK.yaw);
      fog.floor = CLOUD.top - 0.3;
      fog.top = CLOUD.top + k.bankHeight;
      fog.deep = 1e4;
      fog.amount = this.mist;
      const depth = fog.depthOf(boat.position.x, boat.position.z);
      this.white = S(depth, -6, k.bankSwap);
      fog.clear = 0.85 - 0.35 * S(depth, k.bankSwap - 12, k.bankSwap);
      return;
    }
    // On the sea: the same bank over the water, which the boat sails out of the back of as the white thins.
    const t = this.t, lift = k.fogLift;
    fog.floor = SEA_RIDE - (RIDE - CLOUD.top + 0.3);
    fog.top = fog.floor + k.bankHeight;
    // Its back comes to meet them, and goes by: the white ahead thins, and they are out of it.
    fog.deep = fog.depthOf(boat.position.x, boat.position.z) + THREE.MathUtils.lerp(500, -8, S(t, 1, lift * 0.75));
    fog.amount = 1 - S(t, lift * 0.6, lift);
    fog.clear = 0.5 + 0.35 * S(t, 0, 2.5);
    this.white = 1 - S(t, 2, lift * 0.8);
    // From the gold of the cloud to the grey and blue of the dusk over the sea, and the sun going out of it.
    const dusk = this.glowFrom.copy(u.uSkyAmbient.value).multiplyScalar(1.3).add(this.tmpColor.copy(u.uSkyHorizon.value).multiplyScalar(0.5))
      .add(this.tmpColor.copy(u.uSunColor.value).multiplyScalar(0.05));
    fog.light.lerp(dusk, S(t, 1.2, lift * 0.55));
    fog.glow = 1 - 0.6 * S(t, 1.2, lift * 0.55);
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
  private cloud(): void {
    const { child: c, boat } = this.cast;
    const d = this.cloudDeck;
    const k = tuning.stairs;
    const S = THREE.MathUtils.smoothstep;
    d.amount = 1;
    d.top = CLOUD.top;
    d.clearing = undefined;
    // Down on the sea the deck is put out of the way under it at once, in the white, so no ceiling hangs over the village.
    d.snap = this.beat === 'thin' || this.beat === 'down';
    const wisps = this.world.wisps;
    if (this.beat === 'fog' || this.beat === 'thin' || this.beat === 'down') {
      const sea = this.beat !== 'fog';
      d.base = sea ? -60 : CLOUD.base;
      d.top = sea ? -50 : CLOUD.top;
      this.world.cloudHole = false;
      // The pocket of clearer air in the white takes in the boat and the lens behind it.
      const hull = boat.position;
      const mid = this.tmp2.copy(hull).lerp(this.eye, 0.45);
      d.bubble.set(mid.x, hull.y + 1.8, mid.z, 0.55 * this.framing.distance + 3);
      // The white streams past them level, the way they are going.
      wisps.amount = this.white;
      wisps.centre.set(hull.x, hull.y + 1.5, hull.z);
      wisps.wind.set(-Math.sin(boat.yaw), 0, -Math.cos(boat.yaw)).multiplyScalar(boat.speed + 2.5);
      this.breeze = 0.35;
      return;
    }
    d.base = CLOUD.base;
    const climb = this.air.climb;
    const inCloud = c.position.y > CLOUD.base - 3 && c.position.y < CLOUD.top - 0.3;
    d.bubble.set(c.position.x, c.position.y + 1.1, c.position.z, inCloud ? THREE.MathUtils.lerp(k.bubble, k.bubbleTop, climb) : 0);
    if (inCloud) d.clearing = THREE.MathUtils.lerp(k.clearing, k.clearingTop, climb);
    // Over the loop the clear air opens out into a hollow in the white big enough for the lens and the whole
    // square; the cloud is made deep enough overhead that the lens, up there, is still in it. It stays open while
    // the lens comes down after them, so the square is seen to come apart, and closes in once the lens is down.
    if (this.beat === 'loop' || this.lofted) {
      // The pocket's clear heart reaches from the lens to just past the loop; beyond that it thickens to white, and
      // the cloud goes on down under the loop far enough that nothing shows through from below.
      const heart = LOOP_EYE.distanceTo(LOOP_LOOK) / 2 + 1.5;
      d.bubble.set((LOOP_EYE.x + LOOP_LOOK.x) / 2, (LOOP_EYE.y + LOOP_LOOK.y) / 2, (LOOP_EYE.z + LOOP_LOOK.z) / 2, heart / 0.6);
      d.clearing = 0.006;
      d.base = LOOP_LOOK.y - 14;
    }
    if (this.lofted && this.beat !== 'loop' && this.world.eye.y < CLOUD.top - 1.5) this.lofted = false;
    if (this.lofted) d.top = LOOP_EYE.y + 6;
    this.world.hideTop = this.lofted;
    const white = ['hesitate', 'birdFirst', 'follow', 'loop', 'together', 'emerge'].includes(this.beat);
    wisps.amount = (white ? S(c.position.y + 1.2, CLOUD.base - 2, CLOUD.base + 0.8) * (1 - S(c.position.y, CLOUD.top - 0.8, CLOUD.top + 0.6)) : 0)
      * (this.beat === 'loop' ? 0.35 : 1);
    wisps.centre.set(c.position.x, c.position.y + 1, c.position.z);
    // Across both the side view up the stair and the view along it on the ring's landing.
    wisps.wind.set(0.7, 0.12, -0.7).normalize().multiplyScalar(k.windInCloud * (0.45 + 0.55 * climb));
    // The wind in the white rises as they climb; on top it has gone.
    const out = this.air.open;
    this.breeze = white ? THREE.MathUtils.lerp(0.35, 1.3, climb) * (1 - out) + 0.12 * out : this.air.open > 0.5 ? 0.12 : 0.35;
  }

  private frame(): void {
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
        // From the south, low: the child small on the grass, the stair going up and away from them into the cloud,
        // the sun going down on the left.
        s.from = this.from.set(0.206, 0, 0.979);
        s.target.set(STAIRS_FOOT.x + 2, CLOUD.base - 7.5, STAIRS_FOOT.z - 17);
        s.distance = 38.8;
        s.height = -7;
        this.pace = 0.3;
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
        // From outside the rail, a little ahead: their face turned up at where the stair goes into the white.
        s.from = this.from.set(-0.3, 0, -1).normalize();
        s.target.copy(c).lerp(cygnet.position, 0.45);
        s.target.y = c.y + 1.5;
        s.distance = 4.6;
        s.height = -0.25;
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
        const head = c.y - CLOUD.top;
        if (this.beat === 'emerge' && head > -0.6) {
          // Out of the white: from behind them, rising and drawing back as the cloud opens out to the sun.
          const back = this.tmp.copy(TOP).sub(this.sun).setY(0).normalize();
          const open = THREE.MathUtils.smoothstep(this.t, 0.5, 8);
          s.from = this.from.copy(back).applyAxisAngle(THREE.Object3D.DEFAULT_UP, 0.25 * (1 - open));
          s.target.copy(c).addScaledVector(back, -2.5 * open);
          s.target.y = TOP.y + 1.3 + open * 0.8;
          s.distance = THREE.MathUtils.lerp(4, 12, open);
          s.height = THREE.MathUtils.lerp(0.5, 3.6, open);
          s.clearance = 0.4;
          this.pace = 0.16;
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
      case 'nest':
      case 'skein':
      case 'lean':
      case 'gather':
      case 'boarding': {
        // First their faces in the last of the sun, the cloud behind them; then, turned round, what they are watching.
        const back = this.tmp.copy(TOP).sub(this.sun).setY(0).normalize();
        // The lens comes round behind them while the swans are still on their way in.
        const skein = this.beat === 'skein' || this.beat === 'nest';
        if (skein) s.from = this.from.copy(back).applyAxisAngle(THREE.Object3D.DEFAULT_UP, this.beat === 'nest' ? 0.55 : 0.1);
        else s.from = this.from.copy(back).negate().applyAxisAngle(THREE.Object3D.DEFAULT_UP, -0.45);
        s.target.copy(SIT).lerp(SLIPPERS, 0.5);
        const settling = this.beat === 'nest';
        s.target.y = TOP.y + (settling ? 1.6 : skein ? 2.6 : 0.75);
        s.distance = settling ? 11 : skein ? 10 : 5.2;
        s.height = settling ? 2.4 : skein ? -0.3 : 0.5;
        this.focus.copy(SIT);
        this.pace = skein ? 0.32 : 0.2;
        return;
      }
      default: {
        // Over the cloud the lens goes once round the boat on the port side, by how far they have come; on the sea,
        // as the white thins, back and up behind them to where the village's own lens takes them.
        const S = THREE.MathUtils.smootherstep;
        const f = this.beat === 'down' ? blend(OUT_OF_THE_WHITE, OUT_OF_THE_WHITE, 0, this.framing)
          : this.beat === 'thin' ? blend(this.framingFrom, OUT_OF_THE_WHITE, S(this.t, 2.5, tuning.stairs.fogLift), this.framing)
            : framingAt(this.sailed, this.framing);
        frameVoyage(s, f, boat.position, child.position, this.voyageYaw, this.eye);
        this.pace = 0.5;
        this.focus.copy(boat.position);
      }
    }
  }
}
