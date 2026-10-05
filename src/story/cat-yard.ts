import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { Cat, Floor } from '../creatures/cat';
import { CREATURE_GLSL } from '../creatures/shading';
import { ATMO_GLSL, atmo } from '../world/atmosphere';
import { heightAt } from '../world/island';

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
const FOOTPRINT = { x0: -3, x1: 3, z0: -1.5, z1: 19 };
const BLOCK = { x: 0, z: -0.3, top: 0.5, size: 1.4 };
const POT = new THREE.Vector3(1.6, 1.0, 1.0);
const LITTLE_ROOF = { x: 1.6, z0: 0.4, z1: 1.6, ridge: 0.55, half: 0.85, eave: 0.12 };
const RIDGE = { x: -1.2, z0: 1.0, z1: 9.0, top: 1.5, half: 0.9, eave: 0.95 };
const RAIL = { x: -1.2, z0: 9.6, z1: 12.0, top: 0.95 };
const WALL_A = { z0: 12.4, z1: 13.4, top: 1.0 };
const WALL_B = { z0: 14.6, z1: 16.4, top: 1.1 };
/** The tower's face is at `z`; the opening in it is `half` either side of the ridge line, from `sill` to `head`, `deep` into it. */
const TOWER = { z: 16.8, top: 4.2, sill: 3.25, head: 3.9, half: 0.3, deep: 0.45, width: 1.6 };
const TUB_AT_POT = new THREE.Vector2(0.3, 1.0);
const TUB_AT_BOAT = new THREE.Vector2(1.33, 3.35);
const BOAT_AT = new THREE.Vector2(0.4, 3.4);
/** Where the cat sits in each, in its own space. */
const IN_TUB = new THREE.Vector3(0, 0.04, 0);
const ON_THWART = new THREE.Vector3(0.6, 0.42, 0);

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
 * drowned roof, a wash-tub and a boat that drift and rock, a long roof ridge, a railing, two walls with a gap between
 * them, a tower with ivy and an opening, and a block of wall to sit on), so every one of the cat's actions can be
 * played by name from the capture tools.
 */
