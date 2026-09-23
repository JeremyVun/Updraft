import type { DrownedScorePhase } from '../audio/dream-score';
import type { CheckpointPayload } from './checkpoint-data';
import * as THREE from 'three';
import type { Shot } from '../camera';
import type { WindSample } from '../wind/field';
import { DROWNED_CHANNEL, SPIRE, LIGHTHOUSE } from '../world/drowned';
import { LIGHTHOUSE_TOP_Y } from '../world/lighthouse';
import { WOOD_LANDING } from '../world/wood';
import { atmo } from '../world/atmosphere';
import { tuning } from '../tuning';
import { roundedWaypoint } from '../traveller/navigation';
import type { Cast, Chapter } from './cast';
import { completeObjective, cue } from './cues';

/** How near a waypoint counts as rounded. */
const ROUNDED = 20;
/** How near the spire has to be before the child looks up at it. */
const SPIRE_NEAR = 80;
/** The channel continues to shore; the boat never waits by circling its last roof. */
const PASSAGE = [...DROWNED_CHANNEL, WOOD_LANDING];
/** Where in the village the air dies and they stop. */
const STILL_AT = 0.32;
/** How much wind the player has to put into the sail before the boat has way on it again. */
const FILL_NEEDED = 22;
/** They are never stranded: long after anyone has stopped trying, the air comes back on its own. */
const STILL_LIMIT = 90;

type Beat = 'enter' | 'drift' | 'still' | 'gather' | 'snatch' | 'after';

/**
 * The drowned village. They come in at dusk over what used to be somebody's town and drift through it: ridges and
 * gable ends standing out of black water, herons on the chimneys, a spire with its weathervane still turning.
 * Nothing is asked of the player but to keep the sail full, and nothing is ever explained.
 *
 * Then the weather turns. The room exists so that a lit window at the end of the journey means something, and so
 * that the child loses the paper plane — the only thing they brought with them — to a wind they cannot help.
 */
export class DrownedChapter implements Chapter {
  beat: Beat = 'enter';
  breeze = 1;
  readonly worldLife = 1;
  pace = 0.4;
  haze = 0.6;
  dusk = 0.75;
  shower = 0;
  storm = 0;
  hush = 0.3;
  readonly shot: Shot = { target: new THREE.Vector3(), distance: 20, height: 3.2, carry: true };
  readonly music = 'drowned' as const;
  get drownedScore(): DrownedScorePhase {
    if(this.beat==='still')return 'still';
    if(this.beat==='gather')return 'gather';
    if(this.beat==='snatch')return 'loss';
    if(this.beat==='after')return this.t<12?'loss':'after';
    return this.stirred?'resume':'rooftops';
  }
  private arrivalHeard = false;
  get arrivalMusic(): 'drowned' | 'wood' { return this.arrivalHeard ? 'wood' : 'drowned'; }
  readonly season = 0.56;
  readonly focus = new THREE.Vector3();
  private leg = 0;
  private now = 0;
  private beatStart = 0;
  private lost = 0;
  private readonly seat = new THREE.Vector3();
  private readonly hand = new THREE.Vector3();
  private readonly look = new THREE.Vector3();
  private readonly from = new THREE.Vector3();
  private readonly tmp = new THREE.Vector3();
  private readonly seen = new THREE.Vector3();
  private readonly air: WindSample = { x: 0, z: 0, energy: 0, lift: 0 };
  private quarter = 1;
  private stillBearing = Math.PI + 0.9;
  private filled = 0;
  private stirred = false;
  private stormTime = 0;
  private hornPassed = false;
  private shook = false;
  private sheltered = false;
  private readonly departure = new THREE.Vector2();
  private villageBearing = 0;
  private readonly churchAttention = { point: SPIRE, strength: 0, weight: tuning.drownedCamera.spireWeight,
    distance: tuning.drownedCamera.spireDistance,
    height: tuning.drownedCamera.spireHeight };
  private readonly hullFrame = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  private readonly subjects = { primary: new THREE.Vector3(), secondary: new THREE.Vector3(),
    points: this.hullFrame, margin: 0.8, extra: 16 };
  private readonly churchSubjects = { primary: new THREE.Vector3(), secondary: new THREE.Vector3(),
    tertiary: new THREE.Vector3(), points: this.hullFrame, margin: tuning.drownedCamera.spireFrameMargin, extra: 32 };
  private readonly stormSubjects = { primary: new THREE.Vector3(), secondary: new THREE.Vector3(),
    tertiary: new THREE.Vector3(), points: this.hullFrame, margin: 0.8, extra: 64 };

