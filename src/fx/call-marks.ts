import * as THREE from 'three';
import { tuning } from '../tuning';

/** A small visual echo of the cygnet's voice, following it on the ground, in flight or in the child's arms. */
export class CallMarks {
  readonly sprite: THREE.Sprite;
  private strength = 0;

  constructor() {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 128;
    const ctx = canvas.getContext('2d')!;
    ctx.strokeStyle = '#fff3d5';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
      const x = 35 + i * 23;
      const y = 63 - Math.sin(i * 0.9) * 12;
      ctx.beginPath();
      ctx.moveTo(x, y + 14);
      ctx.quadraticCurveTo(x + 7, y, x + 4, y - 13);
      ctx.stroke();
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    this.sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: texture, transparent: true, opacity: 0, depthWrite: false,
      // The bird can be half lost in grass; the echo of its call must clear those blades.
      depthTest: false, toneMapped: false,
    }));
    this.sprite.renderOrder = 5;
    this.sprite.visible = false;
  }

  hide(): void {
    this.strength = 0;
    this.sprite.visible = false;
    this.sprite.material.opacity = 0;
  }

  update(dt: number, at: THREE.Vector3, call: number): void {
    const target = THREE.MathUtils.smoothstep(call, 0, 0.16);
    this.strength += (target - this.strength) * (1 - Math.exp(-dt * (target > this.strength ? 16 : 9)));
    this.sprite.visible = this.strength > 0.015;
    this.sprite.material.opacity = this.strength * 0.8;
    this.sprite.position.copy(at).setY(at.y + tuning.cygnetCalls.height + (1 - this.strength) * 0.12);
    this.sprite.scale.setScalar(tuning.cygnetCalls.size);
  }
}
