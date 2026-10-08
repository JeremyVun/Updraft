import * as THREE from 'three';
import type { Shot } from '../camera';
import { tuning } from '../tuning';
import { atmo } from '../world/atmosphere';
import { BELFRY, faceOut } from '../world/belfry';
import { BELL_SOUNDS, Bell } from '../world/crossings/bell';
import type { Deck } from '../world/decks';
import { LanternGlow } from '../world/lantern-glow';
import { LIGHTHOUSE } from '../world/drowned';
import { LIGHTHOUSE_LANTERN_Y } from '../world/lighthouse';
import {
  BRING_WAY, DARK_END, HOME_WAY, IVY_FOOT, IVY_STEP, NAVE, NAVE_BERTH, NAVE_NORTH, TOWER, roofUnder,
} from '../world/drowned-way';
import { Climb } from '../traveller/climb';
import type { Cast } from './cast';

/**
 * `foot` her at the tower's foot as the cat runs up the ivy; `climb` her going up after it; `nest` kneeling in the
 * opening over the kittens; `sea` standing in it looking out over the fog sea; `ring` the bell hers to ring, the lost
 * boat's lantern answering out in the fog; `down` her climbing down to it as the player sails it the last stretch;
 * `wait` on the slates for it; `board` stepping down into it; `aboard` looking back up at the cat on the sill.
 */
type Step = 'foot' | 'climb' | 'nest' | 'sea' | 'ring' | 'down' | 'wait' | 'board' | 'aboard';

const C = new THREE.Vector3(TOWER.x, 0, TOWER.z);
const WEST = faceOut('west');
/** The light she climbs in by: the west face's north light. */
const LIGHT: -1 | 1 = -1;
/** The cat curls with the open side of its ring, where the kittens lie, toward the opening she comes in by. */
const CURL_YAW = -2.21;
/** The kitten that comes to her, and later to the sill with its mother. */
const FOUND = 0;
const WAY_HOME = [...HOME_WAY, ...BRING_WAY];
/** Where she looks out over the fog sea from the opening: north, over the water the boat will come home across. */
const OUT_OVER = new THREE.Vector3(-4, 2, -40);
/** The lighthouse's lamp, which goes out as they leave. */
const LAMP = new THREE.Vector3(LIGHTHOUSE.x, LIGHTHOUSE_LANTERN_Y, LIGHTHOUSE.z);
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
 * The church, from her reaching the tower's foot to her aboard her boat again. The cat runs up the tower's ivy into
 * the belfry and she follows it, climbing; inside are its kittens, and the cat curls round them. The fog closes round
 * the tower below them and stops just under the sills: the village a cold white sea in the last light. The bell is
 * the player's to ring; each ring rolls out over the fog and pushes it down a little, and out in it the lost boat's
 * lantern answers, nearer each time, until the fog has drawn back to the water and the player sails the boat the last
 * stretch round the tower to the nave. She climbs down and steps aboard; the cat comes to the sill with a kitten and
 * looks down at her, she looks up, and it gives her a slow blink. Then the fog closes round and darkens into the storm.
 */
export class ChurchArrival {
  step: Step | 'off' = 'off';
  /** How far the fog has closed round her for the storm, 0 to 1. */
  close = 0;
  /** True once the boat has gone `valve` seconds without coming nearer under sail: the world's air carries it. */
  carrying = false;
  /** Seconds since she was seated aboard (-1 before). */
  aboardFor = -1;
  /** How far round on the thwart she has turned from the bow to look back up, radians. */
  seatTurn = 0;
  /** The rings, how many of them the boat has answered, and how far along its way home it has come, metres. */
  rings = 0;
  answered = 0;
  home = 0;
  readonly bell: Bell;
  readonly climb: Climb;
  private readonly glow = new LanternGlow();
  private t = 0;
  private since = 0;
  private leg = 0;
  private best = Infinity;
  private stall = 0;
  private sinkFrom = 0;
  private sinkAt = -Infinity;
  private homeWant = 0;
  private readonly homeSpeed = new THREE.Vector3();
  private readonly homeAt = new THREE.Vector3();
  private answeredAt = -Infinity;
  private sailing = false;
  private blinked = false;
  private catAtSill = false;
  private catStarted = false;
  private firstAnswer = -Infinity;
  /** Leaning down to the kitten that has come to her. */
  private leaning = false;
  private readonly homeGlide = new THREE.Vector3();
  private camera: THREE.PerspectiveCamera | null = null;
  private aspect = 16 / 9;
  private readonly head = new THREE.Vector3();
  private readonly look = new THREE.Vector3();
  private readonly catEye = new THREE.Vector3();
  private readonly tmp = new THREE.Vector3();
  private readonly flat = new THREE.Vector2();
  private readonly inviteAt = new THREE.Vector3();
  private readonly inviteDir = new THREE.Vector3();
  private readonly down = new THREE.Vector3();
  private readonly timers: { at: number; go: () => void }[] = [];
  /** Her floor up there: the sill of the light she climbs in by and the boards inside. */
  private readonly upDecks: Deck[];

