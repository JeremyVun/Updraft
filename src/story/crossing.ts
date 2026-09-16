import * as THREE from 'three';
import type { Shot } from '../camera';
import type { Cast, Chapter } from './cast';

/** The beach on the meadow's south shore, where the boat first comes ashore on the mainland-sized island. */
export const LANDING = new THREE.Vector2(10, -600);

/** The restored still island, as the child looks back at it from the first crossing. */
export const FIRST_ISLAND = new THREE.Vector3(-8, 9, -18);

/** How near a waypoint counts as rounded. */
const ROUNDED = 22;
/** How long a rainbow lingers once the boat sets out. */
const RAINBOW_FOR = 70;
/** How long the camera takes to swing round from the farewell to behind the sail. */
const SWING = 9;
/** The camera's usual bearing, from the default shot: behind the boat, looking north. */
const SAIL_BEARING = Math.atan2(0.075, 1);

export interface CrossingOpts {
  /** Waypoints out to open water and on to the far shore; the bow may only ground on the last one. */
  route: THREE.Vector2[];
  /** What the child rides facing and waves at as it falls astern, or nothing to face the way ahead throughout. */
  lookBack?: THREE.Vector3 | null;
  farewell?: number;
  rainbow?: boolean;
  /** When the whale comes up ahead, or nothing for a crossing without one. */
  whaleAt?: number | null;
  /** Haze thick enough to hide where they are going, 0 to 1. */
  haze?: number;
  dusk?: number;
}

/**
 * A crossing. The boat follows its waypoints and the player fills the sail; the child looks back at whatever is
 * falling astern, then ahead into the haze. Ends when the bow runs up the far beach. Each crossing after the first
 * is shorter and hazier than the last, so the world closes in and every island arrives without warning.
 */
export class CrossingChapter implements Chapter {
  readonly breeze = 1;
  readonly worldLife = 1;
  pace = 0.4;
  readonly dusk: number;
  readonly haze: number;
  rainbow = 0;
  readonly shot: Shot = { target: new THREE.Vector3(), distance: 24, height: 6.5, carry: true };
  readonly focus = new THREE.Vector3();
  readonly escort = new THREE.Vector3();
  private readonly route: THREE.Vector2[];
  private readonly lookBack: THREE.Vector3 | null;
  private readonly farewellFor: number;
  private readonly wantsRainbow: boolean;
  private readonly whaleAt: number | null;
  private readonly seat = new THREE.Vector3();
  private readonly hand = new THREE.Vector3();
  private readonly ahead = new THREE.Vector3();
  private readonly from = new THREE.Vector3();
  private readonly spot = new THREE.Vector3();
  private readonly look = new THREE.Vector3();
  private time = 0;
  private facingBack = 0;
  private nextWave = 3.5;
  private whaleCalled = false;
  private watching = 0;
  private leg = 0;
  /** Which side of the stern the camera rides on; eased, so it never snaps across when the boom swings. */
  private quarter = 1;
  private nextGlance = 8;
  private glanceUntil = 0;

  constructor(
    private readonly cast: Cast,
    opts: CrossingOpts,
  ) {
    this.route = opts.route;
    this.lookBack = opts.lookBack ?? null;
    this.farewellFor = this.lookBack ? (opts.farewell ?? 30) : 0;
    this.wantsRainbow = opts.rainbow ?? false;
    this.whaleAt = opts.whaleAt ?? null;
    this.haze = opts.haze ?? 0;
    this.dusk = opts.dusk ?? 0;
    cast.boat.steerFor = this.route[0];
    cast.boat.canGround = this.route.length === 1;
    cast.boat.grounded = false;
    cast.plane.homeRadius = 1e9;
  }

  get done(): boolean {
    return this.cast.boat.grounded;
  }

  /** Steers waypoint to waypoint; only the last leg, out in open water, may run the bow ashore. */
  private steer(): void {
    const { boat } = this.cast;
    const wp = this.route[this.leg];
    if (this.leg < this.route.length - 1 && Math.hypot(boat.position.x - wp.x, boat.position.z - wp.y) < ROUNDED) {
      this.leg++;
      boat.steerFor = this.route[this.leg];
      boat.canGround = this.leg === this.route.length - 1;
    }
  }

