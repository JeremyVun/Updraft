import * as THREE from 'three';
import { tuning } from '../tuning';

/**
 * How high over the point it follows the echo hangs and how big it is, in metres; `least`, the smallest it is ever
 * drawn as a share of the view's height, so a small animal's call still reads from far off; `halo`, a darker edge
 * round the strokes so they hold against pale sky and fog.
 */
export interface CallLook {
  height: number;
  size: number;
  least?: number;
  halo?: string;
}

/** A small visual echo of an animal's voice: the cygnet's on the ground, in flight or in the child's arms, the cat's and her kittens'. */
export class CallMarks {
  readonly sprite: THREE.Sprite;
  private strength = 0;
  private readonly from = new THREE.Vector3();
  private lift = 0;
  private size = 0;

  constructor(private readonly look: CallLook = tuning.cygnetCalls) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 128;
    const ctx = canvas.getContext('2d')!;
    ctx.lineCap = 'round';
    const strokes = (style: string, width: number) => {
      ctx.strokeStyle = style;
      ctx.lineWidth = width;
      for (let i = 0; i < 3; i++) {
        const x = 35 + i * 23;
        const y = 63 - Math.sin(i * 0.9) * 12;
        ctx.beginPath();
        ctx.moveTo(x, y + 14);
        ctx.quadraticCurveTo(x + 7, y, x + 4, y - 13);
        ctx.stroke();
      }
    };
    if (look.halo) strokes(look.halo, 10);
    strokes('#fff3d5', 4);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    this.sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: texture, transparent: true, opacity: 0, depthWrite: false,
      // The bird can be half lost in grass; the echo of its call must clear those blades.
      depthTest: false, toneMapped: false,
    }));
    this.sprite.renderOrder = 5;
    this.sprite.visible = false;
    if (look.least) this.sprite.onBeforeRender = (_r, _s, camera) => this.atLeast(camera);
  }

  /** Grown to `least` of the view from this camera, and lifted with it so it never covers the animal. */
  private atLeast(camera: THREE.Camera): void {
    if (!(camera instanceof THREE.PerspectiveCamera)) return;
    const span = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * camera.position.distanceTo(this.from);
    const size = Math.max(this.size, this.look.least! * span);
    this.sprite.scale.setScalar(size);
    this.sprite.position.copy(this.from).setY(this.from.y + this.lift + (size - this.size) * 0.3);
    this.sprite.updateMatrixWorld();
  }

  hide(): void {
    this.strength = 0;
    this.sprite.visible = false;
    this.sprite.material.opacity = 0;
  }

  /** `scale` sizes the echo and its height to a smaller or larger animal than the look was made for. */
  update(dt: number, at: THREE.Vector3, call: number, scale = 1): void {
    const target = THREE.MathUtils.smoothstep(call, 0, 0.16);
    this.strength += (target - this.strength) * (1 - Math.exp(-dt * (target > this.strength ? 16 : 9)));
    this.sprite.visible = this.strength > 0.015;
    this.sprite.material.opacity = this.strength * 0.8;
    this.lift = (this.look.height + (1 - this.strength) * 0.12) * scale;
    this.size = this.look.size * scale;
    this.from.copy(at);
    this.sprite.position.copy(at).setY(at.y + this.lift);
    this.sprite.scale.setScalar(this.size);
  }
}
