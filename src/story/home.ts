import { HOME_JETTY } from '../world/home-layout';
export { HOME_JETTY, HOME_MOORING } from '../world/home-layout';
import * as THREE from 'three';
import { verticalFov, type Shot } from '../camera';
import type { SummitScorePhase } from '../audio/summit-score';
import { COTTAGE, LAST_HILL } from '../world/heightfield';
import { heightAt } from '../world/island';
import { MOON, sunDirection } from '../world/palette';
import type { Coax } from '../fx/swirl';
import { tuning } from '../tuning';
import type { Deck } from '../traveller/traveller';
import type { Cast, Chapter } from './cast';
import { completeObjective, cue } from './cues';
import { HOME_ENDING } from './home-ending';

type Beat =
  | 'ashore'
  | 'climb'
  | 'summit'
  | 'setDown'
  | 'tries'
  | 'flying'
  | 'answered'
  | 'fledge'
  | 'gone'
  | 'settle'
  | 'unfold'
  | 'gaze'
  | 'fold'
  | 'crest'
  | 'brow'
  | 'release'
  | 'home'
  | 'inside'
  | 'credits';

/** North, where the flock went and where the cygnet has been trying to get to since the first island. */
const NORTH = Math.PI;
/** Seconds the family has been wheeling before the cygnet lets go of the player's wind and flies by itself. */
const FLEDGES_AFTER = 3;
/** How near the wheel it has to get before the family takes it in and they all go north together. */
const JOIN_AT = 8;
/** How fast the family flies off with it, and how it climbs as it goes: slow enough that the small one can hold on. */
const LEAVE_SPEED = 11;
const LEAVE_CLIMB = 1;
/** Seconds the child watches them go before walking on: long enough for the V to grow small. */
const WATCHES_FOR = 16;
/** How slowly they walk on afterwards, as a share of their usual pace. */
const STROLL = 0.7;
/** How far on from the summit the ground falls away and the cottage is there: where they stop and see it. */
const BROW_AT = tuning.homeReveal.stopAfter;
/** Seconds they stand on the brow with the house below them. The walk over it is the climax; this is the top of it. */
const BROW_FOR = tuning.homeReveal.noticeFor;
/** They remain facing the house and bring the paper up into both hands. */
const SETTLE_FOR = tuning.homeReveal.raiseFor;
/**
 * The opening, in seconds and how far open. The two wings come up, and then it is held still for a beat with the
 * plane's own shape wide open in their hands, so that whatever flattens after it is unmistakably the same paper.
 */
const OPENING: number[][] = [
  [0, 0],
  [1.1, 0.3],
  [1.9, 0.3],
  [4.2, 1],
];
/** The drawing emerges with the last fold, fully readable as the sheet becomes flat. */
const DRAWS_FROM = 0.58;
const GAZE_FOR = tuning.homeReveal.recogniseFor;
const FOLD_RATE = 0.38;
/** Which side of the sheet, in the paper's own coordinates, is the one nearest the camera over their shoulder. */
const NEAR = 1;
/** How far up out of the hand the paper comes to be worked on, before it is raised to be looked at. */
const WORK = 0.78;
/** How far the plane is tipped up out of the hand while it is still a plane, before any of it is open. */
const TIPPED = 0.2;
/** Folded back this far, the paper is a plane again and the hands come off it. */
const GRIPS_TO = 0.3;
/**
 * Where each mitten is on the sheet as it comes open: how far open it is, then across and along the paper. The far
 * hand keeps hold of the fold down the middle and then takes its own bottom corner; the near hand lifts the near
 * wing, swings the sheet open, flicks the corners of the nose back, and comes down to the other corner.
 */
const GRIPS: [0 | 1, number[][]][] = [
  [
    0,
    [
      [0, 0, -0.8],
      [0.5, 0, -1],
      [0.78, -NEAR * 0.57, -1],
      [1, -NEAR * 0.71, -1.2],
    ],
  ],
  [
    1,
    [
      [0, NEAR * 1.37, -0.45],
      [0.3, NEAR * 1.42, -0.4],
      [0.55, NEAR * 1.48, 0.2],
      [0.72, NEAR * 0.97, 0.95],
      [0.88, NEAR * 1.16, 0.78],
      [1, NEAR * 0.71, -1.2],
    ],
  ],
];
/** The paper held up into the wind: this long before the island's own takes it, so the ending cannot be made to wait. */
const HOLDS_UP = tuning.homeReveal.releaseFor;
/** How long they watch the paper go before walking home. */
const WATCHES_IT = 7;
/** How far out from the door somebody inside opens it on the run down: the light is on the grass before they get there. */
const DOOR_OPENS_AT = 9;
/** When the gaze turns toward the sea, measured from the doorway. */
const RISE_FROM = 2;
const RISE_TO = 24;
const UP = new THREE.Vector3(0, 1, 0);

/** A value read off a list of [seconds, amount] keys, eased between them. */
function keyed(keys: number[][], t: number): number {
  for (let i = 0; i + 1 < keys.length; i++) {
    if (t <= keys[i + 1][0]) return THREE.MathUtils.lerp(keys[i][1], keys[i + 1][1], THREE.MathUtils.smootherstep(t, keys[i][0], keys[i + 1][0]));
  }
  return keys[keys.length - 1][1];
}
/** Keep the moon left of the credits and the horizon at the lower third. */
const MOON_OFF = THREE.MathUtils.degToRad(19);
const SEA_LOOK = 100;

const JETTY_DECK: Deck = { x0: HOME_JETTY.x, z0: HOME_JETTY.shoreZ, x1: HOME_JETTY.x, z1: HOME_JETTY.endZ, halfWidth: HOME_JETTY.halfWidth, height: HOME_JETTY.deck };
/** The top of the last hill, where the small one is put down. The cottage is still hidden behind the brow from here. */
const SUMMIT = new THREE.Vector2(LAST_HILL.x, LAST_HILL.z);
/** On over the brow toward the cottage: the ground falls away and the valley opens, and this is where they stop and see it. */
const TO_COTTAGE = new THREE.Vector2(COTTAGE.x - SUMMIT.x, COTTAGE.z - SUMMIT.y).normalize();
const BROW = SUMMIT.clone().addScaledVector(TO_COTTAGE, BROW_AT);
/** From the summit the sun sets over the cottage, to the north-west. */
const TOWARD_SUNSET = new THREE.Vector2(-Math.sin(THREE.MathUtils.degToRad(32)), -Math.cos(THREE.MathUtils.degToRad(32)));
/**
 * The camera's side of the summit from the circuit to the last of them in the sky: nearly square on from the south,
 * because that is the line the family leaves along, and a shot that holds it needs no swing when they go.
 */
const FROM_SOUTH = new THREE.Vector3(0.05, 0, 1).normalize();
/**
 * The bearing from the child it comes round to hang on: out to one side and a little toward the camera, away from
 * the low sun, so it hangs clear of their head against open sky and the child turns to it and is seen in profile.
 */
