import type { CheckpointPayload } from './checkpoint-data';
import * as THREE from 'three';
import { PlaneArrival } from './plane-arrival';
import type { Shot } from '../camera';
import { BANK, POND, POND_LEVEL, ISLES, mainlandCoastZ, meadowPoint, pondOut } from '../world/heightfield';
import { WAY } from '../world/fields';
import { piano, PATCH, PLACE } from '../world/piano';
import { heightAt } from '../world/island';
import type { Cast, Chapter } from './cast';
import { LANDING } from './crossing';
import { completeObjective, cue } from './cues';
import { PianoStop } from './piano';
import { tuning } from '../tuning';
import { musicFront } from '../world/music-growth';
import type { MeadowScorePhase } from '../audio/meadow-score';

type Beat = 'ashore' | 'beach' | 'climb' | 'brow' | 'walk' | 'crest' | 'down' | 'pond' | 'gather' | 'toBoat' | 'push' | 'aboard';
type Play = 'carry' | 'watch' | 'fetch' | 'hold';

/** The way inland, across the meadow to its far shore. The walls are built around the same line: `WAY` in `fields.ts`. */
export const ROUTE = WAY.slice(1).map((p) => new THREE.Vector2(p.x, p.z));

/** The top of the bank over the landing, where the island is first seen, and where the beach waits below it. */
const BROW = new THREE.Vector2(BANK.x + 1, BANK.crest - 2);
const BEACH = new THREE.Vector2(LANDING.x - 2, mainlandCoastZ(LANDING.x) - 4);
/** The piano, and the patch of colour it stands in: the one thing awake on a sleeping island. */
const PIANO_AT = new THREE.Vector3(PLACE.x, heightAt(PLACE.x, PLACE.z) + 1.2, PLACE.z);
const BROW_AT = new THREE.Vector3(BROW.x, heightAt(BROW.x, BROW.y) + 1.6, BROW.y);
// The open beach east of the last hill keeps the hull in view on the descent.
const shore = meadowPoint(24, -1176);
/** Where the boat is waiting on the far shore. Nobody put it there, and nobody remarks on it. */
export const FAR_SHORE = new THREE.Vector3(shore.x, 0, shore.z);

/** The high ground on the walk, where the haze thins and you are told, without a word, where you are going. */
const CREST_LEG = 3;
/** How near the crest waypoint counts as being up on the rise. */
const CREST_NEAR = 16;
/** The tarn on the slope below the brow, where the family is. Everything at the crest is arranged around it. */
const POND_AT = new THREE.Vector3(POND.x, POND_LEVEL, POND.z);
/**
 * Where the raft lies on it: toward the near shore, so the whole length of the water is ahead of a take-off run
 * and the birds are nearest the frame the player first sees them in.
 */
const RAFT_AT = new THREE.Vector3(POND.x, POND_LEVEL, POND.z + 5);
/** How far out the bugling carries, so it is heard on the walk well before the rise. */
const HEARD_FROM = 150;
/**
 * The reveal shot, from the top of the rise looking down into the hollow: the frame is centred `toward` of the
 * way from the child to the water, with the camera `back` behind them and `up` above the frame's centre, so the
 * two of them stand low in it and the pond with the white birds on it fills the rest.
 */
const REVEAL = { toward: 0.62, back: 26, up: 11.5, swing: 0.1 };

/**
 * The bank, coming at the pond from (x, z): the last dry ground before the water, and then `standOff` back from
 * it, which is where somebody stands to look at what is on the water.
 */
function pondEdge(x: number, z: number, standOff: number, out: THREE.Vector3): THREE.Vector3 {
  const dx = x - POND.x;
  const dz = z - POND.z;
  const d = Math.hypot(dx, dz) || 1;
  for (let r = 3; r < 44; r += 0.4) {
    if (heightAt(POND.x + (dx / d) * r, POND.z + (dz / d) * r) > POND_LEVEL + 0.25) {
      return out.set(POND.x + (dx / d) * (r + standOff), 0, POND.z + (dz / d) * (r + standOff));
    }
  }
  return out.set(x, 0, z);
}

/** Whether a point is over the pond's water, for anything that might come down on it. */
function overPond(x: number, z: number): boolean {
  return pondOut(x, z) < 1 && heightAt(x, z) < POND_LEVEL - 0.15;
}

const WAVE_REACH = 3600;
/** Every mirrored sweep has its own colour front; the final one reaches the whole island. */
const WAKING = [
  { reach: PATCH.radius, speed: 0 },
  ...tuning.piano.responseReach.map((reach, i) => ({ reach, speed: tuning.piano.responseSpeed[i] })),
  { reach: WAVE_REACH, speed: 32 },
];
/** How long the wind keeps driving the last wave across the island, and how quiet a wake nobody answered is. */
const GUST_FOR = 15;
const UNANSWERED = 0.45;
/** The sun shower on the walk: it gathers, falls steadily, then drifts away (seconds). */
const SHOWER = { gather: 10, fall: 30, clear: 16 };
/** How near the boat the plane has to land before the child takes the hint. */
const BOARDING = 16;

/**
 * The meadow: the last warm afternoon of the year, and the island is asleep. The boat lands in a bay under a bank,
 * and the whole room is over the top of it — a grey island with one patch of colour in it and a piano standing
 * there. The lullaby wakes the rest, wave by wave. The long walk follows the plane through a sun shower, over the
 * crest and down to the pond, and ends where the boat is drawn up on the far shore.
 */
