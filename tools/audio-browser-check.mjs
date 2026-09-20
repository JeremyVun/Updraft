// Real game-loop audio wiring, gesture gates, checkpoint mood and material hooks.
// Usage: node tools/audio-browser-check.mjs (dev server required; holds the GPU browser lock).
// Arranged chapter fixtures, not a continuous playthrough or listening sign-off.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { openBrowser } from './lib/browser.mjs';

const { browser, close } = await openBrowser();
const report = { chapters: [], errors: [] };
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on('pageerror', e => report.errors.push(e.message));
  await page.goto((process.env.BASE ?? 'http://127.0.0.1:5230/') + '?shot&chapter=lines');
  await page.waitForFunction(() => window.__ready, null, { timeout: 60000 });
  await page.mouse.click(1100, 700);
  await page.evaluate(async () => {
    const g = __game;
    g.sound.start();
    window.audioStates = [];
    window.materials = [];
    const original = g.sound.update.bind(g.sound);
    g.sound.update = (dt, state) => {
      audioStates.push(structuredClone(state));
      if (audioStates.length > 120) audioStates.shift();
      original(dt, state);
    };
    const url = performance.getEntriesByType('resource').findLast(r => new URL(r.name).pathname === '/src/audio/foley.ts').name;
    const { Foley } = await import(url);
    const material = Foley.prototype.material;
    Foley.prototype.material = function (...args) { materials.push(args); return material.apply(this, args); };
  });
  await page.waitForFunction(() => __game.sound.running);
  for (const name of ['lines', 'boats', 'meadow', 'birches', 'wood', 'sleeping', 'toMirror', 'mirror', 'toLines', 'home']) {
    await page.evaluate(name => {
      if (__game.story.name !== name) __game.story.begin(name);
      audioStates.length = 0; materials.length = 0;
    }, name);
    await page.waitForFunction(() => audioStates.length >= 6);
    const state = await page.evaluate(() => ({ name: __game.story.name, audio: audioStates.at(-1), sounds: materials,
      boatsScore: !!__game.sound.boatsScore, boatsVoices: __game.sound.boatsScore?.voices.size ?? 0,
      seaScore: __game.sound.seaScore?.current?.phase,
      sleepingScore: __game.sound.sleepingScore?.current?.phase }));
    if (name === 'boats') {
      assert.equal(state.audio.music, 'boats', 'Little Boats selects its approved composition');
      assert(state.boatsScore && state.boatsVoices > 0, 'Little Boats starts sounding in the real game loop');
    } else assert.equal(state.boatsScore, false, `${name}: Little Boats score cannot leak into another chapter`);
    if (name === 'toMirror') assert.equal(state.seaScore, state.audio.seaScore, 'Long crossing receives its live arrangement');
    else assert.equal(state.seaScore, undefined, `${name}: long sea arrangement cannot leak into other chapters`);
    if (name === 'sleeping') assert.equal(state.sleepingScore, 'shelter', 'Sleeping enters its approved bedside arrangement');
    else assert.equal(state.sleepingScore, undefined, `${name}: Sleeping arrangement cannot leak into another chapter`);
    for (const field of ['land', 'sea', 'meadow', 'cold']) assert(Number.isFinite(state.audio[field]), `${name}: finite ${field}`);
    for (const source of [state.audio.cygnet, state.audio.flock]) {
      assert(Number.isFinite(source.pan) && Number.isFinite(source.distance), `${name}: valid positioned source`);
    }
    if (name !== 'meadow') assert.equal(state.audio.meadow, 0, `${name}: no meadow habitat`);
    report.chapters.push(state);
  }
  report.whales = [];
  for (const name of ['toLines', 'toMirror']) {
    await page.evaluate(name => {
      __game.story.begin(name);
      __game.story.current.time = __game.story.current.nextWhale - 0.001;
      __game.story.update(0, 0);
      __game.rig.cut(__game.story.shot);
      materials.length = 0;
    }, name);
    await page.waitForFunction(() => __game.story.current.whaleCalled && __game.sealife.body.active);
    const sounds = await page.evaluate(() => {
      // The chapter triggers its normal whale; advance its actual body/wake through the surfacing.
      const g = __game, start = g.sealife.body.time;
      for (let t = 0; t < 32; t += 1 / 60) g.sealife.update(1 / 60, 1000 + start + t);
      return materials.filter(([kind]) => kind.startsWith('whale-'));
    });
    assert.deepEqual(sounds.map(([kind]) => kind),
      ['whale-surface', 'whale-blow', 'whale-blow', 'whale-drain', 'whale-dive'],
      `${name}: all five whale events reach production foley`);
    assert(sounds.every(([, level, pan]) => level > 0.015 && Number.isFinite(pan)), `${name}: whale is audible and positioned`);
    report.whales.push({ name, sounds });
  }
  await page.evaluate(() => __game.sound.setMuted(true));
  await page.waitForFunction(() => !__game.sound.running);
  await page.evaluate(() => {
    materials.length = 0;
    __game.sealife.surfaceWhale(__game.boat.position, __game.boat.yaw);
    for (let t = 0; t < 32; t += 1 / 60) __game.sealife.update(1 / 60, 2000 + t);
  });
  assert.equal(await page.evaluate(() => materials.length), 0, 'Muted marine movement cannot schedule sounds');
  await page.evaluate(() => __game.sound.setMuted(false));
  await page.waitForFunction(() => __game.sound.running);
  assert.equal(await page.evaluate(() => materials.filter(([kind]) => kind.startsWith('whale-')).length),
    0, 'Unmuting cannot replay a completed surfacing');
  await page.evaluate(() => {
    __game.story.begin('sleeping');
    __game.story.current.restoreCheckpoint('morning');
    audioStates.length = 0;
  });
  await page.waitForFunction(() => audioStates.length >= 4);
  assert.equal(await page.evaluate(() => audioStates.at(-1).music), 'sea');
  assert.equal(await page.evaluate(() => __game.sound.seaScore), null, 'Sleeping morning does not borrow the long-crossing score');
  assert.equal(await page.evaluate(() => __game.sound.sleepingScore.current.phase), 'morning', 'Restoring morning selects the approved warm answer');
  // A real pointer sweep through a playable wood fixture must be reflected by the audio state.
  await page.evaluate(() => {
    __game.story.begin('wood');
    __game.story.current.restoreCheckpoint('dry', [4, 100]);
    window.chimes = [];
    const original = __game.sound.chime.bind(__game.sound);
    __game.sound.chime = (...args) => { chimes.push(args); return original(...args); };
    audioStates.length = 0;
  });
  await page.waitForFunction(() => !__game.story.current.scripted);
  await page.mouse.move(400, 430); await page.mouse.down();
  await page.mouse.move(900, 380, { steps: 24 }); await page.mouse.up();
  await page.waitForFunction(() => chimes.length > 0);
  assert(await page.evaluate(() => audioStates.some(s => s.gust > 0.6 && !s.scripted)), 'gesture wind reaches the audio state');
  assert.equal(report.errors.length, 0, report.errors.join('\n'));
  fs.writeFileSync('/tmp/updraft-audio-browser.json', JSON.stringify(report, null, 2));
  console.log('Game-loop audio passed in 10 chapters; both whale crossings, mute/resume, morning restore and real wind gesture passed. /tmp/updraft-audio-browser.json');
} finally { await close(); }
