// Real chapter, actors and fleet without a renderer. Usage: node tools/little-boats-logic-check.mjs
// Checks idle/local wind, 30/60fps completion, dry-bank walking, checkpoint restore, sailing routes and the way
// out to sea (the bath poured by the player's push, the plug lifted by the player's updraft).
import './lib/typescript.mjs';
import assert from 'node:assert/strict';
import * as THREE from 'three';

globalThis.document = {
  createElement: () => ({ getContext: () => ({ beginPath() {}, moveTo() {}, quadraticCurveTo() {}, stroke() {} }) }),
};
globalThis.location = { search: '?shot' };
globalThis.window = { matchMedia: () => ({ matches: false }) };
const { tuning } = await import('../src/tuning.ts');
const { Boat } = await import('../src/traveller/boat.ts');
const { Glider, PAPER_GRIP } = await import('../src/glider/glider.ts');
const { Traveller, PAPER_STOW } = await import('../src/traveller/traveller.ts');
const { Cygnet } = await import('../src/creatures/cygnet.ts');
const { Carry } = await import('../src/companion/carry.ts');
const { CameraRig } = await import('../src/camera.ts');
const { LittleBoats } = await import('../src/world/little-boats.ts');
const { LittleBoatsChapter } = await import('../src/story/little-boats.ts');
const { worldHeight } = await import('../src/world/heightfield.ts');
const {
  BOATS_LANDING,
  BOATS_BERTH,
  LITTLE_BOATS: L,
  boatsLevel,
  boatsOut,
  boatsX,
  boatsWaterBase,
  boatsWaterHeight,
} = await import('../src/world/little-boats-layout.ts');
const { ROUTES } = await import('../src/story/journey.ts');
const { MeadowChapter } = await import('../src/story/meadow.ts');
const { Feather } = await import('../src/fx/feather.ts');
const { CrossingChapter } = await import('../src/story/crossing.ts');
const { LINES_BERTH } = await import('../src/story/lines.ts');
const eye = new THREE.PerspectiveCamera(50, 16 / 9, 0.1, 500);
const hand = {
  present: true, muted: false, gust: 12, charge: 0,
  gustDir: new THREE.Vector2(1, 0), ndc: new THREE.Vector2(), prevNdc: new THREE.Vector2(), updraftAt: new THREE.Vector3(),
};
function look(at) {
  eye.position.copy(at).add(new THREE.Vector3(0, 8, 14));
  eye.lookAt(at);
  eye.updateMatrixWorld();
}
/** A stroke across `at` on screen, `angle` radians anticlockwise from the right. */
function strokeAcross(room, at, angle, dt) {
  look(at);
  const c = at.clone().project(eye), dx = Math.cos(angle) / eye.aspect * 0.01, dy = Math.sin(angle) * 0.01;
  hand.prevNdc.set(c.x - dx, c.y - dy);
  hand.ndc.set(c.x + dx, c.y + dy);
  room.drain.brush(eye, hand, room.toys[0].s, dt);
}
function circleOver(room, at, dt) {
  hand.charge = 1;
  hand.updraftAt.copy(at);
  room.drain.updraft(hand, room.toys[0].s, dt);
  hand.charge = 0;
}
/** The player's part at the shoal and the plug: a push across the bath toward the stream, then circles over the plug. */
function helpOut(room, dt) {
  const d = room.drain, waiting = d.waiting(room.toys[0].s);
  if (waiting === d.bathAt) {
    look(d.bathAt);
    d.aim(eye);
    strokeAcross(room, d.bathAt, d.pushAngle, dt);
  } else if (waiting === d.plugAt) circleOver(room, d.plugRest, dt);
}
function fixture(fps = 60, portrait = false) {
  window.innerWidth = portrait ? 390 : 1600;
  window.innerHeight = portrait ? 844 : 900;
  const room = new LittleBoats();
  const wind = {
    breeze: new THREE.Vector2(1.2, -0.4),
    calm: 1.5,
    push: 0,
    remote: false,
    addSplat() {},
    sample(x, z, out) {
      const local = Math.hypot(x - room.focus.x, z - room.focus.z) < 7;
      return Object.assign(out, { x: 1.2, z: -0.4, energy: this.push && local && !this.remote ? 0.5 : 0, lift: 0 });
    },
  };
  const child = new Traveller(wind),
    boat = new Boat(wind),
    cygnet = new Cygnet();
  cygnet.mount = child;
  const carry = new Carry(child, cygnet),
    rig = new CameraRig();
  rig.resize(portrait ? 390 : 1600, portrait ? 844 : 900);
  const plane = new Glider(wind, []);
  boat.beach(BOATS_LANDING.x, BOATS_LANDING.z, Math.PI);
  boat.grounded = true;
  child.place(BOATS_LANDING.x - 1, BOATS_LANDING.z - 4, Math.PI);
  cygnet.visible = true;
  cygnet.rideIn('cradle');
  const cast = {
    child,
    boat,
    cygnet,
    carry,
    plane,
    wind,
    littleBoats: room,
    lines: { gusts: 0, gust() { this.gusts++; } },
    sealife: { fishNear() {}, dolphinsWith() {}, whale: null, dolphinShow: null },
  };
  const chapter = new LittleBoatsChapter(cast);
  rig.cut(chapter.shot);
  let time = 0;
  const air = {};
  return {
    cast,
    chapter,
    room,
    rig,
    player: false,
    step() {
      const dt = 1 / fps;
      time += dt;
      if (chapter.beat === 'sailing') {
        room.drain.breeze(wind, room.toys[0].s, dt);
        if (this.player) helpOut(room, dt);
      }
      chapter.update(dt, time);
      boat.update(dt, time);
      child.update(dt);
      plane.update(dt, time);
      carry.update(dt);
      room.afterChildPose(child);
      cygnet.update(dt, time, child.position, wind.sample(cygnet.position.x, cygnet.position.z, air));
      rig.update(dt, time, chapter.shot, chapter.pace);
      if (!chapter.done) {
        assert(plane.group.visible && plane.held, 'paper stays visible and secured throughout the boats chapter');
        const grip = PAPER_GRIP.clone().applyMatrix4(plane.body.matrixWorld);
        const backpack = child.fromBody(PAPER_STOW.clone(), new THREE.Vector3());
        assert(grip.distanceTo(backpack) < 0.001, `paper left backpack: ${grip.distanceTo(backpack)}`);
      }
    },
    get time() {
      return time;
    },
  };
}
const report = [];
// Steady wind must not feel like a fresh launch at each pool handoff. Exercise the
// real walkers and all three swims, since a fixed room limit misses these stops.
for (const fps of [30, 60, 120]) {
  for (const restored of [null, 33, 69]) {
    const f = fixture(fps);
    if (restored !== null) f.chapter.restoreCheckpoint(restored === 33 ? 'pool-1' : 'pool-2', [restored]);
    f.cast.wind.push = 1;
    f.player = true;
    let minSpeed = Infinity, maxDeceleration = 0;
    for (let frame = 0; frame < fps * 180 && !f.chapter.done; frame++) {
      const previousSpeed = f.room.toys[0].speed, sailing = f.chapter.beat === 'sailing';
      f.step();
      // The toy reaching the outlet often ends sailing, so that frame counts too.
      if (!sailing || f.room.progress < (restored ?? 3) + 3) continue;
      const speed = f.room.toys[0].speed;
      minSpeed = Math.min(minSpeed, speed);
      maxDeceleration = Math.max(maxDeceleration, (previousSpeed - speed) * fps);
    }
    const label = `${fps}fps from ${restored ?? 'arrival'}`;
    assert(f.chapter.done, `${label}: steady wind and the player's bath and plug complete all pool handoffs`);
    assert.equal(f.cast.cygnet.swims, restored === 69 ? 1 : restored === 33 ? 2 : 3, 'preserve remaining swims');
    assert(minSpeed > 0.05, `${label}: orange boat stopped despite steady wind: ${minSpeed}`);
    assert(maxDeceleration < 3, `${label}: orange boat lost momentum abruptly: ${maxDeceleration}`);
    report.push({ test: 'pool-handoff momentum', fps, restored, minSpeed, maxDeceleration });
  }
}
for (const [fps, portrait] of [
  [60, false],
  [30, true],
]) {
  const f = fixture(fps, portrait);
  const { cast: c, chapter: q, room: r } = f;
  const beats = [];
  let last = '',
    worstFrame = null,
    maxEdge = 0,
    minDry = Infinity,
    swimFrames = 0,
    sailingFrames = 0,
    fastestSwim = 0,
    biggestFlap = 0;
  let biggestToyStep = 0,
    gripGap = 0,
    pickupGap = 0,
    lifted = 0;
  const previousToy = r.focus.clone();
  for (let i = 0; i < fps * 60 && q.beat !== 'sailing'; i++) {
    f.step();
    biggestToyStep = Math.max(biggestToyStep, previousToy.distanceTo(r.focus));
    previousToy.copy(r.focus);
    if (!r.held && !r.released) assert(r.focus.equals(r.stranded), 'boat stays visible on the bank until picked up');
    if (q.beat === 'pickup' && q.elapsed > 2.3) {
      for (const hand of [0, 1])
        pickupGap = Math.max(
          pickupGap,
          c.child
            .mitten(hand, new THREE.Vector3())
            .distanceTo(r.stranded.clone().add(new THREE.Vector3(0.3, 0.18, hand ? -0.22 : 0.22))),
        );
    }
    if (r.held) {
      lifted = Math.max(lifted, r.focus.y - r.stranded.y);
      for (const hand of [0, 1])
        gripGap = Math.max(
          gripGap,
          c.child
            .mitten(hand, new THREE.Vector3())
            .distanceTo(r.focus.clone().add(new THREE.Vector3(0.3, 0.18, hand ? -0.22 : 0.22))),
        );
    }
  }
  assert(pickupGap < 0.07, `mittens must reach the stranded hull before pickup: ${pickupGap}`);
  assert(gripGap < 0.07, `held boat must stay in both mittens: ${gripGap}`);
  assert(biggestToyStep < 4.5 / fps, `boat jumped during pickup/release: ${biggestToyStep}`);
  assert(lifted > 0.75, `child visibly lifts the same stranded boat from the bank before launching: ${lifted}`);
  assert.equal(q.beat, 'sailing', 'arrival and set-down reach interactive play');
  const idle = r.progress;
  for (let i = 0; i < fps * 15; i++) f.step();
  assert.equal(r.progress, idle, 'ambient wind must not sail the fleet');
  c.wind.push = 1;
  c.wind.remote = true;
  for (let i = 0; i < fps * 5; i++) f.step();
  assert.equal(r.progress, idle, 'remote wind must not sail the fleet');
  c.wind.remote = false;
  f.player = true;
  for (let i = 0; i < fps * 210 && !q.done; i++) {
    c.wind.push = i % (fps * 7) < fps * 5 ? 1 : 0;
    f.step();
    if (q.beat !== last) {
      beats.push([q.beat, +f.time.toFixed(1)]);
      last = q.beat;
    }
    if (q.beat === 'sailing') {
      sailingFrames++;
      for (const p of [c.child.position, c.cygnet.position]) {
        if (p === c.child.position || (c.cygnet.state !== 'swimming' && !c.cygnet.seating.move))
          minDry = Math.min(minDry, worldHeight(p.x, p.z) - boatsWaterBase(p.x, p.z));
        if (p === c.cygnet.position && c.cygnet.state === 'swimming' && !c.cygnet.seating.move) {
          swimFrames++;
          fastestSwim = Math.max(fastestSwim, c.cygnet.swimSpeed);
          biggestFlap = Math.max(biggestFlap, c.cygnet.flap);
          assert(
            boatsOut(p.x, p.z) < 1,
            `swimmer left water: ${boatsOut(p.x, p.z)}, s=${L.startZ - p.z}, phase=${q.swim}, pool=${q.pool}`,
          );
          assert(Math.abs(p.y - boatsWaterBase(p.x, p.z)) < 0.3, 'swimmer follows pool surface');
        }
        const at = p
          .clone()
          .add(new THREE.Vector3(0, 1, 0))
          .project(f.rig.camera);
        const edge = Math.max(Math.abs(at.x), Math.abs(at.y));
        if (edge > maxEdge)
          worstFrame = { s: r.progress, actor: p === c.child.position ? 'child' : 'cygnet', phase: q.swim, at: at.toArray() };
        maxEdge = Math.max(maxEdge, edge);
      }
      assert(boatsOut(r.focus.x, r.focus.z) < 1, 'leading toy remains in the stream');
    }
  }
  assert(
    q.done,
    `chapter stalled: ${q.beat}, s=${r.progress}, child=${c.child.position.toArray()}, bird=${c.cygnet.position.toArray()}, state=${c.cygnet.state}, phase=${q.swim}, pool=${q.pool}, entry=${q.swimEntry}, birdAim=${q.swimAim.toArray()}, seating=${JSON.stringify(c.cygnet.seating.move)}, bank=${q.birdBank.toArray()}`,
  );
  assert.equal(c.cygnet.swims, 3, 'paddles in all three pools');
  // Steadier sailing shortens the room, so the swims are measured as a share of it.
  assert(swimFrames > fps * 29.5 && swimFrames > sailingFrames * 0.6, `sustained swims alongside toys: ${swimFrames / fps}s of ${sailingFrames / fps}s`);
  assert(fastestSwim > 2.45 && biggestFlap > 0.45, 'playful swim includes faster paddles and wing flicks');
  assert(minDry > 0.01, `characters entered a pool: ${minDry}`);
  assert(maxEdge < 0.93, `characters left safe frame: ${maxEdge}, ${JSON.stringify(worstFrame)}`);
  report.push({
    fps,
    portrait,
    seconds: f.time,
    minDry,
    maxEdge,
    swimFrames,
    sailingFrames,
    fastestSwim,
    biggestFlap,
    biggestToyStep,
    pickupGap,
    gripGap,
    lifted,
    beats,
  });
}
for (const [point, s] of [
  ['pool-1', 33],
  ['pool-2', 69],
]) {
  const f = fixture();
  f.chapter.restoreCheckpoint(point, [s]);
  assert.equal(f.chapter.beat, 'sailing');
  assert.equal(f.room.progress, s);
  assert.equal(f.cast.boat.position.z, BOATS_BERTH.z);
  for (let i = 0; i < 120; i++) f.step();
  assert.equal(f.room.progress, s, 'restored fleet waits for input');
}
for (const [name, from] of [
  ['toBoats', LINES_BERTH],
  ['toMeadow', BOATS_BERTH],
]) {
  const f = fixture(),
    c = f.cast;
  c.boat.beach(from.x, from.z, Math.PI);
  c.boat.launch();
  c.cygnet.rideIn('cradle');
  const q = new CrossingChapter(c, { route: ROUTES[name], haze: 1, arrivalSpeed: name === 'toMeadow' ? tuning.sail.meadowArrivalSpeed : undefined });
  let seconds = 0;
  for (; seconds < 240 && !q.done; seconds += 1 / 60) {
    q.update(1 / 60, seconds);
    c.boat.update(1 / 60, seconds);
  }
  assert(q.done, `${name} never landed: ${c.boat.position.toArray()}`);
  report.push({ route: name, seconds, landed: c.boat.position.toArray() });
  if (name === 'toMeadow') {
    assert(Math.abs(c.boat.position.x - 10) < 12, 'land beside the meadow hill path');
    c.life = { at: () => 1, regions: { wave: new THREE.Vector4(), waiting: new THREE.Vector4() } };
    c.flock = { rest() {}, active: false };
    c.swanFeather = new Feather(c.wind);
    const meadow = new MeadowChapter(c);
    let walk = 0;
    for (; walk < 15 && meadow.beat !== 'climb'; walk += 1 / 60) {
      meadow.update(1 / 60, seconds + walk);
      c.child.update(1 / 60);
      c.carry.update(1 / 60);
      c.cygnet.update(1 / 60, seconds + walk, c.child.position, { x: 1, z: 0, energy: 0, lift: 0 });
      c.plane.update(1 / 60, seconds + walk);
    }
    assert.equal(meadow.beat, 'climb', 'meadow arrival reaches the climb without a long shore walk');
    assert(walk < 12, `shore walk and pause took ${walk}s`);
    report.push({ route: 'meadow-walk-to-hill', seconds: walk, child: c.child.position.toArray() });
  }
  if (name === 'toBoats') {
    const arrival = new LittleBoatsChapter(c);
    for (let i = 0; i < 60 * 50 && arrival.beat !== 'sailing'; i++) {
      arrival.update(1 / 60, seconds + i / 60);
      c.child.update(1 / 60);
      c.carry.update(1 / 60);
      c.littleBoats.afterChildPose(c.child);
      c.cygnet.update(1 / 60, seconds + i / 60, c.child.position, { x: 1, z: 0, energy: 0, lift: 0 });
      const p = c.child.position;
      if (boatsOut(p.x, p.z) < 1) assert(worldHeight(p.x, p.z) > boatsLevel(L.startZ - p.z), 'arrival cut across the first pool');
    }
    assert.equal(arrival.beat, 'sailing', 'actual crossing arrival reaches toy launch');
  }
}
console.log(JSON.stringify(report, null, 2));