export class MeadowChapter implements Chapter {
  private readonly arrival = new PlaneArrival();
  beat: Beat = 'ashore';
  readonly breeze = 1;
  readonly worldLife = 1;
  pace = 0.35;
  haze = 0.55;
  private beatHush = 0;
  dusk = 0;
  shower = 0;
  readonly shot: Shot = { target: new THREE.Vector3(), distance: 40, height: 12 };
  readonly music = 'meadow' as const;
  readonly season = 0.32;
  readonly focus = new THREE.Vector3();
  private play: Play = 'carry';
  private leg = 0;
  private beatStart = 0;
  /** How far the colour is rolling out, how fast, and how long the wind runs ahead of it. */
  private waveTo = 0;
  private waveSpeed = 0;
  private waveFrom = -1;
  private gustUntil = 0;
  private gustPower = 1;
  private showerStart = -1;
  private holdUntil = 0;
  private duskTarget = 0;
  private now = 0;
  private readonly hand = new THREE.Vector3();
  private readonly tmp = new THREE.Vector3();
  private readonly planeGoal = new THREE.Vector2();
  private readonly walkGoal = new THREE.Vector2();
  private readonly watched = new THREE.Vector3();
  private watchUntil = 0;
  private nextLook = 0;
  private nextChase = 0;
  private readonly cameraChild = new THREE.Vector3();
  private readonly boardingView = new THREE.Vector3(0.75, 0, -1).normalize();
  private readonly framing = { primary: this.cameraChild, secondary: new THREE.Vector3(),
    margin: tuning.meadowPlane.cameraMargin, extra: tuning.meadowPlane.cameraExtra };
  private readonly pondFraming = { primary: this.cameraChild, secondary: new THREE.Vector3(), margin: 0.7, extra: 14 };
  private readonly flockBounds = new THREE.Box3();
  private readonly flockCentre = new THREE.Vector3();
  private readonly flockCorner = new THREE.Vector3();
  private readonly flockRight = new THREE.Vector3();
  private readonly flockUp = new THREE.Vector3();
  private readonly flockBack = new THREE.Vector3();
  private readonly departureFraming = { primary: this.cameraChild, secondary: new THREE.Vector3(),
    tertiary: new THREE.Vector3(), margin: 0.7, extra: tuning.crest.departureCameraExtra };
  private crestDone = false;
  private boatMoved = false;
  /** Where the grass is pressed flat while they sit in it, so the cygnet is not lost in a field taller than it is. */
  trodden: THREE.Vector3 | null = null;
  /** The piano on the ridge: the child plays colour into the meadow before walking on. */
  private readonly piano = new PianoStop();
  private nextCall = 0;
  private nextBugle = 0;
  private wentOn = false;
  /** When the child reached the water's edge, and when the family left it; both negative until they happen. */
  private atEdge = -1;
  private leftAt = -1;
  /** Where the child waits and where the cygnet enters and leaves the water. */
  private readonly edge = new THREE.Vector3();
  private readonly bank = new THREE.Vector3();
  private swim: 'settle' | 'enter' | 'out' | 'watch' | 'back' = 'settle';
  private swimAt = 0;
  private readonly swimOut = new THREE.Vector3();
  private readonly dryBank = new THREE.Vector3();
  private kneltAt = -1e3;
  private readonly onCygnet = new THREE.Vector3();
  private readonly returnLook = new THREE.Vector3();
  private readonly side = new THREE.Vector3();
  /** Where the family is, where it was first found, and the horizontal line from the child to it. */
  private readonly far = new THREE.Vector3();
  private readonly axis = new THREE.Vector3(0, 0, -1);

  constructor(private readonly cast: Cast) {
    const { child, plane, cygnet, flock, life } = cast;
    /**
     * The island is asleep, shore and all, and the only colour on it is the patch the piano stands in. Everything
     * that happens to the meadow's colour after this happens because the lullaby got further.
     */
    life.regions.wave.set(PLACE.x, PLACE.z, PATCH.radius, PATCH.soft);
    this.waveTo = PATCH.radius;
    this.piano.onWake = (stage, answered) => this.wake(stage, answered);
    this.piano.onComplete = completeObjective;
    /**
     * The family is on the water from the moment the chapter starts, long before anything in the story points at
     * it. Nothing in this room appears: the player comes over the rise and finds it already there.
     */
    flock.rest(RAFT_AT.x, RAFT_AT.z, tuning.crest.raft, tuning.crest.family, POND_LEVEL);
    cygnet.water = { level: POND_LEVEL, over: overPond };
    plane.water = cygnet.water;
    plane.homeRadius = tuning.meadowPlane.reach;
    child.dismount();
    child.walkTo(BEACH.x, BEACH.y, false, () => this.to('beach'), 0.8);
  }

  /**
   * The wind is only taken away where the player could break a beat. The crest keeps it: the plane is in their
   * hand and nothing in the scene can be blown out of it, so their gusts go on moving the grass all the way
   * through the one scene they are most likely to sit still for.
   */
  get scripted(): boolean {
    return (
      this.arrival.active ||
      this.beat === 'ashore' ||
      this.beat === 'beach' ||
      this.beat === 'climb' ||
      this.beat === 'brow' ||
      this.beat === 'gather' ||
      this.beat === 'toBoat' ||
      this.beat === 'push' ||
      this.beat === 'aboard'
    );
  }

  get done(): boolean {
    return this.beat === 'aboard';
  }

  /** QA: how far the stop at the piano has got, and how far the island has been told to wake. */
  get atPiano(): string {
    return `${this.piano.at} wave=${Math.round(this.cast.life.regions.wave.z)}/${Math.round(this.waveTo)} at ${this.waveSpeed}/s`;
  }

  get checkpoint(): string | null {
    if (this.beat !== 'walk') return null;
    return this.crestDone ? 'pond' : this.piano.at === 'done' ? 'piano' : null;
  }
  saveCheckpoint(): CheckpointPayload<'meadow'> { return [this.leg, this.waveTo, this.waveSpeed, this.dusk, this.duskTarget]; }
  restoreCheckpoint(point: string, data: number[]): void {
    this.leg = THREE.MathUtils.clamp(Math.floor(data[0]), 0, ROUTE.length - 1);
    this.waveTo = data[1]; this.waveSpeed = data[2]; this.dusk = data[3]; this.duskTarget = data[4];
    this.piano.restoreDone();
    this.crestDone = point === 'pond';
    this.beat = 'walk'; this.play = 'hold'; this.holdUntil = 1;
    if (this.crestDone) this.cast.flock.clear();
  }

