import * as THREE from 'three';
import { breathe, type Shot } from '../camera';
import { tuning } from '../tuning';
import { atmo } from '../world/atmosphere';
import { BELFRY, faceOut } from '../world/belfry';
import { BELL_SOUNDS, type Bell } from '../world/crossings/bell';
import type { Deck } from '../world/decks';
import { LanternGlow } from '../world/lantern-glow';
import {
  BRING_WAY, DARK_END, HOME_WAY, IVY_FOOT, IVY_STEP, NAVE, NAVE_BERTH, NAVE_NORTH, NAVE_RIDGE, TOWER, roofUnder,
} from '../world/drowned-way';
import { Climb } from '../traveller/climb';
import type { Cast } from './cast';

/**
 * `foot` her at the tower's foot as the cat runs up the ivy; `climb` her going up after it while it calls from the
 * arch; `nest` in over the sill and kneeling to the kittens; `sea` standing by the bell looking out over the fog sea;
 * `ring` the bell hers to ring, the lost boat's lantern answering out in the fog; `down` her climbing down to it as the
 * boat drifts the last stretch; `wait` on the slates for it; `board` stepping down into it; `aboard` looking back
 * up at the cat and a kitten on the arch's sill.
 */
type Step = 'foot' | 'climb' | 'nest' | 'sea' | 'ring' | 'down' | 'wait' | 'board' | 'aboard';

const C = new THREE.Vector3(TOWER.x, 0, TOWER.z);
const WEST = faceOut('west');
/** The kitten that comes to her, and later to the sill with its mother to see her off. */
const FOUND = 0;
/**
 * Along the west arch from its middle (south positive): the cat's side, where its way up the ivy comes out and it waits
 * calling; and where it and the kitten sit on the sill to see her off.
 */
const CAT_SIDE = 0.78;
const SEE_OFF = -0.5;
const KITTEN_OFF = -1.0;
const WAY_HOME = [...HOME_WAY, ...BRING_WAY];
const HOME_LENGTH = HOME_WAY.reduce((sum, p, i) => (i ? sum + p.distanceTo(HOME_WAY[i - 1]) : 0), 0);

/** A critically damped glide of `at` toward `to` over about `time` seconds, carrying its speed in `speed`. */
function glide(at: THREE.Vector3, speed: THREE.Vector3, to: THREE.Vector3, time: number, dt: number): void {
  if (dt <= 0) return;
  const w = 2 / time, x = w * dt;
  const decay = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  for (const k of ['x', 'y', 'z'] as const) {
    const change = at[k] - to[k];
    const temp = (speed[k] + w * change) * dt;
    speed[k] = (speed[k] - w * temp) * decay;
    at[k] = to[k] + (change + temp) * decay;
  }
}

/** The point `s` metres along a way of points on the water, and the way it heads there. */
function along(way: readonly THREE.Vector2[], s: number, out: THREE.Vector2): number {
  let left = Math.max(0, s);
  for (let i = 1; i < way.length; i++) {
    const a = way[i - 1], b = way[i], len = a.distanceTo(b);
    if (left <= len || i === way.length - 1) {
      out.lerpVectors(a, b, Math.min(1, left / len));
      return Math.atan2(b.x - a.x, b.y - a.y);
    }
    left -= len;
  }
  return 0;
}

/**
 * The church, from her reaching the tower's foot to her aboard her boat again. The cat runs up the tower's ivy ahead of
 * her and waits in the belfry's arch, calling down to her; as she nears the top it goes in to its kittens and they wake
 * and tumble about it, and she climbs in over the sill to find them: one comes to her and she kneels to it. She stands
 * by the bell looking out over the fog sea, which has closed round the tower and stopped just under the sills. The bell
 * is the player's to ring; each ring rolls out over the fog and pushes it back round the tower, and out in it the lost
 * boat's lantern answers, nearer each time, until the fog has drawn back to the water round the nave and the boat
 * drifts the last stretch round the tower to the nave. She climbs down and steps aboard; the cat stays with its
 * kittens and comes to the sill with one of them to see her off. She looks back up at the two of them and the cat gives
 * her a slow blink. They stay at the window as the fog closes round and darkens into the storm.
 */
export class ChurchArrival {
  step: Step | 'off' = 'off';
  /** How far the fog has closed round her for the storm, 0 to 1. */
  close = 0;
  /** Seconds since she was seated aboard (-1 before). */
  aboardFor = -1;
  /** How far round on the thwart she has turned from the bow to look back up, radians. */
  seatTurn = 0;
  /** The rings, how many of them the boat has answered, and how far along its way home it has come, metres. */
  rings = 0;
  answered = 0;
  home = 0;
  /**
   * Where the cat is: on its way up, waiting in the arch calling, with its kittens, on the sill with a kitten seeing her
   * off, gone back in to the others.
   */
  catAt: 'foot' | 'arch' | 'nest' | 'sill' = 'foot';
  readonly bell: Bell;
  readonly climb: Climb;
  readonly homeAt = new THREE.Vector3();
  private readonly glow = new LanternGlow();
  private t = 0;
  private since = 0;
  private leg = 0;
  private sinkAt = -Infinity;
  /** The fog closing round: since when, from what level, and how high it lies round the tower beneath her. */
  private closeFrom = -1;
  private closeLevel = 0;
  private dipFloor = 0;
  /** How far round the tower the last ring found it pushed back, and when she started down. */
  private clearFrom = 0;
  private downAt = Infinity;
  /** While the boat is away in the fog, before the bell has called it in. */
  private lost = false;
  private homeWant = 0;
  private readonly homeSpeed = new THREE.Vector3();
  private answeredAt = -Infinity;
  private sailing = false;
  private blinked = false;
  private catStarted = false;
  private calledAt = -Infinity;
  private firstAnswer = -Infinity;
  /** Leaning down to the kitten that has come to her. */
  private leaning = false;
  private sunOn = 0;
  private readonly homeGlide = new THREE.Vector3();
  private camera: THREE.PerspectiveCamera | null = null;
  private aspect = 16 / 9;
  private readonly head = new THREE.Vector3();
  private readonly look = new THREE.Vector3();
  private readonly catEye = new THREE.Vector3();
  private readonly tmp = new THREE.Vector3();
  private readonly tmp2 = new THREE.Vector3();
  private readonly flat = new THREE.Vector2();
  private readonly inviteAt = new THREE.Vector3();
  private readonly inviteDir = new THREE.Vector3();
  private readonly down = new THREE.Vector3();
  private readonly timers: { at: number; go: () => void }[] = [];
  /** Her floor up there: the sill of the arch she climbs in by and the boards inside. */
  private readonly upDecks: Deck[];