const HANGS_ON = 1.15;
/** Seconds the small one takes to come into the last place of the V, carried north with the family while it does. */
const SLIPS_IN = tuning.swanDeparture.cygnetJoin;

/**
 * Home. The last island: up over the crest of the final hill with the fledgling, and the valley below holds a white
 * cottage with a red door. The child unfolds the plane and it is a drawing of this, lets it go into the sunset,
 * and walks down to the lit window as night comes on.
 */
export class HomeChapter implements Chapter {
  beat: Beat = 'ashore';
  readonly breeze = 1;
  readonly worldLife = 1;
  pace = 0.35;
  get haze(): number {
    return THREE.MathUtils.lerp(tuning.homeApproach.clearHaze, tuning.homeApproach.dockHaze, this.openSea);
  }
  get openSea(): number {
    const walked = HOME_JETTY.endZ - this.cast.child.position.z;
    return 1 - THREE.MathUtils.smootherstep(walked, 0, tuning.homeApproach.clearBy);
  }
  get hazeFalloff(): number {
    return THREE.MathUtils.lerp(1, tuning.homeApproach.falloff, this.openSea);
  }
  dusk = tuning.homeLight.daylight;
  readonly shot: Shot = { target: new THREE.Vector3(), distance: 40, height: 12 };
  readonly music = 'home' as const;
  get summitScore(): SummitScorePhase {
    if (['answered','fledge'].includes(this.beat)) return 'flight';
    if (['gone','crest','brow','settle','unfold','gaze','fold'].includes(this.beat)) return 'farewell';
    if (['release','home','inside','credits'].includes(this.beat)) return 'home';
    return 'approach';
  }
  readonly season = 1;
  readonly focus = new THREE.Vector3();
  private beatStart = 0;
  private duskTarget = tuning.homeLight.daylight;
  private now = 0;
  private endingAt: number | null = null;
  get homeEndingTime(): number | undefined {
    return this.endingAt === null ? undefined : Math.max(0, this.now - this.endingAt);
  }
  private readonly hand = new THREE.Vector3();
  private readonly paperFacing = new THREE.Quaternion();
  private readonly tmp = new THREE.Vector3();
  private readonly held = new THREE.Vector3();
  private readonly behind = new THREE.Vector3();
  private readonly sky = new THREE.Vector3();
  private readonly fwd = new THREE.Vector3();
  private readonly eyeAt = new THREE.Vector3();
  private readonly readingEye = new THREE.Vector3();
  private readonly paperEye = new THREE.Vector3();
  private readonly descentChild = new THREE.Vector3();
  private readonly descentHouse = new THREE.Vector3();
  private readonly farewellEye = new THREE.Vector3();
  private readonly farewellLook = new THREE.Vector3();
  private farewellCaptured = false;
  private readonly releaseFoot = new THREE.Vector3();
  private readonly releaseHead = new THREE.Vector3();
  private readonly releaseSubjects = { primary: this.releaseFoot, secondary: this.releaseHead,
    tertiary: this.descentHouse, margin: 0.85, extra: 30 };
  private readonly moon = sunDirection(MOON.az, MOON.el);
  private readonly side = new THREE.Vector3();
  private readonly onCygnet = new THREE.Vector3();
  /** Where the camera is aimed, where the middle of the sheet is, where a mitten is going, and what the child watches. */
  private readonly aim = new THREE.Vector3();
  private readonly sheet = new THREE.Vector3();
  private readonly grip = new THREE.Vector3();
  private readonly watching = new THREE.Vector3();
  /** The folding mesh owns the paper while the child opens, reads and refolds it. */
  private paper = false;
  private houseInFrame = false;
  private houseSeenAt = -1;
  private paperInFrame = false;
  private recognisedAt = -1;
  private readonly screen = new THREE.Vector3();
  private readonly sight = new THREE.Vector3();
  /** When the paper went. */
  private wentAt = 0;
  private gusted = false;
  private wentOn = false;
  private doorOpened = false;
  private finaleStarted = false;
  trodden: THREE.Vector3 | null = null;
  hush = 0;
  readonly flockChatter = false;
  silence = false;
  finished = false;
  private nextCall = 0;
  private nextBugle = 0;
  private passed = false;
  private criedAfter = false;
  private tried = 0;
  private called = false;
  private turned = false;
  private answeredBack = false;
  private leftAt = 0;
  /** When the small one started taking its place in the line, and how far it was from it when it did. */
  private slipAt = 0;
  private readonly slipBy = new THREE.Vector3();
  private readonly gathering = new THREE.Vector3();
  /** When the wind starts showing the player the gesture the colt is waiting for, and the shape it draws there. */
  private coaxFrom = 0;
  private readonly coaxing = { at: new THREE.Vector3(), urgency: 0 };

  constructor(private readonly cast: Cast) {
    cast.cygnet.mayFly = true;
    const { child, plane } = cast;
    plane.homeRadius = 70;
    child.decks = [JETTY_DECK];
    child.dismount();
    /** Out of the boat onto the end of the jetty, in along it to the sand, and then up. */
    child.place(HOME_JETTY.x, HOME_JETTY.endZ - 0.4, NORTH);
    child.walkTo(HOME_JETTY.x, HOME_JETTY.shoreZ - 3, false, () => {
      const from = child.position;
      child.walkTo(from.x + (SUMMIT.x - from.x) * 0.45, from.z + (SUMMIT.y - from.z) * 0.45, false, () => this.climb(), 2);
    }, 1);
  }

  /** The updraft is the last required input; the paper release is automatic. */
  get scripted(): boolean {
    return (
      this.beat !== 'setDown' &&
      this.beat !== 'tries' &&
      this.beat !== 'flying' &&
      this.beat !== 'answered'
    );
  }

  get done(): boolean {
    return false;
  }

  get checkpoint(): string | null {
    if (this.finished) return 'complete';
    if (this.recognisedAt >= 0) return 'drawing';
    if (['crest', 'brow', 'settle', 'unfold', 'gaze'].includes(this.beat)) return 'reunion';
    return null;
  }
  restoreCheckpoint(point: string): void {
    const { child, cygnet, flock, plane, cottage } = this.cast;
    cygnet.visible = false;
    flock.clear();
    this.dusk = this.duskTarget = point === 'complete' ? 2 : tuning.homeLight.daylight;
    if (point === 'reunion') {
      this.skipToDrawing();
    } else if (point === 'drawing') {
      child.stop();
      this.skipToDrawing(1);
      this.recognisedAt = this.now;
      this.to('gaze');
    } else {
      this.beat = 'credits';
      this.finished = this.silence = true;
      child.visible = plane.visible = false;
      cottage.smoking = true;
      cottage.openDoor(false);
    }
  }

  /** For testing the ending: straight to the top of the hill, plane in hand. */
  skipToSummit(): void {
    const { child, plane } = this.cast;
    this.endingAt = null;
    child.stop();
    child.place(SUMMIT.x + 5, SUMMIT.y + 26, Math.PI);
    child.standUp();
    plane.hold(child);
    this.climb();
  }

