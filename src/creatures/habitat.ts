import * as THREE from 'three';
import { GRASS_LINE, heightAt, slopeAt } from '../world/island';
import { FLOWER_PATCHES, TREE, openGround, type FlowerPatch } from '../world/landmarks';
import { createNoise2D, fbm, mulberry32, smoothstep } from '../world/noise';
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
}

const lushNoise = createNoise2D(5);
const patchNoise = createNoise2D(11);

/** Mirrors the typical blade height in world/grass.ts, so ground creatures can prefer short grass. */
function grassHeight(x: number, z: number): number {
  const h = heightAt(x, z);
  if (h < GRASS_LINE - 0.6) return 0;
  const lush = fbm(lushNoise, x * 0.035, z * 0.035, 3) * 0.5 + 0.5;
  const short = smoothstep(0.48, 0.66, fbm(patchNoise, x * 0.05, z * 0.05, 2) * 0.5 + 0.5);
  const fringe = smoothstep(GRASS_LINE - 0.6, GRASS_LINE + 2.2, h);
  return (1.35 + 1.5 * lush) * (0.2 + 0.8 * fringe * fringe) * (1 - short * 0.5) * 0.9;
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
      dir.set(rand() * 2 - 1, 0.35 + rand() * 0.65, rand() * 2 - 1).normalize();
      p.copy(c.centre).addScaledVector(dir, c.radius * 0.92);
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
    grassHeight,
    meadow,
    forage,
    flowers: FLOWER_PATCHES,
    perches: canopyPerches(canopy),
    treeBase: new THREE.Vector3(TREE.x, heightAt(TREE.x, TREE.z), TREE.z),
  };
}
