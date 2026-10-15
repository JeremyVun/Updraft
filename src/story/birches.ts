import { birchesPoint, type CheckpointPayload } from './checkpoint-data';
import * as THREE from 'three';
import type { Shot } from '../camera';
import type { Coax } from '../fx/swirl';
import { BIRCHES_BERTH, BIRCHES_CLEARING, BIRCHES_LANDING, BIRCHES_WALK, BIRCH_PILES } from '../world/birches';
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
type Beat = 'ashore' | 'wonder' | 'walk' | 'swingOffer' | 'toSwing' | 'swinging' | 'toScarf' | 'scarf' | 'counting' | 'toRound' | 'round' | 'leap'
  | 'unravelling' | 'gathering' | 'toBoat' | 'push' | 'aboard';
/** The walk's stops in the order it meets them: the squirrel's rounds between the scarf's tangles. */
const STOPS = [{ round: 0 }, { tangle: 0 }, { round: 1 }, { tangle: 1 }, { round: 2 }, { tangle: 2 }, { tangle: 3 }] as const;
type Stop = (typeof STOPS)[number];
/** Further past a round's heaps than walking can take her without stopping there: she was put past it. */
const PUT_PAST = 10;
/** Beats where the player is playing, and the wind is theirs. */
const PLAYING: readonly Beat[] = ['walk', 'swingOffer', 'toSwing', 'swinging', 'toScarf', 'scarf', 'counting', 'toRound', 'round', 'unravelling'];
const AT_TANGLE: readonly Beat[] = ['toScarf', 'scarf', 'counting', 'unravelling'];
type Play = 'carry' | 'watch' | 'fetch' | 'hold';

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
  private beatStart = 0;
  private holdUntil = 0;
  private now = 0;
  private cheered = false;
  private lastLegAt = 0;
  private readonly arrival = new PlaneArrival();
  private swings = 0;
  private swingOffered = false;
  private puttingDown = false;
  private lastSwingInput = 0;
  private leavingSwing = false;
  private swingPushed = false;
  private readonly mountFrom = new THREE.Vector3();
  private readonly scarfMast = new THREE.Vector3();
  private readonly hand = new THREE.Vector3();
  private readonly tmp = new THREE.Vector3();
  private readonly tmp2 = new THREE.Vector3();
  private readonly seat = new THREE.Vector3();
  private readonly from = new THREE.Vector3(0.72, 0, 0.69).normalize();
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
  private readonly crest = new THREE.Vector3(BIRCHES_CLEARING.x, 10, BIRCHES_CLEARING.y);
  private readonly leafPlay: BirchLeafPlay;
  /** The red squirrel's hide-and-seek, which the walk stops for as it stops for the tangles. */
  readonly squirrel: BirchesSquirrel;
  /** The round the walk is at, while it is at one. */
  private round = -1;
  private readonly hideWent = new THREE.Vector3();
  private readonly seenGo = new THREE.Vector3();
  private readonly lookingFor = new THREE.Vector3();
  private countRound = -1;
  /** Where the count is: 0 seeing it go, 1 turned away counting, 2 turned back round to look for it. */
  private countPhase = 0;
  private readonly herFace = new THREE.Vector3();
  private lens = 1;
  private lensRate = 0;
  private readonly cueNow: SquirrelCue = { round: -1, standing: false, seeking: false, tangles: 0, swingOver: false, gathered: false, leaving: false, atTangle: false, atSwing: false };

  constructor(private readonly cast: Cast) {
    this.leafPlay = new BirchLeafPlay(cast);
    this.squirrel = new BirchesSquirrel(cast);
    const { child, plane } = cast;
    plane.homeRadius = 28;
    /** It never flies over this island, whatever the player does with the air: everything here is on the ground. */
    cast.cygnet.mayFly = false;
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
    this.swings = Math.max(0, data[1]); this.dusk = data[2];
    // Saves made before the scarf resume beyond the tangles they have already walked past.
    const saved = data.length > 3 ? Math.floor(data[3]) : point === 'leaves' ? 2 : 1;
    // Old three-knot saves already earned their sail. Earlier saves encounter the new loop on the way.
    const fourKnots = point.startsWith('scarf4-') || point.startsWith('squirrel');
    const count = THREE.MathUtils.clamp(!fourKnots && saved >= 3 ? SCARF_SNAGS.length : saved, 0, SCARF_SNAGS.length);
    this.cast.birches.scarf.restore(count);
    this.cast.boat.scarfSail = count === SCARF_SNAGS.length ? 1 : 0;
    const { child, cygnet } = this.cast;
    child.stop();
    child.counting = 0;
    child.stowPlane(false);
    if (cygnet.carried) {
      cygnet.release(this.tmp.set(child.position.x - Math.cos(child.yaw) * 1.2, 0, child.position.z + Math.sin(child.yaw) * 1.2));
      cygnet.seating.snap();
    }
    this.beat = 'walk'; this.play = 'hold';
    this.round = -1;
    /** Saves from before the squirrel played infer the rounds behind them: each comes before its tangle, the second before the swing. */
    const passed = count >= 3 ? 3 : count >= 2 || this.swings > 0 || this.leg > CLEARING_LEG ? 2 : count >= 1 ? 1 : 0;
    this.squirrel.release();
    this.squirrel.restore(THREE.MathUtils.clamp(data.length > 4 ? Math.floor(data[4]) : passed, 0, ROUNDS.length), this.cue());
  }

  /** What the squirrel needs to know of the story this frame. */
  private cue(): SquirrelCue {
    const scarf = this.cast.birches.scarf;
    const swinging = this.beat === 'swingOffer' || this.beat === 'toSwing' || this.beat === 'swinging';
    const c = this.cueNow;
    c.round = this.beat === 'toRound' || this.beat === 'round' ? this.round : -1;
    c.standing = (this.beat === 'toRound' || this.beat === 'round') && !this.cast.child.busy;
    c.seeking = this.beat === 'round';
    /** A tangle counts as soon as its loop starts to lift free, so the squirrel is away while it comes off. */
    const lifting = scarf.active >= 0 && scarf.snags[scarf.active].release > 0 && !scarf.snags[scarf.active].freed;
    c.tangles = scarf.completed + (lifting ? 1 : 0);
    c.swingOver = ((this.swings > 0 || this.swingOffered) && !swinging) || scarf.active === 1 || scarf.completed >= 2;
    c.gathered = scarf.finished;
    c.leaving = this.beat === 'gathering' || this.beat === 'toBoat' || this.beat === 'push' || this.beat === 'aboard';
    c.atTangle = AT_TANGLE.includes(this.beat);
    c.atSwing = swinging;
    return c;
  }

  /** The next stop the walk owes, in route order: a round of the squirrel's or a tangle of the scarf's. */
  private nextStop(): Stop | null {
    const rounds = this.squirrel.rounds, tangles = this.cast.birches.scarf.completed;
    return STOPS.find((stop) => ('round' in stop ? rounds <= stop.round : tangles <= stop.tangle)) ?? null;
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
    const { child: c, plane: p, boat, birches } = this.cast;
    p.guided = this.beat === 'walk';
    const scarf = birches.scarf;
    const mast = boat.position.z < MAST_FROM ? boat.sailPoint(this.scarfMast) : undefined;
    scarf.update(dt, this.cast.wind, mast);
    boat.scarfSail = scarf.woven;
    this.squirrel.update(dt, time, this.cue());
    // The arrival beach is behind the trees before the boat moves to the far shore.
    if (!this.boatMoved && this.leg >= CLEARING_LEG) {
      boat.beach(BIRCHES_BERTH.x, BIRCHES_BERTH.z, 0.15);
      this.boatMoved = true;
    }
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
      case 'swingOffer':
        if (birches.swing.brushAge < .5) this.toSwing();
        else if (this.t > tuning.birches.scarf.swingOfferSeconds) this.resumeWalk();
        break;
      case 'toSwing':
        if (!c.busy) this.mount();
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
          else if (next && 'round' in next && !this.squirrel.ready(next.round)) this.countTo(next.round);
          else this.resumeWalk();
        }
        break;
      case 'counting':
        this.counting();
        break;
      case 'unravelling':
        c.lookAt = boat.sailPoint(this.scarfMast);
        if (scarf.finished) this.resumeWalk();
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

    if (PLAYING.includes(this.beat) && this.round < 0 && this.beat !== 'counting') this.leafPlay.update(dt, time);
    birches.swing.invited = (this.beat === 'swinging' && !this.swingPushed && !this.leavingSwing)
      || (this.swings === 0 && (this.beat === 'swingOffer' || (this.beat === 'walk' && Math.hypot(c.position.x - BIRCHES_CLEARING.x, c.position.z - BIRCHES_CLEARING.y) < 16)));
    birches.swing.update(dt, this.cast.wind);
    if (this.beat !== 'swinging') birches.shake(0);
    if (p.held) p.hold(c);
    this.frame();
    this.easeLens(dt);
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
    const at = 'round' in stop ? ROUNDS[stop.round].stand : { x: SCARF_SNAGS[stop.tangle].stopX, z: SCARF_SNAGS[stop.tangle].stopZ };
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
    if (this.swings === 0 && scarf.completed > 0 && this.squirrel.rounds >= 2 && Math.hypot(c.position.x - BIRCHES_CLEARING.x, c.position.z - BIRCHES_CLEARING.y) < 13) {
      if (this.cast.birches.swing.brushAge < .5) { this.toSwing(); return; }
      if (!this.swingOffered && !c.acting) {
        this.swingOffered = true; this.play = 'carry'; c.stop();
        c.lookAt = this.cast.birches.swing.seat(this.seat);
        c.walkTo(this.seat.x + 2.8, this.seat.z + 3.4, false, undefined, .5);
        this.to('swingOffer'); return;
      }
    }
    if (snag && !c.acting && (c.position.distanceTo(snag.before) < tuning.birches.scarf.arriveWithin || c.position.z < snag.before.z)) {
      this.toScarf();
      return;
    }
    const t = this.target();
    if (Math.hypot(c.position.x - t.x, c.position.z - t.y) < 14 && this.leg < ROUTE.length - 1) this.leg++;
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
        c.walkTo(p.position.x, p.position.z, true, undefined, 5);
      }
    } else if (this.play === 'fetch') {
      c.lookAt = p.position;
      if (!p.landed && p.airborne) this.play = 'watch';
    } else if (this.play === 'hold' && !c.busy) {
      if (last) c.lookAt = boat.position;
      if (time > this.holdUntil) this.throwAhead();
    }
  }

  /** Over to the swing, which has been moving on its own since before they came over the rise. */
  private toSwing(): void {
    const { child: c, birches } = this.cast;
    this.play = 'carry'; c.stop();
    this.to('toSwing');
    const seat = birches.swing.seat(this.seat);
    c.lookAt = this.tmp.copy(seat).setY(seat.y + 0.4);
    c.walkTo(seat.x + 0.9, seat.z + 1.5, false, undefined, 0.5);
  }

  private mount(): void {
    const { child: c, birches } = this.cast;
    this.to('swinging');
    this.swings = 1;
    c.faceToward(birches.swing.pivot.x, birches.swing.pivot.z + 20, 1);
    c.lookAt = null;
    birches.swing.rider = 1;
    birches.swing.braking = false;
    this.lastSwingInput = this.now + tuning.birches.scarf.swingMountSeconds;
    this.leavingSwing = false;
    this.swingPushed = false;
    this.mountFrom.copy(c.position);
  }

  /** Keep pushing to keep playing; let the air settle to step off. One ride, with no automatic time limit. */
  private updateSwing(): void {
    const { child: c, birches, input } = this.cast;
    const swing = birches.swing;
    const mounted = THREE.MathUtils.smootherstep(this.t / tuning.birches.scarf.swingMountSeconds, 0, 1);
    swing.seat(this.seat);
    this.tmp.lerpVectors(this.mountFrom, this.seat, mounted);
    this.tmp.y += Math.sin(mounted * Math.PI) * 0.15;
    c.ride(this.tmp, 0);
    c.swing = mounted;
    c.kick = THREE.MathUtils.clamp(swing.angle / 0.5, -1, 1);
    const out = Math.abs(swing.angle);
    birches.shake(Math.min(1, out * 1.6));
    if (!this.leavingSwing && input.present && (input.gust > 1.4 || input.charge > 0.15) && this.t > tuning.birches.scarf.swingMountSeconds) {
      this.lastSwingInput = this.now;
      this.swingPushed = true;
    }
    const patience = this.swingPushed ? tuning.birches.scarf.quietToLeaveSwing : tuning.birches.scarf.firstPushWait;
    if (this.now - this.lastSwingInput > patience) this.leavingSwing = true;
    swing.braking = this.leavingSwing;
    if (this.leavingSwing && out < 0.12 && Math.abs(swing.speed) < 0.3) {
      swing.rider = 0;
      swing.braking = false;
      c.swing = 0;
      c.kick = 0;
      c.dismount();
      this.leg = Math.max(this.leg, CLEARING_LEG + 1);
      this.resumeWalk();
    }
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
    child.walkTo(snag.before.x, snag.before.z, false, undefined, 0.6);
  }

  /**
   * Freed while the squirrel is still running on to hide: hide-and-seek. She sees it go, covers her eyes and counts,
   * then looks round toward its heaps and sets off, and the walk takes her there.
   */
  private countTo(round: number): void {
    this.countRound = round;
    this.hideWent.copy(ROUNDS[round].lastSeen);
    this.cast.cygnet.errand = null;
    /** The paper goes on the bag, or it would be pressed to her face with the mitten. */
    this.cast.child.stowPlane(true);
    this.countPhase = 0;
    this.to('counting');
  }

  private counting(): void {
    const { child: c, cygnet: bird } = this.cast;
    const k = tuning.birches.squirrel;
    const counted = this.t - k.countAfter, looked = counted - k.countFor;
    c.counting = counted > 0 && looked < 0 ? 1 : 0;
    if (counted > 0 && this.countPhase === 0) {
      /** She turns her back on where it went, three-quarters to the lens, so the hands over her eyes are seen. */
      this.countPhase = 1;
      const from = this.tangleFrom, lens = Math.atan2(from.x, from.z);
      const went = Math.atan2(this.hideWent.x - c.position.x, this.hideWent.z - c.position.z);
      const off = (a: number) => Math.abs(Math.atan2(Math.sin(a - went), Math.cos(a - went)));
      const yaw = off(lens + 0.6) > off(lens - 0.6) ? lens + 0.6 : lens - 0.6;
      c.faceToward(c.position.x + Math.sin(yaw), c.position.z + Math.cos(yaw), 1);
    } else if (looked > 0 && this.countPhase === 1) {
      this.countPhase = 2;
      c.faceToward(this.hideWent.x, this.hideWent.z, 1);
    }
    if (counted <= 0) c.lookAt = this.cast.squirrel.eye(this.seenGo);
    else if (c.counting) c.lookAt = null;
    else {
      /** Looking round for it: her gaze sweeps across the way it went, and stays on it until it has gone to ground. */
      const dx = this.hideWent.x - c.position.x, dz = this.hideWent.z - c.position.z, d = Math.hypot(dx, dz) || 1;
      const across = Math.sin(looked * k.lookSweep) * d * 0.25;
      c.lookAt = this.lookingFor.set(this.hideWent.x - (dz / d) * across, this.hideWent.y, this.hideWent.z + (dx / d) * across);
    }
    /** The cygnet looks from where it went to her and back, to see what she is doing. */
    bird.watch(Math.floor(this.t / 1.6) % 2 ? c.face(this.herFace) : this.hideWent, true);
    if (looked > k.lookRound && (this.squirrel.ready(this.countRound) || looked > k.lookRoundMost)) {
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
    child.lookAt = round === 0 ? r.lastSeen : r.face;
    const at = child.position, dx = r.stand.x - at.x, dz = r.stand.z - at.z, span = Math.hypot(dx, dz) || 1;
    const across = r.heaps.map((i) => BIRCH_PILES[i]).find((p) => {
      const t = THREE.MathUtils.clamp(((p.x - at.x) * dx + (p.z - at.z) * dz) / (span * span), 0, 1);
      return Math.hypot(at.x + dx * t - p.x, at.z + dz * t - p.z) < p.r + 0.5;
    });
    if (!across) { child.walkTo(r.stand.x, r.stand.z, false, undefined, 0.5); return; }
    const side = Math.sign((across.x - at.x) * dz - (across.z - at.z) * dx) || 1;
    const by = this.tmp.set(-dz / span * side, 0, dx / span * side).multiplyScalar(across.r + 0.9).add(this.tmp2.set(across.x, 0, across.z));
    child.walkTo(by.x, by.z, false, () => { if (this.beat === 'toRound') child.walkTo(r.stand.x, r.stand.z, false, undefined, 0.5); }, 0.8);
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
    this.cast.child.counting = 0;
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
    c.walkTo(p.position.x, p.position.z, true, () => {
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
      this.focus.copy(at);
      this.pace = 0.5;
      return;
    }
    if (this.beat === 'swingOffer' || this.beat === 'toSwing' || this.beat === 'swinging') {
      /** Three-quarters on to the swing, low: the one shot in the room that is about a face and not a hillside. */
      const seat = this.cast.birches.swing.seat(this.seat);
      s.from = this.from;
      s.target.set(seat.x, seat.y + 0.9, seat.z);
      s.distance = 14;
      s.height = 2.6;
      if (this.beat === 'swingOffer') {
        s.target.lerp(this.tmp.set(c.x, c.y + 1, c.z), .5);
        s.distance = Math.max(17, 15 + Math.hypot(c.x - seat.x, c.z - seat.z) * .6) * Math.max(1, .56 / (window.innerWidth / window.innerHeight));
        s.height = 4.2;
      }
      this.pace = 0.4;
      this.focus.copy(seat);
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
