// Deterministic mechanics checks. No renderer: wind and gestures are explicit fixtures.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { registerHooks } from 'node:module';
import { transformSync } from 'rolldown/utils';
import * as THREE from 'three';
registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier)) specifier += '.ts';
    return next(specifier, context);
  },
  load(url, context, next) {
    if (!url.endsWith('.ts')) return next(url, context);
    return { format: 'module', shortCircuit: true, source: transformSync(new URL(url).pathname, fs.readFileSync(new URL(url), 'utf8')).code };
  },
});
globalThis.location = { search: '?shot' };
globalThis.window = { matchMedia: () => ({ matches: false }) };
const { Embers } = await import('../src/fx/embers.ts');
const { EmberInvitation } = await import('../src/fx/ember-invitation.ts');
const { tuning } = await import('../src/tuning.ts');
const wind = { sample(_x, _z, out) { return Object.assign(out, { x: 20, z: 10, energy: 1, lift: 1 }); } };
for (const fps of [30, 60, 120]) {
  const e = new Embers(wind), coal = e.lay(-18, -1712), near = coal.p.clone();
  // Even a permanent full-strength wind cannot ignite a coal without a local gesture.
  for (let i = 0; i < fps * 20; i++) e.update(1 / fps, near, 1);
  assert.equal(coal.lit, false); assert.equal(coal.wake, 0);
  assert.equal(e.brightest(near.clone()), 0, 'loose cinders cannot bypass the light gate');
  // One frame of a fast pass is insufficient, even with a full residual field afterward.
  coal.breath = 1; e.update(1 / fps, near, 1); coal.breath = 0;
  for (let i = 0; i < fps * 5; i++) e.update(1 / fps, near, 1);
  assert.equal(coal.lit, false);
  for (let i = 0; i < fps; i++) { coal.breath = 1; e.update(1 / fps, near, 1); }
  assert(coal.lit, 'sustained direct fanning must light the coal');
  assert(e.brightest(near.clone()) > 1.2); assert.equal(e.takeCaught().length, 1);
  assert.equal(e.takeCaught().length, 0, 'a catch is emitted once');
  e.clearCoals(); assert.equal(e.takeCaught().length, 0);
  console.log(`${fps}fps: no idle/residual ignition or spark bypass; deliberate fanning lights once`);
}
const invitation = new EmberInvitation();
const camera = new THREE.PerspectiveCamera(50, 16 / 9, 0.1, 200);
camera.position.set(0, 4, 10); camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
const target = new THREE.Vector3();
for (let i = 0; i < 299; i++) invitation.update(1 / 60, camera, target);
assert.equal(invitation.batch.mesh.visible, false);
for (let i = 0; i < 35; i++) invitation.update(1 / 60, camera, target);
assert.equal(invitation.batch.mesh.visible, true);
invitation.update(1 / 60, camera, null); assert.equal(invitation.batch.mesh.visible, false);
assert.equal(tuning.wood.chainStep / 15, 1.35);
console.log('Five-second invitation and 35% path spacing passed.');

for (const fps of [30, 60, 120]) {
  const e = new Embers(wind), coal = e.lay(-18, -1712), near = coal.p.clone();
  camera.position.copy(coal.p).add(new THREE.Vector3(0, 4, 10));
  camera.lookAt(coal.p); camera.updateMatrixWorld();
  const input = { present: true, muted: false, ndc: new THREE.Vector2(), prevNdc: new THREE.Vector2() };
  for (let i = 0; i < fps * 2; i++) e.update(1 / fps, near, 1);
  // A two-pixel nudge at a 900px viewport, followed by idle air, cannot light it.
  input.ndc.x = 2 / 900 * 2;
  e.brush(camera, input, coal.p, 1 / fps); e.update(1 / fps, near, 1);
  input.prevNdc.copy(input.ndc);
  for (let i = 0; i < fps * 4; i++) { e.brush(camera, input, coal.p, 1 / fps); e.update(1 / fps, near, 1); }
  assert.equal(coal.lit, false);
  let strokes = 0;
  while (!coal.lit && strokes < 8) {
    for (let i = 0; i < fps; i++) {
      input.prevNdc.copy(input.ndc);
      input.ndc.set((strokes % 2 ? 1 : -1) * (0.15 - 0.3 * i / fps) / camera.aspect, 0);
      e.brush(camera, input, coal.p, 1 / fps); e.update(1 / fps, near, 1);
    }
    strokes++;
  }
  assert(coal.lit); assert(strokes >= 2 && strokes <= 5, `${fps}fps took ${strokes} strokes`);
  console.log(`${fps}fps: tiny motion stays unlit; ${strokes} real brush sweeps ignite`);
}

