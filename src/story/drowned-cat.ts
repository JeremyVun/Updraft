import * as THREE from 'three';
import { BOW_Z, MAST_Z, SEAT_Y, STERN_Z, foredeckAt } from '../traveller/boat/form';
import { tuning } from '../tuning';
import {
  CAT_CHIMNEY, CAT_EDGE, CAT_HOLD, CAT_HOLD_YAW, CAT_LANDING, CAT_ROOF, TOWER_FOOT, TUB_START, TUB_WATER, WAY, catRoof, strandRoof,
} from '../world/drowned-way';
import { WashTub, type TubWall } from '../world/wash-tub';
import type { Cast } from './cast';

/**
 * `stranded` on its chimney before the boat comes; `seen` she has noticed it; `easing` the boat slowing into its hold;
 * `waiting` for the tub to be brought to its roof, down at the water's edge once the boat holds; `coming` into the tub
 * once it is there; `ferried` the tub on its way to the boat;
 * `boarding` the tub at the bow; `aboard` shaking dry on the thwart and then at the bow. Then, once the fog has
 * come on, `bolting` off the bow and over the first roof, `waits` at its end looking back at her, `climbing` she goes
 * after it, and `ridge` she is up.
 */
export type CatStep = 'stranded' | 'seen' | 'easing' | 'waiting' | 'coming' | 'ferried' | 'boarding' | 'aboard'
  | 'bolting' | 'waits' | 'climbing' | 'ridge';

/** Where the cat sits on the boat: on the foredeck, as high and dry as it can get, facing her. */
const FOREDECK = new THREE.Vector3(0, foredeckAt(0, 2.12), 2.12);
// The far half of the thwart shows the shake above the near gunwale.
const ON_THWART = new THREE.Vector3(0.60, SEAT_Y + 0.045, MAST_Z);
/** The hull at the waterline as the tub meets it: half its beam, and half its length about its middle. */
const HULL_HALF = 0.8;
const HULL_MID = (BOW_Z + STERN_Z) / 2;
const HULL_LEN = (BOW_Z - STERN_Z) / 2 - 0.2;
/** Where the tub comes alongside the bow, in the hull's frame (either side). */
const BOW_DOCK = new THREE.Vector3(HULL_HALF + WashTub.radius + 0.05, 0, 1.3);
/** On its boards in the middle of the tub. */
const IN_TUB = new THREE.Vector3(0, WashTub.floor, 0);
/** Where the tub comes up against the cat's slates, just below where it waits at the water's edge. */
const CAT_DOCK = (() => {
  const r = CAT_ROOF, c = Math.cos(r.yaw), s = Math.sin(r.yaw);
  const along = (CAT_EDGE.x - r.x) * c - (CAT_EDGE.z - r.z) * s, out = r.depth + WashTub.radius + 0.03;
  return new THREE.Vector3(r.x + along * c + out * s, 0, r.z - along * s + out * c);
})();
/** Just out over the water in front of it, where it puts a paw toward the water and snatches it back. */
const PAW_AT = CAT_EDGE.clone().lerp(CAT_DOCK, 0.32).setY(0.03);
/** Where she steps out onto the slates by the stem, the ridge above it, and the west end of the ridge over the lane. */
const RIDGE = new THREE.Vector3(WAY.strand.x0, WAY.strand.height, WAY.strand.z0);
const GAP = new THREE.Vector3(WAY.strand.x1, WAY.strand.height, WAY.strand.z1);
/** High on the church tower, the highest thing there is. */
const TOWER = TOWER_FOOT.clone().setY(TOWER_FOOT.y + 6);
/** Where she looks over the side at the slates the hull has run up on, in the boat's frame. */
const UNDER_BOW = new THREE.Vector3(0.9, -0.2, 2.6);

/**
 * The cat of the drowned village, from its chimney to the bow and then off it again. It mews from a chimney pot
 * along the drift; she notices it and the boat comes round toward it and waits. The player's wind brings a wash-tub
 * against its roof, it comes down and gets in, and the wind brings the tub to the boat, where it jumps aboard and
 * settles at the bow while the cygnet hides in the satchel. When the dark has come on behind the stranded boat it
 * panics, leaps onto the roof the boat lies against and runs up and along the ridge to the first gap; she goes after it.
 */
