import * as THREE from 'three';
import type { Shot } from '../camera';
import { heightAt } from '../world/island';
import type { Cast, Chapter } from './cast';
import { cue } from './cues';

/** The island's south beach, where the boat runs ashore. */
export const LINES_LANDING = new THREE.Vector2(14, -308);
/** The boat is drawn up on the far shore before they get there. Nobody put it there. */
export const LINES_BERTH = new THREE.Vector3(14, 0, -408);

/**
 * Up over the top of the island and down the other side. It is a hundred paces of ground, not a crossing: the
 * room is meant to swallow them in washing, so the way weaves between the lines rather than covering distance.
 * The washing is hung around it (`lineField` takes this same path), leaving an alley that wanders the way a
 * person would: wherever the child is standing, the open ground is the way on, and nobody is ever told so.
 */
export const LINES_WALK = [
  new THREE.Vector2(-4, -322),
  new THREE.Vector2(32, -350),
  new THREE.Vector2(-4, -380),
  new THREE.Vector2(14, -400),
];
const ROUTE = LINES_WALK;

/** How near the boat either of them has to be before the child takes the hint and pushes off. */
const BOARDING = 22;
/** And if the washing is more interesting than the boat, they go anyway after this long on the last stretch. */
const LAST_LEG_PATIENCE = 50;

type Beat = 'ashore' | 'wonder' | 'walk' | 'toBoat' | 'push' | 'aboard';
type Play = 'carry' | 'watch' | 'fetch' | 'hold';

/**
 * The island of lines: a bare hill strung pole to pole with washing, hung out with nobody there. The first thing
 * the dream hands over that is unmistakably home, and the first place the wind is pure delight — one gust lifts a
 * whole band of sheets at once, and the child runs through them after the plane.
 */
export class LinesChapter implements Chapter {
  beat: Beat = 'ashore';
  readonly breeze = 1;
  readonly worldLife = 1;
  pace = 0.4;
  readonly haze = 0.85;
  readonly dusk = 0;
  readonly shot: Shot = { target: new THREE.Vector3(), distance: 34, height: 10 };
  readonly music = 'lines' as const;
  readonly focus = new THREE.Vector3();
  private play: Play = 'carry';
  private leg = 0;
  private beatStart = 0;
  private holdUntil = 0;
  private now = 0;
  private cheered = false;
  private flown = false;
  private lastLegAt = 0;
  private readonly hand = new THREE.Vector3();
  private readonly tmp = new THREE.Vector3();
  private readonly crest = new THREE.Vector3(14, 17, -360);

  constructor(private readonly cast: Cast) {
    const { child, plane, boat } = cast;
    plane.homeRadius = 30;
    child.dismount();
    boat.beach(LINES_BERTH.x, LINES_BERTH.z, 0.1);
    child.walkTo(LINES_LANDING.x - 2, LINES_LANDING.y - 12, false, () => this.to('wonder'), 0.9);
  }

