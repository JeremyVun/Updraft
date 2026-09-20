import * as THREE from 'three';
import { params } from './params';
import { heightAt } from './world/island';

const MIN_HFOV = 64;
/** The camera always looks roughly north, from a little east of south, unless a shot says otherwise. */
const FROM = new THREE.Vector3(0.075, 0, 1).normalize();
/** How far above the ground a shot stands unless it says otherwise. */
const GROUND_CLEARANCE = 2.8;
const OCCLUSION_STEPS = [0.3, 0.55];

function subjectShift(a: number, b: number, c: number, depth: number, otherDepth: number,
  thirdDepth: number, slope: number): number {
  const lo = a - depth * slope, hi = a + depth * slope;
  const bothLo = Math.max(lo, b - otherDepth * slope, c - thirdDepth * slope);
  const bothHi = Math.min(hi, b + otherDepth * slope, c + thirdDepth * slope);
  return bothLo <= bothHi ? THREE.MathUtils.clamp(0, bothLo, bothHi) : THREE.MathUtils.clamp(0, lo, hi);
}

export interface Shot {
  /** The point the camera looks at. */
  target: THREE.Vector3;
  /** Horizontal distance from the target. */
  distance: number;
  /** Height above the target. */
  height: number;
  /** Horizontal direction from the target to the camera. */
  from?: THREE.Vector3;
  /** An exact camera position; overrides distance, height and from. */
  eye?: THREE.Vector3;
  /** The camera travels with a steadily moving target (a boat) and only eases the framing, so it never trails. */
  carry?: boolean;
  /** Optional physical anchor: carry its movement, while changes of focus still ease normally. */
  carryAnchor?: THREE.Vector3;
  /** Preserve the landscape composition's horizontal field in narrow viewports by drawing back. */
  fitWidth?: boolean;
  /**
   * How far above the ground the camera is held. The default stands it at a walking child's eye; a room that
   * wants to be seen by something small lowers it, and nothing else in the game changes.
   */
  clearance?: number;
  /** Smooth authored changes of subject coverage instead of jumping to the fit. */
  smoothFit?: number;
  /** QA: the camera goes exactly where it is put, with no ground clearance, no sight-line correction and no breathing. */
  free?: boolean;
  /** An authored continuous threshold move supplies its own easing and ground clearance. */
  exact?: boolean;
  /** Optional playable pair. Fit both within a bounded retreat; the primary always keeps the frame. */
  subjects?: { primary: THREE.Vector3; secondary: THREE.Vector3; tertiary?: THREE.Vector3; margin: number; extra: number };
}

/** Glides between the shots the story asks for, breathing gently, never cutting. */
export class CameraRig {
  readonly camera = new THREE.PerspectiveCamera(38, 1, 0.5, 7000);
  private readonly fixed: boolean;
  private readonly eye = new THREE.Vector3();
  private readonly look = new THREE.Vector3();
  private readonly wantEye = new THREE.Vector3();
  private readonly lastTarget = new THREE.Vector3();
  private readonly lastCarryAnchor = new THREE.Vector3();
  private readonly moved = new THREE.Vector3();
  private readonly want = new THREE.Vector3();
  private readonly probe = new THREE.Vector3();
  private lift = 0;
  private pull = 0;
  private clear = GROUND_CLEARANCE;
  private fitBack = 0;
  private readonly local = new THREE.Vector3();
  private readonly second = new THREE.Vector3();
  private readonly third = new THREE.Vector3();
  private readonly right = new THREE.Vector3();
  private readonly up = new THREE.Vector3();
  private readonly back = new THREE.Vector3();
  private readonly fitOffset = new THREE.Vector3();
  private readonly fitOrigin = new THREE.Vector3();

  constructor() {
    this.fixed = params.cam !== null;
    if (params.cam) {
      const [x, y, z, tx, ty, tz] = params.cam;
      this.camera.position.set(x, y, z);
      this.camera.lookAt(tx ?? 0, ty ?? 0, tz ?? 0);
    }
  }

