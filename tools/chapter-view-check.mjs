// A chapter transition must not expose an uninitialized camera target or focus.
import './lib/typescript.mjs';
import assert from 'node:assert/strict';
import * as THREE from 'three';

globalThis.location = { search: '?shot' };
const { Journey } = await import('../src/story/journey.ts');
const { CameraRig } = await import('../src/camera.ts');

for (const fps of [10, 30, 60, 120]) {
  // Presentation is populated by update(), as in the crossing and sleeping chapters.
  const at = new THREE.Vector3(-132, 4, -1916);
  const nextAt = at.clone().add(new THREE.Vector3(-2, 0, -1));
  let oldUpdates = 0, newUpdates = 0;
  const old = { shot: { target: at.clone(), distance: 15, height: 4 }, focus: at.clone(), pace: .4,
    done: true, update() { oldUpdates++; } };
  const next = { shot: { target: new THREE.Vector3(), distance: 16, height: 5 },
    focus: new THREE.Vector3(), pace: .5, done: false,
    update() { newUpdates++; this.shot.target.copy(nextAt); this.focus.copy(nextAt); } };
  const journey = Object.assign(Object.create(Journey.prototype), { name: 'toSleeping', chapter: old,
    savedPoint: 'entry', cast: {}, make: () => next });
  const rig = new CameraRig(); rig.resize(1280, 800); rig.cut(old.shot);
  const before = rig.camera.position.clone();
  journey.update(1 / fps, 100);
  assert.equal(journey.name, 'sleeping'); assert.equal(journey.current, next);
  assert.equal(oldUpdates, 1); assert.equal(newUpdates, 0, 'view preparation must not tick the new story early');
  assert(journey.shot.target.equals(at), 'transition must retain the prepared view instead of the origin');
  assert(journey.focus.equals(at), 'audio habitat must not sample the origin during a transition');
  rig.update(1 / fps, 0, journey.shot, journey.pace);
  assert(before.distanceTo(rig.camera.position) < .1, 'first transition frame must not jump');
  journey.update(1 / fps, 100 + 1 / fps);
  assert.equal(newUpdates, 1); assert.equal(journey.shot, next.shot); assert.equal(journey.focus, next.focus);
  assert.equal(journey.pace, next.pace);
  rig.update(1 / fps, 1 / fps, journey.shot, journey.pace);
  assert(before.distanceTo(rig.camera.position) < 1, 'prepared chapter view must blend normally');

  // Startup/restore already asks for a zero-time update before the initial camera cut.
  journey.begin('sleeping');
  journey.update(0, 0);
  assert.equal(journey.shot, next.shot); assert.equal(journey.focus, next.focus);
}
console.log('Chapter views: no origin target/focus, no extra story tick, continuous camera and zero-time setup at 10–120 Hz passed.');