  constructor(private readonly cast: Cast) {
    const v = cast.village!;
    const crossingCast = { child: cast.child, wind: cast.wind, lines: cast.lines, input: cast.input };
    this.bell = new Bell({ pivot: v.belfry.pivot(), toward: new THREE.Vector2(0, 1), half: BELFRY.trestle }, crossingCast, v.belfry.light);
    this.bell.onEvent = (kind, at, strength) => cast.knock?.(BELL_SOUNDS[kind], at, strength);
    this.bell.onRing = (strength) => this.rang(strength);
    this.bell.live = false;
    v.belfry.group.add(...this.bell.objects, this.glow.mesh);
    this.climb = new Climb(cast.child, { wall: IVY_FOOT, out: WEST, holds: v.ivy.holds, sill: v.belfry.sill('west', LIGHT, 0), depth: BELFRY.wall });
    const a = v.belfry.sill('west', LIGHT, 0.05), b = v.belfry.sill('west', LIGHT, -BELFRY.wall - 0.08);
    this.upDecks = [{ x0: a.x, z0: a.z, x1: b.x, z1: b.z, halfWidth: BELFRY.light.width / 2 - 0.06, height: BELFRY.sill }, ...v.belfry.decks];
  }

  /** She has reached the tower's foot, the cat sitting on the churchyard's railings below the tower's south face. */
  begin(): void {
    const { child: c, cat } = this.cast;
    const dark = this.cast.village!.dark;
    this.to('foot');
    this.since = 0;
    dark.faces = null;
    c.decks = [...c.decks, IVY_STEP, NAVE_NORTH, ...this.upDecks];
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

  /** QA and the save in the belfry: her standing in the opening over the fog sea, the cat curled round its kittens. */
  skipToBelfry(): void {
    const { child: c } = this.cast;
    const k = tuning.drowned.church;
    const dark = this.cast.village!.dark;
    if (this.step === 'off') this.begin();
    this.timers.length = 0;
    this.climb.stop();
    this.curl();
    this.catStarted = true;
    dark.front = DARK_END + k.fog.past;
    dark.level = k.fog.sea;
    this.since = 1e3;
    this.hidePlane();
    const stand = this.standInOpening();
    c.standUp();
    c.place(stand.x, stand.z, this.outward);
    c.position.y = BELFRY.sill;
    this.placeBoatAway();
    this.to('sea');
    this.t = k.seaFor - 1.5;
    this.lensCut = true;
    this.bound = true;
  }

  /** QA: on to her just seated aboard at the berth, the cat on the sill above and the fog drawn back to the water. */
  skipToAboard(): void {
    const { boat, child: c, cat } = this.cast;
    const k = tuning.drowned.church;
    this.skipToBelfry();
    this.rings = this.answered = k.rings;
    this.home = this.homeWant = HOME_LENGTH;
    this.cast.village!.dark.level = k.fog.drawn;
    cat.place(this.catSill(), this.outward, { pose: 'sit', floor: () => BELFRY.sill });
    this.cast.village!.kittens.cats[FOUND].place(this.kittenSill(), this.outward, { pose: 'sit', floor: () => BELFRY.sill });
    this.catAtSill = true;
    boat.towed = false;
    boat.beach(NAVE_BERTH.x, NAVE_BERTH.z, NAVE_BERTH.yaw);
    boat.takeWeight(0);
    boat.finishBoarding();
    c.ride(boat.seat(this.tmp), boat.yaw, boat);
    this.showPlane();
    this.to('aboard');
    this.aboardFor = 0;
    this.lensCut = true;
  }

  /** The sail is the player's while the boat is to be brought. */
  get invitesSail(): boolean {
    return this.sailing && !this.cast.boat.grounded;
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
    return this.inviteAt.copy(at).addScaledVector(toward, Math.min(at.distanceTo(this.camera.position) * 0.5, 2.9));
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
        if (this.catStarted && (this.catEye.y > IVY_FOOT.y + k.followAt || this.t > k.followAfter)) this.follow();
        break;
      case 'nest':
        c.lookAt = v.kittens.cats[FOUND].eye(this.look);
        c.lean = this.leaning ? k.leanTo : 0;
        if (this.t > k.nestFor) {
          c.kneeling = 0;
          this.leaning = false;
          this.to('sea');
        }
        break;
      case 'sea':
        if (this.t > 0.6) c.yaw += Math.atan2(Math.sin(this.outward - c.yaw), Math.cos(this.outward - c.yaw)) * (1 - Math.exp(-dt * 2));
        c.lookAt = this.look.copy(C).add(OUT_OVER);
        if (this.t > k.seaFor) {
          this.placeBoatAway();
          this.to('ring');
        }
        break;
      case 'ring':
        c.lookAt = this.rings > 0 ? this.look.copy(this.homeAt) : this.look.copy(C).add(OUT_OVER);
        if (this.answered >= k.rings && this.since - this.answeredAt > k.answerFor) this.goDown();
        break;
      case 'down':
        c.lookAt = null;
        break;
      case 'wait':
        this.waiting();
        break;
      case 'aboard':
        this.aboardFor += dt;
        this.lookUp(dt);
        break;
      default:
        break;
    }
    if (this.step === 'down' || this.step === 'wait' || this.step === 'board' || this.step === 'aboard') this.catToSill();
    this.inRoom();
    this.boatHome(dt);
    this.fog(dt);
  }