  /** Story quiet and the piano handover have separate controls; do not apply the piano fade twice. */
  get hush(): number {
    return this.beatHush;
  }

  get pianoMix(): number { return this.piano.hush; }
  get meadowScore(): MeadowScorePhase | undefined {
    // The grey approach and duet retain their existing sound and timing.
    if (this.piano.at !== 'done') return undefined;
    if (this.beat === 'crest' || this.beat === 'down') return 'flock';
    if (this.beat === 'pond') return 'pond';
    if (this.beat === 'gather' || this.beat === 'walk' && this.crestDone) return 'return';
    if (this.beat === 'walk') return 'walk';
    // Carry the last phrase through boarding and the crossing, until Birches' arrival handoff.
    return 'return';
  }
  readonly flockChatter = false;
  get pianoActive(): boolean { return piano.engaged; }

  /** For testing: the green wave has already rolled out and the child is most of the way across. */
  skipAhead(): void {
    const { child, plane } = this.cast;
    this.wokenAlready();
    this.leg = ROUTE.length - 1;
    child.stop();
    child.place(ROUTE[ROUTE.length - 1].x + 4, ROUTE[ROUTE.length - 1].y + 40, Math.PI);
    child.standUp();
    plane.hold(child);
    this.play = 'hold';
    this.duskTarget = this.dusk = 0.45;
    this.to('walk');
  }

  /** For testing: a few paces short of the piano, on a sleeping island, with the walk still to do. */
  skipToPiano(): void {
    const { child, cygnet, plane } = this.cast;
    this.leg = 1;
    child.stop();
    child.place(PIANO_AT.x + 7, PIANO_AT.z + 32, Math.PI);
    child.standUp();
    cygnet.rideIn('satchel');
    cygnet.bind(0.06);
    plane.hold(child);
    this.play = 'hold';
    this.to('walk');
  }

  /** For testing: a few paces short of the rise, cygnet in the satchel and plane in hand, with the crest still to come. */
  skipToCrest(): void {
    const { child, cygnet, plane, flock } = this.cast;
    if (!flock.active) flock.rest(RAFT_AT.x, RAFT_AT.z, tuning.crest.raft, tuning.crest.family, POND_LEVEL);
    this.wokenAlready();
    this.leg = CREST_LEG;
    const at = ROUTE[CREST_LEG];
    const from = ROUTE[CREST_LEG - 1];
    const back = new THREE.Vector2(from.x - at.x, from.y - at.y).normalize().multiplyScalar(CREST_NEAR + 8);
    child.stop();
    child.place(at.x + back.x, at.y + back.y, Math.atan2(-back.x, -back.y));
    child.standUp();
    cygnet.rideIn('satchel');
    cygnet.bind(0.06);
    plane.hold(child);
    this.play = 'hold';
    this.to('walk');
  }

  /**
   * The island waking, phrase by phrase: a ring of colour rolling out from the piano, the wind running ahead of
   * the last one. Nothing here is gated on the player — the piano finishes the lullaby by itself if it has to —
   * so the crest, the pond and the walk on are never taken in grey.
   */
  private wake(stage: number, answered: boolean): void {
    const step = WAKING[Math.min(stage, WAKING.length - 1)];
    this.waveTo = step.reach;
    this.waveSpeed = step.speed * (answered ? 1 : UNANSWERED);
    this.waveFrom = this.now;
    /** Every answer sends a front of moving grass across the field, starting at the instrument. */
    this.gustPower = answered ? 1 : UNANSWERED;
    this.gustUntil = this.now + (stage === 4 ? GUST_FOR : step.reach / step.speed);
  }

  /** For testing, and for the walk that somehow got past the piano: the island is simply awake. */
  private wokenAlready(): void {
    this.piano.restoreDone();
    const { life } = this.cast;
    life.regions.wave.set(PLACE.x, PLACE.z, WAVE_REACH, 90);
    life.regions.waiting.set(0, 0, 0, 0);
    this.waveTo = WAVE_REACH;
    this.waveSpeed = 0;
  }

