import * as THREE from 'three';
import type { Shot } from '../camera';
import { heightAt } from '../world/island';
import { WOOD_BERTH, WOOD_LANDING, WOOD_PATH } from '../world/wood';
import type { Cast, Chapter } from './cast';
import { cue } from './cues';

/** Where the cygnet goes to ground when the storm frightens it out of the hood: just off the path, in the dark. */
const HIDING = new THREE.Vector3(-8.5, 0, -1791);
/** Where the paper plane the storm took is lying, further on and face down in the leaves. */
const SODDEN = new THREE.Vector2(-37, -1848);

/** How much light there has to be before the child will trust it enough to move. */
const ENOUGH = 1.2;
/** How near the light has to come to the hiding place, and how much of it there has to be, to show what is there. */
const FOUND = 12;
const FOUND_HEAT = 0.5;
/**
 * Nobody is ever stranded in the dark. After this long with nothing burning, the wood wakes a few coals of its
 * own — a glimmer to walk toward, never a path — and after a long time lost, enough of them that the cygnet is
 * found. The player still brings the light; the room only refuses to let the game end here.
 */
const UNAIDED = 35;
const LOST_GLIMMER = 40;
const LOST_RELENT = 170;
/** How near a waypoint counts as reached. */
const REACHED = 7;

