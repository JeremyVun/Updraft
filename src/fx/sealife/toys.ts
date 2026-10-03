import * as THREE from 'three';
import { fixInPlace } from '../../gl/fixed';
import { tuning } from '../../tuning';
import type { WindField } from '../../wind/field';
import { atmo } from '../../world/atmosphere';
import { hull, material, sail, SAIL_FRAG, SAIL_VERT, TOY_LINENS, TOY_PAINTS } from '../../world/little-boats';
import { swellAt, type Swell } from '../../world/water/swell';

/** Which of the little boats' toys come back: the child's own, the teal and the yellow. */
const FLEET = [0, 1, 2];
/** Where each sails in the loose flotilla: behind the child's own along their course, and out to either side of it. */
const LOOSE = [[0, 0], [-2.8, 0.8], [-1.4, -0.9]];
/** Each hull's own pace and its own small difference of course, so the flotilla is never quite in step. */
const PACE = [1, 0.98, 0.985];
const STRAY = [0, 0.012, 0];

const WOOD = '#76503a', RIM = '#d4ad73';

interface SeaToy {
  group: THREE.Group;
  pivot: THREE.Group;
  sail: THREE.ShaderMaterial;
  /** Each material with its own colour, to be dimmed while it is far off in the dark. */
  lit: [THREE.ShaderMaterial, string][];
  course: number;
  speed: number;
  yaw: number;
  fill: number;
  gust: number;
  luff: number;
  across: number;
  boom: number;
  roll: number;
  rollV: number;
  seed: number;
  nextMark: number;
}

/**
 * The little boats' toys, met again out on the open sea. They are out there sailing before anyone can see them,
 * on their own course at their own small pace, and nothing about the boat changes it: it comes up on them, the
 * cygnet goes over the side to them, and they sail on until the sea has them again. Their sails are the wind's:
 * the breeze keeps them drawing and a gust from the player fills, heels and drives them, as in their own room.
 */
export class ToyFleet {
  readonly group = new THREE.Group();
  private readonly toys: SeaToy[] = [];
  private phase: 'unseen' | 'sailing' | 'gone' = 'unseen';
  private readonly air = { x: 0, z: 0, energy: 0, lift: 0 };
  private readonly swell: Swell = { height: 0, slopeX: 0, slopeZ: 0 };
  private readonly frustum = new THREE.Frustum();
  private readonly view = new THREE.Matrix4();
  private readonly sphere = new THREE.Sphere(new THREE.Vector3(), 1.5);
  /** Small foam behind a moving hull, through the sea's own marks. */
  onWake: (x: number, z: number, time: number) => void = () => {};

  constructor(private readonly wind: WindField, private readonly camera: THREE.Camera) {
    this.group.name = 'sea-toys';
    this.group.visible = false;
    const shell = hull(), cloth = sail();
    const spar = new THREE.CylinderGeometry(0.025, 0.035, 1.75, 7).translate(0, 0.85, 0.21);
    const boom = new THREE.CylinderGeometry(0.022, 0.022, 1, 6).rotateZ(Math.PI / 2).translate(-0.45, 0.34, 0);
    for (const i of FLEET) {
      const g = new THREE.Group();
      g.scale.setScalar(tuning.seaToys.scale);
      const wood = material(WOOD), rim = material(RIM), paint = material(TOY_PAINTS[i]);
      g.add(new THREE.Mesh(shell, paint));
      const deck = new THREE.Mesh(shell, rim);
      deck.scale.set(0.89, 0.24, 0.91);
      deck.position.y = 0.13;
      const seat = new THREE.Mesh(new THREE.BoxGeometry(0.59, 0.07, 0.13), wood);
      seat.position.set(0, 0.24, -0.2);
      g.add(deck, seat, new THREE.Mesh(spar, wood));
      const m = new THREE.ShaderMaterial({
        uniforms: {
          ...atmo.uniforms,
          uFill: { value: 0 }, uDroop: { value: 1 }, uLuff: { value: 0 },
          uPhase: { value: i * 1.7 }, uSeed: { value: i * 2.4 },
          uColour: { value: new THREE.Color(TOY_LINENS[i]) },
        },
        vertexShader: SAIL_VERT,
        fragmentShader: SAIL_FRAG,
        side: THREE.DoubleSide,
      });
      const pivot = new THREE.Group();
      pivot.position.z = 0.21;
      pivot.add(new THREE.Mesh(cloth, m), new THREE.Mesh(boom, wood));
      g.add(pivot);
      fixInPlace(...g.children.filter((o) => o !== pivot), ...pivot.children);
      this.group.add(g);
      this.toys.push({ group: g, pivot, sail: m, lit: [[paint, TOY_PAINTS[i]], [rim, RIM], [wood, WOOD], [m, TOY_LINENS[i]]],
        course: 0, speed: 0, yaw: 0, fill: 0, gust: 0, luff: 0, across: 0,
        boom: 0, roll: 0, rollV: 0, seed: i * 1.7, nextMark: 0 });
    }
  }

