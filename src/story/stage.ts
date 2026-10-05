import * as THREE from 'three';
import type { Shot } from '../camera';
import { heightAt } from '../world/island';
import type { Act } from '../creatures/cygnet/mind';
import type { Cast, Chapter } from './cast';
import { CatYard } from './cat-yard';
import { CrossingsYard } from './crossings-yard';

export type StageView = 'game' | 'flock' | 'behind' | 'front' | 'side' | 'far-side' | 'close' | 'top' | 'k-front' | 'k-side' | 'k-back' | 'k-34' | 'k-above' | 'k-full' | 'k-low'
  | 'c-close' | 'c-face' | 'c-side' | 'c-back' | 'c-front' | 'c-34' | 'c-profile' | 'c-head' | 'c-near' | 'c-far' | 'c-along' | 'c-across';

/** Camera placements in the child's frame: bearing from their facing, distance, height above the subject, and what to look at. */
const VIEWS: Record<StageView, { bearing: number; distance: number; height: number; on: 'both' | 'cygnet' | 'cat' }> = {
  game: { bearing: Math.PI, distance: 15, height: 5.2, on: 'both' },
  /** Standing where the child stands and watching the swans, wherever in the sky or on the water they are. */
  flock: { bearing: Math.PI, distance: 26, height: 7, on: 'both' },
  behind: { bearing: Math.PI, distance: 5.5, height: 1.4, on: 'both' },
  front: { bearing: 0, distance: 5.5, height: 1.0, on: 'both' },
  side: { bearing: Math.PI / 2, distance: 5.5, height: 0.9, on: 'both' },
  'far-side': { bearing: -Math.PI / 2, distance: 5.5, height: 0.9, on: 'both' },
  close: { bearing: 0.7, distance: 2.3, height: 0.5, on: 'cygnet' },
  /** Round the cygnet itself: bearings are from the way it is facing. */
  'k-front': { bearing: 0, distance: 1.5, height: 0.05, on: 'cygnet' },
  'k-side': { bearing: Math.PI / 2, distance: 1.5, height: 0.05, on: 'cygnet' },
  'k-back': { bearing: Math.PI, distance: 1.7, height: -0.05, on: 'cygnet' },
  'k-34': { bearing: 0.7, distance: 1.4, height: 0.3, on: 'cygnet' },
  'k-above': { bearing: 0.5, distance: 1.1, height: 1.2, on: 'cygnet' },
  /** The whole bird in frame, and from under its own eye line, which is the only way to see its feet. */
  'k-full': { bearing: 0.8, distance: 1.9, height: -0.12, on: 'cygnet' },
  'k-low': { bearing: 1.1, distance: 1.5, height: -0.4, on: 'cygnet' },
  top: { bearing: Math.PI, distance: 1.2, height: 6, on: 'both' },
  /** Round the cat, from the way it faced when the view was chosen. */
  'c-close': { bearing: 0.8, distance: 1.2, height: 0.2, on: 'cat' },
  'c-face': { bearing: 0.15, distance: 1.25, height: 0.1, on: 'cat' },
  'c-side': { bearing: Math.PI / 2, distance: 1.6, height: 0.45, on: 'cat' },
  'c-back': { bearing: Math.PI - 0.5, distance: 1.4, height: 0.4, on: 'cat' },
  /** The model sheet's own views, a metre off: front, three-quarter from its left, its left side, and the head. */
  'c-front': { bearing: 0, distance: 1, height: 0.08, on: 'cat' },
  'c-34': { bearing: 0.65, distance: 1, height: 0.1, on: 'cat' },
  'c-profile': { bearing: Math.PI / 2, distance: 1, height: 0.06, on: 'cat' },
  'c-head': { bearing: 0.1, distance: 0.55, height: 0.12, on: 'cat' },
  /** Game distances, from the cat yard's own bearings so that a cat on the move stays framed the same. */
  'c-near': { bearing: 2.5, distance: 4, height: 1.8, on: 'cat' },
  'c-far': { bearing: 2.4, distance: 12, height: 4.6, on: 'cat' },
  /** Side on to the yard's long way, and looking along it: for judging a jump or a run as it goes by. */
  'c-along': { bearing: Math.PI / 2, distance: 3.2, height: 0.7, on: 'cat' },
  'c-across': { bearing: Math.PI + 0.3, distance: 3.2, height: 0.9, on: 'cat' },
};

