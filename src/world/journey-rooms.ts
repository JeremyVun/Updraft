import * as THREE from 'three';
import { DOOR_SHORE, ISLES } from './heightfield';
import { SKY_MIRROR } from './sky-mirror-layout';
import { glsl } from '../tuning';
import type { ChapterName } from '../story/journey';

export const ROOMS = { island: { x: -6, z: -14, rx: 85, rz: 65 }, lines: ISLES.lines,
  shore: DOOR_SHORE, boats: ISLES.boats, meadow: ISLES.meadow, birches: ISLES.birches,
  drowned: ISLES.drowned, wood: ISLES.wood, sleeping: ISLES.sleeping, mirror: SKY_MIRROR, home: ISLES.home };
export type Room = keyof typeof ROOMS;
const names = Object.keys(ROOMS) as Room[];
export const MIRROR_ROOM = names.indexOf('mirror');
export const journeyRooms = { value: new THREE.Vector2(-1, -1) };
const passages: Partial<Record<ChapterName, Room[]>> = {
  toLines: ['island', 'lines'], lines: ['lines', 'shore'], toBoats: ['shore', 'boats'],
  toMeadow: ['boats', 'meadow'], toBirches: ['meadow', 'birches'],
  toWood: ['drowned', 'wood'], toSleeping: ['wood', 'sleeping'],
  toMirror: ['sleeping', 'mirror'], toHarbour: ['mirror', 'home'], toHome: ['sleeping', 'home'],
};
export function visibleRooms(chapter: ChapterName, z: number): Room[] {
  if (chapter === 'stage') return ['meadow'];
  if (chapter === 'drowned') return z > ISLES.drowned.z ? ['birches', 'drowned'] : ['drowned', 'wood'];
  return passages[chapter] ?? [chapter as Room];
}
export function setJourneyRooms(rooms: Room[]): void {
  journeyRooms.value.set(names.indexOf(rooms[0]), rooms[1] ? names.indexOf(rooms[1]) : -2);
}
/** Coast-distance partition: boundaries fall in open sea, never across a visible island. */
export const JOURNEY_ROOMS_GLSL = /* glsl */ `
uniform vec2 uJourneyRooms;
bool journeyHides(vec2 p) {
  if (uJourneyRooms.x < 0.0) return false;
  float nearest = 1e20;
  float room = -1.0;
  ${Object.values(ROOMS).map((c, i) => `{
    float d = (length((p - vec2(${glsl(c.x)}, ${glsl(c.z)})) / vec2(${glsl(c.rx)}, ${glsl(c.rz)})) - 1.0) * ${glsl(Math.min(c.rx, c.rz))};
    if (d < nearest) { nearest = d; room = ${glsl(i)}; }
  }`).join('\n')}
  return room != uJourneyRooms.x && room != uJourneyRooms.y;
}
`;

/** Scope prop exclusions to drawing so chapter-owned visibility and animation stay intact. */
export function drawJourneyRooms(rooms: Room[], objects: Partial<Record<Room, THREE.Object3D[]>>, draw: () => void): void {
  const hidden: THREE.Object3D[] = [];
  for (const [name, roots] of Object.entries(objects)) if (!rooms.includes(name as Room)) {
    for (const root of roots!) if (root.visible) { hidden.push(root); root.visible = false; }
  }
  try { draw(); } finally { for (const root of hidden) root.visible = true; }
}

/** The meadow and home animals share instanced batches; exclude each animal in its own world position. */
export function clipJourneyProps(root: THREE.Object3D): void {
  const seen = new Set<THREE.Material>();
  root.traverse(o => {
    if (!(o instanceof THREE.Mesh || o instanceof THREE.Points)) return;
    for (const material of Array.isArray(o.material) ? o.material : [o.material]) {
      if (seen.has(material)) continue;
      seen.add(material);
      const before = material.onBeforeCompile;
      material.onBeforeCompile = (shader: THREE.WebGLProgramParametersWithUniforms, renderer: THREE.WebGLRenderer) => {
        before.call(material, shader, renderer);
        if (!/\b(?:in|varying)\s+vec3\s+vWorld\s*;/.test(shader.fragmentShader)) return;
        shader.uniforms.uJourneyRooms = journeyRooms;
        if (!shader.fragmentShader.includes('bool journeyHides')) shader.fragmentShader = JOURNEY_ROOMS_GLSL + shader.fragmentShader;
        shader.fragmentShader = shader.fragmentShader.replace(/void\s+main\s*\(\s*\)\s*\{/, 'void main() { if (journeyHides(vWorld.xz)) discard;');
      };
      material.customProgramCacheKey = () => 'journey-animals-v1';
      material.needsUpdate = true;
    }
  });
}