  update(dt: number): void {
    this.time += dt;
    this.steer();
    const { child, boat, plane, sealife } = this.cast;
    const back = this.lookBack;
    const farewell = this.time < this.farewellFor;
    this.facingBack = farewell ? Math.min(1, this.facingBack + dt / 2.2) : Math.max(0, this.facingBack - dt / 1.6);
    const turn = this.facingBack * this.facingBack * (3 - 2 * this.facingBack);
    let seatYaw = boat.yaw;
    if (back) {
      const toBack = Math.atan2(back.x - boat.position.x, back.z - boat.position.z);
      seatYaw += Math.atan2(Math.sin(toBack - boat.yaw), Math.cos(toBack - boat.yaw)) * turn;
    }
    child.ride(boat.seat(this.seat), seatYaw);
    plane.hold(child.handPosition(this.hand), child.yaw);

    if (farewell && back) {
      child.lookAt = back;
      if (this.time > this.nextWave) {
        child.wave();
        this.nextWave = this.time + 5 + Math.random() * 3;
      }
    } else if (this.time < this.glanceUntil) {
      /** Long stretches of open water, and something small in your arms: of course you look down at it. */
      child.lookAt = this.cast.crane.carried ? this.cast.crane.eye(this.ahead) : null;
    } else {
      const look = Math.sin(this.time * 0.13) * 30;
      this.ahead.set(boat.position.x + look, 12, boat.position.z - 200);
      child.lookAt = this.ahead;
      if (this.time > this.nextGlance && this.cast.crane.carried) {
        this.glanceUntil = this.time + 3.5 + Math.random() * 2.5;
        this.nextGlance = this.glanceUntil + 9 + Math.random() * 8;
      }
    }

    if (this.whaleAt !== null && !this.whaleCalled && this.time > this.whaleAt) {
      this.whaleCalled = true;
      const fx0 = Math.sin(boat.yaw);
      const fz0 = Math.cos(boat.yaw);
      this.spot.set(boat.position.x + fx0 * 58 - fz0 * 17, 0, boat.position.z + fz0 * 58 + fx0 * 17);
      sealife.surfaceWhale(this.spot, boat.yaw - 0.3);
    }
    sealife.fishNear(boat.position, farewell ? 0.25 : 1);
    const whale = sealife.whale;
    if (whale && !farewell) child.lookAt = whale;
    this.watching = whale && !farewell ? Math.min(1, this.watching + dt * 0.5) : Math.max(0, this.watching - dt * 0.5);

    const wanted = this.wantsRainbow && this.time < RAINBOW_FOR ? 1 : 0;
    this.rainbow += (wanted - this.rainbow) * (1 - Math.exp(-dt * (wanted > this.rainbow ? 0.3 : 0.06)));

    this.frame(back);
  }

  /** Behind the sail, looking the way they are going; swung round to face what they are leaving, during a farewell. */
  private frame(back: THREE.Vector3 | null): void {
    const { boat } = this.cast;
    const fx = Math.sin(boat.yaw);
    const fz = Math.cos(boat.yaw);
    const swing = back ? THREE.MathUtils.smootherstep(this.time, this.farewellFor, this.farewellFor + SWING) : 1;
    if (back && swing < 1) {
      const toBack = Math.atan2(back.x - boat.position.x, back.z - boat.position.z);
      const farewellBearing = toBack + Math.PI + 0.55;
      const bearing =
        farewellBearing +
        Math.atan2(Math.sin(SAIL_BEARING - farewellBearing), Math.cos(SAIL_BEARING - farewellBearing)) * swing;
      this.shot.from = this.from.set(Math.sin(bearing), 0, Math.cos(bearing));
      const tx = THREE.MathUtils.lerp(boat.position.x + Math.sin(toBack) * 7, boat.position.x + fx * 7, swing);
      const tz = THREE.MathUtils.lerp(boat.position.z + Math.cos(toBack) * 7, boat.position.z + fz * 7, swing);
      this.shot.target.set(tx, THREE.MathUtils.lerp(3, 2.8, swing), tz);
      this.shot.distance = THREE.MathUtils.lerp(26, 24, swing);
      this.shot.height = THREE.MathUtils.lerp(4.5, 6.5, swing);
      this.pace = 1.2;
    } else {
      /**
       * Off the stern quarter, on whichever side the sail is not, and low enough to see the child's face and what
       * they are holding. Dead astern put the sail straight through them and showed nothing but their back.
       */
      this.quarter += (-boat.sailSide - this.quarter) * 0.02;
      const bearing = boat.yaw + Math.PI + this.quarter * 0.66;
      this.shot.from = this.from.set(Math.sin(bearing), 0, Math.cos(bearing));
      const seat = this.cast.child.position;
      this.shot.target.set(seat.x + fx * 2.5, seat.y + 1.15, seat.z + fz * 2.5);
      this.shot.distance = 15;
      this.shot.height = 3.4;
      this.pace = 0.4;
    }

    const whale = this.cast.sealife.whale;
    if (this.watching > 0 && whale) {
      this.shot.target.lerp(this.look.set(whale.x, Math.max(whale.y, 1.5), whale.z), this.watching * 0.08);
    }
    this.focus.copy(boat.position);
    this.escort.set(boat.position.x, 0, boat.position.z);
  }
}
