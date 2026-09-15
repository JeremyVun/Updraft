import * as THREE from 'three';
import type { Shot } from '../camera';
import type { Glider } from '../glider/glider';
import type { PointerInput } from '../input/pointer';
import type { Traveller } from '../traveller/traveller';
import type { WindField, WindSample } from '../wind/field';
import { heightAt } from '../world/island';

type Beat = 'still' | 'play';
type Play = 'watch' | 'fetch' | 'hold';

/** Where the child sits at the start: the sheltered beach in the cove, looking out past the island. */
const SEAT = new THREE.Vector3(4, 0, 18.8);
const ISLAND = new THREE.Vector3(-6, 0, -14);

/**
 * The first chapter. The world is still until the player's first gust; the breeze swells, the plane slips from
 * the child's hands, and a game of catch begins: fetch, a pause, a throw, the player carries it, a cheer.
 */
export class IslandChapter {
  beat: Beat = 'still';
  /** How much of the prevailing breeze has come back, 0..1. */
  breeze = 0;
  readonly shot: Shot = { target: new THREE.Vector3(), distance: 34, height: 9 };
  private play: Play = 'watch';
  private breezeTarget = 0;
  private stillSince = 0;
  private holdUntil = 0;
  private cheered = false;
  private flightStart = 0;
  private readonly sample: WindSample = { x: 0, z: 0, energy: 0, lift: 0 };
  private readonly hand = new THREE.Vector3();
  private readonly tmp = new THREE.Vector3();
  private now = 0;

  constructor(
    private readonly child: Traveller,
    private readonly plane: Glider,
    private readonly wind: WindField,
    private readonly input: PointerInput,
  ) {
    const y = heightAt(SEAT.x, SEAT.z);
    SEAT.y = Math.max(y, 0);
    child.place(SEAT.x, SEAT.z, 0.35);
    child.sitDown();
    plane.hold(child.handPosition(this.hand), child.yaw);
    this.frame();
  }

  update(dt: number, time: number): void {
    this.now = time;
    this.breeze += (this.breezeTarget - this.breeze) * (1 - Math.exp(-dt * 0.25));
    const c = this.child;
    const p = this.plane;

    if (this.beat === 'still') {
      if (this.input.gust > 5) this.breezeTarget = 1;
      const w = this.wind.sample(c.position.x, c.position.z, this.sample);
      if (this.breezeTarget > 0) this.stillSince += dt;
      if (w.energy > 0.15 || Math.hypot(w.x, w.z) > 6 || this.stillSince > 5) this.loosen(time);
    } else {
      this.updatePlay(dt, time);
    }

    if (p.held) p.hold(c.handPosition(this.hand), c.yaw);
    this.frame();
  }

  private loosen(time: number): void {
    this.beat = 'play';
    this.play = 'watch';
    this.breezeTarget = 1;
    const c = this.child;
    const w = this.wind.sample(c.position.x, c.position.z, this.sample);
    const speed = Math.hypot(w.x, w.z) || 1;
    const vel = this.tmp.set((w.x / speed) * 5 + 1.5, 4.2, (w.z / speed) * 5 - 2);
    this.plane.launch(c.handPosition(this.hand), vel);
    c.standUp();
    c.lookAt = this.plane.position;
    this.flightStart = time;
  }

  private updatePlay(_dt: number, time: number): void {
    const c = this.child;
    const p = this.plane;
    const w = this.wind.sample(c.position.x, c.position.z, this.sample);

    if (this.play === 'watch') {
      c.lookAt = p.position;
      const altitude = p.position.y - Math.max(heightAt(p.position.x, p.position.z), 0);
      if (!this.cheered && (altitude > 11 || time - this.flightStart > 7) && !p.landed) {
        this.cheered = true;
        c.cheer();
      }
      const far = Math.hypot(p.position.x - c.position.x, p.position.z - c.position.z);
      if (far > 26 && !c.moving) c.walkTo(p.position.x, p.position.z, false, undefined, 14);
      if (p.landed) this.fetch();
    } else if (this.play === 'fetch') {
      c.lookAt = p.position;
      if (!p.landed && p.airborne) {
        this.play = 'watch';
        this.flightStart = time;
        c.stop();
        c.cheer();
      }
    } else if (this.play === 'hold') {
      if (w.energy > 0.55 || Math.hypot(w.x, w.z) > 15) {
        this.snatch(time);
      } else if (time > this.holdUntil && !c.busy) {
        this.throwNext(time);
      } else {
        c.lookAt = null;
      }
    }
  }

  private fetch(): void {
    const c = this.child;
    const p = this.plane;
    this.play = 'fetch';
    c.walkTo(p.position.x, p.position.z, true, () => {
      if (this.play !== 'fetch') return;
      const d = Math.hypot(p.position.x - c.position.x, p.position.z - c.position.z);
      if (d > 2.6 || !p.landed) {
        this.play = 'watch';
        return;
      }
      c.pickUp(() => {
        p.hold(c.handPosition(this.hand), c.yaw);
        this.play = 'hold';
        this.holdUntil = this.now + 1.6 + Math.random() * 1.4;
        if (Math.random() < 0.35) c.wave();
      });
    }, 1.2);
  }

  private snatch(time: number): void {
    const c = this.child;
    const w = this.wind.sample(c.position.x, c.position.z, this.sample);
    const speed = Math.hypot(w.x, w.z) || 1;
    this.plane.launch(c.handPosition(this.hand), this.tmp.set((w.x / speed) * 6, 3.5, (w.z / speed) * 6));
    this.play = 'watch';
    this.cheered = false;
    this.flightStart = time;
    c.cheer();
  }

  private throwNext(time: number): void {
    const c = this.child;
    const toIsland = Math.atan2(ISLAND.x - c.position.x, ISLAND.z - c.position.z);
    const angle = toIsland + (Math.random() - 0.5) * 1.8;
    const reach = 18 + Math.random() * 16;
    const tx = c.position.x + Math.sin(angle) * reach;
    const tz = c.position.z + Math.cos(angle) * reach;
    c.throwToward(tx, tz, () => {
      const dir = this.tmp.set(Math.sin(angle), 0, Math.cos(angle));
      this.plane.launch(c.handPosition(this.hand), dir.multiplyScalar(7.5).setY(4.8));
      this.play = 'watch';
      this.cheered = false;
      this.flightStart = time;
      c.lookAt = this.plane.position;
    });
  }

  /** Close on the child at first; once the plane is flying, wide enough to hold both and most of the island. */
  private frame(): void {
    const c = this.child.position;
    const s = this.shot;
    if (this.beat === 'still') {
      s.target.set(c.x - 1.2, c.y + 1.6, c.z - 3);
      s.distance = 21;
      s.height = 5.2;
      return;
    }
    const p = this.plane.position;
    const pw = this.plane.held ? 0 : 0.3;
    const fx = c.x * (1 - pw) + p.x * pw;
    const fz = c.z * (1 - pw) + p.z * pw;
    const fy = Math.max(heightAt(fx, fz), 0) * 0.6 + 2 + Math.max(0, p.y - 12) * 0.4;
    s.target.set(fx, fy, fz);
    const spread = Math.hypot(p.x - c.x, p.z - c.z) + Math.max(0, p.y - c.y - 6) * 0.8;
    s.distance = THREE.MathUtils.clamp(30 + spread * 0.9, 36, 84);
    s.height = s.distance * 0.25;
  }
}
