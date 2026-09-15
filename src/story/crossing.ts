import * as THREE from 'three';
import type { Shot } from '../camera';
import type { Cast, Chapter } from './cast';

/** The beach below the green cliffs where the boat comes ashore. */
export const LANDING = new THREE.Vector2(10, -700);

/** The restored island, as the child looks back at it. */
const ISLAND = new THREE.Vector3(-8, 9, -18);
/** How long the child sits facing the island, waving, before turning to the way ahead. */
const FAREWELL = 26;
/** How long the rainbow lingers over the island once the boat sets out. */
const RAINBOW_FOR = 70;
/** How long the camera takes to swing round from the farewell to behind the sail. */
const SWING = 9;
/** The camera's usual bearing, from the default shot: behind the boat, looking north. */
const SAIL_BEARING = Math.atan2(0.075, 1);

/**
 * The crossing. The child sits facing the island they brought back to life and waves goodbye while a rainbow
 * comes down on it; then turns to the way ahead, and the camera swings round behind the sail. The player fills the
 * sail; the gulls come along for a while. Ends when the boat runs up the mainland beach.
 */
export class CrossingChapter implements Chapter {
  readonly breeze = 1;
  readonly worldLife = 1;
  pace = 0.4;
  readonly dusk = 0;
  rainbow = 0;
  readonly shot: Shot = { target: new THREE.Vector3(), distance: 24, height: 6.5, carry: true };
  readonly focus = new THREE.Vector3();
  readonly escort = new THREE.Vector3();
  private readonly seat = new THREE.Vector3();
  private readonly hand = new THREE.Vector3();
  private readonly ahead = new THREE.Vector3();
  private readonly from = new THREE.Vector3();
  private time = 0;
  private facingBack = 1;
  private nextWave = 3.5;

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
    const farewell = this.time < FAREWELL;
    this.facingBack = farewell ? 1 : Math.max(0, this.facingBack - dt / 1.6);
    const turn = this.facingBack * this.facingBack * (3 - 2 * this.facingBack);
    child.ride(boat.seat(this.seat), boat.yaw + Math.PI * turn);
    plane.hold(child.handPosition(this.hand), child.yaw);

    if (farewell) {
      child.lookAt = ISLAND;
      if (this.time > this.nextWave) {
        child.wave();
        this.nextWave = this.time + 5 + Math.random() * 3;
      }
    } else {
      const look = Math.sin(this.time * 0.13) * 30;
      this.ahead.set(boat.position.x + look, 12, boat.position.z - 200);
      child.lookAt = this.ahead;
    }

    const wanted = this.time < RAINBOW_FOR ? 1 : 0;
    this.rainbow += (wanted - this.rainbow) * (1 - Math.exp(-dt * (wanted > this.rainbow ? 0.3 : 0.06)));

    const fx = Math.sin(boat.yaw);
    const fz = Math.cos(boat.yaw);
    const back = Math.atan2(ISLAND.x - boat.position.x, ISLAND.z - boat.position.z);
    const swing = THREE.MathUtils.smootherstep(this.time, FAREWELL, FAREWELL + SWING);
    const farewellBearing = back + Math.PI + 0.55;
    const bearing = farewellBearing + Math.atan2(Math.sin(SAIL_BEARING - farewellBearing), Math.cos(SAIL_BEARING - farewellBearing)) * swing;
    this.shot.from = swing < 1 ? this.from.set(Math.sin(bearing), 0, Math.cos(bearing)) : undefined;
    const tx = THREE.MathUtils.lerp(boat.position.x + Math.sin(back) * 6, boat.position.x + fx * 7, swing);
    const tz = THREE.MathUtils.lerp(boat.position.z + Math.cos(back) * 6, boat.position.z + fz * 7, swing);
    this.shot.target.set(tx, THREE.MathUtils.lerp(3, 2.8, swing), tz);
    this.shot.distance = THREE.MathUtils.lerp(21, 24, swing);
    this.shot.height = THREE.MathUtils.lerp(2.5, 6.5, swing);
    this.pace = farewell ? 0.4 : swing < 1 ? 1.2 : 0.4;
    this.focus.copy(boat.position);
    this.escort.set(boat.position.x, 0, boat.position.z);
  }
}
