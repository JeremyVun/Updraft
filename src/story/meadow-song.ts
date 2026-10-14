import * as THREE from 'three';
import type { Shot } from '../camera';
import type { Cast } from './cast';
import { meadowEchoes as garden } from '../world/meadow-echoes';
import { tuning } from '../tuning';

type Beat = 'ahead' | 'approach' | 'settle' | 'play' | 'follow' | 'listen' | 'gather' | 'done';

export class MeadowSong {
  beat: Beat = 'ahead';
  private since = 0;
  private now = 0;
  private index = 0;
  private mix = 0;
  private tending = false;
  private lastCuriosity = 0;
  leaving = false;
  private readonly childAt = new THREE.Vector3();
  private readonly center = new THREE.Vector3();
  private readonly side = new THREE.Vector3();
  private readonly curiosity = new THREE.Vector3();
  private readonly exitEye = new THREE.Vector3();
  private readonly exitLook = new THREE.Vector3();
  private readonly exitAt = new THREE.Vector3();
  private readonly frameSubjects = { primary: this.childAt, secondary: this.center, primaryRadius: 1.8,
    points: Array.from({ length: 5 }, () => new THREE.Vector3()), margin: .8, extra: 8 };

  get active(): boolean { return this.beat !== 'ahead' && this.beat !== 'done'; }
  get hush(): number { return this.mix; }
  get hearsFamily(): boolean { return (this.beat === 'listen' && this.now - this.since > tuning.meadowEchoes.familyAfter) || this.beat === 'gather'; }
  get invitation(): THREE.Vector3 | null {
    return this.beat === 'play' && garden.seeds.active && this.now - this.since > tuning.meadowEchoes.inviteAfter ? garden.invitation : null;
  }
  get goal(): THREE.Vector3 | null { return this.beat === 'done' ? null : garden.stands[this.index]; }

  restore(completed: number, finished = completed >= 2): void {
    garden.reset(completed);
    this.index = Math.max(0, Math.min(2, completed));
    this.mix = this.since = this.now = 0;
    this.leaving = this.tending = false;
    this.beat = finished ? 'done' : 'ahead';
  }

  hold(dt: number, time: number, cast: Cast): boolean {
    this.now = time;
    const { child, plane, cygnet, carry } = cast;
    this.mix += ((this.active ? tuning.meadowEchoes.musicDuck : 0) - this.mix) * (1 - Math.exp(-dt * 1.2));
    garden.enabled = this.beat === 'play';
    if (this.beat === 'done') return false;
    const stand = garden.stands[this.index], patch = garden.patches[Math.min(1, this.index)];
    if (this.beat === 'ahead') {
      if (Math.hypot(child.position.x - stand.x, child.position.z - stand.z) > tuning.meadowEchoes.approach || carry.busy) return false;
      child.stop(); plane.hold(child); child.stowPlane(true); plane.visible = false;
      this.to('approach'); this.walk(cast);
    }
    cygnet.mayFly = false;
    if (!carry.busy) {
      child.lookAt = this.hearsFamily ? cast.flock.head : this.beat === 'play' && this.index === 1 ? garden.seed : patch;
      cygnet.watch(child.lookAt);
    }
    if (this.beat === 'approach' || this.beat === 'follow') {
      cygnet.errand = null; cygnet.stay = false; cygnet.pace = 1;
      if (!child.moving && !child.acting) {
        if (Math.hypot(child.position.x - stand.x, child.position.z - stand.z) < 1) this.to(this.index === 2 ? 'listen' : 'settle');
        else this.walk(cast);
      }
    } else if (this.beat === 'settle') {
      child.faceToward(patch.x, patch.z, 1 - Math.exp(-dt * 2));
      if (carry.busy) return true;
      if (cygnet.seat === 'satchel' && !this.tending) {
        this.tending = true;
        carry.unstow(() => carry.setDown(() => {
          this.tending = false; cygnet.stay = false;
          this.curiosity.copy(child.position).add(new THREE.Vector3(2.2, 0, -.8));
          cygnet.errand = this.curiosity; cygnet.pace = .6;
        }));
      } else if (!this.tending && time - this.since > 1.4) {
        if (this.index === 1) {
          this.curiosity.copy(child.position); this.curiosity.x += 2.2; this.curiosity.z += .8;
          cygnet.errand = this.curiosity; cygnet.stay = false; cygnet.pace = .7;
        }
        garden.release(time); this.to('play');
      }
    } else if (this.beat === 'play') {
      if (this.index === 0 && garden.heardAt > this.lastCuriosity && !carry.busy) {
        this.lastCuriosity = garden.heardAt;
        this.curiosity.copy(child.position);
        this.curiosity.x += garden.heard.x < child.position.x ? -2.6 : 2.6;
        this.curiosity.z += .6;
        cygnet.errand = this.curiosity; cygnet.stay = false; cygnet.pace = .6;
      }
      if (garden.seeds.completed > this.index && time - garden.receivedAt > tuning.meadowEchoes.arrivalRest) {
        this.index = garden.seeds.completed;
        this.to('follow'); this.walk(cast);
      }
    } else if (this.beat === 'listen') {
      if (this.hearsFamily) child.faceToward(cast.flock.head.x, cast.flock.head.z, 1 - Math.exp(-dt * .8));
      if (time - this.since > tuning.meadowEchoes.listenFor && !carry.busy) {
        this.to('gather'); cygnet.errand = null; cygnet.stay = true;
        const finish = () => {
          this.to('done'); garden.enabled = false; this.leaving = true;
          cygnet.watch(null); cygnet.stay = false; cygnet.pace = 1; child.lookAt = null;
          child.stowPlane(false); plane.visible = true; plane.hold(child);
        };
        if (cygnet.seat === 'satchel') finish();
        else carry.gatherUp(() => carry.stow(finish));
      }
    }
    return true;
  }