  /**
   * And for testing the drawing: alone on the summit with the family gone and the paper still a plane in their
   * hand — or, given an opening fraction, standing at the brow with it coming open.
   */
  skipToDrawing(open?: number): void {
    const { child, plane, cygnet, drawing } = this.cast;
    this.endingAt = this.now - (open === undefined ? HOME_ENDING.reunionAt : HOME_ENDING.drawingAt);
    child.stop();
    cygnet.visible = false;
    this.dusk = this.duskTarget = tuning.homeLight.daylight;
    child.place(open === undefined ? SUMMIT.x : BROW.x, open === undefined ? SUMMIT.y : BROW.y,
      Math.atan2(TO_COTTAGE.x, TO_COTTAGE.y));
    child.standUp();
    plane.hold(child);
    if (open === undefined) { this.onOver(); return; }
    this.openIt();
    child.presenting = 1;
    drawing.open = open;
    this.to('unfold');
    this.beatStart = this.now - OPENING[OPENING.length - 1][0] * open;
  }

  private to(beat: Beat): void {
    this.beat = beat;
    this.beatStart = this.now;
  }

  private get t(): number {
    return this.now - this.beatStart;
  }

  private climb(): void {
    const c = this.cast.child;
    this.cast.cygnet.mind.trust(0.8);
    this.to('climb');
    c.lookAt = null;
    /** Up the hill it rides on their back, where it can be seen and can see. */
    if (this.cast.cygnet.seat === 'cradle') this.cast.carry.stow();
    c.walkTo(SUMMIT.x, SUMMIT.y, false, () => {
      c.faceToward(SUMMIT.x + TOWARD_SUNSET.x, SUMMIT.y + TOWARD_SUNSET.y, 1);
      c.sitDown();
      this.to('summit');
    }, 0.8);
  }

  update(dt: number, time: number): void {
    this.now = time;
    const { child: c, plane: p } = this.cast;
    if (this.beat === 'ashore' || this.beat === 'climb') {
      c.lookAt = this.sky.set(c.position.x + TOWARD_SUNSET.x * 60, c.position.y + 22, c.position.z + TOWARD_SUNSET.y * 60);
    } else {
      this.updateEnding(dt);
    }
    if ((this.beat === 'release' && !p.held && this.wentAt > 0) || this.beat === 'home') {
      const light = tuning.homeLight;
      const fade = this.now - this.wentAt - (WATCHES_IT - light.fadeLead);
      this.duskTarget = THREE.MathUtils.lerp(light.daylight, light.doorstep,
        THREE.MathUtils.smootherstep(fade, 0, light.fadeFor));
    }
    this.dusk += (this.duskTarget - this.dusk) * (1 - Math.exp(-dt * tuning.homeLight.response));
    const staged = this.beat === 'setDown' || this.beat === 'tries' || this.beat === 'flying' || this.beat === 'answered';
    if (!staged) this.hush += (this.hushFor - this.hush) * (1 - Math.exp(-dt * 0.5));
    if (p.held) p.hold(c);
    this.frame();
  }

  /**
   * Why any of it happens: sitting in the last of the sun, the family comes over, high and calling, going north.
   * The small one watches them all the way and cries after them, and the child looks from it to them and knows.
   */
  private updateSummit(): void {
    const { child: c, cygnet, flock } = this.cast;
    const f = tuning.summit;
    if (!this.passed && this.t > f.arriveAt) {
      this.passed = true;
      /** Meet the west edge on its northbound tangent, while the whole approach is still in front of the camera. */
      flock.pass(c.position.x + 2 - f.wheelRadius, c.position.z - f.wheelAhead, c.position.y + f.wheelHeight, NORTH, 13, 60, false);
      cue('skein');
      cygnet.watch(flock.head);
    }
    c.lookAt = this.passed && flock.active ? flock.head : this.sky;
    if (this.passed && !flock.wheeling && this.t > f.turnAt) {
      flock.circle(c.position.x + 2, c.position.z - f.wheelAhead, c.position.y + f.wheelHeight, f.wheelRadius, 13, 8);
    }
    if (this.passed && !this.criedAfter && this.t > f.callAt) {
      this.criedAfter = true;
      cue('calling');
      cygnet.call(true);
    }
    if (c.sitting && this.t > f.setDownAt && !c.busy) this.setDown();
  }

  /** They stand it in the grass facing north, and step back off it, and that is all they can do for it. */
  private setDown(): void {
    const { child: c, cygnet } = this.cast;
    this.to('setDown');
    cygnet.watch(null);
    this.nextBugle = this.now + 4;
    // The sunlight waits with them, however long the player needs to help the cygnet fly.
    cygnet.needs(tuning.summit.liftToFly, tuning.summit);
    c.standUp();
    const x = c.position.x + Math.sin(c.yaw) * 2.2;
    const z = c.position.z + Math.cos(c.yaw) * 2.2;
    this.trodden = new THREE.Vector3(x, 12, z);
    const { carry } = this.cast;
    const stood = () => {
      c.faceToward(cygnet.position.x, cygnet.position.z, 1);
      this.to('tries');
      this.nextCall = this.now + 3;
    };
    const down = () => carry.setDown(stood, NORTH);
    if (cygnet.seat === 'satchel') carry.unstow(down);
    else down();
  }

  /**
   * The last thing the player does, and the thing the whole journey has been teaching them to do. It calls north
   * and nothing answers, the way nothing answered at the crest. Then the player raises the wind under it, and this
   * time it does not come down — and out of the dark its family comes down for it.
   */
  private updateFlight(dt: number): void {
    const { child: c, cygnet } = this.cast;
    c.lookAt = cygnet.flying ? cygnet.position : cygnet.eye(this.onCygnet);
    const quiet = this.beat === 'answered' ? 0 : 0.7;
    this.hush += (quiet - this.hush) * (1 - Math.exp(-dt * 0.8));

    /**
     * It tries by itself first, twice, and drops both times. Nothing else in the scene moves while it does. The
     * player is not told they are needed: they are shown that nobody else can do this.
     */
    const ground = Math.max(heightAt(cygnet.position.x, cygnet.position.z), 0);
    const up = cygnet.position.y - ground;
    /** A player who works it out during the cygnet's own attempts is never made to wait for the beat to finish. */
    if ((this.beat === 'tries' || this.beat === 'flying') && cygnet.flying && up > tuning.summit.liftTo) {
      this.answered();
      return;
    }

    /** They call from the wheel every so often, and the small one answers from the ground: that is the whole ask. */
    if (this.now > this.nextBugle) {
      cue('bugle');
      this.nextBugle = this.now + tuning.summit.callEvery + Math.random() * 3;
    }
    if (this.beat === 'tries') {
      if (this.t > 2 && this.tried < 1) {
        this.tried = 1;
        cygnet.tryToFly();
        this.coaxFrom = this.now + tuning.swirl.coaxAfter;
      }
      if (this.t > 6 && this.tried < 2) {
        this.tried = 2;
        cygnet.tryToFly();
      }
      if (this.t > 8 && this.now > this.nextCall) {
        cue('calling');
        cygnet.call(true);
        this.nextCall = this.now + 6;
      }
      if (this.t > 10.5) this.to('flying');
      return;
    }

    /**
     * They have come down for it. The player is still holding it up there for a few seconds more, and then it
     * finds it does not need them: it lets go of the wind and flies.
     */
    if (this.beat === 'answered') {
      if (this.t > FLEDGES_AFTER) {
        cygnet.fledge(c.position, HANGS_ON);
        this.to('fledge');
      }
      return;
    }
    if (this.beat !== 'flying') return;

    if (this.now > this.nextCall) {
      cue('calling');
      this.nextCall = this.now + 5.5 + Math.random() * 2;
    }
    /** This is the one thing in the game that waits for the player for as long as it takes; nothing does it for them. */
  }

