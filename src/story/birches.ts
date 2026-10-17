import { birchesPoint, type CheckpointPayload } from './checkpoint-data';
import * as THREE from 'three';
import type { Shot } from '../camera';
import type { Coax } from '../fx/swirl';
import { BIRCHES_BERTH, BIRCHES_CLEARING, BIRCHES_LANDING, BIRCHES_WALK, BIRCH_PILES, FALLEN_SOUTH, alongFallen, fallenBole, fallenRadius, fallenTop, southOfFallen } from '../world/birches';
import { SWING_SOUNDS, SwingCrossing, type SwingEvent } from '../world/crossings/swing-crossing';
import { heightAt } from '../world/island';
import type { Cast, Chapter } from './cast';
import { tuning } from '../tuning';
import { BirchLeafPlay } from './birches-play';
import { SCARF_SNAGS } from '../world/birch-scarf';
import { birchesZ } from '../world/birches-layout';
import type { BirchesScorePhase } from '../audio/birches-score';
import { PlaneArrival } from './plane-arrival';
import { BirchesSquirrel, type SquirrelCue } from './birches-squirrel';
import { ROUNDS, frameShot } from './birches-rounds';

const ROUTE = BIRCHES_WALK;
/** The leg that ends in the clearing on the crest, where the swing is. */
const CLEARING_LEG = 2;
/** How near the boat either of them has to be before the child takes the hint and pushes off. */
const BOARDING = 20;
/** And if the leaves are more interesting than the boat, they go anyway after this long on the last stretch. */
const LAST_LEG_PATIENCE = 45;
/** Once the boat is drawn up past here, the scarf's free end is tied to its mast. */
const MAST_FROM = birchesZ(-1175);
type Beat = 'ashore' | 'wonder' | 'walk' | 'toSwing' | 'swinging' | 'toScarf' | 'scarf' | 'seeingOff' | 'toRound' | 'round' | 'leap'
  | 'unravelling' | 'gathering' | 'toBoat' | 'push' | 'aboard';
/** The walk's stops in the order it meets them: the squirrel's rounds between the scarf's tangles, and the swing over the fallen birch. */
const STOPS = [{ round: 0 }, { tangle: 0 }, { round: 1 }, { swing: true }, { tangle: 1 }, { round: 2 }, { tangle: 2 }, { tangle: 3 }] as const;
type Stop = (typeof STOPS)[number];
/** Further past a round's heaps than walking can take her without stopping there: she was put past it. */
const PUT_PAST = 10;
/** Beats where the player is playing, and the wind is theirs. */
const PLAYING: readonly Beat[] = ['walk', 'toSwing', 'swinging', 'toScarf', 'scarf', 'seeingOff', 'toRound', 'round', 'unravelling'];
const AT_TANGLE: readonly Beat[] = ['toScarf', 'scarf', 'seeingOff', 'unravelling'];
type Play = 'carry' | 'watch' | 'fetch' | 'hold';
/** The cygnet's own way over the fallen birch once she is across: up onto it, a look at her, and down the far side. */
type BirdOver = 'none' | 'watching' | 'toBole' | 'up' | 'down' | 'over';
/** Where along the bole the cygnet goes over it, between the limbs it is propped on, beside where she went over. */
const BIRD_OVER = [0.8, 0.9] as const;
/** How near the top of the bole, level, it flutters up from: well clear of the bole's face, so it never walks into it. */
const BIRD_FLUTTER_FROM = 2.6;
/** On the ground beside the bole `t` along it, `off` metres off its south face (negative: off its north face). */
function besideBole(t: number, off: number, out: THREE.Vector3): THREE.Vector3 {
  const b = fallenBole(t), r = Math.sign(off) * (fallenRadius(t) + Math.abs(off));
  const x = b.x + FALLEN_SOUTH.x * r, z = b.z + FALLEN_SOUTH.y * r;
  return out.set(x, Math.max(heightAt(x, z), 0), z);
}
/** How far her walk keeps off the bole on whichever side of it she is, and the plane's play with her. */
const KEEP_OFF = 1.2;
/** How far beyond the bole a lens past it stands. */
const LENS_OFF_BOLE = 3;

/**
 * The autumn birches. Deep autumn, the afternoon already going: an island of gold trees between the meadow and
 * the village, and a walk up through them and down the other side.
 *
 * The room is one turn of the same verb. On the first island the player's wind put the colour back into the
 * world; here every gust takes the last of the year off the trees, they stay bare, and there is no way to play
 * the game that avoids it. Halfway over, on the crest, there is a swing hanging from a branch with nobody on it,
 * and once the child is on it the player finds out what they have been doing: pushing a child on a swing.
 */
