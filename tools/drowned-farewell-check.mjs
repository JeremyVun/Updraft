import assert from 'node:assert/strict';
import * as THREE from 'three';
import { stormCast } from './lib/storm-cast.mjs';
import { childHead } from './lib/child-head.mjs';
const { CameraRig } = await import('../src/camera.ts');
const { tuning } = await import('../src/tuning.ts');
const B = await import('../src/creatures/cat/body.ts');
const wind = { breeze: new THREE.Vector2(), calm: 0, addSplat() {}, sample(x, z, out) {
  return Object.assign(out, { x: 0, z: 0, lift: 0, energy: 0 });
} };
for (const [fps, width, height] of [[30, 1600, 900], [60, 1600, 900], [30, 900, 1600], [60, 900, 1600]]) {
  const { cast, chapter } = stormCast(wind), rig = new CameraRig();
  rig.resize(width, height); chapter.afterCamera(rig.camera); chapter.update(0, 0); rig.cut(chapter.shot);
  const head = childHead(cast.child), v = new THREE.Vector3(), tail = new Set(B.TAIL);
  let edge = 0, catPixels = Infinity;
  for (let i = 1; i <= fps * tuning.drownedCamera.church.releaseFrom; i++) {
    const dt = 1 / fps, t = i * dt;
    chapter.update(dt, t); cast.boat.update(dt, t); cast.child.update(dt); cast.cat.update(dt);
    cast.village.kittens.update(dt, t); rig.update(dt, t, chapter.shot, chapter.pace); chapter.afterCamera(rig.camera);
    if (t < tuning.drowned.church.blinkAt || i % Math.max(1, Math.round(fps / 10))) continue;
    const bounds = head(rig.camera);
    edge = Math.max(edge, ...bounds.map(x => Math.abs(x * 2 - 1)));
    let top = Infinity, bottom = -Infinity;
    for (let j = 1; j < B.BONES; j++) {
      if (tail.has(j)) continue;
      cast.cat.rig.joint(j, v);
      if (j === B.EAR_L || j === B.EAR_R) v.y += 0.035 * cast.cat.scale;
      v.project(rig.camera); top = Math.min(top, v.y); bottom = Math.max(bottom, v.y);
    }
    catPixels = Math.min(catPixels, (bottom - top) * height / 2);
  }
  assert(edge < 0.96, `farewell crops hood or face (${width}×${height}, ${fps} Hz): ${edge}`);
  assert(catPixels > 45 * Math.min(width, height) / 900, `farewell cat too small: ${catPixels}`);
  console.log(`farewell ${width}×${height} ${fps} Hz: whole-head edge ${edge.toFixed(3)}, cat ${catPixels.toFixed(1)} px`);
}
