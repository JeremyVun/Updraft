import * as THREE from 'three';
import { params } from './params';

const BASE_POS = new THREE.Vector3(3, 23, 70);
const BASE_TARGET = new THREE.Vector3(-4, 4, -21);
const MIN_HFOV = 64;

export class CameraRig {
  readonly camera = new THREE.PerspectiveCamera(38, 1, 0.5, 7000);
  private readonly focus = new THREE.Vector3();
  private readonly smoothFocus = new THREE.Vector3();
  private readonly pos = new THREE.Vector3();
  private readonly target = new THREE.Vector3();
  private readonly fixed: boolean;

  constructor() {
    this.fixed = params.cam !== null;
    if (params.cam) {
      const [x, y, z, tx, ty, tz] = params.cam;
      this.camera.position.set(x, y, z);
      this.camera.lookAt(tx ?? 0, ty ?? 0, tz ?? 0);
    } else {
      this.camera.position.copy(BASE_POS);
      this.camera.lookAt(BASE_TARGET);
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

  /** Drifts gently and leans toward the point of interest, rising and easing back when it climbs, so it stays in frame. */
  update(dt: number, time: number, interest: THREE.Vector3 | null): void {
    if (this.fixed) return;
    this.focus.set(0, 0, 0);
    if (interest) {
      this.focus.set(
        THREE.MathUtils.clamp((interest.x - BASE_TARGET.x) * 0.2, -12, 12),
        Math.min(Math.max(0, interest.y - 12) * 0.45, 10),
        THREE.MathUtils.clamp((interest.z - BASE_TARGET.z) * 0.12, -8, 8),
      );
    }
    this.smoothFocus.lerp(this.focus, 1 - Math.exp(-dt * 0.7));
    const breathe = Math.sin(time * 0.11) * 1.2;
    const sway = Math.sin(time * 0.07 + 1.3) * 2.0;
    const climb = this.smoothFocus.y;
    this.pos.set(BASE_POS.x + this.smoothFocus.x + sway, BASE_POS.y + climb * 0.7 + breathe, BASE_POS.z + this.smoothFocus.z + climb * 0.9);
    this.target.set(BASE_TARGET.x + this.smoothFocus.x, BASE_TARGET.y + climb, BASE_TARGET.z + this.smoothFocus.z);
    this.camera.position.copy(this.pos);
    this.camera.lookAt(this.target);
  }
}