export class StrandedCat {
  step: CatStep = 'stranded';
  /** Where the drawn gust starts and the screen angle it sweeps at, while the tub waits for the player; else null. */
  invitation: THREE.Vector3 | null = null;
  heading: number | null = null;
  /** Where the tub has to go next, while it is the player's to bring. */
  readonly goal = new THREE.Vector3();
  /** Her face, for the cat to look at; the cat's eye, the tub, the satchel and the dark, for her and the cat to look at. */
  readonly head = new THREE.Vector3();
  readonly eye = new THREE.Vector3();
  readonly tubTop = new THREE.Vector3();
  private readonly satchel = new THREE.Vector3();
  private readonly darkAt = new THREE.Vector3();
  /** Where the lens was last frame: the tub comes alongside the bow on the side it can be seen from. */
  private readonly lensAt = new THREE.Vector3();
  private watching = false;
  private since = 0;
  private now = 0;
  private readonly roofWall: TubWall = { x: CAT_ROOF.x, z: CAT_ROOF.z, yaw: CAT_ROOF.yaw, len: CAT_ROOF.len, depth: CAT_ROOF.depth };
  private readonly hullWall: TubWall = { x: 0, z: 0, yaw: 0, len: HULL_HALF, depth: HULL_LEN };
  private readonly dock = { x: 0, z: 0, reach: 0 };
  private readonly goalXZ = new THREE.Vector2();
  private readonly v = new THREE.Vector3();
  private readonly lens = new THREE.Vector3();
  private side = 1;
  private nearest = Infinity;
  /** How far through what it is doing in this step. */
  private phase = 0;
  /** Its way down off the chimney to the water's edge: 0 on its pot, 1 on its way down, 2 waiting at the edge. */
  private down = 0;
  private edgeAt = -1;
  private pawAt = Infinity;
  private released = false;
  private bolted: number | null = null;
  private washed = false;
  private wary = false;
  private rescue = -1;
  private turned = false;

  constructor(private readonly cast: Cast, private readonly goOn: () => void) {}

  private get tub(): WashTub {
    return this.cast.village!.tub;
  }

  /** True while the boat waits on the cat: it is held where it is and its sail let go. */
  get holding(): boolean {
    return this.step === 'easing' || this.step === 'waiting' || this.step === 'coming' || this.step === 'ferried'
      || this.step === 'boarding' || (this.step === 'aboard' && !this.released);
  }

  /** The cat shakes off the water before hopping to the bow. */
  get rescuing(): boolean {
    return this.rescue >= 0;
  }

  /** True while the tub is the player's to bring somewhere. */
  get puzzling(): boolean {
    return this.step === 'waiting' || this.step === 'ferried';
  }

  /** She is out of the boat. */
  get ashore(): boolean {
    return this.step === 'climbing' || this.step === 'ridge';
  }

  /** Seconds since the step began. */
  get t(): number {
    return this.since;
  }

  /** Seconds since the cat bolted off the bow, or -1 before it has. */
  get sinceBolt(): number {
    return this.bolted === null ? -1 : this.now - this.bolted;
  }

  /**
   * Sitting hunched on its chimney pot, ears back, mewing, with the tub adrift on the water below. It sits rather than
   * crouches: across the water a crouch is a loaf on a pot, and a sitting cat is a cat.
   */
  begin(): void {
    const { cat } = this.cast;
    if (!this.cast.village) return;
    cat.visible = true;
    cat.unease = 0;
    cat.curious = null;
    cat.place(CAT_CHIMNEY, Math.atan2(CAT_HOLD.x - CAT_CHIMNEY.x, CAT_HOLD.y - CAT_CHIMNEY.z), { pose: 'sit' });
    cat.rest('sit', this.head);
    cat.unease = 0.55;
    cat.mewing = true;
    const tub = this.tub;
    tub.visible = true;
    tub.interactive = false;
    tub.place(TUB_START.x, TUB_START.y, 0.7);
    tub.water.x = TUB_WATER.x;
    tub.water.z = TUB_WATER.z;
    tub.water.r = TUB_WATER.r;
    tub.walls = [this.roofWall, this.hullWall];
    tub.laden = false;
  }

  /** At the bow already, for a start from past the cat. */
  aboard(): void {
    const { cat, boat } = this.cast;
    if (!this.cast.village) return;
    cat.visible = true;
    cat.mewing = false;
    cat.unease = 0;
    cat.place(FOREDECK, Math.PI, { frame: boat.group, floor: foredeckAt, pose: 'sit' });
    cat.look(this.head);
    cat.curious = this.satchel;
    this.tub.visible = false;
    this.released = true;
    this.to('aboard');
  }