  constructor(private readonly cast: Cast) {
    this.shot.obstacles = cast.village?.cameraObstacles;
    const { boat, plane } = cast;
    boat.becalmed = 0;
    boat.speedLimit = tuning.storm.passageSpeed;
    boat.mooring = null;
    this.departure.set(boat.position.x, boat.position.z);
    this.shot.carryAnchor = boat.position;
    this.quarter = -boat.sailSide || 1;
    boat.steerFor = DROWNED_CHANNEL[0];
    boat.canGround = false;
    boat.grounded = false;
    plane.homeRadius = 1e9;
  }

  /** The drift is the player's; only the moment the wind takes the plane is played out on its own. */
  get scripted(): boolean {
    return this.beat === 'snatch';
  }

  get invitesSail(): boolean { return this.beat === 'still'; }

  get done(): boolean {
    return this.beat === 'after' && this.cast.boat.grounded;
  }

  get checkpoint(): string | null { return this.stirred && this.beat === 'drift' ? 'sail' : null; }
  saveCheckpoint(): CheckpointPayload<'drowned'> { return [this.leg]; }
  restoreCheckpoint(_point: string, data: number[]): void {
    this.leg = THREE.MathUtils.clamp(Math.floor(data[0]), 0, DROWNED_CHANNEL.length - 1);
    this.stirred = true; this.beat = 'drift';
    this.cast.boat.speedLimit = tuning.storm.passageSpeed;
    this.cast.boat.steerFor = DROWNED_CHANNEL[this.leg];
  }

  private to(beat: Beat): void {
    this.beat = beat;
    this.beatStart = this.now;
  }

  private get t(): number {
    return this.now - this.beatStart;
  }

  /** How far through the village they are, 0 at the first roof to 1 at the last. */
  private get through(): number {
    const legs = DROWNED_CHANNEL.length - 1;
    const wp = DROWNED_CHANNEL[Math.min(this.leg, legs)];
    const prev = DROWNED_CHANNEL[Math.max(0, this.leg - 1)];
    const span = Math.hypot(wp.x - prev.x, wp.y - prev.y) || 1;
    const gone = 1 - Math.min(1, Math.hypot(this.cast.boat.position.x - wp.x, this.cast.boat.position.z - wp.y) / span);
    return THREE.MathUtils.clamp((this.leg - 1 + gone) / legs, 0, 1);
  }

  private steer(): void {
    const { boat } = this.cast;
    const wp = PASSAGE[this.leg];
    const from = this.leg === 0 ? this.departure : PASSAGE[this.leg - 1];
    if (this.leg < PASSAGE.length - 1 && roundedWaypoint(boat.position.x, boat.position.z, from.x, from.y, wp.x, wp.y, ROUNDED)) {
      this.leg++;
      boat.steerFor = PASSAGE[this.leg];
    }
    boat.canGround = this.leg === PASSAGE.length - 1 && this.beat === 'after';
  }

  update(dt: number, _time: number): void {
    this.now += dt;
    this.steer();
    const { child: c, plane: p, boat } = this.cast;
    c.ride(boat.seat(this.seat), boat.yaw, boat.roll, boat.pitch);
    if (p.held) p.hold(c);

    const through = this.through;
    switch (this.beat) {
      case 'enter':
        if (this.t > 9) this.to('drift');
        break;
      case 'drift':
        if (!this.stirred && through > STILL_AT) this.becalm();
        else if (Math.hypot(boat.position.x - WOOD_LANDING.x, boat.position.z - WOOD_LANDING.y) < tuning.storm.startsFromShore) this.to('gather');
        break;
      case 'still':
        this.hold(dt);
        break;
      case 'gather':
        if (this.t > tuning.storm.gatherFor) this.snatch();
        break;
      case 'snatch':
        if (this.t > tuning.storm.snatchFor) this.to('after');
        break;
      case 'after':
        if (this.t > tuning.storm.planeLostAfter) p.visible = false;
        break;
      default:
        break;
    }

    this.weather(dt, through);
    // The lost-plane scene owns its score; the forest takes over only after that scene has ended.
    if (this.beat === 'after' && this.leg === PASSAGE.length - 1 &&
      Math.hypot(boat.position.x - WOOD_LANDING.x, boat.position.z - WOOD_LANDING.y) <
        tuning.audio.arrivalShoreAllowance + tuning.audio.arrivalMusicLead * Math.max(4.5, boat.speed)) {
      this.arrivalHeard = true;
    }
    this.watch();
    const sideResponse = this.beat === 'snatch' || (this.beat === 'after' && this.t < tuning.storm.planeLookFor) ? 3
      : this.beat === 'still' ? 1.8 : tuning.drownedCamera.sideResponse;
    this.quarter += (-boat.sailSide - this.quarter) * (1 - Math.exp(-dt * sideResponse));
    this.frame();
  }