export class BirchesChapter implements Chapter {
  beat: Beat = 'ashore';
  readonly breeze = 1;
  readonly worldLife = 1;
  pace = 0.4;
  /** Thick: from the last of the rise the drowned village is in the way north, and it is not for seeing yet. */
  readonly haze = 1.08;
  dusk = 0.58;
  readonly shot: Shot = { target: new THREE.Vector3(), distance: 32, height: 9 };
  readonly music = 'birches' as const;
  readonly season = 0.44;
  readonly focus = new THREE.Vector3();
  private play: Play = 'carry';
  private leg = 0;
  private boatMoved = false;
  /** When the boat was last in the picture on the beach they landed on. */
  private boatSeenAt = 0;
  /** How fast the lens is moving (m/s, smoothed), so a show can wait for the frame to settle round it. */
  private lensSpeed = 0;
  private lensAt = 0;
  private readonly lensWas = new THREE.Vector3();
  /** She has been over the fallen birch on the swing (or was put past it): 1 or 0, as saved. */
  private swings = 0;
  readonly crossing: SwingCrossing;
  /** Where she is in going to the swing: up to the bole, looking along it, and over to the seat. */
  private swingStep: 'toStop' | 'looking' | 'toBoard' = 'toStop';
  private stepAt = 0;
  /** When she let go of the swing, for the lens following her over. */
  private leftSwingAt = -1;
  private landedCheer = false;
  private birdOver: BirdOver = 'none';
  private birdAt = 0;
  private birdShed = false;
  /** When she was over the bole and off the swing's ground, or −1. */
  private overAt = -1;
  private camera: THREE.PerspectiveCamera | null = null;
  private readonly edge = { back: new THREE.Vector2(), at: 0 };
  private readonly birdWatch = new THREE.Vector3();
  /** Near enough the bole to flutter up onto it, on top, and down the far side. */
  private readonly birdOff = new THREE.Vector3();
  private readonly birdTop = new THREE.Vector3();
  private readonly birdDown = new THREE.Vector3();
  private readonly boleAhead = new THREE.Vector3();
  /** The first beat, ashore, starts on the first frame the island is played. */
  private beatStart = -1;
  private holdUntil = 0;
  private now = 0;
  private cheered = false;
  private lastLegAt = 0;
  private readonly arrival = new PlaneArrival();
  private puttingDown = false;
  private readonly scarfMast = new THREE.Vector3();
  private readonly hand = new THREE.Vector3();
  private readonly tmp = new THREE.Vector3();
  private readonly bow = new THREE.Vector3();
  private readonly stern = new THREE.Vector3();
  private readonly tmp2 = new THREE.Vector3();
  private readonly seat = new THREE.Vector3();
  private readonly swingFrom = new THREE.Vector3();
  private readonly scarfFrom = new THREE.Vector3(0.08, 0, 1).normalize();
  /**
   * The first tangle's own bearings, west of the others, so the loop and the squirrel on its branch stand clear of the
   * near crowns; portrait's further round, so she stands below the loop rather than beside it.
   */
  private readonly firstFrom = new THREE.Vector3(-0.25, 0, 1).normalize();
  private readonly firstFromTall = new THREE.Vector3(-0.45, 0, 1).normalize();
  /** Portrait's second tangle comes round east on a longer lens, so the squirrel on the broken top reads beside her. */
  private readonly secondFromTall = new THREE.Vector3(0.3, 0, 1).normalize();
  private readonly air = { x: 0, z: 0, energy: 0, lift: 0 };
  private readonly scarfTarget = new THREE.Vector2();
  private readonly sideAt = new THREE.Vector2();
  private readonly crest = new THREE.Vector3(BIRCHES_CLEARING.x, 10, BIRCHES_CLEARING.y);
  private readonly leafPlay: BirchLeafPlay;
  /** The red squirrel's hide-and-seek, which the walk stops for as it stops for the tangles. */
  readonly squirrel: BirchesSquirrel;
  /** The round the walk is at, while it is at one. */
  private round = -1;
  private readonly seenGo = new THREE.Vector3();
  private seeingRound = -1;
  private readonly lookingFor = new THREE.Vector3();
  private lens = 1;
  private lensRate = 0;
  private readonly cueNow: SquirrelCue = { round: -1, standing: false, seeking: false, tangles: 0, swingOver: false, gathered: false, leaving: false, atTangle: false, atSwing: false, framed: false };

  constructor(private readonly cast: Cast) {
    this.leafPlay = new BirchLeafPlay(cast);
    this.squirrel = new BirchesSquirrel(cast);
    this.crossing = new SwingCrossing(cast.birches.swing, cast.birches.swingWay, cast);
    this.crossing.onEvent = (kind, at, strength) => this.swingSound(kind, at, strength);
    besideBole((BIRD_OVER[0] + BIRD_OVER[1]) / 2, 1.8, this.birdWatch);
    const { child, plane } = cast;
    plane.homeRadius = 28;
    /** It never flies over this island, whatever the player does with the air: everything here is on the ground. */
    cast.cygnet.mayFly = false;
    this.lens = tuning.crossingCamera.arrivals.birches.reveal.zoom;
    child.stepAshore(cast.boat);
    child.walkTo(BIRCHES_LANDING.x - 1, BIRCHES_LANDING.y - 9, false, () => this.to('wonder'), 0.9);
  }

  get scripted(): boolean {
    /** Exploring and playing with the cygnet never take control away from the wind. */
    return this.arrival.active || !PLAYING.includes(this.beat);
  }

  /**
   * The wind lands among the trees and heaps the player can see, never on the floor far up the ride past them; at a
   * tangle, round the wool, so circling it never blows the next round's heaps away beyond it.
   */
  get pointerReach(): number {
    return this.shot.distance + (AT_TANGLE.includes(this.beat) ? tuning.birches.scarf.strokeReach : tuning.birches.strokeReach);
  }

  /** A stalled player's drawn updraft, turning over the heap the squirrel is in. */
  get coax(): Coax | null {
    return this.beat === 'round' ? this.squirrel.invitation : null;
  }

  /** On the swing, a stalled player's drawn push along its arc, as in the drowned village. */
  get windInvitation(): THREE.Vector3 | null {
    return this.beat === 'swinging' ? this.crossing.invitation : null;
  }

  get invitationHeading(): number | null {
    return this.beat === 'swinging' && this.crossing.invitation ? this.crossing.heading : null;
  }

  /** The squirrel, kept sharp with her by the depth blur while it matters. */
  get alsoSharp(): { at: THREE.Vector3; weight: number } {
    return this.squirrel.sharpness;
  }

  get birchesScore(): BirchesScorePhase | undefined {
    // Keep the final phrase through boarding; Drowned owns the next arrival handoff.
    if (['push', 'aboard'].includes(this.beat)) return 'return';
    if (this.beat === 'toSwing' || this.beat === 'swinging') return 'swing';
    const scarf = this.cast.birches.scarf;
    if (this.beat === 'unravelling') return 'scarf';
    if (scarf.finished) return 'return';
    return scarf.completed === 0 ? 'walk' : 'scarf';
  }

  get done(): boolean {
    return this.beat === 'aboard';
  }