// The outlet has continuous water above its bed, with no final sandy wall closing the stream.
for (let s = 98; s <= 122; s += 0.25) {
  const x = boatsX(Math.min(s, 107)),
    z = L.startZ - s;
  assert(worldHeight(x, z) < boatsWaterBase(x, z) - 0.05, `blocked stream outlet at ${s}`);
}
const toyTest = fixture();
toyTest.chapter.restoreCheckpoint('pool-1', [40]);
const toy = toyTest.room.toys[0];
for (let i = 0; i < 180; i++) toyTest.step();
assert(toy.sail.uniforms.uDroop.value > 0.95, 'idle cloth hangs in folds');
toyTest.cast.wind.push = 1;
let luff = 0,
  roll = 0;
for (let i = 0; i < 90; i++) {
  toyTest.step();
  luff = Math.max(luff, toy.sail.uniforms.uLuff.value);
  roll = Math.max(roll, Math.abs(toy.roll));
  const p = toy.group.position;
  assert(Math.abs(p.y - boatsWaterHeight(p.x, p.z, toyTest.time) - 0.025) < 0.04, 'toy follows rendered water');
}
assert(luff > 0.5 && roll > 0.02, 'gust flutters cloth and heels hull');
assert(toy.sail.uniforms.uDroop.value < 0.1, 'gust opens the sail');
toyTest.cast.wind.push = 0;
for (let i = 0; i < 300; i++) toyTest.step();
assert(toy.sail.uniforms.uDroop.value > 0.95, 'sail falls slack after the gust');
console.log('Outlet continuity, sail response and floating motion passed.');

