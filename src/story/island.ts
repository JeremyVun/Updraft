import * as THREE from 'three';
import type { Shot } from '../camera';
import type { WindSample } from '../wind/field';
import { heightAt } from '../world/island';
import { TREE } from '../world/landmarks';
import type { Cast, Chapter } from './cast';
import { cue } from './cues';

type Beat = 'still' | 'play' | 'toTree' | 'atTree' | 'leaving' | 'toBoat' | 'push' | 'aboard';
type Play = 'watch' | 'fetch' | 'hold';

/** Where the child sits at the start: the beach on the island's south shore, looking out to sea. */
const SEAT = new THREE.Vector3(-2, 0, 22);
/** Where the plane is thrown during catch: the southern half, so play never goes over the ridge and out of sight. */
const ISLAND = new THREE.Vector3(-4, 0, -2);
/** The plane is turned back before the ridge; past here the camera would lose the child behind the hill. */
const PLAY_LIMIT = -24;
/** The boat lies at the cove's waterline a few strides east of the child, in frame from the first second. */
export const BOAT_BERTH = new THREE.Vector3(8.5, 0, 21.5);
/** Beached bow-out, pointing east down the cove, ready to be pushed off. */
const BERTH_YAW = 0.95;
/** How near the boat the plane has to land before the child takes the hint and pushes off. */
const BOARDING = 15;

/**
 * The still island. The world is still until the player's first gust; the breeze swells, the plane slips from
 * the child's hands, and a game of catch begins while the wind brings the island back to life. Once it is
 * whole, the child climbs to the blooming tree, looks out at the hills, and pushes the boat off.
 */
export class IslandChapter implements Chapter {
  beat: Beat = 'still';
  breeze = 0;
  worldLife = 0;
  restored = false;
  pace = 0.8;
  readonly dusk = 0;
  readonly shot: Shot = { target: new THREE.Vector3(), distance: 34, height: 9 };
  readonly focus = new THREE.Vector3();
  private play: Play = 'watch';
  private breezeTarget = 0;
  private stillSince = 0;
  private holdUntil = 0;
  private beatStart = 0;
  private cheered = false;
  private flightStart = 0;
  private readonly sample: WindSample = { x: 0, z: 0, energy: 0, lift: 0 };
  private readonly hand = new THREE.Vector3();
  private readonly tmp = new THREE.Vector3();
  private readonly canopyTop = new THREE.Vector3();
  private readonly horizon = new THREE.Vector3(0, 10, -700);
  /** The opening bearing: a little west of south, so the beached boat sits at the right of frame beside the child. */
  private readonly opening = new THREE.Vector3(-0.28, 0, 0.96).normalize();
  private now = 0;
  private sinceLifeCheck = 0;
  private islandLife = 0;
  private restoredAt = 0;
  private watchUntil = 0;
  private nextLook = 0;
  private readonly watched = new THREE.Vector3();

  constructor(private readonly cast: Cast) {
    const { child, plane, boat } = cast;
    SEAT.y = Math.max(heightAt(SEAT.x, SEAT.z), 0);
    child.place(SEAT.x, SEAT.z, 0.35);
    child.sitDown();
    plane.hold(child.handPosition(this.hand), child.yaw);
    boat.beach(BOAT_BERTH.x, BOAT_BERTH.z, BERTH_YAW);
    const top = cast.tree.canopy.reduce((a, c) => (c.centre.y > a.y ? c.centre : a), cast.tree.canopy[0].centre);
    this.canopyTop.copy(top);
    this.frame();
  }

  get done(): boolean {
    return this.beat === 'aboard';
  }

  update(dt: number, time: number): void {
    this.now = time;
    this.trackLife(dt);
    this.breeze += (this.breezeTarget - this.breeze) * (1 - Math.exp(-dt * 0.25));
    const { child: c, plane: p } = this.cast;

    if (this.beat === 'still') {
      if (this.cast.input.gust > 5 && this.breezeTarget === 0) {
        this.breezeTarget = 1;
        cue('breeze');
      }
      const w = this.cast.wind.sample(c.position.x, c.position.z, this.sample);
      if (this.breezeTarget > 0) this.stillSince += dt;
      if (w.energy > 0.15 || Math.hypot(w.x, w.z) > 6 || this.stillSince > 5) this.loosen(time);
    } else if (this.beat === 'play') {
      this.updatePlay(time);
      if (this.restored && this.play === 'hold' && !c.busy) this.farewell();
    } else if (this.beat === 'leaving') {
      this.updatePlay(time);
      const b = this.cast.boat.position;
      const planeNear = Math.hypot(p.position.x - b.x, p.position.z - b.z) < BOARDING;
      const childNear = Math.hypot(c.position.x - b.x, c.position.z - b.z) < BOARDING;
      const waited = time - this.beatStart;
      // Nothing is ever stuck: if the plane will not come down by the boat, the child goes anyway.
      if (!c.busy && (((planeNear || childNear) && this.play === 'hold') || waited > 70)) this.board();
    } else {
      this.updateFarewell(time);
    }

    if (p.held) p.hold(c.handPosition(this.hand), c.yaw);
    this.frame();
  }

