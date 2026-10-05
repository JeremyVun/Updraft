// Deterministic mechanics checks. No renderer: wind and gestures are explicit fixtures.
import './lib/typescript.mjs';
import assert from 'node:assert/strict';
import * as THREE from 'three';

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
  for (let i = 0; i < Math.ceil(fps * 1.05 / tuning.wood.updraftCatch); i++) { coal.breath = 1; e.update(1 / fps, near, 1); }
  assert(coal.lit, 'a sustained updraft over the coal must light it');
  assert(e.brightest(near.clone()) > 1.2); assert.equal(e.takeCaught().length, 1);
  assert.equal(e.takeCaught().length, 0, 'a catch is emitted once');
  e.clearCoals(); assert.equal(e.takeCaught().length, 0);
  console.log(`${fps}fps: no idle/residual ignition or spark bypass; a sustained updraft lights once`);
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
  const input = { present: true, muted: false, ndc: new THREE.Vector2(), prevNdc: new THREE.Vector2(), charge: 0, updraftAt: coal.p.clone() };
  const frame = () => { e.updraft(input, coal.p); e.brush(camera, input, coal.p, 1 / fps); e.update(1 / fps, near, 1); };
  for (let i = 0; i < fps * 2; i++) frame();
  // Straight sweeps straight across the coal build no updraft charge and no longer light it.
  for (let stroke = 0; stroke < 12; stroke++) {
    for (let i = 0; i < fps; i++) {
      input.prevNdc.copy(input.ndc);
      input.ndc.set((stroke % 2 ? 1 : -1) * (0.15 - 0.3 * i / fps) / camera.aspect, 0);
      frame();
    }
  }
  assert.equal(coal.lit, false); assert.equal(coal.wake, 0, 'straight sweeps must not wake a coal');
  // Weak circling, and a full updraft wound up away from the coal, cannot light it either.
  input.charge = tuning.wood.updraftFrom * 0.9;
  for (let i = 0; i < fps * 10; i++) frame();
  input.charge = 1; input.updraftAt.set(coal.p.x + tuning.wood.updraftReach * 1.2, coal.p.y, coal.p.z);
  for (let i = 0; i < fps * 10; i++) frame();
  assert.equal(coal.lit, false); assert.equal(coal.wake, 0, 'only an updraft over the coal feeds it');
  // An updraft over the coal lights it in about two seconds of circling (`tuning.wood.updraftCatch`).
  input.updraftAt.copy(coal.p);
  let frames = 0;
  while (!coal.lit && frames < fps * 10) { input.charge = Math.min(1, frames / fps); frame(); frames++; }
  assert(coal.lit, 'an updraft over the coal must light it');
  assert(frames / fps > 1.5 && frames / fps < 3, `${fps}fps took ${frames / fps}s`);
  console.log(`${fps}fps: straight sweeps, weak circling and a distant updraft stay unlit; an updraft over it lights in ${(frames / fps).toFixed(2)}s`);
}

