import * as THREE from 'three';
import type { WindField } from '../wind/field';
import { REFLECTION_LAYER } from '../world/water/reflection';
import { Dolphins } from './sealife/dolphin';
import { Fish } from './sealife/fish';
import { FOAM, RING, Marks } from './sealife/marks';
import { Spray } from './sealife/spray';
import { WhaleWake, type WhaleSound } from './sealife/wake';
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
  private readonly pod: Dolphins;
  private swimMark = 0;
  private readonly seen = new THREE.Vector3();

  constructor(wind: WindField, camera: THREE.PerspectiveCamera) {
    this.spray = new Spray(wind);
    this.pod = new Dolphins(camera);
    this.wake = new WhaleWake(this.body, this.spray, this.foam, this.slicks);
    this.fish = new Fish(camera, this.spray, this.foam);
    this.slicks.mesh.renderOrder = 2;
    this.foam.mesh.renderOrder = 3;
    this.objects = [this.body.mesh, this.body.ghost, this.fish.mesh, this.slicks.mesh, this.foam.mesh, this.spray.mesh, ...this.pod.objects];
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

  /**
   * Keeps a pod of dolphins running with a boat at `near` on bearing `heading`; null sends them away. `camera` is
   * which side of the stern the camera rides on, so their set-pieces play on screen; `busy` holds those off, and
   * none begins until `ready`.
   */
  dolphinsWith(near: THREE.Vector3 | null, heading: number, camera = 1, busy = false, ready = true): void {
    this.pod.run(near, heading, camera, busy, ready);
  }

  /** What to do when a dolphin shoulders the boat: the story hands the shove to the hull. */
  set onDolphinShove(fn: (side: number, strength: number) => void) {
    this.pod.onShove = fn;
  }

  set onDolphinSplash(fn: (x: number, y: number, z: number, strength: number) => void) {
    this.pod.onSplash = fn;
  }

  set onDolphinSurface(fn: (x: number, y: number, z: number, strength: number) => void) {
    this.pod.onSurface = fn;
  }

  set onWhaleSound(fn: (kind: WhaleSound, x: number, y: number, z: number) => void) {
    this.wake.onSound = fn;
  }

  /** Where a dolphin is playing to the boat, for the child to look at; null when they are only running alongside. */
  resumeDolphinsAfterSwim(): void { this.pod.resumeAfterSwim(); }

  get dolphinLeapComplete(): boolean { return this.pod.leapComplete; }
  get dolphinFarewellReady(): boolean { return this.pod.farewellReady; }

  get dolphinShow(): THREE.Vector3 | null {
    return this.pod.spotlight;
  }

  /** The small, persistent V behind the cygnet, carried by the same surface as every other wake. */
  swimmerNear(at: THREE.Vector3, time: number): void {
    if (time < this.swimMark) return;
    this.swimMark = time + 0.28;
    this.foam.add(RING, at.x, at.z, 0.18, 2.2, time, 0.65, 0.4);
    this.foam.add(FOAM, at.x, at.z, 0.2, 1.5, time, 0.45, 0.12);
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
    this.pod.update(dt, time);
    this.spray.update(dt);
  }
}
