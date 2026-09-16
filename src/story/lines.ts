import * as THREE from 'three';
import type { Shot } from '../camera';
import { ISLES } from '../world/heightfield';
import { heightAt } from '../world/island';
import type { Cast, Chapter } from './cast';
import { cue } from './cues';

/** The steep little island's south beach, where the boat runs ashore. */
export const LINES_LANDING = new THREE.Vector2(14, -277);
/** The boat is drawn up on the far shore before they get there. Nobody put it there. */
export const LINES_BERTH = new THREE.Vector3(14, 0, -386);

/** Up over the top of the island and down the other side, through the washing. */
const ROUTE = [new THREE.Vector2(6, -312), new THREE.Vector2(22, -346), new THREE.Vector2(14, -374)];

/** How near the boat the plane has to land before the child takes the hint. */
const BOARDING = 14;

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
  readonly dusk = 0;
  readonly shot: Shot = { target: new THREE.Vector3(), distance: 34, height: 10 };
  readonly focus = new THREE.Vector3();
  private play: Play = 'carry';
  private leg = 0;
  private beatStart = 0;
  private holdUntil = 0;
  private now = 0;
  private cheered = false;
  private readonly hand = new THREE.Vector3();
  private readonly tmp = new THREE.Vector3();
  private readonly crest = new THREE.Vector3(14, 30, -330);

  constructor(private readonly cast: Cast) {
    const { child, plane, boat } = cast;
    /** Only the first island was ever grey: everywhere the child reaches after it is already living. */
    cast.life.regions.island.set(ISLES.lines.x, ISLES.lines.z, 86, 1);
    plane.homeRadius = 48;
    child.dismount();
    boat.beach(LINES_BERTH.x, LINES_BERTH.z, 0.1);
    child.walkTo(LINES_LANDING.x - 2, LINES_LANDING.y - 12, false, () => this.to('wonder'), 0.9);
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
    if (!p.departing) p.home.set(c.position.x, 0, c.position.z - 20);

    switch (this.beat) {
      case 'ashore':
        break;
      case 'wonder':
        /** A moment looking up the hill at all of it before the game starts again. */
        c.lookAt = this.crest;
        if (this.t > 4.5 && !c.busy) {
          this.to('walk');
          this.play = 'carry';
          this.throwAhead();
        }
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

  private target(): THREE.Vector2 {
    return ROUTE[Math.min(this.leg, ROUTE.length - 1)];
  }

  private updateWalk(time: number): void {
    const { child: c, plane: p, boat, wind } = this.cast;
    const t = this.target();
    if (Math.hypot(c.position.x - t.x, c.position.z - t.y) < 18 && this.leg < ROUTE.length - 1) this.leg++;
    const last = this.leg === ROUTE.length - 1;

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
      const nearBoat = Math.hypot(p.position.x - boat.position.x, p.position.z - boat.position.z) < BOARDING;
      const childNear = Math.hypot(c.position.x - boat.position.x, c.position.z - boat.position.z) < BOARDING;
      if (last && (nearBoat || childNear || this.now - this.beatStart > 150)) this.board();
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
    c.throwToward(c.position.x + Math.sin(angle) * 22, c.position.z + Math.cos(angle) * 22, () => {
      this.cast.plane.launch(c.handPosition(this.hand), this.tmp.set(Math.sin(angle) * 8.6, 5.4, Math.cos(angle) * 8.6));
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
    this.to('toBoat');
    c.lookAt = null;
    c.walkTo(boat.position.x - 1.4, boat.position.z + 2.6, false, () => {
      this.to('push');
      c.faceToward(boat.position.x, boat.position.z, 1);
      c.push();
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
    if (this.beat === 'ashore' || this.beat === 'wonder') {
      s.target.set(c.x, Math.max(heightAt(c.x, c.z), 0) + 6, c.z - 16);
      s.distance = 40;
      s.height = 11;
      this.pace = 0.3;
      this.focus.copy(c);
      return;
    }
    const pw = this.cast.plane.held ? 0 : 0.3;
    const fx = c.x * (1 - pw) + p.x * pw;
    const fz = c.z * (1 - pw) + p.z * pw - 4;
    const ground = Math.max(heightAt(fx, fz), 0);
    s.target.set(fx, ground + 3.5, fz);
    s.distance = 32 + Math.hypot(p.x - c.x, p.z - c.z) * 0.5;
    s.height = s.distance * 0.3;
    this.pace = 0.4;
    this.focus.set(fx, ground, fz);
  }
}
