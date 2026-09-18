import * as THREE from 'three';
import type { Shot } from '../camera';
import { BIRCHES_BERTH, BIRCHES_CLEARING, BIRCHES_LANDING, BIRCHES_WALK, BIRCH_PILES } from '../world/birches';
import { heightAt } from '../world/island';
import type { Cast, Chapter } from './cast';
import { cue } from './cues';

const ROUTE = BIRCHES_WALK;
/** The leg that ends in the clearing on the crest, where the swing is. */
const CLEARING_LEG = 2;
/** How near the boat either of them has to be before the child takes the hint and pushes off. */
const BOARDING = 20;
/** And if the leaves are more interesting than the boat, they go anyway after this long on the last stretch. */
const LAST_LEG_PATIENCE = 45;
/** Nobody waits on a swing for longer than this, however well or badly it is going. */
const SWING_FOR = 40;
/** A swing this far out of true counts as a good one; after a few of them the child has had their fill. */
const GOOD_SWING = 0.45;
const ENOUGH_SWINGS = 6;
/** The leg that goes down into the hollow, and the heap at the bottom of it. */
const HOLLOW_LEG = 3;
const PLAY_PILE = BIRCH_PILES[2];
/** Seconds of leaf play at the most, and dives after which the child has laughed enough and picks it up. */
const PLAY_FOR = 50;
const ENOUGH_DIVES = 3;
/** Nothing in this room may stop the walk: after this long the gathering-up happens whatever else is going on. */
const PLAY_HARD_STOP = 95;
/** The run and the dive borrow the try-to-fly bound, which takes this long from the crouch to lying on its breast. */
const DIVE_TAKES = 4.2;
/** How far into that the leaves go up round it. */
const DIVE_LANDS = 2.7;

