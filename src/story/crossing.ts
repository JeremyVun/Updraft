import * as THREE from 'three';
import { tuning } from '../tuning';
import { swellLift } from '../world/water/swell';
import type { Mood } from '../audio/audio';
import type { Shot } from '../camera';
import type { Cast, Chapter } from './cast';
import { roundedWaypoint } from '../traveller/navigation';

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
  /** Which room's music the crossing is played to; the open sea by default. */
  music?: Mood;
  /** How far through the year the crossing is: between the room behind them and the one ahead. */
  season?: number;
  /** What the child rides facing and waves at as it falls astern, or nothing to face the way ahead throughout. */
  lookBack?: THREE.Vector3 | null;
  farewell?: number;
  rainbow?: boolean;
  /** When the whale comes up ahead, or nothing for a crossing without one. */
  whaleAt?: number | null;
  /** How often it comes up again after that, for a crossing long enough to want a second one. */
  whaleEvery?: number;
  /** A pod runs with the boat the whole way. */
  dolphins?: boolean;
  /** Haze thick enough to hide where they are going, 0 to 1. */
  haze?: number;
  dusk?: number;
  /** Where the time of day ends up, if this crossing is long enough to change it: the last one ends the night. */
  duskTo?: number;
  /** The winter storm, 0 calm to 1: the short hop into the wood is sailed through the worst of it. */
  storm?: number;
  /** How far along the route the cygnet takes to the water by itself, for the one crossing where it does. */
  swimAt?: number;
  /** A jetty to come alongside at the end instead of a beach to run up. */
  moor?: { x: number; z: number; yaw: number };
}

/** How long it stands on the side of the boat making up its mind, how long it swims, and how long it dries off on the side afterwards. */
const ON_THE_SIDE = 7;
const SWIM_FOR = tuning.seaPassage.swimFor;
const DRYING = 3.2;
/** How far along the route it is back in the child's arms at the latest, dried, well before the jetty. */
const SWIM_ENDS_BY = 0.84;
/** How far behind the boat it can fall before the boat is made to wait for it. Nothing is ever left behind. */
const WAIT_FOR_IT = 6.5;

/**
 * A crossing. The boat follows its waypoints and the player fills the sail; the child looks back at whatever is
 * falling astern, then ahead into the haze. Ends when the bow runs up the far beach. Each crossing after the first
 * is shorter and hazier than the last, so the world closes in and every island arrives without warning.
 */
export class CrossingChapter implements Chapter {
  readonly breeze = 1;
  readonly worldLife = 1;
  pace = 0.4;
  dusk: number;
  readonly haze: number;
  readonly storm: number;
  shower: number;
  rainbow = 0;
  readonly shot: Shot = { target: new THREE.Vector3(), distance: 24, height: 6.5, carry: true };
  readonly focus = new THREE.Vector3();
  readonly escort = new THREE.Vector3();
  readonly music: Mood;
  readonly season: number;
  private readonly route: THREE.Vector2[];
  private readonly lookBack: THREE.Vector3 | null;
  private readonly farewellFor: number;
  private readonly wantsRainbow: boolean;
  private readonly whaleAt: number | null;
  private readonly whaleEvery: number;
  private readonly wantsDolphins: boolean;
  private readonly duskFrom: number;
  private readonly duskTo: number;
  private nextWhale = 0;
  private readonly seat = new THREE.Vector3();
  private readonly ahead = new THREE.Vector3();
  private readonly from = new THREE.Vector3();
  private readonly spot = new THREE.Vector3();
  private readonly look = new THREE.Vector3();
  private time = 0;
  private worldTime = 0;
  private seaTurn = 0;
  private swimFrame = 0;
  private readonly framing = new THREE.Vector3();
  private readonly spans: number[] = [];
  private readonly distances: number[] = [];
  private routeLength = 0;
  private facingBack = 0;
  private nextWave = 3.5;
  private whaleCalled = false;
  private watching = 0;
  private leg = 0;
  private readonly departure = new THREE.Vector2();
  /** Which side of the stern the camera rides on; eased, so it never snaps across when the boom swings. */
  private quarter = 1;
  private nextGlance = 8;
  private glanceUntil = 0;
  private readonly swimAt: number | null;
  private swim: 'before' | 'restless' | 'side' | 'in' | 'drying' | 'done' = 'before';
  private swimT = 0;
  private swimSide = 1;
  private readonly beside = new THREE.Vector3();
  private readonly water = new THREE.Vector3();

