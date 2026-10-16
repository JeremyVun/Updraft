import * as THREE from 'three';
import { FROM, type Shot } from '../camera';
import type { Coax } from '../fx/swirl';
import type { Cast } from './cast';
import { meadowEchoes as garden } from '../world/meadow-echoes';
import { tuning } from '../tuning';
import { heightAt } from '../world/island';
import { POND, POND_LEVEL } from '../world/heightfield';

type Beat = 'ahead' | 'approach' | 'settle' | 'play' | 'follow' | 'listen' | 'gather' | 'done';
const PLAY_MARGIN = .8;
const LENS = new THREE.PerspectiveCamera();
const POND_LENS = new THREE.PerspectiveCamera();
/** The pond's shore and a swan's height over it, which the walk to the crest keeps out of the frame. */
const RIM = Array.from({ length: 32 }, (_, i) => {
  const a = i * Math.PI / 8;
  return new THREE.Vector3(POND.x + Math.cos(a) * POND.rx, POND_LEVEL + (i < 16 ? 0 : 1.2), POND.z + Math.sin(a) * POND.rz);
});
const SEEN = new THREE.Vector3();
const POND_AT = new THREE.Vector3(POND.x, POND_LEVEL, POND.z);
const UP = new THREE.Vector3(0, 1, 0);
const ORIGIN = new THREE.Vector3();

export class MeadowSong {
  beat: Beat = 'ahead';
  private since = 0;
  private now = 0;
  private index = 0;
  private mix = 0;
  private tending = false;
  private lastCuriosity = 0;
  leaving = false;
  /** How far round her, away from the water, the walk to the crest last held the lens (radians about the vertical). */
  pondTurn = 0;
  private readonly childAt = new THREE.Vector3();
  private readonly center = new THREE.Vector3();
  private readonly side = new THREE.Vector3();
  private readonly curiosity = new THREE.Vector3();
  private readonly exitEye = new THREE.Vector3();
  private readonly exitLook = new THREE.Vector3();
  private readonly exitAt = new THREE.Vector3();
  private readonly leaveLook = new THREE.Vector3();
  private readonly leaveEye = new THREE.Vector3();
  /** How far the gaze had gone after the down when she walked on. */
  private watchedTo = 0;
  private readonly placedEye = new THREE.Vector3();
  private readonly walkEye = new THREE.Vector3();
  private readonly walkLook = new THREE.Vector3();
  private readonly played = new THREE.Vector3();
  private readonly gaze = new THREE.Vector3();
  private readonly cloud = new THREE.Vector3();
  private readonly aimAt = new THREE.Vector3();
  private arrivedAt = -Infinity;
  private readonly onScreen = new THREE.Vector3();
  private readonly kept = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  private readonly framed = new THREE.Vector3();
  private readonly frameSubjects = { primary: this.childAt, secondary: this.framed, primaryRadius: 1.8,
    points: Array.from({ length: 5 }, () => new THREE.Vector3()), margin: PLAY_MARGIN, extra: 8 };
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
  /** How closely the lens follows the play's framing; watching the down go, it keeps up with the rising column. */
  get pace(): number {
    const t = tuning.meadowEchoes;
    return this.beat === 'approach' ? t.cameraArrivePace : this.watching > 0 ? t.watchPace : t.cameraPace;
  }
  /** She has stopped on the far rise to listen, or walked on past it. */
  get listening(): boolean { return this.beat === 'listen' || this.beat === 'gather' || this.beat === 'done'; }
  get goal(): THREE.Vector3 | null { return this.beat === 'done' ? null : garden.stands[this.index]; }

