import * as THREE from 'three';
import { fixInPlace } from '../../gl/fixed';
import { tuning } from '../../tuning';
import type { WindField } from '../../wind/field';
import { atmo } from '../../world/atmosphere';
import { hull, material, sail, SAIL_FRAG, SAIL_VERT, TOY_LINENS, TOY_PAINTS } from '../../world/little-boats';
import { swellAt, type Swell } from '../../world/water/swell';

/** Which of the little boats' toys come back: the child's own, the teal and the yellow. */
const FLEET = [0, 1, 2];
/**
 * Where each toy sails relative to the boat (ahead, and out on the swimming side): where it comes from, off the side
 * of the frame; where it keeps company with the swimmer; and where it bears away to, astern and out.
 */
const FROM = [[22, 42], [30, 50], [16, 36]];
const BESIDE = [[0.8, 4], [-1.2, 5.6], [2.6, 5.4]];
const AWAY = [[-6, 26], [-12, 32], [-2, 22]];

interface SeaToy {
  group: THREE.Group;
  pivot: THREE.Group;
  sail: THREE.ShaderMaterial;
  velocity: THREE.Vector3;
  yaw: number;
  fill: number;
  across: number;
  boom: number;
  roll: number;
  rollV: number;
  seed: number;
  nextMark: number;
}

/**
 * The little boats' toys, met again out on the open sea. Their course is the story's: they come in from the side,
 * keep company with the cygnet while it swims, and bear away astern. Their sails are the wind's: the breeze keeps
 * them drawing and a gust from the player fills them hard, as in their own room.
 */
export class ToyFleet {
  readonly group = new THREE.Group();
  private readonly toys: SeaToy[] = [];
  private phase: 'away' | 'coming' | 'beside' | 'leaving' | 'gone' = 'away';
  private t = 0;
  private side = 1;
  private readonly boat = new THREE.Vector3();
  private boatYaw = 0;
  private boatSpeed = 0;
  private readonly station = new THREE.Vector3();
  private readonly ahead = new THREE.Vector3();
  private readonly want = new THREE.Vector3();
  private readonly air = { x: 0, z: 0, energy: 0, lift: 0 };
  private readonly swell: Swell = { height: 0, slopeX: 0, slopeZ: 0 };
  /** Small foam behind a moving hull, through the sea's own marks. */
  onWake: (x: number, z: number, time: number) => void = () => {};

  constructor(private readonly wind: WindField) {
    this.group.name = 'sea-toys';
    this.group.visible = false;
    const wood = material('#76503a'), rim = material('#d4ad73');
    const shell = hull(), cloth = sail();
    const spar = new THREE.CylinderGeometry(0.025, 0.035, 1.75, 7).translate(0, 0.85, 0.21);
    const boom = new THREE.CylinderGeometry(0.022, 0.022, 1, 6).rotateZ(Math.PI / 2).translate(-0.45, 0.34, 0);
    for (const i of FLEET) {
      const g = new THREE.Group();
      g.scale.setScalar(tuning.seaToys.scale);
      g.add(new THREE.Mesh(shell, material(TOY_PAINTS[i])));
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
      this.toys.push({ group: g, pivot, sail: m, velocity: new THREE.Vector3(), yaw: 0, fill: 0, across: 0, boom: 0,
        roll: 0, rollV: 0, seed: i * 1.7, nextMark: 0 });
    }
  }

  /** Not yet seen, or long gone. */
  get idle(): boolean { return this.phase === 'away' || this.phase === 'gone'; }

  /** How near they have come, 0 out of sight to 1 alongside. */
  get near(): number {
    if (this.phase === 'coming') return THREE.MathUtils.smootherstep(this.t, 0, tuning.seaToys.comeFor);
    return this.phase === 'beside' ? 1 : 0;
  }

  /** The child's own toy, the one the cygnet goes to. */
  playmate(out: THREE.Vector3): THREE.Vector3 {
    return out.copy(this.toys[0].group.position);
  }

  /** Bring them in from `side` of the boat (the swim's side, the camera's side): +1 is the boat's left. */
  come(side: number, boat: THREE.Vector3, yaw: number, speed: number): void {
    this.side = side;
    this.phase = 'coming';
    this.t = 0;
    this.follow(boat, yaw, speed);
    this.toys.forEach((toy, k) => {
      this.stationOf(k, 0, toy.group.position);
      toy.velocity.set(Math.sin(yaw), 0, Math.cos(yaw)).multiplyScalar(speed);
      this.stationOf(k, 0.05, this.want).sub(toy.group.position).multiplyScalar(20).add(toy.velocity);
      toy.yaw = Math.atan2(this.want.x, this.want.z);
    });
    this.group.visible = true;
  }

  /** Let them bear away and sail on. */
  leave(): void {
    if (this.phase === 'coming' || this.phase === 'beside') { this.phase = 'leaving'; this.t = 0; }
  }

  /** The boat they keep station on, each frame while they are about. */
  follow(boat: THREE.Vector3, yaw: number, speed: number): void {
    this.boat.copy(boat);
    this.boatYaw = yaw;
    this.boatSpeed = speed;
  }