type Beat = 'ashore' | 'first' | 'walk' | 'bolt' | 'lost' | 'found' | 'plane' | 'dry' | 'out' | 'toBoat' | 'push' | 'aboard';

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
  hush = 0.6;
  embers = 0;
  /** Carried, because the walk up the wood is slow and continuous and an eased camera trails below the child. */
  readonly shot: Shot = { target: new THREE.Vector3(), distance: 15, height: 5, carry: true };
  readonly music = 'wood' as const;
  readonly season = 0.84;
  readonly focus = new THREE.Vector3();
  private leg = 0;
  private now = 0;
  private beatStart = 0;
  private nextCall = 0;
  private lit = 0;
  private readonly light = new THREE.Vector3();
  private readonly hand = new THREE.Vector3();
  private readonly tmp = new THREE.Vector3();
  private readonly side = new THREE.Vector3();

  constructor(private readonly cast: Cast) {
    const { child, plane, cygnet } = cast;
    plane.homeRadius = 1e9;
    plane.visible = false;
    plane.soggy.value = 1;
    child.dismount();
    if (cygnet.seat === 'cradle') cast.carry.stow();
    else cygnet.rideIn('satchel');
    child.walkTo(WOOD_LANDING.x, WOOD_LANDING.y - 14, false, () => this.to('first'), 1.4);
  }

  /** The player's wind is the light here, so it is theirs for all of it except the moment of gathering it up. */
  get scripted(): boolean {
    return this.beat === 'ashore' || this.beat === 'found' || this.beat === 'push' || this.beat === 'aboard';
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

  private target(): THREE.Vector2 {
    return WOOD_PATH[Math.min(this.leg, WOOD_PATH.length - 1)];
  }

  update(dt: number, time: number): void {
    this.now = time;
    const { child: c, plane: p, cygnet, embers } = this.cast;
    /** The boat is waiting on the far shore, the way it always is — but it goes there once they are out of sight. */
    if (!this.moored && this.leg >= 2) {
      this.moored = true;
      this.cast.boat.beach(WOOD_BERTH.x, WOOD_BERTH.z, 0.2);
      this.cast.boat.grounded = true;
    }
    this.light.copy(c.position);
    this.lit = embers.brightest(this.light);
    this.darkFor = this.lit < ENOUGH ? this.darkFor + dt : 0;
    this.embers = this.beat === 'ashore' ? 0.4 : 1;

    switch (this.beat) {
      case 'ashore':
        break;
      case 'first':
        /** The first light the player makes is the first thing the child has seen. They turn to it and go. */
        c.lookAt = this.light;
        if (this.lit > ENOUGH && this.t > 1.5) this.to('walk');
        else if (this.t > 75) this.to('walk');
        break;
      case 'walk':
        this.follow();
        if (this.leg >= 2 && Math.hypot(c.position.x - HIDING.x, c.position.z - HIDING.z) < 34) this.bolt();
        break;
      case 'bolt':
        c.lookAt = cygnet.position;
        if (this.t > 2.6) this.to('lost');
        break;
      case 'lost':
        this.search(time);
        break;
      case 'found':
        break;
      case 'plane':
        this.follow();
        this.reachPlane();
        break;
      case 'dry':
        this.drying(dt);
        break;
      case 'out':
        this.follow();
        break;
      case 'push':
        if (this.t > 0.9 && !this.cast.boat.afloat) this.cast.boat.launch();
        if (this.t > 2.3) {
          this.to('aboard');
          c.ride(this.cast.boat.seat(this.tmp), this.cast.boat.yaw);
        }
        break;
      default:
        break;
    }

    this.weather(dt);
    if (p.held) p.hold(c.handPosition(this.hand), c.yaw);
    this.frame();
  }

  /**
   * The wood only lets them past while there is light. A child alone in the dark does not walk into it, so they go
   * on for exactly as long as the player keeps something burning, and stop and wait the moment it goes out. Light
   * thrown up the path pulls them along it; light thrown anywhere else is looked at, and never punished.
   */
  private follow(): void {
    const { child: c } = this.cast;
    const t = this.target();
    const last = this.leg >= WOOD_PATH.length - 1;
    if (Math.hypot(c.position.x - t.x, c.position.z - t.y) < REACHED && !last) this.leg++;

    if (this.beat === 'walk' && this.leg >= 4) this.toPlane();
    if (this.beat === 'out' && last && Math.hypot(c.position.x - t.x, c.position.z - t.y) < REACHED + 4) {
      this.board();
      return;
    }

    /**
     * Left long enough in the dark with nothing happening, the leaf litter starts waking on its own ahead of
     * them and keeps waking until the player takes it back over. A first gust from them ends it at once: this is
     * for somebody who has run out of ideas, and it gets out of their way the moment they have one.
     */
    if (this.cast.input.gust > 9) this.unaided = false;
    else if (this.darkFor > UNAIDED) this.unaided = true;
    if (this.unaided && this.now > this.nextKindle) {
      this.cast.embers.kindle(t.x, t.y, 5, 8, 0.72);
      this.nextKindle = this.now + 2.6;
    }

    if (this.lit < ENOUGH) {
      if (c.moving) c.stop();
      c.lookAt = this.lit > 0 ? this.light : null;
      return;
    }
    c.lookAt = this.light;
    if (c.busy) return;
    /** Toward the light when it is out ahead of them, and on up the path when it is not. */
    const gain = Math.hypot(c.position.x - t.x, c.position.z - t.y) - Math.hypot(this.light.x - t.x, this.light.z - t.y);
    const away = Math.hypot(this.light.x - c.position.x, this.light.z - c.position.z);
    const lead = gain > 1 && away > 3;
    const to = lead ? this.light : { x: t.x, z: t.y };
    if (!c.moving || this.now > this.aimed + 0.8) {
      this.aimed = this.now;
      c.walkTo(to.x, to.z, false, undefined, lead ? 2.4 : REACHED * 0.6);
    }
  }

  private aimed = 0;
  private moored = false;
  private darkFor = 0;
  private unaided = false;
  private nextKindle = 0;

  /** The storm's worst gust, and the cygnet is out of the hood and gone before the child can close a hand on it. */
  private bolt(): void {
    const { child: c, cygnet } = this.cast;
    this.to('bolt');
    c.stop();
    cygnet.position.set(HIDING.x, Math.max(heightAt(HIDING.x, HIDING.z), 0), HIDING.z);
    cygnet.yaw = Math.atan2(c.position.x - HIDING.x, c.position.z - HIDING.z);
    cygnet.cower();
    this.nextCall = this.now + 2;
    cue('distress');
  }

  /**
   * It is somewhere out there in the dark and it is calling, and the only way to find it is to put light on it.
   * Nothing hurries the player and nothing goes wrong if they take all night: it keeps calling until they come.
   */
  private search(time: number): void {
    const { child: c, cygnet } = this.cast;
    c.lookAt = cygnet.position;
    if (time > this.nextCall) {
      cue('distress');
      cygnet.call(false);
      this.nextCall = time + 3.4 + Math.random() * 1.6;
    }
    /** A glimmer where it is hiding, and then, much later, enough of one to have found it. */
    if (this.t > LOST_GLIMMER && time > this.nextKindle) {
      const hard = this.t > LOST_RELENT;
      this.cast.embers.kindle(HIDING.x, HIDING.z, hard ? 2.5 : 4, hard ? 5 : 2, hard ? 0.6 : 0.36);
      this.nextKindle = time + (hard ? 2.5 : 8);
    }
    if (c.busy || c.moving) return;
    if (this.cast.embers.heatNear(HIDING.x, HIDING.z, FOUND) > FOUND_HEAT) {
      this.to('found');
      c.walkTo(HIDING.x, HIDING.z + 1.2, false, () => {
        /** Carried in the arms from here, not on their back. After the dark it is not put down again for a while. */
        this.cast.carry.gatherUp(() => {
          cygnet.bind(0.35);
          this.to('walk');
        });
      }, 1.1);
    }
  }

  /** Face down in the leaves where the storm dropped it, a long way from where it was taken. */
  private toPlane(): void {
    const { plane: p } = this.cast;
    this.to('plane');
    p.visible = true;
    p.soggy.value = 1;
    p.launch(this.tmp.set(SODDEN.x, Math.max(heightAt(SODDEN.x, SODDEN.y), 0) + 0.1, SODDEN.y), this.side.set(0, 0, 0));
    p.home.set(SODDEN.x, 0, SODDEN.y);
    this.leg = WOOD_PATH.length - 2;
  }

  /** Close enough to see what it is: they crouch in the leaves and lift it out of them. */
  private reachPlane(): void {
    const { child: c, plane: p } = this.cast;
    if (c.busy || !p.landed) return;
    const gap = Math.hypot(c.position.x - SODDEN.x, c.position.z - SODDEN.y);
    if (gap > 12) return;
    if (gap > 2.4) {
      if (!c.moving) c.walkTo(SODDEN.x, SODDEN.y, false, undefined, 1.6);
      c.lookAt = p.position;
      return;
    }
    c.stop();
    c.faceToward(SODDEN.x, SODDEN.y, 1);
    c.pickUp(() => {
      p.hold(c.handPosition(this.hand), c.yaw);
      this.to('dry');
    });
  }

  /** Held out in both hands into the wind until it is paper again. Nothing else in the wood can be mended. */
  private drying(dt: number): void {
    const { child: c, plane: p, wind } = this.cast;
    const w = wind.sample(c.position.x, c.position.z, this.air);
    p.soggy.value = Math.max(0, p.soggy.value - dt * (0.035 + Math.hypot(w.x, w.z) * 0.035 + w.energy * 0.5));
    c.lookAt = p.position;
    c.presenting = Math.min(1, c.presenting + dt * 1.2);
    if (p.soggy.value <= 0.02) {
      c.presenting = 0;
      this.to('out');
      this.leg = WOOD_PATH.length - 1;
    }
  }

  private readonly air = { x: 0, z: 0, energy: 0, lift: 0 };

  private board(): void {
    const { child: c, boat } = this.cast;
    this.to('toBoat');
    c.lookAt = null;
    c.walkTo(boat.position.x - 1.2, boat.position.z + 2.4, false, () => {
      this.to('push');
      c.faceToward(boat.position.x, boat.position.z, 1);
      c.push();
    }, 0.6);
  }

  /** The storm blows itself out over the second half of the wood, and the night starts to go grey at the edges. */
  private weather(dt: number): void {
    const easing = this.beat === 'dry' || this.beat === 'out' || this.beat === 'toBoat' || this.beat === 'push' || this.beat === 'aboard';
    this.storm += ((easing ? 0.15 : 1) - this.storm) * (1 - Math.exp(-dt * 0.12));
    this.shower = Math.max(0, this.storm - 0.2) * 1.25;
    /** Never thin: from the crest of the wood you can see the home island's hill, and home is the last surprise. */
    this.haze = 0.9 + this.storm * 0.06;
    const alone = this.beat === 'bolt' || this.beat === 'lost';
    const quiet = alone ? 1 : this.beat === 'found' ? 0.75 : 0.55;
    this.hush += (quiet - this.hush) * (1 - Math.exp(-dt * 0.7));
  }

  private frame(): void {
    const c = this.cast.child.position;
    const s = this.shot;
    s.from = undefined;
    s.eye = undefined;
    const ground = Math.max(heightAt(c.x, c.z), 0);
    if (this.beat === 'bolt' || this.beat === 'lost' || this.beat === 'found') {
      /** Near enough to the child to share the dark with them, and turned toward where the calling is coming from. */
      const bearing = Math.atan2(c.x - HIDING.x, c.z - HIDING.z) + 1.5;
      s.from = this.side.set(Math.sin(bearing), 0, Math.cos(bearing));
      s.target.set(c.x * 0.5 + HIDING.x * 0.5, ground + 1.6, c.z * 0.5 + HIDING.z * 0.5);
      s.distance = 13;
      s.height = 4;
      this.pace = 0.35;
      this.focus.copy(c);
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
    /** Close in behind them, leaning a little toward the light but never far enough to leave them behind. */
    const lean = Math.min(1, 9 / Math.max(1, Math.hypot(this.light.x - c.x, this.light.z - c.z))) * 0.3;
    s.target.set(c.x + (this.light.x - c.x) * lean, ground + 1.9, c.z + (this.light.z - c.z) * lean);
    /**
     * The eye is placed on the ground behind them rather than hung a fixed height above the target, because the
     * wood is a steep dome and a fixed height put the camera in the hillside going up and in the air coming down.
     */
    const ex = c.x + 1.1;
    const ez = c.z + 13;
    s.eye = this.side.set(ex, Math.max(Math.max(heightAt(ex, ez), 0), ground) + 4.2, ez);
    this.pace = 0.9;
    this.focus.copy(c);
  }
}
