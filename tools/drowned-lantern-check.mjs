import assert from 'node:assert/strict';
import * as THREE from 'three';
import { stormCast } from './lib/storm-cast.mjs';
const { atmo } = await import('../src/world/atmosphere.ts');
const { NAVE_BERTH } = await import('../src/world/drowned-way.ts');
const wind = { breeze: new THREE.Vector2(), calm: 0, addSplat() {}, sample(x, z, out) {
  return Object.assign(out, { x: 0, z: 0, lift: 0, energy: 0 });
} };
const { cast, chapter } = stormCast(wind), church = chapter.church;
church.firstAnswer = church.since - 10;
church.answeredAt = church.since - 10;
cast.village.dark.level = 8;
cast.village.dark.rise = 1;
cast.village.dark.clearing.radius = 0;
atmo.uniforms.uNight.value = 1;
const lamp = atmo.uniforms.uLantern.value;
for (const step of ['wait', 'board', 'aboard']) for (const distance of [0, 4, 8, 12, 18, 40]) {
  church.to(step);
  cast.boat.position.set(NAVE_BERTH.x, 0.2, NAVE_BERTH.z - distance);
  lamp.set(cast.boat.position.x, 1.5, cast.boat.position.z, 1);
  church.boatHome(0);
  const visible = church.glow.mesh.visible;
  if (step !== 'wait' || distance <= 8) assert(!visible, `${step} at ${distance} m still has the answering orb`);
  if (step === 'wait' && distance >= 18) assert(visible, 'the distant bell answer lost its glow');
}
for (const fps of [30, 60, 120]) {
  const { cast, chapter } = stormCast(wind), church = chapter.church;
  church.firstAnswer = church.answeredAt = church.since - 10;
  let lowest = Infinity;
  for (let i = 1; i <= fps * 60; i++) {
    const dt = 1 / fps, t = i * dt;
    chapter.update(dt, t); cast.boat.update(dt, t); cast.child.update(dt); cast.cat.update(dt);
    assert(!church.glow.mesh.visible, `the answering orb returned during the storm at ${t}`);
    lowest = Math.min(lowest, lamp.w);
  }
  assert(lowest > 0.1, 'the normal lantern light was disabled');
  console.log(`storm lantern ${fps} Hz: answering glow hidden, normal light at least ${lowest.toFixed(3)}`);
}