  /** QA: up on the roof already, the cat sitting at the end of the ridge and her on it after it. */
  onRidge(): void {
    const { cat, child } = this.cast;
    if (!this.cast.village) return;
    cat.visible = true;
    cat.mewing = false;
    cat.curious = null;
    cat.unease = 0.7;
    cat.place(GAP, Math.atan2(RIDGE.x - GAP.x, RIDGE.z - GAP.z), { pose: 'sit', floor: strandRoof });
    cat.look(this.head);
    this.tub.visible = false;
    this.released = true;
    /** Long enough ago that the climb's view has come round to her on the ridge, where the run takes the lens from. */
    this.bolted = this.now - tuning.drownedCamera.climbFor;
    child.decks = [WAY.strandLanding, WAY.strandSlope, WAY.strand];
    child.dismount();
    child.place(RIDGE.x, RIDGE.z, Math.atan2(GAP.x - RIDGE.x, GAP.z - RIDGE.z));
    child.position.y = RIDGE.y;
    this.to('ridge');
    this.since = tuning.drowned.cat.lostFor;
  }

  private to(step: CatStep): void {
    this.step = step;
    this.since = 0;
    this.phase = 0;
    this.tub.interactive = this.puzzling;
  }

  update(dt: number, time: number): void {
    if (!this.cast.village) return;
    const { boat, child, cat, cygnet } = this.cast;
    this.since += dt;
    this.now += dt;
    child.face(this.head);
    cygnet.eye(this.satchel);
    cat.eye(this.eye);
    this.cygnetWatch();
    const tub = this.tub;
    this.hull();
    tub.update(dt, time);
    this.tubTop.copy(tub.position).setY(tub.position.y + 0.32);
    const k = tuning.drowned.cat;
    const toHold = Math.hypot(boat.position.x - CAT_HOLD.x, boat.position.z - CAT_HOLD.y);
    switch (this.step) {
      case 'stranded':
        if (toHold < k.seeFrom) this.to('seen');
        break;
      case 'seen':
        if (toHold < boat.speed * boat.speed / (2 * k.holdBrake) + 1.5) {
          this.nearest = Infinity;
          this.to('easing');
        }
        break;
      case 'easing':
        this.ease(toHold);
        break;
      case 'waiting':
        if (this.down === 0 && this.since > k.downAfter) this.comeDown();
        this.bringTo(this.goal.copy(CAT_DOCK), k.roofReach);
        if (tub.docked) {
          tub.held = true;
          this.to('coming');
        }
        break;
      case 'coming':
        if (this.down === 0) this.comeDown();
        this.getIn();
        break;
      case 'ferried':
        this.bringTo(this.toBow(), k.bowReach);
        if (!this.wary && tub.position.distanceTo(boat.position) < 6) {
          this.wary = true;
          cygnet.mind.startle(0.15);
        }
        if (tub.docked) {
          tub.held = true;
          this.to('boarding');
          if (cygnet.seat === 'cradle') this.cast.carry.stow();
          cygnet.mind.startle(0.25);
        }
        break;
      case 'boarding':
        if (tub.held) {
          this.toBow();
          this.dock.x = this.goal.x;
          this.dock.z = this.goal.z;
        }
        this.jumpAboard();
        break;
      case 'aboard':
        if (this.rescue >= 0) this.rescued(dt);
        else if (!this.released && this.since > k.settles) {
          this.released = true;
          this.goOn();
        }
        if (this.released && !this.washed && this.since > 7) {
          this.washed = true;
          cat.wash();
        }
        break;
      case 'bolting':
        this.flee();
        break;
      case 'waits':
        this.goAfter();
        break;
      case 'ridge':
        /** Up, she turns back to the boat below as the fog comes over it, then to the cat, until she sets off after it. */
        if (this.since < k.lostFor + tuning.drowned.run.setOff) {
          const at = this.since < k.lostFor ? boat.position : cat.position;
          child.faceToward(at.x, at.z, 1 - Math.exp(-dt * 2.5));
        }
        break;
      default:
        break;
    }
    if (this.down === 2 && this.step === 'waiting') this.plead();
    if (!this.puzzling) {
      tub.goal = null;
      this.invitation = null;
      tub.dock = this.step === 'coming' || this.step === 'boarding' ? tub.dock : null;
    }
  }