  resize(width: number, height: number): void {
    const aspect = width / height;
    this.camera.aspect = aspect;
    const hfov = THREE.MathUtils.degToRad(MIN_HFOV);
    const vfovForWidth = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(hfov / 2) / aspect));
    this.camera.fov = THREE.MathUtils.clamp(Math.max(38, vfovForWidth), 38, 62);
    this.camera.updateProjectionMatrix();
  }

  private desired(shot: Shot, out: THREE.Vector3): THREE.Vector3 {
    if (shot.eye) out.copy(shot.eye);
    else out.copy(shot.target)
      .addScaledVector(shot.from ?? FROM, shot.distance)
      .setY(shot.target.y + shot.height);
    if (shot.fitWidth) {
      const horizontal = Math.tan(THREE.MathUtils.degToRad(this.camera.fov) / 2) * this.camera.aspect;
      const back = Math.max(1, Math.tan(THREE.MathUtils.degToRad(MIN_HFOV) / 2) / horizontal);
      out.sub(shot.target).multiplyScalar(back).add(shot.target);
    }
    return out;
  }

  /** Jumps straight to a shot (used once at the start). */
  cut(shot: Shot): void {
    if (this.fixed) return;
    this.desired(shot, this.eye);
    this.look.copy(shot.target);
    this.lastTarget.copy(shot.target);
    this.lastCarryAnchor.copy(shot.carryAnchor ?? shot.target);
    this.lift = 0;
    this.pull = 0;
    this.clear = shot.clearance ?? GROUND_CLEARANCE;
    this.place(0, Infinity);
    this.fitBack = 0;
    this.fitOffset.set(0, 0, 0);
    this.fitSubjects(shot, Infinity);
  }

  update(dt: number, time: number, shot: Shot, pace = 0.6): void {
    if (this.fixed) return;
    if (shot.exact && shot.eye) {
      this.eye.copy(shot.eye); this.look.copy(shot.target); this.lastTarget.copy(shot.target);
      this.camera.position.copy(this.eye); this.camera.lookAt(this.look);
      return;
    }
    const k = 1 - Math.exp(-dt * pace);
    this.moved.subVectors(shot.carryAnchor ?? shot.target, shot.carryAnchor ? this.lastCarryAnchor : this.lastTarget);
    this.lastTarget.copy(shot.target);
    this.lastCarryAnchor.copy(shot.carryAnchor ?? shot.target);
    if (shot.carry && this.moved.lengthSq() < 1) {
      this.eye.add(this.moved);
      this.look.add(this.moved);
    }
    this.eye.lerp(this.desired(shot, this.wantEye), k);
    this.look.lerp(shot.target, k);
    if (shot.free) {
      this.camera.position.copy(this.eye);
      this.camera.lookAt(this.look);
      return;
    }
    /** Eased like everything else the shot asks for: coming down to a bird's eye is a move, not a cut. */
    this.clear += ((shot.clearance ?? GROUND_CLEARANCE) - this.clear) * k;
    this.place(time, dt);
    this.fitSubjects(shot, dt);
  }

  /** Use the final camera, after terrain correction, so a hill cannot silently undo the fit. */
  private fitSubjects(shot: Shot, dt: number): void {
    const pair = shot.subjects;
    const camera = this.camera;
    if (!pair) {
      this.fitBack = 0;
      this.fitOffset.multiplyScalar(Math.exp(-dt * 2));
      camera.position.add(this.fitOffset);
      camera.updateMatrixWorld();
      return;
    }
    this.fitOrigin.copy(camera.position);
    camera.updateMatrixWorld();
    this.right.setFromMatrixColumn(camera.matrixWorld, 0);
    this.up.setFromMatrixColumn(camera.matrixWorld, 1);
    this.back.setFromMatrixColumn(camera.matrixWorld, 2);
    const vertical = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * pair.margin;
    const horizontal = vertical * camera.aspect;
    let needed = 0;
    for (let i = 0; i < (pair.tertiary ? 3 : 2); i++) {
      const point = i === 0 ? pair.primary : i === 1 ? pair.secondary : pair.tertiary!;
      this.local.copy(point).applyMatrix4(camera.matrixWorldInverse);
      needed = Math.max(needed, Math.abs(this.local.x) / horizontal + this.local.z,
        Math.abs(this.local.y) / vertical + this.local.z);
    }
    needed = Math.min(pair.extra, needed);
    // Respond as an edge approaches; release the extra space slowly when they come together.
    this.fitBack = shot.smoothFit ? THREE.MathUtils.lerp(this.fitBack, Math.max(0,needed),1-Math.exp(-dt*shot.smoothFit)) : Math.max(needed, this.fitBack * Math.exp(-dt * 0.8));
    camera.position.addScaledVector(this.back, this.fitBack);
    camera.updateMatrixWorld();
    this.local.copy(pair.primary).applyMatrix4(camera.matrixWorldInverse);
    const depth = Math.max(1, -this.local.z);
    this.second.copy(pair.secondary).applyMatrix4(camera.matrixWorldInverse);
    const otherDepth = Math.max(1, -this.second.z);
    this.third.copy(pair.tertiary ?? pair.secondary).applyMatrix4(camera.matrixWorldInverse);
    const thirdDepth = Math.max(1, -this.third.z);
    // Recompose within the available room before asking for any more distance. If an old runaway
    // cannot fit, the child's interval wins until the plane has flown back into reach.
    const x = subjectShift(this.local.x, this.second.x, this.third.x, depth, otherDepth, thirdDepth, horizontal);
    const y = subjectShift(this.local.y, this.second.y, this.third.y, depth, otherDepth, thirdDepth, vertical);
    camera.position.addScaledVector(this.right, x).addScaledVector(this.up, y);
    camera.position.y = Math.max(camera.position.y, Math.max(heightAt(camera.position.x, camera.position.z), 0) + this.clear);
    if (shot.smoothFit && Number.isFinite(dt)) {
      this.want.subVectors(camera.position,this.fitOrigin);
      this.fitOffset.lerp(this.want,1-Math.exp(-dt*shot.smoothFit));
      camera.position.copy(this.fitOrigin).add(this.fitOffset);
    } else this.fitOffset.subVectors(camera.position, this.fitOrigin);
    camera.updateMatrixWorld();
  }

  private place(time: number, dt: number): void {
    const reach = Math.min(this.eye.distanceTo(this.look), 60);
    const want = this.want.copy(this.eye);
    want.x += Math.sin(time * 0.07 + 1.3) * 0.02 * reach;
    want.y += Math.sin(time * 0.11) * 0.012 * reach;
    const clear = Math.max(heightAt(want.x, want.z), heightAt(want.x, want.z - 6), 0) + this.clear;
    if (want.y < clear) want.y = clear;
    /**
     * Whatever else a shot asks for, the subject stays in sight. Ground in the way is answered by coming in
     * closer first and only then by rising, because a camera that solves every hill by climbing ends up looking
     * down on the game from somewhere over it. Losing the child behind a hill is the one failure this game has.
     */
    let pull = 0;
    let lift = this.blocked(want);
    for (const step of OCCLUSION_STEPS) {
      if (lift <= 0.05) break;
      this.probe.lerpVectors(want, this.look, step);
      pull = step;
      lift = this.blocked(this.probe);
    }
    this.pull += (pull - this.pull) * (1 - Math.exp(-dt * (pull > this.pull ? 3 : 0.5)));
    this.lift += (lift - this.lift) * (1 - Math.exp(-dt * (lift > this.lift ? 4 : 0.5)));
    const pos = this.camera.position.lerpVectors(want, this.look, this.pull);
    pos.y += this.lift;
    const floor = Math.max(heightAt(pos.x, pos.z), heightAt(pos.x, pos.z - 6), 0) + this.clear;
    if (pos.y < floor) pos.y = floor;
    this.camera.lookAt(this.look);
  }

  /** How far the camera would have to rise for the ground along its line of sight to be out of the way. */
  private blocked(eye: THREE.Vector3): number {
    let worst = 0;
    /** Only the ground in the first two thirds of the way is considered: nearer the subject than that, a lift
     * big enough to see over it would be a lift big enough to lose them anyway. */
    for (let i = 1; i <= 6; i++) {
      const t = i / 9;
      const gap = 1 - t;
      const x = eye.x + (this.look.x - eye.x) * t;
      const z = eye.z + (this.look.z - eye.z) * t;
      const ray = eye.y + (this.look.y - eye.y) * t;
      /** The clearance tapers to nothing at the subject, so a boat low in the water never pulls the camera up. */
      const need = (Math.max(heightAt(x, z), 0) + gap - ray) / gap;
      if (need > worst) worst = need;
    }
    return Math.min(worst, 14);
  }
}
