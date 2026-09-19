// Check checkpoint writes/restores, replay, storage failures and hidden-page audio in isolated Chrome.
// Usage: node tools/progress-check.mjs (BASE defaults to http://127.0.0.1:5230/; ONLY filters chapter/point).
// Evidence goes to /tmp. Run without another GPU capture or a live-reloading source tree.
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import assert from 'node:assert/strict';

const base = process.env.BASE ?? 'http://127.0.0.1:5230/';
const key = 'updraft.progress.v1';
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true,
  args: ['--enable-gpu', '--use-angle=metal', '--ignore-gpu-blocklist'] });
const report = { checkpoints: [], errors: [] };
try {
  checks: {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on('pageerror', e => report.errors.push(e.message));
  const ready = () => page.waitForFunction(() => window.__ready, null, { timeout: 60000 });
  const open = async query => { await page.goto(base + '?' + query); await ready(); };
  const read = () => page.evaluate(key => JSON.parse(localStorage.getItem(key)), key);
  const clear = () => page.evaluate(key => localStorage.removeItem(key), key);
  const state = () => page.evaluate(() => {
    const g = __game;
    return { chapter: g.story.name, beat: g.story.current.beat, point: g.story.current.checkpoint,
      child: g.child.position.toArray(), bird: g.cygnet.state, seat: g.cygnet.seat, busy: g.carry.busy,
      piano: g.story.current.atPiano, wave: g.life.regions.wave.toArray(), waiting: g.life.regions.waiting.toArray(),
      finished: g.story.current.finished ?? false };
  });
  await open('shot&progress=1');
  assert.equal((await read()).chapter, 'island');

  // Native story exits are arranged directly; the production Journey must notice and save them.
  const cases = [
    ['island', '', 'companion', `c.beat='leaving';c.restored=true;c.worldLife=1;g.life.regions.island.w=1;g.cygnet.rideIn('cradle');`],
    ['lines', 'washing', 'family', `const {FAMILY_LINE,door}=await import('/src/world/lines.ts');c.beat='walk';c.leg=2;c.play='hold';c.holdUntil=1e6;g.child.place(-4,Math.min(FAMILY_LINE.a.z,FAMILY_LINE.b.z)-15,Math.PI);door.open=1;`],
    ['boats', 'boats', 'pool-1', `c.restoreCheckpoint('pool-1',[33]);`],
    ['boats', 'boats', 'pool-2', `c.restoreCheckpoint('pool-2',[69]);`],
    ['meadow', 'piano', 'piano', `const {piano}=await import('/src/world/piano.ts');g.child.place(piano.stand.x,piano.stand.z,Math.PI);c.piano.give(g.child);c.beat='walk';c.leg=1;c.play='hold';c.holdUntil=1e6;c.wake(4,true);`],
    ['meadow', 'meadow', 'pond', `c.skipToCrest();c.crestDone=true;c.beat='walk';c.play='hold';c.holdUntil=1e6;g.cygnet.rideIn('satchel');`],
    ['birches', 'birches', 'swing', `const {BIRCHES_CLEARING:p}=await import('/src/world/birches.ts');g.child.place(p.x,p.y,Math.PI);c.beat='walk';c.swings=6;c.leg=3;c.play='hold';c.holdUntil=1e6;`],
    ['birches', 'birches', 'leaves', `const {BIRCH_PILES:p}=await import('/src/world/birches.ts');g.child.place(p[2].x,p[2].z,Math.PI);c.beat='walk';c.swings=6;c.played=true;c.leg=4;c.play='hold';c.holdUntil=1e6;`],
    ['drowned', 'drowned', 'sail', `c.beat='drift';c.stirred=true;c.leg=2;`],
    ['wood', 'wood', 'found', `c.beat='walk';c.bolted=true;c.leg=2;c.chainAt=55;`],
    ['wood', 'wood', 'dry', `c.beat='out';c.bolted=true;c.leg=4;c.chainAt=100;g.glider.visible=true;g.glider.soggy.value=0;`],
    ['sleeping', 'sleeping', 'feather', `c.beatStart=c.now-20;c.tuckIn(0);c.toFeather();c.beatStart=c.now-6;c.theFeather(0);g.cygnet.release(g.sleeping.feather.goal);c.looks=2;c.nextLook=c.now-1;c.theEdge();`],
    ['sleeping', 'sleeping', 'morning', `const {SLEEP_BERTH:p}=await import('/src/world/sleeping.ts');g.boat.beach(p.x,p.z,-1.76);g.child.place(g.sleeping.bedside.x,g.sleeping.bedside.z,0);g.cygnet.rideIn('cradle');c.moored=true;c.warmed=1;c.board();`],
    ['mirror', 'mirror', 'moon', `c.restoreCheckpoint('moon',[0]);`],
    ['mirror', 'mirror', 'tide', `c.restoreCheckpoint('tide',[1]);`],
    ['mirror', 'mirror', 'lantern', `c.restoreCheckpoint('lantern',[2]);`],
    ['toMirror', 'sea', 'swim', `c.swim='done';c.leg=4;c.time=100;g.cygnet.rideIn('cradle');`],
    ['home', 'summit', 'reunion', `c.onOver();g.cygnet.visible=false;`],
    ['home', 'summit', 'drawing', `c.skipToDrawing(0);c.beat='release';g.child.standUp();`],
    ['home', 'summit', 'complete', `c.beat='credits';c.finished=true;c.silence=true;g.child.visible=false;g.cygnet.visible=false;`],
  ];
  for (const [chapter, query, point, setup] of cases.filter(c=>!process.env.ONLY || (c[0]+'/'+c[2]).includes(process.env.ONLY))) {
    await clear();
    await open(`shot&progress=1${query ? '&chapter=' + query : ''}`);
    await page.evaluate(async setup => {
      const g = __game, c = g.story.current;
      g.child.stop();g.child.standUp();
      await new Function('g','c',`return (async()=>{${setup}})()`)(g,c);
    }, setup);
    try {
      await page.waitForFunction(({ key, point }) => JSON.parse(localStorage.getItem(key))?.point === point, { key, point }, { timeout: 15000 });
    } catch(e) { console.log(JSON.stringify({ failed: chapter+'/'+point, state: await state(), stored: await read() })); throw e; }
    const saved = await read();
    assert.equal(saved.chapter, chapter);
    assert(await page.evaluate(async()=> (await import('/src/story/progress.ts')).readProgress() !== null), 'save must validate: '+JSON.stringify(saved));
    await page.reload(); await ready();
    const restored = await state();
    assert.equal(restored.chapter, chapter);
    assert.equal((await read()).point, point, 'must not overwrite a restored checkpoint with entry');
    assert(restored.child.every(Number.isFinite));
    assert(Math.hypot(restored.child[0]-saved.child[0],restored.child[2]-saved.child[2])<4, 'resume at the saved place, allowing the first second of walking/sailing');
    assert(!restored.busy, 'arrival carry callback must not run after a POI restore');
    if (point === 'piano') {
      assert.match(restored.piano, /^done /);
      assert.deepEqual(restored.waiting, saved.life[2]);
      assert(restored.wave[2] >= saved.life[1][2]);
    }
    if (point === 'complete') assert(restored.finished);
    await page.screenshot({ path: `/tmp/updraft-progress-${chapter}-${point}.png` });
    report.checkpoints.push({ chapter, point, saved, restored });
    console.log(`ok ${chapter}/${point}`);
  }
  if(process.env.ONLY) break checks;

  // Island exits are crossing entries, and all chapter entries round-trip without carrying old callback closures.
  for (const chapter of ['island','toLines','lines','toMeadow','meadow','toBirches','birches','drowned','toWood','wood','toSleeping','sleeping','toMirror','mirror','toHarbour','toHome','home']) {
    const aliases={island:'',toLines:'crossing',lines:'washing',toMeadow:'washing',meadow:'meadow',toBirches:'meadow',birches:'birches',drowned:'drowned',toWood:'drowned',wood:'wood',toSleeping:'wood',sleeping:'sleeping',toMirror:'sea',mirror:'mirror',toHarbour:'mirror',toHome:'sea',home:'jetty'};
    await clear();await open('shot&progress=1&chapter='+aliases[chapter]);
    await page.evaluate(async chapter => {
      const g=__game;
      let at=null;
      if(chapter==='toMeadow') at=(await import('/src/story/lines.ts')).LINES_BERTH;
      if(chapter==='toBirches') at=(await import('/src/story/meadow.ts')).FAR_SHORE;
      if(chapter==='toWood') at={x:-18,z:-1640};
      if(chapter==='toHome') at=(await import('/src/world/sleeping.ts')).SLEEP_BERTH;
      if(chapter==='toHarbour') at=(await import('/src/world/sky-mirror-layout.ts')).MIRROR_BERTH;
      if(chapter==='toSleeping') at=(await import('/src/world/wood.ts')).WOOD_BERTH;
      if(at){g.story.sail(at.x,at.z-5,Math.PI);g.story.begin(chapter);}
    },chapter);
    await page.waitForFunction(({key,chapter})=>JSON.parse(localStorage.getItem(key))?.chapter===chapter,{key,chapter});
    const saved=await read();assert.equal(saved.point,'entry');
    await page.reload();await ready();assert.equal((await state()).chapter,chapter);
    report.checkpoints.push({chapter,point:'entry'});console.log(`ok ${chapter}/entry`);
  }

  const lastComplete=report.checkpoints.find(p=>p.point==='complete').saved;
  await page.evaluate(({key,save})=>localStorage.setItem(key,JSON.stringify(save)),{key,save:lastComplete});
  await open('shot&progress=1');await page.waitForTimeout(6200);
  await page.locator('#again').focus();
  await Promise.all([page.waitForEvent('framenavigated'),page.keyboard.press('Enter')]);await ready();
  assert.equal((await state()).chapter,'island');report.replay=true;

  const savedBefore=await read();await open('shot&chapter=wood');
  assert.equal((await state()).chapter,'wood');assert.deepEqual(await read(),savedBefore);report.qaIsolation=true;
  for(const corrupt of ['{broken','{"version":99}','{"version":1,"chapter":"__proto__","point":"entry"}']) {
    await page.evaluate(({key,value})=>localStorage.setItem(key,value),{key,value:corrupt});
    await open('shot&progress=1');assert.equal((await state()).chapter,'island');
  }
  report.corruptSaves=true;

  // A real AudioContext must stop advancing while visibility is hidden, and respect mute on return.
  await page.mouse.click(100,100);await page.evaluate(()=>__game.sound.start());
  await page.waitForFunction(()=>__game.sound.running);
  await page.evaluate(()=>{
    window.testHidden=true;Object.defineProperty(document,'hidden',{configurable:true,get:()=>window.testHidden});
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.waitForFunction(()=>__game.sound.ctx.state==='suspended');
  const paused=await page.evaluate(()=>({audio:__game.sound.ctx.currentTime,frame:__stats.frame}));
  await page.waitForTimeout(400);
  assert.deepEqual(await page.evaluate(()=>({audio:__game.sound.ctx.currentTime,frame:__stats.frame})),paused);
  await page.evaluate(()=>{testHidden=false;document.dispatchEvent(new Event('visibilitychange'));});
  await page.waitForFunction(()=>__game.sound.running);
  await page.evaluate(()=>{__game.sound.setMuted(true);testHidden=true;document.dispatchEvent(new Event('visibilitychange'));testHidden=false;document.dispatchEvent(new Event('visibilitychange'));});
  await page.waitForTimeout(150);
  assert.equal(await page.evaluate(()=>__game.sound.ctx.state),'suspended');
  await page.evaluate(()=>__game.sound.setMuted(false));await page.waitForFunction(()=>__game.sound.running);
  report.audio=true;

  const denied=await browser.newPage();
  await denied.addInitScript(()=>Object.defineProperty(window,'localStorage',{get(){throw new DOMException('Denied','SecurityError');}}));
  await denied.goto(base+'?shot&progress=1');await denied.waitForFunction(()=>window.__ready,null,{timeout:60000});
  report.storageDenied=true;await denied.close();
  console.log('ok replay, QA isolation, corrupt/unavailable storage, audio suspend/resume/mute');
  }
  assert.deepEqual(report.errors,[]);
} finally {
  fs.writeFileSync('/tmp/updraft-progress-check.json',JSON.stringify(report,null,2));
  await browser.close();
}