  /**
   * The boat slows on its own course into the place it waits, braking evenly so it never lurches, and comes round to
   * face the cat once it has lost its way.
   */
  private ease(toHold: number): void {
    const { boat } = this.cast;
    const k = tuning.drowned.cat;
    const most = Math.sqrt(2 * k.holdBrake * Math.max(0, toHold - 0.4));
    boat.speed = Math.min(boat.speed, most);
    boat.speedLimit = Math.max(0.05, Math.min(k.sailSpeed, most));
    const passing = toHold > this.nearest + 0.01;
    this.nearest = Math.min(this.nearest, toHold);
    if (toHold > 1 && !passing && boat.speed > 0.2) return;
    const fx = Math.sin(boat.yaw), fz = Math.cos(boat.yaw);
    const on = Math.min(1.5, boat.speed * boat.speed / (2 * tuning.drowned.coastBrake));
    const x = boat.position.x + fx * on, z = boat.position.z + fz * on;
    boat.coastTo = { x, z, yaw: CAT_HOLD_YAW };
    this.to('waiting');
  }

  /** The hull as the tub meets it, wherever the boat is lying. */
  private hull(): void {
    const { boat } = this.cast;
    const w = this.hullWall;
    w.x = boat.position.x + Math.sin(boat.yaw) * HULL_MID;
    w.z = boat.position.z + Math.cos(boat.yaw) * HULL_MID;
    w.yaw = boat.yaw;
  }

  /**
   * Alongside the bow on the side toward the lens, unless the tub has been taken well round alongside the other side;
   * coming back from the cat's roof off the other bow it is still the near side.
   */
  private toBow(): THREE.Vector3 {
    const { boat } = this.cast;
    boat.group.updateMatrixWorld(true);
    const local = this.v.copy(this.tub.position);
    boat.group.worldToLocal(local);
    const near = boat.group.worldToLocal(this.lens.copy(this.lensAt).setY(0)).x < 0 ? -1 : 1;
    if (!this.tub.dock) this.side = local.x * near < -1.5 && local.z < BOW_DOCK.z + 1 ? -near : near;
    return this.goal.set(BOW_DOCK.x * this.side, 0, BOW_DOCK.z).applyMatrix4(boat.group.matrixWorld).setY(0);
  }

  /**
   * The dock catches a tub the player has brought close; waiting only offers a gesture.
   */
  private bringTo(goal: THREE.Vector3, reach: number): void {
    const tub = this.tub, k = tuning.drowned.cat;
    const d = Math.hypot(tub.position.x - goal.x, tub.position.z - goal.z);
    tub.goal = this.goalXZ.set(goal.x, goal.z);
    if ((d < reach && tub.sinceBrushed < tuning.drowned.tub.easeFor + 1) || tub.dock) {
      tub.dock = this.dock;
      this.dock.x = goal.x;
      this.dock.z = goal.z;
      this.dock.reach = reach + 0.5;
    }
    const idle = Math.min(tub.sinceBrushed, this.step === 'waiting' ? this.since - this.edgeAt : this.since) > k.inviteAfter
      && (this.step !== 'waiting' || this.down === 2) && !tub.dock;
    this.invitation = idle ? this.tubTop : null;
  }

  /**
   * Once the boat holds it comes down off its chimney and picks its way down the slates to the water's edge where the
   * tub has to come, and waits there sitting up, mewing at her: across the water a crouch is a loaf, and a sitting cat
   * is a cat.
   */
  private comeDown(): void {
    const { cat } = this.cast;
    this.down = 1;
    cat.look(this.head);
    cat.hop(CAT_LANDING, { floor: catRoof, then: 'crouch', arc: 0.2, look: this.head }, () => {
      cat.run([CAT_EDGE], catRoof, { pace: 'walk', speed: 0.55, then: 'sit', look: this.head }, () => {
        this.down = 2;
        this.edgeAt = this.since;
        this.pawAt = this.since + tuning.drowned.cat.pawFirst - tuning.drowned.cat.pawEvery;
      });
    });
  }

  /** At the edge, now and then it puts a paw out toward the water and snatches it back, and mews at her again. */
  private plead(): void {
    const { cat } = this.cast;
    const k = tuning.drowned.cat;
    if (this.phase === 0 && this.since - this.pawAt > k.pawEvery && !cat.busy) {
      this.phase = 1;
      this.pawAt = this.since + Math.random() * 1.5;
      cat.look(PAW_AT);
    } else if (this.phase === 1 && this.since > this.pawAt) {
      this.phase = 2;
      cat.bat(PAW_AT);
    } else if (this.phase === 2 && this.since - this.pawAt > k.pawFor) {
      this.phase = 0;
      cat.afraid(k.pawFlinch);
      cat.look(this.head);
      cat.mew(1.2);
    }
  }

