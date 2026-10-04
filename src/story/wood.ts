import type { CheckpointPayload } from './checkpoint-data';
import * as THREE from 'three';
import type { StormStrike } from '../fx/storm';
import type { Shot } from '../camera';
import type { Coal } from '../fx/embers';
import type { Coax } from '../fx/swirl';
import { tuning } from '../tuning';
import { heightAt } from '../world/island';
import { WOOD_BERTH, WOOD_LANDING, WOOD_PATH, WOOD_REFUGE, WOOD_HEARTH, WOOD_OUTSIDE, WOOD_COAX, WOOD_APPROACH_LIGHT, WOOD_PLANE, WOOD_PLANE_LIGHT, woodPlaneSway } from '../world/wood';
import type { Cast, Chapter } from './cast';
import { cue } from './cues';
import { WOOD_SHAPE, SHAPE_RIGHT, SHAPE_FACING, SHAPE_SIDE_COAL, SHAPE_THROW_COAL, SHAPE_WAIT, OWL_PERCH_LOCAL, OWL_FLIGHT_LOCAL, shapePoint, throwShapeLight, showShape, coalLight } from '../world/wood-shape';
import { woodOwl } from '../creatures/owl';

/** Where the cygnet goes to ground when the storm frightens it out of the hood: just off the path, in the dark. */
const HIDING = WOOD_REFUGE;
const SODDEN = WOOD_PLANE;

/** How much light there has to be before the child will trust it enough to move. */
const ENOUGH = 1.2;
/** How near a waypoint counts as reached. */
const REACHED = 7;

/** The walk as one line, so a coal can be laid a given number of paces up it rather than at a corner of it. */
const WAY = [WOOD_LANDING, ...WOOD_PATH];
const LEG_END: number[] = [];
{
  let run = 0;
  for (let i = 1; i < WAY.length; i++) {
    run += WAY[i].distanceTo(WAY[i - 1]);
    LEG_END.push(run);
  }
}
const PATH_LENGTH = LEG_END[LEG_END.length - 1];

/** A point `along` the walk from the landing, `side` units to the right of the middle of it. */
function pathPoint(along: number, side: number, out: THREE.Vector2): THREE.Vector2 {
  const d = Math.max(0, Math.min(PATH_LENGTH - 0.01, along));
  let i = 0;
  while (i < LEG_END.length - 1 && LEG_END[i] < d) i++;
  const a = WAY[i];
  const b = WAY[i + 1];
  const start = i === 0 ? 0 : LEG_END[i - 1];
  const t = (d - start) / Math.max(0.001, LEG_END[i] - start);
  const dir = new THREE.Vector2(b.x - a.x, b.y - a.y).normalize();
  return out.set(a.x + (b.x - a.x) * t + dir.y * side, a.y + (b.y - a.y) * t - dir.x * side);
}

/** How far up the walk a point is, measured along the line rather than as the crow flies. */
function pathAlong(x: number, z: number): number {
  let best = 1e9;
  let at = 0;
  for (let i = 1; i < WAY.length; i++) {
    const a = WAY[i - 1];
    const b = WAY[i];
    const dx = b.x - a.x;
    const dz = b.y - a.y;
    const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.y) * dz) / (dx * dx + dz * dz)));
    const d = Math.hypot(x - a.x - dx * t, z - a.y - dz * t);
    if (d < best) {
      best = d;
      at = (i === 1 ? 0 : LEG_END[i - 2]) + Math.hypot(dx, dz) * t;
    }
  }
  return at;
}

/** Which side of the walk a point lies, 1 right of the way up and -1 left of it; 0 on the line itself. */
function pathSide(x: number, z: number): number {
  let best = 1e9;
  let side = 0;
  for (let i = 1; i < WAY.length; i++) {
    const a = WAY[i - 1];
    const b = WAY[i];
    const dx = b.x - a.x;
    const dz = b.y - a.y;
    const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.y) * dz) / (dx * dx + dz * dz)));
    const ox = x - a.x - dx * t;
    const oz = z - a.y - dz * t;
    const d = Math.hypot(ox, oz);
    if (d < best) {
      best = d;
      side = d < 0.5 ? 0 : Math.sign(oz * dx - ox * dz);
    }
  }
  return side;
}

const APPROACH_ALONG = pathAlong(WOOD_APPROACH_LIGHT.x, WOOD_APPROACH_LIGHT.y);
const PLANE_ALONG = pathAlong(WOOD_PLANE_LIGHT.x, WOOD_PLANE_LIGHT.y);
/** How far up the walk the coal before the bend lies: the chain ends there until the thing at the bend is faced. */
const THROW_ALONG = pathAlong(SHAPE_THROW_COAL.x, SHAPE_THROW_COAL.y);
const OWL_PERCH = shapePoint(OWL_PERCH_LOCAL.x, OWL_PERCH_LOCAL.y, OWL_PERCH_LOCAL.z);
const OWL_FLIGHT = OWL_FLIGHT_LOCAL.map((p) => shapePoint(p.x, p.y, p.z));

type Beat = 'ashore' | 'first' | 'walk' | 'loom' | 'brave' | 'compose' | 'fright' | 'bolt' | 'lost' | 'found' | 'plane' | 'snag' | 'fall' | 'pickup' | 'out' | 'toBoat' | 'push' | 'aboard';

/**
 * The dark wood: the first winter storm, at night, on the smallest island of the chain. There is no grass to bend
 * and nothing to throw, so the wind does the only other thing it can do — it breathes on fire. The player fans
 * embers awake out of the leaf litter and the child walks toward wherever the light is. The light is the path.
 *
 * And halfway up, the storm frightens the cygnet out of the hood and it goes to ground somewhere off the path in the
 * dark, and calls. The player finds it by putting light on it. This is the room the whole story is for: something
 * small trusted the child, and the child went into the dark first so that it would not have to.
 */
export class WoodChapter implements Chapter {
  beat: Beat = 'ashore';
  readonly breeze = 1;
  readonly worldLife = 1;
  pace = 0.4;
  haze = 0.9;
  dusk = 2;
  shower = 1;
  storm = 1;
  stormStrike: StormStrike | null = null;
  hush = 0.6;
  embers = 0;
  /** Carried, because the walk up the wood is slow and continuous and an eased camera trails below the child. */
  readonly shot: Shot = { target: new THREE.Vector3(), distance: 15, height: 5, carry: true, smoothFit: tuning.wood.cameraFitResponse };
  readonly music = 'wood' as const;
  readonly season = 0.84;
  readonly focus = new THREE.Vector3();
  private leg = 0;
  private now = 0;
  private beatStart = 0;
  private nextCall = 0;
  private lit = 0;
  private readonly light = new THREE.Vector3();
  /** What the child and the camera are drawn to: the fire if there is one, and the next coal if there is not. */
  private readonly glow = new THREE.Vector3();
  private readonly tmp = new THREE.Vector3();
  private readonly side = new THREE.Vector3();
  private readonly spot = new THREE.Vector2();
  private readonly childSubject = new THREE.Vector3();
  private readonly birdSubject = new THREE.Vector3();
  private readonly refugeSubject = new THREE.Vector3();
  /** The way they are going, eased, so the shot swings round with the path instead of snapping to every turn. */
  private readonly aim = new THREE.Vector3(0, 0, -1);
  /**
   * How far the walking camera stands off her right shoulder (negative: her left). It crosses to whichever side of the
   * path the waiting coal is on: from behind her, looking where she looks, a coal straight ahead of her is hidden by her.
   */
  private shoulder: number = tuning.wood.cameraSide;
  /** The one unlit coal ahead of them: there is never a second, so there is never a choice to get wrong. */
  private ahead: Coal | null = null;
  private chainAt = 0;
  private chainSide = -1;
  private approachLit = false;
  private planeCoal: Coal | null = null;
  /** The coal laid within throw of where the cygnet is hiding, so the way to find it is the way they came. */
  private hearth: Coal | null = null;
  cameraCut = 0;
  private cutAfter = -1;