  /**
   * A few seconds after its first attempt the air around it starts to turn by itself, and asks a little harder for
   * as long as it stays on the ground: the last thing the player is asked to do is the thing they were shown.
   */
  get invitesFlight(): boolean {
    return this.beat === 'tries' || this.beat === 'flying';
  }

  get coax(): Coax | null {
    const { cygnet } = this.cast;
    const trying = this.beat === 'tries' || this.beat === 'flying';
    if (!trying || this.coaxFrom === 0 || cygnet.flying || cygnet.gone) return null;
    this.coaxing.at.copy(cygnet.position);
    this.coaxing.urgency = THREE.MathUtils.smoothstep(this.now, this.coaxFrom, this.coaxFrom + tuning.swirl.coaxRamp);
    return this.coaxing.urgency > 0 ? this.coaxing : null;
  }

  /**
   * It is up, and this time something answers. The family comes down out of the night and wheels low over the
   * hill around it — the one moment in the journey where the thing that was asked for is given, in full, on
   * screen. The music comes back here and nowhere earlier.
   */
  private answered(): void {
    const { child: c, flock } = this.cast;
    this.to('answered');
    this.endingAt = this.now;
    /**
     * Wheeling a little way off to the north rather than straight overhead: a column of swans turning in the
     * sky is only legible side on, and directly above the child it is a tower nobody can see the top of.
     */
    this.gathering.set(c.position.x + 5, c.position.y + 8, c.position.z - 34);
    /** Fewer of them than at the crest, so the small one can be picked out among them when it goes to join. */
    flock.circle(this.gathering.x, this.gathering.z, this.gathering.y, 20, 16, 18);
    this.nextCall = this.now + 1.2;
    completeObjective();
  }

  /**
   * Flying by itself now, round and round the child, steadier every turn. Then it comes round to face them and
   * calls — the third call in the story, and the first one anything answers — and goes to its family.
   */
  private updateFledge(): void {
    const { child: c, cygnet, flock } = this.cast;
    c.lookAt = cygnet.position;
    /** They turn to it as it breaks out of the circuit, so it comes round to a face and not to the back of a head. */
    if (!this.turned && this.t > tuning.fledge.loopFor) {
      this.turned = true;
      c.faceToward(c.position.x + Math.sin(HANGS_ON) * 8, c.position.z + Math.cos(HANGS_ON) * 8, 1);
    }
    const phase = cygnet.fledgePhase;
    if (phase === 'turn' && !this.called) {
      this.called = true;
      cue('calling');
      cygnet.call(true);
      this.nextCall = this.now + 1.4;
    }
    if (this.called && !this.answeredBack && this.now > this.nextCall) {
      this.answeredBack = true;
      cue('bugle');
    }
    if (phase === 'ready') {
      cygnet.join((out) => {
        if (!flock.active) return null;
        if (flock.wheeling) return out.copy(flock.head);
        /**
         * The last place in the V: the one it fell out of over the first island. It is never chased across the sky
         * — the place is taken from wherever it was when they broke, and closed on while they carry it north.
         */
        flock.nextSlot(out);
        if (this.slipAt === 0) {
          this.slipAt = this.now;
          this.slipBy.subVectors(cygnet.position, out);
        }
        return out.addScaledVector(this.slipBy, 1 - THREE.MathUtils.smoothstep(this.now - this.slipAt, 0, SLIPS_IN));
      });
      this.to('gone');
    }
  }

  /** It reaches the wheel, and the whole family goes north with it in the line, and the child watches them out of sight. */
  private updateGone(): void {
    const { child: c, cygnet, flock } = this.cast;
    if (flock.wheeling && cygnet.position.distanceTo(flock.head) < JOIN_AT) {
      flock.goOn(NORTH, LEAVE_CLIMB, LEAVE_SPEED, cygnet.position);
      this.leftAt = this.now;
      cue('skein');
      c.cheer();
    }
    c.lookAt = cygnet.visible ? cygnet.position : flock.head;
    const away = this.leftAt > 0 && (this.now - this.leftAt > WATCHES_FOR || !cygnet.visible);
    /** They turn for home and walk a few paces down off the very top before they stop and sit. */
    if (away && !this.wentOn && !c.busy) {
      this.wentOn = true;
      c.stroll = STROLL;
      this.onOver();
    }
  }

  /** The house has caught their eye. Still facing it, they bring the plane up to check the drawing. */
  private openIt(): void {
    const { child: c, plane, drawing } = this.cast;
    this.to('settle');
    c.stop();
    /** From here what is in their hand is the sheet, folded on the glider's own lines; the glider waits its turn. */
    this.paper = true;
    plane.visible = false;
    drawing.mesh.visible = true;
    drawing.open = 0;
    drawing.drawn = 0;
  }

  /** After the flock has gone, walk on with the folded plane until the house opens into view. */
  private onOver(): void {
    const { child: c, plane, drawing, cottage } = this.cast;
    this.paper = false;
    drawing.mesh.visible = false;
    plane.visible = true;
    this.to('crest');
    c.standUp();
    c.stroll = STROLL;
    c.walkTo(BROW.x, BROW.y, false, () => {
      c.faceToward(cottage.position.x, cottage.position.z, 1);
      this.to('brow');
    }, 0.6);
  }

  /** Leave room for recognition: the motif begins only when house and drawing share the frame. */
  private get hushFor(): number {
    if (['crest', 'brow', 'settle', 'unfold'].includes(this.beat)) return 1;
    if (this.beat === 'gaze') return this.recognisedAt < 0 ? 1 : 0.75;
    return 0;
  }

  /** How far on from the summit they have got, toward the cottage. */
  private get along(): number {
    const p = this.cast.child.position;
    return (p.x - SUMMIT.x) * TO_COTTAGE.x + (p.z - SUMMIT.y) * TO_COTTAGE.y;
  }

  /** Eyes on the path until the ground falls away, and then on the roof below before their feet have stopped. */
  private updateCrest(): void {
    const { child: c, cottage } = this.cast;
    const fwd = this.forward();
    c.lookAt =
      this.along > BROW_AT - 3
        ? cottage.position
        : this.watching.set(c.position.x + fwd.x * 3, c.position.y - 0.4, c.position.z + fwd.z * 3);
  }

