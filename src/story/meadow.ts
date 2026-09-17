import * as THREE from 'three';
import type { Shot } from '../camera';
import { mainlandCoastZ, meadowPoint } from '../world/heightfield';
import { heightAt } from '../world/island';
import type { Coax } from '../fx/swirl';
import type { Cast, Chapter } from './cast';
import { LANDING } from './crossing';
import { cue } from './cues';
import { PianoStop } from './piano';
import { tuning } from '../tuning';

type Beat = 'ashore' | 'waiting' | 'wave' | 'walk' | 'crest' | 'try' | 'glide' | 'toBoat' | 'push' | 'aboard';
type Play = 'carry' | 'watch' | 'fetch' | 'hold';

/** The way inland, across the meadow to its far shore, in the coordinates the meadow was sculpted in. */
export const ROUTE = [
  [6, -660],
  [-18, -740],
  [-40, -830],
  [-4, -930],
  [30, -1020],
  [12, -1100],
  [-6, -1148],
].map(([x, z]) => {
  const p = meadowPoint(x, z);
  return new THREE.Vector2(p.x, p.z);
});
const shore = meadowPoint(-6, -1172);
/** Where the boat is waiting on the far shore. Nobody put it there, and nobody remarks on it. */
export const FAR_SHORE = new THREE.Vector3(shore.x, 0, shore.z);

/** The high ground on the walk, where the haze thins and you are told, without a word, where you are going. */
const CREST_LEG = 2;
/** How near the crest waypoint counts as being up on the rise, and how many cranes are in the family. */
const CREST_NEAR = 16;
const FAMILY = 22;
/**
 * The reveal shot: the frame is centred `ahead` of the child with the camera `back` behind them, standing at
 * `eye` above the ground and looking `look` above it, tipping up to `tilt` as the cranes climb, and swung
 * `swing` off the line between the two so the family is not stacked dead above their heads.
 */
const REVEAL = { ahead: 15, back: 16, eye: 5, look: 5.4, tilt: 1.2, swing: 0.06 };

const WAVE_SPEED = 85;
const WAVE_REACH = 3600;
/** The sun shower on the walk: it gathers, falls steadily, then drifts away (seconds). */
const SHOWER = { gather: 10, fall: 30, clear: 16 };
/** How near the boat the plane has to land before the child takes the hint. */
const BOARDING = 16;
/** How long the colt is left trying, and how often it has a go, before the child gives up and carries it on. */
const TRY_FOR = tuning.colt.tryFor;
const TRY_EVERY = 5.5;

/**
 * The meadow: the last warm afternoon of the year. The child steps ashore onto grey pasture and the player's first
 * gust inland sends a wave of green rolling to the far side. The long walk follows the plane, waypoint by waypoint,
 * through a sun shower, and ends where the boat is drawn up on the far shore.
 */
export class MeadowChapter implements Chapter {
  beat: Beat = 'ashore';
  readonly breeze = 1;
  readonly worldLife = 1;
  pace = 0.35;
  haze = 0.55;
  private beatHush = 0;
  dusk = 0;
  shower = 0;
  readonly shot: Shot = { target: new THREE.Vector3(), distance: 40, height: 12 };
  readonly music = 'meadow' as const;
  readonly season = 0.32;
  readonly focus = new THREE.Vector3();
  private play: Play = 'carry';
  private leg = 0;
  private beatStart = 0;
  private waveStart = 0;
  private showerStart = -1;
  private holdUntil = 0;
  private duskTarget = 0;
  private now = 0;
  private readonly hand = new THREE.Vector3();
  private readonly tmp = new THREE.Vector3();
  private readonly horizon = new THREE.Vector3(20, 40, -1300);
  private readonly watched = new THREE.Vector3();
  private watchUntil = 0;
  private nextLook = 0;
  private crestDone = false;
  private cheeredFlight = false;
  /** Where the grass is pressed flat while they sit in it, so the colt is not lost in a field taller than it is. */
  trodden: THREE.Vector3 | null = null;
  /** The piano standing in the grass off the walk, and the optional stop the child makes at it. */
  private readonly piano = new PianoStop();
  private nextTry = 0;
  private nextCall = 0;
  /** When the wind starts showing the player the gesture the colt is waiting for, and the shape it draws there. */
  private coaxFrom = 0;
  private readonly coaxing = { at: new THREE.Vector3(), urgency: 0 };
  private nextBugle = 0;
  private wentOn = false;
  private kneltAt = -1e3;
  private readonly onColt = new THREE.Vector3();
  private readonly side = new THREE.Vector3();
  /** Where the family is, where it was first found, and the horizontal line from the child to it. */
  private readonly far = new THREE.Vector3();
  private readonly gathering = new THREE.Vector3();
  private readonly axis = new THREE.Vector3(0, 0, -1);

