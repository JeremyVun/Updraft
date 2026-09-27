import * as THREE from 'three';
import { puffGeometry, puffMaterial, type Puff } from './stairs-puffs';

interface Spray { p: THREE.Vector3; v: THREE.Vector3; r: number; grow: number; age: number; life: number }

const POOL = 56;

/** The cloud the hull throws up as it goes: puffs off the bow and the quarters that roll outward, rise a little and thin away. */
export class CloudWake {
  readonly mesh: THREE.Mesh;
  private readonly spray: Spray[] = [];
  private readonly centres: THREE.BufferAttribute;
  private readonly alphas: THREE.BufferAttribute;
  private readonly radii: THREE.BufferAttribute;
  private next = 0;
  private owed = 0;
  private seed = 7;

  constructor() {
    const puffs: Puff[] = [];
    for (let i = 0; i < POOL; i++) {
      this.spray.push({ p: new THREE.Vector3(), v: new THREE.Vector3(), r: 0.3, grow: 0, age: 1, life: 1 });
      puffs.push({ x: 0, y: -1e4, z: 0, r: 0.3, a: 0 });
    }
    const geo = puffGeometry(puffs);
    this.centres = geo.getAttribute('aCentre') as THREE.BufferAttribute;
    this.alphas = geo.getAttribute('aAlpha') as THREE.BufferAttribute;
    this.radii = geo.getAttribute('aRadius') as THREE.BufferAttribute;
    for (const a of [this.centres, this.alphas, this.radii]) a.setUsage(THREE.DynamicDrawUsage);
    this.mesh = new THREE.Mesh(geo, puffMaterial());
    this.mesh.name = 'cloud-wake';
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 6;
    this.mesh.visible = false;
  }

  private random(): number {
    this.seed = (this.seed * 16807) % 2147483647;
    return (this.seed - 1) / 2147483646;
  }

  emit(hull: { position: THREE.Vector3; yaw: number; speed: number } | null, dt: number): void {
    if (!hull || hull.speed < 0.3) return;
    this.owed += dt * hull.speed * 3.2;
    const fx = Math.sin(hull.yaw), fz = Math.cos(hull.yaw);
    while (this.owed >= 1) {
      this.owed -= 1;
      const s = this.spray[this.next];
      this.next = (this.next + 1) % POOL;
      const r = () => this.random();
      const side = r() < 0.5 ? -1 : 1;
      // Mostly off the quarters, some from the bow as it shoulders the cloud aside.
      const bow = r() < 0.3;
      const along = bow ? 2.1 : -1.6 - r() * 0.8;
      const out = 0.45 + r() * 0.2;
      s.p.set(hull.position.x + fx * along + fz * side * out, hull.position.y + 0.05 + r() * 0.15, hull.position.z + fz * along - fx * side * out);
      const spread = (bow ? 1.1 : 0.7) + r() * 0.5;
      s.v.set(fz * side * spread - fx * hull.speed * 0.25, 0.18 + r() * 0.2, -fx * side * spread - fz * hull.speed * 0.25);
      s.r = 0.35 + r() * 0.2;
      s.grow = 0.35 + r() * 0.25;
      s.age = 0;
      s.life = 2.2 + r() * 1.4;
    }
  }

  update(dt: number): void {
    let alive = false;
    this.spray.forEach((s, i) => {
      s.age += dt;
      const k = s.age / s.life;
      const a = k >= 1 ? 0 : Math.min(1, s.age / 0.25) * Math.pow(1 - k, 1.3) * 0.6;
      if (a > 0) {
        alive = true;
        s.v.multiplyScalar(Math.exp(-dt * 1.2));
        s.p.addScaledVector(s.v, dt);
      }
      for (let c = 0; c < 4; c++) {
        this.centres.setXYZ(i * 4 + c, s.p.x, s.p.y, s.p.z);
        this.alphas.setX(i * 4 + c, a);
        this.radii.setX(i * 4 + c, s.r + s.grow * s.age);
      }
    });
    this.mesh.visible = alive;
    this.centres.needsUpdate = this.alphas.needsUpdate = this.radii.needsUpdate = true;
  }
}
