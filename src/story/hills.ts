import * as THREE from 'three';
import type { Shot } from '../camera';
import { mainlandCoastZ } from '../world/heightfield';
import { heightAt } from '../world/island';
import type { Cast, Chapter } from './cast';
import { LANDING } from './crossing';
import { cue } from './cues';

type Beat = 'ashore' | 'waiting' | 'wave' | 'walk' | 'summit' | 'unfold' | 'gaze' | 'fold' | 'release' | 'nightfall' | 'home' | 'inside';
type Play = 'carry' | 'watch' | 'fetch' | 'hold';

/** The way inland, over the hills to the last one. */
export const ROUTE = [
  new THREE.Vector2(6, -760),
  new THREE.Vector2(-8, -860),
  new THREE.Vector2(-30, -960),
  new THREE.Vector2(6, -1080),
  new THREE.Vector2(38, -1200),
  new THREE.Vector2(24, -1340),
  new THREE.Vector2(20, -1505),
  new THREE.Vector2(-3, -1547),
];
/** Just over the crest of the last hill, where the ground falls away and the cottage comes into view. */
const SUMMIT = ROUTE[ROUTE.length - 1];
/** From the summit the sun sets over the cottage, to the north-west. */
const TOWARD_SUNSET = new THREE.Vector2(-Math.sin(THREE.MathUtils.degToRad(32)), -Math.cos(THREE.MathUtils.degToRad(32)));

const WAVE_SPEED = 85;
const WAVE_REACH = 3600;

/**
 * The hills. The child steps ashore onto grey pasture; the player's first gust inland sends a wave of green
 * rolling to the horizon. The long walk inland follows the plane, waypoint by waypoint, while the sun sinks. On the
 * last hill the child unfolds the plane: a crayon drawing of these hills and the cottage below. Then the plane is
 * let go into the sunset, night falls, and the child walks down to the lit window.
 */
export class HillsChapter implements Chapter {
  beat: Beat = 'ashore';
  readonly breeze = 1;
  readonly worldLife = 1;
  pace = 0.35;
  dusk = 0;
  readonly shot: Shot = { target: new THREE.Vector3(), distance: 40, height: 12 };
  readonly focus = new THREE.Vector3();
  private play: Play = 'carry';
  private leg = 0;
  private beatStart = 0;
  private waveStart = 0;
  private holdUntil = 0;
  private duskTarget = 0;
  private now = 0;
  private readonly hand = new THREE.Vector3();
  private readonly tmp = new THREE.Vector3();
  private readonly held = new THREE.Vector3();
  private readonly behind = new THREE.Vector3();
  private readonly back = new THREE.Vector3();
  private readonly sky = new THREE.Vector3();
  private readonly horizon = new THREE.Vector3(20, 40, -1600);
  private readonly fwd = new THREE.Vector3();
  private readonly eyeAt = new THREE.Vector3();

  constructor(private readonly cast: Cast) {
    const { child, plane } = cast;
    plane.homeRadius = 70;
    child.dismount();
    const up = mainlandCoastZ(LANDING.x) - 14;
    child.walkTo(LANDING.x - 2, up, false, () => this.to('waiting'), 0.8);
  }

  get done(): boolean {
    return false;
  }

  /** For testing the ending: the green wave has already rolled out and the child is near the top, plane in hand. */
  skipToSummit(): void {
    const { child, plane, life } = this.cast;
    life.regions.wave.set(LANDING.x, LANDING.y, WAVE_REACH, 90);
    this.waveStart = -1e3;
    this.leg = ROUTE.length - 1;
    child.stop();
    child.place(SUMMIT.x + 6, SUMMIT.y + 34, Math.PI);
    child.standUp();
    plane.hold(child.handPosition(this.hand), child.yaw);
    this.play = 'hold';
    this.duskTarget = this.dusk = 0.85;
    this.to('walk');
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
    const { child: c, plane: p, life, input } = this.cast;
    if (!p.departing) p.home.set(c.position.x, 0, c.position.z - 25);

    switch (this.beat) {
      case 'ashore':
        break;
      case 'waiting': {
        c.lookAt = this.horizon;
        const overLand = heightAt(input.world.x, input.world.z) > 1;
        if ((input.gust > 5 && overLand && input.present) || this.t > 9) this.startWave();
        break;
      }
      case 'wave':
        if (this.t > 5 && !c.busy) this.walkOn();
        break;
      case 'walk':
        this.updateWalk(time);
        break;
      default:
        this.updateEnding(dt);
    }

    const progress = THREE.MathUtils.clamp((c.position.z - LANDING.y) / (SUMMIT.y - LANDING.y), 0, 1);
    this.duskTarget = Math.max(this.duskTarget, progress * progress * 0.92);
    this.dusk += (this.duskTarget - this.dusk) * (1 - Math.exp(-dt * 0.22));
    const wave = life.regions.wave;
    if (wave.z >= 0) wave.z = Math.min(WAVE_REACH, wave.z + dt * WAVE_SPEED * Math.min(1, 0.3 + (this.now - this.waveStart) * 0.25));

    if (p.held) p.hold(c.handPosition(this.hand), c.yaw);
    this.frame();
  }

