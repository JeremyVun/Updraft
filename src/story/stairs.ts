import * as THREE from 'three';
import type { Shot } from '../camera';
import { tuning } from '../tuning';
import { roundedWaypoint } from '../traveller/navigation';
import type { Deck } from '../world/decks';
import { CloudStairs } from '../world/stairs';
import {
  CLOUD, CLOUD_BERTH, CLOUD_ROUTE, DESCENT_END, FLIGHT_RISE, FLIGHTS, LANE, LOOSE, SIT, SLIPPERS, STAIRS_ARRIVAL,
  STAIRS_FOOT, STAIRS_GROUND, STEP, TOP, TOP_EDGE, flight,
} from '../world/stairs-layout';
import type { Cast, Chapter } from './cast';
import type { CheckpointPayload } from './checkpoint-data';
import { completeObjective, cue } from './cues';

type Beat =
  | 'ashore' | 'wonder' | 'climb' | 'waiting' | 'hesitate' | 'birdFirst' | 'follow' | 'emerge'
  | 'nest' | 'skein' | 'lean' | 'gather' | 'boarding' | 'sail' | 'descend' | 'down';

/** What the story asks of the cloud deck each frame; main eases the sky toward it. */
export interface CloudDeckState {
  amount: number;
  base: number;
  top: number;
  bubble: THREE.Vector4;
}

const BIRD_LEAD = 2.6;

/** One stop on the way up: where to stand and the level of the landing or flight it is on. */
interface Stop { x: number; z: number; level: number }

/**
 * Every place the child turns on the way from the grass to the top landing: up each flight in its own lane,
 * along the half-landing, and across to the next.
 */
