// Real camera projection and DOM checks, plus desktop/phone captures on the secret shore.
// node tools/plane-indicator-check.mjs; BASE selects the local dev server. Outputs go to /tmp.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium } from 'playwright-core';
const lock = '/tmp/updraft-chromium.lock';
for (;;) {
  try { fs.mkdirSync(lock); fs.writeFileSync(`${lock}/pid`, String(process.pid)); break; }
  catch (error) {
    if (error.code !== 'EEXIST') throw error;
    let holder = 0;
    try { holder = Number(fs.readFileSync(`${lock}/pid`, 'utf8')); } catch {}
    let alive = true;
    if (holder) { try { process.kill(holder, 0); } catch { alive = false; } }
    if (holder && !alive) fs.rmSync(lock, { recursive: true, force: true });
    else await new Promise(resolve => setTimeout(resolve, 400));
  }
}
let browser;
const errors = [], report = [];
try {
  browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true, args: ['--enable-gpu', '--use-angle=metal', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(`${process.env.BASE ?? 'http://127.0.0.1:5230/'}?shot&chapter=washing`);
  await page.waitForFunction(() => window.__ready, null, { timeout: 60000 });
  await page.evaluate(() => {
    const g = __game, c = g.story.current;
    c.restoreCheckpoint('family', [8, 1]);
    g.child.place(240, -476, Math.PI);
    c.frame(); g.rig.cut(c.shot); g.rig.camera.updateMatrixWorld();
    // Named fixture: stop the story/camera/plane so each controlled bearing is stable.
    g.story.update = () => {}; g.rig.update = () => {};
    g.glider.update = () => { g.glider.group.position.copy(g.glider.position); };
    document.body.classList.remove('shot'); // Include the real corner controls in collision checks.
    window.placePlane = (x, y, behind = false) => {
      const camera = g.rig.camera, e = camera.projectionMatrix.elements;
      g.glider.held = false; g.glider.visible = true; g.glider.departing = null; c.beat = 'walk';
      g.glider.position.set(x * 30 / e[0], y * 30 / e[5], behind ? 30 : -30).applyMatrix4(camera.matrixWorld);
    };
  });
  async function state() {
    return page.evaluate(() => {
      const icon = document.getElementById('plane-indicator'), r = icon.getBoundingClientRect();
      const guide = document.getElementById('plane-guide').getBoundingClientRect();
      const m = new DOMMatrix(getComputedStyle(icon).transform);
      return { opacity: Number(getComputedStyle(icon).opacity), x: (r.left+r.right)/2, y: (r.top+r.bottom)/2,
        angle: Math.atan2(m.b,m.a), left:r.left,right:r.right,top:r.top,bottom:r.bottom,
        guide: {left:guide.left,right:guide.right,top:guide.top,bottom:guide.bottom},
        intercepts: getComputedStyle(icon).pointerEvents };
    });
  }
  async function settle() {
    await page.evaluate(() => new Promise(resolve => {
      const until = __stats.frame + 55;
      function tick() { if (__stats.frame >= until) resolve(); else requestAnimationFrame(tick); }
      tick();
    }));
  }
  for (const [name,width,height] of [['desktop',1440,900],['phone',390,844]]) {
    await page.setViewportSize({width,height});
    for (const [edge,x,y,behind] of [['top',0.3,1.8,false],['right',1.8,0,false],['bottom',0,-1.8,false],
      ['left',-1.8,0,false],['corner',1.8,-1.8,false],['behind-right',1,0,true],['behind-centre',0,0,true]]) {
      await page.evaluate(([x,y,behind])=>placePlane(x,y,behind),[x,y,behind]);
      await settle();
      const s = await state();
      assert(s.opacity>.8, `${name} ${edge}: indicator missing`);
      assert(s.left>=0 && s.right<=width && s.top>=0 && s.bottom<=height, `${name} ${edge}: clipped icon`);
      assert.equal(s.intercepts,'none','indicator must not intercept wind gestures');
      if(edge==='top') assert(Math.abs(s.y-s.guide.top)<1 && s.angle<0);
      if(edge==='right'||edge.startsWith('behind')) assert(Math.abs(s.x-s.guide.right)<1 && Math.abs(s.angle)<.001);
      if(edge==='bottom') assert(Math.abs(s.y-s.guide.bottom)<1 && s.angle>0);
      if(edge==='left') assert(Math.abs(s.x-s.guide.left)<1);
      const overlap = await page.evaluate(() => {
        const a=document.getElementById('plane-indicator').getBoundingClientRect();
        return ['sound','fullscreen'].some(id=>{const b=document.getElementById(id).getBoundingClientRect();
          return a.left<b.right && a.right>b.left && a.top<b.bottom && a.bottom>b.top;});
      });
      assert(!overlap, `${name} ${edge}: indicator covers controls`);
      if(edge==='top'||edge==='right') await page.screenshot({path:`/tmp/updraft-plane-indicator-${name}-${edge}.png`});
      report.push({name,edge,...s});
    }
    await page.evaluate(()=>placePlane(1.8,0));
    await settle();
    const beforeReturn = await page.locator('#plane-indicator').evaluate(icon=>icon.style.transform);
    await page.evaluate(()=>placePlane(-.2,0));
    await settle();
    const afterReturn = await page.locator('#plane-indicator').evaluate(icon=>icon.style.transform);
    assert.equal(beforeReturn,afterReturn,'fade out at the last edge, never jump across the screen');
    // A plane returning to the screen fades out, while all nonplayable states suppress it.
    for(const mode of ['onscreen','held','hidden','scripted','departing']) {
      await page.evaluate(mode=>{
        placePlane(0,1.8);
        const g=__game;
        if(mode==='onscreen')placePlane(0,0);
        if(mode==='held')g.glider.held=true;
        if(mode==='hidden')g.glider.visible=false;
        if(mode==='scripted')g.story.current.beat='push';
        if(mode==='departing')g.glider.departing=g.glider.position.clone().normalize();
      },mode);
      await settle();
      assert((await state()).opacity<.01,`${name} ${mode}: indicator should hide`);
    }
    // Just over the edge should be faint; fully outside should be clearly visible.
    await page.evaluate(height=>placePlane(0,1+12/(height/2)),height);
    await settle();
    const half=(await state()).opacity;
    assert(half>.38 && half<.48,`${name}: boundary fade ${half}`);
  }
  assert.deepEqual(errors,[]);
  fs.writeFileSync('/tmp/updraft-plane-indicator-report.json',JSON.stringify(report,null,2));
  console.log('PASS: desktop/phone edges, corners, behind-camera direction, resize, fades, held/hidden/scripted/departing suppression, controls and pointer pass-through.');
} finally {
  await browser?.close();
  fs.rmSync(lock,{recursive:true,force:true});
}