  private startWave(): void {
    const { child: c, life } = this.cast;
    this.to('wave');
    this.waveStart = this.now;
    life.regions.wave.set(c.position.x, c.position.z, 0, 90);
    c.cheer();
    cue('wave');
  }

  private walkOn(): void {
    this.to('walk');
    this.play = 'carry';
    this.throwAhead();
  }

  private target(): THREE.Vector2 {
    return ROUTE[Math.min(this.leg, ROUTE.length - 1)];
  }

  private updateWalk(time: number): void {
    const { child: c, plane: p } = this.cast;
    const t = this.target();
    if (Math.hypot(c.position.x - t.x, c.position.z - t.y) < 30 && this.leg < ROUTE.length - 1) this.leg++;
    const nearSummit = this.leg === ROUTE.length - 1 && Math.hypot(c.position.x - SUMMIT.x, c.position.z - SUMMIT.y) < 40;

    if (this.play === 'watch') {
      c.lookAt = p.position;
      if (p.landed) this.fetch();
      else if (!c.moving && Math.hypot(p.position.x - c.position.x, p.position.z - c.position.z) > 22) {
        c.walkTo(p.position.x, p.position.z, false, undefined, 12);
      }
    } else if (this.play === 'fetch') {
      c.lookAt = p.position;
      if (!p.landed && p.airborne) this.play = 'watch';
    } else if (this.play === 'hold' && !c.busy) {
      if (nearSummit) this.climbSummit();
      else if (time > this.holdUntil) this.throwAhead();
    }
  }

  private throwAhead(): void {
    const c = this.cast.child;
    const t = this.target();
    const angle = Math.atan2(t.x - c.position.x, t.y - c.position.z) + (Math.random() - 0.5) * 0.5;
    c.throwToward(c.position.x + Math.sin(angle) * 20, c.position.z + Math.cos(angle) * 20, () => {
      this.cast.plane.launch(c.handPosition(this.hand), this.tmp.set(Math.sin(angle) * 8.5, 5.2, Math.cos(angle) * 8.5));
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
        p.hold(c.handPosition(this.hand), c.yaw);
        this.play = 'hold';
        this.holdUntil = this.now + 1.2 + Math.random() * 1.2;
      });
    }, 1.2);
  }

  private climbSummit(): void {
    const c = this.cast.child;
    this.to('summit');
    c.lookAt = null;
    c.walkTo(SUMMIT.x, SUMMIT.y, false, () => {
      c.faceToward(SUMMIT.x + TOWARD_SUNSET.x, SUMMIT.y + TOWARD_SUNSET.y, 1);
      c.sitDown();
      this.beatStart = this.now;
      this.duskTarget = Math.max(this.duskTarget, 1);
    }, 0.8);
  }

  private forward(): THREE.Vector3 {
    const yaw = this.cast.child.yaw;
    return this.fwd.set(Math.sin(yaw), 0, Math.cos(yaw));
  }

  /** Summit, the drawing, the farewell to the plane, nightfall and home. */
  private updateEnding(dt: number): void {
    const { child: c, plane: p, drawing, cottage } = this.cast;
    const faceX = c.position.x + TOWARD_SUNSET.x * 10;
    const faceZ = c.position.z + TOWARD_SUNSET.y * 10;
    this.sky.set(c.position.x + TOWARD_SUNSET.x * 60, c.position.y + 22, c.position.z + TOWARD_SUNSET.y * 60);

    if (this.beat === 'summit') {
      c.lookAt = this.sky;
      if (c.sitting && this.t > 3.5) {
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
    drawing.place(at, this.back.copy(at).addScaledVector(this.forward(), -6), this.now);
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
      this.focus.copy(c);
      return;
    }
    const pw = this.cast.plane.held ? 0 : 0.25;
    const fx = c.x * (1 - pw) + p.x * pw;
    const fz = c.z * (1 - pw) + p.z * pw - 5;
    const ground = Math.max(heightAt(fx, fz), 0);
    s.target.set(fx, ground + 3 + Math.max(0, p.y - ground - 12) * 0.35, fz);
    s.distance = this.beat === 'wave' ? 70 : 44;
    s.height = this.beat === 'wave' ? 26 : 13;
    this.pace = 0.35;
    this.focus.set(fx, ground, fz);
  }
}
