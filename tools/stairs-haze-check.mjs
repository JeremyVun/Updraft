// Keep landing mist out of the incoming flight's visible treads and risers.
// Usage: node tools/stairs-haze-check.mjs
import assert from 'node:assert/strict';
import './lib/typescript.mjs';
import * as THREE from 'three';

globalThis.location = { search: '?shot' };
const { hazeUnderLanding } = await import('../src/world/stairs-haze.ts');
const { FLIGHTS, STEP, flight, landingOf } = await import('../src/world/stairs-layout.ts');
const cube = new THREE.Box3(new THREE.Vector3(-.5, -.5, -.5), new THREE.Vector3(.5, .5, .5));
let checked = 0;
for (let index = 1; index <= FLIGHTS; index++) {
  const f = flight(index), landing = landingOf(index);
  const frame = new THREE.Matrix4().makeTranslation(...landing.centre.toArray())
    .multiply(new THREE.Matrix4().makeRotationY(landing.yaw));
  const centre = new THREE.Matrix4().makeTranslation((landing.x0 + landing.x1) / 2, 0, (landing.z0 + landing.z1) / 2);
  const haze = hazeUnderLanding(frame.multiply(centre), landing.x1 - landing.x0, landing.z1 - landing.z0, .9, { z0: true });
  const toCube = haze.matrix.clone().invert().multiply(new THREE.Matrix4().makeTranslation(...f.bottom.toArray()))
    .multiply(new THREE.Matrix4().makeRotationY(f.yaw));
  for (let step = f.risers - 1; step >= 1; step--) {
    for (const x of [-.6, .6]) {
      const top = step * STEP.rise, start = (step - 1) * STEP.going;
      for (const [surface, y, z] of [['riser', top - .12, start - .03], ['tread', top, start + STEP.going * .9]]) {
        const point = new THREE.Vector3(x, y, z).applyMatrix4(toCube);
        assert(!cube.containsPoint(point), `Landing haze intersects flight ${index}, step ${step} ${surface}`);
        checked++;
      }
    }
  }
  haze.material.dispose();
}
console.log(`Landing mist clears ${checked} tread and riser samples across ${FLIGHTS} flights.`);