  constructor(private readonly cast: Cast) {
    const { child, plane, cygnet } = cast;
    this.shot.carryAnchor = child.position;
    cygnet.mayFly = false;
    plane.homeRadius = 1e9;
    plane.visible = false;
    plane.soggy.value = 1;
    child.stepAshore(cast.boat);
    if (cygnet.seat === 'cradle') cast.carry.stow();
    else cygnet.rideIn('satchel');
    child.walkTo(WOOD_LANDING.x, WOOD_LANDING.y - 14, false, () => this.to('first'), 1.4);
    /**
     * The first coal is already breathing in the litter before they are off the beach, close enough to the path
     * to be the first thing in frame and off it enough to be a thing rather than the ground. Everything the room
     * asks of the player is in it: one warm point in a blue-black world, and a gust across it takes it.
     */
    cast.embers.clearCoals();
    woodOwl.sit(OWL_PERCH, Math.atan2(SHAPE_FACING.x, SHAPE_FACING.z));
    this.chainAt = 21;
    this.ahead = cast.embers.lay(...this.at(this.chainAt, this.chainSide * 3.4));
    this.placeShoulder();
  }

  /** Stand on the waiting coal's side at once, where there is no earlier shot to move from. */
  private placeShoulder(): void {
    if (this.ahead) this.shoulder = (pathSide(this.ahead.p.x, this.ahead.p.z) || 1) * tuning.wood.cameraSide;
  }

  /** A coal's place on the walk, as the pair `lay` wants. */
  private at(along: number, side: number): [number, number] {
    pathPoint(along, side, this.spot);
    return [this.spot.x, this.spot.y];
  }

  /**
   * The next coal, laid at the edge of what the one that just caught is lighting: far enough to be worth walking
   * to, near enough that its glimmer is inside the new light, and always on the way up. One at a time.
   */
  private layNext(spacing = tuning.wood.chainStep, offset = tuning.wood.chainOffset): void {
    const t = tuning.wood;
    const c = this.cast.child.position;
    // Finish this stretch behind the rescue camera. Never offer another path coal beside the refuge.
    if (!this.bolted && this.chainAt >= APPROACH_ALONG) {
      this.ahead = null;
      return;
    }
    const start = Math.max(this.chainAt, pathAlong(c.x, c.z));
    let next = start + spacing;
    if (!this.throwCoal) {
      // Space the coals up the leg evenly, ending at the one before the bend.
      const remaining = THROW_ALONG - start;
      if (remaining <= tuning.wood.chainStep * 1.5) next = THROW_ALONG;
      else if (remaining <= tuning.wood.chainStep * 2.5) next = start + remaining / 2;
    }
    if (this.bolted && this.beat === 'walk') {
      // Space the last two fires evenly, ending at the tree rather than adding a second fire on arrival.
      const remaining = PLANE_ALONG - start;
      if (remaining <= t.chainStep * 1.5) next = PLANE_ALONG;
      else if (remaining <= t.chainStep * 2.5 && spacing === t.chainStep) next = start + remaining / 2;
    }
    const along = this.bolted ? next : Math.min(next, APPROACH_ALONG);
    // The open shore needs no final fire; the preceding ember is enough to leave the wood.
    if (along > PATH_LENGTH - 8) {
      this.ahead = null;
      return;
    }
    this.chainSide = -this.chainSide;
    this.chainAt = along;
    if (!this.throwCoal && along === THROW_ALONG) {
      this.throwCoal = this.cast.embers.lay(SHAPE_THROW_COAL.x, SHAPE_THROW_COAL.y);
      this.ahead = null;
      this.toShape();
      return;
    }
    this.ahead = this.bolted && this.beat === 'walk' && along === PLANE_ALONG
      ? (this.planeCoal = this.cast.embers.lay(WOOD_PLANE_LIGHT.x, WOOD_PLANE_LIGHT.y))
      : !this.bolted && along === APPROACH_ALONG
      ? this.cast.embers.lay(WOOD_APPROACH_LIGHT.x, WOOD_APPROACH_LIGHT.y)
      : this.cast.embers.lay(...this.at(along, this.chainSide * offset));
  }

  /** The player's wind is the light here, so it is theirs for all of it except the moment of gathering it up. */
  get scripted(): boolean {
    return this.beat === 'ashore' || this.beat === 'compose' || this.beat === 'fright' || this.beat === 'bolt' || this.beat === 'found' || this.beat === 'fall' || this.beat === 'pickup' || this.beat === 'push' || this.beat === 'aboard';
  }

  get caringWind(): boolean { return this.beat === 'lost'; }

  get departureKite(): boolean { return ['out', 'toBoat', 'push', 'aboard'].includes(this.beat); }

  get done(): boolean {
    return this.beat === 'aboard';
  }

  get checkpoint(): string | null {
    // Keep the legacy checkpoint name so existing saves still resume after retrieval.
    return this.beat === 'out' ? 'dry' : this.bolted && this.beat === 'walk' ? 'found' : null;
  }
  saveCheckpoint(): CheckpointPayload<'wood'> { return [this.leg, this.chainAt]; }
  restoreCheckpoint(point: string, data: number[]): void {
    this.leg = THREE.MathUtils.clamp(Math.floor(data[0]), 0, WOOD_PATH.length - 1);
    this.chainAt = data[1]; this.bolted = true;
    this.stormStrike = null;
    this.beat = point === 'dry' ? 'out' : 'walk';
    // Older saves aimed straight at the shore from the tree, through the trunks beside the last bend.
    const bend = WOOD_PATH.length - 2;
    if (point === 'dry' && pathAlong(this.cast.child.position.x, this.cast.child.position.z) < LEG_END[bend] - REACHED) this.leg = bend;
    this.cast.embers.clearCoals();
    this.chainSide = 1;
    // Restore the light already earned at this checkpoint, without lighting or skipping the next ember.
    const c = this.cast.child.position;
    const earned = this.cast.embers.lay(c.x + 2, c.z);
    this.cast.embers.blow(earned, 0.8);
    this.cast.embers.takeCaught();
    this.ahead = point === 'dry'
      ? null
      : this.chainAt >= PLANE_ALONG
      ? (this.planeCoal = this.cast.embers.lay(WOOD_PLANE_LIGHT.x, WOOD_PLANE_LIGHT.y))
      : this.cast.embers.lay(...this.at(this.chainAt, this.chainSide * tuning.wood.chainOffset));
    this.placeShoulder();
  }

  private to(beat: Beat): void {
    this.beat = beat;
    this.beatStart = this.now;
  }

  private get t(): number {
    return this.now - this.beatStart;
  }

  private target(): THREE.Vector2 {
    return WOOD_PATH[Math.min(this.leg, WOOD_PATH.length - 1)];
  }

