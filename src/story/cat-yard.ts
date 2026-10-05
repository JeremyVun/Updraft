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

const STONE: [number, number, number] = [0.24, 0.21, 0.19];
const BRICK: [number, number, number] = [0.33, 0.14, 0.09];
const SLATE: [number, number, number] = [0.11, 0.11, 0.13];
const WOOD: [number, number, number] = [0.3, 0.19, 0.11];
const IVY: [number, number, number] = [0.07, 0.13, 0.05];
const IRON: [number, number, number] = [0.12, 0.11, 0.1];

function tinted(geo: THREE.BufferGeometry, tint: [number, number, number]): THREE.BufferGeometry {
  const g = geo.index ? geo.toNonIndexed() : geo;
  g.deleteAttribute('uv');
  const n = g.attributes.position.count;
  const c = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) c.set(tint, i * 3);
  g.setAttribute('aTint', new THREE.BufferAttribute(c, 3));
  return g;
}
const box = (w: number, h: number, d: number, x: number, y: number, z: number, tint: [number, number, number]) =>
  tinted(new THREE.BoxGeometry(w, h, d).translate(x, y, z), tint);

/** A gable roof running along z: ridge height, half-width across x, eave height. */
function gable(x: number, z0: number, z1: number, ridge: number, half: number, eave: number): THREE.BufferGeometry {
  const shape = new THREE.Shape([new THREE.Vector2(-half, 0), new THREE.Vector2(half, 0), new THREE.Vector2(half, eave), new THREE.Vector2(0, ridge), new THREE.Vector2(-half, eave)]);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: z1 - z0, bevelEnabled: false }).translate(x, 0, z0);
  return tinted(geo, SLATE);
}

/** A tower of stone with an opening in its face high up, deep enough for a cat to sit in. */
function tower(): THREE.BufferGeometry[] {
  const { z, top, sill, head, half, deep, width } = TOWER;
  const x = RIDGE.x;
  const side = (width / 2 - half) / 2;
  return [
    box(width, sill, width, x, sill / 2, z + width / 2, STONE),
    box(width, top - head, width, x, (top + head) / 2, z + width / 2, STONE),
    box(width / 2 - half, head - sill, width, x + half + side, (sill + head) / 2, z + width / 2, STONE),
    box(width / 2 - half, head - sill, width, x - half - side, (sill + head) / 2, z + width / 2, STONE),
    box(half * 2, head - sill, width - deep, x, (sill + head) / 2, z + deep + (width - deep) / 2, [0.05, 0.045, 0.04]),
  ];
}

/** The places in the yard, in its own space: x to the left of the way it faces, z ahead. */
const PLAZA = { x0: -3, x1: 3, z0: -1.5, z1: 15 };
/** Where the tub and the boat float. */
const POND = { x0: -0.6, x1: 2.6, z0: 1.3, z1: 4.6 };
const POT = new THREE.Vector3(1.6, 1.22, 1.0);
const RIDGE = { x: -1.6, z0: 1.0, z1: 5.0, top: 1.5, half: 0.9, eave: 0.95 };
const RAIL = { x: -1.6, z0: 5.6, z1: 8.0, top: 0.95 };
const WALL_A = { z0: 8.3, z1: 9.4, top: 1.0 };
const WALL_B = { z0: 10.6, z1: 12.4, top: 1.1 };
/** The tower's face is at `z`; the opening in it is `half` either side of the ridge line, from `sill` to `head`, `deep` into it. */
const TOWER = { z: 12.8, top: 4.2, sill: 3.25, head: 3.9, half: 0.3, deep: 0.45, width: 1.6 };
const TUB_AT_POT = new THREE.Vector2(POT.x - 0.05, POT.z + 0.62);
const TUB_AT_BOAT = new THREE.Vector2(1.17, 3.55);

/**
 * QA only: stand-ins for the drowned village's places beside the QA stage (a chimney pot, a wash-tub and a boat that
 * drift and rock, a roof ridge, a railing, two walls with a gap between them, and a tower with ivy and an opening),
 * so every one of the cat's actions can be played by name from the capture tools.
 */
export class CatYard {
  readonly group = new THREE.Group();
  readonly tub = new THREE.Group();
  readonly boat = new THREE.Group();
  readonly floor: Floor;
  private readonly origin = new THREE.Vector3();
  private readonly inverse = new THREE.Matrix4();
  private clock = 0;
  private drifting = false;
  private readonly local = new THREE.Vector3();

