// Independent kite simulation, shore grounding and chapter isolation without a GPU.
// Run: node tools/kite-logic-check.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { registerHooks } from 'node:module';
import { transformSync } from 'rolldown/utils';
import * as THREE from 'three';
registerHooks({
  resolve(s, c, n) { return n(s.startsWith('.') && !/\.[a-z]+$/i.test(s) ? s + '.ts' : s, c); },
  load(u, c, n) { return u.endsWith('.ts') ? { format: 'module', shortCircuit: true, source: transformSync(new URL(u).pathname, fs.readFileSync(new URL(u), 'utf8')).code } : n(u, c); },
});
globalThis.location = { search: '?shot' };
globalThis.window = { innerWidth: 1600, innerHeight: 900, matchMedia: () => ({ matches: false }) };
const { DepartureKites } = await import('../src/story/departure-kites.ts');
const { heightAt } = await import('../src/world/island.ts');
const { Kite } = await import('../src/world/kite.ts');
const { REFLECTION_LAYER } = await import('../src/world/water/reflection.ts');
const { MIRROR_DECK } = await import('../src/world/sky-mirror-layout.ts');
let gust = 0;
const wind = { calm: 0, sample(x, z, out) { return Object.assign(out, { x: 2.4, z: -.8, energy: x < 50 ? gust : 0, lift: x < 50 ? gust : 0 }); } };
const camera = new THREE.PerspectiveCamera(38, 1.5, .1, 7000);
const markers = new DepartureKites(wind);
const wet = [];
for (const [name, kite] of Object.entries(markers.markers)) {
  kite.group.traverse(part => { if (part.isMesh) assert(part.layers.isEnabled(REFLECTION_LAYER), 'the kite and its tail reflect in water'); });
  const ground = heightAt(kite.tieOff.x, kite.tieOff.z);
  console.log(`${name} tie-off ground: ${ground.toFixed(2)}`);
  if (name !== 'mirror' && ground < 0) wet.push(name);
  camera.position.copy(kite.tieOff).add(new THREE.Vector3(0, 10, 35));
  camera.lookAt(kite.tieOff); camera.updateMatrixWorld();
  markers.update(1 / 60, 0, camera, { name, current: {} });
  assert.deepEqual(Object.entries(markers.markers).filter(([, k]) => k.group.visible).map(([n]) => n), [name]);
  markers.update(1 / 60, 0, camera, { name, current: { departureKite: false } });
  assert(Object.values(markers.markers).every(k => !k.group.visible));
}
assert.deepEqual(wet, [], 'posts must stand on dry ground');
const mirrorPost = markers.markers.mirror.tieOff;
assert(mirrorPost.x >= MIRROR_DECK.x0 && mirrorPost.x <= MIRROR_DECK.x1
  && Math.abs(mirrorPost.z - MIRROR_DECK.z0) < MIRROR_DECK.halfWidth,
  'the mirror post must stand on the jetty, not the submerged flat');
// Each sailing chapter keeps the kite on the shore just left, never at the destination.
for (const [chapter, shore] of Object.entries({
  toLines: 'island', toBoats: 'lines', toMeadow: 'boats', toBirches: 'meadow',
  drowned: 'birches', toSleeping: 'wood', toMirror: 'sleeping', toHome: 'sleeping', toHarbour: 'mirror',
})) {
  markers.update(1 / 60, 0, camera, { name: 'home', current: {} });
  camera.position.copy(markers.markers[shore].tieOff);
  markers.update(1 / 60, 0, camera, { name: chapter, current: {} });
  assert.deepEqual(Object.entries(markers.markers).filter(([, k]) => k.group.visible).map(([n]) => n), [shore], chapter);
}
// Old saves leave Lines directly; keep that shore's kite throughout the crossing.
camera.position.copy(markers.markers.lines.tieOff);
markers.update(1 / 60, 1, camera, { name: 'toMeadow', current: {} });
assert(markers.markers.lines.group.visible && !markers.markers.boats.group.visible);
camera.position.copy(markers.markers.boats.tieOff);
markers.update(1 / 60, 2, camera, { name: 'toMeadow', current: {} });
assert(!markers.markers.boats.group.visible, 'crossings must not introduce the next island marker');
markers.update(1 / 60, 2, camera, { name: 'home', current: {} });
assert(Object.values(markers.markers).every(k => !k.group.visible), 'home has no onward boat marker');

for (const fps of [30, 60, 120]) {
  const a = new Kite(wind, { x: 0, z: 0 }), b = new Kite(wind, { x: 120, z: 0 });
  camera.position.set(50, 30, 50); camera.lookAt(50, 0, 0); camera.updateMatrixWorld();
  gust = 0;
  for (let i = 0; i < fps * 12; i++) { a.update(1 / fps, i / fps, camera); b.update(1 / fps, i / fps, camera); }
  const still = b.position.clone(), before = a.position.y;
  gust = 2;
  for (let i = 0; i < fps * 2; i++) a.update(1 / fps, 12 + i / fps, camera);
  assert.deepEqual(b.position.toArray(), still.toArray(), 'updating one kite cannot move another');
  assert(a.position.y > before + 1, 'a gust visibly lifts the local kite');
  a.update(1 / fps, 14, camera, false);
  a.update(1 / fps, 15, camera, true);
  for (const p of a.tail) assert(p.toArray().every(Number.isFinite), 'returning to a kite must leave a finite tail');
  console.log(`${fps}fps: local gust, independent position and hidden/reveal tail passed`);
}
