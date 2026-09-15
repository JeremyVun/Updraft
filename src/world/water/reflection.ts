import * as THREE from 'three';

/** Objects on this layer appear in the sea's reflection. Grass stays off it: it is far too costly to draw twice. */
export const REFLECTION_LAYER = 1;

const BIAS = new THREE.Matrix4().set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
const UP = new THREE.Vector3(0, 1, 0);
/** A hair above the sea, so the seabed right at the waterline never shows in the mirror. */
const CLIP_POINT = new THREE.Vector3(0, 0.02, 0);

/**
 * The world above y = 0 seen through a mirror under the sea, rendered at reduced resolution with mipmaps
 * so rough water can read it blurred. `matrix` maps a world position to its projective texture coordinate.
 */
export class PlanarReflection {
  readonly target: THREE.WebGLRenderTarget;
  readonly matrix = new THREE.Matrix4();
  private readonly camera = new THREE.PerspectiveCamera();
  private readonly size = new THREE.Vector2();
  private readonly lookAt = new THREE.Vector3();
  private readonly clipPlane = new THREE.Vector4();
  private readonly plane = new THREE.Plane();
  private readonly q = new THREE.Vector4();

  constructor(
    private readonly renderer: THREE.WebGLRenderer,
    private readonly scene: THREE.Scene,
    private readonly scale: number,
  ) {
    this.target = new THREE.WebGLRenderTarget(1, 1, {
      type: THREE.HalfFloatType,
      minFilter: THREE.LinearMipmapLinearFilter,
      magFilter: THREE.LinearFilter,
      generateMipmaps: true,
      depthBuffer: true,
    });
    this.camera.layers.set(REFLECTION_LAYER);
  }

  render(view: THREE.PerspectiveCamera): void {
    const r = this.renderer;
    r.getDrawingBufferSize(this.size);
    const w = Math.max(1, Math.round(this.size.x * this.scale));
    const h = Math.max(1, Math.round(this.size.y * this.scale));
    if (this.target.width !== w || this.target.height !== h) this.target.setSize(w, h);

    view.updateMatrixWorld();
    const cam = this.camera;
    const p = view.position;
    cam.position.set(p.x, -p.y, p.z);
    view.getWorldDirection(this.lookAt).add(p);
    this.lookAt.y = -this.lookAt.y;
    cam.up.copy(UP).applyQuaternion(view.quaternion).reflect(UP);
    cam.lookAt(this.lookAt);
    cam.near = view.near;
    cam.far = view.far;
    cam.updateMatrixWorld();
    cam.projectionMatrix.copy(view.projectionMatrix);
    this.matrix.copy(BIAS).multiply(cam.projectionMatrix).multiply(cam.matrixWorldInverse);

    // Oblique near plane at the sea surface, so nothing below the water shows in the mirror.
    this.plane.setFromNormalAndCoplanarPoint(UP, CLIP_POINT).applyMatrix4(cam.matrixWorldInverse);
    this.clipPlane.set(this.plane.normal.x, this.plane.normal.y, this.plane.normal.z, this.plane.constant);
    const e = cam.projectionMatrix.elements;
    this.q.set((Math.sign(this.clipPlane.x) + e[8]) / e[0], (Math.sign(this.clipPlane.y) + e[9]) / e[5], -1, (1 + e[10]) / e[14]);
    this.clipPlane.multiplyScalar(2 / this.clipPlane.dot(this.q));
    e[2] = this.clipPlane.x;
    e[6] = this.clipPlane.y;
    e[10] = this.clipPlane.z + 1;
    e[14] = this.clipPlane.w;
    cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();

    const prev = r.getRenderTarget();
    r.setRenderTarget(this.target);
    r.render(this.scene, cam);
    r.setRenderTarget(prev);
  }
}