  constructor(private readonly cast: Cast) {
    const v = cast.village!;
    const crossingCast = { child: cast.child, wind: cast.wind, lines: cast.lines, input: cast.input };
    this.bell = v.prepareBell(crossingCast);
    this.bell.reset();
    this.bell.onEvent = (kind, at, strength) => cast.knock?.(BELL_SOUNDS[kind], at, strength);
    this.bell.onRing = (strength) => this.rang(strength);
    this.bell.live = false;
    v.belfry.group.add(this.glow.mesh);
    this.climb = new Climb(cast.child, { wall: IVY_FOOT, out: WEST, holds: v.ivy.holds, sill: v.belfry.sill('west', 0), depth: BELFRY.wall, wide: true });
    const a = v.belfry.sill('west', 0.05), b = v.belfry.sill('west', -BELFRY.wall - 0.08);
    this.upDecks = [{ x0: a.x, z0: a.z, x1: b.x, z1: b.z, halfWidth: BELFRY.arch.width / 2 - 0.06, height: BELFRY.sill }, ...v.belfry.decks];
    v.dark.relief = 1;
    v.dark.round = 0;
    Object.assign(v.dark.clearing, { x: TOWER.x, z: TOWER.z, radius: 0 });
  }

  /** She has reached the tower's foot, the cat sitting on the churchyard's railings below the tower's south face. */
  begin(): void {
    const { child: c, cat } = this.cast;
    const dark = this.cast.village!.dark;
    this.to('foot');
    this.since = 0;
    dark.faces = null;
    c.decks = [...c.decks, IVY_STEP, NAVE_RIDGE, NAVE_NORTH, ...this.upDecks];
    c.face(this.head);
    cat.look(this.head);
    cat.unease = 0.6;
    this.later(tuning.drowned.church.catAfter, () => this.catUp());
  }

  get done(): boolean {
    return this.step === 'aboard' && this.aboardFor >= tuning.drowned.church.lookUpFor;
  }

  /** While she is aboard, seated: the story keeps her in her seat, turned by `seatTurn`. */
  get aboard(): boolean {
    return this.aboardFor >= 0;
  }

  /** In the belfry: the save point there. */
  get inBelfry(): boolean {
    return this.step === 'nest' || this.step === 'sea' || this.step === 'ring';
  }

  /** QA and the save in the belfry: her standing by the bell looking out over the fog sea, the kittens awake round the cat. */
  skipToBelfry(): void {
    const { child: c } = this.cast;
    const k = tuning.drowned.church;
    const v = this.cast.village!;
    const dark = v.dark;
    if (this.step === 'off') this.begin();
    this.timers.length = 0;
    this.climb.stop();
    this.curl();
    v.kittens.tumble();
    this.catStarted = true;
    dark.front = DARK_END + k.fog.past;
    dark.level = this.closeLevel = this.dipFloor = k.fog.sea;
    dark.relief = k.fog.still;
    dark.round = 1;
    dark.clearing.radius = 0;
    this.since = 1e3;
    this.closeFrom = this.since - k.fog.roundFor;
    this.hidePlane();
    const stand = this.standAt();
    c.standUp();
    c.kneeling = 0;
    c.place(stand.x, stand.z, this.outward);
    c.position.y = v.belfry.floor;
    this.placeBoatAway();
    this.to('sea');
    this.t = k.seaFor - 1.5;
    this.lensCut = true;
  }

  /** QA: on to her just seated aboard at the berth, the cat and a kitten on the sill above and the fog drawn back to the water. */
  skipToAboard(): void {
    const { boat, child: c, cat } = this.cast;
    const k = tuning.drowned.church;
    const v = this.cast.village!;
    this.skipToBelfry();
    this.lost = false;
    this.rings = this.answered = k.rings;
    this.home = this.homeWant = HOME_LENGTH;
    v.dark.level = k.fog.drawn;
    v.dark.relief = 1;
    v.dark.round = 0;
    cat.place(this.sillAt(SEE_OFF), this.outward2(), { pose: 'sit', floor: () => BELFRY.sill });
    cat.look(this.head);
    const kitten = v.kittens.cats[FOUND];
    v.kittens.hold(FOUND);
    kitten.place(this.sillAt(KITTEN_OFF), this.outward2(), { pose: 'sit', floor: () => BELFRY.sill });
    kitten.look(this.head);
    this.catAt = 'sill';
    boat.towed = false;
    boat.beach(NAVE_BERTH.x, NAVE_BERTH.z, NAVE_BERTH.yaw);
    boat.takeWeight(0);
    boat.finishBoarding();
    c.ride(boat.seat(this.tmp), boat.yaw, boat);
    this.showPlane();
    this.makeFast();
    this.to('aboard');
    this.aboardFor = 0;
    this.lensCut = true;
  }

  /** The last bell answer carries the boat to the berth while she climbs down. */
  get carrying(): boolean {
    return this.sailing;
  }

  /** While she looks back up at the cat from the boat. */
  get lookingUp(): boolean {
    return this.aboardFor >= tuning.drowned.church.lookUpAt;
  }

  /** The drawn stroke across the bell, brought out in front of the stone between it and the lens. */
  get invitation(): THREE.Vector3 | null {
    const at = this.step === 'ring' ? this.bell.invitation : null;
    if (!at || !this.camera) return at;
    const toward = this.inviteDir.copy(this.camera.position).sub(at).normalize();
    return this.inviteAt.copy(at).addScaledVector(toward, Math.min(at.distanceTo(this.camera.position) * 0.5, 4.5));
  }

  get inviteHeading(): number {
    return this.bell.heading;
  }

  afterCamera(camera: THREE.PerspectiveCamera): void {
    this.camera = camera;
    this.aspect = camera.aspect;
  }

  private to(step: Step): void {
    this.step = step;
    this.t = 0;
  }

  private later(seconds: number, go: () => void): void {
    this.timers.push({ at: this.since + seconds, go });
  }

