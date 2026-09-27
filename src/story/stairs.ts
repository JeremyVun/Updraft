import * as THREE from 'three';
import type { Shot } from '../camera';
import { tuning } from '../tuning';
import { roundedWaypoint } from '../traveller/navigation';
import type { Deck } from '../world/decks';
import type { StairsAir } from '../audio/stairs-air';
import { atmo } from '../world/atmosphere';
import { CloudStairs } from '../world/stairs';
import { BowLantern } from '../world/stairs-lantern';
import {
  BELOW_CLOUD, CLOUD, CLOUD_BERTH, CLOUD_ROUTE, DESCENT_END, FOG_FROM, FLIGHTS, LOOSE, SIT, SLIPPERS, STAIRS_ARRIVAL,
  STAIRS_FOOT, STAIRS_GROUND, STEP, TOP, TOP_EDGE, TOP_OUT, along, flight, landingOf, levelHeight, onLanding,
} from '../world/stairs-layout';
import type { Cast, Chapter } from './cast';
import type { CheckpointPayload } from './checkpoint-data';
import { completeObjective, cue } from './cues';

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


/** The landing in the white where the stair goes round in a ring: up the next flight and back up the one below. */
const RING_LEVEL = BELOW_CLOUD + 3;

/**
 * Where the child stands aside on the last landing under the white, in its far corner, clear of the way the bird
 * goes past them and on up.
 */
const ASIDE = (() => {
  const L = landingOf(BELOW_CLOUD);
  return onLanding(L, -0.42 * L.exit, 0.38);
})();