  update(dt: number, time: number): void {
    this.now = time;
    if (this.cutAfter >= 0 && --this.cutAfter < 0) this.cameraCut++;
    const { child: c, plane: p, embers } = this.cast;
    /** The boat is waiting on the far shore, the way it always is — but it goes there once they are out of sight. */
    if (!this.moored && this.leg >= 2) {
      this.moored = true;
      this.cast.boat.beach(WOOD_BERTH.x, WOOD_BERTH.z, 0.2);
      this.cast.boat.grounded = true;
    }
    this.light.copy(c.position);
    this.lit = embers.brightest(this.light);
    this.embers = 1;
    /**
     * What the frame is turned toward: the fire while there is one, the coal waiting to be blown on when there is
     * not, and while the bird is out there in the dark, the dark it is calling from. The camera never leaves the
     * child's shoulder for it, so nobody is ever looking at a wood with neither of them in it.
     */
    const alone = this.beat === 'compose' || this.beat === 'fright' || this.beat === 'bolt' || this.beat === 'lost' || this.beat === 'found';
    if (alone) this.glow.copy(this.cast.cygnet.seating.shown.p);
    else if (this.ahead?.live && !this.ahead.lit) this.glow.copy(this.ahead.p);
    else {
      // Earned fires may now be behind the child. They illuminate the walk, but never turn the camera back.
      const next = this.target();
      this.glow.set(next.x, heightAt(next.x, next.y) + 0.95, next.y);
    }
    // Present inside the hollow, but concealed until the camera reveals its entrance.
    if (!this.bolted && !this.hearth && Math.hypot(c.position.x - HIDING.x, c.position.z - HIDING.z) < 23) {
      this.layHearth();
    }
    this.caught();
    woodOwl.update(dt);
    if (this.steering) this.steerShapeLight(dt);

    switch (this.beat) {
      case 'ashore':
        /** They come up the beach with one small glow already burning off the path, and they have seen it. */
        c.lookAt = this.ahead ? this.ahead.p : null;
        break;
      case 'first':
        /** The first light the player makes is the first thing the child has seen. They turn to it and go. */
        c.lookAt = this.glow;
        if (this.lit > ENOUGH && this.t > 1.2) this.to('walk');
        break;
      case 'loom':
        this.loom(dt);
        break;
      case 'brave':
        this.brave(dt);
        break;
      case 'walk':
        this.follow();
        if (!this.bolted && this.leg >= 2 && Math.hypot(c.position.x - HIDING.x, c.position.z - HIDING.z) < tuning.wood.shelterDistance) this.bolt();
        break;
      case 'compose':
        if (this.t >= tuning.wood.frightCompose && this.viewReady) {
          this.to('fright');
          this.stormStrike = { heading: Math.atan2(HIDING.x - c.position.x, HIDING.z - c.position.z) };
        }
        break;
      case 'fright':
        this.fright();
        break;
      case 'bolt':
        this.bolting(dt);
        if (this.cowering && this.now - this.refugeAt > tuning.wood.refugePause) {
          this.to('lost');
        }
        break;
      case 'lost':
        this.search(time);
        break;
      case 'found':
        this.reunite();
        break;
      case 'plane':
        this.poseCaughtPlane();
        this.reachTree();
        break;
      case 'snag':
        this.freePlane(dt);
        break;
      case 'fall':
        this.fallPlane();
        break;
      case 'pickup':
        this.reachPlane();
        break;
      case 'out':
        p.soggy.value = Math.max(0, p.soggy.value - dt / tuning.wood.paperRecoverSeconds);
        this.follow();
        break;
      case 'push':
        break;
      default:
        break;
    }

    this.paperBreath = 0;
    this.watchInvitation();
    this.heading(dt);
    this.weather(dt);
    if (p.held) p.hold(c);
    this.frame();
  }

  /**
   * The wood only lets them past while there is light. A child alone in the dark does not walk into it, so they go
   * on for exactly as long as the player keeps something burning, and stop and wait the moment it goes out. Light
   * thrown up the path pulls them along it; light thrown anywhere else is looked at, and never punished.
   */
  private inDark = false;

  private follow(): void {
    const { child: c } = this.cast;
    const t = this.target();
    const last = this.leg >= WOOD_PATH.length - 1;
    if (Math.hypot(c.position.x - t.x, c.position.z - t.y) < REACHED && !last) this.leg++;

    if (this.beat === 'walk' && this.leg >= 4) { this.toPlane(); return; }
    if (this.beat === 'out' && last && Math.hypot(c.position.x - t.x, c.position.z - t.y) < REACHED + 4) {
      this.board();
      return;
    }

    // Once the last forest ember is lit, continue across the open shore even if its light fades.
    const enteringGlade = !this.bolted && this.approachLit;
    const leavingWood = this.beat === 'out';
    const needsLight = !enteringGlade && !leavingWood;
    if (!this.ahead && this.lit < ENOUGH && needsLight) {
      this.ahead = this.cast.embers.lay(t.x, t.y);
    }

    // Once the light has run out she waits for more of it, not for a flicker back over the edge: no half steps.
    this.inDark = needsLight && this.lit < (this.inDark ? ENOUGH * 1.1 : ENOUGH);
    if (this.inDark) {
      if (c.moving) c.stop();
      c.lookAt = this.ahead ? this.ahead.p : this.lit > 0 ? this.light : null;
      return;
    }
    c.lookAt = this.glow;
    const waiting = this.ahead?.live && !this.ahead.lit ? this.ahead.p : null;
    if (waiting && Math.hypot(waiting.x - c.position.x, waiting.z - c.position.z) < tuning.wood.waitShort) {
      if (c.moving) c.stop();
      return;
    }
    if (c.busy) return;
    /** Toward the light when it is out ahead of them, and on up the path when it is not. */
    const gain = Math.hypot(c.position.x - t.x, c.position.z - t.y) - Math.hypot(this.light.x - t.x, this.light.z - t.y);
    const away = Math.hypot(this.light.x - c.position.x, this.light.z - c.position.z);
    // The last light marks the verge; keep walking along the path instead of steering into its glow.
    const lead = needsLight && gain > 1 && away > 3;
    const to = lead ? this.light : { x: t.x, z: t.y };
    if (!c.moving || this.now > this.aimed + 0.8) {
      this.aimed = this.now;
      c.walkTo(to.x, to.z, false, undefined, lead ? 2.4 : REACHED * 0.6);
    }
  }

  /**
   * A coal taking is the only event in the room, so everything answers it at once: the music lifts, the light
   * jumps, and the next faint one is laid at the edge of what it has just lit. The chain is the path.
   */
  private caught(): void {
    for (const coal of this.cast.embers.takeCaught()) {
      if (!this.bolted && coal === this.ahead && this.chainAt === APPROACH_ALONG) this.approachLit = true;
      cue(coal === this.hearth ? 'comfort' : 'kindled');
      if (coal === this.planeCoal && this.beat === 'walk') continue;
      if (coal === this.ahead && this.beat === 'plane') continue;
      if (coal === this.sideCoal) continue;
      if (coal === this.throwCoal) { this.throwCaught(); continue; }
      if (coal === this.ahead && this.beat !== 'compose' && this.beat !== 'fright' && this.beat !== 'bolt' && this.beat !== 'lost') this.layNext();
      else if (coal === this.ahead) this.ahead = null;
    }
  }

  private aimed = 0;
  private moored = false;

  /** One close strike causes the escape. The child never chooses to put the bird down. */
  private bolt(): void {
    const { child: c } = this.cast;
    if (this.bolted) return;
    this.to('compose');
    this.bolted = true;
    this.hush = 1;
    c.stop();
    if (!this.hearth) this.layHearth();
    // Leave the path lights where the player found them; the camera turns toward the refuge.
    this.ahead = null;
  }

  private layHearth(): void {
    this.hearth = this.cast.embers.lay(WOOD_HEARTH.x, WOOD_HEARTH.z);
    this.hearth.p.y = heightAt(WOOD_HEARTH.x, WOOD_HEARTH.z) + 0.48;
    this.hearth.reveal = 0;
  }

  private viewReady = false;
  private entranceVisible = false;
  private reachedAfterBird = false;
  private landedAt = 0;
  private enteredShelter = false;
  private readonly composeEye = new THREE.Vector3();
  private readonly revealEye = new THREE.Vector3();
  private readonly cameraPoint = new THREE.Vector3();
  private readonly offeredHand = new THREE.Vector3();

