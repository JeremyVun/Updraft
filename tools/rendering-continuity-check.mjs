// CPU regressions for outgoing water, sheltered fireflies and storm lighting; browser evidence uses rendering-continuity-audit.mjs.
// node tools/rendering-continuity-check.mjs [capture.json ...] also gates saved browser traces.
import './lib/typescript.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';

globalThis.location = { search: '?shot' };
globalThis.window = { matchMedia: () => ({ matches: false }) };
const { WaterRooms } = await import('../src/world/water/rooms.ts');
const { ROOMS } = await import('../src/world/journey-rooms.ts');
const { Fireflies } = await import('../src/fx/fireflies.ts');
const { StormWeather } = await import('../src/fx/storm.ts');
const { atmo } = await import('../src/world/atmosphere.ts');
const { applyPalette } = await import('../src/world/palette.ts');
const { tuning } = await import('../src/tuning.ts');
const index = name => Object.keys(ROOMS).indexOf(name);
const wind = { sample(_x, _z, out) { return Object.assign(out, { x: 0, z: 0, energy: 0, lift: 0 }); } };

for (const fps of [10, 30, 60, 120]) {
  const water = new WaterRooms();
  water.update(['wood', 'sleeping'], 0);
  let last = water.uniform.value[index('wood')];
  assert.equal(last, 1);
  for (let i = 0; i <= fps * tuning.water.departureFade; i++) {
    water.update(['sleeping'], 1 / fps);
    const next = water.uniform.value[index('wood')];
    assert(next <= last && last - next < .04, `${fps} Hz: outgoing water must recede continuously`);
    assert.equal(water.uniform.value[index('sleeping')], 1, 'the landing shore remains intact');
    assert.equal(water.uniform.value[index('mirror')], 0, 'unvisited water stays concealed');
    last = next;
  }
  assert.equal(last, 0);
  water.update(['sleeping', 'mirror'], 1 / fps);
  assert.equal(water.uniform.value[index('mirror')], 1, 'incoming water is ready under the reveal fog');
  const restored = new WaterRooms();
  restored.update(['sleeping'], 0);
  assert.equal(restored.uniform.value[index('wood')], 0, 'resume must not invent an outgoing shore');

  const flies = new Fireflies(wind), around = new THREE.Vector3(-34, 1, -1910);
  for (let i = 0; i < fps * 4; i++) flies.update(1 / fps, 1, around, true);
  const material = flies.mesh.material;
  assert.equal(material.uniforms.uShelter.value, 1);
  const count = flies.mesh.geometry.instanceCount;
  flies.update(1 / fps, 1, around, false);
  assert(material.uniforms.uShelter.value > .95, 'leaving the wood must retain the small sheltered appearance');
  assert.equal(flies.mesh.geometry.instanceCount, count, 'do not remove visible flies at the chapter boundary');
  for (let i = 0; i < fps * 20; i++) flies.update(1 / fps, 1, around, false);
  assert(material.uniforms.uShelter.value < .001, 'the open-country appearance must eventually take over');
  assert(flies.mesh.geometry.getAttribute('aFly').array[239 * 4 + 3] < .001, 'surplus sheltered flies fade away');
}

let thunder = 0;
const weather = new StormWeather(() => thunder++);
const light = storm => {
  applyPalette(1, 1.8, 1, .15);
  weather.update(0, storm, 0, 1, 0, undefined, .15);
  return atmo.uniforms.uSunColor.value.toArray();
};
assert.deepEqual(light(0), light(.15), 'changing chapter weather must not cut the rendered light');
assert.equal(atmo.uniforms.uStormCover.value, .15);
for (let i = 0; i < 60 * 80; i++) {
  applyPalette(1, 1.8, 1, 1);
  weather.update(1 / 60, 0, 0, 1, 0, undefined, 1);
  assert.equal(atmo.uniforms.uLightning.value.w, 0, 'visual cover must not schedule lightning after leaving the storm');
}
assert.equal(thunder, 0);
console.log('Rendering continuity: water and fireflies at 10–120 Hz; storm lighting independent of lightning triggers passed.');

for (const file of process.argv.slice(2)) {
  const capture = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.deepEqual(capture.errors, [], `${file}: browser errors`);
  assert(capture.trace.some(frame => frame.chapter !== capture.name), `${file}: the replay must reach its chapter handoff`);
  for (const [i, frame] of capture.trace.entries()) {
    if (frame.uSeaEffects[3] === 1) assert.equal(frame.uMirrorOn, 1, `${file}: visible sea lost its reflection`);
    const previous = capture.trace[i - 1];
    if (!previous || previous.chapter === frame.chapter) continue;
    for (const room of previous.uJourneyRooms.filter(room => room >= 0)) {
      assert(frame.uWaterRooms[room] >= previous.uWaterRooms[room] - .001, `${file}: outgoing water cut at the handoff`);
    }
    if (frame.chapter === 'mirror') assert(previous.mirrorKite && frame.mirrorKite, `${file}: the kite must precede landing`);
    if (previous.chapter === 'wood') {
      assert(Math.abs(frame.fireflyShelter - previous.fireflyShelter) < .01, `${file}: firefly appearance cut`);
      assert(Math.abs(frame.uStormCover - previous.uStormCover) < .01, `${file}: storm cover cut`);
      frame.uSunColor.forEach((v, j) => assert(Math.abs(v / previous.uSunColor[j] - 1) < .01, `${file}: lighting cut`));
    }
  }
  console.log(`${file}: ${capture.trace.length} rendered frames passed continuity gates.`);
}
