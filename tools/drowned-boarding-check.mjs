import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import { stormCast } from './lib/storm-cast.mjs';
import { childBody } from './lib/child-head.mjs';
const { CameraRig } = await import('../src/camera.ts');
const { NAVE_NORTH } = await import('../src/world/drowned-way.ts');
const wind = { breeze: new THREE.Vector2(), calm: 0, addSplat() {}, sample(x, z, out) {
  return Object.assign(out, { x: 0, z: 0, lift: 0, energy: 0 });
} };
for (const [width, height] of [[1800, 900], [1600, 900], [900, 1600]]) {
  const { cast, chapter } = stormCast(wind), church = chapter.church, rig = new CameraRig();
  const c = cast.child;
  church.to('wait'); church.aboardFor = -1; church.madeFast = false;
  c.decks = [NAVE_NORTH]; c.dismount(); c.standUp();
  c.place(NAVE_NORTH.x0, NAVE_NORTH.z0, 0);
  c.position.y = NAVE_NORTH.height;
  c.walkTo(NAVE_NORTH.x1, NAVE_NORTH.z1, false, () => c.stop(), 0.12);
  rig.resize(width, height); chapter.afterCamera(rig.camera);
  chapter.update(0, 0); rig.cut(chapter.shot);
  const trace = [], dir = new THREE.Vector3();
  const body = childBody(c), point = new THREE.Vector3();
  let bodyEdge = 0, catEdge = 0;
  let yaw = 0, was = null, reverse = 0, forward = 0;
  for (let i = 1; i <= 60 * 30; i++) {
    const dt = 1 / 60, t = i * dt;
    cast.boat.grounded = t >= 10;
    chapter.update(dt, t); cast.boat.update(dt, t); c.update(dt); cast.cat.update(dt);
    cast.village.kittens.update(dt, t); rig.update(dt, t, chapter.shot, chapter.pace); chapter.afterCamera(rig.camera);
    rig.camera.getWorldDirection(dir);
    const a = Math.atan2(dir.x, dir.z);
    if (was !== null && (church.step === 'board' || church.step === 'aboard')) {
      const delta = Math.atan2(Math.sin(a - was), Math.cos(a - was));
      yaw += delta;
      if (delta > 0) forward += delta; else reverse -= delta;
    }
    was = a;
    if (i % 6 === 0 && (church.step === 'board' || church.step === 'aboard')) {
      bodyEdge = Math.max(bodyEdge, ...body(rig.camera).map(x => Math.abs(x * 2 - 1)));
      for (const cat of [cast.cat, cast.village.kittens.cats[0]]) {
        for (const height of [0, .75]) {
          point.copy(cat.position).setY(cat.position.y + height).project(rig.camera);
          catEdge = Math.max(catEdge, Math.abs(point.x), Math.abs(point.y));
        }
      }
    }
    if (i % 15 === 0) trace.push({ t, step: church.step, aboard: church.aboardFor, yaw: yaw * 180 / Math.PI,
      lens: rig.camera.position.toArray(), her: c.position.toArray(), look: dir.toArray() });
    if (church.aboardFor >= 7.5) break;
  }
  assert(church.aboardFor >= 7.5, 'boarding did not complete');
  console.log(`${width}×${height}: pan +${THREE.MathUtils.radToDeg(forward).toFixed(1)}° / -${THREE.MathUtils.radToDeg(reverse).toFixed(1)}°`);
  if (process.env.OUT) fs.writeFileSync(`${process.env.OUT}-${width}.json`, JSON.stringify(trace));
  assert(THREE.MathUtils.radToDeg(Math.min(forward, reverse)) < 1, 'boarding camera reverses before looking up');
  console.log(`boarding through look-up: body edge ${bodyEdge.toFixed(3)}, window cats ${catEdge.toFixed(3)}`);
  assert(bodyEdge < .98, 'boarding/look-up crops the child');
  assert(catEdge < .96, 'boarding/look-up loses the window cats');
}
