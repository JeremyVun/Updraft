// Check a real rescue replay recorded with AUDIT=<prefix> by drowned-run-check.mjs.
import assert from 'node:assert/strict';
import fs from 'node:fs';
const { samples, events } = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const released = events.find(s => s.released), sailing = events.find(s => s.sailingFrom >= 0);
const quiet = events.find(s => s.quiet), calm = events.find(s => s.beat === 'still');
const phrases = events.filter(s => s.event === 'phrase' && s.game >= sailing?.game && s.game <= (calm?.game ?? 0) + 10);
assert(released && sailing && quiet && calm, 'complete rescue and sailing sequence recorded');
assert.equal(phrases.length, 0, `no musical phrase as the air dies: ${phrases.map(p => p.name).join(', ')}`);
const delay = calm.game - sailing.game;
assert(delay >= 3.98 && delay <= 4.05, `four seconds of sailing before the air dies: ${delay}`);
assert(quiet.game - sailing.game >= 1.99, 'music continues for the added two seconds');
const distance = Math.hypot(calm.boat[0] - released.boat[0], calm.boat[2] - released.boat[2]);
assert(distance > 7, `visible travel before becalming: ${distance} m`);
const run = samples.filter(s => s.beat === 'run');
assert(run.length > 20, 'roof-to-tree transition recorded');
let fastest = 0;
for (let i = 1; i < run.length; i++) {
  const a = run[i - 1], b = run[i], dx = b.fog[0] - a.fog[0], dz = b.fog[1] - a.fog[1];
  assert.deepEqual(b.fog.slice(2), a.fog.slice(2), 'bank never pivots');
  assert(dx * b.fog[2] + dz * b.fog[3] >= -1e-7, 'bank never retreats');
  assert.equal(b.shape[3], 1, 'camera movement never fades the bank');
  fastest = Math.max(fastest, Math.hypot(dx, dz) / (b.game - a.game));
}
assert(fastest <= 3.21, `steady fog advance: ${fastest} m/s`);
console.log(`Live replay: the air dies after ${delay.toFixed(2)} s of sailing, ${distance.toFixed(2)} m travelled, in silence; fog fixed in direction, no retreat, at most ${fastest.toFixed(2)} m/s.`);
