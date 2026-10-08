import * as THREE from 'three';
import type { Shot } from '../camera';
import type { Deck } from '../world/decks';
import { heightAt } from '../world/island';
import { REFLECTION_LAYER } from '../world/water/reflection';
import { tuning } from '../tuning';
import { HANG, SHEET_SOUNDS, SheetCrossing, UNDER } from '../world/crossings/sheet-crossing';
import { HOLD_DROP, SHEET } from '../world/crossings/wash-sheet';
import type { CatStep } from '../world/crossings/cat-way';
import { drownedHouse, ridgeOf, ridgeStack, yardMesh, type Roof } from './crossings-yard';
import { playCatSteps } from './cat-steps';
import type { Cast } from './cast';

/**
 * The yard, in its own frame: x across the lane from her roof to the higher one, z toward the lens's side, the water
 * at 0. Her roof's ridge ends at its gable at x 0; the lane is `LANE` wide; the high roof's ridge starts at its gable
 * across it. The line is strung from a chimney on her ridge behind her to one on the high ridge, each with a prop, so
 * that it clears her hood where she waits and hangs her feet just over each ridge at either end of the ride.
 */
const LANE = 4.0;
const RISE = 1.3;
const NEAR: Roof = { x: -3.6, z: 0, len: 7.2, depth: 4.6, wall: 3.4, rise: 2.5, sink: 3.45, stacks: [] };
const FAR: Roof = { x: LANE + 3.8, z: 0, len: 7.6, depth: 5.0, wall: 3.4, rise: 2.6, sink: 3.45 + 0.1 - RISE, stacks: [] };
const R0 = ridgeOf(NEAR);
const R1 = ridgeOf(FAR);
const NEAR_STACK = -2.4;
const FAR_STACK = LANE + 2.3;
const WAIT = new THREE.Vector3(0.04 - UNDER, R0, 0);
/** Where her mittens are at the start (the trailing edge a short reach ahead of her) and at the end of the ride. */
const START_X = 0.04;
const END_X = LANE + 0.62;
const STEP_OFF = new THREE.Vector3(LANE + 0.36, R1, 0);
/** How high her mittens close standing, in front of her face. */
const REACH = HANG;
/** Down onto the slates on the lens's side, clear of the sheet bunched on the line over the ridge. */
const SLOPE = 2.6 / (FAR.depth / 2 + 0.28);
const ONWARD = new THREE.Vector3(LANE + 1.3, R1 - SLOPE, 1.0);

/**
 * The line through the two holds, with its slack made up: at the start the trailing edge is where her mittens reach
 * standing, and her weight sags it onto her heels until the climbing line lifts her off the ridge's end; at the end it
 * hangs her feet just over the high ridge, her weight's sag made up too.
 */
function lineThrough(): { from: THREE.Vector3; to: THREE.Vector3; start: number; stop: number } {
  const k = tuning.crossings.sheet;
  let from = new THREE.Vector3(), to = new THREE.Vector3(), start = 0, stop = 0;
  let sagS = 0.07, sagE = 0.05;
  for (let i = 0; i < 4; i++) {
    const s = new THREE.Vector3(START_X, R0 + REACH + HOLD_DROP + sagS, 0);
    const e = new THREE.Vector3(END_X, R1 + 0.28 + HANG + HOLD_DROP + k.holdDip + sagE, 0);
    const dir = e.clone().sub(s);
    from = s.clone().addScaledVector(dir, (NEAR_STACK - s.x) / dir.x);
    to = s.clone().addScaledVector(dir, (FAR_STACK - s.x) / dir.x);
    const L = from.distanceTo(to);
    start = from.distanceTo(s);
    stop = L - from.distanceTo(e) - (SHEET.rings - 1) * SHEET.bunch;
    const sag = (d: number) => k.slack * L * 4 * (d / L) * (1 - d / L);
    sagS = sag(start);
    sagE = sag(from.distanceTo(e));
  }
  return { from, to, start, stop };
}
const LINE = lineThrough();

const WAY = {
  near: { x0: NEAR.x - NEAR.len / 2 + 0.6, z0: 0, x1: 0.1, z1: 0, halfWidth: 0.45, height: R0 },
  far: { x0: LANE - 0.1, z0: 0, x1: FAR.x + FAR.len / 2 - 0.6, z1: 0, halfWidth: 0.45, height: R1 },
  farSlope: { x0: LANE + 1.2, z0: 0, x1: LANE + 1.2, z1: 2.0, halfWidth: 0.9, height: R1, height1: R1 - SLOPE * 2.0 },
} satisfies Record<string, Deck>;