type Beat = 'ashore' | 'wonder' | 'walk' | 'toSwing' | 'swinging' | 'toLeaves' | 'leaves' | 'gathering' | 'toBoat' | 'push' | 'aboard';
type Play = 'carry' | 'watch' | 'fetch' | 'hold';
/** The cygnet's half of the leaf play: what it is up to at the heap this moment. */
type Fun = 'notice' | 'round' | 'dive' | 'under' | 'up' | 'chase';

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
  readonly haze = 0.85;
  dusk = 0.58;
  readonly shot: Shot = { target: new THREE.Vector3(), distance: 32, height: 9 };
  readonly music = 'birches' as const;
  readonly season = 0.44;
  readonly focus = new THREE.Vector3();
  private play: Play = 'carry';
  private leg = 0;
  private beatStart = 0;
  private holdUntil = 0;
  private now = 0;
  private cheered = false;
  private lastLegAt = 0;
  private swings = 0;
  private wasOut = false;
  private delighted = false;
  private readonly hand = new THREE.Vector3();
  private readonly tmp = new THREE.Vector3();
  private readonly seat = new THREE.Vector3();
  private readonly from = new THREE.Vector3(0.72, 0, 0.69).normalize();
  private readonly air = { x: 0, z: 0, energy: 0, lift: 0 };
  private readonly crest = new THREE.Vector3(BIRCHES_CLEARING.x, 10, BIRCHES_CLEARING.y);
  /** The leaf play: whether it has happened, what the cygnet is up to, and how long it has been going on. */
  private played = false;
  private fun: Fun = 'notice';
  private funAt = 0;
  private dives = 0;
  private playAt = 0;
  private burst = false;
  private readonly pile = new THREE.Vector3(PLAY_PILE.x, 0, PLAY_PILE.z);
  private readonly spot = new THREE.Vector3();

  constructor(private readonly cast: Cast) {
    const { child, plane, boat } = cast;
    plane.homeRadius = 28;
    /** It never flies over this island, whatever the player does with the air: everything here is on the ground. */
    cast.cygnet.mayFly = false;
    child.dismount();
    boat.beach(BIRCHES_BERTH.x, BIRCHES_BERTH.z, 0.15);
    child.walkTo(BIRCHES_LANDING.x - 1, BIRCHES_LANDING.y - 9, false, () => this.to('wonder'), 0.9);
  }

  get scripted(): boolean {
    /** The leaf play is the player's too: they blow the heap back together while the cygnet is learning about it. */
    return this.beat !== 'walk' && this.beat !== 'swinging' && this.beat !== 'leaves';
  }

  get done(): boolean {
    return this.beat === 'aboard';
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
    /** The afternoon goes on while they walk, and hands over to the village's dusk at the far beach. */
    const over = THREE.MathUtils.clamp((BIRCHES_LANDING.y - c.position.z) / (BIRCHES_LANDING.y - BIRCHES_BERTH.z), 0, 1);
    this.dusk += (0.58 + over * 0.12 - this.dusk) * (1 - Math.exp(-dt * 0.3));

    /** The plane leans toward wherever the walk is going next, and over the crest toward the boat on the far sand. */
    if (!p.departing) {
      const last = this.leg === ROUTE.length - 1;
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
        p.homeRadius = 18;
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
      case 'toSwing':
        if (!c.busy) this.mount();
        break;
      case 'swinging':
        this.updateSwing(dt);
        break;
      case 'leaves':
        this.updateLeaves(time);
        break;
      case 'gathering':
        /** Whatever the duet is doing, the walk goes on: this beat can never be the end of the room. */
        if (!this.cast.carry.busy && !c.busy) this.walkOn();
        break;
      case 'push':
        if (this.t > 0.9 && !boat.afloat) boat.launch();
        if (this.t > 2.3) {
          this.to('aboard');
          c.ride(boat.seat(this.tmp), boat.yaw);
        }
        break;
      default:
        break;
    }

    birches.swing.update(dt, this.cast.wind);
    if (this.beat !== 'swinging') birches.shake(0);
    if (p.held) p.hold(c.handPosition(this.hand), c.yaw);
    this.frame();
  }

  /**
   * The one place this chapter touches the companion: it rides in the satchel over the island, the way it does on
   * every other long walk, and it is never taken out again here.
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
    return ROUTE[Math.min(this.leg, ROUTE.length - 1)];
  }

  private updateWalk(time: number): void {
    const { child: c, plane: p, boat, wind } = this.cast;
    const t = this.target();
    if (Math.hypot(c.position.x - t.x, c.position.z - t.y) < 14 && this.leg < ROUTE.length - 1) this.leg++;
    const last = this.leg === ROUTE.length - 1;
    if (last && this.lastLegAt === 0) this.lastLegAt = time;
    /** Coming into the clearing, the swing is already moving on the wind, and that is the whole invitation. */
    if (this.leg >= CLEARING_LEG && this.swings === 0 && Math.hypot(c.position.x - BIRCHES_CLEARING.x, c.position.z - BIRCHES_CLEARING.y) < 9) {
      this.toSwing();
      return;
    }
    /** And down in the hollow beyond it, the heap the cygnet has never seen the like of. */
    if (this.leg >= HOLLOW_LEG && !this.played && Math.hypot(c.position.x - PLAY_PILE.x, c.position.z - PLAY_PILE.z) < 11) {
      this.toLeaves();
      return;
    }

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
    c.swing = 1;
  }

  /** The player pushes; the swing answers; gold comes down round them both. Nothing here is asked of anyone. */
  private updateSwing(dt: number): void {
    const { child: c, birches } = this.cast;
    const swing = birches.swing;
    c.ride(swing.seat(this.seat), 0);
    c.kick = THREE.MathUtils.clamp(swing.angle / 0.5, -1, 1);
    const out = Math.abs(swing.angle);
    birches.shake(Math.min(1, out * 1.6));
    if (out > GOOD_SWING && !this.wasOut) {
      this.wasOut = true;
      this.swings++;
      if (!this.delighted) {
        this.delighted = true;
        cue('delight');
      }
    } else if (out < GOOD_SWING * 0.5) {
      this.wasOut = false;
    }
    /** They get off at the bottom of the arc, when they have had enough of it or when the walk has waited long enough. */
    const done = this.swings > ENOUGH_SWINGS || this.t > SWING_FOR;
    if (done && out < 0.16 && Math.abs(swing.speed) < 0.35) {
      swing.rider = 0;
      c.swing = 0;
      c.kick = 0;
      c.dismount();
      this.to('walk');
      this.leg = CLEARING_LEG + 1;
      this.lastLegAt = 0;
      this.play = 'watch';
      this.cheered = false;
      c.walkTo(ROUTE[this.leg].x, ROUTE[this.leg].y, false, undefined, 3);
    }
  }

  /**
   * The heap in the hollow. The child stops short of it, takes the cygnet out of the satchel and sets it down in
   * front of it, and then it is the cygnet's. Nothing about this is on rails: the player can blow the heap back
   * together under it the whole time, and the walk goes on whether the play finishes or not.
   */
  private toLeaves(): void {
    const { child: c, cygnet: k, carry } = this.cast;
    this.played = true;
    this.to('toLeaves');
    this.play = 'carry';
    c.lookAt = null;
    /** Beside it, not in it: you put something down at the edge of a heap of leaves and let it find the heap. */
    const a = Math.atan2(c.position.x - PLAY_PILE.x, c.position.z - PLAY_PILE.z);
    const x = PLAY_PILE.x + Math.sin(a) * (PLAY_PILE.r + 1.6);
    const z = PLAY_PILE.z + Math.cos(a) * (PLAY_PILE.r + 1.6);
    c.walkTo(x, z, false, () => {
      c.faceToward(PLAY_PILE.x, PLAY_PILE.z, 1);
      carry.unstow(() =>
        carry.setDown(() => {
          this.to('leaves');
          this.playAt = this.now;
          this.begin('notice');
          k.errand = null;
          k.watch(this.pile);
        }, Math.atan2(PLAY_PILE.x - x, PLAY_PILE.z - z)),
      );
    }, 0.5);
  }

  private begin(fun: Fun): void {
    this.fun = fun;
    this.funAt = this.now;
  }

  /** Somewhere on the rim of the heap, on the far side of it from wherever it is standing now. */
  private rim(from: THREE.Vector3, out: THREE.Vector3): THREE.Vector3 {
    const a = Math.atan2(from.x - PLAY_PILE.x, from.z - PLAY_PILE.z) + 2.1 + Math.random() * 2;
    return out.set(PLAY_PILE.x + Math.sin(a) * (PLAY_PILE.r + 1.1), 0, PLAY_PILE.z + Math.cos(a) * (PLAY_PILE.r + 1.1));
  }

  /**
   * A cygnet finding out what a heap of leaves is. It looks, it goes round it, it runs at it and goes in, and the
   * leaves go up and it is not there any more; then a head comes up out of them with a leaf on it, it rummages,
   * shakes itself off, and does the whole thing again. A leaf the player blows past it wins over the heap.
   */
  private updateLeaves(time: number): void {
    const { child: c, cygnet: k, birches, wind } = this.cast;
    const since = time - this.funAt;
    c.lookAt = k.eye(this.tmp);
    const w = wind.sample(k.position.x, k.position.z, this.air);
    const blowing = Math.hypot(w.x, w.z);

    switch (this.fun) {
      case 'notice':
        k.watch(this.pile);
        /** Anything the player sends skittering past is better than a heap that is not going anywhere. */
        if (blowing > 7 && since > 0.8) {
          k.errand = this.spot.set(k.position.x + (w.x / blowing) * 5.5, 0, k.position.z + (w.z / blowing) * 5.5);
          k.watch(k.errand);
          this.begin('chase');
        } else if (since > 1.6) {
          k.errand = this.rim(k.position, this.spot);
          this.begin('round');
        }
        break;
      case 'chase':
        if (!k.errand || since > 4) {
          k.mind.react('snap', this.tmp.copy(k.position).setY(k.position.y + 0.15));
          this.begin('notice');
        }
        break;
      case 'round':
        if (!k.errand || since > 5) {
          k.watch(this.pile);
          k.tryToFly(Math.atan2(PLAY_PILE.x - k.position.x, PLAY_PILE.z - k.position.z));
          this.burst = false;
          this.begin('dive');
        }
        break;
      case 'dive':
        /** It goes in on its breast, and the heap goes up round it and hides it. */
        if (!this.burst && since > DIVE_LANDS) {
          this.burst = true;
          this.dives++;
          birches.kick(k.position.x, k.position.z, 3.2, 1);
          c.cheer();
        }
        if (since > DIVE_TAKES) {
          k.mind.perform('delve', 2.4);
          this.begin('under');
        }
        break;
      case 'under':
        k.watch(null);
        if (since > 2.5) {
          k.mind.perform('shake', 1.1);
          k.bind(0.03);
          this.begin('up');
        }
        break;
      case 'up':
        if (since > 1.8) this.begin('notice');
        break;
    }

    const over = this.dives >= ENOUGH_DIVES || time - this.playAt > PLAY_FOR;
    if (over && (this.fun === 'notice' || this.fun === 'up')) this.gather();
    if (time - this.playAt > PLAY_HARD_STOP) this.gather();
  }

  private gather(): void {
    const { cygnet: k, carry } = this.cast;
    this.to('gathering');
    k.errand = null;
    k.watch(null);
    carry.gatherUp(() => carry.stow());
  }

  private walkOn(): void {
    const { child: c } = this.cast;
    this.to('walk');
    this.leg = HOLLOW_LEG + 1;
    this.play = 'watch';
    this.cheered = false;
    c.lookAt = null;
    c.walkTo(ROUTE[this.leg].x, ROUTE[this.leg].y, false, undefined, 3);
  }

  private throwAhead(): void {
    const c = this.cast.child;
    const t = this.leg === ROUTE.length - 1 ? this.cast.boat.position : this.target();
    const tx = t instanceof THREE.Vector2 ? t.x : t.x;
    const tz = t instanceof THREE.Vector2 ? t.y : t.z;
    const angle = Math.atan2(tx - c.position.x, tz - c.position.z) + (Math.random() - 0.5) * 0.6;
    c.throwToward(c.position.x + Math.sin(angle) * 15, c.position.z + Math.cos(angle) * 15, () => {
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
      if (this.play !== 'fetch') return;
      if (Math.hypot(p.position.x - c.position.x, p.position.z - c.position.z) > 2.6 || !p.landed) {
        this.play = 'watch';
        return;
      }
      c.pickUp(() => {
        p.hold(c.handPosition(this.hand), c.yaw);
        this.play = 'hold';
        this.holdUntil = this.now + 0.6 + Math.random() * 0.8;
      });
    }, 1.2);
  }

  private board(): void {
    const { child: c, boat } = this.cast;
    this.cast.cygnet.mayFly = true;
    this.to('toBoat');
    c.lookAt = null;
    c.walkTo(boat.position.x - 1.3, boat.position.z + 2.5, false, () => {
      this.to('push');
      c.faceToward(boat.position.x, boat.position.z, 1);
      c.push();
    }, 0.5);
  }

  private frame(): void {
    const c = this.cast.child.position;
    const p = this.cast.plane.position;
    const s = this.shot;
    if (this.beat === 'toSwing' || this.beat === 'swinging') {
      /** Three-quarters on to the swing, low: the one shot in the room that is about a face and not a hillside. */
      const seat = this.cast.birches.swing.seat(this.seat);
      s.from = this.from;
      s.target.set(seat.x, seat.y + 0.9, seat.z);
      s.distance = 14;
      s.height = 2.6;
      this.pace = 0.4;
      this.focus.copy(seat);
      return;
    }
    if (this.beat === 'toLeaves' || this.beat === 'leaves' || this.beat === 'gathering') {
      /**
       * Low and close on the heap, with the child on one side of it and the cygnet in it: the whole joke is a bird
       * disappearing into a pile of leaves, and from the walking camera it would be a speck among the trunks.
       */
      const k = this.cast.cygnet.position;
      s.from = undefined;
      const mx = (this.pile.x * 2 + c.x + k.x) / 4;
      const mz = (this.pile.z * 2 + c.z + k.z) / 4;
      s.target.set(mx, Math.max(heightAt(mx, mz), 0) + 1.3, mz);
      s.distance = 11;
      s.height = 3.4;
      this.pace = 0.4;
      this.focus.set(this.pile.x, Math.max(heightAt(this.pile.x, this.pile.z), 0), this.pile.z);
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
      s.target.set(c.x, Math.max(heightAt(c.x, c.z), 0) + 4, c.z - 13);
      s.distance = 28;
      s.height = 7;
      this.pace = 0.3;
      this.focus.copy(c);
      return;
    }
    const pw = this.cast.plane.held ? 0 : 0.22;
    const fx = c.x * (1 - pw) + p.x * pw;
    const fz = c.z * (1 - pw) + p.z * pw - 4;
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
