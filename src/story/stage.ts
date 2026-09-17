import * as THREE from 'three';
import type { Shot } from '../camera';
import { heightAt } from '../world/island';
import type { Cast, Chapter } from './cast';

export type StageView = 'game' | 'behind' | 'front' | 'side' | 'far-side' | 'close' | 'top' | 'k-front' | 'k-side' | 'k-back' | 'k-34' | 'k-above';

/** Camera placements in the child's frame: bearing from their facing, distance, height above the subject, and what to look at. */
const VIEWS: Record<StageView, { bearing: number; distance: number; height: number; on: 'both' | 'cygnet' }> = {
  game: { bearing: Math.PI, distance: 15, height: 5.2, on: 'both' },
  behind: { bearing: Math.PI, distance: 5.5, height: 1.4, on: 'both' },
  front: { bearing: 0, distance: 5.5, height: 1.0, on: 'both' },
  side: { bearing: Math.PI / 2, distance: 5.5, height: 0.9, on: 'both' },
  'far-side': { bearing: -Math.PI / 2, distance: 5.5, height: 0.9, on: 'both' },
  close: { bearing: 0.7, distance: 2.3, height: 0.5, on: 'cygnet' },
  /** Round the cygnet itself: bearings are from the way it is facing. */
  'k-front': { bearing: 0, distance: 1.5, height: 0.05, on: 'cygnet' },
  'k-side': { bearing: Math.PI / 2, distance: 1.5, height: 0.05, on: 'cygnet' },
  'k-back': { bearing: Math.PI, distance: 1.5, height: 0.2, on: 'cygnet' },
  'k-34': { bearing: 0.7, distance: 1.4, height: 0.3, on: 'cygnet' },
  'k-above': { bearing: 0.5, distance: 1.1, height: 1.2, on: 'cygnet' },
  top: { bearing: Math.PI, distance: 1.2, height: 6, on: 'both' },
};

/**
 * QA only (`?chapter=stage`): the child and the cygnet on open ground under the game's own light, with nothing else
 * going on, so that every pose, behaviour and shared moment can be played by name and looked at from close up.
 * `__game.story.current.play(name)` and `.look(view)` drive it from the capture tools.
 */
export class StageChapter implements Chapter {
  readonly shot: Shot = { target: new THREE.Vector3(), distance: 15, height: 5.2, from: new THREE.Vector3(0, 0, 1), free: true };
  readonly breeze = 0.3;
  readonly worldLife = 1;
  readonly pace = 8;
  readonly focus = new THREE.Vector3();
  readonly done = false;
  readonly haze = 0.2;
  readonly music = 'meadow' as const;
  readonly trodden = new THREE.Vector3();
  dusk = 0;
  view: StageView = 'behind';
  private readonly home = new THREE.Vector3();
  /** The views are laid out round the way the child faced when the view was chosen, so a turning child does not swing the camera. */
  private facing = 0;
  private readonly tmp = new THREE.Vector3();
  private offering = false;

  constructor(private readonly cast: Cast) {
    const { child, cygnet } = cast;
    this.home.copy(child.position);
    this.facing = child.yaw;
    child.standUp();
    cygnet.visible = true;
    cygnet.bond = 0.5;
    this.play('ground');
  }

  /** QA: how far each mitten is from the place on the cygnet it was sent to, in world units. */
  get contactError(): [number, number] {
    const { child: c, cygnet: k } = this.cast;
    const a = new THREE.Vector3();
    return [c.mitten(0, a).distanceTo(k.grip('bellyL', this.tmp)), c.mitten(1, a).distanceTo(k.grip('bellyR', this.tmp))];
  }

  look(view: StageView): void {
    this.view = view;
    this.facing = view.startsWith('k-') ? this.cast.cygnet.yaw : this.cast.child.yaw;
  }