/** How high the hull rides on the top of the cloud. */
const RIDE = CLOUD.top + 0.45;

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
  private birdLeg = 0;
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
  /** The stop on the ring's landing where the child waits while the bird goes round, and how the bird is getting on. */
  private readonly ringStop: number;
  private ringed = false;
  private lap = 0;
  private ring: 'up' | 'hidden' | 'back' | 'puzzled' = 'up';
  private ringT = 0;
  private ringLeg = 0;
  private readonly ringAt = new THREE.Vector3();
  private lastDt = 0;
  /** The lantern hung at the bow for the way over the cloud, and the kite's tie-off there. */
  private readonly lantern = new BowLantern();
  private readonly bow = new THREE.Vector3();
  private readonly stern = new THREE.Vector3();
  private readonly tow = { at: new THREE.Vector3(), heading: 0 };
  private berthed = false;
  private cuts = 0;
  /** How far the cloud has swelled up round the boat on the way down, 0 to 1. */
  private swell = 0;
  private readonly air: StairsAir = { phase: 'under', cloud: 0, climb: 0, open: 0, fog: 0, speed: 0 };
  private readonly oldRadius: number;

  constructor(private readonly cast: Cast) {
    const world = cast.stairs;
    this.world = world;
    const { child, plane, cygnet, boat } = cast;
    this.ringStop = this.stops.findIndex(p => p.level === RING_LEVEL && Math.abs(p.x - flight(RING_LEVEL).landing.x) < 0.01);
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
    child.place(s.x, s.z, Math.PI);
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
        if (this.t > 0.8 && k.seat === 'satchel' && !carry.busy) carry.unstow(() => carry.setDown(() => {
          k.stay = true;
          this.beatStart = this.now;
        }));
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
        if (!c.moving) c.lean = -0.06;
        this.birdBehind();
        k.watch(this.look);
        if (this.t > 3.4 && !c.moving) {
          c.lean = 0;
          k.watch(null);
          this.birdLeg = 0;
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
    this.cloud();
    this.lanternGlow();
    this.measureAir(dt);
    this.frame();
  }

  private measureAir(dt: number): void {
    const { child, boat } = this.cast;
    const a = this.air;
    const afloat = ['sail', 'fog', 'thin', 'down'].includes(this.beat);
    const y = afloat ? RIDE : child.position.y;
    const S = THREE.MathUtils.smoothstep;
    a.climb = THREE.MathUtils.clamp((y - CLOUD.base) / (CLOUD.top - CLOUD.base), 0, 1);
    // Up to white in the cloud bank, and thinning again over the village's water.
    a.fog = this.beat === 'fog' ? this.swell : this.beat === 'thin' ? 1 - 0.8 * S(this.t, 2.2, tuning.stairs.fogLift) : 0;
    a.cloud = afloat ? a.fog : S(y, CLOUD.base - 1.5, CLOUD.base + 1.5) * (1 - S(y, CLOUD.top - 1.2, CLOUD.top + 0.4));
    const top = ['nest', 'skein', 'lean', 'gather', 'boarding'].includes(this.beat);
    const out = afloat || top || (y > CLOUD.top - 0.4 && this.beat === 'emerge');
    a.open += ((out ? 1 - a.fog : 0) - a.open) * (1 - Math.exp(-dt * 0.8));
    a.speed = afloat ? boat.speed : 0;
    a.phase = this.beat === 'down' ? 'down' : this.beat === 'fog' || this.beat === 'thin' ? 'fog' : this.beat === 'sail' ? 'sail'
      : out ? 'above' : a.cloud > 0.5 || ['hesitate', 'birdFirst', 'follow', 'loop', 'together', 'emerge'].includes(this.beat) ? 'cloud' : 'under';
  }

  /** Up the stair, stop by stop, as far as it goes. */
  private walkOn(): void {
    const { child: c } = this.cast;
    if (c.moving || c.busy) return;
    // In the cloud the bird goes first, and the child goes only as far as it has.
    if (this.beat === 'follow' && this.stop + 1 > this.birdReached && this.stop + 1 < this.stops.length - 1) return;
    if (this.beat === 'follow' && this.stop === this.ringStop && !this.ringed) {
      this.goRoundFirst();
      return;
    }
    if (this.stop >= this.limit) {
      if (this.world.waiting) { this.to('waiting'); return; }
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
    // Across the landing to where the walk turns up into the white, then up it.
    const turn = this.stops[this.limit];
    const up = this.birdLeg === 0 ? this.birdAt.set(turn.x, 0, turn.z)
      : this.birdAt.copy(f.bottom).addScaledVector(along(f.yaw), STEP.going * 7).setY(0);
    c.lookAt = k.position;
    // It drops an errand within 0.45 of the spot, so arriving is measured just outside that.
    const there = Math.hypot(k.position.x - up.x, k.position.z - up.z) < 0.55;
    if (this.birdLeg === 0 && there) {
      this.birdLeg = 1;
      return;
    }
    if (!k.stay && !there && this.t < 14) {
      k.errand = up;
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

  /** In the cloud it keeps a few treads ahead, stop by stop, and waits on each landing until they come. */
  private birdAhead(): void {
    const { cygnet: k, child: c } = this.cast;
    c.lookAt = k.position;
    if (this.birdStop < this.stop) this.birdStop = this.stop;
    const at = this.stops[this.birdStop];
    const reached = Math.hypot(k.position.x - at.x, k.position.z - at.z) < 0.55;
    if (reached) this.birdReached = Math.max(this.birdReached, this.birdStop);
    if (reached && this.birdStop < Math.min(this.stop + 2, this.stops.length - 1)) this.birdStop++;
    const want = this.stops[this.birdStop];
    const waiting = reached && this.birdStop >= this.stop + 2;
    k.stay = waiting;
    k.errand = waiting ? null : this.birdAt.set(want.x, 0, want.z);
  }

  private goRoundFirst(): void {
    this.ringed = true;
    this.lap = 0;
    this.ring = 'up';
    this.ringLeg = 0;
    this.ringT = 0;
    this.to('loop');
  }

  /**
   * Halfway up the white the stair goes round in a ring. The bird runs on up the next flight into the cloud and
   * comes back up the flight below, behind the child. It stops, looks up, looks down, and asks. Twice. Then the
   * child goes first, and it comes along at their heel, and this time the stair goes on up.
   */
  private goRound(): void {
    const { cygnet: k, child: c } = this.cast;
    const dt = this.now - this.ringT;
    const up = [this.stops[this.ringStop + 1], this.stops[this.ringStop + 2], this.stops[this.ringStop + 3]];
    const below = flight(RING_LEVEL);
    const back = [this.stops[this.ringStop - 2], { x: (below.top.x + c.position.x) / 2, z: this.stops[this.ringStop].z + 0.25 }];
    const at = (p: { x: number; z: number }) => Math.hypot(k.position.x - p.x, k.position.z - p.z) < 0.55;
    c.lookAt = this.ring === 'hidden' ? this.look.copy(flight(RING_LEVEL + 1).top).setY(flight(RING_LEVEL + 1).top.y + 0.6) : k.position;
    switch (this.ring) {
      case 'up': {
        k.stay = false;
        k.pace = 1.35;
        const to = up[this.ringLeg];
        k.errand = this.birdAt.set(to.x, 0, to.z);
        if (!at(to)) break;
        // The white closes round it at the top of the flight.
        if (this.ringLeg === 0) this.world.wisps.engulf(this.ringAt.set(up[1].x, levelHeight(RING_LEVEL + 1) + 0.3, up[1].z), 2.2);
        if (++this.ringLeg >= 2) {
          this.ring = 'hidden';
          this.ringT = this.now;
        }
        break;
      }
      case 'hidden': {
        k.stay = true;
        k.errand = null;
        const from = this.ringAt.copy(below.bottom).addScaledVector(along(below.yaw), 0.5).setY(levelHeight(RING_LEVEL - 1));
        if (dt > 0.9 && dt - this.lastDt <= 0.9) this.world.wisps.engulf(this.tmp.copy(from).setY(from.y + 0.3), 2.4);
        if (dt > 1.4) {
          k.standAt(from.x, from.y, from.z, below.yaw);
          this.ring = 'back';
          this.ringLeg = 0;
          this.ringT = this.now;
        }
        break;
      }
      case 'back': {
        k.stay = false;
        k.pace = 1.2;
        const to = back[this.ringLeg];
        k.errand = this.birdAt.set(to.x, 0, to.z);
        if (at(to) && ++this.ringLeg >= back.length) {
          this.ring = 'puzzled';
          this.ringT = this.now;
          k.errand = null;
          k.stay = true;
          k.does('look-about', undefined, 2);
        }
        break;
      }
      case 'puzzled': {
        // It came up behind them. It looks up the way it went, and down the way it came, and asks.
        const second = this.lap > 0;
        if (dt > 0.5 && this.lastDt <= 0.5) { cue('puzzled'); k.call(false); }
        if (dt > 1.6 && this.lastDt <= 1.6) k.does('look-back', this.look.copy(flight(RING_LEVEL + 1).top), 1.6);
        if (second && dt > 2.2 && this.lastDt <= 2.2) { cue('puzzled'); k.call(false); }
        if (second && dt > 3.0 && this.lastDt <= 3.0) k.does('shake', undefined, 0.9);
        if (dt > (second ? 4.6 : 3.4)) {
          if (++this.lap < 2) {
            this.ring = 'up';
            this.ringLeg = 0;
          } else {
            // The child goes first now, and the bird keeps close.
            k.pace = 1;
            this.limit = this.reachable();
            this.birdStop = this.ringStop;
            this.to('together');
          }
        }
        break;
      }
    }
    this.lastDt = dt;
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
    const want = this.stops[this.birdStop];
    const there = Math.hypot(k.position.x - want.x, k.position.z - want.z) < 0.55;
    k.stay = there;
    k.errand = there ? null : this.birdAt.set(want.x, 0, want.z);
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

  private sail(dt: number): void {
    const { boat, child: c } = this.cast;
    c.ride(boat.seat(this.tmp), boat.yaw, boat.roll, boat.pitch);
    boat.altitude = RIDE;
    boat.speedLimit = tuning.stairs.sailSpeed;
    if (boat.speed > 1.5) boat.becalmed = Math.max(0, boat.becalmed - 0.01);
    this.world.sailing(boat, dt);
    const from = this.leg === 0 ? this.berth : CLOUD_ROUTE[this.leg - 1];
    const wp = CLOUD_ROUTE[this.leg];
    if (roundedWaypoint(boat.position.x, boat.position.z, from.x, from.y, wp.x, wp.y, 9)) {
      this.leg++;
      if (this.leg >= CLOUD_ROUTE.length) {
        boat.steerFor = DESCENT_END;
        return;
      }
      boat.steerFor = CLOUD_ROUTE[this.leg];
    }
    if (this.leg >= FOG_FROM) this.to('fog');
  }

  /**
   * Into the cloud bank. They sail on level and the cloud swells up round the hull and over them, until there is
   * nothing but white and the lantern. In the white the hull is let down onto the sea, which nobody can see, and
   * the camera goes with it at once.
   */
  private fog(dt: number): void {
    const { boat, child: c } = this.cast;
    c.ride(boat.seat(this.tmp), boat.yaw, boat.roll, boat.pitch);
    boat.speedLimit = Math.min(tuning.stairs.sailSpeed, 3.4);
    boat.becalmed = 0;
    this.swell = THREE.MathUtils.smoothstep(this.t, 0, tuning.stairs.fogRise);
    if (boat.altitude !== null) {
      boat.altitude = RIDE;
      this.world.sailing(boat, dt);
    }
    const wp = CLOUD_ROUTE[CLOUD_ROUTE.length - 1];
    if (Math.hypot(boat.position.x - wp.x, boat.position.z - wp.y) < 9) boat.steerFor = DESCENT_END;
    if (this.t > tuning.stairs.fogRise + 1.2) {
      boat.altitude = null;
      // Down on the water this very frame, so the camera cut lands behind the boat where it now is.
      boat.position.y = 0.4;
      boat.group.remove(this.lantern.body);
      this.world.sailing(null, dt);
      this.cuts++;
      this.to('thin');
    }
  }

  /** Still in the white, but it is grey now and going blue, and water is moving under the hull. */
  private thin(_dt: number): void {
    const { boat, child: c } = this.cast;
    c.ride(boat.seat(this.tmp), boat.yaw, boat.roll, boat.pitch);
    boat.speedLimit = 3;
    // The flame gutters out as they come down onto the water.
    this.lantern.brightness = 1 - THREE.MathUtils.smoothstep(this.t, 0.4, 3);
    if (this.t > tuning.stairs.fogLift) {
      this.world.group.remove(this.lantern.glow);
      this.world.cloudHole = true;
      this.to('down');
    }
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
    d.snap = this.beat === 'fog' || this.beat === 'thin' || this.beat === 'down';
    const wisps = this.world.wisps;
    const fx = Math.sin(boat.yaw), fz = Math.cos(boat.yaw);
    if (this.beat === 'fog') {
      // The cloud swells up round the hull and over them; the pocket round the boat closes and fills.
      d.base = CLOUD.base;
      d.top = CLOUD.top + this.swell * 10;
      // The pocket shrinks round the stern and the child, so the bow and the lantern go into the white first.
      d.bubble.set(boat.position.x - fx * 1.6, boat.position.y + 1.2, boat.position.z - fz * 1.6, THREE.MathUtils.lerp(9, 5.2, this.swell));
      d.clearing = THREE.MathUtils.lerp(k.clearing, 0.1, this.swell);
      this.world.cloudHole = false;
      wisps.amount = this.swell;
      wisps.centre.set(boat.position.x, boat.position.y + 1.5, boat.position.z);
      wisps.wind.set(-fx, 0.05, -fz).multiplyScalar(boat.speed + 2.5);
      this.breeze = 0.35;
      return;
    }
    if (this.beat === 'thin' || this.beat === 'down') {
      // Down on the water inside it, and it grey and blue now, lifting.
      d.base = -3;
      d.top = 40;
      const lift = S(this.t, 2.2, tuning.stairs.fogLift);
      d.amount = 1 - 0.8 * lift;
      d.bubble.set(boat.position.x - fx * 1.6, boat.position.y + 1.2, boat.position.z - fz * 1.6, THREE.MathUtils.lerp(5.2, 30, lift));
      d.clearing = THREE.MathUtils.lerp(0.1, 0.07, lift);
      wisps.amount = 1 - lift;
      wisps.centre.set(boat.position.x, boat.position.y + 1.5, boat.position.z);
      wisps.wind.set(-fx, 0.05, -fz).multiplyScalar(boat.speed + 1.5);
      return;
    }
    d.base = CLOUD.base;
    const climb = this.air.climb;
    const inCloud = c.position.y > CLOUD.base - 3 && c.position.y < CLOUD.top - 0.3;
    d.bubble.set(c.position.x, c.position.y + 1.1, c.position.z, inCloud ? THREE.MathUtils.lerp(k.bubble, k.bubbleTop, climb) : 0);
    // On the ring's landing the clear air leans toward the lens, so the child and both flights' feet are seen
    // and the tops of the flights are lost in the white.
    if (this.beat === 'loop') {
      d.bubble.set(c.position.x + 1.4, c.position.y + 1.4, c.position.z + 2.6, 6.2);
      d.clearing = k.clearing * 0.6;
    }
    if (inCloud) d.clearing = THREE.MathUtils.lerp(k.clearing, k.clearingTop, climb);
    const white = ['hesitate', 'birdFirst', 'follow', 'loop', 'together', 'emerge'].includes(this.beat);
    wisps.amount = (white ? S(c.position.y + 1.2, CLOUD.base - 2, CLOUD.base + 0.8) * (1 - S(c.position.y, CLOUD.top - 0.8, CLOUD.top + 0.6)) : 0)
      * (this.beat === 'loop' ? 0.55 : 1);
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
        // One side of the stair, a little above it, and the same way on through the puzzle: looking down across
        // the gap, the loose flight and the gold drawing of where it goes, and holding still while it is moved.
        s.from = this.from.set(0.92, 0, 0.4).normalize();
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
          s.distance = 17;
          // Up over the gap, but never into the cloud.
          s.height = Math.min(7.5, CLOUD.base - 2.4 - s.target.y);
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
        // Along the ring's landing from the south: the flight going on up into the white on one side, and the one
        // they came up by on the other, coming up out of it.
        const L = flight(RING_LEVEL).landing;
        s.from = this.from.set(0.45, 0, 1).normalize();
        s.target.set(L.x + 0.4, L.y + 1.0, L.z + 0.6);
        s.distance = 7.5;
        s.height = 2.4;
        s.clearance = 0.4;
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
        // Behind the boat and a little to one side, sailing into the sun over the cloud.
        const fx = Math.sin(boat.yaw), fz = Math.cos(boat.yaw);
        const white = this.beat === 'fog' || this.beat === 'thin';
        const close = white ? THREE.MathUtils.smoothstep(this.beat === 'fog' ? this.swell : 1, 0.2, 0.9) : 0;
        const bearing = boat.yaw + Math.PI + THREE.MathUtils.lerp(0.5, 0.8, close);
        s.from = this.from.set(Math.sin(bearing), 0, Math.cos(bearing));
        s.target.set(boat.position.x + fx * 4, boat.position.y + 1.9, boat.position.z + fz * 4);
        s.distance = THREE.MathUtils.lerp(15, 5.4, close);
        s.height = THREE.MathUtils.lerp(4.2, 1.6, close);
        s.carry = true;
        s.carryAnchor = boat.position;
        this.pace = 0.35;
        this.focus.copy(boat.position);
      }
    }
  }
}
