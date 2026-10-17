// Independent kite simulation, shore grounding and chapter isolation without a GPU.
// Run: node tools/kite-logic-check.mjs
import './lib/typescript.mjs';
import assert from 'node:assert/strict';
import * as THREE from 'three';

globalThis.location = { search: '?shot' };
globalThis.window = { innerWidth: 1600, innerHeight: 900, matchMedia: () => ({ matches: false }) };
const { DepartureKites } = await import('../src/story/departure-kites.ts');
const { heightAt } = await import('../src/world/island.ts');
const { Kite } = await import('../src/world/kite.ts');
const { REFLECTION_LAYER } = await import('../src/world/water/reflection.ts');
const { MIRROR_DECK } = await import('../src/world/sky-mirror-layout.ts');
const { SHORE_PILING } = await import('../src/world/shore-pulley.ts');
const { NAVE_BERTH } = await import('../src/world/drowned-way.ts');
const { swellUniforms, swellAt } = await import('../src/world/water/swell.ts');
let gust = 0;
const wind = { calm: 0, sample(x, z, out) { return Object.assign(out, { x: 2.4, z: -.8, energy: x < 50 ? gust : 0, lift: x < 50 ? gust : 0 }); } };
const camera = new THREE.PerspectiveCamera(38, 1.5, .1, 7000);
const markers = new DepartureKites(wind);
const wet = [];
for (const [name, kite] of Object.entries(markers.markers)) {
  kite.group.traverse(part => { if (part.isMesh) assert(part.layers.isEnabled(REFLECTION_LAYER), 'the kite and its tail reflect in water'); });
  const ground = heightAt(kite.tieOff.x, kite.tieOff.z);
  console.log(`${name} tie-off ground: ${ground.toFixed(2)}`);
  if (!['mirror', 'stairs', 'lines', 'drowned'].includes(name) && ground < 0) wet.push(name);
  camera.position.copy(kite.tieOff).add(new THREE.Vector3(0, 10, 35));
  camera.lookAt(kite.tieOff); camera.updateMatrixWorld();
  markers.update(1 / 60, 0, camera, { name, current: {} });
  assert.deepEqual(Object.entries(markers.markers).filter(([, k]) => k.group.visible).map(([n]) => n), [name]);
  markers.update(1 / 60, 0, camera, { name, current: { departureKite: false } });
  assert(!kite.group.visible);
  assert(Object.entries(markers.markers).every(([n, k]) => !k.group.visible || (name === 'drowned' && n === 'stairs')));
}
assert.deepEqual(wet, [], 'freestanding posts must stand on dry ground');
assert(markers.markers.lines.tieOff.distanceTo(SHORE_PILING) < 1e-8, 'the Lines kite is tied to the pulley piling');
const mirrorPost = markers.markers.mirror.tieOff;
assert(mirrorPost.x >= MIRROR_DECK.x0 && mirrorPost.x <= MIRROR_DECK.x1
  && Math.abs(mirrorPost.z - MIRROR_DECK.z0) < MIRROR_DECK.halfWidth,
  'the mirror post must stand on the jetty, not the submerged flat');
// Each sailing chapter keeps the kite on the shore just left, never at the destination.
for (const [chapter, shore] of Object.entries({
  toLines: 'island', toBoats: 'lines', toMeadow: 'boats', toBirches: 'meadow',
  toStairs: 'birches', drowned: 'stairs', toSleeping: 'wood', toMirror: 'sleeping', toHome: 'sleeping', toHarbour: 'mirror',
})) {
  markers.update(1 / 60, 0, camera, { name: 'home', current: {} });
  camera.position.copy(markers.markers[shore].tieOff);
  markers.update(1 / 60, 0, camera, { name: chapter, current: { departureKite: false } });
  assert.deepEqual(Object.entries(markers.markers).filter(([, k]) => k.group.visible).map(([n]) => n), [shore], chapter);
}
// Old saves leave Lines directly; keep that shore's kite throughout the crossing.
camera.position.copy(markers.markers.lines.tieOff);
markers.update(1 / 60, 1, camera, { name: 'toMeadow', current: {} });
assert(markers.markers.lines.group.visible && !markers.markers.boats.group.visible);
camera.position.copy(markers.markers.boats.tieOff);
markers.update(1 / 60, 2, camera, { name: 'toMeadow', current: {} });
assert(!markers.markers.boats.group.visible, 'crossings must not introduce the next island marker');
markers.update(1 / 60, 2, camera, { name: 'home', current: {} });
assert(Object.values(markers.markers).every(k => !k.group.visible), 'home has no onward boat marker');

