import * as THREE from 'three';
import { BOW_Z, STERN_Z } from '../traveller/boat/form';
import { tuning } from '../tuning';
import {
  CAT_CHIMNEY, CAT_HOLD, CAT_LANDING, CAT_LENS, CAT_ROOF, TUB_START, TUB_WATER, WAY, catRoof, onCatRoof, strandRoof,
} from '../world/drowned-way';
import { WashTub, type TubWall } from '../world/wash-tub';
import type { Cast } from './cast';

/**
 * `stranded` on its chimney before the boat comes; `seen` she has noticed it; `easing` the boat slowing into its hold;
 * `waiting` for the tub to be brought to its roof; `coming` down into it; `ferried` the tub on its way to the boat;
 * `boarding` the tub at the bow; `aboard` at the bow. Then, once the dark has come on, `bolting` off the bow and over
 * the roof, `waits` at the first gap mewing back at her, `climbing` she goes after it, and `ridge` she is up.
 */
export type CatStep = 'stranded' | 'seen' | 'easing' | 'waiting' | 'coming' | 'ferried' | 'boarding' | 'aboard'
  | 'bolting' | 'waits' | 'climbing' | 'ridge';

/** Where the cat sits on the boat: on the foredeck, as high and dry as it can get, facing her. */
const FOREDECK = new THREE.Vector3(0, 0.668, 1.85);
/** The hull at the waterline as the tub meets it: half its beam, and half its length about its middle. */
const HULL_HALF = 0.8;
const HULL_MID = (BOW_Z + STERN_Z) / 2;
const HULL_LEN = (BOW_Z - STERN_Z) / 2 - 0.2;
/** Where the tub comes alongside the bow, in the hull's frame (either side). */
const BOW_DOCK = new THREE.Vector3(HULL_HALF + WashTub.radius + 0.05, 0, 1.3);
/** On its boards in the middle of the tub. */
const IN_TUB = new THREE.Vector3(0, WashTub.floor, 0);
/** The middle of the cat's eaves, which the boat comes round to face. */
const EAVES = onCatRoof(0, CAT_ROOF.depth);
/** Where she steps out onto the slates by the stem, the ridge above it, and the west end of the ridge over the lane. */
const STEP = new THREE.Vector3(WAY.strandSlope.x0, WAY.strandSlope.height, WAY.strandSlope.z0);
const RIDGE = new THREE.Vector3(WAY.strand.x0, WAY.strand.height, WAY.strand.z0);
const GAP = new THREE.Vector3(WAY.strand.x1, WAY.strand.height, WAY.strand.z1);

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
  private since = 0;
  private now = 0;
  private readonly roofWall: TubWall = { x: CAT_ROOF.x, z: CAT_ROOF.z, yaw: CAT_ROOF.yaw, len: CAT_ROOF.len, depth: CAT_ROOF.depth };
  private readonly hullWall: TubWall = { x: 0, z: 0, yaw: 0, len: HULL_HALF, depth: HULL_LEN };
  private readonly dock = { x: 0, z: 0, reach: 0 };
  private readonly edge = new THREE.Vector3();
  private readonly v = new THREE.Vector3();
  private readonly lens = new THREE.Vector3();
  private side = 1;
  private nearest = Infinity;
  private best = Infinity;
  private stall = 0;
  /** How far through what it is doing in this step. */
  private phase = 0;
  private atEdge = 0;
  private released = false;
  private washed = false;
  private wary = false;

  constructor(private readonly cast: Cast, private readonly goOn: () => void) {}

  private get tub(): WashTub {
    return this.cast.village!.tub;
  }

  /** True while the boat waits on the cat: it is held where it is and its sail let go. */
  get holding(): boolean {
    return this.step === 'easing' || this.step === 'waiting' || this.step === 'coming' || this.step === 'ferried'
      || this.step === 'boarding' || (this.step === 'aboard' && !this.released);
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

  /** Crouched on its chimney pot, mewing, with the tub adrift on the water below. */
  begin(): void {
    const { cat } = this.cast;
    if (!this.cast.village) return;
    cat.visible = true;
    cat.unease = 0;
    cat.curious = null;
    cat.place(CAT_CHIMNEY, Math.atan2(CAT_HOLD.x - CAT_CHIMNEY.x, CAT_HOLD.y - CAT_CHIMNEY.z), { pose: 'crouch' });
    cat.strand(this.head);
    const tub = this.tub;
    tub.visible = true;
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
    cat.place(FOREDECK, Math.PI, { frame: boat.group, pose: 'sit' });
    cat.look(this.head);
    cat.curious = this.satchel;
    this.tub.visible = false;
    this.released = true;
    this.to('aboard');
  }

  private to(step: CatStep): void {
    this.step = step;
    this.since = 0;
    this.phase = 0;
    this.best = Infinity;
    this.stall = 0;
  }

  update(dt: number, time: number): void {
    if (!this.cast.village) return;
    const { boat, child, cat, cygnet } = this.cast;
    this.since += dt;
    this.now += dt;
    child.face(this.head);
    cygnet.eye(this.satchel);
    cat.eye(this.eye);
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
        this.bringTo(dt, this.toRoof(), k.roofReach);
        if (tub.docked) {
          tub.held = true;
          this.to('coming');
        }
        break;
      case 'coming':
        this.comeDown();
        break;
      case 'ferried':
        this.bringTo(dt, this.toBow(), k.bowReach);
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
        if (!this.released && this.since > k.settles) {
          this.released = true;
          this.goOn();
        }
        if (!this.washed && this.since > 7) {
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
      default:
        break;
    }
    if (!this.puzzling) {
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
    boat.speedLimit = Math.max(0.05, Math.min(tuning.storm.passageSpeed, most));
    const passing = toHold > this.nearest + 0.01 && toHold < 4;
    this.nearest = Math.min(this.nearest, toHold);
    if (toHold > 1 && !passing && boat.speed > 0.2) return;
    const fx = Math.sin(boat.yaw), fz = Math.cos(boat.yaw);
    const on = Math.min(1.5, boat.speed * boat.speed / (2 * tuning.drowned.coastBrake));
    const x = boat.position.x + fx * on, z = boat.position.z + fz * on;
    boat.coastTo = { x, z, yaw: Math.atan2(EAVES.x - x, EAVES.z - z) };
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

  /** Where on the cat's eaves the tub is nearest: it is drawn in there once it comes within reach. */
  private toRoof(): THREE.Vector3 {
    const p = this.tub.position, r = CAT_ROOF;
    const c = Math.cos(r.yaw), s = Math.sin(r.yaw);
    const dx = p.x - r.x, dz = p.z - r.z;
    const along = THREE.MathUtils.clamp(dx * c - dz * s, -r.len + 1, r.len - 1);
    const out = r.depth + WashTub.radius + 0.03;
    return this.goal.set(r.x + along * c + out * s, 0, r.z - along * s + out * c);
  }

  /** Alongside the bow on the side toward the lens, unless the tub has been taken well round the other side. */
  private toBow(): THREE.Vector3 {
    const { boat } = this.cast;
    boat.group.updateMatrixWorld(true);
    const local = this.v.copy(this.tub.position);
    boat.group.worldToLocal(local);
    const near = boat.group.worldToLocal(this.lens.set(CAT_LENS.x, 0, CAT_LENS.y)).x < 0 ? -1 : 1;
    if (!this.tub.dock) this.side = local.x * near < -1.5 ? -near : near;
    return this.goal.set(BOW_DOCK.x * this.side, 0, BOW_DOCK.z).applyMatrix4(boat.group.matrixWorld).setY(0);
  }

  /**
   * The tub is the player's to bring to `goal`: drawn in once it is within `reach`, an invitation after a while with
   * nothing near it, and after a long while with no progress the air carries it there by itself.
   */
  private bringTo(dt: number, goal: THREE.Vector3, reach: number): void {
    const tub = this.tub, k = tuning.drowned.cat;
    const d = Math.hypot(tub.position.x - goal.x, tub.position.z - goal.z);
    if (d < reach || tub.dock) {
      tub.dock = this.dock;
      this.dock.x = goal.x;
      this.dock.z = goal.z;
      this.dock.reach = reach + 0.5;
    }
    if (d < this.best - k.progress) {
      this.best = d;
      this.stall = 0;
    } else this.stall += dt;
    if (this.stall > k.carryAfter && !tub.carry) tub.carry = new THREE.Vector2(goal.x, goal.z);
    if (tub.carry) tub.carry.set(goal.x, goal.z);
    const idle = Math.min(tub.sinceBrushed, this.since) > k.inviteAfter && !tub.dock && !tub.carry;
    this.invitation = idle ? this.tubTop : null;
  }

  /** It looks at the tub, comes down off the chimney, picks its way down the slates to the edge, and hops in. */
  private comeDown(): void {
    const { cat } = this.cast;
    const k = tuning.drowned.cat;
    const tub = this.tub;
    if (this.phase === 0) {
      this.phase = 1;
      cat.mewing = false;
      cat.look(this.tubTop);
    } else if (this.phase === 1 && this.since > k.looks) {
      this.phase = 2;
      const r = CAT_ROOF, c = Math.cos(r.yaw), s = Math.sin(r.yaw);
      const dx = tub.position.x - r.x, dz = tub.position.z - r.z;
      onCatRoof(THREE.MathUtils.clamp(dx * c - dz * s, -r.len + 0.9, r.len - 0.9), r.depth - 0.25, this.edge);
      cat.hop(CAT_LANDING, { floor: catRoof, then: 'crouch', arc: 0.2, look: this.tubTop }, () => {
        cat.run([this.edge], catRoof, { pace: 'walk', speed: 0.55, then: 'crouch', look: this.tubTop }, () => {
          this.phase = 3;
          this.atEdge = this.since;
          cat.mew(0.6);
        });
      });
    } else if (this.phase === 3 && this.since - this.atEdge > k.edge) {
      this.phase = 4;
      cat.hop(IN_TUB, { frame: tub.group, then: 'crouch', look: this.head }, () => {
        cat.mewing = false;
        cat.unease = 0.8;
        tub.laden = true;
        tub.held = false;
        tub.dock = null;
        tub.docked = false;
        tub.carry = null;
        this.to('ferried');
      });
    }
  }

  /** A moment held at the bow, then the leap aboard; the tub bobs away from the push of it. */
  private jumpAboard(): void {
    const { cat, boat, cygnet } = this.cast;
    const k = tuning.drowned.cat;
    const tub = this.tub;
    if (this.since > k.ready && this.phase === 0) {
      this.phase = 1;
      cat.leap(FOREDECK, { frame: boat.group, yaw: Math.PI, then: 'sit', look: this.head }, () => {
        cat.unease = 0;
        cat.chirrup();
        cat.curious = this.satchel;
        cygnet.mind.startle(0.3);
        this.to('aboard');
      });
    }
    if (this.phase === 1 && tub.held && this.since > k.ready + 0.8) {
      tub.held = false;
      tub.dock = null;
      tub.docked = false;
      tub.laden = false;
      const away = this.v.set(tub.position.x - boat.position.x, 0, tub.position.z - boat.position.z).normalize();
      tub.velocity.set(away.x * 0.5, away.z * 0.5);
      tub.water.x = tub.position.x + away.x * 2;
      tub.water.z = tub.position.z + away.z * 2;
      tub.water.r = 3;
    }
  }

  /** The dark has come `come` of the way on: the cat watches it, flatter and flatter. */
  dread(come: number, dark: THREE.Vector3): void {
    if (this.step !== 'aboard') return;
    const { cat } = this.cast;
    const k = tuning.drowned.cat;
    this.darkAt.copy(dark);
    const fear = THREE.MathUtils.smoothstep(come, k.uneasyFrom, k.boltAt);
    cat.unease = 0.85 * fear;
    if (fear > 0.05) {
      cat.curious = null;
      cat.look(this.darkAt);
    }
    if (come >= k.boltAt && !cat.busy) {
      cat.afraid(1);
      this.to('bolting');
    }
  }

  /** Off the bow onto the slates, up to the ridge and along it to the first gap, where it turns to her. */
  private flee(): void {
    const { cat } = this.cast;
    if (this.phase > 0 || this.since < 0.45) return;
    this.phase = 1;
    const k = tuning.drowned.cat;
    const onto = this.v.copy(STEP).lerp(RIDGE, 0.25);
    onto.y = strandRoof(onto.x, onto.z);
    cat.leap(onto.clone(), { floor: strandRoof, then: 'stand', arc: 0.3 }, () => {
      cat.run([RIDGE, GAP], strandRoof, { pace: 'run', speed: k.runSpeed, then: 'sit', look: this.head }, () => {
        cat.unease = 0.7;
        cat.mewing = true;
        cat.mew(1);
        this.to('waits');
      });
    });
  }

  /** She looks back at the dark, then at the cat, and climbs out after it and up to the ridge. */
  private goAfter(): void {
    const k = tuning.drowned.cat;
    if (this.since < 0.6 + k.looksBack + k.looksAtCat) return;
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
        return this.since < 6 || Math.floor(this.now / 6) % 3 === 0 ? this.eye : null;
      case 'waits': {
        const k = tuning.drowned.cat;
        return this.since > 0.6 && this.since < 0.6 + k.looksBack ? this.darkAt : this.eye;
      }
      default:
        return this.eye;
    }
  }

  /** The drawn gust's direction on screen: from the tub toward where it has to go. */
  afterCamera(camera: THREE.Camera): void {
    if (!this.invitation) { this.heading = null; return; }
    const a = this.v.copy(this.tub.position).project(camera);
    const ax = a.x, ay = a.y;
    const b = this.v.copy(this.goal).project(camera);
    const aspect = (camera as THREE.PerspectiveCamera).aspect ?? 1;
    this.heading = Math.atan2(b.y - ay, (b.x - ax) * aspect);
  }
}