  /** They stop where the ground falls away, and the house is down there, as drawn. Nothing is said about it. */
  private updateBrow(): void {
    const { child: c, cottage } = this.cast;
    c.lookAt = cottage.position;
    if (this.houseSeenAt >= 0 && this.now - this.houseSeenAt > BROW_FOR && this.houseInFrame && !c.busy) this.openIt();
  }

  /** The island's wind takes the paper at a fixed time, preserving the musical phrase. */
  private updateRelease(dt: number, faceX: number, faceZ: number): void {
    const { child: c, plane: p, wind } = this.cast;
    c.lookAt = p.position;
    if (!p.held) {
      if (this.now - this.wentAt > 1.6 && this.now - this.wentAt < 1.65) c.cheer();
      return;
    }
    c.faceToward(faceX, faceZ, 1 - Math.exp(-dt * 1.2));
    const fwd = this.forward();
    /** The hand the plane has ridden in the whole way (`handPosition` is that one), out and up, offering it. */
    c.reachFor(0, this.held.set(c.position.x + fwd.x * 0.74, c.position.y + 2.46, c.position.z + fwd.z * 0.74));
    if (this.t > HOLDS_UP - 1.2 && !this.gusted) {
      this.gusted = true;
      wind.addSplat({ source: this,
        impulse: true,
        ax: c.position.x - TOWARD_SUNSET.x * 26,
        az: c.position.z - TOWARD_SUNSET.y * 26,
        bx: c.position.x + TOWARD_SUNSET.x * 8,
        bz: c.position.z + TOWARD_SUNSET.y * 8,
        vx: TOWARD_SUNSET.x * 15,
        vz: TOWARD_SUNSET.y * 15,
        radius: 9,
        energy: 0.6,
        swirl: 0,
        lift: 0.5,
      });
    }
    if (this.t > HOLDS_UP) {
      c.reachFor(0, null);
      p.launch(c.handPosition(this.hand), this.tmp.set(TOWARD_SUNSET.x * 5.5, 5.4, TOWARD_SUNSET.y * 5.5));
      p.depart(this.tmp.set(TOWARD_SUNSET.x, 0, TOWARD_SUNSET.y));
      if (tuning.audio.homeEndingSounds) cue('release');
      this.wentAt = this.now;
    }
  }

  private forward(): THREE.Vector3 {
    const yaw = this.cast.child.yaw;
    return this.fwd.set(Math.sin(yaw), 0, Math.cos(yaw));
  }

  /** The drawing, the farewell to the plane, nightfall and the red door. */
  private updateEnding(dt: number): void {
    const { child: c, plane: p, drawing, cottage } = this.cast;
    const faceX = c.position.x + TOWARD_SUNSET.x * 10;
    const faceZ = c.position.z + TOWARD_SUNSET.y * 10;
    this.sky.set(c.position.x + TOWARD_SUNSET.x * 60, c.position.y + 22, c.position.z + TOWARD_SUNSET.y * 60);

    if (this.beat === 'summit') {
      this.updateSummit();
    } else if (this.beat === 'setDown' || this.beat === 'tries' || this.beat === 'flying' || this.beat === 'answered') {
      this.updateFlight(dt);
    } else if (this.beat === 'fledge') {
      this.updateFledge();
    } else if (this.beat === 'gone') {
      this.updateGone();
    } else if (this.beat === 'settle') {
      // A glance from the house to the paper motivates the hands; keep their feet planted.
      c.faceToward(c.position.x + TO_COTTAGE.x * 10, c.position.z + TO_COTTAGE.y * 10, 1 - Math.exp(-dt * 1.8));
      if (this.t > tuning.homeReveal.handsFrom) c.presenting = Math.min(1, c.presenting + dt * 0.9);
      c.lookAt = this.t < tuning.homeReveal.handsFrom ? cottage.position : drawing.point(0, 0.3, this.watching);
      if (this.t > SETTLE_FOR && this.houseInFrame && this.paperInFrame) this.to('unfold');
    } else if (this.beat === 'unfold') {
      /** Along the keys, so the wings come up and the paper is then held still for a beat before it flattens. */
      drawing.open = Math.max(drawing.open, keyed(OPENING, this.t));
      c.lookAt = drawing.point(0, 0.3, this.watching);
      if (drawing.open >= 1) this.to('gaze');
    } else if (this.beat === 'gaze') {
      c.lookAt = drawing.point(0, 0.3, this.watching);
      if (this.recognisedAt < 0 && drawing.drawn > 0.97 && this.houseInFrame && this.paperInFrame) {
        this.recognisedAt = this.now;
        if (tuning.audio.homeEndingSounds) cue('unfold');
      }
      if (this.recognisedAt >= 0) {
        const recognised = this.now - this.recognisedAt;
        const reveal = tuning.homeReveal;
        c.lookAt = drawing.point(0, 0.3, this.watching).lerp(cottage.position,
          THREE.MathUtils.smootherstep(recognised, reveal.lookUpFrom, reveal.lookUpUntil));
        if (recognised > GAZE_FOR) this.to('fold');
      }
    } else if (this.beat === 'fold') {
      /** Folded back the way it came open, because it has one more thing to be before they let it go. */
      drawing.open = Math.max(0, drawing.open - dt * FOLD_RATE);
      c.lookAt = drawing.point(0, 0.3, this.watching);
      if (drawing.open < GRIPS_TO) {
        c.presenting = Math.max(0, c.presenting - dt * 1.2);
        c.reachFor(0, null);
        c.reachFor(1, null);
      }
      if (drawing.open <= 0) {
        this.paper = false; drawing.mesh.visible = false; p.visible = true;
        this.to('release');
      }
    } else if (this.beat === 'crest') {
      c.presenting = Math.max(0, c.presenting - dt * 1.2);
      this.updateCrest();
    } else if (this.beat === 'brow') {
      this.updateBrow();
    } else if (this.beat === 'release') {
      this.updateRelease(dt, faceX, faceZ);
      if (!p.held && this.now - this.wentAt > WATCHES_IT) {
        this.to('home');
        /** Somebody inside has lit the fire; the child heads home through the settling dusk. */
        cottage.smoking = true;
        c.standUp();
        c.walkTo(cottage.doorstep.x, cottage.doorstep.z, true, () => this.to('inside'), 0.5);
      }
    } else if (this.beat === 'home') {
      c.lookAt = cottage.position;
      if (p.position.distanceTo(c.position) > 160) p.visible = false;
      /** Somebody inside hears them coming: the door opens a few strides out and the light is on the grass first. */
      if (!this.doorOpened && c.position.distanceTo(cottage.doorstep) < DOOR_OPENS_AT) {
        this.doorOpened = true;
        cottage.openDoor(true);
        if (tuning.audio.homeEndingSounds) cue('home');
      }
    } else if (this.beat === 'inside') {
      this.duskTarget = 2;
      if (this.t > 1.2 && this.t < 1.25) c.walkTo(cottage.position.x, cottage.position.z, false, undefined, 0.3);
      if (this.t > 2.6) c.visible = false;
      if (this.t > 4.2) cottage.openDoor(false);
      if (this.t >= RISE_FROM && !this.finaleStarted && !this.silence) {
        this.finaleStarted = true;
        if (tuning.audio.homeEndingSounds) cue('finale');
      }
      if ((this.homeEndingTime ?? 0) >= HOME_ENDING.musicEndsAt) this.silence = true;
      if ((this.homeEndingTime ?? 0) >= HOME_ENDING.creditsAt) {
        this.finished = true;
        this.to('credits');
      }
    }

    if (this.paper) {
      drawing.lift = this.lifted;
      drawing.turn = this.tilted;
      drawing.drawn = this.inked();
      // Hold the picture ahead of the child, independent of the viewing camera or head turn.
      this.presentPoint(this.held);
      const tilt = THREE.MathUtils.degToRad(tuning.homeReveal.paperTilt);
      this.paperEye.copy(this.held).addScaledVector(this.forward(), -Math.sin(tilt));
      this.paperEye.y += Math.cos(tilt);
      drawing.place(c.handPosition(this.hand), this.held, this.paperEye, this.now, c.planeQuaternion(this.paperFacing));
      const holding = this.beat === 'unfold' || this.beat === 'gaze' || (this.beat === 'fold' && drawing.open >= GRIPS_TO);
      if (holding) this.hands();
    }
  }