  /** Everything the two of them can do, by name. Unknown names are reported rather than ignored. */
  play(name: string): boolean {
    const { child: c, cygnet: k, flock, carry } = this.cast;
    const ahead = (d: number, side = 0) =>
      this.tmp.set(c.position.x + Math.sin(c.yaw) * d + Math.cos(c.yaw) * side, 0, c.position.z + Math.cos(c.yaw) * d - Math.sin(c.yaw) * side);
    switch (name) {
      case 'ground': {
        const p = ahead(0.95, 0.1);
        k.position.set(p.x, Math.max(heightAt(p.x, p.z), 0), p.z);
        k.yaw = c.yaw + Math.PI;
        k.follow();
        return true;
      }
      case 'solo': {
        /** By itself, well clear of the child, side on to the sun, for looking at the model. */
        const p = ahead(2, 5);
        k.position.set(p.x, Math.max(heightAt(p.x, p.z), 0), p.z);
        k.yaw = c.yaw + Math.PI / 2;
        k.follow();
        k.debug.stand = true;
        k.watch(this.tmp.set(p.x + Math.sin(k.yaw) * 30, p.y + 0.5, p.z + Math.cos(k.yaw) * 30).clone());
        return true;
      }
      case 'kneel':
        c.faceToward(k.position.x, k.position.z, 1);
        c.kneeling = 1;
        return true;
      case 'rise':
        c.kneeling = 0;
        c.lean = 0;
        this.offering = false;
        c.reachFor(0, null);
        c.reachFor(1, null);
        return true;
      case 'offer':
        /** Both mittens under its belly, wherever it is and however it moves. */
        c.faceToward(k.position.x, k.position.z, 1);
        c.kneeling = 1;
        c.lean = 0.35;
        this.offering = true;
        return true;
      case 'gather':
        carry.gatherUp();
        return true;
      case 'stow':
        carry.stow();
        return true;
      case 'unstow':
        carry.unstow();
        return true;
      case 'arms':
        k.rideIn('cradle');
        return true;
      case 'satchel':
        k.rideIn('satchel');
        return true;
      case 'down':
        carry.setDown();
        return true;
      case 'try':
        k.tryToFly();
        return true;
      case 'cower':
        k.cower();
        return true;
      case 'call':
        k.call(false);
        return true;
      case 'long-call':
        k.call(true);
        return true;
      case 'fall': {
        const to = ahead(6, 2).clone();
        flock.pass(c.position.x, c.position.z, 40, c.yaw, 15, 20);
        k.plummet(this.tmp.set(to.x - 10, to.y + 40, to.z + 30), to, 8.5, c.yaw);
        return true;
      }
      case 'walk':
      case 'run': {
        const p = ahead(14);
        c.walkTo(p.x, p.z, name === 'run');
        return true;
      }
      case 'back':
        c.walkTo(this.home.x, this.home.z, false);
        return true;
      case 'sit':
        c.sitDown();
        return true;
      case 'stand':
        c.standUp();
        return true;
      case 'leave':
        k.leave(c.yaw);
        return true;
      default:
        console.warn(`stage: nothing called "${name}"`);
        return false;
    }
  }

  update(): void {
    const { child: c, cygnet: k } = this.cast;
    if (this.offering) {
      c.reachFor(0, k.grip('bellyL', this.tmp));
      c.reachFor(1, k.grip('bellyR', this.tmp));
    }
    const v = VIEWS[this.view];
    const s = this.shot;
    const at = k.eye(this.tmp);
    if (v.on === 'cygnet') s.target.copy(at);
    else s.target.set((c.position.x + at.x) / 2, (c.position.y + 1.2 + at.y) / 2, (c.position.z + at.z) / 2);
    const bearing = this.facing + v.bearing;
    s.eye = (s.eye ?? new THREE.Vector3()).set(s.target.x + Math.sin(bearing) * v.distance, s.target.y + v.height, s.target.z + Math.cos(bearing) * v.distance);
    this.focus.copy(c.position);
    this.trodden.set(c.position.x, 7, c.position.z);
  }
}
