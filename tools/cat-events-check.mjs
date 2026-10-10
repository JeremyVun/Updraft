import './lib/typescript.mjs';
import assert from 'node:assert/strict';
import * as THREE from 'three';

globalThis.location = { search: '?shot' };
globalThis.document = { createElement: () => ({ getContext: () => ({ beginPath() {}, moveTo() {}, quadraticCurveTo() {}, stroke() {} }) }) };
let seed = 2026;
Math.random = () => ((seed = Math.imul(seed, 1664525) + 1013904223 | 0) >>> 0) / 4294967296;
const { Kittens } = await import('../src/creatures/cat/kittens.ts');
const kittens = new Kittens();
kittens.lay(new THREE.Vector3());
kittens.nestle();
kittens.visible = true;
kittens.tumble();
const previous = new Set();
let count = 0;
// The village still simulates nearby kittens after the chapter stops consuming their sounds.
for (let i = 0; i < 1200; i++) {
  kittens.update(1 / 60);
  for (const event of kittens.heard) {
    assert(!previous.has(event), 'a kitten sound survives beyond its frame');
    previous.add(event);
    count++;
  }
}
assert(count > 20, 'exercise real kitten footsteps and landings');
console.log(`${count} kitten sounds over 20 seconds; no stale events retained without a listener.`);
