// Wingbeat timing and resting/take-off gates; no browser or GPU required.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { registerHooks } from 'node:module';
import { transformSync } from 'rolldown/utils';
registerHooks({
  resolve(s, c, next) { return next(s.startsWith('.') && !/\.[a-z]+$/i.test(s) ? s + '.ts' : s, c); },
  load(u, c, next) {
    return u.endsWith('.ts')
      ? { format: 'module', shortCircuit: true, source: transformSync(new URL(u).pathname, fs.readFileSync(new URL(u), 'utf8')).code }
      : next(u, c);
  },
});
globalThis.location = { search: '?shot' };
const { Foley } = await import('../src/audio/foley.ts');
const { SwanFlock } = await import('../src/creatures/flock.ts');

for (const fps of [10, 30, 60, 120, 144]) {
  const foley = new Foley(), beats = [];
  let elapsed = 0;
  // Capture emitted sounds at the synthesis boundary without changing the production clock.
  foley.out = { ctx: { get currentTime() { return elapsed; } } };
  foley.puff = sound => beats.push({ elapsed, ...sound });
  const run = (seconds, far) => {
    for (let i = 0; i < seconds * fps; i++) { elapsed += 1 / fps; foley.wingbeat(1 / fps, .2, far); }
  };
  run(60, 1);
  assert.equal(beats.length, 0, 'distant swans remain inaudible');
  run(1, .1);
  assert(beats.length <= 1, `${fps} Hz: approaching swans cannot replay old beats`);
  run(19, .1);
  assert(beats.length >= 10 && beats.length <= 11, `${fps} Hz: original 3.4 rad/s cadence`);
  for (let i = 1; i < beats.length; i++) {
    assert(beats[i].elapsed - beats[i - 1].elapsed >= Math.PI * 2 / 3.4 - 1 / fps - 1e-8);
  }
  assert(beats.every(b => b.pan === .2 && b.level === .03 * (1 - .7 * .1)), 'spatial sound is unchanged');
  foley.out = null;
  const beforeMute = beats.length;
  run(60, .1);
  assert.equal(beats.length, beforeMute);
  foley.out = { ctx: { get currentTime() { return elapsed; } } };
  run(1, .1);
  assert(beats.length - beforeMute <= 1, 'unmuting cannot replay unheard beats');
}

const flock = new SwanFlock();
assert(!flock.flying && !flock.active);
flock.rest(0, 0, 8);
assert(flock.active && !flock.flying, 'resting swans have no sustained wingbeats');
flock.lift(); assert(flock.flying, 'wings beat during take-off');
flock.clear(); assert(!flock.flying);
flock.pass(0, 0, 30, 0); assert(flock.flying);
flock.circle(0, 0, 30, 15); assert(flock.flying);
flock.rest(0, 0, 8); assert(!flock.flying, 'landing silences sustained wingbeats');
console.log('Flock audio: no distant/muted backlog, original cadence at 10–144 Hz, rest/take-off/flight gates passed.');
