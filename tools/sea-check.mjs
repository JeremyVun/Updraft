// Capture the complete sea passage with real simulation and verify the swimmer's framing, then the whale in the net:
// the pod's lead into the mist, the whale heard there, its blow seen and its shape coming out of it, the rest beside
// its head, its five steps played with real gestures as each is drawn (circles over the blowhole, strokes across its
// eye, the cork, the net on its head and the flipper), the spout, the flukes and the settled arrival at the mirror.
// Usage: node tools/sea-check.mjs [out-prefix]. BASE selects a stable dev server; W/H select the viewport (1600×900;
// 430×932 for a phone); VIDEO=1 records <prefix>.webm; AUDIO=1 records the release mix through the last deep call.
// Saves a camera trace and a JSON report.
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
  window.seaLog = { swimFrames: 0, clipped: 0, maxGap: 0, pullFrames: 0, pullClipped: 0, neckError: 0, voices: [], beats: [], last: '', actionable: {}, invitations: {} };
  const log = window.seaLog;
  const heard = g.sealife.sleeper.onSound;
  g.sealife.sleeper.onSound = (kind,x,y,z) => {
    log.voices.push({kind,time:__stats.time,at:[x,y,z],camera:g.rig.camera.position.toArray(),free:g.story.current.whale?.step==='free'});
    heard?.(kind,x,y,z);
  };
  const update = g.sealife.pod.update.bind(g.sealife.pod);
  g.sealife.pod.update = (dt, time) => {
    update(dt, time);
    const c = g.story.current;
    const w = c.whale;
    if (w?.asks && log.actionable[w.step] === undefined) log.actionable[w.step] = c.time;
    if (w && (w.offered || w.coax) && log.invitations[w.step] === undefined) log.invitations[w.step] = c.time - log.actionable[w.step];
    const beat = `${g.story.name}:${c.swim}:${c.whale?.step ?? ''}`;
    if (beat !== log.last) { log.beats.push({ beat, time: +c.time?.toFixed(1), boat: g.boat.position.toArray().map((v) => +v.toFixed(1)) }); log.last = beat; }
    if (c.swim === 'in' && c.swimT > 3) {
      const p = g.cygnet.position.clone().project(g.rig.camera);
      log.swimFrames++;
      if (Math.abs(p.x) > 0.82 || Math.abs(p.y) > 0.82 || p.z > 1) log.clipped++;
      // Out among the toys and back, never further from its place beside the hull than it dares.
      log.maxGap = Math.max(log.maxGap, g.cygnet.position.distanceTo(c.water.clone().setY(g.cygnet.position.y)));
    }
    if (w?.step === 'flipper' && ['pulling', 'clearing'].includes(w.bird)) {
      const p = g.cygnet.position.clone(); p.y += 0.3; p.project(g.rig.camera);
      log.pullFrames++;
      if (Math.abs(p.x) > 0.9 || Math.abs(p.y) > 0.9 || p.z > 1) log.pullClipped++;
      if(w.bird==='pulling') {
        const forward=p.set(0,0,1).transformDirection(g.cygnet.nodes[6].matrixWorld);
        const target=g.sealife.net.loopTie.clone().sub(g.cygnet.billTip(direction)).normalize();
        const angle=forward.angleTo(target);
        if(angle>log.neckError){log.neckError=angle;log.neckWorst={time:__stats.time,birdT:w.birdT,act:g.cygnet.mind.act,env:g.cygnet.drives.actEnv,working:g.cygnet.working,sleep:g.cygnet.poser.p.sleep,face:g.cygnet.watchFace,gaze:{...g.cygnet.drives.gaze},forward:forward.toArray(),target:target.toArray()};}
      }
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
  assert.ok(report.pullFrames > 120 && report.pullClipped === 0, 'The cygnet must stay fully visible throughout its pull');
  assert.ok(report.neckError < .55, `The cygnet twists away from the rope (${report.neckError} radians)`);
  for (const step of ['breath', 'eye', 'line', 'heave', 'flipper']) {
    assert.ok(report.invitations[step] <= 0.7, `${step} invitation took ${report.invitations[step]} seconds`);
  }
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
  if(process.env.AUDIO) await page.evaluate(async()=>{
    const sound=__game.sound;sound.start();await sound.ready;
    const capture=sound.ctx.createMediaStreamDestination();sound.master.connect(capture);
    window.seaAudio={recorder:new MediaRecorder(capture.stream),chunks:[]};
    seaAudio.recorder.ondataavailable=e=>seaAudio.chunks.push(e.data);
  });
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

  await wait('__game.story.current.time>7'); await shot('arrival');
  await wait("__game.sealife.pod.stunt?.phase==='act' && __game.sealife.pod.stunt.kind==='leap'");
  for (let i = 1; i <= 6; i++) { await shot(`leap-${i}`); await page.waitForTimeout(180); }
  await shot('open-water');
  await wait("['restless','side','in'].includes(__game.story.current.swim)", 90); await shot('curious');
  await wait("__game.story.current.swim==='side' && __game.story.current.swimT>0.65"); await shot('rail-out');
  await wait("__game.story.current.swim==='side' && __game.story.current.swimT>1.5"); await shot('rail-settled');
  await wait("__game.sealife.sleeper.called==='whale-moan'", 10); await shot('heard');
  await wait('__game.sealife.sleeper.sighting>=1', 10); await shot('blow');
  await wait("__game.story.current.swim==='in' && __game.story.current.swimT>4"); await shot('swim');
  await wait("__game.story.current.swim==='in' && __game.story.current.swimT>9"); await shot('alongside');
  await shot('shape');
  await wait("['drying','done'].includes(__game.story.current.swim)"); await shot('return');
  await wait("__game.story.current.swim==='drying' && __game.story.current.swimT>0.8"); await shot('rail-return');
  await wait("__game.story.current.swim==='done'"); await shot('together');
  const swim = await page.evaluate(() => window.seaLog);
  if (!swim.swimFrames || swim.clipped > 0 || swim.maxGap > 11.5) throw Error(JSON.stringify(swim));
  await wait(`${whale}.led`, 60); await shot('lead');
  await wait(`${whale}.step==='breath' && ${whale}.stepTime>3`, 90); await shot('beside');

  // Each step as a prompt player plays it: a go once its gesture is drawn, a still as each new step is reached.
  const tries = {};
  let step = 'breath';
  let loopShown = false;
  let pullShot = 0;
  const playUntil = Date.now() + 360_000;
  for (;;) {
    const now = await page.evaluate(() => __game.story.current.whale?.step);
    if (now !== step) { step = now; if (['eye', 'line', 'heave', 'flipper'].includes(step)) await shot(step); }
    if (step === 'free' || step === 'gone') break;
    if (!loopShown && step === 'flipper' && await page.evaluate(() => !!__game.story.current.whale.offered)) {
      await shot('flipper-held'); loopShown = true;
    }
    if (step === 'flipper' && pullShot < 3 && await page.evaluate((threshold) => __game.sealife.net.loop >= threshold, [0.15, 0.65, 1][pullShot])) {
      await shot(['flipper-pulling', 'flipper-tug', 'flipper-clear'][pullShot++]);
    }
    if (Date.now() > playUntil) throw Error(`The five steps never finished: at ${step}, ${JSON.stringify(tries)}`);
    if (!(await whaleGo(page, tries))) await page.waitForTimeout(250);
  }
  await away(page);
  if(process.env.AUDIO) await page.evaluate(()=>seaAudio.recorder.start());
  await wait('__game.sealife.sleeper.spouting', 30); await shot('spout');
  await wait('__game.sealife.sleeper.fluking && __game.sealife.sleeper.time>15', 60); await shot('flukes');
  await wait(`${whale}.step==='gone'`, 60); await shot('gone');
  if(process.env.AUDIO) {
    await wait(`${whale}.stepTime>8`, 20);
    const encoded=await page.evaluate(()=>new Promise(resolve=>{
      seaAudio.recorder.onstop=()=>{
        const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]);
        reader.readAsDataURL(new Blob(seaAudio.chunks,{type:'audio/webm'}));
      };seaAudio.recorder.stop();
    }));
    fs.writeFileSync(`${prefix}-release-audio.webm`,Buffer.from(encoded,'base64'));
  }
  await wait(`${whale}.stepTime>20`, 40); await shot('onward-sun');
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
  const report = { tries, swimFrames: log.swimFrames, clipped: log.clipped, maxGap: +log.maxGap.toFixed(2), pullFrames: log.pullFrames, pullClipped: log.pullClipped, neckError:log.neckError,neckWorst:log.neckWorst,voices:log.voices,beats: log.beats,
    invitations: log.invitations, ...health, errors };
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