  /** Not out on the water: not yet set sailing, or sailed on out of sight. */
  get idle(): boolean { return this.phase !== 'sailing'; }

  /** Where toy `which` is (0 is the child's own). */
  at(which: number, out: THREE.Vector3): THREE.Vector3 {
    return out.copy(this.toys[which].group.position);
  }

  /** How toy `which` is moving over the water, in units a second. */
  velocity(which: number, out: THREE.Vector3): THREE.Vector3 {
    const toy = this.toys[which];
    return out.set(Math.sin(toy.yaw) * toy.speed, 0, Math.cos(toy.yaw) * toy.speed);
  }

  /** The one nearest `to`, preferring the child's own unless another is `nearer` closer. */
  nearest(to: THREE.Vector3, nearer: number): number {
    let best = 0, gap = this.toys[0].group.position.distanceTo(to) - nearer;
    this.toys.forEach((toy, i) => {
      const d = toy.group.position.distanceTo(to);
      if (d < gap) { best = i; gap = d; }
    });
    return best;
  }

  /**
   * Sets them sailing, out of sight: the child's own at `at` on `course` (yaw), the others loosely behind it and out
   * toward `side` (+1 is the left of that course).
   */
  sail(at: THREE.Vector3, course: number, side: number): void {
    const s = tuning.seaToys;
    const fx = Math.sin(course), fz = Math.cos(course), lx = Math.cos(course) * side, lz = -Math.sin(course) * side;
    this.toys.forEach((toy, i) => {
      const [back, out] = LOOSE[i];
      toy.group.position.set(at.x + fx * back + lx * out, 0, at.z + fz * back + lz * out);
      toy.course = toy.yaw = course + STRAY[i] * side;
      toy.speed = s.ownSpeed * PACE[i] * (s.cruise + s.driven * s.breezeFill);
      toy.fill = toy.gust = s.breezeFill;
      toy.luff = toy.across = toy.boom = toy.roll = toy.rollV = 0;
    });
    this.phase = 'sailing';
    this.group.visible = true;
  }

  /** Off the water at once, for a passage that starts after they have been and gone. */
  clear(): void {
    this.phase = 'unseen';
    this.group.visible = false;
  }

