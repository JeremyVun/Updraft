import './lib/typescript.mjs';
import assert from 'node:assert/strict';
import * as THREE from 'three';
globalThis.location = { search: '?shot' };
const { CrossingLinen } = await import('../src/fx/crossing-linen.ts');
const { tuning } = await import('../src/tuning.ts');
const wind = { sample(_x, _z, out) { return Object.assign(out, { x: 2.5, z: -.8, energy: 0, lift: 0 }); } };
for (const aspect of [390 / 844, 16 / 9, 2]) for (const pan of [-1.2, 0, 1.2]) {
  const camera = new THREE.PerspectiveCamera(48, aspect, .1, 500), boat = new THREE.Vector3();
  const echoes = new CrossingLinen(wind, camera), frustum = new THREE.Frustum(), matrix = new THREE.Matrix4();
  const visible = p => { p.project(camera); return Math.abs(p.x) <= 1 && Math.abs(p.y) <= 1 && p.z >= -1 && p.z <= 1; };
  let births = 0, entered = false;
  for (let frame = 0; frame <= 38 * 60; frame++) {
    const t = frame / 60; boat.z = t * 6;
    camera.position.set(0, 12, boat.z - 26);
    const yaw = pan * Math.max(0, 1 - t / 6);
    camera.lookAt(Math.sin(yaw) * 40, 6, boat.z + Math.cos(yaw) * 40);
    camera.updateMatrixWorld(true);
    const hadBirds = echoes.birds.geometry.instanceCount > 0, hadCloth = echoes.linen.map(l => l.mesh.visible);
    echoes.update(1 / 60, tuning.opening.shoreEchoes.afterFarewell + t, boat, 0, null);
    const positions = echoes.birds.geometry.attributes.iPos.array;
    for (let i = 0; i < echoes.birds.geometry.instanceCount; i++) {
      entered ||= visible(new THREE.Vector3().fromArray(positions, i * 4));
    }
    if (!hadBirds && echoes.birds.geometry.instanceCount) {
      frustum.setFromProjectionMatrix(matrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
      const positions = echoes.birds.geometry.attributes.iPos.array;
      for (let i = 0; i < tuning.opening.shoreEchoes.gulls; i++) assert(!frustum.intersectsSphere(new THREE.Sphere(new THREE.Vector3().fromArray(positions, i * 4), 2)),
        `whole gull spawns outside ${aspect} view during pan ${pan}`);
      births++;
    }
    echoes.linen.forEach((l, i) => {
      if (!l.mesh.visible || hadCloth[i]) return;
      for (let j = 0; j < l.cloth.count; j++) assert(!visible(new THREE.Vector3().fromArray(l.cloth.view, j * 3)),
        `linen ${i} spawns outside ${aspect} view during pan ${pan}`);
      births++;
    });
  }
  assert.equal(births, tuning.opening.shoreEchoes.laundry.length + 2);
  if (pan === 0) assert(entered, `gulls fly into the settled ${aspect} sailing view`);
}
console.log('All gull and cloth births stay outside the frame across portrait, landscape and whale-pan bearings.');
for (const fps of [30, 60, 120]) {
  const echoes = new CrossingLinen(wind, new THREE.PerspectiveCamera()), boat = new THREE.Vector3();
  const heights = [];
  let previous = null, heightSpread = 0, speedSpread = 0, directionSpread = 0;
  for (let f = 0; f < 48 * fps; f++) {
    const t = f / fps; boat.z = t * 6;
    echoes.update(1 / fps, tuning.opening.shoreEchoes.afterFarewell + t, boat, 0, null);
    for (const l of echoes.linen) if (l.mesh.visible) {
      assert([...l.cloth.view].every(Number.isFinite));
      if (l.carried) assert(new THREE.Vector3(...l.cloth.view.slice(0, 3)).distanceTo(l.anchor) < .18,
        'the linen stays in the gull bill at every frame rate');
    }
    if (f % fps === 0 && t > 12) {
      const centres = echoes.linen.slice(1).map(l => {
        if (!l.mesh.visible) return null;
        const p = new THREE.Vector3();
        for (let i = 0; i < l.cloth.count; i++) p.add(new THREE.Vector3().fromArray(l.cloth.view, i * 3));
        return p.multiplyScalar(1 / l.cloth.count);
      });
      heightSpread = Math.max(heightSpread, Math.max(...centres.filter(Boolean).map(p => p.y)) - Math.min(...centres.filter(Boolean).map(p => p.y)));
      if (previous) {
        const velocities = centres.flatMap((p, i) => p && previous[i] ? [p.clone().sub(previous[i]).setY(0)] : []);
        const speeds = velocities.map(v => v.length());
        speedSpread = Math.max(speedSpread, Math.max(...speeds) - Math.min(...speeds));
        for (const a of velocities) for (const b of velocities) directionSpread = Math.max(directionSpread, a.angleTo(b));
      }
      previous = centres;
    }
    if (f % (10 * fps) === 0) heights.push(echoes.linen.map(l => l.cloth.view[1]));
  }
  assert(heightSpread > 6 && speedSpread > 2 && directionSpread > .25, 'loose sheets separate in height, pace and direction');
  echoes.update(1 / fps, undefined, boat, 0, null);
  assert.equal(echoes.birds.geometry.instanceCount, 0);
  assert(echoes.linen.every(l => !l.mesh.visible));
  console.log({ fps, heightSpread, speedSpread, directionSpread, heights });
}