const floating = markers.markers.drowned;
camera.position.set(NAVE_BERTH.x, 12, NAVE_BERTH.z - 18);
markers.update(1 / 60, 3, camera, { name: 'drowned', current: { departureKite: false } });
assert(!floating.group.visible, 'no pickup marker before the tower');
const sea = { height: 0, slopeX: 0, slopeZ: 0 };
for (let i = 0; i < 120; i++) {
  swellUniforms.uSwell.value = i / 120;
  markers.update(1 / 60, i / 60, camera, { name: 'drowned', current: { departureKite: true } });
  const height = swellAt(floating.position.x, floating.position.z, i / 60, sea).height;
  assert(Math.abs(floating.position.y - height - .11) < .001, 'pickup kite floats on the water');
  assert(floating.group.visible && !floating.cord.mesh.visible, 'floating kite has no upright post or flying string');
  for (const p of floating.tail) assert(p.toArray().every(Number.isFinite));
}
swellUniforms.uSwell.value = 0;

for (const fps of [30, 60, 120]) {
  const a = new Kite(wind, { x: 0, z: 0 }), b = new Kite(wind, { x: 120, z: 0 });
  camera.position.set(50, 30, 50); camera.lookAt(50, 0, 0); camera.updateMatrixWorld();
  gust = 0;
  for (let i = 0; i < fps * 12; i++) { a.update(1 / fps, i / fps, camera); b.update(1 / fps, i / fps, camera); }
  const still = b.position.clone(), before = a.position.y;
  gust = 2;
  for (let i = 0; i < fps * 2; i++) a.update(1 / fps, 12 + i / fps, camera);
  assert.deepEqual(b.position.toArray(), still.toArray(), 'updating one kite cannot move another');
  assert(a.position.y > before + 1, 'a gust visibly lifts the local kite');
  a.update(1 / fps, 14, camera, false);
  a.update(1 / fps, 15, camera, true);
  for (const p of a.tail) assert(p.toArray().every(Number.isFinite), 'returning to a kite must leave a finite tail');
  console.log(`${fps}fps: local gust, independent position and hidden/reveal tail passed`);
}

const gustReports = [];
for (const fps of [30, 60, 120]) {
  const sample = { x: 2.4, z: -.8, energy: 0, lift: 0 };
  const localWind = { calm: .8, sample(_x, _z, out) { return Object.assign(out, sample); } };
  const simulate = duration => {
    const kite = new Kite(localWind, { x: 0, z: 0 });
    const positions = [];
    let peakTailSpeed = 0;
    let peakTailTime = 0;
    for (let frame = 0; frame < fps * 18; frame++) {
      const time = frame / fps;
      const blowing = time >= 12 && time < 12 + duration;
      Object.assign(sample, blowing ? { x: 26, z: -26 / 3, energy: 1.6, lift: 2.5 }
        : { x: 2.4, z: -.8, energy: 0, lift: 0 });
      const tip = kite.tail.at(-1).clone();
      kite.update(1 / fps, time, camera);
      if (time < 12) continue;
      positions.push(kite.position.clone());
      const tailSpeed = tip.distanceTo(kite.tail.at(-1)) * fps;
      if (tailSpeed > peakTailSpeed) { peakTailSpeed = tailSpeed; peakTailTime = time; }
      for (const p of kite.tail) assert(p.toArray().every(Number.isFinite), 'strong gust leaves a finite tail');
    }
    return { positions, peakTailSpeed, peakTailTime };
  };
  const quiet = simulate(0), flick = simulate(.1), held = simulate(3);
  const displacement = run => run.positions.map((p, i) => p.distanceTo(quiet.positions[i]));
  const flickDistance = displacement(flick), heldDistance = displacement(held);
  const onset = Math.max(...heldDistance.slice(0, Math.round(fps * .1)));
  const flickPeak = Math.max(...flickDistance), heldPeak = Math.max(...heldDistance);
  console.log(`${fps}fps: gust onset ${onset.toFixed(3)}m; flick ${flickPeak.toFixed(2)}m; held ${heldPeak.toFixed(2)}m; tail ${held.peakTailSpeed.toFixed(2)}m/s at ${held.peakTailTime.toFixed(2)}s`);
  assert(onset < .25, 'a brief gust cannot jerk the kite immediately across its tether');
  assert(flickPeak < heldPeak * .5, 'a flick must produce much less travel than sustained wind');
  assert(heldPeak > 1, 'sustained wind must still visibly move the kite');
  assert(held.peakTailSpeed < 20, 'the tail must not whip violently in a maximum pointer gust');
  gustReports.push(held.peakTailSpeed);
}
assert(Math.max(...gustReports) / Math.min(...gustReports) < 1.2,
  'higher frame rates must not amplify the tail whip');

