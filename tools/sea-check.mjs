// Capture the complete sea passage with real simulation and verify the swimmer's framing, then the whale in the net:
// the pod's lead into the mist, the whale heard there, its blow seen and its shape coming out of it, the rest beside
// its head, its five steps played with real gestures as each is drawn (circles over the blowhole, strokes across its
// eye, the cork, the net on its head and the flipper), the spout, the flukes and the settled arrival at the mirror.
// Usage: node tools/sea-check.mjs [out-prefix]. BASE selects a stable dev server; W/H select the viewport (1600×900;
// 430×932 for a phone); VIDEO=1 also records <prefix>.webm. Saves a camera trace and a JSON report.
// Reuses the machine-wide GPU lock. All captures belong in /tmp.
import { openBrowser } from './lib/browser.mjs';
import { away, whaleGo } from './lib/whale-gestures.mjs';
import fs from 'node:fs';
import assert from 'node:assert/strict';

const prefix = process.argv[2] ?? '/tmp/updraft-sea';
const base = process.env.BASE ?? 'http://127.0.0.1:5230/';
const width = Number(process.env.W ?? 1600), height = Number(process.env.H ?? 900);

function observe() {
  const g = __game;
  window.seaTrace = [];
  const direction = g.rig.camera.position.clone();
  let frame = -1;
  const trace = () => {
    if (__stats.frame !== frame) {
      frame = __stats.frame;
      const camera = g.rig.camera;
      camera.getWorldDirection(direction);
      window.seaTrace.push([__stats.time, ...camera.position.toArray(), ...direction.toArray(), g.story.current.whale?.step ?? '', g.story.name]);
    }
    requestAnimationFrame(trace);
  };
  trace();
  window.seaLog = { swimFrames: 0, clipped: 0, maxGap: 0, beats: [], last: '' };
  const log = window.seaLog;
  const update = g.sealife.pod.update.bind(g.sealife.pod);
  g.sealife.pod.update = (dt, time) => {
    update(dt, time);
    const c = g.story.current;
    const beat = `${g.story.name}:${c.swim}:${c.whale?.step ?? ''}`;
    if (beat !== log.last) { log.beats.push({ beat, time: +c.time?.toFixed(1), boat: g.boat.position.toArray().map((v) => +v.toFixed(1)) }); log.last = beat; }
    if (c.swim === 'in' && c.swimT > 3) {
      const p = g.cygnet.position.clone().project(g.rig.camera);
      log.swimFrames++;
      if (Math.abs(p.x) > 0.82 || Math.abs(p.y) > 0.82 || p.z > 1) log.clipped++;
      // Out among the toys and back, never further from its place beside the hull than it dares.
      log.maxGap = Math.max(log.maxGap, g.cygnet.position.distanceTo(c.water.clone().setY(g.cygnet.position.y)));
    }
  };
}

function assertHealthy(report) {
  assert.deepEqual(report.errors, [], 'Browser errors during the sea passage');
  assert.equal(report.bootStrayPrograms?.count, 0, 'Unexpected shader compilation after warmup');
  assert.equal(report.playFirstDraws?.programs, 0, 'Previously unwarmed shader programs drawn during play');
  assert.equal(report.mirror.handed, true, 'Mirror did not inherit the sea camera');
  assert.ok(report.mirror.arrived >= report.mirror.arriveFor + 3, 'Mirror arrival was not fully observed');
  assert.equal(report.mirror.carry, false, 'Mirror camera is still in its arrival transition');
}