  /**
   * The great wave of wind that carries the last of it: a front of moving air on the ring of colour, pushed outward
   * where the player is looking, so the grass bends and pales and the petals go up along it all the way to the hills.
   */
  private blowFront(): void {
    const wave = this.cast.life.regions.wave;
    if (this.now > this.gustUntil || wave.z >= WAVE_REACH) return;
    const radius = Math.min(this.waveTo, Math.max(0, this.now - this.waveFrom) * this.waveSpeed);
    for (let i = 0; i < 9; i++) {
      const angle = (i / 8 - 0.5) * Math.PI;
      const ux = Math.sin(angle), uz = -Math.cos(angle), tx = -uz, tz = ux;
      const reach = musicFront(radius, angle);
      const cx = wave.x + ux * reach;
      const cz = wave.y + uz * reach;
      this.cast.wind.addSplat({ source: `meadow-wave-${i}`,
        ax: cx - tx * 15,
        az: cz - tz * 15,
        bx: cx + tx * 15,
        bz: cz + tz * 15,
        vx: (ux * 0.65 + tx * tuning.piano.waveSwirl) * 27 * this.gustPower,
        vz: (uz * 0.65 + tz * tuning.piano.waveSwirl) * 27 * this.gustPower,
        radius: 13,
        energy: 0.9 * this.gustPower,
        swirl: tuning.piano.waveSwirl,
        lift: 0.3 * this.gustPower,
      });
    }
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
    const { child: c, plane: p, life, boat } = this.cast;
    p.guided = this.beat === 'walk';
    // Keep the boat at the landing until the walk has left the arrival bay behind.
    if (!this.boatMoved && this.leg >= CREST_LEG) {
      boat.beach(FAR_SHORE.x, FAR_SHORE.z, 0.2);
      this.boatMoved = true;
    }
    /**
     * The plane leans toward the next waypoint, and on the last leg toward the boat itself. Aimed simply north of
     * the child it made for open water at the far shore, sat on the sea and held the child at the water's edge.
     */
    if (!p.departing) {
      const t = this.planeWaypoint();
      const dx = t.x - c.position.x;
      const dz = t.y - c.position.z;
      const d = Math.hypot(dx, dz) || 1;
      const reach = Math.min(d, tuning.meadowPlane.lead);
      p.home.set(c.position.x + dx / d * reach, 0, c.position.z + dz / d * reach);
      p.homeRadius = tuning.meadowPlane.reach;
    }

    switch (this.beat) {
      case 'ashore':
        c.lookAt = BROW_AT;
        break;
      case 'beach':
        /** Sand, the bank and the sky: they stand and look up at it, and then they climb it. */
        c.lookAt = BROW_AT;
        if (this.t > 2.6) {
          this.to('climb');
          c.walkTo(BROW.x, BROW.y, false, () => this.to('brow'), 1.2);
        }
        break;
      case 'climb':
        c.lookAt = BROW_AT;
        /** However the climb goes, nobody is left on the beach: at the latest they are up it by now. */
        if (this.t > 34) this.to('brow');
        break;
      case 'brow':
        /** And over the top, all of it at once: a grey island, and one patch of colour with a piano in it. */
        c.stop();
        c.lookAt = PIANO_AT;
        if (this.t > 5.5 && !c.busy) this.walkOn();
        break;
      case 'walk':
        if (!this.piano.hold(dt, time, this.cast)) this.updateWalk(time);
        break;
      case 'crest':
        this.updateCrest(dt, time);
        break;
      case 'down':
        this.updateDown(dt, time);
        break;
      case 'pond':
        this.updatePond(dt);
        break;
      case 'gather':
        this.updateGather();
        break;
      case 'push':
        break;
      default:
        break;
    }

    /** The afternoon ages with the walk, but keeps its warmth: the sun does not set until the last island. */
    const progress = THREE.MathUtils.clamp((c.position.z - LANDING.y) / (FAR_SHORE.z - LANDING.y), 0, 1);
    this.duskTarget = Math.max(this.duskTarget, progress * progress * 0.55);
    this.dusk += (this.duskTarget - this.dusk) * (1 - Math.exp(-dt * 0.22));
    /** The shower waits for the crest: the reveal needs the air it clears, not rain across it. */
    if (this.showerStart < 0 && this.beat === 'walk' && this.leg >= 3 && this.crestDone) this.showerStart = this.now;
    if (this.showerStart >= 0) {
      const t = this.now - this.showerStart;
      const { gather, fall, clear } = SHOWER;
      this.shower =
        t < gather
          ? THREE.MathUtils.smoothstep(t, 0, gather)
          : 1 - THREE.MathUtils.smoothstep(t, gather + fall, gather + fall + clear);
    }
    /**
     * From the brow on, the walk faces north over open water toward the next island, so the veil that stands
     * between the swans and it has to stand there until the boat is reached.
     */
    const open = this.crestDone || this.beat === 'crest' || this.beat === 'down' || this.beat === 'pond';
    this.haze += ((open ? tuning.crest.haze : 0.55) - this.haze) * (1 - Math.exp(-dt * (open ? 1.1 : 0.25)));
    /** The fullest music in the game pulls back for the crest, so two bird voices are all there is to hear. */
    const quiet = this.beat === 'crest' || this.beat === 'down' ? 0.45 : this.beat === 'pond' && this.cast.flock.active ? 0.3 : 0;
    this.beatHush += (quiet - this.beatHush) * (1 - Math.exp(-dt * 0.5));
    const wave = life.regions.wave;
    const musicRadius = this.waveFrom < 0 ? 0 : Math.max(0, time - this.waveFrom) * this.waveSpeed;
    if (wave.z >= 0 && wave.z < this.waveTo) {
      // The music crosses already-green ground first, then carries the next colour front with it.
      wave.z = this.waveFrom < 0 ? Math.min(this.waveTo, wave.z + dt * this.waveSpeed)
        : Math.max(wave.z, Math.min(this.waveTo, musicRadius));
    }
    const fade = this.waveFrom < 0 ? 0 : Math.min(1, musicRadius / 5)
      * (1 - THREE.MathUtils.smoothstep(musicRadius, this.waveTo, this.waveTo + this.waveSpeed));
    // Keep untouched ground grey until the colour front has crossed the entire island.
    const covered = Math.hypot(PLACE.x - ISLES.meadow.x, PLACE.z - ISLES.meadow.z)
      + Math.max(ISLES.meadow.rx, ISLES.meadow.rz) + wave.w + 12
      + tuning.piano.growthRoughness + tuning.piano.growthSoftness;
    piano.wave.update(PLACE.x, PLACE.z, Math.min(this.waveTo, musicRadius),
      fade * (1 - THREE.MathUtils.smoothstep(musicRadius, covered, covered + 40)), life);
    if (wave.z > covered && this.waveTo === WAVE_REACH) life.regions.waiting.set(0, 0, 0, 0);
    this.blowFront();

    /** Grown swans are loud. They are heard from a long way down the walk, before there is anything to see. */
    if (!this.wentOn && boat && time > this.nextBugle) {
      const far = Math.hypot(c.position.x - POND_AT.x, c.position.z - POND_AT.z);
      if (far < HEARD_FROM) {
        cue('bugle');
        this.nextBugle = time + (this.beat === 'crest' || this.beat === 'down' ? 5.4 : 9 + Math.random() * 5);
      }
    }
    if (p.held) p.hold(c);
    p.companion = this.beat === 'walk' && !this.arrival.active ? c.position : null;
    this.frame();
    /** The stop at the piano owns the camera while it has the child, and says how fast it should follow. */
    const pianoPace = this.piano.frame(this.shot);
    if (pianoPace !== null) {
      this.pace = pianoPace;
    }
  }

  /**
   * The walk is long and the grass is over the cygnet's head, so it rides in the satchel on their back, where it is in every frame
   * and can watch the plane go over. It only comes down where the camera comes down with it.
   */
  private walkOn(): void {
    const { cygnet, carry } = this.cast;
    /** By the meadow it has stopped being afraid of the wind and started being curious about it. */
    cygnet.mind.trust(0.35);
    carry.stow();
    cygnet.bind(0.06);
    this.to('walk');
    this.play = 'carry';
    this.throwAhead();
  }