  /** Wait for the actual rendered angle, including portrait fitting and terrain corrections. */
  afterCamera(camera: THREE.PerspectiveCamera): void {
    this.aspect = camera.aspect;
    if (this.beat === 'compose' && this.shot.eye) {
      const child = this.cast.child.position;
      this.tmp.copy(camera.position).sub(child).setY(0).normalize();
      this.cameraPoint.copy(this.shot.eye).sub(child).setY(0).normalize();
      const aligned = this.tmp.dot(this.cameraPoint) > 0.985;
      this.cameraPoint.copy(child).y += 1.5;
      this.cameraPoint.project(camera);
      this.viewReady = aligned && Math.abs(this.cameraPoint.x) < 0.7 && Math.abs(this.cameraPoint.y) < 0.7;
    }
    if (this.hearth && ['bolt', 'lost', 'found'].includes(this.beat)) {
      this.cameraPoint.copy(this.hearth.p).project(camera);
      const dx = WOOD_HEARTH.x - camera.position.x;
      this.entranceVisible = dx > 3 && Math.abs(camera.position.z - WOOD_HEARTH.z) / dx < 0.6
        && Math.abs(this.cameraPoint.x) < 0.82 && Math.abs(this.cameraPoint.y) < 0.82;
    }
  }

  private startled = false;
  private refugeAt = 0;
  private goingToBird = false;
  private coaxAt = 0;
  private coaxing = false;
  private comingOut = false;
  private gathering = false;

  private fright(): void {
    const { child: c, cygnet, carry } = this.cast;
    if (!this.startled && this.t >= tuning.wood.frightThunderDelay) {
      this.startled = true;
      cygnet.mind.startle(1);
      cygnet.does('flinch');
      c.lean = -0.12;
    }
    if (this.t < tuning.wood.frightJumpAfter || carry.busy) return;
    // Freeze a nearby landing before detaching. Moving this target toward the refuge midair was the teleport.
    const from = cygnet.seating.shown.p;
    this.tmp.set(Math.cos(c.yaw), 0, -Math.sin(c.yaw));
    if (this.tmp.dot(this.side.copy(HIDING).sub(from)) < 0) this.tmp.negate();
    this.tmp.multiplyScalar(tuning.wood.frightJumpDistance).add(from);
    cygnet.startleJump(this.tmp);
    cygnet.pace = tuning.wood.frightenedPace;
    c.lean = 0;
    cygnet.call(false);
    this.to('bolt');
  }

  /** Its ordinary gait carries it into nearby cover, and its feet decide when the run is over. */
  private bolting(dt: number): void {
    const { child: c, cygnet } = this.cast;
    c.faceToward(cygnet.seating.shown.p.x, cygnet.seating.shown.p.z, 1 - Math.exp(-dt * 3));
    if (!this.reachedAfterBird && this.t > 0.3) { this.reachedAfterBird = true; c.reach(); }
    if (cygnet.stay && !cygnet.seating.move) {
      if (!this.landedAt) this.landedAt = this.now;
      if (this.now - this.landedAt > tuning.wood.frightLandingPause) {
        cygnet.stay = false;
        cygnet.errand = WOOD_OUTSIDE;
      }
    }
    if (this.hearth && this.entranceVisible && this.t > tuning.wood.frightJumpDuration + 1.5) {
      this.hearth.reveal = Math.min(1, this.hearth.reveal + dt * 1.4);
    }
    if (!this.enteredShelter && !cygnet.stay && Math.hypot(cygnet.position.x - WOOD_OUTSIDE.x, cygnet.position.z - WOOD_OUTSIDE.z) < 0.65) {
      this.enteredShelter = true;
      cygnet.errand = HIDING;
    }
    if (this.enteredShelter && Math.hypot(cygnet.position.x - HIDING.x, cygnet.position.z - HIDING.z) < 0.5 && !this.cowering) {
      this.cowering = true;
      this.refugeAt = this.now;
      cygnet.errand = null;
      cygnet.pace = 1;
      cygnet.cower();
      cygnet.watch(c.position);
      cygnet.call(false);
      this.nextCall = this.now + 4;
    }
    c.lookAt = cygnet.position;
  }

  private cowering = false;
  private bolted = false;

  /**
   * It is somewhere out there in the dark and it is calling, and the only way to find it is to put light on it.
   * Nothing hurries the player and nothing goes wrong if they take all night: it keeps calling until they come.
   */
  private search(time: number): void {
    const { child: c, cygnet } = this.cast;
    c.lookAt = cygnet.position;
    if (this.hearth && this.entranceVisible) this.hearth.reveal = 1;
    if (time > this.nextCall) {
      cygnet.call(false);
      this.nextCall = time + 3.4 + Math.random() * 1.6;
    }
    if (c.busy || c.moving) return;
    /** Found only when the player lights the waiting coal beside the hiding place. */
    if (this.hearth?.lit && this.hearth.reveal > 0.95) {
      this.to('found');
      c.lean = -0.08;
    }
  }

  /** The light shows who needs them. A breath of hesitation, then the child leaves its safe patch to help. */
  private reunite(): void {
    const { child: c, cygnet } = this.cast;
    c.lookAt = cygnet.position;
    if (this.gathering) return;
    if (!this.goingToBird) {
      c.lean = -0.08 * Math.max(0, 1 - this.t / tuning.wood.rescueResolve);
      if (this.t < tuning.wood.rescueResolve) return;
      this.goingToBird = true;
      // Stop outside the rock. The child never has to put its head or hands through the lip.
      c.walkTo(WOOD_COAX.x, WOOD_COAX.z, false, () => {
        c.stop(); c.faceToward(HIDING.x, HIDING.z, 1); c.kneeling = 1;
        this.coaxAt = this.now; this.coaxing = true;
      }, 0.15);
    }
    if (!this.coaxing) return;
    // One low, still mitten offers a place to come to, rather than reaching into the hollow.
    c.reachFor(0, this.offeredHand.set(WOOD_COAX.x + 0.75, c.position.y + 0.55, WOOD_COAX.z));
    cygnet.watch(this.offeredHand);
    if (!this.comingOut && this.now - this.coaxAt > tuning.wood.coaxWait) {
      this.comingOut = true;
      cygnet.follow(); cygnet.stay = false; cygnet.pace = 0.32; cygnet.errand = WOOD_OUTSIDE;
    }
    if (!this.comingOut || cygnet.position.distanceToSquared(this.tmp.set(WOOD_OUTSIDE.x, cygnet.position.y, WOOD_OUTSIDE.z)) > 0.28) return;
    this.gathering = true;
    cygnet.errand = null; cygnet.stay = true; cygnet.pace = 1;
    c.reachFor(0, null);
    this.cast.carry.gatherUp(() => {
      cygnet.bind(0.35); cygnet.stay = false;
      this.hearth = null;
      this.to('walk'); this.chainAt = pathAlong(c.position.x, c.position.z);
      // The first coal after the rescue goes on the side its framing was made for, however many came before.
      this.chainSide = -1;
      if (!this.ahead) this.layNext(tuning.wood.rescueChainStep, tuning.wood.rescueChainOffset);
    });
  }

  private planeWork = 0;
  private planeGoal = 0;
  private planeTug = 0;
  private readonly snagAt = new THREE.Vector3();
  private readonly planeLanding = new THREE.Vector3();
  private readonly fallFrom = new THREE.Vector3();
  private readonly planeRotation = new THREE.Euler();
  private readonly fallRotation = new THREE.Euler();
  private readonly snagSway = new THREE.Vector3();
  private readonly snagWind = { x: 0, z: 0, energy: 0, lift: 0 };