export class CatYard {
  readonly group = new THREE.Group();
  readonly tub = new THREE.Group();
  readonly boat = new THREE.Group();
  readonly floor: Floor;
  /** Where the child's head would be, sitting in the boat: what the cat looks at. */
  readonly watcher = new THREE.Vector3();
  private readonly inverse = new THREE.Matrix4();
  private readonly card = new THREE.Mesh();
  private clock = 0;
  private drifting = false;
  private moored = 0;
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
      pier(0.4, 0.32, POT.x, POT.z, POT.y - 0.2, BRICK),
      tinted(new THREE.CylinderGeometry(0.12, 0.13, 0.2, 14).translate(POT.x, POT.y - 0.1, POT.z), [0.4, 0.2, 0.13]),
      ...roof(RIDGE.x, RIDGE.z0, RIDGE.z1, RIDGE.top, RIDGE.half, RIDGE.eave),
      pier(0.3, 0.3, RAIL.x, RAIL.z0 - 0.1, 0.97),
      pier(0.3, 0.3, RAIL.x, RAIL.z1 + 0.1, 0.97),
      box(0.05, 0.05, RAIL.z1 - RAIL.z0, RAIL.x, RAIL.top - 0.025, (RAIL.z0 + RAIL.z1) / 2, IRON),
      ...[0.2, 0.4, 0.6, 0.8].map((k) => box(0.02, RAIL.top + 1, 0.02, RAIL.x, (RAIL.top - 1) / 2, RAIL.z0 + (RAIL.z1 - RAIL.z0) * k, IRON)),
      pier(0.35, WALL_A.z1 - WALL_A.z0, RIDGE.x, (WALL_A.z0 + WALL_A.z1) / 2, WALL_A.top),
      pier(0.35, WALL_B.z1 - WALL_B.z0, RIDGE.x, (WALL_B.z0 + WALL_B.z1) / 2, WALL_B.top),
      ...tower(),
    ];
    this.group.add(new THREE.Mesh(mergeGeometries(parts), material));

    const tub = [
      tinted(new THREE.CylinderGeometry(0.4, 0.35, 0.22, 24, 1, true).translate(0, 0.11, 0), WOOD),
      tinted(new THREE.CircleGeometry(0.34, 24).rotateX(-Math.PI / 2).translate(0, 0.04, 0), WOOD),
    ];
    this.tub.add(new THREE.Mesh(mergeGeometries(tub), material));
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
    this.card.geometry = tinted(new THREE.PlaneGeometry(3, 2.2).translate(0, 0.6, 0), [0.36, 0.35, 0.34]);
    this.card.material = material;
    this.card.visible = false;
    this.group.add(this.tub, this.boat, this.card);
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
    if (Math.hypot(p.x - POT.x, p.z - POT.z) < 0.13) top = POT.y;
    else if (inside(POT.x, POT.z, 0.2, 0.16)) top = POT.y - 0.2;
    for (const r of [RIDGE, { ...LITTLE_ROOF, top: LITTLE_ROOF.ridge }]) {
      const across = Math.abs(p.x - r.x);
      if (across < r.half && p.z >= r.z0 && p.z <= r.z1) top = Math.max(top, r.top - (across / r.half) * (r.top - r.eave));
    }
    const across = Math.abs(p.x - RIDGE.x);
    if (across < 0.15 && (Math.abs(p.z - (RAIL.z0 - 0.1)) < 0.15 || Math.abs(p.z - (RAIL.z1 + 0.1)) < 0.15)) top = Math.max(top, 0.97);
    if (across < 0.06 && p.z >= RAIL.z0 && p.z <= RAIL.z1) top = Math.max(top, RAIL.top);
    if (across < 0.18 && p.z >= WALL_A.z0 && p.z <= WALL_A.z1) top = Math.max(top, WALL_A.top);
    if (across < 0.18 && p.z >= WALL_B.z0 && p.z <= WALL_B.z1) top = Math.max(top, WALL_B.top);
    return this.group.position.y + top;
  }

  /** Back where everything starts: the tub by the chimney, or else already brought to the boat. */
  reset(moored = false): void {
    this.clock = 0;
    this.drifting = false;
    this.moored = moored ? 1 : 0;
    this.place();
  }

  /** The tub wanders by the chimney and the boat lies off the ridge, both bobbing and rocking as if afloat. */
  private place(): void {
    const t = this.clock;
    const drift = this.drifting ? THREE.MathUtils.smoothstep(t, 0, 8) : this.moored;
    const wander = 1 - drift;
    this.tub.position.set(
      THREE.MathUtils.lerp(TUB_AT_POT.x, TUB_AT_BOAT.x, drift) + 0.1 * Math.sin(t * 0.31) * wander,
      0.03 + 0.02 * Math.sin(t * 1.1),
      THREE.MathUtils.lerp(TUB_AT_POT.y, TUB_AT_BOAT.y, drift) + 0.08 * Math.cos(t * 0.23) * wander,
    );
    this.tub.rotation.set(0.05 * Math.sin(t * 1.7 + 1), t * 0.05, 0.06 * Math.sin(t * 1.3));
    this.boat.position.set(BOAT_AT.x, 0.03 * Math.sin(t * 0.9), BOAT_AT.y + 0.06 * Math.sin(t * 0.17));
    this.boat.rotation.set(0.02 * Math.sin(t * 0.8 + 2), -Math.PI / 2 + 0.03 * Math.sin(t * 0.2), 0.04 * Math.sin(t * 1.1));
    this.boat.updateMatrixWorld(true);
    this.watcher.set(-0.7, 0.95, 0).applyMatrix4(this.boat.matrixWorld);
  }

  /** The tub sets off toward the boat, as the player's gusts would carry it. */
  drift(): void {
    this.drifting = true;
    this.clock = 0;
  }

  update(dt: number): void {
    this.clock += dt;
    this.place();
  }

  /** Every action the cat has, by name, each set up from a place of its own in the yard so it can be looked at alone. */
  play(name: string, cat: Cat): boolean {
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
    cat.visible = true;
    cat.unease = 0;
    cat.mewing = false;
    cat.curious = null;
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
      case 'chirrup':
        sitAt('sit');
        cat.look(onlooker);
        cat.chirrup();
        return true;
      case 'strand': {
        this.reset();
        const pot = this.at(POT.x, POT.y, POT.z);
        cat.place(pot, Math.atan2(look.x - pot.x, look.z - pot.z) + 0.5, { pose: 'crouch' });
        cat.strand(look);
        return true;
      }
      case 'hop-tub':
        this.reset();
        cat.place(this.at(POT.x, POT.y, POT.z), yaw - 1.3, { pose: 'crouch' });
        cat.strand(look);
        cat.hop(IN_TUB, { frame: this.tub, then: 'sit', look }, () => {
          cat.mewing = false;
          cat.unease = 0.8;
          this.drift();
        });
        return true;
      case 'ride-tub':
        this.reset();
        this.drift();
        cat.place(IN_TUB, 0.4, { frame: this.tub, pose: 'sit' });
        cat.unease = 0.8;
        cat.look(look);
        return true;
      case 'boat':
        cat.place(ON_THWART, Math.PI / 2, { frame: this.boat, pose: 'sit' });
        cat.look(look);
        cat.curious = look;
        return true;
      case 'jump-boat':
        this.reset(true);
        cat.place(IN_TUB, 0.5, { frame: this.tub, pose: 'sit' });
        cat.unease = 0.8;
        cat.leap(ON_THWART, { frame: this.boat, yaw: Math.PI / 2, then: 'sit', look }, () => {
          cat.unease = 0;
          cat.chirrup();
        });
        return true;
      case 'leap-roof':
        cat.place(ON_THWART, Math.PI / 2, { frame: this.boat, pose: 'sit' });
        cat.leap(onRidge(2.6), { floor: this.floor, then: 'stand', look: null }, () => cat.chirrup());
        return true;
      case 'walk':
      case 'trot':
      case 'run':
        cat.place(onRidge(1.2), yaw, { pose: 'stand', floor: this.floor });
        cat.look(null);
        cat.run([onRidge(3), onRidge(5, 0.15), onRidge(8.7)], this.floor, { pace: name, then: 'sit', look });
        return true;
      case 'scared-run':
        cat.place(onRidge(1.2), yaw, { pose: 'stand', floor: this.floor });
        cat.look(null);
        cat.unease = 0.6;
        cat.run([onRidge(3), onRidge(5, 0.15), onRidge(8.7)], this.floor, { pace: 'run', then: 'crouch', look });
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
          cat.leap(this.at(RIDGE.x, WALL_B.top, WALL_B.z0 + 0.2), { floor: this.floor, arc: 0.35, then: 'sit', look }, () => cat.chirrup());
        });
        return true;
      case 'climb': {
        cat.place(this.at(RIDGE.x, WALL_B.top, WALL_B.z1 - 0.25), yaw, { pose: 'stand', floor: this.floor });
        cat.look(null);
        const face = (y: number, x = 0) => this.at(RIDGE.x + x, y, TOWER.z);
        cat.climb([face(1.5), face(2.1, 0.06), face(2.7, -0.05), face(TOWER.sill - 0.2), this.at(RIDGE.x, TOWER.sill, TOWER.z + 0.2)], this.dir(0, 0, -1), { then: 'crouch', look });
        return true;
      }
      default:
        return false;
    }
  }
}