  /** Dusk deepening into a squall, and the music getting out of the way of it. */
  private weather(dt: number, through: number): void {
    const gathering = this.beat === 'gather' || this.beat === 'snatch' || this.beat === 'after';
    if (gathering) this.stormTime += dt;
    if (!this.hornPassed && this.stormTime >= tuning.storm.foghornAt) {
      this.hornPassed = true;
      // Never replay a stale call into thunder or the plane loss after a large time jump.
      if (this.beat === 'gather' && this.stormTime <= tuning.storm.foghornAt + tuning.storm.foghornLateAllowance) cue('foghorn');
    }
    this.storm = THREE.MathUtils.smoothstep(this.stormTime, 0, tuning.storm.weatherGatherFor);
    if (!this.shook && this.stormTime > tuning.storm.shakeAt) {
      this.shook = true;
      this.cast.cygnet.mind.perform('shake', 1.1);
    }
    if (!this.sheltered && this.stormTime > tuning.storm.lighthouseOutAt) {
      this.sheltered = true;
      this.cast.cygnet.mind.startle(tuning.storm.lighthouseStartle);
      this.cast.cygnet.mind.perform('nuzzle', tuning.storm.lighthouseComfortFor);
    }
    /**
     * The air goes out of the village before the storm comes into it. The world's own wind dies with it, so the
     * water goes to glass and the only thing left moving anywhere is whatever the player does.
     */
    const still = this.beat === 'still';
    const boat = this.cast.boat;
    boat.becalmed += ((still ? 1 : 0) - boat.becalmed) * (1 - Math.exp(-dt * (still ? 0.7 : 1.1)));
    this.breeze += ((still ? 0 : 1) - this.breeze) * (1 - Math.exp(-dt * (still ? 0.6 : 0.5)));
    this.dusk = 0.75 + through * 0.25 + THREE.MathUtils.smoothstep(this.stormTime, 0, tuning.storm.darkBy);
    this.haze = 0.6 + this.storm * 0.36 + (1 - this.breeze) * 0.12;
    this.shower = THREE.MathUtils.smoothstep(this.storm, 0.12, 0.85);
    const quiet = this.beat === 'snatch' ? 1 : this.beat === 'after' ? 0.85 : still ? 0.92 : 0.3 + this.storm * 0.45;
    this.hush += (quiet - this.hush) * (1 - Math.exp(-dt * 0.8));
  }

  /**
   * The boat stops between the rooftops and the sail hangs dead. Nothing is explained and nothing is asked in
   * words: the sail is the biggest thing in the frame, the child looks up at it, and the only wind left in the
   * world is the player's. It is the first time the journey needs them rather than answering them.
   */
  private becalm(): void {
    // Stay on the side from which the player was watching; crossing the boat would hide the invitation.
    this.stillBearing = this.villageBearing - this.cast.boat.yaw;
    this.to('still');
    this.filled = 0;
    cue('becalmed');
  }

  private hold(dt: number): void {
    const { boat, wind } = this.cast;
    const w = wind.sample(boat.position.x, boat.position.z, this.air);
    const fx = Math.sin(boat.yaw);
    const fz = Math.cos(boat.yaw);
    const push = Math.max(0, w.x * fx + w.z * fz) * 0.62 + Math.abs(w.x * fz - w.z * fx) * 0.3 + w.energy * 6;
    this.filled += Math.max(0, push - 0.8) * dt;
    if (this.t > 6 && (this.filled > FILL_NEEDED || this.t > STILL_LIMIT)) {
      this.stirred = true;
      this.to('drift');
      completeObjective();
    }
  }