  get checkpoint(): string | null {
    if (this.beat !== 'walk') return null;
    const count = this.cast.birches.scarf.completed, rounds = this.squirrel.rounds;
    return count > 0 || this.swings > 0 || rounds > 0 ? birchesPoint(rounds, count, this.swings > 0) : null;
  }
  saveCheckpoint(): CheckpointPayload<'birches'> {
    return [this.leg, this.swings, this.dusk, this.cast.birches.scarf.completed, this.squirrel.rounds];
  }
  restoreCheckpoint(point: string, data: number[]): void {
    this.leg = THREE.MathUtils.clamp(Math.floor(data[0]), 0, ROUTE.length - 1);
    this.dusk = data[2];
    // Saves made before the scarf resume beyond the tangles they have already walked past.
    const saved = data.length > 3 ? Math.floor(data[3]) : point === 'leaves' ? 2 : 1;
    // Old three-knot saves already earned their sail. Earlier saves encounter the new loop on the way.
    const fourKnots = point.startsWith('scarf4-') || point.startsWith('squirrel');
    const count = THREE.MathUtils.clamp(!fourKnots && saved >= 3 ? SCARF_SNAGS.length : saved, 0, SCARF_SNAGS.length);
    this.cast.birches.scarf.restore(count);
    this.cast.boat.scarfSail = count === SCARF_SNAGS.length ? 1 : 0;
    this.moveBoat();
    const { child, cygnet } = this.cast;
    child.stop();
    child.stowPlane(false);
    this.crossing.reset();
    this.leftSwingAt = -1;
    this.birdOver = 'none';
    cygnet.stay = false;
    cygnet.errand = null;
    /** Over the fallen birch: ridden, or saved where it once was optional, past it. A resumed save past it starts beyond it. */
    this.swings = data[1] > 0 || count >= 2 ? 1 : 0;
    if (this.swings && southOfFallen(child.position.x, child.position.z) > -KEEP_OFF) {
      const { onward } = this.cast.birches.swingWay;
      child.place(onward.x, onward.z, Math.PI);
    }
    if (cygnet.carried) {
      cygnet.release(this.tmp.set(child.position.x - Math.cos(child.yaw) * 1.2, 0, child.position.z + Math.sin(child.yaw) * 1.2));
      cygnet.seating.snap();
    }
    this.beat = 'walk'; this.play = 'hold';
    this.round = -1;
    /** Saves from before the squirrel played infer the rounds behind them: each comes before its tangle, the second before the swing. */
    const passed = count >= 3 ? 3 : count >= 2 || this.swings > 0 ? 2 : count >= 1 ? 1 : 0;
    this.squirrel.release();
    this.squirrel.restore(THREE.MathUtils.clamp(data.length > 4 ? Math.floor(data[4]) : passed, 0, ROUNDS.length), this.cue());
  }

  /** What the squirrel needs to know of the story this frame. */
  private cue(): SquirrelCue {
    const scarf = this.cast.birches.scarf;
    const swinging = (this.beat === 'toSwing' || this.beat === 'swinging') && this.swings === 0;
    const c = this.cueNow;
    c.round = this.beat === 'toRound' || this.beat === 'round' ? this.round : -1;
    c.standing = (this.beat === 'toRound' || this.beat === 'round') && !this.cast.child.busy;
    c.seeking = this.beat === 'round';
    /** A tangle counts as soon as its loop starts to lift free, so the squirrel is away while it comes off. */
    const lifting = scarf.active >= 0 && scarf.snags[scarf.active].release > 0 && !scarf.snags[scarf.active].freed;
    c.tangles = scarf.completed + (lifting ? 1 : 0);
    c.swingOver = this.swings > 0 || scarf.active === 1 || scarf.completed >= 2;
    c.gathered = scarf.finished;
    c.leaving = this.beat === 'gathering' || this.beat === 'toBoat' || this.beat === 'push' || this.beat === 'aboard';
    c.atTangle = AT_TANGLE.includes(this.beat);
    c.atSwing = swinging;
    c.framed = this.lensSpeed < tuning.birches.squirrel.framedBelow;
    return c;
  }

  /** The next stop the walk owes, in route order: a round of the squirrel's or a tangle of the scarf's. */
  private nextStop(): Stop | null {
    const rounds = this.squirrel.rounds, tangles = this.cast.birches.scarf.completed;
    return STOPS.find((stop) => ('round' in stop ? rounds <= stop.round : 'tangle' in stop ? tangles <= stop.tangle : this.swings === 0)) ?? null;
  }

  private to(beat: Beat): void {
    this.beat = beat;
    this.beatStart = this.now;
  }

  private get t(): number {
    return this.now - this.beatStart;
  }

