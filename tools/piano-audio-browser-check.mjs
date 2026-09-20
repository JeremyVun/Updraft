// Actual game-loop audio handover on the piano approach. Uses the shared GPU lock.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { openBrowser } from './lib/browser.mjs';

const { browser, close } = await openBrowser();
try {
  const page = await browser.newPage({ viewport: { width: 1024, height: 640 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto((process.env.BASE ?? 'http://127.0.0.1:5230/') + '?shot&chapter=piano');
  await page.waitForFunction(() => window.__ready, null, { timeout: 90000 });
  await page.evaluate(() => {
    const g = __game; g.sound.start();
    window.pianoAudio = [];
    const update = g.sound.update.bind(g.sound);
    g.sound.update = (dt, state) => {
      update(dt, state);
      const stop = g.story.current.piano;
      pianoAudio.push({ time: stop.now, beat: stop.at, mix: state.piano, hush: state.hush,
        pad: g.sound.padGain.gain.value, notes: g.piano.log.length,
        firstKey: g.piano.log.find(n => n.src === 'child') ?? null,
        demo: g.piano.expect !== null });
    };
  });
  await page.waitForFunction(() => pianoAudio.some(s => s.demo), null, { timeout: 90000 });
  const report = await page.evaluate(() => ({ states: pianoAudio, notes: __game.piano.log }));
  assert(report.states.some(s => s.beat === 'walking'), 'Observed real approach');
  assert(report.states.filter(s => ['walking','looking'].includes(s.beat)).every(s => s.mix === 0), 'Music stays through the approach');
  const demonstration = report.states.find(s => s.demo);
  const firstKey = report.notes.find(n => n.src === 'child');
  assert(firstKey, 'The child actually sounds the first key');
  const handover = report.states.find(s => s.time >= firstKey.t);
  assert(handover.mix > 0.6 && handover.mix < 0.96 && handover.pad > 0.001,
    'The first key overlaps a quiet remaining background');
  assert(demonstration.mix > 0.999 && demonstration.pad < 0.001, 'Background has faded by the demonstration');
  assert(report.states.every(s => s.hush < 0.01), 'No duplicate chapter hush during the piano fade');
  assert.equal(errors.length, 0, errors.join('\n'));
  fs.writeFileSync('/tmp/updraft-piano-audio-browser.json', JSON.stringify(report, null, 2));
  console.log('Real piano approach retains music, fades at the stool and clears the demonstration. /tmp/updraft-piano-audio-browser.json');
} finally { await close(); }