  get scripted(): boolean {
    return this.beat !== 'walk';
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
    const { child: c, plane: p, boat } = this.cast;
    /**
     * Over the top of the hill the plane's home moves to the boat on the far beach, so however the player blows
     * it about it drifts down there — and chasing it is how they find the way off the island.
     */
    if (!p.departing) {
      const last = this.leg === ROUTE.length - 1;
      if (last) {
        p.home.set(boat.position.x, 0, boat.position.z);
        p.homeRadius = 22;
      } else {
        const t = this.target();
        const dx = t.x - c.position.x;
        const dz = t.y - c.position.z;
        const d = Math.hypot(dx, dz) || 1;
        const reach = Math.min(d, 18);
        p.home.set(c.position.x + (dx / d) * reach, 0, c.position.z + (dz / d) * reach);
        p.homeRadius = 20;
      }
    }

    switch (this.beat) {
      case 'ashore':
        break;
      case 'wonder':
        /** A moment looking up the hill at all of it before the game starts again. */
        c.lookAt = this.crest;
        if (this.t > 4.5 && !c.busy) this.setDown();
        break;
      case 'walk':
        this.updateWalk(time);
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

    if (p.held) p.hold(c.handPosition(this.hand), c.yaw);
    this.frame();
  }

  /** The first thing they do on solid ground is put it down, so it can walk the hill on its own legs. */
  private setDown(): void {
    const { child: c, crane } = this.cast;
    c.lookAt = crane.eye(this.tmp);
    c.pickUp(() => {
      crane.follow();
      crane.bind(0.08);
      c.lookAt = null;
      this.to('walk');
      this.play = 'carry';
      this.throwAhead();
    });
  }

  private target(): THREE.Vector2 {
    return ROUTE[Math.min(this.leg, ROUTE.length - 1)];
  }

  private updateWalk(time: number): void {
    const { child: c, plane: p, boat, wind, crane } = this.cast;
    if (crane.flying) {
      /** If the player finds out here that they can fly it, everything else on the hill can wait. */
      c.stop();
      c.lookAt = crane.position;
      if (!this.flown) {
        this.flown = true;
        c.cheer();
        cue('delight');
        crane.bind(0.2);
      }
      return;
    }
    this.flown = false;
    const t = this.target();
    if (Math.hypot(c.position.x - t.x, c.position.z - t.y) < 16 && this.leg < ROUTE.length - 1) this.leg++;
    const last = this.leg === ROUTE.length - 1;
    if (last && this.lastLegAt === 0) this.lastLegAt = time;

    if (this.play === 'watch') {
      c.lookAt = p.position;
      /** A strong gust lifts a whole hillside of washing at once, and that is worth cheering at. */
      const w = wind.sample(c.position.x, c.position.z, this.tmp2);
      if (!this.cheered && (Math.hypot(w.x, w.z) > 11 || p.position.y - heightAt(p.position.x, p.position.z) > 8)) {
        this.cheered = true;
        c.cheer();
        cue('delight');
      }
      if (p.landed) this.fetch();
      else if (!c.moving && Math.hypot(p.position.x - c.position.x, p.position.z - c.position.z) > 9) {
        c.walkTo(p.position.x, p.position.z, true, undefined, 6);
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

  private readonly tmp2 = { x: 0, z: 0, energy: 0, lift: 0 };

  private throwAhead(): void {
    const c = this.cast.child;
    const t = this.leg === ROUTE.length - 1 ? this.cast.boat.position : this.target();
    const tx = t instanceof THREE.Vector2 ? t.x : t.x;
    const tz = t instanceof THREE.Vector2 ? t.y : t.z;
    const angle = Math.atan2(tx - c.position.x, tz - c.position.z) + (Math.random() - 0.5) * 0.7;
    c.throwToward(c.position.x + Math.sin(angle) * 16, c.position.z + Math.cos(angle) * 16, () => {
      this.cast.plane.launch(c.handPosition(this.hand), this.tmp.set(Math.sin(angle) * 7.4, 5.4, Math.cos(angle) * 7.4));
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
    const { child: c, boat, crane } = this.cast;
    this.to('toBoat');
    c.lookAt = null;
    c.walkTo(boat.position.x - 1.4, boat.position.z + 2.6, false, () => {
      c.faceToward(crane.position.x, crane.position.z, 1);
      c.lookAt = crane.eye(this.tmp);
      c.pickUp(() => {
        crane.carry(c.armsPoint(this.tmp), c.yaw);
        c.lookAt = null;
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
    if (this.beat === 'toBoat' || this.beat === 'push' || this.beat === 'aboard') {
      const b = this.cast.boat.position;
      s.target.set((c.x + b.x) / 2, b.y + 2.2, (c.z + b.z) / 2 - 2);
      s.distance = 26;
      s.height = 6.5;
      this.pace = 0.35;
      this.focus.copy(b);
      return;
    }
    if (this.cast.crane.flying) {
      const k = this.cast.crane.position;
      const ground = Math.max(heightAt(k.x, k.z), 0);
      s.target.set(c.x * 0.35 + k.x * 0.65, Math.max(ground + 1.8, k.y * 0.8 + ground * 0.2), c.z * 0.35 + k.z * 0.65);
      s.distance = 20 + Math.hypot(k.x - c.x, k.z - c.z) * 0.6;
      s.height = 5 + (k.y - ground) * 0.5;
      this.pace = 0.5;
      this.focus.copy(k);
      return;
    }
    if (this.beat === 'ashore' || this.beat === 'wonder') {
      s.target.set(c.x, Math.max(heightAt(c.x, c.z), 0) + 5, c.z - 12);
      s.distance = 30;
      s.height = 8;
      this.pace = 0.3;
      this.focus.copy(c);
      return;
    }
    const pw = this.cast.plane.held ? 0 : 0.3;
    const fx = c.x * (1 - pw) + p.x * pw;
    const fz = c.z * (1 - pw) + p.z * pw - 4;
    const ground = Math.max(heightAt(fx, fz), 0);
    s.target.set(fx, ground + 3.5, fz);
    /** Capped: on a hill this crowded, a wide shot is a shot with the child somewhere behind a sheet in it. */
    s.distance = Math.min(30, 18 + Math.hypot(p.x - c.x, p.z - c.z) * 0.4);
    s.height = s.distance * 0.32;
    /**
     * Coming over the crest, the shot opens out and takes in the far beach with the boat on it. Otherwise the
     * child walks down the back of the hill into a frame that shows the player nothing they can act on.
     */
    const b = this.cast.boat.position;
    const over = THREE.MathUtils.smoothstep(this.crest.z + 6 - c.z, 0, 32);
    if (over > 0) {
      /** Rising rather than pulling back: from further away there is only more washing between them and us. */
      s.target.lerp(this.tmp.set(b.x, Math.max(b.y, 0) + 2, b.z), 0.15 * over);
      s.distance += Math.hypot(b.x - fx, b.z - fz) * 0.1 * over;
      s.height += 3 * over;
    }
    this.pace = 0.4;
    this.focus.set(fx, ground, fz);
  }
}