  restore(completed: number, finished = completed >= 2): void {
    garden.reset(completed);
    this.index = Math.max(0, Math.min(2, completed));
    this.mix = this.since = this.now = 0;
    this.leaving = this.tending = false;
    this.pondTurn = 0;
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
      if (Math.hypot(child.position.x - stand.x, child.position.z - stand.z) > this.approach || carry.busy) return false;
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
        this.watchedTo = this.watching;
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

  /** How far from a stand the walk's view starts giving way to the play's: the seeds' view is round on her far side. */
  private get approach(): number { return this.index === 1 ? tuning.meadowEchoes.seedApproach : tuning.meadowEchoes.approach; }

  private walk(cast: Cast): void {
    const at = garden.stands[this.index];
    cast.child.walkTo(at.x, at.z, false, undefined, .12);
  }
  private to(beat: Beat): void {
    this.beat = beat; this.since = this.now;
    if (beat === 'settle') this.arrivedAt = this.now;
  }

  frame(shot: Shot, cast: Cast): boolean {
    if (!this.active) return false;
    const t = tuning.meadowEchoes;
    const c = cast.child.position, portrait = typeof window !== 'undefined' && window.innerWidth < window.innerHeight;
    const arriving = this.beat === 'approach';
    if (arriving) {
      // The walk's own view of her, which the story has already put in the shot.
      this.walkLook.copy(shot.target);
      this.walkEye.copy(shot.target).addScaledVector(shot.from ?? FROM, shot.distance).y += shot.height;
    }
    this.childAt.copy(c).y += 1.25;
    const patch = garden.patches[Math.min(this.index, 1)];
    const traveling = this.beat === 'follow' || this.beat === 'approach' || this.index === 2;
    this.center.copy(traveling ? this.childAt : patch);
    if (traveling) this.center.z -= 4;
    else if (this.index === 1) this.center.y += garden.seeds.progress * t.cameraSeedRise;
    // Nearing a stand, the lens's aim moves on from her walk to the play there, so nothing lunges as she stops.
    const next = garden.stands[Math.min(this.index, 1)];
    const settled = !traveling ? 1 : this.index === 2 ? 0
      : 1 - THREE.MathUtils.smoothstep(Math.hypot(c.x - next.x, c.z - next.z), 0, t.cameraSettleFrom);
    this.aimAt.copy(this.center).lerp(patch, traveling ? settled : 0);
    // Three framings blended by where she has walked: the flower bed, the seeds against the far slope, the listening rise.
    const turn = 1 - THREE.MathUtils.smoothstep(c.z, t.cameraTurnTo, t.cameraTurnFrom);
    const onward = 1 - THREE.MathUtils.smoothstep(c.z, garden.stands[2].z, garden.stands[1].z);
    const bed = 1 - turn, seeds = turn * (1 - onward), listen = turn * onward;
    const pick = (a: number, b: number, d: number) => a * bed + b * seeds + d * listen;
    const bearing = pick(Math.atan2(portrait ? -.15 : -.5, 1), portrait ? t.cameraPortraitSeedBearing : t.cameraSeedBearing,
      Math.atan2(t.cameraSecondSide, 1));
    this.side.set(Math.sin(bearing), 0, Math.cos(bearing));
    shot.target.copy(this.childAt).lerp(this.aimAt, THREE.MathUtils.lerp(.4, this.index === 1 ? t.cameraSeedAim : t.cameraBedAim, settled));
    shot.from = this.side;
    shot.distance = portrait ? pick(t.cameraPortraitBedBack, t.cameraPortraitSeedBack, t.cameraPortraitBack) : pick(t.cameraBedBack, t.cameraSeedBack, t.cameraBack);
    shot.height = portrait ? pick(t.cameraPortraitBedUp, t.cameraPortraitSeedUp, t.cameraPortraitUp) : pick(t.cameraBedUp, t.cameraSeedUp, t.cameraUp);
    shot.eye = undefined; shot.attention = undefined; shot.composition = 'hold';
    shot.carry = true; shot.carryAnchor = c; shot.clearance = 2.5; shot.smoothFit = 2;
    if (this.beat === 'follow') {
      // Leaving a play, the lens waits where it watched it until she has walked into the next view, so the cygnet, a
      // step behind her and low in the frame, is not left out of the bottom of it.
      const was = this.index - 1, stand = garden.stands[was], gone = Math.hypot(c.x - stand.x, c.z - stand.z);
      this.played.copy(garden.patches[was]).y += was === 1 ? t.cameraSeedRise : 0;
      this.gaze.copy(stand).y += 1.25;
      this.gaze.lerp(this.played, was === 0 ? t.cameraBedAim : t.cameraSeedAim);
      shot.target.lerpVectors(this.gaze, shot.target, THREE.MathUtils.smootherstep(gone, 0, t.cameraSetOff));
      shot.carry = false;
    }
    if (arriving) {
      // The walk's view gives way to this one over her last steps to the stand, so the lens never races in ahead of her.
      // Reach eases by ratio, so the lens comes in at an even pace rather than rushing the far part of the way.
      const stand = garden.stands[this.index];
      const k = THREE.MathUtils.smoothstep(Math.hypot(c.x - stand.x, c.z - stand.z), 0, this.approach);
      // Round her by bearing and elevation, so a wide change of side circles her rather than passing over her head.
      const near = this.placedEye.set(this.side.x * shot.distance, shot.height, this.side.z * shot.distance);
      const far = this.walkEye.sub(this.walkLook), reach = near.length() * (far.length() / near.length()) ** k;
      const [nearYaw, nearPitch] = aim(ORIGIN, near), [farYaw, farPitch] = aim(ORIGIN, far);
      const yaw = nearYaw + Math.atan2(Math.sin(farYaw - nearYaw), Math.cos(farYaw - nearYaw)) * k;
      const pitch = THREE.MathUtils.lerp(nearPitch, farPitch, k);
      shot.target.lerp(this.walkLook, k);
      shot.eye = look(shot.target, yaw, pitch, reach, near);
    }
    const points = this.frameSubjects.points;
    points[0].copy(cast.cygnet.position).y += .45;
    this.framed.copy(this.center);
    if (traveling) for (let i = 1; i < 5; i++) points[i].copy(this.center);
    else if (this.index === 0) { points[1].copy(this.center); for (let i = 0; i < 3; i++) points[i + 2].copy(garden.sectors[i]); }
    else {
      points[1].copy(garden.seed);
      points[2].copy(garden.crown); points[2].y = Math.min(points[2].y, patch.y + t.cameraSeedHold);
      points[3].copy(patch); points[4].copy(patch);
      // The heads come into the framing only once the lens has come round, or its lag would push it back and in again.
      this.gaze.copy(this.childAt).setZ(this.childAt.z - 4);
      const round = THREE.MathUtils.smoothstep(this.now - this.arrivedAt, 0, t.cameraSettleFor);
      for (let i = 1; i < 5; i++) points[i].lerpVectors(this.gaze, points[i], round);
      this.framed.lerpVectors(this.gaze, this.center, round);
    }
    shot.subjects = this.frameSubjects;
    this.frameSubjects.margin = PLAY_MARGIN;
    if (this.index === 2) {
      this.exitLook.copy(shot.target).sub(c);
      this.exitEye.copy(this.exitLook).addScaledVector(this.side, shot.distance).y += shot.height;
    }
    const watch = this.watching;
    if (watch > 0) this.watch(shot, cast, watch, portrait);
    return true;
  }

  /**
   * How far the lens has turned after the released down: it lifts its gaze a moment after the release, holds on the
   * cloud as it goes, and comes back to her over her first steps on.
   */
  private get watching(): number {
    const t = tuning.meadowEchoes;
    if (this.beat === 'play' && this.index === 1 && garden.seeds.completed >= 2)
      return THREE.MathUtils.smoothstep(this.now - garden.receivedAt, t.watchFrom, t.watchFrom + t.watchRise);
    if (this.beat === 'follow' && this.index === 2)
      return this.watchedTo * (1 - THREE.MathUtils.smootherstep(this.now - this.since, 0, t.watchReturn));
    return 0;
  }

  /**
   * The down going away over the island: the lens draws back a little from where it stands and lifts its gaze after
   * the cloud, as far as keeps her and the cygnet in the lower part of the frame.
   */
  private watch(shot: Shot, cast: Cast, watch: number, portrait: boolean): void {
    const t = tuning.meadowEchoes;
    const eye = shot.eye = this.placedEye.copy(shot.target).addScaledVector(this.side, shot.distance);
    eye.y = shot.target.y + shot.height;
    // Drawing back over the rolling ground it settles to a height over the grass, never meeting a slope.
    const above = eye.y - Math.max(heightAt(eye.x, eye.z), 0);
    eye.addScaledVector(this.side, (portrait ? t.watchPortraitBack : t.watchBack) * watch);
    eye.y = Math.max(heightAt(eye.x, eye.z), 0) + THREE.MathUtils.lerp(above, portrait ? t.watchPortraitAbove : t.watchAbove, watch);
    const c = cast.child.position;
    this.kept[0].copy(c);
    this.kept[1].copy(c).y += 1.9;
    this.kept[2].copy(cast.cygnet.position).y += .45;
    // Up after it first, then round after it, each as far as still keeps them in frame (found by halving).
    const from = LENS.position, reach = from.distanceTo(shot.target);
    this.cloud.copy(garden.seed).y = THREE.MathUtils.lerp(garden.seed.y, garden.cloudTop, t.watchTop);
    const [yaw, pitch] = aim(from, shot.target), [cloudYaw, cloudPitch] = aim(from, this.cloud);
    const turn = Math.atan2(Math.sin(cloudYaw - yaw), Math.cos(cloudYaw - yaw)) * t.watchTurn * watch;
    const lift = (cloudPitch - pitch) * t.watchShare * watch;
    const up = this.room(k => look(from, yaw, pitch + lift * k, reach, this.gaze));
    this.room(k => look(from, yaw + turn * k, pitch + lift * up, reach, this.gaze));
    shot.target.copy(this.gaze);
    // Only she and the cygnet are kept in frame now: the bare heads go out of the bottom of it.
    const points = this.frameSubjects.points;
    for (let i = 1; i < 5; i++) points[i].lerp(this.childAt, watch);
    this.framed.lerp(this.childAt, watch);
    this.frameSubjects.margin = THREE.MathUtils.lerp(PLAY_MARGIN, t.watchMargin, watch);
  }

  /** The lens as it last stood, which the watch tests its turns of the gaze from. */
  seenFrom(camera: THREE.PerspectiveCamera): void {
    LENS.position.copy(camera.position);
    for (const lens of [LENS, POND_LENS]) if (lens.fov !== camera.fov || lens.aspect !== camera.aspect) {
      lens.fov = camera.fov; lens.aspect = camera.aspect; lens.updateProjectionMatrix();
    }
  }

  /** The furthest along a turn of the gaze (0..1) that keeps them in frame; leaves the gaze there. */
  private room(at: (k: number) => THREE.Vector3): number {
    if (this.frames(at(1))) return 1;
    let low = 0, high = 1;
    for (let i = 0; i < 8; i++) {
      const mid = (low + high) / 2;
      if (this.frames(at(mid))) low = mid; else high = mid;
    }
    at(low);
    return low;
  }

  /** Whether she stays within `watchFrame` of the middle of the frame and the cygnet within `watchBirdFrame`. */
  private frames(look: THREE.Vector3): boolean {
    const t = tuning.meadowEchoes;
    LENS.lookAt(look);
    LENS.updateMatrixWorld();
    return this.kept.every((p, i) => {
      const q = this.onScreen.copy(p).project(LENS), limit = i < 2 ? t.watchFrame : t.watchBirdFrame;
      return q.z < 1 && Math.abs(q.x) < limit && Math.abs(q.y) < limit;
    });
  }

  /**
   * On to the crest the listening view gives way to the crest's as she walks, but it is turned round her away from
   * the water as far as keeps the pond out of the frame: the family on it is the crest's to show.
   */
  depart(shot: Shot, cast: Cast): number {
    const c = cast.child.position, stand = garden.stands[2];
    const walked = THREE.MathUtils.smootherstep(Math.hypot(c.x - stand.x, c.z - stand.z), 0, tuning.meadowEchoes.departureWalk);
    shot.target.lerp(this.exitAt.copy(c).add(this.exitLook), 1 - walked);
    shot.eye!.lerp(this.exitAt.copy(c).add(this.exitEye), 1 - walked);
    this.leaveLook.copy(shot.target).sub(c); this.leaveEye.copy(shot.eye!).sub(c);
    const [yaw] = aim(this.exitEye, this.exitLook), [pond] = aim(c, POND_AT);
    const away = Math.sign(Math.atan2(Math.sin(yaw - pond), Math.cos(yaw - pond))) || 1;
    const turned = (k: number) => {
      shot.target.copy(this.leaveLook).applyAxisAngle(UP, away * k).add(c);
      shot.eye!.copy(this.leaveEye).applyAxisAngle(UP, away * k).add(c);
      return hidesPond(shot.eye!, shot.target);
    };
    const most = tuning.meadowEchoes.crestPondTurn;
    this.pondTurn = 0;
    if (!turned(0)) {
      let low = 0, high = most;
      if (turned(most)) for (let i = 0; i < 10; i++) { const mid = (low + high) / 2; if (turned(mid)) high = mid; else low = mid; }
      turned(high);
      this.pondTurn = away * high;
    }
    shot.composition = 'hold'; shot.smoothFit = 2;
    return THREE.MathUtils.lerp(tuning.meadowEchoes.cameraPace, .9, walked);
  }
}

function hidesPond(eye: THREE.Vector3, at: THREE.Vector3): boolean {
  POND_LENS.position.copy(eye);
  POND_LENS.lookAt(at);
  POND_LENS.updateMatrixWorld();
  const edge = tuning.meadowEchoes.crestPondMargin;
  return RIM.every(p => {
    const q = SEEN.copy(p).project(POND_LENS);
    return q.z >= 1 || Math.abs(q.x) > edge || Math.abs(q.y) > edge;
  });
}

/** The bearing and elevation of a point as seen from an eye. */
function aim(eye: THREE.Vector3, at: THREE.Vector3): [number, number] {
  const x = at.x - eye.x, y = at.y - eye.y, z = at.z - eye.z;
  return [Math.atan2(x, z), Math.atan2(y, Math.hypot(x, z))];
}

function look(eye: THREE.Vector3, yaw: number, pitch: number, reach: number, out: THREE.Vector3): THREE.Vector3 {
  return out.set(eye.x + Math.sin(yaw) * Math.cos(pitch) * reach, eye.y + Math.sin(pitch) * reach,
    eye.z + Math.cos(yaw) * Math.cos(pitch) * reach);
}
