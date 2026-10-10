import assert from 'node:assert/strict';
import * as THREE from 'three';
import { drownedCast } from './lib/storm-cast.mjs';
const { SheetYard } = await import('../src/story/sheet-yard.ts');
const wind = { breeze: new THREE.Vector2(), calm: 0, addSplat() {}, sample(x, z, out) {
  return Object.assign(out, { x: 0, z: 0, lift: 0, energy: 0 });
} };
for (const fps of [30, 60, 120]) {
  const cast = drownedCast(wind); cast.input = { present: false };
  const yard = new SheetYard(cast, new THREE.Vector3(-126, 0, -527));
  yard.catless = true; yard.play();
  const camera = new THREE.PerspectiveCamera(38, 1600 / 900, 0.5, 7000);
  camera.position.copy(cast.child.position).add(new THREE.Vector3(8, 5, 9));
  const crossing = yard.crossing, sheet = crossing.sheet, child = cast.child;
  const hand = new THREE.Vector3(), cloth = new THREE.Vector3();
  let gap = 0, carried = 0;
  for (let i = 0; i < fps * 20 && crossing.phase !== 'over'; i++) {
    const dt = 1 / fps;
    sheet.nudge(3 * dt); crossing.gust = 1;
    yard.update(dt, camera); child.update(dt);
    if (crossing.phase !== 'carried') continue;
    carried++;
    for (const j of [0, 1]) gap = Math.max(gap, child.mitten(j, hand).distanceTo(sheet.grip(j, cloth)));
  }
  assert(carried > fps, 'the cloth never carried her');
  assert.equal(crossing.phase, 'over', 'she did not reach the far roof');
  assert(gap < 0.17, `held cloth trailed the hands by ${gap} m`);
  console.log(`sheet ${fps} Hz: posed hands to rendered hem ${gap.toFixed(3)} m`);
}