  /** Measures the island's life a few times a second; once most of it lives, the rest follows on its own. */
  private trackLife(dt: number): void {
    this.sinceLifeCheck += dt;
    const life = this.cast.life;
    if (this.sinceLifeCheck > 0.5) {
      this.sinceLifeCheck = 0;
      const island = life.regions.island;
      this.islandLife = life.mean((x, z) => Math.hypot(x - island.x, z - island.y) < island.z && heightAt(x, z) > 0.4);
      if (!this.restored && this.islandLife > 0.78) {
        this.restored = true;
        this.restoredAt = this.now;
        cue('restored');
      }
    }
    const region = life.regions.island;
    if (this.restored) region.w = Math.min(1, region.w + dt * 0.34);
    const target = Math.max(this.islandLife, region.w);
    /**
     * Colour comes back locally wherever the wind goes, but the world's overall warmth is held down until the
     * island is whole — so the moment it is, the whole frame lifts at once instead of creeping up unnoticed.
     */
    const held = this.restored ? target : Math.min(target, 0.5 + (target - 0.5) * 0.28);
    const rate = this.restored ? 1.5 : 0.9;
    this.worldLife += (held - this.worldLife) * (1 - Math.exp(-dt * rate));
    if (this.restored && this.now - this.restoredAt < 4) this.pace = 0.3;
  }

  private loosen(time: number): void {
    this.beat = 'play';
    this.play = 'watch';
    this.breezeTarget = 1;
    this.pace = 0.45;
    const { child: c, plane } = this.cast;
    const w = this.cast.wind.sample(c.position.x, c.position.z, this.sample);
    const speed = Math.hypot(w.x, w.z) || 1;
    plane.launch(c.handPosition(this.hand), this.tmp.set((w.x / speed) * 5 + 1.5, 4.2, (w.z / speed) * 5 - 2));
    c.standUp();
    c.lookAt = plane.position;
    this.flightStart = time;
  }

  private updatePlay(time: number): void {
    const { child: c, plane: p } = this.cast;
    const w = this.cast.wind.sample(c.position.x, c.position.z, this.sample);

    // A glance at whatever has come near, while the plane is up; on a long cooldown so it never stalls the game.
    if (time > this.nextLook && this.play === 'watch') {
      this.nextLook = time + 9;
      if (this.cast.nearby(c.position.x, c.position.z, 8, this.watched)) this.watchUntil = time + 2.5;
    }
    if (time < this.watchUntil && this.play === 'watch') {
      c.lookAt = this.watched;
      if (p.landed) this.fetch();
      return;
    }

    if (this.play === 'watch') {
      c.lookAt = p.position;
      const altitude = p.position.y - Math.max(heightAt(p.position.x, p.position.z), 0);
      if (!this.cheered && (altitude > 8 || time - this.flightStart > 4.5) && !p.landed) {
        this.cheered = true;
        c.cheer();
        cue('delight');
      }
      const far = Math.hypot(p.position.x - c.position.x, p.position.z - c.position.z);
      if (far > 8 && !c.moving) c.walkTo(p.position.x, p.position.z, far > 20 || altitude > 9, undefined, 5);
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
      if (!this.restored && (w.energy > 0.55 || Math.hypot(w.x, w.z) > 15)) {
        this.snatch(time);
      } else if (!this.restored && time > this.holdUntil && !c.busy) {
        this.throwNext(time);
      } else {
        c.lookAt = this.beat === 'leaving' ? this.cast.boat.position : null;
      }
    }
  }

  private fetch(): void {
    const { child: c, plane: p } = this.cast;
    this.play = 'fetch';
    c.walkTo(
      p.position.x,
      p.position.z,
      true,
      () => {
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
      },
      1.2,
    );
  }

  private snatch(time: number): void {
    const { child: c, plane } = this.cast;
    const w = this.cast.wind.sample(c.position.x, c.position.z, this.sample);
    const speed = Math.hypot(w.x, w.z) || 1;
    plane.launch(c.handPosition(this.hand), this.tmp.set((w.x / speed) * 6, 3.5, (w.z / speed) * 6));
    this.play = 'watch';
    this.cheered = false;
    this.flightStart = time;
    c.cheer();
    cue('delight');
  }