/**
 * QA only (`?chapter=stage`): the child and the cygnet on open ground under the game's own light, with nothing else
 * going on, so that every pose, behaviour and shared moment can be played by name and looked at from close up.
 * `__game.story.current.play(name)` and `.look(view)` drive it from the capture tools; `play('cat:<action>')` sets
 * out the drowned village's cat in a yard of its own on the sea beyond the beach, and the `c-` views look at it.
 * `play('crossing:tree' | 'crossing:swing' | 'crossing:run')` (or `&gap=tree|swing|run`) sets out the village's two
 * crossings on the sea and plays them as the room would, with the lens its own.
 */
export class StageChapter implements Chapter {
  readonly shot: Shot = { target: new THREE.Vector3(), distance: 15, height: 5.2, from: new THREE.Vector3(0, 0, 1), free: true };
  breeze = 0.3;
  readonly worldLife = 1;
  pace = 8;
  readonly focus = new THREE.Vector3();
  readonly done = false;
  haze = 0.2;
  readonly music = 'meadow' as const;
  readonly trodden = new THREE.Vector3();
  dusk = 0;
  /** Bumped to put the camera straight onto a cat view, so a capture never waits on the camera gliding there. */
  cameraCut = 0;
  view: StageView = 'behind';
  private readonly home = new THREE.Vector3();
  /** The views are laid out round the way the child faced when the view was chosen, so a turning child does not swing the camera. */
  private facing = 0;
  private readonly tmp = new THREE.Vector3();
  private offering = false;
  /** While set, it swims after a point that paces up and down just off the beach. */
  private swimming = false;
  private readonly swimAt = new THREE.Vector3();
  private clock = 0;
  /** QA stand-ins for the drowned village's places, set out on the sea the first time the cat is played. */
  private yard: CatYard | null = null;
  /** QA stand-ins for the drowned village's run over the roofs: the two crossings, set out on the sea when first played. */
  private crossings: CrossingsYard | null = null;
  private camera: THREE.PerspectiveCamera | null = null;

  constructor(private readonly cast: Cast) {
    const { child, cygnet } = cast;
    this.home.copy(child.position);
    this.facing = child.yaw;
    child.standUp();
    cygnet.visible = true;
    cygnet.bond = 0.5;
    this.play('ground');
    const gap = new URLSearchParams(location.search).get('gap');
    if (gap) this.play(`crossing:${gap}`);
  }

  get windInvitation(): THREE.Vector3 | null {
    return this.crossings?.playing ? this.crossings.invitation : null;
  }

  get invitationHeading(): number | null {
    return this.crossings?.playing ? this.crossings.heading : null;
  }

  get invitationRadius(): number {
    return this.crossings?.playing ? this.crossings.invitationRadius : 0;
  }

  afterCamera(camera: THREE.PerspectiveCamera): void {
    this.camera = camera;
  }

  /** QA: how far each mitten is from the place on the cygnet it was sent to, in world units. */
  get contactError(): [number, number] {
    const { child: c, cygnet: k } = this.cast;
    const a = new THREE.Vector3();
    return [c.mitten(0, a).distanceTo(k.grip('bellyL', this.tmp)), c.mitten(1, a).distanceTo(k.grip('bellyR', this.tmp))];
  }

  look(view: StageView): void {
    this.view = view;
    if (view.startsWith('c-')) this.cameraCut++;
    if (view === 'c-near' || view === 'c-far' || view === 'c-along' || view === 'c-across') this.facing = this.yard?.yaw ?? this.cast.child.yaw;
    else if (view.startsWith('c-')) this.facing = this.cast.cat.yaw;
    else this.facing = view.startsWith('k-') ? this.cast.cygnet.yaw : this.cast.child.yaw;
  }