// A boat ahead of the leader must answer its own sail, whether or not it has joined the fleet.
for (const joined of [false, true]) {
  for (let index = 1; index < 7; index++) {
    const f = fixture();
    f.room.restore(3);
    const toy = f.room.toys[index];
    toy.joined = joined;
    const start = toy.s;
    const localWind = {
      sample(x, z, out) {
        return Object.assign(out, {
          x: 2,
          z: -1,
          energy: Math.hypot(x - toy.group.position.x, z - toy.group.position.z) < 0.7 ? 0.5 : 0,
          lift: 0,
        });
      },
    };
    for (let frame = 0; frame < 240; frame++) f.room.update(1 / 60, frame / 60, localWind, 101);
    assert(toy.s > start + 6, `toy ${index} waited for fleet order (joined=${joined}): ${toy.s - start}`);
    assert(toy.fill > 0.9 && toy.speed > 2, 'its own gust opens the sail and moves the hull');
  }
}
const outgoing = fixture();
outgoing.room.restore(95);
const seaWind = {
  sample(x, z, out) {
    return Object.assign(out, { x: 2, z: -1, energy: 0.5, lift: 0 });
  },
};
let worstJump = 0;
const previous = outgoing.room.toys.map((t) => t.group.position.clone());
for (let frame = 0; frame < 60 * 100; frame++) {
  if (frame === 60 * 8) {
    outgoing.room.active = false; // the next chapter must still leave the fleet sailing.
    seaWind.sample = (x, z, out) => Object.assign(out, { x: 0, z: 0, energy: 0, lift: 0 });
  }
  helpOut(outgoing.room, 1 / 60);
  outgoing.room.update(1 / 60, frame / 60, seaWind, 101);
  for (const [i, toy] of outgoing.room.toys.entries()) {
    const p = toy.group.position;
    worstJump = Math.max(worstJump, previous[i].distanceTo(p));
    previous[i].copy(p);
    assert(
      worldHeight(p.x, p.z) < boatsWaterBase(p.x, p.z) - 0.04,
      `toy ${i} grounded on outgoing course at ${toy.s}: ${p.toArray()}`,
    );
  }
}
assert(worstJump < 0.12, `outlet transition jumped: ${worstJump}`);
assert(
  outgoing.room.toys.every((t) => t.s >= 210 && t.group.position.x > L.x + 70 && !t.group.visible),
  'whole fleet sails out to the right and leaves view',
);
assert(!outgoing.room.departing, 'offscreen fleet stops updating');
console.log('Every sail responds independently; whole fleet clears the shore and continues after chapter departure.');

