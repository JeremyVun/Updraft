import * as THREE from 'three';
import type { Shot } from '../camera';
import { BANK, POND, POND_LEVEL, mainlandCoastZ, meadowPoint, pondOut } from '../world/heightfield';
import { WAY } from '../world/fields';
import { PATCH, PLACE } from '../world/piano';
import { heightAt } from '../world/island';
import type { Coax } from '../fx/swirl';
import type { Cast, Chapter } from './cast';
import { LANDING } from './crossing';
import { completeObjective, cue } from './cues';
import { PianoStop } from './piano';
import { tuning } from '../tuning';

type Beat = 'ashore' | 'beach' | 'climb' | 'brow' | 'walk' | 'crest' | 'down' | 'try' | 'glide' | 'toBoat' | 'push' | 'aboard';
type Play = 'carry' | 'watch' | 'fetch' | 'hold';

/** The way inland, across the meadow to its far shore. The walls are built around the same line: `WAY` in `fields.ts`. */
export const ROUTE = WAY.slice(1).map((p) => new THREE.Vector2(p.x, p.z));

/** The top of the bank over the landing, where the island is first seen, and where the beach waits below it. */
const BROW = new THREE.Vector2(BANK.x + 1, BANK.crest - 2);
const BEACH = new THREE.Vector2(LANDING.x - 2, mainlandCoastZ(LANDING.x) - 4);
/** The piano, and the patch of colour it stands in: the one thing awake on a sleeping island. */
const PIANO_AT = new THREE.Vector3(PLACE.x, heightAt(PLACE.x, PLACE.z) + 1.2, PLACE.z);
const BROW_AT = new THREE.Vector3(BROW.x, heightAt(BROW.x, BROW.y) + 1.6, BROW.y);
const shore = meadowPoint(-6, -1172);
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
/**
 * How far the colour has reached, and how fast it rolls there, each time the lullaby gets further: the hollow round
 * the piano, then out over the crest and the pond, then the whole island on the last one. The great wave is the
 * spectacle of the room, so it is the only one the wind itself runs ahead of, and it rolls slowly enough that its
 * front is still crossing the meadow while the camera is rising off the piano to watch it.
 */
const WAKING = [
  { reach: PATCH.radius, speed: 0 },
  { reach: 80, speed: 15 },
  { reach: 168, speed: 40 },
  { reach: WAVE_REACH, speed: 20 },
];
/** How long the wind keeps driving the last wave across the island, and how quiet a wake nobody answered is. */
const GUST_FOR = 15;
const UNANSWERED = 0.45;
/** The sun shower on the walk: it gathers, falls steadily, then drifts away (seconds). */
const SHOWER = { gather: 10, fall: 30, clear: 16 };
/** How near the boat the plane has to land before the child takes the hint. */
const BOARDING = 16;
/** How long the cygnet is left trying, and how often it has a go, before the child gives up and carries it on. */
const TRY_FOR = tuning.colt.tryFor;
const TRY_EVERY = 5.5;

/**
 * The meadow: the last warm afternoon of the year, and the island is asleep. The boat lands in a bay under a bank,
 * and the whole room is over the top of it — a grey island with one patch of colour in it and a piano standing
 * there. The lullaby wakes the rest, wave by wave. The long walk follows the plane through a sun shower, over the
 * crest and down to the pond, and ends where the boat is drawn up on the far shore.
 */
