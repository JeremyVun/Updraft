import assert from 'node:assert/strict';
import { FramePacer } from '../src/gl/frame-pacer.ts';

for (const rate of [30, 60]) for (const hz of [30, 59.94, 60, 90, 120, 144]) {
  const pacer = new FramePacer(); pacer.reset(0);
  const count = Math.round(hz * 60), frames = [], quality = [];
  for (let i = 1; i <= count; i++) {
    const now = i * 1000 / hz;
    if (pacer.due(now, rate)) { frames.push(now); quality.push(pacer.intervalMs); }
  }
  const fps = frames.length / 60;
  assert(Math.abs(fps - Math.min(rate, hz)) < .1, `${hz} Hz, ${rate} cap: ${fps} fps`);
  if (hz >= rate) assert(Math.max(...quality) <= 1000 / rate + .01, 'intentional waits cannot cause quality reductions');
  if (hz < rate) assert(Math.min(...quality) >= 1000 / hz - .01, 'real overload must reach the governor');
  assert(Math.max(...frames.slice(1).map((t, i) => t - frames[i])) <= 1000 / rate + 1000 / hz + .01);
}
const pacer = new FramePacer(); pacer.reset(0);
assert(!pacer.due(1000 / 120, 60));
assert(pacer.due(1000 / 60, 60));
assert(pacer.due(2000, 60)); assert.equal(pacer.intervalMs, 2000 - 1000 / 60);
assert(!pacer.due(2000 + 1000 / 120, 60), 'no catch-up render after a stall');
assert(pacer.due(2000 + 1000 / 60, 60));
pacer.reset(10000);
assert(pacer.due(10000 + 1000 / 60, 60));
assert(Math.abs(pacer.intervalMs - 1000 / 60) < 1e-8, 'hidden time is not overload');
pacer.reset(20000);
assert(!pacer.due(20000 + 1000 / 120, 30));
assert(pacer.due(20000 + 1000 / 30, 30)); assert(Math.abs(pacer.intervalMs - 1000 / 30) < 1e-8);
assert(!pacer.due(20000 + 1000 / 30 + 1000 / 120, 60));
assert(pacer.due(20050, 60)); assert(Math.abs(pacer.intervalMs - 1000 / 60) < 1e-8);
console.log('30/60 fps pacing at 30–144 Hz, governor timing, stalls, resume and mode switches passed.');
