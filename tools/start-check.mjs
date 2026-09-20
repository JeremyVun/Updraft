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
 assert.equal(await page.locator('#begin').innerText(),'Begin');
 const box=await page.locator('#begin').boundingBox();
 assert(Math.abs(box.x+box.width/2-720)<1 && Math.abs(box.y+box.height/2-450)<1, 'invitation centred');
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
 report.checks.push('ready screen stays paused and silent; strokes only shift the backdrop');
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
 await page.reload();await ready();assert.equal(await page.locator('#begin').innerText(),'Continue');
 await page.mouse.click(100,120);await page.waitForSelector('#veil',{state:'detached'});
 assert.equal(await page.evaluate(()=>__audio.length),1);
 report.checks.push('checkpoint Continue and click anywhere');
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
 await phone.goto(base+'?start=1&progress=0');await phone.waitForSelector('#veil.ready',{timeout:60000});await phone.waitForTimeout(1000);
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
 report.checks.push('390px phone: touch drag stirs without starting, tap starts with sound');
 await mobile.close();
 const fault=await browser.newContext();const failure=await fault.newPage();
 await failure.route('**/assets/main-*.js',route=>route.abort());
 await failure.route('**/src/main.ts',route=>route.abort());
 await failure.goto(base);await failure.waitForSelector('#veil.ready',{timeout:20000});
 assert.equal(await failure.locator('#begin').innerText(),'Try again');
 await failure.screenshot({path:'/tmp/updraft-start-retry.png'});
 await failure.unrouteAll();await failure.locator('#begin').click();await failure.waitForSelector('#veil.ready',{timeout:60000});
 assert.equal(await failure.locator('#begin').innerText(),'Begin');
 report.checks.push('game bundle failure offers retry and retry recovers');await fault.close();
 const qa=await browser.newPage();await qa.goto(base+'?shot');await qa.waitForFunction(()=>window.__ready,null,{timeout:60000});
 assert.equal(await qa.locator('#veil').count(),0);report.checks.push('existing shot QA bypasses start screen');
 assert.deepEqual(report.errors,[]);
} finally {fs.writeFileSync('/tmp/updraft-start-check.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));await close()}
