// Real curtain, child and cygnet simulation, including gusts during the crossing.
import './lib/typescript.mjs';
import assert from 'node:assert/strict';
import * as THREE from 'three';

globalThis.location = { search: '?shot' };
globalThis.window = { innerWidth: 1600, innerHeight: 900, matchMedia: () => ({ matches: false }) };
globalThis.document = { createElement: () => ({ getContext: () => ({ beginPath() {}, moveTo() {}, quadraticCurveTo() {}, stroke() {} }) }) };
const { Traveller } = await import('../src/traveller/traveller.ts');
const { Cygnet } = await import('../src/creatures/cygnet.ts');
const { Carry } = await import('../src/companion/carry.ts');
const { Boat } = await import('../src/traveller/boat.ts');
const { Glider } = await import('../src/glider/glider.ts');
const { LinesChapter } = await import('../src/story/lines.ts');
const { CURTAINS } = await import('../src/world/lines-passage.ts');
const { mulberry32 } = await import('../src/world/noise.ts');

for (const fps of [30, 60, 120]) for (const bearing of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
  Math.random = mulberry32(42);
  const air = { x: 0, z: 0, energy: 0, lift: 0 };
  const wind = { breeze: new THREE.Vector2(2.47, -0.8), calm: 3, addSplat() {},
    sample(x, z, out) { return Object.assign(out, air); } };
  const child = new Traveller(wind), cygnet = new Cygnet(), boat = new Boat(wind), plane = new Glider(wind, []);
  cygnet.mount = child; cygnet.visible = true; cygnet.wing.restore('wrapped');
  const carry = new Carry(child, cygnet);
  const chapter = new LinesChapter({ child, cygnet, boat, plane, carry, wind });
  child.stop(); child.place(CURTAINS[0].before.x, CURTAINS[0].before.z, Math.PI);
  cygnet.release(child.position.clone().add(new THREE.Vector3(1, 0, 1))); cygnet.seating.snap();
  plane.hold(child); chapter.approach();
  let time = 0;
  for (let i = 0; i < fps * 120 && chapter.gate < 3; i++) {
    const g = CURTAINS[chapter.gate];
    const gust = chapter.beat === 'curtain' && chapter.t > 3 || chapter.beat === 'birdThrough' && chapter.birdArrived >= 0;
    Object.assign(air, { x: Math.cos(bearing) * (gust ? 18 : 0), z: Math.sin(bearing) * (gust ? 18 : 0), energy: gust ? 0.7 : 0 });
    if (chapter.beat === 'curtain' && gust) g.touched = true;
    time += 1 / fps;
    chapter.update(1 / fps, time); child.update(1 / fps); carry.update(1 / fps);
    cygnet.update(1 / fps, time, child.position, air); carry.after(); cygnet.heard.length = 0;
  }
  assert.equal(chapter.gate, 3, `${fps} Hz / ${bearing}: stalled ${chapter.beat}, gate ${chapter.gate}, bird ${cygnet.position.toArray()}, errand ${cygnet.errand?.toArray()}, stay ${cygnet.stay}, noticed ${chapter.noticed}`);
  console.log(`PASS ${fps} Hz / ${bearing}: all three curtains crossed in ${time.toFixed(1)} s`);
}