  /** What the child is looking at: the spire while it is near, otherwise the houses going by. */
  private watch(): void {
    const { child: c, boat, plane: p } = this.cast;
    if (this.beat === 'still') {
      /** Up at the sail, and the player's eye goes where the child's does. */
      c.lookAt = boat.sailPoint(this.look);
      return;
    }
    if (this.beat === 'snatch') {
      c.lookAt = p.position;
      return;
    }
    if (this.beat === 'after') {
      /** The empty hand, and then the water it went over. */
      c.lookAt = this.t < 6 ? c.handPosition(this.hand) : this.look.set(this.lost, 1.5, boat.position.z - 40);
      return;
    }
    if ((this.sheltered && this.stormTime < tuning.storm.lighthouseOutAt + tuning.storm.lighthouseComfortFor) || (this.shook && this.stormTime < tuning.storm.shakeAt + 2)) {
      c.lookAt = this.cast.cygnet.eye(this.look);
      return;
    }
    if (this.beat === 'gather' && this.t < tuning.storm.lighthouseOutAt) {
      c.lookAt = this.look.copy(LIGHTHOUSE).setY(14);
      return;
    }
    if (Math.hypot(boat.position.x - SPIRE.x, boat.position.z - SPIRE.z) < SPIRE_NEAR) {
      c.lookAt = SPIRE;
      return;
    }
    /** Turning slowly from one side to the other, the way you do when there is nothing to do but look. */
    const sweep = Math.sin(this.now * 0.11);
    const fx = Math.sin(boat.yaw);
    const fz = Math.cos(boat.yaw);
    c.lookAt = this.look.set(
      boat.position.x + fx * 22 - fz * sweep * 30,
      2.5 + Math.max(0, sweep) * 3,
      boat.position.z + fz * 22 + fx * sweep * 30,
    );
  }

  /**
   * The wind takes the paper plane out of their hand. There is nothing the player can do about it and nothing the
   * child can do about it, and that is the whole point of it: the one thing the wind does in this game that is not
   * a kindness. It goes off low over the water and the rain closes behind it.
   */
  private snatch(): void {
    const { child: c, plane: p, boat } = this.cast;
    this.to('snatch');
    /** Out over the bow, so it goes away up the channel in front of them and the player watches it the whole way. */
    const away = boat.yaw + 0.4;
    const dir = this.tmp.set(Math.sin(away), 0.14, Math.cos(away)).normalize();
    p.launch(c.handPosition(this.hand), this.from.copy(dir).multiplyScalar(11).setY(2.2));
    p.depart(dir, tuning.storm.planeAwaySpeed, tuning.storm.planeAwayRise);
    this.lost = boat.position.x + dir.x * 60;
    c.reach();
  }

  /** Once the rain has it, it is gone: never while it can still be seen. It turns up again in the wood. */
  afterCamera(camera: THREE.PerspectiveCamera): void {
    const p = this.cast.plane;
    if (this.beat !== 'after' || !p.visible) return;
    const veil = atmo.uniforms.uVeil.value;
    const swallowed = (p.position.distanceTo(camera.position) - veil.x) * veil.y > tuning.storm.planeLostInFog;
    const s = this.seen.copy(p.position).project(camera);
    if (swallowed || s.z > 1 || Math.abs(s.x) > 1.05 || Math.abs(s.y) > 1.05) p.visible = false;
  }

