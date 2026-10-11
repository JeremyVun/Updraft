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
console.log('PASS: closed and restored rotary cloth stays local before the Lines chapter updates.');