  update(dt: number): void {
    if (this.step === 'off') return;
    const { child: c, cat } = this.cast;
    const v = this.cast.village!;
    const k = tuning.drowned.church;
    this.t += dt;
    this.since += dt;
    for (const due of this.timers.filter((timer) => timer.at <= this.since)) {
      this.timers.splice(this.timers.indexOf(due), 1);
      due.go();
    }
    c.face(this.head);
    cat.eye(this.catEye);
    for (const h of v.kittens.heard) cat.heard.push(h);
    v.kittens.heard.length = 0;
    this.climb.update(dt);
    v.belfry.shadeBell(this.bell.pivot, this.bell.down(this.down));
    this.bell.live = this.step === 'ring';
    if (this.camera) this.bell.update(dt, this.camera);

    switch (this.step) {
      case 'foot':
        c.lookAt = this.look.copy(this.catEye);
        if (this.catStarted && (this.catEye.y > BELFRY.sill - k.followFrom || this.t > k.followAfter)) this.follow();
        break;
      case 'climb':
        if (this.catAt === 'arch' && c.position.y > BELFRY.sill - k.catInFrom) this.catIn();
        break;
      case 'nest':
        c.lookAt = v.kittens.cats[FOUND].eye(this.look);
        c.lean = this.leaning ? k.leanTo : 0;
        if (this.t > k.nestFor) {
          c.kneeling = 0;
          c.lean = 0;
          this.leaning = false;
          v.kittens.release(FOUND);
          this.to('sea');
        }
        break;
      case 'sea':
        if (this.t > 0.8) c.yaw += Math.atan2(Math.sin(this.outward - c.yaw), Math.cos(this.outward - c.yaw)) * (1 - Math.exp(-dt * 1.6));
        c.lookAt = this.look.copy(this.standAt()).add(this.tmp.set(0, 2.3, -40));
        if (this.t > k.seaFor) {
          this.placeBoatAway();
          this.to('ring');
        }
        break;
      case 'ring':
        c.lookAt = this.rings > 0 ? this.look.copy(this.homeAt) : this.look.copy(this.standAt()).add(this.tmp.set(0, 2.3, -40));
        if (this.answered >= k.rings && this.since - this.answeredAt > k.answerFor) this.goDown();
        break;
      case 'down':
        if (this.catAt === 'nest' && c.position.y < BELFRY.sill - k.catGap) this.seeOff();
        break;
      case 'wait':
        this.waiting(dt);
        break;
      case 'aboard':
        this.aboardFor += dt;
        this.lookUp(dt);
        if (this.madeFast && this.aboardFor >= k.lookUpFor) {
          this.madeFast = false;
          this.cast.boat.mooring = null;
          this.cast.boat.grounded = false;
        }
        break;
      default:
        break;
    }
    if (this.catAt === 'arch' && this.since - this.calledAt > k.callEvery) {
      this.calledAt = this.since;
      cat.mew(0.75);
    }
    this.inRoom(dt);
    this.boatHome(dt);
    this.fog(dt);
  }

  /**
   * The cat, seeing her at the tower's foot, goes: off the railings in one leap onto the nave's slates beside her at
   * the foot of the ivy and up it ahead of her, out onto the arch's sill on its side, round to face her, and sits there
   * calling down to her.
   */
  private catUp(): void {
    const { cat } = this.cast;
    const v = this.cast.village!;
    this.catStarted = true;
    cat.unease = 0.3;
    const onto = new THREE.Vector3(IVY_FOOT.x - 0.25, 0, TOWER.z + 0.6);
    onto.y = roofUnder(NAVE, onto.x, onto.z) ?? IVY_FOOT.y;
    cat.leap(onto, { then: 'stand', arc: 0.5, gather: 0.2, floor: (x, z) => roofUnder(NAVE, x, z) ?? onto.y }, () => {
      cat.climb([...v.ivy.catWay(), this.sillAt(CAT_SIDE, 0.24)], WEST, { then: 'stand', speed: tuning.drowned.church.catClimb, gather: 0.1 }, () => {
        cat.turn(this.outward2(), () => {
          cat.rest('sit', this.head);
          cat.unease = 0;
          this.catAt = 'arch';
          this.calledAt = this.since - tuning.drowned.church.callEvery + 0.3;
        }, 2.6);
      });
    });
  }

  /** She goes up after it: to the foot of the ivy, the plane tucked away in her coat, and up hand over hand. */
  private follow(): void {
    const { child: c } = this.cast;
    this.to('climb');
    const start = this.climb.start(this.tmp);
    c.walkTo(start.x, start.z, false, () => {
      c.yaw = this.climb.facing;
      this.hidePlane();
      c.lookAt = null;
      this.climb.up(() => this.arrive());
    }, 0.08);
  }

  /**
   * As she nears the top the cat goes in: round off the sill and down onto the boards, across to the straw, and down
   * among its kittens, which wake to it and tumble about it, the ginger one mewing.
   */
  private catIn(): void {
    const { cat } = this.cast;
    const v = this.cast.village!;
    const k = tuning.drowned.church;
    this.catAt = 'nest';
    const floor = () => v.belfry.floor;
    cat.hop(v.belfry.inside('west', 0.35, CAT_SIDE * 0.7), { then: 'stand', floor }, () => {
      cat.run([this.curlAt()], floor, { pace: 'trot', speed: 1.1, then: 'stand' }, () => {
        cat.chirrup();
        cat.rest('sit', this.head);
        this.later(k.wakeAfter, () => {
          v.kittens.tumble();
          this.later(0.2, () => v.kittens.cats[FOUND].mew(0.5));
        });
      });
    });
  }

  /**
   * In over the sill she steps down onto the boards to where the kittens are tumbling round their mother, and kneels;
   * one of them comes to her, sits looking up at her and mews, and she leans down to it.
   */
  private arrive(): void {
    const { child: c } = this.cast;
    const v = this.cast.village!;
    const k = tuning.drowned.church;
    this.to('nest');
    const stand = this.standAt();
    const nest = v.belfry.nest();
    c.lookAt = this.look.copy(nest).setY(nest.y + 0.3);
    c.walkTo(stand.x, stand.z, false, () => {
      c.stop();
      c.faceToward(nest.x, nest.z, 1);
      c.kneeling = 1;
      this.later(k.kittenComes, () => {
        const to = this.tmp2.copy(nest).sub(stand).setY(0).normalize().multiplyScalar(k.kittenNear).add(stand).setY(v.belfry.floor);
        v.kittens.come(FOUND, to.clone(), this.head, () => { this.leaning = true; });
      });
    }, 0.12);
  }

