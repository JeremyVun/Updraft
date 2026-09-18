import * as THREE from 'three';
import type { Shot } from '../camera';
import { LAST_HILL } from '../world/heightfield';
import { heightAt } from '../world/island';
import { MOON, sunDirection } from '../world/palette';
import type { Coax } from '../fx/swirl';
import { tuning } from '../tuning';
import type { Deck } from '../traveller/traveller';
import type { Cast, Chapter } from './cast';
import { cue } from './cues';

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
  | 'release'
  | 'nightfall'
  | 'home'
  | 'inside'
  | 'credits';

/** North, where the flock went and where the cygnet has been trying to get to since the first island. */
const NORTH = Math.PI;
/** The flock comes over of its own accord after this long, calling, to tell the player what is being asked of them. */
const PROMPT_AT = 55;
/** And if the player still never lifts it, the night wind does, because nothing in this game is ever failed. */
const RELENT_AT = 130;
/** Seconds the family has been wheeling before the cygnet lets go of the player's wind and flies by itself. */
const FLEDGES_AFTER = 3;
/** How near the wheel it has to get before the family takes it in and they all go north together. */
const JOIN_AT = 9;
/** How fast the family flies off with it, and how it climbs as it goes: slow enough that the small one can hold on. */
const LEAVE_SPEED = 9;
const LEAVE_CLIMB = 1.1;
/** Seconds the child watches them go before sitting down with the plane. */
const WATCHES_FOR = 14;
/** The camera comes round to the drawing before the sheet starts to open, and the sheet opens slowly. */
const SETTLE_FOR = 4;
const UNFOLD_RATE = 0.32;
const GAZE_FOR = 7;
const FOLD_RATE = 0.8;
const RELEASE_FOR = 9.5;
const NIGHTFALL_FOR = 11;
/** The rise to the stars: when it starts after the door, when it is done, when the music is cut, when the credits roll. */
const RISE_FROM = 2;
const RISE_TO = 24;
const SILENCE_AT = 23.5;
const CREDITS_AT = 26;

/**
 * The jetty on the south beach: out from the shore over the water, with a deck the child walks in along. The one
 * arrival in the journey that has somewhere built for it, which is how you know it is home.
 */