// Exercise the actual child, carrying, route and boarding with an explicit sustained-fanning fixture.
globalThis.document = { createElement: () => ({ getContext: () => ({ beginPath(){}, moveTo(){}, quadraticCurveTo(){}, stroke(){} }) }) };
const { Traveller } = await import('../src/traveller/traveller.ts');
const { Boat } = await import('../src/traveller/boat.ts');
const { Cygnet } = await import('../src/creatures/cygnet.ts');
const { Carry } = await import('../src/companion/carry.ts');
const { WoodChapter } = await import('../src/story/wood.ts');
const { WOOD_APPROACH_LIGHT, WOOD_LANDING, WOOD_PATH, WOOD_BERTH } = await import('../src/world/wood.ts');
const { WOOD_SHAPE, SHAPE_FACING, SHAPE_WAIT, WoodShape, shapeUniforms, beastEyes, SHAPE_STUMP_CAPS } = await import('../src/world/wood-shape.ts');
const { woodOwl } = await import('../src/creatures/owl.ts');
new WoodShape({ shadows: null, flaps: null, rock: null, leaves: null, wing: null });
/** How far the owl's body is off the stump's limbs: its middle to each limb's surface, less its own size. */
const owlBody = new THREE.Vector3(), limbA = new THREE.Vector3(), limbB = new THREE.Vector3(), onLimb = new THREE.Line3();
const offLimbs = () => {
  woodOwl.toWorld(owlBody.set(0, 0.16, 0), false, owlBody);
  let worst = Infinity;
  for (let i = 2; i < SHAPE_STUMP_CAPS; i++) {
    const a = shapeUniforms.uShapeA.value[i], b = shapeUniforms.uShapeB.value[i];
    onLimb.set(limbA.set(a.x, a.y, a.z), limbB.set(b.x, b.y, b.z));
    const t = onLimb.closestPointToPointParameter(owlBody, true);
    worst = Math.min(worst, onLimb.at(t, limbA).distanceTo(owlBody) - (a.w + (b.w - a.w) * t));
  }
  return worst - 0.3 * woodOwl.size;
};
const WAY = [WOOD_LANDING, ...WOOD_PATH, new THREE.Vector2(WOOD_BERTH.x, WOOD_BERTH.z)];
/** Trunks stand at least 5 units from this line (`CORRIDOR` in world/wood.ts). */
const offPath = (x, z) => Math.min(...WAY.slice(1).map((b, i) => {
  const a = WAY[i], dx = b.x - a.x, dz = b.y - a.y;
  const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.y) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(x - a.x - dx * t, z - a.y - dz * t);
}));
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
  const input = { gust: 0, charge: 0 };
  const c = new WoodChapter({ child, cygnet, boat, embers, carry, plane, wind: calm, input });
  c.update(0, 0); rig.cut(c.shot);
  const resumed = new Set();
  // Desktop circles the side coal once it is shown the updraft; portrait leaves her in the dark a long while first.
  const stall = portrait ? 40 : tuning.wood.inviteAfter + 1.5;
  let sawSideInvite = false, sawThrowInvite = false, hoots = 0, owlLeft = false, revealedAt = -1, owlFrom = null, owlLow = Infinity, owlTop = -Infinity, owlClear = Infinity, owlWas = -Infinity, owlNearer = 0;
  let thrownSeen = false, darkBefore = false;
  let last = '', complete = false, worstWaitFrame = 0, worst = null, waited = 0, previousTarget = null;
  let birdBefore = null, worstBirdStep = 0, wetPaper = null, worstEscapeFrame = 0;
  const seen = new Set();
  let scrambleCount = 0, sawCoax = false, coaxShown = 0, coaxYielded = 0; takeCues();
  let rescueLight = null, rescueAt = 0;
  let approachClearance = Infinity;
  let previousEye = null, firstLightCameraStep = 0;
  let previousRotation = null, worstWalkTurn = 0;
  let exitOffPath = 0;
  for (let frame = 1; frame <= 30 * 400; frame++) {
    const dt = 1 / 30, time = frame * dt;
    const target = c.updraftTarget ?? c.windInvitation;
    waited = target === previousTarget ? waited + dt : 0; previousTarget = target;
    assert(!c.updraftTarget || !c.windInvitation, 'a coal never asks for a sweep');
    // At the stump the player stalls before circling: long enough to be shown the updraft, or far longer.
    const stalled = c.beat !== 'loom' || (c.shapeStopped >= 0 && time - Math.max(c.shapeStopped, c.throwLitAt) > stall);
    for (const coal of embers.coals) coal.breath = coal.p === target && c.t > 6 && stalled ? 1 : 0;
    c.brushDry(c.t > 6 && c.beat === 'snag' ? 1 : 0);
    if (c.beat === 'loom') {
      const throwLit = c.throwCoal.lit, sideLit = !!c.sideCoal?.lit;
      if (!sideLit) assert.equal(c.shapeReveal, 0, 'darkness never shows the stump for what it is, however long she waits');
      if (!sideLit) assert.equal(woodOwl.phase, 'perched', 'the owl keeps still until the side light shows it');
      if (!throwLit) assert.equal(c.sideCoal, null, 'one waiting coal at a time: the side coal comes after the coal before the bend');
      // Until the coal before the bend catches there is no outline and no light on the rock; once it burns, both are its.
      if (!throwLit) {
        assert.equal(shapeUniforms.uShapeMask.value.x, 0, 'no outline before the coal before the bend is lit');
        assert.equal(shapeUniforms.uShapeThrow.value.w, 0, 'no light on the rock before the coal before the bend is lit');
        darkBefore = true;
      }
      if (throwLit && c.throwLitAt >= 0 && time - c.throwLitAt > 0.5 && (c.sideCoal?.wake ?? 0) === 0 && c.fold < 1e-3) {
        const u = shapeUniforms.uShapeThrow.value;
        assert(u.w > 0.2 && shapeUniforms.uShapeMask.value.x > 0.99, 'the lit coal before the bend throws the outline up the rock');
        assert(Math.hypot(u.x - c.throwCoal.p.x, u.z - c.throwCoal.p.z) < 1e-3, 'the outline is thrown from the coal before the bend, nowhere else');
        // Cast away from her coal: the outline stands beyond the stump as seen from the coal.
        const eyes = beastEyes(), sx = WOOD_SHAPE.x - c.throwCoal.p.x, sz = WOOD_SHAPE.z - c.throwCoal.p.z;
        assert((eyes.x - WOOD_SHAPE.x) * sx + (eyes.z - WOOD_SHAPE.z) * sz > 0, 'the outline falls on the far side of the stump from her coal');
        thrownSeen = true;
      }
      // Her coal waits on the path well short of the stump; the one coal near the stump is the side coal.
      assert(Math.hypot(c.throwCoal.p.x - WOOD_SHAPE.x, c.throwCoal.p.z - WOOD_SHAPE.z) > 6.5, 'the coal before the bend stays well short of the stump');
      const byStump = embers.coals.filter((k) => k.live && Math.hypot(k.p.x - WOOD_SHAPE.x, k.p.z - WOOD_SHAPE.z) < 4);
      assert(byStump.length <= 1 && byStump.every((k) => k === c.sideCoal), 'exactly one coal by the stump, and it is the side coal');
      // Nothing but the side coal's light shows the stump and the owl.
      if (!c.sideCoal || c.sideCoal.wake === 0) { assert.equal(shapeUniforms.uShapeShown.value, 0); assert.equal(woodOwl.shown, 0); }
      if (c.shapeStopped >= 0) assert(Math.hypot(child.position.x - SHAPE_WAIT.x, child.position.z - SHAPE_WAIT.z) < 1.2,
        'where she waits by the coal before the bend is where she stops, and she will not go nearer');
      const ask = c.coax;
      if (ask) {
        const waiting = throwLit ? c.sideCoal : c.throwCoal;
        assert(Math.hypot(ask.at.x - waiting.p.x, ask.at.z - waiting.p.z) < 1e-6, 'the one waiting coal at the bend is the one that asks');
        assert(time - Math.max(c.shapeStopped, c.throwLitAt) >= tuning.wood.inviteAfter - 1e-6, 'the usual idle wait comes before the invitation');
        if (throwLit) sawSideInvite = true; else sawThrowInvite = true;
      }
    }
    if (c.beat === 'brave' && revealedAt < 0) {
      revealedAt = time;
      assert(c.sideCoal.lit, 'only the side coal reveals the owl');
      assert(c.fold > 0.5, 'once the side coal burns, the outline has folded into the plain shadow');
    }
    // It leaves up and out the open side, away from the rock, clear of every trunk while it can still be seen.
    if (woodOwl.phase === 'leaving' && woodOwl.presence > 0.02) {
      const o = woodOwl.position;
      owlFrom ??= o.clone();
      owlLow = Math.min(owlLow, o.y - owlFrom.y);
      owlTop = Math.max(owlTop, o.y - owlFrom.y);
      assert(WoodShape.clears(o.x, o.z), `the owl flies only where no tree stands: ${o.toArray()}`);
      assert(!WoodShape.onRock(o.x, o.z, 1), `the owl never flies into the rock: ${o.toArray()}`);
      assert((o.x - WOOD_SHAPE.x) * SHAPE_FACING.x + (o.z - WOOD_SHAPE.z) * SHAPE_FACING.z > -0.3, 'the owl goes out the open side, never back into the rock');
      if (woodOwl.flightSeconds > 0) {
        const off = offLimbs();
        owlNearer = Math.max(owlNearer, owlWas - off);
        owlWas = off;
        if (woodOwl.flightSeconds >= 0.5) owlClear = Math.min(owlClear, off);
      }
    }
    if (woodOwl.phase === 'leaving' || woodOwl.phase === 'gone') owlLeft = true;
    const litBefore = c.beat === 'walk' ? embers.coals.filter(k=>k.live&&k.lit).sort((a,b)=>b.laid-a.laid)[0] : null;
    const lightPlace = litBefore?.p.clone();
    c.update(dt, time); boat.update(dt, time); child.update(dt); plane.update(dt, time); carry.update(dt);
    if (!c.bolted) approachClearance = Math.min(approachClearance,
      Math.hypot(child.position.x-WOOD_APPROACH_LIGHT.x,child.position.z-WOOD_APPROACH_LIGHT.y));
    if (litBefore && c.beat === 'compose') { rescueLight = {coal:litBefore,place:lightPlace}; rescueAt = time; }
    cygnet.update(dt, time, child.position, calm.sample(0, 0, {})); carry.after();
    embers.update(dt, child.position, c.embers); rig.update(dt, time, c.shot, c.pace); c.afterCamera(rig.camera);
    if (previousRotation && ['walk', 'out'].includes(c.beat))
      { const turn = previousRotation.angleTo(rig.camera.quaternion); if (process.env.DEBUG && turn > 0.02) console.log("turn", time.toFixed(2), c.beat, turn.toFixed(4), c.releaseAt); worstWalkTurn = Math.max(worstWalkTurn, turn); }
    previousRotation = rig.camera.quaternion.clone();
    if(previousEye&&c.beat==='walk'&&c.leg===0) firstLightCameraStep=Math.max(firstLightCameraStep,rig.camera.position.distanceTo(previousEye));
    previousEye=rig.camera.position.clone();
    const cues = takeCues();
    assert(!cues.includes('restored'), 'the reunion must not play the level-complete cue');
    hoots += cues.filter(k => k === 'hoot').length;
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
    if (rescueLight && time-rescueAt<18) {
      assert(rescueLight.coal.live&&rescueLight.coal.lit&&rescueLight.coal.reveal===1,'thunder must preserve the earned light');
      assert(rescueLight.coal.p.equals(rescueLight.place),'earned light must never be moved during the sequence');
    }
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
      assert.equal(c.ahead,c.planeCoal,'tree arrival must reuse the final path ember');
      assert.equal(embers.coals.filter(k=>k.live&&Math.hypot(k.p.x+37,k.p.z+1848)<15).length,1,'one ember in the plane clearing');
      wetPaper ??= plane.position.clone();
      assert(plane.position.distanceTo(wetPaper) < 0.3, 'the caught paper may sway with its branch but cannot drift away');
      assert(!plane.landed, 'a caught plane cannot be picked up from the ground');
    }
    if (c.beat === 'snag' && c.t < 5) assert.equal(c.planeWork, 0, 'idle wind cannot free the plane');
    assert.notEqual(c.beat, 'dry', 'retrieval must not add a drying puzzle');
    if (c.beat === 'out') {
      assert(plane.held, 'retrieved plane stays safely held');
      assert.notEqual(c.windInvitation, plane.position, 'held paper must never ask for wind');
      assert.equal(c.ahead, null, 'the fire by the tree is the last ember');
      assert.equal(c.updraftTarget, null, 'leaving the wood never asks for another ember');
      assert.equal(c.windInvitation, null, 'leaving the wood never asks for wind');
      embers.clearCoals();
    }
    if (['out', 'toBoat'].includes(c.beat)) exitOffPath = Math.max(exitOffPath, offPath(child.position.x, child.position.z));
    if (c.beat !== last) { console.log(`${portrait ? 'portrait' : 'desktop'} route: ${c.beat} at ${time.toFixed(1)}s`); last = c.beat; }
    if (target && target === c.updraftTarget && c.beat !== 'loom' && c.beat !== 'brave') {
      const coax = c.coax;
      if (waited > tuning.wood.inviteAfter + 0.1 && c.t <= 6) {
        assert(coax && Math.hypot(coax.at.x - target.x, coax.at.z - target.z) < 1e-6, 'the waiting coal shows the updraft over it');
        coaxShown++;
      }
      if (c.t > 6 && waited > 6.2) { assert.equal(coax, null, 'the updraft invitation gives way while the coal is worked'); coaxYielded++; }
    }
    if (target && target === (c.updraftTarget ?? c.windInvitation) && !child.moving && waited > 5) {
      const p = target.clone().project(rig.camera);
      if (Math.max(Math.abs(p.x), Math.abs(p.y)) > worstWaitFrame) { worstWaitFrame = Math.max(Math.abs(p.x), Math.abs(p.y)); worst = { beat: c.beat, time, target: target.toArray(), child: child.position.toArray(), projected: p.toArray() }; }
    }
    if (portrait && c.checkpoint && !resumed.has(c.checkpoint) && !child.busy && !carry.busy) {
      const point = c.checkpoint, data = c.saveCheckpoint(), along = c.chainAt;
      assert.equal(data.length, 2, 'keep the existing save schema valid');
      c.restoreCheckpoint(point, data); resumed.add(point);
      assert.equal(c.chainAt, along, 'resume must not skip the waiting ember');
      if (point === 'dry') assert.equal(c.ahead, null, 'resuming the walk out adds no ember');
      else assert.equal(c.ahead.lit, false, 'resume must not solve the waiting ember');
      assert.equal(embers.takeCaught().length, 0, 'restored light must not emit another progress event');
    }
    if (c.done) { complete = true; break; }
  }
  assert(complete, `route must complete: ${c.beat}, leg ${c.leg}, child ${child.position.toArray()}`);
  assert(revealedAt > 0 && owlLeft && hoots === 1, `the owl is shown, hoots once and leaves: ${revealedAt}, ${owlLeft}, ${hoots}`);
  assert(sawThrowInvite && sawSideInvite, 'each coal at the bend shows its updraft after the idle wait, the coal before the bend first');
  assert(darkBefore && thrownSeen, 'only eyes before the coal before the bend; its light, and only its light, throws the outline');
  assert(owlLow > -0.15 && owlTop > 8, `the owl never drops from the fork and goes up out of the wood: lowest ${owlLow.toFixed(2)}, highest ${owlTop.toFixed(2)}`);
  assert(owlNearer < 0.01 && owlClear > 0.3, `off the fork, the owl flies out from between the limbs, never toward one: ${owlNearer.toFixed(3)}, ${owlClear.toFixed(2)}`);
  console.log(`${portrait ? 'portrait' : 'desktop'}: dark for ${stall.toFixed(1)}s without a reveal; the coal before the bend throws the outline; the side coal shows the owl at ${revealedAt.toFixed(1)}s, one hoot, and up and away (${owlTop.toFixed(1)} up, ${owlClear.toFixed(2)} clear of the limbs)`);
  assert(exitOffPath < 3.5, `the walk out must stay clear of the trunks: ${exitOffPath.toFixed(2)} off the path`);
  assert(worstWaitFrame < 0.95, `waiting target must remain in frame: ${JSON.stringify(worst)}`);
  assert.equal(scrambleCount, 1, 'one audible feather scramble per escape');
  assert(sawCoax, 'the child must coax the cygnet out before lifting it');
  assert(coaxShown > 0 && coaxYielded > 0, `updraft invitation shown ${coaxShown}, yielded ${coaxYielded} frames`);
  assert(rescueLight, 'the route must enter the rescue from an earned approach light');
  assert(approachClearance>2.4, `child walked through the approach ember: ${approachClearance}`);
  console.log(`Approach ember clearance: ${approachClearance.toFixed(2)} units`);
  assert(firstLightCameraStep<0.6,`first ignition jumped the camera: ${firstLightCameraStep}`);
  console.log(`First-ember camera step: ${firstLightCameraStep.toFixed(3)} units at 30fps`);
  console.log(`Walking camera maximum turn: ${(worstWalkTurn * 30 * 180 / Math.PI).toFixed(1)} degrees/second`);
  assert(worstWalkTurn < .025, `walking camera whips after a staged scene: ${worstWalkTurn}`);
  assert(seen.has('snag') && seen.has('fall') && seen.has('pickup'), 'free the plane from the tree before collecting it');
  assert(plane.soggy.value <= 0.02);
  assert(seen.has('fright') && seen.has('bolt') && seen.has('lost'), 'thunder fright, continuous jump and rescue must all play');
  assert(worstEscapeFrame < 0.95, `escape left the frame: ${worstEscapeFrame}`);
  assert(worstBirdStep < 0.35, `bird teleported during separation: ${worstBirdStep} units in one frame`);
  assert.deepEqual([...resumed], portrait ? ['found', 'dry'] : []);
  console.log(`${portrait ? 'portrait' : 'desktop'} full route, continuous separation (${worstBirdStep.toFixed(3)} max step), wet plane in full wind, boarding and framing passed`);
}