// Reproduce repeated strokes over the rearmost sail. Check rendered hull centres,
// not just course coordinates: the outlet bend compresses distance along the course.
// Toys in clear lanes may sail abreast, so measure along and across their heading: two
// hulls about 1.8 long and 1 wide stay apart outside this ellipse around each other.
function hullClearance(room, label) {
  const visible = room.toys.filter((t) => t.group.visible);
  let closest = Infinity;
  for (let i = 0; i < visible.length; i++) {
    for (let j = i + 1; j < visible.length; j++) {
      const a = visible[i].group.position, b = visible[j].group.position;
      const yaw = (visible[i].group.rotation.y + visible[j].group.rotation.y) / 2;
      const along = Math.abs((b.x - a.x) * Math.sin(yaw) + (b.z - a.z) * Math.cos(yaw));
      const across = Math.abs((b.x - a.x) * Math.cos(yaw) - (b.z - a.z) * Math.sin(yaw));
      const clearance = Math.hypot(along / 1.9, across / 1.1);
      closest = Math.min(closest, clearance);
      assert(clearance > 1, `${label}: hulls overlap (along ${along}, across ${across}), s=${visible[i].s},${visible[j].s}`);
    }
  }
  return closest;
}
for (const fps of [30, 60, 120]) {
  for (const restored of [3, 33, 69, 95]) {
    const room = new LittleBoats();
    room.active = true;
    room.restore(restored);
    hullClearance(room, `restored ${restored}`);
    let target = room.toys[0], closest = Infinity;
    const rearWind = {
      sample(x, z, out) {
        return Object.assign(out, {
          x: 2, z: -1, lift: 0,
          energy: Math.hypot(x - target.group.position.x, z - target.group.position.z) < 0.1 ? 0.5 : 0,
        });
      },
    };
    for (let frame = 0; frame < fps * 160; frame++) {
      target = room.toys.reduce((rear, t) => t.s < rear.s ? t : rear);
      // Hold the hero for ten seconds as the chapter does when the cygnet lags.
      const limit = frame < fps * 10 ? restored : L.length;
      const previous = room.toys.map((t) => t.s);
      // Once out, the plug's rush carries the fleet off whatever the travellers' limit, so it is pulled after the hold.
      if (frame >= fps * 10) helpOut(room, 1 / fps);
      room.update(1 / fps, frame / fps, rearWind, limit);
      room.toys.forEach((t, i) => {
        assert(t.s >= previous[i] - 1e-8, 'separation never jerks a hull backwards');
        const fastest = Math.max(tuning.littleBoats.speed, tuning.littleBoats.rushSpeed, tuning.littleBoats.surgeSpeed);
        assert(t.s - previous[i] <= fastest / fps + 1e-8, 'contact does not teleport a hull forward');
      });
      if (frame < fps * 10) assert.equal(room.progress, restored, 'rear push respects the traveller limit');
      closest = Math.min(closest, hullClearance(room, `rear gust ${fps}fps from ${restored}`));
    }
    assert.equal(room.progress, L.length, 'rear strokes still complete the room');
    assert(room.toys.every((t) => !t.group.visible), 'rear strokes send the entire fleet offshore');
    console.log(JSON.stringify({ test: 'rear-sail separation', fps, restored, closest }));
  }
}