  constructor(
    private readonly cast: Cast,
    opts: CrossingOpts,
  ) {
    this.route = opts.route;
    this.departure.set(cast.boat.position.x, cast.boat.position.z);
    cast.boat.speedLimit = Infinity;
    this.music = opts.music ?? 'sea';
    this.season = opts.season ?? 0.3;
    this.lookBack = opts.lookBack ?? null;
    this.farewellFor = this.lookBack ? (opts.farewell ?? 30) : 0;
    this.wantsRainbow = opts.rainbow ?? false;
    this.whaleAt = opts.whaleAt ?? null;
    this.whaleEvery = opts.whaleEvery ?? 0;
    this.wantsDolphins = opts.dolphins ?? false;
    if (this.wantsDolphins) {
      cast.boat.speedLimit = tuning.seaPassage.speed;
      this.quarter = -cast.boat.sailSide || 1;
      // The near encounter fits a portrait frame; preserving the whole pod would miniaturise the travellers.
      this.shot.fitWidth = false;
    }
    let prev = this.departure;
    for (const point of this.route) {
      const span = prev.distanceTo(point);
      this.distances.push(this.routeLength);
      this.spans.push(span); this.routeLength += span; prev = point;
    }
    this.haze = opts.haze ?? 0;
    this.duskFrom = opts.dusk ?? 0;
    this.duskTo = opts.duskTo ?? this.duskFrom;
    this.dusk = this.duskFrom;
    this.storm = opts.storm ?? 0;
    this.shower = this.storm > 0 ? Math.max(0, this.storm - 0.2) * 1.25 : 0;
    this.nextWhale = this.whaleAt ?? 0;
    this.swimAt = opts.swimAt ?? null;
    if (this.wantsDolphins) cast.sealife.onDolphinShove = (side, strength) => cast.boat.nudge(side, strength);
    cast.boat.becalmed = 0;
    cast.boat.steerFor = this.route[0];
    cast.boat.mooring = opts.moor ?? null;
    cast.boat.canGround = this.route.length === 1 && !opts.moor;
    cast.boat.grounded = false;
    cast.plane.homeRadius = 1e9;
  }

  get openSea(): number {
    return this.wantsDolphins ? 1 - THREE.MathUtils.smoothstep(this.progress(), 0.76, 0.94) : 0;
  }

  get done(): boolean {
    return this.cast.boat.grounded;
  }

  get checkpoint(): string | null { return this.swim === 'done' ? 'swim' : null; }
  saveCheckpoint(): number[] { return [this.leg, this.time]; }
  restoreCheckpoint(_point: string, data: number[]): void {
    this.leg = THREE.MathUtils.clamp(Math.floor(data[0]), 0, this.route.length - 1);
    if (this.wantsDolphins) {
      // The offshore route was lengthened. Resume old swim saves on the nearest onward waypoint.
      let nearest = Infinity;
      this.route.forEach((point, index) => {
        const gap = Math.hypot(point.x - this.cast.boat.position.x, point.y - this.cast.boat.position.z);
        if (gap < nearest) { nearest = gap; this.leg = index; }
      });
      this.cast.boat.speedLimit = tuning.seaPassage.speed;
    }
    this.time = data[1]; this.swim = 'done';
    this.cast.boat.steerFor = this.route[this.leg];
    this.cast.boat.canGround = this.leg === this.route.length - 1 && !this.cast.boat.mooring;
  }

  /** Steers waypoint to waypoint; only the last leg, out in open water, may run the bow ashore. */
  private steer(): void {
    const { boat } = this.cast;
    const wp = this.route[this.leg];
    const from = this.leg === 0 ? this.departure : this.route[this.leg - 1];
    if (this.leg < this.route.length - 1 && roundedWaypoint(boat.position.x, boat.position.z, from.x, from.y, wp.x, wp.y, ROUNDED)) {
      this.leg++;
      boat.steerFor = this.route[this.leg];
      boat.canGround = this.leg === this.route.length - 1 && !boat.mooring;
    }
  }