  private throwNext(time: number): void {
    const c = this.cast.child;
    const aim = this.beat === 'leaving' ? this.cast.boat.position : ISLAND;
    const spread = this.beat === 'leaving' ? 0.7 : 1.8;
    const toAim = Math.atan2(aim.x - c.position.x, aim.z - c.position.z);
    let angle = toAim + (Math.random() - 0.5) * spread;
    const reach = 18 + Math.random() * 16;
    if (c.position.z + Math.cos(angle) * reach < PLAY_LIMIT) angle = Math.PI - angle;
    c.throwToward(c.position.x + Math.sin(angle) * reach, c.position.z + Math.cos(angle) * reach, () => {
      const dir = this.tmp.set(Math.sin(angle), 0, Math.cos(angle));
      this.cast.plane.launch(c.handPosition(this.hand), dir.multiplyScalar(7.5).setY(4.8));
      this.play = 'watch';
      this.cheered = false;
      this.flightStart = time;
      c.lookAt = this.cast.plane.position;
    });
  }

  /** The island is whole: up the hill to the tree, a long look at the hills, then down to the boat. */
  private farewell(): void {
    this.beat = 'toTree';
    this.beatStart = this.now;
    const c = this.cast.child;
    c.lookAt = this.canopyTop;
    c.walkTo(TREE.x + 1.5, TREE.z + 3.2, true, () => {
      this.beat = 'atTree';
      this.beatStart = this.now;
      c.faceToward(TREE.x, TREE.z, 1);
      c.cheer();
    }, 0.8);
  }

  private updateFarewell(_time: number): void {
    const { child: c, boat } = this.cast;
    const t = this.now - this.beatStart;
    if (this.beat === 'toTree') {
      c.lookAt = this.canopyTop;
    } else if (this.beat === 'atTree') {
      c.lookAt = t < 4 ? this.canopyTop : this.horizon;
      if (t > 4 && t < 4.2) c.faceToward(this.horizon.x, this.horizon.z, 0.2);
      if (t > 8.5) {
        this.beat = 'leaving';
        this.beatStart = this.now;
        this.play = 'hold';
        this.holdUntil = this.now + 1.2;
        c.lookAt = boat.position;
      }
    } else if (this.beat === 'push') {
      if (t > 0.9 && !boat.afloat) boat.launch();
      if (t > 2.3) {
        this.beat = 'aboard';
        c.ride(boat.seat(this.tmp), boat.yaw);
      }
    }
  }

  /** The plane has come down by the boat: the child fetches it, then leans on the bow and pushes off. */
  private board(): void {
    const { child: c, boat } = this.cast;
    this.beat = 'toBoat';
    this.beatStart = this.now;
    c.lookAt = null;
    c.walkTo(boat.position.x - 1.4, boat.position.z + 2.6, false, () => {
      this.beat = 'push';
      this.beatStart = this.now;
      c.faceToward(boat.position.x, boat.position.z, 1);
      c.push();
    }, 0.5);
  }

  /** Close on the child at first; wide enough for child and plane while they play; low beside the tree at the end. */
  private frame(): void {
    const c = this.cast.child.position;
    const s = this.shot;
    if (this.beat === 'still') {
      s.target.set(c.x + 1.2, c.y + 1.6, c.z - 1.5);
      s.from = this.opening;
      s.distance = 20;
      s.height = 5;
      this.focus.copy(c);
      return;
    }
    s.from = undefined;
    if (this.beat === 'atTree') {
      s.target.set(c.x, c.y + 3, c.z - 14);
      s.distance = 30;
      s.height = 7;
      this.pace = 0.35;
      this.focus.copy(c);
      return;
    }
    if (this.beat === 'toBoat' || this.beat === 'push' || this.beat === 'aboard') {
      const b = this.cast.boat.position;
      s.target.set((c.x + b.x) / 2, b.y + 2.2, (c.z + b.z) / 2 - 2);
      s.distance = 26;
      s.height = 6.5;
      this.pace = 0.35;
      this.focus.copy(b);
      return;
    }
    const p = this.cast.plane.position;
    const pw = this.cast.plane.held ? 0 : 0.3;
    const fx = c.x * (1 - pw) + p.x * pw;
    const fz = c.z * (1 - pw) + p.z * pw;
    const fy = Math.max(heightAt(fx, fz), 0) * 0.6 + 2 + Math.max(0, p.y - 12) * 0.4;
    s.target.set(fx, fy, fz);
    const spread = Math.hypot(p.x - c.x, p.z - c.z) + Math.max(0, p.y - c.y - 6) * 0.8;
    s.distance = THREE.MathUtils.clamp(30 + spread * 0.9, 36, 84);
    s.height = s.distance * 0.25;
    if (this.beat === 'leaving') {
      const b = this.cast.boat.position;
      s.target.lerp(this.tmp.set(b.x, b.y + 2, b.z), 0.3);
      s.distance += Math.hypot(b.x - fx, b.z - fz) * 0.32;
    }
    this.focus.set(fx, fy, fz);
  }
}
