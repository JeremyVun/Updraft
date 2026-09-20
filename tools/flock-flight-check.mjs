// Ending flight mechanics without a renderer: momentum, bounded catch-up, and the opening's V.
// Usage: node tools/flock-flight-check.mjs. Visual review still needs the real summit camera.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { registerHooks } from 'node:module';
import { transformSync } from 'rolldown/utils';
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
const { SwanFlock } = await import('../src/creatures/flock.ts');
const { wrapAngle } = await import('../src/creatures/motion.ts');
const { tuning } = await import('../src/tuning.ts');
let seed;
Math.random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
let worstSpeed = 0, worstGap = 0, cases = 0;
for (const fps of [30, 60, 120]) for (const bearing of [Math.PI, 0.73]) for (const initialSeed of [7, 147, 2026, 9182]) {
  seed = initialSeed;
  const flock = new SwanFlock(), dt = 1 / fps;
  flock.circle(5, -34, 50, 20, 16, 18);
  // As in the ending, the family waits on the wheel through the cygnet's independent flight.
  for (let i = 0; i < 20 * fps; i++) flock.update(dt, i * dt);
  const at = flock.birds.map(b => b.at.clone());
  const speeds = flock.birds.map(b => b.speed);
  const headings = flock.birds.map(b => b.yaw);
  flock.goOn(bearing, 1, 11);
  flock.birds.forEach((b, i) => {
    assert.equal(b.at.distanceTo(at[i]), 0, 'departure moved a bird before it flew');
    assert.equal(b.speed, speeds[i], 'departure discarded flight speed');
    assert.equal(b.yaw, headings[i], 'departure snapped a heading');
  });
  const c = Math.cos(bearing), s = Math.sin(bearing);
  for (let frame = 0; frame < 18 * fps; frame++) {
    const before = flock.birds.map(b => ({ at: b.at.clone(), yaw: b.yaw, speed: b.speed }));
    flock.update(dt, 20 + frame * dt);
    for (let i = 0; i < flock.birds.length; i++) {
      const b = flock.birds[i], was = before[i];
      const movement = b.at.clone().sub(was.at);
      const speed = movement.length() / dt;
      worstSpeed = Math.max(worstSpeed, speed);
      assert(speed < 14, `bird ${i} surged to ${speed.toFixed(2)} at ${fps} fps`);
      assert(Math.abs(b.speed - was.speed) / dt < 3.01, 'sudden acceleration');
      assert(Math.abs(wrapAngle(b.yaw - was.yaw)) / dt < 0.901, 'sudden turn');
      assert(Math.abs(wrapAngle(Math.atan2(movement.x, movement.z) - b.yaw)) < 1e-8, 'bird slid sideways');
      for (let j = 0; j < i; j++) assert(b.at.distanceTo(flock.birds[j].at) > 1.5, `turning birds crossed: ${b.at.distanceTo(flock.birds[j].at)} at ${frame / fps}s, seed ${initialSeed}, bearing ${bearing}`);
      if (frame === 16 * fps - 1) {
        const target = flock.head.clone().add({
          x: b.offset.x * c + b.offset.z * s,
          y: b.offset.y,
          z: -b.offset.x * s + b.offset.z * c,
        });
        const gap = b.at.distanceTo(target);
        worstGap = Math.max(worstGap, gap);
        assert(gap < 3, `V still scattered when the child turns away: gap ${gap.toFixed(2)}`);
      }
    }
  }
  // The departing family has the opening's broad V, including the empty tail for the small one.
  const slots = [...flock.birds].sort((a, b) => b.offset.z - a.offset.z);
  slots.forEach((b, i) => {
    const rank = Math.ceil(i / 2);
    assert(Math.abs(Math.abs(b.offset.x) - rank * 3.1) < 0.71, 'V arm differs from the opening');
    assert(Math.abs(b.offset.z + rank * 4.4) < 1.61, 'V depth differs from the opening');
  });
  const tail = flock.nextSlot(flock.head.clone()).sub(flock.head);
  assert(Math.abs(tail.x * c - tail.z * s - 8 * 3.1) < 1e-8, 'cygnet has no tail station');
  flock.clear();
  flock.pass(0, 0, 30, bearing, 16, 0, false);
  assert(!flock.departing, 'departure steering leaked into a fresh opening flock');
  cases++;
}
console.log(`${cases} flight cases passed (30/60/120 fps); peak ${worstSpeed.toFixed(2)}, worst station gap at 16s ${worstGap.toFixed(2)}.`);