  update(dt: number, time = this.time + dt): void {
    this.time += dt;
    this.worldTime = time;
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
    if (this.wantsDolphins) {
      const turnTo = -this.quarter * tuning.seaPassage.childTurn;
      this.seaTurn += (turnTo - this.seaTurn) * (1 - Math.exp(-dt * 1.1));
      seatYaw += this.seaTurn;
    }
    child.ride(boat.seat(this.seat), seatYaw, boat.roll, boat.pitch);
    plane.hold(child);

    if (farewell && back) {
      child.lookAt = back;
      if (this.time > this.nextWave) {
        child.wave();
        this.nextWave = this.time + 5 + Math.random() * 3;
      }
    } else if (this.time < this.glanceUntil) {
      /** Long stretches of open water, and something small in your arms: of course you look down at it. */
      child.lookAt = this.cast.cygnet.carried ? this.cast.cygnet.eye(this.ahead) : null;
    } else {
      const look = Math.sin(this.time * 0.13) * 30;
      this.ahead.set(boat.position.x + look, 12, boat.position.z - 200);
      child.lookAt = this.ahead;
      if (this.time > this.nextGlance && this.cast.cygnet.carried) {
        this.glanceUntil = this.time + 3.5 + Math.random() * 2.5;
        this.nextGlance = this.glanceUntil + 9 + Math.random() * 8;
      }
    }

    if (this.whaleAt !== null && this.time > this.nextWhale && (!this.whaleCalled || this.whaleEvery > 0)) {
      this.whaleCalled = true;
      this.nextWhale = this.whaleEvery > 0 ? this.time + this.whaleEvery : 1e9;
      const fx0 = Math.sin(boat.yaw);
      const fz0 = Math.cos(boat.yaw);
      const side = this.whaleEvery > 0 && Math.random() < 0.5 ? -1 : 1;
      this.spot.set(boat.position.x + fx0 * 58 - fz0 * 17 * side, 0, boat.position.z + fz0 * 58 + fx0 * 17 * side);
      sealife.surfaceWhale(this.spot, boat.yaw - 0.3 * side);
    }
    sealife.fishNear(boat.position, this.wantsDolphins ? 0.15 : farewell ? 0.25 : 1);
    /** The camera rides the quarter away from the sail, and the cygnet's swim is the one thing they must not crowd. */
    const swimming = this.swim === 'restless' || this.swim === 'side' || this.swim === 'in' || this.swim === 'drying';
    const withPod = this.wantsDolphins && (this.progress() < tuning.seaPassage.farewellAt || this.swim !== 'done');
    sealife.dolphinsWith(withPod ? boat.position : null, boat.yaw, -this.quarter, swimming);
    /** The night ends somewhere out here, by degrees, with nobody watching for it. */
    if (this.duskTo !== this.duskFrom) {
      this.dusk = THREE.MathUtils.lerp(this.duskFrom, this.duskTo, this.progress());
    }
    const whale = sealife.whale;
    if (whale && !farewell) child.lookAt = whale;
    this.watching = whale && !farewell ? Math.min(1, this.watching + dt * 0.5) : Math.max(0, this.watching - dt * 0.5);
    const show = sealife.dolphinShow;
    if (show && !whale && !farewell && !swimming) {
      child.lookAt = show;
      if (this.wantsDolphins) this.cast.cygnet.watch(show);
    } else if (this.wantsDolphins && !swimming) this.cast.cygnet.watch(null);

    if (this.swimAt !== null) this.braveSwim(dt);

    const wanted = this.wantsRainbow && this.time < RAINBOW_FOR ? 1 : 0;
    this.rainbow += (wanted - this.rainbow) * (1 - Math.exp(-dt * (wanted > this.rainbow ? 0.3 : 0.06)));

    this.swimFrame += ((swimming ? 1 : 0) - this.swimFrame) * (1 - Math.exp(-dt * 0.65));
    this.frame(back);
  }