  /** At the edge with the tub against the slates below it, it hops straight in. */
  private getIn(): void {
    const { cat } = this.cast;
    const tub = this.tub;
    if (this.down !== 2 || this.phase > 0 || this.since < tuning.drowned.cat.edge) return;
    this.phase = 1;
    cat.look(this.tubTop);
    /** It sits, ears flat: crouched, the tub's sides hide it from every view the room takes. */
    cat.hop(IN_TUB, { frame: tub.group, then: 'sit', look: this.head }, () => {
      cat.mewing = false;
      cat.unease = 0.8;
      tub.laden = true;
      tub.held = false;
      tub.dock = null;
      tub.docked = false;
      tub.sinceBrushed = Infinity;
      tub.velocity.set(0, 0);
      this.to('ferried');
    });
  }

  /** A moment held at the bow, then the leap aboard; the tub bobs away aft from the push of it. */
  private jumpAboard(): void {
    const { cat, boat, cygnet } = this.cast;
    const k = tuning.drowned.cat;
    const tub = this.tub;
    if (this.since > k.ready && this.phase === 0) {
      this.phase = 1;
      const near = boat.group.worldToLocal(this.lens.copy(this.lensAt)).x < 0 ? -1 : 1;
      cat.leap(ON_THWART.clone().setX(-ON_THWART.x * near), { frame: boat.group, yaw: 0, then: 'stand' }, () => {
        cat.unease = 0.3;
        cat.wet = 1;
        cat.chirrup();
        cygnet.mind.startle(0.3);
        this.rescue = 0;
        this.to('aboard');
      });
    }
    if (this.phase === 1 && tub.held && this.since > k.ready + 0.8) {
      tub.held = false;
      tub.dock = null;
      tub.docked = false;
      tub.laden = false;
      /** Out from the hull and back along it, out from in front of the lens watching the rescue. */
      const away = this.v.set(tub.position.x - boat.position.x, 0, tub.position.z - boat.position.z).normalize()
        .addScaledVector(this.lens.set(Math.sin(boat.yaw), 0, Math.cos(boat.yaw)), -0.8).normalize();
      tub.velocity.set(away.x * 0.5, away.z * 0.5);
      tub.water.x = tub.position.x + away.x * 2;
      tub.water.z = tub.position.z + away.z * 2;
      tub.water.r = 3;
    }
  }

  private rescued(dt: number): void {
    const { cat, boat } = this.cast;
    const k = tuning.drowned.rescue;
    const was = this.rescue;
    this.rescue += dt;
    if (was < k.shakeAt && this.rescue >= k.shakeAt) cat.shake();
    if (this.rescue >= k.bowAfter && !this.turned && !cat.busy && !cat.shaking) {
      this.turned = true;
      cat.hop(FOREDECK, { frame: boat.group, floor: foredeckAt, yaw: Math.PI, then: 'sit', look: this.head, arc: 0.3 }, () => {
        cat.curious = this.satchel;
        cat.unease = 0;
        this.rescue = -1;
        this.since = tuning.drowned.cat.settles - k.goOnAfter;
      });
    }
  }

  /**
   * The fog's front is `away` metres off the boat and coming: the cat stares at it, flatter and flatter, then looks
   * toward the church, the highest thing there is, and bolts.
   */
  dread(away: number, dark: THREE.Vector3, groundedFor = 0): void {
    if (this.step !== 'aboard' || this.rescue >= 0) return;
    const { cat } = this.cast;
    const k = tuning.drowned.cat;
    this.darkAt.copy(dark);
    const fear = 1 - THREE.MathUtils.smoothstep(away, k.boltFrom, k.uneasyFrom);
    cat.unease = 0.85 * fear;
    if (fear > 0.05 && away > k.churchFrom) {
      cat.curious = null;
      cat.stare(this.darkAt);
    } else if (away <= k.churchFrom && away > k.boltFrom) {
      cat.stare(null);
      cat.look(TOWER);
    }
    if ((away <= k.boltFrom || groundedFor >= k.leaveAfter) && !cat.busy) {
      cat.afraid(1);
      cat.yowl();
      this.bolted = this.now;
      this.to('bolting');
    }
  }

