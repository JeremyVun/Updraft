import * as THREE from 'three';
import type { Shot } from '../camera';
import type { Coax } from '../fx/swirl';
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
  private readonly asking: Coax = { at: new THREE.Vector3(), urgency: .8, radius: 2.2 };

  get active(): boolean { return this.beat !== 'ahead' && this.beat !== 'done'; }
  get hush(): number { return this.mix; }
  get hearsFamily(): boolean { return (this.beat === 'listen' && this.now - this.since > tuning.meadowEchoes.familyAfter) || this.beat === 'gather'; }
  get invitation(): THREE.Vector3 | null {
    return this.waiting && this.index === 0 ? garden.invitation : null;
  }
  /** The seed heads ask for a circling updraft, and give way while the player winds one. */
  get coax(): Coax | null {
    if (!this.waiting || this.index !== 1 || this.now - garden.workedAt < tuning.invitation.resumeAfter) return null;
    this.asking.at.copy(garden.patches[1]).y -= .3;
    return this.asking;
  }
  private get waiting(): boolean {
    return this.beat === 'play' && garden.seeds.active && this.now - this.since > tuning.meadowEchoes.inviteAfter;
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
        garden.release(); this.to('play');
      }
    } else if (this.beat === 'play') {
      if (this.index === 0 && garden.heardAt > this.lastCuriosity && !carry.busy) {
        this.lastCuriosity = garden.heardAt;
        this.curiosity.copy(child.position);
        this.curiosity.x += garden.heard.x < child.position.x ? -2.6 : 2.6;
        this.curiosity.z += .6;
        cygnet.errand = this.curiosity; cygnet.stay = false; cygnet.pace = .6;
      }
      const rest = this.index === 0 ? tuning.meadowEchoes.arrivalRest : tuning.meadowEchoes.seedRest;
      if (garden.seeds.completed > this.index && time - garden.receivedAt > rest) {
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
    const t = tuning.meadowEchoes;
    const c = cast.child.position, portrait = typeof window !== 'undefined' && window.innerWidth < window.innerHeight;
    this.childAt.copy(c).y += 1.25;
    const patch = garden.patches[Math.min(this.index, 1)];
    const traveling = this.beat === 'follow' || this.beat === 'approach' || this.index === 2;
    this.center.copy(traveling ? this.childAt : patch);
    if (traveling) this.center.z -= 4;
    else if (this.index === 1) this.center.y += garden.seeds.progress * t.cameraSeedRise;
    // Three framings blended by where she has walked: the flower bed, the seeds against the far slope, the listening rise.
    const turn = 1 - THREE.MathUtils.smootherstep(c.z, t.cameraTurnTo, t.cameraTurnFrom);
    const onward = 1 - THREE.MathUtils.smootherstep(c.z, garden.stands[2].z, garden.stands[1].z);
    const bed = 1 - turn, seeds = turn * (1 - onward), listen = turn * onward;
    const pick = (a: number, b: number, d: number) => a * bed + b * seeds + d * listen;
    this.side.set(pick(portrait ? -.15 : -.5, portrait ? t.cameraPortraitSeedSide : t.cameraSeedSide, t.cameraSecondSide), 0, 1).normalize();
    shot.target.copy(this.childAt).lerp(this.center, traveling ? .4 : this.index === 1 ? t.cameraSeedAim : .55);
    shot.from = this.side;
    shot.distance = portrait ? pick(t.cameraPortraitBedBack, t.cameraPortraitSeedBack, t.cameraPortraitBack) : pick(t.cameraBedBack, t.cameraSeedBack, t.cameraBack);
    shot.height = portrait ? pick(t.cameraPortraitBedUp, t.cameraPortraitSeedUp, t.cameraPortraitUp) : pick(t.cameraBedUp, t.cameraSeedUp, t.cameraUp);
    shot.eye = undefined; shot.attention = undefined; shot.composition = 'hold';
    shot.carry = true; shot.carryAnchor = c; shot.clearance = 2.5; shot.smoothFit = 2;
    const points = this.frameSubjects.points;
    points[0].copy(cast.cygnet.position).y += .45;
    if (traveling) for (let i = 1; i < 5; i++) points[i].copy(this.center);
    else if (this.index === 0) { points[1].copy(this.center); for (let i = 0; i < 3; i++) points[i + 2].copy(garden.sectors[i]); }
    else {
      points[1].copy(garden.seed);
      points[2].copy(garden.crown); points[2].y = Math.min(points[2].y, patch.y + t.cameraSeedHold);
      points[3].copy(patch); points[4].copy(patch);
    }
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
