import * as THREE from 'three';
import type { Shot } from '../camera';
import type { Deck } from '../world/decks';
import { heightAt } from '../world/island';
import { REFLECTION_LAYER } from '../world/water/reflection';
import { tuning } from '../tuning';
import { MillCrossing, type MillEvent } from '../world/crossings/mill-crossing';
import { SAIL } from '../world/crossings/windmill';
import type { MaterialSound } from '../audio/foley';
import { COURSED, PLAIN, STONE, WALL, drownedHouse, ridgeOf, yardMesh, type Roof } from './crossings-yard';
import type { Cast } from './cast';

/**
 * The yard, in the mill's own frame: x to the right seen from in front of the sails, z out toward the front, the
 * water at 0, the hub above the origin. Her wall runs just in front of the sails' plane on the boarding side, its
 * top where the boarding sail's rail lies as it dwells; the high house stands beyond the rail's tip with its gable
 * end to the mill and its ridge in line with the rail, at the height of the tip as the sail dwells at the top.
 */
const HUB_Y = 4.6;
/** Out along the boarding sail at an angle above level, onto the top of its rail: where her feet go, in the yard. */
function railTop(angle: number, along: number): THREE.Vector3 {
  const across = -SAIL.width + SAIL.rail / 2;
  return new THREE.Vector3(-along * Math.cos(angle) + across * Math.sin(angle), HUB_Y + along * Math.sin(angle) + across * Math.cos(angle), SAIL.forward);
}
const K = tuning.crossings.mill;
const BOARD = railTop(K.board, K.stand);
const TIP = railTop(K.top, SAIL.to);
const WALL_Z = 1.02;
const WALL_TOP = BOARD.y;
const HIGH: Roof = (() => {
  const len = 9, wall = 3.4, rise = 3.1;
  const x = -4.3 - 0.2 - len / 2;
  return { x, z: SAIL.forward, len, depth: 5.6, wall, rise, sink: wall + rise + 0.04 - TIP.y, stacks: [-1] };
})();
const RIDGE = ridgeOf(HIGH);
const GABLE = HIGH.x + HIGH.len / 2;
const WALL_FROM = GABLE;
const WALL_TO = -0.6;
const STEP_OFF = new THREE.Vector3(GABLE - 0.4, RIDGE, SAIL.forward);
const ONWARD = new THREE.Vector3(GABLE - 3, RIDGE, SAIL.forward);
const KITTEN = new THREE.Vector3(GABLE - 5.2, RIDGE + 0.06, SAIL.forward);

const WAY = {
  wall: { x0: WALL_TO, z0: WALL_Z, x1: WALL_FROM + 0.4, z1: WALL_Z, halfWidth: 0.3, height: WALL_TOP },
  ridge: { x0: TIP.x - 0.04, z0: SAIL.forward, x1: HIGH.x - HIGH.len / 2 + 1.2, z1: SAIL.forward, halfWidth: 0.4, height: RIDGE },
} satisfies Record<string, Deck>;

/** The mill's own voice: the dry axle as it starts, wood working through the turn, the brake as it settles, the linen. */
const MILL_SOUNDS = { start: 'mill-start', creak: 'mill-creak', settle: 'mill-settle', flap: 'linen-flap' } as const satisfies Record<MillEvent, MaterialSound>;

/**
 * QA only: the drowned village's middle crossing set out on the sea off the QA stage, playable on its own
 * (`?chapter=stage&gap=mill`, or `play('crossing:mill')`). Low dusk light, the air dead, the lens low and beside her.
 */
export class MillYard {
  readonly group = new THREE.Group();
  readonly crossing: MillCrossing;
  readonly decks: Deck[] = Object.values(WAY).map((d) => ({ ...d }));
  playing = false;
  private readonly origin = new THREE.Vector3();
  private readonly facing: number;
  private readonly local = new THREE.Vector3();
  private readonly eye = new THREE.Vector3();
  private readonly target = new THREE.Vector3();

  constructor(private readonly cast: Cast, near: THREE.Vector3, facing = Math.PI / 2) {
    this.facing = facing;
    this.origin.copy(this.findWater(near));
    this.group.position.copy(this.origin);
    this.group.rotation.y = facing;
    this.group.updateMatrixWorld(true);
    for (const d of this.decks) {
      const a = this.at(new THREE.Vector3(d.x0, 0, d.z0)), b = this.at(new THREE.Vector3(d.x1, 0, d.z1));
      d.x0 = a.x; d.z0 = a.z; d.x1 = b.x; d.z1 = b.z;
    }
    const crossingCast = { child: cast.child, wind: cast.wind, lines: cast.lines, input: cast.input };
    this.crossing = new MillCrossing({ hub: this.at(new THREE.Vector3(0, HUB_Y, 0)), facing }, {
      wait: this.at(new THREE.Vector3(BOARD.x + 1.1, WALL_TOP, WALL_Z)),
      stepOff: this.at(STEP_OFF.clone()),
      onward: this.at(ONWARD.clone()),
    }, crossingCast);
    this.crossing.onEvent = (kind, where, strength) => cast.knock?.(MILL_SOUNDS[kind], where, strength);
    const scenery = this.build();
    scenery.layers.enable(REFLECTION_LAYER);
    this.group.add(scenery);
  }

