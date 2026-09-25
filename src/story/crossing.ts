import type { MirrorScorePhase } from '../audio/dream-score';
import type { CheckpointPayload } from './checkpoint-data';
import * as THREE from 'three';
import { tuning } from '../tuning';
import { swellLift } from '../world/water/swell';
import type { Mood } from '../audio/audio';
import type { SeaScorePhase } from '../audio/sea-score';
import type { LinesScorePhase } from '../audio/lines-score';
import type { MeadowScorePhase } from '../audio/meadow-score';
import type { ArrivalMusic } from '../audio/arrival-music';
import type { Shot } from '../camera';
import type { Cast, Chapter } from './cast';
import { roundedWaypoint } from '../traveller/navigation';
import { HOME_JETTY } from '../world/home-layout';
import { mirrorWater } from '../world/sky-mirror-layout';

/** The beach on the meadow's south shore, where the boat first comes ashore on the mainland-sized island. */
export const LANDING = new THREE.Vector2(10, -600);
/** Line up offshore with the hill path before turning into the bay, rather than beaching diagonally east of it. */
export const MEADOW_APPROACH = new THREE.Vector2(LANDING.x, -548);

/** The restored still island, as the child looks back at it from the first crossing. */
export const FIRST_ISLAND = new THREE.Vector3(-8, 9, -18);

/** How near a waypoint counts as rounded. */
const ROUNDED = 22;
/** How long a rainbow lingers once the boat sets out. */
const RAINBOW_FOR = 70;
/** How quickly the lens catches up with route progress, which jumps when a waypoint is passed early in its channel. */
const FRAMED_RESPONSE = 1.2;
/** How long the camera takes to swing round from the farewell to behind the sail. */
const SWING = tuning.crossingCamera.farewellRelease;

export interface CrossingOpts {
  /** Ambient breeze multiplier; ordinary transfers use 1 and encounters retain their own slower pace. */
  breeze?: number;
  speed?: number;
  /** Waypoints out to open water and on to the far shore; the bow may only ground on the last one. */
  route: THREE.Vector2[];
  /** Limit the final alignment and beach approach where the landing sits beside a narrow walking route. */
  arrivalSpeed?: number;
  /** Carry the departing room's music; dolphin passages use the open-sea arrangement. */
  music?: Mood;
  mirrorScore?: MirrorScorePhase;
  linesScore?: LinesScorePhase;
  meadowScore?: MeadowScorePhase;
  hush?: number;
  arrivalMusic?: ArrivalMusic;
  /** A different offshore composition, introduced after leaving the preceding island's music. */
  departureMusic?: ArrivalMusic;
  /** Start the final musical handoff on departure, opening after the mirror's first offshore turn. */
  homeward?: boolean;
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
  /** Thicken the shared distance haze toward shore, after releasing any look back at the departure. */
  arrivalHaze?: { strength: number; from: number; to: number };
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
const ON_THE_SIDE = tuning.seaPassage.swimDecision;
const SWIM_FOR = tuning.seaPassage.swimFor;
const DRYING = 3.2;
/** How far along the route it is back in the child's arms at the latest, dried, well before the jetty. */
const SWIM_ENDS_BY = 0.84;
/** How far behind the boat it can fall before the boat is made to wait for it. Nothing is ever left behind. */
const WAIT_FOR_IT = 6.5;

/**
 * A crossing. The boat follows its waypoints and the player fills the sail; the child looks back at whatever is
 * falling astern, then ahead into the haze. Ends at the far beach or mooring. Routes and haze shape each
 * island reveal; ordinary transfers share the same sail response.
 */
export class CrossingChapter implements Chapter {
  readonly breeze: number;
  readonly worldLife = 1;
  pace = 0.4;
  dusk: number;
  private readonly departureHaze: number;
  private readonly arrivalHaze?: CrossingOpts['arrivalHaze'];
  readonly storm: number;
  shower: number;
  rainbow = 0;
  readonly shot: Shot = { target: new THREE.Vector3(), distance: 24, height: 6.5, carry: true };
  readonly focus = new THREE.Vector3();
  readonly escort = new THREE.Vector3();
  readonly music: Mood;
  private readonly homeward: boolean;
  readonly mirrorScore?: MirrorScorePhase;
  readonly linesScore?: LinesScorePhase;
  readonly meadowScore?: MeadowScorePhase;
  readonly hush: number;
  private readonly destinationMusic?: ArrivalMusic;
  private readonly departureMusic?: ArrivalMusic;
  private arrivalHeard = false;
  readonly season: number;
  private readonly route: THREE.Vector2[];
  private readonly arrivalSpeed: number;
  private readonly cruiseSpeed: number;
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
  /** Route progress as the camera and the child's gaze follow it: continuous, even when the real value jumps. */
  private framed = -1;
  private framedSpeed = 0;
  private readonly framing = new THREE.Vector3();
  private readonly whaleAttention = { point: new THREE.Vector3(), strength: 0,
    weight: tuning.crossingCamera.whaleWeight, bearing: 0, distance: 0, height: 0 };
  private readonly whaleOffset = new THREE.Vector3();
  private readonly farewellAttention = { point: new THREE.Vector3(), strength: 0,
    weight: tuning.crossingCamera.farewellWeight };
  private readonly whaleRight = new THREE.Vector3();
  private readonly whaleSubjects = { primary: new THREE.Vector3(), secondary: new THREE.Vector3(),
    tertiary: new THREE.Vector3(), margin: 0.8, extra: 60 };
  private readonly sailingSubjects = { primary: new THREE.Vector3(), secondary: new THREE.Vector3(), margin: 0.8, extra: 14 };
  private readonly farewellBounds = Array.from({ length: 6 }, () => new THREE.Vector3());
  private readonly farewellSubjects = { primary: this.sailingSubjects.primary, secondary: this.sailingSubjects.secondary,
    tertiary: new THREE.Vector3(), points: this.farewellBounds, margin: 0.8, extra: 40 };
  private readonly swimSubjects = { primary: new THREE.Vector3(), secondary: new THREE.Vector3(), margin: 0.72, extra: 18 };
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
  /** The sea passage's speed cap, eased so the boat is never braked, and how far the swim's own cap has come in. */
  private limit: number;
  private swimCap = 0;
  private readonly homeEye = new THREE.Vector3();
  private readonly dockEye = new THREE.Vector3();

