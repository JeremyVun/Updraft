import * as THREE from 'three';
import type { PointerInput } from '../input/pointer';
import { screenBrush } from '../creatures/motion';
import { puffGeometry, puffMaterial, type Puff } from './stairs-puffs';

interface Wisp { p: THREE.Vector3; v: THREE.Vector3; r: number; a: number; age: number; hold: number }

/** How far round the child the streaming cloud reaches: across, below and above. */
const BOX = { half: 7, below: 2.5, above: 5 } as const;

/**
 * The cloud streaming past on the way up through the white: soft rags of it blown across the stair on a gusting
 * wind, always round the child, so there is never more than a few treads to see. A stroke tears through them.
 */
export class CloudWisps {
  readonly mesh: THREE.Mesh;
  /** 0 none, 1 the full stream; the story sets it from how deep in the cloud they are. */
  amount = 0;
  /** The wind through the cloud, metres a second, set by the story. */
  readonly wind = new THREE.Vector3(3, 0.2, 0);
  readonly centre = new THREE.Vector3();
  private readonly wisps: Wisp[] = [];
  private readonly shown = { value: 0 };
  private readonly centres: THREE.BufferAttribute;
  private readonly alphas: THREE.BufferAttribute;
  private readonly right = new THREE.Vector3();
  private readonly up = new THREE.Vector3();
  private seed = 1;
  private next = 0;

  constructor(count = 56) {
    const puffs: Puff[] = [];
    for (let i = 0; i < count; i++) {
      const w: Wisp = { p: new THREE.Vector3(), v: new THREE.Vector3(), r: 1, a: 0, age: 0, hold: 0 };
      this.spawn(w, false);
      this.wisps.push(w);
      puffs.push({ x: 0, y: 0, z: 0, r: w.r, a: 0 });
    }
    const geo = puffGeometry(puffs);
    this.centres = geo.getAttribute('aCentre') as THREE.BufferAttribute;
    this.alphas = geo.getAttribute('aAlpha') as THREE.BufferAttribute;
    this.centres.setUsage(THREE.DynamicDrawUsage);
    this.alphas.setUsage(THREE.DynamicDrawUsage);
    this.mesh = new THREE.Mesh(geo, puffMaterial(this.shown));
    this.mesh.name = 'cloud-wisps';
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 7;
    this.mesh.visible = false;
  }

  private random(): number {
    this.seed = (this.seed * 16807) % 2147483647;
    return (this.seed - 1) / 2147483646;
  }

  /** Anywhere round the child to begin with; after that on the side the wind comes from. */
  private spawn(w: Wisp, upwind: boolean): void {
    const r = () => this.random();
    w.p.set((r() * 2 - 1) * BOX.half, -BOX.below + r() * (BOX.below + BOX.above), (r() * 2 - 1) * BOX.half);
    if (upwind) {
      const len = Math.hypot(this.wind.x, this.wind.z) || 1;
      w.p.x -= this.wind.x / len * BOX.half * 0.9;
      w.p.z -= this.wind.z / len * BOX.half * 0.9;
    }
    w.p.add(this.centre);
    w.v.set(0, 0, 0);
    w.hold = 0;
    w.r = 1.1 + r() * 1.6;
    w.a = 0.22 + r() * 0.3;
    w.age = upwind ? 0 : r() * 2;
  }

  /** Draws a few of the rags together round a point for a while, thick enough to hide what is in it. */
  engulf(at: THREE.Vector3, seconds: number): void {
    for (let i = 0; i < 6; i++) {
      const w = this.wisps[this.next];
      this.next = (this.next + 1) % this.wisps.length;
      const t = (i / 6) * Math.PI * 2;
      w.p.set(at.x + Math.cos(t) * 0.35, at.y + 0.2 + (i % 2) * 0.35, at.z + Math.sin(t) * 0.35);
      w.v.set(0, 0, 0);
      w.r = 1.3 + (i % 3) * 0.15;
      w.a = 1.6;
      w.age = 0.6;
      w.hold = seconds;
    }
  }

  /** A stroke across a wisp on screen carries it the way the stroke went. */
  brush(camera: THREE.PerspectiveCamera, input: PointerInput, dt: number): void {
    if (!this.mesh.visible || !input.present || input.muted || dt <= 0) return;
    const sx = (input.ndc.x - input.prevNdc.x) * camera.aspect, sy = input.ndc.y - input.prevNdc.y;
    if (sx * sx + sy * sy < 1e-8) return;
    this.right.setFromMatrixColumn(camera.matrixWorld, 0);
    this.up.setFromMatrixColumn(camera.matrixWorld, 1);
    const halfHeight = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
    for (const w of this.wisps) {
      const hit = screenBrush(camera, w.p, input.prevNdc, input.ndc, 0.28);
      if (hit <= 0) continue;
      const depth = w.p.distanceTo(camera.position) * halfHeight / dt;
      w.v.addScaledVector(this.right, sx * depth * hit * 0.5).addScaledVector(this.up, sy * depth * hit * 0.5);
    }
  }

  update(dt: number, time: number): void {
    this.shown.value += (this.amount - this.shown.value) * (1 - Math.exp(-dt * 1.5));
    this.mesh.visible = this.shown.value > 0.01;
    if (!this.mesh.visible) return;
    const len = Math.hypot(this.wind.x, this.wind.z) || 1;
    this.wisps.forEach((w, i) => {
      // Gusty: each rag goes at its own speed, and they all surge together now and then.
      const surge = 0.75 + 0.35 * Math.sin(time * 0.9 + i * 0.7) + 0.25 * Math.sin(time * 2.3 + i);
      w.v.multiplyScalar(Math.exp(-dt * 1.8));
      if (w.hold > 0) {
        w.hold -= dt;
        w.p.addScaledVector(this.wind, surge * dt * 0.08);
      } else w.p.addScaledVector(this.wind, surge * dt).addScaledVector(w.v, dt);
      w.age += dt;
      const dx = w.p.x - this.centre.x, dz = w.p.z - this.centre.z, dy = w.p.y - this.centre.y;
      const downwind = (dx * this.wind.x + dz * this.wind.z) / len;
      if (w.hold <= 0 && (downwind > BOX.half || Math.abs(dx) > BOX.half * 1.4 || Math.abs(dz) > BOX.half * 1.4 || dy < -BOX.below - 1 || dy > BOX.above + 1)) {
        this.spawn(w, true);
      }
      const fade = Math.min(1, w.age / 1.2);
      for (let c = 0; c < 4; c++) {
        this.centres.setXYZ(i * 4 + c, w.p.x, w.p.y, w.p.z);
        this.alphas.setX(i * 4 + c, w.a * fade);
      }
    });
    this.centres.needsUpdate = true;
    this.alphas.needsUpdate = true;
  }
}
