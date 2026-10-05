import type { DrownedScorePhase } from '../audio/dream-score';
import type { CheckpointPayload } from './checkpoint-data';
import * as THREE from 'three';
import type { Shot } from '../camera';
import { DROWNED_CHANNEL, SPIRE, LIGHTHOUSE } from '../world/drowned';
import { DARK_AT_STRAND, NAVE, STRAND, STRAND_HOUSE, STRAND_YAW, ridgeTop } from '../world/drowned-way';
import { LIGHTHOUSE_TOP_Y } from '../world/lighthouse';
import { WOOD_LANDING } from '../world/wood';
import { atmo } from '../world/atmosphere';
import { drownedEntry } from '../world/journey-rooms';
import { tuning } from '../tuning';
import { roundedWaypoint } from '../traveller/navigation';
import type { Cast, Chapter } from './cast';
import { cue } from './cues';

/** How near a waypoint counts as rounded. */
const ROUNDED = 20;
/** How near the spire has to be before the child looks up at it. */
const SPIRE_NEAR = 80;
/**
 * Past the cat's roof the drift heads straight for the ridge it will strand on; the channel goes on to shore beyond
 * it, so the boat never waits by circling its last roof.
 */
const PASSAGE = [...DROWNED_CHANNEL.slice(0, 3), STRAND, ...DROWNED_CHANNEL.slice(3), WOOD_LANDING];
const TO_STRAND = 3;
/** The top of the nave beside the tower: where she looks for somewhere higher. */
const REFUGE = new THREE.Vector3(NAVE.x + NAVE.len / 2 - 2, ridgeTop(NAVE) + 2.5, NAVE.z);

/**
 * `still` the air dying as the hull coasts in over the ridge; `drawing` the sea going and the village coming up out
 * of it; `stranded` the boat held on the slates while the dark comes on behind and stops.
 */
