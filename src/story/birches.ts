import * as THREE from 'three';
import type { Shot } from '../camera';
import { BIRCHES_BERTH, BIRCHES_CLEARING, BIRCHES_LANDING, BIRCHES_WALK } from '../world/birches';
import { heightAt } from '../world/island';
import type { Cast, Chapter } from './cast';
import { cue } from './cues';
import { tuning } from '../tuning';
import { BirchLeafPlay } from './birches-play';
import { SCARF_SNAGS } from '../world/birch-scarf';

const ROUTE = BIRCHES_WALK;
/** The leg that ends in the clearing on the crest, where the swing is. */
const CLEARING_LEG = 2;
/** How near the boat either of them has to be before the child takes the hint and pushes off. */
const BOARDING = 20;
/** And if the leaves are more interesting than the boat, they go anyway after this long on the last stretch. */
const LAST_LEG_PATIENCE = 45;
type Beat = 'ashore' | 'wonder' | 'walk' | 'swingOffer' | 'toSwing' | 'swinging' | 'toScarf' | 'scarf' | 'unravelling' | 'gathering' | 'toBoat' | 'push' | 'aboard';
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
  private swings = 0;
  private swingOffered = false;
  private lastSwingInput = 0;
  private leavingSwing = false;
  private readonly mountFrom = new THREE.Vector3();
  private readonly scarfMast = new THREE.Vector3();
  private readonly hand = new THREE.Vector3();
  private readonly tmp = new THREE.Vector3();
  private readonly seat = new THREE.Vector3();
  private readonly from = new THREE.Vector3(0.72, 0, 0.69).normalize();
  private readonly scarfFrom = new THREE.Vector3(0.08, 0, 1).normalize();
  private readonly air = { x: 0, z: 0, energy: 0, lift: 0 };
  private readonly scarfTarget = new THREE.Vector2();
  private readonly crest = new THREE.Vector3(BIRCHES_CLEARING.x, 10, BIRCHES_CLEARING.y);
  private readonly leafPlay: BirchLeafPlay;

  constructor(private readonly cast: Cast) {
    this.leafPlay = new BirchLeafPlay(cast);
    const { child, plane } = cast;
    plane.homeRadius = 28;
    /** It never flies over this island, whatever the player does with the air: everything here is on the ground. */
    cast.cygnet.mayFly = false;
    child.dismount();
    child.walkTo(BIRCHES_LANDING.x - 1, BIRCHES_LANDING.y - 9, false, () => this.to('wonder'), 0.9);
  }

  get scripted(): boolean {
    /** Exploring and playing with the cygnet never take control away from the wind. */
    return !['walk', 'swingOffer', 'toSwing', 'swinging', 'toScarf', 'scarf', 'unravelling'].includes(this.beat);
  }

  get done(): boolean {
    return this.beat === 'aboard';
  }

  get checkpoint(): string | null {
    if (this.beat !== 'walk') return null;
    const count = this.cast.birches.scarf.completed;
    return count > 0 || this.swings > 0 ? `scarf4-${count}${this.swings > 0 ? '-swing' : ''}` : null;
  }
  saveCheckpoint(): number[] { return [this.leg, this.swings, this.dusk, this.cast.birches.scarf.completed]; }
  restoreCheckpoint(point: string, data: number[]): void {
    this.leg = THREE.MathUtils.clamp(Math.floor(data[0]), 0, ROUTE.length - 1);
    this.swings = Math.max(0, data[1]); this.dusk = data[2];
    // Saves made before the scarf resume beyond the tangles they have already walked past.
    const saved = data.length > 3 ? Math.floor(data[3]) : point === 'leaves' ? 2 : 1;
    // Old three-knot saves already earned their sail. Earlier saves encounter the new loop on the way.
    const count = THREE.MathUtils.clamp(!point.startsWith('scarf4-') && saved >= 3 ? SCARF_SNAGS.length : saved, 0, SCARF_SNAGS.length);
    this.cast.birches.scarf.restore(count);
    this.cast.boat.scarfSail = count === SCARF_SNAGS.length ? 1 : 0;
    this.cast.child.stop();
    this.beat = 'walk'; this.play = 'hold';
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
    const scarf = birches.scarf;
    const mast = boat.position.z < -1175 ? boat.sailPoint(this.scarfMast) : undefined;
    scarf.update(dt, this.cast.wind, mast);
    boat.scarfSail = scarf.woven;
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
        /** A moment looking up the ride at all that gold before the game starts again. */
        c.lookAt = this.crest;
        if (this.t > 4 && !c.busy) this.setOff();
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
      case 'scarf':
        c.lookAt = scarf.focus;
        if (scarf.active >= 0 && scarf.snags[scarf.active].freed) {
          cue('delight');
          if (scarf.completed === SCARF_SNAGS.length) this.to('unravelling');
          else this.resumeWalk();
        }
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

    if (['walk', 'swingOffer', 'toSwing', 'swinging', 'toScarf', 'scarf', 'unravelling'].includes(this.beat)) this.leafPlay.update(dt, time);
    birches.swing.invited = this.swings === 0 && (this.beat === 'swingOffer' || (this.beat === 'walk' && Math.hypot(c.position.x - BIRCHES_CLEARING.x, c.position.z - BIRCHES_CLEARING.y) < 16));
    birches.swing.update(dt, this.cast.wind);
    if (this.beat !== 'swinging') birches.shake(0);
    if (p.held) p.hold(c);
    this.frame();
  }

  /**
   * It starts in the satchel; nearby leaves can tempt it down while the walk continues.
   */
  private setOff(): void {
    const { cygnet, carry } = this.cast;
    if (cygnet.seat === 'cradle') carry.stow();
    else cygnet.rideIn('satchel');
    this.to('walk');
    this.play = 'carry';
    this.throwAhead();
  }

  private target(): THREE.Vector2 {
    const scarf = this.cast.birches.scarf;
    const next = SCARF_SNAGS[scarf.completed];
    const route = ROUTE[Math.min(this.leg, ROUTE.length - 1)];
    if (next && route.y < next.stopZ) return this.scarfTarget.set(next.stopX, next.stopZ);
    return route;
  }

  private updateWalk(time: number): void {
    const { child: c, plane: p, boat, wind } = this.cast;
    const scarf = this.cast.birches.scarf;
    const snag = scarf.snags[scarf.completed];
    if (this.swings === 0 && scarf.completed > 0 && Math.hypot(c.position.x - BIRCHES_CLEARING.x, c.position.z - BIRCHES_CLEARING.y) < 13) {
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
    if (this.play === 'watch') {
      c.lookAt = p.position;
      /** A gust that takes a cloud of gold off a whole stand at once is worth stopping for. */
      const w = wind.sample(c.position.x, c.position.z, this.air);
      if (!this.cheered && (Math.hypot(w.x, w.z) > 12 || p.position.y - heightAt(p.position.x, p.position.z) > 8)) {
        this.cheered = true;
        c.cheer();
        cue('delight');
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
      const nearBoat = Math.hypot(p.position.x - boat.position.x, p.position.z - boat.position.z) < BOARDING;
      const childNear = Math.hypot(c.position.x - boat.position.x, c.position.z - boat.position.z) < BOARDING;
      const waited = this.lastLegAt > 0 && time - this.lastLegAt > LAST_LEG_PATIENCE;
      if (last && (nearBoat || childNear || waited)) this.board();
      else if (time > this.holdUntil) this.throwAhead();
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
    if (!this.leavingSwing && input.present && (input.gust > 1.4 || input.charge > 0.15)) this.lastSwingInput = this.now;
    if (this.now - this.lastSwingInput > tuning.birches.scarf.quietToLeaveSwing) this.leavingSwing = true;
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

  private resumeWalk(): void {
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
      });
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

  private frame(): void {
    const c = this.cast.child.position;
    const p = this.cast.plane.position;
    const s = this.shot;
    // Keep the camera inside the grove in portrait, rather than retreating through several more trees.
    s.fitWidth = false;
    if (this.beat === 'toScarf' || this.beat === 'scarf' || this.beat === 'unravelling') {
      const scarf = this.cast.birches.scarf;
      const at = scarf.focus ?? this.cast.boat.sailPoint(this.scarfMast);
      s.from = this.scarfFrom;
      s.target.set((at.x + c.x) * 0.5,
        at.y * 0.65 + (c.y + 1.2) * 0.35, at.z * 0.7 + c.z * 0.3);
      s.distance = this.beat === 'unravelling' ? 28 : scarf.active === 1 ? 17 : 24;
      s.distance *= Math.max(1, 0.56 / (window.innerWidth / window.innerHeight));
      s.height = this.beat === 'unravelling' ? 7 : scarf.active === 1 ? 3.8 : 5.5;
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