  constructor(at: THREE.Vector3, yaw: number) {
    /** It stands on a flat plaza as high as the highest ground under it, so a slope buries nothing. */
    let base = -Infinity;
    for (let x = PLAZA.x0; x <= PLAZA.x1; x += 0.5) {
      for (let z = PLAZA.z0; z <= PLAZA.z1; z += 0.5) {
        base = Math.max(base, heightAt(at.x + Math.cos(yaw) * x + Math.sin(yaw) * z, at.z - Math.sin(yaw) * x + Math.cos(yaw) * z));
      }
    }
    this.origin.set(at.x, base + 0.02, at.z);
    this.group.position.copy(this.origin);
    this.group.rotation.y = yaw;
    this.group.updateMatrixWorld(true);
    this.inverse.copy(this.group.matrixWorld).invert();
    const material = new THREE.ShaderMaterial({ uniforms: { ...atmo.uniforms }, vertexShader: PROP_VERT, fragmentShader: PROP_FRAG, side: THREE.DoubleSide });
    const parts = [
      box(PLAZA.x1 - PLAZA.x0, 8, PLAZA.z1 - PLAZA.z0, (PLAZA.x0 + PLAZA.x1) / 2, -4, (PLAZA.z0 + PLAZA.z1) / 2, [0.2, 0.19, 0.17]),
      box(POND.x1 - POND.x0, 0.02, POND.z1 - POND.z0, (POND.x0 + POND.x1) / 2, 0.005, (POND.z0 + POND.z1) / 2, [0.03, 0.06, 0.07]),
      box(0.5, 1.0, 0.36, POT.x, 0.5, POT.z, BRICK),
      tinted(new THREE.CylinderGeometry(0.12, 0.13, 0.22, 14).translate(POT.x, 1.11, POT.z), [0.4, 0.2, 0.13]),
      gable(RIDGE.x, RIDGE.z0, RIDGE.z1, RIDGE.top, RIDGE.half, RIDGE.eave),
      box(0.3, 0.97, 0.3, RAIL.x, 0.485, RAIL.z0 - 0.1, STONE),
      box(0.3, 0.97, 0.3, RAIL.x, 0.485, RAIL.z1 + 0.1, STONE),
      box(0.05, 0.05, RAIL.z1 - RAIL.z0, RAIL.x, RAIL.top - 0.025, (RAIL.z0 + RAIL.z1) / 2, IRON),
      ...[0.2, 0.4, 0.6, 0.8].map((k) => box(0.02, RAIL.top, 0.02, RAIL.x, RAIL.top / 2, RAIL.z0 + (RAIL.z1 - RAIL.z0) * k, IRON)),
      box(0.35, WALL_A.top, WALL_A.z1 - WALL_A.z0, RIDGE.x, WALL_A.top / 2, (WALL_A.z0 + WALL_A.z1) / 2, STONE),
      box(0.35, WALL_B.top, WALL_B.z1 - WALL_B.z0, RIDGE.x, WALL_B.top / 2, (WALL_B.z0 + WALL_B.z1) / 2, STONE),
      ...tower(),
      ...Array.from({ length: 9 }, (_, i) => box(0.5 - (i % 3) * 0.08, 0.28, 0.03, RIDGE.x + ((i * 0.37) % 0.3) - 0.15, 1.2 + i * 0.24, TOWER.z - 0.015, IVY)),
    ];
    this.group.add(new THREE.Mesh(mergeGeometries(parts), material));

    const tub = [
      tinted(new THREE.CylinderGeometry(0.34, 0.3, 0.22, 20, 1, true).translate(0, 0.11, 0), WOOD),
      tinted(new THREE.CircleGeometry(0.29, 20).rotateX(-Math.PI / 2).translate(0, 0.04, 0), WOOD),
    ];
    this.tub.add(new THREE.Mesh(mergeGeometries(tub), material));
    const boat = [
      box(2.6, 0.06, 0.9, 0, 0.04, 0, WOOD),
      box(2.6, 0.45, 0.05, 0, 0.25, 0.45, WOOD),
      box(2.6, 0.45, 0.05, 0, 0.25, -0.45, WOOD),
      box(0.05, 0.45, 0.9, -1.3, 0.25, 0, WOOD),
      box(0.05, 0.45, 0.9, 1.3, 0.25, 0, WOOD),
      box(0.22, 0.04, 0.86, 0.6, 0.4, 0, [0.38, 0.27, 0.16]),
      box(0.4, 0.04, 0.86, 1.08, 0.46, 0, [0.38, 0.27, 0.16]),
    ];
    this.boat.add(new THREE.Mesh(mergeGeometries(boat), material));
    this.group.add(this.tub, this.boat);
    this.floor = (x, z) => this.floorAt(x, z);
    this.reset();
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
    const onPlaza = p.x >= PLAZA.x0 && p.x <= PLAZA.x1 && p.z >= PLAZA.z0 && p.z <= PLAZA.z1;
    let top = onPlaza ? 0 : heightAt(x, z) - this.origin.y;
    const inside = (x0: number, x1: number, z0: number, z1: number) => p.x >= x0 && p.x <= x1 && p.z >= z0 && p.z <= z1;
    if (Math.hypot(p.x - POT.x, p.z - POT.z) < 0.13) top = Math.max(top, POT.y);
    else if (inside(POT.x - 0.25, POT.x + 0.25, POT.z - 0.18, POT.z + 0.18)) top = Math.max(top, 1.0);
    const across = Math.abs(p.x - RIDGE.x);
    if (across < RIDGE.half && p.z >= RIDGE.z0 && p.z <= RIDGE.z1) top = Math.max(top, RIDGE.top - (across / RIDGE.half) * (RIDGE.top - RIDGE.eave));
    if (across < 0.15 && p.z > RAIL.z0 - 0.25 && p.z < RAIL.z0 + 0.05) top = Math.max(top, 0.97);
    if (across < 0.15 && p.z > RAIL.z1 - 0.05 && p.z < RAIL.z1 + 0.25) top = Math.max(top, 0.97);
    if (across < 0.06 && p.z >= RAIL.z0 && p.z <= RAIL.z1) top = Math.max(top, RAIL.top);
    if (across < 0.18 && p.z >= WALL_A.z0 && p.z <= WALL_A.z1) top = Math.max(top, WALL_A.top);
    if (across < 0.18 && p.z >= WALL_B.z0 && p.z <= WALL_B.z1) top = Math.max(top, WALL_B.top);
    return this.origin.y + top;
  }

