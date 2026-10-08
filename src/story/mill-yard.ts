import * as THREE from 'three';
import type { Shot } from '../camera';
import type { Deck } from '../world/decks';
import { heightAt } from '../world/island';
import { REFLECTION_LAYER } from '../world/water/reflection';
import { tuning } from '../tuning';
import { MILL_SOUNDS, MillCrossing } from '../world/crossings/mill-crossing';
import { HOIST, HUB_ABOVE } from '../world/crossings/windmill';
import { drownedHouse, ridgeOf, ridgeStack, yardMesh, type AddPart, type Roof } from './crossings-yard';
import { playCatSteps, type CatSteps } from './cat-steps';
import type { Cast } from './cast';

/**
 * The yard, in the mill's own frame: x to the right seen from in front of the sails, z out of their front, the water
 * at 0, the hub above the origin. Her roof runs in from the front past the sails' plane, under their sweep, its ridge
 * ending at the basket hanging on the hoist's rope; behind the basket stands the old granary, its gable end to her and
 * its ridge level with the top of the hoist. Both houses are laid with their ridges along z.
 */
const FROM = 3.0;
const TO = 8.2;
const HUB_Y = TO + HUB_ABOVE;
const LOW: Roof = { x: -2.9, z: HOIST.x, len: 8.2, depth: 4.2, wall: 3.4, rise: 2.4, sink: 3.4 + 2.4 + 0.04 - FROM, stacks: [] };
const HIGH: Roof = { x: 6.9, z: HOIST.x, len: 8.45, depth: 3.6, wall: 7.4, rise: 2.6, sink: 7.4 + 2.6 + 0.04 - TO, stacks: [] };
/** Her roof's chimney just in front of the sails' plane, under the low sail's end: the cat's way onto it. */
const STACK_AT = -0.45;
const WAIT = new THREE.Vector3(HOIST.x, FROM, -0.85);
const STEP_OFF = new THREE.Vector3(HOIST.x, TO, -3.0);
const ONWARD = new THREE.Vector3(HOIST.x, TO, -5.6);
const ALONG_Z = new THREE.Matrix4().makeRotationY(Math.PI / 2);
/**
 * The lens, wide and upright: which way it looks from (level, in the mill's frame), how far off at the start and how
 * much closer at the top, where it looks (across, and up from her roof at the start and how much higher at the top),
 * and its own height. It rises less than she does, so she climbs up the frame.
 */
const FRAMES = {
  wide: { dir: new THREE.Vector2(-0.7, 0.72).normalize(), far: 19, closer: 3, x: -2.4, low: 4.6, rise: 1.4, eye: 2.6, eyeRise: 1.4 },
  upright: { dir: new THREE.Vector2(-0.62, 0.78).normalize(), far: 12.5, closer: 2, x: -1.3, low: 5.0, rise: 2.4, eye: 2.0, eyeRise: 3.4 },
};
/** Once she is off, the lens comes round after her along the high ridge. */
const ON = new THREE.Vector3(-0.8, 0, -3.0);

const WAY = {
  low: { x0: HOIST.x, z0: 6.5, x1: HOIST.x, z1: -1.05, halfWidth: 0.4, height: ridgeOf(LOW) },
  high: { x0: HOIST.x, z0: -2.62, x1: HOIST.x, z1: -10, halfWidth: 0.4, height: ridgeOf(HIGH) },
} satisfies Record<string, Deck>;

/**
 * QA only: the drowned village's circles crossing, the mill's sack hoist, set out on the sea off the QA stage and
 * playable on its own (`?chapter=stage&gap=mill`, `&catless` for no cat, or `play('crossing:mill')`). Low dusk light,
 * the air dead. The cat goes first, up a sail and onto the cap.
 */