// The summit arrival must keep the same birds and fly a circuit before the cygnet calls.
let arrivalGap = 0, arrivalSeparation = Infinity, arrivalPeak = 0, arrivalArc = Infinity;
for (const fps of [30, 60, 120]) for (const initialSeed of [7, 147, 2026, 9182]) {
  seed = initialSeed;
  const flock = new SwanFlock(), dt = 1 / fps;
  const f = tuning.summit;
  flock.pass(2-f.wheelRadius, -f.wheelAhead, 50, Math.PI, 13, 60, false);
  for (let i = 0; i < 3.5 * fps; i++) flock.update(dt, i * dt);
  const birds = [...flock.birds], beforeTurn = birds.map(b => ({at:b.at.clone(), yaw:b.yaw, speed:b.speed}));
  flock.circle(2, -f.wheelAhead, 50, f.wheelRadius, 14, 8);
  assert.equal(flock.birds.length, birds.length, 'arrival invented another adult');
  flock.birds.forEach((b,i) => {
    assert.equal(b, birds[i], 'arrival replaced an adult');
    assert.equal(b.at.distanceTo(beforeTurn[i].at), 0, 'arrival teleported');
    assert.equal(b.yaw, beforeTurn[i].yaw, 'arrival snapped heading');
    assert.equal(b.speed, beforeTurn[i].speed, 'arrival lost momentum');
  });
  for (let frame = 0; frame < 60 * fps; frame++) {
    const before = birds.map(b => ({at:b.at.clone(), yaw:b.yaw, speed:b.speed}));
    flock.update(dt, 3.5 + frame * dt);
    birds.forEach((b,i) => {
      const was = before[i], movement = b.at.clone().sub(was.at);
      arrivalPeak = Math.max(arrivalPeak, movement.length()/dt);
      assert(movement.length()/dt < 20, 'arrival raced to the wheel');
      assert(Math.abs(b.speed-was.speed)/dt < 2.401, 'arrival accelerated abruptly');
      assert(Math.abs(wrapAngle(b.yaw-was.yaw))/dt < 0.721, 'arrival turned abruptly');
      assert(Math.abs(wrapAngle(Math.atan2(movement.x,movement.z)-b.yaw)) < 1e-8, 'arrival slid sideways');
      for(let j=0;j<i;j++) arrivalSeparation = Math.min(arrivalSeparation,b.at.distanceTo(birds[j].at));
      if(frame===9*fps-1) arrivalGap = Math.max(arrivalGap,Math.abs(Math.hypot(b.at.x-2,b.at.z+f.wheelAhead)-f.wheelRadius*b.arc.z));
    });
    if (frame === 9*fps-1) {
      const angles=birds.map(b=>Math.atan2(b.at.z+f.wheelAhead,b.at.x-2)).sort((a,b)=>a-b);
      const gaps=angles.map((a,i)=>(angles[(i+1)%angles.length]-a+Math.PI*2)%(Math.PI*2));
      arrivalArc=Math.min(arrivalArc,Math.PI*2-Math.max(...gaps));
    }
  }
}
assert(arrivalArc > Math.PI * 0.7, 'arriving adults stayed bunched in a V');
assert(arrivalGap < 1, 'adults had not reached the circuit when the cygnet called');
assert(arrivalSeparation > 1.5, 'adults crossed on the arrival');
console.log(`12 arrival cases: peak ${arrivalPeak.toFixed(2)}, orbit error at call ${arrivalGap.toFixed(2)}, closest adults ${arrivalSeparation.toFixed(2)}, arc ${(arrivalArc*180/Math.PI).toFixed(0)} degrees.`);

// Run the real farewell too: the small one must reach the tail without reversing or being crossed.
globalThis.document = { createElement: () => ({ getContext: () => ({ beginPath() {}, moveTo() {}, quadraticCurveTo() {}, stroke() {} }) }) };
const { Traveller } = await import('../src/traveller/traveller.ts');
const { Cygnet } = await import('../src/creatures/cygnet.ts');
const { Carry } = await import('../src/companion/carry.ts');
const { HomeChapter } = await import('../src/story/home.ts');
const { LAST_HILL } = await import('../src/world/heightfield.ts');
for (const fps of [30, 60, 120]) for (const startSeed of [7, 147, 2026]) for (const arriving of [false, true]) {
  seed = startSeed;
  const air = { x: 0, z: 0, energy: 0, lift: 0 };
  const wind = { sample(_x, _z, out) { return Object.assign(out, air); } };
  const child = new Traveller(wind), cygnet = new Cygnet(), flock = new SwanFlock();
  const carry = new Carry(child, cygnet);
  cygnet.mount = child;
  const plane = { hold(c) { c.carryingPlane = true; }, held: false };
  const chapter = new HomeChapter({
    child, cygnet, flock, carry, plane,
    drawing: { mesh: { visible: false } }, cottage: { position: child.position.clone() },
  });
  child.stop();
  child.place(LAST_HILL.x, LAST_HILL.z, Math.PI);
  child.sitDown();
  const from = child.position.clone();
  from.x += 4;
  from.y += 8;
  cygnet.visible = false;
  cygnet.flyWith(from, 0, 0);
  if (arriving) {
    const f=tuning.summit, c=child.position;
    flock.pass(c.x+2-f.wheelRadius,c.z-f.wheelAhead,c.y+f.wheelHeight,Math.PI,13,60,false);
    for(let i=0;i<3.5*fps;i++) flock.update(1/fps,i/fps);
    flock.circle(c.x+2,c.z-f.wheelAhead,c.y+f.wheelHeight,f.wheelRadius,13,8);
    for(let i=0;i<20*fps;i++) flock.update(1/fps,3.5+i/fps);
  }
  chapter.answered();
  cygnet.fledge(child.position, 1.15);
  chapter.to('fledge');
  let peak = 0, minNorth = Infinity, closest = Infinity, joined = false;
  for (let frame = 0; frame < 60 * fps; frame++) {
    const dt = 1 / fps, time = frame * dt, before = cygnet.position.clone();
    chapter.update(dt, time);
    if (chapter.wentOn) break;
    child.update(dt);
    carry.update(dt);
    flock.update(dt, time);
    cygnet.update(dt, time, child.position, air);
    carry.after();
    if (flock.departing) {
      peak = Math.max(peak, cygnet.position.distanceTo(before) / dt);
      minNorth = Math.min(minNorth, (before.z - cygnet.position.z) / dt);
      for (const b of flock.birds) closest = Math.min(closest, b.at.distanceTo(cygnet.position));
      joined ||= cygnet.joined;
    }
  }
  assert(chapter.wentOn && joined, 'reunion failed');
  assert(peak < 15, 'cygnet surged');
  assert(minNorth > 0, 'cygnet turned back');
  assert(closest > 1.8, 'adult crossed through the cygnet');
}
console.log('18 full reunion cases passed: the cygnet joins, adults leave room, and the child continues.');