export const HOME_JETTY = { x: -45, shoreZ: -1950, endZ: -1927, halfWidth: 1.2, deck: 0.7 } as const;
/** Where the boat comes alongside the end of it and lies, bow to the east. */
export const HOME_MOORING = { x: -45.5, z: -1925.4, yaw: Math.PI / 2 } as const;
const JETTY_DECK: Deck = { x0: HOME_JETTY.x, z0: HOME_JETTY.shoreZ + 1, x1: HOME_JETTY.x, z1: HOME_JETTY.endZ, halfWidth: HOME_JETTY.halfWidth, height: HOME_JETTY.deck };
/** The crest of the last hill, where the ground falls away and the cottage comes into view. */
const SUMMIT = new THREE.Vector2(LAST_HILL.x, LAST_HILL.z);
/** From the summit the sun sets over the cottage, to the north-west. */
const TOWARD_SUNSET = new THREE.Vector2(-Math.sin(THREE.MathUtils.degToRad(32)), -Math.cos(THREE.MathUtils.degToRad(32)));
/** The camera's side of the summit while the cygnet flies its circuit: south, with the family wheeling to the north beyond it. */
const FROM_SOUTH = new THREE.Vector3(0.14, 0, 1).normalize();

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
  readonly haze = 0.5;
  dusk = 0.85;
  readonly shot: Shot = { target: new THREE.Vector3(), distance: 40, height: 12 };
  readonly music = 'home' as const;
  readonly season = 1;
  readonly focus = new THREE.Vector3();
  private beatStart = 0;
  private duskTarget = 0.85;
  private now = 0;
  private readonly hand = new THREE.Vector3();
  private readonly tmp = new THREE.Vector3();
  private readonly held = new THREE.Vector3();
  private readonly behind = new THREE.Vector3();
  private readonly sky = new THREE.Vector3();
  private readonly fwd = new THREE.Vector3();
  private readonly eyeAt = new THREE.Vector3();
  private readonly moon = sunDirection(MOON.az, MOON.el);
  private readonly side = new THREE.Vector3();
  private readonly onCygnet = new THREE.Vector3();
  trodden: THREE.Vector3 | null = null;
  hush = 0;
  silence = false;
  finished = false;
  private nextCall = 0;
  private flockCalled = false;
  private tried = 0;
  private called = false;
  private answeredBack = false;
  private leftAt = 0;
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
    child.place(HOME_JETTY.x, HOME_JETTY.endZ + 0.3, NORTH);
    child.walkTo(HOME_JETTY.x, HOME_JETTY.shoreZ - 4, false, () => {
      const from = child.position;
      child.walkTo(from.x + (SUMMIT.x - from.x) * 0.45, from.z + (SUMMIT.y - from.z) * 0.45, false, () => this.climb(), 2);
    }, 1);
  }

  /**
   * The ending is watched, not played, with two exceptions — and they are the two that matter. The player puts the
   * cygnet into the air for the last time, and the player sends the paper plane away.
   */
  get scripted(): boolean {
    return (
      this.beat !== 'release' &&
      this.beat !== 'setDown' &&
      this.beat !== 'tries' &&
      this.beat !== 'flying' &&
      this.beat !== 'answered'
    );
  }

  get done(): boolean {
    return false;
  }

  /** For testing the ending: straight to the top of the hill, plane in hand. */
  skipToSummit(): void {
    const { child, plane } = this.cast;
    child.stop();
    child.place(SUMMIT.x + 5, SUMMIT.y + 26, Math.PI);
    child.standUp();
    plane.hold(child.handPosition(this.hand), child.yaw);
    this.climb();
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
      this.duskTarget = 1;
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
    this.dusk += (this.duskTarget - this.dusk) * (1 - Math.exp(-dt * 0.22));
    const staged = this.beat === 'setDown' || this.beat === 'tries' || this.beat === 'flying' || this.beat === 'answered';
    if (!staged) this.hush += (0 - this.hush) * (1 - Math.exp(-dt * 0.5));
    if (p.held) p.hold(c.handPosition(this.hand), c.yaw);
    this.frame();
  }

  /** They stand it in the grass facing north, and step back off it, and that is all they can do for it. */
  private setDown(): void {
    const { child: c, cygnet } = this.cast;
    this.to('setDown');
    /** The last of the light: it goes while the sun is still going, and the night comes on after it. */
    this.duskTarget = 1.15;
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
    const { child: c, cygnet, flock } = this.cast;
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
    if ((this.beat === 'tries' || this.beat === 'flying') && cygnet.flying && up > 4.5) {
      this.answered();
      return;
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
        cygnet.fledge();
        this.to('fledge');
      }
      return;
    }
    if (this.beat !== 'flying') return;

    if (this.now > this.nextCall) {
      cue('calling');
      this.nextCall = this.now + 5.5 + Math.random() * 2;
    }
    /** They come over calling, whether or not the player has worked it out: an answer, and a nudge. */
    if (!this.flockCalled && this.t > PROMPT_AT) {
      this.flockCalled = true;
      flock.pass(c.position.x, c.position.z, c.position.y + 38, NORTH, 13, 190);
      cue('skein');
    }
    if (this.t > RELENT_AT) this.answered();
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
    /**
     * Wheeling a little way off to the north rather than straight overhead: a column of swans turning in the
     * sky is only legible side on, and directly above the child it is a tower nobody can see the top of.
     */
    this.gathering.set(c.position.x + 5, c.position.y + 8, c.position.z - 34);
    flock.circle(this.gathering.x, this.gathering.z, this.gathering.y, 22, 22, 20);
    this.nextCall = this.now + 1.2;
    cue('lifted');
  }

  /**
   * Flying by itself now, round and round the child, steadier every turn. Then it comes round to face them and
   * calls — the third call in the story, and the first one anything answers — and goes to its family.
   */
  private updateFledge(): void {
    const { child: c, cygnet, flock } = this.cast;
    c.lookAt = cygnet.position;
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
        /** The last place in the V: the one it fell out of over the first island. */
        return flock.tail(out).addScaledVector(flock.direction, -4.4).add(this.tmp.set(flock.direction.z, 0.3, -flock.direction.x).multiplyScalar(2.2));
      });
      this.to('gone');
    }
  }

  /** It reaches the wheel, and the whole family goes north with it in the line, and the child watches them out of sight. */
  private updateGone(): void {
    const { child: c, cygnet, flock } = this.cast;
    if (flock.wheeling && cygnet.position.distanceTo(flock.head) < JOIN_AT) {
      flock.goOn(NORTH, LEAVE_CLIMB, LEAVE_SPEED);
      this.leftAt = this.now;
      cue('skein');
      c.cheer();
    }
    c.lookAt = cygnet.visible ? cygnet.position : flock.head;
    const away = this.leftAt > 0 && (this.now - this.leftAt > WATCHES_FOR || !cygnet.visible);
    if (away && !c.busy) {
      c.sitDown();
      c.faceToward(c.position.x + TOWARD_SUNSET.x * 10, c.position.z + TOWARD_SUNSET.y * 10, 1);
      this.to('settle');
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
      c.lookAt = this.sky;
      if (c.sitting && this.t > 4.5 && !c.busy) this.setDown();
    } else if (this.beat === 'setDown' || this.beat === 'tries' || this.beat === 'flying' || this.beat === 'answered') {
      this.updateFlight(dt);
    } else if (this.beat === 'fledge') {
      this.updateFledge();
    } else if (this.beat === 'gone') {
      this.updateGone();
    } else if (this.beat === 'settle') {
      /** The plane comes up in both hands first, and the camera comes round to it, and only then does it open. */
      c.presenting = Math.min(1, c.presenting + dt * 0.8);
      c.lookAt = c.presentPoint(this.held);
      if (this.t > SETTLE_FOR) {
        this.to('unfold');
        cue('unfold');
      }
    } else if (this.beat === 'unfold') {
      drawing.open = Math.min(1, drawing.open + dt * UNFOLD_RATE);
      c.lookAt = c.presentPoint(this.held);
      p.visible = drawing.open < 0.35;
      if (drawing.open >= 1) this.to('gaze');
    } else if (this.beat === 'gaze') {
      c.lookAt = c.presentPoint(this.held);
      if (this.t > GAZE_FOR) this.to('fold');
    } else if (this.beat === 'fold') {
      drawing.open = Math.max(0, drawing.open - dt * FOLD_RATE);
      c.presenting = Math.max(0, c.presenting - dt * 1.4);
      p.visible = drawing.open < 0.35;
      if (drawing.open <= 0) {
        this.to('release');
        c.standUp();
        c.faceToward(faceX, faceZ, 1);
      }
    } else if (this.beat === 'release') {
      if (this.t > 1.2 && p.held && !c.busy) {
        c.throwToward(faceX, faceZ, () => {
          p.launch(c.handPosition(this.hand), this.tmp.set(TOWARD_SUNSET.x * 6, 6.5, TOWARD_SUNSET.y * 6));
          p.depart(this.tmp.set(TOWARD_SUNSET.x, 0, TOWARD_SUNSET.y));
          cue('release');
        });
      }
      c.lookAt = p.position;
      if (!p.held && this.t > 3 && this.t < 3.05) c.cheer();
      if (this.t > RELEASE_FOR) {
        this.to('nightfall');
        c.sitDown();
        this.duskTarget = 2;
      }
    } else if (this.beat === 'nightfall') {
      c.lookAt = this.sky;
      if (p.position.distanceTo(c.position) > 160) p.visible = false;
      if (this.t > NIGHTFALL_FOR) {
        this.to('home');
        c.standUp();
        /** Down the hill at a run: it is home, and the light is on. */
        c.walkTo(cottage.doorstep.x, cottage.doorstep.z, true, () => {
          cottage.openDoor(true);
          cue('home');
          this.to('inside');
        }, 0.5);
      }
    } else if (this.beat === 'home') {
      c.lookAt = cottage.position;
    } else if (this.beat === 'inside') {
      if (this.t > 1.2 && this.t < 1.25) c.walkTo(cottage.position.x, cottage.position.z, false, undefined, 0.3);
      if (this.t > 2.6) c.visible = false;
      if (this.t > 4.2) cottage.openDoor(false);
      if (this.t > RISE_FROM && this.t < RISE_FROM + 0.05 && !this.silence) cue('finale');
      if (this.t > SILENCE_AT) this.silence = true;
      if (this.t > CREDITS_AT) {
        this.finished = true;
        this.to('credits');
      }
    }

    const at = c.presentPoint(this.held);
    drawing.place(at, this.behind.copy(at).addScaledVector(this.forward(), -6), this.now);
  }

  private frame(): void {
    const c = this.cast.child.position;
    const p = this.cast.plane.position;
    const s = this.shot;
    s.from = undefined;
    s.eye = undefined;
    if (this.beat === 'settle' || this.beat === 'unfold' || this.beat === 'gaze' || this.beat === 'fold') {
      /**
       * Over the child's shoulder and off to one side, framed on their hands: the plane opening into the drawing
       * is the whole subject, with the cottage it is a drawing of down the hill beyond it.
       */
      const fwd = this.forward();
      const held = this.cast.child.presentPoint(this.held);
      /** On the left, which is the side the child holds it out to, so the head is never between the camera and the sheet. */
      s.eye = this.eyeAt.set(c.x - fwd.x * 4.4 - fwd.z * 3, c.y + 2.35, c.z - fwd.z * 4.4 + fwd.x * 3);
      s.target.set(held.x, held.y + 0.1, held.z);
      this.pace = 0.6;
      this.focus.copy(c);
      return;
    }
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
       * From the south of the summit, low, looking north over the child at the cygnet flying its circuit, with
       * the family wheeling in the sky beyond: the child, the small one and the family in one frame.
       */
      const k = this.cast.cygnet.position;
      const gap = Math.hypot(k.x - c.x, k.z - c.z);
      s.from = FROM_SOUTH;
      s.target.set(c.x + (k.x - c.x) * 0.6, c.y + 1.2 + (k.y - c.y - 1.2) * 0.6, c.z + (k.z - c.z) * 0.6);
      s.distance = 11 + gap * 0.3;
      s.height = THREE.MathUtils.clamp(c.y + 2.4 - s.target.y, -8, 3);
      this.pace = 0.5;
      this.focus.copy(c);
      return;
    }
    if (this.beat === 'setDown' || this.beat === 'tries' || this.beat === 'flying') {
      /** The same frame as the meadow and the same frame as the fall: over their shoulder, looking up past them. */
      const k = this.cast.cygnet.position;
      const ground = Math.max(heightAt(k.x, k.z), 0);
      const gap = Math.hypot(k.x - c.x, k.z - c.z);
      const rise = THREE.MathUtils.clamp((k.y - ground) / 4, 0, 1);
      const toChild = gap > 0.5 ? Math.atan2(c.x - k.x, c.z - k.z) : this.cast.child.yaw + Math.PI;
      s.from = this.side.set(Math.sin(toChild + 1.1 * (1 - rise)), 0, Math.cos(toChild + 1.1 * (1 - rise)));
      s.target.set(k.x, k.y + 0.4, k.z);
      /**
       * The camera stays down at head height on the ground whatever the cygnet does, so that once it is up the
       * frame is looking up at it with sky behind it. Hung a fixed distance above the cygnet instead, it follows
       * the cygnet into the air and the background is always grass — which is the opposite of the point.
       */
      s.distance = 14 + gap * 0.4;
      s.height = THREE.MathUtils.clamp(ground + 2.8 - k.y, -9, 2.8);
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
      const toCygnet = Math.atan2(k.x - c.x, k.z - c.z);
      s.from = this.side.set(-Math.sin(toCygnet), 0, -Math.cos(toCygnet));
      /** Once they are out of sight the frame comes back down to the child, who is what the shot was about. */
      const lift = this.cast.cygnet.visible ? Math.min(15, Math.max(0, k.y - c.y) * 0.55) : 0;
      s.target.set(c.x, c.y + 2.2 + lift, c.z);
      s.distance = 17;
      s.height = 3.5;
      this.pace = 0.4;
      this.focus.copy(c);
      return;
    }
    if (this.beat === 'summit' || this.beat === 'release' || this.beat === 'nightfall') {
      const fwd = this.forward();
      s.from = this.behind.copy(fwd).negate();
      const lift = this.beat === 'release' ? Math.min(10, Math.max(0, p.y - c.y - 4) * 0.4) : 0;
      /** Framed so the child stays in the bottom third while the plane goes: the throw is watched from beside them. */
      s.target.set(c.x + fwd.x * 9, c.y + 1.2 + lift, c.z + fwd.z * 9);
      s.distance = this.beat === 'nightfall' ? 30 : 20;
      s.height = this.beat === 'nightfall' ? 8 : 5;
      this.pace = 0.3;
      this.focus.copy(c);
      return;
    }
    if (this.beat === 'home' || this.beat === 'inside' || this.beat === 'credits') {
      /** One framing from the run down to the door until the rise, so the door is never waited on by a camera re-settling. */
      const cot = this.cast.cottage.position;
      s.target.set(c.x * 0.3 + cot.x * 0.7, cot.y + 2.5, c.z * 0.3 + cot.z * 0.7);
      s.from = this.behind.set(SUMMIT.x - cot.x, 0, SUMMIT.y - cot.z).normalize();
      s.distance = 58;
      s.height = 28;
      this.pace = 0.2;
      const lift = this.beat === 'credits' ? 1 : this.beat === 'inside' ? THREE.MathUtils.smootherstep(this.t, RISE_FROM, RISE_TO) : 0;
      if (lift > 0) {
        s.eye = this.eyeAt.copy(s.target).addScaledVector(s.from, s.distance).setY(s.target.y + s.height + lift * 18);
        const toMoon = this.sky.copy(this.moon).setY(0).normalize();
        s.target.lerp(this.tmp.copy(s.eye).addScaledVector(toMoon, 100).setY(s.eye.y + 24), lift);
      }
      this.pace = 0.2 - lift * 0.12;
      this.focus.copy(c);
      return;
    }
    const ground = Math.max(heightAt(c.x, c.z), 0);
    s.target.set(c.x, ground + 3, c.z - 6);
    s.distance = 34;
    s.height = 11;
    this.pace = 0.35;
    this.focus.set(c.x, ground, c.z);
  }
}
