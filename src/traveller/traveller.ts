import * as THREE from 'three';
import type { WindField, WindSample } from '../wind/field';
import { heightAt } from '../world/island';
import { ROCKS, TREE } from '../world/landmarks';
import { buildChild, type Rig } from './body';
import { Scarf } from './scarf';

type Action =
  | { kind: 'throw'; t: number; released: boolean; onRelease: () => void }
  | { kind: 'pickup'; t: number; onDone: () => void }
  | { kind: 'cheer'; t: number }
  | { kind: 'wave'; t: number }
  | { kind: 'push'; t: number };

interface Goal {
  x: number;
  z: number;
  run: boolean;
  onArrive?: () => void;
  near: number;
  /** A waypoint to reach first when the straight way is blocked. */
  detour?: { x: number; z: number };
  best: number;
  since: number;
}

const OBSTACLES = [...ROCKS, { x: TREE.x, z: TREE.z, radius: 1.3 }];
const WALK = 2.6;
const RUN = 5.4;
const SHADOW_FRAG = /* glsl */ `
uniform float uOpacity;
in vec2 vUv;
void main() {
  float r = length(vUv - 0.5) * 2.0;
  gl_FragColor = vec4(0.03, 0.06, 0.08, uOpacity * (1.0 - smoothstep(0.1, 1.0, r)));
}`;

const damp = (a: number, b: number, rate: number, dt: number) => a + (b - a) * (1 - Math.exp(-rate * dt));

/**
 * The child. Moves over the terrain toward goals, plays a handful of actions, and reacts on its own to the wind:
 * scarf and hem in the air, bracing in strong gusts, eyes on the paper plane.
 */
export class Traveller {
  readonly position = new THREE.Vector3();
  readonly scarf = new Scarf();
  readonly shadow: THREE.Mesh;
  yaw = 0;
  sitting = true;
  /** Where the child is looking, if anywhere in particular. */
  lookAt: THREE.Vector3 | null = null;
  private readonly rig: Rig;
  private goal: Goal | null = null;
  private action: Action | null = null;
  private speed = 0;
  private gait = 0;
  private sit = 1;
  private brace = 0;
  private blink = 0;
  private nextBlink = 2;
  private bob = 0;
  private headYaw = 0;
  private headPitch = 0;
  private readonly sample: WindSample = { x: 0, z: 0, energy: 0, lift: 0 };
  private readonly prev = new THREE.Vector3();
  private readonly tmp = new THREE.Vector3();
  private readonly tmp2 = new THREE.Vector3();
  private readonly shadowMat: THREE.ShaderMaterial;
  private time = 0;