  update(dt: number, time: number): void {
    this.now = time;
    if (this.beatStart < 0) this.beatStart = time;
    const { child: c, plane: p, boat, birches } = this.cast;
    p.guided = this.beat === 'walk';
    p.playEdge = this.keepPlay();
    const scarf = birches.scarf;
    const mast = boat.position.z < MAST_FROM ? boat.sailPoint(this.scarfMast) : undefined;
    scarf.update(dt, this.cast.wind, mast);
    scarf.faced = this.beat === 'scarf';
    boat.scarfSail = scarf.woven;
    /** The first shot looks at her over the stern, and she steps off the bow behind the sail. */
    boat.sailGivesWay = this.beat === 'ashore' || this.beat === 'wonder' ? tuning.birches.landingGivesWay : tuning.sail.givesWay;
    this.squirrel.update(dt, time, this.cue());
    if (!this.boatMoved && this.leg > CLEARING_LEG) this.moveBoat();
    /** The afternoon goes on while they walk, and hands over to the village's dusk at the far beach. */
    const over = THREE.MathUtils.clamp((BIRCHES_LANDING.y - c.position.z) / (BIRCHES_LANDING.y - BIRCHES_BERTH.z), 0, 1);
    this.dusk += (0.58 + over * 0.12 - this.dusk) * (1 - Math.exp(-dt * 0.3));

    /** The plane leans toward wherever the walk is going next, and over the crest toward the boat on the far sand. */
    if (!p.departing) {
      const last = this.leg === ROUTE.length - 1 && scarf.finished;
      if (last) {
        p.home.set(boat.position.x, 0, boat.position.z);
        p.homeRadius = 20;
      } else if (this.round >= 0) {
        /** By the heaps, as it stays by a tangle. */
        const { area } = ROUNDS[this.round];
        p.home.set(area.x, 0, area.z);
        p.homeRadius = 5;
      } else {
        const t = this.target();
        const dx = t.x - c.position.x;
        const dz = t.y - c.position.z;
        const d = Math.hypot(dx, dz) || 1;
        const reach = Math.min(d, 16);
        p.home.set(c.position.x + (dx / d) * reach, 0, c.position.z + (dz / d) * reach);
        p.homeRadius = this.beat === 'scarf' || this.beat === 'toScarf' ? 5 : 18;
      }
    }

    switch (this.beat) {
      case 'wonder':
        /** A moment looking up the ride at all that gold, and the cygnet is put down to walk it with them. */
        if (this.puttingDown) break;
        c.lookAt = this.crest;
        if (this.t > 2 && !c.busy) this.putDown();
        break;
      case 'walk':
        this.updateWalk(time);
        break;
      case 'toSwing':
        this.goingToSwing();
        break;
      case 'swinging':
        this.updateSwing();
        break;
      case 'toScarf':
        if (!c.busy) this.to('scarf');
        break;
      case 'toRound':
        /** At the first heap she stands and watches it go in off its log before she kneels to look. */
        if (this.squirrel.over(this.round)) this.endRound();
        else if (!c.busy && this.squirrel.hideout) this.to('round');
        break;
      case 'round':
        if (this.squirrel.over(this.round)) this.endRound();
        break;
      case 'leap':
        if (this.squirrel.leapOver) this.resumeWalk();
        break;
      case 'scarf':
        c.lookAt = scarf.focus;
        if (scarf.active >= 0 && scarf.snags[scarf.active].freed) {
          const next = this.nextStop();
          if (scarf.completed === SCARF_SNAGS.length) this.to('unravelling');
          else if (next && 'round' in next && !this.squirrel.ready(next.round)) this.seeOff(next.round);
          else this.resumeWalk();
        }
        break;
      case 'seeingOff':
        this.seeingOff();
        break;
      case 'unravelling':
        c.lookAt = boat.sailPoint(this.scarfMast);
        if (scarf.woven >= tuning.birches.scarf.walkOnWoven) this.resumeWalk();
        break;
      case 'gathering':
        /** Whatever the duet is doing, the walk goes on: this beat can never be the end of the room. */
        if (!this.cast.carry.busy && !c.busy) this.board();
        break;
      case 'push':
        break;
      default:
        break;
    }

    this.birdOverBole();
    if (PLAYING.includes(this.beat) && this.round < 0 && this.beat !== 'seeingOff' && this.beat !== 'toSwing' && this.beat !== 'swinging'
      && (this.birdOver === 'none' || this.birdOver === 'over')) this.leafPlay.update(dt, time);
    if (this.camera && this.crossing.phase !== 'off') this.crossing.update(dt, this.camera);
    else birches.swing.update(dt, this.cast.wind);
    birches.shake(this.crossing.phase === 'riding' ? Math.min(1, Math.abs(birches.swing.angle) * 1.6) : 0);
    if (p.held) p.hold(c);
    this.frame();
    this.easeLens(dt);
  }

  /**
   * The boat goes round to the far shore only once the beach they landed on has been out of the picture a moment and
   * she is well up the ride, so it is never seen to go; past the crest that beach is behind them for good.
   */
  afterCamera(camera: THREE.PerspectiveCamera): void {
    this.camera = camera;
    const dt = this.now - this.lensAt;
    if (dt > 0) {
      const speed = camera.position.distanceTo(this.lensWas) / dt;
      this.lensSpeed += (speed - this.lensSpeed) * Math.min(1, dt * 4);
      this.lensWas.copy(camera.position);
      this.lensAt = this.now;
    }
    if (this.boatMoved) return;
    const { boat, child } = this.cast;
    const k = tuning.birches.boatLeaves;
    boat.hullEnds(this.bow, this.stern);
    const seen = [this.bow, this.stern, boat.position].some((end) => [0, k.mast].some((up) => {
      const p = this.tmp.copy(end).setY(end.y + up).project(camera);
      return p.z < 1 && Math.abs(p.x) < k.margin && Math.abs(p.y) < k.margin;
    }));
    if (seen) this.boatSeenAt = this.now;
    const away = Math.hypot(child.position.x - boat.position.x, child.position.z - boat.position.z);
    if ((away > k.away && this.now - this.boatSeenAt > k.unseen) || child.position.z < BIRCHES_CLEARING.y) this.moveBoat();
  }

  private moveBoat(): void {
    this.cast.boat.beach(BIRCHES_BERTH.x, BIRCHES_BERTH.z, 0.15);
    this.boatMoved = true;
  }

  /** A round's longer portrait lens comes in and goes out as smoothly as a dolly, never with the rig's quick start. */
  private easeLens(dt: number): void {
    const want = this.shot.zoom ?? 1, w = tuning.birches.squirrel.lensEase;
    this.lensRate += (w * w * (want - this.lens) - 2 * w * this.lensRate) * dt;
    this.lens += this.lensRate * dt;
    this.shot.zoom = this.lens;
  }

  /** Set down on the sand where they came ashore, facing up the ride, rather than carried until the leaves call it. */
  private putDown(): void {
    const { child: c, cygnet, carry } = this.cast;
    if (!cygnet.carried) { this.setOff(); return; }
    this.puttingDown = true;
    c.lookAt = null;
    const up = Math.atan2(this.crest.x - c.position.x, this.crest.z - c.position.z);
    const down = () => carry.setDown(() => this.setOff(), up);
    /** A step to the side first, so they kneel side-on to the camera behind them and the bird is not hidden in front. */
    const aside = up - Math.PI / 2;
    c.walkTo(c.position.x + Math.sin(aside) * 1.6, c.position.z + Math.cos(aside) * 1.6, false, () => {
      if (cygnet.seat === 'satchel') carry.unstow(down);
      else down();
    }, 0.3);
  }

  /** On foot from the beach; the leaves along the way can draw it off to play while the walk goes on. */
  private setOff(): void {
    const { cygnet } = this.cast;
    cygnet.stay = false;
    cygnet.errand = null;
    cygnet.watch(null);
    this.to('walk');
    this.play = 'carry';
    this.throwAhead();
  }

  private target(): THREE.Vector2 {
    const stop = this.nextStop();
    const route = ROUTE[Math.min(this.leg, ROUTE.length - 1)];
    if (!stop) return route;
    const at = 'round' in stop ? ROUNDS[stop.round].stand : 'tangle' in stop ? { x: SCARF_SNAGS[stop.tangle].stopX, z: SCARF_SNAGS[stop.tangle].stopZ }
      : this.cast.birches.swingWay.stop;
    return route.y < at.z ? this.scarfTarget.set(at.x, at.z) : route;
  }

