// Real pointer sweeps through the washing, doorway, pulley and departure.
// BASE=http://127.0.0.1:5243 W=1440 H=900 OUT=/tmp/... node tools/rotary-washing-browser-check.mjs
// FULL=1 starts at the arrival and opens the first two curtains normally. REVERSE=1 tests an opposing sweep first.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { openBrowser } from './lib/browser.mjs';
import { openRotary } from './lib/rotary-gesture.mjs';
import { watchFamilyVisibility, checkFamilyVisibility } from './lib/family-visibility.mjs';
import { withoutHotReload } from './lib/vite-client-stub.mjs';
const width=Number(process.env.W??1440),height=Number(process.env.H??900);
const touchMode=!!process.env.TOUCH;
const out=process.env.OUT??fs.mkdtempSync('/tmp/updraft-rotary-browser-');
fs.mkdirSync(out,{recursive:true});
const {browser,close}=await openBrowser();
let page;
const errors=[];
let reviewTimer, reviewPending=Promise.resolve(), reviewBusy=false, reviewFrame=0;
async function stopReview() {
  clearInterval(reviewTimer);
  await reviewPending;
  if (process.env.REVIEW && page && !page.isClosed()) {
    fs.appendFileSync(`${out}/review-camera.jsonl`, await page.evaluate(() => window.__cameraTrace.splice(0).map(r=>JSON.stringify(r)).join('\n')+'\n'));
  }
}
try {
  page=await browser.newPage({viewport:{width,height},hasTouch:touchMode,
    ...(process.env.VIDEO ? {recordVideo:{dir:out,size:{width,height}}} : {})});
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('favicon'))errors.push(m.text());});
  await withoutHotReload(page);
  await page.goto(`${process.env.BASE??'http://127.0.0.1:5243/'}?shot&chapter=${process.env.CROSSING?'crossing':process.env.FULL?'washing':'rotary'}&progress=0&ratio=1`);
  await page.waitForFunction(()=>window.__ready,null,{timeout:60000});
  await watchFamilyVisibility(page);
  await page.evaluate(() => {
    const r = __game.rotaryWashing, update = r.update.bind(r), sound = r.onSound;
    window.__rotarySounds = []; window.__rotaryTrace = [];
    r.onSound = (kind, at) => { window.__rotarySounds.push({ kind, time: __stats.time }); sound?.(kind, at); };
    r.update = (dt, wind) => {
      update(dt, wind);
      if (r.active) window.__rotaryTrace.push({ time: __stats.time, dt,
        rotors: r.rotors.map(f => ({ angle: f.angle, speed: f.speed, unhook: f.unhook, aligned: f.aligned })) });
    };
  });
  if(process.env.REVIEW) {
    fs.mkdirSync(`${out}/frames`,{recursive:true});
    await page.evaluate(()=>{
      const g=__game,rig=g.rig,original=rig.update.bind(rig),r=v=>v?[+v.x.toFixed(3),+v.y.toFixed(3),+v.z.toFixed(3)]:null;
      let label='';window.__cameraTrace=[];
      rig.update=(dt,time,shot,pace,hold)=>{
        original(dt,time,shot,pace,hold);
        const now=g.story.name+'/'+g.story.current.beat+'/'+g.story.current.gate;
        window.__cameraTrace.push({t:+time.toFixed(4),dt,...(now!==label?{at:(label=now)}:{}),eye:r(rig.camera.position),look:r(rig.look),
          target:r(shot.target),child:r(g.child.position),bird:r(g.cygnet.position),
          fit:+rig.fitBack.toFixed(3),pull:+rig.pull.toFixed(3),lift:+rig.lift.toFixed(3),rise:+rig.sceneryRise.toFixed(3),
          side:r(rig.sceneryOffset),offset:+rig.direction.offset.toFixed(4),pace,hold,placed:rig.placed,transition:!!g.story.transitionView});
      };
    });
    reviewTimer=setInterval(()=>{
      if(reviewBusy)return;
      reviewBusy=true;
      reviewPending=(async()=>{
        const state=await page.evaluate(()=>({time:__stats.time,beat:__game.story.current.beat,gate:__game.story.current.gate,
          tornFor:__game.curtains[2].tornFor, child:__game.child.position.toArray(),eye:__game.rig.camera.position.toArray()}));
        const file=String(reviewFrame++).padStart(5,'0')+'.jpg';
        await page.screenshot({path:`${out}/frames/${file}`,type:'jpeg',quality:85});
        fs.appendFileSync(`${out}/frames.jsonl`,JSON.stringify({file,...state})+'\n');
        fs.appendFileSync(`${out}/review-camera.jsonl`,await page.evaluate(()=>window.__cameraTrace.splice(0).map(r=>JSON.stringify(r)).join('\n')+'\n'));
      })().catch(e=>errors.push(`Review: ${e.message}`)).finally(()=>{reviewBusy=false;});
    },750);
  }
  const shot=async name=>{assert(await page.evaluate(()=>__game.rig.camera.position.toArray().every(Number.isFinite)), 'camera remains finite');await page.screenshot({path:`${out}/${name}.png`});console.log(name);};
  const touch=touchMode?await page.context().newCDPSession(page):null;
  async function swipe(a,b,ms=900) {
    if(touch)await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:a[0]*width,y:a[1]*height}]});
    else {await page.mouse.move(-10,-10);await page.mouse.move(a[0]*width,a[1]*height);}
    for(let i=1;i<=45;i++){
      const x=(a[0]+(b[0]-a[0])*i/45)*width,y=(a[1]+(b[1]-a[1])*i/45)*height;
      if(touch)await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y}]});
      else await page.mouse.move(x,y);
      await page.waitForTimeout(ms/45);
    }
    if(touch)await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  }
  async function curtain(gate) {
    await page.waitForFunction(i=>__game.story.name==='lines'&&__game.story.current.gate===i&&__game.story.current.beat==='curtain',gate,{timeout:300000});
    await page.waitForTimeout(2300);
    await shot(`curtain-${gate+1}-waiting`);
    for(let stroke=0;stroke<16;stroke++){
      const [x,y]=await page.evaluate(i=>{const v=__game.curtains[i].center.clone().project(__game.rig.camera);return[(v.x+1)/2,(1-v.y)/2];},gate);
      const span=width<height?.29:.21;
      await swipe([x-span,y],[x+span,y]);
      if(await page.evaluate(i=>__game.curtains[i].cleared,gate))break;
    }
    await page.waitForFunction(i=>__game.story.current.gate>i,gate,{timeout:60000});
  }
  if(process.env.CROSSING) {
    await shot('crossing-opening');
    await page.waitForFunction(()=>__game.story.name==='toLines'&&__game.story.current.time>105,null,{timeout:180000});
    await shot('crossing-approach');
  }
  if(process.env.FULL||process.env.CROSSING) {await curtain(0);await curtain(1);}
  await page.waitForFunction(()=>__game.story.current.beat==='rotary',null,{timeout:60000});
  await page.waitForFunction(()=>__game.story.current.t>8,null,{timeout:60000});
  await shot('rotary-waiting');
  assert.deepEqual(await page.evaluate(()=>__game.rotaryWashing.rotors.map(r=>[r.unhook,r.aligned])),[[1,false],[0,false]],'idle mechanisms stay closed');
  await openRotary(page,touch,!!process.env.REVERSE,shot);
  await page.waitForTimeout(3300);
  await shot('rotary-crossing');
  await page.waitForFunction(()=>__game.child.position.z < __game.tuning.rotaryWashing.z - 4,null,{timeout:60000});
  await shot('rotary-near-passage');
  await page.waitForFunction(()=>__game.child.position.z < __game.tuning.rotaryWashing.farZ - 4,null,{timeout:60000});
  await shot('rotary-far-passage');
  await curtain(2);
  await page.waitForFunction(()=>__game.story.current.beat==='family',null,{timeout:60000});
  await page.waitForTimeout(2200);
  await shot('family');
  await page.waitForFunction(()=>__game.story.current.beat==='haul',null,{timeout:120000});
  await page.waitForTimeout(1800);
  await shot('shore');
  assert.equal(await page.evaluate(()=>__game.shoreHaul.boatAt),0,'the boat waits for the player');
  for(let stroke=0;stroke<40;stroke++) {
    const [x,y,run]=await page.evaluate(()=>{
      const v=__game.shoreHaul.pinwheel.clone().project(__game.rig.camera);
      return[(v.x+1)/2,(1-v.y)/2,__game.shoreHaul.run];
    });
    if(run>=12.99)break;
    const span=width<height?.22:.13;
    const a=[Math.max(.02,x-span),y],b=[Math.min(.98,x+span),y];
    await swipe(stroke%2?b:a,stroke%2?a:b,600);
  }
  await page.waitForFunction(()=>__game.story.current.beat!=='haul',null,{timeout:20000});
  await shot('boat-in');
  await page.waitForFunction(()=>__game.story.name==='toBoats',null,{timeout:120000});
  await page.waitForTimeout(6000);
  assert(await page.evaluate(()=>!__game.boat.grounded && __game.child.ground(__game.boat.position.x,__game.boat.position.z)<0),'the boat sails off the island');
  await shot('departure');
  await stopReview();
  const rotary=await page.evaluate(()=>({sounds:window.__rotarySounds,trace:window.__rotaryTrace}));
  fs.writeFileSync(`${out}/rotary.json`,JSON.stringify(rotary));
  const visibility=await checkFamilyVisibility(page);
  assert.deepEqual(rotary.sounds.map(s=>s.kind).sort(),['creak','creak','release'],'two bearing creaks and one cloth release across the whole encounter');
  assert.deepEqual(errors,[]);
  fs.writeFileSync(`${out}/report.json`,JSON.stringify({visibility,width,height,touch:touchMode,errors,
    full:!!process.env.FULL||!!process.env.CROSSING,crossing:!!process.env.CROSSING,reverse:!!process.env.REVERSE},null,2));
  const video=page.video();await page.close();if(video)await video.saveAs(`${out}/playthrough.webm`);
  console.log(`PASS: ${out}`);
} catch(e){await stopReview();if(page&&!page.isClosed()){
  await page.screenshot({path:`${out}/failure.png`}).catch(()=>{});
  fs.writeFileSync(`${out}/failure.json`,JSON.stringify(await page.evaluate(()=>({
    visibility:window.__familyVisibility,rotors:__game.rotaryWashing.rotors.map(r=>({angle:r.angle,speed:r.speed,unhook:r.unhook,aligned:r.aligned}))
  })).catch(()=>null),null,2));
}console.error(errors);throw e;}
finally {clearInterval(reviewTimer);await close();}
