// DOM-only loading motif preview: block the game module, use software compositing (no WebGL workload).
import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--disable-gpu']});
try {
 for(const viewport of [{width:1280,height:800},{width:390,height:844}]) {
  const page=await browser.newPage({viewport, ...(viewport.width===390?{recordVideo:{dir:'/tmp/updraft-loading-video',size:viewport}}:{})});
  const delay=r=>r.fulfill({contentType:'application/javascript',body:'await new Promise(() => {});'});
  await page.route('**/assets/main-*.js',delay);await page.route('**/src/main.ts*',delay);
  await page.goto((process.env.BASE??'http://127.0.0.1:5231/')+'?analytics=0');
  await page.waitForTimeout(400);
  assert.equal(await page.locator('#veil').getAttribute('aria-busy'),'true');
  assert.equal(await page.locator('#begin').isEnabled(),false);
  assert.equal(await page.locator('.veil-loading').isVisible(),true);
  await page.screenshot({path:`/tmp/updraft-loading-${viewport.width}.png`});
  const animations=await page.locator('.veil-loading').evaluate(e=>e.getAnimations({subtree:true}).length);
  assert(animations>=5,'body, two feet and ripples must animate');
  const before=await page.locator('.cygnet-foot-near').evaluate(e=>getComputedStyle(e).transform);
  await page.waitForTimeout(350);
  const after=await page.locator('.cygnet-foot-near').evaluate(e=>getComputedStyle(e).transform);
  assert.notEqual(before,after,'paddle stroke must move');
  for(const [name,phase] of [['reach',0],['push',630]]) {
   await page.locator('.veil-loading').evaluate((e,phase)=>{for(const a of e.getAnimations({subtree:true})){a.pause();a.currentTime=phase}},phase);
   await page.locator('.veil-loading').screenshot({path:`/tmp/updraft-loading-${viewport.width}-${name}.png`});
  }
  await page.locator('.veil-loading').evaluate(e=>{for(const a of e.getAnimations({subtree:true}))a.play()});
  if(viewport.width===390)await page.waitForTimeout(3000);
  await page.emulateMedia({reducedMotion:'reduce'});
  assert.equal(await page.locator('.veil-loading svg').evaluate(e=>getComputedStyle(e).animationName),'none');
  assert.equal(await page.locator('.veil-loading').evaluate(e=>e.getAnimations({subtree:true}).length),0);
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.locator('#veil').evaluate(e=>e.classList.add('ready'));
  assert.equal(await page.locator('.veil-loading').evaluate(e=>e.getAnimations({subtree:true}).filter(a=>a instanceof CSSAnimation).length),0);
  const video=page.video();await page.close();
  if(video)await video.saveAs('/tmp/updraft-loading-paddle.webm');
 }
 console.log('Paddling motif: early loading visibility, desktop/portrait, moving feet, static reduced motion and stopped animations after ready passed.');
}finally{await browser.close()}
