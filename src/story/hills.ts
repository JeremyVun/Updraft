import * as THREE from 'three';
import type { Shot } from '../camera';
import { heightAt } from '../world/island';
import { mainlandCoastZ } from '../world/heightfield';
import type { Cast, Chapter } from './cast';
import { LANDING } from './crossing';

type Beat = 'ashore' | 'waiting' | 'wave' | 'walk';
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
];

const WAVE_SPEED = 85;
const WAVE_REACH = 3600;

/**
 * The hills. The child steps ashore onto grey pasture; the player's first gust inland sends a wave of green
 * rolling to the horizon. Then the long walk inland: the child throws the plane ahead, the player carries it,
 * the child follows, waypoint by waypoint, to the last hill.
 */
export class HillsChapter implements Chapter {
  beat: Beat = 'ashore';
  readonly breeze = 1;
  readonly worldLife = 1;
  pace = 0.35;
  readonly shot: Shot = { target: new THREE.Vector3(), distance: 40, height: 12 };
  readonly focus = new THREE.Vector3();
  private play: Play = 'carry';
  private leg = 0;
  private beatStart = 0;
  private waveStart = 0;
  private holdUntil = 0;
  private now = 0;
  private readonly hand = new THREE.Vector3();
  private readonly tmp = new THREE.Vector3();
  private readonly horizon = new THREE.Vector3(20, 40, -1600);

  constructor(private readonly cast: Cast) {
    const { child, plane } = cast;
    plane.homeRadius = 70;
    child.dismount();
    const up = mainlandCoastZ(LANDING.x) - 14;
    child.walkTo(LANDING.x - 2, up, false, () => {
      this.beat = 'waiting';
      this.beatStart = this.now;
      child.lookAt = this.horizon;
    }, 0.8);
  }

  get done(): boolean {
    return false;
  }

  update(dt: number, time: number): void {
    this.now = time;
    const { child: c, plane: p, life, input } = this.cast;
    p.home.set(c.position.x, 0, c.position.z - 25);

    if (this.beat === 'waiting') {
      const overLand = heightAt(input.world.x, input.world.z) > 1;
      if ((input.gust > 5 && overLand && input.present) || this.now - this.beatStart > 9) this.startWave();
    } else if (this.beat === 'wave') {
      if (this.now - this.beatStart > 5 && !c.busy) this.walkOn();
    } else if (this.beat === 'walk') {
      this.updateWalk(time);
    }

    const wave = life.regions.wave;
    if (wave.z >= 0) wave.z = Math.min(WAVE_REACH, wave.z + dt * WAVE_SPEED * Math.min(1, 0.3 + (this.now - this.waveStart) * 0.25));

    if (p.held) p.hold(c.handPosition(this.hand), c.yaw);
    this.frame();
  }

  private startWave(): void {
    const { child: c, life } = this.cast;
    this.beat = 'wave';
    this.beatStart = this.now;
    this.waveStart = this.now;
    life.regions.wave.set(c.position.x, c.position.z, 0, 90);
    c.cheer();
  }

  private walkOn(): void {
    this.beat = 'walk';
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

    if (this.play === 'watch') {
      c.lookAt = p.position;
      if (p.landed) this.fetch();
      else if (!c.moving && Math.hypot(p.position.x - c.position.x, p.position.z - c.position.z) > 22) {
        c.walkTo(p.position.x, p.position.z, false, undefined, 12);
      }
    } else if (this.play === 'fetch') {
      c.lookAt = p.position;
      if (!p.landed && p.airborne) this.play = 'watch';
    } else if (this.play === 'hold' && time > this.holdUntil && !c.busy) {
      this.throwAhead();
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

  private frame(): void {
    const c = this.cast.child.position;
    const p = this.cast.plane.position;
    const s = this.shot;
    const pw = this.cast.plane.held ? 0 : 0.25;
    const fx = c.x * (1 - pw) + p.x * pw;
    const fz = c.z * (1 - pw) + p.z * pw - 5;
    const ground = Math.max(heightAt(fx, fz), 0);
    s.target.set(fx, ground + 3 + Math.max(0, p.y - ground - 12) * 0.35, fz);
    s.distance = this.beat === 'wave' ? 70 : 44;
    s.height = this.beat === 'wave' ? 26 : 13;
    this.focus.set(fx, ground, fz);
  }
}
