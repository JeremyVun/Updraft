import * as THREE from 'three';
import type { PointerInput } from '../input/pointer';
import { screenBrush } from '../creatures/motion';
import { HEAP_LUMPS, hazeHeapMaterial } from './stairs-haze';

interface Lump { home: THREE.Vector3; p: THREE.Vector3; v: THREE.Vector3; r: number }

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
  private shown = 0;
  private readonly lumps: Lump[] = [];
  private readonly material: THREE.ShaderMaterial;
  private readonly right = new THREE.Vector3();
  private readonly up = new THREE.Vector3();
  private readonly tmp = new THREE.Vector3();
  private readonly lo = new THREE.Vector3();
  private readonly hi = new THREE.Vector3();

  /** `floor` is the height of the corner it sits on. */
  constructor(readonly centre: THREE.Vector3, readonly radius: number, floor: number) {
    let seed = 11;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
    // A big lump in the middle, a ring of smaller ones round its foot, and a few riding on top.
    const ring = HEAP_LUMPS - 5;
    for (let i = 0; i < HEAP_LUMPS; i++) {
      const t = (i / ring) * Math.PI * 2 + rnd() * 0.6;
      const home = i === 0 ? new THREE.Vector3(0, radius * 0.05, 0)
        : i <= ring ? new THREE.Vector3(Math.cos(t) * radius * 0.72, -radius * 0.12 + rnd() * radius * 0.1, Math.sin(t) * radius * 0.72)
          : new THREE.Vector3(Math.cos(t * 1.7) * radius * 0.35, radius * (0.42 + 0.1 * rnd()), Math.sin(t * 1.7) * radius * 0.35);
      home.add(centre);
      const r = radius * (i === 0 ? 0.8 : i <= ring ? 0.48 + 0.14 * rnd() : 0.42 + 0.1 * rnd());
      this.lumps.push({ home, p: home.clone(), v: new THREE.Vector3(), r });
    }
    this.material = hazeHeapMaterial(floor);
    this.mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), this.material);
    this.mesh.name = 'stairs-cloud-bank';
    this.mesh.frustumCulled = false;
    // Under the sweep that invites the player to blow it away.
    this.mesh.renderOrder = 4;
    this.mesh.visible = false;
  }

  /** 0 hides it, 1 shows it. */
  set amount(a: number) {
    this.shown = a;
    // Until it has gone for good it is always there to be blown at, however far a stroke has flung its lumps.
    this.mesh.visible = a > 0.01 && (!this.gone || this.whole > 0.01);
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
      const reach = THREE.MathUtils.clamp(l.r / (l.p.distanceTo(camera.position) * halfHeight), 0.08, 0.3);
      const hit = screenBrush(camera, l.p, input.prevNdc, input.ndc, reach);
      if (hit <= 0) continue;
      const depth = l.p.distanceTo(camera.position) * halfHeight / dt;
      l.v.addScaledVector(this.right, sx * depth * hit * 0.35).addScaledVector(this.up, sy * depth * hit * 0.35);
      this.worked += hit * dt;
    }
  }

  update(dt: number): void {
    if (this.shown <= 0.01 && !this.gone) return;
    let spread = 0;
    this.lo.set(Infinity, Infinity, Infinity);
    this.hi.set(-Infinity, -Infinity, -Infinity);
    const u = this.material.uniforms;
    this.lumps.forEach((l, i) => {
      l.v.multiplyScalar(Math.exp(-dt * (this.gone ? 0.4 : 1.6)));
      // Until it may go, it draws itself back together; the wind only ruffles it.
      if (!this.yielding) l.v.addScaledVector(this.tmp.subVectors(l.home, l.p), dt * 2.2);
      l.p.addScaledVector(l.v, dt);
      spread += Math.min(1, l.p.distanceTo(l.home) / (this.radius * 1.3));
      // Blown away, a lump draws out thinner as it goes.
      const r = l.r * (this.gone ? 0.6 + 0.4 * this.whole : 1);
      u.uLumps.value[i].set(l.p.x, l.p.y, l.p.z, r);
      this.lo.min(this.tmp.copy(l.p).subScalar(r));
      this.hi.max(this.tmp.copy(l.p).addScalar(r));
    });
    const whole = 1 - spread / this.lumps.length;
    if (this.yielding && !this.gone && whole < 0.55) this.gone = true;
    this.whole = this.gone ? Math.max(0, this.whole - dt / 2.5) : whole;
    u.uBoxMin.value.copy(this.lo);
    u.uBoxMax.value.copy(this.hi);
    u.uWhole.value = this.shown * (this.gone ? this.whole : 1);
    this.mesh.position.copy(this.lo).add(this.hi).multiplyScalar(0.5);
    this.mesh.scale.subVectors(this.hi, this.lo);
    if (this.gone && this.whole <= 0.01) this.mesh.visible = false;
  }
}
