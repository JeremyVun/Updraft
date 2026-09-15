import * as THREE from 'three';
import type { Shot } from '../camera';
import type { Cast, Chapter } from './cast';

/** The beach below the green cliffs where the boat comes ashore. */
export const LANDING = new THREE.Vector2(10, -700);

/**
 * The crossing. The player fills the sail; the child rides, holding the plane, watching the grey hills rise out
 * of the haze ahead. Ends when the boat runs up the mainland beach.
 */
export class CrossingChapter implements Chapter {
  readonly breeze = 1;
  readonly worldLife = 1;
  readonly pace = 0.4;
  readonly dusk = 0;
  readonly shot: Shot = { target: new THREE.Vector3(), distance: 24, height: 6.5 };
  readonly focus = new THREE.Vector3();
  private readonly seat = new THREE.Vector3();
  private readonly hand = new THREE.Vector3();
  private readonly ahead = new THREE.Vector3();
  private time = 0;

  constructor(private readonly cast: Cast) {
    cast.boat.steerFor = LANDING.clone();
    cast.plane.homeRadius = 1e9;
  }

  get done(): boolean {
    return this.cast.boat.grounded;
  }

  update(dt: number): void {
    this.time += dt;
    const { child, boat, plane } = this.cast;
    child.ride(boat.seat(this.seat), boat.yaw);
    plane.hold(child.handPosition(this.hand), child.yaw);
    const look = Math.sin(this.time * 0.13) * 30;
    this.ahead.set(boat.position.x + look, 12, boat.position.z - 200);
    child.lookAt = this.ahead;

    const fx = Math.sin(boat.yaw);
    const fz = Math.cos(boat.yaw);
    this.shot.target.set(boat.position.x + fx * 7, 2.8, boat.position.z + fz * 7);
    this.focus.copy(boat.position);
  }
}
