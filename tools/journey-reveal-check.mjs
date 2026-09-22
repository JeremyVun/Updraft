// A newly enabled room must enter under opaque fog; retained rooms and restored starts stay unchanged.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { registerHooks } from 'node:module';
import { transformSync } from 'rolldown/utils';
registerHooks({
  resolve(s, c, next) { return next(s.startsWith('.') && !/\.[a-z]+$/i.test(s) ? s + '.ts' : s, c); },
  load(u, c, next) { return u.endsWith('.ts')
    ? { format: 'module', shortCircuit: true, source: transformSync(new URL(u).pathname, fs.readFileSync(new URL(u), 'utf8')).code }
    : next(u, c); },
});
globalThis.location = { search: '?shot' };
const { JourneyReveal, visibleRooms, setJourneyRooms, journeyRooms, ROOMS } = await import('../src/world/journey-rooms.ts');
const { tuning } = await import('../src/tuning.ts');
const cases = [
  ['island', 'toLines', 0], ['lines', 'toBoats', -400], ['boats', 'toMeadow', -570],
  ['meadow', 'toBirches', -1000], ['birches', 'drowned', -1240],
  ['drowned', 'drowned', ROOMS.drowned.z + 1, ROOMS.drowned.z - 1],
  ['wood', 'toSleeping', -1900], ['sleeping', 'toMirror', -1920], ['mirror', 'toHarbour', -2100],
];
for (const fps of [10, 30, 60, 120]) for (const [from, to, z, nextZ = z] of cases) {
  const reveal = new JourneyReveal(), before = visibleRooms(from, z), after = visibleRooms(to, nextZ);
  assert.deepEqual(reveal.update(before, 0), before, 'initial chapters are visible immediately');
  assert.deepEqual(reveal.amounts.value.toArray(), [0, 0]);
  const added = after.filter(room => !before.includes(room));
  assert(added.length > 0);
  let shown = reveal.update(after, 1 / fps), enabledAt = null, last = 0;
  for (const room of added) assert(!shown.includes(room), `${from}: first frame must not enable the new shore`);
  assert.deepEqual(reveal.amounts.value.toArray(), [0, 0], 'first-frame water is unchanged');
  for (let i = 0; i < fps * 9; i++) {
    shown = reveal.update(after, 1 / fps);
    const fog = reveal.amounts.value.x;
    for (const room of after.filter(room => before.includes(room))) assert(shown.includes(room), 'retained shore stays visible');
    if (shown.includes(added[0]) && enabledAt === null) {
      assert.equal(fog, 1, 'geometry appears only under completely opaque fog');
      enabledAt = i / fps;
    }
    if (enabledAt === null) assert(fog >= last, 'fog covers water continuously');
    else if (fog !== 1) assert(fog <= last, 'fog clears continuously after enabling the shore');
    assert(Math.abs(fog - last) < .17, 'no opacity step at supported frame rates');
    last = fog;
  }
  assert(enabledAt !== null);
  assert.deepEqual(shown, after);
  assert.deepEqual(reveal.amounts.value.toArray(), [0, 0], 'ordinary distance fog takes over');
  const destination = after.at(-1);
  assert.deepEqual(reveal.update([destination], 1 / fps), [destination], 'landing never re-hides its island');
  assert.deepEqual(reveal.amounts.value.toArray(), [0, 0]);
  const restored = new JourneyReveal();
  assert.deepEqual(restored.update(after, 0), after, 'resumed crossing has no artificial delay');
}
const slow = new JourneyReveal();
slow.update(['wood'], 0); slow.update(['wood', 'sleeping'], 0);
assert.deepEqual(slow.update(['wood', 'sleeping'], 10), ['wood', 'sleeping']);
assert.equal(slow.amounts.value.x, 1, 'a stalled frame must still reach full cover before release');
setJourneyRooms([]);
assert.deepEqual(journeyRooms.value.toArray(), [-2, -2], 'no visible rooms must not mean show every island');
console.log(`Journey reveal: ${cases.length} transitions at 10–120 Hz, full-cover handoff, continuous fog, landings and resumed starts passed (${tuning.world.arrivalFogClear}s release).`);