// Exercise the actual child, carrying, route and boarding with an explicit sustained-fanning fixture.
globalThis.document = { createElement: () => ({ getContext: () => ({ beginPath(){}, moveTo(){}, quadraticCurveTo(){}, stroke(){} }) }) };
const { Traveller } = await import('../src/traveller/traveller.ts');
const { Boat } = await import('../src/traveller/boat.ts');
const { Cygnet } = await import('../src/creatures/cygnet.ts');
const { Carry } = await import('../src/companion/carry.ts');
const { WoodChapter } = await import('../src/story/wood.ts');
const { CameraRig } = await import('../src/camera.ts');
const calm = { breeze: new THREE.Vector2(2, -1), calm: 3, addSplat(){},
  sample(_x, _z, out) { return Object.assign(out, { x: 2, z: -1, energy: 0, lift: 0 }); } };
for (const portrait of [false, true]) {
  const child = new Traveller(calm), cygnet = new Cygnet(), boat = new Boat(calm), embers = new Embers(calm);
  const carry = new Carry(child, cygnet), rig = new CameraRig();
  rig.resize(portrait ? 390 : 1440, portrait ? 844 : 900);
  child.place(-26, -1688, Math.PI); cygnet.mount = child; cygnet.rideIn('satchel');
  const plane = { position: new THREE.Vector3(), home: new THREE.Vector3(), soggy: { value: 1 }, landed: false, held: false,
    launch(p) { this.position.copy(p); this.landed = true; },
    hold(c) { this.held = true; c.carryingPlane = true; c.handPosition(this.position); } };
  const c = new WoodChapter({ child, cygnet, boat, embers, carry, plane, wind: calm, input: { gust: 0 } });
  c.update(0, 0); rig.cut(c.shot);
  const resumed = new Set();
  let last = '', complete = false, worstWaitFrame = 0, worst = null, waited = 0, previousTarget = null;
  for (let frame = 1; frame <= 30 * 400; frame++) {
    const dt = 1 / 30, time = frame * dt;
    const target = c.windInvitation;
    waited = target === previousTarget ? waited + dt : 0; previousTarget = target;
    for (const coal of embers.coals) coal.breath = coal.p === target && c.t > 6 ? 1 : 0;
    c.brushDry(c.t > 6 && c.beat === 'dry' ? 1 : 0);
    c.update(dt, time); boat.update(dt, time); child.update(dt); carry.update(dt);
    cygnet.update(dt, time, child.position, calm.sample(0, 0, {})); carry.after();
    embers.update(dt, child.position, c.embers); rig.update(dt, time, c.shot, c.pace);
    if (c.beat !== last) { console.log(`${portrait ? 'portrait' : 'desktop'} route: ${c.beat} at ${time.toFixed(1)}s`); last = c.beat; }
    if (target && target === c.windInvitation && !child.moving && waited > 5) {
      const p = target.clone().project(rig.camera);
      if (Math.max(Math.abs(p.x), Math.abs(p.y)) > worstWaitFrame) { worstWaitFrame = Math.max(Math.abs(p.x), Math.abs(p.y)); worst = { beat: c.beat, time, target: target.toArray(), child: child.position.toArray(), projected: p.toArray() }; }
    }
    if (c.checkpoint && !resumed.has(c.checkpoint) && !child.busy && !carry.busy) {
      const point = c.checkpoint, data = c.saveCheckpoint(), along = c.chainAt;
      assert.equal(data.length, 2, 'keep the existing save schema valid');
      c.restoreCheckpoint(point, data); resumed.add(point);
      assert.equal(c.chainAt, along, 'resume must not skip the waiting ember');
      assert.equal(c.ahead.lit, false, 'resume must not solve the waiting ember');
      assert.equal(embers.takeCaught().length, 0, 'restored light must not emit another progress event');
    }
    if (c.done) { complete = true; break; }
  }
  assert(complete, `route must complete: ${c.beat}, leg ${c.leg}, child ${child.position.toArray()}`);
  assert(worstWaitFrame < 0.95, `waiting target must remain in frame: ${JSON.stringify(worst)}`);
  assert(plane.soggy.value <= 0.02);
  assert.deepEqual([...resumed], ['found', 'dry']);
  console.log(`${portrait ? 'portrait' : 'desktop'} full route, rescue, plane, boarding and framing passed`);
}