  /** The child offers water instead of another attempt at flying on the recovering wing. */
  private setDown(): void {
    const { child: c, carry, cygnet: k } = this.cast;
    c.stop();
    k.mayFly = false;
    this.cast.plane.visible = false;
    this.to('pond');
    this.swim = 'settle';
    this.kneltAt = this.now;
    this.axis.set(POND_AT.x - c.position.x, 0, POND_AT.z - c.position.z).normalize();
    pondEdge(c.position.x, c.position.z, 0.15, this.dryBank);
    this.bank.copy(this.dryBank);
    // Find actual water on this approach, including the irregular, shallow lip of the pond.
    for (let d = 0; d < 12; d += 0.15) {
      this.bank.copy(this.dryBank).addScaledVector(this.axis, d);
      if (overPond(this.bank.x, this.bank.z)) break;
    }
    this.bank.y = POND_LEVEL;
    this.swimOut.copy(this.bank).addScaledVector(this.axis, tuning.wingCare.pondOut);
    this.trodden = new THREE.Vector3(c.position.x, 12, c.position.z);
    c.faceToward(POND_AT.x, POND_AT.z, 1);
    carry.unstow(() => carry.setDown(() => {
      this.swim = 'enter';
      this.swimAt = this.now;
      k.stay = false;
      k.pace = 0.55;
      k.errand = this.bank;
    }, Math.atan2(this.axis.x, this.axis.z)));
  }

  /** A short paddle after the departing family, a look back, and the choice to return to waiting hands. */
  private updatePond(dt: number): void {
    const { child: c, cygnet: k, flock, carry } = this.cast;
    c.lookAt = k.eye(this.onCygnet);
    if (flock.active && this.t > tuning.crest.watches) { flock.clear(); k.watch(null); }
    if (this.swim === 'settle' || carry.busy) return;
    c.kneeling += (1 - c.kneeling) * (1 - Math.exp(-dt * 2));
    c.reachLocal(0, this.tmp.set(0.17, 0.53, 0.43));
    c.reachLocal(1, this.tmp.set(-0.17, 0.53, 0.43));
    if (this.swim === 'enter') {
      if (Math.hypot(k.position.x - this.bank.x, k.position.z - this.bank.z) < 0.8) {
        k.errand = null;
        k.swimLevel = POND_LEVEL;
        k.swimTo(this.bank);
        k.swimTo(this.swimOut);
        this.swim = 'out'; this.swimAt = this.now;
      } else if (this.now - this.swimAt > tuning.wingCare.pondEntryLimit) {
        // A blocked bank still ends in the same act of care; never wait forever on terrain navigation.
        k.errand = null; k.stay = true;
        this.finishPond();
      }
      return;
    }
    if (this.swim === 'out') {
      k.swimTo(this.swimOut);
      if (Math.hypot(k.position.x - this.swimOut.x, k.position.z - this.swimOut.z) < 0.7
        || this.now - this.swimAt > tuning.wingCare.pondReturnAfter) {
        this.swimOut.copy(k.position);
        k.watch(this.far);
        this.swim = 'watch'; this.swimAt = this.now;
      }
    } else if (this.swim === 'watch') {
      k.swimTo(this.swimOut);
      if (this.now - this.swimAt > tuning.wingCare.pondWatchFor) {
        k.watch(c.face(this.returnLook));
        this.swim = 'back'; this.swimAt = this.now;
      }
    } else {
      c.face(this.returnLook);
      k.swimTo(this.bank);
      if (Math.hypot(k.position.x - this.bank.x, k.position.z - this.bank.z) < 0.7) {
        k.ashore(this.dryBank.x, this.dryBank.z, Math.atan2(-this.axis.x, -this.axis.z));
        k.stay = true; k.pace = 1;
        k.bind(0.2);
        completeObjective();
        this.finishPond();
      }
    }
  }

  private finishPond(): void {
    this.cast.cygnet.mayFly = false;
    this.cast.child.reachFor(0, null);
    this.cast.child.reachFor(1, null);
    this.to('gather');
  }

  /** Receive it in the same patient hands used throughout the journey. */
  private updateGather(): void {
    const { child: c, cygnet, carry } = this.cast;
    if (c.busy || carry.busy) return;
    if (c.sitting) {
      c.standUp();
      return;
    }
    this.gatherUp(() => {
      carry.stow(() => {
        cygnet.mayFly = true;
        cygnet.stay = false; cygnet.pace = 1;
        this.trodden = null;
        this.to('walk');
        this.cast.plane.visible = true;
        this.play = this.cast.plane.held ? 'hold' : 'watch';
        this.holdUntil = this.now + 1;
      });
    });
  }

  /** Crouches, gathers the cygnet into the arms, and stands up again. */
  private gatherUp(then: () => void): void {
    const { child: c, cygnet, carry, flock } = this.cast;
    flock.clear();
    cygnet.watch(null);
    carry.gatherUp(() => {
      c.lookAt = null;
      then();
    });
  }

  private target(): THREE.Vector2 {
    return ROUTE[Math.min(this.leg, ROUTE.length - 1)];
  }

  /** Throws and airborne steering share the same next stop, including after a detour past a route marker. */
  private planeWaypoint(): THREE.Vector2 {
    const next = this.target();
    const piano = this.piano.waypoint(next);
    if (piano !== next) return piano;
    if (this.leg >= CREST_LEG && !this.crestDone) return this.planeGoal.set(POND_AT.x, POND_AT.z);
    if (this.leg === ROUTE.length - 1) {
      const boat = this.cast.boat.position;
      return this.aroundPond(boat.x, boat.z, this.planeGoal);
    }
    return this.aroundPond(next.x, next.y, this.planeGoal);
  }