  private frame(): void {
    const { boat, plane: p } = this.cast;
    const s = this.shot;
    s.eye = undefined;
    s.attention = undefined;
    s.composition = this.beat === 'still' ? 'hold' : undefined;
    s.smoothFit = undefined;
    this.subjects.primary.copy(this.cast.child.position).y += 1.2;
    this.hullFrame[0].copy(boat.position);
    boat.hullEnds(this.hullFrame[1], this.hullFrame[2]);
    this.subjects.secondary.copy(boat.sailPoint(this.tmp));
    s.subjects = this.subjects;
    const fx = Math.sin(boat.yaw);
    const fz = Math.cos(boat.yaw);
    if (this.beat === 'snatch' || (this.beat === 'after' && this.t < tuning.storm.planeLookFor)) {
      /**
       * Astern and a little wider than the drift, so the frame holds the child with both arms out and the plane
       * going away up the channel in front of them. Chasing the plane itself would only show the player a dot.
       */
      const bearing = boat.yaw + Math.PI + this.quarter * tuning.storm.cameraQuarter;
      s.from = this.from.set(Math.sin(bearing), 0, Math.cos(bearing));
      const seat = this.cast.child.position;
      s.target.set(seat.x + fx * tuning.storm.planeAhead, seat.y + 1.7 + Math.min(tuning.storm.planeLookUp, Math.max(0, p.position.y - seat.y) * 0.1), seat.z + fz * tuning.storm.planeAhead);
      s.distance = 18;
      s.height = 3.6;
      this.pace = 1;
      this.focus.copy(boat.position);
      return;
    }
    if (this.beat === 'still') {
      /** Low, with the slack sail filling the middle of the frame: the one thing there is to act on. */
      const astern = boat.yaw + this.stillBearing;
      s.from = this.from.set(Math.sin(astern), 0, Math.cos(astern));
      s.target.copy(boat.sailPoint(this.tmp));
      s.distance = 15;
      s.height = 2.8;
      this.pace = 0.5;
      this.focus.copy(boat.position);
      return;
    }
    if (this.beat === 'enter' || this.beat === 'drift') {
      this.villageFrame(fx, fz);
      this.focus.copy(boat.position);
      return;
    }
    const bearing = boat.yaw + Math.PI + this.quarter * tuning.storm.cameraQuarter;
    s.from = this.from.set(Math.sin(bearing), 0, Math.cos(bearing));
    if (this.beat === 'gather') {
      const guide = THREE.MathUtils.smoothstep(this.stormTime, 0, tuning.storm.lighthouseLookFrom)
        * (1 - THREE.MathUtils.smoothstep(this.stormTime, tuning.storm.lighthouseLookRelease, tuning.storm.lighthouseLookUntil));
      const towardLight = Math.atan2(LIGHTHOUSE.x - boat.position.x, LIGHTHOUSE.z - boat.position.z)
        + Math.PI + tuning.storm.lighthouseLookOffset;
      this.from.lerp(this.tmp.set(Math.sin(towardLight), 0, Math.cos(towardLight)), guide).normalize();
      this.stormSubjects.primary.copy(this.subjects.primary);
      this.stormSubjects.secondary.copy(this.subjects.secondary);
      this.stormSubjects.tertiary.copy(LIGHTHOUSE).setY(LIGHTHOUSE_TOP_Y).lerp(this.subjects.secondary, 1 - guide);
      s.subjects = this.stormSubjects;
      s.smoothFit = 3;
    }
    /** Low and close to the water, because the village only reads as drowned from a hand's breadth above it. */
    const seat = this.cast.child.position;
    s.target.set(seat.x + fx * tuning.storm.lookAhead, seat.y + 0.9, seat.z + fz * tuning.storm.lookAhead);
    s.distance = 16;
    s.height = 2.8;
    if (this.beat === 'gather') {
      const opening = THREE.MathUtils.smoothstep(this.stormTime, 0, 6);
      s.distance = THREE.MathUtils.lerp(16, tuning.storm.lighthouseFrameDistance, opening);
      s.height = THREE.MathUtils.lerp(2.8, tuning.storm.lighthouseFrameHeight, opening);
      s.target.y = seat.y + THREE.MathUtils.lerp(0.9, tuning.storm.lighthouseFrameUp, opening);
    }
    this.pace = this.beat === 'gather' ? tuning.storm.lighthouseCameraPace : 0.4;
    this.focus.copy(boat.position);
  }

  /** The camera notices the village with the child: rooftops at water level, then the church passing overhead. */
  private villageFrame(fx: number, fz: number): void {
    const { boat, child } = this.cast;
    const k = tuning.drownedCamera, s = this.shot;
    const roofs = THREE.MathUtils.smootherstep(-boat.position.z, -k.roofFromZ, -k.roofUntilZ);
    const past = SPIRE.z - boat.position.z;
    // Once the sail has brought us forward again, let the church pass. Replaying its reveal would
    // pull us back out of the street just as the player has set the journey moving.
    const church = this.stirred ? 0 : THREE.MathUtils.smootherstep(past, -k.spireEnter, -k.spireFull)
      * (1 - THREE.MathUtils.smootherstep(past, -k.spireLeave, -k.spireGone));
    const roofBearing = boat.yaw + Math.PI + this.quarter * THREE.MathUtils.lerp(k.entryBearing, k.roofBearing, roofs);
    // The church draws the gaze, not the camera's travelling position out of the channel.
    this.villageBearing = roofBearing;
    s.from = this.from.set(Math.sin(roofBearing), 0, Math.cos(roofBearing));
    s.distance = THREE.MathUtils.lerp(k.entryDistance, k.roofDistance, roofs);
    s.height = THREE.MathUtils.lerp(k.entryHeight, k.roofHeight, roofs);
    s.target.set(child.position.x + fx * tuning.storm.lookAhead, child.position.y + 0.9,
      child.position.z + fz * tuning.storm.lookAhead);
    this.churchAttention.strength = church;
    s.attention = this.churchAttention;
    if (church > 0) {
      this.churchSubjects.primary.copy(this.subjects.primary);
      this.churchSubjects.secondary.copy(SPIRE).setY(1).lerp(this.subjects.secondary, 1 - church);
      this.churchSubjects.tertiary.copy(SPIRE).lerp(this.subjects.secondary, 1 - church);
      s.subjects = this.churchSubjects;
      s.smoothFit = 1.5;
    }
    this.pace = 0.65;
  }
}
