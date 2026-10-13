import * as THREE from 'three';
import type { Shot } from '../camera';
import type { Cast } from './cast';
import { meadowEchoes as garden } from '../world/meadow-echoes';
import { tuning } from '../tuning';

type Beat = 'ahead' | 'approach' | 'touch' | 'carry' | 'follow' | 'listen' | 'done';

export class MeadowSong {
  beat: Beat = 'ahead';
  private since = 0;
  private now = 0;
  private index = 0;
  private mix = 0;
  leaving = false;
  private readonly hand = new THREE.Vector3();
  private readonly childAt = new THREE.Vector3();
  private readonly center = new THREE.Vector3();
  private readonly side = new THREE.Vector3(0.15, 0, 1).normalize();
  private readonly exitEye = new THREE.Vector3();
  private readonly exitLook = new THREE.Vector3();
  private readonly exitAt = new THREE.Vector3();
  private readonly frameSubjects = { primary: this.childAt, secondary: this.center, primaryRadius: 1.8,
    points: [garden.seed, garden.flowers[0].mouth, garden.flowers[1].mouth,
      garden.flowers[0].crown, garden.flowers[1].crown], margin: 0.83, extra: 20 };

  get active(): boolean { return this.beat !== 'ahead' && this.beat !== 'done'; }
  get hush(): number { return this.mix; }
  get hearsFamily(): boolean { return this.beat === 'listen' && this.now - this.since > tuning.meadowEchoes.familyAfter; }
  get invitation(): THREE.Vector3 | null {
    return this.beat === 'carry' && this.now - this.since > tuning.meadowEchoes.inviteAfter ? garden.seed : null;
  }
  get goal(): THREE.Vector3 | null { return this.beat === 'done' ? null : garden.flowers[this.index].stand; }

  restore(completed: number, finished = completed >= 2): void {
    garden.reset(completed);
    this.index = Math.max(0, Math.min(2, completed));
    this.mix = this.since = this.now = 0;
    this.leaving = false;
    this.beat = finished ? 'done' : 'ahead';
  }

  hold(dt: number, time: number, cast: Cast): boolean {
    this.now = time;
    const { child, plane, cygnet } = cast;
    this.mix += ((this.active ? tuning.meadowEchoes.musicDuck : 0) - this.mix) * (1 - Math.exp(-dt * 1.2));
    const flower = garden.flowers[this.index];
    garden.enabled = this.active;
    if (this.beat === 'done') return false;
    if (this.beat === 'ahead') {
      if (Math.hypot(child.position.x - flower.stand.x, child.position.z - flower.stand.z) > tuning.meadowEchoes.approach) return false;
      child.stop(); plane.hold(child); child.stowPlane(true);
      this.to('approach');
      this.walk(cast);
    }
    child.lookAt = this.hearsFamily ? cast.flock.head : this.beat === 'carry' ? garden.seed : flower.mouth;
    if (this.hearsFamily) child.faceToward(cast.flock.head.x, cast.flock.head.z, 1 - Math.exp(-dt * 1.2));
    cygnet.watch(child.lookAt);
    if (this.beat === 'approach' || this.beat === 'follow') {
      if (!child.moving && !child.acting) {
        if (Math.hypot(child.position.x - flower.stand.x, child.position.z - flower.stand.z) < 1) {
          this.to(this.index === 2 ? 'listen' : 'touch');
        } else this.walk(cast);
      }
    } else if (this.beat === 'touch') {
      child.faceToward(flower.mouth.x, flower.mouth.z, Math.min(1, dt * 2));
      const t = (time - this.since) / tuning.meadowEchoes.touchFor;
      const reach = THREE.MathUtils.smootherstep(t, 0, 0.3) * (1 - THREE.MathUtils.smootherstep(t, 0.65, 1));
      garden.bow(this.index, reach);
      this.hand.copy(flower.contact);
      child.reachFor(1, t > 0.1 && t < 0.72 ? this.hand : null);
      if (time - this.since > tuning.meadowEchoes.touchFor) {
        child.reachFor(1, null);
        garden.bow(this.index, 0);
        garden.release(time);
        this.to('carry');
      }
    } else if (this.beat === 'carry') {
      if (garden.seeds.completed > this.index && time - garden.receivedAt > tuning.meadowEchoes.arrivalRest) {
        this.index = garden.seeds.completed;
        this.to('follow'); this.walk(cast);
      }
    } else if (this.beat === 'listen' && time - this.since > tuning.meadowEchoes.listenFor) {
      this.to('done'); garden.enabled = false;
      this.leaving = true;
      cygnet.watch(null); child.lookAt = null;
      child.stowPlane(false); plane.hold(child);
      return false;
    }
    return true;
  }

  private walk(cast: Cast): void {
    const f = garden.flowers[this.index];
    cast.child.walkTo(f.stand.x, f.stand.z, false, undefined, 0.12);
  }

  private to(beat: Beat): void { this.beat = beat; this.since = this.now; }

  frame(shot: Shot, cast: Cast): boolean {
    if (!this.active) return false;
    const c = cast.child.position;
    const first = garden.flowers[this.index].mouth;
    const second = garden.flowers[Math.min(2, this.index + 1)].mouth;
    this.childAt.copy(c).y += 1.4;
    const portrait = typeof window !== 'undefined' && window.innerWidth < window.innerHeight;
    this.side.set(portrait ? -0.25 : 0.4 + this.index * 0.2, 0, 1).normalize();
    this.center.lerpVectors(first, second, this.beat === 'carry' ? 0.5 : 0.2);
    shot.target.copy(this.childAt).lerp(this.center, 0.45);
    shot.from = this.side;
    shot.distance = portrait ? tuning.meadowEchoes.cameraPortraitBack : tuning.meadowEchoes.cameraBack;
    shot.height = portrait ? tuning.meadowEchoes.cameraPortraitUp
      : tuning.meadowEchoes.cameraUp + Math.max(0, 1.5 - this.index);
    shot.eye = undefined;
    shot.attention = undefined;
    shot.composition = 'hold';
    shot.carry = true; shot.carryAnchor = c;
    shot.clearance = 3.5;
    shot.smoothFit = 2;
    this.frameSubjects.points[1] = first;
    this.frameSubjects.points[2] = second;
    this.frameSubjects.points[3] = garden.flowers[this.index].crown;
    this.frameSubjects.points[4] = garden.flowers[Math.min(2, this.index + 1)].crown;
    shot.subjects = this.frameSubjects;
    if (this.beat === 'listen') {
      this.exitLook.copy(shot.target).sub(c);
      this.exitEye.copy(this.exitLook).addScaledVector(this.side, shot.distance).y += shot.height;
    }
    return true;
  }

  depart(shot: Shot, cast: Cast): number {
    const c = cast.child.position, stand = garden.flowers[2].stand;
    const walked = THREE.MathUtils.smootherstep(Math.hypot(c.x - stand.x, c.z - stand.z), 0, tuning.meadowEchoes.departureWalk);
    shot.target.lerp(this.exitAt.copy(c).add(this.exitLook), 1 - walked);
    shot.eye!.lerp(this.exitAt.copy(c).add(this.exitEye), 1 - walked);
    shot.composition = 'hold';
    shot.smoothFit = 2;
    return THREE.MathUtils.lerp(tuning.meadowEchoes.cameraPace, 0.9, walked);
  }
}