  /** Once the swim is over, lead around the bank; a straight pursuit across the pond stops at the water. */
  private aroundPond(x: number, z: number, out: THREE.Vector2): THREE.Vector2 {
    out.set(x, z);
    const c = this.cast.child.position;
    if (!this.crestDone || Math.hypot(c.x - POND.x, c.z - POND.z) > 60) return out;
    const distance = Math.hypot(x - c.x, z - c.z);
    for (let d = 1; d < distance; d += 1) {
      const sx = c.x + (x - c.x) * d / distance;
      const sz = c.z + (z - c.z) * d / distance;
      if (pondOut(sx, sz) >= 1.15 || heightAt(sx, sz) >= POND_LEVEL + 0.2) continue;
      // A short outward arc follows whichever side of the pond they already stand on.
      const angle = Math.atan2((c.x - POND.x) / POND.rx, (c.z - POND.z) / POND.rz);
      const goalAngle = Math.atan2((x - POND.x) / POND.rx, (z - POND.z) / POND.rz);
      const turn = Math.atan2(Math.sin(goalAngle - angle), Math.cos(goalAngle - angle));
      const ahead = angle + THREE.MathUtils.clamp(turn, -0.4, 0.4);
      return out.set(POND.x + Math.sin(ahead) * POND.rx * 1.6, POND.z + Math.cos(ahead) * POND.rz * 1.6);
    }
    return out;
  }

  /**
   * The one moment the dream tells you what you are doing, and the scene the rest of the game leans on. It is
   * heard before it is seen: the grown swans bugle from the hollow ahead, the cygnet hears them first and
   * stretches up out of the satchel, and the child stops and turns to look where it is looking. The haze thins,
   * and over the rise, below them, there is a pond with the cygnet's family resting on it.
   */
  private updateCrest(dt: number, time: number): void {
    const { child: c, cygnet, flock } = this.cast;
    const { answers, looks } = tuning.crest;
    this.far.set(flock.head.x, flock.head.y + 1.2, flock.head.z);
    cygnet.watch(this.far);
    /** The child walks on for a pace, unaware, and then stops and comes round to what the cygnet can hear. */
    if (this.t > answers) {
      if (c.moving) c.stop();
      c.lookAt = this.far;
      c.faceToward(this.far.x, this.far.z, 1 - Math.exp(-dt * 1.7));
      // The adults are calling to one another for departure. The small one watches before trying
      // to reach them; no parent hears its call here and then deliberately turns away.
    }
    /** Then they go down to it, because the cygnet in the satchel is straining at the sight of them. */
    if (this.t > looks && !c.busy) this.goDown();
  }

  /** Down off the rise to the water, where they stop, because there is nothing else to do about it. */
  private goDown(): void {
    const { child: c, flock } = this.cast;
    pondEdge(c.position.x, c.position.z, tuning.crest.standOff, this.edge);
    this.to('down');
    this.atEdge = -1;
    this.wentOn = true;
    this.leftAt = this.now;
    this.nextCall = this.now + tuning.crest.migrationLeadFor;
    cue('bugle');
    // Departure begins at the north of the raft, independently of the child's distance.
    // Hold on the rise long enough to see that they were already leaving.
    flock.lift(Math.PI, tuning.crest.leaves, tuning.crest.leaveClimb);
  }

  /**
   * The family is already migrating when the child starts down. The little one calls after the departing
   * birds; the child offers a safe paddle and waiting hands when it cannot follow them into the sky yet.
   */
  private updateDown(dt: number, time: number): void {
    const { child: c, cygnet, flock } = this.cast;
    const { setsDown, migrationLeadFor } = tuning.crest;
    if (this.atEdge === -1 && this.t > migrationLeadFor) {
      this.atEdge = -2;
      c.walkTo(this.edge.x, this.edge.z, false, () => (this.atEdge = this.now), 1.2);
    }
    if (flock.active) this.far.set(flock.head.x, flock.head.y + 1.2, flock.head.z);
    cygnet.watch(this.far);
    c.lookAt = this.far;
    if (time > this.nextCall) {
      cue('calling');
      cygnet.call(true);
      this.nextCall = time + 5 + Math.random();
    }
    if (this.atEdge >= 0 && !c.moving && !c.busy) c.faceToward(POND_AT.x, POND_AT.z, 1 - Math.exp(-dt * 1.6));
    if (this.wentOn && this.atEdge >= 0 && !c.moving
      && this.now - this.leftAt > setsDown + tuning.crest.pondReturn && !c.busy) this.setDown();
  }

  /** The family comes up out of the meadow ahead, and the walk stops where it stands for it. */
  private reveal(): void {
    const { child: c, cygnet, flock } = this.cast;
    this.crestDone = true;
    this.to('crest');
    this.nextCall = this.now + tuning.crest.answers;
    /** Everything from here is aimed at the water: the camera, the child, the set-down and the runs after it. */
    this.axis.set(POND_AT.x - c.position.x, 0, POND_AT.z - c.position.z).normalize();
    this.far.copy(flock.active ? flock.head : POND_AT);
    cygnet.watch(this.far);
  }

  /**
   * On the rise itself, with the north of the island in front of them. The walk follows the plane and not the
   * waypoints, so the scene fires when they come up near the crest and, whatever the player has done with the
   * plane, at the latest as they pass it: the one moment that explains the journey is never skipped.
   */
  private onCrest(): boolean {
    if (this.leg < CREST_LEG) return false;
    const c = this.cast.child.position;
    const crest = ROUTE[CREST_LEG];
    return Math.hypot(c.x - crest.x, c.z - crest.y) < CREST_NEAR || c.z < crest.y;
  }