  /** Off the bow onto the slates, up to the ridge and along it to the first gap, where it turns to her. */
  private flee(): void {
    const { cat } = this.cast;
    if (this.phase > 0 || this.since < 0.45) return;
    this.phase = 1;
    cat.stare(null);
    cat.shiver = 0;
    const k = tuning.drowned.cat;
    const onto = this.v.copy(RIDGE).lerp(GAP, 0.08);
    onto.y = strandRoof(onto.x, onto.z);
    cat.leap(onto.clone(), { floor: strandRoof, then: 'stand', arc: 0.3 }, () => {
      cat.run([GAP], strandRoof, { pace: 'run', speed: k.runSpeed, then: 'sit', look: this.head }, () => {
        cat.unease = 0.7;
        this.to('waits');
      });
    });
  }

  /** She looks back at the fog, down at the boat stuck on the slates, then at the cat, and climbs out after it and up to the ridge. */
  private goAfter(): void {
    const k = tuning.drowned.cat;
    if (this.since < 0.6 + k.looksBack + k.looksAtBoat + k.looksAtCat) return;
    const { child, boat } = this.cast;
    child.decks = [WAY.strandLanding, WAY.strandSlope, WAY.strand];
    this.to('climbing');
    child.alight(boat, WAY.strandLanding, () => child.walkTo(RIDGE.x, RIDGE.z, false, () => this.to('ridge'), 0.3));
  }

  /** Where she looks while the cat is what is happening, or null to leave her to the drift. */
  gaze(): THREE.Vector3 | null {
    const tub = this.tub;
    switch (this.step) {
      case 'stranded':
        return null;
      case 'waiting':
        return tub.sinceBrushed < 2 || tub.velocity.length() > 0.3 || Math.floor(this.now / 4) % 3 === 2 ? this.tubTop : this.eye;
      case 'ferried':
        return this.tubTop;
      case 'aboard':
        return this.rescue >= 0 || this.since < 6 || Math.floor(this.now / 6) % 3 === 0 ? this.eye : null;
      case 'waits': {
        const k = tuning.drowned.cat;
        if (this.since > 0.6 && this.since < 0.6 + k.looksBack) return this.darkAt;
        if (this.since >= 0.6 + k.looksBack && this.since < 0.6 + k.looksBack + k.looksAtBoat) {
          this.cast.boat.group.updateMatrixWorld(true);
          return this.lens.copy(UNDER_BOW).applyMatrix4(this.cast.boat.group.matrixWorld);
        }
        return this.eye;
      }
      case 'ridge': {
        /** Up, she looks back down at the boat as the fog comes over it, then at the cat and the church it makes for. */
        const k = tuning.drowned.cat;
        if (this.since < k.lostFor) return this.lens.copy(this.cast.boat.position).setY(this.cast.boat.position.y + 0.8);
        const beat = (this.since - k.lostFor - 1.6) % 7;
        return this.since < k.lostFor + 1.6 || beat > 4.2 ? this.eye : TOWER;
      }
      default:
        return this.eye;
    }
  }

  /**
   * The cygnet in the satchel watches what is happening, never the lens: the cat it is wary of, now and then her, and
   * the fog once it is coming.
   */
  private cygnetWatch(): void {
    const { cygnet } = this.cast;
    if (cygnet.seat !== 'satchel' || this.step === 'stranded') {
      if (this.watching) cygnet.watch(null);
      this.watching = false;
      return;
    }
    this.watching = true;
    const beat = this.now % 7;
    const fogging = this.cast.cat.unease > 0.05 && this.step === 'aboard';
    if (fogging) cygnet.watch(beat < 4.5 ? this.darkAt : this.eye);
    else cygnet.watch(beat > 5.4 && this.step === 'aboard' ? this.head : this.eye);
  }

  /** The drawn gust's direction on screen: from the tub toward where it has to go. */
  afterCamera(camera: THREE.Camera): void {
    this.lensAt.copy(camera.position);
    if (!this.invitation) { this.heading = null; return; }
    const a = this.v.copy(this.tub.position).project(camera);
    const ax = a.x, ay = a.y;
    const b = this.v.copy(this.goal).project(camera);
    const aspect = (camera as THREE.PerspectiveCamera).aspect ?? 1;
    this.heading = Math.atan2(b.y - ay, (b.x - ax) * aspect);
  }
}