const { browser, close } = await openBrowser();
const videoDir = process.env.VIDEO ? fs.mkdtempSync('/tmp/updraft-video-') : null;
const context = await browser.newContext({
  viewport: { width, height }, deviceScaleFactor: 1,
  ...(videoDir ? { recordVideo: { dir: videoDir, size: { width, height } } } : {}),
});
const errors = [];
try {
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto(`${base}?shot=1&chapter=sea&ratio=1&msaa=2`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 90000 });
  await page.evaluate(`(${observe.toString()})()`);
  const shot = async (name) => { await page.screenshot({ path: `${prefix}-${name}.png` }); console.log(`${prefix}-${name}.png`); };
  // Timed in game seconds: with `shot` the game steps 1/60 s a frame, so on a loaded machine it runs slower than the wall.
  const wait = async (condition, seconds = 60) => {
    const met = await page.evaluate(([condition, seconds]) => new Promise((resolve, reject) => {
      const g = __game, start = __stats.time;
      const timer = setTimeout(() => reject(new Error(`Sea capture stalled: ${condition}`)), 300_000);
      const done = (result) => { clearTimeout(timer); resolve(result); };
      const tick = () => {
        if (eval(condition)) return done(true);
        const c = g.story.current;
        if (__stats.time - start > seconds) return done({ chapter: g.story.name, time: __stats.time, swim: c.swim, whale: c.whale?.step });
        requestAnimationFrame(tick);
      };
      tick();
    }), [condition, seconds]);
    if (met !== true) throw new Error(`Sea capture timed out: ${condition} ${JSON.stringify(met)}`);
  };
  const whale = '__game.story.current.whale';

  await wait('__game.story.current.time>12'); await shot('arrival');
  await wait("__game.sealife.pod.stunt?.phase==='act' && __game.sealife.pod.stunt.kind==='leap'");
  for (let i = 1; i <= 6; i++) { await shot(`leap-${i}`); await page.waitForTimeout(180); }
  await wait('__game.story.current.time>24'); await shot('open-water');
  await wait("['restless','side','in'].includes(__game.story.current.swim)", 90); await shot('curious');
  await wait("__game.story.current.swim==='in' && __game.story.current.swimT>4"); await shot('swim');
  await wait("__game.story.current.swim==='in' && __game.story.current.swimT>9"); await shot('alongside');
  await wait("['drying','done'].includes(__game.story.current.swim)"); await shot('return');
  await wait("__game.story.current.swim==='done'"); await shot('together');
  const swim = await page.evaluate(() => window.seaLog);
  if (!swim.swimFrames || swim.clipped > 0 || swim.maxGap > 11.5) throw Error(JSON.stringify(swim));
  await wait(`${whale}.led`, 60); await shot('lead');
  await page.waitForTimeout(3000); await shot('heard');
  await wait(`${whale}.sighs>=2`, 40); await page.waitForTimeout(3500); await shot('blow');
  await wait(`${whale}.remaining()<60`, 40); await shot('shape');
  await wait(`${whale}.step==='breath' && ${whale}.stepTime>3`, 90); await shot('beside');

  // Each step as a prompt player plays it: a go once its gesture is drawn, a still as each new step is reached.
  const tries = {};
  let step = 'breath';
  const playUntil = Date.now() + 360_000;
  for (;;) {
    const now = await page.evaluate(() => __game.story.current.whale?.step);
    if (now !== step) { step = now; if (['eye', 'line', 'heave', 'flipper'].includes(step)) await shot(step); }
    if (step === 'free' || step === 'gone') break;
    if (Date.now() > playUntil) throw Error(`The five steps never finished: at ${step}, ${JSON.stringify(tries)}`);
    if (!(await whaleGo(page, tries))) await page.waitForTimeout(250);
  }
  await away(page);
  await wait('__game.sealife.sleeper.spouting', 30); await shot('spout');
  await wait('__game.sealife.sleeper.fluking && __game.sealife.sleeper.time>15', 60); await shot('flukes');
  await wait(`${whale}.step==='gone'`, 60); await shot('gone');
  await wait("__game.story.name==='mirror'", 150); await shot('mirror-arrival');
  await wait("__game.story.name==='mirror' && __game.story.current.arrived>=__game.tuning.skyMirror.arriveFor+3", 20);
  await shot('mirror-settled');
  const log = await page.evaluate(() => window.seaLog);
  const health = await page.evaluate(() => ({
    bootStrayPrograms: __stats.bootStrayPrograms,
    playFirstDraws: __stats.playFirstDraws,
    mirror: { handed: __game.story.current.handed != null, arrived: __game.story.current.arrived,
      arriveFor: __game.tuning.skyMirror.arriveFor, carry: __game.story.current.shot.carry },
  }));
  const report = { tries, swimFrames: log.swimFrames, clipped: log.clipped, maxGap: +log.maxGap.toFixed(2), beats: log.beats, ...health, errors };
  fs.writeFileSync(`${prefix}-trace.json`, JSON.stringify(await page.evaluate(() => window.seaTrace)));
  fs.writeFileSync(`${prefix}-report.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
  if (videoDir) {
    const video = page.video();
    await context.close();
    fs.renameSync(await video.path(), `${prefix}.webm`);
    fs.rmSync(videoDir, { recursive: true, force: true });
    console.log(`${prefix}.webm`);
  }
  assertHealthy(report);
} finally {
  await close();
  if (errors.length) console.log(`page errors:\n${[...new Set(errors)].slice(0, 4).join('\n')}`);
}