  private updateWalk(time: number): void {
    const { child: c, plane: p, boat } = this.cast;
    // The paper was stowed for the duet; hand it back to the walking/throwing loop afterward.
    if (p.held && this.play !== 'hold') {
      this.play = 'hold';
      this.holdUntil = time + 0.8;
    }
    const t = this.target();
    /** A waypoint is behind them once they are near it or past it: the stop at the piano takes them well past one. */
    const reached = Math.hypot(c.position.x - t.x, c.position.z - t.y) < 38 || c.position.z < t.y - 12;
    if (reached && this.leg < ROUTE.length - 1) this.leg++;
    const last = this.leg === ROUTE.length - 1;

    /** Walking is exactly the state the reveal wants to interrupt; a throw or a pick-up is left to finish. */
    if (!this.crestDone && this.onCrest() && (c.moving || !c.busy)) {
      this.reveal();
      return;
    }

    const childNear = Math.hypot(c.position.x - boat.position.x, c.position.z - boat.position.z) < BOARDING;
    if (this.arrival.update(this.cast, last && this.crestDone && (childNear || time - this.beatStart > 220), () => this.board())) return;

    if (time > this.nextLook && this.play === 'watch') {
      this.nextLook = time + 7;
      if (this.cast.nearby(c.position.x, c.position.z, 9, this.watched)) this.watchUntil = time + 3;
    }
    if (time < this.watchUntil && this.play === 'watch') {
      c.lookAt = this.watched;
      if (p.landed) this.fetch();
      return;
    }

    if (this.play === 'watch') {
      c.lookAt = p.position;
      if (p.landed) this.fetch();
      else if (!c.acting && time >= this.nextChase &&
        Math.hypot(p.position.x - c.position.x, p.position.z - c.position.z) > tuning.meadowPlane.chaseFrom) {
        const aim = this.aroundPond(p.position.x, p.position.z, this.walkGoal);
        if (c.moving) c.retargetWalk(aim.x, aim.y);
        else c.walkTo(aim.x, aim.y, false, undefined, tuning.meadowPlane.chaseNear);
        this.nextChase = time + tuning.meadowPlane.retargetEvery;
      }
    } else if (this.play === 'fetch') {
      c.lookAt = p.position;
      if (!p.landed && p.airborne) this.play = 'watch';
    } else if (this.play === 'hold' && !c.busy) {
      if (time > this.holdUntil) this.throwAhead();
    }
  }

  private throwAhead(): void {
    const c = this.cast.child;
    const t = this.planeWaypoint();
    const angle = Math.atan2(t.x - c.position.x, t.y - c.position.z) + (Math.random() - 0.5) * 0.5;
    /**
     * The longest walk in the game, over open ground: it is thrown a good way out ahead and they go after it
     * without dawdling. A measured playthrough spent five minutes on the last stretch alone at the old stride.
     */
    c.throwToward(c.position.x + Math.sin(angle) * 34, c.position.z + Math.cos(angle) * 34, () => {
      this.cast.plane.launch(c.handPosition(this.hand), this.tmp.set(Math.sin(angle) * 10.6, 5.2, Math.cos(angle) * 10.6));
      this.play = 'watch';
      c.lookAt = this.cast.plane.position;
    });
  }

  private fetch(): void {
    const { child: c, plane: p } = this.cast;
    this.play = 'fetch';
    const aim = this.aroundPond(p.position.x, p.position.z, this.walkGoal);
    c.walkTo(aim.x, aim.y, true, () => {
      if (this.play !== 'fetch') return;
      if (Math.hypot(p.position.x - c.position.x, p.position.z - c.position.z) > 2.6 || !p.landed) {
        this.play = 'watch';
        return;
      }
      c.pickUp(() => {
        p.hold(c);
        this.play = 'hold';
        this.holdUntil = this.now + 0.4 + Math.random() * 0.55;
      });
    }, 1.2);
  }

  /** The far shore: the child walks down to the boat that is somehow here, and pushes off again. */
  private board(): void {
    const { child: c, boat } = this.cast;
    this.to('toBoat');
    c.lookAt = null;
    const beside = boat.boardingPoint(this.tmp);
    c.walkTo(beside.x, beside.z, false, () => {
      this.gatherUp(() => {
        this.to('push');
        c.faceToward(boat.position.x, boat.position.z, 1);
        c.board(boat, () => this.to('aboard'));
      });
    }, 0.5);
  }

