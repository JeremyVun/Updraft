// Real piano gestures, then the existing crest fixture through flock departure, paddle and return.
// node tools/meadow-score-browser-check.mjs (Vite on 5230, or BASE; holds the shared GPU lock).
// Arranges the crest/boarding positions; this is not a continuous full-island playthrough.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { openBrowser } from './lib/browser.mjs';

const { browser, close } = await openBrowser();
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on('pageerror', e => errors.push(e.message));
  await page.goto((process.env.BASE ?? 'http://127.0.0.1:5230/') + '?shot&chapter=piano&ratio=1&msaa=2');
  await page.waitForFunction(() => window.__ready, null, { timeout: 60000 });
  await page.mouse.click(10, 10);
  await page.evaluate(() => {
    const g = __game;
    window.meadowAudio = { phases: [], wrong: [], pianoLeak: 0, frames: 0, chimes: 0, maxVoices: 0 };
    const original = g.sound.update.bind(g.sound), chime = g.sound.chime.bind(g.sound);
    g.sound.chime = (...args) => { meadowAudio.chimes++; chime(...args); };
    g.sound.update = (dt, state) => {
      original(dt, state);
      if (!g.sound.running) return;
      const score = g.sound.meadowScore, phase = score?.current?.phase ?? 'off';
      if (score) window.lastMeadowScore = score;
      if (phase !== (g.story.current.meadowScore ?? 'off')) meadowAudio.wrong.push({ phase, expected: g.story.current.meadowScore });
      if (g.story.current.piano?.at !== 'done' && score) meadowAudio.pianoLeak++;
      if (meadowAudio.phases.at(-1)?.phase !== phase) meadowAudio.phases.push({ phase, beat: g.story.current.beat,
        time: g.story.current.now, chapter: g.story.name });
      meadowAudio.maxVoices = Math.max(meadowAudio.maxVoices, score ? [...score.parts].reduce((n, p) => n + p.voices.size, 0) : 0);
      meadowAudio.frames++;
    };
    g.sound.start();
  });
  await page.waitForFunction(() => __game.piano.expect !== null, null, { timeout: 60000 });
  assert(await page.evaluate(() => !__game.sound.meadowScore && __game.sound.padGain.gain.value < .001),
    'The piano demonstration retains its musical space');
  for (let n = 0; n < 4; n++) {
    await page.waitForFunction(() => __game.piano.expect !== null, null, { timeout: 60000 });
    const { start, end, matched } = await page.evaluate(() => {
      const p = __game.piano, camera = __game.rig.camera;
      const points = [0, 1].map(t => {
        const v = p.guideAlong(t, p.keys.clone()).project(camera);
        return [(v.x + 1) * innerWidth / 2, (1 - v.y) * innerHeight / 2];
      });
      const forward = p.expect.at(-1) > p.expect[0];
      return { start: points[forward ? 0 : 1], end: points[forward ? 1 : 0], matched: p.matched };
    });
    await page.mouse.move(...start); await page.waitForTimeout(160);
    for (let i = 1; i <= 40; i++) {
      await page.mouse.move(start[0] + (end[0] - start[0]) * i / 40, start[1] + (end[1] - start[1]) * i / 40);
      await page.waitForTimeout(30);
    }
    await page.waitForFunction(count => __game.piano.matched === count, matched + 1, { timeout: 15000 });
    await page.waitForFunction(() => __game.piano.expect === null, null, { timeout: 15000 });
  }
  await page.waitForFunction(() => __game.story.current.piano.at === 'done' && __game.sound.meadowScore?.current.phase === 'walk', null, { timeout: 60000 });
  console.log('Four real piano gestures completed; Meadow score began after the duet.');
  await page.evaluate(() => { window.beforeMute = __game.sound.meadowScore; __game.sound.setMuted(true); });
  await page.waitForFunction(() => __game.sound.ctx.state === 'suspended');
  const frozen = await page.evaluate(() => __game.sound.ctx.currentTime);
  await page.waitForTimeout(250);
  assert.equal(await page.evaluate(() => __game.sound.ctx.currentTime), frozen, 'Mute freezes the score clock');
  await page.evaluate(() => __game.sound.setMuted(false));
  await page.waitForFunction(() => __game.sound.running);
  assert(await page.evaluate(() => __game.sound.meadowScore === beforeMute), 'Unmute preserves the phrase');
  await page.evaluate(() => __game.story.current.skipToCrest());
  await page.waitForFunction(() => __game.sound.meadowScore?.current.phase === 'flock', null, { timeout: 60000 });
  const beforeGesture = await page.evaluate(() => meadowAudio.chimes);
  await page.mouse.move(300, 440); await page.mouse.down();
  await page.mouse.move(850, 380, { steps: 24 }); await page.mouse.up();
  await page.waitForFunction(n => meadowAudio.chimes > n, beforeGesture);
  await page.waitForFunction(() => __game.sound.meadowScore?.current.phase === 'pond', null, { timeout: 60000 });
  await page.waitForFunction(() => __game.sound.meadowScore?.current.phase === 'return', null, { timeout: 60000 });
  console.log('Real flock departure and paddle selected the quiet score, then its return phrase.');
  await page.waitForFunction(() => __game.story.current.beat === 'walk', null, { timeout: 60000 });
  await page.evaluate(() => {
    const g = __game, beside = g.boat.boardingPoint(g.child.position.clone());
    g.child.place(beside.x, beside.z, g.boat.yaw); g.story.current.board();
  });
  await page.waitForFunction(() => !__game.sound.meadowScore && __game.sound.padGain.gain.value > .045, null, { timeout: 15000 });
  await page.waitForFunction(() => lastMeadowScore.parts.size === 0, null, { timeout: 10000 });
  const beforeExit = await page.evaluate(() => ({ chapter: __game.story.name, beat: __game.story.current.beat, stopped: lastMeadowScore.stopped }));
  assert.equal(beforeExit.chapter, 'meadow', 'The arrangement retires while still on Meadow');
  assert(['toBoat', 'push', 'aboard'].includes(beforeExit.beat));
  await page.evaluate(() => __game.story.begin('toBirches'));
  await page.waitForFunction(() => __game.sound.mood === 'birches' && !__game.sound.meadowScore);
  const report = await page.evaluate(() => ({ ...meadowAudio, remainingParts: lastMeadowScore.parts.size }));
  assert.deepEqual(report.phases.map(p => p.phase), ['off', 'walk', 'flock', 'pond', 'return', 'off']);
  assert.deepEqual(report.wrong, []); assert.equal(report.pianoLeak, 0);
  assert(report.maxVoices < 80 && report.remainingParts === 0 && beforeExit.stopped);
  assert.deepEqual(errors, []);
  fs.writeFileSync('/tmp/updraft-meadow-score-browser.json', JSON.stringify({ ...report, beforeExit }, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally { await close(); }