function route(): Stop[] {
  const stops: Stop[] = [{ x: STAIRS_FOOT.x, z: STAIRS_FOOT.z, level: 0 }];
  for (let i = 1; i <= FLIGHTS; i++) {
    const f = flight(i);
    const other = f.lane === 'west' ? LANE.east : LANE.west;
    stops.push({ x: f.top.x, z: f.top.z - f.dir * 0.3, level: i });
    stops.push({ x: f.top.x, z: f.landing.z, level: i });
    if (i < FLIGHTS) stops.push({ x: other, z: f.landing.z, level: i });
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
  private birdStarted = false;
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
  private readonly oldRadius: number;

  constructor(private readonly cast: Cast) {
    const world = cast.stairs;
    this.world = world;
    const { child, plane, cygnet, boat } = cast;
    world.onDocked = (index) => this.docked(index);
    world.ghostShown = 0;
    cygnet.mayFly = false;
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
    const level = loose ? loose.flight.index - 1 : FLIGHTS;
    let last = 0;
    this.stops.forEach((s, i) => { if (s.level <= level) last = i; });
    // Wait in the lane the next flight leaves from, facing the gap.
    return loose ? last : this.stops.length - 1;
  }

  get done(): boolean {
    return this.beat === 'down';
  }

  get scripted(): boolean {
    return ['hesitate', 'birdFirst', 'nest', 'skein', 'lean', 'gather', 'boarding'].includes(this.beat);
  }

  get departureKite(): boolean {
    return ['emerge', 'nest', 'skein', 'lean', 'gather', 'boarding', 'sail'].includes(this.beat);
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

  get arrivalMusic(): 'drowned' | undefined {
    return this.beat === 'descend' ? 'drowned' : undefined;
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
    if (index === LOOSE[LOOSE.length - 1]) completeObjective(); else cue('star');
    if (cygnet.carried) cygnet.mind.perform('wag', 0.9);
    this.limit = this.reachable();
    if (index === LOOSE[LOOSE.length - 1]) {
      // The last flight home: up to the landing under the cloud, and no further on their own.
      let last = 0;
      this.stops.forEach((s, i) => { if (s.level <= index) last = i; });
      this.limit = last - 1;
    }
    this.to('climb');
  }

  update(dt: number, _time: number): void {
    this.now += dt;
    const { child: c, cygnet: k, carry, plane } = this.cast;
    if (plane.held) plane.hold(c);
    this.sunPoint();
    switch (this.beat) {
      case 'wonder':
        c.lookAt = this.look.set(STAIRS_FOOT.x, CLOUD.base - 3, STAIRS_FOOT.z - 3);
        if (this.t > 1.2 && k.seat === 'satchel' && !carry.busy) carry.unstow();
        if (this.t > 4.5 && !carry.busy && !c.busy) {
          c.lookAt = null;
          c.stroll = tuning.stairs.climb;
          this.to('climb');
        }
        break;
      case 'climb':
        this.walkOn();
        break;
      case 'waiting': {
        const piece = this.world.waiting;
        c.lookAt = piece ? this.world.pointOn(piece, this.tmp.lerpVectors(piece.flight.bottom, piece.flight.landing, 0.5), this.look) : null;
        this.world.ghostShown = 1;
        if (piece && piece.worked > 0.01) { this.lastPush = this.now; piece.worked = 0; }
        break;
      }
      case 'hesitate':
        // The white starts a few steps up. They stop, look up into it, and hold the bird closer.
        c.lookAt = this.look.set(LANE.west, CLOUD.base + 1.5, flight(7).top.z);
        c.tighter = Math.min(1, c.tighter + dt * 1.2);
        c.lean = -0.06;
        if (this.t > 3.2 && !carry.busy) {
          c.tighter = 0;
          c.lean = 0;
          this.birdStarted = false;
          this.to('birdFirst');
          carry.setDown(() => {
            k.stay = false;
            this.birdStarted = true;
            this.beatStart = this.now;
          }, Math.PI);
        }
        break;
      case 'birdFirst':
        this.birdGoesFirst();
        break;
      case 'follow':
        this.walkOn();
        this.birdAhead();
        break;
      case 'emerge':
        this.walkOn();
        if (c.position.y > CLOUD.top + 0.6 && !c.moving) this.nest();
        break;
      case 'nest':
        c.lookAt = this.sun;
        if (!k.stay && Math.hypot(k.position.x - this.birdAt.x, k.position.z - this.birdAt.z) < 0.35) {
          k.stay = true;
          k.errand = null;
        }
        if (this.t > 5 && !this.skeinSent) this.sendSkein();
        if (this.skeinSent && this.t > 4) this.to('skein');
        break;
      case 'skein':
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
        this.sail();
        break;
      case 'descend':
        this.descend(dt);
        break;
      default:
        break;
    }
    this.cloud();
    this.frame();
  }

  /** Up the stair, stop by stop, as far as it goes. */
  private walkOn(): void {
    const { child: c } = this.cast;
    if (c.moving || c.busy) return;
    if (this.stop >= this.limit) {
      if (this.world.waiting) { this.to('waiting'); return; }
      if (this.beat === 'climb') { this.to('hesitate'); return; }
      if (this.beat === 'follow' || this.beat === 'emerge') { this.to('emerge'); return; }
      return;
    }
    this.stop++;
    const s = this.stops[this.stop];
    c.walkTo(s.x, s.z, false, undefined, 0.22);
    if (this.beat === 'follow' && s.level >= FLIGHTS) this.to('emerge');
  }

  /**
   * Set down on the landing, it looks up the flight into the white, hops up it a few treads into the cloud, and
   * turns round to wait: the one who has been carried everywhere goes first.
   */
  private birdGoesFirst(): void {
    const { cygnet: k, child: c } = this.cast;
    if (!this.birdStarted || k.carried) return;
    const f = flight(7);
    const up = this.birdAt.set(f.bottom.x, 0, f.bottom.z - f.dir * STEP.going * 7);
    c.lookAt = k.position;
    if (!k.stay && Math.hypot(k.position.x - up.x, k.position.z - up.z) > 0.5 && this.t < 9) {
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
      this.limit = this.stops.length - 1;
      this.to('follow');
    }
  }

  /** In the cloud it keeps a few treads ahead, and waits on each landing until they come. */
  private birdAhead(): void {
    const { cygnet: k, child: c } = this.cast;
    c.lookAt = k.position;
    const next = this.stops[Math.min(this.stop + 1, this.stops.length - 1)];
    const ahead = this.stops[Math.min(this.stop + 2, this.stops.length - 1)];
    const lead = Math.hypot(k.position.x - c.position.x, k.position.z - c.position.z) + Math.abs(k.position.y - c.position.y);
    const want = lead < BIRD_LEAD ? ahead : next;
    k.stay = false;
    k.errand = this.birdAt.set(want.x, 0, want.z);
  }

  private nest(): void {
    const { child: c, cygnet: k } = this.cast;
    this.to('nest');
    k.decks = this.decks();
    k.errand = this.birdAt.set(SLIPPERS.x, 0, SLIPPERS.z - 0.05);
    k.stay = false;
    c.walkTo(SIT.x + 0.3, SIT.z, false, () => {
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
    const bearing = Math.atan2(-toward.z, toward.x) + Math.PI * 0.5;
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
      c.walkTo(Math.max(beside.x, TOP_EDGE + 0.25), TOP.z + 0.1, false, () => {
        this.to('boarding');
        c.faceToward(boat.position.x, boat.position.z, 1);
        c.board(boat, () => {
          c.stroll = 1;
          c.decks = [];
          k.decks = [];
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

  private sail(): void {
    const { boat, child: c } = this.cast;
    c.ride(boat.seat(this.tmp), boat.yaw, boat.roll, boat.pitch);
    boat.altitude = CLOUD.top + 0.35;
    if (boat.speed > 1.5) boat.becalmed = Math.max(0, boat.becalmed - 0.01);
    const from = this.leg === 0 ? this.berth : CLOUD_ROUTE[this.leg - 1];
    const wp = CLOUD_ROUTE[this.leg];
    if (roundedWaypoint(boat.position.x, boat.position.z, from.x, from.y, wp.x, wp.y, 9)) {
      this.leg++;
      if (this.leg >= CLOUD_ROUTE.length) {
        boat.steerFor = DESCENT_END;
        this.to('descend');
        return;
      }
      boat.steerFor = CLOUD_ROUTE[this.leg];
    }
  }

  /** The cloud closes round them and the hull goes down through it, until it is on the water. */
  private descend(dt: number): void {
    const { boat, child: c } = this.cast;
    c.ride(boat.seat(this.tmp), boat.yaw, boat.roll, boat.pitch);
    const k = tuning.stairs;
    const altitude = Math.max(0, (boat.altitude ?? CLOUD.top) - dt * k.sinkRate * THREE.MathUtils.smoothstep(this.t, 0, 3));
    boat.altitude = altitude;
    boat.speedLimit = 2.2;
    if (altitude <= 0.001) {
      boat.altitude = null;
      this.to('down');
    }
  }

  private sunPoint(): void {
    const s = this.tmp2.set(0, 0, 0);
    s.copy(TOP).add(this.look.set(-0.79, 0, -0.62).multiplyScalar(60));
    this.sun.set(s.x, TOP.y + 3, s.z);
  }

  /** The deck as this beat needs it: its underside lowered to the sea for the way down, a pocket round whoever is in it. */
  private cloud(): void {
    const { child: c, boat } = this.cast;
    const d = this.cloudDeck;
    const k = tuning.stairs;
    d.amount = 1;
    d.top = CLOUD.top;
    if (this.beat === 'descend') {
      d.base = THREE.MathUtils.lerp(CLOUD.base, -3, THREE.MathUtils.smoothstep(this.t, 0, 4));
      d.bubble.set(boat.position.x, boat.position.y + 1.2, boat.position.z, k.bubble * 1.25);
      return;
    }
    d.base = CLOUD.base;
    const inCloud = c.position.y > CLOUD.base - 3 && c.position.y < CLOUD.top - 0.3;
    d.bubble.set(c.position.x, c.position.y + 1.1, c.position.z, inCloud ? k.bubble : 0);
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
    this.focus.copy(c);
    switch (this.beat) {
      case 'ashore':
      case 'wonder': {
        s.from = this.from.set(-0.45, 0, 0.9).normalize();
        s.target.set(STAIRS_FOOT.x - 2, CLOUD.base - 7, STAIRS_FOOT.z - 3);
        s.distance = 34;
        s.height = -4;
        this.pace = 0.3;
        return;
      }
      case 'climb':
      case 'waiting': {
        const piece = this.world.waiting;
        s.from = this.from.set(0.82, 0, 0.55).normalize();
        this.subjects.primary.copy(c).y += 1.1;
        if (piece && this.beat === 'waiting') {
          this.world.pointOn(piece, this.tmp2.lerpVectors(piece.flight.bottom, piece.flight.landing, 0.5), this.subjects.secondary);
          this.subjects.tertiary.lerpVectors(piece.flight.bottom, piece.flight.landing, 0.5);
          s.subjects = this.subjects;
          s.from = this.from.set(0.5, 0, 0.87).normalize();
          s.target.copy(c).lerp(this.subjects.secondary, 0.35).lerp(this.subjects.tertiary, 0.25);
          s.target.y = c.y + 1.8;
          s.distance = 21;
          s.height = 2.5;
        } else {
          s.target.set(c.x, c.y + 1.4, c.z);
          s.distance = 12;
          s.height = 2.2;
        }
        this.pace = 0.4;
        return;
      }
      case 'hesitate':
      case 'birdFirst': {
        // From outside the rail, a little ahead: their face turned up at where the stair goes into the white.
        s.from = this.from.set(-0.86, 0, -0.5).normalize();
        s.target.copy(c).lerp(cygnet.position, 0.45);
        s.target.y = c.y + 1.25;
        s.distance = 5.2;
        s.height = 0.15;
        s.clearance = 0.4;
        this.pace = 0.3;
        return;
      }
      case 'follow':
      case 'emerge': {
        // In the cloud: side on from the west, the bird a few treads ahead and the rail between them and the white.
        const onFlight = THREE.MathUtils.clamp(Math.ceil((c.y - STAIRS_GROUND) / FLIGHT_RISE), 1, FLIGHTS);
        const west = onFlight % 2 === 1;
        const up = Math.max(0, c.y - CLOUD.top + 1.5);
        s.from = this.from.set(-1, 0, west ? -0.25 : 0.25).normalize();
        s.target.copy(c).lerp(cygnet.position, 0.4);
        s.target.y = Math.max(c.y, cygnet.position.y) + 1.0;
        s.distance = (west ? 4.4 : 5.6) + up * 1.8;
        s.height = 0.5 + up * 0.8;
        s.clearance = 0.4;
        this.pace = 0.3;
        return;
      }
      case 'nest':
      case 'skein':
      case 'lean':
      case 'gather':
      case 'boarding': {
        // Behind them, low, with the sun and all of the cloud in front: two small shapes on the edge of the top step.
        const back = this.tmp.copy(TOP).sub(this.sun).setY(0).normalize();
        const skein = this.beat === 'skein';
        s.from = this.from.copy(back).applyAxisAngle(THREE.Object3D.DEFAULT_UP, 0.32);
        s.target.copy(SIT).lerp(this.sun, skein ? 0.18 : 0.08);
        s.target.y = TOP.y + (skein ? 4.5 : 1.4);
        s.distance = skein ? 16 : 9;
        s.height = skein ? -1.2 : 1.1;
        this.focus.copy(SIT);
        this.pace = 0.2;
        return;
      }
      default: {
        // Behind the boat and a little to one side, sailing into the sun over the cloud.
        const fx = Math.sin(boat.yaw), fz = Math.cos(boat.yaw);
        const down = this.beat === 'descend';
        const bearing = boat.yaw + Math.PI + (down ? 0.9 : 0.42);
        s.from = this.from.set(Math.sin(bearing), 0, Math.cos(bearing));
        s.target.set(boat.position.x + fx * 3, boat.position.y + 1.8, boat.position.z + fz * 3);
        s.distance = down ? 9 : 14;
        s.height = down ? 2.6 : 3.4;
        s.carry = true;
        s.carryAnchor = boat.position;
        this.pace = 0.35;
        this.focus.copy(boat.position);
      }
    }
  }
}
