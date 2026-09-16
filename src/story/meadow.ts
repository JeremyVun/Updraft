import * as THREE from 'three';
import type { Shot } from '../camera';
import { mainlandCoastZ } from '../world/heightfield';
import { heightAt } from '../world/island';
import type { Cast, Chapter } from './cast';
import { LANDING } from './crossing';
import { cue } from './cues';

type Beat = 'ashore' | 'waiting' | 'wave' | 'walk' | 'crest' | 'try' | 'glide' | 'toBoat' | 'push' | 'aboard';
type Play = 'carry' | 'watch' | 'fetch' | 'hold';

/** The way inland, across the meadow to its far shore. */
export const ROUTE = [
  new THREE.Vector2(6, -660),
  new THREE.Vector2(-18, -740),
  new THREE.Vector2(-40, -830),
  new THREE.Vector2(-4, -930),
  new THREE.Vector2(30, -1020),
  new THREE.Vector2(12, -1100),
  new THREE.Vector2(-6, -1148),
];
/** Where the boat is waiting on the far shore. Nobody put it there, and nobody remarks on it. */
export const FAR_SHORE = new THREE.Vector3(-6, 0, -1172);

/** The high ground on the walk, where the haze thins and you are told, without a word, where you are going. */
const CREST_LEG = 2;
/** Where the colt's family is wheeling up a thermal, far off over the north end of the island. */
const GATHERING = { x: -26, z: -1010, base: 66, radius: 30 };