/**
 * QA only: the drowned village's sheet crossing set out on the sea off the QA stage (`?chapter=stage&gap=sheet`, or
 * `play('crossing:sheet')`). Low dusk light, the air dead, the lens beside the lane. The cat runs the line first.
 */
export class SheetYard {
  readonly group = new THREE.Group();
  readonly crossing: SheetCrossing;
  readonly decks: Deck[] = Object.values(WAY).map((d) => ({ ...d }));
  playing = false;
  /** QA: no cat going first, so the sheet is hers from the start. */
  catless = false;
  /** Where the cat is in its way over, and whether it is on the line. */
  private catStep = -1;
  private catOnLine = false;
  private catDone = false;
  private catClock = 0;
  private readonly catWay: CatStep[];
  private readonly facing: number;
  private readonly local = new THREE.Vector3();
  private readonly eye = new THREE.Vector3();
  private readonly target = new THREE.Vector3();
  private readonly nearCap: THREE.Vector3;
  private readonly farCap: THREE.Vector3;
  private readonly look = new THREE.Vector3();

  constructor(private readonly cast: Cast, near: THREE.Vector3, facing = -0.5) {
    this.facing = facing;
    this.group.position.copy(this.findWater(near));
    this.group.rotation.y = facing;
    this.group.updateMatrixWorld(true);
    for (const d of this.decks) {
      const a = this.at(new THREE.Vector3(d.x0, 0, d.z0)), b = this.at(new THREE.Vector3(d.x1, 0, d.z1));
      d.x0 = a.x; d.z0 = a.z; d.x1 = b.x; d.z1 = b.z;
    }
    let caps: THREE.Vector3[] = [];
    const scenery = yardMesh((add) => {
      drownedHouse(NEAR, add);
      drownedHouse(FAR, add);
      caps = [ridgeStack(NEAR, NEAR_STACK, 1.45, add), ridgeStack(FAR, FAR_STACK, 1.45, add)];
    });
    scenery.layers.enable(REFLECTION_LAYER);
    this.group.add(scenery);
    this.nearCap = this.at(caps[0].clone().setY(caps[0].y + 0.02));
    this.farCap = this.at(caps[1].clone().setY(caps[1].y + 0.02));
    const prop = (cap: THREE.Vector3) => this.at(cap.clone().setZ(cap.z - 0.22));
    const crossingCast = { child: cast.child, wind: cast.wind, lines: cast.lines, input: cast.input };
    this.crossing = new SheetCrossing({
      from: this.at(LINE.from.clone()), to: this.at(LINE.to.clone()), start: LINE.start, stop: LINE.stop,
      props: [prop(caps[0]), prop(caps[1])],
    }, { wait: this.at(WAIT.clone()), stepOff: this.at(STEP_OFF.clone()), onward: this.at(ONWARD.clone()) }, crossingCast);
    this.crossing.onEvent = (kind, where, strength) => cast.knock?.(SHEET_SOUNDS[kind], where, strength);
    const onCap = this.nearCap.clone().add(this.at(new THREE.Vector3(0.1, 0, 0.15)).sub(this.group.position));
    this.catWay = [{ hop: onCap }, ...this.crossing.catWay(this.nearCap, this.farCap)];
  }

  get objects(): THREE.Object3D[] {
    return [this.group, ...this.crossing.objects];
  }

  get tuning(): typeof tuning.crossings.sheet {
    return tuning.crossings.sheet;
  }