  /**
   * Each ring rolls out over the fog's top and pushes it back round the tower, and out in the fog the boat's lantern answers,
   * a stretch nearer than the last time.
   */
  private rang(strength: number): void {
    const k = tuning.drowned.church;
    const v = this.cast.village!;
    v.bellWaves.level = Math.max(0.15, v.dark.level * k.fog.wavesAt);
    v.bellWaves.emit(strength);
    if (this.step !== 'ring' || this.rings >= k.rings) return;
    this.rings++;
    this.clearFrom = v.dark.clearing.radius;
    this.sinkAt = this.since;
    this.later(k.answerAfter, () => {
      this.answeredAt = this.since;
      if (this.answered === 0) this.firstAnswer = this.since;
      this.homeWant = HOME_LENGTH * k.answers[this.answered++];
    });
  }

  /**
   * The bell has called it in: she goes back to the arch she came in by, turns her back to the drop and climbs down to
   * meet it while it keeps drifting to the berth.
   */
  private goDown(): void {
    const { child: c, boat } = this.cast;
    const k = tuning.drowned.church;
    this.to('down');
    c.kneeling = 0;
    c.lookAt = null;
    this.downAt = this.since;
    const stand = this.standInOpening();
    c.walkTo(stand.x, stand.z, false, () => {
      c.stop();
      c.yaw = this.climb.facing;
      this.later(0.4, () => this.climb.down(() => {
        c.lookAt = null;
        this.to('wait');
        c.walkTo(NAVE_NORTH.x0, NAVE_NORTH.z0, false, () => c.walkTo(NAVE_NORTH.x1, NAVE_NORTH.z1, false, () => c.stop(), 0.12), 0.15);
      }));
    }, 0.06);
    this.lost = false;
    boat.towed = false;
    boat.coastTo = null;
    boat.mooring = null;
    boat.grounded = false;
    boat.canGround = false;
    boat.speedLimit = k.bringSpeed;
    this.leg = 0;
    boat.steerFor = BRING_WAY[0];
    this.sailing = true;
  }

  /**
   * The cat sees her off: once she is a little way down the ivy it gets up from its kittens and comes to the sill she
   * went out over, the kitten that found her with it, and the two sit at its lip looking down after her.
   */
  private seeOff(): void {
    const { cat } = this.cast;
    const v = this.cast.village!;
    this.catAt = 'sill';
    const floor = () => v.belfry.floor;
    cat.rest('stand', this.head);
    cat.run([v.belfry.inside('west', 0.3, SEE_OFF)], floor, { pace: 'walk', speed: 0.9, then: 'stand', look: this.head }, () => {
      cat.hop(this.sillAt(SEE_OFF), { then: 'sit', look: this.head, floor: () => BELFRY.sill });
    });
    this.later(tuning.drowned.church.kittenAfter, () => v.kittens.toSill(FOUND, this.sillAt(KITTEN_OFF), this.head));
  }

  /**
   * The boat under sail to the berth: round the tower's corner, alongside, and her stepping down into it once it has
   * come to rest there.
   */
  private waiting(dt: number): void {
    const { boat, child: c } = this.cast;
    const k = tuning.drowned.church;
    c.lookAt = this.look.copy(boat.position).setY(boat.position.y + 0.8);
    if (!c.busy) c.faceToward(boat.position.x, boat.position.z, 0.05);
    const p = boat.position;
    const berthed = boat.grounded && Math.hypot(p.x - NAVE_BERTH.x, p.z - NAVE_BERTH.z) < k.berthed;
    this.berthedFor = berthed ? this.berthedFor + dt : 0;
    if (this.berthedFor > k.boardAfter && !c.busy) this.board();
  }
  private berthedFor = 0;

  private sail(): void {
    const { boat } = this.cast;
    const k = tuning.drowned.church;
    const p = boat.position;
    if (this.leg < BRING_WAY.length - 1 && Math.hypot(p.x - BRING_WAY[this.leg].x, p.z - BRING_WAY[this.leg].y) < k.rounded) {
      this.leg++;
      boat.steerFor = BRING_WAY[this.leg];
      if (this.leg === BRING_WAY.length - 1) boat.mooring = { ...NAVE_BERTH };
    }
  }

  /** She steps down off the slates into the boat, which dips and rocks under her as it takes her weight. */
  private board(): void {
    const { boat, child: c } = this.cast;
    this.to('board');
    this.sailing = false;
    boat.mooring = null;
    boat.steerFor = null;
    boat.speed = 0;
    c.faceToward(boat.position.x, boat.position.z, 1);
    c.board(boat, () => {
      this.showPlane();
      this.to('aboard');
      this.aboardFor = 0;
      this.makeFast();
    }, true);
  }

  /** Seated, the boat lies along the slates while she looks back up at the cat, whatever air is in its sail, until the storm takes it. */
  private makeFast(): void {
    const { boat } = this.cast;
    boat.mooring = { ...NAVE_BERTH };
    boat.grounded = true;
    this.madeFast = true;
  }
  private madeFast = false;

  /**
   * Seated, she turns round on the thwart to look back up at the cat and the kitten on the sill, the way that keeps her
   * face from the lens; the cat gives her a slow blink and the two stay at the window watching her leave.
   */
  private lookUp(dt: number): void {
    const { child: c, cat, boat } = this.cast;
    const k = tuning.drowned.church;
    let want = 0;
    if (this.lookingUp) {
      c.lookAt = this.look.copy(this.catEye);
      const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
      let to = wrap(Math.atan2(this.catEye.x - c.position.x, this.catEye.z - c.position.z) - boat.yaw);
      const lens = this.camera ? wrap(Math.atan2(this.camera.position.x - c.position.x, this.camera.position.z - c.position.z) - boat.yaw) : 0;
      if (Math.abs(to) > k.turnPast && Math.sign(to) === Math.sign(lens)) to -= Math.sign(to) * Math.PI * 2;
      if (Math.abs(to) > k.headTurns) want = THREE.MathUtils.clamp(to - Math.sign(to) * k.headTurns, -k.seatTurn, k.seatTurn);
    }
    this.seatTurn += (want - this.seatTurn) * (1 - Math.exp(-dt * k.turnRate));
    if (this.catAt === 'sill') cat.look(this.head);
    if (!this.blinked && this.aboardFor > k.blinkAt) {
      this.blinked = true;
      cat.slowBlink();
      this.later(k.chirrupAfter, () => cat.chirrup());
    }
  }