// The way out to sea needs the player. Steady sail wind grounds the fleet at the shoal; the island's own gusts rock the
// bath but never pour it, and neither does a push away from the stream. Gusts across the plug only rock it, an updraft
// over it does nothing until the fleet waits at it, and then lifts it out.
{
  const f = fixture();
  f.chapter.restoreCheckpoint('pool-1', [40]);
  f.cast.wind.push = 1;
  const d = f.room.drain;
  for (let i = 0; i < 60 * 60; i++) f.step();
  assert.equal(d.waiting(f.room.toys[0].s), d.bathAt, 'steady wind grounds the fleet at the shoal');
  assert(f.room.progress < tuning.littleBoats.barS, `the fleet stays short of the shoal: ${f.room.progress}`);
  assert(d.nudges >= 4, `the island's own gust keeps showing the bath: ${d.nudges}`);
  assert.equal(f.cast.lines.gusts, d.nudges, 'every one of its gusts is drawn as wind lines');
  assert.equal(d.rise, 0, "the island's own gusts never raise the pools");
  for (let i = 0; i < 60 * 5; i++) {
    look(d.bathAt);
    d.aim(eye);
    strokeAcross(f.room, d.bathAt, d.pushAngle + Math.PI, 1 / 60);
    f.step();
  }
  assert.equal(d.rise, 0, 'a push away from the stream never pours the bath');
  f.player = true;
  for (let i = 0; i < 60 * 30 && !d.risen; i++) f.step();
  assert(d.risen, 'a push toward the stream pours the bath and raises the pools');
  f.player = false;
  for (let i = 0; i < 60 * 90 && d.waiting(f.room.toys[0].s) !== d.plugAt; i++) f.step();
  assert.equal(d.waiting(f.room.toys[0].s), d.plugAt, 'the fleet waits at the plug');
  for (let i = 0; i < 60 * 10; i++) {
    strokeAcross(f.room, d.plugAt, (i % 120) < 60 ? 0 : Math.PI, 1 / 60);
    f.step();
  }
  assert(d.loose === 0 && !d.pulled, `gusts across the plug never loosen it: ${d.loose}`);
  f.player = true;
  let lifted = 0;
  for (; lifted < 60 * 20 && !d.pulled; lifted++) f.step();
  assert(d.pulled, 'an updraft over the plug lifts it out');
  assert(lifted > 60 * 2 && lifted < 60 * 8, `the plug takes a few seconds of circling: ${lifted / 60}s`);
  for (let i = 0; i < 60 * 30 && !f.chapter.done; i++) f.step();
  assert(f.room.progress > tuning.littleBoats.plugS + 5, `the rush carries the fleet out: ${f.room.progress}`);

  const early = fixture();
  early.chapter.restoreCheckpoint('pool-2', [70]);
  for (let i = 0; i < 60 * 3; i++) {
    circleOver(early.room, early.room.drain.plugRest, 1 / 60);
    early.step();
  }
  assert.equal(early.room.drain.loose, 0, 'the plug holds until the fleet waits at it');
  console.log('The bath pours only to the player\'s push toward the stream; the plug lifts only to their updraft, once the fleet waits.');
}
