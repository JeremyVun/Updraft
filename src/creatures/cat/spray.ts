import * as THREE from 'three';

const DROPS = 400;
const GRAVITY = 9.8;
const GONE = -1e4;

/** The water a wet cat throws off as it shakes: drops flung out from its coat that fall away and are gone. */
export class Spray {
  readonly points: THREE.Points;
  private readonly at = new Float32Array(DROPS * 3).fill(GONE);
  private readonly vel = new Float32Array(DROPS * 3);
  private readonly life = new Float32Array(DROPS);
  private readonly attr = new THREE.BufferAttribute(this.at, 3);
  private next = 0;
  private live = 0;

  /** `size` is as three.js sizes a point: pixels at a metre for every half of the screen's height. */
  constructor(size: number) {
    this.attr.setUsage(THREE.DynamicDrawUsage);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', this.attr);
    const mat = new THREE.PointsMaterial({ color: new THREE.Color(0.85, 0.9, 0.95), size, transparent: true, opacity: 0.9, depthWrite: false });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
  }

  /** One drop leaving the coat at `from`, flung off at `velocity` metres a second. */
  fling(from: THREE.Vector3, velocity: THREE.Vector3): void {
    const i = this.next;
    this.next = (this.next + 1) % DROPS;
    this.at.set([from.x, from.y, from.z], i * 3);
    this.vel.set([velocity.x, velocity.y, velocity.z], i * 3);
    this.life[i] = 0.45 + Math.random() * 0.25;
    this.live = 1;
  }

  update(dt: number): void {
    if (!this.live) return;
    let any = 0;
    for (let i = 0; i < DROPS; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      const j = i * 3;
      this.vel[j + 1] -= GRAVITY * dt;
      this.at[j] += this.vel[j] * dt;
      this.at[j + 1] += this.vel[j + 1] * dt;
      this.at[j + 2] += this.vel[j + 2] * dt;
      if (this.life[i] <= 0) this.at[j + 1] = GONE;
      else any = 1;
    }
    this.live = any;
    this.attr.needsUpdate = true;
  }
}