  private frame(): void {
    const c = this.cast.child.position;
    const p = this.cast.plane.position;
    const s = this.shot;
    s.from = undefined;
    // The low pond view follows the open water beside the bank; preserve that staged approach.
    s.composition = ['down', 'crest', 'pond', 'gather'].includes(this.beat) ? 'hold' : undefined;
    s.eye = undefined;
    s.subjects = undefined;
    s.fitWidth = false;
    s.clearance = 2.8;
    // A narrower angle stacks the companions diagonally on a phone, so fitting them need not shrink them.
    const pondView = typeof window !== 'undefined' && window.innerHeight > window.innerWidth
      ? tuning.crest.pondPortraitView : tuning.crest.pondView;
    if (this.beat === 'ashore' || this.beat === 'beach' || this.beat === 'climb' || this.beat === 'brow') {
      /**
       * The climb, from below and behind: on the beach the bank fills the frame and there is nothing over it but
       * sky, which is the whole point of landing here. On the top the camera comes round onto the line to the
       * piano, so what the player sees over the brow is the grey island with the one patch of colour in it.
       */
      const top = this.beat === 'brow';
      const look = top ? PIANO_AT : BROW_AT;
      /**
       * On the way up the camera stands off to the side of the bank rather than below it, because from below a
       * rig that answers a hill by rising ends up looking down the slope at the top of the child's head. In
       * profile they are plainly climbing, against the sky the bank is hiding everything else behind.
       */
      const bearing = Math.atan2(c.x - look.x, c.z - look.z) + (top ? 0 : 1.15);
      s.from = this.side.set(Math.sin(bearing), 0, Math.cos(bearing));
      const ground = Math.max(heightAt(c.x, c.z), 0);
      const toward = top ? 0.04 : 0.16;
      s.target.set(c.x + (look.x - c.x) * toward, ground + (top ? 3.4 : 2.4), c.z + (look.z - c.z) * toward);
      s.distance = top ? 21 : 19;
      s.height = top ? 7.5 : 2.6;
      this.pace = top ? 0.9 : 0.4;
      this.focus.set(c.x, ground, c.z);
      return;
    }
    if (this.beat === 'pond' || this.beat === 'gather') {
      const k = this.cast.cygnet.position;
      const ground = Math.max(heightAt(c.x, c.z), 0);
      const gap = Math.hypot(k.x - c.x, k.z - c.z);
      // Look back from over the water: no uphill bank or tall foreground grass between us and their hands.
      const bearing = Math.atan2(c.x - POND_AT.x, c.z - POND_AT.z) + pondView;
      s.from = this.side.set(Math.sin(bearing), 0, Math.cos(bearing));
      s.target.set((k.x + c.x) * 0.5, (k.y + ground) * 0.5 + 0.55, (k.z + c.z) * 0.5);
      s.distance = tuning.crest.pondCameraBack + gap * 0.55;
      s.height = tuning.crest.pondCameraUp;
      s.clearance = 2;
      this.cameraChild.copy(c).y += 0.9;
      this.pondFraming.secondary.copy(k).y += 0.35;
      s.subjects = this.pondFraming;
      this.pace = this.now - this.kneltAt < 3.5 ? 1.1 : 0.7;
      this.focus.copy(s.target);
      return;
    }
    if (this.beat === 'down' || this.beat === 'crest') {
      // Establish the whole family while the child is still on the rise, then keep that view for departure.
      // Stay on the family's side of the scene through the last take-off, then turn toward the hands.
      // Freeze their last framing bounds during the return so the departing leader cannot drag the shot away.
      const sinceLift = this.leftAt < 0 ? 0 : this.now - this.leftAt;
      const close = THREE.MathUtils.smoothstep(sinceLift, tuning.crest.setsDown,
        tuning.crest.setsDown + tuning.crest.pondReturn);
      if (close === 0) this.cast.flock.bounds(this.flockBounds);
      this.flockBounds.getCenter(this.flockCentre);
      const bearing = THREE.MathUtils.lerp(REVEAL.swing,
        Math.atan2(c.x - POND_AT.x, c.z - POND_AT.z) + pondView, close);
      const reach = c.distanceTo(this.flockCentre);
      s.from = this.side.set(Math.sin(bearing), 0, Math.cos(bearing));
      this.tmp.copy(c).lerp(POND_AT, 0.12).y += 0.9;
      s.target.copy(c).lerp(this.flockCentre, tuning.crest.departureToward).lerp(this.tmp, close);
      s.distance = THREE.MathUtils.lerp(tuning.crest.departureCameraBack + reach * tuning.crest.departureCameraReach,
        tuning.crest.pondCameraBack + 1, close);
      s.height = THREE.MathUtils.lerp(Math.max(REVEAL.up, c.y + tuning.crest.departureCameraUp - s.target.y),
        tuning.crest.pondCameraUp, close);
      this.cameraChild.copy(c).y += 1.2;
      if (close === 0) {
        // Enclose all eight corners in the shot's own plane. A world-space diagonal misses the
        // opposite wing of the V in portrait, especially while some birds are still on the water.
        this.flockBack.copy(this.side).multiplyScalar(s.distance).setY(s.height).normalize();
        this.flockRight.set(this.side.z, 0, -this.side.x);
        this.flockUp.crossVectors(this.flockBack, this.flockRight);
        let left = Infinity, right = -Infinity, bottom = Infinity, top = -Infinity, near = -Infinity;
        const { min, max } = this.flockBounds;
        for (const x of [min.x, max.x]) for (const y of [min.y, max.y]) for (const z of [min.z, max.z]) {
          this.flockCorner.set(x, y, z).sub(this.flockCentre);
          const across = this.flockCorner.dot(this.flockRight), up = this.flockCorner.dot(this.flockUp);
          left = Math.min(left, across); right = Math.max(right, across);
          bottom = Math.min(bottom, up); top = Math.max(top, up);
          near = Math.max(near, this.flockCorner.dot(this.flockBack));
        }
        this.departureFraming.secondary.copy(this.flockCentre).addScaledVector(this.flockRight, left)
          .addScaledVector(this.flockUp, bottom).addScaledVector(this.flockBack, near);
        this.departureFraming.tertiary.copy(this.flockCentre).addScaledVector(this.flockRight, right)
          .addScaledVector(this.flockUp, top).addScaledVector(this.flockBack, near);
      } else {
        // Only the child needs the frame once the departure has been seen.
        this.departureFraming.secondary.copy(this.cameraChild);
        this.departureFraming.tertiary.copy(this.cameraChild);
      }
      s.subjects = this.departureFraming;
      this.pace = 1.1;
      this.focus.copy(c);
      return;
    }
    if (this.beat === 'toBoat' || this.beat === 'push' || this.beat === 'aboard') {
      const b = this.cast.boat.position;
      // Look back from the water as they descend the far shore. The inland view hid the boarding
      // behind the grassy bank, although the sail and the camera's target remained visible.
      s.from = this.boardingView;
      s.target.set((c.x + b.x) / 2, Math.max(c.y, b.y) + 1.5, (c.z + b.z) / 2);
      s.distance = 28;
      s.height = 7;
      this.cameraChild.copy(c).y += 1.2;
      this.framing.secondary.copy(b).y += 1.5;
      s.subjects = this.framing;
      this.pace = 0.35;
      this.focus.copy(b);
      return;
    }
    const guide = tuning.meadowPlane;
    const gap = Math.hypot(p.x - c.x, p.z - c.z);
    const pw = this.cast.plane.held ? 0 : Math.min(0.25, guide.cameraLead / Math.max(gap, 1));
    const fx = c.x + (p.x - c.x) * pw;
    const fz = c.z + (p.z - c.z) * pw - 3;
    const ground = Math.max(c.y, 0);
    s.target.set(fx, ground + 3 + (this.cast.plane.held ? 0 : Math.min(guide.cameraRise, Math.max(0, p.y - ground - 6) * 0.35)), fz);
    s.distance = guide.cameraBack;
    s.height = 13;
    this.cameraChild.copy(c).y += 1.2;
    this.framing.secondary.copy(this.cast.plane.held ? this.cameraChild : p);
    s.subjects = this.framing;
    this.pace = guide.cameraPace;
    this.focus.set(fx, ground, fz);
  }
}