const WAVE_SPEED = 85;
const WAVE_REACH = 3600;
/** The sun shower on the walk: it gathers, falls steadily, then drifts away (seconds). */
const SHOWER = { gather: 10, fall: 30, clear: 16 };
/** How near the boat the plane has to land before the child takes the hint. */
const BOARDING = 16;
/** How long the colt is left trying, and how often it has a go, before the child gives up and carries it on. */
const TRY_FOR = 75;
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
  private tryDone = false;
  private cheeredFlight = false;
  /** Where the grass is pressed flat while they sit in it, so the colt is not lost in a field taller than it is. */
  trodden: THREE.Vector3 | null = null;
  private nextTry = 0;
  private nextCall = 0;
  private readonly onColt = new THREE.Vector3();
  private readonly side = new THREE.Vector3();
  private readonly far = new THREE.Vector3(GATHERING.x, GATHERING.base + 24, GATHERING.z);

  constructor(private readonly cast: Cast) {
    const { child, plane, boat } = cast;
    plane.homeRadius = 70;
    child.dismount();
    boat.beach(FAR_SHORE.x, FAR_SHORE.z, 0.2);
    const up = mainlandCoastZ(LANDING.x) - 14;
    child.walkTo(LANDING.x - 2, up, false, () => this.to('waiting'), 0.8);
  }

  get scripted(): boolean {
    return this.beat !== 'walk' && this.beat !== 'waiting' && this.beat !== 'try' && this.beat !== 'glide';
  }

  get done(): boolean {
    return this.beat === 'aboard';
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
    if (!p.departing) p.home.set(c.position.x, 0, c.position.z - 25);

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
        this.updateWalk(time);
        break;
      case 'crest':
        this.updateCrest(time);
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
    if (this.showerStart < 0 && this.beat === 'walk' && this.leg >= 3) this.showerStart = this.now;
    if (this.showerStart >= 0) {
      const t = this.now - this.showerStart;
      const { gather, fall, clear } = SHOWER;
      this.shower =
        t < gather
          ? THREE.MathUtils.smoothstep(t, 0, gather)
          : 1 - THREE.MathUtils.smoothstep(t, gather + fall, gather + fall + clear);
    }
    if (this.beat !== 'crest') this.haze += (0.55 - this.haze) * (1 - Math.exp(-dt * 0.25));
    const wave = life.regions.wave;
    if (wave.z >= 0) wave.z = Math.min(WAVE_REACH, wave.z + dt * WAVE_SPEED * Math.min(1, 0.3 + (this.now - this.waveStart) * 0.25));

    if (p.held) p.hold(c.handPosition(this.hand), c.yaw);
    this.frame();
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
   * The beat the whole game turns on after the fall. The colt has just watched its family go up without it. Now it
   * is set down in the grass in front of the child, faces the wind and tries, and cannot. The child sits down to
   * watch, the plane stays in their hand, and there is nothing else on screen — so sooner or later the player
   * holds the wind under it, and finds out that they are the reason it can fly. Nothing is asked and nothing is
   * failed: if the player never does it, the child eventually gathers it up and walks on, and it will try again.
   */
  private updateTry(time: number): void {
    const { child: c, crane } = this.cast;
    if (crane.flying) {
      this.to('glide');
      return;
    }
    c.lookAt = crane.eye(this.onColt);
    if (time > this.nextTry && !crane.carried) {
      crane.tryToFly();
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
          this.play = 'hold';
          this.holdUntil = this.now + 1;
        });
      });
    }
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
    const { child: c, crane } = this.cast;
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
   * The one moment the dream tells you what you are doing. The child tops the rise, the haze thins, and far to the
   * north the colt's family is turning on a thermal. The colt calls to them. Nothing answers, and they walk on.
   */
  private updateCrest(time: number): void {
    const { child: c, crane, flock } = this.cast;
    c.lookAt = this.far;
    crane.watch(this.far);
    this.haze += (0.1 - this.haze) * (1 - Math.exp(-0.016 * 1.2));
    if (this.t > 2.4 && time > this.nextCall) {
      cue('calling');
      crane.call(true);
      this.nextCall = time + 4.5 + Math.random();
    }
    if (this.t > 15) {
      flock.clear();
      crane.watch(null);
      this.to('walk');
      this.play = 'hold';
      this.holdUntil = time + 0.8;
    }
  }

  private updateWalk(time: number): void {
    const { child: c, plane: p, boat } = this.cast;
    const t = this.target();
    if (Math.hypot(c.position.x - t.x, c.position.z - t.y) < 30 && this.leg < ROUTE.length - 1) this.leg++;
    const last = this.leg === ROUTE.length - 1;

    if (this.cast.crane.flying) {
      this.to('glide');
      return;
    }
    if (this.crestDone && !this.tryDone && this.leg >= CREST_LEG + 1 && this.play === 'hold' && !c.busy) {
      this.tryDone = true;
      c.stop();
      this.to('try');
      this.nextTry = 1e9;
      /** It comes out of the hood and is set down in front of them, and then it is on its own. */
      /** Wide enough to take the camera as well as the two of them, or the near grass fills the whole frame. */
      this.trodden = new THREE.Vector3(c.position.x + Math.sin(c.yaw) * 1.4, 12, c.position.z + Math.cos(c.yaw) * 1.4);
      c.pickUp(() => {
        const { crane } = this.cast;
        crane.position.set(c.position.x + Math.sin(c.yaw) * 2.4, 0, c.position.z + Math.cos(c.yaw) * 2.4);
        crane.yaw = c.yaw + Math.PI;
        crane.follow();
        c.faceToward(crane.position.x, crane.position.z, 1);
        this.nextTry = this.now + 2.5;
      });
      return;
    }
    if (!this.crestDone && this.leg >= CREST_LEG && this.play === 'hold' && !c.busy) {
      this.crestDone = true;
      this.to('crest');
      c.stop();
      c.faceToward(GATHERING.x, GATHERING.z, 1);
      this.cast.flock.circle(GATHERING.x, GATHERING.z, GATHERING.base, GATHERING.radius);
      this.nextCall = time + 2.4;
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
    c.throwToward(c.position.x + Math.sin(angle) * 26, c.position.z + Math.cos(angle) * 26, () => {
      this.cast.plane.launch(c.handPosition(this.hand), this.tmp.set(Math.sin(angle) * 9.4, 5.2, Math.cos(angle) * 9.4));
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
        this.holdUntil = this.now + 0.7 + Math.random() * 0.9;
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
      this.pace = 0.5;
      this.focus.copy(k);
      return;
    }
    if (this.beat === 'crest') {
      const ground = Math.max(heightAt(c.x, c.z), 0);
      s.target.set(c.x * 0.72 + this.far.x * 0.28, ground + 4 + Math.min(this.t * 0.3, 2.6), c.z * 0.72 + this.far.z * 0.28);
      s.distance = 22;
      s.height = 5;
      this.pace = 0.3;
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
