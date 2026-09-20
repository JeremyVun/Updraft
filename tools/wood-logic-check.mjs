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
globalThis.window = { innerHeight: 900, matchMedia: () => ({ matches: false }) };
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
// Render light may build while the gate remains closed; ignition must not flash the scene in one frame.
for (const fps of [30, 60, 120]) {
  const e = new Embers(wind), coal = e.lay(-18, -1712), near = coal.p.clone();
  for (let i = 0; i < fps * 3; i++) e.update(1 / fps, near, 1);
  let last = 0, maxStep = 0, warmed = false;
  while (!coal.lit) {
    coal.breath = 0.5; e.update(1 / fps, near, 1);
    const light = e.illumination(near.clone());
    maxStep = Math.max(maxStep, light - last); last = light;
    if (coal.wake > 0.4 && !coal.lit) {
      warmed = true; assert(light > 0); assert.equal(e.brightest(near.clone()), 0);
    }
  }
  assert(warmed); assert(maxStep < 0.8, `${fps}fps ignition illumination jumped ${maxStep}`);
  e.clearCoals(); assert.equal(e.illumination(near.clone()), 0);
}
console.log('Progressive forest illumination stays separate from the ignition gate at 30/60/120fps.');
// A cold shelter ember must survive pool reuse while the player fans ahead quickly.
{
  const e = new Embers(wind), reserved = e.lay(-9.1, -1792.05), at = reserved.p.clone();
  reserved.reveal = 0;
  for (let i = 0; i < 20; i++) e.lay(-20, -1700 - i * 10);
  assert.equal(reserved.reveal, 0); assert(reserved.p.equals(at));
}
const invitation = new EmberInvitation();
const camera = new THREE.PerspectiveCamera(50, 16 / 9, 0.1, 200);
camera.position.set(0, 4, 10); camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
const target = new THREE.Vector3();
const idleInput = { present: false, muted: false, ndc: new THREE.Vector2(), prevNdc: new THREE.Vector2() };
for (let i = 0; i < 299; i++) invitation.update(1 / 60, camera, target, idleInput);
assert.equal(invitation.batch.mesh.visible, false);
for (let i = 0; i < 35; i++) invitation.update(1 / 60, camera, target, idleInput);
assert.equal(invitation.batch.mesh.visible, true);
invitation.update(1 / 60, camera, null, idleInput); assert.equal(invitation.batch.mesh.visible, false);
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
const { takeCues } = await import('../src/story/cues.ts');
const { CameraRig } = await import('../src/camera.ts');
const { Glider } = await import('../src/glider/glider.ts');
const calm = { breeze: new THREE.Vector2(2, -1), calm: 3, addSplat(){},
  sample(_x, _z, out) { return Object.assign(out, { x: 2, z: -1, energy: 0, lift: 0 }); } };
