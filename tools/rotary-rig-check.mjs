import './lib/typescript.mjs';
import assert from 'node:assert/strict';
import * as THREE from 'three';

globalThis.location = { search: '?shot' };
const { RotaryWashingRig } = await import('../src/world/rotary-washing.ts');
const { rotaryWashing } = await import('../src/world/lines-rotary.ts');

for (const open of [false, true]) {
  rotaryWashing.reset(open);
  const rig = new RotaryWashingRig(new THREE.Vector4());
  rig.group.updateMatrixWorld(true);
  for (const [index, group] of [...rig.group.children.entries()].reverse()) {
    const frame = rotaryWashing.rotors[index];
    group.traverse(mesh => {
      const u = mesh.material?.uniforms;
      if (!u?.uSnag) return;
      const positions = mesh.geometry.attributes.position, uv = mesh.geometry.attributes.uv;
      for (let i = 0; i < positions.count; i++) {
        const vertex = new THREE.Vector3().fromBufferAttribute(positions, i).applyMatrix4(mesh.matrixWorld);
        const hooked = THREE.MathUtils.smoothstep(1 - uv.getY(i), .35, 1)
          * THREE.MathUtils.smoothstep(uv.getX(i), .45, 1) * u.uSnag.value;
        vertex.lerp(u.uSnagAt.value, hooked);
        assert(vertex.distanceTo(frame.foot) < 15, `rotary ${index} cloth escapes its island before its first update`);
      }
    });
    assert.equal(group.children[0].rotation.y, frame.angle, 'first render uses the saved rotary angle');
  }
}
rotaryWashing.reset();
const rig = new RotaryWashingRig(new THREE.Vector4()), far = rotaryWashing.rotors[1];
const camera = new THREE.PerspectiveCamera();
let caught;
rig.group.traverse(mesh => { if (mesh.material?.uniforms?.uSnag?.value === 1) caught = mesh.material.uniforms; });
assert(caught);
for (const progress of [0, .25, .75, .99]) {
  far.unhook = progress; rig.update(1 / 60, camera);
  assert(caught.uSnagAt.value.distanceTo(far.snagPoint) < 1e-8, 'the caught corner stays on the pole until released');
  assert.equal(caught.uSnag.value, 1);
}
far.unhook = 1;
for (let i = 0; i < 30; i++) rig.update(1 / 60, camera);
assert(caught.uSnag.value < .02, 'the freed corner returns promptly to the hanging sheet');
rotaryWashing.reset();
console.log('PASS: closed and restored rotary cloth stays local before the Lines chapter updates.');