  private walk(cast: Cast): void {
    const at = garden.stands[this.index];
    cast.child.walkTo(at.x, at.z, false, undefined, .12);
  }
  private to(beat: Beat): void { this.beat = beat; this.since = this.now; }

  frame(shot: Shot, cast: Cast): boolean {
    if (!this.active) return false;
    const c = cast.child.position, portrait = typeof window !== 'undefined' && window.innerWidth < window.innerHeight;
    this.childAt.copy(c).y += 1.25;
    const patch = garden.patches[Math.min(this.index, 1)];
    const traveling = this.beat === 'follow' || this.beat === 'approach' || this.index === 2;
    this.center.copy(traveling ? this.childAt : patch);
    if (traveling) this.center.z -= 4;
    else if (this.index === 1) this.center.y += garden.seeds.progress * 1.5;
    const turn = 1 - THREE.MathUtils.smootherstep(c.z, tuning.meadowEchoes.cameraTurnTo, tuning.meadowEchoes.cameraTurnFrom);
    const onward = 1 - THREE.MathUtils.smootherstep(c.z, garden.stands[2].z, garden.stands[1].z);
    const second = portrait ? THREE.MathUtils.lerp(tuning.meadowEchoes.cameraPortraitSecondSide,
      tuning.meadowEchoes.cameraSecondSide, onward) : tuning.meadowEchoes.cameraSecondSide;
    this.side.set(THREE.MathUtils.lerp(portrait ? -.15 : -.5, second, turn), 0, 1).normalize();
    shot.target.copy(this.childAt).lerp(this.center, traveling ? .4 : .55);
    shot.from = this.side;
    shot.distance = portrait ? tuning.meadowEchoes.cameraPortraitBack : tuning.meadowEchoes.cameraBack;
    shot.height = portrait ? tuning.meadowEchoes.cameraPortraitUp : tuning.meadowEchoes.cameraUp;
    shot.eye = undefined; shot.attention = undefined; shot.composition = 'hold';
    shot.carry = true; shot.carryAnchor = c; shot.clearance = 2.5; shot.smoothFit = 2;
    this.frameSubjects.points[0].copy(cast.cygnet.position).y += .45;
    this.frameSubjects.points[1].copy(this.index === 1 && !traveling ? garden.seed : this.center);
    for (let i = 0; i < 3; i++) this.frameSubjects.points[i + 2].copy(this.index === 0 && !traveling ? garden.sectors[i] : this.center);
    shot.subjects = this.frameSubjects;
    if (this.index === 2) {
      this.exitLook.copy(shot.target).sub(c);
      this.exitEye.copy(this.exitLook).addScaledVector(this.side, shot.distance).y += shot.height;
    }
    return true;
  }

  depart(shot: Shot, cast: Cast): number {
    const c = cast.child.position, stand = garden.stands[2];
    const walked = THREE.MathUtils.smootherstep(Math.hypot(c.x - stand.x, c.z - stand.z), 0, tuning.meadowEchoes.departureWalk);
    shot.target.lerp(this.exitAt.copy(c).add(this.exitLook), 1 - walked);
    shot.eye!.lerp(this.exitAt.copy(c).add(this.exitEye), 1 - walked);
    shot.composition = 'hold'; shot.smoothFit = 2;
    return THREE.MathUtils.lerp(tuning.meadowEchoes.cameraPace, .9, walked);
  }
}