export class MeadowChapter implements Chapter {
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
  private gustUntil = 0;
  private gustPower = 1;
  private showerStart = -1;
  private holdUntil = 0;
  private duskTarget = 0;
  private now = 0;
  private readonly hand = new THREE.Vector3();
  private readonly tmp = new THREE.Vector3();
  private readonly watched = new THREE.Vector3();
  private watchUntil = 0;
  private nextLook = 0;
  private crestDone = false;
  private boatMoved = false;
  private cheeredFlight = false;
  /** Where the grass is pressed flat while they sit in it, so the cygnet is not lost in a field taller than it is. */
  trodden: THREE.Vector3 | null = null;
  /** The piano standing in the grass off the walk, and the optional stop the child makes at it. */
  private readonly piano = new PianoStop();
  private nextTry = 0;
  private nextCall = 0;
  /** When the wind starts showing the player the gesture the cygnet is waiting for, and the shape it draws there. */
  private coaxFrom = 0;
  private readonly coaxing = { at: new THREE.Vector3(), urgency: 0 };
  private nextBugle = 0;
  private wentOn = false;
  /** When the child reached the water's edge, and when the family left it; both negative until they happen. */
  private atEdge = -1;
  private leftAt = -1;
  /** Where the child stands to watch them, and which way along the shore the cygnet runs on its next try. */
  private readonly edge = new THREE.Vector3();
  private readonly along = new THREE.Vector3();
  private readonly bank = new THREE.Vector3();
  private runSide = 1;
  private kneltAt = -1e3;
  private readonly onCygnet = new THREE.Vector3();
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
    /**
     * The family is on the water from the moment the chapter starts, long before anything in the story points at
     * it. Nothing in this room appears: the player comes over the rise and finds it already there.
     */
    flock.rest(RAFT_AT.x, RAFT_AT.z, tuning.crest.raft, tuning.crest.family, POND_LEVEL);
    cygnet.water = { level: POND_LEVEL, over: overPond };
    plane.homeRadius = 70;
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
      this.beat === 'ashore' ||
      this.beat === 'beach' ||
      this.beat === 'climb' ||
      this.beat === 'brow' ||
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
  saveCheckpoint(): number[] { return [this.leg, this.waveTo, this.waveSpeed, this.dusk, this.duskTarget]; }
  restoreCheckpoint(point: string, data: number[]): void {
    this.leg = THREE.MathUtils.clamp(Math.floor(data[0]), 0, ROUTE.length - 1);
    this.waveTo = data[1]; this.waveSpeed = data[2]; this.dusk = data[3]; this.duskTarget = data[4];
    this.piano.restoreDone();
    this.crestDone = point === 'pond';
    this.beat = 'walk'; this.play = 'hold'; this.holdUntil = 1;
    if (this.crestDone) this.cast.flock.clear();
  }