  /**
   * In the belfry she is in its light as the nest is: the sky only through the arches, and the low sun brighter on her
   * where its shaft through an arch falls.
   */
  private inRoom(dt: number): void {
    const c = this.cast.child;
    const v = this.cast.village!;
    const sun = atmo.uniforms.uSunDir.value;
    const dx = TOWER.half - Math.abs(c.position.x - TOWER.x), dz = TOWER.half - Math.abs(c.position.z - TOWER.z);
    const into = THREE.MathUtils.smoothstep(Math.min(dx, dz), -0.1, BELFRY.wall);
    const up = THREE.MathUtils.smoothstep(c.position.y, BELFRY.sill - 0.6, BELFRY.sill - 0.1);
    const chest = this.tmp.copy(c.position).setY(c.position.y + 1.4);
    const lit = v.belfry.holds(chest) ? v.belfry.sunAt(chest, sun) : 1;
    this.sunOn += (lit - this.sunOn) * (1 - Math.exp(-dt * 3));
    c.room.set(up * into, THREE.MathUtils.lerp(0.35, 0.85, this.sunOn));
  }

  /**
   * The lost boat's way home: out of sight in the fog until the first ring, then a stretch nearer after each, its
   * lantern's light swelling in the fog as it answers and settling to a steady glow; after the last answer a gentle
   * breeze carries it the rest of the way.
   */
  private boatHome(dt: number): void {
    const { boat } = this.cast;
    const k = tuning.drowned.church;
    const shown = this.firstAnswer > -Infinity ? THREE.MathUtils.smoothstep(this.since - this.firstAnswer, 0, 1.5) : 0;
    /** Lost deep in the fog its lantern is not seen until it answers the bell. */
    if (this.lost) boat.lanternHidden = 1 - shown;
    if (this.step === 'off' || this.step === 'foot' || this.step === 'climb' || this.step === 'nest' || this.step === 'sea') {
      this.glow.show(this.homeAt, 1, 0);
      return;
    }
    if (boat.towed) {
      glide(this.homeGlide.set(this.home, 0, 0), this.homeSpeed, this.tmp.set(this.homeWant, 0, 0), k.homeGlide, dt);
      this.home = this.homeGlide.x;
      const yaw = along(WAY_HOME, this.home, this.flat);
      boat.position.x = this.flat.x;
      boat.position.z = this.flat.y;
      boat.yaw = yaw;
      boat.speed = 0;
    }
    if (this.sailing) this.sail();
    const lantern = atmo.uniforms.uLantern.value;
    this.homeAt.set(lantern.x, lantern.y, lantern.z);
    const under = THREE.MathUtils.smoothstep(this.cast.village!.dark.topAt(lantern.x, lantern.z) - lantern.y, -0.6, 1.4);
    const since = this.since - this.answeredAt;
    const swell = since >= 0 ? Math.exp(-since / k.answerGlow) * THREE.MathUtils.smoothstep(since, 0, 0.5) : 0;
    const far = this.camera ? this.camera.position.distanceTo(this.homeAt) : 30;
    const approaching = this.step === 'ring' || this.step === 'down' || this.step === 'wait';
    const distant = approaching ? THREE.MathUtils.smoothstep(Math.hypot(boat.position.x - NAVE_BERTH.x, boat.position.z - NAVE_BERTH.z), k.glowNear, k.glowFar) : 0;
    this.glow.show(this.homeAt, k.glowSize * THREE.MathUtils.clamp(far / 30, 0.4, 2), (shown * k.glow + k.glowSwell * swell) * under * distant);
  }

  /**
   * The fog: while she stands at the tower's foot it waits a little back along the nave. As she climbs it closes round
   * the tower and runs on over the village, rising and stilling into a white sea just under the sills, with only the
   * tower and the lighthouse standing out of it; round the tower it rises beneath her, never over her feet, and once she
   * is in it rises the rest of the way. Each ring pushes it back round the tower to lie on the water, further each time;
   * once she climbs down it settles to the water all round. Once she is aboard it closes round and darkens into the
   * storm's night.
   */
  private fog(dt: number): void {
    const k = tuning.drowned.church.fog;
    const dark = this.cast.village!.dark;
    const c = this.cast.child;
    const lerp = THREE.MathUtils.lerp;
    if (this.step === 'foot') {
      dark.front = Math.min(dark.front + THREE.MathUtils.clamp((DARK_END - k.behind - dark.front) * k.pull, 0, k.spreadFrom) * dt, DARK_END - k.behind);
      return;
    }
    if (this.step === 'climb' || this.step === 'nest' || this.step === 'sea') {
      if (this.closeFrom < 0) {
        this.closeFrom = this.since;
        this.closeLevel = dark.level;
        this.dipFloor = 0;
      }
      const fastest = Math.min(k.spreadMost, k.spreadFrom + k.spreadRate * Math.max(0, dark.front - DARK_END));
      dark.front = Math.min(dark.front + THREE.MathUtils.clamp((DARK_END + k.past - dark.front) * k.pull, 0, fastest) * dt, DARK_END + k.past);
      const closing = THREE.MathUtils.smoothstep(this.since - this.closeFrom, 0, k.roundFor);
      dark.round = closing;
      dark.relief = lerp(1, k.still, closing);
      dark.level = lerp(this.closeLevel, k.sea, closing);
      const lens = this.camera ? this.camera.position.y - k.underLens : Infinity;
      const under = this.step === 'climb' ? Math.min(c.position.y - k.underHer, lens) / dark.heaped : dark.level;
      this.dipFloor = Math.min(this.step === 'climb' ? Math.max(this.dipFloor, under) : this.dipFloor + k.dipRise * dt, under);
      dark.clearing.floor = this.dipFloor;
      dark.clearing.radius = this.dipFloor < dark.level ? k.dip : 0;
      return;
    }
    if (this.step === 'ring' || this.step === 'down' || this.step === 'wait' || this.step === 'board') {
      const settle = THREE.MathUtils.smoothstep(this.since - this.downAt, 0, k.settleFor);
      dark.clearing.floor = lerp(k.cleared, k.drawn, settle);
      dark.clearing.radius = lerp(this.clearFrom, k.clearAt[this.rings], THREE.MathUtils.smootherstep(this.since - this.sinkAt, 0, k.sinkFor));
      dark.level = lerp(k.sea, k.drawn, settle);
      dark.relief = lerp(k.still, 1, settle);
      dark.round = 1 - settle;
      return;
    }
    if (this.step === 'aboard') {
      dark.clearing.radius = 0;
      /** Evenly: the night it brings already eases in and out of itself. */
      this.close = THREE.MathUtils.clamp((this.aboardFor - k.closeAfter) / k.closeFor, 0, 1);
      dark.close = this.close;
      dark.level = THREE.MathUtils.lerp(k.drawn, k.closedLevel, this.close);
    }
  }