  /** The last fire reveals the paper caught above their reach in a bare fork. */
  private toPlane(): void {
    const { plane: p } = this.cast;
    this.to('plane');
    this.cast.child.stop();
    p.visible = true;
    p.soggy.value = 1;
    this.snagAt.set(SODDEN.x, heightAt(SODDEN.x, SODDEN.y) + tuning.wood.planeSnagHeight, SODDEN.y);
    this.planeLanding.set(SODDEN.x + 1.5, heightAt(SODDEN.x + 1.5, SODDEN.y + 2) + 0.1, SODDEN.y + 2);
    this.planeRotation.set(-1.0, 0.7, 0.42);
    this.poseCaughtPlane();
    p.home.set(SODDEN.x, 0, SODDEN.y);
    this.leg = WOOD_PATH.length - 2;
    /** A coal in the leaves beside it, so the thing they have been walking toward all night shows them the plane. */
    this.ahead = this.planeCoal?.live ? this.planeCoal
      : (this.planeCoal = this.cast.embers.lay(WOOD_PLANE_LIGHT.x, WOOD_PLANE_LIGHT.y));
    this.chainAt = pathAlong(SODDEN.x, SODDEN.y);
  }

  private reachTree(): void {
    const { child: c, plane: p } = this.cast;
    if (c.busy) return;
    if (!this.ahead?.live) this.ahead = this.planeCoal = this.cast.embers.lay(WOOD_PLANE_LIGHT.x, WOOD_PLANE_LIGHT.y);
    if (!this.ahead.lit) {
      if (c.moving) c.stop();
      c.lookAt = this.ahead.p;
      return;
    }
    const gap = Math.hypot(c.position.x - SODDEN.x, c.position.z - SODDEN.y - 4.5);
    if (gap > 0.8) {
      if (!c.moving) c.walkTo(SODDEN.x, SODDEN.y + 4.5, false, undefined, 0.5);
      c.lookAt = p.position;
      return;
    }
    c.stop();
    c.faceToward(SODDEN.x, SODDEN.y, 1);
    c.lookAt = p.position;
    this.to('snag');
  }

  /** Like the scarf, strokes across the visible snag accumulate; idle storm wind never completes it. */
  private freePlane(dt: number): void {
    const { plane: p, child: c } = this.cast;
    const k = tuning.wood;
    // Keep the light the player already earned while they work; taking time never hides the snag.
    if (this.ahead?.lit) this.ahead.heat = Math.max(k.planeEmberHold, this.ahead.heat);
    this.planeGoal = Math.min(1, this.planeGoal + Math.min(0.16, dt * this.paperBreath / k.planeStrokeDistance));
    this.planeWork += (this.planeGoal - this.planeWork) * (1 - Math.exp(-dt * k.planeTugResponse));
    this.planeTug += (Math.min(1, this.paperBreath * 2) - this.planeTug) * (1 - Math.exp(-dt * k.planeTugResponse));
    this.poseCaughtPlane();
    c.lookAt = p.position;
    if (this.planeGoal === 1 && this.planeWork > 0.995) {
      this.fallFrom.copy(p.position); this.fallRotation.copy(this.planeRotation);
      this.to('fall');
    }
  }

  /** The fork carries the paper with it; a small, slower rocking invites the stronger player flutter. */
  private poseCaughtPlane(): void {
    const { wind, plane } = this.cast;
    wind.sample(SODDEN.x, SODDEN.y, this.snagWind);
    woodPlaneSway(this.now, wind.breeze, this.snagWind, this.snagSway);
    const k = tuning.wood;
    const along = (this.snagSway.x * wind.breeze.x + this.snagSway.z * wind.breeze.y)
      / Math.max(0.001, wind.breeze.length() * k.planeTreeSway);
    const rock = along * k.planeIdleRock * (1 - this.planeTug * 0.7);
    const flutter = Math.sin(this.now * 19) * this.planeTug;
    this.tmp.copy(this.snagAt).add(this.snagSway).add(this.side.set(0.75, 0.18, 0.28).multiplyScalar(this.planeWork));
    this.tmp.y += flutter * 0.065;
    this.planeRotation.set(-1.0 + this.planeWork * 0.45 + rock * 0.65 + flutter * 0.08,
      0.7 + this.planeWork * 0.45 + rock * 0.4, 0.42 - this.planeWork * 0.3 + rock + flutter * 0.16);
    plane.pin(this.tmp, this.planeRotation);
  }

  /** Heavy, wet paper flutters down to a safe pickup spot instead of being swept away again. */
  private fallPlane(): void {
    const k = Math.min(1, this.t / tuning.wood.planeFallSeconds);
    this.tmp.lerpVectors(this.fallFrom, this.planeLanding, k);
    this.tmp.y = THREE.MathUtils.lerp(this.fallFrom.y, this.planeLanding.y, k * k);
    this.tmp.x += Math.sin(k * Math.PI * 2) * Math.sin(k * Math.PI) * 0.25;
    this.planeRotation.set(THREE.MathUtils.lerp(this.fallRotation.x, -0.05, k) + Math.sin(k * Math.PI * 2) * 0.25,
      THREE.MathUtils.lerp(this.fallRotation.y, 0, k), THREE.MathUtils.lerp(this.fallRotation.z, 0.12, k) + Math.sin(k * Math.PI * 3) * (1 - k) * 0.22);
    this.cast.plane.pin(this.tmp, this.planeRotation);
    this.cast.child.lookAt = this.cast.plane.position;
    if (k >= 1) { this.cast.plane.layDown(this.planeLanding); this.to('pickup'); }
  }

  private reachPlane(): void {
    const { child: c, plane: p, cygnet, carry } = this.cast;
    c.lookAt = p.position;
    if (c.busy || carry.busy || !p.landed) return;
    // Settle the bird safely before using the free hand to collect the paper.
    if (cygnet.seat !== 'satchel') { c.stop(); carry.stow(); return; }
    if (Math.hypot(c.position.x - p.position.x, c.position.z - p.position.z) > 2.4) {
      if (!c.moving) c.walkTo(p.position.x, p.position.z, false, undefined, 1.6);
      return;
    }
    c.stop(); c.faceToward(p.position.x, p.position.z, 1);
    c.pickUp(() => {
      p.hold(c);
      this.to('out');
      // The fire by the tree lights them out; the path's last bend keeps them in the corridor clear of trunks.
      this.ahead = null;
    }, p.position);
  }

  private paperBreath = 0;

  /** Screen-local breath from deliberate strokes across the caught paper. */
  brushDry(amount: number): void { this.paperBreath = amount; }

  get windInvitation(): THREE.Vector3 | null {
    return this.beat === 'snag' && !this.scripted ? this.cast.plane.position : null;
  }

  private get waitingCoal(): Coal | null {
    if (this.scripted || this.beat === 'bolt' || this.beat === 'toBoat' || this.beat === 'snag') return null;
    const coal = this.beat === 'lost' ? (this.hearth && this.hearth.reveal > 0.95 ? this.hearth : null) : this.ahead;
    return coal?.live && !coal.lit ? coal : null;
  }

  get updraftTarget(): THREE.Vector3 | null {
    if (this.beat === 'loom' || this.beat === 'brave') return this.shapeWaiting?.p ?? null;
    return this.waitingCoal?.p ?? null;
  }

  private readonly asking: Coax = { at: new THREE.Vector3(), urgency: tuning.wood.inviteCoalUrgency, radius: tuning.wood.inviteCoalRadius };
  private askedFor: Coal | null = null;
  private askedAt = 0;
  private workedAt = -Infinity;

  /** The waiting coal's updraft shows after the same wait as other invitations, and gives way while the player works it. */
  private watchInvitation(): void {
    const coal = this.waitingCoal;
    if (coal !== this.askedFor) { this.askedFor = coal; this.askedAt = this.now; this.workedAt = -Infinity; }
    if (coal && coal.breath > 0) this.workedAt = this.now;
  }

  get coax(): Coax | null {
    if (this.beat === 'loom') return this.shapeCoax();
    const coal = this.waitingCoal;
    if (!coal || coal !== this.askedFor || this.now - this.askedAt < tuning.wood.inviteAfter
      || this.now - this.workedAt < tuning.invitation.resumeAfter) return null;
    // Wound from the litter beneath the orb, so the loops rise through the light rather than above it.
    this.asking.at.set(coal.p.x, Math.max(heightAt(coal.p.x, coal.p.z), 0), coal.p.z);
    return this.asking;
  }