  /** The music makes room while the child is sitting at the piano, so the player hears what they are playing. */
  get hush(): number {
    return Math.max(this.beatHush, this.piano.hush);
  }

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
    if (stage < 3) return;
    /** Once it is all awake the wind wakes ground the ordinary way again, wherever the journey goes next. */
    this.cast.life.regions.waiting.set(0, 0, 0, 0);
    completeObjective();
    /** The wind runs ahead of the last wave whoever finished the tune; for a player who never joined in, softly. */
    this.gustPower = answered ? 1 : UNANSWERED;
    this.gustUntil = this.now + GUST_FOR * (answered ? 1 : 0.7);
  }

  /** For testing, and for the walk that somehow got past the piano: the island is simply awake. */
  private wokenAlready(): void {
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
    const at = this.shot.target;
    const dx = at.x - wave.x;
    const dz = at.z - wave.y;
    const d = Math.hypot(dx, dz) || 1;
    const ux = dx / d;
    const uz = dz / d;
    const tx = -uz;
    const tz = ux;
    for (let i = -1; i <= 1; i++) {
      const cx = wave.x + ux * wave.z + tx * i * 30;
      const cz = wave.y + uz * wave.z + tz * i * 30;
      this.cast.wind.addSplat({
        ax: cx - tx * 15,
        az: cz - tz * 15,
        bx: cx + tx * 15,
        bz: cz + tz * 15,
        vx: ux * 27 * this.gustPower,
        vz: uz * 27 * this.gustPower,
        radius: 13,
        energy: 0.9 * this.gustPower,
        swirl: 0,
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
      const next = this.target();
      const t = this.piano.waypoint(next, c.position);
      /** The stop at the piano is the next thing to do for as long as it says so, whichever leg the walk is on. */
      const pianoAhead = t !== next;
      if (this.leg === ROUTE.length - 1) {
        p.home.set(boat.position.x, 0, boat.position.z);
        p.homeRadius = 26;
      } else if (this.leg >= CREST_LEG && !this.crestDone && !pianoAhead) {
        /** The signpost leans at what there is to find: over the rise, that is the white birds on the water. */
        p.home.set(POND_AT.x, 0, POND_AT.z);
        p.homeRadius = 34;
      } else {
        const dx = t.x - c.position.x;
        const dz = t.y - c.position.z;
        const d = Math.hypot(dx, dz) || 1;
        const reach = Math.min(d, 25);
        p.home.set(c.position.x + (dx / d) * reach, 0, c.position.z + (dz / d) * reach);
        p.homeRadius = 70;
      }
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
      case 'try':
        this.updateTry(time);
        break;
      case 'glide':
        this.updateGlide();
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
    const open = this.crestDone || this.beat === 'crest' || this.beat === 'down' || this.beat === 'try' || this.beat === 'glide';
    this.haze += ((open ? tuning.crest.haze : 0.55) - this.haze) * (1 - Math.exp(-dt * (open ? 1.1 : 0.25)));
    /** The fullest music in the game pulls back for the crest, so two bird voices are all there is to hear. */
    const quiet = this.beat === 'crest' || this.beat === 'down' ? 0.45 : this.beat === 'try' && this.cast.flock.active ? 0.3 : 0;
    this.beatHush += (quiet - this.beatHush) * (1 - Math.exp(-dt * 0.5));
    const wave = life.regions.wave;
    if (wave.z >= 0 && wave.z < this.waveTo) wave.z = Math.min(this.waveTo, wave.z + dt * this.waveSpeed);
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
    this.frame();
    /** The stop at the piano owns the camera while it has the child, and says how fast it should follow. */
    this.pace = this.piano.frame(this.shot) ?? this.pace;
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

  /**
   * Straight out of the reveal and in the same place: the cygnet is stood down in the grass facing the way they
   * went, and the child kneels to it and then sits. It has just watched its family leave without it.
   */
  private setDown(): void {
    const { child: c, carry } = this.cast;
    const { setDownAt, firstTry } = tuning.crest;
    c.stop();
    this.to('try');
    this.nextTry = 1e9;
    this.kneltAt = this.now;
    /** Along the bank rather than at the water, so a run at flying goes down the shore and never off into the pond. */
    this.axis.set(c.position.x - POND_AT.x, 0, c.position.z - POND_AT.z).normalize();
    this.along.set(-this.axis.z, 0, this.axis.x);
    /** Wide enough to take the camera as well as the two of them, or the near grass fills the whole frame. */
    this.trodden = new THREE.Vector3(c.position.x + this.along.x * setDownAt * 0.6, 12, c.position.z + this.along.z * setDownAt * 0.6);
    /** Out of the satchel and down beside them at the edge, facing north after the family and not at the child. */
    c.faceToward(c.position.x + this.along.x, c.position.z + this.along.z, 1);
    carry.unstow(() => carry.setDown(() => (this.nextTry = this.now + firstTry), Math.PI));
  }

  /**
   * The beat the whole game turns on after the fall. It faces the wind and tries, and cannot. The child sits down
   * to watch, the plane stays in their hand, and there is nothing else on screen — so sooner or later the player
   * puts the wind under it, and finds out that they are the reason it can fly. Nothing is asked and nothing is
   * failed: if the player never does it, the child eventually gathers it up and walks on, and it will try again.
   */
  get invitesFlight(): boolean {
    return this.beat === 'try' || this.beat === 'glide';
  }

  private updateTry(time: number): void {
    const { child: c, cygnet, flock } = this.cast;
    if (cygnet.flying) {
      this.to('glide');
      return;
    }
    /** It keeps calling after them while they are still up there, and they are gone before it gives up on them. */
    if (flock.active) {
      this.far.copy(flock.head);
      if (this.t > tuning.crest.watches) {
        flock.clear();
        cygnet.watch(null);
      } else if (time > this.nextCall) {
        cue('calling');
        cygnet.call(true);
        this.nextCall = time + 5 + Math.random();
      }
    }
    c.lookAt = cygnet.eye(this.onCygnet);
    if (this.swimHome(time)) return;
    if (time > this.nextTry && !cygnet.carried) {
      cygnet.tryToFly(this.runBearing());
      if (this.coaxFrom === 0) this.coaxFrom = time + tuning.swirl.coaxAfter;
      this.nextTry = time + TRY_EVERY;
      /** They settle in to watch it, but only before it has ever managed it: after that they stay on their feet. */
      if (this.t > TRY_EVERY * 1.5 && cygnet.flights === 0 && !c.sitting && !c.busy) c.sitDown();
    }
    if (this.t > TRY_FOR && !c.busy) {
      if (c.sitting) {
        c.standUp();
        return;
      }
      this.walkTo(cygnet.position, () => {
        this.gatherUp(() => {
          this.cast.carry.stow();
          this.trodden = null;
          this.to('walk');
          /** The plane is nearly always still in their hand; if the reveal caught it out in the grass, they fetch it. */
          this.play = this.cast.plane.held ? 'hold' : 'watch';
          this.holdUntil = this.now + 1;
        });
      });
    }
  }

  /**
   * Where the next run goes: up and down the shore, turning round at each end, so it is always broadside to the
   * camera and always within a cursor's reach of where it started. Nothing it does takes it out of the frame.
   */
  private runBearing(): number {
    const { cygnet } = this.cast;
    const home = this.trodden;
    if (!home) return Math.atan2(this.along.x * this.runSide, this.along.z * this.runSide);
    const out = (cygnet.position.x - home.x) * this.along.x + (cygnet.position.z - home.z) * this.along.z;
    if (out * this.runSide > 2.6) this.runSide = -this.runSide;
    return Math.atan2(this.along.x * this.runSide, this.along.z * this.runSide);
  }

  /**
   * It came down on the water. Nothing has gone wrong — it is a swan — so it paddles back to the bank in front of
   * the child, climbs out, shakes, and is standing there ready to go again.
   */
  private swimHome(time: number): boolean {
    const { child: c, cygnet } = this.cast;
    if (cygnet.state !== 'swimming') return false;
    c.stop();
    pondEdge(c.position.x, c.position.z, -0.4, this.bank);
    cygnet.swimTo(this.bank);
    if (Math.hypot(cygnet.position.x - this.bank.x, cygnet.position.z - this.bank.z) < 1.1) {
      cygnet.ashore(this.trodden?.x ?? this.side.x, this.trodden?.z ?? this.side.z, Math.PI);
      this.nextTry = time + 3.2;
    }
    return true;
  }

  /**
   * A few seconds after the first failed try the air around the cygnet starts to turn by itself, and goes on asking
   * a little harder for as long as nothing happens. It is only ever offered while the player has never lifted it:
   * once they have, they know, and the wind says nothing.
   */
  get coax(): Coax | null {
    const { cygnet } = this.cast;
    if (this.beat !== 'try' || this.coaxFrom === 0 || cygnet.flying || cygnet.carried || cygnet.flights > 0) return null;
    this.coaxing.at.copy(cygnet.position);
    this.coaxing.urgency = THREE.MathUtils.smoothstep(this.now, this.coaxFrom, this.coaxFrom + tuning.swirl.coaxRamp);
    return this.coaxing.urgency > 0 ? this.coaxing : null;
  }

  /**
   * It is up. Everything else in the world can wait until it comes down — and when it does, the child goes to it,
   * and the beat starts again, because a player who has just found out they can fly it will want to do it again.
   */
  private updateGlide(): void {
    const { child: c, cygnet } = this.cast;
    c.lookAt = cygnet.position;
    if (c.sitting && !c.busy) c.standUp();
    if (cygnet.flying) return;
    if (this.swimHome(this.now)) return;
    if (c.busy || c.sitting) return;
    if (cygnet.flights === 1 && !this.cheeredFlight) {
      /** It went up on the wind and came down safe. After that the wind is something to ask for. */
      cygnet.mind.trust(0.66);
      this.cheeredFlight = true;
      c.cheer();
      completeObjective();
      cygnet.bind(0.2);
      return;
    }
    if (Math.hypot(cygnet.position.x - c.position.x, cygnet.position.z - c.position.z) > 4) {
      this.walkTo(cygnet.position, undefined);
      return;
    }
    c.faceToward(cygnet.position.x, cygnet.position.z, 1);
    this.to('try');
    this.nextTry = this.now + 3.5;
  }

  private walkTo(at: THREE.Vector3, then: (() => void) | undefined): void {
    this.cast.child.walkTo(at.x, at.z, true, then, 2.2);
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
      if (time > this.nextCall) {
        cue('calling');
        cygnet.call(true);
        this.nextCall = time + 5 + Math.random();
      }
    }
    /** Then they go down to it, because the cygnet in the satchel is straining at the sight of them. */
    if (this.t > looks && !c.busy) this.goDown();
  }

  /** Down off the rise to the water, where they stop, because there is nothing else to do about it. */
  private goDown(): void {
    const { child: c } = this.cast;
    pondEdge(c.position.x, c.position.z, tuning.crest.standOff, this.edge);
    this.to('down');
    this.atEdge = -1;
    c.walkTo(this.edge.x, this.edge.z, false, () => (this.atEdge = this.now), 1.2);
  }

  /**
   * At the water. The family notices nothing: heads go up, one after another they turn north, make the long
   * pattering run across the pond, and go, climbing away in a V the way the boat is going, the way home. The
   * cygnet calls the whole time and nothing answers, and then the child kneels and sets it down after them.
   */
  private updateDown(dt: number, time: number): void {
    const { child: c, cygnet, flock } = this.cast;
    const { goes, setsDown, leaves, leaveClimb } = tuning.crest;
    if (flock.active) this.far.set(flock.head.x, flock.head.y + 1.2, flock.head.z);
    cygnet.watch(this.far);
    c.lookAt = this.far;
    if (time > this.nextCall) {
      cue('calling');
      cygnet.call(true);
      this.nextCall = time + 5 + Math.random();
    }
    if (this.atEdge >= 0 && !c.moving && !c.busy) c.faceToward(POND_AT.x, POND_AT.z, 1 - Math.exp(-dt * 1.6));
    if (!this.wentOn && this.atEdge >= 0 && this.now - this.atEdge > goes) {
      this.wentOn = true;
      this.leftAt = this.now;
      cue('bugle');
      /** North, for home, on the line the journey takes; slower than their travelling speed so the going is seen. */
      flock.lift(Math.PI, leaves, leaveClimb);
    }
    if (this.wentOn && this.now - this.leftAt > setsDown && !c.busy) this.setDown();
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
    const t = this.target();
    /** A waypoint is behind them once they are near it or past it: the stop at the piano takes them well past one. */
    const reached = Math.hypot(c.position.x - t.x, c.position.z - t.y) < 38 || c.position.z < t.y - 12;
    if (reached && this.leg < ROUTE.length - 1) this.leg++;
    const last = this.leg === ROUTE.length - 1;

    if (this.cast.cygnet.flying) {
      this.to('glide');
      return;
    }
    /** However the stop at the piano went, nobody walks the crest in grey: past it, the island wakes regardless. */
    if (this.waveTo < WAVE_REACH && c.position.z < PLACE.z - 34) this.wake(3, false);
    /** Walking is exactly the state the reveal wants to interrupt; a throw or a pick-up is left to finish. */
    if (!this.crestDone && this.onCrest() && (c.moving || !c.busy)) {
      this.reveal();
      return;
    }

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
      else if (!c.moving && Math.hypot(p.position.x - c.position.x, p.position.z - c.position.z) > 14) {
        c.walkTo(p.position.x, p.position.z, false, undefined, 8);
      }
    } else if (this.play === 'fetch') {
      c.lookAt = p.position;
      if (!p.landed && p.airborne) this.play = 'watch';
    } else if (this.play === 'hold' && !c.busy) {
      const nearBoat = Math.hypot(p.position.x - boat.position.x, p.position.z - boat.position.z) < BOARDING;
      const childNear = Math.hypot(c.position.x - boat.position.x, c.position.z - boat.position.z) < BOARDING;
      if (last && (nearBoat || childNear || this.now - this.beatStart > 220)) this.board();
      else if (time > this.holdUntil) this.throwAhead();
    }
  }

  private throwAhead(): void {
    const c = this.cast.child;
    const t = this.leg === ROUTE.length - 1 ? this.cast.boat.position : this.target();
    const tx = 'x' in t ? t.x : 0;
    const tz = t instanceof THREE.Vector2 ? t.y : t.z;
    const angle = Math.atan2(tx - c.position.x, tz - c.position.z) + (Math.random() - 0.5) * 0.5;
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
    c.walkTo(p.position.x, p.position.z, true, () => {
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
    s.eye = undefined;
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
      const toward = top ? 0.1 : 0.16;
      s.target.set(c.x + (look.x - c.x) * toward, ground + (top ? 4.2 : 2.4), c.z + (look.z - c.z) * toward);
      s.distance = top ? 21 : 19;
      s.height = top ? 7.5 : 2.6;
      this.pace = top ? 0.9 : 0.4;
      this.focus.set(c.x, ground, c.z);
      return;
    }
    if (this.beat === 'try' || this.beat === 'glide') {
      /**
       * Side on and low. Over the child's shoulder the cygnet is behind their back and under the grass; from here
       * they are both in profile, with the cygnet clear against the sky the moment it leaves the ground.
       */
      const k = this.cast.cygnet.position;
      /**
       * Down in the grass, on the cygnet. While it is on the ground the camera stands off to one side so the child
       * cannot hide it; as it climbs the camera swings in behind their shoulder, so the player ends up watching
       * the sky with the child — the frame of the fall, turned the other way up.
       */
      const gap = Math.hypot(k.x - c.x, k.z - c.z);
      const ground = Math.max(heightAt(k.x, k.z), 0);
      const up = THREE.MathUtils.clamp((k.y - ground) / 3.5, 0, 1);
      /**
       * The camera stands on the bank with its back to the meadow and looks out over the water, which is the one
       * line of sight here that does not run up the side of the bowl: the rig answers a bank by climbing over the
       * scene, and the player would be left drawing circles on the ground from directly above it. It also puts
       * the pale bird and the child against dark water and the sky their family left by.
       */
      const bearing = Math.atan2(k.x - POND_AT.x, k.z - POND_AT.z);
      s.from = this.side.set(Math.sin(bearing), 0, Math.cos(bearing));
      /** Off the cygnet toward the child, so the one who set it down is in the frame it is trying to leave. */
      s.target.set(k.x + (c.x - k.x) * 0.42, k.y * 0.72 + Math.max(heightAt(c.x, c.z), 0) * 0.28 + 0.6, k.z + (c.z - k.z) * 0.42);
      s.distance = 13 + gap * 0.7;
      /**
       * The camera stays down on the ground whatever the cygnet does, so that once it is up the frame is looking
       * up at it with sky behind it. But while it is still down it stands well above the grass and looks in at a
       * slant, because the player has to be able to draw a circle on the ground around it, and from a camera lying
       * in the grass a small circle on screen is a hundred metres of meadow.
       */
      const eye = ground + THREE.MathUtils.lerp(7.2, 3.4, up);
      s.height = THREE.MathUtils.clamp(eye - s.target.y, -9, 8);
      /** It has a whole hollow to come down into after the set-down, so the camera comes down fast and settles. */
      this.pace = this.now - this.kneltAt < 3.5 ? 1.2 : 0.5;
      this.focus.copy(k);
      return;
    }
    if (this.beat === 'crest' || this.beat === 'down') {
      /**
       * Coming over the rise you look down into the hollow, and the two of them stand low in a frame that is
       * mostly pond. Once the family is up the same frame holds them and it: the camera stands behind the child
       * on the line to whatever is being watched, and opens out and tips up as far as it has to.
       */
      const k = this.cast.flock.active ? this.far : POND_AT;
      const ground = Math.max(heightAt(c.x, c.z), 0);
      const reach = Math.hypot(k.x - c.x, k.z - c.z);
      const bearing = Math.atan2(c.x - k.x, c.z - k.z) + REVEAL.swing;
      const open = THREE.MathUtils.smoothstep(this.t, 0.6, 5);
      const toward = REVEAL.toward * (0.62 + 0.38 * open);
      const look = (ground + Math.max(k.y, POND_AT.y)) * 0.5 + (k.y - ground) * 0.28;
      s.target.set(c.x + (k.x - c.x) * toward, look, c.z + (k.z - c.z) * toward);
      s.from = this.side.set(Math.sin(bearing), 0, Math.cos(bearing));
      /** Whatever they are looking at has to fit in the frame with them, so the camera stands off by how far apart they are. */
      s.distance = REVEAL.back + reach * toward * 0.75;
      s.height = ground + REVEAL.up - s.target.y;
      /** Brisker than the walk: the frame has to have arrived while there is still something happening in it. */
      this.pace = 1.1;
      this.focus.copy(c);
      return;
    }
    if (this.beat === 'toBoat' || this.beat === 'push' || this.beat === 'aboard') {
      const b = this.cast.boat.position;
      s.target.set((c.x + b.x) / 2, b.y + 2.2, (c.z + b.z) / 2 - 2);
      s.distance = 28;
      s.height = 7;
      this.pace = 0.35;
      this.focus.copy(b);
      return;
    }
    const pw = this.cast.plane.held ? 0 : 0.25;
    const fx = c.x * (1 - pw) + p.x * pw;
    const fz = c.z * (1 - pw) + p.z * pw - 5;
    const ground = Math.max(heightAt(fx, fz), 0);
    s.target.set(fx, ground + 3 + Math.max(0, p.y - ground - 12) * 0.35, fz);
    s.distance = 44;
    s.height = 13;
    this.pace = 0.35;
    this.focus.set(fx, ground, fz);
  }
}