  /**
   * How far the paper has come up out of the one hand: into both of them to be worked on, low, where the hands can
   * get at it, and then settled into the reading hold once the last corner is open.
   */
  private get lifted(): number {
    const open = this.cast.drawing.open;
    const up = WORK + (1 - WORK) * THREE.MathUtils.smoothstep(open, 0.82, 1);
    if (this.beat === 'settle') return WORK * THREE.MathUtils.smoothstep(this.t, tuning.homeReveal.handsFrom, SETTLE_FOR);
    if (this.beat === 'unfold' || this.beat === 'gaze') return up;
    if (this.beat === 'fold') return up * THREE.MathUtils.smoothstep(open, 0.02, GRIPS_TO);
    return 0;
  }

  /**
   * And how far round it has been turned: a plane lies along the hand that carries it, and it is only as the wings
   * come up and the sheet comes open that it is turned up and round to be a thing with a front and a top.
   */
  private get tilted(): number {
    const open = this.cast.drawing.open;
    if (this.beat === 'settle') return TIPPED * THREE.MathUtils.smoothstep(this.t, tuning.homeReveal.handsFrom, SETTLE_FOR);
    const round = TIPPED + (1 - TIPPED) * THREE.MathUtils.smoothstep(open, 0.12, 0.86);
    return this.beat === 'fold' ? round * THREE.MathUtils.smoothstep(open, 0.02, GRIPS_TO) : round;
  }

  /** Tie the picture to the last fold so a flat sheet never waits for its reveal. */
  private inked(): number {
    const open = this.cast.drawing.open;
    return this.beat === 'fold'
      ? THREE.MathUtils.smoothstep(open, 0.06, 0.42)
      : THREE.MathUtils.smoothstep(open, DRAWS_FROM, 0.98);
  }

  /**
   * The two mittens on the paper: one keeps hold of the fold down the middle while the other lifts the near wing,
   * swings the sheet open and flicks the corners of the nose back, and then they take a bottom corner each. Every
   * grip follows a point of the sheet; its near edge stays within the arms' reach when fully open.
   */
  private hands(): void {
    const { child: c, drawing } = this.cast;
    this.behind.set(0, -1, 0).applyQuaternion(drawing.mesh.quaternion);
    for (const [hand, keys] of GRIPS) {
      let i = 0;
      while (i + 2 < keys.length && drawing.open > keys[i + 1][0]) i++;
      const k = THREE.MathUtils.smoothstep(drawing.open, keys[i][0], keys[i + 1][0]);
      const x = THREE.MathUtils.lerp(keys[i][1], keys[i + 1][1], k);
      const y = THREE.MathUtils.lerp(keys[i][2], keys[i + 1][2], k);
      c.reachFor(hand, drawing.point(x, y, this.grip).addScaledVector(this.behind, 0.06));
    }
  }

  /** Once they recognise home, the hands settle a little; both grips continue to follow the sheet. */
  private presentPoint(out: THREE.Vector3): THREE.Vector3 {
    this.cast.child.presentPoint(out);
    if (this.recognisedAt >= 0) {
      const reveal = tuning.homeReveal;
      const rest = THREE.MathUtils.smootherstep(this.now - this.recognisedAt, reveal.relaxFrom, reveal.relaxUntil);
      const folding = this.beat === 'fold' ? 1 - THREE.MathUtils.smootherstep(this.t, 0, 1 / FOLD_RATE) : 1;
      out.y -= reveal.relaxDrop * rest * folding;
    }
    return out;
  }

