import './lib/typescript.mjs';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { drownedCast } from './lib/storm-cast.mjs';
const { DrownedChapter } = await import('../src/story/drowned.ts');
const { playCatSteps } = await import('../src/story/cat-steps.ts');
const { CAT_WAY, TOWER } = await import('../src/world/drowned-way.ts');
const { tuning } = await import('../src/tuning.ts');
const wind = { breeze: new THREE.Vector2(), calm: 0, addSplat() {}, sample(x, z, out) {
  return Object.assign(out, { x: 0, z: 0, lift: 0, energy: 0 });
} };
const cast = drownedCast(wind), chapter = new DrownedChapter(cast);
chapter.skipToRun();
const only = process.env.ONLY;
if (!only || only === 'cat') {
  const h = TOWER.half + 0.23;
  const tower = new THREE.Box3(new THREE.Vector3(TOWER.x - h, -4.7, TOWER.z - h), new THREE.Vector3(TOWER.x + h, 7.7, TOWER.z + h));
  for (const fps of [30, 60, 120]) {
    const cat = cast.cat, steps = chapter.run.catSteps('swing');
    cat.place(CAT_WAY.swing[0], 0, { pose: 'stand' });
    let done = false, clearance = Infinity;
    const route = playCatSteps(cat, steps, CAT_WAY.swing[0], { run: tuning.drowned.run.catSpeed, narrow: tuning.drowned.run.railSpeed }, () => {}, () => { done = true; });
    const { position: p, aSkin: skin } = cat.mesh.geometry.attributes;
    const a = new THREE.Vector3(), b = new THREE.Vector3();
    for (let i = 0; i < fps * 30 && !done; i++) {
      route.update(); cat.update(1 / fps);
      if (route.step < 3) continue;
      for (let j = 0; j < p.count; j++) {
        a.fromBufferAttribute(p, j);
        b.copy(a).applyMatrix4(cat.rig.bones[Math.round(skin.getY(j))]);
        a.applyMatrix4(cat.rig.bones[Math.round(skin.getX(j))]).lerp(b, skin.getZ(j));
        clearance = Math.min(clearance, tower.distanceToPoint(a));
      }
    }
    assert(done, `cat never reaches nave at ${fps} Hz`);
    console.log(`tower corner ${fps} Hz: posed cat clearance ${clearance.toFixed(3)} m`);
    assert(clearance > 0.08, `cat clips or brushes tower corner: ${clearance} m`);
  }
}
if (!only || only === 'band') {
  const meshes = cast.village.objects.filter(o => o.isMesh && o.geometry.attributes.aLocal);
  for (const axis of ['x', 'z']) for (const side of [-1, 1]) for (const corner of [-1, 1]) {
    if (axis === 'x' && side === -1) continue;
    const across = axis === 'x' ? 'z' : 'x';
    const origin = new THREE.Vector3(TOWER.x, 5.35, TOWER.z);
    origin[axis] += side * 6;
    origin[across] += corner * (TOWER.half - 0.45);
    const direction = new THREE.Vector3(); direction[axis] = -side;
    const hits = new THREE.Raycaster(origin, direction).intersectObjects(meshes, false);
    assert(hits.length >= 2, 'band and corner post must both be sampled');
    const gap = hits[1].distance - hits[0].distance;
    console.log(`stone band ${axis}/${side}/${corner}: face separation ${gap.toFixed(3)} m`);
    assert(gap > 0.04, `stone band is coplanar with corner post: ${gap}`);
  }
  for (const across of [-1, 0, 1]) {
    const origin = new THREE.Vector3(TOWER.x - 6, 5.35, TOWER.z + across);
    const hits = new THREE.Raycaster(origin, new THREE.Vector3(1, 0, 0)).intersectObjects(meshes, false);
    assert(hits.length > 0, 'ivy face must retain its tower wall');
    assert(Math.abs(hits[0].distance - (6 - TOWER.half)) < 0.001, 'stone band obstructs the ivy climb');
  }
  console.log('ivy face: no stone band across the climb');
}