// Gusts used to kindle the plane's ember must not blow the wet paper away and hold the child forever.
const planeWind = { ...calm, sample(_x, _z, out) { return Object.assign(out, { x: 12, z: -8, energy: 1, lift: 1 }); } };
for (const fps of [30, 60, 120]) {
  const paper = new Glider(planeWind, []), at = new THREE.Vector3(-37, 23, -1848);
  paper.layDown(at);
  for (let frame = 0; frame < fps * 3; frame++) {
    paper.brush(camera, new THREE.Vector2(-0.1, 0), new THREE.Vector2(0.1, 0), 1, new THREE.Vector2(1, 0), 1, 1 / fps);
    paper.update(1 / fps, frame / fps);
  }
  assert(paper.landed && paper.position.distanceTo(at) < 0.001, 'wet paper must settle under full wind and direct brushing');
  paper.launch(at, new THREE.Vector3(2, 3, -1));
  for (let frame = 0; frame < fps; frame++) paper.update(1 / fps, 3 + frame / fps);
  assert(paper.position.distanceTo(at) > 1, 'a later launch must release the ground placement');
}
for (const portrait of [false, true]) {
  const child = new Traveller(calm), cygnet = new Cygnet(), boat = new Boat(calm), embers = new Embers(calm);
  const carry = new Carry(child, cygnet), rig = new CameraRig();
  rig.resize(portrait ? 390 : 1440, portrait ? 844 : 900);
  child.place(-26, -1688, Math.PI); cygnet.mount = child; cygnet.rideIn('satchel');
  const plane = new Glider(planeWind, []);
  const c = new WoodChapter({ child, cygnet, boat, embers, carry, plane, wind: calm, input: { gust: 0 } });
  c.update(0, 0); rig.cut(c.shot);
  const resumed = new Set();
  let last = '', complete = false, worstWaitFrame = 0, worst = null, waited = 0, previousTarget = null;
  let birdBefore = null, worstBirdStep = 0, wetPaper = null, worstEscapeFrame = 0;
  const seen = new Set();
  let scrambleCount = 0, sawCoax = false; takeCues();
  for (let frame = 1; frame <= 30 * 400; frame++) {
    const dt = 1 / 30, time = frame * dt;
    const target = c.windInvitation;
    waited = target === previousTarget ? waited + dt : 0; previousTarget = target;
    for (const coal of embers.coals) coal.breath = coal.p === target && c.t > 6 ? 1 : 0;
    c.brushDry(c.t > 6 && ['snag', 'dry'].includes(c.beat) ? 1 : 0);
    c.update(dt, time); boat.update(dt, time); child.update(dt); plane.update(dt, time); carry.update(dt);
    cygnet.update(dt, time, child.position, calm.sample(0, 0, {})); carry.after();
    embers.update(dt, child.position, c.embers); rig.update(dt, time, c.shot, c.pace); c.afterCamera(rig.camera);
    assert(!takeCues().includes('restored'), 'the reunion must not play the level-complete cue');
    scrambleCount += cygnet.heard.filter(h => h.kind === 'scramble').length; cygnet.heard.length = 0;
    if (c.hearth && ['walk', 'compose', 'fright'].includes(c.beat) && !c.goingToBird) assert.equal(c.hearth.reveal, 0, 'shelter ember leaked before the angle change: '+JSON.stringify({time,beat:c.beat,child:child.position.toArray(),hearth:c.hearth.p.toArray(),coals:embers.coals.filter(k=>k.live).map(k=>[...k.p.toArray(),k.reveal])}));
    if (c.coaxing && !c.gathering) {
      sawCoax = true; assert(child.position.x < -12, 'child must coax from outside the rock');
    }
    if (c.gathering && !cygnet.carried) assert(cygnet.position.x < -11, 'pick up only after the cygnet exits');
    if (!cygnet.carried && !cygnet.seating.move && Math.abs(cygnet.position.x + 10.4) < 0.15) {
      assert(Math.abs(cygnet.position.z + 1791.45) < 1.2, 'the cygnet must pass through the mouth, not a side wall');
    }
    seen.add(c.beat);
    if (['fright', 'bolt', 'lost'].includes(c.beat)) assert(c.hearth?.live, 'refuge ember must exist before the escape');
    if (c.beat === 'bolt' && cygnet.seating.move) {
      assert(cygnet.stay && !cygnet.errand, 'landing target must stay fixed until the jump finishes');
    }
    if (c.beat === 'fright') assert(c.stormStrike, 'the fright must have an authored weather event');
    if (['fright', 'bolt', 'lost'].includes(c.beat)) {
      for (const at of [child.position.clone().add(new THREE.Vector3(0, 1.4, 0)), cygnet.seating.shown.p]) {
        const p = at.clone().project(rig.camera);
        worstEscapeFrame = Math.max(worstEscapeFrame, Math.abs(p.x), Math.abs(p.y));
      }
    }
    if (['fright', 'bolt'].includes(c.beat) && birdBefore) {
      worstBirdStep = Math.max(worstBirdStep, cygnet.seating.shown.p.distanceTo(birdBefore));
    }
    birdBefore = cygnet.seating.shown.p.clone();
    if (c.beat === 'plane') {
      wetPaper ??= plane.position.clone();
      assert(plane.position.distanceTo(wetPaper) < 0.3, 'the caught paper may sway with its branch but cannot drift away');
      assert(!plane.landed, 'a caught plane cannot be picked up from the ground');
    }
    if (c.beat === 'snag' && c.t < 5) assert.equal(c.planeWork, 0, 'idle wind cannot free the plane');
    if (c.beat !== last) { console.log(`${portrait ? 'portrait' : 'desktop'} route: ${c.beat} at ${time.toFixed(1)}s`); last = c.beat; }
    if (target && target === c.windInvitation && !child.moving && waited > 5) {
      const p = target.clone().project(rig.camera);
      if (Math.max(Math.abs(p.x), Math.abs(p.y)) > worstWaitFrame) { worstWaitFrame = Math.max(Math.abs(p.x), Math.abs(p.y)); worst = { beat: c.beat, time, target: target.toArray(), child: child.position.toArray(), projected: p.toArray() }; }
    }
    if (portrait && c.checkpoint && !resumed.has(c.checkpoint) && !child.busy && !carry.busy) {
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
  assert.equal(scrambleCount, 1, 'one audible feather scramble per escape');
  assert(sawCoax, 'the child must coax the cygnet out before lifting it');
  assert(seen.has('snag') && seen.has('fall') && seen.has('pickup'), 'free the plane from the tree before collecting it');
  assert(plane.soggy.value <= 0.02);
  assert(seen.has('fright') && seen.has('bolt') && seen.has('lost'), 'thunder fright, continuous jump and rescue must all play');
  assert(worstEscapeFrame < 0.95, `escape left the frame: ${worstEscapeFrame}`);
  assert(worstBirdStep < 0.35, `bird teleported during separation: ${worstBirdStep} units in one frame`);
  assert.deepEqual([...resumed], portrait ? ['found', 'dry'] : []);
  console.log(`${portrait ? 'portrait' : 'desktop'} full route, continuous separation (${worstBirdStep.toFixed(3)} max step), wet plane in full wind, boarding and framing passed`);
}

// The authored clap fires once, close behind the flash, even during a long idle in the rescue.
const { StormWeather } = await import('../src/fx/storm.ts');
const { atmo } = await import('../src/world/atmosphere.ts');
for (const fps of [30, 60, 120]) {
  const sounds = [], weather = new StormWeather((strength, pan, close) => sounds.push({ strength, pan, close, time }));
  let time = 0;
  const tick = strike => {
    atmo.uniforms.uNight.value = 1; atmo.uniforms.uShower.value = 1;
    weather.update(1 / fps, 1, 0, 0.28, 1, strike); time += 1 / fps;
  };
  for (let i = 0; i < fps * 20; i++) tick(null);
  assert.equal(sounds.length, 0, 'random thunder must not obscure the authored fright');
  const strike = { heading: 1 }, start = time;
  let peak = 0;
  for (let i = 0; i < fps * 60; i++) { tick(strike); peak = Math.max(peak, atmo.uniforms.uLightning.value.w); }
  assert.equal(sounds.length, 1); assert(sounds[0].close);
  assert(Math.abs(sounds[0].time - start - tuning.wood.frightThunderDelay) < 1 / fps + 0.001);
  assert(peak > 0.8, 'authored flash must reveal the escape through the canopy');
  for (let i = 0; i < fps * 5; i++) tick(null);
  assert.equal(sounds.length, 1, 'checkpoint restore must not replay the fright');
}
console.log('One authored flash and close clap; no ambient overlap or idle/checkpoint replay at 30/60/120fps.');