  /** Back where everything starts: the tub by the chimney, or else already brought to the boat. */
  reset(moored = false): void {
    this.clock = 0;
    this.drifting = false;
    this.moored = moored ? 1 : 0;
    this.place();
  }
  private moored = 0;

  /** The tub wanders by the chimney and the boat lies off the ridge, both bobbing and rocking as if afloat. */
  private place(): void {
    const t = this.clock;
    const drift = this.drifting ? THREE.MathUtils.smoothstep(t, 0, 8) : this.moored;
    const wander = 1 - drift;
    this.tub.position.set(
      THREE.MathUtils.lerp(TUB_AT_POT.x, TUB_AT_BOAT.x, drift) + 0.12 * Math.sin(t * 0.31) * wander,
      0.02 * Math.sin(t * 1.1),
      THREE.MathUtils.lerp(TUB_AT_POT.y, TUB_AT_BOAT.y, drift) + 0.08 * Math.cos(t * 0.23) * wander,
    );
    this.tub.rotation.set(0.05 * Math.sin(t * 1.7 + 1), t * 0.05, 0.06 * Math.sin(t * 1.3));
    this.boat.position.set(0.25, 0.03 * Math.sin(t * 0.9), 3.1 + 0.1 * Math.sin(t * 0.17));
    this.boat.rotation.set(0.02 * Math.sin(t * 0.8 + 2), -Math.PI / 2 + 0.03 * Math.sin(t * 0.2), 0.04 * Math.sin(t * 1.1));
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

  /** Every action the cat has, by name, set up from a place of its own in the yard so each can be looked at alone. */
  play(name: string, cat: Cat, child: THREE.Vector3): boolean {
    const yaw = this.yaw;
    const ground = this.at(0, 0, 0);
    ground.y = this.floor(ground.x, ground.z);
    const onRidge = (z: number, out = new THREE.Vector3()) => {
      const p = this.at(RIDGE.x, 0, z, out);
      p.y = this.floor(p.x, p.z);
      return p;
    };
    cat.visible = true;
    cat.unease = 0;
    cat.mewing = false;
    cat.curious = null;
    switch (name) {
      case 'sit':
      case 'stand':
      case 'crouch':
        cat.place(ground, yaw + 0.6, { pose: name, floor: this.floor });
        cat.look(child);
        return true;
      case 'wash':
        cat.place(ground, yaw + 0.6, { pose: 'sit', floor: this.floor });
        cat.look(null);
        cat.wash();
        return true;
      case 'afraid':
        cat.place(ground, yaw + 0.6, { pose: 'stand', floor: this.floor });
        cat.look(child);
        cat.afraid(1);
        return true;
      case 'mew':
        cat.place(ground, yaw + 0.6, { pose: 'sit', floor: this.floor });
        cat.look(child);
        cat.mew(1);
        return true;
      case 'chirrup':
        cat.place(ground, yaw + 0.6, { pose: 'sit', floor: this.floor });
        cat.look(child);
        cat.chirrup();
        return true;
      case 'strand':
        this.reset();
        cat.place(this.at(POT.x, POT.y, POT.z), yaw - 1.2, { pose: 'crouch' });
        cat.strand(child);
        return true;
      case 'hop-tub':
        this.reset();
        cat.place(this.at(POT.x, POT.y, POT.z), yaw - 0.3, { pose: 'crouch' });
        cat.strand(child);
        cat.hop(new THREE.Vector3(0, 0.04, 0), { frame: this.tub, then: 'sit', look: child }, () => {
          cat.mewing = false;
          cat.unease = 0.8;
          this.drift();
        });
        return true;
      case 'ride-tub':
        this.reset();
        this.drift();
        cat.place(new THREE.Vector3(0, 0.04, 0), 0, { frame: this.tub, pose: 'sit' });
        cat.unease = 0.8;
        cat.look(child);
        return true;
      case 'boat':
        cat.place(new THREE.Vector3(0.6, 0.42, 0), Math.PI / 2, { frame: this.boat, pose: 'sit' });
        cat.look(child);
        cat.curious = child;
        return true;
      case 'jump-boat':
        this.reset(true);
        cat.place(new THREE.Vector3(0, 0.04, 0), 0.5, { frame: this.tub, pose: 'sit' });
        cat.unease = 0.8;
        cat.leap(new THREE.Vector3(0.6, 0.42, 0), { frame: this.boat, yaw: Math.PI / 2, then: 'sit', look: child }, () => {
          cat.unease = 0;
          cat.chirrup();
        });
        return true;
      case 'leap-roof':
        cat.place(new THREE.Vector3(0.6, 0.42, 0), -Math.PI / 2 + 0.4, { frame: this.boat, pose: 'sit' });
        cat.leap(onRidge(2.6), { floor: this.floor, then: 'stand', look: null }, () => cat.chirrup());
        return true;
      case 'walk':
      case 'trot':
      case 'run': {
        cat.place(onRidge(1.2), yaw, { pose: 'stand', floor: this.floor });
        cat.look(null);
        const path = [onRidge(2.4), this.at(RIDGE.x + 0.12, 0, 3.6), onRidge(4.8)];
        cat.run(path, this.floor, { pace: name, then: 'sit', look: child });
        return true;
      }
      case 'rail': {
        cat.place(this.at(RAIL.x, 0.97, RAIL.z0 - 0.1), yaw, { pose: 'stand', floor: this.floor });
        cat.look(null);
        cat.run([this.at(RAIL.x, 0, RAIL.z0 + 0.1), this.at(RAIL.x, 0, RAIL.z1 - 0.05), this.at(RAIL.x, 0, RAIL.z1 + 0.1)], this.floor, { narrow: true, then: 'sit', look: child });
        return true;
      }
      case 'gap':
        cat.place(this.at(RIDGE.x, WALL_A.top, WALL_A.z1 - 0.3), yaw, { pose: 'stand', floor: this.floor });
        cat.look(null);
        cat.run([this.at(RIDGE.x, 0, WALL_A.z1 - 0.12)], this.floor, { pace: 'walk', then: 'stand' }, () => {
          cat.leap(this.at(RIDGE.x, WALL_B.top, WALL_B.z0 + 0.2), { floor: this.floor, arc: 0.35, then: 'sit', look: child }, () => cat.chirrup());
        });
        return true;
      case 'climb': {
        cat.place(this.at(RIDGE.x, WALL_B.top, WALL_B.z1 - 0.25), yaw, { pose: 'stand', floor: this.floor });
        cat.look(null);
        const face = (y: number, x = 0) => this.at(RIDGE.x + x, y, TOWER.z);
        cat.climb([face(1.5), face(2.1, 0.06), face(2.7, -0.05), face(TOWER.sill - 0.2), this.at(RIDGE.x, TOWER.sill, TOWER.z + 0.2)], this.dir(0, 0, -1), { then: 'crouch', look: child });
        return true;
      }
      default:
        return false;
    }
  }
}
