// Start screen checks in isolated Chrome. Run without another GPU capture.
// BASE may point to Vite dev or a production preview. Screenshots/report go to /tmp.
import { openBrowser } from './lib/browser.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const { browser, close } = await openBrowser({ allowAutoplay: false });
const report={checks:[],errors:[]};
const base=process.env.BASE ?? 'http://127.0.0.1:5230/';
const key='updraft.progress.v1';
const shot='?shot&start=1&progress=1';
const painting=/\/(src\/paintings|assets)\/[a-z]+-(land|port)(-[^/]+)?\.webp$/;
// With the room's painting Continue sits low in its quiet band; without it, centred.
const invitation=async(page,painted)=>{
 const {width:W,height:H}=page.viewportSize();
 assert.equal(await page.locator('#veil').evaluate(e=>e.classList.contains('painted')),painted,painted?'the painting shows':'no painting');
 const box=await page.locator('#begin').boundingBox();
 const finished=await page.locator('#veil').evaluate(e=>e.classList.contains('finished'));
 const stairs=await page.locator('.veil-painting[data-room="stairs"]').count()>0&&W/H>=4/3&&!finished;
 const reserve=H>=W ? .26 : stairs ? .14 : finished ? .22 : .18;
 const y=painted?H-Math.max(finished?220:stairs?120:160,reserve*H):H/2;
 assert(Math.abs(box.x+box.width/2-W/2)<1 && Math.abs(box.y+box.height/2-y)<1, `invitation centre ${box.y+box.height/2}, expected ${y}`);
 if(await page.locator('.start-over').count()){
  const over=await page.locator('.start-over').boundingBox();
  assert(Math.abs(over.y-(box.y+box.height/2+50))<1, `start over top ${over.y}, expected 50 px under the invitation's centre`);
 }
};
try {
 const context=await browser.newContext({viewport:{width:1440,height:900}});
 await context.addInitScript(()=>{const Native=window.AudioContext;window.__audio=[];window.AudioContext=class extends Native{constructor(...a){super(...a);window.__audio.push(this)}};});
 const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
 const ready=async()=>{
   await page.waitForSelector('#veil.ready',{timeout:60000});await page.waitForTimeout(950);
   // Shot mode deliberately defaults to silent. Set the preference behind the veil;
   // the actual keyboard/click Begin gesture must still create and unlock native audio.
   await page.locator('#sound').evaluate(button=>{if(button.dataset.on==='false')button.click()});
   assert.equal(await page.evaluate(()=>__audio.length),0,'sound preference must not start audio before Begin');
 };
 await page.addInitScript(() => {
   window.__bootFrames = [];
   let last = 0;
   const tick = now => {
     if (last) window.__bootFrames.push(now - last);
     last = now;
     if (!document.querySelector('#veil.ready')) requestAnimationFrame(tick);
   };
   requestAnimationFrame(tick);
 });
 await page.goto(base+shot);await ready();
 report.bootWorstFrameMs = await page.evaluate(() => Math.max(0, ...window.__bootFrames));
 assert(report.bootWorstFrameMs < Number(process.env.BOOT_MAX_MS ?? 500), `startup blocked the veil for ${report.bootWorstFrameMs} ms`);
 report.bootStrayPrograms = await page.evaluate(() => window.__stats?.bootStrayPrograms);
 assert.equal(report.bootStrayPrograms?.count, 0, `programs first used outside boot's settle step: ${report.bootStrayPrograms?.names.join(', ')}`);
 report.bootSteps = await page.evaluate(() => window.__stats?.bootSteps);
 assert.equal(report.bootSteps?.counted, report.bootSteps?.expected, `world construction took ${report.bootSteps?.counted} steps; update BUILD_STEPS in src/main.ts`);
 assert.equal(await page.locator('#begin').innerText(),'Begin');
 assert.match(await page.locator('.veil-painting').evaluate(e=>e.currentSrc),/island-land/,'Begin shows the Still island');
 await invitation(page,true);
 assert.equal(await page.locator('.start-over').count(),0,'Begin offers no start over');
 const before=await page.evaluate(()=>({pos:__game.child.position.toArray(),frame:window.__stats?.frame,audio:__audio.length,save:localStorage.getItem('updraft.progress.v1')}));
 await page.keyboard.press('m');await page.waitForTimeout(1500);
 assert.deepEqual(await page.evaluate(()=>({pos:__game.child.position.toArray(),frame:window.__stats?.frame,audio:__audio.length,save:localStorage.getItem('updraft.progress.v1')})),before);
 assert.equal(before.audio,0);assert.equal(before.save,null);
 await page.screenshot({path:'/tmp/updraft-start-desktop.png'});
 assert.match(await page.locator('#begin').evaluate(e=>getComputedStyle(e).cursor), /data:image\/svg\+xml/, 'browser-owned hollow cursor');
 const ambientBefore=await page.locator('.veil-wind [data-source=ambient] .wind-body').first().getAttribute('d');
 await page.waitForTimeout(350);
 assert.notEqual(await page.locator('.veil-wind [data-source=ambient] .wind-body').first().getAttribute('d'),ambientBefore);
 report.checks.push('ambient wind moves and changes shape');
 await page.mouse.move(330,450);
 await page.waitForTimeout(350);
 for(let i=0;i<28;i++) {await page.mouse.move(330+i*16,450-Math.sin(i/27*Math.PI)*80);await page.waitForTimeout(12)}
 assert.equal(await page.locator('.veil-wind [data-source=pointer]').count(),0, 'strokes leave no cursor trails');
 assert(await page.locator('.veil-colour').evaluate(e=>Math.hypot(new DOMMatrix(getComputedStyle(e).transform).m41,new DOMMatrix(getComputedStyle(e).transform).m42)>1), 'the whole backdrop responds to the stroke');
 await page.screenshot({path:'/tmp/updraft-start-wind.png'});
 await page.waitForTimeout(900);await page.screenshot({path:'/tmp/updraft-start-curl.png'});
 await page.waitForTimeout(2800);assert.equal(await page.locator('.veil-wind [data-source=pointer]').count(),0);
 report.checks.push('ready screen stays paused and silent; strokes only shift the backdrop; Begin low in the Still island painting');
 await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.id),'begin');
 await page.keyboard.press('Enter');
 try { await page.waitForFunction(()=>__audio.length===1&&__audio[0].state==='running'); }
 catch (error) {
   report.beginFailure = await page.evaluate(() => ({ audio: __audio.map(ctx => ctx.state),
     hidden: document.hidden, veil: document.querySelector('#veil')?.className,
     sound: document.querySelector('#sound')?.dataset.on, frame: window.__stats?.frame }));
   throw error;
 }
 await page.waitForSelector('#veil',{state:'detached'});
 assert(await page.evaluate(()=>__stats.frame>0&&!document.getElementById('view').inert));
 assert.equal(await page.locator('#sound').getAttribute('data-on'),'true');
 await page.screenshot({path:'/tmp/updraft-start-revealed.png'});
 report.checks.push('keyboard begins once with native audio running; veil removed and canvas enabled');
 await page.waitForTimeout(3000);
 report.playFirstDraws = await page.evaluate(() => window.__stats?.playFirstDraws);
 // A quality step to a new MSAA sample count first draws existing programs into it, so only new programs fail.
 assert.equal(report.playFirstDraws?.programs, 0, `programs first drawn in play: ${report.playFirstDraws?.names.join(', ')}`);
 // Stepping down switches effects off (bloom, the depth blur), whose other variants must have been drawn at boot too.
 for(const level of ['high','medium','low']){await page.evaluate(l=>__game.quality.setMode(l,performance.now()),level);await page.waitForTimeout(2500)}
 report.stepDownFirstDraws = await page.evaluate(() => window.__stats?.playFirstDraws);
 assert.equal(report.stepDownFirstDraws?.programs, 0, `programs first drawn stepping down: ${report.stepDownFirstDraws?.names.join(', ')}`);
 report.checks.push('stepping down to Low draws no program for the first time');
 await page.reload();await ready();assert.equal(await page.locator('#begin').innerText(),'Continue');
 await invitation(page,true);
 await page.route(painting,route=>route.abort());
 await page.reload();await ready();
 await invitation(page,false);
 assert.equal(await page.locator('.veil-painting').count(),0,'a painting that never decoded is never shown');
 await page.screenshot({path:'/tmp/updraft-start-unpainted.png'});
 await page.unroute(painting);
 report.checks.push('Continue low in the painting; centred, with start over under it, when the painting is blocked');
 await page.reload();await ready();
 await page.mouse.click(100,120);await page.waitForSelector('#veil',{state:'detached'});
 assert.equal(await page.evaluate(()=>__audio.length),1);
 const settled=async (label)=>{
   await page.waitForTimeout(3000);
   const stats=await page.evaluate(()=>({stray:window.__stats?.bootStrayPrograms,draws:window.__stats?.playFirstDraws}));
   report[label]={bootStrayPrograms:stats.stray,playFirstDraws:stats.draws};
   assert.equal(stats.stray?.count,0,`${label}: programs first used outside boot's settle step: ${stats.stray?.names.join(', ')}`);
   assert.equal(stats.draws?.programs,0,`${label}: programs first drawn in play: ${stats.draws?.names.join(', ')}`);
 };
 await settled('afterContinue');
 report.checks.push('checkpoint Continue and click anywhere');
 await page.evaluate(()=>localStorage.setItem('updraft.finished.v1','1'));
 await page.reload();await ready();
 await page.locator('.chapters-toggle').click();
 await page.locator('.chapter',{hasText:'Home'}).click();
 assert.equal(await page.evaluate(()=>__game.story.name),'home');
 await page.waitForSelector('#veil',{state:'detached'});
 assert.equal(await page.evaluate(()=>__audio[0].state),'running');
 await settled('afterPick');
 report.checks.push('a chapter pick starts its room with sound');
 await page.evaluate(key=>localStorage.removeItem(key),key);
 await page.goto(base+'?shot&progress=1&chapter=wood');
 await page.waitForFunction(()=>window.__ready,null,{timeout:60000});
 await page.goto(base+shot);await ready();assert(await page.locator('#veil').evaluate(e=>e.classList.contains('night')));
 await page.screenshot({path:'/tmp/updraft-start-night.png'});
 report.checks.push('night checkpoint uses dark veil');
 await page.emulateMedia({reducedMotion:'reduce'});await page.mouse.move(350,300);await page.mouse.move(500,330,{steps:16});
 assert.equal(await page.locator('.veil-wind [data-source=pointer]').count(),0);
 assert.equal(await page.locator('#begin span').evaluate(e=>getComputedStyle(e).animationName),'none');
 assert.equal(await page.locator('.veil-colour').evaluate(e=>getComputedStyle(e).transform),'none');
 await page.locator('#begin').focus();await page.keyboard.press('Space');await page.waitForSelector('#veil',{state:'detached'});
 report.checks.push('reduced motion disables wind and pulse; Space enters');
 await context.close();
 const mobile=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
 await mobile.addInitScript(()=>{const Native=window.AudioContext;window.__audio=[];window.AudioContext=class extends Native{constructor(...a){super(...a);window.__audio.push(this)}};});
 const phone=await mobile.newPage();phone.on('pageerror',e=>report.errors.push(e.message));
 await phone.route(painting,route=>route.abort());
 await phone.goto(base+'?start=1&progress=0');await phone.waitForSelector('#veil.ready',{timeout:60000});
 await invitation(phone,false);
 await phone.unroute(painting);
 await phone.goto(base+'?start=1&progress=0');await phone.waitForSelector('#veil.ready',{timeout:60000});await phone.waitForTimeout(1000);
 await invitation(phone,true);
 assert.match(await phone.locator('.veil-painting').evaluate(e=>e.currentSrc),/island-port/,'a phone gets the portrait painting');
 assert.equal(await phone.evaluate(()=>document.documentElement.scrollWidth),390);
 await phone.screenshot({path:'/tmp/updraft-start-phone.png'});
 assert.equal(await phone.locator('#veil-cursor').count(),0);
 const cdp=await mobile.newCDPSession(phone);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:80,y:350}]});
 for(let x=90;x<260;x+=10){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:350-(x-80)*.2}]});await phone.waitForTimeout(15)}
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 assert(await phone.locator('#veil').count());assert.equal(await phone.evaluate(()=>__audio.length),0);
 await phone.touchscreen.tap(180,510);await phone.waitForSelector('#veil',{state:'detached'});
 assert.equal(await phone.evaluate(()=>__audio[0].state),'running');
 report.checks.push('390px phone: Begin low in the portrait painting, centred when it is blocked; touch drag stirs without starting, tap starts with sound');
 await mobile.close();
 const fault=await browser.newContext();const failure=await fault.newPage();
 let blockedMain=0;
 // Vite appends ?t= after edits; fault injection must match the module regardless of that timestamp.
 await failure.route(url=>/\/assets\/main-[^/]+\.js$/.test(url.pathname)||url.pathname.endsWith('/src/main.ts'),route=>{
   blockedMain++;return route.abort();
 });
 await failure.goto(base);await failure.waitForSelector('#veil.ready',{timeout:20000});
 assert(blockedMain>0,'the fixture actually blocked the game module');
 assert.equal(await failure.locator('#begin').innerText(),'Try again');
 await failure.waitForTimeout(1000);await failure.screenshot({path:'/tmp/updraft-start-retry.png'});
 await failure.unrouteAll();await failure.locator('#begin').click();await failure.waitForSelector('#veil.ready',{timeout:60000});
 assert.equal(await failure.locator('#begin').innerText(),'Begin');
 report.checks.push('game bundle failure offers retry and retry recovers');await fault.close();
 const qa=await browser.newPage();await qa.goto(base+'?shot');await qa.waitForFunction(()=>window.__ready,null,{timeout:60000});
 assert.equal(await qa.locator('#veil').count(),0);report.checks.push('existing shot QA bypasses start screen');
 assert.deepEqual(report.errors,[]);
} finally {fs.writeFileSync('/tmp/updraft-start-check.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));await close()}