  /** Away in the fog off the tower's east side, where it will first answer the bell from. */
  private placeBoatAway(): void {
    const { boat } = this.cast;
    this.lost = true;
    boat.coastTo = null;
    boat.mooring = null;
    boat.steerFor = null;
    boat.towed = true;
    boat.afloat = true;
    boat.grounded = false;
    boat.knock(0, 0, 0);
    this.home = this.homeWant = 0;
    this.homeSpeed.set(0, 0, 0);
    boat.yaw = along(WAY_HOME, 0, this.flat);
    boat.position.set(this.flat.x, boat.position.y, this.flat.y);
  }

  private hidePlane(): void {
    this.cast.child.stowPlane(true, true);
    this.cast.plane.visible = false;
  }

  private showPlane(): void {
    this.cast.child.stowPlane(false);
    this.cast.plane.visible = true;
  }

  /** Where the cat lies in the straw, at the back of it as the lens looks in, so its kittens play in front of it. */
  private curlAt(): THREE.Vector3 {
    const v = this.cast.village!, k = tuning.drowned.church;
    return v.belfry.nest().add(this.tmp2.set(k.curlBack[0], 0, k.curlBack[1])).setY(v.belfry.floor + 0.03);
  }

  private curl(): void {
    const { cat } = this.cast;
    const at = this.curlAt();
    cat.unease = 0;
    cat.place(at, tuning.drowned.church.curlYaw, { pose: 'sit', floor: () => at.y });
    cat.look(this.head);
    this.catAt = 'nest';
  }

  /** Where she stands by the bell, the kittens beside her. */
  private standAt(): THREE.Vector3 {
    return this.cast.village!.belfry.onFloor(BELFRY.stand.x, BELFRY.stand.y);
  }

  /** In the arch she climbed in by, a little way into the wall: where her climb down starts. */
  private standInOpening(): THREE.Vector3 {
    return this.cast.village!.belfry.sill('west', -BELFRY.wall * 0.45);
  }

  /** On the west arch's sill, `along` its face from the middle and `inward` from the lip. */
  private sillAt(along: number, inward = 0.16): THREE.Vector3 {
    return this.cast.village!.belfry.sill('west', -inward, along);
  }

  /** Standing by the bell she looks out north over the fog sea, the way the lost boat is. */
  private get outward(): number {
    return Math.PI;
  }

  /** Out of the west arch, over the nave and the boat's berth. */
  private outward2(): number {
    return Math.atan2(WEST.x, WEST.z);
  }

  // The lens.

  /** A skip ahead (QA, a restored save) cuts the lens to where the story is; in play it never cuts. */
  private lensCut = false;
  private readonly eye = new THREE.Vector3();
  private readonly target = new THREE.Vector3();
  private readonly herY = { value: IVY_FOOT.y };
  private zoomNow = 1;
  private leaving = false;
  private readonly goneFrom = new THREE.Vector3();
  private readonly goneAim = new THREE.Vector3();
  private readonly mixFrom = new THREE.Vector3();
  private readonly breath = new THREE.Vector3();
  private readonly mixEye = new THREE.Vector3();
  private readonly mixTarget = new THREE.Vector3();
  private readonly upEyes = new THREE.Vector3();
  private readonly upLens = new THREE.Vector3();
  private readonly upTarget = new THREE.Vector3();
  private readonly held: { primary: THREE.Vector3; primaryRadius?: number; secondary: THREE.Vector3; tertiary?: THREE.Vector3; margin: number; extra: number } = {
    primary: new THREE.Vector3(), secondary: new THREE.Vector3(), margin: tuning.drownedCamera.church.margin, extra: tuning.drownedCamera.church.extra };
  private readonly third = new THREE.Vector3();

