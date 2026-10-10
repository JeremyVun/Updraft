import assert from 'node:assert/strict';
import * as THREE from 'three';
import { drownedCast } from './lib/storm-cast.mjs';

const { DrownedChapter } = await import('../src/story/drowned.ts');
const { NAVE_BERTH } = await import('../src/world/drowned-way.ts');
const { tuning } = await import('../src/tuning.ts');

for (const fps of [30, 60, 120]) for (const interval of [0.3, 5]) {
  const wind = { breeze: new THREE.Vector2(), calm: 3, addSplat() {}, sample(x, z, out) {
    return Object.assign(out, { x: this.breeze.x, z: this.breeze.y, lift: 0, energy: 0 });
  } };
  const cast = drownedCast(wind), chapter = new DrownedChapter(cast);
  chapter.skipToRun();
  chapter.skipToBelfry();
  const church = chapter.church, { boat, child, cat, village } = cast;
  if (process.env.NEGATIVE) Object.defineProperty(church, 'carrying', { value: false });
  const dt = 1 / fps, started = fps * 7;
  let t = 0;
  const tick = () => {
    t += dt;
    const time = started + t, angle = -Math.PI / 10 + Math.sin(time * 0.021) * 0.35;
    wind.breeze.set(Math.cos(angle), Math.sin(angle)).multiplyScalar(tuning.wind.breeze * chapter.breeze);
    chapter.update(dt, time);
    boat.update(dt, time);
    child.update(dt);
    cat.update(dt);
    village.kittens.update(dt, time);
  };
  while (church.step !== 'ring' && t < 10) tick();
  assert.equal(church.step, 'ring');
  const waitingAt = boat.position.clone(), beganWaiting = t;
  while (t - beganWaiting < 20) tick();
  assert(Math.hypot(boat.position.x - waitingAt.x, boat.position.z - waitingAt.z) < 0.001,
    'the lost boat must wait for the bell');

  const ringAt = t;
  let sent = 0, down = null, moored = null, peak = 0, moving = null;
  const previous = boat.position.clone();
  while (t - ringAt < 70 && church.aboardFor < 2) {
    if (sent < tuning.drowned.church.rings && t - ringAt >= sent * interval) {
      church.rang(1);
      sent++;
    }
    const wasDown = down !== null;
    tick();
    if (church.step === 'down' && down === null) down = t;
    if (wasDown && !boat.grounded && church.aboardFor < 0) {
      const speed = Math.hypot(boat.position.x - previous.x, boat.position.z - previous.z) / dt;
      peak = Math.max(peak, speed);
      if (speed > 0.3 && moving === null) moving = t;
    }
    previous.copy(boat.position);
    if (down !== null) assert(!chapter.invitesSail, 'the summoned boat must not invite a sail gesture');
    if (down !== null && boat.grounded && moored === null) moored = t;
  }
  assert(down !== null && moving !== null && moving - down < 3, 'the summoned boat must keep moving without player wind');
  assert(moored !== null && moored - down < 35, 'the boat must drift to the berth without waiting for a fallback');
  assert(church.aboardFor >= 2, 'the child must board without another gesture');
  assert(peak < 2.9, `the return must stay gentle: ${peak.toFixed(2)} m/s`);
  assert(Math.hypot(boat.position.x - NAVE_BERTH.x, boat.position.z - NAVE_BERTH.z) < 0.1,
    'the boat must settle at the boarding point');
  assert(boat.grounded && child.riding && !church.carrying, 'the boat must wait through boarding and the farewell');
  console.log(`${fps} Hz, ${interval}s rings: motion in ${(moving - down).toFixed(2)}s, moored ${(moored - down).toFixed(2)}s, aboard ${(t - down - church.aboardFor).toFixed(2)}s, peak ${peak.toFixed(2)} m/s; no player wind`);
}