// Wherever she stops for an unlit coal, the coal stays beside her on screen, never behind her: the centre of its orb
// keeps more than the orb's heart (0.3 units) clear of her posed mesh, projected through the real camera rig, from the
// moment she stops until it catches. The player here takes eight seconds to circle it, so the shot has fully settled.
const heart = 0.3, vertex = new THREE.Vector3(), probe = new THREE.Vector3();
function clearOfChild(meshes, camera, w, h, px, py) {
  let best = Infinity;
  const inside = (ax, ay, bx, by, cx, cy) => {
    const d1 = (px - bx) * (ay - by) - (ax - bx) * (py - by), d2 = (px - cx) * (by - cy) - (bx - cx) * (py - cy);
    const d3 = (px - ax) * (cy - ay) - (cx - ax) * (py - ay);
    return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
  };
  const edge = (x0, y0, x1, y1) => {
    const dx = x1 - x0, dy = y1 - y0, t = Math.max(0, Math.min(1, ((px - x0) * dx + (py - y0) * dy) / (dx * dx + dy * dy || 1)));
    return Math.hypot(px - x0 - dx * t, py - y0 - dy * t);
  };
  for (const mesh of meshes) {
    const n = mesh.geometry.attributes.position.count, sx = new Float32Array(n), sy = new Float32Array(n), index = mesh.geometry.index;
    for (let i = 0; i < n; i++) {
      mesh.getVertexPosition(i, vertex).applyMatrix4(mesh.matrixWorld).project(camera);
      sx[i] = (vertex.x + 1) * w / 2; sy[i] = (1 - vertex.y) * h / 2;
    }
    for (let i = 0; i < (index ? index.count : n); i += 3) {
      const a = index ? index.getX(i) : i, b = index ? index.getX(i + 1) : i + 1, c = index ? index.getX(i + 2) : i + 2;
      if (px < Math.min(sx[a], sx[b], sx[c]) - best || px > Math.max(sx[a], sx[b], sx[c]) + best
        || py < Math.min(sy[a], sy[b], sy[c]) - best || py > Math.max(sy[a], sy[b], sy[c]) + best) continue;
      if (inside(sx[a], sy[a], sx[b], sy[b], sx[c], sy[c])) return 0;
      best = Math.min(best, edge(sx[a], sy[a], sx[b], sy[b]), edge(sx[b], sy[b], sx[c], sy[c]), edge(sx[c], sy[c], sx[a], sy[a]));
    }
  }
  return best;
}
for (const [w, h] of [[1600, 900], [390, 844]]) for (const fps of [30, 60, 120]) {
  const child = new Traveller(calm), cygnet = new Cygnet(), boat = new Boat(calm), embers = new Embers(calm);
  const carry = new Carry(child, cygnet), rig = new CameraRig();
  rig.resize(w, h);
  child.place(-26, -1688, Math.PI); cygnet.mount = child; cygnet.rideIn('satchel');
  const plane = new Glider(planeWind, []);
  const c = new WoodChapter({ child, cygnet, boat, embers, carry, plane, wind: calm, input: { gust: 0, charge: 0 } });
  c.update(0, 0); rig.cut(c.shot);
  const meshes = [];
  for (const o of child.objects) if (o !== child.shadow) o.traverse(m => { if (m.isMesh) meshes.push(m); });
  const dt = 1 / fps, every = Math.max(1, Math.round(fps / 10)), stops = [];
  let still = 0, stop = null;
  for (let frame = 1; frame <= fps * 300 && c.beat !== 'snag'; frame++) {
    const time = frame * dt, waiting = c.updraftTarget;
    still = waiting && !child.moving ? still + dt : 0;
    for (const coal of embers.coals) coal.breath = coal.p === waiting && (still > 8 || c.beat === 'lost' && c.t > 6) ? 1 : 0;
    c.update(dt, time); boat.update(dt, time); child.update(dt); plane.update(dt, time); carry.update(dt);
    cygnet.update(dt, time, child.position, calm.sample(0, 0, {})); carry.after();
    embers.update(dt, child.position, c.embers);
    rig.update(dt, time, c.shot, c.pace, !!(c.scripted || c.windInvitation || c.updraftTarget)); c.afterCamera(rig.camera);
    const coal = c.updraftTarget;
    if (!coal || child.moving || still === 0) continue;
    if (stop?.coal !== coal || stop.at !== coal.x + coal.z) stops.push(stop = { coal, at: coal.x + coal.z, beat: c.beat, time, worst: Infinity });
    if (frame % every) continue;
    rig.camera.updateMatrixWorld();
    for (const o of child.objects) o.updateMatrixWorld(true);
    const p = probe.copy(coal).project(rig.camera), px = (p.x + 1) * w / 2, py = (1 - p.y) * h / 2;
    const rim = vertex.copy(coal).addScaledVector(probe.setFromMatrixColumn(rig.camera.matrixWorld, 1), heart).project(rig.camera);
    const core = Math.hypot((rim.x + 1) * w / 2 - px, (1 - rim.y) * h / 2 - py);
    const margin = clearOfChild(meshes, rig.camera, w, h, px, py) - core;
    if (margin < stop.worst) Object.assign(stop, { worst: margin, still, screen: [Math.round(px), Math.round(py)] });
  }
  if (process.env.STOPS) console.log(`${w}x${h} ${fps}fps stops: ${stops.map(s => `${s.beat}@${s.time.toFixed(0)}s ${s.worst.toFixed(1)}@${s.still?.toFixed(1)}s`).join(', ')}`);
  assert(stops.length >= 8, `${w}x${h} ${fps}fps: the chain must stop her at every coal, saw ${stops.length}`);
  for (const [i, s] of stops.entries())
    assert(s.worst > 0, `${w}x${h} ${fps}fps: stop ${i} (${s.beat}, ${s.time.toFixed(1)}s) hides the waiting ember behind the child: ${s.worst.toFixed(1)} px at ${s.still.toFixed(1)}s ${JSON.stringify(s.screen)}`);
  console.log(`${w}x${h} ${fps}fps: the waiting ember stays clear of the child at all ${stops.length} stops, by at least ${Math.min(...stops.map(s => s.worst)).toFixed(1)} px beyond its orb`);
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
