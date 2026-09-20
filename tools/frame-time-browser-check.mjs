// Drive the real game loop with controlled RAF intervals. All simulation and rendering stay real.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {openBrowser} from './lib/browser.mjs';
console.log('Waiting for exclusive GPU browser access.');
const {browser,close}=await openBrowser();
console.log('Checking bounded catch-up in Chrome/Metal.');
const report=[];
try{
 for(const chapter of ['lines','birches','wood','mirror']){
  const page=await browser.newPage({viewport:{width:800,height:600}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('Failed to load resource'))errors.push(m.text())});
  // Keep shot's probes and deterministic startup, but exercise the production elapsed-time branch.
  let patched=false;
  await page.route('**/src/main.ts*',async route=>{
   const response=await route.fetch();let body=await response.text();
   assert(body.includes('frameTiming(params.shot ? 1 / 60 : realDt)'));
   body=body.replace('frameTiming(params.shot ? 1 / 60 : realDt)','frameTiming(realDt)');
   patched=true;await route.fulfill({response,body});
  });
  await page.addInitScript(()=>{
   const raf=window.requestAnimationFrame.bind(window);
   window.requestAnimationFrame=cb=>{if(cb.name==='frame'){window.__nextFrame=cb;return 1}return raf(cb)};
   window.__drive=ms=>{window.__clock+=ms;const cb=window.__nextFrame;window.__nextFrame=null;cb(window.__clock)};
  });
  await page.goto((process.env.BASE??'http://127.0.0.1:5230/')+`?shot&chapter=${chapter}&ratio=.6&grass=.2&analytics=0`);
  await page.waitForFunction(()=>!!window.__nextFrame,null,{timeout:90000});
  assert(patched,'must exercise the real-time branch, not fixed shot time');
  await page.evaluate(()=>{window.__clock=performance.now()+1;window.__drive(1000/60)});
  const cases=await page.evaluate(async()=>{
   const g=window.__game,rows=[];
   let worldDts=[],windTicks=0,renders=0,bakes=0,terrain=0,audio=0;
   const wrap=(obj,key,fn)=>{const old=obj[key].bind(obj);obj[key]=(...a)=>{fn(...a);return old(...a)}};
   wrap(g.story,'update',dt=>worldDts.push(dt));wrap(g.wind,'substep',()=>windTicks++);
   wrap(g.water,'update',()=>renders++);wrap(g.grass,'bake',()=>bakes++);wrap(g.terrain,'update',()=>terrain++);wrap(g.sound,'update',()=>audio++);
   for(const fps of [60,59,30,20,15,10]){
    const before=__stats.time;worldDts=[];windTicks=0;renders=bakes=terrain=audio=0;
    const start=performance.now();
    for(let i=0;i<fps;i++)__drive(1000/fps);
    const elapsed=__stats.time-before;
    const vectors=[g.child.position,g.cygnet.position,g.glider.position,g.rig.camera.position];
    rows.push({fps,elapsed,worldSteps:worldDts.length,maxWorldDt:Math.max(...worldDts),windTicks,renders,bakes,terrain,audio,cpuMs:performance.now()-start,finite:vectors.every(v=>[v.x,v.y,v.z].every(Number.isFinite))});
    await new Promise(r=>setTimeout(r,0));
   }
   const beforeStall=__stats.time;__drive(2000);
   rows.push({stall:__stats.time-beforeStall,steps:__stats.simulationSteps});
   const beforeNext=__stats.time;__drive(1000/60);rows.push({afterStall:__stats.time-beforeNext});
   let hidden=true;Object.defineProperty(document,'hidden',{configurable:true,get:()=>hidden});
   const beforeHidden=__stats.time;__drive(10000);
   const stayedPaused=__stats.time===beforeHidden;
   hidden=false;const reset=performance.now();
   Object.defineProperty(performance,'now',{configurable:true,value:()=>reset});
   document.dispatchEvent(new Event('visibilitychange'));delete performance.now;window.__clock=reset;
   __drive(-1);const staleIgnored=__stats.time===beforeHidden;
   __drive(1+1000/60);rows.push({stayedPaused,staleIgnored,resumed:__stats.time-beforeHidden});
   delete document.hidden;
   return rows;
  });
  for(const r of cases){
   if(r.fps){
    assert(Math.abs(r.elapsed-1)<1e-8,JSON.stringify(r));assert(r.maxWorldDt<=1/30+1e-9);
    assert(Math.abs(r.windTicks-60)<=1,JSON.stringify(r));
    for(const key of ['renders','bakes','terrain','audio'])assert.equal(r[key],r.fps,`${key} must run once per frame`);
    assert(r.finite);if(r.fps===59)assert.equal(r.worldSteps,59);
   }else if('stall'in r){assert(Math.abs(r.stall-.1)<1e-8);assert.equal(r.steps,3)}
   else if('afterStall'in r)assert(Math.abs(r.afterStall-1/60)<1e-8);
   else {assert(r.stayedPaused&&r.staleIgnored);assert(Math.abs(r.resumed-1/60)<1e-8)}
  }
  assert.deepEqual(errors,[]);report.push({chapter,cases});console.log(JSON.stringify({chapter,cases}));await page.close();
 }
 fs.writeFileSync('/tmp/updraft-frame-time.json',JSON.stringify(report,null,2));
}finally{await close()}
