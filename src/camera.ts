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
}

/** Glides between the shots the story asks for, breathing gently, never cutting. */
export class CameraRig {
  readonly camera = new THREE.PerspectiveCamera(38, 1, 0.5, 7000);
  private readonly fixed: boolean;
  private readonly eye = new THREE.Vector3();
  private readonly look = new THREE.Vector3();
  private readonly wantEye = new THREE.Vector3();

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
    this.place(0);
  }

  update(dt: number, time: number, shot: Shot, pace = 0.6): void {
    if (this.fixed) return;
    const k = 1 - Math.exp(-dt * pace);
    this.eye.lerp(this.desired(shot, this.wantEye), k);
    this.look.lerp(shot.target, k);
    this.place(time);
  }

  private place(time: number): void {
    const reach = Math.min(this.eye.distanceTo(this.look), 60);
    const pos = this.camera.position;
    pos.copy(this.eye);
    pos.x += Math.sin(time * 0.07 + 1.3) * 0.02 * reach;
    pos.y += Math.sin(time * 0.11) * 0.012 * reach;
    const clear = Math.max(heightAt(pos.x, pos.z), heightAt(pos.x, pos.z - 6), 0) + 2.8;
    if (pos.y < clear) pos.y = clear;
    this.camera.lookAt(this.look);
  }
}