  private updateWalk(time: number): void {
    const { child: c, plane: p, boat, wind } = this.cast;
    const scarf = this.cast.birches.scarf;
    const stop = this.nextStop();
    const snag = stop && 'tangle' in stop ? scarf.snags[stop.tangle] : undefined;
    if (stop && 'round' in stop) {
      const { stand } = ROUNDS[stop.round];
      if (stand.z - c.position.z > PUT_PAST) this.squirrel.passed(stop.round, this.cue());
      else if (!c.acting && this.squirrel.ready(stop.round) && (c.position.distanceTo(stand) < tuning.birches.scarf.arriveWithin || c.position.z < stand.z)) {
        this.toRound(stop.round);
        return;
      }
    }
    if (stop && 'swing' in stop && !c.acting) {
      const { stop: at } = this.cast.birches.swingWay;
      /** Beyond the bole without riding over it she was put there: the swing is behind her. */
      if (southOfFallen(c.position.x, c.position.z) < -KEEP_OFF) this.swings = 1;
      else if (c.position.distanceTo(at) < tuning.birches.scarf.arriveWithin || southOfFallen(c.position.x, c.position.z) < 4) {
        this.toSwing();
        return;
      }
    }
    if (snag && !c.acting && (c.position.distanceTo(snag.before) < tuning.birches.scarf.arriveWithin || c.position.z < snag.before.z)) {
      this.toScarf();
      return;
    }
    const way = ROUTE[this.leg];
    // A stop short of the waypoint is not the waypoint: only reaching or passing it moves the walk on.
    if (this.leg < ROUTE.length - 1 && (Math.hypot(c.position.x - way.x, c.position.z - way.y) < 14 || c.position.z < way.y)) this.leg++;
    const last = this.leg === ROUTE.length - 1 && scarf.finished;
    if (last && this.lastLegAt === 0) this.lastLegAt = time;
    const childNear = Math.hypot(c.position.x - boat.position.x, c.position.z - boat.position.z) < BOARDING;
    const waited = this.lastLegAt > 0 && time - this.lastLegAt > LAST_LEG_PATIENCE;
    if (this.arrival.update(this.cast, last && (childNear || waited), () => this.board())) return;
    if (this.play === 'watch') {
      c.lookAt = p.position;
      /** A gust that takes a cloud of gold off a whole stand at once is worth stopping for. */
      const w = wind.sample(c.position.x, c.position.z, this.air);
      if (!this.cheered && (Math.hypot(w.x, w.z) > 12 || p.position.y - heightAt(p.position.x, p.position.z) > 8)) {
        this.cheered = true;
        c.cheer();
      }
      if (p.landed) this.fetch();
      else if (!c.moving && Math.hypot(p.position.x - c.position.x, p.position.z - c.position.z) > 8) {
        const to = this.ownSide(p.position.x, p.position.z);
        c.walkTo(to.x, to.y, true, undefined, 5);
      }
    } else if (this.play === 'fetch') {
      c.lookAt = p.position;
      if (!p.landed && p.airborne) this.play = 'watch';
    } else if (this.play === 'hold' && !c.busy) {
      if (last) c.lookAt = boat.position;
      if (time > this.holdUntil) this.throwAhead();
    }
  }

  /**
   * The fallen birch is across the ride: she goes up to it and stops, looks along it from its root plate to its
   * crown, and turns to the swing hanging over it.
   */
  private toSwing(): void {
    const { child: c } = this.cast;
    const { stop } = this.cast.birches.swingWay;
    this.play = 'carry';
    c.stop();
    this.to('toSwing');
    this.swingStep = 'toStop';
    fallenTop(alongFallen(stop.x, stop.z), this.boleAhead);
    c.lookAt = this.boleAhead;
    c.walkTo(stop.x, stop.z, false, () => {
      if (this.beat !== 'toSwing') return;
      c.faceToward(this.boleAhead.x, this.boleAhead.z, 1);
      this.swingStep = 'looking';
      this.stepAt = this.now;
    }, 0.4);
  }

  private goingToSwing(): void {
    const { child: c, cygnet: bird, birches } = this.cast;
    if (this.swingStep !== 'looking') return;
    const k = tuning.birches.swing, looked = (this.now - this.stepAt) / k.lookFor;
    /** Her eyes go along it one way and the other, from in front of her toward the plate and then the crown. */
    const at = alongFallen(this.boleAhead.x, this.boleAhead.z) - Math.sin(Math.min(1, looked) * Math.PI * 2) * 0.32;
    c.lookAt = fallenTop(THREE.MathUtils.clamp(at, 0, 1), this.lookingFor);
    bird.watch(this.lookingFor);
    if (looked < 1 || c.acting) return;
    this.swingStep = 'toBoard';
    bird.watch(null);
    const { board } = birches.swingWay;
    c.lookAt = birches.swing.seat(this.seat);
    c.walkTo(board.x, board.z, false, () => { if (this.beat === 'toSwing') this.mount(); }, 0.3);
  }

  /** She gets on; the cygnet goes to watch from beside the bole, and the plane goes on her bag till she is over. */
  private mount(): void {
    const { child: c, cygnet: bird } = this.cast;
    this.to('swinging');
    this.leftSwingAt = -1;
    this.overAt = -1;
    this.landedCheer = false;
    c.lookAt = null;
    c.stowPlane(true);
    this.crossing.begin();
    if (bird.carried) bird.release(this.tmp.set(c.position.x + 1, 0, c.position.z + 0.8));
    bird.stay = false;
    bird.errand = this.birdWatch;
    this.birdOver = 'watching';
  }