  constructor(private readonly cast: Cast) {
    const { child, plane, boat } = cast;
    plane.homeRadius = 70;
    child.dismount();
    boat.beach(FAR_SHORE.x, FAR_SHORE.z, 0.2);
    const up = mainlandCoastZ(LANDING.x) - 14;
    child.walkTo(LANDING.x - 2, up, false, () => this.to('waiting'), 0.8);
  }

  /**
   * The wind is only taken away where the player could break a beat. The crest keeps it: the plane is in their
   * hand and nothing in the scene can be blown out of it, so their gusts go on moving the grass all the way
   * through the one scene they are most likely to sit still for.
   */
  get scripted(): boolean {
    return this.beat === 'ashore' || this.beat === 'wave' || this.beat === 'toBoat' || this.beat === 'push' || this.beat === 'aboard';
  }

  get done(): boolean {
    return this.beat === 'aboard';
  }

  /** The music makes room while the child is sitting at the piano, so the player hears what they are playing. */
  get hush(): number {
    return Math.max(this.beatHush, this.piano.hush);
  }

  /** For testing: the green wave has already rolled out and the child is most of the way across. */
  skipAhead(): void {
    const { child, plane, life } = this.cast;
    life.regions.wave.set(LANDING.x, LANDING.y, WAVE_REACH, 90);
    this.waveStart = -1e3;
    this.leg = ROUTE.length - 1;
    child.stop();
    child.place(ROUTE[ROUTE.length - 1].x + 4, ROUTE[ROUTE.length - 1].y + 40, Math.PI);
    child.standUp();
    plane.hold(child.handPosition(this.hand), child.yaw);
    this.play = 'hold';
    this.duskTarget = this.dusk = 0.45;
    this.to('walk');
  }