// The sky mirror's kite is wound round the lamppost and flies steady in the still air over the flat: in a dead calm,
// the island breeze and a long player gust, its string never comes down to the water.
{
  const { Boat } = await import('../src/traveller/boat.ts');
  const { lanternFlame } = await import('../src/traveller/boat/parts.ts');
  const still = { x: 0, z: 0, energy: 0, lift: 0 };
  for (const [label, air] of [['calm', still], ['breeze', { x: 2.4, z: -.8, energy: 0, lift: 0 }], ['gust', { x: 22, z: 8, energy: 1.4, lift: 2 }]]) {
    const kites = new DepartureKites({ calm: 0, sample: (x, z, out) => Object.assign(out, air) });
    const kite = kites.markers.mirror;
    camera.position.copy(kite.tieOff).add(new THREE.Vector3(-20, 6, 18));
    camera.lookAt(kite.tieOff); camera.updateMatrixWorld();
    let lowest = Infinity, lowestKite = Infinity;
    for (let frame = 0; frame < 60 * 40; frame++) {
      kites.update(1 / 60, frame / 60, camera, { name: 'mirror', current: {} });
      if (frame < 60 * 5) continue;
      lowest = Math.min(lowest, ...kite.cordPoints.map(p => p.y));
      lowestKite = Math.min(lowestKite, kite.position.y);
    }
    console.log(`mirror ${label}: string ${lowest.toFixed(2)} m at its lowest, kite ${lowestKite.toFixed(2)} m`);
    assert(lowest > 0.15, `the mirror kite's string stays out of the water in ${label}`);
    assert(lowestKite > 5, `the mirror kite flies, not hangs, in ${label}`);
  }

  // Over the cloud the tow line is hitched round the stem post below the lantern and leaves it clear of the glass,
  // whichever way the kite stands from the bow.
  const boat = new Boat(wind);
  boat.group.position.set(0, 0, 0); boat.group.rotation.set(0, 0.4, 0); boat.group.updateMatrixWorld(true);
  const at = new THREE.Vector3(), axis = new THREE.Vector3();
  boat.stemHitch(at, axis);
  // The lantern in the hull's own frame: its base plate under the glass up to the ring on its cap.
  const flame = lanternFlame(), toHull = boat.group.matrixWorld.clone().invert();
  const box = new THREE.Box3(new THREE.Vector3(-.14, flame.y - .18, flame.z - .14), new THREE.Vector3(.14, flame.y + .36, flame.z + .14));
  const kites = new DepartureKites(wind), kite = kites.markers.stairs;
  let nearest = Infinity;
  for (const heading of [0.4, 0.4 + Math.PI / 2, 0.4 - Math.PI / 2, 0.4 + 0.8, 0.4 - 0.8]) {
    for (let frame = 0; frame < 60 * 20; frame++) {
      camera.position.copy(at).add(new THREE.Vector3(8, 4, -8)); camera.lookAt(at); camera.updateMatrixWorld();
      kites.update(1 / 60, frame / 60, camera, { name: 'stairs', current: { kiteTow: { at, heading, axis } } });
      const [a, b] = kite.cordPoints;
      for (let i = 0; i <= 20; i++) {
        const p = a.clone().lerp(b, i / 20).applyMatrix4(toHull);
        assert(!box.containsPoint(p), `the tow line clears the lantern (heading ${heading.toFixed(2)})`);
        nearest = Math.min(nearest, box.distanceToPoint(p));
      }
    }
  }
  assert(kite.leavesFrom.distanceTo(at) < .12 && at.clone().applyMatrix4(toHull).y < box.min.y - .1, 'the tow line leaves from the stem post below the lantern');
  console.log(`stairs tow: line ${(nearest * 100).toFixed(0)} cm clear of the lantern at its nearest`);
}
