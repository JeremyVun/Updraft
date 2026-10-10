import assert from 'node:assert/strict';
import * as THREE from 'three';
import { drownedCast } from './lib/storm-cast.mjs';
const { DrownedChapter } = await import('../src/story/drowned.ts');
const { DARK_AT_STRAND, DARK_END, DARK_HEADING, DARK_WAY } = await import('../src/world/drowned-way.ts');
const { atmo } = await import('../src/world/atmosphere.ts');
const { WOOD_LANDING } = await import('../src/world/wood.ts');
const { tuning } = await import('../src/tuning.ts');

const wind = { breeze: new THREE.Vector2(), sample(x, z, out) { return Object.assign(out, { x: 0, z: 0, energy: 0, lift: 0 }); } };
const cast = drownedCast(wind), chapter = new DrownedChapter(cast), bank = cast.village.dark;
chapter.skipToRun();
const point = new THREE.Vector2(), previous = new Map();
let fastest = 0, retreat = 0;
for (let front = DARK_AT_STRAND - 72; front < DARK_END + 32; front += .05) {
  bank.front = front;
  bank.level = bank.tide(front);
  // A child can turn or swing while a camera circles her; neither turns the weather front.
  bank.faces = point.set(Math.sin(front) * 100, -1500 + Math.cos(front) * 100);
  bank.update(front, cast.boat.position, .05 / 3.2);
  assert(bank.ahead.distanceTo(DARK_HEADING) < 1e-12, 'fixed world heading');
  for (const side of [-170, -85, 0, 85, 170]) {
    const next = bank.frontAt(new THREE.Vector2(), side), old = previous.get(side);
    if (old) {
      const delta = next.clone().sub(old);
      fastest = Math.max(fastest, delta.length() / (.05 / 3.2));
      retreat = Math.min(retreat, delta.dot(DARK_HEADING));
    }
    previous.set(side, next);
  }
}
assert(fastest <= 3.2 + 1e-7, `bank edges rushed at ${fastest} m/s`);
assert(retreat >= -1e-9, `front receded ${retreat} m`);

const values = () => ['uSeaFog', 'uSeaFogShape', 'uSeaFogSides', 'uSeaFogClear'].map(key => atmo.uniforms[key].value.toArray());
chapter.skipToNave();
chapter.church.step = 'climb';
chapter.church.since = 4;
cast.child.position.y = 3;
const camera = new THREE.PerspectiveCamera(), states = [];
for (const eye of [[0, 1, -1550], [100, 30, -1460], [-80, 6, -1660]]) {
  camera.position.set(...eye);
  chapter.afterCamera(camera);
  chapter.church.fog(0);
  cast.village.update(0, 100, cast.boat.position, 0, camera.position);
  states.push(values());
}
assert.deepEqual(states[1], states[0], 'camera motion changed the fog field');
assert.deepEqual(states[2], states[0], 'camera motion changed the fog field');

bank.rise = 1;
cast.boat.position.set(DARK_WAY.at(-1).x, 0, DARK_WAY.at(-1).y);
cast.village.update(0, 100, cast.boat.position, 0);
assert.equal(atmo.uniforms.uSeaFogShape.value.w, 1, 'fog remains present at the belfry');
cast.boat.position.set(WOOD_LANDING.x, 0, WOOD_LANDING.y);
cast.village.update(0, 100, cast.boat.position, 1);
assert.equal(atmo.uniforms.uSeaFogShape.value.w, 0, 'fog yields to the woods at the actual landing');
console.log(`Fog: fixed heading; maximum bank-edge speed ${fastest.toFixed(2)} m/s; no retreat; camera-invariant climb and density; woods fade intact.`);

const church = chapter.church, k = tuning.drowned.church;
church.skipToBelfry();
church.rings = k.rings;
church.clearFrom = k.fog.clearAt[k.rings];
church.sinkAt = church.since - k.fog.sinkFor;
church.downAt = church.since;
church.to('down');
for (let i = 0; i < 1800; i++) {
  church.since += 1 / 60;
  church.fog(1 / 60);
  assert.equal(bank.clearing.floor, k.fog.cleared, 'descent refilled the bell clearing');
}
const cleared = bank.clearing.radius;
church.to('aboard');
for (let i = 0; i <= Math.floor(k.lookUpFor * 60); i++) {
  church.aboardFor = i / 60;
  church.fog(1 / 60);
  assert.equal(bank.clearing.radius, cleared, 'boarding or farewell removed the clearing');
  assert.equal(bank.clearing.floor, k.fog.cleared, 'mist rose into the window farewell');
}
let previousFloor = bank.clearing.floor, largestStep = 0;
for (let i = 1; i <= k.fog.clearLeaveFor * 60; i++) {
  church.aboardFor = k.lookUpFor + i / 60;
  church.fog(1 / 60);
  largestStep = Math.max(largestStep, Math.abs(bank.clearing.floor - previousFloor));
  previousFloor = bank.clearing.floor;
}
assert(largestStep < .01, `local departure mist changed too quickly: ${largestStep}`);
assert.equal(bank.clearing.radius, 0, 'tower clearing must be gone before the storm');
for (const t of [k.fog.closeAfter, k.fog.closeAfter + 5, k.fog.closeAfter + k.fog.closeFor]) {
  church.aboardFor = t;
  church.fog(0);
  const close = THREE.MathUtils.clamp((t - k.fog.closeAfter) / k.fog.closeFor, 0, 1);
  assert.equal(bank.close, close, 'storm fog timing changed');
  assert.equal(bank.level, THREE.MathUtils.lerp(k.fog.drawn, k.fog.closedLevel, close), 'storm mist height changed');
  assert.equal(bank.clearing.radius, 0, 'local clearing leaked into the storm');
}
console.log(`Bell clearing persists through descent and farewell, then blends away; storm fog unchanged.`);