  constructor(
    private readonly cast: Cast,
    opts: CrossingOpts,
  ) {
    this.route = opts.route;
    this.breeze = opts.breeze ?? 1;
    this.arrivalSpeed = opts.arrivalSpeed ?? Infinity;
    this.cruiseSpeed = opts.speed ?? (opts.dolphins ? tuning.seaPassage.speed : Infinity);
    this.limit = this.cruiseSpeed;
    this.departure.set(cast.boat.position.x, cast.boat.position.z);
    this.shot.carryAnchor = cast.boat.position;
    this.quarter = -cast.boat.sailSide || 1;
    cast.boat.speedLimit = this.cruiseSpeed;
    this.music = opts.music ?? 'sea';
    this.homeward = opts.homeward ?? false;
    this.departureMusic = opts.departureMusic;
    this.mirrorScore = opts.mirrorScore;
    this.linesScore = opts.linesScore;
    this.meadowScore = opts.meadowScore;
    this.hush = opts.hush ?? 0;
    this.destinationMusic = opts.arrivalMusic;
    this.season = opts.season ?? 0.3;
    this.lookBack = opts.lookBack ?? null;
    this.farewellFor = this.lookBack ? (opts.farewell ?? 30) : 0;
    this.wantsRainbow = opts.rainbow ?? false;
    this.whaleAt = opts.whaleAt ?? null;
    this.whaleEvery = opts.whaleEvery ?? 0;
    this.wantsDolphins = opts.dolphins ?? false;
    if (this.wantsDolphins) {
      cast.boat.speedLimit = this.cruiseSpeed;
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
    this.departureHaze = opts.haze ?? 0;
    this.arrivalHaze = opts.arrivalHaze;
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

  private podLeftAt: number | null = null;
  /** When the light came and the pod's play could begin: its leap, the swim and the nudge take about as long every time. */
  private playFrom: number | null = null;
  /** The quiet water appears as the last dolphins finish diving, before the landing handoff. */
  get mirrorArrival(): number | undefined {
    if (!this.wantsDolphins) return undefined;
    return this.podLeftAt === null ? 0 : THREE.MathUtils.smoothstep(this.time - this.podLeftAt,
      tuning.dolphins.departureFor, tuning.dolphins.departureFor + tuning.skyMirror.arrivalBlendFor);
  }

  get openSea(): number {
    if (this.homeward) return 1;
    return this.wantsDolphins ? 1 - THREE.MathUtils.smoothstep(this.progress(), 0.76, 0.94) : 0;
  }

  get haze(): number {
    if (this.homeward) {
      const k = tuning.homeApproach, shore = this.route[this.route.length - 1], boat = this.cast.boat.position;
      const gap = Math.hypot(boat.x - shore.x, boat.z - shore.y);
      return THREE.MathUtils.lerp(k.dockHaze, this.departureHaze,
        THREE.MathUtils.smootherstep(gap, k.clearAt, k.clearFrom));
    }
    const arrival = this.arrivalHaze;
    if (!arrival) return this.departureHaze;
    const shore = this.route[this.route.length - 1], boat = this.cast.boat.position;
    const distance = Math.hypot(boat.x - shore.x, boat.z - shore.y);
    const approach = 1 - THREE.MathUtils.smootherstep(distance, arrival.to, arrival.from);
    const released = this.lookBack
      ? THREE.MathUtils.smootherstep(this.time, this.farewellFor, this.farewellFor + SWING) : 1;
    return THREE.MathUtils.lerp(this.departureHaze, arrival.strength, approach * released);
  }

  get hazeFalloff(): number {
    return this.homeward ? tuning.homeApproach.falloff : 1;
  }

  get done(): boolean {
    // A fast sail can reach the jetty during the last seconds of the reflection fade.
    return this.cast.boat.grounded && (!this.wantsDolphins || this.mirrorArrival === 1);
  }

  get arrivalMusic(): ArrivalMusic | undefined { return this.homeward || this.arrivalHeard ? this.destinationMusic : this.departureMusic; }

  get arrivalReady(): boolean | undefined {
    if (this.homeward || !this.destinationMusic) return undefined;
    if (this.departureMusic && !this.arrivalHeard) return true;
    if (this.lookBack && this.time < this.farewellFor + SWING * .8) return false;
    const speed=Math.max(4.5,Math.min(this.cast.boat.speed,this.arrivalSpeed));
    const lead=tuning.audio.arrivalShoreAllowance+tuning.audio.arrivalEntranceLead*speed;
    return this.cast.boat.grounded || this.remainingSail()<=Math.min(lead,this.routeLength*tuning.audio.arrivalEntranceRouteShare);
  }

  get homewardReady(): boolean | undefined {
    if (!this.homeward) return undefined;
    const { position, grounded } = this.cast.boat;
    return grounded || (this.leg > 0 && Math.hypot(position.x-this.departure.x,position.z-this.departure.y)
      >= tuning.audio.homewardClearDistance);
  }

  /** Remaining sailing distance, not straight-line proximity across an intervening island. */
  private remainingSail(): number {
    const target=this.route[this.leg];
    return Math.hypot(this.cast.boat.position.x-target.x,this.cast.boat.position.z-target.y)
      +this.routeLength-this.distances[this.leg]-this.spans[this.leg];
  }

  private prepareArrivalMusic(): void {
    if (!this.destinationMusic || this.arrivalHeard) return;
    if (this.wantsDolphins && (this.swim !== 'done' || this.podLeftAt === null)) return;
    const remaining = this.remainingSail();
    // A fast sail still slows at the meadow bank; use that approach speed so the rest doesn't begin offshore.
    const speed=Math.max(4.5,Math.min(this.cast.boat.speed,this.arrivalSpeed));
    const lead = tuning.audio.arrivalShoreAllowance + tuning.audio.arrivalMusicLead * speed;
    if (remaining <= Math.min(lead, this.routeLength * tuning.audio.arrivalMusicRouteShare)) {
      this.arrivalHeard = true;
    }
  }

  get seaScore(): SeaScorePhase | undefined {
    if (!this.wantsDolphins) return undefined;
    if (this.swim !== 'before' && this.swim !== 'done') return 'swim';
    if (this.podLeftAt !== null) return 'arrival';
    return this.swim === 'done' ? 'return' : 'open';
  }

  get checkpoint(): string | null { return this.swim === 'done' ? 'swim' : null; }
  saveCheckpoint(): CheckpointPayload<'crossing'> { return [this.leg, this.time]; }
  restoreCheckpoint(_point: string, data: number[]): void {
    this.leg = THREE.MathUtils.clamp(Math.floor(data[0]), 0, this.route.length - 1);
    if (this.wantsDolphins) {
      // Resume the swim checkpoint on the nearest onward waypoint without replaying the leap.
      this.cast.sealife.resumeDolphinsAfterSwim();
      let nearest = Infinity;
      this.route.forEach((point, index) => {
        const gap = Math.hypot(point.x - this.cast.boat.position.x, point.y - this.cast.boat.position.z);
        if (gap < nearest) { nearest = gap; this.leg = index; }
      });
      this.cast.boat.speedLimit = this.limit = this.cruiseSpeed;
    }
    this.time = data[1]; this.swim = 'done';
    this.cast.boat.steerFor = this.route[this.leg];
    this.cast.boat.canGround = this.leg === this.route.length - 1 && !this.cast.boat.mooring;
    this.prepareArrivalMusic();
  }

  /** Steers waypoint to waypoint; only the last leg, out in open water, may run the bow ashore. */
  private steer(): void {
    const { boat } = this.cast;
    const wp = this.route[this.leg];
    const from = this.leg === 0 ? this.departure : this.route[this.leg - 1];
    if (this.leg < this.route.length - 1 && roundedWaypoint(boat.position.x, boat.position.z, from.x, from.y, wp.x, wp.y, this.wantsDolphins ? tuning.seaPassage.waypointRadius : ROUNDED)) {
      this.leg++;
      boat.steerFor = this.route[this.leg];
      boat.canGround = this.leg === this.route.length - 1 && !boat.mooring;
    }
    if (this.leg >= this.route.length - 2) boat.speedLimit = Math.min(boat.speedLimit, this.arrivalSpeed);
  }

  update(dt: number, time = this.time + dt): void {
    this.time += dt;
    this.worldTime = time;
    this.steer();
    this.followProgress(dt);
    this.prepareArrivalMusic();
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
    } else {
      const k = tuning.crossingCamera, progress = this.framed;
      const near = THREE.MathUtils.smootherstep(progress, 0, k.departureUntil)
        * (1 - THREE.MathUtils.smootherstep(progress, k.arrivalFrom, 1)) * (1 - turn);
      this.seaTurn += (-this.quarter * k.childTurn * near - this.seaTurn) * (1 - Math.exp(-dt * 1.1));
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
    const withPod = this.wantsDolphins && this.time >= tuning.seaPassage.dolphinsAfter
      && (this.progress() < tuning.seaPassage.farewellAt || this.swim !== 'done' || !sealife.dolphinFarewellReady);
    if (this.wantsDolphins && !withPod && this.swim === 'done' && this.podLeftAt === null) this.podLeftAt = this.time;
    // The nudge may begin its approach, under water, while the cygnet is climbing back aboard. The first leap
    // waits for the light: the sleeping island's night lifts only once it is well astern.
    const light = this.progress() >= tuning.seaPassage.leapFrom;
    sealife.dolphinsWith(withPod ? boat.position : null, boat.yaw, -this.quarter, swimming && this.swim !== 'drying', light);
    if (this.wantsDolphins && withPod && light && this.playFrom === null) this.playFrom = this.time;
    /** The night ends somewhere out here, by degrees, with nobody watching for it. */
    if (this.duskTo !== this.duskFrom) {
      this.dusk = THREE.MathUtils.lerp(this.duskFrom, this.duskTo, this.progress());
    }
    const whale = sealife.whale;
    const show = sealife.dolphinShow;
    if (whale) this.whaleOffset.subVectors(whale, boat.position);
    /** A dolphin playing right at the boat takes the eyes, and the lens, from a whale far off. */
    const distant = whale !== null && !farewell && !show;
    if (distant) child.lookAt = whale;
    this.watching = distant ? Math.min(1, this.watching + dt * 0.5) : Math.max(0, this.watching - dt * 0.5);
    if (show && !farewell && !swimming) {
      child.lookAt = show;
      if (this.wantsDolphins) this.cast.cygnet.watch(show);
    } else if (this.wantsDolphins && !swimming) this.cast.cygnet.watch(null);

    if (this.swimAt !== null) this.braveSwim(dt);
    if (this.wantsDolphins) this.paceSea(dt, swimming);

    const wanted = this.wantsRainbow && this.time < RAINBOW_FOR ? 1 : 0;
    this.rainbow += (wanted - this.rainbow) * (1 - Math.exp(-dt * (wanted > this.rainbow ? 0.3 : 0.06)));

    this.swimFrame += ((swimming ? 1 : 0) - this.swimFrame) * (1 - Math.exp(-dt * 0.65));
    if (!this.wantsDolphins) this.quarter += (-boat.sailSide - this.quarter)
      * (1 - Math.exp(-dt * tuning.crossingCamera.sideResponse));
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
      if (this.cast.sealife.dolphinLeapComplete && this.time >= tuning.seaPassage.swimNotBefore && this.progress() > this.swimAt! && cygnet.seat === 'cradle' && !carry.busy) {
        this.swimSide = this.quarter > 0 ? -1 : 1;
        to('restless');
      }
    } else if (this.swim === 'restless') {
      /** It has been looking over the side since the first crossing. This time it does not look away. */
      cygnet.watch(this.water);
      child.lookAt = cygnet.eye(this.ahead);
      if (this.swimT > tuning.seaPassage.swimAnticipation) to('side');
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
      cygnet.swimLevel = swellLift(cygnet.position.x, cygnet.position.z, this.worldTime)
        * (1 - mirrorWater(cygnet.position.x, cygnet.position.z));
      cygnet.swimTo(this.water);
      /** The boat sails on; the wave along its side carries the cygnet, which paddles only to keep its place in it. */
      const carry = boat.speed * tuning.seaPassage.swimCarry;
      cygnet.swimCarry.set(Math.sin(boat.yaw) * carry, Math.cos(boat.yaw) * carry);
      this.cast.sealife.swimmerNear(cygnet.position, this.worldTime);
      child.lookAt = cygnet.position;
      /** If it ever falls behind anyway, the boat spills its wind and waits. Nothing is ever left behind. */
      const behind = cygnet.astern;
      boat.becalmed += ((behind > WAIT_FOR_IT ? 0.9 : behind > 3.5 ? 0.45 : 0) - boat.becalmed) * (1 - Math.exp(-dt * 0.8));
      /** An arm hung over the side near it, whenever it is near enough for that to mean anything. */
      const hand = this.swimSide > 0 ? 0 : 1;
      if (behind < 1.6) child.reachFor(hand, this.look.copy(cygnet.position).setY(0.35).lerp(this.beside, 0.55));
      else child.reachFor(hand, null);
      if (this.swimT > SWIM_FOR && (behind < 2.3 || this.progress() > SWIM_ENDS_BY)) {
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
    }
  }

  /**
   * How fast the sea passage lets the boat sail. The pod's play takes about as long every time and the water it
   * has is fixed, so the boat settles, by degrees over the open stretch, into the pace that fits one to the other,
   * and keeps it; the swim trims only a strong gust; and only a pod still playing when the coast comes near holds
   * the boat back. The cap eases, so the boat is never braked.
   */
  private paceSea(dt: number, swimming: boolean): void {
    const k = tuning.seaPassage;
    let limit = this.leg >= this.route.length - 2 ? Math.min(this.cruiseSpeed, this.arrivalSpeed) : this.cruiseSpeed;
    if (this.podLeftAt === null) {
      const progress = this.progress();
      const ahead = (k.farewellAt - progress) * this.routeLength;
      const pace = Math.max(k.leastSpeed, (k.farewellAt - k.leapFrom) * this.routeLength / k.playFor);
      if (this.playFrom === null) {
        limit = Math.min(limit, THREE.MathUtils.lerp(k.openSpeed, pace, THREE.MathUtils.smoothstep(progress, 0, k.leapFrom)));
      } else {
        const left = this.playFrom + k.playFor - this.time;
        if (ahead > 0 && left > 0) limit = Math.min(limit, Math.max(k.leastSpeed, ahead / left));
      }
      if (this.swim !== 'done' || !this.cast.sealife.dolphinFarewellReady) {
        limit = THREE.MathUtils.lerp(limit, Math.min(limit, k.holdSpeed), THREE.MathUtils.smoothstep(progress, k.farewellAt, k.holdAt));
      }
    }
    this.swimCap += ((swimming ? 1 : 0) - this.swimCap) * (1 - Math.exp(-dt * k.swimEase));
    limit = Math.min(limit, THREE.MathUtils.lerp(this.cruiseSpeed, k.swimSpeed, this.swimCap));
    this.limit += (limit - this.limit) * (1 - Math.exp(-dt * (limit < this.limit ? k.limitEase : 2)));
    this.cast.boat.speedLimit = this.limit;
  }

  /** A critically damped follower of `progress()`, so a sudden jump in it becomes a gentle catch-up. */
  private followProgress(dt: number): void {
    const actual = this.progress();
    if (this.framed < 0 || dt <= 0) { this.framed = actual; return; }
    const decay = Math.exp(-FRAMED_RESPONSE * dt);
    const error = this.framed - actual, spring = this.framedSpeed + FRAMED_RESPONSE * error;
    this.framed = actual + (error + spring * dt) * decay;
    this.framedSpeed = (this.framedSpeed - FRAMED_RESPONSE * spring * dt) * decay;
  }

  /** How much of the route is behind them, 0 to 1. */
  private progress(): number {
    const wp = this.route[this.leg];
    const { boat } = this.cast;
    const completed = this.distances[this.leg];
    const remaining = Math.hypot(boat.position.x - wp.x, boat.position.z - wp.y);
    return THREE.MathUtils.clamp((completed + Math.max(0, this.spans[this.leg] - remaining)) / Math.max(1, this.routeLength), 0, 1);
  }

  /** The mirror gives way to a low view across the boat, then the same seaward quarter used on the planks. */
  private frameHomeward(progress: number): void {
    const k = tuning.homeApproach, s = this.shot, boat = this.cast.boat.position;
    const child = this.cast.child.position, berth = this.route[this.route.length - 1];
    const gap = Math.hypot(boat.x - berth.x, boat.z - berth.y);
    const settle = 1 - THREE.MathUtils.smootherstep(gap, k.dockAt, k.dockFrom);
    const discover = THREE.MathUtils.smootherstep(progress, k.turnFrom, k.turnTo);
    const bearing = THREE.MathUtils.lerp(k.departureBearing, Math.atan2(k.dockEyeX, k.dockEyeZ), discover);
    const notice = 1 - THREE.MathUtils.smootherstep(gap, k.noticeAt, k.noticeFrom);
    const lead = Math.min(k.lookAhead, gap * k.lookShare) * notice * (1 - settle);
    s.target.set(child.x + (berth.x - boat.x) / Math.max(gap, 1) * lead,
      THREE.MathUtils.lerp(child.y + 1.15, HOME_JETTY.deck + 1.1, settle),
      child.z + (berth.y - boat.z) / Math.max(gap, 1) * lead);
    this.homeEye.set(boat.x + Math.sin(bearing) * k.distance, boat.y + k.height,
      boat.z + Math.cos(bearing) * k.distance);
    this.dockEye.set(HOME_JETTY.x + k.dockEyeX, k.dockEyeY, HOME_JETTY.endZ + k.dockEyeZ);
    this.homeEye.lerp(this.dockEye, settle);
    s.eye = this.homeEye;
    s.orbit = true;
    s.distance = k.distance;
    s.height = k.height;
    this.pace = k.response;
  }

  /** Behind the sail, looking the way they are going; swung round to face what they are leaving, during a farewell. */
  private frame(back: THREE.Vector3 | null): void {
    const { boat } = this.cast;
    const k = tuning.crossingCamera;
    this.shot.eye = undefined;
    this.shot.orbit = undefined;
    this.shot.attention = undefined;
    this.shot.smoothFit = undefined;
    this.sailingSubjects.primary.copy(this.cast.child.position).y += 1.2;
    this.sailingSubjects.secondary.copy(boat.sailPoint(this.look));
    this.shot.subjects = this.wantsDolphins ? undefined : this.sailingSubjects;
    const fx = Math.sin(boat.yaw);
    const fz = Math.cos(boat.yaw);
    const progress = this.framed;
    const departure = 1 - THREE.MathUtils.smootherstep(progress, 0, k.departureUntil);
    const arrival = THREE.MathUtils.smootherstep(progress, k.arrivalFrom, 1);
    const distance = k.nearDistance + (k.departureDistance - k.nearDistance) * departure
      + (k.arrivalDistance - k.nearDistance) * arrival;
    const height = k.nearHeight + (k.departureHeight - k.nearHeight) * departure
      + (k.arrivalHeight - k.nearHeight) * arrival;
    const lead = k.nearLead + (k.departureLead - k.nearLead) * departure + (k.arrivalLead - k.nearLead) * arrival;
    const angle = k.nearBearing + (k.departureBearing - k.nearBearing) * departure
      + (k.arrivalBearing - k.nearBearing) * arrival;
    const sailBearing = boat.yaw + Math.PI + this.quarter * (this.wantsDolphins ? tuning.seaPassage.cameraBearing : angle);
    const seat = this.cast.child.position;
    const swing = back ? THREE.MathUtils.smootherstep(this.time, this.farewellFor, this.farewellFor + SWING) : 1;
    if (back && swing < 1) {
      const toBack = Math.atan2(back.x - boat.position.x, back.z - boat.position.z);
      const farewellBearing = toBack + Math.PI - this.quarter * k.farewellBearing;
      const bearing =
        farewellBearing +
        Math.atan2(Math.sin(sailBearing - farewellBearing), Math.cos(sailBearing - farewellBearing)) * swing;
      this.shot.from = this.from.set(Math.sin(bearing), 0, Math.cos(bearing));
      const tx = THREE.MathUtils.lerp(boat.position.x + Math.sin(toBack) * 7, seat.x + fx * lead, swing);
      const tz = THREE.MathUtils.lerp(boat.position.z + Math.cos(toBack) * 7, seat.z + fz * lead, swing);
      this.shot.target.set(tx, THREE.MathUtils.lerp(3, seat.y + 1.15, swing), tz);
      this.shot.distance = THREE.MathUtils.lerp(26, distance, swing);
      this.shot.height = THREE.MathUtils.lerp(4.5, height, swing);
      this.farewellAttention.point.copy(back);
      this.farewellAttention.strength = 1 - swing;
      this.shot.attention = this.farewellAttention;
      const establish = THREE.MathUtils.smootherstep(this.time, 0, k.farewellEstablish) * (1 - swing);
      this.farewellSubjects.tertiary.copy(this.sailingSubjects.primary).lerp(back, establish);
      // Reserve the whole moving hull and sail, not just the child's centre, beside the island.
      const extent = k.farewellBoatExtent, mast = k.farewellMastHeight;
      this.farewellBounds[0].copy(boat.position).add(this.spot.set(-extent, mast / 2, 0));
      this.farewellBounds[1].copy(boat.position).add(this.spot.set(extent, mast / 2, 0));
      this.farewellBounds[2].copy(boat.position).add(this.spot.set(0, mast / 2, -extent));
      this.farewellBounds[3].copy(boat.position).add(this.spot.set(0, mast / 2, extent));
      this.farewellBounds[4].copy(boat.position).y += mast;
      this.farewellBounds[5].copy(boat.position);
      this.shot.subjects = this.farewellSubjects;
      this.pace = 1.2;
    } else {
      /** Follow behind the travellers, with a little clearance beside the mast and room for the route ahead. */
      this.shot.from = this.from.set(Math.sin(sailBearing), 0, Math.cos(sailBearing));
      this.shot.target.set(seat.x + fx * lead, seat.y + 1.15, seat.z + fz * lead);
      this.shot.distance = distance;
      this.shot.height = height;
      this.pace = 0.4;
      if (this.wantsDolphins) {
        // Hold the boat and the near water together, leaving breathing room around whole animals.
        this.shot.target.set(boat.position.x - fz * this.quarter * 1.5 + fx,
          boat.position.y + 0.9, boat.position.z + fx * this.quarter * 1.5 + fz);
        this.framing.copy(this.cast.cygnet.position).lerp(this.cast.child.position, 0.55);
        this.shot.target.lerp(this.framing, this.swimFrame * 0.8);
        this.shot.distance = THREE.MathUtils.lerp(tuning.seaPassage.cameraDistance, tuning.seaPassage.swimCameraDistance, this.swimFrame);
        this.shot.height = THREE.MathUtils.lerp(tuning.seaPassage.cameraHeight, tuning.seaPassage.swimCameraHeight, this.swimFrame);
        if (this.swimFrame > 0.1) {
          this.swimSubjects.primary.copy(this.cast.child.position).y += 1.2;
          this.swimSubjects.secondary.copy(this.cast.cygnet.position).y += 0.4;
          this.shot.subjects = this.swimSubjects;
        }
        // Once the pod has said goodbye, turn with the voyage toward the shore again.
        const land = this.swim === 'done'
          ? THREE.MathUtils.smootherstep(progress, tuning.seaPassage.farewellAt, 1) : 0;
        const encounterBearing = THREE.MathUtils.lerp(tuning.seaPassage.cameraBearing,
          tuning.seaPassage.swimCameraBearing, this.swimFrame);
        const bearing = boat.yaw + Math.PI + this.quarter * THREE.MathUtils.lerp(encounterBearing, angle, land);
        this.from.set(Math.sin(bearing), 0, Math.cos(bearing));
        this.shot.target.lerp(this.look.set(seat.x + fx * lead, seat.y + 1.15, seat.z + fz * lead), land);
        this.shot.distance = THREE.MathUtils.lerp(this.shot.distance, distance, land);
        this.shot.height = THREE.MathUtils.lerp(this.shot.height, height, land);
        this.pace = 0.7;
      }
    }

    if (this.homeward) this.frameHomeward(progress);

    // Turn the lens toward the encounter without translating the eye by the same amount.
    // Retain its last boat-relative position for the release; diving must not snap the focus home.
    const watching = this.watching * (1 - this.swimFrame) * swing;
    if (watching > 0) {
      this.look.copy(boat.position).add(this.whaleOffset);
      this.look.y = Math.max(this.look.y, 1.5);
      // Put the whale ahead in depth, with the boat in the foreground. A broadside fit of two distant
      // subjects pulled so far away that it miniaturised both of them.
      const encounter = Math.atan2(boat.position.x - this.look.x, boat.position.z - this.look.z) + this.quarter * 0.2;
      this.whaleAttention.point.copy(this.look);
      this.whaleAttention.strength = watching;
      this.whaleAttention.bearing = encounter;
      this.whaleAttention.distance = this.shot.distance + k.whaleBack;
      this.whaleAttention.height = this.shot.height + k.whaleRise;
      this.shot.attention = this.whaleAttention;
      // Keep the boat and the whole surfacing body, not just an offscreen point the child looks at.
      this.whaleRight.subVectors(boat.position, this.look).setY(0).normalize();
      this.whaleRight.set(this.whaleRight.z, 0, -this.whaleRight.x);
      this.whaleSubjects.primary.copy(this.sailingSubjects.primary);
      this.whaleSubjects.secondary.copy(this.look).addScaledVector(this.whaleRight, k.whaleExtent)
        .lerp(this.whaleSubjects.primary, 1 - watching);
      this.whaleSubjects.tertiary.copy(this.look).addScaledVector(this.whaleRight, -k.whaleExtent)
        .lerp(this.whaleSubjects.primary, 1 - watching);
      // The swimmer has priority as soon as it starts leaving the child's arms.
      if (this.swimFrame < 0.1) {
        this.shot.subjects = this.whaleSubjects;
        this.shot.smoothFit = 1.5;
      }
    }
    this.focus.copy(boat.position);
    this.escort.set(boat.position.x, 0, boat.position.z);
  }
}
