import * as THREE from 'three';
import { fieldAt, type FieldSample } from '../world/fields';
import { COTTAGE, mainlandCoastZ } from '../world/heightfield';
import { GRASS_LINE, heightAt, slopeAt } from '../world/island';
import { grassHeightAt } from '../world/grass';
import { FLOWER_PATCHES, TREE, openGround, type FlowerPatch } from '../world/landmarks';
import { mulberry32 } from '../world/noise';
import type { Canopy } from '../world/tree';

export interface Perch {
  x: number;
  y: number;
  z: number;
  /** Facing outward from the canopy. */
  yaw: number;
  /** Phase of the tree's sway at this perch. */
  swaySeed: number;
}

/** Where creatures may live. Built from the world's own lookups so the same behaviour works on any island. */
export interface Habitat {
  ground(x: number, z: number): number;
  /** Approximate height of the grass tops above the ground. */
  grassHeight(x: number, z: number): number;
  /** Open, gently sloping grass that rabbits can live on. */
  meadow(x: number, z: number): boolean;
  /** Where ground birds can peck about: open grass, including the sparse short tufts at its edge. */
  forage(x: number, z: number): boolean;
  readonly flowers: readonly FlowerPatch[];
  readonly perches: readonly Perch[];
  /** Base of the tree the perches belong to; they sway with it. */
  readonly treeBase: THREE.Vector3;
  /** Leafy spheres that flying creatures keep clear of. */
  readonly canopy: readonly Canopy[];
}

function meadow(x: number, z: number): boolean {
  return heightAt(x, z) > GRASS_LINE + 0.5 && openGround(x, z) > 0.97 && slopeAt(x, z) < 0.75;
}

function forage(x: number, z: number): boolean {
  return heightAt(x, z) > GRASS_LINE + 0.1 && openGround(x, z) > 0.9 && slopeAt(x, z) < 0.9;
}

/** Perches on the outer, upper surface of the canopy, where birds sit against the sky. */
function canopyPerches(canopy: readonly Canopy[]): Perch[] {
  const rand = mulberry32(51);
  const perches: Perch[] = [];
  const dir = new THREE.Vector3();
  const p = new THREE.Vector3();
  canopy.forEach((c, ci) => {
    for (let tries = 0, made = 0; tries < 60 && made < 5; tries++) {
      dir.set(rand() * 2 - 1, 0.5 + rand() * 0.8, rand() * 2 - 1).normalize();
      p.copy(c.centre).addScaledVector(dir, c.radius * 0.98);
      const buried = canopy.some((o, oi) => oi !== ci && p.distanceTo(o.centre) < o.radius * 0.9);
      if (buried) continue;
      perches.push({ x: p.x, y: p.y, z: p.z, yaw: Math.atan2(dir.x, dir.z), swaySeed: (ci / canopy.length) * 6 });
      made++;
    }
  });
  return perches;
}

export function islandHabitat(canopy: readonly Canopy[]): Habitat {
  return {
    ground: heightAt,
    grassHeight: grassHeightAt,
    meadow,
    forage,
    flowers: FLOWER_PATCHES,
    perches: canopyPerches(canopy),
    treeBase: new THREE.Vector3(TREE.x, heightAt(TREE.x, TREE.z), TREE.z),
    canopy,
  };
}

const field: FieldSample = { edge: 99, kind: 0, wall: false, presence: 0 };

function clearOfWalls(x: number, z: number, gap: number): boolean {
  const f = fieldAt(x, z, field);
  return !(f.wall && f.presence >= 0.5 && f.edge < gap);
}

function onPasture(x: number, z: number): boolean {
  return z < mainlandCoastZ(x) - 16 && Math.hypot(x - COTTAGE.x, z - COTTAGE.z) > COTTAGE.radius + 4;
}

/** Wall tops near each centre, where finches line up in the evening light. */
function wallPerches(centres: readonly { x: number; z: number }[], reach: number): Perch[] {
  const rand = mulberry32(83);
  const perches: Perch[] = [];
  const step = 1.1;
  for (const c of centres) {
    for (let z = c.z - reach; z <= c.z + reach; z += step) {
      for (let x = c.x - reach; x <= c.x + reach; x += step) {
        const f = fieldAt(x, z, field);
        if (!f.wall || f.presence < 0.6 || f.edge > 0.28) continue;
        if (perches.some((p) => Math.abs(p.x - x) < step && Math.abs(p.z - z) < step)) continue;
        const e = 0.3;
        const ex = fieldAt(x + e, z, field).edge - fieldAt(x - e, z, field).edge;
        const ez = fieldAt(x, z + e, field).edge - fieldAt(x, z - e, field).edge;
        const across = Math.atan2(ex, ez) + (rand() < 0.5 ? 0 : Math.PI);
        perches.push({ x, y: heightAt(x, z) + 1.2, z, yaw: across, swaySeed: 0 });
      }
    }
  }
  return perches;
}

/** The mainland's pastures: short grazed grass between dry-stone walls, finches perching on the walls. */
export function mainlandHabitat(flowers: readonly FlowerPatch[], perchCentres: readonly { x: number; z: number }[]): Habitat {
  const perches = wallPerches(perchCentres, 30);
  const mid = perchCentres[Math.floor(perchCentres.length / 2)] ?? { x: 0, z: -1000 };
  return {
    ground: heightAt,
    grassHeight: grassHeightAt,
    meadow: (x, z) => onPasture(x, z) && heightAt(x, z) > GRASS_LINE + 1 && slopeAt(x, z) < 0.75 && clearOfWalls(x, z, 1.6),
    forage: (x, z) => onPasture(x, z) && heightAt(x, z) > GRASS_LINE + 1 && slopeAt(x, z) < 0.9 && clearOfWalls(x, z, 1),
    flowers,
    perches,
    treeBase: new THREE.Vector3(mid.x, 1e4, mid.z),
    canopy: [],
  };
}
