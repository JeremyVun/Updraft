import * as THREE from 'three';
import { params } from './params';
import { heightAt } from './world/island';

const MIN_HFOV = 64;
/** The camera always looks roughly north, from a little east of south, unless a shot says otherwise. */
const FROM = new THREE.Vector3(0.075, 0, 1).normalize();

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
}

/** Glides between the shots the story asks for, breathing gently, never cutting. */
export class CameraRig {
  readonly camera = new THREE.PerspectiveCamera(38, 1, 0.5, 7000);
  private readonly fixed: boolean;
  private readonly eye = new THREE.Vector3();
  private readonly look = new THREE.Vector3();
  private readonly wantEye = new THREE.Vector3();
  private readonly lastTarget = new THREE.Vector3();
  private readonly moved = new THREE.Vector3();
  private readonly want = new THREE.Vector3();
  private readonly probe = new THREE.Vector3();
  private lift = 0;
  private pull = 0;

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
    if (shot.eye) return out.copy(shot.eye);
    return out
      .copy(shot.target)
      .addScaledVector(shot.from ?? FROM, shot.distance)
      .setY(shot.target.y + shot.height);
  }

  /** Jumps straight to a shot (used once at the start). */
  cut(shot: Shot): void {
    if (this.fixed) return;
    this.desired(shot, this.eye);
    this.look.copy(shot.target);
    this.lastTarget.copy(shot.target);
    this.lift = 0;
    this.pull = 0;
    this.place(0, Infinity);
  }

  update(dt: number, time: number, shot: Shot, pace = 0.6): void {
    if (this.fixed) return;
    const k = 1 - Math.exp(-dt * pace);
    this.moved.subVectors(shot.target, this.lastTarget);
    this.lastTarget.copy(shot.target);
    if (shot.carry && this.moved.lengthSq() < 1) {
      this.eye.add(this.moved);
      this.look.add(this.moved);
    }
    this.eye.lerp(this.desired(shot, this.wantEye), k);
    this.look.lerp(shot.target, k);
    this.place(time, dt);
  }

  private place(time: number, dt: number): void {
    const reach = Math.min(this.eye.distanceTo(this.look), 60);
    const want = this.want.copy(this.eye);
    want.x += Math.sin(time * 0.07 + 1.3) * 0.02 * reach;
    want.y += Math.sin(time * 0.11) * 0.012 * reach;
    const clear = Math.max(heightAt(want.x, want.z), heightAt(want.x, want.z - 6), 0) + 2.8;
    if (want.y < clear) want.y = clear;
    /**
     * Whatever else a shot asks for, the subject stays in sight. Ground in the way is answered by coming in
     * closer first and only then by rising, because a camera that solves every hill by climbing ends up looking
     * down on the game from somewhere over it. Losing the child behind a hill is the one failure this game has.
     */
    let pull = 0;
    let lift = this.blocked(want);
    for (const step of [0.3, 0.55]) {
      if (lift <= 0.05) break;
      this.probe.lerpVectors(want, this.look, step);
      pull = step;
      lift = this.blocked(this.probe);
    }
    this.pull += (pull - this.pull) * (1 - Math.exp(-dt * (pull > this.pull ? 3 : 0.5)));
    this.lift += (lift - this.lift) * (1 - Math.exp(-dt * (lift > this.lift ? 4 : 0.5)));
    const pos = this.camera.position.lerpVectors(want, this.look, this.pull);
    pos.y += this.lift;
    const floor = Math.max(heightAt(pos.x, pos.z), heightAt(pos.x, pos.z - 6), 0) + 2.8;
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