  constructor(private readonly wind: WindField) {
    this.rig = buildChild();
    this.shadowMat = new THREE.ShaderMaterial({
      vertexShader: /* glsl */ `out vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: SHADOW_FRAG,
      uniforms: { uOpacity: { value: 0.32 } },
      transparent: true,
      depthWrite: false,
    });
    const sg = new THREE.PlaneGeometry(2.2, 2.2);
    sg.rotateX(-Math.PI / 2);
    this.shadow = new THREE.Mesh(sg, this.shadowMat);
    this.shadow.renderOrder = 4;
  }

  get objects(): THREE.Object3D[] {
    return [this.rig.root, this.scarf.mesh, this.shadow];
  }

  get busy(): boolean {
    return this.goal !== null || this.action !== null;
  }

  get moving(): boolean {
    return this.goal !== null;
  }

  /** World position of the right mitten, where the plane is held. */
  handPosition(out: THREE.Vector3): THREE.Vector3 {
    this.rig.root.updateMatrixWorld(true);
    return this.rig.handR.getWorldPosition(out);
  }

  place(x: number, z: number, yaw: number): void {
    this.position.set(x, Math.max(heightAt(x, z), 0), z);
    this.yaw = yaw;
    this.pose(0);
    this.scarf.reset(this.rig.neck.getWorldPosition(this.tmp));
  }

  walkTo(x: number, z: number, run = false, onArrive?: () => void, near = 0.6): void {
    this.sitting = false;
    this.goal = { x, z, run, onArrive, near, best: Infinity, since: 0 };
  }

  stop(): void {
    this.goal = null;
  }

  sitDown(): void {
    this.goal = null;
    this.sitting = true;
  }

  standUp(): void {
    this.sitting = false;
  }

  throwToward(x: number, z: number, onRelease: () => void): void {
    this.goal = null;
    this.sitting = false;
    this.faceToward(x, z, 1);
    this.action = { kind: 'throw', t: 0, released: false, onRelease };
  }

  pickUp(onDone: () => void): void {
    this.goal = null;
    this.action = { kind: 'pickup', t: 0, onDone };
  }

  cheer(): void {
    if (!this.action) this.action = { kind: 'cheer', t: 0 };
  }

  wave(): void {
    if (!this.action) this.action = { kind: 'wave', t: 0 };
  }

  push(): void {
    this.action = { kind: 'push', t: 0 };
  }

  faceToward(x: number, z: number, amount: number): void {
    const target = Math.atan2(x - this.position.x, z - this.position.z);
    let d = target - this.yaw;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    this.yaw += d * amount;
  }

  update(dt: number): void {
    this.time += dt;
    const p = this.position;
    this.prev.copy(p);
    this.updateGoal(dt);
    this.updateAction(dt);

    const w = this.wind.sample(p.x, p.z, this.sample);
    const windSpeed = Math.hypot(w.x, w.z);
    const strong = Math.min(1, Math.max(0, (windSpeed - 7) / 10) + w.energy * 0.6);
    this.brace = damp(this.brace, this.sitting ? 0 : strong, strong > this.brace ? 5 : 1.5, dt);

    this.blink -= dt;
    this.nextBlink -= dt;
    if (this.nextBlink <= 0) {
      this.blink = 0.13;
      this.nextBlink = 2 + Math.random() * 4;
    }

    this.pose(dt);

    const moved = Math.hypot(p.x - this.prev.x, p.z - this.prev.z);
    if (moved > 0.01 && !this.sitting) {
      this.wind.addSplat({
        ax: this.prev.x,
        az: this.prev.z,
        bx: p.x,
        bz: p.z,
        vx: ((p.x - this.prev.x) / dt) * 1.2,
        vz: ((p.z - this.prev.z) / dt) * 1.2,
        radius: 1.4,
        energy: 0,
        swirl: 0,
        lift: 0,
      });
    }

    const neck = this.rig.neck.getWorldPosition(this.tmp);
    const centre = this.tmp2.set(p.x, p.y + (this.sitting ? 0.7 : 1.1), p.z);
    this.scarf.update(dt, neck, centre, 0.52, w, Math.max(heightAt(p.x, p.z), 0), p);
    this.rig.material.uniforms.uGroundPos.value.copy(p);

    this.shadow.position.set(p.x, p.y + 0.06, p.z);
    this.shadowMat.uniforms.uOpacity.value = 0.3;
  }

  private updateGoal(dt: number): void {
    const g = this.goal;
    const p = this.position;
    let target = 0;
    if (g) {
      const d = Math.hypot(g.x - p.x, g.z - p.z);
      this.watchProgress(g, d, dt);
      const aim = g.detour ?? g;
      const dx = aim.x - p.x;
      const dz = aim.z - p.z;
      const da = Math.hypot(dx, dz);
      if (g.detour && da < 1) g.detour = undefined;
      if (d < g.near) {
        this.goal = null;
        g.onArrive?.();
      } else {
        target = (g.run ? RUN : WALK) * Math.min(1, da / 1.5 + 0.3);
        const want = this.steer(Math.atan2(dx, dz), da);
        let dy = want - this.yaw;
        dy = Math.atan2(Math.sin(dy), Math.cos(dy));
        this.yaw += Math.sign(dy) * Math.min(Math.abs(dy), dt * 7);
      }
    }
    this.speed = damp(this.speed, target, target > this.speed ? 6 : 9, dt);
    if (this.speed < 0.01) return;
    const step = this.speed * dt * Math.max(0, Math.cos(Math.min(1.2, Math.abs(this.turnDebt()))));
    let nx = p.x + Math.sin(this.yaw) * step;
    let nz = p.z + Math.cos(this.yaw) * step;
    for (const r of OBSTACLES) {
      const ox = nx - r.x;
      const oz = nz - r.z;
      const od = Math.hypot(ox, oz);
      const keep = r.radius + 0.55;
      if (od < keep && od > 1e-4) {
        nx = r.x + (ox / od) * keep;
        nz = r.z + (oz / od) * keep;
      }
    }
    if (heightAt(nx, nz) < 0.35) {
      this.speed = 0;
      if (this.goal) {
        const arrive = this.goal.onArrive;
        this.goal = null;
        arrive?.();
      }
      return;
    }
    this.gait += (step / (this.speed > 4 ? 1.5 : 1.1)) * Math.PI;
    p.set(nx, heightAt(nx, nz), nz);
  }

  /** When the child stops closing on the goal, pick a waypoint off to the side and go round. */
  private watchProgress(g: Goal, d: number, dt: number): void {
    if (d < g.best - 0.5) {
      g.best = d;
      g.since = 0;
      return;
    }
    g.since += dt;
    if (g.since < 1.1 || g.detour) return;
    g.since = 0;
    g.best = d;
    const p = this.position;
    const ax = (g.x - p.x) / d;
    const az = (g.z - p.z) / d;
    for (const side of Math.random() < 0.5 ? [1, -1] : [-1, 1]) {
      for (const reach of [7, 11]) {
        const x = p.x + (-az * side * reach + ax * 3);
        const z = p.z + (ax * side * reach + az * 3);
        const blocked = OBSTACLES.some((r) => Math.hypot(x - r.x, z - r.z) < r.radius + 1.2);
        if (!blocked && heightAt(x, z) > 0.6) {
          g.detour = { x, z };
          return;
        }
      }
    }
  }

  /** Bends the heading around rocks and the trunk that lie between the child and the goal. */
  private steer(heading: number, distance: number): number {
    const p = this.position;
    const hx = Math.sin(heading);
    const hz = Math.cos(heading);
    let best = heading;
    let nearest = Infinity;
    for (const r of OBSTACLES) {
      const ox = r.x - p.x;
      const oz = r.z - p.z;
      const along = ox * hx + oz * hz;
      if (along < 0 || along > Math.min(distance, 7) + r.radius) continue;
      const across = ox * hz - oz * hx;
      const clear = r.radius + 0.9;
      if (Math.abs(across) > clear || along >= nearest) continue;
      nearest = along;
      const side = across >= 0 ? -1 : 1;
      best = heading + side * Math.min(1.2, Math.asin(Math.min(1, clear / Math.max(Math.hypot(ox, oz), clear))) + 0.2);
    }
    return best;
  }

  private turnDebt(): number {
    const g = this.goal;
    if (!g) return 0;
    const aim = g.detour ?? g;
    const want = this.steer(Math.atan2(aim.x - this.position.x, aim.z - this.position.z), Math.hypot(aim.x - this.position.x, aim.z - this.position.z));
    return Math.atan2(Math.sin(want - this.yaw), Math.cos(want - this.yaw));
  }

  private updateAction(dt: number): void {
    const a = this.action;
    if (!a) return;
    a.t += dt;
    if (a.kind === 'throw') {
      if (!a.released && a.t > 0.62) {
        a.released = true;
        a.onRelease();
      }
      if (a.t > 1.1) this.action = null;
    } else if (a.kind === 'pickup') {
      if (a.t > 0.9) {
        this.action = null;
        a.onDone();
      }
    } else if (a.kind === 'cheer' && a.t > 1.3) this.action = null;
    else if (a.kind === 'wave' && a.t > 1.8) this.action = null;
    else if (a.kind === 'push' && a.t > 2.4) this.action = null;
  }

  private pose(dt: number): void {
    const r = this.rig;
    const t = this.time;
    this.sit = damp(this.sit, this.sitting ? 1 : 0, 4, dt || 1);
    const moving = Math.min(1, this.speed / WALK);
    const running = Math.min(1, Math.max(0, (this.speed - WALK) / (RUN - WALK)));
    const swing = Math.sin(this.gait);
    const legAmp = 0.55 * moving + 0.25 * running;
    const armAmp = 0.45 * moving + 0.35 * running;
    this.bob = Math.abs(Math.cos(this.gait)) * (0.06 + 0.07 * running) * moving;

    let armLX = -swing * armAmp;
    let armRX = swing * armAmp;
    let armLZ = -0.12 - 0.1 * running;
    let armRZ = 0.12 + 0.1 * running;
    let bodyX = 0.12 * moving + 0.16 * running;
    let bodyY = 0;
    let lift = 0;
    let crouch = 0;

    const a = this.action;
    if (a?.kind === 'throw') {
      const wind = THREE.MathUtils.smoothstep(a.t, 0, 0.55);
      const fling = THREE.MathUtils.smoothstep(a.t, 0.55, 0.72);
      const settle = THREE.MathUtils.smoothstep(a.t, 0.8, 1.1);
      armRX = THREE.MathUtils.lerp(armRX, (-2.5 * wind + 3.6 * fling) * (1 - settle), 1 - settle * 0.3);
      bodyY = (-0.35 * wind + 0.6 * fling) * (1 - settle);
      bodyX = -0.12 * wind + 0.25 * fling * (1 - settle);
      armLX = 0.5 * wind * (1 - settle);
    } else if (a?.kind === 'pickup') {
      const down = Math.sin(Math.min(1, a.t / 0.9) * Math.PI);
      bodyX = 0.9 * down;
      crouch = 0.28 * down;
      armRX = -1.2 * down;
      armLX = -0.8 * down;
    } else if (a?.kind === 'cheer') {
      const up = Math.sin(Math.min(1, a.t / 1.3) * Math.PI);
      armLX = armRX = -2.9 * Math.min(1, up * 1.6);
      armLZ = -0.4 * up;
      armRZ = 0.4 * up;
      lift = Math.max(0, Math.sin(a.t * 9)) * 0.22 * up;
    } else if (a?.kind === 'wave') {
      const up = Math.min(1, a.t * 4) * Math.min(1, (1.8 - a.t) * 4);
      armRX = -2.6 * up;
      armRZ = 0.3 + Math.sin(a.t * 12) * 0.35 * up;
    } else if (a?.kind === 'push') {
      const lean = Math.min(1, a.t * 2) * Math.min(1, (2.4 - a.t) * 2);
      bodyX = 0.75 * lean;
      armLX = armRX = -1.4 * lean;
      crouch = 0.1 * lean;
    }

    const brace = this.brace;
    if (brace > 0.02 && !a) {
      armLX = THREE.MathUtils.lerp(armLX, -2.7, brace);
      armLZ = THREE.MathUtils.lerp(armLZ, -0.9, brace);
      bodyX += 0.22 * brace;
    }

    const sit = this.sit;
    r.root.position.copy(this.position);
    r.root.position.y += lift - crouch - sit * 0.5;
    r.root.rotation.set(0, this.yaw, 0);
    r.body.position.y = 0.62 + this.bob + Math.sin(t * 2.2) * 0.008;
    r.body.rotation.set(bodyX * (1 - sit) - sit * 0.1, bodyY, 0);
    r.body.scale.set(1, 1 + Math.sin(t * 2.2) * 0.012, 1);
    r.legL.rotation.set(swing * legAmp * (1 - sit) - sit * 1.45, 0, -0.05 - sit * 0.15);
    r.legR.rotation.set(-swing * legAmp * (1 - sit) - sit * 1.45, 0, 0.05 + sit * 0.15);
    r.armL.rotation.set(armLX * (1 - sit) - sit * 0.3, 0, armLZ);
    r.armR.rotation.set(armRX * (1 - sit * (a ? 0 : 1)) - sit * 0.5, 0, armRZ);

    let wantYaw = Math.sin(t * 0.37) * 0.35;
    let wantPitch = Math.sin(t * 0.23) * 0.08;
    if (this.lookAt) {
      r.root.updateMatrixWorld(true);
      const head = r.head.getWorldPosition(this.tmp);
      const dx = this.lookAt.x - head.x;
      const dy = this.lookAt.y - head.y;
      const dz = this.lookAt.z - head.z;
      const yawTo = Math.atan2(dx, dz) - this.yaw;
      wantYaw = THREE.MathUtils.clamp(Math.atan2(Math.sin(yawTo), Math.cos(yawTo)), -1.1, 1.1);
      wantPitch = THREE.MathUtils.clamp(-Math.atan2(dy, Math.hypot(dx, dz)), -0.9, 0.4);
    }
    this.headYaw = damp(this.headYaw, wantYaw, 5, dt || 1);
    this.headPitch = damp(this.headPitch, wantPitch, 5, dt || 1);
    r.head.rotation.set(this.headPitch, this.headYaw, Math.sin(t * 0.6) * 0.05);
    r.eyes.scale.set(1, this.blink > 0 ? 0.15 : 1, 1);
    r.root.updateMatrixWorld(true);
  }
}