export class MillYard {
  readonly group = new THREE.Group();
  readonly crossing: MillCrossing;
  readonly decks: Deck[] = Object.values(WAY).map((d) => ({ ...d }));
  playing = false;
  /** QA: the lens on the mill itself, from in front and to the hoist's side, or close on her in the basket. */
  closeUp: 'mill' | 'her' | null = null;
  catless = false;
  private cat: CatSteps | null = null;
  private catClock = 0;
  private readonly facing: number;
  private readonly local = new THREE.Vector3();
  private readonly eye = new THREE.Vector3();
  private readonly target = new THREE.Vector3();
  private readonly stackTop: THREE.Vector3;
  /** 0 while she waits and rides, easing to 1 once she is off the basket, as the lens turns to the way ahead. */
  private away = 0;

  constructor(private readonly cast: Cast, near: THREE.Vector3, facing = 2.65) {
    this.facing = facing;
    this.group.position.copy(this.findWater(near));
    this.group.rotation.y = facing;
    this.group.updateMatrixWorld(true);
    for (const d of this.decks) {
      const a = this.at(new THREE.Vector3(d.x0, 0, d.z0)), b = this.at(new THREE.Vector3(d.x1, 0, d.z1));
      d.x0 = a.x; d.z0 = a.z; d.x1 = b.x; d.z1 = b.z;
    }
    const crossingCast = { child: cast.child, wind: cast.wind, lines: cast.lines, input: cast.input };
    const hub = this.at(new THREE.Vector3());
    this.crossing = new MillCrossing({ hub: new THREE.Vector2(hub.x, hub.z), facing, from: FROM, to: TO }, {
      wait: this.at(WAIT.clone()),
      stepOff: this.at(STEP_OFF.clone()),
      onward: this.at(ONWARD.clone()),
    }, crossingCast);
    this.crossing.onEvent = (kind, where, strength) => cast.knock?.(MILL_SOUNDS[kind], where, strength);
    let stack = new THREE.Vector3();
    const scenery = yardMesh((add) => {
      const along: AddPart = (g, colour, kind, m) => add(g, colour, kind, ALONG_Z.clone().multiply(m ?? new THREE.Matrix4()));
      drownedHouse(LOW, along);
      drownedHouse(HIGH, along);
      stack = ridgeStack(LOW, STACK_AT, 2.0, along).applyMatrix4(ALONG_Z);
    });
    scenery.layers.enable(REFLECTION_LAYER);
    this.group.add(scenery);
    this.stackTop = this.at(stack.clone().setY(stack.y + 0.02));
  }

  get objects(): THREE.Object3D[] {
    return [this.group, ...this.crossing.objects];
  }

  /** For the capture tools: the numbers it plays by. */
  get tuning(): typeof tuning.crossings.mill {
    return tuning.crossings.mill;
  }

  /** For the capture tools: where everything has got to. */
  get state(): Record<string, unknown> {
    const m = this.crossing.mill, c = this.cast.child;
    return {
      playing: this.playing, phase: this.crossing.phase, clear: this.crossing.clear,
      angle: +m.angle.toFixed(4), speed: +m.speed.toFixed(4), rock: +m.rock.toFixed(4), shown: +m.shown.toFixed(4),
      drive: +m.drive.toFixed(3), aboard: m.aboard, engaged: m.engaged, hold: m.hold, quiet: +Math.min(999, m.quiet).toFixed(2),
      wound: +m.wound.toFixed(4), full: +m.full.toFixed(4), floor: +m.floor.toFixed(3), topped: m.topped, clicks: m.clicks,
      inviting: this.crossing.inviting, valving: this.crossing.valving, floorGap: +this.crossing.floorGap().toFixed(3),
      cat: { step: this.cat?.step ?? -1, at: this.cast.cat.position.toArray().map((v) => +v.toFixed(2)) },
      child: c.position.toArray().map((v) => +v.toFixed(3)), yaw: +c.yaw.toFixed(3),
    };
  }

