import * as THREE from 'three';
import type { Shot } from '../camera';
import type { WindSample } from '../wind/field';
import { heightAt } from '../world/island';
import { TREE } from '../world/landmarks';
import type { Cast, Chapter } from './cast';
import { completeObjective, cue } from './cues';
import { tuning } from '../tuning';

type Beat = 'still' | 'play' | 'toTree' | 'atTree' | 'skein' | 'toCygnet' | 'near' | 'kneel' | 'gather' | 'leaving' | 'toBoat' | 'push' | 'aboard';
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
  /** The aerial shot must not reveal the washing on the next island. */
  get haze(): number {
    return this.beat === 'toTree' || this.beat === 'atTree' || this.beat === 'skein' ? 0.99 : 0.85;
  }
  hush = 0;
  readonly dusk = 0;
  readonly shot: Shot = { target: new THREE.Vector3(), distance: 34, height: 9, fitWidth: true };
  readonly music = 'still' as const;
  readonly season = 0.08;
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
  private dropped = false;
  private downAt = -1;
  private nextCall = 0;
  private hushWanted = 0;
  private readonly fallen = new THREE.Vector3();
  private readonly left = new THREE.Vector3();
  /** Shared camera anchors for the outlook, the family and the uninterrupted descent. */
  private readonly skyEye = new THREE.Vector3();
  private readonly skyLook = new THREE.Vector3();
  private readonly outlookEye = new THREE.Vector3();
  private readonly outlookLook = new THREE.Vector3();
  private readonly rescueView = new THREE.Vector3(1, 0, 0.45).normalize();
  private readonly careView = new THREE.Vector3(-1, 0, 0.6).normalize();
  private readonly climbView = new THREE.Vector3();
  private fallAt = 0;
  private readonly eye = new THREE.Vector3();
  private watchUntil = 0;
  private nextLook = 0;
  private readonly watched = new THREE.Vector3();
  private readonly flat = new THREE.Vector3(TREE.x, 10, TREE.z);

  constructor(private readonly cast: Cast) {
    const { child, plane, boat } = cast;
    SEAT.y = Math.max(heightAt(SEAT.x, SEAT.z), 0);
    child.place(SEAT.x, SEAT.z, 0.35);
    child.sitDown();
    plane.hold(child);
    boat.beach(BOAT_BERTH.x, BOAT_BERTH.z, BERTH_YAW);
    boat.shelter = 1;
    const top = cast.tree.canopy.reduce((a, c) => (c.centre.y > a.y ? c.centre : a), cast.tree.canopy[0].centre);
    this.canopyTop.copy(top);
    this.frame();
  }

  /**
   * The grass around the tree is walked down while they are up there, so a child shorter than the grass is not
   * swallowed by it at the one moment the game asks the player to look at them.
   */
  get trodden(): THREE.Vector3 | null {
    if (this.beat === 'toTree' || this.beat === 'atTree' || (this.beat === 'skein' && !this.dropped)) {
      return this.flat.set(TREE.x + 4, 10, TREE.z + 1);
    }
    const rescuing = this.beat === 'near' || this.beat === 'kneel' || this.beat === 'gather'
      || (this.beat === 'leaving' && this.downAt >= 0 && this.now - this.beatStart < 3);
    if (this.dropped && (this.cast.cygnet.grounded || rescuing)) {
      // Their shared patch stays pressed while the child lifts it, even after it is no longer grounded.
      return this.flat.set(this.fallen.x, rescuing ? 5 : 2.5, this.fallen.z);
    }
    return null;
  }

  /** Only catch and the first breeze answer the player; the rest of the island is the story playing itself out. */
  get scripted(): boolean {
    return this.beat !== 'still' && this.beat !== 'play' && this.beat !== 'leaving';
  }

  get done(): boolean {
    return this.beat === 'aboard';
  }

  get checkpoint(): string | null { return this.beat === 'leaving' ? 'companion' : null; }
  restoreCheckpoint(): void {
    this.cast.boat.shelter = 1;
    this.restored = this.dropped = true;
    this.breeze = this.breezeTarget = this.worldLife = 1;
    this.beat = 'leaving';
    this.play = 'hold';
    this.holdUntil = 1.4;
    this.cast.flock.clear();
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
      /**
       * The plane's home moves to the boat, so however the player blows it about it always drifts back down there.
       * Chasing it then *is* walking to the boat, instead of wandering off across the island after it.
       */
      const berth = this.cast.boat.position;
      p.home.set(berth.x, 0, berth.z);
      p.homeRadius = 24;
      this.updatePlay(time);
      const b = this.cast.boat.position;
      const planeNear = Math.hypot(p.position.x - b.x, p.position.z - b.z) < BOARDING;
      const childNear = Math.hypot(c.position.x - b.x, c.position.z - b.z) < BOARDING;
      const waited = time - this.beatStart;
      // Nothing is ever stuck: if the plane will not come down by the boat, the child goes anyway.
      if (!c.busy && (((planeNear || childNear) && this.play === 'hold') || waited > 50)) this.board();
    } else {
      this.updateFarewell(time);
    }

    /**
     * The music gets out of the way when the skein appears and does not properly return until they are at sea:
     * after the fall the island stays subdued, so the crossing feels like coming up for air.
     */
    const quiet = this.beat === 'skein' || this.beat === 'toCygnet' || this.beat === 'near' || this.beat === 'kneel' || this.beat === 'gather';
    const after = this.dropped && (this.beat === 'leaving' || this.beat === 'toBoat' || this.beat === 'push');
    this.hushWanted = quiet ? (this.dropped ? 1 : 0.55) : after ? 0.45 : 0;
    this.hush += (this.hushWanted - this.hush) * (1 - Math.exp(-dt * 0.9));

    if (p.held) p.hold(c);
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
      if (!this.restored && this.islandLife > 0.65) {
        this.restored = true;
        this.restoredAt = this.now;
        completeObjective();
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
      /** Catch carries on after the island is whole: during `leaving` the throws are what lead them to the boat. */
      const playing = this.beat === 'play' || this.beat === 'leaving';
      if (playing && (w.energy > 0.55 || Math.hypot(w.x, w.z) > 15)) {
        this.snatch(time);
      } else if (playing && time > this.holdUntil && !c.busy) {
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
          p.hold(c);
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

  /**
   * Throws lean toward whatever is still grey, so a player who has not worked out that the wind brings the
   * island back to life is carried around the rest of it by the game they are already playing. The lean is
   * gentle and randomised: catch has to stay a game of catch, not a tour.
   */
  private throwNext(time: number): void {
    const c = this.cast.child;
    const aim = this.beat === 'leaving' ? this.cast.boat.position : ISLAND;
    const spread = this.beat === 'leaving' ? 0.7 : 1.8;
    const toAim = Math.atan2(aim.x - c.position.x, aim.z - c.position.z);
    const tries = this.beat === 'play' && !this.restored ? 6 : 1;
    let angle = toAim;
    let reach = 26;
    let best = -Infinity;
    for (let i = 0; i < tries; i++) {
      let a = toAim + (Math.random() - 0.5) * spread;
      const r = 18 + Math.random() * 16;
      /** Past the ridge the camera loses them, so anything aimed over it is reflected back down the island. */
      if (c.position.z + Math.cos(a) * r < PLAY_LIMIT) a = Math.PI - a;
      const score =
        tries === 1 ? 0 : 1 - this.cast.life.at(c.position.x + Math.sin(a) * r, c.position.z + Math.cos(a) * r) + Math.random() * 0.2;
      if (score > best) {
        best = score;
        angle = a;
        reach = r;
      }
    }
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
    const { child: c, plane: p } = this.cast;
    c.lookAt = this.canopyTop;
    const dx = TREE.x - c.position.x;
    const dz = TREE.z - c.position.z;
    const d = Math.hypot(dx, dz) || 1;
    /**
     * The plane goes up the hill first and waits over the tree. Nobody is marched anywhere: the child sets off
     * after it the way they have been doing all along, and the player has already learnt that is how it works.
     */
    if (p.held && d > 14) {
      p.home.set(TREE.x, 0, TREE.z);
      p.homeRadius = 12;
      const reach = Math.min(d - 4, 26);
      c.throwToward(c.position.x + (dx / d) * reach, c.position.z + (dz / d) * reach, () => {
        p.launch(c.handPosition(this.hand), this.tmp.set((dx / d) * 8.4, 5.2, (dz / d) * 8.4));
        c.lookAt = p.position;
        this.climb();
      });
      return;
    }
    this.climb();
  }

  private climb(): void {
    const c = this.cast.child;
    c.walkTo(TREE.x + 5.5, TREE.z + 1, true, () => {
      this.beat = 'atTree';
      this.beatStart = this.now;
      c.faceToward(c.position.x + 30, c.position.z + 10, 0.6);
      this.horizon.set(c.position.x + 700, 10, c.position.z + 180);
      c.lookAt = this.horizon;
      this.outlookEye.copy(c.position).add(this.tmp.set(8, 6, -18));
      this.outlookLook.copy(c.position).add(this.tmp.set(3, 4, 12));
    }, 0.8);
  }

  private updateFarewell(time: number): void {
    const { child: c } = this.cast;
    const t = this.now - this.beatStart;
    if (this.beat === 'toTree') {
      const p = this.cast.plane;
      c.lookAt = p.airborne && !p.landed ? p.position : this.canopyTop;
    } else if (this.beat === 'atTree') {
      c.lookAt = this.horizon;
      if (t > tuning.opening.outlook) {
        this.beat = 'skein';
        this.beatStart = this.now;
        const { flock, cygnet } = this.cast;
        // Cross the eastern slope toward the north, the same direction the boat will take.
        // The trailing bird is still upstream of its landing when it loses the formation.
        this.findFallen(c.position.x, c.position.z);
        flock.pass(c.position.x, c.position.z, c.position.y + tuning.opening.flockHeight, -2.5, 9, 0);
        this.tmp.copy(this.fallen)
          .addScaledVector(flock.direction, -(tuning.opening.flockSpeed * tuning.opening.flight + tuning.opening.fallTravel))
          .setY(c.position.y + tuning.opening.flockHeight);
        flock.carryCygnet(tuning.opening.flockSpeed, this.tmp);
        cygnet.flyWith(flock.tail(this.left), flock.heading, 0.6);
        cue('overhead');
      }
    } else if (this.beat === 'skein') {
      const { cygnet, flock } = this.cast;
      c.lookAt = t < tuning.opening.flight * 0.4 ? flock.head : cygnet.position;
      if (!this.dropped) {
        const effort = 0.15 + 0.85 * Math.sin(Math.PI * THREE.MathUtils.smootherstep(t, 0, tuning.opening.flight));
        flock.tail(this.left);
        // One recovery gains a little height, then fades as the adults pull ahead.
        this.left.addScaledVector(flock.direction, -t * 0.22 - (1 - effort) * 1.3);
        this.left.y += effort * 0.75 - t * 0.1;
        cygnet.flyWith(this.left, flock.heading, effort);
        if (t > tuning.opening.flight) {
          // Retire the reserved station, retaining the companion's exact last position for the descent.
          flock.dropOne(this.tmp);
          this.dropped = true;
          this.fallAt = time;
          cygnet.plummet(this.left, this.fallen, tuning.opening.fall, flock.heading);
          cue('fallen');
        }
      }
      /** It lands. The child does not move for a moment, and then runs. */
      /** It calls the whole way down and keeps calling on the ground. Nothing else is making a sound. */
      if (this.dropped && !cygnet.carried && time > this.nextCall) {
        cue('distress');
        cygnet.call(false);
        this.nextCall = time + (cygnet.state === 'falling' ? 1.1 : 1.9) + Math.random() * 0.5;
      }
      if (this.dropped && cygnet.grounded && this.downAt < 0) {
        this.downAt = this.now;
        cue('landed');
      }
      /** The player is left alone with it for a moment before the child moves. */
      if (this.downAt > 0 && this.now - this.downAt > 3.4 && !c.busy) {
        this.beat = 'toCygnet';
        this.beatStart = this.now;
        const dx = cygnet.position.x - c.position.x;
        const dz = cygnet.position.z - c.position.z;
        const d = Math.hypot(dx, dz) || 1;
        c.walkTo(cygnet.position.x - (dx / d) * 4.5, cygnet.position.z - (dz / d) * 4.5, true, () => this.slowDown(), 1.2);
      }
    } else if (this.beat === 'toCygnet' || this.beat === 'near' || this.beat === 'kneel') {
      c.lookAt = this.cast.cygnet.position;
      if (this.dropped && !this.cast.cygnet.carried && time > this.nextCall) {
        cue('distress');
        this.cast.cygnet.call(false);
        this.nextCall = time + 2.1 + Math.random() * 0.6;
      }
    } else if (this.beat === 'gather') {
      c.lookAt = this.cast.cygnet.eye(this.tmp);
    } else if (this.beat === 'push') {
      // A soft travelling brush reaches the cove before the weather fills the departing sail.
      const gust = t / tuning.opening.departureGustFor;
      if (gust < 1) {
        const strength = Math.sin(Math.PI * gust);
        const x = BOAT_BERTH.x - 12 + gust * 16;
        const z = BOAT_BERTH.z + 3 - gust * 4;
        this.cast.wind.addSplat({
          ax: x - 0.8, az: z - 3, bx: x + 0.8, bz: z + 3,
          vx: tuning.opening.departureGustSpeed * strength,
          vz: -tuning.opening.departureGustSpeed * 0.25 * strength,
          radius: 4.2, energy: tuning.opening.departureGustEnergy * strength, swirl: 0, lift: 0,
        });
      }
    }
  }

  /**
   * Where the cygnet comes down: open ground between the child and the boat, so it is always on the near side of
   * the ridge and on the way they are going. Never over the hill, where the player could not see any of it.
   */
  private findFallen(x: number, z: number): void {
    const b = this.cast.boat.position;
    const dx = b.x - x;
    const dz = b.z - z;
    const len = Math.hypot(dx, dz) || 1;
    for (const reach of [17, 13, 9, 6]) {
      const fx = x + (dx / len) * reach + 3;
      const fz = z + (dz / len) * reach;
      if (heightAt(fx, fz) > 2) {
        this.fallen.set(fx, Math.max(heightAt(fx, fz), 0), fz);
        return;
      }
    }
    this.fallen.set(x + 4, Math.max(heightAt(x + 4, z + 4), 0), z + 4);
  }

  /** The last few steps are walked, not run: you do not charge at something that small and frightened. */
  private slowDown(): void {
    const { child: c, cygnet } = this.cast;
    this.beat = 'near';
    this.beatStart = this.now;
    c.walkTo(cygnet.position.x, cygnet.position.z - 1.3, false, () => this.gather(), 0.9);
  }

  /**
   * Down on their knees, hands held out low and kept still. It has tried three times to get up by itself; with
   * somebody there it tries once more, and this time it gets as far as their hands. From here on it is carried.
   */
  private gather(): void {
    const { child: c, cygnet, carry } = this.cast;
    this.beat = 'kneel';
    this.beatStart = this.now;
    carry.gatherUp(() => {
      cygnet.bind(0.3);
      this.beat = 'leaving';
      this.beatStart = this.now;
      this.play = 'hold';
      this.holdUntil = this.now + 1.4;
      c.lookAt = this.cast.boat.position;
    }, true);
  }

  /** The plane has come down by the boat: the child fetches it, then leans on the bow and pushes off. */
  private board(): void {
    const { child: c, boat } = this.cast;
    this.beat = 'toBoat';
    this.beatStart = this.now;
    c.lookAt = null;
    const beside = boat.boardingPoint(this.tmp);
    c.walkTo(beside.x, beside.z, false, () => {
      this.beat = 'push';
      this.beatStart = this.now;
      c.faceToward(boat.position.x, boat.position.z, 1);
      c.board(boat, () => {
        this.beat = 'aboard';
        this.beatStart = this.now;
      });
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
    s.eye = undefined;
    s.carry = false;
    s.clearance = undefined;
    if (this.beat === 'atTree') {
      s.eye = this.eye.copy(this.outlookEye);
      s.target.copy(this.outlookLook);
      this.pace = 0.7;
      this.focus.copy(c);
      return;
    }
    if (this.beat === 'skein') {
      const k = this.cast.cygnet.position;
      const t = this.now - this.beatStart;
      const follow = THREE.MathUtils.smootherstep(t, 0.25, tuning.opening.flight * 0.45);
      const closer = THREE.MathUtils.smootherstep(t, tuning.opening.flight * 0.5, tuning.opening.flight);
      const descent = this.dropped ? THREE.MathUtils.smootherstep(this.now - this.fallAt, 0, tuning.opening.fall) : 0;
      const landing = this.dropped ? THREE.MathUtils.smootherstep(this.now - this.fallAt, tuning.opening.fall * 0.7, tuning.opening.fall) : 0;
      this.skyLook.copy(k).lerp(this.cast.flock.head, 0.5 * (1 - closer));
      // Stay on the island as the family approaches; ease back down the slope to make room for the landing.
      this.skyEye.copy(this.fallen).add(this.tmp.set(12, 9, -22));
      this.skyEye.lerpVectors(this.outlookEye, this.skyEye, descent);
      // Keep the bird above centre, leaving the sea and slope below it as a distance reference.
      this.skyLook.add(this.tmp.set(0, -5 + landing * 6, 0));
      s.eye = this.eye.copy(this.outlookEye).lerp(this.skyEye, follow);
      s.target.copy(this.outlookLook).lerp(this.skyLook, follow);
      this.pace = 0.9;
      this.focus.copy(k);
      return;
    }
    if (this.beat === 'toCygnet' || this.beat === 'near' || this.beat === 'kneel' || this.beat === 'gather') {
      const k = this.cast.cygnet.position;
      const close = this.beat === 'kneel' || this.beat === 'gather';
      s.eye = undefined;
      s.from = close ? this.careView : this.rescueView;
      s.target.set((c.x + k.x) / 2, Math.max(c.y, k.y) + (close ? 0.75 : 1.1), (c.z + k.z) / 2);
      s.distance = close ? 5.8 : 14;
      s.height = close ? 3.3 : 7;
      s.clearance = close ? 2.6 : 5.2;
      this.pace = 0.6;
      this.focus.copy(k);
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
    if (this.beat === 'toTree') {
      // Round the eastern side during the climb, arriving behind the child for the outlook.
      // An orbit keeps the camera out of the hill instead of crossing through it at the summit.
      const remaining = Math.hypot(c.x - (TREE.x + 5.5), c.z - (TREE.z + 1));
      const turn = THREE.MathUtils.smootherstep(30 - remaining, 0, 30) * (Math.PI - 0.4);
      s.from = this.climbView.set(Math.sin(turn), 0, Math.cos(turn));
      this.pace = 0.75;
    }
    if (this.beat === 'leaving') {
      const b = this.cast.boat.position;
      s.target.lerp(this.tmp.set(b.x, b.y + 2, b.z), 0.3);
      s.distance += Math.hypot(b.x - fx, b.z - fz) * 0.32;
    }
    this.focus.set(fx, fy, fz);
  }
}
