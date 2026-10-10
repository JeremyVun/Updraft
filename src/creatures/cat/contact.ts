import type * as THREE from 'three';
import { BODY, PELVIS, CHEST, FPAW_L, FPAW_R, HPAW_L, HPAW_R } from './body';

export function contactVertices(geometry: THREE.BufferGeometry): number[] {
  const skin = geometry.attributes.aSkin;
  return Array.from({ length: skin.count }, (_, i) => i).filter(i => [BODY, PELVIS, CHEST, FPAW_L, FPAW_R, HPAW_L, HPAW_R].includes(skin.getX(i)));
}
