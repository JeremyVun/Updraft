// Follow a complete real passage, its audio phases, mute/resume and release at the mirror.
// Usage: node tools/sea-score-browser-check.mjs (Vite on 5230, or BASE; holds the GPU browser lock).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { openBrowser } from './lib/browser.mjs';

const { browser, close } = await openBrowser();
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', error => errors.push(error.message));
  await page.goto((process.env.BASE ?? 'http://127.0.0.1:5230/') + '?shot&chapter=sea&ratio=1&msaa=2');
  await page.waitForFunction(() => window.__ready, null, { timeout: 60000 });
  await page.evaluate(() => {
    const g = __game;
    window.scoreLog = { phases: [], wrong: [], maxVoices: 0, chimes: 0, frames: 0 };
    const original = g.sound.update.bind(g.sound), chime = g.sound.chime.bind(g.sound);
    g.sound.chime = (...args) => { scoreLog.chimes++; chime(...args); };
    g.sound.update = (dt, state) => {
      original(dt, state);
      if (!g.sound.running) return;
      const score = g.sound.seaScore;
      if (score) window.lastSeaScore = score;
      const expected = g.story.current.seaScore ?? 'off', actual = score?.current?.phase ?? 'off';
      if (actual !== expected && scoreLog.wrong.length < 10) scoreLog.wrong.push({ expected, actual, state });
      if (scoreLog.phases.at(-1)?.phase !== actual) scoreLog.phases.push({ phase: actual,
        chapter: g.story.name, time: g.story.current.time, swim: g.story.current.swim });
      const voices = score ? [...score.parts].reduce((sum, part) => sum + part.voices.size, 0) : 0;
      scoreLog.maxVoices = Math.max(scoreLog.maxVoices, voices); scoreLog.frames++;
    };
    g.sound.start();
  });
  await page.waitForFunction(() => __game.sound.running && __game.sound.seaScore?.current?.phase === 'open');
  await page.evaluate(() => { window.beforeMute = __game.sound.seaScore; __game.sound.setMuted(true); });
  await page.waitForFunction(() => __game.sound.ctx.state === 'suspended');
  const frozen = await page.evaluate(() => __game.sound.ctx.currentTime);
  await page.waitForTimeout(250);
  assert.equal(await page.evaluate(() => __game.sound.ctx.currentTime), frozen, 'Mute freezes the phrase clock');
  await page.evaluate(() => __game.sound.setMuted(false));
  await page.waitForFunction(() => __game.sound.running);
  assert(await page.evaluate(() => __game.sound.seaScore === beforeMute), 'Unmute preserves the same phrase');
  await page.mouse.move(300, 400); await page.mouse.down();
  await page.mouse.move(850, 330, { steps: 18 }); await page.mouse.up();
  await page.waitForFunction(() => scoreLog.chimes > 0);
  await page.waitForFunction(() => __game.story.name === 'mirror' && !__game.sound.seaScore, null, { timeout: 240000 });
  await page.waitForFunction(() => lastSeaScore.parts.size === 0, null, { timeout: 10000 });
  const report = await page.evaluate(() => ({ ...scoreLog, stopped: lastSeaScore.stopped,
    remainingParts: lastSeaScore.parts.size }));
  assert.deepEqual(report.phases.map(p => p.phase), ['open', 'swim', 'return', 'arrival', 'off']);
  assert.deepEqual(report.wrong, [], 'Audio and actual story states stay aligned throughout');
  assert(report.stopped && report.remainingParts === 0 && report.maxVoices < 80, 'No surviving or unbounded score voices');
  assert.deepEqual(errors, []);
  fs.writeFileSync('/tmp/updraft-sea-score-browser.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally { await close(); }