  /** Pumped as the drowned village's swing is: she lets go at the top of a forward swing, over the bole, and lands beyond it. */
  private updateSwing(): void {
    const { child: c } = this.cast;
    const phase = this.crossing.phase;
    if (phase === 'flying' && this.leftSwingAt < 0) this.leftSwingAt = this.now;
    if (phase === 'landed' && this.swings === 0) {
      /** Over: the squirrel is off along the bole ahead of them, and the cygnet makes its own way across. */
      this.swings = 1;
      this.leg = Math.max(this.leg, CLEARING_LEG + 1);
      this.birdOver = 'toBole';
      /** A plane left on the near side comes over after her and settles a step on, where she will pick it up. */
      const { plane } = this.cast, { onward } = this.cast.birches.swingWay, next = SCARF_SNAGS[1];
      if (!plane.held) {
        const d = Math.hypot(next.stopX - onward.x, next.stopZ - onward.z) || 1, x = onward.x + (next.stopX - onward.x) / d * 2.5,
          z = onward.z + (next.stopZ - onward.z) / d * 2.5;
        plane.settleAt(this.tmp2.set(x, Math.max(heightAt(x, z), 0), z));
      }
      /** It goes over from where it watched, so it never walks along the bole's face to get there. */
      const { cygnet: bird } = this.cast, t = THREE.MathUtils.clamp(alongFallen(bird.position.x, bird.position.z), ...BIRD_OVER);
      besideBole(t, BIRD_FLUTTER_FROM - 1.2, this.birdOff);
      fallenTop(t, this.birdTop);
      besideBole(t, -0.9, this.birdDown);
      this.birdAt = this.now;
    }
    if (phase === 'landed' && !this.landedCheer && !c.acting) {
      this.landedCheer = true;
      c.cheer();
    }
    if (phase === 'over') {
      if (this.overAt < 0) this.overAt = this.now;
      if (this.watchingBird()) return;
      c.stowPlane(false);
      this.resumeWalk();
    }
  }

  /** Over the bole, a moment looking back at the cygnet coming up after her, so its feathers fall in the frame. */
  private watchingBird(): boolean {
    const k = tuning.birches.swing;
    const coming = this.birdOver === 'toBole' || (this.birdOver === 'up' && this.now - this.birdAt < k.featherWatch);
    if (!coming || this.now - this.overAt > k.featherWait) return false;
    this.cast.child.lookAt = this.cast.cygnet.position;
    return true;
  }

  /** Its own way over once she is across: up to the bole's foot, a flutter up onto it, a look at her, and down the far side. */
  private birdOverBole(): void {
    const { cygnet: bird, child: c } = this.cast;
    const k = tuning.birches.swing, since = this.now - this.birdAt;
    switch (this.birdOver) {
      case 'watching':
        bird.watch(this.cast.birches.swing.seat(this.seat));
        if (!bird.errand) bird.stay = true;
        break;
      case 'toBole': {
        bird.watch(c.position);
        bird.stay = false;
        const off = Math.hypot(bird.position.x - this.birdTop.x, bird.position.z - this.birdTop.z);
        if (off > BIRD_FLUTTER_FROM) {
          bird.errand = this.birdOff;
          break;
        }
        if (since < k.flutterWait) break;
        bird.errand = null;
        bird.hopOnto(this.birdTop, Math.atan2(this.birdDown.x - this.birdTop.x, this.birdDown.z - this.birdTop.z), k.flutterFor + 0.12 * off, k.flutterArc);
        this.birdOver = 'up';
        this.birdAt = this.now;
        this.birdShed = false;
        break;
      }
      case 'up':
        bird.watch(c.position);
        if (!this.birdShed && since > (k.flutterFor + 0.12 * BIRD_FLUTTER_FROM) * k.flutterShedAt) {
          this.birdShed = true;
          bird.shed(k.flutterFeathers, k.flutterFeatherSize);
        }
        if (since > k.flutterFor + 0.12 * BIRD_FLUTTER_FROM + k.onTopFor) {
          bird.bound(this.birdDown, 'hop', k.hopDownFor, k.hopDownArc);
          this.birdOver = 'down';
          this.birdAt = this.now;
        }
        break;
      case 'down':
        if (since > k.hopDownFor + 0.3) {
          bird.stay = false;
          bird.watch(null);
          this.birdOver = 'over';
        }
        break;
      default:
        break;
    }
  }

  /** The rope on the bough is the room's own creak; her coat as she lets go, and the leaves she lands in. */
  private swingSound(kind: SwingEvent, at: THREE.Vector3, strength: number): void {
    if (kind === 'creak') return;
    if (kind === 'leap') {
      this.cast.knock?.(SWING_SOUNDS.leap, at, 0.5 * strength);
      return;
    }
    this.cast.leafSound?.('burst', at, tuning.birches.swing.landLeaves);
    this.cast.birches.kick(at.x, at.z, 1.8, 1);
  }

  /**
   * Beyond the fallen birch a lens that would stand over it among its broken stubs comes in front of it, on a lens only
   * a little longer, so the nearer view still holds her whole.
   */
  private clearOfBole(s: Shot): void {
    const from = s.from;
    if (!from) return;
    const toward = from.x * FALLEN_SOUTH.x + from.z * FALLEN_SOUTH.y;
    if (toward <= 0) return;
    const most = (-LENS_OFF_BOLE - southOfFallen(s.target.x, s.target.z)) / toward;
    if (most <= 4 || s.distance <= most) return;
    s.zoom = (s.zoom ?? 1) * Math.sqrt(s.distance / most);
    s.distance = most;
  }

  /** A point on her own side of the fallen birch, a step off it: she never walks through it after anything. */
  private ownSide(x: number, z: number): THREE.Vector2 {
    const off = southOfFallen(x, z), want = this.swings ? Math.min(off, -KEEP_OFF) : Math.max(off, KEEP_OFF);
    return this.sideAt.set(x + FALLEN_SOUTH.x * (want - off), z + FALLEN_SOUTH.y * (want - off));
  }

  /** The plane plays on her side of the fallen birch, and one that comes down on the other is lifted back over. */
  private keepPlay(): { back: THREE.Vector2; at: number } {
    const side = this.swings ? -1 : 1;
    this.edge.back.set(FALLEN_SOUTH.x * side, FALLEN_SOUTH.y * side);
    this.edge.at = KEEP_OFF - side * southOfFallen(0, 0);
    return this.edge;
  }

  private toScarf(): void {
    const { child, birches } = this.cast;
    const scarf = birches.scarf;
    scarf.active = scarf.completed;
    const snag = scarf.snags[scarf.active];
    this.to('toScarf');
    this.play = 'carry';
    child.stop();
    child.lookAt = snag.center;
    const faceIt = scarf.active === 0 ? () => child.faceToward(snag.center.x, snag.center.z, 1) : undefined;
    child.walkTo(snag.before.x, snag.before.z, false, faceIt, 0.6);
  }

