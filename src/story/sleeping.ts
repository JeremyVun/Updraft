import * as THREE from 'three';
import type { Shot } from '../camera';
import { heightAt } from '../world/island';
import { SLEEP_BERTH, SLEEP_LANDING } from '../world/sleeping';
import type { Cast, Chapter } from './cast';

type Beat = 'ashore' | 'toBed' | 'beside' | 'toBoat' | 'push' | 'aboard';

/** How long they stand by the bed before going back to the boat. */
const BESIDE_FOR = 25;
/** How far the frost has come in by the time they leave. */
const FROST_BY = 0.75;

/**
 * The sleeping island, before there is a story in it: they come ashore out of the dark wood, walk to the bed
 * made up in the hollow, stand by it long enough to look at the room, and go on. The feather, the bird's walk
 * up the hill, the glide back down and the waking are a later parcel; the world is already built for them.
 */
export class SleepingChapter implements Chapter {
  beat: Beat = 'ashore';
  readonly breeze = 0.35;
  /** The last of the living world goes out of it as they come up the beach, and comes back as they leave. */
  worldLife = 1;
  pace = 0.4;
  readonly haze = 0.82;
  readonly dusk = 1.9;
  readonly season = 0.85;
  readonly music = 'wood' as const;
  readonly hush = 0.5;
  readonly shot: Shot = { target: new THREE.Vector3(), distance: 16, height: 5, carry: true };
  readonly focus = new THREE.Vector3();
  private now = 0;
  private beatStart = 0;
  private moored = false;
  private readonly hand = new THREE.Vector3();
  private readonly seat = new THREE.Vector3();
  private readonly look = new THREE.Vector3();
  private readonly aim = new THREE.Vector3(-1, 0, 0);
  private readonly side = new THREE.Vector3();

  constructor(private readonly cast: Cast) {
    const { child, sleeping } = cast;
    child.dismount();
    sleeping.fog = 1;
    sleeping.frost = 0.15;
    sleeping.dawn = 0;
    sleeping.curtains = 0;
    sleeping.blanket = 0;
    child.walkTo(SLEEP_LANDING.x - 9, SLEEP_LANDING.y - 1, false, () => this.to('toBed'), 1.4);
  }

  /** Theirs for all of it except the two beats the story plays out on its own. */
  get scripted(): boolean {
    return this.beat === 'ashore' || this.beat === 'push' || this.beat === 'aboard';
  }

  get done(): boolean {
    return this.beat === 'aboard';
  }

  private to(beat: Beat): void {
    this.beat = beat;
    this.beatStart = this.now;
  }

  private get t(): number {
    return this.now - this.beatStart;
  }

  update(dt: number, time: number): void {
    this.now = time;
    const { child: c, plane: p, sleeping } = this.cast;

    switch (this.beat) {
      case 'ashore':
        c.lookAt = this.look.copy(sleeping.bedside);
        break;
      case 'toBed':
        /** The boat goes round to the far shore while they are walking away from it, as it always does. */
        if (!this.moored && this.t > 2) {
          this.moored = true;
          this.cast.boat.beach(SLEEP_BERTH.x, SLEEP_BERTH.z, -1.76);
          this.cast.boat.grounded = true;
        }
        c.lookAt = this.look.copy(sleeping.bedside);
        if (!c.busy && !c.moving) c.walkTo(sleeping.bedside.x, sleeping.bedside.z, false, () => this.to('beside'), 1.1);
        break;
      case 'beside':
        c.lookAt = this.look.copy(sleeping.bedside).setY(sleeping.bedside.y + 0.6);
        sleeping.frost = 0.15 + (FROST_BY - 0.15) * Math.min(1, this.t / BESIDE_FOR);
        if (this.t > BESIDE_FOR) this.board();
        break;
      case 'push':
        if (this.t > 0.9 && !this.cast.boat.afloat) this.cast.boat.launch();
        if (this.t > 2.3) {
          this.to('aboard');
          c.ride(this.cast.boat.seat(this.seat), this.cast.boat.yaw);
        }
        break;
      default:
        break;
    }

    /** The colour goes out of the world while they are on the island, and is on its way back as they leave. */
    const cold = this.beat === 'ashore' || this.beat === 'toBed' || this.beat === 'beside';
    this.worldLife += ((cold ? 0 : 1) - this.worldLife) * (1 - Math.exp(-dt * 0.35));
    if (p.held) p.hold(c.handPosition(this.hand), c.yaw);
    this.heading(dt);
    this.frame();
  }

  private board(): void {
    const { child: c, boat } = this.cast;
    this.to('toBoat');
    c.lookAt = null;
    c.walkTo(boat.position.x + 1.8, boat.position.z + 0.9, false, () => {
      this.to('push');
      c.faceToward(boat.position.x, boat.position.z, 1);
      c.push();
    }, 0.8);
  }

  /** Where the walk is pointing, eased, so the camera swings round with them instead of snapping. */
  private heading(dt: number): void {
    const c = this.cast.child.position;
    const to = this.beat === 'toBoat' || this.beat === 'push' ? this.cast.boat.position : this.cast.sleeping.bedside;
    this.side.set(to.x - c.x, 0, to.z - c.z);
    if (this.side.lengthSq() < 1) return;
    this.aim.lerp(this.side.normalize(), 1 - Math.exp(-dt * 0.6));
    if (this.aim.lengthSq() > 0.01) this.aim.normalize();
  }

  private frame(): void {
    const c = this.cast.child.position;
    const s = this.shot;
    const ground = Math.max(heightAt(c.x, c.z), 0);
    if (this.beat === 'push' || this.beat === 'aboard') {
      const b = this.cast.boat.position;
      s.eye = undefined;
      s.target.set((c.x + b.x) / 2, b.y + 2, (c.z + b.z) / 2);
      s.distance = 20;
      s.height = 6;
      this.focus.copy(b);
      return;
    }
    s.target.set(c.x + this.aim.x * 2.2, ground + 1.5, c.z + this.aim.z * 2.2);
    /** The hollow is a bowl, so the eye is kept low against the child rather than a fixed height above the slope. */
    const ex = c.x - this.aim.x * 9 - this.aim.z * 1.4;
    const ez = c.z - this.aim.z * 9 + this.aim.x * 1.4;
    s.eye = this.side.set(ex, Math.max(Math.max(heightAt(ex, ez), 0) + 1.1, ground + 2.6), ez);
    this.focus.copy(c);
  }
}