  /**
   * The cat, seeing her at the tower's foot, goes: off the railings in one leap onto the nave's slates beside her at
   * the foot of the ivy and up it, in over the sill of the light she will climb in by, down onto the boards and across
   * to the straw where its kittens are, and round them.
   */
  private catUp(): void {
    const { cat } = this.cast;
    const v = this.cast.village!;
    this.catStarted = true;
    cat.unease = 0.3;
    const onto = new THREE.Vector3(IVY_FOOT.x - 0.25, 0, TOWER.z + 0.4);
    onto.y = roofUnder(NAVE, onto.x, onto.z) ?? IVY_FOOT.y;
    const ledge = v.belfry.sill('west', LIGHT, -0.24).add(this.tmp.set(0, 0, 0.25));
    const floor = () => v.belfry.floor;
    cat.leap(onto, { then: 'stand', arc: 0.5, gather: 0.2, floor: (x, z) => roofUnder(NAVE, x, z) ?? onto.y }, () => {
      cat.climb([...v.ivy.catWay(), ledge], WEST, { then: 'stand', speed: tuning.drowned.church.catClimb, gather: 0.1 }, () => {
        const down = v.belfry.inside('west', LIGHT, 0.3).add(this.tmp.set(0, 0, 0.3));
        cat.hop(down, { then: 'stand', floor }, () => {
          const at = this.curlAt();
          const before = at.clone().add(new THREE.Vector3(-Math.sin(CURL_YAW), 0, -Math.cos(CURL_YAW)).multiplyScalar(0.35));
          cat.run([before, at], floor, { pace: 'walk', speed: 0.8, then: 'stand' }, () => {
            cat.chirrup();
            cat.unease = 0;
            cat.rest('curl', null);
            this.later(1.2, () => v.kittens.nestle(cat));
          });
        });
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
      this.climb.up(() => this.arrive());
    }, 0.08);
  }

  /**
   * In over the sill, she kneels in the opening and looks down at the straw just inside: the kittens, and the cat
   * round them. One of them lifts its head and mews at her, gets up and comes to the edge of the straw nearest her,
   * sits looking up at her and mews again; she leans down to it.
   */
  private arrive(): void {
    const { child: c } = this.cast;
    const v = this.cast.village!;
    const k = tuning.drowned.church;
    const kitten = v.kittens.cats[FOUND];
    this.to('nest');
    c.faceToward(v.kittens.centre.x, v.kittens.centre.z, 1);
    c.kneeling = 1;
    this.later(k.kittenLooks, () => {
      kitten.look(this.head);
      kitten.mew(0.35);
    });
    this.later(k.kittenComes, () => {
      const to = v.belfry.inside('west', LIGHT, 0.12).add(this.tmp.set(0, 0, k.kittenAside));
      kitten.run([to], () => v.belfry.floor + 0.03, { pace: 'walk', speed: 0.45, then: 'sit', look: this.head }, () => {
        kitten.mew(0.5);
        this.leaning = true;
      });
    });
  }

  /**
   * Each ring rolls out over the fog's top and pushes it down a step, and out in the fog the boat's lantern answers,
   * a stretch nearer than the last time.
   */
  private rang(strength: number): void {
    const k = tuning.drowned.church;
    const v = this.cast.village!;
    v.bellWaves.level = Math.max(0.15, v.dark.level * k.fog.wavesAt);
    v.bellWaves.emit(strength);
    if (this.step !== 'ring' || this.rings >= k.rings) return;
    this.rings++;
    this.sinkFrom = v.dark.level;
    this.sinkAt = this.since;
    this.later(k.answerAfter, () => {
      this.answeredAt = this.since;
      if (this.answered === 0) this.firstAnswer = this.since;
      this.homeWant = HOME_LENGTH * k.answers[this.answered++];
    });
  }

  /** The bell has called it in: she turns back into the opening and climbs down to meet it, and the boat is the player's to sail. */
  private goDown(): void {
    const { child: c, cat, boat } = this.cast;
    const v = this.cast.village!;
    const k = tuning.drowned.church;
    this.to('down');
    c.kneeling = 0;
    c.lookAt = null;
    c.yaw = this.climb.facing;
    this.later(0.5, () => this.climb.down(() => {
      c.lookAt = null;
      this.to('wait');
      c.walkTo(NAVE_NORTH.x0, NAVE_NORTH.z0, false, () => c.walkTo(NAVE_NORTH.x1, NAVE_NORTH.z1, false, () => c.stop(), 0.12), 0.15);
    }));
    this.later(k.catUpAfter, () => {
      cat.rest('stand', this.head);
      const inside = v.belfry.inside('west', LIGHT, 0.25);
      cat.run([inside], () => v.belfry.floor, { pace: 'walk', speed: 0.9, then: 'stand' }, () => {
        cat.hop(this.catSill(), { then: 'sit', look: this.head, floor: () => BELFRY.sill }, () => {
          this.catAtSill = true;
          cat.mew(0.5);
        });
      });
      this.later(1.4, () => v.kittens.toSill(FOUND, this.kittenSill(), this.head));
    });
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

  /** The boat under sail to the berth: round the tower's corner, alongside, and her stepping down into it once it lies there. */
  private waiting(): void {
    const { boat, child: c } = this.cast;
    const k = tuning.drowned.church;
    c.lookAt = this.look.copy(boat.position).setY(boat.position.y + 0.8);
    if (!c.busy) c.faceToward(boat.position.x, boat.position.z, 0.05);
    const p = boat.position;
    const berthed = boat.grounded && Math.hypot(p.x - NAVE_BERTH.x, p.z - NAVE_BERTH.z) < k.berthed;
    if (berthed && !c.busy) this.board();
  }

  private sail(dt: number): void {
    const { boat } = this.cast;
    const k = tuning.drowned.church;
    const p = boat.position;
    if (this.leg < BRING_WAY.length - 1 && Math.hypot(p.x - BRING_WAY[this.leg].x, p.z - BRING_WAY[this.leg].y) < k.rounded) {
      this.leg++;
      boat.steerFor = BRING_WAY[this.leg];
      if (this.leg === BRING_WAY.length - 1) boat.mooring = { ...NAVE_BERTH };
    }
    let left = Math.hypot(p.x - BRING_WAY[this.leg].x, p.z - BRING_WAY[this.leg].y);
    for (let i = this.leg + 1; i < BRING_WAY.length; i++) left += BRING_WAY[i].distanceTo(BRING_WAY[i - 1]);
    if (left < this.best - 0.5) {
      this.best = left;
      this.stall = 0;
    } else this.stall += dt;
    if (this.stall > k.valve) this.carrying = true;
  }

  /** She steps down off the slates into the boat, which dips and rocks under her as it takes her weight. */
  private board(): void {
    const { boat, child: c } = this.cast;
    this.to('board');
    this.carrying = false;
    this.sailing = false;
    boat.mooring = null;
    boat.steerFor = null;
    boat.speed = 0;
    c.faceToward(boat.position.x, boat.position.z, 1);
    c.board(boat, () => {
      this.showPlane();
      this.to('aboard');
      this.aboardFor = 0;
    }, true);
  }

  /**
   * Seated, she turns round on the thwart to look back up at the cat and its kitten on the sill, the way that keeps
   * her face from the lens; the cat looks down at her and gives her a slow blink.
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
    cat.look(this.head);
    if (!this.blinked && this.aboardFor > k.blinkAt) {
      this.blinked = true;
      cat.slowBlink();
    }
  }

  /**
   * In the opening and over the sill she is in the belfry's light as the nest is: the sky only through the openings,
   * the low sun only as it comes in at the light she stands in.
   */
  private inRoom(): void {
    const c = this.cast.child;
    const into = c.position.x - (TOWER.x - TOWER.half);
    const up = THREE.MathUtils.smoothstep(c.position.y, BELFRY.sill - 0.6, BELFRY.sill - 0.1);
    const sun = atmo.uniforms.uSunDir.value;
    c.room.set(up * THREE.MathUtils.smoothstep(into, -0.1, BELFRY.wall), THREE.MathUtils.clamp(-sun.x * 1.2, 0, 1) * 0.7);
  }

  /** The cat up from its kittens to the sill as she goes down, a kitten after it, to watch her go. */
  private catToSill(): void {
    if (!this.catAtSill) return;
    this.cast.cat.look(this.head);
  }

  /**
   * The lost boat's way home: out of sight in the fog until the first ring, then a stretch nearer after each, its
   * lantern's light swelling in the fog as it answers and settling to a steady glow; once the sail is the player's it
   * goes by the wind.
   */
  private boatHome(dt: number): void {
    const { boat } = this.cast;
    const k = tuning.drowned.church;
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
    if (this.sailing) this.sail(dt);
    const lantern = atmo.uniforms.uLantern.value;
    this.homeAt.set(lantern.x, lantern.y, lantern.z);
    const level = this.cast.village!.dark.level;
    const under = THREE.MathUtils.smoothstep(level - lantern.y, -0.6, 1.4);
    const since = this.since - this.answeredAt;
    const swell = since >= 0 ? Math.exp(-since / k.answerGlow) * THREE.MathUtils.smoothstep(since, 0, 0.5) : 0;
    const shown = this.firstAnswer > -Infinity ? THREE.MathUtils.smoothstep(this.since - this.firstAnswer, 0, 1.5) : 0;
    const far = this.camera ? this.camera.position.distanceTo(this.homeAt) : 30;
    this.glow.show(this.homeAt, k.glowSize * THREE.MathUtils.clamp(far / 30, 0.4, 2), (shown * k.glow + k.glowSwell * swell) * under);
  }

  /**
   * The fog: while she is low on the ivy it waits a little back along the nave; as she climbs it comes on, reaching
   * the tower as she reaches the sill, and on round the tower until it has stopped well past it, its top just under the
   * sills. Each ring pushes it down a step until it lies on the water. Once she is aboard it closes round and darkens
   * into the storm's night.
   */
  private fog(dt: number): void {
    const k = tuning.drowned.church.fog;
    const dark = this.cast.village!.dark;
    const c = this.cast.child;
    if (this.step === 'foot' || this.step === 'climb' || this.step === 'nest' || this.step === 'sea') {
      const up = THREE.MathUtils.smoothstep(c.position.y, IVY_FOOT.y + 0.5, BELFRY.sill);
      const want = this.step === 'foot' || this.step === 'climb' ? DARK_END - THREE.MathUtils.lerp(k.behind, 0, up) : DARK_END + k.past;
      const pull = THREE.MathUtils.clamp((want - dark.front) * k.pull, 0, k.fastest);
      dark.front = Math.min(dark.front + pull * dt, DARK_END + k.past);
      dark.level += (k.sea - dark.level) * (1 - Math.exp(-dt * 0.25));
      return;
    }
    if (this.step === 'ring' || this.step === 'down' || this.step === 'wait' || this.step === 'board') {
      const want = THREE.MathUtils.lerp(k.sea, k.drawn, this.rings / tuning.drowned.church.rings);
      dark.level = THREE.MathUtils.lerp(this.sinkFrom || dark.level, want, THREE.MathUtils.smootherstep(this.since - this.sinkAt, 0, k.sinkFor));
      return;
    }
    if (this.step === 'aboard') {
      /** Evenly: the night it brings already eases in and out of itself. */
      this.close = THREE.MathUtils.clamp((this.aboardFor - k.closeAfter) / k.closeFor, 0, 1);
      dark.close = this.close;
      dark.level = THREE.MathUtils.lerp(k.drawn, k.closedLevel, this.close);
    }
  }

  /** Away in the fog off the tower's east side, where it will first answer the bell from. */
  private placeBoatAway(): void {
    const { boat } = this.cast;
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

  /** Where the cat lies so that the hollow of its curl is round the kittens' heap in the middle of the straw. */
  private curlAt(): THREE.Vector3 {
    const v = this.cast.village!;
    const fx = Math.sin(CURL_YAW), fz = Math.cos(CURL_YAW), s = this.cast.cat.scale;
    return v.belfry.nest().setY(v.belfry.floor + 0.03).add(new THREE.Vector3(-fz * 0.1 * s - fx * 0.01 * s, 0, fx * 0.1 * s - fz * 0.01 * s));
  }

  private curl(): void {
    const { cat } = this.cast;
    const v = this.cast.village!;
    const at = this.curlAt();
    cat.unease = 0;
    cat.place(at, CURL_YAW, { pose: 'curl', floor: () => at.y });
    cat.look(null);
    v.kittens.nestle(cat);
  }

  /** On the sill in the opening she climbed in by, a little way into the wall. */
  private standInOpening(): THREE.Vector3 {
    return this.cast.village!.belfry.sill('west', LIGHT, -BELFRY.wall * 0.45);
  }

  /** The cat sits in the reveal she climbed out of, a little to one side, and the kitten beside it. */
  private catSill(): THREE.Vector3 {
    return this.cast.village!.belfry.sill('west', LIGHT, -0.18).add(new THREE.Vector3(0, 0, 0.2));
  }

  private kittenSill(): THREE.Vector3 {
    return this.cast.village!.belfry.sill('west', LIGHT, -0.2).add(new THREE.Vector3(0, 0, -0.24));
  }

  /** Standing in the opening she faces out and round to the north, over the open water the boat comes home across. */
  private get outward(): number {
    return Math.atan2(WEST.x, WEST.z) - tuning.drowned.church.lookRound;
  }

  // The lens.

  /** How the lens starts: from wherever the run left it, or cut straight to its view (a skip ahead). */
  private lensCut = false;
  private bound = false;
  private inside = false;
  private dtNow = 0;
  private readonly eye = new THREE.Vector3();
  private readonly target = new THREE.Vector3();
  private readonly eyeNow = new THREE.Vector3();
  private readonly orbitNow = new THREE.Vector3();
  private readonly orbitWant = new THREE.Vector3();
  private readonly targetNow = new THREE.Vector3();
  private readonly eyeSpeed = new THREE.Vector3();
  private readonly targetSpeed = new THREE.Vector3();
  private readonly herY = { value: IVY_FOOT.y };
  private zoomNow = 1;
  private leaving = false;
  private readonly goneFrom = new THREE.Vector3();
  private readonly goneAim = new THREE.Vector3();
  private readonly mixFrom = new THREE.Vector3();
  private readonly dirHer = new THREE.Vector3();
  private readonly dirLamp = new THREE.Vector3();
  private readonly mixEye = new THREE.Vector3();
  private readonly mixTarget = new THREE.Vector3();

  /**
   * Framed for a person, borrowed from the bell's yard: off the nave's south side as the cat runs up past her; from
   * the north of the face as she climbs, rising with her, her profile and the fog coming on below; inside, low by the
   * straw, for the kittens she has found; out west over the fog sea while she stands looking at it; out beside the
   * tower while the bell is hers to ring, the bell, her in the other light and the fog sea where the lantern answers in
   * one frame; low off the north water as the boat comes in and she climbs down to it; and from beside the boat, low,
   * up at the cat on the sill. It glides round the tower, never through it, and cuts only into and out of the belfry.
   */
  frame(shot: Shot, dt: number): number {
    const k = tuning.drownedCamera.church;
    const wide = THREE.MathUtils.smoothstep(this.aspect, 0.7, 1.3);
    const c = this.cast.child.position;
    this.dtNow = dt;
    this.herY.value += (c.y - this.herY.value) * (1 - Math.exp(-dt * 3.5));
    const y = this.herY.value;
    const S = BELFRY.sill;
    const pick = (a: readonly number[], b: readonly number[]) => a.map((x, i) => THREE.MathUtils.lerp(b[i], x, wide));
    let view: number[];
    let inside = false;
    switch (this.step) {
      case 'foot':
      case 'climb':
        view = pick(k.climb, k.uprightClimb);
        break;
      case 'nest':
        view = pick(k.nest, k.uprightNest);
        inside = true;
        break;
      case 'sea':
        view = pick(k.sea, k.uprightSea);
        break;
      case 'ring':
        view = pick(k.ring, k.uprightRing);
        break;
      case 'down':
      case 'wait':
      case 'board':
        view = pick(k.bring, k.uprightBring);
        break;
      default:
        view = pick(k.up, k.uprightUp);
    }
    const over = this.step === 'foot' || this.step === 'climb' ? y : S;
    view[1] += over;
    view[4] += over;
    this.eye.set(view[0], view[1], view[2]);
    this.target.set(view[3], view[4], view[5]).add(C);
    if (this.step === 'ring' && this.rings > 0) {
      const since = this.since - this.answeredAt;
      const find = THREE.MathUtils.smoothstep(since, -0.3, 1.2) * (1 - THREE.MathUtils.smoothstep(since, k.findFor, k.findFor + 2));
      this.target.lerp(this.homeAt, k.find * find);
    }
    if (inside !== this.inside) this.lensCut = true;
    this.inside = inside;
    const want = this.orbitWant.set(Math.atan2(this.eye.z, this.eye.x), Math.hypot(this.eye.x, this.eye.z), this.eye.y);
    if (!this.bound && !this.lensCut && this.camera) {
      const e = this.camera.position;
      this.orbitNow.set(Math.atan2(e.z - C.z, e.x - C.x), Math.hypot(e.x - C.x, e.z - C.z), e.y);
      this.targetNow.copy(shot.target);
      this.eyeSpeed.set(0, 0, 0);
      this.targetSpeed.set(0, 0, 0);
    } else if (this.lensCut) {
      this.orbitNow.copy(want);
      this.targetNow.copy(this.target);
      this.eyeSpeed.set(0, 0, 0);
      this.targetSpeed.set(0, 0, 0);
      this.lensCut = false;
      this.cut++;
    } else {
      want.x = this.orbitNow.x + Math.atan2(Math.sin(want.x - this.orbitNow.x), Math.cos(want.x - this.orbitNow.x));
      const time = this.step === 'foot' ? k.glide * 1.6 : k.glide;
      glide(this.orbitNow, this.eyeSpeed, want, time, this.dtNow);
      glide(this.targetNow, this.targetSpeed, this.target, time * 0.8, this.dtNow);
    }
    this.bound = true;
    const o = this.orbitNow;
    this.eyeNow.set(C.x + Math.cos(o.x) * o.y, o.z, C.z + Math.sin(o.x) * o.y);
    const zoomWant = (view[6] ?? 1) * THREE.MathUtils.lerp(k.uprightZoom, 1, wide);
    this.zoomNow += (zoomWant - this.zoomNow) * (1 - Math.exp(-dt / k.glide));
    this.write(shot, this.eyeNow, this.targetNow, this.zoomNow);
    return k.pace;
  }

  /** Cuts the lens makes into and out of the belfry, for the rig. */
  cut = 0;

  /**
   * Leaving the nave, the lens goes with her from where it stood for the look up, so the boat never sails up to it;
   * as the lighthouse's light falters it looks across to between her and the lamp, so the light she leaves stands
   * beside her as it goes;
   * once the light is out it gives the storm its own frame, going round her from the one eye to the other.
   */
  departure(shot: Shot, dt: number): void {
    if (this.aboardFor < 0) return;
    const k = tuning.drownedCamera.church;
    const t = this.aboardFor - tuning.drowned.church.lookUpFor;
    const away = THREE.MathUtils.smoothstep(t, k.leaveFrom, k.leaveFrom + k.leaveFor);
    if (away >= 1) return;
    const head = this.cast.child.position;
    if (!this.leaving) {
      this.leaving = true;
      this.goneFrom.subVectors(this.eyeNow, head);
      this.goneAim.subVectors(this.targetNow, head);
    }
    const light = THREE.MathUtils.smootherstep(t, k.lampFrom, k.lampTo) * k.lampAim;
    const from = this.mixFrom.addVectors(head, this.goneFrom);
    const to = this.tmp.copy(shot.target).addScaledVector(shot.from!, shot.distance).setY(shot.target.y + shot.height);
    const a0 = Math.atan2(from.x - head.x, from.z - head.z), a1 = Math.atan2(to.x - head.x, to.z - head.z);
    const r = THREE.MathUtils.lerp(Math.hypot(from.x - head.x, from.z - head.z), Math.hypot(to.x - head.x, to.z - head.z), away);
    const a = a0 + Math.atan2(Math.sin(a1 - a0), Math.cos(a1 - a0)) * away;
    this.mixEye.set(head.x + Math.sin(a) * r, THREE.MathUtils.lerp(from.y, to.y, away), head.z + Math.cos(a) * r);
    /** Across to between her and the lamp: the way that splits the angle from the eye, at her distance. */
    const wide = THREE.MathUtils.smoothstep(this.aspect, 0.7, 1.3);
    const toHer = this.dirHer.subVectors(head, from), reach = toHer.length();
    const her = THREE.MathUtils.lerp(k.uprightLampHer, k.lampHer, wide);
    toHer.normalize().multiplyScalar(her);
    const across = this.dirLamp.subVectors(LAMP, from).normalize().multiplyScalar(1 - her).add(toHer).normalize();
    const between = this.dirHer.copy(from).addScaledVector(across, reach);
    /** Upward as far between the two as they stand above and below the eye, so the high lamp keeps inside the frame. */
    const flat = Math.hypot(between.x - from.x, between.z - from.z);
    const up = (Math.atan2(head.y + 1 - from.y, Math.hypot(head.x - from.x, head.z - from.z))
      + Math.atan2(LAMP.y - from.y, Math.hypot(LAMP.x - from.x, LAMP.z - from.z))) / 2;
    between.y = from.y + Math.tan(up) * flat;
    this.mixTarget.addVectors(head, this.goneAim).lerp(between, light).lerp(shot.target, away);
    const zoom = THREE.MathUtils.lerp(THREE.MathUtils.lerp(this.zoomNow, k.lampZoom, light), shot.zoom ?? 1, away);
    this.write(shot, this.mixEye, this.mixTarget, zoom);
  }

  private write(shot: Shot, eye: THREE.Vector3, target: THREE.Vector3, zoom: number): void {
    shot.subjects = undefined;
    shot.attention = undefined;
    shot.obstacles = undefined;
    shot.smoothFit = undefined;
    shot.orbit = undefined;
    shot.fitWidth = false;
    shot.free = false;
    shot.exact = true;
    shot.eye = (shot.eye ?? new THREE.Vector3()).copy(eye);
    shot.target.copy(target);
    shot.from = (shot.from ?? new THREE.Vector3()).set(eye.x - target.x, 0, eye.z - target.z).normalize();
    shot.distance = Math.hypot(eye.x - target.x, eye.z - target.z);
    shot.height = eye.y - target.y;
    shot.zoom = zoom;
    shot.carry = false;
  }
}