  private board(): void {
    const { child: c, boat } = this.cast;
    this.to('toBoat');
    c.lookAt = null;
    const beside = boat.boardingPoint(this.tmp);
    c.walkTo(beside.x, beside.z, false, () => {
      this.to('push');
      c.faceToward(boat.position.x, boat.position.z, 1);
      c.board(boat, () => this.to('aboard'));
    }, 0.6);
  }

  /** Where the walk is pointing: toward the light when there is one out ahead, and up the path when there is not. */
  private heading(dt: number): void {
    if (['compose', 'fright', 'bolt', 'lost', 'found', 'loom', 'brave'].includes(this.beat)) return;
    const c = this.cast.child.position;
    const t = this.target();
    const next = this.ahead?.live && !this.ahead.lit ? this.ahead.p : null;
    const ahead = next && (next.x - c.x) * (t.x - c.x) + (next.z - c.z) * (t.y - c.z) > 0;
    const toward = ahead ? next : this.tmp.set(t.x, 0, t.y);
    this.side.set(toward.x - c.x, 0, toward.z - c.z);
    if (this.side.lengthSq() < 1) return;
    const ease = 1 - Math.exp(-dt * 0.5);
    this.aim.lerp(this.side.normalize(), ease);
    if (this.aim.lengthSq() > 0.01) this.aim.normalize();
    if (next) this.shoulder += ((pathSide(next.x, next.z) || Math.sign(this.shoulder)) * tuning.wood.cameraSide - this.shoulder) * ease;
  }

  /** The storm blows itself out over the second half of the wood, and the night starts to go grey at the edges. */
  private weather(dt: number): void {
    const easing = this.beat === 'out' || this.beat === 'toBoat' || this.beat === 'push' || this.beat === 'aboard';
    this.storm += ((easing ? 0.15 : 1) - this.storm) * (1 - Math.exp(-dt * 0.12));
    this.shower = Math.max(0, this.storm - 0.2) * 1.25;
    /** Never thin: from the crest of the wood you can see the home island's hill, and home is the last surprise. */
    this.haze = 0.9 + this.storm * 0.06;
    const alone = this.beat === 'compose' || this.beat === 'fright' || this.beat === 'bolt' || this.beat === 'lost';
    const quiet = alone ? 1 : this.beat === 'found' ? 0.75 : 0.55;
    this.hush += (quiet - this.hush) * (1 - Math.exp(-dt * 0.7));
  }

  private frame(): void {
    const c = this.cast.child.position;
    const s = this.shot;
    s.from = undefined;
    s.eye = undefined;
    s.subjects = undefined;
    s.zoom = undefined;
    // Return from the shelter around the child. A straight eye interpolation crosses the subject
    // and whips the view through a half-turn just as the walk resumes.
    s.orbit = true;
    const ground = Math.max(heightAt(c.x, c.z), 0);
    if (['plane', 'snag', 'fall', 'pickup'].includes(this.beat)) {
      this.childSubject.copy(c).y += 1.5;
      this.birdSubject.copy(this.cast.plane.position);
      s.target.copy(this.childSubject).lerp(this.birdSubject, 0.55);
      s.eye = this.side.set(SODDEN.x + 9, ground + 5.7, Math.max(c.z + 10, SODDEN.y + 14));
      s.subjects = { primary: this.childSubject, secondary: this.birdSubject,
        tertiary: this.beat === 'plane' ? this.ahead?.p : undefined, margin: 0.8, extra: 16 };
      this.pace = 1.1; this.focus.copy(s.target);
      return;
    }
    if (this.beat === 'toBoat' || this.beat === 'push' || this.beat === 'aboard') {
      const b = this.cast.boat.position;
      s.target.set((c.x + b.x) / 2, b.y + 2, (c.z + b.z) / 2 - 2);
      s.distance = 22;
      s.height = 6;
      this.pace = 0.35;
      this.focus.copy(b);
      return;
    }
    if (this.beat === 'loom' || this.beat === 'brave') {
      this.frameShape(ground);
      return;
    }
    /** Close in behind them, leaning a little toward the light but never far enough to leave them behind. */
    const near = this.beat === 'compose' || this.beat === 'fright' || this.beat === 'bolt' || this.beat === 'lost' || this.beat === 'found';
    if (near) {
      s.orbit = false;
      this.childSubject.copy(c).y += 1.5;
      this.birdSubject.copy(this.cast.cygnet.seating.shown.p).y += 0.4;
      const reveal = this.beat === 'compose' || this.beat === 'fright' ? 0
        : this.beat === 'bolt' ? THREE.MathUtils.smootherstep(this.t, tuning.wood.frightJumpDuration + 0.3, tuning.wood.frightJumpDuration + 3.2) : 1;
      this.refugeSubject.set(HIDING.x, heightAt(HIDING.x, HIDING.z) + 0.9, HIDING.z);
      s.target.copy(this.childSubject).lerp(this.refugeSubject, reveal * 0.62);
      this.composeEye.set(c.x - 5.5, ground + 3.8, c.z + 8.5);
      this.revealEye.set(HIDING.x - 17, ground + 3.4, HIDING.z + 5.5);
      // See the offered hand and the bird's way out beside the child, instead of through their back.
      if (this.beat === 'found') {
        const reunion = THREE.MathUtils.smootherstep(this.t, 0, tuning.wood.rescueResolve + 1);
        this.revealEye.lerp(this.cameraPoint.set(HIDING.x - 12, ground + 3.4, HIDING.z - 7), reunion);
      }
      s.eye = this.side.copy(this.composeEye).lerp(this.revealEye, reveal);
      s.subjects = { primary: this.childSubject, secondary: this.birdSubject,
        tertiary: reveal > 0.65 ? this.hearth?.p : undefined, margin: 0.65, extra: 18 };
      this.pace = this.beat === 'compose' ? 2.2 : 2.8;
      this.focus.copy(s.target);
      return;
    }
    this.walkFrame(ground);
    if (this.ahead?.live && !this.ahead.lit) {
      this.childSubject.copy(c).y += 1.5;
      // Preserve the same clear sightline to the next interaction that the rescue already has.
      s.subjects = { primary: this.childSubject, secondary: this.ahead.p, margin: 0.72, extra: 12 };
    }
    this.pace = tuning.wood.cameraPace;
    this.focus.copy(c);
  }

  /** Close in behind her, on the waiting coal's side, leaning a little toward the light. */
  private walkFrame(ground: number): void {
    const c = this.cast.child.position;
    const s = this.shot;
    const lean = Math.min(1, 14 / Math.max(1, Math.hypot(this.glow.x - c.x, this.glow.z - c.z))) * tuning.wood.cameraLead;
    const dx = (this.glow.x - c.x) * lean;
    const dz = (this.glow.z - c.z) * lean;
    s.target.set(c.x + dx, ground + 1.9, c.z + dz);
    /**
     * The eye is placed on the ground behind them rather than hung a fixed height above the target, because the
     * wood is a steep dome and a fixed height put the camera in the hillside going up and in the air coming down.
     * It stays put behind them however far the frame leans toward the light: sliding it as well turned the child
     * out of the picture altogether, which is the one thing this room is not allowed to do.
     */
    /** And it stands behind the way they are going, not behind north: the wood's path doubles back on itself, and
     * a camera that always looked up the island left the next coal out at the side of the frame on half the legs. */
    const ex = c.x - this.aim.x * tuning.wood.cameraBack - this.aim.z * this.shoulder;
    const ez = c.z - this.aim.z * tuning.wood.cameraBack + this.aim.x * this.shoulder;
    s.eye = this.side.set(ex, Math.max(Math.max(heightAt(ex, ez), 0), ground) + tuning.wood.cameraUp, ez);
  }