  play(): void {
    const c = this.cast.child;
    this.playing = true;
    this.away = 0;
    this.crossing.reset();
    this.decks.length = Object.keys(WAY).length;
    c.decks = this.decks;
    c.dismount();
    c.stop();
    c.balance = 0;
    c.lean = 0;
    c.stroll = 1;
    c.hang = 0;
    c.lookAt = null;
    c.reachFor(0, null);
    c.reachFor(1, null);
    c.standUp();
    const wait = this.crossing.way.wait;
    c.place(wait.x, wait.z, this.facing + Math.PI);
    c.stowPlane(true, true);
    const k = this.cast.cygnet;
    k.visible = true;
    k.rideIn('satchel');
    const cat = this.cast.cat;
    this.cat = null;
    this.catClock = 0;
    cat.visible = !this.catless;
    if (!this.catless) {
      cat.place(this.stackTop, this.facing + Math.PI, { pose: 'sit' });
      cat.look(c.position);
      this.crossing.clear = false;
    }
    this.crossing.begin();
  }

  stop(): void {
    this.playing = false;
    this.crossing.reset();
    this.cast.child.decks = [];
    this.cast.child.reachFor(0, null);
    this.cast.child.reachFor(1, null);
  }

  update(dt: number, camera: THREE.PerspectiveCamera | null): void {
    if (!camera || !this.playing) return;
    if (!this.catless && !this.cat) {
      this.catClock += dt;
      if (this.catClock > 0.3) this.catGoes();
    }
    this.cat?.update();
    if (this.cat && this.cat.step >= 1) this.crossing.clear = true;
    this.crossing.catOn = !!this.cat && this.cat.step >= 1 && this.cat.step <= 2;
    this.crossing.update(dt, camera);
    const off = this.crossing.phase === 'leaving' || this.crossing.phase === 'over';
    this.away = off ? Math.min(1, this.away + dt / 4) : 0;
  }

  /** The cat goes first, already on its way: from her roof's chimney up onto the low sail's end, and from it to the cap. */
  private catGoes(): void {
    const steps = this.crossing.catWay();
    const look = this.cast.child.position;
    this.cat = playCatSteps(this.cast.cat, steps, look, { run: tuning.drowned.run.catSpeed, narrow: 2.2 }, () => {}, () => {});
  }

  /**
   * In front of the sails and out to the hoist's side, looking past her at the basket, the beam over it and the hub:
   * wide while she is low, so the whole height she has to go is in the frame, rising with her and closing in as she
   * nears the top, then turning with her along the high ridge. Upright, nearer and more side on, so the hoist's rope
   * and the hub stack up the narrow frame.
   */
  frame(shot: Shot): number {
    const upright = window.innerWidth / window.innerHeight < 0.9;
    const p = this.toYard(this.cast.child.position, this.local);
    shot.free = false;
    shot.from = undefined;
    shot.fitWidth = false;
    shot.subjects = undefined;
    const rise = THREE.MathUtils.smootherstep(THREE.MathUtils.clamp((p.y - FROM) / (TO - FROM), 0, 1), 0, 1);
    const ahead = THREE.MathUtils.smootherstep(this.away, 0, 1);
    if (this.closeUp === 'mill') {
      this.eye.set(-11, HUB_Y - 1, 13);
      this.target.set(-1.8, HUB_Y - 2.5, -1);
    } else if (this.closeUp === 'her') {
      this.eye.set(p.x - 1.6, p.y + 1.6, p.z + 2.6);
      this.target.set(p.x, p.y + 0.9, p.z);
    } else {
      const k = upright ? FRAMES.upright : FRAMES.wide;
      this.target.set(k.x, FROM + k.low + k.rise * rise, -1.2).addScaledVector(ON, ahead);
      const back = k.far - k.closer * rise;
      this.eye.set(this.target.x + k.dir.x * back, FROM + k.eye + k.eyeRise * rise, this.target.z + k.dir.y * back);
      this.target.y += (p.y + 1 - this.target.y) * 0.6 * ahead;
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
      for (let dx = -16; dx <= 16; dx += 2) {
        for (let dz = -16; dz <= 16; dz += 2) if (heightAt(x + dx, z + dz) > -2.5) return false;
      }
      return true;
    };
    for (let reach = 40; reach < 600; reach += 4) {
      for (const [x, z] of [[near.x + 40, near.z + reach], [near.x - 50, near.z + reach]]) if (wet(x, z)) return new THREE.Vector3(x, 0, z);
    }
    return new THREE.Vector3(near.x + 40, 0, near.z + 120);
  }
}
