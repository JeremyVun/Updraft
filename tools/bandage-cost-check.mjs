// Verify cached skinning against the original per-sample deformation, including scaled joints and release.
import './lib/typescript.mjs';
import assert from 'node:assert/strict';
import * as THREE from 'three';

globalThis.location = { search: '?shot' };
globalThis.window = { matchMedia: () => ({ matches: false }) };
const { WingBandage } = await import('../src/creatures/cygnet/bandage.ts');
const optimized = new WingBandage(), original = new WingBandage();
// Keep the previous deformation as an independent numeric oracle.
original.surfacePoint = function (index, padding, weight, out) {
  const { position, normal, aSkin } = this.surface.attributes;
  const p = this.skinPoint.fromBufferAttribute(position, index);
  p.addScaledVector(this.skinOther.fromBufferAttribute(normal, index), padding);
  this.skinOther.copy(p).applyMatrix4(this.bones[aSkin.getY(index)]);
  p.applyMatrix4(this.bones[aSkin.getX(index)]).lerp(this.skinOther, aSkin.getZ(index));
  out.addScaledVector(p, weight);
};
const skin = optimized.surface.attributes.aSkin;
let count = 0;
for (let i = 0; i < skin.count; i++) count = Math.max(count, skin.getX(i)+1, skin.getY(i)+1);
const bones = Array.from({length: count}, () => new THREE.Matrix4());
const wing = new THREE.Matrix4().makeTranslation(2, 3, 4);
const wind = { x: 2, z: -1, energy: .2, lift: .3 };
const rotation = new THREE.Quaternion(), at = new THREE.Vector3(), scale = new THREE.Vector3();
optimized.restore('wrapped', .8); original.restore('wrapped', .8);
let worst = 0;
for (let frame = 0; frame < 620; frame++) {
  const t = frame / 60;
  bones.forEach((bone, i) => bone.compose(at.set(2+i*.01, 3+Math.sin(t+i)*.02, 4),
    rotation.setFromEuler(new THREE.Euler(Math.sin(t+i)*.3, i*.02, Math.cos(t)*.2)), scale.set(1.3, .8, 1.1)));
  if (frame === 60) { optimized.release(); original.release(); }
  for (const b of [optimized, original]) b.update(1/60, t, wing, bones, wind, true, .02);
  assert.equal(optimized.state, original.state);
  assert.equal(optimized.mesh.visible, original.mesh.visible);
  for (const name of ['position', 'normal']) {
    const a = optimized.mesh.geometry.attributes[name].array, b = original.mesh.geometry.attributes[name].array;
    for (let i = 0; i < a.length; i++) worst = Math.max(worst, Math.abs(a[i]-b[i]));
  }
  assert(optimized.tip(new THREE.Vector3()).distanceTo(original.tip(new THREE.Vector3())) < 1e-10, 'fingertips keep their contact');
}
assert(worst < 1e-5, `geometry changed by ${worst}`);
const ms = b => {
  b.restore('wrapped');
  const start = performance.now();
  for (let i = 0; i < 1000; i++) b.update(1/60, i/60, wing, bones, wind, true, .02);
  return performance.now()-start;
};
ms(original); ms(optimized);
const runs = Array.from({length:3}, () => ({ original: ms(original), optimized: ms(optimized) }));
console.log(JSON.stringify({worstGeometryDelta: worst, millisecondsPer1000Updates: runs}));