  // The thing at the bend: a dead stump with an owl down in its fork, which in the dark is a beast with antlers.

  private shapeDone = false;
  private shapeStopped = -1;
  private shapeReveal = 0;
  private shapeFear = 0.2;
  /** The last coal before the bend, beside her where she stops: its light throws the antlers up the rock. */
  private throwCoal: Coal | null = null;
  private throwLitAt = -1;
  /** The one waiting coal at the stump, off to the side, whose light shows the stump and the owl for what they are. */
  private sideCoal: Coal | null = null;
  /** The first coal laid after the bend: until it is lit, the light at the stump stays the side coal's. */
  private afterShape: Coal | null = null;
  private shapeWorkedAt = -Infinity;
  /** How much of the light, and of the shadow on the rock, has swung round from the coal before the bend to the side coal. */
  private lightShare = 0;
  private shapePower = 0;
  /** How much the side coal's light shows the stump and the owl. */
  private shapeShown = 0;
  /** The owl in the stump, for QA. */
  readonly owl = woodOwl;
  private braveStep = 0;
  private braveAt = 0;
  private waved = false;
  private peeped = false;
  private aspect = 16 / 9;
  private readonly shapeEyes = new THREE.Vector3();
  private readonly shapeHold = new THREE.Vector3();
  private readonly shapeHand = new THREE.Vector3();
  private readonly shapeGlance = new THREE.Vector3();
  private readonly shapeFace = new THREE.Vector3();
  private readonly childHead = new THREE.Vector3();
  private readonly throwAt = new THREE.Vector3();
  private readonly bendEye = new THREE.Vector3();
  private readonly bendLook = new THREE.Vector3();
  /** Round the bend: where she looks when she has breathed out, and goes. */
  private readonly onward = shapePoint(6, 1.1, 2.4);
  private readonly shapeAsk: Coax = { at: new THREE.Vector3(), urgency: tuning.wood.inviteCoalUrgency, radius: tuning.wood.inviteCoalRadius };

  /** QA: start some way short of the bend, with the coal before the last one just lit. */
  skipToShape(): void {
    const { child: c, embers } = this.cast;
    embers.clearCoals();
    this.chainSide = 1;
    this.chainAt = THROW_ALONG - 20;
    const coal = embers.lay(...this.at(this.chainAt, this.chainSide * tuning.wood.chainOffset));
    embers.blow(coal, 1);
    this.ahead = coal;
    this.leg = 1;
    pathPoint(this.chainAt - 4, 0, this.spot);
    c.place(this.spot.x, this.spot.y, 0);
    c.stop();
    c.faceToward(WOOD_SHAPE.x, WOOD_SHAPE.z, 1);
    this.aim.set(-SHAPE_FACING.x, 0, -SHAPE_FACING.z);
    this.shoulder = -tuning.wood.cameraSide;
    this.to('walk');
    this.cutAfter = 2;
  }

  /** The coal before the bend is laid, and she goes up to it slowly with the eyes on her, and stops there. */
  private toShape(): void {
    const { child: c } = this.cast;
    this.to('loom');
    c.stroll = tuning.wood.shape.approachPace;
    c.walkTo(SHAPE_WAIT.x, SHAPE_WAIT.z, false, () => {
      c.stop();
      c.faceToward(WOOD_SHAPE.x, WOOD_SHAPE.z, 1);
      this.shapeStopped = this.now;
    }, 0.3);
  }

  /** The coal before the bend has caught: the antlers are up the rock, and only now is there a coal at the side. */
  private throwCaught(): void {
    if (this.throwLitAt >= 0) return;
    this.throwLitAt = this.now;
    this.sideCoal = this.cast.embers.lay(SHAPE_SIDE_COAL.x, SHAPE_SIDE_COAL.y);
    this.lightShare = 0;
  }

  private get shapeWaiting(): Coal | null {
    if (this.throwCoal?.live && !this.throwCoal.lit) return this.throwCoal;
    return this.sideCoal?.live && !this.sideCoal.lit ? this.sideCoal : null;
  }

  /**
   * The light the stump's shadow is thrown by: the coal before the bend, swinging round to the side coal as that one
   * wakes, so the antlers on the rock swing aside and fold into a plain stump's. The wood's shaders' one light
   * swings with it.
   */
  private steerShapeLight(dt: number): void {
    const k = tuning.wood.shape;
    const { embers } = this.cast;
    const t = this.throwCoal, s = this.sideCoal;
    if (!t) return;
    for (const coal of [t, s]) if (coal?.lit && (this.beat === 'loom' || this.beat === 'brave')) coal.heat = Math.max(coal.heat, k.holdHeat);
    this.shapePower = s?.live ? embers.glowOf(s) : 0;
    const want = s?.lit ? 1 : THREE.MathUtils.smoothstep(Math.min(2.6, this.shapePower * 0.5), 0.02, 0.5);
    this.lightShare += (want - this.lightShare) * (1 - Math.exp(-dt * k.lightShift));
    this.shapeShown = Math.max(this.shapeReveal, this.lightShare * THREE.MathUtils.smoothstep(this.shapePower, 0.2, 1.6));
    const from = t.live ? embers.glowOf(t) : 0;
    const gone = this.afterShape?.lit ? 0 : 1;
    coalLight(t.p.x, t.p.z, this.throwAt);
    if (s) this.throwAt.lerp(coalLight(s.p.x, s.p.z, this.tmp), this.lightShare);
    const glow = Math.min(2.6, THREE.MathUtils.lerp(from, this.shapePower, this.lightShare) * 0.5);
    throwShapeLight(this.throwAt, glow * k.throwLight * gone);
    showShape(this.shapeShown);
    woodOwl.shown = this.shapeShown;
  }

  private get steering(): boolean {
    return !!this.sideCoal && (this.beat === 'loom' || this.beat === 'brave' || (this.shapeDone && !this.afterShape?.lit));
  }

  steerLight(at: THREE.Vector3, power: number): number {
    if (!this.steering || !this.sideCoal) return power;
    at.lerp(this.sideCoal.p, this.lightShare);
    return THREE.MathUtils.lerp(power, Math.min(2.6, this.shapePower * 0.5), this.lightShare);
  }

  /** The owl's eyes while it sits in the fork; once it has gone, where they were. */
  private owlEyes(out: THREE.Vector3): THREE.Vector3 {
    if (woodOwl.phase === 'leaving' || woodOwl.phase === 'gone') return out;
    return woodOwl.toWorld(this.shapeFace.set(0, 0.34, 0.1), true, out);
  }