  /** For the capture tools: where everything has got to. */
  get state(): Record<string, unknown> {
    const s = this.crossing.sheet, c = this.cast.child;
    const hands = [0, 1].map((h) => c.mitten(h as 0 | 1, new THREE.Vector3()));
    const hold = s.hold(new THREE.Vector3());
    return {
      playing: this.playing, phase: this.crossing.phase, clear: this.crossing.clear,
      press: +s.press.toFixed(3), fill: +s.fill.toFixed(3), travel: +s.travel.toFixed(3), end: +s.end.toFixed(3), held: s.held,
      quiet: +Math.min(999, s.quiet).toFixed(2), invitation: this.crossing.invitation !== null, valving: this.crossing.valving,
      handGap: +Math.max(...hands.map((h) => h.distanceTo(hold))).toFixed(3),
      feet: +(c.position.y - this.floorUnder(c.position)).toFixed(3), hanging: this.crossing.hanging, hang: c.hang,
      cat: { step: this.catStep, onLine: this.catOnLine, done: this.catDone, at: this.cast.cat.position.toArray().map((v) => +v.toFixed(2)) },
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
    c.hang = 0;
    c.lookAt = null;
    c.reachFor(0, null);
    c.reachFor(1, null);
    c.standUp();
    const wait = this.crossing.way.wait;
    c.place(wait.x, wait.z, this.crossing.facing - 0.5);
    c.stowPlane(true, true);
    const k = this.cast.cygnet;
    k.visible = true;
    k.rideIn('satchel');
    const cat = this.cast.cat;
    this.catStep = -1;
    this.catOnLine = this.catDone = false;
    this.catClock = 0;
    cat.visible = !this.catless;
    if (!this.catless) {
      cat.place(this.at(new THREE.Vector3(-1.45, R0, 0.05)), this.facing + Math.PI / 2 + 0.3, { pose: 'sit' });
      cat.look(c.position);
      this.crossing.clear = false;
    }
    this.crossing.begin();
  }

  stop(): void {
    this.playing = false;
    this.crossing.reset();
    this.cast.child.decks = [];
  }

  update(dt: number, camera: THREE.PerspectiveCamera | null): void {
    if (!camera || !this.playing) return;
    if (!this.catless && this.catStep < 0) {
      this.catClock += dt;
      if (this.catClock > 0.4) this.catGoes();
    }
    this.crossing.catAt(this.catOnLine ? this.cast.cat.position : null);
    this.crossing.update(dt, camera);
  }

  /** The cat goes first, already on its way as she gets there: onto her chimney, up the line, down onto the high roof. */
  private catGoes(): void {
    const cat = this.cast.cat;
    this.catStep = 0;
    playCatSteps(cat, this.catWay, this.cast.child.position, { run: tuning.drowned.run.catSpeed, narrow: 2.2 },
      (i) => {
        this.catStep = i;
        this.catOnLine = i === 2;
      }, () => {
        this.catOnLine = false;
        this.catDone = true;
        this.crossing.clear = true;
      });
  }

  /**
   * From the side of the lane, low: her at the near edge, the sheet and the high roof across the frame, the line
   * climbing from left to right; it drifts with her as she is carried so the far roof stays in. Upright, it stands
   * behind her near shoulder and looks up the line, so the lane and the high roof stack up the narrow frame.
   */
  frame(shot: Shot): number {
    const upright = window.innerWidth / window.innerHeight < 0.9;
    const p = this.toYard(this.cast.child.position, this.local);
    shot.free = false;
    shot.from = undefined;
    shot.fitWidth = false;
    shot.subjects = undefined;
    const go = THREE.MathUtils.smootherstep(THREE.MathUtils.clamp((p.x - WAIT.x) / (END_X - WAIT.x), 0, 1), 0, 1);
    if (upright) {
      this.eye.set(-3.4 + 2.4 * go, R0 + 2.2 + 0.9 * go, 5.6 - 0.6 * go);
      this.target.set(LANE * 0.55 + 1.6 * go, R0 + 1.9 + 0.5 * go, -0.6);
    } else {
      this.eye.set(1.5 + 1.6 * go, R0 + 1.3 + 0.7 * go, 11.2);
      this.target.set(1.7 + 1.4 * go, R0 + 1.75 + 0.6 * go, 0);
    }
    this.at(this.eye);
    this.at(this.target);
    shot.eye = (shot.eye ?? new THREE.Vector3()).copy(this.eye);
    shot.target.copy(this.target);
    shot.distance = this.eye.distanceTo(this.target);
    shot.height = this.eye.y - this.target.y;
    return 0.7;
  }

  /** What is under a point of the world in the yard: a ridge, or the water. */
  private floorUnder(p: THREE.Vector3): number {
    const y = this.toYard(p, this.look);
    if (y.x <= 0.15 && Math.abs(y.z) < 0.6) return R0;
    if (y.x >= LANE - 0.15 && Math.abs(y.z) < 0.45) return R1;
    if (y.x >= LANE + 0.3 && y.z >= 0 && y.z < 2.6) return R1 - SLOPE * y.z;
    return 0;
  }

  private at(p: THREE.Vector3): THREE.Vector3 {
    return p.applyMatrix4(this.group.matrixWorld);
  }

  private toYard(world: THREE.Vector3, out: THREE.Vector3): THREE.Vector3 {
    return this.group.worldToLocal(out.copy(world));
  }

  /** Out from `near` until the whole yard is over open water. */
  private findWater(near: THREE.Vector3): THREE.Vector3 {
    const wet = (x: number, z: number) => {
      for (let dx = -16; dx <= 18; dx += 2) {
        for (let dz = -16; dz <= 16; dz += 2) if (heightAt(x + dx, z + dz) > -2.5) return false;
      }
      return true;
    };
    for (let reach = 140; reach < 700; reach += 4) {
      for (const [x, z] of [[near.x - reach, near.z + 70], [near.x - reach, near.z + 140]]) if (wet(x, z)) return new THREE.Vector3(x, 0, z);
    }
    return new THREE.Vector3(near.x - 200, 0, near.z + 70);
  }
}
