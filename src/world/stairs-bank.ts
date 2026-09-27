import * as THREE from 'three';
import type { PointerInput } from '../input/pointer';
import { screenBrush } from '../creatures/motion';
import { puffGeometry, puffMaterial, type Puff } from './stairs-puffs';

interface Lump { home: THREE.Vector3; p: THREE.Vector3; v: THREE.Vector3; r: number; a: number }

/**
 * A heap of cloud sitting on one corner of the loop, over the foot of the way on, so that nobody can see there is
 * one. The player's wind blows it apart. Until the story lets it go it gathers itself back up again.
 */
export class CloudBank {
  readonly mesh: THREE.Mesh;
  /** Whether a blow can scatter it for good; until then it heaps itself up again. */
  yielding = false;
  /** 1 while it sits there whole, down to 0 once it has blown away. */
  whole = 1;
  /** How much the player has worked at it, for the story to notice. */
  worked = 0;
  private gone = false;
  private readonly lumps: Lump[] = [];
  private readonly shown = { value: 0 };
  private readonly centres: THREE.BufferAttribute;
  private readonly alphas: THREE.BufferAttribute;
  private readonly right = new THREE.Vector3();
  private readonly up = new THREE.Vector3();
  private readonly tmp = new THREE.Vector3();

  constructor(readonly centre: THREE.Vector3, readonly radius: number, count = 22) {
    let seed = 11;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
    const puffs: Puff[] = [];
    for (let i = 0; i < count; i++) {
      const t = rnd() * Math.PI * 2, u = rnd() * 2 - 1, k = Math.cbrt(rnd());
      const home = new THREE.Vector3(Math.cos(t) * Math.sqrt(1 - u * u), u * 0.6, Math.sin(t) * Math.sqrt(1 - u * u))
        .multiplyScalar(radius * 0.6 * k).add(centre);
      const lump = { home, p: home.clone(), v: new THREE.Vector3(), r: radius * (0.7 + 0.35 * rnd()), a: 1 };
      this.lumps.push(lump);
      puffs.push({ x: home.x, y: home.y, z: home.z, r: lump.r, a: lump.a });
    }
    const geo = puffGeometry(puffs);
    this.centres = geo.getAttribute('aCentre') as THREE.BufferAttribute;
    this.alphas = geo.getAttribute('aAlpha') as THREE.BufferAttribute;
    this.centres.setUsage(THREE.DynamicDrawUsage);
    this.alphas.setUsage(THREE.DynamicDrawUsage);
    this.mesh = new THREE.Mesh(geo, puffMaterial(this.shown));
    this.mesh.name = 'stairs-cloud-bank';
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 6;
    this.mesh.visible = false;
  }

  /** 0 hides it, 1 shows it. */
  set amount(a: number) {
    this.shown.value = a;
    this.mesh.visible = a > 0.01 && this.whole > 0.01;
  }

  get cleared(): boolean {
    return this.gone;
  }

  /** A stroke across it carries the lumps it passes over the way the stroke went. */
  brush(camera: THREE.PerspectiveCamera, input: PointerInput, dt: number): void {
    if (!this.mesh.visible || this.gone || !input.present || input.muted || dt <= 0) return;
    const sx = (input.ndc.x - input.prevNdc.x) * camera.aspect, sy = input.ndc.y - input.prevNdc.y;
    if (sx * sx + sy * sy < 1e-8) return;
    this.right.setFromMatrixColumn(camera.matrixWorld, 0);
    this.up.setFromMatrixColumn(camera.matrixWorld, 1);
    const halfHeight = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
    for (const l of this.lumps) {
      const hit = screenBrush(camera, l.p, input.prevNdc, input.ndc, 0.2);
      if (hit <= 0) continue;
      const depth = l.p.distanceTo(camera.position) * halfHeight / dt;
      l.v.addScaledVector(this.right, sx * depth * hit * 0.35).addScaledVector(this.up, sy * depth * hit * 0.35);
      this.worked += hit * dt;
    }
  }

  update(dt: number, time: number): void {
    if (!this.mesh.visible && !this.gone) return;
    let spread = 0;
    this.lumps.forEach((l, i) => {
      l.v.multiplyScalar(Math.exp(-dt * (this.gone ? 0.4 : 1.6)));
      // Until it may go, it draws itself back together; the wind only ruffles it.
      if (!this.yielding) l.v.addScaledVector(this.tmp.subVectors(l.home, l.p), dt * 2.2);
      l.p.addScaledVector(l.v, dt);
      spread += Math.min(1, l.p.distanceTo(l.home) / (this.radius * 1.3));
      const breathe = this.gone ? 0 : 0.06 * Math.sin(time * 0.5 + i * 1.7);
      for (let c = 0; c < 4; c++) this.centres.setXYZ(i * 4 + c, l.p.x, l.p.y + breathe, l.p.z);
    });
    const whole = 1 - spread / this.lumps.length;
    if (this.yielding && !this.gone && whole < 0.55) this.gone = true;
    this.whole = this.gone ? Math.max(0, this.whole - dt / 2.5) : whole;
    this.lumps.forEach((l, i) => {
      for (let c = 0; c < 4; c++) this.alphas.setX(i * 4 + c, l.a * (this.gone ? this.whole : 1));
    });
    this.centres.needsUpdate = true;
    this.alphas.needsUpdate = true;
    if (this.gone && this.whole <= 0.01) this.mesh.visible = false;
  }

}