  /**
   * Two eyes in the dark ahead, and she will not go past them. Her own light throws antlers up the rock behind; the
   * coal off to the side swings the light round, and it is a stump with a small owl in it.
   */
  private loom(dt: number): void {
    const { child: c, cygnet } = this.cast;
    const k = tuning.wood.shape;
    this.owlEyes(this.shapeEyes);
    woodOwl.lookAt(this.childHead.copy(c.position).setY(c.position.y + 1.1));
    c.lookAt = this.shapeEyes;
    cygnet.watch(this.shapeEyes);
    const warm = this.lightShare * THREE.MathUtils.smoothstep(this.shapePower, 0.2, 1.6);
    if (this.sideCoal?.lit) this.shapeReveal = Math.min(1, this.shapeReveal + dt * warm / k.revealSeconds);
    woodOwl.eyeshine = k.eyeshineDark * (1 - 0.7 * warm) * (1 - this.shapeReveal);
    if ((this.shapeWaiting?.breath ?? 0) > 0) this.shapeWorkedAt = this.now;
    const stopped = this.shapeStopped >= 0;
    const thrown = this.throwLitAt >= 0;
    // Small and still in front of the eyes; then her own light makes it worse; then the side light, and she holds.
    const want = !stopped ? 0.3 : !thrown ? 0.5 : THREE.MathUtils.clamp(1 - 0.35 * warm - this.shapeReveal, 0, 1);
    this.shapeFear += (want - this.shapeFear) * (1 - Math.exp(-dt * (thrown ? 5 : 1.5)));
    const fear = this.shapeFear;
    if (!stopped) return;
    const since = this.now - this.shapeStopped;
    // Once, before the player has done anything: a look back over her shoulder for whoever makes the light.
    if (!thrown && since > k.glanceAfter && since < k.glanceAfter + k.glanceFor && this.shot.eye) {
      c.lookAt = this.shapeGlance.copy(this.shot.eye);
    }
    // The flinch back when the antlers leap up the rock.
    const frightAt = Math.max(this.shapeStopped, this.throwLitAt);
    const jolt = thrown ? this.now - frightAt : -1;
    const back = jolt >= 0 && jolt < k.flinchSeconds ? k.flinchStep / k.flinchSeconds * Math.sin(Math.PI * jolt / k.flinchSeconds) * Math.PI / 2 : 0;
    c.position.x += SHAPE_FACING.x * back * dt;
    c.position.z += SHAPE_FACING.z * back * dt;
    c.lean += (-0.02 - 0.16 * fear - c.lean) * (1 - Math.exp(-dt * (thrown ? 6 : 2)));
    c.tighter += (THREE.MathUtils.smoothstep(fear, 0.3, 0.8) - c.tighter) * (1 - Math.exp(-dt * 4));
    if (fear > 0.65) {
      // Mittens up to her scarf.
      c.face(this.shapeHold).y -= 0.32;
      this.shapeHold.addScaledVector(SHAPE_FACING, 0.06);
      c.reachFor(0, this.shapeHold);
      c.reachFor(1, this.shapeHand.copy(this.shapeHold).addScaledVector(SHAPE_RIGHT, 0.09));
    } else {
      c.reachFor(0, null);
      c.reachFor(1, null);
    }
    if (this.shapeReveal >= 1) {
      c.reachFor(0, null);
      c.reachFor(1, null);
      woodOwl.wake();
      this.braveStep = 0;
      this.braveAt = this.now;
      this.to('brave');
    }
  }

  /**
   * The owl blinks at her and tilts its head, and she looks back. It fluffs itself up, hoots, and flutters up past
   * her, and she turns to watch it go with the cygnet up out of the satchel after it. A breath out, and on.
   */
  private brave(dt: number): void {
    const { child: c, cygnet } = this.cast;
    const k = tuning.wood.shape;
    const owl = woodOwl;
    this.owlEyes(this.shapeEyes);
    owl.eyeshine *= Math.exp(-dt * 3);
    owl.lookAt(this.childHead.copy(c.position).setY(c.position.y + 1.1));
    if (owl.hooted) cue('hoot');
    if (owl.phase === 'awake' && owl.elapsed > k.owlLeaveAfter) owl.leave(OWL_FLIGHT);
    // Her body softens: the lean goes out of her and her mittens come down.
    c.tighter += (0 - c.tighter) * (1 - Math.exp(-dt * 1.5));
    if (this.braveStep === 0) {
      c.lean += (0.0 - c.lean) * (1 - Math.exp(-dt * 1.5));
      const flying = owl.phase === 'leaving' ? owl.flightSeconds : 0;
      if (owl.phase === 'awake' || (owl.phase === 'leaving' && flying <= 0)) {
        c.lookAt = this.shapeEyes;
        cygnet.watch(this.shapeEyes);
        // She tips her head back at it as it tips its head at her.
        c.tilt = owl.phase === 'awake' ? -0.6 * owl.head.z : c.tilt * Math.exp(-dt * 4);
      } else if (owl.phase === 'leaving' && owl.presence > 0.2) {
        c.tilt *= Math.exp(-dt * 4);
        c.lookAt = owl.position;
        cygnet.watch(owl.position);
        // Round after it, body and all, as it comes over her.
        if (flying > k.turnAfter) c.faceToward(owl.position.x, owl.position.z, 1 - Math.exp(-dt * k.turnRate));
        if (!this.peeped && flying > k.peepAfter) { this.peeped = true; cygnet.does('peer', owl.position, k.peepFor); }
        if (!this.waved && flying > k.waveAfter) { this.waved = true; c.wave(); }
      }
      if (owl.phase === 'gone') {
        this.braveStep = 1;
        this.braveAt = this.now;
        cygnet.watch(null);
      }
    }
    // The breath out: her shoulders lift and drop, and she looks round the bend.
    if (this.braveStep === 1) {
      const b = (this.now - this.braveAt) / k.exhaleSeconds;
      c.lean = 0.07 * Math.sin(Math.PI * Math.min(1, b));
      c.lookAt = this.onward;
      if (b >= 1 && !c.busy) this.walkOn();
    }
  }

  /** On round the bend at her own pace, no longer the slow one she came up to it at. */
  private walkOn(): void {
    const { child: c } = this.cast;
    c.stroll = 1;
    c.lean = 0;
    c.tilt = 0;
    c.lookAt = null;
    this.shapeDone = true;
    this.braveStep = 2;
    this.leg = Math.max(this.leg, 2);
    this.to('walk');
    this.chainAt = pathAlong(c.position.x, c.position.z);
    this.chainSide = -this.chainSide;
    this.layNext(tuning.wood.shape.chainOn);
    this.afterShape = this.ahead;
    this.placeShoulder();
  }

  /** After the usual idle wait, the waiting coal at the bend shows the updraft over it. */
  private shapeCoax(): Coax | null {
    const coal = this.shapeWaiting;
    if (this.beat !== 'loom' || this.shapeStopped < 0 || this.shapeReveal > 0 || !coal) return null;
    const since = this.now - Math.max(this.shapeStopped, this.throwLitAt);
    if (since < tuning.wood.inviteAfter || this.now - this.shapeWorkedAt < tuning.invitation.resumeAfter) return null;
    this.shapeAsk.at.set(coal.p.x, Math.max(heightAt(coal.p.x, coal.p.z), 0), coal.p.z);
    return this.shapeAsk;
  }

  /**
   * One frame for all of it, eased into as she comes up to the coal and then held: the eyes large in the middle of
   * it, her small at the bottom, the coal beside her and the side coal off to the left, and the rock behind the
   * stump for the antlers to leap up.
   */
  private frameShape(ground: number): void {
    const s = this.shot;
    const c = this.cast.child.position;
    const k = tuning.wood.shape;
    this.walkFrame(ground);
    const portrait = this.aspect < 1;
    const back = portrait ? k.portraitBack : k.cameraBack;
    const across = portrait ? k.portraitSide : k.cameraSide;
    const up = portrait ? k.portraitUp : k.cameraUp;
    this.bendEye.copy(SHAPE_WAIT).addScaledVector(SHAPE_RIGHT, across).addScaledVector(SHAPE_FACING, back);
    this.bendEye.x += c.x - SHAPE_WAIT.x;
    this.bendEye.z += c.z - SHAPE_WAIT.z;
    this.bendEye.y = Math.max(heightAt(this.bendEye.x, this.bendEye.z), 0, ground) + up;
    shapePoint(k.lookAt[0], portrait ? k.portraitLookUp : k.lookAt[1], k.lookAt[2], this.bendLook);
    const w = this.beat === 'brave' ? 1 : 1 - THREE.MathUtils.smoothstep(Math.hypot(c.x - SHAPE_WAIT.x, c.z - SHAPE_WAIT.z), 2, k.easeFrom);
    s.eye!.lerp(this.bendEye, w);
    s.target.lerp(this.bendLook, w);
    this.childSubject.copy(c).y += 1.2;
    this.birdSubject.copy(this.shapeEyes);
    s.subjects = { primary: this.childSubject, secondary: this.birdSubject, margin: 0.96, extra: 0.5 };
    this.pace = k.cameraPace;
    this.focus.copy(c);
  }
}