  /** Approach the house, settle onto the shoulder, then hold paper and destination together. */
  private frameDrawing(): boolean {
    const beat = this.beat;
    if (!['crest', 'brow', 'settle', 'unfold', 'gaze', 'fold', 'release'].includes(beat)) return false;
    const { child, cottage } = this.cast;
    const c = child.position, s = this.shot;
    const aspect = typeof window === 'undefined' ? 16 / 9 : window.innerWidth / window.innerHeight;
    const portrait = aspect < 1;
    const reveal = tuning.homeReveal;
    const walking = beat === 'crest';
    const close = ['settle', 'unfold', 'gaze'].includes(beat);
    s.clearance = reveal.shoulderClearance;
    // Ease toward the drawing over the first folds, rather than climbing as soon as the hands move.
    const approaching = beat === 'settle' || beat === 'unfold';
    const approach = approaching ? THREE.MathUtils.smootherstep(
      this.t + (beat === 'unfold' ? SETTLE_FOR : 0), 0, reveal.approachFor) : 1;
    const retreat = beat === 'fold' ? THREE.MathUtils.smootherstep(this.t, 0, 1 / FOLD_RATE) : close ? 1 - approach : 1;
    const reading = this.recognisedAt < 0 ? 0 : THREE.MathUtils.smootherstep(
      this.now - this.recognisedAt, reveal.readingFrom, reveal.readingUntil) * (1 - retreat);
    const shoulderArc = THREE.MathUtils.lerp(reveal.portraitShoulderArc, reveal.shoulderArc,
      THREE.MathUtils.smoothstep(aspect, 0.46, 1));
    const arc = THREE.MathUtils.lerp(shoulderArc * Math.min(1, aspect / 0.46), reveal.walkArc, retreat)
      + (portrait ? reveal.portraitReadingArc : reveal.readingArc) * reading;
    const portraitBack = THREE.MathUtils.lerp(reveal.narrowPortraitBack, reveal.portraitBack,
      THREE.MathUtils.smoothstep(aspect, 0.36, 0.46));
    const near = portrait ? portraitBack * Math.max(1, (0.46 / aspect) ** 2) : reveal.shoulderBack;
    const dist = THREE.MathUtils.lerp(near, reveal.walkBack, retreat);
    const closeRise = (portrait ? reveal.portraitShoulderRise : reveal.shoulderRise) + Math.max(0, near - portraitBack) * 0.45;
    const rise = THREE.MathUtils.lerp(closeRise, reveal.walkRise, retreat);
    this.side.set(-TO_COTTAGE.x, 0, -TO_COTTAGE.y).applyAxisAngle(UP, arc);
    this.eyeAt.copy(c).addScaledVector(this.side, dist).setY(c.y + rise);
    this.readingEye.copy(this.eyeAt).addScaledVector(this.side, -reveal.readingForward * reading);
    this.readingEye.y += reveal.readingRise * reading;
    s.eye = this.readingEye;
    this.presentPoint(this.sheet);
    // Share the child's view: the drawing in the foreground, the real house beyond it.
    this.aim.copy(cottage.position).y += 2.6;
    this.aim.sub(this.readingEye).normalize();
    this.tmp.copy(this.sheet).sub(this.readingEye).normalize();
    const readingWeight = THREE.MathUtils.lerp(portrait ? reveal.portraitPaperWeight : reveal.paperWeight,
      portrait ? reveal.portraitPaperWeight : reveal.readingPaperWeight, reading);
    const weight = THREE.MathUtils.lerp(readingWeight, walking ? 0.15 : 0.25, retreat);
    this.aim.lerp(this.tmp, weight).normalize();
    // Leave sky above the real cottage so its sun shares the frame with the sun on the paper.
    this.aim.y += reveal.skyLookUp * (1 - retreat);
    this.aim.normalize();
    // Keep the aim near the sheet. Extending a downward sight line into the hillside makes the
    // camera's terrain correction pull past the child during the reading move.
    s.target.copy(this.readingEye).addScaledVector(this.aim, this.readingEye.distanceTo(this.sheet));
    if (beat === 'release') {
      // Let the paper lead the gaze while retaining the child's full standing silhouette.
      this.releaseFoot.copy(c).y += 0.3;
      this.releaseHead.copy(c).y += 3.2;
      this.descentHouse.copy(cottage.position).y += 6;
      s.subjects = this.releaseSubjects;
      s.smoothFit = reveal.descentFit;
    }
    if (beat === 'release' && this.wentAt > 0) {
      // Follow the plane only after it leaves the hand; ease back towards the walk home.
      const elapsed = this.now - this.wentAt;
      const gone = THREE.MathUtils.smoothstep(elapsed, 0, 2.5)
        * (1 - THREE.MathUtils.smootherstep(elapsed, reveal.returnFrom, WATCHES_IT));
      s.target.lerp(this.cast.plane.position, gone * 0.65);
      // Settle at the crest before the child leaves us to walk home.
      const home = THREE.MathUtils.smootherstep(elapsed, reveal.returnFrom, WATCHES_IT);
      this.descentChild.copy(c).y += 1.5;
      this.descentHouse.copy(this.cast.cottage.position).y += 6;
      s.target.lerp(this.tmp.copy(this.descentChild).lerp(this.descentHouse, reveal.descentHouseWeight), home);
      this.tmp.copy(c).addScaledVector(this.behind.set(-TO_COTTAGE.x, 0, -TO_COTTAGE.y), reveal.crestBack);
      this.tmp.y += reveal.crestRise;
      this.readingEye.lerp(this.tmp, home);
    }
    this.pace = close ? 1.6 : 0.8;
    this.focus.copy(c);
    return true;
  }

  /** Use the actual eased camera: timers alone cannot guarantee that the player saw either reveal. */
  afterCamera(camera: THREE.PerspectiveCamera): void {
    if (this.beat === 'release') {
      // Keep the actual eased view, not its requested endpoint, for a continuous stationary goodbye.
      this.farewellEye.copy(camera.position);
      camera.getWorldDirection(this.farewellLook).multiplyScalar(SEA_LOOK).add(camera.position);
      this.farewellCaptured = true;
    }
    if (!['brow', 'settle', 'unfold', 'gaze'].includes(this.beat)) return;
    camera.updateMatrixWorld();
    const visible = (point: THREE.Vector3, margin: number, grass = false): boolean => {
      this.screen.copy(point).project(camera);
      if (this.screen.z < -1 || this.screen.z > 1 || Math.abs(this.screen.x) > margin || Math.abs(this.screen.y) > margin) return false;
      for (let i = 1; i < 40; i++) {
        this.sight.copy(camera.position).lerp(point, i / 40);
        const clearance = 0.12 + (grass ? 0.9 * THREE.MathUtils.smoothstep(this.sight.distanceTo(point), 0, 4) : 0);
        if (heightAt(this.sight.x, this.sight.z) > this.sight.y - clearance) return false;
      }
      return true;
    };
    this.aim.copy(this.cast.cottage.position).y += 2.6;
    this.houseInFrame = visible(this.aim, 0.8, true)
      && [-4, 0, 4].every(x => visible(this.aim.set(x, 0.6, 2.4).applyMatrix4(this.cast.cottage.group.matrixWorld), 0.9, true))
      && visible(this.aim.set(0, 5.9, 0).applyMatrix4(this.cast.cottage.group.matrixWorld), 0.9, true);
    if (this.beat === 'brow') {
      if (!this.houseInFrame) this.houseSeenAt = -1;
      else if (this.houseSeenAt < 0) this.houseSeenAt = this.now;
    }
    this.paperInFrame = this.paper && [-1.65, 1.65].every(x => [-1.225, 1.225].every(y =>
      visible(this.cast.drawing.point(x, y, this.sheet), 0.88)));
  }

  /** A fixed place at the crest, including when loading the completed ending directly. */
  private frameFarewell(): void {
    if (!this.farewellCaptured) {
      this.farewellEye.set(BROW.x, heightAt(BROW.x, BROW.y) + tuning.homeReveal.crestRise, BROW.y)
        .addScaledVector(this.behind.set(-TO_COTTAGE.x, 0, -TO_COTTAGE.y), tuning.homeReveal.crestBack);
    }
    this.aim.copy(this.cast.cottage.position).y += 2.5;
    this.aim.sub(this.farewellEye).normalize().multiplyScalar(SEA_LOOK).add(this.farewellEye);
    if (!this.farewellCaptured) {
      this.farewellLook.copy(this.aim);
      this.farewellCaptured = true;
    }
    this.shot.eye = this.farewellEye;
    this.shot.exact = true;
  }