  /** For testing: a few paces short of the rise, colt in the hood and plane in hand, with the crest still to come. */
  skipToCrest(): void {
    const { child, crane, plane, life } = this.cast;
    life.regions.wave.set(LANDING.x, LANDING.y, WAVE_REACH, 90);
    this.waveStart = -1e3;
    this.leg = CREST_LEG;
    const at = ROUTE[CREST_LEG];
    const from = ROUTE[CREST_LEG - 1];
    const back = new THREE.Vector2(from.x - at.x, from.y - at.y).normalize().multiplyScalar(CREST_NEAR + 8);
    child.stop();
    child.place(at.x + back.x, at.y + back.y, Math.atan2(-back.x, -back.y));
    child.standUp();
    crane.carry(child.hoodPoint(this.tmp), child.yaw, true);
    crane.bind(0.06);
    plane.hold(child.handPosition(this.hand), child.yaw);
    this.play = 'hold';
    this.to('walk');
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
    const { child: c, plane: p, life, input, boat } = this.cast;
    /**
     * The plane leans toward the next waypoint, and on the last leg toward the boat itself. Aimed simply north of
     * the child it made for open water at the far shore, sat on the sea and held the child at the water's edge.
     */
    if (!p.departing) {
      if (this.leg === ROUTE.length - 1) {
        p.home.set(boat.position.x, 0, boat.position.z);
        p.homeRadius = 26;
      } else {
        const t = this.piano.waypoint(this.target(), c.position);
        const dx = t.x - c.position.x;
        const dz = t.y - c.position.z;
        const d = Math.hypot(dx, dz) || 1;
        const reach = Math.min(d, 25);
        p.home.set(c.position.x + (dx / d) * reach, 0, c.position.z + (dz / d) * reach);
        p.homeRadius = 70;
      }
    }

    switch (this.beat) {
      case 'ashore':
        break;
      case 'waiting': {
        c.lookAt = this.horizon;
        const overLand = heightAt(input.world.x, input.world.z) > 1;
        if ((input.gust > 5 && overLand && input.present) || this.t > 9) this.startWave();
        break;
      }
      case 'wave':
        if (this.t > 5 && !c.busy) this.walkOn();
        break;
      case 'walk':
        if (!this.piano.hold(dt, time, this.cast)) this.updateWalk(time);
        break;
      case 'crest':
        this.updateCrest(dt, time);
        break;
      case 'try':
        this.updateTry(time);
        break;
      case 'glide':
        this.updateGlide();
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

    /** The afternoon ages with the walk, but keeps its warmth: the sun does not set until the last island. */
    const progress = THREE.MathUtils.clamp((c.position.z - LANDING.y) / (FAR_SHORE.z - LANDING.y), 0, 1);
    this.duskTarget = Math.max(this.duskTarget, progress * progress * 0.55);
    this.dusk += (this.duskTarget - this.dusk) * (1 - Math.exp(-dt * 0.22));
    /** The shower waits for the crest: the reveal needs the air it clears, not rain across it. */
    if (this.showerStart < 0 && this.beat === 'walk' && this.leg >= 3 && this.crestDone) this.showerStart = this.now;
    if (this.showerStart >= 0) {
      const t = this.now - this.showerStart;
      const { gather, fall, clear } = SHOWER;
      this.shower =
        t < gather
          ? THREE.MathUtils.smoothstep(t, 0, gather)
          : 1 - THREE.MathUtils.smoothstep(t, gather + fall, gather + fall + clear);
    }
    if (this.beat !== 'crest') this.haze += (0.55 - this.haze) * (1 - Math.exp(-dt * 0.25));
    /** The fullest music in the game pulls back for the crest, so two bird voices are all there is to hear. */
    const quiet = this.beat === 'crest' ? 0.45 : this.beat === 'try' && this.cast.flock.active ? 0.3 : 0;
    this.beatHush += (quiet - this.beatHush) * (1 - Math.exp(-dt * 0.5));
    const wave = life.regions.wave;
    if (wave.z >= 0) wave.z = Math.min(WAVE_REACH, wave.z + dt * WAVE_SPEED * Math.min(1, 0.3 + (this.now - this.waveStart) * 0.25));

    if (p.held) p.hold(c.handPosition(this.hand), c.yaw);
    this.frame();
    this.piano.frame(this.shot);
  }

  private startWave(): void {
    const { child: c, life } = this.cast;
    this.to('wave');
    this.waveStart = this.now;
    life.regions.wave.set(c.position.x, c.position.z, 0, 90);
    c.cheer();
    cue('wave');
  }

  /**
   * The walk is long and the grass is over the colt's head, so it rides in the hood, where it is in every frame
   * and can watch the plane go over. It only comes down where the camera comes down with it.
   */
  private walkOn(): void {
    const { child: c, crane } = this.cast;
    crane.carry(c.hoodPoint(this.tmp), c.yaw, true);
    crane.bind(0.06);
    this.to('walk');
    this.play = 'carry';
    this.throwAhead();
  }

  /**
   * Straight out of the reveal and in the same place: the colt is stood down in the grass facing the way they
   * went, and the child kneels to it and then sits. It has just watched its family leave without it.
   */
  private setDown(): void {
    const { child: c, crane } = this.cast;
    const { setDownAt, firstTry } = tuning.crest;
    c.stop();
    this.to('try');
    this.nextTry = 1e9;
    this.kneltAt = this.now;
    /** Wide enough to take the camera as well as the two of them, or the near grass fills the whole frame. */
    this.trodden = new THREE.Vector3(c.position.x + this.axis.x * setDownAt * 0.6, 12, c.position.z + this.axis.z * setDownAt * 0.6);
    c.pickUp(() => {
      /** Down out of the hood and a flutter on, after them, so it is facing the sky it wants and not the child. */
      crane.position.set(c.position.x + this.axis.x * setDownAt, 0, c.position.z + this.axis.z * setDownAt);
      crane.yaw = Math.atan2(this.axis.x, this.axis.z);
      crane.follow();
      c.faceToward(crane.position.x, crane.position.z, 1);
      this.nextTry = this.now + firstTry;
    });
  }

  /**
   * The beat the whole game turns on after the fall. It faces the wind and tries, and cannot. The child sits down
   * to watch, the plane stays in their hand, and there is nothing else on screen — so sooner or later the player
   * puts the wind under it, and finds out that they are the reason it can fly. Nothing is asked and nothing is
   * failed: if the player never does it, the child eventually gathers it up and walks on, and it will try again.
   */
  private updateTry(time: number): void {
    const { child: c, crane, flock } = this.cast;
    if (crane.flying) {
      this.to('glide');
      return;
    }
    /** It keeps calling after them while they are still up there, and they are gone before it gives up on them. */
    if (flock.active) {
      this.far.copy(flock.head);
      if (this.t > tuning.crest.watches) {
        flock.clear();
        crane.watch(null);
      } else if (time > this.nextCall) {
        cue('calling');
        crane.call(true);
        this.nextCall = time + 5 + Math.random();
      }
    }
    c.lookAt = crane.eye(this.onColt);
    if (time > this.nextTry && !crane.carried) {
      crane.tryToFly();
      if (this.coaxFrom === 0) this.coaxFrom = time + tuning.swirl.coaxAfter;
      this.nextTry = time + TRY_EVERY;
      /** They settle in to watch it, but only before it has ever managed it: after that they stay on their feet. */
      if (this.t > TRY_EVERY * 1.5 && crane.flights === 0 && !c.sitting && !c.busy) c.sitDown();
    }
    if (this.t > TRY_FOR && !c.busy) {
      if (c.sitting) {
        c.standUp();
        return;
      }
      this.walkTo(crane.position, () => {
        this.gatherUp(() => {
          crane.carry(c.hoodPoint(this.tmp), c.yaw, true);
          this.trodden = null;
          this.to('walk');
          /** The plane is nearly always still in their hand; if the reveal caught it out in the grass, they fetch it. */
          this.play = this.cast.plane.held ? 'hold' : 'watch';
          this.holdUntil = this.now + 1;
        });
      });
    }
  }

  /**
   * A few seconds after the first failed try the air around the colt starts to turn by itself, and goes on asking
   * a little harder for as long as nothing happens. It is only ever offered while the player has never lifted it:
   * once they have, they know, and the wind says nothing.
   */
  get coax(): Coax | null {
    const { crane } = this.cast;
    if (this.beat !== 'try' || this.coaxFrom === 0 || crane.flying || crane.carried || crane.flights > 0) return null;
    this.coaxing.at.copy(crane.position);
    this.coaxing.urgency = THREE.MathUtils.smoothstep(this.now, this.coaxFrom, this.coaxFrom + tuning.swirl.coaxRamp);
    return this.coaxing.urgency > 0 ? this.coaxing : null;
  }

  /**
   * It is up. Everything else in the world can wait until it comes down — and when it does, the child goes to it,
   * and the beat starts again, because a player who has just found out they can fly it will want to do it again.
   */
  private updateGlide(): void {
    const { child: c, crane } = this.cast;
    c.lookAt = crane.position;
    if (crane.flying) {
      if (c.sitting && !c.busy) c.standUp();
      return;
    }
    if (c.busy || c.sitting) return;
    if (crane.flights === 1 && !this.cheeredFlight) {
      this.cheeredFlight = true;
      c.cheer();
      cue('delight');
      crane.bind(0.2);
      return;
    }
    if (Math.hypot(crane.position.x - c.position.x, crane.position.z - c.position.z) > 4) {
      this.walkTo(crane.position, undefined);
      return;
    }
    c.faceToward(crane.position.x, crane.position.z, 1);
    this.to('try');
    this.nextTry = this.now + 3.5;
  }

  private walkTo(at: THREE.Vector3, then: (() => void) | undefined): void {
    this.cast.child.walkTo(at.x, at.z, true, then, 2.2);
  }

  /** Crouches, gathers the colt into the arms, and stands up again. */
  private gatherUp(then: () => void): void {
    const { child: c, crane, flock } = this.cast;
    flock.clear();
    crane.watch(null);
    c.faceToward(crane.position.x, crane.position.z, 1);
    c.lookAt = crane.eye(this.onColt);
    c.pickUp(() => {
      crane.carry(c.armsPoint(this.tmp), c.yaw);
      c.lookAt = null;
      then();
    });
  }

  private target(): THREE.Vector2 {
    return ROUTE[Math.min(this.leg, ROUTE.length - 1)];
  }

  /**
   * The one moment the dream tells you what you are doing, and the scene the rest of the game leans on. It is
   * heard before it is seen: the grown cranes bugle from somewhere ahead, the colt hears them first and stretches
   * up out of the hood, and the child stops and turns to look where it is looking. The haze thins, and the family
   * is climbing a thermal off the meadow in front of them. The colt calls. Nothing answers. They string out and
   * go north — the way the boat is going, the way home — and the child kneels and sets the colt down after them.
   */
  private updateCrest(dt: number, time: number): void {
    const { child: c, crane, flock } = this.cast;
    const { answers, goes, setsDown, spread, climb, leaves } = tuning.crest;
    const k = flock.active ? flock.head : this.gathering;
    this.far.set(k.x, k.y + spread * 0.5, k.z);
    crane.watch(this.far);
    this.haze += (0.1 - this.haze) * (1 - Math.exp(-dt * 1.1));

    /** The grown birds call among themselves while they climb, and not once after they have turned away. */
    if (!this.wentOn && time > this.nextBugle) {
      cue('bugle');
      this.nextBugle = time + 5.4;
    }
    /** The child walks on for a pace, unaware, and then stops and comes round to what the colt can hear. */
    if (this.t > answers) {
      if (c.moving) c.stop();
      c.lookAt = this.far;
      c.faceToward(this.far.x, this.far.z, 1 - Math.exp(-dt * 1.7));
      if (time > this.nextCall) {
        cue('calling');
        crane.call(true);
        this.nextCall = time + 5 + Math.random();
      }
    }
    if (!this.wentOn && this.t > goes) {
      this.wentOn = true;
      cue('bugle');
      /**
       * Off on the line the journey takes, a little west of the one they were found on: north, for home. They
       * go at a glide rather than their travelling speed, so the player has time to see that they are going.
       */
      flock.goOn(THREE.MathUtils.lerp(Math.atan2(this.axis.x, this.axis.z), Math.PI, 0.5), climb * 0.7, leaves, time);
    }
    if (this.t > setsDown && !c.busy) this.setDown();
  }

  /** The family comes up out of the meadow ahead, and the walk stops where it stands for it. */
  private reveal(): void {
    const { child: c, crane, flock } = this.cast;
    const { ahead, aside, base, radius, spread, climb, answers } = tuning.crest;
    this.crestDone = true;
    this.to('crest');
    this.nextBugle = this.now;
    this.nextCall = this.now + answers;
    /** Ahead and a little to the east: out from under the low sun, and the way the walk bends after the rise. */
    this.axis.set(aside, 0, -ahead).normalize();
    this.gathering.set(c.position.x + aside, 0, c.position.z - ahead);
    this.gathering.y = Math.max(heightAt(this.gathering.x, this.gathering.z), 0) + base;
    flock.circle(this.gathering.x, this.gathering.z, this.gathering.y, radius, FAMILY, spread, climb);
    crane.watch(this.far.copy(this.gathering));
  }

  /**
   * On the rise itself, with the north of the island in front of them. The walk follows the plane and not the
   * waypoints, so the scene fires when they come up near the crest and, whatever the player has done with the
   * plane, at the latest as they pass it: the one moment that explains the journey is never skipped.
   */
  private onCrest(): boolean {
    if (this.leg < CREST_LEG) return false;
    const c = this.cast.child.position;
    const crest = ROUTE[CREST_LEG];
    return Math.hypot(c.x - crest.x, c.z - crest.y) < CREST_NEAR || c.z < crest.y;
  }

  private updateWalk(time: number): void {
    const { child: c, plane: p, boat } = this.cast;
    const t = this.target();
    if (Math.hypot(c.position.x - t.x, c.position.z - t.y) < 38 && this.leg < ROUTE.length - 1) this.leg++;
    const last = this.leg === ROUTE.length - 1;

    if (this.cast.crane.flying) {
      this.to('glide');
      return;
    }
    /** Walking is exactly the state the reveal wants to interrupt; a throw or a pick-up is left to finish. */
    if (!this.crestDone && this.onCrest() && (c.moving || !c.busy)) {
      this.reveal();
      return;
    }

    if (time > this.nextLook && this.play === 'watch') {
      this.nextLook = time + 7;
      if (this.cast.nearby(c.position.x, c.position.z, 9, this.watched)) this.watchUntil = time + 3;
    }
    if (time < this.watchUntil && this.play === 'watch') {
      c.lookAt = this.watched;
      if (p.landed) this.fetch();
      return;
    }

    if (this.play === 'watch') {
      c.lookAt = p.position;
      if (p.landed) this.fetch();
      else if (!c.moving && Math.hypot(p.position.x - c.position.x, p.position.z - c.position.z) > 14) {
        c.walkTo(p.position.x, p.position.z, false, undefined, 8);
      }
    } else if (this.play === 'fetch') {
      c.lookAt = p.position;
      if (!p.landed && p.airborne) this.play = 'watch';
    } else if (this.play === 'hold' && !c.busy) {
      const nearBoat = Math.hypot(p.position.x - boat.position.x, p.position.z - boat.position.z) < BOARDING;
      const childNear = Math.hypot(c.position.x - boat.position.x, c.position.z - boat.position.z) < BOARDING;
      if (last && (nearBoat || childNear || this.now - this.beatStart > 220)) this.board();
      else if (time > this.holdUntil) this.throwAhead();
    }
  }

  private throwAhead(): void {
    const c = this.cast.child;
    const t = this.leg === ROUTE.length - 1 ? this.cast.boat.position : this.target();
    const tx = 'x' in t ? t.x : 0;
    const tz = t instanceof THREE.Vector2 ? t.y : t.z;
    const angle = Math.atan2(tx - c.position.x, tz - c.position.z) + (Math.random() - 0.5) * 0.5;
    /**
     * The longest walk in the game, over open ground: it is thrown a good way out ahead and they go after it
     * without dawdling. A measured playthrough spent five minutes on the last stretch alone at the old stride.
     */
    c.throwToward(c.position.x + Math.sin(angle) * 34, c.position.z + Math.cos(angle) * 34, () => {
      this.cast.plane.launch(c.handPosition(this.hand), this.tmp.set(Math.sin(angle) * 10.6, 5.2, Math.cos(angle) * 10.6));
      this.play = 'watch';
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
        this.holdUntil = this.now + 0.4 + Math.random() * 0.55;
      });
    }, 1.2);
  }

  /** The far shore: the child walks down to the boat that is somehow here, and pushes off again. */
  private board(): void {
    const { child: c, boat } = this.cast;
    this.to('toBoat');
    c.lookAt = null;
    c.walkTo(boat.position.x - 1.4, boat.position.z + 2.6, false, () => {
      this.gatherUp(() => {
        this.to('push');
        c.faceToward(boat.position.x, boat.position.z, 1);
        c.push();
      });
    }, 0.5);
  }

  private frame(): void {
    const c = this.cast.child.position;
    const p = this.cast.plane.position;
    const s = this.shot;
    s.from = undefined;
    s.eye = undefined;
    if (this.beat === 'try' || this.beat === 'glide') {
      /**
       * Side on and low. Over the child's shoulder the colt is behind their back and under the grass; from here
       * they are both in profile, with the colt clear against the sky the moment it leaves the ground.
       */
      const k = this.cast.crane.position;
      /**
       * Down in the grass, on the colt. While it is on the ground the camera stands off to one side so the child
       * cannot hide it; as it climbs the camera swings in behind their shoulder, so the player ends up watching
       * the sky with the child — the frame of the fall, turned the other way up.
       */
      const gap = Math.hypot(k.x - c.x, k.z - c.z);
      const ground = Math.max(heightAt(k.x, k.z), 0);
      const up = THREE.MathUtils.clamp((k.y - ground) / 3.5, 0, 1);
      const toChild = gap > 0.5 ? Math.atan2(c.x - k.x, c.z - k.z) : this.cast.child.yaw + Math.PI;
      const bearing = toChild + 1.15 * (1 - up);
      s.from = this.side.set(Math.sin(bearing), 0, Math.cos(bearing));
      s.target.set(k.x, k.y + 0.4, k.z);
      /**
       * The camera stays down at head height on the ground whatever the colt does, so that once it is up the
       * frame is looking up at it with sky behind it. Hung a fixed distance above the colt instead, it follows
       * the colt into the air and the background is always grass — which is the opposite of the point.
       */
      s.distance = 9.5 + gap * 0.35;
      s.height = THREE.MathUtils.clamp(ground + 2.6 - k.y, -9, 2.6);
      /** It has a whole sky to come down out of after the reveal, so it comes down fast and then settles. */
      this.pace = this.now - this.kneltAt < 3.5 ? 1.2 : 0.5;
      this.focus.copy(k);
      return;
    }
    if (this.beat === 'crest') {
      /**
       * One frame holds the whole scene: the two of them low in it, and above them the sky their family is
       * climbing out of. The camera stands behind them on the line between the child and the column, swung a
       * little off it, and tips up as the birds do — so nothing has to be looked for and nothing is off screen.
       */
      const ground = Math.max(heightAt(c.x, c.z), 0);
      const tilt = Math.min(REVEAL.tilt, Math.max(0, this.far.y - ground - 12) * 0.12);
      const bearing = Math.atan2(this.axis.x, this.axis.z) + Math.PI + REVEAL.swing;
      /** The frame opens out as the cranes climb: it starts on the two of them and ends with the sky in it. */
      const open = THREE.MathUtils.smoothstep(this.t, 0.6, 6);
      const ahead = REVEAL.ahead * (0.5 + 0.5 * open);
      s.target.set(c.x + this.axis.x * ahead, ground + REVEAL.look + tilt, c.z + this.axis.z * ahead);
      s.from = this.side.set(Math.sin(bearing), 0, Math.cos(bearing));
      s.distance = ahead + REVEAL.back * (0.7 + 0.3 * open);
      s.height = REVEAL.eye - REVEAL.look - tilt;
      this.pace = 0.8;
      this.focus.copy(c);
      return;
    }
    if (this.beat === 'toBoat' || this.beat === 'push' || this.beat === 'aboard') {
      const b = this.cast.boat.position;
      s.target.set((c.x + b.x) / 2, b.y + 2.2, (c.z + b.z) / 2 - 2);
      s.distance = 28;
      s.height = 7;
      this.pace = 0.35;
      this.focus.copy(b);
      return;
    }
    const pw = this.cast.plane.held ? 0 : 0.25;
    const fx = c.x * (1 - pw) + p.x * pw;
    const fz = c.z * (1 - pw) + p.z * pw - 5;
    const ground = Math.max(heightAt(fx, fz), 0);
    s.target.set(fx, ground + 3 + Math.max(0, p.y - ground - 12) * 0.35, fz);
    s.distance = this.beat === 'wave' ? 70 : 44;
    s.height = this.beat === 'wave' ? 26 : 13;
    this.pace = 0.35;
    this.focus.set(fx, ground, fz);
  }
}