  get objects(): THREE.Object3D[] {
    return [this.group, ...this.crossing.objects];
  }

  /** For the capture tools: where everything has got to. */
  get state(): Record<string, unknown> {
    const m = this.crossing.mill, c = this.cast.child;
    return {
      playing: this.playing, phase: this.crossing.phase,
      angle: +m.angle.toFixed(4), sail: +m.sail.toFixed(4), speed: +m.speed.toFixed(4), rock: +m.rock.toFixed(4),
      drive: +m.drive.toFixed(3), dwelling: m.dwelling, aboard: m.aboard, hold: m.hold, quiet: +Math.min(999, m.quiet).toFixed(2),
      inviting: this.crossing.inviting, valving: this.crossing.valving,
      child: c.position.toArray().map((v) => +v.toFixed(3)), yaw: +c.yaw.toFixed(3),
    };
  }

  play(): void {
    const c = this.cast.child;
    this.playing = true;
    this.crossing.reset();
    this.decks.length = Object.keys(WAY).length;
    c.decks = this.decks;
    c.dismount();
    c.stop();
    c.balance = 0;
    c.lean = 0;
    c.stroll = 1;
    c.lookAt = null;
    c.reachFor(0, null);
    c.reachFor(1, null);
    c.standUp();
    const wait = this.crossing.way.wait;
    c.place(wait.x, wait.z, this.facing + Math.PI - 0.5);
    c.stowPlane(true, true);
    const k = this.cast.cygnet;
    k.visible = true;
    k.rideIn('satchel');
    const cat = this.cast.cat;
    cat.visible = true;
    cat.place(this.at(KITTEN.clone()), this.facing - Math.PI / 2 + 0.35, { pose: 'sit' });
    cat.look(c.position);
    this.crossing.begin();
  }

  stop(): void {
    this.playing = false;
    this.crossing.reset();
    this.cast.child.decks = [];
    this.cast.child.reachFor(1, null);
  }

  update(dt: number, camera: THREE.PerspectiveCamera | null): void {
    if (!camera || !this.playing) return;
    this.crossing.update(dt, camera);
  }

  /**
   * Low and in front of the sails, a little to her side, looking past her at the mill with the high roof beyond;
   * it rises with her only enough to show the water below, and follows her along the ridge so the mill leaves the
   * frame. On an upright screen it stands further back so the climb stacks up the frame.
   */
  frame(shot: Shot): number {
    const upright = window.innerWidth / window.innerHeight < 0.9;
    const p = this.toYard(this.cast.child.position, this.local);
    shot.free = false;
    shot.from = undefined;
    shot.fitWidth = false;
    shot.subjects = undefined;
    const rise = THREE.MathUtils.clamp((p.y - WALL_TOP) / (RIDGE - WALL_TOP), 0, 1);
    const x = Math.min(p.x, BOARD.x);
    if (upright) {
      this.eye.set(x + 3, 1.6 + 0.75 * p.y, 19);
      this.target.set(x - 0.4, p.y + 1.6, 0);
    } else {
      this.eye.set(x - 2.6, 1.9 + 0.72 * p.y, 12.5 - rise);
      this.target.set(x + 0.9, 1.0 + 0.8 * p.y, 0);
    }
    this.at(this.eye);
    this.at(this.target);
    shot.eye = (shot.eye ?? new THREE.Vector3()).copy(this.eye);
    shot.target.copy(this.target);
    shot.distance = this.eye.distanceTo(this.target);
    shot.height = this.eye.y - this.target.y;
    return 0.7;
  }

  /** A point in the yard's frame, into the world, in place. */
  private at(p: THREE.Vector3): THREE.Vector3 {
    return p.applyMatrix4(this.group.matrixWorld);
  }

  private toYard(world: THREE.Vector3, out: THREE.Vector3): THREE.Vector3 {
    return this.group.worldToLocal(out.copy(world));
  }

  /** Out from `near` until the whole yard is over open water. */
  private findWater(near: THREE.Vector3): THREE.Vector3 {
    const wet = (x: number, z: number) => {
      for (let dx = -14; dx <= 14; dx += 2) {
        for (let dz = -14; dz <= 14; dz += 2) if (heightAt(x + dx, z + dz) > -2.5) return false;
      }
      return true;
    };
    for (let reach = 40; reach < 600; reach += 4) {
      for (const [x, z] of [[near.x + 40, near.z + reach], [near.x - 50, near.z + reach]]) if (wet(x, z)) return new THREE.Vector3(x, 0, z);
    }
    return new THREE.Vector3(near.x + 40, 0, near.z + 120);
  }

  private build(): THREE.Mesh {
    return yardMesh((add) => {
      drownedHouse(HIGH, add);
      const len = WALL_TO - WALL_FROM;
      const m = new THREE.Matrix4().makeTranslation((WALL_FROM + WALL_TO) / 2, 0, WALL_Z);
      add(new THREE.BoxGeometry(len, WALL_TOP + 3.9, 0.5).translate(0, (WALL_TOP - 4.1) / 2, 0), WALL, COURSED, m);
      add(new THREE.BoxGeometry(len + 0.12, 0.16, 0.62).translate(0, WALL_TOP - 0.07, 0), STONE, PLAIN, m);
    });
  }
}