  /** Freed while the squirrel is still running on to hide: she and the cygnet watch it scamper off, then go after it. */
  private seeOff(round: number): void {
    this.seeingRound = round;
    this.to('seeingOff');
  }

  /** They set off once it is down among the leaves beyond the rise, so the walk never brings its dive into sight. */
  private seeingOff(): void {
    const { child: c, cygnet: bird } = this.cast;
    const k = tuning.birches.squirrel;
    c.lookAt = this.cast.squirrel.eye(this.seenGo);
    bird.watch(this.seenGo, true);
    if (this.t > k.seeOffFor && (this.squirrel.goneToGround(this.seeingRound) || this.t > k.seeOffMost)) {
      bird.watch(null);
      this.resumeWalk();
    }
  }

  /** To the edge of the round's heaps, to kneel there and look; round a heap in the way rather than through it. */
  private toRound(round: number): void {
    const { child } = this.cast;
    const r = ROUNDS[round];
    this.round = round;
    this.to('toRound');
    this.play = 'carry';
    child.stop();
    /** Her hands go to her knees as she kneels to peer: the plane rides on her bag, clear of her body. */
    child.stowPlane(true);
    const face = this.squirrel.facing(round);
    child.lookAt = round === 0 || r.shuffle ? r.lastSeen : face;
    const at = child.position, dx = r.stand.x - at.x, dz = r.stand.z - at.z, span = Math.hypot(dx, dz) || 1;
    const across = r.heaps.map((i) => BIRCH_PILES[i]).find((p) => {
      const t = THREE.MathUtils.clamp(((p.x - at.x) * dx + (p.z - at.z) * dz) / (span * span), 0, 1);
      return Math.hypot(at.x + dx * t - p.x, at.z + dz * t - p.z) < p.r + 0.5;
    });
    /** Body and head to the heaps she watches, not the way she walked in with her head turned back. */
    const faceHeaps = () => child.faceToward(face.x, face.z, 1);
    if (!across) { child.walkTo(r.stand.x, r.stand.z, false, faceHeaps, 0.5); return; }
    const side = Math.sign((across.x - at.x) * dz - (across.z - at.z) * dx) || 1;
    const by = this.tmp.set(-dz / span * side, 0, dx / span * side).multiplyScalar(across.r + 0.9).add(this.tmp2.set(across.x, 0, across.z));
    child.walkTo(by.x, by.z, false, () => { if (this.beat === 'toRound') child.walkTo(r.stand.x, r.stand.z, false, faceHeaps, 0.5); }, 0.8);
  }

  /** Found and off: after the third, the leap into the deepest leaves left; otherwise the walk goes on after it. */
  private endRound(): void {
    this.squirrel.release();
    if (this.round === ROUNDS.length - 1) {
      this.to('leap');
      this.squirrel.startLeap();
    } else this.resumeWalk();
  }

  private resumeWalk(): void {
    this.round = -1;
    this.cast.child.stowPlane(false);
    this.cast.birches.scarf.active = -1;
    this.to('walk');
    this.play = this.cast.plane.held ? 'hold' : 'watch';
    this.holdUntil = this.now + 0.8;
    this.cast.child.lookAt = null;
    this.cheered = false;
    this.lastLegAt = 0;
  }

  private throwAhead(): void {
    const c = this.cast.child;
    const t = this.leg === ROUTE.length - 1 && this.cast.birches.scarf.finished ? this.cast.boat.position : this.target();
    const tx = t instanceof THREE.Vector2 ? t.x : t.x;
    const tz = t instanceof THREE.Vector2 ? t.y : t.z;
    const angle = Math.atan2(tx - c.position.x, tz - c.position.z) + (Math.random() - 0.5) * 0.6;
    c.throwToward(c.position.x + Math.sin(angle) * 15, c.position.z + Math.cos(angle) * 15, () => {
      if (this.beat !== 'walk') return;
      this.cast.plane.launch(c.handPosition(this.hand), this.tmp.set(Math.sin(angle) * 7.2, 5.2, Math.cos(angle) * 7.2));
      this.play = 'watch';
      this.cheered = false;
      c.lookAt = this.cast.plane.position;
    });
  }

  private fetch(): void {
    const { child: c, plane: p } = this.cast;
    this.play = 'fetch';
    const to = this.ownSide(p.position.x, p.position.z);
    c.walkTo(to.x, to.y, true, () => {
      if (this.beat !== 'walk' || this.play !== 'fetch') return;
      if (Math.hypot(p.position.x - c.position.x, p.position.z - c.position.z) > 2.6 || !p.landed) {
        this.play = 'watch';
        return;
      }
      c.pickUp(() => {
        if (this.beat !== 'walk' || this.play !== 'fetch') return;
        p.hold(c);
        this.play = 'hold';
        this.holdUntil = this.now + 0.6 + Math.random() * 0.8;
      }, p.position);
    }, 1.2);
  }

  private board(): void {
    const { child: c, boat } = this.cast;
    if (!this.cast.birches.scarf.finished) return;
    if (!this.cast.cygnet.carried) {
      this.to('gathering');
      this.cast.cygnet.errand = null;
      this.cast.cygnet.stay = false;
      this.cast.cygnet.watch(null);
      this.cast.carry.gatherUp(() => this.cast.carry.stow());
      return;
    }
    // Already in her arms, it goes into the satchel all the same: that is where it rides to the stairs.
    if (this.cast.cygnet.seat !== 'satchel') {
      this.to('gathering');
      this.cast.carry.stow();
      return;
    }
    this.cast.cygnet.mayFly = true;
    this.to('toBoat');
    c.lookAt = null;
    const beside = boat.boardingPoint(this.tmp);
    c.walkTo(beside.x, beside.z, false, () => {
      this.to('push');
      c.faceToward(boat.position.x, boat.position.z, 1);
      c.board(boat, () => this.to('aboard'));
    }, 0.5);
  }

