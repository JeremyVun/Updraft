import * as THREE from 'three';
import { tuning } from '../tuning';
import { toyBoat, toyParts, toyWake } from './little-boats';
import { STAIRS_ISLE } from './stairs-layout';
import { swellAt, type Swell } from './water/swell';

interface FleetToy {
  group: THREE.Group;
  sail: THREE.ShaderMaterial;
  pivot: THREE.Group;
  wake: THREE.Mesh;
  /** How far behind the leader it sails, metres, how far to the side of the lane, and its own pace. */
  behind: number;
  side: number;
  pace: number;
  seed: number;
  /** Put out on the water only while the lens is looking elsewhere, so none is ever seen to appear. */
  out: boolean;
}

/**
 * The little boats' toys again, all seven, out on the sea below the stairs: they sail on by in a loose flotilla
 * west into the sun, the way the boat will take the travellers over the cloud, doing their own thing while the
 * child climbs the last of the stair below the cloud. Nobody turns to them and they never come near.
 */
export class StairsFleet {
  readonly group = new THREE.Group();
  /** Whether the chapter wants them out on the water; they sail only while it does. */
  shown = false;
  private readonly toys: FleetToy[] = [];
  private readonly swell: Swell = { height: 0, slopeX: 0, slopeZ: 0 };
  private sailed = 0;
  private readonly frustum = new THREE.Frustum();
  private readonly view = new THREE.Matrix4();
  private readonly hull = new THREE.Sphere();

  constructor() {
    this.group.name = 'stairs-fleet';
    this.group.visible = false;
    const k = tuning.stairs.fleet;
    const parts = toyParts();
    for (let i = 0; i < 7; i++) {
      const { group, sail, pivot } = toyBoat(i, parts);
      group.scale.setScalar(k.scale);
      const wake = toyWake();
      wake.scale.setScalar(k.scale);
      this.group.add(group, wake);
      this.toys.push({
        group, sail, pivot, wake,
        behind: k.order[i] * k.spacing,
        side: k.sides[i] * k.spread,
        pace: 1 + (k.order[i] % 3 - 1) * 0.06,
        seed: i * 1.7,
        out: false,
      });
    }
  }

  /** Back to where they set out from, none of them on the water yet. */
  setOff(): void {
    this.sailed = 0;
    for (const t of this.toys) t.out = false;
  }

  update(dt: number, time: number, camera: THREE.Camera): void {
    this.group.visible = this.shown;
    if (!this.shown) return;
    this.frustum.setFromProjectionMatrix(this.view.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
    const k = tuning.stairs.fleet;
    this.sailed += dt * k.speed;
    const lane = STAIRS_ISLE.z + k.lane;
    const lk = tuning.littleBoats;
    for (const t of this.toys) {
      const s = this.sailed * t.pace - t.behind;
      const x = STAIRS_ISLE.x + k.from - s;
      const z = lane + t.side + Math.sin(s * k.weaveRate + t.seed) * k.weave;
      const yaw = Math.atan2(-1, Math.cos(s * k.weaveRate + t.seed) * k.weave * k.weaveRate);
      swellAt(x, z, time, this.swell);
      const fill = THREE.MathUtils.clamp(k.fill + Math.sin(time * 0.37 + t.seed * 2.3) * 0.15, 0, 1);
      const across = k.across;
      const heel = across * fill * lk.heel;
      const y = this.swell.height + lk.toyDraft * k.scale + Math.sin(time * 2.1 + t.seed) * 0.03;
      t.group.position.set(x, y, z);
      this.hull.center.copy(t.group.position).y += 0.9 * k.scale;
      this.hull.radius = 1.1 * k.scale;
      t.out ||= !this.frustum.intersectsSphere(this.hull);
      t.group.visible = t.wake.visible = t.out;
      t.group.rotation.set(
        -this.swell.slopeX * Math.sin(yaw) - this.swell.slopeZ * Math.cos(yaw) + Math.sin(time * 1.6 + t.seed) * 0.035,
        yaw + Math.sin(time * 0.8 + t.seed) * 0.04,
        heel + this.swell.slopeX * Math.cos(yaw) - this.swell.slopeZ * Math.sin(yaw) + Math.sin(time * 1.9 + t.seed) * 0.045,
      );
      t.pivot.rotation.y = -across * fill * 0.85;
      const u = t.sail.uniforms;
      u.uFill.value = fill;
      u.uDroop.value = 1 - THREE.MathUtils.smoothstep(fill, 0.025, 0.65);
      u.uLuff.value = 0;
      u.uPhase.value = (u.uPhase.value + dt * (3 + fill * 7)) % (Math.PI * 2);
      t.wake.position.set(x - Math.sin(yaw) * 1.8 * k.scale, this.swell.height + 0.04, z - Math.cos(yaw) * 1.8 * k.scale);
      t.wake.rotation.y = yaw - Math.PI;
      (t.wake.material as THREE.ShaderMaterial).uniforms.uFill.value = k.foam;
    }
  }
}