  /**
   * The cygnet's own brave thing. The child went into the dark first so that it would not have to; out here in the
   * morning, with the child watching and doing nothing but staying, it goes into the water by itself. The player is
   * the wind in the sail, so how hard they blow is how hard it has to swim, and the boat will always wait.
   */
  private braveSwim(dt: number): void {
    const { child, boat, cygnet, carry } = this.cast;
    this.swimT += dt;
    const left = this.from.set(Math.cos(boat.yaw), 0, -Math.sin(boat.yaw));
    const seat = boat.seat(this.seat);
    /** Where it stands on the side of the boat, and the water beside that: on the side the camera is on. */
    this.beside.copy(seat).addScaledVector(left, this.swimSide * 0.82).setY(boat.position.y + 0.1);
    this.water.copy(seat).addScaledVector(left, this.swimSide * tuning.seaPassage.swimBeside).setY(0);
    const to = (next: typeof this.swim) => {
      this.swim = next;
      this.swimT = 0;
    };
    if (this.swim === 'before') {
      if (this.progress() > this.swimAt! && cygnet.seat === 'cradle' && !carry.busy) {
        this.swimSide = this.quarter > 0 ? -1 : 1;
        to('restless');
      }
    } else if (this.swim === 'restless') {
      /** It has been looking over the side since the first crossing. This time it does not look away. */
      boat.speedLimit = tuning.seaPassage.swimSpeed;
      cygnet.watch(this.water);
      child.lookAt = cygnet.eye(this.ahead);
      if (this.swimT > 5) to('side');
    } else if (this.swim === 'side') {
      cygnet.perch(this.beside, boat.yaw + (this.swimSide * Math.PI) / 2);
      /** The water, then the child, then the water. The child does nothing at all, which is the right thing. */
      cygnet.watch(this.swimT % 3.2 < 1.9 ? this.water : child.face(this.look));
      child.lookAt = cygnet.eye(this.ahead);
      if (this.swimT > ON_THE_SIDE) {
        cygnet.watch(null);
        to('in');
      }
    } else if (this.swim === 'in') {
      cygnet.swimLevel = swellLift(cygnet.position.x, cygnet.position.z, this.worldTime);
      cygnet.swimTo(this.water);
      this.cast.sealife.swimmerNear(cygnet.position, this.worldTime);
      child.lookAt = cygnet.position;
      /** Too much wind and the boat draws ahead of it; before it is left behind, the boat waits. */
      const behind = cygnet.astern;
      boat.speedLimit = behind > 2.8 ? 0.65 : tuning.seaPassage.swimSpeed;
      boat.becalmed += ((behind > WAIT_FOR_IT ? 0.9 : behind > 3.5 ? 0.45 : 0.15) - boat.becalmed) * (1 - Math.exp(-dt * 0.8));
      /** An arm hung over the side near it, whenever it is near enough for that to mean anything. */
      const hand = this.swimSide > 0 ? 0 : 1;
      if (behind < 1.6) child.reachFor(hand, this.look.copy(cygnet.position).setY(0.35).lerp(this.beside, 0.55));
      else child.reachFor(hand, null);
      if ((this.swimT > SWIM_FOR && behind < 2.3) || this.progress() > SWIM_ENDS_BY) {
        child.reachFor(hand, null);
        cygnet.bind(0.25);
        cygnet.mind.trust(0.7);
        to('drying');
      }
    } else if (this.swim === 'drying') {
      /** Back up onto the side in a flurry, shaken out from bill to tail, and then into the arms, soaked and proud. */
      cygnet.perch(this.beside, boat.yaw - (this.swimSide * Math.PI) / 2);
      boat.becalmed += (0 - boat.becalmed) * (1 - Math.exp(-dt * 0.6));
      child.lookAt = cygnet.eye(this.ahead);
      if (this.swimT > DRYING) {
        cygnet.rideIn('cradle');
        to('done');
      }
    } else {
      boat.becalmed += (0 - boat.becalmed) * (1 - Math.exp(-dt * 0.6));
      if (this.wantsDolphins) boat.speedLimit = tuning.seaPassage.speed;
    }
  }

  /** How much of the route is behind them, 0 to 1. */
  private progress(): number {
    const wp = this.route[this.leg];
    const { boat } = this.cast;
    const completed = this.distances[this.leg];
    const remaining = Math.hypot(boat.position.x - wp.x, boat.position.z - wp.y);
    return THREE.MathUtils.clamp((completed + Math.max(0, this.spans[this.leg] - remaining)) / Math.max(1, this.routeLength), 0, 1);
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
      if (!this.wantsDolphins) this.quarter += (-boat.sailSide - this.quarter) * 0.02;
      const bearing = boat.yaw + Math.PI + this.quarter * (this.wantsDolphins ? tuning.seaPassage.cameraBearing : 0.66);
      this.shot.from = this.from.set(Math.sin(bearing), 0, Math.cos(bearing));
      const seat = this.cast.child.position;
      this.shot.target.set(seat.x + fx * 2.5, seat.y + 1.15, seat.z + fz * 2.5);
      this.shot.distance = 15;
      this.shot.height = 3.4;
      this.pace = 0.4;
      if (this.wantsDolphins) {
        // Hold the boat and the near water together, leaving breathing room around whole animals.
        this.shot.target.set(boat.position.x - fz * this.quarter * 1.5 + fx,
          boat.position.y + 0.9, boat.position.z + fx * this.quarter * 1.5 + fz);
        this.framing.copy(this.cast.cygnet.position).lerp(this.cast.child.position, 0.55);
        this.shot.target.lerp(this.framing, this.swimFrame * 0.8);
        this.shot.distance = THREE.MathUtils.lerp(tuning.seaPassage.cameraDistance, tuning.seaPassage.swimCameraDistance, this.swimFrame);
        this.shot.height = THREE.MathUtils.lerp(tuning.seaPassage.cameraHeight, tuning.seaPassage.swimCameraHeight, this.swimFrame);
        this.pace = 0.7;
      }
    }

    const whale = this.cast.sealife.whale;
    if (this.watching > 0 && whale) {
      this.shot.target.lerp(this.look.set(whale.x, Math.max(whale.y, 1.5), whale.z), this.watching * 0.08);
    }
    this.focus.copy(boat.position);
    this.escort.set(boat.position.x, 0, boat.position.z);
  }
}