  private get tangleFrom(): THREE.Vector3 {
    const active = this.cast.birches.scarf.active, tall = window.innerWidth < window.innerHeight;
    if (this.beat === 'unravelling') return this.scarfFrom;
    if (active === 0) return tall ? this.firstFromTall : this.firstFrom;
    return active === 1 && tall ? this.secondFromTall : this.scarfFrom;
  }

  private frame(): void {
    const c = this.cast.child.position;
    const p = this.cast.plane.position;
    const s = this.shot;
    // Keep the camera inside the grove in portrait, rather than retreating through several more trees.
    s.fitWidth = false;
    s.zoom = undefined;
    s.attention = this.squirrel.attention.strength > 0.01 ? this.squirrel.attention : undefined;
    if (this.round >= 0) {
      const r = ROUNDS[this.round];
      frameShot(r.frames, window.innerWidth / window.innerHeight, s);
      this.pace = 0.4;
      this.focus.set(r.area.x, r.stand.y, r.area.z);
      return;
    }
    if (AT_TANGLE.includes(this.beat)) {
      const scarf = this.cast.birches.scarf;
      const at = scarf.focus ?? this.cast.boat.sailPoint(this.scarfMast);
      const first = scarf.active === 0 && this.beat !== 'unravelling';
      s.from = this.tangleFrom;
      const tall = first && window.innerWidth < window.innerHeight;
      s.target.set(tall ? at.x * 0.65 + c.x * 0.35 : (at.x + c.x) * 0.5,
        at.y * 0.65 + (c.y + 1.2) * 0.35, at.z * 0.7 + c.z * 0.3);
      s.zoom = tall ? 1.25 : scarf.active === 1 && this.beat !== 'unravelling' && window.innerWidth < window.innerHeight ? 1.3 : undefined;
      s.distance = this.beat === 'unravelling' ? 28 : scarf.active === 1 ? 17 : first ? 18 : 24;
      s.distance *= Math.max(1, 0.56 / (window.innerWidth / window.innerHeight));
      s.height = this.beat === 'unravelling' ? 7 : scarf.active === 1 ? 3.8 : first ? 3 : 5.5;
      /** Portrait's tight frame has no room to come nearer, and its lens stands clear above the bole's middle. */
      if (this.swings && window.innerWidth >= window.innerHeight) this.clearOfBole(s);
      this.focus.copy(at);
      this.pace = 0.5;
      return;
    }
    if (this.beat === 'swinging') {
      /**
       * Three-quarters on to the swing from the south-east, low and into the sun, the arc running up to the bole and
       * over it; portrait looks nearer along the arc. As she flies the lens rises and looks on to where she lands.
       */
      const k = tuning.birches.swing, aspect = window.innerWidth / window.innerHeight, f = aspect < 1 ? k.lensTall : k.lens;
      const pivot = this.cast.birches.swing.pivot;
      const over = this.leftSwingAt < 0 ? 0 : THREE.MathUtils.smootherstep(this.now - this.leftSwingAt, 0, k.landedIn);
      const x = pivot.x - 0.6, z = pivot.z - f.ahead - over * k.follow;
      s.from = this.swingFrom.set(f.from[0], 0, f.from[1]).normalize();
      s.target.set(x, Math.max(heightAt(x, z), 0) + f.lift - over, z);
      s.distance = f.distance * (aspect < 1 ? Math.max(1, 0.5625 / aspect) : 1);
      s.height = f.height + over * k.rise;
      s.zoom = f.zoom === 1 ? undefined : f.zoom;
      this.pace = 0.4;
      this.focus.copy(this.cast.birches.swing.seat(this.seat));
      return;
    }
    s.from = undefined;
    if (this.beat === 'toBoat' || this.beat === 'push' || this.beat === 'aboard') {
      const b = this.cast.boat.position;
      /** High enough to look down the last of the slope at them rather than along it. */
      s.target.set((c.x + b.x) / 2, b.y + 3.2, (c.z + b.z) / 2 - 2);
      s.distance = 24;
      s.height = 8;
      this.pace = 0.35;
      this.focus.copy(b);
      return;
    }
    if (this.beat === 'ashore' || this.beat === 'wonder') {
      s.target.set(c.x, Math.max(heightAt(c.x, c.z), 0) + 3, c.z - 6);
      s.distance = 28;
      s.height = 7;
      const k = tuning.birches.arrivalLens;
      if (this.beat === 'ashore') s.zoom = THREE.MathUtils.lerp(tuning.crossingCamera.arrivals.birches.reveal.zoom, 1,
        THREE.MathUtils.smootherstep(this.t, k.holdFor, k.goneBy));
      this.pace = 0.3;
      this.focus.copy(c);
      return;
    }
    const bird = this.cast.cygnet;
    const bw = bird.carried ? 0 : 0.16;
    const pw = this.cast.plane.held ? 0 : 0.22 - bw * 0.4;
    const fx = c.x * (1 - pw - bw) + p.x * pw + bird.position.x * bw;
    const fz = c.z * (1 - pw - bw) + p.z * pw + bird.position.z * bw - (bw > 0 ? 2 : 4);
    const ground = Math.max(heightAt(fx, fz), 0);
    s.target.set(fx, ground + 3.4, fz);
    /** Capped: from further back there is only more wood between the camera and the child. */
    /** Low, and under the canopy: from up above, a wood is a ceiling with nothing of the room left under it. */
    s.distance = Math.min(26, 18 + Math.hypot(p.x - c.x, p.z - c.z) * 0.4);
    s.height = s.distance * 0.3;
    /**
     * Coming over the crest the shot opens out and takes in the far beach with the boat on it, so the way on is
     * the clearest thing in the frame while they are still walking down to it.
     */
    const b = this.cast.boat.position;
    const down = THREE.MathUtils.smoothstep(BIRCHES_CLEARING.y - 4 - c.z, 0, 30);
    if (down > 0) {
      /** Aimed over the boat rather than at it: down the slope, the sight line to the sand is along the ground. */
      s.target.lerp(this.tmp.set(b.x, Math.max(b.y, 0) + 4.5, b.z), 0.16 * down);
      s.distance += Math.hypot(b.x - fx, b.z - fz) * 0.12 * down;
      s.height += 5 * down;
    }
    this.pace = 0.4;
    this.focus.set(fx, ground, fz);
  }
}