  /** Everything the two of them can do, by name. Unknown names are reported rather than ignored. */
  play(name: string): boolean {
    const { child: c, cygnet: k, flock, carry } = this.cast;
    const ahead = (d: number, side = 0) =>
      this.tmp.set(c.position.x + Math.sin(c.yaw) * d + Math.cos(c.yaw) * side, 0, c.position.z + Math.cos(c.yaw) * d - Math.sin(c.yaw) * side);
    if (name.startsWith('crossing:')) {
      /** The drowned village's crossings, each from its own start: `crossing:tree`, `crossing:swing`, `crossing:run`. */
      if (!this.crossings) {
        this.crossings = new CrossingsYard(this.cast, c.position);
        this.cast.cat.objects[0].parent?.add(...this.crossings.objects);
      }
      const played = this.crossings.play(name.slice(9));
      this.pace = this.crossings.frame(this.shot);
      this.cameraCut++;
      if (!played) console.warn(`stage: no crossing called "${name.slice(9)}"`);
      return played;
    }
    this.crossings?.stop();
    if (name.startsWith('cat:')) {
      /** The cat's actions, each from its own place in the yard: `cat:strand`, `cat:run`, `cat:climb`. */
      if (!this.yard) {
        this.yard = new CatYard(c.position);
        this.cast.cat.objects[0].parent?.add(this.yard.group);
      }
      const played = this.yard.play(name.slice(4), this.cast.cat);
      this.cameraCut++;
      if (!played) console.warn(`stage: the cat has nothing called "${name.slice(4)}"`);
      return played;
    }
    if (name.startsWith('act:')) {
      /** Anything it does of its own accord, by name and on demand: `act:preen-wing`, `act:bowled`. */
      k.mind.perform(name.slice(4) as Act, Number.NaN);
      return true;
    }
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
      case 'shore': {
        /** Down to the water's edge, the child facing the sea, for anything to do with swimming. */
        let z = c.position.z;
        while (heightAt(c.position.x, z) > 0.35 && z < c.position.z + 60) z += 0.5;
        c.place(c.position.x, z - 1.5, 0);
        this.facing = c.yaw;
        this.play('ground');
        return true;
      }
      case 'swim':
        this.swimming = true;
        return true;
      case 'ashore':
        this.swimming = false;
        k.follow();
        return true;
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
      case 'skein': {
        flock.pass(c.position.x, c.position.z, 40, c.yaw, 15, 90);
        c.lookAt = flock.head;
        return true;
      }
      case 'circle': {
        const p = ahead(46);
        flock.circle(p.x, p.z, Math.max(heightAt(p.x, p.z), 0) + 15, 16, 20, 6);
        return true;
      }
      case 'afloat': {
        /** The stage stands just inside the meadow's south beach; this is the open water beyond it, short of the lines. */
        flock.rest(c.position.x + 6, c.position.z + 105, 15, 14);
        return true;
      }
      case 'lift':
        flock.lift(Math.PI);
        return true;
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

  update(dt: number): void {
    const { child: c, cygnet: k } = this.cast;
    this.clock += dt;
    this.yard?.update(dt);
    if (this.crossings?.playing) {
      this.crossings.update(dt, this.camera);
      this.pace = this.crossings.frame(this.shot);
      this.dusk = 0.82;
      this.haze = 0.6;
      this.breeze = 0.04;
      this.focus.copy(c.position);
      return;
    }
    this.shot.free = true;
    this.pace = 8;
    this.haze = 0.2;
    this.breeze = 0.3;
    if (this.swimming) {
      let z = c.position.z;
      while (heightAt(c.position.x, z) > -0.4 && z < c.position.z + 40) z += 0.5;
      k.swimTo(this.swimAt.set(c.position.x + Math.sin(this.clock * 0.35) * 6, 0, z + 2.5));
    }
    if (this.offering) {
      c.reachFor(0, k.grip('bellyL', this.tmp));
      c.reachFor(1, k.grip('bellyR', this.tmp));
    }
    const v = VIEWS[this.view];
    const s = this.shot;
    const at = v.on === 'cat' ? this.tmp.copy(this.cast.cat.position).setY(this.cast.cat.position.y + 0.16) : k.eye(this.tmp);
    if (v.on === 'cygnet' || v.on === 'cat') s.target.copy(at);
    else s.target.set((c.position.x + at.x) / 2, (c.position.y + 1.2 + at.y) / 2, (c.position.z + at.z) / 2);
    const bearing = this.facing + v.bearing;
    s.eye = (s.eye ?? new THREE.Vector3()).set(s.target.x + Math.sin(bearing) * v.distance, s.target.y + v.height, s.target.z + Math.cos(bearing) * v.distance);
    if (this.view === 'flock' && this.cast.flock.active) {
      /** Stood off the flock itself, on the line the child sees it along, so whatever it is doing fills the frame. */
      s.target.copy(this.cast.flock.head);
      const away = this.tmp.set(s.target.x - c.position.x, 0, s.target.z - c.position.z).normalize();
      s.eye.set(s.target.x - away.x * v.distance, s.target.y + v.height, s.target.z - away.z * v.distance);
    }
    this.focus.copy(c.position);
    this.trodden.set(c.position.x, 7, c.position.z);
  }
}