  /**
   * Framed for a person, on the ordinary rig, so every change of view is an orbit round her at the rig's own turn and
   * nothing cuts: low off the nave's south-west as the cat comes past her and up the ivy beside her; from low off the
   * west face as she climbs, the cat calling from the arch above her, rising with her; level with the arch as she comes
   * in over the sill, looking in through it at her and the kittens; drawing back to the bell's frame, low outside the
   * arch looking in at her, the kittens and the bell against the sky through the arch opposite, the fog sea beside the
   * tower where the lantern answers; off the north water as she climbs down and the boat comes in under sail; off the
   * boat's starboard quarter as she steps in; and from low behind the boat looking up past her at the cat and the kitten
   * on the sill, held for the blink.
   */
  frame(shot: Shot, dt: number): number {
    const k = tuning.drownedCamera.church;
    const wide = THREE.MathUtils.smoothstep(this.aspect, 0.7, 1.3);
    const c = this.cast.child.position;
    const v = this.cast.village!;
    this.herY.value += (c.y - this.herY.value) * (1 - Math.exp(-dt * 3.5));
    const y = this.herY.value;
    const pick = (a: readonly number[], b: readonly number[]) => this.pick(a, b, wide);
    const held = this.held;
    held.primary.copy(c).setY(c.y + (this.step === 'nest' ? 1.0 : 1.4));
    held.primaryRadius = 0;
    held.margin = k.margin;
    held.extra = k.extra;
    held.tertiary = undefined;
    let view: number[];
    let pace = k.pace;
    let over: number = BELFRY.sill;
    switch (this.step) {
      case 'foot':
        view = pick(k.foot, k.uprightFoot);
        held.secondary.copy(this.catEye);
        over = y;
        break;
      case 'climb':
        view = pick(k.climb, k.uprightClimb);
        held.secondary.copy(this.catAt === 'arch' || this.catEye.y > c.y + 0.5 ? this.catEye : held.primary);
        over = y;
        break;
      case 'nest':
        view = pick(k.nest, k.uprightNest);
        v.kittens.cats[FOUND].eye(held.secondary);
        held.tertiary = this.curlAt();
        pace = k.nestPace;
        held.margin = k.nestMargin;
        held.extra = 0;
        break;
      case 'sea':
        view = pick(k.sea, k.uprightSea);
        held.secondary.copy(this.curlAt());
        pace = k.seaPace;
        break;
      case 'ring':
        view = pick(k.ring, k.uprightRing);
        this.bell.middle(held.secondary);
        held.tertiary = this.curlAt();
        pace = k.seaPace;
        break;
      case 'down':
      case 'wait':
      case 'board':
        view = pick(k.bring, k.uprightBring);
        held.secondary.copy(this.cast.boat.position).setY(this.cast.boat.position.y + 1);
        over = y;
        /** The cat and the kitten coming to the sill to see her off are kept in frame with her and the boat. */
        if (this.catAt === 'sill' && this.step === 'down') held.tertiary = this.cast.cat.eye(this.third);
        /** Room it makes is held for seconds after; the look up that follows wants none. */
        if (this.alongside) held.extra = 0;
        break;
      default:
        return this.upFrame(shot, wide);
    }
    this.eye.set(view[0], view[1] + over, view[2]).add(C);
    this.target.set(view[3], view[4] + over, view[5]).add(C);
    if (this.step === 'ring' && this.rings > 0) {
      const since = this.since - this.answeredAt;
      const find = THREE.MathUtils.smoothstep(since, -0.3, 1.2) * (1 - THREE.MathUtils.smoothstep(since, k.findFor, k.findFor + 2));
      this.target.lerp(this.homeAt, THREE.MathUtils.lerp(k.uprightFind, k.find, wide) * find);
    }
    if (this.step === 'down' || this.step === 'wait' || this.step === 'board') {
      this.target.copy(held.primary).lerp(held.secondary, THREE.MathUtils.lerp(k.uprightBringAlong, k.bringAlong, wide));
    }
    let zoom = (view[6] ?? 1) * THREE.MathUtils.lerp(k.uprightZoom, 1, wide);
    if (this.step === 'wait' || this.step === 'board') {
      /** Once the boat is on its way in alongside, round to the boarding view in one move, so it is there as she steps down into it. */
      const p = this.cast.boat.position;
      if (this.comeRound > 0 || this.alongside || Math.hypot(p.x - NAVE_BERTH.x, p.z - NAVE_BERTH.z) < k.boardFrom) this.comeRound += dt;
      const round = THREE.MathUtils.smootherstep(this.comeRound, 0, k.boardFor);
      zoom *= THREE.MathUtils.lerp(1, k.boardZoom, round);
      if (round > 0) {
        this.eye.lerp(this.boardEye(wide, this.tmp), round);
        const up = this.cast.child.face(this.upEyes).lerp(this.seenOff(this.tmp2), THREE.MathUtils.lerp(k.uprightUpAim, k.upAim, wide));
        this.target.x = THREE.MathUtils.lerp(this.target.x, up.x, round);
        this.target.z = THREE.MathUtils.lerp(this.target.z, up.z, round);
      }
    }
    this.write(shot, this.eye, this.target, zoom);
    return pace;
  }

  /** Lower and tilt up from the boarding composition, then hold the cats' farewell. */
  private upFrame(shot: Shot, wide: number): number {
    const k = tuning.drownedCamera.church, child = this.cast.child, c = child.position, boat = this.cast.boat;
    const lerp = THREE.MathUtils.lerp;
    const eyes = child.face(this.upEyes);
    const pair = this.seenOff(this.held.secondary);
    const lens = this.upEye(wide, this.upLens);
    const up = this.upTarget.copy(eyes).lerp(pair, lerp(k.uprightUpAim, k.upAim, wide));

    const fromEye = this.boardEye(wide, this.tmp);
    const move = this.aboardFor < 0 ? 0 : THREE.MathUtils.smootherstep(this.aboardFor, k.tiltFrom, k.tiltTo);
    this.eye.lerpVectors(fromEye, lens, move);
    const fromY = lerp(c.y + 1.4, boat.position.y + 1, lerp(k.uprightBringAlong, k.bringAlong, wide));
    this.target.copy(up).setY(lerp(fromY, up.y, move));

    let zoom = lerp(k.boardZoom * lerp(k.uprightZoom, 1, wide), lerp(k.uprightUpZoom, k.upZoom, wide), move);
    this.held.primary.copy(c).setY(c.y + 1.4).lerp(eyes, move);
    this.held.primaryRadius = k.upHeadRadius * move;
    this.held.secondary.lerpVectors(this.tmp.copy(boat.position).setY(boat.position.y + 1), pair, move);
    this.held.tertiary = this.third.copy(this.held.secondary).lerp(this.cast.village!.kittens.cats[FOUND].eye(this.tmp), move);
    this.held.extra = 0;
    this.held.margin = lerp(k.margin, k.upMargin, move);
    const release = this.aboardFor < 0 ? 0 : THREE.MathUtils.smootherstep(this.aboardFor, k.releaseFrom, k.releaseTo);
    if (release > 0) {
      const back = THREE.MathUtils.smootherstep(release, 0, 0.65), across = THREE.MathUtils.smootherstep(release, 0.35, 1);
      this.eye.copy(this.releaseEye(wide, this.tmp, back, across));
      this.target.lerp(this.releaseAim(wide, this.tmp), release);
      zoom = lerp(zoom, k.releaseZoom, release);
    }
    this.write(shot, this.eye, this.target, zoom);
    return k.upPace;
  }

  /**
   * Where the look up stands: behind her on the line from the sill down through her, turned toward the boat's starboard
   * so she keeps a lower corner and the sill the upper third, and low over the water.
   */
  private upEye(wide: number, out: THREE.Vector3): THREE.Vector3 {
    const k = tuning.drownedCamera.church, lerp = THREE.MathUtils.lerp;
    const bearing = this.shoulderBearing(wide);
    const eyes = this.cast.child.face(this.tmp2);
    const back = lerp(k.uprightUpBack, k.upBack, wide);
    return out.set(eyes.x + Math.sin(bearing) * back, eyes.y + lerp(k.uprightUpOver, k.upOver, wide), eyes.z + Math.cos(bearing) * back);
  }

