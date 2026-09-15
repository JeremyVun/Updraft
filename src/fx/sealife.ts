import * as THREE from 'three';
import type { WindField } from '../wind/field';
import { REFLECTION_LAYER } from '../world/water/reflection';
import { Fish } from './sealife/fish';
import { Marks } from './sealife/marks';
import { Spray } from './sealife/spray';
import { WhaleWake } from './sealife/wake';
import { Whale } from './sealife/whale';

/** Life in the open sea on the crossing: a humpback that surfaces now and then, and small fish leaping near the boat. */
export class SeaLife {
  readonly objects: THREE.Object3D[];
  private readonly body = new Whale();
  private readonly spray: Spray;
  private readonly foam = new Marks();
  private readonly slicks = new Marks();
  private readonly wake: WhaleWake;
  private readonly fish: Fish;
  private readonly seen = new THREE.Vector3();

  constructor(wind: WindField, camera: THREE.Camera) {
    this.spray = new Spray(wind);
    this.wake = new WhaleWake(this.body, this.spray, this.foam, this.slicks);
    this.fish = new Fish(camera, this.spray, this.foam);
    this.slicks.mesh.renderOrder = 2;
    this.foam.mesh.renderOrder = 3;
    this.objects = [this.body.mesh, this.body.ghost, this.fish.mesh, this.slicks.mesh, this.foam.mesh, this.spray.mesh];
    for (const o of [this.body.mesh, this.fish.mesh, this.spray.mesh]) o.layers.enable(REFLECTION_LAYER);
  }

  /** Starts one whale surfacing: it rises at `at` travelling along `heading` (yaw, radians; 0 = +z). */
  surfaceWhale(at: THREE.Vector3, heading: number): void {
    this.body.start(at, heading);
    this.wake.reset();
  }

  /** Where the whale is, for the child to look at; null when it is under water and out of sight. */
  get whale(): THREE.Vector3 | null {
    const t = this.body.time;
    if (t < 1.5 || t > 25.5) return null;
    if (t > 19) return this.body.point(0, 0, 1, this.seen);
    this.body.point(0, 1, 0.45, this.seen);
    this.seen.y = Math.max(this.seen.y, 0.3);
    return this.seen;
  }

  /** How often fish leap around `near` (0 none .. 1 lively); the story sets this each frame. */
  fishNear(near: THREE.Vector3 | null, liveliness: number): void {
    this.fish.setNear(near, liveliness);
  }

  update(dt: number, time: number): void {
    this.body.update(dt);
    this.wake.update(dt, time);
    this.foam.update(time);
    this.slicks.update(time);
    this.fish.update(dt, time);
    this.spray.update(dt);
  }
}