  /** Station `k` at time `t` into the current phase, in the world. */
  private stationOf(k: number, t: number, out: THREE.Vector3): THREE.Vector3 {
    const s = tuning.seaToys;
    let f: number, l: number;
    if (this.phase === 'coming') {
      const a = THREE.MathUtils.smootherstep(t, 0, s.comeFor);
      f = THREE.MathUtils.lerp(FROM[k][0], BESIDE[k][0], a);
      l = THREE.MathUtils.lerp(FROM[k][1], BESIDE[k][1], a);
    } else if (this.phase === 'beside') {
      f = BESIDE[k][0] + Math.sin(t * 0.37 + k * 2.1) * 0.9;
      l = BESIDE[k][1] + Math.sin(t * 0.29 + k * 1.3) * 0.6;
    } else {
      const b = THREE.MathUtils.smootherstep(t, 0, s.leaveFor);
      f = THREE.MathUtils.lerp(BESIDE[k][0], AWAY[k][0], b);
      l = THREE.MathUtils.lerp(BESIDE[k][1], AWAY[k][1], b);
    }
    const fx = Math.sin(this.boatYaw), fz = Math.cos(this.boatYaw);
    const lx = Math.cos(this.boatYaw) * this.side, lz = -Math.sin(this.boatYaw) * this.side;
    return out.set(this.boat.x + fx * f + lx * l, 0, this.boat.z + fz * f + lz * l);
  }

  update(dt: number, time: number): void {
    if (this.idle || dt <= 0) return;
    const s = tuning.seaToys;
    this.t += dt;
    if (this.phase === 'coming' && this.t >= s.comeFor) { this.phase = 'beside'; this.t = 0; }
    const free = this.phase === 'leaving' && this.t > s.leaveFor;
    const k = tuning.littleBoats;
    this.toys.forEach((toy, i) => {
      const p = toy.group.position;
      if (!free) {
        // Keep pace with the boat, follow the station as it moves, and close on it gently.
        this.ahead.set(Math.sin(this.boatYaw), 0, Math.cos(this.boatYaw)).multiplyScalar(this.boatSpeed);
        this.stationOf(i, this.t + 0.1, this.want);
        this.stationOf(i, this.t, this.station);
        this.want.sub(this.station).multiplyScalar(10).add(this.ahead);
        this.want.addScaledVector(this.station.sub(p).setY(0), s.closing);
        toy.velocity.lerp(this.want, 1 - Math.exp(-dt * 2));
      } else {
        this.want.set(Math.sin(toy.yaw), 0, Math.cos(toy.yaw)).multiplyScalar(s.ownSpeed * (0.6 + 0.6 * toy.fill));
        toy.velocity.lerp(this.want, 1 - Math.exp(-dt * 0.4));
      }
      p.x += toy.velocity.x * dt;
      p.z += toy.velocity.z * dt;
      const speed = Math.hypot(toy.velocity.x, toy.velocity.z);
      if (speed > 0.4) {
        const turn = Math.atan2(Math.sin(Math.atan2(toy.velocity.x, toy.velocity.z) - toy.yaw),
          Math.cos(Math.atan2(toy.velocity.x, toy.velocity.z) - toy.yaw));
        toy.yaw += THREE.MathUtils.clamp(turn * (1 - Math.exp(-dt * 2)), -s.turn * dt, s.turn * dt);
      }
      const w = this.wind.sample(p.x, p.z, this.air);
      const fill = Math.max(s.breezeFill, THREE.MathUtils.smoothstep(w.energy, k.windFrom, k.windFull));
      toy.fill += (fill - toy.fill) * (1 - Math.exp(-dt * (fill > toy.fill ? k.sailFillRate : k.sailEmptyRate)));
      const cross = Math.tanh((w.x * Math.cos(toy.yaw) - w.z * Math.sin(toy.yaw)) * 0.4);
      toy.across += (cross - toy.across) * (1 - Math.exp(-dt * 3));
      toy.boom += (-toy.across * toy.fill * 0.85 - toy.boom) * (1 - Math.exp(-dt * 2));
      toy.pivot.rotation.y = toy.boom;
      toy.rollV += ((toy.across * toy.fill * k.heel - toy.roll) * k.rollSpring - toy.rollV * k.rollDamping) * dt;
      toy.roll += toy.rollV * dt;
      const u = toy.sail.uniforms;
      u.uFill.value += ((toy.across >= 0 ? 1 : -1) * toy.fill - u.uFill.value) * (1 - Math.exp(-dt * 3));
      u.uDroop.value = 1 - THREE.MathUtils.smoothstep(toy.fill, 0.025, 0.65);
      u.uPhase.value = (u.uPhase.value + dt * (3 + toy.fill * 7)) % (Math.PI * 2);
      swellAt(p.x, p.z, time, this.swell);
      p.y = this.swell.height + k.toyDraft * s.scale + Math.sin(time * 2.1 + toy.seed) * 0.03;
      const yaw = toy.yaw;
      toy.group.rotation.set(
        -this.swell.slopeX * Math.sin(yaw) - this.swell.slopeZ * Math.cos(yaw) + Math.sin(time * 1.6 + toy.seed) * 0.04,
        yaw + toy.boom * 0.09,
        toy.roll + this.swell.slopeX * Math.cos(yaw) - this.swell.slopeZ * Math.sin(yaw) + Math.sin(time * 1.9 + toy.seed) * 0.05,
      );
      if (speed > 0.6 && time > toy.nextMark) {
        toy.nextMark = time + 0.35;
        this.onWake(p.x - Math.sin(yaw) * 0.8 * s.scale, p.z - Math.cos(yaw) * 0.8 * s.scale, time);
      }
    });
    const far = this.toys.every((toy) => toy.group.position.distanceTo(this.boat) > s.goneAt);
    if (free && (far || this.t > s.leaveFor + s.sailOnFor)) {
      this.phase = 'gone';
      this.group.visible = false;
    }
  }
}
