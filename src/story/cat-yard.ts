import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { Cat, Floor } from '../creatures/cat';
import { Kittens } from '../creatures/cat/kittens';
import { CREATURE_GLSL } from '../creatures/shading';
import type { Traveller } from '../traveller/traveller';
import type { WindField } from '../wind/field';
import { ATMO_GLSL, atmo } from '../world/atmosphere';
import { heightAt } from '../world/island';
import { WashTub } from '../world/wash-tub';

const PROP_VERT = /* glsl */ `
${ATMO_GLSL}
in vec3 aTint;
out vec3 vWorld;
out vec3 vNormal;
out vec3 vTint;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  vNormal = normalize(mat3(modelMatrix) * normal);
  vTint = aTint;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const PROP_FRAG = /* glsl */ `
${ATMO_GLSL}
${CREATURE_GLSL}
in vec3 vWorld;
in vec3 vNormal;
in vec3 vTint;
void main() {
  vec3 N = normalize(vNormal) * (gl_FrontFacing ? 1.0 : -1.0);
  vec3 col = shadeCreature(vTint, N, vWorld, 1.0, 0.0, 0.0, 1.0) + vTint * uSkyAmbient * 0.6;
  gl_FragColor = vec4(max(applyFog(col, vWorld), 0.0), 1.0);
}`;

type Tint = [number, number, number];
const STONE: Tint = [0.24, 0.21, 0.19];
const BRICK: Tint = [0.33, 0.14, 0.09];
const SLATE: Tint = [0.11, 0.11, 0.13];
const WOOD: Tint = [0.3, 0.19, 0.11];
const PALE_WOOD: Tint = [0.38, 0.27, 0.16];
const IVY: Tint = [0.07, 0.13, 0.05];
const IRON: Tint = [0.12, 0.11, 0.1];
/** Everything built stands on the sea floor, well under the surface. */
const BED = -6;

function tinted(geo: THREE.BufferGeometry, tint: Tint): THREE.BufferGeometry {
  const g = geo.index ? geo.toNonIndexed() : geo;
  g.deleteAttribute('uv');
  const n = g.attributes.position.count;
  const c = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) c.set(tint, i * 3);
  g.setAttribute('aTint', new THREE.BufferAttribute(c, 3));
  return g;
}
const box = (w: number, h: number, d: number, x: number, y: number, z: number, tint: Tint) => tinted(new THREE.BoxGeometry(w, h, d).translate(x, y, z), tint);
/** A block from the sea bed up to `top`. */
const pier = (w: number, d: number, x: number, z: number, top: number, tint = STONE) => box(w, top - BED, d, x, (top + BED) / 2, z, tint);

/** A drowned house's roof running along z: walls up from the bed to the eaves, then the gable to the ridge. */
function roof(x: number, z0: number, z1: number, ridge: number, half: number, eave: number): THREE.BufferGeometry[] {
  const shape = new THREE.Shape([new THREE.Vector2(-half, eave), new THREE.Vector2(half, eave), new THREE.Vector2(0, ridge)]);
  return [
    tinted(new THREE.ExtrudeGeometry(shape, { depth: z1 - z0, bevelEnabled: false }).translate(x, 0, z0), SLATE),
    pier(half * 1.9, z1 - z0, x, (z0 + z1) / 2, eave, STONE),
  ];
}

/** The places in the yard, in its own space: x to the left of the way it faces, z ahead, y up from the sea. */
const FOOTPRINT = { x0: -4.5, x1: 4.5, z0: -1.5, z1: 19 };
const BLOCK = { x: 0, z: -0.3, top: 0.5, size: 1.4 };
const POT = new THREE.Vector3(1.6, 1.0, 1.0);
/** As wide as the model sheet draws it, so the frightened cat can be judged against it. */
const POT_R = 0.2;
const LITTLE_ROOF = { x: 1.6, z0: 0.4, z1: 1.6, ridge: 0.55, half: 0.85, eave: 0.12 };
const RIDGE = { x: -1.2, z0: 1.0, z1: 9.0, top: 1.5, half: 0.9, eave: 0.95 };
const RAIL = { x: -1.2, z0: 9.6, z1: 12.0, top: 0.95 };
const WALL_A = { z0: 12.4, z1: 13.4, top: 1.0 };
const WALL_B = { z0: 14.6, z1: 16.4, top: 1.1 };
/** The tower's face is at `z`; the opening in it is `half` either side of the ridge line, from `sill` to `head`, `deep` into it. */
const TOWER = { z: 16.8, top: 4.6, sill: 3.25, head: 4.15, half: 0.45, deep: 0.6, width: 1.8 };
const TUB_AT_POT = new THREE.Vector2(0.3, 1.0);
const TUB_AT_BOAT = new THREE.Vector2(1.6, 3.35);
const BOAT_AT = new THREE.Vector2(0.4, 3.4);
/** Where the cat sits in each, in its own space. */
const IN_TUB = new THREE.Vector3(0, WashTub.floor, 0);
const ON_THWART = new THREE.Vector3(0.6, 0.42, 0);
/** A quay she stands on, for the cat to rub against her legs and her to kneel to it. */
const QUAY = { x: 3.4, z0: 4.2, z1: 8.6, half: 0.9, top: 0.5 };
/** A loft floor with the kittens' straw on it and a sill along its far end. */
const LOFT = { x: 3.4, z0: 10, z1: 13, half: 0.9, top: 0.8, sill: 1.15, sillFrom: 12.6 };
const STRAW = new THREE.Vector3(3.4, 0.8, 11.3);
/** A mill's last sail turning about `pivot` across the yard, and its end, level with the ridge's slates at rest. */
const SAIL = { pivot: new THREE.Vector3(-3.5, 1.52, 4.0), arm: 2.2 };
/** A swing's seat hanging from `pivot` beside the railing's near end. */
const SWING = { pivot: new THREE.Vector3(-2.7, 3.7, 10.4), rope: 2.5 };
/** A dead tree standing in the water past the loft, and the stump of wall the cat sets off from. */
const TRUNK = { x: 3.4, z: 16.2, top: 3.4, r: 0.17 };
const STUB = { x: 3.4, z: 15.0, top: 0.6 };

function tower(): THREE.BufferGeometry[] {
  const { z, top, sill, head, half, deep, width } = TOWER;
  const x = RIDGE.x;
  const side = (width / 2 - half) / 2;
  return [
    box(width, sill - BED, width, x, (sill + BED) / 2, z + width / 2, STONE),
    box(width, top - head, width, x, (top + head) / 2, z + width / 2, STONE),
    box(width / 2 - half, head - sill, width, x + half + side, (sill + head) / 2, z + width / 2, STONE),
    box(width / 2 - half, head - sill, width, x - half - side, (sill + head) / 2, z + width / 2, STONE),
    box(half * 2, head - sill, width - deep, x, (sill + head) / 2, z + deep + (width - deep) / 2, [0.05, 0.045, 0.04]),
    ...Array.from({ length: 9 }, (_, i) => box(0.5 - (i % 3) * 0.08, 0.28, 0.03, x + ((i * 0.37) % 0.3) - 0.15, 0.9 + i * 0.26, z - 0.015, IVY)),
  ];
}

/**
 * QA only: stand-ins for the drowned village's places out on the sea beyond the QA stage's beach (a chimney pot on a
 * drowned roof, the real wash-tub afloat and a boat, a long roof ridge, a railing, two walls with a gap between them,
 * a tower with ivy and an opening, a mill's sail, a swing, a dead tree, a quay for her to stand on and a loft with the
 * kittens' straw), so every one of the cat's moves and feelings can be played by name from the capture tools.
 * `child`, set by a tool, lets the cat rub against her legs and her kneel to it.
 */
export class CatYard {
  readonly group = new THREE.Group();
  readonly tub: WashTub;
  readonly boat = new THREE.Group();
  readonly sail = new THREE.Group();
  readonly seat = new THREE.Group();
  readonly kittens = new Kittens();
  readonly floor: Floor;
  /** Where the child's head would be, sitting in the boat: what the cat looks at. */
  readonly watcher = new THREE.Vector3();
  child: Traveller | null = null;
  private cat: Cat | null = null;
  private readonly inverse = new THREE.Matrix4();
  private readonly card = new THREE.Mesh();
  private clock = 0;
  private turning = false;
  private timers: { at: number; act: () => void }[] = [];
  private sailAngle = 0;
  private swinging = 0;
  private kneelAt = -1;
  private readonly hand = new THREE.Vector3();
  private readonly face = new THREE.Vector3();
  private readonly local = new THREE.Vector3();

  /** Out from `from` along +z until the whole yard is over open water. */
  constructor(from: THREE.Vector3) {
    let z = from.z;
    const wet = (oz: number) => {
      for (let x = FOOTPRINT.x0; x <= FOOTPRINT.x1; x += 1) {
        for (let k = FOOTPRINT.z0; k <= FOOTPRINT.z1; k += 1) if (heightAt(from.x + x, oz + k) > -1) return false;
      }
      return true;
    };
    while (!wet(z) && z < from.z + 300) z += 2;
    this.group.position.set(from.x, 0, z);
    this.group.updateMatrixWorld(true);
    this.inverse.copy(this.group.matrixWorld).invert();
    const material = new THREE.ShaderMaterial({ uniforms: { ...atmo.uniforms }, vertexShader: PROP_VERT, fragmentShader: PROP_FRAG, side: THREE.DoubleSide });
    const parts = [
      pier(BLOCK.size, BLOCK.size, BLOCK.x, BLOCK.z, BLOCK.top),
      ...roof(LITTLE_ROOF.x, LITTLE_ROOF.z0, LITTLE_ROOF.z1, LITTLE_ROOF.ridge, LITTLE_ROOF.half, LITTLE_ROOF.eave),
      pier(0.5, 0.46, POT.x, POT.z, POT.y - 0.2, BRICK),
      tinted(new THREE.CylinderGeometry(POT_R, POT_R + 0.01, 0.2, 24).translate(POT.x, POT.y - 0.1, POT.z), [0.4, 0.2, 0.13]),
      ...roof(RIDGE.x, RIDGE.z0, RIDGE.z1, RIDGE.top, RIDGE.half, RIDGE.eave),
      pier(0.3, 0.3, RAIL.x, RAIL.z0 - 0.1, 0.97),
      pier(0.3, 0.3, RAIL.x, RAIL.z1 + 0.1, 0.97),
      box(0.05, 0.05, RAIL.z1 - RAIL.z0, RAIL.x, RAIL.top - 0.025, (RAIL.z0 + RAIL.z1) / 2, IRON),
      ...[0.2, 0.4, 0.6, 0.8].map((k) => box(0.02, RAIL.top + 1, 0.02, RAIL.x, (RAIL.top - 1) / 2, RAIL.z0 + (RAIL.z1 - RAIL.z0) * k, IRON)),
      pier(0.35, WALL_A.z1 - WALL_A.z0, RIDGE.x, (WALL_A.z0 + WALL_A.z1) / 2, WALL_A.top),
      pier(0.35, WALL_B.z1 - WALL_B.z0, RIDGE.x, (WALL_B.z0 + WALL_B.z1) / 2, WALL_B.top),
      ...tower(),
      pier(QUAY.half * 2, QUAY.z1 - QUAY.z0, QUAY.x, (QUAY.z0 + QUAY.z1) / 2, QUAY.top, PALE_WOOD),
      pier(LOFT.half * 2, LOFT.z1 - LOFT.z0, LOFT.x, (LOFT.z0 + LOFT.z1) / 2, LOFT.top, WOOD),
      box(LOFT.half * 2, LOFT.sill - LOFT.top, LOFT.z1 - LOFT.sillFrom, LOFT.x, (LOFT.sill + LOFT.top) / 2, (LOFT.sillFrom + LOFT.z1) / 2, STONE),
      pier(0.5, 0.5, SAIL.pivot.x, SAIL.pivot.z + 0.35, SAIL.pivot.y + 0.3, STONE),
      pier(0.12, 0.12, SWING.pivot.x, SWING.pivot.z - 1.2, SWING.pivot.y + 0.1, WOOD),
      pier(0.12, 0.12, SWING.pivot.x, SWING.pivot.z + 1.2, SWING.pivot.y + 0.1, WOOD),
      box(0.1, 0.1, 2.5, SWING.pivot.x, SWING.pivot.y, SWING.pivot.z, WOOD),
      tinted(new THREE.CylinderGeometry(TRUNK.r * 0.7, TRUNK.r, TRUNK.top - BED, 9).translate(TRUNK.x, (TRUNK.top + BED) / 2, TRUNK.z), [0.17, 0.15, 0.13]),
      tinted(new THREE.CylinderGeometry(0.05, 0.08, 1.2, 6).rotateZ(0.8).translate(TRUNK.x - 0.4, TRUNK.top + 0.3, TRUNK.z), [0.17, 0.15, 0.13]),
      tinted(new THREE.CylinderGeometry(0.05, 0.08, 1.1, 6).rotateZ(-0.7).translate(TRUNK.x + 0.35, TRUNK.top + 0.3, TRUNK.z + 0.1), [0.17, 0.15, 0.13]),
      pier(0.5, 0.6, STUB.x, STUB.z, STUB.top),
    ];
    this.group.add(new THREE.Mesh(mergeGeometries(parts), material));

    this.tub = new WashTub({ addSplat: () => undefined } as unknown as WindField);
    this.tub.visible = true;
    const boat = [
      box(2.6, 0.06, 0.9, 0, 0.04, 0, WOOD),
      box(2.6, 0.45, 0.05, 0, 0.25, 0.45, WOOD),
      box(2.6, 0.45, 0.05, 0, 0.25, -0.45, WOOD),
      box(0.05, 0.45, 0.9, -1.3, 0.25, 0, WOOD),
      box(0.05, 0.45, 0.9, 1.3, 0.25, 0, WOOD),
      box(0.22, 0.04, 0.86, ON_THWART.x, ON_THWART.y - 0.02, 0, PALE_WOOD),
      box(0.3, 0.04, 0.86, -0.7, 0.4, 0, PALE_WOOD),
    ];
    this.boat.add(new THREE.Mesh(mergeGeometries(boat), material));
    this.sail.position.copy(SAIL.pivot);
    this.sail.add(new THREE.Mesh(mergeGeometries([
      box(SAIL.arm, 0.08, 0.08, SAIL.arm / 2, 0, 0, WOOD),
      box(SAIL.arm * 0.8, 0.03, 0.03, SAIL.arm * 0.55, 0.28, 0.02, PALE_WOOD),
      box(SAIL.arm * 0.8, 0.03, 0.03, SAIL.arm * 0.55, -0.28, 0.02, PALE_WOOD),
      ...[0.3, 0.5, 0.7, 0.9].map((k) => box(0.03, 0.6, 0.03, SAIL.arm * k, 0, 0.02, PALE_WOOD)),
      box(0.42, 0.04, 0.32, SAIL.arm - 0.12, -0.02, 0, PALE_WOOD),
    ]), material));
    this.seat.position.copy(SWING.pivot);
    this.seat.add(new THREE.Mesh(mergeGeometries([
      box(0.02, SWING.rope, 0.02, 0, -SWING.rope / 2, -0.25, IRON),
      box(0.02, SWING.rope, 0.02, 0, -SWING.rope / 2, 0.25, IRON),
      box(0.3, 0.05, 0.6, 0, -SWING.rope - 0.025, 0, PALE_WOOD),
    ]), material));
    this.card.geometry = tinted(new THREE.PlaneGeometry(3, 2.2).translate(0, 0.6, 0), [0.36, 0.35, 0.34]);
    this.card.material = material;
    this.card.visible = false;
    this.group.add(this.boat, this.sail, this.seat, this.card, this.kittens.straw);
    this.kittens.lay(this.at(STRAW.x, STRAW.y, STRAW.z));
    this.kittens.straw.position.applyMatrix4(this.inverse);
    this.floor = (x, z) => this.floorAt(x, z);
    this.reset();
  }

  /** A plain card stood behind the cat from `eye`, as the model sheet's backdrop is, for close comparisons; null takes it down. */
  backdrop(eye: THREE.Vector3 | null, cat: THREE.Vector3): void {
    this.card.visible = eye !== null;
    if (!eye) return;
    const away = this.local.subVectors(cat, eye).setY(0).normalize();
    this.card.position.copy(cat).addScaledVector(away, 0.9).applyMatrix4(this.inverse);
    this.card.position.y = cat.y - 0.3 - this.group.position.y;
    this.card.rotation.set(0, Math.atan2(-away.x, -away.z) - this.group.rotation.y, 0);
  }

  /** Where the yard's own point is in the world. */
  at(x: number, y: number, z: number, out = new THREE.Vector3()): THREE.Vector3 {
    return out.set(x, y, z).applyMatrix4(this.group.matrixWorld);
  }

  /** A direction in the yard's space, in the world. */
  dir(x: number, y: number, z: number): THREE.Vector3 {
    return new THREE.Vector3(x, y, z).transformDirection(this.group.matrixWorld);
  }

  get yaw(): number {
    return this.group.rotation.y;
  }

  private floorAt(x: number, z: number): number {
    const p = this.local.set(x, 0, z).applyMatrix4(this.inverse);
    const inside = (cx: number, cz: number, hx: number, hz: number) => Math.abs(p.x - cx) <= hx && Math.abs(p.z - cz) <= hz;
    let top = -0.5;
    if (inside(BLOCK.x, BLOCK.z, BLOCK.size / 2, BLOCK.size / 2)) top = BLOCK.top;
    if (Math.hypot(p.x - POT.x, p.z - POT.z) < POT_R) top = POT.y;
    else if (inside(POT.x, POT.z, 0.25, 0.23)) top = POT.y - 0.2;
    for (const r of [RIDGE, { ...LITTLE_ROOF, top: LITTLE_ROOF.ridge }]) {
      const across = Math.abs(p.x - r.x);
      if (across < r.half && p.z >= r.z0 && p.z <= r.z1) top = Math.max(top, r.top - (across / r.half) * (r.top - r.eave));
    }
    const across = Math.abs(p.x - RIDGE.x);
    if (across < 0.15 && (Math.abs(p.z - (RAIL.z0 - 0.1)) < 0.15 || Math.abs(p.z - (RAIL.z1 + 0.1)) < 0.15)) top = Math.max(top, 0.97);
    if (across < 0.06 && p.z >= RAIL.z0 && p.z <= RAIL.z1) top = Math.max(top, RAIL.top);
    if (across < 0.18 && p.z >= WALL_A.z0 && p.z <= WALL_A.z1) top = Math.max(top, WALL_A.top);
    if (across < 0.18 && p.z >= WALL_B.z0 && p.z <= WALL_B.z1) top = Math.max(top, WALL_B.top);
    if (inside(QUAY.x, (QUAY.z0 + QUAY.z1) / 2, QUAY.half, (QUAY.z1 - QUAY.z0) / 2)) top = QUAY.top;
    if (inside(LOFT.x, (LOFT.z0 + LOFT.z1) / 2, LOFT.half, (LOFT.z1 - LOFT.z0) / 2)) top = p.z >= LOFT.sillFrom ? LOFT.sill : LOFT.top;
    if (inside(STUB.x, STUB.z, 0.25, 0.3)) top = STUB.top;
    return this.group.position.y + top;
  }

  /** Back where everything starts: the tub by the chimney, or else already brought to the boat. */
  reset(moored = false): void {
    this.clock = 0;
    this.timers = [];
    this.turning = false;
    this.sailAngle = 0;
    this.swinging = 0;
    this.kneelAt = -1;
    this.kittens.visible = false;
    const at = moored ? TUB_AT_BOAT : TUB_AT_POT;
    const w = this.at(at.x, 0, at.y);
    this.tub.place(w.x, w.z, 0.7);
    this.tub.water.x = w.x;
    this.tub.water.z = w.z;
    this.tub.water.r = 0.3;
    this.tub.laden = false;
    this.tub.goal = null;
    this.tub.held = true;
    this.child?.standUp();
    if (this.child) this.child.kneeling = 0;
    this.child?.reachFor(0, null);
    this.child?.reachFor(1, null);
    this.place();
  }

  /** The boat lies off the ridge bobbing and rocking as if afloat; the sail turns and the swing sways when set going. */
  private place(): void {
    const t = this.clock;
    this.boat.position.set(BOAT_AT.x, 0.03 * Math.sin(t * 0.9), BOAT_AT.y + 0.06 * Math.sin(t * 0.17));
    this.boat.rotation.set(0.02 * Math.sin(t * 0.8 + 2), -Math.PI / 2 + 0.03 * Math.sin(t * 0.2), 0.04 * Math.sin(t * 1.1));
    this.boat.updateMatrixWorld(true);
    this.watcher.set(-0.7, 0.95, 0).applyMatrix4(this.boat.matrixWorld);
    this.sail.rotation.set(0, 0, this.sailAngle);
    this.sail.updateMatrixWorld(true);
    this.seat.rotation.set(this.swinging * 0.5 * Math.sin(t * 1.9), 0, 0);
    this.seat.updateMatrixWorld(true);
  }

  /** The tub sets off toward the boat as the player's strokes would send it, and eases in once it is near. */
  drift(): void {
    const to = this.at(TUB_AT_BOAT.x, 0, TUB_AT_BOAT.y);
    this.tub.held = false;
    this.tub.water.x = to.x;
    this.tub.water.z = to.z;
    this.tub.water.r = 6;
    this.tub.goal = new THREE.Vector2(to.x, to.z);
    this.tub.velocity.set(to.x - this.tub.position.x, to.z - this.tub.position.z).normalize().multiplyScalar(0.9);
    this.tub.sinceBrushed = -30;
  }

  update(dt: number): void {
    this.clock += dt;
    for (const t of this.timers.filter((t) => t.at <= this.clock)) t.act();
    this.timers = this.timers.filter((t) => t.at > this.clock);
    if (this.turning) this.sailAngle = Math.min(1.05, this.sailAngle + dt * 0.3 * THREE.MathUtils.smoothstep(this.clock, 1.5, 2.5));
    this.place();
    this.tub.update(dt, atmo.uniforms.uTime.value);
    this.kittens.update(dt);
    /** Their mews are heard through hers; the pats of their paws are too small to carry. */
    for (const h of this.kittens.heard) if (h.kind === 'mew') this.cat?.heard.push(h);
    this.kittens.heard.length = 0;
    const cat = this.cat, child = this.child;
    if (this.kneelAt >= 0 && cat && child) {
      this.kneelAt += dt;
      cat.eye(this.face);
      child.lookAt = this.face;
      if (this.kneelAt > 0.4) child.kneeling = 1;
      if (this.kneelAt > 1.4) {
        this.hand.copy(this.face).setY(this.face.y + 0.12 * cat.scale);
        child.reachFor(1, this.hand);
        cat.nuzzle(this.hand);
      }
      if (this.kneelAt > 4.2 && this.kneelAt - dt <= 4.2) cat.slowBlink();
    }
  }

  /** Every action the cat has, by name, each set up from a place of its own in the yard so it can be looked at alone. */
  play(name: string, cat: Cat): boolean {
    if (!this.cat) cat.objects[0].parent?.add(...this.tub.objects, ...this.kittens.cats.flatMap((k) => k.objects));
    this.cat = cat;
    const yaw = this.yaw;
    const look = this.watcher;
    const block = this.at(BLOCK.x, BLOCK.top, BLOCK.z);
    const onRidge = (z: number, x = 0) => {
      const p = this.at(RIDGE.x + x, 0, z);
      p.y = this.floor(p.x, p.z);
      return p;
    };
    /** On the block it faces someone out on the water off its corner, which is where the camera is too. */
    const onlooker = this.at(2.4, 0.9, -2.6);
    const sitAt = (pose: 'sit' | 'stand' | 'crouch') => cat.place(block, Math.atan2(onlooker.x - block.x, onlooker.z - block.z) - 0.45, { pose, floor: this.floor });
    /** Far out over the water behind the yard, where the fog would be coming from. */
    const fog = this.at(-6, 1.2, -30);
    const church = this.at(0, 6, 60);
    this.reset();
    cat.visible = true;
    cat.unease = 0;
    cat.mewing = false;
    cat.curious = null;
    cat.shiver = 0;
    cat.wet = 0.35;
    cat.stare(null);
    cat.nuzzle(null);
    switch (name) {
      case 'sit':
      case 'stand':
      case 'crouch':
        sitAt(name);
        cat.look(onlooker);
        return true;
      case 'wash':
        sitAt('sit');
        cat.look(null);
        cat.wash();
        return true;
      case 'afraid':
        sitAt('stand');
        cat.look(onlooker);
        cat.afraid(1);
        return true;
      case 'mew':
        sitAt('sit');
        cat.look(onlooker);
        cat.mew(1);
        return true;
      case 'curious':
        sitAt('sit');
        cat.look(onlooker);
        cat.curious = onlooker;
        return true;
      case 'chirrup':
        sitAt('sit');
        cat.look(onlooker);
        cat.chirrup();
        return true;
      case 'slow-blink':
        sitAt('sit');
        cat.look(onlooker);
        this.after(0.6, () => cat.slowBlink());
        return true;
      case 'shiver':
        sitAt('sit');
        cat.look(onlooker);
        cat.wet = 1;
        cat.unease = 0.35;
        cat.shiver = 1;
        return true;
      case 'shake':
        sitAt('stand');
        cat.look(null);
        cat.wet = 1;
        this.after(0.4, () => cat.shake());
        return true;
      case 'stare':
        cat.place(onRidge(4.5), Math.atan2(fog.x - block.x, fog.z - block.z), { pose: 'crouch', floor: this.floor });
        cat.unease = 0.5;
        cat.stare(fog);
        return true;
      case 'strand': {
        const pot = this.at(POT.x, POT.y, POT.z);
        cat.place(pot, Math.atan2(church.x - pot.x, church.z - pot.z) + 0.3, { pose: 'sit' });
        cat.wet = 1;
        cat.shiver = 0.6;
        cat.strand(church);
        cat.rest('sit', church);
        return true;
      }
      case 'leap-pot': {
        cat.place(block, Math.atan2(POT.x - BLOCK.x, POT.z - BLOCK.z) + yaw, { pose: 'stand', floor: this.floor });
        cat.look(null);
        this.after(0.3, () => cat.leap(this.at(POT.x, POT.y, POT.z), { then: 'sit', look: church }));
        return true;
      }
      case 'hop-tub':
        cat.place(this.at(POT.x, POT.y, POT.z), yaw - 1.3, { pose: 'sit' });
        cat.wet = 1;
        cat.strand(look);
        cat.rest('sit', look);
        cat.hop(IN_TUB, { frame: this.tub.group, then: 'sit', look }, () => {
          cat.mewing = false;
          cat.unease = 0.8;
          this.tub.laden = true;
          this.drift();
        });
        return true;
      case 'ride-tub':
        this.drift();
        cat.place(IN_TUB, 0.4, { frame: this.tub.group, pose: 'sit' });
        this.tub.laden = true;
        cat.wet = 1;
        cat.unease = 0.8;
        cat.look(look);
        return true;
      case 'tub':
        this.tub.held = false;
        cat.visible = false;
        return true;
      case 'boat':
        cat.place(ON_THWART, Math.PI / 2, { frame: this.boat, pose: 'sit' });
        cat.look(look);
        cat.curious = look;
        return true;
      case 'jump-boat':
        this.reset(true);
        cat.place(IN_TUB, 0.5, { frame: this.tub.group, pose: 'sit' });
        this.tub.laden = true;
        cat.wet = 1;
        cat.unease = 0.8;
        cat.leap(ON_THWART, { frame: this.boat, yaw: Math.PI / 2, then: 'stand', look }, () => {
          cat.unease = 0.2;
          cat.chirrup();
          this.tub.laden = false;
          this.after(0.3, () => cat.shake());
          this.after(1.6, () => {
            cat.rest('sit', look);
            cat.shiver = 0.7;
          });
        });
        return true;
      case 'leap-roof':
        cat.place(ON_THWART, Math.PI / 2, { frame: this.boat, pose: 'sit' });
        cat.leap(onRidge(2.6), { floor: this.floor, then: 'stand', look: null }, () => cat.chirrup());
        return true;
      case 'leap-boat':
        cat.place(onRidge(3.4, 0.5), yaw + Math.PI / 2, { pose: 'stand', floor: this.floor });
        cat.look(null);
        this.after(0.3, () => cat.leap(ON_THWART, { frame: this.boat, yaw: Math.PI / 2, then: 'sit', look }));
        return true;
      case 'hop-down': {
        const end = onRidge(RIDGE.z0 + 0.15);
        cat.place(end, yaw + Math.PI, { pose: 'stand', floor: this.floor });
        cat.look(null);
        this.after(0.3, () => cat.hop(block.clone(), { floor: this.floor, then: 'sit', look: onlooker }));
        return true;
      }
      case 'walk':
      case 'trot':
      case 'run':
        cat.place(onRidge(1.2), yaw, { pose: 'stand', floor: this.floor });
        cat.look(null);
        cat.run(name === 'walk' ? [onRidge(2.6), onRidge(4.2, 0.1)] : [onRidge(3), onRidge(5, 0.15), onRidge(8.7)], this.floor, { pace: name, then: 'sit', look });
        return true;
      case 'scared-run':
      case 'bolt':
        cat.place(onRidge(1.2), yaw, { pose: 'stand', floor: this.floor });
        cat.look(null);
        cat.unease = 0.6;
        cat.afraid(1);
        cat.run([onRidge(3), onRidge(5, 0.15), onRidge(8.7)], this.floor, { pace: 'run', speed: 3.6, then: 'crouch', look });
        return true;
      case 'rail':
        cat.place(this.at(RAIL.x, 0.97, RAIL.z0 - 0.1), yaw, { pose: 'stand', floor: this.floor });
        cat.look(null);
        cat.run([this.at(RAIL.x, 0, RAIL.z0 + 0.1), this.at(RAIL.x, 0, RAIL.z1 - 0.05), this.at(RAIL.x, 0, RAIL.z1 + 0.1)], this.floor, { narrow: true, then: 'sit', look });
        return true;
      case 'gap':
        cat.place(this.at(RIDGE.x, WALL_A.top, WALL_A.z1 - 0.5), yaw, { pose: 'stand', floor: this.floor });
        cat.look(null);
        cat.run([this.at(RIDGE.x, 0, WALL_A.z1 - 0.12)], this.floor, { pace: 'walk', then: 'stand' }, () => {
          cat.leap(this.at(RIDGE.x, WALL_B.top, WALL_B.z0 + 0.25), { floor: this.floor, arc: 0.35, then: 'sit', look }, () => cat.chirrup());
        });
        return true;
      case 'climb': {
        cat.place(this.at(RIDGE.x, WALL_B.top, WALL_B.z1 - 0.3), yaw, { pose: 'stand', floor: this.floor });
        cat.look(null);
        const face = (y: number, x = 0) => this.at(RIDGE.x + x, y, TOWER.z);
        cat.climb([face(1.5), face(2.1, 0.06), face(2.7, -0.05), face(TOWER.sill - 0.25), this.at(RIDGE.x, TOWER.sill, TOWER.z + 0.3)], this.dir(0, 0, -1), { then: 'sit', look });
        return true;
      }
      case 'climb-trunk': {
        cat.place(this.at(STUB.x, STUB.top, STUB.z - 0.1), yaw, { pose: 'stand', floor: this.floor });
        cat.look(null);
        const face = (y: number, x = 0) => this.at(TRUNK.x + x, y, TRUNK.z - TRUNK.r - 0.02);
        cat.climb([face(1.0), face(1.8, 0.04), face(2.6, -0.03), face(TRUNK.top - 0.15), this.at(TRUNK.x - 0.12, TRUNK.top + 0.08, TRUNK.z)], this.dir(0, 0, -1), { then: 'sit', look: onlooker, speed: 1.1 });
        return true;
      }
      case 'ride-sail': {
        cat.place(onRidge(SAIL.pivot.z - 1.1, -0.15), yaw, { pose: 'stand', floor: this.floor });
        cat.look(null);
        const end = new THREE.Vector3(SAIL.arm - 0.12, 0.0, 0);
        this.after(0.2, () => cat.hop(end, { frame: this.sail, upright: true, yaw: -Math.PI / 2, then: 'crouch', look: onlooker }, () => {
          this.turning = true;
          this.clock = 0;
        }));
        return true;
      }
      case 'ride-swing': {
        cat.place(this.at(RAIL.x, 0.97, RAIL.z0 - 0.1), yaw - Math.PI / 2, { pose: 'stand', floor: this.floor });
        cat.look(null);
        this.after(0.2, () => cat.leap(new THREE.Vector3(0, -SWING.rope, 0), { frame: this.seat, upright: true, yaw: 0, then: 'crouch', look: onlooker }, () => {
          this.swinging = 1;
          this.clock = 0;
        }));
        return true;
      }
      case 'press': {
        const child = this.child;
        const her = this.at(QUAY.x, QUAY.top, (QUAY.z0 + QUAY.z1) / 2 - 0.4);
        const facing = yaw - Math.PI / 2;
        if (child) {
          child.decks = [{ x0: her.x, z0: her.z - 2, x1: her.x, z1: her.z + 2, halfWidth: 0.9, height: QUAY.top }];
          child.place(her.x, her.z, facing);
          child.position.y = her.y;
        }
        cat.place(this.at(QUAY.x - 0.4, QUAY.top, QUAY.z1 - 0.4), yaw + Math.PI, { pose: 'stand', floor: this.floor });
        cat.wet = 0.8;
        const face = this.at(QUAY.x - 0.05, QUAY.top + 0.85, (QUAY.z0 + QUAY.z1) / 2 - 0.4);
        cat.look(face);
        cat.press(her, facing, this.floor, face, () => {
          this.kneelAt = 0;
        });
        return true;
      }
      case 'curl':
      case 'kittens': {
        const nest = this.at(STRAW.x, STRAW.y, STRAW.z);
        this.kittens.visible = true;
        cat.place(nest.clone().setY(nest.y + 0.03), yaw + 2.2, { pose: 'curl', floor: () => nest.y + 0.03 });
        cat.look(name === 'kittens' ? null : this.kittens.centre);
        this.kittens.nestle(cat);
        return true;
      }
      case 'tumble': {
        const nest = this.at(STRAW.x, STRAW.y, STRAW.z);
        this.kittens.visible = true;
        this.kittens.tumble();
        cat.place(this.at(STRAW.x - 0.7, LOFT.top, STRAW.z - 0.4), yaw + 0.9, { pose: 'sit', floor: this.floor });
        cat.look(nest);
        return true;
      }
      case 'sill': {
        this.kittens.visible = true;
        this.kittens.tumble();
        const sill = this.at(STRAW.x + 0.15, LOFT.sill, LOFT.sillFrom + 0.2);
        cat.place(sill, yaw, { pose: 'sit', floor: this.floor });
        const below = this.at(STRAW.x, 0, STRAW.z + 12);
        cat.look(below);
        this.after(0.5, () => this.kittens.toSill(0, this.at(STRAW.x - 0.25, LOFT.sill, LOFT.sillFrom + 0.15), below));
        return true;
      }
      default:
        return false;
    }
  }

  /** Runs `act` `seconds` from now on the yard's own clock, for actions that start a moment after they are set up. */
  private after(seconds: number, act: () => void): void {
    this.timers.push({ at: this.clock + seconds, act });
  }
}
