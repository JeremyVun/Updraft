import type { DrownedScorePhase } from '../audio/dream-score';
import type { CheckpointPayload } from './checkpoint-data';
import * as THREE from 'three';
import type { Shot } from '../camera';
import { DROWNED_CHANNEL, SPIRE, LIGHTHOUSE } from '../world/drowned';
import { STORM_WAY, CAT_CHIMNEY, CAT_HOLD, CAT_LENS, DARK_AT_STRAND, STRAND, STRAND_YAW, WAY } from '../world/drowned-way';
import { LIGHTHOUSE_TOP_Y } from '../world/lighthouse';
import { WOOD_LANDING } from '../world/wood';
import { atmo } from '../world/atmosphere';
import { drownedEntry } from '../world/journey-rooms';
import { tuning } from '../tuning';
import { roundedWaypoint } from '../traveller/navigation';
import type { Cast, Chapter } from './cast';
import { cue } from './cues';
import { StrandedCat } from './drowned-cat';
import { RoofRun, lookAwayFrom } from './drowned-run';
import { ChurchArrival } from './drowned-church';

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
/** Once she is aboard at the nave they go out by `STORM_WAY` and on along the channel's last leg. */
const ON_FROM_NAVE = PASSAGE.indexOf(DROWNED_CHANNEL[DROWNED_CHANNEL.length - 1]);
/** Where she will step out onto the slates by the stem, and the ridge above it. */
const STRAND_STEP = new THREE.Vector3(WAY.strandSlope.x0, WAY.strandSlope.height, WAY.strandSlope.z0);
const STRAND_TOP = new THREE.Vector3(WAY.strandSlope.x1, WAY.strandSlope.height1, WAY.strandSlope.z1);

/**
 * `still` the air dying as the hull coasts on and runs aground on a roof just under the water; `becalmed` the boat stuck
 * there while the fog rises where they came from and comes on, until the cat bolts onto the roof and she is up on it
 * after the cat; `run` her way over the roofs to the church, the fog coming on behind her, the boat lost to it where it
 * lies; `nave` her on the nave's ridge at the tower's foot, the cat on the railings below the tower, the fog a few roofs
 * back; `church` the cat and her up the ivy into the belfry, the fog sea, the bell calling the boat home, her climb down
 * into it and the look back up at the cat. The storm (`gather`, `snatch`, `after`) begins as they leave the nave.
 */