  private frame(): void {
    const c = this.cast.child.position;
    const s = this.shot;
    s.from = undefined;
    s.eye = undefined;
    s.fitWidth = false;
    s.clearance = undefined;
    s.carry = false;
    s.carryAnchor = undefined;
    s.subjects = undefined;
    s.smoothFit = undefined;
    s.exact = false;
    if (this.frameDrawing()) return;
    if (this.beat === 'answered') {
      /**
       * Tilted up into the sky the family is wheeling in, with the child small at the bottom of the frame and
       * the cygnet climbing through the middle of it. The whole point of the shot is how much sky there is.
       */
      const k = this.cast.cygnet.position;
      const g = this.gathering;
      s.from = undefined;
      s.eye = this.eyeAt.set(c.x + 3.4, c.y + 3.2, c.z + 10.5);
      s.target.set(g.x, g.y + 2, g.z);
      this.pace = 0.32;
      this.focus.copy(k);
      return;
    }
    if (this.beat === 'fledge') {
      /**
       * From the south of the summit, at the child's own head height, looking north past them at the small one
       * flying its circuit with the family wheeling beyond: all three in one frame, and the rest of it sky. The
       * frame opens out as the circuit does, so what widens is the flight and not the camera's opinion of it.
       */
      const k = this.cast.cygnet.position;
      const f = tuning.fledge;
      const open = THREE.MathUtils.smoothstep(this.t / (f.loopFor + f.swingFor), 0, 1);
      /** And in again as it breaks off the circuit, so the goodbye is nearer than anything else in the sequence. */
      const near = THREE.MathUtils.smoothstep(this.t, f.loopFor, f.loopFor + f.swingFor);
      s.from = FROM_SOUTH;
      s.target.set(c.x, c.y + 1.7 + THREE.MathUtils.clamp((k.y - c.y) * 0.5, 0, 5), c.z + f.offset);
      s.distance = 14 + 4.5 * open - 4 * near;
      s.height = THREE.MathUtils.clamp(c.y + 2.6 - s.target.y, -9, 2);
      /** It arrives on this framing rather than gliding onto it for a third of the circuit, and then it settles. */
      this.pace = 0.45 + 0.8 * (1 - open);
      this.focus.copy(k);
      return;
    }
    if (this.beat === 'setDown' || this.beat === 'tries' || this.beat === 'flying') {
      // Move closer on the same side of the hill. The family remains in the sky beyond the small one.
      const k = this.cast.cygnet.position;
      const ground = Math.max(heightAt(k.x, k.z), 0);
      const f = tuning.summit;
      s.eye = this.eyeAt.set(c.x + f.flightSide, ground + f.flightEye, c.z + f.flightBack);
      s.target.set(k.x, k.y + f.flightLookUp, k.z - f.flightLookAhead);
      this.pace = 0.45;
      this.focus.copy(c);
      return;
    }
    if (this.beat === 'gone') {
      /**
       * Anchored on the child for good now. What matters here is not where the cygnet has got to but the face of the
       * person who let it go, so the camera stays behind them and only tilts up after it.
       */
      const k = this.cast.cygnet.visible ? this.cast.cygnet.position : this.cast.flock.head;
      s.from = FROM_SOUTH;
      s.distance = 17;
      /**
       * The camera tilts a little over half the way up to them and no further, so the child is always in the lower
       * frame and the family always in the upper. Going, they sink toward the horizon by themselves; nothing has to
       * crane after them, and once they are out of sight the frame is back on the child, who the shot was about.
       */
      const eye = c.y + 3.4;
      const elevation = this.cast.cygnet.visible ? (k.y - eye) / Math.max(20, Math.hypot(k.x - c.x, k.z - c.z) + s.distance) : 0;
      s.target.set(c.x, eye + s.distance * THREE.MathUtils.clamp(elevation * 0.55, -0.1, 0.5), c.z);
      s.height = eye - s.target.y;
      this.pace = 0.4;
      this.focus.copy(c);
      return;
    }
    if (this.beat === 'summit') {
      // Stay on the south side: the approaching V banks across the sky beyond both companions.
      const f = tuning.summit;
      const aspect = typeof window === 'undefined' ? 16 / 9 : window.innerWidth / window.innerHeight;
      const back = aspect < 1 ? Math.max(f.arrivalBack, f.portraitBack * 0.46 / aspect) : f.arrivalBack;
      s.eye = this.eyeAt.set(c.x, c.y + f.arrivalRise, c.z + back);
      s.target.set(c.x + 2, c.y + 8, c.z - f.arrivalLookAhead);
      this.pace = 0.65;
      this.focus.copy(c);
      return;
    }
    if (this.beat === 'home') {
      const reveal = tuning.homeReveal;
      this.frameFarewell();
      s.target.lerpVectors(this.farewellLook, this.aim,
        THREE.MathUtils.smootherstep(this.t, 0, reveal.homePanFor));
      this.focus.copy(c);
      return;
    }
    if (this.beat === 'inside' || this.beat === 'credits') {
      /** Stay where we said goodbye; only our gaze leaves the cottage for the moon and stars. */
      this.frameFarewell();
      s.target.copy(this.aim);
      const lift = this.beat === 'credits' ? 1 : this.beat === 'inside' ? THREE.MathUtils.smootherstep(this.t, RISE_FROM, RISE_TO) : 0;
      if (lift > 0) {
        /** Out over the open sea north-east of the island, which is the one way from here that holds both. */
        const aspect = typeof window === 'undefined' ? 16 / 9 : window.innerWidth / window.innerHeight;
        const halfField = Math.tan(THREE.MathUtils.degToRad(verticalFov(aspect)) / 2);
        const moonOffset = Math.min(MOON_OFF, Math.atan(halfField * aspect * 0.6));
        const out = this.sky.copy(this.moon).setY(0).normalize().applyAxisAngle(UP, -moonOffset);
        s.target.lerp(this.tmp.copy(this.farewellEye).addScaledVector(out, SEA_LOOK)
          .setY(this.farewellEye.y + SEA_LOOK * halfField / 3), lift);
      }
      this.focus.copy(c);
      return;
    }
    if (this.beat === 'ashore' && c.z > HOME_JETTY.shoreZ - 1.5) {
      /**
       * The one arrival in the journey that is watched from the water: low off the jetty's seaward quarter, with
       * the boat lying against the end, the length of the planks and the child walking in all in the one frame,
       * and the hill they are about to go up behind them. It hands over to the climb as they reach the sand.
       */
      const arrival = tuning.homeApproach;
      s.eye = this.eyeAt.set(HOME_JETTY.x + arrival.dockEyeX, arrival.dockEyeY, HOME_JETTY.endZ + arrival.dockEyeZ);
      s.target.set(c.x, HOME_JETTY.deck + 1.1, c.z);
      this.pace = 0.5;
      this.focus.copy(c);
      return;
    }
    /**
     * The hill is steeper than the lens is tall: from behind and above, the whole frame is grass. So the climb is
     * watched from low behind them, looking up the slope, and they go up against the crest and the sky.
     */
    const ground = Math.max(heightAt(c.x, c.z), 0);
    const ahead = Math.max(heightAt(c.x, c.z - 8), 0);
    s.target.set(c.x, ahead + 3, c.z - 8);
    s.distance = 24;
    s.height = ground - 0.6 - s.target.y;
    this.pace = 0.35;
    this.focus.set(c.x, ground, c.z);
  }
}
