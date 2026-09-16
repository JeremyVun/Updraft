import * as THREE from 'three';
import type { Shot } from '../camera';
import { LAST_HILL } from '../world/heightfield';
import { heightAt } from '../world/island';
import { MOON, sunDirection } from '../world/palette';
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
  | 'gone'
  | 'unfold'
  | 'gaze'
  | 'fold'
  | 'release'
  | 'nightfall'
  | 'home'
  | 'inside';

/** North, where the flock went and where the colt has been trying to get to since the first island. */
const NORTH = Math.PI;
/** The flock comes over of its own accord after this long, calling, to tell the player what is being asked of them. */
const PROMPT_AT = 55;
/** And if the player still never lifts it, the night wind does, because nothing in this game is ever failed. */
const RELENT_AT = 130;
/** How long the flock wheels overhead once it has come down, before they all go north together. */
const REUNION = 9;

/** The crest of the last hill, where the ground falls away and the cottage comes into view. */
const SUMMIT = new THREE.Vector2(LAST_HILL.x, LAST_HILL.z);
/** From the summit the sun sets over the cottage, to the north-west. */
const TOWARD_SUNSET = new THREE.Vector2(-Math.sin(THREE.MathUtils.degToRad(32)), -Math.cos(THREE.MathUtils.degToRad(32)));

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
  private readonly onColt = new THREE.Vector3();
  trodden: THREE.Vector3 | null = null;
  hush = 0;
  private nextCall = 0;
  private flockCalled = false;
  private tried = 0;
  private readonly gathering = new THREE.Vector3();

  constructor(private readonly cast: Cast) {
    const { child, plane } = cast;
    plane.homeRadius = 70;
    child.dismount();
    const from = child.position;
    child.walkTo(from.x + (SUMMIT.x - from.x) * 0.45, from.z + (SUMMIT.y - from.z) * 0.45, false, () => this.climb(), 2);
  }

  /**
   * The ending is watched, not played, with two exceptions — and they are the two that matter. The player puts the
   * colt into the air for the last time, and the player sends the paper plane away.
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
    this.to('climb');
    c.lookAt = null;
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
    const { child: c, crane } = this.cast;
    this.to('setDown');
    /** The last of the light: it goes while the sun is still going, and the night comes on after it. */
    this.duskTarget = 1.15;
    c.standUp();
    const x = c.position.x + Math.sin(c.yaw) * 2.2;
    const z = c.position.z + Math.cos(c.yaw) * 2.2;
    this.trodden = new THREE.Vector3(x, 12, z);
    c.lookAt = crane.eye(this.onColt);
    c.pickUp(() => {
      crane.position.set(x, Math.max(heightAt(x, z), 0), z);
      crane.yaw = NORTH;
      crane.follow();
      c.faceToward(x, z, 1);
      this.to('tries');
      this.nextCall = this.now + 3;
    });
  }

  /**
   * The last thing the player does, and the thing the whole journey has been teaching them to do. It calls north
   * and nothing answers, the way nothing answered at the crest. Then the player raises the wind under it, and this
   * time it does not come down — and out of the dark its family comes down for it.
   */
  private updateFlight(dt: number): void {
    const { child: c, crane, flock } = this.cast;
    c.lookAt = crane.gone || crane.flying ? crane.position : crane.eye(this.onColt);
    const quiet = crane.gone || this.beat === 'answered' ? 0 : 0.7;
    this.hush += (quiet - this.hush) * (1 - Math.exp(-dt * 0.8));

    /**
     * It tries by itself first, twice, and drops both times. Nothing else in the scene moves while it does. The
     * player is not told they are needed: they are shown that nobody else can do this.
     */
    const ground = Math.max(heightAt(crane.position.x, crane.position.z), 0);
    const up = crane.position.y - ground;
    /** A player who works it out during the colt's own attempts is never made to wait for the beat to finish. */
    if ((this.beat === 'tries' || this.beat === 'flying') && crane.flying && up > 4.5) {
      this.answered();
      return;
    }

    if (this.beat === 'tries') {
      if (this.t > 2 && this.tried < 1) {
        this.tried = 1;
        crane.tryToFly();
      }
      if (this.t > 6 && this.tried < 2) {
        this.tried = 2;
        crane.tryToFly();
      }
      if (this.t > 8 && this.now > this.nextCall) {
        cue('calling');
        this.nextCall = this.now + 6;
      }
      if (this.t > 10.5) this.to('flying');
      return;
    }

    /** They have come down for it. It is still the player holding it up there, and they hold it all the way. */
    if (this.beat === 'answered') {
      if (this.now > this.nextCall) {
        cue('calling');
        this.nextCall = this.now + 4.5 + Math.random();
      }
      if (this.t > REUNION) this.away();
      return;
    }
    if (this.beat !== 'flying') return;

    if (!crane.gone && this.now > this.nextCall) {
      cue('calling');
      this.nextCall = this.now + 5.5 + Math.random() * 2;
    }
    /** They come over calling, whether or not the player has worked it out: an answer, and a nudge. */
    if (!this.flockCalled && this.t > PROMPT_AT) {
      this.flockCalled = true;
      flock.pass(c.position.x, c.position.z, c.position.y + 38, NORTH, 13, 190);
      cue('skein');
    }
    if (this.t > RELENT_AT && !crane.gone) this.answered();
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
     * Wheeling a little way off to the north rather than straight overhead: a column of cranes turning in the
     * sky is only legible side on, and directly above the child it is a tower nobody can see the top of.
     */
    this.gathering.set(c.position.x + 5, c.position.y + 8, c.position.z - 34);
    flock.circle(this.gathering.x, this.gathering.z, this.gathering.y, 22, 22, 20);
    this.nextCall = this.now + 1.2;
    cue('lifted');
  }

  /** It goes. The skein comes down for it out of the night and takes it in, and they go north together. */
  private away(): void {
    const { child: c, crane, flock } = this.cast;
    if (crane.gone) return;
    crane.leave(NORTH);
    if (!this.flockCalled) {
      this.flockCalled = true;
      cue('skein');
    }
    flock.pass(c.position.x, c.position.z, Math.max(crane.position.y + 20, c.position.y + 34), NORTH, 13, 150);
    cue('calling');
    this.to('gone');
    c.cheer();
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
    } else if (this.beat === 'gone') {
      c.lookAt = this.cast.flock.head;
      if (this.t > 13 && !c.busy) {
        c.sitDown();
        c.faceToward(faceX, faceZ, 1);
        this.to('unfold');
        cue('unfold');
      }
    } else if (this.beat === 'unfold') {
      drawing.open = Math.min(1, drawing.open + dt * 0.9);
      c.presenting = Math.min(1, c.presenting + dt * 1.5);
      p.visible = drawing.open < 0.35;
      if (drawing.open >= 1) this.to('gaze');
    } else if (this.beat === 'gaze') {
      c.lookAt = c.presentPoint(this.held);
      if (this.t > 9) this.to('fold');
    } else if (this.beat === 'fold') {
      drawing.open = Math.max(0, drawing.open - dt * 1.1);
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
      if (this.t > 12) {
        this.to('nightfall');
        c.sitDown();
        this.duskTarget = 2;
      }
    } else if (this.beat === 'nightfall') {
      c.lookAt = this.sky;
      if (p.position.distanceTo(c.position) > 160) p.visible = false;
      if (this.t > 26) {
        this.to('home');
        c.standUp();
        c.walkTo(cottage.doorstep.x, cottage.doorstep.z, false, () => {
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
    if (this.beat === 'unfold' || this.beat === 'gaze' || this.beat === 'fold') {
      const cot = this.cast.cottage.position;
      const fwd = this.forward();
      s.eye = this.eyeAt.set(c.x - fwd.x * 4 - fwd.z * 0.45, c.y + 4.2, c.z - fwd.z * 4 + fwd.x * 0.45);
      s.target.set(cot.x, cot.y + 6, cot.z);
      this.pace = 0.6;
      this.focus.copy(c);
      return;
    }
    if (this.beat === 'answered') {
      /**
       * Tilted up into the sky the family is wheeling in, with the child small at the bottom of the frame and
       * the colt climbing through the middle of it. The whole point of the shot is how much sky there is.
       */
      const k = this.cast.crane.position;
      const g = this.gathering;
      s.from = undefined;
      s.eye = this.eyeAt.set(c.x + 3.4, c.y + 3.2, c.z + 10.5);
      s.target.set(g.x, g.y + 2, g.z);
      this.pace = 0.32;
      this.focus.copy(k);
      return;
    }
    if (this.beat === 'setDown' || this.beat === 'tries' || this.beat === 'flying') {
      /** The same frame as the meadow and the same frame as the fall: over their shoulder, looking up past them. */
      const k = this.cast.crane.position;
      const ground = Math.max(heightAt(k.x, k.z), 0);
      const gap = Math.hypot(k.x - c.x, k.z - c.z);
      const rise = THREE.MathUtils.clamp((k.y - ground) / 4, 0, 1);
      const toChild = gap > 0.5 ? Math.atan2(c.x - k.x, c.z - k.z) : this.cast.child.yaw + Math.PI;
      s.from = this.side.set(Math.sin(toChild + 1.1 * (1 - rise)), 0, Math.cos(toChild + 1.1 * (1 - rise)));
      s.target.set(k.x, k.y + 0.4, k.z);
      /**
       * The camera stays down at head height on the ground whatever the colt does, so that once it is up the
       * frame is looking up at it with sky behind it. Hung a fixed distance above the colt instead, it follows
       * the colt into the air and the background is always grass — which is the opposite of the point.
       */
      s.distance = 14 + gap * 0.4;
      s.height = THREE.MathUtils.clamp(ground + 2.8 - k.y, -9, 2.8);
      this.pace = 0.45;
      this.focus.copy(c);
      return;
    }
    if (this.beat === 'gone') {
      /**
       * Anchored on the child for good now. What matters here is not where the colt has got to but the face of the
       * person who let it go, so the camera stays behind them and only tilts up after it.
       */
      const k = this.cast.crane.position;
      const toColt = Math.atan2(k.x - c.x, k.z - c.z);
      s.from = this.side.set(-Math.sin(toColt), 0, -Math.cos(toColt));
      s.target.set(c.x, c.y + 2.2 + Math.min(15, Math.max(0, k.y - c.y) * 0.55), c.z);
      s.distance = 17;
      s.height = 3.5;
      this.pace = 0.4;
      this.focus.copy(c);
      return;
    }
    if (this.beat === 'summit' || this.beat === 'release' || this.beat === 'nightfall') {
      const fwd = this.forward();
      s.from = this.behind.copy(fwd).negate();
      const lift = this.beat === 'release' ? Math.min(12, Math.max(0, p.y - c.y - 4) * 0.4) : 0;
      s.target.set(c.x + fwd.x * 14, c.y + 1.5 + lift, c.z + fwd.z * 14);
      s.distance = this.beat === 'nightfall' ? 30 : 24;
      s.height = this.beat === 'nightfall' ? 8 : 5.5;
      this.pace = 0.3;
      this.focus.copy(c);
      return;
    }
    if (this.beat === 'home' || this.beat === 'inside') {
      const cot = this.cast.cottage.position;
      s.target.set(c.x * 0.35 + cot.x * 0.65, cot.y + 2.5, c.z * 0.35 + cot.z * 0.65);
      s.from = this.behind.set(SUMMIT.x - cot.x, 0, SUMMIT.y - cot.z).normalize();
      s.distance = this.beat === 'inside' ? 72 : 50;
      s.height = this.beat === 'inside' ? 40 : 24;
      this.pace = 0.2;
      if (this.beat === 'inside') {
        const lift = THREE.MathUtils.smootherstep(this.t, 7, 50);
        if (lift > 0) {
          s.eye = this.eyeAt.copy(s.target).addScaledVector(s.from, s.distance).setY(s.target.y + s.height + lift * 18);
          const toMoon = this.sky.copy(this.moon).setY(0).normalize();
          s.target.lerp(this.tmp.copy(s.eye).addScaledVector(toMoon, 100).setY(s.eye.y + 24), lift);
        }
        this.pace = 0.2 - lift * 0.12;
      }
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
