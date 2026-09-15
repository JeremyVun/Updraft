import * as THREE from 'three';
import { params } from './params';
import { heightAt } from './world/island';

const MIN_HFOV = 64;
/** The camera always looks roughly north, from a little east of south. */
const FROM = new THREE.Vector3(0.075, 0, 1).normalize();

export interface Shot {
  /** The point the camera looks at. */
  target: THREE.Vector3;
  /** Horizontal distance from the target. */
  distance: number;
  /** Height above the target. */
  height: number;
}

/** Glides between shots the story asks for, breathing gently, never cutting. */
export class CameraRig {
  readonly camera = new THREE.PerspectiveCamera(38, 1, 0.5, 7000);
  private readonly fixed: boolean;
  private readonly target = new THREE.Vector3(-4, 4, -21);
  private distance = 92;
  private height = 19;
  private readonly look = new THREE.Vector3();
  private readonly lift = new THREE.Vector3();

  constructor() {
    this.fixed = params.cam !== null;
    if (params.cam) {
      const [x, y, z, tx, ty, tz] = params.cam;
      this.camera.position.set(x, y, z);
      this.camera.lookAt(tx ?? 0, ty ?? 0, tz ?? 0);
    } else {
      this.place(0);
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

  /** Jumps straight to a shot (used once at the start). */
  cut(shot: Shot): void {
    if (this.fixed) return;
    this.target.copy(shot.target);
    this.distance = shot.distance;
    this.height = shot.height;
    this.place(0);
  }

  update(dt: number, time: number, shot: Shot, pace = 0.6): void {
    if (this.fixed) return;
    const k = 1 - Math.exp(-dt * pace);
    this.target.lerp(shot.target, k);
    this.distance += (shot.distance - this.distance) * k * 0.8;
    this.height += (shot.height - this.height) * k * 0.8;
    this.place(time);
  }

  private place(time: number): void {
    const breathe = Math.sin(time * 0.11) * 0.012 * this.distance;
    const sway = Math.sin(time * 0.07 + 1.3) * 0.02 * this.distance;
    this.camera.position
      .copy(this.target)
      .addScaledVector(FROM, this.distance)
      .add(this.lift.set(sway, this.height + breathe, 0));
    const pos = this.camera.position;
    const clear = Math.max(heightAt(pos.x, pos.z), heightAt(pos.x, pos.z - 6), 0) + 2.8;
    if (pos.y < clear) pos.y = clear;
    this.look.copy(this.target);
    this.camera.lookAt(this.look);
  }
}