type Beat = 'enter' | 'drift' | 'still' | 'drawing' | 'stranded' | 'gather' | 'snatch' | 'after';

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
    if(this.beat==='still'||this.beat==='drawing'||this.beat==='stranded')return 'still';
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
  private readonly front = new THREE.Vector2();
  private quarter = 1;
  /** The side the lens has committed to; the sail must stay across a while before the view changes quarter. */
  private side = 1;
  private sideAgainst = 0;
  /** The bearing the lens stood at when the air died, so it comes round beside the boat from where it was. */
  private stillBearing = 0;
  private stirred = false;
  /** The screen's shape, from the last frame: an upright phone composes the stranding differently. */
  private aspect = 16 / 9;
  /** How far the dark has come on since the boat was left on the slates, 0 to 1. */
  private come = 0;
  private lurched = false;
  private stormTime = 0;
  private hornPassed = false;
  private shook = false;
  private sheltered = false;
  private readonly departure = new THREE.Vector2();
  private villageBearing = 0;
  /**
   * The hull's heading as the lens rides it. Out in the open water of the storm it is smoothed, so a bow swinging round
   * a waypoint does not swing the view; among the roofs it is the hull's own, so the lens stays in the channel behind.
   */
  private heading = 0;
  private readonly churchAttention = { point: SPIRE, strength: 0, weight: tuning.drownedCamera.spireWeight,
    distance: tuning.drownedCamera.spireDistance,
    height: tuning.drownedCamera.spireHeight };
  private readonly hullFrame = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  private readonly subjects = { primary: new THREE.Vector3(), secondary: new THREE.Vector3(),
    points: this.hullFrame, margin: 0.8, extra: 16 };
  /** Beside the stranded boat the child and the hull are what must stay in frame; the sail and the ends may crop. */
  private readonly strandSubjects = { primary: new THREE.Vector3(), secondary: new THREE.Vector3(), margin: 0.8, extra: 8 };
  private readonly churchSubjects = { primary: new THREE.Vector3(), secondary: new THREE.Vector3(),
    tertiary: new THREE.Vector3(), points: this.hullFrame, margin: tuning.drownedCamera.spireFrameMargin, extra: 32 };

  constructor(private readonly cast: Cast) {
    this.shot.obstacles = cast.village?.cameraObstacles;
    const { boat, plane } = cast;
    boat.becalmed = 0;
    boat.speedLimit = tuning.storm.passageSpeed;
    boat.mooring = null;
    this.departure.set(boat.position.x, boat.position.z);
    drownedEntry.fromBirches = boat.position.x < 8;
    drownedEntry.behindGone = false;
    this.shot.carryAnchor = boat.position;
    this.quarter = this.side = -boat.sailSide || 1;
    this.heading = boat.yaw;
    boat.steerFor = DROWNED_CHANNEL[0];
    boat.canGround = false;
    boat.grounded = false;
    boat.strand = null;
    plane.homeRadius = 1e9;
    if (cast.village) {
      cast.village.rise = 0;
      cast.village.dark.rise = 0;
      cast.village.dark.reach = 0;
    }
  }

  /**
   * The drift is the player's. The sea going is played out on its own, so the glass stays still while it goes; so
   * is the moment the wind takes the plane.
   */
  get scripted(): boolean {
    return this.beat === 'still' || this.beat === 'drawing' || this.beat === 'snatch';
  }

  get done(): boolean {
    return this.beat === 'after' && this.cast.boat.grounded;
  }

  get checkpoint(): string | null { return null; }
  saveCheckpoint(): CheckpointPayload<'drowned'> { return [this.leg]; }
  /** An older save from past the becalming comes back to the drift before the stranding. */
  restoreCheckpoint(_point: string, data: number[]): void {
    this.leg = THREE.MathUtils.clamp(Math.floor(data[0]), 0, TO_STRAND);
    this.beat = 'drift';
    this.cast.boat.speedLimit = tuning.storm.passageSpeed;
    this.cast.boat.steerFor = PASSAGE[this.leg];
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
    const legs = PASSAGE.length - 2;
    const wp = PASSAGE[Math.min(this.leg, legs)];
    const prev = PASSAGE[Math.max(0, this.leg - 1)];
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
    c.ride(boat.seat(this.seat), boat.yaw, boat);
    if (p.held) p.hold(c);

    const through = this.through;
    switch (this.beat) {
      case 'enter':
        if (this.t > 9) this.to('drift');
        break;
      case 'drift':
        if (this.leg === TO_STRAND && Math.hypot(boat.position.x - STRAND.x, boat.position.z - STRAND.y) < tuning.drowned.stillFrom) this.still();
        else if (Math.hypot(boat.position.x - WOOD_LANDING.x, boat.position.z - WOOD_LANDING.y) < tuning.storm.startsFromShore) this.to('gather');
        break;
      case 'still':
        if (this.t > tuning.drowned.stillFor) this.drawBack();
        break;
      case 'drawing':
        if (this.t > tuning.drowned.riseFor) this.to('stranded');
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
    this.seaGoes();
    // The lost-plane scene owns its score; the forest takes over only after that scene has ended.
    if (this.beat === 'after' && this.leg === PASSAGE.length - 1 &&
      Math.hypot(boat.position.x - WOOD_LANDING.x, boat.position.z - WOOD_LANDING.y) <
        tuning.audio.arrivalShoreAllowance + tuning.audio.arrivalMusicLead * Math.max(4.5, boat.speed)) {
      this.arrivalHeard = true;
    }
    this.watch();
    const sideResponse = this.beat === 'snatch' || (this.beat === 'after' && this.t < tuning.storm.planeLookFor) ? 3
      : this.beat === 'still' ? 1.8 : tuning.drownedCamera.sideResponse;
    this.sideAgainst = -boat.sailSide !== this.side ? this.sideAgainst + dt : 0;
    if (this.sideAgainst > tuning.crossingCamera.sideCommit) { this.side = -boat.sailSide; this.sideAgainst = 0; }
    this.quarter += (this.side - this.quarter) * (1 - Math.exp(-dt * sideResponse));
    const open = this.beat === 'gather' || this.beat === 'snatch' || this.beat === 'after';
    const follow = open && dt > 0 ? 1 - Math.exp(-dt * tuning.crossingCamera.headingResponse) : 1;
    this.heading += Math.atan2(Math.sin(boat.yaw - this.heading), Math.cos(boat.yaw - this.heading)) * follow;
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
    const still = this.beat === 'still' || this.beat === 'drawing' || this.beat === 'stranded';
    const boat = this.cast.boat;
    boat.becalmed += ((still ? 1 : 0) - boat.becalmed) * (1 - Math.exp(-dt * (still ? 0.7 : 1.1)));
    this.breeze += ((still ? 0 : 1) - this.breeze) * (1 - Math.exp(-dt * (still ? 0.6 : 0.5)));
    /** The light goes on going down while the dark comes, a little further than the drift would have taken it. */
    this.dusk = 0.75 + through * 0.25 + this.come * tuning.drowned.dusk + THREE.MathUtils.smoothstep(this.stormTime, 0, tuning.storm.darkBy);
    this.haze = 0.6 + this.storm * 0.36 + (1 - this.breeze) * 0.12;
    this.shower = THREE.MathUtils.smoothstep(this.storm, 0.12, 0.85);
    const quiet = this.beat === 'snatch' ? 1 : this.beat === 'after' ? 0.85 : still ? 0.92 : 0.3 + this.storm * 0.45;
    this.hush += (quiet - this.hush) * (1 - Math.exp(-dt * 0.8));
  }

  /**
   * The air dies among the roofs. The breeze goes out of the sail, the water goes to glass, and the hull coasts on
   * over a ridge lying just under it, slowing, to come to rest there.
   */
  private still(): void {
    const { boat } = this.cast;
    this.stillBearing = this.villageBearing;
    this.to('still');
    drownedEntry.behindGone = true;
    boat.strand = {
      x: STRAND.x, z: STRAND.y, yaw: STRAND_YAW, floor: ridgeTop(STRAND_HOUSE),
      list: tuning.drowned.strandList, pitch: tuning.drowned.strandPitch,
    };
  }

  /** Then the sea draws back: the whole village comes up out of the water, and the dark rises where they came from. */
  private drawBack(): void {
    this.to('drawing');
    cue('becalmed');
  }

  /** The village's rise, the slates under the keel, and the dark's rise and coming on, all from the beat's clock. */
  private seaGoes(): void {
    const { boat, cygnet } = this.cast;
    const village = this.cast.village;
    if (!village) return;
    const k = tuning.drowned;
    const drawing = this.beat === 'drawing', stranded = this.beat === 'stranded';
    if (drawing || stranded) {
      const risen = stranded ? 1 : THREE.MathUtils.smootherstep(this.t, 0, k.riseFor);
      village.rise = k.rise * risen;
      const raised = stranded ? k.riseFor + this.t : this.t;
      village.dark.rise = THREE.MathUtils.smoothstep(raised, 0, k.dark.riseFor);
      if (stranded) this.come = THREE.MathUtils.smootherstep(this.t, 0, k.dark.comeFor);
      village.dark.reach = (DARK_AT_STRAND - k.dark.holdBehind) * this.come;
    }
    if (boat.strand) {
      boat.strand.floor = ridgeTop(STRAND_HOUSE) + village.rise;
      if (!this.lurched && boat.aground > 0.35) {
        this.lurched = true;
        cygnet.mind.startle(k.lurchStartle);
      }
    }
  }

  /**
   * Up at the sail as it goes slack, and over the side at the water going to glass; down at the slates as they come
   * up under her, round at the roofs coming up out of the sea, and back the way they came as the horizon goes black.
   * Then at the dark while it comes on, and once it has stopped, from it to the church and back.
   */
  private strandGaze(): THREE.Vector3 {
    const { boat } = this.cast;
    const fx = Math.sin(boat.yaw), fz = Math.cos(boat.yaw);
    const low = Math.sign(tuning.drowned.strandList) || 1;
    const overSide = () => this.look.set(boat.position.x - fz * low * 2.4 + fx * 0.6, 0, boat.position.z + fx * low * 2.4 + fz * 0.6);
    const dark = () => {
      const front = this.cast.village?.dark.frontAt(this.front, tuning.drowned.darkGlance) ?? this.front.set(boat.position.x, boat.position.z + 60);
      return this.look.set(front.x, 3, front.y);
    };
    if (this.beat === 'still') return this.t < 2.6 ? boat.sailPoint(this.look) : overSide();
    if (this.beat === 'drawing') {
      if (this.t < 3.2) return overSide();
      if (this.t < 5.6) return this.look.set(boat.position.x + fx * 14 - fz * 8, 2.5, boat.position.z + fz * 14 + fx * 8);
      return dark();
    }
    const held = tuning.drowned.dark.comeFor * 0.8;
    /** Upright the lens stands toward the church, so she keeps her eyes on the dark there rather than turn to it. */
    if (this.t < held || this.aspect < 1) return dark();
    return Math.floor((this.t - held) / tuning.drowned.glanceEvery) % 2 === 0 ? this.look.copy(REFUGE) : dark();
  }

  /** What the child is looking at: the spire while it is near, otherwise the houses going by. */
  private watch(): void {
    const { child: c, boat, plane: p } = this.cast;
    if (this.beat === 'still' || this.beat === 'drawing' || this.beat === 'stranded') {
      c.lookAt = this.strandGaze();
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
    const hand = c.handPosition(this.hand);
    this.cast.lines.gust(hand.x, hand.z, dir.x, dir.z, tuning.storm.snatchGust.lines, tuning.storm.snatchGust.speed);
    p.launch(hand, this.from.copy(dir).multiplyScalar(11).setY(2.2));
    p.depart(dir, tuning.storm.planeAway);
    this.lost = boat.position.x + dir.x * 60;
    c.reach();
  }

  /** Once the rain has it, it is gone: never while it can still be seen. It turns up again in the wood. */
  afterCamera(camera: THREE.PerspectiveCamera): void {
    this.aspect = camera.aspect;
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
    s.composition = undefined;
    s.smoothFit = undefined;
    this.subjects.primary.copy(this.cast.child.position).y += 1.2;
    this.hullFrame[0].copy(boat.position);
    boat.hullEnds(this.hullFrame[1], this.hullFrame[2]);
    this.subjects.secondary.copy(boat.sailPoint(this.tmp));
    s.subjects = this.subjects;
    s.zoom = undefined;
    const fx = Math.sin(this.heading);
    const fz = Math.cos(this.heading);
    if (this.beat === 'snatch' || (this.beat === 'after' && this.t < tuning.storm.planeLookFor)) {
      /**
       * Astern and a little wider than the drift, so the frame holds the child with both arms out and the plane
       * going away up the channel in front of them. Chasing the plane itself would only show the player a dot.
       */
      const bearing = this.heading + Math.PI + this.quarter * tuning.storm.cameraQuarter;
      s.from = this.from.set(Math.sin(bearing), 0, Math.cos(bearing));
      const seat = this.cast.child.position;
      s.target.set(seat.x + fx * tuning.storm.planeAhead, seat.y + 1.7 + Math.min(tuning.storm.planeLookUp, Math.max(0, p.position.y - seat.y) * 0.1), seat.z + fz * tuning.storm.planeAhead);
      s.distance = 18;
      s.height = 3.6;
      this.pace = 1;
      this.focus.copy(boat.position);
      return;
    }
    if (this.beat === 'still' || this.beat === 'drawing' || this.beat === 'stranded') {
      this.strandFrame();
      this.focus.copy(boat.position);
      return;
    }
    if (this.beat === 'enter' || this.beat === 'drift') {
      this.villageFrame(fx, fz);
      this.focus.copy(boat.position);
      return;
    }
    const bearing = this.heading + Math.PI + this.quarter * tuning.storm.cameraQuarter;
    s.from = this.from.set(Math.sin(bearing), 0, Math.cos(bearing));
    /** Low and close to the water, because the village only reads as drowned from a hand's breadth above it. */
    const seat = this.cast.child.position;
    s.target.set(seat.x + fx * tuning.storm.lookAhead, seat.y + 0.9, seat.z + fz * tuning.storm.lookAhead);
    s.distance = 16;
    s.height = 2.8;
    this.pace = 0.4;
    if (this.beat === 'gather') this.lighthouseFrame(bearing);
    this.focus.copy(boat.position);
  }

  /**
   * The lighthouse is the storm's one landmark, and the lens makes one move for it: out to a lower, wider view as the
   * weather gathers, turned so the tower stands over the travellers and tilted up to hold its crown. The tower is
   * glanced at from within an arc of the travelling view, never chased round the boat; as they come abeam of it the
   * lens lets it slide past and settles in behind them before the wind takes the plane. Everything here follows from
   * where the boat is, never from where the lens has got to, so there is nothing for it to hunt.
   */
  private lighthouseFrame(astern: number): void {
    const k = tuning.storm.lighthouseCamera, s = this.shot, boat = this.cast.boat, seat = this.cast.child.position;
    const opening = THREE.MathUtils.smootherstep(this.stormTime, 0, k.openFor);
    const toward = Math.atan2(boat.position.x - LIGHTHOUSE.x, boat.position.z - LIGHTHOUSE.z) + k.offset;
    const passing = Math.atan2(Math.sin(toward - astern), Math.cos(toward - astern));
    const glance = opening * (1 - THREE.MathUtils.smootherstep(Math.abs(passing), k.arc, k.arc + k.pass));
    const bearing = astern + THREE.MathUtils.clamp(passing, -k.arc, k.arc) * glance;
    s.from = this.from.set(Math.sin(bearing), 0, Math.cos(bearing));
    s.distance = THREE.MathUtils.lerp(16, k.distance, opening);
    s.zoom = THREE.MathUtils.lerp(1, k.zoom, glance);
    /** Tilt up from the travellers toward the crown, as far as the lens can while they keep the lower frame. */
    const eyeX = s.target.x + s.from.x * s.distance, eyeZ = s.target.z + s.from.z * s.distance;
    const eyeY = s.target.y + THREE.MathUtils.lerp(s.height, k.eyeRise, opening);
    const below = Math.atan2(seat.y + 1.2 - eyeY, s.distance);
    const crown = Math.atan2(LIGHTHOUSE_TOP_Y - eyeY, Math.hypot(LIGHTHOUSE.x - eyeX, LIGHTHOUSE.z - eyeZ));
    const tilt = Math.min(k.tilt, (crown - below) / 2) * glance;
    s.target.y = THREE.MathUtils.lerp(s.target.y, eyeY + Math.tan(below + tilt) * s.distance, opening);
    s.height = eyeY - s.target.y;
    this.pace = k.pace;
  }

  /**
   * Low beside the hull on its listing side, never above the roofs. As the air dies the lens comes round from astern
   * to the boat's beam, and while the sea goes it looks past the boat to where they came from, so the village coming
   * up out of the water and the dark rising on the horizon are one picture. Once the dark has come on and stopped it
   * turns with her toward the church, which comes into the other side of the frame. Upright, it stands ahead of the
   * boat and looks back the way they came, so the boat, the risen roofs and the dark stack up the frame.
   */
  private strandFrame(): void {
    const k = tuning.drownedCamera, d = tuning.drowned, s = this.shot, boat = this.cast.boat;
    const wide = THREE.MathUtils.smoothstep(this.aspect, 0.7, 1.3);
    const since = this.beat === 'still' ? this.t : d.stillFor + (this.beat === 'drawing' ? this.t : d.riseFor + this.t);
    const round = THREE.MathUtils.smootherstep(since, 0, d.turnFor);
    const turnFrom = d.dark.comeFor * 0.8;
    const turned = this.beat === 'stranded' ? THREE.MathUtils.smootherstep(this.t, turnFrom, turnFrom + d.lookFor) * wide : 0;
    const settled = THREE.MathUtils.smootherstep(since, d.stillFor + d.riseFor, d.stillFor + d.riseFor + 4);
    const dark = THREE.MathUtils.lerp(k.strandUpright, k.strandDark, wide);
    const from = this.stillBearing + Math.PI;
    let look = from + Math.atan2(Math.sin(dark - from), Math.cos(dark - from)) * round;
    look += Math.atan2(Math.sin(k.strandChurch - k.strandDark), Math.cos(k.strandChurch - k.strandDark)) * turned;
    const b = boat.position;
    const back = THREE.MathUtils.lerp(k.uprightBack, k.strandBack, wide);
    /** Upright, the eye stands off on the side the hull lists to, so the roof runs up the frame on a slant. */
    const side = k.uprightSide * (1 - wide) * round;
    const ex = b.x - Math.sin(look) * back - Math.cos(look) * side, ez = b.z - Math.cos(look) * back + Math.sin(look) * side;
    const reach = Math.hypot(b.x - ex, b.z - ez);
    const vx = (b.x - ex) / reach, vz = (b.z - ez) / reach;
    const ahead = THREE.MathUtils.lerp(k.uprightAhead, k.strandAhead, wide);
    const aside = k.strandAside * wide * (1 - turned);
    const aim = THREE.MathUtils.lerp(k.uprightAim, THREE.MathUtils.lerp(k.strandAim, k.churchAim, turned), wide);
    s.target.set(b.x + vx * ahead - vz * aside, aim, b.z + vz * ahead + vx * aside);
    const dx = ex - s.target.x, dz = ez - s.target.z, dist = Math.hypot(dx, dz);
    s.from = this.from.set(dx / dist, 0, dz / dist);
    s.distance = dist;
    s.height = THREE.MathUtils.lerp(k.strandLow, THREE.MathUtils.lerp(k.uprightHigh, k.strandHigh, wide), settled) - s.target.y;
    s.zoom = THREE.MathUtils.lerp(1, k.strandZoom, settled * wide);
    this.strandSubjects.primary.copy(this.subjects.primary);
    this.strandSubjects.secondary.copy(b);
    s.subjects = this.strandSubjects;
    this.pace = k.strandPace;
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
    const roofBearing = this.heading + Math.PI + this.quarter * THREE.MathUtils.lerp(k.entryBearing, k.roofBearing, roofs);
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