type Beat = 'enter' | 'drift' | 'still' | 'becalmed' | 'run' | 'nave' | 'church' | 'gather' | 'snatch' | 'after';

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
    if(this.beat==='still'||this.beat==='becalmed'||this.beat==='run'||this.beat==='nave'||this.beat==='church')return 'still';
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
  /** The game's clock, as the lens has it. */
  private time = 0;
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
  /** When the air died: the fog's rise and the lens's coming round beside the boat are timed from it. */
  private stillAt = 0;
  private stirred = false;
  /** The screen's shape, from the last frame: an upright phone composes the stranding differently. */
  private aspect = 16 / 9;
  private camera: THREE.PerspectiveCamera | null = null;
  /** How far the dark has come on since it rose, 0 to 1. */
  private come = 0;
  private touched = false;
  private stormTime = 0;
  private hornPassed = false;
  private shook = false;
  private sheltered = false;
  private readonly departure = new THREE.Vector2();
  /**
   * The hull's heading as the lens rides it. Out in the open water of the storm it is smoothed, so a bow swinging round
   * a waypoint does not swing the view; among the roofs it is the hull's own, so the lens stays in the channel behind.
   */
  private heading = 0;
  private headingSpeed = 0;
  private readonly lensAt = new THREE.Vector3();
  private readonly churchAttention = { point: SPIRE, strength: 0, weight: tuning.drownedCamera.spireWeight,
    distance: tuning.drownedCamera.spireDistance,
    height: tuning.drownedCamera.spireHeight };
  private readonly hullFrame = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  private readonly subjects = { primary: new THREE.Vector3(), secondary: new THREE.Vector3(),
    points: this.hullFrame, margin: 0.8, extra: 16 };
  /** Beside the becalmed boat the child and the hull are what must stay in frame; the sail and the ends may crop. */
  private readonly strandSubjects = { primary: new THREE.Vector3(), secondary: new THREE.Vector3(), margin: 0.8, extra: 8 };
  private readonly churchSubjects = { primary: new THREE.Vector3(), secondary: new THREE.Vector3(),
    tertiary: new THREE.Vector3(), points: this.hullFrame, margin: tuning.drownedCamera.spireFrameMargin, extra: 32 };
  /** The cat, the tub and her while the cat is brought over; the cat and her while it rides at the bow. */
  private readonly catSubjects = { primary: new THREE.Vector3(), secondary: new THREE.Vector3(),
    tertiary: undefined as THREE.Vector3 | undefined, margin: 0.88, extra: 3 };
  private readonly cat: StrandedCat;
  /** Her way over the roofs after the cat, once she is up on the roof. */
  readonly run: RoofRun | null;
  /** The church, from the tower's foot until she is aboard again. */
  readonly church: ChurchArrival | null;
  /** How far out from the nave along `STORM_WAY` they are; past its end, on the channel's last leg. */
  private out = STORM_WAY.length;
  /** How far through the village they were when the air died: the light goes on from there with the dark, not with the boat. */
  private held = 0;
  /** How far the lens has come round to watch the cat brought over (it only grows), and when the boat went on. */
  private catRound = 0;
  private aboardFrom = -1;
  /**
   * The hull's side the lens watches the cat from, +1 its port: away from the sail once the boat is waiting and the
   * sail has fallen slack, and how far out to it the lens has eased.
   */
  private catSide = 0;
  private catAside = 0;
  private readonly lensWas = new THREE.Vector3();
  /** How fast the fog's front is coming on while the boat lies stuck, m/s. */
  private fogSpeed = 0;
  /** The lens has come in close for the cat's coming aboard. */
  private closeIn = false;
  /** The player's sweeps on the stuck boat's sail: how full it was last frame, and seconds since it last strained. */
  private strained = 0;
  private strainAge = 10;
  private readonly catHead = new THREE.Vector3();
  private readonly catAttention = { point: new THREE.Vector3(), strength: 0, weight: tuning.drownedCamera.catGlance };
  private readonly darkFront = new THREE.Vector3();
  private readonly catEye = new THREE.Vector3();
  private readonly anchor = new THREE.Vector3();
  private readonly catAim = new THREE.Vector3();

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
    boat.coastTo = null;
    plane.homeRadius = 1e9;
    if (cast.village) {
      cast.village.dark.rise = 0;
      cast.village.dark.front = 0;
    }
    this.cat = new StrandedCat(cast, () => this.goOn());
    this.cat.begin();
    this.run = cast.village ? new RoofRun(cast) : null;
    this.church = cast.village ? new ChurchArrival(cast) : null;
  }

  /** The cat is aboard: she takes up the sheet again and they sail on along the drift. */
  private goOn(): void {
    const { boat } = this.cast;
    boat.coastTo = null;
    boat.speedLimit = tuning.drowned.driftSpeed;
    boat.steerFor = PASSAGE[this.leg];
    this.aboardFrom = this.now;
  }

  get windInvitation(): THREE.Vector3 | null {
    if (this.beat === 'nave') return null;
    if (this.beat === 'church') return this.church!.invitation;
    return this.beat === 'run' ? this.run!.invitation : this.cat.invitation;
  }

  /** At the church the boat's sail is the player's to fill. */
  get invitesSail(): boolean {
    return this.beat === 'church' && this.church!.invitesSail;
  }

  get invitationHeading(): number | null {
    if (this.beat === 'church') return this.church!.inviteHeading;
    return this.beat === 'run' ? this.run!.inviteHeading : this.cat.heading;
  }

  get invitationRadius(): number {
    return this.beat === 'run' ? this.run!.invitationRadius : 0;
  }

  /**
   * The drift is the player's. The air dying is played out on its own, so the glass stays still while the boat comes
   * to rest; so is the moment the wind takes the plane.
   */
  get scripted(): boolean {
    return this.beat === 'still' || this.beat === 'snatch';
  }

  get done(): boolean {
    return this.beat === 'after' && this.cast.boat.grounded;
  }

  /**
   * The latest point to come back to: the cat aboard, the run's start, the tower's foot, in the belfry with the bell to
   * ring, aboard for the storm.
   */
  get checkpoint(): string | null {
    switch (this.beat) {
      case 'enter': return null;
      case 'drift': case 'still': case 'becalmed': return this.aboardFrom >= 0 ? 'sail' : null;
      case 'run': return 'roofs';
      case 'nave': return 'church';
      case 'church': {
        const step = this.church!.step;
        return step === 'foot' || step === 'climb' ? 'church' : step === 'board' || step === 'aboard' ? 'storm' : 'belfry';
      }
      default: return 'storm';
    }
  }
  saveCheckpoint(): CheckpointPayload<'drowned'> { return [this.leg]; }
  restoreCheckpoint(point: string, data: number[]): void {
    if (point === 'roofs' || point === 'church' || point === 'belfry' || point === 'storm') {
      this.skipToRun();
      if (point === 'church') this.skipToNave();
      if (point === 'belfry') this.skipToBelfry();
      if (point === 'storm') this.skipToStorm();
      return;
    }
    this.leg = THREE.MathUtils.clamp(Math.floor(data[0]), 0, TO_STRAND);
    this.beat = 'drift';
    this.cast.boat.speedLimit = tuning.drowned.driftSpeed;
    this.cast.boat.steerFor = PASSAGE[this.leg];
    this.cat.aboard();
    this.aboardFrom = this.now - 30;
  }

  /** QA (`?chapter=roofs`): straight to her up on the first roof after the cat, the boat aground beside it, the fog coming. */
  skipToRun(): void {
    const { boat, cygnet, child } = this.cast;
    const k = tuning.drowned.dark;
    this.leg = TO_STRAND;
    boat.beach(STRAND.x, STRAND.y, STRAND_YAW);
    boat.launch();
    boat.coastTo = { x: STRAND.x, z: STRAND.y, yaw: STRAND_YAW };
    boat.knock(0, 0, tuning.drowned.stuck.trim);
    this.touched = true;
    drownedEntry.behindGone = true;
    this.to('becalmed');
    this.held = this.through;
    this.beatStart = this.now - (k.riseFor + 10);
    this.stillAt = this.beatStart - tuning.drowned.stillFor;
    this.come = 1;
    this.breeze = 0;
    if (this.cast.village) {
      const dark = this.cast.village.dark;
      dark.rise = 1;
      dark.front = DARK_AT_STRAND - k.setOffBehind;
      this.fogSpeed = k.comePace;
    }
    cygnet.rideIn('satchel');
    child.openBag(true);
    this.cat.onRidge();
    this.restored = true;
  }

  /** QA (`?chapter=church`): on to her at the tower's foot, the boat lost in the fog where it ran aground. */
  skipToNave(): void {
    this.to('run');
    this.run!.begin(0);
    this.run!.skipToEnd();
    this.to('nave');
    this.cutIn = 2;
  }

  /** QA (`?chapter=belfry`): on to her in the belfry's opening over the fog sea, the bell about to be hers to ring. */
  skipToBelfry(): void {
    this.skipToNave();
    this.to('church');
    this.church!.begin();
    this.church!.skipToBelfry();
  }

  /** QA (`?chapter=storm`): on to her just seated aboard at the nave, about to look back up at the cat before the storm. */
  skipToStorm(): void {
    this.skipToNave();
    this.to('church');
    this.church!.begin();
    this.church!.skipToAboard();
  }

  /** How far the fog over the water muffles the sea: as it comes on toward the lens and once the lens is in it. */
  seaMuffle = 0;
  private muffleSea(): void {
    const dark = this.cast.village?.dark, eye = this.camera?.position;
    if (!dark || !eye) return;
    const k = tuning.drowned.fog;
    const at = dark.frontAt(this.muffleAt);
    const ahead = (eye.x - at.x) * dark.ahead.x + (eye.z - at.y) * dark.ahead.y;
    this.seaMuffle = dark.rise * (1 - THREE.MathUtils.smoothstep(ahead, k.muffleTo, k.muffleFrom));
  }

  /** QA: a skip ahead cuts the lens there once the chapter has begun; so does the church's into and out of the belfry. */
  cameraCut = 0;
  private churchCut = 0;
  private cutIn = 0;
  private readonly muffleAt = new THREE.Vector2();
  private restored = false;

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
    const sailing = this.beat === 'enter' || this.beat === 'drift' || this.beat === 'gather' || this.beat === 'snatch' || this.beat === 'after';
    const out = STORM_WAY[this.out];
    if (sailing && out && Math.hypot(boat.position.x - out.x, boat.position.z - out.y) < tuning.storm.outRounded) {
      this.out++;
      boat.steerFor = STORM_WAY[this.out] ?? PASSAGE[this.leg];
    }
    /** The drift never rounds the stranding: the air dies short of it and the hull runs on onto its slates. */
    const stranding = this.leg === TO_STRAND && this.beat === 'drift';
    if (sailing && !stranding && !STORM_WAY[this.out] && this.leg < PASSAGE.length - 1 && roundedWaypoint(boat.position.x, boat.position.z, from.x, from.y, wp.x, wp.y, ROUNDED)) {
      this.leg++;
      boat.steerFor = PASSAGE[this.leg];
    }
    boat.canGround = this.leg === PASSAGE.length - 1 && this.beat === 'after';
  }

  update(dt: number, time: number): void {
    this.now += dt;
    this.time = time;
    if (this.cutIn > 0 && --this.cutIn === 0) this.cameraCut++;
    this.muffleSea();
    this.steer();
    const { child: c, plane: p, boat } = this.cast;
    if (!this.cat.ashore || this.church?.aboard) {
      c.ride(this.cat.seatIn(this.seat, boat.seat(this.seat)), boat.yaw + (this.church?.seatTurn ?? 0), boat);
      if (this.cat.kneel > 0.05) c.sitting = false;
    }
    if (p.held) p.hold(c);
    this.cat.update(dt, time);
    c.lean = this.cat.holding && this.cat.step !== 'aboard' ? 0.1 : 0;
    this.run?.prepare(tuning.drownedCamera.run.layFor);
    if (this.beat === 'run' || this.beat === 'nave') this.run!.update(dt);
    else this.run?.tend(dt);
    if (this.church && this.church.step !== 'off') this.church.update(dt);

    const through = this.beat === 'enter' || this.beat === 'drift' || this.beat === 'still' ? (this.held = this.through) : this.held;
    switch (this.beat) {
      case 'enter':
        if (this.t > 9) this.to('drift');
        break;
      case 'drift':
        if (this.leg === TO_STRAND && Math.hypot(boat.position.x - STRAND.x, boat.position.z - STRAND.y) < tuning.drowned.stillFrom) this.still();
        break;
      case 'still':
        if (this.touched || this.t > tuning.drowned.stillFor) this.to('becalmed');
        break;
      case 'becalmed':
        if (this.run && this.cat.step === 'ridge' && this.cat.t > tuning.drowned.run.setOff) {
          this.to('run');
          this.run.begin(this.fogSpeed);
          /** Restored on the ridge there was no climb for the run to take the lens from: it cuts to her. */
          if (this.restored) {
            this.run.cutIn();
            this.cutIn = 2;
          }
          this.restored = false;
        }
        break;
      case 'run':
        if (this.run!.done) this.to('nave');
        break;
      case 'nave':
        if (this.church && this.t > tuning.drowned.church.naveFor) {
          this.to('church');
          this.church.begin();
        }
        break;
      case 'church':
        if (this.church!.done) this.aboard();
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
    this.darkComes(dt);
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
    if (open && dt > 0) {
      /** Critically damped, so a bow swinging round the lighthouse turns the lens with built-up speed, never at once. */
      const w = tuning.storm.lensTurn, off = Math.atan2(Math.sin(boat.yaw - this.heading), Math.cos(boat.yaw - this.heading));
      this.headingSpeed += (w * w * off - 2 * w * this.headingSpeed) * dt;
      this.heading += this.headingSpeed * dt;
    } else {
      this.heading = boat.yaw;
      this.headingSpeed = 0;
    }
    this.frame(dt);
  }

  /** Dusk deepening into a squall, and the music getting out of the way of it. */
  private weather(dt: number, through: number): void {
    const gathering = this.beat === 'gather' || this.beat === 'snatch' || this.beat === 'after';
    const ch = tuning.drowned.church;
    const close = this.church?.close ?? 0;
    if (gathering) this.stormTime += dt;
    if (!this.hornPassed && this.stormTime >= tuning.storm.foghornAt) {
      this.hornPassed = true;
      // Never replay a stale call into thunder or the plane loss after a large time jump.
      if (this.beat === 'gather' && this.stormTime <= tuning.storm.foghornAt + tuning.storm.foghornLateAllowance) cue('foghorn');
    }
    /** From the church the weather is already most of the way gathered: the fog brought it. */
    const from = this.church?.done ? ch.stormFrom : 0;
    this.storm = gathering ? THREE.MathUtils.lerp(from, 1, THREE.MathUtils.smoothstep(this.stormTime, 0, tuning.storm.weatherGatherFor)) : 0;
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
    const still = this.beat === 'still' || this.beat === 'becalmed' || this.beat === 'run' || this.beat === 'nave' || this.beat === 'church';
    const boat = this.cast.boat;
    /** The safety valve at the church: the world's own air comes back and carries the boat in. */
    const carried = this.beat === 'church' && !!this.church?.carrying;
    /** Waiting on the cat she lets the sheet go, so the sail hangs while the breeze goes on blowing. */
    const slack = (still && !carried) || (this.cat.holding && this.cat.step !== 'easing');
    boat.becalmed += ((slack ? 1 : 0) - boat.becalmed) * (1 - Math.exp(-dt * (slack ? 0.7 : 1.1)));
    /** With the cat aboard the breeze freshens a little for the last of the drift, before it dies. */
    const air = still ? (carried ? ch.carryBreeze : 0) : this.beat === 'drift' && this.aboardFrom >= 0 ? tuning.drowned.driftBreeze : 1;
    this.breeze += (air - this.breeze) * (1 - Math.exp(-dt * (still ? 0.6 : 0.5)));
    /**
     * The light goes on going down while the dark comes, a little further than the drift would have taken it; as the
     * fog closes round it takes the rest of the light itself, and the storm's night takes over from it as it gathers,
     * one darkening rather than one on top of the other.
     */
    const night = THREE.MathUtils.smoothstep(this.stormTime, 0, tuning.storm.darkBy);
    if (this.cast.village) this.cast.village.dark.storm = night;
    this.dusk = 0.75 + through * 0.25 + this.come * tuning.drowned.dusk + night;
    this.haze = 0.6 + this.storm * 0.36 + (1 - this.breeze) * 0.12;
    this.shower = Math.max(close * ch.closeShower, THREE.MathUtils.smoothstep(this.storm, 0.12, 0.85));
    const quiet = this.beat === 'snatch' ? 1 : this.beat === 'after' ? 0.85 : still ? 0.92 : 0.3 + this.storm * 0.45;
    this.hush += (quiet - this.hush) * (1 - Math.exp(-dt * 0.8));
  }

  /**
   * The air dies among the roofs. The breeze goes out of the sail, the water goes to glass, and the hull runs on,
   * slowing, until it rides up onto the slates of a roof lying just under the water, with a scrape and a lurch, and is
   * fast there, its stem against the slates still out of it. Behind them, the way they came, the fog starts to rise
   * off the sea.
   */
  private still(): void {
    const { boat } = this.cast;
    this.stillAt = this.now;
    this.to('still');
    drownedEntry.behindGone = true;
    boat.coastTo = { x: STRAND.x, z: STRAND.y, yaw: STRAND_YAW, brake: tuning.drowned.strandBrake };
    cue('becalmed');
  }

  /**
   * As the air dies the fog rises off the sea where they came from, and once the boat lies stuck it comes on over the
   * water, never stopping: a little quicker while it is still far off, slowing as it nears to a walk's pace, rising as
   * it comes. The cat stares at it until it bolts. The boat stays where it lies.
   */
  private darkComes(dt: number): void {
    const { boat, cygnet } = this.cast;
    const village = this.cast.village;
    if (!village) return;
    const k = tuning.drowned.dark;
    const dark = village.dark;
    if (this.beat === 'still' || this.beat === 'becalmed') {
      dark.rise = THREE.MathUtils.smoothstep(this.now - this.stillAt, 0, k.riseFor);
      if (dark.front <= 0) dark.front = DARK_AT_STRAND - k.riseAway;
    }
    if (this.beat === 'becalmed') {
      if (this.t > k.comeAfter) {
        const left = DARK_AT_STRAND - dark.front - tuning.drowned.cat.boltFrom;
        const pace = Math.min(k.comeMost, k.comePace + Math.max(0, left) * k.comeRate);
        this.fogSpeed += (pace - this.fogSpeed) * (1 - Math.exp(-dt * 1.2));
        dark.comeOn(dark.front + this.fogSpeed * dt, dt);
      }
      this.come = THREE.MathUtils.clamp(dark.front / (DARK_AT_STRAND - k.holdBehind), 0, 1);
      const front = dark.frontAt(this.front, 0);
      this.cat.dread(DARK_AT_STRAND - dark.front, this.darkFront.set(front.x, 1.5, front.y));
      this.strain(dt);
    }
    if (!this.touched && boat.coastTo && Math.hypot(boat.position.x - STRAND.x, boat.position.z - STRAND.y) < tuning.drowned.stuck.touch) {
      this.touched = true;
      const s = tuning.drowned.stuck;
      boat.knock(s.lurch, s.lurchRoll, s.trim);
      this.cast.knock?.('hull-scrape', boat.position, 1);
      cygnet.mind.startle(tuning.drowned.touchStartle);
    }
  }

  /**
   * A sweep of wind on the stuck boat's sail fills it and the hull strains and creaks against the slates it lies on,
   * and it does not come off.
   */
  private strain(dt: number): void {
    const { boat, input } = this.cast;
    const s = tuning.drowned.stuck;
    if (this.camera) boat.brushSail(this.camera, input);
    this.strainAge += dt;
    const made = boat.sailWind.made;
    if (made > s.strainFrom && this.strained <= s.strainFrom && this.strainAge > s.strainEvery) {
      this.strainAge = 0;
      boat.knock(-s.strain * Math.min(1, made / (s.strainFrom * 3)), s.strainRoll * boat.sailSide, s.trim);
      this.cast.knock?.('hull-strain', boat.position, Math.min(1, made / (s.strainFrom * 3)));
    }
    this.strained = made;
  }

  /**
   * Up at the sail as it goes slack, over the side at the water going to glass, and ahead at the slates as the stem
   * comes to rest on them; up the roof to its ridge, then back the way they came as the horizon goes black. Then at the
   * dark while it comes on, and once it has stopped, from it to the church and back. Over the side is the side away
   * from the lens.
   */
  private strandGaze(): THREE.Vector3 {
    const { boat } = this.cast;
    const fx = Math.sin(boat.yaw), fz = Math.cos(boat.yaw);
    const dark = () => {
      const front = this.cast.village?.dark.frontAt(this.front, tuning.drowned.darkGlance) ?? this.front.set(boat.position.x, boat.position.z + 60);
      return this.look.set(front.x, 3, front.y);
    };
    if (this.beat === 'still') {
      if (this.t < 2.6) return boat.sailPoint(this.look);
      if (this.t < 4.4) return this.look.set(boat.position.x - fz * 2.4 + fx * 0.8, 0, boat.position.z + fx * 2.4 + fz * 0.8);
      return this.look.set(STRAND_STEP.x, STRAND_STEP.y, STRAND_STEP.z);
    }
    if (this.t < tuning.drowned.dark.riseFor * 0.35) return this.look.set(STRAND_TOP.x, STRAND_TOP.y, STRAND_TOP.z);
    return Math.floor(this.t / tuning.drowned.glanceEvery) % 3 === 2 ? this.cat.eye : dark();
  }

  /** She is aboard at the nave: the storm begins, and they go out into the open water north-west of the church. */
  private aboard(): void {
    const { boat } = this.cast;
    this.leg = ON_FROM_NAVE;
    this.out = 0;
    boat.steerFor = STORM_WAY[0];
    boat.speedLimit = tuning.storm.speed;
    this.to('gather');
  }

  /** What the child is looking at: the spire while it is near, otherwise the houses going by. */
  private watch(): void {
    if (this.beat === 'run' || this.beat === 'nave' || this.beat === 'church' || this.church?.lookingUp) return;
    const { child: c, boat, plane: p } = this.cast;
    const onCat = this.beat === 'becalmed' ? (['bolting', 'waits', 'climbing', 'ridge'].includes(this.cat.step) ? this.cat.gaze() : null)
      : this.beat === 'drift' || this.beat === 'enter' ? this.cat.gaze() : null;
    if (onCat) {
      c.lookAt = onCat;
      if (this.cat.ashore) {
        c.lookAt = this.look.copy(onCat);
        lookAwayFrom(this.look, c.position, this.lensAt);
      }
      return;
    }
    if (this.beat === 'still' || this.beat === 'becalmed') {
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
    /** At the light until it has gone and then where it was, while it is still ahead of her shoulder. */
    const lx = LIGHTHOUSE.x - boat.position.x, lz = LIGHTHOUSE.z - boat.position.z;
    if (this.beat === 'gather' && (Math.sin(boat.yaw) * lx + Math.cos(boat.yaw) * lz) / Math.hypot(lx, lz) > tuning.storm.lighthouseWatched) {
      c.lookAt = this.look.copy(LIGHTHOUSE).setY(14);
      return;
    }
    if ((this.beat === 'enter' || this.beat === 'drift') && Math.hypot(boat.position.x - SPIRE.x, boat.position.z - SPIRE.z) < SPIRE_NEAR) {
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
    this.camera = camera;
    this.aspect = camera.aspect;
    this.cat.afterCamera(camera);
    this.run?.afterCamera(camera);
    this.lensAt.copy(camera.position);
    this.church?.afterCamera(camera);
    const p = this.cast.plane;
    if (this.beat !== 'after' || !p.visible) return;
    const veil = atmo.uniforms.uVeil.value;
    const swallowed = (p.position.distanceTo(camera.position) - veil.x) * veil.y > tuning.storm.planeLostInFog;
    const s = this.seen.copy(p.position).project(camera);
    if (swallowed || s.z > 1 || Math.abs(s.x) > 1.05 || Math.abs(s.y) > 1.05) p.visible = false;
  }

  private frame(dt: number): void {
    const { boat, plane: p } = this.cast;
    const s = this.shot;
    s.obstacles = this.cast.village?.cameraObstacles;
    s.eye = undefined;
    s.orbit = undefined;
    s.attention = undefined;
    s.composition = undefined;
    s.smoothFit = undefined;
    s.carry = true;
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
    if (this.beat === 'run' || this.beat === 'nave') {
      this.pace = this.run!.frame(s, dt);
      this.focus.copy(this.cast.child.position);
      return;
    }
    if (this.beat === 'church') {
      this.pace = this.church!.frame(s, dt);
      if (this.church!.cut !== this.churchCut) {
        this.churchCut = this.church!.cut;
        this.cameraCut++;
      }
      this.focus.copy(this.cast.child.position);
      return;
    }
    if (this.beat === 'still' || this.beat === 'becalmed') {
      this.strandFrame();
      this.focus.copy(boat.position);
      return;
    }
    if (this.beat === 'enter' || this.beat === 'drift') {
      const step = this.cat.step, tub = this.cat.tubTop;
      if (!this.closeIn && (step === 'boarding' || step === 'aboard'
        || (step === 'ferried' && Math.hypot(tub.x - boat.position.x, tub.z - boat.position.z) < tuning.drownedCamera.rescueFrom))) this.closeIn = true;
      if (this.cat.rescuing || (this.closeIn && this.aboardFrom < 0)) this.rescueFrame();
      else if (this.aboardFrom >= 0 || step === 'aboard') this.driftFrame();
      else {
        this.villageFrame(fx, fz);
        if (step !== 'stranded') this.catFrame(dt);
      }
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
    this.church?.departure(s, dt, this.time);
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
    /** Once the light is out the tower has had its look: the lens lets it go and comes in to the boat and its lantern. */
    const out = tuning.storm.lighthouseOutAt + k.inFrom;
    const opening = THREE.MathUtils.smootherstep(this.stormTime, 0, k.openFor) * (1 - THREE.MathUtils.smootherstep(this.stormTime, out, out + k.inFor));
    const toward = Math.atan2(boat.position.x - LIGHTHOUSE.x, boat.position.z - LIGHTHOUSE.z) + k.offset;
    const passing = Math.atan2(Math.sin(toward - astern), Math.cos(toward - astern));
    const glance = opening * (1 - THREE.MathUtils.smootherstep(Math.abs(passing), k.arc, k.arc + k.pass));
    const bearing = astern + THREE.MathUtils.clamp(passing, -k.arc, k.arc) * glance;
    s.from = this.from.set(Math.sin(bearing), 0, Math.cos(bearing));
    s.distance = k.near;
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
   * The stranding, on the ordinary rig so every move is an orbit. As the air dies the lens comes round the boat's open
   * side from astern and in on the bow, low, so the cat at the bow is near and large, she is beyond it, and past the
   * stern the fog rises off the sea and grows: the cat's stare, its look to the church and its bolt are one frame.
   * When the cat bolts the frame goes up onto the roof with it and stands off the ridge's west end, behind her the way
   * she will go, the cat waiting ahead along the ridge. Upright it stands nearer the bow and looks back along the boat,
   * so the cat, her and the fog stack up the frame.
   */
  private strandFrame(): void {
    const k = tuning.drownedCamera, s = this.shot;
    const wide = THREE.MathUtils.smoothstep(this.aspect, 0.7, 1.3);
    const lerp = THREE.MathUtils.lerp;
    const boat = this.cast.boat.position, fx = Math.sin(this.cast.boat.yaw), fz = Math.cos(this.cast.boat.yaw);
    /** The cat's fear as the fog comes: the lens leans in on it at the bow. */
    const dark = this.cast.village?.dark, c = tuning.drowned.cat;
    const fear = dark && this.beat === 'becalmed' ? 1 - THREE.MathUtils.smoothstep(DARK_AT_STRAND - dark.front, c.boltFrom, c.uneasyFrom) : 0;
    const along = lerp(k.stuckAlong, k.stuckOnCat, fear * fear);
    const aim = this.anchor.set(boat.x + fx * along, k.stuckAim, boat.z + fz * along);
    const from = lerp(k.uprightStuckFrom, k.stuckFrom, wide), reach = lerp(k.uprightStuckDistance, k.stuckDistance, wide);
    const eye = this.catEye.set(aim.x + Math.sin(from) * reach, lerp(k.uprightStuckEye, k.stuckEye, wide), aim.z + Math.cos(from) * reach);
    /** It looks between the bow and the fog coming on behind the boat, so both stand in the frame. */
    const fog = this.cast.village?.dark.frontAt(this.front, 0) ?? this.front.set(STRAND.x, STRAND.y + 60);
    const toAim = Math.atan2(aim.x - eye.x, aim.z - eye.z), toFog = Math.atan2(fog.x - eye.x, fog.y - eye.z);
    const look = toAim + Math.atan2(Math.sin(toFog - toAim), Math.cos(toFog - toAim)) * lerp(k.uprightStuckFog, k.stuckFog, wide) * (1 - fear * fear);
    const reachAim = Math.hypot(aim.x - eye.x, aim.z - eye.z);
    s.target.set(eye.x + Math.sin(look) * reachAim, aim.y, eye.z + Math.cos(look) * reachAim);
    const climbed = this.cat.sinceBolt < 0 ? 0 : THREE.MathUtils.smootherstep(this.cat.sinceBolt, 0, k.climbFor);
    if (climbed > 0) {
      const ridge = STRAND_TOP, to = lerp(k.uprightRidgeFrom, k.ridgeFrom, wide), back = lerp(k.uprightRidgeDistance, k.ridgeDistance, wide);
      this.tmp.set(ridge.x + Math.sin(to) * back, ridge.y + lerp(k.uprightRidgeEye, k.ridgeEye, wide), ridge.z + Math.cos(to) * back);
      eye.lerp(this.tmp, climbed);
      const her = this.lensWas.copy(this.cast.child.position).setY(this.cast.child.position.y + 1.1);
      s.target.lerp(her.lerp(this.cat.eye, k.ridgeAlong), climbed);
    }
    s.eye = eye;
    s.orbit = true;
    s.zoom = lerp(lerp(k.uprightStuckZoom, k.stuckZoom, wide) * lerp(1, k.stuckCloser, fear * fear), 1, climbed);
    s.obstacles = undefined;
    this.strandSubjects.primary.copy(this.subjects.primary);
    this.strandSubjects.secondary.copy(this.cat.eye);
    s.subjects = this.strandSubjects;
    this.pace = lerp(k.stuckPace, k.ridgePace, climbed);
  }

  /**
   * While the cat is brought over the lens stands low off the gable end of its roof, near enough for the cat on its
   * pot to read, and so far round from her that the two of them face each other across the frame with the water the
   * tub crosses between: she looks past the lens at the cat, and the cat down at her, never into it. Upright the two
   * cannot stand side by side, so it stands behind her on the side away from the sail and looks on up past her to the
   * cat, and the story stacks up the frame. It is carried there as the boat slows into its hold, never ahead of it.
   */
  private catFrame(dt: number): void {
    const k = tuning.drownedCamera, s = this.shot, boat = this.cast.boat, seat = this.cast.child.position;
    const lerp = THREE.MathUtils.lerp;
    const wide = THREE.MathUtils.smoothstep(this.aspect, 0.7, 1.3);
    const toHold = Math.hypot(boat.position.x - CAT_HOLD.x, boat.position.z - CAT_HOLD.y);
    this.catRound = Math.max(this.catRound, THREE.MathUtils.smootherstep(1 - (toHold - 1) / k.catTurnFrom, 0, 1));
    const round = this.catRound;
    const step = this.cat.step;
    if (this.catSide === 0 && step !== 'seen' && step !== 'easing' && this.cat.t > 1.5) this.catSide = boat.sailSide;
    this.catAside += (this.catSide - this.catAside) * (1 - Math.exp(-dt * k.catAsideRate));
    const was = this.lensWas.copy(s.target).addScaledVector(s.from!, s.distance).setY(s.target.y + s.height);
    const head = this.catHead.copy(seat).setY(seat.y + 1.1);
    const pot = this.catAim.copy(CAT_CHIMNEY).setY(CAT_CHIMNEY.y + 0.3);
    let fx = pot.x - head.x, fz = pot.z - head.z;
    const across = Math.hypot(fx, fz) || 1;
    fx /= across; fz /= across;
    /** The sail swung to starboard (+1) hangs on the hull's -x side and leaves its +x clear. */
    const n = (Math.cos(boat.yaw) * fz + Math.sin(boat.yaw) * fx >= 0 ? -1 : 1) * this.catAside;
    const eye = this.catEye.set(head.x - fx * k.uprightCatBack + fz * n * k.uprightCatSide, k.uprightCatEye,
      head.z - fz * k.uprightCatBack - fx * n * k.uprightCatSide).lerp(this.tmp.set(CAT_LENS.x, k.catEye, CAT_LENS.y), wide);
    /** It looks between the cat and her wherever the cat is, lifted only while the cat is up on its pot. */
    const aim = this.anchor.copy(this.cat.eye).lerp(head, lerp(k.uprightCatAlong, k.catAlong, wide));
    aim.y += lerp(k.uprightCatLift, k.catLift, wide) * THREE.MathUtils.smoothstep(this.cat.eye.y, 0.5, 2.5);
    eye.lerpVectors(was, eye, round);
    s.target.lerp(aim, round);
    const dx = eye.x - s.target.x, dz = eye.z - s.target.z, d = Math.hypot(dx, dz);
    s.from = this.from.set(dx / d, 0, dz / d);
    s.distance = d;
    s.height = eye.y - s.target.y;
    s.zoom = lerp(1, lerp(k.uprightCatZoom, k.catZoom, wide), round);
    this.catAttention.point.copy(this.cat.eye);
    this.catAttention.strength = THREE.MathUtils.smoothstep(step === 'seen' ? this.cat.t : 3, 0, 2.5) * (1 - round);
    if (this.catAttention.strength > (s.attention?.strength ?? 0)) s.attention = this.catAttention;
    const c = this.catSubjects;
    c.primary.copy(this.cat.eye);
    c.secondary.copy(this.cat.tubTop);
    c.tertiary = this.subjects.primary;
    if (round > 0.3) {
      s.subjects = c;
      s.obstacles = undefined;
    }
    s.smoothFit = 1.5;
    this.pace = lerp(this.pace, k.catPace, round);
  }

  /**
   * The rescue, close: off the bow's quarter on the side away from the sail, which hangs slack and swings, committed as
   * the sailing view's side is and going round by the bow when it changes; far enough round that the mast stands clear
   * of her face, a little over her head so the boards show past the gunwale, with a longer lens: the cat's leap aboard,
   * its shiver, and it pressing against her shins as she kneels to it, her face and the cat one frame.
   */
  private rescueFrame(): void {
    const k = tuning.drownedCamera, s = this.shot, seat = this.cast.child.position;
    const wide = THREE.MathUtils.smoothstep(this.aspect, 0.7, 1.3);
    const fx = Math.sin(this.heading), fz = Math.cos(this.heading);
    /** `quarter` +1 is the starboard side, the hull's -x. */
    const px = -Math.cos(this.heading) * this.quarter, pz = Math.sin(this.heading) * this.quarter;
    const b = k.rescueBearing;
    s.from = this.from.set(fx * Math.cos(b) + px * Math.sin(b), 0, fz * Math.cos(b) + pz * Math.sin(b)).normalize();
    s.target.copy(seat).lerp(this.cat.eye, k.rescueAlong).setY(seat.y + k.rescueAim);
    s.distance = THREE.MathUtils.lerp(k.uprightRescueDistance, k.rescueDistance, wide);
    s.height = k.rescueHeight;
    s.zoom = THREE.MathUtils.lerp(k.uprightRescueZoom, k.rescueZoom, wide);
    s.obstacles = undefined;
    const c = this.catSubjects;
    c.primary.copy(seat).setY(seat.y + 0.9);
    c.secondary.copy(this.cat.eye);
    c.tertiary = undefined;
    s.subjects = c;
    s.smoothFit = 1.5;
    this.pace = k.rescuePace;
  }

  /**
   * The drift with the cat aboard is the room's establishing shot: wide behind the boat on the quarter away from the
   * sail, the village going by beside it, the cat in the bow and the spire ahead.
   */
  private driftFrame(): void {
    const k = tuning.drownedCamera, s = this.shot, seat = this.cast.child.position;
    const wide = THREE.MathUtils.smoothstep(this.aspect, 0.7, 1.3);
    const fx = Math.sin(this.heading), fz = Math.cos(this.heading);
    const bearing = this.heading + Math.PI + this.quarter * k.driftQuarter;
    s.from = this.from.set(Math.sin(bearing), 0, Math.cos(bearing));
    s.target.set(seat.x + fx * k.driftAhead, seat.y + 0.9, seat.z + fz * k.driftAhead);
    s.distance = THREE.MathUtils.lerp(k.uprightDriftDistance, k.driftDistance, wide);
    s.height = k.driftHeight;
    s.zoom = 1;
    this.subjects.secondary.copy(this.cat.eye);
    s.subjects = this.subjects;
    this.pace = k.driftPace;
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