  /**
   * Where the look up lets her go to as the two go back in: back and a little higher, round toward the bow, where the
   * tower and the lighthouse both stand beyond her for the storm's lens to take her from.
   */
  private releaseEye(wide: number, out: THREE.Vector3, back = 1, across = 1): THREE.Vector3 {
    const k = tuning.drownedCamera.church, lerp = THREE.MathUtils.lerp, eyes = this.cast.child.face(out), yaw = NAVE_BERTH.yaw;
    const from = this.shoulderBearing(wide), bow = Math.atan2(Math.sin(yaw), Math.cos(yaw));
    const a = from + Math.sign(Math.sin(bow - from)) * lerp(k.uprightReleaseRound, k.releaseRound, wide) * across;
    const r = lerp(lerp(k.uprightUpBack, k.upBack, wide), lerp(k.uprightReleaseBack, k.releaseBack, wide), back);
    const up = lerp(lerp(k.uprightUpOver, k.upOver, wide), lerp(k.uprightReleaseUp, k.releaseUp, wide), back);
    return eyes.set(eyes.x + Math.sin(a) * r, eyes.y + up, eyes.z + Math.cos(a) * r);
  }

  /** Looking this share of the way from her up to the sill the cat goes home from. */
  private releaseAim(wide: number, out: THREE.Vector3): THREE.Vector3 {
    const k = tuning.drownedCamera.church;
    return this.cast.child.face(out).lerp(this.sillAt(SEE_OFF), THREE.MathUtils.lerp(k.uprightReleaseLook, k.releaseLook, wide));
  }

  /** Between the cat's eyes and the kitten's as they sit on the sill to see her off. */
  private seenOff(out: THREE.Vector3): THREE.Vector3 {
    return out.copy(this.sillAt(SEE_OFF)).lerp(this.sillAt(KITTEN_OFF), 0.35).setY(BELFRY.sill + tuning.drownedCamera.church.catEyes);
  }

  /** Cuts the lens makes on a skip ahead, for the rig. */
  cut = 0;

  /**
   * Casting off, one move from where the look up lets her go, round her and down to the storm's view along the water
   * with the lighthouse beyond her, so the boat never sails up to the lens and the lens never looks up into the fog.
   */
  departure(shot: Shot, time: number): void {
    if (this.aboardFor < 0) return;
    const away = THREE.MathUtils.smootherstep(this.aboardFor - tuning.drowned.church.lookUpFor, 0, tuning.storm.leaveFor);
    if (away >= 1) return;
    const head = this.cast.child.position;
    if (!this.leaving) {
      /** From where the look up lets go to, which the eased lens is still on its way to. */
      this.leaving = true;
      const wide = THREE.MathUtils.smoothstep(this.aspect, 0.7, 1.3);
      this.goneFrom.copy(this.releaseEye(wide, this.goneFrom)).sub(head);
      this.goneAim.copy(this.releaseAim(wide, this.goneAim)).sub(head);
      this.zoomNow = tuning.drownedCamera.church.releaseZoom;
    }
    const from = this.mixFrom.addVectors(head, this.goneFrom);
    const to = this.tmp.copy(shot.target).addScaledVector(shot.from!, shot.distance).setY(shot.target.y + shot.height);
    const a0 = Math.atan2(from.x - head.x, from.z - head.z), a1 = Math.atan2(to.x - head.x, to.z - head.z);
    const r = THREE.MathUtils.lerp(Math.hypot(from.x - head.x, from.z - head.z), Math.hypot(to.x - head.x, to.z - head.z), away);
    const a = a0 + Math.atan2(Math.sin(a1 - a0), Math.cos(a1 - a0)) * away;
    this.mixEye.set(head.x + Math.sin(a) * r, THREE.MathUtils.lerp(from.y, to.y, away), head.z + Math.cos(a) * r);
    this.mixEye.addScaledVector(breathe(time, this.mixEye.distanceTo(shot.target), this.breath), away);
    this.mixTarget.addVectors(head, this.goneAim).lerp(shot.target, away);
    this.held.primary.copy(head).setY(head.y + 1.1);
    this.held.primaryRadius = 0;
    this.held.secondary.copy(this.held.primary);
    this.held.tertiary = undefined;
    this.write(shot, this.mixEye, this.mixTarget, THREE.MathUtils.lerp(this.zoomNow, shot.zoom ?? 1, away));
  }

  /**
   * Behind her, away from the cat on the sill, turned toward the boat's starboard, so the mast just forward of her and
   * the sail hanging off it stand to the side of the frame.
   */
  private shoulderBearing(wide: number): number {
    const k = tuning.drownedCamera.church, c = this.cast.child.position, yaw = NAVE_BERTH.yaw;
    const pair = this.seenOff(this.tmp2);
    const away = Math.atan2(c.x - pair.x, c.z - pair.z);
    const starboard = Math.atan2(-Math.cos(yaw), Math.sin(yaw));
    return away + Math.sign(Math.sin(starboard - away)) * THREE.MathUtils.lerp(k.uprightUpRound, k.upRound, wide);
  }

  private comeRound = 0;

  /** The boat lies at the berth for her to step down into. */
  private get alongside(): boolean {
    return this.step === 'board' || (this.step === 'wait' && this.cast.boat.grounded);
  }

  /** Boarding and the look up share a bearing so the lens never reverses around her. */
  private boardEye(wide: number, out: THREE.Vector3): THREE.Vector3 {
    return this.upEye(wide, out).setY(this.herY.value + tuning.drownedCamera.church.boardHigh);
  }

  private pick(a: readonly number[], b: readonly number[], wide: number): number[] {
    return a.map((x, i) => THREE.MathUtils.lerp(b[i], x, wide));
  }

  private write(shot: Shot, eye: THREE.Vector3, target: THREE.Vector3, zoom: number): void {
    if (this.lensCut) {
      this.lensCut = false;
      this.cut++;
    }
    if (!this.leaving) this.zoomNow = zoom;
    shot.subjects = this.held;
    shot.attention = undefined;
    shot.obstacles = undefined;
    shot.smoothFit = undefined;
    shot.orbit = true;
    shot.fitWidth = false;
    shot.free = false;
    shot.exact = false;
    shot.eye = (shot.eye ?? new THREE.Vector3()).copy(eye);
    shot.target.copy(target);
    shot.from = (shot.from ?? new THREE.Vector3()).set(eye.x - target.x, 0, eye.z - target.z).normalize();
    shot.distance = Math.hypot(eye.x - target.x, eye.z - target.z);
    shot.height = eye.y - target.y;
    shot.zoom = zoom;
    shot.carry = false;
    shot.clearance = this.step === 'aboard' ? tuning.drownedCamera.church.upClear : undefined;
  }
}