  update(dt: number, time: number): void {
    if (this.idle || dt <= 0) return;
    const s = tuning.seaToys;
    const k = tuning.littleBoats;
    this.toys.forEach((toy, i) => {
      const p = toy.group.position;
      const w = this.wind.sample(p.x, p.z, this.air);
      const effort = THREE.MathUtils.smoothstep(w.energy, k.windFrom, k.windFull);
      const fill = Math.max(s.breezeFill, effort);
      toy.fill += (fill - toy.fill) * (1 - Math.exp(-dt * (fill > toy.fill ? k.sailFillRate : k.sailEmptyRate)));
      toy.luff = Math.max(toy.luff * Math.exp(-dt * 2.2), Math.min(1, Math.abs(fill - toy.gust) * 1.8));
      toy.gust += (fill - toy.gust) * (1 - Math.exp(-dt * 1.2));
      const cross = Math.tanh((w.x * Math.cos(toy.yaw) - w.z * Math.sin(toy.yaw)) * 0.4);
      toy.across += (cross - toy.across) * (1 - Math.exp(-dt * 3));
      // A gust knocks a toy's head off its course a little before it finds it again.
      const want = toy.course + Math.sin(time * 0.09 + toy.seed * 2.3) * s.wander - toy.across * toy.luff * s.knock;
      toy.yaw += THREE.MathUtils.clamp(Math.atan2(Math.sin(want - toy.yaw), Math.cos(want - toy.yaw)) * (1 - Math.exp(-dt * 1.5)),
        -s.turn * dt, s.turn * dt);
      const drive = s.ownSpeed * PACE[i] * (s.cruise + s.driven * toy.fill);
      toy.speed += (drive - toy.speed) * (1 - Math.exp(-dt * (drive > toy.speed ? k.drive : k.drag)));
      p.x += Math.sin(toy.yaw) * toy.speed * dt;
      p.z += Math.cos(toy.yaw) * toy.speed * dt;
      toy.boom += (-toy.across * toy.fill * 0.85 - toy.boom) * (1 - Math.exp(-dt * 2));
      toy.pivot.rotation.y = toy.boom;
      toy.rollV += ((toy.across * toy.fill * k.heel - toy.roll) * k.rollSpring - toy.rollV * k.rollDamping) * dt;
      toy.roll += toy.rollV * dt;
      const u = toy.sail.uniforms;
      u.uFill.value += ((toy.across >= 0 ? 1 : -1) * toy.fill - u.uFill.value) * (1 - Math.exp(-dt * 3));
      u.uDroop.value = 1 - THREE.MathUtils.smoothstep(toy.fill, 0.025, 0.65);
      u.uLuff.value = toy.luff;
      u.uPhase.value = (u.uPhase.value + dt * (3 + toy.fill * 7)) % (Math.PI * 2);
      swellAt(p.x, p.z, time, this.swell);
      p.y = this.swell.height + k.toyDraft * s.scale + Math.sin(time * 2.1 + toy.seed) * 0.03;
      const yaw = toy.yaw;
      toy.group.rotation.set(
        -this.swell.slopeX * Math.sin(yaw) - this.swell.slopeZ * Math.cos(yaw) + Math.sin(time * 1.6 + toy.seed) * 0.04,
        yaw + toy.boom * 0.09,
        toy.roll + this.swell.slopeX * Math.cos(yaw) - this.swell.slopeZ * Math.sin(yaw) + Math.sin(time * 1.9 + toy.seed) * 0.05,
      );
      // Far off in the night nothing lights them; they come out of the dark as they come near.
      const unlit = THREE.MathUtils.smoothstep(p.distanceTo(this.camera.position), s.litWithin, s.darkBeyond) * atmo.uniforms.uNight.value;
      for (const [m, colour] of toy.lit) m.uniforms.uColour.value.set(colour).multiplyScalar(1 - unlit);
      if (time > toy.nextMark) {
        toy.nextMark = time + 0.35;
        this.onWake(p.x - Math.sin(yaw) * 0.8 * s.scale, p.z - Math.cos(yaw) * 0.8 * s.scale, time);
      }
    });
    // Once nobody could see them any more, they are gone for good.
    this.camera.updateMatrixWorld();
    this.frustum.setFromProjectionMatrix(this.view.multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse));
    const eye = this.camera.position;
    const lost = this.toys.every((toy) => {
      const far = toy.group.position.distanceTo(eye);
      return far > s.lostAt || (far > s.unseenAt && !this.frustum.intersectsSphere(this.sphere.set(toy.group.position, 1.5)));
    });
    if (lost) {
      this.phase = 'gone';
      this.group.visible = false;
    }
  }
}
